# Deployment walkthrough

End-to-end rollout from zero to a monitored fleet.

## 1. Stand up the server

```bash
cp .env.example .env
# edit .env: set a strong PULSE_ADMIN_PASS, and PULSE_AGENT_REPO=your-org/pulse
docker compose up -d
```

Browse to `http://<server>:8080` and sign in with the bootstrap admin. For anything
public-facing, terminate TLS at a reverse proxy and set `PULSE_SECURE_COOKIES=true`.

## 2. Create an enrollment key

Dashboard → **Settings → Enrollment keys → New key**. Copy it. (You can create one key
per site/batch and revoke it later; revoking blocks new enrollments, not existing devices.)

## 3. Configure monitoring rules

Dashboard → **Settings**:
- **Idle threshold** — seconds of no mouse activity that count as idle (default 30).
- **Sync mode** — *Live* (poll interval) or *Timed* (daily upload time).
- **Office colour rules** — thresholds/colours used on the Office canvas.
- **Minimum agent version** — floor that forces older agents to self-update.

## 4. Build the agent installer

```powershell
pwsh scripts/build-agent.ps1 -Version 1.0.0
# → installer/client/Output/PulseAgentSetup-1.0.0.exe
```

Or let the `agent-v1.0.0` tag build it in CI and attach it to a GitHub Release (which is
also what agents self-update from).

## 5. Enroll workstations

On each PC, logged in as the account to monitor, run the setup, fill in server +
enrollment key + device name, and click **Enroll & Start**. The device appears on the
dashboard within one sync interval.

## 6. Organize & operate

- **Devices** — rename via nickname, open details, archive removed machines.
- **Office** — drag monitors into your floor plan; colours update live.
- **Dashboard** — workplace analytics; **Export** to CSV/Excel/JSON.

## 7. Roll out updates

Tag `agent-vX.Y.Z` to publish a newer installer. Bump **Minimum agent version** in
Settings if you want to force the update. Agents pick it up automatically within ~6 hours
(or the next restart).

## Uninstalling from a device

*Add/Remove Programs → Pulse Agent → Uninstall*. Then archive it on the **Devices** screen.
