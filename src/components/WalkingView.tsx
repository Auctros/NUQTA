import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { Button, Field, Input, Textarea } from './ui';
import { StudioFrame, StudioSection, StudioStat, StudioBars, StudioEmpty, StudioTab } from './studios/StudioKit';
import { WalkingScene } from './walking/WalkingScene';
import { readActiveWalk, writeActiveWalk } from '../lib/uiPrefs';
import {
  ActiveWalk,
  computeWalkingStats,
  elapsedSeconds,
  formatDuration,
  formatMinutes,
  pauseWalk,
  pausedSeconds,
  resumeWalk,
  startWalk,
  weekSeries
} from '../lib/walking';

type WTab = 'walk' | 'history' | 'progress';

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatClock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const WalkingView: React.FC = () => {
  const {
    habits,
    createHabit,
    profile,
    logWalkingSession,
    deleteWalkingSession,
    updateWalkingTargets
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';

  const walkingHabit = habits.find((h) => h.specializedType === 'walking');
  const walkingData = walkingHabit?.walkingData;

  const [activeTab, setActiveTab] = useState<WTab>('walk');

  /* ---------------- live session ---------------- */
  const [walk, setWalk] = useState<ActiveWalk | null>(() => readActiveWalk<ActiveWalk>());
  const [now, setNow] = useState(() => Date.now());

  // The tick only re-renders the readout; the value itself is recomputed from
  // timestamps, so a throttled or skipped tick cannot lose time.
  useEffect(() => {
    if (!walk || walk.pausedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [walk]);

  useEffect(() => {
    writeActiveWalk(walk);
  }, [walk]);

  const seconds = walk ? elapsedSeconds(walk, now) : 0;
  const isRunning = walk !== null && walk.pausedAt === null;
  const isPaused = walk !== null && walk.pausedAt !== null;

  /* ---------------- optional manual metrics ---------------- */
  const [distanceInput, setDistanceInput] = useState('');
  const [stepsInput, setStepsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [targetDraft, setTargetDraft] = useState(() => String(walkingData?.weeklyTargetMinutes ?? 150));
  const [targetSaved, setTargetSaved] = useState(false);

  useEffect(() => {
    setTargetDraft(String(walkingData?.weeklyTargetMinutes ?? 150));
  }, [walkingData?.weeklyTargetMinutes]);

  const stats = useMemo(() => computeWalkingStats(walkingData), [walkingData]);
  const weekBars = useMemo(() => weekSeries(walkingData, isAr), [walkingData, isAr]);

  const handleStart = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setWalk(startWalk(t));
  }, []);

  const handlePause = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setWalk((w) => (w ? pauseWalk(w, t) : w));
  }, []);

  const handleResume = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setWalk((w) => (w ? resumeWalk(w, t) : w));
  }, []);

  const handleDiscard = useCallback(() => {
    setWalk(null);
    setDistanceInput('');
    setStepsInput('');
    setNotes('');
  }, []);

  const handleFinish = useCallback(() => {
    if (!walk || !walkingHabit) return;
    const t = Date.now();
    const total = elapsedSeconds(walk, t);
    if (total < 1) return;

    const km = Number.parseFloat(distanceInput);
    const stepCount = Number.parseInt(stepsInput, 10);

    logWalkingSession(walkingHabit.id, {
      // Only what the user actually typed. Blank stays blank.
      distanceKm: Number.isFinite(km) && km > 0 ? Math.round(km * 100) / 100 : undefined,
      steps: Number.isFinite(stepCount) && stepCount > 0 ? Math.round(stepCount) : undefined,
      notes: notes.trim() || undefined,
      startedAt: new Date(t - total * 1000).toISOString(),
      endedAt: new Date(t).toISOString(),
      durationSeconds: total,
      pausedSeconds: pausedSeconds(walk, t)
    });

    setWalk(null);
    setDistanceInput('');
    setStepsInput('');
    setNotes('');
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2600);
  }, [walk, walkingHabit, distanceInput, stepsInput, notes, logWalkingSession]);

  const handleInit = useCallback(() => {
    createHabit({
      name: isAr ? 'مشي يومي' : 'Daily Walk',
      anchor: isAr ? 'بعد الغداء -> أمشي 20 دقيقة' : 'After lunch -> walk 20 minutes',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    });
  }, [createHabit, isAr]);

  const handleSaveTarget = useCallback(() => {
    if (!walkingHabit) return;
    const value = Number.parseInt(targetDraft, 10);
    if (!Number.isFinite(value) || value < 10 || value > 2000) return;
    updateWalkingTargets(walkingHabit.id, { weeklyTargetMinutes: value });
    setTargetSaved(true);
    window.setTimeout(() => setTargetSaved(false), 2000);
  }, [walkingHabit, targetDraft, updateWalkingTargets]);

  const removeSession = useCallback(
    (sessionId: string) => {
      if (!walkingHabit) return;
      deleteWalkingSession(walkingHabit.id, sessionId);
    },
    [walkingHabit, deleteWalkingSession]
  );

  /* ---------------- not initialised ---------------- */
  if (!walkingHabit) {
    return (
      <div className="studio-root" data-studio="walking" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="studio-head">
          <div className="min-w-0">
            <span className="studio-eyebrow">NUQTA / WALKING STUDIO</span>
            <h1 className="studio-title mt-1">{isAr ? 'استوديو المشي' : 'Walking Studio'}</h1>
            <p className="studio-lede mt-1">
              {isAr
                ? 'مؤقت مشي دقيق، سجل نزهاتك، وتقدّم أسبوعي.'
                : 'An accurate walk timer, a log of your outings, and weekly progress.'}
            </p>
          </div>
        </header>
        <StudioSection>
          <StudioEmpty
            icon="footprints"
            title={isAr ? 'ابدأ استوديو المشي' : 'Enable the Walking Studio'}
            description={
              isAr
                ? 'سجّل نزهاتك بمؤقت حقيقي. المسافة والخطوات اختياريتان وتُدخلان يدوياً.'
                : 'Log outings with a real timer. Distance and steps are optional and typed by you.'
            }
            action={
              <Button variant="primary" icon="footprints" onClick={handleInit}>
                {isAr ? 'تفعيل استوديو المشي' : 'Enable Walking Studio'}
              </Button>
            }
          />
        </StudioSection>
      </div>
    );
  }

  const tabs: StudioTab[] = [
    { id: 'walk', label: isAr ? 'المشي' : 'Walk', icon: 'footprints' },
    { id: 'history', label: isAr ? 'السجل' : 'History', icon: 'calendar', count: walkingData?.sessions.length },
    { id: 'progress', label: isAr ? 'التقدم' : 'Progress', icon: 'chart' }
  ];

  const weekTargetSeconds = Math.max(1, stats.weeklyTargetMinutes) * 60;
  const weekPct = Math.min(100, Math.round((stats.weekSeconds / weekTargetSeconds) * 100));
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <StudioFrame
      studio="walking"
      eyebrow={isAr ? 'استوديو المشي' : 'Walking Studio'}
      title={isAr ? 'المشي' : 'Walking'}
      description={
        isAr
          ? 'خطوة واحدة بعد الأخرى. المؤقت يقيس الوقت الفعلي؛ الباقي تكتبه أنت.'
          : 'One step after another. The timer measures real time; everything else you type.'
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as WTab)}
      navVariant="workspace"
    >
      {savedFlash && (
        <div
          className="studio-tile mb-[var(--sp-3)] flex items-center gap-2 text-[var(--fs-sm)]"
          role="status"
          style={{ color: 'var(--studio-accent-ink)' }}
        >
          <span aria-hidden="true">✓</span>
          {isAr ? 'تم حفظ الجلسة.' : 'Walk saved.'}
        </div>
      )}

      {/* ============================== WALK ============================== */}
      {activeTab === 'walk' && (
        <div className="grid gap-[var(--sp-4)] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-[var(--sp-4)]">
            <div
              className="walk-stage"
              style={{ aspectRatio: '16 / 9', minHeight: '220px' }}
            >
              <WalkingScene walking={isRunning} />
              <div className="walk-stage-progress" aria-hidden="true">
                <span style={{ width: `${weekPct}%` }} />
              </div>
            </div>

            <div className="studio-tile flex flex-col items-center gap-[var(--sp-3)] py-[var(--sp-5)]">
              <div className="flex items-center gap-2 text-[var(--fs-micro)] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: isRunning ? 'var(--studio-accent)' : 'var(--border-strong)',
                    animation: isRunning ? 'walk-pulse 2s ease-in-out infinite' : undefined
                  }}
                  aria-hidden="true"
                />
                {isRunning
                  ? isAr
                    ? 'جارٍ المشي'
                    : 'Walking'
                  : isPaused
                  ? isAr
                    ? 'متوقف مؤقتاً'
                    : 'Paused'
                  : isAr
                  ? 'جاهز'
                  : 'Ready'}
              </div>

              <div
                className="walk-timer text-[clamp(2.6rem,9vw,3.6rem)] font-[var(--fw-bold)] text-[var(--text-primary)]"
                role="timer"
                aria-live="off"
                aria-label={isAr ? 'زمن الجلسة' : 'Session time'}
              >
                {formatDuration(seconds)}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {!walk && (
                  <Button variant="primary" size="lg" icon="play" onClick={handleStart}>
                    {isAr ? 'ابدأ المشي' : 'Start walking'}
                  </Button>
                )}
                {isRunning && (
                  <Button variant="secondary" size="lg" icon="pause" onClick={handlePause}>
                    {isAr ? 'إيقاف مؤقت' : 'Pause'}
                  </Button>
                )}
                {isPaused && (
                  <Button variant="primary" size="lg" icon="play" onClick={handleResume}>
                    {isAr ? 'استئناف' : 'Resume'}
                  </Button>
                )}
                {walk && (
                  <>
                    <Button variant="secondary" size="lg" icon="check" onClick={handleFinish} disabled={seconds < 1}>
                      {isAr ? 'إنهاء وحفظ' : 'Finish & save'}
                    </Button>
                    <Button variant="ghost" size="lg" icon="trash" onClick={handleDiscard}>
                      {isAr ? 'تجاهل' : 'Discard'}
                    </Button>
                  </>
                )}
              </div>

              {walk && (
                <p className="text-[var(--fs-micro)] text-[var(--text-tertiary)] text-center max-w-md">
                  {isAr
                    ? 'الوقت محسوب من الساعة الفعلية، لذا يبقى صحيحاً حتى لو توقّف التطبيق في الخلفية.'
                    : 'Time is measured from the real clock, so it stays correct even when the app is backgrounded.'}
                </p>
              )}
            </div>

            {walk && (
              <StudioSection title={isAr ? 'تفاصيل اختيارية' : 'Optional details'}>
                <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mb-[var(--sp-3)]">
                  {isAr
                    ? 'لا يوجد GPS أو عدّاد خطوات في NUQTA. اترك الحقول فارغة إن لم تقِسها — لن نخمّنها.'
                    : 'NUQTA has no GPS or pedometer. Leave these blank if you did not measure them — we will not guess.'}
                </p>
                <div className="walk-manual-row">
                  <Field label={isAr ? 'المسافة (كم)' : 'Distance (km)'} htmlFor="walk-distance">
                    <Input
                      id="walk-distance"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder={isAr ? 'غير مقيسة' : 'Not measured'}
                      value={distanceInput}
                      onChange={(e) => setDistanceInput(e.target.value)}
                    />
                  </Field>
                  <Field label={isAr ? 'الخطوات' : 'Steps'} htmlFor="walk-steps">
                    <Input
                      id="walk-steps"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder={isAr ? 'غير مقيسة' : 'Not measured'}
                      value={stepsInput}
                      onChange={(e) => setStepsInput(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label={isAr ? 'ملاحظة' : 'Note'} htmlFor="walk-notes" className="mt-[var(--sp-3)]">
                  <Textarea
                    id="walk-notes"
                    rows={2}
                    placeholder={isAr ? 'أين مشيت؟ وكيف كان الطريق؟' : 'Where did you walk? How was it?'}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
              </StudioSection>
            )}
          </div>

          <div className="space-y-[var(--sp-4)]">
            <div className="studio-tile flex flex-col items-center text-center gap-2">
              <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                {isAr ? 'هذا الأسبوع' : 'This week'}
              </span>
              <div className="relative" style={{ width: 96, height: 96 }}>
                <svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true">
                  <circle className="walk-ring-track" cx="32" cy="32" r={ringRadius} fill="none" strokeWidth="5" />
                  <circle
                    className="walk-ring-fill"
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference - (weekPct / 100) * ringCircumference}
                    transform="rotate(-90 32 32)"
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-[var(--fs-sm)] font-[var(--fw-bold)] tabular-nums text-[var(--text-primary)]">
                  {weekPct}%
                </span>
              </div>
              <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] tabular-nums">
                {isAr
                  ? `${formatMinutes(stats.weekSeconds, isAr)} من ${stats.weeklyTargetMinutes} د`
                  : `${formatMinutes(stats.weekSeconds, isAr)} / ${stats.weeklyTargetMinutes} min`}
              </span>
              <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                {stats.weekWalks === 1
                  ? isAr
                    ? 'نزهة واحدة'
                    : '1 walk'
                  : isAr
                  ? `${stats.weekWalks} نزهات`
                  : `${stats.weekWalks} walks`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-[var(--sp-2)]">
              <StudioStat
                label={isAr ? 'السلسلة' : 'Streak'}
                value={isAr ? `${stats.streakDays} يوم` : `${stats.streakDays}d`}
                icon="flame"
                tone="accent"
              />
              <StudioStat
                label={isAr ? 'إجمالي النزهات' : 'Total walks'}
                value={stats.totalWalks}
                icon="footprints"
              />
              <StudioStat
                label={isAr ? 'أطول نزهة' : 'Longest'}
                value={stats.longestSeconds ? formatMinutes(stats.longestSeconds, isAr) : '—'}
                icon="timer"
              />
              <StudioStat
                label={isAr ? 'المتوسط' : 'Average'}
                value={stats.averageSeconds ? formatMinutes(stats.averageSeconds, isAr) : '—'}
                icon="chart"
              />
              <StudioStat
                label={isAr ? 'المسافة' : 'Distance'}
                value={stats.totalDistanceKm === null ? '—' : `${stats.totalDistanceKm.toFixed(1)} ${isAr ? 'كم' : 'km'}`}
                hint={stats.totalDistanceKm === null ? (isAr ? 'غير مسجّلة' : 'not recorded') : undefined}
                icon="trending-up"
              />
              <StudioStat
                label={isAr ? 'الخطوات' : 'Steps'}
                value={stats.totalSteps === null ? '—' : stats.totalSteps.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                hint={stats.totalSteps === null ? (isAr ? 'غير مسجّلة' : 'not recorded') : undefined}
                icon="activity"
              />
            </div>

            <StudioSection title={isAr ? 'هدف الأسبوع' : 'Weekly target'}>
              <div className="flex items-end gap-2">
                <Field label={isAr ? 'دقائق / أسبوع' : 'Minutes / week'} htmlFor="walk-target" className="flex-1">
                  <Input
                    id="walk-target"
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="2000"
                    step="10"
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                  />
                </Field>
                <Button variant="secondary" icon="save" onClick={handleSaveTarget}>
                  {isAr ? 'حفظ' : 'Save'}
                </Button>
              </div>
              {targetSaved && (
                <p className="text-[var(--fs-micro)] mt-2" style={{ color: 'var(--studio-accent-ink)' }} role="status">
                  {isAr ? 'تم تحديث الهدف.' : 'Target updated.'}
                </p>
              )}
            </StudioSection>
          </div>
        </div>
      )}

      {/* ============================== HISTORY ============================== */}
      {activeTab === 'history' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'كل النزهات' : 'All walks'}>
            {!walkingData?.sessions.length ? (
              <StudioEmpty
                icon="footprints"
                title={isAr ? 'لا نزهات بعد' : 'No walks yet'}
                description={isAr ? 'ابدأ مؤقتاً واحفظ أول نزهة.' : 'Start the timer and save your first walk.'}
                action={
                  <Button variant="primary" icon="play" onClick={() => setActiveTab('walk')}>
                    {isAr ? 'إلى المؤقت' : 'Go to timer'}
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-[var(--sp-2)]">
                {walkingData.sessions.map((s) => (
                  <li key={s.id} className="studio-tile flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] tabular-nums">
                          {formatMinutes(s.durationSeconds, isAr)}
                        </span>
                        <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)] font-mono">
                          {s.date} · {formatClock(s.startedAt)}
                        </span>
                      </div>
                      {(typeof s.distanceKm === 'number' || typeof s.steps === 'number') && (
                        <div className="text-[var(--fs-micro)] text-[var(--text-secondary)] mt-0.5 tabular-nums">
                          {typeof s.distanceKm === 'number' && <span>{s.distanceKm} {isAr ? 'كم' : 'km'}</span>}
                          {typeof s.distanceKm === 'number' && typeof s.steps === 'number' && <span> · </span>}
                          {typeof s.steps === 'number' && (
                            <span>{s.steps.toLocaleString(isAr ? 'ar-EG' : 'en-US')} {isAr ? 'خطوة' : 'steps'}</span>
                          )}
                        </div>
                      )}
                      {s.notes && (
                        <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mt-1 break-words">{s.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      aria-label={isAr ? 'حذف النزهة' : 'Delete walk'}
                      onClick={() => removeSession(s.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>
        </div>
      )}

      {/* ============================== PROGRESS ============================== */}
      {activeTab === 'progress' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'هذا الأسبوع' : 'This week'}>
            <StudioBars data={weekBars} unit={isAr ? 'د' : 'min'} height={110} />
            <p className="text-[var(--fs-micro)] text-[var(--text-tertiary)] mt-2">
              {isAr ? 'الدقائق المسجّلة لكل يوم من أيام الأسبوع.' : 'Recorded minutes for each day of the week.'}
            </p>
          </StudioSection>

          <div className="grid gap-[var(--sp-2)] sm:grid-cols-2 lg:grid-cols-4">
            <StudioStat label={isAr ? 'إجمالي الدقائق' : 'Total minutes'} value={formatMinutes(stats.totalSeconds, isAr)} tone="accent" />
            <StudioStat label={isAr ? 'النزهات' : 'Walks'} value={stats.totalWalks} />
            <StudioStat
              label={isAr ? 'المسافة' : 'Distance'}
              value={stats.totalDistanceKm === null ? '—' : `${stats.totalDistanceKm.toFixed(1)} ${isAr ? 'كم' : 'km'}`}
              hint={stats.totalDistanceKm === null ? (isAr ? 'غير مسجّلة' : 'not recorded') : undefined}
            />
            <StudioStat
              label={isAr ? 'الخطوات' : 'Steps'}
              value={stats.totalSteps === null ? '—' : stats.totalSteps.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              hint={stats.totalSteps === null ? (isAr ? 'غير مسجّلة' : 'not recorded') : undefined}
            />
          </div>

          <StudioSection title={isAr ? 'ملاحظة عن الدقة' : 'A note on accuracy'}>
            <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">
              {isAr
                ? 'المؤقت يقيس الزمن الحقيقي بين البدء والإنهاء، مستبعداً فترات التوقف. المسافة والخطوات لا تُستنتج من المدة أو السرعة؛ إن لم تُدخلها تبقى فارغة بدل أن تُعرض كرقم مخترع.'
                : 'The timer measures real elapsed time between start and finish, excluding pauses. Distance and steps are never inferred from duration or pace; if you do not enter them they stay blank instead of being shown as a made-up number.'}
            </p>
          </StudioSection>
        </div>
      )}
    </StudioFrame>
  );
};

export default WalkingView;
