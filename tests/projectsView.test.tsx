/**
 * Projects — the hub and the workspace, rendered from the real store.
 *
 * These tests exercise the parts a unit test cannot: that the derived figures reach
 * the screen, that an empty project says so instead of showing 0%, and that the
 * workspace writes through to the store rather than to component state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProjectsView } from '../src/components/ProjectsView';
import { applyRoute } from '../src/lib/navigation';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { getActiveDialog, settleDialog } from '../src/components/ui/dialogController';
import type { Project, Task } from '../src/types';

const S = () => useNuqtaStore.getState();
const NOW = '2026-03-10T09:00:00.000Z';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'prj-1',
  title: 'Launch the site',
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T10:00:00Z'));
  localStorage.clear();
  // The open project now lives in the URL, so the route is part of the fixture: without
  // this reset a test that opened a workspace would leak that destination into the next.
  window.location.hash = '';
  applyRoute({ tab: 'projects', view: null }, { updateHistory: false });
  let pending = getActiveDialog();
  while (pending) {
    settleDialog(pending.id, false);
    pending = getActiveDialog();
  }
  S().initializeStore();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ configured: false }), { status: 200 }))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const seedProjects = async (projects: Project[], tasks: Task[] = []) => {
  await act(async () => {
    useNuqtaStore.setState({ projects, tasks });
  });
};

describe('ProjectsView — empty state', () => {
  it('invites the first project and explains what a project is', async () => {
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText(/No projects yet/i)).toBeTruthy();
    expect(screen.getByText(/beginning and an end/i)).toBeTruthy();
  });
});

describe('ProjectsView — the hub', () => {
  it('shows the derived percentage from steps, not a placeholder', async () => {
    await seedProjects([
      project({
        steps: [
          { id: 's1', title: 'a', status: 'done', order: 0, taskIds: [], createdAt: NOW, updatedAt: NOW },
          { id: 's2', title: 'b', status: 'open', order: 1, taskIds: [], createdAt: NOW, updatedAt: NOW }
        ]
      })
    ]);
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText(/1\/2 steps/)).toBeTruthy();
  });

  it('shows a dash instead of 0% when there is nothing to measure', async () => {
    await seedProjects([project()]);
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText('—')).toBeTruthy();
    // "0%" would be a claim the project has done nothing; it has no plan at all.
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText(/No steps or tasks yet/i)).toBeTruthy();
  });

  it('names the next action when the project has one', async () => {
    await seedProjects([
      project({
        steps: [
          { id: 's1', title: 'Write the copy', status: 'open', order: 0, taskIds: [], createdAt: NOW, updatedAt: NOW }
        ]
      })
    ]);
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText('Write the copy')).toBeTruthy();
  });

  it('says so plainly when the project names no next action', async () => {
    await seedProjects([project()]);
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText(/No next action defined/i)).toBeTruthy();
  });

  it('filters by lifecycle status', async () => {
    await seedProjects([
      project({ id: 'p1', title: 'Live work', status: 'active' }),
      project({ id: 'p2', title: 'Finished work', status: 'completed' })
    ]);
    await act(async () => {
      render(<ProjectsView />);
    });
    expect(screen.getByText('Live work')).toBeTruthy();
    expect(screen.getByText('Finished work')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Completed/i }));
    });
    expect(screen.getByText('Finished work')).toBeTruthy();
    expect(screen.queryByText('Live work')).toBeNull();
  });

  it('searches inside steps and notes, not just titles', async () => {
    await seedProjects([
      project({
        title: 'Alpha',
        steps: [
          { id: 's1', title: 'Book the venue', status: 'open', order: 0, taskIds: [], createdAt: NOW, updatedAt: NOW }
        ]
      }),
      project({ id: 'p2', title: 'Beta' })
    ]);
    await act(async () => {
      render(<ProjectsView />);
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Search projects/i), { target: { value: 'venue' } });
    });
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('creates a project from the inline form and opens it', async () => {
    await act(async () => {
      render(<ProjectsView />);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /New project/i })[0]);
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Project name/i), { target: { value: 'Ship it' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));
    });

    expect(S().projects).toHaveLength(1);
    expect(S().projects[0].title).toBe('Ship it');
    // Creating lands in the workspace, because an empty project is a prompt to plan.
    expect(screen.getByText(/All projects/i)).toBeTruthy();
  });

  it('deletes a project only after confirmation, and keeps its tasks', async () => {
    await seedProjects([project()], [task('t1', { projectId: 'prj-1' })]);
    await act(async () => {
      render(<ProjectsView />);
    });

    const deleteButton = screen.getByTitle(/^Delete$/i);
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    const dialog = getActiveDialog();
    expect(dialog).toBeTruthy();
    expect(dialog?.options.description).toMatch(/Linked tasks are kept/i);
    await act(async () => {
      settleDialog(dialog!.id, true);
    });

    expect(S().projects).toHaveLength(0);
    expect(S().tasks).toHaveLength(1);
    expect(S().tasks[0].projectId).toBeUndefined();
  });
});

describe('ProjectWorkspace — writing through to the store', () => {
  const openWorkspace = async (p: Project, tasks: Task[] = []) => {
    await seedProjects([p], tasks);
    await act(async () => {
      render(<ProjectsView />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open workspace/i }));
    });
  };

  it('adds a phase and a step to the plan', async () => {
    await openWorkspace(project());
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Plan/i }));
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/^Add phase$/i), { target: { value: 'Research' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ Phase/i }));
    });

    expect(S().projects[0].phases).toHaveLength(1);
    expect(S().projects[0].phases[0].title).toBe('Research');

    const phaseInput = screen.getByPlaceholderText(/Step in phase/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(phaseInput, { target: { value: 'Interview users' } });
    });
    await act(async () => {
      fireEvent.keyDown(phaseInput, { key: 'Enter' });
    });

    expect(S().projects[0].steps).toHaveLength(1);
    expect(S().projects[0].steps[0].phaseId).toBe(S().projects[0].phases[0].id);
  });

  it('records a note and turns it into a step', async () => {
    await openWorkspace(project());
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Notes & Ideas/i }));
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/^Add note$/i), { target: { value: 'Maybe a newsletter' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ Add/i }));
    });
    expect(S().projects[0].notes).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Turn into step/i }));
    });

    const after = S().projects[0];
    expect(after.steps).toHaveLength(1);
    expect(after.steps[0].title).toBe('Maybe a newsletter');
    // The note stays as the trace of where the step came from.
    expect(after.notes).toHaveLength(1);
    expect(after.notes[0].convertedToStepId).toBe(after.steps[0].id);
  });

  it('changes the lifecycle status from the header', async () => {
    await openWorkspace(project());
    const select = screen.getByLabelText(/Project status/i);
    await act(async () => {
      fireEvent.change(select, { target: { value: 'completed' } });
    });
    expect(S().projects[0].status).toBe('completed');
    expect(S().projects[0].completedAt).toBeTruthy();
  });

  it('shows recorded activity, and says nothing was recorded before tracking began', async () => {
    await openWorkspace(project());
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Activity/i }));
    });
    expect(screen.getByText(/No recorded activity/i)).toBeTruthy();
  });

  it('goes back to the hub without losing the project', async () => {
    await openWorkspace(project());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /All projects/i }));
    });
    expect(screen.getByText('Launch the site')).toBeTruthy();
    expect(S().projects).toHaveLength(1);
  });
});

describe('ProjectWorkspace — the project is a destination, not component state', () => {
  it('restores the open workspace from the URL after a reload', async () => {
    await seedProjects([project()], []);
    // A deep link, exactly as a refresh or a shared link would arrive.
    window.location.hash = '#/projects/prj-1';
    applyRoute({ tab: 'projects', view: 'prj-1' }, { updateHistory: false });

    await act(async () => {
      render(<ProjectsView />);
    });

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open workspace/i })).toBeNull();
  });

  it('lands on the hub when the linked project no longer exists', async () => {
    await seedProjects([], []);
    window.location.hash = '#/projects/gone';
    applyRoute({ tab: 'projects', view: 'gone' }, { updateHistory: false });

    await act(async () => {
      render(<ProjectsView />);
    });

    expect(screen.getByText(/No projects yet/i)).toBeTruthy();
    expect(window.location.hash).toBe('#/projects');
  });

  it('opens the project a focus request names, instead of stopping at the hub', async () => {
    await seedProjects([project()], []);
    await act(async () => {
      render(<ProjectsView />);
    });

    await act(async () => {
      S().requestFocus('projects', 'prj-1');
    });

    expect(window.location.hash).toBe('#/projects/prj-1');
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeTruthy();
    // The request is consumed, so it cannot re-open the project on every later render.
    expect(S().focusRequest).toBeNull();
  });
});

describe('ProjectWorkspace — dates and task links', () => {
  const openWorkspace = async (p: Project, tasks: Task[] = []) => {
    await seedProjects([p], tasks);
    await act(async () => {
      render(<ProjectsView />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open workspace/i }));
    });
  };

  it('writes the project start and target dates to the record', async () => {
    await openWorkspace(project());

    // The pickers are the branded control, so the date is chosen the way a person
    // chooses it: open the calendar, then press the day.
    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: /^Start date$/i }));
    });
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: '2026-03-01' }));
    });
    expect(S().projects[0].startDate).toBe('2026-03-01');

    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: /^Target date$/i }));
    });
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: '2026-03-20' }));
    });
    expect(S().projects[0].targetDate).toBe('2026-03-20');
  });

  it('links an existing task without moving it out of the Tasks module', async () => {
    await openWorkspace(project(), [task('t1')]);

    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: /Link a task to this project/i }));
    });
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('option', { name: 't1' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Link$/i }));
    });

    const linked = S().tasks.find((x) => x.id === 't1');
    expect(linked?.projectId).toBe('prj-1');
    expect(S().tasks).toHaveLength(1);
  });
});

describe('the status pill resolves for every lifecycle state', () => {
  /*
   * The pill builds its class from `statusTone[status]`. When a tone has no CSS token the
   * browser drops the unresolved `var()` and the pill silently loses its background — so
   * the assertion is on the token name being one the stylesheet actually declares.
   */
  it('names a tone for every status, and each one is a declared token', async () => {
    const { statusTone } = await import('../src/lib/projectLabels');
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/index.css', 'utf8');

    for (const [status, tone] of Object.entries(statusTone)) {
      expect(css, `--tone-${tone} is used by status '${status}'`).toContain(`--tone-${tone}:`);
    }
  });
});
