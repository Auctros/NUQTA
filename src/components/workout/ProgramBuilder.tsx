import React, { useState } from 'react';
import { WorkoutRoutine, WorkoutProgramStatus, ExerciseEntry, ProgramDay } from '../../types';
import { Button } from '../ui';
import { NuqtaIcon } from '../NuqtaIcon';
import { ExerciseCatalog } from './ExerciseCatalog';
import { PrebuiltExercise, exerciseEntryFromCatalog } from '../../lib/exerciseCatalog';
import { estimateDayMinutes, splitLabel, statusLabel } from '../../lib/program';

/**
 * The day-level workspace for one program.
 *
 * A program is only useful if its days are actionable: this panel expands a
 * routine into its weeks and days, lets the user fill a training day from the
 * exercise library, tick days off as they are trained, and start a single day
 * as a session. Everything is driven by the store callbacks the parent passes
 * in, so persistence, archive state and analytics stay in one place.
 */

export interface ProgramBuilderProps {
  routine: WorkoutRoutine;
  isAr: boolean;
  onUpdateDay: (dayId: string, exercises: ExerciseEntry[]) => void;
  onToggleDayComplete: (dayId: string, completed: boolean) => void;
  onSetStatus: (status: WorkoutProgramStatus) => void;
  onStartDay: (day: ProgramDay) => void;
  onDelete: () => void;
}

const STATUS_FLOW: WorkoutProgramStatus[] = ['draft', 'active', 'paused', 'completed'];

export const ProgramBuilder: React.FC<ProgramBuilderProps> = ({
  routine,
  isAr,
  onUpdateDay,
  onToggleDayComplete,
  onSetStatus,
  onStartDay,
  onDelete
}) => {
  const program = routine.program!;
  const [openDay, setOpenDay] = useState<string | null>(null);
  const completed = new Set(program.completedDayIds ?? []);
  const days = program.weeks.flatMap((w) => w.days);
  const status = routine.status ?? 'active';

  const addExercise = (day: ProgramDay, ex: PrebuiltExercise) => {
    const entry = exerciseEntryFromCatalog(ex, isAr);
    onUpdateDay(day.id, [...day.exercises, entry]);
  };

  const removeExercise = (day: ProgramDay, id: string) => {
    onUpdateDay(day.id, day.exercises.filter((e) => e.id !== id));
  };

  return (
    <div className="ex-program">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`ex-status ex-status-${status}`}>
          {statusLabel(status, isAr)}
        </span>
        <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
          {splitLabel(program.split, isAr)}
          {program.goal ? ` · ${program.goal}` : ''}
        </span>
        <div className="ms-auto flex items-center gap-1">
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              type="button"
              className={`ex-chip ${status === s ? 'ex-chip-on' : ''}`}
              aria-pressed={status === s}
              onClick={() => onSetStatus(s)}
            >
              {statusLabel(s, isAr)}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            aria-label={isAr ? 'حذف البرنامج' : 'Delete program'}
            onClick={onDelete}
          />
        </div>
      </div>

      <ul className="ex-days">
        {days.map((day) => {
          const isOpen = openDay === day.id;
          const isDone = completed.has(day.id);
          return (
            <li key={day.id} className={`ex-day${day.isRest ? ' ex-day-rest' : ''}${isDone ? ' ex-day-done' : ''}`}>
              <div className="ex-day-head">
                {!day.isRest ? (
                  <button
                    type="button"
                    className="ex-day-check"
                    aria-pressed={isDone}
                    aria-label={isAr ? 'تم إنجاز اليوم' : 'Mark day complete'}
                    onClick={() => onToggleDayComplete(day.id, !isDone)}
                  >
                    <NuqtaIcon name="check-square" className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="ex-day-rest-icon" aria-hidden="true">
                    <NuqtaIcon name="moon" className="w-4 h-4" />
                  </span>
                )}
                <button
                  type="button"
                  className="ex-day-title"
                  onClick={() => setOpenDay(isOpen ? null : day.id)}
                  aria-expanded={isOpen}
                >
                  <span className="truncate">{isAr ? day.nameAr || day.name : day.name}</span>
                  {!day.isRest && (
                    <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)] font-mono shrink-0">
                      {day.exercises.length} {isAr ? 'تمارين' : 'ex'} · {estimateDayMinutes(day)}m
                    </span>
                  )}
                </button>
                {!day.isRest && day.exercises.length > 0 && (
                  <Button variant="secondary" size="sm" icon="play" onClick={() => onStartDay(day)}>
                    {isAr ? 'ابدأ' : 'Start'}
                  </Button>
                )}
                {!day.isRest && (
                  <button
                    type="button"
                    className="ex-day-caret"
                    aria-label={isOpen ? (isAr ? 'إغلاق' : 'Collapse') : isAr ? 'توسيع' : 'Expand'}
                    onClick={() => setOpenDay(isOpen ? null : day.id)}
                  >
                    <NuqtaIcon name={isOpen ? 'chevronDown' : 'chevronRight'} className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isOpen && !day.isRest && (
                <div className="ex-day-body">
                  {day.exercises.length > 0 && (
                    <ul className="ex-day-exercises">
                      {day.exercises.map((e) => (
                        <li key={e.id}>
                          <span className="truncate">{e.name}</span>
                          <span className="font-mono text-[var(--text-tertiary)]">
                            {e.sets.length}×{e.sets[0]?.reps ?? 0}
                          </span>
                          <button
                            type="button"
                            className="ex-day-remove"
                            aria-label={isAr ? 'إزالة' : 'Remove'}
                            onClick={() => removeExercise(day, e.id)}
                          >
                            <NuqtaIcon name="close" className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ExerciseCatalog
                    isAr={isAr}
                    variant="inline"
                    onAdd={(ex) => addExercise(day, ex)}
                    addLabel={isAr ? 'إضافة' : 'Add'}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
