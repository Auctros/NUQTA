/**
 * View presets and display preferences.
 *
 * A preset is a *configuration over the same records* — a zoom, a window, a set of
 * lanes and a reality filter. It is not a second data model, and switching preset
 * never re-queries anything: the adapter output is identical, only the projection
 * changes.
 *
 * Preferences live in `nuqta.ui.workflow.timeline`, the UI namespace the storage
 * engine deliberately ignores: a lane visibility choice is a working position, not
 * a record, and must never appear in a backup or block mirror recovery.
 */
import { readWorkflowValue, writeWorkflowValue } from '../usePersistedWorkflowState';
import type { TimelineDomain } from './types';
import type { ZoomLevel } from './scale';

const SCOPE = 'timeline';

export type TimelinePresetId = 'overview' | 'planning' | 'history' | 'detail';

export interface TimelinePreset {
  id: TimelinePresetId;
  labelAr: string;
  labelEn: string;
  zoom: ZoomLevel;
  /** Which reality to show. `both` keeps planned and actual side by side. */
  reality: 'both' | 'planned' | 'actual';
  /** Domains to show; null means "everything with data". */
  domains: TimelineDomain[] | null;
  hintAr: string;
  hintEn: string;
}

export const TIMELINE_PRESETS: readonly TimelinePreset[] = [
  {
    id: 'overview',
    labelAr: 'نظرة الحياة',
    labelEn: 'Life overview',
    zoom: 'quarter',
    reality: 'both',
    domains: null,
    hintAr: 'كل الوحدات عبر الأشهر، على مقياس واحد',
    hintEn: 'Every module across months, on one scale'
  },
  {
    id: 'planning',
    labelAr: 'التخطيط',
    labelEn: 'Planning',
    zoom: 'week',
    reality: 'planned',
    domains: ['tasks', 'habits', 'goals', 'focus'],
    hintAr: 'ما هو مخطَّط ومستحق، دون تاريخ فعلي',
    hintEn: 'What is planned and due, without recorded history'
  },
  {
    id: 'history',
    labelAr: 'سجل النشاط',
    labelEn: 'Activity history',
    zoom: 'month',
    reality: 'actual',
    domains: null,
    hintAr: 'ما حدث فعلًا: الجلسات والإنجازات',
    hintEn: 'What actually happened: sessions and completions'
  },
  {
    id: 'detail',
    labelAr: 'يومي / أسبوعي',
    labelEn: 'Daily / weekly',
    zoom: 'day',
    reality: 'both',
    domains: null,
    hintAr: 'تفصيل بالساعة للخطة والنشاط',
    hintEn: 'Hour-level detail of plan and activity'
  }
];

export function presetById(id: TimelinePresetId): TimelinePreset {
  return TIMELINE_PRESETS.find((p) => p.id === id) ?? TIMELINE_PRESETS[0];
}

/** Every domain the timeline can draw, in lane order. */
export const ALL_TIMELINE_DOMAINS: readonly TimelineDomain[] = [
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

/**
 * The lanes a preset starts with, expressed as hidden domains.
 *
 * A preset is a *starting position*, not a second visibility rule. Collapsing it to
 * `hiddenDomains` at the moment it is applied keeps one source of truth for what is
 * on screen — otherwise a lane the preset excludes could never be re-enabled from
 * the lane panel, because the preset would keep overriding the toggle.
 */
export function hiddenDomainsForPreset(preset: TimelinePreset): TimelineDomain[] {
  if (!preset.domains) return [];
  return ALL_TIMELINE_DOMAINS.filter((d) => !preset.domains!.includes(d));
}

export interface TimelinePrefs {
  preset: TimelinePresetId;
  /** Domains the user explicitly hid. Empty means "no hidden lanes". */
  hiddenDomains: TimelineDomain[];
  showUnscheduled: boolean;
}

const DEFAULT_PREFS: TimelinePrefs = { preset: 'overview', hiddenDomains: [], showUnscheduled: true };

const DOMAINS: TimelineDomain[] = [
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

const PRESET_IDS = TIMELINE_PRESETS.map((p) => p.id);

function isPrefs(value: unknown): value is TimelinePrefs {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<TimelinePrefs>;
  return (
    typeof v.preset === 'string' &&
    PRESET_IDS.includes(v.preset as TimelinePresetId) &&
    Array.isArray(v.hiddenDomains) &&
    v.hiddenDomains.every((d) => DOMAINS.includes(d as TimelineDomain)) &&
    typeof v.showUnscheduled === 'boolean'
  );
}

export function readTimelinePrefs(): TimelinePrefs {
  return readWorkflowValue(SCOPE, 'prefs', DEFAULT_PREFS, isPrefs);
}

export function writeTimelinePrefs(prefs: TimelinePrefs): void {
  writeWorkflowValue(SCOPE, 'prefs', prefs);
}
