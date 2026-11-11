import {
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
import { DEMO_TASKS, DEMO_HABITS, DEMO_GOALS, DEMO_EXPENSES, DEMO_SAVINGS_GOALS } from './demoData';
import { NuqtaIndexedDB, STORES } from './indexedDB';
import {
  BackupData,
  ParseBackupResult,
  BackupError,
  buildBackupFile,
  parseBackup,
  isHealthMap,
  isPlainObject,
  isRecordList
} from './backupSchema';

/** Kept importable from here for backward compatibility; the implementation lives in dateKey.ts. */
export { localDateKey } from './dateKey';

const KEY_PREFIX = 'nuqta_';

const STORAGE_KEYS = {
  TASKS: 'nuqta_tasks_v1',
  HABITS: 'nuqta_habits_v1',
  GOALS: 'nuqta_goals_v1',
  FOCUS: 'nuqta_focus_sessions_v1',
  HEALTH: 'nuqta_health_v1',
  EXPENSES: 'nuqta_expenses_v1',
  SAVINGS: 'nuqta_savings_v1',
  JOURNAL: 'nuqta_journal_v1',
  PROFILE: 'nuqta_profile_v1',
  SUNDAY_REVIEWS: 'nuqta_sunday_reviews_v1',
  HISTORY_AUDIT: 'nuqta_history_audit_v1',
  META: 'nuqta_meta_v1'
} as const;

export const SCHEMA_VERSION = 1;
const MAX_QUARANTINE_COPIES = 3;

/** Something went wrong with persistence that the user should be told about. */
export interface StorageIssue {
  kind: 'write_failed' | 'corrupt';
  key: string;
  detail?: string;
}

interface StorageMeta {
  schemaVersion: number;
  createdAt: string;
  /** True while the data is the optional sample data, not the user's own. */
  demo?: boolean;
}

export type ImportResult =
  | { ok: true; version: number; legacy: boolean }
  | { ok: false; error: BackupError | 'write_failed'; section?: string };

const issues: StorageIssue[] = [];
const listeners = new Set<(issue: StorageIssue) => void>();

function report(issue: StorageIssue): void {
  issues.push(issue);
  listeners.forEach((fn) => {
    try {
      fn(issue);
    } catch {
      /* a broken listener must never break persistence */
    }
  });
}

/** Subscribe to persistence problems (quota exceeded, unreadable data...). */
export function subscribeStorageIssues(fn: (issue: StorageIssue) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Issues raised so far (so a late subscriber does not miss early ones). */
export function getStorageIssues(): StorageIssue[] {
  return [...issues];
}

export function clearStorageIssues(): void {
  issues.length = 0;
}

export function defaultProfile(): UserProfile {
  const lang =
    typeof navigator !== 'undefined' && /^ar/i.test(navigator.language || '') ? 'ar' : 'en';
  return {
    name: '',
    theme: 'dark',
    language: lang,
    experiencePoints: 0,
    level: 1,
    biometricLocked: false,
    encryptionPassphraseSet: false,
    weeklySundayReviewDue: false
  };
}

function normalizeProfile(p: Partial<UserProfile> | null | undefined): UserProfile {
  const base = defaultProfile();
  const merged: UserProfile = { ...base, ...(p || {}) };
  if (merged.language !== 'en' && merged.language !== 'ar') merged.language = base.language;
  if (typeof merged.name !== 'string') merged.name = '';
  if (typeof merged.experiencePoints !== 'number' || !isFinite(merged.experiencePoints)) {
    merged.experiencePoints = 0;
  }
  if (typeof merged.level !== 'number' || !isFinite(merged.level) || merged.level < 1) merged.level = 1;
  return merged;
}

/** Keep an unreadable value instead of letting the next save overwrite it. */
function quarantine(key: string, raw: string, reason: string): void {
  try {
    localStorage.setItem(`${key}__corrupt_${Date.now()}`, raw);
    const copies = Object.keys(localStorage)
      .filter((k) => k.startsWith(`${key}__corrupt_`))
      .sort();
    while (copies.length > MAX_QUARANTINE_COPIES) localStorage.removeItem(copies.shift() as string);
  } catch {
    /* storage is full: nothing more we can do */
  }
  console.warn(`NUQTA: "${key}" was unreadable (${reason}); a copy was preserved.`);
  report({ kind: 'corrupt', key, detail: reason });
}

/**
 * Pure read: never writes, never seeds. A missing key is just "no data yet".
 * An unreadable or wrongly-shaped value is preserved under *__corrupt_<time>.
 */
function readValue<T>(key: string, fallback: () => T, isValid: (v: unknown) => boolean): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback();
  }
  if (raw === null) return fallback();
  try {
    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return parsed as T;
    quarantine(key, raw, 'unexpected shape');
  } catch {
    quarantine(key, raw, 'invalid JSON');
  }
  return fallback();
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    report({ kind: 'write_failed', key, detail: e instanceof Error ? e.name : String(e) });
    return false;
  }
}

function readMeta(): StorageMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.META);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return isPlainObject(m) && typeof m.schemaVersion === 'number' ? (m as unknown as StorageMeta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: StorageMeta): boolean {
  if (!writeRaw(STORAGE_KEYS.META, JSON.stringify(meta))) return false;
  void NuqtaIndexedDB.replaceAll(STORES.META, [{ id: 'meta', ...meta }]);
  return true;
}

function ensureMeta(): void {
  if (readMeta()) return;
  writeMeta({ schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() });
}

/** Persist one section to localStorage (source of truth); mirror to IndexedDB on success. */
function persist(key: string, value: unknown, mirror: () => Promise<unknown>): boolean {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (e) {
    report({ kind: 'write_failed', key, detail: 'not serializable' });
    return false;
  }
  if (!writeRaw(key, serialized)) return false;
  ensureMeta();
  void mirror();
  return true;
}

const asList = <T>(): T[] => [];

/**
 * Storage design:
 *  - localStorage is the single SOURCE OF TRUTH (synchronous reads for first render).
 *  - IndexedDB is an exact MIRROR (replace-all on every save, so deletions propagate),
 *    used only to recover when localStorage has been lost but the mirror survived.
 *  - Reads never write. A first run is genuinely empty. Sample data is opt-in.
 */
export class NuqtaStorageEngine {
  // Tasks
  static getTasks(): Task[] {
    return readValue(STORAGE_KEYS.TASKS, asList<Task>, isRecordList);
  }
  static saveTasks(tasks: Task[]): boolean {
    return persist(STORAGE_KEYS.TASKS, tasks, () => NuqtaIndexedDB.replaceAll(STORES.TASKS, tasks));
  }

  // Habits
  static getHabits(): Habit[] {
    return readValue(STORAGE_KEYS.HABITS, asList<Habit>, isRecordList);
  }
  static saveHabits(habits: Habit[]): boolean {
    return persist(STORAGE_KEYS.HABITS, habits, () => NuqtaIndexedDB.replaceAll(STORES.HABITS, habits));
  }

  // Goals
  static getGoals(): Goal[] {
    return readValue(STORAGE_KEYS.GOALS, asList<Goal>, isRecordList);
  }
  static saveGoals(goals: Goal[]): boolean {
    return persist(STORAGE_KEYS.GOALS, goals, () => NuqtaIndexedDB.replaceAll(STORES.GOALS, goals));
  }

  // Focus sessions
  static getFocusSessions(): FocusSession[] {
    return readValue(STORAGE_KEYS.FOCUS, asList<FocusSession>, isRecordList);
  }
  static saveFocusSessions(sessions: FocusSession[]): boolean {
    return persist(STORAGE_KEYS.FOCUS, sessions, () => NuqtaIndexedDB.replaceAll(STORES.FOCUS, sessions));
  }

  // Health: only what the user actually logged. No invented values.
  static getHealthMetrics(): Record<string, HealthMetric> {
    return readValue(STORAGE_KEYS.HEALTH, () => ({}) as Record<string, HealthMetric>, isHealthMap);
  }
  static saveHealthMetrics(metrics: Record<string, HealthMetric>): boolean {
    return persist(STORAGE_KEYS.HEALTH, metrics, () =>
      NuqtaIndexedDB.replaceAll(STORES.HEALTH, Object.values(metrics))
    );
  }

  // Expenses
  static getExpenses(): ExpenseRecord[] {
    return readValue(STORAGE_KEYS.EXPENSES, asList<ExpenseRecord>, isRecordList);
  }
  static saveExpenses(expenses: ExpenseRecord[]): boolean {
    return persist(STORAGE_KEYS.EXPENSES, expenses, () => NuqtaIndexedDB.replaceAll(STORES.EXPENSES, expenses));
  }

  // Savings goals
  static getSavingsGoals(): SavingsGoal[] {
    return readValue(STORAGE_KEYS.SAVINGS, asList<SavingsGoal>, isRecordList);
  }
  static saveSavingsGoals(savings: SavingsGoal[]): boolean {
    return persist(STORAGE_KEYS.SAVINGS, savings, () => NuqtaIndexedDB.replaceAll(STORES.SAVINGS, savings));
  }

  // Journal
  static getJournalEntries(): JournalEntry[] {
    return readValue(STORAGE_KEYS.JOURNAL, asList<JournalEntry>, isRecordList);
  }
  static saveJournalEntries(entries: JournalEntry[]): boolean {
    return persist(STORAGE_KEYS.JOURNAL, entries, () => NuqtaIndexedDB.replaceAll(STORES.JOURNAL, entries));
  }

  // Profile
  static getProfile(): UserProfile {
    const stored = readValue<UserProfile | null>(STORAGE_KEYS.PROFILE, () => null, isPlainObject);
    return normalizeProfile(stored);
  }
  static saveProfile(profile: UserProfile): boolean {
    return persist(STORAGE_KEYS.PROFILE, profile, () =>
      NuqtaIndexedDB.replaceAll(STORES.PROFILE, [{ id: 'primary', ...profile }])
    );
  }

  // Sunday rituals
  static getSundayReviews(): SundayRitualReview[] {
    return readValue(STORAGE_KEYS.SUNDAY_REVIEWS, asList<SundayRitualReview>, isRecordList);
  }
  static saveSundayReviews(reviews: SundayRitualReview[]): boolean {
    return persist(STORAGE_KEYS.SUNDAY_REVIEWS, reviews, () =>
      NuqtaIndexedDB.replaceAll(STORES.SUNDAY_REVIEWS, reviews)
    );
  }

  // History audit log
  static getHistoryAuditLogs(): HistoryAuditLogEntry[] {
    return readValue(STORAGE_KEYS.HISTORY_AUDIT, asList<HistoryAuditLogEntry>, isRecordList);
  }
  static saveHistoryAuditLogs(logs: HistoryAuditLogEntry[]): boolean {
    return persist(STORAGE_KEYS.HISTORY_AUDIT, logs, () => NuqtaIndexedDB.replaceAll(STORES.HISTORY_AUDIT, logs));
  }

  // ---------------------------------------------------------------- backup

  /** Snapshot of everything currently stored. Side-effect free. */
  static collectData(): BackupData {
    return {
      tasks: this.getTasks(),
      habits: this.getHabits(),
      goals: this.getGoals(),
      focusSessions: this.getFocusSessions(),
      healthMetrics: this.getHealthMetrics(),
      expenses: this.getExpenses(),
      savingsGoals: this.getSavingsGoals(),
      journalEntries: this.getJournalEntries(),
      profile: this.getProfile(),
      sundayReviews: this.getSundayReviews(),
      historyAuditLogs: this.getHistoryAuditLogs()
    };
  }

  /** Versioned backup file contents (v2 envelope). Side-effect free. */
  static exportFullBackup(): string {
    return JSON.stringify(buildBackupFile(this.collectData()), null, 2);
  }

  /** Check a backup file without touching any stored data. */
  static validateBackup(jsonString: string): ParseBackupResult {
    return parseBackup(jsonString);
  }

  /**
   * Replace ALL stored data with a backup. The file is validated in full first,
   * then written all-or-nothing: if any write fails, every key is rolled back.
   */
  static importBackup(jsonString: string): ImportResult {
    const parsed = parseBackup(jsonString);
    if (!parsed.ok) return parsed;
    const ok = this.restoreData(parsed.data);
    if (!ok) return { ok: false, error: 'write_failed' };
    return { ok: true, version: parsed.version, legacy: parsed.legacy };
  }

  /** Atomic full replace of localStorage + mirror refresh. */
  static restoreData(data: BackupData, meta?: Partial<StorageMeta>): boolean {
    const profile = data.profile ? normalizeProfile(data.profile) : this.getProfile();
    const previousMeta = readMeta();
    const nextMeta: StorageMeta = {
      schemaVersion: SCHEMA_VERSION,
      createdAt: previousMeta?.createdAt ?? new Date().toISOString(),
      ...(meta || {})
    };

    const entries: Array<[string, unknown]> = [
      [STORAGE_KEYS.TASKS, data.tasks],
      [STORAGE_KEYS.HABITS, data.habits],
      [STORAGE_KEYS.GOALS, data.goals],
      [STORAGE_KEYS.FOCUS, data.focusSessions],
      [STORAGE_KEYS.HEALTH, data.healthMetrics],
      [STORAGE_KEYS.EXPENSES, data.expenses],
      [STORAGE_KEYS.SAVINGS, data.savingsGoals],
      [STORAGE_KEYS.JOURNAL, data.journalEntries],
      [STORAGE_KEYS.PROFILE, profile],
      [STORAGE_KEYS.SUNDAY_REVIEWS, data.sundayReviews],
      [STORAGE_KEYS.HISTORY_AUDIT, data.historyAuditLogs],
      [STORAGE_KEYS.META, nextMeta]
    ];

    const serialized: Array<[string, string]> = [];
    try {
      for (const [key, value] of entries) serialized.push([key, JSON.stringify(value)]);
    } catch {
      report({ kind: 'write_failed', key: 'restore', detail: 'not serializable' });
      return false;
    }

    const previous = serialized.map(([key]) => [key, localStorage.getItem(key)] as const);
    try {
      for (const [key, value] of serialized) localStorage.setItem(key, value);
    } catch (e) {
      for (const [key, old] of previous) {
        try {
          if (old === null) localStorage.removeItem(key);
          else localStorage.setItem(key, old);
        } catch {
          /* best effort rollback */
        }
      }
      report({ kind: 'write_failed', key: 'restore', detail: e instanceof Error ? e.name : String(e) });
      return false;
    }

    void this.refreshMirror({ ...data, profile }, nextMeta);
    return true;
  }

  private static async refreshMirror(data: BackupData, meta: StorageMeta): Promise<void> {
    await Promise.all([
      NuqtaIndexedDB.replaceAll(STORES.TASKS, data.tasks),
      NuqtaIndexedDB.replaceAll(STORES.HABITS, data.habits),
      NuqtaIndexedDB.replaceAll(STORES.GOALS, data.goals),
      NuqtaIndexedDB.replaceAll(STORES.FOCUS, data.focusSessions),
      NuqtaIndexedDB.replaceAll(STORES.HEALTH, Object.values(data.healthMetrics)),
      NuqtaIndexedDB.replaceAll(STORES.EXPENSES, data.expenses),
      NuqtaIndexedDB.replaceAll(STORES.SAVINGS, data.savingsGoals),
      NuqtaIndexedDB.replaceAll(STORES.JOURNAL, data.journalEntries),
      NuqtaIndexedDB.replaceAll(STORES.PROFILE, [{ id: 'primary', ...data.profile }]),
      NuqtaIndexedDB.replaceAll(STORES.SUNDAY_REVIEWS, data.sundayReviews),
      NuqtaIndexedDB.replaceAll(STORES.HISTORY_AUDIT, data.historyAuditLogs),
      NuqtaIndexedDB.replaceAll(STORES.META, [{ id: 'meta', ...meta }])
    ]);
  }

  // -------------------------------------------------------------- recovery

  /**
   * If localStorage has lost NUQTA's data but the IndexedDB mirror still has it,
   * restore from the mirror. A deliberate wipe clears BOTH, so it is never undone.
   * Call once at startup, before the store initialises. Resolves true if restored.
   */
  static async recoverFromMirrorIfNeeded(): Promise<boolean> {
    if (readMeta()) return false;
    const metaRows = await NuqtaIndexedDB.getAll<StorageMeta & { id: string }>(STORES.META);
    if (metaRows.length === 0) return false;

    const [tasks, habits, goals, focusSessions, health, expenses, savingsGoals, journalEntries, profiles, sundayReviews, historyAuditLogs] =
      await Promise.all([
        NuqtaIndexedDB.getAll<Task>(STORES.TASKS),
        NuqtaIndexedDB.getAll<Habit>(STORES.HABITS),
        NuqtaIndexedDB.getAll<Goal>(STORES.GOALS),
        NuqtaIndexedDB.getAll<FocusSession>(STORES.FOCUS),
        NuqtaIndexedDB.getAll<HealthMetric>(STORES.HEALTH),
        NuqtaIndexedDB.getAll<ExpenseRecord>(STORES.EXPENSES),
        NuqtaIndexedDB.getAll<SavingsGoal>(STORES.SAVINGS),
        NuqtaIndexedDB.getAll<JournalEntry>(STORES.JOURNAL),
        NuqtaIndexedDB.getAll<UserProfile & { id: string }>(STORES.PROFILE),
        NuqtaIndexedDB.getAll<SundayRitualReview>(STORES.SUNDAY_REVIEWS),
        NuqtaIndexedDB.getAll<HistoryAuditLogEntry>(STORES.HISTORY_AUDIT)
      ]);

    const healthMetrics: Record<string, HealthMetric> = {};
    health.forEach((h) => {
      healthMetrics[h.date] = h;
    });
    const stripId = (p?: UserProfile & { id?: string }): Partial<UserProfile> | undefined => {
      if (!p) return undefined;
      const { id: _id, ...rest } = p;
      return rest;
    };

    const data: BackupData = {
      tasks,
      habits,
      goals,
      focusSessions,
      healthMetrics,
      expenses,
      savingsGoals,
      journalEntries,
      profile: stripId(profiles[0]),
      sundayReviews,
      historyAuditLogs
    };
    const { id: _metaId, ...meta } = metaRows[0];
    return this.restoreData(data, meta);
  }

  // ------------------------------------------------------------ sample data

  /** True when the user has no content of their own yet. */
  static isEmpty(): boolean {
    return (
      this.getTasks().length === 0 &&
      this.getHabits().length === 0 &&
      this.getGoals().length === 0 &&
      this.getExpenses().length === 0 &&
      this.getSavingsGoals().length === 0 &&
      this.getJournalEntries().length === 0 &&
      this.getFocusSessions().length === 0
    );
  }

  static isDemo(): boolean {
    return readMeta()?.demo === true;
  }

  /**
   * OPT-IN sample data, only into an empty app, and flagged as demo.
   * Never touches the profile or journal.
   */
  static loadDemoData(): boolean {
    if (!this.isEmpty()) return false;
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
    const base = this.collectData();
    return this.restoreData(
      {
        ...base,
        tasks: clone(DEMO_TASKS),
        habits: clone(DEMO_HABITS),
        goals: clone(DEMO_GOALS),
        expenses: clone(DEMO_EXPENSES),
        savingsGoals: clone(DEMO_SAVINGS_GOALS)
      },
      { demo: true }
    );
  }

  // ------------------------------------------------------------------ wipe

  /**
   * Delete every NUQTA record from BOTH localStorage and IndexedDB.
   * Only touches keys that start with "nuqta_" (other apps on the same origin are untouched).
   * Resolves true only when both stores were fully cleared.
   */
  static async wipeAll(): Promise<boolean> {
    // Mirror first: if it cannot be cleared, keep localStorage so the mirror cannot
    // later "recover" data the user asked to delete.
    const mirrorCleared = await NuqtaIndexedDB.wipeAll();
    if (!mirrorCleared) return false;
    let localCleared = true;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(KEY_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      localCleared = false;
    }
    clearStorageIssues();
    return localCleared;
  }
}
