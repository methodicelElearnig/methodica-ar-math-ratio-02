'use strict';
/* ═══════════════════════════════════════════════════════════════════
   methodica-ar-math-ratio-02-04 — component 04 of 5 · deck slides 46-53
   תרגול מתקדם

   CONFIGURATION ONLY. Every behaviour is shared in ../unit-js/.
   ═══════════════════════════════════════════════════════════════════ */

window.PART_CONFIG = {
  start: 30, end: 37,
  next: 'methodica-ar-math-ratio-02-05',
  prev: 'methodica-ar-math-ratio-02-03'
};

var PART_FIRST = window.PART_CONFIG.start;
var PART_LAST  = window.PART_CONFIG.end;

var XAPI_COMP_SLUG     = 'methodica-ar-math-ratio-02-04';
var XAPI_COMP_ID       = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';
var XAPI_METADATA_FILE = '../metadata/methodica-ar-math-ratio-02-04.json';

/* screen -> [item suffix, page-within-item]; null = no catalogue item.
   ⚠️ THIS component's [start..end] only.

   Slides 46-53 map one-to-one onto screens 30-37:
     001  slides 46-48  intro + יחס בין זוויות במשולש (2 questions)
     002  slides 49-51  מסקנות ממחקר שימוש ב-AI — ONE catalogue question over three screens,
                        which are the three rows of the same table
     003  slides 52-53  משחק קלפים — טליה ויוני (2 questions) */
var SCREEN_TO_SUBCONTENT = {
  30: ['001', 1], 31: ['001', 2], 32: ['001', 3],
  33: ['002', 1], 34: ['002', 2], 35: ['002', 3],
  36: ['003', 1], 37: ['003', 2]
};

var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1 };

/* The challenge's result is over the 5 questions metadata declares (001 q1+q2, 002 q1, 003 q1+q2);
   unanswered counts as wrong — read by partResult() in ../unit-js/main.js.
   MOE 2026-10-08: real score, success only ≥60%, no gate, nothing shown. */
var PART_SCORE_N = 5;

var XAPI_ITEM_RESULT = {};
Object.keys(XAPI_EVAL_ITEMS).forEach(function (it) {
  XAPI_ITEM_RESULT[it] = function () { return itemResultFor(it); };
});
