/**
 * Shared vocabulary for the timeline and the commitment map.
 *
 * Both surfaces describe the same domains, so their names, icons and tones live here
 * instead of being duplicated. Icons are existing `NuqtaIcon` names — nothing new was
 * drawn for these features, because a timeline that invents its own visual language
 * stops feeling like part of NUQTA.
 */

import { IconName } from '../components/NuqtaIcon';
import { UniversalHistoryDomain, UniversalHistoryEventType } from '../types';
import { TimelineImportance } from './lifeTimeline';

export interface DomainMeta {
  ar: string;
  en: string;
  icon: IconName;
  /** CSS colour token used for dots, rails and chips. */
  tone: string;
  toneWash: string;
  toneLine: string;
}

const DOMAIN_META: Record<UniversalHistoryDomain, DomainMeta> = {
  tasks: {
    ar: 'المهام',
    en: 'Tasks',
    icon: 'check-square',
    tone: 'var(--tone-success)',
    toneWash: 'var(--tone-success-wash)',
    toneLine: 'var(--tone-success-line)'
  },
  habits: {
    ar: 'العادات',
    en: 'Habits',
    icon: 'repeat',
    tone: 'var(--tone-info)',
    toneWash: 'var(--tone-info-wash)',
    toneLine: 'var(--tone-info-line)'
  },
  quran: {
    ar: 'القرآن',
    en: 'Quran',
    icon: 'mosque',
    tone: 'var(--tone-success)',
    toneWash: 'var(--tone-success-wash)',
    toneLine: 'var(--tone-success-line)'
  },
  reading: {
    ar: 'القراءة',
    en: 'Reading',
    icon: 'book',
    tone: 'var(--tone-purple)',
    toneWash: 'var(--tone-purple-wash)',
    toneLine: 'var(--tone-purple-line)'
  },
  workout: {
    ar: 'التمرين',
    en: 'Workout',
    icon: 'dumbbell',
    tone: 'var(--tone-danger)',
    toneWash: 'var(--tone-danger-wash)',
    toneLine: 'var(--tone-danger-line)'
  },
  drawing: {
    ar: 'الرسم',
    en: 'Art',
    icon: 'palette',
    tone: 'var(--tone-purple)',
    toneWash: 'var(--tone-purple-wash)',
    toneLine: 'var(--tone-purple-line)'
  },
  walking: {
    ar: 'المشي',
    en: 'Walking',
    icon: 'footprints',
    tone: 'var(--tone-info)',
    toneWash: 'var(--tone-info-wash)',
    toneLine: 'var(--tone-info-line)'
  },
  goals: {
    ar: 'الأهداف',
    en: 'Goals',
    icon: 'target',
    tone: 'var(--tone-warning)',
    toneWash: 'var(--tone-warning-wash)',
    toneLine: 'var(--tone-warning-line)'
  },
  projects: {
    ar: 'المشاريع',
    en: 'Projects',
    icon: 'grid',
    tone: 'var(--tone-info)',
    toneWash: 'var(--tone-info-wash)',
    toneLine: 'var(--tone-info-line)'
  },
  focus: {
    ar: 'التركيز',
    en: 'Focus',
    icon: 'timer',
    tone: 'var(--brand-strong)',
    toneWash: 'var(--brand-soft)',
    toneLine: 'var(--brand-soft-border)'
  },
  health: {
    ar: 'الصحة',
    en: 'Health',
    icon: 'activity',
    tone: 'var(--tone-success)',
    toneWash: 'var(--tone-success-wash)',
    toneLine: 'var(--tone-success-line)'
  },
  finance: {
    ar: 'المال',
    en: 'Finance',
    icon: 'wallet',
    tone: 'var(--tone-warning)',
    toneWash: 'var(--tone-warning-wash)',
    toneLine: 'var(--tone-warning-line)'
  },
  journal: {
    ar: 'اليوميات',
    en: 'Journal',
    icon: 'notebook',
    tone: 'var(--tone-purple)',
    toneWash: 'var(--tone-purple-wash)',
    toneLine: 'var(--tone-purple-line)'
  },
  review: {
    ar: 'المراجعة',
    en: 'Review',
    icon: 'compass',
    tone: 'var(--tone-neutral)',
    toneWash: 'var(--surface-chip)',
    toneLine: 'var(--border-subtle)'
  }
};

export function domainMeta(domain: UniversalHistoryDomain): DomainMeta {
  return DOMAIN_META[domain] ?? DOMAIN_META.review;
}

export function domainLabel(domain: UniversalHistoryDomain, isAr: boolean): string {
  const meta = domainMeta(domain);
  return isAr ? meta.ar : meta.en;
}

/** Domains offered in the timeline filter, in a deliberate reading order. */
export const TIMELINE_DOMAINS: readonly UniversalHistoryDomain[] = [
  'tasks',
  'habits',
  'goals',
  'projects',
  'focus',
  'quran',
  'reading',
  'workout',
  'walking',
  'drawing',
  'journal',
  'health',
  'finance',
  'review'
];

export function eventTypeLabel(type: UniversalHistoryEventType, isAr: boolean): string {
  const labels: Record<UniversalHistoryEventType, { ar: string; en: string }> = {
    created: { ar: 'إنشاء', en: 'Created' },
    completed: { ar: 'إنجاز', en: 'Completed' },
    archived: { ar: 'أرشفة', en: 'Archived' },
    restored: { ar: 'استعادة', en: 'Restored' },
    milestone: { ar: 'محطة', en: 'Milestone' },
    session: { ar: 'جلسة', en: 'Session' },
    streak_freeze: { ar: 'تجميد', en: 'Freeze' },
    note: { ar: 'تدوين', en: 'Note' },
    status_change: { ar: 'تغيير حالة', en: 'Status change' }
  };
  const entry = labels[type];
  return entry ? (isAr ? entry.ar : entry.en) : type;
}

/** Event types offered in the filter, omitting bookkeeping the feed hides anyway. */
export const TIMELINE_EVENT_TYPES: readonly UniversalHistoryEventType[] = [
  'completed',
  'milestone',
  'session',
  'note',
  'status_change',
  'streak_freeze'
];

/**
 * How each importance level reads.
 *
 * The visual weight is the message: a milestone gets a filled marker and a real
 * border, routine work gets a hairline. This is what stops a timeline from being a
 * flat wall of identical rows.
 */
export function importanceStyle(importance: TimelineImportance): {
  labelAr: string;
  labelEn: string;
  markerSize: string;
  markerClass: string;
  titleClass: string;
  cardClass: string;
} {
  switch (importance) {
    case 'milestone':
      return {
        labelAr: 'محطة',
        labelEn: 'Milestone',
        markerSize: 'w-2.5 h-2.5',
        markerClass: 'bg-[var(--tone-warning)] ring-2 ring-[var(--tone-warning-wash)]',
        titleClass: 'text-[var(--fs-base)] font-semibold text-[var(--text-primary)]',
        cardClass: 'border-[var(--tone-warning-line)] bg-[var(--tone-warning-wash)]'
      };
    case 'notable':
      return {
        labelAr: 'إنجاز',
        labelEn: 'Notable',
        markerSize: 'w-2 h-2',
        markerClass: 'bg-[var(--brand-strong)]',
        titleClass: 'text-[var(--fs-sm)] font-medium text-[var(--text-primary)]',
        cardClass: 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'
      };
    case 'routine':
      return {
        labelAr: 'روتين',
        labelEn: 'Routine',
        markerSize: 'w-1.5 h-1.5',
        markerClass: 'bg-[var(--text-tertiary)]',
        titleClass: 'text-[var(--fs-sm)] text-[var(--text-secondary)]',
        cardClass: 'border-transparent bg-transparent'
      };
    case 'administrative':
    default:
      return {
        labelAr: 'إداري',
        labelEn: 'Admin',
        markerSize: 'w-1.5 h-1.5',
        markerClass: 'bg-[var(--border-strong)]',
        titleClass: 'text-[var(--fs-xs)] text-[var(--text-tertiary)]',
        cardClass: 'border-transparent bg-transparent'
      };
  }
}

/** Copy for the map's day states. `no_data` is worded as absence, never failure. */
export function commitmentStateLabel(
  state: string,
  isAr: boolean
): { label: string; tone: string } {
  const table: Record<string, { ar: string; en: string; tone: string }> = {
    kept: { ar: 'التزمت', en: 'Kept', tone: 'var(--tone-success)' },
    partial: { ar: 'جزئي', en: 'Partial', tone: 'var(--tone-warning)' },
    missed: { ar: 'فائت', en: 'Missed', tone: 'var(--tone-danger)' },
    rest: { ar: 'راحة', en: 'Rest', tone: 'var(--text-tertiary)' },
    no_data: { ar: 'لا بيانات', en: 'No data', tone: 'var(--text-tertiary)' },
    future: { ar: 'قادم', en: 'Upcoming', tone: 'var(--border-subtle)' }
  };
  const entry = table[state];
  return {
    label: entry ? (isAr ? entry.ar : entry.en) : state,
    tone: entry?.tone ?? 'var(--text-tertiary)'
  };
}
