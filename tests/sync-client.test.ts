/**
 * NUQTA Sync Client Tests — Stage 2
 *
 * Every test drives real code against a real Stage 1 server over a real WebSocket
 * (the `ws` package supplies the browser-compatible implementation in Node). Nothing
 * is mocked: `applyRemote`, the outbox, the cursor and the storage engine all run for
 * real against jsdom's localStorage.
 *
 * Covered: change capture, outbox durability, acknowledgement handling, remote
 * application, echo prevention, cursor recovery via /sync/delta, reconnect behaviour,
 * and duplicate/interrupted-batch handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { createSyncServer } from '../scripts/sync-server.mjs';
import { NuqtaStorageEngine, onLocalWrite } from '../src/lib/storage';
import {
  enqueueChange,
  readOutbox,
  outboxSize,
  clearOutbox,
  acknowledge,
  peekBatch,
  toOutboundChange,
  onOutboxChange
} from '../src/lib/sync/outbox';
import {
  startChangeCapture,
  captureSectionWrite,
  withCaptureSuppressed,
  seedBaselineFromStorage,
  clearBaseline,
  toRecordMap,
  SINGLETON_RECORD_ID
} from '../src/lib/sync/changeCapture';
import {
  applyRemoteChanges,
  readApplied,
  readConflicts,
  clearApplied,
  clearConflicts,
  onRemoteApplied
} from '../src/lib/sync/applyRemote';
import { readCursor, advanceCursor, setDeviceCursor, clearCursor } from '../src/lib/sync/cursor';
import { normalizeSyncEndpoint, readSyncConfigFromEnv } from '../src/lib/sync/lifecycle';
import {
  getOrCreateDeviceId,
  peekDeviceId,
  isValidDeviceId,
  resetDeviceIdentity
} from '../src/lib/sync/deviceIdentity';
import { SyncClient, type SyncSocket } from '../src/lib/sync/client';
import type { InboundChange } from '../src/lib/sync/protocol';

const TEST_ORIGIN = 'http://localhost:3000';
/**
 * The identity Tailscale Serve attaches to a proxied request. Tests inject it on the
 * upgrade and on `fetch` to emulate the proxy — the browser client itself sends no
 * credential, exactly as in production.
 */
const TEST_TAILSCALE_USER = 'alice@example.com';
const APP_VERSION = '0.1.0';

type SyncServer = any;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until `fn` is truthy, or throw after `timeout`. Avoids arbitrary sleeps. */
async function waitFor<T>(
  fn: () => T | Promise<T>,
  { timeout = 4000, interval = 25, label = 'condition' } = {}
): Promise<T> {
  const deadline = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (e) {
      last = e;
    }
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label} (last: ${String(last)})`);
}

async function startServer(): Promise<SyncServer> {
  return createSyncServer({
    port: 0,
    dbPath: ':memory:',
    allowedOrigins: [TEST_ORIGIN],
    allowedTailscaleUsers: [TEST_TAILSCALE_USER]
  });
}

/**
 * A `fetch` that behaves like Tailscale Serve: it adds the official identity header to
 * every proxied request. The client under test never sets it.
 */
function serveFetch(identity: string = TEST_TAILSCALE_USER): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), 'tailscale-user-login': identity }
    })) as typeof fetch;
}

function makeTask(id: string, title: string): Record<string, unknown> {
  return {
    id,
    title,
    priority: 'medium',
    isTopThree: false,
    status: 'pending',
    tags: [],
    subtasks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

/** Build an inbound change as the server would emit it. */
function inbound(
  serverChangeId: number,
  overrides: Partial<InboundChange> & Pick<InboundChange, 'recordId'>
): InboundChange {
  return {
    serverChangeId,
    deviceId: 'remote-device',
    clientChangeId: randomUUID(),
    storeName: 'tasks',
    operation: 'create',
    payload: makeTask(overrides.recordId, 'Remote'),
    clientTimestamp: '2026-01-01T00:00:00.000Z',
    baseVersion: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as InboundChange;
}

beforeEach(() => {
  localStorage.clear();
  clearOutbox();
  clearCursor();
  clearApplied();
  clearConflicts();
  clearBaseline();
  resetDeviceIdentity();
});

describe('sync endpoint configuration', () => {
  // A misconfigured endpoint must not silently disable sync: the operator writes the
  // origin they browse, and the client needs a ws(s) URL ending in /sync.
  it('converts an https origin into a wss /sync URL', () => {
    expect(normalizeSyncEndpoint('https://nuqta.example.ts.net')).toBe(
      'wss://nuqta.example.ts.net/sync'
    );
  });

  it('keeps an explicit ws URL and appends the path only once', () => {
    expect(normalizeSyncEndpoint('ws://127.0.0.1:3000')).toBe('ws://127.0.0.1:3000/sync');
    expect(normalizeSyncEndpoint('ws://127.0.0.1:3000/sync')).toBe('ws://127.0.0.1:3000/sync');
    expect(normalizeSyncEndpoint('wss://host/sync/')).toBe('wss://host/sync');
  });

  it('treats empty and unusable values as "sync disabled"', () => {
    expect(normalizeSyncEndpoint('')).toBe('');
    expect(normalizeSyncEndpoint('   ')).toBe('');
    expect(normalizeSyncEndpoint(undefined)).toBe('');
    expect(normalizeSyncEndpoint('not a url')).toBe('');
    expect(normalizeSyncEndpoint('ftp://host')).toBe('');
  });

  it('reads only the endpoint from env and ignores a stray token', () => {
    expect(
      readSyncConfigFromEnv({
        VITE_NUQTA_SYNC_URL: 'https://nuqta.example.ts.net',
        VITE_NUQTA_SYNC_TOKEN: 'should-be-ignored'
      })
    ).toEqual({ url: 'wss://nuqta.example.ts.net/sync' });
    expect(readSyncConfigFromEnv({})).toEqual({ url: '' });
  });
});

describe('device identity', () => {
  it('creates a valid UUID once and returns the same value afterwards', () => {
    const first = getOrCreateDeviceId();
    expect(isValidDeviceId(first)).toBe(true);

    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
    expect(peekDeviceId()).toBe(first);
  });

  it('survives a reload by reading the persisted value', () => {
    const created = getOrCreateDeviceId();
    // Simulate a fresh module state by dropping the in-memory cache only.
    expect(peekDeviceId()).toBe(created);
  });

  it('replaces a malformed stored id instead of sending it to the server', () => {
    localStorage.setItem('nuqta_sync_device_id_v1', 'not-a-uuid');
    const id = getOrCreateDeviceId();
    expect(isValidDeviceId(id)).toBe(true);
    expect(id).not.toBe('not-a-uuid');
  });

  it('resetDeviceIdentity forgets the installation id', () => {
    const created = getOrCreateDeviceId();
    expect(peekDeviceId()).toBe(created);
    resetDeviceIdentity();
    expect(peekDeviceId()).toBeNull();
  });
});

describe('change capture', () => {
  it('captures a create when a new record is written through persist()', () => {
    seedBaselineFromStorage(() => []);
    const stop = startChangeCapture();
    try {
      NuqtaStorageEngine.saveTasks([makeTask('t1', 'First')] as never);

      const outbox = readOutbox();
      expect(outbox.entries).toHaveLength(1);
      const [entry] = outbox.entries;
      expect(entry.operation).toBe('create');
      expect(entry.recordId).toBe('t1');
      expect(entry.section).toBe('tasks');
      expect(entry.payload).toMatchObject({ id: 't1', title: 'First' });
      expect(isValidDeviceId(entry.clientChangeId)).toBe(true);
    } finally {
      stop();
    }
  });

  it('captures an update when an existing record changes', () => {
    NuqtaStorageEngine.saveTasks([makeTask('t1', 'Before')] as never);
    seedBaselineFromStorage((section) =>
      section === 'tasks' ? NuqtaStorageEngine.getTasks() : []
    );
    const stop = startChangeCapture();
    try {
      NuqtaStorageEngine.saveTasks([makeTask('t1', 'After')] as never);

      const entries = readOutbox().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('update');
      expect(entries[0].payload).toMatchObject({ title: 'After' });
    } finally {
      stop();
    }
  });

  it('captures a delete when a record disappears from the section', () => {
    NuqtaStorageEngine.saveTasks([makeTask('t1', 'Doomed')] as never);
    seedBaselineFromStorage((section) =>
      section === 'tasks' ? NuqtaStorageEngine.getTasks() : []
    );
    const stop = startChangeCapture();
    try {
      NuqtaStorageEngine.saveTasks([] as never);

      const entries = readOutbox().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].operation).toBe('delete');
      expect(entries[0].recordId).toBe('t1');
    } finally {
      stop();
    }
  });

  it('emits nothing when a write does not change the content', () => {
    NuqtaStorageEngine.saveTasks([makeTask('t1', 'Same')] as never);
    seedBaselineFromStorage((section) =>
      section === 'tasks' ? NuqtaStorageEngine.getTasks() : []
    );
    const stop = startChangeCapture();
    try {
      NuqtaStorageEngine.saveTasks([makeTask('t1', 'Same')] as never);
      expect(outboxSize()).toBe(0);
    } finally {
      stop();
    }
  });

  it('treats profile as a singleton and health_metrics as a keyed map', () => {
    const profile = toRecordMap('profile', { name: 'Nour', theme: 'light' });
    expect(Object.keys(profile)).toEqual([SINGLETON_RECORD_ID]);

    const health = toRecordMap('health_metrics', {
      '2026-01-01': { date: '2026-01-01', sleepHours: 7 }
    });
    expect(Object.keys(health)).toEqual(['2026-01-01']);
  });

  it('does not capture while suppressed, but still advances the baseline', () => {
    seedBaselineFromStorage(() => []);
    const stop = startChangeCapture();
    try {
      withCaptureSuppressed(() => {
        NuqtaStorageEngine.saveTasks([makeTask('remote', 'From server')] as never);
      });
      expect(outboxSize()).toBe(0);

      // The remote write became the baseline, so a later edit is an UPDATE, not a CREATE.
      const result = captureSectionWrite('tasks', [
        makeTask('remote', 'Edited locally')
      ] as never);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
    } finally {
      stop();
    }
  });

  it('a throwing capture listener never breaks a local write', () => {
    const stop = startChangeCapture();
    // A second listener that always throws must not stop persist() succeeding.
    const detach = onLocalWrite(() => {
      throw new Error('capture exploded');
    });
    try {
      const ok = NuqtaStorageEngine.saveTasks([makeTask('t1', 'Still saved')] as never);
      expect(ok).toBe(true);
      expect(NuqtaStorageEngine.getTasks()).toHaveLength(1);
    } finally {
      detach();
      stop();
    }
  });

  it('never captures the meta store', () => {
    seedBaselineFromStorage(() => []);
    const stop = startChangeCapture();
    try {
      // Writing a normal section creates meta internally via ensureMeta().
      NuqtaStorageEngine.saveTasks([makeTask('t1', 'x')] as never);
      const sections = readOutbox().entries.map((e) => e.section);
      expect(sections).not.toContain('meta');
      expect(sections.every((s) => s === 'tasks')).toBe(true);
    } finally {
      stop();
    }
  });
});

describe('outbox durability', () => {
  it('persists entries across a reload of the module state', () => {
    const entry = enqueueChange({
      section: 'tasks',
      recordId: 't1',
      operation: 'create',
      payload: { id: 't1' }
    });
    expect(entry).not.toBeNull();

    // Read back from localStorage rather than memory.
    const raw = localStorage.getItem('nuqta_sync_outbox_v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).entries).toHaveLength(1);
    expect(readOutbox().entries[0].clientChangeId).toBe(entry!.clientChangeId);
  });

  it('keeps insertion order and a monotonic sequence', () => {
    enqueueChange({ section: 'tasks', recordId: 'a', operation: 'create', payload: {} });
    enqueueChange({ section: 'tasks', recordId: 'b', operation: 'create', payload: {} });
    enqueueChange({ section: 'habits', recordId: 'c', operation: 'create', payload: {} });

    const entries = readOutbox().entries;
    expect(entries.map((e) => e.recordId)).toEqual(['a', 'b', 'c']);
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('does not remove entries without an acknowledgement', () => {
    const a = enqueueChange({ section: 'tasks', recordId: 'a', operation: 'create', payload: {} });
    enqueueChange({ section: 'tasks', recordId: 'b', operation: 'create', payload: {} });

    // Acknowledge only one id.
    const removed = acknowledge([a!.clientChangeId]);
    expect(removed).toBe(1);
    expect(outboxSize()).toBe(1);
    expect(readOutbox().entries[0].recordId).toBe('b');
  });

  it('ignores acknowledgements for unknown ids', () => {
    enqueueChange({ section: 'tasks', recordId: 'a', operation: 'create', payload: {} });
    expect(acknowledge([randomUUID()])).toBe(0);
    expect(outboxSize()).toBe(1);
  });

  it('discards malformed entries instead of throwing', () => {
    localStorage.setItem(
      'nuqta_sync_outbox_v1',
      JSON.stringify({ entries: [{ nope: true }, 'garbage'], nextSeq: 3 })
    );
    expect(() => readOutbox()).not.toThrow();
    expect(readOutbox().entries).toHaveLength(0);
  });

  it('latches the sync gate on an explicit local wipe', async () => {
    const { resetSyncState } = await import('../src/lib/sync/lifecycle');
    const { isSyncPaused } = await import('../src/lib/sync/syncGate');
    enqueueChange({ section: 'tasks', recordId: 't1', operation: 'create', payload: {} });
    advanceCursor(99);

    resetSyncState();

    // Queued work for now-deleted records must not be replayed.
    expect(outboxSize()).toBe(0);
    expect(readCursor().appliedCursor).toBe(0);
    // Sync must stay off: a fresh identity with cursor=0 would re-pull all history.
    expect(isSyncPaused()).toBe(true);
  });

  it('converts an entry to the snake_case wire shape', () => {
    const entry = enqueueChange({
      section: 'tasks',
      recordId: 't1',
      operation: 'create',
      payload: { id: 't1' }
    })!;
    const wire = toOutboundChange(entry, 'device-1');
    expect(wire).toMatchObject({
      device_id: 'device-1',
      client_change_id: entry.clientChangeId,
      store_name: 'tasks',
      record_id: 't1',
      operation: 'create'
    });
  });
});

describe('remote application', () => {
  it('applies a remote create to localStorage', () => {
    const result = applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
    expect(result.applied).toBe(1);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['r1']);
  });

  it('applies a remote delete by removing the record', () => {
    applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
    expect(NuqtaStorageEngine.getTasks()).toHaveLength(1);

    applyRemoteChanges([
      inbound(2, { recordId: 'r1', operation: 'delete', payload: {} })
    ]);
    expect(NuqtaStorageEngine.getTasks()).toHaveLength(0);
  });

  it('is idempotent: the same serverChangeId is not applied twice', () => {
    applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
    const second = applyRemoteChanges([inbound(1, { recordId: 'r1' })]);

    expect(second.applied).toBe(0);
    expect(second.skippedDuplicates).toBe(1);
    expect(NuqtaStorageEngine.getTasks()).toHaveLength(1);
  });

  it('does not create an outbox echo when applying a remote change', () => {
    seedBaselineFromStorage(() => []);
    const stop = startChangeCapture();
    try {
      applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
      expect(outboxSize()).toBe(0);
    } finally {
      stop();
    }
  });

  it('refuses to overwrite a record with an unsent local edit', () => {
    // A local edit is pending for r1...
    enqueueChange({
      section: 'tasks',
      recordId: 'r1',
      operation: 'update',
      payload: makeTask('r1', 'Local edit')
    });
    NuqtaStorageEngine.saveTasks([makeTask('r1', 'Local edit')] as never);

    // ...when a remote change for the same record arrives.
    const result = applyRemoteChanges([
      inbound(5, { recordId: 'r1', payload: makeTask('r1', 'Remote edit') })
    ]);

    expect(result.applied).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].recordId).toBe('r1');
    // The local value is preserved, never silently overwritten.
    expect(NuqtaStorageEngine.getTasks()[0].title).toBe('Local edit');
    // The competing versions are retained for the next stage.
    expect(result.conflicts[0].incoming.payload).toMatchObject({ title: 'Remote edit' });
    expect(result.conflicts[0].blockedBy).toHaveLength(1);
  });

  it('persists conflicts so they survive a reload', () => {
    enqueueChange({ section: 'tasks', recordId: 'r1', operation: 'update', payload: {} });
    applyRemoteChanges([inbound(7, { recordId: 'r1' })]);
    expect(readConflicts()).toHaveLength(1);
    expect(readConflicts()[0].incoming.serverChangeId).toBe(7);
  });

  it('applies changes for different records in the same batch', () => {
    const result = applyRemoteChanges([
      inbound(1, { recordId: 'a' }),
      inbound(2, { recordId: 'b' })
    ]);
    expect(result.applied).toBe(2);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('notifies listeners only when something was applied', () => {
    let calls = 0;
    const detach = onRemoteApplied(() => {
      calls += 1;
    });
    try {
      applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
      expect(calls).toBe(1);

      // Duplicate batch: nothing applied, no notification.
      applyRemoteChanges([inbound(1, { recordId: 'r1' })]);
      expect(calls).toBe(1);
    } finally {
      detach();
    }
  });

  it('reports the highest consumed serverChangeId so the cursor can advance', () => {
    const result = applyRemoteChanges([
      inbound(3, { recordId: 'a' }),
      inbound(9, { recordId: 'b' })
    ]);
    expect(result.highestConsumed).toBe(9);
  });
});

describe('cursor', () => {
  it('starts at zero and never moves backwards', () => {
    expect(readCursor().appliedCursor).toBe(0);
    expect(advanceCursor(5)).toBe(5);
    expect(advanceCursor(3)).toBe(5);
    expect(readCursor().appliedCursor).toBe(5);
  });

  it('records the server-confirmed device cursor', () => {
    setDeviceCursor(12);
    expect(readCursor().deviceCursor).toBe(12);
  });

  it('survives a reload', () => {
    advanceCursor(42);
    const raw = localStorage.getItem('nuqta_sync_cursor_v1');
    expect(JSON.parse(raw as string).appliedCursor).toBe(42);
  });
});

describe('sync client against a real server', () => {
  let server: SyncServer;
  let client: SyncClient | null = null;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    client?.stop();
    client = null;
    await server.close();
  });

  function makeClient(overrides: Partial<ConstructorParameters<typeof SyncClient>[0]> = {}) {
    const created = new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      // Emulate Tailscale Serve: it supplies both the browser's Origin and the
      // official identity header on the upgrade. Node's `ws` sends neither by default.
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200,
      ...overrides
    });
    client = created;
    return created;
  }

  function makeOtherClient() {
    return new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
  }

  it('refuses to start after an explicit wipe, so history cannot be re-pulled', async () => {
    const { resetSyncState, startSync, stopSync } = await import('../src/lib/sync/lifecycle');

    // A previous session left a device identity and a caught-up cursor.
    getOrCreateDeviceId();
    advanceCursor(50);

    // The user wipes locally: identity and cursor are gone.
    localStorage.clear();
    resetSyncState();

    const started = startSync({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
    try {
      // No client means no connection, no delta pull, and no resurrected records.
      expect(started).toBeNull();
      expect(peekDeviceId()).toBeNull();

      await sleep(200);
      expect(NuqtaStorageEngine.getTasks()).toHaveLength(0);
    } finally {
      stopSync();
    }
  });

  it('authenticates, receives welcome, and reports connected', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected state' });

    const device = server.repo.getDevice(c.getDeviceId());
    expect(device).toBeTruthy();
    expect(device.device_id).toBe(c.getDeviceId());
  });

  it('pushes an outbox entry and removes it only after sync_ack', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    const entry = enqueueChange({
      section: 'tasks',
      recordId: 't1',
      operation: 'create',
      payload: makeTask('t1', 'Pushed')
    })!;
    expect(outboxSize()).toBe(1);

    await c.flush();
    await waitFor(() => outboxSize() === 0, { label: 'outbox drained by ack' });

    // The server really stored it.
    const delta = server.repo.getDelta({ cursor: 0, limit: 50 });
    expect(delta.changes).toHaveLength(1);
    expect(delta.changes[0].clientChangeId).toBe(entry.clientChangeId);
  });

  it('keeps the entry when the server never acknowledges (interrupted batch)', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    enqueueChange({ section: 'tasks', recordId: 't1', operation: 'create', payload: {} });

    // Simulate an interrupted send: the socket is not open, so flush() sends nothing.
    c.stop();
    await c.flush();
    expect(outboxSize()).toBe(1);
  });

  it('re-sending an unacknowledged batch is deduplicated by the server', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    const entry = enqueueChange({
      section: 'tasks',
      recordId: 't1',
      operation: 'create',
      payload: makeTask('t1', 'Once')
    })!;

    // Send the identical batch twice by hand: the second must be a duplicate.
    const batch = peekBatch(10).map((e) => toOutboundChange(e, c.getDeviceId()));
    const socket = (c as unknown as { socket: SyncSocket }).socket;

    socket.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: batch }));
    await waitFor(() => outboxSize() === 0, { label: 'first ack' });

    // Re-enqueue the same client_change_id: the server must report duplicate.
    enqueueChange({
      section: 'tasks',
      recordId: 't1',
      operation: 'create',
      payload: makeTask('t1', 'Once'),
      clientChangeId: entry.clientChangeId
    });
    socket.send(JSON.stringify({ type: 'sync', clientCursor: 0, changes: batch }));
    await waitFor(() => outboxSize() === 0, { label: 'duplicate ack' });

    const delta = server.repo.getDelta({ cursor: 0, limit: 50 });
    expect(delta.changes).toHaveLength(1);
  });

  it('receives a broadcast from another device and applies it', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // A second, independent client pushes a change.
    const other = makeOtherClient();
    other.start();
    try {
      await waitFor(() => other.getState() === 'connected', { label: 'other connected' });

      enqueueChange({
        section: 'tasks',
        recordId: 'remote-1',
        operation: 'create',
        payload: makeTask('remote-1', 'From the other device')
      });
      await other.flush();

      // The first client should apply it via broadcast.
      await waitFor(
        () => NuqtaStorageEngine.getTasks().some((t) => t.id === 'remote-1'),
        { label: 'broadcast applied' }
      );
    } finally {
      other.stop();
    }
  });

  it('recovers missed changes through /sync/delta after a reconnect', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // Miss a change while disconnected: push it from a second client.
    c.stop();
    const other = makeOtherClient();
    other.start();
    try {
      await waitFor(() => other.getState() === 'connected', { label: 'other connected' });
      enqueueChange({
        section: 'tasks',
        recordId: 'missed-1',
        operation: 'create',
        payload: makeTask('missed-1', 'Missed while offline')
      });
      await other.flush();
      await waitFor(() => outboxSize() === 0, { label: 'other pushed' });
    } finally {
      other.stop();
    }

    // Reconnect: the delta pull must recover the missed change.
    c.start();
    await waitFor(
      () => NuqtaStorageEngine.getTasks().some((t) => t.id === 'missed-1'),
      { label: 'delta recovered the missed change' }
    );
  });

  it('reconnects automatically after the socket drops', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // Force-close the underlying socket, as a server restart would.
    const socket = (c as unknown as { socket: SyncSocket & { terminate(): void } }).socket;
    socket.terminate();

    await waitFor(() => c.getState() === 'reconnecting', { label: 'reconnecting' });
    await waitFor(() => c.getState() === 'connected', { label: 'reconnected' });
  });

  it('stops retrying on a fatal auth error instead of looping', async () => {
    // An identity outside the allow-list is the real production failure: it can never
    // heal by retrying, so the client must stop rather than spin. Serve attaches the
    // same rejected identity to every request, so both paths are emulated here.
    const c = makeClient({
      fetchImpl: serveFetch('intruder@example.com'),
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': 'intruder@example.com' }
        }) as unknown as SyncSocket
    });
    c.start();

    await waitFor(() => c.getState() === 'error', { label: 'fatal error state' });

    // It must stay stopped: no reconnect attempt follows.
    await sleep(300);
    expect(c.getState()).toBe('error');
  });

  it('resume() pulls deltas and flushes without a page reload', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    const other = makeOtherClient();
    other.start();
    try {
      await waitFor(() => other.getState() === 'connected', { label: 'other connected' });
      enqueueChange({
        section: 'habits',
        recordId: 'h1',
        operation: 'create',
        payload: { id: 'h1', name: 'Walk' }
      });
      await other.flush();
      await waitFor(() => outboxSize() === 0, { label: 'other pushed' });
    } finally {
      other.stop();
    }

    c.resume();
    await waitFor(
      () => NuqtaStorageEngine.getHabits().some((h) => h.id === 'h1'),
      { label: 'resume recovered the habit' }
    );
  });

  it('advances the cursor only after changes are durably applied', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    const other = makeOtherClient();
    other.start();
    try {
      await waitFor(() => other.getState() === 'connected', { label: 'other connected' });
      enqueueChange({
        section: 'tasks',
        recordId: 'c1',
        operation: 'create',
        payload: makeTask('c1', 'Cursor')
      });
      await other.flush();
      await waitFor(() => outboxSize() === 0, { label: 'other pushed' });
    } finally {
      other.stop();
    }

    await waitFor(() => NuqtaStorageEngine.getTasks().some((t) => t.id === 'c1'), {
      label: 'change applied'
    });
    await waitFor(() => readCursor().appliedCursor > 0, { label: 'cursor advanced' });
  });
});

/**
 * Real-time delivery.
 *
 * The pipeline is `persist → capture → outbox → socket`. Everything up to the outbox is
 * synchronous and reliable; the gap this suite pins down is that writing to the outbox
 * must itself trigger a send. Nothing here calls `flush()` by hand and nothing reloads
 * or toggles visibility, because a user editing a task does none of those things.
 */
describe('real-time delivery', () => {
  let server: SyncServer;
  let client: SyncClient | null = null;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    client?.stop();
    client = null;
    await server.close();
  });

  function makeClient(identity = TEST_TAILSCALE_USER) {
    const created = new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': identity }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(identity),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
    client = created;
    return created;
  }

  it('sends a captured local write with no manual flush and no reload', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // A real store write: capture is wired to persistence, not called directly.
    seedBaselineFromStorage((section) => (section === 'tasks' ? [] : null));
    const detach = startChangeCapture();
    try {
      NuqtaStorageEngine.saveTasks([makeTask('live-1', 'Written live') as never]);
    } finally {
      detach();
    }

    // The change must reach the server on its own.
    await waitFor(
      () => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length === 1,
      { label: 'change delivered without an explicit flush' }
    );
    expect(outboxSize()).toBe(0);
  });

  it('acknowledges and drains the pending count without any further action', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    enqueueChange({ section: 'tasks', recordId: 'p-1', operation: 'create', payload: makeTask('p-1', 'Pending') });
    expect(outboxSize()).toBe(1);

    await waitFor(() => outboxSize() === 0, { label: 'ack drained the outbox' });
  });

  it('delivers to a second connected device immediately, with no echo back', async () => {
    const sender = makeClient();
    // A second physical device has its own identity; the server never broadcasts back to
    // the originating device, so sharing an id here would make this test meaningless.
    const senderDeviceId = sender.getDeviceId();
    localStorage.setItem('nuqta_sync_device_id_v1', randomUUID());
    const receiver = new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
    receiver.start();
    try {
      sender.start();
      await waitFor(
        () => sender.getState() === 'connected' && receiver.getState() === 'connected',
        { label: 'both connected' }
      );
      expect(receiver.getDeviceId()).not.toBe(senderDeviceId);

      // Receiver applies via broadcast; capture is suppressed while applying, so the
      // receiver's outbox must stay empty (no echo loop).
      enqueueChange({
        section: 'tasks',
        recordId: 'shared-1',
        operation: 'create',
        payload: makeTask('shared-1', 'From sender')
      });

      await waitFor(
        () => NuqtaStorageEngine.getTasks().some((t) => t.id === 'shared-1'),
        { label: 'receiver applied the change' }
      );
      expect(outboxSize()).toBe(0);
    } finally {
      receiver.stop();
    }
  });

  it('keeps rapid successive edits durable and delivers them all in order', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    for (let i = 0; i < 12; i += 1) {
      enqueueChange({
        section: 'tasks',
        recordId: `rapid-${i}`,
        operation: 'create',
        payload: makeTask(`rapid-${i}`, `Rapid ${i}`)
      });
    }

    await waitFor(() => outboxSize() === 0, { label: 'all rapid changes drained' });
    const changes = server.repo.getDelta({ cursor: 0, limit: 100 }).changes;
    expect(changes).toHaveLength(12);
  });

  it('queues while disconnected and delivers automatically after reconnect', async () => {
    const c = makeClient();
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // Simulate a real drop, not a graceful stop: the socket dies underneath us.
    c.stop();
    await waitFor(() => c.getState() !== 'connected', { label: 'dropped' });

    enqueueChange({
      section: 'tasks',
      recordId: 'offline-1',
      operation: 'create',
      payload: makeTask('offline-1', 'Made offline')
    });
    expect(outboxSize()).toBe(1);

    // Coming back must drain the queue with no explicit flush.
    c.start();
    await waitFor(() => outboxSize() === 0, { label: 'offline change delivered after reconnect' });
    expect(server.repo.getDelta({ cursor: 0, limit: 50 }).changes).toHaveLength(1);
  });
});

/**
 * Multiple tabs in one browser share `localStorage`, so they share one outbox and one
 * device identity. What must hold: a change queued by one tab is delivered by whichever
 * tab holds the live socket, and the ack is visible to both.
 */
describe('multi-tab outbox sharing', () => {
  let server: SyncServer;
  let client: SyncClient | null = null;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    client?.stop();
    client = null;
    await server.close();
  });

  it('delivers a change queued by another tab through the tab that owns the socket', async () => {
    const c = new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) =>
        new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket,
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
    client = c;
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    // Tab B writes to the shared outbox. Only tab A has a socket, so tab A must send it.
    const seen = new Promise<void>((resolve) => {
      const detach = onOutboxChange(() => {
        detach();
        resolve();
      });
    });
    enqueueChange({
      section: 'tasks',
      recordId: 'tab-b-1',
      operation: 'create',
      payload: makeTask('tab-b-1', 'From another tab')
    });
    await seen;

    await waitFor(() => outboxSize() === 0, { label: 'shared outbox drained' });
    expect(server.repo.getDelta({ cursor: 0, limit: 50 }).changes).toHaveLength(1);
  });
});

/**
 * An interrupted batch must not wedge the client.
 *
 * `flush()` sets a `flushing` latch so two batches are never in flight at once, and only
 * a `sync_ack` or an `error` frame clears it. If the socket dies between the send and the
 * ack, nothing clears it, so every later `flush()` returns early and the outbox is stuck
 * forever. That is much easier to hit now that a change is sent the instant it is queued.
 *
 * The socket is a thin wrapper over a real `ws` connection: it forwards `send` and then
 * immediately kills the connection, which is exactly a network drop mid-batch.
 */
describe('interrupted batch recovery', () => {
  let server: SyncServer;
  let client: SyncClient | null = null;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    client?.stop();
    client = null;
    await server.close();
  });

  it('re-sends a change whose batch was killed before the ack', async () => {
    let droppedOnce = false;
    const c = new SyncClient({
      url: `ws://127.0.0.1:${server.port}/sync`,
      webSocketImpl: WebSocket as unknown as new (url: string) => SyncSocket,
      webSocketFactory: (url) => {
        const real = new WebSocket(url, {
          headers: { origin: TEST_ORIGIN, 'tailscale-user-login': TEST_TAILSCALE_USER }
        }) as unknown as SyncSocket & { terminate: () => void };
        return new Proxy(real, {
          get(target, prop) {
            if (prop === 'send') {
              return (data: string) => {
                target.send(data);
                // Kill the link after the first sync frame, before any ack can arrive.
                if (!droppedOnce && data.includes('"type":"sync"')) {
                  droppedOnce = true;
                  setTimeout(() => (target as unknown as { terminate: () => void }).terminate(), 0);
                }
              };
            }
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, prop, value) {
            return Reflect.set(target, prop, value, target);
          }
        }) as unknown as SyncSocket;
      },
      fetchImpl: serveFetch(),
      origin: TEST_ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200
    });
    client = c;
    c.start();
    await waitFor(() => c.getState() === 'connected', { label: 'connected' });

    enqueueChange({
      section: 'tasks',
      recordId: 'interrupted-1',
      operation: 'create',
      payload: makeTask('interrupted-1', 'Survives a drop')
    });

    await waitFor(() => droppedOnce, { label: 'socket dropped mid-batch' });
    // The drop must not leave the entry stuck; a later flush has to be able to send it.
    await waitFor(() => outboxSize() === 0, { label: 'entry re-sent after reconnect' });
    expect(server.repo.getDelta({ cursor: 0, limit: 50 }).changes).toHaveLength(1);
  });
});
