import { useEffect, useRef } from 'react';
import { isTopmostOverlay, popOverlay, pushOverlay } from './overlayStack';

/**
 * Closes a legacy `.modal-backdrop` surface when Escape is pressed while it is
 * open. The latest `onClose` is kept in a ref so the listener attaches once per
 * open/close cycle instead of every render.
 *
 * These views predate `DialogHost` and render their own markup, so they carry no
 * panel ref to rank against. They still join the shared stack: without an
 * element they defer to any registered surface that has one, and among
 * themselves the most recently opened answers. So a confirm dialog or a `Modal`
 * opened on top of one of them keeps the key. Without that, every listener on
 * `document` fired at once and one press closed both.
 */
export function useEscapeKey(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = pushOverlay(() => null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isTopmostOverlay(token)) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popOverlay(token);
    };
  }, [open]);
}
