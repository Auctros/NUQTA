import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { PwaUpdateManager, UpdateEnvironment, WorkerLike, RegistrationLike } from '../src/lib/pwaUpdate';

const { managerRef } = vi.hoisted(() => ({ managerRef: { current: null as PwaUpdateManager | null } }));
vi.mock('../src/lib/pwaUpdate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/pwaUpdate')>();
  return { ...actual, getPwaUpdateManager: () => managerRef.current };
});

class FakeWorker implements WorkerLike {
  state = 'installing';
  messages: unknown[] = [];
  private listeners: Record<string, (() => void)[]> = {};
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ||= []).push(fn);
  }
  setState(state: string): void {
    this.state = state;
    for (const fn of this.listeners['statechange'] || []) fn();
  }
}

class FakeRegistration implements RegistrationLike {
  waiting: WorkerLike | null = null;
  installing: WorkerLike | null = null;
  active: WorkerLike | null = null;
  private listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ||= []).push(fn);
  }
  update(): Promise<unknown> {
    return Promise.resolve();
  }
  fire(type: string): void {
    for (const fn of this.listeners[type] || []) fn();
  }
}

/** Start a manager already controlled by an active worker, then deliver an update. */
function setupWithPendingUpdate() {
  const active = new FakeWorker();
  const env: UpdateEnvironment = {
    getController: () => active,
    addControllerChangeListener: () => {},
    reload: vi.fn(),
    isHidden: () => false,
    addVisibilityListener: () => {},
    addOnlineListener: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {}
  };
  const manager = new PwaUpdateManager(env);
  const registration = new FakeRegistration();
  registration.active = active;
  manager.start(registration);

  const incoming = new FakeWorker();
  registration.installing = incoming;
  registration.fire('updatefound');
  incoming.setState('installed'); // -> 'available'
  return { manager, registration, incoming };
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    managerRef.current = null;
  });
  afterEach(() => cleanup());

  it('renders nothing when no update is pending', () => {
    managerRef.current = new PwaUpdateManager({
      getController: () => null,
      addControllerChangeListener: () => {},
      reload: vi.fn(),
      isHidden: () => false,
      addVisibilityListener: () => {},
      addOnlineListener: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      setTimeout: () => 0,
      clearTimeout: () => {}
    });
    render(<UpdateBanner isAr={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces an available update and applies it on click', async () => {
    const { manager, registration } = setupWithPendingUpdate();
    managerRef.current = manager;
    const waiting = new FakeWorker();
    waiting.setState('installed');
    registration.waiting = waiting;

    render(<UpdateBanner isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('A new version');

    fireEvent.click(screen.getByRole('button', { name: /apply update/i }));
    // Applying posts skipWaiting asynchronously (it first takes the cross-tab lock).
    await Promise.resolve();
    expect(waiting.messages).toEqual([{ type: 'nuqta-skip-waiting' }]);
    // The banner switches to its "applying" message and drops the button.
    expect(screen.getByRole('status').textContent).toContain('Applying');
    expect(screen.queryByRole('button', { name: /apply update/i })).toBeNull();
  });

  it('prompts in Arabic when the app is in Arabic', () => {
    const { manager } = setupWithPendingUpdate();
    managerRef.current = manager;
    render(<UpdateBanner isAr />);
    expect(screen.getByRole('status').textContent).toContain('إصدار جديد');
  });
});
