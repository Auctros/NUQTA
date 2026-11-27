/**
 * Which timeline edits are real, and how they reach the owning record.
 *
 * The Timeline is a projection, so an edit is only legitimate when the owning
 * module can express it and its store action can persist it. This module answers
 * that question for each item, and performs the write through the existing store
 * action — never by mutating a projected copy.
 *
 * What is editable, and why:
 *   task (planned)        → scheduledDate / scheduledTime   [updateTask]
 *   goal (range)          → startDate / deadline            [updateGoal]
 *   project (range)       → startDate / targetDate          [updateProject]
 *   project phase (range) → startDate / targetDate          [updateProjectPhase]
 *   art project (range)   → startedDate / completedDate     [addOrUpdateArtProject]
 *
 * What is deliberately NOT editable:
 *   completions, habit occurrences, focus/reading/workout/quran sessions,
 *   journal entries, health logs. Those are recorded history. Moving a completion
 *   would rewrite what happened, so the Timeline refuses rather than pretending.
 */
import type { TimelineItem } from './types';
import type { ArtProject, Goal, Project, ProjectPhase, Task } from '../../types';
import { localDateKey } from '../dateKey';

export type EditableAxis = 'move' | 'resize-start' | 'resize-end';

export interface EditCapability {
  move: boolean;
  resizeStart: boolean;
  resizeEnd: boolean;
  /** Why it is not editable, for the inspector to explain honestly. */
  readOnlyReasonAr?: string;
  readOnlyReasonEn?: string;
}

/**
 * Whole calendar days from `from` to `to`.
 *
 * A range's end is stored as the last instant of its final day (23:59:59.999), so a
 * raw millisecond difference is always just under a whole number of days and rounds
 * up. Flooring both ends to their day first is what keeps a 30-day goal 30 days long
 * after it moves.
 */
function wholeDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

const READ_ONLY_HISTORY = {
  readOnlyReasonAr: 'سجل فعلي — لا يُعاد كتابته من الجدول الزمني',
  readOnlyReasonEn: 'Recorded history — not rewritten from the timeline'
};

export function editCapability(item: TimelineItem): EditCapability {
  if (item.reality === 'actual') {
    return { move: false, resizeStart: false, resizeEnd: false, ...READ_ONLY_HISTORY };
  }

  switch (item.domain) {
    case 'tasks':
      // Only the planned item carries the schedule; the completion item is history.
      return item.id.endsWith(':planned')
        ? { move: true, resizeStart: false, resizeEnd: false }
        : { move: false, resizeStart: false, resizeEnd: false, ...READ_ONLY_HISTORY };
    case 'goals':
      // A milestone's date belongs to the milestone, and the goal range to the
      // goal's start/deadline. Both are editable, but a milestone moves alone.
      return item.kind === 'range'
        ? { move: true, resizeStart: true, resizeEnd: true }
        : { move: false, resizeStart: false, resizeEnd: false };
    case 'drawing':
      return item.kind === 'range'
        ? { move: true, resizeStart: true, resizeEnd: true }
        : { move: false, resizeStart: false, resizeEnd: false, ...READ_ONLY_HISTORY };
    case 'projects':
      // A project and a phase are both drawn as ranges from their plan dates. Recorded
      // history never reaches here: the `reality === 'actual'` guard above already
      // refused it, so this branch only ever handles an intention.
      return item.kind === 'range'
        ? { move: true, resizeStart: true, resizeEnd: true }
        : { move: false, resizeStart: false, resizeEnd: false, ...READ_ONLY_HISTORY };
    default:
      return { move: false, resizeStart: false, resizeEnd: false, ...READ_ONLY_HISTORY };
  }
}

export interface TimelineEditContext {
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  /** Project window edits. `Project` carries startDate/targetDate directly. */
  updateProject: (id: string, updates: Partial<Project>) => void;
  /** Phase window edits, routed to the owning project. */
  updateProjectPhase: (projectId: string, phaseId: string, updates: Partial<ProjectPhase>) => void;
  /** Needs the owning habit id; resolved by the view from the habit list. */
  updateArtProject: (habitId: string, project: ArtProject) => void;
  tasks: Task[];
  goals: Goal[];
  projects: Project[];
  habits: { id: string; drawingData?: { projects?: ArtProject[] } }[];
}

/**
 * Apply a drag. `newStart` is the item's new start; `newEnd` is only meaningful
 * for range items. Returns false when the edit could not be routed, so the view
 * can leave the item where it was instead of showing a change that did not save.
 */
export function applyTimelineEdit(
  item: TimelineItem,
  axis: EditableAxis,
  newStart: Date,
  newEnd: Date | undefined,
  ctx: TimelineEditContext
): boolean {
  const cap = editCapability(item);
  if (axis === 'move' && !cap.move) return false;
  if (axis === 'resize-start' && !cap.resizeStart) return false;
  if (axis === 'resize-end' && !cap.resizeEnd) return false;

  switch (item.domain) {
    case 'tasks': {
      const task = ctx.tasks.find((t) => t.id === item.entityId);
      if (!task) return false;
      // A task's scheduledTime is a real clock time the user chose, so preserve
      // it when the item had one. A date-only task stays date-only.
      const updates: Partial<Task> = { scheduledDate: localDateKey(newStart) };
      if (task.scheduledTime) {
        updates.scheduledTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(
          newStart.getMinutes()
        ).padStart(2, '0')}`;
      }
      ctx.updateTask(task.id, updates);
      return true;
    }
    case 'goals': {
      const goal = ctx.goals.find((g) => g.id === item.entityId);
      if (!goal) return false;
      const updates: Partial<Goal> = {};
      if (axis === 'resize-end') {
        updates.deadline = localDateKey(newEnd ?? newStart);
      } else if (axis === 'resize-start') {
        updates.startDate = localDateKey(newStart);
      } else {
        // Move the whole range: preserve its length rather than collapsing it.
        const spanDays = item.end ? wholeDaysBetween(item.start, item.end) : 0;
        updates.startDate = localDateKey(newStart);
        if (item.end) {
          const shifted = new Date(newStart.getTime() + spanDays * 86_400_000);
          updates.deadline = localDateKey(shifted);
        }
      }
      ctx.updateGoal(goal.id, updates);
      return true;
    }
    case 'drawing': {
      for (const habit of ctx.habits) {
        const project = habit.drawingData?.projects?.find((p) => p.id === item.entityId);
        if (!project) continue;
        const next: ArtProject = { ...project };
        if (axis === 'resize-end') {
          next.completedDate = localDateKey(newEnd ?? newStart);
        } else if (axis === 'resize-start') {
          next.startedDate = localDateKey(newStart);
        } else {
          const spanDays = item.end ? wholeDaysBetween(item.start, item.end) : 0;
          next.startedDate = localDateKey(newStart);
          if (item.end) {
            next.completedDate = localDateKey(new Date(newStart.getTime() + spanDays * 86_400_000));
          }
        }
        ctx.updateArtProject(habit.id, next);
        return true;
      }
      return false;
    }
    case 'projects': {
      const project = ctx.projects.find((p) => p.id === item.entityId);
      if (!project) return false;

      /*
       * A phase item carries the phase id in `subEntityId`, so the write targets the
       * phase's own window instead of flattening it onto the project. Re-deriving the
       * target from the item id would couple this module to the adapter's id format.
       */
      const phase = item.subEntityId
        ? project.phases.find((ph) => ph.id === item.subEntityId)
        : undefined;
      if (item.subEntityId && !phase) return false;

      const currentStart = phase ? phase.startDate : project.startDate;
      const currentEnd = phase ? phase.targetDate : project.targetDate;
      const spanDays =
        item.end && item.start
          ? wholeDaysBetween(item.start, item.end)
          : currentStart && currentEnd
            ? Math.round(
                (Date.parse(`${currentEnd}T00:00:00`) - Date.parse(`${currentStart}T00:00:00`)) /
                  86_400_000
              )
            : 0;

      let start = currentStart;
      let end = currentEnd;
      if (axis === 'resize-start') {
        start = localDateKey(newStart);
      } else if (axis === 'resize-end') {
        end = localDateKey(newEnd ?? newStart);
      } else {
        // Move the whole window: keep its length rather than collapsing it.
        start = localDateKey(newStart);
        if (currentStart && currentEnd) {
          end = localDateKey(new Date(newStart.getTime() + spanDays * 86_400_000));
        }
      }

      /*
       * A window whose end precedes its start is not a plan, it is a bug the reader
       * would have to undo by hand. Reject the edit so the item snaps back instead of
       * persisting an impossible range.
       */
      if (start && end && Date.parse(`${end}T00:00:00`) < Date.parse(`${start}T00:00:00`)) return false;

      if (phase) ctx.updateProjectPhase(project.id, phase.id, { startDate: start, targetDate: end });
      else ctx.updateProject(project.id, { startDate: start, targetDate: end });
      return true;
    }
    default:
      return false;
  }
}
