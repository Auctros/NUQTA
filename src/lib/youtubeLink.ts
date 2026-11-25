/**
 * YouTube playlist links — parsing and validation, with no network access.
 *
 * This module is deliberately pure so the rules that decide "is this a playlist
 * link, and which playlist?" can be tested exhaustively without a key, a proxy or
 * a browser. Fetching lives in `youtubeCourses.ts`, behind the same-origin proxy.
 *
 * Only two URL shapes are accepted, because they are the only two YouTube itself
 * documents as a playlist link:
 *   https://www.youtube.com/playlist?list=PL…
 *   https://www.youtube.com/watch?v=…&list=PL…
 * plus the `youtu.be` short form and the `music.youtube.com` / `m.youtube.com`
 * hosts, which serve the same ids. Anything else is rejected rather than guessed:
 * a URL that merely *contains* "youtube" is not a playlist, and silently parsing
 * it would send the user to a broken course.
 */

/** A YouTube playlist id: `PL`, `UU`, `OL`, `FL`, `RD`, `LL` prefixes plus legacy forms. */
const PLAYLIST_ID_RE = /^(?:PL|UU|LL|FL|OL|RD|PU|SB)[A-Za-z0-9_-]{10,}$|^[A-Za-z0-9_-]{18,}$/;

/** A YouTube video id is always 11 URL-safe characters. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
]);

export type PlaylistParseError = 'empty' | 'not_youtube' | 'no_playlist_id' | 'invalid_playlist_id';

export interface ParsedPlaylistLink {
  playlistId: string;
  /** The video the link was pointing at, when the link was a watch URL. */
  videoId?: string;
  /** Canonical watch URL for the playlist, used for "open on YouTube". */
  canonicalUrl: string;
  /** Thumbnail URL for the playlist cover (public, no key required). */
  thumbnailUrl: string;
}

export type PlaylistParseResult =
  | { ok: true; value: ParsedPlaylistLink }
  | { ok: false; error: PlaylistParseError };

/** Is this a syntactically valid playlist id? */
export function isValidPlaylistId(id: string): boolean {
  return typeof id === 'string' && PLAYLIST_ID_RE.test(id);
}

export function isValidVideoId(id: string): boolean {
  return typeof id === 'string' && VIDEO_ID_RE.test(id);
}

/**
 * The canonical playlist URL. `youtube.com/playlist?list=` is the form YouTube's
 * own share button produces for a playlist, so it is the one we store.
 */
export function canonicalPlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

export function canonicalVideoUrl(videoId: string, playlistId?: string): string {
  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  return playlistId ? `${base}&list=${encodeURIComponent(playlistId)}` : base;
}

/**
 * Playlist thumbnails are not available without an API call, so the cover uses the
 * first video's thumbnail when one is known, and this placeholder otherwise.
 */
export function videoThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/** Parse a pasted link. Accepts a bare id as a convenience, since people paste those. */
export function parsePlaylistLink(raw: string): PlaylistParseResult {
  const input = (raw ?? '').trim();
  if (!input) return { ok: false, error: 'empty' };

  // A bare playlist id (what the API returns) is accepted directly.
  if (!/^https?:\/\//i.test(input) && !input.includes('/') && !input.includes('.')) {
    return isValidPlaylistId(input)
      ? { ok: true, value: makeParsed(input) }
      : { ok: false, error: 'invalid_playlist_id' };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, error: 'not_youtube' };
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return { ok: false, error: 'not_youtube' };

  const listParam = url.searchParams.get('list');
  const playlistId = listParam ? listParam.trim() : '';

  // `youtu.be/<id>` and `/watch?v=<id>` carry a video; a playlist needs `list`.
  let videoId: string | undefined;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const candidate = url.pathname.replace(/^\/+/, '').split('/')[0];
    if (isValidVideoId(candidate)) videoId = candidate;
  } else {
    const v = url.searchParams.get('v');
    if (v && isValidVideoId(v.trim())) videoId = v.trim();
  }

  if (!playlistId) return { ok: false, error: 'no_playlist_id' };
  if (!isValidPlaylistId(playlistId)) return { ok: false, error: 'invalid_playlist_id' };

  return { ok: true, value: makeParsed(playlistId, videoId) };
}

function makeParsed(playlistId: string, videoId?: string): ParsedPlaylistLink {
  return {
    playlistId,
    videoId,
    canonicalUrl: canonicalPlaylistUrl(playlistId),
    thumbnailUrl: videoId ? videoThumbnailUrl(videoId) : ''
  };
}

/**
 * A human-readable reason, so the UI never has to say "invalid".
 * Both languages are returned; the caller picks.
 */
export function describeParseError(error: PlaylistParseError): { ar: string; en: string } {
  switch (error) {
    case 'empty':
      return { ar: 'الصق رابط قائمة تشغيل من يوتيوب.', en: 'Paste a YouTube playlist link.' };
    case 'not_youtube':
      return {
        ar: 'هذا ليس رابط يوتيوب. استخدم رابطاً من youtube.com أو youtu.be.',
        en: 'That is not a YouTube link. Use a youtube.com or youtu.be URL.'
      };
    case 'no_playlist_id':
      return {
        ar: 'الرابط لا يحتوي على قائمة تشغيل. افتح القائمة في يوتيوب وانسخ رابطها، لا رابط فيديو واحد.',
        en: 'That link has no playlist. Open the playlist on YouTube and copy its link, not a single video.'
      };
    case 'invalid_playlist_id':
      return {
        ar: 'معرّف قائمة التشغيل غير صالح.',
        en: 'That playlist id is not valid.'
      };
  }
}

/** ISO-8601 duration (`PT1H2M10S`) → seconds. Returns null when unparseable. */
export function parseIsoDuration(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  if (!d && !h && !min && !s) return null;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
  );
}

/** Seconds → "12:34" or "1:02:10". Null stays null so the UI can omit it. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
