/* ═══════════════════ headless regression oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only — exclude the whole _test/ folder from any release
   package, INCLUDING xapi-720-k.js, which shares a basename with the real CDN library
   by design (the XAPI_USING_G gate reads the filename).

   Loads the REAL index.html, script.js, unit-js/*.js and main.js of all FIVE components
   into jsdom, executes the script tags in document order from disk, and asserts against
   what actually ran. It does not call the code in isolation — it runs it.

   Every assertion here guards a failure mode that is otherwise SILENT. That is the
   selection criterion: a bug that shows up as a red screen does not need a test, a bug
   that shows up as a learner quietly losing their answers does.

   ── How this unit differs from the ratio-01 reference it was vendored from ──
   1. main.js is ONE shared file holding the engine and every screen's logic, and each
      script.js is config only. So there is no "all parts identical" assertion; instead
      the per-part config is checked against metadata/ (§4).
   2. The platform layer is GRAFTED onto main.js's goTo rather than replacing it, so
      30-nav.js and 25-report.js were not vendored. Their absence is asserted (§2) —
      re-adding one would collide silently.
   3. Screens are numbered UNIT-WIDE 0..50, so SCREEN_TO_SUBCONTENT covers each part's
      own [start..end] rather than 0..TOTAL_SCREENS-1 (§4).

   Run (jsdom is not in the repo and there is no package.json — do NOT install it inside
   the project folder, which is OneDrive-synced):

     mkdir -p /tmp/lomda-test && cd /tmp/lomda-test && npm install jsdom
     NODE_PATH=/tmp/lomda-test/node_modules node _test/verify-report.js

   Exit 0 = everything passed. A base path may be passed as the first argument.

   ⚠️ Real script tags put top-level `function`/`var` on window, which is what makes
   val() work by name. `let`/`const` bindings (currentScreen, Q, MCQ, s15Done) never
   reach window even in a real page, so those are read by evaluating an expression in
   page scope instead. */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = process.argv[2] || path.join(__dirname, '..');
const UNIT = 'methodica-math-ratio-02';
const COMPONENTS = ['01', '02', '03', '04', '05'];
const PART_DIR = c => UNIT + '-' + c;
const TOTAL_SCREENS = 51;

/* Each component's slice of the unit-wide screen space — the deck's five רכיבים.
   Mirrored from each script.js's window.PART_CONFIG, and asserted against it in §4. */
const RANGE = {
  '01': [0, 13], '02': [14, 20], '03': [21, 29], '04': [30, 37], '05': [38, 50],
};

/* The platform layer's API. */
const SHARED_FNS = [
  'shortId', 'bootXAPI',
  'xapiItemId', 'xapiQ', 'xapiOnScreen', 'xapiFinishItems', 'xapiAnswered',
  'xapiRequestedHint', 'xapiCompleteComponent', 'xapiEndComponent', 'xapiAnswerText',
  'xapiItemResult', 'xapiWireVideos',
  'sendStatementOnce', 'sendCompletedOnce', 'itemLedgerKey', 'currentPartSlug',
  'readUnitState', 'captureUnitState', 'persistUnitState', 'emptyUnitState',
  'scheduleResumeSave', 'flushResumeSave', 'initResumeLeaveHandlers',
  'initResumeResetHatch', 'dropBootCover', 'getUnitCharacter', 'setUnitCharacter',
  'getUnitResult', 'setUnitResult', 'adoptUnitCharacter', 'migrateState', 'drainPendingUnitState',
  'recordForwardEdge', 'goBackToPreviousPart', 'writeForwardState', 'hideCrossPartBack',
  'resumeIsPainting', 'beginRepaint', 'endRepaint',
  /* main.js's restoreEndedButton reads the ledger across the layer boundary — pinned here so a
     rename in 40-resume.js cannot silently turn a fired gate back into a live button. */
  'alreadySent',
];

/* What main.js owns — the engine, and the hooks the platform layer calls back into. */
const MAIN_FNS = [
  'goTo', 'scaleApp', 'resetScreenState', 'announce', 'initReportModal',
  'capturePartPayload', 'applyResumeVars', 'applyResumeDom', 'restoreScreenUI',
  'applyExecutionState', 'partBoot', 'leaveToPart', 'finishUnit', 'lastScreenButton',
  'screenWasCorrect', 'itemResultFor', 'partResult', 'recordPartResult',
  'xapiKeyFor', 'xapiScreenKey', 'xapiReport', 'xapiHint', 'xapiReportQScreen',
  'setScore', 'gateBlocks', 'endComponentHere', 'restoreEndedButton',
];

/* Files that must NOT be vendored: main.js already owns the equivalent, and a second
   copy would be a silent last-wins overwrite (or, for 30-nav.js, a SyntaxError). */
const MUST_NOT_EXIST = ['30-nav.js', '25-report.js', '15-ui.js', '28-feedback-drag.js',
                        '60-devbridge.js', 'engine.js', 'motion.js', 'quiz-engine.js'];

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return true; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
  return false;
}
function eq(tag, what, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  return ok(tag, what, a === e, 'got ' + a + ', expected ' + e);
}
function readJSON(p) {
  /* metadata files may carry a UTF-8 BOM; JSON.parse chokes on it */
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

function makeRunner(w) {
  const exec = (code) => {
    const s = w.document.createElement('script');
    s.textContent = code;
    w.document.head.appendChild(s);
    s.remove();
  };
  const val = (expr) => {
    exec('window.__v = (function(){ try { return (' + expr +
      '); } catch (e) { return "__throw:" + e.message; } })();');
    return w.__v;
  };
  return { exec, val };
}

/* Build a component's DOM and run its real script tags from disk. bootXAPI's two CDN
   loadScript calls are inert under jsdom, which is what keeps the layer quiet here. */
function loadComponent(c, opts) {
  opts = opts || {};
  const dir = path.join(BASE, PART_DIR(c));
  const consoleErrors = [];

  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8779/' + PART_DIR(c) + '/index.html' +
      (opts.search || '') + (opts.hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const { exec, val } = makeRunner(w);

  w.console.error = (...a) => consoleErrors.push(a.join(' '));
  w.console.warn = () => {};
  w.console.log = () => {};
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

  /* jsdom implements neither load/play/pause, and play() returns undefined, so
     `video.play().catch(...)` would throw — the exact shape of the bug that once
     killed the rest of a script file in silence. Give the browser contract instead. */
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};

  const tags = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const src of tags) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (!fs.existsSync(p)) { consoleErrors.push('missing script ' + src); continue; }
    try { exec(fs.readFileSync(p, 'utf8')); }
    catch (e) { consoleErrors.push('threw in ' + src + ': ' + e.message); }
  }
  return { dom, w, exec, val, tags, dir, consoleErrors };
}

/* ══════════════ 1. Clean load and the API surface ══════════════ */

function checkLoad() {
  for (const c of COMPONENTS) {
    const { val, consoleErrors, dom } = loadComponent(c);
    ok('load', c + ' loads with no console errors',
      consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    for (const fn of SHARED_FNS) {
      ok('shared', c + ' defines ' + fn, val('typeof ' + fn) === 'function', String(val('typeof ' + fn)));
    }
    for (const fn of MAIN_FNS) {
      ok('main', c + ' defines ' + fn, val('typeof ' + fn) === 'function', String(val('typeof ' + fn)));
    }
    /* partBoot ran: the part's own first screen is active, and resetScreenState went
       with it. main.js has no DOMContentLoaded and never called goTo at load, so
       before partBoot the markup's .active screen got no entry work at all. */
    eq('boot', c + ' partBoot landed on the part\'s first screen',
      val('currentScreen'), RANGE[c][0]);
    eq('boot', c + ' active screen matches currentScreen',
      val('document.querySelector(".screen.active") && document.querySelector(".screen.active").id'),
      's' + RANGE[c][0]);
    dom.window.close();
  }
}

/* ══════════════ 2. The deploy contract ══════════════
   Every item here has bitten this family at least once. */

function checkDeployContract() {
  const sharedDir = path.join(BASE, 'unit-js');
  const sharedFiles = fs.readdirSync(sharedDir).filter(f => f.endsWith('.js')).sort();

  for (const f of MUST_NOT_EXIST) {
    ok('novendor', 'unit-js/' + f + ' is absent (main.js owns the equivalent)',
      !fs.existsSync(path.join(sharedDir, f)));
  }

  /* ?v= must be IDENTICAL across all five index.html for every shared URL. A mismatch
     lets two parts execute different versions of one file inside one learner session. */
  const seen = {};
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

    /* order: script.js before main.js (main.js reads PART_CONFIG at load), and
       90-boot.js LAST — it is the only file with side effects and may navigate away */
    const iCfg = tags.findIndex(t => /(^|\/)script\.js/.test(t));
    const iMain = tags.findIndex(t => /main\.js/.test(t));
    const iBoot = tags.findIndex(t => /90-boot\.js/.test(t));
    ok('order', c + ' script.js precedes main.js', iCfg > -1 && iMain > iCfg, tags.join(' '));
    ok('order', c + ' 90-boot.js is the last script tag',
      iBoot === tags.length - 1, tags.join(' '));

    for (const t of tags) {
      const [url, q] = t.split('?');
      if (!url.startsWith('../unit-js/')) continue;
      const v = (q || '').replace(/^v=/, '');
      if (seen[url] === undefined) seen[url] = { v, c };
      else ok('cachebust', url + ' has the same ?v= in every part',
        seen[url].v === v, 'part ' + seen[url].c + '=' + seen[url].v + ' vs ' + c + '=' + v);
      ok('cachebust', url + ' carries a ?v= at all', v !== '', 'in part ' + c);
    }
    /* every shared file the folder holds must actually be referenced — a file left off
       the tag list is dead code that a reader will assume is live */
    for (const f of sharedFiles) {
      if (f === 'main.js') continue;                 /* referenced without the numeric prefix */
      ok('cachebust', 'unit-js/' + f + ' is referenced by part ' + c,
        tags.some(t => t.indexOf('/' + f) > -1), tags.join(' '));
    }
  }

  /* Cross-part paths: lowercase, and resolving to a folder that exists. On a
     case-sensitive host a mixed-case cross-part link 404s, and the resume document's
     key comes from location.pathname, so mixed case also splits one learner's
     progress across two documents. */
  for (const c of COMPONENTS) {
    const js = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    const slugs = [...js.matchAll(/(?:next|prev):\s*'([^']+)'/g)].map(m => m[1]);
    for (const s of slugs) {
      ok('paths', c + ' -> ' + s + ' is lowercase', s === s.toLowerCase());
      ok('paths', c + ' -> ' + s + ' exists on disk', fs.existsSync(path.join(BASE, s)));
    }
  }
  const rootHtml = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
  const target = (rootHtml.match(/replace\('\.\/([^'/]+)/) || [])[1];
  ok('paths', 'root redirect target is lowercase and exists',
    !!target && target === target.toLowerCase() && fs.existsSync(path.join(BASE, target)), String(target));
  ok('paths', 'root redirect carries window.location.search',
    /replace\([^)]*window\.location\.search/.test(rootHtml),
    'without it the LRS config is lost and every component reports nothing');
}

/* ══════════════ 3. No identifier in both layers ══════════════
   A let/const clash is a loud SyntaxError, but a var/function clash is a SILENT
   last-wins overwrite — and main.js loads AFTER the numbered files, so a leftover copy
   in main.js wins and the port looks successful while running the wrong code. This bit
   once already: main.js carried its own shortId() with no trailing-slash trim, which
   returns '' for every canonical id. */

function checkNoCollisions() {
  const decl = /^(?:function|var|let|const)\s+([A-Za-z0-9_$]+)/;
  const shared = new Map();
  fs.readdirSync(path.join(BASE, 'unit-js'))
    .filter(f => /^\d/.test(f) && f.endsWith('.js'))
    .forEach(f => {
      fs.readFileSync(path.join(BASE, 'unit-js', f), 'utf8').split('\n').forEach(l => {
        const m = l.match(decl);
        if (m) shared.set(m[1], f);
      });
    });

  const files = ['unit-js/main.js'].concat(COMPONENTS.map(c => PART_DIR(c) + '/script.js'));
  for (const rel of files) {
    const hits = [];
    fs.readFileSync(path.join(BASE, rel), 'utf8').split('\n').forEach((l, i) => {
      const m = l.match(decl);
      if (m && shared.has(m[1])) hits.push(m[1] + '@' + (i + 1) + ' (also ' + shared.get(m[1]) + ')');
    });
    ok('collide', rel + ' declares nothing the numbered layer declares',
      hits.length === 0, hits.join(', '));
  }

  /* SCREEN_TO_SUBCONTENT is a SEAM, not a collision — the same trap in a different
     shape. It is per component and lives in script.js; a shared copy in main.js would
     load afterwards and overwrite the real one. */
  ok('collide', 'main.js does not declare SCREEN_TO_SUBCONTENT',
    !/^var SCREEN_TO_SUBCONTENT/m.test(fs.readFileSync(path.join(BASE, 'unit-js/main.js'), 'utf8')));
}

/* ══════════════ 4. Per-part config against metadata/ ══════════════ */

function checkConfigAgainstMetadata() {
  const unit = readJSON(path.join(BASE, 'metadata', UNIT + '_unit.json'));
  ok('meta', 'unit id ends with the unit slug and a trailing slash',
    /\/methodica-math-ratio-02\/$/.test(unit.id), unit.id);
  ok('meta', 'unit id is NOT ratio-01\'s component-02 id',
    unit.id.indexOf('methodica-math-ratio-01-02') === -1,
    'that string is byte-identical to ratio-01 component 02 and collides in Kata uniqueKey space');

  for (const c of COMPONENTS) {
    const { val } = loadComponent(c);
    const meta = readJSON(path.join(BASE, 'metadata', PART_DIR(c) + '.json'));
    const items = meta.subContent.map(s => s.id.replace(/\/+$/, '').split('/').pop().split('-').pop());

    /* byte-for-byte: a wrong id means Kata accepts statements pointing at an object
       that does not exist, which is a completely silent failure */
    eq('meta', c + ' XAPI_COMP_ID equals the metadata id byte for byte',
      val('XAPI_COMP_ID'), meta.id);
    eq('meta', c + ' learningUnitId equals the unit id', meta.learningUnitId, unit.id);
    eq('meta', c + ' XAPI_METADATA_FILE points at its own metadata',
      val('XAPI_METADATA_FILE'), '../metadata/' + PART_DIR(c) + '.json');

    const cfg = val('JSON.stringify(window.PART_CONFIG)');
    eq('cfg', c + ' PART_CONFIG range matches the declared slice',
      [JSON.parse(cfg).start, JSON.parse(cfg).end], RANGE[c]);
    eq('cfg', c + ' TOTAL_SCREENS is unit-wide', val('TOTAL_SCREENS'), TOTAL_SCREENS);

    /* the map covers this part's range and ONLY it: an entry for another part's screen
       would claim an item this component does not own */
    const keys = JSON.parse(val('JSON.stringify(Object.keys(SCREEN_TO_SUBCONTENT).map(Number).sort(function(a,b){return a-b;}))'));
    const expect = [];
    for (let i = RANGE[c][0]; i <= RANGE[c][1]; i++) expect.push(i);
    eq('map', c + ' SCREEN_TO_SUBCONTENT covers exactly [' + RANGE[c] + ']', keys, expect);

    const used = JSON.parse(val('JSON.stringify(Object.keys(SCREEN_TO_SUBCONTENT).map(function(k){return SCREEN_TO_SUBCONTENT[k] && SCREEN_TO_SUBCONTENT[k][0];}))'))
      .filter(Boolean);
    for (const suffix of [...new Set(used)]) {
      ok('map', c + ' item ' + suffix + ' exists in metadata', items.indexOf(suffix) > -1, items.join(','));
    }
    const evalItems = Object.keys(JSON.parse(val('JSON.stringify(XAPI_EVAL_ITEMS)')));
    for (const suffix of evalItems) {
      ok('map', c + ' XAPI_EVAL_ITEMS ' + suffix + ' exists in metadata', items.indexOf(suffix) > -1);
    }
    /* Every graded item must supply a result THUNK, or the item 'completed' falls back to
       the library's all-correct AND and reports success:false for a partial pass.
       ⚠️ Read the keys in page scope — the values are functions and JSON.stringify drops
       function-valued properties, so a round-trip through JSON reports {} and this
       assertion would pass vacuously on an empty map. */
    eq('map', c + ' XAPI_ITEM_RESULT covers exactly XAPI_EVAL_ITEMS',
      String(val('Object.keys(XAPI_ITEM_RESULT).sort().join(",")')), evalItems.sort().join(','));
    eq('map', c + ' every XAPI_ITEM_RESULT entry is callable',
      String(val('Object.keys(XAPI_ITEM_RESULT).every(function(k){return typeof XAPI_ITEM_RESULT[k] === "function";})')),
      'true');
    /* and it resolves itemResultFor at CALL time — it lives in main.js, which loads
       after script.js, so a thunk that captured it eagerly would hold undefined */
    eq('map', c + ' a thunk returns null for an item with no answered question yet',
      String(val('XAPI_ITEM_RESULT[Object.keys(XAPI_ITEM_RESULT)[0]]()')), 'null');

    /* pages within an item must be 1..n in screen order — the report dialog sends this
       number as the learner's position and a gap reads as a missing page */
    const pages = JSON.parse(val(`JSON.stringify((function(){
      var out = {};
      Object.keys(SCREEN_TO_SUBCONTENT).map(Number).sort(function(a,b){return a-b;}).forEach(function(k){
        var v = SCREEN_TO_SUBCONTENT[k]; if (!v) return;
        (out[v[0]] = out[v[0]] || []).push(v[1]);
      });
      return out;
    })())`));
    for (const it of Object.keys(pages)) {
      eq('map', c + ' item ' + it + ' pages are sequential from 1',
        pages[it], pages[it].map((_, i) => i + 1));
    }
  }

  /* part 01 only: the entry component opens the unit scope */
  const p1 = loadComponent('01');
  ok('unit', 'part 01 defines onXapiReady', p1.val('typeof onXapiReady') === 'function');
  for (const c of COMPONENTS.slice(1)) {
    ok('unit', 'part ' + c + ' does NOT define onXapiReady',
      loadComponent(c).val('typeof onXapiReady') === 'undefined',
      'a second unit initialized would be emitted on every component');
  }
}

/* ══════════════ 5. Resume: the two silent traps ══════════════ */

function checkResumeRoundTrip() {
  const { val, exec } = loadComponent('01');

  /* the eval in applyResumeVars resolves `st` LEXICALLY — a renamed parameter throws
     into the surrounding try/catch and the learner's answers vanish with no console
     output. Nothing but this assertion enforces it. */
  ok('resume', 'applyResumeVars\' parameter is literally named st',
    /^function applyResumeVars\s*\(\s*st\s*\)/.test(String(val('applyResumeVars.toString()'))));

  /* JSON round-trip. JSON.stringify(new Set(['a'])) is '{}' — silent total loss — so
     every Set must cross as an array and be rehydrated. */
  exec(`
    goTo(3);
    ['a','b','c','d'].forEach(function(id){ s3q1Toggle(id); });
    s3q1Check();
    window.__snap = JSON.parse(JSON.stringify(capturePartPayload()));
    s3q1Selected = new Set(); s3State.q1 = false;
    applyResumeVars(window.__snap);
  `);
  ok('resume', 'a Set survives the JSON round-trip as a Set',
    val('s3q1Selected instanceof Set'), String(val('typeof s3q1Selected')));
  eq('resume', 'the Set\'s contents survive',
    val('JSON.stringify(Array.from(s3q1Selected).sort())'), '["a","b","c","d"]');
  ok('resume', 'the payload carries the Set as an array',
    val('Array.isArray(window.__snap.s3q1Selected)'));
  ok('resume', 'a const container restores field by field',
    val('s3State.q1') === true, 'eval("s3State = ...") would throw TypeError and be swallowed');

  /* Q[sid] mixes this release's CONFIG with the learner's STATE. Carrying config through
     the document and back would pin a returning learner to the answer key that was live
     when they started: a content fix would never reach them, and a corrected key would
     mark them wrong. */
  const p3 = loadComponent('03');
  p3.exec(`
    window.__before = JSON.stringify({ answers: Q.s26.answers, type: Q.s26.type, inputs: Q.s26.inputs });
    var snap = JSON.parse(JSON.stringify(capturePartPayload()));
    snap.q.s26.done = true;
    snap.q.s26.answers = ['TAMPERED'];      /* a document that claims to carry config */
    snap.q.s26.type = 'TAMPERED';
    applyResumeVars(snap);
    window.__after = JSON.stringify({ answers: Q.s26.answers, type: Q.s26.type, inputs: Q.s26.inputs });
  `);
  eq('resume', 'Q config is untouched by applyResumeVars',
    p3.val('window.__after'), p3.val('window.__before'));
  ok('resume', 'Q state IS restored', p3.val('Q.s26.done') === true);
  ok('resume', 'the payload never carried Q config in the first place',
    p3.val('(function(){var s=JSON.parse(JSON.stringify(capturePartPayload())); return Object.keys(s.q.s26).join(",");})()')
      === 'done,attempts,lastWrong,selected,picks,_popup',
    String(p3.val('Object.keys(JSON.parse(JSON.stringify(capturePartPayload())).q.s26).join(",")')));

  /* RESUME_INPUT_IDS is derived so a new defQ() cannot be forgotten */
  for (const c of COMPONENTS) {
    const w = loadComponent(c);
    const missing = w.val(`(function(){
      var miss = [];
      Object.keys(Q).forEach(function(sid){
        (Q[sid].inputs || []).forEach(function(id){
          if (RESUME_INPUT_IDS.indexOf(id) === -1) miss.push(sid + '/' + id);
        });
      });
      return miss.join(',');
    })()`);
    ok('resume', c + ' RESUME_INPUT_IDS covers every Q input', missing === '', String(missing));
  }

  /* the score keys the terminal component averages must be exactly the list 40-resume.js
     clears on ?resetState, or a reset document sits beside a stale cache */
  const w1 = loadComponent('01');
  eq('resume', 'UNIT_SCORE_KEYS matches RESULT_KEYS',
    w1.val('JSON.stringify(Object.keys(UNIT_SCORE_KEYS).map(function(k){return UNIT_SCORE_KEYS[k];}).sort())'),
    w1.val('JSON.stringify(RESULT_KEYS.slice().sort())'));
  eq('resume', 'UI_CHARACTER_KEY matches main.js\'s CHARACTER_STORAGE_KEY',
    w1.val('UI_CHARACTER_KEY'), w1.val('CHARACTER_STORAGE_KEY'));
  ok('resume', 'NAV_EDGE_KEY carries the unit slug',
    String(w1.val('NAV_EDGE_KEY')).indexOf(UNIT) > -1, String(w1.val('NAV_EDGE_KEY')));
}

/* ══════════════ 6. The painters ══════════════
   restoreScreenUI runs on a fresh page load, where every part loads this same main.js
   and is therefore routinely asked about screens it does not have. It must be a no-op
   on those, exception-safe, and idempotent. */

function checkPainters() {
  for (const c of COMPONENTS) {
    const { val } = loadComponent(c);
    const thrown = val(`(function(){
      var bad = [];
      for (var n = 0; n < ${TOTAL_SCREENS}; n++) {
        try { restoreScreenUI(n); } catch (e) { bad.push(n + ':' + e.message); }
      }
      return bad.join(', ');
    })()`);
    ok('paint', c + ' restoreScreenUI throws on no screen 0..' + (TOTAL_SCREENS - 1),
      thrown === '', String(thrown));

    const twice = val(`(function(){
      var bad = [];
      for (var n = ${RANGE[c][0]}; n <= ${RANGE[c][1]}; n++) {
        try {
          restoreScreenUI(n);
          var a = document.getElementById('s' + n) ? document.getElementById('s' + n).innerHTML : '';
          restoreScreenUI(n);
          var b = document.getElementById('s' + n) ? document.getElementById('s' + n).innerHTML : '';
          if (a !== b) bad.push(String(n));
        } catch (e) { bad.push(n + ':' + e.message); }
      }
      return bad.join(', ');
    })()`);
    ok('paint', c + ' restoreScreenUI is idempotent over its own range', twice === '', String(twice));
  }
}

/* ══════════════ 7. The boot cover ══════════════
   The one way this integration could leave a learner facing a blank page. */

function checkBootCover() {
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    const iCover = html.indexOf('id="boot-cover"');
    const iApp = html.indexOf('<div id="app">');
    ok('cover', c + ' has #boot-cover', iCover > -1);
    ok('cover', c + ' #boot-cover precedes #app', iCover > -1 && iApp > -1 && iCover < iApp);
    ok('cover', c + ' #boot-cover is inline-styled position:fixed',
      /id="boot-cover"[^>]*style="[^"]*position:fixed/.test(html),
      'a stale CSS cache must not be able to leave it invisible');
    ok('cover', c + ' has an inline failsafe that removes it',
      /getElementById\('boot-cover'\)[\s\S]{0,400}removeChild/.test(html),
      'it must depend on NO js file — a 40-resume.js that failed to load cannot be allowed to strand a learner');
    ok('cover', c + ' the failsafe waits on window.__resumeInFlight',
      /__resumeInFlight/.test(html));
    ok('cover', c + ' the failsafe ceiling is 11000ms',
      /Date\.now\(\)\s*-\s*t0\s*<\s*11000/.test(html),
      '50-loader.js allows 10s for the metadata poll alone, on top of two serial CDN scripts');
    ok('cover', c + ' has an aria-live announcer for announce()',
      /id="a11y-announcer"[^>]*aria-live="polite"/.test(html));
  }
  const loader = fs.readFileSync(path.join(BASE, 'unit-js/50-loader.js'), 'utf8');
  const drops = (loader.match(/dropBootCover\(\)/g) || []).length;
  ok('cover', '50-loader.js drops the cover on every exit path', drops >= 3, 'found ' + drops);
}

/* ══════════════ 8. The flush contract ══════════════
   A function that commits an answer MUST flush synchronously, and no `return` may sit
   between the commitment and the flush: goTo only arms a debounced save, and a stale
   timer can fire AFTER a forward write and send the next launch back into the part just
   finished. */

function checkFlushOnCommit() {
  const src = fs.readFileSync(path.join(BASE, 'unit-js/main.js'), 'utf8');
  /* every function that sets a done flag or calls setQResult is a commitment site */
  const COMMIT_FNS = ['qFinish', 's1Check', 's3q1Check', 's3q2Check', 's3ynCheck',
                      's15Check', 'scqCheck', 'mcqFinish', 's19Check', 's20Check', 's24Check'];
  for (const fn of COMMIT_FNS) {
    const i = src.indexOf('function ' + fn + '(');
    if (!ok('flush', fn + ' exists', i > -1)) continue;
    /* read to the next top-level function declaration */
    const rest = src.slice(i);
    const end = rest.indexOf('\nfunction ', 1);
    const body = end > -1 ? rest.slice(0, end) : rest;
    ok('flush', fn + ' flushes the state document', /flushResumeSave\(\)/.test(body),
      'an answer committed without a synchronous flush can be lost');
  }
}

/* ══════════════ 9. The report layer ══════════════ */

function checkReportLayer() {
  const { val } = loadComponent('02');
  ok('report', 'REPORT_FORM_ACTION is the shared 720 form',
    /docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse/.test(String(val('REPORT_FORM_ACTION'))),
    'one form serves all of 720 by the content owner\'s decision of 2026-08-13');
  ok('report', 'shortId trims the trailing slash',
    val('shortId("https://x/y/methodica-math-ratio-02-01/")') === 'methodica-math-ratio-02-01',
    'every id in metadata/ ends in "/", so a shortId without the trim returns ""');
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    for (const id of ['report-modal', 'report-confirm-modal', 'report-type', 'report-text',
                      'report-char-count']) {
      ok('report', c + ' markup has #' + id, html.indexOf('id="' + id + '"') > -1);
    }
    ok('report', c + ' markup has a .flag-btn', /class="[^"]*flag-btn/.test(html));
  }
  /* the decision recorded in main.js: no video is wired, because none is instructional */
  const src = fs.readFileSync(path.join(BASE, 'unit-js/main.js'), 'utf8');
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    ok('video', c + ' wires no video reporting',
      html.indexOf('data-xapi-report') === -1,
      'xapiWireVideos reports against the clip\u2019s ITEM; these clips are decoration');
  }
  ok('video', 'the no-video decision is documented in main.js',
    /No video reporting in this unit, deliberately/.test(src));
}

/* ══════════════ 10. The asset contract ══════════════
   Every failure mode in this section is SILENT in a browser. A missing font renders
   in a fallback face that looks plausible; a missing <img> renders as nothing at all.
   No exception, no console message beyond a network 404 nobody is watching.

   And nothing else in this file can see any of it: checkLoad builds its JSDOM with
   default `resources`, so jsdom never fetches <link rel=stylesheet>, <img> or <video>
   — it only hand-executes <script src>. Before this section existed, moving every
   asset in the unit broke exactly zero assertions.

   ratio-01 shipped this bug: all six of its stylesheets reached the fonts as
   ../assets/fonts/ while the fonts sat in <component>/assets/fonts/, so the entire
   unit rendered in a fallback typeface and no assertion noticed.

   The invariant, stated once:

     shared code  (unit-js/*.js, unit-css/styles.css)  references ONLY ../unit-assets/
     a component's own markup (index.html)             references ONLY assets/, in itself

   unit-js/main.js is ONE file executed from five different folders. A bare 'assets/…'
   literal there resolves to a different file per component — and to nothing at all in
   the components that do not hold it. That is not hypothetical: before the hoist, the
   8-pose CHARACTER_ASSETS table named baker/headphones assets that existed only in 01
   and peak assets that existed only in 05, and it worked purely because CHAR_SCREENS
   happened to map pose -> screen -> owning component correctly. */

/* Block comments only: the sole comment-borne 'assets/' mention in the shared layer is
   20-xapi.js's note about component 01's own selection clips, and no // line comment in
   unit-js/ mentions a path. Stripping // as well would truncate 'https://…' literals. */
const stripBlockComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* Directory segments must be lowercase — on a case-sensitive host a mixed-case segment
   404s. FILE names are exempt: the Assistant faces are legitimately capitalised. */
const dirSegsLower = u => u.split('/').slice(0, -1)
  .filter(s => s && s !== '..')
  .every(s => s === s.toLowerCase());

function checkAssetContract() {
  const sharedAssets = path.join(BASE, 'unit-assets');
  const cssPath = path.join(BASE, 'unit-css', 'styles.css');

  /* ── the shared roots exist ── */
  ok('assets', 'unit-css/styles.css is the one stylesheet for the unit', fs.existsSync(cssPath));
  const fontsDir = path.join(sharedAssets, 'fonts');
  const faces = fs.existsSync(fontsDir)
    ? fs.readdirSync(fontsDir).filter(f => /\.ttf$/i.test(f)) : [];
  ok('assets', 'unit-assets/fonts/ holds the shared faces', faces.length >= 7,
    faces.length ? faces.join(',') : 'missing');

  /* ── and nothing re-grows a per-component copy of what was hoisted ── */
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c));
    ok('assets', c + ': keeps no styles.css of its own',
      !fs.existsSync(path.join(dir, 'styles.css')));
    ok('assets', c + ': keeps no assets/fonts/ of its own',
      !fs.existsSync(path.join(dir, 'assets', 'fonts')));
  }

  /* ── every url() in the stylesheet resolves FROM THE STYLESHEET'S OWN DIRECTORY ──
     which is how a browser resolves a relative url() — NOT from the document that
     links it. Being wrong by one ../ here is the whole of the ratio-01 bug. */
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map(m => m[1].trim())
      .filter(u => !/^(?:data:|https?:|\/\/|#)/.test(u));
    ok('assets', 'styles.css references local assets to check', urls.length > 0,
      String(urls.length));
    for (const u of [...new Set(urls)]) {
      const resolved = path.resolve(path.dirname(cssPath), u.split(/[?#]/)[0]);
      ok('assets', 'styles.css url(' + u + ') resolves', fs.existsSync(resolved),
        'looked for ' + path.relative(BASE, resolved));
      ok('assets', 'styles.css url(' + u + ') has lowercase directories', dirSegsLower(u), u);
      ok('assets', 'styles.css url(' + u + ') points into unit-assets/',
        u.startsWith('../unit-assets/'), u);
    }
  }

  /* ── shared code references ONLY ../unit-assets/, and every literal it names
        resolves from EVERY component ── */
  const sharedCode = fs.readdirSync(path.join(BASE, 'unit-js'))
    .filter(f => f.endsWith('.js')).sort()
    .map(f => ['unit-js/' + f, path.join(BASE, 'unit-js', f)]);

  for (const [label, p] of sharedCode) {
    const src = stripBlockComments(fs.readFileSync(p, 'utf8'));

    const bare = [...src.matchAll(/(?:['"`]|src=")assets\//g)].map(m => m[0]);
    ok('assets', label + ' names no component-local assets/ path',
      bare.length === 0, bare.length + ' bare literal(s): ' + bare.join(' '));

    const lits = [...src.matchAll(/['"`](\.\.\/unit-assets\/[^'"`]*)/g)].map(m => m[1]);
    for (const u of [...new Set(lits)]) {
      ok('assets', label + ': ' + u + ' has lowercase directories', dirSegsLower(u), u);
      /* A literal ending in a slash is a CONCATENATION PREFIX (main.js builds the
         finale clip's name at runtime); assert the directory. Otherwise assert the file. */
      const isPrefix = u.endsWith('/');
      for (const c of COMPONENTS) {
        const resolved = path.resolve(BASE, PART_DIR(c), u);
        ok('assets', label + ': ' + u + ' resolves from part ' + c,
          fs.existsSync(resolved) &&
          (isPrefix ? fs.statSync(resolved).isDirectory() : fs.statSync(resolved).isFile()),
          'looked for ' + path.relative(BASE, resolved));
      }
    }
  }

  /* The two finale clips are named by concatenation in main.js and by nothing else, so
     the literal sweep above can only reach their directory. Name them explicitly. */
  for (const id of ['character-1', 'character-2']) {
    ok('assets', 'unit-assets/video/' + id + '-finale.mp4 exists (main.js builds this name)',
      fs.existsSync(path.join(sharedAssets, 'video', id + '-finale.mp4')));
  }

  /* Every pose the shared table can hand out must exist — this is the assertion that
     turns a mis-placed CHAR_SCREENS entry into a failure instead of a blank <img>. */
  const mainSrc = fs.readFileSync(path.join(BASE, 'unit-js', 'main.js'), 'utf8');
  const poses = [...mainSrc.matchAll(/\b(selection|headphones|baker|peak):\s*'([^']+)'/g)];
  ok('assets', 'CHARACTER_ASSETS declares both characters in all four poses',
    poses.length === 8, String(poses.length));
  for (const [, pose, u] of poses) {
    ok('assets', 'CHARACTER_ASSETS ' + pose + ' -> ' + u + ' exists',
      fs.existsSync(path.resolve(BASE, PART_DIR('01'), u)), u);
  }

  /* ── the <link>: one stylesheet, the unit's, with a ?v= uniform across parts ──
     §2's cache-buster contract only ever inspected <script src> tags starting
     ../unit-js/, so the stylesheet's ?v= was unguarded in both respects. */
  let linkV = null, linkC = null;
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c));
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1]);
    eq('assets', c + ': links exactly one stylesheet', links.length, 1);
    const [url, q] = (links[0] || '').split('?');
    ok('assets', c + ': links the unit stylesheet', url === '../unit-css/styles.css', String(url));
    ok('assets', c + ': the stylesheet href resolves',
      !!url && fs.existsSync(path.resolve(dir, url)), String(url));
    const v = (q || '').replace(/^v=/, '');
    ok('cachebust', c + ': the stylesheet carries a ?v= at all', v !== '', String(links[0]));
    if (linkV === null) { linkV = v; linkC = c; }
    else ok('cachebust', 'styles.css has the same ?v= in every part', linkV === v,
      'part ' + linkC + '=' + linkV + ' vs ' + c + '=' + v);
  }

  /* ── a component's own markup stays inside its own folder ── */
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c));
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const srcs = [...html.matchAll(/<(?:img|video|source)[^>]+src="([^"]+)"/g)]
      .map(m => m[1].trim())
      .filter(u => u && !/^(?:data:|https?:|\/\/)/.test(u));
    for (const u of [...new Set(srcs)]) {
      ok('assets', c + ': <img|video> ' + u + ' resolves',
        fs.existsSync(path.resolve(dir, u.split(/[?#]/)[0])), 'looked for ' + u);
      ok('assets', c + ': ' + u + ' is component-local, not reaching up',
        !u.startsWith('../'), u);
      ok('assets', c + ': ' + u + ' has lowercase directories', dirSegsLower(u), u);
    }
  }
}

/* ══════════════ 11. The documentation resolves ══════════════
   Prose is not executed, so nothing here was ever checked. In this repo four links
   to Documentation/ were dead for as long as they existed: unit-js/README.md reached
   ../../../Documentation/, but from unit-js/ the correct depth is ../../../../ —
   three levels lands on <project>/Documentation, which does not exist. The two
   companion links a reader is pointed at first, including the one the file calls
   "the authoritative guide", both 404'd.

   Only relative targets are checked. http(s), mailto and bare #anchors are somebody
   else's problem; a #fragment on a real file is stripped before the existence test. */

function checkDocLinks() {
  const mds = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.md$/i.test(e.name)) mds.push(p);
    }
  })(BASE);

  /* A package holds only DEPLOY.md, which carries no links — so only demand a full
     set of documents when this is a working tree. */
  if (fs.existsSync(path.join(BASE, '_test'))) {
    ok('docs', 'the repo has its .md files to check', mds.length >= 4, String(mds.length));
  }

  for (const f of mds) {
    const rel = path.relative(BASE, f).replace(/\\/g, '/');
    const links = [...fs.readFileSync(f, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)]
      .map(m => m[1])
      .filter(u => !/^(?:https?:|mailto:|#|<)/i.test(u));
    for (const u of [...new Set(links)]) {
      const target = u.split('#')[0];
      if (!target) continue;
      const resolved = path.resolve(path.dirname(f), target);
      ok('docs', rel + ' → ' + u + ' resolves', fs.existsSync(resolved),
        'looked for ' + path.relative(BASE, resolved));
    }
  }
}

/* ══════════════ 4b. The platform owns routing (2026-09-16) ══════════════
   Kata launches each component on its own URL with its own ?registration and
   routes on our 'completed'. So: no unit-level statement anywhere; every
   location.href= / location.replace( sits inside an `if (DEV_NAV)` block (or
   behind goBackToPreviousPart's `if (!DEV_NAV) return;`); the loader's resume
   hop is gone; DEV_NAV needs ?dev=1 AND no ?registration; and in a production
   boot the first screen's "חזרה" is hidden (attribute AND display) and
   goBackToPreviousPart moves nothing. README.md "The platform owns routing". */

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}


/* ══════════════ One document per component (v6, 2026-09-16) ══════════════
   Kata's registration is per {learner, component} and the platform may clear one component's
   document on a re-take. The document is flat — `component` + `payload` — migrated from v5 in
   place, never applied when it names another part, and the character travels 01 → 02.. through
   the same-browser mirror only. Groups: shape / isolation / retake / character. The store below is
   keyed by registration + state id, exactly as two Kata launches would be. */
function checkPerComponentState() {
  const stores = {};
  const warns = [];
  const bootS = (c, search) => {
    const dir = path.join(BASE, PART_DIR(c));
    const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
      url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html' + search,
      runScripts: 'dangerously', pretendToBeVisual: true,
    });
    const w = dom.window;
    const exec = (code) => { const s = w.document.createElement('script'); s.textContent = code; w.document.head.appendChild(s); s.remove(); };
    const val = (expr) => { exec('window.__v2 = (function(){ try { return (' + expr + '); } catch (e) { return "__throw:" + e.message; } })();'); return w.__v2; };
    w.console.error = w.console.log = () => {};
    w.console.warn = (m) => warns.push(String(m));
    w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    w.HTMLMediaElement.prototype.load = function () {};
    w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function () {};
    for (const src of [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))) {
      if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
      const p = path.resolve(dir, src.split('?')[0]);
      if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) {} }
    }
    const reg = new URL(w.location.href).searchParams.get('registration') || '';
    const key = (id) => reg + '::' + id;
    w.loadState720 = function (id) { const k = key(id); return stores[k] ? JSON.parse(stores[k]) : null; };
    w.saveState720 = function (id, doc) { stores[key(id)] = JSON.stringify(doc); return true; };
    w.saveState720Debounced = w.saveState720;
    w.__stmts2 = [];
    w.sendStatement720 = function (v, t, res, o) { w.__stmts2.push({ v, t, res, o }); };
    w.XAPI_USING_G = true;
    exec('window.METADATA = ' + fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^\uFEFF/, '') + ';');
    const seed = (doc) => { stores[key(val('RESUME_STATE_ID'))] = JSON.stringify(doc); };
    const stored = () => { const s = stores[key(val('RESUME_STATE_ID'))]; return s ? JSON.parse(s) : null; };
    return { w, exec, val, seed, stored, slug: PART_DIR(c), close: () => dom.window.close() };
  };
  const q = (r, extra) => '?slxapi=1&registration=' + r + (extra || '');
  const CK = 'methodica_math_ratio_02_selectedCharacter';

  // ── shape ──
  let b = bootS('01', q('r1'));
  ok('shape', 'emptyUnitState() has exactly the v6 fields',
    b.val('Object.keys(emptyUnitState()).sort().join()') === 'component,done,doneItems,hints,payload,picks,results,ui,v',
    String(b.val('Object.keys(emptyUnitState()).sort().join()')));
  ok('shape', 'a fresh document names this part', b.val('emptyUnitState().component') === b.slug);
  ok('shape', 'RESUME_STATE_ID carries the part slug',
    b.val('RESUME_STATE_ID') === 'execution-state::' + b.slug, String(b.val('RESUME_STATE_ID')));
  b.seed({ v: 5, part: 'x', parts: { [b.slug]: { currentScreen: 3 }, other: { currentScreen: 9 } }, prev: { a: 1 },
           done: { a: true }, doneItems: { b: true }, hints: { h: true }, picks: { p: true }, ui: { character: 'X' }, results: { k: '0.5' } });
  b.exec('readUnitState();');
  ok('shape', 'v5 → v6 migration keeps this part\'s slot as payload',
    b.val('_unitState.v') === 6 && b.val('_unitState.component') === b.slug && b.val('_unitState.payload.currentScreen') === 3,
    String(b.val('JSON.stringify(_unitState)')));
  ok('shape', 'v5 → v6 migration keeps the four ledgers, the character and the results',
    b.val('_unitState.done.a') === true && b.val('_unitState.doneItems.b') === true && b.val('_unitState.hints.h') === true &&
    b.val('_unitState.picks.p') === true && b.val('_unitState.ui.character') === 'X' && b.val('_unitState.results.k') === '0.5');
  ok('shape', 'v5 → v6 migration drops part, prev and parts',
    b.val("'part' in _unitState") === false && b.val("'prev' in _unitState") === false && b.val("'parts' in _unitState") === false);
  b.seed({ v: 5, part: 'x', parts: { other: { currentScreen: 9 } } });
  b.exec('readUnitState();');
  ok('shape', 'a v5 document with no slot for this part migrates to payload:null',
    b.val('_unitState.payload') === null && b.val('_unitState.v') === 6);
  b.seed({ v: 4, parts: { [b.slug]: { currentScreen: 3 } } });
  b.exec('readUnitState();');
  ok('shape', 'any other version is discarded', b.val('_unitState.payload') === null && b.val('_unitState.v') === 6);
  warns.length = 0;
  b.seed({ v: 6, component: 'other-slug', payload: { currentScreen: 7 }, done: { z: true } });
  b.exec('readUnitState();');
  ok('shape', 'a document that names another part is discarded…',
    b.val('_unitState.payload') === null && b.val('_unitState.component') === b.slug && b.val('Object.keys(_unitState.done).length') === 0);
  ok('shape', '…with a console.warn naming both parts',
    warns.some(m => /\[resume\] document belongs to "other-slug", not "/.test(m)), JSON.stringify(warns));
  b.exec('_resumeReady = true; readUnitState(); goTo(2);');
  ok('shape', 'captureUnitState().payload is capturePartPayload()',
    b.val('JSON.stringify(captureUnitState().payload) === JSON.stringify(capturePartPayload())') === true);
  b.close();

  // ── isolation ──
  const A = bootS('01', q('r1')), B = bootS('03', q('r2'));
  A.exec('_resumeReady = true; readUnitState(); goTo(3); flushResumeSave(); markSent("done", currentPartSlug());');
  B.exec('readUnitState();');
  ok('isolation', 'part B under its own registration sees an empty document',
    B.val('_unitState.payload') === null && B.val('Object.keys(_unitState.done).length') === 0);
  ok('isolation', 'part A\'s stored document never mentions part B',
    JSON.stringify(A.stored()).indexOf(B.slug) === -1 && A.stored().component === A.slug && A.stored().done[A.slug] === true,
    JSON.stringify(A.stored()));
  ok('isolation', 'only registrations that wrote have a document',
    Object.keys(stores).filter(k => k.indexOf('r2::') === 0).length === 0, Object.keys(stores).join());
  warns.length = 0;
  B.seed(A.stored());
  B.exec('readUnitState();');
  ok('isolation', 'another part\'s document under my registration is discarded, not applied',
    B.val('_unitState.payload') === null && warns.some(m => /document belongs to "/.test(m)));
  A.close(); B.close();

  // ── retake: Kata cleared the document; the same-browser mirrors still hold the last attempt ──
  b = bootS('02', q('r5'));
  b.exec("RESULT_KEYS.forEach(function (k) { localStorage.setItem(k, '1'); }); localStorage.setItem(CK_PLACEHOLDER, 'X'); window.lomdaState.selectedCharacter = null;".replace('CK_PLACEHOLDER', JSON.stringify(CK)));
  b.exec('readUnitState(); window.__payloadAtBoot = _unitState.payload; window.__changed = adoptUnitCharacter(_unitState);');
  ok('retake', 'an absent document leaves every recorded score null — the mirrors are not consulted',
    b.val("RESULT_KEYS.every(function (k) { return getUnitResult(k) === null; })") === true);
  ok('retake', 'the ledger is empty again, so the re-take will report completed',
    b.val("alreadySent('done', currentPartSlug())") === false);
  b.exec("_resumeReady = true; sendCompletedOnce('done', currentPartSlug(), 'onlinelesson', null);");
  ok('retake', 'the re-take\'s completed goes out', b.w.__stmts2.filter(s => s.v === 'completed').length === 1);
  ok('retake', 'nothing is restored', b.val('window.__payloadAtBoot === null') === true);
  ok('retake', 'the character IS adopted from the mirror (decision 2026-09-16)',
    b.val('window.lomdaState.selectedCharacter') === 'X' && b.val('_unitState.ui.character') === 'X' && b.w.__changed === true);
  b.close();

  // ── character: four steps, both stores ──
  b = bootS('01', q('r1'));
  b.exec("_resumeReady = true; readUnitState(); setUnitCharacter('X');");
  ok('character', '01: the choice lands in the mirror AND in this part\'s document',
    b.val('localStorage.getItem(' + JSON.stringify(CK) + ')') === 'X' && b.val('_unitState.ui.character') === 'X' &&
    b.stored() && b.stored().ui.character === 'X', JSON.stringify(b.stored()));
  b.close();
  b = bootS('03', q('r3'));
  b.seed({ v: 6, component: b.slug, ui: { character: 'Y' } });
  b.exec('localStorage.setItem(' + JSON.stringify(CK) + ", 'X'); readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '03 step 1: the document wins over the mirror, and the mirror follows',
    b.val('window.lomdaState.selectedCharacter') === 'Y' && b.val('localStorage.getItem(' + JSON.stringify(CK) + ')') === 'Y');
  b.close();
  b = bootS('03', q('r3b'));
  b.exec('localStorage.setItem(' + JSON.stringify(CK) + ", 'X'); window.lomdaState.selectedCharacter = null; readUnitState(); window.__changed = adoptUnitCharacter(_unitState);");
  ok('character', '03 steps 2+3: an empty document adopts the mirror into memory and into the document',
    b.val('window.lomdaState.selectedCharacter') === 'X' && b.val('_unitState.ui.character') === 'X' &&
    b.val('getUnitCharacter()') === 'X' && b.w.__changed === true);
  ok('character', '03 step 3: the mirror is NOT deleted (the old applyUnitProfile did)',
    b.val('localStorage.getItem(' + JSON.stringify(CK) + ')') === 'X');
  ok('character', '03 step 3: nothing is written before phase B…', b.stored() === null);
  b.exec('_resumeReady = true; drainPendingUnitState();');
  ok('character', '…and phase B persists the adopted character into this part\'s document',
    b.stored() && b.stored().ui.character === 'X' && b.stored().component === b.slug, JSON.stringify(b.stored()));
  b.close();
  b = bootS('03', q('r3c'));
  b.exec("readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '03 step 4: no document, no mirror → null, default stays',
    b.val('getUnitCharacter()') === null && b.val('localStorage.getItem(' + JSON.stringify(CK) + ')') === null);
  b.close();
  b = bootS('03', q('r3d', '&resetState'));
  ok('character', '?resetState: the hatch ran at boot and cleared the mirror',
    b.val('_resetRequested') === true && b.val('localStorage.getItem(' + JSON.stringify(CK) + ')') === null);
  b.exec('localStorage.setItem(' + JSON.stringify(CK) + ", 'X'); readUnitState(); adoptUnitCharacter(_unitState);");
  ok('character', '?resetState: a mirror that reappears is NOT adopted — a reset adopts nothing',
    b.val('getUnitCharacter()') === null && b.val('window.lomdaState.selectedCharacter') === null);
  b.close();
}

/* ── Source scan for the v6 shape ── */
function checkStateShapeSource() {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  const files = fs.readdirSync(path.join(BASE, 'unit-js')).filter(n => /\.js$/.test(n)).map(n => 'unit-js/' + n)
    .concat(COMPONENTS.map(c => PART_DIR(c) + '/script.js'));
  for (const rel of files) {
    const src = strip(fs.readFileSync(path.join(BASE, rel), 'utf8'));
    ok('shape', rel + ': no landing pointer, no prev map, no parts map',
      !/\b(doc|_unitState|_saved|st|old)\.prev\b/.test(src) && !/(?<!old)\.parts\[/.test(src) && !/\b(doc|_unitState|_saved|st)\.part\b/.test(src));
    ok('shape', rel + ': applyUnitProfile is gone', !/applyUnitProfile/.test(src));
  }
  const rs = strip(fs.readFileSync(path.join(BASE, 'unit-js/40-resume.js'), 'utf8'));
  ok('shape', '40-resume.js: RESUME_STATE_VERSION is 6', /var RESUME_STATE_VERSION = 6;/.test(rs));
  ok('shape', '40-resume.js: RESUME_STATE_ID is per part',
    /var RESUME_STATE_ID\s*=\s*'execution-state::' \+ currentPartSlug\(\);/.test(rs));
  ok('shape', '40-resume.js: readUnitState migrates, then refuses another part\'s document with a warning',
    /doc = migrateState\(doc\);[\s\S]{0,200}doc\.component !== currentPartSlug\(\)[\s\S]{0,200}console\.warn\(/.test(rs));
  const adopt = /function adoptUnitCharacter\(doc\)\s*\{[\s\S]*?\n\}/.exec(rs);
  ok('shape', '40-resume.js: adoptUnitCharacter never deletes the mirror',
    !!adopt && !/_lsDel/.test(adopt[0]) && /_lsGet\(UI_CHARACTER_KEY\)/.test(adopt[0]) && /_pendingProfile = \{ character: c \}/.test(adopt[0]));
  const ld = strip(fs.readFileSync(path.join(BASE, 'unit-js/50-loader.js'), 'utf8'));
  ok('shape', '50-loader.js: phase A restores payload and adopts the character',
    /_payload = _saved\.payload;/.test(ld) && /adoptUnitCharacter\(_saved\)/.test(ld));
  ok('shape', 'writeForwardState keeps its three-argument signature for the callers',
    /function writeForwardState\(destSlug, returnHash, destFirstScreen\)/.test(rs));
}

function checkPlatformRouting() {
  const shared = fs.readdirSync(path.join(BASE, 'unit-js')).filter(f => f.endsWith('.js')).sort();
  const files = [...shared.map(f => 'unit-js/' + f), ...COMPONENTS.map(c => PART_DIR(c) + '/script.js')];
  for (const rel of files) {
    const code = stripComments(fs.readFileSync(path.join(BASE, rel), 'utf8'));
    ok('routing', rel + ': no unit-level statement (xapiCompleteUnit / scope unit)',
      !/xapiCompleteUnit\s*\(/.test(code) && !/scope\s*:\s*['"]unit['"]/.test(code));
    for (const m of code.matchAll(/location\.(href\s*=(?!=)|replace\s*\()/g)) {
      const before = code.slice(Math.max(0, m.index - 1200), m.index);
      const at = before.lastIndexOf('if (DEV_NAV) {');
      let openBlock = false;
      if (at !== -1) {
        const tail = before.slice(at + 'if (DEV_NAV) {'.length);
        openBlock = (tail.split('{').length - 1) - (tail.split('}').length - 1) >= 0;
      }
      const guarded = /if \(!DEV_NAV\) return;(?![\s\S]*\nfunction )/.test(before);
      ok('routing', rel + ': the hop at offset ' + m.index + ' is gated on DEV_NAV',
        openBlock || guarded, m[0]);
    }
  }
  const ident = fs.readFileSync(path.join(BASE, 'unit-js', '10-identity.js'), 'utf8');
  ok('routing', "10-identity.js: DEV_NAV needs ?dev=1 AND no ?registration",
    /get\('dev'\)\s*===\s*'1'\s*&&\s*!\w+\.has\('registration'\)/.test(ident));
  const loader = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '50-loader.js'), 'utf8'));
  ok('routing', '50-loader.js: the resume hop to _saved.part is gone',
    !/_saved\.part\s*!==\s*currentPartSlug\(\)/.test(loader) && !/location\.replace/.test(loader));
  ok('routing', '50-loader.js: the harness flag reads DEV_NAV, not its own ?dev=1',
    /var _devHarness = DEV_NAV;/.test(loader) && !/get\('dev'\)/.test(loader));
  const resume = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8'));
  ok('routing', '40-resume.js: goBackToPreviousPart returns unless DEV_NAV',
    /function goBackToPreviousPart\([^)]*\)\s*\{\s*if \(!DEV_NAV\) return;/.test(resume));
  ok('routing', '40-resume.js: hideCrossPartBack hides #s<start> .scq-back unless DEV_NAV, attribute and display',
    /function hideCrossPartBack\(\)\s*\{\s*if \(DEV_NAV\) return;[\s\S]{0,400}\.scq-back[\s\S]{0,200}style\.display = 'none'/.test(resume));
  const boot = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', '90-boot.js'), 'utf8'));
  ok('routing', '90-boot.js calls hideCrossPartBack() after partBoot() and before bootXAPI()',
    boot.indexOf('partBoot()') > -1 && boot.indexOf('partBoot()') < boot.indexOf('hideCrossPartBack()') &&
    boot.indexOf('hideCrossPartBack()') < boot.indexOf('bootXAPI()'));
  const main = stripComments(fs.readFileSync(path.join(BASE, 'unit-js', 'main.js'), 'utf8'));
  ok('routing', 'main.js: leaveToPart ends the component via xapiEndComponent(res, lastScreenButton()) and hops only under DEV_NAV',
    /function leaveToPart[\s\S]{0,300}xapiEndComponent\(res, lastScreenButton\(\)\)[\s\S]{0,300}if \(DEV_NAV\) \{[\s\S]{0,600}location\.replace\(/.test(main));
  ok('routing', 'main.js: finishUnit reports the component only, via xapiEndComponent',
    /function finishUnit[\s\S]{0,300}xapiEndComponent\(res, lastScreenButton\(\)\)/.test(main) &&
    !/function finishUnit[\s\S]{0,400}xapiCompleteUnit/.test(main));
  ok('routing', 'main.js: goToNextPart and unitResult are gone (dead under the platform model)',
    !/function goToNextPart/.test(main) && !/function unitResult/.test(main));

  /* Production boots: flag off, first-screen back hidden, back function inert, no unit helper. */
  for (const c of COMPONENTS) {
    const { dom, val, exec, consoleErrors } = loadComponent(c);
    ok('routing', c + ': DEV_NAV is false in a production boot', val('DEV_NAV') === false, String(val('DEV_NAV')));
    ok('routing', c + ': xapiCompleteUnit no longer exists', val('typeof xapiCompleteUnit') === 'undefined');
    ok('routing', c + ': the last screen has a button for xapiEndComponent to disable',
      val('!!lastScreenButton()') === true, String(val('PART_CONFIG.end')));
    if (c !== '01') {
      const sel = "document.querySelector('#s' + PART_CONFIG.start + ' .scq-back')";
      ok('routing', c + ': the first screen has the generic "חזרה"', val('!!' + sel) === true);
      ok('routing', c + ': …and it is hidden by hideCrossPartBack — attribute AND display',
        val(sel + '.hidden') === true && val('getComputedStyle(' + sel + ').display') === 'none',
        'hidden=' + val(sel + '.hidden') + ' display=' + val('getComputedStyle(' + sel + ').display'));
      exec("_resumeReady = true; _unitState = emptyUnitState(); window.__saves = 0; window.saveState720 = function () { window.__saves++; return true; };");
      const errsBefore = consoleErrors.length;
      exec("goBackToPreviousPart(PART_CONFIG.prev, '#screen=' + (PART_CONFIG.start - 1));");
      ok('routing', c + ': goBackToPreviousPart() writes nothing in production',
        val('window.__saves') === 0 && consoleErrors.length === errsBefore,
        'saves=' + val('window.__saves') + ' / ' + consoleErrors.slice(errsBefore).join(' | '));
      exec('goTo(PART_CONFIG.start - 1);');
      ok('routing', c + ': goTo below the first screen stays on it',
        val('currentScreen') === val('PART_CONFIG.start'));
    }
    dom.window.close();
  }

  /* The flag's two conditions, live, on component 03. */
  const flag = (search) => {
    const { dom, val } = loadComponent('03', { search });
    const sel = "document.querySelector('#s' + PART_CONFIG.start + ' .scq-back')";
    const r = { DEV_NAV: val('DEV_NAV'),
                backHidden: val(sel + '.hidden') === true && val('getComputedStyle(' + sel + ').display') === 'none' };
    dom.window.close();
    return r;
  };
  let r = flag('');
  ok('devnav', 'no query: DEV_NAV false, back hidden', r.DEV_NAV === false && r.backHidden === true, JSON.stringify(r));
  r = flag('?dev=1');
  ok('devnav', '?dev=1 alone: DEV_NAV true, back shown', r.DEV_NAV === true && r.backHidden === false, JSON.stringify(r));
  r = flag('?dev=1&registration=r1');
  ok('devnav', '?dev=1&registration: DEV_NAV false, back hidden — a launch URL never opens navigation',
    r.DEV_NAV === false && r.backHidden === true, JSON.stringify(r));
}

/* ══════════════ the set gate ══════════════
   s21 promises "ענו נכון על 2 שאלות ומעלה כדי להתקדם" and nothing enforced it until 17.09:
   advanceScreen() asked only whether a screen was DONE, and done is set on the second WRONG attempt
   too. The gate stops the component instead and lets the PLATFORM route on the 'completed'.

   statement-flow.js walks the learner through it. This pins the wiring — above all the two places
   it must NOT be (inside leaveToPart/finishUnit, whose own assertions run on tight proximity
   windows) — and the fail-open behaviour, which no walk can reach because every walk answers. */
function checkSetGate() {
  const raw = fs.readFileSync(path.join(BASE, 'unit-js', 'main.js'), 'utf8');
  const main = stripComments(raw);

  ok('gate', 'main.js: advanceScreen consults the gate LAST, immediately before goTo',
    /function advanceScreen[\s\S]{0,1500}if \(gateBlocks\(currentScreen\)\) \{ endComponentHere\(SET_GATES\[currentScreen\]\.btn\); return; \}\s*goTo\(currentScreen \+ 1\);/.test(main));
  ok('gate', 'main.js: the gate is NOT wired into leaveToPart or finishUnit',
    !/function leaveToPart[\s\S]{0,400}gateBlocks/.test(main) &&
    !/function finishUnit[\s\S]{0,400}gateBlocks/.test(main));
  ok('gate', 'main.js: endComponentHere reports through xapiEndComponent + recordPartResult, then flushes',
    /function endComponentHere[\s\S]{0,400}xapiEndComponent\(res, document\.getElementById\(btnId\)\)[\s\S]{0,300}recordPartResult\(res\)[\s\S]{0,200}flushResumeSave\(\)/.test(main));
  ok('gate', 'main.js: endComponentHere navigates nowhere — the platform moves the learner',
    !/function endComponentHere[\s\S]{0,500}(location\.|leaveToPart\(|finishUnit\(|goTo\()/.test(main));
  ok('gate', 'main.js: applyExecutionState re-applies the gate LAST, after xapiOnScreen',
    /xapiOnScreen\(currentScreen\); \} catch \(e\) \{\}\s*try \{ restoreEndedButton\(currentScreen\); \} catch \(e\) \{\}/.test(main));
  ok('gate', 'main.js: restoreEndedButton needs BOTH the gate and the ledger, and never reports',
    /function restoreEndedButton[\s\S]{0,600}gateBlocks\(n\)[\s\S]{0,400}alreadySent\('done', currentPartSlug\(\)\)/.test(main) &&
    !/function restoreEndedButton[\s\S]{0,600}(endComponentHere|xapiEndComponent|sendStatement|sendCompleted)/.test(main));

  /* The gate adds no persisted state — that is what keeps it out of RESUME_STATE_VERSION and out of
     the exactly-asserted payload/document shapes. It is derived from qResults + the ledger. */
  ok('gate', 'main.js: the gate persists nothing of its own',
    !/RESUME_PLAIN_VARS[\s\S]{0,400}gate/i.test(main) && !/capturePartPayload[\s\S]{0,600}gate/i.test(main));

  const { dom, val } = loadComponent('03');

  eq('gate', 'SET_GATES gates screen 24 only — set B, needing 2, through s24-check',
    JSON.parse(val('JSON.stringify(SET_GATES)')), { 24: { set: 'B', need: 2, btn: 's24-check' } });
  ok('gate', 'the gated screen sits inside component 03\'s own range',
    Object.keys(JSON.parse(val('JSON.stringify(SET_GATES)'))).every(
      n => Number(n) >= RANGE['03'][0] && Number(n) <= RANGE['03'][1]));
  ok('gate', 'the gate\'s button exists in the markup', val("!!document.getElementById('s24-check')") === true);
  ok('gate', 'need is reachable: 0 < need <= QSET_SIZE[set]',
    val('SET_GATES[24].need > 0 && SET_GATES[24].need <= QSET_SIZE[SET_GATES[24].set]') === true);
  ok('gate', 'need matches the promise printed on s21 ("2 שאלות ומעלה")',
    /ענו נכון על 2 שאלות ומעלה/.test(fs.readFileSync(path.join(BASE, PART_DIR('03'), 'index.html'), 'utf8')) &&
    val('SET_GATES[24].need') === 2);

  /* Verdicts against explicit qResults fixtures — the fail-open cases are unreachable by walking. */
  const verdict = (r) => {
    val('(function(){ Object.keys(qResults).forEach(function(k){ delete qResults[k]; });' +
      'Object.assign(qResults, ' + JSON.stringify(r) + '); return 1; })()');
    return val('gateBlocks(24)');
  };
  ok('gate', 'FAILS OPEN on an empty qResults — a document the platform cleared',
    verdict({}) === false);
  /* ⚠️ This fixture must be one that a gate WITHOUT the resolved-count guard would block, or the
     assertion passes either way: 1 right + 1 still unanswered reads as "1 correct, need 2". */
  ok('gate', 'FAILS OPEN when set B is only partly resolved',
    verdict({ s22: false, s23: true }) === false);
  ok('gate', '3 of 3 passes', verdict({ s22: true, s23: true, s24: true }) === false);
  ok('gate', '2 of 3 passes — the promise, exactly', verdict({ s22: true, s23: true, s24: false }) === false);
  ok('gate', '2 of 3 passes wherever the two sit', verdict({ s22: false, s23: true, s24: true }) === false);
  ok('gate', '1 of 3 blocks', verdict({ s22: true, s23: false, s24: false }) === true);
  ok('gate', '0 of 3 blocks', verdict({ s22: false, s23: false, s24: false }) === true);
  ok('gate', 'an unrelated screen is never gated', val('gateBlocks(23) || gateBlocks(29)') === false);

  /* A gated learner can never clear XAPI_PASS, so the 'completed' always carries success:false —
     which is the whole reason recommendedAfterFail fires. Set B reports four catalogue questions
     (001/q1, 002/q1, 003/q1, 003/q2) and at most one station can be right. */
  ok('gate', 'every blocking combination scores below XAPI_PASS, so the completed is success:false',
    val(`(function(){
      return [[0,0,0],[1,0,0],[0,1,0],[0,0,1]].every(function(c){
        var keys = { '001/q1': !!c[0], '002/q1': !!c[1], '003/q1': !!c[2], '003/q2': !!c[2] };
        var n = Object.keys(keys).filter(function(k){ return keys[k]; }).length;
        return n / 4 < XAPI_PASS;
      });
    })()`) === true);

  dom.window.close();

  /* The other four components have no gated screen: their sets end at PART_CONFIG.end (A at s20,
     D at s37) or one thank-you screen short of it (E at s49, recommendedAfterFail: []), so there is
     nothing after them to block and leaveToPart/finishUnit already report the score. */
  for (const c of COMPONENTS.filter(x => x !== '03')) {
    const { dom: d, val: v } = loadComponent(c);
    ok('gate', c + ': no gated screen inside its range',
      Object.keys(JSON.parse(v('JSON.stringify(SET_GATES)')))
        .every(n => Number(n) < RANGE[c][0] || Number(n) > RANGE[c][1]));
    d.window.close();
  }
}

/* ══════════════ run ══════════════ */

const SUITES = [
  ['load + API surface', checkLoad],
  ['deploy contract', checkDeployContract],
  ['no cross-layer collisions', checkNoCollisions],
  ['config vs metadata', checkConfigAgainstMetadata],
  ['one document per component', checkPerComponentState],
  ['the v6 shape (source)', checkStateShapeSource],
  ['the platform routes', checkPlatformRouting],
  ['the set gate', checkSetGate],
  ['resume round-trip', checkResumeRoundTrip],
  ['painters', checkPainters],
  ['boot cover', checkBootCover],
  ['flush on commit', checkFlushOnCommit],
  ['report layer', checkReportLayer],
  ['asset contract', checkAssetContract],
  ['docs resolve', checkDocLinks],
];

for (const [name, fn] of SUITES) {
  const before = failures.length;
  try { fn(); }
  catch (e) { failures.push('[SUITE ' + name + '] threw: ' + e.stack); }
  const added = failures.length - before;
  console.log((added === 0 ? '  ok   ' : '  FAIL ') + name + (added ? '  (' + added + ')' : ''));
}

console.log('\n' + passes + ' assertions passed, ' + failures.length + ' failed');
if (failures.length) {
  console.log('\n' + failures.join('\n'));
  process.exit(1);
}

/* ══════════════ documentation reconciliation ══════════════
   NOT an ok() assertion, and that is deliberate: it needs the FINAL total, and an
   assertion that ran late enough to know the total would also have incremented it —
   it could never agree with a number written down before it ran. So it runs after
   the summary and fails the process on its own.

   It exists because documented counts went stale silently and repeatedly: this
   family had `~1000`, `~53`, `1540 + 56` and `~885` in prose while the suites ran
   quite different numbers. A count nothing checks is worse than no count, because
   it is read as authoritative.

   Only this suite's own number is checked here; statement-flow.js checks its own. */
{
  const claims = [];
  for (const rel of ['_test/README.md', 'README.md']) {
    const p = path.join(BASE, rel);
    if (!fs.existsSync(p)) continue;
    const md = fs.readFileSync(p, 'utf8');
    /* "**Structure.** 884 assertions"  and  "884 + 42 assertions" — this suite is
       the first number in the pair, statement-flow.js the second. */
    for (const m of md.matchAll(/\*\*Structure\.\*\*\s+([\d,]+)\s+assertions/g)) {
      claims.push({ rel, text: m[0], n: +m[1].replace(/,/g, '') });
    }
    for (const m of md.matchAll(/([\d,]+)\s*\+\s*[\d,]+\s+assertions/g)) {
      claims.push({ rel, text: m[0], n: +m[1].replace(/,/g, '') });
    }
  }
  const wrong = claims.filter(c => c.n !== passes);
  if (wrong.length) {
    console.log('\nDOCUMENTATION IS STALE — this suite ran ' + passes + ' assertions:');
    for (const c of wrong) {
      console.log('  ' + c.rel + ' claims ' + c.n + '  ("' + c.text.trim() + '")');
    }
    console.log('Update those to ' + passes + ', or the number stops meaning anything.');
    process.exit(1);
  }
  if (claims.length) {
    console.log('docs agree: ' + claims.length + ' documented count(s) all say ' + passes);
  }
}
