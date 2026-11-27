/**
 * Remote change application.
 *
 * Applies inbound server changes to localStorage, which remains the source of truth.
 * The invariants this module exists to protect:
 *
 *  - Deletion wins over any older write. A remote delete is always applied, even when
 *    this device holds an unsent edit for the same record: the delete is an explicit
 *    user intent, and letting a stale offline edit win is exactly the resurrection bug
 *    this module must prevent. The blocked outbox entries are dropped rather than
 *    retried, because the server would refuse them anyway.
 *  - A remote create/update for a record this device has tombstoned is skipped, so a
 *    device cannot be made to re-create a record it just deleted.
 *  - Otherwise, a remote change that would replace a record with unsent local edits is
 *    NOT applied; it is recorded as a conflict and left alone.
 *  - Never write a partial record set. All changes for one section are computed first
 *    and written once, so a section is never left half-updated.
 *  - Applying is idempotent: re-applying the same serverChangeId is a no-op.
 *  - Echoes are suppressed at the capture layer, so applying a remote change never
 *    enqueues an outbound change.
 */

import { NuqtaStorageEngine, SYNC_SECTION_KEYS, type SyncSectionName } from '../storage';
import { readOutbox, dropOutboxEntriesFor } from './outbox';
import { SINGLETON_RECORD_ID, withCaptureSuppressed } from './changeCapture';
import type { InboundChange } from './protocol';

const APPLIED_KEY = 'nuqta_sync_applied_v1';
const CONFLICTS_KEY = 'nuqta_sync_conflicts_v1';
/**
 * Records this device knows to be deleted.
 *
 * The server also enforces this, so why keep a local copy? Because the two protections
 * cover different windows. The server guard stops a *write*; this ledger stops a *read* —
 * a delta page or broadcast that was already in flight when the delete landed can still
 * carry an older `create` for the record, and applying it would resurrect the record on
 * this device only. Entries expire with the same 30-day horizon the server uses.
 */
const TOMBSTONES_KEY = 'nuqta_sync_tombstones_v1';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Sections whose stored value is a keyed map rather than a list. */
const MAP_SECTIONS = new Set<SyncSectionName>(['health_metrics']);
const SINGLETON_SECTIONS = new Set<SyncSectionName>(['profile']);

export interface SyncConflict {
  storeName: SyncSectionName;
  recordId: string;
  /** The incoming change that was not applied. */
  incoming: InboundChange;
  /** The local payload that was protected from being overwritten. */
  localPayload: unknown;
  /** The local outbox entries that made this a conflict. */
  blockedBy: string[];
  detectedAt: string;
}

export interface ApplyResult {
  applied: number;
  skippedDuplicates: number;
  /** Inbound writes ignored because the record is deleted (locally or by the delete). */
  supersededInbound: number;
  conflicts: SyncConflict[];
  /** Highest serverChangeId actually consumed (applied or intentionally skipped). */
  highestConsumed: number;
}

const appliedListeners = new Set<() => void>();

/**
 * Subscribe to "remote changes were applied" so the in-memory store can reload.
 * Persistence stays authoritative; this only tells the UI to re-read it.
 */
export function onRemoteApplied(fn: () => void): () => void {
  appliedListeners.add(fn);
  return () => {
    appliedListeners.delete(fn);
  };
}

/** Read the set of already-applied server change ids. */
export function readApplied(): Set<number> {
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((n) => typeof n === 'number')) : new Set();
  } catch {
    return new Set();
  }
}

function writeApplied(applied: Set<number>): void {
  // Keep the ledger bounded; only the recent window matters for dedupe because the
  // cursor already prevents re-pulling older changes.
  const values = [...applied].sort((a, b) => a - b).slice(-2000);
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify(values));
  } catch {
    /* dedupe is an optimization; the cursor is the real guard */
  }
}

export function readConflicts(): SyncConflict[] {
  try {
    const raw = localStorage.getItem(CONFLICTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncConflict[]) : [];
  } catch {
    return [];
  }
}

function appendConflicts(next: SyncConflict[]): void {
  if (next.length === 0) return;
  const all = [...readConflicts(), ...next].slice(-200);
  try {
    localStorage.setItem(CONFLICTS_KEY, JSON.stringify(all));
  } catch {
    /* conflict bookkeeping must never block applying other changes */
  }
}

export function clearConflicts(): void {
  try {
    localStorage.removeItem(CONFLICTS_KEY);
  } catch {
    /* nothing else we can do */
  }
}

/** Local tombstone ledger: `${section}::${recordId}` → deletion timestamp (ms). */
type TombstoneLedger = Record<string, number>;

function readTombstones(): TombstoneLedger {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TombstoneLedger) : {};
  } catch {
    return {};
  }
}

function writeTombstones(ledger: TombstoneLedger): void {
  try {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(ledger));
  } catch {
    /* the server guard still prevents resurrection; this is defence in depth */
  }
}

/** Record that a record is deleted locally, so an inbound stale write cannot revive it. */
export function rememberTombstone(storeName: SyncSectionName, recordId: string): void {
  const ledger = pruneTombstones(readTombstones());
  ledger[`${storeName}::${recordId}`] = Date.now();
  writeTombstones(ledger);
}

/** True when this device has recorded a deletion for the record. */
export function isLocallyDeleted(storeName: SyncSectionName, recordId: string): boolean {
  const stamp = readTombstones()[`${storeName}::${recordId}`];
  if (typeof stamp !== 'number') return false;
  return Date.now() - stamp < TOMBSTONE_TTL_MS;
}

/**
 * Drop expired ledger entries so the key cannot grow without bound.
 * Called on write, which is the only moment the set can grow.
 */
function pruneTombstones(ledger: TombstoneLedger): TombstoneLedger {
  const now = Date.now();
  const next: TombstoneLedger = {};
  for (const [key, stamp] of Object.entries(ledger)) {
    if (typeof stamp === 'number' && now - stamp < TOMBSTONE_TTL_MS) next[key] = stamp;
  }
  return next;
}

export function clearTombstones(): void {
  try {
    localStorage.removeItem(TOMBSTONES_KEY);
  } catch {
    /* nothing else we can do */
  }
}

/**
 * Remove one record locally without enqueuing a delete.
 *
 * Used when the server tells this device its write was superseded: the record no longer
 * exists server-side, so keeping the local copy would leave this device showing data
 * nobody else has and that no future sync can ever reconcile. Capture is suppressed
 * because the deletion is not a user action — sending a delete for an already-deleted
 * record would just be superseded again.
 */
export function dropRecordLocally(storeName: SyncSectionName, recordId: string): boolean {
  const current = readSection(storeName);
  if (storeName === 'profile') {
    // `profile` is a singleton object, not a list; nothing to remove.
    return false;
  }
  if (!Array.isArray(current)) return false;
  const next = current.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    return (item as { id?: unknown }).id !== recordId;
  });
  if (next.length === current.length) return false;
  rememberTombstone(storeName, recordId);
  return withCaptureSuppressed(() => writeSection(storeName, next));
}

function readSection(section: SyncSectionName): unknown {
  switch (section) {
    case 'tasks':
      return NuqtaStorageEngine.getTasks();
    case 'habits':
      return NuqtaStorageEngine.getHabits();
    case 'goals':
      return NuqtaStorageEngine.getGoals();
    case 'focus_sessions':
      return NuqtaStorageEngine.getFocusSessions();
    case 'health_metrics':
      return NuqtaStorageEngine.getHealthMetrics();
    case 'expenses':
      return NuqtaStorageEngine.getExpenses();
    case 'savings_goals':
      return NuqtaStorageEngine.getSavingsGoals();
    case 'journal_entries':
      return NuqtaStorageEngine.getJournalEntries();
    case 'profile':
      return NuqtaStorageEngine.getProfile();
    case 'sunday_reviews':
      return NuqtaStorageEngine.getSundayReviews();
    case 'history_audit':
      return NuqtaStorageEngine.getHistoryAuditLogs();
    default:
      return null;
  }
}

function writeSection(section: SyncSectionName, value: unknown): boolean {
  switch (section) {
    case 'tasks':
      return NuqtaStorageEngine.saveTasks(value as never);
    case 'habits':
      return NuqtaStorageEngine.saveHabits(value as never);
    case 'goals':
      return NuqtaStorageEngine.saveGoals(value as never);
    case 'focus_sessions':
      return NuqtaStorageEngine.saveFocusSessions(value as never);
    case 'health_metrics':
      return NuqtaStorageEngine.saveHealthMetrics(value as never);
    case 'expenses':
      return NuqtaStorageEngine.saveExpenses(value as never);
    case 'savings_goals':
      return NuqtaStorageEngine.saveSavingsGoals(value as never);
    case 'journal_entries':
      return NuqtaStorageEngine.saveJournalEntries(value as never);
    case 'profile':
      return NuqtaStorageEngine.saveProfile(value as never);
    case 'sunday_reviews':
      return NuqtaStorageEngine.saveSundayReviews(value as never);
    case 'history_audit':
      return NuqtaStorageEngine.saveHistoryAuditLogs(value as never);
    default:
      return false;
  }
}

/** A record id → payload view of the current section, for conflict checks. */
function currentRecordMap(section: SyncSectionName): Record<string, unknown> {
  const value = readSection(section);
  if (SINGLETON_SECTIONS.has(section)) {
    return { [SINGLETON_RECORD_ID]: value };
  }
  if (MAP_SECTIONS.has(section)) {
    return (value ?? {}) as Record<string, unknown>;
  }
  const map: Record<string, unknown> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string') {
        map[(entry as { id: string }).id] = entry;
      }
    }
  }
  return map;
}

/**
 * Apply a batch of inbound changes.
 *
 * Changes are grouped per section and written once per section. A change is skipped as
 * a conflict when this device holds an unacknowledged outbox entry for the same record,
 * because applying it would overwrite a local edit the server has not seen yet.
 */
export function applyRemoteChanges(changes: InboundChange[]): ApplyResult {
  const applied = readApplied();
  const pending = readOutbox().entries;
  const pendingKeys = new Set(pending.map((e) => `${e.section}::${e.recordId}`));

  const conflicts: SyncConflict[] = [];
  const bySection = new Map<SyncSectionName, InboundChange[]>();
  /** Outbox entries invalidated by an inbound delete, keyed `section::recordId`. */
  const supersededOutboxKeys = new Set<string>();
  let skippedDuplicates = 0;
  let supersededInbound = 0;
  let highestConsumed = 0;

  for (const change of changes) {
    if (!(change.storeName in SYNC_SECTION_KEYS)) {
      // Unknown section: consume the cursor so we do not get stuck re-pulling it.
      highestConsumed = Math.max(highestConsumed, change.serverChangeId);
      continue;
    }
    if (applied.has(change.serverChangeId)) {
      skippedDuplicates += 1;
      highestConsumed = Math.max(highestConsumed, change.serverChangeId);
      continue;
    }

    const key = `${change.storeName}::${change.recordId}`;
    const isDeletion = change.operation === 'delete' || change.operation === 'tombstone';

    /*
     * A remote deletion is applied even when this device has an unsent edit for the same
     * record. That asymmetry is the whole point of the conflict policy: an explicit
     * delete outranks a stale offline edit, because the alternative — letting the local
     * edit win — is what resurrects deleted records. The pending entries are dropped
     * below rather than retried, since the server would reject them as superseded.
     */
    if (pendingKeys.has(key) && !isDeletion) {
      conflicts.push({
        storeName: change.storeName,
        recordId: change.recordId,
        incoming: change,
        localPayload: currentRecordMap(change.storeName)[change.recordId] ?? null,
        blockedBy: pending
          .filter((e) => e.section === change.storeName && e.recordId === change.recordId)
          .map((e) => e.clientChangeId),
        detectedAt: new Date().toISOString()
      });
      highestConsumed = Math.max(highestConsumed, change.serverChangeId);
      continue;
    }

    /*
     * A create/update for a record this device already deleted must not be replayed.
     * The delete may have come from this device (a queued delete whose delta page
     * arrives later) or from another device whose delete this one already applied.
     */
    if (!isDeletion && isLocallyDeleted(change.storeName, change.recordId)) {
      applied.add(change.serverChangeId);
      highestConsumed = Math.max(highestConsumed, change.serverChangeId);
      supersededInbound += 1;
      continue;
    }

    const bucket = bySection.get(change.storeName) ?? [];
    bucket.push(change);
    bySection.set(change.storeName, bucket);
  }

  // Drop outbox entries the server will refuse anyway, so the queue cannot wedge on a
  // record that no longer exists.
  if (supersededOutboxKeys.size > 0) {
    dropOutboxEntriesFor(supersededOutboxKeys);
  }

  let appliedCount = 0;

  for (const [section, sectionChanges] of bySection) {
    const map = currentRecordMap(section);
    let mutated = false;

    for (const change of sectionChanges) {
      if (change.operation === 'delete' || change.operation === 'tombstone') {
        if (change.recordId in map) {
          delete map[change.recordId];
          mutated = true;
        }
        // Remember the deletion locally so a stale create in a later page is ignored.
        rememberTombstone(change.storeName, change.recordId);
        if (pendingKeys.has(`${change.storeName}::${change.recordId}`)) {
          supersededOutboxKeys.add(`${change.storeName}::${change.recordId}`);
        }
      } else {
        map[change.recordId] = change.payload;
        mutated = true;
      }
      applied.add(change.serverChangeId);
      highestConsumed = Math.max(highestConsumed, change.serverChangeId);
      appliedCount += 1;
    }

    if (!mutated) continue;

    // One write per section, with capture suppressed so this is not re-queued.
    const nextValue = SINGLETON_SECTIONS.has(section)
      ? map[SINGLETON_RECORD_ID] ?? readSection(section)
      : MAP_SECTIONS.has(section)
        ? map
        : Object.values(map);

    withCaptureSuppressed(() => writeSection(section, nextValue));
  }

  writeApplied(applied);
  appendConflicts(conflicts);

  if (appliedCount > 0) {
    for (const fn of appliedListeners) {
      try {
        fn();
      } catch {
        /* a broken listener must never undo an applied change */
      }
    }
  }

  return {
    applied: appliedCount,
    skippedDuplicates,
    supersededInbound,
    conflicts,
    highestConsumed
  };
}

/** Forget the applied ledger and conflicts (local wipe / identity reset). */
export function clearApplied(): void {
  try {
    localStorage.removeItem(APPLIED_KEY);
  } catch {
    /* nothing else we can do */
  }
}
