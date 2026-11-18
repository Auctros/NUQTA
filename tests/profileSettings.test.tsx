import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

describe('Settings is the single destination for profile and configuration', () => {
  it('has no separate Profile entry in the sidebar', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    const aside = screen.getByRole('complementary', { name: /Primary navigation/i });
    // The old profile row is gone; only the Settings entry remains in the bottom slot.
    expect(within(aside).queryByRole('button', { name: /Local profile|الملف الشخصي/i })).toBeNull();
    expect(within(aside).getByRole('button', { name: /Settings & Data|الإعدادات والبيانات/i })).toBeTruthy();
  });

  it('opens Settings from the sidebar and shows the consolidated profile + data panels', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    const aside = screen.getByRole('complementary', { name: /Primary navigation/i });
    fireEvent.click(within(aside).getByRole('button', { name: /Settings & Data|الإعدادات والبيانات/i }));
    await settle();

    expect(useNuqtaStore.getState().activeNavTab).toBe('settings');
    expect(screen.getByRole('heading', { level: 1, name: /Settings & Data|الإعدادات والبيانات/i })).toBeTruthy();
    // Profile functionality is folded into Settings, not a separate page.
    expect(screen.getByRole('heading', { level: 2, name: /Your Profile|الملف الشخصي/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Your Progress|تقدّمك/i })).toBeTruthy();
  });

  it('saving the display name from Settings updates the store profile', async () => {
    useNuqtaStore.getState().setActiveNavTab('settings');
    render(<App />);
    await settle();

    const input = screen.getByLabelText(/Display Name|اسم العرض/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Layla' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Name|حفظ الاسم/i }));
    await settle();

    expect(useNuqtaStore.getState().profile.name).toBe('Layla');
  });
});
