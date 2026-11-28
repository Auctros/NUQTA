import { useEffect, useState } from 'react';

/* ============================================================
   NUQTA — animated presence
   ------------------------------------------------------------
   Keeps a closing surface mounted long enough to animate out,
   then unmounts it for real.

   This replaces an earlier version that waited for an animation
   library's completion callback. Two bugs came with that:
   the callback never fired outside AnimatePresence (a context
   menu survived Escape forever), and the library rendered the
   exiting child from a cached snapshot, so `aria-hidden` and
   `inert` never reached the element still on screen.

   Here the component stays owner of its own markup, every
   attribute follows React state on the way out, and the unmount
   is driven by a timer whose duration is the same constant the
   CSS transition uses. Reopening mid-exit cancels the timer and
   returns straight to the open state, so the transition reverses
   from wherever it had reached instead of restarting.
   ============================================================ */

export interface Presence {
  /** Render the children while true (includes the exit animation). */
  mounted: boolean;
  /** On the way out: must not accept input, must not be announced. */
  exiting: boolean;
}

export function usePresence(open: boolean, exitMs: number): Presence {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs, mounted]);

  return { mounted, exiting: mounted && !open };
}

/**
 * One-frame entrance flag for a surface that animates in.
 *
 * `entering` is true in the very commit where `mounted` turns true — derived,
 * not set in an effect, so the first paint already carries the offset class and
 * the transition has a start value to travel from. It clears on the next frame.
 *
 * Keyed on `mounted` rather than `open` on purpose: reopening mid-exit must not
 * replay the entrance. The surface never unmounted, so it keeps `entering` false
 * and CSS reverses the exit from wherever it had reached.
 */
export function useEntering(mounted: boolean): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!mounted) {
      setSettled(false);
      return;
    }
    if (settled) return;
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [mounted, settled]);

  return mounted && !settled;
}
