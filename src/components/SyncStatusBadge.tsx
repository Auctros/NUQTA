import React from 'react';
import { resumeSyncAfterWipe } from '../lib/sync/syncGate';
import type { SyncStatus } from '../lib/sync/useSyncStatus';

/**
 * Minimal, honest sync indicator.
 *
 * Three states matter to a user and each is shown differently:
 *  - paused: an explicit wipe latched sync off. Without this the app would silently
 *    never sync again, which looks identical to "sync is working quietly".
 *  - error: the identity was rejected or the server refused. Retrying will not help.
 *  - offline/reconnecting with pending work: their edits are safe locally but unsent.
 *
 * Nothing renders when sync is not configured, so a local-only build stays unchanged.
 */
export const SyncStatusBadge: React.FC<{ status: SyncStatus; isAr: boolean }> = ({
  status,
  isAr
}) => {
  if (!status.enabled) return null;

  const pending = status.pendingChanges;

  let tone = 'var(--text-muted)';
  let label = '';

  if (status.paused) {
    tone = 'var(--state-warning, #b45309)';
    label = isAr ? 'المزامنة متوقفة بعد حذف البيانات' : 'Sync is paused after a data wipe';
  } else if (status.state === 'error') {
    tone = 'var(--state-danger)';
    label = isAr ? 'تعذّرت المزامنة: تم رفض الهوية' : 'Sync failed: identity rejected';
  } else if (status.state === 'offline') {
    tone = 'var(--state-warning, #b45309)';
    label = isAr ? 'غير متصل — التغييرات محفوظة محلياً' : 'Offline — changes are saved locally';
  } else if (status.state === 'reconnecting') {
    tone = 'var(--state-warning, #b45309)';
    label = isAr ? 'جارٍ إعادة الاتصال…' : 'Reconnecting…';
  } else if (status.state === 'synchronizing') {
    tone = 'var(--text-secondary)';
    label = isAr ? 'جارٍ المزامنة…' : 'Synchronizing…';
  } else if (status.state === 'connected') {
    tone = 'var(--text-secondary)';
    label = pending > 0
      ? isAr ? `متصل — ${pending} تغيير في الانتظار` : `Connected — ${pending} pending`
      : isAr ? 'متزامن' : 'Synced';
  } else if (status.state === 'connecting') {
    // Reached before the first socket settles. Without this branch it fell through to
    // "Sync idle", which claims sync is inactive while it is in fact connecting.
    tone = 'var(--text-muted)';
    label = isAr ? 'جارٍ الاتصال…' : 'Connecting…';
  } else {
    tone = 'var(--text-muted)';
    label = isAr ? 'المزامنة غير نشطة' : 'Sync idle';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: tone,
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, currentColor 30%, transparent)'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: tone,
          flex: '0 0 auto'
        }}
      />
      <span>{label}</span>
      {status.paused && (
        <button
          type="button"
          onClick={() => {
            // Clearing the latch is an explicit, user-initiated decision to sync again.
            resumeSyncAfterWipe();
            window.location.reload();
          }}
          style={{
            background: 'transparent',
            color: 'inherit',
            border: '1px solid color-mix(in srgb, currentColor 50%, transparent)',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          {isAr ? 'استئناف المزامنة' : 'Resume sync'}
        </button>
      )}
    </div>
  );
};
