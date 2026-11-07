import { Task, Habit, Goal, FocusSession, MuscleMovement, ArtMedium } from '../types';
import { evaluateGoalProgress } from './goalProgressEngine';

export type TimeHorizon = 'today' | 'week' | 'month' | 'all';

export interface DayMetricPoint {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string;
  tasksDone: number;
  habitChecks: number;
  readingPages: number;
  readingMinutes: number;
  workoutReps: number;
  workoutMinutes: number;
  drawingMinutes: number;
  focusMinutes: number;
  totalActiveMinutes: number;
  intensityScore: number; // 0 to 4 for heatmap
}

export interface DomainMetricAggregate {
  currentValue: number;
  previousValue: number;
  deltaPercent: number | null; // e.g. +25 or -10
  deltaAbsolute: number;
  unit: string;
  isPositiveTrend: boolean;
  hasSufficientData: boolean;
  explanation: string;
}

export interface MovementPatternDistribution {
  movement: MuscleMovement;
  labelAr: string;
  labelEn: string;
  reps: number;
  percent: number;
  color: string;
}

export interface SphereEffortAllocation {
  sphere: 'focus' | 'workout' | 'reading' | 'drawing';
  labelAr: string;
  labelEn: string;
  minutes: number;
  hours: number;
  percent: number;
  color: string;
  icon: string;
}

export interface GoalContributionSummary {
  goalId: string;
  title: string;
  category: Goal['category'];
  progressPercent: number;
  recentEventsCount: number;
  activeStatus: 'ahead' | 'on_track' | 'behind' | 'dormant' | 'not_started' | 'completed';
}

export interface LifeIntelligenceReport {
  horizon: TimeHorizon;
  horizonLabelAr: string;
  horizonLabelEn: string;
  dateRangeLabel: string;

  // 1. Core Domain Aggregates
  productivity: {
    tasksCompleted: DomainMetricAggregate;
    totalTasksScheduled: number;
    completionRate: number; // percentage
    topThreeDone: number;
  };
  habits: {
    consistencyRate: DomainMetricAggregate;
    totalChecks: number;
    longestActiveStreak: number;
    freezesUsed: number;
  };
  reading: {
    pagesRead: DomainMetricAggregate;
    readingHours: DomainMetricAggregate;
    booksFinished: number;
    averageSpeedPagesPerHour: number;
  };
  fitness: {
    workoutReps: DomainMetricAggregate;
    workoutMinutes: DomainMetricAggregate;
    sessionsCount: number;
    movementDistribution: MovementPatternDistribution[];
  };
  drawing: {
    flowHours: DomainMetricAggregate;
    artworksLogged: number;
    projectsCompleted: number;
    favoriteMedium: string;
  };
  focus: {
    deepWorkHours: DomainMetricAggregate;
    sessionsCount: number;
    averageSessionMinutes: number;
    interruptionRate: number;
  };
  goals: {
    activeGoalsCount: number;
    averageVelocityPercent: number;
    milestonesAchieved: number;
    dormantGoalsCount: number;
    goalSummaries: GoalContributionSummary[];
  };

  // 2. Cross-Domain Intelligence
  totalActiveTimeMinutes: number;
  totalActiveTimeHours: number;
  sphereAllocations: SphereEffortAllocation[];
  highestMomentumDomain: { nameAr: string; nameEn: string; reasonAr: string; reasonEn: string };
  areaNeedingAttention: { nameAr: string; nameEn: string; reasonAr: string; reasonEn: string } | null;

  // 3. Time-Series Trends
  dailyTrend: DayMetricPoint[];
  heatmapWeeks: DayMetricPoint[][]; // Array of 8 weeks for calendar heatmap
}

/**
 * Computes deep, verified Life Intelligence from actual records for the selected time horizon.
 */
export function computeLifeIntelligence(
  horizon: TimeHorizon,
  tasks: Task[],
  habits: Habit[],
  goals: Goal[],
  focusSessions: FocusSession[],
  isAr: boolean
): LifeIntelligenceReport {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Helper to get formatted YYYY-MM-DD
  const formatYmd = (d: Date) => d.toISOString().split('T')[0];

  // Determine Current & Previous Period Dates
  let currentDates: string[] = [];
  let previousDates: string[] = [];
  let dateRangeLabel = '';

  if (horizon === 'today') {
    currentDates = [todayStr];
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    previousDates = [formatYmd(yest)];
    dateRangeLabel = isAr ? 'اليوم مقارنة بالأمس' : 'Today vs Yesterday';
  } else if (horizon === 'week') {
    // Last 7 days
    currentDates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return formatYmd(d);
    });
    // Previous 7 days
    previousDates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      return formatYmd(d);
    });
    dateRangeLabel = isAr ? `${currentDates[0]} إلى ${currentDates[6]}` : `${currentDates[0]} to ${currentDates[6]}`;
  } else if (horizon === 'month') {
    // Last 30 days
    currentDates = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      return formatYmd(d);
    });
    // Previous 30 days
    previousDates = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (59 - i));
      return formatYmd(d);
    });
    dateRangeLabel = isAr ? `آخر 30 يوماً` : `Last 30 Days`;
  } else {
    // All time (all recorded activity dates)
    const allKnownDates = new Set<string>();
    tasks.forEach((t) => {
      if (t.completedAt) allKnownDates.add(t.completedAt.split('T')[0]);
      if (t.scheduledDate) allKnownDates.add(t.scheduledDate);
    });
    habits.forEach((h) => {
      (h.completedDates || []).forEach((dt) => allKnownDates.add(dt));
      h.readingData?.sessions?.forEach((s) => allKnownDates.add(s.date));
      h.workoutData?.sessions?.forEach((s) => allKnownDates.add(s.date));
      h.drawingData?.pieces?.forEach((p) => allKnownDates.add(p.completedDate));
    });
    focusSessions.forEach((f) => {
      if (f.completedAt) allKnownDates.add(f.completedAt.split('T')[0]);
    });
    allKnownDates.add(todayStr);

    currentDates = Array.from(allKnownDates).sort();
    previousDates = [];
    dateRangeLabel = isAr ? 'السجل التراكمي الشامل' : 'All-time Record';
  }

  const currentDatesSet = new Set(currentDates);
  const previousDatesSet = new Set(previousDates);

  // Helper for computing metric aggregate with delta
  const computeAggregate = (
    currentVal: number,
    previousVal: number,
    unit: string,
    hasSufficientData = true,
    explanation = ''
  ): DomainMetricAggregate => {
    let deltaPercent: number | null = null;
    const deltaAbsolute = Math.round((currentVal - previousVal) * 10) / 10;

    if (previousVal > 0) {
      deltaPercent = Math.round(((currentVal - previousVal) / previousVal) * 100);
    } else if (currentVal > 0 && previousVal === 0 && horizon !== 'all') {
      deltaPercent = 100;
    }

    return {
      currentValue: Math.round(currentVal * 10) / 10,
      previousValue: Math.round(previousVal * 10) / 10,
      deltaPercent: horizon === 'all' ? null : deltaPercent,
      deltaAbsolute: horizon === 'all' ? 0 : deltaAbsolute,
      unit,
      isPositiveTrend: deltaAbsolute >= 0,
      hasSufficientData,
      explanation
    };
  };

  // 1. PRODUCTIVITY AGGREGATION
  const isTaskInPeriod = (t: Task, dateSet: Set<string>) => {
    const compDate = t.completedAt ? t.completedAt.split('T')[0] : t.scheduledDate;
    return compDate ? dateSet.has(compDate) : false;
  };

  const tasksCompletedCurrent = tasks.filter((t) => t.status === 'completed' && isTaskInPeriod(t, currentDatesSet)).length;
  const tasksCompletedPrevious = tasks.filter((t) => t.status === 'completed' && isTaskInPeriod(t, previousDatesSet)).length;

  const scheduledTasksInCurrent = tasks.filter((t) => t.scheduledDate && currentDatesSet.has(t.scheduledDate)).length;
  const completionRate = scheduledTasksInCurrent > 0
    ? Math.min(100, Math.round((tasksCompletedCurrent / scheduledTasksInCurrent) * 100))
    : tasksCompletedCurrent > 0 ? 100 : 0;

  const topThreeDoneCurrent = tasks.filter(
    (t) => t.isTopThree && t.status === 'completed' && isTaskInPeriod(t, currentDatesSet)
  ).length;

  // 2. HABITS AGGREGATION
  const computeHabitChecks = (dateSet: Set<string>) => {
    return habits.reduce((acc, h) => {
      const count = (h.completedDates || []).filter((d) => dateSet.has(d)).length;
      return acc + count;
    }, 0);
  };
  const habitChecksCurrent = computeHabitChecks(currentDatesSet);
  const habitChecksPrevious = computeHabitChecks(previousDatesSet);

  const totalPossibleChecks = habits.length * currentDates.length;
  const habitConsistencyCurrent = totalPossibleChecks > 0
    ? Math.min(100, Math.round((habitChecksCurrent / totalPossibleChecks) * 100))
    : 0;
  const totalPossiblePrev = habits.length * previousDates.length;
  const habitConsistencyPrev = totalPossiblePrev > 0
    ? Math.min(100, Math.round((habitChecksPrevious / totalPossiblePrev) * 100))
    : 0;

  const longestStreak = habits.reduce((max, h) => Math.max(max, h.longestStreak || 0, h.currentStreak || 0), 0);
  const freezesUsed = habits.reduce((sum, h) => sum + (h.freezesUsedDates?.length || 0), 0);

  // 3. READING STUDIO AGGREGATION
  const allReadingSessions = habits.flatMap((h) => h.readingData?.sessions || []);
  const readingSessionsCurrent = allReadingSessions.filter((s) => currentDatesSet.has(s.date));
  const readingSessionsPrev = allReadingSessions.filter((s) => previousDatesSet.has(s.date));

  const pagesReadCurrent = readingSessionsCurrent.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
  const pagesReadPrev = readingSessionsPrev.reduce((sum, s) => sum + (s.pagesRead || 0), 0);

  const readingMinsCurrent = readingSessionsCurrent.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const readingMinsPrev = readingSessionsPrev.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  const readingHoursCurrent = Math.round((readingMinsCurrent / 60) * 10) / 10;
  const readingHoursPrev = Math.round((readingMinsPrev / 60) * 10) / 10;

  // Average reading speed (pages per hour)
  const averageSpeed = readingHoursCurrent > 0
    ? Math.round(pagesReadCurrent / readingHoursCurrent)
    : 0;

  // Completed books in current period
  const allBooks = habits.flatMap((h) => h.readingData?.books || []);
  const booksFinishedCurrent = allBooks.filter(
    (b) => b.status === 'completed' && b.completedDate && currentDatesSet.has(b.completedDate)
  ).length;

  // 4. HOME FITNESS AGGREGATION
  const allWorkoutSessions = habits.flatMap((h) => h.workoutData?.sessions || []);
  const workoutSessionsCurrent = allWorkoutSessions.filter((s) => currentDatesSet.has(s.date));
  const workoutSessionsPrev = allWorkoutSessions.filter((s) => previousDatesSet.has(s.date));

  const workoutRepsCurrent = workoutSessionsCurrent.reduce((sum, s) => sum + (s.totalReps || 0), 0);
  const workoutRepsPrev = workoutSessionsPrev.reduce((sum, s) => sum + (s.totalReps || 0), 0);

  const workoutMinsCurrent = workoutSessionsCurrent.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const workoutMinsPrev = workoutSessionsPrev.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  // Movement distribution
  const movementCounts: Record<MuscleMovement, number> = {
    push: 0,
    legs: 0,
    core: 0,
    back_pull: 0,
    mobility: 0,
    cardio: 0
  };

  workoutSessionsCurrent.forEach((s) => {
    (s.exercises || []).forEach((ex) => {
      const mov = ex.movement || 'push';
      const completedReps = ex.sets.reduce((sum, st) => sum + (st.completed ? st.reps : 0), 0);
      movementCounts[mov] = (movementCounts[mov] || 0) + (completedReps > 0 ? completedReps : 10);
    });
  });

  const totalMovementReps = Object.values(movementCounts).reduce((a, b) => a + b, 0);
  const movementDistribution: MovementPatternDistribution[] = [
    { movement: 'push', labelAr: 'دفع وذراعين', labelEn: 'Push', reps: movementCounts.push, percent: totalMovementReps > 0 ? Math.round((movementCounts.push / totalMovementReps) * 100) : 0, color: '#10b981' },
    { movement: 'legs', labelAr: 'أرجل وقرفصاء', labelEn: 'Legs', reps: movementCounts.legs, percent: totalMovementReps > 0 ? Math.round((movementCounts.legs / totalMovementReps) * 100) : 0, color: '#38bdf8' },
    { movement: 'core', labelAr: 'جذع وبطن (Core)', labelEn: 'Core', reps: movementCounts.core, percent: totalMovementReps > 0 ? Math.round((movementCounts.core / totalMovementReps) * 100) : 0, color: '#f59e0b' },
    { movement: 'back_pull', labelAr: 'سحب وظهر', labelEn: 'Back / Pull', reps: movementCounts.back_pull, percent: totalMovementReps > 0 ? Math.round((movementCounts.back_pull / totalMovementReps) * 100) : 0, color: '#8b5cf6' },
    { movement: 'mobility', labelAr: 'مرونة وإطالات', labelEn: 'Mobility', reps: movementCounts.mobility, percent: totalMovementReps > 0 ? Math.round((movementCounts.mobility / totalMovementReps) * 100) : 0, color: '#ec4899' },
    { movement: 'cardio', labelAr: 'تنفس ورشاقة', labelEn: 'Cardio', reps: movementCounts.cardio, percent: totalMovementReps > 0 ? Math.round((movementCounts.cardio / totalMovementReps) * 100) : 0, color: '#06b6d4' }
  ];

  // 5. DRAWING & CREATIVE STUDIO AGGREGATION
  const allArtPieces = habits.flatMap((h) => h.drawingData?.pieces || []);
  const artPiecesCurrent = allArtPieces.filter((p) => currentDatesSet.has(p.completedDate));
  const artPiecesPrev = allArtPieces.filter((p) => previousDatesSet.has(p.completedDate));

  const drawingMinsCurrent = artPiecesCurrent.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
  const drawingMinsPrev = artPiecesPrev.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);

  const drawingHoursCurrent = Math.round((drawingMinsCurrent / 60) * 10) / 10;
  const drawingHoursPrev = Math.round((drawingMinsPrev / 60) * 10) / 10;

  const allArtProjects = habits.flatMap((h) => h.drawingData?.projects || []);
  const projectsCompletedCurrent = allArtProjects.filter(
    (proj) => proj.stage === 'completed' && proj.completedDate && currentDatesSet.has(proj.completedDate)
  ).length;

  const mediumFreq: Record<string, number> = {};
  artPiecesCurrent.forEach((p) => {
    mediumFreq[p.medium] = (mediumFreq[p.medium] || 0) + 1;
  });
  const favoriteMedium = Object.keys(mediumFreq).sort((a, b) => mediumFreq[b] - mediumFreq[a])[0] || 'sketch';

  // 6. DEEP FOCUS SESSIONS AGGREGATION
  const isFocusInPeriod = (f: FocusSession, dateSet: Set<string>) => {
    const dt = f.completedAt ? f.completedAt.split('T')[0] : '';
    return dateSet.has(dt);
  };
  const focusSessionsCurrent = focusSessions.filter((f) => isFocusInPeriod(f, currentDatesSet));
  const focusSessionsPrev = focusSessions.filter((f) => isFocusInPeriod(f, previousDatesSet));

  const focusMinsCurrent = focusSessionsCurrent.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);
  const focusMinsPrev = focusSessionsPrev.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);

  const focusHoursCurrent = Math.round((focusMinsCurrent / 60) * 10) / 10;
  const focusHoursPrev = Math.round((focusMinsPrev / 60) * 10) / 10;

  const avgSessionMins = focusSessionsCurrent.length > 0
    ? Math.round(focusMinsCurrent / focusSessionsCurrent.length)
    : 0;

  const totalInterruptions = focusSessionsCurrent.reduce((sum, f) => sum + (f.interruptionCount || 0), 0);
  const interruptionRate = focusSessionsCurrent.length > 0
    ? Math.round((totalInterruptions / focusSessionsCurrent.length) * 10) / 10
    : 0;

  // 7. GOALS & OKRs AGGREGATION
  const activeGoals = goals.filter((g) => g.status === 'active');
  const evaluatedActiveGoals = activeGoals.map((g) => {
    const intel = evaluateGoalProgress(g, tasks, habits);
    const recentEventsInPeriod = intel.contributions.filter((c) => currentDatesSet.has(c.date)).length;
    return {
      goalId: g.id,
      title: g.title,
      category: g.category,
      progressPercent: intel.overallProgressPercent,
      recentEventsCount: recentEventsInPeriod,
      activeStatus: intel.pacingStatus
    };
  });

  const avgVelocity = activeGoals.length > 0
    ? Math.round(evaluatedActiveGoals.reduce((sum, g) => sum + g.progressPercent, 0) / activeGoals.length)
    : 0;

  const dormantCount = evaluatedActiveGoals.filter((g) => g.activeStatus === 'dormant').length;

  const milestonesAchieved = goals.reduce((sum, g) => {
    const count = (g.milestones || []).filter(
      (m) => m.isCompleted && m.completedDate && currentDatesSet.has(m.completedDate)
    ).length;
    return sum + count;
  }, 0);

  // 8. CROSS-DOMAIN TIME & EFFORT ALLOCATION
  const totalActiveMinutes = focusMinsCurrent + workoutMinsCurrent + readingMinsCurrent + drawingMinsCurrent;
  const totalActiveHours = Math.round((totalActiveMinutes / 60) * 10) / 10;

  const sphereAllocations: SphereEffortAllocation[] = [
    {
      sphere: 'focus',
      labelAr: 'التركيز والعمل العميق',
      labelEn: 'Deep Work & Focus',
      minutes: focusMinsCurrent,
      hours: Math.round((focusMinsCurrent / 60) * 10) / 10,
      percent: totalActiveMinutes > 0 ? Math.round((focusMinsCurrent / totalActiveMinutes) * 100) : 0,
      color: '#3b82f6',
      icon: '◷'
    },
    {
      sphere: 'workout',
      labelAr: 'اللياقة والتمارين المنزلية',
      labelEn: 'Home Fitness',
      minutes: workoutMinsCurrent,
      hours: Math.round((workoutMinsCurrent / 60) * 10) / 10,
      percent: totalActiveMinutes > 0 ? Math.round((workoutMinsCurrent / totalActiveMinutes) * 100) : 0,
      color: '#10b981',
      icon: '⚡'
    },
    {
      sphere: 'reading',
      labelAr: 'القراءة والتعلم التراكمي',
      labelEn: 'Reading Sanctuary',
      minutes: readingMinsCurrent,
      hours: Math.round((readingMinsCurrent / 60) * 10) / 10,
      percent: totalActiveMinutes > 0 ? Math.round((readingMinsCurrent / totalActiveMinutes) * 100) : 0,
      color: '#f59e0b',
      icon: '📖'
    },
    {
      sphere: 'drawing',
      labelAr: 'المرسم والتدفق الإبداعي',
      labelEn: 'Creative Art Studio',
      minutes: drawingMinsCurrent,
      hours: Math.round((drawingMinsCurrent / 60) * 10) / 10,
      percent: totalActiveMinutes > 0 ? Math.round((drawingMinsCurrent / totalActiveMinutes) * 100) : 0,
      color: '#a855f7',
      icon: '🎨'
    }
  ];

  // Highest momentum vs Area needing attention
  const sortedAllocations = [...sphereAllocations].sort((a, b) => b.minutes - a.minutes);
  const highestSphere = sortedAllocations[0] && sortedAllocations[0].minutes > 0
    ? sortedAllocations[0]
    : sphereAllocations[0];

  const highestMomentumDomain = {
    nameAr: highestSphere.labelAr,
    nameEn: highestSphere.labelEn,
    reasonAr: `سجل أعلى وقت تركيز مستثمر (${highestSphere.hours} ساعة · ${highestSphere.percent}% من مجموع الأنشطة)`,
    reasonEn: `Highest invested active time (${highestSphere.hours}h · ${highestSphere.percent}% of total allocation)`
  };

  const lowestActiveSphere = sortedAllocations[sortedAllocations.length - 1];
  const areaNeedingAttention = (lowestActiveSphere && lowestActiveSphere.minutes === 0)
    ? {
        nameAr: lowestActiveSphere.labelAr,
        nameEn: lowestActiveSphere.labelEn,
        reasonAr: 'لم يتم تسجيل أي نشاط في هذا المجال خلال الفترة المحددة.',
        reasonEn: 'No active session or habit recorded in this sphere during this period.'
      }
    : null;

  // 9. DAILY TREND TIME-SERIES (Last 7 or 14 or 30 days based on horizon)
  const trendDaysCount = horizon === 'today' ? 7 : horizon === 'week' ? 7 : 14;
  const dayNamesAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dailyTrend: DayMetricPoint[] = Array.from({ length: trendDaysCount }).map((_, idx) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (trendDaysCount - 1 - idx));
    const dtStr = formatYmd(d);
    const dayIndex = d.getDay();
    const dayLabel = isAr ? dayNamesAr[dayIndex] : dayNamesEn[dayIndex];

    const dayTasks = tasks.filter((t) => t.status === 'completed' && isTaskInPeriod(t, new Set([dtStr]))).length;
    const dayHabits = habits.filter((h) => (h.completedDates || []).includes(dtStr)).length;

    const dayReadingSessions = allReadingSessions.filter((s) => s.date === dtStr);
    const dayReadingPages = dayReadingSessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
    const dayReadingMins = dayReadingSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const dayWorkoutSessions = allWorkoutSessions.filter((s) => s.date === dtStr);
    const dayWorkoutReps = dayWorkoutSessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);
    const dayWorkoutMins = dayWorkoutSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const dayArtPieces = allArtPieces.filter((p) => p.completedDate === dtStr);
    const dayArtMins = dayArtPieces.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);

    const dayFocusSessions = focusSessions.filter((f) => isFocusInPeriod(f, new Set([dtStr])));
    const dayFocusMins = dayFocusSessions.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);

    const activeMins = dayFocusMins + dayWorkoutMins + dayReadingMins + dayArtMins;
    const totalEvents = dayTasks + dayHabits + dayReadingSessions.length + dayWorkoutSessions.length + dayArtPieces.length + dayFocusSessions.length;

    let intensity = 0;
    if (totalEvents > 0 || activeMins > 0) {
      if (totalEvents >= 6 || activeMins >= 120) intensity = 4;
      else if (totalEvents >= 4 || activeMins >= 60) intensity = 3;
      else if (totalEvents >= 2 || activeMins >= 30) intensity = 2;
      else intensity = 1;
    }

    return {
      dateStr: dtStr,
      dayLabel,
      tasksDone: dayTasks,
      habitChecks: dayHabits,
      readingPages: dayReadingPages,
      readingMinutes: dayReadingMins,
      workoutReps: dayWorkoutReps,
      workoutMinutes: dayWorkoutMins,
      drawingMinutes: dayArtMins,
      focusMinutes: dayFocusMins,
      totalActiveMinutes: activeMins,
      intensityScore: intensity
    };
  });

  // 10. CALENDAR HEATMAP MATRIX (Last 8 weeks / 56 days)
  const heatmapWeeks: DayMetricPoint[][] = [];
  const heatmapTotalDays = 56;
  const allHeatmapDays: DayMetricPoint[] = Array.from({ length: heatmapTotalDays }).map((_, idx) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (heatmapTotalDays - 1 - idx));
    const dtStr = formatYmd(d);
    const dayIndex = d.getDay();
    const dayLabel = isAr ? dayNamesAr[dayIndex] : dayNamesEn[dayIndex];

    const dayTasks = tasks.filter((t) => t.status === 'completed' && isTaskInPeriod(t, new Set([dtStr]))).length;
    const dayHabits = habits.filter((h) => (h.completedDates || []).includes(dtStr)).length;
    const dayReadingSessions = allReadingSessions.filter((s) => s.date === dtStr);
    const dayReadingPages = dayReadingSessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
    const dayReadingMins = dayReadingSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const dayWorkoutSessions = allWorkoutSessions.filter((s) => s.date === dtStr);
    const dayWorkoutReps = dayWorkoutSessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);
    const dayWorkoutMins = dayWorkoutSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const dayArtPieces = allArtPieces.filter((p) => p.completedDate === dtStr);
    const dayArtMins = dayArtPieces.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
    const dayFocusSessions = focusSessions.filter((f) => isFocusInPeriod(f, new Set([dtStr])));
    const dayFocusMins = dayFocusSessions.reduce((sum, f) => sum + (f.durationMinutes || 0), 0);

    const activeMins = dayFocusMins + dayWorkoutMins + dayReadingMins + dayArtMins;
    const totalEvents = dayTasks + dayHabits + dayReadingSessions.length + dayWorkoutSessions.length + dayArtPieces.length + dayFocusSessions.length;

    let intensity = 0;
    if (totalEvents > 0 || activeMins > 0) {
      if (totalEvents >= 6 || activeMins >= 120) intensity = 4;
      else if (totalEvents >= 4 || activeMins >= 60) intensity = 3;
      else if (totalEvents >= 2 || activeMins >= 30) intensity = 2;
      else intensity = 1;
    }

    return {
      dateStr: dtStr,
      dayLabel,
      tasksDone: dayTasks,
      habitChecks: dayHabits,
      readingPages: dayReadingPages,
      readingMinutes: dayReadingMins,
      workoutReps: dayWorkoutReps,
      workoutMinutes: dayWorkoutMins,
      drawingMinutes: dayArtMins,
      focusMinutes: dayFocusMins,
      totalActiveMinutes: activeMins,
      intensityScore: intensity
    };
  });

  // Group into weeks of 7 days
  for (let i = 0; i < allHeatmapDays.length; i += 7) {
    heatmapWeeks.push(allHeatmapDays.slice(i, i + 7));
  }

  const horizonLabels: Record<TimeHorizon, { ar: string; en: string }> = {
    today: { ar: 'اليوم', en: 'Today' },
    week: { ar: 'هذا الأسبوع', en: 'This Week' },
    month: { ar: 'هذا الشهر', en: 'This Month' },
    all: { ar: 'السجل الشامل', en: 'All-Time' }
  };

  return {
    horizon,
    horizonLabelAr: horizonLabels[horizon].ar,
    horizonLabelEn: horizonLabels[horizon].en,
    dateRangeLabel,

    productivity: {
      tasksCompleted: computeAggregate(
        tasksCompletedCurrent,
        tasksCompletedPrevious,
        isAr ? 'مهمة' : 'tasks',
        true,
        isAr ? `إنجاز ${tasksCompletedCurrent} مهمة في هذه الفترة` : `${tasksCompletedCurrent} tasks executed`
      ),
      totalTasksScheduled: scheduledTasksInCurrent,
      completionRate,
      topThreeDone: topThreeDoneCurrent
    },
    habits: {
      consistencyRate: computeAggregate(
        habitConsistencyCurrent,
        habitConsistencyPrev,
        '%',
        habits.length > 0,
        isAr ? `معدل إنجاز العادات اليومية (${habitConsistencyCurrent}%)` : `Habit execution rate (${habitConsistencyCurrent}%)`
      ),
      totalChecks: habitChecksCurrent,
      longestActiveStreak: longestStreak,
      freezesUsed
    },
    reading: {
      pagesRead: computeAggregate(
        pagesReadCurrent,
        pagesReadPrev,
        isAr ? 'صفحة' : 'pages',
        readingSessionsCurrent.length > 0 || pagesReadCurrent > 0,
        isAr ? `إجمالي الصفحات المقروءة في ${readingSessionsCurrent.length} جلسات` : `${pagesReadCurrent} pages logged`
      ),
      readingHours: computeAggregate(
        readingHoursCurrent,
        readingHoursPrev,
        isAr ? 'ساعة' : 'hours',
        readingSessionsCurrent.length > 0,
        isAr ? `${readingMinsCurrent} دقيقة قراءة مركزة` : `${readingMinsCurrent} mins read`
      ),
      booksFinished: booksFinishedCurrent,
      averageSpeedPagesPerHour: averageSpeed
    },
    fitness: {
      workoutReps: computeAggregate(
        workoutRepsCurrent,
        workoutRepsPrev,
        isAr ? 'تكرار' : 'reps',
        workoutSessionsCurrent.length > 0 || workoutRepsCurrent > 0,
        isAr ? `مجموع التكرارات المنجزة بوزن الجسم` : `Completed calisthenics reps`
      ),
      workoutMinutes: computeAggregate(
        workoutMinsCurrent,
        workoutMinsPrev,
        isAr ? 'دقيقة' : 'mins',
        workoutSessionsCurrent.length > 0,
        isAr ? `في ${workoutSessionsCurrent.length} حصص تدريبية منزلية` : `across ${workoutSessionsCurrent.length} home workouts`
      ),
      sessionsCount: workoutSessionsCurrent.length,
      movementDistribution
    },
    drawing: {
      flowHours: computeAggregate(
        drawingHoursCurrent,
        drawingHoursPrev,
        isAr ? 'ساعة' : 'hours',
        artPiecesCurrent.length > 0,
        isAr ? `تدفق إبداعي في المرسم والمعرض` : `creative flow in studio`
      ),
      artworksLogged: artPiecesCurrent.length,
      projectsCompleted: projectsCompletedCurrent,
      favoriteMedium
    },
    focus: {
      deepWorkHours: computeAggregate(
        focusHoursCurrent,
        focusHoursPrev,
        isAr ? 'ساعة' : 'hours',
        focusSessionsCurrent.length > 0,
        isAr ? `${focusMinsCurrent} دقيقة عمل عميق بلا مقاطعة` : `${focusMinsCurrent} deep work minutes`
      ),
      sessionsCount: focusSessionsCurrent.length,
      averageSessionMinutes: avgSessionMins,
      interruptionRate
    },
    goals: {
      activeGoalsCount: activeGoals.length,
      averageVelocityPercent: avgVelocity,
      milestonesAchieved,
      dormantGoalsCount: dormantCount,
      goalSummaries: evaluatedActiveGoals
    },

    totalActiveTimeMinutes: totalActiveMinutes,
    totalActiveTimeHours: totalActiveHours,
    sphereAllocations,
    highestMomentumDomain,
    areaNeedingAttention,

    dailyTrend,
    heatmapWeeks
  };
}
