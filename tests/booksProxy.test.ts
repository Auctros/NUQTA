// @vitest-environment node
/**
 * Book-catalogue proxy — the trust boundary for book search.
 *
 * Three things must never regress, because each one is a security or honesty property
 * rather than a feature:
 *
 *   1. The Google Books key is server-side. It must not appear in any response body or
 *      header, and it must only ever be sent to googleapis.com.
 *   2. The cover route takes a client-supplied URL and fetches it server-side, which is
 *      an SSRF surface. Only the two catalogues' image hosts may be reached.
 *   3. One provider failing must not fail the search, and both failing must produce a
 *      truthful error instead of an empty list that looks like "no results".
 *
 * Every outbound call is served by a fake fetch, so nothing here touches a catalogue.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  attachBooksProxy,
  createCache,
  isAllowedCoverUrl,
  searchGoogleBooks,
  searchOpenLibrary
} from '../scripts/books-proxy.mjs';

type Fetched = { ok: boolean; status: number; json: () => Promise<unknown>; arrayBuffer?: () => Promise<ArrayBuffer>; headers?: { get: (k: string) => string | null } };
type FetchLike = (input: string, init?: unknown) => Promise<Fetched>;

const KEY = 'server-side-google-books-key';

const proxyWith = (apiKey: string, fetchImpl: FetchLike, cache?: unknown) =>
  (attachBooksProxy as any)({ apiKey, fetchImpl, cache }) as {
    handle: (req: any, res: any) => Promise<boolean>;
  };

/** Minimal stand-in for an http ServerResponse, so `handle` can be called directly. */
function fakeResponse() {
  const state: { status: number; headers: Record<string, string>; body: string; chunks: Buffer[] } = {
    status: 0,
    headers: {},
    body: '',
    chunks: []
  };
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      state.status = status;
      state.headers = headers ?? {};
    },
    end(body?: unknown) {
      if (body === undefined) return;
      if (Buffer.isBuffer(body)) {
        state.chunks.push(body);
        state.body = body.toString('latin1');
      } else {
        state.body = String(body);
      }
    }
  };
  return { res, state, json: () => JSON.parse(state.body) };
}

const request = (url: string, method = 'GET') => ({ url, method }) as any;

/** A fetch stub that answers each provider from a table of canned bodies. */
function stubFetch(routes: Record<string, unknown>, status = 200): FetchLike {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    for (const [suffix, body] of Object.entries(routes)) {
      if (url.hostname.includes(suffix) || url.pathname.includes(suffix)) {
        return { ok: status >= 200 && status < 300, status, json: async () => body };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

const googleBody = {
  items: [
    {
      id: 'vol1',
      volumeInfo: {
        title: 'Sapiens',
        authors: ['Yuval Noah Harari'],
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780062316097' }],
        imageLinks: { thumbnail: 'https://books.google.com/books/content?id=vol1&zoom=1' }
      }
    }
  ]
};

const openLibraryBody = {
  docs: [
    {
      key: '/works/OL1W',
      title: 'العاقل',
      author_name: ['يوال نوح هراري'],
      first_publish_year: 2011,
      cover_i: 999,
      isbn: ['9789953891234']
    }
  ]
};

describe('proxy — key confinement', () => {
  it('never returns the key in a body or a header', async () => {
    const proxy = proxyWith(KEY, stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody }));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    expect(state.body).not.toContain(KEY);
    expect(JSON.stringify(state.headers)).not.toContain(KEY);
  });

  it('reports configuration without leaking the key itself', async () => {
    const proxy = proxyWith(KEY, stubFetch({}));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/status'), res);

    expect(json()).toEqual({ googleBooks: true, openLibrary: true });
    expect(state.body).not.toContain(KEY);
  });

  it('reports Open Library as available even with no Google key', async () => {
    const proxy = proxyWith('', stubFetch({ openlibrary: openLibraryBody }));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/status'), res);

    expect(json()).toEqual({ googleBooks: false, openLibrary: true });
  });

  it('sends the key only to googleapis.com', async () => {
    const fetchImpl = stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    const calls = (fetchImpl as any).mock.calls as [string][];
    for (const [url] of calls) {
      if (url.includes(KEY)) expect(new URL(url).hostname).toBe('www.googleapis.com');
    }
  });
});

describe('proxy — search', () => {
  it('returns both providers, each with its own ok flag', async () => {
    const proxy = proxyWith(KEY, stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody }));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    const body = json();
    expect(body.google.ok).toBe(true);
    expect(body.openLibrary.ok).toBe(true);
    expect(body.google.items).toHaveLength(1);
    expect(body.openLibrary.docs).toHaveLength(1);
  });

  it('keeps working when Google is not configured', async () => {
    const proxy = proxyWith('', stubFetch({ openlibrary: openLibraryBody }));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=العاقل'), res);

    const body = json();
    expect(body.google.ok).toBe(false);
    expect(body.google.error).toBe('not_configured');
    expect(body.openLibrary.ok).toBe(true);
    // The reader still gets a result, so a missing key is not a dead end.
    expect(body.openLibrary.docs).toHaveLength(1);
  });

  it('keeps working when Google fails but Open Library answers', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (new URL(input).hostname.includes('googleapis')) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => openLibraryBody };
    };
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    const body = json();
    expect(body.google.ok).toBe(false);
    expect(body.openLibrary.ok).toBe(true);
  });

  it('returns a truthful error when both providers fail', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    // 502, not 200 with an empty list: "no results" and "search is broken" differ.
    expect(state.status).toBe(502);
    expect(json().error).toBe('bad_response');
  });

  it('reports a quota failure as 429 rather than a generic error', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);

    expect(state.status).toBe(429);
    expect(json().error).toBe('quota_exceeded');
  });

  it('rejects an empty or over-long query before building a URL', async () => {
    const fetchImpl = stubFetch({});
    const proxy = proxyWith(KEY, fetchImpl);

    for (const url of ['/api/books/search?q=', '/api/books/search', `/api/books/search?q=${'a'.repeat(200)}`]) {
      const { res, state, json } = fakeResponse();
      await proxy.handle(request(url), res);
      expect(state.status).toBe(400);
    }
    expect((fetchImpl as any).mock.calls).toHaveLength(0);
  });

  it('rejects a non-GET method', async () => {
    const proxy = proxyWith(KEY, stubFetch({}));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=x', 'POST'), res);
    expect(state.status).toBe(405);
  });

  it('ignores a path outside its route', async () => {
    const proxy = proxyWith(KEY, stubFetch({}));
    const { res } = fakeResponse();
    expect(await proxy.handle(request('/api/youtube/status'), res)).toBe(false);
  });

  it('sets no-store so a proxy never caches catalogue answers', async () => {
    const proxy = proxyWith(KEY, stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody }));
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), res);
    expect(state.headers['Cache-Control']).toBe('no-store');
  });
});

describe('proxy — caching', () => {
  it('answers a repeated query from cache without a second upstream call', async () => {
    const fetchImpl = stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody });
    const cache = createCache(60_000, 10);
    const proxy = proxyWith(KEY, fetchImpl, cache);

    const first = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), first.res);
    const callsAfterFirst = (fetchImpl as any).mock.calls.length;

    const second = fakeResponse();
    await proxy.handle(request('/api/books/search?q=Sapiens'), second.res);

    expect((fetchImpl as any).mock.calls.length).toBe(callsAfterFirst);
    expect(second.json().cached).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('treats queries case-insensitively for cache purposes', async () => {
    const fetchImpl = stubFetch({ googleapis: googleBody, openlibrary: openLibraryBody });
    const proxy = proxyWith(KEY, fetchImpl);

    await proxy.handle(request('/api/books/search?q=SAPIENS'), fakeResponse().res);
    const callsAfterFirst = (fetchImpl as any).mock.calls.length;

    const second = fakeResponse();
    await proxy.handle(request('/api/books/search?q=sapiens'), second.res);

    expect((fetchImpl as any).mock.calls.length).toBe(callsAfterFirst);
    expect(second.json().cached).toBe(true);
  });

  it('expires an entry after its TTL', () => {
    const cache = createCache(0, 10);
    cache.set('k', { a: 1 });
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts the oldest entry past its bound', () => {
    const cache = createCache(60_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });
});

describe('proxy — cover SSRF boundary', () => {
  it('allows only the two catalogues image hosts over https', () => {
    expect(isAllowedCoverUrl('https://books.google.com/books/content?id=x')).toBe(true);
    expect(isAllowedCoverUrl('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe(true);
    expect(isAllowedCoverUrl('https://books.googleusercontent.com/x.jpg')).toBe(true);
  });

  it('refuses an arbitrary host, a non-https scheme and a malformed URL', () => {
    expect(isAllowedCoverUrl('https://evil.test/cover.jpg')).toBe(false);
    // A lookalike host must not slip through a substring check.
    expect(isAllowedCoverUrl('https://books.google.com.evil.test/x.jpg')).toBe(false);
    expect(isAllowedCoverUrl('http://books.google.com/x.jpg')).toBe(false);
    expect(isAllowedCoverUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedCoverUrl('http://127.0.0.1:8080/admin')).toBe(false);
    expect(isAllowedCoverUrl('not a url')).toBe(false);
  });

  it('rejects a disallowed cover URL without fetching anything', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=http://127.0.0.1:9000/secret'), res);

    expect(state.status).toBe(400);
    expect((fetchImpl as any).mock.calls).toHaveLength(0);
  });

  it('streams an allowed image back with its own content type', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      headers: { get: () => 'image/png' }
    });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    expect(state.status).toBe(200);
    expect(state.headers['Content-Type']).toBe('image/png');
    expect(state.headers['Cache-Control']).toBe('no-store');
  });

  it('refuses a response that is not an image', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: () => 'text/html' }
    });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://books.google.com/x'), res);

    expect(state.status).toBe(502);
    expect(json().error).toBe('not_an_image');
  });

  it('reports an upstream 404 as a missing cover, not a crash', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/404-L.jpg'), res);

    expect(state.status).toBe(404);
    expect(json().error).toBe('cover_unavailable');
  });
});

describe('provider query building', () => {
  it('sends an ISBN as an isbn: query so the exact edition comes back', async () => {
    const fetchImpl = stubFetch({ googleapis: googleBody });
    await (searchGoogleBooks as any)('9780062316097', { apiKey: KEY, fetchImpl, isbn: '9780062316097' });
    const url = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(url.searchParams.get('q')).toBe('isbn:9780062316097');
  });

  it('sends a plain text query as text', async () => {
    const fetchImpl = stubFetch({ googleapis: googleBody });
    await (searchGoogleBooks as any)('sapiens', { apiKey: KEY, fetchImpl });
    const url = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(url.searchParams.get('q')).toBe('sapiens');
  });

  it('queries Open Library with a bounded field list and no key', async () => {
    const fetchImpl = stubFetch({ openlibrary: openLibraryBody });
    await (searchOpenLibrary as any)('العاقل', { fetchImpl });
    const url = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(url.hostname).toBe('openlibrary.org');
    expect(url.searchParams.get('q')).toBe('العاقل');
    expect(url.searchParams.get('fields')).toContain('cover_i');
    expect(url.toString()).not.toContain('key=');
  });

  it('surfaces a timeout as a network failure rather than throwing', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('aborted');
    };
    const result = (await (searchGoogleBooks as any)('x', { apiKey: KEY, fetchImpl })) as { ok: boolean; code?: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe('network');
  });
});

describe('proxy — cover redirects cannot escape the allow-list', () => {
  it('refuses a redirect that leaves the allow-list instead of following it', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(String(url));
      return {
        ok: false,
        status: 302,
        json: async () => ({}),
        headers: { get: (k: string) => (k.toLowerCase() === 'location' ? 'http://127.0.0.1:9000/secret' : null) }
      };
    };
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    // The hop to the internal host was never fetched: the chain is re-validated.
    expect(calls).toHaveLength(1);
    expect(state.status).toBe(400);
  });

  it('follows an allow-listed redirect and returns the final image', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    let hop = 0;
    const fetchImpl: FetchLike = async () => {
      hop += 1;
      if (hop === 1) {
        return {
          ok: false,
          status: 301,
          json: async () => ({}),
          headers: {
            get: (k: string) =>
              k.toLowerCase() === 'location' ? 'https://books.google.com/books/content?id=x' : null
          }
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
        headers: { get: () => 'image/png' }
      };
    };
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    expect(state.status).toBe(200);
    expect(state.headers['Content-Type']).toBe('image/png');
  });

  it('stops after the redirect budget instead of chasing a loop', async () => {
    let hop = 0;
    const fetchImpl: FetchLike = async () => {
      hop += 1;
      return {
        ok: false,
        status: 302,
        json: async () => ({}),
        headers: {
          get: (k: string) =>
            k.toLowerCase() === 'location' ? 'https://covers.openlibrary.org/b/id/1-L.jpg' : null
        }
      };
    };
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    expect(hop).toBeLessThanOrEqual(4);
    expect(state.status).toBe(502);
    expect(json().error).toBe('too_many_redirects');
  });
});

describe('proxy — a cover body is bounded while it is read', () => {
  it('refuses an oversized declared body before downloading it', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: {
        get: (k: string) => (k.toLowerCase() === 'content-length' ? String(64 * 1024 * 1024) : 'image/jpeg')
      }
    });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    expect(state.status).toBe(413);
    expect(json().error).toBe('cover_too_large');
  });

  it('aborts an unannounced (chunked) body once it passes the ceiling', async () => {
    // 64 chunks of 128 KiB is 8 MiB — twice the 4 MiB limit, and no Content-Length.
    const chunk = new Uint8Array(128 * 1024);
    let sent = 0;
    let cancelled = false;
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      headers: { get: () => 'image/jpeg' },
      body: {
        getReader: () => ({
          read: async () => {
            if (sent >= 64) return { done: true, value: undefined };
            sent += 1;
            return { done: false, value: chunk };
          },
          cancel: async () => {
            cancelled = true;
          },
          releaseLock: () => {}
        })
      }
    } as unknown as Fetched);
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/books/cover?url=https://covers.openlibrary.org/b/id/1-L.jpg'), res);

    expect(state.status).toBe(413);
    expect(json().error).toBe('cover_too_large');
    // The read stopped early rather than draining 8 MiB first.
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(64);
  });
});
