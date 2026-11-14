import React, { useMemo, useState } from 'react';
import { Goal } from '../../types';
import { LifeConnectionsData } from '../../lib/dashboardAnalytics';
import { NuqtaIcon } from '../NuqtaIcon';

interface LifeConnectionsSectionProps {
  connections: LifeConnectionsData;
  isAr: boolean;
  onInspectGoal: (goal: Goal) => void;
  onOpenGoals: () => void;
}

type ChannelId = 'habits' | 'tasks' | 'books' | 'art';

export const LifeConnectionsSection: React.FC<LifeConnectionsSectionProps> = ({
  connections,
  isAr,
  onInspectGoal,
  onOpenGoals
}) => {
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);

  const visibleGroups = connections.groups.slice(0, 6);

  const sankey = useMemo(() => {
    const W = 920;
    const padX = 24;
    const col1W = 148;
    const col2W = 240;
    const col3W = 180;
    const col1X = padX;
    const col2X = Math.round((W - col2W) / 2);
    const col3X = W - padX - col3W;

    // 1. Domains column (aggregated)
    const domainMap = new Map<string, { id: string; color: string; weight: number; goalIds: string[] }>();
    for (const grp of visibleGroups) {
      const cat = grp.goal.category;
      const existing = domainMap.get(cat);
      if (existing) {
        existing.weight += grp.totalWeight;
        existing.goalIds.push(grp.goal.id);
      } else {
        domainMap.set(cat, {
          id: cat,
          color: grp.domainColor,
          weight: grp.totalWeight,
          goalIds: [grp.goal.id]
        });
      }
    }
    const domainNodes = Array.from(domainMap.values());

    // 2. Channels column (Habits, Tasks, Books, Creative Art)
    const rawChannels: Array<{ id: ChannelId; labelAr: string; labelEn: string; color: string; count: number }> = [
      {
        id: 'habits',
        labelAr: 'العادات المرتبطة',
        labelEn: 'Linked Habits',
        color: 'var(--brand-strong)',
        count: visibleGroups.reduce((s, g) => s + g.linkedHabitNames.length, 0)
      },
      {
        id: 'tasks',
        labelAr: 'المهام المرتبطة',
        labelEn: 'Linked Tasks',
        color: 'var(--blue)',
        count: visibleGroups.reduce((s, g) => s + g.linkedTaskCount, 0)
      },
      {
        id: 'books',
        labelAr: 'الكتب والقراءة',
        labelEn: 'Reading Books',
        color: 'var(--d-reading-accent)',
        count: visibleGroups.reduce((s, g) => s + g.linkedBookNames.length, 0)
      },
      {
        id: 'art',
        labelAr: 'مشاريع الإبداع',
        labelEn: 'Creative Projects',
        color: 'var(--d-drawing-accent)',
        count: visibleGroups.reduce((s, g) => s + g.linkedArtNames.length, 0)
      }
    ];
    const channelTotals = rawChannels.filter((c) => c.count > 0);

    const rows = Math.max(domainNodes.length, visibleGroups.length, channelTotals.length, 1);
    const rowStep = 44;
    const H = Math.max(190, rows * rowStep + 26);

    const distributeY = (count: number, nodeH: number) => {
      if (count <= 0) return [];
      const usable = H - 24;
      const step = usable / count;
      return Array.from({ length: count }, (_, i) => 12 + i * step + (step - nodeH) / 2);
    };

    const domYs = distributeY(domainNodes.length, 28);
    const goalYs = distributeY(visibleGroups.length, 32);
    const chanYs = distributeY(channelTotals.length, 28);

    const domPos = new Map(domainNodes.map((d, i) => [d.id, { ...d, x: col1X, y: domYs[i], h: 28 }]));
    const goalPos = visibleGroups.map((g, i) => ({
      group: g,
      x: col2X,
      y: goalYs[i],
      h: 32
    }));
    const chanPos = new Map(
      channelTotals.map((c, i) => [c.id, { ...c, x: col3X, y: chanYs[i], h: 28 }])
    );

    const leftFlows: Array<{
      id: string;
      goalId: string;
      domainId: string;
      d: string;
      color: string;
      strokeW: number;
    }> = [];

    const rightFlows: Array<{
      id: string;
      goalId: string;
      channelId: ChannelId;
      d: string;
      color: string;
      strokeW: number;
    }> = [];

    const bezier = (x1: number, y1: number, x2: number, y2: number) => {
      const mx = (x1 + x2) / 2;
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    for (const gp of goalPos) {
      const dom = domPos.get(gp.group.goal.category);
      if (dom) {
        leftFlows.push({
          id: `l-${dom.id}-${gp.group.goal.id}`,
          goalId: gp.group.goal.id,
          domainId: dom.id,
          d: bezier(dom.x + col1W, dom.y + dom.h / 2, gp.x, gp.y + gp.h / 2),
          color: gp.group.domainColor,
          strokeW: Math.min(8, Math.max(2, gp.group.totalWeight * 1.4))
        });
      }

      const channelCounts: Array<{ id: ChannelId; cnt: number }> = [
        { id: 'habits', cnt: gp.group.linkedHabitNames.length },
        { id: 'tasks', cnt: gp.group.linkedTaskCount },
        { id: 'books', cnt: gp.group.linkedBookNames.length },
        { id: 'art', cnt: gp.group.linkedArtNames.length }
      ];
      for (const cc of channelCounts) {
        if (cc.cnt <= 0) continue;
        const ch = chanPos.get(cc.id);
        if (!ch) continue;
        rightFlows.push({
          id: `r-${gp.group.goal.id}-${cc.id}`,
          goalId: gp.group.goal.id,
          channelId: cc.id,
          d: bezier(gp.x + col2W, gp.y + gp.h / 2, ch.x, ch.y + ch.h / 2),
          color: ch.color,
          strokeW: Math.min(7, Math.max(2, cc.cnt * 1.5))
        });
      }
    }

    return {
      W,
      H,
      col1W,
      col2W,
      col3W,
      domainNodes: Array.from(domPos.values()),
      goalPos,
      channelNodes: Array.from(chanPos.values()),
      leftFlows,
      rightFlows
    };
  }, [visibleGroups]);

  const activeGroup = hoveredGoalId
    ? visibleGroups.find((g) => g.goal.id === hoveredGoalId) || null
    : null;

  return (
    <section
      className="dash-glass p-4 sm:p-5"
      aria-label={isAr ? 'روابط الحياة والترابط' : 'Life Connections'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {isAr ? 'مخطط التدفق والترابط' : 'LIFE CONNECTIONS SANKEY FLOW'}
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 m-0">
            {isAr ? 'كيف تتدفق أنشطتك نحو أهدافك' : 'How Daily Activities Flow Into Goals'}
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
          <span>
            {connections.connectedGoalsCount}/{connections.activeGoalsCount}{' '}
            {isAr ? 'أهداف مترابطة' : 'linked goals'}
          </span>
          <span>·</span>
          <span>
            {connections.totalLinksCount} {isAr ? 'روابط نشطة' : 'active links'}
          </span>
        </div>
      </div>

      {!connections.hasConnections ? (
        <div className="dash-glass-inset p-6 text-center">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {isAr
              ? 'لم يتم ربط أي أهداف بمهام أو عادات أو كتب بعد'
              : 'No explicit links between goals, habits, or activities yet'}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg mx-auto">
            {isAr
              ? 'اربط مهامك أو عاداتك اليومية بأهدافك لتوضيح مساهمة كل نشاط في تحقيق نتائجك.'
              : 'Link tasks, habits, books, or creative projects to your goals to visualize how daily effort compounds.'}
          </div>
          <button
            type="button"
            onClick={onOpenGoals}
            className="mt-3.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-primary)]"
          >
            {isAr ? 'إدارة الروابط في الأهداف' : 'Link Activities in Goals'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Interactive SVG Sankey / Flow Diagram */}
          {visibleGroups.length > 0 && (
            <div className="hidden md:block">
              <div className="flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)] px-6 mb-1" dir="ltr">
                <span>{isAr ? 'المجالات' : 'Life Domains'}</span>
                <span>{isAr ? 'الأهداف النشطة (اضغط للفحص)' : 'Active Goals (click to inspect)'}</span>
                <span>{isAr ? 'الأنشطة المغذية' : 'Execution Channels'}</span>
              </div>

              <div dir="ltr">
              <svg
                viewBox={`0 0 ${sankey.W} ${sankey.H}`}
                className="w-full h-auto max-h-[300px] overflow-visible select-none"
              >
                {/* Left Flow Ribbons (Domain -> Goal) */}
                {sankey.leftFlows.map((fl) => {
                  const active =
                    (hoveredGoalId && hoveredGoalId === fl.goalId) ||
                    (hoveredDomain && hoveredDomain === fl.domainId);
                  const dimmed = Boolean((hoveredGoalId || hoveredDomain) && !active);
                  return (
                    <path
                      key={fl.id}
                      d={fl.d}
                      fill="none"
                      stroke={fl.color}
                      strokeWidth={fl.strokeW}
                      strokeOpacity={dimmed ? 0.1 : active ? 0.8 : 0.34}
                      strokeLinecap="round"
                      className="transition-opacity duration-150"
                    />
                  );
                })}

                {/* Right Flow Ribbons (Goal -> Activity Channel) */}
                {sankey.rightFlows.map((fl) => {
                  const active = hoveredGoalId === fl.goalId;
                  const dimmed = Boolean((hoveredGoalId || hoveredDomain) && !active);
                  return (
                    <path
                      key={fl.id}
                      d={fl.d}
                      fill="none"
                      stroke={fl.color}
                      strokeWidth={fl.strokeW}
                      strokeOpacity={dimmed ? 0.1 : active ? 0.85 : 0.32}
                      strokeLinecap="round"
                      className="transition-opacity duration-150"
                    />
                  );
                })}

                {/* Column 1: Domain Nodes */}
                {sankey.domainNodes.map((dn) => {
                  const dimmed = Boolean(
                    hoveredDomain
                      ? hoveredDomain !== dn.id
                      : hoveredGoalId && !dn.goalIds.includes(hoveredGoalId)
                  );
                  return (
                    <g
                      key={dn.id}
                      className="cursor-pointer"
                      opacity={dimmed ? 0.4 : 1}
                      onMouseEnter={() => setHoveredDomain(dn.id)}
                      onMouseLeave={() => setHoveredDomain(null)}
                    >
                      <rect
                        x={dn.x}
                        y={dn.y}
                        width={sankey.col1W}
                        height={dn.h}
                        rx="6"
                        fill="var(--surface-inset)"
                        stroke={dn.color}
                        strokeOpacity="0.6"
                      />
                      <circle cx={dn.x + 12} cy={dn.y + dn.h / 2} r="4" fill={dn.color} />
                      <text
                        x={dn.x + 22}
                        y={dn.y + dn.h / 2 + 3.5}
                        fill="var(--text-primary)"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {dn.id.toUpperCase()}
                      </text>
                      <text
                        x={dn.x + sankey.col1W - 10}
                        y={dn.y + dn.h / 2 + 3.5}
                        textAnchor="end"
                        fill="var(--text-tertiary)"
                        fontSize="10"
                        fontFamily="ui-monospace, monospace"
                      >
                        {dn.weight}
                      </text>
                    </g>
                  );
                })}

                {/* Column 2: Active Goal Nodes */}
                {sankey.goalPos.map((gp) => {
                  const g = gp.group;
                  const dimmed = Boolean(
                    (hoveredGoalId && hoveredGoalId !== g.goal.id) ||
                      (hoveredDomain && g.goal.category !== hoveredDomain)
                  );
                  return (
                    <g
                      key={g.goal.id}
                      className="cursor-pointer"
                      opacity={dimmed ? 0.38 : 1}
                      onMouseEnter={() => setHoveredGoalId(g.goal.id)}
                      onMouseLeave={() => setHoveredGoalId(null)}
                      onClick={() => onInspectGoal(g.goal)}
                    >
                      <rect
                        x={gp.x}
                        y={gp.y}
                        width={sankey.col2W}
                        height={gp.h}
                        rx="7"
                        fill="var(--surface-raised)"
                        stroke={hoveredGoalId === g.goal.id ? 'var(--brand-strong)' : 'var(--border-default)'}
                        strokeWidth={hoveredGoalId === g.goal.id ? 1.5 : 1}
                      />
                      <text
                        x={gp.x + 11}
                        y={gp.y + gp.h / 2 + 4}
                        fill="var(--text-primary)"
                        fontSize="11.5"
                        fontWeight="700"
                      >
                        {g.goal.title.length > 24 ? `${g.goal.title.slice(0, 23)}…` : g.goal.title}
                      </text>
                      <text
                        x={gp.x + sankey.col2W - 10}
                        y={gp.y + gp.h / 2 + 4}
                        textAnchor="end"
                        fill="var(--brand-strong)"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="ui-monospace, monospace"
                      >
                        {g.summary.outcomeProgressPercent}%
                      </text>
                    </g>
                  );
                })}

                {/* Column 3: Execution Channels */}
                {sankey.channelNodes.map((cn) => (
                  <g key={cn.id}>
                    <rect
                      x={cn.x}
                      y={cn.y}
                      width={sankey.col3W}
                      height={cn.h}
                      rx="6"
                      fill="var(--surface-inset)"
                      stroke={cn.color}
                      strokeOpacity="0.45"
                    />
                    <circle cx={cn.x + 12} cy={cn.y + cn.h / 2} r="3.5" fill={cn.color} />
                    <text
                      x={cn.x + 22}
                      y={cn.y + cn.h / 2 + 3.5}
                      fill="var(--text-primary)"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {isAr ? cn.labelAr : cn.labelEn}
                    </text>
                    <text
                      x={cn.x + sankey.col3W - 10}
                      y={cn.y + cn.h / 2 + 3.5}
                      textAnchor="end"
                      fill="var(--text-secondary)"
                      fontSize="10.5"
                      fontFamily="ui-monospace, monospace"
                    >
                      {cn.count}
                    </text>
                  </g>
                ))}
              </svg>
              </div>

              {/* Interactive Focus Details Bar */}
              <div className="mt-2 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
                {activeGroup ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-primary)]">
                    <span className="font-bold">{activeGroup.goal.title}:</span>
                    {activeGroup.linkedHabitNames.length > 0 && (
                      <span className="text-[var(--brand-strong)] font-mono text-[11px]">
                        {activeGroup.linkedHabitNames.join(', ')}
                      </span>
                    )}
                    {activeGroup.linkedTaskCount > 0 && (
                      <span className="text-[var(--blue)] font-mono text-[11px]">
                        {activeGroup.linkedTaskDoneCount}/{activeGroup.linkedTaskCount}{' '}
                        {isAr ? 'مهام' : 'tasks'}
                      </span>
                    )}
                    {activeGroup.linkedBookNames.length > 0 && (
                      <span className="text-[var(--d-reading-accent)] font-mono text-[11px]">
                        {activeGroup.linkedBookNames.join(', ')}
                      </span>
                    )}
                    {activeGroup.linkedArtNames.length > 0 && (
                      <span className="text-[var(--d-drawing-accent)] font-mono text-[11px]">
                        {activeGroup.linkedArtNames.join(', ')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {isAr
                      ? 'مرّر على أي هدف أو مجال لعزل المسارات المرتبطة، أو اضغط لفتح بطاقة الهدف.'
                      : 'Hover any goal or domain node to trace connected ribbons, or click a goal to inspect.'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Mobile / Compact Accessible List */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {visibleGroups.slice(0, 4).map((grp) => (
              <button
                key={grp.goal.id}
                type="button"
                onClick={() => onInspectGoal(grp.goal)}
                className="dash-glass-inset p-3.5 text-start flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {grp.goal.title}
                  </span>
                  <span className="text-xs font-mono text-[var(--brand-strong)] shrink-0">
                    {grp.summary.outcomeProgressPercent}%
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-mono">
                  {[
                    ...grp.linkedHabitNames,
                    grp.linkedTaskCount > 0 ? `${grp.linkedTaskDoneCount}/${grp.linkedTaskCount} tasks` : null,
                    ...grp.linkedBookNames,
                    ...grp.linkedArtNames
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            ))}
          </div>

          {/* Habit Stacking Chains */}
          {connections.habitStacks.length > 0 && (
            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)]">
                {isAr ? 'سلاسل العادات:' : 'Habit Stacks:'}
              </span>
              {connections.habitStacks.slice(0, 5).map((stack) => (
                <span key={stack.id} className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                  <span>{stack.parentName}</span>
                  <NuqtaIcon
                    name={isAr ? 'chevronLeft' : 'chevronRight'}
                    className="w-3.5 h-3.5 text-[var(--brand-strong)]"
                  />
                  <span>{stack.childName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
