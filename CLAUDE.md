# Unit: methodica-math-ratio-01-02

Interactive learning unit (לומדה) for Methodica's 720 project. Hebrew, RTL, static
HTML/CSS/JS. Built from the extracted spec in `spec/` — read `spec/manifest.md` first;
each screen's full instructions live in `spec/screens/slide-NNN.md` (production notes
from the תסריט, slide text, and reference images in `spec/assets/`).

## Build order

1. `spec/manifest.md` → group slides into screens (consecutive "לא צוין" slides are
   usually feedback/hint states of the preceding question screen, not new screens).
2. For each screen use the template named under **תבנית** via the `720-templates` /
   `figma-lomda-builder` skills. Screens marked CUSTOM — confirm approach before building.
3. Follow `720-design-guidelines` for all styling. Do not invent colors/typography.

## Structure

- `index.html` — the real unit flow (linear, gated navigation per the spec).
- `index_dev.html` — dev harness: free navigation to any screen, any state.
- `media/` — final media assets. Use placeholders until finals arrive; media file
  names in English, no spaces.
- `spec/` — generated, read-only. Regenerate with `tools/pptx_to_spec.py` when the
  client sends a new script version; never hand-edit.

## State rules

- The companion character chosen on the first screen persists across the unit.
  Character asset naming: `character1`, `character1-watching-video`, etc. The code
  must map the chosen character to its state variants on later screens.
- Question screens: respect attempts count, hint (רמז) visibility rules, and feedback
  states exactly as written in that slide's הנחיות הפקה.

## QA before delivery

Self-check every screen state, RTL, buttons, media loading, no missing assets, no
broken screens, faithful to spec/Figma. Then run the `lomda-qa-publish` skill.
