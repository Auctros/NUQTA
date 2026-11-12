import { describe, it, expect } from 'vitest';
import { parseBackup } from '../src/lib/backupSchema';
import { NuqtaStorageEngine } from '../src/lib/storage';

/**
 * Every supported section must be validated in full before an import is allowed to
 * touch stored data. These tests use well-formed entities as the baseline and then
 * corrupt exactly one field at a time.
 */

const wrap = (data: Record<string, unknown>) =>
  JSON.stringify({ app: 'nuqta', version: 2, exportedAt: '2026-11-11T00:00:00.000Z', data });

const task = () => ({ id: 't1', title: 'Task', priority: 2, status: 'todo' });
const habit = () => ({
  id: 'h1',
  name: 'Habit',
  timeOfDay: 'morning',
  frequency: 'daily',
  category: 'health',
  targetPerDay: 1
});
const goal = () => ({
  id: 'g1',
  title: 'Goal',
  category: 'career',
  timeframe: 'quarterly',
  status: 'active',
  keyResults: []
});
const focus = () => ({
  id: 'f1',
  durationMinutes: 25,
  targetMinutes: 25,
  interruptionCount: 0,
  preMood: 3,
  postMood: 3,
  productivityScore: 3,
  completedAt: '2026-11-11T10:00:00.000Z'
});
const expense = () => ({ id: 'e1', title: 'Lunch', amount: 12, type: 'expense', category: 'food', date: '2026-11-11' });
const savings = () => ({ id: 's1', title: 'Trip', targetAmount: 1000, currentAmount: 0 });
const journal = () => ({
  id: 'j1',
  date: '2026-11-11',
  whatWentWell: '',
  whatDrainedEnergy: '',
  planForTomorrow: '',
  gratitudeList: [],
  mood: 3,
  isEncrypted: false,
  createdAt: '2026-11-11T20:00:00.000Z'
});
const review = () => ({
  id: 'r1',
  date: '2026-11-09',
  wins: [],
  lessons: [],
  energyAudit: '',
  topPrioritiesNextWeek: [],
  completedAt: '2026-11-09T20:00:00.000Z'
});
const audit = () => ({
  id: 'a1',
  timestamp: '2026-11-11T10:00:00.000Z',
  domain: 'tasks',
  action: 'created',
  title: 'Task created',
  entityId: 't1',
  entityType: 'task'
});
const health = (date = '2026-11-11') => ({
  date,
  sleepHours: 7,
  sleepQuality: 4,
  hydrationMl: 2000,
  targetHydrationMl: 2500,
  workoutLogged: true,
  moodRating: 4
});

const sectionOf = (key: string, value: unknown) => ({ [key]: [value] });

describe('every section accepts a well-formed entity', () => {
  it.each([
    ['tasks', task()],
    ['habits', habit()],
    ['goals', goal()],
    ['focusSessions', focus()],
    ['expenses', expense()],
    ['savingsGoals', savings()],
    ['journalEntries', journal()],
    ['sundayReviews', review()],
    ['historyAuditLogs', audit()]
  ])('%s', (key, entity) => {
    expect(parseBackup(wrap(sectionOf(key, entity)))).toMatchObject({ ok: true });
  });

  it('healthMetrics keyed by the record date', () => {
    expect(parseBackup(wrap({ healthMetrics: { '2026-11-11': health() } }))).toMatchObject({ ok: true });
  });
});

describe('invalid fields are rejected (never silently imported)', () => {
  it.each([
    ['task: priority out of range', 'tasks', { ...task(), priority: 9 }],
    ['task: unknown status', 'tasks', { ...task(), status: 'done' }],
    ['task: subtasks not objects', 'tasks', { ...task(), subtasks: ['nope'] }],
    ['task: tags with a number', 'tasks', { ...task(), tags: ['ok', 5] }],
    ['habit: unknown time of day', 'habits', { ...habit(), timeOfDay: 'night' }],
    ['habit: target not a number', 'habits', { ...habit(), targetPerDay: 'one' }],
    ['habit: customDays out of range', 'habits', { ...habit(), customDays: [9] }],
    ['goal: unknown category', 'goals', { ...goal(), category: 'space' }],
    ['goal: keyResults not an array', 'goals', { ...goal(), keyResults: 'none' }],
    ['goal: malformed key result', 'goals', { ...goal(), keyResults: [{ id: 'k1' }] }],
    ['focus: mood out of range', 'focusSessions', { ...focus(), preMood: 9 }],
    ['focus: missing completion time', 'focusSessions', { ...focus(), completedAt: 123 }],
    ['expense: unknown category', 'expenses', { ...expense(), category: 'crypto' }],
    ['savings: amount not a number', 'savingsGoals', { ...savings(), targetAmount: 'lots' }],
    ['journal: gratitude not strings', 'journalEntries', { ...journal(), gratitudeList: [1] }],
    ['review: missing completedAt', 'sundayReviews', { ...review(), completedAt: undefined }],
    ['audit: unknown domain', 'historyAuditLogs', { ...audit(), domain: 'unknown' }],
    ['audit: unknown action', 'historyAuditLogs', { ...audit(), action: 'exploded' }]
  ])('%s', (_name, key, entity) => {
    const r = parseBackup(wrap(sectionOf(key, entity)));
    expect(r).toMatchObject({ ok: false, error: 'invalid_section', section: key });
  });

  it('rejects a health metric keyed by a different date', () => {
    const r = parseBackup(wrap({ healthMetrics: { '2026-01-01': health('2026-11-11') } }));
    expect(r).toMatchObject({ ok: false, error: 'invalid_section', section: 'healthMetrics' });
  });

  it('rejects an incomplete health metric', () => {
    const r = parseBackup(wrap({ healthMetrics: { '2026-11-11': { date: '2026-11-11' } } }));
    expect(r).toMatchObject({ ok: false, error: 'invalid_section', section: 'healthMetrics' });
  });

  it('rejects a profile with an unknown theme', () => {
    const r = parseBackup(wrap({ profile: { theme: 'neon' } }));
    expect(r).toMatchObject({ ok: false, error: 'invalid_section', section: 'profile' });
  });

  it('rejects a non-string exportedAt', () => {
    const raw = JSON.stringify({ app: 'nuqta', version: 2, exportedAt: 5, data: {} });
    expect(parseBackup(raw)).toMatchObject({ ok: false, error: 'invalid_section', section: 'exportedAt' });
  });

  it('still accepts the numeric priority range and the legacy P-spelling', () => {
    expect(parseBackup(wrap({ tasks: [{ ...task(), priority: 1 }] }))).toMatchObject({ ok: true });
    expect(parseBackup(wrap({ tasks: [{ ...task(), priority: 'P2' }] }))).toMatchObject({ ok: true });
  });
});

describe('a rejected file never changes stored data', () => {
  it.each([
    ['tasks', { ...task(), priority: 99 }],
    ['habits', { ...habit(), category: 'nope' }],
    ['goals', { ...goal(), timeframe: 'weekly' }]
  ])('%s', (key, entity) => {
    NuqtaStorageEngine.saveTasks([{ id: 'keep', title: 'Keep', priority: 2, status: 'todo' } as never]);
    const before = JSON.stringify(Object.entries(localStorage).sort());
    const file = wrap(sectionOf(key, entity));
    expect(NuqtaStorageEngine.importBackup(file).ok).toBe(false);
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(before);
  });
});
