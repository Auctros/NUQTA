import { useCallback, useEffect, useRef, useState } from 'react';

interface HeldEntry {
  id: string;
  /** Position in the list when the exit started, so the row does not jump to the end. */
  index?: number;
}

export interface CompletionHoldResult<T> {
  /** `derived` plus any row that is animating out. */
  rows: T[];
  /** Keep `id` mounted for `holdMs` so its completion animation can finish. */
  hold: (id: string, index?: number) => void;
  /** True while the row is on screen only to finish animating. */
  isExiting: (id: string) => boolean;
}

/**
 * Let a row finish its exit animation before it is unmounted.
 *
 * Completing a task removes it from every active view immediately — that is the intended
 * behaviour and the store must not be delayed for a visual effect. But it also means React
 * unmounts the row on the same tick as the click, so the checkmark never gets to draw.
 *
 * This keeps the just-completed row mounted for a short, fixed window while the rest of the
 * list closes over it. The row renders from the *current* store record, so it shows the real
 * completed state; the hold only affects when it is removed from the DOM, never what is
 * persisted. Re-opening the task inside that window simply puts it back in `derived` and it
 * stops being an extra.
 */
export function useCompletionHold<T extends { id: string }>(
  derived: T[],
  all: T[],
  holdMs: number
): CompletionHoldResult<T> {
  const [held, setHeld] = useState<HeldEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const hold = useCallback(
    (id: string, index?: number) => {
      if (holdMs <= 0) return;
      setHeld((prev) => (prev.some((entry) => entry.id === id) ? prev : [...prev, { id, index }]));
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setHeld((prev) => prev.filter((entry) => entry.id !== id));
        }, holdMs)
      );
    },
    [holdMs]
  );

  const present = new Set(derived.map((item) => item.id));
  const byId = new Map(all.map((item) => [item.id, item]));

  const extras: HeldEntry[] = [];
  for (const entry of held) {
    if (present.has(entry.id) && byId.has(entry.id)) continue;
    if (byId.has(entry.id)) extras.push(entry);
  }

  let rows = derived;
  if (extras.length > 0) {
    rows = [...derived];
    // Insert from the front so earlier recorded indexes stay meaningful.
    const ordered = [...extras].sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
    for (const entry of ordered) {
      const item = byId.get(entry.id)!;
      const at = entry.index === undefined ? rows.length : Math.min(entry.index, rows.length);
      rows.splice(at, 0, item);
    }
  }

  const exitingIds = new Set(extras.map((entry) => entry.id));

  return {
    rows,
    hold,
    isExiting: (id: string) => exitingIds.has(id)
  };
}
