/**
 * PHASE 3 — Data Integrity & Reliability.
 *
 * Regression suite for the referential-integrity defects found while auditing the
 * delete paths. NUQTA stores goal links in two places:
 *   - the goal's own relation lists (`linkedTaskIds`, `linkedHabitIds`,
 *     `linkedBookIds`, `linkedArtProjectIds`), and
 *   - each activity's own `linkedGoalId` — including *nested* studio records
 *     (books, reading sessions, artwork pieces, art projects, Quran/workout
 *     sessions) that copy the parent habit's goal id when they are created.
 *
 * Deleting one side of a link must sweep the other, or the surviving record keeps
 * pointing at something that no longer exists (a dangling reference the backup
 * validator would reject on the next export/import).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import type { Habit } from '../src/types';

const S = () => useNuqtaStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  localStorage.clear();
  S().initializeStore();
});
afterEach(() => vi.useRealTimers());


const book = (id: string) =>
  ({ id, title: id, author: 'A', category: 'mind', totalPages: 100, currentPage: 0, status: 'reading', coverColor: '#000' } as any);
const project = (id: string) =>
  ({ id, title: id, stage: 'in_progress', medium: 'sketch', startedDate: '2026-01-01', totalMinutesSpent: 0, sessionsCount: 0 } as any);

const emptyStudioHabit = (type: 'reading' | 'workout' | 'drawing' | 'quran'): Habit =>
  ({
    id: 'h1', name: type, anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'mind',
    targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
    completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', specializedType: type,
    readingData: type === 'reading' ? { books: [], sessions: [], annualTargetBooks: 12, totalPagesRead: 0, totalReadingMinutes: 0 } as any : undefined,
    workoutData: type === 'workout' ? { sessions: [], customRoutines: [], weeklyTargetSessions: 4, totalVolumeKg: 0, totalMinutes: 0, totalWorkouts: 0, favoriteRoutine: '' } as any : undefined,
    drawingData: type === 'drawing' ? { projects: [], pieces: [], totalDrawingMinutes: 0, totalSketches: 0, favoriteMedium: 'sketch' } as any : undefined,
    quranData: type === 'quran' ? { surahs: [], sessions: [], revisionSchedule: { revisionCycleDays: 7, currentReviewSurahs: [], targetDailyAyahs: 10, weeklyTargetRevisionMinutes: 120 }, totalAyahsMemorized: 0, totalSurahsCompleted: 0, totalMemorizationMinutes: 0, totalRevisionMinutes: 0, dailyTargetAyahs: 10, activeSurahNumber: 1 } as any : undefined
  } as Habit);

/** Seed one studio habit directly into storage and hydrate the store from it. */
const seedStudio = (type: 'reading' | 'workout' | 'drawing' | 'quran'): void => {
  NuqtaStorageEngine.saveHabits([emptyStudioHabit(type)]);
  S().initializeStore();
};

// ------------------------------------------------- D1. deleteGoal sweeps nested links

describe('D1. deleting a goal clears nested studio links too', () => {
  it('clears linkedGoalId from reading books AND reading sessions', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('reading');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'b1', pagesRead: 10, durationMinutes: 20, speedPagesPerHour: 30 } as any);

    expect(S().habits[0].readingData!.books[0].linkedGoalId).toBe(goalId);
    expect(S().habits[0].readingData!.sessions[0].linkedGoalId).toBe(goalId);

    S().deleteGoal(goalId);

    const h = S().habits[0];
    expect(h.linkedGoalId).toBeUndefined();
    expect(h.readingData!.books[0].linkedGoalId).toBeUndefined();
    expect(h.readingData!.sessions[0].linkedGoalId).toBeUndefined();
  });

  it('clears linkedGoalId from artwork pieces and art projects', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('drawing');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().logDrawingSession('h1', { title: 'S', medium: 'sketch', durationMinutes: 30, projectId: 'p1' } as any);

    S().deleteGoal(goalId);

    const h = S().habits[0];
    expect(h.drawingData!.projects![0].linkedGoalId).toBeUndefined();
    expect(h.drawingData!.pieces[0].linkedGoalId).toBeUndefined();
  });

  it('clears linkedGoalId from workout sessions', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('workout');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().logWorkoutSession('h1', { title: 'W', workoutType: 'strength', durationMinutes: 30, volumeKg: 0, intensityRating: 3, exercises: [] } as any);
    expect(S().habits[0].workoutData!.sessions[0].linkedGoalId).toBe(goalId);

    S().deleteGoal(goalId);

    expect(S().habits[0].workoutData!.sessions[0].linkedGoalId).toBeUndefined();
  });

  it('leaves unrelated goals and their activities untouched', () => {
    S().createGoal({ title: 'G1' });
    S().createGoal({ title: 'G2' });
    const [g1, g2] = S().goals.map((g) => g.id);
    seedStudio('reading');
    S().addOrUpdateBook('h1', book('b1'));
    S().addOrUpdateBook('h1', book('b2'));
    S().linkActivityToGoal(g1, 'habit', 'h1');
    S().linkActivityToGoal(g2, 'book', 'b2');

    S().deleteGoal(g1);

    // G2's explicit book link and both books survive the deletion of G1.
    expect(S().goals.find((g) => g.id === g2)!.linkedBookIds).toContain('b2');
    expect(S().habits[0].readingData!.books.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
    expect(S().habits[0].linkedGoalId).toBeUndefined();
  });
});

// ------------------------------------------------- D2. deleting a sub-record prunes the goal list

describe('D2. deleting a linked sub-record prunes the goal relation list', () => {
  it('deleting a book removes it from goal.linkedBookIds', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('reading');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');
    expect(S().goals[0].linkedBookIds).toContain('b1');

    S().deleteBook('h1', 'b1');

    expect(S().goals[0].linkedBookIds ?? []).not.toContain('b1');
  });

  it('deleting an art project removes it from goal.linkedArtProjectIds', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('drawing');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().linkActivityToGoal(goalId, 'artProject', 'p1');
    expect(S().goals[0].linkedArtProjectIds).toContain('p1');

    S().deleteArtProject('h1', 'p1');

    expect(S().goals[0].linkedArtProjectIds ?? []).not.toContain('p1');
  });

  it('deleting a habit removes its own books/projects from every goal list', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('reading');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');

    S().deleteHabit('h1');

    const g = S().goals[0];
    expect(g.linkedHabitIds ?? []).not.toContain('h1');
    expect(g.linkedBookIds ?? []).not.toContain('b1');
  });

  it('deleting a task still removes it from goal.linkedTaskIds', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    S().createTask({ title: 'T' });
    const taskId = S().tasks[0].id;
    S().linkActivityToGoal(goalId, 'task', taskId);
    expect(S().goals[0].linkedTaskIds).toContain(taskId);

    S().deleteTask(taskId);

    expect(S().goals[0].linkedTaskIds ?? []).not.toContain(taskId);
  });
});

// ------------------------------------------------- D3. orphaned nested references

describe('D3. deleting a parent clears its children\'s parent references', () => {
  it('deleting an art project clears the projectId of its logged pieces', () => {
    seedStudio('drawing');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().logDrawingSession('h1', { title: 'S', medium: 'sketch', durationMinutes: 30, projectId: 'p1' } as any);
    expect(S().habits[0].drawingData!.pieces[0].projectId).toBe('p1');

    S().deleteArtProject('h1', 'p1');

    expect(S().habits[0].drawingData!.pieces[0].projectId).toBeUndefined();
  });

  it('deleting the active book re-points activeBookId at a surviving book', () => {
    seedStudio('reading');
    S().addOrUpdateBook('h1', book('b1'));
    S().addOrUpdateBook('h1', book('b2'));
    S().archiveBook('h1', 'b1');

    S().deleteBook('h1', 'b1');

    const reading = S().habits[0].readingData!;
    expect(reading.books.some((b) => b.id === reading.activeBookId)).toBe(true);
  });
});

// ------------------------------------------------- D4. persistence & reload

describe('D4. persistence survives a reload, including the pruned links', () => {
  it('a task created then reloaded is still present', () => {
    S().createTask({ title: 'Persisted', priority: 1 });
    useNuqtaStore.setState({ tasks: [] }); // simulate a full app restart
    S().initializeStore();
    expect(S().tasks.map((t) => t.title)).toContain('Persisted');
    expect(S().tasks[0].priority).toBe(1);
  });

  it('a pruned goal link stays pruned after a reload', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('reading');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');
    S().deleteBook('h1', 'b1');

    useNuqtaStore.setState({ goals: [], habits: [] });
    S().initializeStore();

    expect(S().goals[0].linkedBookIds ?? []).not.toContain('b1');
    expect(NuqtaStorageEngine.getGoals()[0].linkedBookIds ?? []).not.toContain('b1');
  });

  it('after deleting the goal, a clean export passes the strict backup validator', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    seedStudio('reading');
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'b1', pagesRead: 5, durationMinutes: 10, speedPagesPerHour: 30 } as any);

    S().deleteGoal(goalId);

    // No dangling references -> the exported file must validate cleanly.
    expect(NuqtaStorageEngine.validateBackup(NuqtaStorageEngine.exportFullBackup()).ok).toBe(true);
  });
});

// ------------------------------------------------- D5. archive/restore idempotence

describe('D5. archive/restore round-trips never duplicate or corrupt', () => {
  it('archive -> restore -> archive -> restore leaves exactly one task', () => {
    S().createTask({ title: 'T' });
    const id = S().tasks[0].id;
    S().archiveTask(id);
    S().restoreTask(id);
    S().archiveTask(id);
    S().restoreTask(id);
    expect(S().tasks.filter((t) => t.id === id).length).toBe(1);
    expect(NuqtaStorageEngine.getTasks().filter((t) => t.id === id).length).toBe(1);
  });

  it('archive -> restore of a goal keeps exactly one goal with a restored active status', () => {
    S().createGoal({ title: 'G' });
    const id = S().goals[0].id;
    S().archiveGoal(id);
    S().restoreGoal(id);
    expect(S().goals.filter((g) => g.id === id).length).toBe(1);
    expect(S().goals[0].status).toBe('active');
  });
});

// ------------------------------------------------- D6. denormalised aggregates

describe('D6. denormalised aggregates stay in step with deletions', () => {
  it('deleting a book recomputes totalPagesRead and totalReadingMinutes', () => {
    seedStudio('reading');
    S().addOrUpdateBook('h1', book('b1'));
    S().addOrUpdateBook('h1', book('b2'));
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'b1', pagesRead: 10, durationMinutes: 20, speedPagesPerHour: 30 } as any);
    S().logReadingSession('h1', { bookId: 'b2', bookTitle: 'b2', pagesRead: 15, durationMinutes: 30, speedPagesPerHour: 30 } as any);
    expect(S().habits[0].readingData!.totalPagesRead).toBe(25);

    S().deleteBook('h1', 'b1');

    const reading = S().habits[0].readingData!;
    expect(reading.totalPagesRead).toBe(15);
    expect(reading.totalReadingMinutes).toBe(30);
  });

  it('deleting an artwork piece recomputes totalSketches and totalDrawingMinutes', () => {
    seedStudio('drawing');
    S().logDrawingSession('h1', { title: 'S1', medium: 'sketch', durationMinutes: 30 } as any);
    S().logDrawingSession('h1', { title: 'S2', medium: 'sketch', durationMinutes: 45 } as any);
    expect(S().habits[0].drawingData!.totalDrawingMinutes).toBe(75);

    S().deleteArtworkPiece('h1', S().habits[0].drawingData!.pieces[0].id);

    const drawing = S().habits[0].drawingData!;
    expect(drawing.pieces.length).toBe(1);
    expect(drawing.totalSketches).toBe(1);
    expect(drawing.totalDrawingMinutes).toBe(drawing.pieces.reduce((s, p) => s + (p.durationMinutes || 0), 0));
  });
});
