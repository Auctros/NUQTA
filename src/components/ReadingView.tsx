import { localDateKey, parseDateKey, addDaysToKey } from '../lib/dateKey';
import React, { useEffect, useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { BookItem, BookCategory } from '../types';
import { Button, Field, Input, Modal, NuqtaSelect, Textarea } from './ui';
import { dialogs, feedback } from './ui/dialogController';
import { NuqtaIcon } from './NuqtaIcon';
import {
  StudioFrame,
  StudioSection,
  StudioStat,
  StudioBars,
  StudioEmpty,
  StudioTab
} from './studios/StudioKit';

type RTab = 'library' | 'reading' | 'journal' | 'insights';

const COVER_PALETTE = ['#b45309', '#0f766e', '#7c3aed', '#b91c1c', '#1d4ed8', '#4d7c0f', '#a16207', '#9d174d'];

const categoryLabel = (c: BookCategory | undefined, isAr: boolean): string => {
  const map: Record<BookCategory, [string, string]> = {
    mind: ['عقل', 'Mind'],
    philosophy: ['فلسفة', 'Philosophy'],
    productivity: ['إنتاجية', 'Productivity'],
    science: ['علوم', 'Science'],
    literature: ['أدب', 'Literature'],
    biography: ['سيرة', 'Biography'],
    business: ['أعمال', 'Business'],
    other: ['أخرى', 'Other']
  };
  return c ? (isAr ? map[c][0] : map[c][1]) : isAr ? 'أخرى' : 'Other';
};

export const ReadingView: React.FC = () => {
  const {
    habits,
    createHabit,
    profile,
    logReadingSession,
    addOrUpdateBook,
    deleteBook,
    setActiveBook,
    addBookQuote,
    deleteBookQuote,
    updateReadingTargets,
    setActiveNavTab,
    focusRequest,
    consumeFocus
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const readingHabit = habits.find((h) => h.specializedType === 'reading');
  const readingData = readingHabit?.readingData || {
    books: [],
    sessions: [],
    quotes: [],
    dailyTargetPages: 20,
    weeklyTargetPages: 140,
    annualTargetBooks: 24,
    totalPagesRead: 0,
    totalReadingMinutes: 0
  };

  const books = readingData.books || [];
  const sessions = readingData.sessions || [];
  const quotes = readingData.quotes || [];

  const [activeTab, setActiveTab] = useState<RTab>('library');
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<'all' | BookItem['status']>('all');

  useEffect(() => {
    if (!focusRequest || focusRequest.domain !== 'reading') return;
    const id = focusRequest.entityId;
    setActiveTab('library');
    setLibraryFilter('all');
    setOpenBookId(id);
    setFocusedEntityId(id);
    consumeFocus();
    const timer = window.setTimeout(() => setFocusedEntityId(null), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // book editor
  const [editing, setEditing] = useState<BookItem | null>(null);
  const [isNewBook, setIsNewBook] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookCategory, setBookCategory] = useState<BookCategory>('productivity');
  const [bookTotalPages, setBookTotalPages] = useState(300);
  const [bookCurrentPage, setBookCurrentPage] = useState(0);
  const [bookStatus, setBookStatus] = useState<BookItem['status']>('reading');
  const [bookColor, setBookColor] = useState(COVER_PALETTE[0]);
  const [bookNotes, setBookNotes] = useState('');
  const [bookError, setBookError] = useState<string | null>(null);

  // session logger
  const [sessionBookId, setSessionBookId] = useState<string>('');
  const [pagesInput, setPagesInput] = useState(20);
  const [minutesInput, setMinutesInput] = useState(30);
  const [sessionNotes, setSessionNotes] = useState('');
  const [capturedQuote, setCapturedQuote] = useState('');
  const [capturedQuotePage, setCapturedQuotePage] = useState<number | ''>('');

  // targets
  const [tempDailyPages, setTempDailyPages] = useState(readingData.dailyTargetPages || 20);
  const [tempWeeklyPages, setTempWeeklyPages] = useState(readingData.weeklyTargetPages || 140);
  const [tempAnnualBooks, setTempAnnualBooks] = useState(readingData.annualTargetBooks || 24);
  const [targetsSaved, setTargetsSaved] = useState(false);

  const activeBook =
    books.find((b) => b.id === readingData.activeBookId) || books.find((b) => b.status === 'reading') || books[0];

  useEffect(() => {
    if (!sessionBookId && activeBook) setSessionBookId(activeBook.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBook?.id]);

  const handleInitReadingHabit = () =>
    createHabit({
      name: isAr ? 'قراءة 20 صفحة يومياً' : 'Read 20 Pages Daily',
      anchor: isAr ? 'بعد شرب القهوة صباحاً -> أفتح كتابي' : 'After morning coffee -> open book',
      category: 'mind',
      timeOfDay: 'morning',
      specializedType: 'reading'
    });

  const openNewBook = () => {
    setIsNewBook(true);
    setEditing(null);
    setBookTitle('');
    setBookAuthor('');
    setBookCategory('productivity');
    setBookTotalPages(300);
    setBookCurrentPage(0);
    setBookStatus('want_to_read');
    setBookColor(COVER_PALETTE[Math.floor(Math.random() * COVER_PALETTE.length)]);
    setBookNotes('');
    setBookError(null);
  };

  const openEditBook = (b: BookItem) => {
    setIsNewBook(false);
    setEditing(b);
    setBookTitle(b.title);
    setBookAuthor(b.author);
    setBookCategory(b.category || 'productivity');
    setBookTotalPages(b.totalPages || 1);
    setBookCurrentPage(b.currentPage || 0);
    setBookStatus(b.status);
    setBookColor(b.coverColor || COVER_PALETTE[0]);
    setBookNotes(b.notes || '');
    setBookError(null);
  };

  const saveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit) return;
    const title = bookTitle.trim();
    const total = Number(bookTotalPages);
    const current = Number(bookCurrentPage);
    if (!title) return setBookError(isAr ? 'عنوان الكتاب مطلوب.' : 'Book title is required.');
    if (!Number.isFinite(total) || total < 1)
      return setBookError(isAr ? 'عدد الصفحات يجب أن يكون 1 على الأقل.' : 'Total pages must be at least 1.');
    if (!Number.isFinite(current) || current < 0 || current > total)
      return setBookError(isAr ? 'الصفحة الحالية خارج النطاق.' : 'Current page is out of range.');

    addOrUpdateBook(readingHabit.id, {
      id: editing?.id || 'book-' + crypto.randomUUID().slice(0, 8),
      title,
      author: bookAuthor.trim() || (isAr ? 'مؤلف غير محدد' : 'Unknown Author'),
      category: bookCategory,
      totalPages: total,
      currentPage: current,
      status: bookStatus,
      rating: editing?.rating || 5,
      notes: bookNotes.trim() || undefined,
      coverColor: bookColor,
      startDate: editing?.startDate || (bookStatus === 'reading' ? todayStr : undefined)
    });
    setEditing(null);
    setIsNewBook(false);
    feedback.success(isNewBook ? (isAr ? 'تمت إضافة الكتاب.' : 'Book added.') : isAr ? 'تم تحديث الكتاب.' : 'Book updated.');
  };

  const submitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit) return;
    const book = books.find((b) => b.id === sessionBookId) || activeBook;
    if (!book) return;
    const speed = Math.round((pagesInput / Math.max(5, minutesInput)) * 60);
    logReadingSession(readingHabit.id, {
      bookId: book.id,
      bookTitle: book.title,
      pagesRead: Number(pagesInput),
      durationMinutes: Number(minutesInput),
      speedPagesPerHour: speed,
      notes: sessionNotes.trim() || undefined,
      quoteSnippet: capturedQuote.trim() || undefined
    });
    if (capturedQuote.trim()) {
      addBookQuote(readingHabit.id, {
        quote: capturedQuote.trim(),
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        page: typeof capturedQuotePage === 'number' ? capturedQuotePage : undefined
      });
    }
    setCapturedQuote('');
    setCapturedQuotePage('');
    setSessionNotes('');
    feedback.success(isAr ? 'تم تسجيل جلسة القراءة.' : 'Reading session recorded.');
  };

  const saveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit) return;
    updateReadingTargets(readingHabit.id, {
      dailyTargetPages: Number(tempDailyPages),
      weeklyTargetPages: Number(tempWeeklyPages),
      annualTargetBooks: Number(tempAnnualBooks)
    });
    setTargetsSaved(true);
    window.setTimeout(() => setTargetsSaved(false), 2000);
  };

  const openBook = books.find((b) => b.id === openBookId) || null;

  const completedBooks = books.filter((b) => b.status === 'completed');
  const readingBooks = books.filter((b) => b.status === 'reading');
  const pagesReadToday = sessions.filter((s) => s.date === todayStr).reduce((a, s) => a + s.pagesRead, 0);
  const weekStart = addDaysToKey(todayStr, -6);
  const pagesThisWeek = sessions
    .filter((s) => s.date >= weekStart)
    .reduce((a, s) => a + s.pagesRead, 0);
  const avgSpeed = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.speedPagesPerHour || 35), 0) / sessions.length)
    : 0;

  const weekBars = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysToKey(todayStr, -i);
      const pages = sessions.filter((s) => s.date === key).reduce((a, s) => a + s.pagesRead, 0);
      const d = parseDateKey(key);
      out.push({ label: d ? d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'narrow' }) : '', value: pages });
    }
    return out;
  }, [sessions, todayStr, isAr]);

  const filteredBooks = books.filter((b) => (libraryFilter === 'all' ? b.status !== 'archived' : b.status === libraryFilter));

  if (!readingHabit) {
    return (
      <div className="studio-root" data-studio="reading" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="studio-head">
          <div className="min-w-0">
            <span className="studio-eyebrow">NUQTA / READING SANCTUARY</span>
            <h1 className="studio-title mt-1">{isAr ? 'مكتبة القراءة ويومياتها' : 'Reading Library & Journal'}</h1>
            <p className="studio-lede mt-1">
              {isAr
                ? 'خزانة كتب شخصية، سجل قراءة، ومكتبة اقتباسات — كل ذلك في مكان واحد.'
                : 'A personal bookshelf, a reading journal, and a quote library.'}
            </p>
          </div>
        </header>
        <StudioSection>
          <StudioEmpty
            icon="book"
            title={isAr ? 'ابدأ خزانة القراءة الخاصة بك' : 'Initialize your reading library'}
            description={
              isAr ? 'أضف كتبك، سجّل جلساتك، واحتفظ بالاقتباسات الملهمة.' : 'Add books, log sessions, and keep the quotes that matter.'
            }
            action={
              <Button variant="primary" onClick={handleInitReadingHabit}>
                {isAr ? 'تفعيل استوديو القراءة' : 'Enable Reading Studio'}
              </Button>
            }
          />
        </StudioSection>
      </div>
    );
  }

  const tabs: StudioTab[] = [
    { id: 'library', label: isAr ? 'المكتبة' : 'Library', icon: 'book', count: readingBooks.length },
    { id: 'reading', label: isAr ? 'أقرأ الآن' : 'Reading', icon: 'book-open' },
    { id: 'journal', label: isAr ? 'يوميات القراءة' : 'Journal', icon: 'notebook' },
    { id: 'insights', label: isAr ? 'الرؤى' : 'Insights', icon: 'chart' }
  ];

  return (
    <StudioFrame
      studio="reading"
      eyebrow="NUQTA / READING SANCTUARY"
      title={isAr ? 'مكتبة القراءة ويومياتها' : 'Reading Library & Journal'}
      description={
        isAr
          ? 'رفوف كتبك، تقدّمك في كل كتاب، ويوميات جلسات القراءة.'
          : 'Your bookshelf, per-book progress, and a reading journal.'
      }
      actions={
        <>
          <Button variant="primary" size="sm" icon="plus" onClick={openNewBook}>
            {isAr ? 'كتاب جديد' : 'Add book'}
          </Button>
          <Button variant="ghost" size="sm" icon="archive" onClick={() => setActiveNavTab('archive')}>
            {isAr ? 'الأرشيف' : 'Archive'}
          </Button>
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setOpenBookId(null);
        setActiveTab(id as RTab);
      }}
      navVariant="shelf"
      context={
        <span className="text-[var(--fs-micro)] font-mono text-[var(--text-secondary)]">
          {completedBooks.length}/{readingData.annualTargetBooks} {isAr ? 'كتاب' : 'books'}
        </span>
      }
    >
      {/* ============================ LIBRARY ============================ */}
      {activeTab === 'library' && !openBook && (
        <div className="space-y-[var(--sp-4)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', isAr ? 'الكل' : 'All'],
                  ['reading', isAr ? 'أقرأ حالياً' : 'Reading'],
                  ['want_to_read', isAr ? 'أرغب بقراءته' : 'Want to read'],
                  ['completed', isAr ? 'مكتمل' : 'Completed'],
                  ['archived', isAr ? 'مؤرشف' : 'Archived']
                ] as [('all' | BookItem['status']), string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={libraryFilter === id}
                  onClick={() => setLibraryFilter(id)}
                  className="px-3 h-8 rounded-[var(--r-full)] border text-[var(--fs-xs)] transition-colors"
                  style={
                    libraryFilter === id
                      ? { borderColor: 'var(--studio-accent-line)', background: 'var(--studio-accent-soft)', color: 'var(--studio-accent-ink)' }
                      : { borderColor: 'var(--studio-line)', color: 'var(--text-secondary)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
              {filteredBooks.length} {isAr ? 'كتاب' : 'books'}
            </span>
          </div>

          {filteredBooks.length === 0 ? (
            <StudioSection>
              <StudioEmpty
                icon="book"
                title={isAr ? 'الرف فارغ' : 'Your shelf is empty'}
                description={isAr ? 'أضف أول كتاب لتبدأ.' : 'Add your first book to begin.'}
                action={
                  <Button variant="primary" size="sm" icon="plus" onClick={openNewBook}>
                    {isAr ? 'إضافة كتاب' : 'Add book'}
                  </Button>
                }
              />
            </StudioSection>
          ) : (
            <div className="book-grid">
              {filteredBooks.map((b) => {
                const progress = Math.min(100, Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100));
                return (
                  <button
                    key={b.id}
                    id={'book-' + b.id}
                    type="button"
                    className={`book-card ${focusedEntityId === b.id ? 'focus-flash' : ''}`}
                    onClick={() => setOpenBookId(b.id)}
                  >
                    <span className="book-spine" style={{ background: b.coverColor || COVER_PALETTE[0] }}>
                      <span className="book-spine-title">{b.title}</span>
                      <span>
                        <span className="book-spine-author block">{b.author}</span>
                        <span className="text-[var(--fs-micro)] opacity-90 font-mono">
                          {b.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1">
                              <NuqtaIcon name="check" className="w-3 h-3" />
                              {isAr ? 'مكتمل' : 'Completed'}
                            </span>
                          ) : (
                            `${b.currentPage}/${b.totalPages}`
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="book-progress-track">
                      <span className="book-progress-fill" style={{ width: `${progress}%` }} />
                    </span>
                    <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] flex justify-between">
                      <span>{categoryLabel(b.category, isAr)}</span>
                      <span className="font-mono">{progress}%</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================ BOOK DETAILS ============================ */}
      {activeTab === 'library' && openBook && (
        <div className="space-y-[var(--sp-4)]">
          <Button variant="ghost" size="sm" icon="arrow" onClick={() => setOpenBookId(null)}>
            {isAr ? 'رجوع إلى المكتبة' : 'Back to library'}
          </Button>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-[260px_1fr]">
            <div className="space-y-[var(--sp-4)]">
              <div
                className="book-spine mx-auto w-full max-w-[200px]"
                style={{ background: openBook.coverColor || COVER_PALETTE[0] }}
              >
                <span className="book-spine-title">{openBook.title}</span>
                <span className="book-spine-author">{openBook.author}</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="primary" size="sm" icon="play" onClick={() => { setSessionBookId(openBook.id); setActiveTab('reading'); }}>
                  {isAr ? 'تسجيل قراءة' : 'Log reading'}
                </Button>
                <Button variant="secondary" size="sm" icon="edit" onClick={() => openEditBook(openBook)}>
                  {isAr ? 'تعديل' : 'Edit'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveBook(readingHabit.id, openBook.id);
                    feedback.success(isAr ? 'الكتاب النشط الآن.' : 'Set as active book.');
                  }}
                >
                  {isAr ? 'اجعله النشط' : 'Make active'}
                </Button>
              </div>
            </div>

            <div className="space-y-[var(--sp-4)]">
              <StudioSection title={isAr ? 'تقدّم القراءة' : 'Reading progress'}>
                {(() => {
                  const progress = Math.min(100, Math.round((openBook.currentPage / Math.max(1, openBook.totalPages)) * 100));
                  const pagesLeft = Math.max(0, openBook.totalPages - openBook.currentPage);
                  const est = avgSpeed > 0 ? Math.round((pagesLeft / avgSpeed) * 60) : 0;
                  return (
                    <>
                      <div className="flex items-center justify-between text-[var(--fs-xs)] mb-2">
                        <span className="text-[var(--text-secondary)]">
                          {openBook.currentPage} / {openBook.totalPages} {isAr ? 'صفحة' : 'pages'}
                        </span>
                        <span className="font-mono text-[var(--studio-accent)] font-[var(--fw-bold)]">{progress}%</span>
                      </div>
                      <div className="book-progress-track" style={{ height: 8 }}>
                        <div className="book-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        <StudioStat label={isAr ? 'صفحات متبقية' : 'Pages left'} value={pagesLeft} />
                        <StudioStat label={isAr ? 'الوقت المتبقي' : 'Est. time'} value={est ? `${est}m` : '—'} />
                        <StudioStat label={isAr ? 'الحالة' : 'Status'} value={openBook.status === 'completed' ? (isAr ? 'مكتمل' : 'Done') : openBook.status === 'reading' ? (isAr ? 'أقرأ' : 'Reading') : (isAr ? 'لاحقاً' : 'Later')} />
                      </div>
                    </>
                  );
                })()}
              </StudioSection>

              {openBook.notes && (
                <StudioSection title={isAr ? 'ملاحظات الكتاب' : 'Book notes'}>
                  <p className="text-[var(--fs-sm)] text-[var(--text-secondary)] leading-relaxed">{openBook.notes}</p>
                </StudioSection>
              )}

              <StudioSection title={isAr ? 'جلسات هذا الكتاب' : 'Sessions for this book'}>
                {sessions.filter((s) => s.bookId === openBook.id).length === 0 ? (
                  <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                    {isAr ? 'لا توجد جلسات لهذا الكتاب بعد.' : 'No sessions for this book yet.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {sessions
                      .filter((s) => s.bookId === openBook.id)
                      .map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 text-[var(--fs-xs)] border-b border-[var(--studio-line)] last:border-0 pb-2 last:pb-0">
                          <span className="text-[var(--text-secondary)] font-mono">
                            {s.date} · {s.pagesRead} {isAr ? 'ص' : 'p'} · {s.durationMinutes}m
                          </span>
                          <span className="font-mono text-[var(--text-tertiary)]">{s.speedPagesPerHour} {isAr ? 'ص/س' : 'p/h'}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </StudioSection>

              {quotes.filter((q) => q.bookId === openBook.id).length > 0 && (
                <StudioSection title={isAr ? 'اقتباسات من الكتاب' : 'Quotes from this book'}>
                  <ul className="space-y-2">
                    {quotes
                      .filter((q) => q.bookId === openBook.id)
                      .map((q) => (
                        <li key={q.id} className="studio-tile">
                          <p className="text-[var(--fs-sm)] text-[var(--text-primary)] italic">“{q.quote}”</p>
                          {q.page && <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)] font-mono">{isAr ? 'صفحة' : 'p.'} {q.page}</span>}
                        </li>
                      ))}
                  </ul>
                </StudioSection>
              )}

              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  icon="trash"
                  onClick={async () => {
                    const ok = await dialogs.confirm({
                      tone: 'danger',
                      icon: 'trash',
                      title: isAr ? 'حذف هذا الكتاب؟' : 'Delete this book?',
                      description: isAr
                        ? 'ستُحذف جلسات القراءة المرتبطة به من مكتبتك نهائياً.'
                        : 'This removes the book and its reading sessions from your library permanently.',
                      confirmLabel: isAr ? 'حذف' : 'Delete',
                      cancelLabel: isAr ? 'إلغاء' : 'Cancel'
                    });
                    if (ok) {
                      deleteBook(readingHabit.id, openBook.id);
                      setOpenBookId(null);
                    }
                  }}
                >
                  {isAr ? 'حذف الكتاب' : 'Delete book'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ READING (now) ============================ */}
      {activeTab === 'reading' && (
        <div className="space-y-[var(--sp-4)]">
          {activeBook ? (
            <StudioSection title={isAr ? 'الكتاب الجاري' : 'Current book'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-14 rounded-[var(--r-sm)] shrink-0" style={{ background: activeBook.coverColor || COVER_PALETTE[0] }} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">{activeBook.title}</p>
                    <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] truncate">{activeBook.author}</p>
                  </div>
                </div>
                <span className="text-[var(--fs-xs)] font-mono text-[var(--studio-accent)] font-[var(--fw-bold)]">
                  {activeBook.currentPage}/{activeBook.totalPages}
                </span>
              </div>
            </StudioSection>
          ) : (
            <StudioSection>
              <StudioEmpty
                icon="book"
                title={isAr ? 'لا يوجد كتاب نشط' : 'No active book'}
                description={isAr ? 'اختر كتاباً من المكتبة للبدء.' : 'Pick a book from the library to begin.'}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab('library')}>
                    {isAr ? 'إلى المكتبة' : 'Go to library'}
                  </Button>
                }
              />
            </StudioSection>
          )}

          <StudioSection title={isAr ? 'تسجيل جلسة قراءة' : 'Log a reading session'}>
            <form onSubmit={submitSession} className="grid gap-3 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'الكتاب' : 'Book'}</span>
                <NuqtaSelect value={sessionBookId} onChange={(e) => setSessionBookId(e.target.value)} className="text-[var(--fs-xs)] font-[var(--fw-semibold)]">

                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.currentPage}/{b.totalPages})
                    </option>
                  ))}
                </NuqtaSelect>
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'عدد الصفحات' : 'Pages read'}</span>
                <input type="number" min={1} value={pagesInput} onChange={(e) => setPagesInput(Number(e.target.value))} className="input w-full font-mono tabular-nums" required />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'المدة (دقائق)' : 'Minutes'}</span>
                <input type="number" min={1} value={minutesInput} onChange={(e) => setMinutesInput(Number(e.target.value))} className="input w-full font-mono tabular-nums" required />
              </label>
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'ملاحظات الجلسة' : 'Session notes'}</span>
                <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={2} className="textarea w-full text-[var(--fs-xs)]" />
              </label>
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'اقتباس من الجلسة (اختياري)' : 'Quote from this session (optional)'}</span>
                <textarea value={capturedQuote} onChange={(e) => setCapturedQuote(e.target.value)} rows={2} className="textarea w-full text-[var(--fs-xs)]" placeholder={isAr ? 'اقتباس مؤثر…' : 'A passage worth keeping…'} />
              </label>
              <div className="sm:col-span-2 flex items-center justify-between">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] font-mono">
                  {isAr ? 'السرعة' : 'Pace'}: {Math.round((pagesInput / Math.max(5, minutesInput)) * 60)} {isAr ? 'ص/س' : 'p/h'}
                </span>
                <Button variant="primary" size="sm" type="submit" icon="check">
                  {isAr ? 'حفظ الجلسة' : 'Save session'}
                </Button>
              </div>
            </form>
          </StudioSection>
        </div>
      )}

      {/* ============================ JOURNAL ============================ */}
      {activeTab === 'journal' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-3">
            <StudioStat label={isAr ? 'جلسات مسجلة' : 'Sessions logged'} value={sessions.length} icon="history" />
            <StudioStat label={isAr ? 'إجمالي الصفحات' : 'Total pages'} value={readingData.totalPagesRead.toLocaleString()} tone="accent" />
            <StudioStat label={isAr ? 'اقتباسات' : 'Quotes kept'} value={quotes.length} />
          </div>

          <StudioSection title={isAr ? 'يوميات الجلسات' : 'Session journal'}>
            {sessions.length === 0 ? (
              <StudioEmpty icon="book-open" title={isAr ? 'لا توجد جلسات بعد' : 'No sessions yet'} />
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="studio-tile">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">{s.bookTitle}</p>
                        <p className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                          {s.date} · {s.pagesRead} {isAr ? 'ص' : 'p'} · {s.durationMinutes}m · {s.speedPagesPerHour} {isAr ? 'ص/س' : 'p/h'}
                        </p>
                      </div>
                      {s.quoteSnippet && <span className="text-[var(--studio-accent)]"><NuqtaIcon name="quote" className="w-3.5 h-3.5" /></span>}
                    </div>
                    {s.notes && <p className="text-[var(--fs-xs)] text-[var(--text-tertiary)] italic mt-1">“{s.notes}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>

          <StudioSection
            title={isAr ? 'مكتبة الاقتباسات' : 'Quote library'}
            action={
              <span className="text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">{quotes.length}</span>
            }
          >
            {quotes.length === 0 ? (
              <StudioEmpty icon="quote" title={isAr ? 'لا توجد اقتباسات بعد' : 'No quotes yet'} description={isAr ? 'التقط الاقتباسات أثناء تسجيل الجلسات.' : 'Capture quotes while logging sessions.'} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {quotes.map((q) => (
                  <blockquote key={q.id} className="studio-tile flex flex-col justify-between gap-2">
                    <p className="text-[var(--fs-sm)] text-[var(--text-primary)] italic leading-relaxed">“{q.quote}”</p>
                    <footer className="flex items-center justify-between gap-2 text-[var(--fs-micro)] text-[var(--text-tertiary)]">
                      <span>
                        {q.author}
                        {q.bookTitle ? ` · ${q.bookTitle}` : ''}
                        {q.page ? ` (${isAr ? 'ص' : 'p.'} ${q.page})` : ''}
                      </span>
                      <button
                        type="button"
                        aria-label={isAr ? 'حذف الاقتباس' : 'Delete quote'}
                        className="text-[var(--text-tertiary)] hover:text-[var(--state-danger)]"
                        onClick={() => deleteBookQuote(readingHabit.id, q.id)}
                      >
                        ×
                      </button>
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </StudioSection>
        </div>
      )}

      {/* ============================ INSIGHTS ============================ */}
      {activeTab === 'insights' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-4">
            <StudioStat label={isAr ? 'صفحات اليوم' : 'Pages today'} value={pagesReadToday} hint={`/ ${readingData.dailyTargetPages || 20}`} tone="accent" />
            <StudioStat label={isAr ? 'صفحات الأسبوع' : 'Pages this week'} value={pagesThisWeek} hint={`/ ${readingData.weeklyTargetPages || 140}`} />
            <StudioStat label={isAr ? 'كتب مكتملة' : 'Books finished'} value={completedBooks.length} hint={`/ ${readingData.annualTargetBooks}`} />
            <StudioStat label={isAr ? 'متوسط السرعة' : 'Avg. pace'} value={`${avgSpeed}`} hint={isAr ? 'ص/س' : 'pages/hr'} />
          </div>

          <StudioSection title={isAr ? 'القراءة هذا الأسبوع' : 'Reading this week'}>
            <StudioBars data={weekBars} unit={isAr ? 'صفحة' : 'pages'} />
          </StudioSection>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-2">
            <StudioSection title={isAr ? 'قيد القراءة' : 'Currently reading'}>
              {readingBooks.length === 0 ? (
                <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">{isAr ? 'لا يوجد.' : 'None.'}</p>
              ) : (
                <ul className="space-y-2">
                  {readingBooks.map((b) => {
                    const p = Math.min(100, Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100));
                    return (
                      <li key={b.id} className="text-[var(--fs-xs)]">
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--text-primary)] truncate">{b.title}</span>
                          <span className="font-mono text-[var(--text-secondary)]">{p}%</span>
                        </div>
                        <div className="book-progress-track">
                          <div className="book-progress-fill" style={{ width: `${p}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </StudioSection>

            <StudioSection title={isAr ? 'أهداف القراءة' : 'Reading targets'}>
              <form onSubmit={saveTargets} className="grid gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <label className="field">
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'يومي' : 'Daily'}</span>
                    <input type="number" min={1} value={tempDailyPages} onChange={(e) => setTempDailyPages(Number(e.target.value))} className="input w-full font-mono tabular-nums" />
                  </label>
                  <label className="field">
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'أسبوعي' : 'Weekly'}</span>
                    <input type="number" min={1} value={tempWeeklyPages} onChange={(e) => setTempWeeklyPages(Number(e.target.value))} className="input w-full font-mono tabular-nums" />
                  </label>
                  <label className="field">
                    <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'سنوي' : 'Annual'}</span>
                    <input type="number" min={1} value={tempAnnualBooks} onChange={(e) => setTempAnnualBooks(Number(e.target.value))} className="input w-full font-mono tabular-nums" />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--fs-micro)] text-[var(--text-secondary)]">
                    {isAr ? 'كتب سنوية' : 'books / year'}
                  </span>
                  <Button variant="secondary" size="sm" type="submit">
                    {isAr ? 'حفظ الأهداف' : 'Save targets'}
                  </Button>
                </div>
              </form>
              {targetsSaved && (
                <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
                  {isAr ? 'تم الحفظ.' : 'Saved.'}
                </p>
              )}
            </StudioSection>
          </div>
        </div>
      )}

      {/* book editor modal */}
      <Modal
        open={isNewBook || !!editing}
        onClose={() => {
          setIsNewBook(false);
          setEditing(null);
        }}
        title={isNewBook ? (isAr ? 'إضافة كتاب' : 'Add book') : isAr ? 'تعديل الكتاب' : 'Edit book'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsNewBook(false); setEditing(null); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={(e) => saveBook(e as never)}>
              {isAr ? 'حفظ' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveBook} className="space-y-3">
          <Field label={isAr ? 'عنوان الكتاب' : 'Title'} htmlFor="bk-title" required>
            <Input id="bk-title" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} invalid={!bookTitle.trim() && !!bookError} autoFocus />
          </Field>
          <Field label={isAr ? 'المؤلف' : 'Author'} htmlFor="bk-author">
            <Input id="bk-author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isAr ? 'إجمالي الصفحات' : 'Total pages'} htmlFor="bk-total" required>
              <Input id="bk-total" type="number" min={1} value={bookTotalPages} onChange={(e) => setBookTotalPages(Number(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label={isAr ? 'الصفحة الحالية' : 'Current page'} htmlFor="bk-current">
              <Input id="bk-current" type="number" min={0} value={bookCurrentPage} onChange={(e) => setBookCurrentPage(Number(e.target.value))} className="tabular-nums" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isAr ? 'الحالة' : 'Status'} htmlFor="bk-status">
              <NuqtaSelect id="bk-status" value={bookStatus} onChange={(e) => setBookStatus(e.target.value as BookItem['status'])}>
                <option value="reading">{isAr ? 'أقرأ حالياً' : 'Currently reading'}</option>
                <option value="want_to_read">{isAr ? 'أرغب بقراءته' : 'Want to read'}</option>
                <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
              </NuqtaSelect>
            </Field>
            <Field label={isAr ? 'التصنيف' : 'Category'} htmlFor="bk-cat">
              <NuqtaSelect id="bk-cat" value={bookCategory} onChange={(e) => setBookCategory(e.target.value as BookCategory)}>
                {(['mind', 'philosophy', 'productivity', 'science', 'literature', 'biography', 'business', 'other'] as BookCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c, isAr)}
                  </option>
                ))}
              </NuqtaSelect>
            </Field>
          </div>
          <Field label={isAr ? 'لون الغلاف' : 'Cover colour'} htmlFor="bk-color">
            <div className="flex flex-wrap gap-2">
              {COVER_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={bookColor === c}
                  onClick={() => setBookColor(c)}
                  className="w-8 h-8 rounded-[var(--r-sm)] border-2"
                  style={{ background: c, borderColor: bookColor === c ? 'var(--text-primary)' : 'transparent' }}
                />
              ))}
            </div>
          </Field>
          <Field label={isAr ? 'ملاحظات' : 'Notes'} htmlFor="bk-notes">
            <Textarea id="bk-notes" rows={2} value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} />
          </Field>
          {bookError && (
            <p role="alert" className="text-[var(--fs-xs)] text-[var(--state-danger)]">
              {bookError}
            </p>
          )}
        </form>
      </Modal>
    </StudioFrame>
  );
};
