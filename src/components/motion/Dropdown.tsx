import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon, type IconName } from '../NuqtaIcon';
import { OVERLAY_TIMING, isRtlElement } from '../../lib/motion';
import { MovingHighlight, useMovingHighlight } from './MovingHighlight';
import { useEntering, usePresence } from '../../lib/usePresence';

/* ============================================================
   NUQTA — dropdown
   ------------------------------------------------------------
   Reference: interior.dev "Dropdown".

   One highlight surface travels between rows, driven equally by
   the pointer and by the keyboard — 
   rows never paint their own hover background, so moving from
   "Archive" to "Delete" reads as a single object sliding down
   rather than two independent hovers.

   Kept contracts: disabled rows are skipped by the keyboard but
   still rendered, optional per-row hints, type-ahead, Escape,
   outside-click dismissal, focus restoration to the trigger, and
   a trigger whose width never changes when the value does.
   ============================================================ */

export interface DropdownItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Secondary text, right-aligned (e.g. a shortcut or a count). */
  hint?: string;
  disabled?: boolean;
  /** Renders the row in the danger tone. */
  tone?: 'default' | 'danger';
}

export type DropdownEntry = DropdownItem | { id: string; separator: true };

const isSeparator = (e: DropdownEntry): e is { id: string; separator: true } =>
  (e as { separator?: boolean }).separator === true;

export interface DropdownProps {
  /** Trigger content. Must not be re-laid-out by the popup. */
  trigger: React.ReactNode;
  items: DropdownEntry[];
  onSelect: (id: string) => void;
  ariaLabel?: string;
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
  /** Rendered inside the popup above the rows (e.g. a section label). */
  header?: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  ariaLabel,
  align = 'start',
  disabled = false,
  className = '',
  header
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const typeahead = useRef({ query: '', at: 0 });
  const reactId = useId();
  const menuId = `nuqta-dropdown-${reactId}`;
  const presence = usePresence(open, OVERLAY_TIMING.menuOut);
  const entering = useEntering(presence.mounted);


  const positionMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = isRtlElement(document.body);
    const useEnd = align === 'end' ? !rtl : rtl;
    const MENU_MAX = 300;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX, 180) && r.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      width: Math.max(r.width, 180),
      maxHeight: MENU_MAX,
      ...(useEnd
        ? { right: window.innerWidth - r.right }
        : { left: r.left }),
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      zIndex: 'var(--z-dropdown)' as unknown as number
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    const onScrollResize = () => positionMenu();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(firstEnabledIndex(items));
  }, [open, items]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const entry = items[index];
      if (!entry || isSeparator(entry) || entry.disabled) return;
      onSelect(entry.id);
      close();
    },
    [items, onSelect, close]
  );

  const move = useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((prev) => {
        if (items.length === 0) return -1;
        let next = prev;
        for (let step = 0; step < items.length; step += 1) {
          next = (next + dir + items.length) % items.length;
          const entry = items[next];
          if (!isSeparator(entry) && !entry.disabled) return next;
        }
        return prev;
      });
    },
    [items]
  );

  /** Type-ahead: consecutive printable keys within 600ms build a prefix. */
  const onTypeahead = useCallback(
    (char: string) => {
      const now = Date.now();
      const t = typeahead.current;
      t.query = now - t.at > 600 ? char : t.query + char;
      t.at = now;
      const q = t.query.toLowerCase();
      const start = activeIndex < 0 ? 0 : activeIndex;
      for (let i = 0; i < items.length; i += 1) {
        const idx = (start + i) % items.length;
        const entry = items[idx];
        if (isSeparator(entry) || entry.disabled) continue;
        if (entry.label.toLowerCase().startsWith(q)) {
          setActiveIndex(idx);
          return;
        }
      }
    },
    [activeIndex, items]
  );

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
          setActiveIndex(firstEnabledIndex(items));
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIndex(lastEnabledIndex(items));
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) setOpen(true);
        else commit(activeIndex);
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        if (open) setOpen(false);
        break;
      default:
        if (open && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          onTypeahead(e.key);
        }
        break;
    }
  };

  const highlightRect = useMovingHighlight({
    containerRef: menuRef,
    activeIndex: open ? activeIndex : -1,
    enabled: open
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={[
          'inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--border-default)]',
          'bg-[var(--surface-raised)] text-[var(--text-primary)] text-[var(--fs-sm)] px-3 h-9',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        ].join(' ')}
      >
        {trigger}
        <NuqtaIcon
          name="chevronDown"
          className={`w-4 h-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-[var(--dur-fast)] ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {createPortal(
        presence.mounted ? (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            tabIndex={-1}
            aria-hidden={presence.exiting || undefined}
            inert={presence.exiting || undefined}
            className={[
              'nq-menu relative overflow-y-auto rounded-[var(--r-sm)] border border-[var(--border-default)]',
              'bg-[var(--surface-raised)] shadow-[var(--elev-3)] py-1',
              entering ? 'nq-menu--entering' : ''
            ].join(' ')}
            data-state={presence.exiting ? 'closed' : 'open'}
            style={menuStyle}
          >
            <MovingHighlight rect={highlightRect} className="bg-[var(--surface-chip)]" />
            {header && (
              <div className="px-3 pb-1 pt-1.5 text-[var(--fs-micro)] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {header}
              </div>
            )}
            {items.map((entry, i) => {
              if (isSeparator(entry)) {
                return (
                  <div
                    key={entry.id}
                    role="separator"
                    className="my-1 h-px bg-[var(--border-subtle)]"
                  />
                );
              }
              const isActive = i === activeIndex && !entry.disabled;
              return (
                <div
                  key={entry.id}
                  role="menuitem"
                  aria-disabled={entry.disabled || undefined}
                  data-highlight-item="true"
                  onMouseEnter={() => !entry.disabled && setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(i);
                  }}
                  className={[
                    'relative flex items-center gap-2 px-3 py-2 text-[var(--fs-sm)] cursor-pointer select-none',
                    entry.disabled
                      ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                      : entry.tone === 'danger'
                        ? 'text-[var(--state-danger)]'
                        : 'text-[var(--text-primary)]',
                    isActive && entry.tone === 'danger' ? 'font-[var(--fw-semibold)]' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {entry.icon && <NuqtaIcon name={entry.icon} className="w-4 h-4 shrink-0" />}
                  <span className="flex-1 min-w-0 truncate">{entry.label}</span>
                  {entry.hint && (
                    <span className="shrink-0 text-[var(--fs-micro)] text-[var(--text-tertiary)] tabular-nums">
                      {entry.hint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null,
        document.body
      )}
    </>
  );
};

function firstEnabledIndex(items: DropdownEntry[]): number {
  return items.findIndex((e) => !isSeparator(e) && !e.disabled);
}

function lastEnabledIndex(items: DropdownEntry[]): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const e = items[i];
    if (!isSeparator(e) && !e.disabled) return i;
  }
  return items.length - 1;
}
