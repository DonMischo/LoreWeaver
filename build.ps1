# ─────────────────────────────────────────────────────────────────────────────
# LoreWeaver — single build script  (Windows PowerShell)
# Run from the project root:  .\build.ps1
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "OK  $msg"  -ForegroundColor Green }
function Die($msg)  { Write-Host "ERR $msg"  -ForegroundColor Red; exit 1 }

# Helper: run a native command and stop if it exits non-zero
function Run {
    param([string]$Cmd, [string[]]$CmdArgs)
    & $Cmd @CmdArgs
    if ($LASTEXITCODE -ne 0) { Die "'$Cmd $($CmdArgs -join ' ')' exited with code $LASTEXITCODE" }
}

# ── Prerequisites ─────────────────────────────────────────────────────────────
Step "Checking prerequisites"
if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { Die "node not found — install Node.js 20+" }
if (-not (Get-Command npm    -ErrorAction SilentlyContinue)) { Die "npm not found" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Die "python not found — install Python 3.11+" }

Ok "Prerequisites OK"

# ── Step 1 — Electron dependencies ───────────────────────────────────────────
Step "Installing Electron dependencies"
Set-Location $Root
# Clean any leftover node_modules from a previous failed run
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
Run npm @("install")
Ok "Electron deps installed"

# ── Step 2 — Next.js standalone build ────────────────────────────────────────
Step "Building Next.js (standalone)"
Set-Location "$Root\web"
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
Run npm @("install", "--legacy-peer-deps")
Run npm @("run", "build")

# Copy static assets into standalone (Next.js doesn't do this automatically).
# When a parent node_modules exists the standalone nests output under "web\";
# detect which layout was produced and copy to the right place.
if (Test-Path ".next\standalone\web") {
  Copy-Item -Recurse -Force ".next\static" ".next\standalone\web\.next\static"
  if (Test-Path "public") { Copy-Item -Recurse -Force "public" ".next\standalone\web\public" }
} else {
  Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
  if (Test-Path "public") { Copy-Item -Recurse -Force "public" ".next\standalone\public" }
}
Ok "Next.js built"

# Stage the standalone for electron-builder.
# Normalise to a flat layout regardless of whether Next.js nested output under
# "web\" (happens when a parent node_modules exists) or produced it at root.
Set-Location $Root
if (Test-Path ".next-standalone") { Remove-Item -Recurse -Force ".next-standalone" }
if (Test-Path "web\.next\standalone\web") {
  Copy-Item -Recurse "web\.next\standalone\web" ".next-standalone"
} else {
  Copy-Item -Recurse "web\.next\standalone" ".next-standalone"
}
Ok "Next.js standalone staged -> .next-standalone\"

# ── Step 3 — FastAPI / PyInstaller ───────────────────────────────────────────
Step "Building FastAPI backend with PyInstaller"
Set-Location "$Root\api"

$uvAvailable = Get-Command uv -ErrorAction SilentlyContinue
if ($uvAvailable) {
  Run uv @("sync")
  Run uv @("pip", "install", "pyinstaller")
  Run uv @("run", "pyinstaller",
    "loreweaver.spec",
    "--distpath", "$Root\api-dist-tmp",
    "--workpath", "$Root\.pyinstaller-work",
    "--clean", "--noconfirm")
} else {
  Run pip @("install", ".")
  Run pip @("install", "pyinstaller")
  Run python @("-m", "PyInstaller",
    "loreweaver.spec",
    "--distpath", "$Root\api-dist-tmp",
    "--workpath", "$Root\.pyinstaller-work",
    "--clean", "--noconfirm")
}
Ok "PyInstaller build done"

# Stage flat into api-dist\
Set-Location $Root
if (Test-Path "api-dist") { Remove-Item -Recurse -Force "api-dist" }
Move-Item "api-dist-tmp\loreweaver-api" "api-dist"
Remove-Item -Recurse -Force "api-dist-tmp"
Ok "API binary staged -> api-dist\"

# ── Step 4 — Electron build ───────────────────────────────────────────────────
Step "Packaging with electron-builder"
Set-Location $Root
Run npm @("run", "dist:win", "--", "--publish", "never")
Ok "Done!  Installer is in dist\"
Write-Host ""
Write-Host "  Windows: dist\*.exe  (NSIS installer)" -ForegroundColor White
