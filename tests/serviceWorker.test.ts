import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

/**
 * Executes the REAL public/sw.js inside a sandbox with a mocked CacheStorage/fetch, so
 * the isolation rules are enforced by the code that actually ships:
 *   - install precaches only the discovered shell assets,
 *   - a failed install removes only its own candidate cache and keeps the working version,
 *   - activate KEEPS the previous cache (a not-yet-reloaded tab may still need it) and only
 *     deletes NUQTA-owned caches when a reloaded page asks via `nuqta-claim-cleanup`,
 *   - the fetch handler never writes to the cache (no dynamic/API/user data is stored),
 *   - a new worker WAITS on install (it never self-activates) and only skips waiting when
 *     a page explicitly asks it to, so an update cannot interrupt a working page.
 */

const ORIGIN = 'http://localhost:4173';
const SCOPE = `${ORIGIN}/`;

// Read the version straight from sw.js so bumping CACHE_VERSION never silently
// breaks this test — the assertion stays about behaviour, not a magic number.
const SW_SOURCE = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');
const CACHE_VERSION = Number(SW_SOURCE.match(/CACHE_VERSION\s*=\s*(\d+)/)![1]);
const CACHE = `nuqta-shell-v${CACHE_VERSION}`;
const PREV_CACHE = `nuqta-shell-v${CACHE_VERSION - 1}`;

type Entry = { url: string; body: string };

function makeResponse(url: string, body: string) {
  const res = {
    ok: true,
    url,
    clone: () => makeResponse(url, body),
    text: async () => body,
    json: async () => JSON.parse(body)
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
  const fetchCalls: { url: string; init?: RequestInit }[] = [];

  const sandbox: Record<string, unknown> = {
    caches,
    fetch: async (req: { url: string } | string, init?: RequestInit) => {
      const url = typeof req === 'string' ? req : req.url;
      fetchCalls.push({ url, init });
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
  const runMessage = async (data: unknown) => {
    let promise: Promise<unknown> = Promise.resolve();
    handlers.message({ data, waitUntil: (p: Promise<unknown>) => (promise = p) });
    return promise;
  };

  return { caches, runInstall, runActivate, runFetch, runMessage, skipped, claimed, handlers, fetchCalls };
}

const INDEX_HTML =
  '<html><head><link rel="stylesheet" href="/assets/index-abc.css"></head>' +
  '<body><script type="module" src="/assets/index-abc.js"></script></body></html>';
const CSS = 'body{background:url("/assets/font-abc.woff2")}';

// The exercise illustrations are referenced from CSS masks, so nothing in the shell
// HTML/CSS reveals them. The fixture mirrors the real public/exercise-art/manifest.json.
const ART_MANIFEST_URL = `${ORIGIN}/exercise-art/manifest.json`;
const ART_MANIFEST = JSON.stringify({
  count: 3,
  art: { 'push-up': { w: 1024, h: 358 }, 'plank': { w: 1000, h: 400 }, 'burpee': { w: 900, h: 400 } }
});

const happyFetch = (url: string) => {
  if (url === SCOPE || url === ORIGIN + '/') return { ok: true, body: INDEX_HTML };
  if (url.endsWith('.css')) return { ok: true, body: CSS };
  if (url === ART_MANIFEST_URL) return { ok: true, body: ART_MANIFEST };
  return { ok: true, body: 'binary' };
};

describe('service worker install', () => {
  it('precaches exactly the discovered shell assets under the versioned cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();

    expect([...sw.caches._stores.keys()]).toEqual([CACHE]);
    const urls = sw.caches.entries(CACHE).sort();
    expect(urls).toEqual(
      [
        `${ORIGIN}/`,
        `${ORIGIN}/assets/font-abc.woff2`,
        `${ORIGIN}/assets/index-abc.css`,
        `${ORIGIN}/assets/index-abc.js`,
        `${ORIGIN}/exercise-art/push-up.svg`,
        `${ORIGIN}/exercise-art/plank.svg`,
        `${ORIGIN}/exercise-art/burpee.svg`
      ].sort()
    );
    // A new worker must WAIT on install — it must not activate itself and swap the cache
    // out from under a page the user is still working in.
    expect(sw.skipped).toHaveLength(0);
  });

  it('precaches every exercise illustration the manifest lists, so the library works offline', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    for (const url of [
      `${ORIGIN}/exercise-art/push-up.svg`,
      `${ORIGIN}/exercise-art/plank.svg`,
      `${ORIGIN}/exercise-art/burpee.svg`
    ]) {
      expect(sw.caches.has(CACHE, url)).toBe(true);
    }
  });

  it('still installs when the art manifest is missing (best-effort drawings)', async () => {
    const sw = loadServiceWorker({
      fetchImpl: (url) => {
        if (url === ART_MANIFEST_URL) return 'reject';
        return happyFetch(url);
      }
    });
    await sw.runInstall();
    expect([...sw.caches._stores.keys()]).toEqual([CACHE]);
    expect(sw.caches.has(CACHE, `${ORIGIN}/assets/index-abc.js`)).toBe(true);
    expect(sw.caches.has(CACHE, `${ORIGIN}/exercise-art/push-up.svg`)).toBe(false);
  });

  it('never caches a dynamic URL it did not discover in the shell', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    expect(sw.caches.has(CACHE, `${ORIGIN}/api/user-data`)).toBe(false);
    expect(sw.caches.entries(CACHE).some((u) => u.includes('/api/'))).toBe(false);
  });

  it('removes only its own candidate cache when installation fails, keeping the working version', async () => {
    // A previously working version is present; this install fails on the JS asset.
    const sw = loadServiceWorker({
      initialCaches: [PREV_CACHE],
      fetchImpl: (url) => {
        if (url.endsWith('.js')) return 'reject';
        return happyFetch(url);
      }
    });
    sw.caches._stores.get(PREV_CACHE)!.set(`${ORIGIN}/`, { url: `${ORIGIN}/`, body: 'previous' });

    await expect(sw.runInstall()).rejects.toThrow();
    expect(sw.caches._stores.has(CACHE)).toBe(false); // candidate removed
    expect(sw.caches._stores.has(PREV_CACHE)).toBe(true); // working version intact
    expect(sw.caches.has(PREV_CACHE, `${ORIGIN}/`)).toBe(true);
  });
});

describe('service worker activate', () => {
  it('claims the open pages but KEEPS the previous cache for not-yet-reloaded tabs', async () => {
    const sw = loadServiceWorker({
      initialCaches: ['nuqta-shell-v1', PREV_CACHE, 'other-app-cache', 'workbox-precache'],
      fetchImpl: happyFetch
    });
    await sw.runInstall(); // creates the current version cache
    await sw.runActivate();

    // The previous version's cache survives activation: a page still running the old build
    // may lazy-load assets (e.g. exercise illustrations) from it until it reloads.
    const remaining = [...sw.caches._stores.keys()].sort();
    expect(remaining).toContain(CACHE);
    expect(remaining).toContain(PREV_CACHE);
    expect(sw.claimed).toHaveLength(1);
  });

  it('cleanup keeps the previous version but reclaims older caches and other apps are untouched', async () => {
    const sw = loadServiceWorker({
      initialCaches: ['nuqta-shell-v1', PREV_CACHE, 'other-app-cache', 'workbox-precache'],
      fetchImpl: happyFetch
    });
    await sw.runInstall();
    await sw.runActivate();
    await sw.runMessage({ type: 'nuqta-claim-cleanup' });

    const remaining = [...sw.caches._stores.keys()].sort();
    expect(remaining).toContain(CACHE); // current
    expect(remaining).toContain(PREV_CACHE); // previous — a tab may still be running it
    expect(remaining).not.toContain('nuqta-shell-v1'); // older than one version back
    expect(remaining).toContain('other-app-cache');
    expect(remaining).toContain('workbox-precache');
  });

  it('retains exactly the current plus one previous version, and no more', async () => {
    const sw = loadServiceWorker({
      initialCaches: ['nuqta-shell-v4', 'nuqta-shell-v5', PREV_CACHE],
      fetchImpl: happyFetch
    });
    await sw.runInstall();
    await sw.runMessage({ type: 'nuqta-claim-cleanup' });

    const shell = [...sw.caches._stores.keys()].filter((k) => k.startsWith('nuqta-shell-')).sort();
    expect(shell).toEqual([PREV_CACHE, CACHE].sort());
  });
});

describe('service worker fetch handler', () => {
  it('serves a precached asset from the cache and never writes to the cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    const before = sw.caches.entries(CACHE).length;

    const res = (await sw.runFetch({ url: `${ORIGIN}/assets/index-abc.js` })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sw.caches.entries(CACHE).length).toBe(before);
  });

  it('serves an asset from the PREVIOUS build cache when the current one lacks it', async () => {
    // A page still running the old build requests an asset only that build precached. The
    // old cache is kept on activation, and the fetch handler must fall back to it (even
    // offline) rather than failing — or worse, hitting the network for a hashed name.
    const staleAsset = `${ORIGIN}/assets/index-OLD.js`;
    const sw = loadServiceWorker({
      initialCaches: [PREV_CACHE],
      fetchImpl: (url) => {
        if (url === staleAsset) return 'reject'; // offline: only the old cache can serve it
        return happyFetch(url);
      }
    });
    sw.caches._stores.get(PREV_CACHE)!.set(staleAsset, { url: staleAsset, body: 'old-bundle' });
    await sw.runInstall();

    const res = (await sw.runFetch({ url: staleAsset })) as { text: () => Promise<string> };
    expect(await res.text()).toBe('old-bundle');
    // The current cache is untouched: the old asset is served, not re-cached.
    expect(sw.caches.has(CACHE, staleAsset)).toBe(false);
  });

  it('does NOT cache a dynamic (non-precached) request', async () => {
    const sw = loadServiceWorker({ fetchImpl: () => ({ ok: true, body: '{"secret":"user"}' }) });
    await sw.runInstall();
    const before = sw.caches.entries(CACHE).length;

    const res = (await sw.runFetch({ url: `${ORIGIN}/api/user-data` })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sw.caches.has(CACHE, `${ORIGIN}/api/user-data`)).toBe(false);
    expect(sw.caches.entries(CACHE).length).toBe(before);
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
    const cachedIndex = sw.caches._stores.get(CACHE)!.get(`${ORIGIN}/`)!.body;
    expect(cachedIndex).toBe(INDEX_HTML);

    // A later navigation returns a different (dynamic) document from the network.
    online = false;
    const res = (await sw.runFetch({ url: `${ORIGIN}/`, mode: 'navigate' })) as { text: () => Promise<string> };
    expect(await res.text()).toBe('<html>fresh-network</html>');
    // The precached shell is unchanged: the navigation response was not written.
    expect(sw.caches._stores.get(CACHE)!.get(`${ORIGIN}/`)!.body).toBe(INDEX_HTML);
  });

  it('revalidates the navigation document instead of trusting the HTTP cache', async () => {
    // GitHub Pages serves index.html with `max-age=600`. Without revalidation a reload
    // within that window would return the OLD document (and so the OLD hashed bundle).
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    sw.fetchCalls.length = 0;

    await sw.runFetch({ url: `${ORIGIN}/`, mode: 'navigate' });

    const nav = sw.fetchCalls.find((c) => c.url === `${ORIGIN}/`);
    expect(nav).toBeDefined();
    expect(nav!.init?.cache).toBe('no-cache');
  });

  it('still serves the cached shell when a navigation cannot reach the network', async () => {
    let online = true;
    const sw = loadServiceWorker({
      fetchImpl: (url) => {
        if (url === SCOPE || url === ORIGIN + '/') return online ? { ok: true, body: INDEX_HTML } : 'reject';
        if (url.endsWith('.css')) return { ok: true, body: CSS };
        return { ok: true, body: 'binary' };
      }
    });
    await sw.runInstall();
    online = false;

    const res = (await sw.runFetch({ url: `${ORIGIN}/`, mode: 'navigate' })) as { text: () => Promise<string> };
    expect(await res.text()).toBe(INDEX_HTML);
  });
});

describe('service worker update lifecycle', () => {
  it('only skips waiting when the page explicitly asks it to', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    expect(sw.skipped).toHaveLength(0); // install alone never self-activates

    await sw.runMessage({ type: 'nuqta-skip-waiting' });
    expect(sw.skipped).toHaveLength(1);
  });

  it('ignores unrelated and empty messages', async () => {
    const sw = loadServiceWorker({ fetchImpl: happyFetch });
    await sw.runInstall();
    await sw.runMessage(null);
    await sw.runMessage({ type: 'something-else' });
    expect(sw.skipped).toHaveLength(0);
  });

  it('does not reclaim caches just because a skip-waiting message arrived', async () => {
    const sw = loadServiceWorker({ initialCaches: [PREV_CACHE], fetchImpl: happyFetch });
    await sw.runInstall();
    await sw.runMessage({ type: 'nuqta-skip-waiting' });
    // Applying an update must not delete the old cache out from under other tabs.
    expect(sw.caches._stores.has(PREV_CACHE)).toBe(true);
  });
});
