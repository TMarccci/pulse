# Pulse Server

Node.js/Express API + React dashboard, backed by SQLite via the built-in
`node:sqlite` module (Node **22.5+**, no native build step).

## Environment variables

| Variable                  | Default            | Purpose                                             |
|---------------------------|--------------------|-----------------------------------------------------|
| `PULSE_PORT`              | `8080`             | HTTP listen port                                    |
| `PULSE_HOST`             | `0.0.0.0`          | Bind address                                        |
| `PULSE_DB`               | `./data/pulse.db`  | SQLite file path                                    |
| `PULSE_PUBLIC`           | `./public`         | Compiled SPA directory                              |
| `PULSE_SESSION_TTL_MIN`  | `60`               | Admin session + CSRF token lifetime (minutes)       |
| `PULSE_ONLINE_WINDOW_SEC`| `120`              | Silence before a device is shown offline            |
| `PULSE_SECURE_COOKIES`   | `false`            | Flag cookies `Secure` (set behind HTTPS)            |
| `PULSE_CORS_DEV_ORIGIN`  | *(empty)*          | Allow a cross-origin dev frontend                   |
| `PULSE_ADMIN_USER`       | `admin`            | Bootstrap admin username                            |
| `PULSE_ADMIN_PASS`       | *(empty)*          | Bootstrap admin password (created on first run)     |
| `PULSE_REPO`             | `TMarccci/pulse`   | Monorepo used for agent + server self-update         |
| `PULSE_AUTO_UPDATE`      | `false`            | Auto-apply new `server-v*` releases (non-Docker)    |
| `PULSE_IN_DOCKER`        | auto               | Disables self-update; set by the image              |

> The repo is **hardcoded** to `TMarccci/pulse`, so no configuration is needed to
> receive updates. `PULSE_REPO` only matters if you fork.

## Server self-update

The server checks the repo's Releases for a newer `server-vX.Y.Z` every 6 hours and
on startup. **Settings → Server updates** shows the status with **Check now** /
**Update now**; applying downloads the release zip, overwrites the app files, and exits
so the service manager restarts it on the new version. Set `PULSE_AUTO_UPDATE=true` to
apply automatically. In Docker this is disabled — pull the new image instead.

## Run with Docker (recommended)

```bash
cp .env.example .env      # set PULSE_ADMIN_PASS etc.
docker compose up -d
# dashboard: http://<host>:8080
```

Data persists in `./data`. Put a TLS-terminating reverse proxy (Caddy/nginx/Traefik)
in front and set `PULSE_SECURE_COOKIES=true`.

## Run from the zip package

`scripts/build-server.ps1` (or the Server Release pipeline) produces
`pulse-server-<ver>.zip` containing `src/`, `public/`, and production `node_modules`.

```bash
unzip pulse-server-<ver>.zip -d pulse-server && cd pulse-server
node src/seed.js admin youruser yourpass   # create an admin
PULSE_PORT=8080 node src/index.js
```

- **Windows service:** copy the files from [`installer/server`](../installer/server)
  into the folder and run `install-windows-service.ps1` (elevated). Requires Node on PATH.
- **Linux:** use [`installer/server/pulse.service`](../installer/server/pulse.service).

## Admin accounts

```bash
node src/seed.js admin <username> <password>   # create/update an admin
node src/seed.js key   [label]                 # mint an enrollment key
```

Enrollment keys are also managed in **Settings → Enrollment keys** in the dashboard.

## Work hours & timezone

**Settings → Work hours** defines a daily window (start/end + work days) used to focus
analytics and exports when the **Work hours** toggle is on (Dashboard / device pages).
The filter is evaluated in the **server's local timezone**, so set the container/host
`TZ` to match the workplace — e.g. in `docker-compose.yml`:

```yaml
    environment:
      TZ: "Europe/Budapest"
```

Otherwise (Docker defaults to UTC) the 9–16 window would be applied in UTC.

## Security notes

- Passwords hashed with scrypt; device tokens stored only as SHA-256 hashes.
- Admin auth is an httpOnly session cookie plus a CSRF token required on all
  state-changing requests; both expire together and the SPA logs out on expiry.
- Always serve over HTTPS in production so agent tokens and admin sessions are encrypted.
