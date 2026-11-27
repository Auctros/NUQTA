/**
 * Project intelligence: progress, health and attention.
 *
 * Everything here is a pure function of records the user actually created. The rule
 * that shapes the whole file: **never invent a number**. A project with no steps and
 * no linked tasks has no progress, and says so, rather than showing a confident "0%"
 * that reads as failure. Likewise health is only ever stated from explicit signals —
 * a blocked step, a passed target date — never inferred from a completion percentage,
 * because "40% done with two weeks left" and "40% done on the last day" are the same
 * number and completely different situations.
 */

import type { Project, ProjectStep, ProjectStatus, Task } from '../types';
import { isTaskDone, isTaskClosed } from './taskStatus';

/** Which fact the progress figure came from, so the UI can say where it got it. */
export type ProjectProgressSource = 'manual' | 'steps' | 'tasks' | 'none';

export interface ProjectProgress {
  source: ProjectProgressSource;
  /** 0..1, or null when there is genuinely nothing to measure. */
  ratio: number | null;
  /** Integer percent for display, or null alongside a null ratio. */
  percent: number | null;
  stepsTotal: number;
  stepsDone: number;
  tasksTotal: number;
  tasksDone: number;
}

/** Steps are the project's own units of work; a done or blocked step is not "open". */
export function countSteps(project: Project): { total: number; done: number; blocked: number } {
  let done = 0;
  let blocked = 0;
  for (const step of project.steps) {
    if (step.status === 'done') done += 1;
    else if (step.status === 'blocked') blocked += 1;
  }
  return { total: project.steps.length, done, blocked };
}

/**
 * Tasks that execute this project.
 *
 * Cancelled and archived tasks are excluded from both sides of the fraction: counting
 * them as "not done" would make a project look permanently stuck because of work the
 * user deliberately dropped.
 */
export function projectTasks(project: Project, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.projectId === project.id && !isTaskClosed(t));
}

/**
 * Derive progress from the most specific source available.
 *
 * Order matters and is deliberate:
 *   1. `manualProgress` — the user overrode it; that always wins.
 *   2. steps — the project's own plan is the truest measure of its progress.
 *   3. tasks — used only when the project has no steps at all.
 *   4. none — nothing to measure, so nothing is claimed.
 */
export function deriveProjectProgress(project: Project, tasks: Task[]): ProjectProgress {
  const steps = countSteps(project);
  const linked = projectTasks(project, tasks);
  const tasksDone = linked.filter(isTaskDone).length;

  const base = {
    stepsTotal: steps.total,
    stepsDone: steps.done,
    tasksTotal: linked.length,
    tasksDone
  };

  if (typeof project.manualProgress === 'number' && Number.isFinite(project.manualProgress)) {
    const ratio = Math.min(1, Math.max(0, project.manualProgress));
    return { ...base, source: 'manual', ratio, percent: Math.round(ratio * 100) };
  }

  if (steps.total > 0) {
    const ratio = steps.done / steps.total;
    return { ...base, source: 'steps', ratio, percent: Math.round(ratio * 100) };
  }

  if (linked.length > 0) {
    const ratio = tasksDone / linked.length;
    return { ...base, source: 'tasks', ratio, percent: Math.round(ratio * 100) };
  }

  return { ...base, source: 'none', ratio: null, percent: null };
}

/** How a project is doing, stated only when there is evidence for it. */
export type ProjectHealth = 'on_track' | 'at_risk' | 'stalled' | 'complete' | 'unknown';

export interface ProjectHealthReport {
  health: ProjectHealth;
  /** Why, in the reader's language. Empty when health is unknown. */
  reasonAr: string;
  reasonEn: string;
  /** Days until the target date; negative means overdue. Null when no target. */
  daysToTarget: number | null;
}

/** Whole days between two local `YYYY-MM-DD` keys, or null if either is unusable. */
function daysBetween(fromKey: string, toKey: string): number | null {
  const from = Date.parse(`${fromKey}T00:00:00`);
  const to = Date.parse(`${toKey}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Assess a project's health from explicit signals.
 *
 * Deliberately conservative: a project with no target date, no blocked steps and no
 * stalled activity is `unknown`, not `on_track`. Claiming "on track" without evidence
 * is the same lie as inventing a percentage.
 */
export function assessProjectHealth(project: Project, tasks: Task[], today: string): ProjectHealthReport {
  const none = { reasonAr: '', reasonEn: '', daysToTarget: null };

  if (project.status === 'completed') {
    return {
      health: 'complete',
      reasonAr: 'اكتمل المشروع',
      reasonEn: 'Project completed',
      daysToTarget: null
    };
  }
  if (project.status === 'archived') {
    return { health: 'unknown', ...none };
  }

  const steps = countSteps(project);
  const daysToTarget = project.targetDate ? daysBetween(today, project.targetDate) : null;
  const isActive = project.status === 'active';

  if (steps.blocked > 0) {
    return {
      health: 'at_risk',
      reasonAr: `${steps.blocked} خطوة متعطّلة`,
      reasonEn: `${steps.blocked} blocked ${steps.blocked === 1 ? 'step' : 'steps'}`,
      daysToTarget
    };
  }

  if (isActive && daysToTarget !== null && daysToTarget < 0) {
    return {
      health: 'at_risk',
      reasonAr: `تجاوز الموعد بـ ${Math.abs(daysToTarget)} يوم`,
      reasonEn: `${Math.abs(daysToTarget)} ${Math.abs(daysToTarget) === 1 ? 'day' : 'days'} overdue`,
      daysToTarget
    };
  }

  const lastTouch = project.lastMeaningfulUpdateAt ?? project.updatedAt;
  const idleDays = lastTouch ? daysBetween(lastTouch.slice(0, 10), today) : null;

  if (isActive && idleDays !== null && idleDays >= 21) {
    return {
      health: 'stalled',
      reasonAr: `لا تغيير منذ ${idleDays} يوم`,
      reasonEn: `No change in ${idleDays} days`,
      daysToTarget
    };
  }

  if (isActive && daysToTarget !== null && daysToTarget <= 7) {
    return {
      health: 'at_risk',
      reasonAr:
        daysToTarget === 0 ? 'الموعد اليوم' : `باقٍ ${daysToTarget} ${daysToTarget === 1 ? 'يوم' : 'أيام'}`,
      reasonEn:
        daysToTarget === 0 ? 'Due today' : `${daysToTarget} ${daysToTarget === 1 ? 'day' : 'days'} left`,
      daysToTarget
    };
  }

  if (isActive) {
    return {
      health: 'on_track',
      reasonAr: 'نشط ولا عوائق مسجَّلة',
      reasonEn: 'Active, no recorded blockers',
      daysToTarget
    };
  }

  return { health: 'unknown', ...none, daysToTarget };
}

/** Whether a project is in a state that expects work right now. */
export function isProjectOpen(project: Project): boolean {
  return project.status === 'active' || project.status === 'planned' || project.status === 'on_hold';
}

/**
 * The next concrete thing to do, if the project names one.
 *
 * Returns the first open step in plan order, or — when the plan is empty but tasks
 * exist — the highest-priority unfinished task. Never invents a suggestion.
 */
export function nextAction(
  project: Project,
  tasks: Task[]
): { kind: 'step'; step: ProjectStep } | { kind: 'task'; task: Task } | null {
  const open = project.steps
    .filter((s) => s.status !== 'done')
    .sort((a, b) => a.order - b.order);
  if (open.length > 0) return { kind: 'step', step: open[0] };

  const pending = projectTasks(project, tasks).filter((t) => !isTaskDone(t));
  if (pending.length === 0) return null;
  const byPriority = [...pending].sort((a, b) => a.priority - b.priority);
  return { kind: 'task', task: byPriority[0] };
}

/** Everything the hub needs about one project in one pass. */
export interface ProjectSummary {
  progress: ProjectProgress;
  health: ProjectHealthReport;
  steps: { total: number; done: number; blocked: number };
  taskCount: number;
  openNoteCount: number;
}

export function summarizeProject(project: Project, tasks: Task[], today: string): ProjectSummary {
  const linked = projectTasks(project, tasks);
  return {
    progress: deriveProjectProgress(project, tasks),
    health: assessProjectHealth(project, tasks, today),
    steps: countSteps(project),
    taskCount: linked.length,
    openNoteCount: project.notes.filter((n) => n.kind === 'question').length
  };
}

/** Statuses in the order the hub lists them. */
export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  'active',
  'planned',
  'on_hold',
  'completed',
  'archived'
] as const;
