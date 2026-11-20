import React from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';
import { LiquidTabs } from '../ui/LiquidTabs';

export type StudioId = 'quran' | 'workout' | 'reading' | 'drawing' | 'walking';
export type StudioNavVariant = 'structured' | 'segmented' | 'shelf' | 'workspace';

export interface StudioTab {
  id: string;
  label: string;
  icon?: IconName;
  count?: number;
}

export interface StudioFrameProps {
  studio: StudioId;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: StudioTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  navVariant?: StudioNavVariant;
  /** Trailing slot inside the rail (kept out of the scrolling track). */
  context?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared frame for the four specialized studios. It owns the header and the
 * navigation skeleton, but the *shape* of navigation is chosen per studio via
 * `navVariant` so the four never read as one template. All colour comes from
 * the `data-studio` accent scope defined in index.css.
 */
export const StudioFrame: React.FC<StudioFrameProps> = ({
  studio,
  eyebrow,
  title,
  description,
  actions,
  tabs,
  activeTab,
  onTabChange,
  navVariant = 'structured',
  context,
  children
}) => (
  <div className="studio-root" data-studio={studio}>
    <header className="studio-head">
      <div className="min-w-0">
        <span className="studio-eyebrow">
          <span className="line inline-block w-6 h-px bg-[var(--border-default)]" aria-hidden="true" />
          {eyebrow}
        </span>
        <h1 className="studio-title mt-1">{title}</h1>
        {description && <p className="studio-lede mt-1">{description}</p>}
      </div>
      {actions && <div className="studio-actions">{actions}</div>}
    </header>

    <nav
      className={`studio-rail studio-rail--${navVariant}`}
      aria-label={typeof title === 'string' ? title : eyebrow}
    >
      <LiquidTabs
        className="studio-rail-track"
        role="tablist"
        aria-label={eyebrow}
        remeasureKey={tabs.map((t) => `${t.id}:${t.label}`).join('|')}
        mode={navVariant === 'shelf' ? 'underline' : 'fill'}
        underlineThickness={navVariant === 'shelf' ? 2 : undefined}
        indicatorRadius={navVariant === 'segmented' ? 'pill' : undefined}
        squash={navVariant !== 'shelf'}
      >
        {tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabChange(t.id)}
              className="studio-tab"
            >
              {t.icon && (
                <span className="studio-tab-icon" aria-hidden="true">
                  <NuqtaIcon name={t.icon} className="w-full h-full" />
                </span>
              )}
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && <span className="studio-tab-count">{t.count}</span>}
            </button>
          );
        })}
      </LiquidTabs>
      {context && <div className="studio-rail-context">{context}</div>}
    </nav>

    <div className="studio-body">{children}</div>
  </div>
);

/* ---------- section ---------- */
export const StudioSection: React.FC<{
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, action, className = '', children }) => (
  <section className={`studio-section ${className}`}>
    {(title || action) && (
      <div className="studio-section-head">
        {title && <h2 className="studio-section-title">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
);

/* ---------- compact stat (accent-aware, not a generic dashboard card) ---------- */
export const StudioStat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  tone?: 'accent' | 'neutral' | 'success' | 'warning' | 'danger';
}> = ({ label, value, hint, icon, tone = 'neutral' }) => {
  const toneColor =
    tone === 'accent'
      ? 'var(--studio-accent, var(--brand-strong))'
      : tone === 'success'
      ? 'var(--state-success)'
      : tone === 'warning'
      ? 'var(--state-warning)'
      : tone === 'danger'
      ? 'var(--state-danger)'
      : 'var(--text-primary)';
  return (
    <div className="studio-tile min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] truncate">{label}</span>
        {icon && (
          <span style={{ color: 'var(--studio-accent, var(--brand-strong))' }} aria-hidden="true">
            <NuqtaIcon name={icon} className="w-4 h-4" />
          </span>
        )}
      </div>
      <strong
        className="block text-[var(--fs-xl)] font-[var(--fw-bold)] tabular-nums leading-tight mt-1"
        style={{ color: toneColor }}
      >
        {value}
      </strong>
      {hint && <span className="block text-[var(--fs-micro)] text-[var(--text-tertiary)] mt-0.5">{hint}</span>}
    </div>
  );
};

/* ---------- weekly bars: a real sparkline of activity ---------- */
export const StudioBars: React.FC<{
  data: { label: string; value: number }[];
  unit?: string;
  height?: number;
}> = ({ data, unit = '', height = 84 }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div
              className="w-full rounded-t-[var(--r-xs)] transition-[height] duration-[var(--dur-slow)]"
              style={{
                height: `${Math.max(3, pct)}%`,
                background: 'var(--studio-accent, var(--brand))',
                opacity: d.value === 0 ? 0.18 : 0.85
              }}
              title={`${d.value}${unit ? ' ' + unit : ''}`}
            />
            <span className="text-[10px] text-[var(--text-tertiary)] truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- status legend (never colour alone) ---------- */
export interface LegendEntry {
  label: string;
  swatch: string;
  glyph?: string;
  icon?: IconName;
}

export const StudioLegend: React.FC<{ entries: LegendEntry[] }> = ({ entries }) => (
  <ul className="studio-legend" aria-label="Status legend">
    {entries.map((e) => (
      <li key={e.label} className="studio-legend-item">
        <span className="studio-swatch" style={{ background: e.swatch }} aria-hidden="true" />
        <span className="inline-flex items-center gap-1">
          {e.icon ? <NuqtaIcon name={e.icon} className="w-3.5 h-3.5" /> : e.glyph ? `${e.glyph} ` : ''}
          {e.label}
        </span>
      </li>
    ))}
  </ul>
);

/* ---------- empty state ---------- */
export const StudioEmpty: React.FC<{
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon = 'sparkle', title, description, action }) => (
  <div className="text-center py-8 px-4 border border-dashed border-[var(--studio-line,var(--border-default))] rounded-[var(--r-md)]">
    <span
      className="inline-grid place-items-center w-12 h-12 rounded-[var(--r-md)] mb-3"
      style={{
        background: 'var(--studio-accent-soft, var(--surface-chip))',
        color: 'var(--studio-accent, var(--brand-strong))'
      }}
      aria-hidden="true"
    >
      <NuqtaIcon name={icon} className="w-6 h-6" />
    </span>
    <p className="text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)]">{title}</p>
    {description && <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);
