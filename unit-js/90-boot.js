'use strict';
/* ═══════════════════ BOOT ═══════════════════
   The ONLY file in unit-js/ with top-level side effects, and the LAST script tag on every page —
   after main.js, so every seam it calls already exists.

   ⚠️ This must stay a SEPARATE script tag. Appended to main.js it would be skipped in silence if
   anything earlier in that file threw at load: a top-level throw kills the rest of the file with
   no console error. That has happened in this family (a `video.play().catch()` where play()
   returned undefined), and it left the report modal uninitialised with nothing to show why.

   The order below is load-bearing:

     1. initResumeResetHatch() FIRST — it strips ?resetState from the URL and raises the reset
        flag, so it must run before anything reads location.search or touches the state document.
        Every cross-part navigation copies location.search verbatim, so a ?resetState left in
        place would re-fire on every hop and resume would never work at all.
     2. scaleApp() before anything measures #app. main.js used to call this at load; it moved here
        so it cannot run before the hatch has rewritten the URL.
     3. The character seed before partBoot() — the first screen has to paint in the right colour.
     4. partBoot() before bootXAPI() — this component's own wiring must be in place before a
        resume can replay onto it.
     5. bootXAPI() LAST. It may window.location.replace() to another component, and nothing after
        it would run. It also has to reach window.__resumeInFlight inside the markup failsafe's
        800ms window, so nothing slow may sit in front of it.

   No DOMContentLoaded wrapper is needed: this file sits immediately before </body>.

   Not used here, unlike the ratio-01 reference: initA11yWiring, initFeedbackDrag, initDevBridge
   and initImgZoomEscape. main.js carries this unit's own equivalents (popup drag, the
   [data-zoom-src] modal, the DEV_GOTO bridge), so those files were not vendored. See
   unit-js/README.md §"Not vendored". */
(function boot () {

  try { initResumeResetHatch(); } catch (e) { console.error('[boot] initResumeResetHatch', e); }

  window.addEventListener('resize', scaleApp);
  scaleApp();

  /* ⚠️ Fixes a live bug. main.js writes CHARACTER_STORAGE_KEY on selection but never read it
     back — `getItem` appeared nowhere in the file — so window.lomdaState.selectedCharacter reset
     to null on every page load and characterAsset() fell through to its 'character-1' default. A
     learner who picked character-2 saw character-1 in parts 02-05 and in part 05's finale video.
     getUnitCharacter() reads the state document when there is one and that same localStorage key
     when there is not, so this works off-platform too. */
  try {
    var _c = getUnitCharacter();
    if (_c && window.lomdaState) window.lomdaState.selectedCharacter = _c;
  } catch (e) { console.error('[boot] character seed', e); }

  try { initReportModal(); } catch (e) { console.error('[boot] initReportModal', e); }

  /* Guarded, unlike the reference: it is the last thing between here and partBoot()/bootXAPI(),
     and a throw would leave the learner under a boot cover that only the markup failsafe lifts. */
  try { initResumeLeaveHandlers(); } catch (e) { console.error('[boot] initResumeLeaveHandlers', e); }

  /* Optional per-part hook — puts a first-time learner on this component's own first screen.
     Typeof-guarded so the layer boots before the hook exists. */
  if (typeof partBoot === 'function') {
    try { partBoot(); } catch (e) { console.error('[boot] partBoot', e); }
  }

  bootXAPI();
})();
