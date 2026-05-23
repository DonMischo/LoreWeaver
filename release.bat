@echo off
setlocal EnableDelayedExpansion

:: ── Locate Node.js (mirrors devrun.bat logic) ────────────────────────────────
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

echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
pause & exit /b 1

:node_found
for %%d in ("%NODE%") do set "NODEDIR=%%~dpd"
echo %PATH% | findstr /i "%NODEDIR:~0,-1%" >nul 2>&1
if errorlevel 1 set "PATH=%NODEDIR%;%PATH%"

:: ── Read current version from root package.json ───────────────────────────────
for /f "tokens=*" %%i in ('node -e "process.stdout.write(require('./package.json').version)"') do set CURRENT_VERSION=%%i

for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set PATCH=%%c
)

set /a PATCH_NEXT=%PATCH%+1
set /a MINOR_NEXT=%MINOR%+1
set /a MAJOR_NEXT=%MAJOR%+1

echo.
echo ============================================================
echo   Foliantica Release Script
echo   Current version: v%CURRENT_VERSION%
echo ============================================================
echo.
echo   [1] Patch  ^(bug fixes^)         -^> v%MAJOR%.%MINOR%.!PATCH_NEXT!
echo   [2] Minor  ^(new features^)      -^> v%MAJOR%.!MINOR_NEXT!.0
echo   [3] Major  ^(breaking changes^)  -^> v!MAJOR_NEXT!.0.0
echo   [Q] Quit
echo.
set /p CHOICE="Choose bump type [1/2/3/Q]: "

if /i "%CHOICE%"=="Q" exit /b 0
if "%CHOICE%"=="1" goto bump_patch
if "%CHOICE%"=="2" goto bump_minor
if "%CHOICE%"=="3" goto bump_major
echo Invalid choice. & exit /b 1

:bump_patch
set /a PATCH=%PATCH%+1
goto set_version

:bump_minor
set /a MINOR=%MINOR%+1
set PATCH=0
goto set_version

:bump_major
set /a MAJOR=%MAJOR%+1
set MINOR=0
set PATCH=0
goto set_version

:set_version
set NEW_VERSION=%MAJOR%.%MINOR%.%PATCH%

echo.
echo  New version: v%NEW_VERSION%
echo.
set /p CONFIRM="Continue? [Y/N]: "
if /i not "%CONFIRM%"=="Y" exit /b 0

set /p MSG="Commit message (leave blank for default): "
if "%MSG%"=="" set MSG=Release v%NEW_VERSION%

:: ── Sanity check: clean working tree ──────────────────────────────────────────
git status --porcelain > "%TEMP%\lw_dirty.tmp" 2>&1
for %%f in ("%TEMP%\lw_dirty.tmp") do if %%~zf gtr 0 (
    echo.
    echo [ERROR] Working tree is dirty -- commit or stash changes first:
    type "%TEMP%\lw_dirty.tmp"
    del "%TEMP%\lw_dirty.tmp" 2>nul
    exit /b 1
)
del "%TEMP%\lw_dirty.tmp" 2>nul

:: ── Bump version numbers ───────────────────────────────────────────────────────
echo.
echo [1/4] Bumping version numbers...
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json'));p.version='%NEW_VERSION%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('web/package.json'));p.version='%NEW_VERSION%';fs.writeFileSync('web/package.json',JSON.stringify(p,null,2)+'\n');"
echo %NEW_VERSION%> VERSION

:: ── Build frontend for validation ─────────────────────────────────────────────
echo [2/4] Building frontend (release validation)...
cd web
call npm run build --silent
if errorlevel 1 ( echo [ERROR] Build failed & exit /b 1 )
cd ..

:: ── Commit + tag ──────────────────────────────────────────────────────────────
echo [3/4] Committing...
git add package.json web/package.json VERSION
git commit -m "%MSG%"
if errorlevel 1 ( echo [ERROR] Nothing to commit & exit /b 1 )
git tag -a "v%NEW_VERSION%" -m "v%NEW_VERSION%"

:: ── Push ──────────────────────────────────────────────────────────────────────
echo [4/4] Pushing to GitHub...
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
git push origin %BRANCH%
git push origin --tags

echo.
echo ============================================================
echo   Released v%NEW_VERSION%  -- GitHub Actions is now building the installers.
echo   Check: https://github.com/DonMischo/foliantica/actions
echo ============================================================
echo.
