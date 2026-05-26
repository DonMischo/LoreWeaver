# ─────────────────────────────────────────────────────────────────────────────
# Foliantica — release helper  (Windows PowerShell)
#
# Usage:
#   .\release.ps1           # bump patch  (1.2.3 -> 1.2.4)
#   .\release.ps1 minor     # bump minor  (1.2.3 -> 1.3.0)
#   .\release.ps1 major     # bump major  (1.2.3 -> 2.0.0)
# ─────────────────────────────────────────────────────────────────────────────
# Ensure Unicode output doesn't get mangled on Windows terminals (cp1252 default)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding            = [System.Text.Encoding]::UTF8

param(
    [ValidateSet("patch","minor","major")]
    [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "OK  $msg"  -ForegroundColor Green }
function Die($msg)  { Write-Host "ERR $msg"  -ForegroundColor Red; exit 1 }

# ── Sanity checks ─────────────────────────────────────────────────────────────
Step "Checking prerequisites"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git not found" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "node not found" }

# Must be on a branch (not detached HEAD)
$branch = git -C $Root rev-parse --abbrev-ref HEAD 2>&1
if ($LASTEXITCODE -ne 0) { Die "Not a git repository" }
if ($branch -eq "HEAD")  { Die "Detached HEAD — check out a branch first" }

# Working tree must be clean
$dirty = git -C $Root status --porcelain 2>&1
if ($dirty) {
    Write-Host "Uncommitted changes:" -ForegroundColor Yellow
    Write-Host $dirty
    Die "Working tree is dirty — commit or stash changes first"
}

Ok "On branch '$branch', working tree clean"

# ── Read current version from package.json ────────────────────────────────────
Step "Reading current version"

$pkgPath = Join-Path $Root "package.json"
$pkg     = Get-Content $pkgPath -Raw | ConvertFrom-Json
$current = $pkg.version

if ($current -notmatch '^\d+\.\d+\.\d+$') { Die "Unexpected version format: $current" }

$parts = $current -split '\.' | ForEach-Object { [int]$_ }
$major = $parts[0]; $minor = $parts[1]; $patch = $parts[2]

Ok "Current version: $current"

# ── Calculate next version ────────────────────────────────────────────────────
switch ($Bump) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" {           $minor++;   $patch = 0 }
    "patch" {                        $patch++  }
}

$next = "$major.$minor.$patch"
$tag  = "v$next"

Write-Host "`n  $current  -->  $next  (tag: $tag)" -ForegroundColor White

$confirm = Read-Host "`nProceed? [y/N]"
if ($confirm -notmatch '^[Yy]$') { Write-Host "Aborted." -ForegroundColor Yellow; exit 0 }

# ── Bump version in package.json ─────────────────────────────────────────────
Step "Updating package.json"

# Use node to rewrite JSON so formatting is preserved
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('$($pkgPath.Replace('\','\\\\'))'));
p.version = '$next';
fs.writeFileSync('$($pkgPath.Replace('\','\\\\'))', JSON.stringify(p, null, 2) + '\n');
"
if ($LASTEXITCODE -ne 0) { Die "Failed to update package.json" }

Ok "package.json -> $next"

# ── Commit + tag + push ───────────────────────────────────────────────────────
Step "Creating git commit and tag"

git -C $Root add package.json
if ($LASTEXITCODE -ne 0) { Die "git add failed" }

git -C $Root commit -m "chore: release $tag"
if ($LASTEXITCODE -ne 0) { Die "git commit failed" }

git -C $Root tag $tag
if ($LASTEXITCODE -ne 0) { Die "git tag failed" }

Ok "Committed and tagged $tag"

Step "Pushing to origin"

git -C $Root push origin $branch
if ($LASTEXITCODE -ne 0) { Die "git push (branch) failed" }

git -C $Root push origin $tag
if ($LASTEXITCODE -ne 0) { Die "git push (tag) failed" }

Ok "Pushed branch '$branch' and tag '$tag' to origin"

Write-Host ""
Write-Host "  Released $tag" -ForegroundColor Green
Write-Host "  GitHub Actions will now build all platforms and create the release." -ForegroundColor White
Write-Host "  Track progress at: https://github.com/DonMischo/foliantica/actions" -ForegroundColor White
