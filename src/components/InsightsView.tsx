import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { TimeHorizon, computeLifeIntelligence } from '../lib/lifeIntelligenceEngine';
import {
  TrendLineChart,
  ActivityBarChart,
  CalendarHeatmap,
  SphereAllocationBar,
  MovementDistributionBar
} from './charts/LifeIntelligenceCharts';
import { WhatIfSimulator } from './WhatIfSimulator';

export const InsightsView: React.FC = () => {
  const {
    tasks,
    habits,
    goals,
    focusSessions,
    journalEntries,
    setSundayRitualOpen,
    setActiveNavTab,
    profile
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';

  // Navigation & Time Horizon State
  const [horizon, setHorizon] = useState<TimeHorizon>('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'simulator' | 'milestones'>('overview');
  const [domainDetailTab, setDomainDetailTab] = useState<'productivity' | 'habits' | 'reading' | 'fitness' | 'drawing' | 'focus'>('productivity');
  const [trendMetric, setTrendMetric] = useState<'totalActiveMinutes' | 'tasksDone' | 'readingPages' | 'workoutReps'>('totalActiveMinutes');

  // Compute live intelligence report
  const report = computeLifeIntelligence(horizon, tasks, habits, goals, focusSessions, isAr);

  // Delta badge renderer helper
  const renderDelta = (deltaPercent: number | null, unit = '') => {
    if (deltaPercent === null) return null;
    if (deltaPercent === 0) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
          0% {isAr ? 'مستقر' : 'flat'}
        </span>
      );
    }
    const isUp = deltaPercent > 0;
    return (
      <span
        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
          isUp
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}
      >
        <span>{isUp ? '↗ +' : '↘ '}</span>
        <span>{Math.abs(deltaPercent)}%</span>
      </span>
    );
  };

  // Meaningful non-infantilizing milestones
  const achievements = [
    {
      icon: '✳',
      title: isAr ? 'أول نقطة' : 'First Point',
      sub: isAr ? 'إنجاز أول مهمة بحضور كامل' : 'Complete first anchor task',
      unlocked: tasks.filter((t) => t.status === 'completed').length >= 1
    },
    {
      icon: '♨',
      title: isAr ? 'سلسلة ٧ أيام' : 'Seven-Day Chain',
      sub: isAr ? 'المحافظة على عادة لأسبوع كامل' : 'Keep a habit unbroken for a week',
      unlocked: habits.some((h) => h.longestStreak >= 7 || h.currentStreak >= 7)
    },
    {
      icon: '📖',
      title: isAr ? 'قارئ منهجي' : 'Systematic Reader',
      sub: isAr ? 'قراءة أكثر من 100 صفحة موثقة' : 'Log 100+ verified pages read',
      unlocked: report.reading.pagesRead.currentValue >= 100
    },
    {
      icon: '⚡',
      title: isAr ? 'عزيمة كاليستنكس' : 'Calisthenics Discipline',
      sub: isAr ? 'إنجاز أكثر من 100 تكرار بوزن الجسم' : 'Complete 100+ bodyweight reps',
      unlocked: report.fitness.workoutReps.currentValue >= 100
    },
    {
      icon: '🎨',
      title: isAr ? 'حالة تدفق إبداعي' : 'Creative Flow Master',
      sub: isAr ? 'تسجيل 3 ساعات تدفق في المرسم' : '3+ hours of studio flow',
      unlocked: report.drawing.flowHours.currentValue >= 3
    },
    {
      icon: '◷',
      title: isAr ? 'انتباه غير منقطع' : 'Deep Attention',
      sub: isAr ? 'تسجيل 5 جلسات تركيز عميقة' : '5+ deep work focus sprints',
      unlocked: focusSessions.length >= 5
    },
    {
      icon: '🎯',
      title: isAr ? 'محقق الأهداف' : 'Milestone Crusher',
      sub: isAr ? 'إنجاز أول مرحلة زمنية استراتيجية' : 'Hit first strategic milestone',
      unlocked: report.goals.milestonesAchieved >= 1
    },
    {
      icon: '✦',
      title: isAr ? 'أسبوع متوازن' : 'Steady Week',
      sub: isAr ? 'انتظام العادات بنسبة تتجاوز 70%' : '70%+ habit consistency',
      unlocked: report.habits.consistencyRate.currentValue >= 70
    }
  ];

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / LIFE INTELLIGENCE OBSERVATORY</span>
          </div>
          <h1>{isAr ? 'لوحة الذكاء الحياتي والتحليلات' : 'Life Intelligence Dashboard'}</h1>
          <p>
            {isAr
              ? 'مرصد تحليلي موحد يربط إنتاجيتك وعاداتك وقراءتك وتمارينك ورسمك في صورة شمولية واقعية.'
              : 'Unified analytical observatory deriving cross-domain momentum from your real habits, focus, and craft.'}
          </p>
        </div>

        <div className="heading-actions flex-wrap gap-2">
          {/* Main Sub-view switcher */}
          <div className="view-switcher" role="group" aria-label="Insight views">
            <button
              onClick={() => setActiveTab('overview')}
              className={activeTab === 'overview' ? 'active' : ''}
            >
              {isAr ? 'النظرة الشاملة' : 'Overview'}
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={activeTab === 'domains' ? 'active' : ''}
            >
              {isAr ? 'تحليل المجالات' : 'Deep Domains'}
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={activeTab === 'simulator' ? 'active' : ''}
            >
              {isAr ? 'محاكي التراكم' : 'What-If'}
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={activeTab === 'milestones' ? 'active' : ''}
            >
              {isAr ? 'شواهد الإتقان' : 'Milestones'}
            </button>
          </div>

          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle flex items-center gap-1.5"
            title={isAr ? 'فتح الأرشيف والسجل الزمني الشامل' : 'Open Universal Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive & History'}</span>
          </button>

          <button
            onClick={() => setSundayRitualOpen(true)}
            className="btn primary"
          >
            <span>✳</span>
            <span>{isAr ? 'طقس الأحد' : 'Sunday Ritual'}</span>
          </button>
        </div>
      </div>

      {/* Time Horizon Selector Ribbon (Today / Week / Month / All) */}
      <div className="panel p-3 border border-[#23352b] bg-[#111914] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">{isAr ? 'النافذة التحليلية:' : 'Analysis Window:'}</span>
          <div className="flex p-0.5 rounded-lg bg-[#0c120f] border border-[#26372d] text-xs">
            <button
              onClick={() => setHorizon('today')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                horizon === 'today' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
              }`}
            >
              {isAr ? 'اليوم' : 'Today'}
            </button>
            <button
              onClick={() => setHorizon('week')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                horizon === 'week' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
              }`}
            >
              {isAr ? 'هذا الأسبوع' : 'This Week'}
            </button>
            <button
              onClick={() => setHorizon('month')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                horizon === 'month' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
              }`}
            >
              {isAr ? 'هذا الشهر' : 'This Month'}
            </button>
            <button
              onClick={() => setHorizon('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                horizon === 'all' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
              }`}
            >
              {isAr ? 'المدى الشامل' : 'All-Time'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span>📅 {report.dateRangeLabel}</span>
          {horizon !== 'all' && (
            <span className="text-[11px] text-accent font-medium">
              ({isAr ? 'مقارن بالفترة السابقة المماثلة' : 'vs prior period'})
            </span>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* VIEW 1: OVERVIEW & CROSS-DOMAIN INTELLIGENCE */}
      {/* ==================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Core Domain Hero Metric Cards with Deltas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Tasks & Execution */}
            <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{isAr ? 'إنجاز المهام' : 'Tasks Completed'}</span>
                </span>
                {renderDelta(report.productivity.tasksCompleted.deltaPercent)}
              </div>
              <div>
                <strong className="text-2xl font-mono text-white font-bold block">
                  {report.productivity.tasksCompleted.currentValue}
                </strong>
                <span className="text-[11px] text-muted">
                  {isAr ? `معدل الإنجاز: ${report.productivity.completionRate}%` : `Completion rate: ${report.productivity.completionRate}%`}
                </span>
              </div>
              <div className="text-[10px] text-muted font-mono pt-1 border-t border-[#1a2820]">
                {report.productivity.topThreeDone} {isAr ? 'مهام بوصلة منجزة' : 'compass tasks done'}
              </div>
            </div>

            {/* 2. Habit Cadence */}
            <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <span>↻</span>
                  <span>{isAr ? 'انتظام العادات' : 'Habit Cadence'}</span>
                </span>
                {renderDelta(report.habits.consistencyRate.deltaPercent)}
              </div>
              <div>
                <strong className="text-2xl font-mono text-accent font-bold block">
                  {report.habits.consistencyRate.currentValue}%
                </strong>
                <div className="w-full bg-[#16231c] rounded-full h-1.5 overflow-hidden border border-[#23382c] mt-1.5">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-300"
                    style={{ width: `${report.habits.consistencyRate.currentValue}%` }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-muted font-mono pt-1 border-t border-[#1a2820]">
                {isAr ? `أطول سلسلة: ${report.habits.longestActiveStreak} يوم` : `Longest streak: ${report.habits.longestActiveStreak}d`}
              </div>
            </div>

            {/* 3. Reading Studio */}
            <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <span>📖</span>
                  <span>{isAr ? 'صفحات القراءة' : 'Pages Read'}</span>
                </span>
                {renderDelta(report.reading.pagesRead.deltaPercent)}
              </div>
              <div>
                <strong className="text-2xl font-mono text-amber-300 font-bold block">
                  {report.reading.pagesRead.currentValue}
                </strong>
                <span className="text-[11px] text-muted">
                  ~{report.reading.readingHours.currentValue}h {isAr ? 'قراءة مركزة' : 'read'}
                </span>
              </div>
              <div className="text-[10px] text-muted font-mono pt-1 border-t border-[#1a2820]">
                {report.reading.averageSpeedPagesPerHour > 0
                  ? `${report.reading.averageSpeedPagesPerHour} ${isAr ? 'صفحة/ساعة' : 'pages/hr'}`
                  : (isAr ? 'حساب السرعة نشط' : 'tracking speed')}
              </div>
            </div>

            {/* 4. Home Fitness */}
            <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>{isAr ? 'تكرارات اللياقة' : 'Calisthenics Reps'}</span>
                </span>
                {renderDelta(report.fitness.workoutReps.deltaPercent)}
              </div>
              <div>
                <strong className="text-2xl font-mono text-emerald-400 font-bold block">
                  {report.fitness.workoutReps.currentValue}
                </strong>
                <span className="text-[11px] text-muted">
                  {report.fitness.sessionsCount} {isAr ? 'حصص تدريبية منزلية' : 'sessions'} · {report.fitness.workoutMinutes.currentValue}m
                </span>
              </div>
              <div className="text-[10px] text-emerald-400 font-mono pt-1 border-t border-[#1a2820]">
                {report.fitness.workoutMinutes.currentValue} {isAr ? 'دقيقة تدريب منجزة' : 'active mins'}
              </div>
            </div>
          </div>

          {/* Time & Effort Allocation Across Spheres (Cross-Domain) */}
          <section className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚖️</span>
                  <span>{isAr ? 'توزيع الوقت والمجهود بين مجالات الحياة' : 'Life Spheres Time & Effort Allocation'}</span>
                </h3>
                <p className="text-xs text-muted">
                  {isAr
                    ? 'رصد واقعي لساعات تركيزك الموزعة بين العمل العميق، اللياقة البدنية، القراءة الفكرية، والمرسم الإبداعي.'
                    : 'Actual observation of how your conscious hours distributed across essential life spheres.'}
                </p>
              </div>

              <div className="text-end font-mono">
                <span className="text-xs text-muted block">{isAr ? 'إجمالي الساعات المستثمرة:' : 'Total Active Hours:'}</span>
                <strong className="text-base font-bold text-accent">{report.totalActiveTimeHours}h</strong>
              </div>
            </div>

            {/* Segmented Distribution Bar */}
            <SphereAllocationBar
              allocations={report.sphereAllocations}
              totalHours={report.totalActiveTimeHours}
              isAr={isAr}
            />

            {/* Highest Momentum vs Area Needing Attention Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#14221a] border border-[#223d2d] flex items-start gap-3">
                <span className="text-xl">🚀</span>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-accent font-semibold block">
                    {isAr ? 'المجال الأكثر نشاطاً وزخماً' : 'HIGHEST MOMENTUM SPHERE'}
                  </span>
                  <strong className="text-sm text-white block">
                    {isAr ? report.highestMomentumDomain.nameAr : report.highestMomentumDomain.nameEn}
                  </strong>
                  <p className="text-xs text-muted">
                    {isAr ? report.highestMomentumDomain.reasonAr : report.highestMomentumDomain.reasonEn}
                  </p>
                </div>
              </div>

              {report.areaNeedingAttention ? (
                <div className="p-3.5 rounded-xl bg-[#221815] border border-[#3e2720] flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-semibold block">
                      {isAr ? 'مجال يحتاج انتباهاً وتنشيطاً' : 'SPHERE NEEDING MOMENTUM'}
                    </span>
                    <strong className="text-sm text-white block">
                      {isAr ? report.areaNeedingAttention.nameAr : report.areaNeedingAttention.nameEn}
                    </strong>
                    <p className="text-xs text-muted">
                      {isAr ? report.areaNeedingAttention.reasonAr : report.areaNeedingAttention.reasonEn}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#14221a] border border-[#223d2d] flex items-start gap-3">
                  <span className="text-xl">🌱</span>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-semibold block">
                      {isAr ? 'توازن مستقر بين المجالات' : 'BALANCED SPHERE DISTRIBUTION'}
                    </span>
                    <strong className="text-sm text-white block">
                      {isAr ? 'جميع المجالات سجلت نشاطاً' : 'All domains engaged'}
                    </strong>
                    <p className="text-xs text-muted">
                      {isAr ? 'هناك استثمار متزن ومستمر بين العمل والجسد والفكر والإبداع.' : 'Continuous steady investment across all life anchors.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Interactive Trend Chart Section */}
          <section className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📈</span>
                  <span>{isAr ? 'منحنى الاتجاه والوتيرة اليومية (Daily Momentum Curve)' : 'Daily Momentum Trend Line'}</span>
                </h3>
                <p className="text-xs text-muted">
                  {isAr ? 'تتبع صعود وهبوط الإيقاع اليومي ومعدل البناء التراكمي.' : 'Visualize daily velocity peaks and steady recovery cycles.'}
                </p>
              </div>

              {/* Metric Selector Switcher */}
              <div className="flex p-0.5 rounded-lg bg-[#0c120f] border border-[#26372d] text-xs self-start sm:self-auto">
                <button
                  onClick={() => setTrendMetric('totalActiveMinutes')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    trendMetric === 'totalActiveMinutes' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
                  }`}
                >
                  {isAr ? 'الدقائق النشطة' : 'Active Mins'}
                </button>
                <button
                  onClick={() => setTrendMetric('tasksDone')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    trendMetric === 'tasksDone' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
                  }`}
                >
                  {isAr ? 'المهام' : 'Tasks'}
                </button>
                <button
                  onClick={() => setTrendMetric('readingPages')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    trendMetric === 'readingPages' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
                  }`}
                >
                  {isAr ? 'صفحات القراءة' : 'Pages'}
                </button>
                <button
                  onClick={() => setTrendMetric('workoutReps')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    trendMetric === 'workoutReps' ? 'bg-[#1e2e25] text-accent font-bold' : 'text-muted hover:text-white'
                  }`}
                >
                  {isAr ? 'تكرارات التمارين' : 'Reps'}
                </button>
              </div>
            </div>

            {/* Smooth SVG Trend Line Chart */}
            <TrendLineChart
              data={report.dailyTrend}
              metricKey={trendMetric}
              color={
                trendMetric === 'totalActiveMinutes'
                  ? '#34d399'
                  : trendMetric === 'readingPages'
                  ? '#f59e0b'
                  : trendMetric === 'workoutReps'
                  ? '#10b981'
                  : '#38bdf8'
              }
              unit={
                trendMetric === 'totalActiveMinutes'
                  ? (isAr ? 'دقيقة' : 'mins')
                  : trendMetric === 'readingPages'
                  ? (isAr ? 'صفحة' : 'pages')
                  : trendMetric === 'workoutReps'
                  ? (isAr ? 'تكرار' : 'reps')
                  : (isAr ? 'مهمة' : 'tasks')
              }
              isAr={isAr}
            />
          </section>

          {/* Calendar Activity Heatmap Matrix (GitHub Style - 56 Days) */}
          <section className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧱</span>
                  <span>{isAr ? 'مصفوفة النشاط التراكمي (8 أسابيع / 56 يوماً)' : 'Continuous Momentum Matrix (8 Weeks)'}</span>
                </h3>
                <p className="text-xs text-muted">
                  {isAr
                    ? 'كثافة الإنجاز اليومية المجمعة من كافة المهام، العادات، التمارين، جلسات القراءة، والرسم.'
                    : 'Composite daily intensity across all tasks, habits, calisthenics, books, and artwork.'}
                </p>
              </div>
            </div>

            <CalendarHeatmap weeks={report.heatmapWeeks} isAr={isAr} />
          </section>

          {/* Goals Contribution Matrix */}
          <section className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🎯</span>
                  <span>{isAr ? 'مساهمة الأنشطة في الأهداف الاستراتيجية' : 'Activity Contribution to Strategic Goals'}</span>
                </h3>
                <p className="text-xs text-muted">
                  {isAr
                    ? 'تغذية الأهداف الكبرى بالأنشطة المنفذة فعلياً خلال هذه الفترة.'
                    : 'Live trace of how execution activities compound into macro goals.'}
                </p>
              </div>
              <button
                onClick={() => setActiveNavTab('goals')}
                className="text-xs text-accent hover:underline"
              >
                {isAr ? 'خارطة الأهداف الكاملة ↗' : 'Goals Roadmap ↗'}
              </button>
            </div>

            {report.goals.goalSummaries.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted border border-dashed border-[#23352b] rounded-xl">
                {isAr ? 'لا توجد أهداف نشطة مرتبطة بأنشطة حالياً.' : 'No active goals linked yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.goals.goalSummaries.map((g) => (
                  <div
                    key={g.goalId}
                    className="p-3.5 rounded-xl border border-[#1e2c24] bg-[#131b17] flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#18261e] text-accent font-semibold">
                          {g.category}
                        </span>
                        <span className="font-mono text-accent font-bold text-sm">
                          {g.progressPercent}%
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-xs truncate">{g.title}</h4>
                    </div>

                    <div className="w-full bg-[#18261e] rounded-full h-1.5 overflow-hidden border border-[#23382c]">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-300"
                        style={{ width: `${g.progressPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-[#1a2820]">
                      <span>
                        {g.recentEventsCount > 0
                          ? `${g.recentEventsCount} ${isAr ? 'مساهمات مسجلة في الفترة' : 'contributions'}`
                          : (isAr ? 'بانتظار أنشطة' : 'no activity in period')}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        g.activeStatus === 'ahead' ? 'text-emerald-300 bg-emerald-500/10' :
                        g.activeStatus === 'dormant' ? 'text-amber-300 bg-amber-500/10' : 'text-teal-300 bg-teal-500/10'
                      }`}>
                        {g.activeStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==================================================== */}
      {/* VIEW 2: DEEP DOMAIN ANALYTICS (تحليل المجالات) */}
      {/* ==================================================== */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* Domain Picker Pills */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[#0e1612] border border-[#23352b] text-xs">
            <button
              onClick={() => setDomainDetailTab('productivity')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'productivity' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>✓</span>
              <span>{isAr ? 'الإنتاجية والمهام' : 'Tasks'}</span>
            </button>
            <button
              onClick={() => setDomainDetailTab('habits')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'habits' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>↻</span>
              <span>{isAr ? 'العادات اليومية' : 'Habits'}</span>
            </button>
            <button
              onClick={() => setDomainDetailTab('reading')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'reading' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>📖</span>
              <span>{isAr ? 'مكتبة القراءة' : 'Reading'}</span>
            </button>
            <button
              onClick={() => setDomainDetailTab('fitness')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'fitness' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>{isAr ? 'اللياقة المنزلية' : 'Fitness'}</span>
            </button>
            <button
              onClick={() => setDomainDetailTab('drawing')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'drawing' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>🎨</span>
              <span>{isAr ? 'مرسم الإبداع' : 'Drawing'}</span>
            </button>
            <button
              onClick={() => setDomainDetailTab('focus')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                domainDetailTab === 'focus' ? 'bg-[#1e2e25] text-accent font-bold shadow' : 'text-muted hover:text-white'
              }`}
            >
              <span>◷</span>
              <span>{isAr ? 'التركيز العميق' : 'Focus'}</span>
            </button>
          </div>

          {/* DOMAIN 1: PRODUCTIVITY & TASKS */}
          {domainDetailTab === 'productivity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'المهام المكتملة' : 'Completed Tasks'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.productivity.tasksCompleted.currentValue}
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.productivity.tasksCompleted.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'معدل إنجاز المهام المجدولة' : 'Schedule Completion Rate'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {report.productivity.completionRate}%
                  </strong>
                  <span className="text-[11px] text-muted">
                    {report.productivity.tasksCompleted.currentValue} {isAr ? 'من أصل' : 'of'} {report.productivity.totalTasksScheduled} {isAr ? 'مجدولة' : 'scheduled'}
                  </span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'مهام البوصلة الثلاث المنجزة' : 'Compass Focus Tasks Hit'}</span>
                  <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
                    {report.productivity.topThreeDone}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'مهام عالية التأثير والأولوية' : 'high-leverage focus anchors'}</span>
                </div>
              </div>

              {/* Daily Task Breakdown Bar Chart */}
              <div className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-white">
                  {isAr ? 'توزيع إنجاز المهام اليومية (Daily Tasks Bar Chart)' : 'Daily Task Completion Distribution'}
                </h4>
                <ActivityBarChart
                  data={report.dailyTrend}
                  metricKey="tasksDone"
                  color="#34d399"
                  unit={isAr ? 'مهمة' : 'tasks'}
                  isAr={isAr}
                />
              </div>
            </div>
          )}

          {/* DOMAIN 2: HABITS */}
          {domainDetailTab === 'habits' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'معدل انتظام العادات' : 'Habit Consistency Rate'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {report.habits.consistencyRate.currentValue}%
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.habits.consistencyRate.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'أطول سلسلة متواصلة' : 'Longest Unbroken Streak'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.habits.longestActiveStreak} {isAr ? 'يوم' : 'days'}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'استمرارية راسخة' : 'unbroken momentum'}</span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'إجمالي علامات الإنجاز' : 'Total Check-ins'}</span>
                  <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
                    {report.habits.totalChecks}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'تكرار عادة في الفترة' : 'habit executions'}</span>
                </div>
              </div>

              {/* Habit Breakdown list */}
              <div className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-white">
                  {isAr ? 'حالة العادات الفردية والسلاسل النشطة' : 'Active Habits & Current Streaks'}
                </h4>
                <div className="space-y-2">
                  {habits.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-xl bg-[#141e18] border border-[#203326] flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-white block font-semibold">{h.name}</strong>
                        <span className="text-[11px] text-muted">{h.anchor || (isAr ? 'عادة يومية' : 'Daily anchor')}</span>
                      </div>
                      <div className="text-end font-mono">
                        <span className="text-accent font-bold block">{h.currentStreak}d streak</span>
                        <span className="text-[10px] text-muted">{isAr ? `الأفضل: ${h.longestStreak}d` : `Best: ${h.longestStreak}d`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOMAIN 3: READING STUDIO */}
          {domainDetailTab === 'reading' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'الصفحات المقروءة' : 'Pages Read'}</span>
                  <strong className="text-2xl font-mono text-amber-300 font-bold mt-1 block">
                    {report.reading.pagesRead.currentValue}
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.reading.pagesRead.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'ساعات القراءة' : 'Reading Hours'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.reading.readingHours.currentValue}h
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'وقت تدفق معرفي' : 'focus reading'}</span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'سرعة القراءة' : 'Average Pace'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {report.reading.averageSpeedPagesPerHour}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'صفحة لكل ساعة' : 'pages / hr'}</span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'الكتب المكتملة' : 'Books Finished'}</span>
                  <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
                    {report.reading.booksFinished}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'كتاب منجز' : 'completed'}</span>
                </div>
              </div>

              {/* Reading Trend Bar Chart */}
              <div className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-white">
                  {isAr ? 'وتيرة قراءة الصفحات اليومية' : 'Daily Pages Read Velocity'}
                </h4>
                <ActivityBarChart
                  data={report.dailyTrend}
                  metricKey="readingPages"
                  color="#f59e0b"
                  unit={isAr ? 'صفحة' : 'pages'}
                  isAr={isAr}
                />
              </div>
            </div>
          )}

          {/* DOMAIN 4: HOME FITNESS */}
          {domainDetailTab === 'fitness' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'مجموع التكرارات المنجزة' : 'Total Calisthenics Reps'}</span>
                  <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
                    {report.fitness.workoutReps.currentValue}
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.fitness.workoutReps.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'دقائق التدريب المنزلي' : 'Active Training Minutes'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.fitness.workoutMinutes.currentValue}m
                  </strong>
                  <span className="text-[11px] text-muted">
                    {report.fitness.sessionsCount} {isAr ? 'حصص تدريبية' : 'sessions'}
                  </span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'معدل الحصة' : 'Avg Session Length'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {report.fitness.sessionsCount > 0
                      ? Math.round(report.fitness.workoutMinutes.currentValue / report.fitness.sessionsCount)
                      : 25}m
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'دقائق لكل تمرين' : 'mins / workout'}</span>
                </div>
              </div>

              {/* Movement Pattern Balance Distribution */}
              <div className="panel p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isAr ? 'ميزان الأنماط الحركية (Movement Pattern Balance)' : 'Movement Pattern Balance Distribution'}
                    </h4>
                    <p className="text-xs text-muted">
                      {isAr ? 'توزيع التكرارات على حركات الدفع، الأرجل، الجذع، والسحب والمرونة لمنع عدم الاتزان العضلي.' : 'Distribution of reps across muscle movements ensuring structural balance.'}
                    </p>
                  </div>
                </div>
                <MovementDistributionBar
                  distribution={report.fitness.movementDistribution}
                  isAr={isAr}
                />
              </div>
            </div>
          )}

          {/* DOMAIN 5: CREATIVE STUDIO (DRAWING) */}
          {domainDetailTab === 'drawing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'ساعات التدفق الإبداعي' : 'Flow Hours'}</span>
                  <strong className="text-2xl font-mono text-purple-300 font-bold mt-1 block">
                    {report.drawing.flowHours.currentValue}h
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.drawing.flowHours.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'الأعمال والسكتشات' : 'Artworks Logged'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.drawing.artworksLogged}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'قطعة في المعرض' : 'pieces preserved'}</span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'المشاريع المنجزة' : 'Projects Completed'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {report.drawing.projectsCompleted}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'مشروع مكتمل 🏆' : 'completed projects'}</span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'الوسيط الأبرز' : 'Top Medium'}</span>
                  <strong className="text-sm font-bold text-teal-300 mt-1 block truncate capitalize">
                    {report.drawing.favoriteMedium}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'الأسلوب الأكثر استخداماً' : 'highest cadence'}</span>
                </div>
              </div>
            </div>
          )}

          {/* DOMAIN 6: DEEP WORK FOCUS */}
          {domainDetailTab === 'focus' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'ساعات العمل العميق' : 'Deep Work Hours'}</span>
                  <strong className="text-2xl font-mono text-blue-400 font-bold mt-1 block">
                    {report.focus.deepWorkHours.currentValue}h
                  </strong>
                  <div className="mt-1">
                    {renderDelta(report.focus.deepWorkHours.deltaPercent)}
                  </div>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'جلسات الانتباه المركزة' : 'Focus Sprints'}</span>
                  <strong className="text-2xl font-mono text-white font-bold mt-1 block">
                    {report.focus.sessionsCount}
                  </strong>
                  <span className="text-[11px] text-muted">
                    {isAr ? `متوسط الجلسة: ${report.focus.averageSessionMinutes} دقيقة` : `avg ${report.focus.averageSessionMinutes}m per sprint`}
                  </span>
                </div>

                <div className="panel p-4 border border-[#23352b] bg-[#111914] rounded-xl">
                  <span className="text-xs text-muted block">{isAr ? 'معدل مقاطعة الجلسات' : 'Interruption Rate'}</span>
                  <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
                    {report.focus.interruptionRate}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'مقاطعة / جلسة' : 'interruptions / session'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* VIEW 3: "WHAT-IF" COMPOUNDING SIMULATOR */}
      {/* ==================================================== */}
      {activeTab === 'simulator' && <WhatIfSimulator />}

      {/* ==================================================== */}
      {/* VIEW 4: MEANINGFUL MILESTONES & ACHIEVEMENTS */}
      {/* ==================================================== */}
      {activeTab === 'milestones' && (
        <section className="panel insight-card p-5 border border-[#23352b] bg-[#111914] rounded-2xl space-y-4">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'محطات وشواهد الإتقان التراكمي (Milestones)' : 'Calm Milestones of Mastery'}</h2>
              <p>
                {isAr
                  ? 'شواهد حقيقية ترصد ثباتك والتزامك دون ضوضاء أو مكافآت طفولية زائفة.'
                  : 'Grounded milestones honoring conscious execution and steady, quiet discipline.'}
              </p>
            </div>
          </div>

          <div className="achievement-grid">
            {achievements.map((a, i) => (
              <div
                key={i}
                className={`achievement ${a.unlocked ? 'unlocked' : ''}`}
              >
                <span className="achievement-icon">{a.icon}</span>
                <strong>{a.title}</strong>
                <small>{a.sub}</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
