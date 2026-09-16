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
| `PULSE_AGENT_REPO`       | *(empty)*          | `owner/repo` advertised to agents for self-update   |

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

## Security notes

- Passwords hashed with scrypt; device tokens stored only as SHA-256 hashes.
- Admin auth is an httpOnly session cookie plus a CSRF token required on all
  state-changing requests; both expire together and the SPA logs out on expiry.
- Always serve over HTTPS in production so agent tokens and admin sessions are encrypted.
