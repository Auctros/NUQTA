import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { NotificationCenter } from '../src/components/NotificationCenter';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';
import { unreadCount } from '../src/lib/notificationEngine';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

const seed = (overrides: Record<string, unknown> = {}) => {
  useNuqtaStore.getState().notify({
    category: 'task',
    title: 'Ship the notification center',
    body: 'It is due today',
    route: { nav: 'tasks', entityId: 'task-1' },
    actionLabel: 'Open task',
    dedupeKey: `seed-${Math.random()}`,
    ...overrides
  });
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    useNuqtaStore.setState({
      notifications: [],
      notificationPreferences: NuqtaStorageEngine.getNotificationPreferences(),
      activeNavTab: 'today'
    });
  });

  it('shows an honest empty state when there is nothing to report', async () => {
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
    expect(screen.getByText(/Reminders and milestones will appear here/)).toBeTruthy();
  });

  it('renders a stored notification with its category and body', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();

    expect(screen.getByText('Ship the notification center')).toBeTruthy();
    expect(screen.getByText('It is due today')).toBeTruthy();
    // The category shows as a row badge; the same word also exists as a filter chip.
    const list = screen.getByRole('list');
    expect(within(list).getByText('Tasks')).toBeTruthy();
  });

  it('renders the copy in Arabic when the app language is Arabic', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr />);
    await settle();

    expect(screen.getByText('الإشعارات')).toBeTruthy();
    expect(within(screen.getByRole('list')).getByText('المهام')).toBeTruthy();
    expect(screen.getByText(/جديد/)).toBeTruthy();
  });

  it('re-renders message-backed copy in the new language after a language switch', async () => {
    // A message-backed row stores only its id and params, so the title is generated at
    // render time and must follow the active language.
    useNuqtaStore.getState().notify({
      category: 'goal',
      title: 'Goal completed: Ship it',
      dedupeKey: 'goal:completed:1',
      messageId: 'goal.completed',
      params: { title: 'Ship it' }
    });

    const { rerender } = render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    expect(screen.getByText('Goal completed: Ship it')).toBeTruthy();

    rerender(<NotificationCenter open onClose={() => {}} isAr />);
    await settle();
    expect(screen.getByText('اكتمل الهدف: Ship it')).toBeTruthy();
    expect(screen.queryByText('Goal completed: Ship it')).toBeNull();
  });

  it('leaves stored copy untouched when the row has no message id', async () => {
    seed();
    const { rerender } = render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();

    rerender(<NotificationCenter open onClose={() => {}} isAr />);
    await settle();
    // No message table entry: the user's own wording is never rewritten.
    expect(screen.getByText('Ship the notification center')).toBeTruthy();
  });

  it('marks a notification read when it is opened and routes to its entity', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(1);

    fireEvent.click(screen.getByText('Ship the notification center'));
    await settle();

    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(0);
    const state = useNuqtaStore.getState();
    expect(state.activeNavTab).toBe('tasks');
    expect(state.focusRequest?.entityId).toBe('task-1');
  });

  it('toggles read state from the row control', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await settle();
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
    await settle();
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(1);
  });

  it('dismisses a row out of the inbox', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await settle();
    expect(screen.queryByText('Ship the notification center')).toBeNull();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
  });

  it('marks everything read from the header', async () => {
    seed({ dedupeKey: 'a' });
    seed({ dedupeKey: 'b', title: 'Second item' });
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    await settle();
    expect(unreadCount(useNuqtaStore.getState().notifications)).toBe(0);
  });

  it('filters to unread only', async () => {
    seed({ dedupeKey: 'keep', title: 'Unread one' });
    seed({ dedupeKey: 'done', title: 'Read one' });
    const readId = useNuqtaStore
      .getState()
      .notifications.find((n) => n.dedupeKey === 'done')!.id;
    useNuqtaStore.getState().markNotificationRead(readId);

    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    const filters = screen.getByRole('group', { name: 'Filter notifications' });
    fireEvent.click(within(filters).getByRole('button', { name: /^Unread/ }));
    await settle();

    expect(screen.getByText('Unread one')).toBeTruthy();
    expect(screen.queryByText('Read one')).toBeNull();
  });

  it('clears read rows but leaves unread ones in place', async () => {
    seed({ dedupeKey: 'a', title: 'Read me' });
    seed({ dedupeKey: 'b', title: 'Keep me' });
    const readId = useNuqtaStore.getState().notifications.find((n) => n.dedupeKey === 'a')!.id;
    useNuqtaStore.getState().markNotificationRead(readId);

    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Clear read' }));
    await settle();

    expect(screen.queryByText('Read me')).toBeNull();
    expect(screen.getByText('Keep me')).toBeTruthy();
  });

  it('closes on outside click but not when clicking inside', async () => {
    seed();
    const onClose = vi.fn();
    render(<NotificationCenter open onClose={onClose} isAr={false} />);
    await settle();

    fireEvent.mouseDown(screen.getByText('Ship the notification center'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while closed', async () => {
    seed();
    const { container } = render(<NotificationCenter open={false} onClose={() => {}} isAr={false} />);
    await settle();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('groups rows under a day heading', async () => {
    seed();
    render(<NotificationCenter open onClose={() => {}} isAr={false} />);
    await settle();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });
});
