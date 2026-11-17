/**
 * Recurrence engine — one rule vocabulary, two very different consumers.
 *
 * Tasks materialise: each due date becomes a real Task record (see `expandSeries`),
 * so completing/editing/deleting one occurrence is an ordinary task operation and
 * can never corrupt its siblings.
 *
 * Habits are evaluated: `isRuleDueOn` answers "is this habit expected today?" and
 * nothing is stored per day, so compliance and streaks recompute from a single
 * `completedDates` list.
 *
 * All day maths is done on "YYYY-MM-DD" local keys through `dateKey`, never on raw
 * `Date` arithmetic that could drift across a DST boundary.
 */

import type { RecurrenceRule } from '../types';
import { addDaysToKey, isDateKey, parseDateKey } from './dateKey';
import { dayOfWeek, isWorkingDay } from './week';

/** Whole calendar days from `a` to `b` (b - a), DST-safe. */
export function daysBetweenKeys(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return 0;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Days in the month that contains `key`. */
function daysInMonthOf(key: string): number {
  const d = parseDateKey(key);
  if (!d) return 31;
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Normalise a rule so downstream checks can assume sane values. */
export function normalizeRule(rule: RecurrenceRule, anchorKey: string): Required<Pick<RecurrenceRule, 'freq'>> & RecurrenceRule {
  const days = (rule.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const anchorDow = dayOfWeek(anchorKey);
  const anchorDom = parseDateKey(anchorKey)?.getDate() ?? 1;
  return {
    ...rule,
    freq: rule.freq,
    days: days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : [anchorDow],
    monthDay: rule.monthDay ?? anchorDom,
    intervalDays: Math.max(1, Math.floor(rule.intervalDays ?? 1))
  };
}

/**
 * Is `dateKey` an occurrence of the rule that started on `anchorKey`?
 * `anchorKey` bounds the series: nothing is due before it, and the first occurrence
 * is the anchor itself.
 */
export function isRuleDueOn(rule: RecurrenceRule, anchorKey: string, dateKey: string): boolean {
  if (!isDateKey(anchorKey) || !isDateKey(dateKey)) return false;
  if (dateKey < anchorKey) return false;

  const norm = normalizeRule(rule, anchorKey);
  if (norm.until && isDateKey(norm.until) && dateKey > norm.until) return false;

  switch (norm.freq) {
    case 'daily':
      return true;
    case 'weekdays':
      // NUQTA's working week: Saturday..Thursday. Friday is the day off.
      return isWorkingDay(dateKey);
    case 'weekly':
    case 'custom':
      return (norm.days ?? []).includes(dayOfWeek(dateKey));
    case 'monthly': {
      const dom = parseDateKey(dateKey)?.getDate();
      if (dom === undefined) return false;
      // Clamp to the last day so a "31st" rule still fires in a 30-day month
      // instead of silently skipping it.
      const target = Math.min(norm.monthDay ?? 1, daysInMonthOf(dateKey));
      return dom === target;
    }
    case 'interval':
      return daysBetweenKeys(anchorKey, dateKey) % (norm.intervalDays ?? 1) === 0;
    default:
      return false;
  }
}

/**
 * The first occurrence strictly after `afterKey` (or `afterKey` itself when
 * `inclusive`). Returns null when the series has ended or is malformed.
 */
export function nextOccurrenceKey(
  rule: RecurrenceRule,
  anchorKey: string,
  afterKey: string,
  inclusive = false
): string | null {
  if (!isDateKey(anchorKey) || !isDateKey(afterKey)) return null;
  let cursor = afterKey < anchorKey ? anchorKey : inclusive ? afterKey : addDaysToKey(afterKey, 1);
  // Bounded search: 5 years of daily steps is far beyond any real horizon.
  for (let i = 0; i < 1830; i++) {
    if (isRuleDueOn(rule, anchorKey, cursor)) return cursor;
    cursor = addDaysToKey(cursor, 1);
  }
  return null;
}

/** Occurrence keys within [fromKey, toKey], in ascending order (capped for safety). */
export function occurrencesInRange(
  rule: RecurrenceRule,
  anchorKey: string,
  fromKey: string,
  toKey: string,
  limit = 400
): string[] {
  const out: string[] = [];
  if (!isDateKey(anchorKey) || !isDateKey(fromKey) || !isDateKey(toKey)) return out;
  let cursor = fromKey < anchorKey ? anchorKey : fromKey;
  while (cursor <= toKey && out.length < limit) {
    if (isRuleDueOn(rule, anchorKey, cursor)) out.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return out;
}

/** Human label key for a rule, so the UI can localise it without guessing. */
export function ruleSummary(rule: RecurrenceRule, anchorKey: string): string {
  const norm = normalizeRule(rule, anchorKey);
  switch (norm.freq) {
    case 'daily':
      return 'daily';
    case 'weekdays':
      return 'weekdays';
    case 'weekly':
    case 'custom':
      return `weekly:${(norm.days ?? []).join(',')}`;
    case 'monthly':
      return `monthly:${norm.monthDay}`;
    case 'interval':
      return `interval:${norm.intervalDays}`;
    default:
      return 'daily';
  }
}
