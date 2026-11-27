/**
 * Server-side book-catalogue proxy.
 *
 * Why a proxy at all: the browser bundle is public, so a `VITE_*` Google Books key
 * would be readable by anyone who loads the app. The key lives in the server
 * environment (`GOOGLE_BOOKS_API_KEY`) and only the server talks to the catalogue.
 * The page keeps its `connect-src 'self'` CSP because it only ever calls this origin.
 *
 * What this deliberately does NOT do:
 *   - scrape book websites. Neither provider's HTML is a contract; Google Books has
 *     an official API and Open Library a documented one, and those are used instead.
 *   - invent data when a provider fails. A failed provider is reported as failed so
 *     the UI can say so and still offer manual entry.
 *   - fail the whole search because one provider is down. Google Books and Open
 *     Library are queried independently; whichever answers is returned.
 *   - accept an arbitrary query from the client without validation. The query is
 *     length-capped and the provider ids are fixed.
 *
 * Open Library needs no key, so search keeps working with no configuration at all —
 * only the Google Books half is gated on `GOOGLE_BOOKS_API_KEY`.
 */

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1';
const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json';

/** A query longer than this is not a book search; cap it before it reaches a URL. */
const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 20;
/** Cache TTL for a search answer. Catalogues change slowly; keystrokes do not. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Hosts a cover may be fetched from.
 *
 * This route takes a URL from the client and fetches it server-side, which is an SSRF
 * surface by definition. The allow-list is the mitigation: only the two catalogues'
 * own image hosts are reachable, so a crafted `url` cannot be pointed at a local
 * service, a metadata endpoint, or an arbitrary site. Keep this list tight.
 */
const COVER_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org'
]);

/** A cover larger than this is not a cover; refuse rather than stream it. */
const MAX_COVER_BYTES = 4 * 1024 * 1024;

/**
 * How many redirects a cover fetch may follow.
 *
 * Redirects are followed BY HAND rather than with `redirect: 'follow'`, because the
 * allow-list can only be enforced on a URL we actually see. With automatic following
 * the runtime resolves the chain internally and an allowed host could bounce the
 * request to `127.0.0.1` or a cloud metadata endpoint — the classic SSRF bypass.
 */
const MAX_COVER_REDIRECTS = 3;

function isAllowedCoverUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return COVER_HOSTS.has(url.hostname);
}

/**
 * Fetch a cover through this origin and stream it back.
 *
 * The page cannot load a third-party image directly (its CSP allows no remote image
 * host), and a remote URL is not a durable reference anyway. The client turns this
 * response into a local data URL, so the cover survives offline once saved.
 *
 * Two hard limits protect the server:
 *   - every hop of a redirect chain is re-validated against `COVER_HOSTS`, so the
 *     allow-list cannot be escaped;
 *   - the body is read with a running byte counter and the read is aborted the moment
 *     it exceeds `MAX_COVER_BYTES`. A `Content-Length` check alone is not a limit: the
 *     header is advisory and a chunked response can stream for ever.
 */
async function proxyCover(rawUrl, res, fetchImpl, allowOrigin) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    let currentUrl = rawUrl;
    let upstream = null;
    for (let hop = 0; hop <= MAX_COVER_REDIRECTS; hop += 1) {
      if (!isAllowedCoverUrl(currentUrl)) {
        // The original URL was checked by the route; this catches a redirect that left
        // the allow-list, which is the only way this branch can be reached.
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_request' }));
        return;
      }
      upstream = await fetchImpl(currentUrl, {
        method: 'GET',
        headers: { Accept: 'image/*' },
        redirect: 'manual',
        signal: controller?.signal
      });

      const status = Number(upstream.status);
      if (status >= 300 && status < 400) {
        const location = upstream.headers?.get?.('location');
        if (!location) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'bad_redirect' }));
          return;
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      break;
    }

    if (!upstream) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'network' }));
      return;
    }

    const finalStatus = Number(upstream.status);
    if (finalStatus >= 300 && finalStatus < 400) {
      // The loop exhausted its hop budget while still being redirected.
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'too_many_redirects' }));
      return;
    }
    if (finalStatus === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cover_unavailable' }));
      return;
    }
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cover_unavailable' }));
      return;
    }

    const type = upstream.headers?.get?.('content-type') ?? '';
    if (!type.startsWith('image/')) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_an_image' }));
      return;
    }

    // Reject an oversized declared body before downloading it. This is an optimisation,
    // not the guarantee — the streaming counter below is what actually bounds the read.
    const declared = Number(upstream.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > MAX_COVER_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cover_too_large' }));
      return;
    }

    const buffer = await readCappedBody(upstream, MAX_COVER_BYTES);
    if (buffer === null) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cover_too_large' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': buffer.byteLength,
      'Cache-Control': 'no-store',
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {})
    });
    res.end(buffer);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'network' }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Read a response body while enforcing a hard byte ceiling.
 *
 * Returns `null` as soon as the accumulated size would exceed `limit`, so an
 * unannounced (chunked) response cannot make the process buffer gigabytes. A body with
 * no readable stream falls back to `arrayBuffer()` and is measured after the fact.
 */
async function readCappedBody(response, limit) {
  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > limit ? null : buffer;
  }

  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        // Stop the transfer instead of draining the rest of an oversized body.
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

/** Providers report failure as a value, never as a thrown error the route must guess at. */
function failure(code, detail) {
  return { ok: false, code, detail };
}

/**
 * A small in-process LRU-ish cache.
 *
 * Catalogues are slow and quota-limited, so the same title typed twice should not
 * cost two requests. Entries are keyed by provider + query and expire, so a stale
 * answer cannot outlive the TTL. This is a cache of *public* bibliographic data,
 * never of user data.
 */
function createCache(ttlMs = CACHE_TTL_MS, maxEntries = CACHE_MAX_ENTRIES) {
  const entries = new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (Date.now() >= hit.expires) {
        entries.delete(key);
        return undefined;
      }
      // Refresh recency so the hot keys survive eviction.
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      entries.set(key, { value, expires: Date.now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    }
  };
}

async function fetchJson(url, fetchImpl) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal
    });
    if (!response.ok) {
      if (response.status === 429) return failure('quota_exceeded');
      if (response.status === 404) return failure('not_found');
      return failure('bad_response', `status ${response.status}`);
    }
    const body = await response.json();
    return { ok: true, value: body };
  } catch {
    // A timeout and a dropped connection are the same thing to the reader.
    return failure('network');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Query Google Books.
 *
 * The API key is optional for this endpoint but strongly recommended: without one the
 * quota is shared per IP and a personal library can hit it. A `q` that is a valid
 * ISBN is sent as `isbn:` so the answer is the exact edition rather than a text match.
 */
export async function searchGoogleBooks(query, options = {}) {
  const apiKey = options.apiKey ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const isbn = options.isbn;

  const url = new URL(`${GOOGLE_BOOKS_API}/volumes`);
  url.searchParams.set('q', isbn ? `isbn:${isbn}` : query);
  url.searchParams.set('maxResults', String(Math.min(options.maxResults ?? 12, MAX_RESULTS)));
  url.searchParams.set('printType', 'books');
  // Ask only for what the UI renders; the full volume document is much larger.
  url.searchParams.set('fields', 'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,language,imageLinks,infoLink,canonicalVolumeLink))');
  if (apiKey) url.searchParams.set('key', apiKey);

  const result = await fetchJson(url.toString(), fetchImpl);
  if (!result.ok) return result;
  return { ok: true, value: { items: Array.isArray(result.value?.items) ? result.value.items : [] } };
}

/**
 * Query Open Library.
 *
 * No key, so this half works out of the box. `fields` keeps the payload small; the
 * default document is much larger than anything this UI renders.
 */
export async function searchOpenLibrary(query, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const url = new URL(OPEN_LIBRARY_SEARCH);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(Math.min(options.maxResults ?? 12, MAX_RESULTS)));
  url.searchParams.set(
    'fields',
    'key,title,subtitle,author_name,first_publish_year,publisher,language,isbn,cover_i,subject,number_of_pages_median'
  );

  const result = await fetchJson(url.toString(), fetchImpl);
  if (!result.ok) return result;
  return { ok: true, value: { docs: Array.isArray(result.value?.docs) ? result.value.docs : [] } };
}

/**
 * Attach `/api/books/*` to an existing Node http server.
 *
 * Returns a handler the caller invokes first: it returns `true` when it owns the
 * request, so the static file handler never has to know this route exists.
 */
export function attachBooksProxy(options = {}) {
  const apiKey = options.apiKey ?? process.env.GOOGLE_BOOKS_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const allowOrigin = options.allowOrigin;
  const cache = options.cache ?? createCache();

  const send = (res, status, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      // Catalogue data is a cache of a remote answer; never let a proxy store it.
      'Cache-Control': 'no-store',
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {})
    });
    res.end(payload);
  };

  const handle = async (req, res) => {
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      send(res, 400, { error: 'bad_request' });
      return true;
    }

    if (!url.pathname.startsWith('/api/books/')) return false;

    if (req.method !== 'GET') {
      send(res, 405, { error: 'method_not_allowed' });
      return true;
    }

    const route = url.pathname.slice('/api/books/'.length);

    if (route === 'status') {
      // Open Library needs no key, so search is always at least partly available.
      send(res, 200, { googleBooks: Boolean(apiKey), openLibrary: true });
      return true;
    }

    if (route === 'search') {
      const rawQuery = (url.searchParams.get('q') ?? '').trim();
      if (!rawQuery || rawQuery.length > MAX_QUERY_LENGTH) {
        send(res, 400, { error: 'bad_request' });
        return true;
      }
      const isbn = /^[0-9Xx-]{10,17}$/.test(rawQuery) ? rawQuery.replace(/[^0-9Xx]/g, '') : '';

      const cacheKey = `${isbn ? 'isbn' : 'q'}:${rawQuery.toLowerCase()}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        send(res, 200, { ...cached, cached: true });
        return true;
      }

      // Both providers run concurrently; one failing must not fail the search.
      const [google, openLibrary] = await Promise.all([
        apiKey
          ? searchGoogleBooks(rawQuery, { apiKey, fetchImpl, isbn })
          : Promise.resolve(failure('not_configured')),
        searchOpenLibrary(rawQuery, { fetchImpl })
      ]);

      const googleItems = google.ok ? google.value.items : [];
      const openLibraryDocs = openLibrary.ok ? openLibrary.value.docs : [];

      // Both failed: that is a real error, and the UI must be able to say so.
      if (!google.ok && !openLibrary.ok) {
        const code =
          google.code === 'quota_exceeded' || openLibrary.code === 'quota_exceeded'
            ? 'quota_exceeded'
            : google.code === 'network' && openLibrary.code === 'network'
            ? 'network'
            : 'bad_response';
        send(res, code === 'quota_exceeded' ? 429 : 502, {
          error: code,
          google: google.code,
          openLibrary: openLibrary.code
        });
        return true;
      }

      const payload = {
        query: rawQuery,
        google: { ok: google.ok, items: googleItems, error: google.ok ? undefined : google.code },
        openLibrary: { ok: openLibrary.ok, docs: openLibraryDocs, error: openLibrary.ok ? undefined : openLibrary.code }
      };
      cache.set(cacheKey, payload);
      send(res, 200, payload);
      return true;
    }

    if (route === 'cover') {
      const target = (url.searchParams.get('url') ?? '').trim();
      if (!isAllowedCoverUrl(target)) {
        send(res, 400, { error: 'bad_request' });
        return true;
      }
      await proxyCover(target, res, fetchImpl, allowOrigin);
      return true;
    }

    send(res, 404, { error: 'not_found' });
    return true;
  };

  return { handle, googleBooksConfigured: Boolean(apiKey), cache };
}

export {
  createCache,
  isAllowedCoverUrl,
  MAX_QUERY_LENGTH,
  MAX_COVER_BYTES,
  MAX_COVER_REDIRECTS,
  COVER_HOSTS
};
