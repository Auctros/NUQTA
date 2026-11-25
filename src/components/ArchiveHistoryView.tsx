import { localDateKey, localDayFrom, localTimeKey } from '../lib/dateKey';
import React, { useState, useMemo } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { usePersistedViewTab } from '../lib/useNavigation';
import {
  generateUniversalHistory,
  getUniversalArchivedItems,
  getHistoricalStatsSummary,
  HistoryFilterCriteria
} from '../lib/universalHistoryEngine';
import {
  UniversalHistoryDomain,
  UniversalHistoryEventType,
  UniversalHistoryItem,
  ArchivedItemSummary
} from '../types';
import { NuqtaIcon, IconName } from './NuqtaIcon';
import { NuqtaDatePicker } from './ui';
import { feedback } from './ui/dialogController';
import { useEscapeKey } from '../lib/useEscapeKey';
import { LifeTimeline } from './LifeTimeline';
import { CommitmentMap } from './CommitmentMap';
import { isNavTab } from '../lib/navigation';

export const ArchiveHistoryView: React.FC = () => {
  const {
    tasks,
    habits,
    goals,
    focusSessions,
    journalEntries,
    expenses,
    sundayReviews,
    historyAuditLogs,
    profile,
    restoreTask,
    restoreHabit,
    restoreBook,
    restoreWorkoutRoutine,
    restoreArtProject,
    restoreGoal,
    archiveTask,
    archiveHabit,
    archiveGoal,
    setActiveNavTab,
    requestFocus,
    healthMetrics
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';

  // Workspace sub-tabs
  const [activeTab, setActiveTab] = usePersistedViewTab<'archive' | 'timeline' | 'map' | 'studios_logs'>(
    'archive',
    ['archive', 'timeline', 'map', 'studios_logs'],
    'archive'
  );

  // Handing a specific day between the timeline and the map is a cross-tab gesture, not
  // persisted state: it describes what the person is looking at right now.
  const [focusDate, setFocusDate] = useState<string | null>(null);

  // Filter criteria
  const [domainFilter, setDomainFilter] = useState<UniversalHistoryDomain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');

  // Selected item modal / journey inspection
  const [inspectingItem, setInspectingItem] = useState<{
    historyItem?: UniversalHistoryItem;
    archivedItem?: ArchivedItemSummary;
  } | null>(null);
  useEscapeKey(inspectingItem !== null, () => setInspectingItem(null));

  const sources = useMemo(
    () => ({
      tasks,
      habits,
      goals,
      focusSessions,
      journalEntries,
      expenses,
      sundayReviews,
      historyAuditLogs
    }),
    [tasks, habits, goals, focusSessions, journalEntries, expenses, sundayReviews, historyAuditLogs]
  );

  const allHistory = useMemo(() => generateUniversalHistory(sources), [sources]);
  const allArchived = useMemo(() => getUniversalArchivedItems(sources), [sources]);
  const stats = useMemo(() => getHistoricalStatsSummary(sources), [sources]);

  // Filtered History
  // Filtered Archived Items
  const filteredArchived = useMemo(() => {
    return allArchived.filter((item) => {
      if (domainFilter !== 'all' && item.domain !== domainFilter) return false;

      if (dateQuery) {
        const archDate = item.archivedAt ? localDayFrom(item.archivedAt) : '';
        if (archDate !== dateQuery) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textToSearch = `${item.title} ${item.typeLabelAr} ${item.typeLabelEn} ${item.metricsSummary || ''} ${item.linkedGoalTitle || ''}`.toLowerCase();
        if (!textToSearch.includes(q)) return false;
      }

      return true;
    });
  }, [allArchived, domainFilter, searchQuery, dateQuery]);

  // Handle restoring any item with instant feedback
  const handleRestore = (item: ArchivedItemSummary) => {
    if (item.domain === 'tasks') {
      restoreTask(item.originalId);
    } else if (item.domain === 'habits') {
      restoreHabit(item.originalId);
    } else if (item.domain === 'reading' && item.parentHabitId) {
      restoreBook(item.parentHabitId, item.originalId);
    } else if (item.domain === 'workout' && item.parentHabitId) {
      restoreWorkoutRoutine(item.parentHabitId, item.originalId);
    } else if (item.domain === 'drawing' && item.parentHabitId) {
      restoreArtProject(item.parentHabitId, item.originalId);
    } else if (item.domain === 'goals') {
      restoreGoal(item.originalId);
    }

    const msg = isAr
      ? `تمت استعادة "${item.title}" بنجاح إلى ${getDomainLabel(item.domain, isAr)}!`
      : `Restored "${item.title}" back to ${getDomainLabel(item.domain, isAr)}!`;

    feedback.success(msg, { duration: 4000 });

    if (inspectingItem?.archivedItem?.id === item.id) {
      setInspectingItem(null);
    }
  };

  // Domain labels helper
  function getDomainLabel(domain: UniversalHistoryDomain, arabic: boolean) {
    const labels: Record<UniversalHistoryDomain, { ar: string; en: string; icon: string }> = {
      tasks: { ar: 'المهام', en: 'Tasks', icon: 'check-square' },
      habits: { ar: 'العادات', en: 'Habits', icon: 'repeat' },
      quran: { ar: 'حفظ القرآن', en: 'Quran Studio', icon: 'book-open' },
      reading: { ar: 'القراءة', en: 'Reading', icon: 'book-open' },
      workout: { ar: 'التمارين', en: 'Home Workout', icon: 'activity' },
      drawing: { ar: 'الرسم والإبداع', en: 'Art Studio', icon: 'palette' },
      walking: { ar: 'المشي', en: 'Walking', icon: 'footprints' },
      goals: { ar: 'الأهداف', en: 'Goals', icon: 'target' },
      focus: { ar: 'التركيز', en: 'Focus', icon: 'timer' },
      health: { ar: 'الصحة', en: 'Health', icon: 'activity' },
      finance: { ar: 'المال', en: 'Finance', icon: 'wallet' },
      journal: { ar: 'اليوميات', en: 'Journal', icon: 'book-open' },
      review: { ar: 'المراجعات', en: 'Reviews', icon: 'compass' }
    };
    return arabic ? labels[domain]?.ar || domain : labels[domain]?.en || domain;
  }

  // Domain icon (a valid NuqtaIcon name), rendered next to the label.
  function domainIcon(domain: UniversalHistoryDomain): IconName {
    const icons: Record<UniversalHistoryDomain, IconName> = {
      tasks: 'check-square',
      habits: 'repeat',
      quran: 'book-open',
      reading: 'book',
      workout: 'dumbbell',
      drawing: 'brush',
      walking: 'footprints',
      goals: 'target',
      focus: 'timer',
      health: 'activity',
      finance: 'wallet',
      journal: 'notebook',
      review: 'compass'
    };
    return icons[domain] || 'layers';
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / UNIVERSAL ARCHIVE & HISTORY</span>
          </div>
          <h1>{isAr ? 'الذاكرة الشاملة والأرشيف الموحد' : 'Universal Archive & Life History'}</h1>
          <p>
            {isAr
              ? 'السجل الزمني الحي لكل إنجاز، جلسة، مشروع، وهدف في مسيرتك دون تكرار أو فقدان للبيانات.'
              : 'A unified living stream of every accomplishment, session, project, and goal across time.'}
          </p>
        </div>

        {/* Global Stats Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-default)] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-accent font-bold">{stats.totalHistoryEventsCount}</span>
            <span>{isAr ? 'حدث مسجل' : 'events'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-default)] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-[var(--tone-warning)] font-bold">{stats.totalArchivedItemsCount}</span>
            <span>{isAr ? 'عنصر محفوظ في الأرشيف' : 'archived'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-default)] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-[var(--tone-info)] font-bold">{stats.totalDedicatedHours}</span>
            <span>{isAr ? 'ساعة حياة مستثمرة' : 'hours invested'}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Accomplishments Banner */}
      <div className="panel p-5 rounded-2xl bg-gradient-to-r from-[var(--surface-raised)] via-[var(--surface-inset)] to-[var(--surface-inset)] border border-[var(--border-default)] shadow-lg">
        <div className="text-xs font-mono text-accent font-bold tracking-wider mb-3">
          {isAr ? 'خلاصة الإنجاز التراكمي الشامل' : 'LIFETIME ACHIEVEMENT AGGREGATE'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'المهام المكتملة' : 'Tasks Done'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-success)] mt-1">{stats.completedTasks}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'الكتب المقروءة' : 'Books Read'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-info)] mt-1">{stats.completedBooks}</div>
            <div className="text-[10px] text-muted font-mono">{stats.totalPagesRead} {isAr ? 'صفحة' : 'pages'}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'آيات القرآن المحفوظة' : 'Ayahs Memorized'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-info)] mt-1">{stats.totalAyahsMemorized}</div>
            <div className="text-[10px] text-muted font-mono">{stats.totalSurahsCompleted} {isAr ? 'سور مكتملة' : 'surahs'}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'الحصص الرياضية' : 'Workouts Done'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-warning)] mt-1">{stats.totalWorkouts}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'الأعمال الإبداعية' : 'Artworks'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-purple)] mt-1">{stats.totalArtPieces}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--border-subtle)]">
            <div className="text-[11px] text-muted">{isAr ? 'جلسات التركيز' : 'Focus Sessions'}</div>
            <div className="text-xl font-bold font-mono text-[var(--tone-info)] mt-1">{stats.totalFocusSessions}</div>
            <div className="text-[10px] text-muted font-mono">{Math.round(stats.totalFocusMinutes / 60)} {isAr ? 'ساعة' : 'hrs'}</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'archive'
                ? 'bg-accent text-[var(--accent-ink)] font-bold shadow-md shadow-accent/20'
                : 'bg-[var(--surface-inset)] text-muted hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            <NuqtaIcon name="archive" className="w-4 h-4" />
            <span>{isAr ? 'الأرشيف الموحد' : 'Universal Archive'}</span>
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-xs font-mono bg-black/20 text-current">
              {allArchived.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-accent text-[var(--accent-ink)] font-bold shadow-md shadow-accent/20'
                : 'bg-[var(--surface-inset)] text-muted hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            <NuqtaIcon name="history" className="w-4 h-4" />
            <span>{isAr ? 'سجل الزمن والمسيرة' : 'Life Timeline'}</span>
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-xs font-mono bg-black/20 text-current">
              {allHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'map'
                ? 'bg-accent text-[var(--accent-ink)] font-bold shadow-md shadow-accent/20'
                : 'bg-[var(--surface-inset)] text-muted hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            <NuqtaIcon name="grid" className="w-4 h-4" />
            <span>{isAr ? 'خريطة الالتزام' : 'Commitment Map'}</span>
          </button>

          <button
            onClick={() => setActiveTab('studios_logs')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'studios_logs'
                ? 'bg-accent text-[var(--accent-ink)] font-bold shadow-md shadow-accent/20'
                : 'bg-[var(--surface-inset)] text-muted hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            <NuqtaIcon name="chart" className="w-4 h-4" />
            <span>{isAr ? 'سجلات الاستوديوهات التراكمية' : 'Specialized Studio Logs'}</span>
          </button>
        </div>

        {/* Global Search and Date Picker */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في الذاكرة والأرشيف...' : 'Search memory & archive...'}
              className="input w-full text-xs ps-8"
            />
            <NuqtaIcon name="search" className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted pointer-events-none" />
          </div>

          <NuqtaDatePicker
            className="text-xs"
            style={{ width: 'auto' }}
            value={dateQuery}
            isAr={isAr}
            clearable
            placeholder={isAr ? 'التاريخ' : 'Date'}
            ariaLabel={isAr ? 'تصفية حسب التاريخ' : 'Filter by exact date'}
            onChange={(e) => setDateQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filters apply to the archived list; the timeline and map own their own. */}
      {activeTab === 'archive' && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted pe-1 font-mono text-[11px]">{isAr ? 'المجال:' : 'Domain:'}</span>
            {(['all', 'tasks', 'habits', 'quran', 'reading', 'workout', 'drawing', 'walking', 'goals', 'focus', 'journal'] as const).map(
              (dom) => (
                <button
                  key={dom}
                  onClick={() => setDomainFilter(dom)}
                  aria-pressed={domainFilter === dom}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    domainFilter === dom
                      ? 'bg-[var(--surface-active)] text-accent font-bold border border-accent/40'
                      : 'text-muted hover:text-[var(--text-primary)] bg-[var(--surface-inset)] border border-transparent'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <NuqtaIcon
                      name={dom === 'all' ? 'layers' : domainIcon(dom)}
                      className="w-3.5 h-3.5"
                    />
                    {dom === 'all' ? (isAr ? 'الكل' : 'All') : getDomainLabel(dom, isAr)}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: UNIVERSAL ARCHIVE                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'archive' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted font-mono">
            <span>
              {isAr ? `إجمالي العناصر المؤرشفة: ${filteredArchived.length}` : `Archived items: ${filteredArchived.length}`}
            </span>
            <span className="text-muted/80">
              {isAr
                ? 'ملاحظة: استعادة أي عنصر تعيده فوراً لمكانه الأصلي مع كامل تاريخه وعلاقاته دون أي مساس.'
                : 'Note: Restoring returns item to original domain with full history intact.'}
            </span>
          </div>

          {filteredArchived.length === 0 ? (
            <div className="empty-state py-16">
              <div className="empty-icon"><NuqtaIcon name="archive" className="w-7 h-7" /></div>
              <strong>{isAr ? 'لا توجد عناصر مؤرشفة مطابقة' : 'No archived items found'}</strong>
              <p>
                {isAr
                  ? 'الأرشيف يحتفظ بالمهام والعادات والكتب والمشاريع والأهداف التي تم أرشفتها لتبقى في مأمن للرجوع إليها مستقبلاً.'
                  : 'The archive keeps your completed and set-aside items safely stored for future reflection.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArchived.map((item) => (
                <article
                  key={item.id}
                  className="panel p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex flex-col justify-between space-y-3 group shadow-md"
                >
                  <div className="space-y-2.5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--surface-chip)] border border-[var(--border-default)] text-accent font-semibold flex items-center gap-1.5">
                        <NuqtaIcon name={domainIcon(item.domain)} className="w-3.5 h-3.5" />
                        <span>{getDomainLabel(item.domain, isAr)}</span>
                      </span>

                      <span className="text-[10px] font-mono text-muted">
                        {item.archivedAt ? localDayFrom(item.archivedAt) : item.createdAt ? localDayFrom(item.createdAt) : ''}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h3
                        onClick={() => setInspectingItem({ archivedItem: item })}
                        className="text-base font-bold text-[var(--text-primary)] group-hover:text-accent transition-colors cursor-pointer leading-snug"
                      >
                        {item.title}
                      </h3>
                      <div className="text-xs text-muted mt-1 font-mono">
                        {isAr ? item.typeLabelAr : item.typeLabelEn}
                      </div>
                    </div>

                    {/* Linked Goal Badge */}
                    {item.linkedGoalTitle && (
                      <div className="text-[11px] px-2 py-0.5 rounded bg-[var(--tone-success-wash)] text-[var(--tone-success)] border border-[var(--tone-success-line)] w-fit flex items-center gap-1">
                        <NuqtaIcon name="target" className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{item.linkedGoalTitle}</span>
                      </div>
                    )}

                    {/* Metrics Summary */}
                    {item.metricsSummary && (
                      <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-chip)] p-2 rounded-lg border border-[var(--border-subtle)] font-mono">
                        {item.metricsSummary}
                      </div>
                    )}
                  </div>

                  {/* Actions: Details & Restore */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setInspectingItem({ archivedItem: item })}
                      className="text-xs text-muted hover:text-[var(--text-primary)] py-1 px-2.5 rounded-lg hover:bg-[var(--surface-chip)] transition-colors"
                    >
                      {isAr ? 'عرض الرحلة' : 'Inspect Journey'}
                    </button>

                    <button
                      onClick={() => handleRestore(item)}
                      className="btn primary text-xs py-1 px-3 flex items-center gap-1.5 shadow-sm"
                      title={isAr ? 'استعادة فورية إلى المكان الأصلي' : 'Restore back to original place'}
                    >
                      <NuqtaIcon name="restore" className="w-3.5 h-3.5" />
                      <span>{isAr ? 'استعادة' : 'Restore'}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: UNIFIED LIFE TIMELINE & HISTORY                                      */}
      {/* ========================================================================= */}
      {activeTab === 'timeline' && (
        <section>
          <LifeTimeline
            items={allHistory}
            isAr={isAr}
            onOpenSource={(domain, entityId) => {
              if (isNavTab(domain)) {
                requestFocus(domain, entityId);
                setActiveNavTab(domain);
              }
            }}
            onOpenDay={(dateKey) => {
              setFocusDate(dateKey);
              setActiveTab('map');
            }}
            focusDate={focusDate}
            onClearFocusDate={() => setFocusDate(null)}
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMMITMENT MAP                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'map' && (
        <section>
          <CommitmentMap
            sources={{ tasks, habits, focusSessions, journalEntries, healthMetrics, history: allHistory }}
            isAr={isAr}
            history={allHistory}
            initialDay={focusDate}
            variant="full"
            onOpenTimeline={(dateKey) => {
              setFocusDate(dateKey);
              setActiveTab('timeline');
            }}
            onOpenSource={(domain, entityId) => {
              if (isNavTab(domain)) {
                requestFocus(domain, entityId);
                setActiveNavTab(domain);
              }
            }}
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEEP SPECIALIZED STUDIO LOGS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'studios_logs' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Quran Logs Box */}
            <div className="panel p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <NuqtaIcon name="book-open" className="w-5 h-5 text-[var(--tone-info)]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'سجل جلسات حفظ وتسميع القرآن' : 'Quran Memorization History'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('quran')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو' : 'Open Studio'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {(() => {
                  const quranHabit = habits.find((h) => h.specializedType === 'quran');
                  const sessions = quranHabit?.quranData?.sessions || [];
                  if (sessions.length === 0) {
                    return (
                      <div className="text-xs text-muted text-center py-6 font-mono">
                        {isAr ? 'لا توجد جلسات قرآن مسجلة بعد' : 'No Quran sessions logged yet'}
                      </div>
                    );
                  }
                  return sessions.map((qs) => (
                    <div
                      key={qs.id}
                      className="p-2.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">
                          {qs.surahName} ({qs.ayahStart}-{qs.ayahEnd})
                        </div>
                        <div className="text-[11px] text-muted">
                          {qs.date} • {qs.type === 'new_memorization' ? (isAr ? 'حفظ جديد' : 'New') : (isAr ? 'مراجعة' : 'Revision')} • {isAr ? `إتقان ${qs.quality}` : qs.quality}
                        </div>
                      </div>
                      <span className="font-mono text-accent text-xs font-semibold">
                        {qs.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 2. Reading Logs Box */}
            <div className="panel p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <NuqtaIcon name="book" className="w-5 h-5 text-[var(--tone-info)]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'سجل جلسات وخزانة القراءة' : 'Reading Sessions & Vault'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('reading')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو' : 'Open Studio'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {(() => {
                  const readingHabit = habits.find((h) => h.specializedType === 'reading');
                  const sessions = readingHabit?.readingData?.sessions || [];
                  if (sessions.length === 0) {
                    return (
                      <div className="text-xs text-muted text-center py-6 font-mono">
                        {isAr ? 'لا توجد جلسات قراءة مسجلة بعد' : 'No reading sessions logged yet'}
                      </div>
                    );
                  }
                  return sessions.map((rs) => (
                    <div
                      key={rs.id}
                      className="p-2.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{rs.bookTitle}</div>
                        <div className="text-[11px] text-muted">
                          {rs.date} • {rs.pagesRead} {isAr ? 'صفحة' : 'pages'}
                        </div>
                      </div>
                      <span className="font-mono text-[var(--tone-info)] text-xs font-semibold">
                        {rs.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 3. Workout Sessions Box */}
            <div className="panel p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <NuqtaIcon name="dumbbell" className="w-5 h-5 text-[var(--tone-warning)]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'سجل حصص اللياقة البدنية' : 'Workout Sessions History'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('workout')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو' : 'Open Studio'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {(() => {
                  const workoutHabit = habits.find((h) => h.specializedType === 'workout');
                  const sessions = workoutHabit?.workoutData?.sessions || [];
                  if (sessions.length === 0) {
                    return (
                      <div className="text-xs text-muted text-center py-6 font-mono">
                        {isAr ? 'لا توجد حصص لياقة مسجلة بعد' : 'No workout sessions logged yet'}
                      </div>
                    );
                  }
                  return sessions.map((ws) => (
                    <div
                      key={ws.id}
                      className="p-2.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{ws.title}</div>
                        <div className="text-[11px] text-muted">
                          {ws.date} • {ws.workoutType} • حجم {ws.volumeKg} كغ
                        </div>
                      </div>
                      <span className="font-mono text-[var(--tone-warning)] text-xs font-semibold">
                        {ws.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 4. Creative Art Pieces Box */}
            <div className="panel p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-2">
                  <NuqtaIcon name="brush" className="w-5 h-5 text-[var(--tone-purple)]" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {isAr ? 'معرض الأعمال والمشاريع الفنية' : 'Art Studio Gallery & Pieces'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('drawing')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح المرسم' : 'Open Studio'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                {(() => {
                  const drawingHabit = habits.find((h) => h.specializedType === 'drawing');
                  const pieces = drawingHabit?.drawingData?.pieces || [];
                  if (pieces.length === 0) {
                    return (
                      <div className="text-xs text-muted text-center py-6 font-mono">
                        {isAr ? 'لا توجد أعمال فنية مسجلة بعد' : 'No art pieces logged yet'}
                      </div>
                    );
                  }
                  return pieces.map((piece) => (
                    <div
                      key={piece.id}
                      className="p-2.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{piece.title}</div>
                        <div className="text-[11px] text-muted">
                          {piece.completedDate} • وسيط {piece.medium}
                        </div>
                      </div>
                      <span className="font-mono text-[var(--tone-purple)] text-xs font-semibold">
                        {piece.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* JOURNEY & ITEM INSPECTOR MODAL                                            */}
      {/* ========================================================================= */}
      {inspectingItem && (
        <div className="modal-backdrop" onClick={() => setInspectingItem(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="modal-content max-w-xl p-6 bg-[var(--surface-deep)] border border-[var(--border-default)] rounded-2xl shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent border border-[var(--border-default)] font-semibold">
                  {inspectingItem.archivedItem
                    ? isAr ? inspectingItem.archivedItem.typeLabelAr : inspectingItem.archivedItem.typeLabelEn
                    : getDomainLabel(inspectingItem.historyItem!.domain, isAr)}
                </span>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1.5">
                  {inspectingItem.archivedItem?.title || inspectingItem.historyItem?.title}
                </h2>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-muted hover:text-[var(--text-primary)] p-1"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <NuqtaIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            {/* Journey Meta Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-xs font-mono">
              <div>
                <span className="text-muted block text-[11px]">{isAr ? 'المجال الأصلي:' : 'Domain:'}</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {getDomainLabel((inspectingItem.archivedItem?.domain || inspectingItem.historyItem?.domain)!, isAr)}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">{isAr ? 'الحالة الحالية:' : 'Status:'}</span>
                <span className="text-accent font-medium">
                  {inspectingItem.archivedItem ? (isAr ? 'مؤرشف ومحفوظ' : 'Archived & Saved') : (inspectingItem.historyItem?.badge || 'مسجل')}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px]">{isAr ? 'تاريخ التسجيل/الإنشاء:' : 'Date:'}</span>
                <span className="text-[var(--text-primary)]">
                  {inspectingItem.archivedItem?.createdAt || inspectingItem.historyItem?.date}
                </span>
              </div>

              {inspectingItem.archivedItem?.archivedAt && (
                <div>
                  <span className="text-muted block text-[11px]">{isAr ? 'تاريخ الأرشفة:' : 'Archived At:'}</span>
                  <span className="text-[var(--tone-warning)]">
                    {localDayFrom(inspectingItem.archivedItem.archivedAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Description or Notes */}
            {(inspectingItem.historyItem?.description || inspectingItem.archivedItem?.metricsSummary) && (
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-muted">{isAr ? 'تفاصيل السجل والتراكم:' : 'Details & Metrics:'}</div>
                <div className="p-3 rounded-xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
                  {inspectingItem.historyItem?.description || inspectingItem.archivedItem?.metricsSummary}
                </div>
              </div>
            )}

            {/* Linked Goal Context */}
            {(inspectingItem.historyItem?.linkedGoalTitle || inspectingItem.archivedItem?.linkedGoalTitle) && (
              <div className="p-3 rounded-xl bg-[var(--surface-deep)] border border-[var(--tone-success-line)] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--tone-success)]">
                  <NuqtaIcon name="target" className="w-3.5 h-3.5" />
                  <span>
                    {isAr ? 'مرتبط بالهدف الاستراتيجي:' : 'Linked Goal:'}{' '}
                    <strong>{inspectingItem.historyItem?.linkedGoalTitle || inspectingItem.archivedItem?.linkedGoalTitle}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
              {inspectingItem.archivedItem ? (
                <button
                  onClick={() => handleRestore(inspectingItem.archivedItem!)}
                  className="btn primary text-xs py-2 px-4 flex items-center gap-2"
                >
                  <NuqtaIcon name="restore" className="w-4 h-4" />
                  <span>{isAr ? 'استعادة العنصر إلى المجال النشط' : 'Restore Item to Active Domain'}</span>
                </button>
              ) : (
                <div className="text-xs text-muted font-mono">
                  {isAr ? 'حدث مسجل ومحفوظ في الذاكرة الدائمة' : 'Recorded event safely stored in life memory'}
                </div>
              )}

              <button
                onClick={() => setInspectingItem(null)}
                className="btn secondary text-xs py-2 px-4"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

