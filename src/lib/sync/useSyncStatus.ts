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
import { isSyncPaused } from './syncGate';
import type { SyncConnectionState } from './protocol';

export interface SyncStatus {
  /** False when no endpoint is configured — the app is purely local. */
  enabled: boolean;
  /** True when an explicit local wipe latched the gate off. */
  paused: boolean;
  state: SyncConnectionState;
  pendingChanges: number;
}

export function useSyncStatus(): SyncStatus {
  const initializeStore = useNuqtaStore((s) => s.initializeStore);
  const [state, setState] = useState<SyncConnectionState>('idle');
  const [pendingChanges, setPendingChanges] = useState(0);
  const config = readSyncConfigFromEnv();
  const enabled = Boolean(config.url);
  const paused = isSyncPaused();

  useEffect(() => {
    if (!enabled || paused) return;

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
  }, [enabled, paused, config.url, initializeStore]);

  return { enabled, paused, state, pendingChanges };
}
