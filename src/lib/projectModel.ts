/**
 * Pure project mutations.
 *
 * The store actions are thin wrappers around these: each takes the current project and
 * returns the next one. Keeping the record edits here means every invariant is in one
 * file, testable without a store, and the store never has to reach into a project's
 * internals.
 *
 * The invariants this file maintains:
 *   - `updatedAt` always moves; `lastMeaningfulUpdateAt` only moves when the plan or
 *     status changed, because "idle" is measured against real progress, not a typo fix.
 *   - A completed project always has `completedAt`; a live one never does.
 *   - A blocked step keeps a reason; any other step has none.
 *   - Detaching a phase never deletes its steps or notes — they lose the grouping only.
 *   - Activity is append-only and bounded, so a long-lived project cannot grow forever.
 */

import type {
  Project,
  ProjectActivity,
  ProjectActivityType,
  ProjectNote,
  ProjectPhase,
  ProjectResource,
  ProjectStep,
  ProjectStatus
} from '../types';

/** How many events a project keeps. Enough for a real history, bounded for sync. */
export const PROJECT_ACTIVITY_LIMIT = 200;

export function projectId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function recordActivity(
  project: Project,
  type: ProjectActivityType,
  summary: string,
  now: string,
  subjectId?: string
): Project {
  const event: ProjectActivity = {
    id: projectId('pa'),
    type,
    timestamp: now,
    summary,
    ...(subjectId ? { subjectId } : {})
  };
  return {
    ...project,
    activity: [event, ...project.activity].slice(0, PROJECT_ACTIVITY_LIMIT)
  };
}

/** Status labels live next to the status union so wording cannot drift from meaning. */
export function projectStatusLabel(status: ProjectStatus, isAr: boolean): string {
  const labels: Record<ProjectStatus, { ar: string; en: string }> = {
    planned: { ar: 'مخطَّط', en: 'Planned' },
    active: { ar: 'قيد التنفيذ', en: 'Active' },
    on_hold: { ar: 'متوقّف مؤقتاً', en: 'On hold' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    archived: { ar: 'مؤرشف', en: 'Archived' }
  };
  return isAr ? labels[status].ar : labels[status].en;
}

/**
 * Apply a status change, keeping the timestamps consistent with it.
 *
 * Derived rather than assigned independently: a record whose `status` says completed
 * but whose `completedAt` is empty is exactly the kind of half-state that makes
 * reports wrong later.
 */
export function applyStatus(project: Project, status: ProjectStatus, now: string): Project {
  const next: Project = { ...project, status, updatedAt: now, lastMeaningfulUpdateAt: now };
  if (status === 'completed') {
    next.completedAt = now;
    next.archivedAt = undefined;
  } else if (status === 'archived') {
    next.archivedAt = now;
    next.completedAt = undefined;
  } else {
    next.completedAt = undefined;
    next.archivedAt = undefined;
  }
  return next;
}

export function addPhase(
  project: Project,
  input: { title: string; description?: string; startDate?: string; targetDate?: string },
  now: string
): { project: Project; phase: ProjectPhase } {
  const phase: ProjectPhase = {
    id: projectId('ph'),
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    targetDate: input.targetDate,
    order: project.phases.length
  };
  return {
    project: {
      ...project,
      phases: [...project.phases, phase],
      updatedAt: now,
      lastMeaningfulUpdateAt: now
    },
    phase
  };
}

export function deletePhase(project: Project, phaseId: string, now: string): Project {
  return {
    ...project,
    phases: project.phases.filter((p) => p.id !== phaseId),
    steps: project.steps.map((s) => (s.phaseId === phaseId ? { ...s, phaseId: undefined } : s)),
    notes: project.notes.map((n) => (n.phaseId === phaseId ? { ...n, phaseId: undefined } : n)),
    updatedAt: now
  };
}

export function togglePhaseCompletion(project: Project, phaseId: string, now: string): Project {
  return {
    ...project,
    phases: project.phases.map((p) =>
      p.id === phaseId ? { ...p, completedAt: p.completedAt ? undefined : now } : p
    ),
    updatedAt: now,
    lastMeaningfulUpdateAt: now
  };
}

export function addStep(
  project: Project,
  input: { title: string; description?: string; phaseId?: string },
  now: string
): { project: Project; step: ProjectStep } {
  const step: ProjectStep = {
    id: projectId('st'),
    title: input.title,
    description: input.description,
    phaseId: input.phaseId,
    status: 'open',
    order: project.steps.length,
    taskIds: [],
    createdAt: now,
    updatedAt: now
  };
  return {
    project: {
      ...project,
      steps: [...project.steps, step],
      updatedAt: now,
      lastMeaningfulUpdateAt: now
    },
    step
  };
}

/**
 * Set a step's status, keeping `completedAt` and `blockedReason` consistent with it.
 *
 * Clearing `blockedReason` on any non-blocked status is deliberate: a leftover reason
 * makes the plan claim a blocker that has already been resolved.
 */
export function setStepStatus(
  project: Project,
  stepId: string,
  status: ProjectStep['status'],
  now: string
): Project {
  return {
    ...project,
    steps: project.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status,
            completedAt: status === 'done' ? now : undefined,
            blockedReason: status === 'blocked' ? s.blockedReason : undefined,
            updatedAt: now
          }
        : s
    ),
    updatedAt: now,
    lastMeaningfulUpdateAt: now
  };
}

export function deleteStep(project: Project, stepId: string, now: string): Project {
  return { ...project, steps: project.steps.filter((s) => s.id !== stepId), updatedAt: now };
}

/** Swap a step with its neighbour, then renumber so `order` stays dense and stable. */
export function moveStep(project: Project, stepId: string, direction: 'up' | 'down', now: string): Project {
  const ordered = [...project.steps].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((s) => s.id === stepId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return project;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return { ...project, steps: ordered.map((s, i) => ({ ...s, order: i })), updatedAt: now };
}

export function addNote(
  project: Project,
  input: Partial<ProjectNote> & { body: string },
  now: string
): { project: Project; note: ProjectNote } {
  const note: ProjectNote = {
    id: projectId('pn'),
    kind: input.kind ?? 'note',
    title: input.title,
    body: input.body,
    phaseId: input.phaseId,
    pinned: input.pinned,
    alternatives: input.alternatives,
    openQuestions: input.openQuestions,
    tags: input.tags,
    createdAt: now,
    updatedAt: now
  };
  return {
    project: {
      ...project,
      notes: [note, ...project.notes],
      updatedAt: now,
      lastMeaningfulUpdateAt: now
    },
    note
  };
}

export function deleteNote(project: Project, noteId: string, now: string): Project {
  return { ...project, notes: project.notes.filter((n) => n.id !== noteId), updatedAt: now };
}

/**
 * Mark a note as turned into a step. The note itself is kept: it is the record of why
 * the step exists, and deleting it would erase the reasoning behind the plan.
 */
export function markNoteConvertedToStep(project: Project, noteId: string, stepId: string, now: string): Project {
  return {
    ...project,
    notes: project.notes.map((n) =>
      n.id === noteId ? { ...n, convertedToStepId: stepId, updatedAt: now } : n
    ),
    updatedAt: now
  };
}

export function markNoteConvertedToTask(project: Project, noteId: string, taskId: string, now: string): Project {
  return {
    ...project,
    notes: project.notes.map((n) =>
      n.id === noteId ? { ...n, convertedToTaskId: taskId, updatedAt: now } : n
    ),
    updatedAt: now
  };
}

export function addResource(
  project: Project,
  input: Omit<ProjectResource, 'id' | 'createdAt'>,
  now: string
): { project: Project; resource: ProjectResource } {
  const resource: ProjectResource = { id: projectId('pr'), ...input, createdAt: now };
  return { project: { ...project, resources: [...project.resources, resource], updatedAt: now }, resource };
}

export function deleteResource(project: Project, resourceId: string, now: string): Project {
  return { ...project, resources: project.resources.filter((r) => r.id !== resourceId), updatedAt: now };
}

export function linkGoal(project: Project, goalId: string, now: string): Project {
  if (project.goalIds.includes(goalId)) return project;
  return {
    ...project,
    goalIds: [...project.goalIds, goalId],
    updatedAt: now,
    lastMeaningfulUpdateAt: now
  };
}

export function unlinkGoal(project: Project, goalId: string, now: string): Project {
  if (!project.goalIds.includes(goalId)) return project;
  return { ...project, goalIds: project.goalIds.filter((id) => id !== goalId), updatedAt: now };
}

/** Attach a task to a step, without duplicating the task itself. */
export function attachTaskToStep(project: Project, stepId: string, taskId: string, now: string): Project {
  return {
    ...project,
    steps: project.steps.map((s) =>
      s.id === stepId && !s.taskIds.includes(taskId)
        ? { ...s, taskIds: [...s.taskIds, taskId], updatedAt: now }
        : s
    ),
    updatedAt: now,
    lastMeaningfulUpdateAt: now
  };
}

export function detachTaskFromSteps(project: Project, taskId: string, now: string): Project {
  if (!project.steps.some((s) => s.taskIds.includes(taskId))) return project;
  return {
    ...project,
    steps: project.steps.map((s) =>
      s.taskIds.includes(taskId)
        ? { ...s, taskIds: s.taskIds.filter((id) => id !== taskId), updatedAt: now }
        : s
    ),
    updatedAt: now
  };
}
