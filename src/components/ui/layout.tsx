import React from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';
import { Badge, BadgeTone, Surface } from './primitives';
import { LiquidTabs } from './LiquidTabs';

/* ============================================================
   NUQTA — layout components
   PageHeader · TabBar · FilterBar
   (Specialized studios use src/components/studios/StudioKit.)
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
      <LiquidTabs
        mode="underline"
        remeasureKey={items.map((it) => `${it.id}:${it.label}`).join('|')}
        role="tablist"
        aria-label={ariaLabel}
        className={`tabbar-underline flex items-center gap-1 border-b border-[var(--border-subtle)] overflow-x-auto ${className}`}
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
                'inline-flex items-center gap-2 px-3 py-2 -mb-px border-b-2 text-[var(--fs-sm)] whitespace-nowrap',
                'transition-colors duration-[var(--dur-fast)]',
                active
                  ? 'border-transparent text-[var(--text-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              ].join(' ')}
            >
              {it.icon && <NuqtaIcon name={it.icon} className="w-4 h-4" />}
              <span>{it.label}</span>
              {typeof it.count === 'number' && <Badge tone={active ? 'brand' : 'neutral'}>{it.count}</Badge>}
            </button>
          );
        })}
      </LiquidTabs>
    );
  }

  return (
    <LiquidTabs
      remeasureKey={items.map((it) => `${it.id}:${it.label}`).join('|')}
      role="tablist"
      aria-label={ariaLabel}
      className={`tabbar-pill flex items-center gap-1 p-1 rounded-[var(--r-sm)] bg-[var(--surface-sunken)] border border-[var(--border-subtle)] overflow-x-auto ${className}`}
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
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
            ].join(' ')}
          >
            {it.icon && <NuqtaIcon name={it.icon} className="w-4 h-4" />}
            <span>{it.label}</span>
            {typeof it.count === 'number' && <Badge tone={active ? 'brand' : 'neutral'}>{it.count}</Badge>}
          </button>
        );
      })}
    </LiquidTabs>
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
      <LiquidTabs
        className="filterbar-chips flex items-center gap-2 flex-wrap"
        remeasureKey={chips.map((c) => `${c.id}:${c.label}`).join('|')}
        role="group"
        aria-label={ariaLabel}
        squash={false}
      >
        {chips.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              aria-pressed={active}
              onClick={() => onChange(c.id)}
              className={[
                'filterbar-chip inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-full)] border text-[var(--fs-xs)]',
                'transition-colors duration-[var(--dur-fast)]',
                active
                  ? 'border-transparent text-[var(--brand-strong)] font-semibold'
                  : 'bg-[var(--surface-raised)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-chip)]'
              ].join(' ')}
            >
              <span>{c.label}</span>
              {typeof c.count === 'number' && <span className="tabular-nums opacity-70">{c.count}</span>}
            </button>
          );
        })}
      </LiquidTabs>
    </div>
    {trailing && <div className="flex items-center gap-2">{trailing}</div>}
  </Surface>
);
