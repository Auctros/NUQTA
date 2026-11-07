import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { WorkoutRoutine, ExerciseEntry, ExerciseSet } from '../types';
import { NuqtaIcon } from './NuqtaIcon';

export const WorkoutView: React.FC = () => {
  const {
    habits,
    createHabit,
    profile,
    logWorkoutSession,
    addOrUpdateWorkoutRoutine,
    deleteWorkoutRoutine,
    updateFitnessTargets,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  const workoutHabit = habits.find((h) => h.specializedType === 'workout');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'routines' | 'history' | 'targets'>('dashboard');

  const workoutData = workoutHabit?.workoutData || {
    sessions: [],
    customRoutines: [],
    weeklyTargetSessions: 4,
    monthlyTargetReps: 500,
    totalReps: 0,
    totalVolumeKg: 0,
    totalMinutes: 0,
    totalWorkouts: 0,
    favoriteRoutine: 'Home Calisthenics'
  };

  // Session Logger State
  const [sessionTitle, setSessionTitle] = useState('تمارين وزن الجسم والرشاقة');
  const [workoutType, setWorkoutType] = useState<'bodyweight' | 'strength' | 'cardio' | 'hiit' | 'mobility'>('bodyweight');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [intensityRating, setIntensityRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sessionNotes, setSessionNotes] = useState('');
  const [repsInput, setRepsInput] = useState(60);
  const [sessionExercises, setSessionExercises] = useState<ExerciseEntry[]>([
    {
      id: 'ex-1',
      name: 'تمرين الضغط (Push-ups)',
      category: 'chest',
      movement: 'push',
      sets: [
        { setNumber: 1, reps: 15, completed: true },
        { setNumber: 2, reps: 15, completed: true }
      ]
    },
    {
      id: 'ex-2',
      name: 'سكوات بوزن الجسم (Air Squats)',
      category: 'legs',
      movement: 'legs',
      sets: [
        { setNumber: 1, reps: 20, completed: true },
        { setNumber: 2, reps: 20, completed: true }
      ]
    }
  ]);
  const [showLogSuccess, setShowLogSuccess] = useState(false);

  // Targets state
  const [tempWeeklySessions, setTempWeeklySessions] = useState(workoutData.weeklyTargetSessions || 4);
  const [tempMonthlyReps, setTempMonthlyReps] = useState(workoutData.monthlyTargetReps || 500);
  const [targetsSaved, setTargetsSaved] = useState(false);

  // Handle initialization if not present
  const handleInitWorkoutHabit = () => {
    createHabit({
      name: isAr ? 'تمارين وزن الجسم والرشاقة المنزلية' : 'Home Calisthenics & Fitness',
      anchor: isAr ? 'بعد إنهاء العمل -> أبدأ تمارين الضغط والسكوات' : 'After work -> start home workout',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'workout'
    });
  };

  // Submit session
  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutHabit) return;

    const totalRepsCalculated = sessionExercises.reduce(
      (sum, ex) => sum + ex.sets.reduce((sSum, set) => sSum + (set.completed ? set.reps : 0), 0),
      0
    ) || repsInput;

    logWorkoutSession(workoutHabit.id, {
      title: sessionTitle.trim(),
      workoutType,
      durationMinutes: Number(durationMinutes),
      totalReps: totalRepsCalculated,
      volumeKg: 0,
      intensityRating,
      difficultyLevel: 'intermediate',
      exercises: sessionExercises,
      notes: sessionNotes.trim() || undefined
    });

    setShowLogSuccess(true);
    setSessionNotes('');
    setTimeout(() => {
      setShowLogSuccess(false);
      setActiveTab('dashboard');
    }, 1800);
  };

  // Save targets
  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutHabit) return;
    updateFitnessTargets(workoutHabit.id, {
      weeklyTargetSessions: Number(tempWeeklySessions),
      monthlyTargetReps: Number(tempMonthlyReps)
    });
    setTargetsSaved(true);
    setTimeout(() => setTargetsSaved(false), 2500);
  };

  if (!workoutHabit) {
    return (
      <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="page-heading">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="line"></span>
              <span className="font-mono text-[var(--d-workout-accent)]">NUQTA / HOME FITNESS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
              {isAr ? 'استوديو اللياقة المنزلية' : 'Home Fitness & Calisthenics'}
            </h1>
            <p className="text-sm text-muted">
              {isAr ? 'تمارين وزن الجسم، وتتبع التكرارات، وبناء القوة والرشاقة دون أجهزة معقدة.' : 'Bodyweight mastery, reps analytics, and home workout routines.'}
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl border border-emerald-500/30 bg-[var(--d-workout-surface)] text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-[var(--d-workout-accent)] flex items-center justify-center text-3xl mx-auto border border-emerald-500/30">
            ⚡
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'ابدأ رحلة القوة والرشاقة من منزلك' : 'Initialize Home Fitness Studio'}
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            {isAr
              ? 'تتبع التكرارات اليومية، الحصص التدريبية، ومجموعات التمارين الذاتية بانتظام.'
              : 'Autonomous fitness engine with routines, reps volume tracker, and habit cadence.'}
          </p>
          <button
            onClick={handleInitWorkoutHabit}
            className="btn primary px-6 py-2.5 text-sm font-bold shadow-lg"
          >
            <span>+</span>
            <span>{isAr ? 'تفعيل استوديو التمارين الآن' : 'Enable Workout Studio'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Page Heading */}
      <div className="page-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="line"></span>
            <span className="font-mono text-[var(--d-workout-accent)]">NUQTA / HOME FITNESS</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            {isAr ? 'استوديو اللياقة المنزلية' : 'Home Fitness & Calisthenics'}
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {isAr
              ? 'مساحة التدريب المنزلي، تكرارات وزن الجسم، وبرامج الكاليسثنكس والرشاقة.'
              : 'Bodyweight training sanctuary, volume tracking, and daily physical vitality.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('session')}
            className="btn primary small text-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isAr ? 'تسجيل تمرين منزلي' : 'Log Workout Session'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle small text-xs flex items-center gap-1.5"
            title={isAr ? 'فتح أرشيف وسجل التمارين الشامل' : 'Open Workout Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('habits')}
            className="btn subtle small text-xs"
          >
            <span>{isAr ? 'كل العادات' : 'All Habits'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Reps */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'إجمالي التكرارات' : 'Total Reps'}</span>
            <span className="text-[var(--d-workout-accent)] text-xs">⚡</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--d-workout-accent)]">
              {(workoutData.totalReps || 0).toLocaleString()}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'تكرار' : 'reps'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'الهدف الشهري:' : 'Monthly Target:'} {workoutData.monthlyTargetReps || 500} {isAr ? 'تكرار' : 'reps'}
          </span>
        </div>

        {/* Workouts Logged */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الحصص المنجزة' : 'Workouts Logged'}</span>
            <span className="text-[var(--state-info)] text-xs">✓</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {workoutData.totalWorkouts || 0}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'حصة' : 'sessions'}</span>
          </div>
          <span className="text-[10px] text-muted block font-mono">
            ~{Math.round((workoutData.totalMinutes || 0) / 60)} {isAr ? 'ساعات تدريب' : 'hours total'}
          </span>
        </div>

        {/* Weekly Target Sessions */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الهدف الأسبوعي' : 'Weekly Sessions'}</span>
            <span className="text-[var(--state-warning)] text-xs">🎯</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--state-warning-strong)]">
              {workoutData.weeklyTargetSessions || 4}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'حصص/أسبوع' : 'sessions/wk'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'انتظام مستمر' : 'Active Cadence'}
          </span>
        </div>

        {/* Streak */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'سلسلة النشاط' : 'Current Streak'}</span>
            <span className="text-accent text-xs">♨</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-accent">
              {workoutHabit.currentStreak || 0}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'أيام' : 'days'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'أطول سلسلة:' : 'Best:'} {workoutHabit.longestStreak || 0} {isAr ? 'يوم' : 'd'}
          </span>
        </div>

        {/* Favorite Routine */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'البرنامج المفضل' : 'Favorite Focus'}</span>
            <span className="text-[var(--d-workout-accent)] text-xs">🏆</span>
          </span>
          <strong className="text-xs font-bold text-[var(--text-primary)] block truncate">
            {workoutData.favoriteRoutine || (isAr ? 'وزن الجسم والبلانك' : 'Home Calisthenics')}
          </strong>
          <span className="text-[10px] text-muted block">
            {isAr ? 'تمارين حرة بدون أوزان' : 'Pure bodyweight'}
          </span>
        </div>
      </div>

      {/* 3. Studio Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--d-workout-surface)] rounded-xl border border-[var(--d-workout-border)] overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : 'text-muted hover:text-[var(--text-primary)]'
          }`}
        >
          <span>📊</span>
          <span>{isAr ? 'لوحة اللياقة' : 'Fitness Dashboard'}</span>
        </button>

        <button
          onClick={() => setActiveTab('session')}
          className={`px-3.5 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'session'
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : 'text-muted hover:text-[var(--text-primary)]'
          }`}
        >
          <span>⚡</span>
          <span>{isAr ? 'تسجيل حصة تمرين' : 'Log Workout'}</span>
        </button>

        <button
          onClick={() => setActiveTab('routines')}
          className={`px-3.5 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'routines'
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : 'text-muted hover:text-[var(--text-primary)]'
          }`}
        >
          <span>📋</span>
          <span>{isAr ? 'برامج التمارين' : 'Routines Vault'}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : 'text-muted hover:text-[var(--text-primary)]'
          }`}
        >
          <span>📜</span>
          <span>{isAr ? 'سجل الحصص' : 'Workout History'}</span>
        </button>

        <button
          onClick={() => setActiveTab('targets')}
          className={`px-3.5 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'targets'
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : 'text-muted hover:text-[var(--text-primary)]'
          }`}
        >
          <span>🎯</span>
          <span>{isAr ? 'أهداف اللياقة' : 'Fitness Targets'}</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: DASHBOARD
         ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Workout Launcher Card */}
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[var(--d-workout-surface)] via-[var(--d-workout-surface)] to-[var(--d-workout-raised)] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-500/20 text-[var(--d-workout-accent)] flex items-center justify-center font-bold text-lg border border-emerald-500/30">
                    ⚡
                  </span>
                  <div>
                    <span className="text-[10px] font-mono tracking-wider text-[var(--d-workout-accent)] uppercase block">
                      {isAr ? 'حصة التدريب المقترحة' : 'RECOMMENDED SESSION'}
                    </span>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {isAr ? 'تمارين وزن الجسم والرشاقة (ضغط، سكوات، وبلانك)' : 'Full Body Calisthenics & Core'}
                    </h2>
                    <span className="text-xs text-muted block mt-0.5">
                      {isAr ? '30 دقيقة · بدون أدوات · تركيز على القوة الوظيفية' : '30 mins · No equipment needed · Functional strength'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('session')}
                  className="btn primary small text-xs flex items-center gap-1"
                >
                  <span>▶</span>
                  <span>{isAr ? 'بدء التمرين الآن' : 'Start Workout'}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--d-workout-border-strong)] text-center text-xs">
                <div className="p-2 rounded-lg bg-[var(--d-workout-raised)]">
                  <span className="text-[10px] text-muted block">{isAr ? 'ضغط (Push)' : 'Push-ups'}</span>
                  <strong className="text-[var(--d-workout-accent)] font-mono">3 × 15</strong>
                </div>
                <div className="p-2 rounded-lg bg-[var(--d-workout-raised)]">
                  <span className="text-[10px] text-muted block">{isAr ? 'سكوات (Legs)' : 'Air Squats'}</span>
                  <strong className="text-[var(--d-workout-accent)] font-mono">3 × 20</strong>
                </div>
                <div className="p-2 rounded-lg bg-[var(--d-workout-raised)]">
                  <span className="text-[10px] text-muted block">{isAr ? 'بلانك (Core)' : 'Plank'}</span>
                  <strong className="text-[var(--d-workout-accent)] font-mono">3 × 45s</strong>
                </div>
              </div>
            </div>

            {/* Recent Workout Sessions */}
            <div className="p-5 rounded-2xl border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-workout-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>⚡</span>
                  <span>{isAr ? 'سجل الحصص التدريبية الأخيرة' : 'Recent Workout Sessions'}</span>
                </h3>
                <button onClick={() => setActiveTab('history')} className="text-link text-xs">
                  <span>{isAr ? 'السجل الكامل' : 'All history'}</span>
                  <span>→</span>
                </button>
              </div>

              {workoutData.sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--d-workout-border)] rounded-xl">
                  {isAr ? 'لا توجد حصص مسجلة بعد. ابدأ اليوم بـ 15 دقيقة تمارين خفيفة.' : 'No workout sessions logged yet.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {workoutData.sessions.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-[var(--d-workout-border-strong)] bg-[var(--d-workout-chip)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-[var(--text-primary)] block truncate">{s.title}</strong>
                        <span className="text-[11px] text-muted flex items-center gap-2 mt-0.5 font-mono">
                          <span>{s.date}</span>
                          <span>· {s.durationMinutes}m</span>
                          <span>· {(s.totalReps || 0)} {isAr ? 'تكرار' : 'reps'}</span>
                          <span>· RPE {s.intensityRating}/5</span>
                        </span>
                        {s.notes && <p className="text-[11px] text-muted/80 mt-1 italic">"{s.notes}"</p>}
                      </div>
                      <span className="text-[var(--d-workout-accent)] font-mono font-bold text-xs">
                        +{s.totalReps || 0} {isAr ? 'تكرار' : 'reps'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Built-in Calisthenics Routines */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-workout-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📋</span>
                  <span>{isAr ? 'برامج الكاليسثنكس' : 'Calisthenics Routines'}</span>
                </h3>
                <button onClick={() => setActiveTab('routines')} className="text-link text-xs">
                  <span>{isAr ? 'كل البرامج' : 'View all'}</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { name: isAr ? 'وزن الجسم والرشاقة الشاملة' : 'Full Body Calisthenics', mins: 25, level: 'مبتدئ / متوسط' },
                  { name: isAr ? 'قوة الجذع والبطن (Core & Plank)' : 'Core & Midline Power', mins: 20, level: 'متوسط' },
                  { name: isAr ? 'مرونة المفاصل وإطالات الظهر' : 'Spinal Mobility Flow', mins: 15, level: 'لجميع المستويات' }
                ].map((r, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSessionTitle(r.name);
                      setDurationMinutes(r.mins);
                      setActiveTab('session');
                    }}
                    className="p-3 rounded-xl border border-[var(--d-workout-border-strong)] bg-[var(--d-workout-chip)] hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between text-xs group"
                  >
                    <div>
                      <strong className="text-[var(--text-primary)] block group-hover:text-[var(--d-workout-accent)]">{r.name}</strong>
                      <span className="text-[10px] text-muted">{r.mins}m · {r.level}</span>
                    </div>
                    <span className="text-[var(--d-workout-accent)] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAr ? 'بدء ↗' : 'Start ↗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Sync Note */}
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-[var(--d-workout-surface)] space-y-2 text-xs">
              <span className="text-[var(--d-workout-accent)] font-bold block flex items-center gap-1.5">
                <span>✦</span>
                <span>{isAr ? 'ربط حي مع صحة اليوم' : 'Live Health Sync'}</span>
              </span>
              <p className="text-muted leading-relaxed text-[11px]">
                {isAr
                  ? 'تسجيل أي حصة تدريبية هنا يرفع طاقة اليوم تلقائياً، ويوثق نشاطك الرياضي في لوحة الصحة العامة وذكاء الأهداف.'
                  : 'Logging a session automatically updates your daily energy gauge and syncs to goals.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LOG WORKOUT SESSION
         ========================================================================= */}
      {activeTab === 'session' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-emerald-500/30 bg-[var(--d-workout-surface)] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--d-workout-border-soft)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>⚡</span>
                <span>{isAr ? 'تسجيل حصة تمرين منزلي' : 'Log Workout Session'}</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isAr ? 'سجل تكراراتك ووقت تدريبك لربطها التلقائي بمؤشرات الطاقة والأهداف.' : 'Track reps and duration for automated health and goal intelligence.'}
              </p>
            </div>
            <button onClick={() => setActiveTab('dashboard')} className="text-muted hover:text-[var(--text-primary)] text-sm">
              ✕
            </button>
          </div>

          {showLogSuccess && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-[var(--d-workout-chip)] text-[var(--d-workout-accent-strong)] text-xs">
              {isAr ? 'تم تسجيل حصة التمرين وتحديث نقاط اللياقة بنجاح!' : 'Workout logged successfully!'}
            </div>
          )}

          <form onSubmit={handleSubmitSession} className="space-y-4">
            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'عنوان الحصة أو البرنامج:' : 'Workout Title:'}</label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="input w-full text-xs font-semibold"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مدة التمرين (دقائق):' : 'Duration (mins):'}</label>
                <input
                  type="number"
                  min={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="input w-full font-mono text-xs font-bold text-[var(--d-workout-accent)]"
                  required
                />
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مجموع التكرارات المنجزة:' : 'Total Reps:'}</label>
                <input
                  type="number"
                  min={1}
                  value={repsInput}
                  onChange={(e) => setRepsInput(Number(e.target.value))}
                  className="input w-full font-mono text-xs font-bold text-[var(--d-workout-accent)]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'نوع التمرين:' : 'Type:'}</label>
                <select
                  className="select w-full text-xs"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value as any)}
                >
                  <option value="bodyweight">{isAr ? 'وزن الجسم (Bodyweight)' : 'Bodyweight'}</option>
                  <option value="hiit">{isAr ? 'متقطع عالي الكثافة (HIIT)' : 'HIIT'}</option>
                  <option value="strength">{isAr ? 'قوة ومقاومة' : 'Strength'}</option>
                  <option value="mobility">{isAr ? 'مرونة وإطالات' : 'Mobility'}</option>
                  <option value="cardio">{isAr ? 'كارديو وتحمل' : 'Cardio'}</option>
                </select>
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مستوى الجهد (RPE 1-5):' : 'Intensity Rating (RPE):'}</label>
                <select
                  className="select w-full text-xs font-mono"
                  value={intensityRating}
                  onChange={(e) => setIntensityRating(Number(e.target.value) as any)}
                >
                  <option value={1}>1 - {isAr ? 'خفيف جداً' : 'Very Light'}</option>
                  <option value={2}>2 - {isAr ? 'هادئ ومريح' : 'Moderate'}</option>
                  <option value={3}>3 - {isAr ? 'متوسط ومستقر' : 'Steady'}</option>
                  <option value={4}>4 - {isAr ? 'قوي ومجهد' : 'Challenging'}</option>
                  <option value={5}>5 - {isAr ? 'أقصى جهد' : 'Maximum Effort'}</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'ملاحظات وتأمل الأداء:' : 'Session Notes:'}</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder={isAr ? 'شعور الطاقة، راحة المفاصل، تقدم في أحد التمارين...' : 'Notes on form, energy, or reps...'}
                className="textarea w-full text-xs"
                rows={2}
              />
            </div>

            <div className="pt-3 border-t border-[var(--d-workout-border-soft)] flex justify-end gap-2">
              <button type="button" onClick={() => setActiveTab('dashboard')} className="btn subtle small text-xs">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="btn primary small text-xs px-5 py-2 font-bold">
                <span>✓</span>
                <span>{isAr ? 'حفظ الحصة والإنجاز' : 'Save Workout'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ROUTINES VAULT
         ========================================================================= */}
      {activeTab === 'routines' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: isAr ? 'أساسيات الكاليسثنكس (ضغط وسكوات)' : 'Core Calisthenics Routine',
                mins: 25,
                focus: isAr ? 'الصدر، الأرجل، والجذع' : 'Chest, Legs, Core',
                exercises: [
                  isAr ? 'ضغط بوزن الجسم: 3 مجموعات × 15 تكرار' : 'Push-ups: 3 sets x 15 reps',
                  isAr ? 'سكوات بوزن الجسم: 3 مجموعات × 20 تكرار' : 'Air Squats: 3 sets x 20 reps',
                  isAr ? 'بلانك أمامي: 3 مجموعات × 45 ثانية' : 'Plank: 3 sets x 45s'
                ]
              },
              {
                title: isAr ? 'برنامج تقوية الجذع والبطن (Core Power)' : 'Core & Midline Engine',
                mins: 20,
                focus: isAr ? 'عضلات البطن وأسفل الظهر' : 'Abs & Lower Back',
                exercises: [
                  isAr ? 'تسلق الجبل (Mountain Climbers): 3 × 25' : 'Mountain Climbers: 3 x 25',
                  isAr ? 'بلانك جانبي: 2 × 30 ثانية لكل جانب' : 'Side Plank: 2 x 30s each side',
                  isAr ? 'رفع الأرجل (Leg Raises): 3 × 12' : 'Leg Raises: 3 x 12'
                ]
              },
              {
                title: isAr ? 'تحرير التوتر والمرونة (Spinal Mobility)' : 'Spinal Mobility & Flow',
                mins: 15,
                focus: isAr ? 'مرونة المفاصل وتحرير التوتر' : 'Joints & Posture',
                exercises: [
                  isAr ? 'إطالة القطة والبقرة (Cat-Cow): 2 × 15' : 'Cat-Cow: 2 x 15 reps',
                  isAr ? 'إطالة الحوض والورك (Hip Flexor): 2 × 30s' : 'Hip Flexor Stretch: 2 x 30s',
                  isAr ? 'الطفل المسترخي (Child Pose): دقيقتان' : 'Child Pose: 2 minutes'
                ]
              }
            ].map((rt, i) => (
              <div key={i} className="p-4 rounded-xl border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-[var(--d-workout-accent-strong)] border border-emerald-500/30">
                      {rt.mins}m
                    </span>
                    <span className="text-xs text-muted">{rt.focus}</span>
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-sm">{rt.title}</h3>
                  <ul className="space-y-1.5 mt-3 text-xs text-muted">
                    {rt.exercises.map((ex, exIdx) => (
                      <li key={exIdx} className="flex items-center gap-2">
                        <span className="text-[var(--d-workout-accent)]">✓</span>
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setSessionTitle(rt.title);
                    setDurationMinutes(rt.mins);
                    setActiveTab('session');
                  }}
                  className="btn subtle small w-full justify-center text-[var(--d-workout-accent-strong)] border-emerald-500/30 hover:bg-emerald-500/20 text-xs mt-3"
                >
                  {isAr ? 'بدء هذا البرنامج ↗' : 'Start This Routine ↗'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: WORKOUT HISTORY
         ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)]">
              {isAr ? `إجمالي الحصص الموثقة: ${workoutData.sessions.length}` : `Total Logged Workouts: ${workoutData.sessions.length}`}
            </span>
            <button onClick={() => setActiveTab('session')} className="btn primary small text-xs">
              + {isAr ? 'تسجيل حصة جديدة' : 'New Workout'}
            </button>
          </div>

          {workoutData.sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted border border-dashed border-[var(--d-workout-border)] rounded-2xl">
              {isAr ? 'لا توجد حصص في السجل بعد.' : 'No sessions recorded in archive.'}
            </div>
          ) : (
            <div className="space-y-2">
              {workoutData.sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border border-[var(--d-workout-border-strong)] bg-[var(--d-workout-chip)] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <strong className="text-[var(--text-primary)] block truncate">{s.title}</strong>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted font-mono">
                      <span>{s.date}</span>
                      <span>· {s.durationMinutes}m</span>
                      <span>· {s.totalReps || 0} {isAr ? 'تكرار' : 'reps'}</span>
                      <span>· RPE {s.intensityRating}/5</span>
                      <span>· {s.workoutType}</span>
                    </div>
                    {s.notes && <p className="text-[11px] text-muted/80 mt-1 italic">"{s.notes}"</p>}
                  </div>
                  <span className="text-[var(--d-workout-accent)] font-mono font-bold text-xs shrink-0">
                    +{s.totalReps || 0} {isAr ? 'تكرار' : 'reps'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: FITNESS TARGETS
         ========================================================================= */}
      {activeTab === 'targets' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl border border-emerald-500/30 bg-[var(--d-workout-surface)] space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>🎯</span>
            <span>{isAr ? 'أهداف اللياقة والتكرارات' : 'Fitness Targets'}</span>
          </h2>
          {targetsSaved && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-[var(--d-workout-chip)] text-[var(--d-workout-accent-strong)] text-xs">
              {isAr ? 'تم حفظ أهداف اللياقة بنجاح!' : 'Fitness targets saved!'}
            </div>
          )}
          <form onSubmit={handleSaveTargets} className="space-y-4 text-xs">
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'الحصص التدريبية الأسبوعية:' : 'Weekly Sessions Target:'}</label>
              <input
                type="number"
                min={1}
                max={14}
                value={tempWeeklySessions}
                onChange={(e) => setTempWeeklySessions(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-workout-accent)]"
              />
            </div>
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'الهدف الشهري للتكرارات (تكرار/شهر):' : 'Monthly Reps Target:'}</label>
              <input
                type="number"
                min={50}
                value={tempMonthlyReps}
                onChange={(e) => setTempMonthlyReps(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-workout-accent)]"
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn primary small text-xs px-5 py-2">
                {isAr ? 'حفظ الأهداف' : 'Save Targets'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
