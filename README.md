# methodica-math-ratio-02 — ביטוי יחס בדרכים שונות (יעד 1.2)

The 52-screen unit, in the client's multi-component structure.

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
| 05 | 38–51 | 55–67 | שאלת שיא |

Every component opens on its own transition screen, which is what the deck's separators describe — a
good independent check that the split is right.

## Layout

- `index.html` — redirects to component 01, **carrying the query string** (the platform's `?slxapi`
  and `?registration` launch parameters; without them reporting and resume are dead).
- `methodica-math-ratio-02-01 … -05/` — five component apps
  (`index.html` + `script.js` + `styles.css` + `assets/`).
- `unit-js/` — the shared layer, one copy for the unit. `main.js` is the approved engine plus this
  unit's screen logic; the numbered files are the 720 platform layer. See `unit-js/README.md`.
- `metadata/` — unit + per-component JSONs: 1 unit, 5 components, 16 items, 43 questions. Extracted
  from the deck and normalised to the shape live Kata accepts. ⚠️ **Not yet pushed** — see *Known
  content issues*.
- `_test/` — headless regression harness. **Never shipped**, including its stub library.
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
   onto ratio-01's per-part hook contract. Rewriting a 52-screen build onto a second navigation layer
   would risk behaviour the client has signed off. The platform layer is therefore **grafted onto**
   `main.js`'s `goTo` rather than replacing it — `unit-js/30-nav.js` and `25-report.js` are
   deliberately **not** vendored. `unit-js/README.md` says exactly which files were taken and why.
2. **Screens keep the unit's global numbering** (0–51), as in the ratio-01 reference. `TOTAL_SCREENS`
   is 52 unit-wide and each component's DOM holds only its own slice.
3. Each `script.js` holds **only** that component's `PART_CONFIG` and xAPI identity; all behaviour is
   shared.

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

Consequence: the runtime never reads `correctAnswers` or `title`, so reporting is unaffected — but
**do not run `send-metadata.ps1` outside `-DryRun`** until 1 and 2 are resolved, or the catalogue
will hold answer keys that contradict the shipped lomda.

## `learningObjective` — verified

`metadata/` carries `MOE.MATH.G8.NUM.RATIO-PROP-SCL.RATIO.ALG-EXPR`, and it is **valid**.
`GET /api/v1/objectives` returns exactly three objectives under this unit's subTopic
`MOE.MATH.G8.NUM.RATIO-PROP-SCL.RATIO`:

| Code | |
|---|---|
| **`.ALG-EXPR`** | לבטא יחס באמצעות ביטויים אלגבריים ← **this unit** |
| `.QTY-TYPE` | יחס בין כמויות מאותו הסוג או מסוגים שונים (כגון: מהירות) |
| `.REAS` | חשיבה שעוסקת ביחס |

Of the three, `.ALG-EXPR` is the only one about *expressing* a ratio, so it is the right fit for
יעד 1.2. ⚠️ Worth knowing that its catalogue gloss says *באמצעות ביטויים אלגבריים* while this unit
teaches expression as a fraction, verbally and as a number pair — the code is correct because it is
the closest of the three that exist, not because the wording matches.

⚠️ **Do not "fix" this to `.RECOG` or `.IDENTIFY`.** Neither exists in Kata. `.RECOG` is what
`metadata-src/` and ratio-01's own `metadata/` carry, so it will look authoritative — ratio-01's
unit record has an invalid objective code, which is a question for that unit, not this one.
