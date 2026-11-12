/*
 * NUQTA service worker: offline app shell.
 *
 * The production build hashes asset filenames (e.g. /assets/index-<hash>.js), so the
 * precache list cannot be hard-coded. On install we fetch the built index.html, discover
 * the JavaScript/CSS/font assets it references, and precache all of them. After that the
 * app loads with no network at all. No user data is ever cached, and no third-party
 * origin is ever contacted (the CSP forbids it).
 */

const CACHE = 'nuqta-shell-v2';
const SCOPE = self.registration.scope;
const INDEX_URL = new URL(SCOPE).toString();

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
  const attrRe = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
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
  const urlRe = /url\(\s*("([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi;
  let m;
  while ((m = urlRe.exec(css)) !== null) {
    const url = toSameOriginUrl(m[2] ?? m[3] ?? m[4] ?? '', base);
    if (url) urls.add(url);
  }
  return [...urls];
}

async function fetchAndCache(cache, url) {
  const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
  if (!response || !response.ok) throw new Error(`Failed to precache ${url}`);
  // Store a clone so the caller can still read the original body.
  await cache.put(url, response.clone());
  return response;
}

/**
 * Populate the cache completely. Any failure deletes the cache and rethrows, so a failed
 * or interrupted install can never leave a misleading partially cached state behind; the
 * service worker simply does not activate.
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(INDEX_URL, copy));
          return res;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  // Hashed build assets, fonts, icons: cache first, fill the cache on first use.
  // ignoreVary matters because the preview/dev server sends `Vary: Origin`, and the
  // browser issues CORS-mode requests for module scripts and fonts; without it a cached
  // response would fail to match and the asset would be lost when offline.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
