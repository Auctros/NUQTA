export type PriorityLevel = 1 | 2 | 3 | 4; // 1: Urgent & Important, 2: Important, 3: Urgent, 4: Neither (Eisenhower)

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'deferred' | 'archived' | 'cancelled';

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
}

export type SpecializedHabitType = 'standard' | 'reading' | 'workout' | 'drawing' | 'quran';

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
}

export interface ExerciseEntry {
  id: string;
  name: string;
  category: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'mobility';
  movement?: MuscleMovement;
  sets: ExerciseSet[];
  notes?: string;
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
}

export interface Habit {
  id: string;
  name: string;
  anchor: string; // Implementation Intention: "After [X] -> I will [Y]"
  location?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays?: number[]; // 0=Sun, 1=Mon, etc.
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
  entityType: 'task' | 'habit' | 'book' | 'workout_routine' | 'art_project' | 'goal' | 'focus_session' | 'journal' | 'finance' | 'quran_session';
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
