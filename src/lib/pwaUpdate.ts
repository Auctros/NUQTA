/**
 * PWA update lifecycle.
 *
 * A deploy replaces `index.html` and the hashed bundle. Two caches can hide that from a
 * returning visitor: the HTTP cache (GitHub Pages serves `index.html` with
 * `max-age=600`) and the service worker's versioned shell. This module makes the new
 * build actually arrive, without ever yanking the page out from under the user.
 *
 * Multi-tab safety is the guiding constraint. `skipWaiting()` is a GLOBAL action: it
 * activates the new worker for every client of the origin, so `controllerchange` fires in
 * every open NUQTA tab. Two consequences shape this module:
 *
 *  - An update is applied ONLY on an explicit user action ("Apply update"). Hiding a tab
 *    never applies anything — it would otherwise reload the other, visible tabs.
 *  - When a controller change arrives, only the tab whose user asked reloads. Every other
 *    tab adopts the new controller silently and keeps its current page, so its in-memory
 *    work is never discarded. It picks up the new build on its next navigation.
 *
 * The rest:
 *  - the worker is registered with `updateViaCache: 'none'`, so `sw.js` itself is never
 *    served from the HTTP cache and a new deploy is always seen;
 *  - a periodic / on-focus / on-reconnect `registration.update()` check detects a deploy
 *    while the tab stays open (detection is harmless — it never reloads);
 *  - a freshly installed worker *waits* — it never calls `skipWaiting()` on its own;
 *  - the single `controllerchange` reload is guarded by a flag, so it can never loop;
 *  - the first-ever install never reloads (there is nothing newer to load).
 */

export type PwaUpdateStatus = 'idle' | 'checking' | 'available' | 'applying';

export interface PwaUpdateSnapshot {
  status: PwaUpdateStatus;
  /** True once the waiting worker has been asked to activate. */
  applying: boolean;
}

/** Minimal structural views so the manager can be driven by fakes in tests. */
export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: string, fn: () => void): void;
}

export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  active: WorkerLike | null;
  addEventListener(type: string, fn: () => void): void;
  update(): Promise<unknown>;
}

export interface UpdateEnvironment {
  getController: () => WorkerLike | null;
  addControllerChangeListener: (fn: () => void) => void;
  removeControllerChangeListener?: (fn: () => void) => void;
  reload: () => void;
  isHidden: () => boolean;
  addVisibilityListener: (fn: () => void) => void;
  removeVisibilityListener?: (fn: () => void) => void;
  addOnlineListener: (fn: () => void) => void;
  removeOnlineListener?: (fn: () => void) => void;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  /**
   * Elect at most one tab to apply an update across the whole origin. Resolves to a
   * release function when this tab won the election, or null when another tab holds it.
   * Absent in environments without the Web Locks API (falls back to single-tab behavior).
   */
  requestApplyLock?: (name: string) => Promise<(() => void) | null>;
  /** Warn before a reload discards in-memory work. See setHasUnsavedWork. */
  addBeforeUnloadGuard?: (fn: (event: BeforeUnloadEvent) => void) => void;
  removeBeforeUnloadGuard?: (fn: (event: BeforeUnloadEvent) => void) => void;
}

/** Tabs coordinate through this Web Locks name so only one applies a given update. */
export const APPLY_LOCK_NAME = 'nuqta-update-apply';

/** How often to ask the browser to check for a new `sw.js` while the tab is open. */
export const UPDATE_CHECK_INTERVAL_MS = 60_000;
/** If activation never produces a `controllerchange`, reload anyway so the user is unstuck. */
export const APPLY_FALLBACK_MS = 4_000;

const IDLE: PwaUpdateSnapshot = { status: 'idle', applying: false };

export class PwaUpdateManager {
  private snapshot: PwaUpdateSnapshot = IDLE;
  private readonly listeners = new Set<(s: PwaUpdateSnapshot) => void>();
  private registration: RegistrationLike | null = null;
  private hadController = false;
  private reloading = false;
  /** Set only by apply(): this tab's user asked to apply, so this tab may reload. */
  private expectsReload = false;
  private hasUnsavedWork = false;
  private started = false;
  private checkTimer: number | null = null;
  private fallbackTimer: number | null = null;
  private readonly onControllerChange = () => this.handleControllerChange();
  private readonly onVisibility = () => this.handleVisibility();
  private readonly onOnline = () => this.checkForUpdate();
  private readonly beforeUnloadGuard = (event: BeforeUnloadEvent) => {
    // Only warn while an update is actually pending and the app has work in memory: a
    // reload to apply the update is the one exit this lifecycle can cause on its own.
    if (this.snapshot.status === 'available' && this.hasUnsavedWork) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  constructor(
    private readonly env: UpdateEnvironment,
    private readonly intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
    private readonly fallbackMs: number = APPLY_FALLBACK_MS
  ) {}

  getSnapshot(): PwaUpdateSnapshot {
    return this.snapshot;
  }

  subscribe(fn: (s: PwaUpdateSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  start(registration: RegistrationLike): void {
    if (this.started) return;
    this.started = true;
    this.registration = registration;
    // Whether a worker already controls this page decides if a `controllerchange` means
    // "an update replaced the old worker" (reload) or "the very first install took
    // control" (do nothing — there is nothing newer to load).
    this.hadController = !!this.env.getController();

    registration.addEventListener('updatefound', () => this.watchInstalling());
    // A worker may already be waiting, e.g. it installed while this tab was open.
    if (registration.waiting) this.markAvailable();

    this.env.addControllerChangeListener(this.onControllerChange);
    this.env.addVisibilityListener(this.onVisibility);
    this.env.addOnlineListener(this.onOnline);
    this.env.addBeforeUnloadGuard?.(this.beforeUnloadGuard);
    this.checkTimer = this.env.setInterval(() => this.checkForUpdate(), this.intervalMs);
  }

  stop(): void {
    if (this.checkTimer !== null) this.env.clearInterval(this.checkTimer);
    if (this.fallbackTimer !== null) this.env.clearTimeout(this.fallbackTimer);
    this.checkTimer = null;
    this.fallbackTimer = null;
    this.env.removeControllerChangeListener?.(this.onControllerChange);
    this.env.removeVisibilityListener?.(this.onVisibility);
    this.env.removeOnlineListener?.(this.onOnline);
    this.env.removeBeforeUnloadGuard?.(this.beforeUnloadGuard);
    this.started = false;
  }

  /**
   * Report whether the app holds in-memory work that a reload would discard. While an
   * update is pending this arms a beforeunload warning; it is lifted the moment the user
   * chooses to apply (see apply()).
   */
  setHasUnsavedWork(value: boolean): void {
    this.hasUnsavedWork = value;
  }

  /** Ask the browser to look for a new `sw.js` now. Safe to call often. */
  checkForUpdate(): void {
    const registration = this.registration;
    if (!registration || this.snapshot.status === 'applying') return;
    if (this.snapshot.status === 'idle') this.setSnapshot({ status: 'checking', applying: false });
    Promise.resolve(registration.update())
      .catch(() => {
        /* offline, or the check raced an unregister: not fatal, try again later */
      })
      .then(() => {
        if (this.snapshot.status === 'checking') this.setSnapshot(IDLE);
      });
  }

  /**
   * Apply a pending update. Because `skipWaiting()` activates the new worker for EVERY tab,
   * this is the one place that can cause a reload — and only the tab that asked for it
   * reloads. The `skipWaiting` post is serialized through a cross-tab lock so exactly one
   * tab drives activation; every other tab observes the resulting `controllerchange` and
   * adopts the new controller without reloading.
   *
   * If activation never reports back, the fallback reloads this tab so its user is not
   * stuck on the stale page.
   */
  apply(): void {
    if (!this.registration) return;
    this.expectsReload = true; // this tab's user chose to apply, so this tab may reload
    this.setSnapshot({ status: 'applying', applying: true });

    const run = async () => {
      const release = await this.acquireApplyLock();
      if (!this.registration) return;
      // Only the tab that won the election posts skipWaiting; a tab that lost it lets the
      // winner drive activation and simply reloads when the controllerchange arrives.
      if (release) {
        const target = this.registration.waiting ?? this.registration.active;
        try {
          target?.postMessage({ type: 'nuqta-skip-waiting' });
        } catch {
          /* posting can fail if the worker is already gone; the fallback reload covers it */
        }
        // Hold the lock briefly so a concurrent apply cannot post a redundant skipWaiting
        // for the same update; release either way so a future update can be applied.
        this.env.setTimeout(() => release(), this.fallbackMs);
      }
      // Whoever asked to apply reloads if activation does not report back in time.
      if (this.fallbackTimer === null) {
        this.fallbackTimer = this.env.setTimeout(() => this.reloadOnce(), this.fallbackMs);
      }
    };
    void run();
  }

  /**
   * Elect a single tab to drive activation. Returns a release function when this tab may
   * post skipWaiting (including the no-Web-Locks single-tab fallback), or null when another
   * tab holds the lock and is already applying this update.
   */
  private async acquireApplyLock(): Promise<(() => void) | null> {
    const request = this.env.requestApplyLock;
    if (!request) return () => {};
    try {
      return await request(APPLY_LOCK_NAME);
    } catch {
      // A lock error must never block the update; fall back to posting it ourselves.
      return () => {};
    }
  }

  private watchInstalling(): void {
    const worker = this.registration?.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // `installed` + an existing controller means this is an UPDATE, not a first install.
      if (worker.state === 'installed' && this.env.getController()) this.markAvailable();
    });
  }

  private markAvailable(): void {
    if (this.snapshot.status === 'available' || this.snapshot.status === 'applying') return;
    this.setSnapshot({ status: 'available', applying: false });
  }

  /**
   * A new controller took over. The first-ever install (no prior controller) has nothing
   * newer to load, so it never reloads — that is what keeps the first visit from bouncing.
   *
   * With a prior controller, a controller change can be caused by ANOTHER tab's apply():
   * skipWaiting() activates the new worker for the whole origin, so this tab sees it too.
   * The deciding factor is therefore not "did a controller change happen" but "did THIS
   * tab's user ask to apply". Only then do we reload — every other tab adopts the new
   * controller silently and keeps its page and its in-memory work, picking up the new build
   * on its next navigation. This is the multi-tab safety guarantee.
   */
  private handleControllerChange(): void {
    if (!this.hadController) return;
    if (!this.expectsReload) return;
    this.reloadOnce();
  }

  private handleVisibility(): void {
    // Detection only. Hiding a tab must never apply an update: skipWaiting() is global, so
    // it would activate the new worker for every other tab and could reload a visible tab
    // the user is actively working in. Applying is always an explicit user action.
    if (this.env.isHidden()) return;
    // Back in the foreground: look for a newer deploy.
    this.checkForUpdate();
  }

  private reloadOnce(): void {
    if (this.reloading) return;
    this.reloading = true;
    if (this.fallbackTimer !== null) this.env.clearTimeout(this.fallbackTimer);
    this.env.removeBeforeUnloadGuard?.(this.beforeUnloadGuard);
    this.env.reload();
  }

  private setSnapshot(next: PwaUpdateSnapshot): void {
    this.snapshot = next;
    for (const fn of this.listeners) fn(next);
  }
}

/** Wire the manager to the real browser (production only). */
export function startPwaUpdates(): PwaUpdateManager | null {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!import.meta.env.PROD) return null;

  const env: UpdateEnvironment = {
    getController: () => navigator.serviceWorker.controller,
    addControllerChangeListener: (fn) => navigator.serviceWorker.addEventListener('controllerchange', fn),
    removeControllerChangeListener: (fn) => navigator.serviceWorker.removeEventListener('controllerchange', fn),
    reload: () => window.location.reload(),
    isHidden: () => document.visibilityState === 'hidden',
    addVisibilityListener: (fn) => document.addEventListener('visibilitychange', fn),
    removeVisibilityListener: (fn) => document.removeEventListener('visibilitychange', fn),
    addOnlineListener: (fn) => window.addEventListener('online', fn),
    removeOnlineListener: (fn) => window.removeEventListener('online', fn),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    requestApplyLock: (name) =>
      // Web Locks is widely available; guard anyway so an old browser degrades to
      // single-tab behavior instead of throwing.
      typeof navigator.locks?.request === 'function'
        ? new Promise<(() => void) | null>((resolve) => {
            navigator.locks.request(name, { ifAvailable: true }, (lock) => {
              if (!lock) {
                resolve(null); // another tab holds the lock and is applying this update
                return;
              }
              // Hold the lock until the caller releases; the returned promise keeps it.
              return new Promise<void>((releaseLock) => resolve(() => releaseLock()));
            });
          })
        : Promise.resolve(null),
    addBeforeUnloadGuard: (fn) => window.addEventListener('beforeunload', fn),
    removeBeforeUnloadGuard: (fn) => window.removeEventListener('beforeunload', fn)
  };

  const manager = new PwaUpdateManager(env);
  managerInstance = manager;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((registration) => {
        manager.start(registration);
        // If a controller already exists at boot, this page load follows an update (or a
        // plain revisit). Ask the worker to reclaim any obsolete cache now that we are
        // running the current build — the safe moment for old-cache deletion.
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'nuqta-claim-cleanup' });
        }
      })
      .catch(() => {
        /* offline caching is an enhancement; the app works without it */
      });
  });
  return manager;
}

/** The live manager, if updates were started (production). Lets the UI subscribe to it. */
export function getPwaUpdateManager(): PwaUpdateManager | null {
  return managerInstance;
}

let managerInstance: PwaUpdateManager | null = null;
