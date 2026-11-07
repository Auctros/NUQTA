import React from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';
import { Badge, BadgeTone, ProgressBar, Surface } from './primitives';

/* ============================================================
   NUQTA — layout components
   PageHeader · StatTile · TabBar · FilterBar · StudioShell
   ============================================================ */

/* ---------- PageHeader ---------- */
export interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, actions, meta }) => (
  <div className="page-heading flex flex-wrap items-start justify-between gap-4 mb-5">
    <div className="min-w-0">
      {eyebrow && (
        <div className="eyebrow flex items-center gap-2 text-[var(--brand-strong)] uppercase tracking-[0.14em] text-[var(--fs-micro)] font-bold">
          <span className="line inline-block w-6 h-px bg-[var(--border-default)]" aria-hidden="true" />
          <span>{eyebrow}</span>
        </div>
      )}
      <h1 className="mt-1 text-[var(--fs-2xl)] font-[var(--fw-heavy)] leading-[var(--lh-tight)] tracking-tight text-[var(--text-primary)]">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-[var(--fs-sm)] text-[var(--text-secondary)] leading-[var(--lh-relaxed)] max-w-3xl">
          {description}
        </p>
      )}
      {meta && <div className="mt-2">{meta}</div>}
    </div>
    {actions && <div className="heading-actions flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* ---------- StatTile ---------- */
export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: IconName;
  accent?: 'brand' | 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  progress?: { value: number; max?: number; tone?: 'brand' | 'success' | 'warning' | 'info' | 'danger' };
}

const STAT_ACCENT: Record<NonNullable<StatTileProps['accent']>, string> = {
  brand: 'text-[var(--brand-strong)]',
  success: 'text-[var(--state-success)]',
  warning: 'text-[var(--state-warning)]',
  info: 'text-[var(--state-info)]',
  danger: 'text-[var(--state-danger)]',
  neutral: 'text-[var(--text-secondary)]'
};

export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon, accent = 'neutral', progress }) => (
  <Surface variant="card" padding="sm" radius="md" className="flex flex-col gap-2 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] truncate">{label}</span>
      {icon && (
        <span className={`${STAT_ACCENT[accent]} opacity-90`} aria-hidden="true">
          <NuqtaIcon name={icon} className="w-4 h-4" />
        </span>
      )}
    </div>
    <strong className={`text-[var(--fs-xl)] font-[var(--fw-bold)] tabular-nums leading-none ${STAT_ACCENT[accent]}`}>
      {value}
    </strong>
    {progress && <ProgressBar value={progress.value} max={progress.max} tone={progress.tone} height={5} />}
    {hint && <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)] truncate">{hint}</span>}
  </Surface>
);

/* ---------- TabBar ---------- */
export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  count?: number;
}

export interface TabBarProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  ariaLabel?: string;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  items,
  value,
  onChange,
  variant = 'pill',
  ariaLabel = 'Sections',
  className = ''
}) => {
  if (variant === 'underline') {
    return (
      <div role="tablist" aria-label={ariaLabel} className={`flex items-center gap-1 border-b border-[var(--border-subtle)] overflow-x-auto ${className}`}>
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.id)}
              className={[
                'inline-flex items-center gap-2 px-3 py-2 -mb-px border-b-2 text-[var(--fs-sm)] whitespace-nowrap',
                'transition-colors duration-[var(--dur-fast)]',
                active
                  ? 'border-[var(--brand-strong)] text-[var(--text-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              ].join(' ')}
            >
              {it.icon && <NuqtaIcon name={it.icon} className="w-4 h-4" />}
              <span>{it.label}</span>
              {typeof it.count === 'number' && <Badge tone={active ? 'brand' : 'neutral'}>{it.count}</Badge>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 p-1 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--border-subtle)] overflow-x-auto ${className}`}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={[
              'inline-flex items-center gap-2 px-3 h-9 rounded-[var(--r-xs)] text-[var(--fs-sm)] whitespace-nowrap',
              'transition-colors duration-[var(--dur-fast)]',
              active
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] font-semibold shadow-[var(--elev-1)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
            ].join(' ')}
          >
            {it.icon && <NuqtaIcon name={it.icon} className="w-4 h-4" />}
            <span>{it.label}</span>
            {typeof it.count === 'number' && <Badge tone={active ? 'brand' : 'neutral'}>{it.count}</Badge>}
          </button>
        );
      })}
    </div>
  );
};

/* ---------- FilterBar ---------- */
export interface FilterChip {
  id: string;
  label: string;
  count?: number;
  tone?: BadgeTone;
}

export interface FilterBarProps {
  chips: FilterChip[];
  value: string;
  onChange: (id: string) => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  ariaLabel?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  chips,
  value,
  onChange,
  leading,
  trailing,
  ariaLabel = 'Filters'
}) => (
  <Surface
    variant="panel"
    padding="sm"
    className="flex flex-wrap items-center gap-2 justify-between"
    role="group"
    aria-label={ariaLabel}
  >
    <div className="flex items-center gap-2 flex-wrap">
      {leading}
      {chips.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            aria-pressed={active}
            onClick={() => onChange(c.id)}
            className={[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-full)] border text-[var(--fs-xs)]',
              'transition-colors duration-[var(--dur-fast)]',
              active
                ? 'bg-[var(--brand-soft)] border-[var(--brand-soft-border)] text-[var(--brand-strong)] font-semibold'
                : 'bg-[var(--surface-raised)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
            ].join(' ')}
          >
            <span>{c.label}</span>
            {typeof c.count === 'number' && <span className="tabular-nums opacity-70">{c.count}</span>}
          </button>
        );
      })}
    </div>
    {trailing && <div className="flex items-center gap-2">{trailing}</div>}
  </Surface>
);

/* ---------- StudioShell ---------- */
export interface StudioShellProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  tabVariant?: 'pill' | 'underline';
  children: React.ReactNode;
}

export const StudioShell: React.FC<StudioShellProps> = ({
  eyebrow,
  title,
  description,
  actions,
  meta,
  tabs,
  activeTab,
  onTabChange,
  tabVariant = 'pill',
  children
}) => (
  <div className="space-y-[var(--sp-5)]">
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
    {meta}
    {tabs && activeTab !== undefined && onTabChange && (
      <TabBar items={tabs} value={activeTab} onChange={onTabChange} variant={tabVariant} />
    )}
    <div className="space-y-[var(--sp-4)]">{children}</div>
  </div>
);
