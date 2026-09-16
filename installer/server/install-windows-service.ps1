<#
  Installs Pulse Server as a Windows Service using WinSW.

  Run from inside an extracted pulse-server folder (must contain src\ and
  public\, and node_modules from `npm ci --omit=dev`). Requires:
    - Node.js 22.5+ on PATH
    - An elevated PowerShell (Run as Administrator)

  Usage:  pwsh -File install-windows-service.ps1
#>
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$winswExe = Join-Path $here "pulse-service.exe"
$winswXml = Join-Path $here "pulse-service.xml"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js not found on PATH. Install Node 22.5+ first (https://nodejs.org)."
}
if (-not (Test-Path $winswXml)) {
  throw "pulse-service.xml not found next to this script."
}

if (-not (Test-Path $winswExe)) {
  $url = "https://github.com/winsw/winsw/releases/latest/download/WinSW-x64.exe"
  Write-Host "Downloading WinSW service wrapper..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $winswExe
}

New-Item -ItemType Directory -Force -Path (Join-Path $here "data") | Out-Null

Write-Host "Installing PulseServer service..." -ForegroundColor Cyan
& $winswExe install $winswXml
& $winswExe start $winswXml
Write-Host "Pulse Server installed and started. Dashboard: http://localhost:8080" -ForegroundColor Green
Write-Host "Create an admin if none exists:  node src\seed.js admin <user> <pass>" -ForegroundColor Yellow
