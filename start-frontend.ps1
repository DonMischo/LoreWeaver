# Start Foliantica frontend
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding            = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

function Find-Node {
    # 1. Already on PATH?
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # 2. Check known install locations
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
        "$env:APPDATA\npm\node.exe"
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) { return $path }
    }

    # 3. nvm-windows / fnm: pick the newest version found
    $nvmRoots = @("$env:APPDATA\nvm", "$env:LOCALAPPDATA\nvm")
    foreach ($root in $nvmRoots) {
        if (Test-Path $root) {
            $node = Get-ChildItem -Path $root -Recurse -Filter node.exe -ErrorAction SilentlyContinue |
                    Sort-Object FullName -Descending | Select-Object -First 1
            if ($node) { return $node.FullName }
        }
    }
    return $null
}

$node = Find-Node

if (-not $node) {
    Write-Host "Node.js not found. Attempting to install via winget..." -ForegroundColor Yellow

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host "winget is not available either." -ForegroundColor Red
        Write-Host "Please install Node.js 18+ manually from https://nodejs.org and restart your terminal." -ForegroundColor Red
        exit 1
    }

    winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "winget install failed. Please install Node.js 18+ manually from https://nodejs.org." -ForegroundColor Red
        exit 1
    }

    $node = Find-Node
    if (-not $node) {
        Write-Host "Node.js was installed but not found on disk. Please restart PowerShell and re-run this script." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Using node at: $node" -ForegroundColor DarkGray

# Verify Node.js version is 18+
$nodeVersion = & $node --version    # e.g. "v22.5.1"
$majorVersion = [int]($nodeVersion -replace '^v(\d+)\..*', '$1')
if ($majorVersion -lt 18) {
    Write-Host "Node.js $nodeVersion found, but version 18+ is required. Please upgrade." -ForegroundColor Red
    exit 1
}

# Add node's directory to PATH so `npm` and child processes work in this session
$nodeDir = Split-Path $node -Parent
if ($env:Path -notlike "*$nodeDir*") {
    $env:Path = "$nodeDir;$env:Path"
}

Set-Location "$PSScriptRoot\web"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "Starting Next.js dev server on http://localhost:3000" -ForegroundColor Green
npm run dev