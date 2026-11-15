import { Pose, Pt, pt, chain, reach, lerpPose } from './geometry';

/**
 * Archetype postures, expressed as joint keypoints.
 *
 * Every illustration is assembled from these (and small parameter tweaks of
 * them) so the whole catalog shares one body, one set of proportions and one
 * style. Side-view archetypes read left→right with the figure facing right;
 * front-view archetypes are symmetric about x = 100.
 *
 * The figure stands on y = FLOOR_Y and is roughly 140 px tall, which keeps every
 * pose inside a 200 × 200 viewBox with room for arrows and props.
 */

export const FIG = {
  torso: 46,
  upperArm: 29,
  foreArm: 27,
  thigh: 34,
  shin: 34
};

export const FLOOR_Y = 172;
export const MAT_Y = 176;
export const CENTER = 100;

const mirrorPt = (p: Pt): Pt => ({ x: 200 - p.x, y: p.y });
const mirrorChain = (c: [Pt, Pt, Pt]): [Pt, Pt, Pt] => [mirrorPt(c[0]), mirrorPt(c[1]), mirrorPt(c[2])];

/** Build a side-view Pose; the far limbs default to a small depth offset. */
const side = (p: {
  neck: Pt;
  hip: Pt;
  armNear: [Pt, Pt, Pt];
  armFar?: [Pt, Pt, Pt];
  legNear: [Pt, Pt, Pt];
  legFar?: [Pt, Pt, Pt];
  far?: number;
}): Pose => {
  const off = p.far ?? 9;
  const shift = (c: [Pt, Pt, Pt]): [Pt, Pt, Pt] => [pt(c[0].x - off, c[0].y), pt(c[1].x - off, c[1].y), pt(c[2].x - off, c[2].y)];
  const { neck, hip } = p;
  const dx = hip.x - neck.x;
  const dy = hip.y - neck.y;
  const m = Math.hypot(dx, dy) || 1;
  const head = pt(neck.x - (dx / m) * 11, neck.y - (dy / m) * 11);
  return {
    head,
    neck,
    hip,
    armNear: p.armNear,
    armFar: p.armFar ?? shift(p.armNear),
    legNear: p.legNear,
    legFar: p.legFar ?? shift(p.legNear)
  };
};

/* ---------------------------------------------------------------- standing */

/** Standing tall, arms hanging just outside the hips. */
export const stand = (): Pose =>
  side({
    neck: pt(100, 58),
    hip: pt(100, 104),
    armNear: chain(pt(100, 58), 96, FIG.upperArm, 92, FIG.foreArm),
    legNear: chain(pt(100, 104), 90, FIG.thigh, 90, FIG.shin)
  });

/** Standing with both arms straight overhead. */
export const standArmsOverhead = (): Pose =>
  side({
    neck: pt(100, 58),
    hip: pt(100, 104),
    armNear: chain(pt(100, 58), 266, FIG.upperArm, 274, FIG.foreArm),
    legNear: chain(pt(100, 104), 90, FIG.thigh, 90, FIG.shin)
  });

/* ------------------------------------------------------------------- squat */

const SQ_DEEP: Pose = side({
  neck: pt(104, 96),
  hip: pt(92, 140),
  armNear: chain(pt(104, 96), -4, FIG.upperArm, 0, FIG.foreArm),
  legNear: [pt(92, 140), pt(116, 140), pt(102, FLOOR_Y)]
});

/** `d` 0 = standing, 1 = thighs parallel to the floor, arms forward. */
export const squat = (d: number): Pose => lerpPose(stand(), SQ_DEEP, d);

/** Wide stance, knees tracking out, torso upright (front view). */
export const sumoSquat = (d: number): Pose => {
  const neck = pt(100, 58 + 16 * d);
  const hip = pt(100, 104 + 20 * d);
  const armNear = chain(pt(92, 60 + 16 * d), 74, FIG.upperArm, 92, FIG.foreArm);
  const legNear: [Pt, Pt, Pt] = [pt(95, hip.y), pt(76 - 6 * d, 138 + 12 * d), pt(64, FLOOR_Y)];
  return { head: pt(100, 34 + 16 * d), neck, hip, armNear, armFar: mirrorChain(armNear), legNear, legFar: mirrorChain(legNear) };
};

/** Back flat against a wall, knees bent toward 90°. */
export const wallSit = (d = 1): Pose => {
  const hip = pt(84, 104 + 22 * d);
  const neck = pt(80, hip.y - FIG.torso + 6 * d);
  return side({
    neck,
    hip,
    armNear: chain(neck, 92, FIG.upperArm, 88, FIG.foreArm),
    legNear: [hip, pt(118, hip.y + 6), pt(118, FLOOR_Y)]
  });
};

/* ------------------------------------------------------------------ hinge */

const HINGE_DEEP: Pose = side({
  neck: pt(54, 104),
  hip: pt(100, 104),
  armNear: chain(pt(54, 104), 90, FIG.upperArm, 90, FIG.foreArm),
  legNear: chain(pt(100, 104), 90, FIG.thigh, 90, FIG.shin)
});

/** `b` 0 = upright, 1 = torso horizontal, spine long. */
export const hinge = (b: number): Pose => lerpPose(stand(), HINGE_DEEP, b);

/* ------------------------------------------------------------------ lunge */

export const lunge = (depth: number): Pose => {
  const hip = pt(98, 116 + 8 * depth);
  return side({
    neck: pt(98, hip.y - FIG.torso),
    hip,
    armNear: chain(pt(98, hip.y - FIG.torso), 94, FIG.upperArm, 90, FIG.foreArm),
    legNear: [hip, pt(120, 138 + 4 * depth), pt(124, FLOOR_Y)],
    legFar: [hip, pt(74, 148 + 6 * depth), pt(66, FLOOR_Y - 6)],
    far: 0
  });
};

/** Rear foot elevated on a chair. */
export const splitSquat = (depth: number): Pose => {
  const hip = pt(96, 118 + 10 * depth);
  return side({
    neck: pt(96, hip.y - FIG.torso),
    hip,
    armNear: chain(pt(96, hip.y - FIG.torso), 94, FIG.upperArm, 90, FIG.foreArm),
    legNear: [hip, pt(116, 140 + 6 * depth), pt(120, FLOOR_Y)],
    legFar: [hip, pt(72, 146), pt(58, 128)],
    far: 0
  });
};

/* ------------------------------------------------------------------ plank */

/** Plank with the elbows bent. `sink` 0 = straight arms, 1 = chest near the floor. */
export const plank = (sink = 0): Pose => {
  const s = Math.max(0, Math.min(1, sink));
  const neck = pt(64, 128 + 14 * s);
  const hip = pt(104, 140 + 6 * s);
  return side({
    neck,
    hip,
    armNear: [neck, pt(64 - 12 * s, 150 + 5 * s), pt(62, FLOOR_Y)],
    legNear: [hip, pt(134, 150 + 6 * s), pt(160, FLOOR_Y)],
    far: 8
  });
};

/** Plank with one knee driven toward the chest (mountain climber). */
export const plankKneeDrive = (): Pose =>
  side({
    neck: pt(64, 128),
    hip: pt(104, 140),
    armNear: [pt(64, 128), pt(66, 150), pt(62, FLOOR_Y)],
    legNear: [pt(104, 140), pt(92, 158), pt(78, 152)],
    legFar: [pt(96, 140), pt(134, 160), pt(158, FLOOR_Y)],
    far: 0
  });

export const kneePlank = (): Pose =>
  side({
    neck: pt(64, 130),
    hip: pt(102, 142),
    armNear: [pt(64, 130), pt(64, FLOOR_Y), pt(90, FLOOR_Y)],
    legNear: [pt(102, 142), pt(138, FLOOR_Y), pt(152, 158)],
    far: 8
  });

export const sidePlank = (): Pose =>
  side({
    neck: pt(84, 132),
    hip: pt(126, 150),
    armNear: [pt(84, 132), pt(84, FLOOR_Y - 4), pt(60, FLOOR_Y - 2)],
    armFar: [pt(84, 132), pt(78, 104), pt(70, 78)],
    legNear: [pt(126, 150), pt(150, 160), pt(176, FLOOR_Y - 4)],
    far: 0
  });

/* -------------------------------------------------------------- quadruped */

export const quadruped = (): Pose =>
  side({
    neck: pt(84, 136),
    hip: pt(126, 138),
    armNear: chain(pt(84, 136), 90, 18, 90, 18),
    legNear: [pt(126, 138), pt(126, FLOOR_Y), pt(156, FLOOR_Y + 2)],
    far: 8
  });

/** Opposite arm and leg extended from the quadruped position. */
export const birdDog = (): Pose =>
  side({
    neck: pt(84, 136),
    hip: pt(126, 138),
    armNear: chain(pt(84, 136), 90, 18, 90, 18),
    armFar: [pt(84, 136), pt(54, 124), pt(26, 120)],
    legNear: [pt(126, 138), pt(126, FLOOR_Y), pt(156, FLOOR_Y + 2)],
    legFar: [pt(126, 138), pt(158, 150), pt(188, 146)],
    far: 6
  });

/* ------------------------------------------------------------------ floor */

/**
 * On the back, viewed from the side: the body lies along +x with the head to
 * the left. `legRaise` is how far the legs lift off the mat (0 = flat along the
 * body, 90 = straight up); `armAngle` uses the usual SVG angle convention
 * (270 = straight up).
 */
export const supine = (legRaise = 0, armAngle = 270): Pose => {
  const legAngle = -legRaise;
  return side({
    neck: pt(80, 162),
    hip: pt(124, 162),
    armNear: chain(pt(80, 162), armAngle, FIG.upperArm, armAngle, FIG.foreArm),
    legNear: chain(pt(124, 162), legAngle, FIG.thigh, legAngle, FIG.shin),
    far: 8
  });
};

/** On the back with the knees bent and the feet planted. */
export const supineBent = (): Pose =>
  side({
    neck: pt(80, 166),
    hip: pt(124, 166),
    armNear: chain(pt(80, 166), -16, 26, -8, 24),
    legNear: [pt(124, 166), pt(152, 140), pt(148, FLOOR_Y)],
    far: 8
  });

/** Hips lifted off the floor, shoulders down, knees bent. */
export const gluteBridge = (): Pose =>
  side({
    neck: pt(80, 164),
    hip: pt(124, 138),
    armNear: chain(pt(80, 164), -8, 26, -4, 24),
    legNear: [pt(124, 138), pt(152, 140), pt(148, FLOOR_Y)],
    far: 8
  });

/** Shoulders on a chair, hips driven up to a straight line. */
export const hipThrust = (): Pose =>
  side({
    neck: pt(72, 150),
    hip: pt(118, 128),
    armNear: chain(pt(72, 150), 20, 24, 30, 22),
    legNear: [pt(118, 128), pt(150, 134), pt(146, FLOOR_Y)],
    far: 8
  });

/** Face-down, arms and legs lifted off the floor. */
export const prone = (): Pose =>
  side({
    neck: pt(84, 162),
    hip: pt(126, 162),
    armNear: [pt(84, 162), pt(56, 154), pt(30, 152)],
    legNear: [pt(126, 162), pt(160, 156), pt(192, 154)],
    far: 8
  });

/* ----------------------------------------------------------------- seated */

/** Seated on a chair, hands on the seat edge. `sink` 1 lowers the hips to a dip. */
export const sitChair = (sink = 0): Pose =>
  side({
    neck: pt(96, 84 + 26 * sink),
    hip: pt(96, 130 + 26 * sink),
    armNear: chain(pt(96, 84 + 26 * sink), 96 - 40 * sink, FIG.upperArm, 90, FIG.foreArm),
    legNear: [pt(96, 130 + 26 * sink), pt(124, 130 + 10 * sink), pt(124, FLOOR_Y)],
    far: 8
  });

/** Seated on the floor, legs forward, hands braced behind. */
export const sitFloor = (): Pose =>
  side({
    neck: pt(102, 118),
    hip: pt(104, 164),
    armNear: [pt(102, 118), pt(84, 148), pt(80, FLOOR_Y - 2)],
    legNear: [pt(104, 164), pt(140, 168), pt(174, 168)],
    far: 8
  });

/** Kneeling upright, hips over the knees, shins along the floor. */
export const kneelTall = (): Pose =>
  side({
    neck: pt(100, 92),
    hip: pt(100, 138),
    armNear: chain(pt(100, 92), 78, FIG.upperArm, 84, FIG.foreArm),
    legNear: [pt(100, 138), pt(100, FLOOR_Y), pt(134, FLOOR_Y)],
    far: 8
  });

/** Kneeling with the hips back over the heels, arms long. */
export const childPose = (): Pose =>
  side({
    neck: pt(92, 164),
    hip: pt(128, 158),
    armNear: [pt(92, 164), pt(64, 168), pt(36, 170)],
    legNear: [pt(128, 158), pt(159, FLOOR_Y), pt(192, FLOOR_Y)],
    far: 8
  });

/* -------------------------------------------------------------- hanging */

/** Hanging from a bar. `phase` 0 = dead hang, 1 = chin over the bar. */
export const hang = (phase: number): Pose => {
  const neck = pt(100, 80 - 20 * phase);
  const hip = pt(100, neck.y + FIG.torso);
  return side({
    neck,
    hip,
    armNear: reach(neck, pt(94, 42), 20 * phase),
    armFar: reach(neck, pt(106, 42), 20 * phase),
    legNear: chain(hip, 92, FIG.thigh, 88, FIG.shin),
    far: 0
  });
};

/* ------------------------------------------------------------- lower leg */

/** Rising onto the balls of the feet. `up` 0 = flat, 1 = tall. */
export const calfRaise = (up: number): Pose => {
  const hipY = 104 - 10 * up;
  const neck = pt(100, hipY - FIG.torso);
  return side({
    neck,
    hip: pt(100, hipY),
    armNear: chain(neck, 94, FIG.upperArm, 90, FIG.foreArm),
    legNear: [pt(100, hipY), pt(100, hipY + FIG.thigh), pt(100, FLOOR_Y - 16 * up)]
  });
};

/* ------------------------------------------------------- front-view poses */

const front = (armDeg: number, legSpread = 0, drop = 0): Pose => {
  const neck = pt(100, 58 + drop);
  const hip = pt(100, 104 + drop);
  const armNear = chain(pt(92, 60 + drop), armDeg, FIG.upperArm, armDeg - 4, FIG.foreArm);
  const legNear: [Pt, Pt, Pt] = chain(pt(95, hip.y), 92 + legSpread, FIG.thigh, 90 + legSpread, FIG.shin);
  return { head: pt(100, 34 + drop), neck, hip, armNear, armFar: mirrorChain(armNear), legNear, legFar: mirrorChain(legNear) };
};

export const frontStand = (armDeg = 100): Pose => front(armDeg, 0, 0);

/** Feet apart with the arms overhead (jumping-jack top). */
export const frontLegsApart = (spread = 16): Pose => {
  const p = front(280, 0, -6);
  const hip = p.hip;
  const legNear: [Pt, Pt, Pt] = [pt(96, hip.y), pt(86 - spread * 0.4, 138), pt(78 - spread, FLOOR_Y - 4)];
  return { ...p, legNear, legFar: mirrorChain(legNear) };
};

/** Seated with the torso leaning back, rotating side to side. */
export const frontSitTwist = (twist: number): Pose => {
  const neck = pt(100, 120);
  const hip = pt(100, 158);
  const armNear = chain(pt(92, 124), 50 + twist, 26, 44 + twist, 22);
  const legNear: [Pt, Pt, Pt] = [pt(96, 158), pt(128, 140), pt(150, 170)];
  return { head: pt(100, 102), neck, hip, armNear, armFar: mirrorChain(armNear), legNear, legFar: mirrorChain(legNear) };
};

/** Standing, one leg swung forward (front view). */
export const frontLegSwing = (): Pose => {
  const p = front(104, 0, 0);
  const legNear: [Pt, Pt, Pt] = [pt(95, p.hip.y), pt(78, 140), pt(66, 150)];
  return { ...p, legNear, legFar: mirrorChain(legNear) };
};

/** Standing, hips circling (front view, hands on hips). */
export const frontHipCircle = (): Pose => {
  const p = front(112, 0, 0);
  const armNear = chain(pt(92, 60), 66, 22, 96, 16);
  return { ...p, armNear, armFar: mirrorChain(armNear) };
};

export { mirrorPt, mirrorChain };
