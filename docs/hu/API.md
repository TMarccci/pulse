# Pulse API

Alap útvonal: `/api`. Két hitelesítési tartomány:

- **Eszköz** – `Authorization: Bearer <deviceToken>` (a regisztrációkor kiadva).
- **Admin** – httpOnly `pulse_sid` munkamenet-süti + `X-CSRF-Token` fejléc minden nem-GET
  kérésen. A 401 a munkamenet/CSRF token lejáratát jelenti → újbóli bejelentkezés.

## Ügynök-végpontok

| Metódus | Útvonal                      | Hitel. | Törzs / lekérdezés                                       |
|--------|------------------------------|--------|----------------------------------------------------------|
| POST   | `/agent/enroll`              | kulcs  | `{ enrollKey, deviceName, hostname, os, agentVersion }` → `{ deviceId, deviceToken, settings }` |
| POST   | `/agent/sync`                | eszköz | `{ agentVersion, buckets:[{ ts, keypresses, mouseClicks, mouseActiveSec, mouseIdleSec, windows:[{app,title,seconds}] }] }` → `{ ok, settings, serverTime }` |
| GET    | `/agent/update-check`        | nincs  | `?version=x.y.z` → `{ repo, minVersion, mandatory }`     |

## Admin végpontok

| Metódus | Útvonal                       | Megjegyzés                                        |
|--------|-------------------------------|---------------------------------------------------|
| POST   | `/auth/login`                 | `{ username, password }` → `{ user, csrfToken, expiresAt, ttlSeconds }` |
| POST   | `/auth/logout`                | CSRF                                              |
| GET    | `/auth/me`                    | aktuális munkamenet vagy 401                     |
| GET    | `/devices?includeArchived=`   | lista számított állapottal                        |
| GET    | `/devices/:id`                | eszköz + utolsó 24 órás összegzés                 |
| PATCH  | `/devices/:id`                | `{ nickname, deviceName, canvasX, canvasY, archived }` (CSRF) |
| POST   | `/devices/:id/archive`        | CSRF                                              |
| POST   | `/devices/:id/unarchive`      | CSRF                                              |
| DELETE | `/devices/:id`                | végleges törlés + adatok (CSRF)                   |
| GET    | `/analytics/overview`         | munkahelyi összegek, idősor, top alkalmazások     |
| GET    | `/analytics/device/:id`       | eszközönkénti analitika                           |
| GET    | `/analytics/device/:id/app-titles?app=` | egy alkalmazás címeinek idővonala (`{titles, points, bucket}`) |
| GET    | `/analytics/device/:id/windows-timeline` | domináns előtér-cím alkalmazásonként, vödrönként |
| GET    | `/users`                      | irányítópult-felhasználók listája (`{users, me}`) |
| POST   | `/users`                      | `{ username, password }` létrehozás (CSRF)        |
| PATCH  | `/users/:id`                  | `{ password }` jelszóváltás (CSRF)                |
| DELETE | `/users/:id`                  | törlés (CSRF; nem önmagad / nem az utolsó admin)  |
| GET    | `/updates`                    | szerver-önfrissítés állapota                      |
| POST   | `/updates/check` · `/updates/apply` | frissítés ellenőrzése / alkalmazása (CSRF)  |
| GET    | `/settings`                   | beállítások + meta                                |
| PUT    | `/settings`                   | beállítások módosítása (CSRF)                     |
| GET    | `/settings/keys`              | regisztrációs kulcsok listája                     |
| POST   | `/settings/keys`              | `{ label }` → új kulcs (CSRF)                     |
| POST   | `/settings/keys/:id/revoke`   | CSRF                                              |
| GET    | `/export/{samples,windows,devices}` | `?format=csv|xlsx|json&deviceId=` + időablak-paraméterek |

**Időablak** (analitika + export): vagy `range` ∈ `1h`, `24h`, `7d`, `30d` (az export
elfogad `all`-t is), **vagy** explicit `from`/`to` unix másodpercben egy adott naphoz vagy
egyéni intervallumhoz. A `workHours=1` a beállított munkaidőre szűkít. A `samples`
összegek/idősor és a samples export tartalmazza a **`mouseClicks` / `mouse_clicks`** mezőt.
