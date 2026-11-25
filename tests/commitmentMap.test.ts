/**
 * Commitment Map.
 *
 * These tests exist to protect the *semantics*, which are the reason the module exists:
 * a day where nothing was due must never be shaded as a failure, a skipped task is not a
 * broken promise, and acts of intent without a due date must not dilute a day that was
 * genuinely missed. A refactor that quietly turns any of those into "just a ratio" would
 * pass a naive test and still make the map lie.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCommitmentYear,
  findTrackingStart,
  levelForRatio,
  weekOf,
  yearDayKeys
} from '../src/lib/commitmentMap';
import type { CommitmentSources } from '../src/lib/commitmentMap';
import type { FocusSession, Habit, JournalEntry, Task } from '../src/types';

const TODAY = '2026-11-11'; // Wednesday

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: `t${Math.random().toString(36).slice(2, 8)}`,
    title: 'Task',
    priority: 2,
    isTopThree: false,
    status: 'todo',
    tags: [],
    subtasks: [],
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...overrides
  };
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: `h${Math.random().toString(36).slice(2, 8)}`,
    name: 'Habit',
    anchor: 'After coffee',
    timeOfDay: 'morning',
    frequency: 'daily',
    category: 'health',
    targetPerDay: 1,
    currentStreak: 0,
    longestStreak: 0,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [],
    createdAt: '2026-11-01T08:00:00.000Z',
    ...overrides
  };
}

function focusSession(dateKey: string, minutes = 30): FocusSession {
  return {
    id: `f${Math.random().toString(36).slice(2, 8)}`,
    durationMinutes: minutes,
    targetMinutes: 25,
    interruptionCount: 0,
    preMood: 3,
    postMood: 4,
    productivityScore: 4,
    completedAt: `${dateKey}T18:00:00.000Z`
  };
}

function journal(dateKey: string): JournalEntry {
  return {
    id: `j${Math.random().toString(36).slice(2, 8)}`,
    date: dateKey,
    whatWentWell: '',
    whatDrainedEnergy: '',
    planForTomorrow: '',
    gratitudeList: [],
    mood: 3,
    isEncrypted: false,
    createdAt: `${dateKey}T21:00:00.000Z`
  };
}

function sources(overrides: Partial<CommitmentSources> = {}): CommitmentSources {
  return {
    tasks: [],
    habits: [],
    focusSessions: [],
    journalEntries: [],
    ...overrides
  };
}

const dayAt = (year: ReturnType<typeof buildCommitmentYear>, dateKey: string) =>
  year.weeks.flat().find((d) => d && d.dateKey === dateKey) ?? null;

describe('yearDayKeys', () => {
  it('returns every day of the year in order', () => {
    const keys = yearDayKeys(2026);
    expect(keys).toHaveLength(365);
    expect(keys[0]).toBe('2026-01-01');
    expect(keys[keys.length - 1]).toBe('2026-12-31');
  });

  it('handles a leap year', () => {
    expect(yearDayKeys(2028)).toHaveLength(366);
  });

  it('returns nothing for a malformed year instead of looping', () => {
    expect(yearDayKeys(NaN)).toEqual([]);
  });
});

describe('weekOf', () => {
  it('runs Saturday to Friday, matching NUQTA weeks', () => {
    const week = weekOf('2026-11-11'); // Wednesday
    expect(week[0]).toBe('2026-11-07'); // Saturday
    expect(week[6]).toBe('2026-11-13'); // Friday
  });
});

describe('findTrackingStart', () => {
  it('returns the earliest recorded day across every source', () => {
    const start = findTrackingStart(
      sources({
        habits: [habit({ createdAt: '2026-03-02T08:00:00.000Z' })],
        tasks: [task({ scheduledDate: '2026-02-01' })]
      })
    );
    expect(start).toBe('2026-02-01');
  });

  it('returns null when the person has no records at all', () => {
    expect(findTrackingStart(sources())).toBeNull();
  });
});

describe('levelForRatio', () => {
  it('is always 4 for a kept day and 0 for a missed one, regardless of ratio', () => {
    expect(levelForRatio(1, 'kept')).toBe(4);
    expect(levelForRatio(0, 'missed')).toBe(0);
  });

  it('grades a partial day by how much was kept', () => {
    expect(levelForRatio(0.1, 'partial')).toBe(1);
    expect(levelForRatio(0.5, 'partial')).toBe(2);
    expect(levelForRatio(0.8, 'partial')).toBe(3);
  });

  it('gives no level to days that were not measured', () => {
    for (const state of ['rest', 'no_data', 'future'] as const) {
      expect(levelForRatio(null, state)).toBe(0);
    }
  });
});

describe('buildCommitmentYear — day states', () => {
  it('marks a day where a due habit was kept as kept', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const day = dayAt(year, '2026-11-10')!;
    expect(day.state).toBe('kept');
    expect(day.dueCount).toBe(1);
    expect(day.doneCount).toBe(1);
    expect(day.level).toBe(4);
  });

  it('marks a day where a due habit was skipped as missed, with no ratio credit', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const day = dayAt(year, '2026-11-10')!;
    expect(day.state).toBe('missed');
    expect(day.ratio).toBe(0);
    expect(day.level).toBe(0);
  });

  it('scores a partially kept day between the two', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const other = habit({ createdAt: '2026-11-01T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h, other] }), 2026, 'all', TODAY);
    const day = dayAt(year, '2026-11-10')!;
    expect(day.state).toBe('partial');
    expect(day.ratio).toBe(0.5);
  });

  it('marks a day with nothing due and nothing done as rest, not as a failure', () => {
    const h = habit({
      createdAt: '2026-11-01T08:00:00.000Z',
      frequency: 'custom',
      customDays: [1] // Mondays only
    });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const tuesday = dayAt(year, '2026-11-10')!;
    expect(tuesday.state).toBe('rest');
    expect(tuesday.level).toBe(0);
    expect(tuesday.ratio).toBeNull();
  });

  it('never shades a day before tracking began as missed', () => {
    const h = habit({ createdAt: '2026-11-05T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const before = dayAt(year, '2026-03-02')!;
    expect(before.state).toBe('no_data');
    expect(before.insufficient).toBe(true);
    expect(before.ratio).toBeNull();
  });

  it('marks days after today as future', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    expect(dayAt(year, '2026-12-01')!.state).toBe('future');
  });

  it('treats the day before a habit existed as no data, not as a rest day', () => {
    const h = habit({ createdAt: '2026-11-09T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const earlier = dayAt(year, '2026-11-08')!;
    expect(earlier.dueCount).toBe(0);
    // Tracking started on the 9th, so the 8th is unmeasured rather than "rested".
    expect(earlier.state).toBe('no_data');
  });

  it('treats a scheduled-off day inside the tracking window as rest', () => {
    const h = habit({
      createdAt: '2026-11-01T08:00:00.000Z',
      frequency: 'custom',
      customDays: [1] // Mondays only
    });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    const tuesday = dayAt(year, '2026-11-10')!;
    expect(tuesday.state).toBe('rest');
  });
});

describe('buildCommitmentYear — bonus acts', () => {
  it('lifts a day with nothing due into kept, without inventing a ratio', () => {
    const year = buildCommitmentYear(
      sources({ focusSessions: [focusSession('2026-11-10', 45)] }),
      2026,
      'all',
      TODAY
    );
    const day = dayAt(year, '2026-11-10')!;
    expect(day.state).toBe('kept');
    expect(day.bonusCount).toBe(1);
    expect(day.bonusMinutes).toBe(45);
    expect(day.dueCount).toBe(0);
  });

  it('never lets a bonus act mask a missed commitment', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z' });
    const year = buildCommitmentYear(
      sources({ habits: [h], focusSessions: [focusSession('2026-11-10')] }),
      2026,
      'all',
      TODAY
    );
    const day = dayAt(year, '2026-11-10')!;
    expect(day.state).toBe('missed');
    expect(day.ratio).toBe(0);
    expect(day.bonusCount).toBe(1);
  });

  it('counts a journal entry as bonus intent', () => {
    const year = buildCommitmentYear(
      sources({ journalEntries: [journal('2026-11-10')] }),
      2026,
      'all',
      TODAY
    );
    expect(dayAt(year, '2026-11-10')!.bonusCount).toBe(1);
  });

  it('does not double-count a habit or task event as bonus intent', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const year = buildCommitmentYear(
      sources({
        habits: [h],
        tasks: [task({ scheduledDate: '2026-11-10', status: 'completed' })],
        // The same day expressed again as derived history, as the timeline would see it.
        history: [
          { id: 'x1', domain: 'habits', eventType: 'completed', title: 'Habit done', date: '2026-11-10', timestamp: '2026-11-10T08:00:00.000Z', entityId: 'h', entityType: 'habit' },
          { id: 'x2', domain: 'tasks', eventType: 'completed', title: 'Task done', date: '2026-11-10', timestamp: '2026-11-10T09:00:00.000Z', entityId: 't', entityType: 'task' }
        ] as CommitmentSources['history']
      }),
      2026,
      'all',
      TODAY
    );
    const day = dayAt(year, '2026-11-10')!;
    expect(day.dueCount).toBe(2);
    expect(day.doneCount).toBe(2);
    expect(day.bonusCount).toBe(0);
  });
});

describe('buildCommitmentYear — task semantics', () => {
  it('ignores a task with no scheduled day: it was never a promise for a date', () => {
    const year = buildCommitmentYear(
      sources({ tasks: [task({ status: 'completed', completedAt: '2026-11-10T09:00:00.000Z' })] }),
      2026,
      'all',
      TODAY
    );
    expect(dayAt(year, '2026-11-10')!.dueCount).toBe(0);
  });

  it('does not count a skipped occurrence as a broken commitment', () => {
    const year = buildCommitmentYear(
      sources({ tasks: [task({ scheduledDate: '2026-11-10', status: 'skipped' })] }),
      2026,
      'all',
      TODAY
    );
    const day = dayAt(year, '2026-11-10')!;
    expect(day.dueCount).toBe(0);
    expect(day.state).toBe('rest');
  });

  it('counts a scheduled task as due and, when completed, as done', () => {
    const year = buildCommitmentYear(
      sources({
        tasks: [
          task({ scheduledDate: '2026-11-10', status: 'completed' }),
          task({ scheduledDate: '2026-11-10', status: 'todo' })
        ]
      }),
      2026,
      'all',
      TODAY
    );
    const day = dayAt(year, '2026-11-10')!;
    expect(day.dueCount).toBe(2);
    expect(day.doneCount).toBe(1);
    expect(day.state).toBe('partial');
  });

  it('excludes archived habits from the schedule', () => {
    const archived = habit({ createdAt: '2026-11-01T08:00:00.000Z', isArchived: true });
    const year = buildCommitmentYear(sources({ habits: [archived] }), 2026, 'all', TODAY);
    expect(dayAt(year, '2026-11-10')!.dueCount).toBe(0);
  });
});

describe('buildCommitmentYear — scope', () => {
  const mixed = () =>
    sources({
      habits: [habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] })],
      tasks: [task({ scheduledDate: '2026-11-10', status: 'todo' })]
    });

  it('mixes habits and tasks when scope is all', () => {
    const day = dayAt(buildCommitmentYear(mixed(), 2026, 'all', TODAY), '2026-11-10')!;
    expect(day.dueCount).toBe(2);
    expect(day.doneCount).toBe(1);
  });

  it('narrows to habits only', () => {
    const day = dayAt(buildCommitmentYear(mixed(), 2026, 'habits', TODAY), '2026-11-10')!;
    expect(day.dueCount).toBe(1);
    expect(day.state).toBe('kept');
  });

  it('narrows to tasks only', () => {
    const day = dayAt(buildCommitmentYear(mixed(), 2026, 'tasks', TODAY), '2026-11-10')!;
    expect(day.dueCount).toBe(1);
    expect(day.state).toBe('missed');
  });
});

describe('buildCommitmentYear — grid shape', () => {
  it('keeps every column seven rows tall so weekdays stay aligned', () => {
    const year = buildCommitmentYear(sources({ habits: [habit()] }), 2026, 'all', TODAY);
    for (const week of year.weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('pads the first column rather than shifting 1 January to a wrong weekday', () => {
    const year = buildCommitmentYear(sources({ habits: [habit()] }), 2026, 'all', TODAY);
    // 2026-01-01 is a Thursday: Saturday..Wednesday are blank, so it sits at index 5.
    const firstColumn = year.weeks[0];
    expect(firstColumn[5]?.dateKey).toBe('2026-01-01');
    expect(firstColumn[0]).toBeNull();
  });

  it('labels each month at the column where it starts', () => {
    const year = buildCommitmentYear(sources({ habits: [habit()] }), 2026, 'all', TODAY);
    expect(year.months).toHaveLength(12);
    expect(year.months[0].labelEn).toBe('Jan');
    expect(year.months[11].labelEn).toBe('Dec');
    for (const month of year.months) {
      expect(month.column).toBeGreaterThanOrEqual(0);
      expect(month.column).toBeLessThan(year.weeks.length);
    }
  });
});

describe('buildCommitmentYear — summary', () => {
  it('reports a rate only from days that were actually scheduled', () => {
    const h = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    // 1 Nov..11 Nov, all due, one kept.
    expect(year.summary.scheduledDays).toBe(11);
    expect(year.summary.keptDays).toBe(1);
    expect(year.summary.missedDays).toBe(10);
    expect(year.summary.periodRate).toBeCloseTo(1 / 11, 5);
  });

  it('returns a null rate when nothing was ever due', () => {
    const year = buildCommitmentYear(sources(), 2026, 'all', TODAY);
    expect(year.summary.scheduledDays).toBe(0);
    expect(year.summary.periodRate).toBeNull();
    expect(year.summary.noDataDays).toBeGreaterThan(0); // every elapsed day is pre-tracking
    expect(year.summary.headlineEn.length).toBeGreaterThan(0);
  });

  it('does not count a no-data day towards the missed total', () => {
    const h = habit({ createdAt: '2026-11-08T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    expect(year.summary.noDataDays).toBeGreaterThan(300);
    expect(year.summary.missedDays).toBeLessThan(10);
  });

  it('breaks a streak on a missed day but not on a rest day', () => {
    const h = habit({
      createdAt: '2026-11-01T08:00:00.000Z',
      completedDates: ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']
    });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    expect(year.summary.currentStreak).toBe(4);
    expect(year.summary.longestStreak).toBe(4);
  });

  it('records the best day with how much was done', () => {
    const a = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const b = habit({ createdAt: '2026-11-01T08:00:00.000Z', completedDates: ['2026-11-10'] });
    const year = buildCommitmentYear(sources({ habits: [a, b] }), 2026, 'all', TODAY);
    expect(year.summary.bestDay?.dateKey).toBe('2026-11-10');
    expect(year.summary.bestDay?.doneCount).toBe(2);
  });

  it('reports the tracking start so the UI can explain blank days', () => {
    const h = habit({ createdAt: '2026-11-05T08:00:00.000Z' });
    const year = buildCommitmentYear(sources({ habits: [h] }), 2026, 'all', TODAY);
    expect(year.trackingStart).toBe('2026-11-05');
  });
});
