import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LIQUID_SPRING,
  advanceSpring,
  isAtRest,
  liquidGeometry,
  resolveRadius,
  SpringChannel,
  SpringConfig
} from './liquidIndicator';

/** Which child the indicator should sit under. */
const SELECTOR = '[aria-selected="true"], [aria-pressed="true"], [data-selected="true"]';

/** Candidate items, used to work out what the indicator currently covers. */
const ITEM_SELECTOR = '[role="tab"], [aria-pressed], [data-selected]';

export type LiquidMode = 'fill' | 'underline';

const EMPTY_TARGET = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Marks the item the indicator is physically sitting over.
 *
 * A filled indicator makes the label colour depend on what is behind it rather
 * than on what is selected: while it travels between two distant tabs it passes
 * over the ones in between, and those labels lose contrast unless the ink
 * follows the shape. Writing straight to the DOM keeps this off the render path.
 */
function markCovered(container: HTMLElement, left: number, width: number): void {
  const right = left + width;
  container.querySelectorAll<HTMLElement>('[data-liquid-covered]').forEach((el) => {
    el.removeAttribute('data-liquid-covered');
  });
  container.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
    const elWidth = el.offsetWidth;
    if (!elWidth) return;
    const overlap = Math.min(right, el.offsetLeft + elWidth) - Math.max(left, el.offsetLeft);
    if (overlap / elWidth >= 0.5) el.setAttribute('data-liquid-covered', 'true');
  });
}

function clearCovered(container: HTMLElement | null): void {
  container?.querySelectorAll<HTMLElement>('[data-liquid-covered]').forEach((el) => {
    el.removeAttribute('data-liquid-covered');
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface UseLiquidIndicatorOptions {
  /** Re-measure when the set of items changes. */
  deps?: unknown[];
  /** `underline` pins a thin rule to the bottom edge instead of filling. */
  mode?: LiquidMode;
  /** Thickness of the rule in `underline` mode. */
  underlineThickness?: number;
  /** Resting corner radius in px, or `pill`. */
  radius?: number | 'pill';
  /** Vertical squish while travelling; meaningless for underline. */
  squash?: boolean;
  config?: SpringConfig;
}

/**
 * Tracks the selected child of a container and drives a single moving
 * indicator with a spring.
 *
 * Nothing here is React state per frame: styles are written to the node inside
 * the animation loop, so a 60fps travel costs no renders. The spring is never
 * reset on retarget — rapid switching only moves the target and the indicator
 * keeps its velocity, so it flows between positions instead of restarting.
 */
export function useLiquidIndicator({
  deps = [],
  mode = 'fill',
  underlineThickness = 2,
  radius,
  squash = true,
  config = LIQUID_SPRING
}: UseLiquidIndicatorOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = useState(false);

  const target = useRef({ ...EMPTY_TARGET });
  const channels = useRef<Record<'x' | 'y' | 'w' | 'h', SpringChannel>>({
    x: { value: 0, velocity: 0 },
    y: { value: 0, velocity: 0 },
    w: { value: 0, velocity: 0 },
    h: { value: 0, velocity: 0 }
  });
  const frame = useRef<number | null>(null);
  const lastTime = useRef(0);
  const restingRadius = useRef(0);
  const readyRef = useRef(false);

  const modeRef = useRef(mode);
  const thicknessRef = useRef(underlineThickness);
  const radiusRef = useRef(radius);
  const squashRef = useRef(squash);
  const configRef = useRef(config);
  modeRef.current = mode;
  thicknessRef.current = underlineThickness;
  radiusRef.current = radius;
  squashRef.current = squash;
  configRef.current = config;

  const paint = useCallback((x: number, y: number, w: number, h: number, velocity: number) => {
    const node = indicatorRef.current;
    if (!node) return;
    const squish = modeRef.current === 'underline' ? false : squashRef.current;
    const geometry = liquidGeometry(w, h, restingRadius.current, velocity, squish);
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    node.style.width = `${geometry.width}px`;
    node.style.height = `${geometry.height}px`;
    node.style.borderRadius = `${geometry.radius}px`;
    if (modeRef.current !== 'underline' && containerRef.current) {
      markCovered(containerRef.current, x, w);
    }
  }, []);

  const settle = useCallback(() => {
    const t = target.current;
    channels.current = {
      x: { value: t.x, velocity: 0 },
      y: { value: t.y, velocity: 0 },
      w: { value: t.width, velocity: 0 },
      h: { value: t.height, velocity: 0 }
    };
    paint(t.x, t.y, t.width, t.height, 0);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    lastTime.current = 0;
  }, [paint]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(SELECTOR);
    if (!container || !active) {
      clearCovered(container);
      readyRef.current = false;
      setReady(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    // Absolute children of a scroll container live in its content box, so the
    // scroll offset has to be added back to make the maths viewport-free.
    const x = activeRect.left - containerRect.left + (container.scrollLeft ?? 0) - container.clientLeft;
    const top = activeRect.top - containerRect.top + (container.scrollTop ?? 0) - container.clientTop;

    if (modeRef.current === 'underline') {
      const thickness = thicknessRef.current;
      target.current = {
        x,
        y: top + activeRect.height - thickness,
        width: activeRect.width,
        height: thickness
      };
      restingRadius.current = thickness / 2;
    } else {
      target.current = { x, y: top, width: activeRect.width, height: activeRect.height };
      if (radiusRef.current === 'pill') {
        restingRadius.current = activeRect.height / 2;
      } else if (typeof radiusRef.current === 'number') {
        restingRadius.current = radiusRef.current;
      } else {
        // No radius given: inherit the item's own corner so the indicator always
        // matches the geometry it is covering, whatever the variant decides.
        const computed = parseFloat(window.getComputedStyle(active).borderTopLeftRadius);
        restingRadius.current = Number.isFinite(computed) ? Math.min(computed, activeRect.height / 2) : 0;
      }
    }

    if (!readyRef.current || prefersReducedMotion()) {
      settle();
      readyRef.current = true;
      setReady(true);
    }
  }, [settle]);

  const step = useCallback(
    (time: number) => {
      const dt = lastTime.current ? (time - lastTime.current) / 1000 : 1 / 60;
      lastTime.current = time;
      const t = target.current;
      const cfg = configRef.current;

      const x = advanceSpring(channels.current.x, t.x, cfg, dt);
      const y = advanceSpring(channels.current.y, t.y, cfg, dt);
      const w = advanceSpring(channels.current.w, t.width, cfg, dt);
      const h = advanceSpring(channels.current.h, t.height, cfg, dt);
      channels.current = { x, y, w, h };

      paint(x.value, y.value, w.value, h.value, x.velocity);

      const done = isAtRest(x, t.x) && isAtRest(y, t.y) && isAtRest(w, t.width) && isAtRest(h, t.height);
      if (done) {
        // Land exactly on the measured box so labels never sit off-centre.
        settle();
        return;
      }
      frame.current = requestAnimationFrame(step);
    },
    [paint, settle]
  );

  const start = useCallback(() => {
    if (prefersReducedMotion()) return;
    if (frame.current !== null) return;
    lastTime.current = 0;
    frame.current = requestAnimationFrame(step);
  }, [step]);

  useLayoutEffect(() => {
    measure();
    start();
  }, [measure, start, ...deps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const remeasure = () => {
      measure();
      start();
    };

    // Selection is owned by the parent's state, not by this hook, so watch the
    // attributes that carry it rather than relying on a re-render.
    const mutations = new MutationObserver(remeasure);
    mutations.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'aria-pressed', 'data-selected']
    });

    const resize = new ResizeObserver(remeasure);
    resize.observe(container);
    container.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => resize.observe(el));

    const onScroll = () => remeasure();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Web fonts land after first paint and change label widths.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(remeasure);

    return () => {
      mutations.disconnect();
      resize.disconnect();
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure, start]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      clearCovered(containerRef.current);
    },
    []
  );

  return { containerRef, indicatorRef, ready };
}
