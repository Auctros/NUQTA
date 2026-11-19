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
