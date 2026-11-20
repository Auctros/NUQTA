/**
 * Walking Studio — store integration and backup-schema acceptance.
 *
 * These drive the real Zustand store and the real backup validator, so the studio is
 * proven to persist through the same path every other habit uses rather than through a
 * parallel mechanism.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { localDateKey } from '../src/lib/dateKey';
import { parseBackup, buildBackupFile } from '../src/lib/backupSchema';

const S = () => useNuqtaStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  localStorage.clear();
  S().initializeStore();
});
afterEach(() => vi.useRealTimers());

const createWalkingHabit = () => {
  S().createHabit({
    name: 'Daily Walk',
    anchor: 'After lunch -> walk',
    category: 'health',
    timeOfDay: 'afternoon',
    specializedType: 'walking'
  } as any);
  return S().habits.find((h) => h.specializedType === 'walking')!;
};

describe('Walking Studio — store', () => {
  it('initialises a walking habit with empty data and no fabricated history', () => {
    const habit = createWalkingHabit();
    expect(habit.walkingData).toBeDefined();
    expect(habit.walkingData!.sessions).toEqual([]);
    expect(habit.walkingData!.totalWalks).toBe(0);
    expect(habit.walkingData!.totalWalkMinutes).toBe(0);
    // No sample distance or steps invented at creation time.
    expect(habit.walkingData!.totalDistanceKm).toBeUndefined();
    expect(habit.walkingData!.totalSteps).toBeUndefined();
  });

  it('logs a walk, updates totals, and completes the habit for today', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 1500,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:25:00.000Z'
    });

    const after = S().habits.find((h) => h.id === habit.id)!;
    expect(after.walkingData!.sessions).toHaveLength(1);
    expect(after.walkingData!.totalWalks).toBe(1);
    expect(after.walkingData!.totalWalkMinutes).toBe(25);
    expect(after.completedDates).toContain(localDateKey());
    expect(after.currentStreak).toBe(1);
  });

  it('refuses a zero-duration walk instead of storing an empty record', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 0,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:00:00.000Z'
    });
    expect(S().habits.find((h) => h.id === habit.id)!.walkingData!.sessions).toHaveLength(0);
  });

  it('keeps manual distance and steps, and leaves them absent when not supplied', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 600,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:10:00.000Z'
    });
    expect(S().habits.find((h) => h.id === habit.id)!.walkingData!.totalDistanceKm).toBeUndefined();

    S().logWalkingSession(habit.id, {
      durationSeconds: 900,
      distanceKm: 1.8,
      steps: 2400,
      startedAt: '2026-11-11T13:00:00.000Z',
      endedAt: '2026-11-11T13:15:00.000Z'
    });
    const d = S().habits.find((h) => h.id === habit.id)!.walkingData!;
    expect(d.totalDistanceKm).toBe(1.8);
    expect(d.totalSteps).toBe(2400);
  });

  it('re-derives totals when a walk is deleted, so no phantom distance survives', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 600,
      distanceKm: 2,
      steps: 3000,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:10:00.000Z'
    });
    S().logWalkingSession(habit.id, {
      durationSeconds: 1200,
      startedAt: '2026-11-11T14:00:00.000Z',
      endedAt: '2026-11-11T14:20:00.000Z'
    });

    const d0 = S().habits.find((h) => h.id === habit.id)!.walkingData!;
    const manualWalk = d0.sessions.find((s) => s.distanceKm === 2)!;
    S().deleteWalkingSession(habit.id, manualWalk.id);

    const d = S().habits.find((h) => h.id === habit.id)!.walkingData!;
    expect(d.sessions).toHaveLength(1);
    expect(d.totalWalks).toBe(1);
    expect(d.totalWalkMinutes).toBe(20);
    // The surviving walk had no manual metrics, so these must vanish rather than persist.
    expect(d.totalDistanceKm).toBeUndefined();
    expect(d.totalSteps).toBeUndefined();
  });

  it('updates the weekly target without touching logged sessions', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 600,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:10:00.000Z'
    });
    S().updateWalkingTargets(habit.id, { weeklyTargetMinutes: 210 });

    const d = S().habits.find((h) => h.id === habit.id)!.walkingData!;
    expect(d.weeklyTargetMinutes).toBe(210);
    expect(d.sessions).toHaveLength(1);
  });

  it('survives a storage round-trip through the habit store', () => {
    const habit = createWalkingHabit();
    S().logWalkingSession(habit.id, {
      durationSeconds: 900,
      distanceKm: 1.2,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:15:00.000Z'
    });

    const persisted = JSON.parse(localStorage.getItem('nuqta_habits_v1') || '[]');
    const stored = persisted.find((h: any) => h.id === habit.id);
    expect(stored.walkingData.sessions).toHaveLength(1);
    expect(stored.walkingData.sessions[0].distanceKm).toBe(1.2);
  });
});

describe('Walking Studio — backup schema', () => {
  const baseHabit = (walkingData: any) => ({
    id: 'h-walk',
    name: 'Walk',
    anchor: '',
    timeOfDay: 'afternoon',
    frequency: 'daily',
    category: 'health',
    targetPerDay: 1,
    currentStreak: 0,
    longestStreak: 0,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    specializedType: 'walking',
    walkingData
  });

  const parse = (habits: any[]) =>
    parseBackup(
      JSON.stringify(
        buildBackupFile({
          tasks: [],
          habits,
          goals: [],
          focusSessions: [],
          healthMetrics: {},
          expenses: [],
          savingsGoals: [],
          journalEntries: []
        } as any)
      )
    );

  it('accepts a walking habit with valid session data', () => {
    const result = parse([
      baseHabit({
        sessions: [
          {
            id: 'wk-1',
            date: '2026-01-01',
            durationSeconds: 1200,
            startedAt: '2026-01-01T08:00:00.000Z',
            endedAt: '2026-01-01T08:20:00.000Z',
            distanceKm: 1.5,
            steps: 2000
          }
        ],
        weeklyTargetMinutes: 150,
        totalWalkMinutes: 20,
        totalWalks: 1
      })
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts a walking habit with no sessions yet', () => {
    const result = parse([baseHabit({ sessions: [], totalWalks: 0, totalWalkMinutes: 0 })]);
    expect(result.ok).toBe(true);
  });

  it('rejects a session with a non-numeric duration', () => {
    const result = parse([
      baseHabit({
        sessions: [
          {
            id: 'wk-1',
            date: '2026-01-01',
            durationSeconds: 'twenty',
            startedAt: '2026-01-01T08:00:00.000Z',
            endedAt: '2026-01-01T08:20:00.000Z'
          }
        ]
      })
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects a session missing its required start timestamp', () => {
    const result = parse([
      baseHabit({
        sessions: [{ id: 'wk-1', date: '2026-01-01', durationSeconds: 600, endedAt: '2026-01-01T08:20:00.000Z' }]
      })
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('Walking Studio — universal history', () => {
  it('publishes each saved walk into the shared archive timeline', async () => {
    const { generateUniversalHistory } = await import('../src/lib/universalHistoryEngine');

    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);
    const habit = S().habits.find((h) => h.specializedType === 'walking')!;

    S().logWalkingSession(habit.id, {
      durationSeconds: 1800,
      distanceKm: 2.4,
      steps: 3100,
      notes: 'نهر النيل',
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T12:30:00.000Z'
    });

    const events = generateUniversalHistory({
      tasks: S().tasks,
      habits: S().habits,
      goals: S().goals,
      focusSessions: [],
      journalEntries: [],
      expenses: [],
      sundayReviews: [],
      historyAuditLogs: []
    });
    const walk = events.find((e) => e.domain === 'walking');

    expect(walk).toBeDefined();
    expect(walk!.entityType).toBe('walk_session');
    expect(walk!.date).toBe(localDateKey());
    expect(walk!.description).toBe('نهر النيل');
    // Only the metrics the user typed appear in the summary.
    expect(walk!.metricsSummary).toContain('30 دقيقة');
    expect(walk!.metricsSummary).toContain('2.4 كم');
    expect(walk!.metricsSummary).toContain('3100 خطوة');
  });
});
