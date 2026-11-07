import React, { useState } from 'react';
import { DayMetricPoint, MovementPatternDistribution, SphereEffortAllocation } from '../../lib/lifeIntelligenceEngine';

// ==========================================
// 1. Smooth SVG Trend Line Chart
// ==========================================
interface TrendLineChartProps {
  data: DayMetricPoint[];
  metricKey: 'totalActiveMinutes' | 'tasksDone' | 'readingPages' | 'workoutReps';
  color: string;
  unit: string;
  isAr: boolean;
  height?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  metricKey,
  color,
  unit,
  isAr,
  height = 140
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const width = 500;
  const paddingX = 30;
  const paddingY = 25;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const values = data.map((d) => d[metricKey]);
  const maxVal = Math.max(1, ...values);
  const minVal = 0;
  const range = maxVal - minVal;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1 || 1)) * innerWidth;
    const y = height - paddingY - ((d[metricKey] - minVal) / range) * innerHeight;
    return { x, y, data: d, val: d[metricKey] };
  });

  // Build SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    const cpY2 = curr.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }

  // Gradient area below line
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="relative w-full" dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${metricKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal reference grid lines */}
        <line
          x1={paddingX}
          y1={paddingY}
          x2={width - paddingX}
          y2={paddingY}
          stroke="#1c2822"
          strokeDasharray="3 3"
        />
        <line
          x1={paddingX}
          y1={height / 2}
          x2={width - paddingX}
          y2={height / 2}
          stroke="#1c2822"
          strokeDasharray="3 3"
        />
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          stroke="#24362d"
        />

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${metricKey})`} />

        {/* Line stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Circles */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3.5}
              fill="#0b0f13"
              stroke={color}
              strokeWidth={hoveredIndex === i ? 2.5 : 1.5}
              className="cursor-pointer transition-all duration-150"
            />
            {/* Invisible larger hit area for easy hovering */}
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" className="cursor-pointer" />
          </g>
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-[#141e19] border border-[#263e32] shadow-xl text-xs"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${Math.max(0, (hoveredPoint.y / height) * 100 - 32)}%`
          }}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <span className="font-mono text-white font-bold block">
            {hoveredPoint.val} {unit}
          </span>
          <span className="text-[10px] text-muted block">
            {hoveredPoint.data.dayLabel} · {hoveredPoint.data.dateStr}
          </span>
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between items-center px-4 mt-1 text-[11px] text-muted font-mono">
        <span>{data[0]?.dayLabel} ({data[0]?.dateStr.slice(5)})</span>
        <span>{data[Math.floor(data.length / 2)]?.dayLabel}</span>
        <span>{data[data.length - 1]?.dayLabel} ({data[data.length - 1]?.dateStr.slice(5)})</span>
      </div>
    </div>
  );
};

// ==========================================
// 2. Multi-Day Activity Bar Chart
// ==========================================
interface ActivityBarChartProps {
  data: DayMetricPoint[];
  metricKey: 'tasksDone' | 'totalActiveMinutes' | 'readingPages' | 'workoutReps';
  color: string;
  unit: string;
  isAr: boolean;
  maxOverride?: number;
}

export const ActivityBarChart: React.FC<ActivityBarChartProps> = ({
  data,
  metricKey,
  color,
  unit,
  isAr,
  maxOverride
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxVal = maxOverride || Math.max(1, ...data.map((d) => d[metricKey]));

  return (
    <div className="space-y-2">
      <div className="h-36 flex items-end justify-between gap-1 sm:gap-2 pt-4 px-2 bg-[#0c1214] rounded-xl border border-[#1c2921]">
        {data.map((item, idx) => {
          const val = item[metricKey];
          const heightPercent = Math.max(8, Math.round((val / maxVal) * 88));
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div
                  className="absolute -top-10 z-20 pointer-events-none px-2 py-1 rounded bg-[#16231c] border border-accent/40 shadow-lg text-[10px] text-white font-mono whitespace-nowrap"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  <strong className="text-accent">{val}</strong> {unit} · {item.dayLabel}
                </div>
              )}

              <span className="text-[10px] font-mono text-muted mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {val > 0 ? val : ''}
              </span>

              <div
                className="w-full max-w-[28px] rounded-t-md transition-all duration-300"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: isHovered ? '#ffffff' : color,
                  boxShadow: isHovered ? `0 0 12px ${color}` : 'none'
                }}
              />

              <span className="text-[10px] text-muted font-mono mt-1 block truncate w-full text-center">
                {item.dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. Calendar Activity Heatmap Matrix (GitHub style)
// ==========================================
interface CalendarHeatmapProps {
  weeks: DayMetricPoint[][];
  isAr: boolean;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ weeks, isAr }) => {
  const [hoveredCell, setHoveredCell] = useState<DayMetricPoint | null>(null);

  const intensityColors = [
    'bg-[#131b17] border-[#1d2b24]',       // 0: none
    'bg-[#064e3b]/50 border-[#065f46]/60',  // 1: low
    'bg-[#047857]/70 border-[#059669]',     // 2: medium
    'bg-[#10b981] border-[#34d399]',        // 3: high
    'bg-[#34d399] border-[#6ee7b7]'         // 4: peak
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-[500px]" dir="ltr">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5">
              {week.map((day, dIdx) => {
                const colorCls = intensityColors[day.intensityScore] || intensityColors[0];
                return (
                  <div
                    key={dIdx}
                    onMouseEnter={() => setHoveredCell(day)}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs border transition-all cursor-pointer hover:scale-125 hover:z-20 ${colorCls}`}
                    title={`${day.dateStr} (${day.dayLabel})`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend & Hovered Detail Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-2 border-t border-[#1c2921]">
        {/* Cell Inspection Detail */}
        <div className="text-[11px] text-muted min-h-[20px] flex items-center gap-2">
          {hoveredCell ? (
            <span className="text-white flex items-center gap-2">
              <span className="font-mono text-accent font-bold">{hoveredCell.dateStr}</span>
              <span>· {hoveredCell.tasksDone} {isAr ? 'مهام' : 'tasks'}</span>
              <span>· {hoveredCell.habitChecks} {isAr ? 'عادات' : 'habits'}</span>
              <span>· {hoveredCell.totalActiveMinutes}m {isAr ? 'نشاط مستثمر' : 'active mins'}</span>
            </span>
          ) : (
            <span className="text-muted italic">
              {isAr ? 'مرّر المؤشر على أي يوم لفحص أنشطة ذلك اليوم بدقة' : 'Hover over any day to inspect exact activities'}
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted self-end sm:self-center" dir="ltr">
          <span>{isAr ? 'أقل' : 'Less'}</span>
          {intensityColors.map((cls, i) => (
            <span key={i} className={`w-3 h-3 rounded-xs border ${cls}`} />
          ))}
          <span>{isAr ? 'أكثر' : 'More'}</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. Life Spheres Effort Allocation Segmented Bar
// ==========================================
interface SphereAllocationBarProps {
  allocations: SphereEffortAllocation[];
  totalHours: number;
  isAr: boolean;
}

export const SphereAllocationBar: React.FC<SphereAllocationBarProps> = ({ allocations, totalHours, isAr }) => {
  return (
    <div className="space-y-3">
      {/* Segmented Bar */}
      <div className="w-full h-3 rounded-full overflow-hidden flex bg-[#16231c] border border-[#23382c]">
        {allocations.map((item) => (
          <div
            key={item.sphere}
            className="h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
            style={{
              width: `${item.percent}%`,
              backgroundColor: item.color
            }}
            title={`${item.labelAr}: ${item.hours}h (${item.percent}%)`}
          />
        ))}
      </div>

      {/* Legend Chips with Hours & Percentages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        {allocations.map((item) => (
          <div
            key={item.sphere}
            className="p-2.5 rounded-xl border border-[#1c2921] bg-[#11191d] flex flex-col justify-between"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[11px] text-white/90 truncate font-semibold">
                {isAr ? item.labelAr : item.labelEn}
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-2 font-mono">
              <span className="text-sm font-bold text-white">
                {item.hours}h
              </span>
              <span className="text-[10px] text-muted">
                {item.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 5. Movement Pattern Balance Distribution
// ==========================================
interface MovementDistributionBarProps {
  distribution: MovementPatternDistribution[];
  isAr: boolean;
}

export const MovementDistributionBar: React.FC<MovementDistributionBarProps> = ({ distribution, isAr }) => {
  return (
    <div className="space-y-3">
      <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#16231c] border border-[#23382c]">
        {distribution.map((m) => (
          <div
            key={m.movement}
            className="h-full transition-all duration-300"
            style={{
              width: `${m.percent}%`,
              backgroundColor: m.color
            }}
            title={`${m.labelAr}: ${m.reps} reps (${m.percent}%)`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {distribution.map((m) => (
          <div
            key={m.movement}
            className="p-2 rounded-lg bg-[#141d18] border border-[#223329] flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-[11px] text-muted truncate">{isAr ? m.labelAr : m.labelEn}</span>
            </div>
            <span className="font-mono text-white text-[11px] font-bold shrink-0">
              {m.reps} <span className="text-[10px] text-muted font-normal">({m.percent}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
