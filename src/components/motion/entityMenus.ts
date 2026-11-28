import type { ContextMenuItem } from './ContextMenu';
import type { Task } from '../../types';
import { isTaskDone } from '../../lib/taskStatus';

/* ============================================================
   NUQTA — entity context menus
   ------------------------------------------------------------
   Menu definitions built from actions that already exist in the
   store. Nothing here invents a capability: every row either calls
   an existing action or is a link into an existing view.

   Rows are filtered by the entity's *current state*, so a task
   offers "Reopen" only when it is done, "Archive" only when it is
   not archived, and "Restore" only when it is.
   ============================================================ */

export interface TaskMenuContext {
  task: Task;
  isAr: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onDelete: () => void;
  onLinkGoal?: () => void;
  onOpenProject?: () => void;
  /** Goal titles for the "Link to goal" submenu; empty hides the row. */
  goals?: { id: string; title: string; linked: boolean }[];
  onToggleGoalLink?: (goalId: string, linked: boolean) => void;
}

export function buildTaskMenu(ctx: TaskMenuContext): ContextMenuItem[] {
  const { task, isAr } = ctx;
  const done = isTaskDone(task);
  const archived = Boolean(task.isArchived);
  const T = (en: string, ar: string) => (isAr ? ar : en);

  const items: ContextMenuItem[] = [
    {
      kind: 'item',
      id: 'open',
      label: T('Open', 'فتح'),
      icon: 'edit',
      onSelect: ctx.onOpen
    },
    {
      kind: 'item',
      id: 'toggle',
      label: done ? T('Reopen', 'إعادة فتح') : T('Mark complete', 'إتمام'),
      icon: done ? 'undo' : 'check',
      onSelect: ctx.onToggle
    }
  ];

  if (ctx.onOpenProject && task.projectId) {
    items.push({
      kind: 'item',
      id: 'project',
      label: T('Go to project', 'الانتقال إلى المشروع'),
      icon: 'layers',
      onSelect: ctx.onOpenProject
    });
  }

  if (ctx.onToggleGoalLink && ctx.goals && ctx.goals.length > 0) {
    items.push({
      kind: 'submenu',
      id: 'link-goal',
      label: T('Link to goal', 'ربط بهدف'),
      icon: 'target',
      items: ctx.goals.map<ContextMenuItem>((goal) => ({
        kind: 'checkbox',
        id: `goal-${goal.id}`,
        label: goal.title,
        checked: goal.linked,
        onSelect: () => ctx.onToggleGoalLink?.(goal.id, goal.linked)
      }))
    });
  }

  items.push({ kind: 'separator', id: 'sep-1' });

  if (archived) {
    if (ctx.onRestore) {
      items.push({
        kind: 'item',
        id: 'restore',
        label: T('Restore', 'استعادة'),
        icon: 'restore',
        onSelect: ctx.onRestore
      });
    }
  } else {
    items.push({
      kind: 'item',
      id: 'archive',
      label: T('Archive', 'أرشفة'),
      icon: 'archive',
      onSelect: ctx.onArchive
    });
  }

  items.push({
    kind: 'item',
    id: 'delete',
    label: T('Delete', 'حذف'),
    icon: 'trash',
    tone: 'danger',
    onSelect: ctx.onDelete
  });

  return items;
}

export interface BasicEntityMenuContext {
  isAr: boolean;
  done: boolean;
  archived?: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}

/** Habit / project / course / book share this shape: open, toggle, archive, delete. */
export function buildBasicMenu(ctx: BasicEntityMenuContext): ContextMenuItem[] {
  const T = (en: string, ar: string) => (ctx.isAr ? ar : en);
  const items: ContextMenuItem[] = [
    { kind: 'item', id: 'open', label: T('Open', 'فتح'), icon: 'edit', onSelect: ctx.onOpen },
    {
      kind: 'item',
      id: 'toggle',
      label: ctx.done ? T('Reopen', 'إعادة فتح') : T('Mark complete', 'إتمام'),
      icon: ctx.done ? 'undo' : 'check',
      onSelect: ctx.onToggle
    },
    { kind: 'separator', id: 'sep-1' }
  ];

  if (ctx.archived && ctx.onRestore) {
    items.push({
      kind: 'item',
      id: 'restore',
      label: T('Restore', 'استعادة'),
      icon: 'restore',
      onSelect: ctx.onRestore
    });
  } else if (ctx.onArchive) {
    items.push({
      kind: 'item',
      id: 'archive',
      label: T('Archive', 'أرشفة'),
      icon: 'archive',
      onSelect: ctx.onArchive
    });
  }

  items.push({
    kind: 'item',
    id: 'delete',
    label: T('Delete', 'حذف'),
    icon: 'trash',
    tone: 'danger',
    onSelect: ctx.onDelete
  });

  return items;
}
