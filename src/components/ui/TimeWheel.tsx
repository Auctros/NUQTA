import React, { useCallback, useEffect, useRef } from 'react';

/* ============================================================
   NUQTA — wheel column
   A cylindrical list: items sit on a vertical drum, the centred
   value is upright and emphasised, and the neighbours fall away
   with rotateX + scale. Native scroll-snap does the physical
   settling, so momentum and trackpad behaviour are the browser's
   own rather than a re-implementation.

   The selection index is the single source of truth. Scrolling
   reports which row is centred; clicks and keys move the index
   and scroll it back into view. Nothing here reads layout to
   decide a value, so it behaves identically without a layout
   engine (tests) and cannot drift from the committed time.
   ============================================================ */

export const WHEEL_ITEM_HEIGHT = 40;
export const WHEEL_VISIBLE_ROWS = 5;

export interface WheelOption {
  value: string;
  label: string;
}

export interface WheelColumnProps {
  options: WheelOption[];
  /** Index into `options`. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Accessible name of the column ("Hour", "Minute", "Period"). */
  label: string;
  disabled?: boolean;
  /** Marks the column as the one driving typed input. */
  'data-wheel'?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const WheelColumn: React.FC<WheelColumnProps> = ({
  options,
  index,
  onIndexChange,
  label,
  disabled = false,
  ...rest
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  // Set while the drum is moving because WE moved it. A smooth scroll emits events
  // at every intermediate offset, and those offsets are not values the person chose
  // — reading them back would walk the index through arbitrary minutes. The guard is
  // therefore released on arrival at the target, not on a timer.
  const programmatic = useRef(false);
  const pendingTarget = useRef<number | null>(null);
  const releaseTimer = useRef<number | null>(null);
  // Set when the index changed because the drum moved. The sync effect must not
  // scroll in that case: snapping to the row the finger just crossed would kill
  // the fling mid-gesture.
  const fromScroll = useRef(false);
  // The first placement must not animate: the drum should already be sitting on the
  // stored value when the panel opens.
  const settled = useRef(false);

  const padding = ((WHEEL_VISIBLE_ROWS - 1) / 2) * WHEEL_ITEM_HEIGHT;

  const release = useCallback(() => {
    programmatic.current = false;
    pendingTarget.current = null;
    if (releaseTimer.current !== null) {
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
  }, []);

  const scrollToIndex = useCallback(
    (next: number, smooth: boolean) => {
      const el = scrollRef.current;
      // The panel is measured after it mounts; retry on the next frame rather than
      // silently leaving the drum at the top.
      if (!el || el.clientHeight <= 0) {
        window.requestAnimationFrame(() => scrollToIndex(next, smooth));
        return;
      }
      const target = next * WHEEL_ITEM_HEIGHT;
      programmatic.current = true;
      pendingTarget.current = target;
      el.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
      // Safety net: if the target is unreachable (clamped by the scroller) the guard
      // would otherwise never lift and the drum would stop responding.
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(release, 800);
    },
    [release]
  );

  // One scroll per index change, so a keyboard step cannot be fought by a second,
  // instant scroll that releases the guard while the smooth one is still moving.
  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    scrollToIndex(index, settled.current);
    settled.current = true;
  }, [index, scrollToIndex]);

  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    },
    []
  );

  const handleScroll = () => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      const el = scrollRef.current;
      if (!el || el.clientHeight <= 0) return;
      if (programmatic.current) {
        if (pendingTarget.current !== null && Math.abs(el.scrollTop - pendingTarget.current) <= 1) {
          release();
        }
        return;
      }
      const next = clamp(Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT), 0, options.length - 1);
      if (next !== index) {
        fromScroll.current = true;
        onIndexChange(next);
      }
    });
  };

  const move = (delta: number) => {
    const next = clamp(index + delta, 0, options.length - 1);
    if (next !== index) onIndexChange(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'PageUp':
        event.preventDefault();
        move(-5);
        break;
      case 'PageDown':
        event.preventDefault();
        move(5);
        break;
      case 'Home':
        event.preventDefault();
        onIndexChange(0);
        break;
      case 'End':
        event.preventDefault();
        onIndexChange(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="nuqta-wheel-frame">
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={label}
        aria-orientation="vertical"
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="nuqta-wheel"
        style={{ height: WHEEL_VISIBLE_ROWS * WHEEL_ITEM_HEIGHT }}
        {...rest}
      >
        <div style={{ height: padding }} aria-hidden="true" />
        {options.map((option, i) => {
          const distance = i - index;
          const abs = Math.abs(distance);
          const selected = distance === 0;
          return (
            <div
              key={option.value}
              role="option"
              aria-selected={selected}
              data-selected={selected || undefined}
              aria-label={option.label}
              onClick={() => {
                if (disabled || selected) return;
                onIndexChange(i);
              }}
              className={`nuqta-wheel-item${selected ? ' is-selected' : ''}`}
              style={{
                height: WHEEL_ITEM_HEIGHT,
                transform: `rotateX(${distance * -22}deg) scale(${Math.max(0.68, 1 - abs * 0.09)})`,
                opacity: abs > 2 ? 0 : Math.max(0.12, 1 - abs * 0.3),
                pointerEvents: abs > 2 ? 'none' : undefined
              }}
            >
              {option.label}
            </div>
          );
        })}
        <div style={{ height: padding }} aria-hidden="true" />
      </div>
    </div>
  );
};
