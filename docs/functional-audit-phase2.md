# NUQTA — Phase 2: End-to-End Functional Audit

**Date:** 2026-11-12
**Auditor role:** senior QA + product-minded engineer
**Scope:** correctness of real user workflows and module interactions (audit only — no redesign or refactor)
**Branch:** `fix/final-engineering-corrections`

This report records what was **verified**, what **fails**, and the **evidence** for each claim. It is
not a change request: every item below is either a confirmed pass or a defect to be scheduled.

---

## 1. Method and evidence

Two independent evidence streams were used; a finding is only reported when it is reproducible.

1. **Automated, store-level workflows** — `tests/audit-functional.test.ts` (50 cases). These drive the
   real Zustand store and the real engines (no mocks) and assert persistence into `localStorage`.
2. **Live UI walkthrough** — the running dev server (`vite --port=3000`) was driven in a browser:
   Quick Capture, Tasks, Reading Sanctuary, Dashboard/Overview.

Commands:

```bash
npm run test            # full suite (234 tests, 11 files) — green
npx vitest run tests/audit-functional.test.ts   # this audit — 50/50 green
npm run verify          # lint + tests + build + 12 invariants — PASS
```

Findings marked **AUDIT FINDING** are asserted against the *current* (buggy) behaviour, so the suite
stays green while pinning the defect. Each such test is named `AUDIT FINDING: …`.

---

## 2. Executive summary

The core execution loop is sound and well-defended: task CRUD, persistence, the Top-3 guard, NLP
capture, goal↔activity linking (single source of truth, no double counting), archive/restore, and the
insights engine all behave correctly.

Four defect classes were confirmed, in priority order:

| # | Severity | Area | One-line summary |
|---|----------|------|------------------|
| F1 | **High (trust)** | Studios | Creating a specialised habit **fabricates studio history** (fake pages, minutes, sessions, completed books). |
| F2 | **Medium (data drift)** | Studios | Delete paths remove the record but leave **stale aggregate totals** (pages, minutes, ayahs). |
| F3 | **Medium (correctness)** | Habits | `toggleHabitToday` streak is a naive ±1 that **ignores the calendar**; a broken streak keeps growing. |
| F4 | **Low (latent)** | Quran | `logQuranSession` **silently ignores** a memorisation for a surah not present in `quranData.surahs`. |

---

## 3. Section A — Tasks (PASS, with notes)

| Workflow | Verdict | Evidence |
|---|---|---|
| Create / edit (title, notes, priority, date, time, minutes, tags, Top-3, goal link) | **PASS** | `tests/audit-functional.test.ts` › "create -> edit -> complete -> reopen -> delete keeps storage in sync"; UI: Quick Capture → Tasks list showed `2026-11-15 · 14:00 · 45 min · #dev · Q1` |
| Complete / reopen | **PASS** | same test; reopen clears `completedAt` and reverts to `todo` |
| Delete + storage sync | **PASS** | same test; `deleteTask` also strips the id from every goal's `linkedTaskIds` (`nuqtaStore.ts:408`) |
| Top-3 cap (max 3 active) | **PASS** | "a task can hold at most 3 Top-Three slots" — 4th pin refused with the overload message |
| Completing a pinned task frees a slot | **PASS** | guard counts `isTopThree && status !== 'completed'` (`nuqtaStore.ts:387`) |
| Subtasks add/toggle; blank title ignored | **PASS** | "subtasks toggle and accumulate" |
| Smart reschedule (only listed tasks move) | **PASS** | "smartBatchReschedule moves only the listed tasks" |
| Overdue detection & sorting (due, then time) | **PASS** | `TasksView.tsx:60`, `:160` — overdue = `todo` + `scheduledDate < today` |
| **Note (N1, cosmetic)** — sorting by priority uses numeric ascending `a.priority - b.priority`, so P1 ranks first (correct). However `priorityMeta` (`TasksView.tsx:168`) gives P2 `dotClass: 'low'` while P3 gets `'medium'`, so the priority-dot severity is non-monotonic (P1 high → P2 low → P3 medium → P4 normal). Cosmetic only; no data impact. |

---

## 4. Section B — Habits (one finding)

| Workflow | Verdict | Evidence |
|---|---|---|
| Toggle today on/off updates dates + streak | **PASS** | "toggle habit marks/unmarks today and adjusts the streak" |
| Due-day logic (daily / weekdays / custom / freezes) | **PASS** | `habitSchedule.isHabitDueOn`; "habitCompliance only counts due days", "a streak freeze suppresses a due day" |
| Studio habit creation seeds sample content | **FAIL (F1)** | see §5 |
| **Streak correctness** | **FAIL (F3)** | see below |

**F3 — `toggleHabitToday` streak ignores the calendar.**
`nuqtaStore.ts:460-472` does `currentStreak + 1` on any new completion and `- 1` on un-toggle; it never
checks whether yesterday was completed.

```ts
const currentStreak = alreadyDone
  ? Math.max(0, habit.currentStreak - 1)
  : habit.currentStreak + 1;   // nuqtaStore.ts:470-472
```

Evidence — "AUDIT FINDING: streak is not recomputed from history, so a missed day is invisible":
a habit whose last completion was 3 days ago, with a stored `currentStreak` of 5, becomes **6** after
completing today. The true streak is 1. `longestStreak` is likewise never reset, so a broken streak
keeps growing and consistency-style stats drift upward.

---

## 5. Section F — Specialised studios (two findings)

### F1 — Creating a specialised habit fabricates history (High)

`createHabit` (`nuqtaStore.ts:512-910`) does not merely create a container; when
`specializedType` is `reading`/`workout`/`drawing`/`quran` and no studio data is supplied, it injects
**fabricated** content:

- Reading: `totalPagesRead: 545`, `totalReadingMinutes: 780`, three books (one already `completed`),
  2 quotes and a logged session dated today (`nuqtaStore.ts:528-536` region).
- Workout: `totalReps: 320`, `totalMinutes: 140`, `totalWorkouts: 4` plus a completed session today.
- Drawing: `totalDrawingMinutes: 240`, `totalSketches: 5`, sample projects/pieces.
- Quran: seeds 7 memorised surahs and two sessions (`generateInitialQuranSurahs`, `quranData.ts:186`).

Evidence — "AUDIT FINDING: creating a specialised habit fabricates studio history": a brand-new
reading habit immediately reports `totalPagesRead === 545`, `totalReadingMinutes === 780`, non-empty
`sessions` and `books`.

Live UI confirmation — clicking **Enable Reading Sanctuary** (`ReadingView.tsx:149` →
`createHabit({ specializedType: 'reading' })`) rendered, with no user input:

> Pages Read **545** · ~13 reading hours · Finished Books **1**/24 · Read Today **20**/20p ·
> Average Pace **43** p/hr · Quote Sanctuary **2** quotes — plus a session "2026-11-14 · 20 pages · 28m".

**Impact:** the very first screen of a new studio reports data the user never entered. It corrupts the
trust model ("your data stays on this device" ⇒ the numbers must be yours), inflates the Dashboard's
cross-domain "active time", and pollutes the goal/insights engines.

**Note:** first-run demo data (`loadDemoData`) is legitimate; the problem is specifically that the
*ordinary create path* fabricates data rather than starting empty.

### F2 — Delete paths leave stale aggregates (Medium)

Deleting a sub-record removes it from the array but does **not** recompute the denormalised totals that
the dashboards read. Confirmed for three studios:

| Action | Removes record | Recomputes totals | Evidence |
|---|---|---|---|
| `deleteBook` (`nuqtaStore.ts:1057`) | yes | **no** — `totalPagesRead` unchanged | "AUDIT FINDING: deleting a book does not reduce readingData.totalPagesRead" |
| `deleteArtworkPiece` (`nuqtaStore.ts:1343`) | yes (fixes `totalSketches`) | **no** — `totalDrawingMinutes` unchanged | "AUDIT FINDING: deleting an artwork piece does not reduce drawingData.totalDrawingMinutes" |
| `deleteQuranSession` (`nuqtaStore.ts:1572`) | yes | **no** — `totalAyahsMemorized` unchanged | "AUDIT FINDING: deleting a quran session does not recompute memorised totals" |

**Impact:** lifetime totals and derived averages (reading pace, drawing hours) over-report forever
after any deletion. Note the asymmetry: `deleteArtworkPiece` *does* refresh `totalSketches` but not
`totalDrawingMinutes` — evidence the omission is accidental, not a design choice.

### F4 — Quran: memorisation silently dropped for an unknown surah (Low / latent)

`logQuranSession` only updates `updatedSurahs[existingSurahIdx]` when the surah already exists in
`quranData.surahs` (`nuqtaStore.ts:1466-1480`). If it is absent, the session is stored but the surah
state is never created, so `totalAyahsMemorized` stays 0.

Evidence — "AUDIT FINDING (latent): a memorisation session for a surah missing from quranData.surahs
is silently ignored": `sessions.length === 1` but `totalAyahsMemorized === 0`.

**Reachability:** normally `createHabit` seeds all 114 surahs, so this is not hit in the default flow;
it becomes reachable for a Quran habit created without seeded surahs (e.g. via restore/import or a
future code path). Latent, but a silent data-loss trap.

---

## 6. Sections C–E, G–J — verified passes

| Area | Verdict | Key evidence |
|---|---|---|
| **C. Goals** — `tasks_completed` KR tracks linked tasks; reopen lowers progress; delete removes contribution | **PASS** | "tasks_completed key result tracks linked tasks", "reopening a completed task lowers goal progress again" |
| **C.** No double counting; one task ↔ one goal (single source of truth) | **PASS** | "no double counting when a task is linked to two goals"; re-linking moves the link |
| **C.** Outcome (KRs) separated from execution (tasks+habits); overall follows outcome | **PASS** | "outcome (Key Results) is distinguished from execution" — manual KR 10% vs execution 100% |
| **C.** Milestones drive outcome when there are no KRs | **PASS** | "milestone progress drives outcome" — 50% |
| **C.** Link/unlink never deletes the entity; back-reference stored; deleteGoal clears dangling links | **PASS** | "linking an activity to a goal…", "unlinking clears the relation…", "deleteGoal clears dangling task/habit links" |
| **C.** `reading_pages_read` uses linked books, not the habit aggregate | **PASS** | "reading_pages_read uses the linked books when specific books are linked" |
| **C.** Habit consistency respects the schedule (4-day habit = 100%, not ~29%) | **PASS** | `tests/goalEngine.test.ts` |
| **D. Quick Capture** — NLP parses title/priority/date/time/duration/tags/energy | **PASS** | "NLP parses title, priority, date, time, duration, tags and energy"; UI live preview showed `45m · P1 · #dev` |
| **D.** Captured input persists as a real task | **PASS** | "captured input becomes a real task"; UI Tasks list confirmed |
| **D.** Rescue Mode pins the anchor and defers the rest to tomorrow | **PASS** | "Rescue Mode pins the anchor task and defers the rest to tomorrow" |
| **E. Focus** — session recorded, XP awarded, persisted | **PASS** | "logging a focus session records it and awards XP" |
| **F.** Reading session advances the book page, marks habit done, marks book completed at the last page | **PASS** | "reading: logging a session…", "reading: finishing the last page…" |
| **F.** Drawing session adds a piece + minutes and marks the habit done | **PASS** | "drawing: logging a piece…" |
| **F.** Workout session updates totals and syncs Today Health | **PASS** | "workout: logging a session updates totals and syncs Today Health" |
| **F.** Quran ranges merge without double counting (1-3 ∪ 2-5 = 5) | **PASS** | "quran: a memorisation session records distinct ayahs without double counting" |
| **G. Archive** — archiving hides from active use and lists in the archive | **PASS** | "archiving a task hides it from active use…" |
| **G.** Restore returns the right status (incomplete→todo, completed→completed, goal→active) | **PASS** | three dedicated tests; `restoreTask` uses `completedAt` (`nuqtaStore.ts:1993`) |
| **G.** Archive/restore writes an audit entry | **PASS** | "archiving/restoring logs an audit entry" (`archived`, `restored`) |
| **G. Note** — a task archived while pinned keeps `isTopThree = true` and re-occupies a slot on restore | **Observation** | "AUDIT FINDING: restoring an archived task does not restore a stale Top-Three slot cleanly" — debatable by design, not a hard bug |
| **H. Insights** — empty state is truly zero; real tasks/habits flow through | **PASS** | "life intelligence reflects real tasks/habits rather than invented values" |
| **H.** A studio session appears in cross-domain active time | **PASS** | "a studio session shows up in cross-domain active time" (30 min logged → 30 min reported, on controlled data) |
| **I. Finance** — expense add/delete; savings accumulate | **PASS** | "expenses add and delete", "savings goals accumulate" |
| **I. Health** — hydration accumulates into today's record | **PASS** | "hydration accumulates into today's health record" |
| **I. Journal** — entry saves and persists | **PASS** | "journal entries save and persist" |
| **J. Settings** — nav switching, name/theme persist | **PASS** | "nav tab switching and profile updates persist" |
| **Cross-module journey** — goal → link task+habit → complete → progress, history and dashboard all agree | **PASS** | "goal -> link task+habit -> complete -> progress, history and dashboard all agree" |

---

## 7. Findings register

| ID | Severity | Location | Reproduction | Expected |
|----|----------|----------|--------------|----------|
| F1 | High | `nuqtaStore.ts:512-910` (`createHabit`), `quranData.ts:186` | Create a specialised habit (UI: Enable Reading Sanctuary) | New studio starts empty (or the seeded content is explicitly labelled as sample) |
| F2 | Medium | `nuqtaStore.ts:1057`, `:1343`, `:1572` | Log a session, then delete the record | Totals recompute from remaining records |
| F3 | Medium | `nuqtaStore.ts:460-472` (`toggleHabitToday`) | Complete after a missed day | Streak restarts at 1 when yesterday was not completed |
| F4 | Low | `nuqtaStore.ts:1466-1480` (`logQuranSession`) | Log a memorisation for a surah absent from `surahs` | Create the surah state and count the ayahs |
| N1 | Cosmetic | `TasksView.tsx:168` | Inspect P2/P3 tag colours | Tag colour matches the quadrant |

---

## 8. Recommendations (for a later, separately-scoped change)

1. **F1 first** — it is the only finding that actively misleads the user about their own data. Either
   start specialised studios empty, or gate the sample content behind the existing demo/sample action
   so it is never injected by the ordinary create path.
2. **F2** — recompute denormalised totals from the record arrays on every delete, or stop
   denormalising and derive totals at read time.
3. **F3** — derive `currentStreak` from `completedDates` (respecting `isHabitDueOn` and freezes)
   instead of incrementing a counter.
4. **F4** — upsert the surah state when the session targets a surah not yet tracked.
5. Keep the four `AUDIT FINDING` tests as regression pins; flip their expectations when the fixes land.

---

## 9. Caveats

- The audit used the app's real store and engines; no mocks. Dates were frozen to
  `2026-11-11T10:00:00Z` (TZ `Africa/Cairo`).
- Studio tests that assert *user-entered* behaviour seed an explicitly empty studio record, so they
  measure real actions rather than the F1 fabrication.
- The browser walkthrough covered Quick Capture → Tasks and Reading Sanctuary → Overview; it is
  corroborating evidence, not exhaustive UI coverage.
