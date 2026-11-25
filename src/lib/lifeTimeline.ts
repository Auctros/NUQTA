/**
 * Unified Life Timeline — a view over the events NUQTA already records.
 *
 * This module deliberately owns no data. `generateUniversalHistory` in
 * `universalHistoryEngine.ts` already derives one chronological stream from the
 * modules that hold the truth (tasks, habits and their studios, goals, focus,
 * journal, reviews, audit logs). The timeline adds only what a *reading*
 * experience needs and the raw stream does not answer:
 *
 *   - how much an event matters (so the feed can be quiet, not a wall of rows),
 *   - which day / week / month it belongs to (local calendar grouping),
 *   - how consecutive similar events collapse into one entry,
 *   - how to filter, search and page through years of them,
 *   - where the event lives in NUQTA so it can be opened at its source.
 *
 * Because it derives from the live records, an edit or deletion in the owning
 * module is reflected on the next render: there is no second copy to keep in
 * sync, no replay log to rebuild, and nothing to repair after a restart.
 */

import {
  UniversalHistoryItem,
  UniversalHistoryDomain,
  UniversalHistoryEventType
} from '../types';
import { localDateKey, addDaysToKey, isDateKey } from './dateKey';
import { startOfWeekKey, weekDayLabelOf } from './week';
import { isNavTab, NavTab } from './navigation';

/**
 * How loudly an event should read.
 *
 * `milestone` is a life event worth remembering (goal completed, book finished,
 * a surah memorised). `notable` is a real session of intentional work.
 * `routine` is the everyday activity that fills the timeline but should never
 * dominate it. `administrative` is bookkeeping — creation, archiving, restores —
 * which is kept for completeness but de-emphasised so it cannot drown the feed.
 */
export type TimelineImportance = 'milestone' | 'notable' | 'routine' | 'administrative';

export type TimelinePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export interface TimelineEvent {
  id: string;
  /** ISO instant the event happened. */
  timestamp: string;
  /** Local calendar day (YYYY-MM-DD). */
  date: string;
  domain: UniversalHistoryDomain;
  eventType: UniversalHistoryEventType;
  title: string;
  description?: string;
  entityId: string;
  entityType: UniversalHistoryItem['entityType'];
  badge?: string;
  metricsSummary?: string;
  linkedGoalId?: string;
  linkedGoalTitle?: string;
  importance: TimelineImportance;
  /** Section of NUQTA the event came from, when it has a screen. */
  sourceTab: NavTab | null;
  /** Number of raw events collapsed into this entry (1 = not collapsed). */
  groupedCount: number;
  /** Ids of every raw event represented here, newest first. */
  memberIds: string[];
  /** Raw items, so the detail panel can show the original record. */
  members: UniversalHistoryItem[];
}

export interface TimelineGroup {
  kind: 'day' | 'week' | 'month';
  /** Stable key for React and for the scroll anchor. */
  key: string;
  /** The local day this group starts on (YYYY-MM-DD). */
  date: string;
  label: string;
  sublabel?: string;
  isToday: boolean;
  events: TimelineEvent[];
}

export interface TimelineQuery {
  domain?: UniversalHistoryDomain | 'all';
  eventType?: UniversalHistoryEventType | 'all';
  period?: TimelinePeriod;
  search?: string;
  /** Include administrative events (created/archived/restored). Default false. */
  includeAdministrative?: boolean;
  /** Only events at or before this local day (inclusive). Used by the Commitment Map. */
  untilDate?: string;
  /** Only events at or after this local day (inclusive). */
  fromDate?: string;
}

const ADMINISTRATIVE_EVENTS = new Set<UniversalHistoryEventType>(['created', 'archived', 'restored']);

const MILESTONE_EVENTS = new Set<UniversalHistoryEventType>(['milestone']);

/** Domains that only matter to the timeline at their high points. */
const HIGH_SIGNAL_DOMAINS = new Set<UniversalHistoryDomain>(['finance', 'health']);

/**
 * Domain → the NUQTA section that owns it. `review` is deliberately absent:
 * a weekly review has no screen of its own, so it must not offer a dead link.
 */
const DOMAIN_SOURCE: Partial<Record<UniversalHistoryDomain, NavTab>> = {
  tasks: 'tasks',
  habits: 'habits',
  goals: 'goals',
  focus: 'focus',
  quran: 'quran',
  reading: 'reading',
  workout: 'workout',
  drawing: 'drawing',
  walking: 'walking',
  journal: 'journal',
  finance: 'finance',
  health: 'health'
};

/** Where an event can be opened, or null when it has no screen. */
export function sourceTabFor(domain: UniversalHistoryDomain): NavTab | null {
  const tab = DOMAIN_SOURCE[domain];
  return tab && isNavTab(tab) ? tab : null;
}

/**
 * Classify importance from the event itself rather than from a counter.
 *
 * The rules are intentionally few and explainable:
 *   - anything the owning module calls a milestone is a milestone;
 *   - completion of a goal, book or project is a milestone (a finished thing);
 *   - finance/health are high-signal domains: only their milestones surface,
 *     so a timeline is not a bank statement or a symptom diary;
 *   - a recorded session of intentional work is notable;
 *   - creation/archival/restore is administrative;
 *   - a journal note is routine (it is reflective, not an achievement).
 */
export function classifyImportance(item: UniversalHistoryItem): TimelineImportance {
  if (ADMINISTRATIVE_EVENTS.has(item.eventType)) return 'administrative';
  if (MILESTONE_EVENTS.has(item.eventType)) return 'milestone';

  if (HIGH_SIGNAL_DOMAINS.has(item.domain)) {
    // Only a completed/milestone-shaped record is worth a row in these domains.
    return item.eventType === 'completed' ? 'milestone' : 'routine';
  }

  if (item.eventType === 'completed') {
    // A finished task is notable; a finished goal/book/project is a milestone.
    return item.domain === 'tasks' ? 'notable' : 'milestone';
  }

  if (item.eventType === 'note') return 'routine';
  return 'notable';
}

/** Should this raw item appear in a quiet (default) timeline? */
export function isDefaultVisible(item: UniversalHistoryItem): boolean {
  if (ADMINISTRATIVE_EVENTS.has(item.eventType)) return false;
  if (HIGH_SIGNAL_DOMAINS.has(item.domain)) return item.eventType === 'completed';
  return true;
}

function toEvent(item: UniversalHistoryItem): TimelineEvent {
  return {
    id: item.id,
    timestamp: item.timestamp,
    date: isDateKey(item.date) ? item.date : localDateKey(new Date(item.timestamp)),
    domain: item.domain,
    eventType: item.eventType,
    title: item.title,
    description: item.description,
    entityId: item.entityId,
    entityType: item.entityType,
    badge: item.badge,
    metricsSummary: item.metricsSummary,
    linkedGoalId: item.linkedGoalId,
    linkedGoalTitle: item.linkedGoalTitle,
    importance: classifyImportance(item),
    sourceTab: sourceTabFor(item.domain),
    groupedCount: 1,
    memberIds: [item.id],
    members: [item]
  };
}

/**
 * Collapse consecutive events that are the same kind of thing on the same day.
 *
 * The grouping key is (day, domain, eventType, entityType, badge) — that is, "the
 * same kind of activity, in the same place, on the same day". Three Quran
 * sessions on Tuesday become one row that says "3 sessions" and can be opened;
 * a task completion and a Quran session on the same day stay separate because
 * they are different things. Groups never span a day boundary, so the timeline
 * can still be read day by day.
 */
function groupKeyFor(event: TimelineEvent): string {
  return [event.date, event.domain, event.eventType, event.entityType, event.badge ?? ''].join('|');
}

export interface BuildTimelineOptions extends TimelineQuery {
  /** Collapse consecutive same-kind events on the same day. Default true. */
  group?: boolean;
}

/** Apply the filter half of a query. Pure; exported for tests and the map. */
export function filterTimeline(items: UniversalHistoryItem[], query: TimelineQuery = {}): UniversalHistoryItem[] {
  const {
    domain = 'all',
    eventType = 'all',
    period = 'all',
    search = '',
    includeAdministrative = false,
    untilDate,
    fromDate
  } = query;

  const today = localDateKey();
  const periodStart = (() => {
    switch (period) {
      case 'today':
        return today;
      case 'week':
        return startOfWeekKey(today);
      case 'month':
        return `${today.slice(0, 7)}-01`;
      case 'year':
        return `${today.slice(0, 4)}-01-01`;
      default:
        return null;
    }
  })();

  const needle = search.trim().toLowerCase();

  return items.filter((item) => {
    if (domain !== 'all' && item.domain !== domain) return false;
    if (eventType !== 'all' && item.eventType !== eventType) return false;
    if (!includeAdministrative && !isDefaultVisible(item)) return false;

    const day = isDateKey(item.date) ? item.date : localDayOf(item.timestamp);
    if (periodStart && day < periodStart) return false;
    if (untilDate && day > untilDate) return false;
    if (fromDate && day < fromDate) return false;

    if (needle) {
      const haystack = [
        item.title,
        item.description ?? '',
        item.badge ?? '',
        item.metricsSummary ?? '',
        item.linkedGoalTitle ?? '',
        item.domain,
        item.eventType
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

function localDayOf(timestamp: string): string {
  const parsed = new Date(timestamp);
  return isNaN(parsed.getTime()) ? timestamp : localDateKey(parsed);
}

/**
 * Turn a filtered stream into display events, newest first.
 *
 * Grouping only merges *adjacent* events, so the result keeps the true order of
 * the day: two Quran sessions, then a walk, then a third Quran session produce
 * three rows, not one — the walk really did happen in between.
 */
export function buildTimeline(items: UniversalHistoryItem[], options: BuildTimelineOptions = {}): TimelineEvent[] {
  const { group = true, ...query } = options;
  const filtered = filterTimeline(items, query);

  const sorted = [...filtered].sort((a, b) => {
    const ta = Date.parse(a.timestamp);
    const tb = Date.parse(b.timestamp);
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });

  if (!group) return sorted.map(toEvent);

  const out: TimelineEvent[] = [];
  let current: TimelineEvent | null = null;
  let currentKey = '';

  for (const item of sorted) {
    const event = toEvent(item);
    const key = groupKeyFor(event);

    if (current && key === currentKey) {
      current.groupedCount += 1;
      current.memberIds.push(event.id);
      current.members.push(item);
      // The newest member is already first because we iterate newest-first, so the
      // group's timestamp stays the most recent thing that happened in it.
      continue;
    }

    if (current) out.push(current);
    current = event;
    currentKey = key;
  }
  if (current) out.push(current);

  return out;
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر'
];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function monthName(monthIndex: number, isAr: boolean): string {
  const table = isAr ? MONTHS_AR : MONTHS_EN;
  return table[monthIndex] ?? '';
}

export type TimelineGranularity = 'day' | 'week' | 'month';

/**
 * How to divide the feed, chosen from how far back it reaches rather than from a
 * setting the user must manage:
 *   - a single month → day headings,
 *   - a single year → month headings with week separators inside,
 *   - anything longer → month headings only.
 */
export function chooseGranularity(events: TimelineEvent[], period: TimelinePeriod): TimelineGranularity {
  if (period === 'today' || period === 'week') return 'day';
  if (period === 'month') return 'day';
  if (period === 'year') return 'week';
  if (events.length === 0) return 'day';
  const years = new Set(events.map((e) => e.date.slice(0, 4)));
  return years.size <= 1 ? 'week' : 'month';
}

function formatDayHeading(dateKey: string, isAr: boolean): string {
  const [, m, d] = dateKey.split('-').map(Number);
  const weekday = weekDayLabelOf(dateKey, isAr);
  return isAr ? `${weekday} ${d} ${monthName(m - 1, true)}` : `${weekday}, ${monthName(m - 1, false)} ${d}`;
}

/** Group display events into day/week/month sections with readable headings. */
export function groupTimeline(
  events: TimelineEvent[],
  granularity: TimelineGranularity,
  isAr: boolean,
  todayKey: string = localDateKey()
): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const event of events) {
    let key: string;
    let date: string;

    if (granularity === 'day') {
      key = event.date;
      date = event.date;
    } else if (granularity === 'week') {
      key = startOfWeekKey(event.date);
      date = key;
    } else {
      key = event.date.slice(0, 7);
      date = `${key}-01`;
    }

    let group = groups.get(key);
    if (!group) {
      const isToday = granularity === 'day' ? date === todayKey : event.date === todayKey;
      group = {
        kind: granularity,
        key,
        date,
        label: '',
        isToday,
        events: []
      };
      groups.set(key, group);
    }
    group.events.push(event);
    if (event.date === todayKey) group.isToday = true;
  }

  const list = [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));

  for (const group of list) {
    if (group.kind === 'day') {
      group.label = formatDayHeading(group.date, isAr);
    } else if (group.kind === 'week') {
      const end = addDaysToKey(group.date, 6);
      const startDay = Number(group.date.slice(8, 10));
      const endDay = Number(end.slice(8, 10));
      const startMonth = monthName(Number(group.date.slice(5, 7)) - 1, isAr);
      const endMonth = monthName(Number(end.slice(5, 7)) - 1, isAr);
      group.label = isAr
        ? `${startDay} ${startMonth} — ${endDay} ${endMonth}`
        : `${startMonth} ${startDay} — ${endMonth} ${endDay}`;
      group.sublabel = isAr ? 'أسبوع' : 'Week';
    } else {
      const year = group.date.slice(0, 4);
      const month = monthName(Number(group.date.slice(5, 7)) - 1, isAr);
      group.label = `${month} ${year}`;
    }
  }

  return list;
}

/** Counts per domain over the filtered stream, for the filter chips. */
export function countByDomain(events: TimelineEvent[]): Partial<Record<UniversalHistoryDomain, number>> {
  const counts: Partial<Record<UniversalHistoryDomain, number>> = {};
  for (const event of events) {
    counts[event.domain] = (counts[event.domain] ?? 0) + 1;
  }
  return counts;
}

/** Counts per event type, for the type filter. */
export function countByEventType(events: TimelineEvent[]): Partial<Record<UniversalHistoryEventType, number>> {
  const counts: Partial<Record<UniversalHistoryEventType, number>> = {};
  for (const event of events) {
    counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
  }
  return counts;
}

/**
 * Progressive loading. The timeline can hold thousands of events after a year of
 * use; rendering them all is what makes a feed feel broken. `pageSize` entries are
 * shown at a time and `hasMore` tells the view whether to offer more.
 */
export interface TimelinePage {
  events: TimelineEvent[];
  shown: number;
  total: number;
  hasMore: boolean;
}

export function paginateTimeline(events: TimelineEvent[], pageSize: number, shownPages = 1): TimelinePage {
  const size = Math.max(1, pageSize);
  const limit = size * Math.max(1, shownPages);
  const slice = events.slice(0, limit);
  return {
    events: slice,
    shown: slice.length,
    total: events.length,
    hasMore: slice.length < events.length
  };
}

/** Everything a caller needs to render the timeline in one pass. */
export interface TimelineResult {
  events: TimelineEvent[];
  groups: TimelineGroup[];
  granularity: TimelineGranularity;
  total: number;
  domainCounts: Partial<Record<UniversalHistoryDomain, number>>;
  eventTypeCounts: Partial<Record<UniversalHistoryEventType, number>>;
  hasAnyEvents: boolean;
}

export function buildTimelineView(
  items: UniversalHistoryItem[],
  options: BuildTimelineOptions,
  isAr: boolean,
  todayKey: string = localDateKey()
): TimelineResult {
  const events = buildTimeline(items, options);
  const period = options.period ?? 'all';
  const granularity = chooseGranularity(events, period);
  return {
    events,
    groups: groupTimeline(events, granularity, isAr, todayKey),
    granularity,
    total: events.length,
    domainCounts: countByDomain(events),
    eventTypeCounts: countByEventType(events),
    hasAnyEvents: items.length > 0
  };
}
