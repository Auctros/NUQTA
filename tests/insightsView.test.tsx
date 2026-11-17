import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { InsightsView } from '../src/components/InsightsView';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { localDateKey, addDaysToKey } from '../src/lib/dateKey';
import type { Habit, Task } from '../src/types';

/**
 * InsightsView render contract: it must always answer the range question with a
 * section switcher and an honest empty state, and it must surface a domain's real
 * numbers once records exist — never a fabricated zero for an empty domain.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z')); // Wed, local Cairo
  localStorage.clear();
  useNuqtaStore.getState().initializeStore();
});
afterEach(() => vi.useRealTimers());

function activeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Read',
    anchor: 'Morning',
    timeOfDay: 'morning',
    frequency: 'daily',
    category: 'learning',
    targetPerDay: 1,
    currentStreak: 1,
    longestStreak: 1,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [localDateKey()],
    createdAt: '2026-01-01T08:00:00.000Z',
    status: 'active',
    ...overrides
  };
}

describe('InsightsView', () => {
  it('renders the analytics header, range selector and section switcher on an empty store', () => {
    render(<InsightsView />);
    expect(screen.getByText('Insights')).toBeTruthy();
    // All five ranges are offered.
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('30 days')).toBeTruthy();
    expect(screen.getByText('90 days')).toBeTruthy();
    expect(screen.getByText('12 months')).toBeTruthy();
    expect(screen.getByText('All-time')).toBeTruthy();
    // Every section is reachable (names also appear on the summary cards, so
    // assert at least one match per section).
    for (const label of ['Execution', 'Habits', 'Goals', 'Finance', 'Patterns']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('states that there are no records instead of inventing numbers on an empty store', () => {
    render(<InsightsView />);
    expect(screen.getByText('No records in this window')).toBeTruthy();
    // The honesty note about not inventing numbers is present.
    expect(screen.getByText(/it will not invent numbers/)).toBeTruthy();
  });

  it('shows real habit and task numbers once records exist', () => {
    NuqtaStorageEngine.saveHabits([activeHabit()]);
    NuqtaStorageEngine.saveTasks([
      {
        id: 't1',
        title: 'Ship',
        priority: 2,
        isTopThree: false,
        status: 'completed',
        scheduledDate: localDateKey(),
        completedAt: `${localDateKey()}T10:00:00.000Z`,
        tags: [],
        subtasks: [],
        createdAt: `${addDaysToKey(localDateKey(), -1)}T08:00:00.000Z`,
        updatedAt: `${localDateKey()}T10:00:00.000Z`
      } as Task
    ]);
    useNuqtaStore.getState().initializeStore();

    render(<InsightsView />);

    // The empty-window notice is gone and the coverage strip reports a recorded day.
    expect(screen.queryByText('No records in this window')).toBeNull();
    // 100% adherence card for a daily habit completed today.
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('switches to a section that has no data and shows its honest empty state', () => {
    render(<InsightsView />);
    const financeTab = screen
      .getAllByText('Finance')
      .map((el) => el.closest('button'))
      .find((b): b is HTMLButtonElement => !!b && b.hasAttribute('aria-pressed'))!;
    act(() => {
      financeTab.click();
    });
    expect(screen.getByText(/No data for this section/)).toBeTruthy();
  });
});
