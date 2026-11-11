import React, { useState } from 'react';
import {
  Habit,
  ExerciseEntry,
  WorkoutRoutine,
  MuscleMovement,
  FitnessDifficulty,
  HomeEquipment
} from '../types';
import { useNuqtaStore } from '../store/nuqtaStore';

interface WorkoutAppModalProps {
  habit: Habit;
  onClose: () => void;
}

interface PrebuiltExercise {
  id: string;
  nameAr: string;
  nameEn: string;
  movement: MuscleMovement;
  difficulty: FitnessDifficulty;
  equipment: HomeEquipment;
  defaultReps: number;
  tipsAr: string;
}

export const WorkoutAppModal: React.FC<WorkoutAppModalProps> = ({ habit, onClose }) => {
  const {
    profile,
    logWorkoutSession,
    addOrUpdateWorkoutRoutine,
    deleteWorkoutRoutine,
    updateFitnessTargets
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  const workoutData = habit.workoutData || {
    sessions: [],
    customRoutines: [],
    weeklyTargetSessions: 4,
    monthlyTargetReps: 500,
    totalReps: 320,
    totalVolumeKg: 0,
    totalMinutes: 140,
    totalWorkouts: 4,
    favoriteRoutine: 'Home Calisthenics'
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'library' | 'routines' | 'history'>('dashboard');

  // Session Logger State
  const [workoutTitle, setWorkoutTitle] = useState(isAr ? 'تمارين وزن الجسم والرشاقة' : 'Home Bodyweight & Calisthenics');
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [intensityRating, setIntensityRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<FitnessDifficulty>('intermediate');
  const [sessionNotes, setSessionNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Exercise builder state
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    {
      id: 'ex-1',
      name: isAr ? 'تمرين الضغط المنزلي (Push-ups)' : 'Push-ups',
      category: 'chest',
      movement: 'push',
      sets: [
        { setNumber: 1, weightKg: 0, reps: 15, restSeconds: 60, completed: true },
        { setNumber: 2, weightKg: 0, reps: 15, restSeconds: 60, completed: true },
        { setNumber: 3, weightKg: 0, reps: 12, restSeconds: 60, completed: true }
      ]
    },
    {
      id: 'ex-2',
      name: isAr ? 'القرفصاء بوزن الجسم (Air Squats)' : 'Bodyweight Air Squats',
      category: 'legs',
      movement: 'legs',
      sets: [
        { setNumber: 1, weightKg: 0, reps: 20, restSeconds: 45, completed: true },
        { setNumber: 2, weightKg: 0, reps: 20, restSeconds: 45, completed: true },
        { setNumber: 3, weightKg: 0, reps: 20, restSeconds: 45, completed: true }
      ]
    },
    {
      id: 'ex-3',
      name: isAr ? 'تمرين البلانك للبطن (Plank Core Hold)' : 'Plank Core Hold',
      category: 'core',
      movement: 'core',
      sets: [
        { setNumber: 1, weightKg: 0, reps: 45, restSeconds: 60, completed: true },
        { setNumber: 2, weightKg: 0, reps: 45, restSeconds: 60, completed: true }
      ]
    }
  ]);

  // Target Editing State
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [tempWeeklySessions, setTempWeeklySessions] = useState(workoutData.weeklyTargetSessions || 4);
  const [tempMonthlyReps, setTempMonthlyReps] = useState(workoutData.monthlyTargetReps || 500);

  // Exercise Library Filtering
  const [libraryMovementFilter, setLibraryMovementFilter] = useState<'all' | MuscleMovement>('all');

  // Routine Creator State
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineDescription, setRoutineDescription] = useState('');
  const [routineLevel, setRoutineLevel] = useState<FitnessDifficulty>('intermediate');
  const [routineDuration, setRoutineDuration] = useState<number>(25);

  // Home Exercises Catalog
  const exerciseCatalog: PrebuiltExercise[] = [
    {
      id: 'cat-push-1',
      nameAr: 'تمرين الضغط القياسي (Standard Push-ups)',
      nameEn: 'Standard Push-ups',
      movement: 'push',
      difficulty: 'intermediate',
      equipment: 'bodyweight_only',
      defaultReps: 15,
      tipsAr: 'حافظ على استقامة الجذع واقتراب المرفقين بزاوية 45 درجة من الجسم.'
    },
    {
      id: 'cat-push-2',
      nameAr: 'ضغط الماس للذراعين (Diamond Push-ups)',
      nameEn: 'Diamond Push-ups',
      movement: 'push',
      difficulty: 'advanced',
      equipment: 'bodyweight_only',
      defaultReps: 10,
      tipsAr: 'تلامس الإبهامين والسبابتين يركز الجهد على الترايسبس والجزء الداخلي للصدر.'
    },
    {
      id: 'cat-push-3',
      nameAr: 'تغطيس الكرسي (Chair Dips)',
      nameEn: 'Chair Tricep Dips',
      movement: 'push',
      difficulty: 'beginner',
      equipment: 'chair_elevated',
      defaultReps: 12,
      tipsAr: 'استند على كرسي منزلي ثابت مع النزول بزاوية 90 درجة للمرفق.'
    },
    {
      id: 'cat-legs-1',
      nameAr: 'القرفصاء الحرة (Bodyweight Air Squats)',
      nameEn: 'Bodyweight Air Squats',
      movement: 'legs',
      difficulty: 'beginner',
      equipment: 'bodyweight_only',
      defaultReps: 20,
      tipsAr: 'اجعل وزنك على الكعبين وانزل حتى يتوازى الفخذان مع الأرض.'
    },
    {
      id: 'cat-legs-2',
      nameAr: 'السكوات البلغاري الأحادي (Bulgarian Split Squats)',
      nameEn: 'Bulgarian Split Squats',
      movement: 'legs',
      difficulty: 'intermediate',
      equipment: 'chair_elevated',
      defaultReps: 12,
      tipsAr: 'ضع ساقك الخلفية على طرف كرسي وركّز الوزن على فخذ الساق الأمامية.'
    },
    {
      id: 'cat-legs-3',
      nameAr: 'جسر الحوض (Glute Bridges)',
      nameEn: 'Glute Bridges',
      movement: 'legs',
      difficulty: 'beginner',
      equipment: 'mat',
      defaultReps: 20,
      tipsAr: 'ارفع الحوض واثبت ثانية في الأعلى لتفعيل عضلات الألوية وأسفل الظهر.'
    },
    {
      id: 'cat-core-1',
      nameAr: 'بلانك الثبات للجذع (Plank Core Hold)',
      nameEn: 'Plank Core Hold',
      movement: 'core',
      difficulty: 'intermediate',
      equipment: 'mat',
      defaultReps: 45,
      tipsAr: 'شد عضلات البطن والأرداف دون رفع أو خفض أسفل الظهر.'
    },
    {
      id: 'cat-core-2',
      nameAr: 'تسلق الجبل الحركي (Mountain Climbers)',
      nameEn: 'Mountain Climbers',
      movement: 'core',
      difficulty: 'intermediate',
      equipment: 'bodyweight_only',
      defaultReps: 25,
      tipsAr: 'سحب الركبتين بالتناوب نحو الصدر بوتيرة ثابتة.'
    },
    {
      id: 'cat-core-3',
      nameAr: 'رفع الأرجل لأسفل البطن (Lying Leg Raises)',
      nameEn: 'Lying Leg Raises',
      movement: 'core',
      difficulty: 'intermediate',
      equipment: 'mat',
      defaultReps: 15,
      tipsAr: 'الصعود والنزول ببطء مع تثبيت أسفل الظهر ملامساً للأرض.'
    },
    {
      id: 'cat-mob-1',
      nameAr: 'إطالة القطة والبقرة (Cat-Cow Stretch)',
      nameEn: 'Cat-Cow Spinal Mobility',
      movement: 'mobility',
      difficulty: 'beginner',
      equipment: 'mat',
      defaultReps: 15,
      tipsAr: 'تنفس بعمق مع تقويس وبسط العمود الفقري لتحرير التوتر المتراكم.'
    },
    {
      id: 'cat-mob-2',
      nameAr: 'إطالة الحوض والورك (Hip Flexor Stretch)',
      nameEn: 'Deep Hip Flexor Stretch',
      movement: 'mobility',
      difficulty: 'beginner',
      equipment: 'mat',
      defaultReps: 30,
      tipsAr: 'ممتاز لمعالجة قصر عضلات الحوض الناتج عن الجلوس المكتبي.'
    },
    {
      id: 'cat-mob-3',
      nameAr: 'وضعية الطفل للاسترخاء (Child’s Pose)',
      nameEn: 'Restorative Child’s Pose',
      movement: 'mobility',
      difficulty: 'beginner',
      equipment: 'mat',
      defaultReps: 60,
      tipsAr: 'أرخِ الجبين على الأرض وتمدد بالذراعين للأمام للتنفس والاستشفاء.'
    },
    {
      id: 'cat-cardio-1',
      nameAr: 'قفز جاكس المنزلي (Jumping Jacks)',
      nameEn: 'Jumping Jacks',
      movement: 'cardio',
      difficulty: 'beginner',
      equipment: 'bodyweight_only',
      defaultReps: 40,
      tipsAr: 'تنشيط الدورة الدموية ومعدل ضربات القلب برفق.'
    },
    {
      id: 'cat-cardio-2',
      nameAr: 'الجري في المكان مع رفع الركبتين (High Knees)',
      nameEn: 'High Knees Cadence',
      movement: 'cardio',
      difficulty: 'intermediate',
      equipment: 'bodyweight_only',
      defaultReps: 30,
      tipsAr: 'رفع الركبة لمستوى الحوض بالتناوب مع الحفاظ على وتيرة خفيفة.'
    }
  ];

  // Helper calculations
  const past7DaysStart = new Date();
  past7DaysStart.setDate(past7DaysStart.getDate() - 7);
  const sessionsThisWeek = workoutData.sessions.filter((s) => new Date(s.date) >= past7DaysStart);

  const past30DaysStart = new Date();
  past30DaysStart.setDate(past30DaysStart.getDate() - 30);
  const repsThisMonth = workoutData.sessions
    .filter((s) => new Date(s.date) >= past30DaysStart)
    .reduce((acc, s) => acc + (s.totalReps || 0), 0);

  // Current session calculated metrics
  const sessionTotalReps = exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((sAcc, s) => sAcc + (s.completed ? (s.reps || 0) : 0), 0);
  }, 0);

  const sessionTotalVolume = exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((sAcc, s) => sAcc + (s.completed ? ((s.weightKg || 0) * (s.reps || 0)) : 0), 0);
  }, 0);

  // Movement balance analytics across all past sessions
  const movementBreakdown: Record<MuscleMovement, number> = {
    push: 0,
    legs: 0,
    core: 0,
    back_pull: 0,
    mobility: 0,
    cardio: 0
  };

  workoutData.sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      const mov = ex.movement || (ex.category === 'chest' ? 'push' : ex.category === 'legs' ? 'legs' : ex.category === 'core' ? 'core' : ex.category === 'cardio' ? 'cardio' : 'mobility');
      const repsCount = ex.sets.reduce((a, st) => a + (st.reps || 0), 0);
      movementBreakdown[mov] = (movementBreakdown[mov] || 0) + repsCount;
    });
  });

  // Handlers
  const handleFinishWorkout = (e: React.FormEvent) => {
    e.preventDefault();

    logWorkoutSession(habit.id, {
      title: workoutTitle.trim() || (isAr ? 'تمارين منزلية' : 'Home Workout'),
      workoutType: 'bodyweight',
      durationMinutes: Number(durationMinutes),
      totalReps: sessionTotalReps,
      volumeKg: sessionTotalVolume,
      exercises,
      intensityRating,
      difficultyLevel,
      notes: sessionNotes.trim() || undefined
    });

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setActiveTab('dashboard');
    }, 1500);
  };

  const handleApplyCatalogExercise = (catEx: PrebuiltExercise) => {
    const newEx: ExerciseEntry = {
      id: 'ex-' + crypto.randomUUID().slice(0, 6),
      name: isAr ? catEx.nameAr : catEx.nameEn,
      category: catEx.movement === 'push' ? 'chest' : catEx.movement === 'legs' ? 'legs' : catEx.movement === 'core' ? 'core' : catEx.movement === 'cardio' ? 'cardio' : 'mobility',
      movement: catEx.movement,
      sets: [
        { setNumber: 1, weightKg: 0, reps: catEx.defaultReps, restSeconds: 45, completed: true },
        { setNumber: 2, weightKg: 0, reps: catEx.defaultReps, restSeconds: 45, completed: true },
        { setNumber: 3, weightKg: 0, reps: catEx.defaultReps, restSeconds: 45, completed: true }
      ]
    };
    setExercises([...exercises, newEx]);
    setActiveTab('session');
  };

  const handleApplyRoutine = (routine: WorkoutRoutine) => {
    setWorkoutTitle(isAr ? routine.nameAr : routine.name);
    setDurationMinutes(routine.estimatedMinutes);
    setDifficultyLevel(routine.targetLevel);
    setExercises(JSON.parse(JSON.stringify(routine.exercises)));
    setActiveTab('session');
  };

  const handleSaveCustomRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim() || exercises.length === 0) return;

    const newRoutine: WorkoutRoutine = {
      id: 'rt-c-' + crypto.randomUUID().slice(0, 6),
      name: routineName.trim(),
      nameAr: routineName.trim(),
      descriptionAr: routineDescription.trim() || undefined,
      targetLevel: routineLevel,
      estimatedMinutes: Number(routineDuration) || 25,
      category: 'bodyweight',
      exercises: JSON.parse(JSON.stringify(exercises)),
      isCustom: true
    };

    addOrUpdateWorkoutRoutine(habit.id, newRoutine);
    setIsCreatingRoutine(false);
    setRoutineName('');
    setRoutineDescription('');
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    updateFitnessTargets(habit.id, {
      weeklyTargetSessions: Number(tempWeeklySessions) || 4,
      monthlyTargetReps: Number(tempMonthlyReps) || 500
    });
    setIsEditingTargets(false);
  };

  const addSet = (exIdx: number) => {
    const updated = [...exercises];
    const prev = updated[exIdx].sets[updated[exIdx].sets.length - 1];
    updated[exIdx].sets.push({
      setNumber: updated[exIdx].sets.length + 1,
      weightKg: prev?.weightKg || 0,
      reps: prev?.reps || 15,
      restSeconds: prev?.restSeconds || 45,
      completed: true
    });
    setExercises(updated);
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weightKg' | 'restSeconds', val: number) => {
    const updated = [...exercises];
    updated[exIdx].sets[setIdx][field] = val;
    setExercises(updated);
  };

  const removeExercise = (exIdx: number) => {
    setExercises(exercises.filter((_, idx) => idx !== exIdx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
      <div
        className="panel max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-[var(--d-workout-border-accent)] shadow-2xl bg-[var(--d-workout-surface)]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* ================= HEADER BAR ================= */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--d-workout-border)] bg-[var(--d-workout-chip)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[var(--d-workout-accent)] font-bold text-xl shadow-inner">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-[var(--d-workout-accent-strong)] font-bold">
                  {isAr ? 'نظام اللياقة البدنية والتمارين المنزلية' : 'HOME CALISTHENICS & FITNESS ECOSYSTEM'}
                </span>
                <span className="text-xs text-muted">· {habit.name}</span>
              </div>
              <h2 className="text-lg font-bold text-[#edf2f4] leading-tight">
                {isAr ? 'استوديو اللياقة وتمارين وزن الجسم' : 'Home Performance & Mobility Studio'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex p-1 rounded-lg bg-[var(--d-workout-deep)] border border-[var(--d-workout-border)]">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'dashboard' ? 'bg-[var(--d-workout-raised)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'الداشبورد والتقدم' : 'Dashboard'}
              </button>
              <button
                onClick={() => setActiveTab('session')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'session' ? 'bg-[var(--d-workout-raised)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'تسجيل تمرين' : 'Log Workout'}
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'library' ? 'bg-[var(--d-workout-raised)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'مكتبة الحركات' : 'Exercise Catalog'}
              </button>
              <button
                onClick={() => setActiveTab('routines')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'routines' ? 'bg-[var(--d-workout-raised)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'الروتينات' : 'Routines'}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'history' ? 'bg-[var(--d-workout-raised)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? `السجل (${workoutData.sessions.length})` : `History (${workoutData.sessions.length})`}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <span className="text-lg font-bold px-2">✕</span>
            </button>
          </div>
        </div>

        {/* ================= MODAL SCROLLABLE CONTENT ================= */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* ================= TAB 1: DASHBOARD & CONSISTENCY ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Home Workout Performance Hero Card */}
              <div className="panel p-5 sm:p-6 border border-emerald-500/25 bg-gradient-to-br from-[var(--d-workout-surface)] via-[var(--d-workout-chip)] to-[var(--d-workout-deep)] rounded-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-[var(--d-workout-accent-strong)] font-bold border border-emerald-500/30">
                      {isAr ? 'حالة اللياقة المنزلية والالتزام' : 'Calisthenics Cadence'}
                    </span>
                    <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                      {isAr ? 'قوة الجسم والانضباط المنزلي' : 'Functional Bodyweight Strength'}
                    </h3>
                    <p className="text-xs text-muted max-w-xl leading-relaxed">
                      {isAr
                        ? 'تتبع حقيقي ودقيق للتكرارات، والمجموعات، وأوقات الراحة، والتوازن العضلي دون افتراضات سعرات غير دقيقة.'
                        : 'Authentic metrics tracking sets, completed reps, movement balance, and structural mobility.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setActiveTab('session')}
                      className="btn primary bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                    >
                      <span>{isAr ? 'بدء تمرين الآن' : 'Start Workout Session'}</span>
                      <span>⚡</span>
                    </button>
                  </div>
                </div>

                {/* 4 Stats Chips inside Hero */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--d-workout-border-soft)]">
                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'حصص الأسبوع:' : 'This Week:'}</span>
                    <strong className="text-xl font-mono text-[var(--d-workout-accent)] font-bold">
                      {sessionsThisWeek.length} / {workoutData.weeklyTargetSessions || 4}
                    </strong>
                    <small className="text-[10px] text-muted block">{isAr ? 'حصص منزلية' : 'sessions'}</small>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'تكرارات الشهر:' : 'Monthly Reps:'}</span>
                    <strong className="text-xl font-mono text-[var(--text-primary)] font-bold">
                      {repsThisMonth} / {workoutData.monthlyTargetReps || 500}
                    </strong>
                    <small className="text-[10px] text-muted block">{isAr ? 'تكرار منجز' : 'reps completed'}</small>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'إجمالي وقت التدريب:' : 'Total Active Time:'}</span>
                    <strong className="text-xl font-mono text-accent font-bold">
                      {Math.floor(workoutData.totalMinutes / 60)}h {workoutData.totalMinutes % 60}m
                    </strong>
                    <small className="text-[10px] text-muted block">{workoutData.totalWorkouts} {isAr ? 'حصة مسجلة' : 'sessions'}</small>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'سلسلة الاستمرار:' : 'Habit Streak:'}</span>
                    <strong className="text-xl font-mono text-[var(--state-warning)] font-bold">
                      {habit.currentStreak || 0} {isAr ? 'يوم' : 'd'} ♨
                    </strong>
                    <small className="text-[10px] text-muted block">{isAr ? 'أفضل سلسلة:' : 'best:'} {habit.longestStreak || 0} {isAr ? 'يوم' : 'd'}</small>
                  </div>
                </div>
              </div>

              {/* Movement Balance Matrix & Targets */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Movement Balance Radar */}
                <div className="md:col-span-7 panel p-5 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] text-sm">
                        {isAr ? 'توازن الحركات العضلية (Movement Balance)' : 'Structural Movement Distribution'}
                      </h4>
                      <p className="text-xs text-muted">
                        {isAr ? 'توزيع التكرارات على الأنماط الحركية لتجنب عدم التوازن العضلي.' : 'Distribution of reps across push, legs, core, and mobility patterns.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'push', labelAr: 'الدفع والصدر (Push)', color: 'bg-emerald-400' },
                      { key: 'legs', labelAr: 'الأرجل والقرفصاء (Legs)', color: 'bg-amber-400' },
                      { key: 'core', labelAr: 'البطن والجذع (Core)', color: 'bg-cyan-400' },
                      { key: 'mobility', labelAr: 'المرونة والاستطالة (Mobility)', color: 'bg-purple-400' },
                      { key: 'cardio', labelAr: 'التحمل والكارديو (Cardio)', color: 'bg-rose-400' }
                    ].map((pattern) => {
                      const count = movementBreakdown[pattern.key as MuscleMovement] || 0;
                      const maxCount = Math.max(1, ...Object.values(movementBreakdown));
                      const pct = Math.min(100, Math.round((count / maxCount) * 100));

                      return (
                        <div key={pattern.key} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-[var(--text-primary)] font-medium">{pattern.labelAr}</span>
                            <span className="font-mono text-muted text-[11px]">{count} {isAr ? 'تكرار' : 'reps'}</span>
                          </div>
                          <div className="progress-line h-2 rounded-full bg-[var(--d-workout-raised)]">
                            <span
                              className={`${pattern.color} h-full block rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Measurable Targets & PRs */}
                <div className="md:col-span-5 panel p-5 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">
                      {isAr ? 'أهداف اللياقة التراكمية' : 'Performance KPIs'}
                    </h4>
                    <button
                      onClick={() => setIsEditingTargets(!isEditingTargets)}
                      className="text-xs text-accent hover:underline"
                    >
                      {isEditingTargets ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'تعديل الأهداف' : 'Edit')}
                    </button>
                  </div>

                  {isEditingTargets ? (
                    <form onSubmit={handleSaveTargets} className="space-y-3">
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'حصص الأسبوع المستهدفة' : 'Weekly Target Sessions'}</label>
                        <input
                          type="number"
                          min="1"
                          max="7"
                          value={tempWeeklySessions}
                          onChange={(e) => setTempWeeklySessions(Number(e.target.value))}
                          className="input w-full text-xs font-mono"
                          required
                        />
                      </div>
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'تكرارات الشهر المستهدفة' : 'Monthly Target Reps'}</label>
                        <input
                          type="number"
                          min="50"
                          max="5000"
                          value={tempMonthlyReps}
                          onChange={(e) => setTempMonthlyReps(Number(e.target.value))}
                          className="input w-full text-xs font-mono"
                          required
                        />
                      </div>
                      <button type="submit" className="btn primary small w-full justify-center">
                        {isAr ? 'حفظ الأهداف' : 'Save Targets'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-[var(--d-workout-surface)] border border-[var(--d-workout-border)] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">{isAr ? 'الانتظام الأسبوعي:' : 'Weekly Consistency:'}</span>
                          <span className="font-mono text-[var(--d-workout-accent)] font-bold">
                            {Math.round((sessionsThisWeek.length / (workoutData.weeklyTargetSessions || 4)) * 100)}%
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-primary)] block">
                          {sessionsThisWeek.length} {isAr ? 'من أصل' : 'of'} {workoutData.weeklyTargetSessions || 4} {isAr ? 'حصص' : 'sessions'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--d-workout-surface)] border border-[var(--d-workout-border)] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">{isAr ? 'حجم التدريب الشهري:' : 'Monthly Volume:'}</span>
                          <span className="font-mono text-[var(--state-warning)] font-bold">
                            {Math.round((repsThisMonth / (workoutData.monthlyTargetReps || 500)) * 100)}%
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-primary)] block">
                          {repsThisMonth} / {workoutData.monthlyTargetReps || 500} {isAr ? 'تكرار' : 'reps'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 text-xs">
                        <strong className="text-[var(--text-primary)] block font-bold mb-1">
                          {isAr ? 'قاعدة التدريب المنزلي الذكي' : 'Bodyweight Adaptation'}
                        </strong>
                        <p className="text-[11px] text-muted leading-relaxed">
                          {isAr
                            ? 'الاستمرار اليومي بـ 15-20 دقيقة يحقق بناءً عضلياً ومرونة أفضل من الحصص المتقطعة المرهقة.'
                            : 'Consistent 15-20 minute daily routines outperform erratic, exhausted overload.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: WORKOUT SESSION LOGGER ================= */}
          {activeTab === 'session' && (
            <form onSubmit={handleFinishWorkout} className="space-y-5">
              {/* Top Workout Metadata */}
              <div className="panel p-4 sm:p-5 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'عنوان الحصة أو الروتين المنزلي' : 'Workout Title / Routine'}
                    </label>
                    <input
                      type="text"
                      value={workoutTitle}
                      onChange={(e) => setWorkoutTitle(e.target.value)}
                      className="input w-full text-xs font-semibold"
                      placeholder="e.g. Full-Body Home Calisthenics"
                      required
                    />
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'مستوى الصعوبة' : 'Difficulty'}</label>
                    <select
                      className="select w-full text-xs"
                      value={difficultyLevel}
                      onChange={(e) => setDifficultyLevel(e.target.value as FitnessDifficulty)}
                    >
                      <option value="beginner">{isAr ? 'مبتدئ (Beginner)' : 'Beginner'}</option>
                      <option value="intermediate">{isAr ? 'متوسط (Intermediate)' : 'Intermediate'}</option>
                      <option value="advanced">{isAr ? 'متقدم (Advanced)' : 'Advanced'}</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'المدة (دقيقة)' : 'Duration (min)'}</label>
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="input w-full text-xs font-mono"
                      min="5"
                      max="180"
                      required
                    />
                  </div>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--d-workout-border-strong)]">
                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'إجمالي التكرارات:' : 'Total Reps:'}</span>
                    <strong className="text-base font-mono text-[var(--d-workout-accent)]">
                      {sessionTotalReps} {isAr ? 'تكرار' : 'reps'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted block">{isAr ? 'شدة الجهد (RPE):' : 'RPE Intensity:'}</span>
                    <select
                      className="bg-transparent text-xs text-[var(--text-primary)] border-b border-[var(--d-workout-border)] focus:outline-none"
                      value={intensityRating}
                      onChange={(e) => setIntensityRating(Number(e.target.value) as any)}
                    >
                      <option value="1">1 - خفيف ومريح</option>
                      <option value="2">2 - سهل وبسيط</option>
                      <option value="3">3 - متوسط متوازن</option>
                      <option value="4">4 - قوي ومركّز</option>
                      <option value="5">5 - أقصى جهد</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('library')}
                      className="btn subtle small text-xs"
                    >
                      <span>+ {isAr ? 'إضافة حركة من المكتبة' : 'Browse Library'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const newEx: ExerciseEntry = {
                          id: 'ex-' + crypto.randomUUID().slice(0, 6),
                          name: isAr ? 'تمرين منزلي مخصص' : 'Custom Exercise',
                          category: 'core',
                          movement: 'core',
                          sets: [
                            { setNumber: 1, weightKg: 0, reps: 15, restSeconds: 45, completed: true },
                            { setNumber: 2, weightKg: 0, reps: 15, restSeconds: 45, completed: true }
                          ]
                        };
                        setExercises([...exercises, newEx]);
                      }}
                      className="btn subtle small text-xs"
                    >
                      <span>+ {isAr ? 'تمرين يدوي' : 'Add Manual'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Exercises Blocks List */}
              <div className="space-y-3">
                {exercises.map((ex, exIdx) => (
                  <div
                    key={ex.id}
                    className="panel p-4 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-[var(--d-workout-accent)] text-xs font-mono font-bold flex items-center justify-center">
                          {exIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={ex.name}
                          onChange={(e) => {
                            const updated = [...exercises];
                            updated[exIdx].name = e.target.value;
                            setExercises(updated);
                          }}
                          className="bg-transparent text-[var(--text-primary)] font-bold text-sm border-b border-transparent hover:border-[var(--d-workout-border)] focus:border-accent focus:outline-none flex-1"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addSet(exIdx)}
                          className="btn subtle text-[11px] py-1 px-2.5"
                        >
                          + {isAr ? 'مجموعة' : 'Set'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(exIdx)}
                          className="text-muted hover:text-red-400 text-xs px-2"
                          title="Remove exercise"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Sets Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted text-[11px] border-b border-[var(--d-workout-border-strong)]">
                            <th className="py-1 px-2 text-start w-12">{isAr ? 'مجموعة' : 'Set'}</th>
                            <th className="py-1 px-2 text-start">{isAr ? 'التكرارات (Reps)' : 'Reps'}</th>
                            <th className="py-1 px-2 text-start">{isAr ? 'وزن إضافي (كغ - اختياري)' : 'Extra Wt (kg)'}</th>
                            <th className="py-1 px-2 text-start">{isAr ? 'الراحة (ثانية)' : 'Rest (sec)'}</th>
                            <th className="py-1 px-2 text-center w-20">{isAr ? 'أُنجز' : 'Done'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ex.sets.map((s, sIdx) => (
                            <tr key={sIdx} className="border-b border-[var(--d-workout-border-soft)] hover:bg-white/[0.02]">
                              <td className="py-1.5 px-2 font-mono text-muted">{s.setNumber}</td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  value={s.reps || 0}
                                  onChange={(e) => updateSet(exIdx, sIdx, 'reps', Number(e.target.value))}
                                  className="w-16 bg-[var(--d-workout-deep)] border border-[var(--d-workout-border)] rounded px-2 py-0.5 font-mono text-[var(--d-workout-accent)] font-bold"
                                  min="1"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  value={s.weightKg || 0}
                                  onChange={(e) => updateSet(exIdx, sIdx, 'weightKg', Number(e.target.value))}
                                  className="w-16 bg-[var(--d-workout-deep)] border border-[var(--d-workout-border)] rounded px-2 py-0.5 font-mono text-[var(--text-primary)]"
                                  min="0"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  value={s.restSeconds || 45}
                                  onChange={(e) => updateSet(exIdx, sIdx, 'restSeconds', Number(e.target.value))}
                                  className="w-16 bg-[var(--d-workout-deep)] border border-[var(--d-workout-border)] rounded px-2 py-0.5 font-mono text-muted"
                                  min="10"
                                  step="5"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={s.completed}
                                  onChange={(e) => {
                                    const updated = [...exercises];
                                    updated[exIdx].sets[sIdx].completed = e.target.checked;
                                    setExercises(updated);
                                  }}
                                  className="accent-emerald-400 w-4 h-4"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes & Actions Bar */}
              <div className="panel p-4 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-auto">
                  {showSuccess ? (
                    <span className="text-xs text-[var(--d-workout-accent)] font-semibold flex items-center gap-1.5 animate-pulse">
                      ✓ {isAr ? 'تم حفظ الحصة وتحديث مؤشرات اللياقة وسلسلة العادة والصحة بنجاح!' : 'Workout logged & health metrics synced!'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      {isAr ? 'تُحسب الحصة كإنجاز فوري لعادة اليوم وتُحدث سجل الصحة والنشاط تلقائياً.' : 'Auto-updates habit streak and Today Health activity.'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRoutine(true)}
                    className="btn subtle small text-xs"
                    title={isAr ? 'حفظ هذه التمارين كروتين دائم' : 'Save as routine'}
                  >
                    💾 {isAr ? 'حفظ كروتين مخصص' : 'Save as Routine'}
                  </button>

                  <button type="submit" className="btn primary bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs">
                    <span>{isAr ? 'إنهاء وتأكيد التمرين' : 'Complete Workout'}</span>
                    <span>⚡</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= TAB 3: EXERCISES CATALOG ================= */}
          {activeTab === 'library' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'مكتبة الحركات والتمارين المنزلية' : 'Home Exercise Movement Library'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'تمارين مصنفة وفق النمط الحركي مع إرشادات الأداء والتركيز.' : 'Bodyweight, mobility, core, and tempo exercises calibrated for home.'}
                  </p>
                </div>
              </div>

              {/* Movement Filters */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[var(--d-workout-surface)] border border-[var(--d-workout-border)]">
                {[
                  { key: 'all', labelAr: 'الكل' },
                  { key: 'push', labelAr: 'الدفع (Push)' },
                  { key: 'legs', labelAr: 'الأرجل (Legs)' },
                  { key: 'core', labelAr: 'البطن والجذع (Core)' },
                  { key: 'mobility', labelAr: 'المرونة والاستطالة (Mobility)' },
                  { key: 'cardio', labelAr: 'الكارديو والرشاقة (Cardio)' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setLibraryMovementFilter(item.key as any)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      libraryMovementFilter === item.key ? 'bg-[var(--d-workout-raised)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.labelAr}
                  </button>
                ))}
              </div>

              {/* Exercises Catalog Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {exerciseCatalog
                  .filter((ex) => libraryMovementFilter === 'all' || ex.movement === libraryMovementFilter)
                  .map((ex) => (
                    <div
                      key={ex.id}
                      className="panel p-4 border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] rounded-xl flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-[var(--d-workout-accent-strong)]">
                            {ex.movement}
                          </span>
                          <span className="text-[10px] font-mono text-muted uppercase">
                            {ex.difficulty}
                          </span>
                        </div>

                        <h4 className="font-bold text-[var(--text-primary)] text-sm">{isAr ? ex.nameAr : ex.nameEn}</h4>
                        <p className="text-xs text-muted/90 mt-1.5 leading-relaxed">
                          {ex.tipsAr}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[var(--d-workout-border-soft)] flex items-center justify-between">
                        <span className="text-[11px] text-muted font-mono">
                          {ex.defaultReps} {isAr ? 'تكرار موصى به' : 'reps'}
                        </span>
                        <button
                          onClick={() => handleApplyCatalogExercise(ex)}
                          className="btn subtle small text-xs text-[var(--d-workout-accent-strong)] hover:bg-emerald-500/15"
                        >
                          + {isAr ? 'إدراج للتمرين' : 'Add to Workout'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ================= TAB 4: ROUTINES & PROGRAMS ================= */}
          {activeTab === 'routines' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'البرامج والروتينات التدريبية' : 'Workout Routines & Programs'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'روتينات مصممة ومختبرة لوزن الجسم والمرونة قابلة للاستخدام بنقرة واحدة.' : 'Pre-built and custom home routines tailored for balanced progression.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsCreatingRoutine(!isCreatingRoutine)}
                  className="btn primary small bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                  {isCreatingRoutine ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? '+ إنشاء روتين مخصص' : '+ Create Routine')}
                </button>
              </div>

              {isCreatingRoutine && (
                <form
                  onSubmit={handleSaveCustomRoutine}
                  className="panel p-5 border border-[var(--d-workout-border-accent)] bg-[var(--d-workout-chip)] rounded-xl space-y-3"
                >
                  <h4 className="font-bold text-xs uppercase tracking-wider text-accent">
                    {isAr ? 'حفظ روتين منزلي جديد من التمارين الحالية' : 'Save Current Exercises as Routine'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'اسم الروتين' : 'Routine Name'}</label>
                      <input
                        type="text"
                        value={routineName}
                        onChange={(e) => setRoutineName(e.target.value)}
                        className="input w-full text-xs"
                        placeholder="e.g. Morning Bodyweight Core"
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'المستوى' : 'Level'}</label>
                      <select
                        className="select w-full text-xs"
                        value={routineLevel}
                        onChange={(e) => setRoutineLevel(e.target.value as any)}
                      >
                        <option value="beginner">{isAr ? 'مبتدئ' : 'Beginner'}</option>
                        <option value="intermediate">{isAr ? 'متوسط' : 'Intermediate'}</option>
                        <option value="advanced">{isAr ? 'متقدم' : 'Advanced'}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'المدة التقديرية (دقيقة)' : 'Duration (min)'}</label>
                      <input
                        type="number"
                        value={routineDuration}
                        onChange={(e) => setRoutineDuration(Number(e.target.value))}
                        className="input w-full text-xs font-mono"
                        min="5"
                        required
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'وصف الروتين والهدف منه' : 'Description'}</label>
                    <input
                      type="text"
                      value={routineDescription}
                      onChange={(e) => setRoutineDescription(e.target.value)}
                      className="input w-full text-xs"
                      placeholder="e.g. Focus on chest and core without any weights"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="submit" className="btn primary small">
                      {isAr ? 'حفظ الروتين في المكتبة' : 'Save Routine'}
                    </button>
                  </div>
                </form>
              )}

              {/* Routines Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(workoutData.customRoutines || []).map((rt) => (
                  <div
                    key={rt.id}
                    className="panel p-5 border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] rounded-xl flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-[var(--d-workout-accent-strong)]">
                              {rt.category}
                            </span>
                            <span className="text-[10px] text-muted font-mono">{rt.targetLevel}</span>
                          </div>
                          <h4 className="font-bold text-[var(--text-primary)] text-base mt-1.5">{isAr ? rt.nameAr : rt.name}</h4>
                          {rt.descriptionAr && (
                            <p className="text-xs text-muted mt-1 leading-relaxed">{rt.descriptionAr}</p>
                          )}
                        </div>

                        {rt.isCustom && (
                          <button
                            onClick={() => deleteWorkoutRoutine(habit.id, rt.id)}
                            className="text-muted hover:text-red-400 text-xs px-1"
                            title={isAr ? 'حذف الروتين' : 'Delete routine'}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Exercises list inside routine */}
                      <div className="space-y-1.5 mt-3 pt-3 border-t border-[var(--d-workout-border-soft)]">
                        {rt.exercises.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-muted">
                            <span className="text-[var(--text-primary)]">✦ {item.name}</span>
                            <span className="font-mono text-[11px]">{item.sets.length} {isAr ? 'مجموعات' : 'sets'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--d-workout-border-soft)] flex items-center justify-between">
                      <span className="text-xs font-mono text-muted">~{rt.estimatedMinutes} {isAr ? 'دقيقة' : 'mins'}</span>
                      <button
                        onClick={() => handleApplyRoutine(rt)}
                        className="btn primary small bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                      >
                        <span>{isAr ? 'تفعيل وبدء هذا الروتين' : 'Launch Routine'}</span>
                        <span>⚡</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 5: PAST SESSIONS HISTORY ================= */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'سجل الحصص التدريبية السابقة' : 'Past Workout Sessions'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'توثيق دقيق لكل حصة منزلية وتكراراتها ومجموعاتها.' : 'Historical performance logs.'}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted">
                  {workoutData.sessions.length} {isAr ? 'حصص مسجلة' : 'total logs'}
                </span>
              </div>

              {workoutData.sessions.length === 0 ? (
                <div className="p-12 text-center panel border border-[var(--d-workout-border)] bg-[var(--d-workout-surface)] rounded-2xl">
                  <span className="text-3xl block mb-2">⚡</span>
                  <strong className="text-[var(--text-primary)] block">{isAr ? 'لا توجد حصص مسجلة بعد' : 'No workout logs recorded yet'}</strong>
                  <button onClick={() => setActiveTab('session')} className="btn primary small mt-3">
                    {isAr ? 'تسجيل أول حصة' : 'Record First Workout'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {workoutData.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="panel p-4 border border-[var(--d-workout-border)] bg-[var(--d-workout-chip)] rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/20 text-[var(--d-workout-accent-strong)]">
                              {s.workoutType}
                            </span>
                            <span className="text-xs text-muted font-mono">{s.date}</span>
                          </div>
                          <h4 className="font-bold text-[var(--text-primary)] text-sm mt-1">{s.title}</h4>
                        </div>

                        <div className="text-end">
                          <strong className="text-base font-mono text-[var(--d-workout-accent)] block">
                            {(s.totalReps || 0) > 0 ? `${s.totalReps} reps` : `${s.durationMinutes} min`}
                          </strong>
                          <span className="text-[11px] text-muted">
                            {s.durationMinutes}m · RPE {s.intensityRating}/5
                          </span>
                        </div>
                      </div>

                      {s.exercises && s.exercises.length > 0 && (
                        <div className="pt-2 border-t border-[var(--d-workout-border-strong)] flex flex-wrap gap-2 text-xs">
                          {s.exercises.map((ex, i) => (
                            <span
                              key={i}
                              className="p-1.5 rounded bg-[rgba(255,255,255,0.02)] border border-[var(--d-workout-border)] text-[11px] text-muted"
                            >
                              <strong className="text-[var(--text-primary)]">{ex.name}</strong>: {ex.sets.length} sets ({ex.sets.reduce((a, b) => a + (b.reps || 0), 0)} reps)
                            </span>
                          ))}
                        </div>
                      )}

                      {s.notes && (
                        <p className="text-xs text-muted/80 italic border-s-2 border-accent ps-2">
                          "{s.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

