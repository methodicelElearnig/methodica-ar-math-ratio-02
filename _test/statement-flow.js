/* ═══════════════════ behavioural statement-flow oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   verify-report.js asserts STRUCTURE — that the wiring is present and the contracts
   hold. This asserts BEHAVIOUR: which statements actually leave the lomda when a
   learner does something, in what order, carrying what result — and, the part that
   matters most, which ones do NOT leave when the same screen is reached again by a
   reload or by the back button.

   Ported from methodica-math-scale-01/_test/statement-flow.js.

   jsdom will not fetch the CDN, so bootXAPI's two loadScript calls are inert. Rather
   than fake the loader, each scenario runs the real page scripts, then executes
   _test/xapi-720-k.js (the very stub the browser gets through ?xapiLib=), then
   replays the loader's post-metadata sequence explicitly. The screen code, the shared
   helpers and the ledger under test are all real.

   Run:
     NODE_PATH=/tmp/lomda-test/node_modules node _test/statement-flow.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = process.argv[2] || path.join(__dirname, '..');
const UNIT = 'methodica-math-ratio-01';
const PART_DIR = c => UNIT + '-' + c;

const failures = [];
let passes = 0;

function ok(tag, what, cond, detail) {
  if (cond) { passes++; return; }
  failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
}

function eq(tag, what, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  ok(tag, what, a === e, 'got ' + a + ', expected ' + e);
}

/* Boot a component the way the browser does with ?xapiLib=, stopping just before the
   loader's post-metadata block so each scenario can drive it. */
function boot(c, opts) {
  opts = opts || {};
  const dir = path.join(BASE, PART_DIR(c));
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR(c) + '/index.html' +
      (opts.search || '?slxapi=1&registration=r1') + (opts.hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const w = dom.window;

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

  w.console.error = w.console.warn = w.console.log = () => {};
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};

  for (const src of [...w.document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src'))) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) {} }
  }

  /* The library, exactly as ?xapiLib= would deliver it on localhost. */
  exec(fs.readFileSync(path.join(BASE, '_test', 'xapi-720-k.js'), 'utf8'));
  exec('window.XAPI_USING_G = true;');
  if (!opts.keepState) exec('window.__reset();');
  /* The component metadata, so xapiQ() resolves against the real catalogue. */
  exec('window.METADATA = ' + fs.readFileSync(
    path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, '') + ';');

  const stmts = () => JSON.parse(val('JSON.stringify(window.__stmts())'));
  const verbs = () => stmts().map(s => s.verb);
  const state = () => JSON.parse(val('JSON.stringify(window.__state())'));

  /* Replay what the loader does after the metadata poll resolves. */
  const finishBoot = (payload, screenOverride) => {
    exec('_resumeReady = true; if (!_unitState) _unitState = readUnitState(); ' +
      'drainPendingUnitState();');
    if (payload !== undefined) {
      exec('applyExecutionState(' + JSON.stringify(payload) + ', ' +
        (screenOverride === undefined ? 'undefined' : screenOverride) + ');');
    }
    exec("try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}");
    if (payload === undefined) exec('xapiOnScreen(currentScreen);');
  };

  return { dom, w, exec, val, stmts, verbs, state, finishBoot };
}

/* Answer screen 2 (component 01) correctly, through the real handlers. */
const ANSWER_S2 = 'goTo(2); s2Toggle("a"); s2Toggle("b"); s2Toggle("c"); s2Toggle("d"); s2Check();';


/* ══════════════ 1. A fresh load ══════════════ */

function freshLoad() {
  const b = boot('01');
  b.finishBoot();

  /* The component 'initialized' then the landing screen's item 'initialized'. */
  eq('fresh', 'a fresh load emits the component then the item initialized',
    b.verbs(), ['initialized', 'initialized']);
  const s = b.stmts();
  ok('fresh', 'the first is component-scoped',
    s[0].objectType === 'onlinelesson', JSON.stringify(s[0]));
  ok('fresh', 'the second is the landing screen\'s item',
    s[1].objectType === 'question' && /-01-001\/$/.test(s[1].opts.objectId || ''),
    JSON.stringify(s[1].opts));
  ok('fresh', 'the item is flagged as an evaluation item',
    s[1].opts.isEvaluationItem === 1 || s[1].opts.isEvaluationItem === true,
    JSON.stringify(s[1].opts));
  b.dom.window.close();
}


/* ══════════════ 2. Answering ══════════════ */

function answering() {
  const b = boot('01');
  b.finishBoot();
  b.exec('window.__reset();');

  /* Screen 2 is in item 002; screen 1 is in 001. Crossing the boundary closes 001. */
  b.exec(ANSWER_S2);
  const v = b.verbs();
  ok('answer', 'crossing into a new item closes the old one and opens the new',
    v[0] === 'completed' && v[1] === 'initialized', v.join(','));
  ok('answer', 'answering emits answered.last (it was correct first time)',
    v.indexOf('answered.last') !== -1, v.join(','));
  ok('answer', 'and no plain answered, because there was no earlier attempt',
    v.indexOf('answered') === -1, v.join(','));

  const a = b.stmts().find(x => x.verb === 'answered.last');
  ok('answer', 'answered carries success and a scaled score',
    a && a.result && a.result.success === true && a.result.score.scaled === 1,
    JSON.stringify(a && a.result));
  ok('answer', 'answered carries the learner\'s own answer text',
    a && a.result.extensions && Array.isArray(a.result.extensions.student_answer) &&
    a.result.extensions.student_answer[0].length > 0,
    JSON.stringify(a && a.result.extensions));
  /* MOE v2.4 made contextActivities.parent mandatory on answered — the library builds
     it from parentId, so the statement must carry one. */
  ok('answer', 'answered names its parent item (v2.4 requires it)',
    a && typeof a.opts.parentId === 'string' && /-01-002\/$/.test(a.opts.parentId),
    JSON.stringify(a && a.opts));
  ok('answer', 'and a question id under that item',
    a && typeof a.opts.questionId === 'string' &&
    a.opts.questionId.indexOf(a.opts.parentId) === 0,
    JSON.stringify(a && a.opts));

  /* A wrong first attempt then a correct second: plain answered, then answered.last. */
  const b2 = boot('01');
  b2.finishBoot();
  b2.exec('window.__reset();');
  b2.exec('goTo(3); s3Toggle("b"); s3Check();');          /* s3 keys are a, c, d */
  ok('answer', 'a non-final wrong attempt emits plain answered',
    b2.verbs().indexOf('answered') !== -1, b2.verbs().join(','));
  ok('answer', 'and not answered.last',
    b2.verbs().indexOf('answered.last') === -1, b2.verbs().join(','));
  const wrong = b2.stmts().find(x => x.verb === 'answered');
  ok('answer', 'the wrong attempt reports success false, score 0',
    wrong.result.success === false && wrong.result.score.scaled === 0,
    JSON.stringify(wrong.result));
  b2.exec('s3Toggle("b"); s3Toggle("a"); s3Toggle("c"); s3Toggle("d"); s3Check();');
  ok('answer', 'the resolving attempt then emits answered.last',
    b2.verbs().indexOf('answered.last') !== -1, b2.verbs().join(','));
  b.dom.window.close();
  b2.dom.window.close();
}


/* ══════════════ 3. Hints ══════════════ */

function hints() {
  /* Component 02, not 01: s14 and s15 are the first two hinted questions of the unit
     and they live in the script's רכיב 2. Component 01 has exactly one hinted screen
     (s12), which cannot exercise the "a different question reports its own" case. */
  const b = boot('02');
  b.finishBoot();
  b.exec('window.__reset();');

  b.exec('goTo(14); openHint("s14");');
  eq('hint', 'opening a hint reports requested.1 once',
    b.verbs().filter(v => v === 'requested.1').length, 1);

  /* The overlays close three ways and all three leave the hint button live, so a
     second open must not report again. Deduped per question, and the key lives in the
     state document, so it survives a reload too. */
  b.exec('closeHint("s14"); openHint("s14"); openHint("s14");');
  eq('hint', 'reopening the same hint does not report again',
    b.verbs().filter(v => v === 'requested.1').length, 1);

  const h = b.stmts().find(x => x.verb === 'requested.1');
  ok('hint', 'the hint is question-scoped, not component-scoped',
    h.objectType === 'question' && !!h.opts.questionId, JSON.stringify(h.opts));

  /* A different question reports its own. */
  b.exec('goTo(15); openHint("s15");');
  eq('hint', 'a different question reports its own hint',
    b.verbs().filter(v => v === 'requested.1').length, 2);

  /* And the ledger survives a reload: same registration, same document. */
  const dumped = b.state();
  b.dom.window.close();
  const b2 = boot('02', { keepState: true });
  b2.finishBoot();
  b2.exec('window.__reset(); window.__setState(' + JSON.stringify(dumped) + ');');
  b2.exec('_unitState = readUnitState(); goTo(14); openHint("s14");');
  eq('hint', 'after a reload the same hint is still not re-reported',
    b2.verbs().filter(v => v === 'requested.1').length, 0);
  b2.dom.window.close();
}


/* ══════════════ 4. No duplicate completed ══════════════ */

function noDuplicateCompleted() {
  const b = boot('01');
  b.finishBoot();

  /* Walk every screen of component 01 forward. Each item boundary closes one item. */
  for (let n = 0; n <= 12; n++) b.exec('_goToCore(' + n + ');');
  const firstPass = b.stmts().filter(s => s.verb === 'completed');
  const items = firstPass.map(s => s.opts.objectId);
  eq('dupes', 'the forward walk closes each item exactly once',
    items.length, new Set(items).size);
  ok('dupes', 'and it closed the items the walk crossed (3 of 4)',
    items.length === 3, 'closed ' + items.length + ': ' + items.join(','));

  /* Now walk BACKWARDS over the same screens. Every item is re-entered, so
     'initialized' fires again — v2.4 requires that — but no 'completed' may. */
  for (let n = 12; n >= 0; n--) b.exec('_goToCore(' + n + ');');
  const all = b.stmts().filter(s => s.verb === 'completed').map(s => s.opts.objectId);

  /* Not "zero completed on the way back": the forward walk stopped INSIDE the last
     item without crossing out of it, so that one item is still open and the backward
     walk closes it — once, legitimately. The invariant is that no item is EVER closed
     twice, which is what the stub's __dupes() reports (as a list of duplicate keys).*/
  eq('dupes', 'no item is ever closed twice, forward walk plus backward walk',
    b.val('JSON.stringify(window.__dupes())'), '[]');
  eq('dupes', 'each item was closed exactly once across both walks',
    all.length, new Set(all).size);
  /* All four: the forward walk closed three and left the last open, and the backward
     walk closed that one. Every item of the component is therefore reported exactly
     once by the end, which is the property that matters to the LRS. */
  ok('dupes', 'every one of the four items has been closed, exactly once',
    new Set(all).size === 4, 'closed ' + new Set(all).size);

  /* initialized, by contrast, MUST fire again on every re-entry — v2.4 §1 inverted
     the 2.3 rule that forbade it. */
  const backOnly = b.stmts().filter(s => s.verb === 'initialized');
  ok('dupes', 'initialized fires again on re-entry, as v2.4 requires',
    backOnly.length > items.length, String(backOnly.length));

  /* And a reload with the same document: still nothing re-closed. */
  const dumped = b.state();
  b.dom.window.close();

  const b2 = boot('01', { keepState: true });
  b2.exec('window.__reset(); window.__setState(' + JSON.stringify(dumped) + ');');
  b2.finishBoot();
  for (let n = 0; n <= 12; n++) b2.exec('_goToCore(' + n + ');');
  eq('dupes', 'after a reload the finished items are not closed again',
    b2.stmts().filter(s => s.verb === 'completed').length, 0);
  b2.dom.window.close();

  /* Component 03 carries SIX items over ten screens — the finest item granularity in
     the unit, and the one the four-component build collapsed into two. A wrong page
     number in SCREEN_TO_SUBCONTENT there would either merge two items into one
     'completed' or split one item into two, and neither shows up as an error. */
  const b3 = boot('03');
  b3.finishBoot();
  b3.exec('window.__reset();');
  for (let n = 20; n <= 29; n++) b3.exec('_goToCore(' + n + ');');
  const c3fwd = b3.stmts().filter(s => s.verb === 'completed').map(s => s.opts.objectId);
  ok('dupes', 'component 03 closes five of its six items on the way in',
    c3fwd.length === 5 && new Set(c3fwd).size === 5,
    'closed ' + c3fwd.length + ': ' + c3fwd.join(','));
  b3.exec('xapiFinishItems();');
  const c3all = b3.stmts().filter(s => s.verb === 'completed').map(s => s.opts.objectId);
  ok('dupes', 'and the sixth on the way out, each exactly once',
    new Set(c3all).size === 6 && c3all.length === 6,
    'closed ' + c3all.length + ' / ' + new Set(c3all).size);
  ok('dupes', 'the six are 001..006 of component 03, in order',
    c3all.map(id => id.replace(/\/$/, '').split('-').pop()).join(',') ===
      '001,002,003,004,005,006', c3all.join(','));
  b3.dom.window.close();
}


/* ══════════════ 5. Component and unit completed ══════════════ */

function componentAndUnit() {
  /* Component 01 hands over forward. The component 'completed' must go out BEFORE the
     handover, and must carry an explicit result. */
  const b = boot('01');
  b.finishBoot();
  b.exec('window.__reset();');
  b.exec('leaveToPart(PART_NEXT, PART_LAST + 1);');

  const comp = b.stmts().filter(s => s.verb === 'completed' &&
    s.objectType === 'onlinelesson');
  eq('exit', 'leaving component 01 reports its completed exactly once', comp.length, 1);
  ok('exit', 'the component completed carries an explicit result',
    comp[0].result && typeof comp[0].result.success === 'boolean' &&
    comp[0].result.score && typeof comp[0].result.score.scaled === 'number',
    JSON.stringify(comp[0].result));
  ok('exit', 'a learner who answered nothing is reported as not passing',
    comp[0].result.success === false && comp[0].result.score.scaled === 0,
    JSON.stringify(comp[0].result));

  /* The landing pointer moved, which is what stops the destination bouncing back. */
  ok('exit', 'the landing pointer now names the destination',
    b.state().part === PART_DIR('02'), JSON.stringify(b.state().part));
  ok('exit', 'and a back edge was recorded for it',
    !!(b.state().prev || {})[PART_DIR('02')],
    JSON.stringify(b.state().prev));
  ok('exit', 'the destination is seeded with ITS OWN first screen, not 0',
    b.state().parts[PART_DIR('02')].currentScreen === 13,
    JSON.stringify(b.state().parts[PART_DIR('02')]));
  ok('exit', 'the departing component keeps its own payload',
    !!b.state().parts[PART_DIR('01')], JSON.stringify(Object.keys(b.state().parts)));

  /* Leaving twice must not report twice. */
  b.exec('window.__reset(); leaveToPart(PART_NEXT, PART_LAST + 1);');
  eq('exit', 'leaving again does not re-report the component',
    b.stmts().filter(s => s.verb === 'completed').length, 0);
  b.dom.window.close();

  /* Component 06 (שאלת שיא) is terminal: the finale reports the component AND the unit. */
  const b4 = boot('06');
  b4.finishBoot();
  b4.exec('window.__reset(); finishUnit();');
  const all = b4.stmts().filter(s => s.verb === 'completed');
  /* Three, not two: xapiCompleteComponent closes the still-open ITEM first, which is
     the whole point of it doing so — an item left open would never be reported at
     all, and a 'completed' for the component that arrived before its own item closed
     would order them wrongly in the LRS. */
  eq('exit', 'the finale closes the open item, the component, then the unit',
    all.length, 3);
  eq('exit', 'and in that order',
    all.map(s => s.objectType), ['question', 'onlinelesson', 'onlinelesson']);
  const unit = all.find(s => s.opts && s.opts.scope === 'unit');
  ok('exit', 'exactly one of them is unit-scoped',
    !!unit && all.filter(s => s.opts && s.opts.scope === 'unit').length === 1,
    JSON.stringify(all.map(s => s.opts)));
  ok('exit', 'the unit completed carries an explicit result',
    unit && unit.result && typeof unit.result.success === 'boolean' &&
    unit.result.score && typeof unit.result.score.scaled === 'number',
    JSON.stringify(unit && unit.result));

  b4.exec('window.__reset(); finishUnit();');
  eq('exit', 're-reaching the finale reports neither again',
    b4.stmts().filter(s => s.verb === 'completed').length, 0);
  b4.dom.window.close();
}


/* ══════════════ 6. Resuming onto an answered screen ══════════════ */

function resumeEmitsNothingExtra() {
  /* Answer screen 2, dump the document, and reload straight back onto it. Exactly one
     item 'initialized' may leave, and nothing else — no answered, no completed. */
  const b = boot('01');
  b.finishBoot();
  b.exec(ANSWER_S2);
  const payload = JSON.parse(b.val('JSON.stringify(capturePartPayload())'));
  const dumped = b.state();
  b.dom.window.close();

  const b2 = boot('01', { keepState: true });
  b2.exec('window.__reset(); window.__setState(' + JSON.stringify(dumped) + ');');
  b2.finishBoot(payload);

  const v = b2.verbs();
  eq('resume', 'a resumed session re-sends no answered', v.filter(x => /^answered/.test(x)).length, 0);
  eq('resume', 'and no completed', v.filter(x => x === 'completed').length, 0);
  eq('resume', 'exactly one item initialized leaves, plus the component one',
    v.filter(x => x === 'initialized').length, 2);
  ok('resume', 'the learner landed on the screen they left',
    b2.val('currentScreen') === 2, String(b2.val('currentScreen')));
  ok('resume', 'and the screen is repainted as answered',
    b2.val('MCQ.s2.done') === true &&
    b2.val('Array.from(document.querySelectorAll("#s2 .scq-opt")).every(function(o){return o.disabled;})') === true);

  /* The #screen= hash chooses the landing screen without cancelling the restore —
     which is what a cross-part "back" relies on. */
  b2.dom.window.close();
  const b3 = boot('01', { keepState: true, hash: '#screen=3' });
  b3.exec('window.__reset(); window.__setState(' + JSON.stringify(dumped) + ');');
  b3.finishBoot(payload, 3);
  ok('resume', 'a #screen= hash overrides the landing screen',
    b3.val('currentScreen') === 3, String(b3.val('currentScreen')));
  ok('resume', 'but the state is still restored (the score survives the override)',
    b3.val('MCQ.s2.done') === true);
  b3.dom.window.close();
}


/* ══════════════ 7. The regression gate, behaviourally ══════════════ */

function offPlatformSendsNothing() {
  /* No ?slxapi: the library never loads, so nothing can reach the network. Asserted
     behaviourally here rather than by symbol presence. */
  const dir = path.join(BASE, PART_DIR('01'));
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8777/' + PART_DIR('01') + '/index.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const w = dom.window;
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
  w.console.error = w.console.warn = w.console.log = () => {};
  const sent = [];
  w.fetch = (...a) => { sent.push(a); return Promise.resolve({ ok: true }); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  for (const src of [...w.document.querySelectorAll('script[src]')]
    .map(s => s.getAttribute('src'))) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) {} }
  }

  ok('gate', 'off platform the library never loaded',
    val('typeof sendStatement720') === 'undefined');
  /* A whole answered screen, driven for real, must be silent and must still score. */
  exec(ANSWER_S2);
  ok('gate', 'answering off platform does not throw',
    val('MCQ.s2.done') === true);
  ok('gate', 'and still records the score locally',
    val('screenWasCorrect("s2")') === true);
  ok('gate', 'and the component result is still computed',
    typeof val('partResult().score.scaled') === 'number');
  ok('gate', 'nothing reached the network', sent.length === 0, String(sent.length));
  exec('leaveToPart("' + PART_DIR('02') + '", 13);');
  ok('gate', 'even leaving the component sends nothing', sent.length === 0, String(sent.length));
  dom.window.close();
}


/* ══════════════ run ══════════════ */

const suites = [
  ['fresh load', freshLoad],
  ['answering', answering],
  ['hints', hints],
  ['no duplicate completed', noDuplicateCompleted],
  ['component + unit completed', componentAndUnit],
  ['resume emits nothing extra', resumeEmitsNothingExtra],
  ['off-platform gate', offPlatformSendsNothing],
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
