<#
  Builds the Pulse Agent as a self-contained single-file exe and, if Inno Setup
  is available, compiles the installer.

  Usage:  pwsh scripts/build-agent.ps1 -Version 1.2.3
  Output: agent/PulseAgent/publish/PulseAgent.exe
          installer/client/Output/PulseAgentSetup-<version>.exe
#>
param(
  [string]$Version = "0.1.0"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$csproj = Join-Path $root "agent/PulseAgent/PulseAgent.csproj"
$publish = Join-Path $root "agent/PulseAgent/publish"

Write-Host "==> Publishing Pulse Agent $Version" -ForegroundColor Cyan
dotnet publish $csproj -c Release -o $publish -p:Version=$Version --nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

$exe = Join-Path $publish "PulseAgent.exe"
Write-Host "    Agent exe: $exe ($([math]::Round((Get-Item $exe).Length/1MB,1)) MB)" -ForegroundColor Green

# Compile the installer if Inno Setup (iscc) is on PATH.
$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if ($iscc) {
  Write-Host "==> Compiling installer" -ForegroundColor Cyan
  $iss = Join-Path $root "installer/client/PulseAgent.iss"
  & $iscc.Source "/DAppVersion=$Version" $iss
  if ($LASTEXITCODE -ne 0) { throw "iscc failed" }
  Write-Host "    Installer: installer/client/Output/PulseAgentSetup-$Version.exe" -ForegroundColor Green
} else {
  Write-Warning "Inno Setup (iscc) not found on PATH; skipped installer compile."
  Write-Warning "Install from https://jrsoftware.org/isdl.php to build the setup exe."
}
