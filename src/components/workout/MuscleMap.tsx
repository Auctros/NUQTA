import React from 'react';
import { MuscleId } from '../../lib/exerciseTypes';

/**
 * Educational anatomical muscle map: a front and a back body view with the
 * muscles an exercise works highlighted.
 *
 * This is a *teaching* diagram, not medical anatomy. The silhouette and the
 * muscle shapes are simplified on purpose; the value is the contrast between
 * what a movement targets primarily, secondarily, and not at all.
 *
 * Colour comes from the studio accent scope:
 *   primary   → var(--studio-accent)
 *   secondary → a softened mix of the same accent
 *   neutral   → a quiet surface tone
 */

export interface MuscleMapProps {
  primary: MuscleId[];
  secondary: MuscleId[];
  isAr: boolean;
  /** Region labels are hidden on very small instances. */
  showLabels?: boolean;
  className?: string;
}

type Region = { id: MuscleId; d: string };

/** Every region the muscle map knows how to highlight, in display order. */
export const MUSCLE_IDS: MuscleId[] = [
  'chest',
  'front_delts',
  'biceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'quads',
  'calves',
  'traps',
  'upper_back',
  'lats',
  'lower_back',
  'rear_delts',
  'triceps',
  'glutes',
  'hamstrings'
];

/* Front view — viewBox 0 0 120 240, symmetric about x = 60. */
const FRONT_REGIONS: Region[] = [
  { id: 'front_delts', d: 'M30 50a7 7 0 1 1 0 14a7 7 0 1 1 0-14Z M90 50a7 7 0 1 1 0 14a7 7 0 1 1 0-14Z' },
  { id: 'chest', d: 'M41 52h17v20a9 9 0 0 1-17 0Z M62 52h17v20a9 9 0 0 1-17 0Z' },
  { id: 'biceps', d: 'M27 66c-3 6-4 12-3 18l9-2c-1-6 0-12 2-17Z M93 66c3 6 4 12 3 18l-9-2c1-6 0-12-2-17Z' },
  { id: 'forearms', d: 'M23 86c-2 8-3 16-2 24l9-1c-1-8 0-16 2-23Z M97 86c2 8 3 16 2 24l-9-1c1-8 0-16-2-23Z' },
  { id: 'abs', d: 'M48 78h24v34H48Z' },
  { id: 'obliques', d: 'M42 80h6v30l-6 4Z M72 80h6v34l-6-4Z' },
  { id: 'hip_flexors', d: 'M44 116h32v14l-16 4-16-4Z' },
  { id: 'quads', d: 'M42 130h16v48l-8 4-8-6Z M62 130h16v46l-8 6-8-4Z' },
  { id: 'calves', d: 'M45 190h11v30l-5 2-6-4Z M64 190h11v28l-6 4-5-2Z' }
];

/* Back view — same silhouette, posterior muscle groups. */
const BACK_REGIONS: Region[] = [
  { id: 'traps', d: 'M50 44h20l6 20-16 8-16-8Z' },
  { id: 'rear_delts', d: 'M30 50a7 7 0 1 1 0 14a7 7 0 1 1 0-14Z M90 50a7 7 0 1 1 0 14a7 7 0 1 1 0-14Z' },
  { id: 'upper_back', d: 'M46 64h28v18H46Z' },
  { id: 'lats', d: 'M40 72l8 6v22l-12 6-4-18Z M80 72l-8 6v22l12 6 4-18Z' },
  { id: 'lower_back', d: 'M50 100h20v22H50Z' },
  { id: 'triceps', d: 'M27 66c-3 6-4 12-3 18l9-2c-1-6 0-12 2-17Z M93 66c3 6 4 12 3 18l-9-2c1-6 0-12-2-17Z' },
  { id: 'forearms', d: 'M23 86c-2 8-3 16-2 24l9-1c-1-8 0-16 2-23Z M97 86c2 8 3 16 2 24l-9-1c1-8 0-16-2-23Z' },
  { id: 'glutes', d: 'M44 118h32v26l-16 6-16-6Z' },
  { id: 'hamstrings', d: 'M42 148h16v44l-8 6-8-6Z M62 148h16v44l-8 6-8-6Z' },
  { id: 'calves', d: 'M45 194h11v26l-5 2-6-4Z M64 194h11v26l-6 4-5-2Z' }
];

const Body: React.FC<{ face: 'front' | 'back' }> = ({ face }) => (
  <g className="ex-mm-body">
    <ellipse className="ex-mm-skin" cx={60} cy={22} rx={15} ry={16} />
    <rect className="ex-mm-skin" x={54} y={34} width={12} height={10} rx={4} />
    {/* torso */}
    <path className="ex-mm-skin" d="M42 44h36c6 3 8 18 6 32l-4 42H40l-4-42c-2-14 0-29 6-32Z" />
    {/* arms */}
    <path className="ex-mm-skin" d="M33 48c-5 12-9 40-11 70l10 2c3-30 7-56 12-68Z" />
    <path className="ex-mm-skin" d="M87 48c5 12 9 40 11 70l-10 2c-3-30-7-56-12-68Z" />
    {/* legs */}
    <path className="ex-mm-skin" d="M40 118h18v104H42Z" />
    <path className="ex-mm-skin" d="M62 118h18v104H62Z" />
    {/* feet */}
    <ellipse className="ex-mm-skin" cx={49} cy={226} rx={8} ry={5} />
    <ellipse className="ex-mm-skin" cx={71} cy={226} rx={8} ry={5} />
    {face === 'front' ? (
      <path className="ex-mm-line" d="M60 44v72" />
    ) : (
      <path className="ex-mm-line" d="M60 44v96" />
    )}
  </g>
);

const MuscleFigure: React.FC<{
  face: 'front' | 'back';
  regions: Region[];
  primary: Set<string>;
  secondary: Set<string>;
  label: string;
}> = ({ face, regions, primary, secondary, label }) => (
  <figure className="ex-mm-figure">
    <svg viewBox="0 0 120 240" className="ex-mm-svg" role="img" aria-label={label}>
      <Body face={face} />
      <g className="ex-mm-muscles">
        {regions.map((r) => {
          const state = primary.has(r.id) ? 'primary' : secondary.has(r.id) ? 'secondary' : 'neutral';
          return <path key={r.id} className={`ex-mm-region ex-mm-${state}`} d={r.d} />;
        })}
      </g>
    </svg>
    <figcaption className="ex-mm-caption">{label}</figcaption>
  </figure>
);

export const MuscleMap: React.FC<MuscleMapProps> = ({ primary, secondary, isAr, showLabels = true, className = '' }) => {
  const p = new Set<string>(primary);
  const s = new Set<string>(secondary);
  return (
    <div className={`ex-mm ${className}`}>
      <div className="ex-mm-views">
        <MuscleFigure face="front" regions={FRONT_REGIONS} primary={p} secondary={s} label={isAr ? 'أمامي' : 'Front'} />
        <MuscleFigure face="back" regions={BACK_REGIONS} primary={p} secondary={s} label={isAr ? 'خلفي' : 'Back'} />
      </div>
      {showLabels && (
        <ul className="ex-mm-legend">
          <li>
            <span className="ex-mm-swatch ex-mm-primary" aria-hidden="true" />
            {isAr ? 'عضلات أساسية' : 'Primary'}
          </li>
          <li>
            <span className="ex-mm-swatch ex-mm-secondary" aria-hidden="true" />
            {isAr ? 'عضلات مساعدة' : 'Secondary'}
          </li>
          <li>
            <span className="ex-mm-swatch ex-mm-neutral" aria-hidden="true" />
            {isAr ? 'غير مستهدفة' : 'Not targeted'}
          </li>
        </ul>
      )}
    </div>
  );
};
