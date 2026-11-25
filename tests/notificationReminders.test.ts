import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNuqtaReminders } from '../src/lib/useNuqtaReminders';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { localDateKey } from '../src/lib/dateKey';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

/** Freeze the clock at a given local wall time so "due now" is deterministic. */
function freezeAt(hours: number, minutes: number) {
  const fixed = new Date();
  fixed.setHours(hours, minutes, 0, 0);
  vi.setSystemTime(fixed);
}

const baseTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Write the report',
  status: 'todo',
  priority: 1,
  scheduledDate: localDateKey(),
  scheduledTime: '09:00',
  estimatedMinutes: 30,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

describe('useNuqtaReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useNuqtaStore.setState({
      tasks: [],
      habits: [],
      notifications: [],
      notificationPreferences: NuqtaStorageEngine.getNotificationPreferences(),
      profile: { ...useNuqtaStore.getState().profile, language: 'en' }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('raises a notification for a task whose due time has arrived', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({ tasks: [baseTask() as never] });

    renderHook(() => useNuqtaReminders());
    await settle();

    const { notifications } = useNuqtaStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].category).toBe('task');
    expect(notifications[0].route).toEqual({ nav: 'tasks', entityId: 'task-1' });
    // Priority 1 is an Eisenhower "do first" quadrant, so the row is flagged important.
    expect(notifications[0].priority).toBe('high');
    expect(notifications[0].title).toContain('Write the report');
  });

  it('does not raise anything for a task scheduled later today', async () => {
    freezeAt(7, 0);
    useNuqtaStore.setState({ tasks: [baseTask({ scheduledTime: '18:00' }) as never] });

    renderHook(() => useNuqtaReminders());
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
  });

  it('does not raise anything for a completed task', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({ tasks: [baseTask({ status: 'completed' }) as never] });

    renderHook(() => useNuqtaReminders());
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
  });

  it('does not repeat the reminder on the next ticker pass', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({ tasks: [baseTask() as never] });

    renderHook(() => useNuqtaReminders());
    await settle();
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);

    // Let the 20-second interval fire a few times.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
  });

  it('does not re-notify after a remount, because dedupe lives in the stored row', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({ tasks: [baseTask() as never] });

    const first = renderHook(() => useNuqtaReminders());
    await settle();
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    first.unmount();

    // A fresh mount has an empty in-memory guard; only the persisted dedupeKey stops it.
    const second = renderHook(() => useNuqtaReminders());
    await settle();
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    second.unmount();
  });

  it('raises the morning habit cue only for habits actually due today', async () => {
    freezeAt(8, 0);
    useNuqtaStore.setState({
      habits: [
        {
          id: 'h-1',
          name: 'Stretch',
          timeOfDay: 'morning',
          completedDates: [],
          isArchived: false,
          status: 'active',
          schedule: { type: 'daily' },
          createdAt: new Date().toISOString()
        } as never
      ]
    });

    renderHook(() => useNuqtaReminders());
    await settle();

    const { notifications } = useNuqtaStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].category).toBe('habit');
    expect(notifications[0].route).toEqual({ nav: 'habits' });
    expect(notifications[0].body).toContain('Stretch');
  });

  it('skips the morning cue when the only morning habit is already done', async () => {
    freezeAt(8, 0);
    const today = localDateKey();
    useNuqtaStore.setState({
      habits: [
        {
          id: 'h-1',
          name: 'Stretch',
          timeOfDay: 'morning',
          completedDates: [today],
          isArchived: false,
          status: 'active',
          schedule: { type: 'daily' },
          createdAt: new Date().toISOString()
        } as never
      ]
    });

    renderHook(() => useNuqtaReminders());
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
  });

  it('does not deliver to the browser unless the optional channel is on', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({
      tasks: [baseTask() as never],
      notificationPreferences: { inApp: true, browser: false, categories: {} }
    });

    const notifySpy = vi.fn();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notifySpy, { permission: 'granted', requestPermission: async () => 'granted' })
    });

    renderHook(() => useNuqtaReminders());
    await settle();

    // The in-app row exists...
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    // ...but nothing was mirrored to the OS channel.
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('mirrors to the browser when the channel and permission allow it', async () => {
    freezeAt(9, 5);
    useNuqtaStore.setState({
      tasks: [baseTask() as never],
      notificationPreferences: { inApp: true, browser: true, categories: {} }
    });

    const notifySpy = vi.fn();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notifySpy, { permission: 'granted', requestPermission: async () => 'granted' })
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined
    });

    renderHook(() => useNuqtaReminders());
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('stays silent on the browser channel during quiet hours but still records in-app', async () => {
    // 23:10 keeps the task inside the 15-minute catch-up window.
    freezeAt(23, 10);
    useNuqtaStore.setState({
      tasks: [baseTask({ scheduledTime: '23:00' }) as never],
      notificationPreferences: {
        inApp: true,
        browser: true,
        categories: {},
        quietHours: { enabled: true, start: '22:00', end: '07:00' }
      }
    });

    const notifySpy = vi.fn();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notifySpy, { permission: 'granted', requestPermission: async () => 'granted' })
    });

    renderHook(() => useNuqtaReminders());
    await settle();

    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
