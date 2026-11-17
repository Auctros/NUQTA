import { describe, it, expect } from 'vitest';
import {
  daysBetweenKeys,
  normalizeRule,
  isRuleDueOn,
  nextOccurrenceKey,
  occurrencesInRange,
  ruleSummary
} from '../src/lib/recurrence';
import {
  materializeSeries,
  seriesDates,
  openOccurrences,
  horizonEndKey,
  reconcileSeries,
  removeSeries,
  pendingOccurrenceIds,
  SERIES_HORIZON_DAYS,
  type SeriesDraft
} from '../src/lib/taskRecurrence';
import { dayOfWeek } from '../src/lib/week';
import type { RecurrenceRule, Task } from '../src/types';

// 2026-11-07 = Saturday (week start); 2026-11-13 = Friday (day off).
describe('recurrence engine', () => {
  it('counts whole days between two keys, DST-safe', () => {
    expect(daysBetweenKeys('2026-11-07', '2026-11-14')).toBe(7);
    expect(daysBetweenKeys('2026-11-14', '2026-11-07')).toBe(-7);
    expect(daysBetweenKeys('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('daily fires every day from the anchor', () => {
    const rule: RecurrenceRule = { freq: 'daily' };
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-06')).toBe(false); // before anchor
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-07')).toBe(true);
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-13')).toBe(true);
  });

  it('weekdays fires Sat..Thu and never on Friday', () => {
    const rule: RecurrenceRule = { freq: 'weekdays' };
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-07')).toBe(true); // Sat
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-08')).toBe(true); // Sun
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-13')).toBe(false); // Fri
  });

  it('weekly fires only on the given weekdays', () => {
    const rule: RecurrenceRule = { freq: 'weekly', days: [1, 3] }; // Mon, Wed
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-09')).toBe(true); // Mon
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-10')).toBe(false); // Tue
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-11')).toBe(true); // Wed
  });

  it('a weekly rule with no days falls back to the anchor weekday', () => {
    const rule: RecurrenceRule = { freq: 'weekly' };
    // Anchor is Saturday, so only Saturdays fire.
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-14')).toBe(true); // next Sat
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-09')).toBe(false); // Mon
  });

  it('monthly clamps to the last day of shorter months', () => {
    const rule: RecurrenceRule = { freq: 'monthly', monthDay: 31 };
    expect(isRuleDueOn(rule, '2026-01-31', '2026-01-31')).toBe(true);
    expect(isRuleDueOn(rule, '2026-01-31', '2026-02-28')).toBe(true); // clamped
    expect(isRuleDueOn(rule, '2026-01-31', '2026-03-31')).toBe(true);
    expect(isRuleDueOn(rule, '2026-01-31', '2026-03-30')).toBe(false);
  });

  it('interval fires every N days from the anchor', () => {
    const rule: RecurrenceRule = { freq: 'interval', intervalDays: 3 };
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-07')).toBe(true);
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-09')).toBe(false);
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-10')).toBe(true);
  });

  it('honours an `until` bound', () => {
    const rule: RecurrenceRule = { freq: 'daily', until: '2026-11-09' };
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-09')).toBe(true);
    expect(isRuleDueOn(rule, '2026-11-07', '2026-11-10')).toBe(false);
  });

  it('rejects malformed keys', () => {
    expect(isRuleDueOn({ freq: 'daily' }, 'not-a-key', '2026-11-07')).toBe(false);
    expect(isRuleDueOn({ freq: 'daily' }, '2026-11-07', 'nope')).toBe(false);
  });

  it('normalises missing days and intervals', () => {
    const norm = normalizeRule({ freq: 'weekly' }, '2026-11-07');
    expect(norm.days).toEqual([6]); // Saturday
    expect(norm.intervalDays).toBe(1);
  });

  it('finds the next occurrence strictly after a key', () => {
    const rule: RecurrenceRule = { freq: 'weekly', days: [1] }; // Mondays
    expect(nextOccurrenceKey(rule, '2026-11-07', '2026-11-07')).toBe('2026-11-09');
    expect(nextOccurrenceKey(rule, '2026-11-07', '2026-11-09')).toBe('2026-11-16');
    expect(nextOccurrenceKey(rule, '2026-11-07', '2026-11-09', true)).toBe('2026-11-09');
  });

  it('lists occurrences within a range in order', () => {
    const rule: RecurrenceRule = { freq: 'weekly', days: [1, 3] }; // Mon, Wed
    expect(occurrencesInRange(rule, '2026-11-07', '2026-11-07', '2026-11-14')).toEqual([
      '2026-11-09',
      '2026-11-11'
    ]);
  });

  it('produces a stable summary key for localisation', () => {
    expect(ruleSummary({ freq: 'daily' }, '2026-11-07')).toBe('daily');
    expect(ruleSummary({ freq: 'weekdays' }, '2026-11-07')).toBe('weekdays');
    expect(ruleSummary({ freq: 'interval', intervalDays: 2 }, '2026-11-07')).toBe('interval:2');
  });
});

const draft: SeriesDraft = { title: 'Standup', priority: 3 };

describe('task recurrence materialisation', () => {
  it('materialises one record per due date up to the horizon', () => {
    const rule: RecurrenceRule = { freq: 'weekly', days: [1] }; // Mondays
    const tasks = materializeSeries('ser-1', draft, rule, '2026-11-07', new Set(), '2026-11-07');
    // Horizon is 90 days out; count Mondays in [11-07, 11-07 + 90].
    const end = horizonEndKey('2026-11-07', rule, '2026-11-07');
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.seriesId).toBe('ser-1');
      expect(t.recurrence).toEqual(rule);
      expect(t.status).toBe('todo');
      expect(new Date(t.scheduledDate! + 'T00:00:00').getDay()).toBe(1); // Monday
      expect(t.scheduledDate! <= end).toBe(true);
    }
    // Deterministic ids and occurrence indices.
    expect(tasks[0].id).toBe('ser-1-o0');
    expect(tasks[0].occurrenceIndex).toBe(0);
    expect(tasks[1].occurrenceIndex).toBe(1);
  });

  it('is idempotent: existing dates are never re-materialised', () => {
    const rule: RecurrenceRule = { freq: 'daily' };
    const first = materializeSeries('ser-2', draft, rule, '2026-11-07', new Set(), '2026-11-07');
    const existing = new Set(first.map((t) => t.scheduledDate!));
    const again = materializeSeries('ser-2', draft, rule, '2026-11-07', existing, '2026-11-07');
    expect(again).toHaveLength(0);
  });

  it('skips dates already present when topping up a partial series', () => {
    const rule: RecurrenceRule = { freq: 'interval', intervalDays: 2 };
    const existing = new Set(['2026-11-07', '2026-11-09']);
    const tasks = materializeSeries('ser-3', draft, rule, '2026-11-07', existing, '2026-11-07');
    const dates = tasks.map((t) => t.scheduledDate);
    expect(dates).not.toContain('2026-11-07');
    expect(dates).not.toContain('2026-11-09');
    expect(dates).toContain('2026-11-11');
  });

  it('clamps the horizon to a rule `until`', () => {
    const rule: RecurrenceRule = { freq: 'daily', until: '2026-11-10' };
    const tasks = materializeSeries('ser-4', draft, rule, '2026-11-07', new Set(), '2026-11-07');
    expect(tasks.map((t) => t.scheduledDate)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10'
    ]);
    expect(horizonEndKey('2026-11-07', rule, '2026-11-07')).toBe('2026-11-10');
  });

  it('the horizon is bounded (never unbounded growth)', () => {
    const end = horizonEndKey('2026-11-07', { freq: 'daily' }, '2026-11-07');
    expect(daysBetweenKeys('2026-11-07', end)).toBe(SERIES_HORIZON_DAYS);
  });

  it('rejects an invalid anchor', () => {
    expect(materializeSeries('ser-5', draft, { freq: 'daily' }, 'bad', new Set())).toEqual([]);
  });

  it('collects series dates and open occurrences', () => {
    const tasks: Task[] = [
      { id: 'a', title: 'x', seriesId: 's', scheduledDate: '2026-11-09', status: 'completed' },
      { id: 'b', title: 'x', seriesId: 's', scheduledDate: '2026-11-16', status: 'todo' },
      { id: 'c', title: 'x', seriesId: 's', scheduledDate: '2026-11-23', status: 'cancelled' },
      { id: 'd', title: 'y', seriesId: 'other', scheduledDate: '2026-11-10', status: 'todo' }
    ] as Task[];
    expect([...seriesDates(tasks, 's')].sort()).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(openOccurrences(tasks, 's').map((t) => t.id)).toEqual(['b']);
  });

  it('reconcileSeries drops stale future occurrences and rebuilds them under the new rule', () => {
    // A daily series materialised from 2026-11-07, then edited to weekly on the same day.
    const daily: RecurrenceRule = { freq: 'daily' };
    const existing = materializeSeries('ser-r', draft, daily, '2026-11-07', new Set(), '2026-11-07');
    // One past occurrence is completed (must survive as history).
    existing[0] = { ...existing[0], status: 'completed', scheduledDate: '2026-11-01' };

    const weekly: RecurrenceRule = { freq: 'weekly', days: [6] }; // Saturdays
    const rebuilt = reconcileSeries(existing, 'ser-r', weekly, '2026-11-07', '2026-11-07', 'T0', draft);
    const open = rebuilt.filter((t) => t.seriesId === 'ser-r' && t.status !== 'completed');
    // Every remaining open occurrence follows the weekly rule (all Saturdays).
    expect(open.every((t) => t.scheduledDate && dayOfWeek(t.scheduledDate) === 6)).toBe(true);
    // The completed past day is preserved untouched.
    expect(rebuilt.find((t) => t.status === 'completed')?.scheduledDate).toBe('2026-11-01');
    // The old daily cadence is gone: far fewer open days remain.
    expect(open.length).toBeLessThan(existing.filter((t) => t.status !== 'completed').length);
  });

  it('removeSeries keeps completed occurrences as history but drops the rest', () => {
    const tasks: Task[] = [
      { id: 'a', title: 'x', seriesId: 's', scheduledDate: '2026-11-09', status: 'completed' },
      { id: 'b', title: 'x', seriesId: 's', scheduledDate: '2026-11-16', status: 'todo' },
      { id: 'c', title: 'x', seriesId: 's', scheduledDate: '2026-11-23', status: 'skipped' },
      { id: 'd', title: 'y', seriesId: 'other', scheduledDate: '2026-11-10', status: 'todo' }
    ] as Task[];
    const left = removeSeries(tasks, 's');
    expect(left.map((t) => t.id).sort()).toEqual(['a', 'd']);
    expect(pendingOccurrenceIds(tasks, 's')).toEqual(['b']);
  });
});
