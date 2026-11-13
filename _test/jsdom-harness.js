/* ═══════════════════ jsdom boot harness (write-guard only) — methodica-ar-math-ratio-02 ═══════════════════
   NOT DEPLOYED. Dev tooling only. Required by verify-report.js and statement-flow.js.

   boot(part, opts) loads the part's REAL index.html and executes every local <script src> in
   document order from disk — the vendored 720-core, the platform layer, the part config and
   90-boot.js — exactly as the browser does. jsdom does not fetch the CDN, so bootXAPI()'s two
   loadScript() calls stay inert; a scenario that needs reporting executes _test/xapi-720-k.js
   (the stub the browser gets through ?xapiLib= on localhost) and replays the loader's
   post-metadata sequence with finishBoot(). Everything under test is the real code.

   Copied from methodica-math-ratio-04 _test/harness.js (pattern from ratio-01 35648a6);
   retargeted to six components; answerFor/enterJs also build multi, dropdown and dual-select
   answers, which this unit has and ratio-04 does not.
   jsdom lives OUTSIDE the OneDrive tree (ADDING-REPORTING-AND-RESUME.md §10.1):
     NODE_PATH=/tmp/lomda-test/node_modules node _test/<file>.js */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = process.env.LOMDA_BASE || path.join(__dirname, '..');
const UNIT = 'methodica-ar-math-ratio-02';
const PARTS = ['01', '02', '03', '04', '05'];
const PART_DIR = c => UNIT + '-' + c;
const readMeta = c => JSON.parse(fs.readFileSync(path.join(BASE, 'metadata', PART_DIR(c) + '.json'), 'utf8').replace(/^﻿/, ''));

function makeReporter(name) {
  const failures = [];
  let passes = 0;
  const ok = (tag, what, cond, detail) => {
    if (cond) { passes++; return; }
    failures.push('[' + tag + '] ' + what + (detail ? '  —  ' + detail : ''));
  };
  const eq = (tag, what, actual, expected) => {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    ok(tag, what, a === e, 'got ' + a + ', expected ' + e);
  };
  const done = () => {
    console.log('\n' + name + ': ' + passes + ' passed, ' + failures.length + ' failed');
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exitCode = failures.length ? 1 : 0;
    return failures.length;
  };
  return { ok, eq, done, failures };
}

/* opts.search      query string (default: '?slxapi=1&registration=r1' when opts.lib, '' otherwise)
   opts.hash        '#screen=N'
   opts.lib         execute the stub library after the page scripts (+ XAPI_USING_G)
   opts.libFile     the stub to execute (default xapi-720-k.js; xapi-720-l.js adds saveState720OnLeave)
   opts.keepState   do not __reset() the stub's sessionStorage (simulated reload)
   opts.storage     { session: {...}, local: {...} } seeded before any script runs
   opts.meta        inject window.METADATA from metadata/<part>.json (default true) */
async function boot(c, opts) {
  opts = opts || {};
  const dir = path.join(BASE, PART_DIR(c));
  const search = opts.search !== undefined ? opts.search : (opts.lib ? '?slxapi=1&registration=r1' : '');
  const errors = [], warns = [], logs = [];
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: 'http://localhost:8777/' + UNIT + '/' + PART_DIR(c) + '/index.html' + search + (opts.hash || ''),
    runScripts: 'dangerously',   // inline markup scripts (the boot-cover net) run as in a browser; src scripts are NOT fetched
    pretendToBeVisual: true,
    beforeParse(w) {
      if (opts.storage && opts.storage.session) for (const k in opts.storage.session) w.sessionStorage.setItem(k, opts.storage.session[k]);
      if (opts.storage && opts.storage.local) for (const k in opts.storage.local) w.localStorage.setItem(k, opts.storage.local[k]);
    }
  });
  const w = dom.window;
  w.console.error = (...a) => errors.push(a.map(String).join(' '));
  w.console.warn = (...a) => warns.push(a.map(String).join(' '));
  w.console.log = (...a) => logs.push(a.map(String).join(' '));
  w.__fetches = [];
  w.fetch = (url, init) => { w.__fetches.push({ url: String(url), init: init || {} }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = function () {};   // jsdom has none; unit.js teachCheck nudges the feedback into view

  /* A classic <script> element per file, so top-level let/const land in the ONE global lexical
     scope all page scripts share — exactly the cross-file visibility the unit relies on (an
     eval would scope them to itself). A load-time throw is reported through window.onerror. */
  w.addEventListener('error', (ev) => errors.push('[script error] ' + (ev.message || (ev.error && ev.error.message))));
  const exec = (code, label) => {
    const el = w.document.createElement('script');
    el.textContent = code + '\n//# sourceURL=' + (label || 'exec');
    w.document.head.appendChild(el);
    el.remove();
  };
  const val = (expr) => {
    exec('window.__v = (function(){ try { return (' + expr + '); } catch (e) { return "__throw:" + e.message; } })();', 'val');
    return w.__v;
  };

  const srcs = [...w.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const src of srcs) {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith('//')) continue;
    const p = path.resolve(dir, src.split('?')[0]);
    if (fs.existsSync(p)) exec(fs.readFileSync(p, 'utf8'), src);
    else errors.push('[missing script] ' + src);
  }
  /* 90-boot.js (like the 720-core) runs at DOMContentLoaded: wait for jsdom's real one — never
     dispatch a synthetic event, or the boot would run twice. */
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));

  if (opts.lib) {
    /* from THIS folder, not BASE: a deployment package (verify-report.js <pkg>) correctly has no _test/ */
    exec(fs.readFileSync(path.join(__dirname, opts.libFile || 'xapi-720-k.js'), 'utf8'), 'stub');
    exec('window.XAPI_USING_G = true;');
    if (!opts.keepState) exec('window.__reset();');
  }
  if (opts.meta !== false) {
    exec('window.METADATA = ' + JSON.stringify(readMeta(c)) + ';');
  }

  const stmts = () => JSON.parse(val('JSON.stringify(window.__stmts ? window.__stmts() : [])'));
  const verbs = () => stmts().map(s => s.verb);
  const state = () => JSON.parse(val('JSON.stringify(window.__state ? window.__state() : null)'));
  const sessionDump = () => { const o = {}; for (let i = 0; i < w.sessionStorage.length; i++) { const k = w.sessionStorage.key(i); o[k] = w.sessionStorage.getItem(k); } return o; };
  const localDump = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };

  /* Replay what 50-loader.js does after the metadata poll resolves (phase A read + phase B). */
  const finishBoot = (screenOverride) => {
    exec('var __doc = readUnitState(); adoptUnitCharacter(__doc); _resumeReady = true; if (!_unitState) _unitState = emptyUnitState(); drainPendingUnitState();' +
      'window.__resumed = false; if (__doc.payload) { applyExecutionState(__doc.payload, ' +
      (screenOverride === undefined ? 'undefined' : screenOverride) + '); window.__resumed = true; }' +
      "try { sendStatement720('initialized', 'onlinelesson'); } catch (e) {}" +
      'if (!window.__resumed) xapiOnScreen(currentScreen);', 'finishBoot');
  };

  /* A reload: a new page for the same part over the same sessionStorage (stub state + log). */
  const reload = async (o) => {
    const b = await boot(c, Object.assign({}, opts, o || {}, { keepState: true, storage: { session: sessionDump(), local: localDump() } }));
    return b;
  };

  const flushTimers = () => { /* debounced writes: run any pending 800 ms timer now */
    exec('if (window.__flushDebounce) window.__flushDebounce();');
  };

  return { dom, w, exec, val, stmts, verbs, state, finishBoot, reload, errors, warns, logs, flushTimers, sessionDump, localDump };
}

/* Answers per quiz screen, derived from the page's own QUESTIONS (w = a booted window):
   right(q), and two DISTINCT wrong answers wrong(q, 0) / wrong(q, 1) — distinct so the Retry
   gate lets the second one through. Returned as the shape enterJs takes. */
function answerFor(q, kind, k) {
  k = k || 0;
  if (q.type === 'single') {
    if (kind === 'right') return { single: q.correct };
    const wr = q.options.filter(o => o.id !== q.correct);
    return { single: wr[k % wr.length].id };
  }
  if (q.type === 'multi') {
    if (kind === 'right') return { multi: q.correctSet.slice() };
    const ids = q.options.map(o => o.id), bad = ids.filter(id => q.correctSet.indexOf(id) === -1);
    /* k=0: one wrong option; k=1: a correct one plus a wrong one — distinct sets */
    return { multi: k === 0 ? [bad[0] || ids[0]] : [q.correctSet[0], bad[0] || ids[ids.length - 1]] };
  }
  if (q.type === 'dropdown') {
    return { selects: '.dd-select', fn: 'quizDropdownChange', vals: q.blanks.map(b => {
      if (kind === 'right') return b.correct;
      const w = b.pool.filter(v => v !== b.correct); return w[k % w.length];
    }) };
  }
  if (q.type === 'dual-select') {
    if (kind === 'right') return { selects: '.year-select', fn: 'quizDualChange', vals: q.correctPair.slice() };
    const w = q.pool.filter(y => q.correctPair.indexOf(y) === -1);
    return { selects: '.year-select', fn: 'quizDualChange', vals: [w[k % w.length], q.correctPair[0]] };
  }
  if (q.type === 'value-input') {
    return { inputs: kind === 'right' ? q.correctInputs.slice() : q.correctInputs.map(() => String(900 + k)) };
  }
  if (q.type === 'statement') {
    /* wrong: every row flipped on k=0, only the first row flipped on k=1 */
    return { rows: q.statements.map((st, i) => String(kind === 'right' ? st.correct : ((k === 0 || i === 0) ? !st.correct : st.correct))) };
  }
  throw new Error('no answer builder for type ' + q.type);
}

/* JS source that enters an answer through the real handlers (no check click). */
function enterJs(n, ans) {
  if (ans.multi) {
    return 'document.querySelectorAll("#q' + n + ' .scq-opt.selected").forEach(function(o){ quizSelect(' + n + ', o); });' +
      JSON.stringify(ans.multi) + '.forEach(function(id){ quizSelect(' + n + ', document.querySelector("#q' + n + ' .scq-opt[data-id=\'" + id + "\']")); });';
  }
  if (ans.selects) {
    return 'document.querySelectorAll("#q' + n + ' ' + ans.selects + '").forEach(function(s,k){ s.value = ' + JSON.stringify(ans.vals) + '[k]; }); ' + ans.fn + '(' + n + ');';
  }
  if (ans.inputs) {
    return 'document.querySelectorAll("#q' + n + ' .vi-input").forEach(function(inp,k){ inp.value = ' + JSON.stringify(ans.inputs) + '[k]; }); quizInputChange(' + n + ');';
  }
  if (ans.rows) {
    return JSON.stringify(ans.rows) + '.forEach(function(v,i){ var r = document.querySelectorAll("#q' + n + ' .stmt-row")[i];' +
      ' quizStatementPick(' + n + ', i, r.querySelector(\'.stmt-pill[data-val="\' + v + \'"]\')); });';
  }
  return 'quizSelect(' + n + ', document.querySelector(\'#q' + n + ' .scq-opt[data-id="' + ans.single + '"]\'));';
}
const clickCheck = n => 'document.getElementById("q' + n + '-check").click();';

module.exports = { BASE, UNIT, PARTS, PART_DIR, readMeta, makeReporter, boot, answerFor, enterJs, clickCheck, fs, path };
