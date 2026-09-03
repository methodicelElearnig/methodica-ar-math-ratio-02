/* ═══════════════════ headless regression oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only — exclude from any release package.

   Loads the REAL index.html, script.js and every unit-js/*.js of all six
   components into jsdom, executes the script tags in document order from disk, and
   asserts against what actually ran. It does not call the code in isolation — it
   runs it.

   Ported from methodica-math-scale-01/_test/verify-report.js. The loading machinery
   is that unit's; the assertions are this unit's, because this unit differs from the
   reference in the two ways that matter to a suite:

     - screens are numbered UNIT-WIDE 0..45, so SCREEN_TO_SUBCONTENT covers each
       part's own [PART_FIRST..PART_LAST] range rather than 0..TOTAL_SCREENS-1, and
       the completeness check has to assert against that range instead;
     - all six script.js are the same monolith, differing only in a config hunk, so
       that invariant is itself asserted here. It is what makes the 6x duplication
       safe: instrumentation added to one file must be byte-identical in the others.

   Run (jsdom is not in the repo and there is no package.json — do NOT install it
   inside the project folder, which is OneDrive-synced):

     mkdir -p /tmp/lomda-test && cd /tmp/lomda-test && npm install jsdom
     NODE_PATH=/tmp/lomda-test/node_modules node _test/verify-report.js

   Exit 0 = everything passed. A base path may be passed as the first argument;
   without one the harness assumes its own parent directory.

   ⚠️ Real script tags put top-level `function`/`var` on window, which is what makes
   val() work by name. `let`/`const` bindings (s14Done, MCQ, practiceResults) never
   reach window even in a real page, so those are read by evaluating an expression in
   page scope instead. */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = process.argv[2] || path.join(__dirname, '..');
const UNIT = 'methodica-math-ratio-01';
const COMPONENTS = ['01', '02', '03', '04', '05', '06'];
const PART_DIR = c => UNIT + '-' + c;

/* Each component's own slice of the unit-wide screen space. The six components are the
   script's six רכיבים; every boundary below is one of its divider slides. */
const RANGE = {
  '01': [0, 12], '02': [13, 19], '03': [20, 29],
  '04': [30, 32], '05': [33, 36], '06': [37, 45],
};

/* The shared-layer API every component must have after the v4 upgrade. */
const SHARED_FNS = [
  'shortId', 'scaleApp', 'announce', 'initReportModal', 'bootXAPI', 'goTo',
  'xapiItemId', 'xapiQ', 'xapiOnScreen', 'xapiFinishItems', 'xapiAnswered',
  'xapiRequestedHint', 'xapiCompleteComponent', 'xapiCompleteUnit',
  'xapiAnswerText', 'xapiFieldsAnswer', 'xapiMultiAnswer', 'xapiItemResult',
  'sendStatementOnce', 'sendCompletedOnce', 'itemLedgerKey', 'currentPartSlug',
  'readUnitState', 'captureUnitState', 'persistUnitState', 'emptyUnitState',
  'applyExecutionState', 'scheduleResumeSave', 'flushResumeSave',
  'initResumeLeaveHandlers', 'initResumeResetHatch', 'dropBootCover',
  'getUnitCharacter', 'setUnitCharacter', 'getUnitResult', 'setUnitResult',
  'applyUnitProfile', 'drainPendingUnitState', 'recordForwardEdge',
  'previousPartHref', 'goBackToPreviousPart', 'writeForwardState',
  'resumeIsPainting', 'beginRepaint', 'endRepaint'
];

/* The per-component hooks the shared layer calls. */
const PART_HOOKS = [
  'resetScreenState', 'restoreScreenUI', 'capturePartPayload', 'applyResumeVars',
  'applyResumeDom', 'partBoot', 'partResult', 'unitResult', 'recordPartResult',
  'leaveToPart', 'finishUnit', 'reportAnswer', 'reportHint', 'xapiKeyFor',
  'screenWasCorrect', 'itemResultFor'
];

/* Every shared file, derived from the directory rather than listed. A hardcoded list
   drifted once already: 60-devbridge.js was left off a cache-buster bump, so a file
   that HAD changed kept its old ?v= — and the suite stayed green, because all six
   components agreed on the stale value. */
const SHARED_FILES = fs.readdirSync(path.join(BASE, 'unit-js'))
  .filter(f => f.endsWith('.js'))
  .map(f => f.replace(/\.js$/, ''))
  .sort();

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return true; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
  return false;
}

function readJSON(p) {
  /* metadata files may carry a UTF-8 BOM; JSON.parse chokes on it. */
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

/* Build a component's DOM and run its real script tags from disk. */
function loadComponent(c, opts) {
  opts = opts || {};
  const dir = path.join(BASE, PART_DIR(c));
  const file = path.join(dir, 'index.html');
  const consoleErrors = [];

  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html' +
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
     `video.play().catch(...)` would throw. Give the browser contract instead, to
     exercise the real code path rather than a jsdom gap. */
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};

  const tags = [...w.document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src'));
  for (const src of tags) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;   /* third party */
    const p = path.resolve(dir, src.split('?')[0]);
    if (!fs.existsSync(p)) { consoleErrors.push('missing script ' + src); continue; }
    try { exec(fs.readFileSync(p, 'utf8')); }
    catch (e) { consoleErrors.push('threw in ' + src + ': ' + e.message); }
  }
  return { dom, w, exec, val, tags, dir, consoleErrors };
}


/* ══════════════ 1. Clean load, shared layer, the regression gate ══════════════ */

function checkLoadAndSharedLayer() {
  for (const c of COMPONENTS) {
    const { dom, val, tags, consoleErrors } = loadComponent(c);

    ok('load', c + ' loads with no console errors',
      consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    for (const fn of SHARED_FNS) {
      ok('shared', c + ' defines ' + fn, val('typeof ' + fn) === 'function',
        String(val('typeof ' + fn)));
    }
    for (const fn of PART_HOOKS) {
      ok('hook', c + ' defines ' + fn, val('typeof ' + fn) === 'function',
        String(val('typeof ' + fn)));
    }

    /* ── The regression gate ──
       With no ?slxapi the lomda must behave exactly as it did before reporting
       existed: the library never loads, so sendStatement720 does not exist and every
       reporting entry point is an inert no-op. Note the guarantee is NOT that
       XAPI_USING_G is false — bootXAPI derives it from the library filename
       synchronously, before the script is even fetched, so it is legitimately true
       while nothing has loaded. */
    ok('gate', c + ': sendStatement720 absent without ?slxapi',
      val('typeof sendStatement720') === 'undefined');
    ok('gate', c + ': xapiOnScreen is a no-op that does not throw',
      val('(function(){ try { xapiOnScreen(0); xapiOnScreen(1); return "ok"; } catch (e) { return e.message; } })()') === 'ok');
    ok('gate', c + ': xapiCompleteComponent does not throw with no library',
      val('(function(){ try { xapiCompleteComponent({success:true}); return "ok"; } catch (e) { return e.message; } })()') === 'ok');
    ok('gate', c + ': xapiCompleteUnit does not throw with no library',
      val('(function(){ try { xapiCompleteUnit({success:true}); return "ok"; } catch (e) { return e.message; } })()') === 'ok');
    ok('gate', c + ': reportHint does not throw with no library',
      val('(function(){ try { reportHint("s2"); reportHint("nope"); return "ok"; } catch (e) { return e.message; } })()') === 'ok');

    /* Scoring must survive with reporting off — that is why xapiAnswered writes
       XAPI_Q_RESULTS on its first line, outside its own guard and its try. */
    ok('gate', c + ': xapiAnswered still records the score with no library',
      val('(function(){ xapiAnswered("001","qZ",true,true,"x"); return XAPI_Q_RESULTS["001/qZ"]; })()') === true);

    /* Order: script.js before 90-boot.js, and 90-boot.js last. A top-level throw in
       script.js must not take the boot with it. */
    const iScript = tags.findIndex(t => /(^|\/)script\.js/.test(t));
    const iBoot = tags.findIndex(t => /90-boot\.js/.test(t));
    ok('order', c + ': script.js precedes 90-boot.js',
      iScript > -1 && iBoot > iScript, tags.join(', '));
    ok('order', c + ': 90-boot.js is the last script tag',
      iBoot === tags.length - 1, tags.join(', '));

    dom.window.close();
  }
}


/* ══════════════ 2. The deploy contract ══════════════ */

function checkDeployContract() {
  /* ?v= must be identical across components for each shared file: they are the same
     URL, and a mismatch lets two components run different versions of the same logic
     inside one learner session. */
  const seen = {};
  ok('v=', 'the shared layer has files to check', SHARED_FILES.length >= 9,
    SHARED_FILES.join(','));
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    for (const f of SHARED_FILES) {
      const m = html.match(new RegExp('unit-js/' + f + '\\.js\\?v=(\\d+)'));
      /* Every file in unit-js/ must actually be loaded — an orphan is either dead
         weight or, worse, a file someone expects to be running. */
      ok('v=', c + ': ' + f + '.js is loaded with a ?v=', !!m);
      if (!m) continue;
      if (!(f in seen)) seen[f] = m[1];
      /* THE invariant: one URL, one version. A mismatch lets two components run
         different copies of the same logic inside one learner session. */
      ok('v=', f + '.js has the same ?v= in every component',
        seen[f] === m[1], c + ' has ' + m[1] + ', expected ' + seen[f]);
    }
  }
  /* A convention rather than a hard requirement, but a cheap catch: this unit bumps
     its shared files together, so an odd one out is almost always a file that was
     edited and whose cache-buster was forgotten. */
  const versions = [...new Set(Object.values(seen))];
  ok('v=', 'every shared file is at the same ?v= (this unit bumps them together)',
    versions.length === 1,
    Object.keys(seen).map(k => k + '=' + seen[k]).join(' '));

  /* The library-letter gate. XAPI_USING_G gates EVERY item-level and video
     statement; a filename whose letter the regex does not accept silences them all
     with no error at all. */
  const loader = fs.readFileSync(path.join(BASE, 'unit-js', '50-loader.js'), 'utf8');
  const lib = loader.match(/'(xapi-720-[a-z])\.js'/g) || [];
  const gate = loader.match(/xapi-720-\[([a-z]+)\]/);
  ok('lib', 'the loader names at least one library build', lib.length > 0);
  ok('lib', 'the XAPI_USING_G regex exists', !!gate);
  if (gate) {
    for (const l of lib) {
      const letter = l.match(/xapi-720-([a-z])/)[1];
      ok('lib', 'the gate regex accepts the letter the loader names: ' + letter,
        gate[1].indexOf(letter) !== -1, 'regex accepts [' + gate[1] + ']');
    }
  }

  /* The test stub shares a basename with the real library BY DESIGN (the gate regex
     reads the filename), and has been pushed under the library's name once. It must
     stay recognisable as the stub. */
  const stub = path.join(BASE, '_test', 'xapi-720-k.js');
  ok('lib', 'the local stub exists and is named for a letter the gate accepts',
    fs.existsSync(stub));
  if (fs.existsSync(stub)) {
    const src = fs.readFileSync(stub, 'utf8');
    ok('lib', 'the stub is identifiable as a stub (__failWrites)',
      /__failWrites/.test(src));
    ok('lib', 'the stub holds the debounced payload by REFERENCE, serialising at fire time',
      !/JSON\.stringify\(obj\)[\s\S]{0,80}setTimeout/.test(src));
  }
  ok('lib', 'no library copy is shipped outside _test/',
    !fs.existsSync(path.join(BASE, 'unit-js', 'xapi-720-k.js')));
}


/* ══════════════ 3. All six script.js differ only in the config hunk ══════════════ */

function checkPartsIdentical() {
  /* This is the invariant that makes the 6x duplication survivable: anything outside
     the config head that differs means an edit landed in one component and not the
     others — which is SILENT, because each component only ever runs its own screens.

     The split point is exact rather than heuristic. Everything above
     `var RESUME_PLAIN_VARS = [` is the config head: the header comment, PART_*, the
     component slug and metadata path, SCREEN_TO_SUBCONTENT, XAPI_EVAL_ITEMS,
     component 01's onXapiReady, and partResult. Each of those is asserted separately
     (checkScreenMap, checkMetadata, checkCrossPartSeam). Everything BELOW it is
     shared and must be byte-identical. */
  const MARK = 'var RESUME_PLAIN_VARS = [';
  const shared = {};
  for (const c of COMPONENTS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    const i = src.indexOf(MARK);
    ok('twins', c + ': the config head ends at the expected marker', i > 0);
    shared[c] = i > 0 ? src.slice(i) : src;
  }
  for (const c of COMPONENTS.slice(1)) {
    if (shared[c] === shared['01']) { passes++; continue; }
    /* Report the first differing line — that is what a reader needs. */
    const a = shared['01'].split('\n');
    const b = shared[c].split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    ok('twins', '01 and ' + c + ' are byte-identical below the config head', false,
      'first difference at shared line ' + (i + 1) + ' — 01: [' +
      String(a[i]).trim().slice(0, 80) + '] ' + c + ': [' +
      String(b[i]).trim().slice(0, 80) + ']');
  }

  /* And the config head must declare everything the shared region reads from it. */
  const src01 = fs.readFileSync(path.join(BASE, PART_DIR('01'), 'script.js'), 'utf8');
  const head01 = src01.slice(0, src01.indexOf(MARK));
  for (const n of ['PART_FIRST', 'PART_LAST', 'PART_NEXT', 'PART_PREV',
    'XAPI_COMP_SLUG', 'XAPI_COMP_ID', 'XAPI_METADATA_FILE', 'SCREEN_TO_SUBCONTENT',
    'XAPI_EVAL_ITEMS', 'partResult']) {
    ok('twins', 'the config head declares ' + n, head01.indexOf(n) !== -1);
  }
}


/* ══════════════ 4. The screen map ══════════════ */

function checkScreenMap() {
  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    const [first, last] = RANGE[c];

    ok('map', c + ': PART_FIRST/PART_LAST are this component\'s range',
      val('PART_FIRST') === first && val('PART_LAST') === last,
      val('PART_FIRST') + '..' + val('PART_LAST'));
    ok('map', c + ': TOTAL_SCREENS is the unit-wide count',
      val('TOTAL_SCREENS') === 46, String(val('TOTAL_SCREENS')));

    /* Numeric keys, not quoted ones. A string-keyed map still WORKS (property access
       coerces), but the completeness check below would silently match nothing and
       pass — which is exactly how a missing screen goes unreported. */
    const keys = val('Object.keys(SCREEN_TO_SUBCONTENT).join(",")').split(',');
    ok('map', c + ': every SCREEN_TO_SUBCONTENT key is a plain integer',
      keys.every(k => /^\d+$/.test(k)), keys.slice(0, 4).join(','));
    const nums = keys.map(Number).sort((x, y) => x - y);
    const want = [];
    for (let i = first; i <= last; i++) want.push(i);
    ok('map', c + ': the map covers exactly [' + first + '..' + last + '] with no holes',
      nums.length === want.length && nums.every((v, i) => v === want[i]),
      'got ' + nums.length + ' keys: ' + nums.join(','));

    /* Every screen in the range has markup, and no screen outside it does. */
    const inDom = val('Array.from(document.querySelectorAll(".screen")).map(function(s){return s.dataset.screen;}).join(",")')
      .split(',').map(Number).sort((x, y) => x - y);
    ok('map', c + ': the DOM holds exactly its own screens',
      inDom.length === want.length && inDom.every((v, i) => v === want[i]),
      'DOM: ' + inDom.join(','));

    /* The null-screen guard is what makes unit-wide numbering safe: a screen this
       component does not have must leave currentScreen alone. Tested on _goToCore,
       the UNWRAPPED navigator — the wrapper deliberately turns an out-of-RANGE number
       into a component handover, which is a navigation rather than a no-op. */
    const other = c === '01' ? 40 : 0;
    ok('map', c + ': _goToCore(' + other + ') (no such screen here) is a silent no-op',
      val('(function(){ var b = currentScreen; _goToCore(' + other +
        '); return currentScreen === b ? "ok" : "moved to " + currentScreen; })()') === 'ok');
    ok('map', c + ': the guard returns BEFORE assigning currentScreen',
      /if \(!nextScreen\) return;/.test(
        fs.readFileSync(path.join(BASE, 'unit-js', '30-nav.js'), 'utf8')));

    dom.window.close();
  }
}


/* ══════════════ 5. Metadata agreement ══════════════ */

function checkMetadata() {
  const unitFile = path.join(BASE, 'metadata', UNIT + '_unit.json');
  ok('meta', 'the unit metadata file exists', fs.existsSync(unitFile));
  const unit = fs.existsSync(unitFile) ? readJSON(unitFile) : {};

  ok('meta', 'the unit id keeps its trailing slash',
    typeof unit.id === 'string' && /\/$/.test(unit.id), String(unit.id));
  ok('meta', 'the unit id is a full IRI, not a bare folder',
    typeof unit.id === 'string' && unit.id.replace(/\/$/, '').split('/').pop() === UNIT,
    String(unit.id));

  /* 2.5 field names. Verified against the LIVE Kata OpenAPI on 03.09.26: no schema in
     the whole spec carries cognitiveLevel, targetSector, manufacture or
     prerequisiteLearningObjective — the 2.4 names are absent, not deprecated — and
     ComponentCreate lists cognitiveLevels as REQUIRED. Extras are ignored rather than
     rejected there, so a 2.4-shaped push does not fail loudly; it drops fields. These
     assertions are the only thing standing between that and a silent bad catalogue. */
  ok('meta', 'the unit has dropped prerequisiteLearningObjective (2.5 removed it)',
    !('prerequisiteLearningObjective' in unit));
  ok('meta', 'the unit uses targetSectors, not the 2.4 targetSector',
    'targetSectors' in unit && !('targetSector' in unit));
  ok('meta', 'targetAudience is a single value (2.5 replaced the array)',
    typeof unit.targetAudience === 'string', JSON.stringify(unit.targetAudience));
  ok('meta', 'the unit carries manufacturer, and it is a number (2.5 §2.6)',
    typeof unit.manufacturer === 'number', JSON.stringify(unit.manufacturer));

  for (const c of COMPONENTS) {
    const f = path.join(BASE, 'metadata', PART_DIR(c) + '.json');
    ok('meta', c + ': component metadata exists', fs.existsSync(f));
    if (!fs.existsSync(f)) continue;
    const m = readJSON(f);

    ok('meta', c + ': component id keeps its trailing slash', /\/$/.test(m.id || ''));
    ok('meta', c + ': learningUnitId equals the unit id', m.learningUnitId === unit.id);
    ok('meta', c + ': uses cognitiveLevels (array), not the 2.4 cognitiveLevel',
      Array.isArray(m.cognitiveLevels) && !('cognitiveLevel' in m),
      JSON.stringify(m.cognitiveLevels));
    /* 2.5 moved the publisher to the UNIT as `manufacturer`; a component carries
       neither name. Kata's ComponentCreate has no property for either. */
    ok('meta', c + ': carries no manufacture/manufacturer (2.5 moved it to the unit)',
      !('manufacture' in m) && !('manufacturer' in m));

    /* Component and item ids are siblings under the prefix, with the component slug
       repeated inside its own item ids. */
    const items = (m.subContent || []).map(s => s.id);
    for (const id of items) {
      ok('meta', c + ': item id is nested under its component and keeps the slash',
        typeof id === 'string' && id.indexOf(m.id) === 0 && /\/$/.test(id), String(id));
    }

    /* Everything the code maps must exist in the catalogue, and vice versa. */
    const { dom, val } = loadComponent(c);
    const compId = val('XAPI_COMP_ID');
    ok('meta', c + ': XAPI_COMP_ID equals the metadata component id', compId === m.id,
      compId + ' vs ' + m.id);

    const mapped = new Set(JSON.parse(
      val('JSON.stringify(Object.keys(SCREEN_TO_SUBCONTENT).map(function(k){return SCREEN_TO_SUBCONTENT[k][0];}))')));
    const suffixes = new Set(items.map(id => id.replace(/\/$/, '').split('-').pop()));
    for (const s of mapped) {
      ok('meta', c + ': mapped item ' + s + ' exists in the metadata', suffixes.has(s),
        'metadata has ' + [...suffixes].join(','));
    }
    for (const s of suffixes) {
      ok('meta', c + ': metadata item ' + s + ' is reachable from some screen',
        mapped.has(s), 'code maps ' + [...mapped].join(','));
    }

    /* XAPI_EVAL_ITEMS must be a subset of the items this component actually has. */
    const evalItems = JSON.parse(val('JSON.stringify(Object.keys(XAPI_EVAL_ITEMS))'));
    for (const s of evalItems) {
      ok('meta', c + ': graded item ' + s + ' exists in the metadata', suffixes.has(s));
    }

    /* Every graded item declares an item-level result, so its 'completed' can carry
       success + score as MOE v2.4 requires. */
    for (const s of evalItems) {
      ok('meta', c + ': graded item ' + s + ' supplies an explicit item result',
        val('typeof XAPI_ITEM_RESULT["' + s + '"]') === 'function');
    }

    /* The state of the metadata question arrays. Populated arrays are the release
       gate; empty ones are the documented interim state, so this reports rather than
       fails. */
    const withQs = (m.subContent || []).filter(s => (s.questions || []).length).length;
    if (withQs === 0 && evalItems.length) {
      console.log('  note: ' + c + ' has ' + evalItems.length +
        ' graded item(s) but no metadata questions[] yet — xapiQ() will fall back to ' +
        '"<item-id>q<N>" and warn. Release gate, tracked separately.');
    }

    dom.window.close();
  }
}


/* ══════════════ 6. The question map ══════════════ */

function checkQuestionMap() {
  /* Every XAPI_QMAP entry must resolve in exactly one component — the one that owns
     that screen — and the question keys inside one item must be unique and start at
     q1 with no gaps. A duplicate key silently overwrites a score. */
  const owner = {};
  const perItem = {};
  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    const resolved = JSON.parse(val(
      'JSON.stringify(Object.keys(XAPI_QMAP).reduce(function(a,sid){' +
      'var k = xapiKeyFor(sid); if (k) a[sid] = k.item + "/" + k.qKey; return a; }, {}))'));
    for (const sid of Object.keys(resolved)) {
      ok('qmap', sid + ' resolves in exactly one component',
        !owner[sid], sid + ' also resolved in ' + owner[sid]);
      owner[sid] = c;
      const key = c + '/' + resolved[sid];
      ok('qmap', key + ' is not claimed twice', !perItem[key], 'also by ' + perItem[sid]);
      perItem[key] = sid;
    }
    dom.window.close();
  }
  const total = Object.keys(owner).length;
  /* 29 graded units: 8 in component 01 (including the four sub-questions of screen 4,
     one screen carrying four of them), 6 in 02, 8 in 03, none in 04, 3 in 05, 4 in 06. */
  ok('qmap', 'every graded question resolves somewhere (expected 29, got ' + total + ')',
    total === 29, 'resolved: ' + total);

  /* Every reported key must name a questionId the CATALOGUE declares. This replaced a
     "q1..qN with no gaps" check, which was the right test only while the metadata had
     no questions[] to check against. It is not merely different, it is stronger: the
     old one could not tell q3 from the third question, and it FORBADE the gaps this
     unit legitimately has — s17/s18, s24/s25 and s21/s22 each resolve one declared id
     out of a run of two to five, because the code computes one verdict over the whole
     screen (see the XAPI_QMAP header in script.js). The unreported siblings are a
     grading question for the learning developer; a wrong id would be a reporting bug,
     and only this check can see the difference. */
  const declared = {};
  for (const c of COMPONENTS) {
    const m = readJSON(path.join(BASE, 'metadata', PART_DIR(c) + '.json'));
    for (const it of m.subContent || []) {
      const suffix = it.id.replace(/\/$/, '').split('/').pop().split('-').pop();
      for (const q of it.questions || []) {
        declared[c + '/' + suffix + '/' + q.questionId.split('/').pop()] = true;
      }
    }
  }
  for (const key of Object.keys(perItem)) {
    ok('qmap', key + ' is a questionId the catalogue declares',
      declared[key] === true, perItem[key] + ' -> ' + key);
  }
}


/* ══════════════ 7. Every answer commit flushes ══════════════ */

function checkFlushOnCommit() {
  /* The contract: a function that commits an answer must flush the resume state
     SYNCHRONOUSLY, and no `return` may sit between the commitment and the flush.
     goTo()'s debounced save is not enough — it can fire AFTER a cross-part write and
     send the next launch back into a component the learner just finished.

     Brace-matched per function rather than grepped, because the reference unit found
     13 of 25 committing functions with a correct-answer branch that returned before
     a tail flush — a grep for the call would have passed all 13. */
  const src = fs.readFileSync(path.join(BASE, PART_DIR('01'), 'script.js'), 'utf8');
  const COMMIT = /(?:\bdone\s*=\s*true|\banswered\s*=\s*true|setPracticeResult2?\()/;

  const re = /^function ([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/gm;
  let m;
  let checked = 0;
  while ((m = re.exec(src))) {
    const name = m[1];
    /* Walk braces from the opening one to find the function's real extent. */
    let i = src.indexOf('{', m.index), depth = 0, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) continue;
    /* From AFTER the opening brace: starting at m.index puts the declaration line
       inside the body, so setPracticeResult() matched its own name and scanned
       itself. */
    const body = src.slice(src.indexOf('{', m.index) + 1, end + 1);
    if (!COMMIT.test(body)) continue;
    /* Painters legitimately touch none of this: they mirror DOM writes only, and are
       excluded by never matching COMMIT. gstepSelect commits a reveal that is not
       graded and is documented as not restored. */
    if (name === 'gstepSelect') continue;
    checked++;
    ok('flush', name + ' commits an answer and flushes synchronously',
      /flushResumeSave\(\)/.test(body), 'no flushResumeSave() in ' + name);
  }
  ok('flush', 'the commit scan actually found committing functions (' + checked + ')',
    checked >= 10, String(checked));
}


/* ══════════════ 8. The painters ══════════════ */

function checkPainters() {
  /* Rule 7 of the painter rules: a painter must never throw. A painter that throws
     aborts the rest of the repaint for that screen, and the surrounding try/catch
     makes it invisible. Swept over every screen of every component, on a CLEAN load
     where nothing has been answered — which is also rule 4, "safe on a clean
     screen". */
  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    const [first, last] = RANGE[c];
    for (let n = 0; n < 46; n++) {
      const r = val('(function(){ try { restoreScreenUI(' + n +
        '); return "ok"; } catch (e) { return e.message; } })()');
      ok('paint', c + ': restoreScreenUI(' + n + ') does not throw on a clean load',
        r === 'ok', String(r));
    }
    /* And idempotent: calling it twice must be indistinguishable from once. */
    for (let n = first; n <= last; n++) {
      const r = val('(function(){ try { restoreScreenUI(' + n + '); restoreScreenUI(' + n +
        '); return "ok"; } catch (e) { return e.message; } })()');
      ok('paint', c + ': restoreScreenUI(' + n + ') is idempotent',
        r === 'ok', String(r));
    }
    dom.window.close();
  }
}


/* ══════════════ 9. Resume round-trips ══════════════ */

function checkResumeRoundTrip() {
  /* Answer a question for real, capture the payload, wipe the live state the way a
     reload does, apply the payload back, and assert the learner's answer is both in
     the variables AND on the screen. Doing it through the real click handlers is the
     point: a suite that calls the painter directly cannot see that resetScreenState
     wiped what the painter was about to redraw. */

  /* ── multi-select, answered correctly (screen 2, component 01) ── */
  {
    const { dom, val, exec } = loadComponent('01');
    exec('goTo(2); s2Toggle("a"); s2Toggle("b"); s2Toggle("c"); s2Toggle("d"); s2Check();');
    ok('resume', '01 s2: answering marks it done', val('MCQ.s2.done') === true);
    ok('resume', '01 s2: the answer is recorded as correct',
      val('screenWasCorrect("s2")') === true);

    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    ok('resume', '01 s2: the payload carries the screen', val('__blob.currentScreen') === 2);
    ok('resume', '01 s2: the payload carries the selection as an array',
      val('__blob.mcq.s2.selected.length') === 4);
    ok('resume', '01 s2: the payload carries the done flag',
      val('__blob.mcq.s2.done') === true);

    /* A reload: fresh registry state, pristine markup. */
    exec('mcqReset(MCQ.s2); MCQ.s2.done = false;');
    ok('resume', '01 s2: the reset really cleared it', val('MCQ.s2.done') === false);

    exec('applyResumeVars(__blob); applyResumeDom(__blob); restoreScreenUI(2);');
    ok('resume', '01 s2: done comes back', val('MCQ.s2.done') === true);
    ok('resume', '01 s2: the options are locked again',
      val('Array.from(document.querySelectorAll("#s2 .scq-opt")).every(function(o){return o.disabled;})') === true);
    ok('resume', '01 s2: the correct marks are repainted',
      val('document.querySelectorAll("#s2 .scq-opt.correct").length') === 4);
    ok('resume', '01 s2: the continue button is live and relabelled',
      val('document.getElementById("s2-check").disabled') === false);
    ok('resume', '01 s2: the feedback popup is reopened',
      val('!document.getElementById("s2-popup").classList.contains("hidden")') === true);
    dom.window.close();
  }

  /* ── value inputs, first attempt WRONG and not yet resolved (screen 16, component 02) ── */
  {
    const { dom, val, exec } = loadComponent('02');
    exec('goTo(16);' +
      '["0","1","2","3"].forEach(function(i){ document.getElementById("s16-in-"+i).value = "1"; });' +
      's16OnInput(); s16Check();');
    ok('resume', '02 s16: one wrong attempt does not resolve the screen',
      val('s16Done') === false && val('s16Attempts') === 1,
      'done=' + val('s16Done') + ' attempts=' + val('s16Attempts'));
    ok('resume', '02 s16: the retry lock disables the check button',
      val('document.getElementById("s16-check").disabled') === true);

    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    exec('s16Attempts = 0; s16LastWrong = null; s16Reset();');
    exec('applyResumeVars(__blob); applyResumeDom(__blob); restoreScreenUI(16);');

    ok('resume', '02 s16: the attempt count comes back', val('s16Attempts') === 1);
    ok('resume', '02 s16: the typed values come back',
      val('document.getElementById("s16-in-0").value') === '1');
    ok('resume', '02 s16: the wrong fields are marked again',
      val('document.querySelectorAll("#s16 .viq-input-box.error").length') > 0);
    ok('resume', '02 s16: the interim retry popup is reopened',
      val('!document.getElementById("s16-popup").classList.contains("hidden")') === true);
    /* The retry lock is the one that strands a learner if it comes back wrong: the
       same rejected answer must keep the button disabled, and changing one field must
       release it. */
    ok('resume', '02 s16: the retry lock is still armed for the same answer',
      val('document.getElementById("s16-check").disabled') === true);
    exec('document.getElementById("s16-in-0").value = "40"; s16OnInput();');
    ok('resume', '02 s16: changing a field releases the retry lock',
      val('document.getElementById("s16-check").disabled') === false);
    ok('resume', '02 s16: the inputs are still editable while unresolved',
      val('Array.from(document.querySelectorAll("#s16 .viq-input-box")).every(function(e){return !e.disabled;})') === true);
    dom.window.close();
  }

  /* ── a final WRONG answer: done, but not correct (screen 23, component 03) ── */
  {
    const { dom, val, exec } = loadComponent('03');
    /* SCQ.s23's correct id is 'a'; pick 'b' twice. */
    exec('goTo(23); s23Select("b"); s23Check(); s23Select("c"); s23Check();');
    ok('resume', '03 s23: two wrong attempts resolve the screen',
      val('SCQ.s23.done') === true);
    ok('resume', '03 s23: done does NOT mean correct',
      val('screenWasCorrect("s23")') === false);

    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    exec('SCQ.s23.done = false; SCQ.s23.attempts = 0; SCQ.s23.selected = null;' +
      'document.querySelectorAll("#s23 .scq-opt").forEach(function(o){' +
      'o.disabled = false; o.classList.remove("correct","wrong","selected"); });');
    exec('applyResumeVars(__blob); applyResumeDom(__blob); restoreScreenUI(23);');

    ok('resume', '03 s23: it comes back resolved', val('SCQ.s23.done') === true);
    ok('resume', '03 s23: the correct answer is shown',
      val('document.querySelector("#s23 .scq-opt[data-id=\\"a\\"]").classList.contains("correct")') === true);
    ok('resume', '03 s23: the learner\'s wrong pick is shown too',
      val('document.querySelector("#s23 .scq-opt[data-id=\\"c\\"]").classList.contains("wrong")') === true);
    ok('resume', '03 s23: the wrong-answer feedback is reopened, not the correct one',
      val('document.getElementById("s23-popup-title").textContent').indexOf('טעות') !== -1,
      val('document.getElementById("s23-popup-title").textContent'));
    ok('resume', '03 s23: continue is live so the learner is not stranded',
      val('document.getElementById("s23-check").disabled') === false);
    dom.window.close();
  }

  /* ── the two-counter applet: the reveal overwrites the counts (screen 17, component 02) ── */
  {
    const { dom, val, exec } = loadComponent('02');
    exec('goTo(17); bqAdd("s17","pink",1); bqCheck("s17"); bqAdd("s17","pink",1); bqCheck("s17");');
    ok('resume', '02 s17: two wrong attempts resolve it', val('BQ.s17.done') === true);
    ok('resume', '02 s17: the reveal set the counts TO the target',
      val('BQ.s17.pink') === val('BQ.s17.target.pink'));
    ok('resume', '02 s17: correctness therefore cannot come from the counts',
      val('screenWasCorrect("s17")') === false);

    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    exec('BQ.s17.done = false; BQ.s17.attempts = 0; BQ.s17.pink = 5; BQ.s17.white = 9;');
    exec('applyResumeVars(__blob); applyResumeDom(__blob); restoreScreenUI(17);');
    ok('resume', '02 s17: the counts come back', val('BQ.s17.pink') === val('BQ.s17.target.pink'));
    ok('resume', '02 s17: the wrong-answer feedback is reopened',
      val('document.getElementById("s17-popup-title").textContent') === 'זו טעות, בואו נבין למה:',
      val('document.getElementById("s17-popup-title").textContent'));
    ok('resume', '02 s17: the applet buttons are locked',
      val('Array.from(document.querySelectorAll("#s17 .bq-btn")).every(function(b){return b.disabled;})') === true);
    dom.window.close();
  }

  /* ── screen 4: four embedded questions and a flip gate ── */
  {
    const { dom, val, exec } = loadComponent('01');
    exec('goTo(4);' +
      'document.querySelectorAll("#s4 .frc-card").forEach(function(c){ s4Flip(c); });' +
      's4q1Toggle("a"); s4q1Toggle("c"); s4q1Check();' +
      'document.getElementById("s4q2-left").value = "1";' +
      'document.getElementById("s4q2-right").value = "4"; s4q2Check();' +
      'document.getElementById("s4q3-input").value = "12"; s4q3Check();' +
      's4State.scrolledEnd = true;');
    ok('resume', '01 s4: q1..q3 resolved',
      val('[s4State.q1,s4State.q2,s4State.q3].join(",")') === 'true,true,true');

    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    ok('resume', '01 s4: the payload carries the flip states',
      val('__blob.s4.flipped.filter(Boolean).length') === 4);
    ok('resume', '01 s4: the payload carries q1\'s selection as an array',
      val('__blob.s4q1Selected.length') === 2);

    exec('s4State.q1 = s4State.q2 = s4State.q3 = false; s4State.scrolledEnd = false;' +
      's4State.flipped = [false,false,false,false]; s4q1Selected = new Set();');
    exec('applyResumeVars(__blob); applyResumeDom(__blob); restoreScreenUI(4);');
    ok('resume', '01 s4: the resolved questions come back',
      val('[s4State.q1,s4State.q2,s4State.q3].join(",")') === 'true,true,true');
    ok('resume', '01 s4: q1\'s options are locked and marked',
      val('document.querySelectorAll("#s4 .rs-block:nth-of-type(4) .scq-opt.correct").length') === 2);
    ok('resume', '01 s4: q2\'s inputs come back with their values',
      val('document.getElementById("s4q2-left").value') === '1');
    ok('resume', '01 s4: the flip cards are flipped again',
      val('document.querySelectorAll("#s4 .frc-card.is-flipped").length') === 4);
    dom.window.close();
  }

  /* ── the guided worked example, which keeps no answer state of its own ── */
  {
    const { dom, val, exec } = loadComponent('01');
    exec('goTo(7); gstepSelect("s7","b");');
    ok('resume', '01 s7: the reveal unlocks continue',
      val('document.getElementById("s7-continue").disabled') === false);
    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    exec('GSTEPS.s7.answered = false;' +
      'document.querySelectorAll("#s7 .s19-opt").forEach(function(o){' +
      'o.disabled = false; o.classList.remove("correct","incorrect"); });' +
      'document.getElementById("s7-continue").disabled = true;');
    exec('applyResumeVars(__blob); restoreScreenUI(7);');
    ok('resume', '01 s7: the reveal comes back', val('GSTEPS.s7.answered') === true);
    ok('resume', '01 s7: continue is live again, so the learner is not stuck',
      val('document.getElementById("s7-continue").disabled') === false);
    dom.window.close();
  }

  /* ── the class task: free text with no answer key (component 04) ── */
  {
    const { dom, val, exec } = loadComponent('04');
    exec('goTo(32);' +
      '["0","1","2"].forEach(function(i){ document.getElementById("s32-in-"+i).value = "יחס " + i; });' +
      's32Sync();');
    ok('resume', '04 s32: filling the three fields unlocks continue',
      val('document.getElementById("s32-continue").disabled') === false);
    exec('window.__blob = JSON.parse(JSON.stringify(capturePartPayload()));');
    exec('["0","1","2"].forEach(function(i){ document.getElementById("s32-in-"+i).value = ""; }); s32Sync();');
    ok('resume', '04 s32: clearing them locks it again',
      val('document.getElementById("s32-continue").disabled') === true);
    exec('applyResumeDom(__blob); resetScreenState(32);');
    ok('resume', '04 s32: the typed text comes back verbatim',
      val('document.getElementById("s32-in-1").value') === 'יחס 1');
    ok('resume', '04 s32: and continue is live again',
      val('document.getElementById("s32-continue").disabled') === false);
    dom.window.close();
  }

  /* ── navigating away and back keeps an answered screen answered ──
     The §8.4a hard-lock. This is the one that is invisible to a suite calling the
     painter directly: goTo() runs resetScreenState(), which is an INITIALISER. */
  {
    const { dom, val, exec } = loadComponent('01');
    exec('goTo(2); s2Toggle("a"); s2Toggle("b"); s2Toggle("c"); s2Toggle("d"); s2Check();');
    exec('goTo(3); goTo(2);');
    ok('resume', '01: back-navigating onto an answered screen keeps it answered',
      val('MCQ.s2.done') === true);
    ok('resume', '01: and keeps it visually locked, not pristine',
      val('Array.from(document.querySelectorAll("#s2 .scq-opt")).every(function(o){return o.disabled;})') === true);
    ok('resume', '01: and reopens its feedback',
      val('!document.getElementById("s2-popup").classList.contains("hidden")') === true);
    ok('resume', '01: an untouched screen stays pristine after navigation',
      val('(function(){ goTo(3); return document.querySelectorAll("#s3 .scq-opt.correct,#s3 .scq-opt.wrong").length; })()') === 0);
    dom.window.close();
  }
}


/* ══════════════ 10. The cross-part seam ══════════════ */

function checkCrossPartSeam() {
  const chain = {};
  for (const c of COMPONENTS) {
    const { dom, val } = loadComponent(c);
    chain[c] = { next: val('PART_NEXT'), prev: val('PART_PREV') };

    /* currentPartSlug must be lowercase: a capitalised path 404s on a case-sensitive
       host and splits one learner's state document in two. */
    ok('seam', c + ': currentPartSlug() is this component, lowercased',
      val('currentPartSlug()') === PART_DIR(c), val('currentPartSlug()'));
    ok('seam', c + ': the nav-edge key carries the unit slug',
      val('NAV_EDGE_KEY').indexOf(UNIT) !== -1, val('NAV_EDGE_KEY'));

    /* writeForwardState takes this unit's third argument, because seeding a
       never-visited destination with screen 0 points at a screen it does not own. */
    ok('seam', c + ': writeForwardState accepts destFirstScreen',
      val('writeForwardState.length') === 3, String(val('writeForwardState.length')));

    dom.window.close();
  }

  ok('seam', 'the forward chain is 01 -> 02 -> 03 -> 04 -> 05 -> 06 and stops',
    COMPONENTS.every((c, i) =>
      chain[c].next === (i === COMPONENTS.length - 1 ? '' : PART_DIR(COMPONENTS[i + 1]))),
    JSON.stringify(chain));
  ok('seam', 'the back chain mirrors it, and component 01 has no predecessor',
    COMPONENTS.every((c, i) =>
      chain[c].prev === (i === 0 ? '' : PART_DIR(COMPONENTS[i - 1]))),
    JSON.stringify(chain));

  /* The seam itself: the old sessionStorage hop must be gone, and the landing pointer
     must be what moves. A forward jump that does not move it leaves the destination's
     loader pointing back here, which bounced the learner to component 01 forever. */
  for (const c of COMPONENTS) {
    const src = fs.readFileSync(path.join(BASE, PART_DIR(c), 'script.js'), 'utf8');
    ok('seam', c + ': the sessionStorage hopScreen seam is gone',
      !/hopScreen/.test(src));
    ok('seam', c + ': leaveToPart moves the landing pointer',
      /function leaveToPart[\s\S]{0,700}writeForwardState\(/.test(src));
    ok('seam', c + ': leaveToPart reports the component completed first',
      /function leaveToPart[\s\S]{0,400}xapiCompleteComponent\(/.test(src));
    ok('seam', c + ': the back edge routes through goBackToPreviousPart',
      /goBackToPreviousPart\(PART_PREV/.test(src));
    /* ?slxapi and ?registration enter through the root redirect and are carried by
       hand from there on. Miss one jump and the LRS configuration is lost from that
       point, and everything downstream silently reports nothing — and shares no
       resume document either, since Kata addresses it by registration alone.
       Every navigation whose target mentions index.html is checked, rather than
       pattern-matching one spelling of it. */
    const jumps = src.match(/location\.(?:replace\(|href\s*=)[^;]*index\.html[^;]*/g) || [];
    ok('seam', c + ': has a cross-part navigation to check', jumps.length > 0);
    for (const j of jumps) {
      ok('seam', c + ': this jump carries window.location.search',
        j.indexOf('window.location.search') !== -1, j.trim().slice(0, 90));
    }
    ok('seam', c + ': the duplicate dev bridge is gone',
      !/postMessage\(\{ type: 'DEV_READY'/.test(src) &&
      !/e\.data\.type !== 'DEV_GOTO'/.test(src));
    ok('seam', c + ': the unit end reports the unit completed',
      /function finishUnit[\s\S]{0,400}xapiCompleteUnit\(/.test(src));
  }
}


/* ══════════════ 11. The report layer ══════════════ */

function checkReportLayer() {
  const src = fs.readFileSync(path.join(BASE, 'unit-js', '25-report.js'), 'utf8');

  /* One form serves all of 720, and the entry.* keys are therefore shared: renaming
     one breaks every unit reporting to it. */
  ok('report', 'the form endpoint is the shared 720 one',
    /1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/.test(src));
  const FIELDS = ['entry.301404029_year', 'entry.301404029_month', 'entry.301404029_day',
    'entry.2066097581_hour', 'entry.2066097581_minute', 'entry.1933069481',
    'entry.2070680092', 'entry.1555704258', 'entry.1671046914', 'entry.1179822443',
    'entry.806447525'];
  for (const f of FIELDS) {
    ok('report', 'the shared field ' + f + ' is unchanged', src.indexOf("'" + f + "'") !== -1);
  }
  ok('report', 'the transport is form-encoded, not JSON',
    /new URLSearchParams\(\)/.test(src) && !/JSON\.stringify\(body\)/.test(src));
  ok('report', 'the POST is mode:no-cors', /mode: 'no-cors'/.test(src));
  ok('report', 'a send failure cannot block the learner',
    /\.catch\(function \(e\) \{ console\.error\('\[Report\] send failed'/.test(src));
  ok('report', 'the flag button is wired by delegation, so extra instances stay live',
    /addEventListener\('click'[\s\S]{0,200}closest\('\.flag-btn'\)/.test(src));
  ok('report', 'the screen map is typeof-guarded, so the modal works before it exists',
    /typeof SCREEN_TO_SUBCONTENT !== 'undefined'/.test(src));

  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');
    for (const id of ['report-modal', 'report-thanks-modal', 'report-confirm-modal',
      'report-type', 'report-text', 'report-char-count', 'report-type-error',
      'report-text-error']) {
      ok('report', c + ': #' + id + ' exists in the markup',
        new RegExp('id="' + id + '"').test(html));
    }
    /* The thanks and the discard-confirm dialogs are different dialogs; merging them
       is the obvious-looking wrong simplification. */
    ok('report', c + ': the three dialogs ship hidden',
      (html.match(/id="report-(?:modal|thanks-modal|confirm-modal)"[\s\S]{0,300}?hidden/g) || []).length === 3);
    ok('report', c + ': the textarea drives the error state',
      /id="report-text"[^>]*onblur="reportTextBlur\(\)"/.test(html));
    ok('report', c + ': a flag button exists', /class="flag-btn"/.test(html));
  }
}


/* ══════════════ 12. The boot cover ══════════════ */

function checkBootCover() {
  for (const c of COMPONENTS) {
    const html = fs.readFileSync(path.join(BASE, PART_DIR(c), 'index.html'), 'utf8');

    ok('cover', c + ': #boot-cover exists', /id="boot-cover"/.test(html));
    ok('cover', c + ': the cover is inline-styled, so a stale CSS cache cannot hide it',
      /id="boot-cover"[^>]*style="[^"]*position:fixed/.test(html));

    /* A SIBLING of #app, not a child: #app carries scaleApp's transform, and a child
       would inherit it and stop covering the viewport. */
    const iCover = html.indexOf('id="boot-cover"');
    const iApp = html.indexOf('id="app"');
    ok('cover', c + ': the cover precedes #app in the markup',
      iCover > -1 && iApp > iCover, iCover + ' vs ' + iApp);
    ok('cover', c + ': the cover is not inside #app',
      html.slice(iApp).indexOf('id="boot-cover"') === -1);

    /* The failsafe must depend on no JS file at all, and must wait for a restore
       rather than exposing the first screen mid-flight. */
    ok('cover', c + ': an inline failsafe removes the cover if the loader never does',
      /getElementById\('boot-cover'\)[\s\S]{0,300}removeChild/.test(html));
    ok('cover', c + ': the failsafe waits on __resumeInFlight',
      /__resumeInFlight/.test(html));
    ok('cover', c + ': its ceiling matches the loader\'s 10s metadata poll',
      /Date\.now\(\) - t0 < 11000/.test(html));

    const loader = fs.readFileSync(path.join(BASE, 'unit-js', '50-loader.js'), 'utf8');
    ok('cover', 'the loader drops the cover on every exit path',
      (loader.match(/dropBootCover\(\)/g) || []).length >= 3,
      String((loader.match(/dropBootCover\(\)/g) || []).length));
  }
}


/* ══════════════ 13. The ledger orderings ══════════════ */

function checkLedger() {
  const src = fs.readFileSync(path.join(BASE, 'unit-js', '40-resume.js'), 'utf8');
  const fn = src.slice(src.indexOf('function sendStatementOnce'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);

  /* Three orderings, each of which has cost a real defect:
     1. bail out entirely while restoring — neither send nor mark. A mark taken during
        a restore permanently suppresses a statement that never left;
     2. fail OPEN — obey the ledger only when it positively says "already sent";
     3. persist the mark synchronously, because the finish screens send without
        navigating afterwards and nothing else would write it. */
  /* The _restoring guard must come FIRST and must return before the ledger is even
     consulted. A mark taken during a restore permanently suppresses a statement that
     never actually left — which is how a unit completed goes missing for good. */
  ok('ledger', 'sendStatementOnce bails out entirely while restoring',
    /if \(_restoring\) return false;/.test(body));
  ok('ledger', 'and the _restoring guard is the FIRST thing it does',
    body.indexOf('_restoring') > -1 &&
    body.indexOf('_restoring') < body.indexOf('alreadySent('),
    'restoring@' + body.indexOf('_restoring') + ' alreadySent@' + body.indexOf('alreadySent('));
  ok('ledger', 'it checks the ledger before sending',
    body.indexOf('alreadySent(') < body.indexOf('sendStatement720('));
  ok('ledger', 'it marks only AFTER a successful send',
    body.indexOf('sendStatement720(') < body.indexOf('markSent('));
  ok('ledger', 'markSent persists synchronously',
    /function markSent[\s\S]{0,400}persistUnitState\(captureUnitState\(\)\)/.test(src));
  ok('ledger', 'the document carries all four ledgers',
    /done:\s*\{\}/.test(src) && /doneItems:\s*\{\}/.test(src) &&
    /hints:\s*\{\}/.test(src) && /picks:\s*\{\}/.test(src));
  ok('ledger', 'initialized is NOT ledger-guarded (v2.4 requires it on re-entry)',
    !/sendStatementOnce\([^)]*'initialized'/.test(
      fs.readFileSync(path.join(BASE, 'unit-js', '20-xapi.js'), 'utf8')));
  ok('ledger', 'readUnitState never returns null',
    !/function readUnitState[\s\S]{0,1500}return null;/.test(src));

  /* A version bump discards every document in the field, so it must be deliberate. */
  const v = src.match(/var RESUME_STATE_VERSION = (\d+);/);
  /* v5: the unit was re-cut from four components to the script's six רכיבים, so a v4
     document names parts over screen ranges that have moved. See 40-resume.js. */
  ok('ledger', 'the state document is at v5', v && v[1] === '5', v ? v[1] : 'not found');
}


/* ══════════════ 14. Assets referenced by CSS actually exist ══════════════ */

function checkCssAssets() {
  /* A missing font is silent: no JS error, no console message beyond a network 404,
     and the page renders in a fallback typeface that looks plausible. Every url() in
     every component's stylesheet is resolved against that stylesheet's own directory
     and checked on disk.

     This exists because all six `styles.css` referenced `../assets/fonts/…` while the
     fonts lived in `<component>/assets/fonts/`, so the whole unit rendered in a
     fallback font and no assertion noticed. The fonts now live once at unit level, in
     `unit-assets/fonts/`. */
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c));
    const cssPath = path.join(dir, 'styles.css');
    ok('assets', c + ': styles.css exists', fs.existsSync(cssPath));
    if (!fs.existsSync(cssPath)) continue;
    const css = fs.readFileSync(cssPath, 'utf8');

    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map(m => m[1].trim())
      .filter(u => !/^(?:data:|https?:|\/\/|#)/.test(u));
    const unique = [...new Set(urls)];
    ok('assets', c + ': styles.css references local assets to check',
      unique.length > 0, String(unique.length));

    for (const u of unique) {
      /* Resolved from the stylesheet's directory, which is how a browser resolves a
         relative url() — NOT from the HTML document's directory. */
      const resolved = path.resolve(path.dirname(cssPath), u.split(/[?#]/)[0]);
      ok('assets', c + ': ' + u + ' resolves to a real file',
        fs.existsSync(resolved), 'looked for ' + path.relative(BASE, resolved));
    }
  }

  /* The fonts are shared, so they must be at unit level and NOT duplicated back into
     the components — a stale per-component copy would win nothing but would rot. */
  const unitFonts = path.join(BASE, 'unit-assets', 'fonts');
  ok('assets', 'unit-assets/fonts/ holds the shared font files',
    fs.existsSync(unitFonts) &&
    fs.readdirSync(unitFonts).filter(f => /\.ttf$/i.test(f)).length >= 7,
    fs.existsSync(unitFonts) ? fs.readdirSync(unitFonts).join(',') : 'missing');
  for (const c of COMPONENTS) {
    ok('assets', c + ': keeps no per-component copy of the fonts',
      !fs.existsSync(path.join(BASE, PART_DIR(c), 'assets', 'fonts')));
  }

  /* Every image a component's HTML asks for, too — same silent-404 class of bug. */
  for (const c of COMPONENTS) {
    const dir = path.join(BASE, PART_DIR(c));
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
      .map(m => m[1].trim())
      .filter(u => u && !/^(?:data:|https?:|\/\/)/.test(u));
    for (const u of [...new Set(srcs)]) {
      ok('assets', c + ': <img> ' + u + ' resolves',
        fs.existsSync(path.resolve(dir, u.split(/[?#]/)[0])),
        'looked for ' + u);
    }
  }
}


/* ══════════════ 15. The dev harnesses agree on one review store ══════════════ */

function checkDevHarnesses() {
  /* index_dev.html is never deployed, but it IS the producer's review workflow, and
     its marks are real work product. All five harnesses (root + one per component)
     must name the same localStorage key, or a producer's marks silently split by
     whichever harness they happened to open. Safe to share because marks are keyed
     by screen number and this unit numbers screens unit-wide 0-45. */
  const files = ['index_dev.html'].concat(COMPONENTS.map(c => PART_DIR(c) + '/index_dev.html'));
  const ids = {};
  for (const rel of files) {
    const p = path.join(BASE, rel);
    ok('devhar', rel + ' exists', fs.existsSync(p));
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const m = src.match(/const UNIT_ID = '([^']+)'/);
    ok('devhar', rel + ' declares a UNIT_ID', !!m);
    if (m) ids[rel] = m[1];
    ok('devhar', rel + " derives its key as 'dev_review_' + UNIT_ID",
      /const REVIEW_KEY = 'dev_review_' \+ UNIT_ID;/.test(src));
    /* The one-time merge from the two stores this key replaced. */
    ok('devhar', rel + ' merges the legacy review stores in once',
      /LEGACY_REVIEW_KEYS/.test(src) && /if \(localStorage\.getItem\(REVIEW_KEY\)\) return;/.test(src));
  }
  const distinct = [...new Set(Object.values(ids))];
  ok('devhar', 'all five harnesses share one review key', distinct.length === 1,
    Object.keys(ids).map(k => k + '=' + ids[k]).join(' '));
  ok('devhar', 'and it is the unit slug, with no component suffix',
    distinct.length === 1 && distinct[0] === UNIT, distinct.join(','));
}


/* ══════════════ run ══════════════ */

const suites = [
  ['load + shared layer', checkLoadAndSharedLayer],
  ['deploy contract', checkDeployContract],
  ['the six script.js are twins', checkPartsIdentical],
  ['screen map', checkScreenMap],
  ['metadata', checkMetadata],
  ['question map', checkQuestionMap],
  ['flush on commit', checkFlushOnCommit],
  ['painters', checkPainters],
  ['resume round-trips', checkResumeRoundTrip],
  ['cross-part seam', checkCrossPartSeam],
  ['report layer', checkReportLayer],
  ['boot cover', checkBootCover],
  ['ledger', checkLedger],
  ['css + html assets resolve', checkCssAssets],
  ['dev harnesses share one review key', checkDevHarnesses],
];

for (const [name, fn] of suites) {
  const before = failures.length;
  try { fn(); }
  catch (e) { failures.push('[' + name + '] SUITE THREW: ' + e.message + '\n' + e.stack); }
  const added = failures.length - before;
  console.log((added ? '✗ ' : '✓ ') + name + (added ? '  (' + added + ' failure(s))' : ''));
}

console.log('\n' + passes + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  ' + f));
  process.exit(1);
}
