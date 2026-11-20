/**
 * Walking Studio — pure session and statistics helpers.
 *
 * Two honesty rules drive this module:
 *   1. Elapsed time is measured from wall-clock timestamps, never by counting ticks.
 *      A backgrounded tab throttles `setInterval`, so tick-counting silently loses
 *      time; `elapsedSeconds` recomputes from `startedAt`/`pausedAt` instead.
 *   2. Distance and steps are only ever what the user typed. NUQTA has no GPS,
 *      pedometer or health-sensor access, so nothing here estimates them from
 *      duration, pace or body weight.
 */
import { localDateKey } from './dateKey';
import { weekDayKeys, startOfWeekKey } from './week';
import type { WalkingHabitData, WalkingSessionLog } from '../types';

/** The live session, persisted so a reload or a route change cannot lose it. */
export interface ActiveWalk {
  startedAt: number; // epoch ms
  /** Epoch ms when the walk was paused, or null while running. */
  pausedAt: number | null;
  /** Milliseconds already accumulated across previous run segments. */
  accumulatedMs: number;
  /** Milliseconds already spent paused across previous pause spans. */
  pausedAccumulatedMs: number;
}

export const emptyWalkingData = (): WalkingHabitData => ({
  sessions: [],
  weeklyTargetMinutes: 150,
  totalWalkMinutes: 0,
  totalWalkSeconds: 0,
  totalWalks: 0
});

/**
 * Elapsed milliseconds of walking, excluding paused spans.
 * Pure: the caller supplies "now" so the value is testable and never drifts.
 */
export function elapsedMs(walk: ActiveWalk, now: number): number {
  const running = walk.pausedAt === null ? Math.max(0, now - walk.startedAt) : Math.max(0, walk.pausedAt - walk.startedAt);
  return Math.max(0, walk.accumulatedMs + running);
}

export function elapsedSeconds(walk: ActiveWalk, now: number): number {
  return Math.floor(elapsedMs(walk, now) / 1000);
}

export function startWalk(now: number): ActiveWalk {
  return { startedAt: now, pausedAt: null, accumulatedMs: 0, pausedAccumulatedMs: 0 };
}

/** Freeze the running segment into `accumulatedMs`. Idempotent while already paused. */
export function pauseWalk(walk: ActiveWalk, now: number): ActiveWalk {
  if (walk.pausedAt !== null) return walk;
  return { ...walk, pausedAt: now, accumulatedMs: elapsedMs(walk, now) };
}

/**
 * Resume by restarting the segment clock from `now`. The span that just ended is
 * folded into `pausedAccumulatedMs`, so repeated pauses stay accounted for instead of
 * only the most recent one.
 */
export function resumeWalk(walk: ActiveWalk, now: number): ActiveWalk {
  if (walk.pausedAt === null) return walk;
  const thisSpan = Math.max(0, now - walk.pausedAt);
  return {
    startedAt: now,
    pausedAt: null,
    accumulatedMs: walk.accumulatedMs,
    pausedAccumulatedMs: (walk.pausedAccumulatedMs ?? 0) + thisSpan
  };
}

/** Seconds spent paused across the whole session, for the history detail line. */
export function pausedSeconds(walk: ActiveWalk, now: number): number {
  const closed = walk.pausedAccumulatedMs ?? 0;
  const open = walk.pausedAt === null ? 0 : Math.max(0, now - walk.pausedAt);
  return Math.floor((closed + open) / 1000);
}

/** `1:04:09` / `4:09` — the timer face. Always hours-free below an hour. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** `18m` / `1h 12m` — compact human summary for lists and stats. */
export function formatMinutes(totalSeconds: number, isAr: boolean): string {
  const mins = Math.round(Math.max(0, totalSeconds) / 60);
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return isAr ? `${h} س` : `${h}h`;
  return isAr ? `${h} س ${m} د` : `${h}h ${m}m`;
}

export interface WalkingStats {
  totalWalks: number;
  totalSeconds: number;
  /** Null when no session ever recorded a manual distance. */
  totalDistanceKm: number | null;
  /** Null when no session ever recorded manual steps. */
  totalSteps: number | null;
  longestSeconds: number;
  averageSeconds: number | null;
  weekSeconds: number;
  weekWalks: number;
  weeklyTargetMinutes: number;
  streakDays: number;
}

/** Saturday-first week keys, matching NUQTA's week (see lib/week.ts). */
export function currentWeekKeys(now: Date = new Date()): string[] {
  return weekDayKeys(startOfWeekKey(localDateKey(now)));
}

/**
 * Aggregate the stored history. Everything is derived from the recorded sessions —
 * a metric with no record stays `null` so the view can say "not recorded" instead of
 * printing a fabricated zero.
 */
export function computeWalkingStats(data: WalkingHabitData | undefined, now: Date = new Date()): WalkingStats {
  const sessions = data?.sessions ?? [];
  const weekKeys = new Set(currentWeekKeys(now));

  const totalSeconds = sessions.reduce((acc, s) => acc + Math.max(0, s.durationSeconds || 0), 0);
  const weekSessions = sessions.filter((s) => weekKeys.has(s.date));
  const weekSeconds = weekSessions.reduce((acc, s) => acc + Math.max(0, s.durationSeconds || 0), 0);

  const distanceEntries = sessions.filter((s) => typeof s.distanceKm === 'number' && s.distanceKm > 0);
  const stepEntries = sessions.filter((s) => typeof s.steps === 'number' && s.steps > 0);

  const longestSeconds = sessions.reduce((acc, s) => Math.max(acc, Math.max(0, s.durationSeconds || 0)), 0);

  return {
    totalWalks: sessions.length,
    totalSeconds,
    totalDistanceKm: distanceEntries.length
      ? distanceEntries.reduce((acc, s) => acc + (s.distanceKm as number), 0)
      : null,
    totalSteps: stepEntries.length ? stepEntries.reduce((acc, s) => acc + (s.steps as number), 0) : null,
    longestSeconds,
    averageSeconds: sessions.length ? Math.round(totalSeconds / sessions.length) : null,
    weekSeconds,
    weekWalks: weekSessions.length,
    weeklyTargetMinutes: data?.weeklyTargetMinutes ?? 150,
    streakDays: computeWalkStreak(sessions, now)
  };
}

/**
 * Consecutive days ending today (or yesterday, so an unfinished today does not break a
 * live streak) that carry at least one walk.
 */
export function computeWalkStreak(sessions: WalkingSessionLog[], now: Date = new Date()): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => s.date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Per-weekday totals for the current NUQTA week, in Saturday-first order. */
export function weekSeries(data: WalkingHabitData | undefined, isAr: boolean, now: Date = new Date()) {
  const sessions = data?.sessions ?? [];
  return currentWeekKeys(now).map((key) => {
    const seconds = sessions
      .filter((s) => s.date === key)
      .reduce((acc, s) => acc + Math.max(0, s.durationSeconds || 0), 0);
    const [, month, day] = key.split('-');
    return { label: isAr ? `${day}/${month}` : `${day}/${month}`, value: Math.round(seconds / 60), seconds };
  });
}
