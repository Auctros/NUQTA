/**
 * Sync gate: remembers that synchronization must stay off for this installation.
 *
 * Why this exists. `wipeAll()` deletes every `nuqta_` key, which includes the device
 * identity and the client cursor. On the next load the client would therefore start with
 * a fresh identity and `cursor = 0`, pull the entire server history, and silently
 * resurrect the data the user just asked to delete. Stage 2 has no deletion propagation
 * and no settings UI, so the only honest options are "do not sync" or "quietly refill".
 *
 * This gate picks "do not sync": an explicit local wipe latches it, `startSync` refuses
 * to run while it is set, and nothing is pulled or pushed until it is cleared
 * deliberately. It is a local flag, never a synchronized record.
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

/** Clear the latch so synchronization may start again (future settings UI). */
export function resumeSyncAfterWipe(): void {
  try {
    localStorage.removeItem(PAUSED_KEY);
  } catch {
    /* nothing else we can do */
  }
}
