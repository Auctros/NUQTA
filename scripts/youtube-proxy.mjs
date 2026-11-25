/**
 * Server-side YouTube proxy.
 *
 * Why a proxy at all: the browser bundle is public, so an API key placed in a
 * `VITE_*` variable is readable by anyone who loads the app. The key therefore
 * lives in the server environment (`YOUTUBE_API_KEY`) and only the server talks to
 * Google. The page keeps its `connect-src 'self'` CSP because it only ever calls
 * this origin.
 *
 * What this deliberately does NOT do:
 *   - scrape youtube.com. Google's HTML is not a contract; it changes, it is
 *     rate-limited per IP, and parsing it is the brittle approach the brief warns
 *     against. The official Data API v3 is used instead.
 *   - fall back to invented data when the key is missing. `503 not_configured` is a
 *     truthful answer the UI can show, and a course that never imported is better
 *     than a course that looks real and is not.
 *   - accept a playlist id from anywhere but the query string, validated against the
 *     same shape the client uses.
 *
 * Cost note: a full playlist costs 1 quota unit for `playlistItems` plus 1 per 50
 * videos for `videos` (durations). The default daily quota of 10,000 units is far
 * more than a personal library needs, which is why paging is capped rather than
 * unbounded.
 */

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

/** A playlist id must look like one before it is put in a URL. */
const PLAYLIST_ID_RE = /^(?:PL|UU|LL|FL|OL|RD|PU|SB)[A-Za-z0-9_-]{10,}$|^[A-Za-z0-9_-]{18,}$/;

/** Safety cap: 40 pages × 50 = 2000 videos. Beyond this the course is marked truncated. */
const MAX_PAGES = 40;
const PAGE_SIZE = 50;

/** Parse `PT1H2M10S` into seconds. Returns null when there is no duration. */
function parseIsoDuration(value) {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value).trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (!d && !h && !min && !s) return null;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

function pickThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') return '';
  for (const key of ['high', 'medium', 'standard', 'default']) {
    const entry = thumbnails[key];
    if (entry && typeof entry.url === 'string') return entry.url;
  }
  return '';
}

async function googleGet(path, params, apiKey, fetchImpl) {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', apiKey);

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    let reason = '';
    try {
      const body = await response.json();
      reason = body?.error?.errors?.[0]?.reason ?? '';
    } catch {
      /* status alone is enough */
    }
    return { ok: false, status: response.status, reason };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: 502, reason: 'invalid_json' };
  }
}

/**
 * Fetch a playlist's metadata and every video, in the order YouTube returns.
 *
 * Deleted or private videos appear in `playlistItems` with a placeholder title and no
 * `videoId`; they are kept as `unavailable` entries so positions stay honest and the
 * rest of the course does not shift.
 */
export async function fetchPlaylist(playlistId, apiKey, fetchImpl = globalThis.fetch) {
  if (!PLAYLIST_ID_RE.test(playlistId)) return { ok: false, code: 'bad_request' };

  const meta = await googleGet(
    'playlists',
    { part: 'snippet,contentDetails', id: playlistId },
    apiKey,
    fetchImpl
  );
  if (!meta.ok) {
    if (meta.status === 404) return { ok: false, code: 'not_found' };
    if (meta.status === 403) return { ok: false, code: 'quota_exceeded', reason: meta.reason };
    return { ok: false, code: 'upstream', reason: meta.reason };
  }

  const playlist = meta.body?.items?.[0];
  if (!playlist) return { ok: false, code: 'not_found' };

  const raw = [];
  let pageToken = '';
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const items = await googleGet(
      'playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {})
      },
      apiKey,
      fetchImpl
    );

    if (!items.ok) {
      if (items.status === 404) return { ok: false, code: 'not_found' };
      if (items.status === 403) return { ok: false, code: 'quota_exceeded', reason: items.reason };
      return { ok: false, code: 'upstream', reason: items.reason };
    }

    for (const item of items.body?.items ?? []) {
      const videoId = item?.contentDetails?.videoId ?? item?.snippet?.resourceId?.videoId ?? '';
      const title = item?.snippet?.title ?? '';
      raw.push({
        videoId,
        title,
        position: typeof item?.snippet?.position === 'number' ? item.snippet.position : raw.length,
        publishedAt: item?.contentDetails?.videoPublishedAt ?? item?.snippet?.publishedAt,
        channelTitle: item?.snippet?.videoOwnerChannelTitle ?? item?.snippet?.channelTitle,
        thumbnailUrl: pickThumbnail(item?.snippet?.thumbnails),
        // "Deleted video" / "Private video" arrive with a title but no usable id.
        unavailable: !videoId || title === 'Deleted video' || title === 'Private video'
      });
    }

    pageToken = items.body?.nextPageToken ?? '';
    if (!pageToken) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  // Durations need a second call, batched 50 ids at a time.
  const playable = raw.filter((v) => v.videoId && !v.unavailable).map((v) => v.videoId);
  const durations = new Map();

  for (let i = 0; i < playable.length; i += PAGE_SIZE) {
    const batch = playable.slice(i, i + PAGE_SIZE);
    const details = await googleGet(
      'videos',
      { part: 'contentDetails', id: batch.join(','), maxResults: PAGE_SIZE },
      apiKey,
      fetchImpl
    );
    if (!details.ok) {
      // Durations are a nicety: a course without them is still a usable course, so a
      // failed detail call degrades the metadata rather than failing the import.
      if (details.status === 403) return { ok: false, code: 'quota_exceeded', reason: details.reason };
      break;
    }
    for (const item of details.body?.items ?? []) {
      const seconds = parseIsoDuration(item?.contentDetails?.duration);
      if (item?.id && seconds !== null) durations.set(item.id, seconds);
    }
  }

  const videos = raw
    .map((v) => ({
      ...v,
      durationSeconds: durations.get(v.videoId)
    }))
    .sort((a, b) => a.position - b.position);

  const snippet = playlist.snippet ?? {};
  return {
    ok: true,
    value: {
      playlistId,
      title: snippet.title ?? playlistId,
      description: snippet.description ?? '',
      channelTitle: snippet.channelTitle ?? '',
      thumbnailUrl: pickThumbnail(snippet.thumbnails),
      itemCount:
        typeof playlist.contentDetails?.itemCount === 'number'
          ? playlist.contentDetails.itemCount
          : videos.length,
      truncated,
      videos
    }
  };
}

/**
 * Attach `/api/youtube/*` to an existing Node http server.
 *
 * Returns a handler the caller invokes first: it returns `true` when it owns the
 * request, so the static file handler never has to know this route exists.
 */
export function attachYoutubeProxy(options = {}) {
  const apiKey = options.apiKey ?? process.env.YOUTUBE_API_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const allowOrigin = options.allowOrigin;

  const send = (res, status, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      // Course data is a cache of a remote answer; never let a proxy store it.
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

    if (!url.pathname.startsWith('/api/youtube/')) return false;

    if (req.method !== 'GET') {
      send(res, 405, { error: 'method_not_allowed' });
      return true;
    }

    const route = url.pathname.slice('/api/youtube/'.length);

    if (route === 'status') {
      send(res, 200, { configured: Boolean(apiKey) });
      return true;
    }

    if (route === 'playlist') {
      if (!apiKey) {
        // A truthful, actionable answer: the app shows setup instructions, not a spinner.
        send(res, 503, { error: 'not_configured' });
        return true;
      }

      const playlistId = (url.searchParams.get('id') ?? '').trim();
      if (!PLAYLIST_ID_RE.test(playlistId)) {
        send(res, 400, { error: 'bad_request' });
        return true;
      }

      const result = await fetchPlaylist(playlistId, apiKey, fetchImpl);
      if (!result.ok) {
        const status =
          result.code === 'not_found'
            ? 404
            : result.code === 'quota_exceeded'
            ? 429
            : result.code === 'bad_request'
            ? 400
            : 502;
        send(res, status, { error: result.code, reason: result.reason });
        return true;
      }

      send(res, 200, result.value);
      return true;
    }

    send(res, 404, { error: 'not_found' });
    return true;
  };

  // The proxy owns its route, so it can be consulted before the static handler.
  return { handle, apiKeyConfigured: Boolean(apiKey) };
}
