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
![Local-first](https://img.shields.io/badge/Local--first-100%25_offline-2ea44f?style=flat-square)
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
- **Command palette** and **global search** for keyboard-first navigation.

---

## Quick Start

**Requirements:** Node.js 20 or later.

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
| `npm run clean` | Remove build output |

---

## Architecture

```
NUQTA/
├── src/
│   ├── App.tsx                  # Shell, navigation, global hotkeys
│   ├── main.tsx                 # Entry point
│   ├── store/
│   │   └── nuqtaStore.ts        # Zustand store: state and domain actions
│   ├── lib/
│   │   ├── storage.ts           # Hybrid persistence layer
│   │   ├── indexedDB.ts         # IndexedDB engine
│   │   ├── nlpParser.ts         # Natural-language task parsing
│   │   ├── energyAlgorithm.ts   # Daily energy score
│   │   ├── goalProgressEngine.ts        # Key-result progress from live data
│   │   ├── lifeIntelligenceEngine.ts    # Cross-domain insights
│   │   ├── universalHistoryEngine.ts    # Audit trail
│   │   ├── notifications.ts / useNuqtaReminders.ts
│   │   └── crypto.ts            # AES-GCM / PBKDF2 utilities
│   ├── components/              # Views, modals, charts, shared UI kit
│   └── types/                   # Domain models
└── public/
```

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand.

**State and persistence.** A single Zustand store owns application state. Every change is persisted through a hybrid layer: `localStorage` for instant, synchronous reads at render time, and `IndexedDB` for durable, higher-capacity offline storage.

**Insight engines.** Domain logic lives in pure modules under `src/lib/`, separate from the UI, so scoring, goal progress, and analytics can be reasoned about and tested independently.

---

## Privacy & Data Ownership

- **No server.** NUQTA has no backend and makes no calls to external APIs.
- **No tracking.** No analytics, no accounts.
- **Full portability.** Export a complete JSON backup from **Settings** and restore it at any time.
- **Encryption utilities included.** `src/lib/crypto.ts` provides client-side AES-GCM-256 with PBKDF2 key derivation for encrypted data handling.

> Your browser profile is your database. Export a backup regularly, especially before clearing site data or switching devices.

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
