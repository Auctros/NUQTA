/**
 * Zoom and the time ruler.
 *
 * A zoom level is not a label: it is a pixels-per-day ratio plus the tick rules
 * that ratio can carry. Changing the level genuinely rescales the axis, so the
 * same week is wide at `day` and a sliver at `year`. Labels are derived from the
 * scale, never the other way round.
 *
 * All day arithmetic goes through `dateKey`/`week` so NUQTA's Saturday-first week
 * and local (never UTC) days stay the single source of truth.
 */
import { addDaysToKey, localDateKey, parseDateKey } from '../dateKey';
import { indexFromWeekStart, weekDayNarrow } from '../week';
import type { TimelineDomain, TimelineItem } from './types';

export type ZoomLevel = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'multi-year';

export const ZOOM_LEVELS: readonly ZoomLevel[] = ['hour', 'day', 'week', 'month', 'quarter', 'year', 'multi-year'];

/** Pixels per day. These are deliberately spread over ~4 orders of magnitude. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
  hour: 2880, // 120px per hour
  day: 480, // 20px per hour
  week: 150, // ~21px per day
  month: 54,
  quarter: 24,
  year: 9,
  'multi-year': 2.4
};

export function zoomLabel(level: ZoomLevel, isAr: boolean): string {
  const ar: Record<ZoomLevel, string> = {
    hour: 'ساعات',
    day: 'أيام',
    week: 'أسابيع',
    month: 'أشهر',
    quarter: 'أرباع',
    year: 'سنة',
    'multi-year': 'سنوات'
  };
  const en: Record<ZoomLevel, string> = {
    hour: 'Hours',
    day: 'Days',
    week: 'Weeks',
    month: 'Months',
    quarter: 'Quarters',
    year: 'Year',
    'multi-year': 'Years'
  };
  return isAr ? ar[level] : en[level];
}

/** One cell of the ruler. `start`/`end` are local midnights (end exclusive). */
export interface RulerTick {
  key: string;
  start: Date;
  end: Date;
  label: string;
  /** Larger ticks get a stronger rule and a bigger label. */
  major: boolean;
  /** True when the tick begins a new month/week, used for separators. */
  boundary?: boolean;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function monthName(month: number, isAr: boolean): string {
  return (isAr ? MONTHS_AR : MONTHS_EN)[month] ?? '';
}

/**
 * A day/quarter number in the reader's own digits.
 *
 * `toLocaleString` is used rather than a hand-rolled map so the Arabic ruler shows
 * Arabic-Indic numerals (٢٧) the same way every other date in the app does.
 */
function num(value: number, isAr: boolean): string {
  return value.toLocaleString(isAr ? 'ar-EG' : 'en-US');
}

function startOfMonthDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarterDate(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), q, 1);
}

function startOfYearDate(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/** Local midnight of the Saturday that starts the week containing `date`. */
function startOfWeekDate(date: Date): Date {
  const key = localDateKey(date);
  const offset = indexFromWeekStart(key);
  return parseDateKey(addDaysToKey(key, -offset))!;
}

/**
 * The ruler cells covering [from, to). The number of cells is bounded, so a
 * decade-wide window at hour zoom cannot produce a million DOM nodes.
 */
export function buildRuler(
  from: Date,
  to: Date,
  level: ZoomLevel,
  isAr: boolean,
  maxCells = 200
): RulerTick[] {
  const ticks: RulerTick[] = [];
  let cursor = from;

  const pushCell = (start: Date, end: Date, label: string, major: boolean, boundary?: boolean) => {
    ticks.push({ key: localDateKey(start), start, end, label, major, boundary });
  };

  switch (level) {
    case 'hour':
    case 'day': {
      // Hourly subdivisions when hours are readable, otherwise one cell per day.
      const stepHours = level === 'hour' ? 1 : PX_PER_DAY[level] / 24 >= 14 ? 3 : 0;
      if (stepHours > 0) {
        cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), from.getHours(), 0, 0, 0);
        while (cursor < to && ticks.length < maxCells) {
          const end = new Date(cursor.getTime() + stepHours * 3_600_000);
          const h = cursor.getHours();
          const label = isAr ? `${num(h, isAr)}:00` : `${String(h).padStart(2, '0')}:00`;
          pushCell(cursor, end, label, h === 0, h === 0);
          cursor = end;
        }
        break;
      }
      cursor = parseDateKey(localDateKey(from))!;
      while (cursor < to && ticks.length < maxCells) {
        const end = parseDateKey(addDaysToKey(localDateKey(cursor), 1))!;
        const label = `${weekDayNarrow(indexToDow(cursor), isAr)} ${num(cursor.getDate(), isAr)}`;
        pushCell(cursor, end, label, cursor.getDate() === 1, cursor.getDate() === 1);
        cursor = end;
      }
      break;
    }
    case 'week': {
      // Day cells; the week boundary is emphasised.
      cursor = parseDateKey(localDateKey(from))!;
      while (cursor < to && ticks.length < maxCells) {
        const end = parseDateKey(addDaysToKey(localDateKey(cursor), 1))!;
        const idx = indexFromWeekStart(localDateKey(cursor));
        pushCell(cursor, end, num(cursor.getDate(), isAr), idx === 0, idx === 0);
        cursor = end;
      }
      break;
    }
    case 'month': {
      cursor = parseDateKey(localDateKey(from))!;
      while (cursor < to && ticks.length < maxCells) {
        const end = parseDateKey(addDaysToKey(localDateKey(cursor), 1))!;
        const day = cursor.getDate();
        const weekday = indexToDow(cursor);
        // Only label Mondays-ish to avoid crowding: label the 1st and every 7th day.
        const label = day === 1 || day % 7 === 1 ? `${weekDayNarrow(weekday, isAr)} ${num(day, isAr)}` : '';
        pushCell(cursor, end, label, day === 1, day === 1);
        cursor = end;
      }
      break;
    }
    case 'quarter': {
      cursor = startOfWeekDate(from);
      while (cursor < to && ticks.length < maxCells) {
        const end = parseDateKey(addDaysToKey(localDateKey(cursor), 7))!;
        const label = `${num(cursor.getDate(), isAr)} ${monthName(cursor.getMonth(), isAr)}`;
        pushCell(cursor, end, label, cursor.getDate() <= 7, false);
        cursor = end;
      }
      break;
    }
    case 'year': {
      cursor = startOfMonthDate(from);
      while (cursor < to && ticks.length < maxCells) {
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        pushCell(cursor, end, monthName(cursor.getMonth(), isAr), cursor.getMonth() === 0, cursor.getMonth() === 0);
        cursor = end;
      }
      break;
    }
    case 'multi-year': {
      cursor = startOfQuarterDate(from);
      while (cursor < to && ticks.length < maxCells) {
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
        const q = Math.floor(cursor.getMonth() / 3) + 1;
        const label = isAr ? `ر${num(q, isAr)} ${num(cursor.getFullYear(), isAr)}` : `Q${q} ${cursor.getFullYear()}`;
        pushCell(cursor, end, label, cursor.getMonth() === 0, cursor.getMonth() === 0);
        cursor = end;
      }
      break;
    }
  }

  return ticks;
}

/** `Date.getDay()` for a Date without calling it outside the week module's rules. */
function indexToDow(date: Date): number {
  // indexFromWeekStart returns 0..6 for Sat..Fri; map back to Date.getDay().
  const order = [6, 0, 1, 2, 3, 4, 5];
  return order[indexFromWeekStart(localDateKey(date))] ?? 0;
}

/** The natural window each zoom level shows, in days, for the "fit" operations. */
export const ZOOM_WINDOW_DAYS: Record<ZoomLevel, number> = {
  hour: 2,
  day: 7,
  week: 28,
  month: 90,
  quarter: 180,
  year: 365,
  'multi-year': 1825
};

/** The visible window for a given zoom and centre date, as [from, to). */
export function windowForZoom(center: Date, level: ZoomLevel): { from: Date; to: Date } {
  const days = ZOOM_WINDOW_DAYS[level];
  const half = days / 2;
  const from = new Date(center.getFullYear(), center.getMonth(), center.getDate());
  from.setDate(from.getDate() - Math.floor(half));
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return { from, to };
}

/** Width in px of a window at a zoom level. */
export function windowWidth(level: ZoomLevel): number {
  return ZOOM_WINDOW_DAYS[level] * PX_PER_DAY[level];
}

/** `date` expressed as a horizontal offset in px from `origin`. */
export function offsetPx(date: Date, origin: Date, pxPerDay: number): number {
  const ms = date.getTime() - origin.getTime();
  return (ms / 86_400_000) * pxPerDay;
}

/** Inverse of `offsetPx`. */
export function dateAtOffset(px: number, origin: Date, pxPerDay: number): Date {
  return new Date(origin.getTime() + (px / pxPerDay) * 86_400_000);
}

/** Snap a date to the start of its day (local). */
export function floorToDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Snap a date to the nearest 15-minute mark — the granularity drags use. */
export function snapToQuarterHour(date: Date): Date {
  const ms = 15 * 60_000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

/** Nearest day, for day-granular drags. */
export function snapToDay(date: Date): Date {
  const start = floorToDay(date);
  const diff = date.getTime() - start.getTime();
  return diff >= 43_200_000 ? new Date(start.getTime() + 86_400_000) : start;
}

/**
 * Items overlapping [from, to). Overlap — not containment — because a goal that
 * started last month is still relevant today.
 */
export function itemsInWindow(items: TimelineItem[], from: Date, to: Date): TimelineItem[] {
  const f = from.getTime();
  const t = to.getTime();
  return items.filter((item) => {
    const s = item.start.getTime();
    const e = item.end?.getTime() ?? s;
    return e >= f && s <= t;
  });
}

/** Lanes that still have at least one item inside the window. */
export function domainsInWindow(items: TimelineItem[], from: Date, to: Date): Set<TimelineDomain> {
  const set = new Set<TimelineDomain>();
  for (const item of itemsInWindow(items, from, to)) set.add(item.domain);
  return set;
}
