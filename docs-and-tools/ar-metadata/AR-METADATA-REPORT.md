# Arabic metadata — how `metadata/` was built, and what the supplied file got wrong (29.09.26)

## Decision

**Hebrew master, Arabic text — the master is the LIVE Hebrew record in Kata** (since 29.09.26,
before the first send). `metadata/methodica-ar-math-ratio-02-*.json` is the published Hebrew unit
`methodica-math-ratio-02` as Kata returned it (`deployments/!kata-snapshots/2026-09-29-before-ar/_raw/`,
turned into this repo's shape by `raw2meta.js`) with only the changes below.

Why the live record and not the Hebrew repo's `metadata/`: the drift check before sending showed
Kata's published Hebrew differs from the Hebrew repo (and from `metadata-src/`), and in every
structural point that can be checked against code, Kata matches the lomda. Owner decision, as on
ar-science-mass-measure-03 (64b30d2):

| | Hebrew repo `metadata/` | live Kata (now the master) |
|---|---|---|
| 01 `componentPurpose` | both | instruction |
| 04 `isRequired` | true | false |
| 03 `recommendedAfterFail` | 01 | **02** |
| 01-002 | 6 questions, q1 true-false, q5 matching | 5: q1 multi-select (4 statements), q2–q4, q6 (the lomda never reports q5) |
| 01-003 | 6 questions | none (the guided item is ungraded) |
| answer lists | 02-002: 1, 03-001: 3, 05 q8: 2 | 3 / 4 / 3 (as on screen) |
| 04-002 correct targets | true, false, true | false, true, false |
| 05 q4 answer | `3` | `"2,3"` |
| fill-in alternates | e.g. `4:1` | e.g. `1:4` |

The first build (commit 0094351) used the Hebrew repo's `metadata/` as master; the sections below on
the Hebrew repo's mismatches describe that version. The only changes are:

| Field | Source |
|---|---|
| ids (`id`, `learningUnitId`, item `id`, `questionId`, `recommendedAfterFail`) | Hebrew shape (trailing `/`, `/qN`), under `…/metodica/720/ar/math/ratio/02/` and the `methodica-ar-math-ratio-02` slug — what `unit-js/10-identity.js` reports |
| `languages` | `["Arabic"]` |
| component / item `title`, item `informationToBot`, `createdAt` / `updatedAt` | `metadata-ar/` (the supplier's file; items align 1:1) |
| `questionText` | the supplier's aligned question (it paraphrases the Arabic screen); where there is none, `override.json` |
| `answers`, `correctAnswers` | the lomda's own Arabic string for the same Hebrew string (dictionary built from the Hebrew 3031dd2 and Arabic 87af0c3 sources, which share their DOM/line structure); else the supplier's aligned answer; else `override.json`. Ratios keep the Hebrew metadata's token order. |
| everything else (`componentPurpose`, `isRequired`, `relativeDifficulty`, `order`, `depthLevel`, `cognitiveLevels`, `estimatedTimeInMinutes`, `contentType`, `mediaFormat`, question count / order / type, correct-answer structure, numeric answers, unit record) | **Hebrew, unchanged** |

Verified: `mdiff.js` Hebrew vs the result differs only in text of `answers` / `correctAnswers`;
every numeric-only answer is identical; the number check in `build-meta.js` finds no answer whose
numbers differ from its Hebrew source. Both `_test` suites pass (1051 / 98, as in Hebrew).

The runtime reads only the ids (`questionId` lookup, `METADATA.id`); grading lives in
`unit-js/main.js`. So none of this changes what the learner sees; it is what Kata and the bot get.

## Rebuild

```bash
# scratch copies: he/0N.html he/0N.js he/main.js at 3031dd2, ar/... at 87af0c3 (0N.html = current)
NODE_PATH=/tmp/lomda-test/node_modules node dict.js <scratch>            # -> <scratch>/dict.json
node raw2meta.js <snapshot>/_raw/methodica-math-ratio-02.json <Hebrew _unit.json> <scratch>/he-live
HE_DIR=<scratch>/he-live node build-meta.js <repo> <scratch>/dict.json [--write]   # reads <scratch>/override.json
node mdiff.js <scratch>/he-live <repo>/metadata                          # non-text diff, expect answers text only
```

## The supplied `metadata-ar/` (24.09) — deviations from the Hebrew unit

Kept untouched in `metadata-ar/` (commit 7ffc37d). Not used for any of these fields:

- **Ids:** `…/index.html` component/item ids and `…/index.html?q=qN` question ids. `xapiQ`
  matches on `'/' + qKey`, so every question lookup would have fallen back.
- **Component values:** 01 `componentPurpose` instruction (HE both), `relativeDifficulty` 3 (HE 2),
  `estimatedTimeInMinutes` 24 (HE 26); 01-001 `mediaFormat` interactive-content (HE text);
  03 `isRequired` true (HE false); 04 `isRequired` false (HE true), time 10 (HE 14).
- **01-002:** 5 questions, not 6. The Hebrew **q5** (the matching ×/÷/+/− cards) is missing, not q6; the supplier's q5 is the Hebrew q6. Its q1 is a multi-select, where the Hebrew q1 is true-false.
- **01-003:** a different question set. It adds "mathematical notation 25 : 200" as q2, and merges the Hebrew q5 and q6 into one.
- **Reversed ratios** in most fill-in answers (`1 : 4` for HE `4 : 1` etc.) and in statement texts.
- **05 q4:** `fill-in` with an Arabic sentence as the answer (HE `numeric`, `3`).
- **Unit:** `manufacturer` `"310"` (string; HE 310).

## Hebrew repo metadata vs its own lomda (first build; mostly resolved by the live master)

These are in the Hebrew unit too. Report to the Hebrew unit's owner; fixing them here alone would
break parity.

- **01-002 q1:** the Hebrew metadata says true-false ("is 12:8 correct"). Screen s3 asks a multi-select over four statements.
- **02-002 q1:** the metadata lists 1 answer; the screen has 3 options.
- **03-002 q1:** the metadata marks "…3/7 of all comments" as correct. The screen's option c says `3/5`, and the code's correct set is a, b, d (`MCQ.s23.correctIds`).
- **02-003 q1:** answer 1 is worded differently from the screen's option (same claim).
- **05 q1 / q5 stems:** the metadata says discounted : **full-price** = 5:3. Both screens say discounted : **total** = 3 : 5.

## Written here (no Arabic source) — for the native Arabic review

From `override.json` (live-master build):
- `02-003 q1` answer 1 and `03-002 q1` answer 3: the live Hebrew statements (`3/7`); the screens
  word them differently.
- `03-001 q1` answer 4: the "1/4 of the art-track students" statement (the supplier has it at another position).
- `05-001 q8` answer 3: translated from the live Hebrew ("…3/5 of the tickets sold…").
- `01-001 q1` answer 3 is **جال**, the answer button. The chat bubble on s1 spells it **غال**.
- `04-002` statements 2 and 3 drop the parenthetical that the Arabic screen adds and the Hebrew does not have.

Answers taken from `metadata-ar/` by position (where the lomda dictionary had no exact match) were each
checked by meaning against the live Hebrew, and their ratios put in the Hebrew order.

## Arabic lomda text notes (visible, not changed — native review)

- s1: **غال** in the chat bubble vs **جال** on the answer button.
- The check button reads `هل كنت على حق?` (Latin `?`) in the HTML but `هل إجابتي صحيحة؟` after a retry (`main.js:229`, `:953`); Hebrew uses `צדקתי?` for both.
- Hebrew prefix hyphens copied into the Arabic: `و-180` (05 s45), `و-140°`, `و-20` (main.js).
- s21 `أجب` (singular) where the rest of the unit addresses the learner in the plural (`أجيبوا`).
- Ratios are typeset `a: b`; the Hebrew uses `a : b` (display only; order is safe inside `dir="ltr"`).
