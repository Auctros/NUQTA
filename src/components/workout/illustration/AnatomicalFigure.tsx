import React from 'react';
import { Pose, Pt } from './geometry';
import { anatomyFor, musclePatches, Volume } from './anatomy';
import { MuscleId } from '../../../lib/exerciseTypes';

/**
 * The volumetric anatomical figure.
 *
 * Draws one pose as a grayscale body (soft-gradient volumes + definition lines)
 * with the trained muscles highlighted on top: primary in the studio accent,
 * secondary in a softened accent, and every other muscle group in a quiet
 * neutral so the anatomy still reads. The far-side limbs are dimmed for depth.
 *
 * Everything is keyed off `pose`, so the same component renders a standing,
 * lying, hanging or inverted body. Muscle highlighting is driven by the shared
 * `musclePatches` geometry, which is also what a future animation pass will
 * interpolate — no re-authoring needed.
 */

export interface AnatomicalFigureProps {
  pose: Pose;
  /** Strongly highlighted muscle groups. */
  primary: MuscleId[];
  /** Softly highlighted assisting muscles. */
  secondary: MuscleId[];
  /** Which side of the body the camera sees. */
  facing: 'front' | 'back';
  /** Unique suffix so gradient/filter ids never collide between instances. */
  uid: string;
  joints?: boolean;
  className?: string;
}

const MuscleLayer: React.FC<{
  pose: Pose;
  facing: 'front' | 'back';
  primary: Set<string>;
  secondary: Set<string>;
}> = ({ pose, facing, primary, secondary }) => (
  <g className="ex-anat-muscles">
    {musclePatches(pose, facing).map((m, i) => {
      const state = primary.has(m.id) ? 'primary' : secondary.has(m.id) ? 'secondary' : 'neutral';
      return <path key={`${m.id}-${i}`} className={`ex-anat-muscle ex-anat-${state}`} d={m.d} />;
    })}
  </g>
);

const Volumes: React.FC<{ vols: [Volume, Volume] | Volume[]; className: string }> = ({ vols, className }) => (
  <g className={className}>
    {vols.map((v, i) => (
      <g key={i}>
        <path className="ex-anat-body" d={v.d} />
        {v.lines?.map((l, li) => (
          <path key={li} className="ex-anat-line" d={l} />
        ))}
      </g>
    ))}
  </g>
);

const Joint: React.FC<{ p: Pt; r?: number }> = ({ p, r = 2.4 }) => (
  <circle className="ex-anat-joint" cx={p.x} cy={p.y} r={r} />
);

export const AnatomicalFigure: React.FC<AnatomicalFigureProps> = ({
  pose,
  primary,
  secondary,
  facing,
  uid,
  joints = true,
  className = ''
}) => {
  const a = anatomyFor(pose);
  const p = new Set<string>(primary);
  const s = new Set<string>(secondary);

  const bodyGrad = `exBody-${uid}`;
  const shadow = `exShadow-${uid}`;

  return (
    <g className={`ex-anat ${className}`}>
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="var(--ex-body-1)" />
          <stop offset="1" stopColor="var(--ex-body-2)" />
        </linearGradient>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="var(--ex-body-shadow)" floodOpacity="0.5" />
        </filter>
      </defs>

      <g filter={`url(#${shadow})`} style={{ ['--ex-fill' as string]: `url(#${bodyGrad})` }}>
        {/* far side first, dimmed */}
        <Volumes vols={a.armFar} className="ex-anat-far" />
        <Volumes vols={a.legFar} className="ex-anat-far" />

        {/* torso + head */}
        <Volumes vols={[a.torso]} className="ex-anat-torso" />
        <Volumes vols={[a.head]} className="ex-anat-head" />

        {/* near side on top */}
        <Volumes vols={a.armNear} className="ex-anat-near" />
        <Volumes vols={a.legNear} className="ex-anat-near" />
      </g>

      {/* muscle groups for the visible side */}
      <MuscleLayer pose={pose} facing={facing} primary={p} secondary={s} />

      {joints && (
        <g className="ex-anat-joints">
          <Joint p={pose.armNear[1]} />
          <Joint p={pose.legNear[1]} />
          <Joint p={pose.armNear[0]} r={2.8} />
          <Joint p={pose.legNear[0]} r={2.8} />
        </g>
      )}
    </g>
  );
};
