import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

/** Render the app straight into Profile, where the settings panel lives. */
async function openProfile() {
  useNuqtaStore.getState().setActiveNavTab('today');
  render(<App />);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: /Local profile|الملف الشخصي/i }));
  await settle();
}

const settingsSection = () =>
  screen.getByRole('heading', { level: 2, name: /Notifications & Audio Alerts/ })
    .closest('.settings-section') as HTMLElement;

describe('notification settings in Profile', () => {
  beforeEach(() => {
    useNuqtaStore.setState({
      notifications: [],
      notificationPreferences: NuqtaStorageEngine.getNotificationPreferences()
    });
    // Default browser permission so the device-alert control is a plain toggle.
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(vi.fn(), {
        permission: 'granted',
        requestPermission: async () => 'granted'
      })
    });
  });

  it('states that in-app notifications are always on', async () => {
    await openProfile();
    const section = settingsSection();
    expect(within(section).getByText(/always appear inside NUQTA/i)).toBeTruthy();
  });

  it('turns a category off and persists the choice', async () => {
    await openProfile();
    const section = settingsSection();

    const tasks = within(section).getByRole('checkbox', { name: 'Tasks' });
    expect((tasks as HTMLInputElement).checked).toBe(true);

    fireEvent.click(tasks);
    await settle();

    expect((tasks as HTMLInputElement).checked).toBe(false);
    expect(NuqtaStorageEngine.getNotificationPreferences().categories.task).toBe(false);
  });

  it('suppresses a new notification from a switched-off category', async () => {
    await openProfile();
    const section = settingsSection();
    fireEvent.click(within(section).getByRole('checkbox', { name: 'Goals' }));
    await settle();

    const added = useNuqtaStore.getState().notify({
      category: 'goal',
      title: 'Goal completed',
      dedupeKey: 'goal:1'
    });
    expect(added).toBe(false);
    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
  });

  it('still records a notification from a category that stays on', async () => {
    await openProfile();
    const section = settingsSection();
    fireEvent.click(within(section).getByRole('checkbox', { name: 'Goals' }));
    await settle();

    const added = useNuqtaStore.getState().notify({
      category: 'task',
      title: 'Task due',
      dedupeKey: 'task:1'
    });
    expect(added).toBe(true);
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
  });

  it('reveals the quiet-hours pickers only when quiet hours are enabled', async () => {
    await openProfile();
    const section = settingsSection();

    expect(within(section).queryByLabelText('Quiet hours start')).toBeNull();

    fireEvent.click(within(section).getByRole('checkbox', { name: 'Quiet hours' }));
    await settle();

    expect(within(section).getByLabelText('Quiet hours start')).toBeTruthy();
    expect(within(section).getByLabelText('Quiet hours end')).toBeTruthy();

    const prefs = NuqtaStorageEngine.getNotificationPreferences();
    expect(prefs.quietHours).toEqual({ enabled: true, start: '22:00', end: '07:00' });
  });

  it('explains that quiet hours only silence device alerts', async () => {
    await openProfile();
    const section = settingsSection();

    expect(
      within(section).getByText(/Device alerts are not sent during this window/i)
    ).toBeTruthy();
    expect(within(section).getByText(/still saved in the Notification Center/i)).toBeTruthy();
  });

  it('keeps quiet hours when the toggle is switched back off', async () => {
    await openProfile();
    const section = settingsSection();
    const toggle = within(section).getByRole('checkbox', { name: 'Quiet hours' });

    fireEvent.click(toggle);
    await settle();
    fireEvent.click(toggle);
    await settle();

    expect(within(section).queryByLabelText('Quiet hours start')).toBeNull();
    expect(NuqtaStorageEngine.getNotificationPreferences().quietHours?.enabled).toBe(false);
  });

  it('sends a test notification that lands in the inbox', async () => {
    await openProfile();
    const section = settingsSection();

    fireEvent.click(within(section).getByRole('button', { name: /Send a test notification/ }));
    await settle();

    const { notifications } = useNuqtaStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].meta?.messageId).toBe('system.test');
  });

  it('shows an honest blocked state when the browser has denied permission', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(vi.fn(), { permission: 'denied', requestPermission: async () => 'denied' })
    });

    await openProfile();
    const section = settingsSection();

    expect(within(section).getByText(/Blocked in browser settings/i)).toBeTruthy();
    // A blocked channel offers no toggle, because flipping it would promise nothing.
    expect(within(section).queryByRole('checkbox', { name: 'Device alerts' })).toBeNull();
  });
});
