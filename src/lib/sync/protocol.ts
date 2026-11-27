/**
 * Wire types for the NUQTA sync protocol.
 *
 * These mirror `scripts/sync/*` exactly — see docs/sync-protocol.md. The server uses
 * snake_case in client→server change items and camelCase in server→client changes;
 * both shapes are modelled here so the translation is explicit rather than implicit.
 */

import type { SyncSectionName } from '../storage';

export type { SyncSectionName };

/** Operations accepted by the server's change log. */
export type SyncOperation = 'create' | 'update' | 'delete' | 'tombstone';

/** A change item as sent to the server (`snake_case`). */
export interface OutboundChange {
  device_id: string;
  client_change_id: string;
  store_name: SyncSectionName;
  record_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  client_timestamp: string;
  base_version: number | null;
}

/** A change as received from the server (`camelCase`). */
export interface InboundChange {
  serverChangeId: number;
  deviceId: string;
  clientChangeId: string;
  storeName: SyncSectionName;
  recordId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  clientTimestamp: string | null;
  baseVersion: number | null;
  createdAt: string;
}

export interface SyncAckEntry {
  clientChangeId: string;
  serverChangeId: number;
  /**
   * `applied`  — committed now.
   * `duplicate`— already committed (idempotent retry).
   * `superseded` — the record is tombstoned, so the write was refused and will never
   *                be accepted. The client must drop the entry rather than retry.
   */
  status: 'applied' | 'duplicate' | 'superseded';
}

export interface WelcomeMessage {
  type: 'welcome';
  deviceId: string;
  deviceCursor: number;
  serverCursor: number;
  schemaVersion: number;
  /** Absent from servers that predate the reset protocol; treated as 1. */
  workspaceGeneration?: number;
}

export interface SyncAckMessage {
  type: 'sync_ack';
  acknowledged: SyncAckEntry[];
  deviceCursor: number;
  serverCursor: number;
}

export interface SyncBroadcastMessage {
  type: 'sync_broadcast';
  serverCursor: number;
  changes: InboundChange[];
}

export interface AckOkMessage {
  type: 'ack_ok';
  deviceCursor: number;
  serverCursor: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
  detail?: string;
  maxSize?: number;
  /** Present on `workspace_reset`: the generation this device must adopt. */
  workspaceGeneration?: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export type ServerMessage =
  | WelcomeMessage
  | SyncAckMessage
  | SyncBroadcastMessage
  | AckOkMessage
  | ErrorMessage
  | WorkspaceResetMessage
  | PongMessage;

/** Server-pushed notice that the workspace was reset (also sent as a broadcast). */
export interface WorkspaceResetMessage {
  type: 'workspace_reset';
  workspaceGeneration: number;
  serverCursor: number;
}

/** Response body of `GET /sync/delta`. */
export interface DeltaResponse {
  serverCursor: number;
  nextCursor: number;
  hasMore: boolean;
  changes: InboundChange[];
  deviceCursor: number;
}

/**
 * Connection state surfaced to the UI. `error` is deliberately distinct from
 * `offline`: a rejected identity will never heal by retrying, whereas being offline
 * will. `synchronizing` means a connected session is actively moving changes.
 */
export type SyncConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'synchronizing'
  | 'reconnecting'
  | 'offline'
  | 'error';
