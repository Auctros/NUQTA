/**
 * Visual preview of the sync badge, for design review on a static host.
 *
 * GitHub Pages cannot host the WebSocket server, so a deployed demo has no endpoint
 * and the badge renders nothing at all. This lets a demo build draw the pill from a
 * fixed status instead, so the header layout can be reviewed without a server.
 *
 * Two gates, both off by default:
 *   - build time: VITE_NUQTA_SYNC_PREVIEW=1 enables the whole thing. Without it this
 *     module returns null and the real sync layer runs untouched.
 *   - run time: ?syncPreview=<state> picks which state to show, so one deploy covers
 *     every tone. ?pending=<n> sets the queued-change count.
 *
 * Nothing here opens a socket or writes storage.
 */

import type { SyncStatus } from './useSyncStatus';

/** States the badge can present, named after what the reviewer sees. */
export const PREVIEW_STATES = ['ok', 'busy', 'warn', 'danger', 'muted', 'paused'] as const;

export type PreviewState = (typeof PREVIEW_STATES)[number];

const STATUS_BY_STATE: Record<PreviewState, SyncStatus> = {
  ok: { enabled: true, paused: false, state: 'connected', pendingChanges: 0 },
  busy: { enabled: true, paused: false, state: 'synchronizing', pendingChanges: 0 },
  warn: { enabled: true, paused: false, state: 'offline', pendingChanges: 0 },
  danger: { enabled: true, paused: false, state: 'error', pendingChanges: 0 },
  muted: { enabled: true, paused: false, state: 'connecting', pendingChanges: 0 },
  paused: { enabled: true, paused: true, state: 'idle', pendingChanges: 0 }
};

function isPreviewState(value: string): value is PreviewState {
  return (PREVIEW_STATES as readonly string[]).includes(value);
}

/**
 * Resolve the preview status, or null to let the real sync layer run.
 *
 * `search` and `env` are injectable so this can be tested without a browser.
 */
export function readSyncPreview(
  search: string,
  env: Record<string, string | undefined> = (import.meta as { env?: Record<string, string | undefined> })
    .env ?? {}
): SyncStatus | null {
  if ((env.VITE_NUQTA_SYNC_PREVIEW ?? '').trim() !== '1') return null;

  const params = new URLSearchParams(search);
  const requested = (params.get('syncPreview') ?? 'ok').trim().toLowerCase();
  const state: PreviewState = isPreviewState(requested) ? requested : 'ok';

  const status: SyncStatus = { ...STATUS_BY_STATE[state], preview: true };

  // A queued count only means something while connected, and the badge only shows a
  // count in the busy tone. Keeping the two in sync avoids a "Synced · 3 pending" lie.
  const pending = Number.parseInt(params.get('pending') ?? '', 10);
  if (state === 'ok' && Number.isFinite(pending) && pending > 0) {
    return { ...status, state: 'connected', pendingChanges: pending, preview: true };
  }

  return status;
}
