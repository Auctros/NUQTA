/**
 * Insights analytics engine — the analytical backbone of the Insights center.
 *
 * Insights answers a different question than the Dashboard: the Dashboard says
 * "what needs my attention now?", Insights says "how is my life progressing over
 * time, and what do the patterns in my data reveal?".
 *
 * Design rules enforced here:
 *   - The NUQTA week is Saturday..Friday. Every range boundary and weekday bucket
 *     goes through `./week`; nothing here calls `Date.getDay()` directly.
 *   - "Missing" is never the same as "zero". A domain with no records reports
 *     `hasData: false` and a null rate, never a fabricated 0.
 *   - Habit adherence is due-day aware (via `habitCompliance`) so a weekdays-only
 *     habit is not punished for Friday, and a weekly habit is not judged daily.
 *   - Each record is counted once, in its own domain. Habit check-ins, studio
 *     sessions and focus sessions are separate dimensions and are never summed
 *     into one "activity" number that would double-count a logged workout.
 *   - Correlations are only reported when there are enough paired days and the
 *     samples actually vary; otherwise the result is null with a reason.
 */

import {
  ExpenseRecord,
  FocusSession,
  Goal,
  Habit,
  HealthMetric,
  JournalEntry,
  SavingsGoal,
  Task
} from '../types';
import { addDaysToKey, isDateKey, localDateKey, localDayFrom, parseDateKey } from './dateKey';
import {
  WEEK_DAY_ORDER,
  dayOfWeek,
  elapsedWeekDayKeys,
  endOfWeekKey,
  startOfWeekKey,
  weekDayLabel
} from './week';
import { computeCurrentStreak, habitCompliance } from './habitSchedule';
import { evaluateGoalProgress } from './goalProgressEngine';
import { isTaskActive, isTaskPending } from './taskStatus';

export interface InsightsInput {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  healthMetrics: Record<string, HealthMetric>;
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoal[];
  journalEntries: JournalEntry[];
}

export type InsightsRange = 'week' | '30d' | '90d' | 'year' | 'all';

/** Minimum paired days before a correlation is allowed to be reported. */
export const MIN_CORRELATION_DAYS = 5;

export interface RangeSpec {
  range: InsightsRange;
  /** Calendar days in the selected window, ascending. */
  currentKeys: string[];
  /** Equal-length comparison window immediately before it; empty for `all`. */
  previousKeys: string[];
  startKey: string | null;
  endKey: string;
  labelAr: string;
  labelEn: string;
  previousLabelAr: string | null;
  previousLabelEn: string | null;
  hasComparison: boolean;
}

/** A metric that knows whether it was actually measured. */
export interface Measured {
  value: number | null;
  /** Days in the window that had at least one record for this domain. */
  recordedDays: number;
  /** Days in the window with no record at all for this domain. */
  missingDays: number;
  daysInRange: number;
  /** True when the domain has any record (in the window or historically). */
  hasData: boolean;
}

export interface DeltaResult {
  current: number;
  previous: number;
  /** Percentage change vs the comparison window; null when not comparable. */
  percent: number | null;
  absolute: number;
  direction: 'up' | 'down' | 'flat' | 'none';
}

export interface TimelinePoint {
  key: string;
  label: string;
  fullLabel: string;
  /** Days aggregated into this point (1 for daily buckets). */
  dayCount: number;
  isPartial: boolean;
  tasksCompleted: number;
  tasksScheduled: number;
  habitDue: number;
  habitDone: number;
  activeMinutes: number;
  focusMinutes: number;
  workoutMinutes: number;
  workoutReps: number;
  readingPages: number;
  quranAyahs: number;
  /** Days inside this bucket that had any record. */
  recordedDays: number;
}

export interface ExecutionSection {
  hasData: boolean;
  completed: Measured;
  scheduledTotal: number;
  completionRate: number | null;
  previousCompletionRate: number | null;
  overdueCount: number;
  overdueAging: { labelAr: string; labelEn: string; count: number }[];
  topThreeDone: number;
  delta: DeltaResult;
}

export interface HabitsSection {
  hasData: boolean;
  activeHabits: number;
  dueDays: number;
  doneDays: number;
  adherenceRate: number | null;
  previousAdherenceRate: number | null;
  missedDueDays: number;
  longestActiveStreak: number;
  bestEverStreak: number;
  delta: DeltaResult;
  weekdayRhythm: {
    dow: number;
    labelAr: string;
    labelEn: string;
    dueCount: number;
    doneCount: number;
    rate: number | null;
  }[];
  timeOfDay: {
    slot: Habit['timeOfDay'];
    labelAr: string;
    labelEn: string;
    habitsCount: number;
    dueCount: number;
    doneCount: number;
    rate: number | null;
  }[];
}

export interface GoalsSection {
  hasData: boolean;
  activeCount: number;
  avgOutcomePercent: number | null;
  avgExecutionPercent: number | null;
  pacing: {
    ahead: number;
    on_track: number;
    behind: number;
    dormant: number;
    not_started: number;
    completed: number;
  };
  milestonesCompletedInRange: number;
  milestonesTotal: number;
  cards: {
    goalId: string;
    title: string;
    category: Goal['category'];
    outcomePercent: number;
    executionPercent: number;
    pacingStatus: string;
    linkedActivityInRange: number;
    lastActivityDate: string | null;
  }[];
}

export interface FocusSection {
  hasData: boolean;
  totalMinutes: Measured;
  sessionsCount: number;
  avgSessionMinutes: number | null;
  totalInterruptions: number;
  avgInterruptionRate: number | null;
  avgProductivityScore: number | null;
  bestDayMinutes: number;
  delta: DeltaResult;
}

export interface BodySection {
  hasData: boolean;
  sessionsCount: number;
  totalMinutes: Measured;
  totalReps: number;
  totalVolumeKg: number;
  avgIntensity: number | null;
  weeklyTargetSessions: number;
  consistencyPercent: number | null;
  movementDistribution: { key: string; labelAr: string; labelEn: string; reps: number; percent: number }[];
  delta: DeltaResult;
}

export interface LearningSection {
  hasData: boolean;
  pagesRead: Measured;
  totalMinutes: number;
  sessionsCount: number;
  booksFinishedInRange: number;
  avgSpeedPagesPerHour: number | null;
  delta: DeltaResult;
}

export interface FaithSection {
  hasData: boolean;
  ayahsInRange: Measured;
  sessionsCount: number;
  totalMinutes: number;
  distinctSurahs: number;
  qualityBreakdown: { key: string; labelAr: string; labelEn: string; count: number }[];
  delta: DeltaResult;
}

export interface FinanceSection {
  hasData: boolean;
  income: number;
  expense: number;
  net: number;
  savingsCurrent: number;
  savingsTarget: number;
  savingsPercent: number | null;
  topCategories: { category: string; amount: number; sharePercent: number }[];
  monthlyTrend: { key: string; label: string; income: number; expense: number; net: number }[];
}

export interface CorrelationResult {
  id: string;
  titleAr: string;
  titleEn: string;
  r: number | null;
  n: number;
  /** Plain-language reading of the coefficient, or why it is unavailable. */
  interpretationAr: string;
  interpretationEn: string;
  available: boolean;
}

export interface InsightsReport {
  range: InsightsRange;
  rangeLabelAr: string;
  rangeLabelEn: string;
  currentStartKey: string | null;
  currentEndKey: string;
  previousLabelAr: string | null;
  previousLabelEn: string | null;
  hasComparison: boolean;
  daysInRange: number;
  recordedDays: number;
  missingDays: number;
  /** True when there is not a single record in the window. */
  isEmptyWindow: boolean;
  timeline: TimelinePoint[];
  timelineGranularity: 'day' | 'week' | 'month';
  execution: ExecutionSection;
  habits: HabitsSection;
  goals: GoalsSection;
  focus: FocusSection;
  body: BodySection;
  learning: LearningSection;
  faith: FaithSection;
  finance: FinanceSection;
  correlations: CorrelationResult[];
}

// ------------------------------------------------------------------ date helpers

/** Every calendar day between two inclusive keys, ascending. */
function keysBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  if (startKey > endKey) return out;
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 100000) {
    out.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    guard += 1;
  }
  return out;
}

/** Month key "YYYY-MM" of a calendar day. */
function monthKeyOf(key: string): string {
  return key.slice(0, 7);
}

function monthLabel(monthKey: string, isAr: boolean): string {
  const [y, m] = monthKey.split('-').map(Number);
  const namesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const namesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const name = (isAr ? namesAr : namesEn)[(m || 1) - 1] ?? '';
  return `${name} ${String(y).slice(2)}`;
}

/**
 * All calendar days that carry at least one record anywhere in the store.
 * Used for the `all` range so it stays bounded by real data, not by wall-clock time.
 */
function collectRecordedKeys(input: InsightsInput): string[] {
  const keys = new Set<string>();
  const add = (v?: string) => {
    if (!v) return;
    const k = localDayFrom(v);
    if (isDateKey(k)) keys.add(k);
  };

  for (const t of input.tasks) {
    add(t.completedAt);
    if (t.scheduledDate) add(t.scheduledDate);
  }
  for (const h of input.habits) {
    (h.completedDates || []).forEach(add);
    h.readingData?.sessions?.forEach((s) => add(s.date));
    h.workoutData?.sessions?.forEach((s) => add(s.date));
    h.drawingData?.pieces?.forEach((p) => add(p.completedDate));
    h.quranData?.sessions?.forEach((s) => add(s.date));
    h.readingData?.books?.forEach((b) => add(b.completedDate));
  }
  input.focusSessions.forEach((f) => add(f.completedAt));
  input.expenses.forEach((e) => add(e.date));
  input.journalEntries.forEach((j) => add(j.date));
  Object.keys(input.healthMetrics).forEach((k) => isDateKey(k) && keys.add(k));

  return Array.from(keys).sort();
}

export function buildRangeSpec(
  range: InsightsRange,
  input: InsightsInput,
  todayKey: string = localDateKey(),
  isAr = false
): RangeSpec {
  const label = (en: string, ar: string) => (isAr ? ar : en);

  if (range === 'week') {
    const currentKeys = elapsedWeekDayKeys(todayKey); // Sat..today (week to date)
    const prevWeekStart = addDaysToKey(startOfWeekKey(todayKey), -7);
    // Compare like-for-like: same number of elapsed days in the previous week.
    const previousKeys = currentKeys.map((_, i) => addDaysToKey(prevWeekStart, i));
    return {
      range,
      currentKeys,
      previousKeys,
      startKey: currentKeys[0] ?? startOfWeekKey(todayKey),
      endKey: todayKey,
      labelAr: `${currentKeys[0] ?? ''} → ${todayKey}`,
      labelEn: `${currentKeys[0] ?? ''} → ${todayKey}`,
      previousLabelAr: `${prevWeekStart} → ${endOfWeekKey(addDaysToKey(todayKey, -7))}`,
      previousLabelEn: `${prevWeekStart} → ${endOfWeekKey(addDaysToKey(todayKey, -7))}`,
      hasComparison: previousKeys.length > 0
    };
  }

  if (range === 'all') {
    const recorded = collectRecordedKeys(input);
    const currentKeys = recorded.length > 0 ? recorded : [todayKey];
    return {
      range,
      currentKeys,
      previousKeys: [],
      startKey: currentKeys[0] ?? null,
      endKey: todayKey,
      labelAr: 'السجل التراكمي الشامل',
      labelEn: 'All-time record',
      previousLabelAr: null,
      previousLabelEn: null,
      hasComparison: false
    };
  }

  if (range === 'year') {
    const length = 365;
    const currentKeys = keysBetween(addDaysToKey(todayKey, -(length - 1)), todayKey);
    const previousKeys = keysBetween(addDaysToKey(todayKey, -(2 * length - 1)), addDaysToKey(todayKey, -length));
    return {
      range,
      currentKeys,
      previousKeys,
      startKey: currentKeys[0] ?? null,
      endKey: todayKey,
      labelAr: 'آخر 12 شهراً',
      labelEn: 'Last 12 months',
      previousLabelAr: 'الـ12 شهراً السابقة',
      previousLabelEn: 'Prior 12 months',
      hasComparison: true
    };
  }

  const length = range === '30d' ? 30 : 90;
  const currentKeys = keysBetween(addDaysToKey(todayKey, -(length - 1)), todayKey);
  const previousKeys = keysBetween(addDaysToKey(todayKey, -(2 * length - 1)), addDaysToKey(todayKey, -length));
  return {
    range,
    currentKeys,
    previousKeys,
    startKey: currentKeys[0] ?? null,
    endKey: todayKey,
    labelAr: label(`Last ${length} days`, `آخر ${length} يوماً`),
    labelEn: `Last ${length} days`,
    previousLabelAr: label(`Prior ${length} days`, `الـ${length} يوماً السابقة`),
    previousLabelEn: `Prior ${length} days`,
    hasComparison: true
  };
}

// ------------------------------------------------------------------ daily index

interface DayAgg {
  tasksCompleted: number;
  tasksScheduled: number;
  focusSessions: number;
  focusMinutes: number;
  readingSessions: number;
  readingPages: number;
  readingMinutes: number;
  workoutSessions: number;
  workoutReps: number;
  workoutMinutes: number;
  drawingPieces: number;
  drawingMinutes: number;
  quranSessions: number;
  quranAyahs: number;
  quranMinutes: number;
  habitCheckins: number;
  /** Any record at all on this day (for missing-vs-zero). */
  anyRecord: boolean;
}

function emptyAgg(): DayAgg {
  return {
    tasksCompleted: 0,
    tasksScheduled: 0,
    focusSessions: 0,
    focusMinutes: 0,
    readingSessions: 0,
    readingPages: 0,
    readingMinutes: 0,
    workoutSessions: 0,
    workoutReps: 0,
    workoutMinutes: 0,
    drawingPieces: 0,
    drawingMinutes: 0,
    quranSessions: 0,
    quranAyahs: 0,
    quranMinutes: 0,
    habitCheckins: 0,
    anyRecord: false
  };
}

/** Per-day aggregate of every domain. Each record lands in exactly one bucket. */
function indexDays(input: InsightsInput): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  const at = (key: string): DayAgg => {
    let a = map.get(key);
    if (!a) {
      a = emptyAgg();
      map.set(key, a);
    }
    return a;
  };

  for (const t of input.tasks) {
    if (t.scheduledDate && isDateKey(t.scheduledDate) && isTaskActive(t)) {
      const a = at(t.scheduledDate);
      a.tasksScheduled += 1;
      a.anyRecord = true;
    }
    if (t.status === 'completed' && t.completedAt) {
      const k = localDayFrom(t.completedAt);
      if (isDateKey(k)) {
        const a = at(k);
        a.tasksCompleted += 1;
        a.anyRecord = true;
      }
    }
  }

  for (const f of input.focusSessions) {
    if (!f.completedAt) continue;
    const k = localDayFrom(f.completedAt);
    if (!isDateKey(k)) continue;
    const a = at(k);
    a.focusSessions += 1;
    a.focusMinutes += Math.max(0, f.durationMinutes || 0);
    a.anyRecord = true;
  }

  for (const h of input.habits) {
    if (h.isArchived || h.status === 'archived') continue;

    for (const d of h.completedDates || []) {
      if (isDateKey(d)) {
        const a = at(d);
        a.habitCheckins += 1;
        a.anyRecord = true;
      }
    }
    for (const s of h.readingData?.sessions || []) {
      if (!isDateKey(s.date)) continue;
      const a = at(s.date);
      a.readingSessions += 1;
      a.readingPages += Math.max(0, s.pagesRead || 0);
      a.readingMinutes += Math.max(0, s.durationMinutes || 0);
      a.anyRecord = true;
    }
    for (const s of h.workoutData?.sessions || []) {
      if (!isDateKey(s.date)) continue;
      const a = at(s.date);
      a.workoutSessions += 1;
      a.workoutReps += Math.max(0, s.totalReps || 0);
      a.workoutMinutes += Math.max(0, s.durationMinutes || 0);
      a.anyRecord = true;
    }
    for (const p of h.drawingData?.pieces || []) {
      if (!isDateKey(p.completedDate)) continue;
      const a = at(p.completedDate);
      a.drawingPieces += 1;
      a.drawingMinutes += Math.max(0, p.durationMinutes || 0);
      a.anyRecord = true;
    }
    for (const s of h.quranData?.sessions || []) {
      if (!isDateKey(s.date)) continue;
      const a = at(s.date);
      a.quranSessions += 1;
      a.quranAyahs += Math.max(0, s.ayahCount || 0);
      a.quranMinutes += Math.max(0, s.durationMinutes || 0);
      a.anyRecord = true;
    }
  }

  return map;
}

/** Studio + focus minutes: the "time invested" dimension (excludes tasks, so a
 *  completed task and its logged focus session are never summed together). */
function activeMinutesOf(a: DayAgg | undefined): number {
  if (!a) return 0;
  return a.focusMinutes + a.readingMinutes + a.workoutMinutes + a.drawingMinutes + a.quranMinutes;
}

// ------------------------------------------------------------------ small stats

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function safeRate(done: number, due: number): number | null {
  if (due <= 0) return null;
  return Math.round((done / due) * 100);
}

function buildDelta(current: number, previous: number, hasComparison: boolean): DeltaResult {
  const absolute = round1(current - previous);
  let percent: number | null = null;
  if (hasComparison) {
    if (previous > 0) percent = Math.round(((current - previous) / previous) * 100);
    else if (current > 0) percent = 100;
    else percent = 0;
  }
  const direction: DeltaResult['direction'] = !hasComparison
    ? 'none'
    : absolute > 0
    ? 'up'
    : absolute < 0
    ? 'down'
    : 'flat';
  return { current: round1(current), previous: round1(previous), percent, absolute, direction };
}

/**
 * Pearson correlation coefficient. Returns null when there are fewer than
 * `MIN_CORRELATION_DAYS` pairs or when either series has no variance (a flat line
 * has no correlation to report — that is a missing insight, not a 0).
 */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < MIN_CORRELATION_DAYS) return null;
  const meanX = xs.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const meanY = ys.slice(0, n).reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den <= 0) return null;
  return Math.round((num / den) * 100) / 100;
}

/** Human-readable strength + direction of a Pearson coefficient. */
export function strengthLabel(r: number, isAr: boolean): string {
  const a = Math.abs(r);
  const tierAr = a >= 0.6 ? 'قوي' : a >= 0.35 ? 'متوسط' : a >= 0.15 ? 'ضعيف' : 'مهمل';
  const tierEn = a >= 0.6 ? 'strong' : a >= 0.35 ? 'moderate' : a >= 0.15 ? 'weak' : 'negligible';
  return isAr
    ? `ارتباط ${tierAr} ${r > 0 ? 'طردي' : 'عكسي'}`
    : `${tierEn} ${r > 0 ? 'positive' : 'negative'} correlation`;
}

// ------------------------------------------------------------------ timeline

type Granularity = 'day' | 'week' | 'month';

function chooseGranularity(spec: RangeSpec): Granularity {
  if (spec.range === 'week') return 'day';
  if (spec.range === '30d') return 'day';
  if (spec.range === '90d') return 'week';
  if (spec.range === 'year') return 'month';
  return 'month'; // all
}

/** Group ascending day keys into chart buckets and aggregate each. */
function buildTimeline(
  spec: RangeSpec,
  days: Map<string, DayAgg>,
  habits: Habit[],
  isAr: boolean
): { timeline: TimelinePoint[]; granularity: Granularity } {
  const granularity = chooseGranularity(spec);
  const buckets = new Map<string, string[]>();

  const bucketKeyOf = (key: string): string => {
    if (granularity === 'day') return key;
    if (granularity === 'week') return startOfWeekKey(key);
    return monthKeyOf(key);
  };

  for (const key of spec.currentKeys) {
    const bk = bucketKeyOf(key);
    if (!buckets.has(bk)) buckets.set(bk, []);
    buckets.get(bk)!.push(key);
  }

  const todayKey = spec.endKey;
  const activeHabits = habits.filter((h) => !h.isArchived && h.status !== 'archived' && h.status !== 'paused');

  const timeline: TimelinePoint[] = [];
  for (const [bk, dayKeys] of buckets) {
    let habitDue = 0;
    let habitDone = 0;
    for (const dk of dayKeys) {
      for (const h of activeHabits) {
        const c = habitCompliance(h, [dk]);
        habitDue += c.due;
        habitDone += c.done;
      }
    }

    const agg = dayKeys.reduce(
      (acc, dk) => {
        const a = days.get(dk);
        if (!a) return acc;
        acc.tasksCompleted += a.tasksCompleted;
        acc.tasksScheduled += a.tasksScheduled;
        acc.activeMinutes += activeMinutesOf(a);
        acc.focusMinutes += a.focusMinutes;
        acc.workoutMinutes += a.workoutMinutes;
        acc.workoutReps += a.workoutReps;
        acc.readingPages += a.readingPages;
        acc.quranAyahs += a.quranAyahs;
        acc.recordedDays += a.anyRecord ? 1 : 0;
        return acc;
      },
      {
        tasksCompleted: 0,
        tasksScheduled: 0,
        activeMinutes: 0,
        focusMinutes: 0,
        workoutMinutes: 0,
        workoutReps: 0,
        readingPages: 0,
        quranAyahs: 0,
        recordedDays: 0
      }
    );

    const first = dayKeys[0];
    const last = dayKeys[dayKeys.length - 1];
    // Weekday names are only unambiguous over a single week; longer daily ranges
    // repeat them, so show the day of month instead.
    const label =
      granularity === 'day'
        ? spec.range === 'week'
          ? weekDayLabel(dayOfWeek(first), isAr)
          : String(Number(first.slice(8, 10)))
        : granularity === 'week'
        ? `${first.slice(5)}`
        : monthLabel(bk, isAr);

    timeline.push({
      key: bk,
      label,
      fullLabel:
        granularity === 'day'
          ? first
          : granularity === 'week'
          ? `${first} → ${last}`
          : monthLabel(bk, isAr),
      dayCount: dayKeys.length,
      isPartial: dayKeys[dayKeys.length - 1] === todayKey && granularity !== 'day',
      ...agg,
      habitDue,
      habitDone
    });
  }

  return { timeline, granularity };
}

// ------------------------------------------------------------------ sections

function measureSection(
  spec: RangeSpec,
  days: Map<string, DayAgg>,
  predicate: (a: DayAgg) => boolean,
  valueOf: (a: DayAgg) => number,
  hasAnyHistorically: boolean
): Measured {
  let value = 0;
  let recordedDays = 0;
  for (const key of spec.currentKeys) {
    const a = days.get(key);
    if (a && predicate(a)) {
      recordedDays += 1;
      value += valueOf(a);
    }
  }
  const daysInRange = spec.currentKeys.length;
  return {
    value: hasAnyHistorically ? round1(value) : null,
    recordedDays,
    missingDays: daysInRange - recordedDays,
    daysInRange,
    hasData: hasAnyHistorically
  };
}

function sumOverKeys(
  keys: string[],
  days: Map<string, DayAgg>,
  valueOf: (a: DayAgg) => number
): number {
  return keys.reduce((sum, k) => {
    const a = days.get(k);
    return sum + (a ? valueOf(a) : 0);
  }, 0);
}

// ------------------------------------------------------------------ main

export function computeInsightsReport(
  range: InsightsRange,
  input: InsightsInput,
  isAr: boolean,
  todayKey: string = localDateKey()
): InsightsReport {
  const spec = buildRangeSpec(range, input, todayKey, isAr);
  const days = indexDays(input);
  const { timeline, granularity } = buildTimeline(spec, days, input.habits, isAr);

  const activeHabits = input.habits.filter(
    (h) => !h.isArchived && h.status !== 'archived' && h.status !== 'paused'
  );

  // ---------- record-keeping across the whole window ----------
  let recordedDays = 0;
  for (const key of spec.currentKeys) {
    if (days.get(key)?.anyRecord) recordedDays += 1;
  }
  const daysInRange = spec.currentKeys.length;
  const missingDays = daysInRange - recordedDays;

  // =============================================================== EXECUTION
  const completedTaskIds = new Set<string>();
  for (const t of input.tasks) {
    if (t.status === 'completed' && t.completedAt) {
      const k = localDayFrom(t.completedAt);
      if (isDateKey(k) && spec.currentKeys.includes(k)) completedTaskIds.add(t.id);
    }
  }
  const currentCompleted = completedTaskIds.size;

  const previousCompletedIds = new Set<string>();
  for (const t of input.tasks) {
    if (t.status === 'completed' && t.completedAt) {
      const k = localDayFrom(t.completedAt);
      if (isDateKey(k) && spec.previousKeys.includes(k)) previousCompletedIds.add(t.id);
    }
  }

  const scheduledInRange = input.tasks.filter(
    (t) => t.scheduledDate && isTaskActive(t) && spec.currentKeys.includes(t.scheduledDate)
  ).length;
  const scheduledPrev = input.tasks.filter(
    (t) => t.scheduledDate && isTaskActive(t) && spec.previousKeys.includes(t.scheduledDate)
  ).length;
  const previousCompleted = previousCompletedIds.size;

  const anyTasksHistorically = input.tasks.length > 0;
  const completionRate = scheduledInRange > 0 ? Math.min(100, Math.round((currentCompleted / scheduledInRange) * 100)) : null;
  const previousCompletionRate =
    scheduledPrev > 0 ? Math.min(100, Math.round((previousCompleted / scheduledPrev) * 100)) : null;

  const overdueTasks = input.tasks.filter(
    (t) => isTaskPending(t) && t.scheduledDate && isDateKey(t.scheduledDate) && t.scheduledDate < todayKey
  );
  const ageBucket = (t: Task): number => {
    const days = Math.round(
      (parseDateKey(todayKey)!.getTime() - parseDateKey(t.scheduledDate!)!.getTime()) / 86400000
    );
    return days;
  };
  const overdueAging = [
    { labelAr: '1–3 أيام', labelEn: '1–3 days', count: overdueTasks.filter((t) => ageBucket(t) <= 3).length },
    { labelAr: '4–7 أيام', labelEn: '4–7 days', count: overdueTasks.filter((t) => ageBucket(t) > 3 && ageBucket(t) <= 7).length },
    { labelAr: 'أكثر من أسبوع', labelEn: 'Over a week', count: overdueTasks.filter((t) => ageBucket(t) > 7).length }
  ];

  const topThreeDone = input.tasks.filter(
    (t) => t.isTopThree && t.status === 'completed' && t.completedAt && spec.currentKeys.includes(localDayFrom(t.completedAt))
  ).length;

  const execution: ExecutionSection = {
    hasData: anyTasksHistorically,
    completed: measureSection(
      spec,
      days,
      (a) => a.tasksCompleted > 0,
      (a) => a.tasksCompleted,
      anyTasksHistorically
    ),
    scheduledTotal: scheduledInRange,
    completionRate,
    previousCompletionRate,
    overdueCount: overdueTasks.length,
    overdueAging,
    topThreeDone,
    delta: buildDelta(currentCompleted, previousCompleted, spec.hasComparison)
  };

  // =============================================================== HABITS
  const complianceFor = (keys: string[]) => {
    let due = 0;
    let done = 0;
    for (const h of activeHabits) {
      const c = habitCompliance(h, keys);
      due += c.due;
      done += c.done;
    }
    return { due, done };
  };
  const curCompliance = complianceFor(spec.currentKeys);
  const prevCompliance = complianceFor(spec.previousKeys);
  const adherenceRate = safeRate(curCompliance.done, curCompliance.due);
  const previousAdherenceRate = safeRate(prevCompliance.done, prevCompliance.due);

  const weekdayBuckets = WEEK_DAY_ORDER.map((dow) => ({
    dow,
    labelAr: weekDayLabel(dow, true),
    labelEn: weekDayLabel(dow, false),
    dueCount: 0,
    doneCount: 0
  }));
  const dowIndex = new Map(weekdayBuckets.map((b, i) => [b.dow, i]));
  for (const key of spec.currentKeys) {
    const idx = dowIndex.get(dayOfWeek(key));
    if (idx === undefined) continue;
    for (const h of activeHabits) {
      const c = habitCompliance(h, [key]);
      weekdayBuckets[idx].dueCount += c.due;
      weekdayBuckets[idx].doneCount += c.done;
    }
  }

  const slotDefs: { slot: Habit['timeOfDay']; labelAr: string; labelEn: string }[] = [
    { slot: 'morning', labelAr: 'الصباح', labelEn: 'Morning' },
    { slot: 'afternoon', labelAr: 'الظهيرة', labelEn: 'Afternoon' },
    { slot: 'evening', labelAr: 'المساء', labelEn: 'Evening' },
    { slot: 'anytime', labelAr: 'مرن', labelEn: 'Anytime' }
  ];
  const timeOfDay = slotDefs.map((def) => {
    const slotHabits = activeHabits.filter((h) => h.timeOfDay === def.slot);
    let due = 0;
    let done = 0;
    for (const h of slotHabits) {
      const c = habitCompliance(h, spec.currentKeys);
      due += c.due;
      done += c.done;
    }
    return { ...def, habitsCount: slotHabits.length, dueCount: due, doneCount: done, rate: safeRate(done, due) };
  });

  const habits: HabitsSection = {
    hasData: activeHabits.length > 0,
    activeHabits: activeHabits.length,
    dueDays: curCompliance.due,
    doneDays: curCompliance.done,
    adherenceRate,
    previousAdherenceRate,
    missedDueDays: Math.max(0, curCompliance.due - curCompliance.done),
    longestActiveStreak: activeHabits.reduce((max, h) => Math.max(max, computeCurrentStreak(h, todayKey)), 0),
    bestEverStreak: activeHabits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0),
    delta: buildDelta(adherenceRate ?? 0, previousAdherenceRate ?? 0, spec.hasComparison && adherenceRate !== null),
    weekdayRhythm: weekdayBuckets.map((b) => ({
      ...b,
      rate: safeRate(b.doneCount, b.dueCount)
    })),
    timeOfDay
  };

  // =============================================================== GOALS
  const activeGoals = input.goals.filter((g) => g.status === 'active');
  const evaluated = activeGoals.map((g) => ({ goal: g, intel: evaluateGoalProgress(g, input.tasks, input.habits) }));
  const pacing = {
    ahead: 0,
    on_track: 0,
    behind: 0,
    dormant: 0,
    not_started: 0,
    completed: 0
  };
  for (const { intel } of evaluated) {
    pacing[intel.pacingStatus] = (pacing[intel.pacingStatus] || 0) + 1;
  }
  const avgOutcome =
    evaluated.length > 0
      ? Math.round(evaluated.reduce((s, e) => s + e.intel.outcomeProgressPercent, 0) / evaluated.length)
      : null;
  const avgExecution =
    evaluated.length > 0
      ? Math.round(evaluated.reduce((s, e) => s + e.intel.executionProgressPercent, 0) / evaluated.length)
      : null;

  const milestonesCompletedInRange = input.goals.reduce(
    (sum, g) =>
      sum +
      (g.milestones || []).filter(
        (m) => m.isCompleted && m.completedDate && spec.currentKeys.includes(m.completedDate)
      ).length,
    0
  );
  const milestonesTotal = input.goals.reduce((sum, g) => sum + (g.milestones || []).length, 0);

  const goals: GoalsSection = {
    hasData: input.goals.length > 0,
    activeCount: activeGoals.length,
    avgOutcomePercent: avgOutcome,
    avgExecutionPercent: avgExecution,
    pacing,
    milestonesCompletedInRange,
    milestonesTotal,
    cards: evaluated.map(({ goal, intel }) => ({
      goalId: goal.id,
      title: goal.title,
      category: goal.category,
      outcomePercent: intel.outcomeProgressPercent,
      executionPercent: intel.executionProgressPercent,
      pacingStatus: intel.pacingStatus,
      linkedActivityInRange: intel.contributions.filter((c) => spec.currentKeys.includes(c.date)).length,
      lastActivityDate: intel.lastActivityDate
    }))
  };

  // =============================================================== FOCUS
  const anyFocus = input.focusSessions.length > 0;
  const focusInRange = input.focusSessions.filter(
    (f) => f.completedAt && spec.currentKeys.includes(localDayFrom(f.completedAt))
  );
  const focusMins = focusInRange.reduce((s, f) => s + Math.max(0, f.durationMinutes || 0), 0);
  const focusMinsPrev = input.focusSessions
    .filter((f) => f.completedAt && spec.previousKeys.includes(localDayFrom(f.completedAt)))
    .reduce((s, f) => s + Math.max(0, f.durationMinutes || 0), 0);
  const totalInterruptions = focusInRange.reduce((s, f) => s + (f.interruptionCount || 0), 0);
  const bestDayMinutes = spec.currentKeys.reduce((max, k) => Math.max(max, days.get(k)?.focusMinutes ?? 0), 0);

  const focus: FocusSection = {
    hasData: anyFocus,
    totalMinutes: measureSection(spec, days, (a) => a.focusSessions > 0, (a) => a.focusMinutes, anyFocus),
    sessionsCount: focusInRange.length,
    avgSessionMinutes: focusInRange.length > 0 ? Math.round(focusMins / focusInRange.length) : null,
    totalInterruptions,
    avgInterruptionRate: focusInRange.length > 0 ? round1(totalInterruptions / focusInRange.length) : null,
    avgProductivityScore:
      focusInRange.length > 0
        ? round1(focusInRange.reduce((s, f) => s + (f.productivityScore || 0), 0) / focusInRange.length)
        : null,
    bestDayMinutes,
    delta: buildDelta(focusMins, focusMinsPrev, spec.hasComparison)
  };

  // =============================================================== BODY
  const workoutSessionsAll = input.habits.flatMap((h) => h.workoutData?.sessions || []);
  const anyWorkout = workoutSessionsAll.length > 0;
  const workoutInRange = workoutSessionsAll.filter((s) => spec.currentKeys.includes(s.date));
  const workoutMins = workoutInRange.reduce((s, w) => s + Math.max(0, w.durationMinutes || 0), 0);
  const workoutMinsPrev = workoutSessionsAll
    .filter((s) => spec.previousKeys.includes(s.date))
    .reduce((s, w) => s + Math.max(0, w.durationMinutes || 0), 0);
  const totalReps = workoutInRange.reduce((s, w) => s + Math.max(0, w.totalReps || 0), 0);
  const totalVolumeKg = workoutInRange.reduce((s, w) => s + Math.max(0, w.volumeKg || 0), 0);
  const intensitySamples = workoutInRange.filter((w) => w.intensityRating > 0);
  const avgIntensity =
    intensitySamples.length > 0
      ? round1(intensitySamples.reduce((s, w) => s + w.intensityRating, 0) / intensitySamples.length)
      : null;

  const workoutHabit = input.habits.find((h) => h.specializedType === 'workout' && !h.isArchived);
  const weeklyTargetSessions = workoutHabit?.workoutData?.weeklyTargetSessions || 0;
  // Compare sessions in the window against the target scaled to the window length.
  const weeksInRange = daysInRange / 7;
  const targetSessionsInRange = weeklyTargetSessions > 0 ? Math.round(weeklyTargetSessions * weeksInRange) : 0;
  const consistencyPercent =
    targetSessionsInRange > 0
      ? Math.min(100, Math.round((workoutInRange.length / targetSessionsInRange) * 100))
      : null;

  const movementKeys: { key: string; labelAr: string; labelEn: string }[] = [
    { key: 'push', labelAr: 'دفع', labelEn: 'Push' },
    { key: 'legs', labelAr: 'أرجل', labelEn: 'Legs' },
    { key: 'core', labelAr: 'جذع', labelEn: 'Core' },
    { key: 'back_pull', labelAr: 'سحب', labelEn: 'Pull' },
    { key: 'mobility', labelAr: 'مرونة', labelEn: 'Mobility' },
    { key: 'cardio', labelAr: 'كارديو', labelEn: 'Cardio' }
  ];
  const movementCounts: Record<string, number> = {};
  for (const s of workoutInRange) {
    for (const ex of s.exercises || []) {
      const reps = (ex.sets || []).reduce((sum, st) => sum + (st.completed ? st.reps : 0), 0);
      const mv = ex.movement || 'push';
      movementCounts[mv] = (movementCounts[mv] || 0) + (reps > 0 ? reps : 0);
    }
  }
  const movementTotal = Object.values(movementCounts).reduce((a, b) => a + b, 0);
  const movementDistribution = movementKeys.map((m) => ({
    ...m,
    reps: movementCounts[m.key] || 0,
    percent: movementTotal > 0 ? Math.round(((movementCounts[m.key] || 0) / movementTotal) * 100) : 0
  }));

  const body: BodySection = {
    hasData: anyWorkout,
    sessionsCount: workoutInRange.length,
    totalMinutes: measureSection(spec, days, (a) => a.workoutSessions > 0, (a) => a.workoutMinutes, anyWorkout),
    totalReps,
    totalVolumeKg: round1(totalVolumeKg),
    avgIntensity,
    weeklyTargetSessions,
    consistencyPercent,
    movementDistribution,
    delta: buildDelta(workoutMins, workoutMinsPrev, spec.hasComparison)
  };

  // =============================================================== LEARNING
  const readingSessionsAll = input.habits.flatMap((h) => h.readingData?.sessions || []);
  const anyReading = readingSessionsAll.length > 0 || input.habits.some((h) => (h.readingData?.books?.length || 0) > 0);
  const readingInRange = readingSessionsAll.filter((s) => spec.currentKeys.includes(s.date));
  const pagesRead = readingInRange.reduce((s, r) => s + Math.max(0, r.pagesRead || 0), 0);
  const pagesPrev = readingSessionsAll
    .filter((s) => spec.previousKeys.includes(s.date))
    .reduce((s, r) => s + Math.max(0, r.pagesRead || 0), 0);
  const readingMinutes = readingInRange.reduce((s, r) => s + Math.max(0, r.durationMinutes || 0), 0);
  const speedSamples = readingInRange.filter((s) => s.speedPagesPerHour > 0);
  const avgSpeed =
    speedSamples.length > 0
      ? Math.round(speedSamples.reduce((s, r) => s + r.speedPagesPerHour, 0) / speedSamples.length)
      : null;
  const booksFinishedInRange = input.habits.reduce(
    (sum, h) =>
      sum +
      (h.readingData?.books || []).filter((b) => b.completedDate && spec.currentKeys.includes(b.completedDate)).length,
    0
  );

  const learning: LearningSection = {
    hasData: anyReading,
    pagesRead: measureSection(spec, days, (a) => a.readingSessions > 0, (a) => a.readingPages, anyReading),
    totalMinutes: readingMinutes,
    sessionsCount: readingInRange.length,
    booksFinishedInRange,
    avgSpeedPagesPerHour: avgSpeed,
    delta: buildDelta(pagesRead, pagesPrev, spec.hasComparison)
  };

  // =============================================================== FAITH
  const quranSessionsAll = input.habits.flatMap((h) => h.quranData?.sessions || []);
  const anyQuran = quranSessionsAll.length > 0;
  const quranInRange = quranSessionsAll.filter((s) => spec.currentKeys.includes(s.date));
  const ayahsInRange = quranInRange.reduce((s, q) => s + Math.max(0, q.ayahCount || 0), 0);
  const ayahsPrev = quranSessionsAll
    .filter((s) => spec.previousKeys.includes(s.date))
    .reduce((s, q) => s + Math.max(0, q.ayahCount || 0), 0);
  const quranMinutes = quranInRange.reduce((s, q) => s + Math.max(0, q.durationMinutes || 0), 0);
  const distinctSurahs = new Set(quranInRange.map((s) => s.surahNumber)).size;
  const qualityDefs: { key: string; labelAr: string; labelEn: string }[] = [
    { key: 'excellent', labelAr: 'ممتاز', labelEn: 'Excellent' },
    { key: 'very_good', labelAr: 'جيد جداً', labelEn: 'Very good' },
    { key: 'good', labelAr: 'جيد', labelEn: 'Good' },
    { key: 'needs_reinforcement', labelAr: 'يحتاج تثبيتاً', labelEn: 'Needs reinforcement' }
  ];
  const qualityBreakdown = qualityDefs.map((q) => ({
    ...q,
    count: quranInRange.filter((s) => s.quality === q.key).length
  }));

  const faith: FaithSection = {
    hasData: anyQuran,
    ayahsInRange: measureSection(spec, days, (a) => a.quranSessions > 0, (a) => a.quranAyahs, anyQuran),
    sessionsCount: quranInRange.length,
    totalMinutes: quranMinutes,
    distinctSurahs,
    qualityBreakdown,
    delta: buildDelta(ayahsInRange, ayahsPrev, spec.hasComparison)
  };

  // =============================================================== FINANCE
  const anyFinance = input.expenses.length > 0 || input.savingsGoals.length > 0;
  const expenseInRange = input.expenses.filter((e) => spec.currentKeys.includes(e.date));
  const income = expenseInRange.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = expenseInRange.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const savingsCurrent = input.savingsGoals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const savingsTarget = input.savingsGoals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const catTotals = new Map<string, number>();
  for (const e of expenseInRange.filter((x) => x.type === 'expense')) {
    catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amount);
  }
  const topCategories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount: round1(amount),
      sharePercent: expense > 0 ? Math.round((amount / expense) * 100) : 0
    }));

  const monthKeys: string[] = [];
  for (const key of spec.currentKeys) {
    const mk = monthKeyOf(key);
    if (monthKeys[monthKeys.length - 1] !== mk) monthKeys.push(mk);
  }
  const monthlyTrend = monthKeys.map((mk) => {
    const inMonth = input.expenses.filter((e) => monthKeyOf(e.date) === mk);
    const inc = inMonth.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const exp = inMonth.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { key: mk, label: monthLabel(mk, isAr), income: round1(inc), expense: round1(exp), net: round1(inc - exp) };
  });

  const finance: FinanceSection = {
    hasData: anyFinance,
    income: round1(income),
    expense: round1(expense),
    net: round1(income - expense),
    savingsCurrent: round1(savingsCurrent),
    savingsTarget: round1(savingsTarget),
    savingsPercent: savingsTarget > 0 ? Math.min(100, Math.round((savingsCurrent / savingsTarget) * 100)) : null,
    topCategories,
    monthlyTrend
  };

  // =============================================================== CORRELATIONS
  const correlations: CorrelationResult[] = [];

  // 1. Daily active minutes vs daily task completion rate.
  {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const key of spec.currentKeys) {
      const a = days.get(key);
      if (!a) continue;
      const scheduled = a.tasksScheduled;
      if (scheduled <= 0) continue;
      xs.push(activeMinutesOf(a));
      ys.push(Math.min(100, Math.round((a.tasksCompleted / scheduled) * 100)));
    }
    const r = pearson(xs, ys);
    correlations.push({
      id: 'activity-vs-taskrate',
      titleAr: 'الوقت المستثمر مقابل إنجاز المهام',
      titleEn: 'Invested time vs task completion',
      r,
      n: xs.length,
      available: r !== null,
      interpretationAr:
        r !== null
          ? `${strengthLabel(r, true)} بين دقائق النشاط ونسبة إنجاز المهام عبر ${xs.length} يوماً.`
          : `لا يوجد ارتباط موثوق: نحتاج ${MIN_CORRELATION_DAYS} أيام على الأقل بها مهام مجدولة وتباين في القيم.`,
      interpretationEn:
        r !== null
          ? `${strengthLabel(r, false)} between active minutes and task completion across ${xs.length} days.`
          : `Not enough data: at least ${MIN_CORRELATION_DAYS} days with scheduled tasks and varying values are required.`
    });
  }

  // 2. Sleep hours vs next-day focus minutes.
  {
    const xs: number[] = [];
    const ys: number[] = [];
    const sortedKeys = [...spec.currentKeys].sort();
    for (let i = 0; i < sortedKeys.length - 1; i++) {
      const sleepKey = sortedKeys[i];
      const nextKey = sortedKeys[i + 1];
      const sleep = input.healthMetrics[sleepKey]?.sleepHours ?? 0;
      if (sleep <= 0) continue;
      const nextFocus = days.get(nextKey)?.focusMinutes ?? 0;
      xs.push(sleep);
      ys.push(nextFocus);
    }
    const r = pearson(xs, ys);
    correlations.push({
      id: 'sleep-vs-nextfocus',
      titleAr: 'ساعات النوم مقابل تركيز اليوم التالي',
      titleEn: 'Sleep hours vs next-day focus',
      r,
      n: xs.length,
      available: r !== null,
      interpretationAr:
        r !== null
          ? `${strengthLabel(r, true)} بين ساعات النوم ودقائق التركيز في اليوم التالي عبر ${xs.length} ليلة موثقة.`
          : `لا يوجد ارتباط موثوق: نحتاج ${MIN_CORRELATION_DAYS} ليلة نوم موثقة على الأقل مع تباين في القيم.`,
      interpretationEn:
        r !== null
          ? `${strengthLabel(r, false)} between sleep hours and next-day focus minutes across ${xs.length} logged nights.`
          : `Not enough data: at least ${MIN_CORRELATION_DAYS} logged nights with varying values are required.`
    });
  }

  return {
    range,
    rangeLabelAr: spec.labelAr,
    rangeLabelEn: spec.labelEn,
    currentStartKey: spec.startKey,
    currentEndKey: spec.endKey,
    previousLabelAr: spec.previousLabelAr,
    previousLabelEn: spec.previousLabelEn,
    hasComparison: spec.hasComparison,
    daysInRange,
    recordedDays,
    missingDays,
    isEmptyWindow: recordedDays === 0,
    timeline,
    timelineGranularity: granularity,
    execution,
    habits,
    goals,
    focus,
    body,
    learning,
    faith,
    finance,
    correlations
  };
}
