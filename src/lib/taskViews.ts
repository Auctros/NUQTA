/**
 * Task view model: which tasks belong in which view.
 *
 * The Tasks screen used to default to `all`, which mixed finished work into the active
 * list. The fix is not a filter tweak — it is deciding, once and explicitly, what each
 * view means, so the UI can stay dumb and every view stays consistent with the others.
 *
 * The model is a pure function of (tasks, view, today) so it can be tested directly and
 * so "what does Inbox mean" has exactly one answer.
 */

import type { Task } from '../types';
import { isTaskActive, isTaskClosed, isTaskDone, isTaskPending } from './taskStatus';

/**
 * The views a reader can choose between.
 *
 *   today      due now: scheduled today or overdue
 *   upcoming   scheduled for a future day
 *   inbox      no date at all — not yet planned
 *   completed  finished, newest first, grouped by completion day
 *   archived   deliberately set aside
 */
export type TaskView = 'today' | 'upcoming' | 'inbox' | 'completed' | 'archived';

export const TASK_VIEWS: TaskView[] = ['today', 'upcoming', 'inbox', 'completed', 'archived'];

/** Narrow an arbitrary string to a `TaskView`, falling back to `today`. */
export function asTaskView(value: unknown): TaskView {
  return typeof value === 'string' && (TASK_VIEWS as string[]).includes(value)
    ? (value as TaskView)
    : 'today';
}

/**
 * A task is "set aside" when the archive flag is set, or when its status is one of the
 * closed ones (archived / cancelled / skipped).
 *
 * Including cancelled and skipped matters: they are not pending and not completed, so a
 * view set of {pending, completed, archived} would leave them in no view at all — a task
 * that exists but can never be seen or restored. Archived is the honest home for
 * everything the reader has deliberately taken out of play.
 */
function isSetAside(task: Task): boolean {
  return Boolean(task.isArchived) || isTaskClosed(task);
}

/** Completed and still considered part of the working set. */
function isCompleted(task: Task): boolean {
  return isTaskDone(task) && !isSetAside(task);
}

/**
 * Select the tasks for one view.
 *
 * Ordering matters in one place only: `completed` is newest-first, because the task a
 * reader just finished is the one they are most likely to want to undo. Every other
 * view is left in the caller's sort order.
 */
export function selectTasksForView(tasks: Task[], view: TaskView, today: string): Task[] {
  switch (view) {
    case 'today':
      // Due today or overdue. Undated work is deliberately NOT included: it belongs in
      // Inbox. Pulling it in here would make Today and Inbox overlap, so the same task
      // would be counted twice and "Today" would stop meaning "due today".
      return tasks.filter(
        (t) => isTaskPending(t) && Boolean(t.scheduledDate) && t.scheduledDate! <= today
      );
    case 'upcoming':
      return tasks.filter((t) => isTaskPending(t) && Boolean(t.scheduledDate) && t.scheduledDate! > today);
    case 'inbox':
      return tasks.filter((t) => isTaskPending(t) && !t.scheduledDate);
    case 'completed':
      return tasks
        .filter(isCompleted)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    case 'archived':
      return tasks.filter(isSetAside);
    default:
      return tasks;
  }
}

/** Counts for the view switcher, so a view can be chosen without opening it. */
export function countTasksForViews(tasks: Task[], today: string): Record<TaskView, number> {
  return {
    today: selectTasksForView(tasks, 'today', today).length,
    upcoming: selectTasksForView(tasks, 'upcoming', today).length,
    inbox: selectTasksForView(tasks, 'inbox', today).length,
    completed: selectTasksForView(tasks, 'completed', today).length,
    archived: selectTasksForView(tasks, 'archived', today).length
  };
}

export interface CompletedGroup {
  /** `YYYY-MM-DD` of the completion, or '' when the record has no completion time. */
  day: string;
  tasks: Task[];
}

/**
 * Group completed tasks by the day they were finished.
 *
 * Completion history is a record, not a backlog: grouping by day lets the reader find
 * "what did I finish on Tuesday" without scanning a flat list. Records completed before
 * `completedAt` existed fall into a trailing bucket rather than being dropped.
 */
export function groupCompletedByDay(tasks: Task[]): CompletedGroup[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const day = task.completedAt ? task.completedAt.slice(0, 10) : '';
    const bucket = groups.get(day);
    if (bucket) bucket.push(task);
    else groups.set(day, [task]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, tasks: items }));
}

/**
 * Describe a view in the reader's language.
 *
 * Kept next to the model rather than in the component so the wording of "Inbox" and the
 * behaviour of "Inbox" cannot drift apart.
 */
export function describeTaskView(view: TaskView, isAr: boolean): { label: string; hint: string } {
  switch (view) {
    case 'today':
      return {
        label: isAr ? 'اليوم' : 'Today',
        hint: isAr ? 'ما يحتاج انتباهك الآن' : 'What needs you now'
      };
    case 'upcoming':
      return {
        label: isAr ? 'قادم' : 'Upcoming',
        hint: isAr ? 'مهام مجدولة ليوم لاحق' : 'Scheduled for a later day'
      };
    case 'inbox':
      return {
        label: isAr ? 'بدون موعد' : 'Inbox',
        hint: isAr ? 'مهام لم تُجدول بعد' : 'Not scheduled yet'
      };
    case 'completed':
      return {
        label: isAr ? 'منجزة' : 'Completed',
        hint: isAr ? 'سجل ما أنجزته' : 'A record of what you finished'
      };
    case 'archived':
      return {
        label: isAr ? 'مؤرشفة' : 'Archived',
        hint: isAr ? 'ما وضعته جانباً' : 'What you set aside'
      };
  }
}

/**
 * Whether a task still needs the reader's attention, for badge and empty-state copy.
 * Archived and completed tasks never do.
 */
export function needsAttention(task: Task): boolean {
  return isTaskActive(task) && isTaskPending(task);
}
