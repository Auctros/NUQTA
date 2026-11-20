// @vitest-environment node
/**
 * NUQTA Sync Server Tests — Stage 1
 *
 * Covers:
 * - Database initialization and restart persistence
 * - Device registration and identity binding
 * - Ordered change storage and tombstones
 * - Duplicate delivery and idempotency
 * - Atomic batch rejection
 * - Cursor-based delta retrieval and pagination
 * - WebSocket authentication, fail-closed config, Tailscale identity, and Origin rejection
 * - Multiple connected clients and change broadcasting
 * - Invalid and oversized messages
 * - Server restart and recovery
 * - Integration with scripts/serve-dist.mjs and static-serving isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSyncServer } from '../scripts/sync-server.mjs';
import { createDistServer } from '../scripts/serve-dist.mjs';
import { resolveDbPath } from '../scripts/sync/config.mjs';

const TEST_ORIGIN = 'https://nuqta-host.tailnet.ts.net';
const TEST_TOKEN = 'test-sync-secret-token-32bytes';
const TEST_TAILSCALE_USER = 'alice@example.com';

/** Any JSON message exchanged over the sync WebSocket. */
type SyncMessage = Record<string, any>;
/** Return value of createSyncServer() (untyped .mjs module). */
type SyncServer = any;
type TempWorkspace = { dir: string; dbPath: string; cleanup: () => void };
type RawOutcome = { kind: string; statusCode?: number; code?: number; reason?: string; message?: string; ws?: unknown };
type ClientOptions = {
  origin?: string;
  headers?: Record<string, string>;
  useAuthFrame?: boolean;
  /** null = send no Authorization header (Tailscale-identity-only servers). */
  token?: string | null;
};

function createTempWorkspace(): TempWorkspace {
  const dir = mkdtempSync(join(tmpdir(), 'nuqta-sync-test-'));
  return {
    dir,
    dbPath: join(dir, 'sync-server.sqlite'),
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function makeChange(
  deviceId: string,
  storeName = 'tasks',
  recordId = 't-1',
  operation = 'create',
  payload: Record<string, unknown> = { title: 'Test' },
  overrides: Record<string, unknown> = {}
) {
  return {
    device_id: deviceId,
    client_change_id: randomUUID(),
    store_name: storeName,
    record_id: recordId,
    operation,
    payload,
    client_timestamp: new Date().toISOString(),
    base_version: 0,
    ...overrides,
  };
}

function createMessageQueue(ws: WebSocket) {
  const queue: SyncMessage[] = [];
  const waiters: Array<(msg: SyncMessage) => void> = [];

  ws.on('message', (data: unknown) => {
    const parsed = JSON.parse(String(data));
    if (waiters.length > 0) {
      const resolve = waiters.shift()!;
      resolve(parsed);
    } else {
      queue.push(parsed);
    }
  });

  return {
    next(timeoutMs = 3000): Promise<SyncMessage> {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift()!);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(onMsg);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error('timeout waiting for WebSocket message'));
        }, timeoutMs);
        const onMsg = (msg: SyncMessage) => {
          clearTimeout(timer);
          resolve(msg);
        };
        waiters.push(onMsg);
      });
    },
    drain() {
      queue.length = 0;
    },
  };
}

async function openAuthenticatedClient(port: number, deviceId: string, {
  origin = TEST_ORIGIN,
  headers = {},
  useAuthFrame = false,
  token = TEST_TOKEN,
}: ClientOptions = {}) {
  const query = useAuthFrame ? '' : `?device_id=${deviceId}`;
  const reqHeaders = {
    origin,
    ...(useAuthFrame || token === null ? {} : { authorization: `Bearer ${token}` }),
    ...headers,
  };

  const ws = new WebSocket(`ws://127.0.0.1:${port}/sync${query}`, {
    headers: reqHeaders,
  });
  const inbox = createMessageQueue(ws);

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  if (useAuthFrame) {
    ws.send(JSON.stringify({
      type: 'auth',
      deviceId,
      token,
      deviceName: 'Test Android',
      platform: 'android',
      appVersion: '0.1.0',
    }));
  }

  const welcome = await inbox.next();
  return { ws, inbox, welcome };
}

function attemptRawWsConnection(url: string, headers: Record<string, string> = {}): Promise<RawOutcome> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;

    const finish = (outcome: RawOutcome) => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {}
      resolve(outcome);
    };

    ws.on('unexpected-response', (_req, res) => {
      finish({ kind: 'http_rejected', statusCode: res.statusCode });
    });

    ws.on('close', (code, reason) => {
      finish({ kind: 'closed', code, reason: reason.toString() });
    });

    ws.on('error', (err) => {
      finish({ kind: 'error', message: err.message });
    });

    ws.on('open', () => {
      // Wait briefly to see if server immediately closes it (e.g., 1008)
      setTimeout(() => finish({ kind: 'open', ws }), 100);
    });
  });
}

describe('NUQTA Sync Server (Stage 1)', () => {
  let temp!: TempWorkspace;
  let server!: SyncServer;

  beforeEach(() => {
    temp = createTempWorkspace();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null as unknown as SyncServer;
    }
    if (temp) {
      temp.cleanup();
      temp = null as unknown as TempWorkspace;
    }
  });

  // -------------------------------------------------------------------------
  // 1. Database initialization and restart persistence
  // -------------------------------------------------------------------------

  describe('Database initialization and restart persistence', () => {
    it('creates all required schema tables, WAL mode, and schema_version', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const tables = server.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r: any) => r.name);

      expect(tables).toEqual(
        expect.arrayContaining([
          'devices',
          'changes',
          'device_cursors',
          'processed_changes',
          'tombstones',
          'server_meta',
        ])
      );

      const journalMode = server.db.pragma('journal_mode', { simple: true });
      expect(String(journalMode).toLowerCase()).toBe('wal');

      const meta = server.db
        .prepare("SELECT value FROM server_meta WHERE key = 'schema_version'")
        .get();
      expect(meta.value).toBe('1');
    });

    it('rejects database paths located inside dist/ or public/', () => {
      expect(() => resolveDbPath('dist/sync.sqlite')).toThrow(/outside dist\/ and public\//);
      expect(() => resolveDbPath('public/sync.sqlite')).toThrow(/outside dist\/ and public\//);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Device registration
  // -------------------------------------------------------------------------

  describe('Device registration', () => {
    it('registers a device persistently via authenticated handshake frame and updates metadata', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const deviceId = randomUUID();
      const { ws, welcome } = await openAuthenticatedClient(server.port, deviceId, {
        useAuthFrame: true,
      });

      expect(welcome.type).toBe('welcome');
      expect(welcome.deviceId).toBe(deviceId.toLowerCase());
      expect(welcome.deviceCursor).toBe(0);
      expect(welcome.serverCursor).toBe(0);

      const row = server.db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId);
      expect(row).toBeDefined();
      expect(row.device_name).toBe('Test Android');
      expect(row.platform).toBe('android');
      expect(row.auth_method).toBe('token');
      expect(row.is_active).toBe(1);

      ws.close();
    });

    it('rejects non-UUID device_id and prevents cross-identity device hijacking', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        allowedTailscaleUsers: ['alice@example.com', 'bob@example.com'],
      });

      const badRes = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=not-a-uuid`,
        { origin: TEST_ORIGIN, 'tailscale-user-login': 'alice@example.com' }
      );
      expect(badRes.kind).toBe('closed');
      expect(badRes.code).toBe(1008);

      const deviceId = randomUUID();
      const alice = await openAuthenticatedClient(server.port, deviceId, {
        token: null,
        headers: { 'tailscale-user-login': 'alice@example.com' },
      });
      alice.ws.close();

      const bobAttempt = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { origin: TEST_ORIGIN, 'tailscale-user-login': 'bob@example.com' }
      );
      expect(bobAttempt.kind).toBe('closed');
      expect(bobAttempt.code).toBe(1008);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Ordered change storage and tombstones
  // -------------------------------------------------------------------------

  describe('Ordered change storage', () => {
    it('commits changes in strict monotonic order, records tombstones on delete, and rejects meta store', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const deviceId = randomUUID();
      const { ws, inbox } = await openAuthenticatedClient(server.port, deviceId);

      const c1 = makeChange(deviceId, 'tasks', 'task-1', 'create', { title: 'Task 1' });
      const c2 = makeChange(deviceId, 'tasks', 'task-1', 'delete', { deleted: true });

      ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [c1, c2] }));
      const ack = await inbox.next();

      expect(ack.type).toBe('sync_ack');
      expect(ack.serverCursor).toBe(2);
      expect(ack.acknowledged).toEqual([
        { clientChangeId: c1.client_change_id, serverChangeId: 1, status: 'applied' },
        { clientChangeId: c2.client_change_id, serverChangeId: 2, status: 'applied' },
      ]);

      const tombstone = server.db
        .prepare("SELECT * FROM tombstones WHERE store_name = 'tasks' AND record_id = 'task-1'")
        .get();
      expect(tombstone).toBeDefined();
      expect(tombstone.server_change_id).toBe(2);

      // Local schema metadata ('meta') must not be synchronized blindly
      const metaChange = makeChange(deviceId, 'meta', 'schema', 'update', { schemaVersion: 99 });
      ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [metaChange] }));
      const errResp = await inbox.next();
      expect(errResp.type).toBe('error');
      expect(errResp.error).toBe('batch_rejected');

      ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Duplicate delivery and idempotency
  // -------------------------------------------------------------------------

  describe('Duplicate delivery and idempotency', () => {
    it('acknowledges duplicate (device_id, client_change_id) without double-applying or re-broadcasting', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const d1 = randomUUID();
      const d2 = randomUUID();
      const c1 = await openAuthenticatedClient(server.port, d1);
      const c2 = await openAuthenticatedClient(server.port, d2);

      const change = makeChange(d1, 'habits', 'habit-1', 'create', { title: 'Read' });

      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [change] }));
      const ack1 = await c1.inbox.next();
      const bc1 = await c2.inbox.next();

      expect(ack1.acknowledged[0].status).toBe('applied');
      expect(bc1.type).toBe('sync_broadcast');
      expect(bc1.changes).toHaveLength(1);

      // Resend the exact same change from device 1
      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [change] }));
      const ack2 = await c1.inbox.next();
      expect(ack2.acknowledged).toEqual([
        { clientChangeId: change.client_change_id, serverChangeId: 1, status: 'duplicate' },
      ]);

      // Different device CAN reuse the same client_change_id UUID independently
      const sameUuidOtherDevice = makeChange(d2, 'habits', 'habit-2', 'create', { title: 'Run' }, {
        client_change_id: change.client_change_id,
      });
      c2.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [sameUuidOtherDevice] }));
      const ack3 = await c2.inbox.next();
      expect(ack3.acknowledged[0].status).toBe('applied');
      expect(ack3.acknowledged[0].serverChangeId).toBe(2);

      const totalRows = server.db.prepare('SELECT COUNT(*) as cnt FROM changes').get().cnt;
      expect(totalRows).toBe(2);

      c1.ws.close();
      c2.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Atomic batch rejection
  // -------------------------------------------------------------------------

  describe('Atomic batch rejection', () => {
    it('rolls back entire batch if any item is invalid or spoofs another device_id', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const d1 = randomUUID();
      const d2 = randomUUID();
      const c1 = await openAuthenticatedClient(server.port, d1);
      const c2 = await openAuthenticatedClient(server.port, d2);

      const validItem = makeChange(d1, 'tasks', 't-valid', 'create', { title: 'Should Rollback' });
      const invalidStoreItem = makeChange(d1, 'invalid_store', 't-bad', 'create', { title: 'Bad' });

      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [validItem, invalidStoreItem] }));
      const err1 = await c1.inbox.next();
      expect(err1.type).toBe('error');
      expect(err1.error).toBe('batch_rejected');

      // Spoofing another device_id inside batch must also reject the whole batch
      const spoofedItem = makeChange(d2, 'tasks', 't-spoof', 'create', { title: 'Spoofed' });
      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [validItem, spoofedItem] }));
      const err2 = await c1.inbox.next();
      expect(err2.type).toBe('error');
      expect(err2.error).toBe('batch_rejected');

      const count = server.db.prepare('SELECT COUNT(*) as cnt FROM changes').get().cnt;
      expect(count).toBe(0);

      // Ensure no broadcast leaked to device 2
      await expect(c2.inbox.next(150)).rejects.toThrow(/timeout/);

      c1.ws.close();
      c2.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Cursor-based delta retrieval and pagination
  // -------------------------------------------------------------------------

  describe('Cursor-based delta retrieval and pagination', () => {
    it('paginates changes via /sync/delta and tracks per-device ack cursors without skipping other devices', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const d1 = randomUUID();
      const d2 = randomUUID();
      const c1 = await openAuthenticatedClient(server.port, d1);
      const c2 = await openAuthenticatedClient(server.port, d2);

      const batch1 = Array.from({ length: 5 }, (_, i) =>
        makeChange(d1, 'tasks', `t-${i + 1}`, 'create', { title: `Task ${i + 1}` })
      );
      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: batch1 }));
      await c1.inbox.next();

      // Device 2 pushes a change while still at deviceCursor = 0; its cursor must NOT jump past d1's changes!
      const d2Change = makeChange(d2, 'goals', 'g-1', 'create', { title: 'Goal 1' });
      c2.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [d2Change] }));
      // c2 first receives the broadcast of d1's committed batch, then its own sync_ack.
      const d2Broadcast = await c2.inbox.next();
      expect(d2Broadcast.type).toBe('sync_broadcast');
      const d2Ack = await c2.inbox.next();
      expect(d2Ack.type).toBe('sync_ack');
      expect(d2Ack.deviceCursor).toBe(0);
      expect(d2Ack.serverCursor).toBe(6);

      // Unauthenticated delta request (even with valid device_id) must fail
      const unauthRes = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${d2}&cursor=0&limit=2`
      );
      expect(unauthRes.status).toBe(401);

      // Page 1 (limit=2, cursor=0)
      const page1Res = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${d2}&cursor=0&limit=2`,
        { headers: { authorization: `Bearer ${TEST_TOKEN}` } }
      );
      expect(page1Res.status).toBe(200);
      const page1 = await page1Res.json();
      expect(page1.changes.map((c: any) => c.serverChangeId)).toEqual([1, 2]);
      expect(page1.nextCursor).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.serverCursor).toBe(6);

      // Page 2 (limit=4, cursor=2 -> returns 3,4,5,6 and exact hasMore=false)
      const page2Res = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${d2}&cursor=2&limit=4`,
        { headers: { authorization: `Bearer ${TEST_TOKEN}` } }
      );
      const page2 = await page2Res.json();
      expect(page2.changes.map((c: any) => c.serverChangeId)).toEqual([3, 4, 5, 6]);
      expect(page2.nextCursor).toBe(6);
      expect(page2.hasMore).toBe(false);

      // Explicit ack advances device 2's cursor durably
      c2.ws.send(JSON.stringify({ type: 'ack', cursor: 6 }));
      const ackOk = await c2.inbox.next();
      expect(ackOk).toEqual({ type: 'ack_ok', deviceCursor: 6, serverCursor: 6 });

      // Invalid cursor query parameter rejected
      const badCursorRes = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${d2}&cursor=abc`,
        { headers: { authorization: `Bearer ${TEST_TOKEN}` } }
      );
      expect(badCursorRes.status).toBe(400);

      c1.ws.close();
      c2.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 7. WebSocket authentication, fail-closed config, and Origin rejection
  // -------------------------------------------------------------------------

  describe('WebSocket authentication and Origin security', () => {
    it('fails closed when required auth configuration is missing', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        // No authToken, no allowedTailscaleUsers, no allowedOrigins
      });

      const deviceId = randomUUID();
      const wsRes = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { origin: TEST_ORIGIN }
      );
      expect(wsRes.kind).toBe('http_rejected');
      expect(wsRes.statusCode).toBe(503);

      const deltaRes = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${deviceId}`
      );
      expect(deltaRes.status).toBe(503);

      const healthRes = await fetch(`http://127.0.0.1:${server.port}/health`);
      expect(healthRes.status).toBe(200);
      const health = await healthRes.json();
      expect(health.syncConfigured).toBe(false);
    });

    it('rejects missing or disallowed Origin headers and unauthenticated UUID-only attempts', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        allowedTailscaleUsers: [TEST_TAILSCALE_USER],
      });

      const deviceId = randomUUID();

      // Missing Origin
      const noOrigin = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { 'tailscale-user-login': TEST_TAILSCALE_USER }
      );
      expect(noOrigin.kind).toBe('http_rejected');
      expect(noOrigin.statusCode).toBe(403);

      // Disallowed Origin
      const badOrigin = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { origin: 'https://evil.example', 'tailscale-user-login': TEST_TAILSCALE_USER }
      );
      expect(badOrigin.kind).toBe('http_rejected');
      expect(badOrigin.statusCode).toBe(403);

      // Valid Origin + UUID only (no Tailscale header, no token) -> must NOT authenticate
      const uuidOnly = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { origin: TEST_ORIGIN }
      );
      expect(uuidOnly.kind).toBe('http_rejected');
      expect(uuidOnly.statusCode).toBe(401);

      // Wrong Tailscale user -> 403
      const wrongUser = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${deviceId}`,
        { origin: TEST_ORIGIN, 'tailscale-user-login': 'intruder@example.com' }
      );
      expect(wrongUser.kind).toBe('http_rejected');
      expect(wrongUser.statusCode).toBe(403);

      // Valid Tailscale identity header -> accepted
      const valid = await openAuthenticatedClient(server.port, deviceId, {
        token: null,
        headers: { 'tailscale-user-login': TEST_TAILSCALE_USER },
      });
      expect(valid.welcome.type).toBe('welcome');
      valid.ws.close();
    });

    it('rejects sync messages sent before completing auth handshake frame and rejects wrong tokens', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/sync`, {
        headers: { origin: TEST_ORIGIN },
      });
      const inbox = createMessageQueue(ws);
      await new Promise((resolve) => ws.once('open', resolve));

      ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [] }));
      const msg = await inbox.next();
      expect(msg.type).toBe('error');
      expect(msg.error).toBe('authentication_required');

      const wrongTokenRes = await attemptRawWsConnection(
        `ws://127.0.0.1:${server.port}/sync?device_id=${randomUUID()}`,
        { origin: TEST_ORIGIN, authorization: 'Bearer wrong-token' }
      );
      expect(wrongTokenRes.kind).toBe('http_rejected');
      expect(wrongTokenRes.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Multiple connected clients and change broadcasting
  // -------------------------------------------------------------------------

  describe('Multiple connected clients and broadcasting', () => {
    it('broadcasts committed changes to other authenticated clients only', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const d1 = randomUUID();
      const d2 = randomUUID();
      const d3 = randomUUID();

      const c1 = await openAuthenticatedClient(server.port, d1);
      const c2 = await openAuthenticatedClient(server.port, d2);
      const c3 = await openAuthenticatedClient(server.port, d3);

      const change = makeChange(d1, 'journal_entries', 'j-1', 'create', { text: 'Daily note' });
      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [change] }));

      const ack1 = await c1.inbox.next();
      expect(ack1.type).toBe('sync_ack');

      const [b2, b3] = await Promise.all([c2.inbox.next(), c3.inbox.next()]);
      expect(b2.type).toBe('sync_broadcast');
      expect(b2.changes[0].recordId).toBe('j-1');
      expect(b2.changes[0].deviceId).toBe(d1);

      expect(b3.type).toBe('sync_broadcast');
      expect(b3.changes[0].recordId).toBe('j-1');

      // Sender must not receive its own broadcast
      await expect(c1.inbox.next(150)).rejects.toThrow(/timeout/);

      c1.ws.close();
      c2.ws.close();
      c3.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 9. Invalid and oversized messages
  // -------------------------------------------------------------------------

  describe('Invalid and oversized messages', () => {
    it('rejects invalid JSON, unknown types, non-array changes, oversized messages, and oversized batches', async () => {
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
        maxBatchSize: 3,
      });

      const deviceId = randomUUID();
      const { ws, inbox } = await openAuthenticatedClient(server.port, deviceId);

      ws.send('not-json');
      expect((await inbox.next()).error).toBe('invalid_json');

      ws.send(JSON.stringify(['array-not-object']));
      expect((await inbox.next()).error).toBe('invalid_message_format');

      ws.send(JSON.stringify({ type: 'unknown_op' }));
      expect((await inbox.next()).error).toBe('unknown_message_type');

      ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: 'not-array' }));
      expect((await inbox.next()).error).toBe('changes must be an array');

      ws.send('x'.repeat(70 * 1024));
      expect((await inbox.next()).error).toBe('message_too_large');

      const tooMany = Array.from({ length: 4 }, (_, i) =>
        makeChange(deviceId, 'tasks', `t-${i}`, 'create', { title: `T${i}` })
      );
      ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: tooMany }));
      expect((await inbox.next()).error).toBe('batch too large');

      ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 10. Server restart and recovery
  // -------------------------------------------------------------------------

  describe('Server restart and recovery', () => {
    it('recovers persisted devices, cursors, and ordered change log after full server restart', async () => {
      const d1 = randomUUID();
      const d2 = randomUUID();

      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const c1 = await openAuthenticatedClient(server.port, d1);
      const c2 = await openAuthenticatedClient(server.port, d2);

      const ch1 = makeChange(d1, 'tasks', 't-r1', 'create', { title: 'Before Restart 1' });
      const ch2 = makeChange(d1, 'tasks', 't-r2', 'create', { title: 'Before Restart 2' });
      c1.ws.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: [ch1, ch2] }));
      await c1.inbox.next();
      await c2.inbox.next();

      c2.ws.send(JSON.stringify({ type: 'ack', cursor: 1 }));
      await c2.inbox.next();

      c1.ws.close();
      c2.ws.close();
      await server.close();
      server = null;

      // Restart server using the same SQLite database file
      server = await createSyncServer({
        port: 0,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      const c2Reconnected = await openAuthenticatedClient(server.port, d2);
      expect(c2Reconnected.welcome.deviceCursor).toBe(1);
      expect(c2Reconnected.welcome.serverCursor).toBe(2);

      // Recover missed delta after deviceCursor = 1
      const deltaRes = await fetch(
        `http://127.0.0.1:${server.port}/sync/delta?device_id=${d2}&cursor=${c2Reconnected.welcome.deviceCursor}`,
        { headers: { authorization: `Bearer ${TEST_TOKEN}` } }
      );
      expect(deltaRes.status).toBe(200);
      const delta = await deltaRes.json();
      expect(delta.changes).toHaveLength(1);
      expect(delta.changes[0].serverChangeId).toBe(2);
      expect(delta.changes[0].recordId).toBe('t-r2');

      // New change continues monotonically at serverChangeId = 3
      const ch3 = makeChange(d2, 'tasks', 't-r3', 'create', { title: 'After Restart' });
      c2Reconnected.ws.send(JSON.stringify({ type: 'sync', clientCursor: 2, changes: [ch3] }));
      const ack3 = await c2Reconnected.inbox.next();
      expect(ack3.acknowledged[0].serverChangeId).toBe(3);
      expect(ack3.deviceCursor).toBe(2);
      expect(ack3.serverCursor).toBe(3);

      c2Reconnected.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // 11. Existing HTTP server integration (serve-dist.mjs) & static isolation
  // -------------------------------------------------------------------------

  describe('serve-dist.mjs integration and static serving isolation', () => {
    it('attaches /sync, /sync/delta, and /health to serve-dist HTTP server without exposing internal files', async () => {
      const distDir = join(temp.dir, 'dist');
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, 'index.html'), '<html><body>NUQTA</body></html>', 'utf8');

      const distServer = await createDistServer({
        port: 0,
        distDir,
        dbPath: temp.dbPath,
        allowedOrigins: [TEST_ORIGIN],
        authToken: TEST_TOKEN,
      });

      try {
        // Static HTML still works
        const indexRes = await fetch(`http://127.0.0.1:${distServer.port}/`);
        expect(indexRes.status).toBe(200);
        expect(await indexRes.text()).toContain('NUQTA');

        // Health endpoint works on the same port
        const healthRes = await fetch(`http://127.0.0.1:${distServer.port}/health`);
        expect(healthRes.status).toBe(200);
        const health = await healthRes.json();
        expect(health.service).toBe('nuqta-sync');
        expect(health.syncConfigured).toBe(true);

        // Path traversal / internal SQLite files must never be exposed
        const traversalRes = await fetch(`http://127.0.0.1:${distServer.port}/%2e%2e/sync-server.sqlite`);
        expect([403, 404]).toContain(traversalRes.status);

        // WebSocket /sync works on the exact same HTTP server port
        const deviceId = randomUUID();
        const client = await openAuthenticatedClient(distServer.port, deviceId);
        expect(client.welcome.type).toBe('welcome');
        client.ws.close();
      } finally {
        await distServer.close();
      }
    });
  });
});
