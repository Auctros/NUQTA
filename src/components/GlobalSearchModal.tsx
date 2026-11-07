import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Input, Modal } from './ui';
import { useNuqtaStore } from '../store/nuqtaStore';
import { QURAN_SURAHS } from '../lib/quranData';

/* ============================================================
   NUQTA — Global Search
   Local search over the data already held in the store.
   No duplicated storage: every result is derived on demand.
   ============================================================ */

export type SearchDomain = 'tasks' | 'habits' | 'goals' | 'quran' | 'reading' | 'workout' | 'drawing';

export interface SearchResult {
  key: string;
  domain: SearchDomain;
  title: string;
  subtitle?: string;
  typeLabelAr: string;
  typeLabelEn: string;
  /** the real record id used by the domain */
  recordId: string;
}

type SearchData = ReturnType<typeof useNuqtaStore.getState>;

/* ---------- Arabic-safe normalisation (display text is untouched) ---------- */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

const rankOf = (haystack: string, needle: string): number => {
  if (!needle) return 3;
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 1;
  if (haystack.includes(' ' + needle)) return 2;
  if (haystack.includes(needle)) return 3;
  return -1;
};

const TYPE_LABELS: Record<SearchDomain, { ar: string; en: string }> = {
  tasks: { ar: 'مهمة', en: 'Task' },
  habits: { ar: 'عادة', en: 'Habit' },
  goals: { ar: 'هدف', en: 'Goal' },
  quran: { ar: 'سورة', en: 'Surah' },
  reading: { ar: 'كتاب', en: 'Book' },
  workout: { ar: 'تمرين', en: 'Workout' },
  drawing: { ar: 'عمل فني', en: 'Artwork' }
};

/** Collect every searchable record from the live store state. */
export function collectRecords(data: SearchData): SearchResult[] {
  const out: SearchResult[] = [];
  const push = (domain: SearchDomain, recordId: string, title: string, subtitle?: string) => {
    out.push({
      key: domain + ':' + recordId,
      domain,
      recordId,
      title,
      subtitle,
      typeLabelAr: TYPE_LABELS[domain].ar,
      typeLabelEn: TYPE_LABELS[domain].en
    });
  };

  data.tasks.forEach((t) => push('tasks', t.id, t.title, [t.status, t.scheduledDate].filter(Boolean).join(' · ')));
  data.habits.forEach((h) => push('habits', h.id, h.name, h.anchor));
  data.goals.forEach((g) => push('goals', g.id, g.title, g.category));

  const reading = data.habits.find((h) => h.specializedType === 'reading');
  (reading?.readingData?.books || []).forEach((b) =>
    push('reading', b.id, b.title, [b.author, `${b.currentPage}/${b.totalPages}`].filter(Boolean).join(' · '))
  );

  const workout = data.habits.find((h) => h.specializedType === 'workout');
  (workout?.workoutData?.customRoutines || []).forEach((r) => push('workout', r.id, r.name, r.nameAr));
  (workout?.workoutData?.sessions || []).forEach((s) => push('workout', s.id, s.title, s.date));

  const drawing = data.habits.find((h) => h.specializedType === 'drawing');
  (drawing?.drawingData?.projects || []).forEach((p) => push('drawing', p.id, p.title, p.stage));
  (drawing?.drawingData?.pieces || []).forEach((p) => push('drawing', p.id, p.title, p.medium));

  const quran = data.habits.find((h) => h.specializedType === 'quran');
  (quran?.quranData?.surahs || []).forEach((s) => {
    const meta = QURAN_SURAHS.find((q) => q.number === s.surahNumber);
    if (!meta) return;
    push('quran', String(s.surahNumber), `${meta.nameAr} · ${meta.nameEn}`, `${s.memorizedAyahsCount}/${meta.totalAyahs} · ${s.status}`);
  });

  return out;
}

/** Rank + filter. Exported so it stays testable without React. */
export function searchRecords(records: SearchResult[], query: string): SearchResult[] {
  const needle = normalize(query);
  if (!needle) return [];

  return records
    .map((record) => ({
      record,
      rank: Math.max(
        rankOf(normalize(record.title), needle),
        record.subtitle ? rankOf(normalize(record.subtitle), needle) : -1
      )
    }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.record.title.localeCompare(b.record.title))
    .slice(0, 60)
    .map((entry) => entry.record);
}

/* ---------- Modal ---------- */
export interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
  isAr: boolean;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ open, onClose, onOpenResult, isAr }) => {
  const { tasks, habits, goals } = useNuqtaStore();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus?.();
      previouslyFocused.current = null;
    }
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 150);
    return () => window.clearTimeout(id);
  }, [query]);

  /* records are rebuilt only when the store data changes — never per keystroke */
  const records = useMemo(() => collectRecords({ tasks, habits, goals } as SearchData), [tasks, habits, goals]);
  const results = useMemo(() => searchRecords(records, debounced), [records, debounced]);

  useEffect(() => setActiveIndex(0), [debounced]);

  const groups = useMemo(() => {
    const map = new Map<SearchDomain, SearchResult[]>();
    results.forEach((r) => {
      if (!map.has(r.domain)) map.set(r.domain, []);
      map.get(r.domain)!.push(r);
    });
    return Array.from(map.entries());
  }, [results]);

  const flat = results;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) {
        onOpenResult(item);
        onClose();
      }
    }
  };

  let cursor = -1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      variant="glass"
      title={isAr ? 'البحث الشامل' : 'Global Search'}
      description={
        isAr ? 'ابحث داخل مهامك وعاداتك وأهدافك واستوديوهاتك' : 'Search across tasks, habits, goals and your studios'
      }
    >
      <div onKeyDown={onKeyDown}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'ابحث عن مهمة، عادة، كتاب، سورة…' : 'Search tasks, habits, books, surahs…'}
          aria-label={isAr ? 'بحث شامل' : 'Global search'}
        />

        {!debounced.trim() && (
          <p className="mt-4 text-[var(--fs-sm)] text-[var(--text-secondary)] text-center py-6">
            {isAr ? 'ابدأ الكتابة لعرض النتائج من بياناتك المحلية.' : 'Start typing to search your local data.'}
          </p>
        )}

        {debounced.trim() && results.length === 0 && (
          <p className="mt-4 text-[var(--fs-sm)] text-[var(--text-secondary)] text-center py-6">
            {isAr ? 'لا توجد نتائج مطابقة.' : 'No matching results.'}
          </p>
        )}

        <div className="mt-3 max-h-[52vh] overflow-y-auto space-y-3" role="listbox">
          {groups.map(([domain, items]) => (
            <div key={domain}>
              <div className="text-[var(--fs-micro)] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 px-1">
                {isAr ? TYPE_LABELS[domain].ar : TYPE_LABELS[domain].en}
              </div>
              {items.map((item) => {
                cursor += 1;
                const index = cursor;
                return (
                  <button
                    key={item.key}
                    data-index={index}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onOpenResult(item);
                      onClose();
                    }}
                    className={[
                      'w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-[var(--r-xs)] text-start',
                      'transition-colors duration-[var(--dur-fast)]',
                      index === activeIndex
                        ? 'bg-[var(--surface-chip)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-chip)]'
                    ].join(' ')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[var(--fs-sm)]">{item.title}</span>
                      {item.subtitle && (
                        <span className="block truncate text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <Badge tone="neutral">{isAr ? item.typeLabelAr : item.typeLabelEn}</Badge>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3 text-[var(--fs-micro)] text-[var(--text-tertiary)]">
          <span>↑↓ {isAr ? 'تنقّل' : 'navigate'}</span>
          <span>↵ {isAr ? 'فتح' : 'open'}</span>
          <span>Esc {isAr ? 'إغلاق' : 'close'}</span>
        </div>
      </div>
    </Modal>
  );
};
