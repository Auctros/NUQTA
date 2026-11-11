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

/** Array whose every element is an object with a non-empty string id. */
export const isRecordList = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((x) => isPlainObject(x) && typeof x.id === 'string' && x.id.length > 0);

/** Record<date, HealthMetric>: every value is an object carrying a string date. */
export const isHealthMap = (v: unknown): boolean =>
  isPlainObject(v) && Object.values(v).every((x) => isPlainObject(x) && typeof x.date === 'string');

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
    if (!isRecordList(value)) return { ok: false, error: 'invalid_section', section: key };
    (data as unknown as Record<string, unknown>)[key] = value;
  }

  if (source.healthMetrics !== undefined) {
    if (!isHealthMap(source.healthMetrics)) {
      return { ok: false, error: 'invalid_section', section: 'healthMetrics' };
    }
    data.healthMetrics = source.healthMetrics as Record<string, HealthMetric>;
  }

  if (source.profile !== undefined) {
    if (!isPlainObject(source.profile)) {
      return { ok: false, error: 'invalid_section', section: 'profile' };
    }
    data.profile = source.profile as Partial<UserProfile>;
  }

  return { ok: true, data, version, legacy };
}

export function buildBackupFile(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}
