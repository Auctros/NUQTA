/* ============================================================
   NUQTA — shared motion foundation
   ------------------------------------------------------------
   The one place that owns timing vocabulary for every interaction
   component, so menus, dialogs and highlights feel like one
   product while each keeps its own motion *shape*.

   Everything here is dependency-free. Surface transitions are CSS
   (see the `nq-*` rules in index.css) and the one travelling
   highlight integrates a spring itself (src/lib/useSpringRect.ts).
   `SpringCheck` deliberately does not use this module at all: the
   most-pressed control in the app animates a single scalar with a
   local rAF integrator, and invariant 27 enforces that.
   ============================================================ */

import { useEffect, useState } from 'react';

/**
 * Spring presets in the vocabulary `springParams` understands, used by the
 * local integrator that drives the travelling highlight.
 *
 * `snappy` — menus and popovers: settles before the eye tracks it.
 * `soft`   — dialogs and sheets: visible travel, no wobble.
 * `bouncy` — thumb and highlight movement, where overshoot is the point.
 */
export const SPRING_RECT = {
  snappy: { visualDuration: 0.28, bounce: 0.18 },
  soft: { visualDuration: 0.42, bounce: 0.12 },
  bouncy: { visualDuration: 0.34, bounce: 0.42 }
} as const;

export type SpringPreset = keyof typeof SPRING_RECT;

/**
 * Surface timings in milliseconds, shared by the CSS transitions and the
 * presence timers that decide when a closing surface may unmount. Both sides
 * read the same constant, which is what stops a panel from disappearing
 * mid-fade or lingering after it has finished.
 *
 * Exit is always shorter than entrance: waiting to dismiss feels broken.
 */
export const OVERLAY_TIMING = {
  backdropIn: 180,
  backdropOut: 120,
  panelIn: 320,
  panelOut: 200,
  /** Menus enter and leave faster than dialogs: they are pointer-scale surfaces. */
  menuIn: 160,
  menuOut: 120
} as const;

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Live reduced-motion flag. Re-evaluates when the OS setting changes mid-session
 * instead of only at mount, so a user who turns it on is not stranded with motion.
 *
 * Reduced motion must not remove information — only travel. Callers keep every
 * visual state (selected, checked, open) fully rendered and drop the movement.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** Reading direction, for arrow-key and slide direction that must follow the layout. */
export function isRtlElement(el: HTMLElement | null): boolean {
  if (!el || typeof window === 'undefined') return false;
  return window.getComputedStyle(el).direction === 'rtl';
}
