@echo off
setlocal enabledelayedexpansion

if /i "%1"=="frontend" goto :frontend
if /i "%1"=="backend"  goto :backend

rem ── Main: open two terminals ───────────────────────────────────────────────
set "SELF=%~f0"
set "LW_API_PORT=8765"
start "Foliantica Backend"  cmd /k ""%SELF%" backend"
start "Foliantica Frontend" cmd /k ""%SELF%" frontend"
timeout /t 4 /nobreak >nul
start http://localhost:3000
exit /b 0

rem ══════════════════════════════════════════════════════════════════════════
:backend
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
cd /d "%~dp0api"

where uv >nul 2>&1
if errorlevel 1 (
    echo uv not found. Installing...
    powershell -NoProfile -Command "Invoke-RestMethod 'https://astral.sh/uv/install.ps1' | Invoke-Expression"
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
    where uv >nul 2>&1
    if errorlevel 1 (
        echo uv installation failed. Please restart and try again.
        pause & exit /b 1
    )
)

if not exist .venv (
    echo Creating virtual environment...
    uv venv --python 3.11
)

echo Installing dependencies...
uv pip install -e .

echo Freeing port 8765...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING" 2^>nul') do taskkill /PID %%p /F >nul 2>&1

echo Starting FastAPI server on http://localhost:8765
.venv\Scripts\python.exe run.py --dev
exit /b

rem ══════════════════════════════════════════════════════════════════════════
:frontend
rem ── Find node ─────────────────────────────────────────────────────────────
set "NODE="

where node >nul 2>&1
if not errorlevel 1 for /f "delims=" %%n in ('where node') do (set "NODE=%%n" & goto :node_found)

for %%p in (
    "%ProgramFiles%\nodejs\node.exe"
    "%ProgramFiles(x86)%\nodejs\node.exe"
    "%LOCALAPPDATA%\Programs\nodejs\node.exe"
    "%APPDATA%\npm\node.exe"
) do if exist %%p (set "NODE=%%~p" & goto :node_found)

for %%r in ("%APPDATA%\nvm" "%LOCALAPPDATA%\nvm") do (
    if exist "%%~r" (
        for /f "delims=" %%n in ('dir /b /s "%%~r\node.exe" 2^>nul ^| sort /r') do (
            set "NODE=%%n" & goto :node_found
        )
    )
)

echo Node.js not found. Attempting to install via winget...
where winget >nul 2>&1
if errorlevel 1 (
    echo winget not available. Please install Node.js 18+ from https://nodejs.org
    pause & exit /b 1
)
winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
if errorlevel 1 (echo winget install failed. & pause & exit /b 1)
for /f "delims=" %%n in ('where node 2^>nul') do (set "NODE=%%n" & goto :node_found)
echo Node.js installed but not found. Please restart and try again.
pause & exit /b 1

:node_found
echo Using node at: %NODE%
for %%d in ("%NODE%") do set "NODEDIR=%%~dpd"
echo %PATH% | findstr /i "%NODEDIR:~0,-1%" >nul 2>&1
if errorlevel 1 set "PATH=%NODEDIR%;%PATH%"

for /f "delims=" %%v in ('"%NODE%" --version') do set "NODEVER=%%v"
set "NODEVER_STRIP=%NODEVER:~1%"
for /f "tokens=1 delims=." %%m in ("%NODEVER_STRIP%") do set "NODEMAJOR=%%m"
if %NODEMAJOR% lss 18 (
    echo Node.js %NODEVER% found but version 18+ is required. Please upgrade.
    pause & exit /b 1
)

cd /d "%~dp0web"
if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
) else (
    for /f %%t in ('powershell -NoProfile -Command "(Get-Item package.json).LastWriteTime -gt (Get-Item node_modules).LastWriteTime"') do (
        if /i "%%t"=="True" (
            echo Dependencies changed -- running npm install...
            call npm install
            if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
        )
    )
)

echo Starting Next.js dev server on http://localhost:3000
npx next dev --webpack
exit /b
