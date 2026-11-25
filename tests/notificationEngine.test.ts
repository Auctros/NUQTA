import { describe, it, expect } from 'vitest';
import {
  addNotification,
  dismissNotification,
  isCategoryEnabled,
  isExpired,
  isQuietHours,
  isUnread,
  isVisible,
  markAllRead,
  markRead,
  markUnread,
  pruneNotifications,
  shouldDeliverToBrowser,
  sortNotifications,
  unreadCount,
  MAX_NOTIFICATIONS
} from '../src/lib/notificationEngine';
import type { AppNotification, NotificationPreferences } from '../src/types';

const prefs = (overrides: Partial<Omit<NotificationPreferences, 'inApp'>> = {}): NotificationPreferences => ({
  inApp: true,
  browser: false,
  categories: {},
  ...overrides
});

const draft = (overrides: Record<string, unknown> = {}) => ({
  category: 'task' as const,
  priority: 'normal' as const,
  title: 'Title',
  body: 'Body',
  dedupeKey: 'task:1:due:2026-01-01:09:00',
  ...overrides
});

const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  category: 'task',
  priority: 'normal',
  title: 'Title',
  body: 'Body',
  createdAt: '2026-01-01T09:00:00.000Z',
  dedupeKey: 'k1',
  ...overrides
});

describe('addNotification', () => {
  it('creates a row with a stable dedupe key and an id', () => {
    const outcome = addNotification([], draft(), { prefs: prefs() });
    expect(outcome.added).toBe(true);
    if (!outcome.added) throw new Error('unreachable');
    expect(outcome.notification.dedupeKey).toBe('task:1:due:2026-01-01:09:00');
    expect(outcome.notification.id).toBeTruthy();
    expect(outcome.list).toHaveLength(1);
  });

  it('rejects a duplicate dedupe key instead of stacking rows', () => {
    const first = addNotification([], draft(), { prefs: prefs() });
    if (!first.added) throw new Error('unreachable');
    const second = addNotification(first.list, draft({ title: 'Again' }), { prefs: prefs() });
    expect(second.added).toBe(false);
    expect(second.list).toHaveLength(1);
    expect(second.list[0].title).toBe('Title');
  });

  it('keeps a dismissed event suppressed until the row expires', () => {
    const first = addNotification([], draft({ ttlMinutes: 120 }), { prefs: prefs() });
    if (!first.added) throw new Error('unreachable');
    const at = new Date(first.notification.createdAt);

    const dismissed = dismissNotification(first.list, first.notification.id, at);
    // Same event, twenty seconds later, as the ticker would raise it after a reload.
    const later = new Date(at.getTime() + 20_000);
    const again = addNotification(dismissed, draft({ ttlMinutes: 120 }), { now: later, prefs: prefs() });

    expect(again.added).toBe(false);
    expect(again.list).toHaveLength(1);
  });

  it('notifies the same event again once the dismissed row has expired', () => {
    const first = addNotification([], draft({ ttlMinutes: 60 }), { prefs: prefs() });
    if (!first.added) throw new Error('unreachable');
    const at = new Date(first.notification.createdAt);
    const dismissed = dismissNotification(first.list, first.notification.id, at);

    // Two hours on: the row is past its expiry, so the event is new again.
    const afterExpiry = new Date(at.getTime() + 2 * 60 * 60 * 1000);
    const again = addNotification(dismissed, draft({ ttlMinutes: 60 }), { now: afterExpiry, prefs: prefs() });

    expect(again.added).toBe(true);
    expect(again.list).toHaveLength(1);
  });

  it('rejects when the category is switched off', () => {
    const outcome = addNotification([], draft(), {
      prefs: prefs({ categories: { task: false } })
    });
    expect(outcome.added).toBe(false);
    expect(outcome.list).toHaveLength(0);
  });

  it('always keeps the in-app channel on, so a category switch is the only gate', () => {
    // `inApp` is typed as the literal `true`: the inbox is not an optional channel.
    const outcome = addNotification([], draft(), { prefs: prefs() });
    expect(outcome.added).toBe(true);
  });

  it('caps the inbox at MAX_NOTIFICATIONS, dropping the oldest', () => {
    let list: AppNotification[] = [];
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < MAX_NOTIFICATIONS + 5; i++) {
      const outcome = addNotification(
        list,
        draft({
          dedupeKey: `k-${i}`,
          title: `T${i}`,
          // Distinct instants so "oldest" is well defined.
          createdAt: new Date(base + i * 60_000).toISOString()
        }),
        { prefs: prefs() }
      );
      if (!outcome.added) throw new Error('expected add');
      list = outcome.list;
    }
    expect(list.length).toBe(MAX_NOTIFICATIONS);
    // The five oldest are evicted; the newest survives.
    expect(list.some((n) => n.title === 'T0')).toBe(false);
    expect(list.some((n) => n.title === 'T4')).toBe(false);
    expect(list.some((n) => n.title === 'T5')).toBe(true);
    expect(list.some((n) => n.title === `T${MAX_NOTIFICATIONS + 4}`)).toBe(true);
  });

  it('evicts read rows before unread ones when the cap is hit', () => {
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    let list: AppNotification[] = [];
    for (let i = 0; i < MAX_NOTIFICATIONS; i++) {
      const outcome = addNotification(
        list,
        draft({ dedupeKey: `k-${i}`, title: `T${i}`, createdAt: new Date(base + i * 60_000).toISOString() }),
        { prefs: prefs() }
      );
      if (!outcome.added) throw new Error('expected add');
      list = outcome.list;
    }
    // The oldest row is read; it should be the one sacrificed for a new arrival.
    list = markRead(list, list.find((n) => n.title === 'T0')!.id);
    const outcome = addNotification(
      list,
      draft({ dedupeKey: 'fresh', title: 'Fresh', createdAt: new Date(base + 10_000_000).toISOString() }),
      { prefs: prefs() }
    );
    if (!outcome.added) throw new Error('expected add');
    expect(outcome.list.length).toBe(MAX_NOTIFICATIONS);
    expect(outcome.list.some((n) => n.title === 'T0')).toBe(false);
    expect(outcome.list.some((n) => n.title === 'T1')).toBe(true);
  });

  it('prunes expired rows while adding', () => {
    const expired = notification({ id: 'old', expiresAt: '2000-01-01T00:00:00.000Z', dedupeKey: 'old' });
    const outcome = addNotification([expired], draft(), { prefs: prefs() });
    expect(outcome.added).toBe(true);
    expect(outcome.list.some((n) => n.id === 'old')).toBe(false);
  });
});

describe('read state', () => {
  it('marks a row read and back to unread', () => {
    const list = [notification()];
    expect(isUnread(list[0])).toBe(true);

    const read = markRead(list, 'n1');
    expect(read[0].readAt).toBeTruthy();
    expect(isUnread(read[0])).toBe(false);
    expect(unreadCount(read)).toBe(0);

    const unread = markUnread(read, 'n1');
    expect(unread[0].readAt).toBeUndefined();
    expect(unreadCount(unread)).toBe(1);
  });

  it('is a no-op for an unknown id', () => {
    const list = [notification()];
    expect(markRead(list, 'missing')).toBe(list);
  });

  it('marks every visible row read at once', () => {
    const list = [notification({ id: 'a', dedupeKey: 'a' }), notification({ id: 'b', dedupeKey: 'b' })];
    const read = markAllRead(list);
    expect(unreadCount(read)).toBe(0);
  });
});

describe('expiry and visibility', () => {
  it('treats a past expiresAt as expired', () => {
    const n = notification({ expiresAt: '2000-01-01T00:00:00.000Z' });
    expect(isExpired(n, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(isVisible(n, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('keeps a future expiresAt visible', () => {
    const n = notification({ expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(isVisible(n, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('hides dismissed rows from the inbox but keeps them for pruning', () => {
    const list = [notification()];
    const dismissed = dismissNotification(list, 'n1');
    expect(isVisible(dismissed[0])).toBe(false);
    expect(dismissed).toHaveLength(1);
  });

  it('prune removes expired and long-dismissed rows only', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const list = [
      notification({ id: 'live', dedupeKey: 'live' }),
      notification({ id: 'expired', dedupeKey: 'expired', expiresAt: '2025-01-01T00:00:00.000Z' }),
      notification({ id: 'fresh-dismissed', dedupeKey: 'fd', dismissedAt: '2025-12-31T00:00:00.000Z' }),
      notification({ id: 'stale-dismissed', dedupeKey: 'sd', dismissedAt: '2020-01-01T00:00:00.000Z' })
    ];
    const ids = pruneNotifications(list, now).map((n) => n.id);
    expect(ids).toContain('live');
    expect(ids).toContain('fresh-dismissed');
    expect(ids).not.toContain('expired');
    expect(ids).not.toContain('stale-dismissed');
  });
});

describe('ordering', () => {
  it('sorts newest first', () => {
    const list = [
      notification({ id: 'mid', dedupeKey: 'm', createdAt: '2026-01-02T00:00:00.000Z' }),
      notification({ id: 'new', dedupeKey: 'n', createdAt: '2026-01-03T00:00:00.000Z' }),
      notification({ id: 'old', dedupeKey: 'o', createdAt: '2026-01-01T00:00:00.000Z' })
    ];
    expect(sortNotifications(list).map((n) => n.id)).toEqual(['new', 'mid', 'old']);
  });

  it('does not mutate the input', () => {
    const list = [
      notification({ id: 'a', dedupeKey: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      notification({ id: 'b', dedupeKey: 'b', createdAt: '2026-01-02T00:00:00.000Z' })
    ];
    sortNotifications(list);
    expect(list.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('preferences gating', () => {
  it('defaults a category to enabled when unset', () => {
    expect(isCategoryEnabled(prefs(), 'task')).toBe(true);
  });

  it('honours an explicit opt-out', () => {
    expect(isCategoryEnabled(prefs({ categories: { task: false } }), 'task')).toBe(false);
  });

  it('delivers to the browser only when both switches allow it', () => {
    expect(shouldDeliverToBrowser(prefs({ browser: false }), 'task')).toBe(false);
    expect(shouldDeliverToBrowser(prefs({ browser: true }), 'task')).toBe(true);
    expect(shouldDeliverToBrowser(prefs({ browser: true, categories: { task: false } }), 'task')).toBe(false);
  });

  it('suppresses browser delivery during quiet hours, including a window past midnight', () => {
    const lateNight = prefs({ browser: true, quietHours: { enabled: true, start: '22:00', end: '07:00' } });
    expect(isQuietHours(lateNight, new Date('2026-01-01T23:30:00'))).toBe(true);
    expect(isQuietHours(lateNight, new Date('2026-01-01T02:00:00'))).toBe(true);
    expect(isQuietHours(lateNight, new Date('2026-01-01T12:00:00'))).toBe(false);

    const midday = prefs({ browser: true, quietHours: { enabled: true, start: '09:00', end: '17:00' } });
    expect(isQuietHours(midday, new Date('2026-01-01T12:00:00'))).toBe(true);
    expect(isQuietHours(midday, new Date('2026-01-01T18:00:00'))).toBe(false);
  });

  it('never treats quiet hours as blocking the in-app channel', () => {
    const quiet = prefs({ quietHours: { enabled: true, start: '00:00', end: '23:59' } });
    const outcome = addNotification([], draft(), { prefs: quiet });
    expect(outcome.added).toBe(true);
  });
});
