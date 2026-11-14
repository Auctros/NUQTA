import React, { useId } from 'react';
import { DashboardKPIs } from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface KpiTerminalStripProps {
  kpis: DashboardKPIs;
  isAr: boolean;
}

const SparkBarlets: React.FC<{ values: Array<number | null>; color: string }> = ({ values, color }) => {
  const w = 112;
  const h = 28;
  const nonNull = values.filter((v): v is number => v !== null);
  const maxVal = nonNull.length > 0 ? Math.max(1, ...nonNull) : 1;
  const step = w / Math.max(1, values.length);
  const barW = Math.max(6, step - 4);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[112px] h-7 shrink-0 overflow-visible" aria-hidden="true">
      {values.map((v, i) => {
        const x = i * step + (step - barW) / 2;
        if (v === null) {
          return (
            <line
              key={i}
              x1={x + 1}
              x2={x + barW - 1}
              y1={h - 2}
              y2={h - 2}
              stroke="var(--text-tertiary)"
              strokeWidth="1.2"
              strokeDasharray="2 2"
              strokeOpacity="0.45"
            />
          );
        }
        const barH = v === 0 ? 2 : Math.max(4, Math.round((v / maxVal) * (h - 4)));
        const isLast = i === values.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={h - barH}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
            fillOpacity={v === 0 ? 0.35 : isLast ? 0.95 : 0.55}
          />
        );
      })}
    </svg>
  );
};

const SparkLine: React.FC<{
  values: Array<number | null>;
  color: string;
  withArea?: boolean;
  maxFixed?: number;
}> = ({ values, color, withArea = false, maxFixed }) => {
  const uid = useId().replace(/:/g, '');
  const w = 112;
  const h = 28;
  const padY = 3;
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-[112px] h-7 shrink-0" aria-hidden="true">
        <line
          x1="2"
          x2={w - 2}
          y1={h - 3}
          y2={h - 3}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const maxVal = maxFixed ?? Math.max(1, ...nonNull);
  const n = values.length;
  const coords = values.map((v, i) => {
    if (v === null) return null;
    const x = n === 1 ? w / 2 : 3 + (i / (n - 1)) * (w - 6);
    const y = h - padY - (Math.min(maxVal, Math.max(0, v)) / maxVal) * (h - padY * 2);
    return { x, y };
  });

  const segments: Array<Array<{ x: number; y: number }>> = [];
  let cur: Array<{ x: number; y: number }> = [];
  for (const c of coords) {
    if (c) cur.push(c);
    else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[112px] h-7 shrink-0 overflow-visible" aria-hidden="true">
      {withArea && (
        <defs>
          <linearGradient id={`spk-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <line
        x1="2"
        x2={w - 2}
        y1={h - 2}
        y2={h - 2}
        stroke="var(--border-subtle)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {segments.map((seg, sIdx) => {
        if (seg.length === 1) {
          return <circle key={sIdx} cx={seg[0].x} cy={seg[0].y} r="2.5" fill={color} />;
        }
        const dLine = seg
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        const dArea = `${dLine} L ${seg[seg.length - 1].x.toFixed(1)} ${h - 2} L ${seg[0].x.toFixed(1)} ${h - 2} Z`;
        return (
          <g key={sIdx}>
            {withArea && <path d={dArea} fill={`url(#spk-${uid})`} />}
            <path
              d={dLine}
              fill="none"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={seg[seg.length - 1].x} cy={seg[seg.length - 1].y} r="2.3" fill={color} />
          </g>
        );
      })}
    </svg>
  );
};

export const KpiTerminalStrip: React.FC<KpiTerminalStripProps> = ({ kpis, isAr }) => {
  return (
    <section
      className="dash-glass overflow-hidden"
      aria-label={isAr ? 'مؤشرات الأداء الرئيسية' : 'Key Performance Indicators'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-[var(--border-subtle)]">
        {/* 1. Performance (Tasks) */}
        <div className="px-4 py-3.5 sm:px-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <NuqtaIcon name="check-square" className="w-3.5 h-3.5 text-[var(--brand-strong)] shrink-0" />
              <span>{isAr ? 'الأداء التنفيذي' : 'Performance'}</span>
            </div>
            {kpis.performance.deltaPts !== null && (
              <span
                className={`text-[11px] font-mono tabular-nums font-semibold ${
                  kpis.performance.deltaPts >= 0
                    ? 'text-[var(--state-success-strong)]'
                    : 'text-[var(--state-warning)]'
                }`}
              >
                {kpis.performance.deltaPts >= 0
                  ? `+${kpis.performance.deltaPts}`
                  : kpis.performance.deltaPts}{' '}
                {isAr ? 'نقطة' : 'pts'}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl sm:text-[26px] font-mono font-bold tabular-nums leading-none text-[var(--text-primary)]">
                {kpis.performance.rate7d !== null ? `${kpis.performance.rate7d}%` : '—'}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate font-mono tabular-nums">
                {kpis.performance.hasData
                  ? isAr
                    ? `اليوم ${kpis.performance.todayDone}/${kpis.performance.todayScheduled} · 7ي ${kpis.performance.completed7d}`
                    : `Today ${kpis.performance.todayDone}/${kpis.performance.todayScheduled} · 7D ${kpis.performance.completed7d}`
                  : isAr
                  ? 'لا توجد مهام بعد'
                  : 'No tasks logged'}
              </div>
            </div>

            <SparkBarlets values={kpis.performance.spark7d} color="var(--brand-strong)" />
          </div>
        </div>

        {/* 2. Consistency (Habits) */}
        <div className="px-4 py-3.5 sm:px-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <NuqtaIcon name="repeat" className="w-3.5 h-3.5 text-[var(--blue)] shrink-0" />
              <span>{isAr ? 'الالتزام والاستمرارية' : 'Consistency'}</span>
            </div>
            {kpis.consistency.deltaPts !== null && (
              <span
                className={`text-[11px] font-mono tabular-nums font-semibold ${
                  kpis.consistency.deltaPts >= 0
                    ? 'text-[var(--state-success-strong)]'
                    : 'text-[var(--state-warning)]'
                }`}
              >
                {kpis.consistency.deltaPts >= 0
                  ? `+${kpis.consistency.deltaPts}`
                  : kpis.consistency.deltaPts}{' '}
                {isAr ? 'نقطة' : 'pts'}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl sm:text-[26px] font-mono font-bold tabular-nums leading-none text-[var(--text-primary)]">
                {kpis.consistency.rate7d !== null ? `${kpis.consistency.rate7d}%` : '—'}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate font-mono tabular-nums">
                {kpis.consistency.hasData
                  ? isAr
                    ? `اليوم ${kpis.consistency.todayDone}/${kpis.consistency.todayDue} · سلسلة ${kpis.consistency.bestStreak}ي`
                    : `Today ${kpis.consistency.todayDone}/${kpis.consistency.todayDue} · ${kpis.consistency.bestStreak}d best`
                  : isAr
                  ? 'لا توجد عادات بعد'
                  : 'No habits tracked'}
              </div>
            </div>

            <SparkLine values={kpis.consistency.spark7d} color="var(--blue)" maxFixed={100} />
          </div>
        </div>

        {/* 3. Goal Progress (Outcome vs Execution) */}
        <div className="px-4 py-3.5 sm:px-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <NuqtaIcon name="target" className="w-3.5 h-3.5 text-[var(--d-reading-accent)] shrink-0" />
              <span>{isAr ? 'تقدم الأهداف' : 'Goal Progress'}</span>
            </div>
            {kpis.goalProgress.hasData && kpis.goalProgress.avgExecutionPercent !== null && (
              <span className="text-[11px] font-mono tabular-nums text-[var(--blue)]">
                {isAr
                  ? `تنفيذ ${kpis.goalProgress.avgExecutionPercent}%`
                  : `Exec ${kpis.goalProgress.avgExecutionPercent}%`}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl sm:text-[26px] font-mono font-bold tabular-nums leading-none text-[var(--text-primary)]">
                {kpis.goalProgress.avgOutcomePercent !== null
                  ? `${kpis.goalProgress.avgOutcomePercent}%`
                  : '—'}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate font-mono tabular-nums">
                {kpis.goalProgress.hasData
                  ? isAr
                    ? `${kpis.goalProgress.activeGoalsCount} أهداف · ${kpis.goalProgress.milestonesDone}/${kpis.goalProgress.milestonesTotal} معالم`
                    : `${kpis.goalProgress.activeGoalsCount} active · ${kpis.goalProgress.milestonesDone}/${kpis.goalProgress.milestonesTotal} milestones`
                  : isAr
                  ? 'لا توجد أهداف نشطة'
                  : 'No active goals'}
              </div>
            </div>

            {/* Dual Outcome vs Execution Mini Bullet */}
            <div className="w-[106px] shrink-0 space-y-1.5 pb-0.5" aria-hidden="true">
              <div className="relative h-2.5 rounded-[3px] bg-[var(--surface-track)] overflow-visible">
                <div
                  className="h-full rounded-[3px] bg-[var(--d-reading-accent)] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, kpis.goalProgress.avgOutcomePercent || 0))}%` }}
                />
                {kpis.goalProgress.avgExecutionPercent !== null && (
                  <div
                    className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-[var(--blue)]"
                    style={{
                      insetInlineStart: `${Math.min(98, Math.max(0, kpis.goalProgress.avgExecutionPercent))}%`
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-[9.5px] font-mono text-[var(--text-tertiary)]">
                <span>{isAr ? 'نتيجة' : 'Out'}</span>
                <span>{isAr ? 'تنفيذ' : 'Exec'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Momentum (Active Minutes & Recovery) */}
        <div className="px-4 py-3.5 sm:px-5 flex flex-col justify-between gap-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <NuqtaIcon name="flame" className="w-3.5 h-3.5 text-[var(--d-drawing-accent)] shrink-0" />
              <span>{isAr ? 'الزخم والنشاط' : 'Momentum'}</span>
            </div>
            {kpis.momentum.deltaPct !== null && (
              <span
                className={`text-[11px] font-mono tabular-nums font-semibold ${
                  kpis.momentum.deltaPct >= 0
                    ? 'text-[var(--state-success-strong)]'
                    : 'text-[var(--state-warning)]'
                }`}
              >
                {kpis.momentum.deltaPct >= 0
                  ? `+${kpis.momentum.deltaPct}%`
                  : `${kpis.momentum.deltaPct}%`}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl sm:text-[26px] font-mono font-bold tabular-nums leading-none text-[var(--text-primary)]">
                {kpis.momentum.hasData ? `${kpis.momentum.minutes7d}m` : '—'}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate font-mono tabular-nums">
                {kpis.momentum.hasData
                  ? isAr
                    ? `اليوم ${kpis.momentum.todayActiveMinutes}د · تركيز ${kpis.momentum.focusMinutesToday}د`
                    : `Today ${kpis.momentum.todayActiveMinutes}m · Focus ${kpis.momentum.focusMinutesToday}m`
                  : isAr
                  ? 'سجّل جلسة تركيز أو نشاطاً'
                  : 'Log timed work to track'}
              </div>
            </div>

            <SparkLine values={kpis.momentum.spark7d} color="var(--d-drawing-accent)" withArea />
          </div>
        </div>
      </div>
    </section>
  );
};
