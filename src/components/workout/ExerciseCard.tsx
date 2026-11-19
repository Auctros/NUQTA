import React from 'react';
import { PrebuiltExercise } from '../../lib/exerciseTypes';
import { categoryLabel, difficultyLabel, muscleLabel } from '../../lib/exerciseCatalog';
import { ExerciseIllustration } from './illustration/ExerciseIllustration';

/**
 * One tile in the exercise library grid: the shared exercise illustration,
 * the exercise name, its primary muscles, and a difficulty indicator.
 *
 * The whole tile is a button — clicking anywhere opens the detail sheet — and
 * the caller can add a separate quick "add" action through `onAdd`.
 */

export interface ExerciseCardProps {
  exercise: PrebuiltExercise;
  isAr: boolean;
  onOpen: (exercise: PrebuiltExercise) => void;
  /** Optional quick action (add to the current workout). */
  onAdd?: (exercise: PrebuiltExercise) => void;
  addLabel?: string;
}

const DIFFICULTY_LEVEL: Record<PrebuiltExercise['difficulty'], number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3
};

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, isAr, onOpen, onAdd, addLabel }) => {
  const name = isAr ? exercise.nameAr : exercise.nameEn;
  const level = DIFFICULTY_LEVEL[exercise.difficulty];
  return (
    <div className="ex-card">
      <button
        type="button"
        onClick={() => onOpen(exercise)}
        className="text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] rounded-[var(--r-sm)]"
        aria-label={name}
      >
        <span className="ex-card-media" aria-hidden="true">
          <ExerciseIllustration illustrationKey={exercise.illustrationKey} isAr={isAr} name={name} />
        </span>
        <span className="block mt-2 ex-card-name">{name}</span>
      </button>

      <div className="ex-card-muscles">
        {exercise.primary.slice(0, 3).map((m) => (
          <span key={m} className="ex-chip ex-chip-primary">
            {muscleLabel(m, isAr)}
          </span>
        ))}
        <span className="ex-chip">{categoryLabel(exercise.category, isAr)}</span>
      </div>

      <div className="ex-card-foot">
        <span className="ex-difficulty">
          <span className={`ex-difficulty-dot ex-difficulty-${level}`} aria-hidden="true" />
          {difficultyLabel(exercise.difficulty, isAr)}
        </span>
        {onAdd ? (
          <button
            type="button"
            onClick={() => onAdd(exercise)}
            className="text-[var(--fs-micro)] text-[var(--studio-accent)] font-[var(--fw-semibold)] hover:underline"
          >
            + {addLabel || (isAr ? 'إضافة' : 'Add')}
          </button>
        ) : (
          <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)] font-mono">
            {exercise.defaultReps} {isAr ? 'تكرار' : 'reps'}
          </span>
        )}
      </div>
    </div>
  );
};
