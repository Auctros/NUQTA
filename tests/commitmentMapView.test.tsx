/**
 * Commitment Map — rendering and the day handoff.
 *
 * The map is only useful if a shaded cell is a real, selectable day and if the two
 * views can pass a day to each other. Both are user-visible behaviour, so they are
 * asserted through the rendered DOM rather than by re-calling the engine.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommitmentMap } from '../src/components/CommitmentMap';
import type { CommitmentSources } from '../src/lib/commitmentMap';
import type { Habit } from '../src/types';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Read ten pages',
    anchor: 'After dinner',
    timeOfDay: 'evening',
    frequency: 'daily',
    category: 'learning',
    targetPerDay: 1,
    currentStreak: 0,
    longestStreak: 0,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: ['2026-11-10'],
    createdAt: '2026-11-01T08:00:00.000Z',
    ...overrides
  };
}

const sources = (overrides: Partial<CommitmentSources> = {}): CommitmentSources => ({
  tasks: [],
  habits: [habit()],
  focusSessions: [],
  journalEntries: [],
  ...overrides
});

const cell = (dateKey: string) => screen.getByRole('gridcell', { name: new RegExp(dateKey) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('CommitmentMap — the grid', () => {
  it('renders one accessible cell per day of the year', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    expect(screen.getByRole('grid', { name: /2026/ })).toBeTruthy();
    expect(screen.getAllByRole('gridcell')).toHaveLength(365);
  });

  it('describes a kept day with what was due and done, not just a colour', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    expect(cell('2026-11-10').getAttribute('aria-label')).toMatch(/1\/1 kept/);
  });

  it('distinguishes a missed day from an upcoming one in the cell label', () => {
    render(
      <CommitmentMap
        sources={sources({ habits: [habit({ completedDates: [] })] })}
        isAr={false}
        variant="full"
      />
    );
    expect(cell('2026-11-10').getAttribute('aria-label')).toMatch(/Missed/);
    expect(cell('2026-11-14').getAttribute('aria-label')).toMatch(/Upcoming/);
  });

  it('shows the pre-tracking note so blank days are not read as failure', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    expect(screen.getByText(/before tracking began/i)).toBeTruthy();
  });

  it('renders the Arabic legend when asked', () => {
    render(<CommitmentMap sources={sources()} isAr variant="full" />);
    expect(screen.getByText('فائت')).toBeTruthy();
    expect(screen.getByText('لا شيء مستحق')).toBeTruthy();
  });
});

describe('CommitmentMap — day selection', () => {
  it('opens the day panel when a cell is clicked', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    expect(screen.queryByText(/^Due$/)).toBeNull();
    fireEvent.click(cell('2026-11-10'));
    expect(screen.getByText(/^Due$/)).toBeTruthy();
    expect(screen.getByText(/^Done$/)).toBeTruthy();
  });

  it('marks the selected cell as pressed for assistive tech', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    fireEvent.click(cell('2026-11-10'));
    expect(cell('2026-11-10').getAttribute('aria-pressed')).toBe('true');
    expect(cell('2026-11-09').getAttribute('aria-pressed')).toBe('false');
  });

  it('opens the panel for a day passed in from the timeline', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" initialDay="2026-11-10" />);
    expect(screen.getByText(/^Due$/)).toBeTruthy();
    expect(cell('2026-11-10').getAttribute('aria-pressed')).toBe('true');
  });

  it('closes the panel', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" initialDay="2026-11-10" />);
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(screen.queryByText(/^Due$/)).toBeNull();
  });

  it('hands the selected day back to the timeline', () => {
    const onOpenTimeline = vi.fn();
    render(
      <CommitmentMap
        sources={sources()}
        isAr={false}
        variant="full"
        initialDay="2026-11-10"
        onOpenTimeline={onOpenTimeline}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Open this day in the timeline/i }));
    expect(onOpenTimeline).toHaveBeenCalledWith('2026-11-10');
  });

  it('offers no timeline handoff when the caller did not ask for one', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" initialDay="2026-11-10" />);
    expect(screen.queryByRole('button', { name: /timeline/i })).toBeNull();
  });
});

describe('CommitmentMap — scope', () => {
  it('narrows the map to one scheduled domain', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="full" />);
    const habits = screen.getByRole('button', { name: /Habits/i });
    fireEvent.click(habits);
    expect(habits.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Everything/i }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });
});

describe('CommitmentMap — compact variant', () => {
  it('renders the grid without the full summary panel', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="compact" />);
    expect(screen.getByRole('grid', { name: /2026/ })).toBeTruthy();
    expect(screen.queryByText(/^Full days$/)).toBeNull();
  });

  it('still lets the dashboard reader open a day', () => {
    render(<CommitmentMap sources={sources()} isAr={false} variant="compact" />);
    fireEvent.click(cell('2026-11-10'));
    expect(screen.getByText(/^Due$/)).toBeTruthy();
  });
});
