/**
 * PHASE 2 — End-to-End Functional Audit & Regression.
 *
 * These tests drive the real store and engines through user workflows. The
 * findings F1–F4 from docs/functional-audit-phase2.md are now FIXED, so the
 * former `AUDIT FINDING` tests assert the CORRECT behaviour and act as
 * regression guards against those defects returning.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { localDateKey, addDaysToKey } from '../src/lib/dateKey';
import { evaluateGoalProgress } from '../src/lib/goalProgressEngine';
import { generateUniversalHistory, getUniversalArchivedItems } from '../src/lib/universalHistoryEngine';
import { computeLifeIntelligence } from '../src/lib/lifeIntelligenceEngine';
import { parseNaturalLanguageTask } from '../src/lib/nlpParser';
import { isHabitDueOn, computeCurrentStreak } from '../src/lib/habitSchedule';
import type { Goal, Habit, Task } from '../src/types';

const S = () => useNuqtaStore.getState();
const tick = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z')); // Wed 2026-11-11, 12:00 local (Cairo)
  localStorage.clear();
  S().initializeStore();
});
afterEach(() => vi.useRealTimers());

const today = () => localDateKey();

// ---------------------------------------------------------------- A. TASKS

describe('A. Tasks', () => {
  it('create -> edit -> complete -> reopen -> delete keeps storage in sync', () => {
    S().createTask({ title: 'Write report', priority: 2, tags: ['work'] });
    let t = S().tasks[0];
    expect(t.title).toBe('Write report');
    expect(t.status).toBe('todo');
    expect(NuqtaStorageEngine.getTasks().length).toBe(1);

    S().updateTask(t.id, { title: 'Write final report', priority: 1, scheduledTime: '09:30' });
    t = S().tasks[0];
    expect(t.title).toBe('Write final report');
    expect(t.priority).toBe(1);
    expect(t.scheduledTime).toBe('09:30');
    expect(NuqtaStorageEngine.getTasks()[0].title).toBe('Write final report');

    S().toggleTaskStatus(t.id);
    expect(S().tasks[0].status).toBe('completed');
    expect(S().tasks[0].completedAt).toBeTruthy();

    S().toggleTaskStatus(t.id);
    expect(S().tasks[0].status).toBe('todo');
    expect(S().tasks[0].completedAt).toBeUndefined();

    S().deleteTask(t.id);
    expect(S().tasks).toEqual([]);
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
  });

  it('a task can hold at most 3 Top-Three slots', () => {
    ['a', 'b', 'c', 'd'].forEach((x) => S().createTask({ title: x }));
    const ids = S().tasks.map((t) => t.id);
    expect(S().toggleTopThree(ids[0]).success).toBe(true);
    expect(S().toggleTopThree(ids[1]).success).toBe(true);
    expect(S().toggleTopThree(ids[2]).success).toBe(true);
    const fourth = S().toggleTopThree(ids[3]);
    expect(fourth.success).toBe(false);
    expect(S().tasks.filter((t) => t.isTopThree).length).toBe(3);
  });

  it('completing a Top-Three task frees a slot', () => {
    ['a', 'b', 'c', 'd'].forEach((x) => S().createTask({ title: x }));
    const ids = S().tasks.map((t) => t.id);
    ids.slice(0, 3).forEach((id) => S().toggleTopThree(id));
    S().toggleTaskStatus(ids[0]);
    expect(S().toggleTopThree(ids[3]).success).toBe(true);
  });

  it('subtasks toggle and accumulate', () => {
    S().createTask({ title: 'Parent' });
    const id = S().tasks[0].id;
    S().addSubtask(id, 'first');
    S().addSubtask(id, '  '); // ignored (blank)
    expect(S().tasks[0].subtasks.length).toBe(1);
    S().toggleSubtask(id, S().tasks[0].subtasks[0].id);
    expect(S().tasks[0].subtasks[0].completed).toBe(true);
  });

  it('smartBatchReschedule moves only the listed tasks', () => {
    S().createTask({ title: 'a', scheduledDate: '2026-01-01' });
    S().createTask({ title: 'b', scheduledDate: '2026-01-01' });
    const [b, a] = S().tasks; // newest first
    S().smartBatchReschedule([{ taskId: a.id, date: '2026-02-02' }]);
    const after = S().tasks.find((t) => t.id === a.id)!;
    const other = S().tasks.find((t) => t.id === b.id)!;
    expect(after.scheduledDate).toBe('2026-02-02');
    expect(other.scheduledDate).toBe('2026-01-01');
  });
});

// ---------------------------------------------------------------- B. HABITS

describe('B. Habits', () => {
  const mkHabit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Run', anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'health',
    targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
    completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', ...over
  } as Habit);

  it('toggle habit marks/unmarks today and adjusts the streak', () => {
    NuqtaStorageEngine.saveHabits([mkHabit()]);
    S().initializeStore();
    S().toggleHabitToday('h1');
    expect(S().habits[0].completedDates).toContain(today());
    expect(S().habits[0].currentStreak).toBe(1);
    S().toggleHabitToday('h1');
    expect(S().habits[0].completedDates).not.toContain(today());
    expect(S().habits[0].currentStreak).toBe(0);
  });

  it('F3 regression: a missed due day breaks the streak instead of letting it grow', () => {
    // Last completion was 3 days ago (streak already broken) and the stored
    // counter was stale: completing today must restart the streak at 1.
    const stale = addDaysToKey(today(), -3);
    NuqtaStorageEngine.saveHabits([mkHabit({ completedDates: [stale], currentStreak: 5, longestStreak: 5 })]);
    S().initializeStore();
    S().toggleHabitToday('h1');
    expect(S().habits[0].completedDates).toContain(today());
    expect(S().habits[0].currentStreak).toBe(1);
    expect(S().habits[0].longestStreak).toBe(5); // the historical best is preserved
  });

  it('F3 regression: consecutive completions build the streak', () => {
    NuqtaStorageEngine.saveHabits([
      mkHabit({ completedDates: [addDaysToKey(today(), -2), addDaysToKey(today(), -1)] })
    ]);
    S().initializeStore();
    S().toggleHabitToday('h1');
    expect(S().habits[0].currentStreak).toBe(3);
  });

  it('F3 regression: non-due days (Friday off) do not break a weekdays habit streak', () => {
    // Thu 11-12 and Sat 11-14 are both due days (NUQTA week is Sat–Thu); Friday
    // 11-13 in between is the weekly day off, so it is skipped without breaking.
    NuqtaStorageEngine.saveHabits([
      mkHabit({ frequency: 'weekdays', completedDates: ['2026-11-12', '2026-11-14'] })
    ]);
    S().initializeStore();
    expect(computeCurrentStreak(S().habits[0], '2026-11-14')).toBe(2);
  });

  it('habitCompliance only counts due days (weekdays habit, 6 due days/week)', () => {
    const h = mkHabit({ frequency: 'weekdays' });
    // NUQTA week: Sat..Thu due, Friday off.
    const week = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
    expect(week.filter((d) => isHabitDueOn(h, d)).length).toBe(6);
  });

  it('a streak freeze suppresses a due day', () => {
    const h = mkHabit({ freezesUsedDates: ['2026-11-11'] });
    expect(isHabitDueOn(h, '2026-11-11')).toBe(false);
  });

  it('F1 regression: creating a specialised habit starts it empty (no fabricated data)', () => {
    S().createHabit({ name: 'Read', specializedType: 'reading', frequency: 'daily', category: 'learning', timeOfDay: 'evening', anchor: '' } as any);
    const h = S().habits[0];
    expect(h.readingData).toBeTruthy();
    expect((h.readingData!.books || []).length).toBe(0);
    expect((h.readingData!.sessions || []).length).toBe(0);
    expect(h.readingData!.totalPagesRead).toBe(0);
  });
});

// ---------------------------------------------------------------- C. GOALS

describe('C. Goals & progress', () => {
  const mkTask = (over: Partial<Task> = {}): Task => ({
    id: 't1', title: 'T', status: 'todo', priority: 2, isTopThree: false, tags: [], subtasks: [],
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...over
  } as Task);
  const mkHabit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Run', anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'health',
    targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
    completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', ...over
  } as Habit);
  const mkGoal = (over: Partial<Goal> = {}): Goal => ({
    id: 'g1', title: 'G', category: 'personal', timeframe: 'quarterly', keyResults: [],
    status: 'active', createdAt: '2026-10-01T00:00:00.000Z', ...over
  } as Goal);

  it('tasks_completed key result tracks linked tasks and updates on completion', () => {
    const g = mkGoal({ keyResults: [{ id: 'k', title: 'kr', targetValue: 2, currentValue: 0, unit: '', dataSource: 'tasks_completed' }] });
    let r = evaluateGoalProgress(g, [mkTask({ id: 't1', linkedGoalId: 'g1', status: 'completed' }), mkTask({ id: 't2', linkedGoalId: 'g1' })], []);
    expect(r.evaluatedKrs[0].evaluatedCurrentValue).toBe(1);
    expect(r.evaluatedKrs[0].progressPercent).toBe(50);
    r = evaluateGoalProgress(g, [mkTask({ id: 't1', linkedGoalId: 'g1', status: 'completed' }), mkTask({ id: 't2', linkedGoalId: 'g1', status: 'completed' })], []);
    expect(r.evaluatedKrs[0].progressPercent).toBe(100);
  });

  it('reopening a completed task lowers goal progress again', () => {
    const g = mkGoal({ keyResults: [{ id: 'k', title: 'kr', targetValue: 2, currentValue: 0, unit: '', dataSource: 'tasks_completed' }] });
    const both = [mkTask({ id: 't1', linkedGoalId: 'g1', status: 'completed' }), mkTask({ id: 't2', linkedGoalId: 'g1', status: 'completed' })];
    expect(evaluateGoalProgress(g, both, []).evaluatedKrs[0].progressPercent).toBe(100);
    const reopened = [both[0], { ...both[1], status: 'todo' as const }];
    expect(evaluateGoalProgress(g, reopened, []).evaluatedKrs[0].progressPercent).toBe(50);
  });

  it('deleting a task removes its contribution', () => {
    const g = mkGoal({ keyResults: [{ id: 'k', title: 'kr', targetValue: 2, currentValue: 0, unit: '', dataSource: 'tasks_completed' }] });
    const one = [mkTask({ id: 't1', linkedGoalId: 'g1', status: 'completed' })];
    expect(evaluateGoalProgress(g, one, []).evaluatedKrs[0].evaluatedCurrentValue).toBe(1);
    expect(evaluateGoalProgress(g, [], []).evaluatedKrs[0].hasInsufficientData).toBe(true);
  });

  it('no double counting when a task is linked to two goals (single source of truth)', () => {
    const t = mkTask({ id: 't1', linkedGoalId: 'g2', status: 'completed' });
    const a = evaluateGoalProgress(mkGoal({ id: 'g1', linkedTaskIds: ['t1'] }), [t], []);
    const b = evaluateGoalProgress(mkGoal({ id: 'g2' }), [t], []);
    expect(a.executionSummary.tasksTotal).toBe(0);
    expect(b.executionSummary.tasksTotal).toBe(1);
  });

  it('outcome (Key Results) is distinguished from execution (tasks+habits)', () => {
    const g = mkGoal({
      keyResults: [{ id: 'k', title: 'revenue', startValue: 0, targetValue: 100, currentValue: 10, unit: 'k', dataSource: 'manual' }],
      linkedTaskIds: ['t1']
    });
    const r = evaluateGoalProgress(g, [mkTask({ id: 't1', linkedGoalId: 'g1', status: 'completed' })], []);
    expect(r.outcomeProgressPercent).toBe(10); // manual KR
    expect(r.executionProgressPercent).toBe(100); // the one linked task is done
    expect(r.overallProgressPercent).toBe(10); // overall follows outcome
  });

  it('milestone progress drives outcome when there are no Key Results', () => {
    const g = mkGoal({ milestones: [
      { id: 'm1', title: 'a', isCompleted: true },
      { id: 'm2', title: 'b', isCompleted: false }
    ] });
    const r = evaluateGoalProgress(g, [], []);
    expect(r.outcomeProgressPercent).toBe(50);
    expect(r.milestonesProgressPercent).toBe(50);
  });

  it('linking an activity to a goal makes it count and stores the back-reference', () => {
    S().createGoal({ title: 'G' });
    S().createTask({ title: 'T' });
    const goalId = S().goals[0].id;
    const taskId = S().tasks[0].id;
    S().linkActivityToGoal(goalId, 'task', taskId);
    expect(S().goals[0].linkedTaskIds).toContain(taskId);
    expect(S().tasks[0].linkedGoalId).toBe(goalId);
    expect(evaluateGoalProgress(S().goals[0], S().tasks, []).executionSummary.tasksTotal).toBe(1);
  });

  it('unlinking clears the relation but never deletes the entity', () => {
    S().createGoal({ title: 'G' });
    S().createTask({ title: 'T' });
    const goalId = S().goals[0].id;
    const taskId = S().tasks[0].id;
    S().linkActivityToGoal(goalId, 'task', taskId);
    S().unlinkActivityFromGoal(goalId, 'task', taskId);
    expect(S().tasks.length).toBe(1);
    expect(S().tasks[0].linkedGoalId).toBeUndefined();
    expect(S().goals[0].linkedTaskIds).not.toContain(taskId);
  });

  it('linking the same task to a second goal removes it from the first', () => {
    S().createGoal({ title: 'A' });
    S().createGoal({ title: 'B' });
    S().createTask({ title: 'T' });
    const [b, a] = S().goals;
    const taskId = S().tasks[0].id;
    S().linkActivityToGoal(a.id, 'task', taskId);
    S().linkActivityToGoal(b.id, 'task', taskId);
    const aAfter = S().goals.find((g) => g.id === a.id)!;
    const bAfter = S().goals.find((g) => g.id === b.id)!;
    expect(aAfter.linkedTaskIds || []).not.toContain(taskId);
    expect(bAfter.linkedTaskIds).toContain(taskId);
  });

  it('deleteGoal clears dangling task/habit links', () => {
    S().createGoal({ title: 'G' });
    S().createTask({ title: 'T' });
    const goalId = S().goals[0].id;
    S().linkActivityToGoal(goalId, 'task', S().tasks[0].id);
    S().deleteGoal(goalId);
    expect(S().tasks[0].linkedGoalId).toBeUndefined();
  });

  it('reading_pages_read uses the linked books when specific books are linked', () => {
    const h = mkHabit({ id: 'h1', readingData: { books: [
      { id: 'b1', title: 'B1', author: 'x', category: 'x', totalPages: 100, currentPage: 40, status: 'reading', coverColor: '#000' },
      { id: 'b2', title: 'B2', author: 'y', category: 'x', totalPages: 100, currentPage: 90, status: 'reading', coverColor: '#000' }
    ], sessions: [], annualTargetBooks: 5, totalPagesRead: 999, totalReadingMinutes: 0 } } as any);
    const g = mkGoal({ linkedBookIds: ['b1'], keyResults: [{ id: 'k', title: 'pages', targetValue: 100, currentValue: 0, unit: '', dataSource: 'reading_pages_read' }] });
    const r = evaluateGoalProgress(g, [], [h]);
    expect(r.evaluatedKrs[0].evaluatedCurrentValue).toBe(40); // only b1, not the 999 habit total
  });
});

// ------------------------------------------------ D. QUICK CAPTURE / PLANNING

describe('D. Quick Capture & planning', () => {
  it('NLP parses title, priority, date, time, duration, tags and energy', () => {
    const p = parseNaturalLanguageTask('Pitch deck revision tomorrow at 3pm for 90m !high #work !deep');
    expect(p.title).toBe('Pitch deck revision');
    expect(p.priority).toBe(1);
    expect(p.estimatedMinutes).toBe(90);
    expect(p.tags).toContain('work');
    expect(p.energyLevelRequired).toBe('high');
    expect(p.scheduledTime).toBe('15:00');
    expect(p.scheduledDate).toBe(addDaysToKey(today(), 1));
  });

  it('captured input becomes a real task in the store', () => {
    const t = S().addTaskFromNLP('Call dentist tomorrow #health');
    expect(S().tasks.find((x) => x.id === t.id)).toBeTruthy();
    expect(t.tags).toContain('health');
    expect(NuqtaStorageEngine.getTasks().some((x) => x.id === t.id)).toBe(true);
  });

  it('Rescue Mode pins the anchor task and defers the rest to tomorrow', () => {
    S().createTask({ title: 'a' });
    S().createTask({ title: 'b' });
    S().createTask({ title: 'c' });
    const anchor = S().tasks.find((t) => t.title === 'b')!;
    S().executeRescueMode(anchor.id, true);
    const after = S().tasks;
    const anchorAfter = after.find((t) => t.id === anchor.id)!;
    expect(anchorAfter.isTopThree).toBe(true);
    const others = after.filter((t) => t.id !== anchor.id);
    others.forEach((t) => {
      expect(t.status).toBe('deferred');
      expect(t.scheduledDate).toBe(addDaysToKey(today(), 1));
    });
  });
});

// ------------------------------------------------------------ E. FOCUS

describe('E. Focus', () => {
  it('logging a focus session records it and awards XP', () => {
    const before = S().profile.experiencePoints;
    S().logFocusSession({ durationMinutes: 25, targetMinutes: 25, interruptionCount: 0, preMood: 3, postMood: 5, productivityScore: 5 });
    expect(S().focusSessions.length).toBe(1);
    expect(S().focusSessions[0].durationMinutes).toBe(25);
    expect(S().profile.experiencePoints).toBeGreaterThan(before);
    expect(NuqtaStorageEngine.getFocusSessions().length).toBe(1);
  });
});

// ------------------------------------------------------------ F. STUDIOS

// A studio habit created with explicit EMPTY studio data, so the audit observes only
// real user actions and not the sample content createHabit seeds by default.
const emptyStudioHabit = (type: 'reading' | 'workout' | 'drawing' | 'quran'): Habit => ({
  id: 'h1', name: type, anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'mind',
  targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
  completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', specializedType: type,
  readingData: type === 'reading' ? { books: [], sessions: [], annualTargetBooks: 12, totalPagesRead: 0, totalReadingMinutes: 0 } as any : undefined,
  workoutData: type === 'workout' ? { sessions: [], customRoutines: [], weeklyTargetSessions: 4, totalVolumeKg: 0, totalMinutes: 0, totalWorkouts: 0, favoriteRoutine: '' } as any : undefined,
  drawingData: type === 'drawing' ? { projects: [], pieces: [], totalDrawingMinutes: 0, totalSketches: 0, favoriteMedium: 'sketch' } as any : undefined,
  quranData: type === 'quran' ? { surahs: [], sessions: [], revisionSchedule: { revisionCycleDays: 7, currentReviewSurahs: [], targetDailyAyahs: 10, weeklyTargetRevisionMinutes: 120 }, totalAyahsMemorized: 0, totalSurahsCompleted: 0, totalMemorizationMinutes: 0, totalRevisionMinutes: 0, dailyTargetAyahs: 10, activeSurahNumber: 1 } as any : undefined
} as Habit);

describe('F. Specialized studios', () => {
  it('F1 regression: creating a specialised habit starts it empty (no fabricated history)', () => {
    S().createHabit({ name: 'Read', specializedType: 'reading', frequency: 'daily', category: 'learning', timeOfDay: 'evening', anchor: '' } as any);
    const r = S().habits[0].readingData!;
    // A brand-new habit must not claim pages/minutes the user never entered.
    expect(r.totalPagesRead).toBe(0);
    expect(r.totalReadingMinutes).toBe(0);
    expect(r.sessions!.length).toBe(0);
    expect(r.books.length).toBe(0);
  });

  it('reading: logging a session advances the book page and marks the habit done', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('reading')]);
    S().initializeStore();
    S().addOrUpdateBook('h1', { id: 'b1', title: 'B', author: 'A', category: 'x', totalPages: 100, currentPage: 0, status: 'reading', coverColor: '#000' } as any);
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'B', pagesRead: 10, durationMinutes: 30, speedPagesPerHour: 20 } as any);
    const hAfter = S().habits[0];
    expect(hAfter.readingData!.books.find((b) => b.id === 'b1')!.currentPage).toBe(10);
    expect(hAfter.completedDates).toContain(today());
    expect(hAfter.readingData!.sessions.length).toBe(1);
    expect(hAfter.readingData!.totalPagesRead).toBe(10);
  });

  it('reading: finishing the last page marks the book completed', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('reading')]);
    S().initializeStore();
    S().addOrUpdateBook('h1', { id: 'b1', title: 'B', author: 'A', category: 'x', totalPages: 20, currentPage: 15, status: 'reading', coverColor: '#000' } as any);
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'B', pagesRead: 10, durationMinutes: 30, speedPagesPerHour: 20 } as any);
    const b = S().habits[0].readingData!.books[0];
    expect(b.currentPage).toBe(20);
    expect(b.status).toBe('completed');
  });

  it('F2 regression: deleting a book drops its sessions and reduces readingData.totalPagesRead', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('reading')]);
    S().initializeStore();
    S().addOrUpdateBook('h1', { id: 'b1', title: 'B', author: 'A', category: 'x', totalPages: 100, currentPage: 40, status: 'reading', coverColor: '#000' } as any);
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'B', pagesRead: 40, durationMinutes: 30, speedPagesPerHour: 20 } as any);
    expect(S().habits[0].readingData!.totalPagesRead).toBe(40);
    S().deleteBook('h1', 'b1');
    const r = S().habits[0].readingData!;
    expect(r.books.length).toBe(0);
    expect(r.sessions.length).toBe(0);
    expect(r.totalPagesRead).toBe(0);
    expect(r.totalReadingMinutes).toBe(0);
  });

  it('drawing: logging a piece adds to the gallery and totals', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('drawing')]);
    S().initializeStore();
    S().logDrawingSession('h1', { title: 'Sketch', medium: 'sketch', durationMinutes: 45 } as any);
    const hAfter = S().habits[0];
    expect(hAfter.drawingData!.pieces.length).toBe(1);
    expect(hAfter.drawingData!.totalDrawingMinutes).toBe(45);
    expect(hAfter.completedDates).toContain(today());
  });

  it('F2 regression: deleting an artwork piece reduces drawingData.totalDrawingMinutes', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('drawing')]);
    S().initializeStore();
    S().logDrawingSession('h1', { title: 'Sketch', medium: 'sketch', durationMinutes: 45 } as any);
    expect(S().habits[0].drawingData!.totalDrawingMinutes).toBe(45);
    S().deleteArtworkPiece('h1', S().habits[0].drawingData!.pieces[0].id);
    const d = S().habits[0].drawingData!;
    expect(d.pieces.length).toBe(0);
    expect(d.totalDrawingMinutes).toBe(0);
    expect(d.totalSketches).toBe(0);
  });

  it('F2 regression: deleting a piece also decrements its project stats', () => {
    const base = emptyStudioHabit('drawing');
    base.drawingData!.projects = [
      { id: 'p1', title: 'Series', stage: 'in_progress', medium: 'sketch', startedDate: '2026-01-01', totalMinutesSpent: 0, sessionsCount: 0 } as any
    ];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    S().logDrawingSession('h1', { title: 'Sketch', medium: 'sketch', durationMinutes: 45, projectId: 'p1' } as any);
    S().deleteArtworkPiece('h1', S().habits[0].drawingData!.pieces[0].id);
    const proj = S().habits[0].drawingData!.projects!.find((p) => p.id === 'p1')!;
    expect(proj.totalMinutesSpent).toBe(0);
    expect(proj.sessionsCount).toBe(0);
  });

  it('workout: logging a session updates totals and syncs Today Health', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('workout')]);
    S().initializeStore();
    S().logWorkoutSession('h1', {
      title: 'Push day', durationMinutes: 40, volumeKg: 100, totalReps: 50,
      exercises: [{ id: 'e1', name: 'Pushup', movement: 'push', sets: [{ reps: 20, completed: true }, { reps: 30, completed: true }] }]
    } as any);
    const hAfter = S().habits[0];
    expect(hAfter.workoutData!.sessions.length).toBe(1);
    expect(hAfter.workoutData!.totalReps).toBe(50);
    expect(S().healthMetrics[today()]?.workoutLogged).toBe(true);
  });

  it('quran: a memorisation session records distinct ayahs without double counting', () => {
    const base = emptyStudioHabit('quran');
    base.quranData!.surahs = [{ surahNumber: 1, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'الفاتحة', ayahStart: 1, ayahEnd: 3, ayahCount: 3, durationMinutes: 10, quality: 'good' } as any);
    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'الفاتحة', ayahStart: 2, ayahEnd: 5, ayahCount: 4, durationMinutes: 10, quality: 'good' } as any);
    const q = S().habits[0].quranData!;
    // ranges 1-3 and 2-5 merge to 1-5 => 5 distinct ayahs
    expect(q.totalAyahsMemorized).toBe(5);
    expect(q.sessions.length).toBe(2);
  });

  it('F4 regression: a memorisation session for a surah missing from quranData.surahs upserts its state', () => {
    const base = emptyStudioHabit('quran'); // surahs: []
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'الفاتحة', ayahStart: 1, ayahEnd: 7, ayahCount: 7, durationMinutes: 10, quality: 'good' } as any);
    const q = S().habits[0].quranData!;
    expect(q.sessions.length).toBe(1);
    expect(q.totalAyahsMemorized).toBe(7); // the surah state is created, not dropped
    const surah1 = q.surahs.find((s) => s.surahNumber === 1)!;
    expect(surah1).toBeTruthy();
    expect(surah1.memorizedAyahsCount).toBe(7);
    expect(surah1.status).toBe('completed'); // Al-Fatihah is 7 ayahs
  });

  it('F4 regression: an invalid surah number rejects the WHOLE operation (no partial side effects)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = emptyStudioHabit('quran');
    base.quranData!.surahs = [{ surahNumber: 1, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();

    const before = S().habits[0];
    const beforeXP = S().profile.experiencePoints;
    const beforeSessions = before.quranData!.sessions.length;
    const beforeCompleted = [...before.completedDates];
    const beforeStreak = before.currentStreak;
    const beforeActive = before.quranData!.activeSurahNumber;

    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 999, surahName: 'x', ayahStart: 1, ayahEnd: 5, ayahCount: 5, durationMinutes: 10, quality: 'good' } as any);

    const after = S().habits[0];
    // No session, no surah mutation, no totals drift.
    expect(after.quranData!.sessions.length).toBe(beforeSessions);
    expect(after.quranData!.surahs.length).toBe(1); // no bogus surah appended
    expect(after.quranData!.totalAyahsMemorized).toBe(0);
    expect(after.quranData!.totalMemorizationMinutes).toBe(0);
    expect(after.quranData!.activeSurahNumber).toBe(beforeActive);
    // No completion, no streak change, no XP.
    expect(after.completedDates).toEqual(beforeCompleted);
    expect(after.completedDates).not.toContain(today());
    expect(after.currentStreak).toBe(beforeStreak);
    expect(S().profile.experiencePoints).toBe(beforeXP);
    // Storage untouched too.
    expect(NuqtaStorageEngine.getHabits()[0].quranData!.sessions.length).toBe(beforeSessions);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('F4 regression: invalid surah numbers of every shape are all rejected as no-ops', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = emptyStudioHabit('quran');
    base.quranData!.surahs = [{ surahNumber: 1, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    const beforeXP = S().profile.experiencePoints;

    for (const bad of [0, -1, 115, 1000, 1.5, NaN, undefined as any, null as any, '5' as any]) {
      S().logQuranSession('h1', { type: 'new_memorization', surahNumber: bad, surahName: 'x', ayahStart: 1, ayahEnd: 5, ayahCount: 5, durationMinutes: 10, quality: 'good' } as any);
    }

    const q = S().habits[0].quranData!;
    expect(q.sessions.length).toBe(0);
    expect(q.surahs.length).toBe(1);
    expect(q.totalAyahsMemorized).toBe(0);
    expect(q.activeSurahNumber).toBe(1);
    expect(S().habits[0].completedDates).not.toContain(today());
    expect(S().profile.experiencePoints).toBe(beforeXP); // no XP granted for any rejected call
    warn.mockRestore();
  });

  it('F4 regression: a valid session still records everything it should (happy path intact)', () => {
    const base = emptyStudioHabit('quran');
    base.quranData!.surahs = [{ surahNumber: 1, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    const beforeXP = S().profile.experiencePoints;

    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'الفاتحة', ayahStart: 1, ayahEnd: 3, ayahCount: 3, durationMinutes: 10, quality: 'good' } as any);

    const q = S().habits[0].quranData!;
    expect(q.sessions.length).toBe(1);
    expect(q.totalAyahsMemorized).toBe(3);
    expect(q.totalMemorizationMinutes).toBe(10);
    expect(q.activeSurahNumber).toBe(1);
    expect(S().habits[0].completedDates).toContain(today());
    expect(S().habits[0].currentStreak).toBe(1);
    expect(S().profile.experiencePoints).toBe(beforeXP + 40);
  });

  it('F2 regression: deleting a quran session recomputes memorised totals and minutes', () => {
    const base = emptyStudioHabit('quran');
    base.quranData!.surahs = [{ surahNumber: 1, status: 'not_started', memorizedAyahsRanges: [], memorizedAyahsCount: 0 }];
    NuqtaStorageEngine.saveHabits([base]);
    S().initializeStore();
    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'الفاتحة', ayahStart: 1, ayahEnd: 3, ayahCount: 3, durationMinutes: 10, quality: 'good' } as any);
    expect(S().habits[0].quranData!.totalMemorizationMinutes).toBe(10);
    S().deleteQuranSession('h1', S().habits[0].quranData!.sessions[0].id);
    const q = S().habits[0].quranData!;
    expect(q.sessions.length).toBe(0);
    expect(q.totalAyahsMemorized).toBe(3); // memorised ayahs persist (not a session-derived stat)
    expect(q.totalMemorizationMinutes).toBe(0); // minutes derived from sessions -> recomputed
  });
});

// ------------------------------------------------------------ G. ARCHIVE

describe('G. Archive & history', () => {
  it('archiving a task hides it from active use and lists it in the archive', () => {
    S().createTask({ title: 'Archive me' });
    const id = S().tasks[0].id;
    S().archiveTask(id);
    expect(S().tasks[0].status).toBe('archived');
    expect(S().tasks[0].isArchived).toBe(true);
    const archived = getUniversalArchivedItems({
      tasks: S().tasks, habits: S().habits, goals: S().goals, focusSessions: [], journalEntries: [],
      expenses: [], sundayReviews: [], historyAuditLogs: []
    });
    expect(archived.some((a) => a.originalId === id)).toBe(true);
  });

  it('restoring an archived incomplete task returns it to "todo"', () => {
    S().createTask({ title: 'T' });
    const id = S().tasks[0].id;
    S().archiveTask(id);
    S().restoreTask(id);
    expect(S().tasks[0].status).toBe('todo');
    expect(S().tasks[0].isArchived).toBe(false);
    expect(S().tasks[0].archivedAt).toBeUndefined();
  });

  it('restoring an archived completed task returns it to "completed"', () => {
    S().createTask({ title: 'T' });
    const id = S().tasks[0].id;
    S().toggleTaskStatus(id); // completed
    S().archiveTask(id);
    S().restoreTask(id);
    expect(S().tasks[0].status).toBe('completed');
  });

  it('restoring an archived goal returns it to "active"', () => {
    S().createGoal({ title: 'G' });
    const id = S().goals[0].id;
    S().archiveGoal(id);
    expect(S().goals[0].status).toBe('archived');
    S().restoreGoal(id);
    expect(S().goals[0].status).toBe('active');
  });

  it('archiving/restoring logs an audit entry', () => {
    S().createTask({ title: 'T' });
    const id = S().tasks[0].id;
    S().archiveTask(id);
    S().restoreTask(id);
    const actions = S().historyAuditLogs.map((l) => l.action);
    expect(actions).toContain('archived');
    expect(actions).toContain('restored');
  });

  it('AUDIT FINDING: restoring an archived task does not restore a stale Top-Three slot cleanly', () => {
    // A task archived while pinned keeps isTopThree=true; after restore it consumes a slot.
    S().createTask({ title: 'Pinned' });
    const id = S().tasks[0].id;
    S().toggleTopThree(id);
    S().archiveTask(id);
    S().restoreTask(id);
    expect(S().tasks[0].isTopThree).toBe(true); // pinned state survives the round-trip
  });
});

// ------------------------------------------------------------ H. DASHBOARD

describe('H. Dashboard & insights', () => {
  it('life intelligence reflects real tasks/habits rather than invented values', () => {
    const empty = computeLifeIntelligence('today', [], [], [], [], false);
    expect(empty.productivity.tasksCompleted.currentValue).toBe(0);
    expect(empty.habits.totalChecks).toBe(0);
    expect(empty.totalActiveTimeMinutes).toBe(0);

    S().createTask({ title: 'done', scheduledDate: today() });
    S().toggleTaskStatus(S().tasks[0].id);
    const rep = computeLifeIntelligence('today', S().tasks, [], [], [], false);
    expect(rep.productivity.tasksCompleted.currentValue).toBe(1);
  });

  it('a studio session shows up in cross-domain active time', () => {
    NuqtaStorageEngine.saveHabits([emptyStudioHabit('workout')]);
    S().initializeStore();
    S().logWorkoutSession('h1', { title: 'x', durationMinutes: 30, volumeKg: 0, totalReps: 10, exercises: [] } as any);
    const rep = computeLifeIntelligence('today', [], S().habits, [], [], false);
    expect(rep.fitness.workoutMinutes.currentValue).toBe(30);
    expect(rep.totalActiveTimeMinutes).toBeGreaterThanOrEqual(30);
  });
});

// ------------------------------------------------ I. FINANCE / HEALTH / JOURNAL

describe('I. Finance, Health & Journal', () => {
  it('expenses add and delete', () => {
    S().addExpense({ title: 'Lunch', amount: 50, type: 'expense', category: 'food', date: today() });
    expect(S().expenses.length).toBe(1);
    S().deleteExpense(S().expenses[0].id);
    expect(S().expenses).toEqual([]);
  });

  it('savings goals accumulate', () => {
    S().addSavingsGoal({ title: 'Trip', targetAmount: 1000, currentAmount: 0 });
    S().updateSavingsGoal(S().savingsGoals[0].id, 200);
    expect(S().savingsGoals[0].currentAmount).toBe(200);
  });

  it('hydration accumulates into today\'s health record', () => {
    S().addHydration(250);
    S().addHydration(250);
    expect(S().healthMetrics[today()].hydrationMl).toBe(500);
  });

  it('journal entries save and persist', () => {
    S().saveJournalEntry({ date: today(), whatWentWell: 'x', whatDrainedEnergy: '', planForTomorrow: '', gratitudeList: [], mood: 4, isEncrypted: false } as any);
    expect(S().journalEntries.length).toBe(1);
    expect(NuqtaStorageEngine.getJournalEntries().length).toBe(1);
  });
});

// ------------------------------------------------ J. SETTINGS & NAVIGATION

describe('J. Settings & navigation', () => {
  it('nav tab switching and profile updates persist', () => {
    S().setActiveNavTab('goals');
    expect(S().activeNavTab).toBe('goals');
    S().updateProfileName('Sam');
    S().setTheme('light');
    expect(NuqtaStorageEngine.getProfile().name).toBe('Sam');
    expect(NuqtaStorageEngine.getProfile().theme).toBe('light');
  });
});

// ------------------------------------------------ CROSS-MODULE JOURNEY

describe('Cross-module integration journey', () => {
  it('goal -> link task+habit -> complete -> progress, history and dashboard all agree', () => {
    S().createGoal({ title: 'Ship v1' });
    const goalId = S().goals[0].id;
    S().createTask({ title: 'Write spec' });
    const taskId = S().tasks[0].id;
    S().createHabit({ name: 'Read daily', specializedType: 'reading', frequency: 'daily', category: 'learning', timeOfDay: 'evening', anchor: '' } as any);
    const habitId = S().habits[0].id;

    S().linkActivityToGoal(goalId, 'task', taskId);
    S().linkActivityToGoal(goalId, 'habit', habitId);

    S().toggleTaskStatus(taskId);
    S().toggleHabitToday(habitId);

    const goal = S().goals.find((g) => g.id === goalId)!;
    const summary = evaluateGoalProgress(goal, S().tasks, S().habits);
    expect(summary.executionSummary.tasksTotal).toBe(1);
    expect(summary.executionSummary.tasksCompleted).toBe(1);
    expect(summary.linkedHabitsCount).toBe(1);

    // History sees the completion
    const history = generateUniversalHistory({
      tasks: S().tasks, habits: S().habits, goals: S().goals, focusSessions: S().focusSessions,
      journalEntries: S().journalEntries, expenses: S().expenses, sundayReviews: S().sundayReviews,
      historyAuditLogs: S().historyAuditLogs
    });
    expect(history.some((e) => e.entityId === taskId && e.eventType === 'completed')).toBe(true);
    expect(history.some((e) => e.entityId === habitId)).toBe(true);

    // Dashboard sees the completed task
    const rep = computeLifeIntelligence('today', S().tasks, S().habits, S().goals, S().focusSessions, false);
    expect(rep.productivity.tasksCompleted.currentValue).toBe(1);
  });

  it('AUDIT FINDING: unlinking a habit from a goal leaves its reading sessions in the goal contribution feed via habit link only', () => {
    // Documented behaviour probe: after unlink, the goal no longer counts the habit.
    S().createGoal({ title: 'G' });
    S().createHabit({ name: 'Read', specializedType: 'reading', frequency: 'daily', category: 'learning', timeOfDay: 'evening', anchor: '' } as any);
    const goalId = S().goals[0].id;
    const habitId = S().habits[0].id;
    S().linkActivityToGoal(goalId, 'habit', habitId);
    expect(evaluateGoalProgress(S().goals[0], [], S().habits).linkedHabitsCount).toBe(1);
    S().unlinkActivityFromGoal(goalId, 'habit', habitId);
    expect(evaluateGoalProgress(S().goals[0], [], S().habits).linkedHabitsCount).toBe(0);
  });
});

// ------------------------------------------------ K. RECURRENCE SERIES

describe('K. Task recurrence series', () => {
  it('creating a recurring task materialises a bounded series with shared identity', () => {
    S().createTask({ title: 'Weekly review', priority: 2, scheduledDate: today(), recurrence: { freq: 'weekly', days: [new Date().getDay()] } });
    const series = S().tasks.filter((t) => t.title === 'Weekly review');
    expect(series.length).toBeGreaterThan(1);
    const ids = new Set(series.map((t) => t.seriesId));
    expect(ids.size).toBe(1);
    expect(series.every((t) => t.recurrence?.freq === 'weekly')).toBe(true);
    // Every occurrence is a distinct record on its own day.
    expect(new Set(series.map((t) => t.scheduledDate)).size).toBe(series.length);
  });

  it('topping up is idempotent: no duplicate days are created', () => {
    S().createTask({ title: 'Daily standup', priority: 3, scheduledDate: today(), recurrence: { freq: 'daily' } });
    const before = S().tasks.length;
    S().topUpRecurringTasks();
    S().topUpRecurringTasks();
    expect(S().tasks.length).toBe(before);
  });

  it('skipping one occurrence only affects that occurrence and is not a completion', () => {
    S().createTask({ title: 'Gym', priority: 2, scheduledDate: today(), recurrence: { freq: 'daily' } });
    const series = S().tasks.filter((t) => t.title === 'Gym');
    const target = series[0];
    S().skipTaskOccurrence(target.id);
    const updated = S().tasks.find((t) => t.id === target.id)!;
    expect(updated.status).toBe('skipped');
    // Siblings are untouched.
    expect(S().tasks.filter((t) => t.title === 'Gym' && t.status === 'todo').length).toBe(series.length - 1);
  });

  it('editing the series updates open occurrences but not completed ones', () => {
    S().createTask({ title: 'Read', priority: 2, scheduledDate: today(), recurrence: { freq: 'daily' } });
    const series = S().tasks.filter((t) => t.title === 'Read');
    const seriesId = series[0].seriesId!;
    S().toggleTaskStatus(series[0].id); // complete the first occurrence
    S().updateTaskSeries(seriesId, { title: 'Read deeply' });
    const after = S().tasks.filter((t) => t.seriesId === seriesId);
    expect(after.find((t) => t.id === series[0].id)!.title).toBe('Read'); // completed untouched
    expect(after.filter((t) => t.status === 'todo').every((t) => t.title === 'Read deeply')).toBe(true);
  });

  it('deleting a series removes every occurrence', () => {
    S().createTask({ title: 'Meditate', priority: 2, scheduledDate: today(), recurrence: { freq: 'daily' } });
    const seriesId = S().tasks.find((t) => t.title === 'Meditate')!.seriesId!;
    S().deleteTaskSeries(seriesId);
    expect(S().tasks.some((t) => t.seriesId === seriesId)).toBe(false);
  });

  it('a one-off task carries no series identity', () => {
    S().createTask({ title: 'One-off', priority: 3, scheduledDate: today() });
    const t = S().tasks.find((x) => x.title === 'One-off')!;
    expect(t.seriesId).toBeUndefined();
    expect(t.recurrence).toBeUndefined();
  });
});

