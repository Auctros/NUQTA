import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openNotificationRoute, listenForNotificationRoutes } from '../src/lib/notifications';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const tick = () => new Promise((r) => setTimeout(r, 20));

// A minimal stand-in for `navigator.serviceWorker` that can receive messages.
class FakeServiceWorker extends EventTarget {}

describe('notification click routing', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: new FakeServiceWorker()
    });
  });

  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'serviceWorker', original);
    else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  it('routes a payload to its entity and switches to the target view', async () => {
    openNotificationRoute({ nav: 'tasks', entityId: 'task-42' });
    await tick();
    const state = useNuqtaStore.getState();
    expect(state.activeNavTab).toBe('tasks');
    expect(state.focusRequest?.domain).toBe('tasks');
    expect(state.focusRequest?.entityId).toBe('task-42');
  });

  it('navigates to a view even without a specific entity', async () => {
    openNotificationRoute({ nav: 'journal' });
    await tick();
    expect(useNuqtaStore.getState().activeNavTab).toBe('journal');
  });

  it('ignores an empty route', async () => {
    const before = useNuqtaStore.getState().activeNavTab;
    openNotificationRoute(undefined);
    await tick();
    expect(useNuqtaStore.getState().activeNavTab).toBe(before);
  });

  it('opens the routed entity when the service worker forwards a click', async () => {
    const unsubscribe = listenForNotificationRoutes();
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'nuqta-notification-click', route: { nav: 'habits', entityId: 'habit-7' } }
      })
    );
    await tick();
    const state = useNuqtaStore.getState();
    expect(state.activeNavTab).toBe('habits');
    expect(state.focusRequest?.entityId).toBe('habit-7');

    // A message of any other type is ignored.
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'something-else' } }));
    await tick();
    expect(useNuqtaStore.getState().focusRequest?.entityId).toBe('habit-7');

    unsubscribe();
  });
});
