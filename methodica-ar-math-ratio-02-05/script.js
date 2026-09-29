'use strict';
/* ═══════════════════════════════════════════════════════════════════
   methodica-ar-math-ratio-02-05 — component 05 of 5 · deck slides 55-67
   שאלת שיא · isAssessment: true

   CONFIGURATION ONLY. Every behaviour is shared in ../unit-js/.
   ═══════════════════════════════════════════════════════════════════ */

window.PART_CONFIG = {
  start: 38, end: 50,
  next: null,                                  // last component -> goTo() calls finishUnit()
  prev: 'methodica-ar-math-ratio-02-04'
};

var PART_FIRST = window.PART_CONFIG.start;
var PART_LAST  = window.PART_CONFIG.end;

var XAPI_COMP_SLUG     = 'methodica-ar-math-ratio-02-05';
var XAPI_COMP_ID       = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';
var XAPI_METADATA_FILE = '../metadata/methodica-ar-math-ratio-02-05.json';

/* screen -> [item suffix, page-within-item]; null = no catalogue item.
   ⚠️ THIS component's [start..end] only.

   ONE catalogue item carrying all eight questions — the peak question is a single long task in
   six סעיפים, not a numbered practice set, which is also why these screens are absent from QPROG
   in ../unit-js/main.js. Screens 38-50 are its pages 1-13; the eight graded screens inside it are
   41-46, 48 and 49. */
var SCREEN_TO_SUBCONTENT = {
  38: ['001', 1],  39: ['001', 2],  40: ['001', 3],  41: ['001', 4],
  42: ['001', 5],  43: ['001', 6],  44: ['001', 7],  45: ['001', 8],
  46: ['001', 9],  47: ['001', 10], 48: ['001', 11], 49: ['001', 12],
  50: ['001', 13]
};

var XAPI_EVAL_ITEMS = { '001': 1 };

var XAPI_ITEM_RESULT = {};
Object.keys(XAPI_EVAL_ITEMS).forEach(function (it) {
  XAPI_ITEM_RESULT[it] = function () { return itemResultFor(it); };
});
