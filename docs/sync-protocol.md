# NUQTA Sync Protocol — as implemented by Stage 1 server

This document records the protocol **actually implemented** by `scripts/sync/*`.
It is derived from reading the server source and its tests, not from design intent.
Stage 2 client code must conform to this document. Where the server is silent, the
gap is listed under "Blockers" rather than guessed at.

## 1. Transport

- A single HTTP server (localhost only) exposes:
  - `GET /health` and `GET /sync/health` — unauthenticated liveness probe.
  - `GET /sync/delta` — authenticated delta pull over plain HTTP.
  - `GET /sync` (HTTP) — returns `426 upgrade_required`.
  - WebSocket upgrade on `/sync` only. Any other upgrade path → `404`.
- Bind is forced to loopback (`127.0.0.1`, `localhost`, `::1`); any other host
  throws at config resolution time. `scripts/serve-dist.mjs` pins
  `HOST = '127.0.0.1'` for exactly this reason.
- The intended deployment is `tailscale serve` terminating TLS and proxying to
  this loopback port. The server is never exposed directly to a network: the
  identity header it trusts (§2) is only meaningful when a trusted proxy sets it.

## 2. Authentication

Authentication is **Tailscale identity, and only Tailscale identity**.

| Credential | Transport | Server env |
| --- | --- | --- |
| Tailscale identity | `tailscale-user-login` header, injected by `tailscale serve` | `NUQTA_SYNC_ALLOWED_USERS` |

- Only the official header is honoured. Aliases such as `x-tailscale-user` or
  `x-tailscale-profile` are **never** trusted: `tailscale serve` does not know
  about them and does not strip a client-supplied copy, so honouring them would
  let any caller that can reach the port assert an arbitrary identity with no
  credential at all.
- The header is trustworthy *only* because `tailscale serve` terminates TLS and
  overwrites/strips the `Tailscale-*` headers on the way in. The server therefore
  must never be reachable directly from an untrusted network — see §1.
- A device UUID is **never** authentication. It is an identifier.
- Authentication **fails closed**: with no allowed users configured, every
  `/sync` and `/sync/delta` request returns `503 sync_not_configured`.
- Repeated authentication failures from one peer address are throttled (see §2.2).
  Only failures are counted, so a request that authenticates is never refused.
- The shared-token mode still exists in `config.mjs` for local testing, but the
  browser client no longer sends a token. A token in a frontend bundle is
  readable by anyone who loads the app, so it is not a secret; shipping one would
  have provided the appearance of security only.

### 2.1 WebSocket authentication modes

The server supports two paths, both keyed on a `device_id` query parameter:

1. **Upgrade-time auth** — `GET /sync?device_id=<uuid>` carrying a valid
   `tailscale-user-login` header. The server authenticates during the upgrade and
   immediately sends `welcome`.
2. **Handshake-frame auth** — `GET /sync` (no `device_id`) with a valid
   Tailscale identity. The upgrade succeeds with `pendingHandshake: true`; the
   client must then send an `auth` frame within
   `NUQTA_SYNC_HANDSHAKE_TIMEOUT_MS` (default 5000 ms) or be closed with `1008`.

   ```json
   { "type": "auth", "deviceId": "<uuid>",
     "deviceName": "…", "platform": "…", "appVersion": "…" }
   ```

   The frame carries **no credential**. Identity is re-read from the upgrade
   request on every handshake, so a frame cannot promote a request that was never
   authenticated. `deviceName`/`platform`/`appVersion` fall back to the
   `x-device-name`/`x-device-platform`/`x-app-version` upgrade headers.

Any non-`auth` message sent before authentication is answered with
`{ "type": "error", "error": "authentication_required" }` and closed with `1008`.

### 2.2 Failure throttling

`scripts/sync/rateLimit.mjs` keeps a bounded, self-cleaning map of
peer-address → failure count (default: 20 failures per 60 s, at most 1024 keys).
A caller over budget receives `429 too_many_attempts` instead of a fresh `401`.
A successful authentication clears the caller's budget.

The bucket is keyed on the **socket address**, never on `x-forwarded-for`:
behind Serve every request arrives from the proxy, and trusting a forwarded
header would let a caller rotate its own bucket. Because only failures are
counted, one noisy local process cannot lock out the legitimate user who shares
the proxy's address.

## 3. Message protocol

All frames are JSON text. Every message is an object with a `type` discriminator.

### Server → client

| `type` | Payload | When |
| --- | --- | --- |
| `welcome` | `deviceId`, `deviceCursor`, `serverCursor`, `schemaVersion` | Once, immediately after successful authentication |
| `sync_ack` | `acknowledged[]`, `deviceCursor`, `serverCursor` | After a `sync` batch commits durably |
| `sync_broadcast` | `serverCursor`, `changes[]` | To every **other** authenticated socket after a commit |
| `ack_ok` | `deviceCursor`, `serverCursor` | After a bare `ack` cursor advance |
| `pong` | `timestamp` | Reply to `ping` |
| `error` | `error`, optional `detail`, optional `maxSize` | Any rejection |

### Client → server

| `type` | Payload | Notes |
| --- | --- | --- |
| `auth` | `deviceId`, metadata | Only in pending-handshake mode; no credential |
| `sync` | `changes[]`, optional `clientCursor` | Push a batch |
| `ack` | `cursor` | Advance the device cursor without pushing |
| `ping` | — | Liveness |

### 3.1 Change item (client → server)

```json
{
  "device_id": "<uuid>",
  "client_change_id": "<uuid>",
  "store_name": "tasks",
  "record_id": "<string, 1..255 chars>",
  "operation": "create" | "update" | "delete" | "tombstone",
  "payload": { },
  "client_timestamp": "<ISO-8601>",
  "base_version": 0
}
```

`store_name` must be one of exactly eleven values:

```
tasks, habits, goals, focus_sessions, health_metrics, expenses,
savings_goals, journal_entries, profile, sunday_reviews, history_audit
```

`meta` is deliberately **not** in that list — local metadata is never synced.

`device_id` inside every item must equal the authenticated device, otherwise the
whole batch is rejected. Payload is capped at `NUQTA_SYNC_MAX_PAYLOAD_SIZE`
(default 32 KB); a batch is capped at `NUQTA_SYNC_MAX_BATCH_SIZE` (default 100);
a frame is capped at `NUQTA_SYNC_MAX_MESSAGE_SIZE` (default 64 KB).

### 3.2 `sync_ack.acknowledged[]` entries

```json
{ "clientChangeId": "<uuid>", "serverChangeId": 42, "status": "applied" | "duplicate" }
```

- `applied` — newly committed.
- `duplicate` — this `(device_id, client_change_id)` was already committed; the
  original `serverChangeId` is returned. This is the idempotency path and it is
  the reason a client may safely re-send an unacknowledged batch.

### 3.3 Server → client change object

```json
{
  "serverChangeId": 42,
  "deviceId": "<uuid>",
  "clientChangeId": "<uuid>",
  "storeName": "tasks",
  "recordId": "…",
  "operation": "create" | "update" | "delete" | "tombstone",
  "payload": { },
  "clientTimestamp": "…" | null,
  "baseVersion": 0 | null,
  "createdAt": "…"
}
```

Note the **casing difference**: client→server uses `snake_case`
(`store_name`, `client_change_id`, …), server→client uses `camelCase`
(`storeName`, `clientChangeId`, …). The client must translate between them.

## 4. Batch semantics

- A batch is validated **entirely before** any write, then committed in one
  SQLite transaction. One invalid item rejects the whole batch with
  `{ "type": "error", "error": "batch_rejected", "detail": "…" }` and commits
  nothing.
- Duplicate `client_change_id` **within** a single batch is a rejection, not an
  idempotent success.
- `clientCursor` must not exceed the server's pre-batch `serverCursor`, else
  `batch_rejected`.
- `sync_ack` is emitted strictly **after** the transaction commits, so an ack is
  proof of durability.
- Broadcasts are sent only to sockets that are authenticated, open, and not the
  sender.

## 5. Cursor semantics

Two distinct cursors exist and must not be conflated:

- **`serverCursor`** — `MAX(server_change_id)` in the whole change log. Global
  high-water mark.
- **`deviceCursor`** — `device_cursors.last_processed_change_id` for this device.
  The highest `server_change_id` this device has pulled **and acknowledged**.

Rules:

- The cursor advances with `MAX(old, new)` — it can never move backwards.
- `ack` (and `sync`) reject a cursor greater than the current `serverCursor`.
- Pushing a batch does **not** implicitly advance past other devices' changes;
  only the supplied `clientCursor` is applied.
- Tombstone expiry is 30 days server-side; `expires_at` is refreshed on re-delete.

## 6. Delta endpoint

```
GET /sync/delta?device_id=<uuid>&cursor=<n>&limit=<n>&exclude_self=1
```

- Requires auth and (when present) a valid Origin.
- `cursor` defaults to the device's stored cursor; `limit` defaults to
  `maxBatchSize` and must be `1..maxBatchSize`.
- `exclude_self=1|true` skips this device's own changes — the natural way to pull
  catch-up data without re-applying local echoes.
- Response:

  ```json
  { "serverCursor": 6, "nextCursor": 2, "hasMore": true,
    "changes": [ … ], "deviceCursor": 0 }
  ```

- `nextCursor` is the `serverChangeId` of the last returned change (or the input
  cursor when the page is empty). Paginate until `hasMore` is false.
- An unknown `device_id` yields `404 device_not_found`; a device registered to a
  different auth subject yields `403 device_identity_conflict`.

## 7. Tombstones

A `delete` or `tombstone` operation inserts/updates a row in `tombstones` keyed by
`(store_name, record_id)` with `deleted_at` and a 30-day `expires_at`. The change
itself is also appended to `changes`, so a client that pulls deltas sees the
deletion as an ordinary change with `operation: "delete"`. There is no separate
tombstone endpoint in Stage 1.

## 8. Blockers for Stage 2

These are genuine gaps. They are reported rather than guessed:

1. **No conflict resolution.** The server stores `base_version` but never
   compares it. Two devices may both "successfully" update the same record; the
   server keeps both changes in the log and applies no merge. Stage 2 therefore
   must preserve `base_version` and competing versions but must not pretend to
   resolve them.
2. **No `meta` store by design.** `localStorage` metadata (`schemaVersion`,
   `createdAt`, `demo`) has no server counterpart and must not be pushed.
3. **`profile` has no record id.** `UserProfile` is a singleton with no `id`
   field. Any change for it must synthesise a stable `record_id` (e.g. `primary`,
   which is what the IndexedDB mirror already uses).
4. **`health_metrics` is a keyed map, not a list.** Its localStorage shape is
   `Record<dateKey, HealthMetric>` while the server model is a flat change log of
   `record_id` + payload. The client must derive `record_id` from the map key.
5. **No server-initiated "please pull".** The server only broadcasts changes as
   they commit. A client that was offline learns nothing from a broadcast; it
   must pull `/sync/delta` on reconnect. There is no `since` push.
6. **Broadcast is fire-and-forget.** A client that is connected but slow may miss
   a broadcast with no server-side retry. The cursor + delta pull is the
   authoritative recovery path, not the broadcast.
7. **No identity rotation path.** A rejected identity (removed from
   `NUQTA_SYNC_ALLOWED_USERS`) makes reconnect fail until the operator changes
   configuration. The client stops after a fatal auth error instead of looping.

## 9. Client wipe gate

Stage 2 has no deletion propagation: the server never learns that a device
deleted its data, and there is no settings UI to unpair one. A local wipe is
therefore ambiguous, and the client resolves it conservatively.

`NuqtaStorageEngine.wipeAll()` removes every `nuqta_` key, which includes the
device identity (`nuqta_sync_device_id_v1`) and the client cursor
(`nuqta_sync_cursor_v1`). If sync simply started again afterwards, the client
would present a brand-new device id with `cursor = 0`, pull the entire server
history through `/sync/delta`, and silently resurrect exactly the data the user
asked to delete.

`resetSyncState()` (called by `ProfileView` after a successful wipe) instead:

1. stops the active client and detaches capture and lifecycle listeners;
2. clears the outbox, cursor, applied-set, conflicts and baseline;
3. latches `nuqta_sync_paused_v1` via `pauseSync()`.

While the latch is set, `startSync()` returns `null` before opening a socket, so
nothing is pushed or pulled. It is a local flag, never a synchronized record, and
`resumeSyncAfterWipe()` clears it for a future explicit "re-link this device"
action. Until that exists, a wiped device stays purely local — which is the only
honest behaviour without deletion propagation.

## 10. Stage 2 client (as implemented in `src/lib/sync/`)

| Module | Responsibility |
| --- | --- |
| `deviceIdentity.ts` | Stable per-installation UUID in `nuqta_sync_device_id_v1` |
| `changeCapture.ts` | Diffs each section write against a durable baseline; enqueues record-level changes |
| `outbox.ts` | Durable queue; entries removed only on explicit `sync_ack` |
| `applyRemote.ts` | Applies inbound changes, suppresses echoes, records conflicts |
| `cursor.ts` | Monotonic `appliedCursor` + server-confirmed `deviceCursor` |
| `client.ts` | WebSocket session: auth frame, push, ack, broadcast, delta recovery, backoff |
| `lifecycle.ts` | Start/stop wiring to `online` / `visibilitychange` / `pageshow`; endpoint normalisation |
| `syncGate.ts` | The post-wipe pause latch (§9) |
| `useSyncStatus.ts` | React binding: state, pending count, paused flag |
| `protocol.ts` | Wire types, mirroring `scripts/sync/*` |

### 10.1 What the client deliberately does NOT do

- **No polling timer.** Reconnect is driven by the backoff timer plus `online`,
  `visibilitychange` and `pageshow`.
- **No credential.** See §2. Identity is the proxy's job.
- **No hard-coded endpoint shape.** `VITE_NUQTA_SYNC_URL` accepts the browsable
  origin (`https://host`) or an explicit `ws(s)://` URL; `normalizeSyncEndpoint`
  converts it and appends `/sync` exactly once. An unusable value disables sync
  rather than failing silently at socket-construction time.
- **No automatic conflict resolution.** A remote change for a record with an
  unsent local edit is *not* applied; it is recorded in
  `nuqta_sync_conflicts_v1` (bounded to the last 200) and the local edit wins
  until the next stage implements a policy.
- **No capture of `meta`.** `nuqta_meta_v1` is local-only.

### 10.2 Echo prevention

Applying remote data writes through the same storage engine that fires capture
listeners, so capture is suppressed with `withCaptureSuppressed()` while the write
happens. The baseline is still advanced inside that window, which is what keeps a
*subsequent* local edit a correct one-record diff instead of a re-create.

### 10.3 Cursor and crash safety

`appliedCursor` advances only after `applyRemoteChanges()` returns, and
`applyRemote` dedupes on `serverChangeId`, so re-pulling after a crash is a no-op
rather than a duplicate write. A brand-new device legitimately starts at
`cursor = 0` and pulls the full history; that is intended for a *new* device and
is exactly why the wipe path is gated instead (§9).

### 10.4 Fatal vs transient failures

A rejected upgrade is indistinguishable from a dropped socket inside a browser:
both surface only as `close`. After a close, and only if this client has never
authenticated, it probes `/sync/delta` once. A `401`/`403`/`503` there means
retrying cannot help, so the client stops in state `error` instead of looping.
Network failures are inconclusive and always retry.

### 10.5 User-visible status

`SyncStatusBadge` renders nothing when sync is unconfigured. Otherwise it shows
one of: paused-after-wipe (with a "Resume sync" action), identity rejected,
offline, reconnecting, synchronizing, connected (with pending count), idle.
