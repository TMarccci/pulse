# Pulse Agent

A self-contained (no runtime prerequisite) Windows 10/11 background app.

## Install flow (the USB "walk-up")

1. Copy `PulseAgentSetup-<ver>.exe` to a USB stick.
2. On the target workstation, **logged in as the account to be monitored**, run the setup.
   - It is a per-user install (no admin/UAC required) to
     `%LOCALAPPDATA%\Programs\Pulse Agent`.
3. The **config window** appears. Enter:
   - **Server address** (host/IP or pasted URL), **Port**, **Use HTTPS** (+ *Allow
     self-signed cert* for on-prem certs)
   - **Enrollment key** (from *Settings → Enrollment keys* in the dashboard)
   - **Device name**
4. Click **Enroll & Start**. The agent enrolls, saves its config, registers autostart,
   then hides. From then on it runs invisibly and starts with Windows.

## What it collects

- Foreground window **title** and **application** (e.g. `chrome.exe`)
- **Key press count** (counts only — no keystroke content is captured)
- **Mouse active/idle seconds** — a second is *idle* after `idleThresholdSeconds`
  (default 30) without mouse activity; the threshold is set centrally in Settings.

Data is aggregated into per-minute buckets and delivered by the active **sync mode**:
- **Live** — flush + heartbeat every *N* seconds (device shows online in near real time).
- **Timed** — buffer all day, upload once at a configured wall-clock time.

## Hidden operation

- Windows-subsystem exe: no console, no main window after setup, no tray/taskbar icon.
- Single instance per user (named mutex).
- Autostart via `HKCU\...\Run`.
- Local files in `%LOCALAPPDATA%\Pulse`: `config.json` (device token encrypted with
  DPAPI), `spool.jsonl` (buffered buckets), `agent.log` (rotating diagnostics).

## Self-update

Every 6 hours the agent asks the server where to update (`PULSE_AGENT_REPO`) and the
minimum required version, then checks that GitHub repo's **latest Release**. If it is
newer, it downloads the `*Setup*.exe` asset and runs it silently
(`/VERYSILENT`), which replaces the binary and relaunches the agent.

## Uninstall

*Settings → Apps → Pulse Agent → Uninstall* (or `Add/Remove Programs`). The uninstaller
stops the running agent, removes the autostart entry, and deletes `%LOCALAPPDATA%\Pulse`.

## Configuration reset

Delete `%LOCALAPPDATA%\Pulse\config.json` and relaunch the agent to show the config
window again (e.g. to re-point it at a new server).

## Notes on hooks & antivirus

The agent uses global low-level keyboard/mouse hooks (`SetWindowsHookEx`). Some EDR/AV
tools flag input hooks. For managed fleets, sign the installer and agent with your code-
signing certificate and allow-list it in your endpoint protection.
