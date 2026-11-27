import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNuqtaStore } from '../../store/nuqtaStore';
import { NuqtaIcon, IconName } from '../NuqtaIcon';
import { Badge, Button, EmptyState, IconButton, Input, NuqtaDatePicker } from '../ui';
import { localDateKey, parseDateKey } from '../../lib/dateKey';
import { domainMeta } from '../../lib/historyPresentation';
import { buildTimelineDataset } from '../../lib/timeline/adapter';
import { layoutLane } from '../../lib/timeline/layout';
import {
  buildRuler,
  floorToDay,
  PX_PER_DAY,
  snapToDay,
  snapToQuarterHour,
  windowForZoom,
  ZOOM_LEVELS,
  zoomLabel,
  type ZoomLevel
} from '../../lib/timeline/scale';
import {
  TIMELINE_PRESETS,
  hiddenDomainsForPreset,
  presetById,
  readTimelinePrefs,
  writeTimelinePrefs,
  type TimelinePresetId
} from '../../lib/timeline/presets';
import { applyTimelineEdit, editCapability, type EditableAxis } from '../../lib/timeline/edit';
import type { TimelineDomain, TimelineItem } from '../../lib/timeline/types';

const LANE_H = 74;
const ROW_H = 26;
const RAIL_W = 208;
const DRAG_THRESHOLD_PX = 4;

type DragMode = EditableAxis;

interface DragState {
  item: TimelineItem;
  mode: DragMode;
  startX: number;
  deltaPx: number;
  active: boolean;
}

const iconForDomain = (domain: TimelineDomain): IconName => domainMeta(domain).icon as IconName;

const NAV_FOR_DOMAIN: Record<
  TimelineDomain,
  'tasks' | 'habits' | 'goals' | 'projects' | 'focus' | 'quran' | 'reading' | 'workout' | 'walking' | 'drawing' | 'journal' | 'health'
> = {
  tasks: 'tasks',
  habits: 'habits',
  goals: 'goals',
  projects: 'projects',
  focus: 'focus',
  quran: 'quran',
  reading: 'reading',
  workout: 'workout',
  walking: 'walking',
  drawing: 'drawing',
  journal: 'journal',
  health: 'health'
};

export const TimelineWorkspace: React.FC = () => {
  const tasks = useNuqtaStore((s) => s.tasks);
  const habits = useNuqtaStore((s) => s.habits);
  const goals = useNuqtaStore((s) => s.goals);
  const projects = useNuqtaStore((s) => s.projects);
  const focusSessions = useNuqtaStore((s) => s.focusSessions);
  const journalEntries = useNuqtaStore((s) => s.journalEntries);
  const healthMetrics = useNuqtaStore((s) => s.healthMetrics);
  const profile = useNuqtaStore((s) => s.profile);
  const updateTask = useNuqtaStore((s) => s.updateTask);
  const updateGoal = useNuqtaStore((s) => s.updateGoal);
  const addOrUpdateArtProject = useNuqtaStore((s) => s.addOrUpdateArtProject);
  const setActiveNavTab = useNuqtaStore((s) => s.setActiveNavTab);
  const requestFocus = useNuqtaStore((s) => s.requestFocus);

  const isAr = profile.language === 'ar';

  const [prefs, setPrefs] = useState(() => readTimelinePrefs());
  const [zoom, setZoom] = useState<ZoomLevel>(() => presetById(readTimelinePrefs().preset).zoom);
  const [anchor, setAnchor] = useState<Date>(() => floorToDay(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [lanesOpen, setLanesOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [now, setNow] = useState(() => new Date());

  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * The live drag, mirrored in a ref.
   *
   * The pointer listeners are attached once per gesture. Reading the gesture from
   * state inside them would either re-attach them on every pointer move (dropping
   * events mid-drag) or capture a stale closure; the ref is what keeps a single
   * listener pair correct for the whole gesture.
   */
  const dragRef = useRef<DragState | null>(null);

  const preset = presetById(prefs.preset);

  useEffect(() => {
    writeTimelinePrefs(prefs);
  }, [prefs]);

  // Only the visible window is materialised for recurring series, so a daily habit
  // never generates a decade of occurrences.
  const viewWindow = useMemo(() => windowForZoom(anchor, zoom), [anchor, zoom]);

  const dataset = useMemo(
    () =>
      buildTimelineDataset(
        { tasks, habits, goals, projects, focusSessions, journalEntries, healthMetrics },
        {
          isAr,
          recurrenceFrom: localDateKey(viewWindow.from),
          recurrenceTo: localDateKey(viewWindow.to),
          // One dot per expected day is illegible once a day is a few pixels wide.
          includeExpectedHabits: zoom === 'hour' || zoom === 'day' || zoom === 'week'
        }
      ),
    [tasks, habits, goals, projects, focusSessions, journalEntries, healthMetrics, isAr, viewWindow, zoom]
  );

  // `hiddenDomains` is the only visibility rule. The preset seeds it (see
  // `applyPreset`), so toggling a lane off a preset actually sticks.
  const isDomainVisible = useCallback(
    (domain: TimelineDomain) => !prefs.hiddenDomains.includes(domain),
    [prefs.hiddenDomains]
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.items.filter((item) => {
      if (!isDomainVisible(item.domain)) return false;
      if (preset.reality !== 'both' && item.reality !== preset.reality) return false;
      if (q && !`${item.title} ${item.subtitle ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dataset.items, isDomainVisible, preset.reality, search]);

  const lanes = useMemo(() => {
    const byDomain = new Map<TimelineDomain, TimelineItem[]>();
    for (const item of items) {
      const bucket = byDomain.get(item.domain);
      if (bucket) bucket.push(item);
      else byDomain.set(item.domain, [item]);
    }
    return dataset.lanes
      .filter((lane) => byDomain.has(lane.domain))
      .map((lane) => ({ ...lane, items: byDomain.get(lane.domain)! }));
  }, [dataset.lanes, items]);

  const pxPerDay = PX_PER_DAY[zoom];
  const windowDays = Math.max(1, (viewWindow.to.getTime() - viewWindow.from.getTime()) / 86_400_000);
  const canvasWidth = windowDays * pxPerDay;
  const ruler = useMemo(() => buildRuler(viewWindow.from, viewWindow.to, zoom, isAr), [viewWindow, zoom, isAr]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const shiftWindow = useCallback(
    (dir: -1 | 1) => {
      setAnchor((prev) => {
        const days = Math.max(1, Math.round(windowDays * 0.6));
        const next = new Date(prev);
        next.setDate(next.getDate() + dir * days);
        return next;
      });
    },
    [windowDays]
  );

  const goToday = useCallback(() => setAnchor(floorToDay(new Date())), []);

  const jumpToDate = useCallback((value: string) => {
    const parsed = parseDateKey(value);
    if (parsed) setAnchor(floorToDay(parsed));
  }, []);

  const changeZoom = useCallback((next: ZoomLevel) => setZoom(next), []);

  const applyPreset = useCallback((id: TimelinePresetId) => {
    const next = presetById(id);
    setPrefs((p) => ({ ...p, preset: id, hiddenDomains: hiddenDomainsForPreset(next) }));
    setZoom(next.zoom);
  }, []);

  /** Fit the visible window around everything that is currently shown. */
  const fitToContent = useCallback(() => {
    if (!items.length) {
      goToday();
      return;
    }
    let start = items[0].start.getTime();
    let end = items[0].end?.getTime() ?? items[0].start.getTime();
    for (const item of items) {
      const s = item.start.getTime();
      const e = item.end?.getTime() ?? s;
      if (s < start) start = s;
      if (e > end) end = e;
    }
    const mid = new Date((start + end) / 2);
    const spanDays = Math.max(1, (end - start) / 86_400_000);
    // ZOOM_LEVELS runs finest -> coarsest, so the first level whose natural window
    // still contains the content is the tightest one that fits.
    const fit = ZOOM_LEVELS.find((level) => {
      const { from, to } = windowForZoom(mid, level);
      return (to.getTime() - from.getTime()) / 86_400_000 >= spanDays;
    });
    setZoom(fit ?? 'multi-year');
    setAnchor(floorToDay(mid));
  }, [items, goToday]);

  const toggleDomain = useCallback((domain: TimelineDomain) => {
    setPrefs((p) => ({
      ...p,
      hiddenDomains: p.hiddenDomains.includes(domain)
        ? p.hiddenDomains.filter((d) => d !== domain)
        : [...p.hiddenDomains, domain]
    }));
  }, []);

  const openSource = useCallback(
    (item: TimelineItem) => {
      setActiveNavTab(NAV_FOR_DOMAIN[item.domain]);
      // Hand the entity to the owning module's existing focus channel.
      requestFocus(item.domain, item.entityId);
    },
    [setActiveNavTab, requestFocus]
  );

  // ── Drag / resize ────────────────────────────────────────────────────────
  // Pointer capture is deliberately NOT taken: the move/up listeners live on the
  // window so a drag that leaves the item (or the canvas) still tracks correctly.
  const beginDrag = (e: React.PointerEvent, item: TimelineItem, mode: DragMode) => {
    const cap = editCapability(item);
    const allowed = mode === 'move' ? cap.move : mode === 'resize-start' ? cap.resizeStart : cap.resizeEnd;
    if (!allowed) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(item.id);
    const next: DragState = { item, mode, startX: e.clientX, deltaPx: 0, active: false };
    dragRef.current = next;
    setDrag(next);
  };

  // Attached once for the whole gesture: the handlers read the live gesture from
  // `dragRef`, so they never need to be re-registered while the pointer moves.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const deltaPx = e.clientX - current.startX;
      const next: DragState = {
        ...current,
        deltaPx,
        active: current.active || Math.abs(deltaPx) >= DRAG_THRESHOLD_PX
      };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      dragRef.current = null;
      setDrag(null);

      const deltaPx = e.clientX - current.startX;
      const { item, mode } = current;

      // A click that never crossed the threshold is a selection, not an edit.
      if (Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return;

      const deltaMs = (deltaPx / pxPerDay) * 86_400_000;
      const snap = (d: Date) => (item.allDay ? snapToDay(d) : snapToQuarterHour(d));
      const ctx = {
        tasks,
        goals,
        habits,
        updateTask,
        updateGoal,
        updateArtProject: addOrUpdateArtProject
      };

      if (mode === 'move') {
        applyTimelineEdit(item, 'move', snap(new Date(item.start.getTime() + deltaMs)), undefined, ctx);
      } else if (mode === 'resize-end' && item.end) {
        applyTimelineEdit(item, 'resize-end', item.start, snap(new Date(item.end.getTime() + deltaMs)), ctx);
      } else if (mode === 'resize-start') {
        applyTimelineEdit(item, 'resize-start', snap(new Date(item.start.getTime() + deltaMs)), undefined, ctx);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [pxPerDay, tasks, goals, habits, updateTask, updateGoal, addOrUpdateArtProject]);

  // Shift/trackpad-horizontal over the canvas pans time. A plain vertical wheel
  // keeps scrolling the page, so the canvas never traps the user.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        el.scrollLeft += e.deltaX || e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Keep "now" honest without a per-frame timer.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Keyboard editing for the canvas.
   *
   * A drag is not available to keyboard users, so an editable item responds to the
   * arrow keys instead: left/right move by one day (shift for a week). Recorded
   * history is skipped by `editCapability`, so the keyboard can never rewrite a
   * fact any more than the pointer can.
   */
  const onItemKeyDown = useCallback(
    (e: React.KeyboardEvent, item: TimelineItem) => {
      const cap = editCapability(item);
      if (!cap.move) return;
      const step = e.shiftKey ? 7 : 1;
      let days = 0;
      if (e.key === 'ArrowLeft') days = -step;
      else if (e.key === 'ArrowRight') days = step;
      if (!days) return;
      e.preventDefault();
      const next = new Date(item.start);
      next.setDate(next.getDate() + days);
      applyTimelineEdit(item, 'move', next, undefined, {
        tasks,
        goals,
        habits,
        updateTask,
        updateGoal,
        updateArtProject: addOrUpdateArtProject
      });
      setSelectedId(item.id);
    },
    [tasks, goals, habits, updateTask, updateGoal, addOrUpdateArtProject]
  );

  // Escape clears the selection, so the inspector never traps the user in a detail view.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Centre the canvas when the window or zoom changes, so a jump or zoom lands
  // where the user is looking rather than at the left edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowPx = ((now.getTime() - viewWindow.from.getTime()) / 86_400_000) * pxPerDay;
    const anchorPx = ((anchor.getTime() - viewWindow.from.getTime()) / 86_400_000) * pxPerDay;
    const target = nowPx >= 0 && nowPx <= canvasWidth ? nowPx : anchorPx;
    el.scrollLeft = Math.max(0, target - el.clientWidth / 2);
    // Only on window/zoom changes — not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewWindow, pxPerDay, canvasWidth]);

  const nowOffset = ((now.getTime() - viewWindow.from.getTime()) / 86_400_000) * pxPerDay;
  const nowVisible = nowOffset >= 0 && nowOffset <= canvasWidth;

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(viewWindow.from)} — ${fmt(new Date(viewWindow.to.getTime() - 86_400_000))}`;
  }, [viewWindow, isAr]);

  const hiddenCount = prefs.hiddenDomains.length;
  const nothingToShow = !items.length && !dataset.unscheduled.length;

  return (
    <div className="tl-root">
      <header
        className="tl-toolbar"
        role="toolbar"
        aria-label={isAr ? 'شريط أدوات الجدول الزمني' : 'Timeline toolbar'}
      >
        <div className="tl-toolbar-lead">
          <span className="tl-eyebrow">
            <span className="line" aria-hidden="true" />
            {isAr ? 'مساحة زمنية' : 'Temporal workspace'}
          </span>
          <h1 className="tl-range">{rangeLabel}</h1>
        </div>

        <div className="tl-toolbar-group">
          <IconButton icon="chevronRight" label={isAr ? 'السابق' : 'Previous'} onClick={() => shiftWindow(-1)} />
          <IconButton icon="chevronLeft" label={isAr ? 'التالي' : 'Next'} onClick={() => shiftWindow(1)} />
          <Button variant="secondary" size="sm" onClick={goToday}>
            {isAr ? 'اليوم' : 'Today'}
          </Button>
        </div>

        <div className="tl-toolbar-group tl-zoom">
          <IconButton
            icon="minus"
            label={isAr ? 'تصغير' : 'Zoom out'}
            onClick={() => {
              const idx = ZOOM_LEVELS.indexOf(zoom);
              changeZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, idx + 1)]);
            }}
          />
          <span className="tl-zoom-label" aria-live="polite">
            {zoomLabel(zoom, isAr)}
          </span>
          <IconButton
            icon="plus"
            label={isAr ? 'تكبير' : 'Zoom in'}
            onClick={() => {
              const idx = ZOOM_LEVELS.indexOf(zoom);
              changeZoom(ZOOM_LEVELS[Math.max(0, idx - 1)]);
            }}
          />
          <IconButton icon="grid" label={isAr ? 'ملاءمة المحتوى' : 'Fit to content'} onClick={fitToContent} />
        </div>

        <div className="tl-jump">
          <NuqtaDatePicker
            value={localDateKey(anchor)}
            onChange={(e) => jumpToDate(e.target.value)}
            isAr={isAr}
            size="sm"
            ariaLabel={isAr ? 'الانتقال إلى تاريخ' : 'Jump to a date'}
          />
        </div>

        <label className="tl-search">
          <NuqtaIcon name="search" className="w-3.5 h-3.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث في العناصر' : 'Search items'}
            aria-label={isAr ? 'ابحث في الجدول الزمني' : 'Search the timeline'}
          />
        </label>

        <div className="tl-toolbar-group">
          <Button
            variant="ghost"
            size="sm"
            icon="layers"
            onClick={() => setLanesOpen((v) => !v)}
            aria-expanded={lanesOpen}
          >
            {isAr ? 'المسارات' : 'Lanes'}
            {hiddenCount > 0 && <span className="tl-count">{hiddenCount}</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="settings"
            onClick={() => setDisplayOpen((v) => !v)}
            aria-expanded={displayOpen}
          >
            {isAr ? 'العرض' : 'Display'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="eye"
            onClick={() => setInspectorOpen((v) => !v)}
            aria-expanded={inspectorOpen}
          >
            {isAr ? 'المفتّش' : 'Inspector'}
          </Button>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setActiveNavTab('tasks')}>
            {isAr ? 'عنصر جديد' : 'New item'}
          </Button>
        </div>
      </header>

      <nav className="tl-presets" aria-label={isAr ? 'العروض' : 'Presets'}>
        {TIMELINE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`tl-preset${prefs.preset === p.id ? ' is-active' : ''}`}
            onClick={() => applyPreset(p.id)}
            aria-pressed={prefs.preset === p.id}
            title={isAr ? p.hintAr : p.hintEn}
          >
            {isAr ? p.labelAr : p.labelEn}
          </button>
        ))}
        <span className="tl-preset-hint">{isAr ? preset.hintAr : preset.hintEn}</span>
      </nav>

      {lanesOpen && (
        <div className="tl-lanes-panel" role="group" aria-label={isAr ? 'إظهار المسارات' : 'Visible lanes'}>
          {dataset.lanes.map((lane) => {
            const active = isDomainVisible(lane.domain);
            return (
              <button
                key={lane.id}
                type="button"
                className={`tl-lane-chip${active ? ' is-on' : ''}`}
                onClick={() => toggleDomain(lane.domain)}
                aria-pressed={active}
              >
                <NuqtaIcon name={iconForDomain(lane.domain)} className="w-3.5 h-3.5" />
                {lane.label}
              </button>
            );
          })}
        </div>
      )}

      {displayOpen && (
        <div className="tl-display-panel" role="group" aria-label={isAr ? 'خيارات العرض' : 'Display options'}>
          <label className="tl-switch">
            <input
              type="checkbox"
              checked={prefs.showUnscheduled}
              onChange={(e) => setPrefs((p) => ({ ...p, showUnscheduled: e.target.checked }))}
            />
            <span>{isAr ? 'إظهار ما بلا تاريخ' : 'Show unscheduled'}</span>
          </label>
          <div className="tl-legend" aria-label={isAr ? 'مفتاح الرموز' : 'Legend'}>
            <span className="tl-legend-item">
              <i className="tl-legend-swatch tl-legend-swatch--actual" aria-hidden="true" />
              {isAr ? 'فعلي' : 'Actual'}
            </span>
            <span className="tl-legend-item">
              <i className="tl-legend-swatch tl-legend-swatch--planned" aria-hidden="true" />
              {isAr ? 'مخطّط' : 'Planned'}
            </span>
            <span className="tl-legend-item">
              <i className="tl-legend-swatch tl-legend-swatch--milestone" aria-hidden="true" />
              {isAr ? 'محطة' : 'Milestone'}
            </span>
          </div>
        </div>
      )}

      <div className={`tl-body${inspectorOpen ? ' has-inspector' : ''}`}>
        <div className="tl-canvas-wrap">
          {nothingToShow ? (
            <EmptyState
              icon="calendar"
              title={isAr ? 'لا شيء على المحور بعد' : 'Nothing on the axis yet'}
              description={
                isAr
                  ? 'ستظهر المهام والعادات والأهداف هنا بمجرد أن تحمل تاريخًا.'
                  : 'Tasks, habits and goals appear here as soon as they carry a date.'
              }
              action={
                <Button variant="primary" size="sm" icon="plus" onClick={() => setActiveNavTab('tasks')}>
                  {isAr ? 'أضف مهمة' : 'Add a task'}
                </Button>
              }
            />
          ) : (
            <div className="tl-canvas" ref={scrollRef}>
              <div className="tl-canvas-inner" style={{ width: RAIL_W + canvasWidth }}>
                <div className="tl-ruler-row">
                  <div className="tl-ruler-rail" style={{ width: RAIL_W }} aria-hidden="true" />
                  <div className="tl-ruler" style={{ width: canvasWidth }}>
                    {ruler.map((tick) => (
                      <div
                        key={`tick-${tick.start.getTime()}`}
                        className={`tl-tick${tick.major ? ' is-major' : ''}`}
                        style={{
                          left: ((tick.start.getTime() - viewWindow.from.getTime()) / 86_400_000) * pxPerDay,
                          width: ((tick.end.getTime() - tick.start.getTime()) / 86_400_000) * pxPerDay
                        }}
                      >
                        {tick.label && <span className="tl-tick-label">{tick.label}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tl-lanes">
                  {lanes.map((lane) => {
                    const layout = layoutLane(lane.items, viewWindow.from, pxPerDay);
                    const height = Math.max(LANE_H, 20 + layout.rows * ROW_H);
                    return (
                      <div className="tl-lane" key={lane.id} style={{ minHeight: height }}>
                        <div className="tl-lane-rail" style={{ width: RAIL_W }}>
                          <NuqtaIcon name={iconForDomain(lane.domain)} className="w-4 h-4" />
                          <span className="tl-lane-label">{lane.label}</span>
                          <span className="tl-lane-count">{lane.items.length}</span>
                        </div>
                        <div className="tl-lane-track" style={{ width: canvasWidth }}>
                          {ruler.map((tick) => (
                            <div
                              key={`grid-${lane.id}-${tick.start.getTime()}`}
                              className={`tl-gridline${tick.major ? ' is-major' : ''}`}
                              style={{
                                left: ((tick.start.getTime() - viewWindow.from.getTime()) / 86_400_000) * pxPerDay
                              }}
                            />
                          ))}
                          {layout.placed.map(({ item, left, width, row }) => {
                            const cap = editCapability(item);
                            const isSelected = item.id === selectedId;
                            const isDragging = drag?.item.id === item.id && drag.active;
                            const shift = isDragging ? drag!.deltaPx : 0;
                            const previewLeft = isDragging && drag!.mode !== 'resize-end' ? left + shift : left;
                            const previewWidth =
                              isDragging && drag!.mode === 'resize-end'
                                ? Math.max(18, width + shift)
                                : isDragging && drag!.mode === 'resize-start'
                                  ? Math.max(18, width - shift)
                                  : width;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={[
                                  'tl-item',
                                  `tl-item--${item.reality}`,
                                  `tl-item--${item.kind}`,
                                  isSelected ? 'is-selected' : '',
                                  cap.move ? 'is-draggable' : '',
                                  isDragging ? 'is-dragging' : ''
                                ].join(' ')}
                                style={{
                                  left: previewLeft,
                                  width: Math.max(18, previewWidth),
                                  top: row * ROW_H
                                }}
                                data-domain={item.domain}
                                data-reality={item.reality}
                                title={`${item.title}${item.status ? ` · ${item.status}` : ''}`}
                                onClick={() => {
                                  setSelectedId(item.id);
                                  setInspectorOpen(true);
                                }}
                                onPointerDown={(e) => beginDrag(e, item, 'move')}
                                onKeyDown={(e) => onItemKeyDown(e, item)}
                                aria-label={`${item.title} — ${
                                  item.reality === 'actual'
                                    ? isAr
                                      ? 'فعلي'
                                      : 'actual'
                                    : isAr
                                      ? 'مخطّط'
                                      : 'planned'
                                }`}
                              >
                                {cap.resizeStart && (
                                  <span
                                    className="tl-item-handle tl-item-handle--start"
                                    onPointerDown={(e) => beginDrag(e, item, 'resize-start')}
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="tl-item-mark" aria-hidden="true" />
                                {width > 44 && item.kind !== 'milestone' && (
                                  <span className="tl-item-title">{item.title}</span>
                                )}
                                {cap.resizeEnd && (
                                  <span
                                    className="tl-item-handle tl-item-handle--end"
                                    onPointerDown={(e) => beginDrag(e, item, 'resize-end')}
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {nowVisible && (
                  <div className="tl-now" style={{ left: RAIL_W + nowOffset }} aria-hidden="true">
                    <span className="tl-now-dot" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {inspectorOpen && (
          <aside className="tl-inspector" aria-label={isAr ? 'تفاصيل العنصر' : 'Item details'}>
            {selected ? (
              <div className="tl-inspector-body">
                <div className="tl-inspector-head">
                  <Badge tone={selected.reality === 'actual' ? 'success' : 'brand'}>
                    {selected.reality === 'actual' ? (isAr ? 'فعلي' : 'Actual') : isAr ? 'مخطّط' : 'Planned'}
                  </Badge>
                  <IconButton icon="close" label={isAr ? 'إغلاق' : 'Close'} onClick={() => setSelectedId(null)} />
                </div>
                <h2 className="tl-inspector-title">{selected.title}</h2>
                {selected.subtitle && <p className="tl-inspector-sub">{selected.subtitle}</p>}

                <dl className="tl-facts">
                  <div>
                    <dt>{isAr ? 'البداية' : 'Starts'}</dt>
                    <dd>{formatMoment(selected.start, selected.allDay, isAr)}</dd>
                  </div>
                  {selected.end && (
                    <div>
                      <dt>{isAr ? 'النهاية' : 'Ends'}</dt>
                      <dd>{formatMoment(selected.end, selected.allDay, isAr)}</dd>
                    </div>
                  )}
                  {selected.durationMinutes !== undefined && (
                    <div>
                      <dt>{isAr ? 'المدة' : 'Duration'}</dt>
                      <dd>
                        {selected.durationMinutes} {isAr ? 'دقيقة' : 'min'}
                      </dd>
                    </div>
                  )}
                  {selected.facts?.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>

                {!editCapability(selected).move && (
                  <p className="tl-readonly">
                    {isAr ? editCapability(selected).readOnlyReasonAr : editCapability(selected).readOnlyReasonEn}
                  </p>
                )}

                <Button variant="secondary" size="sm" icon="arrow" onClick={() => openSource(selected)}>
                  {isAr ? 'افتح في وحدته' : 'Open in its module'}
                </Button>
              </div>
            ) : (
              <div className="tl-inspector-empty">
                <NuqtaIcon name="compass" className="w-5 h-5" />
                <p>
                  {isAr ? 'اختر عنصرًا من المحور لعرض تفاصيله.' : 'Select an item on the canvas to see its details.'}
                </p>
              </div>
            )}

            {prefs.showUnscheduled && dataset.unscheduled.length > 0 && (
              <div className="tl-backlog">
                <h3>
                  {isAr ? 'بلا تاريخ' : 'Unscheduled'} <span>{dataset.unscheduled.length}</span>
                </h3>
                <ul>
                  {dataset.unscheduled.slice(0, 12).map((u) => (
                    <li key={u.id}>
                      <button type="button" onClick={() => setActiveNavTab(NAV_FOR_DOMAIN[u.domain])}>
                        <NuqtaIcon name={iconForDomain(u.domain)} className="w-3.5 h-3.5" />
                        <span>{u.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

function formatMoment(date: Date, allDay: boolean, isAr: boolean): string {
  const day = date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  if (allDay) return day;
  const time = date.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default TimelineWorkspace;
