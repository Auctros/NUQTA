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
(27 rules). Add a rule whenever a new safety property must never regress.

## Completion controls

- Every binary "done" toggle is `<SpringCheck>` from `src/components/ui/`. It owns the
  animation (a local rAF spring in `src/lib/useSpringValue.ts`, no `motion` dependency), the
  checkbox semantics, and the label strike. Invariants #26 and #27 fail the build on a
  second `role="checkbox"`, a `check-circle` class, or an `motion`/`framer-motion` import.
- Give it a `label` when the row text belongs to the control (milestones, phases); leave the
  label off in dense rows and pass `ariaLabel`. Do not re-add a per-surface checkmark: the
  old `.check-circle` / `.set-done` / `.ex-day-check` copies each drifted on keyboard
  support and reduced motion.
- A completed row that leaves a filtered list stays mounted for `useCompletionHold`
  (`src/lib/useCompletionHold.ts`) so the checkmark can draw. The store write happens
  immediately; only the visual exit is delayed.

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
- **Never call `window.alert` / `confirm` / `prompt`.** They render outside the app shell:
  they ignore the theme, the language and RTL, block the main thread, and look like a
  different product. Ask through `dialogs.confirm/alert/prompt` from
  `src/components/ui/dialogController.ts`, which resolves like the native calls
  (`confirm` → `boolean`, `prompt` → `string | null`) and is rendered by the single
  `DialogHost` mounted in `App`. Transient feedback about something that just happened goes
  through `feedback.success/error/warning/info` (ephemeral toasts, capped at three); it is
  deliberately *not* the Notification Center, which holds durable events that survive a
  reload. Invariant #24 fails the build on a stray native dialog call.
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

## Motion & surface lifecycles

- No animation library. Surfaces animate with CSS transitions driven by the `nq-*` rules in
  `src/index.css`, and their durations come from `OVERLAY_TIMING` in `src/lib/motion.ts`. The
  same constant feeds the CSS transition and the unmount timer, so a panel can never vanish
  mid-fade or linger after it finished. Do not invent a new duration; extend `OVERLAY_TIMING`.
- A surface that animates out uses `usePresence(open, exitMs)` from `src/lib/usePresence.ts`
  and renders on `presence.mounted` with `data-state={presence.exiting ? 'closed' : 'open'}`.
  While exiting it must also carry `inert` and `aria-hidden="true"` — the element is still on
  screen, so it must already be unreachable. Only after the timer fires is it truly removed;
  a menu that merely hides is the bug this replaced.
- Entrance uses `useEntering(presence.mounted)`, keyed on `mounted` and not on `open`. A mount
  effect that clears a one-frame flag is wrong here: the owner component stays mounted across
  open/close, so the flag is consumed before the panel ever paints and the surface appears
  without travelling. Keying on `mounted` also means reopening mid-exit reverses the exit
  instead of replaying the entrance.
- The travelling highlight (`MovingHighlight` / `useMovingHighlight`) is the one integrator in
  the app that runs per frame; it is a local rAF spring (`useSpringRect` → `springStep`), never
  a library.
- Reduced motion removes travel, never information. `prefers-reduced-motion` collapses CSS
  transitions to zero duration in `index.css`; keep every state (open, selected, checked)
  fully rendered and asserted in tests.

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
- **Exercise visuals are one shared, licensed illustration set.** `ExerciseIllustration`
  (`src/components/workout/illustration/`) renders a drawing from **Open Exercise Art**
  (Alex Mollard, artwork CC BY-SA 4.0) vendored under `public/exercise-art/`. The whole
  library draws the *same character*, which is what makes 72 movements read as one set
  instead of 72 unrelated sketches. `exerciseArt.ts` is the only registry: it maps each
  `PrebuiltExercise.illustrationKey` to an art id plus bilingual alt text.
  - The SVGs are `currentColor` line art, so they are used as a **CSS mask** and painted
    with `background: var(--studio-accent)`. This is deliberate: `currentColor` resolves to
    black inside an `<img>` and would vanish in the dark theme. Masking keeps one file
    correct in every theme and tints every figure identically. Do not switch to `<img>`,
    and do not bake colours into the vendored SVGs.
  - Adding an exercise means adding a key to `exerciseArt.ts` pointing at a vendored id
    (plus a file in `public/exercise-art/` and its `manifest.json` entry). Unmapped keys
    render a labelled placeholder rather than throwing.
  - Attribution is required by the licence: `ART_SOURCE` holds the credit, the library
    footer renders it, and invariant #22 fails if the credit or the mapping breaks.
  - `tests/exerciseLibrary.test.tsx` enforces that every key resolves, every referenced
    SVG exists on disk, and no vendored SVG hard-codes a colour.
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
- **Programs are a superset of routines, not a new entity.** `WorkoutRoutine.program`
  (`WorkoutProgram` in `src/types/index.ts`) holds the structured weeks/days; a routine
  without it is still a valid flat "quick routine". `src/lib/program.ts` owns the pure
  helpers (lifecycle labels, `programProgress`, `estimateDayMinutes`, `programFromTemplate`,
  `flattenProgramExercises`) and `programTemplates.ts` the starter splits. Lifecycle and
  day completion go through the store (`setWorkoutRoutineStatus`, `setProgramDayCompleted`),
  never local state. `ProgramBuilder` (`src/components/workout/ProgramBuilder.tsx`) is the
  day-level workspace rendered inside a program card in the Workout Studio "Programs" tab;
  filling a day keeps the flat `exercises` list in sync via `flattenProgramExercises`.
- `WorkoutAppModal` / `ReadingAppModal` are the dashboard/habits entry points; keep them
  working.

## History views (Timeline / Commitment Map / Courses)

- **`src/lib/lifeTimeline.ts` is the only timeline query engine.** `buildTimelineView`
  takes a `TimelineQuery` (period, domain, event type, search, `fromDate`/`untilDate`) and
  returns the filtered events, the day/week/month groups and the counts the chips render.
  `LifeTimeline` renders that result and must not re-filter `items` itself — that is how
  the old `ArchiveHistoryView` accumulated a second, drifting filter chain.
- **Administrative events are hidden by default.** `created` / `updated` are bookkeeping,
  not history; `includeAdministrative` is opt-in. A test asserts they stay out of the feed.
- **A focused day replaces the period, it does not narrow it.** Passing `focusDate` sets
  `period: 'all'` with `fromDate === untilDate`, so a day picked on the map shows that day
  only rather than silently widening back to "this month".
- **`src/lib/commitmentMap.ts` scores follow-through, not activity.** A day is `missed`
  only when something was actually due; a day with nothing scheduled is `rest`, and days
  before `trackingStart` are `no_data`. These three must never collapse into one visual —
  the whole point of the map is that "nothing was due" and "you skipped it" are different
  facts. `buildCommitmentYear(sources, year, scope, todayKey)` is pure; the compact
  dashboard card and the full view are the same engine at two sizes.
- **Timeline ⇄ map day handoff is a gesture, not persisted state.** `focusDate` lives in
  `ArchiveHistoryView`'s local state (see "Never restore anything transient"). Do not move
  it into `nuqta.ui.*`.
- **Courses store a local snapshot of a YouTube playlist** (`YoutubeCourse.videos`) so the
  course reads offline; a refresh is explicit, never automatic. Watch progress is the
  user's own statement in `nuqta.ui.courseProgress` — playback is never scraped, because
  that integration is exactly what this app avoids. The library sorts by nearest-to-done.
- **`src/lib/youtubeLink.ts` owns link parsing and id validation** (`parsePlaylistLink`,
  `isValidPlaylistId`, `canonical*Url`); the UI must not hand-build a YouTube URL.
- **The YouTube API key never reaches the browser.** `scripts/youtube-proxy.mjs` serves
  `/api/youtube/*` on the app's own origin and is attached in both `vite.config.ts` (dev)
  and `scripts/serve-dist.mjs` (production). A missing key returns `503 not_configured` and
  the UI shows setup instructions — never invented course data. The playlist id is
  validated before it is interpolated into an outbound URL, and responses are `no-store`.
  `tests/youtubeProxy.test.ts` guards this boundary: the key must not appear in any
  response body or header, and must only ever be sent to `googleapis.com`.
- **Network primitives are allow-listed by file.** The invariant rule permits `fetch` only
  in `src/lib/sync/client.ts` and `src/lib/youtubeClient.ts`. Adding a third requires a
  reviewed, same-origin reason; never widen it to an arbitrary third-party URL.
- **Derive a view from its data, not from the URL round-trip.** `CoursesView` computes
  `showingCourse` from the open course and only mirrors it into the view tab; deriving the
  rendered view from the persisted tab made opening a card depend on navigation timing and
  could render nothing.

## Navigation & UI state

- **A section is a destination; a filter is not.** The section lives in the URL
  (`#/<section>`), so it is linkable and Back/Forward walk real screens. A view-level tab
  rides along as the second segment (`#/workout/programs`) because it is a place inside a
  section. Search queries, status filters and sort/view modes stay out of the URL and go to
  `nuqta.ui.workflow.<scope>` instead — they are a working position, not somewhere to link.
- **`navigate()` is the only way a screen changes section** (`src/lib/useNavigation.ts`).
  It writes the store and the URL together. Calling `setActiveNavTab` directly desyncs the
  address bar, so sidebar, command palette, notifications and deep links all go through it.
- **Startup precedence** (`resolveInitialRoute` in `src/lib/navigation.ts`): a valid hash,
  then the last visited section, then the dashboard. A deep link always wins over memory.
- **`replace` is for corrections the person did not ask for** — normalising an invalid
  hash, filling in a remembered view tab. A correction that pushed would make Back walk
  through states nobody chose.
- **Never restore anything transient.** Dialogs, open confirmations, in-flight forms and
  destructive operations are never written to storage, so a reload cannot resume a
  half-finished delete.
- **UI preferences are not user data.** `NuqtaStorageEngine` treats every `nuqta_` key as a
  record; UI state therefore uses `nuqta.ui.*` (navigation, time format, workflow filters)
  and must never use the `nuqta_` prefix, or it would be mirrored and backed up as data.
- Persisted workflow state is validated on read (`oneOf`, `isString`); a stored value that
  no longer names a real filter falls back to the default instead of rendering an empty
  view. Writes are debounced and flushed on unmount.

## Time display

- `src/lib/timeFormat.ts` is the single source of truth: values are stored as `"HH:mm"`
  (24-hour) always, and `formatTimeLabel()` renders them per the user's preference.
  Default is `24h`, so existing screens and stored data are unchanged.
- Never format a time inline. `parseTypedTime()` accepts `9`, `9:30`, `9.30`, `930`, and
  `7:05 pm` / `7:05 م`, and returns `null` for anything impossible rather than guessing.
- The wheel picker (`src/components/ui/TimeWheel.tsx`) is a `scroll-snap` drum with
  `aria-selected` on the centred row, and its selected row must sit exactly at the frame's
  vertical centre. `scrollTop` and the index are kept in sync both ways, under two rules
  that are easy to get wrong:
  - the sync effect must not re-scroll when the index changed *because* the drum moved, or
    it kills the fling mid-gesture;
  - a scroll we started ourselves must not report back. A smooth scroll emits events at
    every intermediate offset, and those are not values the person chose — release the
    guard on arrival at the target, never on a timer.
- jsdom has no layout, so scroll-to-index mapping cannot be unit tested. `tests/timeWheel`
  covers marking, keyboard and pointer; verify the geometry in a real browser (the drum's
  selected row must land at offset 0 from the frame's centre).

## Storage / backup rules

- localStorage is the source of truth; IndexedDB is only a recovery mirror.
- A backup is validated in full before any write, and applied all-or-nothing
  (`restoreData` rolls every key back if a write fails). Nested records and cross-entity
  references (goal <-> task/habit/book links) are checked too.
- Recovery must never let the mirror overwrite present-but-unreadable data: an invalid or
  incomplete metadata record (`nuqta_meta_v1`) is treated as "unknown", not "empty".
- Wipe clears the mirror first; if the mirror cannot be cleared, localStorage is kept so a
  later recovery cannot resurrect deleted data.

## Notifications

- Three layers, and each has exactly one job:
  - `src/lib/notificationEngine.ts` — PURE rules: dedupe, expiry, pruning, ordering,
    read state, category gating, quiet hours. Takes a list, returns a list. No React, no
    storage, no browser APIs. All notification policy belongs here.
  - `src/store/nuqtaStore.ts` — owns the array and persists it. Domain actions
    (focus complete, goal milestone, goal completed, savings target crossed) raise
    notifications here, so no component has to remember to.
  - `src/lib/notificationMessages.ts` — copy keyed by `NotificationMessageId`, so a
    message-backed row re-renders in the active language instead of freezing the
    wording at creation time. Rows without a `messageId` keep their stored text.
- Identity is `dedupeKey`, not `id`. Re-raising the same event returns the SAME list
  reference, so a 20-second reminder ticker cannot spam the inbox and a restart cannot
  re-notify something already seen. Dedupe is checked against every row still inside its
  lifetime, dismissed included: dismissing means "handled", so the reminder stays gone
  until the row expires. A new occurrence carries its own key and still fires.
- `useNuqtaReminders` builds keys that encode the occurrence
  (`task:<id>:due:<date>:<time>`), so the guard survives a reload. It never keeps an
  in-memory "already notified" set.
- Staleness is `expiresAt` (per-category default TTL), so an overdue nudge disappears on
  its own. `MAX_NOTIFICATIONS` (200) bounds the inbox; when it is hit, read rows are
  evicted before unread ones.
- `inApp` is typed as the literal `true`: the in-app inbox is not an optional channel and
  cannot be switched off. Only the browser channel is opt-in.
- Browser delivery is an ADAPTER (`deliverBrowserNotification`), not a second source of
  truth: the notification already exists in the store before it runs. Permission is
  requested only from a user gesture (the Profile settings panel), never from the ticker.
- Notifications are LOCAL-ONLY. `STORAGE_KEYS.NOTIFICATIONS` is deliberately absent from
  `SYNC_SECTION_KEYS`, because read/dismissed state is per-device and the sync server
  rejects stores outside its allow-list. Adding a notification store to the sync map would
  silently break sync.
- Adding an IndexedDB store requires bumping `DB_VERSION` in `src/lib/indexedDB.ts`;
  otherwise `onupgradeneeded` never runs on an existing install and the mirror silently
  writes nothing. `tests/notificationIndexedDB.test.ts` guards the v2 → v3 upgrade.

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

### Update lifecycle

Two caches can hide a new deploy from a returning visitor: the HTTP cache (GitHub Pages
serves `index.html` and `sw.js` with `max-age=600`) and the versioned SW shell. The rules
that keep deploys arriving without a hard refresh:

- Register with `{ updateViaCache: 'none' }` so `sw.js` is never HTTP-cached (invariant 20).
- The worker never calls `skipWaiting()` on its own; it waits for a `nuqta-skip-waiting`
  message. Navigation responses are fetched with `cache: 'no-cache'` and are never written
  to the shell cache.
- `src/lib/pwaUpdate.ts` owns all client logic: a periodic/on-focus/on-reconnect
  `registration.update()` check, and an update is applied only on an explicit user action
  (the `UpdateBanner` "Apply update"). The single `controllerchange` reload is guarded by a
  flag, and the first-ever install (no prior controller) never reloads.
- E2E proof: `scripts/e2e/update.py` serves the real build with `max-age=600`, swaps in a
  "deploy B", and asserts one ordinary reload picks it up with no reload loop. It polls via
  `page.evaluate` (not `wait_for_function(string, …)`) because the app CSP has no
  `'unsafe-eval'`.

### Multi-tab safety

`skipWaiting()` is a GLOBAL action: it activates the new worker for every client of the
origin, so `controllerchange` fires in every open tab. Three rules follow (invariant 21):

- Hiding a tab must never apply an update — `handleVisibility` only *detects* on show.
  Auto-applying on hide would activate the worker globally and reload a visible tab.
- Only the tab whose user pressed "Apply update" reloads. `handleControllerChange` gates on
  `expectsReload` (set solely by `apply()`); every other tab adopts the new controller
  silently and keeps its page and in-memory work, picking up the new build on its next
  navigation. `expectsReload` is what makes this deterministic regardless of whether this
  tab or a sibling drove activation.
- `apply()` serializes the `skipWaiting` post through a Web Locks lock
  (`nuqta-update-apply`, `ifAvailable: true`), so only one tab drives activation; absent
  Web Locks it degrades to single-tab behavior.

Old-cache deletion is deferred and bounded for the same reason. `activate` only
`clients.claim()`s. A page that has *reloaded* onto the new build posts
`nuqta-claim-cleanup`, but a reloaded tab is NOT proof that the other tabs migrated, so
`deleteObsoleteCaches` keeps `RETAINED_PREVIOUS_VERSIONS` (=1) previous version, i.e. the
current cache plus the immediately previous one. Only caches further behind are reclaimed.
The fetch handler also falls back to older NUQTA shell caches on a miss, so a tab still
running the previous build can keep lazy-loading its own assets — including offline —
(e.g. an exercise illustration) after another tab has moved on. `scripts/e2e/update-multitab.py`
proves it: build B drops an illustration that build A shipped, one tab stays on A, cleanup runs,
the browser goes offline, and the tab still loads the build-A asset from the retained cache.

Unsaved work: while an update is pending, a `beforeunload` guard warns if the app reports
in-memory work (`PwaUpdateManager.setHasUnsavedWork`); it is lifted the moment the user
applies. Note headless Chromium ignores `beforeunload`, so this is unit-tested only — the
browser-level guarantee is the stronger one: non-initiating tabs never reload at all.
`scripts/e2e/update-multitab.py` proves that too (working tab keeps `window.__work` across
another tab's apply; the applying tab reloads exactly once onto the new build).
