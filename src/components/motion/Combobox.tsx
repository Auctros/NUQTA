import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon } from '../NuqtaIcon';
import { OVERLAY_TIMING, useReducedMotion } from '../../lib/motion';
import { useEntering, usePresence } from '../../lib/usePresence';
import { MovingHighlight, useMovingHighlight } from './MovingHighlight';

/* ============================================================
   NUQTA — combobox
   ------------------------------------------------------------
   Reference: Animate UI "Combobox".

   A text input over a *predefined* list, for "pick from what
   already exists" — never for inventing records. Two rules keep
   that honest:

     1. Options carry real entity ids supplied by the caller; the
        component never fabricates one.
     2. Selected values are reconciled against the current option
        set, so a value whose entity was deleted elsewhere is
        dropped from the chips rather than lingering as a ghost.

   Multi-select shows removable chips. Filtering keeps the
   entrance stagger from replaying on every keystroke by keying
   rows on their id — a row that survives the filter keeps its
   animation identity and simply stays put.
   ============================================================ */

export interface ComboboxOption {
  /** Real entity id. Never synthesised by this component. */
  value: string;
  label: string;
  /** Optional secondary text shown muted after the label. */
  description?: string;
  /** Optional group heading; options are rendered in the order given. */
  group?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  /** Single: a value (or ''). Multiple: an array of values. */
  mode?: 'single' | 'multiple';
  value: string | string[];
  onChange: (next: string | string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Message shown when the query matches nothing (vs. when there are no options at all). */
  emptyLabel?: string;
  noOptionsLabel?: string;
  className?: string;
  id?: string;
}

const normalize = (s: string) => s.toLowerCase().trim();

/** A tiny diacritic-tolerant fold so Arabic input matches Arabic labels. */
const fold = (s: string) =>
  normalize(s)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  mode = 'single',
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  emptyLabel = 'No matches',
  noOptionsLabel = 'Nothing to choose from',
  className = '',
  id
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listId = `nuqta-combobox-${reactId}`;
  const reduced = useReducedMotion();
  const presence = usePresence(open, OVERLAY_TIMING.menuOut);
  const entering = useEntering(presence.mounted);

  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  /**
   * Drop selections whose entity no longer exists. Without this a deleted goal
   * would keep appearing as a chip that writes a link to nothing.
   */
  useEffect(() => {
    if (mode !== 'multiple') return;
    const known = new Set(options.map((o) => o.value));
    const pruned = selectedValues.filter((v) => known.has(v));
    if (pruned.length !== selectedValues.length) onChange(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, mode]);

  const filtered = useMemo(() => {
    const q = fold(query);
    const base = q ? options.filter((o) => fold(o.label).includes(q) || fold(o.description ?? '').includes(q)) : options;
    return base;
  }, [options, query]);

  const isChosen = useCallback((v: string) => selectedValues.includes(v), [selectedValues]);

  const toggle = useCallback(
    (optionValue: string) => {
      if (mode === 'multiple') {
        const next = isChosen(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(next);
        // Multi-select stays open: picking several is the common case.
        return;
      }
      onChange(optionValue);
      setOpen(false);
      inputRef.current?.focus();
    },
    [mode, isChosen, selectedValues, onChange]
  );

  const positionPopup = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const MENU_MAX = 260;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX, 180) && r.top > spaceBelow;
    setPopupStyle({
      position: 'fixed',
      width: r.width,
      maxHeight: MENU_MAX,
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      zIndex: 'var(--z-dropdown)' as unknown as number
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionPopup();
    const onScrollResize = () => positionPopup();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, positionPopup]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.parentElement?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const move = (dir: 1 | -1) => {
    setActiveIndex((prev) => {
      if (filtered.length === 0) return 0;
      let next = prev;
      for (let step = 0; step < filtered.length; step += 1) {
        next = (next + dir + filtered.length) % filtered.length;
        if (!filtered[next]?.disabled) return next;
      }
      return prev;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        else move(-1);
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIndex(Math.max(0, filtered.length - 1));
        }
        break;
      case 'Enter': {
        const opt = filtered[activeIndex];
        if (open && opt && !opt.disabled) {
          e.preventDefault();
          toggle(opt.value);
        }
        break;
      }
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          setQuery('');
        }
        break;
      case 'Backspace':
        // With an empty query, Backspace removes the last chip — the familiar
        // way to unwind a multi-select without aiming at a small X.
        if (mode === 'multiple' && query === '' && selectedValues.length > 0) {
          onChange(selectedValues.slice(0, -1));
        }
        break;
      default:
        break;
    }
  };

  const highlightRect = useMovingHighlight({
    containerRef: listRef,
    activeIndex: open ? activeIndex : -1,
    deps: [query],
    enabled: open
  });

  const selectedOptions = selectedValues
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is ComboboxOption => Boolean(o));

  const inputId = id ?? `nuqta-combobox-input-${reactId}`;

  return (
    <div className={`relative ${className}`}>
      {mode === 'multiple' && selectedOptions.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className={`inline-flex max-w-full items-center gap-1 rounded-[var(--r-full)] border border-[var(--border-default)] bg-[var(--surface-chip)] px-2 py-1 text-[var(--fs-xs)] text-[var(--text-primary)]${
                reduced ? '' : ' nq-indicator--pop'
              }`}
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              <button
                type="button"
                onClick={() => toggle(opt.value)}
                aria-label={`Remove ${opt.label}`}
                className="shrink-0 rounded-full p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]"
              >
                <NuqtaIcon name="close" className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={[
            'w-full h-9 rounded-[var(--r-sm)] border border-[var(--border-default)]',
            'bg-[var(--surface-raised)] px-2.5 pe-8 text-[var(--fs-sm)] text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus-visible:border-[var(--brand-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          ].join(' ')}
        />
        <NuqtaIcon
          name="chevronDown"
          className={`pointer-events-none absolute inset-y-0 end-2.5 my-auto w-4 h-4 text-[var(--text-secondary)] transition-transform duration-[var(--dur-fast)] ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>

      {createPortal(
        presence.mounted ? (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable={mode === 'multiple' || undefined}
            tabIndex={-1}
            aria-hidden={presence.exiting || undefined}
            inert={presence.exiting || undefined}
            className={`nq-menu relative overflow-y-auto rounded-[var(--r-sm)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-3)] py-1${
              entering ? ' nq-menu--entering' : ''
            }`}
            data-state={presence.exiting ? 'closed' : 'open'}
            style={popupStyle}
          >
            <MovingHighlight rect={highlightRect} className="bg-[var(--surface-chip)]" />
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[var(--fs-xs)] text-[var(--text-tertiary)]">
                {options.length === 0 ? noOptionsLabel : emptyLabel}
              </div>
            ) : (
              filtered.map((opt, i) => {
                const chosen = isChosen(opt.value);
                return (
                  <div
                    key={opt.value}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={chosen}
                    aria-disabled={opt.disabled || undefined}
                    data-highlight-item="true"
                    style={
                      reduced
                        ? undefined
                        : ({ '--nq-row-delay': `${Math.min(i * 22, 220)}ms` } as React.CSSProperties)
                    }
                    onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!opt.disabled) toggle(opt.value);
                    }}
                    className={[
                      'relative flex items-center gap-2 px-3 py-2 text-[var(--fs-sm)] cursor-pointer select-none',
                      opt.disabled
                        ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                        : 'text-[var(--text-primary)]',
                      chosen ? 'font-[var(--fw-semibold)] text-[var(--brand-strong)]' : '',
                      reduced ? '' : 'nq-row-in'
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="block truncate text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {chosen && (
                      <span className={`shrink-0${reduced ? '' : ' nq-indicator--pop'}`}>
                        <NuqtaIcon name="check" className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
};
