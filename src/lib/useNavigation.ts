import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import {
  applyRoute,
  getRoute,
  readViewTab,
  subscribeRoute,
  writeViewTab,
  type NavRoute,
  type NavTab
} from './navigation';

/**
 * The single way a screen changes destination.
 *
 * `navigate` writes the URL and the store together, so a section reached from the
 * sidebar, the command palette, a notification or a deep link all produce the same
 * history entry. Views must use this rather than calling `setActiveNavTab`
 * directly, or the address bar would drift from the screen.
 */
export function useNavigation() {
  const setActiveNavTab = useNuqtaStore((state) => state.setActiveNavTab);
  const route = useSyncExternalStore(subscribeRoute, getRoute, getRoute);

  const navigate = useCallback(
    (tab: NavTab, view: string | null = null, options: { replace?: boolean } = {}) => {
      setActiveNavTab(tab);
      applyRoute({ tab, view }, { replace: options.replace });
    },
    [setActiveNavTab]
  );

  return { route, navigate };
}

/**
 * A view-level tab that survives a reload and mirrors the URL's second segment.
 *
 * Usage inside a section:
 *   const [tab, setTab] = usePersistedViewTab<MyTab>('workout', ['today', ...], 'today');
 *
 * The value is validated on read: a stale or hand-edited segment that no longer
 * names a real tab falls back to `fallback` instead of rendering nothing.
 */
export function usePersistedViewTab<T extends string>(
  section: NavTab,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const { route, navigate } = useNavigation();

  const resolved = (() => {
    // The URL wins while this section is on screen: it is what a deep link said.
    if (route.tab === section && route.view && (allowed as readonly string[]).includes(route.view)) {
      return route.view as T;
    }
    const remembered = readViewTab(section);
    if (remembered && (allowed as readonly string[]).includes(remembered)) return remembered as T;
    return fallback;
  })();

  const setTab = useCallback(
    (next: T) => {
      if (!(allowed as readonly string[]).includes(next)) return;
      // The fallback is what a bare section hash already resolves to, so storing it
      // would only produce redundant URLs like `#/workout/today`.
      writeViewTab(section, next === fallback ? null : next);
      // Only rewrite the URL when this section is the one on screen; otherwise the
      // stored preference is enough and we must not hijack another section's route.
      if (getRoute().tab === section) navigate(section, next === fallback ? null : next, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, navigate, fallback, allowed.join('|')]
  );

  // A section reached by its bare hash still shows the tab the person last used, so
  // the address bar has to say so too — otherwise copying the URL would lose it.
  // `replace` keeps this correction out of history: the user never asked for it.
  useEffect(() => {
    const current = getRoute();
    if (current.tab !== section || current.view) return;
    if (resolved === fallback) return;
    applyRoute({ tab: section, view: resolved }, { replace: true });
  }, [section, resolved, fallback]);

  return [resolved, setTab];
}

export type { NavRoute, NavTab };
