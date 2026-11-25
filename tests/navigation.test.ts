import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyRoute,
  formatNavHash,
  getRoute,
  initNavigationSync,
  initialNavTab,
  isNavTab,
  parseNavHash,
  readPersistedRoute,
  readViewTab,
  resetNavigationForTests,
  writeViewTab
} from '../src/lib/navigation';

/**
 * Navigation is the difference between "the app remembered me" and "the app
 * restarted". These tests pin the contract: a section survives a reload, a deep
 * link wins over memory, and Back/Forward move through real destinations.
 */

const goto = (hash: string) => {
  window.history.replaceState(null, '', hash);
};

beforeEach(() => {
  resetNavigationForTests();
  window.history.replaceState(null, '', '/');
});

describe('parseNavHash', () => {
  it('reads a section', () => {
    expect(parseNavHash('#/tasks')).toEqual({ tab: 'tasks', view: null });
  });

  it('reads a section and a view', () => {
    expect(parseNavHash('#/workout/programs')).toEqual({ tab: 'workout', view: 'programs' });
  });

  it('rejects unknown sections', () => {
    expect(parseNavHash('#/nope')).toBeNull();
    expect(parseNavHash('#/')).toBeNull();
    expect(parseNavHash('')).toBeNull();
  });

  it('ignores a view on a section that has none', () => {
    expect(parseNavHash('#/today/tasks')).toEqual({ tab: 'today', view: null });
  });

  it('decodes an escaped view segment', () => {
    expect(parseNavHash('#/archive/studios%5Flogs')?.view).toBe('studios_logs');
  });
});

describe('formatNavHash', () => {
  it('round-trips through parseNavHash', () => {
    const routes = [
      { tab: 'today' as const, view: null },
      { tab: 'quran' as const, view: 'murajaah' },
      { tab: 'archive' as const, view: 'studios_logs' }
    ];
    for (const route of routes) {
      expect(parseNavHash(formatNavHash(route))).toEqual(route);
    }
  });

  it('omits a view for sections without one', () => {
    expect(formatNavHash({ tab: 'today', view: 'anything' })).toBe('#/today');
  });
});

describe('startup resolution', () => {
  it('falls back to the dashboard on a first run', () => {
    expect(initialNavTab()).toBe('today');
  });

  it('resumes the last section after a reload', () => {
    applyRoute({ tab: 'finance', view: null });
    resetNavigationForTests(); // simulate a fresh page load
    expect(initialNavTab()).toBe('finance');
  });

  it('lets a deep link win over the remembered section', () => {
    applyRoute({ tab: 'finance', view: null });
    resetNavigationForTests();
    goto('#/journal');
    expect(initialNavTab()).toBe('journal');
  });

  it('resumes a section with the view tab the person last used', () => {
    writeViewTab('workout', 'progress');
    applyRoute({ tab: 'workout', view: 'progress' });
    resetNavigationForTests();
    goto('#/workout');
    expect(getRoute()).toEqual({ tab: 'workout', view: 'progress' });
  });

  it('ignores an invalid hash and keeps the remembered section', () => {
    applyRoute({ tab: 'goals', view: null });
    resetNavigationForTests();
    goto('#/not-a-section');
    expect(initialNavTab()).toBe('goals');
  });

  it('never resumes a section that is not a real destination', () => {
    localStorage.setItem('nuqta.ui.lastRoute', '#/definitely-not-real');
    resetNavigationForTests();
    expect(initialNavTab()).toBe('today');
  });
});

describe('applyRoute', () => {
  it('writes the hash so the section is linkable', () => {
    applyRoute({ tab: 'reading', view: null });
    expect(window.location.hash).toBe('#/reading');
  });

  it('pushes a history entry for a real navigation', () => {
    const before = window.history.length;
    applyRoute({ tab: 'tasks', view: null });
    expect(window.history.length).toBe(before + 1);
  });

  it('does not grow history when correcting in place', () => {
    applyRoute({ tab: 'tasks', view: null });
    const before = window.history.length;
    applyRoute({ tab: 'tasks', view: 'list' }, { replace: true });
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#/tasks/list');
  });

  it('persists the destination for the next launch', () => {
    applyRoute({ tab: 'health', view: null });
    expect(readPersistedRoute()).toEqual({ tab: 'health', view: null });
  });

  it('does not touch history when replaying an external change', () => {
    const before = window.history.length;
    applyRoute({ tab: 'insights', view: null }, { updateHistory: false });
    expect(window.history.length).toBe(before);
  });

  it('strips a view from a section that has none', () => {
    applyRoute({ tab: 'today', view: 'whatever' });
    expect(window.location.hash).toBe('#/today');
    expect(getRoute().view).toBeNull();
  });
});

describe('initNavigationSync', () => {
  it('reports the initial route and normalises the address bar', () => {
    goto('#/tasks');
    const seen: string[] = [];
    const teardown = initNavigationSync((route) => seen.push(route.tab));
    expect(seen).toEqual(['tasks']);
    expect(window.location.hash).toBe('#/tasks');
    teardown();
  });

  it('repairs an invalid hash in place instead of pushing a history entry', () => {
    goto('#/garbage');
    const before = window.history.length;
    const teardown = initNavigationSync(() => {});
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#/today');
    teardown();
  });

  it('follows a Back/Forward change to the hash', () => {
    const seen: string[] = [];
    const teardown = initNavigationSync((route) => seen.push(route.tab));
    seen.length = 0;

    window.history.pushState(null, '', '#/calendar');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(seen).toEqual(['calendar']);
    expect(getRoute().tab).toBe('calendar');
    teardown();
  });

  it('survives a hand-edited hash pointing at nothing', () => {
    const teardown = initNavigationSync(() => {});
    applyRoute({ tab: 'journal', view: null });

    window.history.replaceState(null, '', '#/bogus');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Stay where the person was rather than ejecting them to the dashboard.
    expect(getRoute().tab).toBe('journal');
    teardown();
  });

  it('keeps the section the running app already shows', () => {
    // A notification (or a test) may have navigated before mount; the URL follows.
    applyRoute({ tab: 'today', view: null });
    const seen: string[] = [];
    const teardown = initNavigationSync((route) => seen.push(route.tab), 'finance');
    expect(seen).toEqual(['finance']);
    expect(window.location.hash).toBe('#/finance');
    teardown();
  });

  it('stops listening after teardown', () => {
    const seen: string[] = [];
    const teardown = initNavigationSync((route) => seen.push(route.tab));
    teardown();
    seen.length = 0;
    window.history.pushState(null, '', '#/archive');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen).toEqual([]);
  });
});

describe('isNavTab', () => {
  it('accepts every real destination and nothing else', () => {
    expect(isNavTab('today')).toBe(true);
    expect(isNavTab('archive')).toBe(true);
    expect(isNavTab('Today')).toBe(false);
    expect(isNavTab(null)).toBe(false);
    expect(isNavTab(42)).toBe(false);
  });
});

describe('view tab memory', () => {
  it('remembers and forgets a view tab per section', () => {
    writeViewTab('quran', 'map');
    expect(readViewTab('quran')).toBe('map');
    writeViewTab('quran', null);
    expect(readViewTab('quran')).toBeNull();
  });

  it('ignores a corrupt store instead of throwing', () => {
    localStorage.setItem('nuqta.ui.viewTabs', '{not json');
    expect(readViewTab('workout')).toBeNull();
  });

  it('drops keys that are not real sections', () => {
    localStorage.setItem('nuqta.ui.viewTabs', JSON.stringify({ workout: 'progress', bogus: 'x' }));
    expect(readViewTab('workout')).toBe('progress');
    expect(readViewTab('bogus' as never)).toBeNull();
  });
});
