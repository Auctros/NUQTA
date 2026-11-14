import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import {
  runLiquidThemeTransition,
  isThemeTransitionActive,
  resetThemeTransitionStateForTest,
  applyThemeClass
} from '../src/lib/themeTransition';

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Liquid Theme Transition', () => {
  const originalStartViewTransition = (document as Document & { startViewTransition?: unknown }).startViewTransition;
  const originalMatchMedia = window.matchMedia;
  const originalHardwareConcurrency = navigator.hardwareConcurrency;

  beforeEach(() => {
    resetThemeTransitionStateForTest();
    applyThemeClass('dark');
    useNuqtaStore.setState((s) => ({
      profile: { ...s.profile, theme: 'dark', language: 'en' }
    }));
  });

  afterEach(() => {
    resetThemeTransitionStateForTest();
    if (originalStartViewTransition === undefined) {
      Reflect.deleteProperty(document, 'startViewTransition');
    } else {
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: originalStartViewTransition
      });
    }
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: originalHardwareConcurrency
    });
    vi.restoreAllMocks();
  });

  it('orchestrates startViewTransition lifecycle for Dark -> Light and Light -> Dark', async () => {
    const readyDef = createDeferred<void>();
    const finishedDef = createDeferred<void>();
    let snapDuringCallback = false;
    let lightClassDuringCallback = false;

    const startViewTransitionMock = vi.fn((cb: () => void) => {
      cb();
      snapDuringCallback = document.documentElement.classList.contains('theme-liquid-snap');
      lightClassDuringCallback = document.documentElement.classList.contains('light-mode');
      return {
        ready: readyDef.promise,
        finished: finishedDef.promise
      };
    });

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransitionMock
    });

    useNuqtaStore.getState().setTheme('light');

    expect(startViewTransitionMock).toHaveBeenCalledTimes(1);
    expect(snapDuringCallback).toBe(true);
    expect(lightClassDuringCallback).toBe(true);
    expect(useNuqtaStore.getState().profile.theme).toBe('light');
    expect(document.documentElement.classList.contains('light-mode')).toBe(true);
    expect(document.body.classList.contains('light-mode')).toBe(true);
    expect(document.documentElement.classList.contains('theme-liquid-transition')).toBe(true);
    expect(isThemeTransitionActive()).toBe(true);

    // Overlapping toggle during active liquid pour should be ignored cleanly
    useNuqtaStore.getState().setTheme('dark');
    expect(startViewTransitionMock).toHaveBeenCalledTimes(1);
    expect(useNuqtaStore.getState().profile.theme).toBe('light');

    await act(async () => {
      readyDef.resolve();
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('theme-liquid-snap')).toBe(false);
    expect(document.documentElement.classList.contains('theme-liquid-transition')).toBe(true);

    await act(async () => {
      finishedDef.resolve();
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('theme-liquid-transition')).toBe(false);
    expect(isThemeTransitionActive()).toBe(false);

    // Now reverse direction (Light -> Dark)
    const readyDef2 = createDeferred<void>();
    const finishedDef2 = createDeferred<void>();
    startViewTransitionMock.mockImplementationOnce((cb: () => void) => {
      cb();
      return { ready: readyDef2.promise, finished: finishedDef2.promise };
    });

    useNuqtaStore.getState().setTheme('dark');
    expect(startViewTransitionMock).toHaveBeenCalledTimes(2);
    expect(useNuqtaStore.getState().profile.theme).toBe('dark');
    expect(document.documentElement.classList.contains('light-mode')).toBe(false);
    expect(document.body.classList.contains('light-mode')).toBe(false);

    await act(async () => {
      readyDef2.resolve();
      finishedDef2.resolve();
      await Promise.resolve();
    });
    expect(isThemeTransitionActive()).toBe(false);
  });

  it('skips View Transition animation when prefers-reduced-motion is reduce', () => {
    const startViewTransitionMock = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransitionMock
    });

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    let committed = false;
    runLiquidThemeTransition('dark', 'light', () => {
      committed = true;
    });

    expect(startViewTransitionMock).not.toHaveBeenCalled();
    expect(committed).toBe(true);
    expect(document.documentElement.classList.contains('light-mode')).toBe(true);
    expect(document.documentElement.classList.contains('theme-liquid-transition')).toBe(false);
  });

  it('activates simplified single-sheet mode on constrained devices', async () => {
    const finishedDef = createDeferred<void>();
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: vi.fn((cb: () => void) => {
        cb();
        return {
          ready: Promise.resolve(),
          finished: finishedDef.promise
        };
      })
    });

    runLiquidThemeTransition('dark', 'light', () => {});
    expect(document.documentElement.classList.contains('theme-liquid-simple')).toBe(true);

    await act(async () => {
      finishedDef.resolve();
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('theme-liquid-simple')).toBe(false);
  });

  it('toggles theme via topbar button in App in both directions', async () => {
    render(<App />);
    await settle();

    // Ensure starting state is dark
    if (useNuqtaStore.getState().profile.theme !== 'dark') {
      useNuqtaStore.getState().setTheme('dark');
    }

    const toLightBtn = screen.getByTitle(/Light Mode|المظهر الفاتح/i);
    fireEvent.click(toLightBtn);
    await settle();

    expect(useNuqtaStore.getState().profile.theme).toBe('light');
    expect(document.documentElement.classList.contains('light-mode')).toBe(true);

    const toDarkBtn = screen.getByTitle(/Dark Mode|المظهر الداكن/i);
    fireEvent.click(toDarkBtn);
    await settle();

    expect(useNuqtaStore.getState().profile.theme).toBe('dark');
    expect(document.documentElement.classList.contains('light-mode')).toBe(false);
  });
});
