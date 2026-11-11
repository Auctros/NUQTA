import { localDateKey } from '../lib/dateKey';
import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { Goal, GoalPriority, KeyResult, KeyResultDataSource } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { EmptyState, PageHeader } from './ui';
import { GoalDetailModal } from './GoalDetailModal';
import { evaluateGoalProgress } from '../lib/goalProgressEngine';

export const GoalsView: React.FC = () => {
  const {
    goals,
    tasks,
    habits,
    createGoal,
    updateGoal,
    deleteGoal,
    profile,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [inspectingGoal, setInspectingGoal] = useState<Goal | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVisionNotes, setFormVisionNotes] = useState('');
  const [formCategory, setFormCategory] = useState<Goal['category']>('career');
  const [formPriority, setFormPriority] = useState<GoalPriority>('medium');
  const [formTimeframe, setFormTimeframe] = useState<Goal['timeframe']>('quarterly');
  const [formStartDate, setFormStartDate] = useState(todayStr);
  const [formDeadline, setFormDeadline] = useState('');
  const [formKrTitle, setFormKrTitle] = useState('');
  const [formKrSource, setFormKrSource] = useState<KeyResultDataSource>('tasks_completed');
  const [formKrTarget, setFormKrTarget] = useState(10);
  const [formKrUnit, setFormKrUnit] = useState(isAr ? 'مهمة' : 'tasks');

  const openNewGoalModal = () => {
    setEditingGoal(null);
    setFormTitle('');
    setFormDescription('');
    setFormVisionNotes('');
    setFormCategory('career');
    setFormPriority('medium');
    setFormTimeframe('quarterly');
    setFormStartDate(todayStr);
    setFormDeadline('');
    setFormKrTitle(isAr ? 'النتيجة المحورية الأولى' : 'Core Milestone Metric');
    setFormKrSource('tasks_completed');
    setFormKrTarget(10);
    setFormKrUnit(isAr ? 'مهام' : 'tasks');
    setIsFormModalOpen(true);
  };

  const openEditGoalModal = (g: Goal) => {
    setEditingGoal(g);
    setFormTitle(g.title);
    setFormDescription(g.description || '');
    setFormVisionNotes(g.visionNotes || '');
    setFormCategory(g.category);
    setFormPriority(g.priority || 'medium');
    setFormTimeframe(g.timeframe);
    setFormStartDate(g.startDate || g.createdAt.split('T')[0]);
    setFormDeadline(g.deadline || '');
    setIsFormModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        visionNotes: formVisionNotes.trim(),
        category: formCategory,
        priority: formPriority,
        timeframe: formTimeframe,
        startDate: formStartDate || todayStr,
        deadline: formDeadline || undefined
      });
    } else {
      const initialKr: KeyResult = {
        id: 'kr-' + crypto.randomUUID().slice(0, 8),
        title: formKrTitle.trim() || (isAr ? 'المؤشر الأساسي' : 'Primary Metric'),
        targetValue: Number(formKrTarget) || 10,
        currentValue: 0,
        unit: formKrUnit.trim() || '%',
        dataSource: formKrSource
      };

      createGoal({
        title: formTitle.trim(),
        description: formDescription.trim(),
        visionNotes: formVisionNotes.trim(),
        category: formCategory,
        priority: formPriority,
        timeframe: formTimeframe,
        startDate: formStartDate || todayStr,
        deadline: formDeadline || undefined,
        keyResults: [initialKr],
        status: 'active'
      });
    }

    setIsFormModalOpen(false);
  };

  // Evaluate goals intelligence
  const evaluatedGoals = goals.map((g) => ({
    goal: g,
    intel: evaluateGoalProgress(g, tasks, habits)
  }));

  const filtered = evaluatedGoals.filter(({ goal, intel }) => {
    if (statusFilter === 'all') {
      if (goal.status === 'archived') return false;
    } else if (goal.status !== statusFilter) {
      return false;
    }
    if (categoryFilter !== 'all' && goal.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = goal.title.toLowerCase().includes(q);
      const matchDesc = (goal.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Summary Metrics
  const activeGoalsCount = goals.filter((g) => g.status === 'active').length;
  const avgActiveProgress = activeGoalsCount > 0
    ? Math.round(
        evaluatedGoals
          .filter(({ goal }) => goal.status === 'active')
          .reduce((sum, item) => sum + item.intel.overallProgressPercent, 0) / activeGoalsCount
      )
    : 0;
  const dormantCount = evaluatedGoals.filter(({ intel, goal }) => intel.isDormant && goal.status === 'active').length;
  const totalCompletedMilestones = goals.reduce(
    (sum, g) => sum + (g.milestones?.filter((m) => m.isCompleted).length || 0),
    0
  );

  const categoryLabels: Record<string, { ar: string; en: string; icon: string }> = {
    career: { ar: 'مهني وعمل', en: 'Career', icon: '💼' },
    health: { ar: 'صحة وجسد', en: 'Health', icon: '⚡' },
    finance: { ar: 'مالي واستثمار', en: 'Finance', icon: '🪙' },
    personal: { ar: 'شخصي وعائلة', en: 'Personal', icon: '🌱' },
    intellect: { ar: 'فكري وثقافي', en: 'Intellect', icon: '🧠' }
  };

  const priorityLabels: Record<string, { ar: string; en: string; badge: string }> = {
    urgent: { ar: 'عاجل', en: 'Urgent', badge: 'bg-red-500/15 text-red-300 border-red-500/30' },
    high: { ar: 'مرتفع', en: 'High', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    medium: { ar: 'متوسط', en: 'Medium', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    low: { ar: 'عادي', en: 'Low', badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' }
  };

  // Find currently inspecting goal updated instance
  const currentInspectingGoal = inspectingGoal
    ? goals.find((g) => g.id === inspectingGoal.id) || inspectingGoal
    : null;

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <PageHeader
        eyebrow="NUQTA / GOAL INTELLIGENCE"
        title={isAr ? 'إدارة الأهداف وذكاء التقدم' : 'Goal Management & Intelligence'}
        description={
          isAr
            ? 'ربط الأهداف الكبرى بالمهام والعادات وجلسات القراءة والتمارين والرسم، بحسابات واقعية مشتقة من السجلات الفعلية.'
            : 'Direct macro vision linked dynamically to tasks, habits, and specialized sub-systems with real derivation.'
        }
        actions={
          <button className="btn primary" onClick={openNewGoalModal}>
            <span className="btn-icon">+</span>
            <span>{isAr ? 'هدف استراتيجي جديد' : 'New Strategic Goal'}</span>
          </button>
        }
      />

      {/* KPI Intelligence Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'الأهداف النشطة' : 'Active Objectives'}</span>
          <strong className="text-2xl font-mono text-[var(--text-primary)] font-bold mt-1 block">
            {activeGoalsCount} <span className="text-xs text-muted font-normal">/ {goals.length}</span>
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'أهداف قيد التنفيذ' : 'in progress'}</span>
        </div>

        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'متوسط سرعة الإنجاز' : 'Avg Velocity'}</span>
          <strong className="text-2xl font-mono text-accent font-bold mt-1 block">
            {avgActiveProgress}%
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'متوسط النتائج النشطة' : 'across active goals'}</span>
        </div>

        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'المراحل المنجزة' : 'Milestones Hit'}</span>
          <strong className="text-2xl font-mono text-emerald-400 font-bold mt-1 block">
            {totalCompletedMilestones}
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'محطة زمنية مكتملة' : 'milestones completed'}</span>
        </div>

        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'يحتاج تنشيطاً' : 'Needs Momentum'}</span>
          <strong className={`text-2xl font-mono font-bold mt-1 block ${dormantCount > 0 ? 'text-amber-400' : 'text-muted'}`}>
            {dormantCount}
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'ركود ٧ أيام دون نشاط' : 'no activity > 7d'}</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="panel p-3.5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Status Tabs */}
          <div className="flex p-0.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-[var(--brand-soft)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'active' ? 'bg-[var(--brand-soft)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'النشطة' : 'Active'}
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'completed' ? 'bg-[var(--brand-soft)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'المكتملة' : 'Completed'}
            </button>
            <button
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'paused' ? 'bg-[var(--brand-soft)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'الموقوفة' : 'Paused'}
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'archived' ? 'bg-[var(--brand-soft)] text-accent font-bold' : 'text-muted hover:text-[var(--text-primary)]'
              }`}
            >
              {isAr ? 'المؤرشفة 🗄️' : 'Archived 🗄️'}
            </button>
          </div>

          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle text-xs py-1.5 px-3 flex items-center gap-1.5"
            title={isAr ? 'فتح الأرشيف والسجل الشامل' : 'Open Universal Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>

          {/* Category Dropdown */}
          <select
            className="select text-xs py-1"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
            <option value="career">{isAr ? '💼 مهني وعمل' : 'Career'}</option>
            <option value="health">{isAr ? '⚡ صحة وجسد' : 'Health'}</option>
            <option value="finance">{isAr ? '🪙 مالي واستثمار' : 'Finance'}</option>
            <option value="personal">{isAr ? '🌱 شخصي وعائلة' : 'Personal'}</option>
            <option value="intellect">{isAr ? '🧠 فكري وثقافي' : 'Intellect'}</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث في الأهداف...' : 'Search goals...'}
            className="input w-full text-xs ps-8"
          />
          <span className="absolute start-2.5 top-2.5 text-xs text-muted pointer-events-none">🔍</span>
        </div>
      </div>

      {/* Goal Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="target"
          title={isAr ? 'لا توجد أهداف مطابقة للفلاتر' : 'No goals found'}
          description={
            isAr
              ? 'قم بإنشاء هدف استراتيجي جديد واربطه بمهامك وعاداتك.'
              : 'Create a new strategic objective to anchor execution and drive momentum.'
          }
          action={
            <button className="btn primary" onClick={openNewGoalModal}>
              + {isAr ? 'إنشاء هدف جديد' : 'New Goal'}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(({ goal, intel }) => {
            const cat = categoryLabels[goal.category] || categoryLabels.career;
            const prio = priorityLabels[goal.priority || 'medium'] || priorityLabels.medium;

            return (
              <article
                key={goal.id}
                onClick={() => setInspectingGoal(goal)}
                className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl flex flex-col justify-between space-y-4 hover:border-accent/40 transition-all cursor-pointer shadow-lg hover:shadow-xl group"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-chip)] text-accent border border-[var(--border-strong)] font-semibold flex items-center gap-1">
                        <span>{cat.icon}</span>
                        <span>{isAr ? cat.ar : cat.en}</span>
                      </span>

                      {goal.priority && (
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${prio.badge}`}>
                          {isAr ? prio.ar : prio.en}
                        </span>
                      )}

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
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
                    </div>

                    <span className="text-lg font-mono font-bold text-accent">
                      {intel.overallProgressPercent}%
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-accent transition-colors leading-snug">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bars: Outcome vs Execution */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <span>🎯</span>
                        <span>{isAr ? 'النتائج:' : 'Outcome:'} {intel.outcomeProgressPercent}%</span>
                      </span>
                      <span className="text-teal-400 font-medium flex items-center gap-1">
                        <span>⚡</span>
                        <span>{isAr ? 'التنفيذ:' : 'Execution:'} {intel.executionProgressPercent}%</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]" title={isAr ? 'نسبة النتائج الرئيسية' : 'Outcome Key Results Progress'}>
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${intel.outcomeProgressPercent}%` }}
                        />
                      </div>
                      <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]" title={isAr ? 'نسبة تنفيذ المهام وانتظام العادات' : 'Execution (Tasks & Habits) Progress'}>
                        <div
                          className="bg-teal-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${intel.executionProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                      <span>{intel.progressCalculationMethod}</span>
                      <span>
                        {intel.milestonesTotal > 0 && `${intel.milestonesCompleted}/${intel.milestonesTotal} ${isAr ? 'مراحل' : 'milestones'}`}
                      </span>
                    </div>
                  </div>

                  {/* Key Results Live Pills */}
                  {intel.evaluatedKrs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {intel.evaluatedKrs.slice(0, 2).map((kr) => (
                        <div
                          key={kr.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--surface-inset)] border border-[var(--border-subtle)]"
                        >
                          <span className="truncate text-[var(--text-primary)] font-medium pe-2">
                            {kr.title}
                          </span>
                          <span className="font-mono text-accent text-xs font-bold shrink-0">
                            {kr.evaluatedCurrentValue} / {kr.targetValue} {kr.unit} ({kr.progressPercent}%)
                          </span>
                        </div>
                      ))}
                      {intel.evaluatedKrs.length > 2 && (
                        <span className="text-[10px] text-muted block text-center">
                          +{intel.evaluatedKrs.length - 2} {isAr ? 'نتائج رئيسية إضافية' : 'more key results'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Linked Activities Counter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted">
                    {intel.linkedTasksCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-inset)] text-[var(--text-primary)] border border-[var(--border-strong)]">
                        ✓ {intel.linkedTasksCount} {isAr ? 'مهام' : 'tasks'}
                      </span>
                    )}
                    {intel.linkedHabitsCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-inset)] text-[var(--text-primary)] border border-[var(--border-strong)]">
                        ↻ {intel.linkedHabitsCount} {isAr ? 'عادات' : 'habits'}
                      </span>
                    )}
                    {intel.linkedBooksCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-inset)] text-amber-300 border border-[var(--border-strong)]">
                        📖 {intel.linkedBooksCount} {isAr ? 'كتب' : 'books'}
                      </span>
                    )}
                    {intel.linkedArtProjectsCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-inset)] text-purple-300 border border-[var(--border-strong)]">
                        🎨 {intel.linkedArtProjectsCount} {isAr ? 'مشاريع فنية' : 'art projects'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Foot */}
                <div
                  className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-muted font-mono text-[11px]">
                    {goal.deadline
                      ? `${isAr ? 'الموعد: ' : 'Due: '}${goal.deadline}`
                      : (isAr ? 'إطار زمني فصلي' : 'Quarterly')}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn subtle small text-xs py-1 text-accent border-accent/30 hover:bg-accent/15"
                      onClick={() => setInspectingGoal(goal)}
                    >
                      <span>{isAr ? 'تفاصيل المؤشرات ↗' : 'Inspect Intel ↗'}</span>
                    </button>
                    <button
                      className="mini-icon text-muted hover:text-[var(--text-primary)]"
                      onClick={() => openEditGoalModal(goal)}
                      title={isAr ? 'تعديل' : 'Edit'}
                    >
                      ✏️
                    </button>
                    <button
                      className="mini-icon text-muted hover:text-red-400"
                      onClick={() => deleteGoal(goal.id)}
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Goal Create / Edit Modal */}
      {isFormModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsFormModalOpen(false)}>
          <div className="modal max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>
                  {editingGoal
                    ? (isAr ? 'تعديل الهدف الاستراتيجي' : 'Edit Strategic Objective')
                    : (isAr ? 'إنشاء هدف استراتيجي جديد (OKR)' : 'New Strategic Objective (OKR)')}
                </h2>
                <p>
                  {isAr
                    ? 'حدد الوجهة الكبرى وموعدها بدقة لربط المهام والأنظمة المخصصة بها.'
                    : 'Frame macro ambition into actionable bounds with linked systems.'}
                </p>
              </div>
              <button className="modal-close" onClick={() => setIsFormModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div className="field">
                <label className="text-xs text-muted mb-1 block">{isAr ? 'عنوان الهدف' : 'Objective Title'} *</label>
                <input
                  className="input w-full text-xs font-semibold"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: إطلاق المنتج التقني الجديد، قراءة 20 كتاباً، تحسين اللياقة' : 'e.g. Ship Flagship Product'}
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="text-xs text-muted mb-1 block">
                  {isAr ? 'لماذا هذا الهدف مهم؟ (الدافع والوصف)' : 'Core Motivation & Description'}
                </label>
                <textarea
                  className="textarea w-full text-xs"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isAr ? 'ما الذي سيحققه هذا في مسار حياتك وعملك؟' : 'Why does achieving this matter to you?'}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="field">
                  <label className="text-xs text-muted mb-1 block">{isAr ? 'التصنيف' : 'Category'}</label>
                  <select
                    className="select w-full text-xs"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                  >
                    <option value="career">{isAr ? '💼 مهني وعمل' : 'Career'}</option>
                    <option value="health">{isAr ? '⚡ صحة وجسد' : 'Health'}</option>
                    <option value="finance">{isAr ? '🪙 مالي واستثمار' : 'Finance'}</option>
                    <option value="personal">{isAr ? '🌱 شخصي وعائلة' : 'Personal'}</option>
                    <option value="intellect">{isAr ? '🧠 فكري وثقافي' : 'Intellect'}</option>
                  </select>
                </div>

                <div className="field">
                  <label className="text-xs text-muted mb-1 block">{isAr ? 'الأولوية' : 'Priority'}</label>
                  <select
                    className="select w-full text-xs"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as GoalPriority)}
                  >
                    <option value="urgent">{isAr ? '🔴 عاجل جداً' : 'Urgent'}</option>
                    <option value="high">{isAr ? '🟡 أولوية كبرى' : 'High'}</option>
                    <option value="medium">{isAr ? '🔵 متوسط الأهمية' : 'Medium'}</option>
                    <option value="low">{isAr ? '⚪ أولوية عادية' : 'Low'}</option>
                  </select>
                </div>

                <div className="field col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted mb-1 block">{isAr ? 'الإطار الزمني' : 'Timeframe'}</label>
                  <select
                    className="select w-full text-xs"
                    value={formTimeframe}
                    onChange={(e) => setFormTimeframe(e.target.value as any)}
                  >
                    <option value="quarterly">{isAr ? 'فصلي (3 أشهر)' : 'Quarterly'}</option>
                    <option value="annual">{isAr ? 'سنوي (سنة)' : 'Annual'}</option>
                    <option value="life">{isAr ? 'رؤية كبرى للحياة' : 'Life Vision'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs text-muted mb-1 block">{isAr ? 'تاريخ البداية' : 'Start Date'}</label>
                  <input
                    type="date"
                    className="input w-full text-xs font-mono"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="text-xs text-muted mb-1 block">{isAr ? 'الموعد المستهدف' : 'Target Deadline'}</label>
                  <input
                    type="date"
                    className="input w-full text-xs font-mono"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                  />
                </div>
              </div>

              {/* Initial KR Section when creating */}
              {!editingGoal && (
                <div className="p-3 bg-[var(--surface-inset)] rounded-xl border border-[var(--border-subtle)] space-y-3">
                  <span className="text-xs font-bold text-accent block">
                    {isAr ? 'النتيجة الرئيسية المحورية الأولى (First Key Result):' : 'Initial Core Key Result:'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="field">
                      <label className="text-[11px] text-muted mb-1 block">{isAr ? 'عنوان المقياس' : 'Metric Title'}</label>
                      <input
                        type="text"
                        className="input w-full text-xs"
                        value={formKrTitle}
                        onChange={(e) => setFormKrTitle(e.target.value)}
                        placeholder={isAr ? 'مثال: إنجاز 10 مهام، قراءة 5 كتب' : 'e.g. Read 5 books'}
                      />
                    </div>
                    <div className="field">
                      <label className="text-[11px] text-muted mb-1 block">{isAr ? 'مصدر البيانات' : 'Data Engine'}</label>
                      <select
                        className="select w-full text-xs"
                        value={formKrSource}
                        onChange={(e) => {
                          const src = e.target.value as KeyResultDataSource;
                          setFormKrSource(src);
                          if (src === 'tasks_completed') {
                            setFormKrUnit(isAr ? 'مهام' : 'tasks');
                            setFormKrTarget(10);
                          } else if (src === 'reading_books_completed') {
                            setFormKrUnit(isAr ? 'كتب' : 'books');
                            setFormKrTarget(5);
                          } else if (src === 'workout_total_reps') {
                            setFormKrUnit(isAr ? 'تكرار' : 'reps');
                            setFormKrTarget(500);
                          } else if (src === 'drawing_projects_completed') {
                            setFormKrUnit(isAr ? 'مشاريع' : 'projects');
                            setFormKrTarget(3);
                          } else {
                            setFormKrUnit('%');
                            setFormKrTarget(100);
                          }
                        }}
                      >
                        <option value="tasks_completed">{isAr ? '✓ عدد المهام المنجزة' : 'Tasks: Completed Count'}</option>
                        <option value="habit_consistency">{isAr ? '↻ نسبة التزام العادات (%)' : 'Habits: Cadence (%)'}</option>
                        <option value="reading_books_completed">{isAr ? '📚 عدد الكتب المكتملة' : 'Reading: Books Finished'}</option>
                        <option value="reading_pages_read">{isAr ? '📖 صفحات القراءة' : 'Reading: Pages Read'}</option>
                        <option value="workout_sessions_count">{isAr ? '⚡ حصص التمارين المنزلية' : 'Workout: Sessions'}</option>
                        <option value="workout_total_reps">{isAr ? '💪 تكرارات التمارين' : 'Workout: Total Reps'}</option>
                        <option value="drawing_projects_completed">{isAr ? '🏆 مشاريع الرسم المكتملة' : 'Drawing: Finished Projects'}</option>
                        <option value="manual">{isAr ? '✏️ نتيجة يدوية' : 'Manual Entry'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="field">
                      <label className="text-[11px] text-muted mb-1 block">{isAr ? 'القيمة المستهدفة' : 'Target Value'}</label>
                      <input
                        type="number"
                        min="1"
                        className="input w-full text-xs font-mono font-bold"
                        value={formKrTarget}
                        onChange={(e) => setFormKrTarget(Number(e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label className="text-[11px] text-muted mb-1 block">{isAr ? 'وحدة القياس' : 'Unit'}</label>
                      <input
                        type="text"
                        className="input w-full text-xs"
                        value={formKrUnit}
                        onChange={(e) => setFormKrUnit(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions pt-2 border-t border-[var(--border-subtle)]">
                <button type="button" className="btn subtle" onClick={() => setIsFormModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {editingGoal ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء الهدف' : 'Create Goal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Detail Intelligence Modal */}
      {currentInspectingGoal && (
        <GoalDetailModal
          goal={currentInspectingGoal}
          onClose={() => setInspectingGoal(null)}
          onEditGoal={(g) => {
            setInspectingGoal(null);
            openEditGoalModal(g);
          }}
        />
      )}
    </div>
  );
};

