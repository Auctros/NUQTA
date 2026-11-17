import { describe, it, expect } from 'vitest';
import { isTaskActive, isTaskDone, isTaskClosed, isTaskPending, isTaskActiveDone } from '../src/lib/taskStatus';
import type { Task, TaskStatus } from '../src/types';

const task = (over: Partial<Task>): Task => ({ id: 't', title: 't', status: 'todo', ...over } as Task);

describe('task status model', () => {
  it('a plain todo is active, pending and open', () => {
    const t = task({ status: 'todo' });
    expect(isTaskActive(t)).toBe(true);
    expect(isTaskPending(t)).toBe(true);
    expect(isTaskDone(t)).toBe(false);
    expect(isTaskClosed(t)).toBe(false);
  });

  it('in_progress and deferred still count as pending', () => {
    expect(isTaskPending(task({ status: 'in_progress' }))).toBe(true);
    expect(isTaskPending(task({ status: 'deferred' }))).toBe(true);
  });

  it('completed is active but not pending', () => {
    const t = task({ status: 'completed' });
    expect(isTaskActive(t)).toBe(true);
    expect(isTaskDone(t)).toBe(true);
    expect(isTaskPending(t)).toBe(false);
    expect(isTaskActiveDone(t)).toBe(true);
  });

  it('archived, cancelled and skipped are closed and never pending', () => {
    (['archived', 'cancelled', 'skipped'] as TaskStatus[]).forEach((status) => {
      const t = task({ status });
      expect(isTaskClosed(t)).toBe(true);
      expect(isTaskPending(t)).toBe(false);
      expect(isTaskActive(t)).toBe(false);
    });
  });

  it('the isArchived flag closes a task regardless of status', () => {
    const t = task({ status: 'todo', isArchived: true });
    expect(isTaskActive(t)).toBe(false);
    expect(isTaskPending(t)).toBe(false);
    expect(isTaskDone(t)).toBe(false);
  });
});
