# Sync scheduler

The football-data.org sync (`src/lib/sync/run.ts`) does not schedule itself. It
runs only when something invokes it: either `pnpm sync` (the CLI in
`scripts/sync.ts`) or `POST /api/cron/sync` (the secret-protected route in
`src/app/api/cron/sync/route.ts`). **Without a scheduler, fixtures, results and
the leaderboard never refresh on their own** — on match days you would be running
`pnpm sync` by hand. This doc covers how to wire that scheduler.

## How the sync is triggered

`POST /api/cron/sync` authenticates with a bearer token, not a user session, so
it sits outside the proxy auth matcher (which excludes `/api`):

```
Authorization: Bearer $CRON_SECRET
```

- No `CRON_SECRET` set → the route returns **404** (invisible until enabled).
- Wrong token → **401**.
- Success → **200** with a JSON `SyncReport` (`{ teams, fixtures, scoredFixtures }`).

Each run is idempotent (upserts by `(provider, external_id)`) and re-scores every
finished fixture, then invalidates the `tournament` + `leaderboard` cache tags.
Cheap to run often.

## Default: the `cron` sidecar (recommended)

`docker-compose.prod.yml` ships a `cron` service — a tiny `curlimages/curl`
container that loops on the **private** network and POSTs the endpoint at a fixed
cadence. It reaches the app by service name (`http://app:3000/api/cron/sync`), so
it needs neither the host loopback port nor TLS.

It comes up with the rest of the stack:

```bash
podman compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Only `CRON_SECRET` is injected into the sidecar (interpolated from `.env.prod`),
not the full secret set the app gets.

### Configuration

Environment variables on the `cron` service:

| Var                          | Default                          | Meaning                              |
| ---------------------------- | -------------------------------- | ------------------------------------ |
| `SYNC_URL`                   | `http://app:3000/api/cron/sync`  | Endpoint on the internal network     |
| `SYNC_INTERVAL_SECONDS`      | `120`                            | Seconds between runs                 |
| `SYNC_STARTUP_DELAY_SECONDS` | `15`                             | Grace period for the app to boot     |
| `CRON_SECRET`                | (from `.env.prod`)               | Must match the app's `CRON_SECRET`   |

**Why 2 minutes?** The sync is idempotent and cheap, so a short interval is safe,
but the football-data.org **free tier serves delayed data** — polling faster than
~2 min buys no fresher results and only burns the 10-requests/minute quota. If you
upgrade to a live-data plan, lower the interval.

### Verify

```bash
podman compose -f docker-compose.prod.yml logs -f cron
# [sync-cron] starting; target=http://app:3000/api/cron/sync interval=120s
# [sync-cron] 2026-06-11T19:02:00Z POST -> 200
```

- `200` — working.
- `401` — the sidecar's `CRON_SECRET` doesn't match the app's.
- `404` — the app has no `CRON_SECRET` set (route disabled).
- `000` — couldn't reach the app (still booting, or wrong `SYNC_URL`).

### Off-season

The scheduler is harmless year-round (it just upserts unchanged fixtures), but you
can pause it outside the tournament:

```bash
podman compose -f docker-compose.prod.yml stop cron
```

## Alternative: a host `systemd` timer

If you prefer scheduling on the host (e.g. you already terminate TLS there and
don't want an always-on loop container), drop the `cron` service and hit the
loopback port the app publishes (`127.0.0.1:3000`) from a timer.

`/etc/systemd/system/tippkeks-sync.service`:

```ini
[Unit]
Description=TippKeks fixture/result sync
After=network-online.target

[Service]
Type=oneshot
# Keep the secret out of the unit file:
EnvironmentFile=/etc/tippkeks/sync.env   # contains CRON_SECRET=...
ExecStart=/usr/bin/curl -fsS --max-time 60 -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  http://127.0.0.1:3000/api/cron/sync
```

`/etc/systemd/system/tippkeks-sync.timer`:

```ini
[Unit]
Description=Run TippKeks sync every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
AccuracySec=15s

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tippkeks-sync.timer
systemctl list-timers tippkeks-sync.timer   # verify next run
journalctl -u tippkeks-sync.service -f       # watch output
```

Use **either** the sidecar **or** the host timer — not both, or you double the
sync rate.

## Backup path

If the scheduler is down or the provider lags, a tenant admin can still enter
results manually at `/[gruppe]/ergebnisse`, which runs the same scoring. The
scheduler is for convenience and freshness, not correctness.
