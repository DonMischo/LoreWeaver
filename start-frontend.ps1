# Start LoreWeaver frontend

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Please install Node.js 18+ from https://nodejs.org and restart your terminal."
    exit 1
}

Set-Location "$PSScriptRoot\web"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "Starting Next.js dev server on http://localhost:3000" -ForegroundColor Green
npm run dev
