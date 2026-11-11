import { localDateKey } from './dateKey';
import {
  Task,
  Habit,
  Goal,
  FocusSession,
  JournalEntry,
  ExpenseRecord,
  SundayRitualReview,
  UniversalHistoryItem,
  UniversalHistoryDomain,
  UniversalHistoryEventType,
  HistoryAuditLogEntry,
  ArchivedItemSummary
} from '../types';

export interface HistoryDataSources {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  journalEntries: JournalEntry[];
  expenses: ExpenseRecord[];
  sundayReviews: SundayRitualReview[];
  historyAuditLogs: HistoryAuditLogEntry[];
}

export interface HistoryFilterCriteria {
  domain?: UniversalHistoryDomain | 'all';
  eventType?: UniversalHistoryEventType | 'all';
  timeframe?: 'all' | 'today' | 'week' | 'month' | 'year';
  searchQuery?: string;
}

/**
 * Universal History Engine
 * Dynamically derives a single, chronological, unified life-stream of all meaningful events
 * without duplicating or cloning session records. References original entity IDs.
 */
export function generateUniversalHistory(sources: HistoryDataSources): UniversalHistoryItem[] {
  const events: UniversalHistoryItem[] = [];
  const todayStr = localDateKey();

  // Helper to map goal ID to goal title
  const goalMap = new Map<string, string>();
  sources.goals.forEach((g) => goalMap.set(g.id, g.title));

  // 1. TASKS EVENTS
  sources.tasks.forEach((t) => {
    // Task Created
    if (t.createdAt) {
      events.push({
        id: `evt-task-create-${t.id}`,
        timestamp: t.createdAt,
        date: t.createdAt.split('T')[0],
        domain: 'tasks',
        eventType: 'created',
        title: `إنشاء مهمة: ${t.title}`,
        description: t.notes || (t.tags.length > 0 ? `الوسوم: ${t.tags.join(', ')}` : undefined),
        entityId: t.id,
        entityType: 'task',
        badge: t.priority === 1 ? 'عاجل وهام' : t.priority === 2 ? 'هام' : undefined,
        iconName: 'check-square',
        iconColor: '#34d399',
        linkedGoalId: t.linkedGoalId,
        linkedGoalTitle: t.linkedGoalId ? goalMap.get(t.linkedGoalId) : undefined,
        isArchivedEntity: t.isArchived || t.status === 'archived',
        canRestore: t.isArchived || t.status === 'archived',
        rawEntity: t
      });
    }

    // Task Completed
    if (t.status === 'completed' && t.completedAt) {
      events.push({
        id: `evt-task-complete-${t.id}`,
        timestamp: t.completedAt,
        date: t.completedAt.split('T')[0],
        domain: 'tasks',
        eventType: 'completed',
        title: `إنجاز مهمة: ${t.title}`,
        description: t.notes,
        entityId: t.id,
        entityType: 'task',
        badge: 'مكتملة',
        metricsSummary: `${t.estimatedMinutes || 30} دقيقة مقدرة`,
        iconName: 'check',
        iconColor: '#10b981',
        linkedGoalId: t.linkedGoalId,
        linkedGoalTitle: t.linkedGoalId ? goalMap.get(t.linkedGoalId) : undefined,
        rawEntity: t
      });
    }

    // Task Archived
    if ((t.isArchived || t.status === 'archived') && t.archivedAt) {
      events.push({
        id: `evt-task-archive-${t.id}`,
        timestamp: t.archivedAt,
        date: t.archivedAt.split('T')[0],
        domain: 'tasks',
        eventType: 'archived',
        title: `أرشفة مهمة: ${t.title}`,
        entityId: t.id,
        entityType: 'task',
        badge: 'مؤرشفة',
        iconName: 'archive',
        iconColor: '#94a3b8',
        linkedGoalId: t.linkedGoalId,
        linkedGoalTitle: t.linkedGoalId ? goalMap.get(t.linkedGoalId) : undefined,
        canRestore: true,
        rawEntity: t
      });
    }
  });

  // 2. HABITS & SPECIALIZED STUDIOS
  sources.habits.forEach((h) => {
    // Habit Created
    if (h.createdAt) {
      events.push({
        id: `evt-habit-create-${h.id}`,
        timestamp: h.createdAt,
        date: h.createdAt.split('T')[0],
        domain: 'habits',
        eventType: 'created',
        title: `تأسيس عادة: ${h.name}`,
        description: `المحفز السلوكي: ${h.anchor}`,
        entityId: h.id,
        entityType: 'habit',
        badge: h.specializedType && h.specializedType !== 'standard' ? h.specializedType : 'عادة مستمرة',
        iconName: 'repeat',
        iconColor: '#38bdf8',
        linkedGoalId: h.linkedGoalId,
        linkedGoalTitle: h.linkedGoalId ? goalMap.get(h.linkedGoalId) : undefined,
        isArchivedEntity: h.isArchived || h.status === 'archived',
        canRestore: h.isArchived || h.status === 'archived',
        rawEntity: h
      });
    }

    // Habit Archived
    if ((h.isArchived || h.status === 'archived') && h.archivedAt) {
      events.push({
        id: `evt-habit-archive-${h.id}`,
        timestamp: h.archivedAt,
        date: h.archivedAt.split('T')[0],
        domain: 'habits',
        eventType: 'archived',
        title: `أرشفة عادة: ${h.name}`,
        description: `تم حفظ سجل الالتزام الكامل (${h.completedDates.length} أيام مسجلة)`,
        entityId: h.id,
        entityType: 'habit',
        badge: 'عادة مؤرشفة',
        iconName: 'archive',
        iconColor: '#94a3b8',
        linkedGoalId: h.linkedGoalId,
        linkedGoalTitle: h.linkedGoalId ? goalMap.get(h.linkedGoalId) : undefined,
        canRestore: true,
        rawEntity: h
      });
    }

    // A. Quran Sessions & Milestones
    if (h.quranData) {
      // Sessions
      (h.quranData.sessions || []).forEach((qs) => {
        const typeLabel =
          qs.type === 'new_memorization' ? 'حفظ جديد' : qs.type === 'revision' ? 'مراجعة تثبيت' : 'تسميع واختبار';
        events.push({
          id: `evt-quran-session-${qs.id}`,
          timestamp: `${qs.date}T10:00:00.000Z`,
          date: qs.date,
          domain: 'quran',
          eventType: 'session',
          title: `جلسة قرآن: ${qs.surahName} (الآيات ${qs.ayahStart}-${qs.ayahEnd})`,
          description: qs.notes || `عدد الآيات: ${qs.ayahCount} • إتقان: ${qs.quality}`,
          entityId: qs.id,
          entityType: 'quran_session',
          badge: typeLabel,
          metricsSummary: `${qs.durationMinutes} دقيقة • ${qs.ayahCount} آية`,
          iconName: 'book-open',
          iconColor: '#10b981',
          linkedGoalId: qs.linkedGoalId || h.linkedGoalId,
          linkedGoalTitle: (qs.linkedGoalId || h.linkedGoalId) ? goalMap.get(qs.linkedGoalId || h.linkedGoalId!) : undefined,
          rawEntity: qs
        });
      });

      // Completed Surahs
      (h.quranData.surahs || []).forEach((surah) => {
        if (surah.status === 'completed') {
          events.push({
            id: `evt-quran-surah-${h.id}-${surah.surahNumber}`,
            timestamp: `${surah.lastReviewedDate || todayStr}T12:00:00.000Z`,
            date: surah.lastReviewedDate || todayStr,
            domain: 'quran',
            eventType: 'milestone',
            title: `إنجاز قرآني: إتمام حفظ سورة رقم ${surah.surahNumber}`,
            description: surah.notes || `إجمالي الآيات المحفوظة بإتقان: ${surah.memorizedAyahsCount}`,
            entityId: `surah-${surah.surahNumber}`,
            entityType: 'habit',
            badge: 'سورة مكتملة 🏆',
            metricsSummary: `${surah.memorizedAyahsCount} آية`,
            iconName: 'award',
            iconColor: '#eab308',
            linkedGoalId: h.linkedGoalId,
            linkedGoalTitle: h.linkedGoalId ? goalMap.get(h.linkedGoalId) : undefined,
            rawEntity: surah
          });
        }
      });
    }

    // B. Reading Sessions & Books
    if (h.readingData) {
      // Sessions
      (h.readingData.sessions || []).forEach((rs) => {
        events.push({
          id: `evt-reading-session-${rs.id}`,
          timestamp: `${rs.date}T15:00:00.000Z`,
          date: rs.date,
          domain: 'reading',
          eventType: 'session',
          title: `جلسة قراءة: ${rs.bookTitle}`,
          description: rs.notes || (rs.quoteSnippet ? `«${rs.quoteSnippet}»` : undefined),
          entityId: rs.id,
          entityType: 'book',
          badge: 'قراءة معرفية',
          metricsSummary: `${rs.pagesRead} صفحة في ${rs.durationMinutes} دقيقة`,
          iconName: 'book-open',
          iconColor: '#38bdf8',
          linkedGoalId: rs.linkedGoalId || h.linkedGoalId,
          linkedGoalTitle: (rs.linkedGoalId || h.linkedGoalId) ? goalMap.get(rs.linkedGoalId || h.linkedGoalId!) : undefined,
          rawEntity: rs
        });
      });

      // Books
      (h.readingData.books || []).forEach((b) => {
        if (b.status === 'completed') {
          events.push({
            id: `evt-book-complete-${b.id}`,
            timestamp: `${b.completedDate || todayStr}T18:00:00.000Z`,
            date: b.completedDate || todayStr,
            domain: 'reading',
            eventType: 'completed',
            title: `إتمام قراءة كتاب: ${b.title}`,
            description: `المؤلف: ${b.author}${b.rating ? ` • تقييم: ${'★'.repeat(b.rating)}` : ''}`,
            entityId: b.id,
            entityType: 'book',
            badge: 'كتاب مكتمل 📚',
            metricsSummary: `${b.totalPages} صفحة`,
            iconName: 'award',
            iconColor: '#a855f7',
            linkedGoalId: b.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (b.linkedGoalId || h.linkedGoalId) ? goalMap.get(b.linkedGoalId || h.linkedGoalId!) : undefined,
            rawEntity: b
          });
        }
        if (b.status === 'archived') {
          events.push({
            id: `evt-book-archive-${b.id}`,
            timestamp: `${b.archivedAt || todayStr}T18:00:00.000Z`,
            date: (b.archivedAt || todayStr).split('T')[0],
            domain: 'reading',
            eventType: 'archived',
            title: `أرشفة كتاب: ${b.title}`,
            description: `المؤلف: ${b.author} • الصفحات المنجزة: ${b.currentPage}/${b.totalPages}`,
            entityId: b.id,
            entityType: 'book',
            badge: 'كتاب مؤرشف',
            iconName: 'archive',
            iconColor: '#94a3b8',
            linkedGoalId: b.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (b.linkedGoalId || h.linkedGoalId) ? goalMap.get(b.linkedGoalId || h.linkedGoalId!) : undefined,
            canRestore: true,
            rawEntity: b
          });
        }
      });
    }

    // C. Home Workout Sessions & Routines
    if (h.workoutData) {
      (h.workoutData.sessions || []).forEach((ws) => {
        events.push({
          id: `evt-workout-session-${ws.id}`,
          timestamp: `${ws.date}T08:00:00.000Z`,
          date: ws.date,
          domain: 'workout',
          eventType: 'session',
          title: `حصة رياضية: ${ws.title}`,
          description: ws.notes || `النوع: ${ws.workoutType} • الشدة: ${ws.intensityRating}/5`,
          entityId: ws.id,
          entityType: 'workout_routine',
          badge: 'لياقة منزلية ⚡',
          metricsSummary: `${ws.durationMinutes} دقيقة • حجم ${ws.volumeKg} كغ`,
          iconName: 'activity',
          iconColor: '#f97316',
          linkedGoalId: ws.linkedGoalId || h.linkedGoalId,
          linkedGoalTitle: (ws.linkedGoalId || h.linkedGoalId) ? goalMap.get(ws.linkedGoalId || h.linkedGoalId!) : undefined,
          rawEntity: ws
        });
      });

      (h.workoutData.customRoutines || []).forEach((r) => {
        if (r.isArchived) {
          events.push({
            id: `evt-workout-routine-archive-${r.id}`,
            timestamp: `${r.archivedAt || todayStr}T10:00:00.000Z`,
            date: (r.archivedAt || todayStr).split('T')[0],
            domain: 'workout',
            eventType: 'archived',
            title: `أرشفة روتين: ${r.nameAr || r.name}`,
            description: r.descriptionAr || r.description,
            entityId: r.id,
            entityType: 'workout_routine',
            badge: 'روتين مؤرشف',
            iconName: 'archive',
            iconColor: '#94a3b8',
            canRestore: true,
            rawEntity: r
          });
        }
      });
    }

    // D. Art & Drawing Pieces & Projects
    if (h.drawingData) {
      // Pieces
      (h.drawingData.pieces || []).forEach((piece) => {
        events.push({
          id: `evt-drawing-piece-${piece.id}`,
          timestamp: `${piece.completedDate}T16:00:00.000Z`,
          date: piece.completedDate,
          domain: 'drawing',
          eventType: 'session',
          title: `عمل فني: ${piece.title}`,
          description: piece.notes || (piece.projectTitle ? `ضمن مشروع: ${piece.projectTitle}` : undefined),
          entityId: piece.id,
          entityType: 'art_project',
          badge: `وسيط ${piece.medium}`,
          metricsSummary: `${piece.durationMinutes} دقيقة تدفق فني`,
          iconName: 'palette',
          iconColor: '#a855f7',
          linkedGoalId: piece.linkedGoalId || h.linkedGoalId,
          linkedGoalTitle: (piece.linkedGoalId || h.linkedGoalId) ? goalMap.get(piece.linkedGoalId || h.linkedGoalId!) : undefined,
          rawEntity: piece
        });
      });

      // Projects
      (h.drawingData.projects || []).forEach((proj) => {
        if (proj.stage === 'completed') {
          events.push({
            id: `evt-art-project-complete-${proj.id}`,
            timestamp: `${proj.completedDate || todayStr}T17:00:00.000Z`,
            date: proj.completedDate || todayStr,
            domain: 'drawing',
            eventType: 'completed',
            title: `إتمام مشروع إبداعي: ${proj.title}`,
            description: proj.description,
            entityId: proj.id,
            entityType: 'art_project',
            badge: 'مشروع فني منجز 🎨',
            metricsSummary: `${proj.totalMinutesSpent} دقيقة إجمالية • ${proj.sessionsCount} جلسات`,
            iconName: 'award',
            iconColor: '#ec4899',
            linkedGoalId: proj.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (proj.linkedGoalId || h.linkedGoalId) ? goalMap.get(proj.linkedGoalId || h.linkedGoalId!) : undefined,
            rawEntity: proj
          });
        }
        if (proj.stage === 'archived' || proj.isArchived) {
          events.push({
            id: `evt-art-project-archive-${proj.id}`,
            timestamp: `${proj.archivedAt || todayStr}T17:00:00.000Z`,
            date: (proj.archivedAt || todayStr).split('T')[0],
            domain: 'drawing',
            eventType: 'archived',
            title: `أرشفة مشروع فني: ${proj.title}`,
            description: proj.description,
            entityId: proj.id,
            entityType: 'art_project',
            badge: 'مشروع مؤرشف',
            iconName: 'archive',
            iconColor: '#94a3b8',
            linkedGoalId: proj.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (proj.linkedGoalId || h.linkedGoalId) ? goalMap.get(proj.linkedGoalId || h.linkedGoalId!) : undefined,
            canRestore: true,
            rawEntity: proj
          });
        }
      });
    }
  });

  // 3. GOALS EVENTS & MILESTONES
  sources.goals.forEach((g) => {
    // Goal Created
    if (g.createdAt) {
      events.push({
        id: `evt-goal-create-${g.id}`,
        timestamp: g.createdAt,
        date: g.createdAt.split('T')[0],
        domain: 'goals',
        eventType: 'created',
        title: `إطلاق هدف استراتيجي: ${g.title}`,
        description: g.description || g.visionNotes,
        entityId: g.id,
        entityType: 'goal',
        badge: g.category,
        iconName: 'target',
        iconColor: '#34d399',
        linkedGoalId: g.id,
        linkedGoalTitle: g.title,
        isArchivedEntity: g.status === 'archived',
        canRestore: g.status === 'archived',
        rawEntity: g
      });
    }

    // Goal Completed
    if (g.status === 'completed') {
      events.push({
        id: `evt-goal-complete-${g.id}`,
        timestamp: g.updatedAt || `${todayStr}T12:00:00.000Z`,
        date: (g.updatedAt || todayStr).split('T')[0],
        domain: 'goals',
        eventType: 'completed',
        title: `تحقيق هدف استراتيجي: ${g.title}`,
        description: g.description,
        entityId: g.id,
        entityType: 'goal',
        badge: 'هدف منجز 🎯',
        metricsSummary: `${g.keyResults.length} نتائج رئيسية محققة`,
        iconName: 'award',
        iconColor: '#10b981',
        linkedGoalId: g.id,
        linkedGoalTitle: g.title,
        rawEntity: g
      });
    }

    // Goal Archived
    if (g.status === 'archived') {
      events.push({
        id: `evt-goal-archive-${g.id}`,
        timestamp: g.archivedAt || g.updatedAt || `${todayStr}T12:00:00.000Z`,
        date: (g.archivedAt || g.updatedAt || todayStr).split('T')[0],
        domain: 'goals',
        eventType: 'archived',
        title: `أرشفة هدف: ${g.title}`,
        description: `تم حفظ كل النتائج والأنشطة المرتبطة بدون فقد أي مساهمة.`,
        entityId: g.id,
        entityType: 'goal',
        badge: 'هدف مؤرشف',
        iconName: 'archive',
        iconColor: '#94a3b8',
        linkedGoalId: g.id,
        linkedGoalTitle: g.title,
        canRestore: true,
        rawEntity: g
      });
    }

    // Milestones Completed
    (g.milestones || []).forEach((m) => {
      if (m.isCompleted && m.completedDate) {
        events.push({
          id: `evt-milestone-complete-${g.id}-${m.id}`,
          timestamp: `${m.completedDate}T12:00:00.000Z`,
          date: m.completedDate,
          domain: 'goals',
          eventType: 'milestone',
          title: `إنجاز مرحلة محورية: ${m.title}`,
          description: `ضمن هدف: ${g.title}`,
          entityId: m.id,
          entityType: 'goal',
          badge: 'مرحلة منجزة 🚩',
          iconName: 'flag',
          iconColor: '#f59e0b',
          linkedGoalId: g.id,
          linkedGoalTitle: g.title,
          rawEntity: m
        });
      }
    });
  });

  // 4. FOCUS SESSIONS
  sources.focusSessions.forEach((fs) => {
    events.push({
      id: `evt-focus-${fs.id}`,
      timestamp: fs.completedAt,
      date: fs.completedAt.split('T')[0],
      domain: 'focus',
      eventType: 'session',
      title: fs.taskTitle ? `جلسة تركيز: ${fs.taskTitle}` : 'جلسة عمل عميق',
      description: fs.notes || `تشتتات مسجلة: ${fs.interruptionCount}`,
      entityId: fs.id,
      entityType: 'focus_session',
      badge: `إنتاجية ${fs.productivityScore}/5`,
      metricsSummary: `${fs.durationMinutes} دقيقة عمل غير منقطع`,
      iconName: 'timer',
      iconColor: '#6366f1',
      rawEntity: fs
    });
  });

  // 5. JOURNAL ENTRIES
  sources.journalEntries.forEach((je) => {
    events.push({
      id: `evt-journal-${je.id}`,
      timestamp: je.createdAt || `${je.date}T21:00:00.000Z`,
      date: je.date,
      domain: 'journal',
      eventType: 'note',
      title: `تأمل يومي: يوم ${je.date}`,
      description: je.whatWentWell ? `«ما سار على ما يرام: ${je.whatWentWell.slice(0, 80)}...»` : undefined,
      entityId: je.id,
      entityType: 'journal',
      badge: `مزاج ${je.mood}/5`,
      metricsSummary: `${je.gratitudeList?.length || 0} نقاط امتنان`,
      iconName: 'book-open',
      iconColor: '#14b8a6',
      rawEntity: je
    });
  });

  // 6. SUNDAY RITUALS (WEEKLY REVIEWS)
  sources.sundayReviews.forEach((sr) => {
    events.push({
      id: `evt-sunday-review-${sr.id}`,
      timestamp: sr.completedAt || `${sr.date}T20:00:00.000Z`,
      date: sr.date,
      domain: 'review',
      eventType: 'milestone',
      title: `طقس الأحد: المراجعة الأسبوعية للأداء`,
      description: `مكاسب الأسبوع: ${sr.wins.slice(0, 2).join(' • ')}`,
      entityId: sr.id,
      entityType: 'journal',
      badge: 'مراجعة أسبوعية 🌟',
      metricsSummary: `${sr.wins.length} مكاسب • ${sr.lessons.length} دروس`,
      iconName: 'compass',
      iconColor: '#eab308',
      rawEntity: sr
    });
  });

  // 7. EXPLICIT AUDIT LOGS (Restores, Resumes, etc.)
  sources.historyAuditLogs.forEach((log) => {
    events.push({
      id: `evt-audit-${log.id}`,
      timestamp: log.timestamp,
      date: log.timestamp.split('T')[0],
      domain: log.domain,
      eventType: log.action,
      title: log.title,
      description: log.description,
      entityId: log.entityId,
      entityType: log.entityType,
      badge: log.action === 'restored' ? 'تمت الاستعادة ↩' : log.action,
      iconName: log.action === 'restored' ? 'rotate-ccw' : 'activity',
      iconColor: '#2dd4bf',
      rawEntity: log
    });
  });

  // Deduplicate by deterministic ID and sort descending (latest events first)
  const uniqueMap = new Map<string, UniversalHistoryItem>();
  events.forEach((item) => {
    uniqueMap.set(item.id, item);
  });

  return Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Universal Archive Collector
 * Extracts all archived items across tasks, habits, books, routines, projects, and goals
 * for unified viewing, filtering, and 1-click safe restoration.
 */
export function getUniversalArchivedItems(sources: HistoryDataSources): ArchivedItemSummary[] {
  const list: ArchivedItemSummary[] = [];

  const goalMap = new Map<string, string>();
  sources.goals.forEach((g) => goalMap.set(g.id, g.title));

  // 1. Archived Tasks
  sources.tasks.forEach((t) => {
    if (t.isArchived || t.status === 'archived') {
      list.push({
        id: `archived-task-${t.id}`,
        originalId: t.id,
        domain: 'tasks',
        title: t.title,
        typeLabelAr: 'مهمة مؤرشفة',
        typeLabelEn: 'Archived Task',
        archivedAt: t.archivedAt,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        status: t.status,
        linkedGoalId: t.linkedGoalId,
        linkedGoalTitle: t.linkedGoalId ? goalMap.get(t.linkedGoalId) : undefined,
        metricsSummary: t.estimatedMinutes ? `${t.estimatedMinutes} دقيقة` : undefined,
        raw: t
      });
    }
  });

  // 2. Archived Habits
  sources.habits.forEach((h) => {
    if (h.isArchived || h.status === 'archived') {
      list.push({
        id: `archived-habit-${h.id}`,
        originalId: h.id,
        domain: 'habits',
        title: h.name,
        typeLabelAr: 'عادة مؤرشفة',
        typeLabelEn: 'Archived Habit',
        archivedAt: h.archivedAt,
        createdAt: h.createdAt,
        status: h.status || 'archived',
        linkedGoalId: h.linkedGoalId,
        linkedGoalTitle: h.linkedGoalId ? goalMap.get(h.linkedGoalId) : undefined,
        metricsSummary: `${h.completedDates.length} أيام التزام تاريخية`,
        raw: h
      });
    }

    // Archived Books inside reading habit
    if (h.readingData?.books) {
      h.readingData.books.forEach((b) => {
        if (b.status === 'archived') {
          list.push({
            id: `archived-book-${b.id}`,
            originalId: b.id,
            domain: 'reading',
            title: b.title,
            typeLabelAr: 'كتاب مؤرشف',
            typeLabelEn: 'Archived Book',
            archivedAt: b.archivedAt,
            createdAt: b.startDate,
            completedAt: b.completedDate,
            status: 'archived',
            linkedGoalId: b.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (b.linkedGoalId || h.linkedGoalId) ? goalMap.get(b.linkedGoalId || h.linkedGoalId!) : undefined,
            metricsSummary: `${b.currentPage}/${b.totalPages} صفحة • ${b.author}`,
            raw: b,
            parentHabitId: h.id
          });
        }
      });
    }

    // Archived Routines inside workout habit
    if (h.workoutData?.customRoutines) {
      h.workoutData.customRoutines.forEach((r) => {
        if (r.isArchived) {
          list.push({
            id: `archived-routine-${r.id}`,
            originalId: r.id,
            domain: 'workout',
            title: r.nameAr || r.name,
            typeLabelAr: 'روتين لياقة مؤرشف',
            typeLabelEn: 'Archived Routine',
            archivedAt: r.archivedAt,
            status: 'archived',
            metricsSummary: `${r.estimatedMinutes} دقيقة • ${r.exercises.length} تمارين`,
            raw: r,
            parentHabitId: h.id
          });
        }
      });
    }

    // Archived Projects inside drawing habit
    if (h.drawingData?.projects) {
      h.drawingData.projects.forEach((proj) => {
        if (proj.stage === 'archived' || proj.isArchived) {
          list.push({
            id: `archived-project-${proj.id}`,
            originalId: proj.id,
            domain: 'drawing',
            title: proj.title,
            typeLabelAr: 'مشروع فني مؤرشف',
            typeLabelEn: 'Archived Project',
            archivedAt: proj.archivedAt,
            createdAt: proj.startedDate,
            completedAt: proj.completedDate,
            status: 'archived',
            linkedGoalId: proj.linkedGoalId || h.linkedGoalId,
            linkedGoalTitle: (proj.linkedGoalId || h.linkedGoalId) ? goalMap.get(proj.linkedGoalId || h.linkedGoalId!) : undefined,
            metricsSummary: `${proj.totalMinutesSpent} دقيقة • ${proj.sessionsCount} جلسات`,
            raw: proj,
            parentHabitId: h.id
          });
        }
      });
    }
  });

  // 3. Archived Goals
  sources.goals.forEach((g) => {
    if (g.status === 'archived') {
      list.push({
        id: `archived-goal-${g.id}`,
        originalId: g.id,
        domain: 'goals',
        title: g.title,
        typeLabelAr: 'هدف استراتيجي مؤرشف',
        typeLabelEn: 'Archived Goal',
        archivedAt: g.archivedAt || g.updatedAt,
        createdAt: g.createdAt,
        status: 'archived',
        linkedGoalId: g.id,
        linkedGoalTitle: g.title,
        metricsSummary: `${g.keyResults.length} نتائج رئيسية • ${g.milestones?.length || 0} مراحل`,
        raw: g
      });
    }
  });

  return list.sort((a, b) => {
    const timeA = a.archivedAt || a.createdAt || '';
    const timeB = b.archivedAt || b.createdAt || '';
    return timeB.localeCompare(timeA);
  });
}

/**
 * Historical Stats Summary for Life Intelligence & Insights
 */
export function getHistoricalStatsSummary(sources: HistoryDataSources) {
  const history = generateUniversalHistory(sources);
  const archived = getUniversalArchivedItems(sources);

  // Completed items count
  const completedTasks = sources.tasks.filter((t) => t.status === 'completed').length;
  const completedGoals = sources.goals.filter((g) => g.status === 'completed').length;

  let completedBooks = 0;
  let totalPagesRead = 0;
  let totalReadingMinutes = 0;

  let totalWorkouts = 0;
  let totalWorkoutMinutes = 0;

  let totalArtPieces = 0;
  let totalArtMinutes = 0;

  let totalQuranSessions = 0;
  let totalQuranMinutes = 0;
  let totalAyahsMemorized = 0;
  let totalSurahsCompleted = 0;

  sources.habits.forEach((h) => {
    if (h.readingData) {
      completedBooks += (h.readingData.books || []).filter((b) => b.status === 'completed').length;
      totalPagesRead += h.readingData.totalPagesRead || 0;
      totalReadingMinutes += h.readingData.totalReadingMinutes || 0;
    }
    if (h.workoutData) {
      totalWorkouts += (h.workoutData.sessions || []).length;
      totalWorkoutMinutes += h.workoutData.totalMinutes || 0;
    }
    if (h.drawingData) {
      totalArtPieces += (h.drawingData.pieces || []).length;
      totalArtMinutes += h.drawingData.totalDrawingMinutes || 0;
    }
    if (h.quranData) {
      totalQuranSessions += (h.quranData.sessions || []).length;
      totalQuranMinutes += (h.quranData.totalMemorizationMinutes || 0) + (h.quranData.totalRevisionMinutes || 0);
      totalAyahsMemorized += h.quranData.totalAyahsMemorized || 0;
      totalSurahsCompleted += h.quranData.totalSurahsCompleted || 0;
    }
  });

  const totalFocusMinutes = sources.focusSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const totalDedicatedMinutes =
    totalReadingMinutes + totalWorkoutMinutes + totalArtMinutes + totalQuranMinutes + totalFocusMinutes;

  return {
    totalHistoryEventsCount: history.length,
    totalArchivedItemsCount: archived.length,
    completedTasks,
    completedGoals,
    completedBooks,
    totalPagesRead,
    totalWorkouts,
    totalArtPieces,
    totalQuranSessions,
    totalAyahsMemorized,
    totalSurahsCompleted,
    totalFocusSessions: sources.focusSessions.length,
    totalFocusMinutes,
    totalDedicatedHours: Math.round(totalDedicatedMinutes / 60)
  };
}

