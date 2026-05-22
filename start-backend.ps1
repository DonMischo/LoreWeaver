# Start Foliantica backend

# Add uv's install location to PATH for this session (works for any user)
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"

Set-Location "$PSScriptRoot\api"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "uv not found. Installing..." -ForegroundColor Yellow
    Invoke-RestMethod "https://astral.sh/uv/install.ps1" | Invoke-Expression
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"

    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Write-Host "uv installation failed or not on PATH. Please restart PowerShell and try again." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    uv venv --python 3.11
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
uv pip install -e .

Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
uv run uvicorn main:app --reload --port 8000