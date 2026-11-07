import React from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';

/* ============================================================
   NUQTA — UI primitives
   Built on the design tokens in index.css. No hardcoded colors,
   no new dependencies. Every component works in dark + light.
   ============================================================ */

/* ---------- Surface ---------- */
export type SurfaceVariant = 'panel' | 'card' | 'inset' | 'chip';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

const SURFACE_VARIANT: Record<SurfaceVariant, string> = {
  panel: 'bg-[var(--surface-raised)] border-[var(--border-default)]',
  card: 'bg-[var(--surface-raised)] border-[var(--border-default)]',
  inset: 'bg-[var(--surface-inset)] border-[var(--border-subtle)]',
  chip: 'bg-[var(--surface-chip)] border-[var(--border-subtle)]'
};

const SURFACE_PAD: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5'
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  elevation?: 0 | 1 | 2;
  radius?: 'sm' | 'md' | 'lg';
  as?: 'div' | 'section' | 'article' | 'aside';
}

export const Surface: React.FC<SurfaceProps> = ({
  variant = 'panel',
  padding = 'md',
  elevation = 0,
  radius = 'md',
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) => {
  const elev = elevation === 0 ? '' : elevation === 1 ? 'shadow-[var(--elev-1)]' : 'shadow-[var(--elev-2)]';
  return (
    <Tag
      className={[
        'border transition-colors duration-[var(--dur-base)]',
        SURFACE_VARIANT[variant],
        SURFACE_PAD[padding],
        `rounded-[var(--r-${radius})]`,
        elev,
        className
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
};

/* ---------- Badge ---------- */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'domain';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--surface-chip)] text-[var(--text-secondary)] border-[var(--border-default)]',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand-strong)] border-[var(--brand-soft-border)]',
  success: 'bg-[var(--surface-chip)] text-[var(--state-success)] border-[var(--border-subtle)]',
  warning: 'bg-[var(--surface-chip)] text-[var(--state-warning)] border-[var(--border-subtle)]',
  danger: 'bg-[var(--surface-chip)] text-[var(--state-danger)] border-[var(--border-subtle)]',
  info: 'bg-[var(--surface-chip)] text-[var(--state-info)] border-[var(--border-subtle)]',
  domain: 'bg-[var(--surface-chip)] text-[var(--brand-strong)] border-[var(--border-subtle)]'
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  children,
  ...rest
}) => (
  <span
    className={[
      'inline-flex items-center gap-1 rounded-[var(--r-full)] border font-medium whitespace-nowrap',
      size === 'sm' ? 'text-[var(--fs-micro)] px-2 py-0.5' : 'text-[var(--fs-xs)] px-2.5 py-1',
      BADGE_TONE[tone],
      className
    ].join(' ')}
    {...rest}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
    {children}
  </span>
);

/* ---------- Button ---------- */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--brand)] text-[var(--text-on-accent)] border-[var(--brand)] hover:brightness-105 active:brightness-95',
  secondary:
    'bg-[var(--surface-raised)] text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--surface-chip)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-chip)] hover:text-[var(--text-primary)]',
  danger: 'bg-[var(--state-danger)] text-[var(--text-on-state)] border-[var(--state-danger)] hover:brightness-105'
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[var(--fs-xs)]',
  md: 'h-10 px-4 text-[var(--fs-sm)]',
  lg: 'h-11 px-5 text-[var(--fs-base)]'
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    className={[
      'inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] border font-semibold',
      'transition-[background-color,border-color,color,filter] duration-[var(--dur-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]',
      'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100',
      BUTTON_VARIANT[variant],
      BUTTON_SIZE[size],
      block ? 'w-full' : '',
      className
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {icon && <NuqtaIcon name={icon} className="w-4 h-4" />}
    {children}
  </button>
);

/* ---------- IconButton ---------- */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={[
      'inline-grid place-items-center rounded-[var(--r-sm)] border',
      size === 'sm' ? 'w-8 h-8' : 'w-10 h-10',
      variant === 'ghost'
        ? 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-chip)] hover:text-[var(--text-primary)]'
        : 'bg-[var(--surface-raised)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-chip)]',
      'transition-colors duration-[var(--dur-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
      className
    ].join(' ')}
    {...rest}
  >
    <NuqtaIcon name={icon} className="w-4 h-4" />
  </button>
);

/* ---------- ProgressBar ---------- */
export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'info' | 'danger';
  height?: number;
  label?: string;
  showValue?: boolean;
}

const PROGRESS_TONE = {
  brand: 'bg-[var(--brand-strong)]',
  success: 'bg-[var(--state-success)]',
  warning: 'bg-[var(--state-warning)]',
  info: 'bg-[var(--state-info)]',
  danger: 'bg-[var(--state-danger)]'
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  tone = 'brand',
  height = 6,
  label,
  showValue = false
}) => {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-[var(--fs-micro)] text-[var(--text-secondary)] mb-1">
          <span>{label}</span>
          {showValue && <span className="tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--surface-track)]"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)] ${PROGRESS_TONE[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ---------- ProgressRing ---------- */
export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max = 100,
  size = 120,
  stroke = 8,
  children
}) => {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="var(--surface-track)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="var(--brand-strong)"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-standard)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
};

/* ---------- EmptyState ---------- */
export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'archive', title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-6">
    <div className="w-12 h-12 grid place-items-center rounded-[var(--r-md)] bg-[var(--surface-chip)] text-[var(--text-secondary)]">
      <NuqtaIcon name={icon} className="w-5 h-5" />
    </div>
    <strong className="text-[var(--fs-base)] font-semibold text-[var(--text-primary)]">{title}</strong>
    {description && (
      <p className="text-[var(--fs-sm)] text-[var(--text-secondary)] max-w-prose leading-[var(--lh-relaxed)]">
        {description}
      </p>
    )}
    {action}
  </div>
);
