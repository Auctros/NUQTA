import { describe, it, expect, beforeEach, vi } from 'vitest';

// `toggleGoalMilestone` fires confetti; jsdom has no canvas, and the animation frame it
// schedules would surface as an unhandled error unrelated to what these tests assert.
vi.mock('canvas-confetti', () => ({ default: () => {} }));
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { unreadCount, isUnread } from '../src/lib/notificationEngine';

const reset = () => {
  useNuqtaStore.setState({
    notifications: [],
    notificationPreferences: NuqtaStorageEngine.getNotificationPreferences()
  });
};

const draft = (overrides: Record<string, unknown> = {}) => ({
  category: 'task' as const,
  title: 'Task due',
  body: 'Do the thing',
  dedupeKey: 'task:1:due:2026-01-01:09:00',
  ...overrides
});

describe('notification store actions', () => {
  beforeEach(reset);

  it('adds a notification and persists it', () => {
    const added = useNuqtaStore.getState().notify(draft());
    expect(added).toBe(true);

    const { notifications } = useNuqtaStore.getState();
    expect(notifications).toHaveLength(1);
    expect(NuqtaStorageEngine.getNotifications()).toHaveLength(1);
  });

  it('ignores a duplicate event, so a ticker cannot spam the inbox', () => {
    useNuqtaStore.getState().notify(draft());
    const second = useNuqtaStore.getState().notify(draft({ title: 'Again' }));
    expect(second).toBe(false);
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
  });

  it('allows the same event again after the row is dismissed', () => {
    useNuqtaStore.getState().notify(draft());
    const id = useNuqtaStore.getState().notifications[0].id;
    useNuqtaStore.getState().dismissNotification(id);
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);

    expect(useNuqtaStore.getState().notify(draft())).toBe(true);
    expect(useNuqtaStore.getState().notifications).toHaveLength(2);
  });

  it('does not add when the category is switched off', () => {
    useNuqtaStore.getState().setNotificationPreferences({
      inApp: true,
      browser: false,
      categories: { task: false }
    });
    expect(useNuqtaStore.getState().notify(draft())).toBe(false);
    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
  });

  it('tracks read and unread state and persists the transition', () => {
    useNuqtaStore.getState().notify(draft());
    const id = useNuqtaStore.getState().notifications[0].id;
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(1);

    useNuqtaStore.getState().markNotificationRead(id);
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(0);
    expect(isUnread(NuqtaStorageEngine.getNotifications()[0])).toBe(false);

    useNuqtaStore.getState().markNotificationUnread(id);
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(1);
  });

  it('marks all read at once', () => {
    useNuqtaStore.getState().notify(draft({ dedupeKey: 'a' }));
    useNuqtaStore.getState().notify(draft({ dedupeKey: 'b' }));
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(2);

    useNuqtaStore.getState().markAllNotificationsRead();
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(0);
    expect(NuqtaStorageEngine.getNotifications().every((n) => n.readAt)).toBe(true);
  });

  it('clears read rows but keeps unread work', () => {
    useNuqtaStore.getState().notify(draft({ dedupeKey: 'read-me' }));
    useNuqtaStore.getState().notify(draft({ dedupeKey: 'keep-me' }));
    const readId = useNuqtaStore
      .getState()
      .notifications.find((n) => n.dedupeKey === 'read-me')!.id;
    useNuqtaStore.getState().markNotificationRead(readId);

    useNuqtaStore.getState().clearReadNotifications();
    const remaining = useNuqtaStore.getState().notifications;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].dedupeKey).toBe('keep-me');
    expect(NuqtaStorageEngine.getNotifications()).toHaveLength(1);
  });

  it('persists preference changes without clobbering the inbox', () => {
    useNuqtaStore.getState().notify(draft());
    useNuqtaStore.getState().setNotificationPreferences({
      inApp: true,
      browser: true,
      categories: { focus: false }
    });

    expect(NuqtaStorageEngine.getNotificationPreferences()).toMatchObject({
      browser: true,
      categories: { focus: false }
    });
    // Preferences live under their own key; writing them must not touch notifications.
    expect(NuqtaStorageEngine.getNotifications()).toHaveLength(1);
  });

  it('prunes expired rows on demand', () => {
    useNuqtaStore.getState().notify(draft({ ttlMinutes: 1 }));
    const id = useNuqtaStore.getState().notifications[0].id;
    useNuqtaStore.setState((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, expiresAt: '2000-01-01T00:00:00.000Z' } : n
      )
    }));

    useNuqtaStore.getState().pruneNotificationInbox();
    expect(useNuqtaStore.getState().notifications).toHaveLength(0);
    expect(NuqtaStorageEngine.getNotifications()).toHaveLength(0);
  });
});

describe('notification events from real store actions', () => {
  beforeEach(reset);

  it('raises a notification when a focus session is logged', () => {
    useNuqtaStore.getState().logFocusSession({
      durationMinutes: 25,
      taskId: null,
      mode: 'pomodoro',
      startedAt: new Date().toISOString()
    } as never);

    const { notifications } = useNuqtaStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].category).toBe('focus');
    expect(notifications[0].route).toEqual({ nav: 'focus' });
  });

  it('raises a notification when a goal milestone is completed, but not when un-completed', () => {
    useNuqtaStore.setState({
      goals: [
        {
          id: 'goal-1',
          title: 'Ship NUQTA',
          description: '',
          category: 'career',
          targetDate: '2026-12-31',
          status: 'active',
          progress: 0,
          keyResults: [],
          milestones: [{ id: 'ms-1', title: 'Write tests', isCompleted: false }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as never
      ]
    });

    useNuqtaStore.getState().toggleGoalMilestone('goal-1', 'ms-1');
    let notifications = useNuqtaStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].category).toBe('goal');
    expect(notifications[0].route).toEqual({ nav: 'goals', entityId: 'goal-1' });

    // Un-checking is not an achievement and must not raise a second notification.
    useNuqtaStore.getState().toggleGoalMilestone('goal-1', 'ms-1');
    notifications = useNuqtaStore.getState().notifications;
    expect(notifications).toHaveLength(1);
  });

  it('raises a notification when a goal is completed, only on the transition', () => {
    useNuqtaStore.setState({
      goals: [
        {
          id: 'goal-2',
          title: 'Read more',
          description: '',
          category: 'growth',
          targetDate: '2026-12-31',
          status: 'active',
          progress: 0,
          keyResults: [],
          milestones: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as never
      ]
    });

    useNuqtaStore.getState().updateGoal('goal-2', { status: 'completed' });
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    // Copy keys are namespaced under `meta`, next to the caller's params.
    expect(useNuqtaStore.getState().notifications[0].meta?.messageId).toBe('goal.completed');

    // A later edit to an already-completed goal is not a new achievement.
    useNuqtaStore.getState().updateGoal('goal-2', { title: 'Read much more' });
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
  });

  it('raises a savings notification only when the target is crossed', () => {
    useNuqtaStore.setState({
      savingsGoals: [
        {
          id: 'sg-1',
          title: 'Emergency fund',
          targetAmount: 1000,
          currentAmount: 900,
          currency: 'USD',
          createdAt: new Date().toISOString()
        } as never
      ]
    });

    // Still short of target: no notification.
    useNuqtaStore.getState().updateSavingsGoal('sg-1', 50);
    expect(useNuqtaStore.getState().notifications).toHaveLength(0);

    // Crosses the target: one notification.
    useNuqtaStore.getState().updateSavingsGoal('sg-1', 100);
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
    expect(useNuqtaStore.getState().notifications[0].category).toBe('finance');

    // Further deposits above target do not re-notify.
    useNuqtaStore.getState().updateSavingsGoal('sg-1', 500);
    expect(useNuqtaStore.getState().notifications).toHaveLength(1);
  });
});
