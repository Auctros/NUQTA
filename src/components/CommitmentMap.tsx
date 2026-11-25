import React, { useMemo, useState } from 'react';
import {
  CommitmentDay,
  CommitmentScope,
  buildCommitmentYear,
  CommitmentSources,
  SCHEDULED_SCOPES,
  weekOf
} from '../lib/commitmentMap';
import { NuqtaIcon } from './NuqtaIcon';
import { Badge, Button, Surface } from './ui';
import { commitmentStateLabel, domainLabel, domainMeta } from '../lib/historyPresentation';
import { localDateKey } from '../lib/dateKey';
import { weekDayNarrows } from '../lib/week';
import { UniversalHistoryItem } from '../types';

/**
 * Level → fill. A `missed` day gets a danger wash and a `rest` day gets a hatched
 * neutral, because a map where "did nothing because nothing was due" and "did nothing
 * because you didn't" look the same is actively misleading.
 */
const LEVEL_FILL: Record<number, string> = {
  0: 'var(--heat-0-bg)',
  1: 'var(--heat-1-bg)',
  2: 'var(--heat-2-bg)',
  3: 'var(--heat-3-bg)',
  4: 'var(--heat-4-bg)'
};

export interface CommitmentMapProps {
  sources: CommitmentSources;
  isAr: boolean;
  /** Events for the selected day, from the same history engine the timeline uses. */
  history?: UniversalHistoryItem[];
  onOpenTimeline?: (dateKey: string) => void;
  onOpenSource?: (domain: UniversalHistoryItem['domain'], entityId: string) => void;
  /** `compact` is for the dashboard card; `full` is the dedicated map view. */
  variant?: 'compact' | 'full';
  /** A day to open on arrival, e.g. after tapping a day in the timeline. */
  initialDay?: string | null;
}

export const CommitmentMap: React.FC<CommitmentMapProps> = ({
  sources,
  isAr,
  history = [],
  onOpenTimeline,
  onOpenSource,
  variant = 'full',
  initialDay = null
}) => {
  const todayKey = localDateKey();
  // Arriving with a specific day should open that day *and its year*, otherwise the
  // selection points at a cell the current grid does not contain.
  const [year, setYear] = useState<number>(
    Number((initialDay ?? todayKey).slice(0, 4))
  );
  const [scope, setScope] = useState<CommitmentScope>('all');
  const [selected, setSelected] = useState<string | null>(initialDay);

  const map = useMemo(
    () => buildCommitmentYear(sources, year, scope, todayKey),
    [sources, year, scope, todayKey]
  );

  const years = useMemo(() => {
    const startYear = map.trackingStart ? Number(map.trackingStart.slice(0, 4)) : year;
    const currentYear = Number(todayKey.slice(0, 4));
    const list: number[] = [];
    for (let y = currentYear; y >= Math.min(startYear, currentYear); y -= 1) list.push(y);
    return list;
  }, [map.trackingStart, todayKey, year]);

  const selectedDay = selected
    ? map.weeks.flat().find((day) => day && day.dateKey === selected) ?? null
    : null;

  const isCompact = variant === 'compact';

  return (
    <div className={isCompact ? 'space-y-3' : 'space-y-4'}>
      {/* ---------- header: the reading, not a bare number ---------- */}
      {!isCompact && (
      <Surface variant="panel" padding="md" className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 grow">
            <p className="text-[var(--fs-xs)] uppercase tracking-wide text-[var(--text-tertiary)]">
              {isAr ? 'خريطة الالتزام' : 'Commitment map'}
            </p>
            <p className="text-[var(--fs-sm)] text-[var(--text-primary)] leading-relaxed mt-1">
              {isAr ? map.summary.headlineAr : map.summary.headlineEn}
            </p>
          </div>
          {years.length > 1 && (
            <label className="flex items-center gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)]">
              <span className="sr-only">{isAr ? 'السنة' : 'Year'}</span>
              <select
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setSelected(null);
                }}
                className="h-8 px-2 rounded-[var(--r-xs)] bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SCHEDULED_SCOPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setScope(option);
                setSelected(null);
              }}
              aria-pressed={scope === option}
              className={[
                'px-2.5 h-7 rounded-[var(--r-xs)] text-[var(--fs-xs)] border transition-colors',
                scope === option
                  ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft)] text-[var(--text-primary)] font-semibold'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              ].join(' ')}
            >
              {option === 'all'
                ? isAr
                  ? 'الكل'
                  : 'Everything'
                : domainLabel(option as UniversalHistoryItem['domain'], isAr)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            label={isAr ? 'أيام كاملة' : 'Full days'}
            value={map.summary.keptDays}
            tone="var(--tone-success)"
          />
          <Stat
            label={isAr ? 'أطول سلسلة' : 'Longest run'}
            value={map.summary.longestStreak}
            tone="var(--brand-strong)"
          />
          <Stat
            label={isAr ? 'أيام جزئية' : 'Partial days'}
            value={map.summary.partialDays}
            tone="var(--tone-warning)"
          />
          <Stat
            label={isAr ? 'أيام فائتة' : 'Missed days'}
            value={map.summary.missedDays}
            tone="var(--tone-danger)"
          />
        </div>
      </Surface>
      )}

      {/* ---------- the grid ---------- */}
      <Surface variant={isCompact ? 'inset' : 'panel'} padding={isCompact ? 'none' : 'md'} className={isCompact ? 'space-y-2' : 'space-y-2 overflow-hidden'}>
        <div className="overflow-x-auto pb-1">
          <div className="inline-block min-w-full">
            {/* Month labels sit above the column where the month starts. */}
            <div className="flex gap-[3px] mb-1 ps-6 h-4" aria-hidden="true">
              {map.weeks.map((_, column) => {
                const month = map.months.find((m) => m.column === column);
                return (
                  <span
                    key={column}
                    className="w-[11px] text-[10px] leading-4 text-[var(--text-tertiary)] whitespace-nowrap"
                  >
                    {month ? (isAr ? month.labelAr : month.labelEn) : ''}
                  </span>
                );
              })}
            </div>

            <div className="flex gap-[3px]">
              {/* Weekday rail, NUQTA weeks start Saturday. */}
              <div className="flex flex-col gap-[3px] w-6 shrink-0" aria-hidden="true">
                {weekDayNarrows(isAr).map((letter, index) => (
                  <span
                    key={index}
                    className="h-[11px] text-[9px] leading-[11px] text-[var(--text-tertiary)] text-center"
                  >
                    {letter}
                  </span>
                ))}
              </div>

              <div
                className="flex gap-[3px]"
                role="grid"
                aria-label={isAr ? `خريطة التزام سنة ${year}` : `Commitment map for ${year}`}
              >
                {map.weeks.map((week, columnIndex) => (
                  <div key={columnIndex} className="flex flex-col gap-[3px]" role="row">
                    {week.map((day, rowIndex) => (
                      <DayCell
                        key={day ? day.dateKey : `empty-${columnIndex}-${rowIndex}`}
                        day={day}
                        isAr={isAr}
                        selected={day ? selected === day.dateKey : false}
                        onSelect={day ? () => setSelected(day.dateKey) : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Legend isAr={isAr} />

        {map.summary.noDataDays > 0 && (
          <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
            {isAr
              ? `${map.summary.noDataDays} يوماً قبل بدء التتبع — تُعرض كفراغ، لا كفشل.`
              : `${map.summary.noDataDays} days before tracking began — shown as blank, not as failure.`}
          </p>
        )}
      </Surface>

      {/* ---------- selected day ---------- */}
      {selectedDay && (
        <DayDetail
          day={selectedDay}
          isAr={isAr}
          history={history}
          onClose={() => setSelected(null)}
          onOpenTimeline={onOpenTimeline}
          onOpenSource={onOpenSource}
          showWeek={variant === 'full'}
        />
      )}
    </div>
  );
};

/* ============================================================
   Cell
   ============================================================ */

const DayCell: React.FC<{
  day: CommitmentDay | null;
  isAr: boolean;
  selected: boolean;
  onSelect?: () => void;
}> = ({ day, isAr, selected, onSelect }) => {
  if (!day) {
    return <span aria-hidden="true" className="w-[11px] h-[11px]" />;
  }

  const { label } = commitmentStateLabel(day.state, isAr);
  const fill = day.state === 'missed' ? 'var(--tone-danger-wash)' : LEVEL_FILL[day.level];
  const border =
    day.state === 'missed'
      ? 'var(--tone-danger-line)'
      : day.isToday
      ? 'var(--brand-strong)'
      : 'var(--heat-0-line)';

  const detail = [
    day.dateKey,
    label,
    day.dueCount > 0 ? (isAr ? `${day.doneCount}/${day.dueCount} ملتزم به` : `${day.doneCount}/${day.dueCount} kept`) : null,
    day.bonusCount > 0 ? (isAr ? `${day.bonusCount} نشاط إضافي` : `${day.bonusCount} extra`) : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      role="gridcell"
      onClick={onSelect}
      title={detail}
      aria-label={detail}
      aria-pressed={selected}
      className="w-[11px] h-[11px] rounded-[2px] transition-[outline] duration-[var(--dur-fast)]"
      style={{
        backgroundColor: fill,
        boxShadow: `inset 0 0 0 1px ${selected ? 'var(--text-primary)' : border}`,
        outline: selected ? '1px solid var(--text-primary)' : 'none',
        outlineOffset: '1px',
        // Rest days read as deliberately empty, not as a low score.
        opacity: day.state === 'future' ? 0.35 : day.state === 'no_data' ? 0.3 : 1
      }}
    />
  );
};

/* ============================================================
   Legend
   ============================================================ */

const Legend: React.FC<{ isAr: boolean }> = ({ isAr }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-[var(--text-tertiary)]">
    <span>{isAr ? 'أقل' : 'Less'}</span>
    {[0, 1, 2, 3, 4].map((level) => (
      <span
        key={level}
        className="w-[11px] h-[11px] rounded-[2px]"
        style={{ backgroundColor: LEVEL_FILL[level], boxShadow: 'inset 0 0 0 1px var(--heat-0-line)' }}
      />
    ))}
    <span>{isAr ? 'أكثر' : 'More'}</span>
    <span className="mx-1 opacity-40">|</span>
    <span
      className="w-[11px] h-[11px] rounded-[2px]"
      style={{
        backgroundColor: 'var(--tone-danger-wash)',
        boxShadow: 'inset 0 0 0 1px var(--tone-danger-line)'
      }}
    />
    <span>{isAr ? 'فائت' : 'Missed'}</span>
    <span
      className="w-[11px] h-[11px] rounded-[2px]"
      style={{ backgroundColor: 'var(--heat-0-bg)', boxShadow: 'inset 0 0 0 1px var(--heat-0-line)' }}
    />
    <span>{isAr ? 'لا شيء مستحق' : 'Nothing due'}</span>
  </div>
);

/* ============================================================
   Day detail
   ============================================================ */

const DayDetail: React.FC<{
  day: CommitmentDay;
  isAr: boolean;
  history: UniversalHistoryItem[];
  onClose: () => void;
  onOpenTimeline?: (dateKey: string) => void;
  onOpenSource?: (domain: UniversalHistoryItem['domain'], entityId: string) => void;
  showWeek: boolean;
}> = ({ day, isAr, history, onClose, onOpenTimeline, onOpenSource, showWeek }) => {
  const { label } = commitmentStateLabel(day.state, isAr);
  const dayEvents = history.filter(
    (item) => (item.date || '') === day.dateKey
  );
  const week = weekOf(day.dateKey);

  return (
    <Surface variant="panel" padding="md" className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="grow">
          <p className="text-[var(--fs-sm)] font-semibold text-[var(--text-primary)]">
            {formatFullDate(day.dateKey, isAr)}
          </p>
          <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
            {label}
            {day.ratio !== null && ` · ${Math.round(day.ratio * 100)}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? 'إغلاق' : 'Close'}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <NuqtaIcon name="close" className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat label={isAr ? 'مستحق' : 'Due'} value={day.dueCount} />
        <MiniStat label={isAr ? 'أُنجز' : 'Done'} value={day.doneCount} />
        <MiniStat label={isAr ? 'إضافي' : 'Extra'} value={day.bonusCount} />
      </div>

      {Object.keys(day.byDomain).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(day.byDomain).map(([domain, entry]) => {
            if (!entry) return null;
            const meta = domainMeta(domain as UniversalHistoryItem['domain']);
            return (
              <div
                key={domain}
                className="flex items-center gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)]"
              >
                <span style={{ color: meta.tone }}>
                  <NuqtaIcon name={meta.icon} className="w-3.5 h-3.5" />
                </span>
                <span className="grow">{domainLabel(domain as UniversalHistoryItem['domain'], isAr)}</span>
                {entry.due > 0 && (
                  <span className="tabular-nums">
                    {entry.done}/{entry.due}
                  </span>
                )}
                {entry.bonus > 0 && (
                  <Badge tone="neutral">
                    +{entry.bonus} {isAr ? 'إضافي' : 'extra'}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dayEvents.length > 0 && (
        <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
          {dayEvents.slice(0, 8).map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onOpenSource?.(event.domain, event.entityId)}
                className="w-full text-start flex items-baseline gap-2 text-[var(--fs-xs)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="text-[var(--text-tertiary)] tabular-nums shrink-0">
                  {event.timestamp.slice(11, 16)}
                </span>
                <span className="truncate">{event.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dayEvents.length === 0 && day.state !== 'no_data' && (
        <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
          {isAr ? 'لا أحداث مسجّلة في هذا اليوم.' : 'No events recorded on this day.'}
        </p>
      )}

      {showWeek && (
        <div className="flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-2">
          {week.map((key) => (
            <span
              key={key}
              className={[
                'text-[10px] px-1.5 py-0.5 rounded-[var(--r-xs)] tabular-nums',
                key === day.dateKey
                  ? 'bg-[var(--brand-soft)] text-[var(--text-primary)]'
                  : 'bg-[var(--surface-inset)] text-[var(--text-tertiary)]'
              ].join(' ')}
            >
              {key.slice(8)}
            </span>
          ))}
        </div>
      )}

      {onOpenTimeline && (
        <Button variant="ghost" size="sm" onClick={() => onOpenTimeline(day.dateKey)}>
          <NuqtaIcon name="history" className="w-3.5 h-3.5" />
          {isAr ? 'افتح هذا اليوم في الجدول الزمني' : 'Open this day in the timeline'}
        </Button>
      )}
    </Surface>
  );
};

/* ---------- small pieces ---------- */

const Stat: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className="rounded-[var(--r-sm)] border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5">
    <p className="text-[var(--fs-lg)] font-semibold tabular-nums" style={{ color: tone }}>
      {value}
    </p>
    <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
  </div>
);

const MiniStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-[var(--r-sm)] bg-[var(--surface-inset)] py-1">
    <p className="text-[var(--fs-sm)] font-semibold tabular-nums text-[var(--text-primary)]">{value}</p>
    <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
  </div>
);

function formatFullDate(dateKey: string, isAr: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return dateKey;
  try {
    return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateKey;
  }
}

export default CommitmentMap;
