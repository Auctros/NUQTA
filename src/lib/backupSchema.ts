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
import { isDateKey } from './dateKey';

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

/** Array whose every element is an object with a non-empty string id. */
export const isRecordList = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((x) => isPlainObject(x) && typeof x.id === 'string' && x.id.length > 0);

/** Record<date, HealthMetric>: every value is an object carrying a string date. */
export const isHealthMap = (v: unknown): boolean =>
  isPlainObject(v) && Object.values(v).every((x) => isPlainObject(x) && typeof x.date === 'string');

// ------------------------------------------------------------------
// Primitive type guards
// ------------------------------------------------------------------

const isString = (v: unknown): v is string => typeof v === 'string';
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(isFiniteNumber);
const isInteger = (v: unknown): v is number => Number.isInteger(v);

/** True for a real calendar date written as "YYYY-MM-DD" (local). */
const isValidDateKey = (v: unknown): v is string => isDateKey(v);

/** True for "HH:mm" local time. */
const isValidTimeKey = (v: unknown): v is string =>
  isString(v) && /^\d{2}:\d{2}$/.test(v) && Number(v.slice(0, 2)) <= 23 && Number(v.slice(3, 5)) <= 59;

/** True if `v` is one of the allowed enum values. */
const isOneOf = <T extends string | number>(allowed: ReadonlySet<T>) => (v: unknown): v is T =>
  allowed.has(v as T);

// ------------------------------------------------------------------
// Enum validators
// ------------------------------------------------------------------

const PRIORITY_LEVELS = new Set([1, 2, 3, 4]);
const isPriorityLevel = isOneOf(PRIORITY_LEVELS);

const TASK_STATUSES = new Set(['todo', 'in_progress', 'completed', 'deferred', 'archived', 'cancelled']);
const isTaskStatus = isOneOf(TASK_STATUSES);

const HABIT_TIME_OF_DAY = new Set(['morning', 'afternoon', 'evening', 'anytime']);
const isHabitTimeOfDay = isOneOf(HABIT_TIME_OF_DAY);

const HABIT_FREQUENCY = new Set(['daily', 'weekdays', 'custom']);
const isHabitFrequency = isOneOf(HABIT_FREQUENCY);

const HABIT_CATEGORY = new Set(['health', 'mind', 'productivity', 'learning', 'relationships']);
const isHabitCategory = isOneOf(HABIT_CATEGORY);

const SPECIALIZED_HABIT_TYPE = new Set(['standard', 'reading', 'workout', 'drawing', 'quran']);
const isSpecializedHabitType = isOneOf(SPECIALIZED_HABIT_TYPE);

const GOAL_CATEGORY = new Set(['career', 'health', 'finance', 'personal', 'intellect']);
const isGoalCategory = isOneOf(GOAL_CATEGORY);

const GOAL_TIMEFRAME = new Set(['quarterly', 'annual', 'life']);
const isGoalTimeframe = isOneOf(GOAL_TIMEFRAME);

const GOAL_STATUS = new Set(['active', 'completed', 'paused', 'archived']);
const isGoalStatus = isOneOf(GOAL_STATUS);

const GOAL_PRIORITY = new Set(['urgent', 'high', 'medium', 'low']);
const isGoalPriority = isOneOf(GOAL_PRIORITY);

const FOCUS_SESSION_INTERACTION = new Set([1, 2, 3, 4, 5]);
const isFocusInteraction = isOneOf(FOCUS_SESSION_INTERACTION);

const EXPENSE_TYPE = new Set(['expense', 'income']);
const isExpenseType = isOneOf(EXPENSE_TYPE);

const EXPENSE_CATEGORY = new Set(['housing', 'food', 'transport', 'health', 'tech', 'leisure', 'savings']);
const isExpenseCategory = isOneOf(EXPENSE_CATEGORY);

const PROFILE_THEME = new Set(['dark', 'light', 'midnight-gold', 'monochrome']);
const isProfileTheme = isOneOf(PROFILE_THEME);

const PROFILE_LANGUAGE = new Set(['en', 'ar']);
const isProfileLanguage = isOneOf(PROFILE_LANGUAGE);

const PROJECT_STAGE = new Set(['ideation', 'sketching', 'inking', 'coloring', 'polishing', 'completed', 'archived']);
const isProjectStage = isOneOf(PROJECT_STAGE);

const ART_MEDIUM = new Set(['sketch', 'ink', 'watercolor', 'digital', 'acrylic', 'mixed', 'oil']);
const isArtMedium = isOneOf(ART_MEDIUM);

const BOOK_CATEGORY = new Set(['mind', 'philosophy', 'productivity', 'science', 'literature', 'biography', 'business', 'other']);
const isBookCategory = isOneOf(BOOK_CATEGORY);

const MUSCLE_MOVEMENT = new Set(['push', 'legs', 'core', 'back_pull', 'mobility', 'cardio']);
const isMuscleMovement = isOneOf(MUSCLE_MOVEMENT);

const FITNESS_DIFFICULTY = new Set(['beginner', 'intermediate', 'advanced']);
const isFitnessDifficulty = isOneOf(FITNESS_DIFFICULTY);

const HOME_EQUIPMENT = new Set(['bodyweight_only', 'mat', 'pullup_bar', 'resistance_band', 'chair_elevated', 'light_dumbbells']);
const isHomeEquipment = isOneOf(HOME_EQUIPMENT);

const WORKOUT_TYPE = new Set(['strength', 'cardio', 'hiit', 'mobility', 'bodyweight']);
const isWorkoutType = isOneOf(WORKOUT_TYPE);

const QURAN_SURAH_STATUS = new Set(['not_started', 'in_progress', 'completed', 'needs_revision']);
const isQuranSurahStatus = isOneOf(QURAN_SURAH_STATUS);

const QURAN_SESSION_TYPE = new Set(['new_memorization', 'revision', 'recitation_test']);
const isQuranSessionType = isOneOf(QURAN_SESSION_TYPE);

const QURAN_RECITATION_QUALITY = new Set(['excellent', 'very_good', 'good', 'needs_reinforcement']);
const isQuranRecitationQuality = isOneOf(QURAN_RECITATION_QUALITY);

const UNIVERSAL_HISTORY_DOMAIN = new Set(['tasks', 'habits', 'quran', 'reading', 'workout', 'drawing', 'goals', 'focus', 'health', 'finance', 'journal', 'review']);
const isUniversalHistoryDomain = isOneOf(UNIVERSAL_HISTORY_DOMAIN);

const UNIVERSAL_HISTORY_EVENT_TYPE = new Set(['created', 'completed', 'archived', 'restored', 'milestone', 'session', 'streak_freeze', 'note', 'status_change']);
const isUniversalHistoryEventType = isOneOf(UNIVERSAL_HISTORY_EVENT_TYPE);

const ENTITY_TYPE = new Set(['task', 'habit', 'book', 'workout_routine', 'art_project', 'goal', 'focus_session', 'journal', 'finance', 'quran_session']);
const isEntityType = isOneOf(ENTITY_TYPE);

const KEY_RESULT_DATA_SOURCE = new Set([
  'manual', 'tasks_completed', 'habit_consistency', 'reading_books_completed', 'reading_pages_read',
  'reading_hours', 'workout_sessions_count', 'workout_total_reps', 'workout_total_minutes',
  'drawing_projects_completed', 'drawing_flow_hours', 'drawing_artworks_count',
  'quran_ayahs_memorized', 'quran_surahs_completed', 'quran_revision_sessions', 'quran_total_minutes'
]);
const isKeyResultDataSource = isOneOf(KEY_RESULT_DATA_SOURCE);

// ------------------------------------------------------------------
// Nested structure validators
// ------------------------------------------------------------------

const isSubtask = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  typeof v.completed === 'boolean';

const isKeyResult = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isFiniteNumber(v.targetValue) &&
  isFiniteNumber(v.currentValue) &&
  isNonEmptyString(v.unit) &&
  (v.dataSource === undefined || isKeyResultDataSource(v.dataSource));

const isGoalMilestone = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  typeof v.isCompleted === 'boolean' &&
  (v.targetDate === undefined || isValidDateKey(v.targetDate)) &&
  (v.completedDate === undefined || isValidDateKey(v.completedDate));

const isExerciseSet = (v: unknown): boolean =>
  isPlainObject(v) &&
  typeof v.setNumber === 'number' &&
  typeof v.reps === 'number' &&
  typeof v.completed === 'boolean' &&
  (v.weightKg === undefined || typeof v.weightKg === 'number') &&
  (v.restSeconds === undefined || typeof v.restSeconds === 'number');

const isExerciseEntry = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.name) &&
  isNonEmptyString(v.category) &&
  Array.isArray(v.sets) &&
  v.sets.every(isExerciseSet) &&
  (v.movement === undefined || isMuscleMovement(v.movement));

const isWorkoutRoutine = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.name) &&
  isNonEmptyString(v.nameAr) &&
  isFitnessDifficulty(v.targetLevel) &&
  isFiniteNumber(v.estimatedMinutes) &&
  isOneOf(new Set(['bodyweight', 'mobility', 'core', 'cardio']))(v.category) &&
  Array.isArray(v.exercises) &&
  v.exercises.every(isExerciseEntry);

const isWorkoutSessionLog = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isWorkoutType(v.workoutType) &&
  isFiniteNumber(v.durationMinutes) &&
  typeof v.interruptionCount === 'number' &&
  typeof v.totalReps === 'number' &&
  typeof v.volumeKg === 'number' &&
  isFocusInteraction(v.intensityRating) &&
  Array.isArray(v.exercises) &&
  v.exercises.every(isExerciseEntry) &&
  (v.difficultyLevel === undefined || isFitnessDifficulty(v.difficultyLevel)) &&
  (v.caloriesBurned === undefined || typeof v.caloriesBurned === 'number') &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId));

const isAyahRange = (v: unknown): boolean =>
  isPlainObject(v) &&
  typeof v.start === 'number' &&
  typeof v.end === 'number';

const isSurahMemorizationState = (v: unknown): boolean =>
  isPlainObject(v) &&
  typeof v.surahNumber === 'number' &&
  isQuranSurahStatus(v.status) &&
  Array.isArray(v.memorizedAyahsRanges) &&
  v.memorizedAyahsRanges.every(isAyahRange) &&
  typeof v.memorizedAyahsCount === 'number' &&
  (v.lastReviewedDate === undefined || isValidDateKey(v.lastReviewedDate)) &&
  (v.masteryRating === undefined || isOneOf(new Set([1, 2, 3, 4, 5]))(v.masteryRating));

const isQuranSessionLog = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isValidDateKey(v.date) &&
  isQuranSessionType(v.type) &&
  typeof v.surahNumber === 'number' &&
  isNonEmptyString(v.surahName) &&
  typeof v.ayahStart === 'number' &&
  typeof v.ayahEnd === 'number' &&
  typeof v.ayahCount === 'number' &&
  typeof v.durationMinutes === 'number' &&
  isQuranRecitationQuality(v.quality) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId));

const isQuranRevisionSchedule = (v: unknown): boolean =>
  isPlainObject(v) &&
  (v.dailyWirdJuz === undefined || typeof v.dailyWirdJuz === 'number') &&
  typeof v.revisionCycleDays === 'number' &&
  Array.isArray(v.currentReviewSurahs) &&
  v.currentReviewSurahs.every((x: unknown) => typeof x === 'number') &&
  typeof v.targetDailyAyahs === 'number' &&
  typeof v.weeklyTargetRevisionMinutes === 'number';

const isQuranHabitData = (v: unknown): boolean =>
  isPlainObject(v) &&
  Array.isArray(v.surahs) &&
  v.surahs.every(isSurahMemorizationState) &&
  Array.isArray(v.sessions) &&
  v.sessions.every(isQuranSessionLog) &&
  isQuranRevisionSchedule(v.revisionSchedule) &&
  typeof v.totalAyahsMemorized === 'number' &&
  typeof v.totalSurahsCompleted === 'number' &&
  typeof v.totalMemorizationMinutes === 'number' &&
  typeof v.totalRevisionMinutes === 'number' &&
  typeof v.dailyTargetAyahs === 'number' &&
  typeof v.activeSurahNumber === 'number';

const isArtProject = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isProjectStage(v.stage) &&
  isArtMedium(v.medium) &&
  isValidDateKey(v.startedDate) &&
  isFiniteNumber(v.totalMinutesSpent) &&
  typeof v.sessionsCount === 'number' &&
  (v.completedDate === undefined || isValidDateKey(v.completedDate)) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId)) &&
  (v.archivedAt === undefined || isValidDateKey(v.archivedAt));

const isArtworkPiece = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isArtMedium(v.medium) &&
  isValidDateKey(v.completedDate) &&
  typeof v.durationMinutes === 'number' &&
  (v.projectId === undefined || isString(v.projectId)) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId));

const isDrawingHabitData = (v: unknown): boolean =>
  isPlainObject(v) &&
  (v.projects === undefined || Array.isArray(v.projects) && v.projects.every(isArtProject)) &&
  Array.isArray(v.pieces) &&
  v.pieces.every(isArtworkPiece) &&
  (v.weeklyTargetHours === undefined || typeof v.weeklyTargetHours === 'number') &&
  typeof v.totalDrawingMinutes === 'number' &&
  typeof v.totalSketches === 'number' &&
  isNonEmptyString(v.favoriteMedium);

const isBookQuote = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.quote) &&
  isValidDateKey(v.date) &&
  (v.bookId === undefined || isString(v.bookId)) &&
  (v.bookTitle === undefined || isString(v.bookTitle)) &&
  (v.author === undefined || isString(v.author)) &&
  (v.page === undefined || typeof v.page === 'number');

const isBookItem = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isNonEmptyString(v.author) &&
  isFiniteNumber(v.totalPages) &&
  typeof v.currentPage === 'number' &&
  isOneOf(new Set(['reading', 'completed', 'want_to_read', 'archived']))(v.status) &&
  (v.category === undefined || isBookCategory(v.category)) &&
  (v.rating === undefined || (typeof v.rating === 'number' && v.rating >= 1 && v.rating <= 5)) &&
  (v.startDate === undefined || isValidDateKey(v.startDate)) &&
  (v.completedDate === undefined || isValidDateKey(v.completedDate)) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId)) &&
  (v.archivedAt === undefined || isValidDateKey(v.archivedAt));

const isReadingSessionLog = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isValidDateKey(v.date) &&
  isNonEmptyString(v.bookId) &&
  isNonEmptyString(v.bookTitle) &&
  typeof v.pagesRead === 'number' &&
  typeof v.durationMinutes === 'number' &&
  typeof v.speedPagesPerHour === 'number' &&
  (v.startPage === undefined || typeof v.startPage === 'number') &&
  (v.endPage === undefined || typeof v.endPage === 'number') &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId));

const isReadingHabitData = (v: unknown): boolean =>
  isPlainObject(v) &&
  Array.isArray(v.books) &&
  v.books.every(isBookItem) &&
  Array.isArray(v.sessions) &&
  v.sessions.every(isReadingSessionLog) &&
  typeof v.annualTargetBooks === 'number' &&
  typeof v.totalPagesRead === 'number' &&
  typeof v.totalReadingMinutes === 'number' &&
  (v.activeBookId === undefined || isString(v.activeBookId)) &&
  (v.dailyTargetPages === undefined || typeof v.dailyTargetPages === 'number') &&
  (v.weeklyTargetPages === undefined || typeof v.weeklyTargetPages === 'number');

const isWorkoutHabitData = (v: unknown): boolean =>
  isPlainObject(v) &&
  Array.isArray(v.sessions) &&
  v.sessions.every(isWorkoutSessionLog) &&
  (v.customRoutines === undefined || Array.isArray(v.customRoutines) && v.customRoutines.every(isWorkoutRoutine)) &&
  typeof v.weeklyTargetSessions === 'number' &&
  typeof v.totalMinutes === 'number' &&
  typeof v.totalWorkouts === 'number' &&
  isNonEmptyString(v.favoriteRoutine) &&
  (v.monthlyTargetReps === undefined || typeof v.monthlyTargetReps === 'number') &&
  (v.totalReps === undefined || typeof v.totalReps === 'number') &&
  (v.totalVolumeKg === undefined || typeof v.totalVolumeKg === 'number');

const isHealthMetric = (v: unknown): boolean =>
  isPlainObject(v) &&
  isValidDateKey(v.date) &&
  typeof v.sleepHours === 'number' &&
  isOneOf(new Set([0, 1, 2, 3, 4, 5]))(v.sleepQuality) &&
  typeof v.hydrationMl === 'number' &&
  typeof v.targetHydrationMl === 'number' &&
  typeof v.workoutLogged === 'boolean' &&
  isOneOf(new Set([0, 1, 2, 3, 4, 5]))(v.moodRating) &&
  (v.weightKg === undefined || typeof v.weightKg === 'number') &&
  (v.cycleDay === undefined || typeof v.cycleDay === 'number') &&
  (v.energyScore === undefined || typeof v.energyScore === 'number') &&
  (v.workoutType === undefined || isString(v.workoutType)) &&
  (v.workoutMinutes === undefined || typeof v.workoutMinutes === 'number');

const isExpenseRecord = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isFiniteNumber(v.amount) &&
  isExpenseType(v.type) &&
  isExpenseCategory(v.category) &&
  isValidDateKey(v.date) &&
  (v.notes === undefined || isString(v.notes));

const isSavingsGoal = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isFiniteNumber(v.targetAmount) &&
  isFiniteNumber(v.currentAmount) &&
  (v.targetDate === undefined || isValidDateKey(v.targetDate)) &&
  (v.icon === undefined || isString(v.icon));

const isJournalEntry = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isValidDateKey(v.date) &&
  isNonEmptyString(v.whatWentWell) &&
  isNonEmptyString(v.whatDrainedEnergy) &&
  isNonEmptyString(v.planForTomorrow) &&
  Array.isArray(v.gratitudeList) &&
  v.gratitudeList.every(isString) &&
  isOneOf(new Set([1, 2, 3, 4, 5]))(v.mood) &&
  typeof v.isEncrypted === 'boolean' &&
  isNonEmptyString(v.createdAt) &&
  (v.encryptedPayload === undefined || isString(v.encryptedPayload));

const isUserProfile = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.name) &&
  isProfileTheme(v.theme) &&
  isProfileLanguage(v.language) &&
  typeof v.experiencePoints === 'number' &&
  typeof v.level === 'number' &&
  typeof v.biometricLocked === 'boolean' &&
  typeof v.encryptionPassphraseSet === 'boolean' &&
  typeof v.weeklySundayReviewDue === 'boolean' &&
  (v.email === undefined || isString(v.email)) &&
  (v.lastSundayReviewDate === undefined || isValidDateKey(v.lastSundayReviewDate));

const isSundayRitualReview = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isValidDateKey(v.date) &&
  Array.isArray(v.wins) &&
  v.wins.every(isString) &&
  Array.isArray(v.lessons) &&
  v.lessons.every(isString) &&
  isNonEmptyString(v.energyAudit) &&
  Array.isArray(v.topPrioritiesNextWeek) &&
  v.topPrioritiesNextWeek.every(isString) &&
  isNonEmptyString(v.completedAt);

const isHistoryAuditLogEntry = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.timestamp) &&
  isUniversalHistoryDomain(v.domain) &&
  isUniversalHistoryEventType(v.action) &&
  isNonEmptyString(v.title) &&
  isNonEmptyString(v.entityId) &&
  isEntityType(v.entityType) &&
  (v.description === undefined || isString(v.description)) &&
  (v.metadata === undefined || isPlainObject(v.metadata));

const isTask = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isPriorityLevel(v.priority) &&
  typeof v.isTopThree === 'boolean' &&
  isTaskStatus(v.status) &&
  Array.isArray(v.tags) &&
  v.tags.every(isString) &&
  Array.isArray(v.subtasks) &&
  v.subtasks.every(isSubtask) &&
  isNonEmptyString(v.createdAt) &&
  isNonEmptyString(v.updatedAt) &&
  (v.notes === undefined || isString(v.notes)) &&
  (v.scheduledDate === undefined || isValidDateKey(v.scheduledDate)) &&
  (v.scheduledTime === undefined || isValidTimeKey(v.scheduledTime)) &&
  (v.estimatedMinutes === undefined || isFiniteNumber(v.estimatedMinutes)) &&
  (v.blockedBy === undefined || isStringArray(v.blockedBy)) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId)) &&
  (v.energyLevelRequired === undefined || isOneOf(new Set(['low', 'medium', 'high']))(v.energyLevelRequired)) &&
  (v.completedAt === undefined || isString(v.completedAt)) &&
  (v.isArchived === undefined || typeof v.isArchived === 'boolean') &&
  (v.archivedAt === undefined || isString(v.archivedAt)) &&
  (v.cancelledAt === undefined || isString(v.cancelledAt));

const isHabit = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.name) &&
  isNonEmptyString(v.anchor) &&
  isHabitTimeOfDay(v.timeOfDay) &&
  isHabitFrequency(v.frequency) &&
  isHabitCategory(v.category) &&
  isFiniteNumber(v.targetPerDay) &&
  typeof v.currentStreak === 'number' &&
  typeof v.longestStreak === 'number' &&
  typeof v.freezesRemaining === 'number' &&
  Array.isArray(v.freezesUsedDates) &&
  v.freezesUsedDates.every(isValidDateKey) &&
  Array.isArray(v.completedDates) &&
  v.completedDates.every(isValidDateKey) &&
  isNonEmptyString(v.createdAt) &&
  (v.location === undefined || isString(v.location)) &&
  (v.customDays === undefined || isNumberArray(v.customDays)) &&
  (v.unit === undefined || isString(v.unit)) &&
  (v.stackParentHabitId === undefined || isString(v.stackParentHabitId)) &&
  (v.linkedGoalId === undefined || isString(v.linkedGoalId)) &&
  (v.isArchived === undefined || typeof v.isArchived === 'boolean') &&
  (v.archivedAt === undefined || isString(v.archivedAt)) &&
  (v.status === undefined || isOneOf(new Set(['active', 'paused', 'archived']))(v.status)) &&
  (v.specializedType === undefined || isSpecializedHabitType(v.specializedType)) &&
  (v.readingData === undefined || isReadingHabitData(v.readingData)) &&
  (v.workoutData === undefined || isWorkoutHabitData(v.workoutData)) &&
  (v.drawingData === undefined || isDrawingHabitData(v.drawingData)) &&
  (v.quranData === undefined || isQuranHabitData(v.quranData));

const isGoal = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isNonEmptyString(v.title) &&
  isGoalCategory(v.category) &&
  isGoalTimeframe(v.timeframe) &&
  Array.isArray(v.keyResults) &&
  v.keyResults.every(isKeyResult) &&
  isGoalStatus(v.status) &&
  isNonEmptyString(v.createdAt) &&
  (v.description === undefined || isString(v.description)) &&
  (v.priority === undefined || isGoalPriority(v.priority)) &&
  (v.startDate === undefined || isValidDateKey(v.startDate)) &&
  (v.deadline === undefined || isValidDateKey(v.deadline)) &&
  (v.milestones === undefined || Array.isArray(v.milestones) && v.milestones.every(isGoalMilestone)) &&
  (v.visionImages === undefined || isStringArray(v.visionImages)) &&
  (v.visionNotes === undefined || isString(v.visionNotes)) &&
  (v.color === undefined || isString(v.color)) &&
  (v.archivedAt === undefined || isString(v.archivedAt)) &&
  (v.linkedTaskIds === undefined || isStringArray(v.linkedTaskIds)) &&
  (v.linkedHabitIds === undefined || isStringArray(v.linkedHabitIds)) &&
  (v.linkedBookIds === undefined || isStringArray(v.linkedBookIds)) &&
  (v.linkedArtProjectIds === undefined || isStringArray(v.linkedArtProjectIds));

const isFocusSession = (v: unknown): boolean =>
  isPlainObject(v) &&
  isNonEmptyString(v.id) &&
  isFiniteNumber(v.durationMinutes) &&
  isFiniteNumber(v.targetMinutes) &&
  typeof v.interruptionCount === 'number' &&
  isFocusInteraction(v.preMood) &&
  isFocusInteraction(v.postMood) &&
  isFocusInteraction(v.productivityScore) &&
  isNonEmptyString(v.completedAt) &&
  (v.taskId === undefined || isString(v.taskId)) &&
  (v.taskTitle === undefined || isString(v.taskTitle)) &&
  (v.notes === undefined || isString(v.notes));

// ------------------------------------------------------------------
// Section -> validator dispatch
// ------------------------------------------------------------------

type SectionName = keyof BackupData;

const SECTION_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  tasks: (v: unknown): v is Task[] => Array.isArray(v) && v.every(isTask),
  habits: (v: unknown): v is Habit[] => Array.isArray(v) && v.every(isHabit),
  goals: (v: unknown): v is Goal[] => Array.isArray(v) && v.every(isGoal),
  focusSessions: (v: unknown): v is FocusSession[] => Array.isArray(v) && v.every(isFocusSession),
  expenses: (v: unknown): v is ExpenseRecord[] => Array.isArray(v) && v.every(isExpenseRecord),
  savingsGoals: (v: unknown): v is SavingsGoal[] => Array.isArray(v) && v.every(isSavingsGoal),
  journalEntries: (v: unknown): v is JournalEntry[] => Array.isArray(v) && v.every(isJournalEntry),
  sundayReviews: (v: unknown): v is SundayRitualReview[] => Array.isArray(v) && v.every(isSundayRitualReview),
  historyAuditLogs: (v: unknown): v is HistoryAuditLogEntry[] => Array.isArray(v) && v.every(isHistoryAuditLogEntry)
};

const LIST_SECTIONS = [
  'tasks',
  'habits',
  'goals',
  'focusSessions',
  'expenses',
  'savingsGoals',
  'journalEntries',
  'sundayReviews',
  'historyAuditLogs'
] as const;

/** Sections whose presence identifies a legacy (v1, flat) NUQTA backup. */
const LEGACY_MARKERS = ['tasks', 'habits', 'goals'] as const;

/**
 * Validate a backup file COMPLETELY before anything is written.
 * Accepts the current envelope ({ app, version, data }) and the legacy flat v1 shape.
 * Every entity type is validated against its required fields, field types, allowed
 * values, nested structures, and relevant relationships.
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

  for (const key of LIST_SECTIONS) {
    const value = source[key];
    if (value === undefined) continue;
    const validate = SECTION_VALIDATORS[key];
    if (!validate || !validate(value)) {
      return { ok: false, error: 'invalid_section', section: key };
    }
    (data as unknown as Record<string, unknown>)[key] = value;
  }

  if (source.healthMetrics !== undefined) {
    if (!isHealthMap(source.healthMetrics)) {
      return { ok: false, error: 'invalid_section', section: 'healthMetrics' };
    }
    // Validate each health metric value fully.
    const metrics = source.healthMetrics as Record<string, unknown>;
    for (const [dateKey, metric] of Object.entries(metrics)) {
      if (!isValidDateKey(dateKey) || !isHealthMetric(metric)) {
        return { ok: false, error: 'invalid_section', section: 'healthMetrics' };
      }
    }
    data.healthMetrics = metrics as Record<string, HealthMetric>;
  }

  if (source.profile !== undefined) {
    if (!isUserProfile(source.profile)) {
      return { ok: false, error: 'invalid_section', section: 'profile' };
    }
    data.profile = source.profile as Partial<UserProfile>;
  }

  return { ok: true, data, version, legacy };
}

export function buildBackupFile(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}
