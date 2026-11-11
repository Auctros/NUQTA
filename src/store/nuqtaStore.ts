import { defaultProfile } from '../lib/storage';
import { emptyHealthRecord } from '../lib/healthDefaults';
import { localDateKey } from '../lib/dateKey';
import { create } from 'zustand';
import {
  Task,
  Habit,
  Goal,
  KeyResult,
  GoalMilestone,
  FocusSession,
  HealthMetric,
  ExpenseRecord,
  SavingsGoal,
  JournalEntry,
  UserProfile,
  SundayRitualReview,
  PriorityLevel,
  TaskStatus,
  HistoryAuditLogEntry
} from '../types';
import { NuqtaStorageEngine } from '../lib/storage';
import { parseNaturalLanguageTask } from '../lib/nlpParser';
import { computeDailyEnergyScore } from '../lib/energyAlgorithm';
import {
  generateInitialQuranSurahs,
  mergeAyahRanges,
  calculateDistinctAyahs,
  getSurahMeta
} from '../lib/quranData';
import confetti from 'canvas-confetti';

interface NuqtaStoreState {
  // Data
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  healthMetrics: Record<string, HealthMetric>;
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoal[];
  journalEntries: JournalEntry[];
  profile: UserProfile;
  sundayReviews: SundayRitualReview[];
  historyAuditLogs: HistoryAuditLogEntry[];

  // Computed & UI State
  energyScore: number;
  isRescueModeOpen: boolean;
  isQuickCaptureOpen: boolean;
  isSundayRitualOpen: boolean;
  activeNavTab: 'today' | 'tasks' | 'habits' | 'goals' | 'focus' | 'calendar' | 'health' | 'finance' | 'journal' | 'insights' | 'simulator' | 'settings' | 'quran' | 'reading' | 'workout' | 'drawing' | 'archive';
  searchQuery: string;
  selectedTagFilter: string | null;

  // Actions
  initializeStore: () => void;
  setActiveNavTab: (tab: NuqtaStoreState['activeNavTab']) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTagFilter: (tag: string | null) => void;

  // Transient cross-screen focus request — UI only, never persisted
  focusRequest: { domain: string; entityId: string; nonce: number } | null;
  requestFocus: (domain: string, entityId: string) => void;
  consumeFocus: () => void;

  // Task Actions
  addTaskFromNLP: (rawText: string) => Task;
  createTask: (draft: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTopThree: (id: string) => { success: boolean; message?: string };
  deleteTask: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  smartBatchReschedule: (tasksToReschedule: { taskId: string; date: string }[]) => void;

  // Habit Actions
  toggleHabitToday: (id: string) => void;
  useStreakFreeze: (id: string) => boolean;
  createHabit: (habit: Partial<Habit>) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;

  // Dedicated Habit App Actions (Reading, Workout, Drawing, Quran)
  logReadingSession: (habitId: string, session: Omit<import('../types').ReadingSessionLog, 'id' | 'date'>) => void;
  addOrUpdateBook: (habitId: string, book: import('../types').BookItem) => void;
  deleteBook: (habitId: string, bookId: string) => void;
  setActiveBook: (habitId: string, bookId: string) => void;
  addBookQuote: (habitId: string, quote: Omit<import('../types').BookQuote, 'id' | 'date'>) => void;
  deleteBookQuote: (habitId: string, quoteId: string) => void;
  updateReadingTargets: (habitId: string, targets: { dailyTargetPages?: number; weeklyTargetPages?: number; annualTargetBooks?: number }) => void;

  logWorkoutSession: (habitId: string, session: Omit<import('../types').WorkoutSessionLog, 'id' | 'date'>) => void;
  addOrUpdateWorkoutRoutine: (habitId: string, routine: import('../types').WorkoutRoutine) => void;
  deleteWorkoutRoutine: (habitId: string, routineId: string) => void;
  updateFitnessTargets: (habitId: string, targets: { weeklyTargetSessions?: number; monthlyTargetReps?: number }) => void;

  logDrawingSession: (habitId: string, piece: Omit<import('../types').ArtworkPiece, 'id' | 'completedDate'>) => void;
  deleteArtworkPiece: (habitId: string, pieceId: string) => void;
  addOrUpdateArtProject: (habitId: string, project: import('../types').ArtProject) => void;
  deleteArtProject: (habitId: string, projectId: string) => void;
  updateDrawingTargets: (habitId: string, targets: { weeklyTargetHours?: number }) => void;

  logQuranSession: (habitId: string, session: Omit<import('../types').QuranSessionLog, 'id' | 'date'>) => void;
  updateSurahStatus: (habitId: string, surahNumber: number, status: import('../types').QuranSurahStatus, masteryRating?: 1 | 2 | 3 | 4 | 5) => void;
  updateQuranRevisionSchedule: (habitId: string, schedule: Partial<import('../types').QuranRevisionSchedule>) => void;
  deleteQuranSession: (habitId: string, sessionId: string) => void;

  // Goal Actions
  createGoal: (goal: Partial<Goal>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  updateKeyResult: (goalId: string, krId: string, val: number) => void;
  addKeyResult: (goalId: string, kr: Omit<KeyResult, 'id'>) => void;
  deleteKeyResult: (goalId: string, krId: string) => void;
  addGoalMilestone: (goalId: string, milestone: Omit<GoalMilestone, 'id'>) => void;
  toggleGoalMilestone: (goalId: string, milestoneId: string) => void;
  deleteGoalMilestone: (goalId: string, milestoneId: string) => void;
  linkActivityToGoal: (goalId: string, type: 'task' | 'habit' | 'book' | 'artProject', activityId: string) => void;
  unlinkActivityFromGoal: (goalId: string, type: 'task' | 'habit' | 'book' | 'artProject', activityId: string) => void;
  deleteGoal: (id: string) => void;

  // Focus Actions
  logFocusSession: (session: Omit<FocusSession, 'id' | 'completedAt'>) => void;

  // Health Actions
  updateTodayHealth: (updates: Partial<HealthMetric>) => void;
  addHydration: (amountMl: number) => void;

  // Finance Actions
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  deleteExpense: (id: string) => void;
  updateSavingsGoal: (id: string, amountToAdd: number) => void;
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id'>) => void;

  // Journal Actions
  saveJournalEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => void;

  // Sunday Ritual & Rescue Mode
  setRescueModeOpen: (open: boolean) => void;
  setQuickCaptureOpen: (open: boolean) => void;
  setSundayRitualOpen: (open: boolean) => void;
  executeRescueMode: (chosenAnchorTaskId: string, deferOthersToTomorrow: boolean) => void;
  completeSundayRitual: (review: Omit<SundayRitualReview, 'id' | 'completedAt'>) => void;

  // Profile & Gamification
  addXP: (amount: number) => void;
  setLanguage: (lang: 'en' | 'ar') => void;
  setTheme: (theme: UserProfile['theme']) => void;
  updateProfileName: (name: string) => void;

  // Universal Archive & Life History Actions
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  archiveHabit: (id: string) => void;
  restoreHabit: (id: string) => void;
  archiveBook: (habitId: string, bookId: string) => void;
  restoreBook: (habitId: string, bookId: string) => void;
  archiveWorkoutRoutine: (habitId: string, routineId: string) => void;
  restoreWorkoutRoutine: (habitId: string, routineId: string) => void;
  archiveArtProject: (habitId: string, projectId: string) => void;
  restoreArtProject: (habitId: string, projectId: string) => void;
  archiveGoal: (id: string) => void;
  restoreGoal: (id: string) => void;
  logHistoryAudit: (entry: Omit<HistoryAuditLogEntry, 'id' | 'timestamp'>) => void;
}

export const useNuqtaStore = create<NuqtaStoreState>((set, get) => ({
  tasks: [],
  habits: [],
  goals: [],
  focusSessions: [],
  healthMetrics: {},
  expenses: [],
  savingsGoals: [],
  journalEntries: [],
  historyAuditLogs: [],
  profile: defaultProfile(),
  sundayReviews: [],

  energyScore: 50,
  isRescueModeOpen: false,
  isQuickCaptureOpen: false,
  isSundayRitualOpen: false,
  activeNavTab: 'today',
  focusRequest: null,
  searchQuery: '',
  selectedTagFilter: null,

  initializeStore: () => {
    const tasks = NuqtaStorageEngine.getTasks();
    const habits = NuqtaStorageEngine.getHabits();
    const goals = NuqtaStorageEngine.getGoals();
    const focusSessions = NuqtaStorageEngine.getFocusSessions();
    const healthMetrics = NuqtaStorageEngine.getHealthMetrics();
    const expenses = NuqtaStorageEngine.getExpenses();
    const savingsGoals = NuqtaStorageEngine.getSavingsGoals();
    const journalEntries = NuqtaStorageEngine.getJournalEntries();
    const profile = NuqtaStorageEngine.getProfile();
    const sundayReviews = NuqtaStorageEngine.getSundayReviews();
    const historyAuditLogs = NuqtaStorageEngine.getHistoryAuditLogs();

    const todayStr = localDateKey();
    const todayHealth = healthMetrics[todayStr] ?? null;

    const energy = computeDailyEnergyScore(todayHealth, tasks);

    // Check if Sunday review is due (if Sunday and not done today)
    const isSunday = new Date().getDay() === 0;
    const reviewedToday = sundayReviews.some((r) => r.date === todayStr);
    const weeklySundayReviewDue = isSunday && !reviewedToday;

    set({
      tasks,
      habits,
      goals,
      focusSessions,
      healthMetrics,
      expenses,
      savingsGoals,
      journalEntries,
      profile: { ...profile, weeklySundayReviewDue },
      sundayReviews,
      historyAuditLogs,
      energyScore: energy
    });
  },

  setActiveNavTab: (tab) => set({ activeNavTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedTagFilter: (tag) => set({ selectedTagFilter: tag }),
  requestFocus: (domain, entityId) => set({ focusRequest: { domain, entityId, nonce: Date.now() } }),
  consumeFocus: () => set({ focusRequest: null }),

  // TASK ACTIONS
  addTaskFromNLP: (rawText: string) => {
    const parsed = parseNaturalLanguageTask(rawText);
    const todayStr = localDateKey();

    const newTask: Task = {
      id: 't-' + crypto.randomUUID().slice(0, 8),
      title: parsed.title,
      priority: parsed.priority,
      status: 'todo',
      isTopThree: false,
      scheduledDate: parsed.scheduledDate || todayStr,
      scheduledTime: parsed.scheduledTime,
      estimatedMinutes: parsed.estimatedMinutes || 30,
      tags: parsed.tags,
      energyLevelRequired: parsed.energyLevelRequired || 'medium',
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newTask, ...get().tasks];
    NuqtaStorageEngine.saveTasks(updated);

    const todayHealth = get().healthMetrics[todayStr];
    const energy = computeDailyEnergyScore(todayHealth, updated);

    set({ tasks: updated, energyScore: energy });
    get().addXP(15);
    return newTask;
  },

  createTask: (draft) => {
    const todayStr = localDateKey();
    const newTask: Task = {
      id: 't-' + crypto.randomUUID().slice(0, 8),
      title: draft.title || 'Untitled Action',
      notes: draft.notes || '',
      priority: draft.priority || 3,
      status: 'todo',
      isTopThree: draft.isTopThree || false,
      scheduledDate: draft.scheduledDate || todayStr,
      scheduledTime: draft.scheduledTime,
      estimatedMinutes: draft.estimatedMinutes || 30,
      tags: draft.tags || [],
      energyLevelRequired: draft.energyLevelRequired || 'medium',
      subtasks: draft.subtasks || [],
      linkedGoalId: draft.linkedGoalId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newTask, ...get().tasks];
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });

    if (newTask.linkedGoalId) {
      const updatedGoals = get().goals.map((g) => {
        if (g.id === newTask.linkedGoalId) {
          const currentIds = g.linkedTaskIds || [];
          if (!currentIds.includes(newTask.id)) {
            return { ...g, linkedTaskIds: [...currentIds, newTask.id], updatedAt: new Date().toISOString() };
          }
        }
        return g;
      });
      NuqtaStorageEngine.saveGoals(updatedGoals);
      set({ goals: updatedGoals });
    }

    get().addXP(15);
  },

  updateTask: (id, updates) => {
    const prevTask = get().tasks.find((t) => t.id === id);
    const updated = get().tasks.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    NuqtaStorageEngine.saveTasks(updated);

    const todayStr = localDateKey();
    const todayHealth = get().healthMetrics[todayStr];
    const energy = computeDailyEnergyScore(todayHealth, updated);

    set({ tasks: updated, energyScore: energy });

    // Sync goal relations if linkedGoalId changed
    if (updates.linkedGoalId !== undefined && prevTask && prevTask.linkedGoalId !== updates.linkedGoalId) {
      const oldGoalId = prevTask.linkedGoalId;
      const newGoalId = updates.linkedGoalId;
      const updatedGoals = get().goals.map((g) => {
        if (oldGoalId && g.id === oldGoalId) {
          return {
            ...g,
            linkedTaskIds: (g.linkedTaskIds || []).filter((tid) => tid !== id),
            updatedAt: new Date().toISOString()
          };
        }
        if (newGoalId && g.id === newGoalId) {
          const currentIds = g.linkedTaskIds || [];
          if (!currentIds.includes(id)) {
            return {
              ...g,
              linkedTaskIds: [...currentIds, id],
              updatedAt: new Date().toISOString()
            };
          }
        }
        return g;
      });
      NuqtaStorageEngine.saveGoals(updatedGoals);
      set({ goals: updatedGoals });
    }
  },

  toggleTaskStatus: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : undefined;

    if (nextStatus === 'completed') {
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#fbbf24', '#34d399', '#60a5fa']
        });
      } catch {
        // ignore if confetti unavailable in test env
      }
      get().addXP(30);
    }

    const updated = get().tasks.map((t) =>
      t.id === id ? { ...t, status: nextStatus, completedAt, updatedAt: new Date().toISOString() } : t
    );
    NuqtaStorageEngine.saveTasks(updated);

    const todayStr = localDateKey();
    const todayHealth = get().healthMetrics[todayStr];
    const energy = computeDailyEnergyScore(todayHealth, updated);

    set({ tasks: updated, energyScore: energy });
  },

  toggleTopThree: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return { success: false, message: 'Task not found' };

    const currentTopThreeCount = get().tasks.filter(
      (t) => t.isTopThree && t.status !== 'completed'
    ).length;

    // Strict Behavioral Science Guard: No more than 3 active focus items
    if (!task.isTopThree && currentTopThreeCount >= 3) {
      return {
        success: false,
        message: 'Cognitive Overload Protection: You can only have strictly 3 active Top Tasks. Complete or remove one first.'
      };
    }

    const nextState = !task.isTopThree;
    const updated = get().tasks.map((t) =>
      t.id === id ? { ...t, isTopThree: nextState, updatedAt: new Date().toISOString() } : t
    );
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
    return { success: true };
  },

  deleteTask: (id) => {
    const updated = get().tasks.filter((t) => t.id !== id);
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });

    const updatedGoals = get().goals.map((g) => ({
      ...g,
      linkedTaskIds: (g.linkedTaskIds || []).filter((tid) => tid !== id)
    }));
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });
  },

  toggleSubtask: (taskId, subtaskId) => {
    const updated = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subtasks = t.subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      );
      return { ...t, subtasks, updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
  },

  addSubtask: (taskId, title) => {
    if (!title.trim()) return;
    const updated = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subtasks = [
        ...t.subtasks,
        { id: 'st-' + crypto.randomUUID().slice(0, 6), title: title.trim(), completed: false }
      ];
      return { ...t, subtasks, updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
  },

  smartBatchReschedule: (tasksToReschedule) => {
    const updated = get().tasks.map((t) => {
      const match = tasksToReschedule.find((r) => r.taskId === t.id);
      if (match) {
        return { ...t, scheduledDate: match.date, updatedAt: new Date().toISOString() };
      }
      return t;
    });
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
  },

  // HABIT ACTIONS
  toggleHabitToday: (id) => {
    const todayStr = localDateKey();
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;

    const alreadyDone = habit.completedDates.includes(todayStr);
    const updatedDates = alreadyDone
      ? habit.completedDates.filter((d) => d !== todayStr)
      : [...habit.completedDates, todayStr];

    const currentStreak = alreadyDone
      ? Math.max(0, habit.currentStreak - 1)
      : habit.currentStreak + 1;
    const longestStreak = Math.max(habit.longestStreak, currentStreak);

    if (!alreadyDone) {
      try {
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#f59e0b', '#ec4899', '#10b981']
        });
      } catch {}
      get().addXP(25);
    }

    const updated = get().habits.map((h) =>
      h.id === id ? { ...h, completedDates: updatedDates, currentStreak, longestStreak } : h
    );
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  useStreakFreeze: (id) => {
    const todayStr = localDateKey();
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || habit.freezesRemaining <= 0) return false;

    const updated = get().habits.map((h) => {
      if (h.id !== id) return h;
      return {
        ...h,
        freezesRemaining: h.freezesRemaining - 1,
        freezesUsedDates: [...h.freezesUsedDates, todayStr]
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    return true;
  },

  createHabit: (habitDraft) => {
    const specializedType = habitDraft.specializedType || 'standard';
    let readingData = habitDraft.readingData;
    let workoutData = habitDraft.workoutData;
    let drawingData = habitDraft.drawingData;
    let quranData = habitDraft.quranData;

    const todayStr = localDateKey();

    if (specializedType === 'reading' && !readingData) {
      const book1Id = 'book-' + crypto.randomUUID().slice(0, 6);
      readingData = {
        annualTargetBooks: 24,
        dailyTargetPages: 20,
        weeklyTargetPages: 140,
        totalPagesRead: 545,
        totalReadingMinutes: 780,
        activeBookId: book1Id,
        books: [
          {
            id: book1Id,
            title: 'العادات الذرية (Atomic Habits)',
            author: 'James Clear',
            category: 'productivity',
            totalPages: 320,
            currentPage: 65,
            status: 'reading',
            coverColor: '#d97706',
            rating: 5,
            notes: 'كتاب استثنائي يركز على قوة التراكم البسيط بنسبة 1% يومياً.',
            startDate: todayStr
          },
          {
            id: 'book-' + crypto.randomUUID().slice(0, 6),
            title: 'العمل العميق (Deep Work)',
            author: 'Cal Newport',
            category: 'productivity',
            totalPages: 280,
            currentPage: 0,
            status: 'want_to_read',
            coverColor: '#2563eb',
            notes: 'قائمة القراءة القادمة لتعزيز التركيز العالي بدون تشتت.'
          },
          {
            id: 'book-' + crypto.randomUUID().slice(0, 6),
            title: 'التفكير السريع والبطيء (Thinking, Fast and Slow)',
            author: 'Daniel Kahneman',
            category: 'philosophy',
            totalPages: 500,
            currentPage: 500,
            status: 'completed',
            coverColor: '#059669',
            rating: 5,
            completedDate: todayStr,
            notes: 'استكشاف شامل لانحيازات النظام 1 العفوي والنظام 2 التحليلي.'
          }
        ],
        quotes: [
          {
            id: 'q-1',
            quote: 'أنت لا ترتقي إلى مستوى أهدافك، بل تهبط إلى مستوى أنظمتك اليومية.',
            bookId: book1Id,
            bookTitle: 'العادات الذرية',
            author: 'James Clear',
            page: 27,
            date: todayStr
          },
          {
            id: 'q-2',
            quote: 'القدرة على أداء العمل العميق أصبحت نادرة وفي نفس الوقت ذات قيمة استثنائية في اقتصاد المعرفة.',
            bookTitle: 'العمل العميق',
            author: 'Cal Newport',
            page: 14,
            date: todayStr
          }
        ],
        sessions: [
          {
            id: 'rs-' + crypto.randomUUID().slice(0, 6),
            date: todayStr,
            bookId: book1Id,
            bookTitle: 'العادات الذرية (Atomic Habits)',
            pagesRead: 20,
            durationMinutes: 28,
            speedPagesPerHour: 43,
            notes: 'قراءة الفصل الثالث: بناء بيئة تدعم السلوك المرغوب.'
          }
        ]
      };
    } else if (specializedType === 'workout' && !workoutData) {
      workoutData = {
        weeklyTargetSessions: 4,
        monthlyTargetReps: 500,
        totalReps: 320,
        totalVolumeKg: 0,
        totalMinutes: 140,
        totalWorkouts: 4,
        favoriteRoutine: 'Home Calisthenics',
        customRoutines: [
          {
            id: 'rt-1',
            name: 'Full-Body Calisthenics',
            nameAr: 'روتين وزن الجسم المتكامل (ضغط + سكوات + بلانك)',
            descriptionAr: 'بناء القوة الأساسية للجسم بالكامل بدون أي أوزان.',
            targetLevel: 'intermediate',
            estimatedMinutes: 25,
            category: 'bodyweight',
            exercises: [
              {
                id: 'ex-1',
                name: 'تمرين الضغط (Push-ups)',
                category: 'chest',
                movement: 'push',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 15, completed: true, restSeconds: 60 },
                  { setNumber: 2, weightKg: 0, reps: 15, completed: true, restSeconds: 60 },
                  { setNumber: 3, weightKg: 0, reps: 12, completed: true, restSeconds: 60 }
                ]
              },
              {
                id: 'ex-2',
                name: 'سكوات بوزن الجسم (Air Squats)',
                category: 'legs',
                movement: 'legs',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 20, completed: true, restSeconds: 45 },
                  { setNumber: 2, weightKg: 0, reps: 20, completed: true, restSeconds: 45 },
                  { setNumber: 3, weightKg: 0, reps: 20, completed: true, restSeconds: 45 }
                ]
              },
              {
                id: 'ex-3',
                name: 'بلانك البطن (Plank Core Hold)',
                category: 'core',
                movement: 'core',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 45, completed: true, restSeconds: 60 },
                  { setNumber: 2, weightKg: 0, reps: 45, completed: true, restSeconds: 60 }
                ]
              }
            ]
          },
          {
            id: 'rt-2',
            name: 'Core & Abs Burn',
            nameAr: 'روتين البطن والـ Core المنزلي',
            descriptionAr: 'تقوية عضلات الجذع وحماية أسفل الظهر.',
            targetLevel: 'beginner',
            estimatedMinutes: 18,
            category: 'core',
            exercises: [
              {
                id: 'ex-c1',
                name: 'بلانك ساكن (Plank Hold)',
                category: 'core',
                movement: 'core',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 45, completed: true, restSeconds: 45 },
                  { setNumber: 2, weightKg: 0, reps: 45, completed: true, restSeconds: 45 }
                ]
              },
              {
                id: 'ex-c2',
                name: 'تسلق الجبل (Mountain Climbers)',
                category: 'core',
                movement: 'core',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 25, completed: true, restSeconds: 45 },
                  { setNumber: 2, weightKg: 0, reps: 25, completed: true, restSeconds: 45 }
                ]
              }
            ]
          },
          {
            id: 'rt-3',
            name: 'Spinal Mobility & Stretch',
            nameAr: 'إطالات منزلية ومرونة المفاصل',
            descriptionAr: 'تحرير التوتر من الظهر والكتفين بعد الجلوس المطول.',
            targetLevel: 'beginner',
            estimatedMinutes: 15,
            category: 'mobility',
            exercises: [
              {
                id: 'ex-m1',
                name: 'إطالة القطة والبقرة (Cat-Cow)',
                category: 'mobility',
                movement: 'mobility',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 15, completed: true, restSeconds: 30 },
                  { setNumber: 2, weightKg: 0, reps: 15, completed: true, restSeconds: 30 }
                ]
              },
              {
                id: 'ex-m2',
                name: 'إطالة الحوض والورك (Hip Flexor)',
                category: 'mobility',
                movement: 'mobility',
                sets: [
                  { setNumber: 1, weightKg: 0, reps: 30, completed: true, restSeconds: 30 }
                ]
              }
            ]
          }
        ],
        sessions: [
          {
            id: 'ws-' + crypto.randomUUID().slice(0, 6),
            date: todayStr,
            title: 'تمارين وزن الجسم والرشاقة (ضغط وسكوات وبلانك)',
            workoutType: 'bodyweight',
            durationMinutes: 28,
            totalReps: 82,
            volumeKg: 0,
            intensityRating: 3,
            difficultyLevel: 'intermediate',
            notes: 'أداء ممتاز مع التركيز على وتيرة الحركة الهادئة.',
            exercises: [
              {
                id: 'ex-1',
                name: 'تمرين الضغط (Push-ups)',
                category: 'chest',
                movement: 'push',
                sets: [
                  { setNumber: 1, reps: 15, completed: true },
                  { setNumber: 2, reps: 15, completed: true },
                  { setNumber: 3, reps: 12, completed: true }
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
            ]
          }
        ]
      };
    } else if (specializedType === 'drawing' && !drawingData) {
      const proj1Id = 'proj-' + crypto.randomUUID().slice(0, 6);
      const proj2Id = 'proj-' + crypto.randomUUID().slice(0, 6);
      drawingData = {
        weeklyTargetHours: 3,
        totalDrawingMinutes: 240,
        totalSketches: 5,
        favoriteMedium: 'sketch',
        projects: [
          {
            id: proj1Id,
            title: 'دفتر دراسات الملامح والظلال',
            description: 'سكتشات يومية سريعة لتدريب العين وتطوير دقة التظليل.',
            stage: 'sketching',
            medium: 'sketch',
            startedDate: todayStr,
            thumbnailColor: '#7c3aed',
            totalMinutesSpent: 90,
            sessionsCount: 3,
            tags: ['Anatomy', 'Shadows', 'Charcoal']
          },
          {
            id: proj2Id,
            title: 'مشهد معماري مستقبلي لمدينة أندلسية',
            description: 'لوحة رقمية متكاملة للمنظور المعماري والأقواس التراثية.',
            stage: 'coloring',
            medium: 'digital',
            startedDate: todayStr,
            thumbnailColor: '#0ea5e9',
            totalMinutesSpent: 150,
            sessionsCount: 2,
            tags: ['Architecture', 'Digital Art', 'Lighting']
          }
        ],
        pieces: [
          {
            id: 'art-' + crypto.randomUUID().slice(0, 6),
            projectId: proj1Id,
            projectTitle: 'دفتر دراسات الملامح والظلال',
            title: 'دراسة سريعة للعين والأنف بالفحم',
            medium: 'sketch',
            durationMinutes: 30,
            completedDate: todayStr,
            stage: 'sketching',
            notes: 'تركيز على مصادر الإضاءة والظلال الساقطة.'
          },
          {
            id: 'art-' + crypto.randomUUID().slice(0, 6),
            projectId: proj2Id,
            projectTitle: 'مشهد معماري مستقبلي',
            title: 'منظور البوابة والأقواس التراثية',
            medium: 'digital',
            durationMinutes: 60,
            completedDate: todayStr,
            stage: 'inking',
            notes: 'تحديد خطوط المنظور ثلاثية الأبعاد ببرنامج الرسم.'
          }
        ]
      };
    } else if (specializedType === 'quran' && !quranData) {
      const initialSurahs = generateInitialQuranSurahs();
      const distinctAyahs = initialSurahs.reduce((sum, s) => sum + s.memorizedAyahsCount, 0);
      const completedSurahs = initialSurahs.filter((s) => s.status === 'completed').length;
      quranData = {
        surahs: initialSurahs,
        sessions: [
          {
            id: 'qs-seed-1',
            date: todayStr,
            type: 'new_memorization',
            surahNumber: 2,
            surahName: 'البقرة',
            ayahStart: 1,
            ayahEnd: 25,
            ayahCount: 25,
            durationMinutes: 30,
            quality: 'excellent',
            notes: 'حفظ الحزب الأول من سورة البقرة بإتقان مع التجويد.'
          },
          {
            id: 'qs-seed-2',
            date: todayStr,
            type: 'revision',
            surahNumber: 67,
            surahName: 'الملك',
            ayahStart: 1,
            ayahEnd: 15,
            ayahCount: 15,
            durationMinutes: 15,
            quality: 'very_good',
            notes: 'تثبيت ومراجعة النصف الأول من سورة الملك.'
          }
        ],
        revisionSchedule: {
          dailyWirdJuz: 1,
          revisionCycleDays: 7,
          currentReviewSurahs: [1, 2, 67, 112, 113, 114],
          targetDailyAyahs: 10,
          weeklyTargetRevisionMinutes: 120
        },
        totalAyahsMemorized: distinctAyahs,
        totalSurahsCompleted: completedSurahs,
        totalMemorizationMinutes: 180,
        totalRevisionMinutes: 120,
        dailyTargetAyahs: 10,
        activeSurahNumber: 2
      };
    }

    const newHabit: Habit = {
      id: 'h-' + crypto.randomUUID().slice(0, 8),
      name: habitDraft.name || 'New Habit',
      anchor: habitDraft.anchor || 'After [trigger] -> I will execute',
      location: habitDraft.location || '',
      timeOfDay: habitDraft.timeOfDay || 'morning',
      frequency: habitDraft.frequency || 'daily',
      category: habitDraft.category || 'productivity',
      targetPerDay: habitDraft.targetPerDay || 1,
      unit: habitDraft.unit || 'time',
      currentStreak: 0,
      longestStreak: 0,
      freezesRemaining: 2,
      freezesUsedDates: [],
      completedDates: [],
      stackParentHabitId: habitDraft.stackParentHabitId,
      linkedGoalId: habitDraft.linkedGoalId,
      specializedType,
      readingData,
      workoutData,
      drawingData,
      quranData,
      createdAt: new Date().toISOString()
    };

    const updated = [...get().habits, newHabit];
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    if (newHabit.linkedGoalId) {
      const updatedGoals = get().goals.map((g) => {
        if (g.id === newHabit.linkedGoalId) {
          const currentIds = g.linkedHabitIds || [];
          if (!currentIds.includes(newHabit.id)) {
            return { ...g, linkedHabitIds: [...currentIds, newHabit.id], updatedAt: new Date().toISOString() };
          }
        }
        return g;
      });
      NuqtaStorageEngine.saveGoals(updatedGoals);
      set({ goals: updatedGoals });
    }

    get().addXP(20);
  },

  updateHabit: (id, updates) => {
    const prevHabit = get().habits.find((h) => h.id === id);
    const updated = get().habits.map((h) => (h.id === id ? { ...h, ...updates } : h));
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    // Sync goal relations if linkedGoalId changed
    if (updates.linkedGoalId !== undefined && prevHabit && prevHabit.linkedGoalId !== updates.linkedGoalId) {
      const oldGoalId = prevHabit.linkedGoalId;
      const newGoalId = updates.linkedGoalId;
      const updatedGoals = get().goals.map((g) => {
        if (oldGoalId && g.id === oldGoalId) {
          return {
            ...g,
            linkedHabitIds: (g.linkedHabitIds || []).filter((hid) => hid !== id),
            updatedAt: new Date().toISOString()
          };
        }
        if (newGoalId && g.id === newGoalId) {
          const currentIds = g.linkedHabitIds || [];
          if (!currentIds.includes(id)) {
            return {
              ...g,
              linkedHabitIds: [...currentIds, id],
              updatedAt: new Date().toISOString()
            };
          }
        }
        return g;
      });
      NuqtaStorageEngine.saveGoals(updatedGoals);
      set({ goals: updatedGoals });
    }
  },

  deleteHabit: (id) => {
    const updated = get().habits.filter((h) => h.id !== id);
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    const updatedGoals = get().goals.map((g) => ({
      ...g,
      linkedHabitIds: (g.linkedHabitIds || []).filter((hid) => hid !== id)
    }));
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });
  },

  // Dedicated Reading App Actions
  logReadingSession: (habitId, sessionDraft) => {
    const todayStr = localDateKey();
    const targetHabit = get().habits.find((h) => h.id === habitId);
    const newSession = {
      id: 'rs-' + crypto.randomUUID().slice(0, 8),
      date: todayStr,
      linkedGoalId: sessionDraft.linkedGoalId || targetHabit?.linkedGoalId,
      ...sessionDraft
    };

    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const reading = h.readingData || {
        books: [],
        sessions: [],
        annualTargetBooks: 20,
        totalPagesRead: 0,
        totalReadingMinutes: 0
      };

      // update current page of active book
      const updatedBooks = reading.books.map((b) => {
        if (b.id === sessionDraft.bookId) {
          const newCurrentPage = Math.min(b.totalPages, b.currentPage + sessionDraft.pagesRead);
          const isDone = newCurrentPage >= b.totalPages;
          return {
            ...b,
            currentPage: newCurrentPage,
            status: isDone ? ('completed' as const) : b.status,
            completedDate: isDone ? todayStr : b.completedDate
          };
        }
        return b;
      });

      const updatedReading = {
        ...reading,
        books: updatedBooks,
        sessions: [newSession, ...reading.sessions],
        totalPagesRead: reading.totalPagesRead + sessionDraft.pagesRead,
        totalReadingMinutes: reading.totalReadingMinutes + sessionDraft.durationMinutes
      };

      // Mark habit as completed today if not already
      const completedDates = h.completedDates.includes(todayStr)
        ? h.completedDates
        : [...h.completedDates, todayStr];
      const currentStreak = h.completedDates.includes(todayStr) ? h.currentStreak : h.currentStreak + 1;
      const longestStreak = Math.max(h.longestStreak, currentStreak);

      return {
        ...h,
        readingData: updatedReading,
        completedDates,
        currentStreak,
        longestStreak
      };
    });

    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().addXP(sessionDraft.pagesRead * 2 + 10);
    try {
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
    } catch {}
  },

  addOrUpdateBook: (habitId, book) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const reading = h.readingData || {
        books: [],
        sessions: [],
        annualTargetBooks: 20,
        totalPagesRead: 0,
        totalReadingMinutes: 0
      };
      const bookToSave = {
        ...book,
        linkedGoalId: book.linkedGoalId || h.linkedGoalId
      };
      const existingIdx = reading.books.findIndex((b) => b.id === book.id);
      const updatedBooks = existingIdx >= 0
        ? reading.books.map((b) => (b.id === book.id ? bookToSave : b))
        : [...reading.books, bookToSave];

      return {
        ...h,
        readingData: {
          ...reading,
          books: updatedBooks,
          activeBookId: reading.activeBookId || book.id
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  deleteBook: (habitId, bookId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      const remainingBooks = h.readingData.books.filter((b) => b.id !== bookId);
      const newActiveId = h.readingData.activeBookId === bookId
        ? remainingBooks[0]?.id
        : h.readingData.activeBookId;
      return {
        ...h,
        readingData: {
          ...h.readingData,
          books: remainingBooks,
          activeBookId: newActiveId
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  setActiveBook: (habitId, bookId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      return {
        ...h,
        readingData: {
          ...h.readingData,
          activeBookId: bookId
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  addBookQuote: (habitId, quoteDraft) => {
    const todayStr = localDateKey();
    const newQuote: import('../types').BookQuote = {
      id: 'q-' + crypto.randomUUID().slice(0, 8),
      date: todayStr,
      ...quoteDraft
    };
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      return {
        ...h,
        readingData: {
          ...h.readingData,
          quotes: [newQuote, ...(h.readingData.quotes || [])]
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().addXP(15);
  },

  deleteBookQuote: (habitId, quoteId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      return {
        ...h,
        readingData: {
          ...h.readingData,
          quotes: (h.readingData.quotes || []).filter((q) => q.id !== quoteId)
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  updateReadingTargets: (habitId, targets) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      return {
        ...h,
        readingData: {
          ...h.readingData,
          ...targets
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  // Dedicated Workout App Actions
  logWorkoutSession: (habitId, sessionDraft) => {
    const todayStr = localDateKey();
    const targetHabit = get().habits.find((h) => h.id === habitId);
    const sessionReps = sessionDraft.exercises.reduce(
      (acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + (s.completed ? s.reps : 0), 0),
      0
    );

    const newSession = {
      ...sessionDraft,
      id: 'ws-' + crypto.randomUUID().slice(0, 8),
      date: todayStr,
      totalReps: sessionDraft.totalReps || sessionReps,
      linkedGoalId: sessionDraft.linkedGoalId || targetHabit?.linkedGoalId
    };

    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const workout = h.workoutData || {
        sessions: [],
        weeklyTargetSessions: 4,
        totalVolumeKg: 0,
        totalMinutes: 0,
        totalWorkouts: 0,
        favoriteRoutine: 'Home Calisthenics'
      };

      const updatedWorkout = {
        ...workout,
        sessions: [newSession, ...workout.sessions],
        totalVolumeKg: workout.totalVolumeKg + sessionDraft.volumeKg,
        totalReps: (workout.totalReps || 0) + (sessionDraft.totalReps || sessionReps),
        totalMinutes: workout.totalMinutes + sessionDraft.durationMinutes,
        totalWorkouts: workout.totalWorkouts + 1,
        favoriteRoutine: sessionDraft.title || workout.favoriteRoutine
      };

      // Mark habit as completed today
      const completedDates = h.completedDates.includes(todayStr)
        ? h.completedDates
        : [...h.completedDates, todayStr];
      const currentStreak = h.completedDates.includes(todayStr) ? h.currentStreak : h.currentStreak + 1;
      const longestStreak = Math.max(h.longestStreak, currentStreak);

      return {
        ...h,
        workoutData: updatedWorkout,
        completedDates,
        currentStreak,
        longestStreak
      };
    });

    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    // Sync to Today Health
    get().updateTodayHealth({
      workoutLogged: true,
      workoutType: sessionDraft.title,
      workoutMinutes: sessionDraft.durationMinutes
    });

    get().addXP(40);
    try {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.65 }, colors: ['#10b981', '#34d399', '#6ee7b7'] });
    } catch {}
  },

  addOrUpdateWorkoutRoutine: (habitId, routine) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const workout = h.workoutData || {
        sessions: [],
        weeklyTargetSessions: 4,
        totalVolumeKg: 0,
        totalMinutes: 0,
        totalWorkouts: 0,
        favoriteRoutine: 'Home Calisthenics'
      };
      const existingRoutines = workout.customRoutines || [];
      const idx = existingRoutines.findIndex((r) => r.id === routine.id);
      const updatedRoutines = idx >= 0
        ? existingRoutines.map((r) => (r.id === routine.id ? routine : r))
        : [...existingRoutines, routine];

      return {
        ...h,
        workoutData: {
          ...workout,
          customRoutines: updatedRoutines
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  deleteWorkoutRoutine: (habitId, routineId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      return {
        ...h,
        workoutData: {
          ...h.workoutData,
          customRoutines: (h.workoutData.customRoutines || []).filter((r) => r.id !== routineId)
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  updateFitnessTargets: (habitId, targets) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      return {
        ...h,
        workoutData: {
          ...h.workoutData,
          ...targets
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  // Dedicated Drawing / Art Studio Actions
  logDrawingSession: (habitId, pieceDraft) => {
    const todayStr = localDateKey();
    const targetHabit = get().habits.find((h) => h.id === habitId);
    const newPiece = {
      id: 'art-' + crypto.randomUUID().slice(0, 8),
      completedDate: todayStr,
      linkedGoalId: pieceDraft.linkedGoalId || targetHabit?.linkedGoalId,
      ...pieceDraft
    };

    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const drawing = h.drawingData || {
        pieces: [],
        totalDrawingMinutes: 0,
        totalSketches: 0,
        favoriteMedium: pieceDraft.medium || 'sketch'
      };

      // If tied to a project, update project statistics
      let updatedProjects = drawing.projects;
      if (pieceDraft.projectId && updatedProjects) {
        updatedProjects = updatedProjects.map((proj) => {
          if (proj.id === pieceDraft.projectId) {
            const isCompleted = pieceDraft.stage === 'completed';
            return {
              ...proj,
              stage: pieceDraft.stage || proj.stage,
              completedDate: isCompleted ? todayStr : proj.completedDate,
              totalMinutesSpent: proj.totalMinutesSpent + pieceDraft.durationMinutes,
              sessionsCount: proj.sessionsCount + 1
            };
          }
          return proj;
        });
      }

      const updatedDrawing = {
        ...drawing,
        projects: updatedProjects,
        pieces: [newPiece, ...drawing.pieces],
        totalDrawingMinutes: drawing.totalDrawingMinutes + pieceDraft.durationMinutes,
        totalSketches: drawing.totalSketches + 1,
        favoriteMedium: pieceDraft.medium || drawing.favoriteMedium
      };

      const completedDates = h.completedDates.includes(todayStr)
        ? h.completedDates
        : [...h.completedDates, todayStr];
      const currentStreak = h.completedDates.includes(todayStr) ? h.currentStreak : h.currentStreak + 1;
      const longestStreak = Math.max(h.longestStreak, currentStreak);

      return {
        ...h,
        drawingData: updatedDrawing,
        completedDates,
        currentStreak,
        longestStreak
      };
    });

    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().addXP(35);
    try {
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.65 }, colors: ['#a855f7', '#ec4899', '#3b82f6'] });
    } catch {}
  },

  deleteArtworkPiece: (habitId, pieceId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.drawingData) return h;
      const remaining = h.drawingData.pieces.filter((p) => p.id !== pieceId);
      return {
        ...h,
        drawingData: {
          ...h.drawingData,
          pieces: remaining,
          totalSketches: remaining.length
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  addOrUpdateArtProject: (habitId, project) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const drawing = h.drawingData || {
        pieces: [],
        totalDrawingMinutes: 0,
        totalSketches: 0,
        favoriteMedium: 'sketch'
      };
      const existingProjects = drawing.projects || [];
      const projectToSave = {
        ...project,
        linkedGoalId: project.linkedGoalId || h.linkedGoalId
      };
      const idx = existingProjects.findIndex((p) => p.id === project.id);
      const updatedProjects = idx >= 0
        ? existingProjects.map((p) => (p.id === project.id ? projectToSave : p))
        : [...existingProjects, projectToSave];

      return {
        ...h,
        drawingData: {
          ...drawing,
          projects: updatedProjects
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  deleteArtProject: (habitId, projectId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.drawingData) return h;
      return {
        ...h,
        drawingData: {
          ...h.drawingData,
          projects: (h.drawingData.projects || []).filter((p) => p.id !== projectId)
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  updateDrawingTargets: (habitId, targets) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.drawingData) return h;
      return {
        ...h,
        drawingData: {
          ...h.drawingData,
          ...targets
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  // Dedicated Quran App Actions
  logQuranSession: (habitId, sessionDraft) => {
    const todayStr = localDateKey();
    const targetHabit = get().habits.find((h) => h.id === habitId);
    const newSession: import('../types').QuranSessionLog = {
      id: 'qs-' + crypto.randomUUID().slice(0, 8),
      date: todayStr,
      linkedGoalId: sessionDraft.linkedGoalId || targetHabit?.linkedGoalId,
      ...sessionDraft
    };

    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const quran = h.quranData || {
        surahs: generateInitialQuranSurahs(),
        sessions: [],
        revisionSchedule: {
          dailyWirdJuz: 1,
          revisionCycleDays: 7,
          currentReviewSurahs: [1, 114],
          targetDailyAyahs: 10,
          weeklyTargetRevisionMinutes: 120
        },
        totalAyahsMemorized: 0,
        totalSurahsCompleted: 0,
        totalMemorizationMinutes: 0,
        totalRevisionMinutes: 0,
        dailyTargetAyahs: 10,
        activeSurahNumber: sessionDraft.surahNumber
      };

      const surahMeta = getSurahMeta(sessionDraft.surahNumber);

      // Update Surahs array
      const existingSurahIdx = quran.surahs.findIndex((s) => s.surahNumber === sessionDraft.surahNumber);
      let updatedSurahs = [...quran.surahs];

      if (existingSurahIdx >= 0) {
        const curr = quran.surahs[existingSurahIdx];
        if (sessionDraft.type === 'new_memorization') {
          const mergedRanges = mergeAyahRanges(curr.memorizedAyahsRanges || [], {
            start: sessionDraft.ayahStart,
            end: sessionDraft.ayahEnd
          });
          const distinctCount = calculateDistinctAyahs(mergedRanges);
          const isDone = distinctCount >= surahMeta.totalAyahs;

          updatedSurahs[existingSurahIdx] = {
            ...curr,
            memorizedAyahsRanges: mergedRanges,
            memorizedAyahsCount: distinctCount,
            status: isDone ? 'completed' : 'in_progress',
            lastReviewedDate: todayStr,
            masteryRating: sessionDraft.quality === 'excellent' ? 5 : sessionDraft.quality === 'very_good' ? 4 : 3,
            notes: sessionDraft.notes || curr.notes
          };
        } else {
          // revision or recitation test
          updatedSurahs[existingSurahIdx] = {
            ...curr,
            lastReviewedDate: todayStr,
            masteryRating: sessionDraft.quality === 'excellent' ? 5 : sessionDraft.quality === 'very_good' ? 4 : sessionDraft.quality === 'good' ? 3 : 2,
            status: sessionDraft.quality === 'needs_reinforcement' && curr.status !== 'completed' ? 'needs_revision' : curr.status
          };
        }
      }

      // Recompute totals strictly without duplicate counting
      const totalAyahs = updatedSurahs.reduce((sum, s) => sum + (s.memorizedAyahsCount || 0), 0);
      const completedSurahs = updatedSurahs.filter((s) => s.status === 'completed').length;
      const memMins = quran.totalMemorizationMinutes + (sessionDraft.type === 'new_memorization' ? sessionDraft.durationMinutes : 0);
      const revMins = quran.totalRevisionMinutes + (sessionDraft.type !== 'new_memorization' ? sessionDraft.durationMinutes : 0);

      const updatedQuran: import('../types').QuranHabitData = {
        ...quran,
        surahs: updatedSurahs,
        sessions: [newSession, ...quran.sessions],
        totalAyahsMemorized: totalAyahs,
        totalSurahsCompleted: completedSurahs,
        totalMemorizationMinutes: memMins,
        totalRevisionMinutes: revMins,
        activeSurahNumber: sessionDraft.surahNumber
      };

      // Mark habit completed today
      const alreadyDone = h.completedDates.includes(todayStr);
      const completedDates = alreadyDone ? h.completedDates : [...h.completedDates, todayStr];
      const currentStreak = alreadyDone ? h.currentStreak : h.currentStreak + 1;
      const longestStreak = Math.max(h.longestStreak, currentStreak);

      return {
        ...h,
        quranData: updatedQuran,
        completedDates,
        currentStreak,
        longestStreak
      };
    });

    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().addXP(40);
    try {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.65 }, colors: ['#10b981', '#f59e0b', '#3b82f6'] });
    } catch {}
  },

  updateSurahStatus: (habitId, surahNumber, status, masteryRating) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.quranData) return h;
      const surahs = h.quranData.surahs.map((s) => {
        if (s.surahNumber !== surahNumber) return s;
        return {
          ...s,
          status,
          masteryRating: masteryRating || s.masteryRating,
          lastReviewedDate: localDateKey()
        };
      });
      const completedSurahs = surahs.filter((s) => s.status === 'completed').length;
      return {
        ...h,
        quranData: {
          ...h.quranData,
          surahs,
          totalSurahsCompleted: completedSurahs
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  updateQuranRevisionSchedule: (habitId, schedule) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.quranData) return h;
      return {
        ...h,
        quranData: {
          ...h.quranData,
          revisionSchedule: {
            ...h.quranData.revisionSchedule,
            ...schedule
          }
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  deleteQuranSession: (habitId, sessionId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.quranData) return h;
      return {
        ...h,
        quranData: {
          ...h.quranData,
          sessions: h.quranData.sessions.filter((s) => s.id !== sessionId)
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  // GOAL ACTIONS
  createGoal: (goalDraft) => {
    const todayStr = localDateKey();
    const newGoal: Goal = {
      id: 'g-' + crypto.randomUUID().slice(0, 8),
      title: goalDraft.title || 'Mastery Objective',
      description: goalDraft.description || '',
      category: goalDraft.category || 'career',
      priority: goalDraft.priority || 'medium',
      timeframe: goalDraft.timeframe || 'quarterly',
      startDate: goalDraft.startDate || todayStr,
      deadline: goalDraft.deadline,
      color: goalDraft.color || '#f59e0b',
      status: goalDraft.status || 'active',
      keyResults: goalDraft.keyResults || [
        { id: 'kr-' + crypto.randomUUID().slice(0, 6), title: 'Core milestone metric', targetValue: 100, currentValue: 0, unit: '%', dataSource: 'manual' }
      ],
      milestones: goalDraft.milestones || [],
      linkedTaskIds: goalDraft.linkedTaskIds || [],
      linkedHabitIds: goalDraft.linkedHabitIds || [],
      linkedBookIds: goalDraft.linkedBookIds || [],
      linkedArtProjectIds: goalDraft.linkedArtProjectIds || [],
      visionNotes: goalDraft.visionNotes || '',
      visionImages: goalDraft.visionImages || [],
      createdAt: new Date().toISOString()
    };

    const updated = [...get().goals, newGoal];
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().addXP(40);
  },

  updateGoal: (id, updates) => {
    const updated = get().goals.map((g) =>
      g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
    );
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
  },

  updateKeyResult: (goalId, krId, val) => {
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      const keyResults = g.keyResults.map((kr) =>
        kr.id === krId ? { ...kr, currentValue: val } : kr
      );
      return { ...g, keyResults, updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().addXP(10);
  },

  addKeyResult: (goalId, kr) => {
    const newKr: KeyResult = {
      id: 'kr-' + crypto.randomUUID().slice(0, 6),
      ...kr
    };
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      return { ...g, keyResults: [...g.keyResults, newKr], updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().addXP(15);
  },

  deleteKeyResult: (goalId, krId) => {
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      return { ...g, keyResults: g.keyResults.filter((k) => k.id !== krId), updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
  },

  addGoalMilestone: (goalId, milestone) => {
    const newMilestone: GoalMilestone = {
      id: 'ms-' + crypto.randomUUID().slice(0, 6),
      ...milestone
    };
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      return { ...g, milestones: [...(g.milestones || []), newMilestone], updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().addXP(15);
  },

  toggleGoalMilestone: (goalId, milestoneId) => {
    const todayStr = localDateKey();
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      const milestones = (g.milestones || []).map((ms) => {
        if (ms.id !== milestoneId) return ms;
        const isNowDone = !ms.isCompleted;
        return {
          ...ms,
          isCompleted: isNowDone,
          completedDate: isNowDone ? todayStr : undefined
        };
      });
      return { ...g, milestones, updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().addXP(25);
    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}
  },

  deleteGoalMilestone: (goalId, milestoneId) => {
    const updated = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      return { ...g, milestones: (g.milestones || []).filter((ms) => ms.id !== milestoneId), updatedAt: new Date().toISOString() };
    });
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
  },

  linkActivityToGoal: (goalId, type, activityId) => {
    // Product rule: a task or habit belongs to at most ONE goal. Linking it to a new goal
    // removes it from every other goal's list so it is never counted twice.
    const updatedGoals = get().goals.map((g) => {
      if (g.id !== goalId) {
        if (type === 'task' && (g.linkedTaskIds || []).includes(activityId)) {
          return { ...g, linkedTaskIds: (g.linkedTaskIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
        }
        if (type === 'habit' && (g.linkedHabitIds || []).includes(activityId)) {
          return { ...g, linkedHabitIds: (g.linkedHabitIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
        }
        return g;
      }
      if (type === 'task') {
        const existing = new Set(g.linkedTaskIds || []);
        existing.add(activityId);
        return { ...g, linkedTaskIds: Array.from(existing), updatedAt: new Date().toISOString() };
      }
      if (type === 'habit') {
        const existing = new Set(g.linkedHabitIds || []);
        existing.add(activityId);
        return { ...g, linkedHabitIds: Array.from(existing), updatedAt: new Date().toISOString() };
      }
      if (type === 'book') {
        const existing = new Set(g.linkedBookIds || []);
        existing.add(activityId);
        return { ...g, linkedBookIds: Array.from(existing), updatedAt: new Date().toISOString() };
      }
      if (type === 'artProject') {
        const existing = new Set(g.linkedArtProjectIds || []);
        existing.add(activityId);
        return { ...g, linkedArtProjectIds: Array.from(existing), updatedAt: new Date().toISOString() };
      }
      return g;
    });
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });

    // Link task or habit back if applicable
    if (type === 'task') {
      const updatedTasks = get().tasks.map((t) => (t.id === activityId ? { ...t, linkedGoalId: goalId } : t));
      NuqtaStorageEngine.saveTasks(updatedTasks);
      set({ tasks: updatedTasks });
    }
    if (type === 'habit') {
      const updatedHabits = get().habits.map((h) => (h.id === activityId ? { ...h, linkedGoalId: goalId } : h));
      NuqtaStorageEngine.saveHabits(updatedHabits);
      set({ habits: updatedHabits });
    }
  },

  unlinkActivityFromGoal: (goalId, type, activityId) => {
    const updatedGoals = get().goals.map((g) => {
      if (g.id !== goalId) return g;
      if (type === 'task') {
        return { ...g, linkedTaskIds: (g.linkedTaskIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
      }
      if (type === 'habit') {
        return { ...g, linkedHabitIds: (g.linkedHabitIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
      }
      if (type === 'book') {
        return { ...g, linkedBookIds: (g.linkedBookIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
      }
      if (type === 'artProject') {
        return { ...g, linkedArtProjectIds: (g.linkedArtProjectIds || []).filter((id) => id !== activityId), updatedAt: new Date().toISOString() };
      }
      return g;
    });
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });

    // CRITICAL: Unlinking ONLY clears the relation link. NEVER deletes the task, habit, book, or project!
    if (type === 'task') {
      const updatedTasks = get().tasks.map((t) => (t.id === activityId && t.linkedGoalId === goalId ? { ...t, linkedGoalId: undefined } : t));
      NuqtaStorageEngine.saveTasks(updatedTasks);
      set({ tasks: updatedTasks });
    }
    if (type === 'habit') {
      const updatedHabits = get().habits.map((h) => (h.id === activityId && h.linkedGoalId === goalId ? { ...h, linkedGoalId: undefined } : h));
      NuqtaStorageEngine.saveHabits(updatedHabits);
      set({ habits: updatedHabits });
    }
  },

  deleteGoal: (id) => {
    const updated = get().goals.filter((g) => g.id !== id);
    NuqtaStorageEngine.saveGoals(updated);

    // Do not leave dangling references to a goal that no longer exists.
    const clear = <T extends { linkedGoalId?: string }>(items: T[]): T[] =>
      items.map((it) => (it.linkedGoalId === id ? { ...it, linkedGoalId: undefined } : it));
    const tasks = clear(get().tasks);
    const habits = clear(get().habits);
    NuqtaStorageEngine.saveTasks(tasks);
    NuqtaStorageEngine.saveHabits(habits);
    set({ goals: updated, tasks, habits });
  },

  // FOCUS ACTIONS
  logFocusSession: (sessionDraft) => {
    const newSession: FocusSession = {
      id: 'fs-' + crypto.randomUUID().slice(0, 8),
      ...sessionDraft,
      completedAt: new Date().toISOString()
    };

    const updated = [newSession, ...get().focusSessions];
    NuqtaStorageEngine.saveFocusSessions(updated);
    set({ focusSessions: updated });
    get().addXP(sessionDraft.durationMinutes * 2);
  },

  // HEALTH ACTIONS
  updateTodayHealth: (updates) => {
    const todayStr = localDateKey();
    const current = get().healthMetrics[todayStr] ?? emptyHealthRecord(todayStr);

    const updatedRecord = { ...current, ...updates };
    const allMetrics = { ...get().healthMetrics, [todayStr]: updatedRecord };
    NuqtaStorageEngine.saveHealthMetrics(allMetrics);

    const energy = computeDailyEnergyScore(updatedRecord, get().tasks);
    set({ healthMetrics: allMetrics, energyScore: energy });
  },

  addHydration: (amountMl) => {
    const todayStr = localDateKey();
    const current = get().healthMetrics[todayStr] ?? emptyHealthRecord(todayStr);

    const nextHydration = (current.hydrationMl || 0) + amountMl;
    get().updateTodayHealth({ hydrationMl: nextHydration });
  },

  // FINANCE ACTIONS
  addExpense: (expenseDraft) => {
    const newExpense: ExpenseRecord = {
      id: 'exp-' + crypto.randomUUID().slice(0, 8),
      ...expenseDraft
    };
    const updated = [newExpense, ...get().expenses];
    NuqtaStorageEngine.saveExpenses(updated);
    set({ expenses: updated });
    get().addXP(10);
  },

  deleteExpense: (id) => {
    const updated = get().expenses.filter((e) => e.id !== id);
    NuqtaStorageEngine.saveExpenses(updated);
    set({ expenses: updated });
  },

  updateSavingsGoal: (id, amountToAdd) => {
    const updated = get().savingsGoals.map((sg) =>
      sg.id === id ? { ...sg, currentAmount: sg.currentAmount + amountToAdd } : sg
    );
    NuqtaStorageEngine.saveSavingsGoals(updated);
    set({ savingsGoals: updated });
    get().addXP(20);
  },

  addSavingsGoal: (goalDraft) => {
    const newGoal: SavingsGoal = {
      id: 'sg-' + crypto.randomUUID().slice(0, 8),
      ...goalDraft
    };
    const updated = [...get().savingsGoals, newGoal];
    NuqtaStorageEngine.saveSavingsGoals(updated);
    set({ savingsGoals: updated });
  },

  // JOURNAL ACTIONS
  saveJournalEntry: (entryDraft) => {
    const newEntry: JournalEntry = {
      id: 'j-' + crypto.randomUUID().slice(0, 8),
      ...entryDraft,
      createdAt: new Date().toISOString()
    };
    const updated = [newEntry, ...get().journalEntries];
    NuqtaStorageEngine.saveJournalEntries(updated);
    set({ journalEntries: updated });
    get().addXP(35);
  },

  // RESCUE MODE & RITUALS
  setRescueModeOpen: (open) => set({ isRescueModeOpen: open }),
  setQuickCaptureOpen: (open) => set({ isQuickCaptureOpen: open }),
  setSundayRitualOpen: (open) => set({ isSundayRitualOpen: open }),

  executeRescueMode: (chosenAnchorTaskId, deferOthersToTomorrow) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localDateKey(tomorrow);

    const updated = get().tasks.map((task) => {
      if (task.id === chosenAnchorTaskId) {
        return { ...task, isTopThree: true, status: 'todo' as const, updatedAt: new Date().toISOString() };
      }
      if (deferOthersToTomorrow && task.status === 'todo') {
        return {
          ...task,
          isTopThree: false,
          scheduledDate: tomorrowStr,
          status: 'deferred' as const,
          updatedAt: new Date().toISOString()
        };
      }
      return task;
    });

    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated, isRescueModeOpen: false });
  },

  completeSundayRitual: (reviewDraft) => {
    const newReview: SundayRitualReview = {
      id: 'sr-' + crypto.randomUUID().slice(0, 8),
      ...reviewDraft,
      completedAt: new Date().toISOString()
    };
    const updated = [newReview, ...get().sundayReviews];
    NuqtaStorageEngine.saveSundayReviews(updated);

    const updatedProfile: UserProfile = {
      ...get().profile,
      weeklySundayReviewDue: false,
      lastSundayReviewDate: reviewDraft.date
    };
    NuqtaStorageEngine.saveProfile(updatedProfile);

    set({ sundayReviews: updated, profile: updatedProfile, isSundayRitualOpen: false });
    get().addXP(100);
    try {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch {}
  },

  // GAMIFICATION & PROFILE
  addXP: (amount) => {
    const curXP = get().profile.experiencePoints + amount;
    // Level formula: Level = floor(sqrt(XP / 100)) + 1
    const newLevel = Math.max(1, Math.floor(Math.sqrt(curXP / 100)) + 1);
    const updatedProfile = { ...get().profile, experiencePoints: curXP, level: newLevel };
    NuqtaStorageEngine.saveProfile(updatedProfile);
    set({ profile: updatedProfile });
  },

  setLanguage: (lang) => {
    const updated = { ...get().profile, language: lang };
    NuqtaStorageEngine.saveProfile(updated);
    set({ profile: updated });
  },

  setTheme: (theme) => {
    const updated = { ...get().profile, theme };
    NuqtaStorageEngine.saveProfile(updated);
    set({ profile: updated });
  },

  updateProfileName: (name) => {
    const updated = { ...get().profile, name };
    NuqtaStorageEngine.saveProfile(updated);
    set({ profile: updated });
  },

  // UNIVERSAL ARCHIVE & HISTORY ACTIONS
  archiveTask: (id) => {
    const target = get().tasks.find((t) => t.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const updated = get().tasks.map((t) =>
      t.id === id ? { ...t, isArchived: true, archivedAt: now, status: 'archived' as const } : t
    );
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
    get().logHistoryAudit({
      domain: 'tasks',
      action: 'archived',
      title: `أرشفة مهمة: ${target.title}`,
      entityId: id,
      entityType: 'task'
    });
  },

  restoreTask: (id) => {
    const target = get().tasks.find((t) => t.id === id);
    if (!target) return;
    const updated = get().tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            isArchived: false,
            archivedAt: undefined,
            status: t.completedAt ? ('completed' as const) : ('todo' as const)
          }
        : t
    );
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
    get().logHistoryAudit({
      domain: 'tasks',
      action: 'restored',
      title: `استعادة مهمة: ${target.title}`,
      entityId: id,
      entityType: 'task'
    });
  },

  archiveHabit: (id) => {
    const target = get().habits.find((h) => h.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const updated = get().habits.map((h) =>
      h.id === id ? { ...h, isArchived: true, archivedAt: now, status: 'archived' as const } : h
    );
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().logHistoryAudit({
      domain: 'habits',
      action: 'archived',
      title: `أرشفة عادة: ${target.name}`,
      entityId: id,
      entityType: 'habit'
    });
  },

  restoreHabit: (id) => {
    const target = get().habits.find((h) => h.id === id);
    if (!target) return;
    const updated = get().habits.map((h) =>
      h.id === id ? { ...h, isArchived: false, archivedAt: undefined, status: 'active' as const } : h
    );
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().logHistoryAudit({
      domain: 'habits',
      action: 'restored',
      title: `استعادة عادة: ${target.name}`,
      entityId: id,
      entityType: 'habit'
    });
  },

  archiveBook: (habitId, bookId) => {
    const now = new Date().toISOString();
    let bookTitle = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      const books = h.readingData.books.map((b) => {
        if (b.id !== bookId) return b;
        bookTitle = b.title;
        return { ...b, status: 'archived' as const, archivedAt: now };
      });
      return { ...h, readingData: { ...h.readingData, books } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (bookTitle) {
      get().logHistoryAudit({
        domain: 'reading',
        action: 'archived',
        title: `أرشفة كتاب: ${bookTitle}`,
        entityId: bookId,
        entityType: 'book'
      });
    }
  },

  restoreBook: (habitId, bookId) => {
    let bookTitle = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.readingData) return h;
      const books = h.readingData.books.map((b) => {
        if (b.id !== bookId) return b;
        bookTitle = b.title;
        const restoredStatus = b.currentPage >= b.totalPages ? ('completed' as const) : ('reading' as const);
        return { ...b, status: restoredStatus, archivedAt: undefined };
      });
      return { ...h, readingData: { ...h.readingData, books } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (bookTitle) {
      get().logHistoryAudit({
        domain: 'reading',
        action: 'restored',
        title: `استعادة كتاب: ${bookTitle}`,
        entityId: bookId,
        entityType: 'book'
      });
    }
  },

  archiveWorkoutRoutine: (habitId, routineId) => {
    const now = new Date().toISOString();
    let routineName = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      const customRoutines = (h.workoutData.customRoutines || []).map((r) => {
        if (r.id !== routineId) return r;
        routineName = r.nameAr || r.name;
        return { ...r, isArchived: true, archivedAt: now };
      });
      return { ...h, workoutData: { ...h.workoutData, customRoutines } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (routineName) {
      get().logHistoryAudit({
        domain: 'workout',
        action: 'archived',
        title: `أرشفة روتين: ${routineName}`,
        entityId: routineId,
        entityType: 'workout_routine'
      });
    }
  },

  restoreWorkoutRoutine: (habitId, routineId) => {
    let routineName = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      const customRoutines = (h.workoutData.customRoutines || []).map((r) => {
        if (r.id !== routineId) return r;
        routineName = r.nameAr || r.name;
        return { ...r, isArchived: false, archivedAt: undefined };
      });
      return { ...h, workoutData: { ...h.workoutData, customRoutines } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (routineName) {
      get().logHistoryAudit({
        domain: 'workout',
        action: 'restored',
        title: `استعادة روتين: ${routineName}`,
        entityId: routineId,
        entityType: 'workout_routine'
      });
    }
  },

  archiveArtProject: (habitId, projectId) => {
    const now = new Date().toISOString();
    let projectTitle = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.drawingData) return h;
      const projects = (h.drawingData.projects || []).map((p) => {
        if (p.id !== projectId) return p;
        projectTitle = p.title;
        return { ...p, stage: 'archived' as const, isArchived: true, archivedAt: now };
      });
      return { ...h, drawingData: { ...h.drawingData, projects } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (projectTitle) {
      get().logHistoryAudit({
        domain: 'drawing',
        action: 'archived',
        title: `أرشفة مشروع فني: ${projectTitle}`,
        entityId: projectId,
        entityType: 'art_project'
      });
    }
  },

  restoreArtProject: (habitId, projectId) => {
    let projectTitle = '';
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.drawingData) return h;
      const projects = (h.drawingData.projects || []).map((p) => {
        if (p.id !== projectId) return p;
        projectTitle = p.title;
        const restoredStage = p.completedDate ? ('completed' as const) : ('sketching' as const);
        return { ...p, stage: restoredStage, isArchived: false, archivedAt: undefined };
      });
      return { ...h, drawingData: { ...h.drawingData, projects } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    if (projectTitle) {
      get().logHistoryAudit({
        domain: 'drawing',
        action: 'restored',
        title: `استعادة مشروع فني: ${projectTitle}`,
        entityId: projectId,
        entityType: 'art_project'
      });
    }
  },

  archiveGoal: (id) => {
    const target = get().goals.find((g) => g.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const updated = get().goals.map((g) =>
      g.id === id ? { ...g, status: 'archived' as const, archivedAt: now } : g
    );
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().logHistoryAudit({
      domain: 'goals',
      action: 'archived',
      title: `أرشفة هدف: ${target.title}`,
      entityId: id,
      entityType: 'goal'
    });
  },

  restoreGoal: (id) => {
    const target = get().goals.find((g) => g.id === id);
    if (!target) return;
    const updated = get().goals.map((g) =>
      g.id === id ? { ...g, status: 'active' as const, archivedAt: undefined } : g
    );
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });
    get().logHistoryAudit({
      domain: 'goals',
      action: 'restored',
      title: `استعادة هدف: ${target.title}`,
      entityId: id,
      entityType: 'goal'
    });
  },

  logHistoryAudit: (entryDraft) => {
    const newLog: HistoryAuditLogEntry = {
      id: 'audit-' + crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      ...entryDraft
    };
    const updated = [newLog, ...get().historyAuditLogs];
    NuqtaStorageEngine.saveHistoryAuditLogs(updated);
    set({ historyAuditLogs: updated });
  }
}));

