/**
 * UI-only preferences (sidebar state). Deliberately kept OUTSIDE the `nuqta_`
 * dataset namespace: NuqtaStorageEngine.hasAnyNuqtaData() treats any `nuqta_` key
 * as live user data, so a stray preference there would block mirror recovery, and
 * wipeAll() would have to treat it as a record.
 */
const SIDEBAR_COLLAPSED_KEY = 'nuqta.ui.sidebarCollapsed';

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* storage unavailable: the rail simply falls back to its default each load */
  }
}

/**
 * The in-progress walk timer. Kept out of the `nuqta_` dataset for the same reason as
 * the sidebar flag: it is transient UI state, not a record. Losing it costs an
 * unfinished timer, never a logged walk.
 */
const ACTIVE_WALK_KEY = 'nuqta.ui.activeWalk';

export function readActiveWalk<T>(): T | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WALK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.startedAt !== 'number') return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeActiveWalk(walk: unknown | null): void {
  try {
    if (walk === null) localStorage.removeItem(ACTIVE_WALK_KEY);
    else localStorage.setItem(ACTIVE_WALK_KEY, JSON.stringify(walk));
  } catch {
    /* storage unavailable: the timer still runs for this page session */
  }
}
