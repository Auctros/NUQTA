/**
 * Two-device sync integration tests.
 *
 * Each simulated device gets its OWN localStorage database (a separate key→value map),
 * while sharing one real sync server, real WebSocket transport, real outbox, real
 * cursor and real applyRemote. Nothing about the protocol is stubbed.
 *
 * The isolation mechanism: `globalThis.localStorage` is replaced by a shim that routes
 * to whichever device is "active". Every place the sync code can touch storage —
 * constructor, socket callbacks, fetch callbacks, and explicit test actions — runs with
 * the owning device selected, so a read or write can never leak between devices.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AsyncLocalStorage } from 'node:async_hooks';
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { createSyncServer } from '../scripts/sync-server.mjs';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { seedBaselineFromStorage, startChangeCapture } from '../src/lib/sync/changeCapture';
import { SyncClient, type SyncSocket } from '../src/lib/sync/client';
import { readWorkspaceGeneration } from '../src/lib/sync/workspaceGeneration';

const ORIGIN = 'http://localhost:3000';
const USER = 'alice@example.com';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(
  fn: () => T | Promise<T>,
  label = 'condition',
  timeout = 6000
): Promise<T> {
  const end = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
      last = v;
    } catch (e) {
      last = e;
    }
    await sleep(20);
  }
  throw new Error(`Timed out waiting for ${label} (last: ${String(last)})`);
}

// ---------------------------------------------------------------- device storage

type Dict = Map<string, string>;
const devices = new Map<string, Dict>();

/**
 * AsyncLocalStorage, not a module-level "current device" variable.
 *
 * Socket callbacks and fetch handlers resume on later macrotasks, so a shared mutable
 * cursor would let two devices interleave and read each other's database. ALS carries
 * the owning device across those awaits, which is the only way this harness can model
 * two genuinely independent clients.
 */
const deviceContext = new AsyncLocalStorage<string>();

function dbFor(device: string | undefined): Dict {
  const name = device ?? '__unbound__';
  let db = devices.get(name);
  if (!db) {
    db = new Map();
    devices.set(name, db);
  }
  return db;
}

const storageShim = {
  getItem(key: string): string | null {
    const v = dbFor(deviceContext.getStore()).get(key);
    return v === undefined ? null : v;
  },
  setItem(key: string, value: string): void {
    dbFor(deviceContext.getStore()).set(key, String(value));
  },
  removeItem(key: string): void {
    dbFor(deviceContext.getStore()).delete(key);
  },
  clear(): void {
    dbFor(deviceContext.getStore()).clear();
  },
  key(index: number): string | null {
    return [...dbFor(deviceContext.getStore()).keys()][index] ?? null;
  },
  get length(): number {
    return dbFor(deviceContext.getStore()).size;
  }
};

/** Run `fn` inside `device`'s database context. */
function as<T>(device: string, fn: () => T): T {
  return deviceContext.run(device, fn);
}

const serveFetch = (identity: string = USER) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        'tailscale-user-login': identity
      }
    })) as typeof fetch;

const makeTask = (id: string, title: string) => ({
  id,
  title,
  priority: 'medium',
  isTopThree: false,
  status: 'pending',
  tags: [],
  subtasks: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

interface Device {
  id: string;
  client: SyncClient;
  tasks(): ReturnType<typeof makeTask>[];
  save(tasks: unknown[]): void;
}

function makeDevice(port: number, name: string): Device {
  const id = randomUUID();
  devices.set(name, new Map());
  as(name, () => localStorage.setItem('nuqta_sync_device_id_v1', id));

  const client = as(name, () => {
    const created = new SyncClient({
      url: `ws://127.0.0.1:${port}/sync`,
      webSocketImpl: WebSocket as unknown as new (u: string) => SyncSocket,
      // A thin facade over `ws` rather than the `ws` object itself: SyncClient assigns
      // `onopen`/`onmessage`/etc. as plain properties, and `ws` defines some of those as
      // accessors, so the assignment would silently not take effect. The facade also
      // runs every callback inside this device's storage context.
      webSocketFactory: (url) => {
        const inner = new WebSocket(url, {
          headers: { origin: ORIGIN, 'tailscale-user-login': USER }
        });
        const facade: SyncSocket = {
          readyState: inner.readyState,
          send: (data: string) => inner.send(data),
          close: (code?: number, reason?: string) => inner.close(code, reason),
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null
        };
        Object.defineProperty(facade, 'readyState', { get: () => inner.readyState });
        inner.on('open', () => as(name, () => facade.onopen?.({})));
        inner.on('message', (data: unknown) =>
          as(name, () => facade.onmessage?.({ data: String(data) }))
        );
        inner.on('error', (e: unknown) => as(name, () => facade.onerror?.(e)));
        inner.on('close', () => as(name, () => facade.onclose?.({})));
        return facade;
      },
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        as(name, () => serveFetch()(input, init))) as typeof fetch,
      origin: ORIGIN,
      baseDelayMs: 50,
      maxDelayMs: 200,
      onStateChange: (st) => console.log(`[${name}] state=${st}`)
    });

    /*
     * The outbox listener set is module-global, and in a real browser every tab shares
     * one localStorage — so a flush triggered by another tab's write is correct there.
     * Here each device has its own database, so a client must only flush while its own
     * context is active; otherwise device B would send device A's queue under B's
     * identity, which the server would accept as a genuine second create.
     */
    const originalFlush = created.flush.bind(created);
    created.flush = async () => {
      if (deviceContext.getStore() !== name) return;
      return originalFlush();
    };
    return created;
  });

  return {
    id,
    client,
    tasks: () => as(name, () => NuqtaStorageEngine.getTasks() as never) as never,
    save: (tasks) => as(name, () => void NuqtaStorageEngine.saveTasks(tasks as never))
  };
}

// ------------------------------------------------------------------------- tests

describe('two-device deletion propagation', () => {
  let server: any;
  let devices_: Device[] = [];
  let detachCapture: (() => void) | null = null;

  beforeEach(async () => {
    devices.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storageShim
    });
    server = await createSyncServer({
      port: 0,
      dbPath: ':memory:',
      allowedOrigins: [ORIGIN],
      allowedTailscaleUsers: [USER]
    });
  });

  afterEach(async () => {
    detachCapture?.();
    detachCapture = null;
    for (const d of devices_) d.client.stop();
    devices_ = [];
    await server.close();
  });

  async function connect(name: string): Promise<Device> {
    const device = makeDevice(server.port, name);
    devices_.push(device);
    as(name, () => device.client.start());
    await waitFor(() => device.client.getState() === 'connected', `${name} connected`);
    return device;
  }

  async function primeAndCapture(a: Device, b: Device | null) {
    for (const [name, d] of [['A', a], ['B', b]] as const) {
      if (!d) continue;
      as(name, () =>
        seedBaselineFromStorage((section) =>
          section === 'tasks' ? NuqtaStorageEngine.getTasks() : null
        )
      );
    }
    detachCapture = startChangeCapture();
  }

  it('R1: A deletes while B is online', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    A.save([]);
    await waitFor(() => B.tasks().length === 0, 'B applied the delete');
    expect(B.tasks()).toEqual([]);
  });

  it('R2: A deletes while B is OFFLINE, B reconnects', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    B.client.stop();
    A.save([]);
    await waitFor(
      () => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length === 2,
      'delete reached the server'
    );

    B.client.start();
    await waitFor(() => B.client.getState() === 'connected', 'B reconnected');
    await waitFor(() => B.tasks().length === 0, 'B dropped the record after reconnect');
    expect(B.tasks()).toEqual([]);
  });

  it('R3: A deletes while B has an unsent edit for the same task', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    B.client.stop();
    B.save([{ ...makeTask('t1', 'Shared task'), title: 'Edited offline by B' }]);

    A.save([]);
    await waitFor(
      () => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length === 2,
      'delete reached the server'
    );

    B.client.start();
    await waitFor(() => B.client.getState() === 'connected', 'B reconnected');
    await waitFor(() => B.tasks().length === 0, 'stale edit did not resurrect the record');

    // The change log must never contain a write after the delete for this record.
    const ops = server.repo
      .getDelta({ cursor: 0, limit: 50 })
      .changes.map((c: any) => c.operation);
    expect(ops).toEqual(['create', 'delete']);
    expect(B.tasks()).toEqual([]);
  });

  it('R4: B keeps working offline for a while, then reconnects after the delete', { timeout: 20000 }, async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared'), makeTask('t2', 'Untouched')]);
    await waitFor(() => B.tasks().length === 2, 'B pulled both tasks');

    B.client.stop();
    // B edits t1, deletes nothing, and creates a brand-new record of its own.
    B.save([{ ...makeTask('t1', 'Shared'), title: 'B edited t1' }, makeTask('t2', 'Untouched'), makeTask('t3', 'B new')]);

    A.save([makeTask('t2', 'Untouched')]);
    await waitFor(
      () => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length >= 3,
      'delete of t1 reached the server'
    );

    B.client.start();
    await waitFor(() => B.client.getState() === 'connected', 'B reconnected');

    // t3 is genuinely new and must survive; t1 is deleted and must not come back.
    await waitFor(
      () => B.tasks().some((t) => t.id === 't3') && !B.tasks().some((t) => t.id === 't1'),
      'B converged: new record kept, deleted record gone'
    );
    expect(B.tasks().map((t) => t.id).sort()).toEqual(['t2', 't3']);
  });

  it('R5: repeated delete is idempotent and never resurrects', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    A.save([]);
    await waitFor(() => B.tasks().length === 0, 'B applied the delete');

    // B now deletes the same record it already lost: no new change, no resurrection.
    B.save([]);
    await sleep(300);
    expect(B.tasks()).toEqual([]);
    expect(
      server.repo.getDelta({ cursor: 0, limit: 50 }).changes.filter((c: any) => c.operation === 'delete')
    ).toHaveLength(1);
  });

  it('R6: a tombstoned id is never silently reused', async () => {
    // There is no "undelete" in the protocol: a re-created record is a new record with a
    // new id. This test pins that decision, because allowing a tombstoned id to be
    // reused would make every past delete ambiguous.
    const A = await connect('A');
    await primeAndCapture(A, null);

    A.save([makeTask('t1', 'First')]);
    await waitFor(() => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length === 1, 'create');
    A.save([]);
    await waitFor(() => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length === 2, 'delete');

    // Re-adding the same id must not reach the server, and must not linger locally.
    A.save([makeTask('t1', 'Re-created with same id')]);
    await sleep(400);

    const ops = server.repo.getDelta({ cursor: 0, limit: 50 }).changes.map((c: any) => c.operation);
    expect(ops).toEqual(['create', 'delete']);
    expect(A.tasks()).toEqual([]);
  });

  it('R9: an interrupted sync resumes without resurrecting or losing the delete', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared'), makeTask('t2', 'Other')]);
    await waitFor(() => B.tasks().length === 2, 'B pulled both');

    // B is cut off mid-session, exactly like a tab being suspended.
    B.client.stop();
    A.save([makeTask('t2', 'Other')]);
    await waitFor(
      () => server.repo.getDelta({ cursor: 0, limit: 50 }).changes.length >= 3,
      'delete of t1 committed'
    );

    B.client.start();
    await waitFor(() => B.client.getState() === 'connected', 'B resumed');
    await waitFor(() => B.tasks().length === 1, 'B converged after resume');

    expect(B.tasks().map((t) => t.id)).toEqual(['t2']);
  });

  it('R7: a global reset does not let an offline device refill the workspace', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    // B goes offline holding a full local copy.
    B.client.stop();

    // A performs a GLOBAL reset through the real endpoint.
    const res = await as('A', () =>
      fetch(`http://127.0.0.1:${server.port}/sync/reset`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'tailscale-user-login': USER }
      })
    );
    expect(res.ok).toBe(true);
    expect(server.repo.getWorkspaceGeneration()).toBe(2);

    // B comes back with pre-reset data and tries to upload it.
    B.client.start();
    await waitFor(() => B.client.getState() === 'connected', 'B reconnected');
    await sleep(600);

    // Nothing B held may re-enter the new generation.
    expect(server.repo.getDelta({ cursor: 0, limit: 50 }).changes).toEqual([]);
    expect(server.repo.getWorkspaceGeneration()).toBe(2);
  });

  it('R8: an online device adopts the new generation immediately after a reset', async () => {
    const A = await connect('A');
    const B = await connect('B');
    await primeAndCapture(A, B);

    A.save([makeTask('t1', 'Shared task')]);
    await waitFor(() => B.tasks().length === 1, 'B pulled the task');

    const res = await as('A', () =>
      fetch(`http://127.0.0.1:${server.port}/sync/reset`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'tailscale-user-login': USER }
      })
    );
    expect(res.ok).toBe(true);

    // The server pushes workspace_reset; both clients must adopt generation 2.
    await waitFor(
      () => as('A', () => readWorkspaceGeneration()) === 2 && as('B', () => readWorkspaceGeneration()) === 2,
      'both devices adopted the new generation'
    );
    expect(server.repo.getDelta({ cursor: 0, limit: 50 }).changes).toEqual([]);
  });
});
