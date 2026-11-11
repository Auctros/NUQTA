import type { Habit } from '../types';
import { localDateKey, parseDateKey } from './dateKey';

/** Is the habit expected on this calendar day (YYYY-MM-DD, local)? */
export function isHabitDueOn(habit: Habit, dateKey: string): boolean {
  const day = parseDateKey(dateKey);
  if (!day) return false;

  // Not due before the habit existed, and not on days covered by a streak freeze.
  if (habit.createdAt) {
    const created = new Date(habit.createdAt);
    if (!isNaN(created.getTime()) && dateKey < localDateKey(created)) return false;
  }
  if ((habit.freezesUsedDates || []).includes(dateKey)) return false;

  const dow = day.getDay(); // 0 = Sunday
  switch (habit.frequency) {
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'custom':
      return (habit.customDays || []).includes(dow);
    case 'daily':
    default:
      return true;
  }
}

/** Compliance over a set of days: only days the habit was actually due count. */
export function habitCompliance(
  habit: Habit,
  dateKeys: string[]
): { due: number; done: number } {
  let due = 0;
  let done = 0;
  const completed = new Set(habit.completedDates || []);
  for (const key of dateKeys) {
    if (isHabitDueOn(habit, key)) {
      due += 1;
      if (completed.has(key)) done += 1;
    } else if (completed.has(key)) {
      // Done on a day it was not required: counts as a bonus, never lowers the rate.
      due += 1;
      done += 1;
    }
  }
  return { due, done };
}
