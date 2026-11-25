import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, EmptyState, IconButton } from './ui';
import { NuqtaIcon, type IconName } from './NuqtaIcon';
import { useNuqtaStore } from '../store/nuqtaStore';
import type { AppNotification, NotificationCategory, NotificationPriority } from '../types';
import { isUnread, isVisible, sortNotifications, unreadCount } from '../lib/notificationEngine';
import { renderNotificationText } from '../lib/notificationMessages';
import { addDaysToKey, localDateKey } from '../lib/dateKey';
import { openNotificationRoute } from '../lib/notifications';

/* ============================================================
   NUQTA — Notification Center
   The inbox for everything the app has to tell the user.
   Rows come from the store (single source of truth); this file
   only decides how they read and where they lead.
   ============================================================ */

const CATEGORY_ICON: Record<NotificationCategory, IconName> = {
  task: 'check-square',
  habit: 'repeat',
  goal: 'target',
  focus: 'timer',
  health: 'activity',
  finance: 'wallet',
  system: 'bell',
  reminder: 'bell'
};

const CATEGORY_LABEL: Record<NotificationCategory, { ar: string; en: string }> = {
  task: { ar: 'المهام', en: 'Tasks' },
  habit: { ar: 'العادات', en: 'Habits' },
  goal: { ar: 'الأهداف', en: 'Goals' },
  focus: { ar: 'التركيز', en: 'Focus' },
  health: { ar: 'الصحة', en: 'Health' },
  finance: { ar: 'المال', en: 'Money' },
  system: { ar: 'النظام', en: 'System' },
  reminder: { ar: 'تذكير', en: 'Reminder' }
};

const PRIORITY_TONE: Record<NotificationPriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'warning',
  critical: 'danger'
};

export type NotificationFilter = 'all' | 'unread' | NotificationCategory;

const FILTERS: NotificationFilter[] = ['all', 'unread', 'task', 'habit', 'goal', 'focus'];

/** Relative age that stays readable without pulling in a date library. */
function relativeTime(iso: string, isAr: boolean): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return isAr ? 'الآن' : 'Just now';
  if (minutes < 60) return isAr ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return isAr ? `قبل ${hours} س` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return isAr ? `قبل ${days} ي` : `${days}d ago`;
  return new Date(then).toLocaleDateString(isAr ? 'ar' : 'en', { day: 'numeric', month: 'short' });
}

/** Day bucket for the section headings: today / yesterday / earlier. */
function dayBucket(iso: string): 'today' | 'yesterday' | 'earlier' {
  const day = localDateKey(new Date(iso));
  const today = localDateKey();
  if (day === today) return 'today';
  if (day === addDaysToKey(today, -1)) return 'yesterday';
  return 'earlier';
}

interface RowProps {
  notification: AppNotification;
  isAr: boolean;
  onOpen: (n: AppNotification) => void;
  onToggleRead: (n: AppNotification) => void;
  onDismiss: (n: AppNotification) => void;
}

const NotificationRow: React.FC<RowProps> = ({ notification, isAr, onOpen, onToggleRead, onDismiss }) => {
  const text = renderNotificationText(
    typeof notification.meta?.messageId === 'string' ? notification.meta.messageId : undefined,
    notification.meta,
    { title: notification.title, body: notification.body },
    isAr
  );
  const unread = isUnread(notification);
  const actionable = !!notification.route;

  return (
    <li
      className={[
        'group relative flex gap-3 rounded-[var(--r-sm)] border p-3 transition-colors',
        unread
          ? 'border-[var(--brand-soft-border)] bg-[var(--brand-soft)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--surface-chip)]'
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-sm)]',
          unread ? 'bg-[var(--brand)] text-[var(--text-on-accent)]' : 'bg-[var(--surface-chip)] text-[var(--text-secondary)]'
        ].join(' ')}
        aria-hidden="true"
      >
        <NuqtaIcon name={CATEGORY_ICON[notification.category]} className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onOpen(notification)}
            className="min-w-0 flex-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-color)]"
          >
            <span
              className={[
                'block text-[var(--fs-sm)] leading-snug',
                unread ? 'font-[var(--fw-bold)] text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'
              ].join(' ')}
            >
              {text.title}
            </span>
            {text.body && (
              <span className="mt-1 block text-[var(--fs-xs)] leading-[var(--lh-snug)] text-[var(--text-secondary)]">
                {text.body}
              </span>
            )}
          </button>

          {unread && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-strong)]"
              aria-label={isAr ? 'غير مقروء' : 'Unread'}
            />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{CATEGORY_LABEL[notification.category][isAr ? 'ar' : 'en']}</Badge>
          {notification.priority === 'high' || notification.priority === 'critical' ? (
            <Badge tone={PRIORITY_TONE[notification.priority]} dot>
              {notification.priority === 'critical'
                ? isAr ? 'حرج' : 'Critical'
                : isAr ? 'مهم' : 'Important'}
            </Badge>
          ) : null}
          <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">
            {relativeTime(notification.createdAt, isAr)}
          </span>
        </div>

        {actionable && (
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onOpen(notification)}>
              {notification.actionLabel || (isAr ? 'فتح' : 'Open')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <IconButton
          icon={unread ? 'check' : 'eye'}
          size="sm"
          label={unread ? (isAr ? 'تحديد كمقروء' : 'Mark as read') : isAr ? 'تحديد كغير مقروء' : 'Mark as unread'}
          onClick={() => onToggleRead(notification)}
        />
        <IconButton
          icon="close"
          size="sm"
          label={isAr ? 'إزالة' : 'Dismiss'}
          onClick={() => onDismiss(notification)}
        />
      </div>
    </li>
  );
};

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  isAr: boolean;
  /** Rendered inside the topbar popover vs. a standalone page. */
  variant?: 'popover' | 'panel';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  onClose,
  isAr,
  variant = 'popover'
}) => {
  const notifications = useNuqtaStore((s) => s.notifications);
  const markNotificationRead = useNuqtaStore((s) => s.markNotificationRead);
  const markNotificationUnread = useNuqtaStore((s) => s.markNotificationUnread);
  const markAllNotificationsRead = useNuqtaStore((s) => s.markAllNotificationsRead);
  const dismissNotification = useNuqtaStore((s) => s.dismissNotification);
  const clearReadNotifications = useNuqtaStore((s) => s.clearReadNotifications);

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside-click dismissal, matching NuqtaSelect: mousedown fires before click so a
  // click on a row inside the panel is never swallowed by the closing handler.
  useEffect(() => {
    if (!open || variant !== 'popover') return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, variant]);

  const visible = useMemo(() => sortNotifications(notifications.filter((n) => isVisible(n))), [notifications]);
  const unread = useMemo(() => unreadCount(notifications), [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') return visible;
    if (filter === 'unread') return visible.filter(isUnread);
    return visible.filter((n) => n.category === filter);
  }, [visible, filter]);

  const grouped = useMemo(() => {
    const buckets: Record<'today' | 'yesterday' | 'earlier', AppNotification[]> = {
      today: [],
      yesterday: [],
      earlier: []
    };
    filtered.forEach((n) => buckets[dayBucket(n.createdAt)].push(n));
    return buckets;
  }, [filtered]);

  const handleOpen = useCallback(
    (n: AppNotification) => {
      if (isUnread(n)) markNotificationRead(n.id);
      if (n.route) {
        openNotificationRoute(n.route);
        onClose();
      }
    },
    [isUnread, markNotificationRead, onClose]
  );

  const handleToggleRead = useCallback(
    (n: AppNotification) => {
      if (isUnread(n)) markNotificationRead(n.id);
      else markNotificationUnread(n.id);
    },
    [isUnread, markNotificationRead, markNotificationUnread]
  );

  const filterLabel = (f: NotificationFilter): string => {
    if (f === 'all') return isAr ? 'الكل' : 'All';
    if (f === 'unread') return isAr ? 'غير المقروء' : 'Unread';
    return CATEGORY_LABEL[f][isAr ? 'ar' : 'en'];
  };

  const sections: Array<{ key: 'today' | 'yesterday' | 'earlier'; label: string }> = [
    { key: 'today', label: isAr ? 'اليوم' : 'Today' },
    { key: 'yesterday', label: isAr ? 'أمس' : 'Yesterday' },
    { key: 'earlier', label: isAr ? 'أقدم' : 'Earlier' }
  ];

  if (!open) return null;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[var(--fs-base)] font-[var(--fw-bold)] text-[var(--text-primary)]">
            {isAr ? 'الإشعارات' : 'Notifications'}
          </h2>
          {unread > 0 && (
            <Badge tone="brand">
              {isAr ? `${unread} جديد` : `${unread} new`}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllNotificationsRead}>
              {isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}
            </Button>
          )}
          {variant === 'popover' && (
            <IconButton icon="close" size="sm" label={isAr ? 'إغلاق' : 'Close'} onClick={onClose} />
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1.5 border-b border-[var(--border-subtle)] px-4 py-2.5"
        role="group"
        aria-label={isAr ? 'تصفية الإشعارات' : 'Filter notifications'}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = f === 'unread' ? unread : 0;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={[
                'rounded-[var(--r-full)] border px-2.5 py-1 text-[var(--fs-micro)] font-medium transition-colors',
                active
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--text-on-accent)]'
                  : 'border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-chip)]'
              ].join(' ')}
            >
              {filterLabel(f)}
              {count > 0 && <span className="ms-1 opacity-80">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon="bell"
            title={
              filter === 'unread'
                ? isAr ? 'لا يوجد غير مقروء' : 'Nothing unread'
                : isAr ? 'لا إشعارات بعد' : 'No notifications yet'
            }
            description={
              filter === 'unread'
                ? isAr ? 'لقد قرأت كل شيء. عمل جيد.' : "You're all caught up."
                : isAr
                ? 'ستظهر هنا التذكيرات وإنجازاتك عندما تحدث.'
                : 'Reminders and milestones will appear here as they happen.'
            }
          />
        ) : (
          <div className="space-y-4">
            {sections.map(({ key, label }) =>
              grouped[key].length === 0 ? null : (
                <section key={key}>
                  <h3 className="mb-2 text-[var(--fs-micro)] font-[var(--fw-bold)] uppercase tracking-wide text-[var(--text-tertiary)]">
                    {label}
                  </h3>
                  <ul className="space-y-2">
                    {grouped[key].map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        isAr={isAr}
                        onOpen={handleOpen}
                        onToggleRead={handleToggleRead}
                        onDismiss={(target) => dismissNotification(target.id)}
                      />
                    ))}
                  </ul>
                </section>
              )
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-2.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={clearReadNotifications}
          disabled={!visible.some((n) => !isUnread(n))}
        >
          {isAr ? 'مسح المقروء' : 'Clear read'}
        </Button>
        <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">
          {isAr ? 'محفوظة على هذا الجهاز فقط' : 'Stored on this device only'}
        </span>
      </div>
    </>
  );

  if (variant === 'panel') {
    return (
      <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-2)]">
        {body}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-full end-0 z-[var(--z-dropdown)] mt-2 flex max-h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-[var(--elev-3)]"
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-label={isAr ? 'مركز الإشعارات' : 'Notification Center'}
    >
      {body}
    </div>
  );
};
