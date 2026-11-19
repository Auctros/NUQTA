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
const CACHE_VERSION = 7;
const CACHE = `${CACHE_PREFIX}v${CACHE_VERSION}`;
const SCOPE = self.registration.scope;
const INDEX_URL = new URL(SCOPE).toString();
const NOTIFICATION_ICON = new URL('icon-192.png', SCOPE).toString();
const ART_MANIFEST = new URL('exercise-art/manifest.json', SCOPE).toString();

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
 * The exercise illustrations are referenced from CSS masks, not from the shell HTML,
 * so the generic discovery cannot see them. Read their manifest and precache every
 * drawing, so the exercise library is complete offline exactly like the rest of the
 * shell. Best-effort: a missing manifest (older build, partial deploy) is skipped
 * rather than failing the whole install.
 */
async function precacheExerciseArt(cache) {
  let manifest;
  try {
    const res = await fetch(new Request(ART_MANIFEST, { cache: 'reload', credentials: 'same-origin' }));
    if (!res || !res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  for (const id of Object.keys(manifest.art || {})) {
    const url = toSameOriginUrl(`exercise-art/${id}.svg`, INDEX_URL);
    if (!url || (await cache.match(url, { ignoreVary: true }))) continue;
    try {
      await fetchAndCache(cache, url);
    } catch {
      /* one missing drawing must not abort the whole install */
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

    // The exercise illustrations listed in their manifest.
    await precacheExerciseArt(cache);
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

/*
 * A newly installed worker deliberately does NOT call skipWaiting() on its own. An update
 * that activated itself would swap the cache out from under a page the user is still
 * working in, and any reload that followed could lose their in-progress state. Instead the
 * worker waits until a page sends `nuqta-skip-waiting` (the user chose "Apply update"), so
 * the update is applied at a moment a page picked.
 *
 * skipWaiting() is a GLOBAL action: it activates this worker for every client of the
 * origin, and `controllerchange` then fires in every open tab. The page side (see
 * src/lib/pwaUpdate.ts) elects a single tab to send the message and makes only that tab
 * reload; every other tab adopts the new controller without reloading.
 *
 * The very first install has no controller to displace, so it still activates immediately.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
});

/*
 * Activation claims the open pages but deliberately does NOT delete the previous version's
 * cache. A page that is still running the old build may lazy-load assets from it (for
 * example the anatomical plates), and one tab reloading is not proof that the others have.
 * Reclaiming happens later, on an explicit `nuqta-claim-cleanup` message from a page that
 * has already reloaded onto the new build, and even then the immediately previous version
 * is retained (see deleteObsoleteCaches). The first install has no previous cache to keep.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * How many previous versions' caches to keep. A tab still running an earlier build may
 * need its assets, and a reloaded tab does not prove every other tab has migrated. Keeping
 * one previous version bounds storage to two shell caches while letting those tabs keep
 * working; anything further behind is reclaimed.
 */
const RETAINED_PREVIOUS_VERSIONS = 1;

/** Numeric version of a `nuqta-shell-vN` name, so caches can be ordered newest-first. */
function shellVersion(name) {
  const match = /^nuqta-shell-v(\d+)$/.exec(name);
  return match ? Number(match[1]) : 0;
}

/** NUQTA-owned shell caches other than the current one, newest first. */
async function olderShellCaches() {
  const keys = await caches.keys();
  return keys
    .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
    .sort((a, b) => shellVersion(b) - shellVersion(a));
}

/**
 * Reclaim obsolete NUQTA caches, keeping the current version plus the previous
 * RETAINED_PREVIOUS_VERSIONS. A tab reloading is not proof that every other tab has
 * migrated, so the previous cache is preserved for any tab still running the previous
 * build. Only caches more than RETAINED_PREVIOUS_VERSIONS behind are deleted, and other
 * applications' caches are never touched.
 */
async function deleteObsoleteCaches() {
  const obsolete = await olderShellCaches();
  await Promise.all(obsolete.slice(RETAINED_PREVIOUS_VERSIONS).map((k) => caches.delete(k)));
}

/**
 * Look for a precached asset in an older NUQTA shell cache. A page still running the
 * previous build may request an asset that only that build's cache holds; because the
 * previous cache is retained, we can still serve it here — including offline — until the
 * cache ages out or that page reloads.
 */
async function matchInOlderShellCaches(request) {
  for (const key of await olderShellCaches()) {
    const hit = await (await caches.open(key)).match(request, { ignoreVary: true });
    if (hit) return hit;
  }
  return undefined;
}

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
  //
  // `cache: 'no-cache'` forces the browser to revalidate the document with the server
  // instead of serving it from the HTTP cache. GitHub Pages marks index.html
  // `max-age=600`, so without this a reload within ten minutes would keep handing back the
  // OLD document — and therefore the OLD hashed bundle — even after a new deploy.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).catch(async () => {
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
  //
  // On a miss in the current cache we check older NUQTA shell caches before the network:
  // a page still running the previous build may need an asset only that build precached,
  // and the old cache is deliberately kept until that page reloads (see activate above).
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(req, { ignoreVary: true }))
      .then(async (hit) => hit || (await matchInOlderShellCaches(req)) || fetch(req))
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
  if (!data) return;

  // A page decided now is a safe moment to apply a pending update (its user pressed
  // "Apply update"). Only a *waiting* worker needs this; calling it on the active worker is
  // a harmless no-op. Activation then fires `controllerchange` in EVERY open tab; the page
  // side makes only the tab that asked reload, so no other tab is interrupted.
  if (data.type === 'nuqta-skip-waiting') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  // A page that has reloaded onto this build asks us to reclaim the previous version's
  // cache now. Doing it here — and not during activate — keeps assets the not-yet-reloaded
  // tabs may still lazy-load available until they have moved on.
  if (data.type === 'nuqta-claim-cleanup') {
    event.waitUntil(deleteObsoleteCaches());
    return;
  }

  if (data.type !== 'nuqta-notify') return;
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
