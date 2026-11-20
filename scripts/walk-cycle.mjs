/**
 * Generates the Walking Studio walk-cycle keyframes and parallax timings for
 * src/index.css.
 *
 * Legs are a two-bone chain (thigh → shin → foot) nested so each joint sits at its own
 * group's local origin, which makes a bone rotate exactly about its joint. Hand-picked
 * joint angles make the planted foot skate and float, so the angles are solved here and
 * baked into CSS keyframes: the animation stays on the compositor (no per-frame React
 * renders) while the sole still meets the ground.
 *
 * The pelvis is held at a fixed height H = sqrt(REACH² − (STRIDE/2)²). That single
 * choice makes the whole thing exact: at heel strike and toe-off the ankle is STRIDE/2
 * away from under the hip, so the leg is exactly straight (knee 0°), and at mid-stance
 * the knee flexes to ~12°. Because the hip never moves, the planted sole cannot sink or
 * lift — there is no bob to book-keep and no way to introduce float.
 *
 * Run `node scripts/walk-cycle.mjs` to print the CSS for src/index.css. The values are
 * baked into the stylesheet rather than computed at runtime, so retuning the stride means
 * re-running this script and pasting the output; the timing in the stylesheet reads the
 * emitted `--walk-cycle` variable so the two cannot drift apart silently.
 */

export const CYCLE = 1.1; // seconds per full stride (both legs)
export const STANCE = 0.6; // fraction of the cycle a foot is planted
export const STRIDE = 26; // units the planted foot travels backwards per stance
export const L1 = 30; // thigh length
export const L2 = 26; // shin length
export const REACH = L1 + L2;
export const LIFT = 7; // how far the ankle rises at mid-swing

/** Fixed hip height above the planted ankle: leg exactly straight at heel strike. */
export const HIP = Math.sqrt(REACH * REACH - (STRIDE / 2) ** 2);

/** Ground speed implied by the stride: the planted foot and the ground share it. */
export const GROUND_SPEED = STRIDE / (STANCE * CYCLE);

const DEG = 180 / Math.PI;
const clamp = (v) => Math.max(-1, Math.min(1, v));

/** Ankle position relative to the hip at phase p. +x is forward, +y is down. */
export function ankleAt(p) {
  const q = ((p % 1) + 1) % 1;
  const half = STRIDE / 2;
  if (q < STANCE) {
    const u = q / STANCE;
    return { x: half - STRIDE * u, y: HIP, stance: true };
  }
  const u = (q - STANCE) / (1 - STANCE);
  const eased = u * u * (3 - 2 * u); // smoothstep: no velocity jump at the swap
  return { x: -half + STRIDE * eased, y: HIP - LIFT * Math.sin(Math.PI * u), stance: false };
}

/**
 * Two-bone IK for a hip→ankle offset. SVG rotate(t) sends a downward bone (0,L) to
 * (-L sin t, L cos t), so a positive t swings the bone backwards.
 * Returns the thigh's absolute angle and the knee's angle relative to the thigh.
 */
export function solveLeg(ax, ay) {
  const d = Math.min(Math.hypot(ax, ay), REACH - 0.001);
  const alpha = Math.atan2(-ax, ay); // straight-leg angle toward the target
  const B = Math.acos(clamp((d * d + L1 * L1 - L2 * L2) / (2 * d * L1)));
  const K = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
  // Subtracting B puts the knee on the +x side of the hip→ankle line, which is the
  // forward-bending human knee; adding it would bend the leg backwards like a bird's.
  const thigh = alpha - B;
  const shin = Math.PI - K;
  // The foot is nested under the shin, so it inherits thigh+shin rotation;
  // counter-rotating by exactly that keeps the sole level with the ground.
  const foot = -(thigh + shin) * DEG;
  return { thigh: thigh * DEG, shin: shin * DEG, foot };
}

/** Forward kinematics, used to prove the solved angles land the ankle on its target. */
export function forward(thighDeg, shinDeg) {
  const t1 = thighDeg / DEG;
  const t2 = shinDeg / DEG;
  const knee = { x: -L1 * Math.sin(t1), y: L1 * Math.cos(t1) };
  const ankle = {
    x: knee.x - L2 * Math.sin(t1 + t2),
    y: knee.y + L2 * Math.cos(t1 + t2),
  };
  return { knee, ankle };
}

export function poseAt(p) {
  const a = ankleAt(p);
  return { p, ...a, ...solveLeg(a.x, a.y) };
}

/** Evenly spaced phases. SAMPLES is a multiple of 5 so the stance/swing swap is hit. */
export const SAMPLES = 20;

export function poses() {
  const out = [];
  for (let i = 0; i <= SAMPLES; i += 1) out.push(poseAt(i / SAMPLES));
  return out;
}

/**
 * Depth bands. `speed` is a multiple of ground speed; `tile` is the repeat width in
 * viewBox units. Duration is derived so a band slides exactly one tile per loop, making
 * the frame at 100% pixel-identical to 0% — no visible reset. Anything standing on the
 * walking plane uses speed 1, or the planted foot skates against the ground.
 */
export const BANDS = [
  { name: 'clouds', speed: 0.15, tile: 400 },
  { name: 'ridge-far', speed: 0.2, tile: 800 },
  { name: 'ridge-near', speed: 0.32, tile: 800 },
  { name: 'trees-far', speed: 0.45, tile: 400 },
  { name: 'trees', speed: 0.65, tile: 800 },
  { name: 'path', speed: 1, tile: 400 },
  { name: 'flowers', speed: 1, tile: 400 },
  { name: 'foreground', speed: 1.5, tile: 200 },
];

export const bandDuration = (b) => b.tile / (GROUND_SPEED * b.speed);

/**
 * The pose used when the scene is idle or motion is reduced: the ankle hangs straight
 * below the hip at the hip's own height, so the sole rests exactly on the ground.
 */
export function standingPose() {
  return solveLeg(0, HIP);
}

const keyframe = (name, pick) => {
  const rows = poses().map((s) => {
    const pct = +(s.p * 100).toFixed(4);
    return `  ${pct}% { transform: rotate(${pick(s).toFixed(3)}deg); }`;
  });
  return `@keyframes ${name} {\n${rows.join('\n')}\n}`;
};

/**
 * Arms swing opposite the same-side leg, so the arm curve is the negated thigh curve.
 * Baking the phase in (rather than using animation-delay) keeps each limb's intent
 * readable: the near arm is backward exactly when the near leg is forward.
 */
export function css() {
  return [
    // The cycle length is emitted rather than hand-typed: if the stride is retuned, the
    // CSS timing and the baked keyframes must move together or the feet start skating.
    `.walk-scene { --walk-cycle: ${CYCLE}s; }`,
    keyframe('walk-thigh', (s) => s.thigh),
    keyframe('walk-shin', (s) => s.shin),
    keyframe('walk-foot', (s) => s.foot),
    keyframe('walk-arm', (s) => -0.6 * s.thigh),
    keyframe('walk-forearm', (s) => 0.25 * s.thigh - 8),
    // One scroll loop per band: translate exactly one tile, so 100% is pixel-identical
    // to 0% and the loop has no visible seam. Duration is derived from the stride, so
    // the ground plane moves at the speed the planted foot implies — no skating.
    ...BANDS.map(
      (b) =>
        `@keyframes walk-scroll--${b.name} {\n  from { transform: translateX(0); }\n  to { transform: translateX(-${b.tile}px); }\n}`
    ),
    '',
    ...BANDS.map(
      (b) =>
        `.walk-scene.is-walking .walk-band--${b.name} { animation: walk-scroll--${b.name} ${bandDuration(b).toFixed(2)}s linear infinite; }`
    ),
  ].join('\n\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`reach=${REACH}  hip=${HIP.toFixed(2)} (fixed, no bob)`);
  console.log(`ground speed = ${GROUND_SPEED.toFixed(2)} units/s`);
  console.log(`stride ${STRIDE} over ${(STANCE * CYCLE).toFixed(3)}s stance`);
  console.log(`stride length per cycle = ${(GROUND_SPEED * CYCLE).toFixed(1)} units\n`);
  console.log(
    poses()
      .map(
        (s) =>
          `p=${s.p.toFixed(3)} ${s.stance ? 'STANCE' : 'swing '}  ` +
          `ankleX=${s.x.toFixed(1).padStart(6)}  ankleY=${s.y.toFixed(2).padStart(6)}  ` +
          `thigh=${s.thigh.toFixed(1).padStart(7)}  shin=${s.shin.toFixed(1).padStart(7)}  ` +
          `foot=${s.foot.toFixed(1).padStart(6)}`
      )
      .join('\n')
  );
  console.log('\nband durations (exactly one tile per loop):');
  for (const b of BANDS) {
    console.log(
      `  ${b.name.padEnd(12)} speed=${String(b.speed).padEnd(5)} tile=${String(b.tile).padEnd(4)} ${bandDuration(b).toFixed(2)}s`
    );
  }
  console.log('\n' + css());
}
