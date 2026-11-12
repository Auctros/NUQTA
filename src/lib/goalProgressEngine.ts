import { localDateKey, parseDateKey } from './dateKey';
import { habitCompliance } from './habitSchedule';
import { Goal, KeyResult, Task, Habit, BookItem, ArtProject } from '../types';

export interface EvaluatedKeyResult extends KeyResult {
  evaluatedCurrentValue: number;
  progressPercent: number;
  hasInsufficientData: boolean;
  dataExplanation: string;
}

export interface ActivityContributionItem {
  id: string;
  type: 'task' | 'habit' | 'reading' | 'workout' | 'drawing' | 'quran';
  title: string;
  date: string; // YYYY-MM-DD
  contributionNote: string;
  icon: string;
}

export interface GoalIntelligenceSummary {
  goalId: string;
  evaluatedKrs: EvaluatedKeyResult[];
  outcomeProgressPercent: number; // النتيجة المستهدفة المحققة من الـ Key Results أو المراحل
  executionProgressPercent: number; // الجهد والتقدم التنفيذي من المهام والعادات
  overallProgressPercent: number;
  progressCalculationMethod: string;
  executionSummary: {
    tasksCompleted: number;
    tasksTotal: number;
    tasksPercent: number;
    habitsConsistencyPercent: number;
    totalLinkedActivitiesCount: number;
    totalRecordedSessionsCount: number;
  };
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesProgressPercent: number;
  timeElapsedPercent: number | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  pacingStatus: 'ahead' | 'on_track' | 'behind' | 'dormant' | 'not_started' | 'completed';
  pacingLabelAr: string;
  pacingLabelEn: string;
  lastActivityDate: string | null;
  isDormant: boolean; // no activity in > 7 days
  contributions: ActivityContributionItem[];
  linkedTasksCount: number;
  linkedHabitsCount: number;
  linkedBooksCount: number;
  linkedArtProjectsCount: number;
}

/**
 * Calculates dynamic live intelligence for a single Goal against real tasks and habits domain data.
 * Does NOT duplicate data or mutate domain records.
 */
export function evaluateGoalProgress(
  goal: Goal,
  allTasks: Task[],
  allHabits: Habit[]
): GoalIntelligenceSummary {
  const todayStr = localDateKey();
  const now = new Date();

  // 1. Gather all linked tasks (unique by ID)
  // Single source of truth: the item's own linkedGoalId. The goal's id list is only a
  // legacy fallback for items that carry no linkedGoalId, so an item re-linked to another
  // goal can never be counted in two goals.
  const listedTaskIds = new Set(goal.linkedTaskIds || []);
  const linkedTasks = allTasks.filter((t) =>
    t.linkedGoalId !== undefined ? t.linkedGoalId === goal.id : listedTaskIds.has(t.id)
  );

  // 2. Gather all linked habits (unique by ID)
  const listedHabitIds = new Set(goal.linkedHabitIds || []);
  const linkedHabits = allHabits.filter((h) =>
    h.linkedGoalId !== undefined ? h.linkedGoalId === goal.id : listedHabitIds.has(h.id)
  );
  const linkedHabitIds = new Set(linkedHabits.map((h) => h.id));

  // 3. Gather linked books from reading habits (unique by ID)
  const linkedBookIds = new Set(goal.linkedBookIds || []);
  const availableBooksMap = new Map<string, BookItem>();
  allHabits.forEach((h) => {
    if (h.readingData?.books) {
      h.readingData.books.forEach((b) => {
        if (linkedBookIds.has(b.id) || b.linkedGoalId === goal.id || linkedHabitIds.has(h.id)) {
          availableBooksMap.set(b.id, b);
        }
      });
    }
  });
  const linkedBooks = Array.from(availableBooksMap.values());

  // 4. Gather linked art projects from drawing habits (unique by ID)
  const linkedArtProjectIds = new Set(goal.linkedArtProjectIds || []);
  const availableArtProjectsMap = new Map<string, ArtProject>();
  allHabits.forEach((h) => {
    if (h.drawingData?.projects) {
      h.drawingData.projects.forEach((p) => {
        if (linkedArtProjectIds.has(p.id) || p.linkedGoalId === goal.id || linkedHabitIds.has(h.id)) {
          availableArtProjectsMap.set(p.id, p);
        }
      });
    }
  });
  const linkedArtProjects = Array.from(availableArtProjectsMap.values());

  // 5. Evaluate each Key Result
  const evaluatedKrs: EvaluatedKeyResult[] = (goal.keyResults || []).map((kr) => {
    const startVal = kr.startValue ?? 0;
    const targetVal = kr.targetValue;
    const source = kr.dataSource || 'manual';

    let evaluatedVal = kr.currentValue;
    let hasInsufficientData = false;
    let dataExplanation = '';

    switch (source) {
      case 'tasks_completed': {
        if (linkedTasks.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط مهام بهذا الهدف لاحتساب التقدم تلقائياً';
          evaluatedVal = 0;
        } else {
          const completedCount = linkedTasks.filter((t) => t.status === 'completed').length;
          evaluatedVal = completedCount;
          dataExplanation = `محسوب تلقائياً من إنجاز ${completedCount} من أصل ${linkedTasks.length} مهام مرتبطة`;
        }
        break;
      }

      case 'habit_consistency': {
        if (linkedHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادات لحساب معدل الالتزام';
          evaluatedVal = 0;
        } else {
          // Average completion in past 14 days
          const past14Days = Array.from({ length: 14 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - i));
            return localDateKey(d);
          });
          // Only days a habit was actually due count (daily / weekdays / custom days).
          const totals = linkedHabits.reduce(
            (acc, h) => {
              const c = habitCompliance(h, past14Days);
              return { due: acc.due + c.due, done: acc.done + c.done };
            },
            { due: 0, done: 0 }
          );
          if (totals.due === 0) {
            hasInsufficientData = true;
            dataExplanation = 'لا توجد أيام مستحقة للعادات المرتبطة خلال آخر 14 يوماً بعد';
            evaluatedVal = 0;
          } else {
            const ratePercent = Math.round((totals.done / totals.due) * 100);
            evaluatedVal = ratePercent;
            dataExplanation = `محسوب من ${totals.done} إنجازاً في ${totals.due} يوم مستحق لـ ${linkedHabits.length} عادات خلال آخر 14 يوماً (${ratePercent}%)`;
          }
        }
        break;
      }

      case 'reading_books_completed': {
        const booksPool = linkedBooks.length > 0
          ? linkedBooks
          : linkedHabits.flatMap((h) => h.readingData?.books || []);

        if (booksPool.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط كتب أو عادة القراءة لتتبع الكتب المكتملة';
          evaluatedVal = 0;
        } else {
          const completedBooks = booksPool.filter((b) => b.status === 'completed').length;
          evaluatedVal = completedBooks;
          dataExplanation = `محسوب من إتمام ${completedBooks} من أصل ${booksPool.length} كتب مسجلة`;
        }
        break;
      }

      case 'reading_pages_read': {
        const relevantHabits = linkedHabits.filter((h) => h.readingData);
        if (relevantHabits.length === 0 && linkedBooks.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة القراءة أو كتب محددة لحساب الصفحات';
          evaluatedVal = 0;
        } else if (linkedBooks.length > 0) {
          const pagesSum = linkedBooks.reduce((sum, b) => sum + (b.currentPage || 0), 0);
          evaluatedVal = pagesSum;
          dataExplanation = `محسوب من مجموع صفحات ${linkedBooks.length} كتب مرتبطة`;
        } else {
          const totalPages = relevantHabits.reduce(
            (sum, h) => sum + (h.readingData?.totalPagesRead || 0),
            0
          );
          evaluatedVal = totalPages;
          dataExplanation = `محسوب من إجمالي الصفحات المسجلة في استوديو القراءة (${totalPages} صفحة)`;
        }
        break;
      }

      case 'reading_hours': {
        const relevantHabits = linkedHabits.filter((h) => h.readingData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة القراءة لاحتساب ساعات الجلسات';
          evaluatedVal = 0;
        } else {
          const totalMins = relevantHabits.reduce(
            (sum, h) => sum + (h.readingData?.totalReadingMinutes || 0),
            0
          );
          evaluatedVal = Math.round((totalMins / 60) * 10) / 10;
          dataExplanation = `محسوب من مجموع جلسات القراءة الفعلية (${evaluatedVal} ساعة)`;
        }
        break;
      }

      case 'workout_sessions_count': {
        const relevantHabits = linkedHabits.filter((h) => h.workoutData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة التمارين المنزلية لاحتساب الحصص';
          evaluatedVal = 0;
        } else {
          const count = relevantHabits.reduce(
            (sum, h) => sum + (h.workoutData?.sessions?.length || h.workoutData?.totalWorkouts || 0),
            0
          );
          evaluatedVal = count;
          dataExplanation = `محسوب من إجمالي حصص التمارين المنزلية الموثقة (${count} حصة)`;
        }
        break;
      }

      case 'workout_total_reps': {
        const relevantHabits = linkedHabits.filter((h) => h.workoutData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة التمارين لاحتساب التكرارات';
          evaluatedVal = 0;
        } else {
          const totalReps = relevantHabits.reduce(
            (sum, h) => sum + (h.workoutData?.totalReps || 0),
            0
          );
          evaluatedVal = totalReps;
          dataExplanation = `محسوب من مجموع التكرارات المنجزة في التمارين المنزلية (${totalReps} تكرار)`;
        }
        break;
      }

      case 'workout_total_minutes': {
        const relevantHabits = linkedHabits.filter((h) => h.workoutData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة التمارين لحساب دقائق التدريب';
          evaluatedVal = 0;
        } else {
          const mins = relevantHabits.reduce(
            (sum, h) => sum + (h.workoutData?.totalMinutes || 0),
            0
          );
          evaluatedVal = mins;
          dataExplanation = `محسوب من إجمالي مدة التدريب الموثقة (${mins} دقيقة)`;
        }
        break;
      }

      case 'drawing_projects_completed': {
        const pool = linkedArtProjects.length > 0
          ? linkedArtProjects
          : linkedHabits.flatMap((h) => h.drawingData?.projects || []);

        if (pool.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط مشاريع فنية لتتبع المكتمل منها';
          evaluatedVal = 0;
        } else {
          const done = pool.filter((p) => p.stage === 'completed').length;
          evaluatedVal = done;
          dataExplanation = `محسوب من إتمام ${done} من أصل ${pool.length} مشاريع فنية`;
        }
        break;
      }

      case 'drawing_flow_hours': {
        const relevantHabits = linkedHabits.filter((h) => h.drawingData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة الرسم لحساب ساعات التدفق الإبداعي';
          evaluatedVal = 0;
        } else {
          const mins = relevantHabits.reduce(
            (sum, h) => sum + (h.drawingData?.totalDrawingMinutes || 0),
            0
          );
          evaluatedVal = Math.round((mins / 60) * 10) / 10;
          dataExplanation = `محسوب من جلسات المرسم وساعات التدفق (${evaluatedVal} ساعة)`;
        }
        break;
      }

      case 'drawing_artworks_count': {
        const relevantHabits = linkedHabits.filter((h) => h.drawingData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة الرسم لتتبع عدد الأعمال';
          evaluatedVal = 0;
        } else {
          const pieces = relevantHabits.reduce(
            (sum, h) => sum + (h.drawingData?.pieces?.length || h.drawingData?.totalSketches || 0),
            0
          );
          evaluatedVal = pieces;
          dataExplanation = `محسوب من إجمالي الأعمال والسكتشات الموثقة في المعرض (${pieces} عمل)`;
        }
        break;
      }

      case 'quran_ayahs_memorized': {
        const relevantHabits = linkedHabits.filter((h) => h.quranData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة حفظ القرآن لاحتساب الآيات المحفوظة';
          evaluatedVal = 0;
        } else {
          const ayahs = relevantHabits.reduce((sum, h) => sum + (h.quranData?.totalAyahsMemorized || 0), 0);
          evaluatedVal = ayahs;
          dataExplanation = `محسوب من إجمالي الآيات المحفوظة فعلياً دون تكرار (${ayahs} آية)`;
        }
        break;
      }

      case 'quran_surahs_completed': {
        const relevantHabits = linkedHabits.filter((h) => h.quranData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة حفظ القرآن لاحتساب السور المكتملة';
          evaluatedVal = 0;
        } else {
          const surahs = relevantHabits.reduce((sum, h) => sum + (h.quranData?.totalSurahsCompleted || 0), 0);
          evaluatedVal = surahs;
          dataExplanation = `محسوب من السور القرآنية المحفوظة بالكامل (${surahs} سورة)`;
        }
        break;
      }

      case 'quran_revision_sessions': {
        const relevantHabits = linkedHabits.filter((h) => h.quranData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة حفظ القرآن لتتبع جلسات المراجعة';
          evaluatedVal = 0;
        } else {
          const sessions = relevantHabits.reduce(
            (sum, h) => sum + (h.quranData?.sessions?.filter((s) => s.type !== 'new_memorization').length || 0),
            0
          );
          evaluatedVal = sessions;
          dataExplanation = `محسوب من جلسات المراجعة والتسميع الموثقة (${sessions} جلسة)`;
        }
        break;
      }

      case 'quran_total_minutes': {
        const relevantHabits = linkedHabits.filter((h) => h.quranData);
        if (relevantHabits.length === 0) {
          hasInsufficientData = true;
          dataExplanation = 'بانتظار ربط عادة حفظ القرآن لاحتساب دقائق الحفظ والمراجعة';
          evaluatedVal = 0;
        } else {
          const mins = relevantHabits.reduce(
            (sum, h) => sum + (h.quranData?.totalMemorizationMinutes || 0) + (h.quranData?.totalRevisionMinutes || 0),
            0
          );
          evaluatedVal = mins;
          dataExplanation = `محسوب من إجمالي وقت الحفظ والمراجعة الموثق (${mins} دقيقة)`;
        }
        break;
      }

      case 'manual':
      default: {
        evaluatedVal = kr.currentValue || 0;
        dataExplanation = 'تحديث يدوي مباشر من المستخدم';
        break;
      }
    }

    const range = targetVal - startVal;
    let progressPercent = 0;
    if (range > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round(((evaluatedVal - startVal) / range) * 100)));
    } else if (evaluatedVal >= targetVal) {
      progressPercent = 100;
    }

    return {
      ...kr,
      evaluatedCurrentValue: evaluatedVal,
      progressPercent,
      hasInsufficientData,
      dataExplanation
    };
  });

  // 6. Outcome Progress Calculation (Derived strictly from measurable Key Results or Milestones)
  let outcomeProgressPercent = 0;
  let progressCalculationMethod = '';
  if (evaluatedKrs.length > 0) {
    const sumPct = evaluatedKrs.reduce((acc, k) => acc + k.progressPercent, 0);
    outcomeProgressPercent = Math.round(sumPct / evaluatedKrs.length);
    progressCalculationMethod = `متوسط (${evaluatedKrs.length}) نتائج رئيسية موضوعية`;
  } else if (goal.milestones && goal.milestones.length > 0) {
    const doneCount = goal.milestones.filter((m) => m.isCompleted).length;
    outcomeProgressPercent = Math.round((doneCount / goal.milestones.length) * 100);
    progressCalculationMethod = `نسبة إتمام المراحل (${doneCount}/${goal.milestones.length})`;
  } else {
    outcomeProgressPercent = goal.status === 'completed' ? 100 : 0;
    progressCalculationMethod = 'تحديد يدوي لحالة الهدف';
  }

  // 7. Execution Progress Calculation (Derived strictly from actual tasks completed & habits consistency)
  const tasksCompleted = linkedTasks.filter((t) => t.status === 'completed').length;
  const tasksPercent = linkedTasks.length > 0 ? Math.round((tasksCompleted / linkedTasks.length) * 100) : 0;

  const past14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return localDateKey(d);
  });
  const habitTotals = linkedHabits.reduce(
    (acc, h) => {
      const c = habitCompliance(h, past14Days);
      return { due: acc.due + c.due, done: acc.done + c.done };
    },
    { due: 0, done: 0 }
  );
  const habitsConsistencyPercent = habitTotals.due > 0 ? Math.round((habitTotals.done / habitTotals.due) * 100) : 0;

  let executionProgressPercent = 0;
  if (linkedTasks.length > 0 && linkedHabits.length > 0) {
    executionProgressPercent = Math.round((tasksPercent + habitsConsistencyPercent) / 2);
  } else if (linkedTasks.length > 0) {
    executionProgressPercent = tasksPercent;
  } else if (linkedHabits.length > 0) {
    executionProgressPercent = habitsConsistencyPercent;
  } else if (goal.milestones && goal.milestones.length > 0) {
    executionProgressPercent = Math.round((goal.milestones.filter((m) => m.isCompleted).length / goal.milestones.length) * 100);
  } else {
    executionProgressPercent = 0;
  }

  // Overall primary progress follows outcome when Key Results exist
  const overallProgressPercent = evaluatedKrs.length > 0
    ? outcomeProgressPercent
    : (goal.milestones && goal.milestones.length > 0 ? outcomeProgressPercent : executionProgressPercent);

  // 8. Milestones metrics
  const milestonesTotal = goal.milestones?.length || 0;
  const milestonesCompleted = goal.milestones?.filter((m) => m.isCompleted).length || 0;
  const milestonesProgressPercent = milestonesTotal > 0
    ? Math.round((milestonesCompleted / milestonesTotal) * 100)
    : 0;

  // 9. Timeline & Schedule Pacing
  let timeElapsedPercent: number | null = null;
  let daysRemaining: number | null = null;
  let isOverdue = false;

  const startDateStr = goal.startDate || localDateKey(new Date(goal.createdAt));
  if (goal.deadline) {
    const startMs = (parseDateKey(startDateStr) ?? new Date(startDateStr)).getTime();
    // The deadline is a calendar day; anchor it to LOCAL midnight so "today" counts as
    // 0 days remaining for the whole local day instead of drifting by the UTC offset.
    const deadlineMs = (parseDateKey(goal.deadline) ?? new Date(goal.deadline)).getTime();
    const nowMs = now.getTime();

    const totalDurationMs = Math.max(1, deadlineMs - startMs);
    const elapsedMs = nowMs - startMs;

    timeElapsedPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));
    // Count whole local days between today and the deadline, ignoring time of day.
    const todayMs = (parseDateKey(localDateKey(now)) ?? now).getTime();
    const diffDays = Math.round((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));
    daysRemaining = diffDays;
    isOverdue = diffDays < 0 && overallProgressPercent < 100;
  }

  // 9. Contribution Timeline Events (Pull recent events from linked items)
  const contributions: ActivityContributionItem[] = [];

  // Completed Tasks contributions
  linkedTasks.forEach((t) => {
    if (t.status === 'completed' && t.completedAt) {
      contributions.push({
        id: 'c-task-' + t.id,
        type: 'task',
        title: t.title,
        date: localDateKey(new Date(t.completedAt)),
        contributionNote: 'إنجاز مهمة تنفيذية مرتبطة بالهدف',
        icon: '✓'
      });
    }
  });

  // Reading Sessions contributions
  linkedHabits.forEach((h) => {
    if (h.readingData?.sessions) {
      h.readingData.sessions.forEach((s) => {
        // If specific books are linked, filter by bookId; otherwise include habit sessions
        if (linkedBookIds.size === 0 || linkedBookIds.has(s.bookId)) {
          contributions.push({
            id: 'c-read-' + s.id,
            type: 'reading',
            title: `قراءة ${s.pagesRead} صفحة في "${s.bookTitle}"`,
            date: s.date,
            contributionNote: `${s.durationMinutes} دقيقة قراءة (${s.speedPagesPerHour || 0} ص/س)`,
            icon: '📖'
          });
        }
      });
    }
  });

  // Workout Sessions contributions
  linkedHabits.forEach((h) => {
    if (h.workoutData?.sessions) {
      h.workoutData.sessions.forEach((s) => {
        contributions.push({
          id: 'c-work-' + s.id,
          type: 'workout',
          title: s.title,
          date: s.date,
          contributionNote: `${s.totalReps || 0} تكرار · ${s.durationMinutes} دقيقة تدريب`,
          icon: '⚡'
        });
      });
    }
  });

  // Drawing Sessions contributions
  linkedHabits.forEach((h) => {
    if (h.drawingData?.pieces) {
      h.drawingData.pieces.forEach((p) => {
        if (linkedArtProjectIds.size === 0 || (p.projectId && linkedArtProjectIds.has(p.projectId))) {
          contributions.push({
            id: 'c-draw-' + p.id,
            type: 'drawing',
            title: p.title,
            date: p.completedDate,
            contributionNote: `${p.durationMinutes} دقيقة رسم (${p.medium})`,
            icon: '🎨'
          });
        }
      });
    }
  });

  // Quran Sessions contributions
  linkedHabits.forEach((h) => {
    if (h.quranData?.sessions) {
      h.quranData.sessions.forEach((s) => {
        contributions.push({
          id: 'c-quran-' + s.id,
          type: 'quran',
          title: `${s.type === 'new_memorization' ? 'حفظ' : 'مراجعة'} سورة ${s.surahName} (الآيات ${s.ayahStart}-${s.ayahEnd})`,
          date: s.date,
          contributionNote: `${s.ayahCount} آيات · ${s.durationMinutes} دقيقة (${s.quality})`,
          icon: '📜'
        });
      });
    }
  });

  // Regular habit completions are real activity too (recent window only, to keep the list light).
  linkedHabits.forEach((h) => {
    (h.completedDates || [])
      .filter((d) => past14Days.includes(d))
      .forEach((d) => {
        contributions.push({
          id: `c-habit-${h.id}-${d}`,
          type: 'habit',
          title: h.name,
          date: d,
          contributionNote: 'إنجاز عادة',
          icon: '🔁'
        });
      });
  });

  // Sort contributions descending by date
  contributions.sort((a, b) => b.date.localeCompare(a.date));

  // 10. Dormancy / Momentum check (Activity in past 7 days)
  const lastActivityDate = contributions[0]?.date || null;
  let isDormant = false;
  if (goal.status === 'active' && overallProgressPercent < 100) {
    if (!lastActivityDate) {
      isDormant = true;
    } else {
      const daysSince = Math.floor((now.getTime() - (parseDateKey(lastActivityDate) ?? new Date(lastActivityDate)).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 7) {
        isDormant = true;
      }
    }
  }

  // 11. Determine Pacing Status
  let pacingStatus: GoalIntelligenceSummary['pacingStatus'] = 'on_track';
  let pacingLabelAr = 'على المسار الصحيح';
  let pacingLabelEn = 'On Track';

  if (overallProgressPercent >= 100 || goal.status === 'completed') {
    pacingStatus = 'completed';
    pacingLabelAr = 'مكتمل بنجاح 🏆';
    pacingLabelEn = 'Completed 🏆';
  } else if (isDormant) {
    pacingStatus = 'dormant';
    pacingLabelAr = 'يحتاج تنشيطاً (ركود ٧ أيام) ⚠️';
    pacingLabelEn = 'Needs Momentum ⚠️';
  } else if (timeElapsedPercent !== null) {
    if (overallProgressPercent >= timeElapsedPercent + 5) {
      pacingStatus = 'ahead';
      pacingLabelAr = 'متقدم على الجدول الزمني 🚀';
      pacingLabelEn = 'Ahead of Schedule 🚀';
    } else if (overallProgressPercent <= timeElapsedPercent - 15) {
      pacingStatus = 'behind';
      pacingLabelAr = 'متأخر عن الخطة الزمنية ⏳';
      pacingLabelEn = 'Behind Schedule ⏳';
    } else {
      pacingStatus = 'on_track';
      pacingLabelAr = 'متوازن مع الخطة الزمنية ✓';
      pacingLabelEn = 'Balanced Pacing ✓';
    }
  } else {
    pacingStatus = 'on_track';
    pacingLabelAr = 'نشط وقيد التنفيذ';
    pacingLabelEn = 'Active & Moving';
  }

  const executionSummary = {
    tasksCompleted,
    tasksTotal: linkedTasks.length,
    tasksPercent,
    habitsConsistencyPercent,
    totalLinkedActivitiesCount: linkedTasks.length + linkedHabits.length + linkedBooks.length + linkedArtProjects.length,
    totalRecordedSessionsCount: contributions.length
  };

  return {
    goalId: goal.id,
    evaluatedKrs,
    outcomeProgressPercent,
    executionProgressPercent,
    overallProgressPercent,
    progressCalculationMethod,
    executionSummary,
    milestonesTotal,
    milestonesCompleted,
    milestonesProgressPercent,
    timeElapsedPercent,
    daysRemaining,
    isOverdue,
    pacingStatus,
    pacingLabelAr,
    pacingLabelEn,
    lastActivityDate,
    isDormant,
    contributions: contributions.slice(0, 20), // Top 20 most recent
    linkedTasksCount: linkedTasks.length,
    linkedHabitsCount: linkedHabits.length,
    linkedBooksCount: linkedBooks.length,
    linkedArtProjectsCount: linkedArtProjects.length
  };
}

