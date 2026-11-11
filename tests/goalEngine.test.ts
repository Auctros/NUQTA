import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateGoalProgress } from '../src/lib/goalProgressEngine';
import { localDateKey, addDaysToKey } from '../src/lib/dateKey';
import type { Goal, Habit, Task } from '../src/types';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

const today = () => localDateKey();
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'G', category: 'personal', timeframe: 'quarterly', keyResults: [],
  status: 'active', createdAt: '2026-10-01T00:00:00.000Z', ...over
} as Goal);
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Run', anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'health',
  targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
  completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', ...over
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({ id: 't1', title: 'T', status: 'todo', priority: 'P2', ...over } as Task);

describe('habit consistency respects the habit schedule', () => {
  it('a 4-days-a-week habit completed on every due day scores 100%, not ~29%', () => {
    const days = Array.from({ length: 14 }, (_, i) => addDaysToKey(today(), -i));
    const dueDow = [1, 2, 4, 5];
    const completed = days.filter((d) => dueDow.includes(new Date(d + 'T00:00:00').getDay()));
    const h = habit({ frequency: 'custom', customDays: dueDow, completedDates: completed });
    const g = goal({
      keyResults: [{ id: 'k', title: 'consistency', targetValue: 100, currentValue: 0, unit: '%', dataSource: 'habit_consistency' }],
      linkedHabitIds: ['h1']
    });
    const r = evaluateGoalProgress(g, [], [h]);
    expect(r.evaluatedKrs[0].evaluatedCurrentValue).toBe(100);
    expect(r.evaluatedKrs[0].progressPercent).toBe(100);
    expect(r.executionSummary.habitsConsistencyPercent).toBe(100);
  });
});

describe('goal momentum counts regular habit completions', () => {
  it('a goal linked to a habit done yesterday is not dormant', () => {
    const yesterday = addDaysToKey(today(), -1);
    const r = evaluateGoalProgress(goal({ linkedHabitIds: ['h1'] }), [], [habit({ completedDates: [yesterday] })]);
    expect(r.isDormant).toBe(false);
    expect(r.lastActivityDate).toBe(yesterday);
  });
  it('a goal with no activity at all is dormant', () => {
    expect(evaluateGoalProgress(goal(), [], []).isDormant).toBe(true);
  });
});

describe('one task belongs to one goal', () => {
  it('an item re-linked to goal B is not also counted in goal A', () => {
    const t = task({ linkedGoalId: 'g2' });
    const a = evaluateGoalProgress(goal({ id: 'g1', linkedTaskIds: ['t1'] }), [t], []);
    const b = evaluateGoalProgress(goal({ id: 'g2' }), [t], []);
    expect(a.executionSummary.tasksTotal).toBe(0);
    expect(b.executionSummary.tasksTotal).toBe(1);
  });
  it('legacy items with no linkedGoalId still count via the goal list', () => {
    const r = evaluateGoalProgress(goal({ linkedTaskIds: ['t1'] }), [task()], []);
    expect(r.executionSummary.tasksTotal).toBe(1);
  });
});
