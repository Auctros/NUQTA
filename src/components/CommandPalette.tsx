import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Input, Modal } from './ui';

/* ============================================================
   NUQTA — Command Palette
   Navigation + quick commands only (global data search lives in
   its own surface). Ctrl/Cmd+K opens it.
   ============================================================ */

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string[];
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  isAr: boolean;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, items, isAr }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* remember + restore focus around the dialog lifetime */
  useEffect(() => {
    if (open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      setQuery('');
      setActiveIndex(0);
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus?.();
      previouslyFocused.current = null;
    }
  }, [open]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((item) => {
      const haystack = normalize([item.label, item.hint ?? '', ...(item.keywords ?? [])].join(' '));
      return haystack.includes(q);
    });
  }, [items, query]);

  /* keep the highlighted row inside bounds and visible */
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-index="' + activeIndex + '"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const runItem = (item: CommandItem) => {
    item.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) runItem(item);
    }
  };

  const groups = Array.from(new Set(results.map((r) => r.group)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      variant="glass"
      title={isAr ? 'لوحة الأوامر' : 'Command Palette'}
      description={isAr ? 'تنقّل بين صفحات NUQTA أو نفّذ إجراءً سريعًا' : 'Jump to a NUQTA page or run a quick action'}
    >
      <div onKeyDown={onKeyDown}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'اكتب اسم الصفحة أو الإجراء…' : 'Type a page or action…'}
          aria-label={isAr ? 'بحث الأوامر' : 'Search commands'}
        />

        <div ref={listRef} className="mt-3 max-h-[52vh] overflow-y-auto space-y-3" role="listbox">
          {results.length === 0 && (
            <p className="text-[var(--fs-sm)] text-[var(--text-secondary)] py-6 text-center">
              {isAr ? 'لا توجد نتائج مطابقة.' : 'No matching commands.'}
            </p>
          )}

          {groups.map((group) => (
            <div key={group}>
              <div className="text-[var(--fs-micro)] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 px-1">
                {group}
              </div>
              {results
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.group === group)
                .map(({ item, index }) => (
                  <button
                    key={item.id}
                    data-index={index}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runItem(item)}
                    className={[
                      'w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-[var(--r-xs)] text-start',
                      'text-[var(--fs-sm)] transition-colors duration-[var(--dur-fast)]',
                      index === activeIndex
                        ? 'bg-[var(--surface-chip)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-chip)]'
                    ].join(' ')}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <Badge tone="neutral">{item.hint}</Badge>}
                  </button>
                ))}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3 text-[var(--fs-micro)] text-[var(--text-tertiary)]">
          <span>↑↓ {isAr ? 'تنقّل' : 'navigate'}</span>
          <span>↵ {isAr ? 'اختيار' : 'select'}</span>
          <span>Esc {isAr ? 'إغلاق' : 'close'}</span>
        </div>
      </div>
    </Modal>
  );
};
