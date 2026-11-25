import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon } from '../NuqtaIcon';
import { Button } from './primitives';
import { WheelColumn, type WheelOption } from './TimeWheel';
import { localDateKey, parseDateKey } from '../../lib/dateKey';
import { indexFromWeekStart, weekDayNarrows } from '../../lib/week';
import {
  formatTimeLabel,
  fromHour12,
  parseTimeValue,
  parseTypedTime,
  toHour12,
  toTimeValue,
  useTimeFormat,
  type TimeFormat
} from '../../lib/timeFormat';

/* ============================================================
   NUQTA — branded date & time pickers
   Drop-in replacements for the browser-native date and time
   inputs. They keep the same value contract a native control
   exposes to its handlers — a change event whose `target.value`
   is the string — so existing state, validation and persisted
   values keep working untouched.

   "YYYY-MM-DD" for dates (local day) and "HH:mm" for times, exactly
   like the native controls. The trigger and the floating panel reuse
   NuqtaSelect's design language: same height, radius, border, surface,
   shadow, focus ring and RTL-aware positioning.
   ============================================================ */

export interface NuqtaPickerChangeEvent {
  target: { value: string; name?: string; id?: string };
  currentTarget: { value: string; name?: string; id?: string };
}

interface PickerBaseProps {
  /** "YYYY-MM-DD" for dates, "HH:mm" for times. Empty string = no value. */
  value: string;
  onChange: (event: NuqtaPickerChangeEvent) => void;
  id?: string;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Arabic (RTL) presentation. Defaults to false (English / LTR). */
  isAr?: boolean;
  size?: 'sm' | 'md';
  /** Applied to the trigger button (e.g. `w-full text-xs`). */
  className?: string;
  style?: React.CSSProperties;
  /** Applied to the floating panel. */
  menuClassName?: string;
  /** Show an inline clear affordance when a value is set. */
  clearable?: boolean;
}

// Mirrors NuqtaSelect so a picker sits flush beside a dropdown.
const TRIGGER_BASE =
  'relative inline-flex items-center gap-2 w-full rounded-[var(--r-sm)] border text-start ' +
  'bg-[var(--surface-raised)] text-[var(--text-primary)] transition-colors duration-[var(--dur-fast)] ' +
  'focus:outline-none focus-visible:border-[var(--brand-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_BASE: Record<'sm' | 'md', string> = {
  sm: 'h-8 px-2.5 text-[var(--fs-xs)]',
  md: 'h-10 px-3 text-[var(--fs-sm)]'
};

const PANEL_BASE =
  'fixed overflow-hidden rounded-[var(--r-sm)] border border-[var(--border-default)] ' +
  'bg-[var(--surface-raised)] shadow-[var(--elev-3)]';

/** Shared trigger + outside-click / Escape / positioning behaviour. */
function usePickerShell(
  open: boolean,
  setOpen: (open: boolean) => void,
  panelWidth: number,
  isAr: boolean,
  onEscape: () => void
) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(panelWidth, window.innerWidth - margin * 2);
    // In RTL the panel hangs off the trigger's right edge; clamp inside the viewport.
    const left = isAr
      ? Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin))
      : Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 340 && r.top > spaceBelow;
    setPanelStyle({
      left,
      width,
      maxHeight: Math.min(420, window.innerHeight - margin * 2),
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      zIndex: 'var(--z-dropdown)' as unknown as number
    });
  }, [panelWidth, isAr]);

  useLayoutEffect(() => {
    if (!open) return;
    position();
    const onScrollResize = () => position();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onEscape();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen, onEscape]);

  return { triggerRef, panelRef, panelStyle };
}

const emit = (
  onChange: PickerBaseProps['onChange'],
  value: string,
  name?: string,
  id?: string
) => {
  const target = { value, name, id };
  onChange({ target, currentTarget: target });
};

/* ------------------------------------------------------------
   Date picker
   ------------------------------------------------------------ */

export interface NuqtaDatePickerProps extends PickerBaseProps {
  /** Earliest selectable day ("YYYY-MM-DD"). */
  min?: string;
  /** Latest selectable day ("YYYY-MM-DD"). */
  max?: string;
}

const WEEK_GRID = Array.from({ length: 42 });

export const NuqtaDatePicker: React.FC<NuqtaDatePickerProps> = ({
  value,
  onChange,
  id,
  name,
  ariaLabel,
  placeholder,
  disabled = false,
  invalid = false,
  isAr = false,
  size = 'md',
  className = '',
  style,
  menuClassName = '',
  clearable = false,
  min,
  max
}) => {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => parseDateKey(value) ?? new Date());
  const reactId = useId();
  const panelId = `nuqta-datepicker-${reactId}`;
  const onEscape = useCallback(() => setOpen(false), []);
  const { triggerRef, panelRef, panelStyle } = usePickerShell(open, setOpen, 296, isAr, onEscape);

  useEffect(() => {
    if (open) setViewMonth(parseDateKey(value) ?? new Date());
  }, [open, value]);

  const todayStr = localDateKey();
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startIndex = indexFromWeekStart(new Date(year, month, 1));
  const monthLabel = viewMonth.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric'
  });
  const dayNarrows = weekDayNarrows(isAr);

  const shiftMonth = (delta: number) =>
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const commit = (next: string) => {
    if (next !== value) emit(onChange, next, name, id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const cells = WEEK_GRID.map((_, idx) => {
    const d = new Date(year, month, 1 - startIndex + idx);
    const key = localDateKey(d);
    return {
      key,
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: key === todayStr,
      isSelected: key === value,
      isDisabled: (min !== undefined && key < min) || (max !== undefined && key > max)
    };
  });

  const label = value
    ? (parseDateKey(value) ?? new Date()).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : placeholder || (isAr ? 'اختر تاريخاً' : 'Pick a date');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={style}
        className={[
          TRIGGER_BASE,
          SIZE_BASE[size],
          invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]',
          open ? 'border-[var(--brand-strong)]' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={`flex-1 min-w-0 truncate ${value ? 'tabular-nums' : 'text-[var(--text-tertiary)]'}`}>
          {label}
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            aria-label={isAr ? 'مسح' : 'Clear'}
            className="shrink-0 grid place-items-center w-4 h-4 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              emit(onChange, '', name, id);
            }}
          >
            <NuqtaIcon name="close" className="w-3 h-3" />
          </span>
        ) : (
          <NuqtaIcon
            name="calendar"
            className="w-4 h-4 shrink-0 text-[var(--text-secondary)]"
          />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label={ariaLabel || (isAr ? 'منتقي التاريخ' : 'Date picker')}
            dir={isAr ? 'rtl' : 'ltr'}
            className={[PANEL_BASE, 'p-3 select-none', menuClassName].filter(Boolean).join(' ')}
            style={panelStyle}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                className="icon-btn"
                aria-label={isAr ? 'الشهر السابق' : 'Previous month'}
                onClick={() => shiftMonth(-1)}
              >
                <NuqtaIcon name={isAr ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
              </button>
              <span className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                {monthLabel}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={isAr ? 'الشهر التالي' : 'Next month'}
                onClick={() => shiftMonth(1)}
              >
                <NuqtaIcon name={isAr ? 'chevronLeft' : 'chevronRight'} className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNarrows.map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="text-center text-[var(--fs-micro)] text-[var(--text-tertiary)] py-1"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  disabled={cell.isDisabled}
                  aria-label={cell.key}
                  aria-current={cell.isToday ? 'date' : undefined}
                  aria-selected={cell.isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!cell.isDisabled) commit(cell.key);
                  }}
                  className={[
                    'h-8 rounded-[var(--r-sm)] text-[var(--fs-xs)] tabular-nums transition-colors duration-[var(--dur-fast)]',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
                    cell.isDisabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer',
                    cell.isSelected
                      ? 'bg-[var(--brand)] text-[var(--text-on-accent)] font-[var(--fw-semibold)]'
                      : cell.isToday
                        ? 'text-[var(--brand-strong)] font-[var(--fw-semibold)] ring-1 ring-inset ring-[var(--brand-soft-border)]'
                        : cell.isCurrentMonth
                          ? 'text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
                          : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-chip)]'
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {cell.dayNum}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                className="btn subtle small"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(todayStr);
                }}
              >
                {isAr ? 'اليوم' : 'Today'}
              </button>
              {clearable && value && (
                <button
                  type="button"
                  className="btn subtle small"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit('');
                  }}
                >
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

/* ------------------------------------------------------------
   Time picker
   A wheel picker: two cylindrical columns (hour, minute) plus a
   period control in 12-hour mode. The panel edits a DRAFT and only
   emits on "Set", so scrolling never silently rewrites the stored
   time — closing without confirming is always a cancellation.
   ------------------------------------------------------------ */

export interface NuqtaTimePickerProps extends PickerBaseProps {
  /** Minute granularity (default 1 → every minute, like the native control). */
  minuteStep?: number;
  /**
   * Force 12- or 24-hour presentation for this instance. Without it the picker
   * follows the user's saved preference (`src/lib/timeFormat.ts`).
   */
  hourFormat?: TimeFormat;
}

const MERIDIEM_LABEL: Record<'am' | 'pm', { en: string; ar: string }> = {
  am: { en: 'AM', ar: 'ص' },
  pm: { en: 'PM', ar: 'م' }
};

export const NuqtaTimePicker: React.FC<NuqtaTimePickerProps> = ({
  value,
  onChange,
  id,
  name,
  ariaLabel,
  placeholder,
  disabled = false,
  invalid = false,
  isAr = false,
  size = 'md',
  className = '',
  style,
  menuClassName = '',
  clearable = false,
  minuteStep = 1,
  hourFormat
}) => {
  const [open, setOpen] = useState(false);
  const preference = useTimeFormat();
  const format: TimeFormat = hourFormat ?? preference;
  const is12h = format === '12h';

  const reactId = useId();
  const panelId = `nuqta-timepicker-${reactId}`;
  const titleId = `${panelId}-title`;

  // Draft state: the wheels move this, and only `Set` emits it.
  const [draftHour, setDraftHour] = useState(0);
  const [draftMinute, setDraftMinute] = useState(0);
  // A stored minute that is off the step grid (e.g. 09:07 with a 30-minute step)
  // must stay reachable, otherwise opening the picker would silently move the value.
  const [extraMinute, setExtraMinute] = useState<number | null>(null);

  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState(false);
  const typedRef = useRef<HTMLInputElement | null>(null);

  const step = Math.min(60, Math.max(1, Math.round(minuteStep)));

  const minuteValues = React.useMemo(() => {
    const base: number[] = [];
    for (let m = 0; m < 60; m += step) base.push(m);
    if (extraMinute !== null && !base.includes(extraMinute)) base.push(extraMinute);
    return base.sort((a, b) => a - b);
  }, [step, extraMinute]);

  const seedDraft = useCallback(
    (raw: string) => {
      const parsed = parseTimeValue(raw);
      const next = parsed ?? { h: new Date().getHours(), m: new Date().getMinutes() };
      setDraftHour(next.h);
      setDraftMinute(next.m);
      setExtraMinute(next.m % step === 0 ? null : next.m);
    },
    [step]
  );

  const close = useCallback(() => {
    setOpen(false);
    setTyping(false);
    setTypedError(false);
  }, []);

  // Width is driven by the footer (Now + type + Cancel + Set), which is the widest
  // row; the wheels only need ~140px and stay centred inside it.
  const { triggerRef, panelRef, panelStyle } = usePickerShell(
    open,
    setOpen,
    is12h ? 288 : 264,
    isAr,
    close
  );

  // Seed the draft on open (and re-seed if the committed value changes underneath).
  useEffect(() => {
    if (!open) return;
    seedDraft(value);
    setTyping(false);
    setTypedError(false);
    // `value` is intentionally excluded: re-seeding while the panel is open would
    // fight the user's scrolling. Opening is the moment that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedDraft]);

  useEffect(() => {
    if (!typing) return;
    const timer = window.setTimeout(() => {
      typedRef.current?.focus();
      typedRef.current?.select();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [typing]);

  const { hour: hour12, period } = toHour12(draftHour);

  const hourOptions: WheelOption[] = React.useMemo(
    () =>
      is12h
        ? Array.from({ length: 12 }, (_, i) => {
            const h = i + 1;
            return { value: String(h), label: String(h) };
          })
        : Array.from({ length: 24 }, (_, i) => ({
            value: String(i),
            label: String(i).padStart(2, '0')
          })),
    [is12h]
  );

  const minuteOptions: WheelOption[] = React.useMemo(
    () => minuteValues.map((m) => ({ value: String(m), label: String(m).padStart(2, '0') })),
    [minuteValues]
  );

  const hourIndex = is12h ? hour12 - 1 : draftHour;
  const minuteIndex = Math.max(0, minuteValues.indexOf(draftMinute));

  const setHourIndex = (next: number) => {
    setDraftHour(is12h ? fromHour12(next + 1, period) : next);
  };

  const setMinuteIndex = (next: number) => {
    const minute = minuteValues[Math.min(next, minuteValues.length - 1)];
    if (minute !== undefined) setDraftMinute(minute);
  };

  const setPeriod = (next: 'am' | 'pm') => {
    if (next === period) return;
    setDraftHour((h) => (next === 'pm' ? (h % 12) + 12 : h % 12));
  };

  const commit = (h: number, m: number) => {
    const next = toTimeValue(h, m);
    if (next !== value) emit(onChange, next, name, id);
    close();
    triggerRef.current?.focus();
  };

  const applyTyped = () => {
    const parsed = parseTypedTime(typed, format);
    if (parsed === null) {
      setTypedError(true);
      return;
    }
    const { h, m } = parseTimeValue(parsed)!;
    setDraftHour(h);
    setDraftMinute(m);
    setExtraMinute(m % step === 0 ? null : m);
    setTypedError(false);
    setTyping(false);
  };

  const startTyping = () => {
    setTyped(formatTimeLabel(toTimeValue(draftHour, draftMinute), format, isAr));
    setTypedError(false);
    setTyping(true);
  };

  const label = value ? formatTimeLabel(value, format, isAr) : '';
  const placeholderText = placeholder || (isAr ? 'اختر وقتاً' : 'Pick a time');

  const periodButton = (next: 'am' | 'pm') => {
    const active = period === next;
    return (
      <button
        key={next}
        type="button"
        aria-pressed={active}
        onClick={() => setPeriod(next)}
        className={[
          'flex-1 rounded-[var(--r-sm)] py-1.5 text-[var(--fs-xs)] font-[var(--fw-semibold)]',
          'transition-colors duration-[var(--dur-fast)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
          active
            ? 'bg-[var(--brand)] text-[var(--text-on-accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-chip)] hover:text-[var(--text-primary)]'
        ].join(' ')}
      >
        {MERIDIEM_LABEL[next][isAr ? 'ar' : 'en']}
      </button>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={style}
        className={[
          TRIGGER_BASE,
          SIZE_BASE[size],
          invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]',
          open ? 'border-[var(--brand-strong)]' : '',
          className
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={`flex-1 min-w-0 truncate ${value ? 'tabular-nums' : 'text-[var(--text-tertiary)]'}`}>
          {label || placeholderText}
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            aria-label={isAr ? 'مسح' : 'Clear'}
            className="shrink-0 grid place-items-center w-4 h-4 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              emit(onChange, '', name, id);
            }}
          >
            <NuqtaIcon name="close" className="w-3 h-3" />
          </span>
        ) : (
          <NuqtaIcon name="clock" className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            dir={isAr ? 'rtl' : 'ltr'}
            className={[PANEL_BASE, 'select-none', menuClassName].filter(Boolean).join(' ')}
            style={panelStyle}
          >
            <div className="px-3 pt-2.5 pb-1">
              <span
                id={titleId}
                className="block text-[var(--fs-micro)] font-[var(--fw-semibold)] uppercase tracking-wide text-[var(--text-tertiary)]"
              >
                {ariaLabel || (isAr ? 'منتقي الوقت' : 'Time')}
              </span>
            </div>

            {typing ? (
              <div className="px-3 pb-1 pt-1">
                <label htmlFor={`${panelId}-input`} className="sr-only">
                  {isAr ? 'أدخل الوقت' : 'Type a time'}
                </label>
                <input
                  ref={typedRef}
                  id={`${panelId}-input`}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={typed}
                  aria-invalid={typedError || undefined}
                  aria-describedby={typedError ? `${panelId}-hint` : undefined}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setTypedError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyTyped();
                    }
                  }}
                  className={[
                    'w-full rounded-[var(--r-sm)] border bg-[var(--surface-inset)] px-3 py-2',
                    'text-center text-[var(--fs-lg)] font-[var(--fw-semibold)] tabular-nums',
                    'text-[var(--text-primary)] outline-none',
                    'focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
                    typedError ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]'
                  ].join(' ')}
                />
                <p
                  id={`${panelId}-hint`}
                  className={[
                    'mt-1.5 text-center text-[var(--fs-micro)]',
                    typedError ? 'text-[var(--state-danger)]' : 'text-[var(--text-tertiary)]'
                  ].join(' ')}
                  role={typedError ? 'alert' : undefined}
                >
                  {typedError
                    ? isAr
                      ? 'صيغة غير صحيحة. جرّب 9:30 أو 21:45.'
                      : 'Not a valid time. Try 9:30 or 21:45.'
                    : is12h
                      ? isAr
                        ? 'مثال: 9:30 م'
                        : 'e.g. 9:30 PM'
                      : isAr
                        ? 'مثال: 21:45'
                        : 'e.g. 21:45'}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 px-3 pt-1">
                <WheelColumn
                  label={isAr ? 'الساعة' : 'Hour'}
                  options={hourOptions}
                  index={hourIndex}
                  onIndexChange={setHourIndex}
                  data-wheel="hour"
                />
                <span
                  aria-hidden="true"
                  className="pb-0.5 text-[var(--fs-lg)] font-[var(--fw-semibold)] text-[var(--text-tertiary)]"
                >
                  :
                </span>
                <WheelColumn
                  label={isAr ? 'الدقيقة' : 'Minute'}
                  options={minuteOptions}
                  index={minuteIndex}
                  onIndexChange={setMinuteIndex}
                  data-wheel="minute"
                />
                {is12h && (
                  <div
                    role="group"
                    aria-label={isAr ? 'صباحاً أو مساءً' : 'AM or PM'}
                    className="ms-1 flex h-[124px] w-11 flex-col gap-1 self-center rounded-[var(--r-sm)] bg-[var(--surface-inset)] p-1"
                  >
                    {periodButton('am')}
                    {periodButton('pm')}
                  </div>
                )}
              </div>
            )}

            <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn subtle small"
                  onClick={() => {
                    seedDraft('');
                    setTyping(false);
                  }}
                >
                  {isAr ? 'الآن' : 'Now'}
                </button>
                <button
                  type="button"
                  className="btn subtle small"
                  aria-pressed={typing}
                  aria-label={isAr ? 'إدخال الوقت يدوياً' : 'Type a time instead'}
                  title={isAr ? 'إدخال الوقت يدوياً' : 'Type a time instead'}
                  onClick={() => (typing ? setTyping(false) : startTyping())}
                >
                  <NuqtaIcon name="edit" className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={close}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => commit(draftHour, draftMinute)}>
                  {isAr ? 'تعيين' : 'Set'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
