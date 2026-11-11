import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { Goal, KeyResult, KeyResultDataSource, GoalMilestone, SpecializedHabitType } from '../types';
import { useNuqtaStore } from '../store/nuqtaStore';
import { evaluateGoalProgress } from '../lib/goalProgressEngine';

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
    urgent: { ar: 'عاجل جداً', en: 'Urgent', badge: 'bg-red-500/15 text-red-300 border-red-500/30' },
    high: { ar: 'أولوية كبرى', en: 'High', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    medium: { ar: 'متوسط الأهمية', en: 'Medium', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    low: { ar: 'أولوية عادية', en: 'Low', badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' }
  };

  const categoryLabels: Record<string, { ar: string; en: string; icon: string }> = {
    career: { ar: 'مهني وعمل', en: 'Career', icon: '💼' },
    health: { ar: 'صحة وجسد', en: 'Health', icon: '⚡' },
    finance: { ar: 'مالي واستثمار', en: 'Finance', icon: '🪙' },
    personal: { ar: 'شخصي وعائلة', en: 'Personal', icon: '🌱' },
    intellect: { ar: 'فكري وثقافي', en: 'Intellect', icon: '🧠' }
  };

  const dataSourceLabels: Record<KeyResultDataSource, { ar: string; en: string; icon: string }> = {
    manual: { ar: 'تحديث يدوي', en: 'Manual Entry', icon: '✏️' },
    tasks_completed: { ar: 'مهام مكتملة', en: 'Completed Tasks', icon: '✓' },
    habit_consistency: { ar: 'التزام العادات', en: 'Habit Cadence', icon: '↻' },
    reading_books_completed: { ar: 'كتب منجزة', en: 'Finished Books', icon: '📚' },
    reading_pages_read: { ar: 'صفحات مقروءة', en: 'Pages Read', icon: '📖' },
    reading_hours: { ar: 'ساعات القراءة', en: 'Reading Hours', icon: '⌛' },
    workout_sessions_count: { ar: 'حصص التمارين', en: 'Workout Sessions', icon: '⚡' },
    workout_total_reps: { ar: 'تكرارات التمارين', en: 'Total Reps', icon: '💪' },
    workout_total_minutes: { ar: 'دقائق التدريب', en: 'Workout Minutes', icon: '⏱️' },
    drawing_projects_completed: { ar: 'مشاريع فنية مكتملة', en: 'Art Projects Completed', icon: '🏆' },
    drawing_flow_hours: { ar: 'ساعات التدفق الفني', en: 'Flow Hours', icon: '🎨' },
    drawing_artworks_count: { ar: 'أعمال وسكتشات المعرض', en: 'Artworks Count', icon: '🖼️' },
    quran_ayahs_memorized: { ar: 'آيات قرآنية مثبتة', en: 'Distinct Ayahs Memorized', icon: '📜' },
    quran_surahs_completed: { ar: 'سور قرآنية مكتملة', en: 'Surahs Completed', icon: '📖' },
    quran_revision_sessions: { ar: 'جلسات المراجعة والتسميع', en: 'Revision Sessions', icon: '🔁' },
    quran_total_minutes: { ar: 'دقائق الحفظ والمراجعة', en: 'Quran Minutes', icon: '⏱️' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <div
        className="panel max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-[#26372d] shadow-2xl bg-[#0b0f13]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-[#1c2921] bg-[#10171a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#16231c] text-accent border border-[#23382c] font-semibold flex items-center gap-1">
                <span>{categoryLabels[goal.category]?.icon || '🎯'}</span>
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
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : intel.pacingStatus === 'dormant'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                    : intel.pacingStatus === 'behind'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                }`}
              >
                {isAr ? intel.pacingLabelAr : intel.pacingLabelEn}
              </span>

              {goal.deadline && (
                <span className="text-xs text-muted font-mono">
                  {isAr ? 'الموعد:' : 'Due:'} {goal.deadline}{' '}
                  {intel.daysRemaining !== null && (
                    <span className={intel.daysRemaining < 0 ? 'text-red-400 font-bold' : 'text-accent'}>
                      ({intel.daysRemaining >= 0 ? `${intel.daysRemaining}d left` : `${Math.abs(intel.daysRemaining)}d overdue`})
                    </span>
                  )}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{goal.title}</h2>
            {goal.description && <p className="text-xs text-muted max-w-2xl">{goal.description}</p>}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onEditGoal(goal)}
              className="btn subtle small text-xs border-[#23382c] text-white hover:bg-white/5"
            >
              <span>✏️</span>
              <span>{isAr ? 'تعديل الهدف' : 'Edit Goal'}</span>
            </button>

            {goal.status === 'archived' ? (
              <button
                onClick={() => {
                  restoreGoal(goal.id);
                  onClose();
                }}
                className="btn subtle small text-xs border-teal-500/30 text-teal-300 hover:bg-teal-500/15"
                title={isAr ? 'استعادة الهدف إلى الأهداف النشطة' : 'Restore Goal'}
              >
                <span>↩</span>
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
                <span>🗄️</span>
                <span>{isAr ? 'أرشفة' : 'Archive'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 text-lg font-bold"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dual Progress Engine Banner: Outcome vs Execution */}
        <div className="px-5 py-3.5 bg-[#0d1414] border-b border-[#1c2921] grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Outcome Progress (Key Results & Measurable End State) */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[#11191d] border border-[#1e2e26]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-bold text-white text-xs">{isAr ? 'النتيجة المحققة (Outcome Progress)' : 'Outcome Progress'}</span>
              </div>
              <span className="text-emerald-400 font-bold font-mono text-sm">{intel.outcomeProgressPercent}%</span>
            </div>
            <div className="w-full bg-[#16231c] rounded-full h-2 overflow-hidden border border-[#23382c]">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${intel.outcomeProgressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted font-mono">
              <span>{intel.progressCalculationMethod}</span>
              <span>{intel.evaluatedKrs.length} {isAr ? 'نتائج رئيسية' : 'KRs'}</span>
            </div>
          </div>

          {/* 2. Execution Progress (Tasks Done & Habits Consistency) */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[#11191d] border border-[#1e2e26]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent"></span>
                <span className="font-bold text-white text-xs">{isAr ? 'التقدم التنفيذي (Execution Progress)' : 'Execution Progress'}</span>
              </div>
              <span className="text-accent font-bold font-mono text-sm">{intel.executionProgressPercent}%</span>
            </div>
            <div className="w-full bg-[#16231c] rounded-full h-2 overflow-hidden border border-[#23382c]">
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
        <div className="flex border-b border-[#1c2921] px-5 bg-[#0e1619] text-xs">
          <button
            onClick={() => setActiveTab('krs')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'krs'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {isAr ? `النتائج الرئيسية (${intel.evaluatedKrs.length})` : `Key Results (${intel.evaluatedKrs.length})`}
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'milestones'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {isAr ? `المراحل الزمنية (${intel.milestonesTotal})` : `Milestones (${intel.milestonesTotal})`}
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'links'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {isAr ? 'إدارة الأنشطة المرتبطة' : 'Linked Activities'}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {isAr ? `سجل المساهمات والخط الزمني (${intel.contributions.length})` : `Timeline & History (${intel.contributions.length})`}
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-sm bg-gradient-to-b from-[#0e1518] to-[#0a0e11]">
          {/* TAB 1: KEY RESULTS (النتائج الرئيسية) */}
          {activeTab === 'krs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">
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
                <form onSubmit={handleCreateKr} className="p-4 rounded-xl border border-accent/40 bg-[#121c18] space-y-4 shadow-lg">
                  <h4 className="font-bold text-white text-sm">
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
                      <select
                        className="select w-full text-xs"
                        value={krSource}
                        onChange={(e) => handleSourceChange(e.target.value as KeyResultDataSource)}
                      >
                        <option value="tasks_completed">{isAr ? '✓ عدد المهام المكتملة المرتبطة' : 'Tasks: Completed Count'}</option>
                        <option value="habit_consistency">{isAr ? '↻ معدل التزام العادات المرتبطة (%)' : 'Habits: Cadence Rate (%)'}</option>
                        <option value="reading_books_completed">{isAr ? '📚 عدد الكتب المكتملة (مكتبة القراءة)' : 'Reading: Finished Books'}</option>
                        <option value="reading_pages_read">{isAr ? '📖 مجموع الصفحات المقروءة' : 'Reading: Pages Read'}</option>
                        <option value="reading_hours">{isAr ? '⌛ ساعات جلسات القراءة' : 'Reading: Hours Logged'}</option>
                        <option value="workout_sessions_count">{isAr ? '⚡ عدد حصص التمارين المنزلية' : 'Workout: Sessions Count'}</option>
                        <option value="workout_total_reps">{isAr ? '💪 مجموع تكرارات التمارين' : 'Workout: Total Reps'}</option>
                        <option value="workout_total_minutes">{isAr ? '⏱️ مدة التمارين الرياضية (دقائق)' : 'Workout: Total Minutes'}</option>
                        <option value="drawing_projects_completed">{isAr ? '🏆 مشاريع الرسم المكتملة' : 'Drawing: Finished Projects'}</option>
                        <option value="drawing_flow_hours">{isAr ? '🎨 ساعات التدفق في المرسم' : 'Drawing: Flow Hours'}</option>
                        <option value="drawing_artworks_count">{isAr ? '🖼️ عدد الأعمال والسكتشات' : 'Drawing: Artworks Count'}</option>
                        <option value="quran_ayahs_memorized">{isAr ? '📜 مجموع الآيات المحفوظة فعلياً' : 'Quran: Ayahs Memorized'}</option>
                        <option value="quran_surahs_completed">{isAr ? '🕌 عدد السور المحفوظة بالكامل' : 'Quran: Surahs Completed'}</option>
                        <option value="quran_revision_sessions">{isAr ? '🔁 عدد جلسات المراجعة والتسميع' : 'Quran: Revision Sessions'}</option>
                        <option value="quran_total_minutes">{isAr ? '⏱️ إجمالي دقائق الحفظ والمراجعة' : 'Quran: Total Minutes'}</option>
                        <option value="manual">{isAr ? '✏️ نتيجة يدوية (تحديث مباشر)' : 'Manual Entry'}</option>
                      </select>
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

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2921]">
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
                <div className="p-8 text-center panel border border-[#1c2921] bg-[#0c1214] rounded-xl space-y-2">
                  <span className="text-2xl">🎯</span>
                  <p className="text-white font-semibold">{isAr ? 'لم يتم تعريف نتائج رئيسية بعد' : 'No Key Results defined'}</p>
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
                        className="panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl space-y-3 hover:border-[#2b4134] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#182620] text-accent border border-[#263e32] flex items-center gap-1 font-semibold">
                                <span>{sourceInfo.icon}</span>
                                <span>{isAr ? sourceInfo.ar : sourceInfo.en}</span>
                              </span>
                              <h4 className="font-bold text-white text-sm">{kr.title}</h4>
                            </div>
                            <span className="text-[11px] text-muted block">
                              {kr.dataExplanation}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <div className="text-end font-mono">
                              <span className="text-sm font-bold text-white">
                                {kr.evaluatedCurrentValue} <span className="text-xs text-muted font-normal">/ {kr.targetValue} {kr.unit}</span>
                              </span>
                              <span className="block text-xs text-accent font-bold">
                                {kr.progressPercent}%
                              </span>
                            </div>

                            <button
                              onClick={() => deleteKeyResult(goal.id, kr.id)}
                              className="text-muted hover:text-red-400 text-xs p-1"
                              title={isAr ? 'حذف النتيجة' : 'Delete'}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[#182620] rounded-full h-2 overflow-hidden border border-[#23382c]">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${kr.progressPercent}%` }}
                          />
                        </div>

                        {/* Manual entry updater input */}
                        {isManual && (
                          <div className="pt-2 border-t border-[#1a2822] flex items-center gap-3">
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
                              {isAr ? 'حفظ ✓' : 'Update ✓'}
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
                  <h3 className="font-bold text-white text-base">
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
                <form onSubmit={handleCreateMilestone} className="p-4 rounded-xl border border-accent/40 bg-[#121c18] space-y-3">
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

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2921]">
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
                <div className="p-8 text-center panel border border-[#1c2921] bg-[#0c1214] rounded-xl space-y-2">
                  <span className="text-2xl">🚩</span>
                  <p className="text-white font-semibold">{isAr ? 'لا توجد مراحل محددة بعد' : 'No milestones defined'}</p>
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
                          ? 'border-emerald-500/30 bg-emerald-950/15'
                          : 'border-[#1c2921] bg-[#11191d]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleGoalMilestone(goal.id, ms.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs transition-colors ${
                            ms.isCompleted
                              ? 'bg-emerald-500 border-emerald-400 text-black'
                              : 'border-[#2c4033] hover:border-emerald-400 bg-transparent'
                          }`}
                        >
                          {ms.isCompleted && '✓'}
                        </button>
                        <div>
                          <span
                            className={`text-sm font-semibold block ${
                              ms.isCompleted ? 'line-through text-muted' : 'text-white'
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
                        className="text-muted hover:text-red-400 text-xs px-2"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        ✕
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
              <div className="p-3 bg-[#111c16] rounded-xl border border-accent/20 text-xs text-accent">
                ℹ️ {isAr
                  ? 'إلغاء ربط أي نشاط يزيل صلته الإحصائية بالهدف فقط، ولا يحذف المهمة أو العادة أو بياناتها الأصلية إطلاقاً.'
                  : 'Unlinking an activity safely removes its statistical reference without deleting original tasks, habits, books, or art projects.'}
              </div>

              {/* 1. Linked Tasks */}
              <div className="space-y-3 panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>✓</span>
                      <span>{isAr ? 'المهام التنفيذية المرتبطة' : 'Linked Tasks'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedTasksCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'المهام اليومية التي تسهم مباشرة في تحقيق النتيجة.' : 'Execution tasks contributing to goal momentum.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {unlinkedTasks.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <select
                          className="select text-xs py-1"
                          value={selectedTaskToLink}
                          onChange={(e) => setSelectedTaskToLink(e.target.value)}
                        >
                          <option value="">{isAr ? '-- اختر مهمة لربطها --' : '-- Select task to link --'}</option>
                          {unlinkedTasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.status})
                            </option>
                          ))}
                        </select>
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
                  <form onSubmit={handleCreateLinkedTask} className="p-3 rounded-xl bg-[#0d1417] border border-accent/30 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {isAr ? 'إنشاء مهمة جديدة مرتبطة بالهدف تلقائياً' : 'Create New Task Linked to Goal'}
                      </span>
                      <button type="button" onClick={() => setIsCreatingTask(false)} className="text-muted hover:text-white text-xs">✕</button>
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
                        <select
                          className="select text-xs py-1"
                          value={quickTaskPriority}
                          onChange={(e) => setQuickTaskPriority(Number(e.target.value) as any)}
                        >
                          <option value={1}>{isAr ? 'Q1 - عاجل ومهم' : 'Q1 - Urgent & Important'}</option>
                          <option value={2}>{isAr ? 'Q2 - مهم' : 'Q2 - Important'}</option>
                          <option value={3}>{isAr ? 'Q3 - عاجل' : 'Q3 - Urgent'}</option>
                          <option value={4}>{isAr ? 'Q4 - عادي' : 'Q4 - Normal'}</option>
                        </select>
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
                          {isAr ? 'إضافة وربط بالهدف ✓' : 'Add & Link ✓'}
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
                        className="flex items-center justify-between p-2 rounded-lg bg-[#162126] border border-[#23353c] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${t.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className={`truncate ${t.status === 'completed' ? 'line-through text-muted' : 'text-white font-medium'}`}>
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'task', t.id)}
                          className="text-muted hover:text-red-400 text-xs px-2 py-0.5"
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
              <div className="space-y-3 panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>↻</span>
                      <span>{isAr ? 'العادات الروتينية المرتبطة' : 'Linked Habits'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedHabitsCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'عادات يومية تثبت الهوية السلوكية المرتبطة بالهدف.' : 'Daily behavioral loops anchoring the goal.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {unlinkedHabits.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <select
                          className="select text-xs py-1"
                          value={selectedHabitToLink}
                          onChange={(e) => setSelectedHabitToLink(e.target.value)}
                        >
                          <option value="">{isAr ? '-- اختر عادة لربطها --' : '-- Select habit to link --'}</option>
                          {unlinkedHabits.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.currentStreak}d streak)
                            </option>
                          ))}
                        </select>
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
                  <form onSubmit={handleCreateLinkedHabit} className="p-3 rounded-xl bg-[#0d1417] border border-accent/30 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {isAr ? 'إنشاء عادة جديدة مرتبطة بالهدف تلقائياً' : 'Create New Habit Linked to Goal'}
                      </span>
                      <button type="button" onClick={() => setIsCreatingHabit(false)} className="text-muted hover:text-white text-xs">✕</button>
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
                            ? 'border-emerald-400 bg-emerald-500/20 text-white'
                            : 'border-[#23353c] bg-[#11191d] text-muted'
                        }`}
                      >
                        <span className="block text-sm">📜</span>
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
                            ? 'border-amber-400 bg-amber-500/20 text-white'
                            : 'border-[#23353c] bg-[#11191d] text-muted'
                        }`}
                      >
                        <span className="block text-sm">📖</span>
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
                            ? 'border-teal-400 bg-teal-500/20 text-white'
                            : 'border-[#23353c] bg-[#11191d] text-muted'
                        }`}
                      >
                        <span className="block text-sm">⚡</span>
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
                            ? 'border-purple-400 bg-purple-500/20 text-white'
                            : 'border-[#23353c] bg-[#11191d] text-muted'
                        }`}
                      >
                        <span className="block text-sm">🎨</span>
                        <span className="text-[10px] font-bold block">{isAr ? 'المرسم' : 'Drawing Studio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickHabitType('standard')}
                        className={`p-1.5 rounded-lg border text-start transition-all ${
                          quickHabitType === 'standard'
                            ? 'border-accent bg-accent/20 text-white'
                            : 'border-[#23353c] bg-[#11191d] text-muted'
                        }`}
                      >
                        <span className="block text-sm">✓</span>
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
                        {isAr ? 'إنشاء وربط بالهدف ✓' : 'Create & Link ✓'}
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
                        className="flex items-center justify-between p-2 rounded-lg bg-[#162126] border border-[#23353c] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-accent">↻</span>
                          <span className="text-white font-medium truncate">{h.name}</span>
                          <span className="text-[11px] text-muted font-mono">({h.currentStreak} {isAr ? 'يوم' : 'd'})</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'habit', h.id)}
                          className="text-muted hover:text-red-400 text-xs px-2 py-0.5"
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
              <div className="space-y-3 panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>📖</span>
                      <span>{isAr ? 'الكتب المرتبطة (نظام القراءة)' : 'Linked Books (Reading Studio)'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedBooksCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'كتب معينة من مكتبتك يُحسب تقدمها في هذا الهدف.' : 'Specific books contributing pages & completion.'}</p>
                  </div>

                  {unlinkedBooks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        className="select text-xs py-1"
                        value={selectedBookToLink}
                        onChange={(e) => setSelectedBookToLink(e.target.value)}
                      >
                        <option value="">{isAr ? '-- اختر كتاباً لربطه --' : '-- Select book to link --'}</option>
                        {unlinkedBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.currentPage}/{b.totalPages}p)
                          </option>
                        ))}
                      </select>
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
                        className="flex items-center justify-between p-2 rounded-lg bg-[#162126] border border-[#23353c] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-amber-300">📖</span>
                          <span className="text-white font-medium truncate">{b.title}</span>
                          <span className="text-[11px] text-muted font-mono">({b.currentPage}/{b.totalPages} ص · {b.status})</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'book', b.id)}
                          className="text-muted hover:text-red-400 text-xs px-2 py-0.5"
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
              <div className="space-y-3 panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>🎨</span>
                      <span>{isAr ? 'المشاريع الفنية المرتبطة (مرسم الفن)' : 'Linked Art Projects (Creative Studio)'}</span>
                      <span className="text-xs text-muted font-mono">({intel.linkedArtProjectsCount})</span>
                    </h4>
                    <p className="text-[11px] text-muted">{isAr ? 'مشاريع ولوحات يتابع الهدف إتمام مراحلها وتدفقها.' : 'Creative projects tracked for completion.'}</p>
                  </div>

                  {unlinkedProjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        className="select text-xs py-1"
                        value={selectedProjectToLink}
                        onChange={(e) => setSelectedProjectToLink(e.target.value)}
                      >
                        <option value="">{isAr ? '-- اختر مشروعاً لربطه --' : '-- Select project to link --'}</option>
                        {unlinkedProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.stage})
                          </option>
                        ))}
                      </select>
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
                        className="flex items-center justify-between p-2 rounded-lg bg-[#162126] border border-[#23353c] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-purple-300">🎨</span>
                          <span className="text-white font-medium truncate">{p.title}</span>
                          <span className="text-[11px] text-muted font-mono">({p.stage} · {p.sessionsCount} sessions)</span>
                        </div>
                        <button
                          onClick={() => unlinkActivityFromGoal(goal.id, 'artProject', p.id)}
                          className="text-muted hover:text-red-400 text-xs px-2 py-0.5"
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
              <div className="panel p-4 border border-[#1c2921] bg-[#11191d] rounded-xl space-y-3">
                <h4 className="font-bold text-white text-sm">
                  {isAr ? 'مقارنة وتيرة الإنجاز بالجدول الزمني (Timeline Pacing)' : 'Timeline & Execution Velocity'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#162126] border border-[#23353c]">
                    <span className="text-muted block text-[11px]">{isAr ? 'المدة الزمنية المنقضية' : 'Time Elapsed'}</span>
                    <strong className="text-lg font-mono text-white font-bold block mt-1">
                      {intel.timeElapsedPercent !== null ? `${intel.timeElapsedPercent}%` : (isAr ? 'غير محدد' : 'N/A')}
                    </strong>
                    <span className="text-[10px] text-muted">{isAr ? 'من تاريخ البداية حتى الموعد' : 'start to deadline'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#162126] border border-[#23353c]">
                    <span className="text-muted block text-[11px]">{isAr ? 'نسبة التقدم المحرز' : 'Actual Progress'}</span>
                    <strong className="text-lg font-mono text-accent font-bold block mt-1">
                      {intel.overallProgressPercent}%
                    </strong>
                    <span className="text-[10px] text-muted">{isAr ? 'متوسط النتائج والمراحل' : 'aggregated velocity'}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#162126] border border-[#23353c]">
                    <span className="text-muted block text-[11px]">{isAr ? 'تقييم الوتيرة والإيقاع' : 'Pacing Status'}</span>
                    <strong className="text-sm font-semibold text-emerald-300 block mt-1">
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
                <h4 className="font-bold text-white text-sm">
                  {isAr ? 'سجل المساهمات والأنشطة الفعلية (Contribution Audit)' : 'Activity Contribution Audit Trail'}
                </h4>

                {intel.contributions.length === 0 ? (
                  <div className="p-8 text-center panel border border-[#1c2921] bg-[#0c1214] rounded-xl space-y-2">
                    <span className="text-2xl">⏳</span>
                    <p className="text-white font-semibold">{isAr ? 'لا توجد مساهمات مسجلة بعد' : 'No contribution records yet'}</p>
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
                        className="p-3 rounded-xl border border-[#1c2921] bg-[#11191d] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#182620] text-accent flex items-center justify-center font-bold text-sm shrink-0 border border-[#263e32]">
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <h5 className="font-bold text-white truncate text-xs">{item.title}</h5>
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

