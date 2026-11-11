<div align="center">

<br />

# NUQTA · نقطة

### One life. Live it wisely.

**A local-first life operating system** — tasks, habits, OKR goals, deep work, health, finances, and reflection, unified in one calm, private workspace.

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Local-first](https://img.shields.io/badge/Local--first-offline_capable-2ea44f?style=flat-square)
![Tests](https://img.shields.io/badge/quality_gate-npm_run_verify-0a7ea4?style=flat-square)
![Bilingual](https://img.shields.io/badge/EN_%7C_AR-RTL_ready-8957e5?style=flat-square)

[Overview](#overview) · [Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Privacy](#privacy--data-ownership) · [Shortcuts](#keyboard-shortcuts) · [العربية](#بالعربي)

<br />

</div>

---

## Overview

Most productivity tools split your life across a dozen apps and ask you to trust a server with the most personal data you own. **NUQTA** takes the opposite approach: one workspace for the whole person, and everything stays on your device.

It connects what you *do* (tasks, habits, focus sessions) to what you *want* (goals and key results) and to how you *feel* (sleep, energy, mood), then turns that into insight instead of just another checklist.

| Principle | What it means |
|---|---|
| **Local-first** | No account, no backend, no API key. Your data lives in your browser. |
| **Holistic** | Work, health, money, faith, learning, and creativity in a single model. |
| **Calm by design** | Built-in Rescue Mode and weekly ritual to reduce overwhelm rather than add pressure. |
| **Yours to keep** | One-click backup and restore. No lock-in. |

---

## Features

### Plan & Execute
- **Smart tasks** — priorities, subtasks, scheduling, a focused *Top Three* for the day, and smart batch rescheduling.
- **Natural-language capture** — type a task the way you'd say it; NUQTA parses it into a structured task.
- **Calendar view** — see scheduled work and commitments across days.
- **Deep Work focus mode** — timed sessions measured against a daily deep-work target.

### Build Habits
- **Atomic habits** with streak tracking and **streak freezes** for the days life gets in the way.
- **Dedicated habit apps** with their own tracking and history:
  - **Quran** — progress across surahs and ayah ranges.
  - **Reading** — books, sessions, pages, and quotes with daily, weekly, and annual targets.
  - **Workout** — sessions and reps.
  - **Drawing** — a creative practice space.

### Steer with Goals
- **OKR goals** with key results, milestones, and target dates.
- **Live-linked key results** — progress can be driven automatically by tasks completed, habit consistency, pages read, books finished, reading hours, workout sessions, and more, or tracked manually.

### Understand Yourself
- **Health** — sleep, hydration, workouts, mood, weight, and a computed daily **energy score**.
- **Finance** — expenses and savings goals.
- **Journal** — private daily reflection.
- **Insights** — life-intelligence charts that connect behaviour, energy, and outcomes.
- **What-If Simulator** — explore how changing your habits could change your results.
- **Archive & History** — a full audit trail of what changed and when.

### Stay Balanced
- **Sunday Ritual** — a guided weekly review to close the week and set the next one.
- **Rescue Mode** — when everything piles up, reset the day around a single anchor task and defer the rest, without guilt.
- **Reminders** — scheduled notifications for tasks and habits.

### Built for Everyone
- **English and Arabic**, with full **RTL** support.
- **Light and dark** themes.
- **Installable PWA** — after the first visit the app shell is cached and works offline.
- **Optional sample data** — a first run is genuinely empty; sample data loads only when you ask for it in Settings.
- **Command palette** and **global search** for keyboard-first navigation.

---

## Quick Start

**Requirements:** Node.js 20.19 or later.

```bash
# 1. Clone
git clone https://github.com/Auctros/NUQTA.git
cd NUQTA

# 2. Install
npm install

# 3. Run
npm run dev
```

Open **http://localhost:3000**. No environment variables or API keys are required.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check the project with TypeScript |
| `npm test` | Run the unit and integration tests (in a UTC+2 time zone, on purpose) |
| `npm run verify` | **Full quality gate**: type-check, tests, production build, project invariants |
| `npm run clean` | Remove build output |

---

## Architecture

```
NUQTA/
├── src/
│   ├── App.tsx                  # Shell, navigation, global hotkeys
│   ├── store/nuqtaStore.ts      # Zustand store: state and domain actions
│   ├── lib/
│   │   ├── storage.ts           # Persistence engine (source of truth + mirror + recovery)
│   │   ├── indexedDB.ts         # IndexedDB mirror
│   │   ├── backupSchema.ts      # Versioned backup format and strict validation
│   │   ├── backupActions.ts     # Download / confirm / safe-restore flow
│   │   ├── dateKey.ts           # Local calendar-day helpers (never UTC)
│   │   ├── habitSchedule.ts     # Which days a habit is actually due
│   │   ├── reminderTiming.ts    # Catch-up window for reminders
│   │   ├── healthDefaults.ts    # "Nothing logged" health record
│   │   ├── demoData.ts          # Optional sample data (opt-in only)
│   │   ├── nlpParser.ts · energyAlgorithm.ts · goalProgressEngine.ts
│   │   ├── lifeIntelligenceEngine.ts · universalHistoryEngine.ts
│   │   └── crypto.ts            # AES-GCM / PBKDF2 primitives (not yet applied to storage)
│   ├── components/              # Views, modals, charts, shared UI kit
│   └── types/                   # Domain models
├── tests/                       # Vitest suites
├── scripts/check-invariants.mjs # Project-wide acceptance rules
└── public/                      # PWA manifest, service worker, icons
```

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand · Vitest.

**Persistence model.**
- `localStorage` is the single **source of truth**, read synchronously for the first render. Reads never write and never invent data.
- `IndexedDB` is an exact **mirror**: every save replaces the mirror's store, so deletions propagate. If `localStorage` is lost but the mirror survives, NUQTA restores from it at startup. A deliberate wipe clears both, so it is never undone.
- Unreadable data is **quarantined** (`*__corrupt_<time>`) instead of being overwritten, and a banner tells you when a save fails (for example, storage is full).

**Backups.** Files are versioned (`{ app, version, data }`) and validated completely before anything is written. Restore asks for confirmation, downloads a safety copy of your current data first, and writes all-or-nothing with rollback. Older flat backups are still accepted.

**Calendar days vs instants.** Calendar days (`2026-11-11`) are always the user's **local** day; timestamps are UTC ISO strings. This keeps habits, reminders, and the calendar correct around local midnight in any time zone.

**Goals.** A task or habit belongs to **at most one goal**, and its own `linkedGoalId` is the single source of truth. Habit consistency counts only the days a habit was actually due (daily, weekdays, or custom days), and regular habit completions count as goal activity.

---

## Privacy & Data Ownership

- **No server, no accounts, no analytics.** NUQTA has no backend and calls no external APIs.
- **No third-party requests.** Fonts are self-hosted, so loading the app does not contact Google or any CDN.
- **Full portability.** Export a versioned JSON backup from **Settings** and restore it at any time.
- **Honest about encryption.** Data is stored **unencrypted** in your browser profile, protected by your device and browser account. Client-side AES-GCM-256 / PBKDF2 primitives exist in `src/lib/crypto.ts` but are not applied yet, so NUQTA does not claim encrypted storage.
- **Complete wipe.** "Delete all data" clears NUQTA's keys in both `localStorage` and `IndexedDB`, and leaves other sites' data alone.

> Your browser profile is your database. Export a backup regularly, especially before clearing site data or switching devices.

---

## Quality Gate

Every change must pass one command:

```bash
npm run verify
```

It runs, in order: **type-check → tests → production build → project invariants.** The invariants (`scripts/check-invariants.mjs`) fail the build if the code reintroduces UTC date keys, `localStorage.clear()`, automatic demo data, invented personal defaults, weak ids, third-party network resources, encryption claims without encryption, unused dependencies, multiple lockfiles, or a build without the offline shell. The tests run in the `Africa/Cairo` time zone so local-midnight bugs cannot hide.

Optional real-browser checks (Playwright for Python) live in `scripts/e2e/`: they verify on the production build that no third-party request is made, the offline shell works, and backup restore / full wipe behave correctly.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Q` | Jump to quick capture and add a task |
| `Ctrl / ⌘` + `K` | Open the command palette |
| `Ctrl / ⌘` + `Shift` + `F` | Open global search |
| `Esc` | Close the sidebar |

---

## بالعربي

**نقطة (NUQTA)** نظام تشغيل شخصي لحياتك، يعمل بالكامل على جهازك بدون حساب أو سيرفر أو مفتاح API.

مهامك وعاداتك وأهدافك (OKR) وتركيزك وصحتك وماليتك ويومياتك في مساحة واحدة هادئة، مع واجهة عربية كاملة تدعم الاتجاه من اليمين لليسار.

**أهم المميزات**
- مهام ذكية مع إدخال بلغة طبيعية، وأهم ثلاث مهام لليوم.
- عادات مع تجميد السلسلة (Streak Freeze)، وتطبيقات مخصصة للقرآن والقراءة والتمارين والرسم.
- أهداف OKR تتحدث نتائجها الرئيسية تلقائياً من مهامك وعاداتك.
- وضع التركيز العميق، ومتابعة الصحة والطاقة والمالية واليوميات.
- **طقس الأحد** لمراجعة الأسبوع، و**وضع الإنقاذ** لإعادة ضبط اليوم عند الإرهاق.
- نسخ احتياطي واستعادة بضغطة زر، وبياناتك ملكك بالكامل.

**التشغيل السريع**

```bash
git clone https://github.com/Auctros/NUQTA.git
cd NUQTA
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

---

<div align="center">

**NUQTA** — one life, live it wisely.

</div>
