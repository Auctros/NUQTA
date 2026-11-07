import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { Habit, SpecializedHabitType } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { ReadingAppModal } from './ReadingAppModal';
import { WorkoutAppModal } from './WorkoutAppModal';
import { DrawingAppModal } from './DrawingAppModal';

export const HabitsView: React.FC = () => {
  const {
    habits,
    toggleHabitToday,
    useStreakFreeze,
    createHabit,
    updateHabit,
    deleteHabit,
    profile,
    goals,
    archiveHabit,
    restoreHabit,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Active specialized sub-app modal state
  const [activeReadingModalHabit, setActiveReadingModalHabit] = useState<Habit | null>(null);
  const [activeWorkoutModalHabit, setActiveWorkoutModalHabit] = useState<Habit | null>(null);
  const [activeDrawingModalHabit, setActiveDrawingModalHabit] = useState<Habit | null>(null);

  const [formName, setFormName] = useState('');
  const [formAnchor, setFormAnchor] = useState('');
  const [formTimeOfDay, setFormTimeOfDay] = useState<Habit['timeOfDay']>('morning');
  const [formCategory, setFormCategory] = useState<Habit['category']>('health');
  const [formSpecializedType, setFormSpecializedType] = useState<SpecializedHabitType>('standard');
  const [formLinkedGoalId, setFormLinkedGoalId] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Past 7 days calculation
  const dayLabelsAr = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
  const dayLabelsEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const past7Days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const key = d.toISOString().split('T')[0];
    const dayIndex = d.getDay();
    return {
      key,
      label: isAr ? dayLabelsAr[dayIndex] : dayLabelsEn[dayIndex],
      isToday: key === todayStr
    };
  });

  // 14 days chain
  const past14Days = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    return d.toISOString().split('T')[0];
  });

  const habitsDoneToday = habits.filter((h) => h.completedDates.includes(todayStr)).length;
  const bestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.currentStreak || 0)) : 0;

  // Calculate weekly consistency rate
  const totalPossible = habits.length * 7;
  const totalCompletedWeek = habits.reduce((acc, h) => {
    const weekCount = past7Days.filter((d) => h.completedDates.includes(d.key) || (h.freezesUsedDates || []).includes(d.key)).length;
    return acc + weekCount;
  }, 0);
  const weekRate = totalPossible > 0 ? Math.round((totalCompletedWeek / totalPossible) * 100) : 0;

  const openNewModal = () => {
    setEditingHabit(null);
    setFormName('');
    setFormAnchor('');
    setFormTimeOfDay('morning');
    setFormCategory('health');
    setFormSpecializedType('standard');
    setFormLinkedGoalId('');
    setIsModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormName(habit.name);
    setFormAnchor(habit.anchor || '');
    setFormTimeOfDay(habit.timeOfDay);
    setFormCategory(habit.category);
    setFormSpecializedType(habit.specializedType || 'standard');
    setFormLinkedGoalId(habit.linkedGoalId || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingHabit) {
      updateHabit(editingHabit.id, {
        name: formName.trim(),
        anchor: formAnchor.trim(),
        timeOfDay: formTimeOfDay,
        category: formCategory,
        specializedType: formSpecializedType,
        linkedGoalId: formLinkedGoalId || undefined
      });
    } else {
      createHabit({
        name: formName.trim(),
        anchor: formAnchor.trim() || (isAr ? 'بعد شرب الماء صباحاً -> أبدأ العادة' : 'After morning water -> start habit'),
        timeOfDay: formTimeOfDay,
        category: formCategory,
        specializedType: formSpecializedType,
        linkedGoalId: formLinkedGoalId || undefined,
        targetPerDay: 1
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / RHYTHM</span>
          </div>
          <h1>{isAr ? 'العادات والإيقاع' : 'Habits & Rhythm'}</h1>
          <p>
            {isAr
              ? 'تكرار يومي صغير ومدروس يصنع تحولاً جذرياً في مسار حياتك.'
              : 'Small, intentional daily actions that create profound shifts over time.'}
          </p>
        </div>
        <div className="heading-actions">
          {(() => {
            const openOrCreateStudio = (type: 'quran' | 'reading' | 'workout' | 'drawing') => {
              const existing = habits.find((h) => h.specializedType === type);
              if (existing) {
                useNuqtaStore.getState().setActiveNavTab(type);
                return;
              }

              // Instant auto-initialization of studio habit if not created yet
              if (type === 'quran') {
                createHabit({
                  name: isAr ? 'حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision',
                  anchor: isAr ? 'بعد صلاة الفجر -> أحفظ نصف صفحة وأراجع ورداً' : 'After Fajr prayer -> memorize & revise portion',
                  category: 'learning',
                  timeOfDay: 'morning',
                  specializedType: 'quran'
                });
              } else if (type === 'reading') {
                createHabit({
                  name: isAr ? 'قراءة 20 صفحة يومياً' : 'Read 20 Pages Daily',
                  anchor: isAr ? 'بعد شرب القهوة صباحاً -> أفتح كتابي' : 'After morning coffee -> open book',
                  category: 'mind',
                  timeOfDay: 'morning',
                  specializedType: 'reading'
                });
              } else if (type === 'workout') {
                createHabit({
                  name: isAr ? 'تمارين وزن الجسم والرشاقة المنزلية' : 'Home Calisthenics & Fitness',
                  anchor: isAr ? 'بعد إنهاء العمل -> أبدأ تمارين الضغط والسكوات' : 'After work -> start home workout',
                  category: 'health',
                  timeOfDay: 'afternoon',
                  specializedType: 'workout'
                });
              } else if (type === 'drawing') {
                createHabit({
                  name: isAr ? 'اسكتش ورسم إبداعي يومي' : 'Daily Creative Sketch',
                  anchor: isAr ? 'في المساء -> أرسم لمدة 20 دقيقة' : 'In the evening -> draw 20 min sketch',
                  category: 'mind',
                  timeOfDay: 'evening',
                  specializedType: 'drawing'
                });
              }

              useNuqtaStore.getState().setActiveNavTab(type);
            };

            return (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn subtle text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15"
                  onClick={() => openOrCreateStudio('quran')}
                  title={isAr ? 'استوديو حفظ ومراجعة القرآن الكريم' : 'Quran Memorization Studio'}
                >
                  <span>📜</span>
                  <span>{isAr ? 'حفظ القرآن' : 'Quran Studio'}</span>
                </button>

                <button
                  className="btn subtle text-amber-300 border-amber-500/30 hover:bg-amber-500/15"
                  onClick={() => openOrCreateStudio('reading')}
                  title={isAr ? 'استوديو ومكتبة القراءة' : 'Reading Studio & Library'}
                >
                  <span>📖</span>
                  <span>{isAr ? 'استوديو القراءة' : 'Reading Studio'}</span>
                </button>

                <button
                  className="btn subtle text-teal-300 border-teal-500/30 hover:bg-teal-500/15"
                  onClick={() => openOrCreateStudio('workout')}
                  title={isAr ? 'استوديو التمارين واللياقة المنزلية' : 'Home Workout Studio'}
                >
                  <span>⚡</span>
                  <span>{isAr ? 'استوديو التمارين' : 'Workout Studio'}</span>
                </button>

                <button
                  className="btn subtle text-purple-300 border-purple-500/30 hover:bg-purple-500/15"
                  onClick={() => openOrCreateStudio('drawing')}
                  title={isAr ? 'مرسم ومعرض الأعمال الفنية' : 'Art Studio & Vault'}
                >
                  <span>🎨</span>
                  <span>{isAr ? 'مرسم الفن' : 'Art Studio'}</span>
                </button>

                <button
                  className="btn subtle text-zinc-300 border-zinc-700/50 hover:bg-zinc-800"
                  onClick={() => setActiveNavTab('archive')}
                  title={isAr ? 'فتح أرشيف وسجل العادات' : 'Open Habits Archive & History'}
                >
                  <span>🗄️</span>
                  <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
                </button>

                <button className="btn primary" onClick={openNewModal}>
                  <span className="btn-icon">+</span>
                  <span>{isAr ? 'عادة جديدة' : 'New Habit'}</span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="money-summary" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="panel money-card">
          <span className="money-label">{isAr ? 'إنجاز اليوم' : 'Done Today'}</span>
          <strong>{habitsDoneToday}/{habits.length}</strong>
          <small>{isAr ? 'عادة مكتملة اليوم' : 'habits completed'}</small>
        </div>
        <div className="panel money-card">
          <span className="money-label">{isAr ? 'نسبة الالتزام الأسبوعي' : 'Weekly Rate'}</span>
          <strong>{weekRate}%</strong>
          <div className="progress-line mt-2">
            <span style={{ width: `${weekRate}%` }}></span>
          </div>
        </div>
        <div className="panel money-card">
          <span className="money-label">{isAr ? 'أطول سلسلة استمرار' : 'Best Streak'}</span>
          <strong>{bestStreak} {isAr ? 'يوم' : 'days'}</strong>
          <small>{isAr ? 'حافظ على السلسلة متصلة' : 'keep the chain unbroken'}</small>
        </div>
      </div>

      {/* Section Head */}
      <div className="section-head">
        <div>
          <h2>{isAr ? 'العادات النشطة والسلاسل' : 'Active Habits & Chains'}</h2>
          <p>{isAr ? 'سلسلة 14 يوماً ورابط المحفز المكاني والزماني' : '14-day chain & Implementation Intentions'}</p>
        </div>
      </div>

      {/* Toggle View: Active vs Archived */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              !showArchived ? 'bg-[#1e2e25] text-accent font-bold border border-accent/30' : 'text-muted hover:text-white'
            }`}
          >
            {isAr ? 'العادات النشطة' : 'Active Habits'} ({habits.filter((h) => !h.isArchived && h.status !== 'archived').length})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              showArchived ? 'bg-[#1e2e25] text-accent font-bold border border-accent/30' : 'text-muted hover:text-white'
            }`}
          >
            {isAr ? 'المؤرشفة 🗄️' : 'Archived 🗄️'} ({habits.filter((h) => h.isArchived || h.status === 'archived').length})
          </button>
        </div>
      </div>

      {/* Habits Grid */}
      {(() => {
        const displayedHabits = habits.filter((h) => {
          const isArch = h.isArchived || h.status === 'archived';
          return showArchived ? isArch : !isArch;
        });

        if (displayedHabits.length === 0) {
          return (
            <div className="empty-state">
              <div className="empty-icon">♨</div>
              <strong>{showArchived ? (isAr ? 'لا توجد عادات مؤرشفة' : 'No archived habits') : (isAr ? 'لا توجد عادات مسجلة بعد' : 'No habits yet')}</strong>
              <p>
                {isAr
                  ? 'العادات هي البنية الأساسية للإنتاجية المستدامة. ابدأ بعادة واحدة بسيطة الآن.'
                  : 'Habits are the compound interest of self-improvement. Build your first atomic habit now.'}
              </p>
              {!showArchived && (
                <button className="btn primary" onClick={openNewModal}>
                  + {isAr ? 'عادة جديدة' : 'New Habit'}
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="habit-grid">
            {displayedHabits.map((habit, index) => {
              const isDoneToday = habit.completedDates.includes(todayStr);
              const iconVariant = index % 3 === 1 ? 'blue' : index % 3 === 2 ? 'purple' : '';
              const isArchived = habit.isArchived || habit.status === 'archived';

            return (
              <article key={habit.id} className="panel habit-card">
                <div className="habit-card-head">
                  <span className={`habit-icon ${iconVariant}`}>
                    <NuqtaIcon name={habit.category === 'health' ? 'leaf' : habit.category === 'mind' ? 'coffee' : 'repeat'} className="w-5 h-5 text-accent" />
                  </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="mini-icon"
                        onClick={() => openEditModal(habit)}
                        title={isAr ? 'تعديل' : 'Edit'}
                      >
                        <NuqtaIcon name="edit" className="w-3.5 h-3.5" />
                      </button>

                      {isArchived ? (
                        <button
                          className="mini-icon text-teal-400 hover:text-white"
                          onClick={() => restoreHabit(habit.id)}
                          title={isAr ? 'استعادة العادة' : 'Restore habit'}
                        >
                          ↩
                        </button>
                      ) : (
                        <button
                          className="mini-icon hover:text-amber-400"
                          onClick={() => archiveHabit(habit.id)}
                          title={isAr ? 'أرشفة العادة مع الاحتفاظ بسجلها' : 'Archive habit (keeps history intact)'}
                        >
                          🗄️
                        </button>
                      )}

                      <button
                        className="mini-icon"
                        onClick={() => deleteHabit(habit.id)}
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                      <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3>{habit.name}</h3>
                  {habit.specializedType === 'quran' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      📜 {isAr ? 'استوديو حفظ القرآن' : 'Quran Studio'}
                    </span>
                  )}
                  {habit.specializedType === 'reading' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      📖 {isAr ? 'استوديو القراءة' : 'Reading Studio'}
                    </span>
                  )}
                  {habit.specializedType === 'workout' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      ⚡ {isAr ? 'استوديو التدريب' : 'Workout Studio'}
                    </span>
                  )}
                  {habit.specializedType === 'drawing' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      🎨 {isAr ? 'مرسم الفن' : 'Drawing Studio'}
                    </span>
                  )}
                </div>

                {habit.linkedGoalId && (() => {
                  const g = goals.find((item) => item.id === habit.linkedGoalId);
                  return g ? (
                    <div className="mt-1">
                      <span className="tag text-[10px] bg-accent/10 text-accent border border-accent/25 truncate max-w-full inline-flex items-center gap-1" title={g.title}>
                        <span>🎯</span>
                        <span className="truncate">{g.title}</span>
                      </span>
                    </div>
                  ) : null;
                })()}

                <p>
                  {habit.anchor ? `${isAr ? 'المحفز: ' : 'Cue: '}${habit.anchor}` : (isAr ? 'عادة ذرية متكررة' : 'Atomic daily habit')}
                </p>

                {/* Specialized Studio Launch Banner */}
                {habit.specializedType === 'quran' && habit.quranData && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs my-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 font-mono block">
                        {isAr ? 'إنجاز الحفظ المتقن' : 'Quran Memorized'}
                      </span>
                      <strong className="text-white truncate block text-[11px]">
                        {habit.quranData.totalAyahsMemorized} {isAr ? 'آية مثبتة' : 'distinct ayahs'} · {habit.quranData.totalSurahsCompleted}/114 {isAr ? 'سورة' : 'surahs'}
                      </strong>
                    </div>
                    <button
                      onClick={() => useNuqtaStore.getState().setActiveNavTab('quran')}
                      className="btn subtle small text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 text-[11px] py-1 px-2.5 flex-shrink-0"
                    >
                      <span>{isAr ? 'فتح استوديو القرآن ↗' : 'Open Quran Studio ↗'}</span>
                    </button>
                  </div>
                )}

                {habit.specializedType === 'reading' && habit.readingData && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs my-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-amber-400 font-mono block">
                        {isAr ? 'الكتاب الحالي' : 'Active Book'}
                      </span>
                      <strong className="text-white truncate block text-[11px]">
                        {habit.readingData.books.find((b) => b.id === habit.readingData?.activeBookId)?.title || habit.readingData.books[0]?.title || 'Reading Vault'}
                      </strong>
                    </div>
                    <button
                      onClick={() => useNuqtaStore.getState().setActiveNavTab('reading')}
                      className="btn subtle small text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-[11px] py-1 px-2.5 flex-shrink-0"
                    >
                      <span>{isAr ? 'فتح استوديو القراءة ↗' : 'Open Reading Studio ↗'}</span>
                    </button>
                  </div>
                )}

                {habit.specializedType === 'workout' && habit.workoutData && (
                  <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-between text-xs my-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-teal-400 font-mono block">
                        {isAr ? 'الحمل التراكمي' : 'Total Volume'}
                      </span>
                      <strong className="text-white truncate block text-[11px]">
                        {habit.workoutData.totalVolumeKg.toLocaleString()} kg · {habit.workoutData.totalWorkouts} {isAr ? 'حصص' : 'workouts'}
                      </strong>
                    </div>
                    <button
                      onClick={() => useNuqtaStore.getState().setActiveNavTab('workout')}
                      className="btn subtle small text-teal-300 border-teal-500/30 hover:bg-teal-500/20 text-[11px] py-1 px-2.5 flex-shrink-0"
                    >
                      <span>{isAr ? 'فتح استوديو التدريب ↗' : 'Open Workout Studio ↗'}</span>
                    </button>
                  </div>
                )}

                {habit.specializedType === 'drawing' && habit.drawingData && (
                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs my-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-purple-400 font-mono block">
                        {isAr ? 'مرسم الإبداع' : 'Creative Studio'}
                      </span>
                      <strong className="text-white truncate block text-[11px]">
                        {habit.drawingData.totalSketches} {isAr ? 'أعمال فنية' : 'artworks'} · {Math.floor(habit.drawingData.totalDrawingMinutes / 60)}h {habit.drawingData.totalDrawingMinutes % 60}m
                      </strong>
                    </div>
                    <button
                      onClick={() => useNuqtaStore.getState().setActiveNavTab('drawing')}
                      className="btn subtle small text-purple-300 border-purple-500/30 hover:bg-purple-500/20 text-[11px] py-1 px-2.5 flex-shrink-0"
                    >
                      <span>{isAr ? 'فتح المرسم ↗' : 'Open Art Studio ↗'}</span>
                    </button>
                  </div>
                )}

                {/* Week View (7 Days) */}
                <div className="habit-week">
                  {past7Days.map((d) => {
                    const isDone = habit.completedDates.includes(d.key);
                    const isFrozen = (habit.freezesUsedDates || []).includes(d.key);
                    return (
                      <span
                        key={d.key}
                        className={`${isDone ? 'done' : isFrozen ? 'freeze' : ''} ${d.isToday ? 'today' : ''}`}
                        title={d.key}
                      >
                        {isDone ? '✓' : isFrozen ? '❄' : d.label}
                      </span>
                    );
                  })}
                </div>

                {/* 14 Days Chain */}
                <div className="chain" aria-label="Recent 14 days chain">
                  {past14Days.map((key) => {
                    const filled = habit.completedDates.includes(key) || (habit.freezesUsedDates || []).includes(key);
                    return (
                      <span
                        key={key}
                        className={`${filled ? 'filled' : ''} ${key === todayStr ? 'today' : ''}`}
                      />
                    );
                  })}
                </div>

                {/* Foot: Streak + Toggle */}
                <div className="habit-card-foot">
                  <span className="streak">
                    <em>♨</em> {habit.currentStreak || 0} {isAr ? 'يوم متواصل' : 'streak'}
                  </span>
                  <button
                    className={`btn small ${isDoneToday ? 'subtle' : 'primary'}`}
                    onClick={() => {
                      if (habit.specializedType === 'quran' && !isDoneToday) {
                        useNuqtaStore.getState().setActiveNavTab('quran');
                      } else if (habit.specializedType === 'reading' && !isDoneToday) {
                        useNuqtaStore.getState().setActiveNavTab('reading');
                      } else if (habit.specializedType === 'workout' && !isDoneToday) {
                        useNuqtaStore.getState().setActiveNavTab('workout');
                      } else if (habit.specializedType === 'drawing' && !isDoneToday) {
                        useNuqtaStore.getState().setActiveNavTab('drawing');
                      } else {
                        toggleHabitToday(habit.id);
                      }
                    }}
                  >
                    {isDoneToday
                      ? (isAr ? 'إلغاء الإنجاز' : 'Undo')
                      : habit.specializedType === 'quran'
                      ? (isAr ? 'جلسة حفظ/مراجعة 📜' : 'Log Quran 📜')
                      : habit.specializedType === 'reading'
                      ? (isAr ? 'تسجيل قراءة 📖' : 'Log Reading 📖')
                      : habit.specializedType === 'workout'
                      ? (isAr ? 'تسجيل تمرين ⚡' : 'Log Workout ⚡')
                      : habit.specializedType === 'drawing'
                      ? (isAr ? 'تسجيل رسم 🎨' : 'Log Art 🎨')
                      : (isAr ? 'تم الإنجاز ✓' : 'Mark Done')}
                  </button>
                </div>

                <div className="subtle-line"></div>

                {/* Streak Freeze Button */}
                <button
                  className="text-link flex items-center justify-between w-full"
                  onClick={() => useStreakFreeze(habit.id)}
                  title={isAr ? 'تجميد السلسلة في الحالات الطارئة دون فقدان تقدمك' : 'Emergency freeze without breaking streak'}
                >
                  <span>❄ {isAr ? 'تجميد السلسلة' : 'Streak Freeze'}</span>
                  <span className="tag text-[9px]">
                    {habit.freezesRemaining ?? 2} {isAr ? 'متبقي هذا الشهر' : 'left'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      );
    })()}

      {/* Habit Science Insight Panel */}
      <section className="panel panel-pad" style={{ marginTop: '15px' }}>
        <div className="panel-heading">
          <div>
            <h2>{isAr ? 'قاعدة تثبيت العادات (Habit Stacking)' : 'Habit Stacking & Atomic Cues'}</h2>
            <p>{isAr ? `معدل إنجاز الأسبوع الحالي: ${weekRate}%` : `Current week consistency: ${weekRate}%`}</p>
          </div>
          <span className="tag green">{isAr ? 'علم السلوك' : 'Behavioral Science'}</span>
        </div>
        <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8, margin: 0 }}>
          {isAr
            ? 'وفق كتاب العادات الذرية (جيمس كلير) ونموذج بي جي فوغ، فإن أفضل طريقة لتثبيت عادة جديدة هي ربطها بمحفز قائم بالفعل في جدولك (مثال: "بعد أن أصب قهوة الصباح -> سأقرأ صفحتين"). هذا يقلل المقاومة العصبية إلى الصفر.'
            : 'Based on James Clear and BJ Fogg’s behavior model, the fastest way to form a habit is linking it to an established anchor: "After [Current Habit] -> I will [New Habit]". This removes friction and automates execution.'}
        </p>
      </section>

      {/* Habit Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editingHabit ? (isAr ? 'تعديل العادة' : 'Edit Habit') : (isAr ? 'بناء عادة ذرية جديدة' : 'New Atomic Habit')}</h2>
                <p>
                  {isAr
                    ? 'حدد المحفز المكاني والزماني بوضوح لضمان استمرارية العادة.'
                    : 'Set a specific cue and time anchor to solidify the neurological loop.'}
                </p>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="field">
                <label>{isAr ? 'اسم العادة' : 'Habit Name'} *</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={isAr ? 'مثال: القراءة اليومية، شرب 2 لتر ماء، المشي...' : 'e.g. Read 10 pages, morning walk...'}
                  autoFocus
                  required
                />
              </div>

              <div className="field">
                <label>{isAr ? 'المحفز (رابط العادة)' : 'Anchor Trigger (Habit Stacking)'}</label>
                <input
                  className="input"
                  value={formAnchor}
                  onChange={(e) => setFormAnchor(e.target.value)}
                  placeholder={isAr ? 'بعد أن [أصب القهوة] -> سأفعل [العادة]' : 'After I [pour coffee] -> I will [habit]'}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>{isAr ? 'الوقت المفضل' : 'Time of Day'}</label>
                  <select
                    className="select"
                    value={formTimeOfDay}
                    onChange={(e) => setFormTimeOfDay(e.target.value as any)}
                  >
                    <option value="morning">{isAr ? 'الصباح' : 'Morning'}</option>
                    <option value="afternoon">{isAr ? 'بعد الظهر' : 'Afternoon'}</option>
                    <option value="evening">{isAr ? 'المساء' : 'Evening'}</option>
                    <option value="anytime">{isAr ? 'في أي وقت' : 'Anytime'}</option>
                  </select>
                </div>

                <div className="field">
                  <label>{isAr ? 'التصنيف' : 'Category'}</label>
                  <select
                    className="select"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                  >
                    <option value="health">{isAr ? 'صحة وجسد' : 'Health & Body'}</option>
                    <option value="mind">{isAr ? 'صفاء ذهني وتأمل' : 'Mind & Focus'}</option>
                    <option value="productivity">{isAr ? 'إنتاجية وعمل' : 'Productivity'}</option>
                    <option value="learning">{isAr ? 'تعلم وتطوير' : 'Learning'}</option>
                    <option value="relationships">{isAr ? 'علاقات وتواصل' : 'Relationships'}</option>
                  </select>
                </div>
              </div>

              {/* Linked Strategic Goal Selector */}
              <div className="field">
                <label>{isAr ? 'الهدف الاستراتيجي المرتبط' : 'Linked Strategic Goal'}</label>
                <select
                  className="select"
                  value={formLinkedGoalId}
                  onChange={(e) => setFormLinkedGoalId(e.target.value)}
                >
                  <option value="">{isAr ? 'بدون هدف استراتيجي (عادة عامة)' : 'No linked goal (general habit)'}</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      🎯 {g.title} ({g.timeframe})
                    </option>
                  ))}
                </select>
              </div>

              {/* Habit Quick Presets & Types (One-Click Selection) */}
              <div className="field">
                <label className="text-xs font-semibold text-accent block mb-1.5">
                  {isAr ? 'اختر نوع أو قالب العادة (بضغطة واحدة):' : 'Select Habit Type / Template (1-Click Setup):'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormName(isAr ? 'حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision');
                      setFormCategory('learning');
                      setFormTimeOfDay('morning');
                      setFormAnchor(isAr ? 'بعد صلاة الفجر -> أحفظ نصف صفحة وأراجع ورداً' : 'After Fajr prayer -> memorize & revise portion');
                      setFormSpecializedType('quran');
                    }}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      formSpecializedType === 'quran'
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-[#26372d] bg-[#111914] text-muted hover:border-emerald-400/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">📜</span>
                    <strong className="text-xs block text-white">{isAr ? 'حفظ القرآن' : 'Quran Studio'}</strong>
                    <small className="text-[10px] text-muted block mt-0.5">{isAr ? 'تثبيت الآيات والمراجعة' : 'Ayahs & revision'}</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormName(isAr ? 'القراءة اليومية وتلخيص الفكر' : 'Daily Reading Sanctuary');
                      setFormCategory('learning');
                      setFormTimeOfDay('evening');
                      setFormAnchor(isAr ? 'بعد شاي المساء -> أفتح كتابي وأقرأ ٢٠ صفحة' : 'After evening tea -> sit and read 20 pages');
                      setFormSpecializedType('reading');
                    }}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      formSpecializedType === 'reading'
                        ? 'border-amber-400 bg-amber-500/15 text-white'
                        : 'border-[#26372d] bg-[#111914] text-muted hover:border-amber-400/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">📖</span>
                    <strong className="text-xs block text-white">{isAr ? 'عادة القراءة' : 'Reading Habit'}</strong>
                    <small className="text-[10px] text-muted block mt-0.5">{isAr ? 'نظام الكتب والصفحات' : 'Book tracker & speed'}</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormName(isAr ? 'تمارين منزلية ولياقة بدنية' : 'Daily Home Calisthenics');
                      setFormCategory('health');
                      setFormTimeOfDay('afternoon');
                      setFormAnchor(isAr ? 'بعد الانتهاء من العمل -> أمارس ٣٠ دقيقة وزن الجسم' : 'After work cutoff -> 30 min bodyweight session');
                      setFormSpecializedType('workout');
                    }}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      formSpecializedType === 'workout'
                        ? 'border-teal-400 bg-teal-500/15 text-white'
                        : 'border-[#26372d] bg-[#111914] text-muted hover:border-teal-400/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">⚡</span>
                    <strong className="text-xs block text-white">{isAr ? 'عادة التمرين' : 'Workout Habit'}</strong>
                    <small className="text-[10px] text-muted block mt-0.5">{isAr ? 'تمارين منزلية وحصص' : 'Home workout sets'}</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormName(isAr ? 'الرسم والإبداع البصري' : 'Daily Creative Sketch');
                      setFormCategory('mind');
                      setFormTimeOfDay('evening');
                      setFormAnchor(isAr ? 'بعد هدوء البيت -> أرسم لوحة أو اسكتش في دفتري' : 'After dinner -> sketch for 20 mins');
                      setFormSpecializedType('drawing');
                    }}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      formSpecializedType === 'drawing'
                        ? 'border-purple-400 bg-purple-500/15 text-white'
                        : 'border-[#26372d] bg-[#111914] text-muted hover:border-purple-400/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">🎨</span>
                    <strong className="text-xs block text-white">{isAr ? 'عادة الرسم' : 'Drawing Habit'}</strong>
                    <small className="text-[10px] text-muted block mt-0.5">{isAr ? 'استوديو الإبداع' : 'Sketch & art studio'}</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormSpecializedType('standard');
                    }}
                    className={`p-2.5 rounded-xl border text-start transition-all ${
                      formSpecializedType === 'standard'
                        ? 'border-accent bg-accent/15 text-white'
                        : 'border-[#26372d] bg-[#111914] text-muted hover:border-accent/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">✓</span>
                    <strong className="text-xs block text-white">{isAr ? 'عادة يومية مخصصة' : 'Custom Habit'}</strong>
                    <small className="text-[10px] text-muted block mt-0.5">{isAr ? 'تتبع يومي وسلاسل' : 'Standard daily streak'}</small>
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn subtle" onClick={() => setIsModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {editingHabit ? (isAr ? 'حفظ التعديل' : 'Save Changes') : (isAr ? 'إنشاء العادة' : 'Create Habit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Specialized Mini-App Modals */}
      {activeReadingModalHabit && (
        <ReadingAppModal
          habit={activeReadingModalHabit}
          onClose={() => setActiveReadingModalHabit(null)}
        />
      )}

      {activeWorkoutModalHabit && (
        <WorkoutAppModal
          habit={activeWorkoutModalHabit}
          onClose={() => setActiveWorkoutModalHabit(null)}
        />
      )}

      {activeDrawingModalHabit && (
        <DrawingAppModal
          habit={activeDrawingModalHabit}
          onClose={() => setActiveDrawingModalHabit(null)}
        />
      )}
    </div>
  );
};
