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
};

/**
 * Hybrid storage engine:
 * 1. Synchronous localStorage for instantaneous React rendering & SSR safety
 * 2. Asynchronous IndexedDB for persistent, high-capacity local offline database storage
 * 3. 100% offline, zero server or API key required
 */
export class NuqtaStorageEngine {
  // Tasks
  static getTasks(): Task[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      NuqtaIndexedDB.bulkPut(STORES.TASKS, INITIAL_TASKS);
      return INITIAL_TASKS;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return INITIAL_TASKS;
    }
  }

  static saveTasks(tasks: Task[]): void {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    NuqtaIndexedDB.bulkPut(STORES.TASKS, tasks);
  }

  // Habits
  static getHabits(): Habit[] {
    const raw = localStorage.getItem(STORAGE_KEYS.HABITS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(INITIAL_HABITS));
      NuqtaIndexedDB.bulkPut(STORES.HABITS, INITIAL_HABITS);
      return INITIAL_HABITS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_HABITS;
    }
  }

  static saveHabits(habits: Habit[]): void {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    NuqtaIndexedDB.bulkPut(STORES.HABITS, habits);
  }

  // Goals
  static getGoals(): Goal[] {
    const raw = localStorage.getItem(STORAGE_KEYS.GOALS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(INITIAL_GOALS));
      NuqtaIndexedDB.bulkPut(STORES.GOALS, INITIAL_GOALS);
      return INITIAL_GOALS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_GOALS;
    }
  }

  static saveGoals(goals: Goal[]): void {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    NuqtaIndexedDB.bulkPut(STORES.GOALS, goals);
  }

  // Focus Sessions
  static getFocusSessions(): FocusSession[] {
    const raw = localStorage.getItem(STORAGE_KEYS.FOCUS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveFocusSessions(sessions: FocusSession[]): void {
    localStorage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(sessions));
    NuqtaIndexedDB.bulkPut(STORES.FOCUS, sessions);
  }

  // Health Metrics
  static getHealthMetrics(): Record<string, HealthMetric> {
    const raw = localStorage.getItem(STORAGE_KEYS.HEALTH);
    const today = new Date().toISOString().split('T')[0];
    const defaultToday: HealthMetric = {
      date: today,
      sleepHours: 7.5,
      sleepQuality: 4,
      hydrationMl: 1750,
      targetHydrationMl: 2500,
      workoutLogged: true,
      workoutType: 'Zone 2 Cardio & Stretch',
      workoutMinutes: 35,
      moodRating: 4,
      weightKg: 73.2,
      energyScore: 88
    };

    if (!raw) {
      const initial = { [today]: defaultToday };
      localStorage.setItem(STORAGE_KEYS.HEALTH, JSON.stringify(initial));
      NuqtaIndexedDB.put(STORES.HEALTH, defaultToday);
      return initial;
    }
    try {
      const data = JSON.parse(raw);
      if (!data[today]) {
        data[today] = defaultToday;
        localStorage.setItem(STORAGE_KEYS.HEALTH, JSON.stringify(data));
        NuqtaIndexedDB.put(STORES.HEALTH, defaultToday);
      }
      return data;
    } catch {
      return { [today]: defaultToday };
    }
  }

  static saveHealthMetrics(metrics: Record<string, HealthMetric>): void {
    localStorage.setItem(STORAGE_KEYS.HEALTH, JSON.stringify(metrics));
    const items = Object.values(metrics);
    NuqtaIndexedDB.bulkPut(STORES.HEALTH, items);
  }

  // Expenses & Budget
  static getExpenses(): ExpenseRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      NuqtaIndexedDB.bulkPut(STORES.EXPENSES, INITIAL_EXPENSES);
      return INITIAL_EXPENSES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EXPENSES;
    }
  }

  static saveExpenses(expenses: ExpenseRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    NuqtaIndexedDB.bulkPut(STORES.EXPENSES, expenses);
  }

  // Savings Goals
  static getSavingsGoals(): SavingsGoal[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(INITIAL_SAVINGS_GOALS));
      NuqtaIndexedDB.bulkPut(STORES.SAVINGS, INITIAL_SAVINGS_GOALS);
      return INITIAL_SAVINGS_GOALS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SAVINGS_GOALS;
    }
  }

  static saveSavingsGoals(savings: SavingsGoal[]): void {
    localStorage.setItem(STORAGE_KEYS.SAVINGS, JSON.stringify(savings));
    NuqtaIndexedDB.bulkPut(STORES.SAVINGS, savings);
  }

  // Journal
  static getJournalEntries(): JournalEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.JOURNAL);
    if (!raw) {
      const initialEntry: JournalEntry = {
        id: 'j-1',
        date: new Date().toISOString().split('T')[0],
        whatWentWell: 'Eliminated distractions early and executed the 90-minute core architectural task cleanly.',
        whatDrainedEnergy: 'Context-switching during afternoon communication triage.',
        planForTomorrow: 'Block 2 hours of quiet time before noon. Do not check messages before first top task is done.',
        gratitudeList: ['Good health and quiet mornings', 'Clean tea and water', 'Fulfilling work'],
        mood: 4,
        isEncrypted: false,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify([initialEntry]));
      NuqtaIndexedDB.put(STORES.JOURNAL, initialEntry);
      return [initialEntry];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveJournalEntries(entries: JournalEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(entries));
    NuqtaIndexedDB.bulkPut(STORES.JOURNAL, entries);
  }

  // Profile & Preferences
  static getProfile(): UserProfile {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(INITIAL_PROFILE));
      NuqtaIndexedDB.put(STORES.PROFILE, { id: 'primary', ...INITIAL_PROFILE });
      return INITIAL_PROFILE;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PROFILE;
    }
  }

  static saveProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    NuqtaIndexedDB.put(STORES.PROFILE, { id: 'primary', ...profile });
  }

  // Sunday Rituals
  static getSundayReviews(): SundayRitualReview[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUNDAY_REVIEWS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveSundayReviews(reviews: SundayRitualReview[]): void {
    localStorage.setItem(STORAGE_KEYS.SUNDAY_REVIEWS, JSON.stringify(reviews));
    NuqtaIndexedDB.bulkPut(STORES.SUNDAY_REVIEWS, reviews);
  }

  // History Audit Log
  static getHistoryAuditLogs(): HistoryAuditLogEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY_AUDIT);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveHistoryAuditLogs(logs: HistoryAuditLogEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.HISTORY_AUDIT, JSON.stringify(logs));
  }

  // Export full archive as JSON
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

  // Import full archive
  static importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.tasks) this.saveTasks(data.tasks);
      if (data.habits) this.saveHabits(data.habits);
      if (data.goals) this.saveGoals(data.goals);
      if (data.focusSessions) this.saveFocusSessions(data.focusSessions);
      if (data.healthMetrics) this.saveHealthMetrics(data.healthMetrics);
      if (data.expenses) this.saveExpenses(data.expenses);
      if (data.savingsGoals) this.saveSavingsGoals(data.savingsGoals);
      if (data.journalEntries) this.saveJournalEntries(data.journalEntries);
      if (data.profile) this.saveProfile(data.profile);
      if (data.sundayReviews) this.saveSundayReviews(data.sundayReviews);
      if (data.historyAuditLogs) this.saveHistoryAuditLogs(data.historyAuditLogs);
      return true;
    } catch (e) {
      console.error('Import backup failed:', e);
      return false;
    }
  }

  // Wipe all data across localStorage & IndexedDB
  static async wipeAll(): Promise<void> {
    localStorage.clear();
    await NuqtaIndexedDB.wipeAll();
  }
}
