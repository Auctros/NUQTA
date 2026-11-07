import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import {
  QURAN_SURAHS,
  TOTAL_QURAN_AYAHS,
  TOTAL_QURAN_SURAHS,
  getSurahMeta
} from '../lib/quranData';
import {
  QuranSessionType,
  QuranRecitationQuality,
  QuranSurahStatus
} from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { Badge, StatTile, TabBar } from './ui';

const STUDIO_TABS = [
  { id: 'dashboard', ar: 'لوحة المتابعة', en: 'Dashboard' },
  { id: 'session', ar: 'جلسة حفظ / مراجعة', en: 'Live Session' },
  { id: 'map', ar: 'خريطة المصحف (114 سورة)', en: 'Surah Map (114)' },
  { id: 'schedule', ar: 'جدول المراجعة والورد', en: 'Revision Schedule' },
  { id: 'history', ar: 'سجل الجلسات', en: 'History & Archive' }
];

export const QuranView: React.FC = () => {
  const {
    habits,
    createHabit,
    logQuranSession,
    updateSurahStatus,
    updateQuranRevisionSchedule,
    deleteQuranSession,
    profile,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  // Find existing Quran habit or allow creating one seamlessly
  const quranHabit = habits.find((h) => h.specializedType === 'quran');
  const quranData = quranHabit?.quranData;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'map' | 'schedule' | 'history'>('dashboard');

  // Session Logger State
  const [sessionType, setSessionType] = useState<QuranSessionType>('new_memorization');
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(quranData?.activeSurahNumber || 2);
  const [ayahStart, setAyahStart] = useState<number>(1);
  const [ayahEnd, setAyahEnd] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [quality, setQuality] = useState<QuranRecitationQuality>('excellent');
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [logSuccessToast, setLogSuccessToast] = useState<string | null>(null);

  // Map Filters
  const [mapSearch, setMapSearch] = useState<string>('');
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | QuranSurahStatus>('all');
  const [mapJuzFilter, setMapJuzFilter] = useState<number | 'all'>('all');

  // Schedule Customization State
  const [targetDailyAyahs, setTargetDailyAyahs] = useState<number>(quranData?.dailyTargetAyahs || 10);
  const [revisionCycleDays, setRevisionCycleDays] = useState<number>(quranData?.revisionSchedule?.revisionCycleDays || 7);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Quick auto-initialization if habit does not exist yet
  const handleInitQuranHabit = () => {
    createHabit({
      name: isAr ? 'حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision',
      anchor: isAr ? 'بعد صلاة الفجر -> أحفظ نصف صفحة وأراجع ورداً' : 'After Fajr prayer -> memorize & review wird',
      category: 'learning',
      timeOfDay: 'morning',
      specializedType: 'quran'
    });
  };

  // Safe Fallbacks
  const surahsState = quranData?.surahs || [];
  const sessions = quranData?.sessions || [];
  const totalMemorizedAyahs = quranData?.totalAyahsMemorized || 0;
  const totalCompletedSurahs = quranData?.totalSurahsCompleted || 0;
  const percentOfQuran = Math.min(100, Number(((totalMemorizedAyahs / TOTAL_QURAN_AYAHS) * 100).toFixed(2)));

  const selectedSurahMeta = getSurahMeta(selectedSurahNumber);

  // When selected surah changes, calibrate ayah range sensibly
  const handleSelectSurah = (surahNum: number) => {
    setSelectedSurahNumber(surahNum);
    const meta = getSurahMeta(surahNum);
    const surahState = surahsState.find((s) => s.surahNumber === surahNum);
    const lastRange = surahState?.memorizedAyahsRanges?.[surahState.memorizedAyahsRanges.length - 1];

    if (lastRange && lastRange.end < meta.totalAyahs) {
      setAyahStart(lastRange.end + 1);
      setAyahEnd(Math.min(meta.totalAyahs, lastRange.end + 10));
    } else {
      setAyahStart(1);
      setAyahEnd(Math.min(meta.totalAyahs, 10));
    }
  };

  const calculatedAyahCount = Math.max(1, Math.min(selectedSurahMeta.totalAyahs, ayahEnd) - Math.max(1, ayahStart) + 1);

  // Handle session submit
  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quranHabit) return;

    const sanitizedStart = Math.max(1, Math.min(selectedSurahMeta.totalAyahs, ayahStart));
    const sanitizedEnd = Math.max(sanitizedStart, Math.min(selectedSurahMeta.totalAyahs, ayahEnd));

    logQuranSession(quranHabit.id, {
      type: sessionType,
      surahNumber: selectedSurahNumber,
      surahName: selectedSurahMeta.nameAr,
      ayahStart: sanitizedStart,
      ayahEnd: sanitizedEnd,
      ayahCount: sanitizedEnd - sanitizedStart + 1,
      durationMinutes,
      quality,
      mistakesCount,
      notes: sessionNotes.trim() || undefined
    });

    setLogSuccessToast(
      isAr
        ? `تم تسجيل جلسة ${sessionType === 'new_memorization' ? 'حفظ' : 'مراجعة'} سورة ${selectedSurahMeta.nameAr} بنجاح!`
        : `Successfully logged Quran session for Surah ${selectedSurahMeta.nameEn}!`
    );

    setTimeout(() => setLogSuccessToast(null), 4000);
    setSessionNotes('');
    setMistakesCount(0);
    setActiveTab('dashboard');
  };

  // Handle schedule update
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quranHabit) return;

    updateQuranRevisionSchedule(quranHabit.id, {
      targetDailyAyahs,
      revisionCycleDays
    });

    setScheduleSuccess(true);
    setTimeout(() => setScheduleSuccess(false), 3000);
  };

  // Filtered Surahs for Map
  const filteredSurahs = QURAN_SURAHS.filter((meta) => {
    const state = surahsState.find((s) => s.surahNumber === meta.number);
    const status: QuranSurahStatus = state?.status || 'not_started';

    if (mapStatusFilter !== 'all' && status !== mapStatusFilter) {
      return false;
    }

    if (mapJuzFilter !== 'all' && meta.juzStart !== mapJuzFilter) {
      return false;
    }

    if (mapSearch.trim()) {
      const q = mapSearch.trim().toLowerCase();
      const matchAr = meta.nameAr.toLowerCase().includes(q);
      const matchEn = meta.nameEn.toLowerCase().includes(q);
      const matchNum = meta.number.toString() === q;
      if (!matchAr && !matchEn && !matchNum) return false;
    }

    return true;
  });

  // Calculate today's stats
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const todayAyahs = todaySessions.filter((s) => s.type === 'new_memorization').reduce((sum, s) => sum + s.ayahCount, 0);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // If habit not created yet
  if (!quranHabit) {
    return (
      <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="page-heading">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="line"></span>
              <span className="font-mono text-[var(--d-quran-accent)]">NUQTA / QURAN SANCTUARY</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
              {isAr ? 'استوديو حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision Studio'}
            </h1>
            <p className="text-sm text-muted">
              {isAr
                ? 'نظام متخصص لحفظ القرآن الكريم وتثبيت ورده اليومي بدقة وإتقان دون تشتت.'
                : 'A dedicated workspace for disciplined Quran memorization, precision tracking, and revision cadence.'}
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl border border-emerald-500/30 bg-[var(--d-quran-surface)] text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-[var(--d-quran-accent)] flex items-center justify-center text-3xl mx-auto border border-emerald-500/30">
            📜
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'ابدأ رحلتك المباركة في حفظ كتاب الله' : 'Initialize Your Quran Sanctuary'}
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            {isAr
              ? 'يتيح لك هذا الاستوديو خريطة تفاعلية لـ 114 سورة، ونظام منع احتساب الآيات المكررة، وجدول مراجعة مخصص للحفظ القريب والبعيد.'
              : 'Interactive 114-Surah map, strict non-duplicate interval tracking, and customizable revision schedule.'}
          </p>
          <button
            onClick={handleInitQuranHabit}
            className="btn primary px-6 py-2.5 text-sm font-bold shadow-lg"
          >
            <span>+</span>
            <span>{isAr ? 'تفعيل استوديو حفظ القرآن الآن' : 'Enable Quran Studio'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Alert */}
      {logSuccessToast && (
        <div className="p-3 rounded-xl border border-emerald-500/40 bg-[var(--d-quran-chip)] text-[var(--d-quran-accent-bright)] text-xs flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-[var(--d-quran-accent)] text-base">✓</span>
            <span>{logSuccessToast}</span>
          </div>
          <button onClick={() => setLogSuccessToast(null)} className="text-[var(--d-quran-accent)] hover:text-[var(--text-primary)]">
            ×
          </button>
        </div>
      )}

      {/* 1. Page Heading with Quick Stats */}
      <div className="page-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="line"></span>
            <span className="font-mono text-[var(--d-quran-accent)]">NUQTA / QURAN SANCTUARY</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            {isAr ? 'استوديو حفظ ومراجعة القرآن الكريم' : 'Quran Memorization Studio'}
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {isAr
              ? 'مساحة هادئة لمتابعة الورد، الحفظ الجديد، والتسميع المتين مع منع تكرار احتساب الآيات.'
              : 'Disciplined sanctuary for new memorization, spaced revision, and mastery retention.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('session')}
            className="btn primary small text-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isAr ? 'تسجيل جلسة حفظ / مراجعة' : 'Log Session'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle small text-xs flex items-center gap-1.5"
            title={isAr ? 'فتح أرشيف وسجل القرآن الشامل' : 'Open Quran Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('habits')}
            className="btn subtle small text-xs"
          >
            <span>{isAr ? 'كل العادات' : 'All Habits'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Distinct Ayahs */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-quran-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الآيات المحفوظة فعلياً' : 'Ayahs Memorized'}</span>
            <span className="text-[var(--d-quran-accent)] text-xs">📜</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--d-quran-accent)]">
              {totalMemorizedAyahs.toLocaleString()}
            </strong>
            <span className="text-xs text-muted font-mono">/ {TOTAL_QURAN_AYAHS.toLocaleString()}</span>
          </div>
          <div className="w-full bg-[var(--d-quran-chip)] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentOfQuran}%` }}
            />
          </div>
          <span className="text-[var(--fs-micro)] text-[var(--d-quran-accent-strong)] font-mono block">
            {percentOfQuran}% {isAr ? 'من القرآن الكريم' : 'of Quran'}
          </span>
        </div>

        {/* Completed Surahs */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-quran-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'السور المكتملة' : 'Completed Surahs'}</span>
            <span className="text-[var(--d-quran-accent)] text-xs">🕌</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {totalCompletedSurahs}
            </strong>
            <span className="text-xs text-muted font-mono">/ {TOTAL_QURAN_SURAHS}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {surahsState.filter((s) => s.status === 'in_progress').length} {isAr ? 'سور قيد الحفظ' : 'in progress'}
          </span>
        </div>

        {/* Today's Accomplishments */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-quran-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'إنجاز ورد اليوم' : 'Today\'s Output'}</span>
            <span className="text-[var(--state-warning)] text-xs">☀️</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--state-warning-strong)]">
              {todayAyahs}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'آية حفظ' : 'ayahs'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block font-mono">
            {todayMinutes} {isAr ? 'دقيقة تدبر وحفظ' : 'mins logged'}
          </span>
        </div>

        {/* Streak */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-[var(--d-quran-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الانتظام في الورد' : 'Current Streak'}</span>
            <span className="text-accent text-xs">♨</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-accent">
              {quranHabit.currentStreak || 0}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'أيام متتالية' : 'days'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {isAr ? 'أطول سلسلة:' : 'Best:'} {quranHabit.longestStreak || 0} {isAr ? 'يوم' : 'd'}
          </span>
        </div>

        {/* Revision Cadence */}
        <div className="col-span-2 sm:col-span-1">
          <StatTile
            label={isAr ? 'دورة المراجعة' : 'Revision Cadence'}
            value={
              <>
                {quranData?.revisionSchedule?.revisionCycleDays || 7}
                <span className="text-[var(--fs-sm)] font-normal ms-1">{isAr ? 'أيام' : 'days'}</span>
              </>
            }
            hint={`${isAr ? 'الهدف اليومي:' : 'Daily Target:'} ${quranData?.dailyTargetAyahs || 10} ${isAr ? 'آيات' : 'ayahs'}`}
            icon="repeat"
            accent="info"
          />
        </div>
      </div>

      {/* 3. Studio Navigation Tabs (Buttons) */}
            <TabBar
        items={STUDIO_TABS.map((t) => ({ id: t.id, label: isAr ? t.ar : t.en }))}
        value={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* =========================================================================
          TAB 1: DASHBOARD
         ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Active Surah Focus & Live Progress */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Surah Focus Card */}
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[var(--d-quran-deep)] via-[var(--d-quran-surface)] to-[var(--d-quran-raised)] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-[var(--d-quran-accent)] flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                    📖
                  </span>
                  <div>
                    <span className="text-[var(--fs-micro)] font-mono tracking-wider text-[var(--d-quran-accent)] uppercase block">
                      {isAr ? 'السورة الجارية في الحفظ' : 'ACTIVE MEMORIZATION SURAH'}
                    </span>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                      {selectedSurahMeta.number}. سورة {selectedSurahMeta.nameAr} ({selectedSurahMeta.nameEn})
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('session')}
                  className="btn primary small text-xs flex items-center gap-1"
                >
                  <span>▶</span>
                  <span>{isAr ? 'بدء جلسة الآن' : 'Start Session'}</span>
                </button>
              </div>

              {/* Progress Bar of Active Surah */}
              {(() => {
                const state = surahsState.find((s) => s.surahNumber === selectedSurahMeta.number);
                const memorizedCount = state?.memorizedAyahsCount || 0;
                const surahProgressPct = Math.min(100, Math.round((memorizedCount / selectedSurahMeta.totalAyahs) * 100));

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {isAr ? 'الآيات المحفوظة في هذه السورة:' : 'Ayahs Memorized:'}
                      </span>
                      <span className="font-mono text-[var(--d-quran-accent-strong)] font-bold">
                        {memorizedCount} / {selectedSurahMeta.totalAyahs} {isAr ? 'آية' : 'ayahs'} ({surahProgressPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-[var(--d-quran-chip)] h-2 rounded-full overflow-hidden border border-[var(--d-quran-border)]">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${surahProgressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[var(--fs-xs)] text-muted pt-1">
                      <span>
                        {isAr ? 'مكان النزول:' : 'Revelation:'}{' '}
                        {selectedSurahMeta.place === 'makkah' ? (isAr ? 'مكية' : 'Meccan') : (isAr ? 'مدنية' : 'Medinan')}
                        {' · '}{isAr ? 'الجزء:' : 'Juz:'} {selectedSurahMeta.juzStart}
                      </span>
                      {state?.memorizedAyahsRanges && state.memorizedAyahsRanges.length > 0 && (
                        <span className="font-mono text-[var(--text-primary)]">
                          {isAr ? 'نطاقات الحفظ:' : 'Ranges:'}{' '}
                          {state.memorizedAyahsRanges.map((r) => `[${r.start}-${r.end}]`).join(' ، ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Recent Quran Sessions */}
            <div className="p-5 rounded-2xl border border-[var(--d-quran-border)] bg-[var(--d-quran-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-quran-border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📜</span>
                  <span>{isAr ? 'آخر جلسات الحفظ والتسميع' : 'Recent Memorization Sessions'}</span>
                </h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-link text-xs"
                >
                  <span>{isAr ? 'عرض السجل الكامل' : 'All history'}</span>
                  <span>→</span>
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--d-quran-border)] rounded-xl">
                  {isAr ? 'لا توجد جلسات مسجلة بعد. ابدأ أول جلسة حفظ اليوم!' : 'No sessions logged yet. Record your first session today!'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-[var(--d-quran-border-soft)] bg-[var(--d-quran-surface)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            s.type === 'new_memorization'
                              ? 'bg-emerald-500/20 text-[var(--d-quran-accent)]'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {s.type === 'new_memorization' ? 'ح' : 'م'}
                        </span>
                        <div className="min-w-0">
                          <strong className="text-[var(--text-primary)] block truncate">
                            سورة {s.surahName} (الآيات {s.ayahStart} إلى {s.ayahEnd})
                          </strong>
                          <span className="text-[var(--fs-xs)] text-muted flex items-center gap-2 mt-0.5">
                            <span>{s.date}</span>
                            <span>· {s.ayahCount} {isAr ? 'آيات' : 'ayahs'}</span>
                            <span>· {s.durationMinutes}m</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[var(--fs-micro)] px-2 py-0.5 rounded font-medium border shrink-0 ${
                          s.quality === 'excellent'
                            ? 'bg-emerald-500/15 text-[var(--d-quran-accent-strong)] border-emerald-500/30'
                            : s.quality === 'very_good'
                            ? 'bg-teal-500/15 text-[var(--state-info-strong)] border-teal-500/30'
                            : s.quality === 'good'
                            ? 'bg-amber-500/15 text-[var(--state-warning-strong)] border-amber-500/30'
                            : 'bg-rose-500/15 text-[var(--state-danger-strong)] border-rose-500/30'
                        }`}
                      >
                        {s.quality === 'excellent'
                          ? (isAr ? 'متقن كالفاتحة' : 'Excellent')
                          : s.quality === 'very_good'
                          ? (isAr ? 'جيد جداً' : 'Very Good')
                          : s.quality === 'good'
                          ? (isAr ? 'جيد' : 'Good')
                          : (isAr ? 'يحتاج تثبيت' : 'Needs Work')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Aside Column: Surahs Due for Review & Methodology */}
          <div className="space-y-6">
            {/* Surahs Due for Review Today */}
            <div className="p-5 rounded-2xl border border-[var(--d-quran-border)] bg-[var(--d-quran-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-quran-border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>🔁</span>
                  <span>{isAr ? 'السور المستحقة للمراجعة' : 'Due for Revision'}</span>
                </h3>
                <span className="text-[var(--fs-micro)] font-mono px-2 py-0.5 rounded bg-teal-500/15 text-[var(--state-info-strong)] border border-teal-500/30">
                  {isAr ? 'تثبيت الحفظ' : 'Active Cadence'}
                </span>
              </div>

              {(() => {
                const inProgressOrReview = surahsState.filter(
                  (s) => s.status === 'in_progress' || s.status === 'needs_revision' || s.status === 'completed'
                );

                if (inProgressOrReview.length === 0) {
                  return (
                    <p className="text-xs text-muted text-center py-4">
                      {isAr ? 'لا توجد سور مسجلة في المراجعة بعد.' : 'No surahs in revision cue yet.'}
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    {inProgressOrReview.slice(0, 5).map((s) => {
                      const meta = getSurahMeta(s.surahNumber);
                      return (
                        <div
                          key={s.surahNumber}
                          onClick={() => {
                            setSelectedSurahNumber(s.surahNumber);
                            setSessionType('revision');
                            setActiveTab('session');
                          }}
                          className="p-2.5 rounded-xl border border-[var(--d-quran-border-strong)] bg-[var(--d-quran-raised)] hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between text-xs group"
                        >
                          <div>
                            <strong className="text-[var(--text-primary)] block group-hover:text-[var(--d-quran-accent)]">
                              {meta.number}. سورة {meta.nameAr}
                            </strong>
                            <span className="text-[var(--fs-micro)] text-muted">
                              {s.memorizedAyahsCount} {isAr ? 'آية محفوظة' : 'ayahs'} · {s.status === 'completed' ? (isAr ? 'مكتملة' : 'Done') : (isAr ? 'قيد الحفظ' : 'In Progress')}
                            </span>
                          </div>

                          <span className="text-[var(--d-quran-accent)] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAr ? 'راجع ↗' : 'Review ↗'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Memorization Golden Rules Card */}
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-[var(--d-quran-surface)] space-y-2 text-xs">
              <span className="text-[var(--d-quran-accent)] font-bold block flex items-center gap-1.5">
                <span>✦</span>
                <span>{isAr ? 'قاعدة الحفظ الراسخ' : 'Golden Rule of Retention'}</span>
              </span>
              <p className="text-muted leading-relaxed text-[var(--fs-xs)]">
                {isAr
                  ? '«ما تكرر تقرر» — المراجعة اليومية المنتظمة للقديم والحديث أهم من الاستكثار من الحفظ الجديد دون تثبيت. خصص ثلثي وقتك للمراجعة والتسميع.'
                  : 'Spaced repetition preserves cognitive anchors. Anchor 70% of study time into active retrieval and revision.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE SESSION LOGGER
         ========================================================================= */}
      {activeTab === 'session' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-emerald-500/30 bg-[var(--d-quran-surface)] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--d-quran-border-soft)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>✍️</span>
                <span>{isAr ? 'تسجيل جلسة حفظ أو مراجعة قرآنية' : 'Log Quran Session'}</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isAr
                  ? 'يتم دمج الآيات المحفوظة تلقائياً لمنع احتساب أي آية مرتين في إجمالي حفظك.'
                  : 'Ayah intervals automatically merge to prevent duplicate counting in your net total.'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-muted hover:text-[var(--text-primary)] text-sm"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmitSession} className="space-y-4">
            {/* 1. Session Type Selector */}
            <div className="field">
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1.5">
                {isAr ? 'نوع الجلسة:' : 'Session Type:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionType('new_memorization')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    sessionType === 'new_memorization'
                      ? 'border-emerald-400 bg-emerald-500/20 text-[var(--text-primary)] font-bold'
                      : 'border-[var(--d-quran-border)] bg-[var(--d-quran-chip)] text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-base block mb-0.5">🟢</span>
                  <span className="text-xs block">{isAr ? 'حفظ جديد' : 'New Memorization'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionType('revision')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    sessionType === 'revision'
                      ? 'border-blue-400 bg-blue-500/20 text-[var(--text-primary)] font-bold'
                      : 'border-[var(--d-quran-border)] bg-[var(--d-quran-chip)] text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-base block mb-0.5">🔵</span>
                  <span className="text-xs block">{isAr ? 'مراجعة وتثبيت' : 'Revision'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionType('recitation_test')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    sessionType === 'recitation_test'
                      ? 'border-purple-400 bg-purple-500/20 text-[var(--text-primary)] font-bold'
                      : 'border-[var(--d-quran-border)] bg-[var(--d-quran-chip)] text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-base block mb-0.5">🟣</span>
                  <span className="text-xs block">{isAr ? 'تسميع واختبار' : 'Recitation Test'}</span>
                </button>
              </div>
            </div>

            {/* 2. Surah Selector */}
            <div className="field">
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                {isAr ? 'السورة الكريمة:' : 'Select Surah:'}
              </label>
              <select
                className="select w-full text-xs font-semibold"
                value={selectedSurahNumber}
                onChange={(e) => handleSelectSurah(Number(e.target.value))}
              >
                {QURAN_SURAHS.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.nameAr} ({s.nameEn}) — {s.totalAyahs} آية (جزء {s.juzStart})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Ayah Range (Start to End) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">
                  {isAr ? 'من آية:' : 'From Ayah:'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedSurahMeta.totalAyahs}
                  value={ayahStart}
                  onChange={(e) => setAyahStart(Number(e.target.value))}
                  className="input w-full text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">
                  {isAr ? 'إلى آية:' : 'To Ayah:'}
                </label>
                <input
                  type="number"
                  min={ayahStart}
                  max={selectedSurahMeta.totalAyahs}
                  value={ayahEnd}
                  onChange={(e) => setAyahEnd(Number(e.target.value))}
                  className="input w-full text-xs font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[var(--d-quran-raised)] border border-[var(--d-quran-border)] flex items-center justify-between text-xs text-muted">
              <span>{isAr ? 'مجموع الآيات في هذه الجلسة:' : 'Ayahs in this session:'}</span>
              <span className="font-mono font-bold text-[var(--d-quran-accent)]">
                {calculatedAyahCount} {isAr ? 'آيات' : 'ayahs'}
              </span>
            </div>

            {/* 4. Duration & Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">
                  {isAr ? 'مدة الجلسة (بالدقائق):' : 'Duration (minutes):'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="input w-full text-xs font-mono"
                    required
                  />
                  <div className="flex gap-1">
                    {[15, 25, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className="px-2 py-1 rounded bg-[var(--d-quran-chip)] border border-[var(--d-quran-border-strong)] text-[var(--fs-micro)] text-muted hover:text-[var(--text-primary)]"
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">
                  {isAr ? 'درجة الإتقان والتسميع:' : 'Recitation Quality:'}
                </label>
                <select
                  className="select w-full text-xs"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as QuranRecitationQuality)}
                >
                  <option value="excellent">{isAr ? '⭐⭐⭐⭐⭐ متقن كالفاتحة (ممتاز)' : '⭐⭐⭐⭐⭐ Excellent'}</option>
                  <option value="very_good">{isAr ? '⭐⭐⭐⭐ جيد جداً (تنبيه يسير)' : '⭐⭐⭐⭐ Very Good'}</option>
                  <option value="good">{isAr ? '⭐⭐⭐ جيد (يحتاج تثبيتاً)' : '⭐⭐⭐ Good'}</option>
                  <option value="needs_reinforcement">{isAr ? '⭐⭐ يحتاج إعادة وضبط' : '⭐⭐ Needs Reinforcement'}</option>
                </select>
              </div>
            </div>

            {/* 5. Mistakes & Notes */}
            <div className="field">
              <label className="text-xs text-muted block mb-1">
                {isAr ? 'عدد الأخطاء أو الوقفات (اختياري):' : 'Mistakes count (optional):'}
              </label>
              <input
                type="number"
                min={0}
                value={mistakesCount}
                onChange={(e) => setMistakesCount(Number(e.target.value))}
                className="input w-24 text-xs font-mono"
              />
            </div>

            <div className="field">
              <label className="text-xs text-muted block mb-1">
                {isAr ? 'ملاحظات التدبر أو المتشابهات اللفظية:' : 'Reflective notes or difficult ayahs:'}
              </label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder={isAr ? 'اكتب وقفة تدبر، أو موضع تشابه مع سورة أخرى...' : 'Notes on difficult passages or reflections...'}
                className="textarea w-full text-xs"
                rows={2}
              />
            </div>

            <div className="pt-3 border-t border-[var(--d-quran-border-soft)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="btn subtle small text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="btn primary small text-xs px-5 py-2 font-bold"
              >
                <span>✓</span>
                <span>{isAr ? 'تسجيل الجلسة وحفظ الإنجاز' : 'Save Session'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SURAH MAP (114 SURAHS)
         ========================================================================= */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-xl border border-[var(--d-quran-border)] bg-[var(--d-quran-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <span className="text-muted">🔍</span>
              <input
                type="text"
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم السورة أو رقمها...' : 'Search Surah name or number...'}
                className="input text-xs w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted text-[var(--fs-xs)]">{isAr ? 'الحالة:' : 'Status:'}</span>
              {(['all', 'completed', 'in_progress', 'needs_revision', 'not_started'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setMapStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs ${
                    mapStatusFilter === st
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'text-muted hover:text-[var(--text-primary)] bg-[var(--d-quran-chip)] border border-[var(--d-quran-border-strong)]'
                  }`}
                >
                  {st === 'all'
                    ? (isAr ? 'الكل (114)' : 'All')
                    : st === 'completed'
                    ? (isAr ? 'مكتملة' : 'Completed')
                    : st === 'in_progress'
                    ? (isAr ? 'قيد الحفظ' : 'In Progress')
                    : st === 'needs_revision'
                    ? (isAr ? 'تحتاج مراجعة' : 'Needs Review')
                    : (isAr ? 'لم تبدأ' : 'Not Started')}
                </button>
              ))}
            </div>

            {/* Juz Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted text-[var(--fs-xs)]">{isAr ? 'الجزء:' : 'Juz:'}</span>
              <select
                className="select text-xs"
                value={mapJuzFilter}
                onChange={(e) => setMapJuzFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">{isAr ? 'جميع الأجزاء (1-30)' : 'All Juz'}</option>
                {Array.from({ length: 30 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {isAr ? `الجزء ${i + 1}` : `Juz ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Surah Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredSurahs.map((meta) => {
              const state = surahsState.find((s) => s.surahNumber === meta.number);
              const memorizedCount = state?.memorizedAyahsCount || 0;
              const isCompleted = state?.status === 'completed';
              const isInProgress = state?.status === 'in_progress';
              const needsRevision = state?.status === 'needs_revision';
              const pct = Math.min(100, Math.round((memorizedCount / meta.totalAyahs) * 100));

              return (
                <div
                  key={meta.number}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isCompleted
                      ? 'border-[var(--d-quran-status-done-border)] bg-[var(--d-quran-status-done-bg)]'
                      : isInProgress
                      ? 'border-[var(--d-quran-status-progress-border)] bg-[var(--d-quran-status-progress-bg)]'
                      : needsRevision
                      ? 'border-[var(--d-quran-status-review-border)] bg-[var(--d-quran-status-review-bg)]'
                      : 'border-[var(--d-quran-status-idle-border)] bg-[var(--d-quran-status-idle-bg)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[var(--d-quran-chip)] text-[var(--d-quran-accent)] font-mono text-xs flex items-center justify-center font-bold">
                          {meta.number}
                        </span>
                        <div>
                          <strong className="text-xs text-[var(--text-primary)] block">
                            سورة {meta.nameAr}
                          </strong>
                          <span className="text-[var(--fs-micro)] text-muted block">
                            {meta.nameEn} · {meta.totalAyahs} {isAr ? 'آية' : 'ayahs'}
                          </span>
                        </div>
                      </div>

                      <Badge
                        tone={isCompleted ? 'success' : isInProgress ? 'info' : needsRevision ? 'warning' : 'neutral'}
                      >
                        {isCompleted
                          ? (isAr ? 'محفوظة' : 'Completed')
                          : isInProgress
                          ? (isAr ? 'قيد الحفظ' : 'In Progress')
                          : needsRevision
                          ? (isAr ? 'مراجعة' : 'Review')
                          : (isAr ? 'لم تبدأ' : 'Not Started')}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 my-2">
                      <div className="w-full bg-[var(--d-quran-chip)] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[var(--fs-micro)] text-muted font-mono">
                        <span>{memorizedCount}/{meta.totalAyahs} {isAr ? 'آية' : 'ayahs'}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="pt-2 border-t border-[var(--d-quran-border-soft)] flex items-center justify-between text-[var(--fs-xs)]">
                    <span className="text-muted text-[var(--fs-micro)]">
                      {isAr ? 'جزء' : 'Juz'} {meta.juzStart}
                    </span>
                    <button
                      onClick={() => {
                        handleSelectSurah(meta.number);
                        setSessionType(isCompleted ? 'revision' : 'new_memorization');
                        setActiveTab('session');
                      }}
                      className="text-[var(--d-quran-accent)] hover:text-[var(--d-quran-accent-strong)] font-medium text-xs flex items-center gap-1"
                    >
                      <span>+ {isAr ? 'تسجيل' : 'Log'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: REVISION SCHEDULE & CADENCE
         ========================================================================= */}
      {activeTab === 'schedule' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-emerald-500/30 bg-[var(--d-quran-surface)] shadow-xl space-y-6">
          <div className="border-b border-[var(--d-quran-border-soft)] pb-3">
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>📅</span>
              <span>{isAr ? 'تخصيص جدول الورد والمراجعة الدورية' : 'Custom Revision Cadence'}</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {isAr
                ? 'حدد إيقاعك اليومي في الحفظ الجديد والدورة الزمنية لمراجعة المحفوظ القديم.'
                : 'Configure your daily new memorization pace and cyclical revision rhythm.'}
            </p>
          </div>

          {scheduleSuccess && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-[var(--d-quran-chip)] text-[var(--d-quran-accent-strong)] text-xs">
              {isAr ? 'تم تحديث خطة المراجعة والورد بنجاح!' : 'Revision schedule updated successfully!'}
            </div>
          )}

          <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
            <div className="field">
              <label className="text-muted block mb-1">
                {isAr ? 'هدف الحفظ اليومي (عدد الآيات في اليوم):' : 'Daily Target New Ayahs:'}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={targetDailyAyahs}
                onChange={(e) => setTargetDailyAyahs(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-quran-accent)]"
                required
              />
            </div>

            <div className="field">
              <label className="text-muted block mb-1">
                {isAr ? 'دورة المراجعة الشاملة (كل كم يوم يختم المحفوظ مراجعة):' : 'Full Revision Cycle (Days):'}
              </label>
              <select
                className="select w-full text-xs font-semibold"
                value={revisionCycleDays}
                onChange={(e) => setRevisionCycleDays(Number(e.target.value))}
              >
                <option value={7}>{isAr ? 'أسبوعياً (كل 7 أيام - للحفظ المتقن الراسخ)' : 'Weekly (7 Days)'}</option>
                <option value={14}>{isAr ? 'كل أسبوعين (14 يوماً - إيقاع متوازن)' : 'Bi-weekly (14 Days)'}</option>
                <option value={30}>{isAr ? 'شهرياً (كل 30 يوماً - للأجزاء المتعددة)' : 'Monthly (30 Days)'}</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-[var(--d-quran-raised)] border border-[var(--d-quran-border)] space-y-2 text-[var(--fs-xs)]">
              <strong className="text-[var(--text-primary)] block font-semibold">
                {isAr ? 'المنهجية المقترحة في الورد:' : 'Recommended Framework:'}
              </strong>
              <ul className="space-y-1 text-muted list-disc list-inside">
                <li>{isAr ? 'الحفظ الجديد: نصف وجه إلى وجه يومياً بعد الفجر.' : 'New: 5-10 ayahs after morning anchor.'}</li>
                <li>{isAr ? 'المراجعة الصغرى: مراجعة آخر حزب تم حفظه يومياً.' : 'Minor review: past 1-2 juz reviewed daily.'}</li>
                <li>{isAr ? 'المراجعة الكبرى: ورد دوري ثابت للسور القديمة في الصلوات والتهجد.' : 'Major review: full cycle active in prayers.'}</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-[var(--d-quran-border-soft)] flex justify-end">
              <button type="submit" className="btn primary small text-xs px-5 py-2">
                <span>{isAr ? 'حفظ إعدادات الجدول' : 'Save Cadence'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 5: SESSIONS HISTORY & ARCHIVE
         ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-quran-border)] bg-[var(--d-quran-surface)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)]">
              {isAr ? `إجمالي الجلسات المسجلة: ${sessions.length}` : `Total Logged Sessions: ${sessions.length}`}
            </span>
            <button
              onClick={() => setActiveTab('session')}
              className="btn primary small text-xs"
            >
              + {isAr ? 'جلسة جديدة' : 'New Session'}
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted border border-dashed border-[var(--d-quran-border)] rounded-2xl">
              {isAr ? 'لا توجد جلسات في السجل بعد.' : 'No sessions recorded in archive.'}
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border border-[var(--d-quran-border-strong)] bg-[var(--d-quran-raised)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        s.type === 'new_memorization'
                          ? 'bg-emerald-500/20 text-[var(--d-quran-accent)]'
                          : s.type === 'revision'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-[var(--state-purple)]'
                      }`}
                    >
                      {s.type === 'new_memorization' ? 'حفظ' : s.type === 'revision' ? 'راجع' : 'تسميع'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="text-[var(--text-primary)] block truncate">
                        سورة {s.surahName} (الآيات {s.ayahStart} - {s.ayahEnd})
                      </strong>
                      <div className="flex items-center gap-2 mt-0.5 text-[var(--fs-xs)] text-muted font-mono">
                        <span>{s.date}</span>
                        <span>· {s.ayahCount} {isAr ? 'آية' : 'ayahs'}</span>
                        <span>· {s.durationMinutes}m</span>
                        {s.mistakesCount ? <span>· {s.mistakesCount} {isAr ? 'أخطاء' : 'mistakes'}</span> : null}
                      </div>
                      {s.notes && (
                        <p className="text-[var(--fs-xs)] text-muted/80 mt-1 italic truncate">
                          "{s.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[var(--fs-micro)] px-2 py-0.5 rounded font-medium border ${
                        s.quality === 'excellent'
                          ? 'bg-emerald-500/15 text-[var(--d-quran-accent-strong)] border-emerald-500/30'
                          : s.quality === 'very_good'
                          ? 'bg-teal-500/15 text-[var(--state-info-strong)] border-teal-500/30'
                          : s.quality === 'good'
                          ? 'bg-amber-500/15 text-[var(--state-warning-strong)] border-amber-500/30'
                          : 'bg-rose-500/15 text-[var(--state-danger-strong)] border-rose-500/30'
                      }`}
                    >
                      {s.quality === 'excellent' ? '⭐⭐⭐⭐⭐' : s.quality === 'very_good' ? '⭐⭐⭐⭐' : s.quality === 'good' ? '⭐⭐⭐' : '⭐⭐'}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(isAr ? 'هل تريد حذف هذه الجلسة من السجل؟' : 'Delete this session?')) {
                          deleteQuranSession(quranHabit.id, s.id);
                        }
                      }}
                      className="text-muted hover:text-[var(--state-danger)] p-1"
                      title={isAr ? 'حذف الجلسة' : 'Delete session'}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
