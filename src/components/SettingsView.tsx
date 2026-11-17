import { csvCell, downloadBackupFile, downloadTextFile, restoreBackupFromFile } from '../lib/backupActions';
import { localDateKey } from '../lib/dateKey';
import React, { useState, useEffect } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';
import { NuqtaStorageEngine } from '../lib/storage';
import { NuqtaNotificationEngine, nuqtaAudio } from '../lib/notifications';
import { NuqtaSelect } from './ui';

export const SettingsView: React.FC = () => {
  const { profile, setLanguage, setTheme, setActiveNavTab } = useNuqtaStore();
  const [importStatus, setImportStatus] = useState<string>('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setNotifPermission(NuqtaNotificationEngine.getPermission());
  }, []);

  const handleRequestPermission = async () => {
    const res = await NuqtaNotificationEngine.requestPermission();
    setNotifPermission(res);
  };

  const isAr = profile.language === 'ar';

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
            <span>NUQTA / CONTROL</span>
          </div>
          <h1>{isAr ? 'الإعدادات والبيانات' : 'Settings & Data'}</h1>
          <p>
            {isAr
              ? 'تحكم كامل في مظهر مساحة العمل، تصدير واستيراد البيانات، والخصوصية المطلقة.'
              : 'Complete control over workspace preferences, data exports, backups, and local-first privacy.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn primary" onClick={handleExportJSON}>
            <span>{isAr ? 'تصدير نسخة احتياطية' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left Column: Profile, Appearance, Data */}
        <section>
          {/* Profile lives on its own page; Settings links to it instead of duplicating the form. */}
          <div className="panel settings-section">
            <div className="panel-heading">
              <div>
                <h2>{isAr ? 'الملف الشخصي' : 'Your Profile'}</h2>
                <p>{isAr ? 'هويتك وتقدّمك في صفحة مستقلة.' : 'Your identity and progress live on their own page.'}</p>
              </div>
            </div>

            <div className="settings-profile">
              <span className="settings-avatar">{(profile.name || 'ع').charAt(0)}</span>
              <div>
                <strong>{profile.name || (isAr ? 'مستخدم نقطة' : 'NUQTA User')}</strong>
                <small>{isAr ? 'بيانات محفوظة محلياً وبشكل خاص' : 'Stored locally and privately'}</small>
              </div>
            </div>

            <div className="settings-actions">
              <button type="button" className="btn" onClick={() => setActiveNavTab('profile')}>
                <NuqtaIcon name="compass" className="w-4 h-4" />
                <span>{isAr ? 'فتح الملف الشخصي' : 'Open Profile'}</span>
              </button>
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
            <p>{isAr ? 'تنبيهات المتصفح والنظام الصوتي التخليقي المحلي عند حلول مواعيد المهام والعادات وانتهاء التركيز.' : 'Browser notifications and synthesized harmonic chimes for tasks, habits, and focus sessions.'}</p>

            <div className="space-y-3 pt-2">
              <div className="toggle-row">
                <div className="toggle-copy">
                  <strong>{isAr ? 'إذن إشعارات المتصفح' : 'Browser Notification Permission'}</strong>
                  <small>
                    {notifPermission === 'granted'
                      ? (isAr ? 'الإشعارات مفعّلة في المتصفح' : 'Notifications granted')
                      : notifPermission === 'denied'
                      ? (isAr ? 'تم رفض الإذن من إعدادات المتصفح' : 'Permission blocked by browser')
                      : (isAr ? 'لم يتم تفعيل الإذن بعد' : 'Permission not requested yet')}
                  </small>
                </div>
                <button
                  type="button"
                  className={`btn small ${notifPermission === 'granted' ? 'subtle' : 'primary'}`}
                  onClick={handleRequestPermission}
                >
                  {notifPermission === 'granted'
                    ? (isAr ? 'مفعّل' : 'Granted')
                    : (isAr ? 'تفعيل الإشعارات' : 'Enable Notifications')}
                </button>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    NuqtaNotificationEngine.notify({
                      title: isAr ? 'تنبيه تجريبي من نقطة' : 'Nuqta Test Alert',
                      body: isAr
                        ? 'النظام الصوتي التخليقي وإشعارات المتصفح تعمل محلياً بكفاءة 100%!'
                        : 'Local synthesized audio and notifications are operating at 100%!',
                      tag: 'test-chime',
                      chime: 'focus-complete'
                    });
                  }}
                >
                  <NuqtaIcon name="bell" className="w-3.5 h-3.5 text-accent" />
                  <span>{isAr ? 'تجربة نغمة التركيز والإشعار' : 'Test Focus Chime & Alert'}</span>
                </button>

                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    nuqtaAudio.play('task-reminder');
                  }}
                >
                  <NuqtaIcon name="timer" className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نغمة المهمة' : 'Task Tone'}</span>
                </button>

                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    nuqtaAudio.play('habit-cue');
                  }}
                >
                  <NuqtaIcon name="repeat" className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نغمة العادة' : 'Habit Tone'}</span>
                </button>
              </div>
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
