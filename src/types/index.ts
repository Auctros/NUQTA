import type { PrebuiltExercise } from '../lib/exerciseTypes';

export type { PrebuiltExercise } from '../lib/exerciseTypes';

export type PriorityLevel = 1 | 2 | 3 | 4; // 1: Urgent & Important, 2: Important, 3: Urgent, 4: Neither (Eisenhower)

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'deferred' | 'archived' | 'cancelled' | 'skipped';

/**
 * How an item repeats. Shared by tasks (each occurrence is a real record) and habits
 * (evaluated on the fly, never stored per day):
 *   - daily     every day
 *   - weekdays  every working day (NUQTA's week: Saturday..Thursday; Friday is off)
 *   - weekly    chosen weekday(s) once per week
 *   - custom    chosen weekday(s) — the legacy spelling of `weekly`
 *   - monthly   the same day-of-month each month
 *   - interval  every N days from the anchor
 */
export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom' | 'monthly' | 'interval';

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  /** Weekday numbers (0=Sun..6=Sat) for `weekly` / `custom`. */
  days?: number[];
  /** Day of month (1..31) for `monthly`. Defaults to the anchor's day-of-month. */
  monthDay?: number;
  /** Every N days (>=1) for `interval`. */
  intervalDays?: number;
  /** Last day the series may produce an occurrence (YYYY-MM-DD, inclusive). */
  until?: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: PriorityLevel;
  isTopThree: boolean;
  status: TaskStatus;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  estimatedMinutes?: number;
  tags: string[];
  subtasks: Subtask[];
  blockedBy?: string[]; // IDs of tasks this depends on
  linkedGoalId?: string;
  energyLevelRequired?: 'low' | 'medium' | 'high';
  completedAt?: string;
  isArchived?: boolean;
  archivedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Recurrence for a repeating task. When present, `seriesId` groups the generated
   * occurrences: each one is an ordinary Task record, so completing, editing or
   * deleting one occurrence never touches the others.
   */
  recurrence?: RecurrenceRule;
  /** Identifies the recurring series. Absent for one-off tasks. */
  seriesId?: string;
  /** 0-based position of this occurrence inside its series. */
  occurrenceIndex?: number;
}

export type SpecializedHabitType = 'standard' | 'reading' | 'workout' | 'drawing' | 'quran' | 'walking';

// ==========================================
// 0. Quran Memorization & Revision Studio Model
// ==========================================
export type QuranSurahStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_revision';
export type QuranSessionType = 'new_memorization' | 'revision' | 'recitation_test';
export type QuranRecitationQuality = 'excellent' | 'very_good' | 'good' | 'needs_reinforcement';

export interface AyahRange {
  start: number;
  end: number;
}

export interface SurahMemorizationState {
  surahNumber: number; // 1 to 114
  status: QuranSurahStatus;
  memorizedAyahsRanges: AyahRange[]; // Distinct, merged non-overlapping ranges
  memorizedAyahsCount: number; // Strictly distinct non-overlapping ayahs count
  lastReviewedDate?: string; // YYYY-MM-DD
  masteryRating?: 1 | 2 | 3 | 4 | 5; // 5 = متقن كالفاتحة
  notes?: string;
}

export interface QuranSessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  type: QuranSessionType;
  surahNumber: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  ayahCount: number;
  durationMinutes: number;
  quality: QuranRecitationQuality;
  notes?: string;
  mistakesCount?: number;
  linkedGoalId?: string;
}

export interface QuranRevisionSchedule {
  dailyWirdJuz?: number;
  revisionCycleDays: number; // e.g. 7 or 14 or 30 days
  currentReviewSurahs: number[]; // Surahs due for review today
  targetDailyAyahs: number; // e.g. 5, 10, or 20 ayahs/day
  weeklyTargetRevisionMinutes: number;
}

export interface QuranHabitData {
  surahs: SurahMemorizationState[]; // 114 Surahs tracking states
  sessions: QuranSessionLog[];
  revisionSchedule: QuranRevisionSchedule;
  totalAyahsMemorized: number; // Strictly distinct ayahs (no double counting)
  totalSurahsCompleted: number;
  totalMemorizationMinutes: number;
  totalRevisionMinutes: number;
  dailyTargetAyahs: number;
  activeSurahNumber: number; // Surah currently being memorized
}

// ==========================================
// 1. Specialized Drawing / Creative Studio Model
// ==========================================
export type ArtMedium = 'sketch' | 'ink' | 'watercolor' | 'digital' | 'acrylic' | 'mixed' | 'oil';
export type ProjectStage = 'ideation' | 'sketching' | 'inking' | 'coloring' | 'polishing' | 'completed' | 'archived';

export interface ArtProject {
  id: string;
  title: string;
  description?: string;
  stage: ProjectStage;
  medium: ArtMedium;
  startedDate: string;
  completedDate?: string;
  thumbnailColor?: string;
  totalMinutesSpent: number;
  sessionsCount: number;
  tags?: string[];
  notes?: string;
  linkedGoalId?: string;
  isArchived?: boolean;
  archivedAt?: string;
}

export interface ArtworkPiece {
  id: string;
  projectId?: string;
  projectTitle?: string;
  title: string;
  medium: ArtMedium;
  durationMinutes: number;
  completedDate: string;
  notes?: string;
  promptTheme?: string;
  stage?: ProjectStage;
  linkedGoalId?: string;
}

export interface DrawingHabitData {
  projects?: ArtProject[];
  pieces: ArtworkPiece[];
  weeklyTargetHours?: number;
  totalDrawingMinutes: number;
  totalSketches: number;
  favoriteMedium: string;
}

// ==========================================
// 1b. Specialized Walking Studio Model
// ==========================================
/**
 * One completed walk. `durationSeconds` is always measured by the session timer, so it is
 * the only figure the studio can state without asking. Distance and steps are optional
 * MANUAL input — NUQTA has no GPS, pedometer or health-sensor access, so an absent value
 * stays absent (rendered as "—") rather than being estimated from the duration.
 */
export interface WalkingSessionLog {
  id: string;
  date: string; // YYYY-MM-DD, local
  durationSeconds: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
  /** Manual entry only. Never derived from duration. */
  distanceKm?: number;
  /** Manual entry only. Never derived from duration. */
  steps?: number;
  /** Seconds spent paused, measured by the session timer. */
  pausedSeconds?: number;
  notes?: string;
  linkedGoalId?: string;
}

export interface WalkingHabitData {
  sessions: WalkingSessionLog[];
  /** Weekly target in minutes; drives the progress ring. */
  weeklyTargetMinutes?: number;
  totalWalkMinutes: number;
  totalWalkSeconds?: number;
  totalWalks: number;
  /** Sum of MANUAL distance entries only. Absent when nothing was ever entered. */
  totalDistanceKm?: number;
  /** Sum of MANUAL step entries only. Absent when nothing was ever entered. */
  totalSteps?: number;
}

// ==========================================
// 2. Specialized Reading App Model
// ==========================================
export type BookCategory = 'mind' | 'philosophy' | 'productivity' | 'science' | 'literature' | 'biography' | 'business' | 'other';

export interface BookQuote {
  id: string;
  quote: string;
  bookId?: string;
  bookTitle?: string;
  author?: string;
  page?: number;
  date: string;
}

/**
 * Bibliographic metadata imported from an external catalogue.
 *
 * This is deliberately a nested record rather than a pile of loose fields: it marks
 * the boundary between what a provider may populate and what only the reader may
 * write. Nothing in here is ever personal (no status, no progress, no rating), so a
 * refresh from the catalogue can replace the whole object without touching the
 * reader's own data.
 */
export interface BookCatalogMeta {
  /** Which provider the metadata came from. */
  source: 'google_books' | 'open_library';
  /** The provider's own id, kept so the same edition can be re-fetched. */
  sourceId: string;
  subtitle?: string;
  /** Every author the catalogue lists, in its own order. */
  authors?: string[];
  publisher?: string;
  /** As published by the provider: may be `2020`, `2020-05`, or `2020-05-01`. */
  publishedDate?: string;
  language?: string;
  isbn10?: string;
  isbn13?: string;
  description?: string;
  /** Catalogue subject labels, not NUQTA's own `BookCategory`. */
  categories?: string[];
  pageCount?: number;
  /** Edition/printing statement when the provider supplies one. */
  edition?: string;
  /**
   * Remote cover URL as returned by the provider.
   *
   * Kept as a *reference*, never as the rendered image: the app's CSP allows no
   * third-party image host, and a remote URL can rot. `coverDataUrl` is the offline
   * copy that the UI actually paints.
   */
  coverUrl?: string;
  /** The provider's canonical page for this edition, shown as the source credit. */
  infoUrl?: string;
  fetchedAt: string;
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  category?: BookCategory;
  totalPages: number;
  currentPage: number;
  status: 'reading' | 'completed' | 'want_to_read' | 'archived';
  coverColor?: string;
  rating?: number; // 1 to 5
  notes?: string;
  startDate?: string;
  completedDate?: string;
  linkedGoalId?: string;
  archivedAt?: string;
  /** Imported bibliographic metadata. Absent on manually entered books. */
  catalog?: BookCatalogMeta;
  /**
   * The cover as a local `data:` image, so the book still shows its cover offline
   * and under a CSP that permits no remote image host.
   */
  coverDataUrl?: string;
}

export interface ReadingSessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  bookId: string;
  bookTitle: string;
  pagesRead: number;
  startPage?: number;
  endPage?: number;
  durationMinutes: number;
  speedPagesPerHour: number;
  notes?: string;
  quoteSnippet?: string;
  linkedGoalId?: string;
}

export interface ReadingHabitData {
  books: BookItem[];
  activeBookId?: string;
  sessions: ReadingSessionLog[];
  quotes?: BookQuote[];
  dailyTargetPages?: number;
  weeklyTargetPages?: number;
  annualTargetBooks: number;
  totalPagesRead: number;
  totalReadingMinutes: number;
}

// ==========================================
// 3. Specialized Home Workout & Fitness Model
// ==========================================
export type MuscleMovement = 'push' | 'legs' | 'core' | 'back_pull' | 'mobility' | 'cardio';
export type FitnessDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type HomeEquipment = 'bodyweight_only' | 'mat' | 'pullup_bar' | 'resistance_band' | 'chair_elevated' | 'light_dumbbells';

export interface ExerciseDefinition {
  id: string;
  name: string;
  nameAr: string;
  movement: MuscleMovement;
  difficulty: FitnessDifficulty;
  equipment: HomeEquipment;
  descriptionAr?: string;
  descriptionEn?: string;
}

export interface ExerciseSet {
  setNumber: number;
  weightKg?: number; // 0 = pure bodyweight
  reps: number;
  restSeconds?: number;
  completed: boolean;
  /**
   * Optional richer prescription. All fields are additive, so every set logged
   * before this existed still validates and renders unchanged.
   */
  type?: WorkoutSetType;
  /** Rep target when a range is prescribed (e.g. 8–12 → reps 8, repsMax 12). */
  repsMax?: number;
  /** Target effort in reserve (0–5). */
  rir?: number;
  /** Target rate of perceived exertion (1–10). */
  rpe?: number;
  /** Seconds held / performed for timed (isometric or cardio) work. */
  durationSeconds?: number;
  /** Superset / circuit grouping label; sets sharing a value are linked. */
  supersetId?: string;
}

/** How a set is performed. `normal` is the default for legacy data. */
export type WorkoutSetType =
  | 'normal'
  | 'warmup'
  | 'working'
  | 'dropset'
  | 'failure'
  | 'amrap'
  | 'backoff';

/** How an exercise is measured during a session. */
export type ExerciseTrackingType = 'reps_weight' | 'reps' | 'time' | 'distance_time';

export interface ExerciseEntry {
  id: string;
  name: string;
  category: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'mobility';
  movement?: MuscleMovement;
  sets: ExerciseSet[];
  notes?: string;
  /** Catalog id when this entry originated from the library (enables history). */
  catalogId?: string;
  /** Tracking model, defaults to `reps_weight`. */
  tracking?: ExerciseTrackingType;
  /** Target rest between sets, in seconds. */
  restSeconds?: number;
  /** Performed one side at a time. */
  unilateral?: boolean;
  /** Superset grouping at the exercise level. */
  supersetId?: string;
  /** Optional progression rule (free text or a compact descriptor). */
  progression?: string;
  /** Planned/technique cue shown during execution. */
  cue?: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  targetLevel: FitnessDifficulty;
  estimatedMinutes: number;
  category: 'bodyweight' | 'mobility' | 'core' | 'cardio';
  exercises: ExerciseEntry[];
  isCustom?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  /**
   * Optional structured program built on top of the flat `exercises` list. A
   * routine without it is still a valid "quick routine" — the legacy shape.
   */
  program?: WorkoutProgram;
  /** Lifecycle status for the Programs workspace. Absent = legacy routine. */
  status?: WorkoutProgramStatus;
}

/** Lifecycle of a program in the workspace. */
export type WorkoutProgramStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

/** The training split a program follows. `custom` means a hand-built week. */
export type TrainingSplit =
  | 'full_body'
  | 'upper_lower'
  | 'ppl'
  | 'push_pull'
  | 'bro_split'
  | 'custom';

export type ProgramGoal = 'strength' | 'hypertrophy' | 'endurance' | 'fat_loss' | 'general' | 'mobility';

/** One training day (or rest day) inside a program week. */
export interface ProgramDay {
  id: string;
  name: string;
  nameAr?: string;
  /** Rest days carry no exercises and render as recovery. */
  isRest?: boolean;
  /** Optional focus label, e.g. "Push" / "Upper A". */
  focus?: string;
  exercises: ExerciseEntry[];
  notes?: string;
}

/** One week of the program. */
export interface ProgramWeek {
  id: string;
  name?: string;
  nameAr?: string;
  days: ProgramDay[];
}

/** A phase/block groups weeks under one objective (e.g. "Hypertrophy block"). */
export interface ProgramPhase {
  id: string;
  name: string;
  nameAr?: string;
  /** Weeks (by id) that belong to this phase. */
  weekIds: string[];
  notes?: string;
}

/**
 * The structured program attached to a `WorkoutRoutine`. Kept optional so every
 * routine saved before this existed remains valid and usable.
 */
export interface WorkoutProgram {
  split: TrainingSplit;
  goal?: ProgramGoal;
  /** Number of training weeks (mirrors `weeks.length` when weeks are authored). */
  durationWeeks?: number;
  /** Sessions per week the program expects. */
  frequencyPerWeek?: number;
  weeks: ProgramWeek[];
  phases?: ProgramPhase[];
  /** When the program was started (YYYY-MM-DD); drives progress. */
  startedAt?: string;
  /** Completed program days, by day id, for progress tracking. */
  completedDayIds?: string[];
}

export interface WorkoutSessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  routineId?: string;
  workoutType: 'strength' | 'cardio' | 'hiit' | 'mobility' | 'bodyweight';
  durationMinutes: number;
  totalReps?: number;
  volumeKg: number; // sum of weight * reps
  exercises: ExerciseEntry[];
  intensityRating: 1 | 2 | 3 | 4 | 5; // RPE
  difficultyLevel?: FitnessDifficulty;
  notes?: string;
  caloriesBurned?: number;
  linkedGoalId?: string;
  /** Program this session was executed from, when started from a program day. */
  programId?: string;
  /** The program day that was executed. */
  programDayId?: string;
  /** Human label of the executed day (survives program edits). */
  programDayName?: string;
}

export interface WorkoutHabitData {
  sessions: WorkoutSessionLog[];
  customRoutines?: WorkoutRoutine[];
  weeklyTargetSessions: number;
  monthlyTargetReps?: number;
  totalReps?: number;
  totalVolumeKg: number;
  totalMinutes: number;
  totalWorkouts: number;
  favoriteRoutine: string;
  /** User-authored exercises that can be used inside programs (custom library). */
  customExercises?: PrebuiltExercise[];
}

export interface Habit {
  id: string;
  name: string;
  anchor: string; // Implementation Intention: "After [X] -> I will [Y]"
  location?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays?: number[]; // 0=Sun, 1=Mon, etc.
  /**
   * Optional richer schedule. When present it takes precedence over `frequency`
   * (which is kept for backward compatibility) and adds weekly/monthly/interval
   * support. Habits are evaluated on the fly — never materialised per day — so a
   * change here re-scores past compliance without rewriting stored records.
   */
  recurrence?: RecurrenceRule;
  category: 'health' | 'mind' | 'productivity' | 'learning' | 'relationships';
  targetPerDay: number;
  unit?: string;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining: number; // 2 emergency freezes per month
  freezesUsedDates: string[]; // YYYY-MM-DD
  completedDates: string[]; // ['2026-11-01', ...]
  stackParentHabitId?: string; // Habit stacking parent
  linkedGoalId?: string;
  isArchived?: boolean;
  archivedAt?: string;
  status?: 'active' | 'paused' | 'archived';
  createdAt: string;

  // Dedicated Mini-App Mode
  specializedType?: SpecializedHabitType;
  readingData?: ReadingHabitData;
  workoutData?: WorkoutHabitData;
  drawingData?: DrawingHabitData;
  quranData?: QuranHabitData;
  walkingData?: WalkingHabitData;
}

export type KeyResultDataSource =
  | 'manual'
  | 'tasks_completed'
  | 'habit_consistency'
  | 'reading_books_completed'
  | 'reading_pages_read'
  | 'reading_hours'
  | 'workout_sessions_count'
  | 'workout_total_reps'
  | 'workout_total_minutes'
  | 'drawing_projects_completed'
  | 'drawing_flow_hours'
  | 'drawing_artworks_count'
  | 'quran_ayahs_memorized'
  | 'quran_surahs_completed'
  | 'quran_revision_sessions'
  | 'quran_total_minutes';

export interface KeyResult {
  id: string;
  title: string;
  startValue?: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  dataSource?: KeyResultDataSource;
  notes?: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  targetDate?: string; // YYYY-MM-DD
  completedDate?: string; // YYYY-MM-DD
  isCompleted: boolean;
}

export type GoalPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: 'career' | 'health' | 'finance' | 'personal' | 'intellect';
  priority?: GoalPriority;
  timeframe: 'quarterly' | 'annual' | 'life';
  startDate?: string; // YYYY-MM-DD
  deadline?: string; // YYYY-MM-DD
  keyResults: KeyResult[];
  milestones?: GoalMilestone[];
  visionImages?: string[];
  visionNotes?: string;
  color?: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  archivedAt?: string;

  // Explicit, user-defined relations to NUQTA activities:
  linkedTaskIds?: string[];
  linkedHabitIds?: string[];
  linkedBookIds?: string[];
  linkedArtProjectIds?: string[];

  createdAt: string;
  updatedAt?: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  durationMinutes: number;
  targetMinutes: number;
  interruptionCount: number;
  notes?: string;
  preMood: 1 | 2 | 3 | 4 | 5;
  postMood: 1 | 2 | 3 | 4 | 5;
  productivityScore: 1 | 2 | 3 | 4 | 5;
  completedAt: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  category: 'housing' | 'food' | 'transport' | 'health' | 'tech' | 'leisure' | 'savings';
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  icon?: string;
}

export interface HealthMetric {
  date: string; // YYYY-MM-DD
  sleepHours: number; // 0 = not logged
  sleepQuality: 0 | 1 | 2 | 3 | 4 | 5; // 0 = not logged
  hydrationMl: number;
  targetHydrationMl: number;
  workoutLogged: boolean;
  workoutType?: string;
  workoutMinutes?: number;
  moodRating: 0 | 1 | 2 | 3 | 4 | 5; // 0 = not logged
  weightKg?: number;
  cycleDay?: number;
  energyScore?: number;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  whatWentWell: string;
  whatDrainedEnergy: string;
  planForTomorrow: string;
  gratitudeList: string[];
  mood: 1 | 2 | 3 | 4 | 5;
  isEncrypted: boolean;
  encryptedPayload?: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  email?: string;
  theme: 'dark' | 'light' | 'midnight-gold' | 'monochrome';
  language: 'en' | 'ar';
  experiencePoints: number;
  level: number;
  biometricLocked: boolean;
  encryptionPassphraseSet: boolean;
  weeklySundayReviewDue: boolean;
  lastSundayReviewDate?: string;
}

export interface SundayRitualReview {
  id: string;
  date: string;
  wins: string[];
  lessons: string[];
  energyAudit: string;
  topPrioritiesNextWeek: string[];
  completedAt: string;
}

// ==========================================
// 4. Universal Archive & Life History System
// ==========================================
export type UniversalHistoryDomain =
  | 'tasks'
  | 'habits'
  | 'quran'
  | 'reading'
  | 'workout'
  | 'drawing'
  | 'walking'
  | 'goals'
  | 'focus'
  | 'health'
  | 'finance'
  | 'journal'
  | 'review';

export type UniversalHistoryEventType =
  | 'created'
  | 'completed'
  | 'archived'
  | 'restored'
  | 'milestone'
  | 'session'
  | 'streak_freeze'
  | 'note'
  | 'status_change';

export interface UniversalHistoryItem {
  id: string; // Deterministic unique event ID
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  domain: UniversalHistoryDomain;
  eventType: UniversalHistoryEventType;
  title: string;
  description?: string;
  entityId: string;
  entityType: 'task' | 'habit' | 'book' | 'workout_routine' | 'art_project' | 'goal' | 'focus_session' | 'journal' | 'finance' | 'quran_session' | 'walk_session';
  badge?: string;
  metricsSummary?: string;
  iconName?: string;
  iconColor?: string;
  linkedGoalId?: string;
  linkedGoalTitle?: string;
  isArchivedEntity?: boolean;
  canRestore?: boolean;
  rawEntity?: any;
}

export interface HistoryAuditLogEntry {
  id: string;
  timestamp: string;
  domain: UniversalHistoryDomain;
  action: UniversalHistoryEventType;
  title: string;
  description?: string;
  entityId: string;
  entityType: UniversalHistoryItem['entityType'];
  metadata?: Record<string, any>;
}

export interface ArchivedItemSummary {
  id: string;
  originalId: string;
  domain: UniversalHistoryDomain;
  title: string;
  typeLabelAr: string;
  typeLabelEn: string;
  archivedAt?: string;
  createdAt?: string;
  completedAt?: string;
  status: string;
  linkedGoalId?: string;
  linkedGoalTitle?: string;
  metricsSummary?: string;
  raw: any;
  parentHabitId?: string;
}

// ==========================================
// 5. Notification & Messaging System
// ==========================================
/**
 * What a notification is about. Mirrors the application's own areas so a
 * notification is always traceable to the domain that produced it.
 */
export type NotificationCategory =
  | 'task'
  | 'habit'
  | 'goal'
  | 'focus'
  | 'health'
  | 'finance'
  | 'system'
  | 'reminder';

/** Urgency, not importance: drives ordering and how loud the row reads. */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/** Where clicking a notification should take the user. */
export interface NotificationRoute {
  nav: string;
  entityId?: string;
}

/**
 * One in-app notification record.
 *
 * Timestamps are ISO-8601 UTC instants (`createdAt`, `readAt`, `expiresAt`); grouping
 * by day happens at render time through `localDateKey`, never by slicing a UTC string.
 *
 * `dedupeKey` is the identity that prevents the same event from notifying twice
 * (e.g. `task:<id>:due:2026-11-12:09:00`). It is stable across reloads, which is what
 * lets a reminder that already fired stay silent after a restart.
 */
export interface AppNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body?: string;
  /** Actionable notifications carry a destination; informational ones omit it. */
  route?: NotificationRoute;
  /** Label for the primary action when it is not simply "open". */
  actionLabel?: string;
  createdAt: string;
  readAt?: string;
  /** Set when the user dismisses it. Dismissed rows are hidden but kept for dedupe. */
  dismissedAt?: string;
  /** After this instant the notification is stale and pruned by the engine. */
  expiresAt?: string;
  dedupeKey: string;
  /** Category-specific payload for rendering context (never required to display). */
  meta?: Record<string, string | number | boolean>;
}

/** A delivery channel the user can switch on. In-app is always on. */
export type NotificationChannel = 'browser';

/**
 * Notification preferences. Deliberately small: category switches plus one optional
 * delivery channel. `inApp` exists so the shape is honest about the always-on channel
 * rather than implying it can be turned off.
 */
export interface NotificationPreferences {
  inApp: true;
  browser: boolean;
  /** Per-category switches. Absent key = enabled (sensible default). */
  categories: Partial<Record<NotificationCategory, boolean>>;
  /** Suppress browser delivery outside these hours ("HH:mm"), local time. */
  quietHours?: { enabled: boolean; start: string; end: string };
}

// ==========================================
// 6. YouTube Courses (imported playlists)
// ==========================================
/**
 * One video inside an imported playlist, in the playlist's own order.
 *
 * `position` is the index YouTube reports, and it is the only ordering the course
 * view uses — the list must read exactly as it does on YouTube. A video that has
 * since been deleted or made private keeps its slot with `unavailable: true`
 * rather than disappearing, so the rest of the course never shifts under the user.
 */
export interface CourseVideo {
  videoId: string;
  title: string;
  position: number;
  durationSeconds?: number;
  thumbnailUrl?: string;
  channelTitle?: string;
  /** True when YouTube no longer returns data for this item. */
  unavailable?: boolean;
  publishedAt?: string;
}

/**
 * An imported YouTube playlist.
 *
 * This is a local cache of what YouTube returned, not a second source of truth:
 * NUQTA owns nothing here except the user's choice to keep it. `fetchedAt` records
 * when the snapshot was taken so a stale course can say so instead of pretending
 * to be live.
 */
export interface YoutubeCourse {
  id: string;
  playlistId: string;
  title: string;
  description?: string;
  channelTitle?: string;
  /** The cover the course page shows. Never invented when YouTube gives none. */
  thumbnailUrl?: string;
  videos: CourseVideo[];
  /** How many items YouTube reported, which can exceed `videos.length` if truncated. */
  itemCount: number;
  canonicalUrl: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
  /** True when the import hit the per-playlist cap and the list is partial. */
  truncated?: boolean;
  linkedGoalId?: string;
}
