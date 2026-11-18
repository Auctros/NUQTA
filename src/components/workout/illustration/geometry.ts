/**
 * Vector geometry for the exercise illustrations.
 *
 * A figure is described by joint keypoints only. Everything the eye reads as
 * "a body" — the torso silhouette, tapered limbs, the head — is derived from
 * those points, so one consistent style falls out of one small set of shapes.
 *
 * Angle convention: degrees, 0° points right (+x), 90° points down (+y, SVG
 * grows downward), 180° left, 270° up.
 */
export interface Pt {
  x: number;
  y: number;
}

/** A full figure: spine plus two arm and two leg chains. */
export interface Pose {
  /** Centre of the head. */
  head: Pt;
  /** Base of the neck (top of the torso). */
  neck: Pt;
  /** Centre of the pelvis (bottom of the torso). */
  hip: Pt;
  /** Near-side arm: shoulder, elbow, wrist. */
  armNear: [Pt, Pt, Pt];
  /** Far-side arm, drawn behind and dimmed. */
  armFar: [Pt, Pt, Pt];
  /** Near-side leg: hip, knee, ankle. */
  legNear: [Pt, Pt, Pt];
  /** Far-side leg, drawn behind and dimmed. */
  legFar: [Pt, Pt, Pt];
}

export const pt = (x: number, y: number): Pt => ({ x, y });

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A point `len` away from `root` at `deg`. */
export const step = (root: Pt, deg: number, len: number): Pt => ({
  x: root.x + Math.cos(rad(deg)) * len,
  y: root.y + Math.sin(rad(deg)) * len
});

/** Shoulder→elbow→wrist (or hip→knee→ankle) built from two segments. */
export const chain = (root: Pt, a1: number, l1: number, a2: number, l2: number): [Pt, Pt, Pt] => {
  const mid = step(root, a1, l1);
  return [root, mid, step(mid, a2, l2)];
};

/**
 * Chain from a fixed `root` to a fixed `hand`, bending the middle joint
 * sideways by `bend` px. Used wherever the end effector is pinned to something
 * (a bar, the floor) and only the body moves.
 */
export const reach = (root: Pt, hand: Pt, bend: number): [Pt, Pt, Pt] => {
  const d = unit(sub(hand, root));
  const perp = { x: -d.y, y: d.x };
  const mid = { x: (root.x + hand.x) / 2, y: (root.y + hand.y) / 2 };
  return [root, { x: mid.x + perp.x * bend, y: mid.y + perp.y * bend }, hand];
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const lerpChain = (a: [Pt, Pt, Pt], b: [Pt, Pt, Pt], t: number): [Pt, Pt, Pt] => [
  lerpPt(a[0], b[0], t),
  lerpPt(a[1], b[1], t),
  lerpPt(a[2], b[2], t)
];

/** Interpolate two poses; used to drive the animation without re-authoring it. */
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  head: lerpPt(a.head, b.head, t),
  neck: lerpPt(a.neck, b.neck, t),
  hip: lerpPt(a.hip, b.hip, t),
  armNear: lerpChain(a.armNear, b.armNear, t),
  armFar: lerpChain(a.armFar, b.armFar, t),
  legNear: lerpChain(a.legNear, b.legNear, t),
  legFar: lerpChain(a.legFar, b.legFar, t)
});

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const unit = (p: Pt): Pt => {
  const m = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / m, y: p.y / m };
};

/** Unit vector perpendicular to the spine (used to build the torso silhouette). */
export const spinePerp = (neck: Pt, hip: Pt): Pt => {
  const d = unit(sub(hip, neck));
  return { x: -d.y, y: d.x };
};

export const addPt = add;
export const subPt = sub;
export const mulPt = mul;
export const unitPt = unit;

export interface GroundSpec {
  /** Floor contact line. */
  floor?: { y: number; from: number; to: number };
  /** Wall the figure leans on / pushes against. */
  wall?: { x: number; from: number; to: number };
  /** A sturdy chair: seat block plus an optional backrest. */
  chair?: { x: number; y: number; w: number; h: number; back?: boolean };
  /** Exercise mat under a lying figure. */
  mat?: { y: number; from: number; to: number };
  /** A pull-up bar / table edge. */
  bar?: { x1: number; x2: number; y: number };
}

export type MotionKind = 'push' | 'pull' | 'up' | 'down' | 'rotate' | 'swing';

export interface Motion {
  from: Pt;
  to: Pt;
  kind?: MotionKind;
  /** Perpendicular bend of the arrow, in px (sign picks the side). */
  curve?: number;
}

export interface Illustration {
  /** 1 = static, 2–3 = phases the animation cycles through. */
  phases: Pose[];
  motion?: Motion;
  ground?: GroundSpec;
  /** True when the movement itself is the teaching point. */
  animated?: boolean;
  /** Which side of the body the illustration presents. Defaults to `front`. */
  facing?: 'front' | 'back';
  /** Per-illustration label override for screen readers. */
  altEn?: string;
  altAr?: string;
}
