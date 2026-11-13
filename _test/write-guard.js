/* ═══════════════════ write-guard + leave save — methodica-ar-math-ratio-02 ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   No write before the restore, and the leave save through xapi-720-l.js
   (Documentation/reporting-and-resume/BOOT-AND-RESUME-HARDENING-2026-11-03.md §2.1-2.3, §2.6, §2.10;
   KNOWN-ISSUE-drain-overwrites-payload.md). The checks of §2.6, on this unit's harness:
   a-j  a saved document on screen 2 → a character pick + navigation before stage B writes nothing; the
        drain writes the document AS READ; the restore lands on 2; the debounced document (held by
        reference) still says 2; markSent before stage B marks in memory only; a failed read (not a 404)
        closes every write until a read succeeds; a 404 is a fresh document.
   k-l  the source shape of 40-resume.js / 50-loader.js.
   m-p  every part: the net raises __resumeInFlight itself (only with a registration) and keeps 800 /
        11000; the two preloads equal the loader's URLs (letter included); preconnect to Kata; raster
        images off the landing screen lazy.
   s-t  the leave save: the shape, and flushResumeSaveOnLeave through saveState720OnLeave on -l and
        through saveState720 on -k (no such function — the rollback path).
   q    the character clips of a hidden screen get no src at boot (§2.3 C4) — this unit's clips are
        set by applyCharacter() on screen entry (only where the unit has data-char-clip videos).
   Ported 13.11.26 from methodica-math-proportion-01 (6899f72); the landing section is the part's
   PART_CONFIG.start (the markup marks no .screen.active). The first check of each group fails on
   the code before 13.11.26.

   Run:  NODE_PATH=C:/lomda-test/node_modules node _test/write-guard.js
*/
'use strict';

const H = require('./jsdom-harness');
const { JSDOM } = require('jsdom');
const R = H.makeReporter('write-guard');
const { ok, eq } = R;
const CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';

/* part 01 on the stub, then an in-memory store behind loadState720 / saveState720 / the debounced
   write (kept by reference, as the library does) — the stage-A/B window replayed by hand */
async function bootStore(libFile) {
  const b = await H.boot('01', { lib: true, libFile: libFile || 'xapi-720-k.js' });
  const w = b.w;
  w.__store = null;
  w.__lr = { op: 'load', status: 404, ok: true, reason: 'absent' };
  w.loadState720 = function () {
    const d = w.__store ? JSON.parse(JSON.stringify(w.__store)) : null;
    w.__lr = d ? { op: 'load', status: 200, ok: true, reason: 'ok' } : { op: 'load', status: 404, ok: true, reason: 'absent' };
    return d;
  };
  w.saveState720 = function (id, doc) { w.__store = JSON.parse(JSON.stringify(doc)); return true; };
  w.saveState720Debounced = function (id, doc) { w.__debouncedDoc = doc; };
  w.stateLastResult720 = function () { return w.__lr; };
  b.seed = d => { w.__store = JSON.parse(JSON.stringify(d)); };
  b.stored = () => w.__store;
  b.slug = H.PART_DIR('01');
  return b;
}
const SEED = slug => ({ v: 6, component: slug, payload: { currentScreen: 2 }, done: {}, doneItems: {}, hints: {},
                        ui: { character: 'character-1' }, results: {} });
const screenOf = d => (d && d.payload ? d.payload.currentScreen : null);

(async () => {
  /* the version the unit writes, so the seed is not discarded as foreign */
  const probe = await H.boot('01', { lib: true });
  const VER = probe.val('RESUME_STATE_VERSION');
  const seed = slug => Object.assign(SEED(slug), { v: VER });

  /* a-d: the drain */
  let b = await bootStore();
  b.seed(seed(b.slug));
  b.exec("readUnitState(); setUnitCharacter('character-2'); goTo(1);");
  ok('write-guard', 'a: a card pick + navigation before stage B writes nothing',
     screenOf(b.stored()) === 2 && b.val('_pendingProfile && _pendingProfile.character') === 'character-2', JSON.stringify(b.stored()).slice(0, 200));
  b.exec('_resumeReady = true; drainPendingUnitState();');
  ok('write-guard', 'b: the drain persists the document AS READ: saved payload intact, character updated',
     screenOf(b.stored()) === 2 && b.stored().ui.character === 'character-2' && b.stored().component === b.slug, JSON.stringify(b.stored()).slice(0, 300));
  b.exec('applyExecutionState(_unitState.payload);');
  ok('write-guard', 'c: the restore lands on the saved screen after the drain', b.val('currentScreen') === 2, 'currentScreen=' + b.val('currentScreen'));
  ok('write-guard', 'd: the debounced document (held by reference) still carries the saved payload',
     screenOf(b.w.__debouncedDoc) === 2, JSON.stringify(b.w.__debouncedDoc && b.w.__debouncedDoc.payload).slice(0, 200));

  /* e-f: markSent */
  b = await bootStore();
  b.seed(seed(b.slug));
  b.exec('readUnitState(); goTo(1); markSent("doneItems", "x");');
  ok('write-guard', 'e: markSent before stage B marks in memory but writes nothing',
     screenOf(b.stored()) === 2 && !(b.stored().doneItems || {}).x && b.val('_unitState.doneItems.x') === true, JSON.stringify(b.stored()).slice(0, 200));
  b.exec('_resumeReady = true; flushResumeSave();');
  ok('write-guard', 'f: the key marked in memory rides the next save', b.stored().doneItems.x === true);

  /* g-j: a failed read */
  b = await bootStore();
  b.seed(seed(b.slug));
  const realLoad = b.w.loadState720;
  b.w.loadState720 = function () { b.w.__lr = { op: 'load', status: 500, ok: false, reason: 'rejected' }; return null; };
  b.exec('readUnitState();');
  ok('write-guard', 'g: a read that fails (not a 404) is flagged, not taken as a fresh document',
     b.val('_resumeReadFailed') === true && b.val('_unitState.payload') === null);
  b.w.__debouncedDoc = undefined;
  b.exec('_resumeReady = true; window.__p = persistUnitState(_unitState); flushResumeSave(); flushResumeSaveOnLeave(); markSent("done", "y"); goTo(1); scheduleResumeSave();');
  ok('write-guard', 'h: after a failed read every write is refused and the stored document is untouched',
     b.w.__p === false && screenOf(b.stored()) === 2 && b.stored().done.y === undefined && b.w.__debouncedDoc === undefined, JSON.stringify(b.stored()).slice(0, 200));
  b.w.loadState720 = realLoad;
  b.exec('readUnitState();');
  ok('write-guard', 'i: a read that succeeds afterwards clears the flag and restores the payload',
     b.val('_resumeReadFailed') === false && b.val('_unitState.payload.currentScreen') === 2);
  b.w.__store = null;
  b.exec('readUnitState();');
  ok('write-guard', 'j: a 404 ("nothing saved yet") is NOT a failed read', b.val('_resumeReadFailed') === false && b.val('_unitState.payload') === null);

  /* k-l, s: source shape */
  const r40 = H.fs.readFileSync(H.path.join(H.BASE, 'unit-js', '40-resume.js'), 'utf8');
  const r50 = H.fs.readFileSync(H.path.join(H.BASE, 'unit-js', '50-loader.js'), 'utf8');
  const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   /* comments may name what is forbidden */
  const body = (src, fn) => ((code(src).split('function ' + fn + '(')[1] || '').split(/\nfunction /)[0]);
  ok('shape', 'k: the drain persists _unitState, never a capture',
     /persistUnitState\(_unitState\)/.test(body(r40, 'drainPendingUnitState')) && !/captureUnitState\(/.test(body(r40, 'drainPendingUnitState')));
  ok('shape', 'k: markSent persists only once _resumeReady', /if \(!_resumeReady\) return;[\s\S]{0,40}persistUnitState\(captureUnitState\(\)\)/.test(body(r40, 'markSent')));
  const persist = body(r40, 'persistUnitState');
  ok('shape', 'k: persistUnitState refuses after a failed read, before any write',
     /if \(_resumeReadFailed\) \{[\s\S]{0,200}return false;/.test(persist) &&
     persist.indexOf('if (_resumeReadFailed)') < persist.indexOf('saveState720'));
  ok('shape', 'k: scheduleResumeSave / flushResumeSave bail after a failed read',
     /_resumeReadFailed\) return;/.test(body(r40, 'scheduleResumeSave')) && /_resumeReadFailed\) return;/.test(body(r40, 'flushResumeSave')));
  ok('shape', 'l: stage A keeps the cover on a failed read', /if \(!_payload && !_resumeReadFailed\) dropBootCover\(\);/.test(r50));
  ok('shape', 'l: stage B retries the read once', /if \(_resumeReadFailed\) \{\s*_saved = readUnitState\(\);/.test(r50));
  ok('shape', 'l: the stage-B catch keeps a failed session closed', /_resumeReady = !_resumeReadFailed;/.test(r50));
  ok('shape', 'l: a screen reached during the window is saved', /if \(!_resumed && currentScreen !== (?:0|_xapiLanding\(\)|PART_FIRST)\) \{ try \{ scheduleResumeSave\(\); \}/.test(r50));
  const letter = (r50.match(/RESUME_ENABLED \? 'xapi-720-([a-z])\.js'/) || [])[1];
  ok('shape', 's: the loader loads xapi-720-l.js and the regex lists l', letter === 'l' && /XAPI_USING_G = \/xapi-720-\[ghijkl\]\\\.js\//.test(r50), 'letter ' + letter);
  const leaving = body(r40, 'flushResumeSaveLeaving');
  ok('shape', 's: the leave flush has the write guards and typeof-guards saveState720OnLeave',
     /_resumeReadFailed\) return;/.test(leaving) && /typeof window\.saveState720OnLeave === 'function'/.test(leaving));
  ok('shape', 's: the leave handler goes through flushResumeSaveLeaving', /flushResumeSaveLeaving\(\);/.test(body(r40, 'flushResumeSaveOnLeave')));

  /* t: the leave save, behavioural, on the -l stub and on the -k stub */
  for (const lib of ['l', 'k']) {
    b = await bootStore('xapi-720-' + lib + '.js');
    b.seed(seed(b.slug));
    if (lib === 'l') { b.w.__leave = []; const real = b.w.saveState720OnLeave; b.w.saveState720OnLeave = function (id, doc) { b.w.__leave.push(screenOf(doc)); return b.w.saveState720(id, doc); }; void real; }
    b.exec('readUnitState(); _resumeReady = true; applyExecutionState(_unitState.payload); goTo(3); flushResumeSaveOnLeave();');
    ok('leave', 't -' + lib + ': the leave write carries the new screen', screenOf(b.stored()) === 3, JSON.stringify(b.stored() && b.stored().payload).slice(0, 120));
    if (lib === 'l') ok('leave', 't -l: it goes through saveState720OnLeave', b.w.__leave.length === 1 && b.w.__leave[0] === 3, JSON.stringify(b.w.__leave));
    else ok('leave', 't -k: the -k stub has no saveState720OnLeave (the unit falls back to saveState720)', b.val('typeof saveState720OnLeave') === 'undefined');
    ok('leave', 't -' + lib + ': no console.error', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
  }

  /* m-p: every part's markup */
  for (const c of H.PARTS) {
    const html = H.fs.readFileSync(H.path.join(H.BASE, H.PART_DIR(c), 'index.html'), 'utf8');
    const inl = (html.match(/<script>[\s\S]*?<\/script>/g) || []).filter(s => /boot-cover/.test(s));
    ok(c, 'm: exactly one inline script handles boot-cover', inl.length === 1, String(inl.length));
    const net = inl[0] || '';
    ok(c, 'm: the net raises __resumeInFlight itself on a registration', /if \(\/\[\?&\]registration=\/\.test\(location\.search\)\) window\.__resumeInFlight = true;/.test(net));
    ok(c, 'm: the net keeps 800 ms and the 11000 ceiling', /setTimeout\(tick, 800\)/.test(net) && /< 11000/.test(net));
    for (const q of ['?slxapi=1&registration=abc', '']) {
      const d = new JSDOM(html, { url: 'http://localhost:8777/' + H.PART_DIR(c) + '/index.html' + q, runScripts: 'dangerously' });
      const on = d.window.__resumeInFlight === true;
      ok(c, 'n: __resumeInFlight ' + (q ? 'raised with' : 'not raised without') + ' a registration', q ? on : !on);
      d.window.close();
    }
    const pre = [...html.matchAll(/<link rel="preload" as="script"[^>]*>/g)].map(m => m[0]);
    ok(c, 'o: two script preloads, the exact loader URLs, letter ' + letter + ', no crossorigin / ?',
       pre.length === 2 && pre[0].includes('href="' + CDN + 'xapiwrapper.min.js"') && pre[1].includes('href="' + CDN + 'xapi-720-' + letter + '.js"') &&
       !pre.some(p => /crossorigin|\.js\?/.test(p)), pre.join(' '));
    ok(c, 'o: preconnect to Kata', /<link rel="preconnect" href="https:\/\/kata\.cet\.ac\.il">/.test(html));
    const scr = H.path.join(H.BASE, H.PART_DIR(c), 'script.js');
    const st = H.fs.existsSync(scr) ? (H.fs.readFileSync(scr, 'utf8').match(/start:\s*(\d+)/) || [])[1] : null;
    let m0 = html.search(/<section class="screen active"/);
    if (m0 < 0 && st != null) m0 = html.search(new RegExp('<section class="screen[^"]*"[^>]*data-screen="' + st + '"'));
    const nxt = m0 < 0 ? -1 : html.slice(m0 + 10).search(/<section\b/);
    const end0 = m0 < 0 ? -1 : (nxt < 0 ? html.length : m0 + 10 + nxt);
    const bad = [];
    for (const m of html.matchAll(/<img\b[^>]*src="(?:assets\/|\.\.\/unit-assets\/)[^>]*>/g)) {
      const inLanding = m0 >= 0 && m.index >= m0 && m.index < end0;
      const svg = /src="[^"]*\.svg"/.test(m[0]);
      if (!svg && inLanding === /loading="lazy"/.test(m[0])) bad.push(m[0].slice(0, 80));   /* an SVG may be either: small icons stay eager, content figures may be lazy */
    }
    ok(c, 'p: every raster image off the landing screen is lazy, none on it', bad.length === 0, bad.slice(0, 2).join(' | '));
    const vids = [...html.matchAll(/<video\b[^>]*>/g)].filter(m => /\bautoplay\b/.test(m[0]) && /\ssrc="/.test(m[0]) && !(m0 >= 0 && m.index >= m0 && m.index < end0));
    ok(c, 'q: no hidden <video autoplay> with an inline src off the landing screen', vids.length === 0, vids.map(m => m[0].slice(0, 80)).join(' | '));
    if (/data-char-clip=/.test(html)) {
      const b = await H.boot(c, { lib: true });
      b.finishBoot();
      const live = JSON.parse(b.val('JSON.stringify([].slice.call(document.querySelectorAll("video[data-char-clip]")).filter(function(v){ return v.getAttribute("src") && !v.closest(".screen.active"); }).map(function(v){ return v.dataset.charClip; }))'));
      ok(c, 'q: after boot no character clip off the landing screen has a src', live.length === 0, live.join(','));
      const n = JSON.parse(b.val('JSON.stringify([].map.call(document.querySelectorAll("video[data-char-clip]"), function(v){ return +v.closest(".screen").dataset.screen; }))'));
      if (n.length) {
        b.exec('goTo(' + n[0] + ')');
        ok(c, 'q: entering s' + n[0] + ' sets its clip src', !!b.val('document.querySelector(".screen.active video[data-char-clip]").getAttribute("src")'));
      }
    }
  }
  R.done();
  process.exit(process.exitCode || 0);   /* jsdom timers would keep Node alive */
})().catch(e => { console.error(e); process.exitCode = 2; });
