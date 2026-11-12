import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

/**
 * Executes the REAL public/sw.js inside a sandbox with a mocked CacheStorage/fetch, so
 * the isolation rules are enforced by the code that actually ships:
 *   - install precaches only the discovered shell assets,
 *   - a failed install removes only its own candidate cache and keeps the working version,
 *   - activate deletes only NUQTA-owned caches (other apps' caches survive),
 *   - the fetch handler never writes to the cache (no dynamic/API/user data is stored).
 */

const ORIGIN = 'http://localhost:4173';
const SCOPE = `${ORIGIN}/`;

type Entry = { url: string; body: string };

function makeResponse(url: string, body: string) {
  const res = {
    ok: true,
    url,
    clone: () => makeResponse(url, body),
    text: async () => body
  };
  return res;
}

function makeCacheStorage(initial: string[] = []) {
  const stores = new Map<string, Map<string, Entry>>();
  for (const name of initial) stores.set(name, new Map());
  const openCache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (req: { url: string } | string, res: { text: () => Promise<string> }) => {
        const url = typeof req === 'string' ? req : req.url;
        m.set(url, { url, body: await res.text() });
      },
      match: async (req: { url: string } | string) => {
        const url = typeof req === 'string' ? req : req.url;
        return m.has(url) ? makeResponse(url, m.get(url)!.body) : undefined;
      },
      keys: async () => [...m.keys()].map((url) => ({ url }))
    };
  };
  return {
    _stores: stores,
    open: async (name: string) => openCache(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    has: (name: string, url: string) => stores.get(name)?.has(url) ?? false,
    entries: (name: string) => [...(stores.get(name)?.keys() ?? [])]
  };
}

/** Load sw.js into a fresh sandbox; `fetchImpl` decides which URLs succeed. */
function loadServiceWorker(options: {
  fetchImpl: (url: string) => { ok: boolean; body?: string } | 'reject';
  initialCaches?: string[];
}) {
  const caches = makeCacheStorage(options.initialCaches);
  const handlers: Record<string, (event: unknown) => void> = {};
  const skipped: boolean[] = [];
  const claimed: boolean[] = [];

  const sandbox: Record<string, unknown> = {
    caches,
    fetch: async (req: { url: string } | string) => {
      const url = typeof req === 'string' ? req : req.url;
      const r = options.fetchImpl(url);
      if (r === 'reject' || !r.ok) throw new Error(`network error: ${url}`);
      return makeResponse(url, r.body ?? '');
    },
    Request: class {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
    },
    Response: { error: () => makeResponse('error', '') },
    URL,
    console
  };
  sandbox.self = sandbox;
  (sandbox as any).location = { origin: ORIGIN };
  (sandbox as any).registration = { scope: SCOPE };
  (sandbox as any).addEventListener = (type: string, fn: (event: unknown) => void) => {
    handlers[type] = fn;
  };
  (sandbox as any).skipWaiting = () => {
    skipped.push(true);
    return Promise.resolve();
  };
  (sandbox as any).clients = { claim: () => (claimed.push(true), Promise.resolve()) };

  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'), context);

  const runInstall = async () => {
    let promise: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<unknown>) => (promise = p) });
    return promise;
  };
  const runActivate = async () => {
    let promise: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (p: Promise<unknown>) => (promise = p) });
    return promise;
  };
  const runFetch = async (request: { url: string; method?: string; mode?: string }) => {
    const req = { method: 'GET', mode: 'cors', ...request };
    let response: Promise<unknown> = Promise.resolve(undefined);
    handlers.fetch({ request: req, respondWith: (p: Promise<unknown>) => (response = p) });
    return response;
  };

  return { caches, runInstall, runActivate, runFetch, skipped, claimed, handlers };
}

const INDEX_HTML =
  '<html><head><link rel="stylesheet" href="/assets/index-abc.css"></head>' +
  '<body><script type="module" src="/assets/index-abc.js"></script></body></html>';
const CSS = 'body{background:url("/assets/font-abc.woff2")}';

const happyFetch = (url: string) => {
  if (url === SCOPE || url === ORIGIN + '/') return { ok: true, body: INDEX_HTML };
  if (url.endsWith('.css')) return { ok: true, body: CSS };
  return { ok: true, body: 'binary' };
};

describe('service worker install', () => {
  it('precaches exactly the discovered shell assets under the versioned cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();

    expect([...sw.caches._stores.keys()]).toEqual(['nuqta-shell-v3']);
    const urls = sw.caches.entries('nuqta-shell-v3').sort();
    expect(urls).toEqual(
      [`${ORIGIN}/`, `${ORIGIN}/assets/font-abc.woff2`, `${ORIGIN}/assets/index-abc.css`, `${ORIGIN}/assets/index-abc.js`].sort()
    );
    expect(sw.skipped).toHaveLength(1);
  });

  it('never caches a dynamic URL it did not discover in the shell', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    expect(sw.caches.has('nuqta-shell-v3', `${ORIGIN}/api/user-data`)).toBe(false);
    expect(sw.caches.entries('nuqta-shell-v3').some((u) => u.includes('/api/'))).toBe(false);
  });

  it('removes only its own candidate cache when installation fails, keeping the working version', async () => {
    // A previously working version is present; this install fails on the JS asset.
    const sw = loadServiceWorker({
      initialCaches: ['nuqta-shell-v2'],
      fetchImpl: (url) => {
        if (url.endsWith('.js')) return 'reject';
        return happyFetch(url);
      }
    });
    sw.caches._stores.get('nuqta-shell-v2')!.set(`${ORIGIN}/`, { url: `${ORIGIN}/`, body: 'previous' });

    await expect(sw.runInstall()).rejects.toThrow();
    expect(sw.caches._stores.has('nuqta-shell-v3')).toBe(false); // candidate removed
    expect(sw.caches._stores.has('nuqta-shell-v2')).toBe(true); // working version intact
    expect(sw.caches.has('nuqta-shell-v2', `${ORIGIN}/`)).toBe(true);
  });
});

describe('service worker activate', () => {
  it('deletes only obsolete NUQTA caches and leaves other applications alone', async () => {
    const sw = loadServiceWorker({
      initialCaches: ['nuqta-shell-v1', 'nuqta-shell-v2', 'other-app-cache', 'workbox-precache'],
      fetchImpl: happyFetch
    });
    await sw.runInstall(); // creates nuqta-shell-v3
    await sw.runActivate();

    const remaining = [...sw.caches._stores.keys()].sort();
    expect(remaining).toContain('nuqta-shell-v3');
    expect(remaining).not.toContain('nuqta-shell-v1');
    expect(remaining).not.toContain('nuqta-shell-v2');
    expect(remaining).toContain('other-app-cache');
    expect(remaining).toContain('workbox-precache');
    expect(sw.claimed).toHaveLength(1);
  });
});

describe('service worker fetch handler', () => {
  it('serves a precached asset from the cache and never writes to the cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    const before = sw.caches.entries('nuqta-shell-v3').length;

    const res = (await sw.runFetch({ url: `${ORIGIN}/assets/index-abc.js` })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sw.caches.entries('nuqta-shell-v3').length).toBe(before);
  });

  it('does NOT cache a dynamic (non-precached) request', async () => {
    const sw = loadServiceWorker({ fetchImpl: () => ({ ok: true, body: '{"secret":"user"}' }) });
    await sw.runInstall();
    const before = sw.caches.entries('nuqta-shell-v3').length;

    const res = (await sw.runFetch({ url: `${ORIGIN}/api/user-data` })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sw.caches.has('nuqta-shell-v3', `${ORIGIN}/api/user-data`)).toBe(false);
    expect(sw.caches.entries('nuqta-shell-v3').length).toBe(before);
  });

  it('does NOT cache the network response of a navigation', async () => {
    let online = true;
    const sw = loadServiceWorker({
      fetchImpl: (url) => {
        if (url === SCOPE || url === ORIGIN + '/') {
          return { ok: true, body: online ? INDEX_HTML : '<html>fresh-network</html>' };
        }
        if (url.endsWith('.css')) return { ok: true, body: CSS };
        return { ok: true, body: 'binary' };
      }
    });
    await sw.runInstall();
    const cachedIndex = sw.caches._stores.get('nuqta-shell-v3')!.get(`${ORIGIN}/`)!.body;
    expect(cachedIndex).toBe(INDEX_HTML);

    // A later navigation returns a different (dynamic) document from the network.
    online = false;
    const res = (await sw.runFetch({ url: `${ORIGIN}/`, mode: 'navigate' })) as { text: () => Promise<string> };
    expect(await res.text()).toBe('<html>fresh-network</html>');
    // The precached shell is unchanged: the navigation response was not written.
    expect(sw.caches._stores.get('nuqta-shell-v3')!.get(`${ORIGIN}/`)!.body).toBe(INDEX_HTML);
  });
});
