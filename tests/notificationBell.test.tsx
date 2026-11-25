import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine } from '../src/lib/storage';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

describe('Notification bell entry point', () => {
  beforeEach(() => {
    useNuqtaStore.setState({
      notifications: [],
      notificationPreferences: NuqtaStorageEngine.getNotificationPreferences(),
      activeNavTab: 'today'
    });
  });

  it('shows no unread badge when the inbox is empty', async () => {
    render(<App />);
    await settle();

    const bell = screen.getByRole('button', { name: /^Notification Center|^مركز الإشعارات/ });
    expect(within(bell).queryByText(/^\d+$/)).toBeNull();
  });

  it('shows the unread count on the bell and opens the center', async () => {
    useNuqtaStore.getState().notify({
      category: 'habit',
      title: 'Morning habits are waiting',
      dedupeKey: 'habit:morning:today'
    });
    useNuqtaStore.getState().notify({
      category: 'goal',
      title: 'Milestone reached',
      dedupeKey: 'goal:1:milestone:today'
    });

    render(<App />);
    await settle();

    const bell = screen.getByRole('button', { name: /^Notification Center|^مركز الإشعارات/ });
    expect(within(bell).getByText('2')).toBeTruthy();
    expect(bell.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(bell);
    await settle();

    expect(bell.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Notification Center' })).toBeTruthy();
    expect(screen.getByText('Morning habits are waiting')).toBeTruthy();
  });

  it('drops the badge once everything is read', async () => {
    useNuqtaStore.getState().notify({
      category: 'habit',
      title: 'Morning habits are waiting',
      dedupeKey: 'habit:morning:today'
    });

    render(<App />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^Notification Center|^مركز الإشعارات/ }));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    await settle();

    const bell = screen.getByRole('button', { name: /^Notification Center|^مركز الإشعارات/ });
    expect(within(bell).queryByText('1')).toBeNull();
  });

  it('closes the center when the close control is used', async () => {
    render(<App />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^Notification Center|^مركز الإشعارات/ }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Notification Center' })).toBeTruthy();

    const dialog = screen.getByRole('dialog', { name: 'Notification Center' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await settle();

    expect(screen.queryByRole('dialog', { name: 'Notification Center' })).toBeNull();
  });
});
