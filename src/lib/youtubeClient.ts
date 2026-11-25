/**
 * The only module that talks to the YouTube proxy.
 *
 * It is same-origin by construction: every request goes to `/api/youtube/…` on the
 * app's own host, never to `youtube.com`. The API key lives on the server (see
 * `scripts/youtube-proxy.mjs`) and is never sent to the browser, which is what keeps
 * the CSP at `connect-src 'self'` and the local-first promise intact.
 *
 * Every failure is a *value*, not an exception the UI has to guess at: `not_configured`
 * (no key on the server), `not_found` (private/deleted playlist), `quota_exceeded`,
 * `network`, and `bad_response`. A course view can then tell the user something true
 * instead of showing invented data or an empty page.
 */

import type { CourseVideo, YoutubeCourse } from '../types';
import {
  canonicalPlaylistUrl,
  isValidPlaylistId,
  parseIsoDuration,
  videoThumbnailUrl
} from './youtubeLink';

export type YoutubeErrorCode =
  | 'not_configured'
  | 'not_found'
  | 'quota_exceeded'
  | 'network'
  | 'bad_response'
  | 'empty_playlist';

export type YoutubeResult<T> = { ok: true; value: T } | { ok: false; error: YoutubeErrorCode; detail?: string };

/** What the proxy reports about its own configuration. */
export interface YoutubeStatus {
  configured: boolean;
  /** True when the deployment serves the proxy at all (a static host does not). */
  available: boolean;
}

export interface PlaylistPayload {
  playlistId: string;
  title: string;
  description?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  itemCount: number;
  truncated: boolean;
  videos: CourseVideo[];
}

export interface YoutubeClientOptions {
  /** Override for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Base path of the proxy. Defaults to `/api/youtube`. */
  basePath?: string;
}

const DEFAULT_BASE = '/api/youtube';
const REQUEST_TIMEOUT_MS = 15_000;

function errorFor(status: number): YoutubeErrorCode {
  if (status === 404) return 'not_found';
  if (status === 429) return 'quota_exceeded';
  if (status === 503 || status === 501) return 'not_configured';
  return 'bad_response';
}

export class YoutubeClient {
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly basePath: string;

  constructor(options: YoutubeClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
    this.basePath = (options.basePath ?? DEFAULT_BASE).replace(/\/+$/, '');
  }

  /** Is a key configured on the server? Never throws; a missing proxy reads as unavailable. */
  async status(): Promise<YoutubeStatus> {
    const res = await this.get<{ configured?: boolean }>(`${this.basePath}/status`);
    if (!res.ok) return { configured: false, available: false };
    return { configured: Boolean(res.value?.configured), available: true };
  }

  /** Fetch a playlist's metadata and its videos, in YouTube's own order. */
  async fetchPlaylist(playlistId: string): Promise<YoutubeResult<PlaylistPayload>> {
    if (!isValidPlaylistId(playlistId)) return { ok: false, error: 'bad_response', detail: 'invalid id' };

    const res = await this.get<PlaylistPayload>(
      `${this.basePath}/playlist?id=${encodeURIComponent(playlistId)}`
    );
    if (!res.ok) return res;

    const payload = res.value;
    if (!payload || typeof payload.playlistId !== 'string') {
      return { ok: false, error: 'bad_response', detail: 'missing playlistId' };
    }
    if (!Array.isArray(payload.videos) || payload.videos.length === 0) {
      // An empty playlist is a real answer, not a failure to fetch.
      return { ok: false, error: 'empty_playlist' };
    }

    return {
      ok: true,
      value: {
        ...payload,
        videos: normalizeVideos(payload.videos),
        itemCount: typeof payload.itemCount === 'number' ? payload.itemCount : payload.videos.length
      }
    };
  }

  private async get<T>(path: string): Promise<YoutubeResult<T>> {
    if (!this.fetchImpl) return { ok: false, error: 'network', detail: 'fetch unavailable' };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;

    try {
      const response = await this.fetchImpl(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller?.signal
      });

      if (!response.ok) {
        // A JSON body carries the server's own reason when it has one.
        let detail: string | undefined;
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') detail = body.error;
        } catch {
          /* no JSON body: the status alone is the message */
        }
        return { ok: false, error: errorFor(response.status), detail };
      }

      const value = (await response.json()) as T;
      return { ok: true, value };
    } catch {
      // A timeout and a dropped connection are the same thing to the user.
      return { ok: false, error: 'network' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Keep only what the UI renders, and keep the *order* YouTube gave.
 *
 * `position` is taken from the array index when the payload does not supply one, so
 * a list that arrives without positions still reads exactly as it does on YouTube.
 */
function normalizeVideos(videos: CourseVideo[]): CourseVideo[] {
  return videos
    .map((video, index) => {
      const seconds =
        typeof video.durationSeconds === 'number'
          ? video.durationSeconds
          : parseIsoDuration((video as unknown as { duration?: string }).duration ?? null);
      return {
        videoId: video.videoId,
        title: video.title || '—',
        position: typeof video.position === 'number' ? video.position : index,
        durationSeconds: seconds ?? undefined,
        thumbnailUrl: video.thumbnailUrl || videoThumbnailUrl(video.videoId),
        channelTitle: video.channelTitle,
        unavailable: Boolean(video.unavailable),
        publishedAt: video.publishedAt
      };
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * Turn a fetched playlist into the record NUQTA stores.
 *
 * `existing` is passed when refreshing, so the course keeps its original id and
 * creation time (and therefore its place in the library) instead of looking new.
 */
export function courseFromPayload(
  payload: PlaylistPayload,
  existing?: Pick<YoutubeCourse, 'id' | 'createdAt' | 'linkedGoalId'>,
  now: Date = new Date()
): YoutubeCourse {
  const stamp = now.toISOString();
  const cover =
    payload.thumbnailUrl ||
    payload.videos.find((v) => v.thumbnailUrl && !v.unavailable)?.thumbnailUrl ||
    '';
  return {
    id: existing?.id ?? `course-${payload.playlistId}`,
    playlistId: payload.playlistId,
    title: payload.title || payload.playlistId,
    description: payload.description,
    channelTitle: payload.channelTitle,
    thumbnailUrl: cover || undefined,
    videos: payload.videos,
    itemCount: payload.itemCount,
    canonicalUrl: canonicalPlaylistUrl(payload.playlistId),
    fetchedAt: stamp,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    truncated: payload.truncated || undefined,
    linkedGoalId: existing?.linkedGoalId
  };
}

/** Is this playlist already in the library? Prevents the same course being added twice. */
export function findCourseByPlaylistId(
  courses: YoutubeCourse[],
  playlistId: string
): YoutubeCourse | undefined {
  return courses.find((course) => course.playlistId === playlistId);
}

/** Plain-language reason for a failed fetch, in both languages. */
export function describeYoutubeError(error: YoutubeErrorCode): { ar: string; en: string } {
  switch (error) {
    case 'not_configured':
      return {
        ar: 'مفتاح YouTube API غير مُعد على الخادم. أضف YOUTUBE_API_KEY في بيئة الخادم لتفعيل الاستيراد.',
        en: 'The YouTube API key is not configured on the server. Set YOUTUBE_API_KEY in the server environment to enable imports.'
      };
    case 'not_found':
      return {
        ar: 'قائمة التشغيل غير متاحة. تأكد أنها عامة وأن الرابط صحيح.',
        en: 'That playlist is not available. Check that it is public and the link is correct.'
      };
    case 'quota_exceeded':
      return {
        ar: 'تم استهلاك حصة YouTube API لهذا اليوم. جرّب لاحقاً أو استخدم مفتاحاً آخر.',
        en: 'The YouTube API quota for today is used up. Try again later or use a different key.'
      };
    case 'empty_playlist':
      return {
        ar: 'قائمة التشغيل فارغة أو لا تحتوي فيديوهات متاحة.',
        en: 'That playlist is empty or has no available videos.'
      };
    case 'network':
      return {
        ar: 'تعذّر الوصول إلى خدمة الاستيراد. تحقّق من الاتصال ثم أعد المحاولة.',
        en: 'Could not reach the import service. Check the connection and try again.'
      };
    case 'bad_response':
    default:
      return {
        ar: 'أعاد YouTube رداً غير متوقع. أعد المحاولة لاحقاً.',
        en: 'YouTube returned an unexpected response. Try again later.'
      };
  }
}
