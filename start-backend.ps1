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

# Move the venv outside the project tree so Device Guard does not block it.
# %USERPROFILE%\.local\ is the same trusted zone where uv.exe lives.
# Override by setting $env:UV_PROJECT_ENVIRONMENT before running this script.
if (-not $env:UV_PROJECT_ENVIRONMENT) {
    $env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.local\foliantica-venv"
}

# Remove old in-project .venv if present (no longer used)
if (Test-Path ".venv") {
    Write-Host "Removing old in-project .venv..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".venv"
}

if (-not (Test-Path $env:UV_PROJECT_ENVIRONMENT)) {
    Write-Host "Creating virtual environment at $env:UV_PROJECT_ENVIRONMENT..." -ForegroundColor Cyan
    uv venv --python 3.11 $env:UV_PROJECT_ENVIRONMENT
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
uv pip install -e .

Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
uv run uvicorn main:app --reload --port 8000