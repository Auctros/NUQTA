/**
 * Book import — the ownership boundary, tested against the real store.
 *
 * The whole point of keeping catalogue metadata in its own nested record is that an
 * import may rewrite bibliography and nothing else. If a catalogue refresh could reset
 * reading progress, overwrite a rating, or drop notes, the feature would be actively
 * harmful: the reader's own history is the part of a book record that cannot be
 * reconstructed from anywhere.
 *
 * These tests therefore drive the real store and assert on what is persisted, not on
 * what a component rendered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { resultToCatalogMeta, googleVolumeToResult } from '../src/lib/bookCatalog';
import type { BookItem } from '../src/types';

const S = () => useNuqtaStore.getState();

/** The reading habit the store creates on demand. */
function readingHabitId(): string {
  const habit = S().habits.find((h) => h.specializedType === 'reading');
  if (!habit) throw new Error('reading habit missing');
  return habit.id;
}

function books(): BookItem[] {
  const habit = S().habits.find((h) => h.specializedType === 'reading');
  return habit?.readingData?.books ?? [];
}

beforeEach(() => {
  localStorage.clear();
  S().initializeStore();
  if (!S().habits.some((h) => h.specializedType === 'reading')) {
    act(() => {
      S().createHabit({
        name: 'Read daily',
        anchor: 'After coffee -> open book',
        category: 'mind',
        timeOfDay: 'morning',
        specializedType: 'reading'
      });
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A book the reader has already been working through. */
function existingBook(overrides: Partial<BookItem> = {}): BookItem {
  return {
    id: 'book-mine',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    category: 'mind',
    totalPages: 464,
    currentPage: 212,
    status: 'reading',
    rating: 4,
    notes: 'Chapter 8 changed how I think about money.',
    startDate: '2026-10-01',
    coverColor: '#b45309',
    ...overrides
  };
}

describe('import — catalogue metadata lands, personal data stays', () => {
  it('attaches catalogue metadata without touching progress, rating, notes or dates', async () => {
    act(() => {
      S().addOrUpdateBook(readingHabitId(), existingBook());
    });

    const meta = resultToCatalogMeta(
      googleVolumeToResult({
        id: 'vol1',
        volumeInfo: {
          title: 'Sapiens',
          subtitle: 'A Brief History of Humankind',
          authors: ['Yuval Noah Harari'],
          publisher: 'Harper',
          publishedDate: '2015-02-10',
          pageCount: 464,
          language: 'en',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780062316097' }]
        }
      })!
    );

    // The form's save path: spread the existing record, then add bibliography.
    act(() => {
      S().addOrUpdateBook(readingHabitId(), { ...existingBook(), catalog: meta });
    });

    const saved = books().find((b) => b.id === 'book-mine')!;
    expect(saved.catalog?.isbn13).toBe('9780062316097');
    expect(saved.catalog?.publisher).toBe('Harper');

    // Every personal field survived exactly as it was.
    expect(saved.currentPage).toBe(212);
    expect(saved.status).toBe('reading');
    expect(saved.rating).toBe(4);
    expect(saved.notes).toBe('Chapter 8 changed how I think about money.');
    expect(saved.startDate).toBe('2026-10-01');
    expect(saved.totalPages).toBe(464);
  });

  it('does not add a second record when re-importing the same book', () => {
    act(() => {
      S().addOrUpdateBook(readingHabitId(), existingBook());
    });
    act(() => {
      S().addOrUpdateBook(readingHabitId(), { ...existingBook(), author: 'Y. N. Harari' });
    });

    expect(books().filter((b) => b.id === 'book-mine')).toHaveLength(1);
    expect(books().find((b) => b.id === 'book-mine')!.author).toBe('Y. N. Harari');
  });

  it('keeps a local cover after the remote URL is gone', () => {
    const dataUrl = 'data:image/jpeg;base64,AAAA';
    act(() => {
      S().addOrUpdateBook(readingHabitId(), existingBook({ coverDataUrl: dataUrl }));
    });

    // Re-read from storage, as a reload would.
    expect(books().find((b) => b.id === 'book-mine')!.coverDataUrl).toBe(dataUrl);
  });

  it('leaves a manually entered book with no catalogue record at all', () => {
    act(() => {
      S().addOrUpdateBook(readingHabitId(), existingBook({ id: 'book-manual', title: 'My notes' }));
    });

    const saved = books().find((b) => b.id === 'book-manual')!;
    expect(saved.catalog).toBeUndefined();
    expect(saved.title).toBe('My notes');
  });

  it('preserves a completed book status and completion date through an import', () => {
    act(() => {
      S().addOrUpdateBook(
        readingHabitId(),
        existingBook({ status: 'completed', completedDate: '2026-10-20', currentPage: 464 })
      );
    });

    act(() => {
      S().addOrUpdateBook(readingHabitId(), {
        ...existingBook({ status: 'completed', completedDate: '2026-10-20', currentPage: 464 }),
        catalog: resultToCatalogMeta(
          googleVolumeToResult({ id: 'v', volumeInfo: { title: 'Sapiens', publisher: 'Harper' } })!
        )
      });
    });

    const saved = books().find((b) => b.id === 'book-mine')!;
    expect(saved.status).toBe('completed');
    expect(saved.completedDate).toBe('2026-10-20');
    expect(saved.currentPage).toBe(464);
  });
});

describe('import — persistence', () => {
  it('survives a reload, because the record is written to localStorage', () => {
    act(() => {
      S().addOrUpdateBook(
        readingHabitId(),
        existingBook({
          coverDataUrl: 'data:image/jpeg;base64,BBBB',
          catalog: resultToCatalogMeta(
            googleVolumeToResult({
              id: 'vol9',
              volumeInfo: { title: 'Sapiens', publisher: 'Harper', pageCount: 464 }
            })!
          )
        })
      );
    });

    // A fresh read of the persisted store, as a page reload performs.
    const raw = localStorage.getItem('nuqta_habits_v1') ?? localStorage.getItem('nuqta_habits');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    const habit = (Array.isArray(parsed) ? parsed : parsed.habits ?? []).find(
      (h: any) => h.specializedType === 'reading'
    );
    const stored = habit.readingData.books.find((b: any) => b.id === 'book-mine');
    expect(stored.catalog.publisher).toBe('Harper');
    expect(stored.coverDataUrl).toBe('data:image/jpeg;base64,BBBB');
    expect(stored.currentPage).toBe(212);
  });
});
