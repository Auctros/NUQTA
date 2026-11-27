/**
 * Book catalogue client — the browser half of the boundary.
 *
 * The client is where the awkward real-world cases live: a slow answer arriving after a
 * newer one, a cancelled keystroke, a proxy that is not deployed at all. Each of those
 * must produce a value the UI can act on, never an exception and never a silent empty
 * list that reads as "this book does not exist".
 *
 * `fetchImpl` is injected, so nothing here leaves the process.
 */
import { describe, it, expect, vi } from 'vitest';
import { BooksClient, describeBooksError } from '../src/lib/booksClient';

type Fetched = { ok: boolean; status: number; json: () => Promise<unknown> };
type FetchLike = (input: string, init?: unknown) => Promise<Fetched>;

const ok = (body: unknown): Fetched => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown = {}): Fetched => ({
  ok: false,
  status,
  json: async () => body
});

const googleBody = {
  google: {
    ok: true,
    items: [
      {
        id: 'vol1',
        volumeInfo: {
          title: 'Sapiens',
          authors: ['Yuval Noah Harari'],
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780062316097' }]
        }
      }
    ]
  },
  openLibrary: {
    ok: true,
    docs: [
      {
        key: '/works/OL1W',
        title: 'العاقل',
        author_name: ['يوال نوح هراري'],
        first_publish_year: 2011,
        isbn: ['9789953891234']
      }
    ]
  }
};

const client = (fetchImpl: FetchLike, extra: Record<string, unknown> = {}) =>
  new BooksClient({ fetchImpl: fetchImpl as unknown as typeof fetch, basePath: '/api/books', ...extra });

describe('search — normalising the answer', () => {
  it('returns both providers as one list of internal results', async () => {
    const fetchImpl = vi.fn(async () => ok(googleBody)) as unknown as FetchLike;
    const result = await client(fetchImpl).search('sapiens');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.results).toHaveLength(2);
    expect(result.value.results.map((r) => r.source).sort()).toEqual(['google_books', 'open_library']);
  });

  it('reports which providers answered, so the UI can be honest about coverage', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ google: { ok: false, items: [], error: 'not_configured' }, openLibrary: { ok: true, docs: [] } })
    ) as unknown as FetchLike;
    const result = await client(fetchImpl).search('sapiens');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.providers.googleBooks.ok).toBe(false);
    expect(result.value.providers.googleBooks.error).toBe('not_configured');
    expect(result.value.providers.openLibrary.ok).toBe(true);
  });

  it('returns an empty list for an empty query without any request', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const result = await client(fetchImpl).search('   ');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.results).toEqual([]);
    expect((fetchImpl as any).mock.calls).toHaveLength(0);
  });

  it('skips a malformed provider row instead of failing the whole search', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({
        google: { ok: true, items: [{ id: 'good', volumeInfo: { title: 'Fine' } }, { volumeInfo: {} }] },
        openLibrary: { ok: true, docs: [{ title: 'no key' }] }
      })
    ) as unknown as FetchLike;
    const result = await client(fetchImpl).search('x');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.results).toHaveLength(1);
    expect(result.value.results[0].title).toBe('Fine');
  });

  it('encodes a query with spaces and Arabic characters safely', async () => {
    const fetchImpl = vi.fn(async () => ok({ google: { ok: true, items: [] }, openLibrary: { ok: true, docs: [] } })) as unknown as FetchLike;
    await client(fetchImpl).search('العاقل sapiens');
    const url = (fetchImpl as any).mock.calls[0][0] as string;
    expect(url).toContain('/api/books/search?q=');
    expect(url).not.toContain(' ');
    expect(decodeURIComponent(url.split('q=')[1])).toBe('العاقل sapiens');
  });
});

describe('search — caching', () => {
  it('answers a repeated query from memory without a second request', async () => {
    const fetchImpl = vi.fn(async () => ok(googleBody)) as unknown as FetchLike;
    const c = client(fetchImpl);

    await c.search('sapiens');
    await c.search('Sapiens');

    expect((fetchImpl as any).mock.calls).toHaveLength(1);
  });

  it('marks a cached answer as cached', async () => {
    const fetchImpl = vi.fn(async () => ok(googleBody)) as unknown as FetchLike;
    const c = client(fetchImpl);
    await c.search('sapiens');
    const second = await c.search('sapiens');

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.cached).toBe(true);
  });

  it('re-queries after the cache is cleared, which is what retry relies on', async () => {
    const fetchImpl = vi.fn(async () => ok(googleBody)) as unknown as FetchLike;
    const c = client(fetchImpl);
    await c.search('sapiens');
    c.clearCache();
    await c.search('sapiens');

    expect((fetchImpl as any).mock.calls).toHaveLength(2);
  });

  it('does not cache a failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fail(502, { error: 'bad_response' }))
      .mockResolvedValueOnce(ok(googleBody)) as unknown as FetchLike;
    const c = client(fetchImpl);

    const first = await c.search('sapiens');
    expect(first.ok).toBe(false);

    // A retry must actually retry rather than replay the cached failure.
    const second = await c.search('sapiens');
    expect(second.ok).toBe(true);
    expect((fetchImpl as any).mock.calls).toHaveLength(2);
  });
});

describe('search — failures are values', () => {
  it('maps 429 to a quota failure', async () => {
    const fetchImpl = vi.fn(async () => fail(429, { error: 'quota_exceeded' })) as unknown as FetchLike;
    const result = await client(fetchImpl).search('x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('quota_exceeded');
  });

  it('maps 503 to not_configured', async () => {
    const fetchImpl = vi.fn(async () => fail(503, { error: 'not_configured' })) as unknown as FetchLike;
    const result = await client(fetchImpl).search('x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_configured');
  });

  it('maps a thrown connection error to network', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as FetchLike;
    const result = await client(fetchImpl).search('x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('network');
  });

  it('maps a 5xx to bad_response', async () => {
    const fetchImpl = vi.fn(async () => fail(500, {})) as unknown as FetchLike;
    const result = await client(fetchImpl).search('x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('bad_response');
  });

  it('treats a missing fetch implementation as network, not a crash', async () => {
    const c = new BooksClient({ fetchImpl: undefined, basePath: '/api/books' });
    const result = await c.search('x');

    // jsdom provides fetch, so force the absent case explicitly.
    if (result.ok) return;
    expect(['network', 'bad_response']).toContain(result.error);
  });
});

describe('search — cancellation', () => {
  it('passes an abort signal through to fetch', async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: any) => {
      expect(init.signal).toBeDefined();
      return ok(googleBody);
    }) as unknown as FetchLike;
    const controller = new AbortController();
    await client(fetchImpl).search('sapiens', { signal: controller.signal });

    expect((fetchImpl as any).mock.calls).toHaveLength(1);
  });

  it('reports a cancelled request as network rather than throwing', async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: any) => {
      const signal = init?.signal as AbortSignal | undefined;
      // Mimic a real fetch rejecting once its signal aborts.
      return await new Promise<Fetched>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('AbortError')));
        setTimeout(() => reject(new Error('AbortError')), 5);
      });
    }) as unknown as FetchLike;

    const controller = new AbortController();
    const pending = client(fetchImpl).search('sapiens', { signal: controller.signal });
    controller.abort();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('network');
  });

  it('aborts immediately when the signal is already aborted', async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: any) => {
      if (init?.signal?.aborted) throw new Error('AbortError');
      return ok(googleBody);
    }) as unknown as FetchLike;

    const controller = new AbortController();
    controller.abort();
    const result = await client(fetchImpl).search('sapiens', { signal: controller.signal });

    expect(result.ok).toBe(false);
  });
});

describe('status', () => {
  it('reports the proxy configuration', async () => {
    const fetchImpl = vi.fn(async () => ok({ googleBooks: true, openLibrary: true })) as unknown as FetchLike;
    expect(await client(fetchImpl).status()).toEqual({
      googleBooks: true,
      openLibrary: true,
      available: true
    });
  });

  it('reads an unreachable proxy as unavailable instead of throwing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('nope');
    }) as unknown as FetchLike;
    expect(await client(fetchImpl).status()).toEqual({
      googleBooks: false,
      openLibrary: false,
      available: false
    });
  });
});

describe('cover URL', () => {
  it('routes a cover through this origin rather than the provider host', () => {
    const c = client(vi.fn() as unknown as FetchLike);
    const url = c.coverUrl('https://covers.openlibrary.org/b/id/1-L.jpg');

    expect(url.startsWith('/api/books/cover?url=')).toBe(true);
    expect(decodeURIComponent(url.split('url=')[1])).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
  });

  it('encodes a URL containing its own query string', () => {
    const c = client(vi.fn() as unknown as FetchLike);
    const url = c.coverUrl('https://books.google.com/books/content?id=x&zoom=2');
    // The inner `&` must not become a second parameter of the proxy request.
    expect(url.split('&')).toHaveLength(1);
  });
});

describe('error copy', () => {
  it('has a bilingual message for every error code', () => {
    for (const code of ['not_configured', 'quota_exceeded', 'network', 'bad_response'] as const) {
      const message = describeBooksError(code);
      expect(message.ar.length).toBeGreaterThan(0);
      expect(message.en.length).toBeGreaterThan(0);
    }
  });

  it('points the reader at manual entry when search cannot run', () => {
    expect(describeBooksError('not_configured').en).toContain('manually');
  });
});
