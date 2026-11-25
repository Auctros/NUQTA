import { useSyncExternalStore } from 'react';

/**
 * The user's clock preference.
 *
 * Stored under `nuqta.ui.*` — the UI namespace, never the `nuqta_` dataset — because it
 * is a display preference, not a record. `NuqtaStorageEngine.hasAnyNuqtaData()` and
 * `wipeAll()` must not see it (see `uiPrefs.ts`).
 *
 * The default is 24-hour: NUQTA already presents stored times as "HH:mm" in task lists
 * and the calendar, so defaulting to 24-hour keeps every existing screen unchanged and
 * makes 12-hour an explicit opt-in rather than a silent reformat of the user's day.
 */
export type TimeFormat = '12h' | '24h';

const TIME_FORMAT_KEY = 'nuqta.ui.timeFormat';

let cached: TimeFormat | null = null;
const listeners = new Set<() => void>();

function readStored(): TimeFormat | null {
  try {
    const raw = localStorage.getItem(TIME_FORMAT_KEY);
    return raw === '12h' || raw === '24h' ? raw : null;
  } catch {
    return null;
  }
}

export function defaultTimeFormat(): TimeFormat {
  return '24h';
}

export function readTimeFormat(): TimeFormat {
  if (cached === null) cached = readStored() ?? defaultTimeFormat();
  return cached;
}

export function writeTimeFormat(format: TimeFormat): void {
  if (cached === format) return;
  cached = format;
  try {
    localStorage.setItem(TIME_FORMAT_KEY, format);
  } catch {
    /* storage unavailable: the choice still holds for this page session */
  }
  listeners.forEach((listener) => listener());
}

export function subscribeTimeFormat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop the memoised value so the next read re-checks storage (used by tests). */
export function resetTimeFormatCache(): void {
  cached = null;
}

export function useTimeFormat(): TimeFormat {
  return useSyncExternalStore(subscribeTimeFormat, readTimeFormat, readTimeFormat);
}

/** "HH:mm" → { h: 0-23, m: 0-59 }, or null when the value is empty/malformed. */
export function parseTimeValue(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return null;
  return { h, m };
}

export function toTimeValue(h: number, m: number): string {
  const hour = ((h % 24) + 24) % 24;
  const minute = Math.min(59, Math.max(0, m));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** 0-23 → the 12-hour dial face (12, 1 … 11) plus its period. */
export function toHour12(h: number): { hour: number; period: 'am' | 'pm' } {
  const period: 'am' | 'pm' = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { hour, period };
}

/** Inverse of `toHour12`: a dial face hour (1-12) + period back to 0-23. */
export function fromHour12(hour: number, period: 'am' | 'pm'): number {
  const base = hour % 12;
  return period === 'pm' ? base + 12 : base;
}

const MERIDIEM = {
  en: { am: 'AM', pm: 'PM' },
  ar: { am: 'ص', pm: 'م' }
} as const;

/**
 * Render a stored "HH:mm" for display. 24-hour returns the stored string untouched, so
 * the default preference leaves every existing screen byte-identical.
 */
export function formatTimeLabel(value: string, format: TimeFormat, isAr = false): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return value;
  if (format === '24h') return toTimeValue(parsed.h, parsed.m);
  const { hour, period } = toHour12(parsed.h);
  const minutes = String(parsed.m).padStart(2, '0');
  return `${hour}:${minutes} ${MERIDIEM[isAr ? 'ar' : 'en'][period]}`;
}

/** Accept the free-form text a person types into the picker's input field. */
export function parseTypedTime(input: string, format: TimeFormat): string | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // "9", "9:30", "09.30", "930", "9:30 pm", "9 pm", "21:45"
  const match = /^(\d{1,2})\s*[:.\s]?\s*(\d{2})?\s*(am|pm|a|p|ص|م)?$/.exec(text);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3];

  if (minute > 59) return null;

  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    const isPm = suffix === 'pm' || suffix === 'p' || suffix === 'م';
    hour = fromHour12(hour, isPm ? 'pm' : 'am');
  } else if (hour > 23) {
    return null;
  } else if (format === '12h' && hour > 12 && hour !== 0) {
    // In 12-hour mode a bare "21" is ambiguous; reject rather than guess.
    return null;
  }

  return toTimeValue(hour, minute);
}
