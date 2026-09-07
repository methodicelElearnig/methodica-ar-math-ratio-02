#Requires -Version 7.0
<#
.SYNOPSIS
    Verify that a deployment package under ../../deployments/ still matches the working
    tree, byte for byte, and carries no secret or development file.

.DESCRIPTION
    A package is a hand-copied snapshot of the repo. Nothing re-cuts it when the tree
    moves on, so a package silently goes stale the moment a shipped file is committed.
    This script answers one question: is the package on disk still exactly this tree?

    Four checks, all of which must pass:

      1. FORWARD   every file in the package is byte-identical to the tree (MD5)
      2. REVERSE   every file the allowlist says should ship IS in the package
      3. HYGIENE   no secret or dev file reached the package
      4. COMMIT    the tree is clean, and its HEAD matches the commit DEPLOY.md names

    The REVERSE check is the one that matters most and the one a plain diff misses: a
    file ADDED to the tree after the package was cut is invisible to a forward-only
    comparison, and ships as a 404.

    ⚠️ THE ALLOWLIST BELOW IS THE SOURCE OF TRUTH for what ships. It is an allowlist,
    never a denylist, because docs-and-tools/ holds kata-api-key.txt — a denylist with
    one missing entry publishes a live API key. Change it here and nowhere else.

    Runtime: PowerShell 7+. No network, no writes: this script only reads.

.PARAMETER PackageDir
    The package to verify. Default: the newest dated folder under ../../deployments/.

.PARAMETER RepoRoot
    The working tree to compare against. Default: the repo root, one level up from
    this script's docs-and-tools/ home.

.PARAMETER Quiet
    Print only the verdict lines, not the per-file detail on failure.

.EXAMPLE
    pwsh -File docs-and-tools/verify-package.ps1
    Verify the newest package against the current tree.

.EXAMPLE
    pwsh -File docs-and-tools/verify-package.ps1 -PackageDir ../../deployments/2026-09-07
    Verify one specific package.

.OUTPUTS
    Exit code 0 if every check passed, 1 if any failed.
#>
[CmdletBinding()]
param(
    [string] $PackageDir,
    [string] $RepoRoot,
    [switch] $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================================
# THE ALLOWLIST — what a deployment package contains
# ============================================================================
# Read as: a repo-relative path ships if it matches one of these rules AND is not
# knocked out by an EXCLUDE rule. Both are applied to the whole path, not the name.

# Directories that never contribute a single file, whatever is inside them.
$ExcludeTopLevel = @('_test', 'docs-and-tools', 'metadata-from', '.git')

# File names that never ship, wherever they appear.
$ExcludeNames = @('index_dev.html', 'README.md', '.gitignore', '.gitattributes', '.DS_Store')

# Extensions that never ship.
$ExcludeExt = @('.ps1', '.log')

# Any path segment starting with an underscore is a SOURCE, not a deliverable —
# _test/ and assets/video/_source-originals/ both use this convention.
$ExcludeUnderscoreSegment = $true

# What each shipped area contributes.
$RootFiles    = @('index.html')          # the redirect into component 01
$UnitDirs     = @{
    'metadata'    = '*.json'             # unit + per-component catalogue records
    'unit-js'     = '*.js'               # the shared layer  (README.md excluded above)
    'unit-css'    = '*.css'              # the one stylesheet for the unit
    'unit-assets' = '*'                  # fonts, images, video shared by >1 component
}
# Inside a component folder: these files, plus everything under assets/.
$ComponentFiles = @('index.html', 'script.js', 'styles.css')
$ComponentGlob  = 'methodica-math-*-[0-9][0-9]'

# Hygiene: if any of these turn up INSIDE the package, the build is unsafe to upload.
$SecretPatterns = @('*key*', '*.ps1', '*.log', 'index_dev.html', 'README.md', '.git*', '_*')

# ============================================================================

function Resolve-Dir([string] $p, [string] $what) {
    if (-not (Test-Path -LiteralPath $p)) { throw "$what not found: $p" }
    (Resolve-Path -LiteralPath $p).Path
}

if (-not $RepoRoot) { $RepoRoot = Join-Path $PSScriptRoot '..' }
$RepoRoot = Resolve-Dir $RepoRoot 'Repo root'

if (-not $PackageDir) {
    $deployments = Join-Path $RepoRoot '..' '..' 'deployments'
    if (-not (Test-Path -LiteralPath $deployments)) { throw "No deployments/ folder at $deployments" }
    $newest = Get-ChildItem -LiteralPath $deployments -Directory |
              Sort-Object Name -Descending | Select-Object -First 1
    if (-not $newest) { throw "No package folders under $deployments" }
    $PackageDir = $newest.FullName
}
$PackageDir = Resolve-Dir $PackageDir 'Package'

function Get-RelPaths([string] $root) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Force |
        ForEach-Object { [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/') }
}

function Test-Ships([string] $rel) {
    $segs = $rel.Split('/')
    if ($segs[0] -in $ExcludeTopLevel)                     { return $false }
    if ($segs[-1] -in $ExcludeNames)                       { return $false }
    if ([IO.Path]::GetExtension($rel) -in $ExcludeExt)     { return $false }
    if ($ExcludeUnderscoreSegment -and ($segs | Where-Object { $_.StartsWith('_') })) { return $false }

    if ($segs.Count -eq 1) { return $segs[0] -in $RootFiles }

    if ($UnitDirs.ContainsKey($segs[0])) {
        $glob = $UnitDirs[$segs[0]]
        if ($glob -eq '*') { return $true }
        # a pattern applies to the immediate children only; unit-assets/ is the '*' case
        return ($segs.Count -eq 2 -and $segs[1] -like $glob)
    }

    if ($segs[0] -like $ComponentGlob) {
        if ($segs.Count -eq 2) { return $segs[1] -in $ComponentFiles }
        return ($segs[1] -eq 'assets')
    }
    return $false
}

function Get-Md5Map([string] $root, [string[]] $rels) {
    $m = @{}
    foreach ($r in $rels) {
        $f = Join-Path $root ($r -replace '/', [IO.Path]::DirectorySeparatorChar)
        $m[$r] = (Get-FileHash -LiteralPath $f -Algorithm MD5).Hash
    }
    $m
}

$sep = '-' * 72
Write-Host $sep
Write-Host "verify-package"
Write-Host "  tree    : $RepoRoot"
Write-Host "  package : $PackageDir"
Write-Host $sep

$problems = [System.Collections.Generic.List[string]]::new()

# ---- what the tree says should ship, and what the package actually holds ----
$treeAll  = Get-RelPaths $RepoRoot
$treeShip = @($treeAll | Where-Object { Test-Ships $_ } | Sort-Object)
$pkgAll   = @(Get-RelPaths $PackageDir | Sort-Object)
$pkgFiles = @($pkgAll | Where-Object { $_ -ne 'DEPLOY.md' })

# ---- 1 + 2. forward and reverse ----
$extra   = @($pkgFiles | Where-Object { $_ -notin $treeShip })
$missing = @($treeShip | Where-Object { $_ -notin $pkgFiles })
foreach ($e in $extra)   { $problems.Add("EXTRA in package, not shippable : $e") }
foreach ($m in $missing) { $problems.Add("MISSING from package            : $m") }

$common  = @($pkgFiles | Where-Object { $_ -in $treeShip })
$pkgMd5  = Get-Md5Map $PackageDir $common
$treeMd5 = Get-Md5Map $RepoRoot   $common
$drift   = @($common | Where-Object { $pkgMd5[$_] -ne $treeMd5[$_] })
foreach ($d in $drift) { $problems.Add("DRIFTED (package != tree)       : $d") }

$fwd = ($drift.Count -eq 0 -and $extra.Count -eq 0)
$rev = ($missing.Count -eq 0)
Write-Host ("  [{0}] FORWARD  {1} file(s) compared, {2} drifted, {3} extra" -f
    $(if ($fwd) { 'PASS' } else { 'FAIL' }), $common.Count, $drift.Count, $extra.Count)
Write-Host ("  [{0}] REVERSE  {1} shippable file(s) in tree, {2} missing from package" -f
    $(if ($rev) { 'PASS' } else { 'FAIL' }), $treeShip.Count, $missing.Count)

# ---- 3. hygiene ----
$hits = @()
foreach ($pat in $SecretPatterns) {
    $hits += @($pkgAll | Where-Object { $_.Split('/')[-1] -like $pat -or ($_.Split('/') | Where-Object { $_ -like $pat }) })
}
$hits = @($hits | Sort-Object -Unique | Where-Object { $_ -ne 'DEPLOY.md' })
foreach ($h in $hits) { $problems.Add("SECRET/DEV file in package      : $h") }
Write-Host ("  [{0}] HYGIENE  {1} secret/dev file(s) in package" -f
    $(if ($hits.Count -eq 0) { 'PASS' } else { 'FAIL' }), $hits.Count)

# ---- 4. commit provenance ----
$commitOk = $true
Push-Location $RepoRoot
try {
    $head  = (git rev-parse --short HEAD 2>$null)
    $dirty = @(git status --porcelain 2>$null)
    $deploy = Join-Path $PackageDir 'DEPLOY.md'
    $claimed = $null
    if (Test-Path -LiteralPath $deploy) {
        $m = [regex]::Match((Get-Content -LiteralPath $deploy -Raw), 'commit\s+\*\*`([0-9a-f]{7,40})`\*\*')
        if ($m.Success) { $claimed = $m.Groups[1].Value }
    }
    if ($dirty.Count -gt 0) {
        $problems.Add("WORKING TREE DIRTY              : $($dirty.Count) file(s) — the package cannot be reproduced from a commit")
        $commitOk = $false
    }
    $note = ''
    if (-not $claimed) {
        $problems.Add("DEPLOY.md names no build commit — cannot check provenance")
        $commitOk = $false
    } elseif ($head -notlike "$claimed*" -and $claimed -notlike "$head*") {
        # HEAD having moved is NOT staleness on its own. Commits that touch only
        # docs-and-tools/, _test/ or a README change nothing the package contains.
        # What matters is whether any SHIPPABLE file changed since the build commit.
        $since = @(git diff --name-only "$claimed..HEAD" 2>$null)
        if ($LASTEXITCODE -ne 0) {
            $problems.Add("COMMIT UNKNOWN                  : DEPLOY.md names $claimed, which this repo does not have")
            $commitOk = $false
        } else {
            $shippedSince = @($since | Where-Object { Test-Ships $_ })
            if ($shippedSince.Count -gt 0) {
                foreach ($f in $shippedSince) {
                    $problems.Add("CHANGED SINCE BUILD (ships)     : $f")
                }
                $commitOk = $false
            } else {
                $note = " — HEAD moved $($since.Count) file(s) since, none shipped"
            }
        }
    }
    Write-Host ("  [{0}] COMMIT   HEAD {1}, DEPLOY.md says {2}, {3} uncommitted change(s){4}" -f
        $(if ($commitOk) { 'PASS' } else { 'FAIL' }), $head, ($claimed ?? '—'), $dirty.Count, $note)
} finally { Pop-Location }

# ---- informational: duplication, the thing the 2026-09-07 hoist removed ----
# @() matters: Group-Object yields nothing when no blob repeats, and under StrictMode
# $null.Count throws rather than returning 0.
$byHash = @($pkgMd5.GetEnumerator() | Group-Object Value | Where-Object { $_.Count -gt 1 })
$bytes  = ($pkgFiles | ForEach-Object {
    (Get-Item -LiteralPath (Join-Path $PackageDir ($_ -replace '/', [IO.Path]::DirectorySeparatorChar))).Length
} | Measure-Object -Sum).Sum
Write-Host $sep
Write-Host ("  package  : {0} content file(s), {1:N0} bytes" -f $pkgFiles.Count, $bytes)
Write-Host ("  duplicate: {0} blob(s) appearing more than once" -f $byHash.Count)
if ($byHash.Count -gt 0 -and -not $Quiet) {
    foreach ($g in $byHash) { Write-Host ("             {0}" -f ($g.Group.Name -join ', ')) }
}

Write-Host $sep
if ($problems.Count -eq 0) {
    Write-Host "VERDICT: PASS — the package is exactly this tree." -ForegroundColor Green
    exit 0
}
Write-Host ("VERDICT: FAIL — {0} problem(s)." -f $problems.Count) -ForegroundColor Red
if (-not $Quiet) { foreach ($p in $problems) { Write-Host "  $p" } }
exit 1
