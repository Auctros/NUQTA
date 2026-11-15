import React from 'react';
import { DomainDeepAnalytics, LifeDomainCardData } from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface LifeDomainsGridProps {
  analytics: DomainDeepAnalytics;
  isAr: boolean;
  onNavigate: (tab: LifeDomainCardData['navTab']) => void;
}

export const LifeDomainsGrid: React.FC<LifeDomainsGridProps> = ({
  analytics,
  isAr,
  onNavigate
}) => {
  const { faith, learning, health, creative, finance, personal } = analytics;

  // Faith radial arc geometry
  const arcR = 24;
  const arcCirc = 2 * Math.PI * arcR;
  const arcDash = (Math.min(100, Math.max(0, faith.ayahsGoalPercent)) / 100) * arcCirc;
  const totalTaggedSurahs =
    faith.surahsCompleted + faith.surahsInProgress + faith.surahsNeedsRevision;

  // Learning 7d bars scale
  const maxDailyPages = Math.max(
    1,
    learning.dailyTargetPages || 0,
    ...learning.dailyPages7d.map((d) => d.pages)
  );

  // Health 7d workout bars scale
  const maxWorkoutMin = Math.max(1, ...health.dailyWorkout7d.map((d) => d.minutes));

  // Creative pipeline
  const totalPipelineCount = creative.stages.reduce((s, st) => s + st.count, 0);

  // Finance grouped bars scale
  const maxCash = Math.max(1, finance.income30d, finance.expense30d);

  const openIcon = isAr ? 'chevronLeft' : 'chevronRight';

  return (
    <section aria-label={isAr ? 'مجالات الحياة الستة' : 'Life Domains'}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {isAr ? 'تحليلات المجالات الستة' : 'LIFE DOMAINS ANALYTICS'}
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 m-0">
            {isAr ? 'نبض مجالات الحياة الستة' : 'Six Pillars of Life'}
          </h2>
        </div>
        <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
          {isAr
            ? 'مؤشرات مخصصة لطبيعة كل مجال بدون خلط مصطنع'
            : 'Domain-specific visuals calibrated to stored records'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {/* 1. FAITH & QURAN — Radial Memorization Arc + Surah Pipeline */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--d-quran-accent)',
                  backgroundColor: 'color-mix(in srgb, var(--d-quran-accent) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--d-quran-accent) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="mosque" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'الإيمان والقرآن' : 'Faith & Quran'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'تقدم الحفظ والمراجعة' : 'Hifz arc & surah breakdown'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('quran')}
              className="text-[11px] font-medium text-[var(--d-quran-accent)] hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isAr ? 'الاستوديو' : 'Studio'}</span>
              <NuqtaIcon name={openIcon} className="w-3.5 h-3.5" />
            </button>
          </div>

          {!faith.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'ابدأ تسجيل ورد التلاوة أو الحفظ في استوديو القرآن.'
                : 'Log your first reading or memorization session in Quran Studio.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r={arcR}
                      fill="none"
                      stroke="var(--surface-track)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={arcR}
                      fill="none"
                      stroke="var(--d-quran-accent)"
                      strokeWidth="6"
                      strokeDasharray={`${arcDash.toFixed(1)} ${arcCirc.toFixed(1)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono tabular-nums text-[11px] font-bold text-[var(--text-primary)]">
                    {faith.ayahsGoalPercent}%
                  </div>
                </div>

                <div className="flex-1 min-w-0 font-mono tabular-nums space-y-1">
                  <div className="text-lg font-bold text-[var(--d-quran-accent)] leading-none">
                    {faith.totalAyahsMemorized.toLocaleString()}{' '}
                    <span className="text-[11px] font-normal text-[var(--text-tertiary)]">/ 6,236</span>
                  </div>
                  <div className="text-[11px] font-sans text-[var(--text-secondary)]">
                    {isAr
                      ? `اليوم ${faith.todayAyahs}${faith.dailyTargetAyahs > 0 ? `/${faith.dailyTargetAyahs}` : ''} آية · ${faith.sessions7d} جلسات (7ي)`
                      : `Today ${faith.todayAyahs}${faith.dailyTargetAyahs > 0 ? `/${faith.dailyTargetAyahs}` : ''} ayahs · ${faith.sessions7d} sessions (7D)`}
                  </div>
                </div>
              </div>

              {/* Surah Status Stacked Bar */}
              <div>
                <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums text-[var(--text-secondary)] mb-1">
                  <span>{isAr ? 'حالة السور المتابعة' : 'Surah status'}</span>
                  <span>
                    {faith.surahsCompleted}✓ · {faith.surahsInProgress}→ · {faith.surahsNeedsRevision}!
                  </span>
                </div>
                <div className="h-2 w-full rounded-[3px] bg-[var(--surface-track)] overflow-hidden flex">
                  {totalTaggedSurahs > 0 && (
                    <>
                      {faith.surahsCompleted > 0 && (
                        <div
                          style={{
                            width: `${(faith.surahsCompleted / totalTaggedSurahs) * 100}%`,
                            backgroundColor: 'var(--d-quran-accent)'
                          }}
                        />
                      )}
                      {faith.surahsInProgress > 0 && (
                        <div
                          style={{
                            width: `${(faith.surahsInProgress / totalTaggedSurahs) * 100}%`,
                            backgroundColor: 'var(--state-info)'
                          }}
                        />
                      )}
                      {faith.surahsNeedsRevision > 0 && (
                        <div
                          style={{
                            width: `${(faith.surahsNeedsRevision / totalTaggedSurahs) * 100}%`,
                            backgroundColor: 'var(--state-warning)'
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </article>

        {/* 2. LEARNING & READING — 7D Pages Column Chart vs Daily Target */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--d-reading-accent)',
                  backgroundColor: 'color-mix(in srgb, var(--d-reading-accent) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--d-reading-accent) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="book-open" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'التعلم والقراءة' : 'Learning & Reading'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'صفحات آخر 7 أيام والسرعة' : '7D daily pages & reading pace'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reading')}
              className="text-[11px] font-medium text-[var(--d-reading-accent)] hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isAr ? 'المكتبة' : 'Vault'}</span>
              <NuqtaIcon name={openIcon} className="w-3.5 h-3.5" />
            </button>
          </div>

          {!learning.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'أضف كتابك الحالي وسجّل جلسات القراءة لعرض منحنى الصفحات.'
                : 'Add a book and log reading sessions in Reading Vault.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <div className="text-lg font-bold text-[var(--d-reading-accent)]">
                  {learning.pages7d} {isAr ? 'صفحة (7ي)' : 'pg (7D)'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {learning.avgSpeedPagesPerHour !== null
                    ? `${learning.avgSpeedPagesPerHour} ${isAr ? 'ص/س' : 'pg/hr'}`
                    : ''}
                  {learning.avgSpeedPagesPerHour !== null && learning.dailyTargetPages > 0 ? ' · ' : ''}
                  {learning.dailyTargetPages > 0
                    ? `${isAr ? 'هدف' : 'Goal'} ${learning.dailyTargetPages}p`
                    : ''}
                </div>
              </div>

              {/* 7D Column Bars with Target Reference Line */}
              <div className="relative h-16 flex items-end gap-1.5 pt-2" dir="ltr">
                {learning.dailyTargetPages > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-[var(--state-warning)] pointer-events-none"
                    style={{
                      bottom: `${Math.min(100, Math.round((learning.dailyTargetPages / maxDailyPages) * 76) + 18)}%`
                    }}
                  />
                )}
                {learning.dailyPages7d.map((d) => {
                  const pct = d.pages > 0 ? Math.max(8, Math.round((d.pages / maxDailyPages) * 100)) : 0;
                  return (
                    <div
                      key={d.dateKey}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                      title={`${d.dateKey}: ${d.pages} pg`}
                    >
                      <div className="w-full h-11 rounded-[3px] bg-[var(--surface-track)] flex items-end overflow-hidden">
                        {pct > 0 && (
                          <div
                            className="w-full rounded-t-[2px]"
                            style={{
                              height: `${pct}%`,
                              backgroundColor: 'var(--d-reading-accent)'
                            }}
                          />
                        )}
                      </div>
                      <span className="text-[9.5px] font-mono text-[var(--text-tertiary)] truncate max-w-full">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] truncate font-mono tabular-nums">
                {learning.activeBookTitle
                  ? `${learning.activeBookTitle} (${learning.activeBookPage}/${learning.activeBookTotalPages})`
                  : `${learning.completedBooks} ${isAr ? 'كتب مكتملة' : 'completed books'}`}
              </div>
            </div>
          )}
        </article>

        {/* 3. HEALTH & WORKOUT — Biometric Meters + 7D Workout Strip */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--d-workout-accent)',
                  backgroundColor: 'color-mix(in srgb, var(--d-workout-accent) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--d-workout-accent) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="activity" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'الصحة واللياقة' : 'Health & Fitness'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'التعافي اليومي وتكرار التمرين' : 'Biometrics & 7D workout volume'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('workout')}
                className="text-[11px] font-medium text-[var(--d-workout-accent)] hover:underline"
              >
                {isAr ? 'التمرين' : 'Workout'}
              </button>
              <span className="text-[var(--text-tertiary)] text-[10px]">·</span>
              <button
                type="button"
                onClick={() => onNavigate('health')}
                className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {isAr ? 'الصحة' : 'Health'}
              </button>
            </div>
          </div>

          {!health.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'سجّل ساعات النوم وشرب الماء أو التمرين لتتبع جاهزيتك الجسدية.'
                : 'Log sleep, hydration, or workouts to track physical readiness.'}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Compact Biometric Bullet Bars */}
              <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[11px]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                    <span className="font-sans">{isAr ? 'نوم' : 'Sleep'}</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {health.todaySleepHours > 0 ? `${health.todaySleepHours}h` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-[2px] bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.round((health.todaySleepHours / 8) * 100))}%`,
                        backgroundColor: 'var(--blue)'
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                    <span className="font-sans">{isAr ? 'ماء' : 'Water'}</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {health.todayHydrationMl > 0
                        ? `${(health.todayHydrationMl / 1000).toFixed(1)}L`
                        : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-[2px] bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.round((health.todayHydrationMl / Math.max(1, health.targetHydrationMl)) * 100))}%`,
                        backgroundColor: 'var(--state-info)'
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                    <span className="font-sans">{isAr ? 'مزاج' : 'Mood'}</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {health.todayMood > 0 ? `${health.todayMood}/5` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-[2px] bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.round((health.todayMood / 5) * 100))}%`,
                        backgroundColor: 'var(--d-workout-accent)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 7D Workout Duration Strip */}
              <div>
                <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums text-[var(--text-secondary)] mb-1.5">
                  <span>
                    {isAr ? 'نشاط التمرين (7ي)' : 'Workout 7D'}:{' '}
                    <span className="text-[var(--d-workout-accent)] font-semibold">
                      {health.workouts7d}
                      {health.weeklyTargetWorkouts > 0 ? `/${health.weeklyTargetWorkouts}` : ''}
                    </span>
                  </span>
                  <span>
                    {health.totalReps7d > 0
                      ? `${health.totalReps7d} ${isAr ? 'تكرار' : 'reps'}`
                      : ''}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1 items-end h-10" dir="ltr">
                  {health.dailyWorkout7d.map((w) => {
                    const hPct = w.minutes > 0 ? Math.max(15, Math.round((w.minutes / maxWorkoutMin) * 100)) : 0;
                    return (
                      <div
                        key={w.dateKey}
                        className="h-full flex flex-col items-center justify-end gap-0.5"
                        title={`${w.dateKey}: ${w.minutes}m`}
                      >
                        <div className="w-full h-7 rounded-[2px] bg-[var(--surface-track)] flex items-end overflow-hidden">
                          {hPct > 0 && (
                            <div
                              className="w-full"
                              style={{
                                height: `${hPct}%`,
                                backgroundColor: 'var(--d-workout-accent)'
                              }}
                            />
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-[var(--text-tertiary)] truncate max-w-full">
                          {w.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </article>

        {/* 4. CREATIVE STUDIO — Pipeline Stage Stacked Bar + Weekly Flow */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--d-drawing-accent)',
                  backgroundColor: 'color-mix(in srgb, var(--d-drawing-accent) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--d-drawing-accent) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="grid" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'الإبداع والرسم' : 'Creative Studio'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'خط إنتاج المشاريع وتدفق الأسبوع' : 'Project pipeline & 7D studio flow'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('drawing')}
              className="text-[11px] font-medium text-[var(--d-drawing-accent)] hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isAr ? 'المرسم' : 'Studio'}</span>
              <NuqtaIcon name={openIcon} className="w-3.5 h-3.5" />
            </button>
          </div>

          {!creative.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'ابدأ مشروعاً إبداعياً أو لوحة في مرسم الإبداع لتتبع مراحل الإنتاج.'
                : 'Start a creative project or piece in Art Studio to track pipeline velocity.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <div className="text-lg font-bold text-[var(--d-drawing-accent)]">
                  {creative.flowMinutes7d}m{' '}
                  <span className="text-[11px] font-normal text-[var(--text-tertiary)]">
                    {creative.weeklyTargetMinutes > 0 ? `/ ${creative.weeklyTargetMinutes}m` : '(7D)'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {creative.totalProjects} {isAr ? 'مشاريع' : 'proj'} · {creative.totalPieces}{' '}
                  {isAr ? 'أعمال' : 'pieces'}
                </div>
              </div>

              {/* Pipeline Stage Stacked Bar */}
              <div>
                <div className="text-[10.5px] font-mono text-[var(--text-secondary)] mb-1.5">
                  {isAr ? 'مراحل المشاريع الحالية' : 'Pipeline stages'}
                </div>
                <div className="h-3 w-full rounded-[4px] bg-[var(--surface-track)] overflow-hidden flex">
                  {totalPipelineCount > 0 &&
                    creative.stages
                      .filter((st) => st.count > 0)
                      .map((st) => (
                        <div
                          key={st.id}
                          title={`${isAr ? st.labelAr : st.labelEn}: ${st.count}`}
                          style={{
                            width: `${(st.count / totalPipelineCount) * 100}%`,
                            backgroundColor: st.color
                          }}
                        />
                      ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                {creative.stages.map((st) => (
                  <div key={st.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[var(--text-secondary)] truncate">
                      <span
                        className="w-2 h-2 rounded-[2px] shrink-0"
                        style={{ backgroundColor: st.color }}
                      />
                      <span className="truncate">{isAr ? st.labelAr : st.labelEn}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-primary)]">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* 5. FINANCE — 30D Income vs Expense Grouped Bars & Category Breakdown */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--blue)',
                  backgroundColor: 'color-mix(in srgb, var(--blue) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--blue) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="wallet" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'المال والميزانية' : 'Finance & Cashflow'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'الدخل مقابل المصروفات (30ي)' : '30D income vs spend & categories'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-[11px] font-medium text-[var(--blue)] hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isAr ? 'المال' : 'Money'}</span>
              <NuqtaIcon name={openIcon} className="w-3.5 h-3.5" />
            </button>
          </div>

          {!finance.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'أضف معاملاتك أو أهداف الادخار في قسم المال لتحليل التدفق المالي.'
                : 'Log income, expenses, or savings goals in Money to track cashflow.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <div
                  className={`text-lg font-bold ${
                    finance.net30d >= 0 ? 'text-[var(--state-success-strong)]' : 'text-[var(--state-danger-strong)]'
                  }`}
                >
                  {finance.net30d >= 0 ? '+' : ''}
                  {finance.net30d.toLocaleString()}{' '}
                  <span className="text-[11px] font-normal text-[var(--text-tertiary)]">
                    {isAr ? 'صافي 30ي' : 'net 30D'}
                  </span>
                </div>
                {finance.savingsTarget > 0 && (
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {isAr ? 'ادخار' : 'Saved'}{' '}
                    {Math.round((finance.savingsCurrent / finance.savingsTarget) * 100)}%
                  </div>
                )}
              </div>

              {/* Income vs Expense Grouped Bars */}
              <div className="space-y-1.5 font-mono tabular-nums text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[10.5px] font-sans text-[var(--text-secondary)] shrink-0">
                    {isAr ? 'الدخل' : 'Income'}
                  </span>
                  <div className="flex-1 h-2 rounded-[3px] bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--state-success-strong)]"
                      style={{ width: `${finance.income30d > 0 ? Math.max(4, (finance.income30d / maxCash) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="w-14 text-end text-[var(--text-primary)]">
                    {finance.income30d.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[10.5px] font-sans text-[var(--text-secondary)] shrink-0">
                    {isAr ? 'المصروف' : 'Expense'}
                  </span>
                  <div className="flex-1 h-2 rounded-[3px] bg-[var(--surface-track)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--state-warning)]"
                      style={{ width: `${finance.expense30d > 0 ? Math.max(4, (finance.expense30d / maxCash) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="w-14 text-end text-[var(--text-primary)]">
                    {finance.expense30d.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Top Categories */}
              {finance.topCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-[var(--border-subtle)] text-[10.5px] font-mono tabular-nums text-[var(--text-secondary)]">
                  {finance.topCategories.slice(0, 3).map((cat) => (
                    <span key={cat.category} className="truncate">
                      {cat.category} {cat.sharePercent}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </article>

        {/* 6. PERSONAL & ROUTINE — Time-of-Day Habit Adherence + Journal */}
        <article className="dash-glass p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                style={{
                  color: 'var(--brand-strong)',
                  backgroundColor: 'color-mix(in srgb, var(--brand-strong) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--brand-strong) 28%, transparent)'
                }}
              >
                <NuqtaIcon name="repeat" className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {isAr ? 'الحياة والعادات اليومية' : 'Personal & Routine'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {isAr ? 'الالتزام حسب أوقات اليوم' : 'Time-of-day habit cadence'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('habits')}
              className="text-[11px] font-medium text-[var(--brand-strong)] hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>{isAr ? 'العادات' : 'Habits'}</span>
              <NuqtaIcon name={openIcon} className="w-3.5 h-3.5" />
            </button>
          </div>

          {!personal.hasData ? (
            <div className="dash-glass-inset p-4 text-xs text-[var(--text-secondary)]">
              {isAr
                ? 'أضف عاداتك اليومية أو سجّل تأملاً في اليوميات لعرض الإيقاع الشخصي.'
                : 'Add daily habits or journal reflections to track personal adherence.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                {personal.timeOfDay.map((slot) => (
                  <div key={slot.slot} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-[var(--text-secondary)] truncate shrink-0">
                      {isAr ? slot.labelAr : slot.labelEn}
                    </span>
                    <div className="flex-1 h-2 rounded-[3px] bg-[var(--surface-track)] overflow-hidden">
                      {slot.rate !== null && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.max(4, slot.rate)}%`,
                            backgroundColor:
                              slot.rate >= 75
                                ? 'var(--brand-strong)'
                                : slot.rate >= 45
                                ? 'var(--blue)'
                                : 'var(--state-warning)'
                          }}
                        />
                      )}
                    </div>
                    <span className="w-10 text-end font-mono tabular-nums text-[var(--text-primary)] shrink-0">
                      {slot.rate !== null ? `${slot.rate}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                <span>
                  {personal.activeHabitsCount} {isAr ? 'عادات نشطة' : 'active habits'}
                </span>
                <span>
                  {personal.journals30d} {isAr ? 'تدوينات (30ي)' : 'journals (30D)'}
                  {personal.avgMood30d !== null ? ` · ${personal.avgMood30d}/5` : ''}
                </span>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
};
