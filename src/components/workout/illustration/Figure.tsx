import React from 'react';
import { Pose, Pt, addPt, subPt, mulPt, unitPt, spinePerp, pt } from './geometry';

/**
 * Renders one pose as the shared anatomical line-art figure.
 *
 * The torso is a quad silhouette (shoulders wide, waist narrower) built from the
 * spine vector, so it follows a lying, hanging or inverted figure automatically.
 * Limbs are single stroked polylines with round caps; the far side is dimmed to
 * read as depth without a second colour.
 */

const TORSO_SHOULDER_W = 21;
const TORSO_WAIST_W = 15;

const torsoPoints = (neck: Pt, hip: Pt): string => {
  const perp = spinePerp(neck, hip);
  const sh = mulPt(perp, TORSO_SHOULDER_W / 2);
  const wa = mulPt(perp, TORSO_WAIST_W / 2);
  const a = addPt(neck, sh);
  const b = addPt(hip, wa);
  const c = subPt(hip, wa);
  const d = subPt(neck, sh);
  return [a, b, c, d].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
};

const polyline = (chainPts: [Pt, Pt, Pt]): string =>
  chainPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** Small joint disc, keeps elbows/knees readable at 60 px. */
const Joint: React.FC<{ p: Pt; r?: number }> = ({ p, r = 2.6 }) => (
  <circle cx={p.x} cy={p.y} r={r} className="ex-fig-joint" />
);

export interface FigureProps {
  pose: Pose;
  /** Show joint discs (useful on large illustrations, noisy on tiny cards). */
  joints?: boolean;
}

export const Figure: React.FC<FigureProps> = ({ pose, joints = true }) => {
  const { head, neck, hip, armNear, armFar, legNear, legFar } = pose;
  const neckToHip = subPt(hip, neck);
  const headDir = unitPt(neckToHip);
  const headCenter = addPt(neck, mulPt(headDir, -11));
  const shoulderNear = armNear[0];
  const shoulderFar = armFar[0];
  const hipNear = legNear[0];
  const hipFar = legFar[0];

  return (
    <g className="ex-fig">
      {/* far side first so it sits behind the torso */}
      <polyline className="ex-fig-limb ex-fig-far" points={polyline(armFar)} />
      <polyline className="ex-fig-limb ex-fig-far" points={polyline(legFar)} />

      <polygon className="ex-fig-torso" points={torsoPoints(neck, hip)} />
      <line className="ex-fig-spine" x1={neck.x} y1={neck.y} x2={hip.x} y2={hip.y} />

      <polyline className="ex-fig-limb" points={polyline(armNear)} />
      <polyline className="ex-fig-limb" points={polyline(legNear)} />

      {/* hand + foot markers read as contact points */}
      <circle className="ex-fig-extremity" cx={armNear[2].x} cy={armNear[2].y} r={2.4} />
      <circle className="ex-fig-extremity" cx={legNear[2].x} cy={legNear[2].y} r={2.4} />
      <circle className="ex-fig-extremity ex-fig-far" cx={armFar[2].x} cy={armFar[2].y} r={2.2} />
      <circle className="ex-fig-extremity ex-fig-far" cx={legFar[2].x} cy={legFar[2].y} r={2.2} />

      {joints && (
        <>
          <Joint p={shoulderNear} />
          <Joint p={armNear[1]} />
          <Joint p={hipNear} />
          <Joint p={legNear[1]} />
        </>
      )}

      <circle className="ex-fig-head" cx={headCenter.x} cy={headCenter.y} r={10.5} />
      {/* a small gap on the head marks the face direction */}
      <circle
        className="ex-fig-eye"
        cx={headCenter.x + headDir.x * 4.5 - headDir.y * 3}
        cy={headCenter.y + headDir.y * 4.5 + headDir.x * 3}
        r={1.4}
      />
    </g>
  );
};

export { pt };
