import { describe, it, expect, vi } from 'vitest';
import {
  PwaUpdateManager,
  UpdateEnvironment,
  WorkerLike,
  RegistrationLike
} from '../src/lib/pwaUpdate';

/**
 * Drives the REAL update manager through a fake browser so the safety rules are enforced
 * by the code that ships, not by a re-implementation:
 *   - the first-ever install never reloads the page,
 *   - hiding a tab never applies an update (skipWaiting is global),
 *   - only the tab whose user pressed "Apply update" reloads; other tabs keep their work,
 *   - an update reloads exactly once, never in a loop,
 *   - in-memory work arms a beforeunload warning while an update is pending.
 */

class FakeWorker implements WorkerLike {
  state = 'installing';
  messages: unknown[] = [];
  private listeners: Record<string, (() => void)[]> = {};
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ||= []).push(fn);
  }
  setState(state: string): void {
    this.state = state;
    for (const fn of this.listeners['statechange'] || []) fn();
  }
}

class FakeRegistration implements RegistrationLike {
  waiting: WorkerLike | null = null;
  installing: WorkerLike | null = null;
  active: WorkerLike | null = null;
  updateCalls = 0;
  updateImpl: () => Promise<unknown> = () => Promise.resolve();
  private listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ||= []).push(fn);
  }
  update(): Promise<unknown> {
    this.updateCalls += 1;
    return this.updateImpl();
  }
  fire(type: string): void {
    for (const fn of this.listeners[type] || []) fn();
  }
}

/** A shared, cross-tab Web Locks stand-in with ifAvailable semantics. */
class FakeLockManager {
  private held = new Set<string>();
  async request(name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<unknown>) {
    if (opts?.ifAvailable && this.held.has(name)) return null;
    this.held.add(name);
    return cb({ name });
  }
}

function makeEnv(lockManager?: FakeLockManager) {
  let controller: WorkerLike | null = null;
  let hidden = false;
  const controllerListeners: (() => void)[] = [];
  const visibilityListeners: (() => void)[] = [];
  const onlineListeners: (() => void)[] = [];
  const beforeUnloadListeners: ((e: BeforeUnloadEvent) => void)[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  const timeouts: { fn: () => void; ms: number }[] = [];
  const reload = vi.fn();

  const env: UpdateEnvironment = {
    getController: () => controller,
    addControllerChangeListener: (fn) => controllerListeners.push(fn),
    removeControllerChangeListener: (fn) => {
      const i = controllerListeners.indexOf(fn);
      if (i >= 0) controllerListeners.splice(i, 1);
    },
    reload,
    isHidden: () => hidden,
    addVisibilityListener: (fn) => visibilityListeners.push(fn),
    removeVisibilityListener: (fn) => {
      const i = visibilityListeners.indexOf(fn);
      if (i >= 0) visibilityListeners.splice(i, 1);
    },
    addOnlineListener: (fn) => onlineListeners.push(fn),
    removeOnlineListener: (fn) => {
      const i = onlineListeners.indexOf(fn);
      if (i >= 0) onlineListeners.splice(i, 1);
    },
    setInterval: (fn, ms) => {
      intervals.push({ fn, ms });
      return intervals.length;
    },
    clearInterval: (id) => {
      intervals.splice(id - 1, 1);
    },
    setTimeout: (fn, ms) => {
      timeouts.push({ fn, ms });
      return timeouts.length;
    },
    clearTimeout: (id) => {
      timeouts.splice(id - 1, 1);
    },
    addBeforeUnloadGuard: (fn) => beforeUnloadListeners.push(fn),
    removeBeforeUnloadGuard: (fn) => {
      const i = beforeUnloadListeners.indexOf(fn);
      if (i >= 0) beforeUnloadListeners.splice(i, 1);
    },
    requestApplyLock: lockManager
      ? (name) =>
          new Promise<(() => void) | null>((resolve) => {
            void lockManager.request(name, { ifAvailable: true }, (lock) => {
              if (!lock) {
                resolve(null);
                return Promise.resolve();
              }
              return new Promise<void>((release) => resolve(() => release()));
            });
          })
      : undefined
  };

  return {
    env,
    reload,
    intervals,
    timeouts,
    setController: (w: WorkerLike | null) => (controller = w),
    fireControllerChange: () => controllerListeners.forEach((fn) => fn()),
    setHidden: (v: boolean) => (hidden = v),
    fireVisibility: () => visibilityListeners.forEach((fn) => fn()),
    fireOnline: () => onlineListeners.forEach((fn) => fn()),
    runIntervals: () => intervals.forEach((i) => i.fn()),
    runTimeouts: () => timeouts.forEach((t) => t.fn()),
    /** Simulate the browser firing beforeunload; returns true if the page would warn. */
    fireBeforeUnload: () => {
      let prevented = false;
      const event = {
        preventDefault: () => (prevented = true),
        returnValue: undefined
      } as unknown as BeforeUnloadEvent;
      beforeUnloadListeners.forEach((fn) => fn(event));
      return prevented;
    }
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A tab already controlled by a worker, with a newer worker waiting to take over. */
function controlledTabWithUpdate(lockManager?: FakeLockManager) {
  const harness = makeEnv(lockManager);
  const manager = new PwaUpdateManager(harness.env);
  const registration = new FakeRegistration();
  registration.active = new FakeWorker();
  harness.setController(registration.active);
  manager.start(registration);

  // Drive the real detection path so the snapshot reaches 'available'.
  const incoming = new FakeWorker();
  registration.installing = incoming;
  registration.fire('updatefound');
  incoming.setState('installed');
  const waiting = new FakeWorker();
  registration.waiting = waiting;
  return { harness, manager, registration, waiting };
}

describe('PwaUpdateManager', () => {
  it('never reloads on the first install (no prior controller)', () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    manager.start(registration);

    // First install: the new worker activates and claims the page.
    registration.active = new FakeWorker();
    harness.fireControllerChange();

    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('reports an available update when a new worker finishes installing over a controller', () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    registration.active = new FakeWorker();
    harness.setController(registration.active);
    manager.start(registration);

    const incoming = new FakeWorker();
    registration.installing = incoming;
    registration.fire('updatefound');
    incoming.setState('installed');

    expect(manager.getSnapshot().status).toBe('available');
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('does not treat a first install as an available update', () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    manager.start(registration); // no controller yet

    const first = new FakeWorker();
    registration.installing = first;
    registration.fire('updatefound');
    first.setState('installed');

    expect(manager.getSnapshot().status).toBe('idle');
  });

  it('applies an available update on demand and reloads exactly once', async () => {
    const { harness, manager, waiting } = controlledTabWithUpdate();
    manager.apply();
    await flush();

    // The page asked the waiting worker to activate...
    expect(waiting.messages).toEqual([{ type: 'nuqta-skip-waiting' }]);
    expect(manager.getSnapshot().status).toBe('applying');

    // ...and when activation reports back, the page reloads once even if it fires again.
    harness.fireControllerChange();
    harness.fireControllerChange();
    harness.runTimeouts();

    expect(harness.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads from the fallback when activation never reports back', async () => {
    const { harness, manager } = controlledTabWithUpdate();
    manager.apply();
    await flush();
    expect(harness.reload).not.toHaveBeenCalled();

    harness.runTimeouts(); // the safety net fires
    expect(harness.reload).toHaveBeenCalledTimes(1);
  });

  it('never applies or reloads when a tab is hidden', async () => {
    const { harness, waiting } = controlledTabWithUpdate();
    harness.setHidden(true);
    harness.fireVisibility();
    await flush();

    // Hiding a tab must not post skipWaiting (which would reload other tabs) or reload.
    expect(waiting.messages).toHaveLength(0);
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('does not apply while the user is looking at the page', async () => {
    const { harness, waiting } = controlledTabWithUpdate();
    harness.fireVisibility(); // visible
    await flush();
    expect(waiting.messages).toHaveLength(0);
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('does not reload a tab when ANOTHER tab applied the update', () => {
    // This tab never called apply(); the controller change is caused by a sibling tab.
    const { harness } = controlledTabWithUpdate();
    harness.fireControllerChange();
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('elects a single tab to post skipWaiting when two tabs apply at once', async () => {
    const locks = new FakeLockManager();
    const a = controlledTabWithUpdate(locks);
    const b = controlledTabWithUpdate(locks);

    // Both users press "Apply update" at nearly the same time.
    a.manager.apply();
    b.manager.apply();
    await flush();

    const postsA = a.waiting.messages.length;
    const postsB = b.waiting.messages.length;
    expect(postsA + postsB).toBe(1); // exactly one tab drove activation
  });

  it('arms a beforeunload warning for in-memory work only while an update is pending', () => {
    // No update pending: ordinary reloads must not be nagged.
    const idle = makeEnv();
    const idleManager = new PwaUpdateManager(idle.env);
    const idleRegistration = new FakeRegistration();
    idleRegistration.active = new FakeWorker();
    idle.setController(idleRegistration.active);
    idleManager.start(idleRegistration);
    idleManager.setHasUnsavedWork(true);
    expect(idle.fireBeforeUnload()).toBe(false);

    // Update pending, no in-memory work: nothing to protect.
    const clean = controlledTabWithUpdate();
    expect(clean.harness.fireBeforeUnload()).toBe(false);

    // Update pending AND in-memory work: warn, because a reload would discard it.
    clean.manager.setHasUnsavedWork(true);
    expect(clean.harness.fireBeforeUnload()).toBe(true);
  });

  it('lifts the beforeunload warning once the user applies the update', async () => {
    const { harness, manager } = controlledTabWithUpdate();
    manager.setHasUnsavedWork(true);
    expect(harness.fireBeforeUnload()).toBe(true);

    manager.apply();
    await flush();

    // The user consented to the reload, so it must not be blocked by the guard.
    expect(harness.fireBeforeUnload()).toBe(false);
  });

  it('checks for an update on an interval, on reconnect, and on returning to the tab', async () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    manager.start(registration);
    expect(registration.updateCalls).toBe(0);

    harness.runIntervals();
    harness.fireOnline();
    harness.setHidden(false);
    harness.fireVisibility();
    await flush();

    expect(registration.updateCalls).toBe(3);
  });

  it('survives a failed update check without throwing', async () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    registration.updateImpl = () => Promise.reject(new Error('offline'));
    manager.start(registration);

    manager.checkForUpdate();
    await flush();
    expect(manager.getSnapshot().status).toBe('idle');
  });

  it('stops checking and stops listening once stopped', () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const registration = new FakeRegistration();
    registration.active = new FakeWorker();
    harness.setController(registration.active);
    manager.start(registration);
    manager.stop();

    harness.runIntervals();
    expect(registration.updateCalls).toBe(0);

    harness.fireControllerChange();
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it('notifies subscribers of lifecycle changes', () => {
    const harness = makeEnv();
    const manager = new PwaUpdateManager(harness.env);
    const seen: string[] = [];
    manager.subscribe((s) => seen.push(s.status));
    const registration = new FakeRegistration();
    registration.active = new FakeWorker();
    harness.setController(registration.active);
    manager.start(registration);

    const incoming = new FakeWorker();
    registration.installing = incoming;
    registration.fire('updatefound');
    incoming.setState('installed');
    manager.apply();

    expect(seen).toContain('available');
    expect(seen).toContain('applying');
  });
});
