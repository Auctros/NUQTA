import { csvCell, downloadBackupFile, downloadTextFile, restoreBackupFromFile } from '../lib/backupActions';
import { localDateKey } from '../lib/dateKey';
import React, { useState, useEffect, useMemo } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';
import { NuqtaStorageEngine } from '../lib/storage';
import { resetSyncState } from '../lib/sync/lifecycle';
import { NuqtaNotificationEngine, nuqtaAudio } from '../lib/notifications';
import { NuqtaSelect, NuqtaTimePicker } from './ui';
import { isCategoryEnabled } from '../lib/notificationEngine';
import { renderNotificationText } from '../lib/notificationMessages';
import type { NotificationCategory } from '../types';

/** The categories a user can switch. `reminder` is a system alias, not a choice. */
const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'task',
  'habit',
  'goal',
  'focus',
  'health',
  'finance',
  'system'
];

const CATEGORY_LABEL: Record<NotificationCategory, { ar: string; en: string }> = {
  task: { ar: 'المهام', en: 'Tasks' },
  habit: { ar: 'العادات', en: 'Habits' },
  goal: { ar: 'الأهداف', en: 'Goals' },
  focus: { ar: 'التركيز', en: 'Focus sessions' },
  health: { ar: 'الصحة', en: 'Health' },
  finance: { ar: 'المال', en: 'Money' },
  system: { ar: 'النظام', en: 'System' },
  reminder: { ar: 'تذكير', en: 'Reminder' }
};

export const ProfileView: React.FC = () => {
  const {
    profile,
    updateProfileName,
    setLanguage,
    setTheme,
    tasks,
    habits,
    goals,
    journalEntries,
    savingsGoals,
    notificationPreferences,
    setNotificationPreferences,
    notify
  } = useNuqtaStore();
  const [importStatus, setImportStatus] = useState<string>('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [notifSupported, setNotifSupported] = useState(true);
  const [nameInput, setNameInput] = useState(profile.name);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setNotifSupported(NuqtaNotificationEngine.isSupported());
    setNotifPermission(NuqtaNotificationEngine.getPermission());
  }, []);

  useEffect(() => setNameInput(profile.name), [profile.name]);

  const handleRequestPermission = async () => {
    const res = await NuqtaNotificationEngine.requestPermission();
    setNotifPermission(res);
    // Granting permission is the user's intent to use the channel, so switch it on here
    // rather than making them grant and then toggle a second control.
    if (res === 'granted') {
      setNotificationPreferences({ ...notificationPreferences, browser: true });
    }
  };

  const isAr = profile.language === 'ar';

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const next = nameInput.trim();
    if (!next) return;
    updateProfileName(next);
    setNameSaved(true);
    window.setTimeout(() => setNameSaved(false), 2200);
  };

  const profileStats = useMemo(
    () => ({
      tasks: tasks.filter((t) => t.status === 'completed').length,
      habits: habits.length,
      goals: goals.filter((g) => g.status === 'active').length,
      journal: journalEntries.length,
      funds: savingsGoals.length
    }),
    [tasks, habits, goals, journalEntries, savingsGoals]
  );

  const avatarInitial = profile.name ? profile.name.charAt(0).toUpperCase() : '';

  const handleExportJSON = () => downloadBackupFile('nuqta-backup');

  const handleExportCSV = () => {
    const tasks = NuqtaStorageEngine.getTasks();
    const headers = ['id', 'title', 'status', 'priority', 'dueDate', 'time', 'estimatedMinutes', 'tags'];
    const rows = [headers.map(csvCell).join(',')];
    tasks.forEach((t) => {
      rows.push(
        [t.id, t.title, t.status, t.priority, t.scheduledDate, t.scheduledTime, t.estimatedMinutes, (t.tags || []).join(';')]
          .map(csvCell)
          .join(',')
      );
    });
    downloadTextFile(`nuqta-tasks-${localDateKey()}.csv`, '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await restoreBackupFromFile(file, isAr, setImportStatus);
    if (result && result.ok) setTimeout(() => window.location.reload(), 1000);
  };

  const handleWipeData = async () => {
    const ok = window.confirm(
      isAr
        ? 'سيتم حذف كل بيانات نقطة من هذا المتصفح نهائياً (التخزين الأساسي والنسخة الاحتياطية الداخلية). صدّر نسخة احتياطية أولاً إن أردت الاحتفاظ بها. متابعة؟'
        : 'This permanently deletes ALL NUQTA data from this browser (primary storage and its internal mirror). Export a backup first if you want to keep it. Continue?'
    );
    if (!ok) return;
    const wiped = await NuqtaStorageEngine.wipeAll();
    if (!wiped) {
      window.alert(
        isAr
          ? 'تعذّر مسح كل البيانات، ولم يتم حذف شيء. جرّب مجدداً أو امسح بيانات الموقع من إعدادات المتصفح.'
          : 'Not everything could be deleted, so nothing was removed. Try again or clear site data from your browser settings.'
      );
      return;
    }
    // Drop queued/pulled sync state too. Otherwise a reconnect would either replay
    // changes for deleted records or pull the whole history back into a wiped device.
    resetSyncState();
    window.location.reload();
  };

  const handleLoadSample = () => {
    if (NuqtaStorageEngine.loadDemoData()) window.location.reload();
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / PROFILE</span>
          </div>
          <h1>{isAr ? 'الملف الشخصي' : 'Your Profile'}</h1>
          <p>
            {isAr
              ? 'هويتك، تقدّمك، تفضيلات مساحة العمل، وإدارة بياناتك وخصوصيتك — كلها في مكان واحد.'
              : 'Your identity, progress, workspace preferences, and data — all in one place.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn primary" onClick={handleExportJSON}>
            <span>{isAr ? 'تصدير نسخة احتياطية' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left Column: Identity, Progress, Preferences, Data */}
        <section>
          <div className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>{isAr ? 'الملف الشخصي' : 'Your Profile'}</h2>
                <p>{isAr ? 'هويتك وتقدّمك على هذا الجهاز.' : 'Your identity and progress on this device.'}</p>
              </div>
            </div>

            <div className="settings-profile">
              <span className="settings-avatar">
                {avatarInitial || <NuqtaIcon name="user" className="w-5 h-5" />}
              </span>
              <div>
                <strong>{profile.name || (isAr ? 'المستخدم' : 'User')}</strong>
                <small>{isAr ? 'بيانات محفوظة محلياً وبشكل خاص' : 'Stored locally and privately'}</small>
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
                  {nameSaved ? (
                    <span className="inline-flex items-center gap-1.5">
                      <NuqtaIcon name="check" className="w-4 h-4" />
                      {isAr ? 'تم الحفظ' : 'Saved'}
                    </span>
                  ) : isAr ? 'حفظ الاسم' : 'Save Name'}
                </button>
              </div>
            </form>

            <div className="subtle-line"></div>

            <h2>{isAr ? 'تقدّمك' : 'Your Progress'}</h2>
            <p>{isAr ? 'ملخّص لما بنيته على هذا الجهاز.' : 'A snapshot of what you have built on this device.'}</p>
            <div className="review-score">
              <div className="review-metric">
                <strong>{profileStats.tasks}</strong>
                <span>{isAr ? 'مهام مكتملة' : 'Tasks done'}</span>
              </div>
              <div className="review-metric">
                <strong>{profileStats.habits}</strong>
                <span>{isAr ? 'عادات' : 'Habits'}</span>
              </div>
              <div className="review-metric">
                <strong>{profileStats.goals}</strong>
                <span>{isAr ? 'أهداف نشطة' : 'Active goals'}</span>
              </div>
              <div className="review-metric">
                <strong>{profileStats.journal}</strong>
                <span>{isAr ? 'تدوينات' : 'Journal'}</span>
              </div>
              <div className="review-metric">
                <strong>{profileStats.funds}</strong>
                <span>{isAr ? 'صناديق ادخار' : 'Funds'}</span>
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="panel settings-section">
            <h2>{isAr ? 'التفضيلات والمظهر' : 'Preferences & Theme'}</h2>
            <p>{isAr ? 'اللغة والمظهر والوضع الليلي' : 'Language and appearance settings'}</p>

            <div className="field">
              <label>{isAr ? 'اللغة' : 'Language'}</label>
              <NuqtaSelect value={profile.language} onChange={(e) => setLanguage(e.target.value as any)}>
                <option value="ar">العربية (Arabic)</option>
                <option value="en">English</option>
              </NuqtaSelect>
            </div>

            <div className="toggle-row">
              <div className="toggle-copy">
                <strong>{isAr ? 'المظهر الداكن' : 'Dark Mode'}</strong>
                <small>
                  {profile.theme === 'dark' ? (isAr ? 'المظهر الداكن مفعّل' : 'Dark mode active') : (isAr ? 'المظهر الفاتح مفعّل' : 'Light mode active')}
                </small>
              </div>
              <button
                type="button"
                className={`btn small ${profile.theme === 'dark' ? 'primary' : 'subtle'}`}
                onClick={() => setTheme(profile.theme === 'dark' ? 'light' : 'dark')}
              >
                <NuqtaIcon name={profile.theme === 'dark' ? 'moon' : 'sun'} className="w-3.5 h-3.5" />
                <span>{profile.theme === 'dark' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')}</span>
              </button>
            </div>
          </div>

          {/* Notifications & Audio System */}
          <div className="panel settings-section">
            <h2>{isAr ? 'الإشعارات والتنبيهات الصوتية' : 'Notifications & Audio Alerts'}</h2>
            <p>
              {isAr
                ? 'الإشعارات تظهر داخل نقطة دائماً. يمكنك اختيار ما يصلك، وتفعيل تنبيهات الجهاز عند إغلاق التطبيق.'
                : 'Notifications always appear inside NUQTA. Choose what reaches you, and optionally mirror them to the device.'}
            </p>

            <div className="space-y-3 pt-2">
              <div className="toggle-row">
                <div className="toggle-copy">
                  <strong>{isAr ? 'تنبيهات الجهاز' : 'Device alerts'}</strong>
                  <small>
                    {!notifSupported
                      ? isAr
                        ? 'هذا المتصفح لا يدعم تنبيهات الجهاز.'
                        : 'This browser does not support device alerts.'
                      : notifPermission === 'granted'
                      ? isAr
                        ? 'مسموح. تُعرض التنبيهات أيضاً خارج التطبيق.'
                        : 'Allowed. Alerts also appear outside the app.'
                      : notifPermission === 'denied'
                      ? isAr
                        ? 'محظور من إعدادات المتصفح. الإشعارات داخل التطبيق تعمل كالمعتاد.'
                        : 'Blocked in browser settings. In-app notifications still work.'
                      : isAr
                        ? 'يتطلب إذن المتصفح. الإشعارات داخل التطبيق تعمل بالفعل.'
                        : 'Needs browser permission. In-app notifications already work.'}
                  </small>
                </div>
                {notifPermission === 'granted' ? (
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={notificationPreferences.browser}
                    onChange={(e) =>
                      setNotificationPreferences({ ...notificationPreferences, browser: e.target.checked })
                    }
                    aria-label={isAr ? 'تنبيهات الجهاز' : 'Device alerts'}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn small primary"
                    disabled={!notifSupported || notifPermission === 'denied'}
                    onClick={handleRequestPermission}
                  >
                    {isAr ? 'تفعيل' : 'Enable'}
                  </button>
                )}
              </div>

              <div className="pt-1">
                <strong className="text-[var(--fs-xs)] text-[var(--text-primary)]">
                  {isAr ? 'أنواع الإشعارات' : 'What you get notified about'}
                </strong>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex items-center justify-between gap-3 rounded-[var(--r-sm)] border border-[var(--border-subtle)] px-2.5 py-2"
                    >
                      <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                        {CATEGORY_LABEL[category][isAr ? 'ar' : 'en']}
                      </span>
                      <input
                        type="checkbox"
                        className="toggle"
                        checked={isCategoryEnabled(notificationPreferences, category)}
                        onChange={(e) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            categories: {
                              ...notificationPreferences.categories,
                              [category]: e.target.checked
                            }
                          })
                        }
                        aria-label={CATEGORY_LABEL[category][isAr ? 'ar' : 'en']}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="toggle-row">
                <div className="toggle-copy">
                  <strong>{isAr ? 'ساعات الهدوء' : 'Quiet hours'}</strong>
                  <small>
                    {isAr
                      ? 'إيقاف تنبيهات الجهاز خلال هذه الفترة. تبقى الإشعارات داخل التطبيق.'
                      : 'Silences device alerts during this window. In-app notifications still arrive.'}
                  </small>
                </div>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={notificationPreferences.quietHours?.enabled === true}
                  onChange={(e) =>
                    setNotificationPreferences({
                      ...notificationPreferences,
                      quietHours: {
                        enabled: e.target.checked,
                        start: notificationPreferences.quietHours?.start ?? '22:00',
                        end: notificationPreferences.quietHours?.end ?? '07:00'
                      }
                    })
                  }
                  aria-label={isAr ? 'ساعات الهدوء' : 'Quiet hours'}
                />
              </div>

              {notificationPreferences.quietHours?.enabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <NuqtaTimePicker
                    value={notificationPreferences.quietHours.start}
                    onChange={(e) =>
                      setNotificationPreferences({
                        ...notificationPreferences,
                        quietHours: { ...notificationPreferences.quietHours!, start: e.target.value }
                      })
                    }
                    isAr={isAr}
                    ariaLabel={isAr ? 'بداية ساعات الهدوء' : 'Quiet hours start'}
                    minuteStep={30}
                  />
                  <span className="text-[var(--fs-xs)] text-[var(--text-tertiary)]">
                    {isAr ? 'إلى' : 'to'}
                  </span>
                  <NuqtaTimePicker
                    value={notificationPreferences.quietHours.end}
                    onChange={(e) =>
                      setNotificationPreferences({
                        ...notificationPreferences,
                        quietHours: { ...notificationPreferences.quietHours!, end: e.target.value }
                      })
                    }
                    isAr={isAr}
                    ariaLabel={isAr ? 'نهاية ساعات الهدوء' : 'Quiet hours end'}
                    minuteStep={30}
                  />
                </div>
              )}

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const text = renderNotificationText('system.test', {}, { title: '' }, isAr);
                    notify({
                      category: 'system',
                      priority: 'normal',
                      title: text.title,
                      body: text.body,
                      route: { nav: 'profile' },
                      dedupeKey: `system:test:${crypto.randomUUID().slice(0, 8)}`,
                      messageId: 'system.test'
                    });
                  }}
                >
                  <NuqtaIcon name="bell" className="w-3.5 h-3.5 text-accent" />
                  <span>{isAr ? 'إشعار تجريبي' : 'Send a test notification'}</span>
                </button>

                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    nuqtaAudio.play('task-reminder');
                  }}
                >
                  <NuqtaIcon name="timer" className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نغمة المهمة' : 'Task tone'}</span>
                </button>

                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    nuqtaAudio.play('habit-cue');
                  }}
                >
                  <NuqtaIcon name="repeat" className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نغمة العادة' : 'Habit tone'}</span>
                </button>
              </div>

              <p className="text-[var(--fs-micro)] leading-[var(--lh-snug)] text-[var(--text-tertiary)]">
                {isAr
                  ? 'تُحفظ الإشعارات على هذا الجهاز فقط ولا تُزامن، لأن حالة القراءة تخصك أنت على هذا الجهاز.'
                  : 'Notifications are stored on this device only and are not synced, because read state is yours on this device.'}
              </p>
            </div>
          </div>

          {/* Data Portability Tools */}
          <div className="panel settings-section">
            <h2>{isAr ? 'أدوات ونقل البيانات (Data Portability)' : 'Data Portability & Backups'}</h2>
            <p>{isAr ? 'بياناتك ملكك بالكامل. يمكنك أخذ نسخة احتياطية أو استعادتها في أي وقت.' : 'No lock-in. Keep a local backup or restore anytime.'}</p>

            <div className="settings-actions">
              <button className="btn" onClick={handleExportJSON}>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
                <span>{isAr ? 'تصدير نسخة احتياطية كاملة (JSON)' : 'Export Full Backup (JSON)'}</span>
              </button>

              <button className="btn" onClick={handleExportCSV}>
                <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
                <span>{isAr ? 'تصدير جدول المهام (CSV)' : 'Export Tasks (CSV)'}</span>
              </button>

              <label className="btn cursor-pointer justify-start">
                <NuqtaIcon name="plus" className="w-3.5 h-3.5" />
                <span>{isAr ? 'استيراد نسخة سابقة (JSON)' : 'Import Backup (JSON)'}</span>
                <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>

              <button className="btn" onClick={() => window.print()}>
                <NuqtaIcon name="book-open" className="w-3.5 h-3.5" />
                <span>{isAr ? 'طباعة / حفظ كـ PDF' : 'Print / Save as PDF'}</span>
              </button>
            </div>

            {importStatus && (
              <p className="text-xs text-accent font-mono text-center pt-3">{importStatus}</p>
            )}

            {NuqtaStorageEngine.isDemo() && (
              <p className="small-muted text-center pt-3">
                {isAr ? 'تعرض الآن بيانات تجريبية. امسح البيانات للبدء من الصفر.' : 'You are viewing sample data. Wipe to start fresh.'}
              </p>
            )}
            {NuqtaStorageEngine.isEmpty() && (
              <button className="btn w-full justify-center mt-3" onClick={handleLoadSample}>
                <span>{isAr ? 'تحميل بيانات تجريبية (اختياري)' : 'Load sample data (optional)'}</span>
              </button>
            )}

            <div className="subtle-line"></div>

            <button
              onClick={handleWipeData}
              className="btn danger w-full justify-center"
            >
              <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
              <span>{isAr ? 'مسح كافة البيانات وإعادة الضبط' : 'Wipe all local data & Reset'}</span>
            </button>
          </div>
        </section>

        {/* Right Column: Privacy Constitution */}
        <aside>
          <div className="panel settings-section">
            <div className="privacy-note">
              <span className="privacy-icon">
                <NuqtaIcon name="lock" className="w-5 h-5 text-accent" />
              </span>
              <div>
                <strong>{isAr ? 'دستور الخصوصية المطلقة' : 'Absolute Privacy by Design'}</strong>
                <p>
                  {isAr
                    ? 'صممت "نقطة" بمبدأ محلي-أولاً (Local-First). كل مهمة، عادة، فكرة، وتدوينة تُحفظ في قاعدة بيانات متصفحك مباشرة دون وسيط أو تتبع.'
                    : 'Nuqta runs entirely local-first. Your tasks, habits, reflections, and numbers never leave this machine.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4 text-[11px] font-mono text-muted">
              <div className="flex items-center gap-2">
                <NuqtaIcon name="check" className="w-3.5 h-3.5 text-accent" />
                <span>{isAr ? 'تخزين خاص على جهازك فقط' : 'Private on-device storage'}</span>
              </div>
              <div className="flex items-center gap-2">
                <NuqtaIcon name="check" className="w-3.5 h-3.5 text-accent" />
                <span>{isAr ? 'بدون خوادم سحابية إلزامية' : 'Zero Cloud Surveillance'}</span>
              </div>
              <div className="flex items-center gap-2">
                <NuqtaIcon name="check" className="w-3.5 h-3.5 text-accent" />
                <span>{isAr ? 'تصدير حر بصيغة قياسية مفتوحة' : 'Open JSON / CSV Portability'}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
