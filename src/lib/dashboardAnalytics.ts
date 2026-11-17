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
import { evaluateGoalProgress, GoalIntelligenceSummary } from './goalProgressEngine';
import { habitCompliance, isHabitDueOn } from './habitSchedule';
import { isTaskActive, isTaskDone, isTaskPending } from './taskStatus';
import { WEEK_DAY_ORDER, weekDayLabel, indexFromWeekStart, dayOfWeek } from './week';

export interface DashboardAnalyticsInput {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  healthMetrics: Record<string, HealthMetric>;
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoal[];
  journalEntries: JournalEntry[];
  energyScore: number;
}

export type TrendMetricId =
  | 'activeMinutes'
  | 'tasksCompleted'
  | 'habitConsistency'
  | 'focusMinutes'
  | 'readingPages'
  | 'workoutReps'
  | 'quranAyahs';

export type TrendRangeId = '7d' | '30d' | '90d' | 'year';

export interface DashboardKPIs {
  performance: {
    hasData: boolean;
    todayDone: number;
    todayScheduled: number;
    rate7d: number | null;
    priorRate7d: number | null;
    deltaPts: number | null;
    completed7d: number;
    overdueCount: number;
    spark7d: Array<number | null>;
  };
  consistency: {
    hasData: boolean;
    activeHabitsCount: number;
    todayDone: number;
    todayDue: number;
    rate7d: number | null;
    priorRate7d: number | null;
    deltaPts: number | null;
    bestStreak: number;
    spark7d: Array<number | null>;
  };
  goalProgress: {
    hasData: boolean;
    activeGoalsCount: number;
    avgOutcomePercent: number | null;
    avgExecutionPercent: number | null;
    milestonesDone: number;
    milestonesTotal: number;
    behindOrDormantCount: number;
  };
  momentum: {
    hasData: boolean;
    todayActiveMinutes: number;
    minutes7d: number;
    priorMinutes7d: number;
    deltaPct: number | null;
    focusMinutesToday: number;
    energyLoggedToday: boolean;
    energyScore: number;
    spark7d: Array<number | null>;
  };
}

export interface TrendBucketAnnotation {
  kind: 'milestone' | 'peak';
  labelAr: string;
  labelEn: string;
}

export interface TrendBucketPoint {
  key: string;
  label: string;
  fullDateLabel: string;
  currentValue: number | null;
  previousValue: number | null;
  rollingAvg: number | null;
  isToday: boolean;
  activitiesCount: number;
  breakdownAr?: string;
  breakdownEn?: string;
  annotation?: TrendBucketAnnotation;
}

export interface PerformanceTrendResult {
  metric: TrendMetricId;
  range: TrendRangeId;
  unitAr: string;
  unitEn: string;
  isPercentage: boolean;
  hasAnyData: boolean;
  hasComparisonData: boolean;
  recordedBucketsCount: number;
  missingBucketsCount: number;
  points: TrendBucketPoint[];
  currentTotalOrAvg: number | null;
  previousTotalOrAvg: number | null;
  deltaPercent: number | null;
  targetValue: number | null;
  targetLabelAr: string | null;
  targetLabelEn: string | null;
  todayIndex: number;
}

export type HeatmapDayState = 'completed' | 'missed' | 'rest' | 'missing' | 'future';

export interface HeatmapDayCell {
  dateKey: string;
  state: HeatmapDayState;
  count: number;
  minutes: number;
  dueHabitsCount: number;
  doneHabitsCount: number;
  scheduledTasksCount: number;
  doneTasksCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
  summaryAr: string;
  summaryEn: string;
}

export interface SecondaryAnalyticsResult {
  hasData: boolean;
  hasScheduleOrHistory: boolean;
  weeks: HeatmapDayCell[][];
  activeDaysLast30: number;
  priorActiveDays30: number;
  activeDaysDelta: number;
  currentActiveStreak: number;
  peakDay: { dateKey: string; count: number; minutes: number } | null;
  avgActiveMinutes30: number | null;
  completions30: number;
  priorCompletions30: number;
}

export type LifeDomainId = 'faith' | 'learning' | 'health' | 'creative' | 'finance' | 'personal';

export interface LifeDomainCardData {
  id: LifeDomainId;
  navTab: 'quran' | 'reading' | 'health' | 'workout' | 'drawing' | 'finance' | 'habits' | 'goals';
  accentColor: string;
  titleAr: string;
  titleEn: string;
  hasData: boolean;
  primaryValue: string;
  primaryLabelAr: string;
  primaryLabelEn: string;
  secondaryValue: string;
  progressPercent: number | null;
  progressCaptionAr: string;
  progressCaptionEn: string;
  emptyHintAr: string;
  emptyHintEn: string;
}

export interface GoalMilestoneOverview {
  goal: Goal;
  summary: GoalIntelligenceSummary;
  nextMilestoneTitle: string | null;
  nextMilestoneDate: string | null;
}

export interface LifeConnectionLink {
  id: string;
  sourceType: 'domain' | 'goal' | 'habit';
  sourceId: string;
  sourceLabel: string;
  targetType: 'goal' | 'habit' | 'task' | 'book' | 'art';
  targetId: string;
  targetLabel: string;
  relationAr: string;
  relationEn: string;
  accentColor: string;
}

export interface LifeConnectionGroup {
  goal: Goal;
  summary: GoalIntelligenceSummary;
  domainColor: string;
  linkedHabitNames: string[];
  linkedTaskCount: number;
  linkedTaskDoneCount: number;
  linkedBookNames: string[];
  linkedArtNames: string[];
  totalWeight: number;
}

export interface LifeConnectionsData {
  hasConnections: boolean;
  totalLinksCount: number;
  connectedGoalsCount: number;
  activeGoalsCount: number;
  habitStacksCount: number;
  groups: LifeConnectionGroup[];
  habitStacks: Array<{ id: string; parentName: string; childName: string; category: Habit['category'] }>;
}

const DOMAIN_COLORS: Record<LifeDomainId, string> = {
  faith: 'var(--d-quran-accent)',
  learning: 'var(--d-reading-accent)',
  health: 'var(--d-workout-accent)',
  creative: 'var(--d-drawing-accent)',
  finance: 'var(--blue)',
  personal: 'var(--brand-strong)'
};

function goalCategoryColor(category: Goal['category']): string {
  switch (category) {
    case 'health':
      return 'var(--d-workout-accent)';
    case 'intellect':
      return 'var(--d-reading-accent)';
    case 'finance':
      return 'var(--blue)';
    case 'career':
      return 'var(--d-drawing-accent)';
    case 'personal':
    default:
      return 'var(--brand-strong)';
  }
}

function getActiveHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => !h.isArchived && h.status !== 'archived' && h.status !== 'paused');
}

function getActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter(isTaskActive);
}

function buildDailyKeyRange(endKey: string, length: number): string[] {
  const keys: string[] = [];
  for (let i = length - 1; i >= 0; i--) {
    keys.push(addDaysToKey(endKey, -i));
  }
  return keys;
}

interface DailyAggregates {
  tasksDone: number;
  tasksScheduled: number;
  focusSessionsCount: number;
  focusMinutes: number;
  readingSessionsCount: number;
  readingPages: number;
  readingMinutes: number;
  workoutSessionsCount: number;
  workoutReps: number;
  workoutMinutes: number;
  drawingPiecesCount: number;
  drawingMinutes: number;
  quranSessionsCount: number;
  quranAyahs: number;
  quranMinutes: number;
  habitCheckins: number;
}

function createEmptyAgg(): DailyAggregates {
  return {
    tasksDone: 0,
    tasksScheduled: 0,
    focusSessionsCount: 0,
    focusMinutes: 0,
    readingSessionsCount: 0,
    readingPages: 0,
    readingMinutes: 0,
    workoutSessionsCount: 0,
    workoutReps: 0,
    workoutMinutes: 0,
    drawingPiecesCount: 0,
    drawingMinutes: 0,
    quranSessionsCount: 0,
    quranAyahs: 0,
    quranMinutes: 0,
    habitCheckins: 0
  };
}

function indexDailyAggregates(input: DashboardAnalyticsInput): Map<string, DailyAggregates> {
  const map = new Map<string, DailyAggregates>();
  const ensure = (key: string): DailyAggregates => {
    let existing = map.get(key);
    if (!existing) {
      existing = createEmptyAgg();
      map.set(key, existing);
    }
    return existing;
  };

  for (const t of getActiveTasks(input.tasks)) {
    if (t.scheduledDate && isDateKey(t.scheduledDate)) {
      ensure(t.scheduledDate).tasksScheduled += 1;
    }
    if (t.status === 'completed' && t.completedAt) {
      const key = localDayFrom(t.completedAt);
      if (isDateKey(key)) ensure(key).tasksDone += 1;
    }
  }

  for (const s of input.focusSessions) {
    if (s.completedAt) {
      const key = localDayFrom(s.completedAt);
      if (isDateKey(key)) {
        const agg = ensure(key);
        agg.focusSessionsCount += 1;
        agg.focusMinutes += Math.max(0, s.durationMinutes || 0);
      }
    }
  }

  for (const h of input.habits) {
    if (h.isArchived || h.status === 'archived') continue;

    for (const d of h.completedDates || []) {
      if (isDateKey(d)) ensure(d).habitCheckins += 1;
    }

    if (h.readingData?.sessions) {
      for (const s of h.readingData.sessions) {
        if (isDateKey(s.date)) {
          const agg = ensure(s.date);
          agg.readingSessionsCount += 1;
          agg.readingPages += Math.max(0, s.pagesRead || 0);
          agg.readingMinutes += Math.max(0, s.durationMinutes || 0);
        }
      }
    }

    if (h.workoutData?.sessions) {
      for (const s of h.workoutData.sessions) {
        if (isDateKey(s.date)) {
          const agg = ensure(s.date);
          agg.workoutSessionsCount += 1;
          agg.workoutReps += Math.max(0, s.totalReps || 0);
          agg.workoutMinutes += Math.max(0, s.durationMinutes || 0);
        }
      }
    }

    if (h.drawingData?.pieces) {
      for (const p of h.drawingData.pieces) {
        if (isDateKey(p.completedDate)) {
          const agg = ensure(p.completedDate);
          agg.drawingPiecesCount += 1;
          agg.drawingMinutes += Math.max(0, p.durationMinutes || 0);
        }
      }
    }

    if (h.quranData?.sessions) {
      for (const s of h.quranData.sessions) {
        if (isDateKey(s.date)) {
          const agg = ensure(s.date);
          agg.quranSessionsCount += 1;
          agg.quranAyahs += Math.max(0, s.ayahCount || 0);
          agg.quranMinutes += Math.max(0, s.durationMinutes || 0);
        }
      }
    }
  }

  return map;
}

function aggActiveMinutes(agg: DailyAggregates | undefined): number {
  if (!agg) return 0;
  return (
    agg.focusMinutes +
    agg.readingMinutes +
    agg.workoutMinutes +
    agg.drawingMinutes +
    agg.quranMinutes
  );
}

export function computeDashboardKPIs(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): DashboardKPIs {
  const dailyMap = indexDailyAggregates(input);
  const activeTasks = getActiveTasks(input.tasks);
  const activeHabits = getActiveHabits(input.habits);
  const activeGoals = input.goals.filter((g) => g.status === 'active');

  // 1. Performance (Task completion, kept strictly distinct from habits/goals)
  const todayTasks = activeTasks.filter(
    (t) =>
      t.scheduledDate === todayKey ||
      (t.status === 'completed' && t.completedAt && localDayFrom(t.completedAt) === todayKey)
  );
  const todayDone = todayTasks.filter(isTaskDone).length;
  const overdueCount = activeTasks.filter(
    (t) => isTaskPending(t) && Boolean(t.scheduledDate) && t.scheduledDate! < todayKey
  ).length;

  const last7Keys = buildDailyKeyRange(todayKey, 7);
  const prior7Keys = buildDailyKeyRange(addDaysToKey(todayKey, -7), 7);
  const last7Set = new Set(last7Keys);
  const prior7Set = new Set(prior7Keys);

  const inWindow = (t: Task, win: Set<string>) => {
    const doneDay = isTaskDone(t) && t.completedAt ? localDayFrom(t.completedAt) : null;
    if (doneDay && win.has(doneDay)) return true;
    if (t.scheduledDate && win.has(t.scheduledDate)) return true;
    return false;
  };

  const tasks7d = activeTasks.filter((t) => inWindow(t, last7Set));
  const done7d = tasks7d.filter(isTaskDone).length;
  const rate7d = tasks7d.length > 0 ? Math.round((done7d / tasks7d.length) * 100) : null;

  const priorTasks7d = activeTasks.filter((t) => inWindow(t, prior7Set));
  const priorDone7d = priorTasks7d.filter(isTaskDone).length;
  const priorRate7d = priorTasks7d.length > 0 ? Math.round((priorDone7d / priorTasks7d.length) * 100) : null;

  // 2. Consistency (Habit compliance via habitSchedule)
  const todayDueHabits = activeHabits.filter((h) => isHabitDueOn(h, todayKey));
  const todayHabitsDone = activeHabits.filter((h) => (h.completedDates || []).includes(todayKey)).length;

  const c7 = activeHabits.reduce(
    (acc, h) => {
      const res = habitCompliance(h, last7Keys);
      return { due: acc.due + res.due, done: acc.done + res.done };
    },
    { due: 0, done: 0 }
  );
  const p7 = activeHabits.reduce(
    (acc, h) => {
      const res = habitCompliance(h, prior7Keys);
      return { due: acc.due + res.due, done: acc.done + res.done };
    },
    { due: 0, done: 0 }
  );

  const habitRate7d = c7.due > 0 ? Math.round((c7.done / c7.due) * 100) : null;
  const priorHabitRate7d = p7.due > 0 ? Math.round((p7.done / p7.due) * 100) : null;
  const bestStreak = activeHabits.reduce((max, h) => Math.max(max, h.currentStreak || 0), 0);

  // 3. Goal Progress (Actual outcome vs execution via goalProgressEngine)
  const evaluatedGoals = activeGoals.map((g) => evaluateGoalProgress(g, input.tasks, input.habits));
  const avgOutcomePercent =
    evaluatedGoals.length > 0
      ? Math.round(evaluatedGoals.reduce((sum, g) => sum + g.outcomeProgressPercent, 0) / evaluatedGoals.length)
      : null;
  const avgExecutionPercent =
    evaluatedGoals.length > 0
      ? Math.round(evaluatedGoals.reduce((sum, g) => sum + g.executionProgressPercent, 0) / evaluatedGoals.length)
      : null;
  const milestonesDone = evaluatedGoals.reduce((s, g) => s + g.milestonesCompleted, 0);
  const milestonesTotal = evaluatedGoals.reduce((s, g) => s + g.milestonesTotal, 0);
  const behindOrDormantCount = evaluatedGoals.filter(
    (g) => g.pacingStatus === 'behind' || g.pacingStatus === 'dormant' || g.isOverdue
  ).length;

  // 4. Momentum (Active minutes + logged focus/recovery)
  const todayAgg = dailyMap.get(todayKey);
  const todayActiveMinutes = aggActiveMinutes(todayAgg);
  const minutes7d = last7Keys.reduce((s, k) => s + aggActiveMinutes(dailyMap.get(k)), 0);
  const priorMinutes7d = prior7Keys.reduce((s, k) => s + aggActiveMinutes(dailyMap.get(k)), 0);
  const deltaPct =
    priorMinutes7d > 0 ? Math.round(((minutes7d - priorMinutes7d) / priorMinutes7d) * 100) : null;

  const todayHealth = input.healthMetrics[todayKey];
  const energyLoggedToday = Boolean(
    todayHealth &&
      (todayHealth.sleepHours > 0 ||
        todayHealth.hydrationMl > 0 ||
        todayHealth.moodRating > 0 ||
        todayHealth.workoutLogged)
  );

  const perfSpark7d: Array<number | null> = last7Keys.map((k) => {
    const agg = dailyMap.get(k);
    if (!agg) return null;
    if (agg.tasksDone === 0 && agg.tasksScheduled === 0) return null;
    return agg.tasksDone;
  });

  const consSpark7d: Array<number | null> = last7Keys.map((k) => {
    if (activeHabits.length === 0) return null;
    let due = 0;
    let done = 0;
    for (const h of activeHabits) {
      const c = habitCompliance(h, [k]);
      due += c.due;
      done += c.done;
    }
    return due > 0 ? Math.round((done / due) * 100) : null;
  });

  const momSpark7d: Array<number | null> = last7Keys.map((k) => {
    const agg = dailyMap.get(k);
    if (!agg) return null;
    const timedRecords =
      agg.focusSessionsCount +
      agg.readingSessionsCount +
      agg.workoutSessionsCount +
      agg.drawingPiecesCount +
      agg.quranSessionsCount;
    return timedRecords > 0 ? aggActiveMinutes(agg) : null;
  });

  return {
    performance: {
      hasData: activeTasks.length > 0,
      todayDone,
      todayScheduled: todayTasks.length,
      rate7d,
      priorRate7d,
      deltaPts: rate7d !== null && priorRate7d !== null ? rate7d - priorRate7d : null,
      completed7d: done7d,
      overdueCount,
      spark7d: perfSpark7d
    },
    consistency: {
      hasData: activeHabits.length > 0,
      activeHabitsCount: activeHabits.length,
      todayDone: todayHabitsDone,
      todayDue: todayDueHabits.length,
      rate7d: habitRate7d,
      priorRate7d: priorHabitRate7d,
      deltaPts: habitRate7d !== null && priorHabitRate7d !== null ? habitRate7d - priorHabitRate7d : null,
      bestStreak,
      spark7d: consSpark7d
    },
    goalProgress: {
      hasData: activeGoals.length > 0,
      activeGoalsCount: activeGoals.length,
      avgOutcomePercent,
      avgExecutionPercent,
      milestonesDone,
      milestonesTotal,
      behindOrDormantCount
    },
    momentum: {
      hasData: minutes7d > 0 || priorMinutes7d > 0 || energyLoggedToday,
      todayActiveMinutes,
      minutes7d,
      priorMinutes7d,
      deltaPct,
      focusMinutesToday: todayAgg?.focusMinutes || 0,
      energyLoggedToday,
      energyScore: input.energyScore,
      spark7d: momSpark7d
    }
  };
}

function formatDayShort(key: string, isAr: boolean): string {
  const dt = parseDateKey(key);
  if (!dt) return key;
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric'
  }).format(dt);
}

function formatWeekdayShort(key: string, isAr: boolean): string {
  const dt = parseDateKey(key);
  if (!dt) return key;
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'short'
  }).format(dt);
}

function formatMonthShort(year: number, monthIndex: number, isAr: boolean): string {
  const dt = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
    month: 'short',
    year: '2-digit'
  }).format(dt);
}

function metricMetadata(metric: TrendMetricId): { unitAr: string; unitEn: string; isPercentage: boolean } {
  switch (metric) {
    case 'activeMinutes':
    case 'focusMinutes':
      return { unitAr: 'د', unitEn: 'm', isPercentage: false };
    case 'tasksCompleted':
      return { unitAr: 'مهمة', unitEn: 'tasks', isPercentage: false };
    case 'habitConsistency':
      return { unitAr: '%', unitEn: '%', isPercentage: true };
    case 'readingPages':
      return { unitAr: 'ص', unitEn: 'pg', isPercentage: false };
    case 'workoutReps':
      return { unitAr: 'تكرار', unitEn: 'reps', isPercentage: false };
    case 'quranAyahs':
      return { unitAr: 'آية', unitEn: 'ayahs', isPercentage: false };
  }
}

function evaluateBucketMetric(
  metric: TrendMetricId,
  dayKeys: string[],
  dailyMap: Map<string, DailyAggregates>,
  activeHabits: Habit[]
): { value: number | null; activitiesCount: number; breakdownAr?: string; breakdownEn?: string } {
  if (dayKeys.length === 0) {
    return { value: null, activitiesCount: 0 };
  }

  if (metric === 'habitConsistency') {
    if (activeHabits.length === 0) return { value: null, activitiesCount: 0 };
    let due = 0;
    let done = 0;
    for (const h of activeHabits) {
      const c = habitCompliance(h, dayKeys);
      due += c.due;
      done += c.done;
    }
    if (due === 0) return { value: null, activitiesCount: 0 };
    return {
      value: Math.round((done / due) * 100),
      activitiesCount: done,
      breakdownAr: `${done} من ${due} مستحقة`,
      breakdownEn: `${done}/${due} due`
    };
  }

  let total = 0;
  let activities = 0;
  let hasRecordInBucket = false;

  let focusMins = 0;
  let readingMins = 0;
  let workoutMins = 0;
  let drawingMins = 0;
  let quranMins = 0;
  let scheduledTasks = 0;

  for (const k of dayKeys) {
    const agg = dailyMap.get(k);
    if (!agg) continue;

    switch (metric) {
      case 'activeMinutes': {
        const timedRecords =
          agg.focusSessionsCount +
          agg.readingSessionsCount +
          agg.workoutSessionsCount +
          agg.drawingPiecesCount +
          agg.quranSessionsCount;
        if (timedRecords > 0) {
          hasRecordInBucket = true;
          focusMins += agg.focusMinutes;
          readingMins += agg.readingMinutes;
          workoutMins += agg.workoutMinutes;
          drawingMins += agg.drawingMinutes;
          quranMins += agg.quranMinutes;
          total += aggActiveMinutes(agg);
          activities += timedRecords;
        }
        break;
      }
      case 'focusMinutes':
        if (agg.focusSessionsCount > 0) {
          hasRecordInBucket = true;
          total += agg.focusMinutes;
          activities += agg.focusSessionsCount;
        }
        break;
      case 'tasksCompleted':
        if (agg.tasksDone > 0 || agg.tasksScheduled > 0) {
          hasRecordInBucket = true;
          total += agg.tasksDone;
          scheduledTasks += agg.tasksScheduled;
          activities += agg.tasksDone;
        }
        break;
      case 'readingPages':
        if (agg.readingSessionsCount > 0) {
          hasRecordInBucket = true;
          total += agg.readingPages;
          activities += agg.readingSessionsCount;
        }
        break;
      case 'workoutReps':
        if (agg.workoutSessionsCount > 0) {
          hasRecordInBucket = true;
          total += agg.workoutReps;
          activities += agg.workoutSessionsCount;
        }
        break;
      case 'quranAyahs':
        if (agg.quranSessionsCount > 0) {
          hasRecordInBucket = true;
          total += agg.quranAyahs;
          activities += agg.quranSessionsCount;
        }
        break;
    }
  }

  if (!hasRecordInBucket) {
    return { value: null, activitiesCount: 0 };
  }

  let breakdownAr: string | undefined;
  let breakdownEn: string | undefined;
  if (metric === 'activeMinutes') {
    const partsAr: string[] = [];
    const partsEn: string[] = [];
    if (focusMins > 0) {
      partsAr.push(`تركيز ${focusMins}د`);
      partsEn.push(`Focus ${focusMins}m`);
    }
    if (readingMins > 0) {
      partsAr.push(`قراءة ${readingMins}د`);
      partsEn.push(`Reading ${readingMins}m`);
    }
    if (workoutMins > 0) {
      partsAr.push(`تمرين ${workoutMins}د`);
      partsEn.push(`Workout ${workoutMins}m`);
    }
    if (drawingMins > 0) {
      partsAr.push(`رسم ${drawingMins}د`);
      partsEn.push(`Art ${drawingMins}m`);
    }
    if (quranMins > 0) {
      partsAr.push(`قرآن ${quranMins}د`);
      partsEn.push(`Quran ${quranMins}m`);
    }
    if (partsAr.length > 0) {
      breakdownAr = partsAr.join(' · ');
      breakdownEn = partsEn.join(' · ');
    }
  } else if (metric === 'tasksCompleted' && scheduledTasks > 0) {
    breakdownAr = `${total} من ${scheduledTasks} مجدولة`;
    breakdownEn = `${total}/${scheduledTasks} scheduled`;
  }

  return { value: total, activitiesCount: activities, breakdownAr, breakdownEn };
}

function resolveMetricTarget(
  metric: TrendMetricId,
  range: TrendRangeId,
  habits: Habit[]
): { value: number | null; labelAr: string | null; labelEn: string | null } {
  if (metric === 'readingPages') {
    const reading = habits.find((h) => h.specializedType === 'reading' && !h.isArchived);
    const daily = reading?.readingData?.dailyTargetPages;
    const weekly = reading?.readingData?.weeklyTargetPages;
    if (range === '7d' || range === '30d') {
      if (daily && daily > 0) {
        return {
          value: daily,
          labelAr: `الهدف اليومي (${daily} ص)`,
          labelEn: `Daily target (${daily} pg)`
        };
      }
    } else if (range === '90d') {
      const wk = weekly && weekly > 0 ? weekly : daily && daily > 0 ? daily * 7 : null;
      if (wk) {
        return {
          value: wk,
          labelAr: `الهدف الأسبوعي (${wk} ص)`,
          labelEn: `Weekly target (${wk} pg)`
        };
      }
    } else if (range === 'year') {
      const mo = daily && daily > 0 ? daily * 30 : weekly && weekly > 0 ? weekly * 4 : null;
      if (mo) {
        return {
          value: mo,
          labelAr: `وتيرة الهدف الشهري (${mo} ص)`,
          labelEn: `Monthly pace (${mo} pg)`
        };
      }
    }
  }

  if (metric === 'quranAyahs') {
    const quran = habits.find((h) => h.specializedType === 'quran' && !h.isArchived);
    const daily = quran?.quranData?.dailyTargetAyahs || quran?.quranData?.revisionSchedule?.targetDailyAyahs;
    if (daily && daily > 0) {
      if (range === '7d' || range === '30d') {
        return {
          value: daily,
          labelAr: `الورد اليومي (${daily} آية)`,
          labelEn: `Daily target (${daily} ayahs)`
        };
      }
      if (range === '90d') {
        return {
          value: daily * 7,
          labelAr: `الورد الأسبوعي (${daily * 7} آية)`,
          labelEn: `Weekly target (${daily * 7} ayahs)`
        };
      }
      return {
        value: daily * 30,
        labelAr: `الورد الشهري (${daily * 30} آية)`,
        labelEn: `Monthly pace (${daily * 30} ayahs)`
      };
    }
  }

  if (metric === 'workoutReps') {
    const workout = habits.find((h) => h.specializedType === 'workout' && !h.isArchived);
    const monthlyReps = workout?.workoutData?.monthlyTargetReps;
    if (monthlyReps && monthlyReps > 0 && range === 'year') {
      return {
        value: monthlyReps,
        labelAr: `الهدف الشهري (${monthlyReps})`,
        labelEn: `Monthly target (${monthlyReps})`
      };
    }
  }

  return { value: null, labelAr: null, labelEn: null };
}

export function buildPerformanceTrend(
  input: DashboardAnalyticsInput,
  metric: TrendMetricId,
  range: TrendRangeId,
  isAr: boolean,
  todayKey: string = localDateKey()
): PerformanceTrendResult {
  const dailyMap = indexDailyAggregates(input);
  const activeHabits = getActiveHabits(input.habits);
  const meta = metricMetadata(metric);

  const buckets: { key: string; label: string; fullDateLabel: string; curDays: string[]; prevDays: string[]; isToday: boolean }[] = [];

  if (range === '7d') {
    const curKeys = buildDailyKeyRange(todayKey, 7);
    const prevKeys = buildDailyKeyRange(addDaysToKey(todayKey, -7), 7);
    for (let i = 0; i < 7; i++) {
      const k = curKeys[i];
      buckets.push({
        key: k,
        label: formatWeekdayShort(k, isAr),
        fullDateLabel: formatDayShort(k, isAr),
        curDays: [k],
        prevDays: [prevKeys[i]],
        isToday: k === todayKey
      });
    }
  } else if (range === '30d') {
    const curKeys = buildDailyKeyRange(todayKey, 30);
    const prevKeys = buildDailyKeyRange(addDaysToKey(todayKey, -30), 30);
    for (let i = 0; i < 30; i++) {
      const k = curKeys[i];
      buckets.push({
        key: k,
        label: formatDayShort(k, isAr),
        fullDateLabel: formatDayShort(k, isAr),
        curDays: [k],
        prevDays: [prevKeys[i]],
        isToday: k === todayKey
      });
    }
  } else if (range === '90d') {
    // 13 weekly buckets (91 days) ending today
    const weekCount = 13;
    for (let w = weekCount - 1; w >= 0; w--) {
      const endOffset = -(w * 7);
      const curEnd = addDaysToKey(todayKey, endOffset);
      const curDays = buildDailyKeyRange(curEnd, 7);
      const prevEnd = addDaysToKey(curEnd, -(weekCount * 7));
      const prevDays = buildDailyKeyRange(prevEnd, 7);
      const startShort = formatDayShort(curDays[0], isAr);
      const endShort = formatDayShort(curEnd, isAr);
      buckets.push({
        key: curDays[0],
        label: startShort,
        fullDateLabel: `${startShort} – ${endShort}`,
        curDays,
        prevDays,
        isToday: w === 0
      });
    }
  } else {
    // 12 trailing calendar months ending on the month containing todayKey
    const todayDt = parseDateKey(todayKey) || new Date();
    const curYear = todayDt.getFullYear();
    const curMonth = todayDt.getMonth();

    const monthDayKeys = (year: number, monthIndex: number): string[] => {
      const keys: string[] = [];
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const k = localDateKey(new Date(year, monthIndex, day));
        if (k <= todayKey) keys.push(k);
      }
      return keys;
    };

    for (let m = 11; m >= 0; m--) {
      const dCur = new Date(curYear, curMonth - m, 1);
      const dPrev = new Date(dCur.getFullYear() - 1, dCur.getMonth(), 1);
      const monthLabel = formatMonthShort(dCur.getFullYear(), dCur.getMonth(), isAr);
      const curDays = monthDayKeys(dCur.getFullYear(), dCur.getMonth());
      const prevDays = monthDayKeys(dPrev.getFullYear(), dPrev.getMonth());
      buckets.push({
        key: `${dCur.getFullYear()}-${String(dCur.getMonth() + 1).padStart(2, '0')}`,
        label: monthLabel,
        fullDateLabel: monthLabel,
        curDays,
        prevDays,
        isToday: m === 0
      });
    }
  }

  const milestoneByDay = new Map<string, string[]>();
  for (const g of input.goals) {
    for (const m of g.milestones || []) {
      if (m.isCompleted && m.completedDate && isDateKey(m.completedDate)) {
        const list = milestoneByDay.get(m.completedDate) || [];
        list.push(m.title);
        milestoneByDay.set(m.completedDate, list);
      }
    }
  }

  const rawPoints = buckets.map((b) => {
    const cur = evaluateBucketMetric(metric, b.curDays, dailyMap, activeHabits);
    const prev = evaluateBucketMetric(metric, b.prevDays, dailyMap, activeHabits);
    const hitMilestones = b.curDays.flatMap((d) => milestoneByDay.get(d) || []);
    const annotation: TrendBucketAnnotation | undefined =
      hitMilestones.length > 0
        ? {
            kind: 'milestone',
            labelAr: `معلم: ${hitMilestones[0]}`,
            labelEn: `Milestone: ${hitMilestones[0]}`
          }
        : undefined;
    return {
      key: b.key,
      label: b.label,
      fullDateLabel: b.fullDateLabel,
      currentValue: cur.value,
      previousValue: prev.value,
      isToday: b.isToday,
      activitiesCount: cur.activitiesCount,
      breakdownAr: cur.breakdownAr,
      breakdownEn: cur.breakdownEn,
      annotation
    };
  });

  // Mark peak recorded bucket when >= 2 recorded buckets exist (unless milestone already occupies the spot)
  const validCurIndices = rawPoints
    .map((p, idx) => (p.currentValue !== null ? idx : -1))
    .filter((i) => i >= 0);

  if (validCurIndices.length >= 2) {
    let peakIdx = validCurIndices[0];
    for (const idx of validCurIndices) {
      if ((rawPoints[idx].currentValue ?? 0) > (rawPoints[peakIdx].currentValue ?? 0)) {
        peakIdx = idx;
      }
    }
    if ((rawPoints[peakIdx].currentValue ?? 0) > 0 && !rawPoints[peakIdx].annotation) {
      rawPoints[peakIdx].annotation = {
        kind: 'peak',
        labelAr: `ذروة الفترة (${rawPoints[peakIdx].currentValue})`,
        labelEn: `Period peak (${rawPoints[peakIdx].currentValue})`
      };
    }
  }

  // Trailing moving average over recorded buckets only (null if point itself is null or <2 valid points in window)
  const maWindow = range === '7d' ? 3 : 5;
  const points: TrendBucketPoint[] = rawPoints.map((pt, idx) => {
    if (pt.currentValue === null) {
      return { ...pt, rollingAvg: null };
    }
    const winStart = Math.max(0, idx - maWindow + 1);
    const vals: number[] = [];
    for (let j = winStart; j <= idx; j++) {
      const v = rawPoints[j].currentValue;
      if (v !== null) vals.push(v);
    }
    const rollingAvg =
      vals.length >= 2 ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null;
    return { ...pt, rollingAvg };
  });

  const validCur = points.map((p) => p.currentValue).filter((v): v is number => v !== null);
  const validPrev = points.map((p) => p.previousValue).filter((v): v is number => v !== null);

  const hasAnyData = validCur.length > 0;
  const hasComparisonData = validPrev.length > 0;

  let currentTotalOrAvg: number | null = null;
  let previousTotalOrAvg: number | null = null;
  let deltaPercent: number | null = null;

  if (meta.isPercentage) {
    // True aggregate compliance over whole window (weighted by due days, not average of bucket percentages)
    const allCurDays = buckets.flatMap((b) => b.curDays);
    const allPrevDays = buckets.flatMap((b) => b.prevDays);
    currentTotalOrAvg = evaluateBucketMetric(metric, allCurDays, dailyMap, activeHabits).value;
    previousTotalOrAvg = evaluateBucketMetric(metric, allPrevDays, dailyMap, activeHabits).value;
    if (currentTotalOrAvg !== null && previousTotalOrAvg !== null) {
      deltaPercent = currentTotalOrAvg - previousTotalOrAvg; // percentage points
    }
  } else {
    currentTotalOrAvg = validCur.length > 0 ? validCur.reduce((s, v) => s + v, 0) : null;
    previousTotalOrAvg = validPrev.length > 0 ? validPrev.reduce((s, v) => s + v, 0) : null;
    if (currentTotalOrAvg !== null && previousTotalOrAvg !== null && previousTotalOrAvg > 0) {
      deltaPercent = Math.round(((currentTotalOrAvg - previousTotalOrAvg) / previousTotalOrAvg) * 100);
    }
  }

  const target = resolveMetricTarget(metric, range, input.habits);
  const todayIndex = points.findIndex((p) => p.isToday);

  return {
    metric,
    range,
    unitAr: meta.unitAr,
    unitEn: meta.unitEn,
    isPercentage: meta.isPercentage,
    hasAnyData,
    hasComparisonData,
    recordedBucketsCount: validCur.length,
    missingBucketsCount: points.length - validCur.length,
    points,
    currentTotalOrAvg,
    previousTotalOrAvg,
    deltaPercent,
    targetValue: target.value,
    targetLabelAr: target.labelAr,
    targetLabelEn: target.labelEn,
    todayIndex: todayIndex >= 0 ? todayIndex : points.length - 1
  };
}

export function buildSecondaryAnalytics(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): SecondaryAnalyticsResult {
  const dailyMap = indexDailyAggregates(input);
  const activeHabits = getActiveHabits(input.habits);
  const activeTasks = getActiveTasks(input.tasks);

  // Determine earliest date with any stored tracking record so days prior to onboarding
  // are accurately classified as "missing / insufficient data" rather than "missed".
  const trackingDates: string[] = [];
  for (const k of dailyMap.keys()) trackingDates.push(k);
  for (const h of activeHabits) {
    if (h.createdAt) {
      const d = localDayFrom(h.createdAt);
      if (isDateKey(d)) trackingDates.push(d);
    }
  }
  for (const t of activeTasks) {
    if (t.createdAt) {
      const d = localDayFrom(t.createdAt);
      if (isDateKey(d)) trackingDates.push(d);
    }
    if (t.scheduledDate && isDateKey(t.scheduledDate)) trackingDates.push(t.scheduledDate);
  }
  for (const k of Object.keys(input.healthMetrics || {})) {
    if (isDateKey(k)) trackingDates.push(k);
  }
  for (const j of input.journalEntries || []) {
    if (isDateKey(j.date)) trackingDates.push(j.date);
  }
  const earliestTrackedDate = trackingDates.length > 0 ? trackingDates.sort()[0] : null;

  // Build 14 full weeks (98 days) aligned so each column is Sat..Fri (7 rows),
  // matching NUQTA's Saturday-start week.
  const weekEndFriday = addDaysToKey(todayKey, 6 - indexFromWeekStart(todayKey));
  const totalWeeks = 14;
  const gridStartKey = addDaysToKey(weekEndFriday, -(totalWeeks * 7 - 1));

  const countsForScale: number[] = [];
  interface RawCell {
    dateKey: string;
    state: HeatmapDayState;
    count: number;
    minutes: number;
    dueHabitsCount: number;
    doneHabitsCount: number;
    scheduledTasksCount: number;
    doneTasksCount: number;
    isToday: boolean;
    isFuture: boolean;
    isFrozenDay: boolean;
  }
  const rawCells: RawCell[] = [];

  for (let i = 0; i < totalWeeks * 7; i++) {
    const dateKey = addDaysToKey(gridStartKey, i);
    const isFuture = dateKey > todayKey;
    const isToday = dateKey === todayKey;
    const agg = isFuture ? undefined : dailyMap.get(dateKey);
    const minutes = aggActiveMinutes(agg);
    const count = agg
      ? agg.tasksDone +
        agg.habitCheckins +
        agg.focusSessionsCount +
        agg.readingSessionsCount +
        agg.workoutSessionsCount +
        agg.drawingPiecesCount +
        agg.quranSessionsCount
      : 0;

    // Respect each habit's own schedule (frequency, customDays, createdAt, freezesUsedDates)
    const dueHabits = isFuture ? [] : activeHabits.filter((h) => isHabitDueOn(h, dateKey));
    const doneHabits = isFuture
      ? []
      : activeHabits.filter((h) => (h.completedDates || []).includes(dateKey));
    const isFrozenDay =
      !isFuture && activeHabits.some((h) => (h.freezesUsedDates || []).includes(dateKey));
    const existedHabits = isFuture
      ? []
      : activeHabits.filter((h) => {
          if (!h.createdAt) return true;
          const created = localDayFrom(h.createdAt);
          return !isDateKey(created) || dateKey >= created;
        });

    const scheduledTasksCount = agg?.tasksScheduled || 0;
    const doneTasksCount = agg?.tasksDone || 0;

    let state: HeatmapDayState;
    if (isFuture) {
      state = 'future';
    } else if (count > 0 || minutes > 0) {
      state = 'completed';
      countsForScale.push(count > 0 ? count : 1);
    } else if (dueHabits.length > 0 || scheduledTasksCount > 0) {
      state = 'missed';
    } else if (
      earliestTrackedDate !== null &&
      dateKey >= earliestTrackedDate &&
      (existedHabits.length > 0 || isFrozenDay || Boolean(input.healthMetrics[dateKey]))
    ) {
      state = 'rest';
    } else {
      state = 'missing';
    }

    rawCells.push({
      dateKey,
      state,
      count,
      minutes,
      dueHabitsCount: dueHabits.length,
      doneHabitsCount: doneHabits.length,
      scheduledTasksCount,
      doneTasksCount,
      isToday,
      isFuture,
      isFrozenDay
    });
  }

  const maxCount = countsForScale.length > 0 ? Math.max(...countsForScale) : 0;

  const toLevel = (cell: RawCell): 0 | 1 | 2 | 3 | 4 => {
    if (cell.state !== 'completed' || maxCount === 0) return 0;
    const effective = Math.max(1, cell.count);
    const ratio = effective / maxCount;
    if (ratio >= 0.78) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  };

  const weeks: HeatmapDayCell[][] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const col: HeatmapDayCell[] = [];
    for (let r = 0; r < 7; r++) {
      const cell = rawCells[w * 7 + r];
      let summaryAr = '';
      let summaryEn = '';

      switch (cell.state) {
        case 'future':
          summaryAr = 'يوم قادم';
          summaryEn = 'Upcoming day';
          break;
        case 'missing':
          summaryAr = 'بيانات غير متوفرة (قبل بدء التتبع)';
          summaryEn = 'No tracking data';
          break;
        case 'rest':
          summaryAr = cell.isFrozenDay
            ? 'يوم راحة / تجميد سلسلة'
            : 'يوم راحة (لا توجد عادات مجدولة)';
          summaryEn = cell.isFrozenDay
            ? 'Rest / Streak freeze'
            : 'Rest day (no habits scheduled)';
          break;
        case 'missed': {
          const partsAr: string[] = [];
          const partsEn: string[] = [];
          if (cell.dueHabitsCount > 0) {
            partsAr.push(`${cell.dueHabitsCount} عادات`);
            partsEn.push(`${cell.dueHabitsCount} habits`);
          }
          if (cell.scheduledTasksCount > 0) {
            partsAr.push(`${cell.scheduledTasksCount} مهام`);
            partsEn.push(`${cell.scheduledTasksCount} tasks`);
          }
          summaryAr = cell.isToday
            ? `مجدول اليوم (قيد التنفيذ): ${partsAr.join(' · ')}`
            : `نشاط مجدول فائت: ${partsAr.join(' · ')}`;
          summaryEn = cell.isToday
            ? `Scheduled today (pending): ${partsEn.join(' · ')}`
            : `Missed scheduled: ${partsEn.join(' · ')}`;
          break;
        }
        case 'completed': {
          const partsAr: string[] = [];
          const partsEn: string[] = [];
          if (cell.dueHabitsCount > 0 || cell.doneHabitsCount > 0) {
            partsAr.push(
              cell.dueHabitsCount > 0
                ? `${cell.doneHabitsCount}/${cell.dueHabitsCount} عادات`
                : `${cell.doneHabitsCount} عادات`
            );
            partsEn.push(
              cell.dueHabitsCount > 0
                ? `${cell.doneHabitsCount}/${cell.dueHabitsCount} habits`
                : `${cell.doneHabitsCount} habits`
            );
          }
          if (cell.doneTasksCount > 0) {
            partsAr.push(`${cell.doneTasksCount} مهام`);
            partsEn.push(`${cell.doneTasksCount} tasks`);
          }
          if (cell.minutes > 0) {
            partsAr.push(`${cell.minutes}د`);
            partsEn.push(`${cell.minutes}m`);
          }
          summaryAr = `مكتمل: ${partsAr.join(' · ') || `${cell.count} نشاط`}`;
          summaryEn = `Completed: ${partsEn.join(' · ') || `${cell.count} activities`}`;
          break;
        }
      }

      col.push({
        dateKey: cell.dateKey,
        state: cell.state,
        count: cell.count,
        minutes: cell.minutes,
        dueHabitsCount: cell.dueHabitsCount,
        doneHabitsCount: cell.doneHabitsCount,
        scheduledTasksCount: cell.scheduledTasksCount,
        doneTasksCount: cell.doneTasksCount,
        level: toLevel(cell),
        isToday: cell.isToday,
        isFuture: cell.isFuture,
        summaryAr,
        summaryEn
      });
    }
    weeks.push(col);
  }

  const last30Keys = buildDailyKeyRange(todayKey, 30);
  const prior30Keys = buildDailyKeyRange(addDaysToKey(todayKey, -30), 30);

  let activeDaysLast30 = 0;
  let totalMinutes30 = 0;
  let completions30 = 0;
  for (const k of last30Keys) {
    const agg = dailyMap.get(k);
    const mins = aggActiveMinutes(agg);
    const c = agg ? agg.tasksDone + agg.habitCheckins : 0;
    if (mins > 0 || c > 0) {
      activeDaysLast30 += 1;
      totalMinutes30 += mins;
    }
    completions30 += c;
  }

  let priorActiveDays30 = 0;
  let priorCompletions30 = 0;
  for (const k of prior30Keys) {
    const agg = dailyMap.get(k);
    const mins = aggActiveMinutes(agg);
    const c = agg ? agg.tasksDone + agg.habitCheckins : 0;
    if (mins > 0 || c > 0) priorActiveDays30 += 1;
    priorCompletions30 += c;
  }

  // Current consecutive active-day streak (allowing today to still be in progress,
  // and skipping scheduled rest days so rest days don't break a habit-schedule streak)
  let currentActiveStreak = 0;
  const startCheckOffset = (() => {
    const todayAgg = dailyMap.get(todayKey);
    const hasToday = aggActiveMinutes(todayAgg) > 0 || (todayAgg ? todayAgg.tasksDone + todayAgg.habitCheckins > 0 : false);
    return hasToday ? 0 : -1;
  })();
  for (let i = 0; i < 120; i++) {
    const k = addDaysToKey(todayKey, startCheckOffset - i);
    const agg = dailyMap.get(k);
    const active = aggActiveMinutes(agg) > 0 || (agg ? agg.tasksDone + agg.habitCheckins > 0 : false);
    if (active) currentActiveStreak += 1;
    else break;
  }

  const completedCells = rawCells.filter((c) => c.state === 'completed');
  const peakCell =
    completedCells.length > 0
      ? completedCells.reduce((best, cur) => (cur.count > best.count ? cur : best), completedCells[0])
      : null;

  return {
    hasData: completedCells.length > 0,
    hasScheduleOrHistory: rawCells.some((c) => c.state !== 'missing' && c.state !== 'future'),
    weeks,
    activeDaysLast30,
    priorActiveDays30,
    activeDaysDelta: activeDaysLast30 - priorActiveDays30,
    currentActiveStreak,
    peakDay: peakCell ? { dateKey: peakCell.dateKey, count: peakCell.count, minutes: peakCell.minutes } : null,
    avgActiveMinutes30: activeDaysLast30 > 0 ? Math.round(totalMinutes30 / activeDaysLast30) : null,
    completions30,
    priorCompletions30
  };
}

export function buildLifeDomains(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): LifeDomainCardData[] {
  const last7Keys = new Set(buildDailyKeyRange(todayKey, 7));
  const last30Keys = new Set(buildDailyKeyRange(todayKey, 30));

  // 1. Faith (Quran Studio)
  const quranHabit = input.habits.find((h) => h.specializedType === 'quran' && !h.isArchived);
  const quranData = quranHabit?.quranData;
  const quranSessions7d = (quranData?.sessions || []).filter((s) => last7Keys.has(s.date));
  const quranAyahsToday = (quranData?.sessions || [])
    .filter((s) => s.date === todayKey)
    .reduce((s, x) => s + (x.ayahCount || 0), 0);
  const quranTarget = quranData?.dailyTargetAyahs || quranData?.revisionSchedule?.targetDailyAyahs || 0;
  const totalAyahsMemorized = quranData?.totalAyahsMemorized || 0;
  const hasFaith = Boolean(
    quranHabit && (totalAyahsMemorized > 0 || (quranData?.sessions?.length || 0) > 0)
  );
  const faithPct =
    quranTarget > 0
      ? Math.min(100, Math.round((quranAyahsToday / quranTarget) * 100))
      : totalAyahsMemorized > 0
      ? Math.min(100, Math.max(1, Math.round((totalAyahsMemorized / 6236) * 100)))
      : null;

  // 2. Learning (Reading Studio + intellect goals)
  const readingHabit = input.habits.find((h) => h.specializedType === 'reading' && !h.isArchived);
  const readingData = readingHabit?.readingData;
  const books = (readingData?.books || []).filter((b) => b.status !== 'archived');
  const activeBook = books.find((b) => b.id === readingData?.activeBookId) || books.find((b) => b.status === 'reading');
  const pages7d = (readingData?.sessions || [])
    .filter((s) => last7Keys.has(s.date))
    .reduce((sum, s) => sum + (s.pagesRead || 0), 0);
  const completedBooksCount = books.filter((b) => b.status === 'completed').length;
  const hasLearning = Boolean(
    books.length > 0 || (readingData?.sessions?.length || 0) > 0 || (readingData?.totalPagesRead || 0) > 0
  );
  const bookPct =
    activeBook && activeBook.totalPages > 0
      ? Math.min(100, Math.round((activeBook.currentPage / activeBook.totalPages) * 100))
      : readingData?.annualTargetBooks && readingData.annualTargetBooks > 0 && completedBooksCount > 0
      ? Math.min(100, Math.round((completedBooksCount / readingData.annualTargetBooks) * 100))
      : null;

  // 3. Health (Workout Studio + Today Health Metrics)
  const workoutHabit = input.habits.find((h) => h.specializedType === 'workout' && !h.isArchived);
  const workoutData = workoutHabit?.workoutData;
  const workoutSessions7d = (workoutData?.sessions || []).filter((s) => last7Keys.has(s.date));
  const targetWeeklyWorkouts = workoutData?.weeklyTargetSessions || 0;
  const todayHealth = input.healthMetrics[todayKey];
  const hasHealthToday = Boolean(
    todayHealth &&
      (todayHealth.sleepHours > 0 || todayHealth.hydrationMl > 0 || todayHealth.workoutLogged || todayHealth.moodRating > 0)
  );
  const hasHealth = Boolean(
    workoutSessions7d.length > 0 || (workoutData?.totalWorkouts || 0) > 0 || hasHealthToday
  );
  const healthPct =
    targetWeeklyWorkouts > 0
      ? Math.min(100, Math.round((workoutSessions7d.length / targetWeeklyWorkouts) * 100))
      : todayHealth && todayHealth.targetHydrationMl > 0 && todayHealth.hydrationMl > 0
      ? Math.min(100, Math.round((todayHealth.hydrationMl / todayHealth.targetHydrationMl) * 100))
      : null;

  // 4. Creative (Art / Drawing Studio)
  const drawingHabit = input.habits.find((h) => h.specializedType === 'drawing' && !h.isArchived);
  const drawingData = drawingHabit?.drawingData;
  const artProjects = (drawingData?.projects || []).filter((p) => !p.isArchived && p.stage !== 'archived');
  const pieces7d = (drawingData?.pieces || []).filter((p) => last7Keys.has(p.completedDate));
  const mins7dDraw = pieces7d.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
  const targetDrawMins = (drawingData?.weeklyTargetHours || 0) * 60;
  const hasCreative = Boolean(
    artProjects.length > 0 || (drawingData?.pieces?.length || 0) > 0 || (drawingData?.totalDrawingMinutes || 0) > 0
  );
  const creativePct =
    targetDrawMins > 0
      ? Math.min(100, Math.round((mins7dDraw / targetDrawMins) * 100))
      : artProjects.length > 0
      ? Math.round((artProjects.filter((p) => p.stage === 'completed').length / artProjects.length) * 100)
      : null;

  // 5. Finance (30D cashflow + Savings goals)
  const expenses30 = input.expenses.filter((e) => last30Keys.has(e.date));
  const income30 = expenses30.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const spent30 = expenses30.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalSaved = input.savingsGoals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const totalTarget = input.savingsGoals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const hasFinance = input.expenses.length > 0 || input.savingsGoals.length > 0;
  const financePct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : null;

  // 6. Personal (General habits + Journal + Personal Goals)
  const generalHabits = getActiveHabits(input.habits).filter(
    (h) => !h.specializedType || h.specializedType === 'standard'
  );
  const last7Arr = Array.from(last7Keys);
  const genCompliance = generalHabits.reduce(
    (acc, h) => {
      const c = habitCompliance(h, last7Arr);
      return { due: acc.due + c.due, done: acc.done + c.done };
    },
    { due: 0, done: 0 }
  );
  const journals30 = input.journalEntries.filter((j) => last30Keys.has(j.date)).length;
  const personalGoals = input.goals.filter((g) => g.status === 'active' && (g.category === 'personal' || g.category === 'career'));
  const hasPersonal = generalHabits.length > 0 || input.journalEntries.length > 0 || personalGoals.length > 0;
  const personalPct = genCompliance.due > 0 ? Math.round((genCompliance.done / genCompliance.due) * 100) : null;

  return [
    {
      id: 'faith',
      navTab: 'quran',
      accentColor: DOMAIN_COLORS.faith,
      titleAr: 'الإيمان والقرآن',
      titleEn: 'Faith',
      hasData: hasFaith,
      primaryValue: hasFaith ? `${totalAyahsMemorized}` : '—',
      primaryLabelAr: 'آية محفوظة',
      primaryLabelEn: 'ayahs memorized',
      secondaryValue: hasFaith
        ? `${quranSessions7d.length} · 7D`
        : '—',
      progressPercent: faithPct,
      progressCaptionAr:
        quranTarget > 0 ? `ورد اليوم ${quranAyahsToday}/${quranTarget} آية` : `${quranData?.totalSurahsCompleted || 0} سورة مكتملة`,
      progressCaptionEn:
        quranTarget > 0 ? `Today ${quranAyahsToday}/${quranTarget} ayahs` : `${quranData?.totalSurahsCompleted || 0} surahs done`,
      emptyHintAr: 'افتح استوديو القرآن لتسجيل أول جلسة',
      emptyHintEn: 'Open Quran Studio to log a session'
    },
    {
      id: 'learning',
      navTab: 'reading',
      accentColor: DOMAIN_COLORS.learning,
      titleAr: 'التعلم والقراءة',
      titleEn: 'Learning',
      hasData: hasLearning,
      primaryValue: hasLearning ? `${pages7d}` : '—',
      primaryLabelAr: 'صفحة (7 أيام)',
      primaryLabelEn: 'pages (7D)',
      secondaryValue: activeBook ? activeBook.title : `${completedBooksCount}`,
      progressPercent: bookPct,
      progressCaptionAr: activeBook
        ? `${activeBook.currentPage}/${activeBook.totalPages} ص`
        : `${completedBooksCount} كتب مكتملة`,
      progressCaptionEn: activeBook
        ? `${activeBook.currentPage}/${activeBook.totalPages} pg`
        : `${completedBooksCount} books finished`,
      emptyHintAr: 'أضف كتاباً أو سجل قراءة في الخزانة',
      emptyHintEn: 'Add a book in Reading Vault'
    },
    {
      id: 'health',
      navTab: workoutHabit ? 'workout' : 'health',
      accentColor: DOMAIN_COLORS.health,
      titleAr: 'الصحة واللياقة',
      titleEn: 'Health',
      hasData: hasHealth,
      primaryValue: hasHealth
        ? targetWeeklyWorkouts > 0
          ? `${workoutSessions7d.length}/${targetWeeklyWorkouts}`
          : todayHealth && todayHealth.sleepHours > 0
          ? `${todayHealth.sleepHours}h`
          : `${workoutSessions7d.length}`
        : '—',
      primaryLabelAr: targetWeeklyWorkouts > 0 ? 'حصص هذا الأسبوع' : todayHealth?.sleepHours ? 'نوم اليوم' : 'حصص (7 أيام)',
      primaryLabelEn: targetWeeklyWorkouts > 0 ? 'workouts this week' : todayHealth?.sleepHours ? 'sleep today' : 'workouts (7D)',
      secondaryValue: todayHealth && todayHealth.hydrationMl > 0 ? `${Math.round(todayHealth.hydrationMl / 100) / 10}L` : `${workoutData?.totalMinutes || 0}m`,
      progressPercent: healthPct,
      progressCaptionAr: todayHealth?.sleepHours ? `نوم ${todayHealth.sleepHours} س · ماء ${todayHealth.hydrationMl} مل` : `${workoutData?.totalWorkouts || 0} حصة موثقة`,
      progressCaptionEn: todayHealth?.sleepHours ? `${todayHealth.sleepHours}h sleep · ${todayHealth.hydrationMl}ml` : `${workoutData?.totalWorkouts || 0} logged workouts`,
      emptyHintAr: 'سجل النوم، الماء أو حصة تمرين',
      emptyHintEn: 'Log sleep, hydration, or a workout'
    },
    {
      id: 'creative',
      navTab: 'drawing',
      accentColor: DOMAIN_COLORS.creative,
      titleAr: 'الإبداع والفن',
      titleEn: 'Creative',
      hasData: hasCreative,
      primaryValue: hasCreative ? `${Math.round((mins7dDraw / 60) * 10) / 10}h` : '—',
      primaryLabelAr: 'تدفق فني (7 أيام)',
      primaryLabelEn: 'studio flow (7D)',
      secondaryValue: `${artProjects.length}`,
      progressPercent: creativePct,
      progressCaptionAr: `${artProjects.length} مشاريع · ${drawingData?.pieces?.length || 0} أعمال`,
      progressCaptionEn: `${artProjects.length} projects · ${drawingData?.pieces?.length || 0} pieces`,
      emptyHintAr: 'ابدأ مشروعاً فنياً في المرسم',
      emptyHintEn: 'Start a piece in Art Studio'
    },
    {
      id: 'finance',
      navTab: 'finance',
      accentColor: DOMAIN_COLORS.finance,
      titleAr: 'المال والادخار',
      titleEn: 'Finance',
      hasData: hasFinance,
      primaryValue: hasFinance ? `${(income30 - spent30).toLocaleString()}` : '—',
      primaryLabelAr: 'صافي 30 يوماً',
      primaryLabelEn: '30D net flow',
      secondaryValue: `${input.savingsGoals.length}`,
      progressPercent: financePct,
      progressCaptionAr:
        totalTarget > 0
          ? `مدخرات ${totalSaved.toLocaleString()} / ${totalTarget.toLocaleString()}`
          : `${expenses30.length} حركة في 30 يوماً`,
      progressCaptionEn:
        totalTarget > 0
          ? `Saved ${totalSaved.toLocaleString()} / ${totalTarget.toLocaleString()}`
          : `${expenses30.length} entries in 30D`,
      emptyHintAr: 'أضف مصروفاً أو هدف ادخار للمتابعة',
      emptyHintEn: 'Add a transaction or savings goal'
    },
    {
      id: 'personal',
      navTab: 'habits',
      accentColor: DOMAIN_COLORS.personal,
      titleAr: 'الشخصي والتأمل',
      titleEn: 'Personal',
      hasData: hasPersonal,
      primaryValue: personalPct !== null ? `${personalPct}%` : hasPersonal ? `${journals30}` : '—',
      primaryLabelAr: personalPct !== null ? 'التزام العادات (7 أيام)' : 'تدوينات (30 يوماً)',
      primaryLabelEn: personalPct !== null ? 'habit rate (7D)' : 'journal (30D)',
      secondaryValue: `${personalGoals.length}`,
      progressPercent: personalPct,
      progressCaptionAr: `${generalHabits.length} عادات · ${journals30} تدوينات شهرية`,
      progressCaptionEn: `${generalHabits.length} habits · ${journals30} entries (30D)`,
      emptyHintAr: 'أنشئ عادة يومية أو اكتب تدوينة',
      emptyHintEn: 'Create a daily habit or journal note'
    }
  ];
}

export function buildGoalsOverview(input: DashboardAnalyticsInput): GoalMilestoneOverview[] {
  const activeGoals = input.goals.filter((g) => g.status === 'active');
  return activeGoals
    .map((goal) => {
      const summary = evaluateGoalProgress(goal, input.tasks, input.habits);
      const nextMilestone = (goal.milestones || []).find((m) => !m.isCompleted);
      return {
        goal,
        summary,
        nextMilestoneTitle: nextMilestone?.title || null,
        nextMilestoneDate: nextMilestone?.targetDate || null
      };
    })
    .sort((a, b) => {
      // Upcoming deadline first, then progress descending
      if (a.goal.deadline && b.goal.deadline) return a.goal.deadline.localeCompare(b.goal.deadline);
      if (a.goal.deadline) return -1;
      if (b.goal.deadline) return 1;
      return b.summary.overallProgressPercent - a.summary.overallProgressPercent;
    });
}

export function buildLifeConnections(input: DashboardAnalyticsInput): LifeConnectionsData {
  const activeGoals = input.goals.filter((g) => g.status === 'active');
  const activeHabits = getActiveHabits(input.habits);
  const activeTasks = getActiveTasks(input.tasks);

  const groups: LifeConnectionGroup[] = [];
  let totalLinksCount = 0;

  for (const goal of activeGoals) {
    const summary = evaluateGoalProgress(goal, input.tasks, input.habits);
    const listedTasks = new Set(goal.linkedTaskIds || []);
    const linkedTasks = activeTasks.filter((t) =>
      t.linkedGoalId !== undefined ? t.linkedGoalId === goal.id : listedTasks.has(t.id)
    );
    const listedHabits = new Set(goal.linkedHabitIds || []);
    const linkedHabits = activeHabits.filter((h) =>
      h.linkedGoalId !== undefined ? h.linkedGoalId === goal.id : listedHabits.has(h.id)
    );

    const linkedBookIds = new Set(goal.linkedBookIds || []);
    const linkedHabitIds = new Set(linkedHabits.map((h) => h.id));
    const bookTitles = new Set<string>();
    const artTitles = new Set<string>();
    const artIds = new Set(goal.linkedArtProjectIds || []);

    for (const h of activeHabits) {
      for (const b of h.readingData?.books || []) {
        if (linkedBookIds.has(b.id) || b.linkedGoalId === goal.id || linkedHabitIds.has(h.id)) {
          bookTitles.add(b.title);
        }
      }
      for (const p of h.drawingData?.projects || []) {
        if (artIds.has(p.id) || p.linkedGoalId === goal.id || linkedHabitIds.has(h.id)) {
          artTitles.add(p.title);
        }
      }
    }

    const weight = linkedHabits.length + linkedTasks.length + bookTitles.size + artTitles.size;
    if (weight > 0) {
      totalLinksCount += weight;
      groups.push({
        goal,
        summary,
        domainColor: goalCategoryColor(goal.category),
        linkedHabitNames: linkedHabits.map((h) => h.name),
        linkedTaskCount: linkedTasks.length,
        linkedTaskDoneCount: linkedTasks.filter((t) => t.status === 'completed').length,
        linkedBookNames: Array.from(bookTitles),
        linkedArtNames: Array.from(artTitles),
        totalWeight: weight
      });
    }
  }

  // Habit stacking chains
  const habitById = new Map(activeHabits.map((h) => [h.id, h]));
  const habitStacks: LifeConnectionsData['habitStacks'] = [];
  for (const h of activeHabits) {
    if (h.stackParentHabitId) {
      const parent = habitById.get(h.stackParentHabitId);
      if (parent) {
        habitStacks.push({
          id: `${parent.id}->${h.id}`,
          parentName: parent.name,
          childName: h.name,
          category: h.category
        });
        totalLinksCount += 1;
      }
    }
  }

  groups.sort((a, b) => b.totalWeight - a.totalWeight);

  return {
    hasConnections: totalLinksCount > 0,
    totalLinksCount,
    connectedGoalsCount: groups.length,
    activeGoalsCount: activeGoals.length,
    habitStacksCount: habitStacks.length,
    groups,
    habitStacks
  };
}

// ============================================================================
// Dashboard V2 Analytics Extensions (Allocation, Rhythm, Scatter, Domains, Milestones)
// ============================================================================

export type ActivityCategoryId = 'focus' | 'reading' | 'workout' | 'creative' | 'quran';

export interface ActivitySlice {
  id: ActivityCategoryId;
  labelAr: string;
  labelEn: string;
  color: string;
  minutes: number;
  sessionsCount: number;
  sharePercent: number;
}

export interface ActivityAllocationPeriod {
  totalMinutes: number;
  activeDaysCount: number;
  dailyAvgMinutes: number | null;
  slices: ActivitySlice[];
}

export interface ActivityAllocationData {
  todayTotalMinutes: number;
  todaySlices: ActivitySlice[];
  period7d: ActivityAllocationPeriod;
  period30d: ActivityAllocationPeriod;
  todayHealth: {
    logged: boolean;
    sleepHours: number;
    hydrationMl: number;
    targetHydrationMl: number;
    moodRating: number;
    energyScore: number;
  };
}

export function buildActivityAllocation(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): ActivityAllocationData {
  const dailyMap = indexDailyAggregates(input);

  const computePeriod = (daysCount: number): ActivityAllocationPeriod => {
    const keys = buildDailyKeyRange(todayKey, daysCount);
    let focusMin = 0;
    let focusCnt = 0;
    let readingMin = 0;
    let readingCnt = 0;
    let workoutMin = 0;
    let workoutCnt = 0;
    let creativeMin = 0;
    let creativeCnt = 0;
    let quranMin = 0;
    let quranCnt = 0;
    let activeDays = 0;

    for (const k of keys) {
      const agg = dailyMap.get(k);
      if (!agg) continue;
      const mins = aggActiveMinutes(agg);
      if (mins > 0) activeDays += 1;
      focusMin += agg.focusMinutes;
      focusCnt += agg.focusSessionsCount;
      readingMin += agg.readingMinutes;
      readingCnt += agg.readingSessionsCount;
      workoutMin += agg.workoutMinutes;
      workoutCnt += agg.workoutSessionsCount;
      creativeMin += agg.drawingMinutes;
      creativeCnt += agg.drawingPiecesCount;
      quranMin += agg.quranMinutes;
      quranCnt += agg.quranSessionsCount;
    }

    const total = focusMin + readingMin + workoutMin + creativeMin + quranMin;
    const raw: Omit<ActivitySlice, 'sharePercent'>[] = [
      { id: 'focus', labelAr: 'التركيز العميق', labelEn: 'Deep Focus', color: 'var(--brand-strong)', minutes: focusMin, sessionsCount: focusCnt },
      { id: 'reading', labelAr: 'القراءة', labelEn: 'Reading', color: 'var(--d-reading-accent)', minutes: readingMin, sessionsCount: readingCnt },
      { id: 'workout', labelAr: 'التمرين', labelEn: 'Workout', color: 'var(--d-workout-accent)', minutes: workoutMin, sessionsCount: workoutCnt },
      { id: 'creative', labelAr: 'الإبداع والرسم', labelEn: 'Creative Art', color: 'var(--d-drawing-accent)', minutes: creativeMin, sessionsCount: creativeCnt },
      { id: 'quran', labelAr: 'القرآن', labelEn: 'Quran', color: 'var(--state-info)', minutes: quranMin, sessionsCount: quranCnt }
    ];

    const slices: ActivitySlice[] = raw
      .map((s) => ({
        ...s,
        sharePercent: total > 0 ? Math.round((s.minutes / total) * 100) : 0
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      totalMinutes: total,
      activeDaysCount: activeDays,
      dailyAvgMinutes: activeDays > 0 ? Math.round(total / activeDays) : null,
      slices
    };
  };

  const todayPeriod = computePeriod(1);
  const period7d = computePeriod(7);
  const period30d = computePeriod(30);

  const th = input.healthMetrics[todayKey];
  const logged = Boolean(
    th && (th.sleepHours > 0 || th.hydrationMl > 0 || th.moodRating > 0 || th.workoutLogged)
  );

  return {
    todayTotalMinutes: todayPeriod.totalMinutes,
    todaySlices: todayPeriod.slices,
    period7d,
    period30d,
    todayHealth: {
      logged,
      sleepHours: th?.sleepHours || 0,
      hydrationMl: th?.hydrationMl || 0,
      targetHydrationMl: th?.targetHydrationMl || 2500,
      moodRating: th?.moodRating || 0,
      energyScore: input.energyScore
    }
  };
}

export interface WeekdayRhythmPoint {
  dow: number; // 0=Sun..6=Sat
  labelAr: string;
  labelEn: string;
  dueCount: number;
  doneCount: number;
  adherenceRate: number | null;
  avgActiveMinutes: number | null;
}

export interface TimeOfDayCompliancePoint {
  slot: 'morning' | 'afternoon' | 'evening' | 'anytime';
  labelAr: string;
  labelEn: string;
  habitsCount: number;
  dueCount: number;
  doneCount: number;
  rate: number | null;
}

export interface DailyCorrelationPoint {
  dateKey: string;
  activeMinutes: number;
  completionRate: number;
  activitiesCount: number;
}

export interface FocusScatterPoint {
  id: string;
  dateKey: string;
  title: string;
  durationMinutes: number;
  productivityScore: number;
  interruptions: number;
}

export interface ConsistencyBreakdownData {
  weekdays: WeekdayRhythmPoint[];
  timeOfDay: TimeOfDayCompliancePoint[];
  dailyScatter: DailyCorrelationPoint[];
  pearsonR: number | null;
  focusScatter: FocusScatterPoint[];
}

export function buildConsistencyBreakdown(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): ConsistencyBreakdownData {
  const dailyMap = indexDailyAggregates(input);
  const activeHabits = getActiveHabits(input.habits);

  const keys98 = buildDailyKeyRange(todayKey, 98);

  // Buckets are ordered in NUQTA's week (Sat..Fri), not Sun..Sat, so the weekday
  // strip reads left-to-right the same way the week does.
  const dowBuckets = WEEK_DAY_ORDER.map((dow) => ({
    dow,
    labelAr: weekDayLabel(dow, true),
    labelEn: weekDayLabel(dow, false),
    dueCount: 0,
    doneCount: 0,
    minsSum: 0,
    minsDays: 0
  }));
  const dowIndex = new Map(dowBuckets.map((b, i) => [b.dow, i]));

  for (const k of keys98) {
    const dt = parseDateKey(k);
    if (!dt) continue;
    const bucket = dowBuckets[dowIndex.get(dayOfWeek(dt)) ?? 0];
    for (const h of activeHabits) {
      const c = habitCompliance(h, [k]);
      bucket.dueCount += c.due;
      bucket.doneCount += c.done;
    }
    const agg = dailyMap.get(k);
    if (agg) {
      const m = aggActiveMinutes(agg);
      if (m > 0) {
        bucket.minsSum += m;
        bucket.minsDays += 1;
      }
    }
  }

  const weekdays: WeekdayRhythmPoint[] = dowBuckets.map((b) => ({
    dow: b.dow,
    labelAr: b.labelAr,
    labelEn: b.labelEn,
    dueCount: b.dueCount,
    doneCount: b.doneCount,
    adherenceRate: b.dueCount > 0 ? Math.round((b.doneCount / b.dueCount) * 100) : null,
    avgActiveMinutes: b.minsDays > 0 ? Math.round(b.minsSum / b.minsDays) : null
  }));

  const keys30 = buildDailyKeyRange(todayKey, 30);
  const slotDefs: Array<{ slot: TimeOfDayCompliancePoint['slot']; labelAr: string; labelEn: string }> = [
    { slot: 'morning', labelAr: 'الصباح', labelEn: 'Morning' },
    { slot: 'afternoon', labelAr: 'الظهيرة', labelEn: 'Afternoon' },
    { slot: 'evening', labelAr: 'المساء', labelEn: 'Evening' },
    { slot: 'anytime', labelAr: 'مرن', labelEn: 'Anytime' }
  ];

  const timeOfDay: TimeOfDayCompliancePoint[] = slotDefs.map((def) => {
    const slotHabits = activeHabits.filter((h) => h.timeOfDay === def.slot);
    let due = 0;
    let done = 0;
    for (const h of slotHabits) {
      const c = habitCompliance(h, keys30);
      due += c.due;
      done += c.done;
    }
    return {
      slot: def.slot,
      labelAr: def.labelAr,
      labelEn: def.labelEn,
      habitsCount: slotHabits.length,
      dueCount: due,
      doneCount: done,
      rate: due > 0 ? Math.round((done / due) * 100) : null
    };
  });

  // Scatter: Daily Active Minutes vs Combined Daily Execution Rate (over recorded days in last 30D)
  const dailyScatter: DailyCorrelationPoint[] = [];
  for (const k of keys30) {
    const agg = dailyMap.get(k);
    const activeMinutes = aggActiveMinutes(agg);

    let habDue = 0;
    let habDone = 0;
    for (const h of activeHabits) {
      const c = habitCompliance(h, [k]);
      habDue += c.due;
      habDone += c.done;
    }
    const sched = agg?.tasksScheduled || 0;
    const tDone = agg?.tasksDone || 0;
    const totalDue = habDue + sched;
    const totalDone = habDone + tDone;

    if (totalDue > 0 && (activeMinutes > 0 || totalDone > 0)) {
      const completionRate = Math.min(100, Math.round((totalDone / totalDue) * 100));
      const activitiesCount =
        (agg?.tasksDone || 0) +
        (agg?.habitCheckins || 0) +
        (agg?.focusSessionsCount || 0) +
        (agg?.readingSessionsCount || 0) +
        (agg?.workoutSessionsCount || 0) +
        (agg?.drawingPiecesCount || 0) +
        (agg?.quranSessionsCount || 0);
      dailyScatter.push({
        dateKey: k,
        activeMinutes,
        completionRate,
        activitiesCount: Math.max(1, activitiesCount)
      });
    }
  }

  let pearsonR: number | null = null;
  if (dailyScatter.length >= 4) {
    const n = dailyScatter.length;
    const meanX = dailyScatter.reduce((s, p) => s + p.activeMinutes, 0) / n;
    const meanY = dailyScatter.reduce((s, p) => s + p.completionRate, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of dailyScatter) {
      const dx = p.activeMinutes - meanX;
      const dy = p.completionRate - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    if (den > 0) {
      pearsonR = Math.round((num / den) * 100) / 100;
    }
  }

  const focusScatter: FocusScatterPoint[] = (input.focusSessions || [])
    .filter((s) => s.durationMinutes > 0)
    .slice(-24)
    .map((s) => ({
      id: s.id,
      dateKey: s.completedAt ? localDayFrom(s.completedAt) : todayKey,
      title: s.taskTitle || 'Focus Session',
      durationMinutes: s.durationMinutes,
      productivityScore: s.productivityScore || 3,
      interruptions: s.interruptionCount || 0
    }));

  return {
    weekdays,
    timeOfDay,
    dailyScatter,
    pearsonR,
    focusScatter
  };
}

export interface DomainDeepAnalytics {
  faith: {
    hasData: boolean;
    totalAyahsMemorized: number;
    ayahsGoalPercent: number;
    dailyTargetAyahs: number;
    todayAyahs: number;
    surahsCompleted: number;
    surahsInProgress: number;
    surahsNeedsRevision: number;
    sessions7d: number;
    memorizationMinutes: number;
    revisionMinutes: number;
  };
  learning: {
    hasData: boolean;
    pages7d: number;
    dailyTargetPages: number;
    dailyPages7d: Array<{ dateKey: string; label: string; pages: number }>;
    avgSpeedPagesPerHour: number | null;
    activeBookTitle: string | null;
    activeBookPage: number;
    activeBookTotalPages: number;
    completedBooks: number;
  };
  health: {
    hasData: boolean;
    todaySleepHours: number;
    todayHydrationMl: number;
    targetHydrationMl: number;
    todayMood: number;
    workouts7d: number;
    weeklyTargetWorkouts: number;
    totalReps7d: number;
    dailyWorkout7d: Array<{ dateKey: string; label: string; minutes: number }>;
  };
  creative: {
    hasData: boolean;
    flowMinutes7d: number;
    weeklyTargetMinutes: number;
    totalPieces: number;
    totalProjects: number;
    stages: Array<{ id: string; labelAr: string; labelEn: string; count: number; color: string }>;
  };
  finance: {
    hasData: boolean;
    income30d: number;
    expense30d: number;
    net30d: number;
    savingsCurrent: number;
    savingsTarget: number;
    topCategories: Array<{ category: string; amount: number; sharePercent: number }>;
  };
  personal: {
    hasData: boolean;
    activeHabitsCount: number;
    journals30d: number;
    avgMood30d: number | null;
    timeOfDay: TimeOfDayCompliancePoint[];
  };
}

export function buildDomainAnalytics(
  input: DashboardAnalyticsInput,
  isAr: boolean,
  todayKey: string = localDateKey()
): DomainDeepAnalytics {
  const keys7 = buildDailyKeyRange(todayKey, 7);
  const set7 = new Set(keys7);
  const set30 = new Set(buildDailyKeyRange(todayKey, 30));

  // 1. Faith
  const quranHabit = input.habits.find((h) => h.specializedType === 'quran' && !h.isArchived);
  const qd = quranHabit?.quranData;
  const surahsList = Array.isArray(qd?.surahs) ? qd!.surahs : [];
  const surahsCompleted = qd?.totalSurahsCompleted || surahsList.filter((s) => s.status === 'completed').length;
  const surahsInProgress = surahsList.filter((s) => s.status === 'in_progress').length;
  const surahsNeedsRevision = surahsList.filter((s) => s.status === 'needs_revision').length;
  const todayAyahs = (qd?.sessions || [])
    .filter((s) => s.date === todayKey)
    .reduce((sum, s) => sum + (s.ayahCount || 0), 0);
  const totalAyahs = qd?.totalAyahsMemorized || 0;
  const dailyTargetAyahs = qd?.dailyTargetAyahs || qd?.revisionSchedule?.targetDailyAyahs || 0;
  const faithSessions7d = (qd?.sessions || []).filter((s) => set7.has(s.date)).length;

  // 2. Learning
  const readingHabit = input.habits.find((h) => h.specializedType === 'reading' && !h.isArchived);
  const rd = readingHabit?.readingData;
  const books = (rd?.books || []).filter((b) => b.status !== 'archived');
  const activeBook = books.find((b) => b.id === rd?.activeBookId) || books.find((b) => b.status === 'reading') || null;
  const readSessions = rd?.sessions || [];
  const dailyPages7d = keys7.map((k) => ({
    dateKey: k,
    label: formatWeekdayShort(k, isAr),
    pages: readSessions.filter((s) => s.date === k).reduce((sum, s) => sum + (s.pagesRead || 0), 0)
  }));
  const pages7d = dailyPages7d.reduce((s, d) => s + d.pages, 0);
  const speedSamples = readSessions.filter((s) => s.speedPagesPerHour > 0);
  const avgSpeed =
    speedSamples.length > 0
      ? Math.round(speedSamples.reduce((s, x) => s + x.speedPagesPerHour, 0) / speedSamples.length)
      : null;

  // 3. Health
  const workoutHabit = input.habits.find((h) => h.specializedType === 'workout' && !h.isArchived);
  const wd = workoutHabit?.workoutData;
  const wSessions = wd?.sessions || [];
  const dailyWorkout7d = keys7.map((k) => ({
    dateKey: k,
    label: formatWeekdayShort(k, isAr),
    minutes: wSessions.filter((s) => s.date === k).reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
  }));
  const wSessions7d = wSessions.filter((s) => set7.has(s.date));
  const th = input.healthMetrics[todayKey];

  // 4. Creative
  const drawHabit = input.habits.find((h) => h.specializedType === 'drawing' && !h.isArchived);
  const dd = drawHabit?.drawingData;
  const projects = (dd?.projects || []).filter((p) => !p.isArchived && p.stage !== 'archived');
  const flowMinutes7d = (dd?.pieces || [])
    .filter((p) => set7.has(p.completedDate))
    .reduce((s, p) => s + (p.durationMinutes || 0), 0);

  const stageBuckets = [
    {
      id: 'early',
      labelAr: 'فكرة وتخطيط',
      labelEn: 'Ideation/Sketch',
      count: projects.filter((p) => p.stage === 'ideation' || p.stage === 'sketching').length,
      color: 'var(--blue)'
    },
    {
      id: 'craft',
      labelAr: 'تحبير وتلوين',
      labelEn: 'Inking/Color',
      count: projects.filter((p) => p.stage === 'inking' || p.stage === 'coloring').length,
      color: 'var(--d-drawing-accent)'
    },
    {
      id: 'polish',
      labelAr: 'تنقيح',
      labelEn: 'Polishing',
      count: projects.filter((p) => p.stage === 'polishing').length,
      color: 'var(--state-warning)'
    },
    {
      id: 'done',
      labelAr: 'مكتمل',
      labelEn: 'Completed',
      count: projects.filter((p) => p.stage === 'completed').length,
      color: 'var(--brand-strong)'
    }
  ];

  // 5. Finance
  const exp30 = input.expenses.filter((e) => set30.has(e.date));
  const income30d = exp30.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense30d = exp30.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const catTotals = new Map<string, number>();
  for (const e of exp30.filter((x) => x.type === 'expense')) {
    catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amount);
  }
  const topCategories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, amount]) => ({
      category,
      amount,
      sharePercent: expense30d > 0 ? Math.round((amount / expense30d) * 100) : 0
    }));

  // 6. Personal
  const breakdown = buildConsistencyBreakdown(input, todayKey);
  const journalsLast30 = input.journalEntries.filter((j) => set30.has(j.date));
  const moodVals = journalsLast30.map((j) => j.mood).filter((m) => typeof m === 'number' && m > 0);
  const avgMood30d =
    moodVals.length > 0
      ? Math.round((moodVals.reduce((s, m) => s + m, 0) / moodVals.length) * 10) / 10
      : null;

  return {
    faith: {
      hasData: Boolean(quranHabit && (totalAyahs > 0 || (qd?.sessions?.length || 0) > 0)),
      totalAyahsMemorized: totalAyahs,
      ayahsGoalPercent: Math.min(100, Math.round((totalAyahs / 6236) * 1000) / 10),
      dailyTargetAyahs,
      todayAyahs,
      surahsCompleted,
      surahsInProgress,
      surahsNeedsRevision,
      sessions7d: faithSessions7d,
      memorizationMinutes: qd?.totalMemorizationMinutes || 0,
      revisionMinutes: qd?.totalRevisionMinutes || 0
    },
    learning: {
      hasData: Boolean(books.length > 0 || readSessions.length > 0 || (rd?.totalPagesRead || 0) > 0),
      pages7d,
      dailyTargetPages: rd?.dailyTargetPages || 0,
      dailyPages7d,
      avgSpeedPagesPerHour: avgSpeed,
      activeBookTitle: activeBook?.title || null,
      activeBookPage: activeBook?.currentPage || 0,
      activeBookTotalPages: activeBook?.totalPages || 0,
      completedBooks: books.filter((b) => b.status === 'completed').length
    },
    health: {
      hasData: Boolean(
        wSessions.length > 0 ||
          (th && (th.sleepHours > 0 || th.hydrationMl > 0 || th.moodRating > 0 || th.workoutLogged))
      ),
      todaySleepHours: th?.sleepHours || 0,
      todayHydrationMl: th?.hydrationMl || 0,
      targetHydrationMl: th?.targetHydrationMl || 2500,
      todayMood: th?.moodRating || 0,
      workouts7d: wSessions7d.length,
      weeklyTargetWorkouts: wd?.weeklyTargetSessions || 0,
      totalReps7d: wSessions7d.reduce((s, x) => s + (x.totalReps || 0), 0),
      dailyWorkout7d
    },
    creative: {
      hasData: Boolean(projects.length > 0 || (dd?.pieces?.length || 0) > 0 || (dd?.totalDrawingMinutes || 0) > 0),
      flowMinutes7d,
      weeklyTargetMinutes: (dd?.weeklyTargetHours || 0) * 60,
      totalPieces: dd?.pieces?.length || 0,
      totalProjects: projects.length,
      stages: stageBuckets
    },
    finance: {
      hasData: input.expenses.length > 0 || input.savingsGoals.length > 0,
      income30d,
      expense30d,
      net30d: income30d - expense30d,
      savingsCurrent: input.savingsGoals.reduce((s, g) => s + (g.currentAmount || 0), 0),
      savingsTarget: input.savingsGoals.reduce((s, g) => s + (g.targetAmount || 0), 0),
      topCategories
    },
    personal: {
      hasData: getActiveHabits(input.habits).length > 0 || input.journalEntries.length > 0,
      activeHabitsCount: getActiveHabits(input.habits).length,
      journals30d: journalsLast30.length,
      avgMood30d,
      timeOfDay: breakdown.timeOfDay
    }
  };
}

export interface MilestoneTimelineItem {
  id: string;
  goalId: string;
  goalTitle: string;
  goalColor: string;
  title: string;
  targetDate: string | null;
  completedDate: string | null;
  isCompleted: boolean;
  status: 'completed' | 'overdue' | 'upcoming' | 'unscheduled';
}

export function buildMilestoneTimeline(
  input: DashboardAnalyticsInput,
  todayKey: string = localDateKey()
): MilestoneTimelineItem[] {
  const activeGoals = input.goals.filter((g) => g.status === 'active');
  const items: MilestoneTimelineItem[] = [];

  for (const g of activeGoals) {
    const color = goalCategoryColor(g.category);
    for (const m of g.milestones || []) {
      let status: MilestoneTimelineItem['status'] = 'unscheduled';
      if (m.isCompleted) {
        status = 'completed';
      } else if (m.targetDate && isDateKey(m.targetDate)) {
        status = m.targetDate < todayKey ? 'overdue' : 'upcoming';
      }
      items.push({
        id: `${g.id}-${m.id}`,
        goalId: g.id,
        goalTitle: g.title,
        goalColor: color,
        title: m.title,
        targetDate: m.targetDate || null,
        completedDate: m.completedDate || null,
        isCompleted: Boolean(m.isCompleted),
        status
      });
    }
  }

  return items.sort((a, b) => {
    const da = a.targetDate || a.completedDate || '9999-12-31';
    const db = b.targetDate || b.completedDate || '9999-12-31';
    return da.localeCompare(db);
  });
}

