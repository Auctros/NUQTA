import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon, type IconName } from '../NuqtaIcon';
import { OVERLAY_TIMING, isRtlElement, useReducedMotion } from '../../lib/motion';
import { useEntering, usePresence } from '../../lib/usePresence';
import { isTopmostOverlay, popOverlay, pushOverlay } from '../../lib/overlayStack';
import { MovingHighlight, useMovingHighlight } from './MovingHighlight';

/* ============================================================
   NUQTA — context menu
   ------------------------------------------------------------
   Reference: Animate UI "Context Menu".

   Opens at the pointer on right-click, at the finger on
   long-press, and from the keyboard via the context-menu key or
   Shift+F10 — in which case it anchors to the focused element
   rather than guessing a pointer position.

   Supports one level of nested submenus (deliberately not more:
   a third level is unusable on touch), checkbox and radio rows
   with animated indicators, disabled rows that stay visible, one
   travelling highlight per panel, and RTL-aware placement.

   It is attached only to real records — never to a generic
   container — so normal text selection, links and inputs keep
   their native behaviour.
   ============================================================ */

export type ContextMenuItem =
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: IconName;
      disabled?: boolean;
      tone?: 'default' | 'danger';
      hint?: string;
      onSelect: () => void;
    }
  | { kind: 'checkbox'; id: string; label: string; checked: boolean; disabled?: boolean; onSelect: () => void }
  | {
      kind: 'radio';
      id: string;
      label: string;
      checked: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: 'submenu'; id: string; label: string; icon?: IconName; disabled?: boolean; items: ContextMenuItem[] }
  | { kind: 'separator'; id: string };

export interface ContextMenuPoint {
  x: number;
  y: number;
}

/** Long-press must be long enough not to fire on a scroll gesture, short enough to feel responsive. */
const LONG_PRESS_MS = 480;
/** Movement beyond this cancels a long-press: the user is scrolling, not pressing. */
const LONG_PRESS_MOVE_PX = 10;

/* ---------- one panel ---------- */

interface PanelProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  /** `root` panels clamp to the viewport; submenus prefer the side with room. */
  variant: 'root' | 'submenu';
  onClose: () => void;
  anchorRect?: DOMRect | null;
  reduced: boolean;
  /** Accessible name. Only meaningful on a root panel. */
  ariaLabel?: string;
  /** True while the panel is visually leaving; it must already be non-interactive. */
  exiting?: boolean;
}

const enabledIndexesOf = (items: ContextMenuItem[]): number[] =>
  items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.kind !== 'separator' && !('disabled' in it && it.disabled))
    .map(({ i }) => i);

const Panel: React.FC<PanelProps> = ({
  items,
  x,
  y,
  variant,
  onClose,
  anchorRect,
  reduced,
  ariaLabel,
  exiting = false
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const entering = useEntering(!exiting);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Clamp inside the viewport. Placement is measured from the real box rather
  // than assumed from the writing direction, so a menu opened at the right edge
  // flips leftwards in both LTR and RTL.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    const rtl = isRtlElement(el);
    let left = x;
    let top = y;

    if (variant === 'submenu' && anchorRect) {
      const preferRight = !rtl;
      const spaceRight = window.innerWidth - anchorRect.right;
      const spaceLeft = anchorRect.left;
      left = preferRight
        ? spaceRight >= width + 8
          ? anchorRect.right + 4
          : anchorRect.left - width - 4
        : spaceLeft >= width + 8
          ? anchorRect.left - width - 4
          : anchorRect.right + 4;
      top = anchorRect.top - 4;
    }

    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - height - pad));
    setStyle({ position: 'fixed', left, top, zIndex: 'var(--z-dropdown)' as unknown as number });
  }, [x, y, variant, anchorRect]);

  const enabledIndexes = enabledIndexesOf(items);

  const move = (dir: 1 | -1) => {
    setActiveIndex((prev) => {
      if (enabledIndexes.length === 0) return -1;
      const at = enabledIndexes.indexOf(prev);
      const nextAt =
        at === -1
          ? dir === 1
            ? 0
            : enabledIndexes.length - 1
          : (at + dir + enabledIndexes.length) % enabledIndexes.length;
      return enabledIndexes[nextAt];
    });
  };

  const activate = (index: number) => {
    const item = items[index];
    if (!item || item.kind === 'separator') return;
    if ('disabled' in item && item.disabled) return;
    if (item.kind === 'submenu') {
      setActiveIndex(index);
      setOpenSubmenu((prev) => (prev === item.id ? null : item.id));
      setSubmenuAnchor(itemRefs.current.get(index)?.getBoundingClientRect() ?? null);
      return;
    }
    item.onSelect();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(enabledIndexes[0] ?? -1);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) activate(activeIndex);
        break;
      case 'Escape':
      case 'ArrowLeft':
        // The submenu's open/closed state lives in its parent panel, so closing
        // it means calling the parent's onClose — not this panel's own
        // `openSubmenu`, which only tracks *its* children and would leave the
        // submenu on screen. The root panel ignores both keys here; its own
        // document listener closes the menu.
        if (variant === 'submenu') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        break;
      case 'ArrowRight': {
        const item = items[activeIndex];
        if (item?.kind === 'submenu' && !item.disabled) {
          e.preventDefault();
          activate(activeIndex);
        }
        break;
      }
      case 'Tab':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  // The panel holds focus and drives `aria-activedescendant`, so arrow keys move
  // the menu cursor without shifting real DOM focus between rows.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const highlightRect = useMovingHighlight({
    containerRef: panelRef,
    activeIndex,
    deps: [openSubmenu]
  });

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={ariaLabel}
      aria-hidden={exiting || undefined}
      inert={exiting || undefined}
      tabIndex={-1}
      aria-activedescendant={activeIndex >= 0 ? `ctx-item-${items[activeIndex].id}` : undefined}
      className={`nq-menu relative min-w-[190px] max-w-[280px] overflow-visible rounded-[var(--r-sm)] border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 shadow-[var(--elev-3)] outline-none${
        entering ? ' nq-menu--entering' : ''
      }`}
      data-state={exiting ? 'closed' : 'open'}
      style={style}
      onKeyDown={onKeyDown}
      onMouseLeave={() => {
        // Leaving a submenu collapses it; the root panel stays until dismissed,
        // which is how native context menus behave.
        if (variant === 'submenu') setOpenSubmenu(null);
      }}
    >
      <MovingHighlight rect={highlightRect} className="bg-[var(--surface-chip)]" />
      {items.map((item, i) => {
        if (item.kind === 'separator') {
          return <div key={item.id} role="separator" className="my-1 h-px bg-[var(--border-subtle)]" />;
        }

        if (item.kind === 'submenu') {
          return (
            <div key={item.id} className="relative">
              <button
                ref={(el) => {
                  if (el) itemRefs.current.set(i, el);
                  else itemRefs.current.delete(i);
                }}
                id={`ctx-item-${item.id}`}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openSubmenu === item.id}
                disabled={item.disabled}
                data-highlight-item="true"
                onMouseEnter={() => {
                  if (!item.disabled) {
                    setActiveIndex(i);
                    setOpenSubmenu(item.id);
                    setSubmenuAnchor(itemRefs.current.get(i)?.getBoundingClientRect() ?? null);
                  }
                }}
                onClick={() => activate(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-[var(--fs-sm)] ${
                  item.disabled
                    ? 'cursor-not-allowed text-[var(--text-tertiary)] opacity-50'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {item.icon && <NuqtaIcon name={item.icon} className="w-4 h-4 shrink-0" />}
                <span className="flex-1 truncate">{item.label}</span>
                <NuqtaIcon name="chevronRight" className="w-3.5 h-3.5 shrink-0 opacity-60 rtl:rotate-180" />
              </button>
              {openSubmenu === item.id && submenuAnchor && (
                <Panel
                  items={item.items}
                  x={submenuAnchor.right}
                  y={submenuAnchor.top}
                  variant="submenu"
                  onClose={() => setOpenSubmenu(null)}
                  anchorRect={submenuAnchor}
                  reduced={reduced}
                />
              )}
            </div>
          );
        }

        const checked = item.kind === 'checkbox' || item.kind === 'radio' ? item.checked : false;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
            id={`ctx-item-${item.id}`}
            type="button"
            role={
              item.kind === 'checkbox' ? 'menuitemcheckbox' : item.kind === 'radio' ? 'menuitemradio' : 'menuitem'
            }
            aria-checked={item.kind === 'checkbox' || item.kind === 'radio' ? checked : undefined}
            disabled={item.disabled}
            data-highlight-item="true"
            onMouseEnter={() => !item.disabled && setActiveIndex(i)}
            onClick={() => activate(i)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-start text-[var(--fs-sm)] ${
              item.disabled
                ? 'cursor-not-allowed text-[var(--text-tertiary)] opacity-50'
                : item.kind === 'item' && item.tone === 'danger'
                  ? 'text-[var(--state-danger)]'
                  : 'text-[var(--text-primary)]'
            }`}
          >
            {item.kind === 'item' && item.icon && (
              <NuqtaIcon name={item.icon} className="w-4 h-4 shrink-0" />
            )}
            {item.kind === 'checkbox' && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-[var(--border-strong)]">
                {checked && (
                  <span className={reduced ? 'nq-indicator' : 'nq-indicator nq-indicator--pop'}>
                    <NuqtaIcon name="check" className="w-3 h-3" />
                  </span>
                )}
              </span>
            )}
            {item.kind === 'radio' && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[var(--border-strong)]">
                {checked && (
                  <span
                    className={`h-2 w-2 rounded-full bg-current${reduced ? '' : ' nq-indicator--pop'}`}
                  />
                )}
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.kind === 'item' && item.hint && (
              <span className="shrink-0 text-[var(--fs-micro)] text-[var(--text-tertiary)]">{item.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ---------- host attached to an element ---------- */

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactElement;
  disabled?: boolean;
  /** Accessible name for the menu. */
  ariaLabel: string;
  className?: string;
}

/**
 * Wraps a record in a right-click / long-press / keyboard-context-menu target.
 *
 * The wrapper adds behaviour, not layout: it is `display: contents`, and the real
 * interactive element stays the child, so existing semantics and hit areas are
 * unchanged.
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  children,
  disabled = false,
  ariaLabel,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<ContextMenuPoint>({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const focusBefore = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const startPoint = useRef<ContextMenuPoint>({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const presence = usePresence(open, OVERLAY_TIMING.menuOut);
  const menuId = `ctx-menu-${useId()}`;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openAt = useCallback((p: ContextMenuPoint) => {
    focusBefore.current = (document.activeElement as HTMLElement) ?? null;
    setPoint(p);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Focus returns to where the user was. Without this the menu would be a trap:
    // Escape would leave focus on a node that is about to be removed.
    const target = focusBefore.current;
    if (target && document.contains(target)) target.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Registered on the shared stack: the menu is often opened from inside a
    // dialog, and stopPropagation cannot help here because every surface listens
    // on `document`. Without the token, one Escape would close the menu *and*
    // the dialog behind it in the same keypress.
    const token = pushOverlay(() => document.getElementById(menuId));
    const onDown = (e: MouseEvent) => {
      const menuEl = document.getElementById(menuId);
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (menuEl?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isTopmostOverlay(token)) return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      popOverlay(token);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, menuId]);

  useEffect(() => clearTimer, [clearTimer]);

  const onContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    openAt({ x: e.clientX, y: e.clientY });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const isMenuKey = e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
    if (!isMenuKey) return;
    e.preventDefault();
    const target = (e.target as HTMLElement).getBoundingClientRect();
    openAt({ x: target.left + target.width / 2, y: target.top + target.height / 2 });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    startPoint.current = { x: t.clientX, y: t.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      openAt({ x: startPoint.current.x, y: startPoint.current.y });
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (timer.current === null) return;
    const t = e.touches[0];
    if (
      Math.abs(t.clientX - startPoint.current.x) > LONG_PRESS_MOVE_PX ||
      Math.abs(t.clientY - startPoint.current.y) > LONG_PRESS_MOVE_PX
    ) {
      clearTimer();
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`contents ${className}`}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={clearTimer}
      onTouchCancel={clearTimer}
    >
      {children}
      {createPortal(
        presence.mounted ? (
          <div id={menuId}>
            <Panel
              items={items}
              x={point.x}
              y={point.y}
              variant="root"
              onClose={close}
              reduced={reduced}
              ariaLabel={ariaLabel}
              exiting={presence.exiting}
            />
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
};
