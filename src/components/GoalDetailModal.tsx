import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { Goal, KeyResult, KeyResultDataSource, GoalMilestone, SpecializedHabitType } from '../types';
import { useNuqtaStore } from '../store/nuqtaStore';
import { evaluateGoalProgress, pacingIconName } from '../lib/goalProgressEngine';
import { NuqtaSelect } from './ui';
import { NuqtaIcon, IconName } from './NuqtaIcon';

interface GoalDetailModalProps {
  goal: Goal;
  onClose: () => void;
  onEditGoal: (goal: Goal) => void;
}

export const GoalDetailModal: React.FC<GoalDetailModalProps> = ({ goal, onClose, onEditGoal }) => {
  const {
    tasks,
    habits,
    profile,
    updateKeyResult,
    addKeyResult,
    deleteKeyResult,
    addGoalMilestone,
    toggleGoalMilestone,
    deleteGoalMilestone,
    linkActivityToGoal,
    unlinkActivityFromGoal,
    updateGoal,
    createTask,
    createHabit,
    archiveGoal,
    restoreGoal
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const [activeTab, setActiveTab] = useState<'krs' | 'milestones' | 'links' | 'timeline'>('krs');

  // Compute live intelligence
  const intel = evaluateGoalProgress(goal, tasks, habits);

  // Quick Task Creation state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<1 | 2 | 3 | 4>(2);
  const [quickTaskDate, setQuickTaskDate] = useState(localDateKey());

  // Quick Habit Creation state
  const [isCreatingHabit, setIsCreatingHabit] = useState(false);
  const [quickHabitName, setQuickHabitName] = useState('');
  const [quickHabitType, setQuickHabitType] = useState<SpecializedHabitType>('standard');
  const [quickHabitAnchor, setQuickHabitAnchor] = useState('');

  const handleCreateLinkedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    createTask({
      title: quickTaskTitle.trim(),
      priority: quickTaskPriority,
      scheduledDate: quickTaskDate || undefined,
      tags: [goal.category],
      linkedGoalId: goal.id
    });

    setQuickTaskTitle('');
    setIsCreatingTask(false);
  };

  const handleCreateLinkedHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHabitName.trim()) return;

    createHabit({
      name: quickHabitName.trim(),
      anchor: quickHabitAnchor.trim() || (isAr ? 'بعد شرب القهوة -> أبدأ العادة' : 'After morning coffee -> start habit'),
      timeOfDay: 'morning',
      category: goal.category === 'health' ? 'health' : 'learning',
      specializedType: quickHabitType,
      linkedGoalId: goal.id,
      targetPerDay: 1
    });

    setQuickHabitName('');
    setQuickHabitAnchor('');
    setIsCreatingHabit(false);
  };

  // New Key Result Form state
  const [isAddingKr, setIsAddingKr] = useState(false);
  const [krTitle, setKrTitle] = useState('');
  const [krSource, setKrSource] = useState<KeyResultDataSource>('tasks_completed');
  const [krStart, setKrStart] = useState<number>(0);
  const [krTarget, setKrTarget] = useState<number>(10);
  const [krUnit, setKrUnit] = useState(isAr ? 'مهمة' : 'tasks');

  // New Milestone Form state
  const [isAddingMs, setIsAddingMs] = useState(false);
  const [msTitle, setMsTitle] = useState('');
  const [msTargetDate, setMsTargetDate] = useState('');

  // Link Activity state
  const [selectedTaskToLink, setSelectedTaskToLink] = useState('');
  const [selectedHabitToLink, setSelectedHabitToLink] = useState('');
  const [selectedBookToLink, setSelectedBookToLink] = useState('');
  const [selectedProjectToLink, setSelectedProjectToLink] = useState('');

  // Manual KR inline updater
  const [manualKrUpdates, setManualKrUpdates] = useState<Record<string, number>>({});

  const handleSourceChange = (src: KeyResultDataSource) => {
    setKrSource(src);
    if (src === 'tasks_completed') {
      setKrUnit(isAr ? 'مهام' : 'tasks');
      setKrTarget(10);
    } else if (src === 'habit_consistency') {
      setKrUnit('%');
      setKrTarget(85);
    } else if (src === 'reading_books_completed') {
      setKrUnit(isAr ? 'كتب' : 'books');
      setKrTarget(5);
    } else if (src === 'reading_pages_read') {
      setKrUnit(isAr ? 'صفحة' : 'pages');
      setKrTarget(300);
    } else if (src === 'reading_hours') {
      setKrUnit(isAr ? 'ساعات' : 'hours');
      setKrTarget(20);
    } else if (src === 'workout_sessions_count') {
      setKrUnit(isAr ? 'حصص' : 'sessions');
      setKrTarget(16);
    } else if (src === 'workout_total_reps') {
      setKrUnit(isAr ? 'تكرار' : 'reps');
      setKrTarget(500);
    } else if (src === 'workout_total_minutes') {
      setKrUnit(isAr ? 'دقيقة' : 'mins');
      setKrTarget(300);
    } else if (src === 'drawing_projects_completed') {
      setKrUnit(isAr ? 'مشاريع' : 'projects');
      setKrTarget(3);
    } else if (src === 'drawing_flow_hours') {
      setKrUnit(isAr ? 'ساعات' : 'hours');
      setKrTarget(15);
    } else if (src === 'drawing_artworks_count') {
      setKrUnit(isAr ? 'أعمال' : 'artworks');
      setKrTarget(20);
    } else if (src === 'quran_ayahs_memorized') {
      setKrUnit(isAr ? 'آيات' : 'ayahs');
      setKrTarget(100);
    } else if (src === 'quran_surahs_completed') {
      setKrUnit(isAr ? 'سور' : 'surahs');
      setKrTarget(3);
    } else if (src === 'quran_revision_sessions') {
      setKrUnit(isAr ? 'جلسات' : 'sessions');
      setKrTarget(14);
    } else if (src === 'quran_total_minutes') {
      setKrUnit(isAr ? 'دقيقة' : 'mins');
      setKrTarget(300);
    } else {
      setKrUnit('%');
      setKrTarget(100);
    }
  };

  const handleCreateKr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!krTitle.trim()) return;

    addKeyResult(goal.id, {
      title: krTitle.trim(),
      startValue: Number(krStart) || 0,
      targetValue: Number(krTarget) || 10,
      currentValue: Number(krStart) || 0,
      unit: krUnit.trim() || '%',
      dataSource: krSource
    });

    setKrTitle('');
    setIsAddingKr(false);
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;

    addGoalMilestone(goal.id, {
      title: msTitle.trim(),
      targetDate: msTargetDate || undefined,
      isCompleted: false
    });

    setMsTitle('');
    setMsTargetDate('');
    setIsAddingMs(false);
  };

  // Activity Pools for linking
  const linkedTaskIdsSet = new Set(goal.linkedTaskIds || []);
  const unlinkedTasks = tasks.filter((t) => !linkedTaskIdsSet.has(t.id) && t.linkedGoalId !== goal.id);

  const linkedHabitIdsSet = new Set(goal.linkedHabitIds || []);
  const unlinkedHabits = habits.filter((h) => !linkedHabitIdsSet.has(h.id) && h.linkedGoalId !== goal.id);

  // Books from reading habits
  const linkedBookIdsSet = new Set(goal.linkedBookIds || []);
  const allBooks = habits.flatMap((h) => h.readingData?.books || []);
  const unlinkedBooks = allBooks.filter((b) => !linkedBookIdsSet.has(b.id));

  // Projects from drawing habits
  const linkedProjectIdsSet = new Set(goal.linkedArtProjectIds || []);
  const allArtProjects = habits.flatMap((h) => h.drawingData?.projects || []);
  const unlinkedProjects = allArtProjects.filter((p) => !linkedProjectIdsSet.has(p.id));

  const priorityLabels: Record<string, { ar: string; en: string; badge: string }> = {
    urgent: { ar: 'عاجل جداً', en: 'Urgent', badge: 'bg-[var(--tone-danger-wash)] text-[var(--tone-danger)] border-[var(--tone-danger-line)]' },
    high: { ar: 'أولوية كبرى', en: 'High', badge: 'bg-[var(--tone-warning-wash)] text-[var(--tone-warning)] border-[var(--tone-warning-line)]' },
    medium: { ar: 'متوسط الأهمية', en: 'Medium', badge: 'bg-[var(--tone-info-wash)] text-[var(--tone-info)] border-[var(--tone-info-line)]' },
    low: { ar: 'أولوية عادية', en: 'Low', badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' }
  };

  const categoryLabels: Record<string, { ar: string; en: string; icon: IconName }> = {
    career: { ar: 'مهني وعمل', en: 'Career', icon: 'briefcase' },
    health: { ar: 'صحة وجسد', en: 'Health', icon: 'activity' },
    finance: { ar: 'مالي واستثمار', en: 'Finance', icon: 'coin' },
    personal: { ar: 'شخصي وعائلة', en: 'Personal', icon: 'leaf' },
    intellect: { ar: 'فكري وثقافي', en: 'Intellect', icon: 'brain' }
  };

  const dataSourceLabels: Record<KeyResultDataSource, { ar: string; en: string; icon: IconName }> = {
    manual: { ar: 'تحديث يدوي', en: 'Manual Entry', icon: 'edit' },
    tasks_completed: { ar: 'مهام مكتملة', en: 'Completed Tasks', icon: 'check' },
    habit_consistency: { ar: 'التزام العادات', en: 'Habit Cadence', icon: 'repeat' },
    reading_books_completed: { ar: 'كتب منجزة', en: 'Finished Books', icon: 'book' },
    reading_pages_read: { ar: 'صفحات مقروءة', en: 'Pages Read', icon: 'book-open' },
    reading_hours: { ar: 'ساعات القراءة', en: 'Reading Hours', icon: 'hourglass' },
    workout_sessions_count: { ar: 'حصص التمارين', en: 'Workout Sessions', icon: 'dumbbell' },
    workout_total_reps: { ar: 'تكرارات التمارين', en: 'Total Reps', icon: 'flame' },
    workout_total_minutes: { ar: 'دقائق التدريب', en: 'Workout Minutes', icon: 'timer' },
    drawing_projects_completed: { ar: 'مشاريع فنية مكتملة', en: 'Art Projects Completed', icon: 'trophy' },
    drawing_flow_hours: { ar: 'ساعات التدفق الفني', en: 'Flow Hours', icon: 'palette' },
    drawing_artworks_count: { ar: 'أعمال وسكتشات المعرض', en: 'Artworks Count', icon: 'image' },
    quran_ayahs_memorized: { ar: 'آيات قرآنية مثبتة', en: 'Distinct Ayahs Memorized', icon: 'quote' },
    quran_surahs_completed: { ar: 'سور قرآنية مكتملة', en: 'Surahs Completed', icon: 'book-open' },
    quran_revision_sessions: { ar: 'جلسات المراجعة والتسميع', en: 'Revision Sessions', icon: 'infinity' },
    quran_total_minutes: { ar: 'دقائق الحفظ والمراجعة', en: 'Quran Minutes', icon: 'timer' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <div
        className="panel max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-[var(--border-default)] shadow-2xl bg-[var(--surface-deep)]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-deep)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-chip)] text-accent border border-[var(--border-default)] font-semibold flex items-center gap-1">
                <NuqtaIcon name={categoryLabels[goal.category]?.icon ?? 'target'} className="w-3.5 h-3.5" />
                <span>{isAr ? categoryLabels[goal.category]?.ar : categoryLabels[goal.category]?.en}</span>
              </span>

              {goal.priority && (
                <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${priorityLabels[goal.priority]?.badge}`}>
                  {isAr ? priorityLabels[goal.priority]?.ar : priorityLabels[goal.priority]?.en}
                </span>
              )}

              {/* Pacing status pill */}
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded font-mono font-semibold border ${
                  intel.pacingStatus === 'ahead'
                    ? 'bg-[var(--tone-success-wash)] text-[var(--tone-success)] border-[var(--tone-success-line)]'
                    : intel.pacingStatus === 'dormant'
                    ? 'bg-[var(--tone-warning-wash)] text-[var(--tone-warning)] border-[var(--tone-warning-line)] animate-pulse'
                    : intel.pacingStatus === 'behind'
                    ? 'bg-[var(--tone-danger-wash)] text-[var(--tone-danger)] border-[var(--tone-danger-line)]'
                    : 'bg-[var(--tone-info-wash)] text-[var(--tone-info)] border-[var(--tone-info-line)]'
                }`}
              >
                <NuqtaIcon name={pacingIconName(intel.pacingStatus)} className="w-3 h-3" />
                {isAr ? intel.pacingLabelAr : intel.pacingLabelEn}
              </span>

              {goal.deadline && (
                <span className="text-xs text-muted font-mono">
                  {isAr ? 'الموعد:' : 'Due:'} {goal.deadline}{' '}
                  {intel.daysRemaining !== null && (
                    <span className={intel.daysRemaining < 0 ? 'text-[var(--tone-danger)] font-bold' : 'text-accent'}>
                      ({intel.daysRemaining >= 0 ? `${intel.daysRemaining}d left` : `${Math.abs(intel.daysRemaining)}d overdue`})
                    </span>
                  )}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] truncate">{goal.title}</h2>
            {goal.description && <p className="text-xs text-muted max-w-2xl">{goal.description}</p>}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onEditGoal(goal)}
              className="btn subtle small text-xs border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-faint)]"
            >
              <NuqtaIcon name="edit" className="w-3.5 h-3.5" />
              <span>{isAr ? 'تعديل الهدف' : 'Edit Goal'}</span>
            </button>

            {goal.status === 'archived' ? (
              <button
                onClick={() => {
                  restoreGoal(goal.id);
                  onClose();
                }}
                className="btn subtle small text-xs border-[var(--tone-info-line)] text-[var(--tone-info)] hover:bg-[var(--tone-info-wash)]"
                title={isAr ? 'استعادة الهدف إلى الأهداف النشطة' : 'Restore Goal'}
              >
                <NuqtaIcon name="restore" className="w-3.5 h-3.5" />
                <span>{isAr ? 'استعادة' : 'Restore'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  archiveGoal(goal.id);
                  onClose();
                }}
                className="btn subtle small text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                title={isAr ? 'أرشفة الهدف (مع حفظ كامل نتائجه ومساهماته التاريخية)' : 'Archive Goal'}
              >
                <NuqtaIcon name="archive" className="w-3.5 h-3.5" />
                <span>{isAr ? 'أرشفة' : 'Archive'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-[var(--text-primary)] hover:bg-[var(--surface-faint)]"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <NuqtaIcon name="close" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual Progress Engine Banner: Outcome vs Execution */}
        <div className="px-5 py-3.5 bg-[var(--surface-deep)] border-b border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Outcome Progress (Key Results & Measurable End State) */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--tone-success)]"></span>
                <span className="font-bold text-[var(--text-primary)] text-xs">{isAr ? 'النتيجة المحققة (Outcome Progress)' : 'Outcome Progress'}</span>
              </div>
              <span className="text-[var(--tone-success)] font-bold font-mono text-sm">{intel.outcomeProgressPercent}%</span>
            </div>
            <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-default)]">
              <div
                className="bg-[var(--tone-success)] h-full rounded-full transition-all duration-500"
                style={{ width: `${intel.outcomeProgressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted font-mono">
              <span>{intel.progressCalculationMethod}</span>
              <span>{intel.evaluatedKrs.length} {isAr ? 'نتائج رئيسية' : 'KRs'}</span>
            </div>
          </div>

          {/* 2. Execution Progress (Tasks Done & Habits Consistency) */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent"></span>
                <span className="font-bold text-[var(--text-primary)] text-xs">{isAr ? 'التقدم التنفيذي (Execution Progress)' : 'Execution Progress'}</span>
              </div>
              <span className="text-accent font-bold font-mono text-sm">{intel.executionProgressPercent}%</span>
            </div>
            <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-default)]">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${intel.executionProgressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted font-mono">
              <span>
                {intel.executionSummary.tasksCompleted}/{intel.executionSummary.tasksTotal} {isAr ? 'مهام' : 'tasks'} ({intel.executionSummary.tasksPercent}%)
              </span>
              <span>
                {intel.executionSummary.habitsConsistencyPercent}% {isAr ? 'التزام العادات' : 'cadence'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] px-5 bg-[var(--surface-deep)] text-xs">
          <button
            onClick={() => setActiveTab('krs')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'krs'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-[var(--text-primary)]'
            }`}
          >
            {isAr ? `النتائج الرئيسية (${intel.evaluatedKrs.length})` : `Key Results (${intel.evaluatedKrs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'milestones'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-[var(--text-primary)]'
            }`}
          >
            {isAr ? `المراحل الزمنية (${intel.milestonesTotal})` : `Milestones (${intel.milestonesTotal})`}
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'links'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-[var(--text-primary)]'
            }`}
          >
            {isAr ? 'إدارة الأنشطة المرتبطة' : 'Linked Activities'}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-[var(--text-primary)]'
            }`}
          >
            {isAr ? `سجل المساهمات والخط الزمني (${intel.contributions.length})` : `Timeline & History (${intel.contributions.length})`}
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-sm bg-gradient-to-b from-[var(--surface-deep)] to-[var(--surface-deep)]">
          {/* TAB 1: KEY RESULTS (النتائج الرئيسية) */}
          {activeTab === 'krs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'النتائج الرئيسية ومصادر البيانات الحية' : 'Key Results & Live Data Sources'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr
                      ? 'تُحسب النتائج المؤتمتة مباشرة من سجلات المهام والعادات والكتب والتمارين والرسم، دون تقديرات عشوائية.'
                      : 'Automated Key Results calculate directly from real domain activities without manual estimates.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingKr(!isAddingKr)}
                  className="btn primary small"
                >
                  {isAddingKr ? (isAr ? 'إلغاء' : 'Cancel') : `+ ${isAr ? 'نتيجة رئيسية جديدة' : 'Add Key Result'}`}
                </button>
              </div>

              {/* Form to add new KR */}
              {isAddingKr && (
                <form onSubmit={handleCreateKr} className="p-4 rounded-xl border border-accent/40 bg-[var(--surface-inset)] space-y-4 shadow-lg">
                  <h4 className="font-bold text-[var(--text-primary)] text-sm">
                    {isAr ? 'تعريف نتيجة رئيسية قابلة للقياس' : 'Define Measurable Key Result'}
                  </h4>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">{isAr ? 'عنوان النتيجة الرئيسية' : 'Key Result Metric Title'} *</label>
                    <input
                      type="text"
                      value={krTitle}
                      onChange={(e) => setKrTitle(e.target.value)}
                      className="input w-full text-xs font-semibold"
                      placeholder={isAr ? 'مثال: إتمام 15 مهمة برمجية، قراءة 300 صفحة، 400 تكرار تمرين' : 'e.g. Read 300 pages, log 400 reps'}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'مصدر البيانات وطريقة الاحتساب' : 'Data Source Engine'}</label>
                      <NuqtaSelect value={krSource} onChange={(e) => handleSourceChange(e.target.value as KeyResultDataSource)} className="text-xs">
                        <option value="tasks_completed">{isAr ? 'عدد المهام المكتملة المرتبطة' : 'Tasks: Completed Count'}</option>
                        <option value="habit_consistency">{isAr ? 'معدل التزام العادات المرتبطة (%)' : 'Habits: Cadence Rate (%)'}</option>
                        <option value="reading_books_completed">{isAr ? 'عدد الكتب المكتملة (مكتبة القراءة)' : 'Reading: Finished Books'}</option>
                        <option value="reading_pages_read">{isAr ? 'مجموع الصفحات المقروءة' : 'Reading: Pages Read'}</option>
                        <option value="reading_hours">{isAr ? 'ساعات جلسات القراءة' : 'Reading: Hours Logged'}</option>
                        <option value="workout_sessions_count">{isAr ? 'عدد حصص التمارين المنزلية' : 'Workout: Sessions Count'}</option>
                        <option value="workout_total_reps">{isAr ? 'مجموع تكرارات التمارين' : 'Workout: Total Reps'}</option>
                        <option value="workout_total_minutes">{isAr ? 'مدة التمارين الرياضية (دقائق)' : 'Workout: Total Minutes'}</option>
                        <option value="drawing_projects_completed">{isAr ? 'مشاريع الرسم المكتملة' : 'Drawing: Finished Projects'}</option>
                        <option value="drawing_flow_hours">{isAr ? 'ساعات التدفق في المرسم' : 'Drawing: Flow Hours'}</option>
                        <option value="drawing_artworks_count">{isAr ? 'عدد الأعمال والسكتشات' : 'Drawing: Artworks Count'}</option>
                        <option value="quran_ayahs_memorized">{isAr ? 'مجموع الآيات المحفوظة فعلياً' : 'Quran: Ayahs Memorized'}</option>
                        <option value="quran_surahs_completed">{isAr ? 'عدد السور المحفوظة بالكامل' : 'Quran: Surahs Completed'}</option>
                        <option value="quran_revision_sessions">{isAr ? 'عدد جلسات المراجعة والتسميع' : 'Quran: Revision Sessions'}</option>
                        <option value="quran_total_minutes">{isAr ? 'إجمالي دقائق الحفظ والمراجعة' : 'Quran: Total Minutes'}</option>
                        <option value="manual">{isAr ? 'نتيجة يدوية (تحديث مباشر)' : 'Manual Entry'}</option>
                      </NuqtaSelect>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'البداية' : 'Start'}</label>
                        <input
                          type="number"
                          value={krStart}
                          onChange={(e) => setKrStart(Number(e.target.value))}
                          className="input w-full text-xs font-mono"
                        />
                      </div>
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'الهدف' : 'Target'} *</label>
                        <input
                          type="number"
                          value={krTarget}
                          onChange={(e) => setKrTarget(Number(e.target.value))}
                          className="input w-full text-xs font-mono font-bold text-accent"
                          required
                        />
                      </div>
                      <div className="field">
                        <label className="text-xs text-muted mb-1 block">{isAr ? 'الوحدة' : 'Unit'}</label>
                        <input
                          type="text"
                          value={krUnit}
                          onChange={(e) => setKrUnit(e.target.value)}
                          className="input w-full text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button type="button" onClick={() => setIsAddingKr(false)} className="btn subtle small">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" className="btn primary small">
                      {isAr ? 'إضافة النتيجة' : 'Save Key Result'}
                    </button>
                  </div>
                </form>
              )}

              {/* KR List */}
              {intel.evaluatedKrs.length === 0 ? (
                <div className="p-8 text-center panel border border-[var(--border-subtle)] bg-[var(--surface-deep)] rounded-xl space-y-2">
                  <NuqtaIcon name="target" className="w-6 h-6" />
                  <p className="text-[var(--text-primary)] font-semibold">{isAr ? 'لم يتم تعريف نتائج رئيسية بعد' : 'No Key Results defined'}</p>
                  <p className="text-xs text-muted">{isAr ? 'أضف مؤشرات واضحة مستمدة من المهام أو القراءة أو التمارين لقياس تقدمك.' : 'Add measurable metrics to anchor execution.'}</p>
                  <button onClick={() => setIsAddingKr(true)} className="btn primary small mt-2">
                    + {isAr ? 'إضافة أول نتيجة' : 'Add First Key Result'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {intel.evaluatedKrs.map((kr) => {
                    const sourceInfo = dataSourceLabels[kr.dataSource || 'manual'] || dataSourceLabels.manual;
                    const isManual = !kr.dataSource || kr.dataSource === 'manual';

                    return (
                      <div
                        key={kr.id}
                        className="panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl space-y-3 hover:border-[var(--border-strong)] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent border border-[var(--border-default)] flex items-center gap-1 font-semibold">
                                <NuqtaIcon name={sourceInfo.icon} className="w-3 h-3" />
                                <span>{isAr ? sourceInfo.ar : sourceInfo.en}</span>
                              </span>
                              <h4 className="font-bold text-[var(--text-primary)] text-sm">{kr.title}</h4>
                            </div>
                            <span className="text-[11px] text-muted block">
                              {kr.dataExplanation}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <div className="text-end font-mono">
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {kr.evaluatedCurrentValue} <span className="text-xs text-muted font-normal">/ {kr.targetValue} {kr.unit}</span>
                              </span>
                              <span className="block text-xs text-accent font-bold">
                                {kr.progressPercent}%
                              </span>
                            </div>

                            <button
                              onClick={() => deleteKeyResult(goal.id, kr.id)}
                              className="text-muted hover:text-[var(--tone-danger)] text-xs p-1"
                              title={isAr ? 'حذف النتيجة' : 'Delete'}
                              aria-label={isAr ? 'حذف النتيجة' : 'Delete key result'}
                            >
                              <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-default)]">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${kr.progressPercent}%` }}
                          />
                        </div>

                        {/* Manual entry updater input */}
                        {isManual && (
                          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3">
                            <span className="text-[11px] text-muted">{isAr ? 'تحديث القيمة يدوياً:' : 'Update Value:'}</span>
                            <input
                              type="number"
                              min="0"
                              max={kr.targetValue * 2}
                              value={manualKrUpdates[kr.id] ?? kr.currentValue}
                              onChange={(e) =>
                                setManualKrUpdates({ ...manualKrUpdates, [kr.id]: Number(e.target.value) })
                              }
                              className="input w-24 text-xs font-mono font-bold py-1"
                            />
                            <button
                              onClick={() => {
                                const val = manualKrUpdates[kr.id] ?? kr.currentValue;
                                updateKeyResult(goal.id, kr.id, val);
                              }}
                              className="btn subtle small text-xs py-1 text-accent border-accent/40"
                            >
                              {isAr ? 'حفظ' : 'Update'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MILESTONES (المراحل الزمنية) */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'المراحل الزمنية المحورية (Milestones)' : 'Strategic Goal Milestones'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'محطات وسيطة تعينك على قياس المسار خطوة بخطوة حتى بلوغ الوجهة الكبرى.' : 'Intermediate checkpoints ensuring steady execution toward the finish line.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingMs(!isAddingMs)}
                  className="btn primary small"
                >
                  {isAddingMs ? (isAr ? 'إلغاء' : 'Cancel') : `+ ${isAr ? 'مرحلة جديدة' : 'Add Milestone'}`}
                </button>
              </div>

              {isAddingMs && (
                <form onSubmit={handleCreateMilestone} className="p-4 rounded-xl border border-accent/40 bg-[var(--surface-inset)] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'عنوان المرحلة' : 'Milestone Title'} *</label>
                      <input
                        type="text"
                        value={msTitle}
                        onChange={(e) => setMsTitle(e.target.value)}
                        className="input w-full text-xs font-semibold"
                        placeholder={isAr ? 'مثال: إتمام المسودة الأولية، إنهاء 5 كتب' : 'e.g. Complete alpha version'}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs text-muted mb-1 block">{isAr ? 'الموعد المستهدف' : 'Target Date'}</label>
                      <input
                        type="date"
                        value={msTargetDate}
                        onChange={(e) => setMsTargetDate(e.target.value)}
                        className="input w-full text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button type="button" onClick={() => setIsAddingMs(false)} className="btn subtle small">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" className="btn primary small">
                      {isAr ? 'حفظ المرحلة' : 'Save Milestone'}
                    </button>
                  </div>
                </form>
              )}

              {intel.milestonesTotal === 0 ? (
                <div className="p-8 text-center panel border border-[var(--border-subtle)] bg-[var(--surface-deep)] rounded-xl space-y-2">
                  <NuqtaIcon name="flag" className="w-6 h-6" />
                  <p className="text-[var(--text-primary)] font-semibold">{isAr ? 'لا توجد مراحل محددة بعد' : 'No milestones defined'}</p>
                  <p className="text-xs text-muted">{isAr ? 'قسّم هدفك إلى 3-5 مراحل رئيسية لضمان الاستمرارية.' : 'Break down your goal into actionable checkpoints.'}</p>
                  <button onClick={() => setIsAddingMs(true)} className="btn primary small mt-2">
                    + {isAr ? 'إضافة أول مرحلة' : 'Add First Milestone'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {goal.milestones?.map((ms) => (
                    <div
                      key={ms.id}
                      className={`panel p-3.5 border rounded-xl flex items-center justify-between transition-all ${
                        ms.isCompleted
                          ? 'border-[var(--tone-success-line)] bg-[var(--tone-success-wash)]'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleGoalMilestone(goal.id, ms.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs transition-colors ${
                            ms.isCompleted
                              ? 'bg-[var(--tone-success)] border-[var(--tone-success-line)] text-[var(--accent-ink)]'
                              : 'border-[var(--border-strong)] hover:border-[var(--tone-success-line)] bg-transparent'
                          }`}
                        >
                          {ms.isCompleted && <NuqtaIcon name="check" className="w-3 h-3" />}
                        </button>
                        <div>
                          <span
                            className={`text-sm font-semibold block ${
                              ms.isCompleted ? 'line-through text-muted' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {ms.title}
                          </span>
                          {ms.targetDate && (
                            <span className="text-[11px] text-muted font-mono">
                              {isAr ? 'مستهدف:' : 'Target:'} {ms.targetDate}
                              {ms.completedDate && ` · ${isAr ? 'اكتمل في' : 'Completed on'} ${ms.completedDate}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteGoalMilestone(goal.id, ms.id)}
                        className="text-muted hover:text-[var(--tone-danger)] text-xs px-2"
                        title={isAr ? 'حذف' : 'Delete'}
                        aria-label={isAr ? 'حذف المرحلة' : 'Delete milestone'}
                      >
                        <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LINKED ACTIVITIES (إدارة الأنشطة المرتبطة) */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              <div className="p-3 bg-[var(--surface-raised)] rounded-xl border border-accent/20 text-xs text-accent">
                ℹ️ {isAr
                  ? 'إلغاء ربط أي نشاط يزيل صلته الإحصائية بالهدف فقط، ولا يحذف المهمة أو العادة أو بياناتها الأصلية إطلاقاً.'
                  : 'Unlinking an activity safely removes its statistical reference without deleting original tasks, habits, books, or art projects.'}
              </div>

              {/* 1. Linked Tasks */}
              <div className="space-y-3 panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                      <NuqtaIcon name="check" className="w-3.5 h-3.5" />
                      <span>{isAr ? 'المهام التنفيذية المرتبطة' : 'Linked Tasks'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedTasksCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'المهام اليومية التي تسهم مباشرة في تحقيق النتيجة.' : 'Execution tasks contributing to goal momentum.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {unlinkedTasks.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <NuqtaSelect value={selectedTaskToLink} onChange={(e) => setSelectedTaskToLink(e.target.value)} className="text-xs">
                          <option value="">{isAr ? '-- اختر مهمة لربطها --' : '-- Select task to link --'}</option>
                          {unlinkedTasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.status})
                            </option>
                          ))}
                        </NuqtaSelect>
                        <button
                          disabled={!selectedTaskToLink}
                          onClick={() => {
                            if (selectedTaskToLink) {
                              linkActivityToGoal(goal.id, 'task', selectedTaskToLink);
                              setSelectedTaskToLink('');
                            }
                          }}
                          className="btn primary small text-xs py-1 disabled:opacity-50"
                        >
                          + {isAr ? 'ربط' : 'Link'}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsCreatingTask(!isCreatingTask)}
                      className="btn subtle small text-xs text-accent border border-accent/30 hover:bg-accent/15"
                    >
                      <span>+ {isAr ? 'مهمة جديدة لهذا الهدف' : 'New Task for Goal'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Quick Task Creator */}
                {isCreatingTask && (
                  <form onSubmit={handleCreateLinkedTask} className="p-3 rounded-xl bg-[var(--surface-deep)] border border-accent/30 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {isAr ? 'إنشاء مهمة جديدة مرتبطة بالهدف تلقائياً' : 'Create New Task Linked to Goal'}
                      </span>
                      <button type="button" onClick={() => setIsCreatingTask(false)} aria-label={isAr ? 'إغلاق' : 'Cancel'} className="text-muted hover:text-[var(--text-primary)]"><NuqtaIcon name="close" className="w-3.5 h-3.5" /></button>
                    </div>
                    <input
                      className="input text-xs"
                      value={quickTaskTitle}
                      onChange={(e) => setQuickTaskTitle(e.target.value)}
                      placeholder={isAr ? 'عنوان المهمة الجديدة...' : 'New task title...'}
                      autoFocus
                      required
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <NuqtaSelect value={quickTaskPriority} onChange={(e) => setQuickTaskPriority(Number(e.target.value) as any)} className="text-xs">
                          <option value={1}>{isAr ? 'Q1 - عاجل ومهم' : 'Q1 - Urgent & Important'}</option>
                          <option value={2}>{isAr ? 'Q2 - مهم' : 'Q2 - Important'}</option>
                          <option value={3}>{isAr ? 'Q3 - عاجل' : 'Q3 - Urgent'}</option>
                          <option value={4}>{isAr ? 'Q4 - عادي' : 'Q4 - Normal'}</option>
                        </NuqtaSelect>
                        <input
                          type="date"
                          className="input text-xs py-1"
                          value={quickTaskDate}
                          onChange={(e) => setQuickTaskDate(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" className="btn subtle small text-xs" onClick={() => setIsCreatingTask(false)}>
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button type="submit" className="btn primary small text-xs">
                          {isAr ? 'إضافة وربط بالهدف' : 'Add & Link'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5 pt-2">
                  {tasks
                    .filter((t) => (goal.linkedTaskIds || []).includes(t.id) || t.linkedGoalId === goal.id)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${t.status === 'completed' ? 'bg-[var(--tone-success)]' : 'bg-[var(--tone-warning)]'}`} />
                          <span className={`truncate ${t.status === 'completed' ? 'line-through text-muted' : 'text-[var(--text-primary)] font-medium'}`}>
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'task', t.id)}
                          className="text-muted hover:text-[var(--tone-danger)] text-xs px-2 py-0.5"
                          title={isAr ? 'إلغاء الربط' : 'Unlink'}
                        >
                          {isAr ? 'إلغاء الربط' : 'Unlink'}
                        </button>
                      </div>
                    ))}
                  {intel.linkedTasksCount === 0 && (
                    <span className="text-xs text-muted block italic py-1">{isAr ? 'لا توجد مهام مرتبطة حالياً.' : 'No tasks linked currently.'}</span>
                  )}
                </div>
              </div>

              {/* 2. Linked Habits */}
              <div className="space-y-3 panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                      <NuqtaIcon name="repeat" className="w-3.5 h-3.5" />
                      <span>{isAr ? 'العادات الروتينية المرتبطة' : 'Linked Habits'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedHabitsCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'عادات يومية تثبت الهوية السلوكية المرتبطة بالهدف.' : 'Daily behavioral loops anchoring the goal.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {unlinkedHabits.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <NuqtaSelect value={selectedHabitToLink} onChange={(e) => setSelectedHabitToLink(e.target.value)} className="text-xs">
                          <option value="">{isAr ? '-- اختر عادة لربطها --' : '-- Select habit to link --'}</option>
                          {unlinkedHabits.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.currentStreak}d streak)
                            </option>
                          ))}
                        </NuqtaSelect>
                        <button
                          disabled={!selectedHabitToLink}
                          onClick={() => {
                            if (selectedHabitToLink) {
                              linkActivityToGoal(goal.id, 'habit', selectedHabitToLink);
                              setSelectedHabitToLink('');
                            }
                          }}
                          className="btn primary small text-xs py-1 disabled:opacity-50"
                        >
                          + {isAr ? 'ربط' : 'Link'}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsCreatingHabit(!isCreatingHabit)}
                      className="btn subtle small text-xs text-accent border border-accent/30 hover:bg-accent/15"
                    >
                      <span>+ {isAr ? 'عادة جديدة لهذا الهدف' : 'New Habit for Goal'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Quick Habit Creator */}
                {isCreatingHabit && (
                  <form onSubmit={handleCreateLinkedHabit} className="p-3 rounded-xl bg-[var(--surface-deep)] border border-accent/30 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {isAr ? 'إنشاء عادة جديدة مرتبطة بالهدف تلقائياً' : 'Create New Habit Linked to Goal'}
                      </span>
                      <button type="button" onClick={() => setIsCreatingHabit(false)} aria-label={isAr ? 'إغلاق' : 'Cancel'} className="text-muted hover:text-[var(--text-primary)]"><NuqtaIcon name="close" className="w-3.5 h-3.5" /></button>
                    </div>
                    <input
                      className="input text-xs"
                      value={quickHabitName}
                      onChange={(e) => setQuickHabitName(e.target.value)}
                      placeholder={isAr ? 'اسم العادة الجديدة...' : 'New habit name...'}
                      autoFocus
                      required
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickHabitType('quran');
                          setQuickHabitName(isAr ? 'حفظ ومراجعة القرآن الكريم' : 'Quran Memorization & Revision');
                          setQuickHabitAnchor(isAr ? 'بعد صلاة الفجر -> أحفظ نصف صفحة وأراجع ورداً' : 'After Fajr -> memorize & revise portion');
                        }}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'quran'
                            ? 'border-[var(--tone-success-line)] bg-[var(--tone-success-wash)] text-[var(--text-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-muted'
                        }`}
                      >
                        <span className="block text-[var(--tone-success)]"><NuqtaIcon name="mosque" className="w-4 h-4" /></span>
                        <span className="text-[10px] font-bold block">{isAr ? 'حفظ القرآن' : 'Quran Studio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickHabitType('reading');
                          setQuickHabitName(isAr ? 'قراءة 20 صفحة يومياً' : 'Read 20 Pages Daily');
                          setQuickHabitAnchor(isAr ? 'بعد شاي المساء -> أفتح كتابي وأقرأ' : 'After evening tea -> open book');
                        }}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'reading'
                            ? 'border-[var(--tone-warning-line)] bg-[var(--tone-warning-wash)] text-[var(--text-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-muted'
                        }`}
                      >
                        <span className="block text-[var(--tone-warning)]"><NuqtaIcon name="book-open" className="w-4 h-4" /></span>
                        <span className="text-[10px] font-bold block">{isAr ? 'القراءة' : 'Reading Studio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickHabitType('workout');
                          setQuickHabitName(isAr ? 'تمارين الرشاقة والقوة المنزلية' : 'Home Calisthenics');
                          setQuickHabitAnchor(isAr ? 'بعد العمل -> أبدأ تمارين وزن الجسم' : 'After work -> workout');
                        }}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'workout'
                            ? 'border-[var(--tone-info-line)] bg-[var(--tone-info-wash)] text-[var(--text-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-muted'
                        }`}
                      >
                        <span className="block text-[var(--tone-info)]"><NuqtaIcon name="dumbbell" className="w-4 h-4" /></span>
                        <span className="text-[10px] font-bold block">{isAr ? 'التمارين' : 'Workout Studio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickHabitType('drawing');
                          setQuickHabitName(isAr ? 'اسكتش ورسم إبداعي يومي' : 'Daily Art Sketch');
                          setQuickHabitAnchor(isAr ? 'في المساء -> أرسم لوحة أو اسكتش' : 'Evening -> sketch piece');
                        }}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'drawing'
                            ? 'border-[var(--tone-purple-line)] bg-[var(--tone-purple-wash)] text-[var(--text-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-muted'
                        }`}
                      >
                        <span className="block text-[var(--tone-purple)]"><NuqtaIcon name="palette" className="w-4 h-4" /></span>
                        <span className="text-[10px] font-bold block">{isAr ? 'المرسم' : 'Drawing Studio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickHabitType('standard')}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'standard'
                            ? 'border-accent bg-accent/20 text-[var(--text-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-muted'
                        }`}
                      >
                        <span className="block text-accent"><NuqtaIcon name="check" className="w-4 h-4" /></span>
                        <span className="text-[10px] font-bold block">{isAr ? 'عادة عامة' : 'Standard Habit'}</span>
                      </button>
                    </div>
                    <input
                      className="input text-xs"
                      value={quickHabitAnchor}
                      onChange={(e) => setQuickHabitAnchor(e.target.value)}
                      placeholder={isAr ? 'المحفز السلوكي (بعد أن [أفعل كذا] -> سأقوم بالعادة)...' : 'Habit anchor cue (After [X] -> I will [Y])...'}
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button type="button" className="btn subtle small text-xs" onClick={() => setIsCreatingHabit(false)}>
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button type="submit" className="btn primary small text-xs">
                        {isAr ? 'إنشاء وربط بالهدف' : 'Create & Link'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5 pt-2">
                  {habits
                    .filter((h) => (goal.linkedHabitIds || []).includes(h.id) || h.linkedGoalId === goal.id)
                    .map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <NuqtaIcon name="repeat" className="w-3.5 h-3.5 text-accent" />
                          <span className="text-[var(--text-primary)] font-medium truncate">{h.name}</span>
                          <span className="text-[11px] text-muted font-mono">({h.currentStreak} {isAr ? 'يوم' : 'd'})</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'habit', h.id)}
                          className="text-muted hover:text-[var(--tone-danger)] text-xs px-2 py-0.5"
                          title={isAr ? 'إلغاء الربط' : 'Unlink'}
                        >
                          {isAr ? 'إلغاء الربط' : 'Unlink'}
                        </button>
                      </div>
                    ))}
                  {intel.linkedHabitsCount === 0 && (
                    <span className="text-xs text-muted block italic py-1">{isAr ? 'لا توجد عادات مرتبطة حالياً.' : 'No habits linked currently.'}</span>
                  )}
                </div>
              </div>

              {/* 3. Linked Books from Reading Studio */}
              <div className="space-y-3 panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                      <NuqtaIcon name="book-open" className="w-3.5 h-3.5" />
                      <span>{isAr ? 'الكتب المرتبطة (نظام القراءة)' : 'Linked Books (Reading Studio)'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedBooksCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'كتب معينة من مكتبتك يُحسب تقدمها في هذا الهدف.' : 'Specific books contributing pages & completion.'}</p>
                  </div>

                  {unlinkedBooks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <NuqtaSelect value={selectedBookToLink} onChange={(e) => setSelectedBookToLink(e.target.value)} className="text-xs">
                        <option value="">{isAr ? '-- اختر كتاباً لربطه --' : '-- Select book to link --'}</option>
                        {unlinkedBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.currentPage}/{b.totalPages}p)
                          </option>
                        ))}
                      </NuqtaSelect>
                      <button
                        disabled={!selectedBookToLink}
                        onClick={() => {
                          if (selectedBookToLink) {
                            linkActivityToGoal(goal.id, 'book', selectedBookToLink);
                            setSelectedBookToLink('');
                          }
                        }}
                        className="btn primary small text-xs py-1 disabled:opacity-50"
                      >
                        + {isAr ? 'ربط' : 'Link'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  {allBooks
                    .filter((b) => (goal.linkedBookIds || []).includes(b.id))
                    .map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <NuqtaIcon name="book-open" className="w-3.5 h-3.5 text-[var(--tone-warning)]" />
                          <span className="text-[var(--text-primary)] font-medium truncate">{b.title}</span>
                          <span className="text-[11px] text-muted font-mono">({b.currentPage}/{b.totalPages} ص · {b.status})</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'book', b.id)}
                          className="text-muted hover:text-[var(--tone-danger)] text-xs px-2 py-0.5"
                          title={isAr ? 'إلغاء الربط' : 'Unlink'}
                        >
                          {isAr ? 'إلغاء الربط' : 'Unlink'}
                        </button>
                      </div>
                    ))}
                  {intel.linkedBooksCount === 0 && (
                    <span className="text-xs text-muted block italic py-1">{isAr ? 'لا توجد كتب مخصصة مرتبطة.' : 'No specific books linked.'}</span>
                  )}
                </div>
              </div>

              {/* 4. Linked Art Projects from Drawing Studio */}
              <div className="space-y-3 panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                      <NuqtaIcon name="palette" className="w-3.5 h-3.5" />
                      <span>{isAr ? 'المشاريع الفنية المرتبطة (مرسم الفن)' : 'Linked Art Projects (Creative Studio)'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedArtProjectsCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'مشاريع ولوحات يتابع الهدف إتمام مراحلها وتدفقها.' : 'Creative projects tracked for completion.'}</p>
                  </div>

                  {unlinkedProjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <NuqtaSelect value={selectedProjectToLink} onChange={(e) => setSelectedProjectToLink(e.target.value)} className="text-xs">
                        <option value="">{isAr ? '-- اختر مشروعاً لربطه --' : '-- Select project to link --'}</option>
                        {unlinkedProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.stage})
                          </option>
                        ))}
                      </NuqtaSelect>
                      <button
                        disabled={!selectedProjectToLink}
                        onClick={() => {
                          if (selectedProjectToLink) {
                            linkActivityToGoal(goal.id, 'artProject', selectedProjectToLink);
                            setSelectedProjectToLink('');
                          }
                        }}
                        className="btn primary small text-xs py-1 disabled:opacity-50"
                      >
                        + {isAr ? 'ربط' : 'Link'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  {allArtProjects
                    .filter((p) => (goal.linkedArtProjectIds || []).includes(p.id))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <NuqtaIcon name="palette" className="w-3.5 h-3.5 text-[var(--tone-purple)]" />
                          <span className="text-[var(--text-primary)] font-medium truncate">{p.title}</span>
                          <span className="text-[11px] text-muted font-mono">({p.stage} · {p.sessionsCount} sessions)</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'artProject', p.id)}
                          className="text-muted hover:text-[var(--tone-danger)] text-xs px-2 py-0.5"
                          title={isAr ? 'إلغاء الربط' : 'Unlink'}
                        >
                          {isAr ? 'إلغاء الربط' : 'Unlink'}
                        </button>
                      </div>
                    ))}
                  {intel.linkedArtProjectsCount === 0 && (
                    <span className="text-xs text-muted block italic py-1">{isAr ? 'لا توجد مشاريع فنية مرتبطة.' : 'No art projects linked.'}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TIMELINE & ACTIVITY LOG (سجل المساهمات والخط الزمني) */}
          {activeTab === 'timeline' && (
            <div className="space-y-5">
              {/* Schedule Pacing Comparison Card */}
              <div className="panel p-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] rounded-xl space-y-3">
                <h4 className="font-bold text-[var(--text-primary)] text-sm">
                  {isAr ? 'مقارنة وتيرة الإنجاز بالجدول الزمني (Timeline Pacing)' : 'Timeline & Execution Velocity'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)]">
                    <span className="text-muted block text-[11px]">{isAr ? 'المدة الزمنية المنقضية' : 'Time Elapsed'}</span>
                    <strong className="text-lg font-mono text-[var(--text-primary)] font-bold block mt-1">
                      {intel.timeElapsedPercent !== null ? `${intel.timeElapsedPercent}%` : (isAr ? 'غير محدد' : 'N/A')}
                    </strong>
                    <span className="text-[10px] text-muted">{isAr ? 'من تاريخ البداية حتى الموعد' : 'start to deadline'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)]">
                    <span className="text-muted block text-[11px]">{isAr ? 'نسبة التقدم المحرز' : 'Actual Progress'}</span>
                    <strong className="text-lg font-mono text-accent font-bold block mt-1">
                      {intel.overallProgressPercent}%
                    </strong>
                    <span className="text-[10px] text-muted">{isAr ? 'متوسط النتائج والمراحل' : 'aggregated velocity'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-default)]">
                    <span className="text-muted block text-[11px]">{isAr ? 'تقييم الوتيرة والإيقاع' : 'Pacing Status'}</span>
                    <strong className="text-sm font-semibold text-[var(--tone-success)] mt-1 inline-flex items-center gap-1.5">
                      <NuqtaIcon name={pacingIconName(intel.pacingStatus)} className="w-3.5 h-3.5" />
                      {isAr ? intel.pacingLabelAr : intel.pacingLabelEn}
                    </strong>
                    <span className="text-[10px] text-muted">
                      {intel.lastActivityDate
                        ? (isAr ? `آخر نشاط: ${intel.lastActivityDate}` : `Last logged: ${intel.lastActivityDate}`)
                        : (isAr ? 'لا يوجد نشاط مسجل' : 'No recent activity')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contribution Activity Log Feed */}
              <div className="space-y-3">
                <h4 className="font-bold text-[var(--text-primary)] text-sm">
                  {isAr ? 'سجل المساهمات والأنشطة الفعلية (Contribution Audit)' : 'Activity Contribution Audit Trail'}
                </h4>

                {intel.contributions.length === 0 ? (
                  <div className="p-8 text-center panel border border-[var(--border-subtle)] bg-[var(--surface-deep)] rounded-xl space-y-2">
                    <NuqtaIcon name="hourglass" className="w-6 h-6" />
                    <p className="text-[var(--text-primary)] font-semibold">{isAr ? 'لا توجد مساهمات مسجلة بعد' : 'No contribution records yet'}</p>
                    <p className="text-xs text-muted">
                      {isAr
                        ? 'عند إنجاز مهامك أو تسجيل جلسات قراءة أو تمارين أو رسم مرتبطة، ستظهر هنا تلقائياً في الخط الزمني.'
                        : 'Completed linked tasks, workouts, reading, or sketches will stream here automatically.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {intel.contributions.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[var(--surface-chip)] text-accent flex items-center justify-center shrink-0 border border-[var(--border-default)]">
                            <NuqtaIcon name={item.icon} className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <h5 className="font-bold text-[var(--text-primary)] truncate text-xs">{item.title}</h5>
                            <span className="text-[11px] text-muted block">{item.contributionNote}</span>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-muted shrink-0">
                          {item.date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

