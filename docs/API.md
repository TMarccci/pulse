# Pulse API

Base path: `/api`. Two auth domains:

- **Device** — `Authorization: Bearer <deviceToken>` (issued at enrollment).
- **Admin** — httpOnly `pulse_sid` session cookie + `X-CSRF-Token` header on all
  non-GET requests. A 401 means the session/CSRF token expired → re-login.

## Agent endpoints

| Method | Path                         | Auth   | Body / Query                                              |
|--------|------------------------------|--------|----------------------------------------------------------|
| POST   | `/agent/enroll`              | key    | `{ enrollKey, deviceName, hostname, os, agentVersion }` → `{ deviceId, deviceToken, settings }` |
| POST   | `/agent/sync`                | device | `{ agentVersion, buckets:[{ ts, keypresses, mouseActiveSec, mouseIdleSec, windows:[{app,title,seconds}] }] }` → `{ ok, settings, serverTime }` |
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
| GET    | `/analytics/overview?range=`  | workplace totals, timeseries, top apps            |
| GET    | `/analytics/device/:id?range=`| per-device analytics                              |
| GET    | `/settings`                   | settings + meta                                   |
| PUT    | `/settings`                   | patch settings (CSRF)                             |
| GET    | `/settings/keys`              | list enrollment keys                              |
| POST   | `/settings/keys`              | `{ label }` → new key (CSRF)                      |
| POST   | `/settings/keys/:id/revoke`   | CSRF                                              |
| GET    | `/export/{samples,windows,devices}` | `?format=csv|xlsx|json&range=&deviceId=`    |

`range` ∈ `1h`, `24h`, `7d`, `30d` (exports also accept `all`).
