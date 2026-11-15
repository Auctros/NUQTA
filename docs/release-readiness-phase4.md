# NUQTA — Phase 4 Release Readiness

**Date:** 2026-11-12
**Branch:** `fix/phase2-functional-findings` (cumulative; no new branch)
**Role:** senior QA + reliability engineer

NUQTA is an offline-first React 19 + Vite PWA. `localStorage` is the source of truth and
IndexedDB is a mirror. Phase 4 is the pre-release sweep: does the *shipped* build install,
run, render, and recover the way a real user needs it to?

## Gate status

| Command | Result |
|---------|--------|
| `npm run lint` (`tsc --noEmit`) | Pass |
| `npm run test` (Vitest, jsdom, `TZ=Africa/Cairo`) | Pass — 16 files / 286 tests |
| `npm run build` | Pass |
| `node scripts/check-invariants.mjs` | Pass — 14 rules |
| `npm run test:e2e` (Playwright) | Pass — `OFFLINE PASS` and `VIEWS PASS` |

`npm run test:e2e` runs two browser-level scripts against the production build:
`scripts/e2e/offline.py` (offline shell) and `scripts/e2e/views.py` (every view +
responsive + RTL). `npm run verify:full` runs all of the above end to end and is green.

## 1. PWA / install / manifest / service worker

Verified against the production build served by `vite preview`:

- `manifest.webmanifest` is served, is valid JSON, and has `name`, `start_url` and a
  non-empty `icons` array. Both icons exist and are the right size (`icon-192.png` is
  192×192, `icon-512.png` is 512×512, both `any maskable`).
- The manifest is referenced from `index.html` and is **precached** by the service worker.
- `sw.js` registers only in production and only over a secure context. Its cache is
  versioned (`nuqta-shell-v3`).
- Lifecycle is correct: `install` precaches the discovered shell and calls `skipWaiting()`;
  `activate` deletes **only** obsolete `nuqta-shell-*` caches and calls `clients.claim()`.
- Isolation holds: every cached entry is a same-origin shell asset; no `data:`/`blob:`,
  no API responses, no third-party origin. The fetch handler never writes to the cache.

## 2. Offline reliability

The browser-level gate (`scripts/e2e/offline.py`) drives the real first-visit sequence on a
single online load, disconnects the network **without reloading while online**, then
reloads offline. Result:

- 160 shell assets cached (index, hashed JS, CSS, manifest, fonts, icons).
- Offline reload renders the full app (`offline_body_len` 3864, React root populated, nav
  present).
- Zero console/page errors online **and** offline.

The precache from the first visit is sufficient on its own — no priming reload is needed.

## 3. Responsive layout

Measured in Chromium by `scripts/e2e/views.py` at four widths. No horizontal overflow
at any of them (`scrollWidth <= clientWidth + 2`):

| Width | Horizontal overflow | Notes |
|-------|--------------------|-------|
| 1440 | No | Full sidebar |
| 1280 | No | Full sidebar |
| 768 | No | Collapsed/overlay sidebar |
| 390 | No | Mobile overlay sidebar |

Mobile navigation was exercised end to end at 390 px: the sidebar is off-canvas, the
header toggle opens it, tapping a destination navigates **and** closes it, and the page
still does not overflow.

### Fix: page headings overflowed the viewport between 661–1150 px

A committed sweep of every view across 14 widths (360–1440) found **11 horizontal-overflow
cases** that the earlier manual pass had missed. The dominant cause: `.heading-actions`
was declared with `flex-shrink: 0` and only wrapped below 660 px, so a wide action row
(e.g. the Insights view switcher) pushed the document past the viewport edge in the
661–1150 px band. Two narrower cases were inner flex rows that did not wrap
(`ArchiveHistoryView` tab group, `DashboardView` agenda segmented control).

Fixed by letting `.page-heading` and `.heading-actions` wrap and shrink, and adding
`flex-wrap` to the two inner rows. Re-run of the same sweep: **0 overflow cases**. The
sweep now lives in `scripts/e2e/views.py`, so a regression fails the gate.

## 4. Performance

- Navigation timing on the preview build: TTFB ~4 ms, DOMContentLoaded ~113 ms.
- The production shell is small and text-compressible: `index.html` ~1.2 KB; the single JS
  chunk is ~1.04 MB raw / **~253 KB gzip**; CSS ~262 KB raw / **~67 KB gzip**.

**Finding (informational, not a release blocker).** Vite warns that the JS chunk exceeds
500 KB. This is the entire app in one chunk. Deliberately **not** split: the service worker
precaches exactly the assets referenced by `index.html`, so code-splitting into lazily
imported chunks would leave those chunks uncached and break the offline promise unless the
precache strategy were reworked. The gzip size is acceptable for a local-first app whose
entire payload is downloaded once and then served from cache. Left as a post-release
optimization with that constraint documented here.

## 5. Runtime reliability

Every one of the 15 navigable views is opened in the production build by
`scripts/e2e/views.py` (plus the 3 command-palette-only destinations reachable in the same
sidebar markup):

Overview, Tasks, Habits, Goals, Focus, Calendar, Quran Studio, Reading Vault, Home Workout,
Art Studio, Archive & History, Money, Health, Journal, Insights.

All render real content, and the run produces **zero console errors and zero page errors**.
The same script also opens every view under the Arabic/RTL context (`locale=ar-EG`), asserts
the shell flips to `dir="rtl"`, and confirms **no view overflows or errors** in RTL.

### Fix: a render crash can no longer white-screen the app

There was no React error boundary, so a single unexpected render error would blank the
whole UI — leaving the user's data intact in `localStorage` but unreachable, with no way to
export it. Added `src/components/ErrorBoundary.tsx`, wrapping `<App />` in `src/main.tsx`.
On a crash it shows a bilingual recovery screen with **Export backup** (writes the full
backup via the existing `downloadBackupFile`) and **Reload**. The message is static and
does not touch the store, so it works even if hydration itself failed.

Locked in by invariant 13 (App is wrapped; component exists) and a jsdom test that throws
inside a child and asserts the recovery UI appears.

## 6. Security & privacy baseline

- `index.html` sets a strict `Content-Security-Policy`: `default-src 'self'`, no
  third-party origins, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- No `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, or
  `navigator.geolocation` on any non-comment line of any `.ts`/`.tsx` file under `src/`.
  This is invariant 14, so a future change cannot silently add one of those primitives.
  **Scope of the guarantee (exact):** the rule is a textual scan of first-party
  `src/` TypeScript only. It does not scan `index.html`, `public/`, `scripts/`, tests,
  CSS `url()` references, bundled output, or dependencies, and it cannot see network
  reached indirectly (dynamic `import()`, a URL assigned to an `<img>`/`<a>`/`<script>`
  `src`, `navigator.serviceWorker.register`, or a same-origin relative path). It proves
  the absence of the listed primitives in first-party source — not the absence of all
  network access. It is the strongest check that is practical without runtime traffic
  inspection.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or `document.write`.
- No `target="_blank"` links (so no reverse-tabnabbing surface).
- Storage is namespaced under the `nuqta_` prefix; `localStorage.clear()` is already
  forbidden by invariant 2.

## 7. Release-readiness findings summary

| ID | Severity | Area | Finding | Action |
|----|----------|------|---------|--------|
| R1 | Medium | Runtime reliability | No error boundary: any render crash white-screened the app with no data-export path | Fixed — `ErrorBoundary` + test + invariant 13 |
| R2 | Low | Privacy hardening | The "no network" guarantee was convention only | Fixed — invariant 14 blocks the listed network primitives in first-party `src/` (scope documented) |
| R3 | Info | Performance | Single 1.04 MB JS chunk (253 KB gzip) | Accepted; code-splitting would break the precache strategy — deferred post-release |
| R4 | Medium | Responsive layout | Page headings overflowed the viewport in the 661–1150 px band (11 view×width cases) | Fixed — `.page-heading`/`.heading-actions` now wrap; regression swept by `views.py` |
| R5 | Low | Dead code / deps | `SettingsModal.tsx` was unreferenced and the only consumer of `lucide-react`, masking an unused dependency | Fixed — removed both; invariant 8 stays truthful |
| R6 | Low | Accessibility | Three icon-only `+` buttons in the Sunday Ritual modal had no accessible name | Fixed — bilingual `aria-label`s added |
| R7 | Low | Docs accuracy | Release doc said 285 tests (stale) and stated unverifiable responsive/RTL claims | Fixed — count is 286; responsive and RTL claims are now produced by committed scripts |

No release blockers remain. The offline install path, all views, the responsive
breakpoints, the RTL layout, and the privacy boundary are verified against the production
build by committed, re-runnable scripts.
