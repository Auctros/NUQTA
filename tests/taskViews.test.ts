import { describe, it, expect } from 'vitest';
import {
  asTaskView,
  countTasksForViews,
  describeTaskView,
  groupCompletedByDay,
  needsAttention,
  selectTasksForView,
  TASK_VIEWS
} from '../src/lib/taskViews';
import type { Task } from '../src/types';

const TODAY = '2026-03-15';

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    priority: 2,
    isTopThree: false,
    status: 'todo',
    tags: [],
    subtasks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as Task;
}

describe('task views: which tasks belong where', () => {
  const tasks: Task[] = [
    task({ id: 'overdue', scheduledDate: '2026-03-10' }),
    task({ id: 'today', scheduledDate: TODAY }),
    task({ id: 'future', scheduledDate: '2026-03-20' }),
    task({ id: 'undated' }),
    task({ id: 'done', status: 'completed', completedAt: '2026-03-14T10:00:00.000Z' }),
    task({ id: 'done-today', status: 'completed', completedAt: '2026-03-15T08:00:00.000Z' }),
    task({ id: 'archived', status: 'archived', isArchived: true }),
    task({ id: 'skipped', status: 'skipped' })
  ];

  it('Today holds overdue and today work — never undated or finished work', () => {
    const ids = selectTasksForView(tasks, 'today', TODAY).map((t) => t.id).sort();
    expect(ids).toEqual(['overdue', 'today']);
    expect(ids).not.toContain('undated');
    expect(ids).not.toContain('done');
    expect(ids).not.toContain('archived');
  });

  it('Upcoming holds only future-dated pending work', () => {
    expect(selectTasksForView(tasks, 'upcoming', TODAY).map((t) => t.id)).toEqual(['future']);
  });

  it('Inbox holds only undated pending work', () => {
    expect(selectTasksForView(tasks, 'inbox', TODAY).map((t) => t.id)).toEqual(['undated']);
  });

  it('Completed holds finished work newest-first and nothing else', () => {
    const ids = selectTasksForView(tasks, 'completed', TODAY).map((t) => t.id);
    expect(ids).toEqual(['done-today', 'done']);
  });

  it('Archived holds set-aside work, including skipped', () => {
    const ids = selectTasksForView(tasks, 'archived', TODAY).map((t) => t.id).sort();
    expect(ids).toEqual(['archived', 'skipped']);
  });

  it('every view is mutually exclusive — a task never appears twice', () => {
    const seen = new Map<string, string>();
    for (const view of ['today', 'upcoming', 'inbox', 'completed', 'archived'] as const) {
      for (const t of selectTasksForView(tasks, view, TODAY)) {
        expect(seen.has(t.id)).toBe(false);
        seen.set(t.id, view);
      }
    }
    // Every seeded task lands in exactly one view.
    expect(seen.size).toBe(tasks.length);
  });

  it('counts match the selections', () => {
    const counts = countTasksForViews(tasks, TODAY);
    for (const view of TASK_VIEWS) {
      expect(counts[view]).toBe(selectTasksForView(tasks, view, TODAY).length);
    }
  });

  it('needsAttention is false for done and archived work', () => {
    expect(needsAttention(task({ id: 'a' }))).toBe(true);
    expect(needsAttention(task({ id: 'b', status: 'completed' }))).toBe(false);
    expect(needsAttention(task({ id: 'c', status: 'archived' }))).toBe(false);
    expect(needsAttention(task({ id: 'd', status: 'skipped' }))).toBe(false);
  });
});

describe('completed history grouping', () => {
  it('groups by completion day, newest day first', () => {
    const groups = groupCompletedByDay([
      task({ id: 'a', status: 'completed', completedAt: '2026-03-14T09:00:00.000Z' }),
      task({ id: 'b', status: 'completed', completedAt: '2026-03-15T09:00:00.000Z' }),
      task({ id: 'c', status: 'completed', completedAt: '2026-03-14T20:00:00.000Z' })
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-03-15', '2026-03-14']);
    expect(groups[1].tasks.map((t) => t.id).sort()).toEqual(['a', 'c']);
  });

  it('keeps records without completedAt instead of dropping them', () => {
    const groups = groupCompletedByDay([task({ id: 'legacy', status: 'completed' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].day).toBe('');
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['legacy']);
  });
});

describe('view narrowing and labels', () => {
  it('falls back to today for unknown or corrupt persisted values', () => {
    expect(asTaskView('completed')).toBe('completed');
    expect(asTaskView('all')).toBe('today');
    expect(asTaskView(null)).toBe('today');
    expect(asTaskView(42)).toBe('today');
  });

  it('every view has a label and a hint in both languages', () => {
    for (const view of TASK_VIEWS) {
      for (const isAr of [true, false]) {
        const described = describeTaskView(view, isAr);
        expect(described.label.length).toBeGreaterThan(0);
        expect(described.hint.length).toBeGreaterThan(0);
      }
    }
  });
});
