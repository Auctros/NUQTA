import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

const resetOverlays = () =>
  useNuqtaStore.setState({ isRescueModeOpen: false, isSundayRitualOpen: false });

describe('Overlay keyboard accessibility', () => {
  afterEach(() => resetOverlays());

  it('closes Rescue Mode when Escape is pressed', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    act(() => useNuqtaStore.getState().setRescueModeOpen(true));
    await settle();
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await settle();

    expect(useNuqtaStore.getState().isRescueModeOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the Sunday Ritual when Escape is pressed', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    act(() => useNuqtaStore.getState().setSundayRitualOpen(true));
    await settle();
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await settle();

    expect(useNuqtaStore.getState().isSundayRitualOpen).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not intercept Escape when no overlay is open', async () => {
    useNuqtaStore.getState().setActiveNavTab('today');
    render(<App />);
    await settle();

    // No overlay should be rendered, and Escape must not throw or toggle anything.
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await settle();
    expect(useNuqtaStore.getState().isRescueModeOpen).toBe(false);
    expect(useNuqtaStore.getState().isSundayRitualOpen).toBe(false);
  });
});
