import React, { useState, useEffect } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { Habit, Goal, Task } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { QuickCaptureBar } from './QuickCaptureBar';
import { ReadingAppModal } from './ReadingAppModal';
import { WorkoutAppModal } from './WorkoutAppModal';
import { GoalDetailModal } from './GoalDetailModal';
import { evaluateGoalProgress } from '../lib/goalProgressEngine';
import confetti from 'canvas-confetti';
import { NuqtaNotificationEngine } from '../lib/notifications';

export const DashboardView: React.FC = () => {
  const {
    tasks,
    habits,
    goals,
    focusSessions,
    energyScore,
    toggleTaskStatus,
    toggleTopThree,
    updateTask,
    toggleHabitToday,
    logFocusSession,
    profile,
    setRescueModeOpen,
    setActiveNavTab,
    createHabit
  } = useNuqtaStore();

  // Modals for Specialized Habit Studios & Goals
  const [activeReadingModalHabit, setActiveReadingModalHabit] = useState<Habit | null>(null);
  const [activeWorkoutModalHabit, setActiveWorkoutModalHabit] = useState<Habit | null>(null);
  const [inspectingGoal, setInspectingGoal] = useState<Goal | null>(null);

  // Daily Focus Selector Modal State
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  // Focus Launcher State
  const [focusingTask, setFocusingTask] = useState<Task | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [focusPreset, setFocusPreset] = useState<number>(25);
  const [focusRemaining, setFocusRemaining] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);
  const [focusDistractions, setFocusDistractions] = useState<number>(0);

  // Agenda Filter State
  const [agendaTab, setAgendaTab] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');

  const isAr = profile.language === 'ar';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeHHMM = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

  const greeting =
    currentHour < 12
      ? isAr ? 'صباح الخير' : 'Good morning'
      : currentHour < 18
      ? isAr ? 'يومك سعيد' : 'Good afternoon'
      : isAr ? 'مساء الخير' : 'Good evening';

  const userFirstName = (profile.name || '').trim().split(/\s+/)[0] || (isAr ? 'صديقي' : 'friend');
  const greetingLine = isAr ? `${greeting}، ${userFirstName}` : `${greeting}, ${userFirstName}`;

  // =========================================================================
  // 1. Daily Progress & Genuine Metrics (No Arbitrary Scores)
  // =========================================================================
  const topThree = tasks.filter((t) => t.isTopThree && !t.isArchived && t.status !== 'archived');

  const todayTasks = tasks.filter(
    (t) => !t.isArchived && t.status !== 'archived' && (t.scheduledDate === todayStr || (t.completedAt && t.completedAt.startsWith(todayStr)))
  );
  const doneTodayTasks = todayTasks.filter((t) => t.status === 'completed');
  const pendingTodayTasks = todayTasks.filter((t) => t.status !== 'completed');

  const todayHabitDone = habits.filter((h) => !h.isArchived && h.status !== 'archived' && h.completedDates.includes(todayStr)).length;

  const todayFocusSessions = focusSessions.filter((s) => s.completedAt?.startsWith(todayStr));
  const todayFocusMinutes = todayFocusSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Real reading session metrics today
  const readingHabit = habits.find((h) => h.specializedType === 'reading');
  const todayReadingSessions = (readingHabit?.readingData?.sessions || []).filter((s) => s.date === todayStr);
  const todayPagesRead = todayReadingSessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);

  // Real workout session metrics today
  const workoutHabit = habits.find((h) => h.specializedType === 'workout');
  const todayWorkoutSessions = (workoutHabit?.workoutData?.sessions || []).filter((s) => s.date === todayStr);
  const todayWorkoutReps = todayWorkoutSessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);

  // =========================================================================
  // 2. Adaptive Agenda (Overdue, Upcoming, Completed)
  // =========================================================================
  // Overdue: incomplete tasks scheduled before today OR scheduled today with past time
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (t.scheduledDate && t.scheduledDate < todayStr) return true;
    if (t.scheduledDate === todayStr && t.scheduledTime && t.scheduledTime < currentTimeHHMM) return true;
    return false;
  });

  // Upcoming: incomplete tasks scheduled today with future time or without specific time
  const upcomingTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (t.scheduledDate === todayStr) {
      if (!t.scheduledTime) return true;
      return t.scheduledTime >= currentTimeHHMM;
    }
    return false;
  }).sort((a, b) => (a.scheduledTime || '23:59').localeCompare(b.scheduledTime || '23:59'));

  // Completed items today: completed tasks + focus sessions
  const completedTodayItems = [
    ...doneTodayTasks.map((t) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      title: t.title,
      time: t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isAr ? 'اليوم' : 'Today'),
      item: t
    })),
    ...todayFocusSessions.map((s) => ({
      id: `focus-${s.id}`,
      type: 'focus' as const,
      title: s.taskTitle ? `${isAr ? 'جلسة تركيز:' : 'Focus Session:'} ${s.taskTitle}` : (isAr ? 'جلسة تركيز عميق' : 'Deep Work Session'),
      time: s.completedAt ? new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isAr ? 'اليوم' : 'Today'),
      duration: s.durationMinutes,
      item: s
    }))
  ];

  // Overwhelm threshold for Rescue Mode banner
  const isOverwhelmed = overdueTasks.length >= 2 || pendingTodayTasks.length >= 5;

  // =========================================================================
  // 3. Focus Launcher Timer Effect
  // =========================================================================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
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

    if (markTaskDone && focusingTask && focusingTask.status !== 'completed') {
      toggleTaskStatus(focusingTask.id);
    }

    NuqtaNotificationEngine.notify({
      title: isAr ? '🎉 اكتملت جلسة التركيز!' : '🎉 Focus Session Logged!',
      body: isAr
        ? `أنجزت ${minutesSpent} دقيقة من العمل المركز بنجاح.`
        : `Completed ${minutesSpent} minutes of high-clarity focus.`,
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

  // Week days strip
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const dayNames = isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const count = tasks.filter((t) => t.scheduledDate === key && t.status !== 'completed').length;
    return {
      key,
      dayNum: d.getDate(),
      dayLabel: dayNames[d.getDay()],
      isToday: key === todayStr,
      hasItems: count > 0
    };
  });

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Header with Command Center Identity & Quick Access */}
      <div className="page-heading">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="line"></span>
            <span className="font-mono text-accent">{isAr ? 'مركز قيادة اليوم · DAILY COMMAND CENTER' : 'DAILY COMMAND CENTER'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">{greetingLine}</h1>
          <p className="text-sm text-muted">
            {isAr
              ? 'مساحتك الموحدة لإدارة الأولويات، والجدول الزمني، والعادات، والأهداف في مكان واحد هادئ.'
              : 'Your unified command container for priorities, agenda, active habits, and strategic focus.'}
          </p>
        </div>
        <div className="heading-actions flex items-center gap-2">
          <button
            className="btn subtle text-xs border border-amber-500/30 text-[var(--state-warning-strong)] hover:bg-amber-500/10 flex items-center gap-1.5"
            onClick={() => setRescueModeOpen(true)}
            title={isAr ? 'تفعيل وضع الإنقاذ عند تزاحم المهام' : 'Anti-overwhelm rescue mode'}
          >
            <span className="text-[var(--state-warning)] font-bold">✳</span>
            <span>{isAr ? 'وضع الإنقاذ' : 'Rescue Mode'}</span>
          </button>
          <button
            className="btn subtle text-xs border border-accent/40 text-accent hover:bg-accent/10 flex items-center gap-1.5"
            onClick={() => openFocusLauncher()}
          >
            <span>◷</span>
            <span>{isAr ? 'بدء تركيز حر' : 'Free Focus'}</span>
          </button>
          <button className="btn primary text-xs" onClick={() => setActiveNavTab('tasks')}>
            <span className="btn-icon">+</span>
            <span>{isAr ? 'مهمة جديدة' : 'New Task'}</span>
          </button>
        </div>
      </div>

      {/* 2. Contextual Overload Banner (Rescue Mode Prompt) */}
      {isOverwhelmed && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-[var(--state-warning-wash-from)] via-[var(--surface-inset)] to-[var(--state-warning-wash-to)] flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-[var(--state-warning)] flex items-center justify-center font-bold text-lg border border-amber-500/30 shrink-0">
              ✳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-[var(--state-warning-strong)]">
                  {isAr ? 'هل تشعر بالتشتت أو تزاحم اليوم؟' : 'Feeling overwhelmed with daily open loops?'}
                </strong>
                <span className="text-[10px] bg-amber-500/20 text-[var(--state-warning-strong)] px-2 py-0.5 rounded-full font-mono">
                  {overdueTasks.length} {isAr ? 'متأخرة' : 'overdue'} · {pendingTodayTasks.length} {isAr ? 'معلقة' : 'pending'}
                </span>
              </div>
              <p className="text-xs text-[var(--state-warning-strong)]/80 mt-0.5">
                {isAr
                  ? 'يمكنك تفعيل وضع الإنقاذ (Rescue Mode) لترحيل ما لا يلزم فوراً والتركيز على مهمة مرساة واحدة دون إجهاد ذهني.'
                  : 'Activate Rescue Mode to defer secondary tasks and lock into a single high-impact anchor.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setRescueModeOpen(true)}
              className="btn small bg-amber-500 text-black font-semibold hover:bg-amber-400 border-none shadow-md text-xs"
            >
              <span>{isAr ? 'تفعيل وضع الإنقاذ الآن ✳' : 'Launch Rescue Mode ✳'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Daily Progress Strip (Factual & Honest Accomplishments) */}
      <div className="panel p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              {isAr ? 'إنجاز اليوم الفعلي (Daily Accomplishments)' : 'Today\'s Grounded Accomplishments'}
            </span>
          </div>
          <span className="text-[11px] text-muted font-mono">
            {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Tasks Output */}
          <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <span className="text-[var(--state-success)]">✓</span>
                <span>{isAr ? 'مهام أُنجزت' : 'Tasks Done'}</span>
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {doneTodayTasks.length}/{Math.max(todayTasks.length, doneTodayTasks.length)}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-track)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{
                  width: `${todayTasks.length > 0 ? Math.round((doneTodayTasks.length / todayTasks.length) * 100) : 0}%`
                }}
              />
            </div>
            <div className="text-[10px] text-muted flex justify-between">
              <span>{isAr ? 'المتبقي لليوم' : 'Pending today'}</span>
              <span className="font-mono text-[var(--text-primary)]">{pendingTodayTasks.length}</span>
            </div>
          </div>

          {/* Habits Output */}
          <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <span className="text-[var(--state-info)]">↻</span>
                <span>{isAr ? 'عادات طُبقت' : 'Habits Kept'}</span>
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {todayHabitDone}/{habits.length}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-track)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${habits.length > 0 ? Math.round((todayHabitDone / habits.length) * 100) : 0}%`
                }}
              />
            </div>
            <div className="text-[10px] text-muted flex justify-between">
              <span>{isAr ? 'نسبة الالتزام' : 'Compliance'}</span>
              <span className="font-mono text-[var(--text-primary)]">
                {habits.length > 0 ? Math.round((todayHabitDone / habits.length) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Deep Work Focus Time */}
          <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <span className="text-[var(--state-warning)]">◷</span>
                <span>{isAr ? 'تركيز وعمل عميق' : 'Focus Time'}</span>
              </span>
              <span className="font-mono font-bold text-[var(--state-warning-strong)]">
                {Math.floor(todayFocusMinutes / 60)}h {todayFocusMinutes % 60}m
              </span>
            </div>
            <div className="w-full bg-[var(--surface-track)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((todayFocusMinutes / 120) * 100))}%`
                }}
              />
            </div>
            <div className="text-[10px] text-muted flex justify-between">
              <span>{isAr ? 'جلسات اليوم' : 'Sessions today'}</span>
              <span className="font-mono text-[var(--text-primary)]">{todayFocusSessions.length} {isAr ? 'جلسات' : 'sessions'}</span>
            </div>
          </div>

          {/* Real Reading Pages */}
          <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <span className="text-[var(--state-warning-strong)]">📖</span>
                <span>{isAr ? 'صفحات قراءة' : 'Pages Read'}</span>
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {todayPagesRead} {isAr ? 'ص' : 'p'}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-track)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((todayPagesRead / (readingHabit?.readingData?.dailyTargetPages || 20)) * 100))}%`
                }}
              />
            </div>
            <div className="text-[10px] text-muted flex justify-between">
              <span>{isAr ? 'الهدف اليومي' : 'Target'}</span>
              <span className="font-mono text-[var(--text-primary)]">
                {readingHabit?.readingData?.dailyTargetPages || 20} {isAr ? 'ص' : 'p'}
              </span>
            </div>
          </div>

          {/* Real Workout Volume */}
          <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <span className="text-[var(--state-success)]">⚡</span>
                <span>{isAr ? 'تكرارات تدريب' : 'Workout Reps'}</span>
              </span>
              <span className="font-mono font-bold text-[var(--state-success)]">
                {todayWorkoutReps.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-track)] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, todayWorkoutReps > 0 ? 100 : 0)}%`
                }}
              />
            </div>
            <div className="text-[10px] text-muted flex justify-between">
              <span>{isAr ? 'حصص اليوم' : 'Sessions'}</span>
              <span className="font-mono text-[var(--text-primary)]">
                {todayWorkoutSessions.length} {isAr ? 'حصة' : 'logs'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Capture Input */}
      <QuickCaptureBar />

      {/* 5. Main Command Center Grid */}
      <div className="dashboard-grid">
        {/* Left Primary Column: Daily Focus (Top 3), Today's Agenda Timeline, Active Goals, Habit Studios */}
        <section className="dashboard-left space-y-6">
          {/* Daily Focus: Strictly 3 Anchor Tasks with Focus Launcher & Task Switcher */}
          <section className="panel focus-card border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl p-5 shadow-sm">
            <div className="panel-heading flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'بوصلة اليوم (Daily Focus)' : 'Daily Focus: Top 3 Anchors'}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent border border-[var(--border-strong)]">
                    {topThree.filter((t) => t.status === 'completed').length}/3 {isAr ? 'منجز' : 'done'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {isAr
                    ? 'ثلاث أولويات فقط تحمي انتباهك من التشظي. يمكنك تغييرها أو بدء التركيز الفوري عليها.'
                    : 'Strictly three priorities to anchor your cognitive capacity. Focus or swap freely.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTaskPickerOpen(true)}
                  className="btn subtle small text-xs border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-accent flex items-center gap-1"
                >
                  <span>+</span>
                  <span>{isAr ? 'إدارة / اختيار المهام' : 'Choose Priorities'}</span>
                </button>
                <button
                  onClick={() => setActiveNavTab('tasks')}
                  className="text-link text-xs"
                >
                  <span>{isAr ? 'كل المهام' : 'All tasks'}</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* 3 Priority Cards / Slots */}
            <div className="space-y-2.5">
              {[0, 1, 2].map((slotIndex) => {
                const task = topThree[slotIndex];
                if (!task) {
                  return (
                    <div
                      key={`empty-slot-${slotIndex}`}
                      onClick={() => setIsTaskPickerOpen(true)}
                      className="p-3.5 rounded-xl border border-dashed border-[var(--ring-color)] bg-[var(--surface-inset)]/50 hover:bg-[var(--surface-inset)] hover:border-accent/50 transition-all cursor-pointer flex items-center justify-between text-muted group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full border border-dashed border-[var(--border-strong)] text-xs flex items-center justify-center font-mono text-muted group-hover:text-accent group-hover:border-accent">
                          {slotIndex + 1}
                        </span>
                        <div>
                          <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-accent">
                            {isAr ? `أولوية شاغرة #${slotIndex + 1} — اضغط لاختيار مهمة` : `Priority Slot #${slotIndex + 1} — Click to assign`}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {isAr ? 'ثبّت مهمة محورية لليوم' : 'Anchor an essential commitment'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-accent font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        + {isAr ? 'تعيين' : 'Assign'}
                      </span>
                    </div>
                  );
                }

                const isDone = task.status === 'completed';

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isDone
                        ? 'border-[var(--border-subtle)] bg-[var(--surface-inset)] opacity-75'
                        : 'border-[var(--border-strong)] bg-[var(--surface-inset)] hover:border-accent/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        className={`check-circle ${isDone ? 'checked' : ''} shrink-0`}
                        onClick={() => toggleTaskStatus(task.id)}
                        aria-label="Toggle completed"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              isDone ? 'line-through text-muted' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`priority-dot ${
                              task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low'
                            }`}
                            title={`Priority ${task.priority}`}
                          />
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                          {task.scheduledTime ? (
                            <span className="font-mono text-accent/80 flex items-center gap-1">
                              <span>◷</span>
                              <span>{task.scheduledTime}</span>
                            </span>
                          ) : (
                            <span>{isAr ? 'دون وقت محدد' : 'Anytime today'}</span>
                          )}

                          {task.estimatedMinutes ? (
                            <span>· {task.estimatedMinutes}m</span>
                          ) : null}

                          {task.tags && task.tags[0] && (
                            <span className="px-1.5 py-0.2 rounded bg-[var(--surface-chip)] text-muted text-[10px]">
                              {task.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Start Focus Launcher & Unpin */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!isDone && (
                        <button
                          onClick={() => openFocusLauncher(task)}
                          className="btn subtle small text-xs border border-accent/30 text-accent hover:bg-accent/15 px-2.5 py-1 flex items-center gap-1"
                          title={isAr ? 'بدء جلسة تركيز لهذه المهمة' : 'Launch focus session'}
                        >
                          <span>◷</span>
                          <span>{isAr ? 'ركّز' : 'Focus'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleTopThree(task.id)}
                        className="mini-icon text-muted hover:text-[var(--state-danger)] p-1"
                        title={isAr ? 'إلغاء التثبيت من البوصلة' : 'Unpin from Top 3'}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Today's Adaptive Agenda (Overdue, Upcoming Flow, Completed) */}
          <section className="panel p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
            <div className="panel-heading flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'جدول وإيقاع اليوم (Today\'s Agenda)' : 'Today\'s Agenda & Flow'}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-1">
                  {isAr
                    ? 'تسلسل زمني يجمع مواعيدك، المهام المستحقة، وجلسات العمل المنجزة متكيفة مع مسار اليوم.'
                    : 'Adaptive chronology uniting scheduled tasks, overdue loops, and completed focus sessions.'}
                </p>
              </div>

              {/* Agenda Filters */}
              <div className="flex items-center gap-1 bg-[var(--surface-inset)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs">
                <button
                  onClick={() => setAgendaTab('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    agendaTab === 'all' ? 'bg-accent text-black font-semibold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'} ({overdueTasks.length + upcomingTasks.length + completedTodayItems.length})
                </button>
                <button
                  onClick={() => setAgendaTab('overdue')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    agendaTab === 'overdue' ? 'bg-rose-500 text-[var(--text-on-state)] font-semibold' : 'text-muted hover:text-[var(--state-danger-strong)]'
                  }`}
                >
                  {isAr ? 'متأخرة' : 'Overdue'} ({overdueTasks.length})
                </button>
                <button
                  onClick={() => setAgendaTab('upcoming')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    agendaTab === 'upcoming' ? 'bg-teal-500 text-black font-semibold' : 'text-muted hover:text-[var(--state-info-strong)]'
                  }`}
                >
                  {isAr ? 'القادمة' : 'Upcoming'} ({upcomingTasks.length})
                </button>
                <button
                  onClick={() => setAgendaTab('completed')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    agendaTab === 'completed' ? 'bg-emerald-600 text-[var(--text-on-state)] font-semibold' : 'text-muted hover:text-[var(--state-success-strong)]'
                  }`}
                >
                  {isAr ? 'المنجز' : 'Completed'} ({completedTodayItems.length})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Section 1: Overdue Alerts (if showing all or overdue) */}
              {(agendaTab === 'all' || agendaTab === 'overdue') && overdueTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--state-danger)] px-1">
                    <span className="flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>{isAr ? 'مهام متأخرة تحتاج معالجة' : 'Overdue Tasks Requiring Action'}</span>
                    </span>
                    <span className="font-mono text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {overdueTasks.length} {isAr ? 'مهام' : 'tasks'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {overdueTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl border border-rose-500/30 bg-[var(--state-danger-soft)] hover:border-rose-500/50 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            className="check-circle shrink-0"
                            onClick={() => toggleTaskStatus(task.id)}
                            aria-label="Toggle completed"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--state-danger-strong)]/80 font-mono">
                              <span>
                                {task.scheduledDate && task.scheduledDate < todayStr
                                  ? `${isAr ? 'مستحقة منذ' : 'Due since'} ${task.scheduledDate}`
                                  : `${isAr ? 'فات موعدها اليوم' : 'Past time'} (${task.scheduledTime || ''})`}
                              </span>
                              {task.estimatedMinutes && <span>· {task.estimatedMinutes}m</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openFocusLauncher(task)}
                            className="btn subtle small text-xs border border-rose-500/30 text-[var(--state-danger-strong)] hover:bg-rose-500/20 px-2 py-1"
                            title={isAr ? 'إنجازها الآن بتركيز' : 'Focus now'}
                          >
                            <span>◷ {isAr ? 'إنجاز الآن' : 'Focus'}</span>
                          </button>
                          <button
                            onClick={() => updateTask(task.id, { scheduledDate: tomorrowStr })}
                            className="btn subtle small text-xs text-muted hover:text-[var(--text-primary)] px-2 py-1"
                            title={isAr ? 'ترحيل إلى الغد' : 'Defer to tomorrow'}
                          >
                            <span>↷ {isAr ? 'للغد' : 'Tomorrow'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Upcoming in Flow (if showing all or upcoming) */}
              {(agendaTab === 'all' || agendaTab === 'upcoming') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--state-info-strong)] px-1">
                    <span className="flex items-center gap-1.5">
                      <span>⏳</span>
                      <span>{isAr ? 'القادم في مسار اليوم' : 'Upcoming in Today\'s Flow'}</span>
                    </span>
                    <span className="font-mono text-[11px] bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {upcomingTasks.length} {isAr ? 'مهام' : 'items'}
                    </span>
                  </div>

                  {upcomingTasks.length === 0 ? (
                    <div className="p-4 text-center rounded-xl border border-dashed border-[var(--border-default)] text-xs text-muted">
                      {isAr ? 'لا توجد مهام قادمة مجدولة لباقي اليوم. وقتك مفتوح وهادئ.' : 'No more scheduled tasks for today. Your day is open.'}
                    </div>
                  ) : (
                    <div className="timeline space-y-2">
                      {upcomingTasks.map((task, i) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-inset)] hover:border-accent/40 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              className="check-circle shrink-0"
                              onClick={() => toggleTaskStatus(task.id)}
                              aria-label="Toggle completed"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                                <span className="font-mono text-[var(--state-info)]">
                                  {task.scheduledTime || (isAr ? 'اليوم' : 'Today')}
                                </span>
                                {task.estimatedMinutes && <span>· {task.estimatedMinutes}m</span>}
                                {task.tags && task.tags[0] && (
                                  <span className="px-1.5 py-0.2 rounded bg-[var(--surface-chip)] text-[10px]">
                                    {task.tags[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => openFocusLauncher(task)}
                              className="btn subtle small text-xs border border-teal-500/30 text-[var(--state-info-strong)] hover:bg-teal-500/20 px-2.5 py-1"
                            >
                              <span>◷ {isAr ? 'تركيز' : 'Focus'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Completed Today (if showing all or completed) */}
              {(agendaTab === 'all' || agendaTab === 'completed') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--state-success)] px-1">
                    <span className="flex items-center gap-1.5">
                      <span>✓</span>
                      <span>{isAr ? 'ما أُنجز اليوم (مهام وجلسات تركيز)' : 'Accomplished Today'}</span>
                    </span>
                    <span className="font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {completedTodayItems.length} {isAr ? 'إنجاز' : 'items'}
                    </span>
                  </div>

                  {completedTodayItems.length === 0 ? (
                    <div className="p-4 text-center rounded-xl border border-dashed border-[var(--border-default)] text-xs text-muted">
                      {isAr ? 'لم تسجل إنجازات بعد اليوم. ابدأ بمهمة واحدة سهلة لصنع الزخم.' : 'No completed items yet today. Start with 1 small win.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedTodayItems.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-[var(--state-success)] flex items-center justify-center font-bold text-[10px] shrink-0">
                              {c.type === 'task' ? '✓' : '◷'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-[var(--text-primary)] line-through truncate block">
                                {c.title}
                              </span>
                              <span className="text-[10px] text-muted font-mono">
                                {c.time} {c.type === 'focus' ? `· ${c.duration} ${isAr ? 'دقيقة تركيز' : 'min'}` : ''}
                              </span>
                            </div>
                          </div>

                          {c.type === 'task' && (
                            <button
                              onClick={() => toggleTaskStatus((c.item as Task).id)}
                              className="text-[10px] text-muted hover:text-[var(--text-primary)] font-mono underline"
                            >
                              {isAr ? 'تراجع' : 'Undo'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Today's Habits & Direct Specialized Studio Launchers */}
          <section className="panel p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
            <div className="panel-heading flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-strong"></span>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'عادات اليوم واستوديوهات الإتقان' : 'Today\'s Habits & Specialized Studios'}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-1">
                  {isAr
                    ? 'عاداتك المستحقة اليوم مع بوابات فورية لاستوديوهات القراءة واللياقة والمرسم.'
                    : 'Habits due today with direct jump-in to autonomous reading, fitness, and art systems.'}
                </p>
              </div>

              <button
                onClick={() => setActiveNavTab('habits')}
                className="text-link text-xs"
              >
                <span>{isAr ? 'كل العادات' : 'All habits'}</span>
                <span>→</span>
              </button>
            </div>

            {/* 4 Specialized Habit Studios Strip */}
            {(() => {
              const quranHabit = habits.find((h) => h.specializedType === 'quran');
              const readingHabit = habits.find((h) => h.specializedType === 'reading');
              const workoutHabit = habits.find((h) => h.specializedType === 'workout');
              const drawingHabit = habits.find((h) => h.specializedType === 'drawing');

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  <button
                    onClick={() => setActiveNavTab('quran')}
                    className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-start transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">📜</span>
                      <span className="text-[10px] font-mono text-[var(--state-success)]">↗</span>
                    </div>
                    <strong className="text-xs text-[var(--text-primary)] block">{isAr ? 'استوديو حفظ القرآن' : 'Quran Studio'}</strong>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {quranHabit?.quranData?.totalAyahsMemorized
                        ? `${quranHabit.quranData.totalAyahsMemorized} ${isAr ? 'آية مثبتة' : 'ayahs'}`
                        : (isAr ? 'خريطة السور والتسميع' : 'Surah map & test')}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveNavTab('reading')}
                    className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 text-start transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">📖</span>
                      <span className="text-[10px] font-mono text-[var(--state-warning)]">↗</span>
                    </div>
                    <strong className="text-xs text-[var(--text-primary)] block">{isAr ? 'استوديو القراءة' : 'Reading Studio'}</strong>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {readingHabit?.readingData?.totalPagesRead
                        ? `${readingHabit.readingData.totalPagesRead} ${isAr ? 'صفحة مقروءة' : 'pages read'}`
                        : (isAr ? 'خزانة الكتب والملاحظات' : 'Library & quotes')}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveNavTab('workout')}
                    className="p-3 rounded-xl border border-teal-500/25 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500/40 text-start transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">⚡</span>
                      <span className="text-[10px] font-mono text-[var(--state-info)]">↗</span>
                    </div>
                    <strong className="text-xs text-[var(--text-primary)] block">{isAr ? 'استوديو التمارين' : 'Workout Studio'}</strong>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {workoutHabit?.workoutData?.totalWorkouts
                        ? `${workoutHabit.workoutData.totalWorkouts} ${isAr ? 'حصص تدريبية' : 'workouts'}`
                        : (isAr ? 'تمارين وزن الجسم والرشاقة' : 'Bodyweight circuits')}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveNavTab('drawing')}
                    className="p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40 text-start transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">🎨</span>
                      <span className="text-[10px] font-mono text-[var(--state-purple)]">↗</span>
                    </div>
                    <strong className="text-xs text-[var(--text-primary)] block">{isAr ? 'مرسم الإبداع' : 'Art Studio'}</strong>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {drawingHabit?.drawingData?.totalSketches
                        ? `${drawingHabit.drawingData.totalSketches} ${isAr ? 'أعمال فنية' : 'sketches'}`
                        : (isAr ? 'المشاريع ومعرض الرسوم' : 'Projects & gallery')}
                    </span>
                  </button>
                </div>
              );
            })()}

            {/* Habit Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {habits.filter((h) => !h.isArchived && h.status !== 'archived').map((habit) => {
                const isDone = habit.completedDates.includes(todayStr);

                return (
                  <div
                    key={habit.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isDone
                        ? 'border-emerald-500/30 bg-[var(--surface-inset)]'
                        : 'border-[var(--ring-color)] bg-[var(--surface-inset)] hover:border-accent/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            className={`check-circle ${isDone ? 'checked' : ''} shrink-0`}
                            onClick={() => toggleHabitToday(habit.id)}
                            aria-label="Toggle habit today"
                          />
                          <div className="min-w-0">
                            <h3
                              className={`text-xs font-bold truncate ${
                                isDone ? 'line-through text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {habit.name}
                            </h3>
                            {habit.anchor && (
                              <p className="text-[10px] text-muted truncate max-w-[200px]">
                                {habit.anchor}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent border border-[var(--border-strong)] shrink-0">
                          {habit.currentStreak || 0} {isAr ? 'يوم' : 'd'} ♨
                        </span>
                      </div>
                    </div>

                    {/* Specialized Studio Quick Access Footer */}
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
                      {habit.specializedType === 'quran' && (
                        <button
                          onClick={() => setActiveNavTab('quran')}
                          className="text-[var(--state-success)] hover:text-[var(--state-success-strong)] font-medium flex items-center gap-1 text-xs"
                        >
                          <span>📜</span>
                          <span>{isAr ? 'استوديو حفظ القرآن ↗' : 'Quran Studio ↗'}</span>
                        </button>
                      )}

                      {habit.specializedType === 'reading' && (
                        <button
                          onClick={() => setActiveNavTab('reading')}
                          className="text-[var(--state-warning)] hover:text-[var(--state-warning-strong)] font-medium flex items-center gap-1 text-xs"
                        >
                          <span>📖</span>
                          <span>{isAr ? 'استوديو ومكتبة القراءة ↗' : 'Reading Studio ↗'}</span>
                        </button>
                      )}

                      {habit.specializedType === 'workout' && (
                        <button
                          onClick={() => setActiveNavTab('workout')}
                          className="text-[var(--state-info)] hover:text-[var(--state-info-strong)] font-medium flex items-center gap-1 text-xs"
                        >
                          <span>⚡</span>
                          <span>{isAr ? 'استوديو التمارين المنزلية ↗' : 'Home Fitness ↗'}</span>
                        </button>
                      )}

                      {habit.specializedType === 'drawing' && (
                        <button
                          onClick={() => setActiveNavTab('drawing')}
                          className="text-[var(--state-purple)] hover:text-[var(--state-purple)] font-medium flex items-center gap-1 text-xs"
                        >
                          <span>🎨</span>
                          <span>{isAr ? 'مرسم الإبداع والفن ↗' : 'Art Studio ↗'}</span>
                        </button>
                      )}

                      {!habit.specializedType && (
                        <span className="text-muted text-[10px]">
                          {habit.category === 'mind' ? '🧠 ذهن' : habit.category === 'health' ? '🌱 صحة' : '✦ نمط حياة'}
                        </span>
                      )}

                      <button
                        onClick={() => toggleHabitToday(habit.id)}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded transition-all ${
                          isDone
                            ? 'text-muted hover:text-[var(--text-primary)]'
                            : 'bg-accent/15 text-accent hover:bg-accent/25'
                        }`}
                      >
                        {isDone ? (isAr ? 'إلغاء' : 'Undo') : (isAr ? 'تأكيد الإنجاز ✓' : 'Check ✓')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Active Goals & Progress Intelligence Hub */}
          <section className="panel p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
            <div className="panel-heading flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></span>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'الأهداف الاستراتيجية النشطة' : 'Active Strategic Goals & Momentum'}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-1">
                  {isAr
                    ? 'تقدم حي مستمد مباشرة من سجلات المهام والعادات والكتب والتمارين.'
                    : 'Live progress dynamically calculated from actual completed tasks, habits, and sessions.'}
                </p>
              </div>

              <button
                onClick={() => setActiveNavTab('goals')}
                className="text-link text-xs"
              >
                <span>{isAr ? 'خارطة الأهداف' : 'All goals'}</span>
                <span>→</span>
              </button>
            </div>

            {(() => {
              const activeGoals = goals.filter((g) => g.status === 'active');
              if (activeGoals.length === 0) {
                return (
                  <div className="p-4 text-center border border-dashed border-[var(--border-default)] rounded-xl text-xs text-muted space-y-2">
                    <span className="text-xl block">🎯</span>
                    <strong className="text-[var(--text-primary)] block">{isAr ? 'لا توجد أهداف نشطة حالياً' : 'No active goals right now'}</strong>
                    <button
                      onClick={() => setActiveNavTab('goals')}
                      className="btn primary small text-xs"
                    >
                      + {isAr ? 'تحديد هدف استراتيجي' : 'Define Goal'}
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeGoals.slice(0, 2).map((g) => {
                    const intel = evaluateGoalProgress(g, tasks, habits);
                    return (
                      <div
                        key={g.id}
                        onClick={() => setInspectingGoal(g)}
                        className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-inset)] hover:border-accent/40 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                                intel.pacingStatus === 'ahead'
                                  ? 'bg-emerald-500/15 text-[var(--state-success-strong)] border-emerald-500/30'
                                  : intel.pacingStatus === 'dormant'
                                  ? 'bg-amber-500/15 text-[var(--state-warning-strong)] border-amber-500/30 animate-pulse'
                                  : intel.pacingStatus === 'behind'
                                  ? 'bg-rose-500/15 text-[var(--state-danger-strong)] border-rose-500/30'
                                  : 'bg-teal-500/15 text-[var(--state-info-strong)] border-teal-500/30'
                              }`}
                            >
                              {isAr ? intel.pacingLabelAr : intel.pacingLabelEn}
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="text-[var(--state-success)] font-bold" title={isAr ? 'النتيجة المحققة' : 'Outcome'}>
                                {intel.outcomeProgressPercent}%
                              </span>
                              <span className="text-muted text-[10px]">/</span>
                              <span className="text-accent font-bold" title={isAr ? 'التقدم التنفيذي' : 'Execution'}>
                                {intel.executionProgressPercent}%
                              </span>
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate leading-snug">
                            {g.title}
                          </h3>

                          {/* Dual Progress Lines: Outcome (emerald) & Execution (teal/accent) */}
                          <div className="space-y-1">
                            <div className="w-full bg-[var(--surface-chip)] rounded-full h-1.5 overflow-hidden border border-[var(--ring-color)]">
                              <div
                                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${intel.outcomeProgressPercent}%` }}
                                title={isAr ? `النتيجة المحققة: ${intel.outcomeProgressPercent}%` : `Outcome: ${intel.outcomeProgressPercent}%`}
                              />
                            </div>
                            <div className="w-full bg-[var(--surface-chip)] rounded-full h-1 overflow-hidden border border-[var(--ring-color)]/60">
                              <div
                                className="bg-accent h-full rounded-full transition-all duration-300"
                                style={{ width: `${intel.executionProgressPercent}%` }}
                                title={isAr ? `التقدم التنفيذي: ${intel.executionProgressPercent}%` : `Execution: ${intel.executionProgressPercent}%`}
                              />
                            </div>
                          </div>

                          {/* Primary Key Result headline */}
                          {intel.evaluatedKrs[0] && (
                            <div className="text-[11px] text-muted flex items-center justify-between">
                              <span className="truncate max-w-[170px]">{intel.evaluatedKrs[0].title}</span>
                              <span className="font-mono text-[var(--text-primary)] shrink-0 font-medium">
                                {intel.evaluatedKrs[0].evaluatedCurrentValue}/{intel.evaluatedKrs[0].targetValue} {intel.evaluatedKrs[0].unit}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-muted">
                          <span className="truncate max-w-[200px]">
                            {intel.linkedTasksCount} {isAr ? 'مهام' : 'tasks'} · {intel.linkedHabitsCount} {isAr ? 'عادات' : 'habits'}
                            {intel.contributions.length > 0 && ` · ${intel.contributions.length} ${isAr ? 'نشاط' : 'acts'}`}
                          </span>
                          <span className="text-accent hover:underline font-medium shrink-0">
                            {isAr ? 'فحص المؤشرات ↗' : 'Inspect ↗'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        </section>

        {/* Right Aside Column: Energy Gauge, Week Ahead, Quick Shortcuts */}
        <aside className="dashboard-right space-y-6">
          {/* Energy Gauge & Rhythm */}
          <section className="panel focus-card border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl p-5 shadow-sm">
            <div className="panel-heading flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">{isAr ? 'طاقتك وإيقاع اليوم' : 'Daily Energy Gauge'}</h2>
                <p className="text-xs text-muted">{isAr ? 'تقدير هادئ مبني على النوم والمزاج وما أنجزته.' : 'Gentle estimate from recovery and progress.'}</p>
              </div>
              <span className="tag green">{energyScore}%</span>
            </div>

            <div className="energy-layout flex items-center gap-4">
              <div
                className="energy-ring shrink-0"
                style={{
                  background: `conic-gradient(var(--accent-strong) ${energyScore}%, var(--ring-color) 0)`
                }}
              >
                <div className="energy-number font-mono">
                  {energyScore}
                  <small>%</small>
                </div>
              </div>

              <div className="energy-info text-xs space-y-1">
                <strong className="text-[var(--text-primary)] block font-semibold">
                  {energyScore < 45
                    ? (isAr ? 'احمِ طاقتك اليوم' : 'Protect your energy')
                    : energyScore < 75
                    ? (isAr ? 'إيقاع ثابت يكفي' : 'Steady pacing is enough')
                    : (isAr ? 'لديك مساحة لدفعة أعمق' : 'Room for a deeper push')}
                </strong>
                <p className="text-muted text-[11px] leading-relaxed">
                  {isAr
                    ? 'التركيز في ٣ أولويات يحميك من الإنهاك. عندما تشعر بالإجهاد، فعّل وضع الإنقاذ.'
                    : 'Focusing on 3 anchors prevents cognitive fatigue. Use Rescue Mode when overloaded.'}
                </p>
              </div>
            </div>

            <div className="energy-inputs flex items-center justify-between gap-1 mt-4 pt-3 border-t border-[var(--border-subtle)]">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`energy-chip flex-1 text-center py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    Math.round(energyScore / 20) === n
                      ? 'bg-accent/20 border-accent text-accent font-bold'
                      : 'border-[var(--border-subtle)] text-muted hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setActiveNavTab('health')}
                  title={isAr ? 'تحديث قياسات الصحة والطاقة' : 'Update health metrics'}
                >
                  {n === 1 ? '☁ 1' : n === 2 ? '◔ 2' : n === 3 ? '◑ 3' : n === 4 ? '◕ 4' : '✦ 5'}
                </button>
              ))}
            </div>
          </section>

          {/* Week Ahead Overview */}
          <section className="panel p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
            <div className="panel-heading flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{isAr ? 'أسبوعك' : 'Your Week'}</h2>
                <p className="text-xs text-muted">{isAr ? 'توزيع الأيام ونقاط الزخم' : 'Week distribution'}</p>
              </div>
              <button
                onClick={() => setActiveNavTab('calendar')}
                className="text-link text-xs"
              >
                <span>{isAr ? 'التقويم' : 'Calendar'}</span>
                <span>→</span>
              </button>
            </div>

            <div className="week-strip grid grid-cols-7 gap-1">
              {weekDays.map((wd) => (
                <button
                  key={wd.key}
                  type="button"
                  onClick={() => setActiveNavTab('calendar')}
                  className={`week-day p-2 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                    wd.isToday
                      ? 'bg-accent text-black font-bold shadow-md'
                      : wd.hasItems
                      ? 'bg-[var(--surface-inset)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                      : 'bg-[var(--surface-sunken)] text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-[10px] block opacity-80">{wd.dayLabel}</span>
                  <strong className="text-sm font-mono block mt-0.5">{wd.dayNum}</strong>
                  {wd.hasItems && !wd.isToday && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1" />}
                </button>
              ))}
            </div>
          </section>

          {/* Quick Shortcuts Panel */}
          <section className="panel p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-sm">
            <div className="panel-heading flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</h2>
                <p className="text-xs text-muted">{isAr ? 'خطوات فورية لصنع الزخم' : 'Immediate momentum steps'}</p>
              </div>
              <span className="text-accent text-sm">✳</span>
            </div>

            <div className="space-y-2">
              <button
                className="task-row w-full text-start p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:border-accent/40 transition-all flex items-center justify-between text-xs"
                onClick={() => openFocusLauncher()}
              >
                <div className="flex items-center gap-2.5">
                  <span className="metric-icon orange text-sm">◷</span>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)] block">{isAr ? 'بدء مؤقت التركيز' : 'Launch Focus Timer'}</span>
                    <span className="text-[11px] text-muted">{isAr ? 'بومودورو أو عمل عميق' : 'Pomodoro or deep work'}</span>
                  </div>
                </div>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5 text-muted" />
              </button>

              <button
                className="task-row w-full text-start p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:border-accent/40 transition-all flex items-center justify-between text-xs"
                onClick={() => setActiveNavTab('journal')}
              >
                <div className="flex items-center gap-2.5">
                  <span className="metric-icon blue text-sm">✎</span>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)] block">{isAr ? 'تدوين تأمل اليوم' : 'Daily Journal Entry'}</span>
                    <span className="text-[11px] text-muted">{isAr ? 'تفريغ الذهن ومراجعة اليوم' : '3 min mental reset'}</span>
                  </div>
                </div>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5 text-muted" />
              </button>

              <button
                className="task-row w-full text-start p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:border-accent/40 transition-all flex items-center justify-between text-xs"
                onClick={() => setRescueModeOpen(true)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="metric-icon text-[var(--state-warning)] text-sm">✳</span>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)] block">{isAr ? 'إعادة ضبط اليوم (Rescue)' : 'Rescue Mode Reset'}</span>
                    <span className="text-[11px] text-muted">{isAr ? 'تخفيف الحمل الذهني' : 'Shelve non-essentials'}</span>
                  </div>
                </div>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          </section>
        </aside>
      </div>

      {/* =========================================================================
          MODALS & OVERLAYS
         ========================================================================= */}

      {/* A. Task Picker Modal for Daily Focus (Top 3 Priorities) */}
      {isTaskPickerOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsTaskPickerOpen(false)}
        >
          <div
            className="modal w-full max-w-lg bg-[var(--surface-raised)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {isAr ? 'اختيار أولويات بوصلة اليوم (Top 3)' : 'Select Top 3 Priorities'}
                </h2>
                <p className="text-xs text-muted">
                  {isAr
                    ? 'اختر حتى ٣ مهام أساسية لتثبيتها في بوصلة اليوم. يمكنك تبديلها في أي وقت.'
                    : 'Select up to 3 essential tasks to anchor today. Swap anytime.'}
                </p>
              </div>
              <button
                onClick={() => setIsTaskPickerOpen(false)}
                className="text-muted hover:text-[var(--text-primary)] text-lg p-1"
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
              {tasks.filter((t) => t.status !== 'completed').length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  {isAr ? 'لا توجد مهام معلقة لاختيارها! أضف مهمة أولاً.' : 'No pending tasks available to choose.'}
                </div>
              ) : (
                tasks
                  .filter((t) => t.status !== 'completed')
                  .map((task) => {
                    const isPinned = task.isTopThree;
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTopThree(task.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isPinned
                            ? 'border-accent bg-accent/10'
                            : 'border-[var(--border-strong)] bg-[var(--surface-inset)] hover:border-accent/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs ${
                              isPinned
                                ? 'bg-accent border-accent text-black'
                                : 'border-[var(--border-strong)] text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate block">
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                              {task.scheduledTime && <span>◷ {task.scheduledTime}</span>}
                              {task.estimatedMinutes && <span>· {task.estimatedMinutes}m</span>}
                              {task.tags && task.tags[0] && <span>· {task.tags[0]}</span>}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded font-mono ${
                            isPinned
                              ? 'bg-accent text-black font-bold'
                              : 'text-muted hover:text-accent'
                          }`}
                        >
                          {isPinned ? (isAr ? 'مثبتة ✓' : 'Pinned ✓') : (isAr ? '+ تثبيت' : '+ Pin')}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
              <span className="text-xs text-muted font-mono">
                {topThree.length}/3 {isAr ? 'مهام مثبتة' : 'tasks pinned'}
              </span>
              <button
                onClick={() => setIsTaskPickerOpen(false)}
                className="btn primary small text-xs"
              >
                {isAr ? 'تم وحفظ' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B. Focus Launcher Modal (Interactive Session Runner) */}
      {isFocusModalOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => {
            if (!focusRunning) setIsFocusModalOpen(false);
          }}
        >
          <div
            className="modal w-full max-w-md bg-[var(--surface-sunken)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-2xl text-center space-y-5"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-accent">
                  {isAr ? 'جلسة تركيز مباشر (Focus Launcher)' : 'Focus Session Launcher'}
                </span>
              </div>
              <button
                onClick={() => setIsFocusModalOpen(false)}
                className="text-muted hover:text-[var(--text-primary)] text-lg p-1"
                disabled={focusRunning}
              >
                ×
              </button>
            </div>

            {/* Task Banner */}
            <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-strong)] text-start">
              <span className="text-[10px] text-accent block font-mono">
                {focusingTask ? (isAr ? 'المهمة المستهدفة بالتركيز:' : 'Anchor Task:') : (isAr ? 'تركيز حر:' : 'Free Focus:')}
              </span>
              <strong className="text-sm text-[var(--text-primary)] block mt-0.5 truncate">
                {focusingTask?.title || (isAr ? 'جلسة عمل عميق حرة بدون مهمة محددة' : 'Unbound Deep Work Session')}
              </strong>
            </div>

            {/* Presets if not running */}
            {!focusRunning && (
              <div className="flex items-center justify-center gap-2">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setFocusPreset(mins);
                      setFocusRemaining(mins * 60);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                      focusPreset === mins
                        ? 'bg-accent text-black font-bold border-accent shadow-sm'
                        : 'border-[var(--border-strong)] text-muted hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            )}

            {/* Circular Countdown Display */}
            <div className="py-4">
              <div className="text-5xl md:text-6xl font-mono font-bold tracking-tight text-[var(--text-primary)] mb-2">
                {`${Math.floor(focusRemaining / 60)
                  .toString()
                  .padStart(2, '0')}:${(focusRemaining % 60).toString().padStart(2, '0')}`}
              </div>
              <p className="text-xs text-muted">
                {focusRunning
                  ? (isAr ? 'حالة التدفق نشطة · تجنب الإشعارات' : 'Flow state active · zero distractions')
                  : (isAr ? 'جاهز للبدء؟ اختر المدة واضغط انطلاق' : 'Ready? Select preset and start')}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!focusRunning ? (
                <button
                  onClick={() => setFocusRunning(true)}
                  className="btn primary px-6 py-2.5 text-sm font-bold shadow-lg"
                >
                  <span>▶</span>
                  <span>{isAr ? 'بدء التركيز' : 'Start Focus'}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setFocusRunning(false)}
                    className="btn subtle text-xs border border-amber-500/40 text-[var(--state-warning-strong)] px-4 py-2"
                  >
                    <span>⏸ {isAr ? 'إيقاف مؤقت' : 'Pause'}</span>
                  </button>
                  <button
                    onClick={() => handleFinishFocusSession(true)}
                    className="btn primary text-xs px-4 py-2 font-bold"
                  >
                    <span>✓ {isAr ? 'إتمام وحفظ الإنجاز' : 'Finish & Log'}</span>
                  </button>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-muted">
              <button
                onClick={() => {
                  setIsFocusModalOpen(false);
                  setActiveNavTab('focus');
                }}
                className="text-accent hover:underline text-[11px]"
              >
                {isAr ? 'فتح لوحة التركيز الكاملة ↗' : 'Open Full Focus Mode ↗'}
              </button>
              <button
                onClick={() => {
                  setFocusRunning(false);
                  setIsFocusModalOpen(false);
                }}
                className="text-muted hover:text-[var(--text-primary)] text-[11px]"
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
