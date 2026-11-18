import { MuscleMovement, HomeEquipment, ExerciseEntry, WorkoutSessionLog } from '../types';
import { PrebuiltExercise, MuscleId } from './exerciseTypes';
import { UPPER_BODY } from './catalog/upperBody';
import { LOWER_BODY } from './catalog/lowerBody';

/**
 * Single source of truth for the built-in home exercise catalog.
 * Shared by WorkoutAppModal (dashboard/habits entry point) and the Workout
 * Studio so the library is never duplicated or allowed to drift.
 *
 * The data itself lives in ./catalog/*, split by body region so each file stays
 * readable. This module owns the ordering, the derived helpers, and the labels.
 */

export type { PrebuiltExercise } from './exerciseTypes';
export * from './exerciseTypes';

/** Chest → back → shoulders → arms → legs → glutes → core → full body → mobility. */
export const EXERCISE_CATALOG: PrebuiltExercise[] = [...UPPER_BODY, ...LOWER_BODY];

export const MOVEMENT_TO_CATEGORY: Record<MuscleMovement, ExerciseEntry['category']> = {
  push: 'chest',
  legs: 'legs',
  core: 'core',
  cardio: 'cardio',
  mobility: 'mobility',
  back_pull: 'back'
};

/** Build a 3-set exercise entry from a catalog item, ready to log or edit. */
export const exerciseEntryFromCatalog = (catEx: PrebuiltExercise, isAr: boolean): ExerciseEntry => ({
  id: 'ex-' + crypto.randomUUID().slice(0, 6),
  name: isAr ? catEx.nameAr : catEx.nameEn,
  category: MOVEMENT_TO_CATEGORY[catEx.movement],
  movement: catEx.movement,
  sets: [1, 2, 3].map((n) => ({
    setNumber: n,
    weightKg: 0,
    reps: catEx.defaultReps,
    restSeconds: 45,
    completed: true
  }))
});

export const movementLabel = (m: MuscleMovement, isAr: boolean): string => {
  const ar: Record<MuscleMovement, string> = {
    push: 'دفع',
    legs: 'أرجل',
    core: 'جذع',
    back_pull: 'سحب',
    mobility: 'مرونة',
    cardio: 'كارديو'
  };
  const en: Record<MuscleMovement, string> = {
    push: 'Push',
    legs: 'Legs',
    core: 'Core',
    back_pull: 'Pull',
    mobility: 'Mobility',
    cardio: 'Cardio'
  };
  return isAr ? ar[m] : en[m];
};

export const equipmentLabel = (e: HomeEquipment, isAr: boolean): string => {
  const ar: Record<HomeEquipment, string> = {
    bodyweight_only: 'وزن الجسم',
    mat: 'سجادة',
    pullup_bar: 'عقلة',
    resistance_band: 'حبل مقاومة',
    chair_elevated: 'كرسي مرتفع',
    light_dumbbells: 'دمبل خفيف'
  };
  const en: Record<HomeEquipment, string> = {
    bodyweight_only: 'Bodyweight',
    mat: 'Mat',
    pullup_bar: 'Pull-up bar',
    resistance_band: 'Resistance band',
    chair_elevated: 'Elevated chair',
    light_dumbbells: 'Light dumbbells'
  };
  return isAr ? ar[e] : en[e];
};

export const difficultyLabel = (d: PrebuiltExercise['difficulty'], isAr: boolean): string => {
  const ar: Record<PrebuiltExercise['difficulty'], string> = {
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم'
  };
  const en: Record<PrebuiltExercise['difficulty'], string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced'
  };
  return isAr ? ar[d] : en[d];
};

export const categoryLabel = (c: PrebuiltExercise['category'], isAr: boolean): string => {
  const ar: Record<PrebuiltExercise['category'], string> = {
    chest: 'الصدر',
    back: 'الظهر',
    shoulders: 'الكتفان',
    biceps: 'البايسبس',
    triceps: 'الترايسبس',
    forearms: 'الساعدان',
    quadriceps: 'الفخذ الأمامي',
    hamstrings: 'المأبض',
    glutes: 'الألوية',
    calves: 'السمانة',
    core: 'الجذع والبطن',
    full_body: 'الجسم كامل',
    mobility: 'المرونة',
    warmup: 'التسخين'
  };
  const en: Record<PrebuiltExercise['category'], string> = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    quadriceps: 'Quadriceps',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    calves: 'Calves',
    core: 'Core & abs',
    full_body: 'Full body',
    mobility: 'Mobility',
    warmup: 'Warm-up'
  };
  return isAr ? ar[c] : en[c];
};

export const patternLabel = (p: PrebuiltExercise['pattern'], isAr: boolean): string => {
  const ar: Record<PrebuiltExercise['pattern'], string> = {
    push: 'دفع',
    pull: 'سحب',
    squat: 'قرفصاء',
    hinge: 'ثني الحوض',
    lunge: 'طعن',
    core_stability: 'ثبات الجذع',
    rotation: 'تدوير',
    anti_rotation: 'مقاومة الدوران',
    single_leg: 'ساق واحدة',
    mobility: 'حركية',
    cardio: 'كارديو',
    carry: 'حمل'
  };
  const en: Record<PrebuiltExercise['pattern'], string> = {
    push: 'Push',
    pull: 'Pull',
    squat: 'Squat',
    hinge: 'Hinge',
    lunge: 'Lunge',
    core_stability: 'Core stability',
    rotation: 'Rotation',
    anti_rotation: 'Anti-rotation',
    single_leg: 'Single leg',
    mobility: 'Mobility',
    cardio: 'Cardio',
    carry: 'Carry'
  };
  return isAr ? ar[p] : en[p];
};

export const muscleLabel = (m: MuscleId, isAr: boolean): string => {
  const ar: Record<MuscleId, string> = {
    chest: 'الصدر',
    front_delts: 'الكتف الأمامي',
    biceps: 'البايسبس',
    forearms: 'الساعدان',
    abs: 'البطن',
    obliques: 'الجوانب',
    hip_flexors: 'مثنيات الحوض',
    quads: 'الفخذ الأمامي',
    calves: 'السمانة',
    traps: 'الترابيس',
    upper_back: 'أعلى الظهر',
    lats: 'الظهر الجانبي',
    lower_back: 'أسفل الظهر',
    rear_delts: 'الكتف الخلفي',
    triceps: 'الترايسبس',
    glutes: 'الألوية',
    hamstrings: 'المأبض'
  };
  const en: Record<MuscleId, string> = {
    chest: 'Chest',
    front_delts: 'Front delts',
    biceps: 'Biceps',
    forearms: 'Forearms',
    abs: 'Abs',
    obliques: 'Obliques',
    hip_flexors: 'Hip flexors',
    quads: 'Quads',
    calves: 'Calves',
    traps: 'Traps',
    upper_back: 'Upper back',
    lats: 'Lats',
    lower_back: 'Lower back',
    rear_delts: 'Rear delts',
    triceps: 'Triceps',
    glutes: 'Glutes',
    hamstrings: 'Hamstrings'
  };
  return isAr ? ar[m] : en[m];
};

/** Distinct values actually present in the catalog, for building filter menus. */
export const CATALOG_CATEGORIES: PrebuiltExercise['category'][] = Array.from(
  new Set(EXERCISE_CATALOG.map((e) => e.category))
);
export const CATALOG_EQUIPMENT: HomeEquipment[] = Array.from(new Set(EXERCISE_CATALOG.map((e) => e.equipment)));
export const CATALOG_PATTERNS: PrebuiltExercise['pattern'][] = Array.from(
  new Set(EXERCISE_CATALOG.map((e) => e.pattern))
);

/** Resolve a logged exercise name (either language) back to its catalog entry. */
export const catalogExerciseByName = (name: string): PrebuiltExercise | undefined =>
  EXERCISE_CATALOG.find((e) => e.nameAr === name || e.nameEn === name);

/**
 * The catalog exercises a user actually trained most recently, newest first,
 * deduplicated by catalog id. Logged entries only carry a name, so matching is
 * by name — an unknown/renamed exercise is simply skipped.
 */
export const recentlyPerformedExercises = (sessions: WorkoutSessionLog[], limit = 6): PrebuiltExercise[] => {
  const seen = new Set<string>();
  const out: PrebuiltExercise[] = [];
  const newestFirst = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const session of newestFirst) {
    for (const entry of session.exercises) {
      const cat = catalogExerciseByName(entry.name);
      if (cat && !seen.has(cat.id)) {
        seen.add(cat.id);
        out.push(cat);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
};

/**
 * The muscles a routine works, resolved from its exercise names back to the catalog.
 * Entries store names (not ids), so an unknown/renamed exercise is simply skipped.
 * Primary and secondary muscles are unioned across exercises in order of first
 * appearance, so the caller can feed the result straight to the écorché reference.
 */
export const musclesForEntries = (entries: ExerciseEntry[]): { primary: MuscleId[]; secondary: MuscleId[] } => {
  const primary: MuscleId[] = [];
  const secondary: MuscleId[] = [];
  const seenPrimary = new Set<MuscleId>();
  const seenSecondary = new Set<MuscleId>();
  for (const entry of entries) {
    const cat = catalogExerciseByName(entry.name);
    if (!cat) continue;
    for (const m of cat.primary) {
      if (!seenPrimary.has(m)) {
        seenPrimary.add(m);
        primary.push(m);
      }
    }
    for (const m of cat.secondary) {
      if (!seenPrimary.has(m) && !seenSecondary.has(m)) {
        seenSecondary.add(m);
        secondary.push(m);
      }
    }
  }
  return { primary, secondary };
};
