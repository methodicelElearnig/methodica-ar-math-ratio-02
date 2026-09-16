'use strict';
/* ═══════════════════════════════════════════════════════════════════
   methodica-math-ratio-02-01 — component 01 of 5 · deck slides 3-26
   הקנייה ותרגול מונחה

   CONFIGURATION ONLY. Every behaviour is shared in ../unit-js/.
   The split follows the deck's own "רכיב N" separator slides.
   ═══════════════════════════════════════════════════════════════════ */

/* `next`/`prev` are component SLUGS, not paths: ../unit-js/main.js's leaveToPart() and
   40-resume.js's goBackToPreviousPart()/writeForwardState() all address components by slug, and
   one representation means the resume document and the navigation can never disagree.
   null marks an edge of the unit. */
window.PART_CONFIG = {
  start: 0, end: 13,
  next: 'methodica-math-ratio-02-02',
  prev: null                                   // first component
};

var PART_FIRST = window.PART_CONFIG.start;     // read by ../unit-js/40-resume.js's comments/tools
var PART_LAST  = window.PART_CONFIG.end;

var XAPI_COMP_SLUG     = 'methodica-math-ratio-02-01';
var XAPI_COMP_ID       = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';
var XAPI_METADATA_FILE = '../metadata/methodica-math-ratio-02-01.json';

/* screen -> [item suffix, page-within-item]; null = no catalogue item.
   ⚠️ Covers THIS component's [start..end] only, never 0..TOTAL_SCREENS-1. Screens are numbered
   unit-wide, so an entry for another component's screen would claim an item this one does not own.

   From metadata-src/mapping.txt, which carries the deck's own "מספר פריט" tag per slide:
     001  slides 3-5    the hook — character choice, the battery chat, its resolution
     002  slides 6-16   הקנייה — one scrolling screen with five questions and four reveal cards
     003  slides 17-26  תרגול מונחה — the cake-icing worked example */
var SCREEN_TO_SUBCONTENT = {
  0: ['001', 1], 1: ['001', 2], 2: ['001', 3],
  3: ['002', 1],
  4: ['003', 1], 5: ['003', 2], 6: ['003', 3], 7: ['003', 4], 8: ['003', 5],
  9: ['003', 6], 10: ['003', 7], 11: ['003', 8], 12: ['003', 9], 13: ['003', 10]
};

/* Items that carry a graded question IN CODE. Drives `expectsAnswer` on the item 'completed'.

   ⚠️ 003 is deliberately ABSENT. It is the guided worked example: gstepSelect() adds .correct to
   the right option WHATEVER the learner picks (../unit-js/main.js), so nothing there is assessed
   and the item must not claim expectsAnswer. The catalogue still describes it with six questions —
   those are content, not graded interactions. The reference unit excludes its own item 003 for
   exactly this reason (methodica-math-ratio-01-01/script.js:51). */
var XAPI_EVAL_ITEMS = { '001': 1, '002': 1 };

/* Built from XAPI_EVAL_ITEMS rather than written out, so this block stays identical in all five
   components. The closures resolve itemResultFor() at CALL time — it lives in main.js, which
   loads after this file. */
var XAPI_ITEM_RESULT = {};
Object.keys(XAPI_EVAL_ITEMS).forEach(function (it) {
  XAPI_ITEM_RESULT[it] = function () { return itemResultFor(it); };
});

/* ── The unit scope — ENTRY COMPONENT ONLY ──
   Only the entry component loads the unit-level metadata (UNIT_METADATA feeds the bug-report
   form). Called by ../unit-js/50-loader.js after the component 'initialized'.

   The unit-scope 'initialized' that used to follow it is gone since 2026-09-16, with the unit
   'completed' in component 05: MOE v2.5/v2.7 define object as item or component only, and the
   platform derives unit state itself (README.md "The platform owns routing"). */
function onXapiReady() {
  loadUnitMetadata('../metadata/methodica-math-ratio-02_unit.json', function () {});
}
