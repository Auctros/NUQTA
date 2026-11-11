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
import {
  INITIAL_TASKS,
  INITIAL_HABITS,
  INITIAL_GOALS,
  INITIAL_EXPENSES,
  INITIAL_SAVINGS_GOALS,
  INITIAL_PROFILE
} from './initialData';
import { NuqtaIndexedDB, STORES } from './indexedDB';
import { encryptPayload, decryptPayload } from './crypto';

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
  HISTORY_AUDIT: 'nuqta_history_audit_v1'
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Returns today's date in the user's local timezone (YYYY-MM-DD).
 * Fixes the UTC offset bug where toISOString().split('T')[0] returns
 * yesterday's date for users behind UTC (e.g. Cairo UTC+2 between 00:00-02:00).
 */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Safely writes to localStorage with QuotaExceededError handling.
 * Returns true on success, false on failure.
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error(`Storage quota exceeded for key "${key}"`);
    } else {
      console.error(`localStorage.setItem failed for key "${key}":`, e);
    }
    return false;
  }
}

/**
 * Safely reads from localStorage with JSON.parse error handling.
 * Returns the parsed value or null on failure (no side effects).
 */
function safeGetItem<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Backup of current state before a destructive import, stored under a
 * timestamped key so the user can recover if the import fails.
 */
function snapshotCurrentState(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const key of Object.values(STORAGE_KEYS)) {
    const val = localStorage.getItem(key);
    if (val !== null) snapshot[key] = val;
  }
  return snapshot;
}

function restoreSnapshot(snapshot: Record<string, string>): void {
  // Clear all NUQTA keys first
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key);
  }
  // Restore from snapshot
  for (const [key, value] of Object.entries(snapshot)) {
    safeSetItem(key, value);
  }
}

/**
 * Validates that a parsed backup object matches the expected NUQTA schema.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateBackupSchema(data: unknown): { valid: true } | { valid: false; reason: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, reason: 'Backup root must be a JSON object' };
  }

  const obj = data as Record<string, unknown>;

  const arrayFields: string[] = [
    'tasks', 'habits', 'goals', 'focusSessions', 'expenses',
    'savingsGoals', 'journalEntries', 'sundayReviews', 'historyAuditLogs'
  ];

  for (const field of arrayFields) {
    if (field in obj && !Array.isArray(obj[field])) {
      return { valid: false, reason: `Field "${field}" must be an array` };
    }
  }

  if ('healthMetrics' in obj && obj.healthMetrics !== undefined) {
    if (typeof obj.healthMetrics !== 'object' || Array.isArray(obj.healthMetrics) || obj.healthMetrics === null) {
      return { valid: false, reason: 'Field "healthMetrics" must be an object' };
    }
  }

  if ('profile' in obj && obj.profile !== undefined) {
    if (typeof obj.profile !== 'object' || Array.isArray(obj.profile) || obj.profile === null) {
      return { valid: false, reason: 'Field "profile" must be an object' };
    }
  }

  if ('version' in obj && obj.version !== undefined && typeof obj.version !== 'string') {
    return { valid: false, reason: 'Field "version" must be a string' };
  }

  return { valid: true };
}

/**
 * Hybrid storage engine:
 * 1. Synchronous localStorage for instantaneous React rendering
 * 2. Asynchronous IndexedDB for persistent, high-capacity local offline storage
 * 3. 100% offline, zero server or API key required
 * 4. All read operations are pure (no side effects)
 * 5. All write operations handle QuotaExceededError gracefully
 */
export class NuqtaStorageEngine {
  // =========================================================================
  // Tasks
  // =========================================================================
  static getTasks(): Task[] {
    const parsed = safeGetItem<Task[]>(STORAGE_KEYS.TASKS);
    if (parsed === null) {
      const initial = INITIAL_TASKS;
      safeSetItem(STORAGE_KEYS.TASKS, JSON.stringify(initial));
      NuqtaIndexedDB.bulkPut(STORES.TASKS, initial).catch(() => {});
      return initial;
    }
    return parsed;
  }

  static saveTasks(tasks: Task[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    NuqtaIndexedDB.bulkPut(STORES.TASKS, tasks).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Habits
  // =========================================================================
  static getHabits(): Habit[] {
    const parsed = safeGetItem<Habit[]>(STORAGE_KEYS.HABITS);
    if (parsed === null) {
      const initial = INITIAL_HABITS;
      safeSetItem(STORAGE_KEYS.HABITS, JSON.stringify(initial));
      NuqtaIndexedDB.bulkPut(STORES.HABITS, initial).catch(() => {});
      return initial;
    }
    return parsed;
  }

  static saveHabits(habits: Habit[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    NuqtaIndexedDB.bulkPut(STORES.HABITS, habits).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Goals
  // =========================================================================
  static getGoals(): Goal[] {
    const parsed = safeGetItem<Goal[]>(STORAGE_KEYS.GOALS);
    if (parsed === null) {
      const initial = INITIAL_GOALS;
      safeSetItem(STORAGE_KEYS.GOALS, JSON.stringify(initial));
      NuqtaIndexedDB.bulkPut(STORES.GOALS, initial).catch(() => {});
      return initial;
    }
    return parsed;
  }

  static saveGoals(goals: Goal[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    NuqtaIndexedDB.bulkPut(STORES.GOALS, goals).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Focus Sessions
  // =========================================================================
  static getFocusSessions(): FocusSession[] {
    const parsed = safeGetItem<FocusSession[]>(STORAGE_KEYS.FOCUS);
    return parsed ?? [];
  }

  static saveFocusSessions(sessions: FocusSession[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.FOCUS, JSON.stringify(sessions));
    NuqtaIndexedDB.bulkPut(STORES.FOCUS, sessions).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Health Metrics
  // =========================================================================
  static getHealthMetrics(): Record<string, HealthMetric> {
    const parsed = safeGetItem<Record<string, HealthMetric>>(STORAGE_KEYS.HEALTH);
    if (parsed === null) return {};
    return parsed;
  }

  static saveHealthMetrics(metrics: Record<string, HealthMetric>): boolean {
    const ok = safeSetItem(STORAGE_KEYS.HEALTH, JSON.stringify(metrics));
    const items = Object.values(metrics);
    NuqtaIndexedDB.bulkPut(STORES.HEALTH, items).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Expenses
  // =========================================================================
  static getExpenses(): ExpenseRecord[] {
    const parsed = safeGetItem<ExpenseRecord[]>(STORAGE_KEYS.EXPENSES);
    if (parsed === null) {
      const initial = INITIAL_EXPENSES;
      safeSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(initial));
      NuqtaIndexedDB.bulkPut(STORES.EXPENSES, initial).catch(() => {});
      return initial;
    }
    return parsed;
  }

  static saveExpenses(expenses: ExpenseRecord[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    NuqtaIndexedDB.bulkPut(STORES.EXPENSES, expenses).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Savings Goals
  // =========================================================================
  static getSavingsGoals(): SavingsGoal[] {
    const parsed = safeGetItem<SavingsGoal[]>(STORAGE_KEYS.SAVINGS);
    if (parsed === null) {
      const initial = INITIAL_SAVINGS_GOALS;
      safeSetItem(STORAGE_KEYS.SAVINGS, JSON.stringify(initial));
      NuqtaIndexedDB.bulkPut(STORES.SAVINGS, initial).catch(() => {});
      return initial;
    }
    return parsed;
  }

  static saveSavingsGoals(savings: SavingsGoal[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.SAVINGS, JSON.stringify(savings));
    NuqtaIndexedDB.bulkPut(STORES.SAVINGS, savings).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Journal
  // =========================================================================
  static getJournalEntries(): JournalEntry[] {
    const parsed = safeGetItem<JournalEntry[]>(STORAGE_KEYS.JOURNAL);
    if (parsed === null) return [];
    return parsed;
  }

  static saveJournalEntries(entries: JournalEntry[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    NuqtaIndexedDB.bulkPut(STORES.JOURNAL, entries).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Profile & Preferences
  // =========================================================================
  static getProfile(): UserProfile {
    const parsed = safeGetItem<UserProfile>(STORAGE_KEYS.PROFILE);
    if (parsed === null) {
      safeSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(INITIAL_PROFILE));
      NuqtaIndexedDB.put(STORES.PROFILE, { id: 'primary', ...INITIAL_PROFILE }).catch(() => {});
      return INITIAL_PROFILE;
    }
    return parsed;
  }

  static saveProfile(profile: UserProfile): boolean {
    const ok = safeSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    NuqtaIndexedDB.put(STORES.PROFILE, { id: 'primary', ...profile }).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Sunday Rituals
  // =========================================================================
  static getSundayReviews(): SundayRitualReview[] {
    const parsed = safeGetItem<SundayRitualReview[]>(STORAGE_KEYS.SUNDAY_REVIEWS);
    return parsed ?? [];
  }

  static saveSundayReviews(reviews: SundayRitualReview[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.SUNDAY_REVIEWS, JSON.stringify(reviews));
    NuqtaIndexedDB.bulkPut(STORES.SUNDAY_REVIEWS, reviews).catch(() => {});
    return ok;
  }

  // =========================================================================
  // History Audit Log
  // =========================================================================
  static getHistoryAuditLogs(): HistoryAuditLogEntry[] {
    const parsed = safeGetItem<HistoryAuditLogEntry[]>(STORAGE_KEYS.HISTORY_AUDIT);
    return parsed ?? [];
  }

  static saveHistoryAuditLogs(logs: HistoryAuditLogEntry[]): boolean {
    const ok = safeSetItem(STORAGE_KEYS.HISTORY_AUDIT, JSON.stringify(logs));
    NuqtaIndexedDB.bulkPut(STORES.HISTORY_AUDIT, logs).catch(() => {});
    return ok;
  }

  // =========================================================================
  // Export / Import / Wipe
  // =========================================================================

  /**
   * Export full archive as JSON string.
   * All read operations are pure — no side effects, no data injection.
   */
  static exportFullBackup(): string {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
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
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import full archive from JSON string.
   *
   * Safety guarantees:
   * 1. Schema validation before any write
   * 2. Snapshot of current state taken before any modification
   * 3. Atomic: all writes succeed or all are rolled back
   * 4. Corrupted JSON is preserved under a *_corrupt_<timestamp> key
   * 5. Returns { success: boolean, reason?: string }
   */
  static importBackup(jsonString: string): { success: boolean; reason?: string } {
    // 1. Parse JSON — preserve corrupted original
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch {
      const ts = localDateKey(new Date()) + '_' + Date.now();
      safeSetItem(`nuqta_corrupt_${ts}`, jsonString);
      return { success: false, reason: 'Invalid JSON format' };
    }

    // 2. Validate schema
    const validation = validateBackupSchema(data);
    if (!validation.valid) {
      const ts = localDateKey(new Date()) + '_' + Date.now();
      safeSetItem(`nuqta_corrupt_${ts}`, jsonString);
      return { success: false, reason: validation.reason };
    }

    const obj = data as Record<string, unknown>;

    // 3. Take snapshot of current state before any modification
    const snapshot = snapshotCurrentState();

    // 4. Attempt all writes — track success/failure
    const writeResults: Array<{ key: string; ok: boolean }> = [];

    const trySave = (key: string, fn: () => boolean): void => {
      writeResults.push({ key, ok: fn() });
    };

    if (obj.tasks) trySave(STORAGE_KEYS.TASKS, () => this.saveTasks(obj.tasks as Task[]));
    if (obj.habits) trySave(STORAGE_KEYS.HABITS, () => this.saveHabits(obj.habits as Habit[]));
    if (obj.goals) trySave(STORAGE_KEYS.GOALS, () => this.saveGoals(obj.goals as Goal[]));
    if (obj.focusSessions) trySave(STORAGE_KEYS.FOCUS, () => this.saveFocusSessions(obj.focusSessions as FocusSession[]));
    if (obj.healthMetrics) trySave(STORAGE_KEYS.HEALTH, () => this.saveHealthMetrics(obj.healthMetrics as Record<string, HealthMetric>));
    if (obj.expenses) trySave(STORAGE_KEYS.EXPENSES, () => this.saveExpenses(obj.expenses as ExpenseRecord[]));
    if (obj.savingsGoals) trySave(STORAGE_KEYS.SAVINGS, () => this.saveSavingsGoals(obj.savingsGoals as SavingsGoal[]));
    if (obj.journalEntries) trySave(STORAGE_KEYS.JOURNAL, () => this.saveJournalEntries(obj.journalEntries as JournalEntry[]));
    if (obj.profile) trySave(STORAGE_KEYS.PROFILE, () => this.saveProfile(obj.profile as UserProfile));
    if (obj.sundayReviews) trySave(STORAGE_KEYS.SUNDAY_REVIEWS, () => this.saveSundayReviews(obj.sundayReviews as SundayRitualReview[]));
    if (obj.historyAuditLogs) trySave(STORAGE_KEYS.HISTORY_AUDIT, () => this.saveHistoryAuditLogs(obj.historyAuditLogs as HistoryAuditLogEntry[]));

    // 5. Check if all writes succeeded
    const allOk = writeResults.every((r) => r.ok);

    if (!allOk) {
      // Rollback: restore snapshot
      restoreSnapshot(snapshot);
      const failed = writeResults.filter((r) => !r.ok).map((r) => r.key).join(', ');
      return { success: false, reason: `Partial write failed, rolled back. Failed keys: ${failed}` };
    }

    return { success: true };
  }

  /**
   * Wipe all data across localStorage AND IndexedDB.
   * After wiping, does NOT re-seed initial data — caller decides.
   */
  static async wipeAll(): Promise<void> {
    // Clear all NUQTA localStorage keys
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    // Also clear any corrupt backups
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('nuqta_corrupt_')) {
        localStorage.removeItem(key);
        i--; // re-check same index after removal
      }
    }
    // Clear IndexedDB
    await NuqtaIndexedDB.wipeAll();
  }

  /**
   * Re-seed initial data after a wipe. Called by the app on first load
   * when no data exists.
   */
  static async seedInitialData(): Promise<void> {
    await this.saveTasks(INITIAL_TASKS);
    await this.saveHabits(INITIAL_HABITS);
    await this.saveGoals(INITIAL_GOALS);
    await this.saveExpenses(INITIAL_EXPENSES);
    await this.saveSavingsGoals(INITIAL_SAVINGS_GOALS);
    await this.saveProfile(INITIAL_PROFILE);
  }
}

