import { describe, it, expect } from 'vitest';
import {
  InsightsInput,
  buildRangeSpec,
  computeInsightsReport,
  pearson,
  strengthLabel,
  MIN_CORRELATION_DAYS
} from '../src/lib/insightsEngine';
import { localDateKey } from '../src/lib/dateKey';
import { startOfWeekKey, endOfWeekKey, weekDayKeys, dayOfWeek } from '../src/lib/week';
import type { Habit, Task, Goal, FocusSession } from '../src/types';

// 2026-11-07 is a Saturday, so 2026-11-13 is the Friday that ends that week.
const WED = '2026-11-11';
const FRI = '2026-11-13';
const SAT = '2026-11-07';

function emptyInput(): InsightsInput {
  return {
    tasks: [],
    habits: [],
    goals: [],
    focusSessions: [],
    healthMetrics: {},
    expenses: [],
    savingsGoals: [],
    journalEntries: []
  };
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Read',
    anchor: 'After coffee',
    timeOfDay: 'morning',
    frequency: 'daily',
    category: 'learning',
    targetPerDay: 1,
    currentStreak: 0,
    longestStreak: 0,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [],
    createdAt: '2026-01-01T08:00:00.000Z',
    ...overrides
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    priority: 2,
    isTopThree: false,
    status: 'todo',
    tags: [],
    subtasks: [],
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
    ...overrides
  };
}

function completedTask(id: string, dayKey: string, overrides: Partial<Task> = {}): Task {
  return task({
    id,
    status: 'completed',
    completedAt: `${dayKey}T10:00:00.000Z`,
    scheduledDate: dayKey,
    ...overrides
  });
}

describe('insightsEngine — ranges respect the Saturday–Friday NUQTA week', () => {
  it('the weekly range runs from Saturday to today, not a rolling 7 days', () => {
    const spec = buildRangeSpec('week', emptyInput(), WED);
    expect(spec.currentKeys[0]).toBe(SAT);
    expect(spec.currentKeys[spec.currentKeys.length - 1]).toBe(WED);
    expect(spec.currentKeys).toHaveLength(5); // Sat..Wed
    expect(dayOfWeek(spec.currentKeys[0])).toBe(6); // Saturday
    expect(spec.startKey).toBe(startOfWeekKey(WED));
    expect(spec.endKey).toBe(WED);
  });

  it('on a Friday the weekly range is the full Sat..Fri week', () => {
    const spec = buildRangeSpec('week', emptyInput(), FRI);
    expect(spec.currentKeys).toHaveLength(7);
    expect(spec.currentKeys).toEqual(weekDayKeys(FRI));
    expect(spec.endKey).toBe(endOfWeekKey(FRI));
  });

  it('on the Saturday the week has started, so the range is a single day', () => {
    const spec = buildRangeSpec('week', emptyInput(), SAT);
    expect(spec.currentKeys).toEqual([SAT]);
  });

  it('the weekly comparison window is the same elapsed days of the previous week', () => {
    const spec = buildRangeSpec('week', emptyInput(), WED);
    expect(spec.previousKeys).toHaveLength(spec.currentKeys.length);
    expect(spec.previousKeys[0]).toBe('2026-10-31'); // the prior Saturday
    expect(dayOfWeek(spec.previousKeys[0])).toBe(6);
    expect(spec.hasComparison).toBe(true);
  });

  it('30d/90d/year ranges are equal-length and compared to the window before', () => {
    for (const [range, len] of [['30d', 30], ['90d', 90], ['year', 365]] as const) {
      const spec = buildRangeSpec(range, emptyInput(), FRI);
      expect(spec.currentKeys).toHaveLength(len);
      expect(spec.previousKeys).toHaveLength(len);
      expect(spec.currentKeys[spec.currentKeys.length - 1]).toBe(FRI);
      expect(spec.previousKeys[spec.previousKeys.length - 1] < spec.currentKeys[0]).toBe(true);
      expect(spec.hasComparison).toBe(true);
    }
  });

  it('the all-time range is bounded by real records and has no comparison', () => {
    const input = emptyInput();
    input.tasks = [completedTask('t1', '2026-09-01'), completedTask('t2', '2026-11-10')];
    const spec = buildRangeSpec('all', input, FRI);
    expect(spec.currentKeys[0]).toBe('2026-09-01');
    expect(spec.currentKeys).toContain('2026-11-10');
    expect(spec.hasComparison).toBe(false);
  });
});

describe('insightsEngine — missing data is never reported as zero', () => {
  it('an empty store reports hasData=false and null rates, not fabricated zeros', () => {
    const r = computeInsightsReport('30d', emptyInput(), false, WED);
    expect(r.isEmptyWindow).toBe(true);
    expect(r.recordedDays).toBe(0);
    expect(r.missingDays).toBe(30);

    expect(r.execution.hasData).toBe(false);
    expect(r.execution.completed.value).toBeNull();
    expect(r.execution.completionRate).toBeNull();

    expect(r.habits.hasData).toBe(false);
    expect(r.habits.adherenceRate).toBeNull();

    expect(r.focus.hasData).toBe(false);
    expect(r.focus.totalMinutes.value).toBeNull();

    expect(r.body.hasData).toBe(false);
    expect(r.body.totalMinutes.value).toBeNull();

    expect(r.learning.hasData).toBe(false);
    expect(r.learning.pagesRead.value).toBeNull();

    expect(r.faith.hasData).toBe(false);
    expect(r.faith.ayahsInRange.value).toBeNull();

    expect(r.finance.hasData).toBe(false);
    expect(r.goals.hasData).toBe(false);
  });

  it('a single recorded day flips hasData and leaves the other days as missing', () => {
    const input = emptyInput();
    input.habits = [
      habit({
        specializedType: 'workout',
        workoutData: {
          sessions: [
            {
              id: 'w1',
              date: WED,
              title: 'Session',
              workoutType: 'bodyweight',
              durationMinutes: 30,
              totalReps: 20,
              volumeKg: 0,
              exercises: [],
              intensityRating: 3
            }
          ],
          weeklyTargetSessions: 4,
          totalVolumeKg: 0,
          totalMinutes: 30,
          totalWorkouts: 1,
          favoriteRoutine: 'Home'
        }
      })
    ];
    const r = computeInsightsReport('30d', input, false, WED);
    expect(r.isEmptyWindow).toBe(false);
    expect(r.recordedDays).toBe(1);
    expect(r.missingDays).toBe(29);
    expect(r.body.hasData).toBe(true);
    expect(r.body.totalMinutes.value).toBe(30);
    expect(r.body.totalMinutes.recordedDays).toBe(1);
    expect(r.body.totalMinutes.missingDays).toBe(29);
    // Domains with no records stay honestly empty.
    expect(r.learning.pagesRead.value).toBeNull();
    expect(r.faith.hasData).toBe(false);
  });
});

describe('insightsEngine — habit adherence is due-day aware', () => {
  it('a weekdays habit is not punished for the Friday day off', () => {
    const input = emptyInput();
    input.habits = [
      habit({
        frequency: 'weekdays',
        // Completed every due day (Sat..Thu) but not Friday.
        completedDates: ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']
      })
    ];
    const r = computeInsightsReport('week', input, false, FRI);
    expect(r.habits.dueDays).toBe(6); // Friday is not due
    expect(r.habits.doneDays).toBe(6);
    expect(r.habits.adherenceRate).toBe(100);
  });

  it('a partially-done weekdays habit scores against the days it was actually due', () => {
    const input = emptyInput();
    input.habits = [habit({ frequency: 'weekdays', completedDates: ['2026-11-07', '2026-11-08', '2026-11-09'] })];
    const r = computeInsightsReport('week', input, false, FRI);
    expect(r.habits.dueDays).toBe(6);
    expect(r.habits.doneDays).toBe(3);
    expect(r.habits.adherenceRate).toBe(50);
    expect(r.habits.missedDueDays).toBe(3);
  });

  it('a daily habit is due every day of the week, including Friday', () => {
    const input = emptyInput();
    input.habits = [habit({ frequency: 'daily', completedDates: ['2026-11-07', '2026-11-08', '2026-11-09'] })];
    const r = computeInsightsReport('week', input, false, FRI);
    expect(r.habits.dueDays).toBe(7);
    expect(r.habits.adherenceRate).toBe(43); // 3/7 rounded
  });

  it('the weekday rhythm is ordered Saturday-first and only includes due days', () => {
    const input = emptyInput();
    input.habits = [habit({ frequency: 'weekdays', completedDates: ['2026-11-07'] })];
    const r = computeInsightsReport('week', input, false, FRI);
    expect(r.habits.weekdayRhythm.map((d) => d.dow)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    const friday = r.habits.weekdayRhythm.find((d) => d.dow === 5)!;
    expect(friday.dueCount).toBe(0);
    expect(friday.rate).toBeNull();
    const saturday = r.habits.weekdayRhythm.find((d) => d.dow === 6)!;
    expect(saturday.rate).toBe(100);
  });
});

describe('insightsEngine — execution trends', () => {
  it('completion rate compares like-for-like windows and reports a delta', () => {
    const input = emptyInput();
    input.tasks = [
      // current week (Sat..Wed): 3 completed of 3 scheduled
      completedTask('c1', '2026-11-07'),
      completedTask('c2', '2026-11-08'),
      completedTask('c3', '2026-11-09'),
      // previous week: 1 completed of 2 scheduled
      completedTask('p1', '2026-10-31'),
      task({ id: 'p2', status: 'todo', scheduledDate: '2026-11-01' })
    ];
    const r = computeInsightsReport('week', input, false, WED);
    expect(r.execution.completed.value).toBe(3);
    expect(r.execution.scheduledTotal).toBe(3);
    expect(r.execution.completionRate).toBe(100);
    expect(r.execution.previousCompletionRate).toBe(50);
    expect(r.execution.delta.current).toBe(3);
    expect(r.execution.delta.previous).toBe(1);
    expect(r.execution.delta.direction).toBe('up');
  });

  it('overdue tasks are counted and aged against today', () => {
    const input = emptyInput();
    input.tasks = [
      task({ id: 'o1', status: 'todo', scheduledDate: '2026-11-10' }), // 1 day overdue
      task({ id: 'o2', status: 'in_progress', scheduledDate: '2026-11-05' }), // 6 days overdue
      task({ id: 'o3', status: 'todo', scheduledDate: '2026-10-20' }), // > 1 week overdue
      task({ id: 'o4', status: 'completed', scheduledDate: '2026-11-01', completedAt: '2026-11-01T10:00:00.000Z' }),
      task({ id: 'o5', status: 'todo', scheduledDate: WED }) // due today, not overdue
    ];
    const r = computeInsightsReport('30d', input, false, WED);
    expect(r.execution.overdueCount).toBe(3);
    expect(r.execution.overdueAging.find((a) => a.labelEn === '1–3 days')!.count).toBe(1);
    expect(r.execution.overdueAging.find((a) => a.labelEn === '4–7 days')!.count).toBe(1);
    expect(r.execution.overdueAging.find((a) => a.labelEn === 'Over a week')!.count).toBe(1);
  });
});

describe('insightsEngine — no double counting across linked records', () => {
  it('a logged workout counts once: as a body session, never also as task progress', () => {
    const input = emptyInput();
    input.habits = [
      habit({
        specializedType: 'workout',
        // The store marks the habit done on the same day it logs the session.
        completedDates: [WED],
        workoutData: {
          sessions: [
            {
              id: 'w1',
              date: WED,
              title: 'Session',
              workoutType: 'bodyweight',
              durationMinutes: 40,
              totalReps: 50,
              volumeKg: 0,
              exercises: [],
              intensityRating: 4
            }
          ],
          weeklyTargetSessions: 4,
          totalVolumeKg: 0,
          totalMinutes: 40,
          totalWorkouts: 1,
          favoriteRoutine: 'Home'
        }
      })
    ];
    const r = computeInsightsReport('week', input, false, WED);
    // Body minutes are the session's minutes, not doubled by the habit check-in.
    expect(r.body.totalMinutes.value).toBe(40);
    expect(r.body.sessionsCount).toBe(1);
    // The habit check-in does not become a completed task. There are no tasks at
    // all in the store, so this is reported as missing (null), never as 0.
    expect(r.execution.hasData).toBe(false);
    expect(r.execution.completed.value).toBeNull();
    expect(r.execution.scheduledTotal).toBe(0);
    // The daily timeline's active minutes reflect the session once.
    const todayPoint = r.timeline[r.timeline.length - 1];
    expect(todayPoint.activeMinutes).toBe(40);
    expect(todayPoint.workoutMinutes).toBe(40);
  });
});

describe('insightsEngine — focus sessions', () => {
  it('aggregates minutes, sessions, interruptions and productivity', () => {
    const input = emptyInput();
    input.focusSessions = [
      { id: 'f1', durationMinutes: 50, targetMinutes: 45, interruptionCount: 2, preMood: 3, postMood: 4, productivityScore: 4, completedAt: `${WED}T09:00:00.000Z` },
      { id: 'f2', durationMinutes: 30, targetMinutes: 25, interruptionCount: 0, preMood: 3, postMood: 3, productivityScore: 5, completedAt: `${WED}T14:00:00.000Z` }
    ] as FocusSession[];
    const r = computeInsightsReport('week', input, false, WED);
    expect(r.focus.sessionsCount).toBe(2);
    expect(r.focus.totalMinutes.value).toBe(80);
    expect(r.focus.avgSessionMinutes).toBe(40);
    expect(r.focus.totalInterruptions).toBe(2);
    expect(r.focus.avgInterruptionRate).toBe(1);
    expect(r.focus.avgProductivityScore).toBe(4.5);
    expect(r.focus.bestDayMinutes).toBe(80);
  });
});

describe('insightsEngine — pearson correlation guards', () => {
  it('returns null below the minimum sample size', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeNull();
    expect(MIN_CORRELATION_DAYS).toBe(5);
  });

  it('returns null when a series has no variance (a flat line is not a 0 correlation)', () => {
    expect(pearson([5, 5, 5, 5, 5], [1, 2, 3, 4, 5])).toBeNull();
  });

  it('returns +1 for a perfectly linear relationship', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBe(1);
  });

  it('labels the strength and direction honestly', () => {
    expect(strengthLabel(0.8, false)).toContain('strong');
    expect(strengthLabel(0.8, false)).toContain('positive');
    expect(strengthLabel(-0.8, false)).toContain('negative');
    expect(strengthLabel(0.05, false)).toContain('negligible');
  });

  it('reports correlations as unavailable when there is not enough paired data', () => {
    const r = computeInsightsReport('30d', emptyInput(), false, WED);
    expect(r.correlations).toHaveLength(2);
    expect(r.correlations.every((c) => !c.available && c.r === null)).toBe(true);
    expect(r.correlations[0].interpretationEn).toMatch(/Not enough data/);
  });

  it('computes sleep-vs-next-day-focus when enough nights are logged', () => {
    const input = emptyInput();
    const keys = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
    // Sleep rises 5..10; the following day's focus also rises -> strong positive.
    keys.forEach((k, i) => {
      input.healthMetrics[k] = {
        date: k,
        sleepHours: 5 + i,
        sleepQuality: 3,
        hydrationMl: 0,
        targetHydrationMl: 2500,
        workoutLogged: false,
        moodRating: 0
      };
    });
    input.focusSessions = keys.slice(1).map((k, i) => ({
      id: `f${i}`,
      durationMinutes: (i + 1) * 10,
      targetMinutes: 25,
      interruptionCount: 0,
      preMood: 3,
      postMood: 3,
      productivityScore: 3,
      completedAt: `${k}T09:00:00.000Z`
    })) as FocusSession[];

    const r = computeInsightsReport('30d', input, false, '2026-11-06');
    const sleep = r.correlations.find((c) => c.id === 'sleep-vs-nextfocus')!;
    expect(sleep.n).toBe(5);
    expect(sleep.r).toBe(1);
    expect(sleep.available).toBe(true);
  });
});

describe('insightsEngine — timeline bucketing', () => {
  it('uses weekday names for a single week, day-of-month for longer daily ranges', () => {
    const week = computeInsightsReport('week', emptyInput(), false, FRI);
    expect(week.timelineGranularity).toBe('day');
    expect(week.timeline[0].label).toBe('Sat');
    expect(week.timeline[6].label).toBe('Fri');

    const month = computeInsightsReport('30d', emptyInput(), false, FRI);
    expect(month.timelineGranularity).toBe('day');
    // 30 daily buckets, labelled by day of month so repeats are unambiguous.
    expect(month.timeline).toHaveLength(30);
    expect(month.timeline[month.timeline.length - 1].label).toBe('13'); // FRI
  });

  it('buckets 90 days by Sat–Fri weeks and a year by month', () => {
    const q = computeInsightsReport('90d', emptyInput(), false, FRI);
    expect(q.timelineGranularity).toBe('week');
    // Each weekly bucket starts on a Saturday.
    expect(q.timeline.every((p) => dayOfWeek(p.key) === 6)).toBe(true);

    const y = computeInsightsReport('year', emptyInput(), false, FRI);
    expect(y.timelineGranularity).toBe('month');
    expect(y.timeline.every((p) => /^\d{4}-\d{2}$/.test(p.key))).toBe(true);
  });
});

describe('insightsEngine — goals, finance and empty-window summary', () => {
  it('surfaces goal pacing and average progress from real key results', () => {
    const input = emptyInput();
    input.goals = [
      {
        id: 'g1',
        title: 'Read 12 books',
        category: 'intellect',
        timeframe: 'annual',
        keyResults: [{ id: 'kr1', title: 'Books', targetValue: 10, currentValue: 4, unit: 'books', dataSource: 'manual' }],
        milestones: [{ id: 'm1', title: 'First 3', isCompleted: true, completedDate: '2026-11-08' }],
        status: 'active',
        createdAt: '2026-01-01T08:00:00.000Z'
      } as Goal
    ];
    const r = computeInsightsReport('week', input, false, WED);
    expect(r.goals.hasData).toBe(true);
    expect(r.goals.activeCount).toBe(1);
    expect(r.goals.avgOutcomePercent).toBe(40); // 4/10
    expect(r.goals.milestonesCompletedInRange).toBe(1);
    expect(r.goals.cards[0].goalId).toBe('g1');
  });

  it('builds a monthly income/expense trend within the window', () => {
    const input = emptyInput();
    input.expenses = [
      { id: 'e1', title: 'Salary', amount: 1000, type: 'income', category: 'savings', date: '2026-11-02' },
      { id: 'e2', title: 'Rent', amount: 400, type: 'expense', category: 'housing', date: '2026-11-03' },
      { id: 'e3', title: 'Food', amount: 100, type: 'expense', category: 'food', date: '2026-11-04' }
    ];
    input.savingsGoals = [{ id: 's1', title: 'Trip', targetAmount: 1000, currentAmount: 250 }];
    const r = computeInsightsReport('30d', input, false, WED);
    expect(r.finance.hasData).toBe(true);
    expect(r.finance.income).toBe(1000);
    expect(r.finance.expense).toBe(500);
    expect(r.finance.net).toBe(500);
    expect(r.finance.savingsPercent).toBe(25);
    expect(r.finance.topCategories[0].category).toBe('housing');
    // The 30-day window spans mid-October into November, so two month buckets exist.
    expect(r.finance.monthlyTrend.map((m) => m.key)).toEqual(['2026-10', '2026-11']);
    const november = r.finance.monthlyTrend.find((m) => m.key === '2026-11')!;
    expect(november.net).toBe(500);
  });
});
