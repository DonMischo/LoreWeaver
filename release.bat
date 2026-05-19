@echo off
rem LoreWeaver release helper
rem
rem Usage:
rem   release.bat           -- bump patch  (1.2.3 -^> 1.2.4)
rem   release.bat minor     -- bump minor  (1.2.3 -^> 1.3.0)
rem   release.bat major     -- bump major  (1.2.3 -^> 2.0.0)

setlocal enabledelayedexpansion

set "BUMP=%~1"
if "%BUMP%"=="" set "BUMP=patch"
if /i "%BUMP%"=="patch" goto :valid_bump
if /i "%BUMP%"=="minor" goto :valid_bump
if /i "%BUMP%"=="major" goto :valid_bump
echo ERR Invalid bump type: %BUMP%. Use patch, minor, or major.
exit /b 1
:valid_bump

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

rem ── Sanity checks ─────────────────────────────────────────────────────────────
echo.
echo ^>^> Checking prerequisites

where git >nul 2>&1
if errorlevel 1 (echo ERR git not found & exit /b 1)
where node >nul 2>&1
if errorlevel 1 (echo ERR node not found & exit /b 1)

git -C "%ROOT%" rev-parse --abbrev-ref HEAD > "%TEMP%\lw_branch.tmp" 2>&1
if errorlevel 1 (del "%TEMP%\lw_branch.tmp" 2>nul & echo ERR Not a git repository & exit /b 1)
set /p BRANCH= < "%TEMP%\lw_branch.tmp"
del "%TEMP%\lw_branch.tmp" 2>nul
if "%BRANCH%"=="HEAD" (echo ERR Detached HEAD -- check out a branch first & exit /b 1)

git -C "%ROOT%" status --porcelain > "%TEMP%\lw_dirty.tmp" 2>&1
for %%f in ("%TEMP%\lw_dirty.tmp") do if %%~zf gtr 0 (
    echo Uncommitted changes:
    type "%TEMP%\lw_dirty.tmp"
    del "%TEMP%\lw_dirty.tmp" 2>nul
    echo ERR Working tree is dirty -- commit or stash changes first
    exit /b 1
)
del "%TEMP%\lw_dirty.tmp" 2>nul

echo OK  On branch '%BRANCH%', working tree clean

rem ── Read current version from package.json ────────────────────────────────────
echo.
echo ^>^> Reading current version

pushd "%ROOT%"
node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)" > "%TEMP%\lw_ver.tmp"
if errorlevel 1 (popd & del "%TEMP%\lw_ver.tmp" 2>nul & echo ERR Failed to read version from package.json & exit /b 1)
popd
set /p CURRENT= < "%TEMP%\lw_ver.tmp"
del "%TEMP%\lw_ver.tmp" 2>nul

echo OK  Current version: %CURRENT%

rem ── Calculate next version ────────────────────────────────────────────────────
node -e "const v='%CURRENT%'.split('.').map(Number);if('%BUMP%'==='major'){v[0]++;v[1]=0;v[2]=0;}else if('%BUMP%'==='minor'){v[1]++;v[2]=0;}else{v[2]++;}process.stdout.write(v.join('.'))" > "%TEMP%\lw_next.tmp"
if errorlevel 1 (del "%TEMP%\lw_next.tmp" 2>nul & echo ERR Failed to calculate next version & exit /b 1)
set /p NEXT= < "%TEMP%\lw_next.tmp"
del "%TEMP%\lw_next.tmp" 2>nul

set "TAG=v%NEXT%"

echo.
echo   %CURRENT%  --^>  %NEXT%  (tag: %TAG%)
echo.
set /p "CONFIRM=Proceed? [y/N]: "
if /i not "%CONFIRM%"=="y" (echo Aborted. & exit /b 0)

rem ── Bump version in package.json ─────────────────────────────────────────────
echo.
echo ^>^> Updating package.json

pushd "%ROOT%"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='%NEXT%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
if errorlevel 1 (popd & echo ERR Failed to update package.json & exit /b 1)
popd

echo OK  package.json -^> %NEXT%

rem ── Commit + tag + push ───────────────────────────────────────────────────────
echo.
echo ^>^> Creating git commit and tag

git -C "%ROOT%" add package.json
if errorlevel 1 (echo ERR git add failed & exit /b 1)

git -C "%ROOT%" commit -m "chore: release %TAG%"
if errorlevel 1 (echo ERR git commit failed & exit /b 1)

git -C "%ROOT%" tag %TAG%
if errorlevel 1 (echo ERR git tag failed & exit /b 1)

echo OK  Committed and tagged %TAG%

echo.
echo ^>^> Pushing to origin

git -C "%ROOT%" push origin %BRANCH%
if errorlevel 1 (echo ERR git push (branch) failed & exit /b 1)

git -C "%ROOT%" push origin %TAG%
if errorlevel 1 (echo ERR git push (tag) failed & exit /b 1)

echo OK  Pushed branch '%BRANCH%' and tag '%TAG%' to origin

echo.
echo   Released %TAG%
echo   GitHub Actions will now build all platforms and create the release.
echo   Track progress at: https://github.com/DonMischo/loreweaver/actions

endlocal
