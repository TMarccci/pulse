# Pulse API

Base path: `/api`. Two auth domains:

- **Device** — `Authorization: Bearer <deviceToken>` (issued at enrollment).
- **Admin** — httpOnly `pulse_sid` session cookie + `X-CSRF-Token` header on all
  non-GET requests. A 401 means the session/CSRF token expired → re-login.

## Agent endpoints

| Method | Path                         | Auth   | Body / Query                                              |
|--------|------------------------------|--------|----------------------------------------------------------|
| POST   | `/agent/enroll`              | key    | `{ enrollKey, deviceName, hostname, os, agentVersion }` → `{ deviceId, deviceToken, settings }` |
| POST   | `/agent/sync`                | device | `{ agentVersion, buckets:[{ ts, keypresses, mouseClicks, mouseActiveSec, mouseIdleSec, windows:[{app,title,seconds}] }] }` → `{ ok, settings, serverTime }` |
| GET    | `/agent/update-check`        | none   | `?version=x.y.z` → `{ repo, minVersion, mandatory }`     |

## Admin endpoints

| Method | Path                          | Notes                                             |
|--------|-------------------------------|---------------------------------------------------|
| POST   | `/auth/login`                 | `{ username, password }` → `{ user, csrfToken, expiresAt, ttlSeconds }` |
| POST   | `/auth/logout`                | CSRF                                              |
| GET    | `/auth/me`                    | current session or 401                           |
| GET    | `/devices?includeArchived=`   | list with computed status                         |
| GET    | `/devices/:id`                | device + last-24h totals                          |
| PATCH  | `/devices/:id`                | `{ nickname, deviceName, canvasX, canvasY, archived }` (CSRF) |
| POST   | `/devices/:id/archive`        | CSRF                                              |
| POST   | `/devices/:id/unarchive`      | CSRF                                              |
| DELETE | `/devices/:id`                | hard delete + data (CSRF)                         |
| GET    | `/analytics/overview`         | workplace totals, timeseries, top apps            |
| GET    | `/analytics/device/:id`       | per-device analytics                              |
| GET    | `/analytics/device/:id/app-titles?app=` | title timeline for one app (`{titles, points, bucket}`) |
| GET    | `/analytics/device/:id/windows-timeline` | dominant foreground title per app per bucket |
| GET    | `/users`                      | list dashboard users (`{users, me}`)              |
| POST   | `/users`                      | `{ username, password }` create (CSRF)            |
| PATCH  | `/users/:id`                  | `{ password }` change password (CSRF)             |
| DELETE | `/users/:id`                  | delete user (CSRF; not self / last admin)         |
| GET    | `/updates`                    | server self-update status                         |
| POST   | `/updates/check` · `/updates/apply` | check / apply server update (CSRF)          |
| GET    | `/settings`                   | settings + meta                                   |
| PUT    | `/settings`                   | patch settings (CSRF)                             |
| GET    | `/settings/keys`              | list enrollment keys                              |
| POST   | `/settings/keys`              | `{ label }` → new key (CSRF)                      |
| POST   | `/settings/keys/:id/revoke`   | CSRF                                              |
| GET    | `/export/{samples,windows,devices}` | `?format=csv|xlsx|json&deviceId=` + window params |

**Time window** (analytics + exports): either `range` ∈ `1h`, `24h`, `7d`, `30d`
(exports also accept `all`), **or** an explicit `from`/`to` in unix seconds for a single
day or custom interval. Add `workHours=1` to restrict to configured work hours.
`samples` totals/series and the samples export now include **`mouseClicks` / `mouse_clicks`**.
