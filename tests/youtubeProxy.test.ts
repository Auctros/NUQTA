// @vitest-environment node
/**
 * YouTube proxy — the one place this app talks to a third party.
 *
 * These tests exist because the proxy is a trust boundary: it holds a server-side API
 * key and builds outbound URLs. The invariants worth pinning are that the key never
 * appears in a response, that a playlist id is validated before it is interpolated
 * into a URL, and that a missing key produces a truthful error rather than fake data.
 *
 * Every outbound call is served by a fake fetch, so nothing here touches Google.
 */
import { describe, it, expect, vi } from 'vitest';
import { attachYoutubeProxy, fetchPlaylist } from '../scripts/youtube-proxy.mjs';

/**
 * The proxy is a `.mjs` module with no types, so its results are treated as the shapes
 * asserted below rather than re-deriving an interface the source does not export.
 */
type PlaylistResult = { ok: boolean; value?: any; code?: string; reason?: string };
type Fetched = { ok: boolean; status: number; json: () => Promise<unknown> };
type FetchLike = (input: string) => Promise<Fetched>;

const run = (id: string, key: string, fetchImpl: FetchLike) =>
  (fetchPlaylist as any)(id, key, fetchImpl) as Promise<PlaylistResult>;

const proxyWith = (apiKey: string, fetchImpl: FetchLike) =>
  (attachYoutubeProxy as any)({ apiKey, fetchImpl }) as {
    handle: (req: any, res: any) => Promise<boolean>;
  };

const KEY = 'server-side-secret-key';
const PLAYLIST_ID = 'PLillGF-RfqbbnE1ZyYY0k8XLKzWVC5cU4';

/** Minimal stand-in for an http ServerResponse, so `handle` can be called directly. */
function fakeResponse() {
  const state: { status: number; headers: Record<string, string>; body: string } = {
    status: 0,
    headers: {},
    body: ''
  };
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      state.status = status;
      state.headers = headers ?? {};
    },
    end(body: string) {
      state.body = body ?? '';
    }
  };
  return { res, state, json: () => JSON.parse(state.body) };
}

const request = (url: string, method = 'GET') => ({ url, method }) as any;

/** A fetch stub that answers YouTube's endpoints from a table of canned bodies. */
function stubFetch(routes: Record<string, unknown>, status = 200): FetchLike {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    for (const [suffix, body] of Object.entries(routes)) {
      if (url.pathname.endsWith(suffix)) {
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => body
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

const playlistMeta = {
  items: [
    {
      id: PLAYLIST_ID,
      snippet: { title: 'Learn TypeScript', description: 'A course', channelTitle: 'Type Academy' },
      contentDetails: { itemCount: 2 }
    }
  ]
};

const playlistItems = {
  items: [
    {
      snippet: {
        title: 'Lesson one',
        position: 0,
        resourceId: { videoId: 'aaaaaaaaaaa' },
        thumbnails: { high: { url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg' } }
      },
      contentDetails: { videoId: 'aaaaaaaaaaa', videoPublishedAt: '2026-01-01T00:00:00Z' }
    },
    {
      snippet: { title: 'Lesson two', position: 1, resourceId: { videoId: 'bbbbbbbbbbb' } },
      contentDetails: { videoId: 'bbbbbbbbbbb' }
    }
  ]
};

const videoDetails = {
  items: [
    { id: 'aaaaaaaaaaa', contentDetails: { duration: 'PT1H2M10S' } },
    { id: 'bbbbbbbbbbb', contentDetails: { duration: 'PT45S' } }
  ]
};

describe('fetchPlaylist', () => {
  it('returns the playlist with its videos in YouTube order', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': playlistItems,
      '/videos': videoDetails
    });
    const result = await run(PLAYLIST_ID, KEY, fetchImpl);

    expect(result.ok).toBe(true);
    expect(result.value.title).toBe('Learn TypeScript');
    expect(result.value.channelTitle).toBe('Type Academy');
    expect(result.value.videos.map((v: any) => v.title)).toEqual(['Lesson one', 'Lesson two']);
  });

  it('parses ISO durations into seconds', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': playlistItems,
      '/videos': videoDetails
    });
    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.value.videos[0].durationSeconds).toBe(3730);
    expect(result.value.videos[1].durationSeconds).toBe(45);
  });

  it('keeps deleted and private videos as unavailable so positions stay honest', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': {
        items: [
          { snippet: { title: 'Deleted video', position: 0 }, contentDetails: {} },
          {
            snippet: { title: 'Lesson two', position: 1, resourceId: { videoId: 'bbbbbbbbbbb' } },
            contentDetails: { videoId: 'bbbbbbbbbbb' }
          }
        ]
      },
      '/videos': videoDetails
    });
    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.value.videos).toHaveLength(2);
    expect(result.value.videos[0].unavailable).toBe(true);
    expect(result.value.videos[0].position).toBe(0);
    expect(result.value.videos[1].position).toBe(1);
  });

  it('rejects an id that is not a playlist id before building a URL', async () => {
    const fetchImpl = vi.fn();
    const result = await run('not a playlist id!', KEY, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('bad_request');
    expect(fetchImpl as unknown as { mock: { calls: unknown[] } }).not.toHaveBeenCalled();
  });

  it('reports a missing playlist as not_found rather than an empty course', async () => {
    const fetchImpl = stubFetch({ '/playlists': { items: [] } });
    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
  });

  it('maps a 403 to quota_exceeded so the UI can say why', async () => {
    const fetchImpl = stubFetch(
      { '/playlists': { error: { errors: [{ reason: 'quotaExceeded' }] } } },
      403
    );
    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('quota_exceeded');
  });

  it('still returns a usable course when the duration call fails', async () => {
    // Durations are a nicety; losing them must not lose the course.
    const fetchImpl = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/playlists')) {
        return { ok: true, status: 200, json: async () => playlistMeta };
      }
      if (url.pathname.endsWith('/playlistItems')) {
        return { ok: true, status: 200, json: async () => playlistItems };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    });

    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.value.videos).toHaveLength(2);
    expect(result.value.videos[0].durationSeconds).toBeUndefined();
  });

  it('marks the course truncated when the page cap is hit', async () => {
    let page = 0;
    const fetchImpl = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/playlists')) {
        return { ok: true, status: 200, json: async () => playlistMeta };
      }
      if (url.pathname.endsWith('/playlistItems')) {
        page += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                snippet: {
                  title: `Lesson ${page}`,
                  position: page,
                  resourceId: { videoId: `v${String(page).padStart(10, '0')}` }
                },
                contentDetails: { videoId: `v${String(page).padStart(10, '0')}` }
              }
            ],
            // Always another page, so the cap is what stops the loop.
            nextPageToken: `page-${page + 1}`
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    });

    const result = await run(PLAYLIST_ID, KEY, fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.value.truncated).toBe(true);
    expect(page).toBe(40);
  });
});

describe('attachYoutubeProxy — routing', () => {
  it('declines requests outside /api/youtube/ so static serving still works', async () => {
    const proxy = proxyWith(KEY, vi.fn() as unknown as FetchLike);
    const { res } = fakeResponse();
    expect(await proxy.handle(request('/index.html'), res)).toBe(false);
    expect(await proxy.handle(request('/sync/delta'), res)).toBe(false);
  });

  it('answers /status with whether a key is configured', async () => {
    const withKey = proxyWith(KEY, vi.fn() as unknown as FetchLike);
    const a = fakeResponse();
    await withKey.handle(request('/api/youtube/status'), a.res);
    expect(a.state.status).toBe(200);
    expect(a.json()).toEqual({ configured: true });

    const withoutKey = proxyWith('', vi.fn() as unknown as FetchLike);
    const b = fakeResponse();
    await withoutKey.handle(request('/api/youtube/status'), b.res);
    expect(b.json()).toEqual({ configured: false });
  });

  it('says not_configured instead of inventing a course when there is no key', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const proxy = proxyWith('', fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request(`/api/youtube/playlist?id=${PLAYLIST_ID}`), res);

    expect(state.status).toBe(503);
    expect(json().error).toBe('not_configured');
    expect(fetchImpl as unknown as { mock: { calls: unknown[] } }).not.toHaveBeenCalled();
  });

  it('rejects a non-GET method', async () => {
    const proxy = proxyWith(KEY, vi.fn() as unknown as FetchLike);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/youtube/playlist', 'POST'), res);
    expect(state.status).toBe(405);
    expect(json().error).toBe('method_not_allowed');
  });

  it('rejects a malformed playlist id without calling YouTube', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/youtube/playlist?id=../../etc/passwd'), res);
    expect(state.status).toBe(400);
    expect(json().error).toBe('bad_request');
    expect(fetchImpl as unknown as { mock: { calls: unknown[] } }).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown route under its own prefix', async () => {
    const proxy = proxyWith(KEY, vi.fn() as unknown as FetchLike);
    const { res, state, json } = fakeResponse();
    await proxy.handle(request('/api/youtube/unknown'), res);
    expect(state.status).toBe(404);
    expect(json().error).toBe('not_found');
  });
});

describe('attachYoutubeProxy — what it must never leak', () => {
  it('never returns the API key in any response body or header', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': playlistItems,
      '/videos': videoDetails
    });
    const proxy = proxyWith(KEY, fetchImpl);

    for (const path of [
      '/api/youtube/status',
      `/api/youtube/playlist?id=${PLAYLIST_ID}`,
      '/api/youtube/unknown'
    ]) {
      const { res, state } = fakeResponse();
      await proxy.handle(request(path), res);
      expect(state.body).not.toContain(KEY);
      expect(JSON.stringify(state.headers)).not.toContain(KEY);
    }
  });

  it('sends the key to Google and to no one else', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': playlistItems,
      '/videos': videoDetails
    });
    const spy = vi.fn(fetchImpl);
    const proxy = proxyWith(KEY, spy);
    const { res } = fakeResponse();
    await proxy.handle(request(`/api/youtube/playlist?id=${PLAYLIST_ID}`), res);

    expect(spy).toHaveBeenCalled();
    for (const [url] of spy.mock.calls as [string][]) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe('https://www.googleapis.com');
      expect(parsed.searchParams.get('key')).toBe(KEY);
    }
  });

  it('forbids caching the proxied answer', async () => {
    const fetchImpl = stubFetch({
      '/playlists': playlistMeta,
      '/playlistItems': playlistItems,
      '/videos': videoDetails
    });
    const proxy = proxyWith(KEY, fetchImpl);
    const { res, state } = fakeResponse();
    await proxy.handle(request(`/api/youtube/playlist?id=${PLAYLIST_ID}`), res);
    expect(state.headers['Cache-Control']).toBe('no-store');
  });
});

describe('serve-dist wiring', () => {
  it('serves /api/youtube/status on the real dist server alongside static files', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { createDistServer } = await import('../scripts/serve-dist.mjs');

    const dir = mkdtempSync(join(tmpdir(), 'nuqta-yt-'));
    const distDir = join(dir, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<html><body>NUQTA</body></html>', 'utf8');

    const server = await createDistServer({ port: 0, distDir });
    try {
      const status = await fetch(`http://127.0.0.1:${server.port}/api/youtube/status`);
      expect(status.status).toBe(200);
      // No key in this environment, and the answer says so rather than guessing.
      expect(await status.json()).toEqual({ configured: false });

      // The same server still serves the app.
      const index = await fetch(`http://127.0.0.1:${server.port}/`);
      expect(index.status).toBe(200);
      expect(await index.text()).toContain('NUQTA');
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
