# Sending metadata to the Kata catalog

`send-metadata.ps1` pushes the repo-root `metadata/` folder (1 unit + 6 components +
25 items) into the Katalog (Kata) catalog at `https://kata.cet.ac.il/api/v1`.
It **upserts**: for each entity it does a `GET` by uniqueKey, then `PATCH` if it
already exists or `POST` if it doesn't — so it's safe to run more than once.

The script lives in `docs-and-tools/` and resolves `../metadata` by default, so it is
run from the repo root.

## Requirements

- **PowerShell 7+** (`pwsh`). The script declares `#Requires -Version 7.0` and will
  not run on Windows PowerShell 5.1 (needed for correct array + UTF-8 JSON handling).
- **curl.exe** — bundled with Windows 10/11.

## One-time setup

Get an API key from the Kata UI → **מפתחות API** (`/api-credentials`), then make it
available in any **one** of these ways — the script checks them in this order:

1. `-ApiKey '<key>'` on the command line.
2. The `KATA_API_KEY` environment variable.
3. **`docs-and-tools/kata-api-key.txt`** — next to the script, one line, just the key.
   This is the usual choice; the file is git-ignored.

```powershell
# option 3, once — from the repo root:
'<your-key>' | Set-Content docs-and-tools\kata-api-key.txt -NoNewline
```

Outside `-DryRun` the script refuses to run when no key is found. The key is never
written to the log, and both scripts share the same file.

> **Never hard-code a key in the scripts** — unlike before, `send-metadata.ps1` and
> `retrieve-metadata.ps1` are committed. `kata-api-key.txt` is the only place a live key
> may sit on disk, and `.gitignore` excludes it.

## Usage

Run from the **repo root**, and from native PowerShell — Git Bash garbles the Hebrew in
the console output (the data itself is fine).

```powershell
# 1) Dry run — builds and prints every payload, no network, no key needed.
pwsh -File docs-and-tools\send-metadata.ps1 -DryRun

# 2) Live run — after setting up the key (see above).
pwsh -File docs-and-tools\send-metadata.ps1

# Optional overrides:
pwsh -File docs-and-tools\send-metadata.ps1 -BaseUrl 'https://kata.cet.ac.il' -MetadataDir '.\metadata'
```

A clean dry run for this unit reports `created=32 updated=1 failed=0` and exits 0 —
1 unit + 6 components + 25 items, plus one `LINKED` line for part `-02`'s
`recommendedAfterFail`.

Progress prints to the console and to `send-metadata.log` (git-ignored). Each line is
`CREATED` / `UPDATED` / `FAILED` with the HTTP status; the run ends with a
`created / updated / failed` summary and a non-zero exit code if anything failed.

## What the script does to the metadata

The metadata schema doesn't match the API 1:1, so the script transforms it. All of
this is controlled from the **CONFIG** block at the top of the file.

| Metadata | Sent to API |
|---|---|
| `id` (full URL) | `uniqueKey` = last path segment (slug), e.g. `methodica-science-mass-measure-02-01`. Trailing slashes are trimmed first, so `…/foo/` yields `foo`, not `""`. |
| unit `title` (string) | `title` object `{ "Hebrew": "…" }` (`$TitleLangKey`) |
| unit `subTopic` | **not sent.** The field is in `ContentUnitCreate`, but the server rejects it for a standard unit: `422 "a standard unit must not have a subTopic"`. KATA derives it from the learning objective; only a `kind: "summary"` unit sets it explicitly. Verified the hard way on 03.09.26 |
| unit `manufacturer` | **not sent.** 720 v2.5 renamed `manufacture` → `manufacturer` and moved it to the unit, but KATA accepts neither — the owning provider comes from the API key. The numeric value in the metadata is a 720 catalogue field with no KATA counterpart |
| unit `targetSectors` / `targetAudience` | validated against `$ValidTargetSector` / `$ValidTargetAudience` first — a bad value stops the run instead of 422-ing after the unit was already created. **v2.5 shapes:** `targetSectors` is a list; `targetAudience` is a **single value**, not a list |
| unit `prerequisiteLearningObjective` | **not sent** — removed by v2.5 and absent from `ContentUnitCreate`. Objective dependencies now live on the objective, not on the content |
| component `relativeDifficulty` / `depthLevel` / `cognitiveLevels` | read **from the metadata**. Precedence is `$ComponentOverrides` > metadata value > fallback (component `order` for `relativeDifficulty`, `$DefaultDepthLevel` for `depthLevel`). **v2.5:** the metadata field is `cognitiveLevels` (a list); the script reads its first entry, validates it, and sends it back as a one-element list — which is what `ComponentCreate` requires |
| component `masteryLevel` | forwarded when present and non-null; absent stays absent rather than being defaulted. (All six components in this unit are `null`, so no key is emitted.) |
| component `id` | `uniqueKey` only. `hostedContentRef` is built from `$ContentBaseUrl` in the CONFIG block and is **not** derived from the id — an id lives under `720active/` and the content is served from `720/`, so deriving one from the other wrote a launch URL that serves 0 bytes (fixed 2026-09-16). |
| component `manufacture` | dropped (owning group is derived from the API key) |
| component `recommendedAfterFail` | URLs reduced to component keys and applied in a **second pass** — see below |
| item — (no order) | `order` = 1-based position in `subContent[]` |
| `questions[]` | passed through unchanged |

### `recommendedAfterFail` is a second pass, not part of the create

These references can point at components created later in the same run, which KATA
rejects at create time (`"… is not a component"`). So `New-ComponentBody` deliberately
omits the field, and after every component exists the script issues one `PATCH` per
component that has any — logged as `LINKED`. Forward references are therefore fine.

### The unit slug is guarded

`New-UnitBody` throws if `uniqueKey` resolves to anything that isn't a `methodica-*`
slug. This catches a unit `id` that stops at the folder (`…/mass-measure/02/`), which
would otherwise key the unit as the bare string `"02"` and collide with every other
unit numbered 02 across every subject.

### Enums are kebab-case — no translation needed

Since the metadata was aligned to 720 v2.3 it stores the **same kebab-case vocabulary
the API uses** (`core-curriculum-basic`, `project-or-inquiry-task`,
`interactive-content`, `applying-a-model-or-procedure`, `state-general`, …). So values
pass straight through and are only *checked* against `$ValidContentType` /
`$ValidMediaFormat` / `$ValidDepthLevel` / `$ValidComponentPurpose` in CONFIG
section (4).

`$ComponentPurposeMap` / `$ContentTypeMap` / `$CognitiveLevelMap` now only rewrite
leftover **pre-v2.3** spellings (`ClassroomTask`, `Assessment`, `Analyzing`, …), which
current metadata no longer contains. Any value outside the API enums makes the script
**stop with an error** naming the offender rather than send bad data.

> ⚠️ **Watch for word-reversed spellings.** This unit's metadata was authored with
> `content-interactive` and `task-inquiry-or-project` — the right words in the wrong
> order. Both were corrected (2026-08-16) to `interactive-content` and
> `project-or-inquiry-task`. The `$Valid*` lists hold the live vocabulary, so a dry run
> names any such value rather than letting it 422 mid-push.

### How the vocabularies were verified

Only two of the controlled vocabularies have list endpoints. Checked 2026-08-16:

| Endpoint | Result |
|---|---|
| `GET /api/v1/cognitive-levels` | **200** — authoritative |
| `GET /api/v1/skills` | **200** |
| `media-formats`, `content-types`, `depth-levels`, `mastery-levels`, `component-purposes`, `target-sectors`, `target-audiences` | **404** — no list endpoint |

For the seven with no endpoint, the reference is the **already-published sibling unit**
`methodica-science-mass-measure-01`: `GET /api/v1/content-units/methodica-science-mass-measure-01`
returns values KATA has actually accepted for this same subject and series. That is what
confirmed `interactive-content` and `project-or-inquiry-task`.

### `cognitiveLevel` — all 12 science levels are live

KATA validates `cognitiveLevel` against a **per-discipline coded taxonomy**
(`GET /api/v1/cognitive-levels`). Those codes are kebab-case slugs **identical to what
the metadata stores**, so no mapping is required — the value passes through and is
checked against `$ValidCognitiveLevel`.

Verified live 2026-08-16: **16 codes — 12 `science` + 4 `mathematics`.** All 12 science
levels from 720 v2.2 pp.17-18 are loaded, so `$PendingCognitiveLevel` is **empty** and
nothing is blocked. What this unit uses:

| Component | `cognitiveLevel` |
|---|---|
| `-01`, `-02`, `-04` | `process-thinking` |
| `-03` | `algorithmic-thinking` |
| `-05`, `-06` | `interpretation-and-reasoning` |

(These are the `mathematics` codes, and the same three the deployed
`methodica-math-scale-01` uses — so they are known to be loaded in KATA.)

`$PendingCognitiveLevel` is retained as a mechanism: if a future spec level isn't loaded
in KATA yet, listing it there produces an explanatory error instead of a bare "unknown
value", and the fix is to move it into `$ValidCognitiveLevel` once released.

`depthLevel`, by contrast, is a **plain enum** (720 v2.2 p.16), not a coded taxonomy, and
is read straight from the metadata.

## Going the other way

[`retrieve-metadata.ps1`](retrieve-metadata.ps1) pulls a unit back out of the catalog
into `metadata-from/` at the repo root, in this same file format, so you can diff the
catalog against the repo:

```bash
git diff --no-index metadata metadata-from
```

## Assumptions to verify on the first live run

Two mappings are best-guesses and isolated to single config points, so a first-call
`422` is a one-line fix:

1. **`uniqueKey` = URL slug.** If the catalog wants the full URL or a different
   format, change `Get-Slug` / the uniqueKey logic. (`GET /api/v1/content/next-unique-key?entityType=…`
   shows the catalog's expected format.)
2. **Unit `title` is an object** `{ "Hebrew": "…" }`. If rejected, adjust the
   title builder in `New-UnitBody`.

`learningObjective` is **verified against the live index**:
`GET /api/v1/objectives/MOE.MATH.G8.NUM.RATIO-PROP-SCL.RATIO.RECOG` returns 200 with the
title *"התלמיד יזהה מצבים שבהם מופיע יחס (כגון: מתכון, מהירות נסיעה)"* — this unit's
יעד 1.1. So does `subTopic`.

> ⚠️ **`GET /api/v1/objectives` paginates, `limit` defaults to 50.** The index holds
> **123** objectives, and four (not three) sit under this unit's subTopic. A single
> unpaged call returns page 1 and looks like the whole catalogue — it is not. Use the
> per-code endpoint `/api/v1/objectives/{code}` to check one value, or pass
> `?limit=200&page=N` to walk the list.

(`prerequisiteLearningObjective` is no longer a concern here: v2.5 removed the field and
the script no longer sends it.)

## Verify the result

- `GET /api/v1/content-units/methodica-science-mass-measure-02` returns the unit with
  its components; spot-check `GET /api/v1/components/methodica-science-mass-measure-02-01`
  and one item.
- In the Kata UI: **יחידות תוכן** (`/author`).
- Re-run once — every entity should report `UPDATED` (not duplicated).
