/**
 * Navigation state that survives a reload.
 *
 * NUQTA has no router: every screen is a branch of `activeNavTab` in the zustand
 * store, which starts at `'today'`. That is why a refresh felt like a restart —
 * nothing outside React's memory remembered where the person was.
 *
 * The fix is a small, deliberate route model:
 *
 *   #/<section>          e.g. #/tasks
 *   #/<section>/<view>   e.g. #/workout/programs
 *
 * The section lives in the URL because it IS a destination: it is linkable, it
 * participates in browser history, and back/forward behave the way people expect.
 * A view-level tab rides along as the second segment for the same reason — it is a
 * place inside a section, not a preference.
 *
 * What does NOT go in the URL: search queries, filters and other in-progress
 * workflow state. They are not destinations and would make every keystroke a
 * history entry. They are persisted separately, per section, in `nuqta.ui.*`.
 *
 * Nothing transient is restored. Dialogs, open confirmations, in-flight forms and
 * destructive operations are never written here, so a reload can never resume a
 * half-finished delete.
 */

export type NavTab =
  | 'today'
  | 'tasks'
  | 'habits'
  | 'goals'
  | 'focus'
  | 'calendar'
  | 'health'
  | 'finance'
  | 'journal'
  | 'insights'
  | 'simulator'
  | 'profile'
  | 'quran'
  | 'reading'
  | 'workout'
  | 'drawing'
  | 'walking'
  | 'archive';

export const NAV_TABS: readonly NavTab[] = [
  'today',
  'tasks',
  'habits',
  'goals',
  'focus',
  'calendar',
  'health',
  'finance',
  'journal',
  'insights',
  'simulator',
  'profile',
  'quran',
  'reading',
  'workout',
  'drawing',
  'walking',
  'archive'
];

const NAV_TAB_SET = new Set<string>(NAV_TABS);

export function isNavTab(value: unknown): value is NavTab {
  return typeof value === 'string' && NAV_TAB_SET.has(value);
}

export interface NavRoute {
  tab: NavTab;
  /** A view-level tab inside the section, when the section has one. */
  view: string | null;
}

export const HOME_TAB: NavTab = 'today';

/** Sections whose top-level view is not a linkable destination. */
const NO_VIEW_TABS = new Set<NavTab>(['today']);

// UI preferences live outside the `nuqta_` dataset: NuqtaStorageEngine treats any
// `nuqta_` key as user data, and a navigation preference is not a record.
const LAST_ROUTE_KEY = 'nuqta.ui.lastRoute';
const VIEW_TABS_KEY = 'nuqta.ui.viewTabs';

/** `#/workout/programs` → { tab: 'workout', view: 'programs' }. */
export function parseNavHash(hash: string): NavRoute | null {
  const cleaned = hash.replace(/^#/, '').replace(/^\/+/, '');
  if (!cleaned) return null;
  const [rawTab, rawView] = cleaned.split('/');
  const tab = decodeURIComponent(rawTab ?? '');
  if (!isNavTab(tab)) return null;
  const view = rawView ? decodeURIComponent(rawView) : '';
  return { tab, view: view && !NO_VIEW_TABS.has(tab) ? view : null };
}

export function formatNavHash(route: NavRoute): string {
  if (NO_VIEW_TABS.has(route.tab) || !route.view) return `#/${route.tab}`;
  return `#/${route.tab}/${encodeURIComponent(route.view)}`;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: navigation still works for this page session */
  }
}

function readViewTabs(): Record<string, string> {
  const raw = safeGet(VIEW_TABS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isNavTab(key) && typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** The view-level tab last used in a section, if any. */
export function readViewTab(section: NavTab): string | null {
  return readViewTabs()[section] ?? null;
}

export function writeViewTab(section: NavTab, view: string | null): void {
  const all = readViewTabs();
  if (view === null) {
    if (!(section in all)) return;
    delete all[section];
  } else {
    if (all[section] === view) return;
    all[section] = view;
  }
  safeSet(VIEW_TABS_KEY, Object.keys(all).length ? JSON.stringify(all) : null);
}

export function readPersistedRoute(): NavRoute | null {
  const raw = safeGet(LAST_ROUTE_KEY);
  if (!raw) return null;
  return parseNavHash(raw);
}

function writePersistedRoute(route: NavRoute): void {
  safeSet(LAST_ROUTE_KEY, formatNavHash(route));
}

/* ---------- the live route ---------- */

let route: NavRoute | null = null;
const listeners = new Set<() => void>();

/**
 * Startup policy, in order of precedence:
 *   1. a valid hash — a deep link always wins,
 *   2. the last section visited, so launching the installed app resumes,
 *   3. the dashboard, so a first run is predictable.
 */
function resolveInitialRoute(): NavRoute {
  if (typeof window === 'undefined') return { tab: HOME_TAB, view: null };
  const fromHash = parseNavHash(window.location.hash);
  if (fromHash) {
    const persistedView = fromHash.view ?? readViewTab(fromHash.tab);
    return { tab: fromHash.tab, view: persistedView };
  }
  const persisted = readPersistedRoute();
  if (persisted) {
    const view = persisted.view ?? readViewTab(persisted.tab);
    return { tab: persisted.tab, view };
  }
  return { tab: HOME_TAB, view: null };
}

function ensureRoute(): NavRoute {
  if (route === null) route = resolveInitialRoute();
  return route;
}

export function getRoute(): NavRoute {
  return ensureRoute();
}

/** The section a first render should show, resolved before paint. */
export function initialNavTab(): NavTab {
  return ensureRoute().tab;
}

export function subscribeRoute(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function sameRoute(a: NavRoute, b: NavRoute): boolean {
  return a.tab === b.tab && a.view === b.view;
}

/**
 * Move to a route.
 *
 * `replace` is for corrections the person did not ask for (normalising an invalid
 * hash, filling in a remembered view tab) — those must not create a history entry,
 * or Back would walk through states the user never chose.
 */
export function applyRoute(
  next: NavRoute,
  { replace = false, updateHistory = true }: { replace?: boolean; updateHistory?: boolean } = {}
): void {
  const normalized: NavRoute = {
    tab: next.tab,
    view: NO_VIEW_TABS.has(next.tab) ? null : next.view
  };
  const changed = route === null || !sameRoute(route, normalized);
  route = normalized;

  writePersistedRoute(normalized);
  if (normalized.view) writeViewTab(normalized.tab, normalized.view);

  if (updateHistory && typeof window !== 'undefined') {
    const hash = formatNavHash(normalized);
    if (window.location.hash !== hash) {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      try {
        if (replace) window.history.replaceState(null, '', url);
        else window.history.pushState(null, '', url);
      } catch {
        window.location.hash = hash;
      }
    }
  }

  if (changed) emit();
}

/**
 * Keep the URL and the store in step. Returns a teardown function.
 *
 * Both `popstate` and `hashchange` are observed: pushState fires neither, while a
 * hand-edited or externally-set hash fires both. Re-applying an identical route is
 * a no-op, so the duplicate cannot loop.
 */
export function initNavigationSync(
  onRoute: (route: NavRoute) => void,
  /**
   * The section the app is already showing. The store resolves this at import time
   * from the same rules, so the two normally agree. When they do not, the running
   * app wins: something (a notification, a test, a restore) deliberately changed the
   * screen before mount, and the URL should follow it rather than undo it.
   */
  currentTab?: NavTab
): () => void {
  if (typeof window === 'undefined') return () => {};

  const initial =
    currentTab && currentTab !== getRoute().tab
      ? { tab: currentTab, view: readViewTab(currentTab) }
      : ensureRoute();
  // Normalise the address bar on startup: an invalid or view-less hash is corrected
  // in place, never pushed, so the very first Back press leaves NUQTA as expected.
  applyRoute(initial, { replace: true });
  onRoute(initial);

  const fromLocation = () => {
    const parsed = parseNavHash(window.location.hash);
    // An unrecognised destination falls back to the section we are already on
    // rather than throwing the person out to the dashboard.
    const next: NavRoute = parsed ?? { tab: getRoute().tab, view: null };
    applyRoute(next, { updateHistory: false });
    onRoute(getRoute());
  };

  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  return () => {
    window.removeEventListener('popstate', fromLocation);
    window.removeEventListener('hashchange', fromLocation);
  };
}

/** Test seam: forget the memoised route so the next read re-resolves it. */
export function resetNavigationForTests(): void {
  route = null;
  listeners.clear();
}
