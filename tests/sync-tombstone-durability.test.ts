// @vitest-environment node
/**
 * A deleted record must not come back.
 *
 * The server keeps a tombstone to refuse a stale `create` from a device that was
 * offline when the delete happened. That guarantee used to rest on a 30-day timer
 * alone, which quietly assumed no device is ever offline for longer. This suite pins
 * the stronger rule: a tombstone is only dropped once every device that existed when
 * the deletion happened has acknowledged it, so time is a floor rather than the
 * safety boundary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSyncRepository, openSyncDatabase } from '../scripts/sync-server.mjs';

const SCHEMA_PATH = join(process.cwd(), 'scripts/sync/schema.sql');

let dir: string;
let db: any;
let repo: any;

/** Validation requires UUIDs for both device and record ids. */
const DEV_A = randomUUID();
const DEV_B = randomUUID();
const DEV_C = randomUUID();
const RECORD = randomUUID();

const device = (id: string) =>
  repo.registerDevice({
    deviceId: id,
    deviceName: id,
    platform: 'test',
    appVersion: '1.0.0',
    authSubject: 'alice@example.com',
    authMethod: 'token'
  });

const change = (deviceId: string, operation: string, recordId = RECORD, payload: any = { title: 'x' }) => ({
  device_id: deviceId,
  client_change_id: randomUUID(),
  store_name: 'tasks',
  record_id: recordId,
  operation,
  payload,
  client_timestamp: new Date().toISOString(),
  base_version: 0
});

/** Age every tombstone past retention, so only the ack rule can hold it back. */
const expireTombstones = () => {
  db.prepare("UPDATE tombstones SET expires_at = datetime('now', '-1 day')").run();
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nuqta-tombstone-'));
  db = openSyncDatabase(join(dir, 'sync.sqlite'), SCHEMA_PATH);
  repo = createSyncRepository(db);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('tombstone retention is ack-gated, not time-only', () => {
  it('keeps a tombstone past retention while a device still has not seen the delete', () => {
    device(DEV_A);
    device(DEV_B);

    // dev-a deletes the record; both devices exist, so both owe an ack.
    repo.ingestBatch({
      deviceId: DEV_A,
      changes: [change(DEV_A, 'create'), change(DEV_A, 'delete')],
      clientCursor: 0
    });
    expireTombstones();

    expect(repo.pruneExpiredTombstones()).toBe(0);
    expect(repo.isTombstoned('tasks', RECORD)).not.toBeNull();
    expect(repo.countUnacknowledgedTombstones()).toBe(1);
  });

  it('drops the tombstone once every pre-existing device has acknowledged the delete', () => {
    device(DEV_A);
    device(DEV_B);

    const result = repo.ingestBatch({
      deviceId: DEV_A,
      changes: [change(DEV_A, 'create'), change(DEV_A, 'delete')],
      clientCursor: 0
    });
    const deletionCursor = result.serverCursor;
    expireTombstones();

    repo.acknowledgeCursor({ deviceId: DEV_A, cursor: deletionCursor });
    // dev-b is still behind, so the guard must hold.
    expect(repo.pruneExpiredTombstones()).toBe(0);

    repo.acknowledgeCursor({ deviceId: DEV_B, cursor: deletionCursor });
    expect(repo.pruneExpiredTombstones()).toBe(1);
    expect(repo.isTombstoned('tasks', RECORD)).toBeNull();
  });

  it('still refuses a stale create from the device that was offline', () => {
    device(DEV_A);
    device(DEV_B);

    repo.ingestBatch({
      deviceId: DEV_A,
      changes: [change(DEV_A, 'create'), change(DEV_A, 'delete')],
      clientCursor: 0
    });
    expireTombstones();

    // dev-b never pulled the delete, so it still holds the record and re-sends it.
    const res = repo.ingestBatch({
      deviceId: DEV_B,
      changes: [change(DEV_B, 'create')],
      clientCursor: 0
    });

    expect(res.committedChanges).toHaveLength(0);
    expect(res.acknowledged[0].status).toBe('superseded');
  });

  it('does not wait on a device registered after the deletion', () => {
    device(DEV_A);

    repo.ingestBatch({
      deviceId: DEV_A,
      changes: [change(DEV_A, 'create'), change(DEV_A, 'delete')],
      clientCursor: 0
    });
    // The deletion is a day old, which is what makes "registered after it" a question
    // the timestamps can actually answer: they carry whole seconds, so a device created
    // in the same second is conservatively treated as pre-existing.
    db.prepare(
      "UPDATE tombstones SET deleted_at = datetime('now', '-1 day'), expires_at = datetime('now', '-1 day')"
    ).run();

    // A device that registers afterwards never held the record, so it is not a
    // resurrection risk and must not pin the tombstone for ever.
    device(DEV_C);
    repo.acknowledgeCursor({ deviceId: DEV_A, cursor: 2 });
    expect(repo.pruneExpiredTombstones()).toBe(1);
  });
});
