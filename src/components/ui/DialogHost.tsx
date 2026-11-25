import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { NuqtaIcon } from '../NuqtaIcon';
import type { IconName } from '../NuqtaIcon';
import { Button, IconButton } from './primitives';
import { useModalFocus } from '../../lib/useModalFocus';
import { useNuqtaStore } from '../../store/nuqtaStore';
import {
  settleDialog,
  feedback,
  useActiveDialog,
  useToastList,
  type ActiveDialog,
  type DialogTone,
  type FeedbackTone,
  type ToastItem
} from './dialogController';

/* ============================================================
   NUQTA — Interaction layer surface
   Renders the active dialog and the feedback stack. Mounted once
   in App, inside the shell so it inherits direction, language and
   theme. Nothing here is persisted: dialogs resolve a promise and
   toasts disappear on their own.
   ============================================================ */

const TONE_ICON: Record<DialogTone, IconName> = {
  neutral: 'sparkle',
  success: 'check',
  warning: 'alert',
  danger: 'alert'
};

const TONE_ACCENT: Record<DialogTone, string> = {
  neutral: 'var(--brand)',
  success: 'var(--state-success)',
  warning: 'var(--state-warning)',
  danger: 'var(--state-danger)'
};

const TONE_WASH: Record<DialogTone, string> = {
  neutral: 'var(--brand-soft)',
  success: 'color-mix(in srgb, var(--state-success) 14%, transparent)',
  warning: 'color-mix(in srgb, var(--state-warning) 14%, transparent)',
  danger: 'color-mix(in srgb, var(--state-danger) 14%, transparent)'
};

/* ---------- one dialog ---------- */

const DialogPanel: React.FC<{ dialog: ActiveDialog }> = ({ dialog }) => {
  const { options } = dialog;
  const isAr = useNuqtaStore((state) => state.profile.language === 'ar');
  const tone: DialogTone = options.tone ?? 'neutral';
  const dismissible = options.dismissible !== false;
  const isPrompt = dialog.kind === 'prompt';

  const [value, setValue] = useState(isPrompt ? (dialog.options as { initialValue?: string }).initialValue ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useModalFocus<HTMLDivElement>(true, isPrompt ? 'input' : '[data-autofocus]');
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const cancel = useCallback(() => {
    if (dialog.kind === 'prompt') settleDialog(dialog.id, null);
    else if (dialog.kind === 'confirm') settleDialog(dialog.id, false);
    else settleDialog(dialog.id, undefined);
  }, [dialog]);

  const accept = useCallback(() => {
    if (dialog.kind === 'prompt') {
      const promptOptions = dialog.options as { validate?: (v: string) => string | null };
      const message = promptOptions.validate?.(value) ?? null;
      if (message) {
        setError(message);
        inputRef.current?.focus();
        return;
      }
      settleDialog(dialog.id, value);
      return;
    }
    if (dialog.kind === 'confirm') settleDialog(dialog.id, true);
    else settleDialog(dialog.id, undefined);
  }, [dialog, value]);

  // Escape dismisses only when the caller allows it; confirm/prompt then resolve
  // as "cancelled", exactly like the native dialogs they replace.
  useEffect(() => {
    if (!dismissible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      cancel();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [dismissible, cancel]);

  // Native dialogs freeze the page behind them; a dialog the user can scroll past
  // feels detached from the decision it is asking for.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const confirmLabel =
    options.confirmLabel ?? (isAr ? 'تأكيد' : 'Confirm');

  return (
    <div
      className="fixed inset-0 grid place-items-center p-4"
      style={{ zIndex: 'var(--z-dialog)', background: 'rgba(3, 7, 10, 0.62)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) cancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.description ? descriptionId : undefined}
        tabIndex={-1}
        data-nuqta-dialog={dialog.kind}
        className={[
          'w-full max-w-md overflow-hidden outline-none',
          'rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)]',
          'shadow-[var(--elev-3)] nuqta-dialog-in'
        ].join(' ')}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-sm)]"
            style={{ background: TONE_WASH[tone], color: TONE_ACCENT[tone] }}
            aria-hidden="true"
          >
            <NuqtaIcon name={options.icon ?? TONE_ICON[tone]} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[var(--fs-base)] font-[var(--fw-bold)] text-[var(--text-primary)]">
              {options.title}
            </h2>
            {options.description && (
              <p
                id={descriptionId}
                className="mt-1.5 text-[var(--fs-xs)] leading-[var(--lh-relaxed)] text-[var(--text-secondary)]"
              >
                {options.description}
              </p>
            )}
          </div>
          {dismissible && (
            <IconButton
              icon="close"
              label={isAr ? 'إغلاق' : 'Close'}
              size="sm"
              onClick={cancel}
            />
          )}
        </div>

        {isPrompt && (
          <div className="px-5 pt-4">
            <label
              htmlFor={`${titleId}-input`}
              className="mb-1.5 block text-[var(--fs-micro)] font-[var(--fw-semibold)] text-[var(--text-secondary)]"
            >
              {(dialog.options as { inputLabel?: string }).inputLabel ??
                (isAr ? 'القيمة' : 'Value')}
            </label>
            <input
              id={`${titleId}-input`}
              ref={inputRef}
              value={value}
              type={(dialog.options as { inputType?: string }).inputType ?? 'text'}
              placeholder={(dialog.options as { placeholder?: string }).placeholder}
              maxLength={(dialog.options as { maxLength?: number }).maxLength}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                accept();
              }}
              className={[
                'w-full rounded-[var(--r-sm)] border bg-[var(--surface-inset)] px-3 py-2',
                'text-[var(--fs-sm)] text-[var(--text-primary)] outline-none',
                'focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]',
                error ? 'border-[var(--state-danger)]' : 'border-[var(--border-default)]'
              ].join(' ')}
            />
            {error && (
              <p id={errorId} role="alert" className="mt-1.5 text-[var(--fs-micro)] text-[var(--state-danger)]">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4">
          {dialog.kind !== 'alert' && (
            <Button
              variant="ghost"
              data-autofocus={tone === 'danger' ? '' : undefined}
              onClick={cancel}
            >
              {options.cancelLabel ?? (isAr ? 'إلغاء' : 'Cancel')}
            </Button>
          )}
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            data-autofocus={tone !== 'danger' ? '' : undefined}
            onClick={accept}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ---------- toasts ---------- */

const FEEDBACK_ICON: Record<FeedbackTone, IconName> = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'sparkle'
};

const FEEDBACK_ACCENT: Record<FeedbackTone, string> = {
  success: 'var(--state-success)',
  error: 'var(--state-danger)',
  warning: 'var(--state-warning)',
  info: 'var(--brand)'
};

const ToastRow: React.FC<{ toast: ToastItem }> = ({ toast }) => {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    const timer = window.setTimeout(() => feedback.dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, paused]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={[
        'flex items-center gap-2.5 rounded-[var(--r-sm)] border px-3.5 py-2.5',
        'bg-[var(--surface-raised)] shadow-[var(--elev-2)] nuqta-toast-in',
        'text-[var(--fs-sm)] text-[var(--text-primary)]'
      ].join(' ')}
      style={{ borderColor: FEEDBACK_ACCENT[toast.tone] }}
    >
      <span style={{ color: FEEDBACK_ACCENT[toast.tone] }} aria-hidden="true" className="shrink-0">
        <NuqtaIcon name={FEEDBACK_ICON[toast.tone]} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">{toast.message}</span>
      <IconButton icon="close" label="Dismiss" size="sm" onClick={() => feedback.dismiss(toast.id)} />
    </div>
  );
};

const ToastStack: React.FC = () => {
  const toasts = useToastList();
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 sm:items-end"
      style={{ zIndex: 'var(--z-feedback)' }}
    >
      <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
};

/* ---------- host ---------- */

export const DialogHost: React.FC = () => {
  const dialog = useActiveDialog();

  return (
    <>
      {dialog && <DialogPanel key={dialog.id} dialog={dialog} />}
      <ToastStack />
    </>
  );
};
