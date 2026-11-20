import { describe, it, expect } from 'vitest';
import {
  computeWalkingStats,
  computeWalkStreak,
  currentWeekKeys,
  elapsedMs,
  elapsedSeconds,
  emptyWalkingData,
  formatDuration,
  formatMinutes,
  pauseWalk,
  pausedSeconds,
  resumeWalk,
  startWalk,
  weekSeries
} from '../src/lib/walking';
import { localDateKey } from '../src/lib/dateKey';
import type { WalkingSessionLog } from '../src/types';

const session = (over: Partial<WalkingSessionLog> = {}): WalkingSessionLog => ({
  id: 'wk-test',
  date: '2026-01-10',
  durationSeconds: 1800,
  startedAt: '2026-01-10T08:00:00.000Z',
  endedAt: '2026-01-10T08:30:00.000Z',
  ...over
});

describe('walking timer', () => {
  it('measures elapsed time from the wall clock, not from tick counts', () => {
    const walk = startWalk(1_000_000);
    // Simulate a tab that was throttled for two minutes: only one tick fired.
    expect(elapsedSeconds(walk, 1_000_000 + 120_000)).toBe(120);
  });

  it('excludes paused time from the total and reports it separately', () => {
    const start = 1_000_000;
    let walk = startWalk(start);
    walk = pauseWalk(walk, start + 60_000); // 60s walked
    walk = resumeWalk(walk, start + 300_000); // 240s paused
    const now = start + 360_000; // 60s more walked
    expect(elapsedSeconds(walk, now)).toBe(120);
    expect(pausedSeconds(walk, now)).toBe(240);
  });

  it('keeps accumulated time across several pause/resume cycles', () => {
    const t0 = 0;
    let walk = startWalk(t0);
    walk = pauseWalk(walk, 30_000);
    walk = resumeWalk(walk, 90_000);
    walk = pauseWalk(walk, 100_000);
    walk = resumeWalk(walk, 200_000);
    expect(elapsedMs(walk, 210_000)).toBe(50_000);
  });

  it('treats repeated pause or resume as a no-op', () => {
    const walk = startWalk(0);
    const pausedOnce = pauseWalk(walk, 5_000);
    expect(pauseWalk(pausedOnce, 9_000)).toEqual(pausedOnce);
    const resumed = resumeWalk(pausedOnce, 10_000);
    expect(resumeWalk(resumed, 20_000)).toEqual(resumed);
  });

  it('never returns a negative elapsed time when the clock jumps backwards', () => {
    const walk = startWalk(10_000);
    expect(elapsedMs(walk, 5_000)).toBe(0);
  });

  it('formats durations with and without an hour component', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3849)).toBe('1:04:09');
    expect(formatMinutes(1080, false)).toBe('18m');
    expect(formatMinutes(4320, false)).toBe('1h 12m');
    expect(formatMinutes(1080, true)).toBe('18 د');
  });
});

describe('walking statistics', () => {
  const now = new Date(2026, 0, 10, 12, 0, 0); // Sat 10 Jan 2026, local

  it('starts empty rather than pre-seeded with sample walks', () => {
    const data = emptyWalkingData();
    expect(data.sessions).toEqual([]);
    expect(data.totalWalks).toBe(0);
    expect(data.totalWalkMinutes).toBe(0);
  });

  it('leaves distance and steps null when nothing was ever entered', () => {
    const stats = computeWalkingStats({ ...emptyWalkingData(), sessions: [session()] }, now);
    expect(stats.totalDistanceKm).toBeNull();
    expect(stats.totalSteps).toBeNull();
  });

  it('sums only the manual distance and step entries', () => {
    const stats = computeWalkingStats(
      {
        ...emptyWalkingData(),
        sessions: [
          session({ id: 'a', distanceKm: 2.5, steps: 3200 }),
          session({ id: 'b' }), // no manual metrics
          session({ id: 'c', distanceKm: 1.5 })
        ]
      },
      now
    );
    expect(stats.totalDistanceKm).toBe(4);
    expect(stats.totalSteps).toBe(3200);
    expect(stats.totalWalks).toBe(3);
  });

  it('derives averages and the longest walk from recorded durations', () => {
    const stats = computeWalkingStats(
      {
        ...emptyWalkingData(),
        sessions: [session({ id: 'a', durationSeconds: 600 }), session({ id: 'b', durationSeconds: 1800 })]
      },
      now
    );
    expect(stats.totalSeconds).toBe(2400);
    expect(stats.longestSeconds).toBe(1800);
    expect(stats.averageSeconds).toBe(1200);
  });

  it('reports a null average with no sessions instead of dividing by zero', () => {
    const stats = computeWalkingStats(emptyWalkingData(), now);
    expect(stats.averageSeconds).toBeNull();
    expect(stats.longestSeconds).toBe(0);
  });

  it('counts a streak that includes today', () => {
    const today = localDateKey(now);
    const yesterday = localDateKey(new Date(2026, 0, 9));
    const sessions = [session({ id: 'a', date: today }), session({ id: 'b', date: yesterday })];
    expect(computeWalkStreak(sessions, now)).toBe(2);
  });

  it('keeps a streak alive when today has no walk yet', () => {
    const yesterday = localDateKey(new Date(2026, 0, 9));
    const before = localDateKey(new Date(2026, 0, 8));
    const sessions = [session({ id: 'a', date: yesterday }), session({ id: 'b', date: before })];
    expect(computeWalkStreak(sessions, now)).toBe(2);
  });

  it('breaks the streak when the last walk is older than yesterday', () => {
    const sessions = [session({ id: 'a', date: localDateKey(new Date(2026, 0, 7)) })];
    expect(computeWalkStreak(sessions, now)).toBe(0);
  });

  it('returns zero streak for an empty log', () => {
    expect(computeWalkStreak([], now)).toBe(0);
  });

  it('aggregates the week in Saturday-first order', () => {
    const keys = currentWeekKeys(now);
    expect(keys).toHaveLength(7);
    const data = {
      ...emptyWalkingData(),
      sessions: [session({ id: 'a', date: keys[0], durationSeconds: 1200 }), session({ id: 'b', date: keys[1], durationSeconds: 600 })]
    };
    const series = weekSeries(data, false, now);
    expect(series).toHaveLength(7);
    expect(series[0].value).toBe(20);
    expect(series[1].value).toBe(10);
    expect(series[2].value).toBe(0);
  });

  it('excludes sessions outside the current week from the weekly total', () => {
    const stats = computeWalkingStats(
      {
        ...emptyWalkingData(),
        weeklyTargetMinutes: 120,
        sessions: [session({ id: 'a', date: currentWeekKeys(now)[0] }), session({ id: 'old', date: '2020-01-01' })]
      },
      now
    );
    expect(stats.weekSeconds).toBe(1800);
    expect(stats.totalSeconds).toBe(3600);
    expect(stats.weeklyTargetMinutes).toBe(120);
  });
});
