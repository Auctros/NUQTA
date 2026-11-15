import { localDateKey, parseDateKey, addDaysToKey } from '../lib/dateKey';
import React, { useEffect, useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { QURAN_SURAHS, TOTAL_QURAN_AYAHS, TOTAL_QURAN_SURAHS, getSurahMeta } from '../lib/quranData';
import { QuranSessionType, QuranRecitationQuality, QuranSurahStatus, SurahMemorizationState } from '../types';
import { Button, NuqtaSelect } from './ui';
import {
  StudioFrame,
  StudioSection,
  StudioStat,
  StudioBars,
  StudioLegend,
  StudioEmpty,
  StudioTab
} from './studios/StudioKit';

type QTab = 'overview' | 'memorize' | 'murajaah' | 'map' | 'history';
type DerivedStatus = QuranSurahStatus | 'overdue';

const isAyahMemorized = (ranges: { start: number; end: number }[] | undefined, n: number): boolean =>
  !!ranges?.some((r) => n >= r.start && n <= r.end);

const daysBetween = (fromKey: string, toKey: string): number => {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

export const QuranView: React.FC = () => {
  const {
    habits,
    createHabit,
    logQuranSession,
    updateQuranRevisionSchedule,
    deleteQuranSession,
    profile,
    setActiveNavTab,
    focusRequest,
    consumeFocus
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const quranHabit = habits.find((h) => h.specializedType === 'quran');
  const quranData = quranHabit?.quranData;

  const [activeTab, setActiveTab] = useState<QTab>('overview');
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRequest || focusRequest.domain !== 'quran') return;
    const id = focusRequest.entityId;
    setActiveTab('map');
    setFocusedEntityId(id);
    consumeFocus();
    window.setTimeout(() => {
      document.getElementById('surah-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
    const timer = window.setTimeout(() => setFocusedEntityId(null), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const [composer, setComposer] = useState<QuranSessionType | null>(null);
  const [sessionType, setSessionType] = useState<QuranSessionType>('new_memorization');
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(quranData?.activeSurahNumber || 2);
  const [ayahStart, setAyahStart] = useState<number>(1);
  const [ayahEnd, setAyahEnd] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [quality, setQuality] = useState<QuranRecitationQuality>('excellent');
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [composerSaved, setComposerSaved] = useState(false);

  const [mapSearch, setMapSearch] = useState<string>('');
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | DerivedStatus>('all');
  const [mapJuzFilter, setMapJuzFilter] = useState<number | 'all'>('all');

  const [targetDailyAyahs, setTargetDailyAyahs] = useState<number>(quranData?.dailyTargetAyahs || 10);
  const [revisionCycleDays, setRevisionCycleDays] = useState<number>(
    quranData?.revisionSchedule?.revisionCycleDays || 7
  );
  const [cadenceSaved, setCadenceSaved] = useState(false);

  const [tasmeeActive, setTasmeeActive] = useState(false);
  const [revealedAyahs, setRevealedAyahs] = useState<number[]>([]);
  const [difficultAyahs, setDifficultAyahs] = useState<number[]>([]);

  const surahsState = quranData?.surahs || [];
  const sessions = quranData?.sessions || [];
  const totalMemorizedAyahs = quranData?.totalAyahsMemorized || 0;
  const totalCompletedSurahs = quranData?.totalSurahsCompleted || 0;
  const percentOfQuran = Math.min(100, Number(((totalMemorizedAyahs / TOTAL_QURAN_AYAHS) * 100).toFixed(2)));
  const cycleDays = quranData?.revisionSchedule?.revisionCycleDays || 7;

  const selectedSurahMeta = getSurahMeta(selectedSurahNumber);
  const selectedSurahState = surahsState.find((s) => s.surahNumber === selectedSurahNumber);

  const stateOf = (n: number): SurahMemorizationState | undefined =>
    surahsState.find((s) => s.surahNumber === n);

  const derivedStatus = (s: SurahMemorizationState | undefined): DerivedStatus => {
    if (!s || s.memorizedAyahsCount === 0) return 'not_started';
    if (s.status === 'needs_revision') return 'needs_revision';
    if (s.lastReviewedDate && daysBetween(s.lastReviewedDate, todayStr) > cycleDays) return 'overdue';
    return s.status;
  };

  const memorizedSurahs = useMemo(() => surahsState.filter((s) => s.memorizedAyahsCount > 0), [surahsState]);

  const overdue = memorizedSurahs.filter((s) => derivedStatus(s) === 'overdue');
  const needsRevision = memorizedSurahs.filter((s) => s.status === 'needs_revision');
  const attention = [...needsRevision, ...overdue.filter((s) => s.status !== 'needs_revision')];

  const reviewedInCycle = memorizedSurahs.filter(
    (s) => s.lastReviewedDate && daysBetween(s.lastReviewedDate, todayStr) <= cycleDays
  );
  const revisionCoverage = memorizedSurahs.length
    ? Math.round((reviewedInCycle.length / memorizedSurahs.length) * 100)
    : 0;

  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const todayAyahs = todaySessions
    .filter((s) => s.type === 'new_memorization')
    .reduce((sum, s) => sum + s.ayahCount, 0);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const assignment = useMemo(() => {
    const meta = getSurahMeta(selectedSurahNumber);
    const st = stateOf(selectedSurahNumber);
    const last = st?.memorizedAyahsRanges?.[st.memorizedAyahsRanges.length - 1];
    const start = last && last.end < meta.totalAyahs ? last.end + 1 : 1;
    const end = Math.min(meta.totalAyahs, start + (quranData?.dailyTargetAyahs || 10) - 1);
    return { meta, start, end };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurahNumber, surahsState, quranData?.dailyTargetAyahs]);

  const revisionQueue = useMemo(
    () =>
      [...memorizedSurahs].sort((a, b) => {
        const ar = a.lastReviewedDate || '0000-00-00';
        const br = b.lastReviewedDate || '0000-00-00';
        return ar < br ? -1 : ar > br ? 1 : 0;
      }),
    [memorizedSurahs]
  );

  const weekly = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysToKey(todayStr, -i);
      const ayahs = sessions
        .filter((s) => s.date === key && s.type === 'new_memorization')
        .reduce((a, s) => a + s.ayahCount, 0);
      const d = parseDateKey(key);
      const label = d ? d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'narrow' }) : '';
      days.push({ label, value: ayahs });
    }
    return days;
  }, [sessions, todayStr, isAr]);

  const filteredSurahs = QURAN_SURAHS.filter((meta) => {
    const st = stateOf(meta.number);
    const status = derivedStatus(st);
    if (mapStatusFilter !== 'all' && status !== mapStatusFilter) return false;
    if (mapJuzFilter !== 'all' && meta.juzStart !== mapJuzFilter) return false;
    if (mapSearch.trim()) {
      const q = mapSearch.trim().toLowerCase();
      const matchAr = meta.nameAr.toLowerCase().includes(q);
      const matchEn = meta.nameEn.toLowerCase().includes(q);
      const matchNum = meta.number.toString() === q;
      if (!matchAr && !matchEn && !matchNum) return false;
    }
    return true;
  });

  const handleInitQuranHabit = () =>
    createHabit({
      name: isAr ? 'حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision',
      anchor: isAr ? 'بعد صلاة الفجر -> أحفظ نصف صفحة وأراجع ورداً' : 'After Fajr prayer -> memorize & review wird',
      category: 'learning',
      timeOfDay: 'morning',
      specializedType: 'quran'
    });

  const openComposer = (type: QuranSessionType, surah = selectedSurahNumber, start?: number, end?: number) => {
    setSessionType(type);
    setSelectedSurahNumber(surah);
    const meta = getSurahMeta(surah);
    if (typeof start === 'number' && typeof end === 'number') {
      setAyahStart(start);
      setAyahEnd(end);
    } else {
      setAyahStart(1);
      setAyahEnd(Math.min(meta.totalAyahs, quranData?.dailyTargetAyahs || 10));
    }
    setMistakesCount(0);
    setSessionNotes('');
    setQuality(type === 'new_memorization' ? 'very_good' : 'good');
    setComposerSaved(false);
    setComposer(type);
  };

  const submitComposer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quranHabit) return;
    const meta = getSurahMeta(selectedSurahNumber);
    const s = Math.max(1, Math.min(meta.totalAyahs, ayahStart));
    const en = Math.max(s, Math.min(meta.totalAyahs, ayahEnd));

    logQuranSession(quranHabit.id, {
      type: sessionType,
      surahNumber: selectedSurahNumber,
      surahName: meta.nameAr,
      ayahStart: s,
      ayahEnd: en,
      ayahCount: en - s + 1,
      durationMinutes,
      quality,
      mistakesCount,
      notes: sessionNotes.trim() || undefined
    });

    setComposerSaved(true);
    window.setTimeout(() => {
      setComposerSaved(false);
      setComposer(null);
      setTasmeeActive(false);
      setRevealedAyahs([]);
      setDifficultAyahs([]);
    }, 900);
  };

  const saveCadence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quranHabit) return;
    updateQuranRevisionSchedule(quranHabit.id, { targetDailyAyahs, revisionCycleDays });
    setCadenceSaved(true);
    window.setTimeout(() => setCadenceSaved(false), 2500);
  };

  if (!quranHabit) {
    return (
      <div className="studio-root" data-studio="quran" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="studio-head">
          <div className="min-w-0">
            <span className="studio-eyebrow">NUQTA / QURAN SANCTUARY</span>
            <h1 className="studio-title mt-1">
              {isAr ? 'استوديو حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision Studio'}
            </h1>
            <p className="studio-lede mt-1">
              {isAr
                ? 'نظام متخصص لحفظ القرآن وتثبيت الورد اليومي بدقة، مع منع احتساب أي آية مرتين.'
                : 'A dedicated workspace for disciplined memorization, precision tracking, and revision cadence.'}
            </p>
          </div>
        </header>
        <StudioSection>
          <StudioEmpty
            icon="book"
            title={isAr ? 'ابدأ رحلتك في حفظ كتاب الله' : 'Initialize your Quran sanctuary'}
            description={
              isAr
                ? 'خريطة تفاعلية لـ 114 سورة، دمج ذكي لنطاقات الآيات، وجدول مراجعة مخصص للحفظ القريب والبعيد.'
                : 'Interactive 114-surah map, strict non-duplicate interval tracking, and a custom revision cadence.'
            }
            action={
              <Button variant="primary" onClick={handleInitQuranHabit}>
                {isAr ? 'تفعيل استوديو القرآن' : 'Enable Quran Studio'}
              </Button>
            }
          />
        </StudioSection>
      </div>
    );
  }

  const tabs: StudioTab[] = [
    { id: 'overview', label: isAr ? 'المتابعة' : 'Overview', icon: 'compass' },
    { id: 'memorize', label: isAr ? 'الحفظ الجديد' : 'Memorize', icon: 'sparkle' },
    { id: 'murajaah', label: isAr ? 'المراجعة والتسميع' : "Muraja'ah", icon: 'repeat', count: attention.length },
    { id: 'map', label: isAr ? 'خريطة المصحف' : 'Quran Map', icon: 'layers' },
    { id: 'history', label: isAr ? 'سجل الجلسات' : 'History', icon: 'history' }
  ];

  const surahLabel = (n: number) => {
    const m = getSurahMeta(n);
    return `${m.number}. ${isAr ? 'سورة ' + m.nameAr : m.nameEn}`;
  };

  return (
    <StudioFrame
      studio="quran"
      eyebrow="NUQTA / QURAN SANCTUARY"
      title={isAr ? 'استوديو حفظ ومراجعة القرآن الكريم' : 'Quran Memorization Studio'}
      description={
        isAr
          ? 'مساحة هادئة للحفظ الجديد، المراجعة المتقنة، وخريطة تقدم على مستوى كل آية.'
          : 'A calm workspace for new memorization, disciplined revision, and ayah-level progress.'
      }
      actions={
        <>
          <Button variant="primary" size="sm" icon="plus" onClick={() => openComposer('new_memorization')}>
            {isAr ? 'جلسة حفظ' : 'Memorize'}
          </Button>
          <Button variant="secondary" size="sm" icon="repeat" onClick={() => openComposer('revision')}>
            {isAr ? 'جلسة مراجعة' : 'Revise'}
          </Button>
          <Button variant="ghost" size="sm" icon="archive" onClick={() => setActiveNavTab('archive')}>
            {isAr ? 'الأرشيف' : 'Archive'}
          </Button>
        </>
      }
      tabs={tabs}
      activeTab={composer ? 'overview' : activeTab}
      onTabChange={(id) => {
        setComposer(null);
        setTasmeeActive(false);
        setActiveTab(id as QTab);
      }}
      navVariant="structured"
      context={
        <span className="text-[var(--fs-micro)] font-mono text-[var(--text-secondary)]">
          {percentOfQuran}% · {totalMemorizedAyahs.toLocaleString()}
        </span>
      }
    >
      {/* ============================ FOCUSED COMPOSER ============================ */}
      {composer && (
        <div className="max-w-3xl mx-auto space-y-[var(--sp-4)]">
          <StudioSection
            title={
              <>
                <span aria-hidden="true">{sessionType === 'new_memorization' ? '✎' : '⟳'}</span>
                {sessionType === 'new_memorization'
                  ? isAr
                    ? 'جلسة حفظ جديد'
                    : 'New memorization session'
                  : sessionType === 'revision'
                  ? isAr
                    ? 'جلسة مراجعة وتثبيت'
                    : 'Revision session'
                  : isAr
                  ? 'جلسة تسميع واختبار'
                  : 'Recitation test'}
              </>
            }
            action={
              <Button variant="ghost" size="sm" icon="close" onClick={() => setComposer(null)}>
                {isAr ? 'إغلاق' : 'Close'}
              </Button>
            }
          >
            <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mb-4">
              {isAr
                ? 'تُدمج نطاقات الآيات تلقائياً فلا تُحتسب أي آية مرتين في إجمالي حفظك.'
                : 'Ayah intervals merge automatically so no ayah is ever double-counted.'}
            </p>

            <form onSubmit={submitComposer} className="space-y-[var(--sp-4)]">
              <div className="grid gap-3 sm:grid-cols-3">
                {(['new_memorization', 'revision', 'recitation_test'] as QuranSessionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={sessionType === t}
                    onClick={() => setSessionType(t)}
                    className="studio-tile text-start transition-colors"
                    style={
                      sessionType === t
                        ? { borderColor: 'var(--studio-accent-line)', background: 'var(--studio-accent-soft)' }
                        : undefined
                    }
                  >
                    <span className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-primary)] block">
                      {t === 'new_memorization'
                        ? isAr
                          ? 'حفظ جديد'
                          : 'New memorization'
                        : t === 'revision'
                        ? isAr
                          ? 'مراجعة وتثبيت'
                          : 'Revision'
                        : isAr
                        ? 'تسميع واختبار'
                        : 'Recitation test'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'السورة' : 'Surah'}
                  </span>
                  <NuqtaSelect value={selectedSurahNumber} onChange={(e) => {
                      const n = Number(e.target.value);
                      setSelectedSurahNumber(n);
                      const meta = getSurahMeta(n);
                      setAyahStart(1);
                      setAyahEnd(Math.min(meta.totalAyahs, quranData?.dailyTargetAyahs || 10));
                    }} className="text-[var(--fs-xs)] font-[var(--fw-semibold)]">

                    {QURAN_SURAHS.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {s.nameAr} ({s.nameEn}) — {s.totalAyahs} {isAr ? 'آية' : 'ayahs'}
                      </option>
                    ))}
                  </NuqtaSelect>
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'من آية' : 'From ayah'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={selectedSurahMeta.totalAyahs}
                    value={ayahStart}
                    onChange={(e) => setAyahStart(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                    required
                  />
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'إلى آية' : 'To ayah'}
                  </span>
                  <input
                    type="number"
                    min={ayahStart}
                    max={selectedSurahMeta.totalAyahs}
                    value={ayahEnd}
                    onChange={(e) => setAyahEnd(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'المدة (دقائق)' : 'Duration (min)'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                    required
                  />
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'الإتقان' : 'Quality'}
                  </span>
                  <NuqtaSelect value={quality} onChange={(e) => setQuality(e.target.value as QuranRecitationQuality)} className="text-[var(--fs-xs)]">
                    <option value="excellent">{isAr ? 'متقن كالفاتحة' : 'Excellent'}</option>
                    <option value="very_good">{isAr ? 'جيد جداً' : 'Very good'}</option>
                    <option value="good">{isAr ? 'جيد' : 'Good'}</option>
                    <option value="needs_reinforcement">{isAr ? 'يحتاج إعادة وضبط' : 'Needs reinforcement'}</option>
                  </NuqtaSelect>
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'عدد الأخطاء' : 'Mistakes'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={mistakesCount}
                    onChange={(e) => setMistakesCount(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                  />
                </label>
              </div>

              <label className="field block">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'ملاحظات التدبر والمتشابهات' : 'Reflections / difficult passages'}
                </span>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={2}
                  className="textarea w-full text-[var(--fs-xs)]"
                  placeholder={isAr ? 'موضع تشابه، وقفة تدبر...' : 'Notes on difficult passages or reflections...'}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--studio-line)]">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] font-mono">
                  {isAr ? 'عدد الآيات في الجلسة:' : 'Ayahs in session:'}{' '}
                  <strong className="text-[var(--studio-accent)]">
                    {Math.max(1, Math.min(selectedSurahMeta.totalAyahs, ayahEnd) - Math.max(1, ayahStart) + 1)}
                  </strong>
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setComposer(null)}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button variant="primary" size="sm" type="submit" icon="check">
                    {isAr ? 'حفظ الجلسة' : 'Save session'}
                  </Button>
                </div>
              </div>
              {composerSaved && (
                <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)]">
                  {isAr ? 'تم تسجيل الجلسة وتحديث تقدمك.' : 'Session recorded and progress updated.'}
                </p>
              )}
            </form>
          </StudioSection>
        </div>
      )}

      {/* ============================ OVERVIEW ============================ */}
      {!composer && activeTab === 'overview' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] lg:grid-cols-3">
            <StudioSection className="lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  <div className="relative grid place-items-center" style={{ width: 132, height: 132 }}>
                    <svg width={132} height={132} className="-rotate-90" aria-hidden="true">
                      <circle cx={66} cy={66} r={58} fill="none" strokeWidth={10} stroke="var(--surface-track)" />
                      <circle
                        cx={66}
                        cy={66}
                        r={58}
                        fill="none"
                        strokeWidth={10}
                        strokeLinecap="round"
                        stroke="var(--studio-accent)"
                        strokeDasharray={2 * Math.PI * 58}
                        strokeDashoffset={2 * Math.PI * 58 * (1 - percentOfQuran / 100)}
                        style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-standard)' }}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="text-[var(--fs-2xl)] font-[var(--fw-heavy)] tabular-nums text-[var(--studio-accent)]">
                        {percentOfQuran}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[var(--fs-xs)] uppercase tracking-wider text-[var(--text-tertiary)] font-mono">
                    {isAr ? 'إجمالي المحفوظ' : 'Total memorized'}
                  </p>
                  <p className="text-[var(--fs-xl)] font-[var(--fw-heavy)] text-[var(--text-primary)] tabular-nums">
                    {totalMemorizedAyahs.toLocaleString()}
                    <span className="text-[var(--fs-sm)] text-[var(--text-secondary)] font-normal">
                      {' '}
                      / {TOTAL_QURAN_AYAHS.toLocaleString()} {isAr ? 'آية' : 'ayahs'}
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <StudioStat
                      label={isAr ? 'سور مكتملة' : 'Surahs done'}
                      value={totalCompletedSurahs}
                      hint={`/ ${TOTAL_QURAN_SURAHS}`}
                    />
                    <StudioStat
                      label={isAr ? 'آيات متبقية' : 'Remaining'}
                      value={(TOTAL_QURAN_AYAHS - totalMemorizedAyahs).toLocaleString()}
                    />
                    <StudioStat
                      label={isAr ? 'تغطية المراجعة' : 'Revision cover'}
                      value={`${revisionCoverage}%`}
                      tone="accent"
                    />
                  </div>
                </div>
              </div>
            </StudioSection>

            <StudioSection title={isAr ? 'ورد الحفظ اليوم' : "Today's memorization"}>
              <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">
                {surahLabel(assignment.meta.number)}
              </p>
              <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mt-0.5 font-mono">
                {isAr ? 'الآيات' : 'Ayahs'} {assignment.start}–{assignment.end}
                {' · '}
                {assignment.end - assignment.start + 1} {isAr ? 'آية' : 'ayahs'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon="sparkle"
                  onClick={() =>
                    openComposer('new_memorization', assignment.meta.number, assignment.start, assignment.end)
                  }
                >
                  {isAr ? 'بدء الحفظ' : 'Start memorizing'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('memorize')}>
                  {isAr ? 'تعديل النطاق' : 'Adjust range'}
                </Button>
              </div>
              <p className="text-[var(--fs-micro)] text-[var(--text-tertiary)] mt-3">
                {isAr
                  ? `الهدف اليومي: ${quranData?.dailyTargetAyahs || 10} آية`
                  : `Daily target: ${quranData?.dailyTargetAyahs || 10} ayahs`}
              </p>
            </StudioSection>
          </div>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-3">
            <StudioSection
              className="lg:col-span-2"
              title={isAr ? 'مراجعة اليوم' : "Today's revision"}
              action={
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('murajaah')}>
                  {isAr ? 'كل المراجعة' : 'All revision'}
                </Button>
              }
            >
              {revisionQueue.length === 0 ? (
                <StudioEmpty
                  icon="repeat"
                  title={isAr ? 'لا توجد سور للمراجعة بعد' : 'Nothing to revise yet'}
                  description={
                    isAr ? 'ابدأ بالحفظ الجديد لتظهر سور المراجعة هنا.' : 'Start memorizing and revision will appear here.'
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {revisionQueue.slice(0, 4).map((s) => {
                    const meta = getSurahMeta(s.surahNumber);
                    const d = derivedStatus(s);
                    return (
                      <li key={s.surahNumber}>
                        <button
                          type="button"
                          onClick={() => openComposer('revision', s.surahNumber, 1, Math.min(meta.totalAyahs, 10))}
                          className="w-full text-start studio-tile flex items-center justify-between gap-3 hover:border-[var(--studio-accent-line)] transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">
                              {surahLabel(s.surahNumber)}
                            </span>
                            <span className="block text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                              {s.memorizedAyahsCount} {isAr ? 'آية محفوظة' : 'ayahs'} ·{' '}
                              {s.lastReviewedDate
                                ? `${isAr ? 'آخر مراجعة' : 'last'} ${s.lastReviewedDate}`
                                : isAr
                                ? 'لم تُراجع'
                                : 'never reviewed'}
                            </span>
                          </span>
                          <StatusBadge status={d} isAr={isAr} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </StudioSection>

            <StudioSection title={isAr ? 'يحتاج انتباهك' : 'Needs attention'}>
              {attention.length === 0 ? (
                <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                  {isAr ? 'كل المحفوظ داخل دورة المراجعة. أحسنت.' : 'All memorized portions are within cadence.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {attention.slice(0, 5).map((s) => (
                    <li key={s.surahNumber} className="flex items-center justify-between gap-2">
                      <span className="text-[var(--fs-xs)] text-[var(--text-primary)] truncate">
                        {surahLabel(s.surahNumber)}
                      </span>
                      <StatusBadge status={derivedStatus(s)} isAr={isAr} />
                    </li>
                  ))}
                </ul>
              )}
            </StudioSection>
          </div>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-3">
            <StudioSection title={isAr ? 'الحفظ هذا الأسبوع' : 'This week'}>
              <StudioBars data={weekly} unit={isAr ? 'آية' : 'ayahs'} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <StudioStat label={isAr ? 'آيات اليوم' : 'Ayahs today'} value={todayAyahs} tone="accent" />
                <StudioStat label={isAr ? 'دقائق اليوم' : 'Minutes today'} value={todayMinutes} />
              </div>
            </StudioSection>

            <StudioSection
              className="lg:col-span-2"
              title={isAr ? 'آخر النشاط' : 'Recent activity'}
              action={
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('history')}>
                  {isAr ? 'السجل' : 'History'}
                </Button>
              }
            >
              {sessions.length === 0 ? (
                <StudioEmpty icon="history" title={isAr ? 'لا توجد جلسات بعد' : 'No sessions yet'} />
              ) : (
                <ul className="space-y-2">
                  {sessions.slice(0, 5).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 text-[var(--fs-xs)] border-b border-[var(--studio-line)] last:border-0 pb-2 last:pb-0"
                    >
                      <span className="min-w-0">
                        <span className="block text-[var(--text-primary)] font-[var(--fw-semibold)] truncate">
                          {isAr ? `سورة ${s.surahName}` : getSurahMeta(s.surahNumber).nameEn} · {s.ayahStart}–{s.ayahEnd}
                        </span>
                        <span className="block text-[var(--text-secondary)] font-mono">
                          {s.date} · {s.durationMinutes}m
                        </span>
                      </span>
                      <QualityTag quality={s.quality} isAr={isAr} />
                    </li>
                  ))}
                </ul>
              )}
            </StudioSection>
          </div>

          <StudioSection title={isAr ? 'إيقاع الورد والمراجعة' : 'Revision cadence'}>
            <form onSubmit={saveCadence} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'هدف الحفظ اليومي (آيات)' : 'Daily new ayahs'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={targetDailyAyahs}
                  onChange={(e) => setTargetDailyAyahs(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'دورة المراجعة الشاملة (أيام)' : 'Full revision cycle (days)'}
                </span>
                <NuqtaSelect value={revisionCycleDays} onChange={(e) => setRevisionCycleDays(Number(e.target.value))} className="text-[var(--fs-xs)]">
                  <option value={7}>{isAr ? 'كل 7 أيام' : 'Every 7 days'}</option>
                  <option value={14}>{isAr ? 'كل 14 يوماً' : 'Every 14 days'}</option>
                  <option value={30}>{isAr ? 'كل 30 يوماً' : 'Every 30 days'}</option>
                </NuqtaSelect>
              </label>
              <Button variant="secondary" size="sm" type="submit">
                {isAr ? 'حفظ الإيقاع' : 'Save cadence'}
              </Button>
            </form>
            {cadenceSaved && (
              <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
                {isAr ? 'تم تحديث الإيقاع.' : 'Cadence updated.'}
              </p>
            )}
          </StudioSection>
        </div>
      )}

      {/* ============================ MEMORIZE ============================ */}
      {!composer && activeTab === 'memorize' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'اختر السورة والنطاق' : 'Choose surah and range'}>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] items-end">
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'السورة' : 'Surah'}
                </span>
                <NuqtaSelect value={selectedSurahNumber} onChange={(e) => {
                    const n = Number(e.target.value);
                    setSelectedSurahNumber(n);
                    const meta = getSurahMeta(n);
                    const st = stateOf(n);
                    const last = st?.memorizedAyahsRanges?.[st.memorizedAyahsRanges.length - 1];
                    const start = last && last.end < meta.totalAyahs ? last.end + 1 : 1;
                    setAyahStart(start);
                    setAyahEnd(Math.min(meta.totalAyahs, start + (quranData?.dailyTargetAyahs || 10) - 1));
                  }} className="text-[var(--fs-xs)] font-[var(--fw-semibold)]">

                  {QURAN_SURAHS.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number}. {s.nameAr} ({s.nameEn}) — {s.totalAyahs} {isAr ? 'آية' : 'ayahs'}
                    </option>
                  ))}
                </NuqtaSelect>
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'من آية' : 'From'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={selectedSurahMeta.totalAyahs}
                  value={ayahStart}
                  onChange={(e) => setAyahStart(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                  {isAr ? 'إلى آية' : 'To'}
                </span>
                <input
                  type="number"
                  min={ayahStart}
                  max={selectedSurahMeta.totalAyahs}
                  value={ayahEnd}
                  onChange={(e) => setAyahEnd(Number(e.target.value))}
                  className="input w-full font-mono tabular-nums"
                />
              </label>
              <Button
                variant="primary"
                size="sm"
                icon="sparkle"
                onClick={() => openComposer('new_memorization', selectedSurahNumber, ayahStart, ayahEnd)}
              >
                {isAr ? 'بدء الجلسة' : 'Start'}
              </Button>
            </div>
          </StudioSection>

          <StudioSection title={surahLabel(selectedSurahNumber)}>
            <SurahProgressDetail
              meta={selectedSurahMeta}
              state={selectedSurahState}
              isAr={isAr}
              cycleDays={cycleDays}
              todayStr={todayStr}
            />
          </StudioSection>
        </div>
      )}

      {/* ============================ MURAJA'AH + TASMEE ============================ */}
      {!composer && activeTab === 'murajaah' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="studio-legend">
              <span className="studio-legend-item">
                <StatusBadge status="needs_revision" isAr={isAr} />
              </span>
              <span className="studio-legend-item">
                <StatusBadge status="overdue" isAr={isAr} />
              </span>
            </div>
            <Button
              variant={tasmeeActive ? 'primary' : 'secondary'}
              size="sm"
              icon="eye"
              onClick={() => setTasmeeActive((v) => !v)}
            >
              {tasmeeActive ? (isAr ? 'إنهاء التسميع' : 'End recall') : isAr ? 'وضع التسميع' : 'Recall mode'}
            </Button>
          </div>

          {tasmeeActive && (
            <StudioSection
              title={isAr ? 'التسميع الذاتي — اختبر حفظك' : 'Self recall — test your memory'}
              action={
                <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                  {surahLabel(selectedSurahNumber)} · {ayahStart}–{ayahEnd}
                </span>
              }
            >
              <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mb-3">
                {isAr
                  ? 'اضغط على رقم الآية لتكشفها تدريجياً، وانقر بالزر الأيمن لتعليم آية متعثرة لتُسجَّل كخطأ.'
                  : 'Tap an ayah to reveal it progressively; right-click to flag a difficult ayah (recorded as a mistake).'}
              </p>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr] items-end mb-4">
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'السورة' : 'Surah'}
                  </span>
                  <NuqtaSelect value={selectedSurahNumber} onChange={(e) => {
                      const n = Number(e.target.value);
                      setSelectedSurahNumber(n);
                      setRevealedAyahs([]);
                      setDifficultAyahs([]);
                      setAyahStart(1);
                      setAyahEnd(Math.min(getSurahMeta(n).totalAyahs, 10));
                    }} className="text-[var(--fs-xs)]">

                    {QURAN_SURAHS.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {s.nameAr}
                      </option>
                    ))}
                  </NuqtaSelect>
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'من' : 'From'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={selectedSurahMeta.totalAyahs}
                    value={ayahStart}
                    onChange={(e) => setAyahStart(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                  />
                </label>
                <label className="field">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">
                    {isAr ? 'إلى' : 'To'}
                  </span>
                  <input
                    type="number"
                    min={ayahStart}
                    max={selectedSurahMeta.totalAyahs}
                    value={ayahEnd}
                    onChange={(e) => setAyahEnd(Number(e.target.value))}
                    className="input w-full font-mono tabular-nums"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRevealedAyahs(
                      Array.from({ length: Math.max(0, ayahEnd - ayahStart + 1) }, (_, i) => ayahStart + i)
                    )
                  }
                >
                  {isAr ? 'اكشف الكل' : 'Reveal all'}
                </Button>
                <Button variant="ghost" size="sm" icon="eyeOff" onClick={() => setRevealedAyahs([])}>
                  {isAr ? 'أخفِ الكل' : 'Hide all'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.max(0, ayahEnd - ayahStart + 1) }, (_, i) => ayahStart + i).map((n) => {
                  const revealed = revealedAyahs.includes(n);
                  const difficult = difficultAyahs.includes(n);
                  const memorized = isAyahMemorized(selectedSurahState?.memorizedAyahsRanges, n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRevealedAyahs((prev) => (prev.includes(n) ? prev : [...prev, n]))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setDifficultAyahs((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
                      }}
                      aria-pressed={difficult}
                      aria-label={
                        difficult
                          ? `${n} — ${isAr ? 'آية متعثرة' : 'difficult ayah'}`
                          : `${n} — ${isAr ? 'اضغط للكشف' : 'tap to reveal'}`
                      }
                      className="w-12 h-12 rounded-[var(--r-sm)] border font-mono font-[var(--fw-bold)] grid place-items-center transition-colors"
                      style={{
                        borderColor: difficult
                          ? 'var(--state-danger)'
                          : memorized
                          ? 'var(--studio-accent-line)'
                          : 'var(--studio-line)',
                        background: difficult
                          ? 'color-mix(in srgb, var(--state-danger) 16%, transparent)'
                          : revealed
                          ? 'var(--studio-accent-soft)'
                          : 'var(--surface-track)',
                        color: 'var(--text-primary)'
                      }}
                      title={
                        difficult
                          ? isAr
                            ? 'آية متعثرة — انقر بالزر الأيمن للتغيير'
                            : 'Difficult — right-click to toggle'
                          : revealed
                          ? String(n)
                          : isAr
                          ? 'اضغط للكشف'
                          : 'Tap to reveal'
                      }
                    >
                      {revealed ? n : '؟'}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--studio-line)]">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                  {isAr ? 'آيات متعثرة:' : 'Difficult ayahs:'}{' '}
                  <strong className="text-[var(--state-danger)]">{difficultAyahs.length}</strong>
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon="check"
                  onClick={() => {
                    setMistakesCount(difficultAyahs.length);
                    setSessionNotes(
                      difficultAyahs.length
                        ? isAr
                          ? `آيات متعثرة: ${difficultAyahs.join('، ')}`
                          : `Difficult ayahs: ${difficultAyahs.join(', ')}`
                        : ''
                    );
                    openComposer('recitation_test', selectedSurahNumber, ayahStart, ayahEnd);
                  }}
                >
                  {isAr ? 'تسجيل التسميع' : 'Log recitation test'}
                </Button>
              </div>
            </StudioSection>
          )}

          <StudioSection
            title={isAr ? 'قائمة المراجعة' : 'Revision queue'}
            action={
              <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                {isAr ? 'دورة' : 'cycle'} {cycleDays}d
              </span>
            }
          >
            {revisionQueue.length === 0 ? (
              <StudioEmpty icon="repeat" title={isAr ? 'لا توجد سور للمراجعة' : 'Nothing to revise'} />
            ) : (
              <ul className="space-y-2">
                {revisionQueue.map((s) => {
                  const meta = getSurahMeta(s.surahNumber);
                  return (
                    <li key={s.surahNumber} className="studio-tile">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">
                            {surahLabel(s.surahNumber)}
                          </p>
                          <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                            {s.memorizedAyahsCount}/{meta.totalAyahs} {isAr ? 'آية' : 'ayahs'}
                            {s.masteryRating ? ` · ${isAr ? 'إتقان' : 'mastery'} ${s.masteryRating}/5` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={derivedStatus(s)} isAr={isAr} />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openComposer('revision', s.surahNumber, 1, Math.min(meta.totalAyahs, 10))}
                          >
                            {isAr ? 'راجع' : 'Revise'}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </StudioSection>
        </div>
      )}

      {/* ============================ QURAN MAP ============================ */}
      {!composer && activeTab === 'map' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-[180px] flex-1 max-w-sm">
                <span aria-hidden="true">🔍</span>
                <input
                  type="search"
                  value={mapSearch}
                  onChange={(e) => setMapSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم السورة أو رقمها…' : 'Search surah name or number…'}
                  className="input w-full text-[var(--fs-xs)]"
                />
              </div>
              <NuqtaSelect value={mapJuzFilter} onChange={(e) => setMapJuzFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-[var(--fs-xs)]">
                <option value="all">{isAr ? 'جميع الأجزاء (1-30)' : 'All Juz'}</option>
                {Array.from({ length: 30 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {isAr ? `الجزء ${i + 1}` : `Juz ${i + 1}`}
                  </option>
                ))}
              </NuqtaSelect>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', isAr ? 'الكل' : 'All'],
                  ['completed', isAr ? 'محفوظة' : 'Memorized'],
                  ['in_progress', isAr ? 'قيد الحفظ' : 'In progress'],
                  ['needs_revision', isAr ? 'تحتاج مراجعة' : 'Needs revision'],
                  ['overdue', isAr ? 'متأخرة' : 'Overdue'],
                  ['not_started', isAr ? 'لم تبدأ' : 'Not started']
                ] as [('all' | DerivedStatus), string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mapStatusFilter === id}
                  onClick={() => setMapStatusFilter(id)}
                  className="px-3 h-8 rounded-[var(--r-full)] border text-[var(--fs-xs)] transition-colors"
                  style={
                    mapStatusFilter === id
                      ? {
                          borderColor: 'var(--studio-accent-line)',
                          background: 'var(--studio-accent-soft)',
                          color: 'var(--studio-accent-ink)'
                        }
                      : { borderColor: 'var(--studio-line)', color: 'var(--text-secondary)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--studio-line)]">
              <StudioLegend
                entries={[
                  { label: isAr ? 'محفوظة' : 'Memorized', swatch: 'var(--state-success)', glyph: '✓' },
                  { label: isAr ? 'قيد الحفظ' : 'In progress', swatch: 'var(--state-info)', glyph: '◐' },
                  { label: isAr ? 'تحتاج مراجعة' : 'Needs revision', swatch: 'var(--state-warning)', glyph: '!' },
                  { label: isAr ? 'متأخرة' : 'Overdue', swatch: 'var(--state-danger)', glyph: '⏱' },
                  { label: isAr ? 'لم تبدأ' : 'Not started', swatch: 'var(--surface-track)', glyph: '·' }
                ]}
              />
            </div>
          </StudioSection>

          <StudioSection
            title={isAr ? 'خريطة 114 سورة' : 'Map of 114 surahs'}
            action={
              <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                {filteredSurahs.length} / {TOTAL_QURAN_SURAHS}
              </span>
            }
          >
            <div className="quran-map">
              {filteredSurahs.map((meta) => {
                const st = stateOf(meta.number);
                const status = derivedStatus(st);
                const count = st?.memorizedAyahsCount || 0;
                const pct = Math.min(100, Math.round((count / meta.totalAyahs) * 100));
                const glyph =
                  status === 'completed'
                    ? '✓'
                    : status === 'needs_revision'
                    ? '!'
                    : status === 'overdue'
                    ? '⏱'
                    : status === 'in_progress'
                    ? '◐'
                    : '';
                return (
                  <button
                    key={meta.number}
                    id={'surah-' + meta.number}
                    type="button"
                    data-status={status}
                    onClick={() => {
                      setSelectedSurahNumber(meta.number);
                      setActiveTab('memorize');
                    }}
                    className={`quran-cell ${focusedEntityId === String(meta.number) ? 'focus-flash' : ''}`}
                    title={`${meta.nameAr} — ${count}/${meta.totalAyahs} (${pct}%)`}
                    aria-label={`${isAr ? 'سورة' : 'Surah'} ${meta.nameAr}, ${count}/${meta.totalAyahs}, ${statusLabel(
                      status,
                      isAr
                    )}`}
                  >
                    {pct > 0 && <span className="quran-cell-fill" style={{ height: `${pct}%` }} />}
                    {glyph && (
                      <span className="quran-cell-flag" aria-hidden="true">
                        {glyph}
                      </span>
                    )}
                    <span className="quran-cell-num relative">{meta.number}</span>
                    <span className="quran-cell-name relative">{meta.nameAr}</span>
                  </button>
                );
              })}
            </div>
          </StudioSection>
        </div>
      )}

      {/* ============================ HISTORY ============================ */}
      {!composer && activeTab === 'history' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-4">
            <StudioStat label={isAr ? 'إجمالي الجلسات' : 'Total sessions'} value={sessions.length} icon="history" />
            <StudioStat
              label={isAr ? 'جلسات الحفظ' : 'Memorization'}
              value={sessions.filter((s) => s.type === 'new_memorization').length}
            />
            <StudioStat
              label={isAr ? 'جلسات المراجعة' : 'Revision'}
              value={sessions.filter((s) => s.type === 'revision').length}
            />
            <StudioStat
              label={isAr ? 'دقائق الحفظ' : 'Memorization minutes'}
              value={quranData?.totalMemorizationMinutes || 0}
              tone="accent"
            />
          </div>

          <StudioSection title={isAr ? 'سجل الجلسات' : 'Session history'}>
            {sessions.length === 0 ? (
              <StudioEmpty
                icon="history"
                title={isAr ? 'لا توجد جلسات بعد' : 'No sessions recorded'}
                action={
                  <Button variant="primary" size="sm" icon="plus" onClick={() => openComposer('new_memorization')}>
                    {isAr ? 'أول جلسة' : 'First session'}
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="studio-tile flex flex-wrap items-center justify-between gap-3 text-[var(--fs-xs)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[var(--text-primary)] font-[var(--fw-semibold)] truncate">
                        {isAr ? `سورة ${s.surahName}` : getSurahMeta(s.surahNumber).nameEn} · {s.ayahStart}–{s.ayahEnd}
                      </p>
                      <p className="text-[var(--text-secondary)] font-mono mt-0.5">
                        {s.date} · {s.ayahCount} {isAr ? 'آية' : 'ayahs'} · {s.durationMinutes}m
                        {s.mistakesCount ? ` · ${s.mistakesCount} ${isAr ? 'أخطاء' : 'mistakes'}` : ''}
                        {' · '}
                        {s.type === 'new_memorization'
                          ? isAr
                            ? 'حفظ'
                            : 'Memorize'
                          : s.type === 'revision'
                          ? isAr
                            ? 'مراجعة'
                            : 'Revision'
                          : isAr
                          ? 'تسميع'
                          : 'Test'}
                      </p>
                      {s.notes && <p className="text-[var(--text-tertiary)] italic mt-1">“{s.notes}”</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <QualityTag quality={s.quality} isAr={isAr} />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="trash"
                        aria-label={isAr ? 'حذف الجلسة' : 'Delete session'}
                        onClick={() => {
                          if (confirm(isAr ? 'هل تريد حذف هذه الجلسة من السجل؟' : 'Delete this session?')) {
                            deleteQuranSession(quranHabit.id, s.id);
                          }
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>
        </div>
      )}
    </StudioFrame>
  );
};

/* ---------------- local presentational helpers ---------------- */

const statusLabel = (s: DerivedStatus, isAr: boolean): string => {
  const map: Record<DerivedStatus, [string, string]> = {
    completed: ['محفوظة', 'Memorized'],
    in_progress: ['قيد الحفظ', 'In progress'],
    needs_revision: ['تحتاج مراجعة', 'Needs revision'],
    overdue: ['متأخرة', 'Overdue'],
    not_started: ['لم تبدأ', 'Not started']
  };
  return isAr ? map[s][0] : map[s][1];
};

const StatusBadge: React.FC<{ status: DerivedStatus; isAr: boolean }> = ({ status, isAr }) => {
  const tone: Record<DerivedStatus, string> = {
    completed: 'var(--state-success)',
    in_progress: 'var(--state-info)',
    needs_revision: 'var(--state-warning)',
    overdue: 'var(--state-danger)',
    not_started: 'var(--text-tertiary)'
  };
  const glyph: Record<DerivedStatus, string> = {
    completed: '✓',
    in_progress: '◐',
    needs_revision: '!',
    overdue: '⏱',
    not_started: '·'
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 h-6 rounded-[var(--r-full)] border text-[var(--fs-micro)] font-[var(--fw-semibold)] shrink-0"
      style={{
        color: tone[status],
        borderColor: 'color-mix(in srgb, ' + tone[status] + ' 45%, transparent)',
        background: 'color-mix(in srgb, ' + tone[status] + ' 12%, transparent)'
      }}
    >
      <span aria-hidden="true">{glyph[status]}</span>
      {statusLabel(status, isAr)}
    </span>
  );
};

const QualityTag: React.FC<{ quality: QuranRecitationQuality; isAr: boolean }> = ({ quality, isAr }) => {
  const map: Record<QuranRecitationQuality, [string, string, string]> = {
    excellent: ['ممتاز', 'Excellent', 'var(--state-success)'],
    very_good: ['جيد جداً', 'Very good', 'var(--state-info)'],
    good: ['جيد', 'Good', 'var(--state-warning)'],
    needs_reinforcement: ['يحتاج ضبطاً', 'Needs work', 'var(--state-danger)']
  };
  const [ar, en, color] = map[quality];
  return (
    <span
      className="px-2 h-6 inline-flex items-center rounded-[var(--r-full)] border text-[var(--fs-micro)] font-[var(--fw-semibold)]"
      style={{ color, borderColor: 'color-mix(in srgb, ' + color + ' 45%, transparent)' }}
    >
      {isAr ? ar : en}
    </span>
  );
};

const SurahProgressDetail: React.FC<{
  meta: ReturnType<typeof getSurahMeta>;
  state?: SurahMemorizationState;
  isAr: boolean;
  cycleDays: number;
  todayStr: string;
}> = ({ meta, state, isAr, cycleDays, todayStr }) => {
  const count = state?.memorizedAyahsCount || 0;
  const pct = Math.min(100, Math.round((count / meta.totalAyahs) * 100));
  const overdue = state?.lastReviewedDate ? daysBetween(state.lastReviewedDate, todayStr) > cycleDays : false;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[var(--fs-xs)]">
        <span className="text-[var(--text-secondary)]">{isAr ? 'الآيات المحفوظة' : 'Ayahs memorized'}</span>
        <span className="font-mono text-[var(--studio-accent)] font-[var(--fw-bold)]">
          {count} / {meta.totalAyahs} ({pct}%)
        </span>
      </div>
      <div className="w-full h-2 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden">
        <div
          className="h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${pct}%`, background: 'var(--studio-accent)' }}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3 text-[var(--fs-xs)]">
        <div className="studio-tile">
          <span className="block text-[var(--text-secondary)]">{isAr ? 'مكان النزول' : 'Revelation'}</span>
          <strong className="text-[var(--text-primary)]">
            {meta.place === 'makkah' ? (isAr ? 'مكية' : 'Meccan') : isAr ? 'مدنية' : 'Medinan'}
          </strong>
        </div>
        <div className="studio-tile">
          <span className="block text-[var(--text-secondary)]">{isAr ? 'الجزء' : 'Juz'}</span>
          <strong className="text-[var(--text-primary)] font-mono">{meta.juzStart}</strong>
        </div>
        <div className="studio-tile">
          <span className="block text-[var(--text-secondary)]">{isAr ? 'آخر مراجعة' : 'Last reviewed'}</span>
          <strong className={overdue ? 'text-[var(--state-danger)]' : 'text-[var(--text-primary)]'}>
            {state?.lastReviewedDate || (isAr ? 'لم تُراجع' : 'Never')}
            {overdue ? (isAr ? ' (متأخرة)' : ' (overdue)') : ''}
          </strong>
        </div>
      </div>
      {state?.memorizedAyahsRanges && state.memorizedAyahsRanges.length > 0 && (
        <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
          {isAr ? 'نطاقات الحفظ:' : 'Ranges:'}{' '}
          {state.memorizedAyahsRanges.map((r) => `[${r.start}-${r.end}]`).join(isAr ? ' ، ' : ', ')}
        </p>
      )}
    </div>
  );
};
