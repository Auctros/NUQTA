import { emptyHealthRecord } from '../lib/healthDefaults';
import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

export const HealthView: React.FC = () => {
  const { healthMetrics, updateTodayHealth, addHydration, profile } = useNuqtaStore();
  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const today = healthMetrics[todayStr] ?? emptyHealthRecord(todayStr);

  const [waterCupsToAdd, setWaterCupsToAdd] = useState(1);
  const [sleepInput, setSleepInput] = useState(today.sleepHours > 0 ? String(today.sleepHours) : '');
  const [weightInput, setWeightInput] = useState(today.weightKg ? String(today.weightKg) : '');
  const [activityName, setActivityName] = useState('');
  const [activityMinutes, setActivityMinutes] = useState(30);

  // History log of health entries
  const [healthLogs, setHealthLogs] = useState<Array<{ id: string; type: string; title: string; value: string; date: string }>>([]);

  const handleAddWater = () => {
    addHydration(waterCupsToAdd * 250);
    setHealthLogs((prev) => [
      {
        id: crypto.randomUUID(),
        type: 'water',
        title: isAr ? 'إضافة ماء' : 'Hydration',
        value: `+${waterCupsToAdd} ${isAr ? 'كوب' : 'cups'}`,
        date: todayStr
      },
      ...prev
    ]);
  };

  const handleSaveSleep = () => {
    const num = parseFloat(sleepInput);
    if (!isNaN(num) && num > 0) {
      updateTodayHealth({ sleepHours: num });
      setHealthLogs((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'sleep',
          title: isAr ? 'ساعات النوم' : 'Sleep Log',
          value: `${num}h`,
          date: todayStr
        },
        ...prev
      ]);
    }
  };

  const handleSaveWeight = () => {
    const num = parseFloat(weightInput);
    if (!isNaN(num) && num > 0) {
      updateTodayHealth({ weightKg: num });
      setHealthLogs((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'weight',
          title: isAr ? 'تسجيل الوزن' : 'Weight',
          value: `${num} kg`,
          date: todayStr
        },
        ...prev
      ]);
    }
  };

  const handleSaveWorkout = () => {
    if (!activityName.trim()) return;
    updateTodayHealth({
      workoutLogged: true,
      workoutType: activityName.trim(),
      workoutMinutes: (today.workoutMinutes ?? 0) + activityMinutes
    });
    setHealthLogs((prev) => [
      {
        id: crypto.randomUUID(),
        type: 'workout',
        title: activityName.trim(),
        value: `${activityMinutes} mins`,
        date: todayStr
      },
      ...prev
    ]);
    setActivityName('');
  };

  const handleDeleteLog = (id: string) => {
    setHealthLogs((prev) => prev.filter((item) => item.id !== id));
  };

  const waterCups = Math.round((today.hydrationMl || 0) / 250);

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / WELLBEING</span>
          </div>
          <h1>{isAr ? 'الصحة الحيوية والجسد' : 'Vital Health & Body'}</h1>
          <p>
            {isAr
              ? 'نوم، ترطيب، وحركة. الأساس الحيوي الذي تبنى عليه طاقتك الذهنية وصفاؤك.'
              : 'Sleep, hydration, and movement. The somatic baseline behind all peak cognition.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn subtle" onClick={handleSaveSleep}>
            <span>{isAr ? 'تسجيل النوم' : 'Log Sleep'}</span>
          </button>
          <button className="btn primary" onClick={() => document.getElementById('workout-name-input')?.focus()}>
            <span className="btn-icon">+</span>
            <span>{isAr ? 'تسجيل نشاط' : 'Log Workout'}</span>
          </button>
        </div>
      </div>

      {/* 4 Health Tiles */}
      <div className="health-summary">
        <div className="panel health-tile">
          <div className="health-tile-head">
            <span className="health-tile-icon">◔</span>
            <span className="small-muted">{isAr ? 'اليوم' : 'Today'}</span>
          </div>
          <strong>
            {today.sleepHours > 0 ? today.sleepHours : '–'}
            <small style={{ display: 'inline', marginInlineStart: '5px' }}>{isAr ? 'ساعات' : 'hrs'}</small>
          </strong>
          <small>{isAr ? 'ساعات النوم' : 'Sleep Duration'}</small>
          <div className="health-goal">{isAr ? 'الهدف: 8 ساعات' : 'Target: 8.0h'}</div>
        </div>

        <div className="panel health-tile">
          <div className="health-tile-head">
            <span className="health-tile-icon">≈</span>
            <span className="small-muted">{isAr ? 'اليوم' : 'Today'}</span>
          </div>
          <strong>
            {waterCups}
            <small style={{ display: 'inline', marginInlineStart: '5px' }}>{isAr ? 'أكواب' : 'cups'}</small>
          </strong>
          <small>{isAr ? 'الترطيب والماء' : 'Hydration'}</small>
          <div className="health-goal">{isAr ? 'الهدف: 8-10 أكواب' : 'Target: 8-10 cups'}</div>
        </div>

        <div className="panel health-tile">
          <div className="health-tile-head">
            <span className="health-tile-icon">↟</span>
            <span className="small-muted">{isAr ? 'اليوم' : 'Today'}</span>
          </div>
          <strong>
            {today.workoutMinutes ?? (today.workoutLogged ? '✓' : '0')}
            <small style={{ display: 'inline', marginInlineStart: '5px' }}>{isAr ? 'د' : 'min'}</small>
          </strong>
          <small>{isAr ? 'الحركة والتمرين' : 'Movement'}</small>
          <div className="health-goal">{isAr ? 'الهدف: 30 دقيقة يومياً' : 'Target: 30 mins'}</div>
        </div>

        <div className="panel health-tile">
          <div className="health-tile-head">
            <span className="health-tile-icon">⌁</span>
            <span className="small-muted">{isAr ? 'اليوم' : 'Today'}</span>
          </div>
          <strong>
            {today.weightKg || '—'}
            <small style={{ display: 'inline', marginInlineStart: '5px' }}>{isAr ? 'كجم' : 'kg'}</small>
          </strong>
          <small>{isAr ? 'وزن الجسم' : 'Body Weight'}</small>
          <div className="health-goal">{isAr ? 'مستقر ومعتدل' : 'Stable'}</div>
        </div>
      </div>

      <div className="health-layout">
        {/* Left Logging Section */}
        <section className="panel panel-pad">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'تسجيل المؤشرات اليومية' : "Today's Bio-Log"}</h2>
              <p>{new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
            <span className="tag green">{isAr ? 'محلي وخاص' : 'Local Only'}</span>
          </div>

          {/* Water quick row */}
          <div className="log-form-row">
            <div className="field">
              <label>{isAr ? 'شرب الماء والترطيب' : 'Water Intake'}</label>
              <select
                className="select"
                value={waterCupsToAdd}
                onChange={(e) => setWaterCupsToAdd(Number(e.target.value))}
              >
                <option value={1}>1 {isAr ? 'كوب (250 مل)' : 'Cup (250ml)'}</option>
                <option value={2}>2 {isAr ? 'كوب (500 مل)' : 'Cups (500ml)'}</option>
                <option value={3}>3 {isAr ? 'أكواب (750 مل)' : 'Cups (750ml)'}</option>
                <option value={4}>4 {isAr ? 'أكواب (1 لتر)' : 'Cups (1 Liter)'}</option>
              </select>
            </div>
            <button className="btn primary" onClick={handleAddWater}>
              + {isAr ? 'تسجيل ماء' : 'Add Water'}
            </button>
          </div>

          <div className="subtle-line"></div>

          {/* Sleep & Weight inputs */}
          <div className="form-grid">
            <div className="field">
              <label>{isAr ? 'ساعات النوم' : 'Sleep Hours'}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
              />
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button className="btn subtle" onClick={handleSaveSleep}>
                {isAr ? 'حفظ النوم' : 'Save Sleep'}
              </button>
            </div>

            <div className="field">
              <label>{isAr ? 'وزن الجسم (كجم)' : 'Body Weight (kg)'}</label>
              <input
                className="input"
                type="number"
                min="20"
                max="300"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button className="btn subtle" onClick={handleSaveWeight}>
                {isAr ? 'حفظ الوزن' : 'Save Weight'}
              </button>
            </div>
          </div>

          <div className="subtle-line"></div>

          {/* Workout / Activity row */}
          <div className="field">
            <label>{isAr ? 'اسم النشاط الرياضي' : 'Activity / Workout'}</label>
            <input
              id="workout-name-input"
              className="input"
              placeholder={isAr ? 'مشي، تمارين قوة، يوجا، جري...' : 'Walk, Strength training, Stretch...'}
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
            />
          </div>

          <div className="log-form-row">
            <div className="field">
              <label>{isAr ? 'المدة (بالدقائق)' : 'Duration (mins)'}</label>
              <input
                className="input"
                type="number"
                min="5"
                max="300"
                step="5"
                value={activityMinutes}
                onChange={(e) => setActivityMinutes(Number(e.target.value))}
              />
            </div>
            <button className="btn primary" onClick={handleSaveWorkout}>
              + {isAr ? 'تسجيل النشاط' : 'Log Activity'}
            </button>
          </div>
        </section>

        {/* Right History Column */}
        <aside className="panel panel-pad">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'سجل الجسد والأنشطة' : 'Bio Activity History'}</h2>
              <p>{isAr ? 'سجل القياسات والأنشطة الحديثة' : 'Recent health logs'}</p>
            </div>
          </div>

          {healthLogs.length === 0 ? (
            <div className="empty-inline">{isAr ? 'لا توجد سجلات بعد' : 'No records yet'}</div>
          ) : (
            <div>
              {healthLogs.map((item) => (
                <div key={item.id} className="log-item">
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.date}</small>
                  </div>
                  <span className="tag green">{item.value}</span>
                  <button
                    className="mini-icon"
                    onClick={() => handleDeleteLog(item.id)}
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="fine-print">
            {isAr
              ? 'تُخزن جميع البيانات الصحية محلياً على جهازك بتشفير تام، دون أي اتصال بخوادم خارجية أو تسريب.'
              : 'All biometric records are saved strictly on your local browser. No cloud leaks, total bodily privacy.'}
          </p>
        </aside>
      </div>
    </div>
  );
};
