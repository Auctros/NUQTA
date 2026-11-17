import type { Habit } from '../types';
import { localDateKey, parseDateKey, addDaysToKey } from './dateKey';
import { dayOfWeek, isWorkingDay } from './week';
import { isRuleDueOn } from './recurrence';

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

  // A richer rule (weekly/monthly/interval) takes precedence when present.
  if (habit.recurrence) {
    const anchor = habit.createdAt ? localDateKey(new Date(habit.createdAt)) : dateKey;
    return isRuleDueOn(habit.recurrence, anchor, dateKey);
  }

  switch (habit.frequency) {
    case 'weekdays':
      // NUQTA's working week: Saturday..Thursday. Friday is the day off.
      return isWorkingDay(dateKey);
    case 'custom':
      return (habit.customDays || []).includes(dayOfWeek(day));
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

/**
 * Current streak, derived from `completedDates` rather than a running counter, so
 * a missed (due) day correctly breaks the streak instead of letting it grow.
 *
 * The streak ends on the latest completion and counts backwards over consecutive
 * days the habit was due; non-due days (weekends for a weekdays habit, or a
 * frozen day) are skipped without breaking it.
 */
export function computeCurrentStreak(habit: Habit, todayKey: string = localDateKey()): number {
  const completed = new Set(habit.completedDates || []);
  const createdKey = habit.createdAt ? localDateKey(new Date(habit.createdAt)) : undefined;
  let cursor = todayKey;

  // Today not yet done: look back from yesterday so an in-progress day does not
  // reset a streak that is still alive.
  if (!completed.has(cursor)) cursor = addDaysToKey(cursor, -1);

  let streak = 0;
  let guard = 0;
  while (guard < 4000) {
    guard += 1;
    if (createdKey && cursor < createdKey) break; // never look before the habit existed
    if (completed.has(cursor)) {
      streak += 1;
    } else if (isHabitDueOn(habit, cursor)) {
      break; // a due day was missed -> the streak is broken
    }
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}
