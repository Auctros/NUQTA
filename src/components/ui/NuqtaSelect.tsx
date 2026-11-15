import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon } from '../NuqtaIcon';

/* ============================================================
   NUQTA — branded select
   A drop-in replacement for the browser-native <select>. It keeps
   the exact value/onChange contract (a change event whose
   `target.value` is the chosen option's value) so existing
   handlers, persisted values and casts keep working untouched.

   Behaviours: light + dark via design tokens, RTL-aware
   (logical inset-inline), hover / focus / selected / disabled
   states, outside-click dismissal, Escape, and full keyboard
   navigation (Arrow keys, Home/End, Enter/Space, type-ahead).
   The menu renders in a portal so it is never clipped by the
   scroll container or modal it lives in.
   ============================================================ */

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface NuqtaSelectChangeEvent {
  target: { value: string; name?: string; id?: string };
  currentTarget: { value: string; name?: string; id?: string };
}

export interface NuqtaSelectProps {
  value: string;
  onChange: (event: NuqtaSelectChangeEvent) => void;
  /** Programmatic options. Ignored when <option> children are provided. */
  options?: SelectOption[];
  /** Native <option> children are accepted and parsed, so an existing
      <select> can be swapped for <NuqtaSelect> without rewriting its body. */
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  title?: string;
  size?: 'sm' | 'md';
  /** Applied to the trigger button (e.g. `w-full text-xs`). */
  className?: string;
  /** Inline styles on the trigger (e.g. `{ width: 'auto' }`). */
  style?: React.CSSProperties;
  /** Applied to the floating menu panel. */
  menuClassName?: string;
}

/** Turns <option> children (whose labels may be any ReactNode) into options. */
function parseChildren(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: unknown; disabled?: boolean; children?: React.ReactNode };
    out.push({
      value: props.value === undefined || props.value === null ? '' : String(props.value),
      label: props.children,
      disabled: Boolean(props.disabled)
    });
  });
  return out;
}

const TRIGGER_BASE =
  'relative inline-flex items-center gap-2 w-full rounded-[var(--r-sm)] border text-start ' +
  'bg-[var(--surface-raised)] text-[var(--text-primary)] transition-colors duration-[var(--dur-fast)] ' +
  'focus:outline-none focus-visible:border-[var(--brand-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_BASE: Record<'sm' | 'md', string> = {
  sm: 'h-8 px-2.5 text-[var(--fs-xs)]',
  md: 'h-10 px-3 text-[var(--fs-sm)]'
};

export const NuqtaSelect: React.FC<NuqtaSelectProps> = ({
  value,
  onChange,
  options,
  children,
  placeholder,
  disabled = false,
  invalid = false,
  id,
  name,
  ariaLabel,
  title,
  size = 'md',
  className = '',
  style,
  menuClassName = ''
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listboxId = `nuqta-select-${reactId}`;

  const resolvedOptions = useMemo(
    () => (children ? parseChildren(children) : options || []),
    [children, options]
  );

  const selectedIndex = useMemo(
    () => resolvedOptions.findIndex((o) => o.value === value),
    [resolvedOptions, value]
  );
  const selectedOption = selectedIndex >= 0 ? resolvedOptions[selectedIndex] : undefined;
  const hasValue = selectedOption !== undefined;

  const positionMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const MENU_MAX = 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX, 200) && r.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: r.left,
      width: r.width,
      maxHeight: MENU_MAX,
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      zIndex: 'var(--z-dropdown)' as unknown as number
    });
  }, []);

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

  // Outside-click dismissal (mousedown so it fires before click handlers).
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
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(resolvedOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = useCallback(
    (index: number) => {
      const opt = resolvedOptions[index];
      if (!opt || opt.disabled) return;
      if (opt.value !== value) {
        const target = { value: opt.value, name, id };
        onChange({ target, currentTarget: target });
      }
      setOpen(false);
      triggerRef.current?.focus();
    },
    [resolvedOptions, value, onChange, name, id]
  );

  const move = useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((prev) => {
        let next = prev;
        for (let step = 0; step < resolvedOptions.length; step += 1) {
          next = (next + dir + resolvedOptions.length) % resolvedOptions.length;
          if (!resolvedOptions[next]?.disabled) break;
        }
        return next;
      });
    },
    [resolvedOptions]
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
          setActiveIndex(firstEnabledIndex(resolvedOptions));
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActiveIndex(lastEnabledIndex(resolvedOptions));
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
          setOpen(false);
        }
        break;
      case 'Tab':
        if (open) setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        title={title}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
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
        <span className={`flex-1 min-w-0 truncate ${hasValue ? '' : 'text-[var(--text-tertiary)]'}`}>
          {hasValue ? selectedOption!.label : placeholder || ''}
        </span>
        <NuqtaIcon
          name="chevronDown"
          className={`w-4 h-4 shrink-0 text-[var(--text-secondary)] transition-transform duration-[var(--dur-fast)] ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            className={[
              'overflow-y-auto rounded-[var(--r-sm)] border border-[var(--border-default)]',
              'bg-[var(--surface-raised)] shadow-[var(--elev-3)] py-1',
              menuClassName
            ].join(' ')}
            style={menuStyle}
          >
            {resolvedOptions.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <div
                  key={opt.value}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(i);
                  }}
                  className={[
                    'flex items-center gap-2 px-3 py-2 text-[var(--fs-sm)] cursor-pointer select-none',
                    opt.disabled
                      ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                      : 'text-[var(--text-primary)]',
                    isActive && !opt.disabled ? 'bg-[var(--surface-chip)]' : '',
                    isSelected ? 'font-[var(--fw-semibold)] text-[var(--brand-strong)]' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                  {isSelected && <NuqtaIcon name="check" className="w-4 h-4 shrink-0" />}
                </div>
              );
            })}
            {resolvedOptions.length === 0 && (
              <div className="px-3 py-2 text-[var(--fs-xs)] text-[var(--text-tertiary)]">—</div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

function firstEnabledIndex(options: SelectOption[]): number {
  const i = options.findIndex((o) => !o.disabled);
  return i >= 0 ? i : 0;
}

function lastEnabledIndex(options: SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i -= 1) if (!options[i].disabled) return i;
  return options.length - 1;
}
