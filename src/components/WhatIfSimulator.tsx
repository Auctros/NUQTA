import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

export const WhatIfSimulator: React.FC = () => {
  const { habits, profile } = useNuqtaStore();
  const [consistencyRate, setConsistencyRate] = useState<number>(85); // 85%
  const [horizonMonths, setHorizonMonths] = useState<number>(12);

  const isAr = profile.language === 'ar';

  const calculateCompoundMultiplier = (consistency: number, months: number) => {
    const totalDays = months * 30.5;
    const gainFactor = 1 + 0.01 * (consistency / 100);
    const driftFactor = 1 - 0.0075 * ((100 - consistency) / 100);

    const activeDays = totalDays * (consistency / 100);
    const slipDays = totalDays * ((100 - consistency) / 100);

    const score = Math.pow(gainFactor, activeDays) * Math.pow(driftFactor, slipDays);
    return Math.max(0.1, score);
  };

  const multiplier = calculateCompoundMultiplier(consistencyRate, horizonMonths);
  const totalDays = Math.round(horizonMonths * 30.5);
  const estimatedReps = Math.round(totalDays * (consistencyRate / 100));

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / TRAJECTORY</span>
          </div>
          <h1>{isAr ? 'محاكي التراكم والتطور ("ماذا لو؟")' : 'What-If Trajectory Engine'}</h1>
          <p>
            {isAr
              ? 'الرياضيات الصارمة لقانون التراكم: كيف يغير الالتزام اليومي البسيط (1%) واقعك على المدى البعيد.'
              : 'Mathematical compounding engine: visualize how small daily habits compound across 6 to 24 months.'}
          </p>
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="money-summary">
        <div className="panel money-card">
          <span className="money-label">{isAr ? 'مُضاعِف القوة التراكمية' : 'Compound Multiplier'}</span>
          <strong style={{ color: 'var(--accent)' }}>{multiplier.toFixed(2)}x</strong>
          <small>{isAr ? 'مقارنة بنقطة البداية' : 'vs baseline vector'}</small>
        </div>

        <div className="panel money-card">
          <span className="money-label">{isAr ? 'التكرارات الناجحة المتوقعة' : 'Successful Repetitions'}</span>
          <strong>{estimatedReps} {isAr ? 'مرة' : 'reps'}</strong>
          <small>{isAr ? `خلال ${totalDays} يوماً` : `across ${totalDays} days`}</small>
        </div>

        <div className="panel money-card">
          <span className="money-label">{isAr ? 'العادات النشطة المشمولة' : 'Habits Calibrated'}</span>
          <strong>{habits.length}</strong>
          <small>{isAr ? 'عادة مستمرة' : 'daily rhythm anchors'}</small>
        </div>
      </div>

      {/* Simulation Controls Panel */}
      <section className="panel panel-pad">
        <div className="panel-heading">
          <div>
            <h2>{isAr ? 'معايير المحاكاة' : 'Simulation Parameters'}</h2>
            <p>{isAr ? 'تحكم في معدل الاستمرارية والأفق الزمني' : 'Adjust execution consistency and temporal horizon'}</p>
          </div>
          <span className="tag green">{consistencyRate}% {isAr ? 'التزام' : 'Consistency'}</span>
        </div>

        <div className="form-grid">
          {/* Consistency */}
          <div className="field">
            <label>{isAr ? 'نسبة الالتزام اليومي' : 'Daily Execution Consistency'}: <strong>{consistencyRate}%</strong></label>
            <input
              type="range"
              min="30"
              max="100"
              value={consistencyRate}
              onChange={(e) => setConsistencyRate(Number(e.target.value))}
              className="accent-accent w-full mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>30% ({isAr ? 'ركود' : 'Stagnant'})</span>
              <span>70% ({isAr ? 'متوسط' : 'Average'})</span>
              <span>85% ({isAr ? 'إتقان عالٍ' : 'High Craft'})</span>
              <span>100% ({isAr ? 'حاسم' : 'Peak'})</span>
            </div>
          </div>

          {/* Horizon Months */}
          <div className="field">
            <label>{isAr ? 'الأفق الزمني للتوقع' : 'Temporal Horizon'}: <strong>{horizonMonths} {isAr ? 'شهراً' : 'Months'}</strong></label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[3, 6, 12, 24].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHorizonMonths(m)}
                  className={`btn small ${horizonMonths === m ? 'primary' : 'subtle'}`}
                >
                  {m} {isAr ? 'أشهر' : 'mo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="subtle-line"></div>

        <div className="privacy-note">
          <span className="privacy-icon">
            <NuqtaIcon name="repeat" className="w-5 h-5 text-accent" />
          </span>
          <div>
            <strong>{isAr ? 'القانون الرياضي للعادات الذرية' : 'The Compounding Math of Atomic Habits'}</strong>
            <p>
              {isAr
                ? 'وفق كتاب جيمس كلير، التحسن بنسبة 1% يومياً يجعلك أفضل بـ 37 ضعفاً خلال عام واحد. بينما التراجع بنسبة 1% يومياً يقترب بك من الصفر. الاستمرارية تفوق الكثافة دائماً.'
                : 'Getting 1% better every day for a year compounds to 37.78x. Getting 1% worse every day drops you to nearly zero. Consistency always defeats intensity.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
