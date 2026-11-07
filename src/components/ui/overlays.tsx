import React, { useEffect, useRef } from 'react';
import { IconButton } from './primitives';

/* ============================================================
   NUQTA — overlays
   Modal · Sheet · Toast
   Accessible defaults: Escape closes, backdrop closes, focus is
   moved into the panel, scroll is locked while open.
   ============================================================ */

const useOverlayBehaviour = (open: boolean, onClose: () => void) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  return panelRef;
};

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl'
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
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close'
}) => {
  const panelRef = useOverlayBehaviour(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 grid place-items-center p-4 bg-[rgba(0,0,0,0.55)]"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'w-full flex flex-col overflow-hidden outline-none',
          'max-h-[92vh] rounded-[var(--r-lg)] border border-[var(--border-default)]',
          'bg-[var(--surface-raised)] shadow-[var(--elev-3)]',
          MODAL_WIDTH[size]
        ].join(' ')}
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
  const panelRef = useOverlayBehaviour(open, onClose);
  if (!open) return null;

  const position =
    side === 'end'
      ? 'inset-y-0 end-0 h-full w-full max-w-md rounded-s-[var(--r-lg)]'
      : 'inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-[var(--r-lg)]';

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)]"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'absolute flex flex-col overflow-hidden outline-none',
          'border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-3)]',
          position
        ].join(' ')}
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
  );
};

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

const TOAST_TONE: Record<ToastTone, string> = {
  neutral: 'border-[var(--border-default)]',
  success: 'border-[var(--state-success)]',
  warning: 'border-[var(--state-warning)]',
  danger: 'border-[var(--state-danger)]'
};

export interface ToastProps {
  open: boolean;
  message: React.ReactNode;
  tone?: ToastTone;
  onClose?: () => void;
  action?: React.ReactNode;
}

export const Toast: React.FC<ToastProps> = ({ open, message, tone = 'neutral', onClose, action }) => {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 inset-x-0 mx-auto w-fit max-w-[92vw]"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      <div
        className={[
          'flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-sm)] border shadow-[var(--elev-2)]',
          'bg-[var(--surface-raised)] text-[var(--text-primary)] text-[var(--fs-sm)]',
          TOAST_TONE[tone]
        ].join(' ')}
      >
        <span className="truncate">{message}</span>
        {action}
        {onClose && <IconButton icon="close" label="Dismiss" onClick={onClose} size="sm" />}
      </div>
    </div>
  );
};
