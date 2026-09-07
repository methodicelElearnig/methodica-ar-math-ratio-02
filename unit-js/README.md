# `unit-js/` — the shared layer

One copy of every behaviour shared by the **five** components of this unit.

It is two things that must not be confused:

| | |
|---|---|
| **`main.js`** | The approved engine **plus this unit's entire screen logic** — `TOTAL_SCREENS`, `currentScreen`, `goTo`, `scaleApp`, `resetScreenState`, every `sNN*` handler, the `Q`/`MCQ`/`SCQ`/`GSTEPS` registries, the report dialog. Each component's `script.js` holds only that component's config. |
| **the numbered files** | The 720 **platform** layer — xAPI reporting and resume — vendored from `methodica-math-ratio-01`, which is the reference implementation. |

Companions:
[`ADDING-REPORTING-AND-RESUME.md`](../../../Documentation/reporting-and-resume/ADDING-REPORTING-AND-RESUME.md)
— the authoritative guide ·
[`KNOWN-ISSUE-dismissal-state-write.md`](../../../Documentation/reporting-and-resume/KNOWN-ISSUE-dismissal-state-write.md)
— open, accepted, **do not "fix"**

MOE standard: **metadata v2.5**, **xAPI v2.4**.

---

## Load order

Every part's `index.html` opens with the unit stylesheet and ends with exactly this:

```html
<link rel="stylesheet" href="../unit-css/styles.css?v=2">   <!-- in <head>, one for the unit -->
…
<script src="../unit-js/10-identity.js?v=1"></script>
<script src="../unit-js/20-xapi.js?v=1"></script>
<script src="../unit-js/40-resume.js?v=1"></script>
<script src="../unit-js/50-loader.js?v=1"></script>
<script src="script.js?v=2"></script>              <!-- per-part: CONFIG ONLY -->
<script src="../unit-js/main.js?v=3"></script>     <!-- engine + screen logic + hooks -->
<script src="../unit-js/90-boot.js?v=1"></script>  <!-- the ONLY side effects -->
```

Three positions carry weight: **`script.js` before `main.js`** (main.js reads `window.PART_CONFIG`
at load, on its `currentScreen` line), **`main.js` before `90-boot.js`**, and **`90-boot.js` last**.
The order among `10-`–`50-` is nearly arbitrary, because those four are definition-only.

> **`?v=` invariant.** All five `index.html` reference the same shared URLs — the stylesheet
> included — so a given shared file's `?v=` **must be identical in all five**. A mismatch means one
> part fetches a second copy under a different URL, and two parts can execute different versions of
> the same logic inside one learner session. ⚠️ A change to `RESUME_STATE_VERSION` must bump
> `40-resume.js`, `main.js` **and** every `script.js` in the same commit.
>
> ⚠️ **Bump `main.js` whenever its contents change**, even when its URL does not. It is the one
> shared file whose path never moves, so it is the one a warm cache can silently keep. That is why
> the `../unit-assets/` hoist bumped it to `?v=3`: a cached `?v=2` would look for character images at
> paths that no longer exist and render blank `<img>` with no error.

The 720 xAPI library is **not** in this repo. `50-loader.js` fetches it at runtime from
`https://lomdot.education.gov.il/metodica/720active/common/`, choosing `xapi-720-k.js` because
`RESUME_ENABLED` is true (`-i` is the non-State build). It is a **shared, cross-unit** file: never
ship a copy, and treat any change to it as affecting every 720 lomda.

⚠️ `window.XAPI_USING_G` is derived from that filename by the regex `/xapi-720-[ghijk]\.js/`, and it
gates **all item-level statements and all video reporting**. Changing the library letter without
adding it to the regex silences them with no error. Change both in one edit.

---

## What was vendored, and what was not

ratio-01 keeps screen logic in six ~3,100-line per-part `script.js` files over a ten-file shared
layer. This unit keeps *all* screen logic in one shared `main.js`. So the platform layer is
**grafted onto `main.js`**, not substituted for it — `main.js` remains the owner of navigation.

### Vendored (4 files)

`10-identity.js` · `20-xapi.js` · `40-resume.js` · `50-loader.js`

Near-verbatim. The per-unit seams are: `XAPI_ID_PREFIX` and `window.XAPI_UNIT_ID`
(`10-identity.js`), and `UI_CHARACTER_KEY`, `RESULT_KEYS` and `NAV_EDGE_KEY` (`40-resume.js`).

⚠️ **`UI_CHARACTER_KEY` must equal `CHARACTER_STORAGE_KEY` in `main.js`.** They name the same
cache; if they drift, the character is written under one key and read under another, which reads as
"the character keeps resetting".

⚠️ **`NAV_EDGE_KEY` must carry the unit slug.** Two units sharing it share a ledger and silently
suppress each other's reports.

### Not vendored (5 files) — `main.js` already has an equivalent

| Not taken | Because |
|---|---|
| `30-nav.js` | `main.js` owns `goTo`/`currentScreen`. Adopting it would collide (a loud `SyntaxError` — both use `let`) and would mean re-implementing this unit's `PART_CONFIG` bounds, popup clearing and dev bridge. Its xAPI/resume seams are grafted into `main.js`'s `goTo` instead; `applyExecutionState` is reimplemented there. |
| `25-report.js` | It needs DOM this unit does not have: `#report-type-wrapper`, `#report-type-error`, `#report-text-error`, `#report-thanks-modal`, `.report-custom-select`, `.report-select-btn`, `.report-select-list`, `.report-select-option`, `.report-select-value`, `.required-star`. This unit has a native `<select id="report-type">`, one `#report-error` and an inline `#report-thanks`. Adopting it means rewriting the dialog markup in five `index.html` **and** the CSS in `unit-css/styles.css` for no learner-visible gain. |
| `15-ui.js` | `main.js` has this unit's own `scaleApp()` — a 1280×710 `Math.min` fit with `left:0`, which is what the client signed off; ratio-01's is a different fluid variant. Its image zoom is also already in `main.js`. Only `announce()` was taken, and it lives in `main.js`. |
| `28-feedback-drag.js` | `main.js` has `mcqPopupPointerDown`/`clampPopupPosition`/`getAppScale`. Skipping it also removes ratio-01's most fragile boot constraint (it wraps `window.goTo` and must be the last thing to do so). |
| `60-devbridge.js` | `main.js` has its own `DEV_GOTO`/`DEV_READY` bridge. ⚠️ Do not add a second one — in ratio-01 two copies were once live at the same time and `DEV_READY` was posted twice with conflicting totals. |

`REPORT_FORM_ACTION` is **not** a deviation: one Google Form serves all of 720, by the content
owner's decision of 2026-08-13. Rows are disambiguated by the unit-slug and component-slug fields,
both read from `window.METADATA`. Do not create a per-unit form and do not rename a field key.

---

## The contract `main.js` and `script.js` must satisfy

The shared files read these at **call** time, never at load time — which is what lets `main.js`
load *after* them.

### Per component, in `script.js`

| Name | Read by |
|---|---|
| `window.PART_CONFIG` `{start, end, next, prev}` | `main.js`'s `goTo`, `goToNextPart` |
| `XAPI_COMP_SLUG`, `XAPI_COMP_ID` | `xapiItemId`, `xapiQ` |
| `XAPI_METADATA_FILE` | `bootXAPI` — **required**; without it reporting disables itself and says so |
| `SCREEN_TO_SUBCONTENT` | `xapiOnScreen`, `submitReport`. ⚠️ Covers **this part's `[start..end]` only** |
| `XAPI_EVAL_ITEMS` | `xapiOnScreen`, `xapiFinishItems` |
| `XAPI_ITEM_RESULT` | `xapiItemResult` — optional, derived from `XAPI_EVAL_ITEMS` |
| `onXapiReady()` | `50-loader.js` — **part 01 only**; emits the unit `initialized` |

### Unit-wide, in `main.js`

The engine: `TOTAL_SCREENS` (52) · `currentScreen` · `goTo(n)` · `scaleApp()` ·
`resetScreenState(n)` · `announce(msg)` · `initReportModal()` · `goToNextPart()`

Resume: `capturePartPayload()` · `applyResumeVars(st)` · `applyResumeDom(st)` ·
`restoreScreenUI(n)` · `applyExecutionState(st, screenOverride)` · `partBoot()` · `leaveToPart()` ·
`finishUnit()`

Scoring: `screenWasCorrect(sid)` · `itemResultFor(item)` · `partResult()` · `unitResult()` ·
`recordPartResult(res)` · `UNIT_SCORE_KEYS`

Reporting: `XAPI_QMAP` · `xapiKeyFor(key)` · `xapiScreenKey(sid)` · `xapiReport(key, correct,
answer)` · `xapiHint(sid)` · `xapiReportQScreen(...)` · `xapiReportAiTable(...)`

### Why `goTo` has no repaint sandwich

The reference's `goTo` snapshots the payload, lets `resetScreenState` wipe the screen, then
re-applies and repaints — because there `sNNEnter()` is a pure initialiser. **Here it is not:**
`resetQuestionOnEntry()` early-returns on a finished question and `restoreFeedback()` re-opens its
popup, so an answered screen already survives in-part navigation. The painters are needed only
after a page **load**, where the DOM is pristine markup and every done flag is false, and
`applyExecutionState()` drives them there. Three seams are grafted into `goTo` instead:
`xapiOnScreen(n)`, `scheduleResumeSave()`, and the two part edges.

### The reporting map is not screen-to-question

Neither side is one-to-one. `s24` carries two catalogue questions behind one check button, `s26`
three and `s28` two — each reports separately, from `qCheck`'s per-input verdicts. The AI table is
the opposite: part 04's item `002/q1` is **one** question spread over screens 33/34/35, so
`xapiReportAiTable()` reports it once, on the third row, with the AND. `'answered.last'` is derived
from the item's question count in the metadata, never hardcoded.

⚠️ **`applyResumeVars`'s parameter must stay named `st`.** It runs `eval(k + ' = st.vars[k];')`,
which resolves `st` lexically. Renaming it fails **silently**: the assignment throws, the
surrounding `try/catch` swallows it, and the learner's answers quietly vanish. Nothing enforces it
but `_test/`.

⚠️ **The hooks must live in `main.js`, not in a file of their own** — that same `eval` resolves the
answer variables lexically too, and they are top-level `let`/`const` of `main.js`.

---

## Two rules, because failures here are silent

**1. No identifier may be declared at top level in both a numbered file and `main.js`.** A
`let`/`const` collision is a loud `SyntaxError`, but a **`var`/`function` collision is a silent
last-wins overwrite** — and `main.js` loads *after* the numbered files, so a leftover copy in
`main.js` wins and the port looks successful while running the wrong code. This bit once already:
`main.js` carried its own `shortId` that omitted the trailing-slash trim, so it returned `''` for
every canonical id. Check from the repo root:

```bash
node -e "const fs=require('fs');const s=new Map();fs.readdirSync('unit-js').filter(f=>/^\d/.test(f)&&f.endsWith('.js')).forEach(f=>fs.readFileSync('unit-js/'+f,'utf8').split('\n').forEach(l=>{const m=l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);if(m)s.set(m[1],f)}));const h=[];fs.readFileSync('unit-js/main.js','utf8').split('\n').forEach((l,i)=>{const m=l.match(/^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/);if(m&&s.has(m[1]))h.push(m[1]+'@'+(i+1)+' (also '+s.get(m[1])+')')});console.log(h.length?h.join('\n'):'clean')"
```

The same trap applies to a **seam** that is not a collision: `SCREEN_TO_SUBCONTENT` is declared per
component in `script.js`, and a shared copy in `main.js` would load afterwards and overwrite the
real one. It was removed from `main.js` for exactly that reason.

**2. Lowercase everything** — folder names, cross-part paths, storage keys. The state document's key
comes from `location.pathname` via `currentPartSlug()`, so a URL differing only in case produces a
second key for the same part: split progress, a `done` ledger that misses, and therefore a duplicate
`completed`. `currentPartSlug()` is defensive (`.toLowerCase()`), but the paths must be right anyway
— on a case-sensitive host a mixed-case cross-part link simply 404s.

---

## Why the boot order is explicit

`90-boot.js` is the only file here with top-level side effects. Its order is load-bearing and is
documented in the file. The short version: `initResumeResetHatch()` first (it rewrites the URL),
`scaleApp()` before anything measures `#app`, the character seed before `partBoot()`, `partBoot()`
before `bootXAPI()`, and **`bootXAPI()` last** — it may `window.location.replace()` to another
component, and nothing after it would run.

⚠️ `90-boot.js` must stay a **separate script tag**. A top-level throw in `main.js` kills the rest of
that file with no console error, which in this family once left the report modal uninitialised.

### The boot cover

`#boot-cover` sits in all five `index.html` as a **sibling of `#app`, immediately before it** — not
a child, because `#app` carries `scaleApp`'s transform and a child would inherit it and stop
covering the viewport. It is inline-**styled** so a stale CSS cache cannot leave it invisible, and
removed by an inline **script** that depends on no JS file at all, so a `40-resume.js` that failed to
load cannot leave a learner facing a blank page. The failsafe waits on `window.__resumeInFlight` up
to a hard **11000 ms** — calibrated, because `50-loader.js`'s metadata poll allows 10 s by itself on
top of two serial CDN scripts, and an earlier 6 s ceiling lifted the cover mid-restore.

---

## Files

| File | Purpose |
|---|---|
| `10-identity.js` | The unit's canonical id prefix, unit id, `shortId()`, `RESUME_ENABLED`. The main per-unit seam. |
| `20-xapi.js` | Item scope, question-id resolution from metadata, every statement-building call-site helper. |
| `40-resume.js` | The v5 state document, the four ledgers, unit-level state, cross-part edges, boot cover, reset hatch. |
| `50-loader.js` | `bootXAPI()` — CDN load, three gates, capped metadata poll, two-phase resume, component `initialized`. |
| `90-boot.js` | The only file with top-level side effects. Fixed startup order. |
| `main.js` | The approved engine and this unit's screen logic, plus the resume hooks and the report dialog. |

## Sibling unit-level folders

`unit-css/styles.css` is **one** stylesheet for the whole unit; every component links it as
`../unit-css/styles.css?v=N`. `unit-assets/` holds everything this shared layer names —
`fonts/` (the 7 Assistant faces), `img/` (the 8 character poses), `img/hint/`, `video/` (the two
finale clips).

⚠️ The `@font-face` `url()` resolve from **the stylesheet's own directory**, `unit-css/`, not from
the component page that links it. That is why they are `../unit-assets/fonts/…` with **one** `../`.
Two is the classic bug: ratio-01 shipped six stylesheets pointing a level too high and rendered the
whole unit in a fallback typeface with no error anywhere.

**The asset invariant:** shared code (`unit-js/*.js`, `unit-css/styles.css`) references only
`../unit-assets/`; a component's own `index.html` references only `assets/`, inside itself.
`main.js` is one file executed from five folders, so a bare `assets/…` literal in it resolves to a
different file per component. `_test/verify-report.js` §10 enforces this in both directions.

**Never ship**: `index_dev.html`, `README.md`, `_test/` (**including its stub library** — it shares a
basename with the real one by design), `docs-and-tools/`, or `.git/`.

⚠️ **Do ship `unit-css/` and `unit-assets/`**, as siblings of the five component folders — the same
level as `unit-js/`. A package built from a stale allowlist that omits them is a unit with no
stylesheet and no fonts, and the CDN answers 200 with 0 bytes for paths that do not exist, so a
status check will not tell you. Verify an upload by **byte size**.

### None of that is yours to remember any more

What ships is defined in **`docs-and-tools/package-allowlist.ps1`** and enforced by two scripts that
both read it, so a package cannot be built to one definition and checked against another:

```bash
pwsh -File docs-and-tools/build-package.ps1 -DryRun    # what ships, and what does not
pwsh -File docs-and-tools/build-package.ps1            # cut today's package
pwsh -File docs-and-tools/verify-package.ps1           # re-check any package, any time
```

Do not hand-copy a package, and do not keep a second copy of the rules anywhere — including in this
file. The lists above are a description; the allowlist is the definition. If they ever disagree, the
allowlist is right and this paragraph is stale.

⚠️ One thing that specifically concerns **this** layer: **`unit-js/*.js` ships, its `README.md` does
not.** The allowlist takes `unit-js/*.js` and nothing else from this folder, which is why the file
you are reading never reaches the CDN — and why `main.js`, at 129,363 B, is by a wide margin the
largest single thing in the shared layer that does (`40-resume.js` is next, at 32,548 B).

The full rundown — the four checks, the refusals, why `-Force` preserves `DEPLOY.md` — is in the
root `README.md` under *Deployments*.

**Deploy all five parts atomically** — together with `unit-js/`, `unit-css/` and `unit-assets/` —
and roll back the same way: a part left on an older state-document version beside v5 parts writes a
document the others discard and rewrite — a reset loop that wipes the `done` ledger each cycle and
re-sends `completed` every time.
