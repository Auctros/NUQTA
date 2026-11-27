import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

// jsdom has no canvas backend, so the real confetti throws on its first frame.
vi.mock('canvas-confetti', () => ({ default: () => {} }));

beforeEach(() => {
  useNuqtaStore.setState((state) => ({ profile: { ...state.profile, language: 'en' } }));
});

/**
 * These exercise the real view → real store path. A native window.confirm cannot be
 * clicked in jsdom, so if any of these flows still used one the dialog would never
 * appear and the assertion would fail.
 */
describe('Destructive actions ask through the in-app dialog', () => {
  it('clears this device only after the in-app dialog is confirmed', async () => {
    NuqtaStorageEngine.saveTasks([
      { id: 'keep-1', title: 'A task', status: 'todo', priority: 'medium' } as never
    ]);
    useNuqtaStore.getState().setActiveNavTab('profile');
    render(<App />);
    await settle();

    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload }
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear data on this device/i }));
    await settle();

    // The branded dialog — not a browser prompt — is on screen.
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-nuqta-dialog')).toBe('confirm');
    expect(dialog.textContent).toContain('Clear data on this device?');

    // Cancelling must leave the data untouched.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(NuqtaStorageEngine.getTasks()).toHaveLength(1);
    expect(reload).not.toHaveBeenCalled();

    // Confirming wipes and reloads.
    fireEvent.click(screen.getByRole('button', { name: /Clear data on this device/i }));
    await settle();
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Clear this device' }));
    await waitFor(() => expect(NuqtaStorageEngine.getTasks()).toHaveLength(0));
    expect(reload).toHaveBeenCalled();
  });
});

describe('Deleting an art project asks through the in-app dialog', () => {
  const seedProject = () => {
    NuqtaStorageEngine.saveHabits([
      {
        id: 'h-art-1',
        name: 'Sketch practice',
        anchor: 'evening',
        location: '',
        timeOfDay: 'evening',
        frequency: 'daily',
        category: 'mind',
        targetPerDay: 1,
        unit: 'time',
        currentStreak: 0,
        longestStreak: 0,
        freezesRemaining: 2,
        freezesUsedDates: [],
        completedDates: [],
        specializedType: 'drawing',
        drawingData: {
          weeklyTargetHours: 3,
          totalDrawingMinutes: 0,
          totalSketches: 0,
          favoriteMedium: 'sketch',
          projects: [
            {
              id: 'proj-1',
              title: 'Desert Series',
              stage: 'sketching',
              medium: 'sketch',
              startedDate: '2026-01-01',
              thumbnailColor: '#4d7c0f',
              totalMinutesSpent: 0,
              sessionsCount: 0,
              tags: []
            }
          ],
          pieces: []
        },
        createdAt: '2026-01-01T00:00:00.000Z'
      } as never
    ]);
    useNuqtaStore.setState({ habits: NuqtaStorageEngine.getHabits() });
  };

  it('keeps the project when cancelled and removes it when confirmed', async () => {
    seedProject();
    useNuqtaStore.getState().setActiveNavTab('drawing');
    render(<App />);
    await settle();

    fireEvent.click(await screen.findByRole('tab', { name: /^Projects/i }));
    await settle();
    fireEvent.click(await screen.findByRole('button', { name: /Desert Series/i }));
    await settle();

    fireEvent.click(await screen.findByRole('button', { name: /Delete project/i }));
    await settle();

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Delete this project?');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(NuqtaStorageEngine.getHabits()[0].drawingData?.projects).toHaveLength(1);

    fireEvent.click(await screen.findByRole('button', { name: /Delete project/i }));
    await settle();
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(NuqtaStorageEngine.getHabits()[0].drawingData?.projects).toHaveLength(0)
    );
  });
});

describe('Saving a reflection reports through the unified feedback layer', () => {
  it('shows a success toast inside the app instead of a browser alert', async () => {
    useNuqtaStore.getState().setActiveNavTab('journal');
    render(<App />);
    await settle();

    const well = screen.getByLabelText(/What went well today/i);
    fireEvent.change(well, { target: { value: 'Finished the draft' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Entry/i }));
    await settle();

    const toast = await screen.findByText('Reflection saved locally.');
    expect(toast.closest('[role="status"]')).not.toBeNull();
  });
});
