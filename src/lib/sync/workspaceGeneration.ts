/**
 * The workspace generation this device believes it belongs to.
 *
 * A global reset does not just delete rows — it starts a new generation of the
 * workspace. Every write carries the generation the client thinks it is in, and the
 * server refuses anything from an older one. That is what stops a device that was
 * offline during the reset from refilling the cleared workspace the moment it
 * reconnects: its data is not "stale but valid", it belongs to a workspace that no
 * longer exists.
 *
 * Stored per installation, beside the device identity, and never synchronized.
 */

const GENERATION_KEY = 'nuqta_sync_generation_v1';

export function readWorkspaceGeneration(): number {
  try {
    const raw = localStorage.getItem(GENERATION_KEY);
    if (raw === null) return 1;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
  } catch {
    return 1;
  }
}

export function setWorkspaceGeneration(generation: number): void {
  if (!Number.isSafeInteger(generation) || generation < 1) return;
  try {
    localStorage.setItem(GENERATION_KEY, String(generation));
  } catch {
    /* a lost generation only costs a re-pull */
  }
}

export function clearWorkspaceGeneration(): void {
  try {
    localStorage.removeItem(GENERATION_KEY);
  } catch {
    /* nothing else we can do */
  }
}
