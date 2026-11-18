import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon } from '../NuqtaIcon';
import { localDateKey, parseDateKey } from '../../lib/dateKey';
import { indexFromWeekStart, weekDayNarrows } from '../../lib/week';

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
   ------------------------------------------------------------ */

export interface NuqtaTimePickerProps extends PickerBaseProps {
  /** Minute granularity (default 1 → every minute, like the native control). */
  minuteStep?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

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
  minuteStep = 1
}) => {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const panelId = `nuqta-timepicker-${reactId}`;
  const onEscape = useCallback(() => setOpen(false), []);
  const { triggerRef, panelRef, panelStyle } = usePickerShell(open, setOpen, 224, isAr, onEscape);
  const hoursRef = useRef<HTMLDivElement | null>(null);
  const minutesRef = useRef<HTMLDivElement | null>(null);

  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
    String(i * minuteStep).padStart(2, '0')
  );

  const [hour, minute] = value ? value.split(':') : ['', ''];

  useEffect(() => {
    if (!open) return;
    const center = (container: HTMLDivElement | null) => {
      if (!container) return;
      const el = container.querySelector<HTMLElement>('[data-selected="true"]');
      if (el) container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    };
    center(hoursRef.current);
    center(minutesRef.current);
  }, [open]);

  const commit = (nextHour: string, nextMinute: string) => {
    const next = nextHour && nextMinute ? `${nextHour}:${nextMinute}` : '';
    if (next !== value) emit(onChange, next, name, id);
  };

  const label = value || placeholder || (isAr ? 'اختر وقتاً' : 'Pick a time');

  const column = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    list: string[],
    selected: string,
    onPick: (v: string) => void,
    caption: string
  ) => (
    <div className="flex-1 min-w-0 flex flex-col">
      <span className="px-1 pb-1 text-[var(--fs-micro)] font-[var(--fw-semibold)] text-[var(--text-tertiary)] uppercase tracking-wide">
        {caption}
      </span>
      <div
        ref={containerRef}
        role="listbox"
        aria-label={caption}
        className="relative h-[188px] overflow-y-auto rounded-[var(--r-sm)] bg-[var(--surface-inset)] p-1 flex flex-col gap-0.5"
      >
        {list.map((v) => {
          const isSelected = v === selected;
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected || undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(v);
              }}
              className={[
                'h-7 rounded-[var(--r-sm)] text-[var(--fs-xs)] tabular-nums text-center transition-colors duration-[var(--dur-fast)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
                isSelected
                  ? 'bg-[var(--brand)] text-[var(--text-on-accent)] font-[var(--fw-semibold)]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );

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
            aria-label={ariaLabel || (isAr ? 'منتقي الوقت' : 'Time picker')}
            dir={isAr ? 'rtl' : 'ltr'}
            className={[PANEL_BASE, 'p-2 select-none', menuClassName].filter(Boolean).join(' ')}
            style={panelStyle}
          >
            <div className="flex gap-1">
              {column(hoursRef, HOURS, hour, (h) => commit(h, minute || '00'), isAr ? 'ساعة' : 'Hour')}
              {column(minutesRef, minutes, minute, (m) => commit(hour || '00', m), isAr ? 'دقيقة' : 'Min')}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)] px-1">
              <button
                type="button"
                className="btn subtle small"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const now = new Date();
                  commit(String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'));
                }}
              >
                {isAr ? 'الآن' : 'Now'}
              </button>
              {clearable && value && (
                <button
                  type="button"
                  className="btn subtle small"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit('', '');
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
