import React, { useEffect, useState } from 'react';
import { useNuqtaStore } from './store/nuqtaStore';
import { NuqtaIcon, IconName } from './components/NuqtaIcon';

// Modals
import { RescueModal } from './components/RescueModal';
import { SundayRitualModal } from './components/SundayRitualModal';

// Views
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { HabitsView } from './components/HabitsView';
import { GoalsView } from './components/GoalsView';
import { FocusView } from './components/FocusView';
import { CalendarView } from './components/CalendarView';
import { HealthView } from './components/HealthView';
import { FinanceView } from './components/FinanceView';
import { JournalView } from './components/JournalView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { QuranView } from './components/QuranView';
import { ReadingView } from './components/ReadingView';
import { WorkoutView } from './components/WorkoutView';
import { DrawingView } from './components/DrawingView';
import { ArchiveHistoryView } from './components/ArchiveHistoryView';
import { useNuqtaReminders } from './lib/useNuqtaReminders';
import { CommandPalette, CommandItem } from './components/CommandPalette';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NuqtaNotificationEngine } from './lib/notifications';

export default function App() {
  useNuqtaReminders();

  const {
    activeNavTab,
    setActiveNavTab,
    initializeStore,
    profile,
    setLanguage,
    setTheme,
    setRescueModeOpen,
    tasks,
    habits
  } = useNuqtaStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Sync html and body theme classes reliably
  useEffect(() => {
    const isLight = profile.theme === 'light';
    if (isLight) {
      document.documentElement.classList.add('light-mode');
      document.body.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
      document.body.classList.remove('light-mode');
    }
  }, [profile.theme]);

  // Global hotkeys (Q for new task, Escape to close sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
        return;
      }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsPaletteOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        !!target &&
        ((!!tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) || target.isContentEditable);
      const isComposing = e.isComposing || e.keyCode === 229;
      const isQuickCaptureKey =
        (e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

      if (!isQuickCaptureKey || isEditable || isComposing) return;

      e.preventDefault();
      const focusInput = () => {
        const el = document.getElementById('quick-capture-input') as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
          return true;
        }
        return false;
      };

      if (!focusInput()) {
        setActiveNavTab('today');
        window.setTimeout(focusInput, 80);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveNavTab]);

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDueCount = tasks.filter((t) => t.status !== 'completed' && t.scheduledDate === todayStr).length;

  const workspaceNav: Array<{ id: typeof activeNavTab; label: string; icon: IconName; count?: number }> = [
    { id: 'today', label: isAr ? 'نظرة عامة' : 'Overview', icon: 'grid', count: todayDueCount },
    { id: 'tasks', label: isAr ? 'المهام' : 'Tasks', icon: 'check-square' },
    { id: 'habits', label: isAr ? 'العادات' : 'Habits', icon: 'repeat' },
    { id: 'goals', label: isAr ? 'الأهداف' : 'Goals', icon: 'target' },
    { id: 'focus', label: isAr ? 'التركيز' : 'Focus', icon: 'timer' },
    { id: 'calendar', label: isAr ? 'التقويم' : 'Calendar', icon: 'calendar' }
  ];

  const studiosNav: Array<{ id: typeof activeNavTab; label: string; icon: IconName }> = [
    { id: 'quran', label: isAr ? 'حفظ القرآن' : 'Quran Studio', icon: 'book-open' },
    { id: 'reading', label: isAr ? 'استوديو القراءة' : 'Reading Vault', icon: 'book-open' },
    { id: 'workout', label: isAr ? 'اللياقة البدنية' : 'Home Workout', icon: 'activity' },
    { id: 'drawing', label: isAr ? 'مرسم الإبداع' : 'Art Studio', icon: 'grid' }
  ];

  const lifeNav: Array<{ id: typeof activeNavTab; label: string; icon: IconName }> = [
    { id: 'archive', label: isAr ? 'الذاكرة والأرشيف' : 'Archive & History', icon: 'archive' },
    { id: 'finance', label: isAr ? 'المال' : 'Money', icon: 'wallet' },
    { id: 'health', label: isAr ? 'الصحة' : 'Health', icon: 'activity' },
    { id: 'journal', label: isAr ? 'اليوميات' : 'Journal', icon: 'book-open' },
    { id: 'insights', label: isAr ? 'الرؤى' : 'Insights', icon: 'chart' }
  ];

  const paletteItems: CommandItem[] = [
    ...[...workspaceNav, ...studiosNav, ...lifeNav].map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      hint: isAr ? 'صفحة' : 'Page',
      group: isAr ? 'التنقل' : 'Navigate',
      keywords: [String(item.id)],
      run: () => setActiveNavTab(item.id)
    })),
    {
      id: 'act-settings',
      label: isAr ? 'الإعدادات والبيانات' : 'Settings & Data',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['settings', 'preferences', 'data', 'backup'],
      run: () => setActiveNavTab('settings')
    },
    {
      id: 'act-simulator',
      label: isAr ? 'محاكي التراكم (ماذا لو)' : 'What-If Simulator',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['simulator', 'what if'],
      run: () => setActiveNavTab('simulator')
    },
    {
      id: 'act-focus',
      label: isAr ? 'بدء جلسة تركيز' : 'Start a Focus Session',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['focus', 'timer', 'pomodoro'],
      run: () => setActiveNavTab('focus')
    }
  ];

  const getPageTitle = () => {
    switch (activeNavTab) {
      case 'today': return isAr ? 'نظرة عامة' : 'Overview';
      case 'tasks': return isAr ? 'المهام' : 'Tasks';
      case 'habits': return isAr ? 'العادات' : 'Habits';
      case 'quran': return isAr ? 'استوديو حفظ القرآن' : 'Quran Studio';
      case 'reading': return isAr ? 'استوديو وخزانة القراءة' : 'Reading Vault';
      case 'workout': return isAr ? 'استوديو اللياقة المنزلية' : 'Home Workout';
      case 'drawing': return isAr ? 'مرسم الإبداع والفن' : 'Creative Art Studio';
      case 'goals': return isAr ? 'الأهداف' : 'Goals';
      case 'focus': return isAr ? 'التركيز' : 'Focus';
      case 'calendar': return isAr ? 'التقويم' : 'Calendar';
      case 'finance': return isAr ? 'المال' : 'Money';
      case 'health': return isAr ? 'الصحة' : 'Health';
      case 'journal': return isAr ? 'اليوميات' : 'Journal';
      case 'insights': return isAr ? 'الرؤى والأنماط' : 'Insights & Patterns';
      case 'archive': return isAr ? 'الذاكرة الشاملة والأرشيف الموحد' : 'Universal Archive & History';
      case 'settings': return isAr ? 'الإعدادات والبيانات' : 'Settings & Data';
      case 'simulator': return isAr ? 'محاكي التراكم' : '"What If" Simulator';
      default: return isAr ? 'نظرة عامة' : 'Overview';
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      {/* Global Modals */}
      <RescueModal />
      <SundayRitualModal />
      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={paletteItems}
        isAr={isAr}
      />
      <GlobalSearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        isAr={isAr}
        onOpenResult={(result) => setActiveNavTab(result.domain)}
      />

      {/* Mobile Scrim Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`sidebar-scrim ${sidebarOpen ? 'open' : ''}`}
      />

      {/* ==================== SIDEBAR ==================== */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        {/* Brand Row with Collapse Toggle */}
        <div className="brand-row justify-between">
          <div className="flex items-center gap-2.5">
            <div className="brand-mark"></div>
            <div className="brand-copy">
              <span className="brand-name">
                NUQTA<span className="brand-period">.</span>
              </span>
              <span className="brand-tag">
                {isAr ? 'نظام إدارة الحياة' : 'Life Operating System'}
              </span>
            </div>
          </div>

          {/* Hide Sidebar button (Desktop & Mobile) */}
          <button
            onClick={() => {
              if (window.innerWidth <= 900) {
                setSidebarOpen(false);
              } else {
                setSidebarCollapsed(true);
              }
            }}
            className="icon-btn text-muted hover:text-[var(--text-primary)]"
            title={isAr ? 'إخفاء الشريط الجانبي' : 'Collapse Sidebar'}
          >
            <span className="text-sm font-bold">◨</span>
          </button>
        </div>

        {/* Quick Capture Shortcut Button */}
        <button
          onClick={() => {
            setActiveNavTab('tasks');
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          className="capture-shortcut"
        >
          <span className="capture-plus">+</span>
          <span>{isAr ? 'التقاط فوري' : 'Quick Capture'}</span>
          <kbd>Q</kbd>
        </button>

        {/* Workspace Nav Group */}
        <div className="nav-label">
          {isAr ? 'مساحة العمل' : 'Workspace'}
        </div>
        <nav className="primary-nav">
          {workspaceNav.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  setActiveNavTab(item.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="truncate flex-1">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="nav-trailing">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Specialized Habit Studios Group */}
        <div className="nav-label nav-label-spaced">
          {isAr ? 'استوديوهات الإتقان' : 'Habit Studios'}
        </div>
        <nav className="primary-nav">
          {studiosNav.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  setActiveNavTab(item.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="truncate flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Life & Self Group */}
        <div className="nav-label nav-label-spaced">
          {isAr ? 'الحياة والذات' : 'Life & Self'}
        </div>
        <nav className="primary-nav">
          {lifeNav.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  setActiveNavTab(item.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="truncate flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer"></div>

        {/* Sidebar Footer Advice Card */}
        <div className="sidebar-footer-card">
          <span className="footer-spark">✳</span>
          <p>
            {isAr
              ? 'ليس مطلوبًا أن تفعل كل شيء؛ ركّز على نقطة واحدة واضحة لليوم.'
              : 'You do not have to do everything. Choose strictly 1 clear anchor.'}
          </p>
          <button
            onClick={() => setRescueModeOpen(true)}
            className="text-link"
          >
            <span>{isAr ? 'وضع الإنقاذ' : 'Rescue Mode'}</span>
            <span>↗</span>
          </button>
        </div>

        {/* Bottom Profile and Settings Row */}
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              setActiveNavTab('settings');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`nav-item ${activeNavTab === 'settings' ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <NuqtaIcon name="settings" className="w-4 h-4" />
            </span>
            <span>{isAr ? 'الإعدادات والبيانات' : 'Settings & Data'}</span>
          </button>

          <button
            onClick={() => {
              setActiveNavTab('settings');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="profile-row"
          >
            <span className="avatar">
              {(profile.name || (isAr ? 'ع' : 'N')).charAt(0)}
            </span>
            <div className="profile-details">
              <strong>{profile.name || (isAr ? 'علي' : 'User')}</strong>
              <small>
                {isAr ? 'ملف محلي · خاص' : 'Local profile · Private'}
              </small>
            </div>
            <span className="more-dots">···</span>
          </button>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-start">
            <button
              onClick={() => {
                if (window.innerWidth <= 900) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className={`icon-btn ${sidebarCollapsed ? 'border-accent/40 bg-accent/10 text-accent' : ''}`}
              aria-label="Toggle sidebar"
              title={isAr ? (sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'إخفاء الشريط الجانبي') : (sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar')}
            >
              <NuqtaIcon name="menu" className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="breadcrumbs">
              <span>{isAr ? 'مساحتك' : 'Workspace'}</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{getPageTitle()}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Local Only Pill */}
            <div className="offline-pill">
              <span className="status-dot"></span>
              <span>{isAr ? 'محلي وآمن' : 'Local & private'}</span>
            </div>

            {/* Global Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="icon-btn"
              title={isAr ? 'البحث الشامل (Ctrl+Shift+F)' : 'Global Search (Ctrl+Shift+F)'}
              aria-label={isAr ? 'البحث الشامل' : 'Global search'}
            >
              <NuqtaIcon name="search" className="w-4 h-4" />
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              className="icon-btn"
              title={isAr ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
            >
              <span className="lang-glyph">{isAr ? 'EN' : 'ع'}</span>
            </button>

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={() => setTheme(profile.theme === 'dark' ? 'light' : 'dark')}
              className="icon-btn"
              title={profile.theme === 'dark' ? (isAr ? 'المظهر الفاتح' : 'Light Mode') : (isAr ? 'المظهر الداكن' : 'Dark Mode')}
            >
              <NuqtaIcon name={profile.theme === 'dark' ? 'sun' : 'moon'} className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationModal(!showNotificationModal)}
                className="icon-btn"
                title={isAr ? 'مركز الإشعارات والتنبيهات' : 'Notification Center'}
              >
                <NuqtaIcon name="bell" className="w-4 h-4" />
                {todayDueCount > 0 && (
                  <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-accent-strong animate-pulse"></span>
                )}
              </button>

              {/* Notification Center Dropdown */}
              {showNotificationModal && (
                <div
                  className="absolute top-full mt-2 end-0 w-80 panel p-4 z-50 shadow-2xl space-y-3"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2">
                    <strong className="text-xs font-mono uppercase tracking-wider text-accent">
                      {isAr ? 'مركز التنبيهات المحلي' : 'Local Alert Center'}
                    </strong>
                    <button
                      onClick={() => setShowNotificationModal(false)}
                      className="text-xs text-muted hover:text-[var(--text-primary)]"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-[var(--surface-faint)] border border-[var(--hairline)]">
                      <div className="flex items-center gap-2 mb-1">
                        <NuqtaIcon name="timer" className="w-3.5 h-3.5 text-accent" />
                        <strong>{isAr ? 'مهام اليوم المجدولة' : "Today's Schedule"}</strong>
                      </div>
                      <p className="text-[11px] text-muted">
                        {todayDueCount > 0
                          ? isAr
                            ? `لديك ${todayDueCount} مهمة بانتظار إنجازك اليوم.`
                            : `You have ${todayDueCount} tasks pending today.`
                          : isAr
                          ? 'لا توجد مهام متأخرة أو معلقة.'
                          : 'All clean. No overdue items.'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded bg-[var(--surface-faint)] border border-[var(--hairline)]">
                      <div className="flex items-center gap-2 mb-1">
                        <NuqtaIcon name="repeat" className="w-3.5 h-3.5 text-accent" />
                        <strong>{isAr ? 'طقوس العادات اليومية' : 'Daily Habits'}</strong>
                      </div>
                      <p className="text-[11px] text-muted">
                        {habits.length > 0
                          ? isAr
                            ? `متابعة ${habits.length} عادات مستمرة بدون كسر السلسلة.`
                            : `Tracking ${habits.length} active daily habits.`
                          : isAr
                          ? 'لم تسجل عادات بعد.'
                          : 'No habits logged.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--hairline)] flex items-center justify-between">
                    <button
                      onClick={async () => {
                        await NuqtaNotificationEngine.requestPermission();
                        NuqtaNotificationEngine.notify({
                          title: isAr ? 'نظام الإشعارات نشط' : 'Notifications Active',
                          body: isAr ? 'ستصلك التنبيهات في أوقات المهام المحددة.' : 'You will receive timely cues on due times.',
                          tag: 'bell-activate',
                          chime: 'gentle-bell'
                        });
                        setShowNotificationModal(false);
                      }}
                      className="btn subtle text-[11px] py-1 px-2.5"
                    >
                      {isAr ? 'تفعيل إشعارات المتصفح' : 'Enable Device Alerts'}
                    </button>
                    <button
                      onClick={() => {
                        setActiveNavTab('settings');
                        setShowNotificationModal(false);
                      }}
                      className="text-[11px] text-accent hover:underline"
                    >
                      {isAr ? 'الإعدادات ↗' : 'Settings ↗'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {activeNavTab === 'today' && <DashboardView />}
          {activeNavTab === 'tasks' && <TasksView />}
          {activeNavTab === 'habits' && <HabitsView />}
          {activeNavTab === 'quran' && <QuranView />}
          {activeNavTab === 'reading' && <ReadingView />}
          {activeNavTab === 'workout' && <WorkoutView />}
          {activeNavTab === 'drawing' && <DrawingView />}
          {activeNavTab === 'goals' && <GoalsView />}
          {activeNavTab === 'focus' && <FocusView />}
          {activeNavTab === 'calendar' && <CalendarView />}
          {activeNavTab === 'finance' && <FinanceView />}
          {activeNavTab === 'health' && <HealthView />}
          {activeNavTab === 'journal' && <JournalView />}
          {activeNavTab === 'insights' && <InsightsView />}
          {activeNavTab === 'archive' && <ArchiveHistoryView />}
          {activeNavTab === 'settings' && <SettingsView />}
          {activeNavTab === 'simulator' && <WhatIfSimulator />}
        </main>

        {/* App Footer */}
        <footer className="app-footer">
          <span>
            NUQTA<span style={{ color: 'var(--accent-strong)' }}>.</span>{' '}
            <span>{isAr ? 'وقت أقل في الإدارة. حياة أكثر في عيشها.' : 'Less time managing. More life lived.'}</span>
          </span>
          <span className="footer-privacy">
            <NuqtaIcon name="lock" className="tiny-lock" />
            <span>{isAr ? 'بياناتك لا تغادر هذا الجهاز' : 'Your data stays on this device'}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
