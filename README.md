# methodica-ar-math-ratio-02 — التعبير عن النسبة بطرق مختلفة (Arabic version of methodica-math-ratio-02, יעד 1.2)

The 51-screen unit, in the client's multi-component structure.

## Arabic version (29.09.26)

This repo is the **Arabic** copy of the Hebrew unit `methodica-math-ratio-02`. Learner-visible
text is Arabic; behaviour and layout are the Hebrew unit's. The rest of this README was written
for the Hebrew unit; where it names Hebrew text, the Arabic unit shows the translation.

- **Identity:** folders `methodica-ar-math-ratio-02-0N`, ids under
  `https://lomdot.education.gov.il/metodica/720/ar/math/ratio/02/`, storage keys with `-ar`
  (`unit-js/10-identity.js`, `unit-js/40-resume.js`). Content is served from `/720/ar/math/ratio/02`.
- **Kata:** there is no Arabic unit. `send-metadata.ps1` adds the five components to the Hebrew
  unit `methodica-math-ratio-02` in parent-unit mode. **Sent 29.09.26** (draft). Retrieve with the
  Hebrew key. See `docs-and-tools/SEND-METADATA.md`.
- **Metadata:** `metadata/` is the live Hebrew Kata record with Arabic text; the supplier's
  `metadata-ar/` is kept as delivered and not shipped. See
  `docs-and-tools/ar-metadata/AR-METADATA-REPORT.md`.
- **Review edits:** the translation pass added hint pills on 01 s16/s29 (reverted to Hebrew) and
  moved the bottom-bar hint / answers buttons (kept: the Hebrew positions do not fit the Arabic
  labels). See `docs-and-tools/AR-REVIEW-REVERTS.md`.
- **Open:** three images in part 05 still carry Hebrew text (`ticket-booth.jpg`, `concert-1.jpg`,
  `concert-6.jpg`); videos and character PNGs not checked for Hebrew; native Arabic review.

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
- `methodica-ar-math-ratio-02-01 … -05/` — five component apps
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
- `_test/` — headless regression harness, 1051 + 98 assertions across two suites. **Never shipped**,
  including its stub library — the allowlist excludes it twice over, by name and by the
  leading-underscore rule. See its README for what each suite covers, and
  [`Documentation/GITHUB-GH.md`](../../../Documentation/GITHUB-GH.md) for how to run them:
  jsdom must be installed **outside** this OneDrive-synced folder, and a POSIX `NODE_PATH` only
  works when Git Bash is what launches node.
- `docs-and-tools/` — Kata metadata push/pull and the state-document QA pages. **Never shipped.**

## Identity

```
prefix     https://lomdot.education.gov.il/metodica/720/ar/math/ratio/02/
unit       <prefix>methodica-ar-math-ratio-02/
component  <prefix>methodica-ar-math-ratio-02-0N/
item       <prefix>methodica-ar-math-ratio-02-0N/methodica-ar-math-ratio-02-0N-00M/
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
| unit-level statements | `initialized` (01 `onXapiReady`) and `completed` (05) with `{ scope: 'unit' }` | **none**; `xapiCompleteUnit` deleted. `XAPI_UNIT_ID` stays — it keys the localStorage fallback and matches the catalogue; Kata's State API never sees it |
| `goToNextPart()` | a second handover entry point, uncalled | deleted |

The navigation code is not deleted. It runs only under **`DEV_NAV`** (`unit-js/10-identity.js`):
`?dev=1` in the URL **and no `?registration`**. Every Kata launch URL carries a registration, so a
launch URL with `&dev=1` appended still behaves as production; navigation is possible only on a
page nobody's learning is recorded on — the local walkthrough and `index_dev.html`, whose harness
flag in the loader now reads `DEV_NAV` too. Inside `leaveToPart` the pointer write and the hop sit
in one `if (DEV_NAV) { … }`; the `completed` never depends on the flag.

`completed` was already the learner's **last click** in every component here — the last screen's
check/continue button (`lastScreenButton()`) — so nothing had to be re-ordered, unlike
`mass-measure-02` and `scale-01`. (Since the set gate below, component 03 has a *second*, earlier
last click: s24's, for a learner who did not clear set B.)

Asserted by `_test/verify-report.js` (`routing`, `devnav`) and `_test/statement-flow.js` (`seam`:
production `leaveToPart` reports once with a result, moves no pointer, seeds nothing, records no
edge, disables the button; under `?dev=1` the old handover still works; part 05's finale sends
one component `completed` and nothing unit-scoped). **Not observed:** Kata removing a component
on `completed` — our content never let it happen. If Kata does not act, the learner sees a
disabled button and nothing else; visible on the first integration run.

### The set gate (2026-09-17)

s21 promises `ענו נכון על 2 שאלות ומעלה כדי להתקדם` over set B (s22, s23, s24). Nothing enforced
it: `advanceScreen()` asked only whether a screen was **done**, and `mcqFinish()` / s24's `finish()`
set `done` on the second **wrong** attempt too, so one correct answer of three walked the learner
into s25's `יופי של עבודה! הנה עוד 2 תרגילים ברמת קושי גבוהה יותר`. Reported by an MOE tester
against component 03 on 17.09.26.

`SET_GATES` (`unit-js/main.js`, beside `stationState`) now maps **screen → {set, need, btn}**, and
`advanceScreen()` consults `gateBlocks()` **last**, immediately before `goTo`. Below the threshold
the component **ends where it stands**: `endComponentHere()` does what `leaveToPart` does — report
`partResult()` through `xapiEndComponent`, record the durable score, flush — and the **platform**
routes on that `completed`. `metadata/methodica-ar-math-ratio-02-03.json` carries
`recommendedAfterFail: ["methodica-ar-math-ratio-02-01"]`, the only non-empty one in the unit.

Deliberately:

- **No message and no retry.** By the time a set is resolved the correct answers are on screen, so a
  retry would be a second look at them. The learner sees a greyed `שנמשיך?` — the same idiom as the
  last screen of components 01, 02 and 04.
- **The gate fires on the click**, not when s24 resolves. `completed` is the *exit* event; sending it
  the instant the third answer lands would let Kata pull the frame while the worked-answer popup is
  still opening.
- **Only component 03 has an entry.** A set whose last screen is also `PART_CONFIG.end` has nothing
  to gate — the learner leaves either way and `leaveToPart` already reports the real score. That is
  set A (s20 = 02's end) and set D (s37 = 04's end); set E stops one thank-you screen short of 05's
  end with `recommendedAfterFail: []`. Set B is the only set followed by more of its own component.
- **It persists nothing of its own.** Derived from `qResults`, `s24Done` (already in
  `RESUME_PLAIN_VARS`) and the `done` ledger — so no `RESUME_STATE_VERSION` bump, and nothing added
  to the exactly-asserted payload/document shapes.
- **It fails open.** `gateBlocks()` refuses to judge until every station of the set is resolved; a
  learner resuming on a document the platform cleared is never trapped on a set they may have passed.

⚠️ `restoreEndedButton()`, called last in `applyExecutionState`, is what makes the gate survive a
reload: `restoreScreenUI` → `paintS24` → `_doneButton('s24')` re-enables the button on every resume,
so without it a refresh hands the learner the button back — the original bug, now only reproducible
by refreshing. It re-disables on **both** the gate and the ledger, never re-reports: a learner who
answered but never clicked must get a **live** button, or they would be stuck with no `completed`
and the platform would never route them anywhere.

A gated learner can never reach `XAPI_PASS`: set B reports four catalogue questions and at most one
station can be right, so `scaled ≤ 0.5 < 0.6` and the `completed` always carries `success: false` —
which is what makes `recommendedAfterFail` fire.

Asserted by `_test/verify-report.js` (`gate`: wiring, fixtures for the fail-open and threshold
cases, and that the gate is *not* inside `leaveToPart`/`finishUnit`) and `_test/statement-flow.js`
(`gate`: 3/3 and 2/3 walk on with no component `completed`; 1/3 stays on s24, reports once with
`success: false`, closes item 003 before the component, never touches 004/005; and both reload
cases). The walks click the **real** buttons — a wrong attempt leaves the check button disabled
until the answer changes, so the second attempt must pick a different wrong answer, and the harness
records any click on a disabled target rather than walking through a door the UI keeps locked.

### One document per component (2026-09-16, state v6)

Two platform statements fixed the model. **MOE:** the platform remembers per learner which
components are done, not started or in progress, and brings the learner back to *the last component
in progress*. **Kata:** the `registration` our content saves State under is a **{user, component}**
pair — a different one per component for the same learner — and the platform may **clear one
component's State** on a repeat entry (a re-take of an assessment component).

The wire was already per component (`xapi-720-k.js` addresses Kata's State API by `?registration`
alone, and since *The platform owns routing* no part copies its query into another). The document's
**content** was still unit-shaped — a landing pointer `part`, a back-edge map `prev`, `parts{}` with
every part's payload — and that shape hid a live defect: `applyUnitProfile` read a null
`ui.character` as "no character", nulled the in-memory value and **deleted the localStorage
mirror**, so under Kata every part ≥ 02 opened with the default companion and destroyed the choice
for the parts after it.

| | before | after |
|---|---|---|
| the document | `{ v:5, part, parts{}, prev{}, done, doneItems, hints, picks, ui, results }` — one per unit | `{ v:6, component, payload, done, doneItems, hints, picks, ui, results }` — **one per part**; `component` checked on every read, another part's document discarded with `console.warn`; **v5 migrated in place** (`payload = parts[<this slug>]`, ledgers/character/results kept) |
| `RESUME_STATE_ID` | `'execution-state'` | `'execution-state::<slug>'` — the localStorage fallback (`?dev=1`, no registration) is one slot per part too |
| the companion character | `applyUnitProfile`: document → memory + mirror, **deleting** the mirror on null | `adoptUnitCharacter`: own document → same-browser mirror → default; a mirror hit is copied into this part's document (persisted in phase B); the mirror is **never deleted**; `?resetState` adopts nothing |
| `writeForwardState` / `goBackToPreviousPart` (`?dev=1` only) | moved the landing pointer, wrote `prev`, seeded the destination, refused to navigate on a failed write | record the `sessionStorage` edge, save **this** part, navigate. `destFirstScreen` stays in the signature and is ignored |
| re-take (Kata clears the document) | untested | fresh attempt: nothing restored, ledgers empty (`completed` again — intended), the empty `results` section beats the localStorage mirrors. Tested (`retake`) |

**Known cost, accepted:** a learner who switches devices mid-unit sees the default companion in parts
not yet opened on the new device. Reading part 01's document by `studentId+componentKey` was
neither asked of Kata nor built.

Every `?v=` in the unit moved with the version (the rule above). Tests: `shape` / `isolation` /
`retake` / `character` in `_test/verify-report.js`; the seam assertions now read the edge map and
this part's own document.

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
> `-IdBase` and trims the trailing slash, so retrieved ids look like `…/methodica-ar-math-ratio-02-01`
> against our `…/methodica-ar-math-ratio-02-01/`. That is the script's formatting, not a difference in
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
