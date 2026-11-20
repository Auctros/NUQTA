import React from 'react';
import { resumeSyncAfterWipe } from '../lib/sync/syncGate';
import type { SyncStatus } from '../lib/sync/useSyncStatus';

type Tone = 'ok' | 'busy' | 'warn' | 'danger' | 'muted';

interface Presentation {
  tone: Tone;
  /** Short enough for the header; the full sentence lives in the tooltip. */
  label: string;
  detail: string;
}

/**
 * Compact sync indicator for the main header.
 *
 * Deliberately terse: the header already carries a privacy pill, four icon buttons and
 * a notification bell, so this shows one dot plus a word. The full sentence stays in the
 * tooltip and in the visually hidden text, so shortening never hides the meaning.
 *
 * The states that matter are the ones that are NOT "everything is fine": a wipe latch, a
 * rejected identity, and unsent work while offline. Those get colour; normal operation
 * stays quiet so it does not compete for attention.
 */
function present(status: SyncStatus, isAr: boolean): Presentation {
  const pending = status.pendingChanges;

  if (status.paused) {
    return {
      tone: 'warn',
      label: isAr ? 'متوقفة' : 'Paused',
      detail: isAr ? 'المزامنة متوقفة بعد حذف البيانات' : 'Sync is paused after a data wipe'
    };
  }
  if (status.state === 'error') {
    return {
      tone: 'danger',
      label: isAr ? 'فشلت' : 'Failed',
      detail: isAr ? 'تعذّرت المزامنة: تم رفض الهوية' : 'Sync failed: identity rejected'
    };
  }
  if (status.state === 'offline') {
    return {
      tone: 'warn',
      label: isAr ? 'غير متصل' : 'Offline',
      detail: isAr ? 'غير متصل — التغييرات محفوظة محلياً' : 'Offline — changes are saved locally'
    };
  }
  if (status.state === 'reconnecting') {
    return {
      tone: 'warn',
      label: isAr ? 'إعادة اتصال' : 'Reconnecting',
      detail: isAr ? 'جارٍ إعادة الاتصال…' : 'Reconnecting…'
    };
  }
  if (status.state === 'synchronizing') {
    return {
      tone: 'busy',
      label: isAr ? 'مزامنة' : 'Syncing',
      detail: isAr ? 'جارٍ المزامنة…' : 'Synchronizing…'
    };
  }
  if (status.state === 'connecting') {
    return {
      tone: 'muted',
      label: isAr ? 'اتصال' : 'Connecting',
      detail: isAr ? 'جارٍ الاتصال…' : 'Connecting…'
    };
  }
  if (status.state === 'connected') {
    return pending > 0
      ? {
          tone: 'busy',
          label: isAr ? `${pending} معلّق` : `${pending} pending`,
          detail: isAr
            ? `متصل — ${pending} تغيير في الانتظار`
            : `Connected — ${pending} pending`
        }
      : { tone: 'ok', label: isAr ? 'متزامن' : 'Synced', detail: isAr ? 'متزامن' : 'Synced' };
  }
  return {
    tone: 'muted',
    label: isAr ? 'خاملة' : 'Idle',
    detail: isAr ? 'المزامنة غير نشطة' : 'Sync idle'
  };
}

/** Standard visually-hidden pattern; the repo has no `sr-only` utility class. */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
};

export const SyncStatusBadge: React.FC<{ status: SyncStatus; isAr: boolean }> = ({
  status,
  isAr
}) => {
  if (!status.enabled) return null;

  const view = present(status, isAr);
  // A preview status is synthetic, so its Resume button must not touch the real wipe
  // latch or reload the page. The control still renders, because hiding it would make
  // the preview misrepresent the header it exists to show.
  const isPreview = status.preview === true;

  return (
    <div className={`sync-pill sync-pill--${view.tone}`} role="status" aria-live="polite">
      <span className="sync-pill-dot" aria-hidden="true" />
      <span className="sync-pill-label" aria-hidden="true">
        {view.label}
      </span>
      {/* Exactly one accessible name: the abbreviation and the tooltip are hidden from
          AT, otherwise a screen reader would announce the state three times. */}
      <span className="sync-pill-sr" style={SR_ONLY}>
        {view.detail}
      </span>
      <span className="sync-pill-tip" role="tooltip" aria-hidden="true">
        {view.detail}
      </span>
      {status.paused && (
        <button
          type="button"
          className="sync-pill-action"
          onClick={() => {
            if (isPreview) return;
            // Clearing the latch is an explicit, user-initiated decision to sync again.
            resumeSyncAfterWipe();
            window.location.reload();
          }}
        >
          {isAr ? 'استئناف' : 'Resume'}
        </button>
      )}
    </div>
  );
};
