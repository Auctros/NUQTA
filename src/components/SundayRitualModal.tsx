import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

export const SundayRitualModal: React.FC = () => {
  const { isSundayRitualOpen, setSundayRitualOpen, completeSundayRitual, tasks, habits, focusSessions, profile } = useNuqtaStore();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [wins, setWins] = useState<string[]>(['إنجاز أهداف الأسبوع الأساسية', 'الالتزام بـ 7 ساعات نوم']);
  const [newWin, setNewWin] = useState('');
  const [lessons, setLessons] = useState<string[]>(['تجنب حجز جلسات تركيز ثقيلة بعد وجبة الغداء مباشرة']);
  const [newLesson, setNewLesson] = useState('');
  const [topPriorities, setTopPriorities] = useState<string[]>(['إطلاق التحديث الجديد للمستخدمين', 'الحفاظ على 4 جلسات تركيز']);
  const [newPriority, setNewPriority] = useState('');

  if (!isSundayRitualOpen) return null;

  const isAr = profile.language === 'ar';
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const focusTotalMins = focusSessions.reduce((s, x) => s + x.durationMinutes, 0);

  const addWin = () => {
    if (newWin.trim()) {
      setWins([...wins, newWin.trim()]);
      setNewWin('');
    }
  };

  const addLesson = () => {
    if (newLesson.trim()) {
      setLessons([...lessons, newLesson.trim()]);
      setNewLesson('');
    }
  };

  const addPriority = () => {
    if (newPriority.trim()) {
      setTopPriorities([...topPriorities, newPriority.trim()]);
      setNewPriority('');
    }
  };

  const handleFinish = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    completeSundayRitual({
      date: todayStr,
      wins,
      lessons,
      energyAudit: 'Good mental stability and intentional focus.',
      topPrioritiesNextWeek: topPriorities
    });
    setSundayRitualOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setSundayRitualOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              <span className="line"></span>
              <span>NUQTA / RITUAL</span>
            </div>
            <h2>{isAr ? 'طقس المراجعة الأسبوعية' : 'The Weekly Review Ritual'}</h2>
            <p>
              {isAr
                ? 'إغلاق الأسبوع المنصرم بوعي واستخلاص الدروس، وبدء الأسبوع الجديد بوضوح لا يتزعزع.'
                : 'Close out open loops, celebrate genuine wins, and architect your next 7 days.'}
            </p>
          </div>
          <button className="modal-close" onClick={() => setSundayRitualOpen(false)}>
            ×
          </button>
        </div>

        {/* Step Indicator and Metrics Bar */}
        <div className="review-score mb-4">
          <div className="review-metric">
            <strong>{completedTasks}</strong>
            <span>{isAr ? 'مهمة منجزة هذا الأسبوع' : 'Tasks Completed'}</span>
          </div>
          <div className="review-metric">
            <strong>{(focusTotalMins / 60).toFixed(1)}h</strong>
            <span>{isAr ? 'ساعات عمل عميق' : 'Deep Work Hours'}</span>
          </div>
          <div className="review-metric">
            <strong>{habits.length}</strong>
            <span>{isAr ? 'عادات نشطة' : 'Active Habits'}</span>
          </div>
        </div>

        {/* Step 1: Wins */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <label className="field-label font-bold text-accent">
              01 — {isAr ? 'ما هي أبرز إنجازاتك وانتصاراتك هذا الأسبوع؟' : 'Celebrate your wins this week'}
            </label>
            <div className="space-y-1.5">
              {wins.map((w, i) => (
                <div key={i} className="task-row py-2 text-xs">
                  <span className="text-accent font-bold">✓</span>
                  <span className="flex-1">{w}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="input"
                placeholder={isAr ? 'أضف إنجازاً أو خطوة مهمة...' : 'Add a win...'}
                value={newWin}
                onChange={(e) => setNewWin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWin()}
              />
              <button className="btn primary" onClick={addWin}>
                +
              </button>
            </div>

            <div className="form-actions">
              <button className="btn primary" onClick={() => setCurrentStep(2)}>
                <span>{isAr ? 'التالي: دروس مستفادة' : 'Next: Lessons'}</span>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Lessons */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <label className="field-label font-bold text-orange">
              02 — {isAr ? 'ما الذي تعلمته؟ وأين كانت نقاط الهدر أو التشتت؟' : 'What did you learn? Friction & drains'}
            </label>
            <div className="space-y-1.5">
              {lessons.map((l, i) => (
                <div key={i} className="task-row py-2 text-xs">
                  <span className="text-orange font-bold">!</span>
                  <span className="flex-1">{l}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="input"
                placeholder={isAr ? 'أضف درساً للمستقبل...' : 'Add a lesson learned...'}
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLesson()}
              />
              <button className="btn primary" onClick={addLesson}>
                +
              </button>
            </div>

            <div className="form-actions">
              <button className="btn subtle" onClick={() => setCurrentStep(1)}>
                {isAr ? 'السابق' : 'Back'}
              </button>
              <button className="btn primary" onClick={() => setCurrentStep(3)}>
                <span>{isAr ? 'التالي: أولويات الأسبوع القادم' : 'Next: Next Week Focus'}</span>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Top Priorities */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <label className="field-label font-bold text-accent">
              03 — {isAr ? 'أهم أولويات الأسبوع القادم (Strictly 2-3 Focus Outcomes)' : 'Top Outcomes for Next Week'}
            </label>
            <div className="space-y-1.5">
              {topPriorities.map((p, i) => (
                <div key={i} className="task-row py-2 text-xs">
                  <span className="text-accent font-bold">★</span>
                  <span className="flex-1">{p}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="input"
                placeholder={isAr ? 'أضف أولوية قصوى...' : 'Add core priority...'}
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPriority()}
              />
              <button className="btn primary" onClick={addPriority}>
                +
              </button>
            </div>

            <div className="form-actions">
              <button className="btn subtle" onClick={() => setCurrentStep(2)}>
                {isAr ? 'السابق' : 'Back'}
              </button>
              <button className="btn primary" onClick={handleFinish}>
                {isAr ? 'إتمام المراجعة الأسبوعية ✓' : 'Complete Ritual ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
