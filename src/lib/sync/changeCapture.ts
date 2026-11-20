/**
 * Change capture.
 *
 * Turns a whole-section write into individual record-level changes. `persist()` hands us
 * the complete new value for a section, so a change set is derived by diffing against a
 * persisted baseline (record id → serialized payload). The baseline is durable, which
 * matters: a reload between two edits must still produce a correct diff.
 *
 * Two rules are load-bearing:
 *  - Capturing never throws into the storage layer (see `onLocalWrite`).
 *  - While remote changes are being applied, capture is suppressed so an inbound change
 *    is not immediately re-queued as an outbound echo.
 */

import { onLocalWrite, SYNC_SECTION_KEYS, type SyncSectionName } from '../storage';
import { enqueueChange } from './outbox';

const BASELINE_KEY = 'nuqta_sync_baseline_v1';

/** Sections whose localStorage value is a keyed map rather than a list of records. */
const MAP_SECTIONS = new Set<SyncSectionName>(['health_metrics']);

/** Sections that are a single object with no identity of their own. */
const SINGLETON_SECTIONS = new Set<SyncSectionName>(['profile']);

/** The record id used for a singleton section (matches the IndexedDB mirror). */
export const SINGLETON_RECORD_ID = 'primary';

type Baseline = Partial<Record<SyncSectionName, Record<string, string>>>;

let suppressionDepth = 0;
let baselineCache: Baseline | null = null;

function readBaseline(): Baseline {
  if (baselineCache) return baselineCache;
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    baselineCache = raw ? (JSON.parse(raw) as Baseline) : {};
  } catch {
    baselineCache = {};
  }
  return baselineCache;
}

function writeBaseline(next: Baseline): void {
  baselineCache = next;
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(next));
  } catch {
    // Losing the baseline only risks re-sending a change, which the server dedups.
  }
}

/** Run `fn` without capturing any outbound changes (used when applying remote data). */
export function withCaptureSuppressed<T>(fn: () => T): T {
  suppressionDepth += 1;
  try {
    return fn();
  } finally {
    suppressionDepth -= 1;
  }
}

export function isCaptureSuppressed(): boolean {
  return suppressionDepth > 0;
}

/**
 * Reduce a section value to `recordId → serialized payload`.
 *
 * Unknown shapes yield an empty map, which makes the section look empty; that would
 * enqueue deletions, so callers only ever pass values read back from storage.
 */
export function toRecordMap(section: SyncSectionName, value: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (SINGLETON_SECTIONS.has(section)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[SINGLETON_RECORD_ID] = JSON.stringify(value);
    }
    return result;
  }

  if (MAP_SECTIONS.has(section)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        result[key] = JSON.stringify(entry);
      }
    }
    return result;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const id = (entry as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) {
        result[id] = JSON.stringify(entry);
      }
    }
  }
  return result;
}

export interface CaptureResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: boolean;
}

/**
 * Diff one section write against the baseline and enqueue the resulting changes.
 *
 * Returns counts so tests and diagnostics can assert what was captured.
 */
export function captureSectionWrite(section: SyncSectionName, value: unknown): CaptureResult {
  if (isCaptureSuppressed()) {
    // Still advance the baseline: remote-applied state becomes the new reference point,
    // so a later local edit diffs against what the server actually holds.
    const baseline = readBaseline();
    writeBaseline({ ...baseline, [section]: toRecordMap(section, value) });
    return { created: 0, updated: 0, deleted: 0, skipped: true };
  }

  const baseline = readBaseline();
  const previous = baseline[section] ?? {};
  const current = toRecordMap(section, value);

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const [recordId, serialized] of Object.entries(current)) {
    const before = previous[recordId];
    if (before === serialized) continue;
    const payload = JSON.parse(serialized) as Record<string, unknown>;
    const entry = enqueueChange({
      section,
      recordId,
      operation: before === undefined ? 'create' : 'update',
      payload
    });
    if (entry) {
      if (before === undefined) created += 1;
      else updated += 1;
    }
  }

  for (const recordId of Object.keys(previous)) {
    if (recordId in current) continue;
    const entry = enqueueChange({
      section,
      recordId,
      operation: 'delete',
      payload: {}
    });
    if (entry) deleted += 1;
  }

  writeBaseline({ ...baseline, [section]: current });
  return { created, updated, deleted, skipped: false };
}

/** Re-seed every baseline from current storage without enqueuing anything. */
export function seedBaselineFromStorage(read: (section: SyncSectionName) => unknown): void {
  const next: Baseline = {};
  for (const section of Object.keys(SYNC_SECTION_KEYS) as SyncSectionName[]) {
    next[section] = toRecordMap(section, read(section));
  }
  writeBaseline(next);
}

/** True when a baseline has been persisted (i.e. capture has been primed). */
export function hasBaseline(): boolean {
  try {
    return localStorage.getItem(BASELINE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Forget all baselines (local wipe / identity reset). */
export function clearBaseline(): void {
  baselineCache = null;
  try {
    localStorage.removeItem(BASELINE_KEY);
  } catch {
    /* nothing else we can do */
  }
}

/**
 * Begin capturing. Returns an unsubscribe function.
 * Registering twice is harmless: listeners are kept in a Set.
 */
export function startChangeCapture(): () => void {
  return onLocalWrite((section, value) => {
    captureSectionWrite(section, value);
  });
}
