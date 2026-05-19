# start.ps1 — restart both servers after quickstart.ps1 has already run once.
#
#   powershell -ExecutionPolicy Bypass -File samples\task-manager\start.ps1

#Requires -Version 5.1
param()
$ErrorActionPreference = 'Stop'

$ScriptDir   = $PSScriptRoot
$BackendDir  = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$VenvDir     = Join-Path $BackendDir ".venv"
$VenvUvicorn = Join-Path $VenvDir   "Scripts\uvicorn.exe"

if (-not (Test-Path $VenvDir)) {
    Write-Host "Setup not complete. Run quickstart.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting VeloIQ Task Manager..." -ForegroundColor Cyan
Write-Host ""

$BackendCmd = (
    "Set-Location '" + $BackendDir + "'; " +
    "Write-Host 'Backend - http://localhost:8000' -ForegroundColor Cyan; " +
    "& '" + $VenvUvicorn + "' app.main:app --reload --port 8000"
)
$FrontendCmd = (
    "Set-Location '" + $FrontendDir + "'; " +
    "Write-Host 'Frontend - http://localhost:5173' -ForegroundColor Cyan; " +
    "npm run dev -- --port 5173"
)

$BackendProc  = Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd  -PassThru
$FrontendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd -PassThru

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "  Frontend  ->  http://localhost:5173"
Write-Host "  API docs  ->  http://localhost:8000/docs"
Write-Host "  Admin     ->  http://localhost:8000/admin/"
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    foreach ($proc in @($BackendProc, $FrontendProc)) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            & taskkill /F /T /PID $proc.Id 2>&1 | Out-Null
        }
    }
    Write-Host "Servers stopped." -ForegroundColor Green
}
