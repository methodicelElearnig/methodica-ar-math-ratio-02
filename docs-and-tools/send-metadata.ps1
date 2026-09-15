#Requires -Version 7.0
<#
.SYNOPSIS
    Send the metadata/ folder (1 unit + 6 components + 25 items) to the Kata
    (Katalog) catalog API at https://kata.cet.ac.il/api/v1.

.DESCRIPTION
    Walks the metadata tree top-down and UPSERTS each entity (GET by uniqueKey ->
    PATCH if it exists, else POST). Transforms the on-disk metadata into the API
    payloads, filling in required fields the metadata lacks (from the CONFIG block
    below) and remapping values that fall outside the API enums.

    Runtime: PowerShell 7+ and curl.exe (bundled with Windows 10/11).

    SAFETY: never hard-code the API key here — this script is committed. Supply it via
    -ApiKey, $env:KATA_API_KEY, or the git-ignored kata-api-key.txt next to this script
    (see SEND-METADATA.md). The script refuses to run without one and never logs it.

.PARAMETER DryRun
    Build and print every payload WITHOUT any network call. No key required.

.PARAMETER ApiKey
    The Kata API key. Overrides $env:KATA_API_KEY and kata-api-key.txt.

.PARAMETER BaseUrl
    Override the API base URL (default https://kata.cet.ac.il).

.PARAMETER MetadataDir
    Override the metadata folder (default: the metadata/ folder at the repo root, one
    level up from this script's docs-and-tools/ home).

.EXAMPLE
    pwsh -File docs-and-tools/send-metadata.ps1 -DryRun
.EXAMPLE
    pwsh -File docs-and-tools/send-metadata.ps1
#>
[CmdletBinding()]
param(
    [switch] $DryRun,
    [string] $ApiKey,
    [string] $BaseUrl,
    [string] $MetadataDir
)

# ============================================================================
#  CONFIG  — edit these before running
# ----------------------------------------------------------------------------
#  REUSE GUIDE — running this for a DIFFERENT unit? Touch only what applies:
#    (1) ALWAYS: set the API key, and point $MetadataDir at the unit's folder.
#    (2) PER-UNIT: usually fine as-is (title language, manufacture, overrides).
#    (3) CONTENT VOCABULARY: adjust ONLY for a different subject or new metadata
#        values — the cognitiveLevel codes (subject-specific!) and the small
#        value-mapping tables. If the metadata contains a value not covered here,
#        the script STOPS with a clear message naming it, so you know what to add.
#    (4) 720 STANDARD ENUMS: rarely change — they mirror the KATA spec.
#  Sections are ordered (1)->(4) below.
# ============================================================================

# ── (1) PER-RUN / ENVIRONMENT — always check ────────────────────────────────
# API key from Kata -> "מפתחות API" (/api-credentials).
# NEVER hard-code it here — this script is committed. It is resolved at runtime, in
# order, from: the -ApiKey parameter, the KATA_API_KEY environment variable, or the
# git-ignored key file below (one line, just the key). See SEND-METADATA.md.
$ApiKeyFile = Join-Path $PSScriptRoot 'kata-api-key.txt'
# API base URL (override at launch with -BaseUrl).
if (-not $BaseUrl) { $BaseUrl = 'https://kata.cet.ac.il' }
# Metadata folder to send (override with -MetadataDir). This script lives in
# docs-and-tools/, so the default sits one level up, at the repo root.
if (-not $MetadataDir) { $MetadataDir = Join-Path $PSScriptRoot '..\metadata' }
# Run log (git-ignored by name).
$LogFile = Join-Path $PSScriptRoot 'send-metadata.log'

# ── (2) PER-UNIT — usually fine as-is ───────────────────────────────────────
# Title language key: wraps a string title into the API object, e.g.
#   "מדידת מסה" -> { "Hebrew": "מדידת מסה" }. Change only for non-Hebrew content.
$TitleLangKey = 'Hebrew'
# NOTE: there is no $UnitManufacture any more. 720 v2.5 renamed the field to
# `manufacturer` and moved it to the unit, and KATA does not accept it on any endpoint —
# the owning provider is derived from the API key. See New-UnitBody.
# Fallback depthLevel — used ONLY if a component's metadata omits it (components
# normally carry their own relativeDifficulty / depthLevel / cognitiveLevel).
$DefaultDepthLevel = 'core-curriculum-basic'
# Optional per-component overrides, keyed by uniqueKey (URL slug). An override
# WINS over the metadata value; unlisted components use their metadata value.
#   e.g. 'methodica-science-mass-measure-02-05' = @{ relativeDifficulty = 4; depthLevel = 'core-curriculum-advanced' }
$ComponentOverrides = @{
}

# ── (3) CONTENT VOCABULARY — ADJUST PER UNIT / SUBJECT ───────────────────────
# These translate values found in the metadata into what KATA accepts. This is
# THE section to review when reusing. Unmapped/invalid values -> the script stops
# and names the offender (see Map-Enum / New-ComponentBody).
#
# Since metadata v2.3 the metadata files store the SAME kebab-case vocabulary the
# API uses, so these maps are only needed for legacy values left over from the
# pre-v2.3 files. Everything else passes through and is checked against the
# $Valid* lists in section (4).

# 3a. componentPurpose: metadata value -> API enum (see $ValidComponentPurpose).
$ComponentPurposeMap = @{
    'assessment' = 'practice'   # an assessment component (isAssessment already flags it)
}
# 3b. contentType (items): metadata value -> API enum (see $ValidContentType).
#     Both keys are pre-v2.3 spellings; current metadata needs no mapping.
$ContentTypeMap = @{
    'ClassroomTask' = 'project-or-inquiry-task'
    'Assessment'    = 'practice'
}
# 3c. cognitiveLevel: metadata value -> official MOE code — SUBJECT-SPECIFIC.
#     KATA validates against GET /api/v1/cognitive-levels. The codes turned out to
#     be kebab-case slugs identical to what the metadata stores, so this map only
#     translates the pre-v2.3 Title Case labels. $ValidCognitiveLevel below holds
#     every code KATA has, across both disciplines, so reuse needs no edit.
$CognitiveLevelMap = @{
    'Identifying'                    = 'identifying'                    # זיהוי
    'Describing'                     = 'describing'                     # תיאור
    'Retrieving Information'         = 'retrieving-information'          # איתור מידע
    'Providing Examples'             = 'providing-examples'              # מתן דוגמאות
    'Making Connections'             = 'making-connections'              # קישור
    'Interpreting'                   = 'interpreting'                    # פירוש
    'Applying a Model or Procedure'  = 'applying-a-model-or-procedure'   # שימוש במודל או בפרוצדורה
    'Explaining'                     = 'explaining'                      # הסבר
    'Providing Scientific Reasoning' = 'providing-scientific-reasoning'   # הנמקה מדעית — NOT in KATA yet
    'Analyzing'                      = 'analyzing'                       # ניתוח — NOT in KATA yet
    'Synthesizing'                   = 'synthesizing'                    # סינתזה — NOT in KATA yet
    'Evaluating and Justifying'      = 'evaluating-and-justifying'        # הערכה והצדקה — NOT in KATA yet
}
# The codes KATA actually holds — VERIFIED live against GET /api/v1/cognitive-levels on
# 2026-08-16: 16 codes, 12 `science` plus 4 `mathematics`.
#
# THIS UNIT IS SCIENCE, so the twelve `science` codes are the relevant ones; the four
# mathematics codes are retained because the endpoint accepts them and a shared or
# cross-subject unit could use them. Reusing this script for a mathematics unit needs no
# edit here — only the comment about which set is in play.
#
# All 12 science levels from 720 v2.2 pp.17-18 are live. An older note in this script's
# lineage claimed only 8 were loaded and that `analyzing` / `evaluating-and-justifying`
# would 422; that is stale — this unit uses both and they are confirmed present.
$ValidCognitiveLevel = @(
    # science — used by this unit
    'identifying'
    'describing'
    'retrieving-information'
    'providing-examples'
    'making-connections'
    'interpreting'
    'applying-a-model-or-procedure'
    'explaining'
    'analyzing'
    'synthesizing'
    'evaluating-and-justifying'
    'providing-scientific-reasoning'
    # mathematics — retained for cross-subject reuse. Note the word order of
    # 'interpretation-and-reasoning' (NOT 'reasoning-and-interpretation').
    'algorithmic-thinking'
    'process-thinking'
    'interpretation-and-reasoning'
    'knowledge-and-recall'
)
# Spec levels that exist in 720 but are NOT loaded in KATA — used only to give a clearer
# error than "unmapped value" when the metadata legitimately uses one. Empty as of the
# 2026-08-16 check. Kept as a mechanism: if a future spec level is not yet loaded, list it
# here to get an explanatory message instead of a bare "unknown value".
$PendingCognitiveLevel = @()

# ── (4) 720 STANDARD ENUMS — rarely change (mirror the KATA spec) ────────────
# Used to fail fast on any value that maps outside the standard vocabulary.
# NOTE: these are kebab-case, matching what the live API returns and accepts. Any
# Title Case "Controlled Vocabularies" table in older notes is stale — the API neither
# returns nor accepts that form. Only cognitive-levels and skills have list endpoints;
# the rest were confirmed against the published sibling unit (see SEND-METADATA.md).
$ValidComponentPurpose = @('instruction','practice','both')
$ValidContentType      = @('instruction','practice','project-or-inquiry-task','educational-game','reading-text','simulation','motivational','solved-exercise','summary')
$ValidMediaFormat      = @('text','image','audio','video','animation','interactive-content','presentation')
# depthLevel is a plain enum (720 v2.2 p.16), not a coded taxonomy.
$ValidDepthLevel       = @('core-curriculum-basic','core-curriculum-advanced','core-curriculum-enrichment','non-core-basic','non-core-advanced','non-core-enrichment')
# masteryLevel (720 v2.2) — this unit's metadata sets it per component. It was previously dropped
# on the floor: the payload never carried it, so the values never reached the catalog.
$ValidMasteryLevel     = @('basic','intermediate','advanced')
# Unit audience vocabularies. These were previously forwarded unvalidated, so a bad value only
# surfaced as a 422 from the live API — after the unit had already been created.
$ValidTargetSector     = @('state-general','state-religious','orthodox','arab-sector','druze-sector','bedouin-sector','special-education')
$ValidTargetAudience   = @('general','excellent','disadvantaged-populations','new-immigrants','students-with-special-needs','students-with-language-gaps','at-risk-students')

# ============================================================================
#  End of CONFIG
# ============================================================================

$ErrorActionPreference = 'Stop'
$script:counts = @{ created = 0; updated = 0; failed = 0 }

function Write-Log {
    param([string] $Message, [string] $Level = 'INFO')
    $line = "[{0}] {1}" -f $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Get-Slug {
    param([string] $Url)
    # Trim any trailing slash(es) first so a URL like ".../foo/" yields "foo", not "".
    return (($Url.TrimEnd('/')) -split '/')[-1]
}

# Percent-encode a key for a query string. Component and item keys are full IRIs (720
# v2.5 p.11), so they contain '/' and CANNOT travel in a URL path segment — the server
# decodes %2F before routing, which is why the old /components/{key} routes 404 on them.
# In a query parameter %2F is ordinary data. See Documentation/KATA/KATA-API.md.
function Enc {
    param([string] $Value)
    return [uri]::EscapeDataString($Value)
}

# -ApiKey > $env:KATA_API_KEY > the git-ignored key file. Returns '' if none is set.
function Resolve-ApiKey {
    if ($ApiKey)            { return $ApiKey.Trim() }
    if ($env:KATA_API_KEY)  { return $env:KATA_API_KEY.Trim() }
    if (Test-Path $ApiKeyFile) {
        return ((Get-Content -Raw -Path $ApiKeyFile -Encoding UTF8) -replace '\s', '')
    }
    return ''
}

function Map-Enum {
    param([string] $Value, [hashtable] $Map, [string[]] $Valid, [string] $FieldName, [string] $Where)
    $mapped = if ($Map.ContainsKey($Value)) { $Map[$Value] } else { $Value }
    if ($Valid -notcontains $mapped) {
        throw "Unmapped $FieldName value '$Value' at $Where — add it to the enum map or fix the metadata."
    }
    return $mapped
}

function Remove-Key {
    param([System.Collections.Specialized.OrderedDictionary] $Dict, [string] $Key)
    $copy = [ordered]@{}
    foreach ($k in $Dict.Keys) { if ($k -ne $Key) { $copy[$k] = $Dict[$k] } }
    return $copy
}

function Invoke-Kata {
    param([string] $Method, [string] $Path, $Body)
    $url = "$BaseUrl$Path"

    if ($DryRun) {
        Write-Log "DRY-RUN $Method $url"
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 12
            Write-Host $json
        }
        return @{ Code = '000'; Body = '(dry-run)' }
    }

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $curlArgs = @('-sS', '-X', $Method, $url, '-H', "X-API-Key: $ApiKey")
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 12
            [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
            $curlArgs += @('-H', 'Content-Type: application/json; charset=utf-8', '--data-binary', "@$tmp")
        }
        $curlArgs += @('-w', '\n%{http_code}')

        $raw = (& curl.exe @curlArgs 2>&1 | Out-String)
        $text = ($raw -replace "`r", '').TrimEnd("`n")
        $idx  = $text.LastIndexOf("`n")
        if ($idx -ge 0) {
            $code = $text.Substring($idx + 1).Trim()
            $bodyText = $text.Substring(0, $idx)
        } else {
            $code = $text.Trim()
            $bodyText = ''
        }
        return @{ Code = $code; Body = $bodyText }
    }
    finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

function Test-Exists {
    param([string] $Path)
    if ($DryRun) { return $false }
    $code = (& curl.exe -s -o NUL -w '%{http_code}' -X GET "$BaseUrl$Path" -H "X-API-Key: $ApiKey")
    return ($code -eq '200')
}

# Upsert one entity. Returns $true on success (so children may proceed).
function Send-Entity {
    param(
        [string] $Label,
        [string] $GetPath,
        [string] $CreateMethod,
        [string] $CreatePath,
        $CreateBody,
        [string] $PatchPath,
        $PatchBody
    )
    $exists = Test-Exists $GetPath
    if ($exists) {
        $r = Invoke-Kata 'PATCH' $PatchPath $PatchBody
        $action = 'UPDATED'
    } else {
        $r = Invoke-Kata $CreateMethod $CreatePath $CreateBody
        $action = 'CREATED'
    }

    $ok = $DryRun -or ($r.Code -match '^2\d\d$')
    if ($ok) {
        if ($action -eq 'UPDATED') { $script:counts.updated++ } else { $script:counts.created++ }
        Write-Log ("{0,-7} {1} (HTTP {2})" -f $action, $Label, $r.Code)
    } else {
        $script:counts.failed++
        $snippet = ($r.Body -replace '\s+', ' ')
        if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
        Write-Log ("FAILED  {0} — {1} {2} (HTTP {3}) {4}" -f $Label, $CreateMethod, $CreatePath, $r.Code, $snippet) 'ERROR'
    }
    return $ok
}

# ---- Payload builders -------------------------------------------------------

function New-UnitBody {
    param($Unit)

    # uniqueKey comes from the last path segment of the unit id. Guard against an id that stops at
    # the unit FOLDER (".../scale/01/"), which would silently key the unit as "01" and collide with
    # every other unit numbered 01.
    $unitKey = Get-Slug $Unit.id
    if ($unitKey -notmatch '^methodica-') {
        throw ("Unit uniqueKey resolves to '$unitKey' from id '$($Unit.id)' — expected a slug like " +
               "'methodica-science-mass-measure-02'. The unit id must end with the unit slug, not the folder number.")
    }

    # targetSectors / targetAudience: validated rather than forwarded blind.
    # 720 v2.5 renamed targetSector -> targetSectors (still a list) and made
    # targetAudience a SINGLE value. KATA's ContentUnitCreate declares exactly that.
    foreach ($v in @($Unit.targetSectors)) {
        if ($ValidTargetSector -notcontains $v) {
            throw "Invalid targetSectors value '$v' on the unit — expected one of: $($ValidTargetSector -join ', ')."
        }
    }
    if ($ValidTargetAudience -notcontains $Unit.targetAudience) {
        throw ("Invalid targetAudience '$($Unit.targetAudience)' on the unit — expected ONE of: " +
               "$($ValidTargetAudience -join ', '). v2.5 makes this a single value, not a list.")
    }

    # 720 v2.5 / KATA ContentUnitCreate. Fields deliberately NOT sent:
    #
    #   prerequisiteLearningObjective — dropped in v2.5; dependencies now live on the
    #     learning objective, not on the content.
    #   manufacture / manufacturer — KATA derives the owning provider from the API key.
    #     The numeric `manufacturer` in the unit metadata is a 720 catalogue field with
    #     no KATA counterpart.
    #   subTopic — ⚠️ DO NOT SEND for a standard unit. It IS in the OpenAPI schema, which
    #     makes it look safe, but the server enforces a rule the schema does not express:
    #     POST returns 422 `"a standard unit must not have a subTopic"`. For a standard
    #     unit KATA derives the subTopic from the learningObjective's classificationPath;
    #     only a `kind: "summary"` unit — one that covers a whole subTopic and therefore
    #     tags no single objective (720 v2.4 p.3) — carries it explicitly. Adding it here
    #     on the strength of the schema alone cost one failed push on 03.09.26.
    return [ordered]@{
        uniqueKey         = $unitKey
        title             = [ordered]@{ $TitleLangKey = $Unit.title }
        learningObjective = $Unit.learningObjective
        targetSectors     = @($Unit.targetSectors)
        targetAudience    = $Unit.targetAudience
    }
}

function New-ComponentBody {
    param($Comp)
    $slug = Get-Slug $Comp.id
    $ov   = if ($ComponentOverrides.ContainsKey($slug)) { $ComponentOverrides[$slug] } else { @{} }

    # relativeDifficulty: override > metadata value > (last resort) component order.
    $relDiff = if ($ov.ContainsKey('relativeDifficulty')) { $ov.relativeDifficulty }
               elseif ($null -ne $Comp.relativeDifficulty)  { $Comp.relativeDifficulty }
               else { $Comp.order }

    # depthLevel: override > metadata value > fallback. Validated against the enum.
    $depth = if ($ov.ContainsKey('depthLevel')) { $ov.depthLevel }
             elseif ($Comp.depthLevel)          { $Comp.depthLevel }
             else { $DefaultDepthLevel }
    if ($ValidDepthLevel -notcontains $depth) {
        throw "Invalid depthLevel '$depth' at $slug — expected one of: $($ValidDepthLevel -join ', ')."
    }

    # cognitiveLevel: override wins; otherwise the metadata value already IS the MOE
    # code (kebab-case), and $CognitiveLevelMap only rewrites pre-v2.3 labels.
    if ($ov.ContainsKey('cognitiveLevel')) {
        $cog = $ov.cognitiveLevel
    } else {
        # v2.5: the metadata field is cognitiveLevelS, a list. This unit tags exactly one
        # level per component, and KATA takes a list, so read the first and re-wrap below.
        $label = @($Comp.cognitiveLevels)[0]
        $cog   = if ($CognitiveLevelMap.ContainsKey($label)) { $CognitiveLevelMap[$label] } else { $label }
        if ($PendingCognitiveLevel -contains $cog) {
            throw ("cognitiveLevel '$cog' ($slug) is a 720 spec level that KATA has NOT loaded yet — it would fail " +
                   'with 422 "cognitiveLevel code does not exist". Re-check GET /api/v1/cognitive-levels; once the ' +
                   'code appears, move it from $PendingCognitiveLevel into $ValidCognitiveLevel and re-run. Meanwhile ' +
                   'either pick a released level in the metadata, or set an override in $ComponentOverrides.')
        }
        if ($ValidCognitiveLevel -notcontains $cog) {
            throw ("Unknown cognitiveLevel '$label' at $slug — not one of the codes KATA holds for this subject: " +
                   "$($ValidCognitiveLevel -join ', '). Check GET /api/v1/cognitive-levels.")
        }
    }

    $purpose = Map-Enum $Comp.componentPurpose $ComponentPurposeMap $ValidComponentPurpose 'componentPurpose' $slug

    # masteryLevel: optional in the metadata, but when present it must reach the catalog — this
    # field used to be silently dropped. Absent stays absent rather than being defaulted.
    $mastery = $null
    if ($null -ne $Comp.masteryLevel -and "$($Comp.masteryLevel)".Trim() -ne '') {
        $mastery = $ValidMasteryLevel | Where-Object { $_ -ieq $Comp.masteryLevel } | Select-Object -First 1
        if (-not $mastery) {
            throw "Invalid masteryLevel '$($Comp.masteryLevel)' at $slug — expected one of: $($ValidMasteryLevel -join ', ')."
        }
    }

    # NOTE: recommendedAfterFail is intentionally NOT set here. Those references can
    # point to components created later in the run (e.g. part 01 -> part 02), which
    # KATA rejects at create time ("... is not a component"). It's applied in a
    # separate PATCH pass after every component exists — see the Main section.

    $body = [ordered]@{
        # The full IRI, verbatim from metadata/ — NOT $slug. 720 v2.5 p.11 requires the
        # catalogue row itself to carry an IRI, and Kata reports `identifier_not_iri` on
        # any key that is a bare slug. $slug remains the lookup key for overrides above.
        uniqueKey              = $Comp.id
        title                  = $Comp.title
        componentPurpose       = $purpose
        isAssessment           = [bool] $Comp.isAssessment
        isRequired             = [bool] $Comp.isRequired
        relativeDifficulty     = [int] $relDiff
        order                  = [int] $Comp.order
        depthLevel             = $depth
        cognitiveLevels        = @($cog)
        languages              = @($Comp.languages)
        skills                 = @($Comp.skills)
        estimatedTimeInMinutes = [int] $Comp.estimatedTimeInMinutes
        # "כתובת תוכן מתארח" — the component's hosted URL (folder + /index.html).
        hostedContentRef       = ($Comp.id.TrimEnd('/')) + '/index.html'
    }
    if ($mastery) { $body.masteryLevel = $mastery }
    return $body
}

function New-ItemBody {
    param($Item, [int] $Order)
    $slug = Get-Slug $Item.id
    $contentType = Map-Enum $Item.contentType $ContentTypeMap $ValidContentType 'contentType' $slug
    # Canonicalize mediaFormat casing to the exact API enum value. The API is
    # case-SENSITIVE ('Interactive-Content' -> 422), but PowerShell -contains is
    # case-insensitive, so match case-insensitively and send the canonical form.
    $mediaFormat = $ValidMediaFormat | Where-Object { $_ -ieq $Item.mediaFormat } | Select-Object -First 1
    if (-not $mediaFormat) {
        throw "Invalid mediaFormat '$($Item.mediaFormat)' at $slug — expected one of: $($ValidMediaFormat -join ', ')."
    }
    $body = [ordered]@{
        # The full IRI, verbatim from metadata/ — see the note in New-ComponentBody.
        # $slug is kept above only for the enum error messages.
        uniqueKey        = $Item.id
        title            = $Item.title
        informationToBot = $Item.informationToBot
        contentType      = $contentType
        mediaFormat      = $mediaFormat
        order            = $Order
    }
    if ($null -ne $Item.questions -and @($Item.questions).Count -gt 0) {
        $body.questions = @($Item.questions)
    }
    return $body
}

# ---- Main -------------------------------------------------------------------

# Fresh log per run.
$modeLabel = if ($DryRun) { 'DRY-RUN (no network)' } else { 'LIVE' }
Set-Content -Path $LogFile -Value ("=== send-metadata {0} ===" -f $modeLabel) -Encoding UTF8

$ApiKey = Resolve-ApiKey
if (-not $DryRun -and -not $ApiKey) {
    Write-Log ("API key not set. Pass -ApiKey, set `$env:KATA_API_KEY, or put the key on one line in " +
               "$ApiKeyFile (get it from /api-credentials). Or run with -DryRun.") 'ERROR'
    exit 1
}
if (-not (Test-Path $MetadataDir)) {
    Write-Log "Metadata folder not found: $MetadataDir" 'ERROR'
    exit 1
}

Write-Log ("Base URL     : {0}" -f $BaseUrl)
Write-Log ("Metadata dir : {0}" -f $MetadataDir)
Write-Log ("Mode         : {0}" -f $modeLabel)

# 1) Unit
$unitFile = Get-ChildItem -Path $MetadataDir -Filter '*_unit.json' | Select-Object -First 1
if (-not $unitFile) { Write-Log "No *_unit.json found in $MetadataDir" 'ERROR'; exit 1 }
$unit = Get-Content -Raw -Path $unitFile.FullName -Encoding UTF8 | ConvertFrom-Json
$unitKey = Get-Slug $unit.id

$unitBody  = New-UnitBody $unit
$unitPatch = Remove-Key $unitBody 'uniqueKey'
$unitOk = Send-Entity -Label "unit $unitKey" `
    -GetPath "/api/v1/content-units/$unitKey" `
    -CreateMethod 'POST' -CreatePath '/api/v1/content-units' -CreateBody $unitBody `
    -PatchPath "/api/v1/content-units/$unitKey" -PatchBody $unitPatch

if (-not $unitOk) {
    Write-Log "Unit upsert failed — skipping components (cannot nest under a missing unit)." 'ERROR'
} else {
    # 2) Components (sorted by order), then 3) their items
    $compFiles = Get-ChildItem -Path $MetadataDir -Filter '*.json' |
        Where-Object { $_.Name -notlike '*_unit.json' }
    $comps = foreach ($f in $compFiles) {
        Get-Content -Raw -Path $f.FullName -Encoding UTF8 | ConvertFrom-Json
    }
    $comps = $comps | Sort-Object { [int] $_.order }

    foreach ($comp in $comps) {
        $compKey   = Get-Slug $comp.id
        $compBody  = New-ComponentBody $comp
        $compPatch = Remove-Key $compBody 'uniqueKey'
        $compOk = Send-Entity -Label "component $compKey" `
            -GetPath "/api/v1/components/$compKey" `
            -CreateMethod 'POST' -CreatePath "/api/v1/content-units/$unitKey/components" -CreateBody $compBody `
            -PatchPath "/api/v1/components/$compKey" -PatchBody $compPatch

        if (-not $compOk) {
            Write-Log "Component $compKey failed — skipping its items." 'ERROR'
            continue
        }

        $order = 0
        foreach ($item in @($comp.subContent)) {
            $order++
            $itemKey   = Get-Slug $item.id
            $itemBody  = New-ItemBody $item $order
            $itemPatch = Remove-Key $itemBody 'uniqueKey'
            [void] (Send-Entity -Label "item $itemKey" `
                -GetPath "/api/v1/components/$compKey/items/$itemKey" `
                -CreateMethod 'POST' -CreatePath "/api/v1/components/$compKey/items" -CreateBody $itemBody `
                -PatchPath "/api/v1/components/$compKey/items/$itemKey" -PatchBody $itemPatch)
        }
    }

    # 4) recommendedAfterFail — second pass, now that every component exists so
    #    forward references (e.g. part 01 -> part 02) resolve.
    $slugToIri = @{}
    foreach ($c in $comps) { $slugToIri[(Get-Slug $c.id)] = $c.id }

    foreach ($comp in $comps) {
        if (-not $comp.recommendedAfterFail) { continue }
        $compSlug = Get-Slug $comp.id
        $compEnc  = Enc $comp.id
        # A reference is a component KEY, so it must now be that component's IRI. This unit
        # stores these as bare slugs in metadata/ (other units store full IRIs), so resolve
        # either shape against the component ids rather than assuming one.
        $keys = @($comp.recommendedAfterFail | ForEach-Object {
            $s = Get-Slug ([string] $_)
            if ($slugToIri.ContainsKey($s)) { $slugToIri[$s] }
            else { Write-Log ("recommendedAfterFail on {0} names '{1}', not a component of this unit" -f $compSlug, $_) 'ERROR'; [string] $_ }
        })
        $r = Invoke-Kata 'PATCH' "/api/v1/component?componentKey=$compEnc" ([ordered]@{ recommendedAfterFail = $keys })
        if ($DryRun -or ($r.Code -match '^2\d\d$')) {
            $script:counts.updated++
            Write-Log ("LINKED  component {0} recommendedAfterFail -> [{1}] (HTTP {2})" -f $compSlug, (($keys | ForEach-Object { Get-Slug $_ }) -join ', '), $r.Code)
        } else {
            $script:counts.failed++
            $snippet = ($r.Body -replace '\s+', ' ')
            if ($snippet.Length -gt 400) { $snippet = $snippet.Substring(0, 400) + '…' }
            Write-Log ("FAILED  recommendedAfterFail on {0} (HTTP {1}) {2}" -f $compSlug, $r.Code, $snippet) 'ERROR'
        }
    }
}

Write-Log ("Done. created={0} updated={1} failed={2}" -f $script:counts.created, $script:counts.updated, $script:counts.failed)
if ($script:counts.failed -gt 0) { exit 1 }
