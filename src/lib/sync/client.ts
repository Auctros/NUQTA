/**
 * Native browser WebSocket sync client.
 *
 * Responsibilities: connect, authenticate, push outbox batches, consume acks, apply
 * broadcasts, recover missed changes via `/sync/delta`, and reconnect with exponential
 * backoff.
 *
 * Design rules enforced here:
 *  - A browser cannot set an `Authorization` header on a WebSocket, so authentication
 *    always uses the server's handshake-frame path (`auth` message after upgrade).
 *  - Outbox entries are removed ONLY on an explicit `sync_ack` entry for them.
 *  - The cursor advances only after remote changes are durably applied.
 *  - Broadcasts are a fast path; the delta pull is the authoritative recovery path,
 *    because a broadcast can be missed while disconnected.
 *  - No polling: reconnect is event-driven (backoff timer, `online`, foreground).
 */

import {
  readOutbox,
  acknowledge,
  peekBatch,
  toOutboundChange,
  outboxSize,
  onOutboxChange,
  clearOutbox
} from './outbox';
import { advanceCursor, readCursor, setDeviceCursor, clearCursor } from './cursor';
import {
  applyRemoteChanges,
  clearApplied,
  clearConflicts,
  clearTombstones,
  dropRecordLocally
} from './applyRemote';
import { getDeviceMeta, getOrCreateDeviceId } from './deviceIdentity';
import { readWorkspaceGeneration, setWorkspaceGeneration } from './workspaceGeneration';
import type {
  DeltaResponse,
  InboundChange,
  ServerMessage,
  SyncConnectionState
} from './protocol';

/**
 * The minimal socket surface this client uses.
 *
 * Declared structurally so both the browser's `WebSocket` and Node's `ws` (used by the
 * tests) satisfy it — their DOM lib types are not interchangeable.
 */
export interface SyncSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
}

export interface SyncClientOptions {
  /** Absolute ws:// URL of the sync endpoint, e.g. `ws://127.0.0.1:3000/sync`. */
  url: string;
  /** Max changes per push batch. The server default is 100. */
  batchSize?: number;
  /** Backoff tuning, injectable for tests. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Override for tests; defaults to globalThis.WebSocket. */
  webSocketImpl?: new (url: string) => SyncSocket;
  /**
   * Override for tests. A real browser always sends an `Origin` header on the upgrade,
   * which the server validates; Node's `ws` does not, so tests inject a factory that
   * emulates the browser's header rather than weakening the server's origin check.
   */
  webSocketFactory?: (url: string) => SyncSocket;
  /** Override for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Origin header for the delta request; a browser sets this automatically. */
  origin?: string;
  /** Optional observer for state transitions. */
  onStateChange?: (state: SyncConnectionState) => void;
  /**
   * Called when this client learns the workspace was reset and has discarded its local
   * copy. The app uses it to reload, because in-memory state still holds the old data.
   */
  onWorkspaceReset?: (generation: number | null) => void;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;

/** Errors that retrying cannot fix; the client stops instead of spinning. */
const FATAL_ERRORS = new Set([
  'invalid_token',
  'tailscale_user_forbidden',
  'device_identity_conflict',
  'sync_not_configured',
  'origin_not_allowed',
  'unauthorized',
  'authentication_required'
]);

export class SyncClient {
  private readonly options: Required<
    Pick<SyncClientOptions, 'url' | 'batchSize' | 'baseDelayMs' | 'maxDelayMs'>
  > &
    SyncClientOptions;

  private socket: SyncSocket | null = null;
  private state: SyncConnectionState = 'idle';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private flushing = false;
  /** Set once a session authenticated; a later drop is a network problem, not auth. */
  private everConnected = false;
  /** Detaches the outbox subscription; set while the client is running. */
  private detachOutbox: (() => void) | null = null;
  private readonly deviceId: string;

  constructor(options: SyncClientOptions) {
    this.options = {
      batchSize: DEFAULT_BATCH_SIZE,
      baseDelayMs: DEFAULT_BASE_DELAY_MS,
      maxDelayMs: DEFAULT_MAX_DELAY_MS,
      ...options
    };
    this.deviceId = getOrCreateDeviceId();
  }

  getState(): SyncConnectionState {
    return this.state;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  private setState(next: SyncConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.options.onStateChange?.(next);
  }

  /** Return to `connected` once a synchronizing pass has nothing left to do. */
  private settle(): void {
    if (this.stopped) return;
    if (this.state === 'synchronizing') this.setState('connected');
  }

  /** Open a connection (idempotent while running). */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.attempt = 0;
    // Any change captured from now on must be sent as soon as it is durable. Subscribing
    // here (not on connect) means an edit made while the socket is still opening is
    // pushed by the `welcome` flush instead of waiting for an unrelated event.
    this.detachOutbox = onOutboxChange(() => {
      void this.flush();
    });
    this.connect();
  }

  /** Close and stop reconnecting. */
  stop(): void {
    this.stopped = true;
    this.detachOutbox?.();
    this.detachOutbox = null;
    this.clearReconnectTimer();
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close(1000, 'client stopping');
      } catch {
        /* already closing */
      }
    }
    this.setState('idle');
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private get WebSocketImpl(): (new (url: string) => SyncSocket) | undefined {
    return (
      this.options.webSocketImpl ??
      (globalThis as { WebSocket?: new (url: string) => SyncSocket }).WebSocket
    );
  }

  private connect(): void {
    if (this.stopped) return;
    const Impl = this.WebSocketImpl;
    if (!Impl) {
      this.setState('error');
      return;
    }

    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: SyncSocket;
    try {
      socket = this.options.webSocketFactory
        ? this.options.webSocketFactory(this.options.url)
        : new Impl(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      const meta = getDeviceMeta();
      // No credential is sent: the browser cannot set headers on a WebSocket, so the
      // identity arrives from Tailscale Serve on the upgrade request itself. This frame
      // carries device metadata only — a device id is an identifier, never proof.
      socket.send(
        JSON.stringify({
          type: 'auth',
          deviceId: this.deviceId,
          deviceName: meta.deviceName,
          platform: meta.platform,
          appVersion: meta.appVersion
        })
      );
    };

    socket.onmessage = (event: { data: unknown }) => {
      let parsed: ServerMessage | null = null;
      try {
        parsed = JSON.parse(typeof event.data === 'string' ? event.data : '') as ServerMessage;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      void this.handleMessage(parsed);
    };

    socket.onerror = () => {
      // `onclose` follows and owns the retry decision.
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      // A batch sent on this socket can never be acknowledged now. Clearing the latch
      // here is what lets the entry be re-sent after reconnect; without it the client
      // stays "flushing" forever and the outbox never drains.
      this.flushing = false;
      if (this.stopped) return;
      // A rejected upgrade looks identical to a dropped connection from inside the
      // browser: both only surface as `close`. Ask the HTTP endpoint why, so a
      // permanently unauthorized identity becomes a visible error instead of an
      // endless reconnect loop.
      void this.probeFatalAuth().then((fatal) => {
        if (this.stopped) return;
        if (fatal) {
          this.stopped = true;
          this.clearReconnectTimer();
          this.setState('error');
          return;
        }
        this.scheduleReconnect();
      });
    };
  }

  /**
   * Distinguish "cannot authenticate" from "server unreachable".
   *
   * The delta endpoint applies the same identity check as the upgrade and answers with
   * a machine-readable code, so one cheap request tells us whether retrying can help.
   * Network failures are inconclusive and never stop the client.
   */
  private async probeFatalAuth(): Promise<boolean> {
    if (this.everConnected) return false;
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) return false;
    const httpBase = this.options.url.replace(/^ws/, 'http').replace(/\/sync$/, '');
    try {
      const headers: Record<string, string> = {};
      if (this.options.origin) headers.origin = this.options.origin;
      const response = await fetchImpl(
        `${httpBase}/sync/delta?device_id=${this.deviceId}&cursor=0&limit=1`,
        { headers, cache: 'no-store', credentials: 'same-origin' }
      );
      if (response.status === 401 || response.status === 403 || response.status === 503) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.clearReconnectTimer();

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Wait for the `online` event rather than burning the backoff budget offline.
      this.setState('offline');
      return;
    }

    this.setState('reconnecting');
    const delay = Math.min(
      this.options.baseDelayMs * 2 ** this.attempt,
      this.options.maxDelayMs
    );
    this.attempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private async handleMessage(message: ServerMessage): Promise<void> {
    switch (message.type) {
      case 'welcome':
        this.everConnected = true;
        if (typeof message.workspaceGeneration === 'number') {
          setWorkspaceGeneration(message.workspaceGeneration);
        }
        setDeviceCursor(message.deviceCursor);
        this.setState('connected');
        // A reconnect may have missed broadcasts; pull the authoritative delta first.
        this.setState('synchronizing');
        await this.pullDelta();
        await this.flush();
        this.settle();
        return;

      case 'sync_ack':
        /*
         * Remove every entry the server resolved, whatever the verdict.
         *
         * `applied` means committed; `duplicate` means already committed; `superseded`
         * means the record is deleted and the write will never be accepted. Keeping a
         * superseded entry would retry it forever, so all three clear the queue — what
         * differs is only the server-side outcome, not this device's obligation.
         */
        const resolved = message.acknowledged ?? [];
        const supersededIds = new Set(
          resolved.filter((entry) => entry.status === 'superseded').map((entry) => entry.clientChangeId)
        );
        if (supersededIds.size > 0) {
          // The record is gone server-side; drop it here too so this device stops
          // showing a record no other device has.
          const pending = readOutbox().entries;
          for (const entry of pending) {
            if (!supersededIds.has(entry.clientChangeId)) continue;
            dropRecordLocally(entry.section, entry.recordId);
          }
        }
        acknowledge(resolved.map((entry) => entry.clientChangeId));
        setDeviceCursor(message.deviceCursor);
        this.flushing = false;
        if (outboxSize() > 0) await this.flush();
        else this.settle();
        return;

      case 'sync_broadcast':
        this.applyInbound(message.changes);
        return;

      case 'workspace_reset':
        // Pushed by the server when any device performs a global reset.
        this.handleWorkspaceReset(
          typeof message.workspaceGeneration === 'number' ? message.workspaceGeneration : null
        );
        return;

      case 'ack_ok':
        setDeviceCursor(message.deviceCursor);
        return;

      case 'pong':
        return;

      case 'error':
        this.flushing = false;
        /*
         * The workspace was reset elsewhere. This device's copy belongs to a previous
         * generation, so uploading it would refill what the user cleared. Adopt the new
         * generation, discard the stale queue, and re-pull from scratch instead.
         */
        if (message.error === 'workspace_reset') {
          const generation =
            typeof message.workspaceGeneration === 'number' ? message.workspaceGeneration : null;
          this.handleWorkspaceReset(generation);
          return;
        }
        if (FATAL_ERRORS.has(message.error)) {
          // Retrying cannot help: surface the failure and stop instead of looping.
          this.stopped = true;
          this.clearReconnectTimer();
          this.setState('error');
          return;
        }
        if (message.error === 'authentication_required') {
          this.socket?.close();
        }
        return;

      default:
        return;
    }
  }

  /** Apply inbound changes and advance the cursor only after they are durable. */
  private applyInbound(changes: InboundChange[]): void {
    if (changes.length === 0) return;
    const result = applyRemoteChanges(changes);
    if (result.highestConsumed > 0) advanceCursor(result.highestConsumed);
  }

  /**
   * Pull missed changes from `/sync/delta` until caught up.
   * This is the recovery path for anything a broadcast could not deliver.
   */
  async pullDelta(): Promise<void> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) return;

    const httpBase = this.options.url.replace(/^ws/, 'http').replace(/\/sync$/, '');
    let guard = 0;

    while (guard < 200) {
      guard += 1;
      const cursor = readCursor().appliedCursor;
      const params = new URLSearchParams({
        device_id: this.deviceId,
        cursor: String(cursor),
        limit: String(this.options.batchSize)
      });

      let response: Response;
      try {
        // Identity comes from the Tailscale Serve proxy on the request, not from the
        // client. A browser sets `Origin` itself; `origin` is only supplied by tests.
        const headers: Record<string, string> = {};
        if (this.options.origin) headers.origin = this.options.origin;
        response = await fetchImpl(`${httpBase}/sync/delta?${params.toString()}`, {
          headers,
          cache: 'no-store',
          // Send cookies/credentials the proxy may need, and allow the proxy to answer.
          credentials: 'same-origin'
        });
      } catch {
        return;
      }

      if (!response.ok) return;

      let body: DeltaResponse;
      try {
        body = (await response.json()) as DeltaResponse;
      } catch {
        return;
      }

      if (!Array.isArray(body.changes) || body.changes.length === 0) {
        if (typeof body.deviceCursor === 'number') setDeviceCursor(body.deviceCursor);
        return;
      }

      const result = applyRemoteChanges(body.changes);
      if (result.highestConsumed > 0) advanceCursor(result.highestConsumed);
      if (typeof body.deviceCursor === 'number') setDeviceCursor(body.deviceCursor);

      if (!body.hasMore) return;
    }
  }

  /** Push queued changes, one batch at a time. Safe to call repeatedly. */
  async flush(): Promise<void> {
    if (this.flushing) return;
    const socket = this.socket;
    if (!socket || socket.readyState !== 1 /* OPEN */) return;

    const batch = peekBatch(this.options.batchSize);
    if (batch.length === 0) return;

    this.flushing = true;
    if (this.state === 'connected') this.setState('synchronizing');
    try {
      socket.send(
        JSON.stringify({
          type: 'sync',
          clientCursor: readCursor().appliedCursor,
          workspaceGeneration: readWorkspaceGeneration(),
          changes: batch.map((entry) => toOutboundChange(entry, this.deviceId))
        })
      );
    } catch {
      this.flushing = false;
    }
  }

  /** Called when the app returns to the foreground or regains connectivity. */
  resume(): void {
    if (this.stopped) {
      this.start();
      return;
    }
    const socket = this.socket;
    if (socket && socket.readyState === 1) {
      void this.pullDelta()
        .then(() => this.flush())
        .then(() => this.settle());
      return;
    }
    // A socket stuck in CONNECTING/CLOSING is discarded so a fresh attempt can start.
    this.clearReconnectTimer();
    this.attempt = 0;
    this.connect();
  }

  /**
   * Adopt a new workspace generation after a reset performed elsewhere.
   *
   * The local copy is dropped rather than merged: it describes a workspace the user
   * explicitly cleared, so re-uploading any part of it would undo the reset. The outbox
   * is cleared for the same reason, and the cursor restarts so the (empty) new
   * generation is pulled from the beginning.
   */
  private handleWorkspaceReset(generation: number | null): void {
    if (generation !== null) setWorkspaceGeneration(generation);
    clearOutbox();
    clearCursor();
    clearApplied();
    clearTombstones();
    clearConflicts();
    this.flushing = false;
    this.everConnected = false;
    this.options.onWorkspaceReset?.(generation);
  }

  /** The endpoint this client was configured with (used to derive sibling URLs). */
  getEndpoint(): string {
    return this.options.url;
  }

  /**
   * Ask the server to start a new workspace generation, deleting every device's copy.
   *
   * This lives on the client because it is a network call and the sync client is the
   * reviewed module allowed to make them. It returns the new generation on success so
   * the caller can adopt it, and `null` when the server could not be reached or refused
   * — never a silent success, because the caller is about to delete the user's data.
   */
  async requestWorkspaceReset(): Promise<number | null> {
    // `ws://host/sync` → `http(s)://host/sync/reset`
    const resetUrl = this.options.url.replace(/^ws/, 'http').replace(/\/sync$/, '/sync/reset');

    let response: Response;
    try {
      response = await fetch(resetUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;

    try {
      const body = (await response.json()) as { workspaceGeneration?: number };
      return typeof body.workspaceGeneration === 'number' ? body.workspaceGeneration : null;
    } catch {
      // The reset already happened server-side; only the generation is unknown.
      return null;
    }
  }

  /** Count of changes still owed to the server. */
  pendingCount(): number {
    return readOutbox().entries.length;
  }
}
