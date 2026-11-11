import React, { useState, useEffect } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';
import confetti from 'canvas-confetti';
import { NuqtaNotificationEngine } from '../lib/notifications';

export const FocusView: React.FC = () => {
  const { tasks, focusSessions, logFocusSession, profile, setActiveNavTab } = useNuqtaStore();
  const isAr = profile.language === 'ar';

  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [preset, setPreset] = useState<number>(25);
  const [remaining, setRemaining] = useState<number>(25 * 60);
  const [running, setRunning] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string>('');
  const [beforeMood, setBeforeMood] = useState<number>(3);
  const [distractions, setDistractions] = useState<number>(0);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (running && remaining > 0) {
      timer = setInterval(() => {
        setRemaining((r) => r - 1);
      }, 1000);
    } else if (running && remaining <= 0) {
      setRunning(false);
      handleFinishSession();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [running, remaining]);

  const setTimerPreset = (minutes: number, newMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus') => {
    setRunning(false);
    setMode(newMode);
    setPreset(minutes);
    setRemaining(minutes * 60);
  };

  const handleFinishSession = () => {
    if (mode === 'focus') {
      const selectedTask = tasks.find((t) => t.id === taskId);
      const minutesSpent = Math.max(1, Math.round((preset * 60 - remaining) / 60));
      logFocusSession({
        taskId: taskId || undefined,
        taskTitle: selectedTask?.title,
        durationMinutes: minutesSpent,
        targetMinutes: preset,
        interruptionCount: distractions,
        preMood: beforeMood as any,
        postMood: 5,
        productivityScore: distractions === 0 ? 5 : distractions <= 2 ? 4 : 3
      });

      NuqtaNotificationEngine.notify({
        title: isAr ? '🎉 اكتملت جلسة التركيز!' : '🎉 Focus Session Completed!',
        body: isAr
          ? `أنجزت ${preset} دقيقة من العمل العميق بامتياز. خذ استراحة مستحقة.`
          : `You completed ${preset} minutes of deep work. Time for a well-deserved recovery.`,
        tag: 'focus-complete',
        chime: 'focus-complete'
      });

      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.65 } });
      } catch {}
    } else {
      NuqtaNotificationEngine.notify({
        title: isAr ? 'انتهت الاستراحة · جاهز للعودة؟' : 'Break Ended · Ready to resume?',
        body: isAr
          ? 'استعد لجلسة التركيز القادمة بصفاء ذهني.'
          : 'Refreshed and ready for your next focused sprint.',
        tag: 'break-complete',
        chime: 'break-start'
      });
    }
    setRunning(false);
    setRemaining(preset * 60);
    setDistractions(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalTimeSeconds = preset * 60;
  const progressRatio = totalTimeSeconds > 0 ? ((totalTimeSeconds - remaining) / totalTimeSeconds) * 100 : 0;

  // Today sessions stats
  const todaySessions = focusSessions.filter((s) => s.completedAt?.startsWith(todayStr));
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const targetMinutes = 120; // 2 hours target
  const targetPct = Math.min(100, Math.round((todayMinutes / targetMinutes) * 100));

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / ATTENTION</span>
          </div>
          <h1>{isAr ? 'التركيز والانتباه' : 'Focus & Attention'}</h1>
          <p>
            {isAr
              ? 'مساحة هادئة للعمل العميق بعيدًا عن التشتت والمقاطعات.'
              : 'A calibrated container for deep work, flow state, and cognitive protection.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn subtle" onClick={() => setActiveNavTab('tasks')}>
            <span>{isAr ? 'اختيار مهمة من القائمة' : 'Choose Task'}</span>
            <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="focus-layout">
        {/* Left Timer Panel */}
        <section className="panel timer-panel">
          <span className="tag green">
            ✳ {mode === 'focus' ? (isAr ? 'جلسة تركيز' : 'Focus Session') : (isAr ? 'استراحة' : 'Break')}
          </span>

          <div className="timer-mode-label">
            {mode === 'focus'
              ? isAr ? 'عمل عميق وتركيز ذهني' : 'Deep Work Mode'
              : mode === 'shortBreak'
              ? isAr ? 'استراحة قصيرة (5 دقائق)' : 'Short Break (5 mins)'
              : isAr ? 'استراحة طويلة (15 دقيقة)' : 'Long Recovery Break'}
          </div>

          <div
            className="timer-ring"
            style={{
              background: `conic-gradient(var(--accent-strong) ${progressRatio}%, var(--track-strong) 0)`
            }}
          >
            <div className="timer-readout">
              {formatTime(remaining)}
              <small>{running ? (isAr ? 'قيد الجريان...' : 'Focusing...') : (isAr ? 'دقائق' : 'minutes')}</small>
            </div>
          </div>

          {/* Focus Presets */}
          <div className="timer-presets">
            {[25, 50, 90].map((n) => (
              <button
                key={n}
                onClick={() => setTimerPreset(n, 'focus')}
                className={mode === 'focus' && preset === n ? 'active' : ''}
              >
                {n} {isAr ? 'د' : 'min'}
              </button>
            ))}
          </div>

          {/* Break Presets */}
          <div className="timer-presets" style={{ marginTop: '9px' }}>
            <button
              onClick={() => setTimerPreset(5, 'shortBreak')}
              className={mode === 'shortBreak' ? 'active' : ''}
            >
              {isAr ? 'استراحة قصيرة · 5' : 'Short Break · 5'}
            </button>
            <button
              onClick={() => setTimerPreset(15, 'longBreak')}
              className={mode === 'longBreak' ? 'active' : ''}
            >
              {isAr ? 'استراحة طويلة · 15' : 'Long Break · 15'}
            </button>
          </div>

          {/* Timer Controls */}
          <div className="timer-controls">
            <button
              className="btn primary"
              onClick={() => setRunning(!running)}
            >
              {running ? (isAr ? 'إيقاف مؤقت' : 'Pause') : remaining < preset * 60 ? (isAr ? 'استئناف' : 'Resume') : (isAr ? 'ابدأ الجلسة' : 'Start Focus')}
            </button>
            <button
              className="btn subtle"
              onClick={() => {
                setRunning(false);
                setRemaining(preset * 60);
              }}
            >
              {isAr ? 'إعادة ضبط' : 'Reset'}
            </button>
            <button
              className="btn subtle"
              onClick={handleFinishSession}
              disabled={remaining === preset * 60}
            >
              {isAr ? 'إنهاء وحفظ' : 'Log Session'}
            </button>
          </div>

          {/* Linked Task Selector */}
          <div className="field" style={{ width: 'min(330px, 100%)', marginTop: '18px', textAlign: 'start' }}>
            <label>{isAr ? 'ربط المهمة بالجلسة' : 'Link Task'}</label>
            <select
              className="select"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">{isAr ? '— بدون ربط مهمة —' : '— No linked task —'}</option>
              {tasks
                .filter((t) => t.status !== 'completed')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Pre-session state */}
          <div className="field" style={{ width: 'min(330px, 100%)', marginTop: '11px', textAlign: 'start' }}>
            <label>{isAr ? 'مستوى الطاقة قبل البدء' : 'Mental Energy Level'}</label>
            <select
              className="select"
              value={beforeMood}
              onChange={(e) => setBeforeMood(Number(e.target.value))}
            >
              <option value={5}>5 / 5 — {isAr ? 'نشاط كامل وتركيز حاد' : 'Peak Clarity'}</option>
              <option value={4}>4 / 5 — {isAr ? 'طاقة جيدة ومستعدة' : 'Good Energy'}</option>
              <option value={3}>3 / 5 — {isAr ? 'متوسط ومستقر' : 'Steady / Neutral'}</option>
              <option value={2}>2 / 5 — {isAr ? 'تشتت خفيف أو إرهاق' : 'Slightly Fatigued'}</option>
              <option value={1}>1 / 5 — {isAr ? 'إرهاق شديد' : 'Depleted'}</option>
            </select>
          </div>

          <p className="small-muted" style={{ marginTop: '18px' }}>
            “{isAr ? 'ما تركز عليه ينمو، وما تهمله يتلاشى بهدوء.' : 'Where your focus goes, your reality follows.'}”
          </p>
        </section>

        {/* Right Side Stats & Log */}
        <aside className="focus-side">
          {/* Today Stats Card */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{isAr ? 'تركيز اليوم' : "Today's Deep Work"}</h2>
                <p>{new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
              <span className="tag">
                {todaySessions.length} {isAr ? 'جلسات' : 'sessions'}
              </span>
            </div>

            <div className="session-stat-grid">
              <div className="session-stat">
                <strong>{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</strong>
                <small>{isAr ? 'ساعات العمل العميق' : 'deep attention'}</small>
              </div>
              <div className="session-stat">
                <strong>{todaySessions.length > 0 ? 1 : 0} {isAr ? 'يوم' : 'days'}</strong>
                <small>{isAr ? 'سلسلة التركيز' : 'daily streak'}</small>
              </div>
            </div>

            <div className="subtle-line"></div>
            <div className="progress-line">
              <span style={{ width: `${targetPct}%` }}></span>
            </div>
            <p className="small-muted" style={{ margin: '8px 0 0' }}>
              {targetPct}% {isAr ? 'من الهدف اليومي (ساعتان)' : 'of 2-hour daily deep work target'}
            </p>
          </section>

          {/* Session History */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{isAr ? 'سجل الجلسات الحديثة' : 'Recent Focus Sessions'}</h2>
                <p>{isAr ? 'محفوظ محلياً وخاص بالكامل' : 'Saved strictly locally'}</p>
              </div>
            </div>

            {focusSessions.length === 0 ? (
              <div className="empty-inline">{isAr ? 'لا توجد جلسات مسجلة بعد' : 'No sessions recorded yet'}</div>
            ) : (
              <div className="space-y-1">
                {focusSessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="session-log-row">
                    <span className="session-log-icon">◷</span>
                    <div className="session-log-copy">
                      <strong>{s.taskTitle || (isAr ? 'جلسة تركيز عامة' : 'General Focus Session')}</strong>
                      <small>{s.completedAt?.slice(0, 10)} · ★ {s.productivityScore}/5</small>
                    </div>
                    <span className="session-log-min">{s.durationMinutes}m</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

