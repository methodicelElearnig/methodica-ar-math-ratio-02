# methodica-math-ratio-02 — ביטוי יחס בדרכים שונות (יעד 1.2)

The 51-screen unit, in the client's multi-component structure.

## Where the split comes from

**The deck itself.** The storyboard (`../../storyboard/מתמטיקה יחס יעד 1.2 11082026_מוכן להפקה.pptx`,
67 slides — kept outside the repo) carries a "רכיב N" separator slide before each component, and
those five slides — 2, 27, 35, 45 and 54 — are the boundaries:

| | screens | deck slides | |
|---|---|---|---|
| 01 | 0–13  | 3–26  | הקנייה ותרגול מונחה |
| 02 | 14–20 | 28–34 | תרגול סטנדרטי |
| 03 | 21–29 | 36–44 | תרגול בסיסי וסטנדרטי ב |
| 04 | 30–37 | 46–53 | תרגול מתקדם |
| 05 | 38–50 | 55–67 | שאלת שיא |

Every component opens on its own transition screen, which is what the deck's separators describe — a
good independent check that the split is right.

⚠️ Component 05 ends one screen short of what its deck range suggests: the producer cut the finale
screen (was 51) on 08.09.26, so s50 ends the unit. `finishUnit()` keys off `PART_CONFIG.end`, not a
screen number — any screen added here must extend `end`, or the unit's `completed` moves with it.

## Layout

- `index.html` — redirects to component 01, **carrying the query string** (the platform's `?slxapi`
  and `?registration` launch parameters; without them reporting and resume are dead).
- `methodica-math-ratio-02-01 … -05/` — five component apps
  (`index.html` + `script.js` + `assets/`). No stylesheet and no fonts of their own; `assets/` holds
  only what that component's **own** markup names.
- `unit-js/` — the shared layer, one copy for the unit. `main.js` is the approved engine plus this
  unit's screen logic; the numbered files are the 720 platform layer. See `unit-js/README.md`.
- `unit-css/styles.css` — **one** stylesheet for the whole unit, linked by every component as
  `../unit-css/styles.css?v=N`. It used to be five byte-identical copies with nothing asserting they
  matched.
- `unit-assets/` — everything the shared layer names: `fonts/` (7 Assistant faces), `img/` (the 8
  character poses), `img/hint/` (the click-hint SVGs), `video/` (the two finale clips, unreferenced since the
  finale screen was cut).

### The asset invariant

> **Shared code references only shared assets; a component's own markup references only its own.**
>
> `unit-js/*.js` and `unit-css/styles.css` reach assets as `../unit-assets/…` and never as
> `assets/…`. A component's `index.html` reaches assets as `assets/…` and never reaches up.

`main.js` is **one file executed from five different folders**, so a bare `assets/…` literal in it
resolves to a different file per component — and to nothing at all in the components that do not
hold it. Before the hoist the `CHARACTER_ASSETS` table named `baker`/`headphones` assets that
existed only in `-01` and `peak` assets that existed only in `-05`, and it worked purely because
`CHAR_SCREENS` happened to map pose → screen → owning component correctly. Nothing enforced it.

Component 01 keeps `assets/video/character-{1,2}-selection.mp4`: screen 0's cards are named by its
own `index.html`, not by shared code. That is the invariant working, not an exception to it.

`_test/verify-report.js` §10 (*asset contract*) enforces both halves, in both directions, and is
mutation-tested against seven ways of breaking them. ⚠️ **`unit-css/` and `unit-assets/` are
shipped**, as siblings of the component folders — unlike `_test/` and `docs-and-tools/`. A package
that omits them is a unit with no stylesheet and no fonts. See `unit-js/README.md`.
- `metadata/` — unit + per-component JSONs: 1 unit, 5 components, 16 items, 43 questions. Extracted
  from the deck and normalised to the shape live Kata accepts. ⚠️ **Not yet pushed** — see *Known
  content issues*.
- `_test/` — headless regression harness, 939 + 58 assertions across two suites. **Never shipped**,
  including its stub library — the allowlist excludes it twice over, by name and by the
  leading-underscore rule. See its README for what each suite covers, and
  [`Documentation/GITHUB-GH.md`](../../../Documentation/GITHUB-GH.md) for how to run them:
  jsdom must be installed **outside** this OneDrive-synced folder, and a POSIX `NODE_PATH` only
  works when Git Bash is what launches node.
- `docs-and-tools/` — Kata metadata push/pull and the state-document QA pages. **Never shipped.**

## Identity

```
prefix     https://lomdot.education.gov.il/metodica/720active/math/ratio/02/
unit       <prefix>methodica-math-ratio-02/
component  <prefix>methodica-math-ratio-02-0N/
item       <prefix>methodica-math-ratio-02-0N/methodica-math-ratio-02-0N-00M/
```

Trailing slashes at unit, component and item level. ⚠️ Everything in this repo was previously slugged
`methodica-math-ratio-01-02`, which is **byte-identical to ratio-01's component 02 id** — pushing that
metadata would have `PATCH`ed a live ratio-01 component, because `send-metadata.ps1` derives Kata's
`uniqueKey` from the last path segment. Do not reintroduce it.

## Deviations, deliberate

1. **The approved engine moves in whole**, shared from `unit-js/main.js`, rather than being rewritten
   onto ratio-01's per-part hook contract. Rewriting a 51-screen build onto a second navigation layer
   would risk behaviour the client has signed off. The platform layer is therefore **grafted onto**
   `main.js`'s `goTo` rather than replacing it — `unit-js/30-nav.js` and `25-report.js` are
   deliberately **not** vendored. `unit-js/README.md` says exactly which files were taken and why.
2. **Screens keep the unit's global numbering** (0–50), as in the ratio-01 reference. `TOTAL_SCREENS`
   is 51 unit-wide and each component's DOM holds only its own slice.
3. Each `script.js` holds **only** that component's `PART_CONFIG` and xAPI identity; all behaviour is
   shared.

## The platform owns routing (2026-09-16)

**Kata decides what the learner does next.** It launches each component on its own URL —
`POST /api/v1/launcher/context` takes a *component* key and returns a per-component `launchUrl`
and `registrationId` — reads our `completed` statements, and routes on the catalogue
(`recommendedAfterFail`, `isRequired`, order). The spec pairs two sentences (v2.7 p.23): *"כאשר
נשלח completed עבור רכיב תוכן, הפלטפורמה מסירה את הרכיב מהמסך"*, so `completed` only *"לאחר סיום
מלא של הרכיב, לרבות הצגת משוב"*.

Until this date the unit routed itself: `goTo(n)` past `PART_CONFIG.end` called `leaveToPart`
(report → `writeForwardState` → `location.replace`), `goTo(n)` below `PART_CONFIG.start` called
`goBackToPreviousPart`, and the loader hopped to the saved part on load. **That was a live
reporting defect, not only an ownership question**: Kata's `registration` is per *component*, and
every hop appended `window.location.search`, so a learner walking the unit from 01 reported every
part under part 01's registration and saved every part's resume slot into part 01's state blob.

| | before | after |
|---|---|---|
| `leaveToPart` (last screen, parts 01–04) | `xapiCompleteComponent` → `writeForwardState` → `location.replace` | `xapiEndComponent(res, lastScreenButton())` — report, then the button **disables itself**. No new text. |
| `finishUnit` ("סיימתי", part 05) | component `completed` **+ unit `completed`** (a mean of the component scores) | component `completed` only, button disabled. `unitResult()` deleted; `UNIT_SCORE_KEYS` / `recordPartResult` stay as the per-component record |
| the first screen's "חזרה" (`.scq-back`, parts 02–05) | `goBackToPreviousPart` → previous component | **hidden** by `hideCrossPartBack()` (`90-boot.js`); the function returns at once |
| loader phase A | `location.replace` to `_saved.part` | **removed** — the part Kata launched is the part shown, its own slot restored |
| unit-level statements | `initialized` (01 `onXapiReady`) and `completed` (05) with `{ scope: 'unit' }` | **none**; `xapiCompleteUnit` deleted. `XAPI_UNIT_ID` stays — the State document is keyed on it |
| `goToNextPart()` | a second handover entry point, uncalled | deleted |

The navigation code is not deleted. It runs only under **`DEV_NAV`** (`unit-js/10-identity.js`):
`?dev=1` in the URL **and no `?registration`**. Every Kata launch URL carries a registration, so a
launch URL with `&dev=1` appended still behaves as production; navigation is possible only on a
page nobody's learning is recorded on — the local walkthrough and `index_dev.html`, whose harness
flag in the loader now reads `DEV_NAV` too. Inside `leaveToPart` the pointer write and the hop sit
in one `if (DEV_NAV) { … }`; the `completed` never depends on the flag.

`completed` was already the learner's **last click** in every component here — the last screen's
check/continue button (`lastScreenButton()`) — so nothing had to be re-ordered, unlike
`mass-measure-02` and `scale-01`.

Asserted by `_test/verify-report.js` (`routing`, `devnav`) and `_test/statement-flow.js` (`seam`:
production `leaveToPart` reports once with a result, moves no pointer, seeds nothing, records no
edge, disables the button; under `?dev=1` the old handover still works; part 05's finale sends
one component `completed` and nothing unit-scoped). **Not observed:** Kata removing a component
on `completed` — our content never let it happen. If Kata does not act, the learner sees a
disabled button and nothing else; visible on the first integration run.

## Known content issues

Found while mapping screens to catalogue items; all need the מפתחת / producer, none block the code.

1. **The deck has a ratio-order inversion that the code already fixed.** Commit `3348fd5`
   (*"QA fixes and entire project numbers got reveresed - FIXED"*) corrected the code; the deck was
   not corrected, and `metadata/` was extracted from the uncorrected deck. Two confirmed cases:
   - Slide 10 / item `-02-01-002` q2 — 9 pop songs of 36. The question asks pop : total, i.e.
     **1 : 4**. The deck and the metadata say `4 : 1`; the code says `1 : 4`.
   - Slides 19–20 / item `-02-01-003` q1 — sugar 25 g, cream 200 g. Slide 20 narrates the ratio as
     `200 : 25` and concludes the "8 : 1" claim is true; sugar : cream is `25 : 200` = 1 : 8. The code
     marks `25 : 200` correct. The deck contradicts itself here independently of this repo.
2. **Item `-02-01-002` q1 is a mis-extraction** — slide 7 is a select-all-that-apply where all four
   representations are correct; the metadata turned one option into a standalone `true-false` keyed
   "לא נכון".
3. **The unit title is corrected here and still wrong in the deck.** The extraction carried
   `זיהוי מצבי יחס`, which is **ratio-01's** title and is in fact this unit's נושא, not its יעד. The
   correct title is **`ביטוי יחס בדרכים שונות`** (content owner, 2026-09-04) and it is what
   `metadata/`, the root README and every `<title>` now use. ⚠️ The storyboard and
   `../../metadata-src/` still carry the wrong one — re-extracting or re-copying from either will
   reintroduce it.

Consequence: the runtime never reads `correctAnswers`, so **reporting is unaffected** — items and
questions resolve by id, not by answer key. Issues 1 and 2 are content defects in the catalogue
record, not in the lomda.

## Catalogue state

**Pushed to Kata 2026-09-04** — 1 unit + 5 components + 16 items + 43 questions, `created=22
updated=1 failed=0`, and read back with `retrieve-metadata.ps1` to confirm title, subTopic,
learningObjective and every item/question count round-trip.

⚠️ **It carries the two known-wrong answer keys above** (issues 1 and 2). That was a deliberate
call — get the catalogue objects in place so reporting has something real to point at, and correct
the content afterwards.

Re-pushing after a fix is safe: `send-metadata.ps1` **upserts** (GET by `uniqueKey`, then PATCH if
present, POST if not), so it can be run as often as needed and will update in place rather than
duplicate.

> On reading `metadata-from/` back: `retrieve-metadata.ps1` **reconstructs** id URLs from its
> `-IdBase` and trims the trailing slash, so retrieved ids look like `…/methodica-math-ratio-02-01`
> against our `…/methodica-math-ratio-02-01/`. That is the script's formatting, not a difference in
> what Kata stores — Kata keys on `uniqueKey`, the last path segment with slashes trimmed. Do not
> "fix" `metadata/` to match a retrieval.

## `learningObjective`

`metadata/` carries `MOE.MATH.G8.NUM.RATIO-PROP-SCL.RATIO.ALG-EXPR`. The code **exists** in Kata
under this unit's subTopic `MOE.MATH.G8.NUM.RATIO-PROP-SCL.RATIO`, and it is what the extraction
chose for יעד 1.2 — *לבטא יחס בדרכים שונות*.

⚠️ **`GET /api/v1/objectives` is PAGED.** A single response is not the whole list. Reading one page
as complete produced a confident, wrong conclusion here once — that the subTopic had "exactly three"
objectives and that ratio-01's `.RECOG` therefore did not exist. `.RECOG` is valid, and ratio-01's
use of it was settled correctly in that project. **Page to the end before concluding a code is
absent**, and do not change this unit's code on the strength of a partial listing.

Not established here: whether `.ALG-EXPR` is the *best* of the available objectives for this unit,
as opposed to a valid one. Its catalogue gloss reads *לבטא יחס באמצעות ביטויים אלגבריים*, while this
unit teaches expressing a ratio as a fraction, verbally and as a number pair. That is a question for
the מפתחת, and it needs the full objective list to answer.

## Deployments

`deployments/` sits **outside** this repo, beside `git-repo/`, and is not version-controlled.
`git status` here will never mention it and `git checkout` can never bring it back — which is why
the tooling below exists.

### Build and verify with the tools, not by hand

Three PowerShell 7 scripts in `docs-and-tools/`, byte-identical to
`methodica-math-ratio-01`'s — both units have had the same shape since the 2026-09-07 asset hoist,
so one definition covers both:

| script | what it is |
|---|---|
| `package-allowlist.ps1` | the **single** definition of what ships. Dot-sourced by the other two; not runnable alone. |
| `build-package.ps1` | cuts a package containing exactly that, then verifies its own output |
| `verify-package.ps1` | asserts an existing package **is** exactly that, at any later date |

```bash
pwsh -File docs-and-tools/build-package.ps1 -DryRun    # what ships, and what does not
pwsh -File docs-and-tools/build-package.ps1            # cut today's package
pwsh -File docs-and-tools/verify-package.ps1           # re-check the newest package, any time
```

Both tools read the one allowlist, so a package cannot be built to one definition and checked
against another. `verify-package.ps1` exits 0/1 and runs four checks: **FORWARD** (every packaged
file byte-identical to the tree), **REVERSE** (every file the allowlist says should ship is
present), **HYGIENE** (no secret or dev file), **COMMIT** (tree clean, and no *shipped* file changed
since the commit `DEPLOY.md` names). REVERSE is the one a plain diff misses — a file *added* to the
tree after a package was cut is invisible to a forward-only comparison and ships as a 404.

Worth knowing before you run them:

- ⚠️ **Allowlist, never denylist.** `docs-and-tools/` holds `kata-api-key.txt`; one missing denylist
  entry would publish a live key. `-DryRun` prints the excluded set too — read that half, it is
  where a secret would hide if a rule were wrong. Here it correctly holds the key, every `.ps1`,
  `_test/`, `metadata-from/`, the five `index_dev.html` and the READMEs.
- The builder **refuses a dirty tree** (a package must be reproducible from a commit) and **refuses
  to overwrite a non-empty target without `-Force`**. `-Force` preserves `DEPLOY.md`, the one file
  in a package written by hand and not reproducible from the tree.
- `DEPLOY.md` must keep its ``commit **`<sha>`**`` line — `verify-package.ps1` parses the first such
  match to tell a current package from a stale one.

### Packages on disk

- **`2026-09-07/`** — current and the only one. 67 files, 8,335,946 bytes ≈ 8.34 MB, built by
  `build-package.ps1` from commit `dc41d94` and verified: 66/66 both directions, zero drift,
  **zero duplicate blobs**. Ships `unit-css/` and `unit-assets/` as siblings of the five component
  folders; no component carries a `styles.css` or an `assets/fonts/` any more. See its `DEPLOY.md`,
  which also records an earlier same-date package built against `3b09766`, before the asset hoist —
  never uploaded, replaced in place. If you hold a copy taken earlier that day, discard it.

**Nothing has been uploaded to the CDN**: every `math/ratio/02/…` path still returns HTTP 200 with
**0 bytes**, re-measured 2026-09-07 against a deliberately bogus path and a live control. That CDN
answers 200 for absent paths, so verify an upload by **byte size**, never by status code — and check
`unit-css/styles.css` and one file under `unit-assets/` specifically, since those are the two an
upload checklist written before the asset hoist would silently omit.
