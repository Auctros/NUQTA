import { useEffect, useRef } from 'react';

/**
 * Focus management for a modal panel.
 *
 * While `open` is true it:
 *   1. remembers the element that had focus before opening,
 *   2. moves focus into the panel (first focusable child, else the panel itself),
 *   3. keeps Tab / Shift+Tab cycling inside the panel (a simple focus trap),
 *   4. restores focus to the previous element on close.
 *
 * Returns a ref to attach to the panel element (which should be focusable —
 * give it `tabIndex={-1}`).
 *
 * It is deliberately dependency-free and side-effect-light so it can be layered
 * onto the existing legacy `.modal` markup without restructuring it.
 */
export function useModalFocus<T extends HTMLElement>(open: boolean) {
  const panelRef = useRef<T | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    previousFocus.current = (document.activeElement as HTMLElement) ?? null;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel).focus();
    };
    const timer = window.setTimeout(focusFirst, 20);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null || el === panel
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      panel.removeEventListener('keydown', onKeyDown);
      const prev = previousFocus.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [open]);

  return panelRef;
}
