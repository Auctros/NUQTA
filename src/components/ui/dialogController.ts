import { useSyncExternalStore } from 'react';
import type { IconName } from '../NuqtaIcon';

/* ============================================================
   NUQTA — unified interaction layer
   ------------------------------------------------------------
   One place that owns every in-app request for attention:

     dialogs.confirm(...)  → Promise<boolean>
     dialogs.alert(...)    → Promise<void>
     dialogs.prompt(...)   → Promise<string | null>
     feedback.success(...) → ephemeral toast

   These replace window.alert / confirm / prompt so the user never
   leaves the NUQTA shell to read a message.

   Toasts are deliberately NOT the Notification Center. A toast is
   transient feedback about something that just happened and is never
   stored; the Notification Center holds durable events that survive a
   reload. Nothing here is persisted.
   ============================================================ */

export type DialogTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface DialogBase {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: IconName;
  /** When false, Escape and a backdrop click will not dismiss the dialog. */
  dismissible?: boolean;
}

export type ConfirmOptions = DialogBase;
export type AlertOptions = DialogBase;

export interface PromptOptions extends DialogBase {
  inputLabel?: string;
  placeholder?: string;
  initialValue?: string;
  inputType?: 'text' | 'number';
  maxLength?: number;
  /** Return an error message to block submission, or null when the value is valid. */
  validate?: (value: string) => string | null;
}

interface ActiveBase {
  id: string;
  resolve: (value: never) => void;
}

export type ActiveDialog =
  | (ActiveBase & { kind: 'confirm'; options: ConfirmOptions })
  | (ActiveBase & { kind: 'alert'; options: AlertOptions })
  | (ActiveBase & { kind: 'prompt'; options: PromptOptions });

/* ---------- store ---------- */

let queue: ActiveDialog[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const enqueue = (dialog: ActiveDialog) => {
  queue = [...queue, dialog];
  emit();
};

const nextId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `dialog-${Date.now()}-${queue.length}`;

/**
 * Settle the dialog currently on screen and reveal the next one.
 * Safe to call twice: a dialog that is no longer queued is ignored.
 */
export function settleDialog(id: string, value: unknown): void {
  const active = queue[0];
  if (!active || active.id !== id) return;
  queue = queue.slice(1);
  (active.resolve as (v: unknown) => void)(value);
  emit();
}

export const subscribeDialogs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getActiveDialog = (): ActiveDialog | null => queue[0] ?? null;

export const dialogs = {
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      enqueue({
        id: nextId(),
        kind: 'confirm',
        options,
        resolve: resolve as (value: never) => void
      });
    });
  },

  alert(options: AlertOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      enqueue({
        id: nextId(),
        kind: 'alert',
        options,
        resolve: resolve as (value: never) => void
      });
    });
  },

  prompt(options: PromptOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      enqueue({
        id: nextId(),
        kind: 'prompt',
        options,
        resolve: resolve as (value: never) => void
      });
    });
  }
};

/* ---------- feedback (ephemeral toasts) ---------- */

export type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackOptions {
  tone?: FeedbackTone;
  /** Milliseconds on screen. 0 keeps the toast until it is dismissed. */
  duration?: number;
  /**
   * A single reversible action, e.g. "Undo" after completing a task.
   *
   * Undo lives on the toast rather than in a separate dialog because the moment to
   * reverse a completion is the moment the task disappears from the list: the reader
   * must be able to undo without hunting for the record in another view.
   */
  action?: { label: string; onClick: () => void };
}

export interface ToastItem {
  id: string;
  message: string;
  tone: FeedbackTone;
  duration: number;
  action?: { label: string; onClick: () => void };
}

/** Beyond this, the oldest toast is dropped so the stack never covers the UI. */
const MAX_TOASTS = 3;
const DEFAULT_DURATION = 3600;

let toasts: ToastItem[] = [];
const toastListeners = new Set<() => void>();

const emitToasts = () => {
  for (const listener of toastListeners) listener();
};

const pushToast = (message: string, tone: FeedbackTone, options: FeedbackOptions = {}): string => {
  const item: ToastItem = {
    id: nextId(),
    message,
    tone,
    duration: options.duration ?? DEFAULT_DURATION,
    ...(options.action ? { action: options.action } : {})
  };
  toasts = [...toasts, item].slice(-MAX_TOASTS);
  emitToasts();
  return item.id;
};

export const subscribeToasts = (listener: () => void): (() => void) => {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
};

export const getToasts = (): ToastItem[] => toasts;

export const feedback = {
  success: (message: string, options?: FeedbackOptions) => pushToast(message, 'success', options),
  error: (message: string, options?: FeedbackOptions) => pushToast(message, 'error', options),
  warning: (message: string, options?: FeedbackOptions) => pushToast(message, 'warning', options),
  info: (message: string, options?: FeedbackOptions) => pushToast(message, 'info', options),

  dismiss(id: string): void {
    const next = toasts.filter((toast) => toast.id !== id);
    if (next.length === toasts.length) return;
    toasts = next;
    emitToasts();
  },

  clear(): void {
    if (toasts.length === 0) return;
    toasts = [];
    emitToasts();
  }
};

/* ---------- React bindings ---------- */

export const useActiveDialog = (): ActiveDialog | null =>
  useSyncExternalStore(subscribeDialogs, getActiveDialog, getActiveDialog);

export const useToastList = (): ToastItem[] =>
  useSyncExternalStore(subscribeToasts, getToasts, getToasts);
