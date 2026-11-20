# NUQTA Sync — Deployment & Operations

Operational runbook for the sync server. For the wire protocol see
`docs/sync-protocol.md`; for what was verified and what was not, see §6.

## 1. What runs where

```
phone / laptop browser
        │  https (TLS)
        ▼
tailscale serve  ──► 127.0.0.1:3000  (scripts/serve-dist.mjs)
   adds Tailscale-User-Login            ├── static dist/  (the PWA)
   terminates TLS                       └── /sync, /sync/delta (SQLite log)
```

Three properties hold this together:

1. The Node server binds **loopback only** (`HOST = '127.0.0.1'`). It is not
   reachable from the LAN or the tailnet directly.
2. `tailscale serve` is the only thing that can reach it, and it is what injects
   the identity header.
3. The server trusts that header. Therefore: **never** expose port 3000 by any
   other means (no `tailscale funnel`, no reverse proxy that forwards
   client-supplied headers, no port forwarding).

## 2. First-time setup

```bash
npm ci
npm run build

cp .env.example .env
# edit .env:
#   VITE_NUQTA_SYNC_URL=https://nuqta.<tailnet>.ts.net
#   NUQTA_SYNC_ALLOWED_USERS=you@example.com
#   NUQTA_SYNC_ALLOWED_ORIGINS=https://nuqta.<tailnet>.ts.net
npm run build          # rebuild so VITE_NUQTA_SYNC_URL is compiled in
node scripts/serve-dist.mjs
```

Then, in a second shell:

```bash
tailscale serve --bg 3000
tailscale serve status
```

`VITE_*` values are baked into the bundle at build time. Changing one requires a
rebuild, not a restart.

The endpoint must be same-origin with the page. `index.html` ships
`connect-src 'self'`, so pointing sync at another host or port is blocked by CSP
before the socket opens. The Serve topology above is same-origin by construction,
which is why this has never been an issue in the documented deployment.

## 3. Health checks

```bash
curl -s http://127.0.0.1:3000/health
```

```json
{ "status": "ok", "syncConfigured": true }
```

- `syncConfigured: false` means no allowed users and no token were resolved.
  Every `/sync` and `/sync/delta` request will return `503`. This is the
  fail-closed default, not an error state.
- This endpoint is unauthenticated by design. It exposes only whether sync is
  configured, never data, identities or the change log.

Verify authentication actually rejects an anonymous caller:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'http://127.0.0.1:3000/sync/delta?device_id=00000000-0000-4000-8000-000000000000&cursor=0&limit=1'
# expect 401
```

Through Serve, the same request with a valid identity returns `404
device_not_found` for an unregistered device — which proves the identity path
works end to end.

## 4. Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `503 sync_not_configured` | No `NUQTA_SYNC_ALLOWED_USERS` / token resolved | Set the env var and restart |
| `401` for a real user | Request did not traverse Serve, so no identity header | Reach the app via the Serve URL, not `127.0.0.1` |
| `403 tailscale_user_forbidden` | Identity not in `NUQTA_SYNC_ALLOWED_USERS` | Add the exact login (`user@domain`) |
| `403 origin_not_allowed` | Browser `Origin` not in `NUQTA_SYNC_ALLOWED_ORIGINS` | Add the exact origin, scheme included |
| `403 device_identity_conflict` | Device UUID re-registered under a different identity | Expected. Wipe the device's site data and re-pair |
| `429 too_many_attempts` | 20 auth failures from one address in 60 s | Wait 60 s; check the client's identity |
| Badge says "identity rejected" | Client got a fatal auth error and stopped | Fix config, then reload the page |
| Badge says "paused after a data wipe" | `wipeAll()` latched sync off (§5) | Click "Resume sync", or leave it local-only |
| App works but never syncs | `VITE_NUQTA_SYNC_URL` empty at build time | Set it and rebuild |
| App works, badge stays "Sync idle", console shows a CSP `connect-src` violation | Endpoint is a different origin than the page | Use the origin that serves the app (CSP is `connect-src 'self'`) |

## 5. Data wipe behaviour

Wiping data in Settings permanently deletes every `nuqta_` key **and** the device
identity. If sync simply restarted, the device would present a new UUID with
`cursor = 0` and pull the entire server history back — resurrecting the data the
user just deleted.

So a wipe also sets a local latch (`nuqta_sync_paused_v1`). While set, no socket
is opened. The status badge shows the paused state with a "Resume sync" button.
Resuming clears the latch and reloads; the device then registers as a new device
and pulls full history, which is correct because the user explicitly asked for it.

## 6. What has and has not been verified

Verified by automated tests (`npm test`):

- Tailscale identity is the only accepted credential; `x-tailscale-user` and
  other aliases are rejected on both `/sync` and `/sync/delta`.
- `/sync/delta` requires identity even when `Origin` is absent.
- A handshake frame cannot authenticate a request that was never authenticated.
- Repeated auth failures are throttled and a valid caller is still served.
- The client stops on a fatal auth error instead of retrying forever.
- The post-wipe latch prevents a wipe from resurrecting data.

**Not verified here** (honest limits):

- A live `tailscale serve` instance. The tests inject the identity header
  directly, which proves the server's handling but not the proxy's behaviour.
  Before relying on this in production, confirm once on the real host that
  `tailscale serve` overwrites a client-supplied `Tailscale-User-Login` header.
  If it forwards it verbatim, the identity can be spoofed by anything that can
  reach the proxy.
- Two real devices reconciling concurrently (Stage 3 work).
- Multi-user isolation beyond the allow-list check.

## 7. Backup and recovery

The change log is a single SQLite file (`NUQTA_SYNC_DB_PATH`). Copy it while the
server is stopped, or use `sqlite3 <db> ".backup <dest>"` while it runs.

Client data lives in the browser. `localStorage` is authoritative; the IndexedDB
mirror is recovery-only. Losing the server loses history, not current device
state — each device keeps working locally and simply stops receiving others'
changes.
