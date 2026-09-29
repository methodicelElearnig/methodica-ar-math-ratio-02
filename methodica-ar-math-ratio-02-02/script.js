'use strict';
/* ═══════════════════════════════════════════════════════════════════
   methodica-ar-math-ratio-02-02 — component 02 of 5 · deck slides 28-34
   תרגול סטנדרטי

   CONFIGURATION ONLY. Every behaviour is shared in ../unit-js/.
   ═══════════════════════════════════════════════════════════════════ */

window.PART_CONFIG = {
  start: 14, end: 20,
  next: 'methodica-ar-math-ratio-02-03',
  prev: 'methodica-ar-math-ratio-02-01'
};

var PART_FIRST = window.PART_CONFIG.start;
var PART_LAST  = window.PART_CONFIG.end;

var XAPI_COMP_SLUG     = 'methodica-ar-math-ratio-02-02';
var XAPI_COMP_ID       = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';
var XAPI_METADATA_FILE = '../metadata/methodica-ar-math-ratio-02-02.json';

/* screen -> [item suffix, page-within-item]; null = no catalogue item.
   ⚠️ THIS component's [start..end] only.

   Slides 28-34 map one-to-one onto screens 14-20:
     001  slides 28-30  intro + עוגת שוקולד עם סוכריות (2 questions)
     002  slide  31     כמות גשם בעזוז ובאילת
     003  slide  32     זמן אנימציה מול וידאו בסרטון
     004  slides 33-34  ריבוע ABCD ומשולש PE (2 questions) */
var SCREEN_TO_SUBCONTENT = {
  14: ['001', 1], 15: ['001', 2], 16: ['001', 3],
  17: ['002', 1],
  18: ['003', 1],
  19: ['004', 1], 20: ['004', 2]
};

var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1, '004': 1 };

var XAPI_ITEM_RESULT = {};
Object.keys(XAPI_EVAL_ITEMS).forEach(function (it) {
  XAPI_ITEM_RESULT[it] = function () { return itemResultFor(it); };
});
