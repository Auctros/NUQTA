import { useEffect, useRef } from 'react';

/**
 * Closes an overlay when Escape is pressed while it is open.
 * The latest `onClose` is kept in a ref so the keydown listener
 * attaches once per open/close cycle instead of every render.
 */
export function useEscapeKey(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
}
