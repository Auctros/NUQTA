/**
 * OPTIONAL sample data.
 *
 * Nothing in here is ever loaded automatically. A first run starts EMPTY.
 * The data is only written when the user explicitly picks "Load sample data"
 * in Settings (see NuqtaStorageEngine.loadDemoData), and the app is then flagged
 * as demo so it is never mistaken for real user data.
 */
import { localDateKey } from './dateKey';
import {
  Task,
  Habit,
  Goal,
  FocusSession,
  HealthMetric,
  ExpenseRecord,
  SavingsGoal,
  JournalEntry,
  SundayRitualReview
} from '../types';

export const DEMO_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Finalize Q4 strategic architecture blueprint',
    notes: 'Incorporate local-first offline cache and zero-knowledge encryption guarantees.',
    priority: 1,
    isTopThree: true,
    status: 'todo',
    scheduledDate: localDateKey(),
    scheduledTime: '10:00',
    estimatedMinutes: 90,
    tags: ['deepwork', 'architecture', 'high-focus'],
    energyLevelRequired: 'high',
    subtasks: [
      { id: 'st-1', title: 'Define schema and relations', completed: true },
      { id: 'st-2', title: 'Validate zero-knowledge crypto pipeline', completed: false },
      { id: 'st-3', title: 'Simulate offline fallback flows', completed: false }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't-2',
    title: '30-minute zone-2 recovery run & mobility',
    notes: 'Keep heart rate strictly under 140 bpm. Hydrate with electrolytes afterwards.',
    priority: 2,
    isTopThree: true,
    status: 'todo',
    scheduledDate: localDateKey(),
    scheduledTime: '16:30',
    estimatedMinutes: 40,
    tags: ['health', 'recovery'],
    energyLevelRequired: 'medium',
    subtasks: [
      { id: 'st-4', title: 'Dynamic stretch & foam roll', completed: false },
      { id: 'st-5', title: '5km paced run', completed: false }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't-3',
    title: 'Review team pull requests & release candidate notes',
    notes: 'Verify atomic state updates and responsiveness across mobile viewports.',
    priority: 2,
    isTopThree: true,
    status: 'todo',
    scheduledDate: localDateKey(),
    scheduledTime: '14:00',
    estimatedMinutes: 45,
    tags: ['code', 'engineering'],
    energyLevelRequired: 'medium',
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't-4',
    title: 'Read 2 chapters of "Atomic Habits" (James Clear)',
    notes: 'Focus on habit stacking and environmental cues.',
    priority: 3,
    isTopThree: false,
    status: 'todo',
    scheduledDate: localDateKey(),
    scheduledTime: '21:00',
    estimatedMinutes: 30,
    tags: ['mind', 'learning'],
    energyLevelRequired: 'low',
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't-5',
    title: 'Audit monthly recurring SaaS subscriptions',
    notes: 'Cancel unused software licenses and consolidate cloud tooling.',
    priority: 3,
    isTopThree: false,
    status: 'todo',
    scheduledDate: localDateKey(),
    estimatedMinutes: 25,
    tags: ['finance'],
    energyLevelRequired: 'low',
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEMO_HABITS: Habit[] = [
  {
    id: 'h-1',
    name: 'Morning Hydration & Sunlight',
    anchor: 'After getting out of bed -> drink 500ml water and view daylight for 10 min',
    location: 'Balcony / Kitchen',
    timeOfDay: 'morning',
    frequency: 'daily',
    category: 'health',
    targetPerDay: 1,
    unit: 'glass',
    currentStreak: 14,
    longestStreak: 28,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [
      localDateKey(new Date(Date.now() - 86400000)),
      localDateKey(new Date(Date.now() - 172800000)),
      localDateKey(new Date(Date.now() - 259200000))
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'h-2',
    name: 'Daily 90-min Deep Work Block',
    anchor: 'After opening my laptop at 09:00 -> engage distraction shield and single-task',
    location: 'Study Desk',
    timeOfDay: 'morning',
    frequency: 'weekdays',
    category: 'productivity',
    targetPerDay: 1,
    unit: 'session',
    currentStreak: 9,
    longestStreak: 21,
    freezesRemaining: 1,
    freezesUsedDates: [],
    completedDates: [
      localDateKey(new Date(Date.now() - 86400000)),
      localDateKey(new Date(Date.now() - 172800000))
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'h-3',
    name: 'Evening Brain Dump & Journaling',
    anchor: 'After brushing teeth at 22:00 -> write 3 daily prompts in NUQTA vault',
    location: 'Bedside',
    timeOfDay: 'evening',
    frequency: 'daily',
    category: 'mind',
    targetPerDay: 1,
    unit: 'entry',
    currentStreak: 7,
    longestStreak: 15,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [
      localDateKey(new Date(Date.now() - 86400000))
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'h-4',
    name: 'Daily Reading Sanctuary',
    anchor: 'After dinner coffee -> sit in reading chair with Kindle/book',
    location: 'Reading Nook',
    timeOfDay: 'evening',
    frequency: 'daily',
    category: 'learning',
    targetPerDay: 20,
    unit: 'pages',
    currentStreak: 18,
    longestStreak: 30,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [
      localDateKey(),
      localDateKey(new Date(Date.now() - 86400000)),
      localDateKey(new Date(Date.now() - 172800000))
    ],
    createdAt: new Date().toISOString(),
    specializedType: 'reading',
    readingData: {
      annualTargetBooks: 24,
      totalPagesRead: 1480,
      totalReadingMinutes: 1840,
      activeBookId: 'book-1',
      books: [
        {
          id: 'book-1',
          title: 'العادات الذرية (Atomic Habits)',
          author: 'James Clear',
          totalPages: 320,
          currentPage: 218,
          status: 'reading',
          coverColor: '#d97706',
          startDate: '2026-10-12'
        },
        {
          id: 'book-2',
          title: 'العمل العميق (Deep Work)',
          author: 'Cal Newport',
          totalPages: 280,
          currentPage: 280,
          status: 'completed',
          coverColor: '#2563eb',
          startDate: '2026-09-01',
          completedDate: '2026-10-10'
        },
        {
          id: 'book-3',
          title: 'قوة الآن (The Power of Now)',
          author: 'Eckhart Tolle',
          totalPages: 240,
          currentPage: 0,
          status: 'want_to_read',
          coverColor: '#059669'
        }
      ],
      sessions: [
        {
          id: 'rs-1',
          date: localDateKey(),
          bookId: 'book-1',
          bookTitle: 'العادات الذرية (Atomic Habits)',
          pagesRead: 22,
          durationMinutes: 30,
          speedPagesPerHour: 44,
          notes: 'Crucial chapter on identity-based habits and continuous 1% compounding.'
        },
        {
          id: 'rs-2',
          date: localDateKey(new Date(Date.now() - 86400000)),
          bookId: 'book-1',
          bookTitle: 'العادات الذرية (Atomic Habits)',
          pagesRead: 25,
          durationMinutes: 35,
          speedPagesPerHour: 42,
          notes: 'The 4 laws of behavior change.'
        }
      ]
    }
  },
  {
    id: 'h-5',
    name: 'Strength & Body Conditioning',
    anchor: 'After 17:00 work cutoff -> change into training kit and start workout',
    location: 'Fitness Club / Home Gym',
    timeOfDay: 'afternoon',
    frequency: 'custom',
    customDays: [1, 2, 4, 5],
    category: 'health',
    targetPerDay: 1,
    unit: 'session',
    currentStreak: 8,
    longestStreak: 16,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [
      localDateKey(),
      localDateKey(new Date(Date.now() - 86400000)),
      localDateKey(new Date(Date.now() - 259200000))
    ],
    createdAt: new Date().toISOString(),
    specializedType: 'workout',
    workoutData: {
      weeklyTargetSessions: 4,
      totalVolumeKg: 18450,
      totalMinutes: 1240,
      totalWorkouts: 26,
      favoriteRoutine: 'Upper Body Power & Push',
      sessions: [
        {
          id: 'ws-1',
          date: localDateKey(),
          title: 'Upper Body Hypertrophy & Core',
          workoutType: 'strength',
          durationMinutes: 52,
          totalReps: 64,
          caloriesBurned: 420,
          volumeKg: 4620,
          intensityRating: 4,
          notes: 'New personal record on Barbell Bench Press (80kg x 6). Excellent pump.',
          exercises: [
            {
              id: 'ex-1',
              name: 'Barbell Bench Press',
              category: 'chest',
              sets: [
                { setNumber: 1, weightKg: 70, reps: 10, completed: true },
                { setNumber: 2, weightKg: 75, reps: 8, completed: true },
                { setNumber: 3, weightKg: 80, reps: 6, completed: true }
              ]
            },
            {
              id: 'ex-2',
              name: 'Neutral Grip Pull-ups',
              category: 'back',
              sets: [
                { setNumber: 1, weightKg: 0, reps: 12, completed: true },
                { setNumber: 2, weightKg: 0, reps: 10, completed: true },
                { setNumber: 3, weightKg: 0, reps: 8, completed: true }
              ]
            },
            {
              id: 'ex-3',
              name: 'Dumbbell Shoulder Press',
              category: 'shoulders',
              sets: [
                { setNumber: 1, weightKg: 22, reps: 10, completed: true },
                { setNumber: 2, weightKg: 24, reps: 8, completed: true }
              ]
            }
          ]
        },
        {
          id: 'ws-2',
          date: localDateKey(new Date(Date.now() - 86400000)),
          title: 'Zone 2 Recovery Aerobics',
          workoutType: 'cardio',
          durationMinutes: 40,
          totalReps: 1,
          caloriesBurned: 350,
          volumeKg: 0,
          intensityRating: 3,
          notes: 'Steady cadence, heart rate kept at 135 bpm.',
          exercises: [
            {
              id: 'ex-4',
              name: 'Treadmill Incline Walk / Jog',
              category: 'cardio',
              sets: [{ setNumber: 1, reps: 40, completed: true }]
            }
          ]
        }
      ]
    }
  }
];

export const DEMO_GOALS: Goal[] = [
  {
    id: 'g-1',
    title: 'Achieve Peak Cognitive & Physical Energy',
    description: 'Stabilize sleep cycles, optimize home calisthenics consistency, and build resilient deep stamina.',
    category: 'health',
    priority: 'high',
    timeframe: 'annual',
    startDate: localDateKey(new Date(Date.now() - 30 * 86400000)),
    deadline: '2026-12-31',
    status: 'active',
    color: '#10b981',
    keyResults: [
      { id: 'kr-1', title: 'Average 7.5+ hours of sleep with quality >= 4/5', targetValue: 7.5, currentValue: 7.2, unit: 'hrs', dataSource: 'manual' },
      { id: 'kr-2', title: 'Log 500 home workout reps across muscle groups', targetValue: 500, currentValue: 65, unit: 'reps', dataSource: 'workout_total_reps' },
      { id: 'kr-3', title: 'Complete 16 home calisthenics sessions', targetValue: 16, currentValue: 2, unit: 'sessions', dataSource: 'workout_sessions_count' }
    ],
    milestones: [
      { id: 'ms-1', title: 'Establish consistent 10:30 PM sleep anchor', targetDate: '2026-06-30', isCompleted: true, completedDate: '2026-05-15' },
      { id: 'ms-2', title: 'Execute 30 consecutive days of mobility & bodyweight sets', targetDate: '2026-09-30', isCompleted: false },
      { id: 'ms-3', title: 'Reach 1,000 total reps with strict form', targetDate: '2026-12-15', isCompleted: false }
    ],
    linkedHabitIds: ['h-2', 'h-3'],
    visionNotes: 'Vitality is the foundation of high judgment, tranquility, and sustained execution.',
    visionImages: [],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'g-2',
    title: 'Ship Flagship Independent Product with Excellence',
    description: 'Launch production-grade software with zero bloat, high customer delight, and sound economics.',
    category: 'career',
    priority: 'urgent',
    timeframe: 'quarterly',
    startDate: localDateKey(new Date(Date.now() - 14 * 86400000)),
    deadline: '2026-12-15',
    status: 'active',
    color: '#f59e0b',
    keyResults: [
      { id: 'kr-4', title: 'Complete 5 core sprint tasks & benchmarks', targetValue: 5, currentValue: 2, unit: 'tasks', dataSource: 'tasks_completed' },
      { id: 'kr-5', title: 'Finish 2 foundational product & philosophy books', targetValue: 2, currentValue: 0, unit: 'books', dataSource: 'reading_books_completed' },
      { id: 'kr-6', title: 'Maintain sub-50ms interaction latency everywhere', targetValue: 100, currentValue: 95, unit: '%', dataSource: 'manual' }
    ],
    milestones: [
      { id: 'ms-4', title: 'Finalize local-first storage engine & schemas', targetDate: '2026-11-10', isCompleted: true, completedDate: '2026-11-04' },
      { id: 'ms-5', title: 'Ship Goal Management & Progress Intelligence system', targetDate: '2026-11-20', isCompleted: false },
      { id: 'ms-6', title: 'Deploy public production release', targetDate: '2026-12-15', isCompleted: false }
    ],
    linkedTaskIds: ['t-1', 't-2', 't-3'],
    linkedHabitIds: ['h-1'],
    linkedBookIds: ['b-1'],
    visionNotes: 'Craft is about eliminating everything unnecessary until only the truth remains.',
    visionImages: [],
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
  }
];

export const DEMO_EXPENSES: ExpenseRecord[] = [
  { id: 'exp-1', title: 'Supermarket Organics & Groceries', amount: 84.50, type: 'expense', category: 'food', date: localDateKey() },
  { id: 'exp-2', title: 'Cloud Infrastructure & Server Backup', amount: 28.00, type: 'expense', category: 'tech', date: localDateKey(new Date(Date.now() - 86400000)) },
  { id: 'exp-3', title: 'High-Performance Running Shoes', amount: 160.00, type: 'expense', category: 'health', date: localDateKey(new Date(Date.now() - 172800000)) },
  { id: 'exp-4', title: 'Consulting Honorarium Deposit', amount: 1250.00, type: 'income', category: 'savings', date: localDateKey(new Date(Date.now() - 259200000)) }
];

export const DEMO_SAVINGS_GOALS: SavingsGoal[] = [
  { id: 'sg-1', title: 'Emergency Freedom Reserve (6 Months)', targetAmount: 18000, currentAmount: 14200, icon: 'shield' },
  { id: 'sg-2', title: 'Ergonomic Workspace & Studio Upgrade', targetAmount: 3500, currentAmount: 2450, icon: 'laptop' }
];

