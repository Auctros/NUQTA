import React, { useState } from 'react';
import { ActivityAllocationData, ActivityCategoryId } from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface ActivityAllocationPanelProps {
  data: ActivityAllocationData;
  isAr: boolean;
  onOpenFocus: () => void;
  onOpenHealth: () => void;
}

function formatHoursMin(minutes: number, isAr: boolean): string {
  if (minutes < 60) return `${minutes}${isAr ? 'د' : 'm'}`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hrs}${isAr ? 'س' : 'h'}`;
  return `${hrs}${isAr ? 'س' : 'h'} ${rem}${isAr ? 'د' : 'm'}`;
}

export const ActivityAllocationPanel: React.FC<ActivityAllocationPanelProps> = ({
  data,
  isAr,
  onOpenFocus,
  onOpenHealth
}) => {
  const [windowId, setWindowId] = useState<'7d' | '30d'>('7d');
  const [hoveredSlice, setHoveredSlice] = useState<ActivityCategoryId | null>(null);

  const period = windowId === '7d' ? data.period7d : data.period30d;
  const nonZeroSlices = period.slices.filter((s) => s.minutes > 0);
  const activeHover = hoveredSlice ? nonZeroSlices.find((s) => s.id === hoveredSlice) || null : null;

  // Donut geometry
  const size = 140;
  const strokeW = 16;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;

  let cumulativeOffset = 0;
  const arcs = nonZeroSlices.map((slice) => {
    const frac = period.totalMinutes > 0 ? slice.minutes / period.totalMinutes : 0;
    const rawLen = frac * circ;
    const gap = nonZeroSlices.length > 1 ? 2.5 : 0;
    const dashLen = Math.max(2, rawLen - gap);
    const arc = {
      ...slice,
      dashArray: `${dashLen.toFixed(2)} ${(circ - dashLen).toFixed(2)}`,
      dashOffset: (-cumulativeOffset).toFixed(2)
    };
    cumulativeOffset += rawLen;
    return arc;
  });

  // Today vs 7D Daily Avg stacked bar scale
  const avgDaily7d = data.period7d.dailyAvgMinutes || 0;
  const barScaleMax = Math.max(1, data.todayTotalMinutes, avgDaily7d);

  // Energy Radial Gauge (56px)
  const gaugeR = 22;
  const gaugeCirc = 2 * Math.PI * gaugeR;
  const energyClamped = Math.min(100, Math.max(0, data.todayHealth.energyScore));
  const energyDash = (energyClamped / 100) * gaugeCirc;

  return (
    <aside
      className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-4 h-full"
      aria-label={isAr ? 'توزيع الوقت النشط والتعافي' : 'Activity Allocation & Recovery'}
    >
      {/* 1. Time Allocation Donut */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
              {isAr ? 'توزيع النشاط' : 'TIME ALLOCATION'}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5 truncate">
              {isAr ? 'أين ذهب وقتك المركّز' : 'Where Focused Time Went'}
            </div>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-deep)] shrink-0">
            {(['7d', '30d'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setWindowId(id)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                  windowId === id
                    ? 'bg-[var(--brand)] text-[var(--text-on-accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {period.totalMinutes === 0 ? (
          <div className="dash-glass-inset mt-3 p-5 text-center">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {isAr ? 'لا توجد دقائق مسجلة في هذه النافذة' : 'No timed activity logged in this window'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              {isAr
                ? 'ابدأ جلسة تركيز أو سجّل وقت قراءة أو تمرين لرسم توزيع وقتك.'
                : 'Log a Focus, Reading, Workout, Art, or Quran session to view allocation.'}
            </div>
            <button
              type="button"
              onClick={onOpenFocus}
              className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--brand)] text-[var(--text-on-accent)]"
            >
              {isAr ? 'فتح التركيز' : 'Open Focus'}
            </button>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-4">
            {/* Donut SVG */}
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="var(--surface-track)"
                  strokeWidth={strokeW}
                />
                {arcs.map((arc) => {
                  const isDimmed = hoveredSlice !== null && hoveredSlice !== arc.id;
                  return (
                    <circle
                      key={arc.id}
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={hoveredSlice === arc.id ? strokeW + 2 : strokeW}
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                      strokeOpacity={isDimmed ? 0.32 : 0.94}
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredSlice(arc.id)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
                <div className="text-lg font-mono font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                  {activeHover
                    ? `${activeHover.sharePercent}%`
                    : formatHoursMin(period.totalMinutes, isAr)}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[84px]">
                  {activeHover
                    ? isAr
                      ? activeHover.labelAr
                      : activeHover.labelEn
                    : isAr
                    ? `${period.activeDaysCount} يوم نشط`
                    : `${period.activeDaysCount} active d`}
                </div>
              </div>
            </div>

            {/* Compact Tabular Legend */}
            <div className="w-full flex-1 space-y-1.5 min-w-0">
              {period.slices.map((slice) => {
                const isActive = hoveredSlice === slice.id;
                return (
                  <div
                    key={slice.id}
                    onMouseEnter={() => slice.minutes > 0 && setHoveredSlice(slice.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-md text-xs transition-colors ${
                      isActive ? 'bg-[var(--surface-faint)]' : ''
                    } ${slice.minutes === 0 ? 'opacity-45' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="truncate text-[var(--text-primary)]">
                        {isAr ? slice.labelAr : slice.labelEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-[11px] shrink-0">
                      <span className="text-[var(--text-secondary)]">
                        {slice.minutes > 0 ? formatHoursMin(slice.minutes, isAr) : '0m'}
                      </span>
                      <span className="w-8 text-end text-[var(--text-tertiary)]">
                        {slice.sharePercent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Today vs 7D Daily Avg Stacked Comparison Bar */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {isAr ? 'اليوم مقابل متوسط 7 أيام' : 'TODAY VS 7D DAILY AVG'}
          </span>
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">
            {data.period7d.dailyAvgMinutes !== null
              ? `${data.todayTotalMinutes}m / ${data.period7d.dailyAvgMinutes}m`
              : `${data.todayTotalMinutes}m`}
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Today Stacked Bar */}
          <div className="flex items-center gap-2">
            <span className="w-11 text-[10.5px] font-mono text-[var(--text-secondary)] shrink-0">
              {isAr ? 'اليوم' : 'Today'}
            </span>
            <div className="flex-1 h-2.5 rounded-[4px] bg-[var(--surface-track)] overflow-hidden flex">
              {data.todaySlices
                .filter((s) => s.minutes > 0)
                .map((s) => (
                  <div
                    key={s.id}
                    title={`${isAr ? s.labelAr : s.labelEn}: ${s.minutes}m`}
                    style={{
                      width: `${Math.max(2, (s.minutes / barScaleMax) * 100)}%`,
                      backgroundColor: s.color
                    }}
                  />
                ))}
            </div>
            <span className="w-10 text-end text-[11px] font-mono tabular-nums text-[var(--text-primary)] shrink-0">
              {data.todayTotalMinutes}m
            </span>
          </div>

          {/* 7D Avg Reference Bar */}
          <div className="flex items-center gap-2">
            <span className="w-11 text-[10.5px] font-mono text-[var(--text-tertiary)] shrink-0">
              {isAr ? 'متوسط' : '7D Avg'}
            </span>
            <div className="flex-1 h-2 rounded-[4px] bg-[var(--surface-track)] overflow-hidden">
              <div
                className="h-full rounded-[4px] bg-[var(--text-tertiary)]/55 transition-all"
                style={{
                  width: `${data.period7d.dailyAvgMinutes ? Math.max(2, (avgDaily7d / barScaleMax) * 100) : 0}%`
                }}
              />
            </div>
            <span className="w-10 text-end text-[11px] font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
              {data.period7d.dailyAvgMinutes !== null ? `${data.period7d.dailyAvgMinutes}m` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Recovery & Health Telemetry Snapshot */}
      <div className="pt-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {isAr ? 'مؤشرات التعافي والطاقة' : 'RECOVERY TELEMETRY'}
          </span>
          <button
            type="button"
            onClick={onOpenHealth}
            className="text-[11px] font-medium text-[var(--brand-strong)] hover:underline whitespace-nowrap"
          >
            {isAr ? 'سجل الصحة' : 'Health Log'}
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Energy Radial Gauge */}
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
              <circle
                cx="28"
                cy="28"
                r={gaugeR}
                fill="none"
                stroke="var(--surface-track)"
                strokeWidth="5"
              />
              <circle
                cx="28"
                cy="28"
                r={gaugeR}
                fill="none"
                stroke={
                  data.todayHealth.logged
                    ? energyClamped >= 70
                      ? 'var(--brand-strong)'
                      : energyClamped >= 45
                      ? 'var(--state-warning)'
                      : 'var(--state-danger)'
                    : 'var(--text-tertiary)'
                }
                strokeOpacity={data.todayHealth.logged ? 1 : 0.35}
                strokeWidth="5"
                strokeDasharray={`${energyDash.toFixed(1)} ${gaugeCirc.toFixed(1)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono tabular-nums">
              <span className="text-xs font-bold text-[var(--text-primary)] leading-none">
                {data.todayHealth.logged ? `${energyClamped}%` : '—'}
              </span>
            </div>
          </div>

          {data.todayHealth.logged ? (
            <div className="grid grid-cols-3 gap-2 flex-1 min-w-0 font-mono tabular-nums">
              <div>
                <div className="text-[10px] font-sans text-[var(--text-tertiary)]">
                  {isAr ? 'النوم' : 'Sleep'}
                </div>
                <div className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                  {data.todayHealth.sleepHours > 0 ? `${data.todayHealth.sleepHours}h` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-[var(--text-tertiary)]">
                  {isAr ? 'الماء' : 'Water'}
                </div>
                <div className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                  {data.todayHealth.hydrationMl > 0
                    ? `${(data.todayHealth.hydrationMl / 1000).toFixed(1)}L`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-[var(--text-tertiary)]">
                  {isAr ? 'المزاج' : 'Mood'}
                </div>
                <div className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                  {data.todayHealth.moodRating > 0 ? `${data.todayHealth.moodRating}/5` : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                {isAr ? 'لم تُسجّل بيانات تعافٍ اليوم' : 'No recovery metrics logged today'}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {isAr ? 'سجّل النوم أو الماء لحساب الجاهزية بدقة.' : 'Log sleep, hydration, or mood in Health.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
