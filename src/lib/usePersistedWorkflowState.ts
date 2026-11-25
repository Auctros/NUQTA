import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Workflow state that should outlive a reload but must NOT live in the URL.
 *
 * A search query or a status filter is a working position, not a destination: it is
 * not worth a history entry per keystroke, and a link that carried it would surprise
 * whoever opened it. So it goes to `nuqta.ui.workflow.<scope>` instead — the UI
 * namespace, which the storage engine deliberately ignores.
 *
 * Restoring is bounded on purpose. Only the values a view names are read back, and a
 * value that no longer validates (a filter that was removed, a hand-edited string)
 * falls back to the default rather than rendering an empty list with no explanation.
 */
const PREFIX = 'nuqta.ui.workflow.';

type Validator<T> = (value: unknown) => value is T;

function readScope(scope: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(PREFIX + scope);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function writeScope(scope: string, data: Record<string, unknown>): void {
  try {
    if (Object.keys(data).length === 0) localStorage.removeItem(PREFIX + scope);
    else localStorage.setItem(PREFIX + scope, JSON.stringify(data));
  } catch {
    /* storage unavailable: filters simply start fresh next load */
  }
}

/**
 * Read one persisted value from a scope.
 *
 * `isValid` is required: without it a stale stored value could put a view into a
 * state it no longer understands.
 */
export function readWorkflowValue<T>(scope: string, key: string, fallback: T, isValid: Validator<T>): T {
  const stored = readScope(scope)[key];
  return isValid(stored) ? stored : fallback;
}

export function writeWorkflowValue<T>(scope: string, key: string, value: T): void {
  const data = readScope(scope);
  data[key] = value;
  writeScope(scope, data);
}

export function clearWorkflowScope(scope: string): void {
  try {
    localStorage.removeItem(PREFIX + scope);
  } catch {
    /* nothing to clear */
  }
}

/**
 * `useState` whose value survives a reload within a named scope.
 *
 * Writes are debounced: a search box would otherwise hit localStorage on every
 * keystroke. The pending value is flushed on unmount so navigating away does not
 * lose the last edit.
 */
export function usePersistedWorkflowState<T>(
  scope: string,
  key: string,
  fallback: T,
  isValid: Validator<T>,
  { debounceMs = 300 }: { debounceMs?: number } = {}
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readWorkflowValue(scope, key, fallback, isValid));
  const timer = useRef<number | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      writeWorkflowValue(scope, key, latest.current);
    }, debounceMs);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [scope, key, value, debounceMs]);

  // Flush on unmount so the last keystroke is not lost when the section closes.
  useEffect(
    () => () => {
      writeWorkflowValue(scope, key, latest.current);
    },
    [scope, key]
  );

  return [value, setValue];
}

export const isString = (value: unknown): value is string => typeof value === 'string';

export const oneOf =
  <T extends string>(allowed: readonly T[]): Validator<T> =>
  (value: unknown): value is T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value);
