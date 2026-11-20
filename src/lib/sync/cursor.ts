/**
 * Persistent client cursor.
 *
 * The cursor is the highest `serverChangeId` this device has durably applied. It is
 * written only AFTER changes are in localStorage, which is what makes crash recovery
 * correct: on restart the client re-pulls from the last durable point and re-applying
 * is harmless because `applyRemote` dedupes on serverChangeId.
 *
 * It is deliberately stored apart from the outbox: the outbox tracks work we owe the
 * server, the cursor tracks work the server owes us.
 */

const CURSOR_KEY = 'nuqta_sync_cursor_v1';

interface CursorState {
  /** Highest serverChangeId durably applied locally. */
  appliedCursor: number;
  /** Highest deviceCursor the server has confirmed for this device. */
  deviceCursor: number;
  updatedAt: string;
}

function empty(): CursorState {
  return { appliedCursor: 0, deviceCursor: 0, updatedAt: new Date().toISOString() };
}

export function readCursor(): CursorState {
  try {
    const raw = localStorage.getItem(CURSOR_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<CursorState>;
    return {
      appliedCursor:
        typeof parsed.appliedCursor === 'number' && parsed.appliedCursor >= 0
          ? parsed.appliedCursor
          : 0,
      deviceCursor:
        typeof parsed.deviceCursor === 'number' && parsed.deviceCursor >= 0
          ? parsed.deviceCursor
          : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return empty();
  }
}

function writeCursor(state: CursorState): void {
  try {
    localStorage.setItem(CURSOR_KEY, JSON.stringify(state));
  } catch {
    /* a lost cursor only costs a re-pull, which is idempotent */
  }
}

/**
 * Advance the applied cursor. Monotonic: a stale value never moves it backwards, so an
 * out-of-order delta page cannot cause changes to be skipped.
 */
export function advanceCursor(nextAppliedCursor: number): number {
  const state = readCursor();
  if (nextAppliedCursor <= state.appliedCursor) return state.appliedCursor;
  writeCursor({ ...state, appliedCursor: nextAppliedCursor, updatedAt: new Date().toISOString() });
  return nextAppliedCursor;
}

/** Record the server-confirmed device cursor (from welcome / sync_ack / ack_ok). */
export function setDeviceCursor(deviceCursor: number): void {
  const state = readCursor();
  if (!Number.isFinite(deviceCursor) || deviceCursor < 0) return;
  if (deviceCursor === state.deviceCursor) return;
  writeCursor({ ...state, deviceCursor, updatedAt: new Date().toISOString() });
}

export function clearCursor(): void {
  try {
    localStorage.removeItem(CURSOR_KEY);
  } catch {
    /* nothing else we can do */
  }
}
