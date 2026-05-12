# Start LoreWeaver backend

# Add uv's install location to PATH for this session
$env:Path = "C:\Users\m.poehle16\.local\bin;$env:Path"

Set-Location "$PSScriptRoot\api"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "uv not found. Installing..." -ForegroundColor Yellow
    Invoke-RestMethod "https://astral.sh/uv/install.ps1" | Invoke-Expression
    $env:Path = "C:\Users\m.poehle16\.local\bin;$env:Path"
}

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    uv venv --python 3.11
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
uv pip install -e .

Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
uv run uvicorn main:app --reload --port 8000
