import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

describe('Profile and Settings are distinct destinations', () => {
  it('opens the Profile page (not Settings) from the sidebar profile row', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    const aside = screen.getByRole('complementary', { name: /Primary navigation/i });
    const profileRow = within(aside).getByRole('button', { name: /Local profile|الملف الشخصي/i });
    fireEvent.click(profileRow);
    await settle();

    expect(useNuqtaStore.getState().activeNavTab).toBe('profile');
    // The Profile experience, not the Settings & Data one.
    expect(screen.getByRole('heading', { level: 1, name: /Your Profile|الملف الشخصي/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Your Progress|تقدّمك/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: /Settings & Data|الإعدادات والبيانات/i })).toBeNull();
  });

  it('links from Profile to Settings and from Settings back to Profile', async () => {
    useNuqtaStore.getState().setActiveNavTab('profile');
    render(<App />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Open Settings|فتح الإعدادات/i }));
    await settle();
    expect(useNuqtaStore.getState().activeNavTab).toBe('settings');
    expect(screen.getByRole('heading', { level: 1, name: /Settings & Data|الإعدادات والبيانات/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Open Profile|فتح الملف الشخصي/i }));
    await settle();
    expect(useNuqtaStore.getState().activeNavTab).toBe('profile');
  });

  it('saving the display name updates the store profile', async () => {
    useNuqtaStore.getState().setActiveNavTab('profile');
    render(<App />);
    await settle();

    const input = screen.getByLabelText(/Display Name|اسم العرض/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Layla' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Name|حفظ الاسم/i }));
    await settle();

    expect(useNuqtaStore.getState().profile.name).toBe('Layla');
  });
});
