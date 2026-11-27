import React, { useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { localDateKey } from '../lib/dateKey';
import { NuqtaIcon } from './NuqtaIcon';
import { EmptyState, PageHeader, TabBar } from './ui';
import { dialogs, feedback } from './ui/dialogController';
import { deriveProjectProgress, assessProjectHealth, nextAction, PROJECT_STATUS_ORDER } from '../lib/projectProgress';
import { statusLabel, statusTone, statusIcon, categoryLabel, healthLabel, healthTone, ui } from '../lib/projectLabels';
import { ProjectWorkspace } from './ProjectWorkspace';

const t = (label: { ar: string; en: string }, isAr: boolean) => (isAr ? label.ar : label.en);

type StatusFilter = 'all' | 'open' | 'completed' | 'archived';

export const ProjectsView: React.FC = () => {
  const { projects, tasks, goals, profile, createProject, deleteProject } = useNuqtaStore();
  const isAr = profile.language === 'ar';
  const today = localDateKey();

  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftGoalId, setDraftGoalId] = useState('');

  // The workspace is a place, not a modal: opening a project should survive a refresh
  // and be linkable, so it renders as its own screen with a back affordance.
  const openProject = openProjectId ? projects.find((p) => p.id === openProjectId) : null;

  const counts = useMemo(() => {
    const open = projects.filter((p) => p.status === 'active' || p.status === 'planned' || p.status === 'on_hold');
    return {
      all: projects.length,
      open: open.length,
      completed: projects.filter((p) => p.status === 'completed').length,
      archived: projects.filter((p) => p.status === 'archived').length,
      atRisk: projects.filter((p) => {
        const h = assessProjectHealth(p, tasks, today).health;
        return h === 'at_risk' || h === 'stalled';
      }).length
    };
  }, [projects, tasks, today]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (statusFilter === 'open') return p.status === 'active' || p.status === 'planned' || p.status === 'on_hold';
        if (statusFilter === 'completed') return p.status === 'completed';
        if (statusFilter === 'archived') return p.status === 'archived';
        return true;
      })
      .filter((p) => {
        if (!query) return true;
        return (
          p.title.toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query) ||
          (p.purpose ?? '').toLowerCase().includes(query) ||
          p.steps.some((s) => s.title.toLowerCase().includes(query)) ||
          p.notes.some((n) => (n.title ?? n.body).toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        // Live work first, then by lifecycle order, then most recently touched.
        const rank = (p: typeof a) => PROJECT_STATUS_ORDER.indexOf(p.status);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (b.lastMeaningfulUpdateAt ?? b.updatedAt).localeCompare(a.lastMeaningfulUpdateAt ?? a.updatedAt);
      });
  }, [projects, statusFilter, search]);

  // Every hook above runs on both screens; only the returned tree differs. Returning
  // early before the memos would change the hook count between renders.
  if (openProject) {
    return <ProjectWorkspace project={openProject} onBack={() => setOpenProjectId(null)} />;
  }

  const submitNew = () => {
    const title = draftTitle.trim();
    if (!title) return;
    const created = createProject({ title, goalIds: draftGoalId ? [draftGoalId] : [], status: 'active' });
    setDraftTitle('');
    setDraftGoalId('');
    setCreating(false);
    feedback.success(isAr ? 'أُنشئ المشروع' : 'Project created');
    setOpenProjectId(created.id);
  };

  const confirmDelete = async (id: string, title: string) => {
    const ok = await dialogs.confirm({
      title: t(ui.deleteProjectTitle, isAr),
      description: `${title}\n\n${t(ui.deleteProjectBody, isAr)}`,
      confirmLabel: t(ui.delete, isAr),
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      tone: 'danger'
    });
    if (!ok) return;
    deleteProject(id);
    feedback.success(isAr ? 'حُذف المشروع' : 'Project deleted');
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        eyebrow={t(ui.hubEyebrow, isAr)}
        title={t(ui.hubTitle, isAr)}
        description={t(ui.hubDescription, isAr)}
        actions={
          <button className="btn primary" onClick={() => setCreating((v) => !v)}>
            <span className="btn-icon">+</span>
            <span>{t(ui.newProject, isAr)}</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'مشاريع قائمة' : 'Open projects'}</span>
          <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--text-primary)]">{counts.open}</strong>
          <span className="text-[11px] text-muted">{isAr ? `من ${counts.all} مشروع` : `of ${counts.all} total`}</span>
        </div>
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'مكتملة' : 'Completed'}</span>
          <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--tone-success)]">{counts.completed}</strong>
          <span className="text-[11px] text-muted">{isAr ? 'مشاريع أُغلقت' : 'projects closed'}</span>
        </div>
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'تحتاج انتباهاً' : 'Needs attention'}</span>
          <strong
            className={`text-2xl font-mono font-bold mt-1 block ${
              counts.atRisk > 0 ? 'text-[var(--tone-warning)]' : 'text-muted'
            }`}
          >
            {counts.atRisk}
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'معرَّضة للخطر أو متوقفة' : 'at risk or stalled'}</span>
        </div>
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl">
          <span className="text-muted text-xs block">{isAr ? 'مرتبطة بأهداف' : 'Goal-linked'}</span>
          <strong className="text-2xl font-mono font-bold mt-1 block text-[var(--tone-info)]">
            {projects.filter((p) => p.goalIds.length > 0).length}
          </strong>
          <span className="text-[11px] text-muted">{isAr ? 'تخدم رؤية أكبر' : 'serving a bigger vision'}</span>
        </div>
      </div>

      {creating && (
        <div className="panel p-4 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl space-y-3">
          <input
            autoFocus
            className="input w-full text-sm"
            placeholder={isAr ? 'اسم المشروع' : 'Project name'}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setCreating(false);
            }}
          />
          {goals.length > 0 && (
            <select className="input w-full text-xs" value={draftGoalId} onChange={(e) => setDraftGoalId(e.target.value)}>
              <option value="">{isAr ? 'بدون هدف مرتبط' : 'No linked goal'}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <button className="btn primary text-xs" onClick={submitNew} disabled={!draftTitle.trim()}>
              {isAr ? 'إنشاء' : 'Create'}
            </button>
            <button className="btn subtle text-xs" onClick={() => setCreating(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="panel p-3.5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <TabBar
          ariaLabel={isAr ? 'تصفية المشاريع' : 'Filter projects'}
          value={statusFilter}
          onChange={(id) => setStatusFilter(id as StatusFilter)}
          items={[
            { id: 'all', label: isAr ? 'الكل' : 'All', count: counts.all },
            { id: 'open', label: isAr ? 'قائمة' : 'Open', count: counts.open },
            { id: 'completed', label: isAr ? 'مكتملة' : 'Completed', count: counts.completed },
            { id: 'archived', label: isAr ? 'مؤرشفة' : 'Archived', count: counts.archived }
          ]}
        />
        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(ui.searchPlaceholder, isAr)}
            className="input w-full text-xs ps-8"
          />
          <NuqtaIcon name="search" className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted pointer-events-none" />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="blocks"
          title={t(ui.noProjects, isAr)}
          description={t(ui.noProjectsBody, isAr)}
          action={
            <button className="btn primary" onClick={() => setCreating(true)}>
              + {t(ui.newProject, isAr)}
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title={t(ui.noMatch, isAr)} description={t(ui.noMatchBody, isAr)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((project) => {
            const progress = deriveProjectProgress(project, tasks);
            const health = assessProjectHealth(project, tasks, today);
            const next = nextAction(project, tasks);
            const linkedGoals = goals.filter((g) => project.goalIds.includes(g.id));
            const cat = project.category ? categoryLabel[project.category] : null;

            return (
              <article
                key={project.id}
                className="panel p-5 border border-[var(--border-default)] bg-[var(--surface-raised)] rounded-2xl space-y-4 hover:border-accent/40 transition-all shadow-lg hover:shadow-xl group"
              >
                <div className="flex items-start justify-between gap-3">
                  <button className="text-start min-w-0 flex-1" onClick={() => setOpenProjectId(project.id)}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border font-semibold flex items-center gap-1 bg-[var(--tone-${statusTone[project.status]}-wash)] text-[var(--tone-${statusTone[project.status]})] border-[var(--tone-${statusTone[project.status]}-line)]`}
                      >
                        <NuqtaIcon name={statusIcon[project.status]} className="w-3 h-3" />
                        <span>{t(statusLabel[project.status], isAr)}</span>
                      </span>
                      {cat && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-chip)] text-muted border border-[var(--border-subtle)] flex items-center gap-1">
                          <NuqtaIcon name={cat.icon} className="w-3 h-3" />
                          <span>{t(cat, isAr)}</span>
                        </span>
                      )}
                      {health.health !== 'unknown' && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-semibold bg-[var(--tone-${healthTone[health.health]}-wash)] text-[var(--tone-${healthTone[health.health]})] border-[var(--tone-${healthTone[health.health]}-line)]`}
                        >
                          {t(healthLabel[health.health], isAr)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-accent transition-colors leading-snug truncate">
                      {project.title}
                    </h3>
                    {project.desiredOutcome && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{project.desiredOutcome}</p>
                    )}
                  </button>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-lg font-mono font-bold text-accent">
                      {progress.percent === null ? '—' : `${progress.percent}%`}
                    </span>
                    <button
                      className="text-muted hover:text-[var(--tone-danger)] p-1"
                      title={t(ui.delete, isAr)}
                      onClick={() => confirmDelete(project.id, project.title)}
                    >
                      <NuqtaIcon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* The bar is only drawn when there is something to measure. An empty
                    track would read as "0% done", which is a different claim. */}
                {progress.percent !== null ? (
                  <div className="space-y-1">
                    <div className="w-full bg-[var(--surface-chip)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                      <span>
                        {progress.source === 'manual'
                          ? t(ui.progressManual, isAr)
                          : progress.source === 'steps'
                            ? `${progress.stepsDone}/${progress.stepsTotal} ${isAr ? 'خطوة' : 'steps'}`
                            : `${progress.tasksDone}/${progress.tasksTotal} ${isAr ? 'مهمة' : 'tasks'}`}
                      </span>
                      {health.daysToTarget !== null && (
                        <span className={health.daysToTarget < 0 ? 'text-[var(--tone-danger)]' : ''}>
                          {health.daysToTarget < 0
                            ? `${t(ui.overdue, isAr)} ${Math.abs(health.daysToTarget)}${isAr ? 'ي' : 'd'}`
                            : health.daysToTarget === 0
                              ? t(ui.dueToday, isAr)
                              : `${health.daysToTarget}${isAr ? 'ي' : 'd'}`}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">{t(ui.progressNone, isAr)}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  {project.phases.length > 0 && (
                    <span className="flex items-center gap-1">
                      <NuqtaIcon name="layers" className="w-3 h-3" />
                      {project.phases.length} {isAr ? 'مرحلة' : 'phases'}
                    </span>
                  )}
                  {project.steps.length > 0 && (
                    <span className="flex items-center gap-1">
                      <NuqtaIcon name="list" className="w-3 h-3" />
                      {project.steps.length} {isAr ? 'خطوة' : 'steps'}
                    </span>
                  )}
                  {linkedGoals.length > 0 && (
                    <span className="flex items-center gap-1 text-[var(--tone-info)]">
                      <NuqtaIcon name="target" className="w-3 h-3" />
                      {linkedGoals.length} {isAr ? 'هدف' : 'goals'}
                    </span>
                  )}
                </div>

                {/* Next action is stated only when the project actually names one. */}
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted block mb-1">
                    {t(ui.nextAction, isAr)}
                  </span>
                  {next ? (
                    <p className="text-xs text-[var(--text-primary)] flex items-start gap-1.5">
                      <NuqtaIcon name={next.kind === 'step' ? 'arrow' : 'check-square'} className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                      <span className="line-clamp-2">
                        {next.kind === 'step' ? next.step.title : next.task.title}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted">{t(ui.noNextAction, isAr)}</p>
                  )}
                </div>

                <button className="btn subtle text-xs w-full" onClick={() => setOpenProjectId(project.id)}>
                  {isAr ? 'فتح مساحة العمل' : 'Open workspace'}
                  <NuqtaIcon name="chevronRight" className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
