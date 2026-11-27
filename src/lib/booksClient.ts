/**
 * The only module that talks to the book-catalogue proxy.
 *
 * Same-origin by construction: every request goes to `/api/books/…` on the app's own
 * host. The Google Books key lives on the server (see `scripts/books-proxy.mjs`) and
 * never reaches the browser, which keeps the CSP at `connect-src 'self'`.
 *
 * Every failure is a *value*, not an exception: `not_configured`, `quota_exceeded`,
 * `network`, `bad_response`. A view can then say something true instead of showing an
 * empty list, and manual entry always remains available.
 *
 * Search is never background activity: nothing here runs until the reader types, and
 * every call is driven by a keystroke they made.
 */

import type { BookProviderId, BookSearchResult } from './bookCatalog';
import { googleVolumeToResult, mergeSearchResults, openLibraryDocToResult } from './bookCatalog';

export type BooksErrorCode = 'not_configured' | 'quota_exceeded' | 'network' | 'bad_response';

export type BooksResult<T> = { ok: true; value: T } | { ok: false; error: BooksErrorCode; detail?: string };

/** What the proxy reports about its own configuration. */
export interface BooksStatus {
  googleBooks: boolean;
  openLibrary: boolean;
  /** True when this deployment serves the proxy at all (a static host does not). */
  available: boolean;
}

/** Which providers answered, so the UI can say "Open Library only" honestly. */
export interface BookSearchResponse {
  results: BookSearchResult[];
  providers: {
    googleBooks: { ok: boolean; error?: string };
    openLibrary: { ok: boolean; error?: string };
  };
  /** True when the answer came from the proxy's cache rather than a live query. */
  cached: boolean;
}

export interface BooksClientOptions {
  /** Override for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Base path of the proxy. Defaults to `/api/books`. */
  basePath?: string;
  /** Client-side cache TTL. The proxy caches too; this avoids even the round trip. */
  cacheTtlMs?: number;
  /** Maximum cache entries kept in memory. */
  cacheMaxEntries?: number;
}

const DEFAULT_BASE = '/api/books';
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 60;

function errorFor(status: number): BooksErrorCode {
  if (status === 429) return 'quota_exceeded';
  if (status === 503 || status === 501) return 'not_configured';
  return 'bad_response';
}

/** Response bodies from the proxy are provider JSON, so treat them as unknown. */
type Json = Record<string, unknown>;

export class BooksClient {
  /**
   * Resolved per request, not in the constructor.
   *
   * Capturing `globalThis.fetch` once would freeze whichever implementation happened to
   * exist at module load, which is wrong in two real cases: a test that installs a stub
   * afterwards, and a browser where fetch is polyfilled later.
   */
  private readonly fetchOverride: typeof fetch | undefined;
  private readonly basePath: string;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly cache = new Map<string, { value: BookSearchResponse; expires: number }>();

  constructor(options: BooksClientOptions = {}) {
    this.fetchOverride = options.fetchImpl;
    this.basePath = (options.basePath ?? DEFAULT_BASE).replace(/\/+$/, '');
    this.ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.cacheMaxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  /** Is the proxy reachable, and does it hold a Google Books key? Never throws. */
  async status(): Promise<BooksStatus> {
    const res = await this.get<Json>(`${this.basePath}/status`);
    if (!res.ok) return { googleBooks: false, openLibrary: false, available: false };
    return {
      googleBooks: Boolean(res.value?.googleBooks),
      openLibrary: Boolean(res.value?.openLibrary),
      available: true
    };
  }

  /**
   * Search both catalogues and normalise the answer into one list.
   *
   * A cached query answers without touching the network. `signal` is honoured so a
   * superseded keystroke can cancel its request instead of racing the newer one.
   */
  async search(query: string, options: { signal?: AbortSignal } = {}): Promise<BooksResult<BookSearchResponse>> {
    const trimmed = query.trim();
    if (!trimmed) return { ok: true, value: emptyResponse() };

    const cacheKey = trimmed.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() <= cached.expires) {
      return { ok: true, value: { ...cached.value, cached: true } };
    }

    const res = await this.get<Json>(
      `${this.basePath}/search?q=${encodeURIComponent(trimmed)}`,
      options.signal
    );
    if (!res.ok) return res;

    const body = res.value ?? {};
    const google = asObject(body.google);
    const openLibrary = asObject(body.openLibrary);

    const googleItems = Array.isArray(google?.items) ? (google!.items as unknown[]) : [];
    const openLibraryDocs = Array.isArray(openLibrary?.docs) ? (openLibrary!.docs as unknown[]) : [];

    const normalized: BookSearchResult[] = [
      ...googleItems.map(googleVolumeToResult),
      ...openLibraryDocs.map(openLibraryDocToResult)
    ].filter((r): r is BookSearchResult => r !== null);

    const value: BookSearchResponse = {
      // ISBN dedupe keeps distinct editions side by side; see `mergeSearchResults`.
      results: mergeSearchResults(normalized),
      providers: {
        googleBooks: { ok: Boolean(google?.ok), error: asError(google?.error) },
        openLibrary: { ok: Boolean(openLibrary?.ok), error: asError(openLibrary?.error) }
      },
      cached: Boolean(body.cached)
    };

    this.remember(cacheKey, value);
    return { ok: true, value };
  }

  /**
   * Same-origin URL for a provider cover.
   *
   * The image cannot be loaded from the provider directly (the CSP allows no remote
   * image host), and building this URL anywhere else would let an arbitrary host be
   * interpolated into a request. The proxy validates the host again on its side.
   */
  coverUrl(remoteUrl: string): string {
    return `${this.basePath}/cover?url=${encodeURIComponent(remoteUrl)}`;
  }

  /** Forget every cached answer. Used by an explicit "retry" so it re-queries. */
  clearCache(): void {
    this.cache.clear();
  }

  private remember(key: string, value: BookSearchResponse): void {
    this.cache.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private resolveFetch(): typeof fetch | undefined {
    return this.fetchOverride ?? (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
  }

  private async get<T>(path: string, externalSignal?: AbortSignal): Promise<BooksResult<T>> {
    const fetchImpl = this.resolveFetch();
    if (!fetchImpl) return { ok: false, error: 'network', detail: 'fetch unavailable' };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    // The caller's abort (a newer keystroke) must cancel this request too.
    const onExternalAbort = () => controller?.abort();
    if (externalSignal && controller) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await fetchImpl(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller?.signal
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') detail = body.error;
        } catch {
          /* no JSON body: the status alone is the message */
        }
        return { ok: false, error: errorFor(response.status), detail };
      }

      return { ok: true, value: (await response.json()) as T };
    } catch {
      // A timeout, a cancellation and a dropped connection are all "no answer".
      return { ok: false, error: 'network' };
    } finally {
      if (timer) clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

function asObject(v: unknown): Json | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined;
}

function asError(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function emptyResponse(): BookSearchResponse {
  return {
    results: [],
    providers: { googleBooks: { ok: true }, openLibrary: { ok: true } },
    cached: false
  };
}

/** Plain-language reason for a failed search, in both languages. */
export function describeBooksError(error: BooksErrorCode): { ar: string; en: string } {
  switch (error) {
    case 'not_configured':
      return {
        ar: 'خدمة البحث غير مُفعّلة على هذا الخادم. يمكنك إضافة الكتاب يدوياً.',
        en: 'Search is not enabled on this server. You can still add the book manually.'
      };
    case 'quota_exceeded':
      return {
        ar: 'تم استهلاك حصة البحث لهذا اليوم. جرّب لاحقاً أو أضف الكتاب يدوياً.',
        en: 'The search quota is used up for today. Try later, or add the book manually.'
      };
    case 'network':
      return {
        ar: 'تعذّر الوصول إلى خدمة البحث. تحقّق من الاتصال ثم أعد المحاولة.',
        en: 'Could not reach the search service. Check the connection and try again.'
      };
    case 'bad_response':
    default:
      return {
        ar: 'أعادت خدمة البحث رداً غير متوقع. أعد المحاولة أو أضف الكتاب يدوياً.',
        en: 'The search service returned an unexpected response. Try again, or add the book manually.'
      };
  }
}

/** A shared instance: one client-side cache for the whole app. */
export const booksClient = new BooksClient();

export type { BookProviderId, BookSearchResult };
