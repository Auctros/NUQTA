/**
 * Week configuration — the single source of truth for NUQTA's week.
 *
 * NUQTA's week starts on Saturday and Friday is the weekly day off:
 *   Sat · Sun · Mon · Tue · Wed · Thu · Fri
 *
 * Every week boundary, weekly schedule and working-day calculation must go through
 * this module. Never call `Date.getDay()` and compare against a literal day number
 * at a call site — that is how the old Sunday-first behaviour drifted apart.
 *
 * `Date.getDay()` is still used *inside* this module (it is the only portable way to
 * read a weekday); everywhere else uses these helpers.
 */

import { localDateKey, parseDateKey, addDaysToKey } from './dateKey';

/** `Date.getDay()` value of the first day of the week (Saturday). */
export const WEEK_START_DOW = 6;

/** `Date.getDay()` value of the weekly day off (Friday). */
export const WEEK_OFF_DOW = 5;

/** Weekday order as displayed, week-start first: Sat, Sun, Mon, Tue, Wed, Thu, Fri. */
export const WEEK_DAY_ORDER: readonly number[] = [6, 0, 1, 2, 3, 4, 5];

const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const DAY_LABELS_NARROW_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_LABELS_NARROW_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

/** Lower-case English weekday name -> `Date.getDay()` value. */
export const WEEKDAY_DOW: Readonly<Record<string, number>> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

/** Accepts a Date, an ISO instant or a "YYYY-MM-DD" key. */
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return parseDateKey(value) ?? new Date(value);
}

/** Weekday (`Date.getDay()`, 0=Sun..6=Sat) for a Date, instant or day key. */
export function dayOfWeek(value: Date | string): number {
  return toDate(value).getDay();
}

/** Position within the NUQTA week: 0 = Saturday … 6 = Friday. */
export function indexFromWeekStart(value: Date | string): number {
  const idx = WEEK_DAY_ORDER.indexOf(dayOfWeek(value));
  return idx === -1 ? 0 : idx;
}

/** Is this the weekly day off (Friday)? */
export function isWeekOff(value: Date | string): boolean {
  return dayOfWeek(value) === WEEK_OFF_DOW;
}

/**
 * Is the weekly review due on this day?
 *
 * NUQTA's week ends on Friday, so the review closes the week on the weekly day
 * off. (The feature predates the Sat-first week and was named "Sunday Ritual";
 * the storage keys and the `SundayRitualReview` type keep that legacy name for
 * backward compatibility, but the day it fires on is Friday.)
 */
export function isWeeklyReviewDay(value: Date | string): boolean {
  return isWeekOff(value);
}

/** Is this a working day? Every day except Friday. */
export function isWorkingDay(value: Date | string): boolean {
  return dayOfWeek(value) !== WEEK_OFF_DOW;
}

/**
 * The Saturday that starts the week containing `key`.
 * `startOfWeekKey('2026-11-07')` (a Saturday) is itself.
 */
export function startOfWeekKey(key: string): string {
  return addDaysToKey(key, -indexFromWeekStart(key));
}

/** The Friday that ends the week containing `key`. */
export function endOfWeekKey(key: string): string {
  return addDaysToKey(startOfWeekKey(key), 6);
}

/** The seven day keys of the week containing `key`, in Sat..Fri order. */
export function weekDayKeys(key: string): string[] {
  const start = startOfWeekKey(key);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/**
 * The day keys of the current NUQTA week (Sat..Fri) that have already happened,
 * i.e. from the week start up to and including `key`. Future days are excluded so a
 * week-to-date rate is never deflated by days that cannot be done yet.
 */
export function elapsedWeekDayKeys(key: string): string[] {
  const start = startOfWeekKey(key);
  const out: string[] = [];
  for (let cursor = start; cursor <= key; cursor = addDaysToKey(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

/** Local day key of the most recent week start on or before today. */
export function currentWeekStartKey(todayKey: string = localDateKey()): string {
  return startOfWeekKey(todayKey);
}

/** Localized weekday name for a `Date.getDay()` value. */
export function weekDayLabel(dow: number, isAr: boolean): string {
  const table = isAr ? DAY_LABELS_AR : DAY_LABELS_EN;
  return table[dow] ?? '';
}

/** Localized narrow weekday initial for a `Date.getDay()` value. */
export function weekDayNarrow(dow: number, isAr: boolean): string {
  const table = isAr ? DAY_LABELS_NARROW_AR : DAY_LABELS_NARROW_EN;
  return table[dow] ?? '';
}

/** Localized weekday names in NUQTA week order (Sat..Fri). */
export function weekDayLabels(isAr: boolean): string[] {
  return WEEK_DAY_ORDER.map((dow) => weekDayLabel(dow, isAr));
}

/** Localized narrow weekday initials in NUQTA week order (Sat..Fri). */
export function weekDayNarrows(isAr: boolean): string[] {
  return WEEK_DAY_ORDER.map((dow) => weekDayNarrow(dow, isAr));
}

/** Localized label for a "YYYY-MM-DD" key. */
export function weekDayLabelOf(key: string, isAr: boolean): string {
  return weekDayLabel(dayOfWeek(key), isAr);
}
