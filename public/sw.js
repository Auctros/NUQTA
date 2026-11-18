/*
 * NUQTA service worker: offline app shell.
 *
 * The production build hashes asset filenames (e.g. /assets/index-<hash>.js), so the
 * precache list cannot be hard-coded. On install we fetch the built index.html, discover
 * the JavaScript/CSS/font/icon assets it references, and precache exactly those shell
 * assets. After that the app loads with no network at all.
 *
 * Privacy and isolation rules:
 *  - ONLY the explicitly discovered shell assets are ever written to the cache. The
 *    fetch handler never writes to the cache, so dynamic requests, API responses and
 *    user data are never cached.
 *  - Only NUQTA-owned caches (the `nuqta-shell-` prefix) are ever deleted. Another
 *    application's caches on the same origin are left untouched.
 *  - If installation fails, only the candidate cache for this version is removed, so a
 *    previously working version stays intact.
 *  - No third-party origin is ever contacted (the CSP forbids it).
 *
 * The cache name is versioned. Bump CACHE_VERSION whenever this file changes so the new
 * install writes a fresh candidate cache while the previous version keeps working.
 */

const CACHE_PREFIX = 'nuqta-shell-';
const CACHE_VERSION = 6;
const CACHE = `${CACHE_PREFIX}v${CACHE_VERSION}`;
const SCOPE = self.registration.scope;
const INDEX_URL = new URL(SCOPE).toString();
const NOTIFICATION_ICON = new URL('icon-192.png', SCOPE).toString();
const ANATOMY_MANIFEST = new URL('anatomy/manifest.json', SCOPE).toString();

/** Absolute, same-origin URL, or null if the reference is external/data/inline. */
function toSameOriginUrl(ref, base) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed || /^(data:|blob:|mailto:|#)/i.test(trimmed)) return null;
  let url;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.origin !== self.location.origin) return null;
  url.hash = '';
  return url.toString();
}

/** Every <script src> / <link href> in the shell HTML, as absolute same-origin URLs. */
function discoverShellAssets(html) {
  const urls = new Set();
  const tagRe = /<(script|link)\b[^>]*>/gi;
  const attrRe = /\b(?:src|href)\s*=\s*(\"([^\"]*)\"|'([^']*)')/gi;
  let tag;
  while ((tag = tagRe.exec(html)) !== null) {
    let attr;
    while ((attr = attrRe.exec(tag[0])) !== null) {
      const url = toSameOriginUrl(attr[2] ?? attr[3] ?? '', INDEX_URL);
      if (url && url !== INDEX_URL) urls.add(url);
    }
  }
  return [...urls];
}

/** Same-origin url(...) references inside a stylesheet (self-hosted fonts, images). */
function discoverStylesheetAssets(css, base) {
  const urls = new Set();
  const urlRe = /url\(\s*(\"([^\"]*)\"|'([^']*)'|([^)'"]*))\s*\)/gi;
  let m;
  while ((m = urlRe.exec(css)) !== null) {
    const url = toSameOriginUrl(m[2] ?? m[3] ?? m[4] ?? '', base);
    if (url) urls.add(url);
  }
  return [...urls];
}

/**
 * The anatomical écorché plates are only discovered through the manifest, so they are not
 * reachable from the shell HTML/CSS the generic discovery walks. Read the manifest and
 * precache every base plate and muscle mask it lists, so the anatomy reference is
 * available offline exactly like the rest of the shell. Best-effort: a missing manifest
 * (older build, partial deploy) is skipped rather than failing the whole install.
 */
async function precacheAnatomy(cache) {
  let manifest;
  try {
    const res = await fetch(new Request(ANATOMY_MANIFEST, { cache: 'reload', credentials: 'same-origin' }));
    if (!res || !res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  const refs = new Set();
  for (const view of manifest.base || []) refs.add(`anatomy/base_${view}.webp`);
  for (const [id, views] of Object.entries(manifest.masks || {})) {
    for (const view of views) refs.add(`anatomy/masks/${id}_${view}.webp`);
  }
  for (const ref of refs) {
    const url = toSameOriginUrl(ref, INDEX_URL);
    if (!url || (await cache.match(url, { ignoreVary: true }))) continue;
    try {
      await fetchAndCache(cache, url);
    } catch {
      /* one missing plate must not abort the whole install */
    }
  }
}

async function fetchAndCache(cache, url) {
  const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
  if (!response || !response.ok) throw new Error(`Failed to precache ${url}`);
  // Store a clone so the caller can still read the original body.
  await cache.put(url, response.clone());
  return response;
}

/**
 * Populate the candidate cache with the discovered shell assets. Any failure deletes
 * ONLY this version's candidate cache and rethrows, so a failed or interrupted install
 * can never leave a misleading partially cached state behind and never removes the
 * previously working version's cache. The service worker simply does not activate.
 */
async function precacheShell() {
  const cache = await caches.open(CACHE);
  try {
    const shell = await fetchAndCache(cache, INDEX_URL);
    const html = await shell.clone().text();

    const assets = discoverShellAssets(html);
    const stylesheets = [];

    for (const asset of assets) {
      const response = await fetchAndCache(cache, asset);
      if (asset.endsWith('.css')) stylesheets.push([asset, await response.clone().text()]);
    }

    // Fonts and images referenced from the cached stylesheets (still same-origin only).
    for (const [asset, css] of stylesheets) {
      for (const ref of discoverStylesheetAssets(css, asset)) {
        if (await cache.match(ref, { ignoreVary: true })) continue;
        await fetchAndCache(cache, ref);
      }
    }

    // The anatomical écorché plates (base + per-muscle masks) listed in their manifest.
    await precacheAnatomy(cache);
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Only obsolete NUQTA-owned caches. Other apps' caches are never touched.
        Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: network first (always get the latest build), fall back to the cached shell.
  // The network response is NOT written to the cache: navigations can carry dynamic
  // content and the cached shell must stay exactly what was precached at install.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(INDEX_URL, { ignoreVary: true })) || Response.error();
      })
    );
    return;
  }

  // Only precached shell assets are served from the cache. A miss is a plain network
  // fetch with no caching, so dynamic requests and API responses are never stored.
  // ignoreVary matters because the preview/dev server sends `Vary: Origin`, and the
  // browser issues CORS-mode requests for module scripts and fonts; without it a cached
  // response would fail to match and the asset would be lost when offline.
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(req, { ignoreVary: true }))
      .then((hit) => hit || fetch(req))
  );
});

/*
 * System notifications.
 *
 * Reminders are computed in the page (see `useNuqtaReminders`); the page asks the
 * service worker to display them so they use the OS notification channel and can be
 * shown while the tab is in the background. This is still NOT a background push: with
 * no server there is no way to wake the app when it is fully closed, so the page must
 * be open for a reminder to fire. The service worker only renders and routes clicks.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'nuqta-notify') return;
  const { title, body, tag, url, route } = data;
  if (!title) return;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body || '',
      tag: tag || 'nuqta-general',
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      data: { url: url || INDEX_URL, route }
    })
  );
});

// Focus an existing client (or open one) and tell the page which entity to open, so a
// reminder click lands on the exact task or habit it is about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || INDEX_URL;
  const route = data.route;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (route && 'postMessage' in client) {
            client.postMessage({ type: 'nuqta-notification-click', route });
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
