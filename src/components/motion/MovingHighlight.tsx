import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSpringRect, type Rect } from '../../lib/useSpringRect';
import { SPRING_RECT, useReducedMotion } from '../../lib/motion';

/* ============================================================
   NUQTA — moving highlight
   ------------------------------------------------------------
   One surface that travels between rows instead of each row
   painting its own hover background. Shared by Dropdown, Select,
   Combobox, ContextMenu and the sidebar navigation.

   The highlight is decorative: it is `aria-hidden`, sits behind
   the labels, and is never the element that receives navigation.
   Keyboard focus and the active destination stay on the real
   buttons underneath, so screen readers and URL sync are
   unaffected.

   Movement comes from `useSpringRect`, which runs the same damped
   spring as `SpringCheck`. The animated rect is written straight to
   the node's style in a rAF loop, so travelling never re-renders
   React or the rows it passes over.
   ============================================================ */

export type HighlightRect = Rect;

/**
 * Measures the active row and keeps the measurement honest.
 *
 * Re-measures on container resize, on any dependency change, and once web fonts
 * have loaded — a label that grows when its font swaps in would otherwise leave
 * the highlight short of the row it is meant to cover.
 */
export function useMovingHighlight(options: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Index of the row to cover, or -1 to hide the highlight. */
  activeIndex: number;
  /** Row selector inside the container. */
  itemSelector?: string;
  deps?: unknown[];
  enabled?: boolean;
}): HighlightRect | null {
  const {
    containerRef,
    activeIndex,
    itemSelector = '[data-highlight-item]',
    deps = [],
    enabled = true
  } = options;
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
    const target = activeIndex >= 0 ? items[activeIndex] : undefined;
    if (!target) {
      setRect(null);
      return;
    }
    const next: HighlightRect = {
      x: target.offsetLeft,
      y: target.offsetTop,
      width: target.offsetWidth,
      height: target.offsetHeight
    };
    setRect((prev) =>
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next
    );
  }, [containerRef, activeIndex, itemSelector]);

  useLayoutEffect(() => {
    if (!enabled) return;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeIndex, ...deps]);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    // A font swap changes label widths after first paint.
    let cancelled = false;
    document.fonts?.ready?.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [containerRef, measure, enabled]);

  return rect;
}

export interface MovingHighlightProps {
  rect: HighlightRect | null;
  className?: string;
  /** Travel preset. Rows that are far apart read better with a slightly softer spring. */
  preset?: 'snappy' | 'soft' | 'bouncy';
}

/**
 * The travelling surface itself. Rendered at zero opacity until a row is active,
 * so an un-hovered menu looks exactly like a plain list.
 */
export const MovingHighlight: React.FC<MovingHighlightProps> = ({
  rect,
  className = '',
  preset = 'snappy'
}) => {
  const reduced = useReducedMotion();
  const nodeRef = useRef<HTMLSpanElement | null>(null);
  const visible = rect !== null;

  useSpringRect(
    rect,
    SPRING_RECT[preset],
    useCallback(
      (next: Rect) => {
        const el = nodeRef.current;
        if (!el) return;
        el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
        el.style.width = `${next.width}px`;
        el.style.height = `${next.height}px`;
      },
      []
    ),
    visible
  );

  // Opacity is not springed: it is a crossfade, and a spring would make a
  // disappearing highlight linger over the row beneath it.
  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: reduced ? 'none' : 'opacity var(--dur-fast) var(--ease-standard)',
    willChange: 'transform, width, height'
  };

  return (
    <span
      ref={nodeRef}
      aria-hidden="true"
      className={`pointer-events-none absolute start-0 top-0 ${className}`}
      style={style}
    />
  );
};
