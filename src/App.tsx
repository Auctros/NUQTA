import { NuqtaStorageEngine } from './lib/storage';
import { StorageIssueBanner } from './components/StorageIssueBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { localDateKey } from './lib/dateKey';
import { isTaskPending } from './lib/taskStatus';
import React, { useEffect, useState } from 'react';
import { useNuqtaStore } from './store/nuqtaStore';
import { NuqtaIcon, IconName } from './components/NuqtaIcon';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { applyThemeClass } from './lib/themeTransition';

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
import { ProfileView } from './components/ProfileView';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { QuranView } from './components/QuranView';
import { ReadingView } from './components/ReadingView';
import { WorkoutView } from './components/WorkoutView';
import { DrawingView } from './components/DrawingView';
import { ArchiveHistoryView } from './components/ArchiveHistoryView';
import { useNuqtaReminders } from './lib/useNuqtaReminders';
import { CommandPalette, CommandItem } from './components/CommandPalette';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NuqtaNotificationEngine, listenForNotificationRoutes } from './lib/notifications';

export default function App() {
  useNuqtaReminders();

  useEffect(() => listenForNotificationRoutes(), []);

  const {
    activeNavTab,
    setActiveNavTab,
    initializeStore,
    profile,
    setLanguage,
    setTheme,
    setRescueModeOpen,
    requestFocus,
    tasks,
    habits
  } = useNuqtaStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sidebarTooltip, setSidebarTooltip] = useState<{
    id: string;
    label: string;
    badge?: string;
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const topbarToggleRef = React.useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    NuqtaStorageEngine.recoverFromMirrorIfNeeded()
      .catch(() => false)
      .then(() => {
        if (!cancelled) initializeStore();
      });
    return () => {
      cancelled = true;
    };
  }, [initializeStore]);

  // Sync html and body theme classes reliably on load and theme changes
  useEffect(() => {
    applyThemeClass(profile.theme);
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
    const handleOpenSearch = () => setIsSearchOpen(true);
    const handleOpenPalette = () => setIsPaletteOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('nuqta:open-search', handleOpenSearch);
    window.addEventListener('nuqta:open-palette', handleOpenPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('nuqta:open-search', handleOpenSearch);
      window.removeEventListener('nuqta:open-palette', handleOpenPalette);
    };
  }, [setActiveNavTab]);

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();
  const todayDueCount = tasks.filter((t) => isTaskPending(t) && t.scheduledDate === todayStr).length;

  useEffect(() => {
    if (!sidebarCollapsed) {
      setSidebarTooltip(null);
    }
  }, [sidebarCollapsed]);

  const showCollapsedTooltip = (
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    id: string,
    label: string,
    badge?: string
  ) => {
    if (!sidebarCollapsed || typeof window === 'undefined' || window.innerWidth <= 900) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSidebarTooltip({
      id,
      label,
      badge,
      top: rect.top + rect.height / 2,
      ...(isAr ? { right: Math.round(window.innerWidth - rect.left + 12) } : { left: Math.round(rect.right + 12) })
    });
  };

  const hideCollapsedTooltip = () => {
    setSidebarTooltip(null);
  };

  const handleSidebarKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      setSidebarTooltip(null);
      if (typeof window !== 'undefined' && window.innerWidth <= 900 && sidebarOpen) {
        setSidebarOpen(false);
        topbarToggleRef.current?.focus();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const target = e.target as HTMLElement | null;
    if (!target || target.dataset.sidebarNav !== 'true') return;

    const aside = sidebarRef.current;
    if (!aside) return;
    const items = Array.from(aside.querySelectorAll<HTMLButtonElement>('button[data-sidebar-nav="true"]')).filter(
      (btn) => !btn.disabled && btn.tabIndex !== -1 && btn.getAttribute('aria-hidden') !== 'true'
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) return;

    e.preventDefault();
    let nextIndex = currentIndex;
    if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;

    items[nextIndex]?.focus();
  };

  type NavDef = {
    id: typeof activeNavTab;
    label: string;
    shortLabel?: string;
    icon: IconName;
    count?: number;
  };

  const workspaceNav: NavDef[] = [
    { id: 'today', label: isAr ? 'نظرة عامة' : 'Overview', icon: 'grid', count: todayDueCount },
    { id: 'tasks', label: isAr ? 'المهام' : 'Tasks', icon: 'check-square' },
    { id: 'habits', label: isAr ? 'العادات' : 'Habits', icon: 'repeat' },
    { id: 'goals', label: isAr ? 'الأهداف' : 'Goals', icon: 'target' },
    { id: 'focus', label: isAr ? 'التركيز' : 'Focus', icon: 'timer' },
    { id: 'calendar', label: isAr ? 'التقويم' : 'Calendar', icon: 'calendar' }
  ];

  const studiosNav: NavDef[] = [
    { id: 'quran', label: isAr ? 'حفظ القرآن' : 'Quran Studio', shortLabel: isAr ? 'القرآن' : 'Quran', icon: 'mosque' },
    { id: 'reading', label: isAr ? 'استوديو القراءة' : 'Reading Vault', shortLabel: isAr ? 'القراءة' : 'Reading', icon: 'book-open' },
    { id: 'workout', label: isAr ? 'اللياقة البدنية' : 'Home Workout', shortLabel: isAr ? 'اللياقة' : 'Workout', icon: 'dumbbell' },
    { id: 'drawing', label: isAr ? 'مرسم الإبداع' : 'Art Studio', shortLabel: isAr ? 'المرسم' : 'Studio', icon: 'brush' }
  ];

  const lifeNav: NavDef[] = [
    { id: 'archive', label: isAr ? 'الذاكرة والأرشيف' : 'Archive & History', shortLabel: isAr ? 'الأرشيف' : 'Archive', icon: 'archive' },
    { id: 'finance', label: isAr ? 'المال' : 'Money', icon: 'wallet' },
    { id: 'health', label: isAr ? 'الصحة' : 'Health', icon: 'activity' },
    { id: 'journal', label: isAr ? 'اليوميات' : 'Journal', icon: 'notebook' },
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
      id: 'act-profile',
      label: isAr ? 'الملف الشخصي والإعدادات' : 'Profile & Settings',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['profile', 'settings', 'preferences', 'data', 'backup'],
      run: () => setActiveNavTab('profile')
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
      case 'profile': return isAr ? 'الملف الشخصي والإعدادات' : 'Profile & Settings';
      case 'simulator': return isAr ? 'محاكي التراكم' : '"What If" Simulator';
      default: return isAr ? 'نظرة عامة' : 'Overview';
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <AmbientBackdrop />
      <StorageIssueBanner isAr={isAr} />
      <UpdateBanner isAr={isAr} />
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
        onOpenResult={(result) => {
          requestFocus(result.domain, result.recordId);
          setActiveNavTab(result.domain as any);
        }}
      />

      {/* Mobile Scrim Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        className={`sidebar-scrim ${sidebarOpen ? 'open' : ''}`}
      />

      {/* Collapsed Sidebar Floating Glass Tooltip */}
      {sidebarTooltip && (
        <div
          key={sidebarTooltip.id}
          role="tooltip"
          id={`sidebar-tip-${sidebarTooltip.id}`}
          className="sidebar-tooltip"
          style={{
            top: `${sidebarTooltip.top}px`,
            ...(isAr
              ? { right: `${sidebarTooltip.right ?? 96}px` }
              : { left: `${sidebarTooltip.left ?? 96}px` })
          }}
        >
          <span>{sidebarTooltip.label}</span>
          {sidebarTooltip.badge && (
            <span className="sidebar-tooltip-badge tabular-nums">{sidebarTooltip.badge}</span>
          )}
        </div>
      )}

      {/* ==================== SIDEBAR ==================== */}
      <aside
        ref={sidebarRef}
        aria-label={isAr ? 'التنقل الرئيسي' : 'Primary navigation'}
        onScroll={hideCollapsedTooltip}
        onKeyDown={handleSidebarKeyDown}
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        {/* Brand Row with Collapse Toggle */}
        <div className="brand-row">
          <button
            type="button"
            className="brand-mark-btn"
            aria-label={
              sidebarCollapsed
                ? isAr
                  ? 'توسيع الشريط الجانبي'
                  : 'Expand Sidebar'
                : isAr
                ? 'نظرة عامة'
                : 'Go to Overview'
            }
            aria-expanded={sidebarCollapsed ? false : undefined}
            aria-describedby={sidebarTooltip?.id === 'brand' ? 'sidebar-tip-brand' : undefined}
            onClick={() => {
              if (sidebarCollapsed && window.innerWidth > 900) {
                setSidebarCollapsed(false);
                hideCollapsedTooltip();
              } else {
                setActiveNavTab('today');
                if (window.innerWidth <= 900) setSidebarOpen(false);
              }
            }}
            onMouseEnter={(e) =>
              showCollapsedTooltip(e, 'brand', isAr ? 'توسيع الشريط الجانبي' : 'Expand Sidebar')
            }
            onMouseLeave={hideCollapsedTooltip}
            onFocus={(e) =>
              showCollapsedTooltip(e, 'brand', isAr ? 'توسيع الشريط الجانبي' : 'Expand Sidebar')
            }
            onBlur={hideCollapsedTooltip}
          >
            <span className="brand-mark" aria-hidden="true"></span>
          </button>

          <div className="brand-copy" aria-hidden={sidebarCollapsed}>
            <span className="brand-name">
              NUQTA<span className="brand-period">.</span>
            </span>
            <span className="brand-tag">
              {isAr ? 'نظام إدارة الحياة' : 'Life Operating System'}
            </span>
          </div>

          {/* Hide Sidebar button (Desktop & Mobile) */}
          <button
            type="button"
            tabIndex={sidebarCollapsed ? -1 : 0}
            aria-hidden={sidebarCollapsed}
            aria-expanded={!sidebarCollapsed}
            onClick={() => {
              hideCollapsedTooltip();
              if (window.innerWidth <= 900) {
                setSidebarOpen(false);
              } else {
                setSidebarCollapsed(true);
              }
            }}
            className="icon-btn sidebar-collapse-btn text-muted hover:text-[var(--text-primary)]"
            title={isAr ? 'طي الشريط الجانبي' : 'Collapse Sidebar'}
            aria-label={isAr ? 'طي الشريط الجانبي' : 'Collapse Sidebar'}
          >
            <NuqtaIcon name={isAr ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Capture Shortcut Button */}
        <button
          type="button"
          data-sidebar-nav="true"
          aria-label={isAr ? 'التقاط فوري (Q)' : 'Quick Capture (Q)'}
          aria-describedby={sidebarTooltip?.id === 'capture' ? 'sidebar-tip-capture' : undefined}
          onClick={() => {
            hideCollapsedTooltip();
            setActiveNavTab('tasks');
            if (window.innerWidth <= 900) setSidebarOpen(false);
          }}
          onMouseEnter={(e) =>
            showCollapsedTooltip(e, 'capture', isAr ? 'التقاط فوري' : 'Quick Capture', 'Q')
          }
          onMouseLeave={hideCollapsedTooltip}
          onFocus={(e) =>
            showCollapsedTooltip(e, 'capture', isAr ? 'التقاط فوري' : 'Quick Capture', 'Q')
          }
          onBlur={hideCollapsedTooltip}
          className="capture-shortcut"
        >
          <span className="capture-plus" aria-hidden="true">+</span>
          <span className="capture-text truncate">{isAr ? 'التقاط فوري' : 'Quick Capture'}</span>
          <kbd className="capture-kbd">Q</kbd>
        </button>

        {/* Workspace Nav Group */}
        <div className="nav-label">
          <span>{isAr ? 'مساحة العمل' : 'Workspace'}</span>
        </div>
        <nav className="primary-nav" aria-label={isAr ? 'مساحة العمل' : 'Workspace'}>
          {workspaceNav.map((item) => {
            const isActive = activeNavTab === item.id;
            const badgeText = item.count !== undefined && item.count > 0 ? String(item.count) : undefined;
            return (
              <button
                type="button"
                key={item.id}
                data-sidebar-nav="true"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={!isActive && sidebarTooltip?.id === item.id ? `sidebar-tip-${item.id}` : undefined}
                onClick={() => {
                  hideCollapsedTooltip();
                  setActiveNavTab(item.id);
                  if (window.innerWidth <= 900) setSidebarOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label, badgeText);
                }}
                onMouseLeave={hideCollapsedTooltip}
                onFocus={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label, badgeText);
                }}
                onBlur={hideCollapsedTooltip}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="nav-item-label truncate flex-1">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="nav-trailing tabular-nums">
                    {item.count}
                  </span>
                )}
                {isActive && (
                  <span className="nav-active-mini-label" aria-hidden="true">
                    {item.shortLabel ?? item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Specialized Habit Studios Group */}
        <div className="nav-label nav-label-spaced">
          <span>{isAr ? 'استوديوهات الإتقان' : 'Habit Studios'}</span>
        </div>
        <nav className="primary-nav" aria-label={isAr ? 'استوديوهات الإتقان' : 'Habit Studios'}>
          {studiosNav.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                data-sidebar-nav="true"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={!isActive && sidebarTooltip?.id === item.id ? `sidebar-tip-${item.id}` : undefined}
                onClick={() => {
                  hideCollapsedTooltip();
                  setActiveNavTab(item.id);
                  if (window.innerWidth <= 900) setSidebarOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label);
                }}
                onMouseLeave={hideCollapsedTooltip}
                onFocus={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label);
                }}
                onBlur={hideCollapsedTooltip}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="nav-item-label truncate flex-1">{item.label}</span>
                {isActive && (
                  <span className="nav-active-mini-label" aria-hidden="true">
                    {item.shortLabel ?? item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Life & Self Group */}
        <div className="nav-label nav-label-spaced">
          <span>{isAr ? 'الحياة والذات' : 'Life & Self'}</span>
        </div>
        <nav className="primary-nav" aria-label={isAr ? 'الحياة والذات' : 'Life & Self'}>
          {lifeNav.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                data-sidebar-nav="true"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={!isActive && sidebarTooltip?.id === item.id ? `sidebar-tip-${item.id}` : undefined}
                onClick={() => {
                  hideCollapsedTooltip();
                  setActiveNavTab(item.id);
                  if (window.innerWidth <= 900) setSidebarOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label);
                }}
                onMouseLeave={hideCollapsedTooltip}
                onFocus={(e) => {
                  if (!isActive) showCollapsedTooltip(e, item.id, item.label);
                }}
                onBlur={hideCollapsedTooltip}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">
                  <NuqtaIcon name={item.icon} className="w-4 h-4" />
                </span>
                <span className="nav-item-label truncate flex-1">{item.label}</span>
                {isActive && (
                  <span className="nav-active-mini-label" aria-hidden="true">
                    {item.shortLabel ?? item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer"></div>

        {/* Sidebar Footer Advice Card */}
        <div className="sidebar-footer-card" aria-hidden={sidebarCollapsed}>
          <NuqtaIcon name="sparkle" className="w-4 h-4 footer-spark" />
          <p>
            {isAr
              ? 'ليس مطلوبًا أن تفعل كل شيء؛ ركّز على نقطة واحدة واضحة لليوم.'
              : 'You do not have to do everything. Choose strictly 1 clear anchor.'}
          </p>
          <button
            type="button"
            tabIndex={sidebarCollapsed ? -1 : 0}
            onClick={() => setRescueModeOpen(true)}
            className="text-link"
          >
            <span>{isAr ? 'وضع الإنقاذ' : 'Rescue Mode'}</span>
            <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
          </button>
        </div>

      </aside>

      {/* Profile dock — a standalone destination kept outside the scrolling
          rail so it stays pinned in place and never moves with the nav list. */}
      <div className={`profile-dock ${sidebarOpen ? 'open' : ''}`}>
        <button
          type="button"
          data-sidebar-nav="true"
          aria-label={profile.name || (isAr ? 'الملف الشخصي' : 'Local profile')}
          aria-current={activeNavTab === 'profile' ? 'page' : undefined}
          aria-describedby={sidebarTooltip?.id === 'profile' ? 'sidebar-tip-profile' : undefined}
          onClick={() => {
            hideCollapsedTooltip();
            setActiveNavTab('profile');
            if (window.innerWidth <= 900) setSidebarOpen(false);
          }}
          onMouseEnter={(e) =>
            showCollapsedTooltip(
              e,
              'profile',
              profile.name || (isAr ? 'الملف الشخصي' : 'Local profile'),
              isAr ? 'محلي' : 'Private'
            )
          }
          onMouseLeave={hideCollapsedTooltip}
          onFocus={(e) =>
            showCollapsedTooltip(
              e,
              'profile',
              profile.name || (isAr ? 'الملف الشخصي' : 'Local profile'),
              isAr ? 'محلي' : 'Private'
            )
          }
          onBlur={hideCollapsedTooltip}
          className="profile-row"
        >
          <span className="avatar">
            {profile.name ? (
              profile.name.charAt(0)
            ) : (
              <NuqtaIcon name="user" className="w-4 h-4" />
            )}
          </span>
          <div className="profile-details">
            <strong>{profile.name || (isAr ? 'الملف الشخصي' : 'Local profile')}</strong>
            {profile.name && (
              <small>
                {isAr ? 'ملف محلي · خاص' : 'Local profile · Private'}
              </small>
            )}
          </div>
          <span className="more-dots">···</span>
        </button>
      </div>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-start">
            <button
              ref={topbarToggleRef}
              type="button"
              onClick={() => {
                hideCollapsedTooltip();
                if (window.innerWidth <= 900) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className={`icon-btn ${sidebarCollapsed ? 'border-accent/40 bg-accent/10 text-accent' : ''}`}
              aria-label="Toggle sidebar"
              aria-expanded={typeof window !== 'undefined' && window.innerWidth <= 900 ? sidebarOpen : !sidebarCollapsed}
              title={isAr ? (sidebarCollapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي') : (sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar')}
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
                      aria-label={isAr ? 'إغلاق' : 'Close'}
                      className="text-muted hover:text-[var(--text-primary)]"
                    >
                      <NuqtaIcon name="close" className="w-4 h-4" />
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
                        setActiveNavTab('profile');
                        setShowNotificationModal(false);
                      }}
                      className="text-[11px] text-accent hover:underline"
                    >
                      {isAr ? 'الملف الشخصي' : 'Profile'}
                      <NuqtaIcon name="arrow" className="w-3 h-3 inline-block" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`page-content ${activeNavTab === 'today' ? 'dashboard-wide' : ''}`}>
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
          {activeNavTab === 'profile' && <ProfileView />}
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

