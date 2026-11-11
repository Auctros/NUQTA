/**
 * Calendar-date helpers.
 *
 * NUQTA stores two different kinds of time values and they must not be mixed:
 *   1. Instants (createdAt, updatedAt, completedAt...) -> ISO-8601 UTC strings.
 *   2. Calendar days (scheduledDate, completedDates, health keys...) -> "YYYY-MM-DD"
 *      in the user's LOCAL time zone.
 *
 * `new Date().toISOString().split('T')[0]` yields the UTC calendar day, which is
 * "yesterday" (UTC+) or "tomorrow" (UTC-) for part of every local day. Always use
 * `localDateKey()` for calendar days.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local-time "YYYY-MM-DD" for the given date (defaults to now). */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-time "HH:mm" for the given date (defaults to now). */
export function localTimeKey(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_KEY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Parse "YYYY-MM-DD" as LOCAL midnight (never UTC). Returns null if invalid. */
export function parseDateKey(key: string): Date | null {
  if (!isDateKey(key)) return null;
  const m = DATE_KEY_RE.exec(key)!;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Shift a "YYYY-MM-DD" key by whole calendar days (DST-safe). */
export function addDaysToKey(key: string, days: number): string {
  const base = parseDateKey(key) ?? new Date();
  base.setDate(base.getDate() + days);
  return localDateKey(base);
}
