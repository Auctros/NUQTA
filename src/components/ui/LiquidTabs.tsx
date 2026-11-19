import React from 'react';
import { useLiquidIndicator } from '../../lib/useLiquidIndicator';

/**
 * Arrow-key navigation for a tablist, per the WAI-ARIA tabs pattern.
 *
 * The items already use roving tabindex (only the selected tab is reachable
 * with Tab), which is correct — but without arrow handling that leaves the
 * other tabs unreachable from the keyboard. Home/End jump to the ends.
 */
function handleArrowKeys(event: React.KeyboardEvent<HTMLDivElement>): void {
  const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!keys.includes(event.key)) return;

  const container = event.currentTarget;
  const items = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (el) => !el.hasAttribute('disabled')
  );
  if (items.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const current = active ? items.indexOf(active) : -1;
  if (current === -1) return;

  // Reading direction matters: the arrow should follow the visual order.
  const rtl = window.getComputedStyle(container).direction === 'rtl';
  const forward = event.key === 'ArrowDown' || (rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight');
  const backward = event.key === 'ArrowUp' || (rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft');

  let next = current;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  else if (forward) next = (current + 1) % items.length;
  else if (backward) next = (current - 1 + items.length) % items.length;

  if (next === current) return;
  event.preventDefault();
  items[next].focus();
  items[next].click();
}

export interface LiquidTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `underline` renders a thin rule pinned to the bottom edge. */
  mode?: 'fill' | 'underline';
  /** Thickness of the rule in `underline` mode. */
  underlineThickness?: number;
  /** Resting corner radius of the indicator in px, or `pill` for a capsule. */
  indicatorRadius?: number | 'pill';
  /** Vertical squish while travelling; meaningless for underline. */
  squash?: boolean;
  /** Changes to this value trigger a re-measure (item list, label, locale). */
  remeasureKey?: string;
}

/**
 * A wrapper that slides one shared indicator beneath whichever child is marked
 * as selected (`aria-selected`, `aria-pressed` or `data-selected`).
 *
 * It renders no buttons of its own, so existing markup, keyboard handling and
 * state stay where they were. The indicator is decorative — `aria-hidden` — and
 * sits behind the labels.
 */
export const LiquidTabs: React.FC<LiquidTabsProps> = ({
  mode = 'fill',
  underlineThickness,
  indicatorRadius,
  squash = true,
  remeasureKey,
  className = '',
  children,
  onKeyDown,
  ...rest
}) => {
  const { containerRef, indicatorRef, ready } = useLiquidIndicator({
    deps: [remeasureKey],
    mode,
    underlineThickness,
    radius: indicatorRadius,
    squash
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    handleArrowKeys(event);
  };

  return (
    <div
      ref={containerRef}
      className={`liquid-tabs ${className}`}
      data-liquid-ready={ready ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <span ref={indicatorRef} className="liquid-tabs-indicator" aria-hidden="true" />
      {children}
    </div>
  );
};
