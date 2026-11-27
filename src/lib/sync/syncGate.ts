/**
 * Sync gate: remembers that synchronization must stay off for this installation.
 *
 * Why this exists. "Clear this device" is deliberately a local-only action: it removes
 * the user's data from this browser and leaves every other device untouched. But
 * `wipeAll()` also deletes the device identity and the client cursor, so without a gate
 * the next load would start with a fresh identity at `cursor = 0`, pull the entire
 * server history, and quietly refill the device the user just cleared.
 *
 * The gate keeps that promise: a local clear latches it, `startSync` refuses to run
 * while it is set, and nothing is pulled or pushed until it is cleared deliberately.
 *
 * A *global* delete is the opposite action and does not use this gate — it bumps the
 * workspace generation so no device can refill the workspace at all. See
 * `deleteEverywhere` in lifecycle.ts. This flag is local, never synchronized.
 */

const PAUSED_KEY = 'nuqta_sync_paused_v1';

/** Latch the gate. Called after an explicit, successful local wipe. */
export function pauseSync(): void {
  try {
    localStorage.setItem(PAUSED_KEY, '1');
  } catch {
    /* if this write fails, sync will start again; the wipe itself already succeeded */
  }
}

/** True when an explicit wipe asked sync to stay off. */
export function isSyncPaused(): boolean {
  try {
    return localStorage.getItem(PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Clear the latch so synchronization may start again. */
export function resumeSyncAfterWipe(): void {
  try {
    localStorage.removeItem(PAUSED_KEY);
  } catch {
    /* nothing else we can do */
  }
}
