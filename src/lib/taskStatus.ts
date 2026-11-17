import type { Task } from '../types';

/**
 * Single definition of a task's lifecycle state, so a new status (e.g. the
 * recurrence `skipped`) cannot silently start counting as "pending" in one view
 * while being excluded in another.
 *
 *   active    not archived/cancelled (may be pending or done) — used for lists
 *   pending   still needs action (todo / in_progress / deferred)
 *   done      completed
 *   closed    archived / cancelled / skipped — deliberately not actionable
 */
export function isTaskActive(task: Task): boolean {
  return !task.isArchived && task.status !== 'archived' && task.status !== 'cancelled' && task.status !== 'skipped';
}

export function isTaskDone(task: Task): boolean {
  return task.status === 'completed';
}

/** Archived, cancelled or skipped: never shown as pending, never nudged. */
export function isTaskClosed(task: Task): boolean {
  return task.status === 'archived' || task.status === 'cancelled' || task.status === 'skipped';
}

/** Active and still needing action. */
export function isTaskPending(task: Task): boolean {
  return isTaskActive(task) && !isTaskDone(task);
}

/** Active and completed. */
export function isTaskActiveDone(task: Task): boolean {
  return isTaskActive(task) && isTaskDone(task);
}
