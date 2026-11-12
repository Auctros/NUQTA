import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { localDateKey, localDayFrom, localTimeKey } from '../src/lib/dateKey';
import { computeDailyEnergyScore } from '../src/lib/energyAlgorithm';
import { evaluateGoalProgress } from '../src/lib/goalProgressEngine';
import { generateUniversalHistory } from '../src/lib/universalHistoryEngine';
import type { Goal, Task, FocusSession } from '../src/types';

/**
 * The whole suite runs in Africa/Cairo (UTC+2, see vitest.config.ts). The instants
 * below fall between 22:00 and 23:59 UTC, i.e. already the NEXT local day, which is
 * exactly where a UTC-derived calendar day is wrong.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setLocal = (iso: string) => vi.setSystemTime(new Date(iso));

describe('localDayFrom accepts both stored shapes', () => {
  it('keeps a day key untouched and converts an instant to its local day', () => {
    expect(localDayFrom('2026-11-11')).toBe('2026-11-11');
    expect(localDayFrom('2026-11-11T22:30:00.000Z')).toBe('2026-11-12');
  });
});

describe('energy: a task completed after local midnight counts as today', () => {
  it('an instant at 00:30 local is not credited to yesterday', () => {
    setLocal('2026-11-12T00:30:00+02:00');
    const t = { id: 't1', title: 'T', status: 'completed', priority: 2, completedAt: '2026-11-11T22:30:00.000Z' } as unknown as Task;
    const withTask = computeDailyEnergyScore(null, [t]);
    const without = computeDailyEnergyScore(null, []);
    expect(localDateKey(new Date(t.completedAt!))).toBe('2026-11-12');
    expect(withTask).toBeGreaterThan(without);
  });
  it('a task completed on the previous local day does not count', () => {
    setLocal('2026-11-12T12:00:00+02:00');
    const t = { id: 't1', title: 'T', status: 'completed', priority: 2, completedAt: '2026-11-11T20:00:00.000Z' } as unknown as Task;
    expect(computeDailyEnergyScore(null, [t])).toBe(computeDailyEnergyScore(null, []));
  });
});

describe('goal progress: deadline day count uses the local day', () => {
  const goal = (over: Partial<Goal> = {}): Goal =>
    ({ id: 'g1', title: 'G', category: 'personal', timeframe: 'quarterly', keyResults: [], status: 'active', createdAt: '2026-11-01T00:00:00.000Z', ...over } as Goal);

  it('the deadline is 0 days away for the whole local deadline day', () => {
    setLocal('2026-11-20T00:30:00+02:00'); // 22:30 UTC on the 19th
    const r = evaluateGoalProgress(goal({ deadline: '2026-11-20' }), [], []);
    expect(r.daysRemaining).toBe(0);
    expect(r.isOverdue).toBe(false);
  });

  it('a goal past its local deadline is overdue', () => {
    setLocal('2026-11-21T00:30:00+02:00'); // 22:30 UTC on the 20th
    const r = evaluateGoalProgress(goal({ deadline: '2026-11-20' }), [], []);
    expect(r.daysRemaining).toBe(-1);
    expect(r.isOverdue).toBe(true);
  });

  it('a completed goal is never reported overdue', () => {
    setLocal('2026-11-25T09:00:00+02:00');
    const done = goal({
      deadline: '2026-11-20',
      milestones: [{ id: 'm1', title: 'M', isCompleted: true, targetDate: '2026-11-20' }]
    });
    expect(evaluateGoalProgress(done, [], []).isOverdue).toBe(false);
  });

  it('a task completed after local midnight is dated to the local day in contributions', () => {
    setLocal('2026-11-12T00:30:00+02:00');
    const t = { id: 't1', title: 'T', status: 'completed', priority: 2, linkedGoalId: 'g1', completedAt: '2026-11-11T22:30:00.000Z' } as unknown as Task;
    const r = evaluateGoalProgress(goal({ linkedTaskIds: ['t1'] }), [t], []);
    expect(r.contributions.find((c) => c.type === 'task')?.date).toBe('2026-11-12');
  });
});

describe('universal history: every event is dated to the local day', () => {
  it('a task created and archived at 22:30 UTC is dated to the local next day', () => {
    setLocal('2026-11-12T00:30:00+02:00');
    const t = {
      id: 't1', title: 'T', status: 'archived', priority: 2, tags: [],
      createdAt: '2026-11-11T22:30:00.000Z',
      completedAt: '2026-11-11T22:45:00.000Z',
      archivedAt: '2026-11-11T23:00:00.000Z'
    } as unknown as Task;
    const events = generateUniversalHistory({
      tasks: [t], habits: [], goals: [], focusSessions: [], journalEntries: [],
      expenses: [], sundayReviews: [], historyAuditLogs: []
    });
    const taskEvents = events.filter((e) => e.domain === 'tasks');
    expect(taskEvents.length).toBeGreaterThan(0);
    expect(taskEvents.every((e) => e.date === '2026-11-12')).toBe(true);
  });

  it('a focus session completed after local midnight is dated locally', () => {
    setLocal('2026-11-12T00:30:00+02:00');
    const f = {
      id: 'f1', durationMinutes: 25, completedAt: '2026-11-11T22:30:00.000Z'
    } as unknown as FocusSession;
    const events = generateUniversalHistory({
      tasks: [], habits: [], goals: [], focusSessions: [f], journalEntries: [],
      expenses: [], sundayReviews: [], historyAuditLogs: []
    });
    const focusEvent = events.find((e) => e.domain === 'focus');
    expect(focusEvent?.date).toBe('2026-11-12');
  });
});

describe('localTimeKey mirrors the local clock', () => {
  it('formats an instant in local time, not UTC', () => {
    expect(localTimeKey(new Date('2026-11-11T22:30:00.000Z'))).toBe('00:30');
  });
});
