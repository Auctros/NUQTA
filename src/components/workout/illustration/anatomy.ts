import { Pose, Pt, addPt, subPt, mulPt, unitPt, lerpPt } from './geometry';

/**
 * Anatomical volume geometry for the exercise illustrations.
 *
 * Where `Figure` draws a schematic stick body, this module builds a *volumetric*
 * grayscale body: every part is a closed outline (torso, upper arm, forearm,
 * thigh, calf, head) derived from the same joint keypoints, then filled with a
 * soft gradient and given a definition line. The result reads as a fitness /
 * medical anatomy illustration rather than a stick figure.
 *
 * All shapes are returned as plain path/point data so the renderer can fill them
 * with theme tokens, and every shape is defined once per pose so a future
 * animation pass can simply interpolate the same joints.
 *
 * Angle convention matches geometry.ts: 0° = right (+x), 90° = down (+y).
 */

/** Compact point formatter for building path strings. */
const f = (p: Pt): string => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

/** Format a point list as a closed SVG path. */
export const polyPath = (pts: Pt[], close = true): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + (close ? ' Z' : '');

/** Catmull-Rom-ish smooth closed outline through points (used for organic muscle shapes). */
export const smoothPath = (pts: Pt[], close = true): string => {
  if (pts.length < 3) return polyPath(pts, close);
  const n = pts.length;
  const seg = (i: number) => {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i % n];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    return `C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  };
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i <= n; i++) d += ' ' + seg(i);
  return d + (close ? ' Z' : '');
};

export interface Volume {
  /** Closed outline path. */
  d: string;
  /** Interior definition stroke(s): muscle separations, tendon lines. */
  lines?: string[];
}

/**
 * A tapered limb segment: a rounded spindle from `a` to `b`, thick at the belly
 * (`wMid`) and narrow at the joints (`wEnd`), with an optional definition line
 * along the axis. Used for arms, forearms, thighs and calves.
 */
export const limbVolume = (a: Pt, b: Pt, wMid: number, wEnd: number): Volume => {
  const dir = unitPt(subPt(b, a));
  const perp = { x: -dir.y, y: dir.x };
  const mid = mulPt(addPt(a, b), 0.5);
  // Control points that bow each edge outward at the muscle belly.
  const aOut = addPt(a, mulPt(perp, wEnd));
  const bOut = addPt(b, mulPt(perp, wEnd));
  const mOut = addPt(mid, mulPt(perp, wMid));
  const aIn = subPt(a, mulPt(perp, wEnd));
  const bIn = subPt(b, mulPt(perp, wEnd));
  const mIn = subPt(mid, mulPt(perp, wMid));
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const d = `M ${f(aOut)} Q ${f(mOut)} ${f(bOut)} Q ${f(b)} ${f(bIn)} Q ${f(mIn)} ${f(aIn)} Q ${f(a)} ${f(aOut)} Z`;
  const belly = addPt(mid, mulPt(perp, wMid * 0.4));
  const lines = [`M ${f(a)} Q ${f(belly)} ${f(b)}`];
  return { d, lines };
};

/**
 * The torso: a broad-shouldered, narrow-waisted volume around the spine, with
 * pectoral / abdominal definition. `neck` and `hip` come straight from the pose,
 * so the same code serves a standing, lying or inverted figure.
 */
export const torsoVolume = (neck: Pt, hip: Pt): Volume => {
  const axis = unitPt(subPt(hip, neck));
  const perp = { x: -axis.y, y: axis.x };
  const len = Math.hypot(hip.x - neck.x, hip.y - neck.y) || 1;
  const at = (t: number, w: number): Pt => addPt(addPt(neck, mulPt(axis, len * t)), mulPt(perp, w / 2));

  // Narrow neck, widest at the shoulders, tapering to a waist, then flaring at
  // the hips — the read that makes a torso recognisable as a torso.
  const right = [at(0.0, 9), at(0.12, 24), at(0.3, 22.5), at(0.58, 15.5), at(0.82, 17), at(1.0, 18)];
  // mirror about the spine axis (robust for any orientation)
  const mirror = (p: Pt): Pt => {
    const rel = subPt(p, neck);
    const along = rel.x * axis.x + rel.y * axis.y;
    const proj = addPt(neck, mulPt(axis, along));
    return subPt(mulPt(proj, 2), p);
  };
  const leftM = [...right].reverse().map(mirror);
  const d = smoothPath([...right, ...leftM]);

  const chest = addPt(neck, mulPt(axis, len * 0.28));
  const waist = addPt(neck, mulPt(axis, len * 0.62));
  const sternumTop = addPt(neck, mulPt(axis, len * 0.16));
  const clav = at(0.06, 22);
  const clavL = mirror(clav);
  const lines = [
    // sternum / linea alba
    `M ${f(sternumTop)} L ${f(waist)}`,
    // clavicle
    `M ${f(clav)} Q ${f(addPt(sternumTop, mulPt(axis, len * -0.02)))} ${f(clavL)}`,
    // pec split
    `M ${f(addPt(chest, mulPt(perp, 9)))} Q ${f(addPt(chest, mulPt(axis, len * 0.06)))} ${f(addPt(chest, mulPt(perp, -9)))}`,
    // ab separations
    `M ${f(addPt(addPt(chest, mulPt(axis, len * 0.14)), mulPt(perp, 6)))} L ${f(addPt(addPt(chest, mulPt(axis, len * 0.14)), mulPt(perp, -6)))}`,
    `M ${f(addPt(addPt(chest, mulPt(axis, len * 0.26)), mulPt(perp, 5)))} L ${f(addPt(addPt(chest, mulPt(axis, len * 0.26)), mulPt(perp, -5)))}`
  ];
  return { d, lines };
};

/** Head: an egg shape oriented along the neck→head direction. */
export const headVolume = (neck: Pt, head: Pt): Volume => {
  const dir = unitPt(subPt(head, neck));
  const perp = { x: -dir.y, y: dir.x };
  const c = head;
  const r = 10;
  // An ellipse, slightly longer along the body axis, drawn as a smooth closed path.
  const pts: Pt[] = [];
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const along = Math.cos(a) * r * 1.18;
    const side = Math.sin(a) * r * 0.92;
    pts.push(addPt(c, addPt(mulPt(dir, along), mulPt(perp, side))));
  }
  const d = smoothPath(pts);
  // jaw / chin line
  const jaw = addPt(addPt(neck, mulPt(dir, r * 0.5)), mulPt(perp, r * 0.6));
  const jaw2 = addPt(addPt(neck, mulPt(dir, r * 0.5)), mulPt(perp, -r * 0.6));
  const lines = [`M ${f(jaw)} Q ${f(addPt(neck, mulPt(dir, -r * 0.1)))} ${f(jaw2)}`];
  return { d, lines };
};

export interface Anatomy {
  torso: Volume;
  head: Volume;
  armNear: [Volume, Volume];
  armFar: [Volume, Volume];
  legNear: [Volume, Volume];
  legFar: [Volume, Volume];
}

/** Build every volume for one pose. */
export const anatomyFor = (pose: Pose): Anatomy => {
  const arm = (c: [Pt, Pt, Pt]): [Volume, Volume] => [
    limbVolume(c[0], c[1], 6.4, 4.6),
    limbVolume(c[1], c[2], 5.0, 3.4)
  ];
  const leg = (c: [Pt, Pt, Pt]): [Volume, Volume] => [
    limbVolume(c[0], c[1], 8.4, 6.2),
    limbVolume(c[1], c[2], 5.8, 3.8)
  ];
  return {
    torso: torsoVolume(pose.neck, pose.hip),
    head: headVolume(pose.neck, pose.head),
    armNear: arm(pose.armNear),
    armFar: arm(pose.armFar),
    legNear: leg(pose.legNear),
    legFar: leg(pose.legFar)
  };
};

export interface AnatomyMuscle {
  id: string;
  side: 'front' | 'back';
  d: string;
  /** Marks muscles that read as highlights for most movements. */
  kind?: 'major' | 'minor';
}

/**
 * Muscle patches placed relative to the posed body.
 *
 * Torso groups (chest, back, abs, glutes, delts) are positioned along the spine
 * axis, so they sit correctly whether the figure is standing, lying or inverted.
 * Limb groups (biceps, triceps, quads, hamstrings, calves) are placed *along the
 * limb polyline*, so they follow a bent arm or leg instead of drifting off it.
 *
 * `facing` selects the anterior or posterior set; the renderer colours primary
 * and secondary patches while leaving the rest neutral.
 */

/** Point + local direction at parameter `t` (0..1) along a 3-point limb chain. */
const alongChain = (c: [Pt, Pt, Pt], t: number): { p: Pt; dir: Pt } => {
  const [a, b, d] = c;
  const l1 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const l2 = Math.hypot(d.x - b.x, d.y - b.y) || 1;
  const total = l1 + l2;
  const target = Math.max(0, Math.min(1, t)) * total;
  if (target <= l1) return { p: lerpPt(a, b, target / l1), dir: unitPt(subPt(b, a)) };
  return { p: lerpPt(b, d, (target - l1) / l2), dir: unitPt(subPt(d, b)) };
};

export const musclePatches = (pose: Pose, facing: 'front' | 'back'): AnatomyMuscle[] => {
  const axis = unitPt(subPt(pose.hip, pose.neck));
  const perp = { x: -axis.y, y: axis.x };
  const len = Math.hypot(pose.hip.x - pose.neck.x, pose.hip.y - pose.neck.y) || 1;
  const onTorso = (side: number, t: number): Pt => addPt(addPt(pose.neck, mulPt(axis, len * t)), mulPt(perp, side));

  /** Oriented rounded patch: `w` across the limb, `h` along it. */
  const patchAt = (c: Pt, dir: Pt, w: number, h: number): string => {
    const pd = { x: -dir.y, y: dir.x };
    const corner = (dx: number, dy: number): Pt => ({
      x: c.x + pd.x * dx + dir.x * dy,
      y: c.y + pd.y * dx + dir.y * dy
    });
    return smoothPath([corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)]);
  };

  /** Patch centred between t0 and t1 along a limb chain. */
  const limb = (id: string, chain: [Pt, Pt, Pt], t0: number, t1: number, w: number, kind: 'major' | 'minor'): AnatomyMuscle => {
    const mid = alongChain(chain, (t0 + t1) / 2);
    const a = alongChain(chain, t0);
    const b = alongChain(chain, t1);
    const h = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y);
    return { id, side: facing, d: patchAt(mid.p, mid.dir, w, h), kind };
  };

  /** Deltoid cap centred on the shoulder joint, oriented along the upper arm. */
  const delt = (id: string, shoulder: Pt, elbow: Pt): AnatomyMuscle => {
    const dir = unitPt(subPt(elbow, shoulder));
    const c = addPt(shoulder, mulPt(dir, 3));
    return { id, side: facing, d: patchAt(c, dir, 10, 11), kind: 'minor' };
  };

  const arms: AnatomyMuscle[] = [
    limb(facing === 'front' ? 'biceps' : 'triceps', pose.armNear, 0.08, 0.42, 7.5, 'minor'),
    limb(facing === 'front' ? 'biceps' : 'triceps', pose.armFar, 0.08, 0.42, 7.5, 'minor'),
    limb('forearms', pose.armNear, 0.6, 0.92, 6, 'minor'),
    limb('forearms', pose.armFar, 0.6, 0.92, 6, 'minor')
  ];
  const legs: AnatomyMuscle[] = [
    limb(facing === 'front' ? 'quads' : 'hamstrings', pose.legNear, 0.08, 0.46, 10.5, 'major'),
    limb(facing === 'front' ? 'quads' : 'hamstrings', pose.legFar, 0.08, 0.46, 10.5, 'major'),
    limb('calves', pose.legNear, 0.62, 0.94, 7.5, 'minor'),
    limb('calves', pose.legFar, 0.62, 0.94, 7.5, 'minor')
  ];

  if (facing === 'front') {
    const torso: AnatomyMuscle[] = [
      { id: 'chest', side: 'front', d: patchAt(onTorso(-6.5, 0.26), axis, 12, 12), kind: 'major' },
      { id: 'chest', side: 'front', d: patchAt(onTorso(6.5, 0.26), axis, 12, 12), kind: 'major' },
      { id: 'abs', side: 'front', d: patchAt(onTorso(0, 0.6), axis, 14, 20), kind: 'major' },
      { id: 'obliques', side: 'front', d: patchAt(onTorso(-9.5, 0.6), axis, 5.5, 16), kind: 'minor' },
      { id: 'obliques', side: 'front', d: patchAt(onTorso(9.5, 0.6), axis, 5.5, 16), kind: 'minor' }
    ];
    const delts: AnatomyMuscle[] = [
      delt('front_delts', pose.armNear[0], pose.armNear[1]),
      delt('front_delts', pose.armFar[0], pose.armFar[1])
    ];
    return [...torso, ...delts, ...arms, ...legs];
  }

  const torso: AnatomyMuscle[] = [
    { id: 'traps', side: 'back', d: patchAt(onTorso(0, 0.06), axis, 18, 11), kind: 'major' },
    { id: 'upper_back', side: 'back', d: patchAt(onTorso(0, 0.3), axis, 20, 15), kind: 'major' },
    { id: 'lats', side: 'back', d: patchAt(onTorso(-9.5, 0.46), axis, 8, 20), kind: 'major' },
    { id: 'lats', side: 'back', d: patchAt(onTorso(9.5, 0.46), axis, 8, 20), kind: 'major' },
    { id: 'lower_back', side: 'back', d: patchAt(onTorso(0, 0.72), axis, 12, 13), kind: 'minor' }
  ];
  const delts: AnatomyMuscle[] = [
    delt('rear_delts', pose.armNear[0], pose.armNear[1]),
    delt('rear_delts', pose.armFar[0], pose.armFar[1])
  ];
  const glutes: AnatomyMuscle[] = [
    { id: 'glutes', side: 'back', d: patchAt(onTorso(-6.5, 0.97), axis, 12, 12), kind: 'major' },
    { id: 'glutes', side: 'back', d: patchAt(onTorso(6.5, 0.97), axis, 12, 12), kind: 'major' }
  ];
  return [...torso, ...delts, ...glutes, ...arms, ...legs];
};
