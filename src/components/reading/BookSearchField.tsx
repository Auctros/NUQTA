/**
 * Title field with catalogue autocomplete.
 *
 * This is an *enhancement on top of a plain text input*, not a replacement for one:
 * the field stays editable at all times, so manual entry works with no network, no
 * provider and no configuration. Suggestions only ever fill the form; the reader
 * confirms with a click, Enter, or by ignoring them entirely.
 *
 * Behaviour that is easy to get wrong, and how it is handled here:
 *   - one request per keystroke: the query is debounced, and a request superseded by
 *     a newer query is aborted *and* discarded by sequence number, because an abort
 *     can still resolve late;
 *   - a slow first answer must not overwrite a fast second one, so only the newest
 *     sequence may write state;
 *   - the dropdown must not be clipped by the modal, so it renders in a portal at
 *     fixed coordinates measured from the input;
 *   - clicking outside must close without selecting the row under the cursor.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NuqtaIcon } from '../NuqtaIcon';
import { booksClient, describeBooksError, type BooksErrorCode } from '../../lib/booksClient';
import {
  isSearchableQuery,
  looksLikeIsbn,
  resultCreditLine,
  type BookSearchResult
} from '../../lib/bookCatalog';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MENU_MAX_HEIGHT = 340;

export interface BookSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: BookSearchResult) => void;
  isAr: boolean;
  /** Where the field lives, so ids and labels stay unique per form. */
  inputId?: string;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export const BookSearchField: React.FC<BookSearchFieldProps> = ({
  value,
  onChange,
  onSelect,
  isAr,
  inputId,
  disabled = false,
  invalid = false,
  autoFocus = false
}) => {
  const reactId = useId();
  const fieldId = inputId ?? `bk-search-${reactId}`;
  const listboxId = `${fieldId}-listbox`;
  const optionId = (index: number) => `${fieldId}-opt-${index}`;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [error, setError] = useState<BooksErrorCode | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  /** The query the visible results belong to, for the empty-state message. */
  const [searchedQuery, setSearchedQuery] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Monotonic request counter: only the newest response may write state. */
  const seqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const canSearch = isSearchableQuery(trimmed);

  const positionMenu = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 220) && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MENU_MAX_HEIGHT, openUp ? rect.top - 12 : spaceBelow - 12),
      ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      zIndex: 'var(--z-dropdown)' as unknown as number
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    const reposition = () => positionMenu();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, positionMenu]);

  const runSearch = useCallback(async (query: string) => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    abortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = controller;

    setStatus('loading');
    setError(null);

    const res = await booksClient.search(query, { signal: controller?.signal });

    // A newer keystroke has already superseded this answer.
    if (seq !== seqRef.current) return;

    if (!res.ok) {
      setResults([]);
      setError(res.error);
      setStatus('error');
      setSearchedQuery(query);
      return;
    }
    setResults(res.value.results);
    setSearchedQuery(query);
    setStatus(res.value.results.length ? 'results' : 'empty');
    setActiveIndex(res.value.results.length ? 0 : -1);
  }, []);

  // Debounce: the timer is the only thing that starts a request.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!canSearch) {
      abortRef.current?.abort();
      seqRef.current += 1;
      setStatus('idle');
      setResults([]);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, canSearch, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Outside click: mousedown, so a row under the cursor never receives the click.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = useCallback(
    (result: BookSearchResult) => {
      onSelect(result);
      setOpen(false);
      setActiveIndex(-1);
      // Keep focus in the field so the reader can immediately continue editing.
      inputRef.current?.focus();
    },
    [onSelect]
  );

  const retry = useCallback(() => {
    booksClient.clearCache();
    if (canSearch) void runSearch(trimmed);
  }, [canSearch, trimmed, runSearch]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'Enter') {
      // Enter selects a highlighted suggestion; with none, the form's own submit runs.
      if (open && results.length && activeIndex >= 0) {
        event.preventDefault();
        choose(results[activeIndex]);
      }
    }
  };

  const showMenu = open && canSearch;
  const searching = status === 'loading';
  const isIsbnQuery = useMemo(() => looksLikeIsbn(trimmed), [trimmed]);

  const menu = showMenu
    ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={isAr ? 'نتائج البحث في الفهرس' : 'Catalogue results'}
          style={menuStyle}
          className="overflow-y-auto rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--elev-3)]"
        >
          {searching && (
            <div
              className="flex items-center gap-2 px-3 py-3 text-[var(--fs-xs)] text-[var(--text-secondary)]"
              role="status"
            >
              <span className="bk-search-spinner" aria-hidden="true" />
              {isAr ? 'جارٍ البحث في الفهارس…' : 'Searching catalogues…'}
            </div>
          )}

          {!searching && status === 'error' && error && (
            <div className="px-3 py-3">
              <p className="text-[var(--fs-xs)] text-[var(--state-danger)]">
                {describeBooksError(error)[isAr ? 'ar' : 'en']}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-[var(--r-sm)] border border-[var(--border-strong)] px-2 py-1 text-[var(--fs-micro)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {isAr ? 'إعادة المحاولة' : 'Retry'}
                </button>
                <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                  {isAr ? 'أو أكمل الإدخال يدوياً' : 'or keep typing manually'}
                </span>
              </div>
            </div>
          )}

          {!searching && status === 'empty' && (
            <div className="px-3 py-3 text-[var(--fs-xs)] text-[var(--text-secondary)]">
              {isAr
                ? `لا نتائج لـ «${searchedQuery}». يمكنك إدخال البيانات يدوياً.`
                : `No results for “${searchedQuery}”. You can enter the details manually.`}
            </div>
          )}

          {!searching &&
            results.map((result, index) => (
              <button
                key={result.key}
                type="button"
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result)}
                className={`flex w-full gap-3 px-3 py-2.5 text-start transition-colors duration-[var(--dur-fast)] ${
                  index === activeIndex ? 'bg-[var(--surface-chip)]' : ''
                }`}
              >
                <span className="bk-result-cover shrink-0" aria-hidden="true">
                  {result.coverUrl ? (
                    // Same-origin proxy route: the CSP forbids loading the provider host.
                    <img
                      src={booksClient.coverUrl(result.coverUrl)}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <NuqtaIcon name="book" className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[var(--fs-sm)] text-[var(--text-primary)]">
                    {result.title}
                    {result.subtitle ? <span className="text-[var(--text-tertiary)]">: {result.subtitle}</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[var(--fs-micro)] text-[var(--text-secondary)]">
                    {resultCreditLine(result, isAr) || (isAr ? 'بيانات غير مكتملة' : 'Incomplete metadata')}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                    {result.isbn13 && <span className="bk-result-chip">ISBN {result.isbn13}</span>}
                    {!result.isbn13 && result.isbn10 && <span className="bk-result-chip">ISBN {result.isbn10}</span>}
                    {result.pageCount ? (
                      <span className="bk-result-chip">
                        {result.pageCount} {isAr ? 'صفحة' : 'pp'}
                      </span>
                    ) : null}
                    <span className="bk-result-chip">
                      {result.source === 'google_books' ? 'Google Books' : 'Open Library'}
                    </span>
                  </span>
                </span>
              </button>
            ))}

          {!searching && results.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] px-3 py-1.5 text-[var(--fs-micro)] text-[var(--text-tertiary)]">
              {isAr
                ? 'من فهارس خارجية · يمكنك تعديل أي حقل قبل الحفظ'
                : 'From external catalogues · every field stays editable before saving'}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-secondary)]"
      >
        {isAr ? 'عنوان الكتاب' : 'Title'}
        <span className="text-[var(--state-danger)] ms-1">*</span>
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={showMenu ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showMenu && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={`${fieldId}-hint`}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          placeholder={isAr ? 'ابحث عن كتاب أو أدخل العنوان يدوياً' : 'Search for a book, or type the title'}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={[
            'w-full rounded-[var(--r-sm)] border bg-[var(--surface-raised)] text-[var(--text-primary)]',
            'text-[var(--fs-sm)] ps-3 pe-9 h-10 transition-colors duration-[var(--dur-fast)]',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--ring-color)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]'
          ].join(' ')}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[var(--text-tertiary)]">
          {searching ? <span className="bk-search-spinner" aria-hidden="true" /> : <NuqtaIcon name="search" className="w-3.5 h-3.5" />}
        </span>
      </div>

      <span id={`${fieldId}-hint`} className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">
        {isIsbnQuery
          ? isAr
            ? 'يبدو رقماً دولياً — سيُبحث به مباشرة.'
            : 'That looks like an ISBN — it will be looked up directly.'
          : isAr
          ? `اكتب ${MIN_QUERY_LENGTH} أحرف على الأقل للبحث، أو أدخل البيانات يدوياً.`
          : `Type at least ${MIN_QUERY_LENGTH} characters to search, or just enter the details manually.`}
      </span>

      {menu}
    </div>
  );
};

export default BookSearchField;
