import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useNuqtaStore } from '../store/nuqtaStore';
import { Habit, Goal, Task } from '../types';
import { localDateKey, localDayFrom, localTimeKey } from '../lib/dateKey';
import { isTaskActive, isTaskDone, isTaskPending } from '../lib/taskStatus';
import {
  buildActivityAllocation,
  buildConsistencyBreakdown,
  buildDomainAnalytics,
  buildGoalsOverview,
  buildLifeConnections,
  buildMilestoneTimeline,
  buildPerformanceTrend,
  buildSecondaryAnalytics,
  computeDashboardKPIs,
  TrendMetricId,
  TrendRangeId
} from '../lib/dashboardAnalytics';
import { NuqtaNotificationEngine } from '../lib/notifications';
import { NuqtaIcon } from './NuqtaIcon';
import { QuickCaptureBar } from './QuickCaptureBar';
import { ReadingAppModal } from './ReadingAppModal';
import { WorkoutAppModal } from './WorkoutAppModal';
import { GoalDetailModal } from './GoalDetailModal';
import { KpiTerminalStrip } from './dashboard/KpiTerminalStrip';
import { LifePerformanceChart } from './dashboard/LifePerformanceChart';
import { ActivityAllocationPanel } from './dashboard/ActivityAllocationPanel';
import { SecondaryAnalyticsSection } from './dashboard/SecondaryAnalyticsSection';
import { LifeDomainsGrid } from './dashboard/LifeDomainsGrid';
import { GoalsMilestonesSection } from './dashboard/GoalsMilestonesSection';
import { LifeConnectionsSection } from './dashboard/LifeConnectionsSection';
import { useEscapeKey } from '../lib/useEscapeKey';

export const DashboardView: React.FC = () => {
  const {
    tasks,
    habits,
    goals,
    focusSessions,
    healthMetrics,
    expenses,
    savingsGoals,
    journalEntries,
    energyScore,
    profile,
    toggleTaskStatus,
    toggleTopThree,
    updateTask,
    toggleHabitToday,
    logFocusSession,
    setRescueModeOpen,
    setActiveNavTab
  } = useNuqtaStore();

  // Analytics controls
  const [trendMetric, setTrendMetric] = useState<TrendMetricId>('activeMinutes');
  const [trendRange, setTrendRange] = useState<TrendRangeId>('30d');

  // Modals for Specialized Habit Studios & Goals
  const [activeReadingModalHabit, setActiveReadingModalHabit] = useState<Habit | null>(null);
  const [activeWorkoutModalHabit, setActiveWorkoutModalHabit] = useState<Habit | null>(null);
  const [inspectingGoal, setInspectingGoal] = useState<Goal | null>(null);

  // Daily Focus Selector Modal State
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  useEscapeKey(isTaskPickerOpen, () => setIsTaskPickerOpen(false));

  // Focus Launcher State
  const [focusingTask, setFocusingTask] = useState<Task | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [focusPreset, setFocusPreset] = useState<number>(25);
  const [focusRemaining, setFocusRemaining] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);
  useEscapeKey(isFocusModalOpen, () => { if (!focusRunning) setIsFocusModalOpen(false); });
  const [focusDistractions, setFocusDistractions] = useState<number>(0);

  // Daily Command Center Agenda Filter
  const [agendaTab, setAgendaTab] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');

  const isAr = profile.language === 'ar';
  const now = new Date();
  const todayStr = localDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateKey(tomorrow);
  const currentTimeHHMM = localTimeKey(now);

  const currentHour = now.getHours();
  const greeting =
    currentHour < 12
      ? isAr
        ? 'صباح الخير'
        : 'Good morning'
      : currentHour < 18
      ? isAr
        ? 'طاب يومك'
        : 'Good afternoon'
      : isAr
      ? 'مساء الخير'
      : 'Good evening';

  const trimmedFirstName = (profile.name || '').trim().split(/\s+/)[0] || '';
  const greetingLine = trimmedFirstName
    ? isAr
      ? `${greeting}، ${trimmedFirstName}`
      : `${greeting}, ${trimmedFirstName}`
    : greeting;

  const formattedDate = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(now);

  // =========================================================================
  // 1. V2 Analytics Computations (Strictly Stored Records)
  // =========================================================================
  const analyticsInput = useMemo(
    () => ({
      tasks,
      habits,
      goals,
      focusSessions,
      healthMetrics,
      expenses,
      savingsGoals,
      journalEntries,
      energyScore
    }),
    [tasks, habits, goals, focusSessions, healthMetrics, expenses, savingsGoals, journalEntries, energyScore]
  );

  const kpis = useMemo(() => computeDashboardKPIs(analyticsInput, todayStr), [analyticsInput, todayStr]);
  const trendData = useMemo(
    () => buildPerformanceTrend(analyticsInput, trendMetric, trendRange, isAr, todayStr),
    [analyticsInput, trendMetric, trendRange, isAr, todayStr]
  );
  const allocationData = useMemo(
    () => buildActivityAllocation(analyticsInput, todayStr),
    [analyticsInput, todayStr]
  );
  const secondaryData = useMemo(
    () => buildSecondaryAnalytics(analyticsInput, todayStr),
    [analyticsInput, todayStr]
  );
  const consistencyBreakdown = useMemo(
    () => buildConsistencyBreakdown(analyticsInput, todayStr),
    [analyticsInput, todayStr]
  );
  const domainAnalytics = useMemo(
    () => buildDomainAnalytics(analyticsInput, isAr, todayStr),
    [analyticsInput, isAr, todayStr]
  );
  const goalsOverview = useMemo(() => buildGoalsOverview(analyticsInput), [analyticsInput]);
  const milestoneTimeline = useMemo(
    () => buildMilestoneTimeline(analyticsInput, todayStr),
    [analyticsInput, todayStr]
  );
  const lifeConnections = useMemo(() => buildLifeConnections(analyticsInput), [analyticsInput]);

  // =========================================================================
  // 2. Daily Command Center Data
  // =========================================================================
  const activeTasks = tasks.filter(isTaskActive);
  const topThree = activeTasks.filter((t) => t.isTopThree);
  const activeHabits = habits.filter((h) => !h.isArchived && h.status !== 'archived' && h.status !== 'paused');

  const todayTasks = activeTasks.filter(
    (t) => t.scheduledDate === todayStr || (t.completedAt && localDayFrom(t.completedAt) === todayStr)
  );
  const pendingTodayTasks = todayTasks.filter(isTaskPending);
  const doneTodayTasks = todayTasks.filter(isTaskDone);

  const overdueTasks = activeTasks.filter((t) => {
    if (isTaskDone(t)) return false;
    if (t.scheduledDate && t.scheduledDate < todayStr) return true;
    if (t.scheduledDate === todayStr && t.scheduledTime && t.scheduledTime < currentTimeHHMM) return true;
    return false;
  });

  const upcomingTasks = activeTasks
    .filter((t) => {
      if (isTaskDone(t)) return false;
      if (t.scheduledDate === todayStr) {
        if (!t.scheduledTime) return true;
        return t.scheduledTime >= currentTimeHHMM;
      }
      return false;
    })
    .sort((a, b) => (a.scheduledTime || '23:59').localeCompare(b.scheduledTime || '23:59'));

  const todayFocusSessions = focusSessions.filter(
    (s) => s.completedAt && localDayFrom(s.completedAt) === todayStr
  );

  const completedTodayItems = [
    ...doneTodayTasks.map((t) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      title: t.title,
      time: t.completedAt
        ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : isAr
        ? 'اليوم'
        : 'Today'
    })),
    ...todayFocusSessions.map((s) => ({
      id: `focus-${s.id}`,
      type: 'focus' as const,
      title: s.taskTitle
        ? `${isAr ? 'جلسة تركيز:' : 'Focus:'} ${s.taskTitle}`
        : isAr
        ? 'جلسة تركيز عميق'
        : 'Deep Work Session',
      time: s.completedAt
        ? new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : isAr
        ? 'اليوم'
        : 'Today'
    }))
  ];

  const isOverwhelmed = overdueTasks.length >= 2 || pendingTodayTasks.length >= 5;

  // =========================================================================
  // 3. Focus Launcher Timer Effect
  // =========================================================================
  const handleFinishFocusSession = (markTaskDone: boolean = false) => {
    const elapsedSeconds = focusPreset * 60 - focusRemaining;
    const minutesSpent = Math.max(1, Math.round(elapsedSeconds / 60));

    logFocusSession({
      taskId: focusingTask?.id,
      taskTitle: focusingTask?.title || (isAr ? 'جلسة تركيز حر' : 'Free Focus Session'),
      durationMinutes: minutesSpent,
      targetMinutes: focusPreset,
      interruptionCount: focusDistractions,
      preMood: 4,
      postMood: 5,
      productivityScore: focusDistractions === 0 ? 5 : focusDistractions <= 2 ? 4 : 3
    });

    if (markTaskDone && focusingTask && isTaskPending(focusingTask)) {
      toggleTaskStatus(focusingTask.id);
    }

    NuqtaNotificationEngine.notify({
      title: isAr ? 'اكتملت جلسة التركيز' : 'Focus Session Logged',
      body: isAr
        ? `أنجزت ${minutesSpent} دقيقة من العمل المركز.`
        : `Completed ${minutesSpent} minutes of focused work.`,
      tag: 'focus-finish',
      chime: 'focus-complete'
    });

    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } catch {}

    setFocusRunning(false);
    setIsFocusModalOpen(false);
    setFocusingTask(null);
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (focusRunning && focusRemaining > 0) {
      timer = setInterval(() => {
        setFocusRemaining((prev) => prev - 1);
      }, 1000);
    } else if (focusRunning && focusRemaining <= 0) {
      setFocusRunning(false);
      handleFinishFocusSession();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [focusRunning, focusRemaining]);

  const openFocusLauncher = (task?: Task) => {
    setFocusingTask(task || null);
    setFocusPreset(25);
    setFocusRemaining(25 * 60);
    setFocusRunning(false);
    setFocusDistractions(0);
    setIsFocusModalOpen(true);
  };

  const focusQuickCapture = () => {
    const el = document.getElementById('quick-capture-input') as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setActiveNavTab('tasks');
    }
  };

  const handleOpenMetricWorkspace = (metric: TrendMetricId) => {
    switch (metric) {
      case 'tasksCompleted':
        setActiveNavTab('tasks');
        break;
      case 'habitConsistency':
        setActiveNavTab('habits');
        break;
      case 'readingPages':
        setActiveNavTab('reading');
        break;
      case 'workoutReps':
        setActiveNavTab('workout');
        break;
      case 'quranAyahs':
        setActiveNavTab('quran');
        break;
      case 'focusMinutes':
      case 'activeMinutes':
      default:
        setActiveNavTab('focus');
        break;
    }
  };

  const openHabitStudioOrToggle = (habit: Habit) => {
    if (habit.specializedType === 'reading') {
      setActiveReadingModalHabit(habit);
    } else if (habit.specializedType === 'workout') {
      setActiveWorkoutModalHabit(habit);
    } else if (habit.specializedType === 'quran') {
      setActiveNavTab('quran');
    } else if (habit.specializedType === 'drawing') {
      setActiveNavTab('drawing');
    } else if (habit.specializedType === 'walking') {
      setActiveNavTab('walking');
    } else {
      toggleHabitToday(habit.id);
    }
  };

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ===================================================================
          1. COMPACT COMMAND BAR — Greeting, Inline Quick Capture & Actions
         =================================================================== */}
      <header className="dash-glass px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-baseline gap-2.5 shrink-0 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[var(--text-primary)] m-0 truncate">
              {greetingLine}
            </h1>
            <span className="text-[var(--text-tertiary)] hidden sm:inline">·</span>
            <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap hidden sm:inline">
              {formattedDate}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <QuickCaptureBar />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('nuqta:open-search'))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-soft-border)] transition-colors whitespace-nowrap shrink-0"
              title={isAr ? 'بحث شامل (Ctrl+Shift+F)' : 'Global Search (Ctrl+Shift+F)'}
            >
              <NuqtaIcon name="search" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAr ? 'بحث' : 'Search'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('nuqta:open-palette'))}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
              title={isAr ? 'لوحة الأوامر' : 'Command Palette'}
            >
              ⌘K
            </button>

            {isOverwhelmed && (
              <button
                type="button"
                onClick={() => setRescueModeOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--state-warning)] bg-[var(--state-warning-wash-from)] text-[var(--state-warning-strong)] whitespace-nowrap shrink-0"
              >
                <span>{isAr ? 'وضع الإنقاذ' : 'Rescue'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openFocusLauncher()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-primary)] hover:border-[var(--brand-soft-border)] transition-colors whitespace-nowrap shrink-0"
            >
              <NuqtaIcon name="timer" className="w-3.5 h-3.5 text-[var(--brand-strong)]" />
              <span>{isAr ? 'بدء تركيز' : 'Focus'}</span>
            </button>

            <button
              type="button"
              onClick={focusQuickCapture}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--brand)] text-[var(--text-on-accent)] hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <NuqtaIcon name="plus" className="w-3.5 h-3.5" />
              <span>{isAr ? 'مهمة' : 'Task'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          2. UNIFIED 4-METRIC KPI TERMINAL STRIP
         =================================================================== */}
      <KpiTerminalStrip kpis={kpis} isAr={isAr} />

      {/* ===================================================================
          3. OPENING ANALYTICS CANVAS (Above the Fold 8/4 Split)
             Left: Life Performance Trend (with MA & Event Annotations)
             Right: Activity Allocation Donut, Today vs 7D Avg & Recovery
         =================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-8 min-w-0">
          <LifePerformanceChart
            trend={trendData}
            metric={trendMetric}
            range={trendRange}
            onMetricChange={setTrendMetric}
            onRangeChange={setTrendRange}
            isAr={isAr}
            onOpenRelevantView={handleOpenMetricWorkspace}
          />
        </div>
        <div className="xl:col-span-4 min-w-0">
          <ActivityAllocationPanel
            data={allocationData}
            isAr={isAr}
            onOpenFocus={() => setActiveNavTab('focus')}
            onOpenHealth={() => setActiveNavTab('health')}
          />
        </div>
      </div>

      {/* ===================================================================
          4. SECONDARY ANALYTICS — 14W Heatmap + Weekday Rhythm + Scatter
         =================================================================== */}
      <SecondaryAnalyticsSection
        data={secondaryData}
        breakdown={consistencyBreakdown}
        mapSources={{ tasks, habits, focusSessions, journalEntries, healthMetrics }}
        isAr={isAr}
        onOpenInsights={() => setActiveNavTab('insights')}
      />

      {/* ===================================================================
          5. LIFE DOMAINS — Domain-Authentic Multi-Chart Grid
         =================================================================== */}
      <LifeDomainsGrid
        analytics={domainAnalytics}
        isAr={isAr}
        onNavigate={(tab) => setActiveNavTab(tab)}
      />

      {/* ===================================================================
          6. GOALS & MILESTONES — Bullet Matrix + Milestone Horizon Timeline
         =================================================================== */}
      <GoalsMilestonesSection
        items={goalsOverview}
        milestones={milestoneTimeline}
        isAr={isAr}
        onInspectGoal={(g) => setInspectingGoal(g)}
        onOpenGoalsPage={() => setActiveNavTab('goals')}
      />

      {/* ===================================================================
          7. LIFE CONNECTIONS — Interactive Sankey Flow + Habit Stacks
         =================================================================== */}
      <LifeConnectionsSection
        connections={lifeConnections}
        isAr={isAr}
        onInspectGoal={(g) => setInspectingGoal(g)}
        onOpenGoals={() => setActiveNavTab('goals')}
      />

      {/* ===================================================================
          8. OPERATIONAL DAILY COMMAND CENTER — Priorities, Habits & Agenda
         =================================================================== */}
      <section aria-label={isAr ? 'مركز قيادة اليوم' : 'Daily Command Center'} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {isAr ? 'التنفيذ اليومي' : 'OPERATIONAL COMMAND CENTER'}
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 m-0">
              {isAr ? 'أولويات اليوم والعادات والجدول الزمني' : "Today's Priorities, Habits & Agenda"}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveNavTab('tasks')}
              className="font-medium text-[var(--brand-strong)] hover:underline"
            >
              {isAr ? 'كل المهام' : 'All Tasks'}
            </button>
            <span className="text-[var(--text-tertiary)]">·</span>
            <button
              type="button"
              onClick={() => setActiveNavTab('calendar')}
              className="font-medium text-[var(--brand-strong)] hover:underline"
            >
              {isAr ? 'التقويم' : 'Calendar'}
            </button>
          </div>
        </div>

        {isOverwhelmed && (
          <div className="v2-solid-surface p-3.5 border border-[var(--state-warning)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[var(--state-warning-strong)]">
                {isAr ? 'ضغط مهام مرتفع اليوم' : 'Heavy Daily Load Detected'}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {isAr
                  ? `لديك ${overdueTasks.length} مهام متأخرة و ${pendingTodayTasks.length} مهام متبقية لليوم.`
                  : `${overdueTasks.length} overdue and ${pendingTodayTasks.length} pending tasks today.`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRescueModeOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--state-warning)] text-[var(--accent-ink)] whitespace-nowrap shrink-0"
            >
              {isAr ? 'وضع الإنقاذ' : 'Activate Rescue Mode'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Column A: Top 3 Priorities & Today Habits */}
          <div className="lg:col-span-5 v2-solid-surface p-4 sm:p-5 space-y-5">
            {/* Top 3 Priorities */}
            <div>
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] m-0">
                    {isAr ? 'أولويات اليوم (Top 3)' : "Today's Top 3"}
                  </h3>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {isAr ? 'المهام المثبتة ذات الأثر الأعلى' : 'Pinned high-leverage tasks'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTaskPickerOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-primary)] hover:border-[var(--brand-soft-border)] whitespace-nowrap"
                >
                  {isAr ? 'اختيار / تعديل' : 'Select / Edit'}
                </button>
              </div>

              {topThree.length === 0 ? (
                <div className="py-4 text-center border border-dashed border-[var(--border-subtle)] rounded-lg">
                  <div className="text-xs text-[var(--text-secondary)]">
                    {isAr ? 'لم يتم تثبيت أولويات لليوم بعد' : 'No Top 3 priorities pinned yet'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTaskPickerOpen(true)}
                    className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--brand)] text-[var(--text-on-accent)]"
                  >
                    {isAr ? 'اختيار من المهام' : 'Choose Tasks'}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {topThree.map((task) => {
                    const isDone = isTaskDone(task);
                    return (
                      <div
                        key={task.id}
                        className={`py-2.5 flex items-center justify-between gap-2.5 ${
                          isDone ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleTaskStatus(task.id)}
                            aria-label={isAr ? 'إتمام المهمة' : 'Toggle task completion'}
                            className={`w-4 h-4 rounded-[5px] border grid place-items-center text-[11px] font-bold shrink-0 transition-colors ${
                              isDone
                                ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--text-on-accent)]'
                                : 'border-[var(--border-strong)] bg-transparent text-transparent hover:border-[var(--brand-strong)]'
                            }`}
                          >
                            <NuqtaIcon name="check" className="w-3 h-3" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-semibold truncate ${
                                isDone ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {task.title}
                            </div>
                            {(task.scheduledTime || task.estimatedMinutes) && (
                              <div className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
                                {task.scheduledTime ? task.scheduledTime : ''}
                                {task.scheduledTime && task.estimatedMinutes ? ' · ' : ''}
                                {task.estimatedMinutes ? `${task.estimatedMinutes}m` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => openFocusLauncher(task)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--brand-strong)] hover:border-[var(--brand-soft-border)] whitespace-nowrap shrink-0"
                          >
                            {isAr ? 'تركيز' : 'Focus'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Habits */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] m-0">
                    {isAr ? 'عادات اليوم' : "Today's Habits"}
                  </h3>
                  <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                    {isAr
                      ? `${kpis.consistency.todayDone} منجز اليوم`
                      : `${kpis.consistency.todayDone} completed today`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNavTab('habits')}
                  className="text-xs font-medium text-[var(--brand-strong)] hover:underline"
                >
                  {isAr ? 'إدارة' : 'Manage'}
                </button>
              </div>

              {activeHabits.length === 0 ? (
                <div className="py-3 text-center text-xs text-[var(--text-secondary)]">
                  {isAr ? 'لا توجد عادات نشطة حالياً.' : 'No active habits configured yet.'}
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] max-h-[240px] overflow-y-auto pe-1">
                  {activeHabits.slice(0, 8).map((habit) => {
                    const done = (habit.completedDates || []).includes(todayStr);
                    const isStudio =
                      habit.specializedType === 'reading' ||
                      habit.specializedType === 'workout' ||
                      habit.specializedType === 'quran' ||
                      habit.specializedType === 'drawing' ||
                      habit.specializedType === 'walking';
                    return (
                      <div key={habit.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleHabitToday(habit.id)}
                            aria-label={`${habit.name}`}
                            className={`w-4 h-4 rounded-[5px] border grid place-items-center text-[11px] font-bold shrink-0 ${
                              done
                                ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--text-on-accent)]'
                                : 'border-[var(--border-strong)] bg-transparent text-transparent hover:border-[var(--brand-strong)]'
                            }`}
                          >
                            <NuqtaIcon name="check" className="w-3 h-3" />
                          </button>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {habit.name}
                            </div>
                            <div className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
                              {habit.currentStreak > 0
                                ? isAr
                                  ? `سلسلة ${habit.currentStreak}ي`
                                  : `${habit.currentStreak}d streak`
                                : habit.anchor || habit.category}
                            </div>
                          </div>
                        </div>

                        {isStudio && (
                          <button
                            type="button"
                            onClick={() => openHabitStudioOrToggle(habit)}
                            className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
                          >
                            {isAr ? 'استوديو' : 'Studio'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column B: Adaptive Daily Agenda */}
          <div className="lg:col-span-7 v2-solid-surface p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] m-0">
                    {isAr ? 'الأجندة التكيفية لليوم' : 'Adaptive Daily Agenda'}
                  </h3>
                  <div className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                    {isAr
                      ? `${upcomingTasks.length} قادمة · ${overdueTasks.length} متأخرة · ${completedTodayItems.length} مكتملة`
                      : `${upcomingTasks.length} upcoming · ${overdueTasks.length} overdue · ${completedTodayItems.length} done`}
                  </div>
                </div>

                <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-deep)]">
                  {(
                    [
                      { id: 'all', ar: 'الكل', en: 'All' },
                      { id: 'overdue', ar: `متأخرة (${overdueTasks.length})`, en: `Overdue (${overdueTasks.length})` },
                      { id: 'upcoming', ar: `قادمة (${upcomingTasks.length})`, en: `Upcoming (${upcomingTasks.length})` },
                      { id: 'completed', ar: `منجزة (${completedTodayItems.length})`, en: `Done (${completedTodayItems.length})` }
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAgendaTab(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        agendaTab === tab.id
                          ? 'bg-[var(--surface-active)] text-[var(--brand)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {isAr ? tab.ar : tab.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[410px] overflow-y-auto pe-1">
                {(agendaTab === 'all' || agendaTab === 'overdue') && overdueTasks.length > 0 && (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--state-danger-strong)] pb-1">
                      {isAr ? 'مهام متأخرة تتطلب حسم' : 'Overdue'}
                    </div>
                    {overdueTasks.map((task) => (
                      <div key={task.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleTaskStatus(task.id)}
                            className="w-4 h-4 rounded-[5px] border border-[var(--state-danger)] bg-transparent hover:bg-[var(--brand-soft)] shrink-0"
                            aria-label={isAr ? 'إتمام المهمة' : 'Complete task'}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {task.title}
                            </div>
                            <div className="text-[10.5px] font-mono text-[var(--state-danger-strong)]">
                              {task.scheduledDate} {task.scheduledTime ? `· ${task.scheduledTime}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateTask(task.id, { scheduledDate: tomorrowStr })}
                            className="px-2 py-0.5 rounded-md text-[10.5px] font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap"
                          >
                            {isAr ? 'تأجيل للغد' : 'Defer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openFocusLauncher(task)}
                            className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--brand-soft)] text-[var(--brand-strong)] whitespace-nowrap"
                          >
                            {isAr ? 'ابدأ' : 'Focus'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(agendaTab === 'all' || agendaTab === 'upcoming') && upcomingTasks.length > 0 && (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] pb-1">
                      {isAr ? 'مجدول لبقية اليوم' : 'Scheduled Today'}
                    </div>
                    {upcomingTasks.map((task) => (
                      <div key={task.id} className="py-2.5 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleTaskStatus(task.id)}
                            className="w-4 h-4 rounded-[5px] border border-[var(--border-strong)] bg-transparent hover:border-[var(--brand-strong)] shrink-0"
                            aria-label={isAr ? 'إتمام المهمة' : 'Complete task'}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {task.title}
                            </div>
                            <div className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
                              {task.scheduledTime || (isAr ? 'مرن اليوم' : 'Anytime today')}
                              {task.estimatedMinutes ? ` · ${task.estimatedMinutes}m` : ''}
                              {task.priority ? ` · P${task.priority}` : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openFocusLauncher(task)}
                          className="px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--brand-strong)] hover:border-[var(--brand-soft-border)] whitespace-nowrap shrink-0"
                        >
                          {isAr ? 'تركيز' : 'Focus'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(agendaTab === 'all' || agendaTab === 'completed') && completedTodayItems.length > 0 && (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    <div className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--state-success-strong)] pb-1">
                      {isAr ? 'منجز اليوم' : 'Completed Today'}
                    </div>
                    {completedTodayItems.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between gap-2 opacity-75">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-4 h-4 rounded bg-[var(--brand-soft)] text-[var(--brand-strong)] grid place-items-center text-[10px] font-bold shrink-0">
                            <NuqtaIcon name="check" className="w-3 h-3" />
                          </span>
                          <span className="text-xs text-[var(--text-primary)] truncate">{item.title}</span>
                        </div>
                        <span className="text-[10.5px] font-mono text-[var(--text-tertiary)] shrink-0">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {((agendaTab === 'all' &&
                  overdueTasks.length === 0 &&
                  upcomingTasks.length === 0 &&
                  completedTodayItems.length === 0) ||
                  (agendaTab === 'overdue' && overdueTasks.length === 0) ||
                  (agendaTab === 'upcoming' && upcomingTasks.length === 0) ||
                  (agendaTab === 'completed' && completedTodayItems.length === 0)) && (
                  <div className="py-8 text-center">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      {isAr ? 'لا توجد عناصر في هذا التبويب حالياً' : 'Nothing scheduled in this filter'}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                      {isAr
                        ? 'استخدم شريط الالتقاط السريع بالأعلى لإضافة مهمة لليوم فوراً.'
                        : 'Use Quick Capture above to schedule something for today.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span>{isAr ? 'أدوات سريعة' : 'Quick Launch'}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openFocusLauncher()}
                  className="text-[var(--brand-strong)] hover:underline font-medium"
                >
                  {isAr ? 'مؤقت التركيز' : 'Focus Timer'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNavTab('journal')}
                  className="text-[var(--brand-strong)] hover:underline font-medium"
                >
                  {isAr ? 'تدوين تأمل اليوم' : 'Daily Journal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          MODALS & OVERLAYS (Preserved Functionality)
         =================================================================== */}

      {/* A. Task Picker Modal for Top 3 Priorities */}
      {isTaskPickerOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsTaskPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="modal glass-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] m-0">
                  {isAr ? 'اختيار أولويات اليوم (Top 3)' : 'Select Top 3 Priorities'}
                </h2>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {isAr
                    ? 'اختر حتى 3 مهام أساسية لتثبيتها في لوحة اليوم.'
                    : 'Select up to 3 core tasks to anchor today.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskPickerOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg p-1"
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2 pe-1">
              {activeTasks.filter(isTaskPending).length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  {isAr ? 'لا توجد مهام معلقة للاختيار.' : 'No pending tasks available.'}
                </div>
              ) : (
                activeTasks
                  .filter(isTaskPending)
                  .map((task) => {
                    const isPinned = task.isTopThree;
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTopThree(task.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isPinned
                            ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-inset)] hover:border-[var(--brand-soft-border)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs ${
                              isPinned
                                ? 'bg-[var(--brand)] border-[var(--brand)] text-[var(--text-on-accent)]'
                                : 'border-[var(--border-strong)] text-transparent'
                            }`}
                          >
                            <NuqtaIcon name="check" className="w-3 h-3" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {task.title}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
                              {task.scheduledTime && <span>{task.scheduledTime}</span>}
                              {task.estimatedMinutes && <span>· {task.estimatedMinutes}m</span>}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-[var(--brand-strong)]">
                          {isPinned ? (isAr ? 'مثبتة' : 'Pinned') : (isAr ? '+ تثبيت' : '+ Pin')}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {topThree.length}/3 {isAr ? 'مهام مثبتة' : 'tasks pinned'}
              </span>
              <button
                type="button"
                onClick={() => setIsTaskPickerOpen(false)}
                className="btn primary small text-xs"
              >
                {isAr ? 'تم وحفظ' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B. Focus Launcher Modal */}
      {isFocusModalOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => {
            if (!focusRunning) setIsFocusModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="modal glass-surface w-full max-w-md rounded-2xl p-6 shadow-2xl text-center space-y-5"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--brand-strong)]">
                {isAr ? 'جلسة تركيز مباشر' : 'Focus Session Launcher'}
              </span>
              <button
                type="button"
                onClick={() => setIsFocusModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg p-1"
                disabled={focusRunning}
              >
                ×
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-default)] text-start">
              <span className="text-[10px] text-[var(--brand-strong)] block font-mono">
                {focusingTask ? (isAr ? 'المهمة المستهدفة:' : 'Anchor Task:') : isAr ? 'تركيز حر:' : 'Free Focus:'}
              </span>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5 truncate">
                {focusingTask?.title || (isAr ? 'جلسة عمل عميق حرة' : 'Unbound Deep Work Session')}
              </div>
            </div>

            {!focusRunning && (
              <div className="flex items-center justify-center gap-2">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setFocusPreset(mins);
                      setFocusRemaining(mins * 60);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                      focusPreset === mins
                        ? 'bg-[var(--brand)] text-[var(--text-on-accent)] font-bold border-[var(--brand)]'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            )}

            <div className="py-3">
              <div className="text-5xl sm:text-6xl font-mono font-bold tabular-nums tracking-tight text-[var(--text-primary)] mb-2">
                {`${Math.floor(focusRemaining / 60)
                  .toString()
                  .padStart(2, '0')}:${(focusRemaining % 60).toString().padStart(2, '0')}`}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {focusRunning
                  ? isAr
                    ? 'حالة التدفق نشطة · تجنب التشتت'
                    : 'Flow state active · minimize distractions'
                  : isAr
                  ? 'اختر المدة واضغط بدء التركيز'
                  : 'Select duration and start'}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {!focusRunning ? (
                <button
                  type="button"
                  onClick={() => setFocusRunning(true)}
                  className="btn primary px-6 py-2.5 text-sm font-bold"
                >
                  <span>{isAr ? 'بدء التركيز' : 'Start Focus'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setFocusRunning(false)}
                    className="btn subtle text-xs px-4 py-2"
                  >
                    <span>{isAr ? 'إيقاف مؤقت' : 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinishFocusSession(true)}
                    className="btn primary text-xs px-4 py-2 font-bold"
                  >
                    <span>{isAr ? 'إتمام وحفظ الإنجاز' : 'Finish & Log'}</span>
                  </button>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsFocusModalOpen(false);
                  setActiveNavTab('focus');
                }}
                className="text-[var(--brand-strong)] hover:underline text-[11px]"
              >
                {isAr ? 'فتح لوحة التركيز الكاملة' : 'Open Full Focus Mode'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusRunning(false);
                  setIsFocusModalOpen(false);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px]"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C. Specialized Habit Modals */}
      {activeReadingModalHabit && (
        <ReadingAppModal
          habit={activeReadingModalHabit}
          onClose={() => setActiveReadingModalHabit(null)}
        />
      )}

      {activeWorkoutModalHabit && (
        <WorkoutAppModal
          habit={activeWorkoutModalHabit}
          onClose={() => setActiveWorkoutModalHabit(null)}
        />
      )}

      {/* D. Goal Inspection Modal */}
      {inspectingGoal && (
        <GoalDetailModal
          goal={inspectingGoal}
          onClose={() => setInspectingGoal(null)}
          onEditGoal={() => {
            setInspectingGoal(null);
            setActiveNavTab('goals');
          }}
        />
      )}
    </div>
  );
};
