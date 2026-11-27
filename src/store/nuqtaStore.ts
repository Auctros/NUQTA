import { defaultProfile } from '../lib/storage';
import { emptyHealthRecord } from '../lib/healthDefaults';
import { localDateKey, addDaysToKey } from '../lib/dateKey';
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
  HistoryAuditLogEntry,
  AppNotification,
  NotificationPreferences,
  YoutubeCourse,
  Project,
  ProjectPhase,
  ProjectStep,
  ProjectNote,
  ProjectResource,
  ProjectStatus,
  ProjectStepStatus,
  ProjectActivity,
  ProjectActivityType
} from '../types';
import { NuqtaStorageEngine } from '../lib/storage';
import {
  addNotification,
  dismissNotification as dismissNotificationInList,
  markAllRead as markAllReadInList,
  markRead as markReadInList,
  markUnread as markUnreadInList,
  pruneNotifications,
  shouldDeliverToBrowser,
  type NotificationDraft
} from '../lib/notificationEngine';
import { deliverBrowserNotification } from '../lib/notifications';
import { renderNotificationText } from '../lib/notificationMessages';
import { parseNaturalLanguageTask } from '../lib/nlpParser';
import { computeDailyEnergyScore } from '../lib/energyAlgorithm';
import { computeCurrentStreak } from '../lib/habitSchedule';
import { isTaskPending } from '../lib/taskStatus';
import { isWeeklyReviewDay } from '../lib/week';
import { initialNavTab } from '../lib/navigation';
import {
  draftFromTask,
  materializeSeries,
  newSeriesId,
  pendingOccurrenceIds,
  reconcileSeries,
  removeSeries,
  seriesDates,
  SERIES_HORIZON_DAYS
} from '../lib/taskRecurrence';
import { runLiquidThemeTransition } from '../lib/themeTransition';
import {
  addNote,
  addPhase,
  addResource,
  addStep,
  applyStatus,
  attachTaskToStep,
  deleteNote,
  deletePhase,
  deleteResource,
  deleteStep,
  detachTaskFromSteps,
  linkGoal,
  markNoteConvertedToStep,
  markNoteConvertedToTask,
  moveStep,
  projectId,
  projectStatusLabel,
  recordActivity,
  setStepStatus,
  togglePhaseCompletion,
  unlinkGoal
} from '../lib/projectModel';
import {
  generateEmptyQuranSurahs,
  mergeAyahRanges,
  calculateDistinctAyahs,
  getSurahMeta,
  QURAN_SURAHS
} from '../lib/quranData';
import confetti from 'canvas-confetti';

/**
 * Clear `linkedGoalId` from a goal's *nested* activity records (books, reading
 * sessions, artwork pieces, art projects and Quran sessions). These carry their own
 * `linkedGoalId` (copied from their parent habit at creation time), so deleting a goal
 * must sweep them too — otherwise the deleted id lingers as a dangling reference.
 */
const clearNestedGoalLinks = (habits: Habit[], goalId: string): Habit[] =>
  habits.map((h) => {
    let next = h;
    const reading = h.readingData;
    if (reading) {
      const books = reading.books.map((b) => (b.linkedGoalId === goalId ? { ...b, linkedGoalId: undefined } : b));
      const sessions = reading.sessions.map((s) =>
        s.linkedGoalId === goalId ? { ...s, linkedGoalId: undefined } : s
      );
      if (books.some((b, i) => b !== reading.books[i]) || sessions.some((s, i) => s !== reading.sessions[i])) {
        next = { ...next, readingData: { ...reading, books, sessions } };
      }
    }
    const drawing = next.drawingData;
    if (drawing) {
      const projects = (drawing.projects || []).map((p) =>
        p.linkedGoalId === goalId ? { ...p, linkedGoalId: undefined } : p
      );
      const pieces = drawing.pieces.map((p) => (p.linkedGoalId === goalId ? { ...p, linkedGoalId: undefined } : p));
      const projectsChanged = projects.some((p, i) => p !== (drawing.projects || [])[i]);
      if (projectsChanged || pieces.some((p, i) => p !== drawing.pieces[i])) {
        next = { ...next, drawingData: { ...drawing, projects, pieces } };
      }
    }
    const quran = next.quranData;
    if (quran) {
      const sessions = quran.sessions.map((s) =>
        s.linkedGoalId === goalId ? { ...s, linkedGoalId: undefined } : s
      );
      if (sessions.some((s, i) => s !== quran.sessions[i])) {
        next = { ...next, quranData: { ...quran, sessions } };
      }
    }
    const workout = next.workoutData;
    if (workout) {
      const sessions = workout.sessions.map((s) =>
        s.linkedGoalId === goalId ? { ...s, linkedGoalId: undefined } : s
      );
      if (sessions.some((s, i) => s !== workout.sessions[i])) {
        next = { ...next, workoutData: { ...workout, sessions } };
      }
    }
    return next;
  });

/**
 * Drop the given ids from a goal's explicit relation lists. `linkedBookIds` and
 * `linkedArtProjectIds` live on the goal itself, so deleting a book or project must
 * remove its id here as well, or the goal keeps a link to a record that is gone.
 */
const pruneGoalRelationIds = (
  goals: Goal[],
  removed: { taskIds?: string[]; habitIds?: string[]; bookIds?: string[]; artProjectIds?: string[] }
): Goal[] => {
  const drop = (list: string[] | undefined, ids: string[] | undefined) => {
    if (!list || !ids || ids.length === 0) return list;
    const gone = new Set(ids);
    const next = list.filter((id) => !gone.has(id));
    return next.length === list.length ? list : next;
  };
  return goals.map((g) => {
    const linkedTaskIds = drop(g.linkedTaskIds, removed.taskIds);
    const linkedHabitIds = drop(g.linkedHabitIds, removed.habitIds);
    const linkedBookIds = drop(g.linkedBookIds, removed.bookIds);
    const linkedArtProjectIds = drop(g.linkedArtProjectIds, removed.artProjectIds);
    if (
      linkedTaskIds === g.linkedTaskIds &&
      linkedHabitIds === g.linkedHabitIds &&
      linkedBookIds === g.linkedBookIds &&
      linkedArtProjectIds === g.linkedArtProjectIds
    ) {
      return g;
    }
    return { ...g, linkedTaskIds, linkedHabitIds, linkedBookIds, linkedArtProjectIds, updatedAt: new Date().toISOString() };
  });
};

/**
 * Fields an edit copies across every occurrence of a series. Scheduling identity
 * (`scheduledDate`), status and lifecycle timestamps are deliberately excluded: each
 * occurrence keeps its own day and its own completion state.
 */
const seriesFieldsFrom = (updates: Partial<Task>): Partial<Task> => {
  const {
    scheduledDate: _d,
    status: _st,
    completedAt: _ca,
    cancelledAt: _xa,
    recurrence: _r,
    seriesId: _s,
    occurrenceIndex: _o,
    id: _id,
    createdAt: _cr,
    updatedAt: _ua,
    ...fields
  } = updates;
  return fields;
};

/**
 * Recompute a Quran studio's denormalised totals from its surah states and its
 * session log, so deleting a session (or surah progress) can never leave a
 * stale aggregate behind.
 */
const recomputeQuranTotals = (
  quran: import('../types').QuranHabitData
): import('../types').QuranHabitData => ({
  ...quran,
  totalAyahsMemorized: quran.surahs.reduce((sum, s) => sum + (s.memorizedAyahsCount || 0), 0),
  totalSurahsCompleted: quran.surahs.filter((s) => s.status === 'completed').length,
  totalMemorizationMinutes: quran.sessions.reduce(
    (sum, s) => sum + (s.type === 'new_memorization' ? s.durationMinutes || 0 : 0),
    0
  ),
  totalRevisionMinutes: quran.sessions.reduce(
    (sum, s) => sum + (s.type !== 'new_memorization' ? s.durationMinutes || 0 : 0),
    0
  )
});

interface NuqtaStoreState {
  // Data
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  focusSessions: FocusSession[];
  healthMetrics: Record<string, HealthMetric>;
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoal[];
  journalEntries: JournalEntry[];
  profile: UserProfile;
  sundayReviews: SundayRitualReview[];
  historyAuditLogs: HistoryAuditLogEntry[];

  // Notifications (local-only; never synchronized)
  notifications: AppNotification[];
  notificationPreferences: NotificationPreferences;

  // Imported YouTube courses (local-only cache; never synchronized)
  courses: YoutubeCourse[];

  // Computed & UI State
  energyScore: number;
  isRescueModeOpen: boolean;
  isQuickCaptureOpen: boolean;
  isSundayRitualOpen: boolean;
  activeNavTab: 'today' | 'tasks' | 'habits' | 'goals' | 'projects' | 'focus' | 'calendar' | 'health' | 'finance' | 'journal' | 'insights' | 'simulator' | 'profile' | 'quran' | 'reading' | 'workout' | 'drawing' | 'walking' | 'courses' | 'timeline' | 'archive';
  searchQuery: string;
  selectedTagFilter: string | null;

  // Actions
  initializeStore: () => void;
  setActiveNavTab: (tab: NuqtaStoreState['activeNavTab']) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTagFilter: (tag: string | null) => void;

  // YouTube Courses (import + refresh; a local cache of YouTube's own data)
  /** Add a course, or refresh the one already imported for this playlist. */
  upsertCourse: (course: YoutubeCourse) => void;
  removeCourse: (id: string) => void;
  /** Is this playlist already in the library? */
  hasCourseForPlaylist: (playlistId: string) => boolean;

  // Transient cross-screen focus request — UI only, never persisted
  focusRequest: { domain: string; entityId: string; nonce: number } | null;
  requestFocus: (domain: string, entityId: string) => void;
  consumeFocus: () => void;

  // Task Actions
  addTaskFromNLP: (rawText: string) => Task;
  createTask: (draft: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  /**
   * Apply an edit to every still-open occurrence of a recurring series.
   * `anchorId` is the occurrence the user edited: its date is the series anchor, so a
   * changed recurrence rule is re-materialised from that day forward.
   */
  updateTaskSeries: (seriesId: string, anchorId: string, updates: Partial<Task>) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTopThree: (id: string) => { success: boolean; message?: string };
  deleteTask: (id: string) => void;
  /** Delete every occurrence of a recurring series. */
  deleteTaskSeries: (seriesId: string) => void;
  /** Skip one occurrence without completing it (leaves the rest of the series). */
  skipTaskOccurrence: (id: string) => void;
  /** Materialise recurring-task occurrences up to the rolling horizon. */
  topUpRecurringTasks: () => void;
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
  /** Move a program through its lifecycle (draft → active → paused → completed → archived). */
  setWorkoutRoutineStatus: (habitId: string, routineId: string, status: import('../types').WorkoutProgramStatus) => void;
  /** Mark a program day complete (or not) — drives the workspace progress bar. */
  setProgramDayCompleted: (habitId: string, routineId: string, dayId: string, completed: boolean) => void;
  /** Add or update a user-authored exercise in the custom library. */
  addOrUpdateCustomExercise: (habitId: string, exercise: import('../types').PrebuiltExercise) => void;
  deleteCustomExercise: (habitId: string, exerciseId: string) => void;

  logDrawingSession: (habitId: string, piece: Omit<import('../types').ArtworkPiece, 'id' | 'completedDate'>) => void;
  deleteArtworkPiece: (habitId: string, pieceId: string) => void;
  addOrUpdateArtProject: (habitId: string, project: import('../types').ArtProject) => void;
  deleteArtProject: (habitId: string, projectId: string) => void;
  updateDrawingTargets: (habitId: string, targets: { weeklyTargetHours?: number }) => void;

  logWalkingSession: (habitId: string, session: Omit<import('../types').WalkingSessionLog, 'id' | 'date'>) => void;
  deleteWalkingSession: (habitId: string, sessionId: string) => void;
  updateWalkingTargets: (habitId: string, targets: { weeklyTargetMinutes?: number }) => void;

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

  // Project Actions
  createProject: (draft: Partial<Project>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  /** Move a project through its lifecycle. Completing stamps `completedAt`. */
  setProjectStatus: (id: string, status: ProjectStatus) => void;
  /** Delete a project. Tasks that executed it are detached, never deleted. */
  deleteProject: (id: string) => void;
  /** Set an explicit progress override, or clear it with null to go back to derived. */
  setProjectManualProgress: (id: string, ratio: number | null) => void;

  addProjectPhase: (projectId: string, phase: { title: string; description?: string; startDate?: string; targetDate?: string }) => void;
  updateProjectPhase: (projectId: string, phaseId: string, updates: Partial<ProjectPhase>) => void;
  deleteProjectPhase: (projectId: string, phaseId: string) => void;
  /** Completing a phase stamps `completedAt`; reopening clears it. */
  toggleProjectPhaseCompletion: (projectId: string, phaseId: string) => void;

  addProjectStep: (projectId: string, step: { title: string; description?: string; phaseId?: string }) => void;
  updateProjectStep: (projectId: string, stepId: string, updates: Partial<ProjectStep>) => void;
  deleteProjectStep: (projectId: string, stepId: string) => void;
  setProjectStepStatus: (projectId: string, stepId: string, status: ProjectStepStatus) => void;
  /** Reorder a step within the project plan by moving it one place up or down. */
  moveProjectStep: (projectId: string, stepId: string, direction: 'up' | 'down') => void;

  addProjectNote: (projectId: string, note: Partial<ProjectNote> & { body: string }) => void;
  updateProjectNote: (projectId: string, noteId: string, updates: Partial<ProjectNote>) => void;
  deleteProjectNote: (projectId: string, noteId: string) => void;
  /** Turn an idea into a planned step. The note is kept as the trace of the decision. */
  convertProjectNoteToStep: (projectId: string, noteId: string) => void;
  /** Turn an idea into a task in the Tasks module, linked back to this project. */
  convertProjectNoteToTask: (projectId: string, noteId: string) => void;

  addProjectResource: (projectId: string, resource: Omit<ProjectResource, 'id' | 'createdAt'>) => void;
  deleteProjectResource: (projectId: string, resourceId: string) => void;

  /** Link a goal to a project. The project owns the link. */
  linkProjectToGoal: (projectId: string, goalId: string) => void;
  unlinkProjectFromGoal: (projectId: string, goalId: string) => void;

  /** Attach an existing task to a project, optionally naming the step it executes. */
  linkTaskToProject: (taskId: string, projectId: string, stepId?: string) => void;
  unlinkTaskFromProject: (taskId: string) => void;

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

  // Notification Actions (local-only)
  /** Raise a notification. Returns true when a new row was created (false = duplicate). */
  notify: (draft: NotificationDraft) => boolean;
  markNotificationRead: (id: string) => void;
  markNotificationUnread: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearReadNotifications: () => void;
  setNotificationPreferences: (prefs: NotificationPreferences) => void;
  /** Prune expired rows. Called on load and on a slow timer. */
  pruneNotificationInbox: () => void;
}

export const useNuqtaStore = create<NuqtaStoreState>((set, get) => ({
  tasks: [],
  habits: [],
  goals: [],
  projects: [],
  focusSessions: [],
  healthMetrics: {},
  expenses: [],
  savingsGoals: [],
  journalEntries: [],
  historyAuditLogs: [],
  profile: defaultProfile(),
  sundayReviews: [],

  notifications: [],
  notificationPreferences: NuqtaStorageEngine.getNotificationPreferences(),
  courses: NuqtaStorageEngine.getCourses(),

  energyScore: 50,
  isRescueModeOpen: false,
  isQuickCaptureOpen: false,
  isSundayRitualOpen: false,
  // Resolved before first paint so a reload lands where the person was, not on
  // the dashboard. See src/lib/navigation.ts for the startup policy.
  activeNavTab: initialNavTab(),
  focusRequest: null,
  searchQuery: '',
  selectedTagFilter: null,

  initializeStore: () => {
    const tasks = NuqtaStorageEngine.getTasks();
    const habits = NuqtaStorageEngine.getHabits();
    const goals = NuqtaStorageEngine.getGoals();
    const projects = NuqtaStorageEngine.getProjects();
    const focusSessions = NuqtaStorageEngine.getFocusSessions();
    const healthMetrics = NuqtaStorageEngine.getHealthMetrics();
    const expenses = NuqtaStorageEngine.getExpenses();
    const savingsGoals = NuqtaStorageEngine.getSavingsGoals();
    const journalEntries = NuqtaStorageEngine.getJournalEntries();
    const profile = NuqtaStorageEngine.getProfile();
    const sundayReviews = NuqtaStorageEngine.getSundayReviews();
    const historyAuditLogs = NuqtaStorageEngine.getHistoryAuditLogs();
    const notificationPreferences = NuqtaStorageEngine.getNotificationPreferences();
    const courses = NuqtaStorageEngine.getCourses();
    // Expired rows are dropped at load: a notification that outlived its usefulness should
    // not reappear just because the app was reopened.
    const notifications = pruneNotifications(NuqtaStorageEngine.getNotifications());

    const todayStr = localDateKey();
    const todayHealth = healthMetrics[todayStr] ?? null;

    const energy = computeDailyEnergyScore(todayHealth, tasks);

    // The weekly review closes the week on the weekly day off (Friday).
    const reviewedToday = sundayReviews.some((r) => r.date === todayStr);
    const weeklySundayReviewDue = isWeeklyReviewDay(todayStr) && !reviewedToday;

    set({
      tasks,
      habits,
      goals,
      projects,
      focusSessions,
      healthMetrics,
      expenses,
      savingsGoals,
      journalEntries,
      profile: { ...profile, weeklySundayReviewDue },
      sundayReviews,
      historyAuditLogs,
      notifications,
      notificationPreferences,
      courses,
      energyScore: energy
    });

    // Roll the recurrence horizon forward on every load so a series always has the
    // upcoming occurrences materialised without unbounded growth.
    get().topUpRecurringTasks();
  },

  upsertCourse: (course) => {
    const existing = get().courses;
    const index = existing.findIndex((c) => c.id === course.id || c.playlistId === course.playlistId);
    const next =
      index >= 0
        ? existing.map((c, i) => (i === index ? course : c))
        : [course, ...existing];
    NuqtaStorageEngine.saveCourses(next);
    set({ courses: next });
  },

  removeCourse: (id) => {
    const next = get().courses.filter((c) => c.id !== id);
    NuqtaStorageEngine.saveCourses(next);
    set({ courses: next });
  },

  hasCourseForPlaylist: (playlistId) => get().courses.some((c) => c.playlistId === playlistId),

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
    const base = {
      title: draft.title || 'Untitled Action',
      notes: draft.notes || '',
      priority: draft.priority || 3,
      isTopThree: draft.isTopThree || false,
      scheduledTime: draft.scheduledTime,
      estimatedMinutes: draft.estimatedMinutes || 30,
      tags: draft.tags || [],
      energyLevelRequired: draft.energyLevelRequired || 'medium',
      subtasks: draft.subtasks || [],
      linkedGoalId: draft.linkedGoalId
    } as const;

    // A recurring task becomes a bounded series of real occurrence records. The
    // first occurrence is the anchor date; the rest are topped up to the horizon.
    let newTasks: Task[];
    if (draft.recurrence) {
      const seriesId = newSeriesId();
      const anchor = draft.scheduledDate || todayStr;
      const nowIso = new Date().toISOString();
      newTasks = materializeSeries(seriesId, base, draft.recurrence, anchor, new Set(), todayStr, nowIso);
      if (newTasks.length === 0) {
        // A rule that produces nothing in range still needs one anchor occurrence.
        newTasks = [
          {
            id: 't-' + crypto.randomUUID().slice(0, 8),
            ...base,
            status: 'todo',
            scheduledDate: anchor,
            recurrence: draft.recurrence,
            seriesId,
            occurrenceIndex: 0,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        ];
      }
    } else {
      newTasks = [
        {
          id: 't-' + crypto.randomUUID().slice(0, 8),
          ...base,
          status: 'todo',
          scheduledDate: draft.scheduledDate || todayStr,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }

    const updated = [...newTasks, ...get().tasks];
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });

    const linkedGoalId = base.linkedGoalId;
    if (linkedGoalId) {
      const updatedGoals = get().goals.map((g) => {
        if (g.id === linkedGoalId) {
          const currentIds = g.linkedTaskIds || [];
          const added = newTasks.map((t) => t.id).filter((id) => !currentIds.includes(id));
          if (added.length > 0) {
            return { ...g, linkedTaskIds: [...currentIds, ...added], updatedAt: new Date().toISOString() };
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
      (t) => t.isTopThree && isTaskPending(t)
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

    const updatedGoals = pruneGoalRelationIds(get().goals, { taskIds: [id] });
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });

    // A project step keeps a `taskIds` list. Deleting the task without clearing that
    // reference would leave a step pointing at a record no view can resolve, so the
    // step would count a task that no longer exists. Detach it here, exactly as
    // `unlinkTaskFromProject` does for an explicit unlink.
    if (get().projects.some((p) => p.steps.some((s) => s.taskIds.includes(id)))) {
      const now = new Date().toISOString();
      const updatedProjects = get().projects.map((p) => detachTaskFromSteps(p, id, now));
      NuqtaStorageEngine.saveProjects(updatedProjects);
      set({ projects: updatedProjects });
    }
  },

  updateTaskSeries: (seriesId, anchorId, updates) => {
    const now = new Date().toISOString();
    const todayStr = localDateKey();
    const tasks = get().tasks;
    const anchor = tasks.find((t) => t.id === anchorId);
    const rule = updates.recurrence ?? anchor?.recurrence;

    // When the rule (or the anchor date) changed, rebuild the still-open future
    // occurrences from the anchor instead of leaving the old cadence in place.
    if (anchor && rule && (updates.recurrence !== undefined || updates.scheduledDate !== undefined)) {
      const anchorKey = updates.scheduledDate || anchor.scheduledDate || todayStr;
      const draft = { ...draftFromTask(anchor), ...seriesFieldsFrom(updates) };
      const updated = reconcileSeries(tasks, seriesId, rule, anchorKey, todayStr, now, draft);
      NuqtaStorageEngine.saveTasks(updated);
      set({ tasks: updated });
      return;
    }

    // Fields that describe the series are copied; each occurrence keeps its own
    // scheduledDate/status so an edit never collapses the series onto one day or
    // resurrects a completed occurrence.
    const seriesFields = seriesFieldsFrom(updates);
    const updated = tasks.map((t) =>
      t.seriesId === seriesId && isTaskPending(t) ? { ...t, ...seriesFields, updatedAt: now } : t
    );
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
  },

  deleteTaskSeries: (seriesId) => {
    const ids = pendingOccurrenceIds(get().tasks, seriesId);
    const updated = removeSeries(get().tasks, seriesId);
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });

    if (ids.length > 0) {
      const updatedGoals = pruneGoalRelationIds(get().goals, { taskIds: ids });
      NuqtaStorageEngine.saveGoals(updatedGoals);
      set({ goals: updatedGoals });
    }
  },

  skipTaskOccurrence: (id) => {
    // Skip one occurrence only: the rest of the series is untouched, and a skipped
    // day is not counted as completed.
    const updated = get().tasks.map((t) =>
      t.id === id
        ? { ...t, status: 'skipped' as const, isTopThree: false, updatedAt: new Date().toISOString() }
        : t
    );
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
  },

  topUpRecurringTasks: () => {
    const todayStr = localDateKey();
    const tasks = get().tasks;
    const seriesIds = [...new Set(tasks.filter((t) => t.seriesId && t.recurrence).map((t) => t.seriesId!))];
    if (seriesIds.length === 0) return;

    const additions: Task[] = [];
    for (const seriesId of seriesIds) {
      const members = tasks.filter((t) => t.seriesId === seriesId);
      // Anchor = the earliest occurrence (its date is the series start).
      const anchorTask = members
        .filter((t) => t.scheduledDate)
        .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))[0];
      const rule = anchorTask?.recurrence;
      if (!anchorTask?.scheduledDate || !rule) continue;

      const draft = {
        title: anchorTask.title,
        notes: anchorTask.notes,
        priority: anchorTask.priority,
        isTopThree: anchorTask.isTopThree,
        scheduledTime: anchorTask.scheduledTime,
        estimatedMinutes: anchorTask.estimatedMinutes,
        tags: anchorTask.tags,
        energyLevelRequired: anchorTask.energyLevelRequired,
        linkedGoalId: anchorTask.linkedGoalId,
        subtasks: anchorTask.subtasks
      };
      const existing = seriesDates(tasks, seriesId);
      additions.push(...materializeSeries(seriesId, draft, rule, anchorTask.scheduledDate, existing, todayStr));
    }

    if (additions.length === 0) return;
    const updated = [...tasks, ...additions];
    NuqtaStorageEngine.saveTasks(updated);
    set({ tasks: updated });
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

    // Derive the streak from real dates so a missed due day breaks it.
    const updatedHabit: Habit = { ...habit, completedDates: updatedDates };
    const currentStreak = computeCurrentStreak(updatedHabit, todayStr);
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
    let walkingData = habitDraft.walkingData;
    let quranData = habitDraft.quranData;

    // New habits start empty: no sample/fabricated studio history is created.
    if (specializedType === 'reading' && !readingData) {
      readingData = {
        annualTargetBooks: 24,
        dailyTargetPages: 20,
        weeklyTargetPages: 140,
        totalPagesRead: 0,
        totalReadingMinutes: 0,
        books: [],
        quotes: [],
        sessions: []
      };
    } else if (specializedType === 'workout' && !workoutData) {
      workoutData = {
        weeklyTargetSessions: 4,
        monthlyTargetReps: 500,
        totalReps: 0,
        totalVolumeKg: 0,
        totalMinutes: 0,
        totalWorkouts: 0,
        favoriteRoutine: '',
        customRoutines: [],
        sessions: []
      };
    } else if (specializedType === 'drawing' && !drawingData) {
      drawingData = {
        weeklyTargetHours: 3,
        totalDrawingMinutes: 0,
        totalSketches: 0,
        favoriteMedium: 'sketch',
        projects: [],
        pieces: []
      };
    } else if (specializedType === 'walking' && !walkingData) {
      walkingData = {
        sessions: [],
        weeklyTargetMinutes: 150,
        totalWalkMinutes: 0,
        totalWalkSeconds: 0,
        totalWalks: 0
      };
    } else if (specializedType === 'quran' && !quranData) {
      quranData = {
        surahs: generateEmptyQuranSurahs(),
        sessions: [],
        revisionSchedule: {
          dailyWirdJuz: 1,
          revisionCycleDays: 7,
          currentReviewSurahs: [],
          targetDailyAyahs: 10,
          weeklyTargetRevisionMinutes: 120
        },
        totalAyahsMemorized: 0,
        totalSurahsCompleted: 0,
        totalMemorizationMinutes: 0,
        totalRevisionMinutes: 0,
        dailyTargetAyahs: 10,
        activeSurahNumber: 1
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
      walkingData,
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
    const target = get().habits.find((h) => h.id === id);
    // Habits stacked on the deleted habit must not keep a parent id that no
    // longer resolves; they become standalone habits.
    const updated = get()
      .habits.filter((h) => h.id !== id)
      .map((h) => (h.stackParentHabitId === id ? { ...h, stackParentHabitId: undefined } : h));
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    // The habit's own books/art projects disappear with it, so drop them from any
    // goal that linked them explicitly, along with the habit link itself.
    const bookIds = (target?.readingData?.books ?? []).map((b) => b.id);
    const artProjectIds = (target?.drawingData?.projects ?? []).map((p) => p.id);
    const updatedGoals = pruneGoalRelationIds(get().goals, { habitIds: [id], bookIds, artProjectIds });
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
      const currentStreak = computeCurrentStreak({ ...h, completedDates }, todayStr);
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
      // Drop the deleted book's logged sessions and recompute the denormalised
      // totals so the dashboard never reports pages/hours that no longer exist.
      const sessions = h.readingData.sessions.filter((s) => s.bookId !== bookId);
      // Quotes captured against the deleted book must not keep a bookId that no
      // longer resolves; the quote text itself is preserved.
      const quotes = (h.readingData.quotes || []).map((q) =>
        q.bookId === bookId ? { ...q, bookId: undefined } : q
      );
      const totalPagesRead = sessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
      const totalReadingMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      return {
        ...h,
        readingData: {
          ...h.readingData,
          books: remainingBooks,
          activeBookId: newActiveId,
          sessions,
          quotes,
          totalPagesRead,
          totalReadingMinutes
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    // A goal may explicitly link the deleted book; drop that id so the goal never
    // points at a record that no longer exists.
    const updatedGoals = pruneGoalRelationIds(get().goals, { bookIds: [bookId] });
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });
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
      const currentStreak = computeCurrentStreak({ ...h, completedDates }, todayStr);
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
          customRoutines: (h.workoutData.customRoutines || []).filter((r) => r.id !== routineId),
          // Sessions logged from this routine must not keep a routineId that no
          // longer resolves; the session itself is preserved.
          sessions: h.workoutData.sessions.map((s) =>
            s.routineId === routineId ? { ...s, routineId: undefined } : s
          )
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

  setWorkoutRoutineStatus: (habitId, routineId, status) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      const customRoutines = (h.workoutData.customRoutines || []).map((r) => {
        if (r.id !== routineId) return r;
        // Archive keeps the legacy flags in sync so the archive views agree.
        const isArchived = status === 'archived';
        return {
          ...r,
          status,
          isArchived,
          archivedAt: isArchived ? r.archivedAt || new Date().toISOString() : undefined,
          program:
            r.program && status === 'active' && !r.program.startedAt
              ? { ...r.program, startedAt: localDateKey() }
              : r.program
        };
      });
      return { ...h, workoutData: { ...h.workoutData, customRoutines } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  setProgramDayCompleted: (habitId, routineId, dayId, completed) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      const customRoutines = (h.workoutData.customRoutines || []).map((r) => {
        if (r.id !== routineId || !r.program) return r;
        const done = new Set(r.program.completedDayIds ?? []);
        if (completed) done.add(dayId);
        else done.delete(dayId);
        return { ...r, program: { ...r.program, completedDayIds: Array.from(done) } };
      });
      return { ...h, workoutData: { ...h.workoutData, customRoutines } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  addOrUpdateCustomExercise: (habitId, exercise) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      const existing = h.workoutData.customExercises || [];
      const idx = existing.findIndex((e) => e.id === exercise.id);
      const customExercises = idx >= 0 ? existing.map((e) => (e.id === exercise.id ? exercise : e)) : [...existing, exercise];
      return { ...h, workoutData: { ...h.workoutData, customExercises } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  deleteCustomExercise: (habitId, exerciseId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.workoutData) return h;
      return {
        ...h,
        workoutData: {
          ...h.workoutData,
          customExercises: (h.workoutData.customExercises || []).filter((e) => e.id !== exerciseId)
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
      const currentStreak = computeCurrentStreak({ ...h, completedDates }, todayStr);
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
      const piece = h.drawingData.pieces.find((p) => p.id === pieceId);
      const remaining = h.drawingData.pieces.filter((p) => p.id !== pieceId);
      // Keep per-project stats consistent with the pieces that still exist.
      const projects = (h.drawingData.projects || []).map((proj) => {
        if (!piece || piece.projectId !== proj.id) return proj;
        return {
          ...proj,
          totalMinutesSpent: Math.max(0, (proj.totalMinutesSpent || 0) - (piece.durationMinutes || 0)),
          sessionsCount: Math.max(0, (proj.sessionsCount || 0) - 1)
        };
      });
      return {
        ...h,
        drawingData: {
          ...h.drawingData,
          projects,
          pieces: remaining,
          totalSketches: remaining.length,
          totalDrawingMinutes: remaining.reduce((sum, p) => sum + (p.durationMinutes || 0), 0)
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
          projects: (h.drawingData.projects || []).filter((p) => p.id !== projectId),
          // Pieces logged against this project must not keep a projectId that no
          // longer resolves; they become standalone pieces rather than orphans.
          pieces: h.drawingData.pieces.map((p) =>
            p.projectId === projectId ? { ...p, projectId: undefined } : p
          )
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });

    // Drop the deleted project id from any goal that linked it explicitly.
    const updatedGoals = pruneGoalRelationIds(get().goals, { artProjectIds: [projectId] });
    NuqtaStorageEngine.saveGoals(updatedGoals);
    set({ goals: updatedGoals });
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

  // Dedicated Walking Studio Actions
  logWalkingSession: (habitId, sessionDraft) => {
    const todayStr = localDateKey();
    const targetHabit = get().habits.find((h) => h.id === habitId);
    if (!targetHabit) return;

    // A walk with no measured time is not a record; refuse rather than store a zero.
    const durationSeconds = Math.max(0, Math.round(sessionDraft.durationSeconds));
    if (durationSeconds < 1) return;

    const newSession = {
      ...sessionDraft,
      id: 'wk-' + crypto.randomUUID().slice(0, 8),
      date: todayStr,
      durationSeconds,
      linkedGoalId: sessionDraft.linkedGoalId || targetHabit.linkedGoalId
    };

    const updated = get().habits.map((h) => {
      if (h.id !== habitId) return h;
      const walking = h.walkingData || {
        sessions: [],
        weeklyTargetMinutes: 150,
        totalWalkMinutes: 0,
        totalWalkSeconds: 0,
        totalWalks: 0
      };

      // Totals re-derive from the stored sessions so a deleted walk cannot leave a
      // phantom distance/step count behind.
      const sessions = [newSession, ...walking.sessions];
      const totalWalkSeconds = sessions.reduce((acc, s) => acc + Math.max(0, s.durationSeconds || 0), 0);
      const distanceEntries = sessions.filter((s) => typeof s.distanceKm === 'number' && s.distanceKm > 0);
      const stepEntries = sessions.filter((s) => typeof s.steps === 'number' && s.steps > 0);

      const updatedWalking = {
        ...walking,
        sessions,
        totalWalks: sessions.length,
        totalWalkSeconds,
        totalWalkMinutes: Math.round(totalWalkSeconds / 60),
        totalDistanceKm: distanceEntries.length
          ? distanceEntries.reduce((acc, s) => acc + (s.distanceKm as number), 0)
          : undefined,
        totalSteps: stepEntries.length ? stepEntries.reduce((acc, s) => acc + (s.steps as number), 0) : undefined
      };

      const completedDates = h.completedDates.includes(todayStr)
        ? h.completedDates
        : [...h.completedDates, todayStr];
      const currentStreak = computeCurrentStreak({ ...h, completedDates }, todayStr);
      const longestStreak = Math.max(h.longestStreak, currentStreak);

      return {
        ...h,
        walkingData: updatedWalking,
        completedDates,
        currentStreak,
        longestStreak
      };
    });

    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
    get().addXP(30);
  },

  deleteWalkingSession: (habitId, sessionId) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.walkingData) return h;
      const sessions = h.walkingData.sessions.filter((s) => s.id !== sessionId);
      const totalWalkSeconds = sessions.reduce((acc, s) => acc + Math.max(0, s.durationSeconds || 0), 0);
      const distanceEntries = sessions.filter((s) => typeof s.distanceKm === 'number' && s.distanceKm > 0);
      const stepEntries = sessions.filter((s) => typeof s.steps === 'number' && s.steps > 0);
      return {
        ...h,
        walkingData: {
          ...h.walkingData,
          sessions,
          totalWalks: sessions.length,
          totalWalkSeconds,
          totalWalkMinutes: Math.round(totalWalkSeconds / 60),
          totalDistanceKm: distanceEntries.length
            ? distanceEntries.reduce((acc, s) => acc + (s.distanceKm as number), 0)
            : undefined,
          totalSteps: stepEntries.length ? stepEntries.reduce((acc, s) => acc + (s.steps as number), 0) : undefined
        }
      };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  updateWalkingTargets: (habitId, targets) => {
    const updated = get().habits.map((h) => {
      if (h.id !== habitId || !h.walkingData) return h;
      return { ...h, walkingData: { ...h.walkingData, ...targets } };
    });
    NuqtaStorageEngine.saveHabits(updated);
    set({ habits: updated });
  },

  // Dedicated Quran App Actions
  logQuranSession: (habitId, sessionDraft) => {
    const todayStr = localDateKey();

    // Validate the surah reference before touching any state. An out-of-range
    // number rejects the whole operation: no session, no streak/completion
    // change, no XP and no total drift.
    const surahNumber = sessionDraft.surahNumber;
    const isValidSurah =
      Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= QURAN_SURAHS.length;
    if (!isValidSurah) {
      console.warn(`NUQTA: logQuranSession rejected an invalid surah number (${surahNumber}).`);
      return;
    }

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
        surahs: generateEmptyQuranSurahs(),
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
        activeSurahNumber: 1
      };

      const surahMeta = getSurahMeta(surahNumber);

      // Update Surahs array. A valid surah that is not tracked yet is created
      // (upsert) so its memorisation is never silently dropped.
      let updatedSurahs = [...quran.surahs];
      const existingSurahIdx = updatedSurahs.findIndex((s) => s.surahNumber === surahNumber);
      const baseSurah: import('../types').SurahMemorizationState =
        existingSurahIdx >= 0
          ? updatedSurahs[existingSurahIdx]
          : { surahNumber, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 };

      let nextSurah: import('../types').SurahMemorizationState;
      if (sessionDraft.type === 'new_memorization') {
        const mergedRanges = mergeAyahRanges(baseSurah.memorizedAyahsRanges || [], {
          start: sessionDraft.ayahStart,
          end: sessionDraft.ayahEnd
        });
        const distinctCount = calculateDistinctAyahs(mergedRanges);
        const isDone = distinctCount >= surahMeta.totalAyahs;
        nextSurah = {
          ...baseSurah,
          memorizedAyahsRanges: mergedRanges,
          memorizedAyahsCount: distinctCount,
          status: isDone ? 'completed' : 'in_progress',
          lastReviewedDate: todayStr,
          masteryRating: sessionDraft.quality === 'excellent' ? 5 : sessionDraft.quality === 'very_good' ? 4 : 3,
          notes: sessionDraft.notes || baseSurah.notes
        };
      } else {
        // revision or recitation test
        nextSurah = {
          ...baseSurah,
          lastReviewedDate: todayStr,
          masteryRating: sessionDraft.quality === 'excellent' ? 5 : sessionDraft.quality === 'very_good' ? 4 : sessionDraft.quality === 'good' ? 3 : 2,
          status: sessionDraft.quality === 'needs_reinforcement' && baseSurah.status !== 'completed' ? 'needs_revision' : baseSurah.status
        };
      }

      if (existingSurahIdx >= 0) {
        updatedSurahs[existingSurahIdx] = nextSurah;
      } else {
        updatedSurahs = [...updatedSurahs, nextSurah];
      }

      // Recompute totals strictly without duplicate counting
      const updatedQuran: import('../types').QuranHabitData = recomputeQuranTotals({
        ...quran,
        surahs: updatedSurahs,
        sessions: [newSession, ...quran.sessions],
        activeSurahNumber: surahNumber
      });

      // Mark habit completed today
      const alreadyDone = h.completedDates.includes(todayStr);
      const completedDates = alreadyDone ? h.completedDates : [...h.completedDates, todayStr];
      const currentStreak = computeCurrentStreak({ ...h, completedDates }, todayStr);
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
        quranData: recomputeQuranTotals({
          ...h.quranData,
          sessions: h.quranData.sessions.filter((s) => s.id !== sessionId)
        })
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
    const before = get().goals.find((g) => g.id === id);
    const updated = get().goals.map((g) =>
      g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
    );
    NuqtaStorageEngine.saveGoals(updated);
    set({ goals: updated });

    // Celebrate the transition into "completed" once, not every later edit.
    const after = updated.find((g) => g.id === id);
    if (before && after && before.status !== 'completed' && after.status === 'completed') {
      const isAr = get().profile.language === 'ar';
      const params = { title: after.title };
      const text = renderNotificationText('goal.completed', params, { title: after.title }, isAr);
      get().notify({
        category: 'goal',
        priority: 'high',
        title: text.title,
        body: text.body,
        route: { nav: 'goals', entityId: id },
        actionLabel: isAr ? 'افتح الهدف' : 'Open goal',
        dedupeKey: `goal:${id}:completed`,
        messageId: 'goal.completed',
        params
      });
    }
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
    const goal = get().goals.find((g) => g.id === goalId);
    const target = goal?.milestones?.find((ms) => ms.id === milestoneId);
    const markedComplete = !!target && !target.isCompleted;

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

    if (markedComplete && goal && target) {
      const params = { title: target.title, goal: goal.title };
      const text = renderNotificationText('goal.milestone', params, { title: target.title }, get().profile.language === 'ar');
      get().notify({
        category: 'goal',
        priority: 'normal',
        title: text.title,
        body: text.body,
        route: { nav: 'goals', entityId: goalId },
        actionLabel: get().profile.language === 'ar' ? 'افتح الهدف' : 'Open goal',
        // Re-completing the same milestone is a new event; each completion has its own key.
        dedupeKey: `goal:${goalId}:milestone:${milestoneId}:${todayStr}`,
        messageId: 'goal.milestone',
        params
      });
    }
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

    // Do not leave dangling references to a goal that no longer exists. This
    // covers top-level tasks/habits AND the nested studio records (books, reading
    // sessions, artwork pieces, art projects, Quran/workout sessions) that copied
    // the goal id from their parent habit.
    const clear = <T extends { linkedGoalId?: string }>(items: T[]): T[] =>
      items.map((it) => (it.linkedGoalId === id ? { ...it, linkedGoalId: undefined } : it));
    const tasks = clear(get().tasks);
    const habits = clearNestedGoalLinks(clear(get().habits), id);
    NuqtaStorageEngine.saveTasks(tasks);
    NuqtaStorageEngine.saveHabits(habits);
    set({ goals: updated, tasks, habits });
  },

  // PROJECT ACTIONS
  createProject: (draft) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const project: Project = {
      id: projectId('prj'),
      title: draft.title?.trim() || (isAr ? 'مشروع جديد' : 'New project'),
      description: draft.description,
      status: draft.status || 'active',
      category: draft.category,
      purpose: draft.purpose,
      desiredOutcome: draft.desiredOutcome,
      definitionOfDone: draft.definitionOfDone,
      goalIds: draft.goalIds || [],
      startDate: draft.startDate,
      targetDate: draft.targetDate,
      phases: draft.phases || [],
      steps: draft.steps || [],
      notes: draft.notes || [],
      resources: draft.resources || [],
      manualProgress: draft.manualProgress,
      blockers: draft.blockers,
      healthNote: draft.healthNote,
      activity: [
        {
          id: projectId('pa'),
          type: 'project_created',
          timestamp: now,
          summary: isAr ? 'أُنشئ المشروع' : 'Project created'
        }
      ],
      createdAt: now,
      updatedAt: now,
      lastMeaningfulUpdateAt: now
    };
    const updated = [...get().projects, project];
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
    return project;
  },

  updateProject: (id, updates) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === id ? { ...p, ...updates, id: p.id, updatedAt: now } : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  setProjectStatus: (id, status) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== id) return p;
      const next = applyStatus(p, status, now);
      const type: ProjectActivityType =
        status === 'completed' ? 'project_completed' : p.status === 'completed' ? 'project_reopened' : 'status_changed';
      return recordActivity(next, type, `${isAr ? 'الحالة' : 'Status'}: ${projectStatusLabel(status, isAr)}`, now);
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  deleteProject: (id) => {
    const updated = get().projects.filter((p) => p.id !== id);
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });

    // Tasks that executed the project are detached, never deleted: the work still
    // happened, and destroying a record because its container was removed would lose
    // history the user never asked to lose.
    const tasks = get().tasks.map((t) =>
      t.projectId === id ? { ...t, projectId: undefined, projectStepId: undefined } : t
    );
    NuqtaStorageEngine.saveTasks(tasks);
    set({ tasks });
  },

  setProjectManualProgress: (id, ratio) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === id
        ? {
            ...p,
            manualProgress:
              ratio === null || !Number.isFinite(ratio) ? undefined : Math.min(1, Math.max(0, ratio)),
            updatedAt: now
          }
        : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  addProjectPhase: (projectIdValue, input) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const { project, phase } = addPhase(p, input, now);
      return recordActivity(
        project,
        'phase_added',
        isAr ? `أُضيفت مرحلة: ${phase.title}` : `Phase added: ${phase.title}`,
        now,
        phase.id
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  updateProjectPhase: (projectIdValue, phaseId, updates) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue
        ? {
            ...p,
            phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...updates, id: ph.id } : ph)),
            updatedAt: now
          }
        : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  deleteProjectPhase: (projectIdValue, phaseId) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? deletePhase(p, phaseId, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  toggleProjectPhaseCompletion: (projectIdValue, phaseId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const target = p.phases.find((ph) => ph.id === phaseId);
      if (!target) return p;
      const completing = !target.completedAt;
      const next = togglePhaseCompletion(p, phaseId, now);
      return recordActivity(
        next,
        completing ? 'phase_completed' : 'phase_reopened',
        completing
          ? isAr
            ? `اكتملت مرحلة: ${target.title}`
            : `Phase completed: ${target.title}`
          : isAr
            ? `أُعيد فتح مرحلة: ${target.title}`
            : `Phase reopened: ${target.title}`,
        now,
        phaseId
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  addProjectStep: (projectIdValue, input) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const { project, step } = addStep(p, input, now);
      return recordActivity(
        project,
        'step_added',
        isAr ? `أُضيفت خطوة: ${step.title}` : `Step added: ${step.title}`,
        now,
        step.id
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  updateProjectStep: (projectIdValue, stepId, updates) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue
        ? {
            ...p,
            steps: p.steps.map((s) => (s.id === stepId ? { ...s, ...updates, id: s.id, updatedAt: now } : s)),
            updatedAt: now
          }
        : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  deleteProjectStep: (projectIdValue, stepId) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? deleteStep(p, stepId, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });

    // A task that named this step keeps existing; only the step pointer is cleared.
    const tasks = get().tasks.map((t) => (t.projectStepId === stepId ? { ...t, projectStepId: undefined } : t));
    NuqtaStorageEngine.saveTasks(tasks);
    set({ tasks });
  },

  setProjectStepStatus: (projectIdValue, stepId, status) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const target = p.steps.find((s) => s.id === stepId);
      if (!target) return p;
      const next = setStepStatus(p, stepId, status, now);
      const type: ProjectActivityType =
        status === 'done' ? 'step_completed' : status === 'blocked' ? 'step_blocked' : 'step_reopened';
      return recordActivity(
        next,
        type,
        status === 'done'
          ? isAr
            ? `أُنجزت خطوة: ${target.title}`
            : `Step completed: ${target.title}`
          : status === 'blocked'
            ? isAr
              ? `تعطّلت خطوة: ${target.title}`
              : `Step blocked: ${target.title}`
            : isAr
              ? `أُعيد فتح خطوة: ${target.title}`
              : `Step reopened: ${target.title}`,
        now,
        stepId
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  moveProjectStep: (projectIdValue, stepId, direction) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? moveStep(p, stepId, direction, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  addProjectNote: (projectIdValue, input) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const { project, note } = addNote(p, input, now);
      const isDecision = note.kind === 'decision';
      return recordActivity(
        project,
        isDecision ? 'decision_recorded' : 'note_added',
        isDecision ? (isAr ? 'سُجّل قرار' : 'Decision recorded') : isAr ? 'أُضيفت ملاحظة' : 'Note added',
        now,
        note.id
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  updateProjectNote: (projectIdValue, noteId, updates) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue
        ? {
            ...p,
            notes: p.notes.map((n) => (n.id === noteId ? { ...n, ...updates, id: n.id, updatedAt: now } : n)),
            updatedAt: now
          }
        : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  deleteProjectNote: (projectIdValue, noteId) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? deleteNote(p, noteId, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  convertProjectNoteToStep: (projectIdValue, noteId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const existing = get().projects.find((p) => p.id === projectIdValue);
    const note = existing?.notes.find((n) => n.id === noteId);
    if (!existing || !note || note.convertedToStepId) return;

    const title = note.title?.trim() || note.body.slice(0, 80);
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const { project, step } = addStep(p, { title, description: note.body, phaseId: note.phaseId }, now);
      const withTrace = markNoteConvertedToStep(project, noteId, step.id, now);
      return recordActivity(
        withTrace,
        'step_added',
        isAr ? `حُوّلت فكرة إلى خطوة: ${step.title}` : `Idea became a step: ${step.title}`,
        now,
        step.id
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  convertProjectNoteToTask: (projectIdValue, noteId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const existing = get().projects.find((p) => p.id === projectIdValue);
    const note = existing?.notes.find((n) => n.id === noteId);
    if (!existing || !note || note.convertedToTaskId) return;

    const task: Task = {
      id: 't-' + crypto.randomUUID().slice(0, 8),
      title: note.title?.trim() || note.body.slice(0, 80),
      notes: note.body,
      priority: 2,
      isTopThree: false,
      status: 'todo',
      tags: [],
      subtasks: [],
      projectId: projectIdValue,
      createdAt: now,
      updatedAt: now
    };
    const tasks = [...get().tasks, task];
    NuqtaStorageEngine.saveTasks(tasks);
    set({ tasks });

    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const withTrace = markNoteConvertedToTask(p, noteId, task.id, now);
      return recordActivity(
        withTrace,
        'task_linked',
        isAr ? `حُوّلت فكرة إلى مهمة: ${task.title}` : `Idea became a task: ${task.title}`,
        now,
        task.id
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  addProjectResource: (projectIdValue, input) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? addResource(p, input, now).project : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  deleteProjectResource: (projectIdValue, resourceId) => {
    const now = new Date().toISOString();
    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? deleteResource(p, resourceId, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  linkProjectToGoal: (projectIdValue, goalId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const goal = get().goals.find((g) => g.id === goalId);
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const next = linkGoal(p, goalId, now);
      if (next === p) return p;
      return recordActivity(
        next,
        'goal_linked',
        isAr ? `رُبط بهدف: ${goal?.title ?? goalId}` : `Linked to goal: ${goal?.title ?? goalId}`,
        now,
        goalId
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  unlinkProjectFromGoal: (projectIdValue, goalId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const goal = get().goals.find((g) => g.id === goalId);
    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const next = unlinkGoal(p, goalId, now);
      if (next === p) return p;
      return recordActivity(
        next,
        'goal_unlinked',
        isAr ? `فُصل عن هدف: ${goal?.title ?? goalId}` : `Unlinked from goal: ${goal?.title ?? goalId}`,
        now,
        goalId
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  linkTaskToProject: (taskId, projectIdValue, stepId) => {
    const now = new Date().toISOString();
    const isAr = get().profile.language === 'ar';
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, projectId: projectIdValue, projectStepId: stepId, updatedAt: now } : t
    );
    NuqtaStorageEngine.saveTasks(tasks);
    set({ tasks });

    const updated = get().projects.map((p) => {
      if (p.id !== projectIdValue) return p;
      const next = stepId ? attachTaskToStep(p, stepId, taskId, now) : { ...p, updatedAt: now };
      return recordActivity(
        next,
        'task_linked',
        isAr ? `رُبطت مهمة: ${task.title}` : `Task linked: ${task.title}`,
        now,
        taskId
      );
    });
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
  },

  unlinkTaskFromProject: (taskId) => {
    const now = new Date().toISOString();
    const task = get().tasks.find((t) => t.id === taskId);
    const projectIdValue = task?.projectId;
    if (!projectIdValue) return;

    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, projectId: undefined, projectStepId: undefined, updatedAt: now } : t
    );
    NuqtaStorageEngine.saveTasks(tasks);
    set({ tasks });

    const updated = get().projects.map((p) =>
      p.id === projectIdValue ? detachTaskFromSteps(p, taskId, now) : p
    );
    NuqtaStorageEngine.saveProjects(updated);
    set({ projects: updated });
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

    const isAr = get().profile.language === 'ar';
    const params = { minutes: sessionDraft.durationMinutes };
    const text = renderNotificationText('focus.complete', params, { title: '' }, isAr);
    get().notify({
      category: 'focus',
      priority: 'low',
      title: text.title,
      body: text.body,
      route: { nav: 'focus' },
      actionLabel: isAr ? 'افتح التركيز' : 'Open focus',
      // One notification per completed session; the session id makes it unique.
      dedupeKey: `focus:session:${newSession.id}`,
      messageId: 'focus.complete',
      params
    });
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
    const before = get().savingsGoals.find((sg) => sg.id === id);
    const updated = get().savingsGoals.map((sg) =>
      sg.id === id ? { ...sg, currentAmount: sg.currentAmount + amountToAdd } : sg
    );
    NuqtaStorageEngine.saveSavingsGoals(updated);
    set({ savingsGoals: updated });
    get().addXP(20);

    // Notify only on the crossing, not on every deposit that happens to sit above target.
    const after = updated.find((sg) => sg.id === id);
    if (before && after && before.currentAmount < after.targetAmount && after.currentAmount >= after.targetAmount) {
      const isAr = get().profile.language === 'ar';
      const params = { title: after.title };
      const text = renderNotificationText('finance.savings', params, { title: after.title }, isAr);
      get().notify({
        category: 'finance',
        priority: 'normal',
        title: text.title,
        body: text.body,
        route: { nav: 'finance' },
        actionLabel: isAr ? 'افتح المال' : 'Open money',
        dedupeKey: `finance:savings:${id}:reached`,
        messageId: 'finance.savings',
        params
      });
    }
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
    const currentTheme = get().profile.theme;
    runLiquidThemeTransition(currentTheme, theme, () => {
      const updated = { ...get().profile, theme };
      NuqtaStorageEngine.saveProfile(updated);
      set({ profile: updated });
    });
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
  },

  // ------------------------------------------------------------------ notifications
  //
  // The store is the only writer of the notification list: the engine decides *what* the
  // next list is, and every mutation persists through the storage engine so a reload keeps
  // the same read/dismissed state. Browser delivery is attempted only when the optional
  // channel is on, so the in-app inbox is always the source of truth.
  notify: (draft) => {
    const { notifications, notificationPreferences } = get();
    const outcome = addNotification(notifications, draft, { prefs: notificationPreferences });
    if (!outcome.added) {
      // A duplicate can still mean expiry pruning happened, so persist when the list moved.
      if (outcome.list !== notifications) {
        NuqtaStorageEngine.saveNotifications(outcome.list);
        set({ notifications: outcome.list });
      }
      return false;
    }

    NuqtaStorageEngine.saveNotifications(outcome.list);
    set({ notifications: outcome.list });

    if (shouldDeliverToBrowser(notificationPreferences, draft.category)) {
      // Fire-and-forget: delivery failure must never block the in-app record.
      void deliverBrowserNotification(outcome.notification, get().profile.language === 'ar');
    }
    return true;
  },

  markNotificationRead: (id) => {
    const next = markReadInList(get().notifications, id);
    if (next === get().notifications) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  },

  markNotificationUnread: (id) => {
    const next = markUnreadInList(get().notifications, id);
    if (next === get().notifications) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  },

  markAllNotificationsRead: () => {
    const next = markAllReadInList(get().notifications);
    if (next === get().notifications) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  },

  dismissNotification: (id) => {
    const next = dismissNotificationInList(get().notifications, id);
    if (next === get().notifications) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  },

  /** Removes already-read, non-dismissed rows. Unread work is never silently discarded. */
  clearReadNotifications: () => {
    const current = get().notifications;
    const next = current.filter((n) => !n.readAt || n.dismissedAt);
    if (next.length === current.length) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  },

  setNotificationPreferences: (prefs) => {
    NuqtaStorageEngine.saveNotificationPreferences(prefs);
    set({ notificationPreferences: prefs });
  },

  pruneNotificationInbox: () => {
    const current = get().notifications;
    const next = pruneNotifications(current);
    if (next.length === current.length) return;
    NuqtaStorageEngine.saveNotifications(next);
    set({ notifications: next });
  }
}));

