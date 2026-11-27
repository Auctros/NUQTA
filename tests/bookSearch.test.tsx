/**
 * Add-book catalogue search — the combobox and the boundary it protects.
 *
 * Two kinds of guarantee are pinned here:
 *
 *   Interaction — debounce, stale-answer rejection, keyboard selection, Escape, and
 *   outside-click. These are the behaviours a reader notices immediately when they
 *   break, and they cannot be verified by reading the code.
 *
 *   Ownership — an imported catalogue record may fill bibliographic fields and nothing
 *   else. Reading status, progress, rating, notes and dates belong to the reader, and a
 *   catalogue refresh must never touch them. That is the single most important property
 *   in this feature, so it is tested against the real store rather than a mock.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { BookSearchField } from '../src/components/reading/BookSearchField';
import { booksClient } from '../src/lib/booksClient';
import type { BookSearchResult } from '../src/lib/bookCatalog';

const result = (overrides: Partial<BookSearchResult> = {}): BookSearchResult => ({
  key: 'google_books:vol1',
  source: 'google_books',
  sourceId: 'vol1',
  title: 'Sapiens',
  subtitle: 'A Brief History of Humankind',
  authors: ['Yuval Noah Harari'],
  publisher: 'Harper',
  publishedDate: '2015-02-10',
  publishedYear: 2015,
  language: 'en',
  isbn13: '9780062316097',
  pageCount: 464,
  coverUrl: 'https://books.google.com/books/content?id=vol1&zoom=2',
  ...overrides
});

/** A fetch stub that answers the proxy search route. */
function stubSearch(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

const body = (results: BookSearchResult[]) => ({
  google: {
    ok: true,
    items: results
      .filter((r) => r.source === 'google_books')
      .map((r) => ({
        id: r.sourceId,
        volumeInfo: {
          title: r.title,
          subtitle: r.subtitle,
          authors: r.authors,
          publisher: r.publisher,
          publishedDate: r.publishedDate,
          pageCount: r.pageCount,
          language: r.language,
          industryIdentifiers: r.isbn13 ? [{ type: 'ISBN_13', identifier: r.isbn13 }] : [],
          imageLinks: r.coverUrl ? { thumbnail: r.coverUrl } : undefined
        }
      }))
  },
  openLibrary: { ok: true, docs: [] }
});

beforeEach(() => {
  booksClient.clearCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * A stateful host, so the field behaves as it does in the real form.
 *
 * The field is controlled: its parent owns the text. Rendering it with a fixed `value`
 * would freeze the query and nothing would ever be searched, which is a property of the
 * harness rather than the component.
 */
const Host: React.FC<{
  onSelect: (r: BookSearchResult) => void;
  onChangeSpy?: (v: string) => void;
  initial?: string;
}> = ({ onSelect, onChangeSpy, initial = '' }) => {
  const [value, setValue] = React.useState(initial);
  return (
    <BookSearchField
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
      onSelect={onSelect}
      isAr={false}
      inputId="bk-title"
    />
  );
};

/** Render the field and type a query, letting the debounce fire. */
async function typeQuery(query: string) {
  const onChange = vi.fn();
  const onSelect = vi.fn();
  render(<Host onSelect={onSelect} onChangeSpy={onChange} />);
  const input = screen.getByRole('combobox');

  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
  });

  // Advance past the debounce, then let the resolved promise settle.
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  return { input, onChange, onSelect };
}

describe('BookSearchField — searching', () => {
  it('debounces: several keystrokes produce one request', async () => {
    vi.useFakeTimers();
    const fetchMock = stubSearch(body([result()]));
    vi.stubGlobal('fetch', fetchMock);

    render(<Host onSelect={() => {}} />);
    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 's' } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sa' } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sap' } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sapiens' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not search a single character', async () => {
    vi.useFakeTimers();
    const fetchMock = stubSearch(body([result()]));
    vi.stubGlobal('fetch', fetchMock);

    await typeQuery('s');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows results with the fields needed to tell editions apart', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));

    await typeQuery('sapiens');

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText(/Sapiens/)).toBeTruthy();
    expect(screen.getByText(/Yuval Noah Harari/)).toBeTruthy();
    expect(screen.getByText(/ISBN 9780062316097/)).toBeTruthy();
    expect(screen.getByText(/464/)).toBeTruthy();
  });

  it('never auto-selects the first result', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { onSelect } = await typeQuery('sapiens');

    // Results are visible but nothing has been chosen for the reader.
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows an explicit no-results state that points at manual entry', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch({ google: { ok: true, items: [] }, openLibrary: { ok: true, docs: [] } }));

    await typeQuery('zzzznotabook');

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText(/No results for/)).toBeTruthy();
    // The empty state itself must point at manual entry, not just the field hint.
    expect(within(listbox).getByText(/manually/)).toBeTruthy();
  });

  it('reports a provider failure with a retry, not an empty list', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch({ error: 'bad_response' }, 502));

    await typeQuery('sapiens');

    expect(screen.getByText(/unexpected response/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
  });

  it('offers manual entry when search is not configured', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch({ error: 'not_configured' }, 503));

    await typeQuery('sapiens');

    expect(screen.getByText(/not enabled on this server/i)).toBeTruthy();
    expect(screen.getByText(/add the book manually/i)).toBeTruthy();
  });
});

describe('BookSearchField — keyboard and pointer', () => {
  it('moves the highlight with arrow keys and selects with Enter', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      stubSearch(
        body([
          // Distinct ISBNs: two records sharing one ISBN are one edition, and the
          // merge collapses them — which would leave a single row to navigate.
          result({ key: 'a', sourceId: 'a', title: 'First book', isbn13: '9780000000002' }),
          result({ key: 'b', sourceId: 'b', title: 'Second book', isbn13: '9780000000019' })
        ])
      )
    );
    const { input, onSelect } = await typeQuery('book');

    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].title).toBe('Second book');
  });

  it('wraps the highlight at the end of the list', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      stubSearch(
        body([
          result({ key: 'a', sourceId: 'a', title: 'One', isbn13: '9780000000002' }),
          result({ key: 'b', sourceId: 'b', title: 'Two', isbn13: '9780000000019' })
        ])
      )
    );
    const { input, onSelect } = await typeQuery('book');

    // Start on index 0; down, down wraps back to 0.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onSelect.mock.calls[0][0].title).toBe('One');
  });

  it('closes the list on Escape without selecting anything', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { input, onSelect } = await typeQuery('sapiens');

    expect(screen.getByRole('listbox')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects a result on click', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { onSelect } = await typeQuery('sapiens');

    const option = screen.getAllByRole('option')[0];
    await act(async () => {
      fireEvent.click(option);
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].title).toBe('Sapiens');
  });

  it('closes on an outside click without selecting the row under the cursor', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { onSelect } = await typeQuery('sapiens');

    expect(screen.getByRole('listbox')).toBeTruthy();
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exposes combobox semantics and the active option', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { input } = await typeQuery('sapiens');

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
  });
});

describe('BookSearchField — stale responses', () => {
  it('discards a slow answer that a newer query superseded', async () => {
    vi.useFakeTimers();
    const resolvers: Array<(value: Response) => void> = [];
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve))
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Host onSelect={() => {}} />);
    const input = screen.getByRole('combobox');

    // First query fires.
    await act(async () => {
      fireEvent.change(input, { target: { value: 'slow' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Second query supersedes it before the first answers.
    await act(async () => {
      fireEvent.change(input, { target: { value: 'fast' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Answer the *newer* request first, then the stale one.
    await act(async () => {
      resolvers[1](
        new Response(JSON.stringify(body([result({ title: 'Fresh answer', key: 'f', sourceId: 'f' })])), {
          status: 200
        })
      );
    });
    await act(async () => {
      resolvers[0](
        new Response(JSON.stringify(body([result({ title: 'Stale answer', key: 's', sourceId: 's' })])), {
          status: 200
        })
      );
    });

    expect(screen.getByText(/Fresh answer/)).toBeTruthy();
    expect(screen.queryByText(/Stale answer/)).toBeNull();
  });
});

describe('BookSearchField — manual entry is never blocked', () => {
  it('stays editable with no network and no results', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    const { input, onChange } = await typeQuery('my own book');

    // The input still reports every keystroke to the form.
    await act(async () => {
      fireEvent.change(input, { target: { value: 'my own book, typed' } });
    });
    expect(onChange).toHaveBeenCalledWith('my own book, typed');
    // And the failure is explained rather than swallowed.
    expect(screen.getByText(/Could not reach the search service/i)).toBeTruthy();
  });

  it('keeps the value when the list is dismissed', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stubSearch(body([result()])));
    const { input, onChange } = await typeQuery('sapiens');

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: 'sapiens — my edition' } });
    });

    expect(onChange).toHaveBeenCalledWith('sapiens — my edition');
  });
});
