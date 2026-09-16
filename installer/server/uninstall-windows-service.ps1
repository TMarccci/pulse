<#
  Stops and removes the Pulse Server Windows Service.
  Run from the same folder as install-windows-service.ps1 (elevated).
#>
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$winswExe = Join-Path $here "pulse-service.exe"
$winswXml = Join-Path $here "pulse-service.xml"

if (-not (Test-Path $winswExe)) { throw "pulse-service.exe not found." }

Write-Host "Stopping and uninstalling PulseServer service..." -ForegroundColor Cyan
& $winswExe stop $winswXml
& $winswExe uninstall $winswXml
Write-Host "Pulse Server service removed. (Data in .\data was left intact.)" -ForegroundColor Green
