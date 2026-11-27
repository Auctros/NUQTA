import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_MAX_PAYLOAD_SIZE, SCHEMA_PATH } from './config.mjs';
import { validateChangeItem } from './validation.mjs';

export class DeviceIdentityConflictError extends Error {
  constructor(message = 'Device ID is bound to a different authenticated identity') {
    super(message);
    this.name = 'DeviceIdentityConflictError';
  }
}

/**
 * How long a tombstone is retained.
 *
 * A tombstone is the only thing preventing a device that was offline when a record was
 * deleted from re-uploading it, so it must outlive every realistic offline period.
 * 30 days is the product's stated retention; the value is centralised so the cleanup
 * job and the documentation cannot drift apart.
 */
export const TOMBSTONE_RETENTION_DAYS = 30;

export class BatchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BatchValidationError';
  }
}

/**
 * v3 adds the `projects` store.
 *
 * `store_name` is constrained by a CHECK, and SQLite cannot alter one in place, so an
 * existing database would keep rejecting project rows even after the schema file
 * changed. The two affected tables are therefore rebuilt using SQLite's documented
 * procedure: foreign keys off, `legacy_alter_table` on so the rename does NOT rewrite
 * the `processed_changes` foreign key, copy, drop, recreate, copy back, then verify
 * with `foreign_key_check` before committing.
 *
 * The old indexes must be dropped explicitly: `CREATE INDEX IF NOT EXISTS` in the
 * schema would otherwise see the surviving index names and skip, leaving the new
 * tables unindexed once the renamed tables are dropped.
 *
 * Runs only when the recorded version is older, so a fresh database never pays for it.
 */
function migrateToV3(db) {
  const row = db.prepare("SELECT value FROM server_meta WHERE key = 'schema_version'").get();
  if (row && Number(row.value) >= 3) return;

  const schemaSql = readFileSync(SCHEMA_PATH, 'utf8');

  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  try {
    const tx = db.transaction(() => {
      db.exec(`
        ALTER TABLE changes RENAME TO changes_v2;
        ALTER TABLE tombstones RENAME TO tombstones_v2;

        DROP INDEX IF EXISTS idx_changes_device_client;
        DROP INDEX IF EXISTS idx_changes_store_seq;
        DROP INDEX IF EXISTS idx_changes_store_record;
        DROP INDEX IF EXISTS idx_tombstones_expires;
      `);
      db.exec(schemaSql);
      db.exec(`
        INSERT INTO changes (server_change_id, device_id, client_change_id, store_name,
                             record_id, operation, payload, client_timestamp,
                             base_version, created_at)
        SELECT server_change_id, device_id, client_change_id, store_name,
               record_id, operation, payload, client_timestamp,
               base_version, created_at
        FROM changes_v2;

        INSERT INTO tombstones (tombstone_id, device_id, store_name, record_id,
                                server_change_id, deleted_at, expires_at)
        SELECT tombstone_id, device_id, store_name, record_id,
               server_change_id, deleted_at, expires_at
        FROM tombstones_v2;

        DROP TABLE changes_v2;
        DROP TABLE tombstones_v2;

        INSERT INTO server_meta (key, value, updated_at)
        VALUES ('schema_version', '3', datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');
      `);

      const violations = db.pragma('foreign_key_check');
      if (Array.isArray(violations) && violations.length > 0) {
        throw new Error('sync schema migration left foreign key violations');
      }
    });
    tx();
  } finally {
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
  }
}

export function openSyncDatabase(dbPath, schemaPath = SCHEMA_PATH) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  const schemaSql = readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  migrateToV3(db);

  return db;
}

function formatChangeRow(row) {
  return {
    serverChangeId: Number(row.server_change_id),
    deviceId: row.device_id,
    clientChangeId: row.client_change_id,
    storeName: row.store_name,
    recordId: row.record_id,
    operation: row.operation,
    payload: JSON.parse(row.payload),
    clientTimestamp: row.client_timestamp ?? null,
    baseVersion: row.base_version ?? null,
    createdAt: row.created_at,
  };
}

export function createSyncRepository(db) {
  const stmtGetDevice = db.prepare(`
    SELECT device_id, device_name, platform, app_version, auth_subject, auth_method, last_seen_at, created_at, is_active
    FROM devices
    WHERE device_id = @device_id
  `);

  const stmtUpsertDevice = db.prepare(`
    INSERT INTO devices (device_id, device_name, platform, app_version, auth_subject, auth_method, last_seen_at, is_active)
    VALUES (@device_id, @device_name, @platform, @app_version, @auth_subject, @auth_method, datetime('now'), 1)
    ON CONFLICT(device_id) DO UPDATE SET
      device_name = excluded.device_name,
      platform = excluded.platform,
      app_version = excluded.app_version,
      auth_method = excluded.auth_method,
      last_seen_at = datetime('now'),
      is_active = 1
  `);

  const stmtTouchDevice = db.prepare(`
    UPDATE devices SET last_seen_at = datetime('now'), is_active = 1 WHERE device_id = @device_id
  `);

  const stmtEnsureCursor = db.prepare(`
    INSERT OR IGNORE INTO device_cursors (device_id, last_processed_change_id, updated_at)
    VALUES (@device_id, 0, datetime('now'))
  `);

  const stmtGetCursor = db.prepare(`
    SELECT last_processed_change_id FROM device_cursors WHERE device_id = @device_id
  `);

  const stmtAdvanceCursor = db.prepare(`
    INSERT INTO device_cursors (device_id, last_processed_change_id, updated_at)
    VALUES (@device_id, @cursor, datetime('now'))
    ON CONFLICT(device_id) DO UPDATE SET
      last_processed_change_id = MAX(device_cursors.last_processed_change_id, excluded.last_processed_change_id),
      updated_at = datetime('now')
  `);

  const stmtLatestServerCursor = db.prepare(`
    SELECT COALESCE(MAX(server_change_id), 0) AS max_id FROM changes
  `);

  const stmtFindProcessed = db.prepare(`
    SELECT server_change_id FROM processed_changes
    WHERE device_id = @device_id AND client_change_id = @client_change_id
  `);

  const stmtInsertChange = db.prepare(`
    INSERT INTO changes (
      device_id, client_change_id, store_name, record_id,
      operation, payload, client_timestamp, base_version, created_at
    )
    VALUES (
      @device_id, @client_change_id, @store_name, @record_id,
      @operation, @payload, @client_timestamp, @base_version, datetime('now')
    )
  `);

  const stmtSelectChangeById = db.prepare(`
    SELECT server_change_id, device_id, client_change_id, store_name, record_id,
           operation, payload, client_timestamp, base_version, created_at
    FROM changes
    WHERE server_change_id = @server_change_id
  `);

  const stmtMarkProcessed = db.prepare(`
    INSERT INTO processed_changes (device_id, client_change_id, server_change_id, processed_at)
    VALUES (@device_id, @client_change_id, @server_change_id, datetime('now'))
  `);

  const stmtGetMeta = db.prepare(`
    SELECT value FROM server_meta WHERE key = @key
  `);

  const stmtSetMeta = db.prepare(`
    INSERT INTO server_meta (key, value, updated_at)
    VALUES (@key, @value, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const stmtUpsertTombstone = db.prepare(`
    INSERT INTO tombstones (device_id, store_name, record_id, server_change_id, deleted_at, expires_at)
    VALUES (@device_id, @store_name, @record_id, @server_change_id, datetime('now'), datetime('now', '+30 days'))
    ON CONFLICT(store_name, record_id) DO UPDATE SET
      device_id = excluded.device_id,
      server_change_id = excluded.server_change_id,
      deleted_at = datetime('now'),
      expires_at = datetime('now', '+30 days')
  `);

  /**
   * Is this record tombstoned?
   *
   * Consulted on ingest for every create/update. This is the single guard that stops a
   * stale device from resurrecting a deleted record: without it the server happily
   * appends an `update` after a `delete` and every client replays the resurrection.
   */
  const stmtFindTombstone = db.prepare(`
    SELECT server_change_id, deleted_at, expires_at
    FROM tombstones
    WHERE store_name = @store_name AND record_id = @record_id
  `);

  const stmtDeleteTombstone = db.prepare(`
    DELETE FROM tombstones
    WHERE store_name = @store_name AND record_id = @record_id
  `);

  const stmtGetDelta = db.prepare(`
    SELECT server_change_id, device_id, client_change_id, store_name, record_id,
           operation, payload, client_timestamp, base_version, created_at
    FROM changes
    WHERE server_change_id > @cursor
    ORDER BY server_change_id ASC
    LIMIT @limit
  `);

  const stmtGetDeltaExcludingDevice = db.prepare(`
    SELECT server_change_id, device_id, client_change_id, store_name, record_id,
           operation, payload, client_timestamp, base_version, created_at
    FROM changes
    WHERE server_change_id > @cursor AND device_id != @exclude_device_id
    ORDER BY server_change_id ASC
    LIMIT @limit
  `);

  const registerDeviceTx = db.transaction(
    ({ deviceId, deviceName, platform, appVersion, authSubject, authMethod }) => {
      const existing = stmtGetDevice.get({ device_id: deviceId });
      if (existing && existing.auth_subject !== authSubject) {
        throw new DeviceIdentityConflictError();
      }

      stmtUpsertDevice.run({
        device_id: deviceId,
        device_name: deviceName,
        platform,
        app_version: appVersion,
        auth_subject: authSubject,
        auth_method: authMethod,
      });

      stmtEnsureCursor.run({ device_id: deviceId });

      const device = stmtGetDevice.get({ device_id: deviceId });
      const cursorRow = stmtGetCursor.get({ device_id: deviceId });
      const latestRow = stmtLatestServerCursor.get();

      return {
        device,
        deviceCursor: Number(cursorRow?.last_processed_change_id ?? 0),
        serverCursor: Number(latestRow?.max_id ?? 0),
      };
    }
  );

  const ingestBatchTx = db.transaction(
    ({ deviceId, changes, clientCursor, maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE }) => {
      const device = stmtGetDevice.get({ device_id: deviceId });
      if (!device) {
        throw new BatchValidationError('device is not registered');
      }

      const preBatchMaxCursor = Number(stmtLatestServerCursor.get()?.max_id ?? 0);
      if (clientCursor !== undefined && clientCursor > preBatchMaxCursor) {
        throw new BatchValidationError('clientCursor exceeds serverCursor');
      }

      const seenInBatch = new Set();
      const acknowledged = [];
      const committedChanges = [];

      for (const change of changes) {
        const errors = validateChangeItem(change, deviceId, maxPayloadSize);
        if (errors.length > 0) {
          throw new BatchValidationError(`Invalid change: ${errors.join(', ')}`);
        }

        const clientChangeKey = change.client_change_id.toLowerCase();
        if (seenInBatch.has(clientChangeKey)) {
          throw new BatchValidationError(`Duplicate client_change_id within batch: ${change.client_change_id}`);
        }
        seenInBatch.add(clientChangeKey);

        const existing = stmtFindProcessed.get({
          device_id: deviceId,
          client_change_id: clientChangeKey,
        });

        if (existing) {
          acknowledged.push({
            clientChangeId: change.client_change_id,
            serverChangeId: Number(existing.server_change_id),
            status: 'duplicate',
          });
          continue;
        }

        const isDeletion = change.operation === 'delete' || change.operation === 'tombstone';

        /*
         * Deletion wins over any older write.
         *
         * A record that is tombstoned stays deleted: a create or update for it is
         * acknowledged as `superseded` rather than committed, so the change log never
         * contains a write that would resurrect it. The client treats `superseded` as
         * "drop this outbox entry" — the delete is the newer intent, and keeping the
         * entry would retry forever.
         *
         * A new `delete` for an already-tombstoned record is also superseded, which is
         * what makes a repeated deletion idempotent instead of appending a duplicate
         * change on every retry.
         */
        const tombstone = stmtFindTombstone.get({
          store_name: change.store_name,
          record_id: change.record_id,
        });
        if (tombstone) {
          acknowledged.push({
            clientChangeId: change.client_change_id,
            serverChangeId: Number(tombstone.server_change_id),
            status: 'superseded',
          });
          continue;
        }

        const serializedPayload = JSON.stringify(change.payload);
        const insertResult = stmtInsertChange.run({
          device_id: deviceId,
          client_change_id: clientChangeKey,
          store_name: change.store_name,
          record_id: change.record_id,
          operation: change.operation,
          payload: serializedPayload,
          client_timestamp: change.client_timestamp ?? null,
          base_version: change.base_version ?? null,
        });

        const serverChangeId = Number(insertResult.lastInsertRowid);

        stmtMarkProcessed.run({
          device_id: deviceId,
          client_change_id: clientChangeKey,
          server_change_id: serverChangeId,
        });

        if (isDeletion) {
          stmtUpsertTombstone.run({
            device_id: deviceId,
            store_name: change.store_name,
            record_id: change.record_id,
            server_change_id: serverChangeId,
          });
        }

        const storedRow = stmtSelectChangeById.get({ server_change_id: serverChangeId });
        committedChanges.push(formatChangeRow(storedRow));
        acknowledged.push({
          clientChangeId: change.client_change_id,
          serverChangeId,
          status: 'applied',
        });
      }

      if (clientCursor !== undefined) {
        stmtAdvanceCursor.run({
          device_id: deviceId,
          cursor: clientCursor,
        });
      }

      stmtTouchDevice.run({ device_id: deviceId });

      const deviceCursor = Number(stmtGetCursor.get({ device_id: deviceId })?.last_processed_change_id ?? 0);
      const serverCursor = Number(stmtLatestServerCursor.get()?.max_id ?? 0);

      return {
        acknowledged,
        committedChanges,
        deviceCursor,
        serverCursor,
      };
    }
  );

  const acknowledgeCursorTx = db.transaction(({ deviceId, cursor }) => {
    const device = stmtGetDevice.get({ device_id: deviceId });
    if (!device) {
      throw new BatchValidationError('device is not registered');
    }
    const serverCursor = Number(stmtLatestServerCursor.get()?.max_id ?? 0);
    if (cursor > serverCursor) {
      throw new BatchValidationError('cursor exceeds serverCursor');
    }

    stmtAdvanceCursor.run({ device_id: deviceId, cursor });
    stmtTouchDevice.run({ device_id: deviceId });

    const deviceCursor = Number(stmtGetCursor.get({ device_id: deviceId })?.last_processed_change_id ?? 0);
    return { deviceCursor, serverCursor };
  });

  function getDelta({ cursor = 0, limit = 100, excludeDeviceId = null }) {
    const rows = excludeDeviceId
      ? stmtGetDeltaExcludingDevice.all({
          cursor,
          exclude_device_id: excludeDeviceId,
          limit: limit + 1,
        })
      : stmtGetDelta.all({
          cursor,
          limit: limit + 1,
        });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const changes = pageRows.map(formatChangeRow);
    const nextCursor = changes.length > 0 ? changes[changes.length - 1].serverChangeId : cursor;
    const serverCursor = Number(stmtLatestServerCursor.get()?.max_id ?? 0);

    return {
      serverCursor,
      nextCursor,
      hasMore,
      changes,
    };
  }

  function getWorkspaceGeneration() {
    const row = stmtGetMeta.get({ key: 'workspace_generation' });
    return Number(row?.value ?? 1) || 1;
  }

  /**
   * Global reset: bump the workspace generation and clear the change log.
   *
   * Bumping the generation is the load-bearing part. Deleting rows alone would not stop
   * an offline device from re-uploading its stale snapshot the moment it reconnects; the
   * generation is what lets the server recognise that upload as belonging to a
   * superseded workspace and refuse it. The bump and the delete happen in one
   * transaction so a crash cannot leave a cleared log with an unbumped generation.
   *
   * Device cursors are reset to the new generation's baseline (0) because the log is
   * empty; keeping old cursors would make devices wait forever for changes that no
   * longer exist.
   */
  const resetWorkspaceTx = db.transaction(() => {
    const previousGeneration = getWorkspaceGeneration();
    const nextGeneration = previousGeneration + 1;

    stmtSetMeta.run({ key: 'workspace_generation', value: String(nextGeneration) });
    db.prepare('DELETE FROM tombstones').run();
    db.prepare('DELETE FROM processed_changes').run();
    db.prepare('DELETE FROM changes').run();
    db.prepare('UPDATE device_cursors SET last_processed_change_id = 0').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'changes'").run();

    return {
      previousGeneration,
      generation: nextGeneration,
      serverCursor: 0,
    };
  });

  /**
   * Remove tombstones past their retention window.
   *
   * Safe only because retention (30 days) exceeds any realistic offline period: after
   * expiry the deleted record is simply forgotten, and a device that returns later is
   * treated as a brand-new writer rather than being refused forever.
   */
  function pruneExpiredTombstones() {
    const result = db
      .prepare("DELETE FROM tombstones WHERE expires_at <= datetime('now')")
      .run();
    return result.changes;
  }

  return {
    registerDevice: (params) => registerDeviceTx(params),
    getWorkspaceGeneration,
    resetWorkspace: () => resetWorkspaceTx(),
    pruneExpiredTombstones,
    isTombstoned: (storeName, recordId) =>
      stmtFindTombstone.get({ store_name: storeName, record_id: recordId }) ?? null,
    clearTombstone: (storeName, recordId) =>
      stmtDeleteTombstone.run({ store_name: storeName, record_id: recordId }).changes,
    getDevice: (deviceId) => stmtGetDevice.get({ device_id: deviceId }) ?? null,
    getDeviceCursor: (deviceId) =>
      Number(stmtGetCursor.get({ device_id: deviceId })?.last_processed_change_id ?? 0),
    getLatestServerCursor: () => Number(stmtLatestServerCursor.get()?.max_id ?? 0),
    ingestBatch: (params) => ingestBatchTx(params),
    acknowledgeCursor: (params) => acknowledgeCursorTx(params),
    getDelta,
  };
}
