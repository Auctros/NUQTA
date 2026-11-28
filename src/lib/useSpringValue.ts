import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Spring motion utilities for the completion controls.
 *
 * These are a deliberately small stand-in for `motion/react`: NUQTA animates exactly one
 * scalar (0 -> 1) and writes it straight to DOM nodes, so pulling in a full animation
 * library would cost more bundle than the effect is worth.
 */

export interface SpringConfig {
  /** Perceptual duration in seconds: the spring settles in roughly this time. */
  visualDuration: number;
  /** 0 = critically damped (no overshoot), 1 = very bouncy. */
  bounce: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * Map `visualDuration` / `bounce` onto a damped harmonic oscillator.
 *
 * `bounce` is the complement of the damping ratio (so 0 is critically damped), and the
 * natural frequency is one full period per `visualDuration`. With the default
 * `bounce: 0.2` the overshoot is about 1.5%, which reads as a settle rather than a wobble.
 */
export function springParams({ visualDuration, bounce }: SpringConfig): {
  omega: number;
  zeta: number;
} {
  const omega = (Math.PI * 2) / Math.max(0.05, visualDuration);
  const zeta = clamp(1 - clamp(bounce, 0, 1), 0.05, 1);
  return { omega, zeta };
}

/**
 * Advance a damped spring by `dt` seconds (semi-implicit Euler).
 *
 * Exported separately from the hook so the integrator can be tested without a DOM.
 */
export function springStep(
  state: { x: number; v: number },
  target: number,
  omega: number,
  zeta: number,
  dt: number
): { x: number; v: number } {
  const acceleration = -omega * omega * (state.x - target) - 2 * zeta * omega * state.v;
  const v = state.v + acceleration * dt;
  return { x: state.x + v * dt, v };
}

const SETTLE_EPSILON = 0.001;
const MAX_FRAME_SECONDS = 0.064;
const FIXED_STEP = 1 / 120;

/**
 * Drive `value` towards `target` with spring physics, calling `onFrame` for each step.
 *
 * `onFrame` writes to refs instead of state, so a 60fps animation never re-renders React.
 * The loop stops itself once the spring has settled, and is cancelled on unmount or when
 * `target` changes mid-flight (a rapid re-click simply reverses from the current position).
 */
export function useSpringValue(
  target: number,
  config: SpringConfig,
  onFrame: (value: number) => void,
  reduced: boolean
): void {
  const frame = useRef(onFrame);
  frame.current = onFrame;

  const state = useRef({ x: target, v: 0 });
  const raf = useRef<number | null>(null);
  const { visualDuration, bounce } = config;

  useEffect(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    if (reduced) {
      state.current = { x: target, v: 0 };
      frame.current(target);
      return;
    }

    const { omega, zeta } = springParams({ visualDuration, bounce });
    let last = performance.now();

    const tick = (now: number) => {
      const elapsed = clamp((now - last) / 1000, 0, MAX_FRAME_SECONDS);
      last = now;
      const steps = Math.max(1, Math.ceil(elapsed / FIXED_STEP));
      const dt = elapsed > 0 ? elapsed / steps : FIXED_STEP;

      let next = state.current;
      for (let i = 0; i < steps; i += 1) {
        next = springStep(next, target, omega, zeta, dt);
      }
      state.current = next;

      const settled =
        Math.abs(next.x - target) < SETTLE_EPSILON && Math.abs(next.v) < SETTLE_EPSILON;
      frame.current(settled ? target : next.x);
      raf.current = settled ? null : requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [target, reduced, visualDuration, bounce]);
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Live `prefers-reduced-motion` flag: the control must respond to a mid-session change. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

/** Stable callback wrapper so the spring loop never sees a new identity mid-animation. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: never[]) => ref.current(...args)) as T, []);
}
