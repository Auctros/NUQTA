import React, { useEffect, useRef } from 'react';
import { IconButton } from './primitives';
import { OVERLAY_TIMING } from '../../lib/motion';
import { useEntering, usePresence } from '../../lib/usePresence';
import { lockPageScroll, unlockPageScroll } from '../../lib/scrollLock';
import { isTopmostOverlay, popOverlay, pushOverlay } from '../../lib/overlayStack';

/* ============================================================
   NUQTA — overlays
   Modal · Sheet
   Accessible defaults: Escape closes, backdrop closes, focus is
   moved into the panel, scroll is locked while open.

   Motion (Animate UI "Dialog" reference):
     - the backdrop fades in while its blur deepens;
     - the panel enters with a perspective tilt, blur and spring
       settle, from `top` by default;
     - Sheet slides directionally instead of tilting;
     - exit is faster than entrance (a shorter spring, not a longer one);
     - reduced motion keeps a plain fade and drops tilt/scale/slide,
       so the dialog still reads as a dialog.

   Panels stay mounted until their exit finishes, so the markup is
   gated on presence `mounted` rather than `open`, and the state
   change is expressed as `data-state` for CSS to animate. The
   unmount happens on a timer tied to the same duration constant,
   which keeps the node in the DOM for exactly its fade-out.
   ============================================================ */

/**
 * Owns Escape, scroll lock and focus for the visible lifetime of the overlay —
 * including the exit animation, which is why the two concerns take different
 * flags. `present` (not `open`) gates the lock and focus restore so the page
 * cannot be scrolled under a panel that is fading out. `interactive` is false
 * once the exit starts: a surface on its way out must stop answering Escape
 * immediately, or it swallows the press meant for whatever sits underneath.
 */
const useOverlayBehaviour = (present: boolean, interactive: boolean, onClose: () => void) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Callers pass an inline arrow, so the handler is read from a ref: a new
  // identity must not tear down the scroll lock and re-run the focus timer.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Registration is tied to `interactive`, not to `present`: a surface that is
  // fading out must stop claiming Escape the moment it starts to leave, or it
  // swallows the next press and strands whatever sits underneath it.
  useEffect(() => {
    if (!present || !interactive) return;
    // Overlays stack, and a plain document listener would let one Escape close
    // every open dialog at once. Only the topmost one answers.
    const token = pushOverlay(() => panelRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isTopmostOverlay(token)) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popOverlay(token);
    };
  }, [present, interactive]);

  useEffect(() => {
    if (!present) return;
    // Reference-counted so an overlapping dialog keeps the page locked after
    // this one closes. The scrollbar gutter is already reserved
    // (html { scrollbar-gutter: stable }), so the content width never shifts.
    const lock = lockPageScroll();
    returnFocus.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      unlockPageScroll(lock);
      window.clearTimeout(id);
      const target = returnFocus.current;
      returnFocus.current = null;
      // Leaving focus on <body> strands keyboard and screen-reader users at the
      // top of the page; it goes back to whatever opened the dialog.
      if (target && document.contains(target)) target.focus();
    };
  }, [present]);

  return panelRef;
};

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl'
};

export type ModalDirection = 'top' | 'bottom' | 'left' | 'right';

/** Where the panel starts from, so the tilt reads as travelling inwards. */
const DIRECTION_OFFSET: Record<ModalDirection, { x: number; y: number }> = {
  top: { x: 0, y: -18 },
  bottom: { x: 0, y: 18 },
  left: { x: -22, y: 0 },
  right: { x: 22, y: 0 }
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeLabel?: string;
  /** "glass" opts this dialog into the soft-glass surface; default stays unchanged. */
  variant?: 'default' | 'glass';
  /** Entrance direction. Default `top`. */
  direction?: ModalDirection;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
  variant = 'default',
  direction = 'top'
}) => {
  const presence = usePresence(open, OVERLAY_TIMING.panelOut);
  const panelRef = useOverlayBehaviour(presence.mounted, !presence.exiting, onClose);
  const entering = useEntering(presence.mounted);
  const offset = DIRECTION_OFFSET[direction];
  const state = presence.exiting ? 'closed' : 'open';

  return (
    <>
      {presence.mounted && (
        <div className="fixed inset-0 grid place-items-center p-4" style={{ zIndex: 'var(--z-modal)' }}>
          <div
            className="nq-backdrop absolute inset-0 bg-[rgba(0,0,0,0.55)]"
            data-state={state}
            onMouseDown={onClose}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={[
              'nq-panel relative w-full flex flex-col overflow-hidden outline-none',
              'max-h-[92vh] rounded-[var(--r-lg)] border',
              variant === 'glass'
                ? 'glass-surface border-[var(--glass-border)]'
                : 'border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-3)]',
              entering ? 'nq-panel--entering' : '',
              MODAL_WIDTH[size]
            ].join(' ')}
            data-state={state}
            style={
              {
                perspective: '1200px',
                transformStyle: 'preserve-3d',
                '--nq-enter-x': `${offset.x}px`,
                '--nq-enter-y': `${offset.y}px`,
                '--nq-enter-rx': direction === 'top' || direction === 'bottom' ? '6deg' : '0deg',
                '--nq-enter-ry': direction === 'left' || direction === 'right' ? '6deg' : '0deg'
              } as React.CSSProperties
            }
            aria-hidden={presence.exiting || undefined}
            inert={presence.exiting || undefined}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(title || description) && (
              <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-[var(--fs-lg)] font-[var(--fw-bold)] text-[var(--text-primary)] truncate">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-[var(--fs-xs)] text-[var(--text-secondary)] leading-[var(--lh-relaxed)]">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton icon="close" label={closeLabel} onClick={onClose} size="sm" />
              </header>
            )}
            <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
            {footer && (
              <footer className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2 bg-[var(--surface-inset)]">
                {footer}
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: 'end' | 'bottom';
  children: React.ReactNode;
  closeLabel?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  side = 'end',
  children,
  closeLabel = 'Close'
}) => {
  const presence = usePresence(open, OVERLAY_TIMING.panelOut);
  const panelRef = useOverlayBehaviour(presence.mounted, !presence.exiting, onClose);
  const entering = useEntering(presence.mounted);
  const state = presence.exiting ? 'closed' : 'open';

  const position =
    side === 'end'
      ? 'inset-y-0 end-0 h-full w-full max-w-md rounded-s-[var(--r-lg)]'
      : 'inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-[var(--r-lg)]';

  // `end` follows the writing direction, so the sheet must exit the side it came from.
  const rtl = typeof document !== 'undefined' && document.dir === 'rtl';

  return (
    <>
      {presence.mounted && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-modal)' }}>
          <div
            className="nq-backdrop absolute inset-0 bg-[rgba(0,0,0,0.55)]"
            data-state={state}
            onMouseDown={onClose}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={[
              'nq-panel nq-panel--sheet absolute flex flex-col overflow-hidden outline-none',
              'border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-3)]',
              entering ? 'nq-panel--entering' : '',
              position
            ].join(' ')}
            data-state={state}
            data-side={side}
            data-rtl={rtl ? 'true' : undefined}
            aria-hidden={presence.exiting || undefined}
            inert={presence.exiting || undefined}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-[var(--fs-lg)] font-[var(--fw-bold)] text-[var(--text-primary)] truncate">
                {title}
              </h2>
              <IconButton icon="close" label={closeLabel} onClick={onClose} size="sm" />
            </header>
            <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
          </div>
        </div>
      )}
    </>
  );
};
