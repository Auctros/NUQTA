/**
 * Catalogue metadata mapping — pure, no network.
 *
 * These tests exist because the mapping is where provider JSON becomes something the
 * app trusts enough to write into a book record. The risks are concrete: a bad ISBN
 * breaks dedupe, a title-keyed merge hides the edition the reader wanted, and a
 * provider that omits a field must leave it empty rather than inherit a guess.
 */
import { describe, it, expect } from 'vitest';
import {
  googleVolumeToResult,
  isbn10To13,
  isSearchableQuery,
  isValidIsbn10,
  isValidIsbn13,
  languageLabel,
  looksLikeIsbn,
  mergeSearchResults,
  normalizeCoverUrl,
  normalizeIsbn,
  openLibraryDocToResult,
  parsePublishedYear,
  resultCreditLine,
  resultToCatalogMeta,
  type BookSearchResult
} from '../src/lib/bookCatalog';

/** A real Google Books volume shape, trimmed to the fields the mapper reads. */
function googleVolume(overrides: Record<string, unknown> = {}) {
  return {
    id: 'zyTCAlFPjgYC',
    volumeInfo: {
      title: 'Sapiens',
      subtitle: 'A Brief History of Humankind',
      authors: ['Yuval Noah Harari'],
      publisher: 'Harper',
      publishedDate: '2015-02-10',
      description: 'A brief history.',
      industryIdentifiers: [
        { type: 'ISBN_13', identifier: '9780062316097' },
        { type: 'ISBN_10', identifier: '0062316095' }
      ],
      pageCount: 464,
      categories: ['History'],
      language: 'en',
      imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&zoom=1&edge=curl' },
      infoLink: 'https://books.google.com/books?id=zyTCAlFPjgYC',
      ...((overrides.volumeInfo as Record<string, unknown>) ?? {})
    },
    ...overrides
  };
}

describe('ISBN handling', () => {
  it('accepts a valid ISBN-13 and rejects a wrong check digit', () => {
    expect(isValidIsbn13('9780062316097')).toBe(true);
    expect(isValidIsbn13('9780062316098')).toBe(false);
  });

  it('accepts a valid ISBN-10 including the X check digit', () => {
    expect(isValidIsbn10('0062316095')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0804429570')).toBe(false);
  });

  it('derives the ISBN-13 from a valid ISBN-10', () => {
    expect(isbn10To13('0062316095')).toBe('9780062316097');
  });

  it('normalises a dashed, spaced ISBN and rejects garbage', () => {
    expect(normalizeIsbn('978-0-06-231609-7')).toEqual({ isbn13: '9780062316097' });
    expect(normalizeIsbn('not an isbn')).toEqual({});
    // Correct length, wrong checksum: worse than nothing, so it is dropped.
    expect(normalizeIsbn('9780062316098')).toEqual({});
  });

  it('recognises an ISBN query without a checksum false-positive', () => {
    expect(looksLikeIsbn('978-0-06-231609-7')).toBe(true);
    expect(looksLikeIsbn('9780062316098')).toBe(false);
    expect(looksLikeIsbn('sapiens')).toBe(false);
  });
});

describe('query gating', () => {
  it('refuses a single character but accepts two', () => {
    expect(isSearchableQuery('a')).toBe(false);
    expect(isSearchableQuery('ab')).toBe(true);
  });

  it('accepts a short-but-valid ISBN even under the length minimum', () => {
    expect(isSearchableQuery('0062316095')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isSearchableQuery('   ')).toBe(false);
    expect(isSearchableQuery('  sapiens  ')).toBe(true);
  });
});

describe('Google Books mapping', () => {
  it('maps every field the UI renders', () => {
    const result = googleVolumeToResult(googleVolume())!;
    expect(result).toMatchObject({
      source: 'google_books',
      sourceId: 'zyTCAlFPjgYC',
      title: 'Sapiens',
      subtitle: 'A Brief History of Humankind',
      authors: ['Yuval Noah Harari'],
      publisher: 'Harper',
      publishedDate: '2015-02-10',
      publishedYear: 2015,
      language: 'en',
      isbn13: '9780062316097',
      isbn10: '0062316095',
      pageCount: 464,
      categories: ['History']
    });
  });

  it('upgrades the cover to https and asks for a larger image', () => {
    const result = googleVolumeToResult(googleVolume())!;
    expect(result.coverUrl).toContain('https://');
    expect(result.coverUrl).toContain('zoom=2');
    expect(result.coverUrl).not.toContain('edge=curl');
  });

  it('leaves absent fields undefined rather than inventing them', () => {
    const result = googleVolumeToResult({
      id: 'abc',
      volumeInfo: { title: 'Bare minimum' }
    })!;
    expect(result.title).toBe('Bare minimum');
    expect(result.authors).toEqual([]);
    expect(result.publisher).toBeUndefined();
    expect(result.pageCount).toBeUndefined();
    expect(result.coverUrl).toBeUndefined();
    expect(result.isbn13).toBeUndefined();
  });

  it('drops a volume with no title instead of showing a blank row', () => {
    expect(googleVolumeToResult({ id: 'x', volumeInfo: {} })).toBeNull();
    expect(googleVolumeToResult(null)).toBeNull();
  });

  it('drops a volume with no id, since it cannot be de-duplicated or re-fetched', () => {
    expect(googleVolumeToResult({ volumeInfo: { title: 'Orphan' } })).toBeNull();
  });

  it('tolerates a malformed identifier list', () => {
    const result = googleVolumeToResult({
      id: 'abc',
      volumeInfo: { title: 'Odd ids', industryIdentifiers: 'nonsense' }
    })!;
    expect(result.isbn13).toBeUndefined();
  });
});

describe('Open Library mapping', () => {
  it('maps a search doc, including a Covers API URL', () => {
    const result = openLibraryDocToResult({
      key: '/works/OL45883W',
      title: 'The Left Hand of Darkness',
      author_name: ['Ursula K. Le Guin'],
      first_publish_year: 1969,
      publisher: ['Ace Books'],
      language: ['eng'],
      isbn: ['9780441478125'],
      cover_i: 12345,
      subject: ['Science fiction'],
      number_of_pages_median: 304
    })!;
    expect(result).toMatchObject({
      source: 'open_library',
      sourceId: 'works/OL45883W',
      title: 'The Left Hand of Darkness',
      authors: ['Ursula K. Le Guin'],
      publishedYear: 1969,
      publisher: 'Ace Books',
      pageCount: 304,
      isbn13: '9780441478125'
    });
    expect(result.coverUrl).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
    expect(result.infoUrl).toBe('https://openlibrary.org/works/OL45883W');
  });

  it('leaves the cover undefined when there is no cover id', () => {
    const result = openLibraryDocToResult({ key: '/works/OL1W', title: 'No cover' })!;
    expect(result.coverUrl).toBeUndefined();
  });

  it('rejects a doc with no title or no key', () => {
    expect(openLibraryDocToResult({ key: '/works/OL1W' })).toBeNull();
    expect(openLibraryDocToResult({ title: 'No key' })).toBeNull();
  });
});

describe('edition-aware merging', () => {
  const base: BookSearchResult = {
    key: 'google_books:a',
    source: 'google_books',
    sourceId: 'a',
    title: 'Sapiens',
    authors: ['Yuval Noah Harari'],
    isbn13: '9780062316097'
  };

  it('keeps two translations of one title as two results', () => {
    const arabic: BookSearchResult = {
      ...base,
      key: 'google_books:b',
      sourceId: 'b',
      title: 'العاقل',
      isbn13: '9789953891234',
      language: 'ar'
    };
    const merged = mergeSearchResults([base, arabic]);
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.isbn13)).toEqual(['9780062316097', '9789953891234']);
  });

  it('collapses the same edition seen by both providers, keeping the richer record', () => {
    const thin: BookSearchResult = {
      key: 'open_library:works/OL1W',
      source: 'open_library',
      sourceId: 'works/OL1W',
      title: 'Sapiens',
      authors: ['Yuval Noah Harari'],
      isbn13: '9780062316097'
    };
    const rich: BookSearchResult = {
      ...base,
      publisher: 'Harper',
      description: 'A brief history.',
      coverUrl: 'https://example.test/c.jpg',
      pageCount: 464
    };
    const merged = mergeSearchResults([thin, rich]);
    expect(merged).toHaveLength(1);
    expect(merged[0].publisher).toBe('Harper');
    expect(merged[0].coverUrl).toBe('https://example.test/c.jpg');
  });

  it('fills a gap in the winner from the loser', () => {
    const withPages: BookSearchResult = { ...base, key: 'open_library:x', sourceId: 'x', pageCount: 464 };
    const withCover: BookSearchResult = { ...base, key: 'google_books:y', sourceId: 'y', coverUrl: 'https://c.test/1.jpg' };
    const merged = mergeSearchResults([withPages, withCover]);
    expect(merged).toHaveLength(1);
    expect(merged[0].coverUrl).toBe('https://c.test/1.jpg');
    expect(merged[0].pageCount).toBe(464);
  });

  it('does not merge two different books that have no ISBN', () => {
    const a: BookSearchResult = { ...base, key: 'google_books:1', sourceId: '1', isbn13: undefined, title: 'A' };
    const b: BookSearchResult = { ...base, key: 'google_books:2', sourceId: '2', isbn13: undefined, title: 'B' };
    expect(mergeSearchResults([a, b])).toHaveLength(2);
  });

  it('preserves provider order for the first appearance of each edition', () => {
    const a: BookSearchResult = { ...base, key: 'k1', sourceId: '1', isbn13: '9780000000002' };
    const b: BookSearchResult = { ...base, key: 'k2', sourceId: '2', isbn13: '9780000000019' };
    expect(mergeSearchResults([a, b]).map((r) => r.sourceId)).toEqual(['1', '2']);
  });
});

describe('persisted metadata', () => {
  it('carries only bibliographic fields, never personal reading data', () => {
    const meta = resultToCatalogMeta(googleVolumeToResult(googleVolume())!, new Date('2026-01-01T00:00:00Z'));
    const keys = Object.keys(meta);
    for (const personal of ['status', 'currentPage', 'totalPages', 'rating', 'notes', 'startDate', 'completedDate']) {
      expect(keys).not.toContain(personal);
    }
    expect(meta.source).toBe('google_books');
    expect(meta.fetchedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('omits empty author and category arrays instead of storing []', () => {
    const meta = resultToCatalogMeta({
      key: 'k',
      source: 'open_library',
      sourceId: 'x',
      title: 'T',
      authors: []
    });
    expect(meta.authors).toBeUndefined();
    expect(meta.categories).toBeUndefined();
  });
});

describe('display helpers', () => {
  it('parses a year out of every date shape the providers use', () => {
    expect(parsePublishedYear('2020')).toBe(2020);
    expect(parsePublishedYear('2020-05')).toBe(2020);
    expect(parsePublishedYear('2020-05-01')).toBe(2020);
    expect(parsePublishedYear('May 2020')).toBe(2020);
    expect(parsePublishedYear('')).toBeUndefined();
    expect(parsePublishedYear(undefined)).toBeUndefined();
  });

  it('builds a credit line from whatever is present', () => {
    const result = googleVolumeToResult(googleVolume())!;
    const line = resultCreditLine(result, false);
    expect(line).toContain('Yuval Noah Harari');
    expect(line).toContain('2015');
    expect(line).toContain('Harper');
    expect(line).toContain('English');
  });

  it('labels a language in both languages and falls back to the code', () => {
    expect(languageLabel('ar', true)).toBe('العربية');
    expect(languageLabel('en', false)).toBe('English');
    expect(languageLabel('xx', false)).toBe('XX');
  });

  it('refuses a cover URL that is not http(s)', () => {
    expect(normalizeCoverUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeCoverUrl(undefined)).toBeUndefined();
  });
});
