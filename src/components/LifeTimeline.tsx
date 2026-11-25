import React, { useMemo, useState } from 'react';
import { UniversalHistoryDomain, UniversalHistoryEventType, UniversalHistoryItem } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { Badge, Button, EmptyState, FilterBar, Input, Surface } from './ui';
import {
  buildTimelineView,
  TimelineEvent,
  TimelineGroup,
  TimelinePeriod,
  paginateTimeline,
  TimelineQuery
} from '../lib/lifeTimeline';
import {
  domainLabel,
  domainMeta,
  eventTypeLabel,
  importanceStyle,
  TIMELINE_DOMAINS,
  TIMELINE_EVENT_TYPES
} from '../lib/historyPresentation';
import { localDateKey } from '../lib/dateKey';

const PAGE_SIZE = 40;

export interface LifeTimelineProps {
  items: UniversalHistoryItem[];
  isAr: boolean;
  /**
   * Open the event at its source. The timeline never edits anything itself — it is a
   * view over records owned by other modules, so the only write-ish action it offers is
   * "go there".
   */
  onOpenSource?: (domain: UniversalHistoryDomain, entityId: string) => void;
  /** Optional: called when a day heading is opened in the commitment map. */
  onOpenDay?: (dateKey: string) => void;
  /** Start with a domain already chosen, e.g. when arriving from the map. */
  initialDomain?: UniversalHistoryDomain | 'all';
  /** Narrow to one local day, e.g. when arriving from a cell on the map. */
  focusDate?: string | null;
  /** Clear the one-day focus so the full feed returns. */
  onClearFocusDate?: () => void;
}

const PERIODS: { id: TimelinePeriod; ar: string; en: string }[] = [
  { id: 'today', ar: 'اليوم', en: 'Today' },
  { id: 'week', ar: 'هذا الأسبوع', en: 'This week' },
  { id: 'month', ar: 'هذا الشهر', en: 'This month' },
  { id: 'year', ar: 'هذه السنة', en: 'This year' },
  { id: 'all', ar: 'كل الوقت', en: 'All time' }
];

export const LifeTimeline: React.FC<LifeTimelineProps> = ({
  items,
  isAr,
  onOpenSource,
  onOpenDay,
  initialDomain = 'all',
  focusDate = null,
  onClearFocusDate
}) => {
  const [period, setPeriod] = useState<TimelinePeriod>('month');
  const [domain, setDomain] = useState<UniversalHistoryDomain | 'all'>(initialDomain);
  const [eventType, setEventType] = useState<UniversalHistoryEventType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [includeAdmin, setIncludeAdmin] = useState(false);
  const [pages, setPages] = useState(1);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const todayKey = localDateKey();

  const query: TimelineQuery = useMemo(
    () => ({
      // A focused day is itself the period: showing "this month" around a single
      // day the user picked from the map would silently widen what they asked for.
      period: focusDate ? 'all' : period,
      domain,
      eventType,
      search,
      includeAdministrative: includeAdmin,
      fromDate: focusDate ?? undefined,
      untilDate: focusDate ?? undefined
    }),
    [period, domain, eventType, search, includeAdmin, focusDate]
  );

  const view = useMemo(
    () => buildTimelineView(items, query, isAr, todayKey),
    [items, query, isAr, todayKey]
  );

  // A new filter is a new question: always start reading from the top again.
  const page = useMemo(() => paginateTimeline(view.events, PAGE_SIZE, pages), [view.events, pages]);
  const visibleGroups = useMemo(() => {
    const shownIds = new Set(page.events.map((e) => e.id));
    return view.groups
      .map((group) => ({ ...group, events: group.events.filter((e) => shownIds.has(e.id)) }))
      .filter((group) => group.events.length > 0);
  }, [view.groups, page.events]);

  const resetPaging = () => setPages(1);

  const domainChips = useMemo(() => {
    const chips = [
      { id: 'all', label: isAr ? 'الكل' : 'All', count: view.total }
    ];
    for (const dom of TIMELINE_DOMAINS) {
      const count = view.domainCounts[dom];
      if (!count) continue;
      chips.push({ id: dom, label: domainLabel(dom, isAr), count });
    }
    return chips;
  }, [view.domainCounts, view.total, isAr]);

  const eventTypeChips = useMemo(() => {
    const chips = [{ id: 'all', label: isAr ? 'كل الأنواع' : 'All types' }];
    for (const type of TIMELINE_EVENT_TYPES) {
      if (!view.eventTypeCounts[type]) continue;
      chips.push({ id: type, label: eventTypeLabel(type, isAr) });
    }
    return chips;
  }, [view.eventTypeCounts, isAr]);

  return (
    <div className="space-y-4">
      {/* ---------- controls ---------- */}
      <Surface variant="panel" padding="md" className="space-y-3">
        {focusDate && (
          <div className="flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--brand-soft-border)] bg-[var(--brand-soft)] px-2.5 py-1.5">
            <NuqtaIcon name="calendar" className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span className="text-[var(--fs-xs)] text-[var(--text-primary)] tabular-nums">{focusDate}</span>
            {onClearFocusDate && (
              <button
                type="button"
                onClick={onClearFocusDate}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                aria-label={isAr ? 'إلغاء تحديد اليوم' : 'Clear the day filter'}
              >
                <NuqtaIcon name="close" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className={`flex flex-wrap items-center gap-2 ${focusDate ? 'opacity-50 pointer-events-none' : ''}`}>
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setPeriod(option.id);
                resetPaging();
              }}
              aria-pressed={period === option.id}
              className={[
                'px-3 h-8 rounded-[var(--r-xs)] text-[var(--fs-xs)] border transition-colors duration-[var(--dur-fast)]',
                period === option.id
                  ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft)] text-[var(--text-primary)] font-semibold'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              ].join(' ')}
            >
              {isAr ? option.ar : option.en}
            </button>
          ))}
          <div className="grow" />
          <label className="inline-flex items-center gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeAdmin}
              onChange={(event) => {
                setIncludeAdmin(event.target.checked);
                resetPaging();
              }}
              className="accent-[var(--brand-strong)]"
            />
            {isAr ? 'إظهار الأحداث الإدارية' : 'Show admin events'}
          </label>
        </div>

        <div className="relative">
          <NuqtaIcon
            name="search"
            className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-tertiary)] pointer-events-none"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPaging();
            }}
            placeholder={isAr ? 'ابحث في ذاكرتك…' : 'Search your history…'}
            className="ps-9"
            aria-label={isAr ? 'بحث في الجدول الزمني' : 'Search the timeline'}
          />
        </div>

        <FilterBar
          chips={domainChips}
          value={domain}
          onChange={(id) => {
            setDomain(id as UniversalHistoryDomain | 'all');
            resetPaging();
          }}
          ariaLabel={isAr ? 'تصفية حسب المجال' : 'Filter by area'}
        />

        {eventTypeChips.length > 2 && (
          <FilterBar
            chips={eventTypeChips}
            value={eventType}
            onChange={(id) => {
              setEventType(id as UniversalHistoryEventType | 'all');
              resetPaging();
            }}
            ariaLabel={isAr ? 'تصفية حسب نوع الحدث' : 'Filter by event type'}
          />
        )}
      </Surface>

      {/* ---------- feed ---------- */}
      {page.total === 0 ? (
        <Surface variant="panel" padding="lg">
          <EmptyState
            icon="history"
            title={
              view.hasAnyEvents
                ? isAr
                  ? 'لا شيء يطابق هذا الاختيار'
                  : 'Nothing matches this view'
                : isAr
                ? 'لم تبدأ ذاكرتك بعد'
                : 'Your memory has not started yet'
            }
            description={
              view.hasAnyEvents
                ? isAr
                  ? 'وسّع الفترة أو أزل التصفية لترى بقية أحداثك.'
                  : 'Widen the period or clear a filter to see the rest of your history.'
                : isAr
                  ? 'أول مهمة تُنجزها أو عادة تُكملها ستظهر هنا. الجدول الزمني يُبنى من سجلاتك الحقيقية، لا من بيانات تجريبية.'
                  : 'The first task you finish or habit you keep will appear here. The timeline is built from your real records, never from sample data.'
            }
          />
        </Surface>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <TimelineSection
              key={group.key}
              group={group}
              isAr={isAr}
              todayKey={todayKey}
              openEventId={openEventId}
              onToggleEvent={(id) => setOpenEventId(openEventId === id ? null : id)}
              onOpenSource={onOpenSource}
              onOpenDay={onOpenDay}
            />
          ))}

          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
              {isAr
                ? `عرض ${page.shown} من ${page.total} حدثاً`
                : `Showing ${page.shown} of ${page.total} events`}
            </p>
            {page.hasMore && (
              <Button variant="ghost" size="sm" onClick={() => setPages((p) => p + 1)}>
                <NuqtaIcon name="chevronDown" className="w-4 h-4" />
                {isAr ? 'تحميل المزيد' : 'Load more'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   One day / week / month section
   ============================================================ */

interface TimelineSectionProps {
  group: TimelineGroup;
  isAr: boolean;
  todayKey: string;
  openEventId: string | null;
  onToggleEvent: (id: string) => void;
  onOpenSource?: (domain: UniversalHistoryDomain, entityId: string) => void;
  onOpenDay?: (dateKey: string) => void;
}

const TimelineSection: React.FC<TimelineSectionProps> = ({
  group,
  isAr,
  todayKey,
  openEventId,
  onToggleEvent,
  onOpenSource,
  onOpenDay
}) => {
  const relative = relativeDayLabel(group.date, isAr, todayKey);

  return (
    <section aria-label={group.label}>
      <header className="flex items-center gap-2 mb-2">
        <h3 className="text-[var(--fs-sm)] font-semibold text-[var(--text-primary)]">
          {relative ?? group.label}
        </h3>
        {relative && group.kind === 'day' && (
          <span className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">{group.label}</span>
        )}
        <span className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
          · {group.events.length}
        </span>
        <div className="grow h-px bg-[var(--border-subtle)]" />
        {onOpenDay && group.kind === 'day' && (
          <button
            type="button"
            onClick={() => onOpenDay(group.date)}
            className="text-[var(--fs-xs)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {isAr ? 'في الخريطة' : 'On the map'}
          </button>
        )}
      </header>

      <ol className="relative ps-4 space-y-2">
        {/* The rail is drawn once per section, so consecutive rows read as one day. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-1 start-[3px] w-px bg-[var(--border-subtle)]"
        />
        {group.events.map((event) => (
          <TimelineRow
            key={event.id}
            event={event}
            isAr={isAr}
            expanded={openEventId === event.id}
            onToggle={() => onToggleEvent(event.id)}
            onOpenSource={onOpenSource}
          />
        ))}
      </ol>
    </section>
  );
};

/* ============================================================
   One event
   ============================================================ */

interface TimelineRowProps {
  event: TimelineEvent;
  isAr: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenSource?: (domain: UniversalHistoryDomain, entityId: string) => void;
}

const TimelineRow: React.FC<TimelineRowProps> = ({ event, isAr, expanded, onToggle, onOpenSource }) => {
  const meta = domainMeta(event.domain);
  const style = importanceStyle(event.importance);
  const time = formatTime(event.timestamp);

  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={`absolute -start-4 top-3 ${style.markerSize} rounded-full ${style.markerClass}`}
      />
      <div
        className={`rounded-[var(--r-sm)] border px-3 py-2 transition-colors duration-[var(--dur-fast)] ${style.cardClass}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="w-full text-start flex items-start gap-2"
        >
          <span className="mt-0.5 shrink-0" style={{ color: meta.tone }}>
            <NuqtaIcon name={meta.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="min-w-0 grow">
            <span className={`block truncate ${style.titleClass}`}>{event.title}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[var(--fs-xs)] text-[var(--text-tertiary)]">
              <span>{time}</span>
              <span aria-hidden="true">·</span>
              <span>{domainLabel(event.domain, isAr)}</span>
              {event.groupedCount > 1 && (
                <Badge tone="neutral">
                  {isAr ? `${event.groupedCount} أحداث` : `${event.groupedCount} events`}
                </Badge>
              )}
              {event.metricsSummary && <span className="truncate">{event.metricsSummary}</span>}
            </span>
          </span>
          <NuqtaIcon
            name="chevronDown"
            className={`w-3.5 h-3.5 mt-1 shrink-0 text-[var(--text-tertiary)] transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expanded && (
          <div className="mt-2 ps-5 space-y-2">
            {event.description && (
              <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">
                {event.description}
              </p>
            )}

            {event.linkedGoalTitle && (
              <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
                {isAr ? 'مرتبط بهدف: ' : 'Linked to goal: '}
                <span className="text-[var(--text-secondary)]">{event.linkedGoalTitle}</span>
              </p>
            )}

            {/* A collapsed group shows every member, so the count is verifiable. */}
            {event.groupedCount > 1 && (
              <ul className="space-y-1 border-s border-[var(--border-subtle)] ps-2">
                {event.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-baseline gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)]"
                  >
                    <span className="text-[var(--text-tertiary)] tabular-nums">
                      {formatTime(member.timestamp)}
                    </span>
                    <span className="truncate">{member.title}</span>
                  </li>
                ))}
              </ul>
            )}

            {event.sourceTab && onOpenSource && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenSource(event.domain, event.entityId)}
              >
                {isAr ? 'افتح المصدر' : 'Open source'}
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5 rtl:-scale-x-100" />
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

/* ---------- helpers ---------- */

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "Today"/"Yesterday" only where they are true; otherwise the section keeps its own label. */
function relativeDayLabel(dateKey: string, isAr: boolean, todayKey: string): string | null {
  if (dateKey === todayKey) return isAr ? 'اليوم' : 'Today';
  const yesterday = new Date(`${todayKey}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = localDateKey(yesterday);
  if (dateKey === y) return isAr ? 'أمس' : 'Yesterday';
  return null;
}

export default LifeTimeline;
