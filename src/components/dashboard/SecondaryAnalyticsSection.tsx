import React, { useState } from 'react';
import { NuqtaIcon } from '../NuqtaIcon';
import {
  ConsistencyBreakdownData,
  DailyCorrelationPoint,
  FocusScatterPoint,
  SecondaryAnalyticsResult
} from '../../lib/dashboardAnalytics';
import { CommitmentMap } from '../CommitmentMap';
import { CommitmentSources } from '../../lib/commitmentMap';

interface SecondaryAnalyticsSectionProps {
  data: SecondaryAnalyticsResult;
  breakdown: ConsistencyBreakdownData;
  /**
   * Raw records for the commitment map. The map reads the same stores the rest of the
   * dashboard reads, so it never becomes a second, drifting source of truth.
   */
  mapSources: CommitmentSources;
  isAr: boolean;
  onOpenInsights: () => void;
}

export const SecondaryAnalyticsSection: React.FC<SecondaryAnalyticsSectionProps> = ({
  data,
  breakdown,
  mapSources,
  isAr,
  onOpenInsights
}) => {
  const [scatterMode, setScatterMode] = useState<'daily' | 'focus'>('daily');
  const [hoveredDailyPt, setHoveredDailyPt] = useState<DailyCorrelationPoint | null>(null);
  const [hoveredFocusPt, setHoveredFocusPt] = useState<FocusScatterPoint | null>(null);

  // Heatmap rows run top-to-bottom in NUQTA week order: Sat, Sun, Mon, Tue, Wed, Thu, Fri.
  const dayNames = isAr
    ? ['سب', 'أح', 'إث', 'ثل', 'أر', 'خم', 'جم']
    : ['S', 'S', 'M', 'T', 'W', 'T', 'F'];

  const completionsDeltaPct =
    data.priorCompletions30 > 0
      ? Math.round(((data.completions30 - data.priorCompletions30) / data.priorCompletions30) * 100)
      : null;

  // Scatter plot geometry
  const SW = 400;
  const SH = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = SW - padL - padR;
  const plotH = SH - padT - padB;

  const dailyPts = breakdown.dailyScatter;
  const maxDailyMins = Math.max(
    30,
    ...dailyPts.map((p) => p.activeMinutes)
  );
  const dailyX = (mins: number) => padL + (Math.min(maxDailyMins, mins) / maxDailyMins) * plotW;
  const dailyY = (rate: number) => padT + plotH - (Math.min(100, Math.max(0, rate)) / 100) * plotH;

  // Least-squares trend line for daily correlation when >= 4 points & pearsonR non-null
  const dailyTrendLine = (() => {
    if (dailyPts.length < 4 || breakdown.pearsonR === null) return null;
    const n = dailyPts.length;
    const meanX = dailyPts.reduce((s, p) => s + p.activeMinutes, 0) / n;
    const meanY = dailyPts.reduce((s, p) => s + p.completionRate, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of dailyPts) {
      num += (p.activeMinutes - meanX) * (p.completionRate - meanY);
      den += (p.activeMinutes - meanX) ** 2;
    }
    if (den <= 0) return null;
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    const y0 = Math.min(100, Math.max(0, intercept));
    const y1 = Math.min(100, Math.max(0, slope * maxDailyMins + intercept));
    return { x1: dailyX(0), y1: dailyY(y0), x2: dailyX(maxDailyMins), y2: dailyY(y1) };
  })();

  const focusPts = breakdown.focusScatter;
  const maxFocusMins = Math.max(45, ...focusPts.map((p) => p.durationMinutes));
  const focusX = (mins: number) => padL + (Math.min(maxFocusMins, mins) / maxFocusMins) * plotW;
  const focusY = (score: number) => padT + plotH - ((Math.min(5, Math.max(1, score)) - 1) / 4) * plotH;

  const hasAnyWeekdayData = breakdown.weekdays.some(
    (w) => w.adherenceRate !== null || w.avgActiveMinutes !== null
  );

  return (
    <section
      className="grid grid-cols-1 xl:grid-cols-12 gap-4"
      aria-label={isAr ? 'التحليلات السلوكية والارتباط' : 'Consistency Cadence & Correlation'}
    >
      {/* Left (7 cols): 14-Week Schedule-Aware Heatmap + Weekday Rhythm Column Strip */}
      <div className="xl:col-span-7 dash-glass p-4 sm:p-5 flex flex-col justify-between gap-4">
        {/* Top Row: Heatmap Header & Quick Stats */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3.5">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                {isAr ? 'خريطة الالتزام · 14 أسبوعاً' : 'CONSISTENCY HEATMAP · 14 WEEKS'}
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5 m-0">
                {isAr ? 'سجل الاستمرارية والإيقاع الأسبوعي' : 'Daily Cadence & Weekday Rhythm'}
              </h3>
            </div>

            <div className="flex items-center gap-3 font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
              <span>
                {isAr ? 'نشط 30ي:' : '30D:'}{' '}
                <span className="text-[var(--text-primary)] font-semibold">
                  {data.hasData ? `${data.activeDaysLast30}/30` : '—'}
                </span>
              </span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span>
                {isAr ? 'السلسلة:' : 'Streak:'}{' '}
                <span className="text-[var(--brand-strong)] font-semibold">
                  {data.hasData ? `${data.currentActiveStreak}d` : '—'}
                </span>
              </span>
              {completionsDeltaPct !== null && (
                <>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span
                    className={
                      completionsDeltaPct >= 0
                        ? 'text-[var(--state-success-strong)]'
                        : 'text-[var(--state-warning)]'
                    }
                  >
                    {completionsDeltaPct >= 0 ? `+${completionsDeltaPct}%` : `${completionsDeltaPct}%`}
                  </span>
                </>
              )}
            </div>
          </div>

          <CommitmentMap sources={mapSources} isAr={isAr} variant="compact" />
        </div>

        {/* Hairline-Separated Weekday Rhythm Column Bars */}
        <div className="pt-3.5 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {isAr ? 'إيقاع أيام الأسبوع (الالتزام % مقابل متوسط الدقائق)' : 'WEEKDAY RHYTHM (ADHERENCE % · AVG MIN)'}
            </span>
            <span className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
              {data.avgActiveMinutes30 !== null
                ? isAr
                  ? `متوسط نشط ${data.avgActiveMinutes30}د`
                  : `Avg ${data.avgActiveMinutes30}m/day`
                : '—'}
            </span>
          </div>

          {!hasAnyWeekdayData ? (
            <div className="text-[11px] text-[var(--text-tertiary)] py-3 text-center">
              {isAr ? 'لا توجد بيانات كافية بعد لحساب الإيقاع الأسبوعي.' : 'Log habits or timed sessions to surface weekday rhythm.'}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2 items-end" dir="ltr">
              {breakdown.weekdays.map((wd) => {
                const pct = wd.adherenceRate;
                const mins = wd.avgActiveMinutes;
                return (
                  <div
                    key={wd.dow}
                    className="flex flex-col items-center gap-1 text-center"
                    title={`${isAr ? wd.labelAr : wd.labelEn}: ${
                      pct !== null ? `${pct}% (${wd.doneCount}/${wd.dueCount})` : '—'
                    } · ${mins !== null ? `${mins}m` : '—'}`}
                  >
                    <div className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
                      {pct !== null ? `${pct}%` : '—'}
                    </div>
                    <div className="w-full max-w-[26px] h-14 rounded-[4px] bg-[var(--surface-track)] relative overflow-hidden flex items-end">
                      {pct !== null && (
                        <div
                          className="w-full rounded-t-[3px] transition-all"
                          style={{
                            height: `${Math.max(6, pct)}%`,
                            backgroundColor:
                              pct >= 75
                                ? 'var(--brand-strong)'
                                : pct >= 45
                                ? 'var(--blue)'
                                : 'var(--state-warning)'
                          }}
                        />
                      )}
                    </div>
                    <div className="text-[10.5px] font-medium text-[var(--text-primary)]">
                      {isAr ? wd.labelAr : wd.labelEn}
                    </div>
                    <div className="text-[9.5px] font-mono tabular-nums text-[var(--text-tertiary)]">
                      {mins !== null ? `${mins}m` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right (5 cols): Interactive Correlation Scatter / Bubble Plot */}
      <div className="xl:col-span-5 dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {isAr ? 'مخطط التشتت والارتباط' : 'CORRELATION SCATTER'}
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5 m-0 truncate">
              {scatterMode === 'daily'
                ? isAr
                  ? 'الوقت النشط مقابل نسبة التنفيذ'
                  : 'Active Time vs Execution Rate'
                : isAr
                ? 'مدة جلسة التركيز مقابل الجودة'
                : 'Focus Duration vs Quality Score'}
            </h3>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-deep)] shrink-0">
            <button
              type="button"
              onClick={() => {
                setHoveredFocusPt(null);
                setScatterMode('daily');
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                scatterMode === 'daily'
                  ? 'bg-[var(--brand)] text-[var(--text-on-accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'الإيقاع اليومي' : 'Daily'}
            </button>
            <button
              type="button"
              onClick={() => {
                setHoveredDailyPt(null);
                setScatterMode('focus');
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                scatterMode === 'focus'
                  ? 'bg-[var(--brand)] text-[var(--text-on-accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'جلسات التركيز' : 'Focus'}
            </button>
          </div>
        </div>

        {/* Correlation / Inspect Sub-strip */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums min-h-[20px]">
          {scatterMode === 'daily' ? (
            hoveredDailyPt ? (
              <span className="text-[var(--text-primary)] truncate">
                {hoveredDailyPt.dateKey} · {hoveredDailyPt.activeMinutes}m · {hoveredDailyPt.completionRate}% ({hoveredDailyPt.activitiesCount}{' '}
                {isAr ? 'نشاط' : 'items'})
              </span>
            ) : (
              <>
                <span className="text-[var(--text-secondary)]">
                  {dailyPts.length}{' '}
                  {isAr ? 'أيام مقاسة (آخر 30ي)' : 'paired days (30D)'}
                </span>
                <span
                  className={
                    breakdown.pearsonR !== null
                      ? breakdown.pearsonR >= 0.3
                        ? 'text-[var(--state-success-strong)] font-semibold'
                        : breakdown.pearsonR <= -0.3
                        ? 'text-[var(--state-warning)] font-semibold'
                        : 'text-[var(--text-secondary)]'
                      : 'text-[var(--text-tertiary)]'
                  }
                >
                  {breakdown.pearsonR !== null
                    ? `Pearson r = ${breakdown.pearsonR.toFixed(2)}`
                    : isAr
                    ? 'يلزم 4+ أيام للارتباط'
                    : 'r needs 4+ paired days'}
                </span>
              </>
            )
          ) : hoveredFocusPt ? (
            <span className="text-[var(--text-primary)] truncate">
              {hoveredFocusPt.title} · {hoveredFocusPt.durationMinutes}m · {hoveredFocusPt.productivityScore}/5 ·{' '}
              {hoveredFocusPt.interruptions} {isAr ? 'مشتت' : 'int'}
            </span>
          ) : (
            <span className="text-[var(--text-secondary)]">
              {focusPts.length} {isAr ? 'جلسات مسجلة (الحجم = قلة التشتت)' : 'sessions (bubble size = low distractions)'}
            </span>
          )}
        </div>

        {/* SVG Plot */}
        {scatterMode === 'daily' ? (
          dailyPts.length < 3 ? (
            <div className="dash-glass-inset p-6 text-center flex-1 flex flex-col items-center justify-center min-h-[190px]">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {isAr ? 'بيانات غير كافية بعد لرسم الارتباط' : 'Insufficient paired days for scatter plot'}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-xs">
                {isAr
                  ? 'يتطلب هذا المخطط 3 أيام على الأقل تتزامن فيها دقائق مسجلة مع مهام أو عادات مجدولة.'
                  : 'Requires at least 3 days with logged minutes alongside scheduled habits or tasks.'}
              </div>
              <button
                type="button"
                onClick={onOpenInsights}
                className="mt-3 text-[11px] font-medium text-[var(--brand-strong)] hover:underline"
              >
                {isAr ? 'فتح صفحة الرؤى' : 'Open Insights'}
                <NuqtaIcon name="arrow" className="w-3 h-3 inline-block" />
              </button>
            </div>
          ) : (
            <div className="relative" dir="ltr">
              <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full h-[200px] overflow-visible">
                {[0, 50, 100].map((v) => (
                  <g key={v}>
                    <line
                      x1={padL}
                      x2={SW - padR}
                      y1={dailyY(v)}
                      y2={dailyY(v)}
                      stroke="var(--border-subtle)"
                      strokeDasharray={v === 0 ? undefined : '3 4'}
                      strokeOpacity="0.65"
                    />
                    <text
                      x={padL - 6}
                      y={dailyY(v) + 3.5}
                      textAnchor="end"
                      fill="var(--text-tertiary)"
                      fontSize="9.5"
                      fontFamily="ui-monospace, monospace"
                    >
                      {v}%
                    </text>
                  </g>
                ))}
                <line
                  x1={padL}
                  x2={padL}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="var(--border-subtle)"
                  strokeOpacity="0.7"
                />

                {dailyTrendLine && (
                  <line
                    x1={dailyTrendLine.x1}
                    y1={dailyTrendLine.y1}
                    x2={dailyTrendLine.x2}
                    y2={dailyTrendLine.y2}
                    stroke="var(--state-purple)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeOpacity="0.75"
                  />
                )}

                {dailyPts.map((pt) => {
                  const cx = dailyX(pt.activeMinutes);
                  const cy = dailyY(pt.completionRate);
                  const r = Math.min(9, 3.5 + Math.sqrt(pt.activitiesCount) * 1.1);
                  const isHov = hoveredDailyPt?.dateKey === pt.dateKey;
                  return (
                    <circle
                      key={pt.dateKey}
                      cx={cx}
                      cy={cy}
                      r={isHov ? r + 2 : r}
                      fill="var(--brand-strong)"
                      fillOpacity={isHov ? 0.95 : 0.62}
                      stroke="var(--brand)"
                      strokeWidth={isHov ? 2 : 1.2}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredDailyPt(pt)}
                      onMouseLeave={() => setHoveredDailyPt(null)}
                    />
                  );
                })}

                <text x={padL} y={SH - 6} fill="var(--text-tertiary)" fontSize="9.5" fontFamily="ui-monospace, monospace">
                  0m
                </text>
                <text
                  x={(padL + SW - padR) / 2}
                  y={SH - 6}
                  textAnchor="middle"
                  fill="var(--text-tertiary)"
                  fontSize="9.5"
                >
                  {isAr ? 'الدقائق النشطة يومياً' : 'Daily Active Minutes'}
                </text>
                <text
                  x={SW - padR}
                  y={SH - 6}
                  textAnchor="end"
                  fill="var(--text-tertiary)"
                  fontSize="9.5"
                  fontFamily="ui-monospace, monospace"
                >
                  {maxDailyMins}m
                </text>
              </svg>
            </div>
          )
        ) : focusPts.length < 2 ? (
          <div className="dash-glass-inset p-6 text-center flex-1 flex flex-col items-center justify-center min-h-[190px]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {isAr ? 'تحتاج جلستي تركيز على الأقل' : 'Needs at least 2 logged focus sessions'}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              {isAr ? 'سجّل جلسات تركيز لمقارنة المدة بالجودة.' : 'Log focus sessions to inspect duration vs productivity score.'}
            </div>
          </div>
        ) : (
          <div className="relative" dir="ltr">
            <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full h-[200px] overflow-visible">
              {[1, 3, 5].map((s) => (
                <g key={s}>
                  <line
                    x1={padL}
                    x2={SW - padR}
                    y1={focusY(s)}
                    y2={focusY(s)}
                    stroke="var(--border-subtle)"
                    strokeDasharray={s === 1 ? undefined : '3 4'}
                    strokeOpacity="0.65"
                  />
                  <text
                    x={padL - 6}
                    y={focusY(s) + 3.5}
                    textAnchor="end"
                    fill="var(--text-tertiary)"
                    fontSize="9.5"
                    fontFamily="ui-monospace, monospace"
                  >
                    {s}/5
                  </text>
                </g>
              ))}
              {focusPts.map((pt) => {
                const cx = focusX(pt.durationMinutes);
                const cy = focusY(pt.productivityScore);
                const r = Math.max(4, Math.min(9.5, 9 - pt.interruptions * 1.4));
                const isHov = hoveredFocusPt?.id === pt.id;
                return (
                  <circle
                    key={pt.id}
                    cx={cx}
                    cy={cy}
                    r={isHov ? r + 2 : r}
                    fill="var(--blue)"
                    fillOpacity={isHov ? 0.95 : 0.58}
                    stroke="var(--blue)"
                    strokeWidth={isHov ? 2 : 1.2}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredFocusPt(pt)}
                    onMouseLeave={() => setHoveredFocusPt(null)}
                  />
                );
              })}
              <text x={padL} y={SH - 6} fill="var(--text-tertiary)" fontSize="9.5" fontFamily="ui-monospace, monospace">
                0m
              </text>
              <text x={(padL + SW - padR) / 2} y={SH - 6} textAnchor="middle" fill="var(--text-tertiary)" fontSize="9.5">
                {isAr ? 'مدة الجلسة' : 'Session Duration'}
              </text>
              <text x={SW - padR} y={SH - 6} textAnchor="end" fill="var(--text-tertiary)" fontSize="9.5" fontFamily="ui-monospace, monospace">
                {maxFocusMins}m
              </text>
            </svg>
          </div>
        )}

        <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span className="truncate">
            {isAr ? 'مبني حصرياً على السجلات الفعلية' : 'Computed strictly from stored logs'}
          </span>
          <button
            type="button"
            onClick={onOpenInsights}
            className="text-xs font-medium text-[var(--brand-strong)] hover:underline whitespace-nowrap shrink-0"
          >
            {isAr ? 'كل الرؤى' : 'Deep Insights'}
          <NuqtaIcon name="arrow" className="w-3 h-3 inline-block" />
          </button>
        </div>
      </div>
    </section>
  );
};
