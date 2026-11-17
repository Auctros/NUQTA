import React, { useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { InsightsInput, InsightsRange, computeInsightsReport } from '../lib/insightsEngine';
import { NuqtaIcon, IconName } from './NuqtaIcon';
import {
  BarSeries,
  ChartPoint,
  DualBars,
  HorizontalBars,
  MetricCard,
  TrendChart,
  WeekdayStrip
} from './charts/InsightsCharts';

/**
 * Insights — NUQTA's analytics center.
 *
 * The Dashboard answers "what needs my attention now?"; Insights answers "how is
 * my life progressing over time, and what do the patterns in my data reveal?".
 * Everything here is derived from real records by `insightsEngine`; empty domains
 * say so explicitly instead of rendering a zero.
 */

type SectionId = 'overview' | 'execution' | 'habits' | 'goals' | 'time' | 'learning' | 'finance' | 'patterns';

const RANGES: { id: InsightsRange; en: string; ar: string }[] = [
  { id: 'week', en: 'This week', ar: 'هذا الأسبوع' },
  { id: '30d', en: '30 days', ar: '30 يوماً' },
  { id: '90d', en: '90 days', ar: '90 يوماً' },
  { id: 'year', en: '12 months', ar: '12 شهراً' },
  { id: 'all', en: 'All-time', ar: 'المدى الشامل' }
];

type TrendMetric = 'activeMinutes' | 'tasks' | 'habitRate' | 'focusMinutes' | 'readingPages' | 'workoutReps' | 'quranAyahs';

const TREND_METRICS: { id: TrendMetric; en: string; ar: string; unitEn: string; unitAr: string; color: string }[] = [
  { id: 'activeMinutes', en: 'Invested time', ar: 'الوقت المستثمر', unitEn: 'min', unitAr: 'دقيقة', color: 'var(--tone-success)' },
  { id: 'tasks', en: 'Tasks done', ar: 'المهام المنجزة', unitEn: 'tasks', unitAr: 'مهمة', color: 'var(--tone-info)' },
  { id: 'habitRate', en: 'Habit adherence', ar: 'انتظام العادات', unitEn: '%', unitAr: '%', color: 'var(--brand)' },
  { id: 'focusMinutes', en: 'Focus minutes', ar: 'دقائق التركيز', unitEn: 'min', unitAr: 'دقيقة', color: 'var(--tone-info)' },
  { id: 'readingPages', en: 'Pages read', ar: 'صفحات القراءة', unitEn: 'pages', unitAr: 'صفحة', color: 'var(--tone-warning)' },
  { id: 'workoutReps', en: 'Workout reps', ar: 'تكرارات التمارين', unitEn: 'reps', unitAr: 'تكرار', color: 'var(--tone-success)' },
  { id: 'quranAyahs', en: 'Quran ayahs', ar: 'آيات القرآن', unitEn: 'ayahs', unitAr: 'آية', color: 'var(--tone-info)' }
];

export const InsightsView: React.FC = () => {
  const {
    tasks,
    habits,
    goals,
    focusSessions,
    healthMetrics,
    expenses,
    savingsGoals,
    journalEntries,
    profile,
    setActiveNavTab,
    setSundayRitualOpen
  } = useNuqtaStore();
  const isAr = profile.language === 'ar';

  const [range, setRange] = useState<InsightsRange>('30d');
  const [section, setSection] = useState<SectionId>('overview');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('activeMinutes');

  const input: InsightsInput = useMemo(
    () => ({ tasks, habits, goals, focusSessions, healthMetrics, expenses, savingsGoals, journalEntries }),
    [tasks, habits, goals, focusSessions, healthMetrics, expenses, savingsGoals, journalEntries]
  );

  const report = useMemo(() => computeInsightsReport(range, input, isAr), [range, input, isAr]);
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const metricMeta = TREND_METRICS.find((m) => m.id === trendMetric)!;

  const metricValueOf = (p: (typeof report.timeline)[number]): number | null => {
    switch (trendMetric) {
      case 'tasks':
        return p.tasksCompleted > 0 || p.tasksScheduled > 0 ? p.tasksCompleted : null;
      case 'activeMinutes':
        return p.activeMinutes > 0 ? p.activeMinutes : p.recordedDays === 0 ? null : 0;
      case 'habitRate':
        return p.habitDue > 0 ? Math.round((p.habitDone / p.habitDue) * 100) : null;
      case 'focusMinutes':
        return p.focusMinutes > 0 ? p.focusMinutes : p.recordedDays === 0 ? null : 0;
      case 'readingPages':
        return p.readingPages > 0 ? p.readingPages : p.recordedDays === 0 ? null : 0;
      case 'workoutReps':
        return p.workoutReps > 0 ? p.workoutReps : p.recordedDays === 0 ? null : 0;
      case 'quranAyahs':
        return p.quranAyahs > 0 ? p.quranAyahs : p.recordedDays === 0 ? null : 0;
    }
  };

  const trendPoints: ChartPoint[] = report.timeline.map((p) => ({
    key: p.key,
    label: p.label,
    fullLabel: p.fullLabel,
    value: metricValueOf(p),
    missing: p.recordedDays === 0
  }));

  const sections: { id: SectionId; en: string; ar: string; icon: IconName }[] = [
    { id: 'overview', en: 'Overview', ar: 'النظرة الشاملة', icon: 'chart' },
    { id: 'execution', en: 'Execution', ar: 'الالتزام بالمهام', icon: 'check' },
    { id: 'habits', en: 'Habits', ar: 'العادات', icon: 'repeat' },
    { id: 'goals', en: 'Goals', ar: 'الأهداف', icon: 'target' },
    { id: 'time', en: 'Focus & Body', ar: 'التركيز والجسد', icon: 'timer' },
    { id: 'learning', en: 'Learning & Faith', ar: 'التعلم والإيمان', icon: 'book-open' },
    { id: 'finance', en: 'Finance', ar: 'المال', icon: 'wallet' },
    { id: 'patterns', en: 'Patterns', ar: 'الأنماط', icon: 'activity' }
  ];

  const measuredDash = (m: { hasData: boolean; value: number | null }, unit: string) =>
    m.hasData && m.value !== null ? (
      <>
        {m.value} <span className="text-[11px] text-muted">{unit}</span>
      </>
    ) : (
      <span className="text-base text-muted">{t('no data', 'لا بيانات')}</span>
    );

  const investedTotal =
    (report.focus.totalMinutes.value ?? 0) +
    report.learning.totalMinutes +
    (report.body.totalMinutes.value ?? 0) +
    report.faith.totalMinutes;

  const weekdayDays = report.habits.weekdayRhythm.map((d) => ({
    dow: d.dow,
    label: isAr ? d.labelAr : d.labelEn,
    rate: d.rate,
    dueCount: d.dueCount
  }));

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>{t('NUQTA / ANALYTICS CENTER', 'نقطة / مركز التحليلات')}</span>
          </div>
          <h1>{t('Insights', 'الرؤى والأنماط')}</h1>
          <p>
            {t(
              'How your life is progressing over time — measured from real records, honest about what is missing.',
              'كيف تتقدّم حياتك عبر الزمن — مقاسة من سجلاتك الحقيقية، وصريحة بشأن ما هو ناقص.'
            )}
          </p>
        </div>
        <div className="heading-actions flex-wrap gap-2">
          <button onClick={() => setActiveNavTab('archive')} className="btn subtle flex items-center gap-1.5">
            <NuqtaIcon name="archive" className="w-4 h-4" />
            <span>{t('Archive & History', 'الذاكرة والأرشيف')}</span>
          </button>
          <button onClick={() => setSundayRitualOpen(true)} className="btn primary flex items-center gap-1.5">
            <NuqtaIcon name="sparkle" className="w-4 h-4" />
            <span>{t('Friday Weekly Review', 'طقس الجمعة الأسبوعي')}</span>
          </button>
        </div>
      </div>

      {/* Range selector + coverage strip */}
      <div className="panel p-3 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted font-medium">{t('Range:', 'النطاق:')}</span>
          <div className="flex flex-wrap p-0.5 rounded-lg bg-[var(--surface-deep)] border border-[var(--border-default)] text-xs">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                aria-pressed={range === r.id}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  range === r.id ? 'bg-[var(--surface-track)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? r.ar : r.en}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted">
          <span className="flex items-center gap-1.5">
            <NuqtaIcon name="calendar" className="w-3.5 h-3.5" />
            <span>{isAr ? report.rangeLabelAr : report.rangeLabelEn}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--tone-success)]" />
            {t(`${report.recordedDays} days recorded`, `${report.recordedDays} يوماً مسجّلاً`)}
          </span>
          {report.missingDays > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border border-dashed border-[var(--border-strong)]" />
              {t(`${report.missingDays} without records`, `${report.missingDays} بلا سجلات`)}
            </span>
          )}
          {report.hasComparison && (
            <span className="text-accent font-medium">{t('vs prior period', 'مقارنة بالفترة السابقة')}</span>
          )}
        </div>
      </div>

      {/* Empty window notice */}
      {report.isEmptyWindow && (
        <div className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex items-start gap-3">
          <NuqtaIcon name="alert" className="w-5 h-5 text-[var(--tone-warning)] shrink-0" />
          <div className="space-y-1">
            <strong className="text-sm text-[var(--text-primary)] block">
              {t('No records in this window', 'لا توجد سجلات في هذه الفترة')}
            </strong>
            <p className="text-xs text-muted">
              {t(
                'Insights reports what your data actually shows. Log tasks, habits, focus or studio sessions and the analytics will appear here — it will not invent numbers.',
                'تعرض الرؤى ما تُظهره بياناتك فعلياً. سجّل مهامك وعاداتك وجلسات التركيز أو الاستوديو وستظهر التحليلات هنا — ولن يتم اختلاق أي أرقام.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Section switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-default)] text-xs">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-pressed={section === s.id}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              section === s.id ? 'bg-[var(--surface-track)] text-accent font-bold shadow' : 'text-muted hover:text-[var(--text-primary)]'
            }`}
          >
            <NuqtaIcon name={s.icon} className="w-3.5 h-3.5" />
            <span>{isAr ? s.ar : s.en}</span>
          </button>
        ))}
      </div>

      {/* ===================================================== OVERVIEW */}
      {section === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon="check"
              label={t('Tasks completed', 'المهام المنجزة')}
              value={report.execution.completed.hasData ? report.execution.completed.value ?? 0 : '—'}
              delta={report.execution.delta}
              sub={
                report.execution.completionRate !== null
                  ? t(`${report.execution.completionRate}% of scheduled`, `${report.execution.completionRate}% من المجدولة`)
                  : t('no scheduled tasks', 'لا مهام مجدولة')
              }
              isAr={isAr}
            />
            <MetricCard
              icon="repeat"
              label={t('Habit adherence', 'انتظام العادات')}
              value={report.habits.adherenceRate !== null ? `${report.habits.adherenceRate}%` : '—'}
              delta={report.habits.delta}
              accent="var(--brand)"
              sub={t(`${report.habits.doneDays}/${report.habits.dueDays} due days`, `${report.habits.doneDays}/${report.habits.dueDays} يوم مستحق`)}
              isAr={isAr}
            />
            <MetricCard
              icon="timer"
              label={t('Focus time', 'وقت التركيز')}
              value={measuredDash(report.focus.totalMinutes, 'min')}
              delta={report.focus.delta}
              sub={report.focus.sessionsCount > 0 ? t(`${report.focus.sessionsCount} sessions`, `${report.focus.sessionsCount} جلسة`) : t('no sessions', 'لا جلسات')}
              isAr={isAr}
            />
            <MetricCard
              icon="dumbbell"
              label={t('Workout time', 'وقت التمارين')}
              value={measuredDash(report.body.totalMinutes, 'min')}
              delta={report.body.delta}
              accent="var(--tone-success)"
              sub={report.body.sessionsCount > 0 ? t(`${report.body.totalReps} reps`, `${report.body.totalReps} تكرار`) : t('no sessions', 'لا حصص')}
              isAr={isAr}
            />
          </div>

          {/* Trend chart */}
          <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <NuqtaIcon name="trending-up" className="w-4 h-4" />
                  <span>{t('Trend over time', 'الاتجاه عبر الزمن')}</span>
                </h3>
                <p className="text-xs text-muted">
                  {report.timelineGranularity === 'day'
                    ? t('Daily buckets', 'نطاقات يومية')
                    : report.timelineGranularity === 'week'
                    ? t('Weekly buckets (Sat–Fri weeks)', 'نطاقات أسبوعية (أسابيع السبت–الجمعة)')
                    : t('Monthly buckets', 'نطاقات شهرية')}
                  {' · '}
                  {t('gaps mean no record, not zero', 'الفراغات تعني غياب السجل لا الصفر')}
                </p>
              </div>
              <div className="flex flex-wrap p-0.5 rounded-lg bg-[var(--surface-deep)] border border-[var(--border-default)] text-xs">
                {TREND_METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setTrendMetric(m.id)}
                    aria-pressed={trendMetric === m.id}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      trendMetric === m.id ? 'bg-[var(--surface-track)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isAr ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart
              points={trendPoints}
              color={metricMeta.color}
              unit={isAr ? metricMeta.unitAr : metricMeta.unitEn}
              isAr={isAr}
            />
          </section>

          {/* Invested time by domain */}
          <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <NuqtaIcon name="scale" className="w-4 h-4" />
                <span>{t('Invested time by domain', 'الوقت المستثمر حسب المجال')}</span>
              </h3>
              <p className="text-xs text-muted">
                {t(
                  'Focus, reading, workouts and Quran study — each block is time, counted once.',
                  'التركيز والقراءة والتمارين ودراسة القرآن — كل جزء وقت مُحتسب مرة واحدة.'
                )}
              </p>
            </div>
            <HorizontalBars
              rows={[
                { key: 'focus', label: t('Focus', 'التركيز'), value: report.focus.totalMinutes.value ?? 0, percent: share(report.focus.totalMinutes.value, investedTotal), color: 'var(--tone-info)' },
                { key: 'read', label: t('Reading', 'القراءة'), value: report.learning.totalMinutes, percent: share(report.learning.totalMinutes, investedTotal), color: 'var(--tone-warning)' },
                { key: 'workout', label: t('Workouts', 'التمارين'), value: report.body.totalMinutes.value ?? 0, percent: share(report.body.totalMinutes.value, investedTotal), color: 'var(--tone-success)' },
                { key: 'quran', label: t('Quran', 'القرآن'), value: report.faith.totalMinutes, percent: share(report.faith.totalMinutes, investedTotal), color: 'var(--brand)' }
              ]}
              unit={isAr ? 'دقيقة' : 'min'}
              isAr={isAr}
              emptyLabel={t('No invested time recorded in this window.', 'لم يُسجَّل وقت مستثمر في هذه الفترة.')}
            />
          </section>

          {/* Section summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard
              title={t('Execution', 'الالتزام بالمهام')}
              icon="check"
              hasData={report.execution.hasData}
              onOpen={() => setSection('execution')}
              isAr={isAr}
              lines={[
                report.execution.completionRate !== null
                  ? t(`${report.execution.completionRate}% completion rate`, `معدل إنجاز ${report.execution.completionRate}%`)
                  : t('No scheduled tasks', 'لا مهام مجدولة'),
                t(`${report.execution.overdueCount} overdue`, `${report.execution.overdueCount} متأخرة`)
              ]}
            />
            <SummaryCard
              title={t('Habits', 'العادات')}
              icon="repeat"
              hasData={report.habits.hasData}
              onOpen={() => setSection('habits')}
              isAr={isAr}
              lines={[
                report.habits.adherenceRate !== null
                  ? t(`${report.habits.adherenceRate}% adherence`, `انتظام ${report.habits.adherenceRate}%`)
                  : t('No active habits', 'لا عادات نشطة'),
                t(`${report.habits.activeHabits} active`, `${report.habits.activeHabits} نشطة`)
              ]}
            />
            <SummaryCard
              title={t('Goals', 'الأهداف')}
              icon="target"
              hasData={report.goals.hasData}
              onOpen={() => setSection('goals')}
              isAr={isAr}
              lines={[
                report.goals.avgOutcomePercent !== null
                  ? t(`${report.goals.avgOutcomePercent}% avg progress`, `متوسط تقدّم ${report.goals.avgOutcomePercent}%`)
                  : t('No active goals', 'لا أهداف نشطة'),
                t(`${report.goals.activeCount} active`, `${report.goals.activeCount} نشطة`)
              ]}
            />
            <SummaryCard
              title={t('Learning', 'التعلم')}
              icon="book-open"
              hasData={report.learning.hasData}
              onOpen={() => setSection('learning')}
              isAr={isAr}
              lines={[
                report.learning.pagesRead.hasData
                  ? t(`${report.learning.pagesRead.value} pages`, `${report.learning.pagesRead.value} صفحة`)
                  : t('No reading logged', 'لا قراءة مسجّلة'),
                t(`${report.learning.booksFinishedInRange} books finished`, `${report.learning.booksFinishedInRange} كتاب منجز`)
              ]}
            />
            <SummaryCard
              title={t('Faith', 'الإيمان')}
              icon="mosque"
              hasData={report.faith.hasData}
              onOpen={() => setSection('learning')}
              isAr={isAr}
              lines={[
                report.faith.ayahsInRange.hasData
                  ? t(`${report.faith.ayahsInRange.value} ayahs`, `${report.faith.ayahsInRange.value} آية`)
                  : t('No Quran sessions', 'لا جلسات قرآن'),
                t(`${report.faith.distinctSurahs} surahs`, `${report.faith.distinctSurahs} سورة`)
              ]}
            />
            <SummaryCard
              title={t('Finance', 'المال')}
              icon="wallet"
              hasData={report.finance.hasData}
              onOpen={() => setSection('finance')}
              isAr={isAr}
              lines={[
                t(`net ${formatMoney(report.finance.net)}`, `الصافي ${formatMoney(report.finance.net)}`),
                t(`savings ${report.finance.savingsPercent ?? 0}%`, `الادخار ${report.finance.savingsPercent ?? 0}%`)
              ]}
            />
          </div>
        </div>
      )}

      {/* ===================================================== EXECUTION */}
      {section === 'execution' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard
              icon="check"
              label={t('Completed tasks', 'المهام المنجزة')}
              value={measuredDash(report.execution.completed, '')}
              delta={report.execution.delta}
              isAr={isAr}
            />
            <MetricCard
              icon="target"
              label={t('Completion rate', 'معدل الإنجاز')}
              value={report.execution.completionRate !== null ? `${report.execution.completionRate}%` : '—'}
              accent="var(--brand)"
              sub={
                report.execution.previousCompletionRate !== null
                  ? t(`prior: ${report.execution.previousCompletionRate}%`, `السابقة: ${report.execution.previousCompletionRate}%`)
                  : t('no prior period data', 'لا بيانات للفترة السابقة')
              }
              isAr={isAr}
            />
            <MetricCard
              icon="alert"
              label={t('Overdue now', 'متأخرة الآن')}
              value={report.execution.overdueCount}
              accent={report.execution.overdueCount > 0 ? 'var(--tone-danger)' : 'var(--tone-success)'}
              sub={t(`${report.execution.scheduledTotal} scheduled in range`, `${report.execution.scheduledTotal} مجدولة في النطاق`)}
              isAr={isAr}
            />
          </div>

          {report.execution.hasData ? (
            <>
              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Daily completions', 'الإنجاز اليومي')}</h3>
                <BarSeries
                  points={report.timeline.map((p) => ({
                    key: p.key,
                    label: p.label,
                    fullLabel: p.fullLabel,
                    value: p.tasksCompleted > 0 || p.tasksScheduled > 0 ? p.tasksCompleted : p.recordedDays === 0 ? null : 0,
                    missing: p.recordedDays === 0
                  }))}
                  color="var(--tone-info)"
                  unit={isAr ? 'مهمة' : 'tasks'}
                  isAr={isAr}
                />
              </section>

              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Overdue aging', 'تقدّم التأخير')}</h3>
                <HorizontalBars
                  rows={report.execution.overdueAging.map((a, i) => ({
                    key: `age-${i}`,
                    label: isAr ? a.labelAr : a.labelEn,
                    value: a.count,
                    percent: report.execution.overdueCount > 0 ? Math.round((a.count / report.execution.overdueCount) * 100) : 0,
                    color: 'var(--tone-danger)'
                  }))}
                  unit={isAr ? 'مهمة' : 'tasks'}
                  isAr={isAr}
                  emptyLabel={t('Nothing overdue.', 'لا شيء متأخر.')}
                />
              </section>
            </>
          ) : (
            <EmptySection isAr={isAr} />
          )}
        </div>
      )}

      {/* ===================================================== HABITS */}
      {section === 'habits' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard
              icon="repeat"
              label={t('Adherence', 'الانتظام')}
              value={report.habits.adherenceRate !== null ? `${report.habits.adherenceRate}%` : '—'}
              delta={report.habits.delta}
              accent="var(--brand)"
              sub={t(`${report.habits.doneDays}/${report.habits.dueDays} due days done`, `${report.habits.doneDays}/${report.habits.dueDays} يوم مستحق منجز`)}
              isAr={isAr}
            />
            <MetricCard
              icon="flame"
              label={t('Active streak', 'أطول سلسلة حالية')}
              value={report.habits.longestActiveStreak}
              unit={t('days', 'يوم')}
              accent="var(--tone-warning)"
              sub={t(`best ever: ${report.habits.bestEverStreak}`, `الأفضل سابقاً: ${report.habits.bestEverStreak}`)}
              isAr={isAr}
            />
            <MetricCard
              icon="alert"
              label={t('Missed due days', 'أيام مستحقة فائتة')}
              value={report.habits.missedDueDays}
              accent={report.habits.missedDueDays > 0 ? 'var(--tone-danger)' : 'var(--tone-success)'}
              sub={t(`${report.habits.activeHabits} active habits`, `${report.habits.activeHabits} عادة نشطة`)}
              isAr={isAr}
            />
          </div>

          {report.habits.hasData ? (
            <>
              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('Weekday rhythm (Sat → Fri)', 'إيقاع أيام الأسبوع (السبت → الجمعة)')}
                  </h3>
                  <p className="text-xs text-muted">
                    {t('Adherence on each day the habits were actually due.', 'الانتظام في كل يوم كانت فيه العادات مستحقة فعلاً.')}
                  </p>
                </div>
                <WeekdayStrip days={weekdayDays} isAr={isAr} />
              </section>

              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t('Adherence by time of day', 'الانتظام حسب وقت اليوم')}
                </h3>
                <HorizontalBars
                  rows={report.habits.timeOfDay
                    .filter((s) => s.dueCount > 0)
                    .map((s) => ({ key: s.slot, label: isAr ? s.labelAr : s.labelEn, value: s.rate ?? 0, percent: s.rate ?? 0, color: 'var(--brand)' }))}
                  unit="%"
                  isAr={isAr}
                  emptyLabel={t('No habits due in this window.', 'لا عادات مستحقة في هذه الفترة.')}
                />
              </section>
            </>
          ) : (
            <EmptySection isAr={isAr} />
          )}
        </div>
      )}

      {/* ===================================================== GOALS */}
      {section === 'goals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard
              icon="target"
              label={t('Active goals', 'الأهداف النشطة')}
              value={report.goals.activeCount}
              sub={t(`${report.goals.milestonesTotal} milestones total`, `${report.goals.milestonesTotal} مرحلة إجمالاً`)}
              isAr={isAr}
            />
            <MetricCard
              icon="rocket"
              label={t('Avg outcome progress', 'متوسط تقدّم النتائج')}
              value={report.goals.avgOutcomePercent !== null ? `${report.goals.avgOutcomePercent}%` : '—'}
              accent="var(--tone-success)"
              sub={t('from key results & milestones', 'من النتائج والمحطات')}
              isAr={isAr}
            />
            <MetricCard
              icon="activity"
              label={t('Avg execution progress', 'متوسط التقدّم التنفيذي')}
              value={report.goals.avgExecutionPercent !== null ? `${report.goals.avgExecutionPercent}%` : '—'}
              accent="var(--tone-info)"
              sub={t('from linked tasks & habits', 'من المهام والعادات المرتبطة')}
              isAr={isAr}
            />
          </div>

          {report.goals.hasData ? (
            <>
              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Pacing overview', 'نظرة على الوتيرة')}</h3>
                <HorizontalBars
                  rows={pacingRows(report.goals.pacing, isAr)}
                  unit={t('goals', 'هدف')}
                  isAr={isAr}
                  emptyLabel={t('No active goals.', 'لا أهداف نشطة.')}
                />
              </section>

              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Goal detail', 'تفاصيل الأهداف')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.goals.cards.map((g) => (
                    <div key={g.goalId} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent font-semibold">
                          {g.category}
                        </span>
                        <PacingChip status={g.pacingStatus} isAr={isAr} />
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] text-xs truncate">{g.title}</h4>
                      <div className="space-y-1.5">
                        <ProgressRow label={t('Outcome', 'النتيجة')} percent={g.outcomePercent} color="var(--tone-success)" />
                        <ProgressRow label={t('Execution', 'التنفيذ')} percent={g.executionPercent} color="var(--tone-info)" />
                      </div>
                      <div className="text-[11px] text-muted pt-1 border-t border-[var(--border-subtle)]">
                        {g.linkedActivityInRange > 0
                          ? t(`${g.linkedActivityInRange} linked activities in range`, `${g.linkedActivityInRange} نشاط مرتبط في الفترة`)
                          : t('no linked activity in range', 'لا نشاط مرتبط في الفترة')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <EmptySection isAr={isAr} />
          )}
        </div>
      )}

      {/* ===================================================== FOCUS & BODY */}
      {section === 'time' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon="timer"
              label={t('Focus sessions', 'جلسات التركيز')}
              value={report.focus.sessionsCount}
              sub={report.focus.avgSessionMinutes !== null ? t(`avg ${report.focus.avgSessionMinutes} min`, `متوسط ${report.focus.avgSessionMinutes} دقيقة`) : t('no data', 'لا بيانات')}
              isAr={isAr}
            />
            <MetricCard
              icon="activity"
              label={t('Avg productivity', 'متوسط الإنتاجية')}
              value={report.focus.avgProductivityScore !== null ? report.focus.avgProductivityScore : '—'}
              unit={t('/ 5', '/ 5')}
              accent="var(--tone-info)"
              isAr={isAr}
            />
            <MetricCard
              icon="dumbbell"
              label={t('Workout sessions', 'حصص التمارين')}
              value={report.body.sessionsCount}
              accent="var(--tone-success)"
              sub={report.body.weeklyTargetSessions > 0 ? t(`target ${report.body.weeklyTargetSessions}/week`, `الهدف ${report.body.weeklyTargetSessions}/أسبوع`) : t('no target set', 'لا هدف محدد')}
              isAr={isAr}
            />
            <MetricCard
              icon="flame"
              label={t('Total reps', 'إجمالي التكرارات')}
              value={report.body.totalReps}
              accent="var(--tone-warning)"
              sub={report.body.avgIntensity !== null ? t(`avg RPE ${report.body.avgIntensity}`, `متوسط الشدة ${report.body.avgIntensity}`) : t('no RPE logged', 'لا شدة مسجّلة')}
              isAr={isAr}
            />
          </div>

          {report.focus.hasData && (
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Focus minutes over time', 'دقائق التركيز عبر الزمن')}</h3>
              <BarSeries
                points={report.timeline.map((p) => ({
                  key: p.key,
                  label: p.label,
                  fullLabel: p.fullLabel,
                  value: p.focusMinutes > 0 ? p.focusMinutes : p.recordedDays === 0 ? null : 0,
                  missing: p.recordedDays === 0
                }))}
                color="var(--tone-info)"
                unit={isAr ? 'دقيقة' : 'min'}
                isAr={isAr}
              />
            </section>
          )}

          {report.body.hasData && (
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Movement balance', 'توازن أنماط الحركة')}</h3>
              <HorizontalBars
                rows={report.body.movementDistribution
                  .filter((m) => m.reps > 0)
                  .map((m) => ({ key: m.key, label: isAr ? m.labelAr : m.labelEn, value: m.reps, percent: m.percent, color: 'var(--brand)' }))}
                unit={t('reps', 'تكرار')}
                isAr={isAr}
                emptyLabel={t('No exercise breakdown recorded.', 'لم تُسجَّل تفاصيل التمارين.')}
              />
              <p className="text-[11px] text-muted pt-1 border-t border-[var(--border-subtle)]">
                {t(`Volume: ${report.body.totalVolumeKg} kg`, `الحجم: ${report.body.totalVolumeKg} كجم`)}
              </p>
            </section>
          )}

          {!report.focus.hasData && !report.body.hasData && <EmptySection isAr={isAr} />}
        </div>
      )}

      {/* ===================================================== LEARNING & FAITH */}
      {section === 'learning' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon="book-open"
              label={t('Pages read', 'صفحات القراءة')}
              value={measuredDash(report.learning.pagesRead, '')}
              delta={report.learning.delta}
              accent="var(--tone-warning)"
              isAr={isAr}
            />
            <MetricCard
              icon="clock"
              label={t('Reading minutes', 'دقائق القراءة')}
              value={report.learning.hasData ? report.learning.totalMinutes : '—'}
              sub={report.learning.avgSpeedPagesPerHour !== null ? t(`${report.learning.avgSpeedPagesPerHour} pages/hr`, `${report.learning.avgSpeedPagesPerHour} صفحة/ساعة`) : t('no speed data', 'لا بيانات سرعة')}
              isAr={isAr}
            />
            <MetricCard
              icon="mosque"
              label={t('Ayahs memorized/recited', 'آيات حُفظت/تُليت')}
              value={measuredDash(report.faith.ayahsInRange, '')}
              delta={report.faith.delta}
              accent="var(--tone-info)"
              isAr={isAr}
            />
            <MetricCard
              icon="target"
              label={t('Surahs touched', 'سور تمت تغطيتها')}
              value={report.faith.hasData ? report.faith.distinctSurahs : '—'}
              sub={report.faith.hasData ? t(`${report.faith.sessionsCount} sessions`, `${report.faith.sessionsCount} جلسة`) : t('no sessions', 'لا جلسات')}
              isAr={isAr}
            />
          </div>

          {report.learning.hasData && (
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Pages read over time', 'صفحات القراءة عبر الزمن')}</h3>
              <BarSeries
                points={report.timeline.map((p) => ({
                  key: p.key,
                  label: p.label,
                  fullLabel: p.fullLabel,
                  value: p.readingPages > 0 ? p.readingPages : p.recordedDays === 0 ? null : 0,
                  missing: p.recordedDays === 0
                }))}
                color="var(--tone-warning)"
                unit={isAr ? 'صفحة' : 'pages'}
                isAr={isAr}
              />
            </section>
          )}

          {report.faith.hasData && (
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Recitation quality', 'جودة التلاوة')}</h3>
              <HorizontalBars
                rows={report.faith.qualityBreakdown
                  .filter((q) => q.count > 0)
                  .map((q) => ({
                    key: q.key,
                    label: isAr ? q.labelAr : q.labelEn,
                    value: q.count,
                    percent: report.faith.sessionsCount > 0 ? Math.round((q.count / report.faith.sessionsCount) * 100) : 0,
                    color: 'var(--brand)'
                  }))}
                unit={t('sessions', 'جلسة')}
                isAr={isAr}
                emptyLabel={t('No quality data.', 'لا بيانات جودة.')}
              />
            </section>
          )}

          {!report.learning.hasData && !report.faith.hasData && <EmptySection isAr={isAr} />}
        </div>
      )}

      {/* ===================================================== FINANCE */}
      {section === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard icon="trending-up" label={t('Income', 'الدخل')} value={formatMoney(report.finance.income)} accent="var(--tone-success)" isAr={isAr} />
            <MetricCard icon="trending-down" label={t('Expenses', 'المصروفات')} value={formatMoney(report.finance.expense)} accent="var(--tone-danger)" isAr={isAr} />
            <MetricCard
              icon="scale"
              label={t('Net', 'الصافي')}
              value={formatMoney(report.finance.net)}
              accent={report.finance.net >= 0 ? 'var(--tone-success)' : 'var(--tone-danger)'}
              isAr={isAr}
            />
            <MetricCard
              icon="wallet"
              label={t('Savings', 'الادخار')}
              value={formatMoney(report.finance.savingsCurrent)}
              sub={report.finance.savingsPercent !== null ? t(`${report.finance.savingsPercent}% of goal`, `${report.finance.savingsPercent}% من الهدف`) : t('no savings goal', 'لا هدف ادخار')}
              isAr={isAr}
            />
          </div>

          {report.finance.hasData ? (
            <>
              {report.finance.monthlyTrend.length > 0 && (
                <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Monthly cashflow', 'التدفق الشهري')}</h3>
                  <DualBars
                    points={report.finance.monthlyTrend.map((m) => ({ key: m.key, label: m.label, a: m.income, b: m.expense }))}
                    colorA="var(--tone-success)"
                    colorB="var(--tone-danger)"
                    labelA={t('Income', 'الدخل')}
                    labelB={t('Expenses', 'المصروفات')}
                    isAr={isAr}
                  />
                </section>
              )}
              <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Spending by category', 'المصروفات حسب الفئة')}</h3>
                <HorizontalBars
                  rows={report.finance.topCategories.map((c) => ({ key: c.category, label: c.category, value: c.amount, percent: c.sharePercent, color: 'var(--tone-danger)' }))}
                  unit={t('spent', 'مصروف')}
                  isAr={isAr}
                  emptyLabel={t('No expenses in this window.', 'لا مصروفات في هذه الفترة.')}
                />
              </section>
            </>
          ) : (
            <EmptySection isAr={isAr} />
          )}
        </div>
      )}

      {/* ===================================================== PATTERNS */}
      {section === 'patterns' && (
        <div className="space-y-4">
          <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex items-start gap-3">
            <NuqtaIcon name="brain" className="w-5 h-5 text-accent shrink-0" />
            <p className="text-xs text-muted">
              {t(
                'Correlations are shown only when there are enough paired days with real variation. A flat line has no correlation to report — that is stated, never invented.',
                'لا تُعرض الارتباطات إلا عند توفّر أيام مقترنة كافية بتباين حقيقي. الخط المسطّح لا ارتباط له — ويُذكر ذلك صراحةً دون اختلاق.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.correlations.map((c) => (
              <div key={c.id} className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{isAr ? c.titleAr : c.titleEn}</h4>
                {c.available && c.r !== null ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 shrink-0">
                      <CorrelationGauge r={c.r} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <span className="text-2xl font-mono font-bold text-[var(--text-primary)]">{c.r.toFixed(2)}</span>
                      <p className="text-xs text-muted">{isAr ? c.interpretationAr : c.interpretationEn}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--surface-inset)] border border-dashed border-[var(--border-default)] text-xs text-muted">
                    {isAr ? c.interpretationAr : c.interpretationEn}
                  </div>
                )}
                <div className="text-[10px] font-mono text-muted pt-1 border-t border-[var(--border-subtle)]">
                  {t(`${c.n} paired days`, `${c.n} يوماً مقترناً`)}
                </div>
              </div>
            ))}
          </div>

          {report.habits.hasData && (
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('Weekday rhythm', 'إيقاع أيام الأسبوع')}</h3>
              <WeekdayStrip days={weekdayDays} isAr={isAr} />
            </section>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted text-center pt-2">
        {t(
          'All figures derive from your stored records for the selected range. NUQTA weeks run Saturday to Friday.',
          'كل الأرقام مستخرجة من سجلاتك المخزّنة في النطاق المحدد. يبدأ أسبوع نقطة من السبت إلى الجمعة.'
        )}
      </p>
    </div>
  );
};

// ------------------------------------------------------------------ helpers

function share(value: number | null, total: number): number {
  if (value === null || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

function pacingRows(
  pacing: { ahead: number; on_track: number; behind: number; dormant: number; not_started: number; completed: number },
  isAr: boolean
): { key: string; label: string; value: number; percent: number; color: string }[] {
  const defs: { key: keyof typeof pacing; en: string; ar: string; color: string }[] = [
    { key: 'ahead', en: 'Ahead', ar: 'متقدّم', color: 'var(--tone-success)' },
    { key: 'on_track', en: 'On track', ar: 'على المسار', color: 'var(--tone-info)' },
    { key: 'behind', en: 'Behind', ar: 'متأخّر', color: 'var(--tone-warning)' },
    { key: 'dormant', en: 'Dormant', ar: 'خامل', color: 'var(--tone-danger)' },
    { key: 'not_started', en: 'Not started', ar: 'لم يبدأ', color: 'var(--tone-warning)' },
    { key: 'completed', en: 'Completed', ar: 'مكتمل', color: 'var(--tone-success)' }
  ];
  const total = Object.values(pacing).reduce((a, b) => a + b, 0);
  return defs
    .map((d) => ({
      key: d.key,
      label: isAr ? d.ar : d.en,
      value: pacing[d.key],
      percent: total > 0 ? Math.round((pacing[d.key] / total) * 100) : 0,
      color: d.color
    }))
    .filter((r) => r.value > 0);
}

const PacingChip: React.FC<{ status: string; isAr: boolean }> = ({ status, isAr }) => {
  const labels: Record<string, { en: string; ar: string; tone: string }> = {
    ahead: { en: 'Ahead', ar: 'متقدّم', tone: 'var(--tone-success)' },
    on_track: { en: 'On track', ar: 'على المسار', tone: 'var(--tone-info)' },
    behind: { en: 'Behind', ar: 'متأخّر', tone: 'var(--tone-warning)' },
    dormant: { en: 'Dormant', ar: 'خامل', tone: 'var(--tone-danger)' },
    not_started: { en: 'Not started', ar: 'لم يبدأ', tone: 'var(--tone-warning)' },
    completed: { en: 'Completed', ar: 'مكتمل', tone: 'var(--tone-success)' }
  };
  const meta = labels[status] ?? labels.not_started;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ color: meta.tone, borderColor: meta.tone }}>
      {isAr ? meta.ar : meta.en}
    </span>
  );
};

const ProgressRow: React.FC<{ label: string; percent: number; color: string }> = ({ label, percent, color }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[10px] text-muted">
      <span>{label}</span>
      <span className="font-mono">{percent}%</span>
    </div>
    <div className="w-full h-1.5 rounded-full bg-[var(--surface-chip)] overflow-hidden border border-[var(--border-default)]">
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }} />
    </div>
  </div>
);

/** Half-circle gauge: -1 → left, 0 → top, +1 → right. */
const CorrelationGauge: React.FC<{ r: number }> = ({ r }) => {
  const angle = (r + 1) * 90;
  const rad = (angle * Math.PI) / 180;
  const cx = 48;
  const cy = 48;
  const radius = 34;
  const x = cx - Math.cos(rad) * radius;
  const y = cy - Math.sin(rad) * radius;
  const color = r > 0.15 ? 'var(--tone-success)' : r < -0.15 ? 'var(--tone-danger)' : 'var(--text-muted)';
  return (
    <svg viewBox="0 0 96 56" className="w-full h-full">
      <path d="M 14 48 A 34 34 0 0 1 82 48" fill="none" stroke="var(--border-subtle)" strokeWidth={6} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </svg>
  );
};

const EmptySection: React.FC<{ isAr: boolean }> = ({ isAr }) => (
  <div className="panel p-8 border border-dashed border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl text-center space-y-2">
    <NuqtaIcon name="chart" className="w-6 h-6 mx-auto text-muted" />
    <strong className="text-sm text-[var(--text-primary)] block">
      {isAr ? 'لا توجد بيانات لهذا القسم في النطاق المحدد' : 'No data for this section in the selected range'}
    </strong>
    <p className="text-xs text-muted">
      {isAr
        ? 'جرّب توسيع النطاق الزمني أو تسجيل نشاط جديد — لن تُعرض أرقام غير حقيقية.'
        : 'Try widening the range or logging new activity — no numbers are fabricated.'}
    </p>
  </div>
);

interface SummaryCardProps {
  title: string;
  icon: IconName;
  hasData: boolean;
  lines: string[];
  onOpen: () => void;
  isAr: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, icon, hasData, lines, onOpen, isAr }) => (
  <button
    onClick={onOpen}
    className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl text-start space-y-2 hover:border-[var(--border-strong)] transition-colors"
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
        <NuqtaIcon name={icon} className="w-3.5 h-3.5" />
        {title}
      </span>
      <NuqtaIcon name="arrow" className="w-3.5 h-3.5 text-muted" />
    </div>
    {hasData ? (
      lines.map((l, i) => (
        <div key={i} className="text-[11px] text-muted">
          {l}
        </div>
      ))
    ) : (
      <div className="text-[11px] text-muted italic">{isAr ? 'لا بيانات' : 'No data'}</div>
    )}
  </button>
);
