import React from 'react';
import { PrebuiltExercise } from '../../lib/exerciseTypes';
import {
  categoryLabel,
  difficultyLabel,
  equipmentLabel,
  movementLabel,
  muscleLabel,
  patternLabel
} from '../../lib/exerciseCatalog';
import { Modal, Button } from '../ui';
import { ExerciseIllustration } from './illustration/ExerciseIllustration';
import { MuscleMap } from './MuscleMap';

/**
 * The full instructional page for one exercise.
 *
 * Layout: a hero that pairs the code-generated start/end demonstration with the
 * anatomical muscle map, then the structured coaching content (how to perform
 * it, breathing, form cues, mistakes, safety, and how to make it easier or
 * harder). Everything is bilingual and driven by the catalog entry.
 */

export interface ExerciseDetailModalProps {
  exercise: PrebuiltExercise | null;
  isAr: boolean;
  onClose: () => void;
  /** Present only where "add to the current workout" makes sense. */
  onAdd?: (exercise: PrebuiltExercise) => void;
  addLabel?: string;
}

const List: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="ex-list">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="ex-callout">
    <h3 className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)] mb-2">{title}</h3>
    {children}
  </section>
);

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({ exercise, isAr, onClose, onAdd, addLabel }) => {
  if (!exercise) return null;
  const name = isAr ? exercise.nameAr : exercise.nameEn;
  const tips = isAr ? exercise.tipsAr : exercise.tipsEn;
  const c = exercise.coaching;
  const pick = <T,>(ar: T, en: T): T => (isAr ? ar : en);

  return (
    <Modal open onClose={onClose} title={name} description={tips} size="lg">
      <div className="ex-detail">
        <div className="ex-detail-hero">
          <div className="ex-detail-stage">
            <ExerciseIllustration
              illustrationKey={exercise.illustrationKey}
              isAr={isAr}
              name={name}
              className="ex-detail-art"
            />
          </div>
          <MuscleMap primary={exercise.primary} secondary={exercise.secondary} isAr={isAr} />
        </div>

        <div className="ex-detail-blocks">
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'المنطقة' : 'Region'}</span>
            <span className="ex-meta-value">{categoryLabel(exercise.category, isAr)}</span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'النمط الحركي' : 'Pattern'}</span>
            <span className="ex-meta-value">{patternLabel(exercise.pattern, isAr)}</span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'الأدوات' : 'Equipment'}</span>
            <span className="ex-meta-value">{equipmentLabel(exercise.equipment, isAr)}</span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'المستوى' : 'Level'}</span>
            <span className="ex-meta-value">{difficultyLabel(exercise.difficulty, isAr)}</span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'النوع' : 'Type'}</span>
            <span className="ex-meta-value">
              {exercise.unilateral ? (isAr ? 'جانب واحد' : 'One side at a time') : movementLabel(exercise.movement, isAr)}
            </span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'الجرعة المقترحة' : 'Suggested dose'}</span>
            <span className="ex-meta-value">{pick(c.volumeAr, c.volumeEn)}</span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'الراحة' : 'Rest'}</span>
            <span className="ex-meta-value">
              {c.restSeconds} {isAr ? 'ثانية' : 'sec'}
            </span>
          </div>
          <div className="ex-meta">
            <span className="ex-meta-label">{isAr ? 'العضلات المستهدفة' : 'Targets'}</span>
            <span className="ex-meta-value">{exercise.primary.map((m) => muscleLabel(m, isAr)).join(' · ')}</span>
          </div>
        </div>

        <Block title={isAr ? 'وضع البداية' : 'Set-up'}>
          <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">{pick(c.startAr, c.startEn)}</p>
        </Block>

        <Block title={isAr ? 'خطوات الأداء' : 'How to perform it'}>
          <ol className="ex-steps">
            {pick(c.stepsAr, c.stepsEn).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Block>

        <Block title={isAr ? 'التنفس' : 'Breathing'}>
          <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">{pick(c.breathingAr, c.breathingEn)}</p>
        </Block>

        <Block title={isAr ? 'نقاط التركيز الفني' : 'Form cues'}>
          <List items={pick(c.cuesAr, c.cuesEn)} />
        </Block>

        <Block title={isAr ? 'أخطاء شائعة' : 'Common mistakes'}>
          <List items={pick(c.mistakesAr, c.mistakesEn)} />
        </Block>

        <section className="ex-callout ex-callout-warn">
          <h3 className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)] mb-1">
            {isAr ? 'السلامة' : 'Safety'}
          </h3>
          <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">{pick(c.safetyAr, c.safetyEn)}</p>
        </section>

        <div className="ex-variations">
          <section className="ex-callout ex-callout-good">
            <h3 className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)] mb-1">
              {isAr ? 'أسهل' : 'Make it easier'}
            </h3>
            <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">{pick(c.easierAr, c.easierEn)}</p>
          </section>
          <section className="ex-callout">
            <h3 className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)] mb-1">
              {isAr ? 'أصعب' : 'Make it harder'}
            </h3>
            <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">{pick(c.harderAr, c.harderEn)}</p>
          </section>
        </div>

        {onAdd && (
          <div className="flex justify-end">
            <Button variant="primary" size="md" icon="plus" onClick={() => onAdd(exercise)}>
              {addLabel || (isAr ? 'أضف للتمرين' : 'Add to workout')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
