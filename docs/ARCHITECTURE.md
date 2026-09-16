# Pulse — Architecture

Pulse is a consent-based workplace activity monitoring system. It has two halves:

1. **Pulse Agent** — a hidden Windows background process (C#/.NET 10) installed on each
   monitored workstation.
2. **Pulse Server** — a Node.js sync server + modern React admin dashboard, running
   centrally (on-prem or a VPS).

> **Consent notice.** This software is intended for monitoring computers that the
> operator is legally authorized to monitor, with the informed consent of the people
> using them. The installer shows a consent banner and the deployment docs include a
> worker-notice template. Do not deploy it to devices you are not authorized to monitor.

---

## 1. Component map

```
                          ┌────────────────────────────────────────┐
                          │              Pulse Server               │
   ┌──────────────┐  HTTPS │  ┌──────────┐   ┌───────────────────┐  │
   │ Pulse Agent  │──────▶ │  │ REST API │──▶│ SQLite (better-   │  │
   │ (workstation)│ enroll │  │ /api/... │   │ sqlite3)          │  │
   │              │  sync  │  └────┬─────┘   └───────────────────┘  │
   └──────────────┘        │       │                                │
        ▲  self-update      │       │ serves built SPA               │
        │ (GitHub Releases) │  ┌────▼──────────────────────────┐    │
        │                   │  │ React + Vite + Tailwind admin  │    │
   ┌────┴─────────┐         │  │  dashboard / devices / office  │    │
   │ GitHub repo  │         │  │  analytics / settings / export │    │
   │  Releases    │         │  └───────────────────────────────┘    │
   └──────────────┘         └────────────────────────────────────────┘
```

## 2. Agent (workstation)

- **First run** shows a WPF **config window**: server address, port, TLS on/off,
  enrollment key, and a device name. It tests the connection, enrolls, then never
  shows UI again.
- **Hidden operation**: Windows-subsystem executable, no console, no main window
  after config, no tray icon, no taskbar entry.
- **Autostart**: registered under `HKCU\...\Run` (per-user) at install/enroll time.
- **Collectors**:
  - *Keyboard* — low-level `WH_KEYBOARD_LL` hook, counts key-down events.
  - *Mouse* — low-level `WH_MOUSE_LL` hook, tracks last-activity time; classifies each
    second as active/idle by the server-configured `idleThresholdSeconds`.
  - *Foreground window* — polls `GetForegroundWindow` for window title + owning
    process name.
- **Buffering & sync**: metrics are aggregated into per-minute buckets in a local
  SQLite spool, then delivered to the server according to the active **sync mode**:
  - *Live sync* — flush + heartbeat every N seconds/minutes.
  - *Timed sync* — buffer all day, flush once at a configured wall-clock time.
- **Config pull**: every sync also pulls the current monitoring rules, so idle
  thresholds and sync mode can be changed centrally.
- **Self-update**: checks the GitHub Releases API; if a newer signed installer exists,
  downloads and runs it silently, then exits.
- **Uninstall**: registered in *Add/Remove Programs* by the Inno Setup installer.

See [AGENT.md](AGENT.md).

## 3. Server

- **Express** API with two auth domains:
  - *Device auth* — `Bearer <device-token>` issued at enrollment (for `/api/agent/*`).
  - *Admin auth* — httpOnly session cookie + rotating **CSRF token with expiry**;
    the SPA auto-logs-out when the token expires.
- **SQLite** storage (zero-config default; swappable for Postgres later).
- **REST + SPA**: the API serves the compiled React bundle from `public/`.
- **Exports**: CSV / JSON / XLSX per device or workplace-wide.

See [SERVER.md](SERVER.md) and [API.md](API.md).

## 4. Data model (SQLite)

| table            | purpose                                                             |
|------------------|--------------------------------------------------------------------|
| `admins`         | dashboard logins (argon2id password hash)                          |
| `sessions`       | admin session + CSRF token + expiry                                |
| `enroll_keys`    | pre-shared enrollment keys                                          |
| `devices`        | one row per workstation (name, nickname, canvas x/y, archived…)    |
| `samples`        | per-minute activity buckets (keys, mouse active/idle, window)      |
| `window_events`  | foreground-window changes with durations                           |
| `settings`       | singleton JSON blob of monitoring rules / modes / color rules      |
| `audit_log`      | admin actions                                                      |

## 5. Sync protocol (summary)

```
POST /api/agent/enroll     { enrollKey, deviceName, hostname, os, agentVersion }
      → { deviceId, deviceToken, settings }

POST /api/agent/sync       Bearer <deviceToken>
      { agentVersion, buckets:[{ ts, keypresses, mouseActiveSec, mouseIdleSec,
                                 windows:[{app,title,seconds}] }] }
      → { ok, settings, serverTime }

GET  /api/agent/update-check?version=x.y.z   → { latest, url, mandatory }
```

## 6. Build & release pipeline

GitHub Actions (`.github/workflows`):
- `agent-release.yml` — builds the .NET agent, compiles the Inno Setup installer,
  attaches `PulseAgentSetup-x.y.z.exe` to a GitHub Release. The agent's self-updater
  reads these releases.
- `server-release.yml` — builds the React SPA + bundles the backend, produces a
  `pulse-server-x.y.z.zip` and a Docker image.

Versioning is driven by git tags (`agent-vX.Y.Z`, `server-vX.Y.Z`).
See [BUILD.md](BUILD.md).
