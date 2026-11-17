import { localDateKey, parseDateKey } from '../lib/dateKey';
import { isTaskDone, isTaskPending } from '../lib/taskStatus';
import { dayOfWeek, WEEK_DAY_ORDER, weekDayLabel } from '../lib/week';
import React, { useEffect, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { PriorityLevel, RecurrenceFrequency, RecurrenceRule, Task, TaskStatus } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { EmptyState, NuqtaSelect, PageHeader, Surface, TabBar } from './ui';
import { suggestSmartReschedule } from '../lib/energyAlgorithm';

/**
 * Turn the repeat picker into a recurrence rule. `weekdays` maps to NUQTA's
 * working week (Sat..Thu) and a custom selection with no days falls back to the
 * scheduled weekday so a rule is never empty.
 */
function buildRecurrence(
  repeat: 'none' | RecurrenceFrequency,
  days: number[],
  scheduledDate: string
): RecurrenceRule | undefined {
  if (repeat === 'none') return undefined;
  if (repeat === 'weekly' || repeat === 'custom') {
    const anchorDow = scheduledDate && parseDateKey(scheduledDate) ? dayOfWeek(scheduledDate) : undefined;
    const chosen = days.length > 0 ? days : anchorDow !== undefined ? [anchorDow] : [];
    return { freq: 'weekly', days: chosen };
  }
  return { freq: repeat };
}

/** Localised, compact label for a task's recurrence rule. */
function recurrenceLabel(rule: RecurrenceRule, isAr: boolean): string {
  switch (rule.freq) {
    case 'daily':
      return isAr ? 'يومياً' : 'Daily';
    case 'weekdays':
      return isAr ? 'أيام العمل' : 'Weekdays';
    case 'monthly':
      return isAr ? 'شهرياً' : 'Monthly';
    case 'interval':
      return isAr ? `كل ${rule.intervalDays ?? 1} يوم` : `Every ${rule.intervalDays ?? 1}d`;
    case 'weekly':
    case 'custom': {
      const days = (rule.days ?? []).map((d) => weekDayLabel(d, isAr)).join(', ');
      return days || (isAr ? 'أسبوعياً' : 'Weekly');
    }
    default:
      return isAr ? 'متكرر' : 'Repeats';
  }
}

/** Seed the repeat picker from an existing rule so editing shows the real cadence. */
function ruleToForm(rule?: RecurrenceRule): { repeat: 'none' | RecurrenceFrequency; days: number[] } {
  if (!rule) return { repeat: 'none', days: [] };
  if (rule.freq === 'weekly' || rule.freq === 'custom') {
    return { repeat: 'weekly', days: rule.days ?? [] };
  }
  return { repeat: rule.freq, days: [] };
}

export const TasksView: React.FC = () => {
  const {
    tasks,
    energyScore,
    toggleTaskStatus,
    toggleTopThree,
    deleteTask,
    toggleSubtask,
    addSubtask,
    createTask,
    updateTask,
    updateTaskSeries,
    skipTaskOccurrence,
    deleteTaskSeries,
    smartBatchReschedule,
    profile,
    goals,
    archiveTask,
    restoreTask,
    setActiveNavTab,
    focusRequest,
    consumeFocus
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'matrix'>('list');
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRequest || focusRequest.domain !== 'tasks') return;
    const id = focusRequest.entityId;
    setViewMode('list');
    setStatusFilter('all');
    setFocusedTaskId(id);
    consumeFocus();
    window.setTimeout(() => {
      document.getElementById('task-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    const timer = window.setTimeout(() => setFocusedTaskId(null), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'due' | 'priority'>('due');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPriority, setFormPriority] = useState<PriorityLevel>(2);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formMinutes, setFormMinutes] = useState(30);
  const [formIsTopThree, setFormIsTopThree] = useState(false);
  const [formTags, setFormTags] = useState('');
  const [formLinkedGoalId, setFormLinkedGoalId] = useState<string>('');
  const [formRepeat, setFormRepeat] = useState<'none' | RecurrenceFrequency>('none');
  const [formRepeatDays, setFormRepeatDays] = useState<number[]>([]);
  // When editing a recurring task: rewrite only this occurrence, or the whole series.
  const [editScope, setEditScope] = useState<'occurrence' | 'series'>('occurrence');

  const todayStr = localDateKey();

  // Overdue detection
  const overdueTasks = tasks.filter(
    (t) => isTaskPending(t) && t.scheduledDate && t.scheduledDate < todayStr
  );
  const smartSuggestions = suggestSmartReschedule(overdueTasks, energyScore);

  const handleApplyReschedule = () => {
    const formatted = smartSuggestions.map((s) => ({ taskId: s.taskId, date: s.proposedDate }));
    smartBatchReschedule(formatted);
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormNotes('');
    setFormPriority(2);
    setFormDate(todayStr);
    setFormTime('');
    setFormMinutes(30);
    setFormIsTopThree(false);
    setFormTags('');
    setFormLinkedGoalId('');
    setFormRepeat('none');
    setFormRepeatDays([]);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormNotes(task.notes || '');
    setFormPriority(task.priority);
    setFormDate(task.scheduledDate || '');
    setFormTime(task.scheduledTime || '');
    setFormMinutes(task.estimatedMinutes || 30);
    setFormIsTopThree(task.isTopThree);
    setFormTags((task.tags || []).join(', '));
    setFormLinkedGoalId(task.linkedGoalId || '');
    const seeded = ruleToForm(task.recurrence);
    setFormRepeat(seeded.repeat);
    setFormRepeatDays(seeded.days);
    setEditScope('occurrence');
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const tagsArray = formTags.split(',').map((t) => t.trim()).filter(Boolean);
    const recurrence = buildRecurrence(formRepeat, formRepeatDays, formDate);
    const fields = {
      title: formTitle.trim(),
      notes: formNotes.trim(),
      priority: formPriority,
      scheduledDate: formDate || undefined,
      scheduledTime: formTime || undefined,
      estimatedMinutes: formMinutes,
      isTopThree: formIsTopThree,
      tags: tagsArray,
      linkedGoalId: formLinkedGoalId || undefined
    };

    if (editingTask) {
      // A recurring series offers a scope choice: rewrite only the edited occurrence,
      // or apply the change (and any new cadence) to the remaining series.
      if (editingTask.seriesId) {
        if (editScope === 'series') {
          updateTaskSeries(editingTask.seriesId, editingTask.id, { ...fields, recurrence });
        } else {
          updateTask(editingTask.id, fields);
        }
      } else {
        updateTask(editingTask.id, fields);
      }
    } else {
      createTask({ ...fields, recurrence });
    }
    setIsModalOpen(false);
  };

  // Filter & sort tasks
  const filtered = tasks.filter((t) => {
    const isArch = t.isArchived || t.status === 'archived' || t.status === 'skipped';
    if (statusFilter === 'archived') {
      if (!isArch) return false;
    } else {
      if (isArch) return false;
      if (statusFilter === 'active' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
    }
    if (searchQuery.trim()) {
      const matchText = `${t.title} ${t.notes || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
      if (!matchText.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      return a.priority - b.priority;
    }
    const aDate = a.scheduledDate || '9999-99-99';
    const bDate = b.scheduledDate || '9999-99-99';
    return aDate.localeCompare(bDate) || (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99');
  });

  const priorityMeta = (priority: PriorityLevel) => {
    switch (priority) {
      case 1:
        return { label: isAr ? 'Q1 عاجل ومهم' : 'Q1 Urgent & Important', tagClass: 'tag red', dotClass: 'high' };
      case 2:
        return { label: isAr ? 'Q2 مهم وغير عاجل' : 'Q2 Important', tagClass: 'tag green', dotClass: 'medium' };
      case 3:
        return { label: isAr ? 'Q3 عاجل وغير مهم' : 'Q3 Urgent', tagClass: 'tag orange', dotClass: 'low' };
      case 4:
      default:
        return { label: isAr ? 'Q4 غير مهم' : 'Q4 Low Priority', tagClass: 'tag', dotClass: 'normal' };
    }
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <PageHeader
        eyebrow="NUQTA / EXECUTION"
        title={isAr ? 'المهام والتنفيذ' : 'Tasks & Execution'}
        description={
          isAr
            ? 'أولويات واضحة، مهام صغيرة قابلة للتنفيذ دون تشتت أو فوضى.'
            : 'Clear priorities, small executable actions without overwhelm or clutter.'
        }
        actions={
          <>
            {overdueTasks.length > 0 && (
              <button className="btn subtle small" onClick={handleApplyReschedule} title={isAr ? 'إعادة جدولة المهام المتأخرة ذكياً' : 'Smart reschedule overdue tasks'}>
                <NuqtaIcon name="repeat" className="w-3.5 h-3.5 text-accent" />
                <span>{isAr ? `إعادة جدولة (${overdueTasks.length})` : `Reschedule (${overdueTasks.length})`}</span>
              </button>
            )}
            <button className="btn primary" onClick={openNewTaskModal}>
              <span className="btn-icon">+</span>
              <span>{isAr ? 'مهمة جديدة' : 'New Task'}</span>
            </button>
          </>
        }
      />

      {/* Toolbar */}
      <Surface variant="panel" padding="sm" className="toolbar">
        <div className="filter-input">
          <input
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'ابحث في المهام...' : 'Search tasks...'}
          />
          {searchQuery && (
            <button
              type="button"
              className="mini-icon"
              data-clear-search
              style={{ position: 'absolute', insetInlineEnd: '4px', top: '5px' }}
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <NuqtaSelect style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">{isAr ? 'الكل (غير المؤرشفة)' : 'All Active'}</option>
          <option value="active">{isAr ? 'النشطة' : 'Active'}</option>
          <option value="completed">{isAr ? 'المكتملة' : 'Completed'}</option>
          <option value="archived">{isAr ? 'المؤرشفة 🗄️' : 'Archived 🗄️'}</option>
        </NuqtaSelect>

        <button
          onClick={() => setActiveNavTab('archive')}
          className="btn subtle text-xs py-1.5 px-3 flex items-center gap-1.5"
          title={isAr ? 'فتح الأرشيف والسجل الشامل' : 'Open Universal Archive & History'}
        >
          <span>🗄️</span>
          <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
        </button>

        <NuqtaSelect style={{ width: 'auto' }} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="due">{isAr ? 'حسب التاريخ' : 'Sort by Due'}</option>
          <option value="priority">{isAr ? 'حسب الأولوية' : 'Sort by Priority'}</option>
        </NuqtaSelect>

        <TabBar
          items={[
            { id: 'list', label: isAr ? 'قائمة' : 'List' },
            { id: 'board', label: isAr ? 'لوحة' : 'Board' },
            { id: 'matrix', label: isAr ? 'مصفوفة' : 'Matrix' }
          ]}
          value={viewMode}
          onChange={(id) => setViewMode(id as 'list' | 'board' | 'matrix')}
          variant="underline"
          ariaLabel={isAr ? 'أوضاع عرض المهام' : 'Task views'}
        />
      </Surface>

      {/* Main Content Area */}
      <section className="panel panel-pad">
        <div className="panel-heading">
          <div>
            <h2>
              {viewMode === 'board'
                ? isAr ? 'لوحة كانبان' : 'Kanban Board'
                : viewMode === 'matrix'
                ? isAr ? 'مصفوفة أيزنهاور' : 'Eisenhower Matrix'
                : isAr ? 'قائمة المهام' : 'Task List'}
            </h2>
            <p>
              {sorted.length} · {isAr ? 'مهام مطابقة' : 'tasks'}
            </p>
          </div>
          <span className="tag green">
            {statusFilter === 'completed'
              ? isAr ? 'مكتملة' : 'Completed'
              : statusFilter === 'active'
              ? isAr ? 'نشطة' : 'Active'
              : isAr ? 'الكل' : 'All'}
          </span>
        </div>

        {/* View Mode: List */}
        {viewMode === 'list' && (
          <div className="task-list">
            {sorted.length === 0 ? (
              <EmptyState
                icon="check-square"
                title={isAr ? 'لا توجد مهام هنا' : 'No tasks here'}
                description={
                  isAr
                    ? 'كل شيء نظيف ومنجز! أضف مهمة جديدة للبدء.'
                    : 'Everything is clear! Add a new task to get started.'
                }
                action={
                  <button className="btn primary" onClick={openNewTaskModal}>
                    + {isAr ? 'مهمة جديدة' : 'Add Task'}
                  </button>
                }
              />
            ) : (
              sorted.map((task) => {
                const pInfo = priorityMeta(task.priority);
                const isCompleted = isTaskDone(task);
                const subtasks = task.subtasks || [];
                const subtasksDone = subtasks.filter((s) => s.completed).length;
                const isExpanded = expandedTaskId === task.id;

                return (
                  <div key={task.id} className="space-y-2" id={'task-' + task.id}>
                    <div className={`task-row ${isCompleted ? 'done' : ''} ${focusedTaskId === task.id ? 'focus-flash' : ''}`}>
                      <button
                        className={`check-circle ${isCompleted ? 'checked' : ''}`}
                        onClick={() => toggleTaskStatus(task.id)}
                        aria-label="Toggle completed"
                      />

                      <div className="task-detail" onClick={() => openEditModal(task)} style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-2">
                          <span className="task-title">{task.title}</span>
                          {task.isTopThree && (
                            <span className="tag green text-[9px] py-0 px-1.5" title={isAr ? 'ضمن أهم 3 اليوم' : 'Daily Top 3'}>
                              ★ {isAr ? 'أهم 3' : 'Top 3'}
                            </span>
                          )}
                          {task.recurrence && (
                            <span className="tag text-[9px] py-0 px-1.5 bg-accent/10 text-accent border border-accent/20" title={recurrenceLabel(task.recurrence, isAr)}>
                              🔁 {recurrenceLabel(task.recurrence, isAr)}
                            </span>
                          )}
                        </div>
                        <span className="task-subtitle">
                          {task.scheduledDate || (isAr ? 'بدون موعد' : 'No due date')}
                          {task.scheduledTime ? ` · ${task.scheduledTime}` : ''}
                          {task.estimatedMinutes ? ` · ${task.estimatedMinutes} ${isAr ? 'د' : 'min'}` : ''}
                          {subtasks.length > 0 ? ` · ${subtasksDone}/${subtasks.length} ${isAr ? 'مهام فرعية' : 'subtasks'}` : ''}
                          {task.tags && task.tags.length > 0 ? ` · #${task.tags.join(' #')}` : ''}
                        </span>
                      </div>

                      <div className="task-meta">
                        {task.linkedGoalId && (() => {
                          const linkedG = goals.find((g) => g.id === task.linkedGoalId);
                          return linkedG ? (
                            <span className="tag text-[10px] bg-accent/10 text-accent border border-accent/20 truncate max-w-[140px]" title={linkedG.title}>
                              🎯 {linkedG.title}
                            </span>
                          ) : null;
                        })()}
                        <span className={pInfo.tagClass}>{pInfo.label}</span>
                      </div>

                      <div className="task-row-actions">
                        <button
                          className={`mini-icon ${task.isTopThree ? 'text-accent' : ''}`}
                          onClick={() => toggleTopThree(task.id)}
                          title={isAr ? 'تحديد كأحد أهم 3 مهام اليوم' : 'Toggle Top 3 Focus'}
                        >
                          <NuqtaIcon name="target" className="w-4 h-4" />
                        </button>
                        <button
                          className="mini-icon"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          title={isAr ? 'المهام الفرعية' : 'Subtasks'}
                        >
                          <NuqtaIcon name="check-square" className="w-4 h-4" />
                        </button>
                        <button
                          className="mini-icon"
                          onClick={() => openEditModal(task)}
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <NuqtaIcon name="edit" className="w-4 h-4" />
                        </button>

                        {task.recurrence && isTaskPending(task) && (
                          <button
                            className="mini-icon hover:text-[var(--tone-warning)]"
                            onClick={() => skipTaskOccurrence(task.id)}
                            title={isAr ? 'تخطّي هذا التكرار فقط' : 'Skip this occurrence'}
                          >
                            ⏭
                          </button>
                        )}
                        {task.isArchived || task.status === 'archived' ? (
                          <button
                            className="mini-icon text-[var(--tone-info)] hover:text-[var(--text-primary)]"
                            onClick={() => restoreTask(task.id)}
                            title={isAr ? 'استعادة من الأرشيف' : 'Restore from archive'}
                          >
                            ↩
                          </button>
                        ) : (
                          <button
                            className="mini-icon hover:text-[var(--tone-warning)]"
                            onClick={() => archiveTask(task.id)}
                            title={isAr ? 'أرشفة المهمة' : 'Archive task'}
                          >
                            🗄️
                          </button>
                        )}

                        <button
                          className="mini-icon"
                          onClick={() =>
                            task.seriesId
                              ? deleteTaskSeries(task.seriesId)
                              : deleteTask(task.id)
                          }
                          title={task.seriesId ? (isAr ? 'حذف السلسلة بالكامل' : 'Delete whole series') : (isAr ? 'حذف' : 'Delete')}
                        >
                          <NuqtaIcon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Subtasks Inline Expansion */}
                    {isExpanded && (
                      <div className="mr-8 ml-8 p-3 bg-[var(--panel-2)] border border-[var(--border-soft)] rounded-xl space-y-2">
                        <div className="text-[11px] text-[var(--muted)] font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>{isAr ? 'المهام الفرعية' : 'Subtasks'}</span>
                          <span>{subtasksDone}/{subtasks.length}</span>
                        </div>
                        {subtasks.map((st) => (
                          <div key={st.id} className="flex items-center gap-2 py-1">
                            <button
                              className={`check-circle ${st.completed ? 'checked' : ''}`}
                              onClick={() => toggleSubtask(task.id, st.id)}
                            />
                            <span className={`text-xs ${st.completed ? 'line-through text-muted' : 'text-text'}`}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input
                            className="input text-xs py-1 px-2.5 h-7"
                            placeholder={isAr ? 'أضف خطوة فرعية...' : 'Add a subtask step...'}
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                                addSubtask(task.id, newSubtaskTitle.trim());
                                setNewSubtaskTitle('');
                              }
                            }}
                          />
                          <button
                            className="btn primary small px-3"
                            onClick={() => {
                              if (newSubtaskTitle.trim()) {
                                addSubtask(task.id, newSubtaskTitle.trim());
                                setNewSubtaskTitle('');
                              }
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* View Mode: Board (Kanban) */}
        {viewMode === 'board' && (
          <div className="kanban">
            {[
              { status: 'todo' as TaskStatus, label: isAr ? 'قيد الانتظار' : 'To Do' },
              { status: 'in_progress' as TaskStatus, label: isAr ? 'قيد التنفيذ' : 'In Progress' },
              { status: 'completed' as TaskStatus, label: isAr ? 'مكتملة' : 'Completed' }
            ].map(({ status, label }) => {
              const colTasks = sorted.filter((t) => t.status === status);
              return (
                <div key={status} className="kanban-column">
                  <div className="kanban-head">
                    <span>{label}</span>
                    <span>{colTasks.length}</span>
                  </div>
                  <div className="kanban-cards">
                    {colTasks.length === 0 ? (
                      <div className="empty-inline">—</div>
                    ) : (
                      colTasks.map((t) => (
                        <div key={t.id} className="kanban-card">
                          <div className="flex justify-between items-start gap-2">
                            <span className="task-title font-medium">{t.title}</span>
                            {t.isTopThree && <span className="text-[10px] text-accent">★</span>}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-muted mt-2">
                            <span>{t.scheduledDate || (isAr ? 'بلا موعد' : 'No date')}</span>
                            <span className={priorityMeta(t.priority).tagClass}>
                              {priorityMeta(t.priority).label.split(' ')[0]}
                            </span>
                          </div>
                          <NuqtaSelect value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value as TaskStatus })} className="text-[10px]">
                            <option value="todo">{isAr ? 'قيد الانتظار' : 'To Do'}</option>
                            <option value="in_progress">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
                            <option value="completed">{isAr ? 'مكتملة' : 'Completed'}</option>
                          </NuqtaSelect>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode: Matrix (Eisenhower) */}
        {viewMode === 'matrix' && (
          <div className="matrix-grid">
            {[
              {
                key: 'q1',
                title: isAr ? 'Q1 عاجل ومهم (افعل الآن)' : 'Q1 Urgent & Important (Do First)',
                tasks: sorted.filter((t) => t.priority === 1)
              },
              {
                key: 'q2',
                title: isAr ? 'Q2 مهم وغير عاجل (خطط له)' : 'Q2 Important & Not Urgent (Schedule)',
                tasks: sorted.filter((t) => t.priority === 2)
              },
              {
                key: 'q3',
                title: isAr ? 'Q3 عاجل وغير مهم (فوّض أو بسّط)' : 'Q3 Urgent & Not Important (Delegate)',
                tasks: sorted.filter((t) => t.priority === 3)
              },
              {
                key: 'q4',
                title: isAr ? 'Q4 غير مهم وغير عاجل (تخلّص منه)' : 'Q4 Neither (Eliminate)',
                tasks: sorted.filter((t) => t.priority === 4)
              }
            ].map((quad) => (
              <section key={quad.key} className={`matrix-quadrant ${quad.key}`}>
                <div className="quadrant-title">
                  <span className="qdot"></span>
                  <span>{quad.title}</span>
                  <span className="mr-auto text-[10px] text-muted">({quad.tasks.length})</span>
                </div>
                {quad.tasks.length === 0 ? (
                  <div className="small-muted">—</div>
                ) : (
                  quad.tasks.map((task) => (
                    <div key={task.id} className="matrix-task justify-between items-center">
                      <button
                        onClick={() => openEditModal(task)}
                        className="text-start hover:text-accent transition-colors truncate flex-1"
                      >
                        {task.title}
                      </button>
                      <button
                        className={`check-circle ${isTaskDone(task) ? 'checked' : ''} shrink-0`}
                        onClick={() => toggleTaskStatus(task.id)}
                      />
                    </div>
                  ))
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      {/* Task Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editingTask ? (isAr ? 'تعديل المهمة' : 'Edit Task') : (isAr ? 'مهمة جديدة' : 'New Task')}</h2>
                <p>
                  {isAr
                    ? 'حدد التفاصيل والأولويات بدقة لدعم التركيز الذهني.'
                    : 'Configure details and priorities precisely for cognitive clarity.'}
                </p>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="field">
                <label>{isAr ? 'عنوان المهمة' : 'Task Title'} *</label>
                <input
                  className="input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: إنهاء مسودة المشروع...' : 'e.g. Finish report draft...'}
                  autoFocus
                  required
                />
              </div>

              <div className="field">
                <label>{isAr ? 'ملاحظات وتفاصيل' : 'Notes & Context'}</label>
                <textarea
                  className="textarea"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isAr ? 'أي سياق أو روابط مساعدة...' : 'Any details, links or ideas...'}
                  rows={2}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>{isAr ? 'مصفوفة أيزنهاور (الأولوية)' : 'Eisenhower Priority'}</label>
                  <NuqtaSelect value={formPriority} onChange={(e) => setFormPriority(Number(e.target.value) as PriorityLevel)}>
                    <option value={1}>{isAr ? 'Q1 — عاجل ومهم (نفذ فوراً)' : 'Q1 — Urgent & Important'}</option>
                    <option value={2}>{isAr ? 'Q2 — مهم وغير عاجل (خطط له)' : 'Q2 — Important & Not Urgent'}</option>
                    <option value={3}>{isAr ? 'Q3 — عاجل وغير مهم (فوّض)' : 'Q3 — Urgent & Not Important'}</option>
                    <option value={4}>{isAr ? 'Q4 — غير مهم وغير عاجل' : 'Q4 — Low / Eliminate'}</option>
                  </NuqtaSelect>
                </div>

                <div className="field">
                  <label>{isAr ? 'الوقت المقدر (بالدقائق)' : 'Estimated Duration (mins)'}</label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    step="5"
                    className="input"
                    value={formMinutes}
                    onChange={(e) => setFormMinutes(Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <label>{isAr ? 'تاريخ الاستحقاق' : 'Scheduled Date'}</label>
                  <input
                    type="date"
                    className="input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>{isAr ? 'الوقت المفضل' : 'Scheduled Time'}</label>
                  <input
                    type="time"
                    className="input"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                  />
                </div>
              </div>

              {(!editingTask || (editingTask.seriesId && editScope === 'series')) && (
                <div className="field">
                  <label>{isAr ? 'التكرار' : 'Repeat'}</label>
                  <NuqtaSelect value={formRepeat} onChange={(e) => setFormRepeat(e.target.value as 'none' | RecurrenceFrequency)}>
                    <option value="none">{isAr ? 'بدون تكرار (مرة واحدة)' : 'Does not repeat'}</option>
                    <option value="daily">{isAr ? 'كل يوم' : 'Daily'}</option>
                    <option value="weekdays">{isAr ? 'أيام العمل (السبت–الخميس)' : 'Weekdays (Sat–Thu)'}</option>
                    <option value="weekly">{isAr ? 'أسبوعياً' : 'Weekly'}</option>
                    <option value="monthly">{isAr ? 'شهرياً' : 'Monthly'}</option>
                  </NuqtaSelect>

                  {(formRepeat === 'weekly' || formRepeat === 'custom') && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {WEEK_DAY_ORDER.map((dow) => {
                        const active = formRepeatDays.includes(dow);
                        return (
                          <button
                            key={dow}
                            type="button"
                            onClick={() =>
                              setFormRepeatDays((prev) =>
                                prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
                              )
                            }
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${
                              active
                                ? 'bg-[var(--brand)] text-[var(--text-on-accent)] border-[var(--brand)]'
                                : 'bg-[var(--surface-inset)] text-[var(--text-secondary)] border-[var(--border-default)]'
                            }`}
                            aria-pressed={active}
                          >
                            {weekDayLabel(dow, isAr)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {editingTask?.seriesId && (
                <div className="field">
                  <label>{isAr ? 'نطاق التعديل' : 'Apply changes to'}</label>
                  <TabBar
                    items={[
                      { id: 'occurrence', label: isAr ? 'هذا اليوم فقط' : 'This day only' },
                      { id: 'series', label: isAr ? 'كل السلسلة' : 'Entire series' }
                    ]}
                    value={editScope}
                    onChange={(id) => setEditScope(id as 'occurrence' | 'series')}
                    ariaLabel={isAr ? 'نطاق التعديل' : 'Edit scope'}
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                    {editScope === 'series'
                      ? isAr
                        ? 'سيُطبَّق التعديل على الأيام القادمة، وتبقى الأيام المكتملة كما هي.'
                        : 'Applies to upcoming occurrences; completed days are kept as history.'
                      : isAr
                      ? 'لن تتأثر بقية أيام السلسلة.'
                      : 'The rest of the series stays unchanged.'}
                  </span>
                </div>
              )}

              <div className="field">
                <label>{isAr ? 'الهدف الاستراتيجي المرتبط' : 'Linked Strategic Goal'}</label>
                <NuqtaSelect value={formLinkedGoalId} onChange={(e) => setFormLinkedGoalId(e.target.value)}>
                  <option value="">{isAr ? 'بدون هدف استراتيجي (مهمة عامة)' : 'No linked goal (general task)'}</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      🎯 {g.title} ({g.timeframe})
                    </option>
                  ))}
                </NuqtaSelect>
              </div>

              <div className="field">
                <label>{isAr ? 'الوسوم (مفصولة بفواصل)' : 'Tags (comma separated)'}</label>
                <input
                  className="input"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="work, health, deepwork"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="topThreeCheck"
                  checked={formIsTopThree}
                  onChange={(e) => setFormIsTopThree(e.target.checked)}
                  className="accent-accent w-4 h-4"
                />
                <label htmlFor="topThreeCheck" className="text-xs text-text cursor-pointer">
                  {isAr ? 'تثبيت ضمن أهم 3 مهام لهذا اليوم (Daily Top 3)' : 'Pin to Daily Top 3 Focus'}
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn subtle" onClick={() => setIsModalOpen(false)}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="btn primary">
                  {editingTask ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إضافة المهمة' : 'Add Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

