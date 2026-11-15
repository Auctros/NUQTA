import React, { useEffect, useRef, useState } from 'react';
import { Illustration, Motion, GroundSpec, Pt, lerpPose, subPt, mulPt, addPt, unitPt } from './geometry';
import { Figure } from './Figure';
import { getIllustration } from './registry';

/**
 * Renders one exercise illustration from the registry.
 *
 * - `mode="static"` draws the start (or single) phase only — used on cards.
 * - `mode="animated"` cycles the phases with requestAnimationFrame. It is only
 *   ever requested by the detail view, and it degrades to static when the user
 *   prefers reduced motion.
 * - A missing registry entry renders a labelled placeholder, so a new catalog
 *   exercise never breaks the layout before its art is authored.
 */

export interface ExerciseIllustrationProps {
  illustrationKey?: string;
  isAr: boolean;
  /** Accessible name of the exercise, used for the SVG's title/desc. */
  name: string;
  mode?: 'static' | 'animated';
  className?: string;
  /** Shows the movement arrow when the illustration defines one. */
  showMotion?: boolean;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------ ground props */

const Ground: React.FC<{ ground?: GroundSpec }> = ({ ground }) => {
  if (!ground) return null;
  return (
    <g className="ex-prop">
      {ground.floor && (
        <line className="ex-ground" x1={ground.floor.from} y1={ground.floor.y} x2={ground.floor.to} y2={ground.floor.y} />
      )}
      {ground.mat && (
        <>
          <rect className="ex-mat" x={ground.mat.from} y={ground.mat.y - 5} width={ground.mat.to - ground.mat.from} height={7} rx={3} />
        </>
      )}
      {ground.wall && (
        <line className="ex-prop-line" x1={ground.wall.x} y1={ground.wall.from} x2={ground.wall.x} y2={ground.wall.to} />
      )}
      {ground.chair && (
        <g className="ex-chair">
          <rect className="ex-prop-line" x={ground.chair.x} y={ground.chair.y} width={ground.chair.w} height={ground.chair.h} rx={3} />
          {ground.chair.back && (
            <line className="ex-prop-line" x1={ground.chair.x + 3} y1={ground.chair.y} x2={ground.chair.x + 3} y2={ground.chair.y - 46} />
          )}
        </g>
      )}
      {ground.bar && <line className="ex-prop-line ex-bar" x1={ground.bar.x1} y1={ground.bar.y} x2={ground.bar.x2} y2={ground.bar.y} />}
    </g>
  );
};

/* ------------------------------------------------------------- motion arrow */

/** Quadratic arrow from `from` to `to`, bent by `curve`, with a clean head. */
const MotionArrow: React.FC<{ motion: Motion }> = ({ motion }) => {
  const { from, to, curve = 0 } = motion;
  const d = unitPt(subPt(to, from));
  const perp = { x: -d.y, y: d.x };
  const mid = addPt(mulPt(addPt(from, to), 0.5), mulPt(perp, curve));
  const path = `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`;
  // arrow head aligned to the chord direction
  const head = unitPt(subPt(to, from));
  const left = { x: -head.y, y: head.x };
  const h1 = addPt(to, addPt(mulPt(head, -9), mulPt(left, 5)));
  const h2 = addPt(to, addPt(mulPt(head, -9), mulPt(left, -5)));
  return (
    <g className="ex-motion">
      <path d={path} className="ex-motion-path" />
      <polygon className="ex-motion-head" points={`${to.x},${to.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} />
    </g>
  );
};

/* ------------------------------------------------------------------- main */

const Fallback: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <div
    className={`grid place-items-center rounded-[var(--r-sm)] border border-dashed border-[var(--border-default)] bg-[var(--surface-inset)] ${className || ''}`}
    role="img"
    aria-label={name}
  >
    <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" strokeLinecap="round" />
    </svg>
  </div>
);

export const ExerciseIllustration: React.FC<ExerciseIllustrationProps> = ({
  illustrationKey,
  isAr,
  name,
  mode = 'static',
  className = '',
  showMotion = true
}) => {
  const illo = getIllustration(illustrationKey);
  const [phaseT, setPhaseT] = useState(0);
  const raf = useRef<number | null>(null);
  const reduced = prefersReducedMotion();

  const animated = mode === 'animated' && !!illo?.animated && (illo?.phases.length ?? 0) > 1 && !reduced;

  useEffect(() => {
    if (!animated) {
      setPhaseT(0);
      return;
    }
    let start: number | null = null;
    const PERIOD = 2200; // full out-and-back cycle
    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = (now - start) % PERIOD;
      const half = PERIOD / 2;
      // ease in/out, ping-pong between phase 0 and 1
      const raw = elapsed < half ? elapsed / half : 2 - elapsed / half;
      setPhaseT(raw * raw * (3 - 2 * raw));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [animated]);

  if (!illo) return <Fallback name={name} className={className} />;

  const n = illo.phases.length;
  // position along the phase list (0..n-1), driven by phaseT for animated art
  const pos = n === 1 ? 0 : phaseT * (n - 1);
  const i0 = Math.min(n - 1, Math.floor(pos));
  const i1 = Math.min(n - 1, i0 + 1);
  const pose = lerpPose(illo.phases[i0], illo.phases[i1], pos - i0);

  const desc = isAr ? illo.altAr || name : illo.altEn || name;
  const titleId = `ex-illo-title-${illustrationKey || 'x'}`;
  const descId = `ex-illo-desc-${illustrationKey || 'x'}`;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`ex-illustration ${className}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={titleId}>{name}</title>
      <desc id={descId}>{desc}</desc>
      <Ground ground={illo.ground} />
      <Figure pose={pose} joints={mode !== 'static'} />
      {showMotion && illo.motion && <MotionArrow motion={illo.motion} />}
    </svg>
  );
};

export type { Pt };
