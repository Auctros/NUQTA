import { describe, it, expect } from 'vitest';
import {
  buildActivityAllocation,
  buildConsistencyBreakdown,
  buildDomainAnalytics,
  buildLifeConnections,
  buildLifeDomains,
  buildMilestoneTimeline,
  buildPerformanceTrend,
  buildSecondaryAnalytics,
  computeDashboardKPIs,
  DashboardAnalyticsInput
} from '../src/lib/dashboardAnalytics';
import { emptyHealthRecord } from '../src/lib/healthDefaults';

function makeEmptyInput(): DashboardAnalyticsInput {
  return {
    tasks: [],
    habits: [],
    goals: [],
    focusSessions: [],
    healthMetrics: {},
    expenses: [],
    savingsGoals: [],
    journalEntries: [],
    energyScore: 65
  };
}

describe('dashboardAnalytics', () => {
  it('reports honest empty states with no invented numbers on a blank store', () => {
    const kpis = computeDashboardKPIs(makeEmptyInput(), '2026-11-13');
    expect(kpis.performance.hasData).toBe(false);
    expect(kpis.performance.rate7d).toBeNull();
    expect(kpis.consistency.hasData).toBe(false);
    expect(kpis.consistency.rate7d).toBeNull();
    expect(kpis.goalProgress.hasData).toBe(false);
    expect(kpis.goalProgress.avgOutcomePercent).toBeNull();
    expect(kpis.momentum.hasData).toBe(false);
    expect(kpis.momentum.minutes7d).toBe(0);

    const trend = buildPerformanceTrend(makeEmptyInput(), 'activeMinutes', '7d', false, '2026-11-13');
    expect(trend.hasAnyData).toBe(false);
    expect(trend.points).toHaveLength(7);
    expect(trend.todayIndex).toBe(6);
    expect(trend.targetValue).toBeNull();

    const secondary = buildSecondaryAnalytics(makeEmptyInput(), '2026-11-13');
    expect(secondary.hasData).toBe(false);
    expect(secondary.weeks).toHaveLength(14);

    const domains = buildLifeDomains(makeEmptyInput(), '2026-11-13');
    expect(domains).toHaveLength(6);
    expect(domains.every((d) => !d.hasData)).toBe(true);

    const connections = buildLifeConnections(makeEmptyInput());
    expect(connections.hasConnections).toBe(false);
  });

  it('keeps tasks, habits, and goals separate and surfaces real targets and period comparisons', () => {
    const input = makeEmptyInput();
    input.tasks = [
      {
        id: 't1',
        title: 'Task A',
        priority: 1,
        isTopThree: true,
        status: 'completed',
        scheduledDate: '2026-11-13',
        tags: [],
        subtasks: [],
        linkedGoalId: 'g1',
        completedAt: '2026-11-13T10:00:00.000Z',
        createdAt: '2026-11-13T08:00:00.000Z',
        updatedAt: '2026-11-13T10:00:00.000Z'
      }
    ];
    input.habits = [
      {
        id: 'h-read',
        name: 'Reading',
        anchor: 'Morning',
        timeOfDay: 'morning',
        frequency: 'daily',
        category: 'learning',
        targetPerDay: 1,
        currentStreak: 2,
        longestStreak: 2,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: ['2026-11-13'],
        linkedGoalId: 'g1',
        createdAt: '2026-11-10T08:00:00.000Z',
        specializedType: 'reading',
        readingData: {
          books: [],
          sessions: [
            {
              id: 'rs1',
              date: '2026-11-13',
              bookId: 'b1',
              bookTitle: 'Deep Work',
              pagesRead: 24,
              durationMinutes: 35,
              speedPagesPerHour: 41
            }
          ],
          dailyTargetPages: 20,
          annualTargetBooks: 12,
          totalPagesRead: 24,
          totalReadingMinutes: 35
        }
      }
    ];
    input.goals = [
      {
        id: 'g1',
        title: 'Read 12 Books',
        category: 'intellect',
        timeframe: 'annual',
        keyResults: [
          { id: 'kr1', title: 'Books', targetValue: 10, currentValue: 2, unit: 'books', dataSource: 'manual' }
        ],
        milestones: [
          { id: 'm1', title: 'First 3 books', isCompleted: false, targetDate: '2026-12-01' }
        ],
        status: 'active',
        createdAt: '2026-11-01T08:00:00.000Z'
      }
    ];
    input.healthMetrics['2026-11-13'] = {
      ...emptyHealthRecord('2026-11-13'),
      sleepHours: 7.5
    };

    const kpis = computeDashboardKPIs(input, '2026-11-13');
    expect(kpis.performance.todayDone).toBe(1);
    expect(kpis.performance.rate7d).toBe(100);
    expect(kpis.goalProgress.avgOutcomePercent).toBe(20); // distinct from task 100%!
    expect(kpis.momentum.todayActiveMinutes).toBe(35);
    expect(kpis.momentum.energyLoggedToday).toBe(true);

    const readingTrend = buildPerformanceTrend(input, 'readingPages', '7d', false, '2026-11-13');
    expect(readingTrend.hasAnyData).toBe(true);
    expect(readingTrend.targetValue).toBe(20);
    expect(readingTrend.currentTotalOrAvg).toBe(24);

    const taskTrend90 = buildPerformanceTrend(input, 'tasksCompleted', '90d', false, '2026-11-13');
    expect(taskTrend90.points).toHaveLength(13);
    expect(taskTrend90.targetValue).toBeNull();

    const yearTrend = buildPerformanceTrend(input, 'activeMinutes', 'year', false, '2026-11-13');
    expect(yearTrend.points).toHaveLength(12);

    const connections = buildLifeConnections(input);
    expect(connections.hasConnections).toBe(true);
    expect(connections.connectedGoalsCount).toBe(1);
    expect(connections.groups[0].linkedHabitNames).toContain('Reading');
  });

  it('never converts missing dates to zero while preserving genuine zeros', () => {
    const input = makeEmptyInput();
    // 2026-11-11: scheduled task that was NOT completed -> genuine 0 tasksCompleted
    // 2026-11-12: completely unrecorded day -> null (missing)
    // 2026-11-13: 2 tasks scheduled, 1 completed -> value 1
    input.tasks = [
      {
        id: 't-missed',
        title: 'Missed Scheduled Task',
        priority: 2,
        isTopThree: false,
        status: 'todo',
        scheduledDate: '2026-11-11',
        tags: [],
        subtasks: [],
        createdAt: '2026-11-11T08:00:00.000Z',
        updatedAt: '2026-11-11T08:00:00.000Z'
      },
      {
        id: 't-open-today',
        title: 'Open Today',
        priority: 1,
        isTopThree: false,
        status: 'todo',
        scheduledDate: '2026-11-13',
        tags: [],
        subtasks: [],
        createdAt: '2026-11-13T08:00:00.000Z',
        updatedAt: '2026-11-13T08:00:00.000Z'
      },
      {
        id: 't-done-today',
        title: 'Done Today',
        priority: 1,
        isTopThree: false,
        status: 'completed',
        scheduledDate: '2026-11-13',
        completedAt: '2026-11-13T12:00:00.000Z',
        tags: [],
        subtasks: [],
        createdAt: '2026-11-13T08:00:00.000Z',
        updatedAt: '2026-11-13T12:00:00.000Z'
      }
    ];

    const taskTrend = buildPerformanceTrend(input, 'tasksCompleted', '7d', false, '2026-11-13');
    expect(taskTrend.hasAnyData).toBe(true);
    expect(taskTrend.recordedBucketsCount).toBe(2);
    expect(taskTrend.missingBucketsCount).toBe(5);
    expect(taskTrend.currentTotalOrAvg).toBe(1);
    expect(taskTrend.previousTotalOrAvg).toBeNull();

    const byKey = new Map(taskTrend.points.map((p) => [p.key, p]));
    expect(byKey.get('2026-11-10')?.currentValue).toBeNull();
    expect(byKey.get('2026-11-11')?.currentValue).toBe(0); // genuine 0 (1 scheduled, 0 done)
    expect(byKey.get('2026-11-11')?.breakdownEn).toBe('0/1 scheduled');
    expect(byKey.get('2026-11-12')?.currentValue).toBeNull(); // missing, NOT 0
    expect(byKey.get('2026-11-13')?.currentValue).toBe(1);

    // No focus sessions at all -> total must be null, never 0
    const focusTrend = buildPerformanceTrend(input, 'focusMinutes', '7d', false, '2026-11-13');
    expect(focusTrend.hasAnyData).toBe(false);
    expect(focusTrend.currentTotalOrAvg).toBeNull();
  });

  it('attributes the 191-minute day strictly to stored studio sessions and leaves prior unrecorded days null', () => {
    const today = '2026-11-13';
    const input = makeEmptyInput();
    input.habits = [
      {
        id: 'h-read',
        name: 'Reading',
        anchor: 'Morning',
        timeOfDay: 'morning',
        frequency: 'daily',
        category: 'learning',
        targetPerDay: 1,
        currentStreak: 0,
        longestStreak: 0,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: [],
        createdAt: `${today}T08:00:00.000Z`,
        specializedType: 'reading',
        readingData: {
          books: [],
          sessions: [
            { id: 'rs1', date: today, bookId: 'b1', bookTitle: 'Book', pagesRead: 14, durationMinutes: 28, speedPagesPerHour: 30 }
          ],
          annualTargetBooks: 12,
          totalPagesRead: 14,
          totalReadingMinutes: 28
        }
      },
      {
        id: 'h-work',
        name: 'Workout',
        anchor: 'Evening',
        timeOfDay: 'evening',
        frequency: 'daily',
        category: 'health',
        targetPerDay: 1,
        currentStreak: 0,
        longestStreak: 0,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: [],
        createdAt: `${today}T08:00:00.000Z`,
        specializedType: 'workout',
        workoutData: {
          sessions: [
            {
              id: 'ws1',
              date: today,
              title: 'Core',
              workoutType: 'strength',
              durationMinutes: 28,
              totalReps: 40,
              volumeKg: 0,
              exercises: [],
              intensityRating: 3
            }
          ],
          weeklyTargetSessions: 4,
          totalReps: 40,
          totalVolumeKg: 0,
          totalMinutes: 28,
          totalWorkouts: 1,
          favoriteRoutine: 'Core'
        }
      },
      {
        id: 'h-art',
        name: 'Drawing',
        anchor: 'Afternoon',
        timeOfDay: 'afternoon',
        frequency: 'daily',
        category: 'mind',
        targetPerDay: 1,
        currentStreak: 0,
        longestStreak: 0,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: [],
        createdAt: `${today}T08:00:00.000Z`,
        specializedType: 'drawing',
        drawingData: {
          pieces: [
            { id: 'a1', title: 'Sketch', medium: 'sketch', durationMinutes: 30, completedDate: today },
            { id: 'a2', title: 'Portrait', medium: 'digital', durationMinutes: 60, completedDate: today }
          ],
          weeklyTargetHours: 4,
          totalDrawingMinutes: 90,
          totalSketches: 2,
          favoriteMedium: 'sketch'
        }
      },
      {
        id: 'h-quran',
        name: 'Quran',
        anchor: 'Fajr',
        timeOfDay: 'morning',
        frequency: 'daily',
        category: 'mind',
        targetPerDay: 1,
        currentStreak: 0,
        longestStreak: 0,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: [],
        createdAt: `${today}T08:00:00.000Z`,
        specializedType: 'quran',
        quranData: {
          dailyTargetAyahs: 20,
          surahs: [],
          sessions: [
            {
              id: 'qs1',
              date: today,
              type: 'new_memorization',
              surahNumber: 18,
              surahName: 'Al-Kahf',
              ayahStart: 1,
              ayahEnd: 10,
              ayahCount: 10,
              durationMinutes: 30,
              quality: 'excellent'
            },
            {
              id: 'qs2',
              date: today,
              type: 'revision',
              surahNumber: 67,
              surahName: 'Al-Mulk',
              ayahStart: 1,
              ayahEnd: 30,
              ayahCount: 30,
              durationMinutes: 15,
              quality: 'very_good'
            }
          ],
          totalAyahsMemorized: 40,
          totalSurahsCompleted: 0,
          totalMemorizationMinutes: 30,
          totalRevisionMinutes: 15,
          activeSurahNumber: 18,
          revisionSchedule: {
            revisionCycleDays: 7,
            currentReviewSurahs: [67],
            targetDailyAyahs: 20,
            weeklyTargetRevisionMinutes: 120
          }
        }
      }
    ];

    const trend30 = buildPerformanceTrend(input, 'activeMinutes', '30d', false, today);
    expect(trend30.recordedBucketsCount).toBe(1);
    expect(trend30.missingBucketsCount).toBe(29);
    expect(trend30.currentTotalOrAvg).toBe(191);
    expect(trend30.points.slice(0, 29).every((p) => p.currentValue === null)).toBe(true);
    const todayPt = trend30.points[29];
    expect(todayPt.currentValue).toBe(191);
    expect(todayPt.breakdownEn).toBe('Reading 28m · Workout 28m · Art 90m · Quran 45m');
  });

  it('distinguishes completed, missed scheduled, rest, and missing days on the consistency heatmap using habit schedules', () => {
    const input = makeEmptyInput();
    // 2026-11-13 is a Friday; 2026-11-02 is Monday (createdAt).
    // Weekday habit is due Mon-Fri, NOT Sat (2026-11-07) / Sun (2026-11-08).
    input.habits = [
      {
        id: 'h-weekdays',
        name: 'Deep Work Block',
        anchor: 'Morning',
        timeOfDay: 'morning',
        frequency: 'weekdays',
        category: 'productivity',
        targetPerDay: 1,
        currentStreak: 1,
        longestStreak: 1,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: ['2026-11-09', '2026-11-13'], // Mon & Fri completed; Tue-Thu missed
        createdAt: '2026-11-02T08:00:00.000Z'
      }
    ];

    const sec = buildSecondaryAnalytics(input, '2026-11-13');
    expect(sec.hasScheduleOrHistory).toBe(true);
    const cellMap = new Map(sec.weeks.flat().map((c) => [c.dateKey, c]));

    expect(cellMap.get('2026-10-25')?.state).toBe('missing'); // before createdAt
    expect(cellMap.get('2026-11-07')?.state).toBe('rest');    // Saturday (not due on weekdays schedule)
    expect(cellMap.get('2026-11-08')?.state).toBe('rest');    // Sunday (not due on weekdays schedule)
    expect(cellMap.get('2026-11-09')?.state).toBe('completed');
    expect(cellMap.get('2026-11-10')?.state).toBe('missed');  // Tuesday due & uncompleted
    expect(cellMap.get('2026-11-13')?.state).toBe('completed');
    expect(cellMap.get('2026-11-14')?.state).toBe('future');  // after todayKey
  });

  it('computes V2 rollingAvg, event annotations, activity allocation, scatter correlation, domain analytics, and milestone timeline', () => {
    const input = makeEmptyInput();
    input.focusSessions = [
      { id: 'f1', taskTitle: 'Arch', durationMinutes: 30, targetMinutes: 30, interruptionCount: 0, preMood: 4, postMood: 5, productivityScore: 5, completedAt: '2026-11-10T10:00:00.000Z' },
      { id: 'f2', taskTitle: 'Design', durationMinutes: 45, targetMinutes: 45, interruptionCount: 1, preMood: 4, postMood: 4, productivityScore: 4, completedAt: '2026-11-11T10:00:00.000Z' },
      { id: 'f3', taskTitle: 'Build', durationMinutes: 60, targetMinutes: 60, interruptionCount: 0, preMood: 4, postMood: 5, productivityScore: 5, completedAt: '2026-11-12T10:00:00.000Z' },
      { id: 'f4', taskTitle: 'Ship', durationMinutes: 90, targetMinutes: 90, interruptionCount: 0, preMood: 5, postMood: 5, productivityScore: 5, completedAt: '2026-11-13T10:00:00.000Z' }
    ];
    input.habits = [
      {
        id: 'h-daily',
        name: 'Morning Focus',
        anchor: 'Coffee',
        timeOfDay: 'morning',
        frequency: 'daily',
        category: 'productivity',
        targetPerDay: 1,
        currentStreak: 4,
        longestStreak: 4,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: ['2026-11-11', '2026-11-12', '2026-11-13'],
        createdAt: '2026-11-01T08:00:00.000Z'
      }
    ];
    input.goals = [
      {
        id: 'g1',
        title: 'Launch V2',
        category: 'career',
        timeframe: 'quarterly',
        keyResults: [{ id: 'kr1', title: 'Release', targetValue: 10, currentValue: 6, unit: 'items', dataSource: 'manual' }],
        milestones: [
          { id: 'm1', title: 'Alpha Done', isCompleted: true, completedDate: '2026-11-12', targetDate: '2026-11-12' },
          { id: 'm2', title: 'Beta Review', isCompleted: false, targetDate: '2026-11-10' },
          { id: 'm3', title: 'Public Launch', isCompleted: false, targetDate: '2026-11-20' }
        ],
        status: 'active',
        createdAt: '2026-11-01T08:00:00.000Z'
      }
    ];
    input.expenses = [
      { id: 'e1', title: 'Client', amount: 3000, category: 'savings', type: 'income', date: '2026-11-05' },
      { id: 'e2', title: 'Rent', amount: 1000, category: 'housing', type: 'expense', date: '2026-11-06' }
    ];
    input.savingsGoals = [{ id: 's1', title: 'Reserve', currentAmount: 500, targetAmount: 1000 }];

    const kpis = computeDashboardKPIs(input, '2026-11-13');
    expect(kpis.momentum.spark7d).toHaveLength(7);
    expect(kpis.momentum.spark7d.slice(-4)).toEqual([30, 45, 60, 90]);

    const trend = buildPerformanceTrend(input, 'focusMinutes', '7d', false, '2026-11-13');
    const byKey = new Map(trend.points.map((p) => [p.key, p]));
    expect(byKey.get('2026-11-12')?.annotation?.kind).toBe('milestone');
    expect(byKey.get('2026-11-13')?.annotation?.kind).toBe('peak');
    expect(byKey.get('2026-11-13')?.rollingAvg).toBe(65); // mean(45, 60, 90)
    expect(byKey.get('2026-11-09')?.rollingAvg).toBeNull();

    const alloc = buildActivityAllocation(input, '2026-11-13');
    expect(alloc.todayTotalMinutes).toBe(90);
    expect(alloc.period7d.totalMinutes).toBe(225);
    expect(alloc.period7d.activeDaysCount).toBe(4);
    expect(alloc.period7d.dailyAvgMinutes).toBe(56);
    expect(alloc.period7d.slices[0].id).toBe('focus');
    expect(alloc.period7d.slices[0].sharePercent).toBe(100);

    const breakdown = buildConsistencyBreakdown(input, '2026-11-13');
    expect(breakdown.weekdays).toHaveLength(7);
    expect(breakdown.dailyScatter).toHaveLength(4);
    expect(breakdown.pearsonR).not.toBeNull();
    expect(breakdown.pearsonR!).toBeGreaterThan(0);
    expect(breakdown.focusScatter).toHaveLength(4);

    const domains = buildDomainAnalytics(input, false, '2026-11-13');
    expect(domains.finance.hasData).toBe(true);
    expect(domains.finance.income30d).toBe(3000);
    expect(domains.finance.expense30d).toBe(1000);
    expect(domains.finance.net30d).toBe(2000);
    expect(domains.personal.hasData).toBe(true);

    const timeline = buildMilestoneTimeline(input, '2026-11-13');
    expect(timeline.map((m) => m.status)).toEqual(['overdue', 'completed', 'upcoming']);
  });
});

