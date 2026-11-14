# NUQTA — Phase 3: Data Integrity & Reliability

**Date:** 2026-11-12
**Auditor role:** senior QA + reliability engineer
**Scope:** data integrity across delete/archive/recovery paths, persistence & restart safety, and
referential consistency between goals and their activities.
**Branch:** `fix/phase2-functional-findings` (shared with Phase 2; no new branch).

This report records what was **verified**, what **failed**, and the **evidence** for each claim, plus
the fixes applied on the same branch.

---

## 1. Method and evidence

1. **Automated, store-level workflows** — `tests/audit-reliability.test.ts` (17 cases). They drive the
   real Zustand store and the real storage engine (no mocks) and assert persistence into
   `localStorage` / the IndexedDB mirror.
2. **Targeted probes** — each suspected defect was first reproduced with a failing probe against the
   unmodified code, then fixed, then locked in as a regression test.
3. **Backup validator cross-check** — because the strict backup validator rejects dangling
   cross-entity references, a corrupted link graph is observable as a failed export/import round-trip.

Commands:

```bash
npm run verify   # lint + tests + build + 12 invariants — PASS
npm run verify:full   # + Playwright offline e2e gate — PASS
```

---

## 2. Executive summary

Persistence, restart recovery, backup/restore and the wipe flow were already well-defended (mirror
recovery, quarantine of corrupt values, atomic all-or-nothing restore, metadata validation). The
weak point was **referential integrity on the delete paths**: deleting a goal, habit, book, art
project or task removed the record but left dangling references behind — both in the deleted entity's
*own* relation lists and in *nested* studio records that had copied a parent's goal id. Five such
defects were confirmed and fixed; the fix is a pair of small, shared helpers applied to every delete
path.

---

## 3. Findings

| ID | Severity | Location | Trigger | Expected | Status |
|----|----------|----------|---------|----------|--------|
| D1 | Medium | `nuqtaStore.ts` (`deleteGoal`) | Delete a goal linked to a reading/drawing habit | Nested records stop pointing at the deleted goal | Fixed |
| D2 | Medium | `nuqtaStore.ts` (`deleteBook`, `deleteArtProject`, `deleteHabit`) | Delete a book / art project / habit that a goal links | The goal's relation lists drop the removed ids | Fixed |
| D3 | Low | `nuqtaStore.ts` (`deleteArtProject`) | Delete an art project that has logged pieces | Pieces stop pointing at the deleted project | Fixed |
| D4 | Low | `nuqtaStore.ts` (`deleteBook`) | Delete the active book | `activeBookId` resolves to a surviving book | Already correct (guarded) |
| D5 | — | storage + store | Restart / reload | State round-trips unchanged | Verified pass |

### D1 — `deleteGoal` left nested studio links dangling (Medium)

`deleteGoal` cleared `linkedGoalId` on top-level tasks and habits only. But books, reading sessions,
artwork pieces, art projects and Quran/workout sessions each carry their **own** `linkedGoalId`
(copied from the parent habit when the record is created). Deleting the goal left those nested
references pointing at a goal that no longer existed.

Evidence — probe "nested studio records keep a linkedGoalId that points at a deleted goal":
after `deleteGoal`, `readingData.books[0].linkedGoalId` and `readingData.sessions[0].linkedGoalId`
were still the deleted id.

**Fix.** `clearNestedGoalLinks(habits, goalId)` sweeps every nested studio record; `deleteGoal` now
applies it (after the top-level `clear`) before saving.

### D2 — deleting a linked sub-record left the goal's relation list dangling (Medium)

`goal.linkedBookIds` / `goal.linkedArtProjectIds` are explicit user links stored on the goal itself.
`deleteBook` and `deleteArtProject` removed the record from the habit but never pruned these lists, so
the goal kept pointing at a book or project that no longer existed. `deleteHabit` had the same gap for
the books/projects nested inside the deleted habit.

Evidence — probes "deleting a book leaves goal.linkedBookIds pointing at a missing book", "deleting an
art project leaves goal.linkedArtProjectIds pointing at a missing project", "deleting a reading habit
leaves goal.linkedBookIds pointing at its books".

**Fix.** `pruneGoalRelationIds(goals, removed)` drops the given ids from all four relation lists and
is applied by `deleteTask`, `deleteHabit`, `deleteBook` and `deleteArtProject`.

### D3 — deleting an art project orphaned its pieces (Low)

Pieces logged against a project carry `projectId`. `deleteArtProject` removed the project but left the
pieces pointing at it. The goal-progress engine reads `piece.projectId`, so a stale id is a dangling
reference.

Evidence — probe "deleting an art project leaves its artwork pieces orphaned".

**Fix.** `deleteArtProject` clears `projectId` on the project's pieces (they become standalone
pieces) in the same pass.

### D4 — deleting the active book re-points `activeBookId` (already correct)

`deleteBook` already re-points `activeBookId` at the first remaining book. Retained as a regression
guard.

### D5 — restart / reload integrity (verified pass)

- A created task survives a simulated reload (`initializeStore` re-hydrates from `localStorage`).
- A pruned goal link stays pruned after a reload (both store state and persisted goals).
- After the delete sweep, `exportFullBackup()` passes `validateBackup()` — i.e. the repaired graph has
  **no dangling cross-entity references**.

---

## 4. Regression evidence

`tests/audit-reliability.test.ts` (17 cases), grouped:

- **D1** — `deleteGoal` clears nested links (books + reading sessions; art projects + pieces;
  workout sessions; leaves unrelated goals/activities untouched).
- **D2** — deleting a book / art project / habit / task prunes the goal relation lists.
- **D3** — deleting a parent clears its children's parent references (pieces' `projectId`;
  `activeBookId`).
- **D4** — persistence survives a reload, including the pruned links, and a clean export validates.
- **D5** — archive/restore round-trips never duplicate or corrupt (task and goal).
- **D6** — denormalised aggregates recompute on deletion (reading pages/minutes; drawing
  sketches/minutes).

---

## 5. What was verified as already sound

- **Mirror recovery** is conservative: it never overwrites live `localStorage` data on a corrupt or
  missing metadata record, and only restores when `localStorage` is genuinely empty of NUQTA keys.
- **Wipe** clears the mirror first (so a stale mirror cannot resurrect deleted data) and only touches
  `nuqta_`-prefixed keys.
- **Backup restore** validates the whole file first and writes all-or-nothing with rollback.
- **Corrupt values** are quarantined (`*__corrupt_<ts>`) rather than overwritten.
- **Health data** is never invented; an empty day scores from tasks alone.
