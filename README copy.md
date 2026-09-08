# methodica-math-ratio-01-02 — ביטויי יחס ושמירה על היחס (יעד 1.2)

The 52-screen unit, recreated in the client's multi-component structure.

## Where the split comes from

**The deck itself.** `pptx/methodica-math-ratio-01-02-fixed.pptx` carries a
"רכיב N" separator slide before each component, and those five slides — 2, 27,
35, 45 and 54 — are the boundaries:

| | screens | deck slides | |
|---|---|---|---|
| 01 | 0–13  | 3–26  | הקנייה ותרגול מונחה |
| 02 | 14–20 | 28–34 | תרגול סטנדרטי |
| 03 | 21–29 | 36–44 | תרגול בסיסי וסטנדרטי ב |
| 04 | 30–37 | 46–53 | תרגול מתקדם |
| 05 | 38–51 | 55–67 | שאלת שיא |

Every component opens on its own transition screen, which is what the deck's
separators describe — a good independent check that the split is right.

## Layout

- `index.html` — redirects to component 01, carrying the query string.
- `methodica-math-ratio-01-02-01 … -05/` — five component apps
  (`index.html` + `script.js` + `styles.css` + `assets/`).
- `unit-js/` — the shared layer: the approved engine, one copy. Each
  `script.js` holds **only** that component's `PART_CONFIG` and xAPI identity.
- `metadata/` — unit + per-component JSONs. **Drafts** pending the מפתחת.
- `_test/` — from the client example.

## Deviations, deliberate

1. **The approved engine moves in whole**, shared from `unit-js/`, rather than
   being rewritten onto `methodica-math-ratio-01-01-git-main`'s hook contract
   (its own goTo/resume/xAPI layer). Rewriting a 52-screen build onto a second
   navigation layer would risk behaviour the client has signed off. The seams
   the split needs are three, all guarded so the single app still runs:
   `PART_CONFIG` bounds `goTo`, `goToNextPart()` hands over at the end, and
   `currentScreen` is seeded from the part's start.
2. **Screens keep the unit's global numbering** (0–51), as in the ratio-01
   reference.
3. **xAPI and resume are not wired** (M2). `script.js` carries
   `XAPI_COMP_SLUG`/`XAPI_COMP_ID` ready for them.

The original single-app build stays untouched at `units/methodica-math-ratio-01-02/`.
