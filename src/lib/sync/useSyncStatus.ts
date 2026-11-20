/**
 * React binding for the sync layer.
 *
 * Keeps the UI honest about two things: the connection state, and the number of changes
 * still owed to the server. It also reloads the in-memory store after remote changes
 * land, because persistence (not the store) is authoritative.
 */

import { useEffect, useState } from 'react';
import { useNuqtaStore } from '../../store/nuqtaStore';
import { onRemoteApplied } from './applyRemote';
import { readSyncConfigFromEnv, startSync, stopSync } from './lifecycle';
import { onOutboxChange, outboxSize } from './outbox';
import { readSyncPreview } from './previewStatus';
import { isSyncPaused } from './syncGate';
import type { SyncConnectionState } from './protocol';

export interface SyncStatus {
  /** False when no endpoint is configured — the app is purely local. */
  enabled: boolean;
  /** True when an explicit local wipe latched the gate off. */
  paused: boolean;
  state: SyncConnectionState;
  pendingChanges: number;
  /**
   * Set only by a preview build, where the status is synthetic. Controls that would
   * change real state (Resume) use this to stay inert.
   */
  preview?: boolean;
}

export function useSyncStatus(): SyncStatus {
  const initializeStore = useNuqtaStore((s) => s.initializeStore);
  const [state, setState] = useState<SyncConnectionState>('idle');
  const [pendingChanges, setPendingChanges] = useState(0);
  const config = readSyncConfigFromEnv();
  // Preview builds draw a fixed status so the header can be reviewed on a static host
  // that has no sync server. Read per render: switching ?syncPreview= needs no reload
  // logic of its own, and a normal build returns null here and behaves exactly as before.
  const preview = readSyncPreview(
    typeof window === 'undefined' ? '' : window.location.search
  );
  const previewActive = preview !== null;
  const enabled = Boolean(config.url);
  const paused = isSyncPaused();

  useEffect(() => {
    if (previewActive || !enabled || paused) return;

    const client = startSync({
      ...config,
      onStateChange: (next) => {
        setState(next);
        setPendingChanges(outboxSize());
      }
    });
    if (client) setState(client.getState());

    // Remote changes are already durable on disk; re-read them into the store.
    const detachApplied = onRemoteApplied(() => {
      initializeStore();
      setPendingChanges(outboxSize());
    });

    // The pending count changes on every enqueue and every ack. Watching the outbox
    // keeps the badge accurate between connection-state transitions, which would
    // otherwise be the only moments it refreshed.
    const detachOutbox = onOutboxChange(() => {
      setPendingChanges(outboxSize());
    });
    setPendingChanges(outboxSize());

    return () => {
      detachApplied();
      detachOutbox();
      stopSync();
    };
  }, [enabled, paused, config.url, initializeStore, previewActive]);

  if (preview) return preview;

  return { enabled, paused, state, pendingChanges };
}
