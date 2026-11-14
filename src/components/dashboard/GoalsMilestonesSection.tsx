import React from 'react';
import { Goal } from '../../types';
import {
  GoalMilestoneOverview,
  MilestoneTimelineItem
} from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface GoalsMilestonesSectionProps {
  items: GoalMilestoneOverview[];
  milestones: MilestoneTimelineItem[];
  isAr: boolean;
  onInspectGoal: (goal: Goal) => void;
  onOpenGoalsPage: () => void;
}

export const GoalsMilestonesSection: React.FC<GoalsMilestonesSectionProps> = ({
  items,
  milestones,
  isAr,
  onInspectGoal,
  onOpenGoalsPage
}) => {
  const visible = items.slice(0, 6);
  const goalById = new Map(items.map((it) => [it.goal.id, it.goal]));

  return (
    <section
      className="dash-glass p-4 sm:p-5 space-y-5"
      aria-label={isAr ? 'الأهداف والمعالم' : 'Goals and Milestones'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {isAr ? 'مخطط الأهداف والمعالم' : 'GOALS BULLET MATRIX & MILESTONE HORIZON'}
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 m-0">
            {isAr ? 'النتيجة مقابل التنفيذ ومسار المعالم' : 'Outcome vs Execution & Milestone Horizon'}
          </h2>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="hidden sm:flex items-center gap-3 text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2 bg-[var(--brand-strong)] inline-block rounded-[2px]" />
              <span>{isAr ? 'تقدم النتيجة' : 'Outcome %'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-0.5 h-3 bg-[var(--blue)] inline-block" />
              <span>{isAr ? 'التزام التنفيذ' : 'Execution Tick'}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenGoalsPage}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-primary)] hover:border-[var(--brand-soft-border)] transition-colors whitespace-nowrap"
          >
            {isAr ? `جميع الأهداف (${items.length})` : `All Goals (${items.length})`}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="dash-glass-inset p-7 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand-soft-border)] text-[var(--brand-strong)] grid place-items-center mx-auto mb-2.5">
            <NuqtaIcon name="target" className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr ? 'لا توجد أهداف نشطة حالياً' : 'No active goals configured yet'}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            {isAr
              ? 'حدّد هدفاً بنتائج قابلة للقياس ومعالم زمنية لمقارنة التقدم الفعلي بالالتزام اليومي.'
              : 'Define an active goal with measurable key results or milestones to compare outcome vs execution.'}
          </div>
          <button
            type="button"
            onClick={onOpenGoalsPage}
            className="mt-3.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--brand)] text-[var(--text-on-accent)]"
          >
            {isAr ? 'إضافة هدف' : 'Create Goal'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Stephen Few Bullet Chart Rows */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {visible.map(({ goal, summary, nextMilestoneTitle, nextMilestoneDate }) => {
              const pacingTone =
                summary.pacingStatus === 'ahead' || summary.pacingStatus === 'completed'
                  ? 'text-[var(--state-success-strong)]'
                  : summary.pacingStatus === 'behind' || summary.isOverdue
                  ? 'text-[var(--state-danger-strong)]'
                  : summary.pacingStatus === 'dormant'
                  ? 'text-[var(--state-warning-strong)]'
                  : 'text-[var(--brand-strong)]';

              const hasLinkedExec = summary.executionSummary.totalLinkedActivitiesCount > 0;
              const execPct = Math.min(99, Math.max(0, summary.executionProgressPercent));
              const outPct = Math.min(100, Math.max(0, summary.outcomeProgressPercent));

              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onInspectGoal(goal)}
                  className="w-full py-3 first:pt-0 last:pb-0 text-start hover:bg-[var(--surface-faint)] px-2 -mx-2 rounded-lg transition-colors grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                >
                  {/* Goal Title & Metadata */}
                  <div className="lg:col-span-5 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="uppercase text-[var(--text-tertiary)]">{goal.category}</span>
                      <span className="text-[var(--text-tertiary)]">·</span>
                      <span className={pacingTone}>
                        {isAr ? summary.pacingLabelAr : summary.pacingLabelEn}
                      </span>
                      {summary.daysRemaining !== null && (
                        <>
                          <span className="text-[var(--text-tertiary)]">·</span>
                          <span className="text-[var(--text-secondary)]">
                            {summary.daysRemaining < 0
                              ? isAr
                                ? `متأخر ${Math.abs(summary.daysRemaining)}ي`
                                : `${Math.abs(summary.daysRemaining)}d overdue`
                              : `${summary.daysRemaining}${isAr ? 'ي' : 'd left'}`}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)] truncate mt-0.5">
                      {goal.title}
                    </div>
                    {nextMilestoneTitle && (
                      <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                        {isAr ? 'التالي:' : 'Next:'} {nextMilestoneTitle}
                        {nextMilestoneDate ? ` (${nextMilestoneDate})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Bullet Chart Track (0–100% with 33/66/100 qualitative bands + Outcome bar + Execution marker) */}
                  <div className="lg:col-span-5 flex items-center gap-3" dir="ltr">
                    <div className="relative flex-1 h-5 rounded-[4px] overflow-hidden border border-[var(--border-subtle)] flex">
                      {/* Qualitative background bands */}
                      <div className="w-1/3 h-full bg-[var(--surface-deep)]/90" />
                      <div className="w-1/3 h-full bg-[var(--surface-sunken)]/80 border-x border-[var(--border-subtle)]/40" />
                      <div className="w-1/3 h-full bg-[var(--surface-track)]/75" />

                      {/* Actual Outcome Bar */}
                      <div
                        className="absolute top-1.5 bottom-1.5 left-0 rounded-r-[2px] bg-[var(--brand-strong)] transition-all"
                        style={{ width: `${outPct}%` }}
                      />

                      {/* Linked Execution Reference Tick */}
                      {hasLinkedExec && (
                        <div
                          className="absolute top-0.5 bottom-0.5 w-[2.5px] bg-[var(--blue)] shadow-sm"
                          style={{ left: `${execPct}%` }}
                          title={`Execution: ${summary.executionProgressPercent}%`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Tabular Numeric Pair */}
                  <div className="lg:col-span-2 flex lg:flex-col items-baseline lg:items-end justify-between gap-2 font-mono tabular-nums">
                    <span className="text-sm font-bold text-[var(--brand)]">
                      {summary.outcomeProgressPercent}%{' '}
                      <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
                        {isAr ? 'نتيجة' : 'Out'}
                      </span>
                    </span>
                    <span className="text-[11px] text-[var(--blue)]">
                      {hasLinkedExec
                        ? `${summary.executionProgressPercent}% ${isAr ? 'تنفيذ' : 'Exec'}`
                        : isAr
                        ? 'غير مرتبط'
                        : 'Unlinked'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. Horizontal Milestone Horizon Timeline */}
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {isAr ? 'الخط الزمني للمعالم القادمة والمكتملة' : 'MILESTONE HORIZON TIMELINE'}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                {milestones.filter((m) => m.isCompleted).length}/{milestones.length}{' '}
                {isAr ? 'مكتملة' : 'completed'}
              </span>
            </div>

            {milestones.length === 0 ? (
              <div className="text-xs text-[var(--text-tertiary)] py-2">
                {isAr
                  ? 'لا توجد معالم مسجلة على الأهداف النشطة بعد.'
                  : 'No milestones defined on active goals yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="relative flex items-start gap-3 min-w-max pt-3">
                  {/* Continuous Horizon Rail */}
                  <div
                    className="absolute top-[19px] left-4 right-4 h-[1.5px] bg-[var(--border-default)] pointer-events-none"
                    aria-hidden="true"
                  />

                  {milestones.slice(0, 10).map((ms) => {
                    const goalObj = goalById.get(ms.goalId);
                    const dotColor =
                      ms.status === 'completed'
                        ? 'var(--state-success-strong)'
                        : ms.status === 'overdue'
                        ? 'var(--state-danger)'
                        : ms.status === 'upcoming'
                        ? 'var(--state-warning)'
                        : 'var(--text-tertiary)';

                    return (
                      <button
                        key={ms.id}
                        type="button"
                        onClick={() => goalObj && onInspectGoal(goalObj)}
                        className="relative z-10 w-[165px] shrink-0 text-start group"
                      >
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span
                            className="w-3 h-3 rounded-full border-2 border-[var(--surface-raised)] shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="text-[10.5px] font-mono tabular-nums text-[var(--text-secondary)] truncate">
                            {ms.targetDate ||
                              ms.completedDate ||
                              (isAr ? 'بدون تاريخ' : 'Undated')}
                          </span>
                        </div>
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] group-hover:border-[var(--brand-soft-border)] px-2.5 py-2 transition-colors">
                          <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {ms.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                            {ms.goalTitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
