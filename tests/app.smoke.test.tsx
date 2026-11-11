import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { localDateKey } from '../src/lib/dateKey';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 120)); });

describe('store on a first run', () => {
  it('starts empty: no tasks, no health record for today, no invented profile', () => {
    useNuqtaStore.getState().initializeStore();
    const s = useNuqtaStore.getState();
    expect(s.tasks).toEqual([]);
    expect(s.habits).toEqual([]);
    expect(s.goals).toEqual([]);
    expect(s.healthMetrics[localDateKey()]).toBeUndefined();
    expect(s.profile.name).toBe('');
    expect(s.profile.name).not.toBe('Tariq');
  });
  it('logging water creates a record that contains no invented measurements', () => {
    useNuqtaStore.getState().initializeStore();
    useNuqtaStore.getState().updateTodayHealth({ hydrationMl: 250 });
    const rec = useNuqtaStore.getState().healthMetrics[localDateKey()];
    expect(rec.hydrationMl).toBe(250);
    expect(rec.workoutLogged).toBe(false);
    expect(rec.sleepHours).toBe(0);
    expect(rec.weightKg).toBeUndefined();
  });
  it('deleting a goal clears dangling links on tasks and habits', () => {
    NuqtaStorageEngine.saveGoals([{ id: 'g', title: 'g', category: 'personal', timeframe: 'quarterly', keyResults: [], status: 'active', createdAt: '' } as any]);
    NuqtaStorageEngine.saveTasks([{ id: 't', title: 't', status: 'todo', priority: 'P2', linkedGoalId: 'g' } as any]);
    useNuqtaStore.getState().initializeStore();
    useNuqtaStore.getState().deleteGoal('g');
    expect(useNuqtaStore.getState().tasks[0].linkedGoalId).toBeUndefined();
  });
});

describe('the whole app renders', () => {
  it('renders on a clean first run without crashing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    await settle();
    expect(document.body.textContent!.length).toBeGreaterThan(50);
    expect(screen.queryByText(/Tariq/)).toBeNull();
    const fatal = err.mock.calls.filter((c) => /Uncaught|The above error occurred/.test(String(c[0])));
    expect(fatal).toEqual([]);
    err.mockRestore();
  });
  it('renders with the opt-in sample data', async () => {
    expect(NuqtaStorageEngine.loadDemoData()).toBe(true);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    await settle();
    await waitFor(() => expect(useNuqtaStore.getState().tasks.length).toBeGreaterThan(0));
    const fatal = err.mock.calls.filter((c) => /Uncaught|The above error occurred/.test(String(c[0])));
    expect(fatal).toEqual([]);
    err.mockRestore();
  });
  it('shows a visible warning when saving fails', async () => {
    render(<App />);
    await settle();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    try { await act(async () => { NuqtaStorageEngine.saveTasks([{ id: 'a', title: 'a' } as any]); }); } finally { Storage.prototype.setItem = orig; }
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
