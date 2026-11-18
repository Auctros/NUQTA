# NUQTA — repository notes for agents

Offline-first React + Vite PWA. All user data lives in `localStorage` (source of truth)
with an IndexedDB mirror for recovery.

## Commands

- `npm run lint` — `tsc --noEmit`.
- `npm run test` — Vitest (jsdom, `TZ=Africa/Cairo` so UTC-vs-local date bugs surface).
- `npm run build` — production bundle into `dist/`.
- `npm run verify` — lint + tests + build + `scripts/check-invariants.mjs` (the acceptance gate).
- `npm run test:e2e` — builds, serves with `vite preview`, and runs two Playwright
  acceptance scripts (`scripts/e2e/run-offline.mjs`):
  - `scripts/e2e/offline.py` — offline shell install/reload.
  - `scripts/e2e/views.py` — every view renders, 4 responsive widths have no horizontal
    overflow, mobile nav open→navigate→close, and an Arabic/RTL pass.
  Requires `pip install playwright && playwright install chromium`.
- `npm run verify:full` — `verify` + `test:e2e`.

## Invariants

`scripts/check-invariants.mjs` is the acceptance gate and exits non-zero on any violation
(19 rules). Add a rule whenever a new safety property must never regress.

## Theming (light / dark)

- `applyThemeClass()` in `src/lib/themeTransition.ts` toggles the `light-mode` class on
  `<html>`/`<body>`; `setTheme` in the store drives `runLiquidThemeTransition`. Light is the
  first-run default (`defaultProfile()` in `src/lib/storage.ts`), and `index.html` re-applies
  the saved theme before first paint so the shell never flashes the wrong mode. `:root` in
  `src/nuqta-theme.css` holds the dark palette; `src/index.css` holds the semantic token
  layer and the `.light-mode` overrides.
- Never hardcode a colour. Use the tokens: surfaces `--surface-deep/raised/inset/chip/track/
  active/page`, text `--text-primary/secondary/tertiary/on-state`, `--border-*`, brand
  `--brand/--brand-strong`, state `--state-*`, tones `--tone-{success,warning,danger,info,
  purple}` with `-wash` / `-line` roles, and the heatmap ramp `--heat-0..4`.
- Palette-shade utilities (`text-emerald-400`, `bg-amber-500/15`) and arbitrary hex
  utilities (`bg-[#141e19]`) are forbidden — invariant #15 fails the build on any hex inside
  a `className`. Inline `style` colours are allowed only for user data (cover/artwork colours).
- The pastel accents `--blue/--purple/--orange/--red` are dark-tuned; they are re-declared
  darker inside `.light-mode` so text on white stays readable. Prefer a `--tone-*` role when
  one exists.
- Verify with `scripts/e2e/views.py` (both themes, all widths) — a change that reads well in
  dark but leaves a dark panel in light mode is a regression.
- **The window scrollbar is app-themed and never reflows the layout.** The page scrolls on
  `<html>`, so a classic OS scrollbar that appears on long pages but not short ones used to
  change the content width and make navigation feel like switching apps. The `html { … }` rule
  in `src/index.css` therefore sets `scrollbar-gutter: stable` (space is always reserved) and
  paints the rail with `scrollbar-color` (Firefox) plus `::-webkit-scrollbar-*` (Chromium),
  using `--border-strong` for the thumb and `--accent-strong` on hover. Overlays lock scroll
  via `document.body.style.overflow` (`src/components/ui/overlays.tsx`); the reserved gutter
  keeps that from shifting the page too. Invariant #17 and the `content_widths` check in
  `views.py` guard this — do not remove `scrollbar-gutter: stable` from the root.
- **Brand assets mirror the sidebar logo.** `public/favicon.svg` and the PNG app icons
  (`icon-192.png`, `icon-512.png`) reproduce `.brand-mark`: a mint `#b6f3d3` rounded square
  with a `#0b1711` centre dot. The SVG keeps the rounded corners for the browser tab; the
  PNGs are full-bleed so they stay valid `maskable` PWA icons and the notification icon.
  If the logo changes, regenerate both from the same geometry.

## Week / date rules (NUQTA week)

- **NUQTA's week starts on Saturday and Friday is the weekly day off**
  (Sat · Sun · Mon · Tue · Wed · Thu · Fri). `src/lib/week.ts` is the single source of
  truth: `WEEK_DAY_ORDER`, `WEEKDAY_DOW`, `indexFromWeekStart`, `dayOfWeek`,
  `isWorkingDay` / `isWeekOff`, `startOfWeekKey` / `endOfWeekKey` / `weekDayKeys`, and the
  localised `weekDayLabel(s)` / `weekDayNarrow(s)` helpers.
- Never call `Date.getDay()` and compare against a literal weekday number at a call site —
  that is how the old Sunday-first behaviour drifted. Read the weekday through `week.ts`
  (it is the only module allowed to call `getDay()`).
- "Weekdays" everywhere means the working week (Sat–Thu), not Mon–Fri. The heatmap grid,
  weekday-rhythm strip and 42-day calendar all align through `indexFromWeekStart`.

## Recurrence engine

- `src/lib/recurrence.ts` is the shared rule vocabulary (`RecurrenceRule`,
  `RecurrenceFrequency` in `src/types/index.ts`). `isRuleDueOn` / `nextOccurrenceKey` /
  `occurrencesInRange` are pure and day-key based (no raw `Date` arithmetic).
- Tasks **materialise** (`src/lib/taskRecurrence.ts`): `materializeSeries` emits one real
  `Task` per due date over a bounded horizon (`SERIES_HORIZON_DAYS`), sharing a `seriesId`
  and a deterministic `occurrenceIndex`; `topUpRecurringTasks` (run from `initializeStore`)
  tops the horizon up idempotently. Completing / skipping / editing / deleting one
  occurrence is an ordinary task operation. Store actions: `updateTaskSeries`,
  `deleteTaskSeries`, `skipTaskOccurrence`.
- Habits **evaluate** (`src/lib/habitSchedule.ts`): a habit's `recurrence` (when present)
  takes precedence over the legacy `frequency` field and nothing is stored per day, so
  changing the rule re-scores past compliance without rewriting records.

## Task status model

- `src/lib/taskStatus.ts` owns the lifecycle vocabulary (`isTaskActive`, `isTaskDone`,
  `isTaskClosed`, `isTaskPending`, `isTaskActiveDone`). Use these instead of inline
  `status !== 'completed'` checks so a new status (e.g. `skipped`) cannot start counting as
  pending in one view while being excluded in another. `skipped` is closed, not completed.

## Shared UI primitives

- `src/components/ui/` exports the kit: `primitives`, `layout`, `forms`, `overlays`,
  `NuqtaSelect` and `NuqtaPickers`. Import from `./ui`, do not re-implement.
- **`NuqtaSelect` replaces every native `<select>`.** It keeps the native contract (an event
  whose `target.value` is the chosen option's value) and accepts `<option>` children, so it
  is a drop-in swap. It is portal-rendered, RTL-aware, keyboard-accessible and theme-aware.
  Do not add a new native `<select>`; the styling and behaviour would drift.
- **`NuqtaDatePicker` / `NuqtaTimePicker` replace every native `<input type="date">` and
  `<input type="time">`.** They keep the same contract (an event whose `target.value` is
  `"YYYY-MM-DD"` — a local day, via `src/lib/dateKey.ts` — or `"HH:mm"`), so persisted values,
  handlers and tests are untouched. They share `NuqtaSelect`'s trigger/panel design, are
  portal-rendered, RTL-aware and theme-aware, and honour `min`/`max`, `clearable` and
  `minuteStep`. Do not add a new native date/time input.
- **Icons come from `NuqtaIcon` only.** `IconName` (exported from `./NuqtaIcon`) is the single
  icon union; interface controls, nav items, tiles and status markers must render a
  `NuqtaIcon`, never a bare emoji or a text glyph. Emoji that is *user content* (journal
  mood, illustrations, studio vault imagery) is intentionally kept.
- **Escape closes overlays.** Any overlay that renders its own backdrop (legacy `.modal`
  markup and the kit `Modal`/`Sheet`) closes on Escape via `useEscapeKey(open, onClose)`
  from `src/lib/useEscapeKey.ts`, and exposes `role="dialog"` + `aria-modal="true"`.
- **A modal must never move the page.** Every backdrop is `position: fixed` inside
  `.page-content`, so `.page-content` must not become a containing block: no `transform`,
  `filter`, `perspective`, `contain` or `will-change` on it, and its entry animation
  (`page-in`) must stay opacity-only. A lingering `transform` (e.g. from a keyframe's `to`
  state kept by `animation-fill-mode: both`) makes the overlay size to the whole tall page
  instead of the viewport, so the browser scrolls to the off-screen dialog. Invariant #19 and
  the `modal_scroll` check in `views.py` guard this; keep the page animation opacity-only.
- **Prefer inline panels over popups.** Reserve modals for genuinely modal tasks; savings
  and budget editing live in inline panels toggled with `aria-expanded`/`aria-controls`.
- **Profile is the single home for identity and settings.** `ProfileView` owns identity, the
  editable display-name form, the "Your Progress" snapshot, workspace preferences,
  notifications, backup/data tools and privacy. There is no separate Settings page or
  `settings` nav tab — do not reintroduce one; extend the Profile page instead. The store's
  `profile` record and its `nuqta_profile_v1` key are unchanged.
- **A first run has no invented identity.** `profile.name` starts as `''`. The interface never
  greets a person that was not entered: the dashboard greeting stays nameless ("Good morning")
  and the Profile dock shows its destination label ("Local profile") until a name is set. The
  Profile page's identity card shows the generic "User" / "المستخدم" as a label, not a persona.
  Never invent a name like "Ali"/"علي".
- **The Profile entry is a standalone dock, not a sidebar row.** It lives in a `.profile-dock`
  element that is a fixed sibling of `<aside class="sidebar">` (so it never scrolls with the
  nav list and stays pinned at the rail's foot). It still carries `data-sidebar-nav="true"` for
  the e2e nav sweep. On desktop the rail's `inset-block-end` leaves room for the dock; on
  mobile the dock rides the off-canvas drawer via the shared `open` class.

## Layout / responsive rules

- `.page-heading` and `.heading-actions` must wrap and shrink; never reintroduce
  `flex-shrink: 0` on a heading action row (it overflowed the viewport in the 661–1150 px
  band). Inner flex rows that can hold long content need `flex-wrap` + `min-w-0`.
- Any responsive change must keep `scripts/e2e/views.py` green across all views and widths.

## Specialized studios (Quran / Workout / Reading / Drawing)

- Each studio lives in `src/components/{Quran,Workout,Reading,Drawing}View.tsx` and is
  rendered from `App.tsx` when `activeNavTab` matches. All four share one skeleton,
  `StudioFrame` (`src/components/studios/StudioKit.tsx`), but deliberately choose a
  different `navVariant` so they do not read as one template:
  - Quran `structured` · Reading `shelf` (underline) · Workout `segmented` · Drawing `workspace`.
  `StudioKit` also exports `StudioSection`, `StudioStat`, `StudioBars`, `StudioLegend`,
  `StudioEmpty`. Colour comes from the `[data-studio='…']` accent scope in `index.css`;
  never hard-code a studio colour — read `var(--studio-accent)` etc.
- Studio data is a `specializedType` habit: `quranData` / `workoutData` / `readingData` /
  `drawingData` (see `src/types/index.ts`). Never add a parallel store — extend the
  existing one via its actions (`logQuranSession`, `logWorkoutSession`, …).
- **Quran interval-union is sacred.** `logQuranSession` merges ayah ranges
  (`mergeAyahRanges` + `calculateDistinctAyahs`) so ayahs are never double-counted. Any
  Quran UI must feed the existing `ayahStart`/`ayahEnd` model; do not reimplement counts.
- The built-in exercise library lives in `src/lib/exerciseCatalog.ts`
  (`EXERCISE_CATALOG`, `exerciseEntryFromCatalog`, `movementLabel`, `equipmentLabel`) and is
  the single source of truth shared by `WorkoutAppModal` (dashboard/habits entry point) and
  the Workout Studio. Add exercises there, never in a second copy.
  - Catalog rows are authored per body region in `src/lib/catalog/upperBody.ts` and
    `src/lib/catalog/lowerBody.ts`; `exerciseCatalog.ts` only aggregates and re-exports.
  - Catalog-only vocabulary (fine-grained muscle groups, movement patterns, equipment)
    lives in `src/lib/exerciseTypes.ts`. It is never persisted — logged sessions keep
    using the legacy `MuscleMovement` unions, so the catalog can grow without a
    backup-schema change.
- Exercise visuals are code-generated SVG, not images. `ExerciseIllustration`
  (`src/components/workout/illustration/`) renders one shared anatomical `Figure` driven
  by keypoint `poses`; `registry.ts` keys each exercise by `PrebuiltExercise.illustrationKey`.
  Add a key → it appears on the card and in the detail view. Entries marked `animated`
  must have phases that actually differ, and every pose must stay inside the 200×200
  viewBox — `tests/exerciseLibrary.test.tsx` enforces both.
- **The exercise browser is one component: `ExerciseCatalog`**
  (`src/components/workout/ExerciseCatalog.tsx`). It owns the search box, the filter row,
  the result grid, the detail sheet, and the "recently performed" quick-pick; the Workout
  Studio "Exercises" tab and the `WorkoutAppModal` "Exercise Catalog" tab both render it, so
  the two entry points can never drift. Callers only supply `isAr`, `recentSessions`, and
  what "add" means (`onAdd`/`addLabel`). `variant="inline"` drops the filter row for the
  session drawer. Do not re-implement a second grid — extend this component instead.
  `recentlyPerformedExercises(sessions)` in `exerciseCatalog.ts` resolves logged names back
  to catalog entries; it is pure and name-based (an unknown/renamed exercise is skipped).
- `MuscleMap` draws front/back anatomical views and highlights primary/secondary muscles;
  `ExerciseCard` and `ExerciseDetailModal` compose the illustration, muscle map, cues and
  variations. Both `WorkoutView` (Exercises tab) and `WorkoutAppModal` use the same card.
- Goal linkage: sessions carry `linkedGoalId` and the store defaults it from the habit.
  Do not compute goal progress in a studio — `goalProgressEngine` owns that.
- `WorkoutAppModal` / `ReadingAppModal` are the dashboard/habits entry points; keep them
  working.

## Storage / backup rules

- localStorage is the source of truth; IndexedDB is only a recovery mirror.
- A backup is validated in full before any write, and applied all-or-nothing
  (`restoreData` rolls every key back if a write fails). Nested records and cross-entity
  references (goal <-> task/habit/book links) are checked too.
- Recovery must never let the mirror overwrite present-but-unreadable data: an invalid or
  incomplete metadata record (`nuqta_meta_v1`) is treated as "unknown", not "empty".
- Wipe clears the mirror first; if the mirror cannot be cleared, localStorage is kept so a
  later recovery cannot resurrect deleted data.

## Insights engine

- `src/lib/insightsEngine.ts` is the single source of truth for every Insights figure.
  `computeInsightsReport(range, …)` returns the whole report (timeline, per-domain
  summaries, weekday rhythm, correlations, streaks); `InsightsView` only renders it and
  must not re-derive series of its own.
- Honesty rule: a metric with no underlying record is `null`, never `0`, and the view
  renders an explicit "no data" state. A flat line must mean "recorded flat", not "empty".
- Timeline bucketing: `week` → daily (weekday-name labels), `30d` → daily (labels are the
  day of month, because weekday names repeat across 30 columns), `90d` → Sat–Fri weeks,
  `year`/`all-time` → months. Read the weekday through `week.ts`; never `Date.getDay()`.
- `src/components/charts/InsightsCharts.tsx` holds the visual primitives (trend chart,
  domain bars, weekday-rhythm strip) on the `--tone-*` / `--heat-*` tokens.

## Service worker

`public/sw.js` precaches ONLY the discovered shell assets (index.html + its same-origin
script/link assets). The cache name is versioned (`nuqta-shell-v<N>`) — bump
`CACHE_VERSION` on every change. The fetch handler never writes to the cache, so dynamic
requests and user data are never stored, and only NUQTA-owned caches are ever deleted.

Notifications are routed through the service worker: `NuqtaNotificationEngine.notify`
posts a `nuqta-notify` message to `navigator.serviceWorker.controller` when present (falling
back to a page-level `Notification`), and the worker renders it and focuses/opens a client
on `notificationclick`. This is NOT background push — with no server the page must be open
for a reminder to fire; the worker only renders and routes the click.
