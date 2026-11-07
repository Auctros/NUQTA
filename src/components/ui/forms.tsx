import React from 'react';

/* ============================================================
   NUQTA — form controls
   Field · Input · Select · Textarea
   Unified height, radius, borders, focus ring and disabled state.
   ============================================================ */

const CONTROL_BASE =
  'w-full rounded-[var(--r-sm)] border bg-[var(--surface-raised)] text-[var(--text-primary)] ' +
  'text-[var(--fs-sm)] px-3 h-10 transition-colors duration-[var(--dur-fast)] ' +
  'placeholder:text-[var(--text-tertiary)] ' +
  'focus:outline-none focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--ring-color)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, htmlFor, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="text-[var(--fs-xs)] font-[var(--fw-semibold)] text-[var(--text-secondary)]"
      >
        {label}
        {required && <span className="text-[var(--state-danger)] ms-1">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <span className="text-[var(--fs-micro)] text-[var(--state-danger)]">{error}</span>
    ) : (
      hint && <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">{hint}</span>
    )}
  </div>
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input: React.FC<InputProps> = ({ invalid, className = '', ...rest }) => (
  <input
    className={[
      CONTROL_BASE,
      invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]',
      className
    ].join(' ')}
    {...rest}
  />
);

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select: React.FC<SelectProps> = ({ invalid, className = '', children, ...rest }) => (
  <select
    className={[
      CONTROL_BASE,
      'pe-8',
      invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]',
      className
    ].join(' ')}
    {...rest}
  >
    {children}
  </select>
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea: React.FC<TextareaProps> = ({ invalid, className = '', rows = 4, ...rest }) => (
  <textarea
    rows={rows}
    className={[
      CONTROL_BASE,
      'h-auto py-2 leading-[var(--lh-normal)] resize-y',
      invalid ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]',
      className
    ].join(' ')}
    {...rest}
  />
);
