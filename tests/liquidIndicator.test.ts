import { describe, expect, it } from 'vitest';
import {
  LIQUID_SPRING,
  STRETCH_LIMIT,
  advanceSpring,
  isAtRest,
  liquidGeometry,
  resolveRadius,
  stretchForVelocity,
  type SpringChannel
} from '../src/lib/liquidIndicator';

const FRAME = 1 / 60;

function runToRest(distance: number, fps = 60, config = LIQUID_SPRING) {
  let channel: SpringChannel = { value: 0, velocity: 0 };
  let elapsed = 0;
  let peak = 0;
  const dt = 1 / fps;
  while (elapsed < 2) {
    channel = advanceSpring(channel, distance, config, dt);
    elapsed += dt;
    peak = Math.max(peak, channel.value);
    if (isAtRest(channel, distance)) break;
  }
  return { channel, elapsed, peak };
}

describe('advanceSpring', () => {
  it('converges on the target', () => {
    const { channel } = runToRest(436);
    expect(channel.value).toBeCloseTo(436, 0);
    expect(Math.abs(channel.velocity)).toBeLessThan(6);
  });

  it('settles quickly enough to feel responsive', () => {
    const { elapsed } = runToRest(436);
    expect(elapsed).toBeGreaterThan(0.2);
    expect(elapsed).toBeLessThan(0.45);
  });

  it('overshoots only slightly, so the arrival is weighted but not bouncy', () => {
    const { peak } = runToRest(436);
    const overshoot = (peak - 436) / 436;
    expect(overshoot).toBeGreaterThan(0);
    expect(overshoot).toBeLessThan(0.04);
  });

  it('takes the same wall-clock time at 60fps and 30fps', () => {
    const fast = runToRest(436, 60).elapsed;
    const slow = runToRest(436, 30).elapsed;
    // Frame quantisation alone may differ; the travel itself must not stretch.
    expect(Math.abs(fast - slow)).toBeLessThan(0.08);
  });

  it('is not flung by a long stalled frame', () => {
    let channel: SpringChannel = { value: 0, velocity: 0 };
    channel = advanceSpring(channel, 100, LIQUID_SPRING, 2);
    // A 2s gap is clamped, so the value must stay within the travel envelope.
    expect(channel.value).toBeGreaterThanOrEqual(-40);
    expect(channel.value).toBeLessThanOrEqual(160);
  });

  it('carries state across a retarget instead of restarting from zero', () => {
    let channel: SpringChannel = { value: 0, velocity: 0 };
    for (let i = 0; i < 4; i += 1) channel = advanceSpring(channel, 400, LIQUID_SPRING, FRAME);
    const before = { ...channel };
    expect(before.velocity).toBeGreaterThan(0);

    const retargeted = advanceSpring(before, 100, LIQUID_SPRING, FRAME);

    // A restart would snap back toward the origin; a continuation keeps the
    // travelled distance and only bends the path toward the new target.
    expect(retargeted.value).toBeGreaterThan(before.value);
    expect(retargeted.velocity).not.toBe(0);
    expect(retargeted.velocity).not.toBe(before.velocity);
  });
});

describe('stretchForVelocity', () => {
  it('does not stretch at rest', () => {
    expect(stretchForVelocity(0)).toBe(0);
  });

  it('grows with speed', () => {
    expect(stretchForVelocity(400)).toBeGreaterThan(0);
    expect(stretchForVelocity(800)).toBeGreaterThan(stretchForVelocity(400));
  });

  it('is symmetric, so direction never changes the amount', () => {
    expect(stretchForVelocity(-700)).toBeCloseTo(stretchForVelocity(700), 6);
  });

  it('is capped', () => {
    expect(stretchForVelocity(999999)).toBe(STRETCH_LIMIT);
  });
});

describe('liquidGeometry', () => {
  it('returns the measured box unchanged at rest', () => {
    const g = liquidGeometry(114, 40, 20, 0);
    expect(g.width).toBeCloseTo(114, 5);
    expect(g.height).toBeCloseTo(40, 5);
    expect(g.radius).toBeCloseTo(20, 5);
    expect(g.stretch).toBe(0);
  });

  it('widens and shortens while moving', () => {
    const g = liquidGeometry(114, 40, 20, 900);
    expect(g.width).toBeGreaterThan(114);
    expect(g.height).toBeLessThan(40);
  });

  it('morphs toward a capsule while stretched', () => {
    const calm = liquidGeometry(114, 40, 8, 0);
    const fast = liquidGeometry(114, 40, 8, 1200);
    expect(fast.radius).toBeGreaterThan(calm.radius);
  });

  it('keeps a roughly constant area, so the shape does not read as a scale-up', () => {
    const calm = liquidGeometry(114, 40, 20, 0);
    const fast = liquidGeometry(114, 40, 20, 1200);
    const calmArea = calm.width * calm.height;
    const fastArea = fast.width * fast.height;
    expect(fastArea / calmArea).toBeGreaterThan(0.9);
    expect(fastArea / calmArea).toBeLessThan(1.1);
  });

  it('never exceeds the stretch cap', () => {
    const g = liquidGeometry(100, 40, 20, 99999);
    expect(g.stretch).toBeLessThanOrEqual(STRETCH_LIMIT);
    expect(g.width).toBeLessThanOrEqual(100 * (1 + STRETCH_LIMIT) + 0.001);
  });

  it('can be told not to squash, for thin rails', () => {
    const squashed = liquidGeometry(100, 40, 20, 900, true);
    const rigid = liquidGeometry(100, 40, 20, 900, false);
    expect(rigid.height).toBeGreaterThan(squashed.height);
    expect(rigid.height).toBeCloseTo(40, 5);
  });
});

describe('resolveRadius', () => {
  it('turns pill into half the height', () => {
    expect(resolveRadius('pill', 40)).toBe(20);
  });

  it('passes numbers through', () => {
    expect(resolveRadius(12, 40)).toBe(12);
  });
});
