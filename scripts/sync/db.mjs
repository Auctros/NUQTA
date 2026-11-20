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

export class BatchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BatchValidationError';
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

  const stmtUpsertTombstone = db.prepare(`
    INSERT INTO tombstones (device_id, store_name, record_id, server_change_id, deleted_at, expires_at)
    VALUES (@device_id, @store_name, @record_id, @server_change_id, datetime('now'), datetime('now', '+30 days'))
    ON CONFLICT(store_name, record_id) DO UPDATE SET
      device_id = excluded.device_id,
      server_change_id = excluded.server_change_id,
      deleted_at = datetime('now'),
      expires_at = datetime('now', '+30 days')
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

        if (change.operation === 'delete' || change.operation === 'tombstone') {
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

  return {
    registerDevice: (params) => registerDeviceTx(params),
    getDevice: (deviceId) => stmtGetDevice.get({ device_id: deviceId }) ?? null,
    getDeviceCursor: (deviceId) =>
      Number(stmtGetCursor.get({ device_id: deviceId })?.last_processed_change_id ?? 0),
    getLatestServerCursor: () => Number(stmtLatestServerCursor.get()?.max_id ?? 0),
    ingestBatch: (params) => ingestBatchTx(params),
    acknowledgeCursor: (params) => acknowledgeCursorTx(params),
    getDelta,
  };
}
