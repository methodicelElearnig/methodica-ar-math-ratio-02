'use strict';
/* ═══════════════════════════════════════════════════════════════════
   methodica-ar-math-ratio-02-03 — component 03 of 5 · deck slides 36-44
   תרגול בסיסי וסטנדרטי ב

   CONFIGURATION ONLY. Every behaviour is shared in ../unit-js/.
   ═══════════════════════════════════════════════════════════════════ */

window.PART_CONFIG = {
  start: 21, end: 29,
  next: 'methodica-ar-math-ratio-02-04',
  prev: 'methodica-ar-math-ratio-02-02'
};

var PART_FIRST = window.PART_CONFIG.start;
var PART_LAST  = window.PART_CONFIG.end;

var XAPI_COMP_SLUG     = 'methodica-ar-math-ratio-02-03';
var XAPI_COMP_ID       = XAPI_ID_PREFIX + XAPI_COMP_SLUG + '/';
var XAPI_METADATA_FILE = '../metadata/methodica-ar-math-ratio-02-03.json';

/* screen -> [item suffix, page-within-item]; null = no catalogue item.
   ⚠️ THIS component's [start..end] only.

   Slides 36-44 map one-to-one onto screens 21-29:
     001  slides 36-37  intro + תלמידי מגמת אומנות
     002  slide  38     תגובות באינסטגרם
     003  slide  39     מצב הטלפון — רגיל ושקט (two sub-answers on one screen)
     004  slides 40-42  intro + תווית ערכים תזונתיים
     005  slides 43-44  משולש מחולק — שטח אפור ותכלת */
var SCREEN_TO_SUBCONTENT = {
  21: ['001', 1], 22: ['001', 2],
  23: ['002', 1],
  24: ['003', 1],
  25: ['004', 1], 26: ['004', 2], 27: ['004', 3],
  28: ['005', 1], 29: ['005', 2]
};

var XAPI_EVAL_ITEMS = { '001': 1, '002': 1, '003': 1, '004': 1, '005': 1 };

var XAPI_ITEM_RESULT = {};
Object.keys(XAPI_EVAL_ITEMS).forEach(function (it) {
  XAPI_ITEM_RESULT[it] = function () { return itemResultFor(it); };
});

/* The threshold (2026-11-09, 08.11 sheet fixes 1, 2, 4, 6): s21 promises "3 أسئلة … أجب بشكل صحيح على
   سؤالين أو أكثر للمضي قدمًا" (the dual = 2) — set B's three stations (s24's two answers are one question), the same
   count the s24 gate reads. Set C (s26-s29) reports its own answered and never enters the result.
   Read by partResult() in ../unit-js/main.js. */
var PART_THRESHOLD = { set: 'B', K: 2 };
