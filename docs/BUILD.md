# Build & Release

Versioning is driven by **git tags**. The agent and server release independently.

| Tag              | Pipeline                | Produces                                        |
|------------------|-------------------------|-------------------------------------------------|
| `agent-vX.Y.Z`   | `agent-release.yml`     | `PulseAgentSetup-X.Y.Z.exe` on a GitHub Release |
| `server-vX.Y.Z`  | `server-release.yml`    | `pulse-server-X.Y.Z.zip` + GHCR Docker image    |

`ci.yml` builds both on every push/PR without releasing.

## Cutting a release

```bash
# Agent
git tag agent-v1.2.0 && git push origin agent-v1.2.0

# Server
git tag server-v1.2.0 && git push origin server-v1.2.0
```

The agent version is stamped into the assembly via `dotnet publish -p:Version=...`,
so `AppInfo.Version` and the installer name match the tag. Installed agents will
self-update to the new `agent-v*` release once it is the latest.

## Local builds

```powershell
# Agent (self-contained single-file exe + installer if Inno Setup is installed)
pwsh scripts/build-agent.ps1 -Version 1.2.0

# Server (dashboard build + backend + prod deps, zipped)
pwsh scripts/build-server.ps1 -Version 1.2.0
```

Prerequisites: .NET 10 SDK, Node 24, and (for the agent installer)
[Inno Setup 6](https://jrsoftware.org/isdl.php) on `PATH` (`iscc`).

## Manual dispatch

Both release workflows also accept a `workflow_dispatch` with a `version` input, so you
can build a one-off installer/image from the Actions tab without tagging.
