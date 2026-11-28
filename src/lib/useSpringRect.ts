import { useEffect, useRef } from 'react';
import { springParams, springStep, usePrefersReducedMotion } from './useSpringValue';

/* ============================================================
   NUQTA — springed rectangle
   ------------------------------------------------------------
   One integrator, four scalars. The travelling highlight moves
   x, y, width and height together, so it needs the same damped
   spring `SpringCheck` already uses rather than a second motion
   engine: `springStep` from useSpringValue.ts does the maths,
   and this hook only fans it out across the four channels.

   `onFrame` receives plain numbers and is expected to write
   straight to the DOM via refs. A 60fps animation must never
   re-render React, which is why nothing here holds state.
   ============================================================ */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpringRectConfig {
  /** Perceptual duration in seconds, as in useSpringValue. */
  visualDuration: number;
  /** 0 = critically damped, 1 = very bouncy. */
  bounce: number;
}

const SETTLE_EPSILON = 0.5;
const MAX_FRAME_SECONDS = 0.064;
const FIXED_STEP = 1 / 120;

const stepSpan = (current: number, velocity: number, target: number, omega: number, zeta: number, dt: number) =>
  springStep({ x: current, v: velocity }, target, omega, zeta, dt);

/**
 * Animate from the current rectangle to `target` on the next frames.
 *
 * Passing `null` leaves the current position alone (used when a list empties
 * while the highlight fades), and changing `target` mid-flight retargets every
 * channel from its *current* position and velocity, so a fast pointer sweep
 * curves into the new row instead of restarting.
 */
export function useSpringRect(
  target: Rect | null,
  config: SpringRectConfig,
  onFrame: (rect: Rect) => void,
  enabled = true
): void {
  const frame = useRef(onFrame);
  frame.current = onFrame;

  const position = useRef<Rect | null>(null);
  const velocity = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const raf = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const { visualDuration, bounce } = config;

  useEffect(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (!target) return;

    // First appearance has nothing to travel from: start on the target so the
    // highlight appears in place instead of flying in from the origin.
    if (!position.current) {
      position.current = { ...target };
      velocity.current = { x: 0, y: 0, width: 0, height: 0 };
      frame.current(target);
      return;
    }

    if (reduced) {
      position.current = { ...target };
      velocity.current = { x: 0, y: 0, width: 0, height: 0 };
      frame.current(target);
      return;
    }

    const { omega, zeta } = springParams({ visualDuration, bounce });
    // Seeded from the first frame's timestamp, not performance.now(): the two are
    // normally the same clock, but deriving dt from a mismatched pair yields a
    // negative elapsed that clamps to zero and stalls the very first frame.
    let last: number | null = null;

    const tick = (now: number) => {
      const elapsed = last === null ? FIXED_STEP : Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME_SECONDS);
      last = now;
      const steps = Math.max(1, Math.ceil(elapsed / FIXED_STEP));
      const dt = elapsed > 0 ? elapsed / steps : FIXED_STEP;

      // Per frame, continue from the live position: seeding from the captured
      // start would re-integrate the same span while velocity kept accumulating.
      let next: Rect = position.current as Rect;
      let v = velocity.current;

      for (let i = 0; i < steps; i += 1) {
        const sx = stepSpan(next.x, v.x, target.x, omega, zeta, dt);
        const sy = stepSpan(next.y, v.y, target.y, omega, zeta, dt);
        const sw = stepSpan(next.width, v.width, target.width, omega, zeta, dt);
        const sh = stepSpan(next.height, v.height, target.height, omega, zeta, dt);
        next = { x: sx.x, y: sy.x, width: sw.x, height: sh.x };
        v = { x: sx.v, y: sy.v, width: sw.v, height: sh.v };
      }

      position.current = next;
      velocity.current = v;

      const settled =
        Math.abs(next.x - target.x) < SETTLE_EPSILON &&
        Math.abs(next.y - target.y) < SETTLE_EPSILON &&
        Math.abs(next.width - target.width) < SETTLE_EPSILON &&
        Math.abs(next.height - target.height) < SETTLE_EPSILON &&
        Math.abs(v.x) < SETTLE_EPSILON &&
        Math.abs(v.y) < SETTLE_EPSILON &&
        Math.abs(v.width) < SETTLE_EPSILON &&
        Math.abs(v.height) < SETTLE_EPSILON;

      if (settled) {
        position.current = { ...target };
        velocity.current = { x: 0, y: 0, width: 0, height: 0 };
        frame.current(target);
        raf.current = null;
        return;
      }

      frame.current(next);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [target?.x, target?.y, target?.width, target?.height, enabled, reduced, visualDuration, bounce]);
}
