/**
 * Task recurrence: turn one repeating task into a bounded set of real Task records.
 *
 * Each occurrence is an ordinary task, so completing, skipping, editing or deleting
 * one is an ordinary operation on a single record. The series is kept coherent by:
 *   - a shared `seriesId`,
 *   - a stable `occurrenceIndex` per date,
 *   - `materializeSeries` never emitting a date that already exists in the series
 *     (dedupe key = seriesId + scheduledDate), so re-running it is idempotent.
 *
 * The horizon is deliberately finite. A recurring task is materialised a bounded
 * number of days ahead and topped up on each store load, so a "daily" series cannot
 * grow without limit and no occurrence is ever created in the far past.
 */

import type { Task, RecurrenceRule } from '../types';
import { addDaysToKey, isDateKey, localDateKey } from './dateKey';
import { normalizeRule, occurrencesInRange } from './recurrence';

/** How far ahead a recurring series is materialised (days from the anchor/today). */
export const SERIES_HORIZON_DAYS = 90;

export interface SeriesDraft {
  title: string;
  notes?: string;
  priority: Task['priority'];
  isTopThree?: boolean;
  scheduledTime?: string;
  estimatedMinutes?: number;
  tags?: string[];
  energyLevelRequired?: Task['energyLevelRequired'];
  linkedGoalId?: string;
  subtasks?: Task['subtasks'];
}

/** Fields copied verbatim from the draft onto every occurrence. */
function sharedFields(draft: SeriesDraft) {
  return {
    title: draft.title,
    notes: draft.notes ?? '',
    priority: draft.priority,
    isTopThree: draft.isTopThree ?? false,
    scheduledTime: draft.scheduledTime,
    estimatedMinutes: draft.estimatedMinutes ?? 30,
    tags: draft.tags ?? [],
    energyLevelRequired: draft.energyLevelRequired ?? ('medium' as const),
    linkedGoalId: draft.linkedGoalId,
    subtasks: draft.subtasks ?? []
  };
}

/** End of the materialisation window, clamped to the rule's `until`. */
export function horizonEndKey(anchorKey: string, rule: RecurrenceRule, todayKey: string = localDateKey()): string {
  const fromToday = addDaysToKey(todayKey, SERIES_HORIZON_DAYS);
  const fromAnchor = addDaysToKey(anchorKey, SERIES_HORIZON_DAYS);
  let end = fromToday > fromAnchor ? fromToday : fromAnchor;
  const norm = normalizeRule(rule, anchorKey);
  if (norm.until && isDateKey(norm.until) && norm.until < end) end = norm.until;
  return end;
}

/**
 * Build the occurrence records for a series over [anchorKey, horizon], skipping any
 * date already present in `existingDates`. Occurrence ids are deterministic
 * (`seriesId` + index) so two materialisations cannot both create the same day.
 */
export function materializeSeries(
  seriesId: string,
  draft: SeriesDraft,
  rule: RecurrenceRule,
  anchorKey: string,
  existingDates: ReadonlySet<string>,
  todayKey: string = localDateKey(),
  nowIso: string = new Date().toISOString()
): Task[] {
  if (!isDateKey(anchorKey)) return [];
  const end = horizonEndKey(anchorKey, rule, todayKey);
  const keys = occurrencesInRange(rule, anchorKey, anchorKey, end);
  const out: Task[] = [];
  keys.forEach((dateKey, index) => {
    if (existingDates.has(dateKey)) return;
    out.push({
      id: `${seriesId}-o${index}`,
      ...sharedFields(draft),
      status: 'todo',
      scheduledDate: dateKey,
      recurrence: rule,
      seriesId,
      occurrenceIndex: index,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  });
  return out;
}

/** Occurrence dates already present in a series (dedupe set). */
export function seriesDates(tasks: Task[], seriesId: string): Set<string> {
  const dates = new Set<string>();
  for (const t of tasks) {
    if (t.seriesId === seriesId && t.scheduledDate) dates.add(t.scheduledDate);
  }
  return dates;
}

/** The still-open (not completed/cancelled) occurrences of a series, earliest first. */
export function openOccurrences(tasks: Task[], seriesId: string): Task[] {
  return tasks
    .filter((t) => t.seriesId === seriesId && t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''));
}

/** A new opaque series id. */
export function newSeriesId(): string {
  return 'ser-' + crypto.randomUUID().slice(0, 8);
}
