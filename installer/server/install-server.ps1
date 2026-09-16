#Requires -Version 5.1
<#
  Pulse Server — one-command Windows installer.

  Downloads the latest server release from GitHub, ensures a compatible Node.js
  runtime (bundling a portable one if needed), creates an admin account, and
  installs Pulse as a Windows service (or a logon task if not elevated).

  Examples:
    # Interactive (prompts for admin user/password), installs to C:\Pulse:
    .\install-server.ps1

    # Non-interactive:
    .\install-server.ps1 -AdminUser admin -AdminPassword 'S3cret!' -Port 8080 -TimeZone 'Europe/Budapest'

    # Pin a version / install elsewhere:
    .\install-server.ps1 -Version 1.0.0 -InstallDir 'D:\Pulse'
#>
[CmdletBinding()]
param(
  [string]$InstallDir = 'C:\Pulse',
  [int]$Port = 8080,
  [string]$Repo = 'TMarccci/pulse',
  [string]$Version = 'latest',
  [string]$TimeZone = '',
  [string]$AdminUser = '',
  [string]$AdminPassword = '',
  [switch]$NoService
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

$gh = @{ 'User-Agent' = 'pulse-installer'; 'Accept' = 'application/vnd.github+json' }
function VerNum([string]$v) { ($v -replace '[^0-9.]','').Split('.') | ForEach-Object { [int]$_ } }
function VerGe([string]$a, [string]$b) {
  $x = VerNum $a; $y = VerNum $b
  for ($i = 0; $i -lt 3; $i++) {
    $ai = if ($i -lt $x.Count) { $x[$i] } else { 0 }
    $bi = if ($i -lt $y.Count) { $y[$i] } else { 0 }
    if ($ai -ne $bi) { return $ai -gt $bi }
  }
  return $true
}

# ---- 1. Resolve the release + zip asset -----------------------------------
function Resolve-Release {
  Step "Resolving Pulse Server release from $Repo"
  $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=50" -Headers $gh
  $server = $releases | Where-Object { $_.tag_name -like 'server-v*' -and -not $_.draft -and -not $_.prerelease }
  if ($Version -ne 'latest') {
    $rel = $server | Where-Object { $_.tag_name -eq "server-v$Version" } | Select-Object -First 1
  } else {
    $rel = $server | Sort-Object { [Version](($_.tag_name -replace '^server-v','')) } -Descending | Select-Object -First 1
  }
  if (-not $rel) { Fail "No matching server release found (Version=$Version)." }
  $asset = $rel.assets | Where-Object { $_.name -like 'pulse-server*.zip' } | Select-Object -First 1
  if (-not $asset) { Fail "Release $($rel.tag_name) has no pulse-server*.zip asset." }
  $v = $rel.tag_name -replace '^server-v',''
  Ok "Found $($rel.tag_name)"
  return [pscustomobject]@{ Version = $v; Url = $asset.browser_download_url }
}

# ---- 2. Ensure a compatible Node.js (>= 22.5 for node:sqlite) --------------
function Ensure-Node {
  $existing = Get-Command node -ErrorAction SilentlyContinue
  if ($existing) {
    $nv = (& node -v) -replace '^v',''
    if (VerGe $nv '22.5.0') { Ok "Using system Node.js v$nv"; return $existing.Source }
    Warn "System Node.js v$nv is too old (need >= 22.5); bundling a portable runtime."
  } else {
    Warn "Node.js not found; bundling a portable runtime."
  }

  Step "Selecting a portable Node.js build"
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -Headers $gh
  $cand = $index |
    Where-Object { ($_.files -contains 'win-x64-zip') -and (VerGe ($_.version -replace '^v','') '22.5.0') } |
    Sort-Object { [Version]($_.version -replace '^v','') } -Descending
  $lts = $cand | Where-Object { $_.lts } | Select-Object -First 1
  $pick = if ($lts) { $lts } else { $cand | Select-Object -First 1 }
  if (-not $pick) { Fail "Could not find a suitable Node.js build." }

  $nodeVer = $pick.version   # like v22.14.0
  $zipName = "node-$nodeVer-win-x64"
  $nodeZip = Join-Path $env:TEMP "$zipName.zip"
  $nodeDir = Join-Path $InstallDir 'node'
  Step "Downloading Node.js $nodeVer"
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVer/$zipName.zip" -OutFile $nodeZip -Headers $gh
  if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  Expand-Archive -Path $nodeZip -DestinationPath $nodeDir -Force
  Remove-Item $nodeZip -Force
  $nodeExe = Join-Path $nodeDir "$zipName\node.exe"
  if (-not (Test-Path $nodeExe)) { Fail "Portable Node extraction failed." }
  Ok "Bundled Node.js $nodeVer"
  return $nodeExe
}

# ---- 3. Download + extract the server -------------------------------------
function Install-Files($release) {
  $serverDir = Join-Path $InstallDir 'server'
  Step "Installing server $($release.Version) to $serverDir"
  New-Item -ItemType Directory -Force -Path $serverDir | Out-Null

  # Preserve data/ across upgrades; replace code.
  foreach ($d in @('src','public','node_modules')) {
    $p = Join-Path $serverDir $d
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
  }

  $zip = Join-Path $env:TEMP "pulse-server-$($release.Version).zip"
  Invoke-WebRequest -Uri $release.Url -OutFile $zip -Headers $gh
  $tmp = Join-Path $env:TEMP ("pulse-extract-" + [guid]::NewGuid().ToString('N'))
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Remove-Item $zip -Force

  # Normalize if the zip nested everything under a single folder.
  $rootSrc = if (Test-Path (Join-Path $tmp 'src')) { $tmp } else { (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName }
  Copy-Item (Join-Path $rootSrc '*') $serverDir -Recurse -Force
  Remove-Item $tmp -Recurse -Force

  New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'data') | Out-Null
  Ok "Server files in place"
  return $serverDir
}

# ---- 4. Admin account ------------------------------------------------------
function Seed-Admin($node, $serverDir) {
  if (-not $AdminUser) { $AdminUser = Read-Host "Choose an admin username" }
  if (-not $AdminPassword) {
    $sec = Read-Host "Choose an admin password" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  if (-not $AdminUser -or -not $AdminPassword) { Fail "Admin username and password are required." }

  Step "Creating admin '$AdminUser'"
  $env:PULSE_DB = Join-Path $serverDir 'data\pulse.db'
  Push-Location $serverDir
  & $node 'src\seed.js' 'admin' $AdminUser $AdminPassword
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail "Admin creation failed." }
  Ok "Admin account ready"
}

# ---- 5. Autostart: Windows service (elevated) or logon task ----------------
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Install-Service($node, $serverDir, $tz) {
  $svcDir = Join-Path $InstallDir 'service'
  New-Item -ItemType Directory -Force -Path $svcDir | Out-Null
  $winsw = Join-Path $svcDir 'pulse-service.exe'
  $xml   = Join-Path $svcDir 'pulse-service.xml'

  if (-not (Test-Path $winsw)) {
    Step "Downloading WinSW service wrapper"
    Invoke-WebRequest -Uri 'https://github.com/winsw/winsw/releases/latest/download/WinSW-x64.exe' -OutFile $winsw -Headers $gh
  }

  @"
<service>
  <id>PulseServer</id>
  <name>Pulse Server</name>
  <description>Pulse activity monitoring sync server and admin dashboard.</description>
  <executable>$node</executable>
  <arguments>src\index.js</arguments>
  <workingdirectory>$serverDir</workingdirectory>
  <env name="PULSE_PORT" value="$Port" />
  <env name="PULSE_DB" value="$serverDir\data\pulse.db" />
  <env name="TZ" value="$tz" />
  <onfailure action="restart" delay="10 sec" />
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@ | Set-Content -Path $xml -Encoding UTF8

  Step "Installing + starting the PulseServer service"
  & $winsw stop $xml 2>$null | Out-Null
  & $winsw uninstall $xml 2>$null | Out-Null
  & $winsw install $xml
  & $winsw start $xml
  Ok "Service installed (starts automatically on boot)"
}

function Install-LogonTask($node, $serverDir, $tz) {
  Step "Registering a logon task (run elevated for a full Windows service)"
  $cmd = Join-Path $serverDir 'start-pulse.cmd'
  @"
@echo off
cd /d "%~dp0"
set PULSE_PORT=$Port
set PULSE_DB=%~dp0data\pulse.db
set TZ=$tz
"$node" src\index.js
"@ | Set-Content -Path $cmd -Encoding ASCII

  $action  = New-ScheduledTaskAction -Execute $cmd
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $set     = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName 'PulseServer' -Action $action -Trigger $trigger -Settings $set -Force | Out-Null
  Start-Process -FilePath $cmd -WindowStyle Hidden
  Ok "Logon task registered and server started"
}

# ---- Run -------------------------------------------------------------------
if (-not $TimeZone) { $TimeZone = (Get-TimeZone).Id }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$release   = Resolve-Release
$node      = Ensure-Node
$serverDir = Install-Files $release
Seed-Admin $node $serverDir

if ($NoService) {
  Warn "Skipping autostart (-NoService). Start manually: `"$node`" src\index.js  (in $serverDir)"
} elseif (Test-Admin) {
  Install-Service $node $serverDir $TimeZone
} else {
  Install-LogonTask $node $serverDir $TimeZone
}

Write-Host ""
Write-Host "Pulse Server $($release.Version) is installed." -ForegroundColor Green
Write-Host "Dashboard:  http://localhost:$Port" -ForegroundColor Green
Write-Host "Timezone:   $TimeZone (work-hours filter uses this)" -ForegroundColor Green
Write-Host "Install dir: $InstallDir" -ForegroundColor Green
