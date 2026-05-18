# quickstart.ps1 — SafeMantIQ Task Manager: one-command setup and launch.
#
# Run from a PowerShell terminal (from the repo root or this directory):
#
#   powershell -ExecutionPolicy Bypass -File samples\task-manager\quickstart.ps1
#
# What it does:
#   1. Verifies Python 3.10+ and Node.js 18+ are on your PATH
#   2. Creates a virtual environment in backend\.venv
#   3. Installs safemantiq-framework (editable, from this repo)
#   4. Copies .env.example -> .env  (SQLite pre-filled database, zero config)
#   5. Builds @safemantiq/ui from packages\ui if the dist is stale
#   6. Runs npm install for the frontend
#   7. Opens the backend and frontend each in their own console window
#   8. Opens http://localhost:5173 in your default browser
#   9. Press Ctrl+C in this window to stop both servers cleanly
#
# After the first run you can use start.ps1 to restart without re-running setup.

#Requires -Version 5.1
param()
$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────
function Ok($msg)      { Write-Host "  [OK]  $msg" -ForegroundColor Green  }
function Info($msg)    { Write-Host "  -->   $msg" -ForegroundColor Yellow  }
function Section($msg) { Write-Host "`n$msg"        -ForegroundColor Cyan   }
function Bail($msg)    { Write-Host "`n  [ERR] $msg" -ForegroundColor Red; exit 1 }

# ── Paths (all derived from the script location — portable) ───────────────────
$ScriptDir    = $PSScriptRoot
$RepoRoot     = (Get-Item (Join-Path $ScriptDir "..\..")).FullName
$BackendDir   = Join-Path $ScriptDir  "backend"
$FrontendDir  = Join-Path $ScriptDir  "frontend"
$FrameworkSrc = Join-Path $RepoRoot   "backend"
$UiPkgDir     = Join-Path $RepoRoot   "packages\ui"
$VenvDir      = Join-Path $BackendDir ".venv"
$VenvPython   = Join-Path $VenvDir    "Scripts\python.exe"
$VenvPip      = Join-Path $VenvDir    "Scripts\pip.exe"
$VenvUvicorn  = Join-Path $VenvDir    "Scripts\uvicorn.exe"

Write-Host ""
Write-Host "SafeMantIQ - Task Manager Quick Start" -ForegroundColor Cyan
Write-Host "--------------------------------------" -ForegroundColor Cyan

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
Section "Checking prerequisites..."

# Python — try the Windows 'py' launcher first, then 'python', then 'python3'
$PythonCmd = $null
foreach ($cmd in @('py', 'python', 'python3')) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $PythonCmd = $cmd
        break
    }
}
if (-not $PythonCmd) {
    Bail ("Python 3.10+ is required.`n" +
          "  Download from https://python.org`n" +
          "  During install, check 'Add Python to PATH'.")
}
$PyVerRaw = & $PythonCmd -c "import sys; v=sys.version_info; print(str(v.major)+'.'+str(v.minor))" 2>&1
if ($LASTEXITCODE -ne 0) { Bail "Python reported an error. Check your installation." }
$PyVer   = $PyVerRaw.Trim()
$PyParts = $PyVer -split '\.'
if ([int]$PyParts[0] -lt 3 -or ([int]$PyParts[0] -eq 3 -and [int]$PyParts[1] -lt 10)) {
    Bail "Python 3.10+ required - found $PyVer. Download a newer version from https://python.org"
}
Ok "Python $PyVer  (command: $PythonCmd)"

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Bail "Node.js 18+ is required. Download from https://nodejs.org"
}
$NodeVer = (node -e "process.stdout.write(process.version.slice(1))").Trim()
if ([int]($NodeVer -split '\.')[0] -lt 18) {
    Bail "Node.js 18+ required - found $NodeVer. Download a newer version from https://nodejs.org"
}
Ok "Node.js $NodeVer"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Bail "npm not found - it normally ships with Node.js."
}
Ok "npm $(npm --version)"

# ── 2. Python virtual environment ─────────────────────────────────────────────
Section "Setting up Python environment..."

if (-not (Test-Path $VenvDir)) {
    Info "Creating virtual environment in backend\.venv ..."
    & $PythonCmd -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { Bail "Failed to create virtual environment." }
    Ok "Virtual environment created"
} else {
    Ok "Virtual environment already exists"
}

# Upgrade pip quietly
& $VenvPip install -q --upgrade pip 2>&1 | Out-Null

# Install the framework from local source if not already present
$importCheck = & $VenvPython -c "import safemantiq_framework; print('ok')" 2>&1
if ($importCheck -notmatch 'ok') {
    Info "Installing safemantiq-framework from repo source..."
    & $VenvPip install -q -e $FrameworkSrc
    if ($LASTEXITCODE -ne 0) { Bail "pip install failed. See the error above." }
    Ok "safemantiq-framework installed"
} else {
    Ok "safemantiq-framework already installed"
}

# ── 3. Backend .env ───────────────────────────────────────────────────────────
Section "Configuring backend..."

$EnvFile    = Join-Path $BackendDir ".env"
$EnvExample = Join-Path $BackendDir ".env.example"
if (-not (Test-Path $EnvFile)) {
    Copy-Item $EnvExample $EnvFile
    Ok ".env created - using bundled SQLite database (no server needed)"
} else {
    Ok ".env already exists"
}

# ── 4. Build @safemantiq/ui if the dist is missing ───────────────────────────
Section "Preparing frontend UI library..."

$UiDist = Join-Path $UiPkgDir "dist\index.mjs"
if (-not (Test-Path $UiDist)) {
    Info "Building @safemantiq/ui (one-time step, ~15 s)..."
    Push-Location $UiPkgDir
    npm install --silent 2>&1 | Out-Null
    npm run build --silent 2>&1 | Out-Null
    Pop-Location
    if (-not (Test-Path $UiDist)) {
        Bail "UI build failed. Run 'npm run build' inside packages\ui to see the error."
    }
    Ok "@safemantiq/ui built"
} else {
    Ok "@safemantiq/ui dist is current"
}

# ── 5. Install frontend npm dependencies ─────────────────────────────────────
Section "Installing frontend dependencies..."

$RefineModules = Join-Path $FrontendDir "node_modules\@refinedev"
if (-not (Test-Path $RefineModules)) {
    Info "Running npm install (~30 s the first time)..."
    Push-Location $FrontendDir
    npm install --silent 2>&1 | Out-Null
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Bail "npm install failed." }
    Ok "Frontend dependencies installed"
} else {
    Ok "Frontend dependencies already installed"
}

# ── 6. Launch servers in separate console windows ────────────────────────────
Section "Starting servers..."
Write-Host ""

# Build command strings using parentheses for clean multi-line concatenation
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

# Each server gets its own console window so logs are visible independently
$BackendProc  = Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd  -PassThru
$FrontendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd -PassThru

# Give the servers time to bind before opening the browser
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host "  +------------------------------------------------------+"
Write-Host "  |                                                      |"
Write-Host "  |  " -NoNewline
Write-Host "Frontend" -ForegroundColor Green -NoNewline
Write-Host "  ->  http://localhost:5173               |"
Write-Host "  |  " -NoNewline
Write-Host "API docs" -ForegroundColor Green -NoNewline
Write-Host "  ->  http://localhost:8000/docs           |"
Write-Host "  |  " -NoNewline
Write-Host "Admin   " -ForegroundColor Green -NoNewline
Write-Host "  ->  http://localhost:8000/admin/          |"
Write-Host "  |                                                      |"
Write-Host "  |  Backend and frontend each have their own window.   |"
Write-Host "  |  Press Ctrl+C here to stop all servers.             |"
Write-Host "  +------------------------------------------------------+"
Write-Host ""

# ── 7. Wait and clean up on Ctrl+C ───────────────────────────────────────────
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host ""
    Info "Stopping servers..."
    foreach ($proc in @($BackendProc, $FrontendProc)) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            # /T kills the full process tree (uvicorn workers, vite child processes)
            & taskkill /F /T /PID $proc.Id 2>&1 | Out-Null
        }
    }
    Ok "Done."
}
