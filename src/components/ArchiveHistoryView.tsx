import React, { useState, useMemo } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
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
import { NuqtaIcon } from './NuqtaIcon';

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
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';

  // Workspace sub-tabs
  const [activeTab, setActiveTab] = useState<'archive' | 'timeline' | 'studios_logs'>('archive');

  // Filter criteria
  const [domainFilter, setDomainFilter] = useState<UniversalHistoryDomain | 'all'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<UniversalHistoryEventType | 'all'>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');

  // Selected item modal / journey inspection
  const [inspectingItem, setInspectingItem] = useState<{
    historyItem?: UniversalHistoryItem;
    archivedItem?: ArchivedItemSummary;
  } | null>(null);

  // Restore feedback toast
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

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
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const monthAgo = new Date();
    monthAgo.setMonth(now.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    const yearAgo = new Date();
    yearAgo.setFullYear(now.getFullYear() - 1);
    const yearAgoStr = yearAgo.toISOString().split('T')[0];

    return allHistory.filter((item) => {
      // Domain filter
      if (domainFilter !== 'all' && item.domain !== domainFilter) return false;

      // Event Type filter
      if (eventTypeFilter !== 'all' && item.eventType !== eventTypeFilter) return false;

      // Date Query filter
      if (dateQuery && item.date !== dateQuery) return false;

      // Timeframe filter
      if (timeframeFilter === 'today' && item.date !== todayStr) return false;
      if (timeframeFilter === 'week' && item.date < weekAgoStr) return false;
      if (timeframeFilter === 'month' && item.date < monthAgoStr) return false;
      if (timeframeFilter === 'year' && item.date < yearAgoStr) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textToSearch = `${item.title} ${item.description || ''} ${item.metricsSummary || ''} ${item.linkedGoalTitle || ''}`.toLowerCase();
        if (!textToSearch.includes(q)) return false;
      }

      return true;
    });
  }, [allHistory, domainFilter, eventTypeFilter, timeframeFilter, searchQuery, dateQuery]);

  // Filtered Archived Items
  const filteredArchived = useMemo(() => {
    return allArchived.filter((item) => {
      if (domainFilter !== 'all' && item.domain !== domainFilter) return false;

      if (dateQuery) {
        const archDate = (item.archivedAt || '').split('T')[0];
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

    setRestoreFeedback(msg);
    setTimeout(() => setRestoreFeedback(null), 4000);

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
      goals: { ar: 'الأهداف', en: 'Goals', icon: 'target' },
      focus: { ar: 'التركيز', en: 'Focus', icon: 'timer' },
      health: { ar: 'الصحة', en: 'Health', icon: 'activity' },
      finance: { ar: 'المال', en: 'Finance', icon: 'wallet' },
      journal: { ar: 'اليوميات', en: 'Journal', icon: 'book-open' },
      review: { ar: 'المراجعات', en: 'Reviews', icon: 'compass' }
    };
    return arabic ? `${labels[domain]?.icon || '📌'} ${labels[domain]?.ar || domain}` : `${labels[domain]?.icon || '📌'} ${labels[domain]?.en || domain}`;
  }

  // Event Type labels helper
  function getEventTypeLabel(type: UniversalHistoryEventType, arabic: boolean) {
    const labels: Record<UniversalHistoryEventType, { ar: string; en: string; color: string }> = {
      created: { ar: 'إنشاء وتأسيس', en: 'Created', color: 'text-sky-400 bg-sky-950/40 border-sky-800/40' },
      completed: { ar: 'إنجاز واكتمال', en: 'Completed', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' },
      archived: { ar: 'أرشفة وحفظ', en: 'Archived', color: 'text-zinc-400 bg-zinc-900 border-zinc-700/50' },
      restored: { ar: 'استعادة نشطة', en: 'Restored', color: 'text-teal-300 bg-teal-950/40 border-teal-700/40' },
      milestone: { ar: 'محطة فارقة', en: 'Milestone', color: 'text-amber-400 bg-amber-950/40 border-amber-800/40' },
      session: { ar: 'جلسة متخصصة', en: 'Session Log', color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40' },
      streak_freeze: { ar: 'تجميد سلسلة', en: 'Freeze Used', color: 'text-blue-400 bg-blue-950/40 border-blue-800/40' },
      note: { ar: 'تأمل وتدوين', en: 'Note / Reflection', color: 'text-fuchsia-400 bg-fuchsia-950/40 border-fuchsia-800/40' },
      status_change: { ar: 'تعديل حالة', en: 'Status Change', color: 'text-amber-300 bg-amber-950/40 border-amber-800/40' }
    };
    return arabic ? labels[type]?.ar || type : labels[type]?.en || type;
  }

  // Group history items by relative date
  const groupedHistory = useMemo(() => {
    const groups: { label: string; date: string; items: UniversalHistoryItem[] }[] = [];
    const map = new Map<string, UniversalHistoryItem[]>();

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    filteredHistory.forEach((item) => {
      const dateKey = item.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(item);
    });

    Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([date, items]) => {
        let label = date;
        if (date === todayStr) {
          label = isAr ? 'اليوم (Today)' : 'Today';
        } else if (date === yesterdayStr) {
          label = isAr ? 'أمس (Yesterday)' : 'Yesterday';
        }
        groups.push({ label, date, items });
      });

    return groups;
  }, [filteredHistory, isAr]);

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {restoreFeedback && (
        <div className="fixed bottom-6 start-6 z-50 p-4 rounded-xl bg-[#1e3a2b] border border-accent text-white shadow-2xl flex items-center gap-3 animate-fade-in">
          <span className="text-xl">✨</span>
          <span className="text-sm font-medium">{restoreFeedback}</span>
        </div>
      )}

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
          <div className="px-3 py-1.5 rounded-xl bg-[#152019] border border-[#233529] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-accent font-bold">{stats.totalHistoryEventsCount}</span>
            <span>{isAr ? 'حدث مسجل' : 'events'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#152019] border border-[#233529] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-amber-400 font-bold">{stats.totalArchivedItemsCount}</span>
            <span>{isAr ? 'عنصر محفوظ في الأرشيف' : 'archived'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#152019] border border-[#233529] text-xs font-mono text-muted flex items-center gap-1.5">
            <span className="text-teal-400 font-bold">{stats.totalDedicatedHours}</span>
            <span>{isAr ? 'ساعة حياة مستثمرة' : 'hours invested'}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Accomplishments Banner */}
      <div className="panel p-5 rounded-2xl bg-gradient-to-r from-[#111c15] via-[#14231b] to-[#121d17] border border-[#233d2e] shadow-lg">
        <div className="text-xs font-mono text-accent font-bold tracking-wider mb-3">
          {isAr ? 'خلاصة الإنجاز التراكمي الشامل' : 'LIFETIME ACHIEVEMENT AGGREGATE'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'المهام المكتملة' : 'Tasks Done'}</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.completedTasks}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'الكتب المقروءة' : 'Books Read'}</div>
            <div className="text-xl font-bold font-mono text-sky-400 mt-1">{stats.completedBooks}</div>
            <div className="text-[10px] text-muted font-mono">{stats.totalPagesRead} {isAr ? 'صفحة' : 'pages'}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'آيات القرآن المحفوظة' : 'Ayahs Memorized'}</div>
            <div className="text-xl font-bold font-mono text-teal-400 mt-1">{stats.totalAyahsMemorized}</div>
            <div className="text-[10px] text-muted font-mono">{stats.totalSurahsCompleted} {isAr ? 'سور مكتملة' : 'surahs'}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'الحصص الرياضية' : 'Workouts Done'}</div>
            <div className="text-xl font-bold font-mono text-orange-400 mt-1">{stats.totalWorkouts}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'الأعمال الإبداعية' : 'Artworks'}</div>
            <div className="text-xl font-bold font-mono text-purple-400 mt-1">{stats.totalArtPieces}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1510] border border-[#1f3326]">
            <div className="text-[11px] text-muted">{isAr ? 'جلسات التركيز' : 'Focus Sessions'}</div>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">{stats.totalFocusSessions}</div>
            <div className="text-[10px] text-muted font-mono">{Math.round(stats.totalFocusMinutes / 60)} {isAr ? 'ساعة' : 'hrs'}</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#233529] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'archive'
                ? 'bg-accent text-black font-bold shadow-md shadow-accent/20'
                : 'bg-[#152019] text-muted hover:text-white border border-[#233529]'
            }`}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الأرشيف الموحد' : 'Universal Archive'}</span>
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-xs font-mono bg-black/20 text-current">
              {allArchived.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-accent text-black font-bold shadow-md shadow-accent/20'
                : 'bg-[#152019] text-muted hover:text-white border border-[#233529]'
            }`}
          >
            <span>📜</span>
            <span>{isAr ? 'سجل الزمن والمسيرة' : 'Life Timeline'}</span>
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-xs font-mono bg-black/20 text-current">
              {allHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('studios_logs')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'studios_logs'
                ? 'bg-accent text-black font-bold shadow-md shadow-accent/20'
                : 'bg-[#152019] text-muted hover:text-white border border-[#233529]'
            }`}
          >
            <span>📊</span>
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
            <span className="absolute start-2.5 top-2.5 text-xs text-muted pointer-events-none">🔍</span>
          </div>

          <input
            type="date"
            value={dateQuery}
            onChange={(e) => setDateQuery(e.target.value)}
            className="input text-xs py-1.5"
            title={isAr ? 'تصفية حسب التاريخ' : 'Filter by exact date'}
          />
          {dateQuery && (
            <button
              onClick={() => setDateQuery('')}
              className="px-2 py-1 text-xs text-muted hover:text-white"
              title={isAr ? 'إلغاء تصفية التاريخ' : 'Clear date'}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#111914] border border-[#203126]">
        {/* Domain Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted pe-1 font-mono text-[11px]">{isAr ? 'المجال:' : 'Domain:'}</span>
          {(['all', 'tasks', 'habits', 'quran', 'reading', 'workout', 'drawing', 'goals', 'focus', 'journal'] as const).map(
            (dom) => (
              <button
                key={dom}
                onClick={() => setDomainFilter(dom)}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  domainFilter === dom
                    ? 'bg-[#1f3326] text-accent font-bold border border-accent/40'
                    : 'text-muted hover:text-white bg-[#152019] border border-transparent'
                }`}
              >
                {dom === 'all' ? (isAr ? 'الكل' : 'All') : getDomainLabel(dom, isAr)}
              </button>
            )
          )}
        </div>

        {/* Secondary Filters for Timeline */}
        {activeTab === 'timeline' && (
          <div className="flex flex-wrap items-center gap-2 ms-auto pt-2 sm:pt-0">
            {/* Event Type */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value as any)}
              className="select text-xs py-1"
            >
              <option value="all">{isAr ? 'كل أنواع الأحداث' : 'All Event Types'}</option>
              <option value="completed">{isAr ? 'إنجاز واكتمال' : 'Completed'}</option>
              <option value="session">{isAr ? 'جلسات متخصصة' : 'Sessions'}</option>
              <option value="milestone">{isAr ? 'محطات فارقة' : 'Milestones'}</option>
              <option value="created">{isAr ? 'تأسيس وإنشاء' : 'Created'}</option>
              <option value="archived">{isAr ? 'أرشفة' : 'Archived'}</option>
              <option value="restored">{isAr ? 'استعادة' : 'Restored'}</option>
            </select>

            {/* Timeframe */}
            <select
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value as any)}
              className="select text-xs py-1"
            >
              <option value="all">{isAr ? 'كل الفترات الزمنية' : 'All Time'}</option>
              <option value="today">{isAr ? 'اليوم' : 'Today'}</option>
              <option value="week">{isAr ? 'آخر 7 أيام' : 'Past 7 Days'}</option>
              <option value="month">{isAr ? 'آخر شهر' : 'Past Month'}</option>
              <option value="year">{isAr ? 'آخر سنة' : 'Past Year'}</option>
            </select>
          </div>
        )}
      </div>

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
              <div className="empty-icon">🗄️</div>
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
                  className="panel p-4 rounded-2xl bg-[#111914] border border-[#233529] hover:border-[#344d3d] transition-all flex flex-col justify-between space-y-3 group shadow-md"
                >
                  <div className="space-y-2.5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#18261e] border border-[#283e30] text-accent font-semibold flex items-center gap-1.5">
                        <span>{getDomainLabel(item.domain, isAr)}</span>
                      </span>

                      <span className="text-[10px] font-mono text-muted">
                        {item.archivedAt ? item.archivedAt.split('T')[0] : (item.createdAt || '').split('T')[0]}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h3
                        onClick={() => setInspectingItem({ archivedItem: item })}
                        className="text-base font-bold text-white group-hover:text-accent transition-colors cursor-pointer leading-snug"
                      >
                        {item.title}
                      </h3>
                      <div className="text-xs text-muted mt-1 font-mono">
                        {isAr ? item.typeLabelAr : item.typeLabelEn}
                      </div>
                    </div>

                    {/* Linked Goal Badge */}
                    {item.linkedGoalTitle && (
                      <div className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/30 text-emerald-300 border border-emerald-800/30 w-fit flex items-center gap-1">
                        <span>🎯</span>
                        <span className="truncate max-w-[200px]">{item.linkedGoalTitle}</span>
                      </div>
                    )}

                    {/* Metrics Summary */}
                    {item.metricsSummary && (
                      <div className="text-xs text-white/80 bg-[#16231b] p-2 rounded-lg border border-[#213529] font-mono">
                        {item.metricsSummary}
                      </div>
                    )}
                  </div>

                  {/* Actions: Details & Restore */}
                  <div className="pt-2 border-t border-[#1e2e24] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setInspectingItem({ archivedItem: item })}
                      className="text-xs text-muted hover:text-white py-1 px-2.5 rounded-lg hover:bg-[#1a2920] transition-colors"
                    >
                      {isAr ? 'عرض الرحلة' : 'Inspect Journey'}
                    </button>

                    <button
                      onClick={() => handleRestore(item)}
                      className="btn primary text-xs py-1 px-3 flex items-center gap-1.5 shadow-sm"
                      title={isAr ? 'استعادة فورية إلى المكان الأصلي' : 'Restore back to original place'}
                    >
                      <span>↩</span>
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
        <section className="space-y-6">
          <div className="flex items-center justify-between text-xs text-muted font-mono">
            <span>
              {isAr ? `الأحداث المطابقة: ${filteredHistory.length}` : `Matched timeline events: ${filteredHistory.length}`}
            </span>
          </div>

          {groupedHistory.length === 0 ? (
            <div className="empty-state py-16">
              <div className="empty-icon">📜</div>
              <strong>{isAr ? 'لا توجد أحداث مطابقة في السجل' : 'No history events found'}</strong>
              <p>
                {isAr
                  ? 'جرّب تعديل الفلاتر أو البحث للاطلاع على السجل الزمني لحياتك في NUQTA.'
                  : 'Try adjusting filters or search query to browse your life timeline.'}
              </p>
            </div>
          ) : (
            <div className="relative ps-6 border-s-2 border-[#203126] space-y-8">
              {groupedHistory.map((group) => (
                <div key={group.date} className="space-y-3 relative">
                  {/* Date Badge Node */}
                  <div className="flex items-center gap-2">
                    <span className="absolute -start-[31px] w-3 h-3 rounded-full bg-accent border-4 border-[#0c130f]"></span>
                    <span className="text-xs font-mono font-bold text-accent bg-[#14231a] px-2.5 py-0.5 rounded-md border border-[#233a2c]">
                      {group.label}
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                      ({group.items.length} {isAr ? 'أحداث' : 'events'})
                    </span>
                  </div>

                  {/* Items in Date Group */}
                  <div className="space-y-2.5">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setInspectingItem({ historyItem: item })}
                        className="p-3.5 rounded-xl bg-[#111914] border border-[#213328] hover:border-accent/40 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:shadow-md"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Domain Tag */}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#18261e] text-accent border border-[#283e30] font-semibold">
                              {getDomainLabel(item.domain, isAr)}
                            </span>

                            {/* Event Type Pill */}
                            <span className="text-[10px] px-2 py-0.5 rounded border font-semibold text-muted bg-[#152019] border-[#25392d]">
                              {getEventTypeLabel(item.eventType, isAr)}
                            </span>

                            {/* Extra Badge if any */}
                            {item.badge && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-semibold">
                                {item.badge}
                              </span>
                            )}
                          </div>

                          {/* Event Title */}
                          <h4 className="text-sm font-bold text-white group-hover:text-accent transition-colors leading-snug truncate">
                            {item.title}
                          </h4>

                          {/* Description */}
                          {item.description && (
                            <p className="text-xs text-muted line-clamp-1">{item.description}</p>
                          )}
                        </div>

                        {/* Right Meta Column */}
                        <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0 text-xs font-mono">
                          {item.metricsSummary && (
                            <span className="text-accent font-medium text-[11px]">
                              {item.metricsSummary}
                            </span>
                          )}

                          {item.linkedGoalTitle && (
                            <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 mt-0.5">
                              <span>🎯</span>
                              <span className="truncate max-w-[140px]">{item.linkedGoalTitle}</span>
                            </span>
                          )}

                          <span className="text-[10px] text-muted mt-1">
                            {item.timestamp ? item.timestamp.split('T')[1]?.slice(0, 5) : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEEP SPECIALIZED STUDIO LOGS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'studios_logs' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Quran Logs Box */}
            <div className="panel p-4 rounded-2xl bg-[#111914] border border-[#233529] space-y-3">
              <div className="flex items-center justify-between border-b border-[#213328] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📖</span>
                  <h3 className="text-base font-bold text-white">
                    {isAr ? 'سجل جلسات حفظ وتسميع القرآن' : 'Quran Memorization History'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('quran')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو ↗' : 'Open Studio ↗'}
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
                      className="p-2.5 rounded-xl bg-[#152019] border border-[#203125] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
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
            <div className="panel p-4 rounded-2xl bg-[#111914] border border-[#233529] space-y-3">
              <div className="flex items-center justify-between border-b border-[#213328] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📚</span>
                  <h3 className="text-base font-bold text-white">
                    {isAr ? 'سجل جلسات وخزانة القراءة' : 'Reading Sessions & Vault'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('reading')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو ↗' : 'Open Studio ↗'}
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
                      className="p-2.5 rounded-xl bg-[#152019] border border-[#203125] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{rs.bookTitle}</div>
                        <div className="text-[11px] text-muted">
                          {rs.date} • {rs.pagesRead} {isAr ? 'صفحة' : 'pages'}
                        </div>
                      </div>
                      <span className="font-mono text-sky-400 text-xs font-semibold">
                        {rs.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 3. Workout Sessions Box */}
            <div className="panel p-4 rounded-2xl bg-[#111914] border border-[#233529] space-y-3">
              <div className="flex items-center justify-between border-b border-[#213328] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-base font-bold text-white">
                    {isAr ? 'سجل حصص اللياقة البدنية' : 'Workout Sessions History'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('workout')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح الاستوديو ↗' : 'Open Studio ↗'}
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
                      className="p-2.5 rounded-xl bg-[#152019] border border-[#203125] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{ws.title}</div>
                        <div className="text-[11px] text-muted">
                          {ws.date} • {ws.workoutType} • حجم {ws.volumeKg} كغ
                        </div>
                      </div>
                      <span className="font-mono text-orange-400 text-xs font-semibold">
                        {ws.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 4. Creative Art Pieces Box */}
            <div className="panel p-4 rounded-2xl bg-[#111914] border border-[#233529] space-y-3">
              <div className="flex items-center justify-between border-b border-[#213328] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎨</span>
                  <h3 className="text-base font-bold text-white">
                    {isAr ? 'معرض الأعمال والمشاريع الفنية' : 'Art Studio Gallery & Pieces'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveNavTab('drawing')}
                  className="text-xs text-accent hover:underline font-mono"
                >
                  {isAr ? 'فتح المرسم ↗' : 'Open Studio ↗'}
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
                      className="p-2.5 rounded-xl bg-[#152019] border border-[#203125] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{piece.title}</div>
                        <div className="text-[11px] text-muted">
                          {piece.completedDate} • وسيط {piece.medium}
                        </div>
                      </div>
                      <span className="font-mono text-purple-400 text-xs font-semibold">
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
            className="modal-content max-w-xl p-6 bg-[#0f1712] border border-[#25392d] rounded-2xl shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18261e] text-accent border border-[#283e30] font-semibold">
                  {inspectingItem.archivedItem
                    ? isAr ? inspectingItem.archivedItem.typeLabelAr : inspectingItem.archivedItem.typeLabelEn
                    : getDomainLabel(inspectingItem.historyItem!.domain, isAr)}
                </span>
                <h2 className="text-lg font-bold text-white mt-1.5">
                  {inspectingItem.archivedItem?.title || inspectingItem.historyItem?.title}
                </h2>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-muted hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Journey Meta Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#142018] border border-[#213528] text-xs font-mono">
              <div>
                <span className="text-muted block text-[11px]">{isAr ? 'المجال الأصلي:' : 'Domain:'}</span>
                <span className="text-white font-medium">
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
                <span className="text-white">
                  {inspectingItem.archivedItem?.createdAt || inspectingItem.historyItem?.date}
                </span>
              </div>

              {inspectingItem.archivedItem?.archivedAt && (
                <div>
                  <span className="text-muted block text-[11px]">{isAr ? 'تاريخ الأرشفة:' : 'Archived At:'}</span>
                  <span className="text-amber-400">
                    {inspectingItem.archivedItem.archivedAt.split('T')[0]}
                  </span>
                </div>
              )}
            </div>

            {/* Description or Notes */}
            {(inspectingItem.historyItem?.description || inspectingItem.archivedItem?.metricsSummary) && (
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-muted">{isAr ? 'تفاصيل السجل والتراكم:' : 'Details & Metrics:'}</div>
                <div className="p-3 rounded-xl bg-[#121c15] border border-[#203125] text-xs text-white/90 leading-relaxed font-mono">
                  {inspectingItem.historyItem?.description || inspectingItem.archivedItem?.metricsSummary}
                </div>
              </div>
            )}

            {/* Linked Goal Context */}
            {(inspectingItem.historyItem?.linkedGoalTitle || inspectingItem.archivedItem?.linkedGoalTitle) && (
              <div className="p-3 rounded-xl bg-[#102217] border border-emerald-800/40 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300">
                  <span>🎯</span>
                  <span>
                    {isAr ? 'مرتبط بالهدف الاستراتيجي:' : 'Linked Goal:'}{' '}
                    <strong>{inspectingItem.historyItem?.linkedGoalTitle || inspectingItem.archivedItem?.linkedGoalTitle}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1e2e24]">
              {inspectingItem.archivedItem ? (
                <button
                  onClick={() => handleRestore(inspectingItem.archivedItem!)}
                  className="btn primary text-xs py-2 px-4 flex items-center gap-2"
                >
                  <span>↩</span>
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

