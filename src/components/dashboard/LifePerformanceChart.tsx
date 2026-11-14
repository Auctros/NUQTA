import React, { useId, useMemo, useState } from 'react';
import {
  PerformanceTrendResult,
  TrendMetricId,
  TrendRangeId
} from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface LifePerformanceChartProps {
  trend: PerformanceTrendResult;
  metric: TrendMetricId;
  range: TrendRangeId;
  onMetricChange: (m: TrendMetricId) => void;
  onRangeChange: (r: TrendRangeId) => void;
  isAr: boolean;
  onOpenRelevantView: (metric: TrendMetricId) => void;
}

const METRIC_OPTIONS: Array<{ id: TrendMetricId; labelAr: string; labelEn: string }> = [
  { id: 'activeMinutes', labelAr: 'الوقت النشط', labelEn: 'Active Time' },
  { id: 'tasksCompleted', labelAr: 'المهام المنجزة', labelEn: 'Tasks' },
  { id: 'habitConsistency', labelAr: 'التزام العادات', labelEn: 'Habit Rate' },
  { id: 'focusMinutes', labelAr: 'التركيز العميق', labelEn: 'Focus' },
  { id: 'readingPages', labelAr: 'القراءة', labelEn: 'Reading' },
  { id: 'workoutReps', labelAr: 'التمرين', labelEn: 'Workout' },
  { id: 'quranAyahs', labelAr: 'القرآن', labelEn: 'Quran' }
];

const RANGE_OPTIONS: Array<{ id: TrendRangeId; label: string }> = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'year', label: 'Year' }
];

function buildSmoothPath(
  coords: Array<{ x: number; y: number } | null>,
  minY: number,
  maxY: number
): string {
  const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
  const segments: string[] = [];
  let currentRun: Array<{ x: number; y: number }> = [];

  const flushRun = (run: Array<{ x: number; y: number }>) => {
    if (run.length === 0) return;
    if (run.length === 1) {
      segments.push(`M ${run[0].x.toFixed(1)} ${run[0].y.toFixed(1)}`);
      return;
    }
    let d = `M ${run[0].x.toFixed(1)} ${run[0].y.toFixed(1)}`;
    for (let i = 0; i < run.length - 1; i++) {
      const p0 = run[Math.max(0, i - 1)];
      const p1 = run[i];
      const p2 = run[i + 1];
      const p3 = run[Math.min(run.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    segments.push(d);
  };

  for (const pt of coords) {
    if (pt) currentRun.push(pt);
    else {
      flushRun(currentRun);
      currentRun = [];
    }
  }
  flushRun(currentRun);
  return segments.join(' ');
}

function buildAreaPath(
  coords: Array<{ x: number; y: number } | null>,
  minY: number,
  baselineY: number
): string {
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const pt of coords) {
    if (pt) current.push(pt);
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);

  return runs
    .filter((r) => r.length >= 2)
    .map((run) => {
      const line = buildSmoothPath(run, minY, baselineY);
      const last = run[run.length - 1];
      const first = run[0];
      return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
    })
    .join(' ');
}

export const LifePerformanceChart: React.FC<LifePerformanceChartProps> = ({
  trend,
  metric,
  range,
  onMetricChange,
  onRangeChange,
  isAr,
  onOpenRelevantView
}) => {
  const gradId = useId().replace(/:/g, '');
  const gapPatternId = `gap-${gradId}`;
  const [showComparison, setShowComparison] = useState(true);
  const [showRollingAvg, setShowRollingAvg] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const unit = isAr ? trend.unitAr : trend.unitEn;
  const noDataLabel = isAr ? 'لا توجد بيانات مسجلة' : 'No recorded data';
  const noDataShort = isAr ? 'لا توجد بيانات' : 'No data';

  const formatVal = (v: number | null) => {
    if (v === null) return noDataShort;
    return trend.isPercentage ? `${v}%` : `${v.toLocaleString()} ${unit}`;
  };

  const chart = useMemo(() => {
    const W = 820;
    const H = 288;
    const padL = 48;
    const padR = 20;
    const padT = 30;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const baselineY = padT + plotH;

    const allNums: number[] = [];
    for (const p of trend.points) {
      if (p.currentValue !== null) allNums.push(p.currentValue);
      if (showComparison && p.previousValue !== null) allNums.push(p.previousValue);
      if (showRollingAvg && p.rollingAvg !== null) allNums.push(p.rollingAvg);
    }
    if (trend.targetValue !== null) allNums.push(trend.targetValue);

    const rawMax = allNums.length > 0 ? Math.max(...allNums) : trend.isPercentage ? 100 : 10;
    const yMax = trend.isPercentage
      ? 100
      : rawMax <= 0
      ? 10
      : Math.ceil((rawMax * 1.16) / (rawMax > 50 ? 10 : 1)) * (rawMax > 50 ? 10 : 1);

    const n = Math.max(1, trend.points.length);
    const xFor = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
    const yFor = (val: number) => padT + plotH - (Math.min(yMax, Math.max(0, val)) / yMax) * plotH;

    const currentCoords = trend.points.map((p, i) =>
      p.currentValue === null ? null : { x: xFor(i), y: yFor(p.currentValue) }
    );
    const previousCoords = trend.points.map((p, i) =>
      p.previousValue === null ? null : { x: xFor(i), y: yFor(p.previousValue) }
    );
    const rollingCoords = trend.points.map((p, i) =>
      p.rollingAvg === null ? null : { x: xFor(i), y: yFor(p.rollingAvg) }
    );

    const isIsolatedCurrent = currentCoords.map((pt, i) => {
      if (!pt) return false;
      const prevEmpty = i === 0 || currentCoords[i - 1] === null;
      const nextEmpty = i === currentCoords.length - 1 || currentCoords[i + 1] === null;
      return prevEmpty && nextEmpty;
    });

    const slotHalfW = n > 1 ? plotW / (n - 1) / 2 : plotW / 2;
    const missingZones = trend.points
      .map((p, i) => {
        if (p.currentValue !== null) return null;
        const cx = xFor(i);
        const x1 = Math.max(padL, cx - slotHalfW);
        const x2 = Math.min(padL + plotW, cx + slotHalfW);
        return { idx: i, x: x1, width: Math.max(4, x2 - x1), cx };
      })
      .filter((z): z is { idx: number; x: number; width: number; cx: number } => z !== null);

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      value: Math.round(yMax * t),
      y: yFor(yMax * t)
    }));

    const xLabelIndices = new Set<number>();
    if (n <= 8) {
      for (let i = 0; i < n; i++) xLabelIndices.add(i);
    } else if (n <= 15) {
      for (let i = 0; i < n; i += 2) xLabelIndices.add(i);
      xLabelIndices.add(n - 1);
    } else {
      const step = Math.ceil(n / 6);
      for (let i = 0; i < n; i += step) xLabelIndices.add(i);
      xLabelIndices.add(n - 1);
    }

    const hasRollingCurve = rollingCoords.filter(Boolean).length >= 2;
    const hasAnnotations = trend.points.some((p) => Boolean(p.annotation));

    return {
      W,
      H,
      padL,
      padR,
      padT,
      plotW,
      plotH,
      baselineY,
      yMax,
      yTicks,
      xFor,
      yFor,
      xLabelIndices,
      currentCoords,
      previousCoords,
      rollingCoords,
      hasRollingCurve,
      hasAnnotations,
      isIsolatedCurrent,
      missingZones,
      currentLinePath: buildSmoothPath(currentCoords, padT, baselineY),
      currentAreaPath: buildAreaPath(currentCoords, padT, baselineY),
      previousLinePath: buildSmoothPath(previousCoords, padT, baselineY),
      rollingLinePath: buildSmoothPath(rollingCoords, padT, baselineY),
      targetY: trend.targetValue !== null ? yFor(trend.targetValue) : null,
      todayX: xFor(trend.todayIndex)
    };
  }, [trend, showComparison, showRollingAvg]);

  const activeIdx = hoverIdx !== null && hoverIdx < trend.points.length ? hoverIdx : null;
  const activePoint = activeIdx !== null ? trend.points[activeIdx] : null;
  const activeCoord = activeIdx !== null ? chart.currentCoords[activeIdx] : null;
  const activePrevCoord = activeIdx !== null ? chart.previousCoords[activeIdx] : null;

  const deltaDisplay = (() => {
    if (trend.deltaPercent === null) return null;
    const sign = trend.deltaPercent > 0 ? '+' : '';
    const suffix = trend.isPercentage ? (isAr ? ' نقطة' : ' pts') : '%';
    return `${sign}${trend.deltaPercent}${suffix}`;
  })();

  const targetLabel = isAr ? trend.targetLabelAr : trend.targetLabelEn;
  const activeBreakdown = activePoint
    ? isAr
      ? activePoint.breakdownAr
      : activePoint.breakdownEn
    : undefined;
  const activeAnnotationLabel = activePoint?.annotation
    ? isAr
      ? activePoint.annotation.labelAr
      : activePoint.annotation.labelEn
    : undefined;

  return (
    <section
      className="dash-glass p-4 sm:p-5 lg:p-6 relative overflow-hidden flex flex-col justify-between h-full"
      aria-label={isAr ? 'اتجاه الأداء الحياتي' : 'Life Performance Trend'}
    >
      {/* Top Header Row: Title + Overlay Toggles + Time Range */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--brand-strong)]">
            <span>{isAr ? 'محور التحليل الرئيسي' : 'PRIMARY TERMINAL'}</span>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="text-[var(--text-secondary)]">
              {trend.isPercentage
                ? isAr
                  ? 'معدل الالتزام'
                  : 'COMPLIANCE RATE'
                : isAr
                ? 'الإنتاجية الفعلية'
                : 'ACTUAL OUTPUT'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5 m-0">
            {isAr ? 'اتجاه الأداء الحياتي' : 'Life Performance Trend'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRollingAvg((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showRollingAvg
                ? 'border-[color-mix(in_srgb,var(--state-purple)_45%,transparent)] bg-[color-mix(in_srgb,var(--state-purple)_12%,transparent)] text-[var(--state-purple)]'
                : 'border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-current inline-block rounded" aria-hidden="true" />
            <span>{isAr ? 'المتوسط المتحرك' : 'Rolling MA'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComparison((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showComparison
                ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)]'
                : 'border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span
              className="w-2.5 h-0.5 inline-block border-t border-dashed border-current"
              aria-hidden="true"
            />
            <span>{isAr ? 'الفترة السابقة' : 'vs Prior'}</span>
          </button>

          <div
            className="inline-flex items-center p-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-deep)]"
            role="group"
            aria-label={isAr ? 'الفترة الزمنية' : 'Time range'}
          >
            {RANGE_OPTIONS.map((r) => {
              const active = range === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setHoverIdx(null);
                    onRangeChange(r.id);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--brand)] text-[var(--text-on-accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metric Selector Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar">
        {METRIC_OPTIONS.map((opt) => {
          const active = metric === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setHoverIdx(null);
                onMetricChange(opt.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${
                active
                  ? 'border-[var(--brand-soft-border)] bg-[var(--surface-active)] text-[var(--brand)] font-semibold'
                  : 'border-transparent bg-[var(--surface-faint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
              }`}
            >
              {isAr ? opt.labelAr : opt.labelEn}
            </button>
          );
        })}
      </div>

      {/* Hairline-Divided Summary Readout Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-[var(--border-subtle)] divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-[var(--border-subtle)] mb-3.5 py-2.5">
        <div className="px-2 sm:px-3 py-1">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {trend.isPercentage
              ? isAr
                ? 'معدل الفترة الحالية'
                : 'Current Rate'
              : isAr
              ? 'إجمالي الفترة'
              : 'Period Total'}
          </div>
          <div
            className={`text-lg sm:text-xl font-mono font-bold tabular-nums mt-0.5 ${
              trend.currentTotalOrAvg === null ? 'text-[var(--text-tertiary)] text-sm' : 'text-[var(--text-primary)]'
            }`}
          >
            {formatVal(trend.currentTotalOrAvg)}
          </div>
        </div>

        <div className="px-2 sm:px-3 py-1">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {isAr ? 'الفترة السابقة' : 'Prior Period'}
          </div>
          <div
            className={`font-mono font-bold tabular-nums mt-0.5 ${
              trend.hasComparisonData
                ? 'text-lg sm:text-xl text-[var(--text-secondary)]'
                : 'text-sm text-[var(--text-tertiary)]'
            }`}
          >
            {trend.hasComparisonData ? formatVal(trend.previousTotalOrAvg) : noDataShort}
          </div>
        </div>

        <div className="px-2 sm:px-3 py-1">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {isAr ? 'صافي التغير' : 'Delta'}
          </div>
          <div
            className={`text-lg sm:text-xl font-mono font-bold tabular-nums mt-0.5 ${
              deltaDisplay === null
                ? 'text-[var(--text-tertiary)]'
                : (trend.deltaPercent || 0) > 0
                ? 'text-[var(--state-success-strong)]'
                : (trend.deltaPercent || 0) < 0
                ? 'text-[var(--state-warning)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {deltaDisplay ?? '—'}
          </div>
        </div>

        <div className="px-2 sm:px-3 py-1">
          <div className="text-[11px] text-[var(--text-secondary)]">
            {isAr ? 'الهدف المرجعي' : 'Target Line'}
          </div>
          <div className="text-sm font-mono font-semibold tabular-nums text-[var(--text-primary)] mt-1 truncate">
            {targetLabel ?? (isAr ? 'غير محدد' : 'Not set')}
          </div>
        </div>
      </div>

      {/* Sparse / Single-Point Data Notice */}
      {trend.hasAnyData && trend.recordedBucketsCount === 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-faint)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
          <span>
            {isAr
              ? 'نقطة بيانات مسجلة واحدة ضمن النافذة — يبدأ رسم المنحنى عند تسجيل فترتين فأكثر.'
              : '1 recorded period in window — trend line connects once 2+ periods have logged data; empty periods remain open gaps.'}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
            {isAr
              ? `${trend.recordedBucketsCount} مسجلة · ${trend.missingBucketsCount} بلا سجلات`
              : `${trend.recordedBucketsCount} recorded · ${trend.missingBucketsCount} unrecorded`}
          </span>
        </div>
      )}

      {/* Main Chart Canvas */}
      {!trend.hasAnyData ? (
        <div className="dash-glass-inset p-8 text-center flex flex-col items-center justify-center min-h-[250px] flex-1">
          <div className="w-11 h-11 rounded-2xl bg-[var(--brand-soft)] border border-[var(--brand-soft-border)] text-[var(--brand-strong)] grid place-items-center mb-3">
            <NuqtaIcon name="chart" className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr
              ? 'لا توجد بيانات مسجلة كافية لهذا المقياس في هذه الفترة'
              : 'No recorded data for this metric in the selected window'}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md leading-relaxed">
            {isAr
              ? 'يعتمد هذا الرسم على سجلاتك الفعلية فقط دون تقدير أو تحويل الفترات الفارغة إلى صفر.'
              : 'Strictly reflects stored activity without inventing defaults or converting unrecorded periods to zero.'}
          </div>
          <button
            type="button"
            onClick={() => onOpenRelevantView(metric)}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--brand)] text-[var(--text-on-accent)] hover:opacity-95 transition-opacity"
          >
            {isAr ? 'فتح القسم المرتبط' : 'Open Related Workspace'}
          </button>
        </div>
      ) : (
        <div className="relative select-none flex-1 flex flex-col justify-between" dir="ltr">
          <svg
            viewBox={`0 0 ${chart.W} ${chart.H}`}
            className="w-full h-[265px] sm:h-[305px] overflow-visible"
            role="img"
            aria-label={isAr ? 'منحنى الأداء الحياتي التفاعلي' : 'Interactive life performance trend chart'}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={`area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-strong)" stopOpacity="0.28" />
                <stop offset="85%" stopColor="var(--brand-strong)" stopOpacity="0.02" />
                <stop offset="100%" stopColor="var(--brand-strong)" stopOpacity="0" />
              </linearGradient>
              <pattern
                id={gapPatternId}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="var(--text-tertiary)"
                  strokeWidth="1"
                  strokeOpacity="0.16"
                />
              </pattern>
            </defs>

            {/* Missing-Data Period Gap Bands */}
            {chart.missingZones.map((zone) => (
              <g key={`gap-${zone.idx}`}>
                <rect
                  x={zone.x}
                  y={chart.padT}
                  width={zone.width}
                  height={chart.plotH}
                  fill={`url(#${gapPatternId})`}
                  opacity="0.7"
                />
                <line
                  x1={zone.x + 1}
                  x2={zone.x + zone.width - 1}
                  y1={chart.baselineY}
                  y2={chart.baselineY}
                  stroke="var(--text-tertiary)"
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                  strokeOpacity="0.45"
                />
              </g>
            ))}

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {chart.yTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={chart.padL}
                  x2={chart.W - chart.padR}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--border-subtle)"
                  strokeDasharray={idx === 0 ? undefined : '3 5'}
                  strokeOpacity={idx === 0 ? 0.75 : 0.6}
                />
                <text
                  x={chart.padL - 8}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  fill="var(--text-tertiary)"
                  fontSize="10.5"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {trend.isPercentage ? `${tick.value}%` : tick.value}
                </text>
              </g>
            ))}

            {/* Target Reference Line */}
            {chart.targetY !== null && trend.targetValue !== null && (
              <g>
                <line
                  x1={chart.padL}
                  x2={chart.W - chart.padR}
                  y1={chart.targetY}
                  y2={chart.targetY}
                  stroke="var(--state-warning)"
                  strokeWidth="1.5"
                  strokeDasharray="6 5"
                  strokeOpacity="0.85"
                />
                <rect
                  x={chart.W - chart.padR - 110}
                  y={Math.max(4, chart.targetY - 21)}
                  width="110"
                  height="17"
                  rx="4"
                  fill="var(--surface-deep)"
                  stroke="var(--state-warning)"
                  strokeOpacity="0.45"
                />
                <text
                  x={chart.W - chart.padR - 55}
                  y={Math.max(15.5, chart.targetY - 9.5)}
                  textAnchor="middle"
                  fill="var(--state-warning-strong)"
                  fontSize="9.5"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {isAr ? `الهدف ${trend.targetValue}` : `Target ${trend.targetValue}`}
                </text>
              </g>
            )}

            {/* Today Vertical Marker */}
            <g>
              <line
                x1={chart.todayX}
                x2={chart.todayX}
                y1={chart.padT - 8}
                y2={chart.baselineY}
                stroke="var(--brand-soft-border)"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
              <rect
                x={Math.min(chart.W - chart.padR - 46, Math.max(chart.padL, chart.todayX - 23))}
                y={4}
                width="46"
                height="16"
                rx="4"
                fill="var(--surface-active)"
                stroke="var(--brand-soft-border)"
              />
              <text
                x={Math.min(chart.W - chart.padR - 23, Math.max(chart.padL + 23, chart.todayX))}
                y={15}
                textAnchor="middle"
                fill="var(--brand)"
                fontSize="9.5"
                fontWeight="700"
              >
                {isAr ? 'اليوم' : 'Today'}
              </text>
            </g>

            {/* Previous Period Dashed Line */}
            {showComparison && trend.hasComparisonData && chart.previousLinePath && (
              <path
                d={chart.previousLinePath}
                fill="none"
                stroke="var(--blue)"
                strokeWidth="1.65"
                strokeDasharray="4 4"
                strokeOpacity="0.65"
                strokeLinecap="round"
              />
            )}

            {/* Rolling Moving Average Curve */}
            {showRollingAvg && chart.hasRollingCurve && chart.rollingLinePath && (
              <path
                d={chart.rollingLinePath}
                fill="none"
                stroke="var(--state-purple)"
                strokeWidth="1.75"
                strokeOpacity="0.88"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Current Period Area & Line */}
            {chart.currentAreaPath && (
              <path d={chart.currentAreaPath} fill={`url(#area-${gradId})`} />
            )}
            {chart.currentLinePath && (
              <path
                d={chart.currentLinePath}
                fill="none"
                stroke="var(--brand-strong)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Isolated Recorded Points, Current Series & Event Annotations */}
            {chart.currentCoords.map((pt, idx) => {
              if (!pt) return null;
              const point = trend.points[idx];
              const isToday = idx === trend.todayIndex;
              const isolated = chart.isIsolatedCurrent[idx];
              const ann = point.annotation;

              const showBaseDot =
                trend.points.length <= 16 || isToday || isolated || idx === activeIdx;

              return (
                <g key={idx}>
                  {isolated && pt.y < chart.baselineY && (
                    <line
                      x1={pt.x}
                      x2={pt.x}
                      y1={pt.y}
                      y2={chart.baselineY}
                      stroke="var(--brand-strong)"
                      strokeWidth="1.5"
                      strokeDasharray="2 3"
                      strokeOpacity="0.55"
                    />
                  )}
                  {showBaseDot && !ann && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={idx === activeIdx ? 5.5 : isToday || isolated ? 4.5 : 3}
                      fill={isToday || isolated ? 'var(--brand)' : 'var(--surface-raised)'}
                      stroke="var(--brand-strong)"
                      strokeWidth={idx === activeIdx ? 2.5 : 2}
                    />
                  )}
                  {ann && (
                    <g>
                      <line
                        x1={pt.x}
                        x2={pt.x}
                        y1={Math.max(chart.padT, pt.y - 18)}
                        y2={pt.y}
                        stroke={ann.kind === 'milestone' ? 'var(--state-warning)' : 'var(--brand-strong)'}
                        strokeWidth="1"
                        strokeOpacity="0.7"
                      />
                      {ann.kind === 'milestone' ? (
                        <polygon
                          points={`${pt.x},${pt.y - 6} ${pt.x + 6},${pt.y} ${pt.x},${pt.y + 6} ${pt.x - 6},${pt.y}`}
                          fill="var(--state-warning)"
                          stroke="var(--surface-raised)"
                          strokeWidth="1.5"
                        />
                      ) : (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={5}
                          fill="var(--brand)"
                          stroke="var(--surface-raised)"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Active Hover Crosshair & Highlight Dot */}
            {activeIdx !== null && (
              <g>
                <line
                  x1={chart.xFor(activeIdx)}
                  x2={chart.xFor(activeIdx)}
                  y1={chart.padT}
                  y2={chart.baselineY}
                  stroke="var(--text-tertiary)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                {showComparison && activePrevCoord && (
                  <circle
                    cx={activePrevCoord.x}
                    cy={activePrevCoord.y}
                    r="4"
                    fill="var(--surface-raised)"
                    stroke="var(--blue)"
                    strokeWidth="2"
                  />
                )}
                {activeCoord && (
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="6"
                    fill="var(--brand)"
                    stroke="var(--surface-raised)"
                    strokeWidth="2.5"
                  />
                )}
              </g>
            )}

            {/* X-Axis Labels */}
            {trend.points.map((pt, idx) => {
              if (!chart.xLabelIndices.has(idx)) return null;
              return (
                <text
                  key={pt.key}
                  x={chart.xFor(idx)}
                  y={chart.H - 8}
                  textAnchor={idx === 0 ? 'start' : idx === trend.points.length - 1 ? 'end' : 'middle'}
                  fill={pt.isToday ? 'var(--brand)' : 'var(--text-tertiary)'}
                  fontWeight={pt.isToday ? '700' : '500'}
                  fontSize="10.5"
                >
                  {pt.label}
                </text>
              );
            })}

            {/* Invisible Hover Hit Columns */}
            {trend.points.map((pt, idx) => {
              const colW = chart.plotW / Math.max(1, trend.points.length);
              const x = chart.xFor(idx) - colW / 2;
              return (
                <rect
                  key={pt.key}
                  x={Math.max(chart.padL - 8, x)}
                  y={chart.padT - 8}
                  width={Math.max(12, colW)}
                  height={chart.plotH + 16}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onFocus={() => setHoverIdx(idx)}
                  tabIndex={0}
                  aria-label={`${pt.fullDateLabel}: ${
                    pt.currentValue === null ? noDataLabel : formatVal(pt.currentValue)
                  }`}
                />
              );
            })}
          </svg>

          {/* Detailed Floating Tooltip */}
          {activePoint && activeIdx !== null && (
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              className="pointer-events-none absolute top-2 z-20 min-w-[220px] max-w-[300px] rounded-xl border border-[var(--glass-border-strong)] bg-[var(--glass-bg-strong)] px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md"
              style={{
                left: `${Math.min(66, Math.max(4, (activeIdx / Math.max(1, trend.points.length - 1)) * 72))}%`
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-1.5 mb-1.5">
                <span className="font-semibold text-[var(--text-primary)]">{activePoint.fullDateLabel}</span>
                {activePoint.isToday && (
                  <span className="text-[10px] font-mono text-[var(--brand)]">
                    {isAr ? 'اليوم' : 'Today'}
                  </span>
                )}
              </div>
              <div className="space-y-1 font-mono tabular-nums">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--text-secondary)] font-sans flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full inline-block ${
                        activePoint.currentValue === null
                          ? 'border border-dashed border-[var(--text-tertiary)]'
                          : 'bg-[var(--brand-strong)]'
                      }`}
                    />
                    {isAr ? 'الحالي' : 'Current'}
                  </span>
                  <span
                    className={
                      activePoint.currentValue === null
                        ? 'font-sans italic text-[11px] text-[var(--text-tertiary)]'
                        : 'font-bold text-[var(--text-primary)]'
                    }
                  >
                    {activePoint.currentValue === null ? noDataLabel : formatVal(activePoint.currentValue)}
                  </span>
                </div>

                {showRollingAvg && activePoint.rollingAvg !== null && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-secondary)] font-sans flex items-center gap-1.5">
                      <span className="w-2 h-0.5 bg-[var(--state-purple)] inline-block" />
                      {isAr ? 'المتوسط المتحرك' : 'Rolling MA'}
                    </span>
                    <span className="text-[var(--state-purple)]">
                      {formatVal(activePoint.rollingAvg)}
                    </span>
                  </div>
                )}

                {activeBreakdown && (
                  <div className="font-sans text-[10.5px] leading-snug text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-1 mt-1">
                    {activeBreakdown}
                  </div>
                )}

                {showComparison && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-secondary)] font-sans flex items-center gap-1.5">
                      <span className="w-2 h-0.5 bg-[var(--blue)] inline-block" />
                      {isAr ? 'السابق' : 'Previous'}
                    </span>
                    <span
                      className={
                        activePoint.previousValue === null
                          ? 'font-sans italic text-[11px] text-[var(--text-tertiary)]'
                          : 'text-[var(--text-secondary)]'
                      }
                    >
                      {activePoint.previousValue === null ? noDataShort : formatVal(activePoint.previousValue)}
                    </span>
                  </div>
                )}

                {trend.targetValue !== null && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-secondary)] font-sans flex items-center gap-1.5">
                      <span className="w-2 h-0.5 bg-[var(--state-warning)] inline-block" />
                      {isAr ? 'الهدف' : 'Target'}
                    </span>
                    <span className="text-[var(--state-warning-strong)]">
                      {formatVal(trend.targetValue)}
                    </span>
                  </div>
                )}

                {activeAnnotationLabel && (
                  <div className="font-sans text-[10.5px] font-medium text-[var(--state-warning-strong)] border-t border-[var(--border-subtle)] pt-1 mt-1">
                    ◆ {activeAnnotationLabel}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Legend */}
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            className="mt-2 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]"
          >
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--brand-strong)] inline-block rounded" />
                <span>{isAr ? 'الفترة الحالية' : 'Current'}</span>
              </span>
              {showRollingAvg && chart.hasRollingCurve && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[var(--state-purple)] inline-block rounded" />
                  <span>{isAr ? 'المتوسط المتحرك' : 'Rolling MA'}</span>
                </span>
              )}
              {showComparison && trend.hasComparisonData && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-[var(--blue)] inline-block" />
                  <span>{isAr ? 'الفترة السابقة' : 'Prior'}</span>
                </span>
              )}
              {trend.targetValue !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-[var(--state-warning)] inline-block" />
                  <span>{isAr ? 'الهدف' : 'Target'}</span>
                </span>
              )}
              {chart.hasAnnotations && (
                <span className="inline-flex items-center gap-1 text-[var(--state-warning-strong)]">
                  <span>◆</span>
                  <span className="text-[var(--text-secondary)]">
                    {isAr ? 'معالم / ذروة' : 'Events / Peak'}
                  </span>
                </span>
              )}
              {trend.missingBucketsCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-[2px] border border-dashed border-[var(--text-tertiary)]/50 bg-[var(--surface-faint)] inline-block" />
                  <span>{isAr ? 'فترة بلا سجلات (ليست صفراً)' : 'No data (not 0)'}</span>
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
              {isAr ? 'مرّر على أي نقطة للتفصيل الدقيق' : 'Hover for period breakdown'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
