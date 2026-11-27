/**
 * Cover pipeline — the parts that can be checked without a real canvas.
 *
 * The interesting guarantees are: the same book always gets the same spine colour (so a
 * shelf without covers still looks deliberate), an empty or non-image input never
 * produces a bogus data URL, and a cover that is too large is refused rather than
 * silently filling the storage quota.
 */
import { describe, it, expect, vi } from 'vitest';
import { spineColorFor, SPINE_PALETTE, readCoverFile, fetchCoverAsDataUrl, MAX_COVER_DATA_URL_LENGTH } from '../src/lib/bookCover';

describe('spine colour', () => {
  it('is stable for the same book', () => {
    expect(spineColorFor('SapiensYuval Noah Harari')).toBe(spineColorFor('SapiensYuval Noah Harari'));
  });

  it('always returns a colour from the palette', () => {
    for (const seed of ['a', 'العاقل', 'The Left Hand of Darkness', '', 'x'.repeat(500)]) {
      expect(SPINE_PALETTE).toContain(spineColorFor(seed) as (typeof SPINE_PALETTE)[number]);
    }
  });

  it('spreads different titles across more than one colour', () => {
    const seeds = ['Sapiens', 'العاقل', 'Dune', 'Cosmos', 'Meditations', '1984', 'Ulysses'];
    expect(new Set(seeds.map(spineColorFor)).size).toBeGreaterThan(1);
  });
});

describe('cover guards', () => {
  it('refuses a non-image upload without touching the reader', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const result = await readCoverFile(file);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('decode_failed');
  });

  it('reports a missing remote URL as unavailable rather than throwing', async () => {
    const result = await fetchCoverAsDataUrl('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unavailable');
  });

  it('keeps the size cap well under a typical localStorage quota', () => {
    // 5 MB is the usual per-origin budget; one cover must not eat a large share.
    expect(MAX_COVER_DATA_URL_LENGTH).toBeLessThan(1_000_000);
  });

  it('fails a remote cover whose image never loads, instead of hanging', async () => {
    // jsdom never fires load or error for an unreachable src — the same silence a
    // stalled connection produces. The load must still settle, or the form would sit
    // on "Loading…" forever with no way out.
    vi.useFakeTimers();
    const pending = fetchCoverAsDataUrl('https://covers.openlibrary.org/b/id/0-L.jpg');
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await pending;
    vi.useRealTimers();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unavailable');
  });
});
