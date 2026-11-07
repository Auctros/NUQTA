import React, { useState } from 'react';
import { Habit, BookItem, BookCategory } from '../types';
import { useNuqtaStore } from '../store/nuqtaStore';

interface ReadingAppModalProps {
  habit: Habit;
  onClose: () => void;
}

export const ReadingAppModal: React.FC<ReadingAppModalProps> = ({ habit, onClose }) => {
  const {
    profile,
    logReadingSession,
    addOrUpdateBook,
    deleteBook,
    setActiveBook,
    addBookQuote,
    deleteBookQuote,
    updateReadingTargets
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  const readingData = habit.readingData || {
    books: [],
    sessions: [],
    quotes: [],
    dailyTargetPages: 20,
    weeklyTargetPages: 140,
    annualTargetBooks: 24,
    totalPagesRead: 0,
    totalReadingMinutes: 0
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'library' | 'quotes'>('dashboard');

  // Active book
  const activeBook = readingData.books.find((b) => b.id === readingData.activeBookId) || readingData.books.find((b) => b.status === 'reading') || readingData.books[0];

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

  // Active book calculations
  const targetBook = readingData.books.find((b) => b.id === (sessionBookId || activeBook?.id)) || activeBook;
  const activeProgress = targetBook
    ? Math.min(100, Math.round((targetBook.currentPage / Math.max(1, targetBook.totalPages)) * 100))
    : 0;
  const pagesLeft = targetBook ? Math.max(0, targetBook.totalPages - targetBook.currentPage) : 0;

  // Reading Speed & Analytics
  const avgSpeed = readingData.sessions.length > 0
    ? Math.round(readingData.sessions.reduce((acc, s) => acc + (s.speedPagesPerHour || 35), 0) / readingData.sessions.length)
    : 40;
  const estMinutesToFinish = Math.round((pagesLeft / Math.max(15, avgSpeed)) * 60);

  // Targets progress calculations
  const pagesReadToday = readingData.sessions
    .filter((s) => s.date === todayStr)
    .reduce((acc, s) => acc + s.pagesRead, 0);

  const past7DaysStart = new Date();
  past7DaysStart.setDate(past7DaysStart.getDate() - 7);
  const pagesReadThisWeek = readingData.sessions
    .filter((s) => new Date(s.date) >= past7DaysStart)
    .reduce((acc, s) => acc + s.pagesRead, 0);

  const completedBooks = readingData.books.filter((b) => b.status === 'completed');
  const readingBooks = readingData.books.filter((b) => b.status === 'reading');
  const wishlistBooks = readingData.books.filter((b) => b.status === 'want_to_read');
  const archivedBooks = readingData.books.filter((b) => b.status === 'archived');

  const filteredBooks = readingData.books.filter((b) => {
    if (libraryFilter === 'all') return b.status !== 'archived';
    return b.status === libraryFilter;
  });

  // Category labels
  const categoryLabels: Record<BookCategory, { ar: string; en: string }> = {
    productivity: { ar: 'الإنتاجية والعادات', en: 'Productivity' },
    philosophy: { ar: 'الفلسفة والفكر', en: 'Philosophy' },
    mind: { ar: 'علم النفس والذهن', en: 'Mind & Psychology' },
    science: { ar: 'العلوم والتقنية', en: 'Science & Tech' },
    literature: { ar: 'الأدب والرواية', en: 'Literature' },
    biography: { ar: 'السير الذاتية', en: 'Biography' },
    business: { ar: 'الريادة والأعمال', en: 'Business' },
    other: { ar: 'معارف عامة', en: 'General' }
  };

  // Handlers
  const handleLogSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBook || pagesInput <= 0) return;

    const speed = minutesInput > 0 ? Math.round((pagesInput / minutesInput) * 60) : pagesInput * 2;
    logReadingSession(habit.id, {
      bookId: targetBook.id,
      bookTitle: targetBook.title,
      pagesRead: Number(pagesInput),
      durationMinutes: Number(minutesInput),
      speedPagesPerHour: speed,
      notes: sessionNotes.trim() || undefined,
      quoteSnippet: capturedQuote.trim() || undefined
    });

    if (capturedQuote.trim()) {
      addBookQuote(habit.id, {
        quote: capturedQuote.trim(),
        bookId: targetBook.id,
        bookTitle: targetBook.title,
        author: targetBook.author,
        page: typeof capturedQuotePage === 'number' ? capturedQuotePage : undefined
      });
      setCapturedQuote('');
      setCapturedQuotePage('');
    }

    setShowLogSuccess(true);
    setSessionNotes('');
    setTimeout(() => {
      setShowLogSuccess(false);
      setActiveTab('dashboard');
    }, 1500);
  };

  const handleOpenBookModal = (bookToEdit?: BookItem) => {
    if (bookToEdit) {
      setEditingBookId(bookToEdit.id);
      setBookTitle(bookToEdit.title);
      setBookAuthor(bookToEdit.author);
      setBookCategory(bookToEdit.category || 'productivity');
      setBookTotalPages(bookToEdit.totalPages);
      setBookCurrentPage(bookToEdit.currentPage);
      setBookStatus(bookToEdit.status);
      setBookRating(bookToEdit.rating || 5);
      setBookNotes(bookToEdit.notes || '');
      setBookCoverColor(bookToEdit.coverColor || '#d97706');
    } else {
      setEditingBookId(null);
      setBookTitle('');
      setBookAuthor('');
      setBookCategory('productivity');
      setBookTotalPages(300);
      setBookCurrentPage(0);
      setBookStatus('reading');
      setBookRating(5);
      setBookNotes('');
      const colors = ['#d97706', '#2563eb', '#059669', '#7c3aed', '#dc2626', '#0891b2'];
      setBookCoverColor(colors[Math.floor(Math.random() * colors.length)]);
    }
    setIsEditingBook(true);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim()) return;

    const bookItem: BookItem = {
      id: editingBookId || 'book-' + crypto.randomUUID().slice(0, 6),
      title: bookTitle.trim(),
      author: bookAuthor.trim() || (isAr ? 'مؤلف غير محدد' : 'Unknown Author'),
      category: bookCategory,
      totalPages: Math.max(1, Number(bookTotalPages)),
      currentPage: Math.min(Number(bookTotalPages), Math.max(0, Number(bookCurrentPage))),
      status: bookStatus,
      rating: bookRating,
      notes: bookNotes.trim() || undefined,
      coverColor: bookCoverColor,
      startDate: bookStatus === 'reading' ? (editingBookId ? targetBook?.startDate || todayStr : todayStr) : undefined,
      completedDate: bookStatus === 'completed' ? todayStr : undefined
    };

    addOrUpdateBook(habit.id, bookItem);
    setIsEditingBook(false);
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    updateReadingTargets(habit.id, {
      dailyTargetPages: Number(tempDailyPages) || 20,
      weeklyTargetPages: Number(tempWeeklyPages) || 140,
      annualTargetBooks: Number(tempAnnualBooks) || 24
    });
    setIsEditingTargets(false);
  };

  const handleSaveStandaloneQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;

    addBookQuote(habit.id, {
      quote: newQuoteText.trim(),
      author: newQuoteAuthor.trim() || activeBook?.author || undefined,
      bookTitle: newQuoteBook.trim() || activeBook?.title || undefined,
      page: typeof newQuotePage === 'number' ? newQuotePage : undefined
    });

    setNewQuoteText('');
    setNewQuoteAuthor('');
    setNewQuoteBook('');
    setNewQuotePage('');
    setIsAddingQuote(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
      <div
        className="panel max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-[var(--d-reading-border-accent)] shadow-2xl bg-[var(--d-reading-surface)]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* ================= HEADER BAR ================= */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[var(--d-reading-accent)] font-bold text-xl shadow-inner">
              📖
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500/20 text-[var(--d-reading-accent-strong)] font-bold">
                  {isAr ? 'نظام القراءة والكتب المستقل' : 'READING ECOSYSTEM & VAULT'}
                </span>
                <span className="text-xs text-muted">· {habit.name}</span>
              </div>
              <h2 className="text-lg font-bold text-[#edf2f4] leading-tight">
                {isAr ? 'واحة القراءة والمكتبة الذكية' : 'Intelligent Reading Sanctuary'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex p-1 rounded-lg bg-[var(--d-reading-surface)] border border-[var(--d-reading-border)]">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'dashboard' ? 'bg-[var(--d-reading-chip)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'الداشبورد والرؤى' : 'Dashboard'}
              </button>
              <button
                onClick={() => setActiveTab('session')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'session' ? 'bg-[var(--d-reading-chip)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'جلسة قراءة' : 'Log Session'}
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'library' ? 'bg-[var(--d-reading-chip)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? `المكتبة (${readingData.books.length})` : `Library (${readingData.books.length})`}
              </button>
              <button
                onClick={() => setActiveTab('quotes')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  activeTab === 'quotes' ? 'bg-[var(--d-reading-chip)] text-accent font-bold shadow-sm' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? `الاقتباسات (${(readingData.quotes || []).length})` : `Quotes (${(readingData.quotes || []).length})`}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <span className="text-lg font-bold px-2">✕</span>
            </button>
          </div>
        </div>

        {/* ================= MODAL SCROLLABLE CONTENT ================= */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* ================= TAB 1: DASHBOARD & INSIGHTS ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Active Book Spotlight Hero */}
              {activeBook ? (
                <div className="panel p-5 sm:p-6 border border-amber-500/25 bg-gradient-to-br from-[var(--d-reading-chip)] via-[var(--d-reading-raised)] to-[var(--d-reading-raised)] rounded-2xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                    <div className="flex gap-4 items-start">
                      <div
                        className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl shadow-2xl flex-shrink-0 flex items-center justify-center p-2 text-center text-[11px] font-bold text-[var(--text-primary)] leading-tight uppercase tracking-wider border border-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${activeBook.coverColor || '#d97706'}, #090e0b)`,
                          boxShadow: '0 8px 25px rgba(0,0,0,0.6)'
                        }}
                      >
                        {activeBook.title.slice(0, 20)}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-[var(--d-reading-accent-strong)] border border-amber-500/30">
                            {isAr ? 'الكتاب النشط حالياً' : 'Currently Reading'}
                          </span>
                          <span className="text-[11px] text-muted">
                            {categoryLabels[activeBook.category || 'productivity']?.[isAr ? 'ar' : 'en']}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] truncate">{activeBook.title}</h3>
                        <p className="text-xs text-muted">{activeBook.author}</p>

                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-2xl font-bold font-mono text-[var(--d-reading-accent)]">
                            {activeBook.currentPage}
                          </span>
                          <span className="text-xs text-muted">/ {activeBook.totalPages} {isAr ? 'صفحة' : 'pages'}</span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-accent font-semibold">
                            {activeProgress}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-3 sm:pt-0 border-t sm:border-0 border-[var(--d-reading-border-accent)]">
                      <div className="text-start sm:text-end">
                        <span className="text-[11px] text-muted block">{isAr ? 'المتبقي لختام الكتاب:' : 'To completion:'}</span>
                        <strong className="text-base font-mono text-[var(--text-primary)]">
                          {pagesLeft} {isAr ? 'صفحة' : 'pages'}
                        </strong>
                        <small className="text-[11px] text-accent block">~{estMinutesToFinish} {isAr ? 'دقيقة قراءة' : 'mins flow'}</small>
                      </div>

                      <button
                        onClick={() => {
                          setSessionBookId(activeBook.id);
                          setActiveTab('session');
                        }}
                        className="btn primary small bg-amber-500 hover:bg-amber-400 text-black font-bold"
                      >
                        <span>{isAr ? 'تسجيل جلسة قراءة الآن' : 'Start Reading Session'}</span>
                        <span>⚡</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="mt-5 progress-line h-2.5 rounded-full bg-[var(--d-reading-chip)] overflow-hidden">
                    <span
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full block rounded-full transition-all duration-700"
                      style={{ width: `${activeProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center panel border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-raised)] rounded-2xl">
                  <span className="text-3xl block mb-2">📚</span>
                  <strong className="text-[var(--text-primary)] text-base block">{isAr ? 'لا يوجد كتاب نشط قيد القراءة حالياً' : 'No active book selected'}</strong>
                  <p className="text-xs text-muted mt-1">{isAr ? 'اختر كتاباً من مكتبتك أو أضف كتاباً جديداً لتبدأ متابعة القراءة.' : 'Select a book from your library to begin tracking daily pages.'}</p>
                  <button onClick={() => setActiveTab('library')} className="btn primary small mt-3">
                    {isAr ? 'فتح المكتبة واختيار كتاب' : 'Open Library'}
                  </button>
                </div>
              )}

              {/* 3 Reading Target Gauges */}
              <div className="panel p-5 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">
                      {isAr ? 'مؤشرات وأهداف القراءة المتوازنة' : 'Reading Targets & Performance KPIs'}
                    </h4>
                    <p className="text-xs text-muted">
                      {isAr ? 'أهداف مقاسة يومياً وأسبوعياً وسنوياً لضمان النمو المعرفي المستمر.' : 'Daily, weekly, and annual cadences that compound over time.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditingTargets(!isEditingTargets)}
                    className="btn subtle small text-xs"
                  >
                    {isEditingTargets ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'تعديل الأهداف' : 'Edit Targets')}
                  </button>
                </div>

                {isEditingTargets ? (
                  <form onSubmit={handleSaveTargets} className="p-4 rounded-xl border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-surface)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'الهدف اليومي (صفحة)' : 'Daily Target (Pages)'}</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={tempDailyPages}
                        onChange={(e) => setTempDailyPages(Number(e.target.value))}
                        className="input w-full font-mono text-xs"
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'الهدف الأسبوعي (صفحة)' : 'Weekly Target (Pages)'}</label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={tempWeeklyPages}
                        onChange={(e) => setTempWeeklyPages(Number(e.target.value))}
                        className="input w-full font-mono text-xs"
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'الهدف السنوي (كتاب)' : 'Annual Goal (Books)'}</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={tempAnnualBooks}
                        onChange={(e) => setTempAnnualBooks(Number(e.target.value))}
                        className="input w-full font-mono text-xs"
                        required
                      />
                    </div>
                    <div className="sm:col-span-3 flex justify-end">
                      <button type="submit" className="btn primary small">
                        {isAr ? 'حفظ الأهداف الجديدة' : 'Save Targets'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Daily Target */}
                    <div className="p-3.5 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">{isAr ? 'إنجاز اليوم' : 'Today\'s Pages'}</span>
                        <span className="font-mono text-[var(--d-reading-accent)] font-bold">
                          {pagesReadToday} / {readingData.dailyTargetPages || 20} {isAr ? 'ص' : 'p'}
                        </span>
                      </div>
                      <div className="progress-line h-2 rounded-full bg-[var(--d-reading-chip)]">
                        <span
                          className="bg-amber-400 h-full block rounded-full"
                          style={{ width: `${Math.min(100, Math.round((pagesReadToday / (readingData.dailyTargetPages || 20)) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted block">
                        {pagesReadToday >= (readingData.dailyTargetPages || 20)
                          ? (isAr ? '✓ تم إنجاز هدف اليوم!' : 'Daily goal achieved!')
                          : (isAr ? `متبقي ${(readingData.dailyTargetPages || 20) - pagesReadToday} صفحة` : `${(readingData.dailyTargetPages || 20) - pagesReadToday} pages left today`)}
                      </span>
                    </div>

                    {/* Weekly Target */}
                    <div className="p-3.5 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">{isAr ? 'إنجاز هذا الأسبوع' : 'This Week'}</span>
                        <span className="font-mono text-accent font-bold">
                          {pagesReadThisWeek} / {readingData.weeklyTargetPages || 140} {isAr ? 'ص' : 'p'}
                        </span>
                      </div>
                      <div className="progress-line h-2 rounded-full bg-[var(--d-reading-chip)]">
                        <span
                          className="bg-accent h-full block rounded-full"
                          style={{ width: `${Math.min(100, Math.round((pagesReadThisWeek / (readingData.weeklyTargetPages || 140)) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted block">
                        {Math.round((pagesReadThisWeek / (readingData.weeklyTargetPages || 140)) * 100)}% {isAr ? 'من الحصة الأسبوعية' : 'of weekly target'}
                      </span>
                    </div>

                    {/* Annual Goal */}
                    <div className="p-3.5 rounded-xl border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">{isAr ? 'الهدف السنوي للكتب' : 'Annual Goal'}</span>
                        <span className="font-mono text-[var(--state-success)] font-bold">
                          {completedBooks.length} / {readingData.annualTargetBooks || 24} {isAr ? 'كتاب' : 'books'}
                        </span>
                      </div>
                      <div className="progress-line h-2 rounded-full bg-[var(--d-reading-chip)]">
                        <span
                          className="bg-emerald-400 h-full block rounded-full"
                          style={{ width: `${Math.min(100, Math.round((completedBooks.length / (readingData.annualTargetBooks || 24)) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted block">
                        {completedBooks.length} {isAr ? 'كتب مكتملة بنجاح' : 'books finished'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Compounding Analytics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="panel p-4 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]">
                  <span className="text-muted text-xs block">{isAr ? 'إجمالي الصفحات' : 'Total Pages'}</span>
                  <strong className="text-2xl font-mono text-[var(--d-reading-accent)] font-bold mt-1 block">
                    {readingData.totalPagesRead.toLocaleString()}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'صفحة مسجلة تراكمياً' : 'all-time pages'}</span>
                </div>

                <div className="panel p-4 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]">
                  <span className="text-muted text-xs block">{isAr ? 'ساعات القراءة' : 'Reading Hours'}</span>
                  <strong className="text-2xl font-mono text-[var(--text-primary)] font-bold mt-1 block">
                    {Math.floor(readingData.totalReadingMinutes / 60)}h {readingData.totalReadingMinutes % 60}m
                  </strong>
                  <span className="text-[11px] text-muted">{readingData.sessions.length} {isAr ? 'جلسات قراءة' : 'sessions'}</span>
                </div>

                <div className="panel p-4 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]">
                  <span className="text-muted text-xs block">{isAr ? 'متوسط السرعة' : 'Reading Velocity'}</span>
                  <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
                    {avgSpeed}
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'صفحة في الساعة' : 'pages / hour'}</span>
                </div>

                <div className="panel p-4 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]">
                  <span className="text-muted text-xs block">{isAr ? 'سلسلة الاستمرار' : 'Streak'}</span>
                  <strong className="text-2xl font-mono text-[var(--state-success)] font-bold mt-1 block">
                    {habit.currentStreak || 0} {isAr ? 'يوم' : 'd'} ♨
                  </strong>
                  <span className="text-[11px] text-muted">{isAr ? 'أطول سلسلة:' : 'best:'} {habit.longestStreak || 0} {isAr ? 'يوم' : 'd'}</span>
                </div>
              </div>

              {/* Quotes Spotlight */}
              {(readingData.quotes || []).length > 0 && (
                <div className="panel p-4 sm:p-5 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-muted tracking-wider">
                      {isAr ? 'من خزانة الاقتباسات والأفكار' : 'Quotes & Reflections Spotlight'}
                    </span>
                    <button
                      onClick={() => setActiveTab('quotes')}
                      className="text-xs text-accent hover:underline"
                    >
                      {isAr ? 'عرض الكل' : 'View all'} →
                    </button>
                  </div>
                  <blockquote className="text-sm font-medium text-[var(--text-primary)]/95 italic border-s-2 border-amber-400 ps-3 py-1">
                    "{readingData.quotes![0].quote}"
                  </blockquote>
                  <div className="text-[11px] text-muted flex items-center gap-2">
                    <span>— {readingData.quotes![0].author || activeBook?.author}</span>
                    {readingData.quotes![0].bookTitle && <span>· {readingData.quotes![0].bookTitle}</span>}
                    {readingData.quotes![0].page && <span>(ص {readingData.quotes![0].page})</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: ACTIVE SESSION LOGGER ================= */}
          {activeTab === 'session' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Session Form */}
              <div className="md:col-span-7 panel p-5 border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-raised)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-base">
                      {isAr ? 'تسجيل جلسة قراءة جديدة' : 'Log Reading Session'}
                    </h3>
                    <p className="text-xs text-muted">
                      {isAr ? 'يُحسب الإنجاز فوراً كتقدم لعادة القراءة ويزيد من سلسلة استمرارك وXP.' : 'Auto-updates reading velocity, habit streak, and compounds XP.'}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[var(--d-reading-accent-strong)] bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded">
                    +XP & Streak
                  </span>
                </div>

                <form onSubmit={handleLogSession} className="space-y-4">
                  {/* Book Picker for Session */}
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'الكتاب المقروء في هذه الجلسة' : 'Select Book'}</label>
                    <select
                      className="select w-full text-xs font-semibold"
                      value={sessionBookId || activeBook?.id}
                      onChange={(e) => {
                        setSessionBookId(e.target.value);
                        setActiveBook(habit.id, e.target.value);
                      }}
                    >
                      {readingData.books.filter((b) => b.status !== 'archived').map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.currentPage} / {b.totalPages}p) — {b.status === 'completed' ? (isAr ? 'مكتمل' : 'Done') : (isAr ? 'قيد القراءة' : 'Reading')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">
                        {isAr ? 'الصفحات المقروءة' : 'Pages Read'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={pagesInput}
                          onChange={(e) => setPagesInput(Number(e.target.value))}
                          className="input w-full font-mono font-bold text-base text-[var(--d-reading-accent)]"
                          required
                        />
                        <span className="absolute end-3 top-2.5 text-xs text-muted pointer-events-none">
                          {isAr ? 'صفحة' : 'pages'}
                        </span>
                      </div>
                    </div>

                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">
                        {isAr ? 'المدة بالدقائق' : 'Duration (Minutes)'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="360"
                          value={minutesInput}
                          onChange={(e) => setMinutesInput(Number(e.target.value))}
                          className="input w-full font-mono font-bold text-base"
                          required
                        />
                        <span className="absolute end-3 top-2.5 text-xs text-muted pointer-events-none">
                          {isAr ? 'دقيقة' : 'mins'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Pace Indicator */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-[rgba(255,255,255,0.02)] border border-[var(--d-reading-border)] text-xs">
                    <span className="text-muted">{isAr ? 'معدل السرعة المحسوب للجلسة:' : 'Calculated Speed:'}</span>
                    <span className="font-mono text-[var(--d-reading-accent)] font-bold">
                      {minutesInput > 0 ? Math.round((pagesInput / minutesInput) * 60) : 0}{' '}
                      <small className="text-muted font-normal">{isAr ? 'صفحة / ساعة' : 'p/h'}</small>
                    </span>
                  </div>

                  {/* Session Notes */}
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'ملاحظة أو فكرة استوقفتك (اختياري)' : 'Key Reflection / Takeaway (Optional)'}
                    </label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      rows={2}
                      className="input w-full text-xs"
                      placeholder={isAr ? 'سجّل الفكرة الأهم من هذه الصفحات...' : 'A core concept or synthesis from today\'s reading...'}
                    />
                  </div>

                  {/* Direct Quote Capture in Session */}
                  <div className="p-3 rounded-xl border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-surface)] space-y-2">
                    <span className="text-[11px] font-bold text-[var(--d-reading-accent-strong)] block">
                      {isAr ? '✦ اقتباس أعجبك لتخليده في السجل (اختياري):' : '✦ Capture Quote from this Session:'}
                    </span>
                    <textarea
                      value={capturedQuote}
                      onChange={(e) => setCapturedQuote(e.target.value)}
                      rows={2}
                      className="input w-full text-xs"
                      placeholder={isAr ? 'اكتب نص الاقتباس هنا...' : 'Type or paste memorable quote...'}
                    />
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <span className="text-muted text-[11px]">{isAr ? 'رقم الصفحة:' : 'Page:'}</span>
                      <input
                        type="number"
                        value={capturedQuotePage}
                        onChange={(e) => setCapturedQuotePage(e.target.value === '' ? '' : Number(e.target.value))}
                        className="input w-20 text-xs font-mono py-1"
                        placeholder="e.g. 42"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {showLogSuccess ? (
                      <span className="text-xs text-accent font-semibold flex items-center gap-1.5 animate-pulse">
                        ✓ {isAr ? 'تم تسجيل الجلسة وتحديث مؤشرات القراءة وسلسلة العادة!' : 'Session logged & streak updated!'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        {isAr ? 'يتم حفظ السجل وتحديث الصفحة الحالية تلقائياً.' : 'Auto-advances page and updates streak.'}
                      </span>
                    )}

                    <button type="submit" className="btn primary bg-amber-500 hover:bg-amber-400 text-black font-bold">
                      <span>{isAr ? 'تأكيد وحفظ الجلسة' : 'Save Session'}</span>
                      <span>✓</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Recent Sessions History Log */}
              <div className="md:col-span-5 panel p-5 border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-raised)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">
                      {isAr ? 'سجل الجلسات السابقة' : 'Past Reading Sessions'}
                    </h4>
                    <span className="text-xs font-mono text-muted">
                      {readingData.sessions.length} {isAr ? 'جلسات' : 'logs'}
                    </span>
                  </div>

                  {readingData.sessions.length === 0 ? (
                    <div className="p-8 text-center text-muted text-xs">
                      {isAr ? 'لا توجد جلسات مسجلة بعد. ابدأ جلستك الأولى الآن!' : 'No reading sessions logged yet. Record your first session!'}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pe-1">
                      {readingData.sessions.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[var(--d-reading-border)] space-y-1 text-xs"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <strong className="text-[var(--text-primary)] block text-xs">{s.bookTitle}</strong>
                              <span className="text-[11px] text-muted font-mono">
                                {s.date} · {s.durationMinutes}m · {s.speedPagesPerHour} {isAr ? 'ص/س' : 'p/h'}
                              </span>
                            </div>
                            <span className="font-mono text-[var(--d-reading-accent)] font-bold px-2 py-0.5 rounded bg-amber-500/10">
                              +{s.pagesRead} {isAr ? 'ص' : 'p'}
                            </span>
                          </div>

                          {s.notes && (
                            <p className="text-[11px] text-[var(--text-primary)] italic border-s-2 border-accent ps-2 mt-1">
                              "{s.notes}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: BOOK LIBRARY VAULT ================= */}
          {activeTab === 'library' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">{isAr ? 'خزانة ومكتبة الكتب' : 'Book Vault & Library'}</h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'إدارة وتصنيف كل الكتب المقروءة والحالية وقائمة القراءة المستقبلية.' : 'Full catalog of read, active, and wishlist works.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenBookModal()}
                    className="btn primary small bg-amber-500 hover:bg-amber-400 text-black font-bold"
                  >
                    <span>+ {isAr ? 'إضافة كتاب جديد' : 'Add Book'}</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Badges */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[var(--d-reading-surface)] border border-[var(--d-reading-border)]">
                <button
                  onClick={() => setLibraryFilter('all')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    libraryFilter === 'all' ? 'bg-[var(--d-reading-chip)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isAr ? `الكل (${readingData.books.filter((b) => b.status !== 'archived').length})` : `All (${readingData.books.filter((b) => b.status !== 'archived').length})`}
                </button>
                <button
                  onClick={() => setLibraryFilter('reading')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    libraryFilter === 'reading' ? 'bg-[var(--d-reading-chip)] text-[var(--d-reading-accent-strong)] font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  📖 {isAr ? `أقرأ حالياً (${readingBooks.length})` : `Reading (${readingBooks.length})`}
                </button>
                <button
                  onClick={() => setLibraryFilter('completed')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    libraryFilter === 'completed' ? 'bg-[var(--d-reading-chip)] text-[var(--state-success)] font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  ✓ {isAr ? `مكتمل (${completedBooks.length})` : `Completed (${completedBooks.length})`}
                </button>
                <button
                  onClick={() => setLibraryFilter('want_to_read')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    libraryFilter === 'want_to_read' ? 'bg-[var(--d-reading-chip)] text-blue-300 font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  📌 {isAr ? `في الانتظار (${wishlistBooks.length})` : `Wishlist (${wishlistBooks.length})`}
                </button>
                <button
                  onClick={() => setLibraryFilter('archived')}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    libraryFilter === 'archived' ? 'bg-[var(--d-reading-chip)] text-[var(--text-primary)] font-bold' : 'text-muted hover:text-[var(--text-primary)]'
                  }`}
                >
                  📁 {isAr ? `الأرشيف (${archivedBooks.length})` : `Archived (${archivedBooks.length})`}
                </button>
              </div>

              {/* Books Grid */}
              {filteredBooks.length === 0 ? (
                <div className="p-12 text-center panel border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] rounded-2xl">
                  <span className="text-3xl block mb-2">📚</span>
                  <strong className="text-[var(--text-primary)] block">{isAr ? 'لا توجد كتب مطابقة لهذا التصنيف' : 'No books in this category'}</strong>
                  <button onClick={() => handleOpenBookModal()} className="btn primary small mt-3">
                    + {isAr ? 'إضافة أول كتاب' : 'Add Book'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredBooks.map((b) => {
                    const pct = Math.min(100, Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100));
                    const isCurrentActive = b.id === (readingData.activeBookId || activeBook?.id);

                    return (
                      <div
                        key={b.id}
                        className={`panel p-4 border rounded-xl transition-all flex flex-col justify-between ${
                          isCurrentActive ? 'border-amber-500/50 bg-[var(--d-reading-chip)]' : 'border-[var(--d-reading-border)] bg-[var(--d-reading-raised)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start gap-3">
                            <div
                              className="w-12 h-16 rounded shadow flex items-center justify-center text-[var(--text-primary)] text-[9px] font-bold p-1 text-center flex-shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${b.coverColor || '#3b82f6'}, #090e0b)`
                              }}
                            >
                              {b.title.slice(0, 12)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-mono uppercase mb-1 ${
                                    b.status === 'completed'
                                      ? 'bg-emerald-500/20 text-[var(--state-success)]'
                                      : b.status === 'reading'
                                      ? 'bg-amber-500/20 text-[var(--d-reading-accent-strong)]'
                                      : b.status === 'want_to_read'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-[var(--surface-chip)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {b.status === 'completed'
                                    ? isAr ? 'مكتمل' : 'Completed'
                                    : b.status === 'reading'
                                    ? isAr ? 'قيد القراءة' : 'Reading'
                                    : b.status === 'want_to_read'
                                    ? isAr ? 'في الانتظار' : 'Wishlist'
                                    : isAr ? 'مؤرشف' : 'Archived'}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenBookModal(b)}
                                    className="text-muted hover:text-[var(--text-primary)] text-xs px-1"
                                    title={isAr ? 'تعديل الكتاب' : 'Edit book'}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={() => deleteBook(habit.id, b.id)}
                                    className="text-muted hover:text-red-400 text-xs px-1"
                                    title={isAr ? 'حذف الكتاب' : 'Delete'}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              <h4 className="font-bold text-[var(--text-primary)] text-xs truncate">{b.title}</h4>
                              <p className="text-[11px] text-muted truncate">{b.author}</p>
                            </div>
                          </div>

                          {/* Progress Line */}
                          <div className="mt-3 pt-3 border-t border-[var(--d-reading-border)]">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-muted">{b.currentPage} / {b.totalPages} {isAr ? 'ص' : 'p'}</span>
                              <span className="font-mono text-[var(--d-reading-accent-strong)] font-bold">{pct}%</span>
                            </div>
                            <div className="progress-line h-1.5 rounded-full bg-[var(--d-reading-chip)]">
                              <span
                                className="bg-amber-400 h-full block rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {b.notes && (
                            <p className="text-[11px] text-muted/80 mt-2 line-clamp-2 italic">
                              "{b.notes}"
                            </p>
                          )}
                        </div>

                        {/* Card Foot Actions */}
                        <div className="mt-3 pt-2 border-t border-[var(--d-reading-border)] flex items-center gap-1.5">
                          {b.status !== 'completed' && (
                            <button
                              onClick={() => {
                                setSessionBookId(b.id);
                                setActiveBook(habit.id, b.id);
                                setActiveTab('session');
                              }}
                              className="btn subtle small flex-1 justify-center text-[11px] py-1 text-[var(--d-reading-accent-strong)] hover:bg-amber-500/15"
                            >
                              {isAr ? 'جلسة قراءة' : 'Log Session'}
                            </button>
                          )}

                          {b.status === 'reading' && !isCurrentActive && (
                            <button
                              onClick={() => setActiveBook(habit.id, b.id)}
                              className="btn subtle small text-[11px] py-1"
                              title={isAr ? 'تعيين ككتاب نشط' : 'Set active'}
                            >
                              {isAr ? 'نشط' : 'Active'}
                            </button>
                          )}

                          {b.status !== 'completed' && (
                            <button
                              onClick={() =>
                                addOrUpdateBook(habit.id, {
                                  ...b,
                                  currentPage: b.totalPages,
                                  status: 'completed',
                                  completedDate: todayStr
                                })
                              }
                              className="btn subtle small text-[var(--state-success)] text-[10px] px-2 py-1"
                              title={isAr ? 'ختم الكتاب' : 'Mark completed'}
                            >
                              ✓ {isAr ? 'ختم' : 'Done'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add / Edit Book Modal Sheet */}
              {isEditingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80">
                  <form
                    onSubmit={handleSaveBook}
                    className="panel max-w-lg w-full p-5 border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-raised)] rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">
                        {editingBookId ? (isAr ? 'تعديل بيانات الكتاب' : 'Edit Book') : (isAr ? 'إضافة كتاب جديد للمكتبة' : 'Add New Book')}
                      </h4>
                      <button type="button" onClick={() => setIsEditingBook(false)} className="text-muted text-sm">✕</button>
                    </div>

                    <div className="space-y-3">
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'عنوان الكتاب' : 'Book Title'}</label>
                        <input
                          type="text"
                          value={bookTitle}
                          onChange={(e) => setBookTitle(e.target.value)}
                          className="input w-full text-xs"
                          placeholder="e.g. Atomic Habits"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="field">
                          <label className="text-xs text-muted mb-1 block">{isAr ? 'المؤلف' : 'Author'}</label>
                          <input
                            type="text"
                            value={bookAuthor}
                            onChange={(e) => setBookAuthor(e.target.value)}
                            className="input w-full text-xs"
                            placeholder="e.g. James Clear"
                          />
                        </div>

                        <div className="field">
                          <label className="text-xs text-muted mb-1 block">{isAr ? 'التصنيف' : 'Category'}</label>
                          <select
                            className="select w-full text-xs"
                            value={bookCategory}
                            onChange={(e) => setBookCategory(e.target.value as BookCategory)}
                          >
                            {Object.entries(categoryLabels).map(([catKey, catVal]) => (
                              <option key={catKey} value={catKey}>
                                {isAr ? catVal.ar : catVal.en}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="field">
                          <label className="text-xs text-muted mb-1 block">{isAr ? 'إجمالي الصفحات' : 'Total Pages'}</label>
                          <input
                            type="number"
                            min="1"
                            value={bookTotalPages}
                            onChange={(e) => setBookTotalPages(Number(e.target.value))}
                            className="input w-full text-xs font-mono"
                            required
                          />
                        </div>

                        <div className="field">
                          <label className="text-xs text-muted mb-1 block">{isAr ? 'الصفحة الحالية' : 'Current Page'}</label>
                          <input
                            type="number"
                            min="0"
                            max={bookTotalPages}
                            value={bookCurrentPage}
                            onChange={(e) => setBookCurrentPage(Number(e.target.value))}
                            className="input w-full text-xs font-mono"
                          />
                        </div>

                        <div className="field">
                          <label className="text-xs text-muted mb-1 block">{isAr ? 'الحالة' : 'Status'}</label>
                          <select
                            className="select w-full text-xs"
                            value={bookStatus}
                            onChange={(e) => setBookStatus(e.target.value as any)}
                          >
                            <option value="reading">{isAr ? 'قيد القراءة' : 'Reading'}</option>
                            <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
                            <option value="want_to_read">{isAr ? 'في الانتظار' : 'Wishlist'}</option>
                            <option value="archived">{isAr ? 'أرشيف' : 'Archived'}</option>
                          </select>
                        </div>
                      </div>

                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'ملاحظات أو انطباعات حول الكتاب' : 'Book Notes'}</label>
                        <textarea
                          value={bookNotes}
                          onChange={(e) => setBookNotes(e.target.value)}
                          rows={2}
                          className="input w-full text-xs"
                          placeholder={isAr ? 'أفكار رئيسية أو سبب اختيارك للكتاب...' : 'Impressions or core thesis...'}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setIsEditingBook(false)} className="btn subtle small">
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button type="submit" className="btn primary small bg-amber-500 hover:bg-amber-400 text-black font-bold">
                        {isAr ? 'حفظ الكتاب' : 'Save Book'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: QUOTES & REFLECTIONS ================= */}
          {activeTab === 'quotes' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'سجل الاقتباسات والأفكار الذهبية' : 'Quotes & Reflections Repository'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'خزانة الحكم والأفكار التي استوقفتك أثناء القراءة موثقة بمصادرها.' : 'Memorable passages, philosophies, and insights captured from reading.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingQuote(!isAddingQuote)}
                  className="btn primary small bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  {isAddingQuote ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? '+ تدوين اقتباس' : '+ Add Quote')}
                </button>
              </div>

              {isAddingQuote && (
                <form
                  onSubmit={handleSaveStandaloneQuote}
                  className="panel p-4 border border-[var(--d-reading-border-accent)] bg-[var(--d-reading-raised)] rounded-xl space-y-3"
                >
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'نص الاقتباس أو الفكرة' : 'Quote Content'}</label>
                    <textarea
                      value={newQuoteText}
                      onChange={(e) => setNewQuoteText(e.target.value)}
                      rows={3}
                      className="input w-full text-xs"
                      placeholder={isAr ? 'اكتب نص الاقتباس هنا...' : 'Type quote...'}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'اسم الكتاب' : 'Book Title'}</label>
                      <input
                        type="text"
                        value={newQuoteBook}
                        onChange={(e) => setNewQuoteBook(e.target.value)}
                        className="input w-full text-xs"
                        placeholder="e.g. Atomic Habits"
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'القائل / المؤلف' : 'Author'}</label>
                      <input
                        type="text"
                        value={newQuoteAuthor}
                        onChange={(e) => setNewQuoteAuthor(e.target.value)}
                        className="input w-full text-xs"
                        placeholder="e.g. James Clear"
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'رقم الصفحة' : 'Page Number'}</label>
                      <input
                        type="number"
                        value={newQuotePage}
                        onChange={(e) => setNewQuotePage(e.target.value === '' ? '' : Number(e.target.value))}
                        className="input w-full text-xs font-mono"
                        placeholder="e.g. 45"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button type="submit" className="btn primary small">
                      {isAr ? 'حفظ في سجل الاقتباسات' : 'Save Quote'}
                    </button>
                  </div>
                </form>
              )}

              {/* Quotes Grid */}
              {(readingData.quotes || []).length === 0 ? (
                <div className="p-12 text-center panel border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] rounded-2xl">
                  <span className="text-3xl block mb-2">📜</span>
                  <strong className="text-[var(--text-primary)] block">{isAr ? 'لم تسجل أي اقتباسات بعد' : 'No quotes saved yet'}</strong>
                  <p className="text-xs text-muted mt-1">
                    {isAr ? 'سجّل الاقتباسات مباشرة أثناء جلسة القراءة أو أضف اقتباساً يدوياً.' : 'Capture insights while reading sessions or add manually.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {readingData.quotes!.map((q) => (
                    <div
                      key={q.id}
                      className="panel p-4 border border-[var(--d-reading-border)] bg-[var(--d-reading-raised)] rounded-xl flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="text-[var(--d-reading-accent)] text-xl font-serif">“</span>
                          <button
                            onClick={() => deleteBookQuote(habit.id, q.id)}
                            className="text-muted hover:text-red-400 text-xs px-1"
                            title={isAr ? 'حذف الاقتباس' : 'Delete'}
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-primary)]/95 leading-relaxed font-medium">
                          {q.quote}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[var(--d-reading-border)] flex items-center justify-between text-[11px] text-muted">
                        <div>
                          <strong className="text-[var(--text-primary)]">{q.author || 'Unknown'}</strong>
                          {q.bookTitle && <span className="ms-1">· {q.bookTitle}</span>}
                          {q.page && <span className="ms-1 font-mono">(ص {q.page})</span>}
                        </div>
                        <span className="font-mono text-[10px]">{q.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
