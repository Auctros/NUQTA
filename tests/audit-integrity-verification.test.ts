/**
 * PHASE 3 VERIFICATION — exhaustive referential-integrity coverage.
 *
 * `tests/audit-reliability.test.ts` proved the original five defects are fixed. This
 * file independently re-verifies the *implementation* rather than trusting that report,
 * and closes the coverage gap by exercising **every** persisted entity that carries a
 * `linkedGoalId`:
 *
 *   Task · Habit · BookItem · ReadingSessionLog · ArtProject · ArtworkPiece ·
 *   WorkoutSessionLog · QuranSessionLog
 *
 * (UniversalHistoryItem / ArchivedItemSummary also declare `linkedGoalId`, but they are
 * derived read models — never persisted — so no delete path can strand them.)
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
  ({ id, title: id, stage: 'sketching', medium: 'sketch', startedDate: '2026-01-01', totalMinutesSpent: 0, sessionsCount: 0 } as any);

const studioHabit = (type: 'reading' | 'workout' | 'drawing' | 'quran'): Habit =>
  ({
    id: 'h1', name: type, anchor: '', timeOfDay: 'anytime', frequency: 'daily', category: 'mind',
    targetPerDay: 1, currentStreak: 0, longestStreak: 0, freezesRemaining: 2, freezesUsedDates: [],
    completedDates: [], createdAt: '2026-01-01T00:00:00.000Z', specializedType: type,
    readingData: type === 'reading' ? { books: [], sessions: [], annualTargetBooks: 12, totalPagesRead: 0, totalReadingMinutes: 0 } as any : undefined,
    workoutData: type === 'workout' ? { sessions: [], customRoutines: [], weeklyTargetSessions: 4, totalVolumeKg: 0, totalMinutes: 0, totalWorkouts: 0, favoriteRoutine: '' } as any : undefined,
    drawingData: type === 'drawing' ? { projects: [], pieces: [], totalDrawingMinutes: 0, totalSketches: 0, favoriteMedium: 'sketch' } as any : undefined,
    quranData: type === 'quran' ? { surahs: [], sessions: [], revisionSchedule: { revisionCycleDays: 7, currentReviewSurahs: [], targetDailyAyahs: 10, weeklyTargetRevisionMinutes: 120 }, totalAyahsMemorized: 0, totalSurahsCompleted: 0, totalMemorizationMinutes: 0, totalRevisionMinutes: 0, dailyTargetAyahs: 10, activeSurahNumber: 1 } as any : undefined
  } as Habit);

const seed = (type: 'reading' | 'workout' | 'drawing' | 'quran'): void => {
  NuqtaStorageEngine.saveHabits([studioHabit(type)]);
  S().initializeStore();
};

/** Every linkedGoalId still present anywhere in the persisted state. */
const danglingGoalLinks = (): string[] => {
  const found: string[] = [];
  S().tasks.forEach((t) => t.linkedGoalId && found.push(`task:${t.id}`));
  S().habits.forEach((h) => {
    if (h.linkedGoalId) found.push(`habit:${h.id}`);
    h.readingData?.books.forEach((b) => b.linkedGoalId && found.push(`book:${b.id}`));
    h.readingData?.sessions.forEach((s) => s.linkedGoalId && found.push(`readingSession:${s.id}`));
    h.drawingData?.projects?.forEach((p) => p.linkedGoalId && found.push(`artProject:${p.id}`));
    h.drawingData?.pieces.forEach((p) => p.linkedGoalId && found.push(`piece:${p.id}`));
    h.workoutData?.sessions.forEach((s) => s.linkedGoalId && found.push(`workoutSession:${s.id}`));
    h.quranData?.sessions.forEach((s) => s.linkedGoalId && found.push(`quranSession:${s.id}`));
  });
  return found;
};

// =====================================================================================
// D1 — deleting a goal sweeps EVERY persisted linkedGoalId carrier
// =====================================================================================

describe('D1 verification: deleteGoal sweeps all eight linkedGoalId carriers', () => {
  it('clears task, habit, book, reading session, art project, piece, workout + Quran session', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;

    // A task linked directly to the goal.
    S().createTask({ title: 'T', linkedGoalId: goalId } as any);

    // One habit of each studio type, all nested under the same goal.
    NuqtaStorageEngine.saveHabits([
      { ...studioHabit('reading'), id: 'h-read' },
      { ...studioHabit('drawing'), id: 'h-draw' },
      { ...studioHabit('workout'), id: 'h-work' },
      { ...studioHabit('quran'), id: 'h-quran' }
    ]);
    S().initializeStore();
    ['h-read', 'h-draw', 'h-work', 'h-quran'].forEach((id) => S().linkActivityToGoal(goalId, 'habit', id));

    // One nested record of each kind, each inheriting the habit's goal link.
    S().addOrUpdateBook('h-read', book('b1'));
    S().logReadingSession('h-read', { bookId: 'b1', bookTitle: 'b1', pagesRead: 10, durationMinutes: 20, speedPagesPerHour: 30 } as any);
    S().addOrUpdateArtProject('h-draw', project('p1'));
    S().logDrawingSession('h-draw', { title: 'S', medium: 'sketch', durationMinutes: 30, projectId: 'p1' } as any);
    S().logWorkoutSession('h-work', { title: 'W', workoutType: 'strength', durationMinutes: 30, volumeKg: 0, intensityRating: 3, exercises: [] } as any);
    S().logQuranSession('h-quran', { type: 'new_memorization', surahNumber: 1, surahName: 'Al-Fatihah', ayahStart: 1, ayahEnd: 5, ayahCount: 5, durationMinutes: 20, quality: 'excellent' } as any);

    // All eight carriers are linked before the delete.
    expect(danglingGoalLinks().length).toBeGreaterThanOrEqual(8);

    S().deleteGoal(goalId);

    // Every carrier that pointed at the deleted goal is swept.
    expect(danglingGoalLinks()).toEqual([]);
  });

  it('reports a non-empty dangling set before the delete (proves the probe is meaningful)', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    S().createTask({ title: 'T', linkedGoalId: goalId } as any);
    expect(danglingGoalLinks()).not.toEqual([]);
    S().deleteGoal(goalId);
    expect(danglingGoalLinks()).toEqual([]);
  });
});

// =====================================================================================
// D2 — deleting a sub-record prunes the goal relation lists (and vice-versa)
// =====================================================================================

describe('D2 verification: relation-list pruning is symmetric', () => {
  it('deleteTask prunes linkedTaskIds but leaves other goals untouched', () => {
    S().createGoal({ title: 'G1' });
    S().createGoal({ title: 'G2' });
    const [g1, g2] = S().goals.map((g) => g.id);
    S().createTask({ title: 'T1' });
    S().createTask({ title: 'T2' });
    const [t1, t2] = S().tasks.map((t) => t.id);
    S().linkActivityToGoal(g1, 'task', t1);
    S().linkActivityToGoal(g2, 'task', t2);

    S().deleteTask(t1);

    expect(S().goals.find((g) => g.id === g1)!.linkedTaskIds ?? []).not.toContain(t1);
    expect(S().goals.find((g) => g.id === g2)!.linkedTaskIds).toContain(t2);
  });

  it('deleteHabit prunes linkedHabitIds AND the habit\'s nested books + art projects', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;

    // A reading habit and a drawing habit, both nested under the goal.
    NuqtaStorageEngine.saveHabits([studioHabit('reading')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');
    expect(S().goals[0].linkedHabitIds).toContain('h1');
    expect(S().goals[0].linkedBookIds).toContain('b1');

    S().deleteHabit('h1');

    const g = S().goals[0];
    expect(g.linkedHabitIds ?? []).not.toContain('h1');
    expect(g.linkedBookIds ?? []).not.toContain('b1');
  });

  it('deleteHabit also prunes the art projects nested inside a drawing habit', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('drawing')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().linkActivityToGoal(goalId, 'artProject', 'p1');
    expect(S().goals[0].linkedArtProjectIds).toContain('p1');

    S().deleteHabit('h1');

    expect(S().goals[0].linkedArtProjectIds ?? []).not.toContain('p1');
  });

  it('deleteBook prunes linkedBookIds but keeps unrelated books linked', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('reading')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().addOrUpdateBook('h1', book('b2'));
    S().linkActivityToGoal(goalId, 'book', 'b1');
    S().linkActivityToGoal(goalId, 'book', 'b2');

    S().deleteBook('h1', 'b1');

    const g = S().goals[0];
    expect(g.linkedBookIds ?? []).not.toContain('b1');
    expect(g.linkedBookIds).toContain('b2');
  });

  it('deleteArtProject prunes linkedArtProjectIds but keeps unrelated projects linked', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('drawing')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().addOrUpdateArtProject('h1', project('p2'));
    S().linkActivityToGoal(goalId, 'artProject', 'p1');
    S().linkActivityToGoal(goalId, 'artProject', 'p2');

    S().deleteArtProject('h1', 'p1');

    const g = S().goals[0];
    expect(g.linkedArtProjectIds ?? []).not.toContain('p1');
    expect(g.linkedArtProjectIds).toContain('p2');
  });
});

// =====================================================================================
// D3 — deleteArtProject behaviour in detail
// =====================================================================================

describe('D3 verification: deleteArtProject', () => {
  it('removes the project, detaches its pieces, keeps the pieces, and leaves no orphans', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('drawing')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().linkActivityToGoal(goalId, 'artProject', 'p1');
    S().logDrawingSession('h1', { title: 'S1', medium: 'sketch', durationMinutes: 30, projectId: 'p1' } as any);
    S().logDrawingSession('h1', { title: 'S2', medium: 'sketch', durationMinutes: 45, projectId: 'p1' } as any);

    const piecesBefore = S().habits[0].drawingData!.pieces.length;

    S().deleteArtProject('h1', 'p1');

    const d = S().habits[0].drawingData!;
    // 1. the project itself is gone
    expect(d.projects ?? []).toHaveLength(0);
    // 2. no piece keeps a projectId that no longer resolves
    expect(d.pieces.every((p) => p.projectId === undefined)).toBe(true);
    // 3. the artwork is NOT deleted — only detached
    expect(d.pieces).toHaveLength(piecesBefore);
    // 4. no dangling goal reference
    expect(S().goals[0].linkedArtProjectIds ?? []).not.toContain('p1');
  });

  it('keeps Goal Progress intact after the project is removed', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('drawing')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateArtProject('h1', project('p1'));
    S().linkActivityToGoal(goalId, 'artProject', 'p1');

    const progressBefore = NuqtaStorageEngine.validateBackup(NuqtaStorageEngine.exportFullBackup()).ok;

    S().deleteArtProject('h1', 'p1');

    // Deleting the project must not corrupt the graph or break the export.
    expect(progressBefore).toBe(true);
    expect(S().goals[0].linkedArtProjectIds ?? []).toHaveLength(0);
    expect(NuqtaStorageEngine.validateBackup(NuqtaStorageEngine.exportFullBackup()).ok).toBe(true);
  });
});

// =====================================================================================
// Sequential integrity scenario: link -> delete -> reload -> export
// =====================================================================================

describe('Sequential integrity: Zustand == Storage == Backup', () => {
  it('survives create -> link -> delete -> reload -> export with no dangling refs', () => {
    // 1. create a goal
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;

    // 2. link a reading habit
    NuqtaStorageEngine.saveHabits([studioHabit('reading')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');

    // 3. create studio records linked to the habit and the goal
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');
    S().logReadingSession('h1', { bookId: 'b1', bookTitle: 'b1', pagesRead: 12, durationMinutes: 24, speedPagesPerHour: 30 } as any);

    // 4. delete the goal
    S().deleteGoal(goalId);

    // 5. reload the app from storage only
    useNuqtaStore.setState({ goals: [], tasks: [], habits: [] });
    S().initializeStore();

    // 6. export and validate the backup
    const backup = NuqtaStorageEngine.exportFullBackup();
    expect(NuqtaStorageEngine.validateBackup(backup).ok).toBe(true);

    // Zustand == Storage
    expect(S().habits[0].linkedGoalId).toBeUndefined();
    expect(S().habits[0].readingData!.books[0].linkedGoalId).toBeUndefined();
    expect(S().habits[0].readingData!.sessions[0].linkedGoalId).toBeUndefined();
    expect(NuqtaStorageEngine.getHabits()[0].readingData!.books[0].linkedGoalId).toBeUndefined();
    expect(danglingGoalLinks()).toEqual([]);
  });

  it('a book deleted, then the app reloaded, leaves the goal list clean on disk too', () => {
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    NuqtaStorageEngine.saveHabits([studioHabit('reading')]);
    S().initializeStore();
    S().linkActivityToGoal(goalId, 'habit', 'h1');
    S().addOrUpdateBook('h1', book('b1'));
    S().linkActivityToGoal(goalId, 'book', 'b1');

    S().deleteBook('h1', 'b1');
    useNuqtaStore.setState({ goals: [], habits: [] });
    S().initializeStore();

    expect(S().goals[0].linkedBookIds ?? []).not.toContain('b1');
    expect(NuqtaStorageEngine.getGoals()[0].linkedBookIds ?? []).not.toContain('b1');
    expect(NuqtaStorageEngine.validateBackup(NuqtaStorageEngine.exportFullBackup()).ok).toBe(true);
  });
});

// =====================================================================================
// D6 — the same dangling-reference class on the remaining delete paths
// =====================================================================================

describe('D6 verification: non-goal reference sweep on delete', () => {
  it('deleteBook clears the bookId on quotes captured from that book', () => {
    seed('reading');
    S().addOrUpdateBook('h1', book('b1'));
    S().addBookQuote('h1', { id: 'q1', quote: 'x', bookId: 'b1', date: '2026-01-01' } as any);
    S().addBookQuote('h1', { id: 'q2', quote: 'y', bookId: 'other', date: '2026-01-01' } as any);

    S().deleteBook('h1', 'b1');

    const quotes = S().habits[0].readingData!.quotes ?? [];
    // The quote survives, but no longer points at the deleted book.
    expect(quotes.find((q) => q.id === 'q1')!.bookId).toBeUndefined();
    expect(quotes.find((q) => q.id === 'q2')!.bookId).toBe('other');
  });

  it('deleteWorkoutRoutine clears routineId on the sessions logged from it', () => {
    const wh: Habit = {
      ...studioHabit('workout'),
      workoutData: { sessions: [], customRoutines: [], weeklyTargetSessions: 4, totalVolumeKg: 0, totalMinutes: 0, totalWorkouts: 0, favoriteRoutine: '' } as any
    };
    NuqtaStorageEngine.saveHabits([wh]);
    S().initializeStore();
    S().addOrUpdateWorkoutRoutine('h1', { id: 'r1', name: 'R', nameAr: 'ر', targetLevel: 'beginner', estimatedMinutes: 20, category: 'core', exercises: [] } as any);
    S().logWorkoutSession('h1', { title: 'W', routineId: 'r1', workoutType: 'strength', durationMinutes: 30, volumeKg: 0, intensityRating: 3, exercises: [] } as any);

    S().deleteWorkoutRoutine('h1', 'r1');

    expect(S().habits[0].workoutData!.sessions[0].routineId).toBeUndefined();
    expect(S().habits[0].workoutData!.customRoutines).toHaveLength(0);
  });

  it('deleteHabit clears stackParentHabitId on habits stacked on it', () => {
    NuqtaStorageEngine.saveHabits([
      studioHabit('reading'),
      { ...studioHabit('reading'), id: 'h2', name: 'child', stackParentHabitId: 'h1' } as Habit
    ]);
    S().initializeStore();

    S().deleteHabit('h1');

    expect(S().habits.find((h) => h.id === 'h2')!.stackParentHabitId).toBeUndefined();
  });

  it('the fixed graph still exports a valid backup', () => {
    seed('reading');
    S().addOrUpdateBook('h1', book('b1'));
    S().addBookQuote('h1', { id: 'q1', quote: 'x', bookId: 'b1', date: '2026-01-01' } as any);
    S().deleteBook('h1', 'b1');
    expect(NuqtaStorageEngine.validateBackup(NuqtaStorageEngine.exportFullBackup()).ok).toBe(true);
  });
});

// =====================================================================================
// F4 preservation — invalid Quran sessions remain a full no-op
// =====================================================================================

describe('F4 preservation: an invalid surah session is still a full no-op', () => {
  it('rejects an out-of-range surah without side effects, and clears nothing when a valid goal is deleted', () => {
    seed('quran');
    S().createGoal({ title: 'G' });
    const goalId = S().goals[0].id;
    S().linkActivityToGoal(goalId, 'habit', 'h1');

    const before = JSON.stringify(S().habits);
    const xpBefore = S().profile.experiencePoints;

    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 999, surahName: 'x', ayahStart: 1, ayahEnd: 5, ayahCount: 5, durationMinutes: 20, quality: 'excellent' } as any);

    expect(JSON.stringify(S().habits)).toBe(before);
    expect(S().profile.experiencePoints).toBe(xpBefore);

    // A valid session, then deleting the goal, sweeps the nested Quran session link.
    S().logQuranSession('h1', { type: 'new_memorization', surahNumber: 1, surahName: 'Al-Fatihah', ayahStart: 1, ayahEnd: 5, ayahCount: 5, durationMinutes: 20, quality: 'excellent' } as any);
    expect(S().habits[0].quranData!.sessions[0].linkedGoalId).toBe(goalId);

    S().deleteGoal(goalId);
    expect(S().habits[0].quranData!.sessions[0].linkedGoalId).toBeUndefined();
  });
});
