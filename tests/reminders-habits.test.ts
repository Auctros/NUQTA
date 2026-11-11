import { describe, it, expect } from 'vitest';
import { isReminderDue, minutesOfDay } from '../src/lib/reminderTiming';
import { isHabitDueOn, habitCompliance } from '../src/lib/habitSchedule';
import type { Habit } from '../src/types';

describe('reminder timing', () => {
  it('fires at the scheduled minute and during the catch-up window, not before or long after', () => {
    const at = minutesOfDay('01:30')!;
    expect(isReminderDue('01:30', at - 1)).toBe(false);
    expect(isReminderDue('01:30', at)).toBe(true);
    expect(isReminderDue('01:30', at + 9)).toBe(true); // throttled timer, late tick
    expect(isReminderDue('01:30', at + 16)).toBe(false);
  });
  it('ignores malformed times', () => {
    expect(isReminderDue('25:00', 600)).toBe(false);
    expect(isReminderDue(undefined, 600)).toBe(false);
  });
});

const habit = (over: Partial<Habit>): Habit => ({
  id: 'h', name: 'h', anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'health',
  targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
  completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', ...over
} as Habit);

const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']; // Mon..Sun

describe('habit schedule', () => {
  it('weekday habit is not due on weekends', () => {
    const h = habit({ frequency: 'weekdays' });
    expect(isHabitDueOn(h, '2026-11-07')).toBe(false); // Saturday
    expect(isHabitDueOn(h, '2026-11-09')).toBe(true); // Monday
  });
  it('a 4-days-a-week habit done every due day is 100%, not 4/7', () => {
    const h = habit({ frequency: 'custom', customDays: [1, 2, 4, 5], completedDates: ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'] });
    expect(habitCompliance(h, week)).toEqual({ due: 4, done: 4 });
  });
  it('days before creation and freeze days are not due', () => {
    const h = habit({ createdAt: '2026-11-05T09:00:00', freezesUsedDates: ['2026-11-06'] });
    expect(isHabitDueOn(h, '2026-11-04')).toBe(false);
    expect(isHabitDueOn(h, '2026-11-06')).toBe(false);
    expect(isHabitDueOn(h, '2026-11-07')).toBe(true);
  });
  it('a bonus completion on a non-due day never lowers the rate', () => {
    const h = habit({ frequency: 'weekdays', completedDates: ['2026-11-07'] });
    const c = habitCompliance(h, ['2026-11-07']);
    expect(c.done).toBe(c.due);
  });
});
