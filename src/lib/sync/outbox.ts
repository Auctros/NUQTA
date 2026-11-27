/**
 * Durable local outbox.
 *
 * Every user-visible change is appended here BEFORE any network attempt, so a change
 * survives a crash, a closed tab, or a long offline period. Entries are removed only
 * when the server explicitly acknowledges them (see `acknowledge`).
 *
 * Ordering is by insertion, which is what gives a record's changes a meaningful
 * sequence on the wire. `base_version` is recorded on each entry but is NOT resolved
 * here: Stage 2 preserves the information a later conflict stage needs.
 */

import type { OutboundChange, SyncOperation, SyncSectionName } from './protocol';
import { generateUuid } from './deviceIdentity';

const OUTBOX_KEY = 'nuqta_sync_outbox_v1';

/**
 * Notified whenever the queued set changes (append, acknowledge, clear).
 *
 * This is what makes sync real-time: writing to the outbox is the last local step
 * before the wire, so the client subscribes here and sends immediately. Without it a
 * change sat durable but unsent until some unrelated event (reconnect, reload) happened
 * to call `flush()` — which is exactly the "only syncs after refresh" bug.
 */
const changeListeners = new Set<() => void>();

export function onOutboxChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

function notifyOutboxChange(): void {
  for (const fn of changeListeners) {
    try {
      fn();
    } catch {
      /* an observer must never break a queue write that already succeeded */
    }
  }
}

/**
 * One queued change. `client_change_id` is the idempotency key: re-sending the same
 * entry after an interrupted batch is safe because the server deduplicates on it.
 */
export interface OutboxEntry {
  clientChangeId: string;
  section: SyncSectionName;
  recordId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  /** Version this edit was based on; preserved for the next stage's conflict policy. */
  baseVersion: number | null;
  /** Local monotonic sequence, used to keep a stable order across reloads. */
  seq: number;
}

export interface OutboxState {
  entries: OutboxEntry[];
  nextSeq: number;
  /** Highest serverChangeId acknowledged so far (not the pull cursor). */
  lastAckedSeq: number;
}

function emptyState(): OutboxState {
  return { entries: [], nextSeq: 1, lastAckedSeq: 0 };
}

function isEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<OutboxEntry>;
  return (
    typeof e.clientChangeId === 'string' &&
    typeof e.section === 'string' &&
    typeof e.recordId === 'string' &&
    typeof e.operation === 'string' &&
    typeof e.payload === 'object' &&
    e.payload !== null &&
    typeof e.seq === 'number'
  );
}

/** Read the outbox, discarding malformed entries rather than throwing. */
export function readOutbox(): OutboxState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OUTBOX_KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();

  try {
    const parsed = JSON.parse(raw) as Partial<OutboxState>;
    if (!parsed || !Array.isArray(parsed.entries)) return emptyState();
    const entries = parsed.entries.filter(isEntry).sort((a, b) => a.seq - b.seq);
    const maxSeq = entries.reduce((max, e) => Math.max(max, e.seq), 0);
    return {
      entries,
      nextSeq: Math.max(Number(parsed.nextSeq) || 1, maxSeq + 1),
      lastAckedSeq: Number(parsed.lastAckedSeq) || 0
    };
  } catch {
    return emptyState();
  }
}

function writeOutbox(state: OutboxState): boolean {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(state));
    return true;
  } catch {
    // A full quota must not corrupt the queue: keep whatever was already durable.
    return false;
  }
}

/**
 * Append one change. Returns the entry, or null when it could not be persisted —
 * callers must treat null as "this change will not sync" rather than retrying blindly.
 */
export function enqueueChange(input: {
  section: SyncSectionName;
  recordId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  baseVersion?: number | null;
  clientChangeId?: string;
  clientTimestamp?: string;
}): OutboxEntry | null {
  const state = readOutbox();
  const entry: OutboxEntry = {
    clientChangeId: input.clientChangeId ?? generateUuid(),
    section: input.section,
    recordId: input.recordId,
    operation: input.operation,
    payload: input.payload,
    clientTimestamp: input.clientTimestamp ?? new Date().toISOString(),
    baseVersion: input.baseVersion ?? null,
    seq: state.nextSeq
  };

  const next: OutboxState = {
    entries: [...state.entries, entry],
    nextSeq: state.nextSeq + 1,
    lastAckedSeq: state.lastAckedSeq
  };

  if (!writeOutbox(next)) return null;
  notifyOutboxChange();
  return entry;
}

/** Remove acknowledged entries by their client change id. */
export function acknowledge(clientChangeIds: string[]): number {
  if (clientChangeIds.length === 0) return 0;
  const acked = new Set(clientChangeIds.map((id) => id.toLowerCase()));
  const state = readOutbox();
  const remaining = state.entries.filter((e) => !acked.has(e.clientChangeId.toLowerCase()));
  const removed = state.entries.length - remaining.length;
  if (removed === 0) return 0;

  writeOutbox({
    entries: remaining,
    nextSeq: state.nextSeq,
    lastAckedSeq: state.lastAckedSeq
  });
  notifyOutboxChange();
  return removed;
}

/**
 * Drop queued entries for records the server has already deleted.
 *
 * Without this the outbox would retry a write forever: the server answers
 * `superseded` for a tombstoned record, so the entry is never "applied", yet keeping it
 * means every flush re-sends a change that can never succeed. Dropping it is the honest
 * outcome — the record no longer exists, so the local edit has nowhere to land.
 */
export function dropOutboxEntriesFor(keys: Set<string>): number {
  if (keys.size === 0) return 0;
  const state = readOutbox();
  const remaining = state.entries.filter((e) => !keys.has(`${e.section}::${e.recordId}`));
  const removed = state.entries.length - remaining.length;
  if (removed === 0) return 0;
  writeOutbox({ entries: remaining, nextSeq: state.nextSeq, lastAckedSeq: state.lastAckedSeq });
  notifyOutboxChange();
  return removed;
}

/** The oldest `limit` entries, in insertion order. */
export function peekBatch(limit: number): OutboxEntry[] {
  return readOutbox().entries.slice(0, Math.max(0, limit));
}

export function outboxSize(): number {
  return readOutbox().entries.length;
}

/** Drop every queued change. Only for an explicit local wipe or identity reset. */
export function clearOutbox(): void {
  try {
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* nothing else we can do */
  }
  notifyOutboxChange();
}

/** Convert an entry into the wire shape the server expects (`snake_case`). */
export function toOutboundChange(entry: OutboxEntry, deviceId: string): OutboundChange {
  return {
    device_id: deviceId,
    client_change_id: entry.clientChangeId,
    store_name: entry.section,
    record_id: entry.recordId,
    operation: entry.operation,
    payload: entry.payload,
    client_timestamp: entry.clientTimestamp,
    base_version: entry.baseVersion
  };
}
