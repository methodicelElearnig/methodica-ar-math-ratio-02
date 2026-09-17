/* ═══════════════════ behavioural statement-flow oracle ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   verify-report.js asserts STRUCTURE — that the wiring is present and the contracts
   hold. This asserts BEHAVIOUR: which statements actually leave the lomda when a learner
   does something, in what order, carrying what result — and, the part that matters most,
   which ones do NOT leave when the same screen is reached again by a reload or the back
   button.

   jsdom will not fetch the CDN, so bootXAPI's two loadScript calls are inert. Rather than
   fake the loader, each scenario runs the real page scripts, then executes
   _test/xapi-720-k.js (the very stub the browser gets through ?xapiLib=), then replays
   the loader's post-metadata sequence explicitly. The screen code, the shared helpers and
   the ledger under test are all real.

   Run:
     NODE_PATH=/tmp/lomda-test/node_modules node _test/statement-flow.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = process.argv[2] || path.join(__dirname, '..');
const UNIT = 'methodica-math-ratio-02';
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
    url: 'http://localhost:8779/' + PART_DIR(c) + '/index.html' +
      (opts.search === undefined ? '?slxapi=1&registration=r1' : opts.search) + (opts.hash || ''),
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

  for (const src of [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) { try { exec(fs.readFileSync(p, 'utf8')); } catch (e) {} }
  }

  if (!opts.noLibrary) {
    exec(fs.readFileSync(path.join(BASE, '_test', 'xapi-720-k.js'), 'utf8'));
    exec('window.XAPI_USING_G = true;');
    if (!opts.keepState) exec('window.__reset();');
    /* the component metadata, so xapiQ() resolves against the real catalogue */
    exec('window.METADATA = ' + fs.readFileSync(
      path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, '') + ';');
  }

  const stmts = () => JSON.parse(val('JSON.stringify(window.__stmts ? window.__stmts() : [])'));
  const verbs = () => stmts().map(s => s.verb);
  const clear = () => exec('sessionStorage.removeItem("__test_statements");');

  /* Replay what the loader does after the metadata poll resolves. */
  const finishBoot = (payload, screenOverride) => {
    exec('_resumeReady = true; if (!_unitState) _unitState = readUnitState(); drainPendingUnitState();');
    if (payload !== undefined) {
      exec('applyExecutionState(' + JSON.stringify(payload) + ', ' +
        (screenOverride === undefined ? 'undefined' : screenOverride) + ');');
    }
    exec("try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}");
    if (payload === undefined) exec('xapiOnScreen(currentScreen);');
  };

  return { dom, w, exec, val, stmts, verbs, clear, finishBoot };
}

/* Short label for a statement: verb + the last path segment of whatever it points at. */
function label(s) {
  const id = (s.opts && (s.opts.questionId || s.opts.objectId)) || '';
  return s.verb + (id ? ' ' + String(id).replace(/\/+$/, '').split('/').pop() : '');
}

/* ══════════════ 1. A fresh load ══════════════ */

function freshLoad() {
  const b = boot('01');
  b.finishBoot();
  eq('fresh', 'a fresh load emits the component then the landing item initialized',
    b.verbs(), ['initialized', 'initialized']);
  const s = b.stmts();
  ok('fresh', 'the first is component-scoped', s[0].objectType === 'onlinelesson', JSON.stringify(s[0]));
  ok('fresh', 'the second is the landing screen\'s item',
    s[1].objectType === 'question' && /-01-001$/.test(String(s[1].opts.objectId).replace(/\/+$/, '')),
    JSON.stringify(s[1].opts));
  ok('fresh', 'the landing item is flagged as an evaluation item',
    !!s[1].opts.isEvaluationItem, JSON.stringify(s[1].opts));
  b.dom.window.close();
}

/* ══════════════ 2. A two-question item, start to finish ══════════════ */

function twoQuestionItem() {
  const b = boot('02');
  b.finishBoot();
  b.clear();

  /* s15 = item 001 q1, s16 = item 001 q2 */
  b.exec(`goTo(15);
    ['a','b','c'].forEach(function(r){
      var v = S15_CORRECT[r];
      var btn = document.querySelector('#s15 .saq-row[data-id="'+r+'"] .saq-pill[data-val="'+v+'"]');
      if (btn) s15Pick(r, v, btn);
    });
    s15Check();`);
  eq('item', 'the item\'s first question emits answered, not answered.last',
    b.stmts().map(label), ['answered q1']);

  b.exec('goTo(16); scqSelect("s16","c"); scqCheck("s16");');
  eq('item', 'the item\'s LAST question emits answered.last',
    b.stmts().map(label), ['answered q1', 'answered.last q2']);

  b.exec('goTo(17);');            /* into item 002 -> 001 must close */
  const s = b.stmts();
  eq('item', 'leaving the item closes it, then opens the next',
    s.map(label), ['answered q1', 'answered.last q2',
                   'completed methodica-math-ratio-02-02-001',
                   'initialized methodica-math-ratio-02-02-002']);
  const done = s.find(x => x.verb === 'completed');
  ok('item', 'the item completed claims expectsAnswer', done.opts.expectsAnswer === true,
    JSON.stringify(done.opts));
  eq('item', 'the item completed carries an explicit full score',
    [done.result.success, done.result.score.scaled], [true, 1]);
  b.dom.window.close();
}

/* ══════════════ 3. The guided worked example is NOT graded ══════════════
   Item 003 of part 01 reveals the correct option whatever the learner picks, so it must
   not claim expectsAnswer and must emit no answered at all. This is the whole reason it
   is absent from XAPI_EVAL_ITEMS. */

function guidedItemUngraded() {
  const b = boot('01');
  b.finishBoot();
  b.clear();
  b.exec('goTo(4); gstepSelect("s6","b"); gstepSelect("s8","b"); goTo(13); goTo(3);');
  const s = b.stmts();
  ok('guided', 'the guided item emits no answered statement',
    s.every(x => x.verb.indexOf('answered') !== 0), s.map(label).join(' | '));
  const done = s.find(x => x.verb === 'completed' && /-01-003$/.test(String(x.opts.objectId).replace(/\/+$/, '')));
  ok('guided', 'the guided item still reports completed', !!done, s.map(label).join(' | '));
  ok('guided', 'the guided item completed does NOT claim expectsAnswer',
    done && done.opts.expectsAnswer === false, done && JSON.stringify(done.opts));
  b.dom.window.close();
}

/* ══════════════ 4. Several catalogue questions on one screen ══════════════ */

function multiQuestionScreen() {
  const b = boot('03');
  b.finishBoot();
  b.clear();
  /* s26 = item 004 q1/q2/q3, three ratio rows. Row 2 deliberately wrong. */
  b.exec(`goTo(26);
    var v = {'s26-0a':'1.3','s26-0b':'10','s26-1a':'9','s26-1b':'9','s26-2a':'1','s26-2b':'10'};
    Object.keys(v).forEach(function(id){ document.getElementById(id).value = v[id]; });
    qCheck('s26'); qCheck('s26');`);
  const s = b.stmts().filter(x => x.verb.indexOf('answered') === 0);
  eq('multi', 'one check emits one statement per catalogue question',
    s.map(label), ['answered q1', 'answered q2', 'answered q3']);
  eq('multi', 'each row carries its OWN verdict',
    s.map(x => x.result.success), [true, false, true]);
  eq('multi', 'the per-question ledger keeps all three',
    JSON.parse(b.val('JSON.stringify(XAPI_Q_RESULTS)')),
    { '004/q1': true, '004/q2': false, '004/q3': true });
  /* and the item result is a real partial score, not the library's all-correct AND */
  b.exec(`goTo(27);
    var picks = Q.s27.answers;
    Object.keys(picks).forEach(function(k){
      var btn = document.querySelector('#s27 .saq-pill[data-val="'+picks[k]+'"]');
      if (btn) saqPick('s27', k, picks[k], btn);
    });
    qCheck('s27'); goTo(28);`);
  const done = b.stmts().find(x => x.verb === 'completed' &&
    /-03-004$/.test(String(x.opts.objectId).replace(/\/+$/, '')));
  ok('multi', 'the item completed carries a partial score, not a pass/fail AND',
    done && done.result.score.scaled === 0.75,
    done && JSON.stringify(done.result));
  b.dom.window.close();
}

/* ══════════════ 5. One catalogue question over three screens ══════════════
   The AI table: item 002/q1 of part 04 is answered a row at a time on s33, s34 and s35.
   Reporting each screen as q1 would overwrite the ledger three times and leave the last
   row's verdict standing for the whole question. */

function questionAcrossScreens() {
  const b = boot('04');
  b.finishBoot();
  b.clear();
  const answer = sid => `goTo(${sid.slice(1)});
    var picks = Q.${sid}.answers;
    Object.keys(picks).forEach(function(k){
      var btn = document.querySelector('#${sid} .saq-pill[data-val="'+picks[k]+'"]');
      if (btn) saqPick('${sid}', k, picks[k], btn);
    });
    qCheck('${sid}');`;

  b.exec(answer('s33'));
  eq('across', 'row 1 alone reports nothing',
    b.stmts().filter(x => x.verb.indexOf('answered') === 0).length, 0);
  b.exec(answer('s34'));
  eq('across', 'row 2 still reports nothing',
    b.stmts().filter(x => x.verb.indexOf('answered') === 0).length, 0);
  b.exec(answer('s35'));
  const s = b.stmts().filter(x => x.verb.indexOf('answered') === 0);
  eq('across', 'the third row reports the question exactly once', s.map(label), ['answered.last q1']);
  eq('across', 'with the AND of all three rows', s[0].result.success, true);
  eq('across', 'and one ledger entry, not three',
    Object.keys(JSON.parse(b.val('JSON.stringify(XAPI_Q_RESULTS)'))), ['002/q1']);
  b.dom.window.close();
}

/* ══════════════ 6. No duplicate completed ══════════════
   The failure this whole ledger exists to prevent. */

function noDuplicateCompleted() {
  /* (a) revisiting a closed item inside one page load */
  const b = boot('02');
  b.finishBoot();
  b.clear();
  b.exec(`goTo(15);
    ['a','b','c'].forEach(function(r){
      var v = S15_CORRECT[r];
      var btn = document.querySelector('#s15 .saq-row[data-id="'+r+'"] .saq-pill[data-val="'+v+'"]');
      if (btn) s15Pick(r, v, btn);
    });
    s15Check(); goTo(16); scqSelect("s16","c"); scqCheck("s16");
    goTo(17); goTo(15); goTo(17);`);
  const closes = b.stmts().filter(x => x.verb === 'completed' &&
    /-02-001$/.test(String(x.opts.objectId).replace(/\/+$/, '')));
  eq('ledger', 'an item closed twice in one session emits ONE completed', closes.length, 1);
  const opens = b.stmts().filter(x => x.verb === 'initialized' &&
    /-02-001$/.test(String(x.opts.objectId).replace(/\/+$/, '')));
  ok('ledger', 'but initialized DOES repeat on re-entry (MOE v2.4 §1 requires it)',
    opens.length >= 1, 'found ' + opens.length);
  const doc = JSON.parse(b.val('JSON.stringify(readUnitState())'));
  /* itemLedgerKey is '<part slug>#<item suffix>' — the part slug is in the key precisely
     so two components' item 001 cannot share a ledger entry */
  ok('ledger', 'the completed is recorded in the state document, so it survives a reload',
    doc.doneItems[PART_DIR('02') + '#001'] === true, JSON.stringify(doc.doneItems));
  ok('ledger', 'the ledger key carries the component slug, not just the item suffix',
    Object.keys(doc.doneItems).every(k => k.indexOf(PART_DIR('02') + '#') === 0),
    Object.keys(doc.doneItems).join(', '));
  b.dom.window.close();

  /* (b) a RELOAD onto the same screen: the ledger lives in the document, and
     applyExecutionState stubs the transport for the whole replay */
  const b2 = boot('02', { keepState: true });
  b2.clear();
  b2.finishBoot({ currentScreen: 16, q: {}, scq: { s16: { selected: 'c', attempts: 1, done: true } }, vars: {} }, undefined);
  const after = b2.stmts();
  eq('ledger', 'a reload onto an answered screen re-sends no answered',
    after.filter(x => x.verb.indexOf('answered') === 0).length, 0);
  eq('ledger', 'and no second completed for the already-closed item',
    after.filter(x => x.verb === 'completed' &&
      /-02-001$/.test(String(x.opts.objectId).replace(/\/+$/, ''))).length, 0);
  b2.dom.window.close();
}

/* ══════════════ 7. The replay itself is silent ══════════════ */

function replayIsSilent() {
  const b = boot('03');
  b.clear();
  /* a payload that says the learner already answered s26 */
  b.finishBoot({
    currentScreen: 26,
    qResults: { s26: true },
    q: { s26: { done: true, attempts: 1, lastWrong: null, selected: null, picks: null, _popup: null } },
    inputs: { 's26-0a': '1.3', 's26-0b': '10', 's26-1a': '1', 's26-1b': '5', 's26-2a': '1', 's26-2b': '10' },
    vars: {}
  }, undefined);
  const s = b.stmts();
  eq('replay', 'the replay emits no answered and no completed',
    s.filter(x => /answered|completed/.test(x.verb)).map(label), []);
  eq('replay', 'the learner lands on the saved screen', b.val('currentScreen'), 26);
  ok('replay', 'the answer is repainted: inputs locked',
    b.val('[].slice.call(document.querySelectorAll("#s26 .viq-input-box")).every(function(e){return e.disabled;})'));
  ok('replay', 'the answer is repainted: values restored',
    b.val('document.getElementById("s26-0a").value') === '1.3');
  ok('replay', 'the resumed screen still opens its item exactly once',
    s.filter(x => x.verb === 'initialized' && x.objectType === 'question').length === 1,
    s.map(label).join(' | '));
  b.dom.window.close();
}

/* ══════════════ 7b. An item answered before a reload still closes after it ══════════════
   xapi-720-k.js gates an item's 'completed' on xapiItemAnswered[itemId], which it fills ONLY
   from an 'answered' passing through in the SAME page load:

       if (sttmContext?.expectsAnswer && !xapiItemAnswered[_cid]) {
           console.log("[XAPI] item left unanswered — deferring 'completed': " + _cid);
           return;          // "deferring" is a DROP — there is no queue, flush or retry

   A resume deliberately re-sends no answers, so without xapiSeedAnsweredFromResume()
   (../unit-js/20-xapi.js, called at the end of applyExecutionState) the close below is
   silently dropped — while sendStatementOnce, having called the sender, still marks the
   ledger sent. The statement is then lost for good: the lomda never asks again and the
   library has no retry of any kind. The trigger is the ordinary path — answer, leave, come
   back, continue.

   Found live against Kata on 07.09.26 and invisible to this suite until _test/xapi-720-k.js
   learned the guard, so keep both halves: deleting the stub's guard makes this assertion
   vacuous rather than failing. */

function itemClosesAfterReload() {
  /* Session one: answer s26, which is item 004's question, and keep the payload. */
  const a = boot('03');
  a.finishBoot();
  a.clear();
  a.exec(`goTo(26);
    var v = {'s26-0a':'1.3','s26-0b':'10','s26-1a':'1','s26-1b':'5','s26-2a':'1','s26-2b':'10'};
    Object.keys(v).forEach(function(id){ document.getElementById(id).value = v[id]; });
    qCheck('s26');`);
  const payload = JSON.parse(a.val('JSON.stringify(capturePartPayload())'));
  a.dom.window.close();

  /* Session two: a fresh window — so a fresh library with an empty xapiItemAnswered, which is
     the whole point — replaying that payload. */
  const b = boot('03');
  b.clear();
  b.finishBoot(payload, undefined);
  eq('reclose', 'the replay itself closes nothing', 
    b.stmts().filter(x => x.verb === 'completed').length, 0);

  /* Screen 26 is in item 004 and screen 28 in item 005, so this crossing closes 004 — the
     item answered in the previous session. Nothing was closed above, so every 'completed'
     here belongs to this crossing. */
  b.exec('goTo(28);');
  const closed = b.stmts().filter(x => x.verb === 'completed').map(x => x.opts.objectId);
  ok('reclose', 'an item answered before the reload still closes after it',
    closed.length === 1 && /-03-004\/$/.test(String(closed[0])),
    'closed ' + closed.length + ': ' + closed.join(','));
  b.dom.window.close();
}


/* ══════════════ 8. Reporting off is genuinely off ══════════════
   The load-bearing property: without ?slxapi the lomda must behave exactly as it did
   before instrumentation. Here the library is never delivered at all, which is the
   harsher case — sendStatement720 does not even exist. */

function reportingOff() {
  const b = boot('03', { search: '', noLibrary: true });
  ok('off', 'no library means no transport', b.val('typeof sendStatement720') === 'undefined');
  b.exec(`goTo(26);
    var v = {'s26-0a':'1.3','s26-0b':'10','s26-1a':'1','s26-1b':'5','s26-2a':'1','s26-2b':'10'};
    Object.keys(v).forEach(function(id){ document.getElementById(id).value = v[id]; });
    qCheck('s26');`);
  ok('off', 'answering still resolves the question', b.val('Q.s26.done') === true);
  ok('off', 'answering still locks the inputs',
    b.val('[].slice.call(document.querySelectorAll("#s26 .viq-input-box")).every(function(e){return e.disabled;})'));
  ok('off', 'answering still shows the feedback',
    b.val('!document.getElementById("s26-popup").classList.contains("hidden")'));
  /* XAPI_Q_RESULTS is written by xapiAnswered ahead of its own gate, so the score
     survives with reporting off — which is what keeps the progress strips working */
  eq('off', 'the score is still recorded',
    JSON.parse(b.val('JSON.stringify(XAPI_Q_RESULTS)')),
    { '004/q1': true, '004/q2': true, '004/q3': true });
  ok('off', 'and nothing threw', b.val('typeof currentScreen') === 'number');
  b.dom.window.close();
}

/* ══════════════ 9. The cross-part seam ══════════════ */

/* Since 2026-09-16 the platform owns routing (README.md): walking past the part's last
   screen reports the component and STOPS — no pointer move, no hop — unless the page runs
   under DEV_NAV (?dev=1 without ?registration), where the old handover still works for a
   local walkthrough. finishUnit reports the component only; nothing is unit-scoped. */
function crossPartSeam() {
  /* PRODUCTION: the boot URL carries ?registration. */
  const b = boot('02');
  b.finishBoot();
  b.clear();
  b.exec('goTo(20); try { goTo(21); } catch (e) {}');
  const s = b.stmts();
  const comp = s.filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson');
  eq('seam', 'leaving the last screen reports the component completed exactly once', comp.length, 1);
  /* partResult() is null when nothing was answered — this walk answers nothing. The point is
     that the statement went out; componentScore-style result checks live in the other suites. */
  ok('seam', 'the component completed carries partResult() (null here: nothing answered)',
    comp[0] && (comp[0].result === null || typeof comp[0].result.success === 'boolean'),
    JSON.stringify(comp[0] && comp[0].result));
  ok('seam', 'nothing sent is unit-scoped', !s.some(x => x.opts && x.opts.scope === 'unit'));
  const doc = JSON.parse(b.val('JSON.stringify(readUnitState())'));
  ok('seam', 'production: the document is this part\'s, with no landing pointer / parts / prev (v6)',
    doc.component === PART_DIR('02') && !('part' in doc) && !('parts' in doc) && !('prev' in doc), JSON.stringify(doc));
  ok('seam', 'production: no back edge was recorded',
    b.val("sessionStorage.getItem('lomda_nav_edges::methodica-math-ratio-02')") === null, String(b.val("sessionStorage.getItem('lomda_nav_edges::methodica-math-ratio-02')")));
  ok('seam', 'production: the last screen\'s button is disabled after the report',
    b.val("document.getElementById('s20-check').disabled") === true &&
    b.val("document.getElementById('s20-check').getAttribute('aria-disabled')") === 'true');
  b.clear();
  b.exec('try { goTo(21); } catch (e) {}');
  eq('seam', 'leaving again reports nothing more',
    b.stmts().filter(x => x.verb === 'completed').length, 0);
  b.dom.window.close();

  /* DEV_NAV: the old handover, for the local walkthrough. */
  const d = boot('02', { search: '?slxapi=1&dev=1' });
  d.finishBoot();
  d.clear();
  ok('seam', 'dev: DEV_NAV is true with ?dev=1 and no ?registration', d.val('DEV_NAV') === true);
  d.exec('goTo(20); try { goTo(21); } catch (e) {}');
  eq('seam', 'dev: the handover still reports the component completed exactly once',
    d.stmts().filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson').length, 1);
  const dd = JSON.parse(d.val('JSON.stringify(readUnitState())'));
  ok('seam', 'dev: this part\'s document was saved before the hop — its own payload, no pointer fields (v6)',
    dd.component === PART_DIR('02') && dd.payload && !('part' in dd) && !('parts' in dd) && !('prev' in dd), JSON.stringify(dd));
  ok('seam', 'dev: the back edge into 03 records this part (sessionStorage edge map)',
    (function () { try { return JSON.parse(d.val("sessionStorage.getItem('lomda_nav_edges::methodica-math-ratio-02')"))[PART_DIR('03')].from === PART_DIR('02'); } catch (e) { return false; } })(),
    String(d.val("sessionStorage.getItem('lomda_nav_edges::methodica-math-ratio-02')")));
  d.dom.window.close();

  /* The finale: component 05's "סיימתי" reports the component — only. */
  const f = boot('05');
  f.finishBoot();
  f.clear();
  ok('seam', 'xapiCompleteUnit no longer exists', f.val('typeof xapiCompleteUnit') === 'undefined');
  f.exec('goTo(50); try { goTo(51); } catch (e) {}');
  const fin = f.stmts().filter(x => x.verb === 'completed');
  eq('seam', 'the finale sends exactly one component completed',
    fin.filter(x => x.objectType === 'onlinelesson').length, 1);
  ok('seam', 'the finale sends nothing unit-scoped',
    !fin.some(x => x.opts && x.opts.scope === 'unit'), JSON.stringify(fin.map(x => x.opts)));
  ok('seam', '"סיימתי" is disabled after the report',
    f.val("document.getElementById('s50-continue').disabled") === true);
  f.clear();
  f.exec('try { goTo(51); } catch (e) {}');
  eq('seam', 're-reaching the finale reports nothing again',
    f.stmts().filter(x => x.verb === 'completed').length, 0);
  f.dom.window.close();
}

/* ══════════════ 11. The set-B gate ══════════════
   s21 promises "ענו נכון על 2 שאלות ומעלה כדי להתקדם" and, until 17.09, nothing enforced it:
   advanceScreen() only asked whether a screen was DONE, and mcqFinish()/s24's finish() set done on
   the second WRONG attempt too, so one correct answer of three walked the learner into s25's
   "יופי של עבודה!" (MOE tester, 17.09). The gate stops the component instead, and the PLATFORM
   routes on the 'completed' — metadata recommendedAfterFail: ["methodica-math-ratio-02-01"].

   What this suite is really guarding is the two reload cases at the bottom. A gate that only works
   until the learner refreshes is the original bug with a longer reproduction. */

/* Drive set B the way a learner can — through .click() on the real buttons, never by calling the
   check handlers directly.

   ⚠️ That distinction is the whole point. A wrong first attempt leaves the check button DISABLED
   until the answer changes (mcqUpdateBar's lastWrong test, s24OnInput's), so a second attempt has to
   pick a DIFFERENT wrong answer. Calling s23Check() twice on an unchanged selection does resolve the
   screen — but through a door the UI keeps locked, and a test that walks it stops describing the
   product. Found by walking this in a browser, where the second click landed on a dead button and
   s23 never reached qResults at all.

   A correct answer is checked once; checking it again would re-enter the "שנמשיך?" branch and
   advance. So the click counts differ by design. */
const SET_B_MCQ = { s22: ['a', 'b', 'c'], s23: ['a', 'b', 'd'] };
/* A click that RECORDS a dead target instead of throwing: an exception inside exec() is an uncaught
   error in the jsdom window, not a throw node can catch, so it would vanish silently. */
const CLICK = 'function(s){ var e = document.querySelector(s);' +
  ' if (!e || e.disabled) { (window.__dead = window.__dead || []).push(s); return; } e.click(); }';
function walkSetB(b, pattern) {
  ['s22', 's23'].forEach(function (sid, i) {
    const opt = id => '#' + sid + ' .scq-opt[data-id="' + id + '"]';
    const full = SET_B_MCQ[sid];
    let steps;
    if (pattern[i]) {
      steps = full.map(id => opt(id)).concat('#' + sid + '-check');
    } else {
      /* two different wrong sets, each a strict subset of the correct one */
      steps = [opt(full[0]), '#' + sid + '-check',
               opt(full[0]), opt(full[1]), '#' + sid + '-check'];
    }
    b.exec('goTo(' + sid.slice(1) + '); var _c = ' + CLICK + ';' +
      JSON.stringify(steps) + '.forEach(_c);');
  });

  const s24set = v => "['s24a-num','s24a-den','s24b-left','s24b-right'].forEach(function(id,i){" +
    ' var e = document.getElementById(id); e.value = ' + JSON.stringify(v) + '[i];' +
    " e.dispatchEvent(new Event('input', { bubbles: true })); });";
  b.exec('goTo(24); var _c = ' + CLICK + ';' +
    (pattern[2]
      ? s24set([1, 3, 2, 1]) + " _c('#s24-check');"
      /* two different wrong entries, for the same reason as the MCQs above */
      : s24set([9, 9, 9, 9]) + " _c('#s24-check');" + s24set([8, 8, 8, 8]) + " _c('#s24-check');"));

  /* ⚠️ Without all three verdicts recorded, gateBlocks() fails open and every assertion below would
     pass for the wrong reason. Pin it before judging anything. */
  eq('gate', 'walk ' + JSON.stringify(pattern) + ' clicks nothing the UI had disabled',
    JSON.parse(b.val('JSON.stringify(window.__dead || [])')), []);
  eq('gate', 'walk ' + JSON.stringify(pattern) + ' resolves all three of set B',
    JSON.parse(b.val('JSON.stringify(Object.keys(qResults).sort())')), ['s22', 's23', 's24']);
  eq('gate', 'walk ' + JSON.stringify(pattern) + ' records the verdicts it meant to',
    JSON.parse(b.val('JSON.stringify([qResults.s22, qResults.s23, qResults.s24])')), pattern);
}

function setBGate() {
  /* ── 3 of 3 and 2 of 3: the gate is invisible ── */
  [[true, true, true], [true, true, false], [false, true, true]].forEach(function (pat) {
    const n = pat.filter(Boolean).length;
    const b = boot('03');
    b.finishBoot();
    b.clear();
    walkSetB(b, pat);
    b.exec("document.getElementById('s24-check').click();");
    eq('gate', n + ' of 3 ' + JSON.stringify(pat) + ' walks on to s25', b.val('currentScreen'), 25);
    eq('gate', n + ' of 3 sends no component completed',
      b.stmts().filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson').length, 0);
    ok('gate', n + ' of 3 leaves "שנמשיך?" live',
      b.val("document.getElementById('s24-check').disabled") === false);
    b.dom.window.close();
  });

  /* ── 1 of 3: the gate fires ── */
  const c = boot('03');
  c.finishBoot();
  c.clear();
  walkSetB(c, [true, false, false]);
  ok('gate', 'the gated learner is offered a live "שנמשיך?" to click — the gate is on the click',
    c.val("document.getElementById('s24-check').disabled") === false);
  c.exec("document.getElementById('s24-check').click();");

  eq('gate', '1 of 3 does NOT reach s25', c.val('currentScreen'), 24);
  const s = c.stmts();
  const comp = s.filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson');
  eq('gate', '1 of 3 reports the component completed exactly once', comp.length, 1);
  ok('gate', 'and it carries success:false — what recommendedAfterFail routes on',
    !!comp[0] && !!comp[0].result && comp[0].result.success === false &&
    comp[0].result.score.scaled < 0.6,
    JSON.stringify(comp[0] && comp[0].result));
  ok('gate', 'nothing sent is unit-scoped', !s.some(x => x.opts && x.opts.scope === 'unit'));

  const itemId = x => String((x.opts || {}).objectId || '').replace(/\/+$/, '');
  const closed003 = s.filter(x => x.verb === 'completed' && /-03-003$/.test(itemId(x)));
  eq('gate', 'the open item 003 is closed exactly once', closed003.length, 1);
  ok('gate', 'item 003 closes BEFORE the component',
    !!closed003[0] && !!comp[0] && s.indexOf(closed003[0]) < s.indexOf(comp[0]));
  ok('gate', 'items 004 and 005 are never opened or closed',
    !s.some(x => /-03-(004|005)$/.test(itemId(x))), s.map(label).join(' | '));
  ok('gate', 'the button is disabled and aria-disabled after the report',
    c.val("document.getElementById('s24-check').disabled") === true &&
    c.val("document.getElementById('s24-check').getAttribute('aria-disabled')") === 'true');

  c.clear();
  c.exec('advanceScreen(); advanceScreen();');
  eq('gate', 'clicking again reports nothing more',
    c.stmts().filter(x => x.verb === 'completed').length, 0);
  eq('gate', 'and still does not move', c.val('currentScreen'), 24);

  const doc = JSON.parse(c.val('JSON.stringify(__state())'));
  ok('gate', 'the completed is in the ledger, so it survives the reload',
    doc.done && doc.done[PART_DIR('03')] === true, JSON.stringify(doc.done));
  ok('gate', 'the durable per-component score was recorded',
    doc.results && doc.results.ratio02_c03_scaled !== undefined, JSON.stringify(doc.results));
  const payload = doc.payload;
  eq('gate', 'the flush committed the gated screen', payload.currentScreen, 24);
  c.dom.window.close();

  /* ── reload AFTER the gate fired: dead button, no second completed ──
     This is the assertion the whole change hangs on. restoreScreenUI() → paintS24() →
     _doneButton('s24') re-enables the button on every resume; without restoreEndedButton() the
     learner refreshes and walks straight into s25 with a 'completed' already sent. */
  const d = boot('03', { keepState: true });
  d.exec('window.__setState(' + JSON.stringify(doc) + ');');
  d.clear();
  d.finishBoot(payload, undefined);
  eq('gate', 'a reload onto a fired gate re-sends no component completed',
    d.stmts().filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson').length, 0);
  eq('gate', 'and re-sends no answered',
    d.stmts().filter(x => x.verb.indexOf('answered') === 0).length, 0);
  ok('gate', 'restoreEndedButton beats paintS24: the button comes back DISABLED',
    d.val("document.getElementById('s24-check').disabled") === true);
  d.exec('advanceScreen();');
  eq('gate', 'and it still cannot move', d.val('currentScreen'), 24);
  d.dom.window.close();

  /* ── reload BEFORE the click: live button, and the click still reports ──
     Same restored state, empty ledger. Only the ledger tells these two learners apart, and getting
     it wrong here is a dead end: a learner who never clicked would be handed a disabled button and
     no 'completed', so the platform would never route them anywhere. */
  const e = boot('03', { keepState: true });
  const unclicked = JSON.parse(JSON.stringify(doc));
  unclicked.done = {};
  e.exec('window.__setState(' + JSON.stringify(unclicked) + ');');
  e.clear();
  e.finishBoot(payload, undefined);
  ok('gate', 'a reload with nothing in the ledger leaves the button LIVE — never a dead end',
    e.val("document.getElementById('s24-check').disabled") === false);
  e.exec('advanceScreen();');
  eq('gate', 'and that click reports the component exactly once',
    e.stmts().filter(x => x.verb === 'completed' && x.objectType === 'onlinelesson').length, 1);
  eq('gate', 'still on s24', e.val('currentScreen'), 24);
  e.dom.window.close();
}

/* ══════════════ run ══════════════ */

const SUITES = [
  ['fresh load', freshLoad],
  ['a two-question item', twoQuestionItem],
  ['the guided item is ungraded', guidedItemUngraded],
  ['several questions on one screen', multiQuestionScreen],
  ['one question across three screens', questionAcrossScreens],
  ['no duplicate completed', noDuplicateCompleted],
  ['the replay is silent', replayIsSilent],
  ['an answered item closes after a reload', itemClosesAfterReload],
  ['reporting off is off', reportingOff],
  ['the cross-part seam', crossPartSeam],
  ['the set-B gate', setBGate],
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
