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
/** A goal with any field overridden, for relationship tests. */
const goalWith = (over: Record<string, unknown> = {}) => ({ ...goal(), ...over });
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

// ---------------------------------------------------------------------------
// Nested specialised-habit records (reading / workout / drawing / quran)
// ---------------------------------------------------------------------------

const readingHabit = () => ({
  ...habit(),
  id: 'h-reading',
  specializedType: 'reading',
  readingData: {
    annualTargetBooks: 12,
    totalPagesRead: 100,
    totalReadingMinutes: 120,
    activeBookId: 'b1',
    books: [{ id: 'b1', title: 'Book', author: 'Author', totalPages: 200, currentPage: 10, status: 'reading' }],
    quotes: [{ id: 'q1', quote: 'A quote', date: '2026-11-11', bookId: 'b1' }],
    sessions: [
      { id: 'rs1', date: '2026-11-11', bookId: 'b1', bookTitle: 'Book', pagesRead: 10, durationMinutes: 20, speedPagesPerHour: 30 }
    ]
  }
});
const workoutHabit = () => ({
  ...habit(),
  id: 'h-workout',
  specializedType: 'workout',
  workoutData: {
    weeklyTargetSessions: 3,
    totalVolumeKg: 0,
    totalMinutes: 30,
    totalWorkouts: 1,
    favoriteRoutine: 'Calisthenics',
    customRoutines: [
      {
        id: 'rt1',
        name: 'Full Body',
        nameAr: 'الجسم الكامل',
        targetLevel: 'beginner',
        estimatedMinutes: 20,
        category: 'bodyweight',
        exercises: [
          { id: 'ex1', name: 'Push-ups', category: 'chest', sets: [{ setNumber: 1, reps: 10, completed: true }] }
        ]
      }
    ],
    sessions: [
      {
        id: 'ws1',
        date: '2026-11-11',
        title: 'Session',
        workoutType: 'strength',
        durationMinutes: 30,
        volumeKg: 0,
        intensityRating: 3,
        exercises: [{ id: 'ex1', name: 'Push-ups', category: 'chest', sets: [{ setNumber: 1, reps: 10, completed: true }] }]
      }
    ]
  }
});
const drawingHabit = () => ({
  ...habit(),
  id: 'h-drawing',
  specializedType: 'drawing',
  drawingData: {
    totalDrawingMinutes: 60,
    totalSketches: 1,
    favoriteMedium: 'sketch',
    projects: [
      {
        id: 'p1',
        title: 'Project',
        stage: 'sketching',
        medium: 'sketch',
        startedDate: '2026-11-11',
        totalMinutesSpent: 60,
        sessionsCount: 1
      }
    ],
    pieces: [{ id: 'art1', title: 'Piece', medium: 'sketch', durationMinutes: 60, completedDate: '2026-11-11', projectId: 'p1' }]
  }
});
const quranHabit = () => ({
  ...habit(),
  id: 'h-quran',
  specializedType: 'quran',
  quranData: {
    surahs: [
      { surahNumber: 1, status: 'completed', memorizedAyahsRanges: [{ start: 1, end: 7 }], memorizedAyahsCount: 7, masteryRating: 5 }
    ],
    sessions: [
      {
        id: 'qs1',
        date: '2026-11-11',
        type: 'new_memorization',
        surahNumber: 2,
        surahName: 'Al-Baqarah',
        ayahStart: 1,
        ayahEnd: 25,
        ayahCount: 25,
        durationMinutes: 30,
        quality: 'excellent'
      }
    ],
    revisionSchedule: { revisionCycleDays: 7, currentReviewSurahs: [1, 2], targetDailyAyahs: 10, weeklyTargetRevisionMinutes: 120 },
    totalAyahsMemorized: 7,
    totalSurahsCompleted: 1,
    totalMemorizationMinutes: 30,
    totalRevisionMinutes: 0,
    dailyTargetAyahs: 10,
    activeSurahNumber: 2
  }
});

describe('nested specialised-habit records are validated in full', () => {
  it.each([
    ['reading', readingHabit()],
    ['workout', workoutHabit()],
    ['drawing', drawingHabit()],
    ['quran', quranHabit()]
  ])('%s accepts a well-formed nested record', (_name, entity) => {
    expect(parseBackup(wrap({ habits: [entity] }))).toMatchObject({ ok: true });
  });

  it.each([
    ['book with an unknown status', 'reading', { ...readingHabit(), readingData: { ...readingHabit().readingData, books: [{ id: 'b1', title: 'B', author: 'A', totalPages: 1, currentPage: 0, status: 'nope' }] } }],
    ['reading session missing speed', 'reading', { ...readingHabit(), readingData: { ...readingHabit().readingData, sessions: [{ id: 'rs1', date: 'd', bookId: 'b1', bookTitle: 'B', pagesRead: 1, durationMinutes: 1 }] } }],
    ['quote without a quote string', 'reading', { ...readingHabit(), readingData: { ...readingHabit().readingData, quotes: [{ id: 'q1', date: 'd' }] } }],
    ['exercise set missing completed', 'workout', { ...workoutHabit(), workoutData: { ...workoutHabit().workoutData, sessions: [{ id: 'ws1', date: 'd', title: 't', workoutType: 'strength', durationMinutes: 1, volumeKg: 0, intensityRating: 3, exercises: [{ id: 'ex1', name: 'x', category: 'chest', sets: [{ setNumber: 1, reps: 1 }] }] }] } }],
    ['unknown workout type', 'workout', { ...workoutHabit(), workoutData: { ...workoutHabit().workoutData, sessions: [{ id: 'ws1', date: 'd', title: 't', workoutType: 'yoga', durationMinutes: 1, volumeKg: 0, intensityRating: 3, exercises: [] }] } }],
    ['unknown exercise category', 'workout', { ...workoutHabit(), workoutData: { ...workoutHabit().workoutData, customRoutines: [{ id: 'rt1', name: 'n', nameAr: 'n', targetLevel: 'beginner', estimatedMinutes: 1, category: 'bodyweight', exercises: [{ id: 'e', name: 'x', category: 'nope', sets: [] }] }] } }],
    ['artwork piece with an unknown medium', 'drawing', { ...drawingHabit(), drawingData: { ...drawingHabit().drawingData, pieces: [{ id: 'art1', title: 'P', medium: 'crayon', durationMinutes: 1, completedDate: 'd' }] } }],
    ['art project with an unknown stage', 'drawing', { ...drawingHabit(), drawingData: { ...drawingHabit().drawingData, projects: [{ id: 'p1', title: 'P', stage: 'nope', medium: 'sketch', startedDate: 'd', totalMinutesSpent: 1, sessionsCount: 1 }] } }],
    ['quran session with an unknown type', 'quran', { ...quranHabit(), quranData: { ...quranHabit().quranData, sessions: [{ id: 'qs1', date: 'd', type: 'nope', surahNumber: 1, surahName: 's', ayahStart: 1, ayahEnd: 1, ayahCount: 1, durationMinutes: 1, quality: 'excellent' }] } }],
    ['quran session with an out-of-range surah', 'quran', { ...quranHabit(), quranData: { ...quranHabit().quranData, sessions: [{ id: 'qs1', date: 'd', type: 'revision', surahNumber: 200, surahName: 's', ayahStart: 1, ayahEnd: 1, ayahCount: 1, durationMinutes: 1, quality: 'good' }] } }],
    ['surah state with an unknown status', 'quran', { ...quranHabit(), quranData: { ...quranHabit().quranData, surahs: [{ surahNumber: 1, status: 'nope', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }] } }],
    ['surah state with a malformed range', 'quran', { ...quranHabit(), quranData: { ...quranHabit().quranData, surahs: [{ surahNumber: 1, status: 'completed', memorizedAyahsRanges: [{ start: 'x' }], memorizedAyahsCount: 0 }] } }],
    ['revision schedule with a malformed surah list', 'quran', { ...quranHabit(), quranData: { ...quranHabit().quranData, revisionSchedule: { revisionCycleDays: 7, currentReviewSurahs: ['x'], targetDailyAyahs: 1, weeklyTargetRevisionMinutes: 1 } } }]
  ])('%s is rejected', (_name, _type, entity) => {
    const r = parseBackup(wrap({ habits: [entity] }));
    expect(r).toMatchObject({ ok: false, error: 'invalid_section', section: 'habits' });
  });
});

// ---------------------------------------------------------------------------
// Envelope metadata and cross-entity relationships
// ---------------------------------------------------------------------------

describe('the envelope is validated in full', () => {
  it('requires the exportedAt metadata field', () => {
    const raw = JSON.stringify({ app: 'nuqta', version: 2, data: {} });
    expect(parseBackup(raw)).toMatchObject({ ok: false, error: 'invalid_section', section: 'exportedAt' });
  });
  it('rejects an empty-string exportedAt', () => {
    const raw = JSON.stringify({ app: 'nuqta', version: 2, exportedAt: '', data: {} });
    expect(parseBackup(raw)).toMatchObject({ ok: false, error: 'invalid_section', section: 'exportedAt' });
  });
  it('accepts a legacy v1 flat file without an envelope', () => {
    const legacy = JSON.stringify({ tasks: [task()], habits: [], goals: [] });
    expect(parseBackup(legacy)).toMatchObject({ ok: true, legacy: true, version: 1 });
  });
});

describe('cross-entity relationships must resolve inside the backup', () => {

  it('accepts a goal whose linkedTaskIds all resolve', () => {
    const file = wrap({ goals: [goalWith({ linkedTaskIds: ['t1'] })], tasks: [task()] });
    expect(parseBackup(file)).toMatchObject({ ok: true });
  });
  it('rejects a goal linking a task that is not in the file', () => {
    const file = wrap({ goals: [goalWith({ linkedTaskIds: ['missing'] })], tasks: [task()] });
    expect(parseBackup(file)).toMatchObject({ ok: false, error: 'invalid_section', section: 'linkedTaskIds' });
  });
  it('rejects a goal linking a habit that is not in the file', () => {
    const file = wrap({ goals: [goalWith({ linkedHabitIds: ['missing'] })], habits: [habit()] });
    expect(parseBackup(file)).toMatchObject({ ok: false, error: 'invalid_section', section: 'linkedHabitIds' });
  });
  it('rejects a task pointing at a goal that is not in the file', () => {
    const file = wrap({ goals: [goal()], tasks: [{ ...task(), linkedGoalId: 'missing' }] });
    expect(parseBackup(file)).toMatchObject({ ok: false, error: 'invalid_section', section: 'linkedGoalId' });
  });
  it('rejects a nested reading book pointing at a goal that is not in the file', () => {
    const reading = readingHabit();
    (reading.readingData.books[0] as { linkedGoalId?: string }).linkedGoalId = 'missing';
    const file = wrap({ goals: [goal()], habits: [reading] });
    expect(parseBackup(file)).toMatchObject({ ok: false, error: 'invalid_section', section: 'linkedGoalId' });
  });
  it('accepts a nested reading book pointing at a goal that IS in the file', () => {
    const reading = readingHabit();
    (reading.readingData.books[0] as { linkedGoalId?: string }).linkedGoalId = 'g1';
    const file = wrap({ goals: [goalWith({ id: 'g1' })], habits: [reading] });
    expect(parseBackup(file)).toMatchObject({ ok: true });
  });
  it('does not check goal links when the file carries no goals section', () => {
    // A partial file that only replaces tasks: its goal links cannot be judged here.
    const file = wrap({ tasks: [{ ...task(), linkedGoalId: 'anything' }] });
    expect(parseBackup(file)).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Safety backup / rollback behaviour on a rejected file
// ---------------------------------------------------------------------------

describe('rollback: a rejected file is never partially applied', () => {
  it('rejects a file whose nested record is invalid and writes nothing', () => {
    NuqtaStorageEngine.saveTasks([{ id: 'keep', title: 'Keep', priority: 2, status: 'todo' } as never]);
    const before = JSON.stringify(Object.entries(localStorage).sort());
    const bad = workoutHabit();
    bad.workoutData.sessions[0].exercises[0].sets[0].completed = 'yes' as never;
    const file = wrap({ habits: [bad] });
    expect(NuqtaStorageEngine.importBackup(file).ok).toBe(false);
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(before);
  });
  it('rejects a file with a dangling relationship and writes nothing', () => {
    NuqtaStorageEngine.saveTasks([{ id: 'keep', title: 'Keep', priority: 2, status: 'todo' } as never]);
    const before = JSON.stringify(Object.entries(localStorage).sort());
    const file = wrap({ goals: [{ ...goal(), linkedTaskIds: ['ghost'] }], tasks: [task()] });
    expect(NuqtaStorageEngine.importBackup(file).ok).toBe(false);
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(before);
  });
});
