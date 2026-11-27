/**
 * The Timeline Workspace's temporal core.
 *
 * These tests exist for one reason above all: planning and history must never be
 * conflated. A task's due date is not its completion, an estimate is not a
 * duration, and a habit's recorded days are not a prediction. Each assertion below
 * pins one of those distinctions, because they are the requirement most easily lost
 * in a later refactor.
 */
import { describe, it, expect } from 'vitest';
import { buildTimelineDataset } from '../src/lib/timeline/adapter';
import {
  buildRuler,
  PX_PER_DAY,
  windowForZoom,
  offsetPx,
  dateAtOffset,
  snapToDay,
  itemsInWindow
} from '../src/lib/timeline/scale';
import { editCapability, applyTimelineEdit } from '../src/lib/timeline/edit';
import type { Task, Habit, Goal, FocusSession, JournalEntry, Project, ProjectPhase } from '../src/types';
import type { TimelineItem } from '../src/lib/timeline/types';

const OPTS = {
  isAr: false,
  recurrenceFrom: '2026-11-01',
  recurrenceTo: '2026-11-30'
};

function task(o: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Write the report',
    priority: 2,
    isTopThree: false,
    status: 'pending',
    tags: [],
    subtasks: [],
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...o
  } as Task;
}

function habit(o: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Read Arabic',
    anchor: 'after coffee',
    timeOfDay: 'morning',
    frequency: 'daily',
    category: 'learning',
    targetPerDay: 1,
    currentStreak: 0,
    longestStreak: 0,
    freezesRemaining: 2,
    freezesUsedDates: [],
    completedDates: [],
    createdAt: '2026-11-01T06:00:00.000Z',
    ...o
  } as Habit;
}

function goal(o: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Ship NUQTA',
    category: 'career',
    timeframe: 'quarterly',
    keyResults: [],
    status: 'active',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...o
  } as Goal;
}

const sources = (o: Partial<Parameters<typeof buildTimelineDataset>[0]> = {}) => ({
  tasks: [],
  habits: [],
  goals: [],
  focusSessions: [],
  journalEntries: [],
  healthMetrics: {},
  ...o
});

describe('planning and history are separate facts', () => {
  it('emits a planned item and an actual item for one task, never a merged one', () => {
    const data = buildTimelineDataset(
      sources({
        tasks: [
          task({
            scheduledDate: '2026-11-10',
            completedAt: '2026-11-12T14:30:00.000Z'
          })
        ]
      }),
      OPTS
    );

    const planned = data.items.filter((i) => i.reality === 'planned');
    const actual = data.items.filter((i) => i.reality === 'actual');
    expect(planned).toHaveLength(1);
    expect(actual).toHaveLength(1);
    expect(planned[0].id).not.toBe(actual[0].id);

    // The completion is at the real instant, not on the scheduled day.
    expect(actual[0].start.toISOString()).toBe('2026-11-12T14:30:00.000Z');
    expect(planned[0].start.getDate()).toBe(10);
  });

  it('never uses the due date as the completion date', () => {
    const data = buildTimelineDataset(
      sources({ tasks: [task({ scheduledDate: '2026-11-10', completedAt: '2026-11-20T09:00:00.000Z' })] }),
      OPTS
    );
    const actual = data.items.find((i) => i.reality === 'actual')!;
    expect(actual.start.getDate()).toBe(20);
  });

  it('does not fabricate a completion for an open task', () => {
    const data = buildTimelineDataset(sources({ tasks: [task({ scheduledDate: '2026-11-10' })] }), OPTS);
    expect(data.items.filter((i) => i.reality === 'actual')).toHaveLength(0);
  });

  it('treats an estimate as a planned length, never as recorded duration', () => {
    const data = buildTimelineDataset(
      sources({ tasks: [task({ scheduledDate: '2026-11-10', scheduledTime: '09:00', estimatedMinutes: 45 })] }),
      OPTS
    );
    const planned = data.items.find((i) => i.id.endsWith(':planned'))!;
    expect(planned.kind).toBe('span');
    expect(planned.end).toBeDefined();
    const minutes = (planned.end!.getTime() - planned.start.getTime()) / 60_000;
    expect(minutes).toBe(45);
  });

  it('keeps a date-only task as an all-day point with no invented clock time', () => {
    const data = buildTimelineDataset(sources({ tasks: [task({ scheduledDate: '2026-11-10' })] }), OPTS);
    const planned = data.items.find((i) => i.id.endsWith(':planned'))!;
    expect(planned.allDay).toBe(true);
    expect(planned.kind).toBe('point');
    expect(planned.end).toBeUndefined();
    expect(planned.start.getHours()).toBe(0);
  });

  it('marks habit completions actual and expected occurrences planned', () => {
    const data = buildTimelineDataset(
      sources({ habits: [habit({ completedDates: ['2026-11-02'] })] }),
      OPTS
    );
    const done = data.items.find((i) => i.id.includes(':done:2026-11-02'));
    expect(done?.reality).toBe('actual');

    const expected = data.items.filter((i) => i.id.includes(':expected:'));
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.every((i) => i.reality === 'planned')).toBe(true);
    // A completed day is not also emitted as an expected occurrence.
    expect(expected.some((i) => i.id.includes('2026-11-02'))).toBe(false);
  });

  it('does not fabricate history for a habit with no recorded days', () => {
    const data = buildTimelineDataset(sources({ habits: [habit()] }), OPTS);
    expect(data.items.filter((i) => i.reality === 'actual')).toHaveLength(0);
  });

  it('marks a goal as a planned range spanning its dates', () => {
    const data = buildTimelineDataset(
      sources({ goals: [goal({ startDate: '2026-11-01', deadline: '2026-11-30' })] }),
      OPTS
    );
    const range = data.items.find((i) => i.kind === 'range')!;
    expect(range.reality).toBe('planned');
    expect(range.allDay).toBe(true);
    expect(range.start.getDate()).toBe(1);
    expect(range.end!.getDate()).toBe(30);
  });

  it('distinguishes a dated milestone from a merely-planned one', () => {
    const data = buildTimelineDataset(
      sources({
        goals: [
          goal({
            startDate: '2026-11-01',
            milestones: [
              { id: 'm1', title: 'Done and dated', isCompleted: true, completedDate: '2026-11-05' },
              { id: 'm2', title: 'Still ahead', isCompleted: false, targetDate: '2026-11-20' }
            ]
          })
        ]
      }),
      OPTS
    );
    const m1 = data.items.find((i) => i.id.endsWith('m1'))!;
    const m2 = data.items.find((i) => i.id.endsWith('m2'))!;
    expect(m1.reality).toBe('actual');
    expect(m1.kind).toBe('milestone');
    expect(m2.reality).toBe('planned');
  });

  it('keeps undated open tasks in the backlog instead of dropping them', () => {
    const data = buildTimelineDataset(sources({ tasks: [task({ id: 't9', title: 'Someday' })] }), OPTS);
    expect(data.items).toHaveLength(0);
    expect(data.unscheduled).toHaveLength(1);
    expect(data.unscheduled[0].reason).toBe('no-date');
    expect(data.unscheduled[0].title).toBe('Someday');
  });

  it('records an invalid date as invalid, not as a guessed day', () => {
    const data = buildTimelineDataset(sources({ tasks: [task({ scheduledDate: '2026-02-31' })] }), OPTS);
    expect(data.items).toHaveLength(0);
    expect(data.unscheduled[0].reason).toBe('invalid-date');
  });
});

describe('sessions use their own timestamps', () => {
  it('builds a focus span backwards from its completion instant', () => {
    const session: FocusSession = {
      id: 'f1',
      durationMinutes: 25,
      targetMinutes: 25,
      interruptionCount: 0,
      preMood: 3,
      postMood: 4,
      productivityScore: 4,
      completedAt: '2026-11-10T10:00:00.000Z'
    };
    const data = buildTimelineDataset(sources({ focusSessions: [session] }), OPTS);
    const item = data.items[0];
    expect(item.kind).toBe('span');
    expect(item.reality).toBe('actual');
    expect((item.end!.getTime() - item.start.getTime()) / 60_000).toBe(25);
  });

  it('uses a walking session real start and end', () => {
    const h = habit({
      specializedType: 'walking',
      walkingData: {
        sessions: [
          {
            id: 'w1',
            date: '2026-11-10',
            durationSeconds: 1800,
            startedAt: '2026-11-10T07:00:00.000Z',
            endedAt: '2026-11-10T07:30:00.000Z'
          }
        ],
        totalWalkMinutes: 30,
        totalWalks: 1
      }
    } as Partial<Habit>);
    const data = buildTimelineDataset(sources({ habits: [h] }), OPTS);
    const walk = data.items.find((i) => i.domain === 'walking')!;
    expect(walk.kind).toBe('span');
    expect(walk.start.toISOString()).toBe('2026-11-10T07:00:00.000Z');
    expect(walk.end!.toISOString()).toBe('2026-11-10T07:30:00.000Z');
  });

  it('maps journal entries to actual points on their day', () => {
    const entry: JournalEntry = {
      id: 'j1',
      date: '2026-11-09',
      whatWentWell: '',
      whatDrainedEnergy: '',
      planForTomorrow: '',
      gratitudeList: [],
      mood: 4,
      isEncrypted: false,
      createdAt: '2026-11-09T20:00:00.000Z'
    };
    const data = buildTimelineDataset(sources({ journalEntries: [entry] }), OPTS);
    expect(data.items[0].reality).toBe('actual');
    expect(data.items[0].allDay).toBe(true);
  });
});

describe('recurring expansion is bounded', () => {
  it('only materialises occurrences inside the requested window', () => {
    const data = buildTimelineDataset(sources({ habits: [habit()] }), {
      ...OPTS,
      recurrenceFrom: '2026-11-01',
      recurrenceTo: '2026-11-07'
    });
    const expected = data.items.filter((i) => i.id.includes(':expected:'));
    expect(expected.length).toBe(7);
    expect(expected.every((i) => i.start.getMonth() === 10 && i.start.getDate() <= 7)).toBe(true);
  });

  it('caps a habit so a dense window cannot explode', () => {
    const data = buildTimelineDataset(sources({ habits: [habit()] }), {
      ...OPTS,
      recurrenceFrom: '2026-01-01',
      recurrenceTo: '2026-12-31',
      maxOccurrencesPerHabit: 10
    });
    expect(data.items.filter((i) => i.id.includes(':expected:')).length).toBe(10);
  });
});

describe('lanes and bounds', () => {
  it('groups items into labelled lanes in a deliberate order', () => {
    const data = buildTimelineDataset(
      sources({
        tasks: [task({ scheduledDate: '2026-11-10' })],
        goals: [goal({ startDate: '2026-11-01', deadline: '2026-11-30' })]
      }),
      OPTS
    );
    expect(data.lanes.map((l) => l.domain)).toEqual(['goals', 'tasks']);
    expect(data.lanes[0].label).toBe('Goals & milestones');
  });

  it('computes bounds across the widest item', () => {
    const data = buildTimelineDataset(
      sources({
        goals: [goal({ startDate: '2026-11-01', deadline: '2026-11-30' })],
        tasks: [task({ scheduledDate: '2026-11-10' })]
      }),
      OPTS
    );
    expect(data.bounds!.start.getDate()).toBe(1);
    expect(data.bounds!.end.getDate()).toBe(30);
  });

  it('reports no bounds for an empty dataset', () => {
    expect(buildTimelineDataset(sources(), OPTS).bounds).toBeNull();
  });
});

describe('zoom genuinely rescales the axis', () => {
  it('spreads pixels-per-day across orders of magnitude', () => {
    expect(PX_PER_DAY.hour).toBeGreaterThan(PX_PER_DAY.day);
    expect(PX_PER_DAY.day).toBeGreaterThan(PX_PER_DAY.week);
    expect(PX_PER_DAY.week).toBeGreaterThan(PX_PER_DAY.month);
    expect(PX_PER_DAY.month).toBeGreaterThan(PX_PER_DAY.quarter);
    expect(PX_PER_DAY.quarter).toBeGreaterThan(PX_PER_DAY.year);
    expect(PX_PER_DAY.year).toBeGreaterThan(PX_PER_DAY['multi-year']);
  });

  it('gives a fixed date a wider offset at a finer zoom', () => {
    const origin = new Date(2026, 0, 1);
    const later = new Date(2026, 0, 8);
    const wide = offsetPx(later, origin, PX_PER_DAY.day);
    const narrow = offsetPx(later, origin, PX_PER_DAY.year);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('round-trips an offset back to a date', () => {
    const origin = new Date(2026, 0, 1);
    const px = offsetPx(new Date(2026, 5, 15), origin, PX_PER_DAY.month);
    const back = dateAtOffset(px, origin, PX_PER_DAY.month);
    expect(back.getTime()).toBe(new Date(2026, 5, 15).getTime());
  });

  it('labels hours at hour zoom and months at year zoom', () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 0, 2);
    const hours = buildRuler(from, to, 'hour', false);
    expect(hours.length).toBe(24);
    expect(hours[0].label).toContain(':00');

    const months = buildRuler(new Date(2026, 0, 1), new Date(2027, 0, 1), 'year', false);
    expect(months).toHaveLength(12);
    expect(months[0].label).toBe('Jan');
  });

  it('caps ruler cells so a long range cannot build a huge DOM', () => {
    const ticks = buildRuler(new Date(2000, 0, 1), new Date(2030, 0, 1), 'week', false, 50);
    expect(ticks.length).toBeLessThanOrEqual(50);
  });

  it('keeps periods continuous — each tick ends where the next begins', () => {
    const ticks = buildRuler(new Date(2026, 0, 1), new Date(2026, 6, 1), 'year', false);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].start.getTime()).toBe(ticks[i - 1].end.getTime());
    }
  });

  it('centres a window on the requested date', () => {
    const center = new Date(2026, 5, 15);
    const { from, to } = windowForZoom(center, 'week');
    expect(from.getTime()).toBeLessThan(center.getTime());
    expect(to.getTime()).toBeGreaterThan(center.getTime());
  });

  it('snaps a drag to the nearest day', () => {
    expect(snapToDay(new Date(2026, 5, 15, 5)).getDate()).toBe(15);
    expect(snapToDay(new Date(2026, 5, 15, 20)).getDate()).toBe(16);
  });

  it('includes items that merely overlap the window', () => {
    const spanning: TimelineItem = {
      id: 'g1',
      domain: 'goals',
      reality: 'planned',
      kind: 'range',
      title: 'Long goal',
      start: new Date(2026, 0, 1),
      end: new Date(2026, 11, 31),
      allDay: true,
      entityId: 'g1',
      source: 'goals'
    };
    const inside = itemsInWindow([spanning], new Date(2026, 5, 1), new Date(2026, 5, 30));
    expect(inside).toHaveLength(1);
  });
});

describe('only real, persistable edits are allowed', () => {
  const plannedTask: TimelineItem = {
    id: 'tasks:t1:planned',
    domain: 'tasks',
    reality: 'planned',
    kind: 'point',
    title: 'Write',
    start: new Date(2026, 10, 10),
    allDay: true,
    entityId: 't1',
    source: 'tasks'
  };

  it('allows moving a planned task', () => {
    expect(editCapability(plannedTask).move).toBe(true);
  });

  it('refuses to move recorded history', () => {
    const actual: TimelineItem = { ...plannedTask, id: 'tasks:t1:completed', reality: 'actual' };
    const cap = editCapability(actual);
    expect(cap.move).toBe(false);
    expect(cap.readOnlyReasonEn).toBeTruthy();
  });

  it('refuses to move a habit occurrence', () => {
    const occ: TimelineItem = { ...plannedTask, id: 'habits:h1:done:2026-11-02', domain: 'habits' };
    expect(editCapability(occ).move).toBe(false);
  });

  it('writes a task move through updateTask, preserving its clock time', () => {
    const item: TimelineItem = {
      ...plannedTask,
      start: new Date(2026, 10, 10, 9, 30),
      allDay: false
    };
    const updates: Partial<Task>[] = [];
    const ok = applyTimelineEdit(item, 'move', new Date(2026, 10, 14, 9, 30), undefined, {
      tasks: [task({ id: 't1', scheduledDate: '2026-11-10', scheduledTime: '09:30' })],
      goals: [],
      habits: [],
      projects: [],
      updateTask: (_id, u) => updates.push(u),
      updateGoal: () => {},
      updateProject: () => {},
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });
    expect(ok).toBe(true);
    expect(updates[0]).toEqual({ scheduledDate: '2026-11-14', scheduledTime: '09:30' });
  });

  it('does not invent a clock time for a date-only task', () => {
    const updates: Partial<Task>[] = [];
    applyTimelineEdit(plannedTask, 'move', new Date(2026, 10, 14), undefined, {
      tasks: [task({ id: 't1', scheduledDate: '2026-11-10' })],
      goals: [],
      habits: [],
      projects: [],
      updateTask: (_id, u) => updates.push(u),
      updateGoal: () => {},
      updateProject: () => {},
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });
    expect(updates[0]).toEqual({ scheduledDate: '2026-11-14' });
    expect(updates[0].scheduledTime).toBeUndefined();
  });

  it('preserves a goal range length when moving it', () => {
    const item: TimelineItem = {
      id: 'goals:g1:range',
      domain: 'goals',
      reality: 'planned',
      kind: 'range',
      title: 'Ship',
      start: new Date(2026, 10, 1),
      end: new Date(2026, 10, 30, 23, 59, 59, 999),
      allDay: true,
      entityId: 'g1',
      source: 'goals'
    };
    const updates: Partial<Goal>[] = [];
    applyTimelineEdit(item, 'move', new Date(2026, 11, 1), undefined, {
      tasks: [],
      goals: [goal({ id: 'g1', startDate: '2026-11-01', deadline: '2026-11-30' })],
      habits: [],
      projects: [],
      updateTask: () => {},
      updateGoal: (_id, u) => updates.push(u),
      updateProject: () => {},
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });
    expect(updates[0].startDate).toBe('2026-12-01');
    expect(updates[0].deadline).toBe('2026-12-30');
  });

  it('returns false instead of pretending when the record is gone', () => {
    const ok = applyTimelineEdit(plannedTask, 'move', new Date(2026, 10, 14), undefined, {
      tasks: [],
      goals: [],
      habits: [],
      projects: [],
      updateTask: () => {},
      updateGoal: () => {},
      updateProject: () => {},
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });
    expect(ok).toBe(false);
  });
});

describe('timeline — a project window is editable, a completed phase is not', () => {
  const projectRecord = (overrides: Partial<Project> = {}): Project =>
    ({
      id: 'p1',
      title: 'Launch',
      status: 'active',
      goalIds: [],
      phases: [],
      steps: [],
      notes: [],
      resources: [],
      activity: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides
    }) as Project;

  const projectRange = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
    id: 'projects:p1:range',
    domain: 'projects',
    reality: 'planned',
    kind: 'range',
    title: 'Launch',
    start: new Date(2026, 10, 1),
    end: new Date(2026, 10, 10),
    allDay: true,
    entityId: 'p1',
    source: 'projects',
    ...overrides
  });

  it('offers move and both resize handles on a project window', () => {
    expect(editCapability(projectRange())).toMatchObject({
      move: true,
      resizeStart: true,
      resizeEnd: true
    });
  });

  it('moves a project window without collapsing its length', () => {
    const updates: Partial<Project>[] = [];
    const ok = applyTimelineEdit(projectRange(), 'move', new Date(2026, 11, 1), undefined, {
      tasks: [],
      goals: [],
      habits: [],
      projects: [projectRecord({ startDate: '2026-11-01', targetDate: '2026-11-10' })],
      updateTask: () => {},
      updateGoal: () => {},
      updateProject: (_id, u) => updates.push(u),
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });

    expect(ok).toBe(true);
    expect(updates[0]).toEqual({ startDate: '2026-12-01', targetDate: '2026-12-10' });
  });

  it('routes a phase window to the phase, not to the whole project', () => {
    const projectUpdates: Partial<Project>[] = [];
    const phaseUpdates: Array<{ projectId: string; phaseId: string; updates: Partial<ProjectPhase> }> = [];
    const record = projectRecord({
      startDate: '2026-11-01',
      targetDate: '2026-12-01',
      phases: [
        {
          id: 'ph1',
          title: 'Research',
          order: 0,
          startDate: '2026-11-01',
          targetDate: '2026-11-10',
          taskIds: []
        } as ProjectPhase
      ]
    });

    const ok = applyTimelineEdit(
      projectRange({ id: 'projects:p1:phase:ph1', subEntityId: 'ph1', title: 'Research' }),
      'resize-end',
      new Date(2026, 10, 1),
      new Date(2026, 10, 15),
      {
        tasks: [],
        goals: [],
        habits: [],
        projects: [record],
        updateTask: () => {},
        updateGoal: () => {},
        updateProject: (_id, u) => projectUpdates.push(u),
        updateProjectPhase: (projectId, phaseId, updates) => phaseUpdates.push({ projectId, phaseId, updates }),
        updateArtProject: () => {}
      }
    );

    expect(ok).toBe(true);
    expect(projectUpdates).toHaveLength(0);
    expect(phaseUpdates).toEqual([{ projectId: 'p1', phaseId: 'ph1', updates: { startDate: '2026-11-01', targetDate: '2026-11-15' } }]);
  });

  it('refuses an edit that would put the end before the start', () => {
    let called = false;
    const ok = applyTimelineEdit(
      projectRange(),
      'resize-start',
      new Date(2026, 11, 1),
      undefined,
      {
        tasks: [],
        goals: [],
        habits: [],
        projects: [projectRecord({ startDate: '2026-11-01', targetDate: '2026-11-10' })],
        updateTask: () => {},
        updateGoal: () => {},
        updateProject: () => {
          called = true;
        },
        updateProjectPhase: () => {},
        updateArtProject: () => {}
      }
    );

    expect(ok).toBe(false);
    expect(called).toBe(false);
  });

  it('returns false when the project is gone rather than inventing one', () => {
    const ok = applyTimelineEdit(projectRange(), 'move', new Date(2026, 11, 1), undefined, {
      tasks: [],
      goals: [],
      habits: [],
      projects: [],
      updateTask: () => {},
      updateGoal: () => {},
      updateProject: () => {},
      updateProjectPhase: () => {},
      updateArtProject: () => {}
    });
    expect(ok).toBe(false);
  });
});
