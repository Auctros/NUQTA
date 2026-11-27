/**
 * The Timeline Workspace's temporal model.
 *
 * NUQTA's modules own their records; the Timeline never does. Everything here is a
 * *projection* of an existing record onto a time axis, carrying the owning record's
 * id so an edit can be routed back to the store action that owns it.
 *
 * The one rule this file exists to enforce: planning and history are different
 * facts and must never be collapsed. A task's `scheduledDate` is when the user
 * intended to do it; `completedAt` is when they did. A habit's `completedDates` are
 * recorded occurrences, not a predicted series. So every item declares which of the
 * two it is, and an item can never be both.
 */

/** Where an item sits on the axis. */
export type TimelineItemKind =
  | 'point' // a moment: a completion, a session start
  | 'span' // a real start→end with a measurable duration
  | 'range' // a whole-day span: a goal, a project, a multi-day intention
  | 'milestone'; // a single significant day

/** Planned (intended) vs actual (recorded). Never both. */
export type TimelineReality = 'planned' | 'actual';

export type TimelineDomain =
  | 'tasks'
  | 'habits'
  | 'goals'
  | 'projects'
  | 'focus'
  | 'quran'
  | 'reading'
  | 'workout'
  | 'walking'
  | 'drawing'
  | 'journal'
  | 'health';

export interface TimelineItem {
  /** Stable across re-derivations: `<domain>:<entityId>:<discriminator>`. */
  id: string;
  domain: TimelineDomain;
  reality: TimelineReality;
  kind: TimelineItemKind;
  title: string;
  subtitle?: string;

  /** Instant, or local midnight for day-granular records. */
  start: Date;
  /**
   * Only present when the record genuinely has an end. A task with a due date has
   * no end, and the Timeline must not invent one.
   */
  end?: Date;
  /**
   * True when `start`/`end` are calendar days rather than instants. Day-granular
   * items are drawn from midnight to midnight and their labels never show a clock
   * time, because the record does not carry one.
   */
  allDay: boolean;

  /** Owning record, so interactions can be routed back to the module that owns it. */
  entityId: string;
  /** The module to open for this item. */
  source: TimelineDomain;

  /** Short factual qualifier, e.g. "Completed", "Due", "3 of 5 ayahs". */
  status?: string;
  /** Genuine recorded duration in minutes, when the record states one. */
  durationMinutes?: number;
  /** 0..1 progress, only when the record itself tracks progress. */
  progress?: number;
  /** Extra facts for the inspector, in display order. */
  facts?: { label: string; value: string }[];
}

/**
 * A record that cannot be placed on the axis. Kept, never dropped: a task with no
 * date is still a real commitment, it simply has no position yet.
 */
export interface UnscheduledItem {
  id: string;
  domain: TimelineDomain;
  title: string;
  subtitle?: string;
  entityId: string;
  /** Why it has no position, so the tray can explain itself. */
  reason: 'no-date' | 'invalid-date';
}

/** One lane: a labelled row of the canvas. */
export interface TimelineLane {
  id: string;
  domain: TimelineDomain;
  label: string;
  items: TimelineItem[];
}

export interface TimelineDataset {
  items: TimelineItem[];
  lanes: TimelineLane[];
  unscheduled: UnscheduledItem[];
  /** Widest bounds actually present, or null when nothing is dated. */
  bounds: { start: Date; end: Date } | null;
}
