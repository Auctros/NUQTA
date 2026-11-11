import type { HealthMetric } from '../types';

/**
 * A health record with NOTHING logged yet. 0 means "not logged" for sleep, sleep quality
 * and mood, so no invented number is ever shown as if the user had measured it.
 * (Hydration target is a goal, not a measurement.)
 */
export function emptyHealthRecord(date: string): HealthMetric {
  return {
    date,
    sleepHours: 0,
    sleepQuality: 0,
    hydrationMl: 0,
    targetHydrationMl: 2500,
    workoutLogged: false,
    moodRating: 0
  };
}
