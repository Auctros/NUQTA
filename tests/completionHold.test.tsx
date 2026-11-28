/**
 * The completion hold: a just-completed row stays on screen long enough for its
 * checkmark to draw, without delaying the store write or leaking into other views.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useCompletionHold } from '../src/lib/useCompletionHold';
import { TasksView } from '../src/components/TasksView';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { isTaskDone } from '../src/lib/taskStatus';
import type { Task } from '../src/types';

// Completing a task fires confetti; jsdom has no canvas backend, so the real library
// throws on its first animation frame.
vi.mock('canvas-confetti', () => ({ default: () => {} }));

const S = () => useNuqtaStore.getState();

const task = (id: string, overrides: Partial<Task> = {}): Task =>
  ({
    id,
    title: id,
    status: 'todo',
    priority: 2,
    isTopThree: false,
    tags: [],
    subtasks: [],
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides
  }) as Task;

function Harness({ derived, all }: { derived: Task[]; all: Task[] }) {
  const { rows, hold, isExiting } = useCompletionHold(derived, all, 400);
  return (
    <div>
      <button onClick={() => hold(derived[0]?.id ?? 'x', 0)}>hold-first</button>
      <ul>
        {rows.map((row) => (
          <li key={row.id} data-exiting={isExiting(row.id)}>
            {row.id}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useCompletionHold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a row mounted for the hold window, then removes it', async () => {
    const only = task('a');
    const { rerender } = render(<Harness derived={[only]} all={[only]} />);
    expect(screen.queryByText('a')).not.toBeNull();

    fireEvent.click(screen.getByText('hold-first'));
    // The row left `derived` (it was completed) but must still be on screen.
    rerender(<Harness derived={[]} all={[only]} />);
    expect(screen.queryByText('a')).not.toBeNull();
    expect(screen.getByText('a').getAttribute('data-exiting')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.queryByText('a')).toBeNull();
  });

  it('never holds a row that is not in the store at all', () => {
    render(<Harness derived={[]} all={[]} />);
    fireEvent.click(screen.getByText('hold-first'));
    expect(screen.queryByText('x')).toBeNull();
  });

  it('drops the hold when the row comes back, so it is not duplicated', async () => {
    const only = task('a');
    const { rerender } = render(<Harness derived={[only]} all={[only]} />);
    fireEvent.click(screen.getByText('hold-first'));
    rerender(<Harness derived={[]} all={[only]} />);
    expect(screen.queryByText('a')).not.toBeNull();

    // Undo within the window: the row is back in `derived`, so it must appear once.
    rerender(<Harness derived={[only]} all={[only]} />);
    expect(screen.getAllByText('a')).toHaveLength(1);
    expect(screen.getByText('a').getAttribute('data-exiting')).toBe('false');
  });
});

describe('TasksView completion', () => {
  it('completes the task in the store immediately, not after the animation', () => {
    cleanup();
    S().createTask({ title: 't1', priority: 2 });
    const id = S().tasks[0].id;
    render(<TasksView />);

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    // Persistence must not wait for the visual hold.
    expect(isTaskDone(S().tasks.find((t) => t.id === id)!)).toBe(true);
  });

  it('keeps the completed row on screen while its checkmark draws', () => {
    cleanup();
    S().createTask({ title: 't2', priority: 2 });
    const id = S().tasks[0].id;
    render(<TasksView />);

    expect(screen.queryByText('t2')).not.toBeNull();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    // The row is no longer pending, yet it must still be visible for the animation.
    expect(isTaskDone(S().tasks.find((t) => t.id === id)!)).toBe(true);
    expect(screen.queryByText('t2')).not.toBeNull();
  });
});
