import { localDateKey, parseDateKey } from '../lib/dateKey';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { usePersistedViewTab } from '../lib/useNavigation';
import { WorkoutRoutine, ExerciseEntry, ExerciseSet, MuscleMovement } from '../types';
import { Button, NuqtaSelect, SpringCheck } from './ui';
import { dialogs } from './ui/dialogController';
import { NuqtaIcon } from './NuqtaIcon';
import {
  StudioFrame,
  StudioSection,
  StudioStat,
  StudioBars,
  StudioEmpty,
  StudioTab
} from './studios/StudioKit';
import { PrebuiltExercise, exerciseEntryFromCatalog, movementLabel } from '../lib/exerciseCatalog';
import { ExerciseCatalog } from './workout/ExerciseCatalog';
import { ProgramBuilder } from './workout/ProgramBuilder';
import { PROGRAM_TEMPLATES, ProgramTemplate } from '../lib/programTemplates';
import { programFromTemplate, splitLabel, goalLabel, statusLabel, routineStatus, programProgress, flattenProgramExercises } from '../lib/program';

type WTab = 'today' | 'programs' | 'exercises' | 'history' | 'progress';

interface DraftExercise {
  key: string;
  name: string;
  category: ExerciseEntry['category'];
  movement?: MuscleMovement;
  restSeconds: number;
  sets: { reps: number; weightKg: number; completed: boolean; type: 'warmup' | 'working' }[];
  notes?: string;
}

const makeDraftFromEntry = (e: ExerciseEntry): DraftExercise => ({
  key: 'dx-' + crypto.randomUUID().slice(0, 6),
  name: e.name,
  category: e.category,
  movement: e.movement,
  restSeconds: e.sets[0]?.restSeconds ?? 60,
  notes: e.notes,
  sets: (e.sets.length ? e.sets : [{ setNumber: 1, reps: 10, completed: false }]).map((s, i) => ({
    reps: s.reps || 0,
    weightKg: s.weightKg || 0,
    completed: !!s.completed,
    type: i === 0 ? 'warmup' : 'working'
  }))
});

const formatClock = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const WorkoutView: React.FC = () => {
  const {
    habits,
    createHabit,
    profile,
    logWorkoutSession,
    addOrUpdateWorkoutRoutine,
    deleteWorkoutRoutine,
    updateFitnessTargets,
    setWorkoutRoutineStatus,
    setProgramDayCompleted,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const workoutHabit = habits.find((h) => h.specializedType === 'workout');
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

  const sessions = workoutData.sessions || [];
  const routines = workoutData.customRoutines || [];

  const confirmDeleteRoutine = async (routineId: string) => {
    const ok = await dialogs.confirm({
      tone: 'danger',
      icon: 'trash',
      title: isAr ? 'حذف هذا البرنامج؟' : 'Delete this program?',
      description: isAr
        ? 'ستُحذف أيام البرنامج وتمارينه وسجل التقدّم المرتبط به نهائياً.'
        : 'The program, its days and its logged progress are permanently removed.',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel'
    });
    if (ok && workoutHabit) deleteWorkoutRoutine(workoutHabit.id, routineId);
  };

  const [activeTab, setActiveTab] = usePersistedViewTab<WTab>(
    'workout',
    ['today', 'programs', 'exercises', 'history', 'progress'],
    'today'
  );

  // ---------- Active workout (execution mode) ----------
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sessionTitle, setSessionTitle] = useState(isAr ? 'حصة تمرين منزلية' : 'Home workout');
  const [intensityRating, setIntensityRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sessionNotes, setSessionNotes] = useState('');
  const [rest, setRest] = useState<{ remaining: number; total: number } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [active]);

  useEffect(() => {
    if (!rest) return;
    if (rest.remaining <= 0) {
      setRest(null);
      return;
    }
    const t = window.setTimeout(() => setRest((r) => (r ? { ...r, remaining: r.remaining - 1 } : r)), 1000);
    return () => window.clearTimeout(t);
  }, [rest]);

  // ---------- Programs / routines ----------
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routineMinutes, setRoutineMinutes] = useState(25);
  const [routineSaved, setRoutineSaved] = useState(false);
  const [programSaved, setProgramSaved] = useState<string | null>(null);
  const [openProgramId, setOpenProgramId] = useState<string | null>(null);


  // ---------- Progress ----------
  const [progressMetric, setProgressMetric] = useState<'reps' | 'volume' | 'minutes'>('reps');
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  // ---------- Targets ----------
  const [tempWeeklySessions, setTempWeeklySessions] = useState(workoutData.weeklyTargetSessions || 4);
  const [tempMonthlyReps, setTempMonthlyReps] = useState(workoutData.monthlyTargetReps || 500);
  const [targetsSaved, setTargetsSaved] = useState(false);

  const handleInitWorkoutHabit = () =>
    createHabit({
      name: isAr ? 'تمارين وزن الجسم والرشاقة المنزلية' : 'Home Calisthenics & Fitness',
      anchor: isAr ? 'بعد إنهاء العمل -> أبدأ تمارين الضغط والسكوات' : 'After work -> start home workout',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'workout'
    });

  // ---------- analytics ----------
  const weekBars = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateKey(d);
      const count = sessions.filter((s) => s.date === key).length;
      out.push({ label: d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'narrow' }), value: count });
    }
    return out;
  }, [sessions, isAr]);

  const volumeFor = (s: { exercises: ExerciseEntry[] }) =>
    s.exercises.reduce((acc, ex) => acc + ex.sets.reduce((a, st) => a + (st.weightKg || 0) * (st.reps || 0), 0), 0);

  const totalVolume = sessions.reduce((acc, s) => acc + (s.volumeKg || volumeFor(s)), 0);

  // exercise names appearing across history (for progress selection)
  const exerciseNames = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => s.exercises.forEach((e) => set.add(e.name)));
    return Array.from(set);
  }, [sessions]);

  useEffect(() => {
    if (!selectedExercise && exerciseNames.length) setSelectedExercise(exerciseNames[0]);
  }, [exerciseNames, selectedExercise]);

  const exerciseProgress = useMemo(() => {
    if (!selectedExercise) return [] as { label: string; value: number }[];
    const byDate = new Map<string, number>();
    [...sessions]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((s) => {
        s.exercises
          .filter((e) => e.name === selectedExercise)
          .forEach((e) => {
            const v = e.sets.reduce((a, st) => {
              if (!st.completed) return a;
              if (progressMetric === 'volume') return a + (st.weightKg || 0) * (st.reps || 0);
              if (progressMetric === 'minutes') return a + (s.durationMinutes || 0);
              return a + (st.reps || 0);
            }, 0);
            byDate.set(s.date, (byDate.get(s.date) || 0) + v);
          });
      });
    return Array.from(byDate.entries())
      .slice(-8)
      .map(([date, value]) => ({ label: date.slice(5), value }));
  }, [sessions, selectedExercise, progressMetric]);

  const personalRecords = useMemo(() => {
    const best = new Map<string, number>();
    sessions.forEach((s) =>
      s.exercises.forEach((e) => {
        const reps = e.sets.reduce((a, st) => a + (st.completed ? st.reps || 0 : 0), 0);
        if (reps > (best.get(e.name) || 0)) best.set(e.name, reps);
      })
    );
    return Array.from(best.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sessions]);

  const muscleDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    sessions.forEach((s) =>
      s.exercises.forEach((e) => {
        const mov = e.movement || 'core';
        const reps = e.sets.reduce((a, st) => a + (st.reps || 0), 0);
        dist[mov] = (dist[mov] || 0) + reps;
      })
    );
    return dist;
  }, [sessions]);

  // ---------- active workout helpers ----------
  const startWorkout = (title: string, entries: ExerciseEntry[]) => {
    const drafts = entries.length ? entries.map(makeDraftFromEntry) : [];
    setDraftExercises(drafts);
    setCurrentIdx(0);
    setSessionTitle(title);
    setElapsed(0);
    setIntensityRating(3);
    setSessionNotes('');
    setRest(null);
    setSavedFlash(false);
    setShowCatalog(false);
    setActive(true);
  };

  const addCatalogExercise = (catEx: PrebuiltExercise) => {
    const draft = makeDraftFromEntry(exerciseEntryFromCatalog(catEx, isAr));
    draft.sets = draft.sets.map((s, i) => ({ ...s, completed: false, type: i === 0 ? 'warmup' : 'working' }));
    setDraftExercises((prev) => [...prev, draft]);
  };

  const addSet = (idx: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== idx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { reps: last?.reps || 10, weightKg: last?.weightKg || 0, completed: false, type: 'working' }] };
      })
    );
  };

  const removeSet = (idx: number, setIdx: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) } : ex))
    );
  };

  const updateSet = (idx: number, setIdx: number, patch: Partial<DraftExercise['sets'][number]>) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) =>
        i === idx ? { ...ex, sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, ...patch } : s)) } : ex
      )
    );
  };

  const toggleSetDone = (idx: number, setIdx: number) => {
    const ex = draftExercises[idx];
    const nextDone = !ex.sets[setIdx].completed;
    updateSet(idx, setIdx, { completed: nextDone });
    if (nextDone && ex.restSeconds > 0) setRest({ remaining: ex.restSeconds, total: ex.restSeconds });
  };

  const removeExercise = (idx: number) => {
    setDraftExercises((prev) => prev.filter((_, i) => i !== idx));
    setCurrentIdx((c) => Math.max(0, Math.min(c, draftExercises.length - 2)));
  };

  const previousFor = (name: string): { date: string; sets: ExerciseSet[] } | null => {
    for (const s of sessions) {
      const match = s.exercises.find((e) => e.name === name);
      if (match) return { date: s.date, sets: match.sets };
    }
    return null;
  };

  const finishWorkout = () => {
    if (!workoutHabit) return;
    const exercises: ExerciseEntry[] = draftExercises.map((d) => ({
      id: 'ex-' + crypto.randomUUID().slice(0, 6),
      name: d.name,
      category: d.category,
      movement: d.movement,
      notes: d.notes,
      sets: d.sets.map((s, i) => ({
        setNumber: i + 1,
        reps: s.reps,
        weightKg: s.weightKg,
        restSeconds: d.restSeconds,
        completed: s.completed
      }))
    }));
    const totalReps = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.completed ? s.reps : 0), 0), 0);
    const volumeKg = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.completed ? (s.weightKg || 0) * s.reps : 0), 0), 0);

    logWorkoutSession(workoutHabit.id, {
      title: sessionTitle.trim() || (isAr ? 'تمارين منزلية' : 'Home workout'),
      workoutType: 'bodyweight',
      durationMinutes: Math.max(1, Math.round(elapsed / 60)),
      totalReps,
      volumeKg,
      exercises,
      intensityRating,
      difficultyLevel: 'intermediate',
      notes: sessionNotes.trim() || undefined
    });
    setSavedFlash(true);
    window.setTimeout(() => {
      setSavedFlash(false);
      setActive(false);
    }, 700);
  };

  const saveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutHabit || !routineTitle.trim()) return;
    const routine: WorkoutRoutine = {
      id: 'rt-' + crypto.randomUUID().slice(0, 8),
      name: routineTitle.trim(),
      nameAr: routineTitle.trim(),
      description: routineDesc.trim() || undefined,
      targetLevel: 'intermediate',
      estimatedMinutes: routineMinutes,
      category: 'bodyweight',
      isCustom: true,
      exercises: draftExercises.map((d) => ({
        id: 'ex-' + crypto.randomUUID().slice(0, 6),
        name: d.name,
        category: d.category,
        movement: d.movement,
        sets: d.sets.map((s, i) => ({ setNumber: i + 1, reps: s.reps, weightKg: s.weightKg, completed: true }))
      }))
    };
    addOrUpdateWorkoutRoutine(workoutHabit.id, routine);
    setRoutineSaved(true);
    setRoutineTitle('');
    setRoutineDesc('');
    window.setTimeout(() => setRoutineSaved(false), 2000);
  };

  const createProgramFromTemplate = (template: ProgramTemplate) => {
    if (!workoutHabit) return;
    const program = programFromTemplate(template);
    const routine: WorkoutRoutine = {
      id: 'rt-' + crypto.randomUUID().slice(0, 8),
      name: template.name,
      nameAr: template.nameAr,
      description: template.description,
      descriptionAr: template.descriptionAr,
      targetLevel: 'intermediate',
      estimatedMinutes: 30,
      category: 'bodyweight',
      isCustom: true,
      status: 'draft',
      exercises: [],
      program
    };
    addOrUpdateWorkoutRoutine(workoutHabit.id, routine);
    setProgramSaved(template.id);
    window.setTimeout(() => setProgramSaved(null), 2200);
  };

  /** Persist a day's exercise list, keeping the flat list in sync for legacy views. */
  const updateProgramDay = (routine: WorkoutRoutine, dayId: string, exercises: ExerciseEntry[]) => {
    if (!workoutHabit || !routine.program) return;
    const weeks = routine.program.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) => (d.id === dayId ? { ...d, exercises } : d))
    }));
    const program = { ...routine.program, weeks };
    addOrUpdateWorkoutRoutine(workoutHabit.id, { ...routine, program, exercises: flattenProgramExercises(program) });
  };

  const saveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutHabit) return;
    updateFitnessTargets(workoutHabit.id, {
      weeklyTargetSessions: Number(tempWeeklySessions),
      monthlyTargetReps: Number(tempMonthlyReps)
    });
    setTargetsSaved(true);
    window.setTimeout(() => setTargetsSaved(false), 2000);
  };

  if (!workoutHabit) {
    return (
      <div className="studio-root" data-studio="workout" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="studio-head">
          <div className="min-w-0">
            <span className="studio-eyebrow">NUQTA / HOME FITNESS</span>
            <h1 className="studio-title mt-1">{isAr ? 'استوديو اللياقة المنزلية' : 'Home Fitness Studio'}</h1>
            <p className="studio-lede mt-1">
              {isAr
                ? 'تمارين وزن الجسم، تتبع التكرارات، وبناء القوة والرشاقة دون أجهزة معقدة.'
                : 'Bodyweight training, set logging, and routine management at home.'}
            </p>
          </div>
        </header>
        <StudioSection>
          <StudioEmpty
            icon="dumbbell"
            title={isAr ? 'ابدأ رحلة القوة والرشاقة' : 'Initialize your training log'}
            description={
              isAr
                ? 'حصص تدريبية، مكتبة تمارين، وتتبع للأداء الشخصي.'
                : 'Workout sessions, an exercise library, and personal-performance tracking.'
            }
            action={
              <Button variant="primary" onClick={handleInitWorkoutHabit}>
                {isAr ? 'تفعيل استوديو التمارين' : 'Enable Workout Studio'}
              </Button>
            }
          />
        </StudioSection>
      </div>
    );
  }

  const tabs: StudioTab[] = [
    { id: 'today', label: isAr ? 'اليوم' : 'Today', icon: 'dumbbell' },
    { id: 'programs', label: isAr ? 'البرامج' : 'Programs', icon: 'list', count: routines.length },
    { id: 'exercises', label: isAr ? 'مكتبة التمارين' : 'Exercises', icon: 'activity' },
    { id: 'history', label: isAr ? 'السجل' : 'History', icon: 'history' },
    { id: 'progress', label: isAr ? 'التقدم' : 'Progress', icon: 'chart' }
  ];

  // ============================ ACTIVE WORKOUT ============================
  if (active) {
    const ex = draftExercises[currentIdx];
    const prev = ex ? previousFor(ex.name) : null;
    const completedSets = draftExercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
    const totalSets = draftExercises.reduce((a, e) => a + e.sets.length, 0);

    return (
      <div className="studio-root" data-studio="workout" dir={isAr ? 'rtl' : 'ltr'}>
        {/* execution header — deliberately different from the browse chrome */}
        <div className="studio-section" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[var(--fs-micro)] uppercase tracking-wider font-mono text-[var(--studio-accent)]">
                {isAr ? 'حصة جارية' : 'LIVE SESSION'}
              </span>
              <input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                aria-label={isAr ? 'عنوان الحصة' : 'Session title'}
                className="block w-full bg-transparent border-0 p-0 text-[var(--fs-lg)] font-[var(--fw-bold)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-end">
                <span className="block text-[var(--fs-micro)] text-[var(--text-secondary)]">
                  {isAr ? 'المدة' : 'Duration'}
                </span>
                <span className="block font-mono text-[var(--fs-lg)] font-[var(--fw-heavy)] text-[var(--text-primary)] tabular-nums">
                  {formatClock(elapsed)}
                </span>
              </div>
              <Button variant="danger" size="sm" icon="check" onClick={finishWorkout}>
                {isAr ? 'إنهاء الحصة' : 'Finish'}
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden">
              <div
                className="h-full rounded-[var(--r-full)]"
                style={{ width: `${totalSets ? (completedSets / totalSets) * 100 : 0}%`, background: 'var(--studio-accent)' }}
              />
            </div>
            <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
              {completedSets}/{totalSets} {isAr ? 'مجموعة' : 'sets'}
            </span>
          </div>
          {savedFlash && (
            <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
              {isAr ? 'تم حفظ الحصة.' : 'Workout saved.'}
            </p>
          )}
        </div>

        {rest && (
          <div className="rest-timer">
            <span className="rest-timer-clock">{formatClock(rest.remaining)}</span>
            <div className="flex-1">
              <p className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                {isAr ? 'راحة بين المجموعات' : 'Rest between sets'}
              </p>
              <div className="h-1.5 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden mt-1">
                <div
                  className="h-full rounded-[var(--r-full)]"
                  style={{ width: `${(rest.remaining / rest.total) * 100}%`, background: 'var(--studio-accent)' }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon="pause" onClick={() => setRest(null)}>
                {isAr ? 'تخطٍّ' : 'Skip'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRest((r) => (r ? { ...r, remaining: r.remaining + 15, total: r.total + 15 } : r))}
              >
                +15s
              </Button>
            </div>
          </div>
        )}

        {draftExercises.length === 0 ? (
          <StudioSection>
            <StudioEmpty
              icon="dumbbell"
              title={isAr ? 'لا توجد تمارين بعد' : 'No exercises yet'}
              description={isAr ? 'أضف تمريناً من المكتبة لبدء التسجيل.' : 'Add an exercise from the library to start logging.'}
              action={
                <Button variant="primary" size="sm" icon="plus" onClick={() => setShowCatalog(true)}>
                  {isAr ? 'إضافة تمرين' : 'Add exercise'}
                </Button>
              }
            />
          </StudioSection>
        ) : (
          <div className="grid gap-[var(--sp-4)] lg:grid-cols-[220px_1fr]">
            {/* exercise rail (secondary nav within execution) */}
            <StudioSection title={isAr ? 'التمارين' : 'Exercises'}>
              <ul className="space-y-1">
                {draftExercises.map((e, i) => {
                  const done = e.sets.filter((s) => s.completed).length;
                  return (
                    <li key={e.key}>
                      <button
                        type="button"
                        aria-current={i === currentIdx}
                        onClick={() => setCurrentIdx(i)}
                        className="w-full text-start px-2.5 py-2 rounded-[var(--r-sm)] text-[var(--fs-xs)] transition-colors"
                        style={
                          i === currentIdx
                            ? { background: 'var(--studio-accent-soft)', color: 'var(--studio-accent-ink)' }
                            : { color: 'var(--text-secondary)' }
                        }
                      >
                        <span className="block truncate font-[var(--fw-semibold)]">{e.name}</span>
                        <span className="block text-[var(--fs-micro)] font-mono opacity-80">
                          {done}/{e.sets.length} {isAr ? 'مجموعة' : 'sets'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="ghost" size="sm" icon="plus" block className="mt-2" onClick={() => setShowCatalog(true)}>
                {isAr ? 'تمرين' : 'Exercise'}
              </Button>
            </StudioSection>

            {/* current exercise + set logging */}
            {ex && (
              <div className="space-y-[var(--sp-4)]">
                <StudioSection
                  title={
                    <>
                      <span className="font-mono text-[var(--studio-accent)]">{currentIdx + 1}.</span> {ex.name}
                    </>
                  }
                  action={
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="trash"
                        aria-label={isAr ? 'حذف التمرين' : 'Remove exercise'}
                        onClick={() => removeExercise(currentIdx)}
                      />
                      {currentIdx < draftExercises.length - 1 && (
                        <Button variant="secondary" size="sm" onClick={() => setCurrentIdx(currentIdx + 1)}>
                          {isAr ? 'التالي' : 'Next'}
                        </Button>
                      )}
                    </div>
                  }
                >
                  {prev ? (
                    <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono mb-3">
                      {isAr ? 'الأداء السابق' : 'Previous'} ({prev.date}):{' '}
                      {prev.sets.map((s) => `${s.weightKg ? s.weightKg + 'kg×' : ''}${s.reps}`).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[var(--fs-micro)] text-[var(--text-tertiary)] mb-3">
                      {isAr ? 'أول مرة تسجل هذا التمرين' : 'First time logging this exercise'}
                    </p>
                  )}

                  <div className="set-row set-row-head" aria-hidden="true">
                    <span>{isAr ? '#' : '#'}</span>
                    <span>{isAr ? 'الوزن (كغ)' : 'Weight (kg)'}</span>
                    <span>{isAr ? 'التكرارات' : 'Reps'}</span>
                    <span>{isAr ? 'راحة' : 'Rest'}</span>
                    <span>{isAr ? 'تم' : 'Done'}</span>
                  </div>
                  {ex.sets.map((s, si) => (
                    <div className="set-row" key={si}>
                      <span className="set-index">
                        {si + 1}
                        {s.type === 'warmup' && <span className="set-type-tag block">{isAr ? 'إحماء' : 'warm'}</span>}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={s.weightKg}
                        onChange={(e) => updateSet(currentIdx, si, { weightKg: Number(e.target.value) })}
                        aria-label={isAr ? 'الوزن' : 'Weight'}
                        className="set-input"
                      />
                      <input
                        type="number"
                        min={0}
                        value={s.reps}
                        onChange={(e) => updateSet(currentIdx, si, { reps: Number(e.target.value) })}
                        aria-label={isAr ? 'التكرارات' : 'Reps'}
                        className="set-input"
                      />
                      <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono text-center">
                        {ex.restSeconds}s
                      </span>
                      <div className="flex items-center gap-1">
                        <SpringCheck
                          checked={s.completed}
                          onChange={() => toggleSetDone(currentIdx, si)}
                          size="sm"
                          ariaLabel={isAr ? 'إتمام المجموعة' : 'Complete set'}
                        />
                        {ex.sets.length > 1 && (
                          <button
                            type="button"
                            aria-label={isAr ? 'حذف المجموعة' : 'Remove set'}
                            className="text-[var(--text-tertiary)] hover:text-[var(--state-danger)] text-sm"
                            onClick={() => removeSet(currentIdx, si)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button variant="secondary" size="sm" icon="plus" onClick={() => addSet(currentIdx)}>
                      {isAr ? 'إضافة مجموعة' : 'Add set'}
                    </Button>
                    <label className="flex items-center gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)]">
                      {isAr ? 'راحة' : 'Rest'}
                      <input
                        type="number"
                        min={0}
                        value={ex.restSeconds}
                        onChange={(e) =>
                          setDraftExercises((prev) =>
                            prev.map((d, i) => (i === currentIdx ? { ...d, restSeconds: Number(e.target.value) } : d))
                          )
                        }
                        className="input w-20 font-mono text-[var(--fs-xs)] tabular-nums"
                      />
                      s
                    </label>
                  </div>

                  <label className="field block mt-3">
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                      {isAr ? 'ملاحظات التمرين' : 'Exercise notes'}
                    </span>
                    <input
                      type="text"
                      value={ex.notes || ''}
                      onChange={(e) =>
                        setDraftExercises((prev) =>
                          prev.map((d, i) => (i === currentIdx ? { ...d, notes: e.target.value } : d))
                        )
                      }
                      className="input w-full text-[var(--fs-xs)]"
                      placeholder={isAr ? 'الوضعية، الإحساس...' : 'Form, feel...'}
                    />
                  </label>
                </StudioSection>

                <StudioSection title={isAr ? 'ملاحظات الحصة والجهد' : 'Session effort & notes'}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                      {isAr ? 'الجهد (RPE)' : 'Effort (RPE)'}
                    </span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={intensityRating === r}
                          onClick={() => setIntensityRating(r as 1 | 2 | 3 | 4 | 5)}
                          className="w-9 h-9 rounded-[var(--r-sm)] border font-mono font-[var(--fw-bold)]"
                          style={
                            intensityRating === r
                              ? { background: 'var(--studio-accent)', color: 'var(--text-on-state)', borderColor: 'transparent' }
                              : { borderColor: 'var(--studio-line)', color: 'var(--text-secondary)' }
                          }
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={2}
                    className="textarea w-full text-[var(--fs-xs)] mt-3"
                    placeholder={isAr ? 'كيف كان شعورك خلال الحصة؟' : 'How did the session feel?'}
                  />
                </StudioSection>
              </div>
            )}
          </div>
        )}

        {/* add-exercise drawer */}
        {showCatalog && (
          <StudioSection
            title={isAr ? 'أضف تمريناً من المكتبة' : 'Add from library'}
            action={
              <Button variant="ghost" size="sm" icon="close" onClick={() => setShowCatalog(false)}>
                {isAr ? 'إغلاق' : 'Close'}
              </Button>
            }
          >
            <ExerciseCatalog
              isAr={isAr}
              variant="inline"
              onAdd={addCatalogExercise}
              addLabel={isAr ? 'إضافة' : 'Add'}
            />
          </StudioSection>
        )}
      </div>
    );
  }

  // ============================ BROWSE MODE ============================
  const todaySession = sessions.find((s) => s.date === todayStr);

  return (
    <StudioFrame
      studio="workout"
      eyebrow="NUQTA / HOME FITNESS"
      title={isAr ? 'استوديو اللياقة المنزلية' : 'Home Fitness Studio'}
      description={
        isAr
          ? 'خطّط الحصة، نفّذها بتركيز، وحلّل أدائك — كل ذلك في مساحة تدريب واحدة.'
          : 'Plan a session, execute it with focus, and analyze performance — one training space.'
      }
      actions={
        <>
          <Button variant="primary" size="sm" icon="play" onClick={() => startWorkout(isAr ? 'حصة سريعة' : 'Quick workout', [])}>
            {isAr ? 'بدء تمرين' : 'Start workout'}
          </Button>
          <Button variant="ghost" size="sm" icon="archive" onClick={() => setActiveNavTab('archive')}>
            {isAr ? 'الأرشيف' : 'Archive'}
          </Button>
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as WTab)}
      navVariant="segmented"
      context={
        <span className="text-[var(--fs-micro)] font-mono text-[var(--text-secondary)]">
          {workoutData.totalWorkouts || 0} {isAr ? 'حصة' : 'sessions'}
        </span>
      }
    >
      {/* ---------------- TODAY ---------------- */}
      {activeTab === 'today' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'حصة اليوم' : "Today's session"}>
            {todaySession ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                    {todaySession.title}
                  </p>
                  <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] font-mono mt-0.5">
                    {todaySession.durationMinutes}m · {todaySession.totalReps || 0} {isAr ? 'تكرار' : 'reps'} · RPE{' '}
                    {todaySession.intensityRating}/5
                  </p>
                </div>
                <span className="px-2 h-6 inline-flex items-center rounded-[var(--r-full)] border text-[var(--fs-micro)] font-[var(--fw-semibold)] text-[var(--state-success)] border-[color-mix(in_srgb,var(--state-success)_45%,transparent)]">
                  <NuqtaIcon name="check" className="w-3 h-3" /> {isAr ? 'منجزة اليوم' : 'Done today'}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                    {routines[0]?.name || (isAr ? 'تمرين وزن الجسم الشامل' : 'Full-body bodyweight')}
                  </p>
                  <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mt-0.5">
                    {routines[0]
                      ? `${routines[0].estimatedMinutes}m · ${routines[0].exercises.length} ${isAr ? 'تمارين' : 'exercises'}`
                      : isAr
                      ? 'لا توجد حصة مسجلة اليوم — ابدأ الآن.'
                      : 'No session logged today — start now.'}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon="play"
                  onClick={() =>
                    startWorkout(
                      routines[0]?.name || (isAr ? 'تمرين وزن الجسم الشامل' : 'Full-body bodyweight'),
                      routines[0]?.exercises || []
                    )
                  }
                >
                  {isAr ? 'بدء الحصة' : 'Start session'}
                </Button>
              </div>
            )}
          </StudioSection>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-3">
            <StudioSection title={isAr ? 'نشاط الأسبوع' : 'Weekly activity'}>
              <StudioBars data={weekBars} unit={isAr ? 'حصة' : 'sessions'} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <StudioStat
                  label={isAr ? 'الهدف الأسبوعي' : 'Weekly target'}
                  value={workoutData.weeklyTargetSessions || 4}
                  tone="accent"
                />
                <StudioStat
                  label={isAr ? 'هذا الأسبوع' : 'This week'}
                  value={weekBars.reduce((a, b) => a + b.value, 0)}
                />
              </div>
            </StudioSection>

            <StudioSection className="lg:col-span-2" title={isAr ? 'حصصك الأخيرة' : 'Recent sessions'}
              action={<Button variant="ghost" size="sm" onClick={() => setActiveTab('history')}>{isAr ? 'السجل' : 'History'}</Button>}>
              {sessions.length === 0 ? (
                <StudioEmpty icon="history" title={isAr ? 'لا توجد حصص بعد' : 'No sessions yet'} />
              ) : (
                <ul className="space-y-2">
                  {sessions.slice(0, 4).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 text-[var(--fs-xs)] border-b border-[var(--studio-line)] last:border-0 pb-2 last:pb-0">
                      <span className="min-w-0">
                        <span className="block text-[var(--text-primary)] font-[var(--fw-semibold)] truncate">{s.title}</span>
                        <span className="block text-[var(--text-secondary)] font-mono">
                          {s.date} · {s.durationMinutes}m · {s.exercises.length} {isAr ? 'تمارين' : 'exercises'}
                        </span>
                      </span>
                      <span className="font-mono text-[var(--studio-accent)] font-[var(--fw-bold)] shrink-0">
                        {s.totalReps || 0} {isAr ? 'تكرار' : 'reps'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </StudioSection>
          </div>
        </div>
      )}

      {/* ---------------- PROGRAMS ---------------- */}
      {activeTab === 'programs' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'برامجك المحفوظة' : 'Your programs'}>
            {routines.length === 0 ? (
              <StudioEmpty
                icon="list"
                title={isAr ? 'لا توجد برامج بعد' : 'No programs yet'}
                description={isAr ? 'ابدأ من قالب جاهز بالأسفل، أو ابنِ حصة أثناء التدريب.' : 'Start from a template below, or build one during a session.'}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {routines.map((r) => {
                  const status = routineStatus(r);
                  const progress = r.program ? programProgress(r.program) : null;
                  const open = openProgramId === r.id;
                  return (
                  <div key={r.id} className={`studio-tile flex flex-col gap-2${r.program ? ' ex-program-card' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">
                          {isAr ? r.nameAr || r.name : r.name}
                        </p>
                        <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                          {r.program ? `${splitLabel(r.program.split, isAr)} · ` : ''}
                          {r.estimatedMinutes}m · {r.exercises.length} {isAr ? 'تمارين' : 'exercises'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`ex-status ex-status-${status}`}>{statusLabel(status, isAr)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="trash"
                          aria-label={isAr ? 'حذف البرنامج' : 'Delete program'}
                          onClick={() => confirmDeleteRoutine(r.id)}
                        />
                      </div>
                    </div>
                    {progress && (
                      <div className="flex items-center gap-2">
                        <span className="ex-progress-track" aria-hidden="true">
                          <span className="ex-progress-fill" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                        </span>
                        <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono shrink-0">
                          {progress.completedDays}/{progress.trainingDays}
                        </span>
                      </div>
                    )}
                    {r.description && <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">{isAr ? r.descriptionAr || r.description : r.description}</p>}
                    {!r.program && (
                      <ul className="text-[var(--fs-xs)] text-[var(--text-secondary)] space-y-0.5">
                        {r.exercises.slice(0, 4).map((e) => (
                          <li key={e.id} className="truncate">
                            • {e.name} — {e.sets.length}×{e.sets[0]?.reps ?? 0}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.program ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={open ? 'chevronDown' : 'chevronRight'}
                        className="mt-auto"
                        aria-expanded={open}
                        onClick={() => setOpenProgramId(open ? null : r.id)}
                      >
                        {open ? (isAr ? 'إخفاء الأيام' : 'Hide days') : isAr ? 'إدارة الأيام' : 'Manage days'}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" icon="play" className="mt-auto" onClick={() => startWorkout(r.name, r.exercises)}>
                        {isAr ? 'ابدأ البرنامج' : 'Start program'}
                      </Button>
                    )}
                    {open && r.program && (
                      <ProgramBuilder
                        routine={r}
                        isAr={isAr}
                        onUpdateDay={(dayId, exercises) => updateProgramDay(r, dayId, exercises)}
                        onToggleDayComplete={(dayId, completed) => setProgramDayCompleted(workoutHabit.id, r.id, dayId, completed)}
                        onSetStatus={(s) => setWorkoutRoutineStatus(workoutHabit.id, r.id, s)}
                        onStartDay={(day) => startWorkout(isAr ? day.nameAr || day.name : day.name, day.exercises)}
                        onDelete={() => confirmDeleteRoutine(r.id)}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </StudioSection>

          <StudioSection title={isAr ? 'قوالب جاهزة' : 'Start from a template'}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROGRAM_TEMPLATES.map((t) => {
                const trainingDays = t.days.filter((d) => !d.isRest).length;
                const saved = programSaved === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="studio-tile ex-template text-start flex flex-col gap-2"
                    onClick={() => createProgramFromTemplate(t)}
                  >
                    <span className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                      {isAr ? t.nameAr : t.name}
                    </span>
                    <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                      {splitLabel(t.split, isAr)} · {goalLabel(t.goal, isAr)} · {trainingDays} {isAr ? 'أيام تدريب' : 'training days'}
                    </span>
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                      {isAr ? t.descriptionAr : t.description}
                    </span>
                    <span className={`text-[var(--fs-micro)] mt-auto ${saved ? 'text-[var(--state-success)]' : 'text-[var(--studio-accent,var(--brand))]'}`}>
                      {saved ? (isAr ? '✓ تمت الإضافة' : '✓ Added') : isAr ? '+ إضافة البرنامج' : '+ Add program'}
                    </span>
                  </button>
                );
              })}
            </div>
          </StudioSection>

          <StudioSection title={isAr ? 'إنشاء برنامج جديد' : 'New program'}>
            <form onSubmit={saveRoutine} className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'اسم البرنامج' : 'Program name'}
                </span>
                <input
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  className="input w-full text-[var(--fs-xs)]"
                  required
                />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'المدة المتوقعة (دقائق)' : 'Estimated minutes'}
                </span>
                <input
                  type="number"
                  min={5}
                  value={routineMinutes}
                  onChange={(e) => setRoutineMinutes(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'الوصف' : 'Description'}
                </span>
                <input
                  value={routineDesc}
                  onChange={(e) => setRoutineDesc(e.target.value)}
                  className="input w-full text-[var(--fs-xs)]"
                />
              </label>
              <div className="sm:col-span-2 flex items-center justify-between">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                  {isAr ? 'التمارين المضافة:' : 'Exercises added:'} {draftExercises.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => setShowCatalog((v) => !v)}>
                    {isAr ? 'إضافة تمرين' : 'Add exercise'}
                  </Button>
                  <Button variant="primary" size="sm" type="submit" icon="check">
                    {isAr ? 'حفظ البرنامج' : 'Save program'}
                  </Button>
                </div>
              </div>
            </form>
            {showCatalog && (
              <div className="mt-3">
                <ExerciseCatalog isAr={isAr} variant="inline" onAdd={addCatalogExercise} addLabel={isAr ? 'إضافة' : 'Add'} />
              </div>
            )}
            {routineSaved && (
              <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
                {isAr ? 'تم حفظ البرنامج.' : 'Program saved.'}
              </p>
            )}
          </StudioSection>
        </div>
      )}

      {/* ---------------- EXERCISES ---------------- */}
      {activeTab === 'exercises' && (
        <StudioSection title={isAr ? 'مكتبة التمارين' : 'Exercise library'}>
          <ExerciseCatalog
            isAr={isAr}
            recentSessions={sessions}
            onAdd={(ex) => startWorkout(isAr ? ex.nameAr : ex.nameEn, [exerciseEntryFromCatalog(ex, isAr)])}
            addLabel={isAr ? 'ابدأ هذا التمرين' : 'Start this exercise'}
          />
        </StudioSection>
      )}

      {/* ---------------- HISTORY ---------------- */}
      {activeTab === 'history' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-3">
            <StudioStat label={isAr ? 'إجمالي الحصص' : 'Total sessions'} value={sessions.length} icon="history" />
            <StudioStat label={isAr ? 'إجمالي التكرارات' : 'Total reps'} value={(workoutData.totalReps || 0).toLocaleString()} tone="accent" />
            <StudioStat label={isAr ? 'إجمالي الحجم (كغ)' : 'Total volume (kg)'} value={Math.round(totalVolume).toLocaleString()} />
          </div>
          <StudioSection title={isAr ? 'سجل الحصص' : 'Workout history'}>
            {sessions.length === 0 ? (
              <StudioEmpty icon="history" title={isAr ? 'لا توجد حصص بعد' : 'No sessions yet'} />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="studio-tile">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">{s.title}</p>
                        <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                          {s.date} · {s.durationMinutes}m · {s.totalReps || 0} {isAr ? 'تكرار' : 'reps'} · RPE {s.intensityRating}/5
                        </p>
                      </div>
                      <span className="font-mono text-[var(--studio-accent)] font-[var(--fw-bold)] text-[var(--fs-xs)]">
                        {Math.round(s.volumeKg || volumeFor(s))} {isAr ? 'كغ' : 'kg'}
                      </span>
                    </div>
                    {s.exercises.length > 0 && (
                      <ul className="mt-2 text-[var(--fs-xs)] text-[var(--text-secondary)] space-y-0.5">
                        {s.exercises.map((e) => (
                          <li key={e.id} className="truncate">
                            • {e.name} — {e.sets.filter((x) => x.completed).length}/{e.sets.length} ×{' '}
                            {e.sets[0]?.reps ?? 0}
                            {e.sets[0]?.weightKg ? ` @ ${e.sets[0].weightKg}kg` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.notes && <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)] italic mt-1">“{s.notes}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>
        </div>
      )}

      {/* ---------------- PROGRESS ---------------- */}
      {activeTab === 'progress' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-3">
            <StudioStat label={isAr ? 'تكرارات الشهر' : 'Reps this month'} value={workoutData.totalReps || 0} tone="accent" icon="dumbbell" />
            <StudioStat label={isAr ? 'الحجم الكلي (كغ)' : 'Total volume (kg)'} value={Math.round(totalVolume).toLocaleString()} />
            <StudioStat label={isAr ? 'دقائق التدريب' : 'Training minutes'} value={workoutData.totalMinutes || 0} />
          </div>

          <StudioSection
            title={isAr ? 'أداء التمرين عبر الزمن' : 'Exercise performance over time'}
            action={
              <div className="flex gap-2">
                <NuqtaSelect value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} aria-label={isAr ? 'التمرين' : 'Exercise'} className="text-[var(--fs-xs)]">

                  {exerciseNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NuqtaSelect>
                <NuqtaSelect value={progressMetric} onChange={(e) => setProgressMetric(e.target.value as typeof progressMetric)} aria-label={isAr ? 'المقياس' : 'Metric'} className="text-[var(--fs-xs)]">
                  <option value="reps">{isAr ? 'تكرارات' : 'Reps'}</option>
                  <option value="volume">{isAr ? 'حجم' : 'Volume'}</option>
                  <option value="minutes">{isAr ? 'دقائق' : 'Minutes'}</option>
                </NuqtaSelect>
              </div>
            }
          >
            {exerciseProgress.length === 0 ? (
              <StudioEmpty icon="chart" title={isAr ? 'لا بيانات كافية بعد' : 'Not enough data yet'} />
            ) : (
              <StudioBars data={exerciseProgress} unit={progressMetric} />
            )}
          </StudioSection>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-2">
            <StudioSection title={isAr ? 'أفضل الأرقام الشخصية' : 'Personal records'}>
              {personalRecords.length === 0 ? (
                <StudioEmpty icon="trophy" title={isAr ? 'لا أرقام بعد' : 'No records yet'} />
              ) : (
                <ul className="space-y-2">
                  {personalRecords.map(([name, reps]) => (
                    <li key={name} className="flex items-center justify-between gap-2 text-[var(--fs-xs)]">
                      <span className="text-[var(--text-primary)] truncate inline-flex items-center gap-1"><NuqtaIcon name="trophy" className="w-3.5 h-3.5 text-[var(--studio-accent)]" /> {name}</span>
                      <span className="font-mono text-[var(--studio-accent)] font-[var(--fw-bold)]">
                        {reps} {isAr ? 'تكرار' : 'reps'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </StudioSection>

            <StudioSection title={isAr ? 'توزيع العضلات' : 'Muscle-group distribution'}>
              {Object.keys(muscleDistribution).length === 0 ? (
                <StudioEmpty icon="chart" title={isAr ? 'لا بيانات بعد' : 'No data yet'} />
              ) : (
                <ul className="space-y-2">
                  {Object.entries(muscleDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([mov, reps]) => {
                      const max = Math.max(...Object.values(muscleDistribution));
                      return (
                        <li key={mov} className="text-[var(--fs-xs)]">
                          <div className="flex justify-between mb-1">
                            <span className="text-[var(--text-primary)]">{movementLabel(mov as MuscleMovement, isAr)}</span>
                            <span className="font-mono text-[var(--text-secondary)]">{reps}</span>
                          </div>
                          <div className="h-1.5 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden">
                            <div
                              className="h-full rounded-[var(--r-full)]"
                              style={{ width: `${(reps / max) * 100}%`, background: 'var(--studio-accent)' }}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </StudioSection>
          </div>

          <StudioSection title={isAr ? 'أهداف اللياقة' : 'Fitness targets'}>
            <form onSubmit={saveTargets} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'حصص أسبوعية' : 'Weekly sessions'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={tempWeeklySessions}
                  onChange={(e) => setTempWeeklySessions(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'هدف التكرارات الشهري' : 'Monthly reps'}
                </span>
                <input
                  type="number"
                  min={50}
                  value={tempMonthlyReps}
                  onChange={(e) => setTempMonthlyReps(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <Button variant="secondary" size="sm" type="submit">
                {isAr ? 'حفظ' : 'Save'}
              </Button>
            </form>
            {targetsSaved && (
              <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
                {isAr ? 'تم حفظ الأهداف.' : 'Targets saved.'}
              </p>
            )}
          </StudioSection>
        </div>
      )}
    </StudioFrame>
  );
};
