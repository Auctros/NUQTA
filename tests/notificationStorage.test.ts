import { describe, it, expect, beforeEach } from 'vitest';
import { NuqtaStorageEngine, defaultNotificationPreferences } from '../src/lib/storage';

// The keys are private to the storage module; these are the literal names it uses.
const NOTIFICATIONS_KEY = 'nuqta_notifications_v1';
const PREFS_KEY = 'nuqta_notification_prefs_v1';
import type { AppNotification } from '../src/types';

const sample = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'ntf-1',
  category: 'task',
  priority: 'normal',
  title: 'Task due',
  body: 'Finish the report',
  createdAt: '2026-01-01T09:00:00.000Z',
  dedupeKey: 'task:1:due',
  ...overrides
});

describe('notification persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a notification list', () => {
    NuqtaStorageEngine.saveNotifications([sample()]);
    const read = NuqtaStorageEngine.getNotifications();
    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({ id: 'ntf-1', dedupeKey: 'task:1:due', title: 'Task due' });
  });

  it('returns an empty list when nothing is stored', () => {
    expect(NuqtaStorageEngine.getNotifications()).toEqual([]);
  });

  it('keeps read and dismissed timestamps across a save', () => {
    NuqtaStorageEngine.saveNotifications([
      sample({ readAt: '2026-01-01T10:00:00.000Z', dismissedAt: '2026-01-01T11:00:00.000Z' })
    ]);
    const [row] = NuqtaStorageEngine.getNotifications();
    expect(row.readAt).toBe('2026-01-01T10:00:00.000Z');
    expect(row.dismissedAt).toBe('2026-01-01T11:00:00.000Z');
  });

  it('treats a corrupt stored value as an empty inbox instead of throwing', () => {
    localStorage.setItem(NOTIFICATIONS_KEY, '{not json');
    expect(() => NuqtaStorageEngine.getNotifications()).not.toThrow();
    expect(NuqtaStorageEngine.getNotifications()).toEqual([]);
  });

  it('stores notifications under their own key, separate from preferences', () => {
    NuqtaStorageEngine.saveNotifications([sample()]);
    expect(localStorage.getItem(NOTIFICATIONS_KEY)).toBeTruthy();
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
  });
});

describe('notification preferences', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to in-app on, browser off, no overrides', () => {
    const prefs = NuqtaStorageEngine.getNotificationPreferences();
    expect(prefs).toEqual(defaultNotificationPreferences());
    expect(prefs.inApp).toBe(true);
    expect(prefs.browser).toBe(false);
    expect(prefs.categories).toEqual({});
  });

  it('round-trips a full preference record', () => {
    NuqtaStorageEngine.saveNotificationPreferences({
      inApp: true,
      browser: true,
      categories: { task: false, focus: true },
      quietHours: { enabled: true, start: '22:00', end: '07:00' }
    });

    const prefs = NuqtaStorageEngine.getNotificationPreferences();
    expect(prefs.browser).toBe(true);
    expect(prefs.categories).toEqual({ task: false, focus: true });
    expect(prefs.quietHours).toEqual({ enabled: true, start: '22:00', end: '07:00' });
  });

  it('forces the in-app channel on even if a stored record claims otherwise', () => {
    // `inApp` is a literal `true` in the type; a tampered value must not disable the inbox.
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ inApp: false, browser: true, categories: {} })
    );
    const prefs = NuqtaStorageEngine.getNotificationPreferences();
    expect(prefs.inApp).toBe(true);
    expect(prefs.browser).toBe(true);
  });

  it('ignores malformed quiet hours rather than trusting them', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ inApp: true, browser: true, categories: {}, quietHours: { enabled: true, start: '25:00', end: 'x' } })
    );
    expect(NuqtaStorageEngine.getNotificationPreferences().quietHours).toBeUndefined();
  });

  it('drops non-boolean category values', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ inApp: true, browser: false, categories: { task: 'yes', focus: false } })
    );
    expect(NuqtaStorageEngine.getNotificationPreferences().categories).toEqual({ focus: false });
  });

  it('falls back to defaults for a corrupt record', () => {
    localStorage.setItem(PREFS_KEY, 'not json');
    expect(() => NuqtaStorageEngine.getNotificationPreferences()).not.toThrow();
    expect(NuqtaStorageEngine.getNotificationPreferences()).toEqual(defaultNotificationPreferences());
  });

  it('writing preferences does not disturb the stored notification list', () => {
    NuqtaStorageEngine.saveNotifications([sample()]);
    NuqtaStorageEngine.saveNotificationPreferences({ inApp: true, browser: true, categories: {} });

    expect(NuqtaStorageEngine.getNotifications()).toHaveLength(1);
    expect(NuqtaStorageEngine.getNotificationPreferences().browser).toBe(true);
  });
});

describe('wiping local data', () => {
  it('clears notifications and preferences along with everything else', async () => {
    NuqtaStorageEngine.saveNotifications([sample()]);
    NuqtaStorageEngine.saveNotificationPreferences({ inApp: true, browser: true, categories: {} });

    await NuqtaStorageEngine.wipeAll();

    expect(NuqtaStorageEngine.getNotifications()).toEqual([]);
    expect(NuqtaStorageEngine.getNotificationPreferences()).toEqual(defaultNotificationPreferences());
  });
});
