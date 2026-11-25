/**
 * Commitment Map — what did the person actually follow through on?
 *
 * The GitHub-contribution grid is a good *shape*: a year of days in columns of
 * weeks, shaded by how much happened. It is a poor *metric* for a life app,
 * because it counts activity, not commitment. Opening NUQTA and creating five
 * tasks is five events and zero follow-through; one habit kept on a day you
 * nearly skipped is one event and complete commitment.
 *
 * So this module never counts events. It scores a day from the things that were
 * actually *due* and the things actually *done*, which is information the habit
 * schedule and task records already hold:
 *
 *   commitment = (habits kept + scheduled tasks finished) / (habits due + scheduled tasks)
 *
 * Everything else — studio sessions, focus, reading, walks — is a real act of
 * intent but has no "due", so it cannot be *kept* or *broken*. It is recorded as
 * bonus evidence: it can raise a day from "nothing was due" to "you did this
 * anyway", but it never dilutes a day where something was due and missed.
 *
 * Three outcomes matter and are kept distinct, because conflating them is the
 * lie that makes habit apps demoralising:
 *
 *   - `missed`      something was due and not done.
 *   - `rest`        nothing was due, and nothing was done.
 *   - `no_data`     before tracking began, or a domain that never applied. This
 *                   is NOT a zero: an untracked day must never be shaded as a
 *                   failure.
 *
 * A day where nothing was due but you did something anyway is `kept` with a
 * ratio of 1 — you kept the implicit commitment to show up.
 */

import {
  Task,
  Habit,
  FocusSession,
  JournalEntry,
  HealthMetric,
  UniversalHistoryItem,
  UniversalHistoryDomain
} from '../types';
import { localDateKey, addDaysToKey, isDateKey } from './dateKey';
import { startOfWeekKey, dayOfWeek } from './week';
import { isHabitDueOn } from './habitSchedule';

/** What the map is measuring. `all` blends every domain that has a schedule. */
export type CommitmentScope = 'all' | UniversalHistoryDomain;

export type CommitmentDayState = 'kept' | 'partial' | 'missed' | 'rest' | 'no_data' | 'future';

/** 0 = nothing kept, 4 = everything kept. */
export type CommitmentLevel = 0 | 1 | 2 | 3 | 4;

export interface CommitmentDay {
  dateKey: string;
  state: CommitmentDayState;
  level: CommitmentLevel;
  /** 0..1. Null when nothing was due and nothing was done (no ratio exists). */
  ratio: number | null;
  dueCount: number;
  doneCount: number;
  /** Acts of intent with no due date (studio sessions, focus, walks...). */
  bonusCount: number;
  bonusMinutes: number;
  /** Per-domain breakdown, for the day detail panel. */
  byDomain: Partial<Record<UniversalHistoryDomain, { due: number; done: number; bonus: number }>>;
  isToday: boolean;
  /** True when the day is before any tracking existed. */
  insufficient: boolean;
}

export interface CommitmentSummary {
  /** Days where something was due. The denominator for the period rate. */
  scheduledDays: number;
  keptDays: number;
  partialDays: number;
  missedDays: number;
  restDays: number;
  noDataDays: number;
  /** Weighted: total done / total due over the period. Null when nothing was due. */
  periodRate: number | null;
  /** Unweighted share of scheduled days that were fully kept. */
  fullDayRate: number | null;
  currentStreak: number;
  longestStreak: number;
  bestDay: { dateKey: string; ratio: number; doneCount: number } | null;
  totalBonusActs: number;
  totalBonusMinutes: number;
  /** Plain-language reading of the period, not a bare number. */
  headlineAr: string;
  headlineEn: string;
}

export interface CommitmentYear {
  year: number;
  /** Weeks of 7 days, each Sat..Fri, covering the year. */
  weeks: CommitmentDay[][];
  /** Month label + the column index it starts at, for the header row. */
  months: { labelAr: string; labelEn: string; column: number }[];
  summary: CommitmentSummary;
  /** First day with any tracking record, if any. */
  trackingStart: string | null;
}

export interface CommitmentSources {
  tasks: Task[];
  habits: Habit[];
  focusSessions: FocusSession[];
  journalEntries?: JournalEntry[];
  healthMetrics?: Record<string, HealthMetric>;
  /** Optional: derived events, used for bonus acts the records do not expose directly. */
  history?: UniversalHistoryItem[];
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر'
];
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

/** Domains that can be scored against a schedule. */
export const SCHEDULED_SCOPES: readonly CommitmentScope[] = ['all', 'tasks', 'habits'];

/** Domains that can only ever contribute bonus evidence. */
export const BONUS_SCOPES: readonly UniversalHistoryDomain[] = [
  'focus',
  'reading',
  'quran',
  'workout',
  'drawing',
  'walking',
  'journal'
];

function isActiveHabit(h: Habit): boolean {
  return !h.isArchived && h.status !== 'archived';
}

/** A task counts as "scheduled" only when it had a day to be done on. */
function scheduledDayOf(task: Task): string | null {
  if (task.scheduledDate && isDateKey(task.scheduledDate)) return task.scheduledDate;
  return null;
}

function isDoneTask(task: Task): boolean {
  return task.status === 'completed';
}

function isSkippedTask(task: Task): boolean {
  return task.status === 'skipped';
}

/**
 * The earliest day the app has any record of the person at all. Days before this
 * are `no_data`, never `missed` — a fresh install must not look like failure.
 */
export function findTrackingStart(sources: CommitmentSources): string | null {
  const candidates: string[] = [];
  for (const h of sources.habits) {
    if (h.createdAt) candidates.push(localDateKey(new Date(h.createdAt)));
    for (const d of h.completedDates ?? []) if (isDateKey(d)) candidates.push(d);
  }
  for (const t of sources.tasks) {
    if (t.createdAt) candidates.push(localDateKey(new Date(t.createdAt)));
    if (t.scheduledDate && isDateKey(t.scheduledDate)) candidates.push(t.scheduledDate);
    if (t.completedAt) candidates.push(localDateKey(new Date(t.completedAt)));
  }
  for (const s of sources.focusSessions) {
    if (s.completedAt) candidates.push(localDateKey(new Date(s.completedAt)));
  }
  for (const k of Object.keys(sources.healthMetrics ?? {})) if (isDateKey(k)) candidates.push(k);
  for (const j of sources.journalEntries ?? []) if (isDateKey(j.date)) candidates.push(j.date);

  const valid = candidates.filter(isDateKey).sort();
  return valid.length > 0 ? valid[0] : null;
}

interface DayAccumulator {
  due: number;
  done: number;
  bonus: number;
  bonusMinutes: number;
  byDomain: Partial<Record<UniversalHistoryDomain, { due: number; done: number; bonus: number }>>;
}

function bumpDomain(
  acc: DayAccumulator,
  domain: UniversalHistoryDomain,
  field: 'due' | 'done' | 'bonus'
): void {
  const entry = (acc.byDomain[domain] ??= { due: 0, done: 0, bonus: 0 });
  entry[field] += 1;
}

/**
 * Level from a ratio, deliberately coarse so the grid stays readable:
 * 0 nothing, 1 barely, 2 half, 3 most, 4 all. A `kept` day is always 4; a
 * `missed` day is always 0 — those two are facts, not gradations.
 */
export function levelForRatio(ratio: number | null, state: CommitmentDayState): CommitmentLevel {
  if (state === 'missed') return 0;
  if (state === 'rest' || state === 'no_data' || state === 'future') return 0;
  if (ratio === null) return 0;
  if (ratio >= 1) return 4;
  if (ratio >= 0.67) return 3;
  if (ratio >= 0.34) return 2;
  if (ratio > 0) return 1;
  return 0;
}

function stateForDay(due: number, done: number, bonus: number, ratio: number | null): CommitmentDayState {
  if (due === 0) return bonus > 0 ? 'kept' : 'rest';
  if (done === 0) return 'missed';
  if (ratio !== null && ratio >= 1) return 'kept';
  return 'partial';
}

/**
 * Build every day of a year, Sat..Fri columns, aligned to the real calendar.
 *
 * Local-day correctness is the point of the exercise: a habit kept at 23:30 local
 * belongs to that local day, and the grid must say so. All day keys here come
 * from `localDateKey`/`addDaysToKey`, never from a UTC slice.
 */
export function buildCommitmentYear(
  sources: CommitmentSources,
  year: number,
  scope: CommitmentScope = 'all',
  todayKey: string = localDateKey()
): CommitmentYear {
  const trackingStart = findTrackingStart(sources);
  const activeHabits = sources.habits.filter(isActiveHabit);
  const keys = yearDayKeys(year);
  const elapsedKeys = keys.filter((key) => key <= todayKey);

  const includeTasks = scope === 'all' || scope === 'tasks';
  const includeHabits = scope === 'all' || scope === 'habits';

  const dayAcc = new Map<string, DayAccumulator>();
  const accFor = (key: string): DayAccumulator => {
    let acc = dayAcc.get(key);
    if (!acc) {
      acc = { due: 0, done: 0, bonus: 0, bonusMinutes: 0, byDomain: {} };
      dayAcc.set(key, acc);
    }
    return acc;
  };

  // ---- due & done: the only two numbers that can form a commitment ratio ----
  if (includeHabits) {
    for (const habit of activeHabits) {
      // Iterate the year's days and ask the schedule. Habits are never materialised
      // per day, so this is the only correct way to know what was due.
      for (const key of elapsedKeys) {
        if (!isHabitDueOn(habit, key)) continue;
        const acc = accFor(key);
        acc.due += 1;
        bumpDomain(acc, 'habits', 'due');
        if ((habit.completedDates ?? []).includes(key)) {
          acc.done += 1;
          bumpDomain(acc, 'habits', 'done');
        }
      }
    }
  }

  if (includeTasks) {
    for (const task of sources.tasks) {
      const day = scheduledDayOf(task);
      if (!day || !day.startsWith(String(year))) continue;
      if (day > todayKey) continue;
      const acc = accFor(day);
      // A skipped occurrence was deliberately dismissed, not promised — it is not a
      // broken commitment and must not lower the ratio.
      if (isSkippedTask(task)) continue;
      acc.due += 1;
      bumpDomain(acc, 'tasks', 'due');
      if (isDoneTask(task)) {
        acc.done += 1;
        bumpDomain(acc, 'tasks', 'done');
      }
    }
  }

  // ---- bonus: real acts of intent that carry no due date ----
  // `tasks` and `habits` are never bonus: they are already scored against a schedule,
  // and counting their events again would inflate the very ratio this map reports.
  const bonusDomains: UniversalHistoryDomain[] =
    scope === 'all'
      ? [...BONUS_SCOPES]
      : scope === 'tasks' || scope === 'habits'
      ? []
      : [scope as UniversalHistoryDomain];

  if (bonusDomains.includes('focus')) {
    for (const session of sources.focusSessions) {
      const key = localDateKey(new Date(session.completedAt));
      if (!key.startsWith(String(year)) || key > todayKey) continue;
      const acc = accFor(key);
      acc.bonus += 1;
      acc.bonusMinutes += session.durationMinutes ?? 0;
      bumpDomain(acc, 'focus', 'bonus');
    }
  }

  if (bonusDomains.includes('journal')) {
    for (const entry of sources.journalEntries ?? []) {
      if (!isDateKey(entry.date) || !entry.date.startsWith(String(year)) || entry.date > todayKey) continue;
      const acc = accFor(entry.date);
      acc.bonus += 1;
      bumpDomain(acc, 'journal', 'bonus');
    }
  }

  const studioDomains: UniversalHistoryDomain[] = bonusDomains.filter(
    (d) => d === 'reading' || d === 'quran' || d === 'workout' || d === 'drawing' || d === 'walking'
  );
  if (studioDomains.length > 0) {
    for (const item of sources.history ?? []) {
      if (!studioDomains.includes(item.domain)) continue;
      if (item.eventType === 'created' || item.eventType === 'archived' || item.eventType === 'restored') continue;
      const key = isDateKey(item.date) ? item.date : localDateKey(new Date(item.timestamp));
      if (!key.startsWith(String(year)) || key > todayKey) continue;
      const acc = accFor(key);
      acc.bonus += 1;
      bumpDomain(acc, item.domain, 'bonus');
    }
  }

  // ---- assemble the grid ----
  const days: CommitmentDay[] = keys.map((key) => {
    const acc = dayAcc.get(key);
    const due = acc?.due ?? 0;
    const done = acc?.done ?? 0;
    const bonus = acc?.bonus ?? 0;
    const isFuture = key > todayKey;
    const insufficient = trackingStart === null || key < trackingStart;

    let ratio: number | null = due > 0 ? Math.min(1, done / due) : null;
    let state: CommitmentDayState;
    if (isFuture) {
      state = 'future';
    } else if (insufficient) {
      state = 'no_data';
      ratio = null;
    } else {
      state = stateForDay(due, done, bonus, ratio);
    }

    return {
      dateKey: key,
      state,
      level: levelForRatio(ratio, state),
      ratio,
      dueCount: due,
      doneCount: done,
      bonusCount: bonus,
      bonusMinutes: acc?.bonusMinutes ?? 0,
      byDomain: acc?.byDomain ?? {},
      isToday: key === todayKey,
      insufficient
    };
  });

  const weeks = toWeeks(days);
  const summary = summarize(days, year, scope);

  return {
    year,
    weeks,
    months: monthColumns(weeks, year),
    summary,
    trackingStart
  };
}

/** Every local day key of a year, in order. */
export function yearDayKeys(year: number): string[] {
  const keys: string[] = [];
  let cursor = `${year}-01-01`;
  // Guard against a malformed year rather than looping forever.
  if (!isDateKey(cursor)) return keys;
  while (cursor.startsWith(String(year))) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return keys;
}

/**
 * Pack days into Sat..Fri columns. A year does not start on a Saturday, so the
 * first and last columns are padded with `null` — the grid must keep weekday rows
 * aligned or the whole map lies about which day is which.
 */
function toWeeks(days: CommitmentDay[]): CommitmentDay[][] {
  if (days.length === 0) return [];
  const weeks: CommitmentDay[][] = [];

  const first = days[0];
  const leadingBlanks = weekIndexFromSaturday(first.dateKey);
  let column: CommitmentDay[] = new Array(leadingBlanks).fill(null);

  for (const day of days) {
    column.push(day);
    if (column.length === 7) {
      weeks.push(column);
      column = [];
    }
  }
  if (column.length > 0) {
    while (column.length < 7) column.push(null as unknown as CommitmentDay);
    weeks.push(column);
  }

  return weeks;
}

/** 0 = Saturday ... 6 = Friday, matching NUQTA's week. */
function weekIndexFromSaturday(dateKey: string): number {
  const dow = dayOfWeek(dateKey); // 0=Sun..6=Sat
  return (dow - 6 + 7) % 7;
}

function monthColumns(weeks: CommitmentDay[][], year: number): CommitmentYear['months'] {
  const months: CommitmentYear['months'] = [];
  const seen = new Set<number>();
  weeks.forEach((week, column) => {
    for (const day of week) {
      if (!day || !day.dateKey.startsWith(String(year))) continue;
      const month = Number(day.dateKey.slice(5, 7)) - 1;
      if (seen.has(month)) continue;
      seen.add(month);
      months.push({ labelAr: MONTHS_AR[month], labelEn: MONTHS_EN[month], column });
      break;
    }
  });
  return months;
}

function summarize(days: CommitmentDay[], year: number, scope: CommitmentScope): CommitmentSummary {
  let scheduledDays = 0;
  let keptDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let restDays = 0;
  let noDataDays = 0;
  let totalDue = 0;
  let totalDone = 0;
  let totalBonusActs = 0;
  let totalBonusMinutes = 0;
  let bestDay: CommitmentSummary['bestDay'] = null;

  for (const day of days) {
    if (day.state === 'future') continue;
    if (day.state === 'no_data') {
      noDataDays += 1;
      continue;
    }
    totalBonusActs += day.bonusCount;
    totalBonusMinutes += day.bonusMinutes;

    if (day.dueCount > 0) {
      scheduledDays += 1;
      totalDue += day.dueCount;
      totalDone += day.doneCount;
      if (day.state === 'kept') keptDays += 1;
      else if (day.state === 'missed') missedDays += 1;
      else partialDays += 1;
    } else if (day.state === 'rest') {
      restDays += 1;
    } else if (day.state === 'kept') {
      // Bonus-only day: nothing was due, something was done. Counts as kept.
      keptDays += 1;
    }

    if (day.ratio !== null && (!bestDay || day.ratio > bestDay.ratio || (day.ratio === bestDay.ratio && day.doneCount > bestDay.doneCount))) {
      bestDay = { dateKey: day.dateKey, ratio: day.ratio, doneCount: day.doneCount };
    }
  }

  const periodRate = totalDue > 0 ? totalDone / totalDue : null;
  const fullDayRate = scheduledDays > 0 ? keptDays / scheduledDays : null;

  // Streaks only walk days that were actually measured. A `no_data` day does not
  // break a streak (it is not evidence of failure) but does not extend it either.
  const measured = days.filter((d) => d.state !== 'future' && d.state !== 'no_data');
  let currentStreak = 0;
  for (let i = measured.length - 1; i >= 0; i -= 1) {
    const day = measured[i];
    if (day.state === 'kept') currentStreak += 1;
    else if (day.state === 'rest') continue; // a rest day neither breaks nor extends
    else break;
  }
  let longestStreak = 0;
  let run = 0;
  for (const day of measured) {
    if (day.state === 'kept') {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else if (day.state === 'rest') {
      continue;
    } else {
      run = 0;
    }
  }

  const { headlineAr, headlineEn } = headlineFor({
    scheduledDays,
    keptDays,
    partialDays,
    missedDays,
    periodRate,
    totalBonusActs,
    year,
    scope
  });

  return {
    scheduledDays,
    keptDays,
    partialDays,
    missedDays,
    restDays,
    noDataDays,
    periodRate,
    fullDayRate,
    currentStreak,
    longestStreak,
    bestDay,
    totalBonusActs,
    totalBonusMinutes,
    headlineAr,
    headlineEn
  };
}

/**
 * A sentence a person can act on, instead of a bare percentage.
 * The wording distinguishes "no schedule" from "kept everything" — the two cases
 * that a naive count would both render as 100%.
 */
function headlineFor(args: {
  scheduledDays: number;
  keptDays: number;
  partialDays: number;
  missedDays: number;
  periodRate: number | null;
  totalBonusActs: number;
  year: number;
  scope: CommitmentScope;
}): { headlineAr: string; headlineEn: string } {
  const { scheduledDays, keptDays, partialDays, missedDays, periodRate, totalBonusActs, year, scope } = args;
  const pct = periodRate === null ? null : Math.round(periodRate * 100);
  const scopeAr =
    scope === 'all' ? 'كل المجالات' : scope === 'tasks' ? 'المهام' : scope === 'habits' ? 'العادات' : 'المجال';
  const scopeEn = scope === 'all' ? 'across all areas' : `in ${scope}`;

  if (scheduledDays === 0) {
    if (totalBonusActs > 0) {
      return {
        headlineAr: `${year}: لم يكن هناك جدول ملزم، لكنك سجّلت ${totalBonusActs} نشاطاً في ${scopeAr}.`,
        headlineEn: `${year}: nothing was scheduled, but you logged ${totalBonusActs} activities ${scopeEn}.`
      };
    }
    return {
      headlineAr: `${year}: لا يوجد جدول أو سجلات كافية في ${scopeAr} لقياس الالتزام.`,
      headlineEn: `${year}: no schedule or records yet ${scopeEn} to measure commitment.`
    };
  }

  if (missedDays === 0 && partialDays === 0) {
    return {
      headlineAr: `${year}: التزمت بكل ما كان مجدولاً في ${scheduledDays} يوماً (${pct}% إنجاز).`,
      headlineEn: `${year}: you kept everything scheduled across ${scheduledDays} days (${pct}% completion).`
    };
  }

  return {
    headlineAr: `${year}: أنجزت ${pct}% مما كان مجدولاً — ${keptDays} يوماً كاملاً، ${partialDays} جزئياً، و${missedDays} فائتاً.`,
    headlineEn: `${year}: you completed ${pct}% of what was scheduled — ${keptDays} full days, ${partialDays} partial, ${missedDays} missed.`
  };
}

/** Every year that has any data, newest first, for the year switcher. */
export function availableYears(sources: CommitmentSources, todayKey: string = localDateKey()): number[] {
  const start = findTrackingStart(sources);
  const currentYear = Number(todayKey.slice(0, 4));
  if (!start) return [currentYear];
  const startYear = Number(start.slice(0, 4));
  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y -= 1) years.push(y);
  return years;
}

/**
 * The events of one day, for the detail panel and for linking the map to the
 * timeline. Ordered newest first, matching the timeline's own order.
 */
export function eventsForDay(history: UniversalHistoryItem[], dateKey: string): UniversalHistoryItem[] {
  return history
    .filter((item) => (isDateKey(item.date) ? item.date : localDateKey(new Date(item.timestamp))) === dateKey)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/** The Sat..Fri week containing a day, as day keys. */
export function weekOf(dateKey: string): string[] {
  const start = startOfWeekKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}
