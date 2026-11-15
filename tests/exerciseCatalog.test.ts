import { describe, it, expect } from 'vitest';
import {
  EXERCISE_CATALOG,
  exerciseEntryFromCatalog,
  categoryLabel,
  muscleLabel,
  difficultyLabel,
  patternLabel
} from '../src/lib/exerciseCatalog';
import { getIllustration, ILLUSTRATION_KEYS } from '../src/components/workout/illustration/registry';
import { MUSCLE_IDS } from '../src/components/workout/MuscleMap';

/**
 * The Exercise Library promise is "every exercise has a visual demonstration,
 * a muscle map, and real instructional content". These assertions are what
 * stops that promise from silently rotting as the catalog grows.
 */
describe('exercise catalog integrity', () => {
  it('is a substantial library', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(48);
  });

  it('has unique ids', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has an illustration registered for its key', () => {
    const missing = EXERCISE_CATALOG.filter((e) => !getIllustration(e.illustrationKey));
    expect(missing.map((e) => `${e.id} -> ${e.illustrationKey}`)).toEqual([]);
  });

  it('every illustration key in the registry is a real illustration', () => {
    for (const key of ILLUSTRATION_KEYS) {
      const illo = getIllustration(key);
      expect(illo, key).toBeTruthy();
      expect(illo!.phases.length, key).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has at least one primary muscle and only known muscle ids', () => {
    const known = new Set<string>(MUSCLE_IDS);
    for (const e of EXERCISE_CATALOG) {
      expect(e.primary.length, e.id).toBeGreaterThan(0);
      for (const m of [...e.primary, ...e.secondary]) {
        expect(known.has(m), `${e.id} uses unknown muscle "${m}"`).toBe(true);
      }
    }
  });

  it('primary and secondary do not overlap', () => {
    for (const e of EXERCISE_CATALOG) {
      const overlap = e.primary.filter((m) => e.secondary.includes(m));
      expect(overlap, e.id).toEqual([]);
    }
  });

  it('every entry carries bilingual instructional content', () => {
    for (const e of EXERCISE_CATALOG) {
      const c = e.coaching;
      expect(e.nameAr.length, e.id).toBeGreaterThan(0);
      expect(e.nameEn.length, e.id).toBeGreaterThan(0);
      expect(e.tipsAr.length, e.id).toBeGreaterThan(0);
      expect(e.tipsEn.length, e.id).toBeGreaterThan(0);
      expect(c.startAr.length && c.startEn.length, e.id).toBeTruthy();
      expect(c.stepsAr.length, e.id).toBeGreaterThanOrEqual(3);
      expect(c.stepsEn.length, e.id).toBe(c.stepsAr.length);
      expect(c.cuesAr.length, e.id).toBeGreaterThanOrEqual(2);
      expect(c.cuesEn.length, e.id).toBe(c.cuesAr.length);
      expect(c.mistakesAr.length, e.id).toBeGreaterThanOrEqual(2);
      expect(c.mistakesEn.length, e.id).toBe(c.mistakesAr.length);
      expect(c.safetyAr.length && c.safetyEn.length, e.id).toBeTruthy();
      expect(c.easierAr.length && c.harderAr.length, e.id).toBeTruthy();
      expect(c.volumeAr.length && c.volumeEn.length, e.id).toBeTruthy();
      expect(c.restSeconds, e.id).toBeGreaterThan(0);
    }
  });

  it('preserves the 14 original catalog ids with their original fields', () => {
    const legacy = {
      'cat-push-1': { movement: 'push', difficulty: 'intermediate', equipment: 'bodyweight_only', defaultReps: 15 },
      'cat-push-2': { movement: 'push', difficulty: 'advanced', equipment: 'bodyweight_only', defaultReps: 10 },
      'cat-push-3': { movement: 'push', difficulty: 'beginner', equipment: 'chair_elevated', defaultReps: 12 },
      'cat-legs-1': { movement: 'legs', difficulty: 'beginner', equipment: 'bodyweight_only', defaultReps: 20 },
      'cat-legs-2': { movement: 'legs', difficulty: 'intermediate', equipment: 'chair_elevated', defaultReps: 12 },
      'cat-legs-3': { movement: 'legs', difficulty: 'beginner', equipment: 'mat', defaultReps: 20 },
      'cat-core-1': { movement: 'core', difficulty: 'intermediate', equipment: 'mat', defaultReps: 45 },
      'cat-core-2': { movement: 'core', difficulty: 'intermediate', equipment: 'bodyweight_only', defaultReps: 25 },
      'cat-core-3': { movement: 'core', difficulty: 'intermediate', equipment: 'mat', defaultReps: 15 },
      'cat-mob-1': { movement: 'mobility', difficulty: 'beginner', equipment: 'mat', defaultReps: 15 },
      'cat-mob-2': { movement: 'mobility', difficulty: 'beginner', equipment: 'mat', defaultReps: 30 },
      'cat-mob-3': { movement: 'mobility', difficulty: 'beginner', equipment: 'mat', defaultReps: 60 },
      'cat-cardio-1': { movement: 'cardio', difficulty: 'beginner', equipment: 'bodyweight_only', defaultReps: 40 },
      'cat-cardio-2': { movement: 'cardio', difficulty: 'intermediate', equipment: 'bodyweight_only', defaultReps: 30 }
    } as const;
    for (const [id, fields] of Object.entries(legacy)) {
      const found = EXERCISE_CATALOG.find((e) => e.id === id);
      expect(found, `missing legacy id ${id}`).toBeTruthy();
      expect(found!.movement).toBe(fields.movement);
      expect(found!.difficulty).toBe(fields.difficulty);
      expect(found!.equipment).toBe(fields.equipment);
      expect(found!.defaultReps).toBe(fields.defaultReps);
    }
  });

  it('builds a loggable entry that passes the persisted shape', () => {
    for (const e of EXERCISE_CATALOG) {
      const entry = exerciseEntryFromCatalog(e, false);
      expect(entry.id.startsWith('ex-')).toBe(true);
      expect(entry.name).toBe(e.nameEn);
      expect(entry.movement).toBe(e.movement);
      expect(entry.sets).toHaveLength(3);
      for (const s of entry.sets) {
        expect(s.reps).toBe(e.defaultReps);
        expect(typeof s.completed).toBe('boolean');
      }
    }
  });

  it('produces Arabic names and labels for every entry', () => {
    for (const e of EXERCISE_CATALOG) {
      const entry = exerciseEntryFromCatalog(e, true);
      expect(entry.name).toBe(e.nameAr);
      expect(categoryLabel(e.category, true)).not.toBe(categoryLabel(e.category, false));
      expect(difficultyLabel(e.difficulty, true)).not.toBe(difficultyLabel(e.difficulty, false));
      expect(patternLabel(e.pattern, true).length).toBeGreaterThan(0);
      for (const m of e.primary) expect(muscleLabel(m, true).length).toBeGreaterThan(0);
    }
  });
});

describe('catalog illustration coverage', () => {
  it('every catalog exercise resolves to a real illustration', () => {
    const missing = EXERCISE_CATALOG.filter((e) => !e.illustrationKey || !ILLUSTRATION_KEYS.includes(e.illustrationKey)).map(
      (e) => `${e.nameEn} → ${e.illustrationKey ?? '(none)'}`
    );
    expect(missing).toEqual([]);
  });

  it('has no orphan illustrations', () => {
    const used = new Set(EXERCISE_CATALOG.map((e) => e.illustrationKey));
    expect(ILLUSTRATION_KEYS.filter((k) => !used.has(k))).toEqual([]);
  });
});
