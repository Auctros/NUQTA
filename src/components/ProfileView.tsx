import React, { useEffect, useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

/**
 * The profile destination. It owns the *identity* experience (who you are, your
 * progress, the data you have accumulated on this device) and deliberately stays
 * separate from Settings, which owns configuration, appearance and data tools.
 */
export const ProfileView: React.FC = () => {
  const {
    profile,
    updateProfileName,
    setLanguage,
    tasks,
    habits,
    goals,
    journalEntries,
    savingsGoals,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const [nameInput, setNameInput] = useState(profile.name);
  const [saved, setSaved] = useState(false);

  useEffect(() => setNameInput(profile.name), [profile.name]);

  const stats = useMemo(
    () => ({
      tasks: tasks.filter((t) => t.status === 'completed').length,
      habits: habits.length,
      goals: goals.filter((g) => g.status === 'active').length,
      journal: journalEntries.length,
      funds: savingsGoals.length
    }),
    [tasks, habits, goals, journalEntries, savingsGoals]
  );

  const initial = (profile.name || (isAr ? 'ع' : 'N')).charAt(0).toUpperCase();

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const next = nameInput.trim();
    if (!next) return;
    updateProfileName(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / {isAr ? 'الملف' : 'PROFILE'}</span>
          </div>
          <h1>{isAr ? 'الملف الشخصي' : 'Your Profile'}</h1>
          <p>
            {isAr
              ? 'هويتك وتقدّمك على هذا الجهاز. الإعدادات تعيش في صفحة مستقلة.'
              : 'Your identity and progress on this device. Configuration lives in its own page.'}
          </p>
        </div>
      </div>

      <div className="settings-layout">
        <section>
          <div className="panel settings-section">
            <div className="settings-profile">
              <span className="settings-avatar">{initial}</span>
              <div>
                <strong>{profile.name || (isAr ? 'مستخدم نقطة' : 'NUQTA User')}</strong>
                <small>{isAr ? 'ملف محلي · خاص' : 'Local profile · Private'}</small>
              </div>
            </div>

            <form onSubmit={handleSaveName} className="space-y-3">
              <div className="field">
                <label htmlFor="profile-name-field">{isAr ? 'اسم العرض' : 'Display Name'}</label>
                <input
                  id="profile-name-field"
                  className="input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={60}
                  placeholder={isAr ? 'اكتب اسمك' : 'Enter your name'}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn primary" disabled={!nameInput.trim()}>
                  {saved ? (isAr ? 'تم الحفظ ✓' : 'Saved ✓') : isAr ? 'حفظ الاسم' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel settings-section">
            <h2>{isAr ? 'تقدّمك' : 'Your Progress'}</h2>
            <p>{isAr ? 'ملخّص لما بنيته على هذا الجهاز.' : 'A snapshot of what you have built on this device.'}</p>
            <div className="review-score">
              <div className="review-metric">
                <strong>{stats.tasks}</strong>
                <span>{isAr ? 'مهام مكتملة' : 'Tasks done'}</span>
              </div>
              <div className="review-metric">
                <strong>{stats.habits}</strong>
                <span>{isAr ? 'عادات' : 'Habits'}</span>
              </div>
              <div className="review-metric">
                <strong>{stats.goals}</strong>
                <span>{isAr ? 'أهداف نشطة' : 'Active goals'}</span>
              </div>
              <div className="review-metric">
                <strong>{stats.journal}</strong>
                <span>{isAr ? 'تدوينات' : 'Journal'}</span>
              </div>
              <div className="review-metric">
                <strong>{stats.funds}</strong>
                <span>{isAr ? 'صناديق ادخار' : 'Funds'}</span>
              </div>
            </div>
          </div>
        </section>

        <aside>
          <div className="privacy-note">
            <span className="privacy-icon" aria-hidden="true">
              <NuqtaIcon name="lock" className="w-4 h-4" />
            </span>
            <div>
              <strong>{isAr ? 'خصوصية مطلقة' : 'Absolutely private'}</strong>
              <p>
                {isAr
                  ? 'ملفك وبياناتك لا تغادر هذا المتصفح أبداً.'
                  : 'Your profile and data never leave this browser.'}
              </p>
            </div>
          </div>

          <div className="panel settings-section" style={{ marginTop: '13px' }}>
            <h2>{isAr ? 'الإعدادات والبيانات' : 'Settings & Data'}</h2>
            <p>
              {isAr
                ? 'المظهر، اللغة، الإشعارات، النسخ الاحتياطي، وأدوات البيانات.'
                : 'Appearance, language, notifications, backups and data tools.'}
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setActiveNavTab('settings')}
              >
                <NuqtaIcon name="settings" className="w-4 h-4" />
                <span>{isAr ? 'فتح الإعدادات' : 'Open Settings'}</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
