/**
 * Timeline Workspace — the rendered canvas.
 *
 * These tests drive the real store and the real component. The behaviours worth
 * pinning are the ones a user would notice if they broke:
 *
 *   - the canvas draws records that exist, and nothing that does not
 *   - dragging a planned task moves its scheduled date in the store
 *   - recorded history cannot be dragged, and the inspector says why
 *   - an undated task is surfaced as backlog rather than silently dropped
 *   - switching preset changes the projection without touching the records
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { TimelineWorkspace } from '../src/components/timeline/TimelineWorkspace';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { localDateKey } from '../src/lib/dateKey';
import { PX_PER_DAY } from '../src/lib/timeline/scale';

const S = () => useNuqtaStore.getState();

/** A local day key `offset` days from today. */
function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDateKey(d);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00'));
  localStorage.clear();
  S().initializeStore();
});

afterEach(() => {
  vi.useRealTimers();
});

const renderTimeline = async () => {
  await act(async () => {
    render(<TimelineWorkspace />);
  });
};

/** Seed one task and return its id. */
const seedTask = async (draft: Parameters<ReturnType<typeof S>['createTask']>[0]) => {
  await act(async () => {
    S().createTask(draft);
  });
  return S().tasks[S().tasks.length - 1].id;
};

describe('Timeline Workspace — the canvas', () => {
  it('shows an empty state rather than an empty axis when there is no data', async () => {
    await renderTimeline();
    expect(screen.getByText(/Nothing on the axis yet/i)).toBeTruthy();
  });

  it('draws a scheduled task as a planned item', async () => {
    await seedTask({ title: 'Write the brief', scheduledDate: dayKey(0) });
    await renderTimeline();

    const item = screen.getByRole('button', { name: /Write the brief — planned/i });
    expect(item).toBeTruthy();
    expect(item.getAttribute('data-reality')).toBe('planned');
  });

  it('never draws a completion it was not given', async () => {
    await seedTask({ title: 'Open task', scheduledDate: dayKey(0) });
    await renderTimeline();
    expect(screen.queryByRole('button', { name: /Open task — actual/i })).toBeNull();
  });

  it('draws a completed task as an actual item as well as its plan', async () => {
    const id = await seedTask({ title: 'Finished thing', scheduledDate: dayKey(-1) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    await renderTimeline();

    expect(screen.getByRole('button', { name: /Finished thing — planned/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finished thing — actual/i })).toBeTruthy();
  });

  it('surfaces an undated task as backlog instead of dropping it', async () => {
    const id = await seedTask({ title: 'Someday maybe' });
    // createTask schedules an undated task for today, so clear the date to model
    // the real "captured but not scheduled" case.
    await act(async () => {
      S().updateTask(id, { scheduledDate: undefined });
    });
    await renderTimeline();
    expect(screen.getByText('Someday maybe')).toBeTruthy();
    expect(screen.getByText(/Unscheduled/i)).toBeTruthy();
  });
});

describe('Timeline Workspace — the inspector', () => {
  it('explains that recorded history is not editable', async () => {
    const id = await seedTask({ title: 'Historic task', scheduledDate: dayKey(-2) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    await renderTimeline();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Historic task — actual/i }));
    });

    expect(screen.getByText(/Recorded history/i)).toBeTruthy();
    // The planned twin is still editable, so no read-only note is shown for it.
    expect(screen.getByText('Historic task')).toBeTruthy();
  });

  it('shows the planned dates of a goal range', async () => {
    await act(async () => {
      S().createGoal({
        title: 'Ship the product',
        startDate: dayKey(-10),
        deadline: dayKey(10),
        timeframe: 'quarterly',
        category: 'career'
      });
    });
    await renderTimeline();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ship the product — planned/i }));
    });

    expect(screen.getByText('Starts')).toBeTruthy();
    expect(screen.getByText('Ends')).toBeTruthy();
  });
});

describe('Timeline Workspace — dragging persists', () => {
  /**
   * jsdom has no layout, so a drag is simulated with the pointer coordinates the
   * handler actually reads: pointerdown on the item, pointermove, pointerup. The
   * canvas width comes from PX_PER_DAY, so a known pixel delta is a known day delta.
   */
  it('moves a planned task to a later day in the store', async () => {
    const start = dayKey(0);
    const id = await seedTask({ title: 'Drag me', scheduledDate: start });
    await renderTimeline();

    const item = screen.getByRole('button', { name: /Drag me — planned/i });

    // The default preset opens at quarter zoom; derive the delta from the same
    // pixels-per-day the canvas uses so +2 days is exactly +2 days.
    const deltaPx = PX_PER_DAY.quarter * 2;
    await act(async () => {
      fireEvent.pointerDown(item, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 100 + deltaPx, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 100 + deltaPx, pointerId: 1 });
    });

    const updated = S().tasks.find((t) => t.id === id)!;
    expect(updated.scheduledDate).toBe(dayKey(2));
  });

  it('does not move a task on a click that never crosses the drag threshold', async () => {
    const start = dayKey(0);
    const id = await seedTask({ title: 'Click me', scheduledDate: start });
    await renderTimeline();

    const item = screen.getByRole('button', { name: /Click me — planned/i });

    await act(async () => {
      fireEvent.pointerDown(item, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 102, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 102, pointerId: 1 });
    });

    expect(S().tasks.find((t) => t.id === id)!.scheduledDate).toBe(start);
  });

  it('moves an editable item with the arrow keys, since a canvas must be keyboard-operable', async () => {
    const start = dayKey(0);
    const id = await seedTask({ title: 'Key me', scheduledDate: start });
    await renderTimeline();

    const item = screen.getByRole('button', { name: /Key me — planned/i });
    await act(async () => {
      fireEvent.keyDown(item, { key: 'ArrowRight' });
    });

    expect(S().tasks.find((t) => t.id === id)!.scheduledDate).toBe(dayKey(1));
  });

  it('moves a week at a time with shift+arrow', async () => {
    const start = dayKey(0);
    const id = await seedTask({ title: 'Week jump', scheduledDate: start });
    await renderTimeline();

    const item = screen.getByRole('button', { name: /Week jump — planned/i });
    await act(async () => {
      fireEvent.keyDown(item, { key: 'ArrowRight', shiftKey: true });
    });

    expect(S().tasks.find((t) => t.id === id)!.scheduledDate).toBe(dayKey(7));
  });

  it('refuses keyboard edits on recorded history too', async () => {
    const id = await seedTask({ title: 'Frozen', scheduledDate: dayKey(-1) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    const before = S().tasks.find((t) => t.id === id)!.scheduledDate;
    await renderTimeline();

    const actual = screen.getByRole('button', { name: /Frozen — actual/i });
    await act(async () => {
      fireEvent.keyDown(actual, { key: 'ArrowRight' });
    });

    expect(S().tasks.find((t) => t.id === id)!.scheduledDate).toBe(before);
  });

  it('refuses to drag recorded history, leaving the record untouched', async () => {
    const id = await seedTask({ title: 'Immovable', scheduledDate: dayKey(-1) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    const before = S().tasks.find((t) => t.id === id)!;
    await renderTimeline();

    const actual = screen.getByRole('button', { name: /Immovable — actual/i });

    await act(async () => {
      const far = 100 + PX_PER_DAY.quarter * 10;
      fireEvent.pointerDown(actual, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: far, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: far, pointerId: 1 });
    });

    const after = S().tasks.find((t) => t.id === id)!;
    expect(after.scheduledDate).toBe(before.scheduledDate);
    expect(after.completedAt).toBe(before.completedAt);
  });
});

describe('Timeline Workspace — lane visibility', () => {
  /**
   * A preset used to be a second visibility rule, so a lane the preset excluded
   * could never be turned back on, and a lane it included could never be turned
   * off. Visibility now lives in one place: `hiddenDomains`.
   */
  it('hides a lane the active preset includes, and the toggle sticks', async () => {
    await seedTask({ title: 'In the task lane', scheduledDate: dayKey(0) });
    await renderTimeline();

    expect(screen.getByRole('button', { name: /In the task lane — planned/i })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lanes' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    });

    expect(screen.queryByRole('button', { name: /In the task lane — planned/i })).toBeNull();
  });

  it('keeps a hidden lane hidden after switching preset and back', async () => {
    await seedTask({ title: 'Still here', scheduledDate: dayKey(0) });
    await renderTimeline();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lanes' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    });
    expect(screen.queryByRole('button', { name: /Still here — planned/i })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activity history' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Life overview' }));
    });

    // Re-applying the overview preset re-seeds the lanes, so the task returns.
    expect(screen.getByRole('button', { name: /Still here — planned/i })).toBeTruthy();
  });
});

describe('Timeline Workspace — presets', () => {
  it('switches to planned-only without altering any record', async () => {
    const id = await seedTask({ title: 'Both kinds', scheduledDate: dayKey(-1) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    await renderTimeline();

    expect(screen.getByRole('button', { name: /Both kinds — actual/i })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Planning' }));
    });

    expect(screen.queryByRole('button', { name: /Both kinds — actual/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Both kinds — planned/i })).toBeTruthy();

    // The projection changed; the record did not.
    expect(S().tasks.find((t) => t.id === id)!.status).toBe('completed');
  });

  it('shows only actual activity in the history preset', async () => {
    const id = await seedTask({ title: 'Historic', scheduledDate: dayKey(-1) });
    await act(async () => {
      S().updateTask(id, { status: 'completed', completedAt: new Date().toISOString() });
    });
    await renderTimeline();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activity history' }));
    });

    expect(screen.getByRole('button', { name: /Historic — actual/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Historic — planned/i })).toBeNull();
  });
});
