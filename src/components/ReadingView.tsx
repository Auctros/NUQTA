import { localDateKey, parseDateKey } from '../lib/dateKey';
import React, { useEffect, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { BookItem, BookCategory } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { Button, Field, Input, Modal, Select, StudioShell, TabBar, Toast } from './ui';

const STUDIO_TABS = [
  { id: 'dashboard', ar: 'لوحة القراءة', en: 'Reading Dashboard' },
  { id: 'session', ar: 'تسجيل جلسة', en: 'Log Session' },
  { id: 'library', ar: 'خزانة ومكتبة الكتب', en: 'Book Vault' },
  { id: 'quotes', ar: 'بنك الاقتباسات', en: 'Quotes Bank' },
  { id: 'targets', ar: 'الأهداف والإيقاع', en: 'Targets & Pace' }
];

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

  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRequest || focusRequest.domain !== 'reading') return;
    const id = focusRequest.entityId;
    setActiveTab('library');
    setLibraryFilter('all');
    setFocusedEntityId(id);
    consumeFocus();
    window.setTimeout(() => {
      document.getElementById('book-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    const timer = window.setTimeout(() => setFocusedEntityId(null), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const readingHabit = habits.find((h) => h.specializedType === 'reading');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'library' | 'quotes' | 'targets'>('dashboard');

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

  // Active book
  const activeBook =
    readingData.books.find((b) => b.id === readingData.activeBookId) ||
    readingData.books.find((b) => b.status === 'reading') ||
    readingData.books[0];

  // Session logger state
  const [sessionBookId, setSessionBookId] = useState<string>(activeBook?.id || '');
  const [pagesInput, setPagesInput] = useState<number>(20);
  const [minutesInput, setMinutesInput] = useState<number>(30);
  const [sessionNotes, setSessionNotes] = useState('');
  const [capturedQuote, setCapturedQuote] = useState('');
  const [capturedQuotePage, setCapturedQuotePage] = useState<number | ''>('');
  const [showLogSuccess, setShowLogSuccess] = useState(false);

  // Library state & filters
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'reading' | 'completed' | 'want_to_read' | 'archived'>('all');
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookCategory, setBookCategory] = useState<BookCategory>('productivity');
  const [bookTotalPages, setBookTotalPages] = useState<number>(300);
  const [bookCurrentPage, setBookCurrentPage] = useState<number>(0);
  const [bookStatus, setBookStatus] = useState<BookItem['status']>('reading');
  const [bookRating, setBookRating] = useState<number>(5);
  const [bookNotes, setBookNotes] = useState('');
  const [bookCoverColor, setBookCoverColor] = useState('#d97706');
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookToast, setBookToast] = useState<string | null>(null);

  // Target editing state
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [tempDailyPages, setTempDailyPages] = useState(readingData.dailyTargetPages || 20);
  const [tempWeeklyPages, setTempWeeklyPages] = useState(readingData.weeklyTargetPages || 140);
  const [tempAnnualBooks, setTempAnnualBooks] = useState(readingData.annualTargetBooks || 24);

  // New quote standalone state
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
  const [newQuoteBook, setNewQuoteBook] = useState('');
  const [newQuotePage, setNewQuotePage] = useState<number | ''>('');

  // Target book calculations
  const targetBook = readingData.books.find((b) => b.id === (sessionBookId || activeBook?.id)) || activeBook;
  const activeProgress = targetBook
    ? Math.min(100, Math.round((targetBook.currentPage / Math.max(1, targetBook.totalPages)) * 100))
    : 0;
  const pagesLeft = targetBook ? Math.max(0, targetBook.totalPages - targetBook.currentPage) : 0;

  // Reading Speed & Analytics
  const avgSpeed =
    readingData.sessions.length > 0
      ? Math.round(
          readingData.sessions.reduce((acc, s) => acc + (s.speedPagesPerHour || 35), 0) / readingData.sessions.length
        )
      : 40;
  const estMinutesToFinish = Math.round((pagesLeft / Math.max(15, avgSpeed)) * 60);

  // Targets progress calculations
  const pagesReadToday = readingData.sessions
    .filter((s) => s.date === todayStr)
    .reduce((acc, s) => acc + s.pagesRead, 0);

  const past7DaysStart = new Date();
  past7DaysStart.setDate(past7DaysStart.getDate() - 7);
  const pagesReadThisWeek = readingData.sessions
    .filter((s) => (parseDateKey(s.date) ?? new Date(s.date)) >= past7DaysStart)
    .reduce((acc, s) => acc + s.pagesRead, 0);

  const completedBooks = readingData.books.filter((b) => b.status === 'completed');
  const readingBooks = readingData.books.filter((b) => b.status === 'reading');
  const wishlistBooks = readingData.books.filter((b) => b.status === 'want_to_read');

  const filteredBooks = readingData.books.filter((b) => {
    if (libraryFilter === 'all') return b.status !== 'archived';
    return b.status === libraryFilter;
  });

  const handleInitReadingHabit = () => {
    createHabit({
      name: isAr ? 'قراءة 20 صفحة يومياً' : 'Read 20 Pages Daily',
      anchor: isAr ? 'بعد شرب القهوة صباحاً -> أفتح كتابي' : 'After morning coffee -> open book',
      category: 'mind',
      timeOfDay: 'morning',
      specializedType: 'reading'
    });
  };

  const handleLogSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit || !targetBook) return;

    const speed = Math.round((pagesInput / Math.max(5, minutesInput)) * 60);

    logReadingSession(readingHabit.id, {
      bookId: targetBook.id,
      bookTitle: targetBook.title,
      pagesRead: Number(pagesInput),
      durationMinutes: Number(minutesInput),
      speedPagesPerHour: speed,
      notes: sessionNotes.trim() || undefined,
      quoteSnippet: capturedQuote.trim() || undefined
    });

    if (capturedQuote.trim()) {
      addBookQuote(readingHabit.id, {
        quote: capturedQuote.trim(),
        bookId: targetBook.id,
        bookTitle: targetBook.title,
        author: targetBook.author,
        page: typeof capturedQuotePage === 'number' ? capturedQuotePage : undefined
      });
    }

    setShowLogSuccess(true);
    setCapturedQuote('');
    setCapturedQuotePage('');
    setSessionNotes('');
    setTimeout(() => {
      setShowLogSuccess(false);
      setActiveTab('dashboard');
    }, 1800);
  };

  const handleOpenAddBook = () => {
    setEditingBookId(null);
    setBookTitle('');
    setBookAuthor('');
    setBookCategory('productivity');
    setBookTotalPages(300);
    setBookCurrentPage(0);
    setBookStatus('reading');
    setBookRating(5);
    setBookNotes('');
    setBookCoverColor('#d97706');
    setBookError(null);
    setIsEditingBook(true);
  };

  const handleEditBook = (book: BookItem) => {
    setEditingBookId(book.id);
    setBookTitle(book.title || '');
    setBookAuthor(book.author || '');
    setBookCategory(book.category || 'productivity');
    setBookTotalPages(book.totalPages || 1);
    setBookCurrentPage(book.currentPage || 0);
    setBookStatus(book.status);
    setBookRating(book.rating || 5);
    setBookNotes(book.notes || '');
    setBookCoverColor(book.coverColor || '#d97706');
    setBookError(null);
    setIsEditingBook(true);
  };

  const handleCancelBook = () => {
    setIsEditingBook(false);
    setBookError(null);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit) return;

    const title = bookTitle.trim();
    const total = Number(bookTotalPages);
    const current = Number(bookCurrentPage);

    if (!title) {
      setBookError(isAr ? 'عنوان الكتاب مطلوب.' : 'Book title is required.');
      return;
    }
    if (!Number.isFinite(total) || total < 1) {
      setBookError(isAr ? 'عدد الصفحات يجب أن يكون 1 على الأقل.' : 'Total pages must be at least 1.');
      return;
    }
    if (!Number.isFinite(current) || current < 0 || current > total) {
      setBookError(
        isAr
          ? 'الصفحة الحالية يجب أن تكون بين 0 وإجمالي الصفحات.'
          : 'Current page must be between 0 and the total pages.'
      );
      return;
    }

    addOrUpdateBook(readingHabit.id, {
      id: editingBookId || 'book-' + crypto.randomUUID().slice(0, 8),
      title,
      author: bookAuthor.trim() || (isAr ? 'مؤلف غير محدد' : 'Unknown Author'),
      category: bookCategory,
      totalPages: total,
      currentPage: current,
      status: bookStatus,
      rating: Number(bookRating),
      notes: bookNotes.trim() || undefined,
      coverColor: bookCoverColor,
      startDate: bookStatus === 'reading' ? todayStr : undefined
    });

    setIsEditingBook(false);
    setBookError(null);
    const msg = editingBookId
      ? isAr
        ? 'تم تحديث بيانات الكتاب.'
        : 'Book updated successfully.'
      : isAr
      ? 'تمت إضافة الكتاب إلى الخزانة.'
      : 'Book added to your vault.';
    setBookToast(msg);
    window.setTimeout(() => setBookToast(null), 3000);
  };

  const handleSaveStandaloneQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingHabit || !newQuoteText.trim()) return;

    addBookQuote(readingHabit.id, {
      quote: newQuoteText.trim(),
      author: newQuoteAuthor.trim() || undefined,
      bookTitle: newQuoteBook.trim() || undefined,
      page: typeof newQuotePage === 'number' ? newQuotePage : undefined
    });

    setNewQuoteText('');
    setNewQuoteAuthor('');
    setNewQuoteBook('');
    setNewQuotePage('');
    setIsAddingQuote(false);
  };

  if (!readingHabit) {
    return (
      <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="page-heading">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="line"></span>
              <span className="font-mono text-[var(--d-reading-accent)]">NUQTA / READING SANCTUARY</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
              {isAr ? 'استوديو وخزانة القراءة' : 'Reading Sanctuary & Book Vault'}
            </h1>
            <p className="text-sm text-muted">
              {isAr ? 'نظام متكامل لتتبع قراءة الكتب، وحساب سرعة الاستيعاب، وحفظ الاقتباسات الملهمة.' : 'Track reading volume, reading velocity, and book quotes.'}
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl border border-amber-500/30 bg-[var(--d-reading-raised)] text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-[var(--d-reading-accent)] flex items-center justify-center text-3xl mx-auto border border-amber-500/30">
            📖
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'ابدأ خزانة القراءة الخاصة بك' : 'Initialize Your Reading Sanctuary'}
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            {isAr
              ? 'مكتبة كاملة، ومسجل جلسات يحسب سرعتك تلقائياً، وبنك للاقتباسات الخالدة.'
              : 'Autonomous reading engine with velocity trackers, quotes sanctuary, and annual cadence.'}
          </p>
          <button
            onClick={handleInitReadingHabit}
            className="btn primary px-6 py-2.5 text-sm font-bold shadow-lg"
          >
            <span>+</span>
            <span>{isAr ? 'تفعيل استوديو القراءة الآن' : 'Enable Reading Sanctuary'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <StudioShell
      eyebrow="NUQTA / READING SANCTUARY"
      title={isAr ? 'استوديو وخزانة القراءة' : 'Reading Sanctuary & Book Vault'}
      description={
        isAr
          ? 'تتبع عميق للكتب، سرعة القراءة بالصفحة في الساعة، وبنك الاقتباسات المحفورة.'
          : 'Deep reading studio tracking volume, reading velocity, and reflective quotes.'
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('session')}
            className="btn primary small text-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isAr ? 'تسجيل جلسة قراءة' : 'Log Reading Session'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle small text-xs flex items-center gap-1.5"
            title={isAr ? 'فتح أرشيف وسجل القراءة الشامل' : 'Open Reading Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('habits')}
            className="btn subtle small text-xs"
          >
            <span>{isAr ? 'كل العادات' : 'All Habits'}</span>
            <span>→</span>
          </button>
        </div>
      }
      meta={
        <>

      {/* 2. Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Pages Read */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--d-reading-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الصفحات المنجزة' : 'Pages Read'}</span>
            <span className="text-[var(--d-reading-accent)] text-xs">📖</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--d-reading-accent)]">
              {readingData.totalPagesRead.toLocaleString()}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'ص' : 'pages'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            ~{Math.round(readingData.totalReadingMinutes / 60)} {isAr ? 'ساعات قراءة' : 'reading hours'}
          </span>
        </div>

        {/* Books Finished */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--d-reading-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الكتب المكتملة' : 'Finished Books'}</span>
            <span className="text-[var(--d-reading-accent)] text-xs">📚</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {completedBooks.length}
            </strong>
            <span className="text-xs text-muted font-mono">/ {readingData.annualTargetBooks}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {readingBooks.length} {isAr ? 'قيد القراءة حالياً' : 'in progress'}
          </span>
        </div>

        {/* Today's Reading */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--d-reading-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'قراءة اليوم' : 'Read Today'}</span>
            <span className="text-[var(--state-success)] text-xs">✓</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--state-success)]">
              {pagesReadToday}
            </strong>
            <span className="text-xs text-muted font-mono">/ {readingData.dailyTargetPages || 20} {isAr ? 'ص' : 'p'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {isAr ? 'الهدف الأسبوعي:' : 'Week:'} {pagesReadThisWeek}/{readingData.weeklyTargetPages || 140} {isAr ? 'ص' : 'p'}
          </span>
        </div>

        {/* Reading Speed */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--d-reading-surface)] space-y-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'سرعة الاستيعاب' : 'Average Pace'}</span>
            <span className="text-accent text-xs">⚡</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-accent">
              {avgSpeed}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'ص/س' : 'pages/hr'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {estMinutesToFinish > 0 ? `~${estMinutesToFinish}m ${isAr ? 'لختم الكتاب' : 'to finish'}` : (isAr ? 'مكتمل' : 'Completed')}
          </span>
        </div>

        {/* Quotes Bank Count */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--d-reading-surface)] space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[var(--fs-xs)] text-muted block flex items-center justify-between">
            <span>{isAr ? 'بنك الاقتباسات' : 'Quote Sanctuary'}</span>
            <span className="text-[var(--state-purple)] text-xs">💬</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--state-purple)]">
              {(readingData.quotes || []).length}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'اقتباس' : 'quotes'}</span>
          </div>
          <span className="text-[var(--fs-micro)] text-muted block">
            {readingHabit.currentStreak || 0} {isAr ? 'يوم سلسلة متصلة' : 'days streak'}
          </span>
        </div>
      </div>

        </>
      }
      tabs={STUDIO_TABS.map((t) => ({ id: t.id, label: isAr ? t.ar : t.en }))}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as any)}
    >

      {/* =========================================================================
          TAB 1: DASHBOARD
         ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Book Showcase Card */}
            {activeBook ? (
              <div className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[var(--d-reading-raised)] via-[var(--d-reading-surface)] to-[var(--d-reading-deep)] space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-16 rounded-lg flex items-center justify-center text-[var(--text-primary)] font-bold text-lg shadow-md shrink-0 border border-amber-500/30"
                      style={{ backgroundColor: activeBook.coverColor || '#d97706' }}
                    >
                      📖
                    </div>
                    <div>
                      <span className="text-[var(--fs-micro)] font-mono tracking-wider text-[var(--d-reading-accent)] uppercase block">
                        {isAr ? 'الكتاب الجاري قراءته حالياً' : 'ACTIVE BOOK'}
                      </span>
                      <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)] truncate max-w-md">
                        {activeBook.title}
                      </h2>
                      <span className="text-xs text-muted block mt-0.5">
                        {activeBook.author} · {activeBook.totalPages} {isAr ? 'صفحة' : 'pages'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSessionBookId(activeBook.id);
                      setActiveTab('session');
                    }}
                    className="btn primary small text-xs flex items-center gap-1"
                  >
                    <span>▶</span>
                    <span>{isAr ? 'تسجيل قراءة' : 'Log Reading'}</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{isAr ? 'التقدم في الكتاب:' : 'Progress:'}</span>
                    <span className="font-mono text-[var(--d-reading-accent-strong)] font-bold">
                      {activeBook.currentPage} / {activeBook.totalPages} {isAr ? 'صفحة' : 'pages'} ({activeProgress}%)
                    </span>
                  </div>
                  <div className="w-full bg-[var(--d-reading-chip)] h-2 rounded-full overflow-hidden border border-[var(--d-reading-border-accent)]">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${activeProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[var(--fs-xs)] text-muted">
                    <span>{pagesLeft} {isAr ? 'صفحة متبقية' : 'pages left'}</span>
                    <span>~{estMinutesToFinish} {isAr ? 'دقيقة لختم الكتاب' : 'mins to finish'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-amber-500/30 text-center text-xs text-muted">
                {isAr ? 'لا يوجد كتاب نشط حالياً. اختر أو أضف كتاباً من خزانة الكتب.' : 'No active book selected.'}
              </div>
            )}

            {/* Recent Reading Sessions */}
            <div className="p-5 rounded-2xl border border-[var(--d-reading-border)] bg-[var(--d-reading-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-reading-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📖</span>
                  <span>{isAr ? 'جلسات القراءة الأخيرة' : 'Recent Reading Sessions'}</span>
                </h3>
                <button onClick={() => setActiveTab('session')} className="text-link text-xs">
                  <span>{isAr ? 'تسجيل جلسة جديدة' : 'New session'}</span>
                  <span>→</span>
                </button>
              </div>

              {readingData.sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--d-reading-border)] rounded-xl">
                  {isAr ? 'لا توجد جلسات قراءة مسجلة بعد. ابدأ اليوم بـ 15 صفحة هادئة.' : 'No sessions recorded yet.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {readingData.sessions.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-[var(--d-reading-border-soft)] bg-[var(--d-reading-raised)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-[var(--text-primary)] block truncate">{s.bookTitle}</strong>
                        <span className="text-[var(--fs-xs)] text-muted flex items-center gap-2 mt-0.5 font-mono">
                          <span>{s.date}</span>
                          <span>· {s.pagesRead} {isAr ? 'ص' : 'pages'}</span>
                          <span>· {s.durationMinutes}m</span>
                          <span>· {s.speedPagesPerHour} {isAr ? 'ص/س' : 'p/h'}</span>
                        </span>
                        {s.notes && <p className="text-[var(--fs-xs)] text-muted/80 mt-1 italic">"{s.notes}"</p>}
                      </div>
                      <span className="text-[var(--d-reading-accent)] font-mono font-bold text-xs">
                        +{s.pagesRead} {isAr ? 'ص' : 'p'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quotes Teaser & Books In Progress */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-[var(--d-reading-border)] bg-[var(--d-reading-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-reading-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📚</span>
                  <span>{isAr ? 'قائمة القراءة' : 'Reading List'}</span>
                </h3>
                <button onClick={() => setActiveTab('library')} className="text-link text-xs">
                  <span>{isAr ? 'المكتبة الكاملة' : 'Full Vault'}</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-2">
                {readingData.books.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (readingHabit) setActiveBook(readingHabit.id, b.id);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                      b.id === activeBook?.id
                        ? 'border-amber-400 bg-amber-500/10 text-[var(--text-primary)] font-bold'
                        : 'border-[var(--d-reading-border-soft)] bg-[var(--d-reading-deep)] text-muted hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[var(--text-primary)]">{b.title}</strong>
                      <span className="text-[var(--fs-micro)] text-muted">{b.author}</span>
                    </div>
                    <span className="font-mono text-[var(--d-reading-accent)] text-xs shrink-0">
                      {Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Random Quote Card */}
            {readingData.quotes && readingData.quotes.length > 0 && (
              <div className="p-4 rounded-xl border border-purple-500/30 bg-[var(--d-reading-raised)] space-y-2 text-xs">
                <span className="text-[var(--state-purple)] font-bold block flex items-center gap-1.5">
                  <span>💬</span>
                  <span>{isAr ? 'شذرة من خزانة الاقتباسات' : 'Sanctuary Quote'}</span>
                </span>
                <p className="text-[var(--text-primary)] italic leading-relaxed text-[var(--fs-xs)]">
                  "{readingData.quotes[0].quote}"
                </p>
                <div className="flex justify-between text-[var(--fs-micro)] text-[var(--state-purple)] pt-1 border-t border-purple-500/20 font-mono">
                  <span>{readingData.quotes[0].author || (isAr ? 'مؤلف' : 'Author')}</span>
                  {readingData.quotes[0].page && <span>{isAr ? 'صفحة' : 'Page'} {readingData.quotes[0].page}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LOG READING SESSION
         ========================================================================= */}
      {activeTab === 'session' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-amber-500/30 bg-[var(--d-reading-surface)] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--d-reading-border)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>✍️</span>
                <span>{isAr ? 'تسجيل جلسة قراءة جديدة' : 'Log Reading Session'}</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isAr ? 'يحسب الاستوديو تلقائياً سرعتك في القراءة ويحدّث صفحات الكتاب المتبقية.' : 'Automatically calculates speed and updates your current page.'}
              </p>
            </div>
            <button onClick={() => setActiveTab('dashboard')} className="text-muted hover:text-[var(--text-primary)] text-sm">
              ✕
            </button>
          </div>

          {showLogSuccess && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-[var(--d-reading-chip)] text-[var(--state-success-strong)] text-xs">
              {isAr ? 'تم تسجيل جلسة القراءة وتحديث إنجاز اليوم بنجاح!' : 'Reading session recorded successfully!'}
            </div>
          )}

          <form onSubmit={handleLogSessionSubmit} className="space-y-4">
            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'الكتاب المقروء:' : 'Select Book:'}</label>
              <select
                className="select w-full text-xs font-semibold"
                value={sessionBookId}
                onChange={(e) => setSessionBookId(e.target.value)}
              >
                {readingData.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.currentPage}/{b.totalPages} {isAr ? 'ص' : 'pages'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'عدد الصفحات المقروءة:' : 'Pages Read:'}</label>
                <input
                  type="number"
                  min={1}
                  value={pagesInput}
                  onChange={(e) => setPagesInput(Number(e.target.value))}
                  className="input w-full font-mono text-xs font-bold text-[var(--d-reading-accent)]"
                  required
                />
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مدة الجلسة (دقائق):' : 'Duration (minutes):'}</label>
                <input
                  type="number"
                  min={1}
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(Number(e.target.value))}
                  className="input w-full font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'اقتباس مميز لفت انتباهك (اختياري):' : 'Memorable Quote (optional):'}</label>
              <textarea
                value={capturedQuote}
                onChange={(e) => setCapturedQuote(e.target.value)}
                placeholder={isAr ? 'اكتب عبارة أو فقرة أثرت فيك لتُحفظ في بنك الاقتباسات...' : 'Capture an impactful sentence...'}
                className="textarea w-full text-xs"
                rows={2}
              />
            </div>

            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'ملاحظات وتأملات سريعة:' : 'Reflective notes:'}</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder={isAr ? 'أهم الأفكار التي خرجت بها من هذه الصفحات...' : 'Key takeaways...'}
                className="input w-full text-xs"
              />
            </div>

            <div className="pt-3 border-t border-[var(--d-reading-border)] flex justify-end gap-2">
              <button type="button" onClick={() => setActiveTab('dashboard')} className="btn subtle small text-xs">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="btn primary small text-xs px-5 py-2 font-bold">
                <span>✓</span>
                <span>{isAr ? 'حفظ الجلسة والإنجاز' : 'Save Session'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: BOOK VAULT & LIBRARY
         ========================================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted text-[var(--fs-xs)]">{isAr ? 'الحالة:' : 'Filter:'}</span>
              {(['all', 'reading', 'completed', 'want_to_read'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLibraryFilter(filter)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    libraryFilter === filter
                      ? 'bg-amber-500 text-black font-bold'
                      : 'bg-[var(--d-reading-raised)] text-muted hover:text-[var(--text-primary)] border border-[var(--d-reading-border-strong)]'
                  }`}
                >
                  {filter === 'all'
                    ? (isAr ? 'الكل' : 'All')
                    : filter === 'reading'
                    ? (isAr ? 'أقرأ حالياً' : 'Reading')
                    : filter === 'completed'
                    ? (isAr ? 'اكتملت' : 'Completed')
                    : (isAr ? 'قائمة الرغبات' : 'Want to Read')}
                </button>
              ))}
            </div>

            <button onClick={handleOpenAddBook} className="btn primary small text-xs">
              + {isAr ? 'إضافة كتاب جديد' : 'Add Book'}
            </button>
          </div>

          {/* Book Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBooks.map((b) => {
              const progress = Math.min(100, Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100));
              return (
                <div
                  key={b.id}
                  id={'book-' + b.id}
                  className={`p-4 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-deep)] flex flex-col justify-between gap-3 ${
                    focusedEntityId === b.id ? 'focus-flash' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        className="w-10 h-14 rounded-md flex items-center justify-center text-[var(--text-primary)] font-bold text-xs shrink-0"
                        style={{ backgroundColor: b.coverColor || '#d97706' }}
                      >
                        📖
                      </div>
                      <div className="min-w-0">
                        <strong className="text-xs text-[var(--text-primary)] block truncate">{b.title}</strong>
                        <span className="text-[var(--fs-xs)] text-muted block truncate">{b.author}</span>
                        <span className="text-[var(--fs-micro)] text-[var(--d-reading-accent)] font-mono mt-0.5 block">
                          {b.currentPage} / {b.totalPages} {isAr ? 'ص' : 'p'} ({progress}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-[var(--d-reading-chip)] h-1.5 rounded-full overflow-hidden my-2">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--d-reading-border-soft)] flex items-center justify-between text-[var(--fs-xs)]">
                    <button
                      onClick={() => {
                        if (readingHabit) setActiveBook(readingHabit.id, b.id);
                      }}
                      className="text-[var(--d-reading-accent)] hover:underline font-medium text-xs"
                    >
                      {b.id === activeBook?.id ? (isAr ? 'الكتاب النشط ✓' : 'Active ✓') : (isAr ? 'تعيين كنشط' : 'Make Active')}
                    </button>
                    <button
                      onClick={() => handleEditBook(b)}
                      className="text-muted hover:text-[var(--d-reading-accent)] text-xs"
                      aria-label={isAr ? 'تعديل الكتاب' : 'Edit book'}
                      title={isAr ? 'تعديل الكتاب' : 'Edit book'}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => {
                        if (readingHabit && confirm(isAr ? 'حذف الكتاب؟' : 'Delete book?')) {
                          deleteBook(readingHabit.id, b.id);
                        }
                      }}
                      className="text-muted hover:text-[var(--state-danger)]"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Book editor — shared Modal + form controls */}
          <Modal
            open={isEditingBook}
            onClose={handleCancelBook}
            title={editingBookId ? (isAr ? 'تعديل بيانات الكتاب' : 'Edit Book') : (isAr ? 'إضافة كتاب جديد' : 'Add New Book')}
            description={isAr ? 'الحقول المعلّمة بـ * مطلوبة.' : 'Fields marked * are required.'}
            size="sm"
            footer={
              <>
                <Button variant="ghost" size="sm" onClick={handleCancelBook}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" onClick={(e) => handleSaveBook(e as any)}>
                  {editingBookId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ الكتاب' : 'Save Book')}
                </Button>
              </>
            }
          >
            <form onSubmit={handleSaveBook} className="space-y-3">
              <Field label={isAr ? 'عنوان الكتاب' : 'Book Title'} htmlFor="book-title" required>
                <Input
                  id="book-title"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  invalid={!bookTitle.trim() && !!bookError}
                  autoFocus
                  placeholder={isAr ? 'مثال: العادات الذرية' : 'e.g. Atomic Habits'}
                />
              </Field>
              <Field
                label={isAr ? 'المؤلف' : 'Author'}
                htmlFor="book-author"
                hint={isAr ? 'اختياري — يصبح «غير محدد» عند تركه فارغًا.' : 'Optional — becomes Unknown Author when empty.'}
              >
                <Input id="book-author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isAr ? 'إجمالي الصفحات' : 'Total Pages'} htmlFor="book-total" required>
                  <Input
                    id="book-total"
                    type="number"
                    min={1}
                    value={bookTotalPages}
                    onChange={(e) => setBookTotalPages(Number(e.target.value))}
                    className="tabular-nums"
                  />
                </Field>
                <Field label={isAr ? 'الصفحة الحالية' : 'Current Page'} htmlFor="book-current">
                  <Input
                    id="book-current"
                    type="number"
                    min={0}
                    value={bookCurrentPage}
                    onChange={(e) => setBookCurrentPage(Number(e.target.value))}
                    className="tabular-nums"
                  />
                </Field>
              </div>
              <Field label={isAr ? 'حالة القراءة' : 'Status'} htmlFor="book-status">
                <Select id="book-status" value={bookStatus} onChange={(e) => setBookStatus(e.target.value as any)}>
                  <option value="reading">{isAr ? 'أقرأ حالياً' : 'Currently Reading'}</option>
                  <option value="want_to_read">{isAr ? 'قائمة الرغبات' : 'Want to Read'}</option>
                  <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
                </Select>
              </Field>
              {bookError && (
                <p role="alert" className="text-[var(--fs-xs)] font-medium text-[var(--state-danger)]">
                  {bookError}
                </p>
              )}
            </form>
          </Modal>

          <Toast open={!!bookToast} message={bookToast || ''} tone="success" onClose={() => setBookToast(null)} />
        </div>
      )}

      {/* =========================================================================
          TAB 4: QUOTES BANK
         ========================================================================= */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-surface)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)]">
              {isAr ? `إجمالي الاقتباسات المحفوظة: ${(readingData.quotes || []).length}` : `Saved Quotes: ${(readingData.quotes || []).length}`}
            </span>
            <button onClick={() => setIsAddingQuote(true)} className="btn primary small text-xs">
              + {isAr ? 'إضافة اقتباس' : 'Add Quote'}
            </button>
          </div>

          {(!readingData.quotes || readingData.quotes.length === 0) ? (
            <div className="p-8 text-center text-xs text-muted border border-dashed border-[var(--d-reading-border)] rounded-2xl">
              {isAr ? 'لا توجد اقتباسات محفوظة بعد. التقط شذرات الحكمة أثناء القراءة!' : 'No quotes recorded yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {readingData.quotes.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-purple-500/20 bg-[var(--d-reading-raised)] space-y-2 text-xs flex flex-col justify-between"
                >
                  <p className="text-[var(--text-primary)]/95 italic leading-relaxed text-[var(--fs-xs)]">"{q.quote}"</p>
                  <div className="flex items-center justify-between text-[var(--fs-micro)] text-[var(--state-purple)] pt-2 border-t border-purple-500/15">
                    <span>
                      {q.author} {q.bookTitle ? `· ${q.bookTitle}` : ''} {q.page ? `(ص ${q.page})` : ''}
                    </span>
                    <button
                      onClick={() => {
                        if (readingHabit) deleteBookQuote(readingHabit.id, q.id);
                      }}
                      className="text-muted hover:text-[var(--state-danger)]"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingQuote && (
            <div className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="modal w-full max-w-md bg-[var(--d-reading-surface)] border border-[var(--d-reading-border-strong)] rounded-2xl p-6 shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-[var(--text-primary)]">{isAr ? 'تدوين اقتباس جديد' : 'New Quote'}</h3>
                <form onSubmit={handleSaveStandaloneQuote} className="space-y-3 text-xs">
                  <div className="field">
                    <label className="text-muted block mb-1">{isAr ? 'نص الاقتباس:' : 'Quote text:'}</label>
                    <textarea
                      value={newQuoteText}
                      onChange={(e) => setNewQuoteText(e.target.value)}
                      className="textarea w-full text-xs"
                      rows={3}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field">
                      <label className="text-muted block mb-1">{isAr ? 'المؤلف:' : 'Author:'}</label>
                      <input
                        type="text"
                        value={newQuoteAuthor}
                        onChange={(e) => setNewQuoteAuthor(e.target.value)}
                        className="input w-full text-xs"
                      />
                    </div>
                    <div className="field">
                      <label className="text-muted block mb-1">{isAr ? 'الكتاب:' : 'Book:'}</label>
                      <input
                        type="text"
                        value={newQuoteBook}
                        onChange={(e) => setNewQuoteBook(e.target.value)}
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-[var(--d-reading-border)]">
                    <button type="button" onClick={() => setIsAddingQuote(false)} className="btn subtle small text-xs">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" className="btn primary small text-xs">
                      {isAr ? 'حفظ الاقتباس' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: TARGETS & PACE
         ========================================================================= */}
      {activeTab === 'targets' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl border border-amber-500/30 bg-[var(--d-reading-surface)] space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>🎯</span>
            <span>{isAr ? 'أهداف القراءة السنوية والأسبوعية' : 'Reading Targets'}</span>
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (readingHabit) {
                updateReadingTargets(readingHabit.id, {
                  dailyTargetPages: Number(tempDailyPages),
                  weeklyTargetPages: Number(tempWeeklyPages),
                  annualTargetBooks: Number(tempAnnualBooks)
                });
                setIsEditingTargets(true);
                setTimeout(() => setIsEditingTargets(false), 2000);
              }
            }}
            className="space-y-4 text-xs"
          >
            {isEditingTargets && (
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-[var(--d-reading-chip)] text-[var(--state-success-strong)] text-xs">
                {isAr ? 'تم تحديث أهداف القراءة بنجاح!' : 'Targets saved!'}
              </div>
            )}
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'الهدف اليومي (صفحة/يوم):' : 'Daily Pages Target:'}</label>
              <input
                type="number"
                min={1}
                value={tempDailyPages}
                onChange={(e) => setTempDailyPages(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-reading-accent)]"
              />
            </div>
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'الهدف الأسبوعي (صفحة/أسبوع):' : 'Weekly Pages Target:'}</label>
              <input
                type="number"
                min={1}
                value={tempWeeklyPages}
                onChange={(e) => setTempWeeklyPages(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-reading-accent)]"
              />
            </div>
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'الهدف السنوي (كتاب/سنة):' : 'Annual Books Target:'}</label>
              <input
                type="number"
                min={1}
                value={tempAnnualBooks}
                onChange={(e) => setTempAnnualBooks(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-reading-accent)]"
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn primary small text-xs px-5 py-2">
                {isAr ? 'حفظ الأهداف' : 'Save Targets'}
              </button>
            </div>
          </form>
        </div>
      )}
    </StudioShell>
  );
};

