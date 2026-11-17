import React, { useState } from 'react';
import { NuqtaIcon } from '../NuqtaIcon';

/**
 * Chart primitives for the Insights center.
 *
 * These are deliberately decoupled from the Dashboard charts: Insights plots a
 * bucketed timeline (daily/weekly/monthly) with a "missing vs zero" distinction,
 * so a bucket with no record renders as a gap rather than a zero-height bar that
 * would read as a real decline.
 */

export interface ChartPoint {
  key: string;
  label: string;
  fullLabel: string;
  value: number | null;
  /** True when the bucket contains no record at all. */
  missing: boolean;
}

// ==========================================
// 1. Trend line / area chart
// ==========================================
interface TrendChartProps {
  points: ChartPoint[];
  color: string;
  unit: string;
  isAr: boolean;
  height?: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({ points, color, unit, isAr, height = 160 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const recorded = points.filter((p) => p.value !== null);
  if (recorded.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--border-default)] rounded-xl">
        {isAr ? 'لا توجد قياسات كافية لرسم منحنى في هذه الفترة.' : 'Not enough recorded points to draw a trend.'}
      </div>
    );
  }

  const width = 640;
  const padX = 34;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const max = Math.max(1, ...recorded.map((p) => p.value as number));
  const n = points.length;

  const xOf = (i: number) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (v: number) => height - padY - (v / max) * innerH;

  // Break the line across missing buckets instead of drawing a false segment.
  // Each run of consecutive recorded points becomes one filled area + one stroke.
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push({ i, v: p.value });
  });
  if (run.length) runs.push(run);

  const strokeOf = (r: { i: number; v: number }[]) =>
    r.map((pt, k) => `${k === 0 ? 'M' : 'L'} ${xOf(pt.i)} ${yOf(pt.v)}`).join(' ');
  const areaOf = (r: { i: number; v: number }[]) => {
    const base = height - padY;
    return `${strokeOf(r)} L ${xOf(r[r.length - 1].i)} ${base} L ${xOf(r[0].i)} ${base} Z`;
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={padY + t * innerH}
              y2={padY + t * innerH}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
          ))}
          {runs.map((r, i) => (
            <path key={`f${i}`} d={areaOf(r)} fill={color} opacity={0.12} />
          ))}
          {runs.map((r, i) => (
            <path
              key={`s${i}`}
              d={strokeOf(r)}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {points.map((p, i) =>
            p.value === null ? null : (
              <circle
                key={p.key}
                cx={xOf(i)}
                cy={yOf(p.value)}
                r={hover === i ? 4.5 : 2.6}
                fill={color}
                stroke="var(--surface-raised)"
                strokeWidth={1.4}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          )}
        </svg>
        {hover !== null && points[hover].value !== null && (
          <div
            className="absolute -top-1 px-2 py-1 rounded bg-[var(--surface-chip)] border border-[var(--border-strong)] shadow-lg text-[10px] font-mono text-[var(--text-primary)] whitespace-nowrap pointer-events-none"
            style={{
              left: `${(hover / Math.max(1, n - 1)) * 100}%`,
              transform: isAr ? 'translateX(20%)' : 'translateX(-50%)'
            }}
          >
            <strong style={{ color }}>{points[hover].value}</strong> {unit} · {points[hover].fullLabel}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted font-mono px-2">
        {points.map((p, i) => (
          <span key={p.key} className={i % Math.ceil(n / 8) === 0 || i === n - 1 ? '' : 'opacity-0'}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 2. Bucketed bar series (proportional, marks gaps)
// ==========================================
interface BarSeriesProps {
  points: ChartPoint[];
  color: string;
  unit: string;
  isAr: boolean;
}

export const BarSeries: React.FC<BarSeriesProps> = ({ points, color, unit, isAr }) => {
  const [hover, setHover] = useState<number | null>(null);
  const recorded = points.filter((p) => p.value !== null && p.value > 0);
  if (recorded.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--border-default)] rounded-xl">
        {isAr ? 'لا توجد بيانات في هذه الفترة.' : 'No data in this range.'}
      </div>
    );
  }
  const max = Math.max(...recorded.map((p) => p.value as number));

  return (
    <div className="h-40 flex items-end gap-1 sm:gap-2 pt-4 px-1 bg-[var(--surface-deep)] rounded-xl border border-[var(--border-subtle)]">
      {points.map((p, i) => {
        const val = p.value;
        const h = val && val > 0 ? Math.max(6, Math.round((val / max) * 84)) : 0;
        return (
          <div
            key={p.key}
            className="flex-1 flex flex-col items-center justify-end h-full relative group"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="absolute -top-9 z-20 px-2 py-1 rounded bg-[var(--surface-chip)] border border-[var(--border-strong)] shadow-lg text-[10px] font-mono whitespace-nowrap pointer-events-none">
                {val === null ? (
                  <span className="text-muted">{isAr ? 'لا سجل' : 'no record'}</span>
                ) : (
                  <>
                    <strong style={{ color }}>{val}</strong> {unit} · {p.fullLabel}
                  </>
                )}
              </div>
            )}
            <span className="text-[9px] font-mono text-muted mb-1 opacity-70 group-hover:opacity-100">
              {val && val > 0 ? val : ''}
            </span>
            {p.missing ? (
              <div
                className="w-full max-w-[26px] rounded-t-md border border-dashed border-[var(--border-strong)]"
                style={{ height: '10%' }}
                title={isAr ? 'لا سجل لهذا اليوم' : 'no record'}
              />
            ) : (
              <div
                className="w-full max-w-[26px] rounded-t-md transition-all duration-300"
                style={{ height: `${h}%`, backgroundColor: hover === i ? 'var(--text-primary)' : color }}
              />
            )}
            <span className="text-[9px] text-muted font-mono mt-1 truncate w-full text-center">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 3. Horizontal magnitude bars (categories)
// ==========================================
interface HorizontalBarsProps {
  rows: { key: string; label: string; value: number; percent: number; color?: string }[];
  unit: string;
  isAr: boolean;
  emptyLabel?: string;
}

export const HorizontalBars: React.FC<HorizontalBarsProps> = ({ rows, unit, isAr, emptyLabel }) => {
  if (rows.length === 0) {
    return (
      <div className="p-5 text-center text-xs text-muted border border-dashed border-[var(--border-default)] rounded-xl">
        {emptyLabel ?? (isAr ? 'لا توجد بيانات.' : 'No data.')}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">{r.label}</span>
            <span className="font-mono text-[var(--text-primary)]">
              {r.value} <span className="text-muted">{unit}</span>
              <span className="text-muted"> · {r.percent}%</span>
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--surface-chip)] overflow-hidden border border-[var(--border-default)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(r.percent, r.value > 0 ? 4 : 0)}%`, backgroundColor: r.color ?? 'var(--brand)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 4. Dual bar chart (income vs expense by month)
// ==========================================
interface DualBarsProps {
  points: { key: string; label: string; a: number; b: number }[];
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
  isAr: boolean;
}

export const DualBars: React.FC<DualBarsProps> = ({ points, colorA, colorB, labelA, labelB, isAr }) => {
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorA }} /> {labelA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorB }} /> {labelB}
        </span>
      </div>
      <div className="h-40 flex items-end gap-3 pt-3 px-1 bg-[var(--surface-deep)] rounded-xl border border-[var(--border-subtle)]">
        {points.map((p) => (
          <div key={p.key} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="flex items-end gap-1 h-full w-full justify-center">
              <div
                className="w-3 sm:w-4 rounded-t-sm transition-all duration-300"
                style={{ height: `${Math.max(3, (p.a / max) * 88)}%`, backgroundColor: colorA }}
                title={`${labelA}: ${p.a}`}
              />
              <div
                className="w-3 sm:w-4 rounded-t-sm transition-all duration-300"
                style={{ height: `${Math.max(3, (p.b / max) * 88)}%`, backgroundColor: colorB }}
                title={`${labelB}: ${p.b}`}
              />
            </div>
            <span className="text-[9px] text-muted font-mono mt-1">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 5. Weekday rhythm strip (Sat..Fri)
// ==========================================
interface WeekdayStripProps {
  days: { dow: number; label: string; rate: number | null; dueCount: number }[];
  isAr: boolean;
}

export const WeekdayStrip: React.FC<WeekdayStripProps> = ({ days, isAr }) => {
  const colorFor = (rate: number | null) => {
    if (rate === null) return 'var(--surface-chip)';
    if (rate >= 80) return 'var(--tone-success)';
    if (rate >= 50) return 'var(--tone-warning)';
    return 'var(--tone-danger)';
  };
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => (
        <div key={d.dow} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted font-mono">{d.label}</span>
          <div
            className="w-full h-12 rounded-md border border-[var(--border-default)] flex items-end justify-center overflow-hidden relative"
            style={{ backgroundColor: 'var(--surface-inset)' }}
            title={
              d.rate === null
                ? isAr
                  ? 'لا عادات مستحقة'
                  : 'no habits due'
                : `${d.rate}% (${d.dueCount} ${isAr ? 'مستحق' : 'due'})`
            }
          >
            <div
              className="w-full transition-all duration-300"
              style={{ height: d.rate === null ? '0%' : `${d.rate}%`, backgroundColor: colorFor(d.rate) }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[var(--text-primary)]">
              {d.rate === null ? '—' : `${d.rate}%`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 6. Shared metric card
// ==========================================
interface MetricCardProps {
  icon: Parameters<typeof NuqtaIcon>[0]['name'];
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  delta?: { percent: number | null; direction: 'up' | 'down' | 'flat' | 'none' } | null;
  accent?: string;
  isAr: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, unit, sub, delta, accent, isAr }) => {
  const renderDelta = () => {
    if (!delta || delta.direction === 'none' || delta.percent === null) return null;
    const up = delta.direction === 'up';
    const flat = delta.direction === 'flat';
    const tone = flat
      ? 'text-muted bg-[var(--surface-chip)] border-[var(--border-default)]'
      : up
      ? 'text-[var(--tone-success)] bg-[var(--tone-success-wash)] border-[var(--tone-success-line)]'
      : 'text-[var(--tone-danger)] bg-[var(--tone-danger-wash)] border-[var(--tone-danger-line)]';
    return (
      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${tone}`}>
        {!flat && <NuqtaIcon name={up ? 'trending-up' : 'trending-down'} className="w-3 h-3" />}
        <span>{flat ? (isAr ? 'مستقر' : 'flat') : `${Math.abs(delta.percent)}%`}</span>
      </span>
    );
  };

  return (
    <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted flex items-center gap-1.5 min-w-0">
          <NuqtaIcon name={icon} className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {renderDelta()}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <strong className="text-2xl font-mono font-bold" style={{ color: accent ?? 'var(--text-primary)' }}>
            {value}
          </strong>
          {unit && <span className="text-[11px] text-muted">{unit}</span>}
        </div>
        {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
};
