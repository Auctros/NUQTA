-- NUQTA Sync Server Schema
-- Durable server-side state for ordered change logging, idempotency,
-- per-device synchronization cursors, authoritative tombstones, and the
-- workspace generation used by the global reset protocol.

-- Registered devices participating in synchronization.
-- device_id is a persistent client UUID bound to an authenticated subject
-- (e.g., Tailscale login or sync token principal), never treated as auth by itself.
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL DEFAULT 'Unknown Device',
  platform TEXT NOT NULL DEFAULT 'unknown',
  app_version TEXT NOT NULL DEFAULT '0.1.0',
  auth_subject TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Durable, ordered change log.
-- Excludes local schema metadata ('meta') so local metadata is never synced blindly.
CREATE TABLE IF NOT EXISTS changes (
  server_change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  client_change_id TEXT NOT NULL,
  store_name TEXT NOT NULL CHECK (store_name IN (
    'tasks', 'habits', 'goals', 'projects', 'focus_sessions', 'health_metrics',
    'expenses', 'savings_goals', 'journal_entries', 'profile',
    'sunday_reviews', 'history_audit'
  )),
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'tombstone')),
  payload TEXT NOT NULL,
  client_timestamp TEXT,
  base_version INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_changes_device_client
  ON changes(device_id, client_change_id);

CREATE INDEX IF NOT EXISTS idx_changes_store_seq
  ON changes(store_name, server_change_id);

CREATE INDEX IF NOT EXISTS idx_changes_store_record
  ON changes(store_name, record_id, server_change_id);

-- Per-device synchronization cursors.
-- last_processed_change_id tracks the highest server_change_id this device has pulled/acked.
CREATE TABLE IF NOT EXISTS device_cursors (
  device_id TEXT PRIMARY KEY,
  last_processed_change_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Explicit idempotency ledger keyed by (device_id, client_change_id).
CREATE TABLE IF NOT EXISTS processed_changes (
  device_id TEXT NOT NULL,
  client_change_id TEXT NOT NULL,
  server_change_id INTEGER NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_id, client_change_id),
  FOREIGN KEY (device_id) REFERENCES devices(device_id),
  FOREIGN KEY (server_change_id) REFERENCES changes(server_change_id)
);

-- Tombstones: the authoritative record of deletions.
--
-- A row here means "this record is deleted" and it outranks any later create/update.
-- The server consults this table during ingest (see db.mjs) so a stale device cannot
-- resurrect a deleted record by pushing an old copy. Rows are retained well past the
-- longest plausible offline period; see TOMBSTONE_RETENTION_DAYS in db.mjs.
CREATE TABLE IF NOT EXISTS tombstones (
  tombstone_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  store_name TEXT NOT NULL CHECK (store_name IN (
    'tasks', 'habits', 'goals', 'projects', 'focus_sessions', 'health_metrics',
    'expenses', 'savings_goals', 'journal_entries', 'profile',
    'sunday_reviews', 'history_audit'
  )),
  record_id TEXT NOT NULL,
  server_change_id INTEGER NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
  UNIQUE (store_name, record_id),
  FOREIGN KEY (device_id) REFERENCES devices(device_id),
  FOREIGN KEY (server_change_id) REFERENCES changes(server_change_id)
);

CREATE INDEX IF NOT EXISTS idx_tombstones_expires
  ON tombstones(expires_at);

-- Server metadata (schema version, creation timestamp).
CREATE TABLE IF NOT EXISTS server_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO server_meta (key, value) VALUES ('schema_version', '3');
INSERT OR IGNORE INTO server_meta (key, value) VALUES ('created_at', datetime('now'));
-- Workspace generation. Bumped by a global reset; a device that presents an older
-- generation is told to adopt the new one instead of uploading its stale data.
INSERT OR IGNORE INTO server_meta (key, value) VALUES ('workspace_generation', '1');
