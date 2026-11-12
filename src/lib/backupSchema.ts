import type {
  Task,
  Habit,
  Goal,
  FocusSession,
  HealthMetric,
  ExpenseRecord,
  SavingsGoal,
  JournalEntry,
  UserProfile,
  SundayRitualReview,
  HistoryAuditLogEntry
} from '../types';

/** Current backup file format. Bump when the shape changes and keep old readers. */
export const BACKUP_VERSION = 2;
export const BACKUP_APP_ID = 'nuqta';

export interface BackupData {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  healthMetrics: Record<string, HealthMetric>;
  expenses: ExpenseRecord[];
  savingsGoals: SavingsGoal[];
  journalEntries: JournalEntry[];
  /** Absent in a file => the current profile is kept. */
  profile?: Partial<UserProfile>;
  sundayReviews: SundayRitualReview[];
  historyAuditLogs: HistoryAuditLogEntry[];
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export type BackupError =
  | 'invalid_json'
  | 'not_nuqta'
  | 'unsupported_version'
  | 'invalid_section';

export type ParseBackupResult =
  | { ok: true; data: BackupData; version: number; legacy: boolean }
  | { ok: false; error: BackupError; section?: string };

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lenient read guard for the persistence layer: an array whose every element is an
 * object carrying a non-empty string id. This is what `storage.ts` uses when reading
 * localStorage, where a partially-shaped record must still be readable rather than
 * quarantined. Backup validation uses the strict per-entity validators below instead.
 */
export const isRecordList = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((x) => isPlainObject(x) && typeof x.id === 'string' && x.id.length > 0);

/**
 * Lenient read guard for the persistence layer: Record<date, HealthMetric> where every
 * value is an object carrying a string date. Kept intentionally shallow so older records
 * stay readable; backup validation uses `isHealthMapStrict` below.
 */
export const isHealthMap = (v: unknown): boolean =>
  isPlainObject(v) && Object.values(v).every((x) => isPlainObject(x) && typeof x.date === 'string');

// ---------------------------------------------------------------------------
// Low-level field predicates
// ---------------------------------------------------------------------------

const isString = (v: unknown): v is string => typeof v === 'string';
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every(isString);

/** Integer within an inclusive range. */
const isIntBetween = (v: unknown, min: number, max: number): boolean =>
  isNumber(v) && Number.isInteger(v) && v >= min && v <= max;

/** Value must be one of an explicit set of allowed strings. */
const oneOf =
  (values: readonly string[]) =>
  (v: unknown): boolean =>
    typeof v === 'string' && values.includes(v);

/** Optional field: absent is fine, but if present it must satisfy `check`. */
const optional =
  (check: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    v === undefined || check(v);

// Allowed-value sets, mirrored from src/types.
const TASK_STATUS = ['todo', 'in_progress', 'completed', 'deferred', 'archived', 'cancelled'];
const TASK_PRIORITY_LEGACY = ['P1', 'P2', 'P3', 'P4'];
const ENERGY_LEVEL = ['low', 'medium', 'high'];
const HABIT_TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime'];
const HABIT_FREQUENCY = ['daily', 'weekdays', 'custom'];
const HABIT_CATEGORY = ['health', 'mind', 'productivity', 'learning', 'relationships'];
const HABIT_STATUS = ['active', 'paused', 'archived'];
const SPECIALIZED_HABIT_TYPE = ['standard', 'reading', 'workout', 'drawing', 'quran'];
const GOAL_CATEGORY = ['career', 'health', 'finance', 'personal', 'intellect'];
const GOAL_PRIORITY = ['urgent', 'high', 'medium', 'low'];
const GOAL_TIMEFRAME = ['quarterly', 'annual', 'life'];
const GOAL_STATUS = ['active', 'completed', 'paused', 'archived'];
const KEY_RESULT_DATA_SOURCE = [
  'manual',
  'tasks_completed',
  'habit_consistency',
  'reading_books_completed',
  'reading_pages_read',
  'reading_hours',
  'workout_sessions_count',
  'workout_total_reps',
  'workout_total_minutes',
  'drawing_projects_completed',
  'drawing_flow_hours',
  'drawing_artworks_count',
  'quran_ayahs_memorized',
  'quran_surahs_completed',
  'quran_revision_sessions',
  'quran_total_minutes'
];
const EXPENSE_TYPE = ['expense', 'income'];
const EXPENSE_CATEGORY = ['housing', 'food', 'transport', 'health', 'tech', 'leisure', 'savings'];
const PROFILE_THEME = ['dark', 'light', 'midnight-gold', 'monochrome'];
const PROFILE_LANGUAGE = ['en', 'ar'];
const HISTORY_DOMAIN = [
  'tasks',
  'habits',
  'quran',
  'reading',
  'workout',
  'drawing',
  'goals',
  'focus',
  'health',
  'finance',
  'journal',
  'review'
];
const HISTORY_ACTION = [
  'created',
  'completed',
  'archived',
  'restored',
  'milestone',
  'session',
  'streak_freeze',
  'note',
  'status_change'
];
const HISTORY_ENTITY_TYPE = [
  'task',
  'habit',
  'book',
  'workout_routine',
  'art_project',
  'goal',
  'focus_session',
  'journal',
  'finance',
  'quran_session'
];

// Nested specialised-habit value sets (reading / workout / drawing / quran).
const BOOK_STATUS = ['reading', 'completed', 'want_to_read', 'archived'];
const BOOK_CATEGORY = ['mind', 'philosophy', 'productivity', 'science', 'literature', 'biography', 'business', 'other'];
const QURAN_SURAH_STATUS = ['not_started', 'in_progress', 'completed', 'needs_revision'];
const QURAN_SESSION_TYPE = ['new_memorization', 'revision', 'recitation_test'];
const QURAN_RECITATION_QUALITY = ['excellent', 'very_good', 'good', 'needs_reinforcement'];
const ART_MEDIUM = ['sketch', 'ink', 'watercolor', 'digital', 'acrylic', 'mixed', 'oil'];
const PROJECT_STAGE = ['ideation', 'sketching', 'inking', 'coloring', 'polishing', 'completed', 'archived'];
const WORKOUT_TYPE = ['strength', 'cardio', 'hiit', 'mobility', 'bodyweight'];
const WORKOUT_ROUTINE_CATEGORY = ['bodyweight', 'mobility', 'core', 'cardio'];
const EXERCISE_CATEGORY = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'mobility'];
const MUSCLE_MOVEMENT = ['push', 'legs', 'core', 'back_pull', 'mobility', 'cardio'];
const FITNESS_DIFFICULTY = ['beginner', 'intermediate', 'advanced'];

/**
 * Priority is stored as a number 1-4; the compact "P1".."P4" spelling is also
 * accepted so that older/hand-authored files keep importing.
 */
const isPriorityLevel = (v: unknown): boolean => isIntBetween(v, 1, 4) || oneOf(TASK_PRIORITY_LEGACY)(v);

// ---------------------------------------------------------------------------
// Per-entity validators
// ---------------------------------------------------------------------------

function isSubtask(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && isString(v.title) && isBoolean(v.completed);
}

function isTask(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isString(v.title)) return false;
  if (!isPriorityLevel(v.priority)) return false;
  if (!oneOf(TASK_STATUS)(v.status)) return false;
  if (!optional(isBoolean)(v.isTopThree)) return false;
  if (!optional(isString)(v.notes)) return false;
  if (!optional(isString)(v.scheduledDate)) return false;
  if (!optional(isString)(v.scheduledTime)) return false;
  if (!optional(isNumber)(v.estimatedMinutes)) return false;
  if (!optional(isStringArray)(v.tags)) return false;
  if (!optional((x) => Array.isArray(x) && x.every(isSubtask))(v.subtasks)) return false;
  if (!optional(isStringArray)(v.blockedBy)) return false;
  if (!optional(isString)(v.linkedGoalId)) return false;
  if (!optional(oneOf(ENERGY_LEVEL))(v.energyLevelRequired)) return false;
  if (!optional(isString)(v.completedAt)) return false;
  if (!optional(isBoolean)(v.isArchived)) return false;
  if (!optional(isString)(v.archivedAt)) return false;
  if (!optional(isString)(v.cancelledAt)) return false;
  if (!optional(isString)(v.createdAt)) return false;
  if (!optional(isString)(v.updatedAt)) return false;
  return true;
}

function isKeyResult(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    isNumber(v.targetValue) &&
    isNumber(v.currentValue) &&
    isString(v.unit) &&
    optional(isNumber)(v.startValue) &&
    optional(oneOf(KEY_RESULT_DATA_SOURCE))(v.dataSource) &&
    optional(isString)(v.notes)
  );
}

function isGoalMilestone(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    isBoolean(v.isCompleted) &&
    optional(isString)(v.targetDate) &&
    optional(isString)(v.completedDate)
  );
}

function isGoal(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isString(v.title)) return false;
  if (!oneOf(GOAL_CATEGORY)(v.category)) return false;
  if (!oneOf(GOAL_TIMEFRAME)(v.timeframe)) return false;
  if (!oneOf(GOAL_STATUS)(v.status)) return false;
  if (!optional(oneOf(GOAL_PRIORITY))(v.priority)) return false;
  if (!optional(isString)(v.description)) return false;
  if (!optional(isString)(v.startDate)) return false;
  if (!optional(isString)(v.deadline)) return false;
  if (!optional(isString)(v.visionNotes)) return false;
  if (!optional(isString)(v.color)) return false;
  if (!optional(isString)(v.archivedAt)) return false;
  if (!optional(isString)(v.createdAt)) return false;
  if (!optional(isString)(v.updatedAt)) return false;
  if (!optional(isStringArray)(v.visionImages)) return false;
  if (!optional(isStringArray)(v.linkedTaskIds)) return false;
  if (!optional(isStringArray)(v.linkedHabitIds)) return false;
  if (!optional(isStringArray)(v.linkedBookIds)) return false;
  if (!optional(isStringArray)(v.linkedArtProjectIds)) return false;
  // keyResults is required by the type; accept only a well-formed array.
  if (!Array.isArray(v.keyResults) || !v.keyResults.every(isKeyResult)) return false;
  if (!optional((x) => Array.isArray(x) && x.every(isGoalMilestone))(v.milestones)) return false;
  return true;
}

function isBookQuote(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.quote) &&
    isString(v.date) &&
    optional(isString)(v.bookId) &&
    optional(isString)(v.bookTitle) &&
    optional(isString)(v.author) &&
    optional(isNumber)(v.page)
  );
}

function isBook(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    isString(v.author) &&
    isNumber(v.totalPages) &&
    isNumber(v.currentPage) &&
    oneOf(BOOK_STATUS)(v.status) &&
    optional(oneOf(BOOK_CATEGORY))(v.category) &&
    optional(isString)(v.coverColor) &&
    optional(isNumber)(v.rating) &&
    optional(isString)(v.notes) &&
    optional(isString)(v.startDate) &&
    optional(isString)(v.completedDate) &&
    optional(isString)(v.linkedGoalId) &&
    optional(isString)(v.archivedAt)
  );
}

function isReadingSession(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.date) &&
    isString(v.bookId) &&
    isString(v.bookTitle) &&
    isNumber(v.pagesRead) &&
    isNumber(v.durationMinutes) &&
    isNumber(v.speedPagesPerHour) &&
    optional(isNumber)(v.startPage) &&
    optional(isNumber)(v.endPage) &&
    optional(isString)(v.notes) &&
    optional(isString)(v.quoteSnippet) &&
    optional(isString)(v.linkedGoalId)
  );
}

function isReadingData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isBook))(v.books) &&
    optional((x) => Array.isArray(x) && x.every(isReadingSession))(v.sessions) &&
    optional((x) => Array.isArray(x) && x.every(isBookQuote))(v.quotes) &&
    optional(isString)(v.activeBookId) &&
    optional(isNumber)(v.dailyTargetPages) &&
    optional(isNumber)(v.weeklyTargetPages) &&
    optional(isNumber)(v.annualTargetBooks) &&
    optional(isNumber)(v.totalPagesRead) &&
    optional(isNumber)(v.totalReadingMinutes)
  );
}

function isExerciseSet(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNumber(v.setNumber) &&
    isNumber(v.reps) &&
    isBoolean(v.completed) &&
    optional(isNumber)(v.weightKg) &&
    optional(isNumber)(v.restSeconds)
  );
}

function isExerciseEntry(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.name) &&
    oneOf(EXERCISE_CATEGORY)(v.category) &&
    Array.isArray(v.sets) &&
    v.sets.every(isExerciseSet) &&
    optional(oneOf(MUSCLE_MOVEMENT))(v.movement) &&
    optional(isString)(v.notes)
  );
}

function isWorkoutSession(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.date) &&
    isString(v.title) &&
    oneOf(WORKOUT_TYPE)(v.workoutType) &&
    isNumber(v.durationMinutes) &&
    isNumber(v.volumeKg) &&
    isIntBetween(v.intensityRating, 1, 5) &&
    Array.isArray(v.exercises) &&
    v.exercises.every(isExerciseEntry) &&
    optional(isString)(v.routineId) &&
    optional(isNumber)(v.totalReps) &&
    optional(oneOf(FITNESS_DIFFICULTY))(v.difficultyLevel) &&
    optional(isString)(v.notes) &&
    optional(isNumber)(v.caloriesBurned) &&
    optional(isString)(v.linkedGoalId)
  );
}

function isWorkoutRoutine(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.name) &&
    isString(v.nameAr) &&
    oneOf(FITNESS_DIFFICULTY)(v.targetLevel) &&
    isNumber(v.estimatedMinutes) &&
    oneOf(WORKOUT_ROUTINE_CATEGORY)(v.category) &&
    Array.isArray(v.exercises) &&
    v.exercises.every(isExerciseEntry) &&
    optional(isString)(v.description) &&
    optional(isString)(v.descriptionAr) &&
    optional(isBoolean)(v.isCustom) &&
    optional(isBoolean)(v.isArchived) &&
    optional(isString)(v.archivedAt)
  );
}

function isWorkoutData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isWorkoutSession))(v.sessions) &&
    optional((x) => Array.isArray(x) && x.every(isWorkoutRoutine))(v.customRoutines) &&
    optional(isNumber)(v.weeklyTargetSessions) &&
    optional(isNumber)(v.monthlyTargetReps) &&
    optional(isNumber)(v.totalReps) &&
    optional(isNumber)(v.totalVolumeKg) &&
    optional(isNumber)(v.totalMinutes) &&
    optional(isNumber)(v.totalWorkouts) &&
    optional(isString)(v.favoriteRoutine)
  );
}

function isArtProject(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    oneOf(PROJECT_STAGE)(v.stage) &&
    oneOf(ART_MEDIUM)(v.medium) &&
    isString(v.startedDate) &&
    isNumber(v.totalMinutesSpent) &&
    isNumber(v.sessionsCount) &&
    optional(isString)(v.description) &&
    optional(isString)(v.completedDate) &&
    optional(isString)(v.thumbnailColor) &&
    optional(isStringArray)(v.tags) &&
    optional(isString)(v.notes) &&
    optional(isString)(v.linkedGoalId) &&
    optional(isBoolean)(v.isArchived) &&
    optional(isString)(v.archivedAt)
  );
}

function isArtworkPiece(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    oneOf(ART_MEDIUM)(v.medium) &&
    isNumber(v.durationMinutes) &&
    isString(v.completedDate) &&
    optional(isString)(v.projectId) &&
    optional(isString)(v.projectTitle) &&
    optional(isString)(v.notes) &&
    optional(isString)(v.promptTheme) &&
    optional(oneOf(PROJECT_STAGE))(v.stage) &&
    optional(isString)(v.linkedGoalId)
  );
}

function isDrawingData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isArtworkPiece))(v.pieces) &&
    optional((x) => Array.isArray(x) && x.every(isArtProject))(v.projects) &&
    optional(isNumber)(v.weeklyTargetHours) &&
    optional(isNumber)(v.totalDrawingMinutes) &&
    optional(isNumber)(v.totalSketches) &&
    optional(isString)(v.favoriteMedium)
  );
}

function isAyahRange(v: unknown): boolean {
  return isPlainObject(v) && isNumber(v.start) && isNumber(v.end);
}

function isSurahMemorizationState(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isIntBetween(v.surahNumber, 1, 114) &&
    oneOf(QURAN_SURAH_STATUS)(v.status) &&
    Array.isArray(v.memorizedAyahsRanges) &&
    v.memorizedAyahsRanges.every(isAyahRange) &&
    isNumber(v.memorizedAyahsCount) &&
    optional(isString)(v.lastReviewedDate) &&
    optional((x) => isIntBetween(x, 1, 5))(v.masteryRating) &&
    optional(isString)(v.notes)
  );
}

function isQuranSession(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.date) &&
    oneOf(QURAN_SESSION_TYPE)(v.type) &&
    isIntBetween(v.surahNumber, 1, 114) &&
    isString(v.surahName) &&
    isNumber(v.ayahStart) &&
    isNumber(v.ayahEnd) &&
    isNumber(v.ayahCount) &&
    isNumber(v.durationMinutes) &&
    oneOf(QURAN_RECITATION_QUALITY)(v.quality) &&
    optional(isString)(v.notes) &&
    optional(isNumber)(v.mistakesCount) &&
    optional(isString)(v.linkedGoalId)
  );
}

function isQuranRevisionSchedule(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNumber(v.revisionCycleDays) &&
    Array.isArray(v.currentReviewSurahs) &&
    v.currentReviewSurahs.every((n) => isIntBetween(n, 1, 114)) &&
    isNumber(v.targetDailyAyahs) &&
    isNumber(v.weeklyTargetRevisionMinutes) &&
    optional(isNumber)(v.dailyWirdJuz)
  );
}

function isQuranData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isSurahMemorizationState))(v.surahs) &&
    optional((x) => Array.isArray(x) && x.every(isQuranSession))(v.sessions) &&
    optional(isQuranRevisionSchedule)(v.revisionSchedule) &&
    optional(isNumber)(v.totalAyahsMemorized) &&
    optional(isNumber)(v.totalSurahsCompleted) &&
    optional(isNumber)(v.totalMemorizationMinutes) &&
    optional(isNumber)(v.totalRevisionMinutes) &&
    optional(isNumber)(v.dailyTargetAyahs) &&
    optional(isNumber)(v.activeSurahNumber)
  );
}

function isHabit(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isString(v.name)) return false;
  if (!oneOf(HABIT_TIME_OF_DAY)(v.timeOfDay)) return false;
  if (!oneOf(HABIT_FREQUENCY)(v.frequency)) return false;
  if (!oneOf(HABIT_CATEGORY)(v.category)) return false;
  if (!isNumber(v.targetPerDay)) return false;
  if (!optional(isString)(v.anchor)) return false;
  if (!optional(isString)(v.location)) return false;
  if (!optional((x) => Array.isArray(x) && x.every((d) => isIntBetween(d, 0, 6)))(v.customDays)) return false;
  if (!optional(isString)(v.unit)) return false;
  if (!optional(isNumber)(v.currentStreak)) return false;
  if (!optional(isNumber)(v.longestStreak)) return false;
  if (!optional(isNumber)(v.freezesRemaining)) return false;
  if (!optional(isStringArray)(v.freezesUsedDates)) return false;
  if (!optional(isStringArray)(v.completedDates)) return false;
  if (!optional(isString)(v.stackParentHabitId)) return false;
  if (!optional(isString)(v.linkedGoalId)) return false;
  if (!optional(isBoolean)(v.isArchived)) return false;
  if (!optional(isString)(v.archivedAt)) return false;
  if (!optional(oneOf(HABIT_STATUS))(v.status)) return false;
  if (!optional(isString)(v.createdAt)) return false;
  if (!optional(oneOf(SPECIALIZED_HABIT_TYPE))(v.specializedType)) return false;
  if (!optional(isReadingData)(v.readingData)) return false;
  if (!optional(isWorkoutData)(v.workoutData)) return false;
  if (!optional(isDrawingData)(v.drawingData)) return false;
  if (!optional(isQuranData)(v.quranData)) return false;
  return true;
}

function isFocusSession(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isNumber(v.durationMinutes)) return false;
  if (!isNumber(v.targetMinutes)) return false;
  if (!isNumber(v.interruptionCount)) return false;
  if (!isIntBetween(v.preMood, 1, 5)) return false;
  if (!isIntBetween(v.postMood, 1, 5)) return false;
  if (!isIntBetween(v.productivityScore, 1, 5)) return false;
  if (!isString(v.completedAt)) return false;
  if (!optional(isString)(v.taskId)) return false;
  if (!optional(isString)(v.taskTitle)) return false;
  if (!optional(isString)(v.notes)) return false;
  return true;
}

function isExpense(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    isNumber(v.amount) &&
    oneOf(EXPENSE_TYPE)(v.type) &&
    oneOf(EXPENSE_CATEGORY)(v.category) &&
    isString(v.date) &&
    optional(isString)(v.notes)
  );
}

function isSavingsGoal(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    isNumber(v.targetAmount) &&
    isNumber(v.currentAmount) &&
    optional(isString)(v.targetDate) &&
    optional(isString)(v.icon)
  );
}

function isHealthMetric(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isString(v.date) &&
    isNumber(v.sleepHours) &&
    isIntBetween(v.sleepQuality, 0, 5) &&
    isNumber(v.hydrationMl) &&
    isNumber(v.targetHydrationMl) &&
    isBoolean(v.workoutLogged) &&
    isIntBetween(v.moodRating, 0, 5) &&
    optional(isString)(v.workoutType) &&
    optional(isNumber)(v.workoutMinutes) &&
    optional(isNumber)(v.weightKg) &&
    optional(isNumber)(v.cycleDay) &&
    optional(isNumber)(v.energyScore)
  );
}

function isJournalEntry(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.date) &&
    isString(v.whatWentWell) &&
    isString(v.whatDrainedEnergy) &&
    isString(v.planForTomorrow) &&
    isStringArray(v.gratitudeList) &&
    isIntBetween(v.mood, 1, 5) &&
    isBoolean(v.isEncrypted) &&
    isString(v.createdAt) &&
    optional(isString)(v.encryptedPayload)
  );
}

function isSundayReview(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.date) &&
    isStringArray(v.wins) &&
    isStringArray(v.lessons) &&
    isString(v.energyAudit) &&
    isStringArray(v.topPrioritiesNextWeek) &&
    isString(v.completedAt)
  );
}

function isHistoryAuditLog(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.timestamp) &&
    oneOf(HISTORY_DOMAIN)(v.domain) &&
    oneOf(HISTORY_ACTION)(v.action) &&
    isString(v.title) &&
    isString(v.entityId) &&
    oneOf(HISTORY_ENTITY_TYPE)(v.entityType) &&
    optional(isString)(v.description) &&
    optional(isPlainObject)(v.metadata)
  );
}

/** A profile is a partial record: every field is optional, but present fields must be well-typed. */
function isProfile(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional(isString)(v.name) &&
    optional(isString)(v.email) &&
    optional(oneOf(PROFILE_THEME))(v.theme) &&
    optional(oneOf(PROFILE_LANGUAGE))(v.language) &&
    optional(isNumber)(v.experiencePoints) &&
    optional(isNumber)(v.level) &&
    optional(isBoolean)(v.biometricLocked) &&
    optional(isBoolean)(v.encryptionPassphraseSet) &&
    optional(isBoolean)(v.weeklySundayReviewDue) &&
    optional(isString)(v.lastSundayReviewDate)
  );
}

/** Strict backup check: every value is a complete metric keyed by its own date. */
function isHealthMapStrict(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    Object.entries(v).every(([key, metric]) => isHealthMetric(metric) && (metric as HealthMetric).date === key)
  );
}

// ---------------------------------------------------------------------------
// Section -> validator table
// ---------------------------------------------------------------------------

const LIST_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  tasks: isTask,
  habits: isHabit,
  goals: isGoal,
  focusSessions: isFocusSession,
  expenses: isExpense,
  savingsGoals: isSavingsGoal,
  journalEntries: isJournalEntry,
  sundayReviews: isSundayReview,
  historyAuditLogs: isHistoryAuditLog
};

const LIST_SECTIONS = Object.keys(LIST_VALIDATORS);

/** Sections whose presence identifies a legacy (v1, flat) NUQTA backup. */
const LEGACY_MARKERS = ['tasks', 'habits', 'goals'] as const;

/** Does `value` reference a goal id that exists in the imported backup? */
function isKnownGoal(value: unknown, goalIds: Set<string>): boolean {
  return typeof value === 'string' && goalIds.has(value);
}

/**
 * Relationship checks. A backup is only valid when every cross-entity reference it
 * contains resolves inside the SAME imported backup, so a restore can never leave a
 * dangling link behind:
 *   - goal -> linkedTaskIds / linkedHabitIds must resolve to entities present in the
 *     file (skipped when the referenced section is absent from the file, because such a
 *     file only replaces the sections it actually contains);
 *   - any entity carrying `linkedGoalId` must point at a goal in the file (skipped when
 *     the file contains no goals at all).
 * Returns the offending field name, or null when every relationship resolves.
 */
function findDanglingReference(data: BackupData, present: ReadonlySet<string>): string | null {
  const goals = data.goals ?? [];
  const goalIds = new Set(goals.map((g) => g.id));
  const taskIds = new Set((data.tasks ?? []).map((t) => t.id));
  const habitIds = new Set((data.habits ?? []).map((h) => h.id));
  const hasGoals = present.has('goals');

  for (const goal of goals) {
    if (present.has('tasks') && (goal.linkedTaskIds ?? []).some((id) => !taskIds.has(id))) return 'linkedTaskIds';
    if (present.has('habits') && (goal.linkedHabitIds ?? []).some((id) => !habitIds.has(id))) return 'linkedHabitIds';
  }

  if (hasGoals) {
    const linked = (e: { linkedGoalId?: string } | FocusSession) => (e as { linkedGoalId?: string }).linkedGoalId;
    for (const entity of [...(data.tasks ?? []), ...(data.habits ?? []), ...(data.focusSessions ?? [])]) {
      const id = linked(entity);
      if (id !== undefined && !isKnownGoal(id, goalIds)) return 'linkedGoalId';
    }
    for (const habit of data.habits ?? []) {
      if (habit.specializedType === 'reading') {
        for (const book of habit.readingData?.books ?? []) {
          if (book.linkedGoalId !== undefined && !isKnownGoal(book.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
        for (const session of habit.readingData?.sessions ?? []) {
          if (session.linkedGoalId !== undefined && !isKnownGoal(session.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
      }
      if (habit.specializedType === 'workout') {
        for (const session of habit.workoutData?.sessions ?? []) {
          if (session.linkedGoalId !== undefined && !isKnownGoal(session.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
      }
      if (habit.specializedType === 'drawing') {
        for (const project of habit.drawingData?.projects ?? []) {
          if (project.linkedGoalId !== undefined && !isKnownGoal(project.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
        for (const piece of habit.drawingData?.pieces ?? []) {
          if (piece.linkedGoalId !== undefined && !isKnownGoal(piece.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
      }
      if (habit.specializedType === 'quran') {
        for (const session of habit.quranData?.sessions ?? []) {
          if (session.linkedGoalId !== undefined && !isKnownGoal(session.linkedGoalId, goalIds)) return 'linkedGoalId';
        }
      }
    }
  }

  return null;
}

/**
 * Validate a backup file COMPLETELY before anything is written.
 * Accepts the current envelope ({ app, version, exportedAt, data }) and the legacy flat
 * v1 shape. Every supported entity type is checked field-by-field, including allowed
 * values, nested structures and relevant cross-entity relationships.
 */
export function parseBackup(jsonString: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!isPlainObject(raw)) return { ok: false, error: 'not_nuqta' };

  let source: Record<string, unknown>;
  let version: number;
  let legacy = false;

  if (raw.app !== undefined) {
    if (raw.app !== BACKUP_APP_ID) return { ok: false, error: 'not_nuqta' };
    if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) {
      return { ok: false, error: 'unsupported_version' };
    }
    if (raw.version > BACKUP_VERSION) return { ok: false, error: 'unsupported_version' };
    // The envelope metadata is required and must be well-formed.
    if (!isNonEmptyString(raw.exportedAt)) return { ok: false, error: 'invalid_section', section: 'exportedAt' };
    if (!isPlainObject(raw.data)) return { ok: false, error: 'invalid_section', section: 'data' };
    source = raw.data;
    version = raw.version;
  } else {
    // Legacy v1: flat keys. Must clearly look like a NUQTA export, not any JSON.
    if (!LEGACY_MARKERS.some((k) => Array.isArray(raw[k]))) return { ok: false, error: 'not_nuqta' };
    source = raw;
    version = 1;
    legacy = true;
  }

  const data: BackupData = {
    tasks: [],
    habits: [],
    goals: [],
    focusSessions: [],
    healthMetrics: {},
    expenses: [],
    savingsGoals: [],
    journalEntries: [],
    sundayReviews: [],
    historyAuditLogs: []
  };
  const present = new Set<string>();

  for (const key of LIST_SECTIONS) {
    const value = source[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return { ok: false, error: 'invalid_section', section: key };
    const isValid = LIST_VALIDATORS[key];
    if (!value.every(isValid)) return { ok: false, error: 'invalid_section', section: key };
    (data as unknown as Record<string, unknown>)[key] = value;
    present.add(key);
  }

  if (source.healthMetrics !== undefined) {
    if (!isHealthMapStrict(source.healthMetrics)) {
      return { ok: false, error: 'invalid_section', section: 'healthMetrics' };
    }
    data.healthMetrics = source.healthMetrics as Record<string, HealthMetric>;
  }

  if (source.profile !== undefined) {
    if (!isProfile(source.profile)) {
      return { ok: false, error: 'invalid_section', section: 'profile' };
    }
    data.profile = source.profile as Partial<UserProfile>;
  }

  const dangling = findDanglingReference(data, present);
  if (dangling !== null) return { ok: false, error: 'invalid_section', section: dangling };

  return { ok: true, data, version, legacy };
}

export function buildBackupFile(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}
