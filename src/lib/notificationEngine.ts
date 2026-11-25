/**
 * NUQTA Notification Engine — the single place that decides whether a notification
 * exists, whether it replaces an earlier one, and when it stops being relevant.
 *
 * This module is deliberately PURE: it takes a list and returns a list, with no React,
 * no storage and no browser APIs. The store owns the array and persists it; the UI
 * renders it. Keeping the rules here is what stops notification logic from being
 * duplicated across every feature that wants to raise one.
 *
 * The three rules that matter:
 *   1. Identity is `dedupeKey`, not `id`. Re-raising the same event updates nothing and
 *      returns the same list, so a 20-second reminder ticker cannot spam the inbox and a
 *      restart cannot re-notify something the user already saw.
 *   2. Staleness is expressed as `expiresAt`, so an overdue nudge disappears on its own
 *      instead of accumulating into an unusable list.
 *   3. The inbox is bounded, so a long-lived install cannot grow without limit.
 */

import type {
  AppNotification,
  NotificationCategory,
  NotificationPreferences,
  NotificationPriority,
  NotificationRoute
} from '../types';
import { minutesOfDay } from './reminderTiming';

/** Hard ceiling on stored notifications (including dismissed tombstones). */
export const MAX_NOTIFICATIONS = 200;
/** Dismissed rows are kept briefly so dedupe still holds, then dropped. */
export const DISMISSED_RETENTION_DAYS = 30;

/** Everything a caller supplies when raising a notification. */
export interface NotificationDraft {
  category: NotificationCategory;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  route?: NotificationRoute;
  actionLabel?: string;
  /** Stable identity for the event. Required: it is the dedupe contract. */
  dedupeKey: string;
  /** Lifetime in minutes from creation. Omit for no automatic expiry. */
  ttlMinutes?: number;
  /** Message id + params so copy can be re-rendered in the active language. */
  messageId?: string;
  params?: Record<string, string | number | boolean>;
  meta?: Record<string, string | number | boolean>;
  createdAt?: string;
}

export type AddOutcome =
  | { added: true; list: AppNotification[]; notification: AppNotification }
  | { added: false; list: AppNotification[]; reason: 'duplicate' | 'category-disabled' };

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
};

const DEFAULT_TTL_MINUTES: Partial<Record<NotificationCategory, number>> = {
  // A due-time nudge stops being useful once the day is over.
  reminder: 60 * 12,
  task: 60 * 12,
  habit: 60 * 6,
  focus: 60 * 6
};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** True when a notification has passed its expiry at `now`. */
export function isExpired(notification: AppNotification, now: Date = new Date()): boolean {
  if (!notification.expiresAt) return false;
  const at = Date.parse(notification.expiresAt);
  return Number.isFinite(at) && at <= now.getTime();
}

/** A notification the user can still see: not dismissed, not expired. */
export function isVisible(notification: AppNotification, now: Date = new Date()): boolean {
  return !notification.dismissedAt && !isExpired(notification, now);
}

export function isUnread(notification: AppNotification): boolean {
  return !notification.readAt;
}

/**
 * Drop expired rows and dismissed tombstones past their retention window, then enforce
 * the size cap by discarding the oldest read entries first.
 *
 * Unread notifications are evicted only as a last resort: the user has not seen them yet,
 * so they outrank anything already read when space is needed.
 */
export function pruneNotifications(
  list: AppNotification[],
  now: Date = new Date()
): AppNotification[] {
  const cutoff = now.getTime() - DISMISSED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const kept = list.filter((n) => {
    if (isExpired(n, now)) return false;
    if (n.dismissedAt) {
      const dismissedAt = Date.parse(n.dismissedAt);
      return !Number.isFinite(dismissedAt) || dismissedAt > cutoff;
    }
    return true;
  });

  if (kept.length <= MAX_NOTIFICATIONS) return kept;

  const ranked = [...kept].sort((a, b) => {
    // Read before unread, then oldest first, so what survives is what matters most.
    const aRead = a.readAt ? 1 : 0;
    const bRead = b.readAt ? 1 : 0;
    if (aRead !== bRead) return bRead - aRead;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
  const dropped = new Set(ranked.slice(0, kept.length - MAX_NOTIFICATIONS).map((n) => n.id));
  return kept.filter((n) => !dropped.has(n.id));
}

/** Newest first, then by priority — the order the inbox renders in. */
export function sortNotifications(list: AppNotification[]): AppNotification[] {
  return [...list].sort((a, b) => {
    const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (byTime !== 0) return byTime;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

/** Category switches default to ON: an absent key is not a "no". */
export function isCategoryEnabled(
  prefs: NotificationPreferences,
  category: NotificationCategory
): boolean {
  return prefs.categories?.[category] !== false;
}

function resolveExpiry(draft: NotificationDraft, now: Date): string | undefined {
  if (isFiniteNumber(draft.ttlMinutes)) {
    if (draft.ttlMinutes <= 0) return now.toISOString();
    return new Date(now.getTime() + draft.ttlMinutes * 60 * 1000).toISOString();
  }
  const fallback = DEFAULT_TTL_MINUTES[draft.category];
  if (fallback === undefined) return undefined;
  return new Date(now.getTime() + fallback * 60 * 1000).toISOString();
}

/**
 * Add a notification to the list.
 *
 * Returns the SAME list reference when nothing changed, so React does not re-render and
 * storage is not rewritten for a duplicate — the common case for a reminder ticker.
 */
export function addNotification(
  list: AppNotification[],
  draft: NotificationDraft,
  options: { now?: Date; prefs?: NotificationPreferences } = {}
): AddOutcome {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  if (options.prefs && !isCategoryEnabled(options.prefs, draft.category)) {
    return { added: false, list, reason: 'category-disabled' };
  }

  const pruned = pruneNotifications(list, now);

  // Dedupe against any row that is still within its lifetime, dismissed or not: a
  // dismissal means "I have dealt with this event", so the reminder must stay gone for
  // the rest of its validity — including across a reload, which resets the caller's
  // in-memory guard. Expired rows never reach here (prune drops them), and a new
  // occurrence carries a different dedupeKey, so later reminders still fire.
  const existing = pruned.find((n) => n.dedupeKey === draft.dedupeKey);
  if (existing) {
    return { added: false, list: pruned === list ? list : pruned, reason: 'duplicate' };
  }

  const expiresAt = resolveExpiry(draft, now);

  // `meta` carries both the caller's context and the copy-rendering inputs. The copy keys
  // are namespaced under `messageId`/`params` so they cannot collide with domain data.
  const meta: Record<string, string | number | boolean> = { ...(draft.meta || {}) };
  if (draft.messageId) {
    meta.messageId = draft.messageId;
    Object.assign(meta, draft.params || {});
  }

  const notification: AppNotification = {
    id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
    category: draft.category,
    priority: draft.priority ?? 'normal',
    title: draft.title,
    ...(draft.body ? { body: draft.body } : {}),
    ...(draft.route ? { route: draft.route } : {}),
    ...(draft.actionLabel ? { actionLabel: draft.actionLabel } : {}),
    createdAt: draft.createdAt ?? nowIso,
    dedupeKey: draft.dedupeKey,
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
    ...(expiresAt ? { expiresAt } : {})
  };

  return {
    added: true,
    notification,
    list: pruneNotifications([notification, ...pruned], now)
  };
}

export function markRead(list: AppNotification[], id: string, now: Date = new Date()): AppNotification[] {
  let changed = false;
  const next = list.map((n) => {
    if (n.id !== id || n.readAt) return n;
    changed = true;
    return { ...n, readAt: now.toISOString() };
  });
  return changed ? next : list;
}

export function markUnread(list: AppNotification[], id: string): AppNotification[] {
  let changed = false;
  const next = list.map((n) => {
    if (n.id !== id || !n.readAt) return n;
    changed = true;
    const cleared = { ...n };
    delete cleared.readAt;
    return cleared;
  });
  return changed ? next : list;
}

export function markAllRead(list: AppNotification[], now: Date = new Date()): AppNotification[] {
  if (!list.some(isUnread)) return list;
  const iso = now.toISOString();
  return list.map((n) => (n.readAt ? n : { ...n, readAt: iso }));
}

/** Dismiss hides a row but keeps it as a tombstone so its dedupeKey still holds. */
export function dismissNotification(
  list: AppNotification[],
  id: string,
  now: Date = new Date()
): AppNotification[] {
  let changed = false;
  const next = list.map((n) => {
    if (n.id !== id || n.dismissedAt) return n;
    changed = true;
    return { ...n, dismissedAt: now.toISOString(), readAt: n.readAt ?? now.toISOString() };
  });
  return changed ? next : list;
}

export function unreadCount(list: AppNotification[], now: Date = new Date()): number {
  return list.filter((n) => isVisible(n, now) && isUnread(n)).length;
}

/**
 * Whether browser/OS delivery is allowed right now.
 *
 * This is the ONLY gate for the optional channel. It returns false unless the user has
 * explicitly enabled the channel AND the category is on AND we are outside quiet hours,
 * so the app never claims to deliver something it will not.
 */
export function shouldDeliverToBrowser(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  now: Date = new Date()
): boolean {
  if (!prefs.browser) return false;
  if (!isCategoryEnabled(prefs, category)) return false;
  return !isQuietHours(prefs, now);
}

/**
 * Quiet hours, inclusive of the start and exclusive of the end. A window that wraps
 * midnight (22:00 → 07:00) is the normal case and is handled explicitly.
 */
export function isQuietHours(prefs: NotificationPreferences, now: Date = new Date()): boolean {
  const quiet = prefs.quietHours;
  if (!quiet || !quiet.enabled) return false;
  const start = minutesOfDay(quiet.start);
  const end = minutesOfDay(quiet.end);
  if (start === null || end === null || start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end ? current >= start && current < end : current >= start || current < end;
}
