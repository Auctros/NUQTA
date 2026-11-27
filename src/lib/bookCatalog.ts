/**
 * Catalogue metadata: one internal shape, two providers, no I/O.
 *
 * Everything here is pure so the provider mapping can be tested without a network
 * or a DOM. `booksClient.ts` fetches; this module decides what the answer *means*.
 *
 * The shape is deliberately flat and provider-agnostic. `BookCatalogMeta` (in
 * `types`) is the persisted subset, and it never carries personal reading data —
 * that boundary is what lets a catalogue refresh rewrite metadata without touching
 * the reader's status, progress, rating or notes.
 */

import type { BookCatalogMeta } from '../types';

export type BookProviderId = 'google_books' | 'open_library';

/** One search hit, normalised. `key` is unique within a result set. */
export interface BookSearchResult {
  key: string;
  source: BookProviderId;
  sourceId: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  /** As the provider wrote it: `2020`, `2020-05`, or `2020-05-01`. */
  publishedDate?: string;
  /** Derived from `publishedDate` for sorting and for a compact "2020" chip. */
  publishedYear?: number;
  language?: string;
  isbn10?: string;
  isbn13?: string;
  description?: string;
  categories?: string[];
  pageCount?: number;
  edition?: string;
  /** Remote cover reference. Rendered only through the local cover pipeline. */
  coverUrl?: string;
  infoUrl?: string;
}

/** Providers hand back loosely-typed JSON; treat their shapes as unknown. */
type Json = Record<string, unknown>;

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const asNumber = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

const asStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return [...new Set(out.map((x) => x.trim()))];
};

/**
 * Normalise an ISBN and reject one that fails its own checksum.
 *
 * A malformed ISBN is worse than a missing one: it looks authoritative, it will not
 * resolve anywhere, and it silently breaks the dedupe that relies on it. Providers
 * do ship bad identifiers (Google Books in particular), so the checksum is enforced.
 */
export function normalizeIsbn(raw: unknown): { isbn10?: string; isbn13?: string } {
  if (typeof raw !== 'string') return {};
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 10) return isValidIsbn10(cleaned) ? { isbn10: cleaned } : {};
  if (cleaned.length === 13) return isValidIsbn13(cleaned) ? { isbn13: cleaned } : {};
  return {};
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = isbn[i];
    const value = ch === 'X' ? 10 : Number(ch);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

/** Convert an ISBN-10 to its ISBN-13 equivalent (978 prefix), when valid. */
export function isbn10To13(isbn10: string): string | undefined {
  if (!isValidIsbn10(isbn10)) return undefined;
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

/** Pull a four-digit year out of `2020`, `2020-05`, `May 2020` or `2020-05-01`. */
export function parsePublishedYear(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /(1[5-9]\d{2}|20\d{2}|21\d{2})/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  return year > 0 && year <= 2200 ? year : undefined;
}

/** Google Books returns `http://books.google.com/…`; upgrade and ask for a larger image. */
export function normalizeCoverUrl(raw: unknown): string | undefined {
  const url = asString(raw);
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url
    .replace(/^http:\/\//i, 'https://')
    // `zoom=1` is a ~128px thumbnail; `zoom=2` is legible at card size.
    .replace(/([?&])zoom=\d+/i, '$1zoom=2')
    .replace(/&edge=curl/g, '');
}

/** Google Books volume → internal result. Returns null when it is not a usable book. */
export function googleVolumeToResult(volume: unknown): BookSearchResult | null {
  if (!volume || typeof volume !== 'object') return null;
  const v = volume as Json;
  const info = (v.volumeInfo && typeof v.volumeInfo === 'object' ? v.volumeInfo : {}) as Json;

  const title = asString(info.title);
  if (!title) return null;

  const ids = Array.isArray(info.industryIdentifiers) ? (info.industryIdentifiers as Json[]) : [];
  let isbn10: string | undefined;
  let isbn13: string | undefined;
  for (const entry of ids) {
    const type = asString(entry?.type);
    const normalized = normalizeIsbn(entry?.identifier);
    if (type === 'ISBN_13' && normalized.isbn13 && !isbn13) isbn13 = normalized.isbn13;
    if (type === 'ISBN_10' && normalized.isbn10 && !isbn10) isbn10 = normalized.isbn10;
    // An unlabelled identifier is common; take it when it validates.
    if (!type) {
      if (normalized.isbn13 && !isbn13) isbn13 = normalized.isbn13;
      if (normalized.isbn10 && !isbn10) isbn10 = normalized.isbn10;
    }
  }
  // Derive the missing pair so dedupe can match a 10 against a 13.
  if (!isbn13 && isbn10) isbn13 = isbn10To13(isbn10);

  const links = (info.imageLinks && typeof info.imageLinks === 'object' ? info.imageLinks : {}) as Json;
  const sourceId = asString(v.id);
  if (!sourceId) return null;

  return {
    key: `google_books:${sourceId}`,
    source: 'google_books',
    sourceId,
    title,
    subtitle: asString(info.subtitle),
    authors: asStringArray(info.authors),
    publisher: asString(info.publisher),
    publishedDate: asString(info.publishedDate),
    publishedYear: parsePublishedYear(info.publishedDate),
    language: asString(info.language),
    isbn10,
    isbn13,
    description: asString(info.description),
    categories: asStringArray(info.categories),
    pageCount: asNumber(info.pageCount),
    edition: undefined,
    coverUrl: normalizeCoverUrl(links.thumbnail) || normalizeCoverUrl(links.smallThumbnail),
    infoUrl: asString(info.infoLink) || asString(info.canonicalVolumeLink)
  };
}

/** Open Library search doc → internal result. */
export function openLibraryDocToResult(doc: unknown): BookSearchResult | null {
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Json;
  const title = asString(d.title);
  if (!title) return null;

  const key = asString(d.key);
  if (!key) return null;
  // `/works/OL45883W` and `/books/OL7353617M` both appear in search results.
  const sourceId = key.replace(/^\//, '');

  let isbn10: string | undefined;
  let isbn13: string | undefined;
  for (const raw of asStringArray(d.isbn)) {
    const normalized = normalizeIsbn(raw);
    if (normalized.isbn13 && !isbn13) isbn13 = normalized.isbn13;
    if (normalized.isbn10 && !isbn10) isbn10 = normalized.isbn10;
  }
  if (!isbn13 && isbn10) isbn13 = isbn10To13(isbn10);

  const coverId = asNumber(d.cover_i);
  const authors = asStringArray(d.author_name);
  const publishYears = Array.isArray(d.publish_year) ? (d.publish_year as unknown[]) : [];
  const publishedDate = asString(String(d.first_publish_year ?? '')) ?? asString(String(publishYears[0] ?? ''));

  return {
    key: `open_library:${sourceId}`,
    source: 'open_library',
    sourceId,
    title,
    subtitle: asString(d.subtitle),
    authors,
    publisher: asStringArray(d.publisher)[0],
    publishedDate: publishedDate ? String(publishedDate) : undefined,
    publishedYear: parsePublishedYear(publishedDate) ?? asNumber(d.first_publish_year),
    language: asStringArray(d.language)[0],
    isbn10,
    isbn13,
    description: asString(d.first_sentence) || undefined,
    categories: asStringArray(d.subject).slice(0, 6),
    pageCount: asNumber(d.number_of_pages_median),
    edition: undefined,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined,
    infoUrl: key.startsWith('/works/') ? `https://openlibrary.org${key}` : undefined
  };
}

/** How much useful metadata a hit carries. Used to prefer the richer duplicate. */
function richness(r: BookSearchResult): number {
  let score = 0;
  if (r.coverUrl) score += 4;
  if (r.description) score += 3;
  if (r.publisher) score += 2;
  if (r.pageCount) score += 2;
  if (r.publishedYear) score += 1;
  if (r.language) score += 1;
  if (r.isbn13) score += 1;
  score += Math.min(r.authors.length, 3);
  score += Math.min(r.categories?.length ?? 0, 3);
  return score;
}

/**
 * Combine provider results into one list without collapsing distinct editions.
 *
 * Deduplication keys on ISBN only, because an ISBN identifies an *edition*. Two
 * translations of the same title legitimately have different ISBNs and must stay
 * separate — merging on title would hide exactly the choice the reader needs to make.
 * A duplicate is only ever the same edition seen twice, so the richer record wins and
 * the loser fills any field the winner lacks.
 */
export function mergeSearchResults(results: BookSearchResult[]): BookSearchResult[] {
  const byEdition = new Map<string, BookSearchResult>();
  const order: string[] = [];

  for (const result of results) {
    const editionKey = result.isbn13 || result.isbn10 || result.key;
    const existing = byEdition.get(editionKey);
    if (!existing) {
      byEdition.set(editionKey, result);
      order.push(editionKey);
      continue;
    }
    const [winner, loser] = richness(result) > richness(existing) ? [result, existing] : [existing, result];
    byEdition.set(editionKey, {
      ...loser,
      ...Object.fromEntries(Object.entries(winner).filter(([, value]) => value !== undefined)),
      // Keep every author from either record, de-duplicated.
      authors: [...new Set([...winner.authors, ...loser.authors])]
    });
  }

  return order.map((key) => byEdition.get(key)!).filter(Boolean);
}

/** The persisted subset. Never carries status, progress, rating or notes. */
export function resultToCatalogMeta(result: BookSearchResult, now: Date = new Date()): BookCatalogMeta {
  return {
    source: result.source,
    sourceId: result.sourceId,
    subtitle: result.subtitle,
    authors: result.authors.length ? result.authors : undefined,
    publisher: result.publisher,
    publishedDate: result.publishedDate,
    language: result.language,
    isbn10: result.isbn10,
    isbn13: result.isbn13,
    description: result.description,
    categories: result.categories?.length ? result.categories : undefined,
    pageCount: result.pageCount,
    edition: result.edition,
    coverUrl: result.coverUrl,
    infoUrl: result.infoUrl,
    fetchedAt: now.toISOString()
  };
}

/** `Sapiens: A Brief History` + subtitle, for a two-line result title. */
export function resultDisplayTitle(result: BookSearchResult): string {
  return result.subtitle ? `${result.title}: ${result.subtitle}` : result.title;
}

/** One-line credit: author · year · publisher · language. */
export function resultCreditLine(result: BookSearchResult, isAr: boolean): string {
  const parts: string[] = [];
  if (result.authors.length) parts.push(result.authors.slice(0, 2).join(', '));
  if (result.publishedYear) parts.push(String(result.publishedYear));
  if (result.publisher) parts.push(result.publisher);
  if (result.language) parts.push(languageLabel(result.language, isAr));
  return parts.join(' · ');
}

/** Map an ISO 639-1/2 code to a readable label. Falls back to the raw code. */
export function languageLabel(code: string, isAr: boolean): string {
  const normalized = code.trim().toLowerCase().slice(0, 2);
  const names: Record<string, { ar: string; en: string }> = {
    ar: { ar: 'العربية', en: 'Arabic' },
    en: { ar: 'الإنجليزية', en: 'English' },
    fr: { ar: 'الفرنسية', en: 'French' },
    es: { ar: 'الإسبانية', en: 'Spanish' },
    de: { ar: 'الألمانية', en: 'German' },
    it: { ar: 'الإيطالية', en: 'Italian' },
    ru: { ar: 'الروسية', en: 'Russian' },
    tr: { ar: 'التركية', en: 'Turkish' },
    ur: { ar: 'الأردية', en: 'Urdu' },
    fa: { ar: 'الفارسية', en: 'Persian' },
    hi: { ar: 'الهندية', en: 'Hindi' },
    zh: { ar: 'الصينية', en: 'Chinese' },
    ja: { ar: 'اليابانية', en: 'Japanese' },
    pt: { ar: 'البرتغالية', en: 'Portuguese' },
    nl: { ar: 'الهولندية', en: 'Dutch' }
  };
  const hit = names[normalized];
  if (hit) return isAr ? hit.ar : hit.en;
  return code.toUpperCase();
}

/**
 * Should this string be sent to a catalogue?
 *
 * A single character matches thousands of books and costs a request, so the minimum
 * is two. A valid ISBN is always worth sending, however short the raw string looks.
 */
export function isSearchableQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length >= 2) return true;
  return looksLikeIsbn(trimmed);
}

/** True when the query looks like an ISBN, so the caller can say "searching by ISBN". */
export function looksLikeIsbn(query: string): boolean {
  const cleaned = query.replace(/[^0-9Xx]/g, '').toUpperCase();
  return isValidIsbn10(cleaned) || isValidIsbn13(cleaned);
}
