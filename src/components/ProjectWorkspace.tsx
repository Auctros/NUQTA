import React, { useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { localDateKey } from '../lib/dateKey';
import { NuqtaIcon } from './NuqtaIcon';
import { EmptyState, PageHeader, TabBar } from './ui';
import { dialogs, feedback } from './ui/dialogController';
import {
  assessProjectHealth,
  deriveProjectProgress,
  nextAction,
  projectTasks,
  summarizeProject
} from '../lib/projectProgress';
import { isTaskDone } from '../lib/taskStatus';
import {
  categoryLabel,
  healthLabel,
  healthTone,
  noteKindLabel,
  statusIcon,
  statusLabel,
  statusTone,
  stepStatusLabel,
  ui
} from '../lib/projectLabels';
import type { Project, ProjectNoteKind, ProjectStatus, ProjectStepStatus } from '../types';

const t = (label: { ar: string; en: string }, isAr: boolean) => (isAr ? label.ar : label.en);

type WorkspaceTab = 'overview' | 'plan' | 'notes' | 'timeline' | 'resources' | 'activity';

interface Props {
  project: Project;
  onBack: () => void;
}

export const ProjectWorkspace: React.FC<Props> = ({ project, onBack }) => {
  const {
    tasks,
    goals,
    profile,
    updateProject,
    setProjectStatus,
    setProjectManualProgress,
    addProjectPhase,
    updateProjectPhase,
    deleteProjectPhase,
    toggleProjectPhaseCompletion,
    addProjectStep,
    deleteProjectStep,
    setProjectStepStatus,
    moveProjectStep,
    addProjectNote,
    deleteProjectNote,
    convertProjectNoteToStep,
    convertProjectNoteToTask,
    addProjectResource,
    deleteProjectResource,
    linkProjectToGoal,
    unlinkProjectFromGoal,
    unlinkTaskFromProject,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const today = localDateKey();
  const [tab, setTab] = useState<WorkspaceTab>('overview');

  const [phaseTitle, setPhaseTitle] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [stepPhaseId, setStepPhaseId] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteKind, setNoteKind] = useState<ProjectNoteKind>('note');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');

  const progress = deriveProjectProgress(project, tasks);
  const health = assessProjectHealth(project, tasks, today);
  const summary = summarizeProject(project, tasks, today);
  const next = nextAction(project, tasks);
  const linkedTasks = projectTasks(project, tasks);
  const linkedGoals = goals.filter((g) => project.goalIds.includes(g.id));
  const unlinkedGoals = goals.filter((g) => !project.goalIds.includes(g.id));

  const orderedSteps = useMemo(() => [...project.steps].sort((a, b) => a.order - b.order), [project.steps]);
  const orderedPhases = useMemo(() => [...project.phases].sort((a, b) => a.order - b.order), [project.phases]);
  const unphasedSteps = orderedSteps.filter((s) => !s.phaseId || !project.phases.some((p) => p.id === s.phaseId));

  const statusPillClass = `bg-[var(--tone-${statusTone[project.status]}-wash)] text-[var(--tone-${statusTone[project.status]})] border-[var(--tone-${statusTone[project.status]}-line)]`;

  const submitPhase = () => {
    if (!phaseTitle.trim()) return;
    addProjectPhase(project.id, { title: phaseTitle.trim() });
    setPhaseTitle('');
  };

  const submitStep = () => {
    if (!stepTitle.trim()) return;
    addProjectStep(project.id, { title: stepTitle.trim(), phaseId: stepPhaseId || undefined });
    setStepTitle('');
  };

  const submitNote = () => {
    if (!noteBody.trim()) return;
    addProjectNote(project.id, { body: noteBody.trim(), kind: noteKind });
    setNoteBody('');
  };

  const submitResource = () => {
    const title = resourceTitle.trim();
    if (!title) return;
    const url = resourceUrl.trim();
    addProjectResource(project.id, {
      kind: url ? 'link' : 'reference',
      title,
      url: url || undefined
    });
    setResourceTitle('');
    setResourceUrl('');
  };

  const confirmDeletePhase = async (phaseId: string, title: string) => {
    const ok = await dialogs.confirm({
      title: isAr ? 'حذف المرحلة؟' : 'Delete phase?',
      description: isAr
        ? `ستُحذف المرحلة «${title}». الخطوات والملاحظات داخلها لن تُحذف، لكنها ستصبح بلا مرحلة.`
        : `The phase “${title}” will be removed. Its steps and notes are kept, but become unassigned.`,
      confirmLabel: t(ui.delete, isAr),
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      tone: 'danger'
    });
    if (ok) deleteProjectPhase(project.id, phaseId);
  };

  const confirmDeleteNote = async (noteId: string) => {
    const ok = await dialogs.confirm({
      title: isAr ? 'حذف الملاحظة؟' : 'Delete note?',
      description: isAr ? 'لا يمكن التراجع عن الحذف.' : 'This cannot be undone.',
      confirmLabel: t(ui.delete, isAr),
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      tone: 'danger'
    });
    if (ok) deleteProjectNote(project.id, noteId);
  };

  const stepStatusAction = (stepId: string, status: ProjectStepStatus) => {
    setProjectStepStatus(project.id, stepId, status);
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <button className="btn subtle text-xs" onClick={onBack}>
        <NuqtaIcon name="chevronLeft" className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
        {t(ui.back, isAr)}
      </button>

      <PageHeader
        eyebrow={t(ui.hubEyebrow, isAr)}
        title={project.title}
        description={project.desiredOutcome || project.description}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${statusPillClass}`}>
              <NuqtaIcon name={statusIcon[project.status]} className="w-3 h-3" />
              {t(statusLabel[project.status], isAr)}
            </span>
            {project.category && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-chip)] text-muted border border-[var(--border-subtle)] flex items-center gap-1">
                <NuqtaIcon name={categoryLabel[project.category].icon} className="w-3 h-3" />
                {t(categoryLabel[project.category], isAr)}
              </span>
            )}
            {health.health !== 'unknown' && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-semibold bg-[var(--tone-${healthTone[health.health]}-wash)] text-[var(--tone-${healthTone[health.health]})] border-[var(--tone-${healthTone[health.health]}-line)]`}
                title={isAr ? health.reasonAr : health.reasonEn}
              >
                {t(healthLabel[health.health], isAr)}
              </span>
            )}
            {linkedGoals.map((g) => (
              <button
                key={g.id}
                className="text-[10px] px-2 py-0.5 rounded bg-[var(--tone-info-wash)] text-[var(--tone-info)] border border-[var(--tone-info-line)] flex items-center gap-1"
                onClick={() => setActiveNavTab('goals')}
                title={isAr ? 'فتح الأهداف' : 'Open goals'}
              >
                <NuqtaIcon name="target" className="w-3 h-3" />
                {g.title}
              </button>
            ))}
          </div>
        }
        actions={
          <select
            className="input text-xs"
            value={project.status}
            onChange={(e) => setProjectStatus(project.id, e.target.value as ProjectStatus)}
            aria-label={isAr ? 'حالة المشروع' : 'Project status'}
          >
            {(['planned', 'active', 'on_hold', 'completed', 'archived'] as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(statusLabel[s], isAr)}
              </option>
            ))}
          </select>
        }
      />

      <TabBar
        ariaLabel={isAr ? 'أقسام المشروع' : 'Project sections'}
        value={tab}
        onChange={(id) => setTab(id as WorkspaceTab)}
        items={[
          { id: 'overview', label: t(ui.tabs.overview, isAr), icon: 'grid' },
          { id: 'plan', label: t(ui.tabs.plan, isAr), icon: 'list', count: project.steps.length },
          { id: 'notes', label: t(ui.tabs.notes, isAr), icon: 'notebook', count: project.notes.length },
          { id: 'timeline', label: t(ui.tabs.timeline, isAr), icon: 'history' },
          { id: 'resources', label: t(ui.tabs.resources, isAr), icon: 'layers', count: project.resources.length },
          { id: 'activity', label: t(ui.tabs.activity, isAr), icon: 'activity', count: project.activity.length }
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
              <span className="text-muted text-xs block">{t(ui.progress, isAr)}</span>
              <strong className="text-2xl font-mono font-bold mt-1 block text-accent">
                {progress.percent === null ? '—' : `${progress.percent}%`}
              </strong>
              <span className="text-[11px] text-muted">
                {progress.source === 'manual'
                  ? t(ui.progressManual, isAr)
                  : progress.source === 'steps'
                    ? t(ui.progressFromSteps, isAr)
                    : progress.source === 'tasks'
                      ? t(ui.progressFromTasks, isAr)
                      : t(ui.progressNone, isAr)}
              </span>
            </div>
            <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
              <span className="text-muted text-xs block">{t(ui.steps, isAr)}</span>
              <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--text-primary)]">
                {summary.steps.done}
                <span className="text-xs text-muted font-normal"> / {summary.steps.total}</span>
              </strong>
              <span className="text-[11px] text-muted">
                {summary.steps.blocked > 0
                  ? `${summary.steps.blocked} ${isAr ? 'متعطّلة' : 'blocked'}`
                  : isAr
                    ? 'منجزة من الخطة'
                    : 'completed of plan'}
              </span>
            </div>
            <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
              <span className="text-muted text-xs block">{t(ui.tasks, isAr)}</span>
              <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--tone-info)]">
                {summary.taskCount}
              </strong>
              <span className="text-[11px] text-muted">{isAr ? 'مهمة تنفّذ المشروع' : 'tasks executing it'}</span>
            </div>
            <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
              <span className="text-muted text-xs block">{t(ui.notes, isAr)}</span>
              <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--text-primary)]">
                {project.notes.length}
              </strong>
              <span className="text-[11px] text-muted">
                {summary.openNoteCount > 0
                  ? `${summary.openNoteCount} ${isAr ? 'سؤال مفتوح' : 'open questions'}`
                  : isAr
                    ? 'ملاحظات مسجّلة'
                    : 'recorded notes'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t(ui.nextAction, isAr)}</h3>
              {next ? (
                <div className="flex items-start gap-2">
                  <NuqtaIcon
                    name={next.kind === 'step' ? 'arrow' : 'check-square'}
                    className="w-4 h-4 mt-0.5 text-accent shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                      {next.kind === 'step' ? next.step.title : next.task.title}
                    </p>
                    <span className="text-[11px] text-muted">
                      {next.kind === 'step'
                        ? isAr
                          ? 'خطوة في الخطة'
                          : 'Plan step'
                        : isAr
                          ? 'مهمة مرتبطة'
                          : 'Linked task'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">{t(ui.noNextAction, isAr)}</p>
              )}

              {project.definitionOfDone && (
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted block mb-1">
                    {isAr ? 'تعريف الإنجاز' : 'Definition of done'}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{project.definitionOfDone}</p>
                </div>
              )}
              {project.purpose && (
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted block mb-1">
                    {isAr ? 'لماذا هذا المشروع' : 'Why this exists'}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{project.purpose}</p>
                </div>
              )}
            </section>

            <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{isAr ? 'الحالة والانتباه' : 'State & attention'}</h3>
              {health.health === 'unknown' ? (
                <p className="text-xs text-muted">
                  {isAr
                    ? 'لا توجد إشارات كافية للحكم على حالة المشروع.'
                    : 'Not enough signals to assess this project yet.'}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">{isAr ? health.reasonAr : health.reasonEn}</p>
              )}

              <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
                <span className="text-[10px] uppercase tracking-wide text-muted block">
                  {t(ui.progress, isAr)} — {isAr ? 'تقدير يدوي' : 'manual estimate'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress.percent ?? 0}
                    onChange={(e) => setProjectManualProgress(project.id, Number(e.target.value) / 100)}
                    className="flex-1"
                    aria-label={isAr ? 'تقدير التقدم' : 'Progress estimate'}
                  />
                  {project.manualProgress !== undefined && (
                    <button className="btn subtle text-[10px] py-1 px-2" onClick={() => setProjectManualProgress(project.id, null)}>
                      {t(ui.clearOverride, isAr)}
                    </button>
                  )}
                </div>
                {project.manualProgress !== undefined && (
                  <p className="text-[10px] text-muted">{t(ui.progressManual, isAr)}</p>
                )}
              </div>

              {project.blockers && (
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--tone-warning)] block mb-1">
                    {isAr ? 'عوائق' : 'Blockers'}
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{project.blockers}</p>
                </div>
              )}
            </section>
          </div>

          <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t(ui.tasks, isAr)}</h3>
              <button className="btn subtle text-[10px] py-1 px-2" onClick={() => setActiveNavTab('tasks')}>
                {isAr ? 'قسم المهام' : 'Tasks section'}
              </button>
            </div>
            {linkedTasks.length === 0 ? (
              <EmptyState icon="check-square" title={t(ui.emptyTasks, isAr)} description={t(ui.emptyTasksBody, isAr)} />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {linkedTasks.map((task) => (
                  <li key={task.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-primary)] truncate">{task.title}</p>
                      <span className="text-[10px] text-muted">
                        {isTaskDone(task) ? (isAr ? 'منجزة' : 'Done') : isAr ? 'قيد التنفيذ' : 'In progress'}
                        {task.projectStepId
                          ? ` · ${orderedSteps.find((s) => s.id === task.projectStepId)?.title ?? ''}`
                          : ''}
                      </span>
                    </div>
                    <button
                      className="text-muted hover:text-[var(--tone-danger)] shrink-0"
                      title={isAr ? 'فصل المهمة عن المشروع' : 'Unlink task'}
                      onClick={() => unlinkTaskFromProject(task.id)}
                    >
                      <NuqtaIcon name="close" className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{t(ui.goals, isAr)}</h3>
            {linkedGoals.length === 0 ? (
              <EmptyState icon="target" title={t(ui.emptyGoals, isAr)} description={t(ui.emptyGoalsBody, isAr)} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {linkedGoals.map((g) => (
                  <span
                    key={g.id}
                    className="text-[11px] px-2 py-1 rounded bg-[var(--tone-info-wash)] text-[var(--tone-info)] border border-[var(--tone-info-line)] flex items-center gap-1.5"
                  >
                    <NuqtaIcon name="target" className="w-3 h-3" />
                    {g.title}
                    <button onClick={() => unlinkProjectFromGoal(project.id, g.id)} title={isAr ? 'فصل' : 'Unlink'}>
                      <NuqtaIcon name="close" className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {unlinkedGoals.length > 0 && (
              <select
                className="input text-xs w-full"
                value=""
                onChange={(e) => {
                  if (e.target.value) linkProjectToGoal(project.id, e.target.value);
                }}
              >
                <option value="">{isAr ? 'ربط بهدف…' : 'Link a goal…'}</option>
                {unlinkedGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </section>
        </div>
      )}

      {tab === 'plan' && (
        <div className="space-y-4">
          <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1 text-xs"
              placeholder={t(ui.addPhase, isAr)}
              value={phaseTitle}
              onChange={(e) => setPhaseTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPhase()}
            />
            <button className="btn primary text-xs" onClick={submitPhase} disabled={!phaseTitle.trim()}>
              + {isAr ? 'مرحلة' : 'Phase'}
            </button>
          </div>

          {project.phases.length === 0 && project.steps.length === 0 ? (
            <EmptyState icon="list" title={t(ui.emptyPlan, isAr)} description={t(ui.emptyPlanBody, isAr)} />
          ) : (
            <div className="space-y-4">
              {orderedPhases.map((phase) => {
                const phaseSteps = orderedSteps.filter((s) => s.phaseId === phase.id);
                const done = phaseSteps.filter((s) => s.status === 'done').length;
                return (
                  <section
                    key={phase.id}
                    className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <button
                            onClick={() => toggleProjectPhaseCompletion(project.id, phase.id)}
                            className={`w-4 h-4 rounded border grid place-items-center shrink-0 ${
                              phase.completedAt
                                ? 'bg-[var(--tone-success)] border-[var(--tone-success)] text-white'
                                : 'border-[var(--border-strong)]'
                            }`}
                            title={phase.completedAt ? t(ui.reopen, isAr) : t(ui.markDone, isAr)}
                          >
                            {phase.completedAt && <NuqtaIcon name="check" className="w-3 h-3" />}
                          </button>
                          <span className={phase.completedAt ? 'line-through text-muted' : ''}>{phase.title}</span>
                        </h4>
                        {phase.description && <p className="text-[11px] text-muted mt-1 ms-6">{phase.description}</p>}
                        <span className="text-[10px] text-muted ms-6 font-mono">
                          {done}/{phaseSteps.length} {isAr ? 'خطوة' : 'steps'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          className="input text-[10px] py-1 px-2 w-32"
                          placeholder={isAr ? 'خطوة في المرحلة' : 'Step in phase'}
                          onKeyDown={(e) => {
                            const el = e.currentTarget;
                            if (e.key === 'Enter' && el.value.trim()) {
                              addProjectStep(project.id, { title: el.value.trim(), phaseId: phase.id });
                              el.value = '';
                            }
                          }}
                        />
                        <button
                          className="text-muted hover:text-[var(--tone-danger)] p-1"
                          onClick={() => confirmDeletePhase(phase.id, phase.title)}
                          title={t(ui.delete, isAr)}
                        >
                          <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {phaseSteps.length > 0 && (
                      <ul className="space-y-1.5 ms-6">
                        {phaseSteps.map((step) => (
                          <StepRow
                            key={step.id}
                            step={step}
                            isAr={isAr}
                            onStatus={(status) => stepStatusAction(step.id, status)}
                            onDelete={() => deleteProjectStep(project.id, step.id)}
                            onMove={(dir) => moveProjectStep(project.id, step.id, dir)}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}

              <section className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {project.phases.length > 0 ? (isAr ? 'خطوات بلا مرحلة' : 'Steps without a phase') : t(ui.steps, isAr)}
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="input flex-1 text-xs"
                    placeholder={t(ui.addStep, isAr)}
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitStep()}
                  />
                  {project.phases.length > 0 && (
                    <select className="input text-xs" value={stepPhaseId} onChange={(e) => setStepPhaseId(e.target.value)}>
                      <option value="">{isAr ? 'بلا مرحلة' : 'No phase'}</option>
                      {orderedPhases.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn primary text-xs" onClick={submitStep} disabled={!stepTitle.trim()}>
                    + {isAr ? 'خطوة' : 'Step'}
                  </button>
                </div>
                {unphasedSteps.length > 0 && (
                  <ul className="space-y-1.5">
                    {unphasedSteps.map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        isAr={isAr}
                        onStatus={(status) => stepStatusAction(step.id, status)}
                        onDelete={() => deleteProjectStep(project.id, step.id)}
                        onMove={(dir) => moveProjectStep(project.id, step.id, dir)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="input text-xs sm:w-40"
                value={noteKind}
                onChange={(e) => setNoteKind(e.target.value as ProjectNoteKind)}
              >
                {(Object.keys(noteKindLabel) as ProjectNoteKind[]).map((k) => (
                  <option key={k} value={k}>
                    {t(noteKindLabel[k], isAr)}
                  </option>
                ))}
              </select>
              <input
                className="input flex-1 text-xs"
                placeholder={t(ui.addNote, isAr)}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNote()}
              />
              <button className="btn primary text-xs" onClick={submitNote} disabled={!noteBody.trim()}>
                + {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>

          {project.notes.length === 0 ? (
            <EmptyState icon="notebook" title={t(ui.emptyNotes, isAr)} description={t(ui.emptyNotesBody, isAr)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.notes.map((note) => {
                const kind = noteKindLabel[note.kind] ?? noteKindLabel.note;
                return (
                  <article
                    key={note.id}
                    className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-chip)] text-muted border border-[var(--border-subtle)] flex items-center gap-1">
                        <NuqtaIcon name={kind.icon} className="w-3 h-3" />
                        {t(kind, isAr)}
                      </span>
                      <button
                        className="text-muted hover:text-[var(--tone-danger)] p-1"
                        onClick={() => confirmDeleteNote(note.id)}
                        title={t(ui.delete, isAr)}
                      >
                        <NuqtaIcon name="trash" className="w-3 h-3" />
                      </button>
                    </div>
                    {note.title && <h4 className="text-sm font-semibold text-[var(--text-primary)]">{note.title}</h4>}
                    <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-6">{note.body}</p>

                    {note.alternatives && (
                      <p className="text-[11px] text-muted">
                        <span className="font-semibold">{isAr ? 'بدائل مطروحة: ' : 'Alternatives: '}</span>
                        {note.alternatives}
                      </p>
                    )}
                    {note.openQuestions && (
                      <p className="text-[11px] text-[var(--tone-warning)]">
                        <span className="font-semibold">{isAr ? 'أسئلة مفتوحة: ' : 'Open questions: '}</span>
                        {note.openQuestions}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2">
                      {note.convertedToStepId ? (
                        <span className="text-[10px] text-[var(--tone-success)] flex items-center gap-1">
                          <NuqtaIcon name="check" className="w-3 h-3" />
                          {t(ui.convertedToStep, isAr)}
                        </span>
                      ) : (
                        <button
                          className="btn subtle text-[10px] py-1 px-2"
                          onClick={() => {
                            convertProjectNoteToStep(project.id, note.id);
                            feedback.success(isAr ? 'حُوّلت إلى خطوة' : 'Turned into a step');
                          }}
                        >
                          {t(ui.convertToStep, isAr)}
                        </button>
                      )}
                      {note.convertedToTaskId ? (
                        <span className="text-[10px] text-[var(--tone-success)] flex items-center gap-1">
                          <NuqtaIcon name="check" className="w-3 h-3" />
                          {t(ui.convertedToTask, isAr)}
                        </span>
                      ) : (
                        <button
                          className="btn subtle text-[10px] py-1 px-2"
                          onClick={() => {
                            convertProjectNoteToTask(project.id, note.id);
                            feedback.success(isAr ? 'حُوّلت إلى مهمة' : 'Turned into a task');
                          }}
                        >
                          {t(ui.convertToTask, isAr)}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <ProjectTimeline project={project} isAr={isAr} today={today} />
      )}

      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1 text-xs"
              placeholder={isAr ? 'عنوان المورد' : 'Resource title'}
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
            />
            <input
              className="input flex-1 text-xs"
              placeholder={isAr ? 'رابط (اختياري)' : 'URL (optional)'}
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitResource()}
            />
            <button className="btn primary text-xs" onClick={submitResource} disabled={!resourceTitle.trim()}>
              + {isAr ? 'مورد' : 'Resource'}
            </button>
          </div>

          {project.resources.length === 0 ? (
            <EmptyState icon="layers" title={t(ui.emptyResources, isAr)} description={t(ui.emptyResourcesBody, isAr)} />
          ) : (
            <ul className="panel divide-y divide-[var(--border-subtle)] border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl overflow-hidden">
              {project.resources.map((r) => (
                <li key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-accent hover:underline truncate block"
                      >
                        {r.title}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--text-primary)] truncate block">{r.title}</span>
                    )}
                    <span className="text-[10px] text-muted">{r.kind}</span>
                  </div>
                  <button
                    className="text-muted hover:text-[var(--tone-danger)] shrink-0"
                    onClick={() => deleteProjectResource(project.id, r.id)}
                    title={t(ui.delete, isAr)}
                  >
                    <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl">
          {project.activity.length === 0 ? (
            <EmptyState icon="activity" title={t(ui.emptyActivity, isAr)} description={t(ui.emptyActivityBody, isAr)} />
          ) : (
            <ol className="space-y-3">
              {project.activity.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-primary)]">{event.summary}</p>
                    <span className="text-[10px] text-muted font-mono">
                      {new Date(event.timestamp).toLocaleString(isAr ? 'ar' : 'en-GB')}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- Step row ---------- */

interface StepRowProps {
  step: { id: string; title: string; status: ProjectStepStatus; blockedReason?: string; description?: string };
  isAr: boolean;
  onStatus: (status: ProjectStepStatus) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

const StepRow: React.FC<StepRowProps> = ({ step, isAr, onStatus, onDelete, onMove }) => {
  const done = step.status === 'done';
  const blocked = step.status === 'blocked';
  return (
    <li className="flex items-start gap-2 group py-1">
      <button
        onClick={() => onStatus(done ? 'open' : 'done')}
        className={`w-4 h-4 rounded border grid place-items-center shrink-0 mt-0.5 ${
          done ? 'bg-[var(--tone-success)] border-[var(--tone-success)] text-white' : 'border-[var(--border-strong)]'
        }`}
        title={done ? t(ui.reopen, isAr) : t(ui.markDone, isAr)}
      >
        {done && <NuqtaIcon name="check" className="w-3 h-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-xs ${done ? 'line-through text-muted' : 'text-[var(--text-primary)]'}`}>{step.title}</p>
        {blocked && (
          <span className="text-[10px] text-[var(--tone-warning)]">
            {t(stepStatusLabel.blocked, isAr)}
            {step.blockedReason ? ` · ${step.blockedReason}` : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          className="text-muted hover:text-[var(--text-primary)] p-0.5"
          onClick={() => onStatus(blocked ? 'open' : 'blocked')}
          title={blocked ? t(ui.reopen, isAr) : t(ui.block, isAr)}
        >
          <NuqtaIcon name={blocked ? 'undo' : 'alert'} className="w-3 h-3" />
        </button>
        <button className="text-muted hover:text-[var(--text-primary)] p-0.5" onClick={() => onMove('up')} title={isAr ? 'أعلى' : 'Move up'}>
          <NuqtaIcon name="chevronDown" className="w-3 h-3 rotate-180" />
        </button>
        <button className="text-muted hover:text-[var(--text-primary)] p-0.5" onClick={() => onMove('down')} title={isAr ? 'أسفل' : 'Move down'}>
          <NuqtaIcon name="chevronDown" className="w-3 h-3" />
        </button>
        <button className="text-muted hover:text-[var(--tone-danger)] p-0.5" onClick={onDelete} title={t(ui.delete, isAr)}>
          <NuqtaIcon name="trash" className="w-3 h-3" />
        </button>
      </div>
    </li>
  );
};

/* ---------- Project timeline ---------- */

/**
 * The project's own dates, drawn as ranges rather than points.
 *
 * A project or phase is not an event: it spans a window, and showing it as a dot would
 * misrepresent the plan. Bars are positioned from the earliest and latest date in the
 * project, and phases are nested under the project bar.
 */
const ProjectTimeline: React.FC<{ project: Project; isAr: boolean; today: string }> = ({ project, isAr, today }) => {
  const dates: { label: string; start?: string; end?: string; tone: string }[] = [];

  if (project.startDate || project.targetDate) {
    dates.push({
      label: project.title,
      start: project.startDate,
      end: project.targetDate,
      tone: 'brand'
    });
  }
  for (const phase of [...project.phases].sort((a, b) => a.order - b.order)) {
    if (phase.startDate || phase.targetDate) {
      dates.push({ label: phase.title, start: phase.startDate, end: phase.targetDate, tone: 'info' });
    }
  }

  if (dates.length === 0) {
    return <EmptyState icon="history" title={t(ui.emptyTimeline, isAr)} description={t(ui.emptyTimelineBody, isAr)} />;
  }

  const allDates = dates.flatMap((d) => [d.start, d.end]).filter((d): d is string => Boolean(d)).sort();
  const min = allDates[0];
  const max = allDates[allDates.length - 1];
  const minMs = Date.parse(`${min}T00:00:00`);
  const maxMs = Date.parse(`${max}T00:00:00`);
  const span = Math.max(maxMs - minMs, 86_400_000);
  const pct = (date?: string) => {
    if (!date) return null;
    const ms = Date.parse(`${date}T00:00:00`);
    if (Number.isNaN(ms)) return null;
    return ((ms - minMs) / span) * 100;
  };
  const todayPct = pct(today);

  return (
    <div className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-4">
      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <div className="relative space-y-3">
        {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--tone-warning)]"
            style={{ insetInlineStart: `${todayPct}%` }}
            title={isAr ? 'اليوم' : 'Today'}
          />
        )}
        {dates.map((row, i) => {
          const start = pct(row.start) ?? 0;
          const end = pct(row.end) ?? 100;
          const width = Math.max(end - start, 1.5);
          return (
            <div key={`${row.label}-${i}`} className="space-y-1">
              <span className="text-[11px] text-[var(--text-primary)] block truncate">{row.label}</span>
              <div className="relative h-4 bg-[var(--surface-chip)] rounded border border-[var(--border-subtle)]">
                <div
                  className={`absolute top-0 bottom-0 rounded bg-[var(--tone-${row.tone})] opacity-80`}
                  style={{ insetInlineStart: `${start}%`, width: `${width}%` }}
                />
              </div>
              <span className="text-[10px] text-muted font-mono">
                {row.start ?? '—'} → {row.end ?? '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
