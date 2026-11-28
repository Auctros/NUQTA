import React, { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { usePrefersReducedMotion, useSpringValue } from '../../lib/useSpringValue';

/**
 * SpringCheck — completion control adapted from React Bits' "Spring Check".
 *
 * The interaction is kept as published: the fill springs out from the centre with a
 * slight overshoot, the tick draws itself, the label is struck through from one side and
 * fades to `doneOpacity`, and everything reverses when the box is unchecked.
 *
 * Three things are deliberately different from the reference:
 *  - Colours come from NUQTA tokens (`--tone-success`, `--text-on-state`) instead of
 *    hardcoded white/black, so the control is legible in every theme.
 *  - The animation is a local rAF spring rather than `motion/react`, so the bundle gains
 *    no animation dependency for a single scalar 0 -> 1.
 *  - Animated properties are written straight to DOM nodes and never passed as `style`
 *    props. React would re-apply a `style` value on every render and fight the animation;
 *    CSS owns the unchecked default, so nothing needs to be re-asserted.
 */

export type StrikeSide = 'left' | 'center' | 'right' | 'none';

export interface SpringCheckProps {
  /** Visible text. Omit for an icon-only box (dense rows, matrices). */
  label?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name. Required when there is no `label`. */
  ariaLabel?: string;
  size?: 'sm' | 'md';
  /** Which edge the strike grows from. `none` disables it. */
  strike?: StrikeSide;
  /** Label opacity once complete. */
  doneOpacity?: number;
  /** 0 = no overshoot. Keep low: this is a settle, not a bounce. */
  bounce?: number;
  className?: string;
}

const VISUAL_DURATION = 0.22;
const RULE_END = 0.84;
const RULE_LAG = 0.12;
const SWELL = 0.18;
/** Same tick geometry as `NuqtaIcon`'s `check`, in its 24x24 space. */
const TICK_PATH = 'm5 12 4 4L19 6';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const SIZES = {
  sm: { box: 18, radius: 6, ring: 1.5, tickWidth: 3.4 },
  md: { box: 22, radius: 7, ring: 1.5, tickWidth: 2.9 }
} as const;

const ORIGIN: Record<StrikeSide, string> = {
  left: 'left center',
  center: 'center',
  right: 'right center',
  none: 'left center'
};

export const SpringCheck: React.FC<SpringCheckProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = 'md',
  strike = 'left',
  doneOpacity = 0.45,
  bounce = 0.18,
  className = ''
}) => {
  const reduced = usePrefersReducedMotion();
  const fillRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const tickRef = useRef<SVGPathElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);

  const paint = (t: number) => {
    const held = clamp01(t);
    if (fillRef.current) fillRef.current.style.transform = `scale(${Math.max(t, 0)})`;
    if (boxRef.current) boxRef.current.style.transform = `scale(${1 + SWELL * Math.max(0, t - 1)})`;
    if (tickRef.current) tickRef.current.style.strokeDashoffset = String(1 - held);
    if (wordRef.current) wordRef.current.style.opacity = String(1 - (1 - doneOpacity) * held);
    if (ruleRef.current) {
      ruleRef.current.style.transform = `scaleX(${clamp01((held - RULE_LAG) / (RULE_END - RULE_LAG))})`;
    }
  };

  useSpringValue(checked ? 1 : 0, { visualDuration: VISUAL_DURATION, bounce }, paint, reduced);

  // Layout effect, not effect: a row that is already complete when the list opens must be
  // painted complete *before* the browser shows it, or it flashes empty for one frame.
  useLayoutEffect(() => {
    paint(checked ? 1 : 0);
    // Only on mount; afterwards the spring owns every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * `onClick` is the single commit path, so the caller's action fires exactly once per
   * activation. A native <button> already maps Enter and Space to click, which is what
   * makes the control keyboard-operable without a key handler.
   */
  const handleClick = () => {
    if (disabled) return;
    onChange(!checked);
  };

  const dims = SIZES[size];
  const hasLabel = label !== undefined && label !== null && label !== '';

  const cssVars = {
    '--sc-box': `${dims.box}px`,
    '--sc-radius': `${dims.radius}px`,
    '--sc-ring': `${dims.ring}px`,
    '--sc-tick': dims.tickWidth,
    '--sc-origin': ORIGIN[strike]
  } as CSSProperties;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        'spring-check',
        `spring-check--${size}`,
        hasLabel ? '' : 'spring-check--bare',
        checked ? 'is-checked' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={cssVars}
      onClick={handleClick}
    >
      <span className="spring-check__press">
        <span ref={boxRef} className="spring-check__box">
          <span className="spring-check__ring" aria-hidden="true" />
          <span ref={fillRef} className="spring-check__fill" aria-hidden="true" />
          <svg className="spring-check__tick" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path ref={tickRef} d={TICK_PATH} pathLength={1} strokeDasharray={1} />
          </svg>
        </span>
      </span>
      {hasLabel ? (
        <span className="spring-check__label">
          <span ref={wordRef} className="spring-check__word">
            {label}
          </span>
          {strike !== 'none' ? <span ref={ruleRef} className="spring-check__rule" aria-hidden="true" /> : null}
        </span>
      ) : null}
    </button>
  );
};

export default SpringCheck;
