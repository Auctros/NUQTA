/**
 * Sync lifecycle: wires the client to browser connectivity and app lifecycle events.
 *
 * Reconnect triggers are deliberately event-driven — `online`, `visibilitychange` and
 * `pageshow` — never a polling timer, per the Stage 2 constraints.
 */

import { SyncClient, type SyncClientOptions } from './client';
import { clearApplied, clearConflicts } from './applyRemote';
import {
  clearBaseline,
  hasBaseline,
  seedBaselineFromStorage,
  startChangeCapture
} from './changeCapture';
import { clearCursor } from './cursor';
import { clearOutbox } from './outbox';
import { pauseSync, isSyncPaused } from './syncGate';
import { NuqtaStorageEngine, type SyncSectionName } from '../storage';

export interface SyncRuntimeOptions extends SyncClientOptions {
  /** Env-configured endpoint. Sync stays off when the url is absent. */
  url: string;
}

let activeClient: SyncClient | null = null;
let detach: (() => void) | null = null;
let detachCapture: (() => void) | null = null;

/** Read a section straight from the storage engine (used only to seed a baseline). */
function readSectionForBaseline(section: SyncSectionName): unknown {
  switch (section) {
    case 'tasks':
      return NuqtaStorageEngine.getTasks();
    case 'habits':
      return NuqtaStorageEngine.getHabits();
    case 'goals':
      return NuqtaStorageEngine.getGoals();
    case 'focus_sessions':
      return NuqtaStorageEngine.getFocusSessions();
    case 'health_metrics':
      return NuqtaStorageEngine.getHealthMetrics();
    case 'expenses':
      return NuqtaStorageEngine.getExpenses();
    case 'savings_goals':
      return NuqtaStorageEngine.getSavingsGoals();
    case 'journal_entries':
      return NuqtaStorageEngine.getJournalEntries();
    case 'profile':
      return NuqtaStorageEngine.getProfile();
    case 'sunday_reviews':
      return NuqtaStorageEngine.getSundayReviews();
    case 'history_audit':
      return NuqtaStorageEngine.getHistoryAuditLogs();
    default:
      return null;
  }
}

function attachLifecycle(client: SyncClient): () => void {
  const onOnline = () => client.resume();
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      client.resume();
    }
  };
  const onPageShow = () => client.resume();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

/**
 * Start synchronization. A no-op when the endpoint is not configured, so an
 * unconfigured build behaves exactly like the local-first app it was before.
 *
 * There is deliberately no client-side credential: authentication is the Tailscale
 * identity that Tailscale Serve attaches to the request. Shipping a token here would
 * only publish it in the bundle.
 */
export function startSync(options: SyncRuntimeOptions): SyncClient | null {
  if (!options.url) return null;
  // An explicit local wipe latched the gate: starting now would pull the whole server
  // history back into a device the user just emptied.
  if (isSyncPaused()) return null;
  if (activeClient) return activeClient;

  // Seed the baseline from what is already stored BEFORE capturing. Without this, the
  // first edit of a pre-existing dataset would look like "create every record" and
  // push the user's entire history to the server.
  if (!hasBaseline()) {
    seedBaselineFromStorage(readSectionForBaseline);
  }

  // Capture starts only once a baseline exists, so enabling sync on an existing
  // dataset does not enqueue the whole dataset.
  detachCapture = startChangeCapture();

  const client = new SyncClient(options);
  activeClient = client;
  detach = attachLifecycle(client);
  client.start();
  return client;
}

export function getSyncClient(): SyncClient | null {
  return activeClient;
}

export function stopSync(): void {
  detachCapture?.();
  detachCapture = null;
  detach?.();
  detach = null;
  activeClient?.stop();
  activeClient = null;
}

/**
 * Stop synchronization after an explicit local wipe and keep it off.
 *
 * Only the sync layer is touched — never user data. The device identity is deliberately
 * left alone: `wipeAll()` has already removed it, and minting a new one with a zero
 * cursor is exactly the path that resurrects deleted records. The gate is latched
 * instead, so nothing is pulled or pushed until it is cleared on purpose.
 */
export function resetSyncState(): void {
  stopSync();
  clearOutbox();
  clearCursor();
  clearApplied();
  clearConflicts();
  clearBaseline();
  pauseSync();
}

/**
 * Turn the configured endpoint into the absolute `ws://`/`wss://` URL the client opens.
 *
 * Operators naturally write the origin they browse (`https://nuqta.example.ts.net`),
 * while the client needs a WebSocket URL ending in `/sync`. Without this translation
 * the socket constructor throws on every attempt and sync silently never connects, so
 * the accepted forms are normalised here instead of being documented as a trap.
 *
 * Returns '' for an unusable value so callers treat it exactly like "not configured".
 */
export function normalizeSyncEndpoint(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }

  if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
  else if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
  else if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return '';

  const path = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = path === '' ? '/sync' : path.endsWith('/sync') ? path : `${path}/sync`;
  parsed.hash = '';
  parsed.search = '';

  return parsed.toString();
}

/**
 * Read sync configuration from Vite env vars; an absent url means "sync disabled".
 *
 * Only the endpoint is configured. No credential is read here — see `startSync`.
 */
export function readSyncConfigFromEnv(
  env: Record<string, string | undefined> = (import.meta as { env?: Record<string, string | undefined> })
    .env ?? {}
): { url: string } {
  return {
    url: normalizeSyncEndpoint(env.VITE_NUQTA_SYNC_URL)
  };
}
