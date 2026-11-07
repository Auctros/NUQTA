import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

export const RescueModal: React.FC = () => {
  const { isRescueModeOpen, setRescueModeOpen, tasks, executeRescueMode, profile } = useNuqtaStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [deferRest, setDeferRest] = useState<boolean>(true);

  if (!isRescueModeOpen) return null;

  const isAr = profile.language === 'ar';
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  const handleExecute = () => {
    const anchorId = selectedTaskId || (pendingTasks[0] ? pendingTasks[0].id : '');
    executeRescueMode(anchorId, deferRest);
    setStep(1);
    setSelectedTaskId('');
    setRescueModeOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setRescueModeOpen(false)} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              <span className="line"></span>
              <span>NUQTA / RESCUE</span>
            </div>
            <h2>{isAr ? 'وضع الإنقاذ النفسي (Rescue Mode)' : 'Rescue Mode: Anti-Overwhelm'}</h2>
            <p>
              {isAr
                ? 'عندما تشعر بالإرهاق وتراكم المهام، أعد ضبط اليوم في ٣ قرارات سريعة دون تأنيب ضمير.'
                : 'Reset your daily cognitive load into 1 manageable anchor when overwhelm strikes.'}
            </p>
          </div>
          <button className="modal-close" onClick={() => setRescueModeOpen(false)}>
            ×
          </button>
        </div>

        {step === 1 ? (
          <div className="rescue-step">
            <div className="rescue-summary">
              <h3>{isAr ? 'خذ نفساً عميقاً، لست مضطراً لفعل كل شيء.' : 'Pause and take a deep breath.'}</h3>
              <p>
                {isAr
                  ? 'الشلل الإدراكي يحدث حين تتصارع عشرات المهام المفتوحة في ذاكرتك العاملة. سنقوم الآن بتأجيل كل ما هو غير عاجل وحصر طاقتك في نقطة واحدة فقط.'
                  : 'Cognitive paralysis happens when too many open loops compete for working memory. We will shelve secondary items and anchor strictly ONE critical action.'}
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted">
              <div className="flex items-center gap-2">
                <span className="text-accent font-bold">✓</span>
                <span>
                  {isAr
                    ? 'ترحيل المهام المتبقية لصباح الغد تلقائياً دون أي شعور بالذنب.'
                    : 'Postpone remaining tasks to tomorrow morning cleanly without guilt.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent font-bold">✓</span>
                <span>
                  {isAr
                    ? 'اختيار مهمة محورية واحدة فقط، إذا أنجزتها يعتبر اليوم كافياً وناجحاً.'
                    : 'Choose strictly 1 single anchor task to win the day.'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="btn primary w-full justify-center mt-3"
            >
              <span>{isAr ? 'المتابعة واختيار المهمة المحورية' : 'Select 1 Anchor Action'}</span>
              <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="rescue-step">
            <label className="field-label">
              {isAr
                ? 'إذا كان بإمكانك إنجاز شيء واحد فقط قبل النوم، ماذا تختار؟'
                : 'If you could only accomplish ONE single task before sleep, what is it?'}
            </label>

            {pendingTasks.length === 0 ? (
              <div className="empty-inline">
                {isAr ? 'لا توجد مهام معلقة! أنت بالفعل في أمان.' : 'No pending tasks! You are all caught up.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingTasks.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`rescue-choice ${selectedTaskId === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTaskId(t.id)}
                  >
                    <span className="choice-icon">
                      <NuqtaIcon name="target" className="w-4 h-4" />
                    </span>
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {t.estimatedMinutes ? `${t.estimatedMinutes} ${isAr ? 'دقيقة' : 'mins'}` : (isAr ? 'أولوية اليوم' : 'Daily priority')}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="deferCheckbox"
                checked={deferRest}
                onChange={(e) => setDeferRest(e.target.checked)}
                className="accent-accent"
              />
              <label htmlFor="deferCheckbox" className="text-xs text-muted cursor-pointer">
                {isAr ? 'ترحيل باقي المهام المعلقة للغد بجدولة ذكية' : 'Defer all remaining tasks to tomorrow cleanly'}
              </label>
            </div>

            <div className="form-actions">
              <button className="btn subtle" onClick={() => setStep(1)}>
                {isAr ? 'رجوع' : 'Back'}
              </button>
              <button className="btn primary" onClick={handleExecute}>
                {isAr ? 'تنفيذ خطة الإنقاذ ✓' : 'Execute Rescue Plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
