/**
 * Life Timeline engine.
 *
 * The engine owns no data: every assertion below feeds it `UniversalHistoryItem`s of
 * the same shape `generateUniversalHistory` produces, so what is tested is the reading
 * layer (importance, day-faithful grouping, filtering, paging) and not a mock.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTimeline,
  buildTimelineView,
  classifyImportance,
  filterTimeline,
  groupTimeline,
  isDefaultVisible,
  paginateTimeline,
  sourceTabFor
} from '../src/lib/lifeTimeline';
import type { UniversalHistoryDomain, UniversalHistoryEventType, UniversalHistoryItem } from '../src/types';

let seq = 0;

function item(overrides: Partial<UniversalHistoryItem> = {}): UniversalHistoryItem {
  seq += 1;
  const date = overrides.date ?? '2026-11-10';
  return {
    id: `h${seq}`,
    domain: 'tasks',
    eventType: 'completed',
    entityId: `e${seq}`,
    entityType: 'task',
    title: `Event ${seq}`,
    date,
    timestamp: `${date}T09:00:00.000Z`,
    ...overrides
  } as UniversalHistoryItem;
}

describe('classifyImportance', () => {
  it('treats a finished task as notable but a finished book as a milestone', () => {
    expect(classifyImportance(item({ domain: 'tasks', eventType: 'completed' }))).toBe('notable');
    expect(classifyImportance(item({ domain: 'reading', eventType: 'completed' }))).toBe('milestone');
  });

  it('treats creation, archival and restore as administrative', () => {
    for (const eventType of ['created', 'archived', 'restored'] as UniversalHistoryEventType[]) {
      expect(classifyImportance(item({ eventType }))).toBe('administrative');
    }
  });

  it('marks a recorded session as notable and a journal note as routine', () => {
    expect(classifyImportance(item({ domain: 'focus', eventType: 'session' }))).toBe('notable');
    expect(classifyImportance(item({ domain: 'journal', eventType: 'note' }))).toBe('routine');
  });

  it('keeps finance and health quiet unless something was completed', () => {
    expect(classifyImportance(item({ domain: 'finance', eventType: 'note' }))).toBe('routine');
    expect(classifyImportance(item({ domain: 'health', eventType: 'completed' }))).toBe('milestone');
  });
});

describe('isDefaultVisible', () => {
  it('hides administrative events from the quiet feed', () => {
    expect(isDefaultVisible(item({ eventType: 'created' }))).toBe(false);
    expect(isDefaultVisible(item({ eventType: 'completed' }))).toBe(true);
  });

  it('hides routine finance and health noise but keeps their completions', () => {
    expect(isDefaultVisible(item({ domain: 'finance', eventType: 'note' }))).toBe(false);
    expect(isDefaultVisible(item({ domain: 'finance', eventType: 'completed' }))).toBe(true);
  });
});

describe('sourceTabFor', () => {
  it('points each domain at the screen that owns it', () => {
    expect(sourceTabFor('tasks')).toBe('tasks');
    expect(sourceTabFor('walking')).toBe('walking');
  });

  it('returns null for domains with no screen instead of a dead link', () => {
    expect(sourceTabFor('review')).toBeNull();
  });
});

describe('filterTimeline', () => {
  const items = [
    item({ domain: 'tasks', eventType: 'completed', date: '2026-11-10', title: 'Write report' }),
    item({ domain: 'habits', eventType: 'completed', date: '2026-11-10', title: 'Morning walk habit' }),
    item({ domain: 'quran', eventType: 'session', date: '2026-11-11', title: 'Memorised Al-Mulk' }),
    item({ domain: 'tasks', eventType: 'created', date: '2026-11-11', title: 'Plan the week' })
  ];

  it('filters by domain', () => {
    const out = filterTimeline(items, { domain: 'tasks' });
    // "Plan the week" is a `created` record, so the quiet feed omits it.
    expect(out.map((i) => i.title)).toEqual(['Write report']);
    expect(
      filterTimeline(items, { domain: 'tasks', includeAdministrative: true }).map((i) => i.title)
    ).toEqual(['Write report', 'Plan the week']);
  });

  it('filters by event type', () => {
    const out = filterTimeline(items, { eventType: 'session' });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Memorised Al-Mulk');
  });

  it('excludes administrative events unless asked for', () => {
    expect(filterTimeline(items).map((i) => i.title)).not.toContain('Plan the week');
    expect(
      filterTimeline(items, { includeAdministrative: true }).map((i) => i.title)
    ).toContain('Plan the week');
  });

  it('matches the search against title and domain, case-insensitively', () => {
    expect(filterTimeline(items, { search: 'REPORT' })).toHaveLength(1);
    expect(filterTimeline(items, { search: 'quran' })).toHaveLength(1);
    expect(filterTimeline(items, { search: 'nothing here' })).toHaveLength(0);
  });

  it('honours an inclusive day window', () => {
    const out = filterTimeline(items, {
      fromDate: '2026-11-11',
      untilDate: '2026-11-11',
      includeAdministrative: true
    });
    expect(out.map((i) => i.title)).toEqual(['Memorised Al-Mulk', 'Plan the week']);
  });

  it('never fabricates a day from a malformed date key', () => {
    const broken = item({ date: 'not-a-date', timestamp: '2026-11-10T09:00:00.000Z' });
    const out = filterTimeline([broken], { fromDate: '2026-11-10', untilDate: '2026-11-10' });
    expect(out).toHaveLength(1);
  });
});

describe('buildTimeline', () => {
  it('sorts newest first', () => {
    const events = buildTimeline([
      item({ date: '2026-11-01', timestamp: '2026-11-01T09:00:00.000Z' }),
      item({ date: '2026-11-05', timestamp: '2026-11-05T09:00:00.000Z' })
    ]);
    expect(events.map((e) => e.date)).toEqual(['2026-11-05', '2026-11-01']);
  });

  it('collapses same-kind events on one day and keeps every member', () => {
    const events = buildTimeline([
      item({ domain: 'quran', eventType: 'session', title: 'Juz 1', date: '2026-11-10', timestamp: '2026-11-10T08:00:00.000Z' }),
      item({ domain: 'quran', eventType: 'session', title: 'Juz 2', date: '2026-11-10', timestamp: '2026-11-10T12:00:00.000Z' })
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].groupedCount).toBe(2);
    expect(events[0].members).toHaveLength(2);
    // The group's headline is the most recent thing in it.
    expect(events[0].title).toBe('Juz 2');
  });

  it('does not merge different kinds of activity on the same day', () => {
    const events = buildTimeline([
      item({ domain: 'quran', eventType: 'session', date: '2026-11-10', timestamp: '2026-11-10T08:00:00.000Z' }),
      item({ domain: 'tasks', eventType: 'completed', date: '2026-11-10', timestamp: '2026-11-10T09:00:00.000Z' })
    ]);
    expect(events).toHaveLength(2);
  });

  it('never merges the same activity across two days', () => {
    const events = buildTimeline([
      item({ domain: 'quran', eventType: 'session', date: '2026-11-10', timestamp: '2026-11-10T08:00:00.000Z' }),
      item({ domain: 'quran', eventType: 'session', date: '2026-11-11', timestamp: '2026-11-11T08:00:00.000Z' })
    ]);
    expect(events).toHaveLength(2);
  });

  it('can be asked not to group', () => {
    const events = buildTimeline(
      [
        item({ domain: 'quran', eventType: 'session', date: '2026-11-10', timestamp: '2026-11-10T08:00:00.000Z' }),
        item({ domain: 'quran', eventType: 'session', date: '2026-11-10', timestamp: '2026-11-10T12:00:00.000Z' })
      ],
      { group: false }
    );
    expect(events).toHaveLength(2);
  });
});

describe('groupTimeline', () => {
  it('groups by local day and labels today distinctly', () => {
    const events = buildTimeline([item({ date: '2026-11-11', timestamp: '2026-11-11T09:00:00.000Z' })]);
    const groups = groupTimeline(events, 'day', false, '2026-11-11');
    expect(groups).toHaveLength(1);
    expect(groups[0].isToday).toBe(true);
    expect(groups[0].label).toContain('November');
  });

  it('groups by week using NUQTA week boundaries', () => {
    // 2026-11-11 is a Wednesday; its week starts Saturday 2026-11-07.
    const events = buildTimeline([
      item({ date: '2026-11-07', timestamp: '2026-11-07T09:00:00.000Z', domain: 'tasks' }),
      item({ date: '2026-11-11', timestamp: '2026-11-11T09:00:00.000Z', domain: 'habits' })
    ]);
    const groups = groupTimeline(events, 'week', false, '2026-11-11');
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-11-07');
  });

  it('groups by month for long ranges', () => {
    const events = buildTimeline([
      item({ date: '2026-09-03', timestamp: '2026-09-03T09:00:00.000Z', domain: 'tasks' }),
      item({ date: '2026-11-11', timestamp: '2026-11-11T09:00:00.000Z', domain: 'habits' })
    ]);
    const groups = groupTimeline(events, 'month', false, '2026-11-11');
    expect(groups.map((g) => g.key)).toEqual(['2026-11', '2026-09']);
  });

  it('orders sections newest first', () => {
    const events = buildTimeline([
      item({ date: '2026-11-01', timestamp: '2026-11-01T09:00:00.000Z', domain: 'tasks' }),
      item({ date: '2026-11-11', timestamp: '2026-11-11T09:00:00.000Z', domain: 'habits' })
    ]);
    const groups = groupTimeline(events, 'day', false, '2026-11-11');
    expect(groups[0].date > groups[1].date).toBe(true);
  });
});

describe('paginateTimeline', () => {
  const events = buildTimeline(
    Array.from({ length: 95 }, (_, i) =>
      item({
        domain: (['tasks', 'habits', 'quran'] as UniversalHistoryDomain[])[i % 3],
        date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
        timestamp: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T0${i % 9}:00:00.000Z`
      })
    ),
    { group: false }
  );

  it('exposes one page at a time and reports whether more exist', () => {
    const page = paginateTimeline(events, 40, 1);
    expect(page.shown).toBe(40);
    expect(page.total).toBe(95);
    expect(page.hasMore).toBe(true);
  });

  it('grows with the requested page count and stops at the end', () => {
    expect(paginateTimeline(events, 40, 2).shown).toBe(80);
    const last = paginateTimeline(events, 40, 3);
    expect(last.shown).toBe(95);
    expect(last.hasMore).toBe(false);
  });

  it('treats a non-positive page size as one row rather than returning everything', () => {
    expect(paginateTimeline(events, 0, 1).shown).toBe(1);
  });
});

describe('buildTimelineView', () => {
  const items = [
    item({ domain: 'tasks', eventType: 'completed', date: '2026-11-10', timestamp: '2026-11-10T09:00:00.000Z' }),
    item({ domain: 'habits', eventType: 'completed', date: '2026-11-10', timestamp: '2026-11-10T10:00:00.000Z' }),
    item({ domain: 'quran', eventType: 'session', date: '2026-11-11', timestamp: '2026-11-11T09:00:00.000Z' })
  ];

  it('reports totals and per-domain counts for the filter chips', () => {
    const view = buildTimelineView(items, { period: 'all' }, false, '2026-11-11');
    expect(view.total).toBe(3);
    expect(view.domainCounts.tasks).toBe(1);
    expect(view.domainCounts.quran).toBe(1);
    expect(view.eventTypeCounts.completed).toBe(2);
  });

  it('distinguishes "no matches" from "no history at all"', () => {
    expect(buildTimelineView(items, { search: 'zzz' }, false, '2026-11-11').hasAnyEvents).toBe(true);
    expect(buildTimelineView([], {}, false, '2026-11-11').hasAnyEvents).toBe(false);
  });

  it('picks day granularity for a month view and week granularity for a year view', () => {
    expect(buildTimelineView(items, { period: 'month' }, false, '2026-11-11').granularity).toBe('day');
    expect(buildTimelineView(items, { period: 'year' }, false, '2026-11-11').granularity).toBe('week');
  });
});
