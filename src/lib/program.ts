import {
  WorkoutRoutine,
  WorkoutProgram,
  WorkoutProgramStatus,
  TrainingSplit,
  ProgramGoal,
  ProgramDay,
  ProgramWeek,
  ExerciseEntry
} from '../types';
import { ProgramTemplate } from './programTemplates';

/**
 * Pure helpers for the structured Programs workspace.
 *
 * Nothing here touches the store: the UI and the store both read these so the
 * lifecycle, progress maths and label vocabularies can never drift apart.
 */

/** Stable id generator; `crypto.randomUUID` is available in every target. */
export const programId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const PROGRAM_STATUSES: WorkoutProgramStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];

export const SPLIT_LABELS: Record<TrainingSplit, { en: string; ar: string }> = {
  full_body: { en: 'Full body', ar: 'الجسم كامل' },
  upper_lower: { en: 'Upper / Lower', ar: 'أعلى / أسفل' },
  ppl: { en: 'Push · Pull · Legs', ar: 'دفع · سحب · أرجل' },
  push_pull: { en: 'Push / Pull', ar: 'دفع / سحب' },
  bro_split: { en: 'Body-part split', ar: 'تقسيم بالعضلات' },
  custom: { en: 'Custom split', ar: 'تقسيم مخصص' }
};

export const GOAL_LABELS: Record<ProgramGoal, { en: string; ar: string }> = {
  strength: { en: 'Strength', ar: 'القوة' },
  hypertrophy: { en: 'Hypertrophy', ar: 'تضخيم العضلات' },
  endurance: { en: 'Endurance', ar: 'التحمل' },
  fat_loss: { en: 'Fat loss', ar: 'خسارة الدهون' },
  general: { en: 'General fitness', ar: 'لياقة عامة' },
  mobility: { en: 'Mobility', ar: 'المرونة' }
};

export const STATUS_LABELS: Record<WorkoutProgramStatus, { en: string; ar: string }> = {
  draft: { en: 'Draft', ar: 'مسودة' },
  active: { en: 'Active', ar: 'نشط' },
  paused: { en: 'Paused', ar: 'موقوف' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  archived: { en: 'Archived', ar: 'مؤرشف' }
};

export const splitLabel = (s: TrainingSplit, isAr: boolean): string => (isAr ? SPLIT_LABELS[s].ar : SPLIT_LABELS[s].en);
export const goalLabel = (g: ProgramGoal, isAr: boolean): string => (isAr ? GOAL_LABELS[g].ar : GOAL_LABELS[g].en);
export const statusLabel = (s: WorkoutProgramStatus, isAr: boolean): string =>
  isAr ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en;

/** A routine's effective status. Legacy routines (no status) read as active. */
export const routineStatus = (r: WorkoutRoutine): WorkoutProgramStatus => {
  if (r.isArchived) return 'archived';
  return r.status ?? 'active';
};

/** Every exercise across a program, in order (all weeks/days flattened). */
export const programExercises = (program: WorkoutProgram): ExerciseEntry[] =>
  program.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises));

export interface ProgramProgress {
  totalDays: number;
  trainingDays: number;
  restDays: number;
  completedDays: number;
  /** 0..1 */
  ratio: number;
}

/** Progress over a program's days; used by the workspace overview. */
export const programProgress = (program: WorkoutProgram): ProgramProgress => {
  const days = program.weeks.flatMap((w) => w.days);
  const trainingDays = days.filter((d) => !d.isRest);
  const completed = new Set(program.completedDayIds ?? []);
  const completedDays = trainingDays.filter((d) => completed.has(d.id)).length;
  return {
    totalDays: days.length,
    trainingDays: trainingDays.length,
    restDays: days.length - trainingDays.length,
    completedDays,
    ratio: trainingDays.length ? completedDays / trainingDays.length : 0
  };
};

/** Rough session length for a day, from its sets. */
export const estimateDayMinutes = (day: ProgramDay): number => {
  const sets = day.exercises.reduce((a, e) => a + e.sets.length, 0);
  // ~35s of work + the prescribed rest per set, floored at a sensible minimum.
  const rest = day.exercises.reduce((a, e) => a + (e.restSeconds ?? 60) * e.sets.length, 0);
  return Math.max(5, Math.round((sets * 35 + rest) / 60));
};

export const estimateProgramMinutes = (program: WorkoutProgram): number =>
  program.weeks.flatMap((w) => w.days).reduce((a, d) => a + estimateDayMinutes(d), 0);

/** Build a blank program with one week containing the given days. */
export const emptyProgram = (split: TrainingSplit, days: ProgramDay[] = []): WorkoutProgram => ({
  split,
  weeks: [{ id: programId('wk'), days }],
  completedDayIds: []
});

/** Convert a routine template (see programTemplates) into a full program. */
export const programFromTemplate = (template: ProgramTemplate): WorkoutProgram => {
  const week: ProgramWeek = {
    id: programId('wk'),
    days: template.days.map((d) => ({
      id: programId('day'),
      name: d.name,
      nameAr: d.nameAr,
      isRest: d.isRest,
      focus: d.focus,
      exercises: []
    }))
  };
  return {
    split: template.split,
    goal: template.goal,
    durationWeeks: 4,
    frequencyPerWeek: template.days.filter((d) => !d.isRest).length,
    weeks: [week],
    completedDayIds: []
  };
};

/**
 * Flatten a program into the exercise list the flat `WorkoutRoutine.exercises`
 * field needs (used by `WorkoutAppModal` and analytics that predate programs).
 */
export const flattenProgramExercises = (program: WorkoutProgram): ExerciseEntry[] => programExercises(program);

/** A day is empty (and thus invalid to start) when it has no exercises. */
export const dayHasContent = (day: ProgramDay): boolean => !day.isRest && day.exercises.length > 0;
