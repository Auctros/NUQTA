import { MuscleMovement, FitnessDifficulty, HomeEquipment } from '../types';

/**
 * Catalog-only vocabulary for the Exercise Library.
 *
 * Nothing in this file is persisted: an exercise the user logs is stored as an
 * `ExerciseEntry` (see src/types), which only carries the legacy
 * `MuscleMovement` / `ExerciseEntry['category']` unions. Keeping the richer
 * vocabulary here means the catalog can grow without touching backupSchema or
 * invalidating saved routines.
 */

/** Fine-grained training category shown on cards, filters and detail pages. */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body'
  | 'mobility'
  | 'warmup';

/** Movement pattern, used for balance analytics and browsing. */
export type MovementPattern =
  | 'push'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'core_stability'
  | 'rotation'
  | 'anti_rotation'
  | 'single_leg'
  | 'mobility'
  | 'cardio'
  | 'carry';

/**
 * Muscle regions the anatomical muscle-map can highlight. Each id resolves to a
 * path in MuscleMap.tsx. `front` regions render on the anterior figure, `back`
 * regions on the posterior figure.
 */
export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'hip_flexors'
  | 'quads'
  | 'calves'
  | 'traps'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'rear_delts'
  | 'triceps'
  | 'glutes'
  | 'hamstrings';

/** Structured, bilingual coaching content attached to a catalog exercise. */
export interface ExerciseCoaching {
  /** Where the body starts, and what it is supported by. */
  startAr: string;
  startEn: string;
  /** Ordered execution steps. */
  stepsAr: string[];
  stepsEn: string[];
  /** Breathing pattern. */
  breathingAr: string;
  breathingEn: string;
  /** Short, high-value form cues. */
  cuesAr: string[];
  cuesEn: string[];
  /** Mistakes that most often break the movement. */
  mistakesAr: string[];
  mistakesEn: string[];
  /** Safety considerations / who should be careful. */
  safetyAr: string;
  safetyEn: string;
  /** An easier regression and a harder progression. */
  easierAr: string;
  easierEn: string;
  harderAr: string;
  harderEn: string;
  /** Suggested volume. Kept deliberately as guidance, not a prescription. */
  volumeAr: string;
  volumeEn: string;
  /** Suggested rest between sets, in seconds. */
  restSeconds: number;
}

/**
 * One exercise in the built-in home library.
 *
 * `id` values are stable and are never persisted, so they may be referenced by
 * illustration keys and tests. Legacy fields (movement / difficulty /
 * equipment / defaultReps / tipsAr) are preserved verbatim for the 14 original
 * entries.
 */
export interface PrebuiltExercise {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Legacy coarse movement, still used for logging + analytics. */
  movement: MuscleMovement;
  difficulty: FitnessDifficulty;
  equipment: HomeEquipment;
  /** Legacy default reps used when inserting into a workout. */
  defaultReps: number;
  /** Legacy one-line tip (Arabic), preserved for existing records. */
  tipsAr: string;
  /** Fine-grained training category. */
  category: MuscleGroup;
  /** Primary target muscles (highlighted strongly on the muscle map). */
  primary: MuscleId[];
  /** Secondary / assisting muscles (softer highlight). */
  secondary: MuscleId[];
  /** Movement pattern. */
  pattern: MovementPattern;
  /** True when the movement is performed one side at a time. */
  unilateral: boolean;
  /** Key into the shared illustration set (see illustration/exerciseArt.ts). */
  illustrationKey: string;
  /** English one-line tip, mirrors `tipsAr`. */
  tipsEn: string;
  coaching: ExerciseCoaching;
}

/**
 * Which side of the body an illustration should present. Posterior-chain moves
 * (hinges, glutes, hamstrings, back) read best from behind; everything else
 * defaults to the front view. Explicit per-illustration `facing` wins.
 */
export const facingForExercise = (e: Pick<PrebuiltExercise, 'category' | 'pattern' | 'primary'>): 'front' | 'back' => {
  const backPatterns: MovementPattern[] = ['hinge', 'carry'];
  if (backPatterns.includes(e.pattern)) return 'back';
  const backPrimary: MuscleId[] = ['glutes', 'hamstrings', 'lats', 'upper_back', 'traps', 'lower_back', 'rear_delts'];
  if (e.primary.some((m) => backPrimary.includes(m))) return 'back';
  return 'front';
};
