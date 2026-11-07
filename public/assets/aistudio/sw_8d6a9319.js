/* NUQTA — Service Worker (personal build)
 * Single-user, single-device, non-commercial usage.
 *
 * Strategies:
 *   Navigation (HTML)         → network-first, fallback to cached index.html
 *   Shell (app.js, styles.css) → network-first, so your edits appear on the next reload
 *   Icons, manifest           → cache-first (rarely change)
 *   Everything else same-origin → network-first with runtime cache
 *   Cross-origin requests     → not intercepted (browser handles them normally)
 *
 * Update flow:
 *   - After editing app.js / styles.css / index.html → just reload while online.
 *     No VERSION bump needed.
 *   - After editing manifest.json or replacing icons → bump VERSION below once,
 *     then reload. Old caches are cleared on activate.
 *   - If you ever change the cache storage layout → bump VERSION as well.
 */

const VERSION = 'v2';
const SHELL_CACHE = `nuqta-shell-${VERSION}`;
const RUNTIME_CACHE = `nuqta-runtime-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* ------------------------------------------------------------------ *
 *  Lifecycle                                                          *
 * ------------------------------------------------------------------ */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Precache each asset individually so a single missing file
    // doesn't abort the whole install. Fetches use { cache: 'reload' }
    // to bypass the HTTP cache and get fresh bytes on every install.
    await Promise.all(CORE_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response);
      } catch (err) {
        console.warn('[SW] precache skipped:', url, err?.message || err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// The page can request immediate activation (optional).
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ------------------------------------------------------------------ *
 *  Routing helpers                                                    *
 * ------------------------------------------------------------------ */

const sameOrigin = url => new URL(url).origin === self.location.origin;
const pathOf = url => new URL(url).pathname;

const isNavigation = request =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html'));

const isStatic = url =>
  /\.(?:png|jpe?g|svg|webp|ico|woff2?|json)$/i.test(pathOf(url));

const isShell = url =>
  /\.(?:js|css|html?)$/i.test(pathOf(url));

/* ------------------------------------------------------------------ *
 *  Cache strategies                                                   *
 * ------------------------------------------------------------------ */

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Offline: prefer the exact page, then the app shell.
    const cached = await caches.match(request);
    if (cached) return cached;
    return (await caches.match('./index.html'))
        || (await caches.match('./'))
        || new Response('Offline', {
             status: 503,
             headers: { 'Content-Type': 'text/plain; charset=utf-8' }
           });
  }
}

/* ------------------------------------------------------------------ *
 *  Fetch router                                                       *
 * ------------------------------------------------------------------ */

self.addEventListener('fetch', event => {
  const { request } = event;

  // Never intercept non-GET or cross-origin traffic.
  if (request.method !== 'GET') return;
  if (!sameOrigin(request.url)) return;

  // 1) Page navigations
  if (isNavigation(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 2) Icons, manifest, fonts → cache-first
  if (isStatic(request.url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 3) Shell JS/CSS → network-first (fresh edits show on next reload)
  if (isShell(request.url)) {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(() =>
        new Response('', { status: 504, statusText: 'Offline' })
      )
    );
    return;
  }

  // 4) Everything else same-origin → network-first with runtime cache
  event.respondWith(
    networkFirst(request, RUNTIME_CACHE).catch(() =>
      new Response('', { status: 504, statusText: 'Offline' })
    )
  );
});