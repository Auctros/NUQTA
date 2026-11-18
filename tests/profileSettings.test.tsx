import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { NuqtaStorageEngine, defaultProfile } from '../src/lib/storage';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

describe('Profile is the single destination for identity and application settings', () => {
  it('exposes a standalone Profile entry outside the sidebar and no Settings entry', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    const profileBtn = screen.getByRole('button', { name: /Local profile|الملف الشخصي/i });
    // The Profile destination is its own dock, separate from the nav rail.
    const aside = screen.getByRole('complementary', { name: /Primary navigation/i });
    expect(aside.contains(profileBtn)).toBe(false);
    expect(profileBtn.closest('.profile-dock')).not.toBeNull();
    expect(within(aside).queryByRole('button', { name: /Settings & Data|الإعدادات والبيانات/i })).toBeNull();
  });

  it('opens Profile from the standalone dock with identity, progress and every settings panel', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Local profile|الملف الشخصي/i }));
    await settle();

    expect(useNuqtaStore.getState().activeNavTab).toBe('profile');
    expect(screen.getByRole('heading', { level: 1, name: /Your Profile|الملف الشخصي/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Your Progress|تقدّمك/i })).toBeTruthy();
    // Everything that used to be on Settings now lives on Profile.
    expect(screen.getByRole('heading', { level: 2, name: /Preferences & Theme|التفضيلات والمظهر/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Notifications & Audio Alerts|الإشعارات والتنبيهات الصوتية/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Data Portability & Backups|أدوات ونقل البيانات/i })).toBeTruthy();
    expect(screen.getByText(/Absolute Privacy by Design|دستور الخصوصية المطلقة/i)).toBeTruthy();
  });

  it('saving the display name from Profile updates the store profile', async () => {
    useNuqtaStore.getState().setActiveNavTab('profile');
    render(<App />);
    await settle();

    const input = screen.getByLabelText(/Display Name|اسم العرض/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Layla' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Name|حفظ الاسم/i }));
    await settle();

    expect(useNuqtaStore.getState().profile.name).toBe('Layla');
  });

  it('shows no invented persona in the dock before a name is set', async () => {
    NuqtaStorageEngine.saveProfile({ ...defaultProfile(), name: '', language: 'en' });
    render(<App />);
    await settle();

    const dock = screen.getByRole('button', { name: /Local profile|الملف الشخصي/i });
    // With no name the dock falls back to the destination label, never a person.
    expect(within(dock).getByText('Local profile')).toBeTruthy();
    expect(within(dock).queryByText('Sir')).toBeNull();
    expect(within(dock).queryByText('User')).toBeNull();
    expect(within(dock).queryByText('Ali')).toBeNull();
  });

  it('greets without a name until one is set', async () => {
    NuqtaStorageEngine.saveProfile({ ...defaultProfile(), name: '', language: 'en' });
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/Good (morning|afternoon|evening)/);
    expect(heading.textContent).not.toMatch(/,/);
  });

  it('uses the generic profile label and the destination label in Arabic when no name is set', async () => {
    NuqtaStorageEngine.saveProfile({ ...defaultProfile(), name: '', language: 'ar' });
    render(<App />);
    await settle();

    const dock = screen.getByRole('button', { name: /Local profile|الملف الشخصي/i });
    expect(within(dock).getByText('الملف الشخصي')).toBeTruthy();
    expect(within(dock).queryByText('سيدي')).toBeNull();
  });

  it('shows a generic "User" identity in Profile (not a persona) before a name is set', async () => {
    NuqtaStorageEngine.saveProfile({ ...defaultProfile(), name: '', language: 'en' });
    render(<App />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Local profile|الملف الشخصي/i }));
    await settle();

    const card = screen.getByText(/Stored locally and privately/i).closest('.settings-profile') as HTMLElement;
    expect(within(card).getByText('User')).toBeTruthy();
    expect(within(card).queryByText('Sir')).toBeNull();
  });
});
