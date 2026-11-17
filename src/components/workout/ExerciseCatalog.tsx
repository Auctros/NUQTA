import React, { useMemo, useState } from 'react';
import { Button, NuqtaSelect } from '../ui';
import {
  EXERCISE_CATALOG,
  PrebuiltExercise,
  MuscleGroup,
  MovementPattern,
  categoryLabel,
  patternLabel,
  equipmentLabel,
  muscleLabel,
  recentlyPerformedExercises,
  CATALOG_CATEGORIES,
  CATALOG_EQUIPMENT,
  CATALOG_PATTERNS
} from '../../lib/exerciseCatalog';
import { WorkoutSessionLog } from '../../types';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseDetailModal } from './ExerciseDetailModal';

/**
 * The one exercise-library browser.
 *
 * Both entry points — the Workout Studio "Exercises" tab and the dashboard
 * `WorkoutAppModal` "Exercise Catalog" tab — render this, so the search, the
 * filter set, the grid and the detail sheet can never drift apart. It owns its
 * filter state and the detail modal; the caller only decides what "add" means.
 */

export interface ExerciseCatalogProps {
  isAr: boolean;
  /** Called when the user adds an exercise to the current workout. */
  onAdd?: (exercise: PrebuiltExercise) => void;
  addLabel?: string;
  /** `inline` drops the filter row and tightens the grid (used in the session panel). */
  variant?: 'studio' | 'inline';
  /** Logged sessions; when present, a "recently performed" quick-pick is shown. */
  recentSessions?: WorkoutSessionLog[];
  className?: string;
}

export const ExerciseCatalog: React.FC<ExerciseCatalogProps> = ({
  isAr,
  onAdd,
  addLabel,
  variant = 'studio',
  recentSessions,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | MuscleGroup>('all');
  const [pattern, setPattern] = useState<'all' | MovementPattern>('all');
  const [equipment, setEquipment] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [openExercise, setOpenExercise] = useState<PrebuiltExercise | null>(null);

  const showFilters = variant === 'studio';
  const hasFilter =
    !!query || category !== 'all' || pattern !== 'all' || equipment !== 'all' || difficulty !== 'all';

  const recent = useMemo(
    () => (recentSessions && recentSessions.length ? recentlyPerformedExercises(recentSessions) : []),
    [recentSessions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISE_CATALOG.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (pattern !== 'all' && e.pattern !== pattern) return false;
      if (equipment !== 'all' && e.equipment !== equipment) return false;
      if (difficulty !== 'all' && e.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        e.nameAr.toLowerCase().includes(q) ||
        e.nameEn.toLowerCase().includes(q) ||
        categoryLabel(e.category, isAr).toLowerCase().includes(q) ||
        e.primary.some((m) => muscleLabel(m, isAr).toLowerCase().includes(q)) ||
        e.secondary.some((m) => muscleLabel(m, isAr).toLowerCase().includes(q))
      );
    });
  }, [query, category, pattern, equipment, difficulty, isAr]);

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setPattern('all');
    setEquipment('all');
    setDifficulty('all');
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث بالاسم أو العضلة…' : 'Search by name or muscle…'}
          aria-label={isAr ? 'بحث في المكتبة' : 'Search the library'}
          className={`input flex-1 min-w-[160px] text-[var(--fs-xs)]${showFilters ? '' : ' w-full'}`}
        />
        {showFilters && (
          <>
            <NuqtaSelect value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label={isAr ? 'المنطقة' : 'Region'} className="text-[var(--fs-xs)]">
              <option value="all">{isAr ? 'كل المناطق' : 'All regions'}</option>
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, isAr)}
                </option>
              ))}
            </NuqtaSelect>
            <NuqtaSelect value={pattern} onChange={(e) => setPattern(e.target.value as typeof pattern)} aria-label={isAr ? 'النمط' : 'Pattern'} className="text-[var(--fs-xs)]">
              <option value="all">{isAr ? 'كل الأنماط' : 'All patterns'}</option>
              {CATALOG_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {patternLabel(p, isAr)}
                </option>
              ))}
            </NuqtaSelect>
            <NuqtaSelect value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label={isAr ? 'الأدوات' : 'Equipment'} className="text-[var(--fs-xs)]">
              <option value="all">{isAr ? 'كل الأدوات' : 'All equipment'}</option>
              {CATALOG_EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {equipmentLabel(eq, isAr)}
                </option>
              ))}
            </NuqtaSelect>
            <NuqtaSelect value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label={isAr ? 'المستوى' : 'Difficulty'} className="text-[var(--fs-xs)]">
              <option value="all">{isAr ? 'كل المستويات' : 'All levels'}</option>
              <option value="beginner">{isAr ? 'مبتدئ' : 'Beginner'}</option>
              <option value="intermediate">{isAr ? 'متوسط' : 'Intermediate'}</option>
              <option value="advanced">{isAr ? 'متقدم' : 'Advanced'}</option>
            </NuqtaSelect>
            {hasFilter && (
              <Button variant="ghost" size="sm" icon="close" onClick={clearFilters}>
                {isAr ? 'مسح' : 'Clear'}
              </Button>
            )}
          </>
        )}
      </div>

      {recent.length > 0 && !hasFilter && (
        <div className="mt-3">
          <p className="text-[var(--fs-micro)] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
            {isAr ? 'أديتها مؤخراً' : 'Recently performed'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => (onAdd ? onAdd(ex) : setOpenExercise(ex))}
                className="px-2.5 py-1 rounded-[var(--r-full)] border border-[var(--studio-line,var(--border-default))] text-[var(--fs-micro)] text-[var(--text-secondary)] hover:border-[var(--studio-accent-line,var(--border-strong))] hover:text-[var(--studio-accent,var(--brand-strong))] transition-colors"
              >
                {isAr ? ex.nameAr : ex.nameEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="mt-2 text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono" aria-live="polite">
          {filtered.length} / {EXERCISE_CATALOG.length}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-3 text-center py-8 px-4 border border-dashed border-[var(--studio-line,var(--border-default))] rounded-[var(--r-md)]">
          <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
            {isAr ? 'لا نتائج مطابقة' : 'No matches'}
          </p>
          <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mt-1">
            {isAr ? 'جرّب تعديل البحث أو الفلاتر.' : 'Try adjusting the search or filters.'}
          </p>
        </div>
      ) : (
        <div
          className={`mt-3 grid gap-3 ${
            variant === 'studio' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {filtered.map((e) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              isAr={isAr}
              onOpen={setOpenExercise}
              onAdd={onAdd}
              addLabel={addLabel}
            />
          ))}
        </div>
      )}

      <ExerciseDetailModal
        exercise={openExercise}
        isAr={isAr}
        onClose={() => setOpenExercise(null)}
        onAdd={onAdd}
        addLabel={addLabel}
      />
    </div>
  );
};
