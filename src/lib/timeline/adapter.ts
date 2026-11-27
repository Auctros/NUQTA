/**
 * Records → temporal items.
 *
 * This is the only place that knows how a NUQTA record becomes something the
 * Timeline can draw. Each module's facts are mapped as they are:
 *
 *   task.scheduledDate + scheduledTime → planned point/range on that day
 *   task.completedAt                   → actual point at that instant
 *   goal.startDate … goal.deadline     → planned range
 *   goal.milestones[]                  → planned milestone, or actual when dated done
 *   habit.completedDates[]             → actual point per recorded occurrence
 *   habit + recurrence                 → planned occurrences, generated on demand
 *   focusSession.completedAt           → actual span ending at that instant
 *   reading/workout/quran sessions     → actual point on the logged day
 *   walking session                    → actual span (it stores startedAt/endedAt)
 *   art project                        → planned range from startedDate
 *   journal entry                      → actual point on the entry's day
 *
 * Anything without a usable date lands in `unscheduled`, never on a guessed day.
 */
import type {
  Task,
  Habit,
  Goal,
  FocusSession,
  JournalEntry,
  HealthMetric
} from '../../types';
import { isDateKey, localDateKey, localDayFrom, parseDateKey } from '../dateKey';
import { isHabitDueOn } from '../habitSchedule';
import { occurrencesInRange } from '../recurrence';
import { isTaskPending } from '../taskStatus';
import type { TimelineDataset, TimelineDomain, TimelineItem, TimelineLane, UnscheduledItem } from './types';

export interface TimelineSources {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  focusSessions: FocusSession[];
  journalEntries: JournalEntry[];
  healthMetrics: Record<string, HealthMetric>;
}

export interface TimelineBuildOptions {
  isAr: boolean;
  /**
   * The window recurring series are expanded into. Only this window is
   * materialised, so a daily habit does not generate a decade of occurrences.
   */
  recurrenceFrom: string;
  recurrenceTo: string;
  /** Hard cap per habit, so a dense window cannot explode the canvas. */
  maxOccurrencesPerHabit?: number;
  /**
   * Whether to materialise *expected* habit occurrences.
   *
   * At month zoom and coarser a single day is a couple of pixels, so one dot per
   * expected day is both illegible and thousands of DOM nodes. Expected
   * occurrences are therefore only generated at hour/day/week scale, where the
   * user can actually act on them. Recorded completions are always shown —
   * history is never suppressed.
   */
  includeExpectedHabits?: boolean;
}

/** Local midnight for a "YYYY-MM-DD" day key. */
function dayStart(key: string): Date | null {
  return parseDateKey(key);
}

/** "HH:mm" on a given day key, as a local instant. Null when either is unusable. */
function instantOn(key: string, time?: string): Date | null {
  const base = parseDateKey(key);
  if (!base) return null;
  if (!time) return base;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return base;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
}

const addMinutes = (d: Date, minutes: number): Date => new Date(d.getTime() + minutes * 60_000);

/** End of a day-granular range: the last instant of `key`, so ranges stay inclusive. */
function dayEnd(key: string): Date | null {
  const base = parseDateKey(key);
  if (!base) return null;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
}

export function buildTimelineDataset(sources: TimelineSources, options: TimelineBuildOptions): TimelineDataset {
  const { isAr } = options;
  const items: TimelineItem[] = [];
  const unscheduled: UnscheduledItem[] = [];
  const maxPerHabit = options.maxOccurrencesPerHabit ?? 60;

  const L = {
    task: isAr ? 'مهمة' : 'Task',
    due: isAr ? 'مستحقة' : 'Due',
    completed: isAr ? 'مكتملة' : 'Completed',
    goal: isAr ? 'هدف' : 'Goal',
    milestone: isAr ? 'محطة' : 'Milestone',
    habit: isAr ? 'عادة' : 'Habit',
    expected: isAr ? 'متوقعة' : 'Expected',
    done: isAr ? 'منجزة' : 'Done',
    focus: isAr ? 'جلسة تركيز' : 'Focus session',
    minutes: isAr ? 'دقيقة' : 'min',
    journal: isAr ? 'يومية' : 'Journal entry',
    reading: isAr ? 'جلسة قراءة' : 'Reading session',
    pages: isAr ? 'صفحة' : 'pages',
    workout: isAr ? 'تمرين' : 'Workout',
    quran: isAr ? 'جلسة قرآن' : 'Quran session',
    ayahs: isAr ? 'آية' : 'ayahs',
    walk: isAr ? 'مشية' : 'Walk',
    art: isAr ? 'عمل فني' : 'Artwork',
    project: isAr ? 'مشروع فني' : 'Art project',
    unknownChannel: isAr ? 'غير معروف' : 'Unknown'
  };

  const push = (item: TimelineItem) => items.push(item);
  const backlog = (item: UnscheduledItem) => unscheduled.push(item);

  // ── Tasks ────────────────────────────────────────────────────────────────
  // A task yields up to two independent facts: when it was planned for, and when
  // it was actually completed. They are separate items because they are separate
  // truths, and the completed one is never inferred from the planned one.
  for (const t of sources.tasks) {
    const hasValidDate = Boolean(t.scheduledDate && isDateKey(t.scheduledDate));

    if (hasValidDate) {
      const start = instantOn(t.scheduledDate!, t.scheduledTime);
      if (start) {
        const pending = isTaskPending(t);
        const estimated = t.estimatedMinutes && t.estimatedMinutes > 0 ? t.estimatedMinutes : undefined;
        // An estimate is a plan for how long it will take, so it may shape the
        // planned bar. It is never used to describe what actually happened.
        const end = estimated ? addMinutes(start, estimated) : undefined;
        push({
          id: `tasks:${t.id}:planned`,
          domain: 'tasks',
          reality: 'planned',
          kind: end ? 'span' : 'point',
          title: t.title,
          subtitle: t.scheduledTime
            ? `${L.task} · ${t.scheduledTime}`
            : L.task,
          start,
          end,
          allDay: !t.scheduledTime,
          entityId: t.id,
          source: 'tasks',
          status: pending ? L.due : L.completed,
          durationMinutes: estimated,
          facts: [
            ...(t.priority ? [{ label: isAr ? 'الأولوية' : 'Priority', value: String(t.priority) }] : []),
            ...(t.tags?.length ? [{ label: isAr ? 'الوسوم' : 'Tags', value: t.tags.join(', ') }] : [])
          ]
        });
      }
    } else if (isTaskPending(t)) {
      // Only open tasks are worth surfacing as backlog; a completed task with no
      // date already has its own completion item below.
      backlog({
        id: `tasks:${t.id}:backlog`,
        domain: 'tasks',
        title: t.title,
        subtitle: L.task,
        entityId: t.id,
        reason: t.scheduledDate ? 'invalid-date' : 'no-date'
      });
    }

    if (t.completedAt) {
      const when = new Date(t.completedAt);
      if (!isNaN(when.getTime())) {
        push({
          id: `tasks:${t.id}:completed`,
          domain: 'tasks',
          reality: 'actual',
          kind: 'point',
          title: t.title,
          subtitle: `${L.task} · ${L.completed}`,
          start: when,
          allDay: false,
          entityId: t.id,
          source: 'tasks',
          status: L.completed
        });
      }
    }
  }

  // ── Goals ────────────────────────────────────────────────────────────────
  for (const g of sources.goals) {
    const from = g.startDate && isDateKey(g.startDate) ? g.startDate : null;
    const to = g.deadline && isDateKey(g.deadline) ? g.deadline : null;

    if (from || to) {
      const startKey = from ?? to!;
      const endKey = to ?? from!;
      const start = dayStart(startKey);
      const end = dayEnd(endKey);
      if (start && end) {
        const done = g.keyResults.filter((k) => k.targetValue > 0 && k.currentValue >= k.targetValue).length;
        const progress = g.keyResults.length ? done / g.keyResults.length : undefined;
        push({
          id: `goals:${g.id}:range`,
          domain: 'goals',
          reality: 'planned',
          kind: 'range',
          title: g.title,
          subtitle: L.goal,
          start,
          end,
          allDay: true,
          entityId: g.id,
          source: 'goals',
          status: g.status,
          progress,
          facts: [
            { label: isAr ? 'الحالة' : 'Status', value: g.status },
            ...(g.keyResults.length
              ? [{ label: isAr ? 'النتائج' : 'Key results', value: `${done}/${g.keyResults.length}` }]
              : [])
          ]
        });
      }
    }

    for (const m of g.milestones ?? []) {
      const key = m.completedDate ?? m.targetDate;
      if (!key || !isDateKey(key)) continue;
      const when = m.isCompleted && m.completedDate ? dayStart(m.completedDate) : dayStart(m.targetDate ?? key);
      if (!when) continue;
      push({
        id: `goals:${g.id}:milestone:${m.id}`,
        domain: 'goals',
        // A dated milestone is a real achievement; an undated-done one is still a
        // plan. The record decides, not the label.
        reality: m.isCompleted && Boolean(m.completedDate) ? 'actual' : 'planned',
        kind: 'milestone',
        title: m.title,
        subtitle: `${L.goal} · ${L.milestone}`,
        start: when,
        allDay: true,
        entityId: g.id,
        source: 'goals',
        status: m.isCompleted ? L.completed : undefined
      });
    }
  }

  // ── Habits ───────────────────────────────────────────────────────────────
  // Recorded occurrences are actual. Expected occurrences are planned and are
  // generated only inside the requested window, capped per habit.
  for (const h of sources.habits) {
    const doneSet = new Set(h.completedDates ?? []);

    for (const key of h.completedDates ?? []) {
      if (!isDateKey(key)) continue;
      const when = dayStart(key);
      if (!when) continue;
      push({
        id: `habits:${h.id}:done:${key}`,
        domain: 'habits',
        reality: 'actual',
        kind: 'point',
        title: h.name,
        subtitle: `${L.habit} · ${L.done}`,
        start: when,
        allDay: true,
        entityId: h.id,
        source: 'habits',
        status: L.done
      });
    }

    if (h.isArchived || h.status === 'archived') continue;
    if (options.includeExpectedHabits === false) continue;

    const expected = occurrencesInRange(
      h.recurrence ?? fallbackRule(h),
      h.createdAt ? localDateKey(new Date(h.createdAt)) : options.recurrenceFrom,
      options.recurrenceFrom,
      options.recurrenceTo,
      maxPerHabit
    );

    for (const key of expected) {
      if (doneSet.has(key)) continue;
      const when = dayStart(key);
      if (!when) continue;
      push({
        id: `habits:${h.id}:expected:${key}`,
        domain: 'habits',
        reality: 'planned',
        kind: 'point',
        title: h.name,
        subtitle: `${L.habit} · ${L.expected}`,
        start: when,
        allDay: true,
        entityId: h.id,
        source: 'habits',
        status: L.expected
      });
    }
  }

  // ── Focus sessions ───────────────────────────────────────────────────────
  for (const f of sources.focusSessions) {
    const end = new Date(f.completedAt);
    if (isNaN(end.getTime())) continue;
    const minutes = f.durationMinutes > 0 ? f.durationMinutes : undefined;
    push({
      id: `focus:${f.id}:session`,
      domain: 'focus',
      reality: 'actual',
      kind: minutes ? 'span' : 'point',
      title: f.taskTitle || L.focus,
      subtitle: L.focus,
      start: minutes ? addMinutes(end, -minutes) : end,
      end: minutes ? end : undefined,
      allDay: false,
      entityId: f.id,
      source: 'focus',
      durationMinutes: minutes,
      facts: [
        { label: isAr ? 'المدة' : 'Duration', value: `${f.durationMinutes} ${L.minutes}` },
        { label: isAr ? 'الإنتاجية' : 'Productivity', value: `${f.productivityScore}/5` }
      ]
    });
  }

  // ── Studio sessions, journal, and health ─────────────────────────────────
  for (const h of sources.habits) {
    for (const s of h.quranData?.sessions ?? []) {
      const when = dayStart(s.date);
      if (!when) continue;
      push({
        id: `quran:${s.id}:session`,
        domain: 'quran',
        reality: 'actual',
        kind: 'point',
        title: s.surahName,
        subtitle: L.quran,
        start: when,
        allDay: true,
        entityId: s.id,
        source: 'quran',
        durationMinutes: s.durationMinutes,
        facts: [
          { label: isAr ? 'الآيات' : 'Ayahs', value: `${s.ayahCount} ${L.ayahs}` },
          { label: isAr ? 'المدة' : 'Duration', value: `${s.durationMinutes} ${L.minutes}` }
        ]
      });
    }

    for (const s of h.readingData?.sessions ?? []) {
      const when = dayStart(s.date);
      if (!when) continue;
      push({
        id: `reading:${s.id}:session`,
        domain: 'reading',
        reality: 'actual',
        kind: 'point',
        title: s.bookTitle,
        subtitle: L.reading,
        start: when,
        allDay: true,
        entityId: s.id,
        source: 'reading',
        durationMinutes: s.durationMinutes,
        facts: [
          { label: isAr ? 'الصفحات' : 'Pages', value: `${s.pagesRead} ${L.pages}` },
          { label: isAr ? 'المدة' : 'Duration', value: `${s.durationMinutes} ${L.minutes}` }
        ]
      });
    }

    for (const s of h.workoutData?.sessions ?? []) {
      const when = dayStart(s.date);
      if (!when) continue;
      push({
        id: `workout:${s.id}:session`,
        domain: 'workout',
        reality: 'actual',
        kind: 'point',
        title: s.title,
        subtitle: L.workout,
        start: when,
        allDay: true,
        entityId: s.id,
        source: 'workout',
        durationMinutes: s.durationMinutes,
        facts: [
          { label: isAr ? 'المدة' : 'Duration', value: `${s.durationMinutes} ${L.minutes}` },
          { label: isAr ? 'الشدة' : 'Intensity', value: `${s.intensityRating}/5` }
        ]
      });
    }

    // Walking is the one studio that records a real start and end.
    for (const s of h.walkingData?.sessions ?? []) {
      const start = new Date(s.startedAt);
      const end = new Date(s.endedAt);
      if (isNaN(start.getTime())) continue;
      const hasEnd = !isNaN(end.getTime()) && end.getTime() >= start.getTime();
      push({
        id: `walking:${s.id}:session`,
        domain: 'walking',
        reality: 'actual',
        kind: hasEnd ? 'span' : 'point',
        title: L.walk,
        subtitle: L.walk,
        start,
        end: hasEnd ? end : undefined,
        allDay: false,
        entityId: s.id,
        source: 'walking',
        durationMinutes: Math.round(s.durationSeconds / 60),
        facts: [
          { label: isAr ? 'المدة' : 'Duration', value: `${Math.round(s.durationSeconds / 60)} ${L.minutes}` },
          ...(s.distanceKm ? [{ label: isAr ? 'المسافة' : 'Distance', value: `${s.distanceKm} km` }] : [])
        ]
      });
    }

    for (const p of h.drawingData?.projects ?? []) {
      const from = p.startedDate && isDateKey(p.startedDate) ? p.startedDate : null;
      const to = p.completedDate && isDateKey(p.completedDate) ? p.completedDate : null;
      if (!from && !to) continue;
      const start = dayStart(from ?? to!);
      const end = dayEnd(to ?? from!);
      if (!start || !end) continue;
      push({
        id: `drawing:${p.id}:project`,
        domain: 'drawing',
        reality: 'planned',
        kind: 'range',
        title: p.title,
        subtitle: L.project,
        start,
        end,
        allDay: true,
        entityId: p.id,
        source: 'drawing',
        status: p.stage
      });
    }

    for (const piece of h.drawingData?.pieces ?? []) {
      const when = dayStart(piece.completedDate);
      if (!when) continue;
      push({
        id: `drawing:${piece.id}:piece`,
        domain: 'drawing',
        reality: 'actual',
        kind: 'point',
        title: piece.title,
        subtitle: L.art,
        start: when,
        allDay: true,
        entityId: piece.id,
        source: 'drawing',
        durationMinutes: piece.durationMinutes
      });
    }
  }

  for (const e of sources.journalEntries) {
    const when = dayStart(e.date);
    if (!when) continue;
    push({
      id: `journal:${e.id}:entry`,
      domain: 'journal',
      reality: 'actual',
      kind: 'point',
      title: L.journal,
      subtitle: e.date,
      start: when,
      allDay: true,
      entityId: e.id,
      source: 'journal',
      facts: [{ label: isAr ? 'المزاج' : 'Mood', value: `${e.mood}/5` }]
    });
  }

  for (const [key, metric] of Object.entries(sources.healthMetrics ?? {})) {
    if (!metric) continue;
    const when = dayStart(key);
    if (!when) continue;
    const logged =
      metric.sleepHours > 0 ||
      metric.hydrationMl > 0 ||
      metric.moodRating > 0 ||
      metric.workoutLogged ||
      typeof metric.weightKg === 'number';
    if (!logged) continue;
    push({
      id: `health:${key}:day`,
      domain: 'health',
      reality: 'actual',
      kind: 'point',
      title: isAr ? 'سجل صحي' : 'Health log',
      subtitle: key,
      start: when,
      allDay: true,
      entityId: key,
      source: 'health'
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());

  return {
    items,
    lanes: buildLanes(items, isAr),
    unscheduled,
    bounds: computeBounds(items)
  };
}

/** Habits without a rich rule still need one for occurrence generation. */
function fallbackRule(habit: Habit) {
  switch (habit.frequency) {
    case 'weekdays':
      return { freq: 'weekly' as const, days: [6, 0, 1, 2, 3, 4] };
    case 'custom':
      return { freq: 'weekly' as const, days: habit.customDays ?? [] };
    case 'daily':
    default:
      return { freq: 'daily' as const };
  }
}

const LANE_ORDER: TimelineDomain[] = [
  'goals',
  'tasks',
  'habits',
  'focus',
  'quran',
  'reading',
  'workout',
  'walking',
  'drawing',
  'journal',
  'health'
];

const LANE_LABELS: Record<TimelineDomain, { ar: string; en: string }> = {
  goals: { ar: 'الأهداف والمحطات', en: 'Goals & milestones' },
  tasks: { ar: 'المهام', en: 'Tasks' },
  habits: { ar: 'العادات', en: 'Habits' },
  focus: { ar: 'جلسات التركيز', en: 'Focus sessions' },
  quran: { ar: 'القرآن', en: 'Quran' },
  reading: { ar: 'القراءة', en: 'Reading' },
  workout: { ar: 'اللياقة', en: 'Workout' },
  walking: { ar: 'المشي', en: 'Walking' },
  drawing: { ar: 'الفن', en: 'Art' },
  journal: { ar: 'اليوميات', en: 'Journal' },
  health: { ar: 'الصحة', en: 'Health' }
};

export function laneLabel(domain: TimelineDomain, isAr: boolean): string {
  const label = LANE_LABELS[domain];
  return isAr ? label.ar : label.en;
}

function buildLanes(items: TimelineItem[], isAr: boolean): TimelineLane[] {
  const byDomain = new Map<TimelineDomain, TimelineItem[]>();
  for (const item of items) {
    const bucket = byDomain.get(item.domain);
    if (bucket) bucket.push(item);
    else byDomain.set(item.domain, [item]);
  }
  return LANE_ORDER.filter((d) => byDomain.has(d)).map((domain) => ({
    id: `lane-${domain}`,
    domain,
    label: laneLabel(domain, isAr),
    items: byDomain.get(domain)!
  }));
}

function computeBounds(items: TimelineItem[]): { start: Date; end: Date } | null {
  if (!items.length) return null;
  let start = items[0].start.getTime();
  let end = items[0].end?.getTime() ?? items[0].start.getTime();
  for (const item of items) {
    const s = item.start.getTime();
    const e = item.end?.getTime() ?? item.start.getTime();
    if (s < start) start = s;
    if (e > end) end = e;
  }
  return { start: new Date(start), end: new Date(end) };
}
