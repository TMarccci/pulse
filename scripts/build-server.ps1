<#
  Builds the Pulse Server distributable: compiles the React dashboard, then
  assembles the backend + production dependencies + compiled SPA into a zip.

  Usage:  pwsh scripts/build-server.ps1 -Version 1.2.3
  Output: dist/pulse-server-<version>.zip
#>
param(
  [string]$Version = "0.1.0"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "server/frontend"
$backend = Join-Path $root "server/backend"
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "pulse-server"

Write-Host "==> Building dashboard (frontend)" -ForegroundColor Cyan
Push-Location $frontend
npm ci; if ($LASTEXITCODE) { throw "frontend npm ci failed" }
npm run build; if ($LASTEXITCODE) { throw "frontend build failed" }
Pop-Location

Write-Host "==> Staging backend + production deps" -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item (Join-Path $backend "src") (Join-Path $stage "src") -Recurse
Copy-Item (Join-Path $backend "public") (Join-Path $stage "public") -Recurse
Copy-Item (Join-Path $backend "package.json") $stage
if (Test-Path (Join-Path $backend "package-lock.json")) {
  Copy-Item (Join-Path $backend "package-lock.json") $stage
}

Push-Location $stage
npm install --omit=dev --no-audit --no-fund; if ($LASTEXITCODE) { throw "backend prod install failed" }
Pop-Location

# Stamp version into the staged package.json.
$pkgPath = Join-Path $stage "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 20 | Set-Content $pkgPath -Encoding utf8

$zip = Join-Path $dist "pulse-server-$Version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Write-Host "==> Zipping -> $zip" -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
Write-Host "    Server package: dist/pulse-server-$Version.zip" -ForegroundColor Green
