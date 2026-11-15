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
(14 rules). Add a rule whenever a new safety property must never regress.

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

## Service worker

`public/sw.js` precaches ONLY the discovered shell assets (index.html + its same-origin
script/link assets). The cache name is versioned (`nuqta-shell-v<N>`) — bump
`CACHE_VERSION` on every change. The fetch handler never writes to the cache, so dynamic
requests and user data are never stored, and only NUQTA-owned caches are ever deleted.
