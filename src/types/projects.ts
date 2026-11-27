/**
 * Projects: a temporary body of work, not a large task.
 *
 * The hierarchy this file encodes is:
 *
 *   Goal ──(many-to-many)── Project ── Phase ── Step
 *                                     └─────── Step (phase-less)
 *                                              └── Task (owned by the Tasks module)
 *
 * Two decisions are load-bearing and explain most of the shape below.
 *
 * 1. A step is NOT a task. Steps live inside the project record; tasks stay in
 *    `nuqta_tasks_v1` and are only *referenced* from a step by id. A task therefore
 *    appears in exactly one place (the Tasks module) and one context (the project),
 *    with no second copy to keep in sync.
 *
 * 2. Goal ↔ project is many-to-many, and the *project* owns the relationship. The
 *    existing Goal model has `linkedTaskIds` / `linkedHabitIds` arrays and a
 *    one-way `linkedGoalId` on tasks; goals are not rewritten here. A project
 *    declares `goalIds: string[]`, and the reverse direction is derived by
 *    scanning projects. That keeps a project independent: deleting a goal cannot
 *    delete a project, and completing a project cannot complete a goal.
 */

/** Where a project sits in its lifecycle. `on_hold` is a pause, not a failure. */
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'planned',
  'active',
  'on_hold',
  'completed',
  'archived'
] as const;

/**
 * Optional organisation aid, never a mandatory classification. Mirrors the shape of
 * `Goal.category` so the two read as one system rather than two vocabularies.
 */
export type ProjectCategory =
  | 'personal'
  | 'learning'
  | 'creative'
  | 'technical'
  | 'financial'
  | 'administrative'
  | 'other';

export const PROJECT_CATEGORIES: readonly ProjectCategory[] = [
  'personal',
  'learning',
  'creative',
  'technical',
  'financial',
  'administrative',
  'other'
] as const;

/** A step's state. Deliberately small: not every step needs a workflow. */
export type ProjectStepStatus = 'open' | 'done' | 'blocked';

/** A note's kind. `decision` and `question` are first-class because they are what
 *  a returning reader needs most: what was settled, and what is still open. */
export type ProjectNoteKind =
  | 'note'
  | 'idea'
  | 'decision'
  | 'question'
  | 'research'
  | 'meeting'
  | 'observation';

export const PROJECT_NOTE_KINDS: readonly ProjectNoteKind[] = [
  'note',
  'idea',
  'decision',
  'question',
  'research',
  'meeting',
  'observation'
] as const;

export type ProjectResourceKind = 'link' | 'file' | 'reference';

/** A meaningful part of the project's lifecycle, or a significant intermediate outcome. */
export interface ProjectPhase {
  id: string;
  title: string;
  description?: string;
  /** Planned window. Absent means "not scheduled", never "today". */
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  /** Ordering inside the project. Lower first; reordering rewrites this. */
  order: number;
}

/**
 * A unit of progress inside a project, optionally inside a phase.
 *
 * `status` is the source of truth for the step. `blocked` is a distinct state rather
 * than a flag because "waiting on something" is the fact a returning reader needs,
 * and collapsing it into `open` hides it.
 */
export interface ProjectStep {
  id: string;
  title: string;
  description?: string;
  phaseId?: string;
  status: ProjectStepStatus;
  order: number;
  completedAt?: string;
  /** Task ids that execute this step. Tasks remain owned by the Tasks module. */
  taskIds: string[];
  /** Why it is blocked / what it waits on. Only meaningful when status is blocked. */
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** One collected thought. Everything but `body` is optional on purpose. */
export interface ProjectNote {
  id: string;
  kind: ProjectNoteKind;
  title?: string;
  body: string;
  /** Set when the note was turned into a step; the note is kept as the trace. */
  convertedToStepId?: string;
  /** Set when the note was turned into a task; the note is kept as the trace. */
  convertedToTaskId?: string;
  /** Attached to a phase for context, without being a step. */
  phaseId?: string;
  pinned?: boolean;
  /** Decision records: what else was considered, and what is still uncertain. */
  alternatives?: string;
  openQuestions?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A reference the project needs. `file` resources store a bounded data URL, the same
 * way book covers do, so a resource survives a refresh and works offline. A `link`
 * keeps only the URL — NUQTA never fetches it.
 */
export interface ProjectResource {
  id: string;
  kind: ProjectResourceKind;
  title: string;
  url?: string;
  /** Bounded data URL for an uploaded file. Absent for links and plain references. */
  dataUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  notes?: string;
  createdAt: string;
}

/** The recorded events a project's Activity tab shows. */
export type ProjectActivityType =
  | 'project_created'
  | 'status_changed'
  | 'phase_added'
  | 'phase_completed'
  | 'phase_reopened'
  | 'step_added'
  | 'step_completed'
  | 'step_reopened'
  | 'step_blocked'
  | 'task_linked'
  | 'task_unlinked'
  | 'task_completed'
  | 'note_added'
  | 'decision_recorded'
  | 'goal_linked'
  | 'goal_unlinked'
  | 'project_completed'
  | 'project_reopened';

/**
 * An append-only project event.
 *
 * Only meaningful changes are recorded — a title typo fix is not history. Events are
 * never fabricated for records created before tracking existed: a project with no
 * events simply shows an empty Activity tab that says so.
 */
export interface ProjectActivity {
  id: string;
  type: ProjectActivityType;
  /** ISO instant. */
  timestamp: string;
  summary: string;
  /** The record the event is about (phase, step, note, task…), when there is one. */
  subjectId?: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  category?: ProjectCategory;

  /** GTD natural planning: why this exists, and what success looks like. */
  purpose?: string;
  desiredOutcome?: string;
  /** Explicit completion criteria. Free text; never inferred. */
  definitionOfDone?: string;

  /** Many-to-many, owned by the project. A project may have none. */
  goalIds: string[];

  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  archivedAt?: string;

  phases: ProjectPhase[];
  steps: ProjectStep[];
  notes: ProjectNote[];
  resources: ProjectResource[];

  /**
   * Optional manual progress override, 0..1.
   *
   * Present only when the reader states it. When absent, progress is derived (see
   * `src/lib/projectProgress.ts`), and when there is not enough data to derive it
   * honestly, no figure is shown at all rather than a fabricated one.
   */
  manualProgress?: number;

  /** Blockers and open questions surfaced on the Overview. */
  blockers?: string;

  /**
   * Optional explicit health statement. Health is never inferred from task
   * completion percentage alone, so the only way to say "at risk" is to say it.
   */
  healthNote?: string;

  activity: ProjectActivity[];

  createdAt: string;
  updatedAt: string;
  /** Last time something meaningful changed (not every field edit). */
  lastMeaningfulUpdateAt?: string;
}

/**
 * Project ids a goal is supported by.
 *
 * Derived, never stored on the goal: the project owns `goalIds`, so this is the
 * reverse index computed at render time. Storing it in two places is how the two
 * directions drift apart.
 */
export interface ProjectGoalLink {
  projectId: string;
  projectTitle: string;
  projectStatus: ProjectStatus;
}
