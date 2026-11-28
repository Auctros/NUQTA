import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MovingHighlight, useMovingHighlight } from '../src/components/motion/MovingHighlight';
import { springParams, springStep } from '../src/lib/useSpringValue';

/** Read the translated Y from `translate3d(...)`; jsdom writes the z channel as `0px`. */
const translateY = (el: HTMLElement) => {
  const m = /translate3d\([^,]+,\s*([-\d.]+)px/.exec(el.style.transform);
  return m ? Number(m[1]) : Number.NaN;
};

/* ============================================================
   Phase 1 experiment: can the local rAF spring drive the
   travelling highlight with no animation library?

   These exercise the integrator directly and the component in a
   jsdom with a controllable clock, so the assertions are about
   observed positions rather than "did we call animate".
   ============================================================ */

/**
 * Deterministic rAF: callbacks run only when the test advances time.
 *
 * `advance` flushes pending effects first. React runs effects at the *end* of
 * `act`, so advancing inside the same `act` that scheduled the frame would step
 * an empty queue — which is how an earlier version of this harness reported a
 * working animation as broken.
 */
function installClock() {
  let now = 0;
  let queue: Array<(t: number) => void> = [];
  let nextId = 1;
  const live = new Map<number, (t: number) => void>();
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = nextId += 1;
    live.set(id, cb as (t: number) => void);
    return id;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    live.delete(id);
  });
  const advance = (ms: number, frame = 16) => {
    // Let React commit effects so the frame callback exists before we step time.
    act(() => {});
    act(() => {
      for (let elapsed = 0; elapsed < ms; elapsed += frame) {
        now += frame;
        const due = [...live.values()];
        live.clear();
        due.forEach((cb) => cb(now));
        if (live.size === 0) break;
      }
    });
  };
  const pending = () => live.size;
  return {
    advance,
    pending,
    restore: () => { raf.mockRestore(); cancel.mockRestore(); }
  };
}

describe('springStep integrator (Phase 1 basis)', () => {
  it('converges on the target and stays there', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.28, bounce: 0.18 });
    let state = { x: 0, v: 0 };
    for (let i = 0; i < 240; i += 1) state = springStep(state, 100, omega, zeta, 1 / 120);
    expect(state.x).toBeCloseTo(100, 3);
    expect(Math.abs(state.v)).toBeLessThan(0.5);
  });

  it('moves monotonically toward the target for a critically damped spring', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.3, bounce: 0 });
    let state = { x: 0, v: 0 };
    let previous = -1;
    for (let i = 0; i < 200; i += 1) {
      state = springStep(state, 100, omega, zeta, 1 / 120);
      expect(state.x).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(state.x).toBeLessThanOrEqual(100 + 1e-6);
      previous = state.x;
    }
  });

  it('reverses from its current position and velocity when retargeted mid-flight', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.28, bounce: 0.18 });
    let state = { x: 0, v: 0 };
    for (let i = 0; i < 30; i += 1) state = springStep(state, 100, omega, zeta, 1 / 120);
    const posAtRetarget = state.x;
    const velAtRetarget = state.v;
    expect(posAtRetarget).toBeGreaterThan(0);
    expect(velAtRetarget).toBeGreaterThan(0);

    // Retarget to 0 while still travelling right: it must decelerate from where
    // it is, not teleport and not restart from rest.
    const next = springStep(state, 0, omega, zeta, 1 / 120);
    // No teleport: one substep moves it a fraction of a pixel.
    expect(Math.abs(next.x - posAtRetarget)).toBeLessThan(5);
    // And the velocity has flipped toward the new target rather than staying positive.
    expect(next.v).toBeLessThan(velAtRetarget);
  });
});

describe('MovingHighlight on the local spring', () => {
  let clock: ReturnType<typeof installClock>;

  beforeEach(() => { clock = installClock(); });
  afterEach(() => { clock.restore(); });

  /** Three rows with fixed geometry, driven by hover and arrow keys. */
  function Menu({ reduced = false }: { reduced?: boolean }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [index, setIndex] = useState(-1);
    const rect = useMovingHighlight({ containerRef, activeIndex: index });

    return (
      <div
        ref={containerRef}
        role="listbox"
        tabIndex={0}
        style={{ position: 'relative' }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, 2));
          if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
        }}
      >
        <MovingHighlight rect={reduced ? null : rect} preset="snappy" />
        {['Alpha', 'Bravo', 'Charlie'].map((label, i) => (
          <button
            key={label}
            type="button"
            data-highlight-item
            data-testid={`row-${i}`}
            onMouseEnter={() => setIndex(i)}
            onFocus={() => setIndex(i)}
            style={{ display: 'block', width: 200, height: 32, position: 'relative' }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  /** jsdom reports zero geometry, so give each row a real layout. */
  function stubGeometry() {
    const rows = screen.getAllByTestId(/^row-/);
    rows.forEach((row, i) => {
      Object.defineProperty(row, 'offsetLeft', { configurable: true, value: 8 });
      Object.defineProperty(row, 'offsetTop', { configurable: true, value: i * 32 });
      Object.defineProperty(row, 'offsetWidth', { configurable: true, value: 200 });
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 32 });
    });
  }

  const highlight = (container: HTMLElement) =>
    container.querySelector('[aria-hidden="true"]') as HTMLSpanElement;

  it('starts hidden and shows in place on first hover', () => {
    const { container } = render(<Menu />);
    stubGeometry();
    const el = highlight(container);
    expect(el.style.opacity).toBe('0');

    fireEvent.mouseEnter(screen.getByTestId('row-0'));
    expect(el.style.opacity).toBe('1');
    // First appearance must not fly in from the origin.
    expect(translateY(el)).toBeCloseTo(0, 5);
  });

  it('travels between rows on mouse moves and settles on the target', () => {
    const { container } = render(<Menu />);
    stubGeometry();
    const el = highlight(container);

    fireEvent.mouseEnter(screen.getByTestId('row-0'));
    act(() => clock.advance(400));
    expect(translateY(el)).toBeCloseTo(0, 5);

    fireEvent.mouseEnter(screen.getByTestId('row-2'));
    // Mid-flight: somewhere strictly between the two rows.
    act(() => clock.advance(48));
    const midY = translateY(el);
    expect(midY).toBeGreaterThan(0);
    expect(midY).toBeLessThan(64);

    act(() => clock.advance(600));
    expect(translateY(el)).toBeCloseTo(64, 3);
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('32px');
    // Settled means the loop stopped rather than idling on rAF forever.
    expect(clock.pending()).toBe(0);
  });

  it('moves the highlight with arrow keys as well as the pointer', () => {
    const { container } = render(<Menu />);
    stubGeometry();
    const el = highlight(container);
    const menu = screen.getByRole('listbox');

    fireEvent.mouseEnter(screen.getByTestId('row-0'));
    act(() => clock.advance(500));

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    act(() => clock.advance(600));
    expect(translateY(el)).toBeCloseTo(32, 3);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    act(() => clock.advance(600));
    expect(translateY(el)).toBeCloseTo(64, 3);

    // Clamped at the last row.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    act(() => clock.advance(600));
    expect(translateY(el)).toBeCloseTo(64, 3);
  });

  it('retargets smoothly when interrupted mid-flight', () => {
    const { container } = render(<Menu />);
    stubGeometry();
    const el = highlight(container);

    fireEvent.mouseEnter(screen.getByTestId('row-0'));
    act(() => clock.advance(400));

    fireEvent.mouseEnter(screen.getByTestId('row-2'));
    act(() => clock.advance(40));
    const interrupted = translateY(el);
    expect(interrupted).toBeGreaterThan(0);
    expect(interrupted).toBeLessThan(64);

    // Reverse to row 0 before the first trip finished.
    fireEvent.mouseEnter(screen.getByTestId('row-0'));
    act(() => clock.advance(16));
    const afterReverse = translateY(el);
    // Continues from where it was: no snap back to 0 and no jump past it.
    expect(afterReverse).toBeGreaterThan(-2);
    expect(Math.abs(afterReverse - interrupted)).toBeLessThan(25);

    act(() => clock.advance(800));
    expect(translateY(el)).toBeCloseTo(0, 3);
    expect(clock.pending()).toBe(0);
  });

  it('re-measures when the rows change size', () => {
    // jsdom has no layout engine, so capture the observer the hook registers and
    // fire it the way a font swap or a wider label would.
    const observers: Array<() => void> = [];
    const original = globalThis.ResizeObserver;
    (globalThis as any).ResizeObserver = class {
      constructor(cb: () => void) { observers.push(cb); }
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    try {
      const { container } = render(<Menu />);
      stubGeometry();
      const el = highlight(container);

      fireEvent.mouseEnter(screen.getByTestId('row-1'));
      act(() => clock.advance(500));
      expect(el.style.width).toBe('200px');

      screen.getAllByTestId(/^row-/).forEach((row, i) => {
        Object.defineProperty(row, 'offsetWidth', { configurable: true, value: 260 });
        Object.defineProperty(row, 'offsetTop', { configurable: true, value: i * 40 });
      });

      expect(observers.length).toBeGreaterThan(0);
      act(() => {
        observers.forEach((cb) => cb());
      });
      act(() => clock.advance(600));

      expect(el.style.width).toBe('260px');
      expect(translateY(el)).toBeCloseTo(40, 3);
    } finally {
      (globalThis as any).ResizeObserver = original;
    }
  });

  it('follows RTL: the highlight is anchored with logical start, not left', () => {
    const { container } = render(
      <div dir="rtl">
        <Menu />
      </div>
    );
    stubGeometry();
    const el = highlight(container);
    expect(el.className).toContain('start-0');
    expect(el.className).not.toContain('left-0');

    fireEvent.mouseEnter(screen.getByTestId('row-2'));
    act(() => clock.advance(600));
    expect(translateY(el)).toBeCloseTo(64, 3);
  });

  it('snaps without animating when the user asked for reduced motion', () => {
    const { container } = render(<Menu />);
    stubGeometry();
    const el = highlight(container);

    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false
    })) as any;

    try {
      fireEvent.mouseEnter(screen.getByTestId('row-2'));
      act(() => {});
      const y = translateY(el);
      // No rAF budget consumed: it lands immediately.
      expect(y).toBeCloseTo(64, 5);
      expect(clock.pending()).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });
});
