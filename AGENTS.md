# NUQTA — repository notes for agents

Offline-first React + Vite PWA. All user data lives in `localStorage` (source of truth)
with an IndexedDB mirror for recovery.

## Commands

- `npm run lint` — `tsc --noEmit`.
- `npm run test` — Vitest (jsdom, `TZ=Africa/Cairo` so UTC-vs-local date bugs surface).
- `npm run build` — production bundle into `dist/`.
- `npm run verify` — lint + tests + build + `scripts/check-invariants.mjs` (the acceptance gate).
- `npm run test:e2e` — builds, serves with `vite preview`, and runs the Playwright offline
  acceptance test (`scripts/e2e/run-offline.mjs` -> `scripts/e2e/offline.py`).
  Requires `pip install playwright && playwright install chromium`.
- `npm run verify:full` — `verify` + `test:e2e`.

## Invariants

`scripts/check-invariants.mjs` is the acceptance gate and exits non-zero on any violation
(12 rules). Add a rule whenever a new safety property must never regress.

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
