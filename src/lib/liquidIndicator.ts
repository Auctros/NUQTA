/**
 * Spring maths and shape rules behind the sliding selection indicator.
 *
 * Kept free of DOM access so the motion can be unit-tested directly: the
 * component only feeds measured rects in and writes the resulting numbers out.
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/**
 * Underdamped by design: damping is about 0.73 of critical, which gives a
 * small, quickly-absorbed overshoot (~1.3% of travel). That overshoot is what
 * makes the arrival feel weighted rather than mechanical. A long jump settles
 * in about 320ms and an adjacent one in about 280ms.
 */
export const LIQUID_SPRING: SpringConfig = { stiffness: 820, damping: 42, mass: 1 };

export interface SpringChannel {
  value: number;
  velocity: number;
}

/** Integration step is clamped so a stalled frame cannot fling the spring. */
const MAX_STEP = 1 / 15;

/**
 * Fixed integration step.
 *
 * Integrating with whatever `dt` the frame happened to take makes the motion
 * frame-rate dependent: on a slow device every step is larger, and with a hard
 * clamp the travel simply takes longer in wall-clock time. Sub-stepping at a
 * fixed rate keeps the duration identical at 60fps, 30fps or after a stall.
 */
const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;

export function advanceSpring(
  channel: SpringChannel,
  target: number,
  config: SpringConfig,
  dt: number
): SpringChannel {
  const clamped = Math.min(Math.max(dt, 0), MAX_STEP);
  const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.round(clamped / FIXED_STEP)));
  const step = clamped / steps;
  let value = channel.value;
  let velocity = channel.velocity;
  for (let i = 0; i < steps; i += 1) {
    const acceleration = (-config.stiffness * (value - target) - config.damping * velocity) / config.mass;
    velocity += acceleration * step;
    value += velocity * step;
  }
  return { value, velocity };
}

/** Rest thresholds are tighter than a pixel so the settle is invisible. */
export function isAtRest(channel: SpringChannel, target: number, positionEpsilon = 0.25, velocityEpsilon = 6): boolean {
  return Math.abs(channel.value - target) < positionEpsilon && Math.abs(channel.velocity) < velocityEpsilon;
}

export const STRETCH_LIMIT = 0.26;
const STRETCH_DIVISOR = 4200;

/**
 * How far the indicator elongates for a given horizontal speed (px/s).
 * Linear in speed with a hard cap: fast flicks stretch, slow taps barely move,
 * and nothing ever reaches a cartoonish smear.
 */
export function stretchForVelocity(vx: number): number {
  return Math.min(STRETCH_LIMIT, Math.abs(vx) / STRETCH_DIVISOR);
}

export interface LiquidGeometry {
  width: number;
  height: number;
  radius: number;
  stretch: number;
}

/**
 * Applies stretch to the measured box.
 *
 * Width absorbs the elongation while height gives a little back, so the shape
 * keeps a roughly constant area as it moves — the same trick a droplet uses,
 * and the reason the motion reads as a material rather than a scaling box.
 * Radius drifts toward a full pill while stretched, which is what sells the
 * change of form; it returns to the resting radius as the spring settles.
 */
export function liquidGeometry(
  width: number,
  height: number,
  restingRadius: number,
  vx: number,
  squash = true
): LiquidGeometry {
  const stretch = stretchForVelocity(vx);
  const stretchedWidth = width * (1 + stretch);
  // Exact constant-area squash: height shrinks by 1/(1+stretch), so the shape
  // trades width for height instead of growing. A linear approximation leaves
  // the indicator visibly bigger at speed, which reads as a scale-up.
  const stretchedHeight = squash ? height / (1 + stretch) : height;
  const pillRadius = stretchedHeight / 2;
  const morph = Math.min(1, stretch / 0.18);
  return {
    width: stretchedWidth,
    height: stretchedHeight,
    radius: restingRadius + (pillRadius - restingRadius) * morph,
    stretch
  };
}

/** Resolves the CSS radius token for a variant into a concrete pixel value. */
export function resolveRadius(radius: number | 'pill', height: number): number {
  return radius === 'pill' ? height / 2 : radius;
}
