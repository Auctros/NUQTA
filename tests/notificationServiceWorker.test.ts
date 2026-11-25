import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openNotificationRoute } from '../src/lib/notifications';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const swSource = readFileSync(path.resolve(import.meta.dirname, '../public/sw.js'), 'utf8');

const tick = () => new Promise((r) => setTimeout(r, 20));

interface FakeClient {
  focused: boolean;
  messages: unknown[];
  focus: () => Promise<void>;
  postMessage: (msg: unknown) => void;
}

/**
 * Load the real service worker into a fake `self` scope and drive its
 * `notificationclick` handler, so the click → route → page path is covered end to end
 * rather than only on the page side.
 */
function loadWorker(clients: FakeClient[]) {
  const handlers: Record<string, (event: any) => void> = {};
  const scope = 'https://nuqta.test/';

  const self = {
    registration: { scope, showNotification: vi.fn() },
    clients: {
      matchAll: async () => clients,
      openWindow: vi.fn(async () => null)
    },
    addEventListener: (type: string, fn: (event: any) => void) => {
      handlers[type] = fn;
    }
  };

  const fn = new Function('self', 'caches', 'fetch', 'URL', swSource);
  fn(self, { keys: async () => [], open: async () => undefined, delete: async () => true }, vi.fn(), URL);
  return { self, handlers, scope };
}

function makeClient(): FakeClient {
  return {
    focused: false,
    messages: [],
    focus: async function (this: FakeClient) {
      this.focused = true;
    },
    postMessage(msg: unknown) {
      this.messages.push(msg);
    }
  };
}

describe('service worker notification clicks', () => {
  beforeEach(() => {
    useNuqtaStore.setState({ activeNavTab: 'today', focusRequest: undefined });
  });

  it('posts the route to an open client and focuses it', async () => {
    const client = makeClient();
    const { handlers } = loadWorker([client]);

    const waits: Promise<unknown>[] = [];
    handlers.notificationclick({
      notification: { close: vi.fn(), data: { route: { nav: 'tasks', entityId: 't-9' } } },
      waitUntil: (p: Promise<unknown>) => waits.push(p)
    });
    await Promise.all(waits);

    expect(client.focused).toBe(true);
    expect(client.messages).toEqual([
      { type: 'nuqta-notification-click', route: { nav: 'tasks', entityId: 't-9' } }
    ]);
  });

  it('opens a window when no client is available', async () => {
    const { self, handlers } = loadWorker([]);

    const waits: Promise<unknown>[] = [];
    handlers.notificationclick({
      notification: { close: vi.fn(), data: { route: { nav: 'habits' }, url: 'https://nuqta.test/' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p)
    });
    await Promise.all(waits);

    expect(self.clients.openWindow).toHaveBeenCalledWith('https://nuqta.test/');
  });

  it('focuses without posting when the notification carries no route', async () => {
    const client = makeClient();
    const { handlers } = loadWorker([client]);

    const waits: Promise<unknown>[] = [];
    handlers.notificationclick({
      notification: { close: vi.fn(), data: {} },
      waitUntil: (p: Promise<unknown>) => waits.push(p)
    });
    await Promise.all(waits);

    expect(client.focused).toBe(true);
    expect(client.messages).toHaveLength(0);
  });

  it('drives the store through the same payload the worker posts', async () => {
    // Bridge check: the message shape asserted above is what the page consumes.
    const client = makeClient();
    const { handlers } = loadWorker([client]);

    const waits: Promise<unknown>[] = [];
    handlers.notificationclick({
      notification: { close: vi.fn(), data: { route: { nav: 'goals', entityId: 'g-3' } } },
      waitUntil: (p: Promise<unknown>) => waits.push(p)
    });
    await Promise.all(waits);

    const payload = client.messages[0] as { route: { nav: string; entityId: string } };
    openNotificationRoute(payload.route as never);
    await tick();

    const state = useNuqtaStore.getState();
    expect(state.activeNavTab).toBe('goals');
    expect(state.focusRequest?.entityId).toBe('g-3');
  });
});
