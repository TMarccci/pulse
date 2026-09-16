# Pulse

Consent-based workplace activity monitoring: a hidden Windows **agent** that reports
to a central **sync server** with a modern web dashboard.

> ⚠️ **Authorized use only.** Deploy Pulse only on devices you are legally permitted
> to monitor and only with the informed consent of the people using them. A
> worker-notice template is provided in [`docs/worker-notice-template.md`](docs/worker-notice-template.md).
> Monitoring people without a lawful basis and their knowledge may be illegal in your
> jurisdiction.

---

## What it does

**Agent (per workstation, hidden):**
- Focused window title + application name
- Total key presses
- Mouse active vs. idle time (idle threshold configurable centrally)
- No taskbar entry, no tray icon, starts with Windows, self-updates from GitHub Releases,
  and registers in *Add/Remove Programs*.

**Server + dashboard:**
- Workplace-wide and per-device analytics
- **Devices** screen — nickname, details, archive
- **Office** screen — drag monitor icons on a canvas, colour-coded by status with
  fully customizable colour rules
- **Settings** — idle threshold, **work hours** (focus analytics on working time),
  sync mode (live/timed), colour rules, enrollment keys, agent update floor
- Data export in CSV / Excel / JSON
- Admin login with an expiring session + CSRF token (auto-logout on expiry)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Repository layout

```
agent/       C#/.NET 10 Windows agent (WPF config + hidden monitor)
server/
  backend/   Node.js/Express API + SQLite (node:sqlite, no native deps)
  frontend/  React + Vite + Tailwind dashboard (builds into backend/public)
installer/
  client/    Inno Setup script for the agent installer
  server/    Windows-service (WinSW) + systemd deployment
scripts/     build-agent.ps1, build-server.ps1
.github/     CI + release pipelines
docs/        architecture, server, agent, build, API, deployment, worker notice
```

## Quick start (development)

**Server** (two terminals):

```bash
cd server/backend
npm install
PULSE_ADMIN_USER=admin PULSE_ADMIN_PASS=secret123 npm run dev
```

```bash
cd server/frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8080)
```

Optional demo data: `cd server/backend && node src/demo.js` (creates `admin` / `secret123`).

**Agent** (build + run on a Windows box):

```bash
cd agent
dotnet build PulseAgent.slnx -c Debug
# run bin/Debug/net10.0-windows/win-x64/PulseAgent.exe  → shows the config window
```

## Production

**Server on Windows — one command.** In an **elevated** PowerShell, this downloads the
latest release, bundles a portable Node.js if one isn't installed, prompts for an admin
account, and installs Pulse as a Windows service (dashboard at `http://localhost:8080`):

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force   # allow this session to run the script
iwr -useb https://raw.githubusercontent.com/TMarccci/pulse/main/installer/server/install-server.ps1 -OutFile install-server.ps1
.\install-server.ps1
```

Useful switches: `-Port`, `-TimeZone 'Europe/Budapest'`, `-Version`, `-InstallDir`,
`-AdminUser`/`-AdminPassword`. Re-running upgrades in place (keeps `data/`). See
[`installer/server/install-server.ps1`](installer/server/install-server.ps1).

**Other server options:** `docker compose up -d`, or the manual zip / systemd install —
see [`docs/SERVER.md`](docs/SERVER.md).

**Agent:** build the installer with `pwsh scripts/build-agent.ps1 -Version X.Y.Z`
(needs [Inno Setup](https://jrsoftware.org/isdl.php)), then run
`PulseAgentSetup-X.Y.Z.exe` on each workstation. See [`docs/AGENT.md`](docs/AGENT.md).

## Releases & auto-update

This is a **monorepo** — both the agent and the server release from
[`github.com/TMarccci/pulse`](https://github.com/TMarccci/pulse) (hardcoded, no config
needed). Tag `agent-vX.Y.Z` or `server-vX.Y.Z` to trigger the release pipelines
([`docs/BUILD.md`](docs/BUILD.md)):

- **Agents** poll the repo's `agent-v*` releases and silently install any newer installer.
- **The server** checks `server-v*` releases and self-updates from
  **Settings → Server updates** (or automatically with `PULSE_AUTO_UPDATE=true`, outside
  Docker).

Licensed under the [MIT License](LICENSE).
