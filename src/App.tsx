import { NuqtaStorageEngine } from './lib/storage';
import { useSyncStatus } from './lib/sync/useSyncStatus';
import { StorageIssueBanner } from './components/StorageIssueBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { localDateKey } from './lib/dateKey';
import { isTaskPending } from './lib/taskStatus';
import React, { useEffect, useState } from 'react';
import { useNuqtaStore } from './store/nuqtaStore';
import { NuqtaIcon } from './components/NuqtaIcon';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { SidebarNavGroup, SidebarNavItem } from './components/sidebar/SidebarNavGroup';
import { applyThemeClass } from './lib/themeTransition';
import { readSidebarCollapsed, writeSidebarCollapsed } from './lib/uiPrefs';
import { initNavigationSync, isNavTab } from './lib/navigation';
import { useNavigation } from './lib/useNavigation';

// Modals
import { RescueModal } from './components/RescueModal';
import { SundayRitualModal } from './components/SundayRitualModal';

// Views
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { HabitsView } from './components/HabitsView';
import { GoalsView } from './components/GoalsView';
import { ProjectsView } from './components/ProjectsView';
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
import { WalkingView } from './components/WalkingView';
import { CoursesView } from './components/CoursesView';
import { ArchiveHistoryView } from './components/ArchiveHistoryView';
import { TimelineWorkspace } from './components/timeline/TimelineWorkspace';
import { useNuqtaReminders } from './lib/useNuqtaReminders';
import { CommandPalette, CommandItem } from './components/CommandPalette';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { listenForNotificationRoutes } from './lib/notifications';
import { unreadCount } from './lib/notificationEngine';
import { NotificationCenter } from './components/NotificationCenter';
import { DialogHost } from './components/ui/DialogHost';

export default function App() {
  useNuqtaReminders();

  useEffect(() => listenForNotificationRoutes(), []);

  const {
    activeNavTab,
    initializeStore,
    profile,
    setLanguage,
    setTheme,
    setRescueModeOpen,
    requestFocus,
    tasks
  } = useNuqtaStore();

  // A selector rather than a whole-store subscription: the badge must update on every
  // read/dismiss, and deriving it here keeps that dependency explicit.
  const unreadNotifications = useNuqtaStore((s) => unreadCount(s.notifications));

  // One path for every destination change: the URL and the store move together.
  const { navigate } = useNavigation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [sidebarHasMore, setSidebarHasMore] = useState(false);
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

  // Keep the address bar and the screen in step: Back/Forward re-enter the app
  // through here, and a deep link sets the section on first paint. Mounted once.
  useEffect(
    () =>
      initNavigationSync((route) => {
        const store = useNuqtaStore.getState();
        if (store.activeNavTab !== route.tab) store.setActiveNavTab(route.tab);
      }, useNuqtaStore.getState().activeNavTab),
    []
  );

  // Starts only when VITE_NUQTA_SYNC_URL is configured; otherwise this hook is inert
  // and the app stays purely local-first. The returned status is rendered in the
  // header so "paused", "offline" and "rejected" are visible rather than silent.
  const syncStatus = useSyncStatus();

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
        navigate('today');
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
  }, [navigate]);

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();
  const todayDueCount = tasks.filter((t) => isTaskPending(t) && t.scheduledDate === todayStr).length;

  useEffect(() => {
    if (!sidebarCollapsed) {
      setSidebarTooltip(null);
    }
    writeSidebarCollapsed(sidebarCollapsed);
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

  const handleNavSelect = (tab: typeof activeNavTab) => {
    navigate(tab);
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };

  // Reveal a bottom fade only while the rail actually has unreachable content
  // below the fold, so the indicator disappears the moment the end is reached.
  const syncSidebarOverflow = React.useCallback(() => {
    const el = sidebarRef.current;
    if (!el) return;
    setSidebarHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    syncSidebarOverflow();
    // Observe the rail's box AND its content, so a badge appearing or a label
    // wrapping (which changes scrollHeight but not clientHeight) cannot leave a
    // stale fade behind.
    const observer = new ResizeObserver(syncSidebarOverflow);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [syncSidebarOverflow, sidebarCollapsed, isAr]);

  useEffect(() => {
    window.addEventListener('resize', syncSidebarOverflow);
    return () => window.removeEventListener('resize', syncSidebarOverflow);
  }, [syncSidebarOverflow]);

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

  type NavDef = SidebarNavItem<typeof activeNavTab>;

  const workspaceNav: NavDef[] = [
    { id: 'today', label: isAr ? 'نظرة عامة' : 'Overview', icon: 'grid', count: todayDueCount },
    { id: 'tasks', label: isAr ? 'المهام' : 'Tasks', icon: 'check-square' },
    { id: 'habits', label: isAr ? 'العادات' : 'Habits', icon: 'repeat' },
    { id: 'goals', label: isAr ? 'الأهداف' : 'Goals', icon: 'target' },
    { id: 'projects', label: isAr ? 'المشاريع' : 'Projects', icon: 'blocks' },
    { id: 'focus', label: isAr ? 'التركيز' : 'Focus', icon: 'timer' },
    { id: 'calendar', label: isAr ? 'التقويم' : 'Calendar', icon: 'calendar' },
    { id: 'timeline', label: isAr ? 'الجدول الزمني' : 'Timeline', icon: 'history' }
  ];

  const studiosNav: NavDef[] = [
    { id: 'quran', label: isAr ? 'حفظ القرآن' : 'Quran Studio', shortLabel: isAr ? 'القرآن' : 'Quran', icon: 'mosque' },
    { id: 'reading', label: isAr ? 'استوديو القراءة' : 'Reading Vault', shortLabel: isAr ? 'القراءة' : 'Reading', icon: 'book-open' },
    { id: 'workout', label: isAr ? 'اللياقة البدنية' : 'Home Workout', shortLabel: isAr ? 'اللياقة' : 'Workout', icon: 'dumbbell' },
    { id: 'drawing', label: isAr ? 'مرسم الإبداع' : 'Art Studio', shortLabel: isAr ? 'المرسم' : 'Studio', icon: 'brush' },
    { id: 'walking', label: isAr ? 'استوديو المشي' : 'Walking Studio', shortLabel: isAr ? 'المشي' : 'Walking', icon: 'footprints' },
    { id: 'courses', label: isAr ? 'استوديو الدورات' : 'Courses Studio', shortLabel: isAr ? 'الدورات' : 'Courses', icon: 'play' }
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
      run: () => navigate(item.id)
    })),
    {
      id: 'act-profile',
      label: isAr ? 'الملف الشخصي والإعدادات' : 'Profile & Settings',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['profile', 'settings', 'preferences', 'data', 'backup'],
      run: () => navigate('profile')
    },
    {
      id: 'act-simulator',
      label: isAr ? 'محاكي التراكم (ماذا لو)' : 'What-If Simulator',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['simulator', 'what if'],
      run: () => navigate('simulator')
    },
    {
      id: 'act-focus',
      label: isAr ? 'بدء جلسة تركيز' : 'Start a Focus Session',
      hint: isAr ? 'إجراء' : 'Action',
      group: isAr ? 'إجراءات' : 'Actions',
      keywords: ['focus', 'timer', 'pomodoro'],
      run: () => navigate('focus')
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
      case 'walking': return isAr ? 'استوديو المشي' : 'Walking Studio';
      case 'courses': return isAr ? 'استوديو الدورات' : 'Courses Studio';
      case 'goals': return isAr ? 'الأهداف' : 'Goals';
      case 'focus': return isAr ? 'التركيز' : 'Focus';
      case 'calendar': return isAr ? 'التقويم' : 'Calendar';
      case 'timeline': return isAr ? 'مساحة الجدول الزمني' : 'Timeline Workspace';
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
      {/* Interaction layer: every in-app confirm/alert/prompt and toast */}
      <DialogHost />
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
          // History domains are not all sections ('review' has no screen of its own),
          // so only follow the ones that actually navigate.
          if (isNavTab(result.domain)) navigate(result.domain);
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
        onScroll={() => {
          hideCollapsedTooltip();
          syncSidebarOverflow();
        }}
        onKeyDown={handleSidebarKeyDown}
        className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarHasMore ? 'has-more' : ''}`}
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
                navigate('today');
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
            navigate('tasks');
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

        <SidebarNavGroup
          label={isAr ? 'مساحة العمل' : 'Workspace'}
          items={workspaceNav}
          activeId={activeNavTab}
          onNavigate={handleNavSelect}
          tooltipId={sidebarTooltip?.id ?? null}
          onShowTooltip={showCollapsedTooltip}
          onHideTooltip={hideCollapsedTooltip}
        />

        <SidebarNavGroup
          spaced
          label={isAr ? 'استوديوهات الإتقان' : 'Habit Studios'}
          items={studiosNav}
          activeId={activeNavTab}
          onNavigate={handleNavSelect}
          tooltipId={sidebarTooltip?.id ?? null}
          onShowTooltip={showCollapsedTooltip}
          onHideTooltip={hideCollapsedTooltip}
        />

        <SidebarNavGroup
          spaced
          label={isAr ? 'الحياة والذات' : 'Life & Self'}
          items={lifeNav}
          activeId={activeNavTab}
          onNavigate={handleNavSelect}
          tooltipId={sidebarTooltip?.id ?? null}
          onShowTooltip={showCollapsedTooltip}
          onHideTooltip={hideCollapsedTooltip}
        />

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
            navigate('profile');
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

            {/* Sync status: compact pill beside the other header actions */}
            <SyncStatusBadge status={syncStatus} isAr={isAr} />

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
                aria-expanded={showNotificationModal}
                aria-haspopup="dialog"
              >
                <NuqtaIcon name="bell" className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span
                    className="absolute -top-0.5 -end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--brand-strong)] px-1 text-[9px] font-bold text-[var(--text-on-accent)]"
                    aria-hidden="true"
                  >
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
                <span className="sr-only">
                  {isAr
                    ? `مركز الإشعارات، ${unreadNotifications} غير مقروء`
                    : `Notification Center, ${unreadNotifications} unread`}
                </span>
              </button>

              <NotificationCenter
                open={showNotificationModal}
                onClose={() => setShowNotificationModal(false)}
                isAr={isAr}
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`page-content ${activeNavTab === 'today' || activeNavTab === 'timeline' ? 'dashboard-wide' : ''}`}>
          {activeNavTab === 'today' && <DashboardView />}
          {activeNavTab === 'tasks' && <TasksView />}
          {activeNavTab === 'habits' && <HabitsView />}
          {activeNavTab === 'quran' && <QuranView />}
          {activeNavTab === 'reading' && <ReadingView />}
          {activeNavTab === 'workout' && <WorkoutView />}
          {activeNavTab === 'drawing' && <DrawingView />}
          {activeNavTab === 'walking' && <WalkingView />}
          {activeNavTab === 'courses' && <CoursesView isAr={isAr} />}
          {activeNavTab === 'goals' && <GoalsView />}
          {activeNavTab === 'projects' && <ProjectsView />}
          {activeNavTab === 'focus' && <FocusView />}
          {activeNavTab === 'calendar' && <CalendarView />}
          {activeNavTab === 'finance' && <FinanceView />}
          {activeNavTab === 'health' && <HealthView />}
          {activeNavTab === 'journal' && <JournalView />}
          {activeNavTab === 'insights' && <InsightsView />}
          {activeNavTab === 'timeline' && <TimelineWorkspace />}
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

