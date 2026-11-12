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

/** Array whose every element is an object carrying a non-empty string id. */
const isIdObjectList = (v: unknown): boolean =>
  Array.isArray(v) && v.every((x) => isPlainObject(x) && isNonEmptyString(x.id));

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

function isBook(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    isNonEmptyString(v.id) &&
    isString(v.title) &&
    optional(isString)(v.author) &&
    optional(isNumber)(v.totalPages) &&
    optional(isNumber)(v.currentPage) &&
    optional(isString)(v.status)
  );
}

function isReadingSession(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && optional(isString)(v.date);
}

function isReadingData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isBook))(v.books) &&
    optional((x) => Array.isArray(x) && x.every(isReadingSession))(v.sessions) &&
    optional(isIdObjectList)(v.quotes) &&
    optional(isNumber)(v.totalPagesRead) &&
    optional(isNumber)(v.totalReadingMinutes)
  );
}

function isWorkoutSession(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && optional(isString)(v.date);
}

function isWorkoutData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isWorkoutSession))(v.sessions) &&
    optional(isIdObjectList)(v.customRoutines) &&
    optional(isNumber)(v.totalWorkouts) &&
    optional(isNumber)(v.totalReps) &&
    optional(isNumber)(v.totalMinutes)
  );
}

function isArtProject(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && optional(isString)(v.title);
}

function isArtworkPiece(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && optional(isString)(v.title);
}

function isDrawingData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isArtworkPiece))(v.pieces) &&
    optional((x) => Array.isArray(x) && x.every(isArtProject))(v.projects) &&
    optional(isNumber)(v.totalDrawingMinutes) &&
    optional(isNumber)(v.totalSketches)
  );
}

function isQuranSession(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.id) && optional(isString)(v.date);
}

function isQuranData(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    optional((x) => Array.isArray(x) && x.every(isQuranSession))(v.sessions) &&
    optional(isNumber)(v.totalAyahsMemorized) &&
    optional(isNumber)(v.totalSurahsCompleted) &&
    optional(isNumber)(v.totalMemorizationMinutes) &&
    optional(isNumber)(v.totalRevisionMinutes)
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

/**
 * Validate a backup file COMPLETELY before anything is written.
 * Accepts the current envelope ({ app, version, data }) and the legacy flat v1 shape.
 * Every supported entity type is checked field-by-field, including allowed values,
 * nested structures and relevant relationships.
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
    if (raw.exportedAt !== undefined && !isString(raw.exportedAt)) {
      return { ok: false, error: 'invalid_section', section: 'exportedAt' };
    }
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
    if (!Array.isArray(value)) return { ok: false, error: 'invalid_section', section: key };
    const isValid = LIST_VALIDATORS[key];
    if (!value.every(isValid)) return { ok: false, error: 'invalid_section', section: key };
    (data as unknown as Record<string, unknown>)[key] = value;
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

  return { ok: true, data, version, legacy };
}

export function buildBackupFile(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}
