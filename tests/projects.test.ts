import { describe, it, expect, beforeEach } from 'vitest';
import {
  addNote,
  addPhase,
  addStep,
  applyStatus,
  attachTaskToStep,
  deletePhase,
  deleteStep,
  detachTaskFromSteps,
  linkGoal,
  markNoteConvertedToStep,
  moveStep,
  recordActivity,
  setStepStatus,
  togglePhaseCompletion,
  unlinkGoal,
  PROJECT_ACTIVITY_LIMIT
} from '../src/lib/projectModel';
import {
  assessProjectHealth,
  countSteps,
  deriveProjectProgress,
  nextAction,
  projectTasks
} from '../src/lib/projectProgress';
import type { Project, Task } from '../src/types';

const NOW = '2026-03-10T09:00:00.000Z';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'prj-1',
  title: 'Ship the thing',
  status: 'active',
  goalIds: [],
  phases: [],
  steps: [],
  notes: [],
  resources: [],
  activity: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides
});

const task = (id: string, overrides: Partial<Task> = {}): Task =>
  ({
    id,
    title: id,
    status: 'todo',
    priority: 2,
    isTopThree: false,
    tags: [],
    subtasks: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }) as Task;

const step = (id: string, status: 'open' | 'done' | 'blocked' = 'open', order = 0) => ({
  id,
  title: id,
  status,
  order,
  taskIds: [],
  createdAt: NOW,
  updatedAt: NOW
});

describe('project model keeps its invariants', () => {
  it('a completed project always has completedAt, and reopening clears it', () => {
    const completed = applyStatus(project(), 'completed', NOW);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(NOW);

    const reopened = applyStatus(completed, 'active', '2026-03-11T00:00:00.000Z');
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.status).toBe('active');
  });

  it('archiving stamps archivedAt and never leaves a completion date behind', () => {
    const completed = applyStatus(project(), 'completed', NOW);
    const archived = applyStatus(completed, 'archived', '2026-03-12T00:00:00.000Z');
    expect(archived.archivedAt).toBe('2026-03-12T00:00:00.000Z');
    expect(archived.completedAt).toBeUndefined();
  });

  it('a blocked step keeps its reason, and clearing the block drops it', () => {
    const withStep = { ...project(), steps: [step('s1')] };
    const blocked = setStepStatus(withStep, 's1', 'blocked', NOW);
    expect(blocked.steps[0].blockedReason).toBeUndefined();

    const withReason = {
      ...blocked,
      steps: blocked.steps.map((s) => ({ ...s, blockedReason: 'waiting on review' }))
    };
    const reopened = setStepStatus(withReason, 's1', 'open', NOW);
    expect(reopened.steps[0].blockedReason).toBeUndefined();
    expect(reopened.steps[0].completedAt).toBeUndefined();
  });

  it('completing a step stamps completedAt; reopening removes it', () => {
    const withStep = { ...project(), steps: [step('s1')] };
    const done = setStepStatus(withStep, 's1', 'done', NOW);
    expect(done.steps[0].completedAt).toBe(NOW);
    const open = setStepStatus(done, 's1', 'open', NOW);
    expect(open.steps[0].completedAt).toBeUndefined();
  });

  it('deleting a phase detaches its steps and notes instead of destroying them', () => {
    const base = project({ phases: [{ id: 'ph1', title: 'Phase', order: 0 }] });
    const withStep = addStep(base, { title: 'step', phaseId: 'ph1' }, NOW).project;
    const withNote = addNote(withStep, { body: 'note', phaseId: 'ph1' }, NOW).project;

    const after = deletePhase(withNote, 'ph1', NOW);
    expect(after.phases).toHaveLength(0);
    // The work survives; only the grouping is gone.
    expect(after.steps).toHaveLength(1);
    expect(after.steps[0].phaseId).toBeUndefined();
    expect(after.notes).toHaveLength(1);
    expect(after.notes[0].phaseId).toBeUndefined();
  });

  it('deleting a step leaves the task that executed it intact', () => {
    const base = addStep(project(), { title: 'step' }, NOW).project;
    const stepId = base.steps[0].id;
    const withTask = attachTaskToStep(base, stepId, 't1', NOW);
    expect(withTask.steps[0].taskIds).toEqual(['t1']);

    const after = deleteStep(withTask, stepId, NOW);
    expect(after.steps).toHaveLength(0);
    // detachTaskFromSteps is the store's job on the task side; the step deletion
    // itself must not need the task to exist.
    expect(after.steps.some((s) => s.taskIds.includes('t1'))).toBe(false);
  });

  it('moving a step renumbers order densely so the plan stays stable', () => {
    let p = project();
    p = addStep(p, { title: 'a' }, NOW).project;
    p = addStep(p, { title: 'b' }, NOW).project;
    p = addStep(p, { title: 'c' }, NOW).project;

    const moved = moveStep(p, p.steps[2].id, 'up', NOW);
    const ordered = [...moved.steps].sort((x, y) => x.order - y.order);
    expect(ordered.map((s) => s.title)).toEqual(['a', 'c', 'b']);
    expect(ordered.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('moving the first step up is a no-op rather than a crash', () => {
    const p = addStep(project(), { title: 'a' }, NOW).project;
    expect(moveStep(p, p.steps[0].id, 'up', NOW)).toBe(p);
  });

  it('linking the same goal twice does not duplicate it', () => {
    const once = linkGoal(project(), 'g1', NOW);
    expect(once.goalIds).toEqual(['g1']);
    const twice = linkGoal(once, 'g1', NOW);
    expect(twice).toBe(once);
    expect(unlinkGoal(twice, 'g1', NOW).goalIds).toEqual([]);
  });

  it('activity is append-only, newest first, and bounded', () => {
    let p = project();
    for (let i = 0; i < PROJECT_ACTIVITY_LIMIT + 25; i += 1) {
      p = recordActivity(p, 'note_added', `event ${i}`, NOW);
    }
    expect(p.activity).toHaveLength(PROJECT_ACTIVITY_LIMIT);
    expect(p.activity[0].summary).toBe(`event ${PROJECT_ACTIVITY_LIMIT + 24}`);
  });

  it('converting a note to a step keeps the note as the trace', () => {
    const base = addNote(project(), { body: 'an idea', title: 'idea' }, NOW).project;
    const noteId = base.notes[0].id;
    const stepId = 'st-fixed';
    const after = markNoteConvertedToStep(base, noteId, stepId, NOW);
    expect(after.notes[0].convertedToStepId).toBe(stepId);
    // The note is not deleted: it records why the step exists.
    expect(after.notes).toHaveLength(1);
  });

  it('toggling a phase twice returns it to open', () => {
    const base = project({ phases: [{ id: 'ph1', title: 'Phase', order: 0 }] });
    const done = togglePhaseCompletion(base, 'ph1', NOW);
    expect(done.phases[0].completedAt).toBe(NOW);
    const reopened = togglePhaseCompletion(done, 'ph1', NOW);
    expect(reopened.phases[0].completedAt).toBeUndefined();
  });

  it('detaching a task from steps is a no-op when it was never attached', () => {
    const p = project();
    expect(detachTaskFromSteps(p, 't1', NOW)).toBe(p);
  });
});

describe('progress is derived, never fabricated', () => {
  it('reports no figure at all when there are no steps and no tasks', () => {
    const result = deriveProjectProgress(project(), []);
    expect(result.source).toBe('none');
    expect(result.ratio).toBeNull();
    expect(result.percent).toBeNull();
  });

  it('derives from steps when the project has a plan', () => {
    const p = project({ steps: [step('a', 'done'), step('b', 'open'), step('c', 'open'), step('d', 'done')] });
    const result = deriveProjectProgress(p, []);
    expect(result.source).toBe('steps');
    expect(result.percent).toBe(50);
  });

  it('falls back to tasks only when the project has no steps', () => {
    const p = project();
    const tasks = [
      task('t1', { projectId: p.id, status: 'completed' }),
      task('t2', { projectId: p.id, status: 'todo' })
    ];
    const result = deriveProjectProgress(p, tasks);
    expect(result.source).toBe('tasks');
    expect(result.percent).toBe(50);
  });

  it('a manual override wins over everything else', () => {
    const p = project({ steps: [step('a', 'done'), step('b', 'open')], manualProgress: 0.9 });
    const result = deriveProjectProgress(p, []);
    expect(result.source).toBe('manual');
    expect(result.percent).toBe(90);
  });

  it('clamps a manual override into 0..1 instead of showing an impossible figure', () => {
    expect(deriveProjectProgress(project({ manualProgress: 4 }), []).percent).toBe(100);
    expect(deriveProjectProgress(project({ manualProgress: -2 }), []).percent).toBe(0);
  });

  it('excludes cancelled and archived tasks from both sides of the fraction', () => {
    const p = project();
    const tasks = [
      task('t1', { projectId: p.id, status: 'completed' }),
      task('t2', { projectId: p.id, status: 'cancelled' }),
      task('t3', { projectId: p.id, status: 'archived' })
    ];
    // If the dropped tasks counted as "not done" the figure would be 33%, which would
    // make a project look stuck because of work the user deliberately dropped.
    expect(projectTasks(p, tasks)).toHaveLength(1);
    expect(deriveProjectProgress(p, tasks).percent).toBe(100);
  });

  it('counts blocked steps separately from open ones', () => {
    const p = project({ steps: [step('a', 'blocked'), step('b', 'open'), step('c', 'done')] });
    expect(countSteps(p)).toEqual({ total: 3, done: 1, blocked: 1 });
  });
});

describe('health is stated only from evidence', () => {
  it('says unknown when there is nothing to judge', () => {
    const report = assessProjectHealth(project({ status: 'planned' }), [], '2026-03-10');
    expect(report.health).toBe('unknown');
    expect(report.reasonAr).toBe('');
  });

  it('is complete for a completed project', () => {
    expect(assessProjectHealth(project({ status: 'completed' }), [], '2026-03-10').health).toBe('complete');
  });

  it('is at risk when a step is blocked', () => {
    const p = project({ steps: [step('a', 'blocked')] });
    const report = assessProjectHealth(p, [], '2026-03-10');
    expect(report.health).toBe('at_risk');
    expect(report.reasonEn).toContain('blocked');
  });

  it('is at risk when an active project is past its target date', () => {
    const p = project({ targetDate: '2026-03-01' });
    const report = assessProjectHealth(p, [], '2026-03-10');
    expect(report.health).toBe('at_risk');
    expect(report.daysToTarget).toBe(-9);
    expect(report.reasonEn).toContain('overdue');
  });

  it('is stalled after three idle weeks with no change', () => {
    const p = project({ lastMeaningfulUpdateAt: '2026-02-01T10:00:00.000Z' });
    const report = assessProjectHealth(p, [], '2026-03-10');
    expect(report.health).toBe('stalled');
    expect(report.reasonEn).toContain('No change');
  });

  it('flags a target date inside the last week as at risk', () => {
    const p = project({ targetDate: '2026-03-13' });
    const report = assessProjectHealth(p, [], '2026-03-10');
    expect(report.health).toBe('at_risk');
    expect(report.daysToTarget).toBe(3);
  });

  it('reports on_track for a live project with no blockers and time left', () => {
    const p = project({ targetDate: '2026-06-01' });
    expect(assessProjectHealth(p, [], '2026-03-10').health).toBe('on_track');
  });

  it('never claims on_track for an archived project', () => {
    expect(assessProjectHealth(project({ status: 'archived' }), [], '2026-03-10').health).toBe('unknown');
  });
});

describe('next action names something real or nothing', () => {
  it('returns null when the project names no step and has no open tasks', () => {
    expect(nextAction(project(), [])).toBeNull();
  });

  it('picks the first open step in plan order', () => {
    const p = project({
      steps: [step('third', 'open', 2), step('first', 'open', 0), step('done', 'done', 1)]
    });
    const next = nextAction(p, []);
    expect(next?.kind).toBe('step');
    expect(next?.kind === 'step' && next.step.title).toBe('first');
  });

  it('falls back to the highest-priority open task when the plan is empty', () => {
    const p = project();
    const tasks = [
      task('low', { projectId: p.id, priority: 4 }),
      task('urgent', { projectId: p.id, priority: 1 }),
      task('finished', { projectId: p.id, priority: 1, status: 'completed' })
    ];
    const next = nextAction(p, tasks);
    expect(next?.kind).toBe('task');
    expect(next?.kind === 'task' && next.task.title).toBe('urgent');
  });
});

describe('projects persist and round-trip through backup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads projects through the storage engine', async () => {
    const { NuqtaStorageEngine } = await import('../src/lib/storage');
    const p = project({ title: 'Persisted' });
    NuqtaStorageEngine.saveProjects([p]);
    expect(NuqtaStorageEngine.getProjects()).toHaveLength(1);
    expect(NuqtaStorageEngine.getProjects()[0].title).toBe('Persisted');
    expect(NuqtaStorageEngine.getProjects()[0].steps).toEqual([]);
  });

  it('carries projects in a full backup and restores them', async () => {
    const { NuqtaStorageEngine } = await import('../src/lib/storage');
    NuqtaStorageEngine.saveProjects([project({ id: 'prj-a', title: 'A' })]);
    const file = NuqtaStorageEngine.exportFullBackup();
    const parsed = JSON.parse(file);
    expect(parsed.data.projects).toHaveLength(1);

    NuqtaStorageEngine.saveProjects([]);
    expect(NuqtaStorageEngine.getProjects()).toHaveLength(0);

    const result = NuqtaStorageEngine.importBackup(file);
    expect(result.ok).toBe(true);
    expect(NuqtaStorageEngine.getProjects()).toHaveLength(1);
    expect(NuqtaStorageEngine.getProjects()[0].title).toBe('A');
  });

  it('refuses a backup whose task points at a project that is not in the file', async () => {
    const { parseBackup } = await import('../src/lib/backupSchema');
    const envelope = {
      app: 'nuqta',
      version: 3,
      exportedAt: NOW,
      data: {
        tasks: [{ ...task('t1'), projectId: 'missing-project' }],
        habits: [],
        goals: [],
        projects: [],
        focusSessions: [],
        healthMetrics: {},
        expenses: [],
        savingsGoals: [],
        journalEntries: [],
        sundayReviews: [],
        historyAuditLogs: []
      }
    };
    const result = parseBackup(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.section).toBe('projectId');
  });

  it('accepts a backup whose project links resolve inside the file', async () => {
    const { parseBackup } = await import('../src/lib/backupSchema');
    const envelope = {
      app: 'nuqta',
      version: 3,
      exportedAt: NOW,
      data: {
        tasks: [{ ...task('t1'), projectId: 'prj-1' }],
        habits: [],
        goals: [],
        projects: [project({ id: 'prj-1', steps: [step('s1')] })],
        focusSessions: [],
        healthMetrics: {},
        expenses: [],
        savingsGoals: [],
        journalEntries: [],
        sundayReviews: [],
        historyAuditLogs: []
      }
    };
    expect(parseBackup(JSON.stringify(envelope)).ok).toBe(true);
  });

  it('a v2 file restores as a full replace, clearing projects it never knew about', async () => {
    const { NuqtaStorageEngine } = await import('../src/lib/storage');
    NuqtaStorageEngine.saveProjects([project({ id: 'old', title: 'Old' })]);

    const v2 = {
      app: 'nuqta',
      version: 2,
      exportedAt: NOW,
      data: {
        tasks: [task('t1')],
        habits: [],
        goals: [],
        focusSessions: [],
        healthMetrics: {},
        expenses: [],
        savingsGoals: [],
        journalEntries: [],
        sundayReviews: [],
        historyAuditLogs: []
      }
    };
    expect(NuqtaStorageEngine.importBackup(JSON.stringify(v2)).ok).toBe(true);
    // Restoring is a full replace for every section, and projects are no exception.
    // A v2 file predates the feature, so it describes a world without projects; the
    // alternative — silently keeping some sections and replacing others — would make
    // the result depend on which fields the file happened to omit.
    expect(NuqtaStorageEngine.getProjects()).toEqual([]);
  });
});
