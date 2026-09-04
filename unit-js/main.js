/* methodica-math-ratio-02 — engine vendored from ratio-01-01
   (percent-02 lineage, approved behaviors). Built maven-first. */

window.lomdaState = { selectedCharacter: null };
const CHARACTER_STORAGE_KEY = 'methodica_math_ratio_02_selectedCharacter';
const TOTAL_SCREENS = 52; // slides 2-63: learning, guided, practice A/B/C, advanced, peak question, finale
let currentScreen = window.PART_CONFIG ? window.PART_CONFIG.start : 0;   /* a component opens on ITS first screen; the markup marks that one active */

function setNavLabel(btn, label) {
  btn.innerHTML = '';
  const wrap = document.createElement('span');
  wrap.className = 'nav-label';
  wrap.dataset.label = label;
  const inner = document.createElement('span');
  inner.textContent = label;
  wrap.appendChild(inner);
  btn.appendChild(wrap);
}

/* Videos play once (no loop). Freeze on the clean opening frame instead
   of dropping into the player's black "ended" state. */

/* new pair for this unit: character-1 = green, character-2 = orange.
   headphones pose: both supplied 14.08. */
const CHARACTER_ASSETS = {
  'character-1': {
    selection: 'assets/img/character-1-selection.png',
    headphones: 'assets/img/character-1-headphones.png',
    baker: 'assets/img/character-1-baker.png',
    peak: 'assets/img/character-1-peak.png',
  },
  'character-2': {
    selection: 'assets/img/character-2-selection.png',
    headphones: 'assets/img/character-2-headphones.png',
    baker: 'assets/img/character-2-baker.png',
    peak: 'assets/img/character-2-peak.png',
  },
};
function characterAsset(pose) {
  const id = CHARACTER_ASSETS[window.lomdaState.selectedCharacter]
    ? window.lomdaState.selectedCharacter
    : 'character-1';
  return CHARACTER_ASSETS[id][pose] || CHARACTER_ASSETS[id].selection;
}

function scaleApp() {
  const app = document.getElementById('app');
  const scale   = Math.min(window.innerWidth / 1280, window.innerHeight / 710);
  const canvasW = window.innerWidth  / scale;
  const canvasH = window.innerHeight / scale;
  app.style.width     = canvasW + 'px';
  app.style.height    = canvasH + 'px';
  app.style.transform = `scale(${scale})`;
  app.style.left      = '0px';
  app.style.top       = '0px';
}
/* The resize listener and the first scaleApp() call moved to ../unit-js/90-boot.js. This file must
   stay free of top-level side effects that the boot order depends on: scaleApp() has to run after
   initResumeResetHatch() (which rewrites the URL) and before anything measures #app. */

/* Screen-reader announcement. #a11y-announcer is an aria-live region in every index.html. */
function announce(msg) {
  var el = document.getElementById('a11y-announcer');
  if (!el) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 30);
}


/* ─── Navigation ────────────────────────────────────────── */
function goTo(n) {
  /* Component mode: screens keep the unit's global numbering (0-51) across the
     five components, and this part's range is what bounds navigation. Walking
     past either edge hands over to the neighbouring app.

     Both edges are derived from PART_CONFIG, so no screen number is written here:
     forward seeds the destination with end + 1 (its own first screen, because the
     numbering is unit-wide and contiguous), and back returns to start - 1 (the
     screen the learner left in the previous component). */
  if (window.PART_CONFIG) {
    if (n > window.PART_CONFIG.end) {
      if (window.PART_CONFIG.next) leaveToPart(window.PART_CONFIG.next, window.PART_CONFIG.end + 1);
      else finishUnit();
      return;
    }
    if (n < window.PART_CONFIG.start) {
      /* Every screen but the unit's first carries a "חזרה" wired to goBack(), i.e.
         goTo(currentScreen - 1). On a component's first screen that used to fall into
         this guard and do nothing at all — the button looked live and was dead.
         goBackToPreviousPart points the state document at the destination BEFORE
         navigating, and stays put if that write fails. */
      if (window.PART_CONFIG.prev) {
        try { goBackToPreviousPart(window.PART_CONFIG.prev, '#screen=' + (window.PART_CONFIG.start - 1)); }
        catch (e) { console.error('[nav] back to previous part', e); }
      }
      return;
    }
  }
  if (n < 0 || n >= TOTAL_SCREENS) return;

  /* Resolve the target BEFORE mutating anything. This used to clear .active and assign
     currentScreen first, so a screen the markup does not have left NO screen active and
     currentScreen desynced. PART_CONFIG bounds n to screens that all exist, so it could not
     fire — until resume, whose payload can name a screen from another part. */
  const next = document.getElementById('s' + n);
  if (!next) return;

  document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
    .forEach(el => el.classList.add('hidden'));
  const prev = document.querySelector('.screen.active');
  if (prev) prev.classList.remove('active');
  currentScreen = n;
  next.classList.add('active');

  /* xAPI item scope: after the screen is active and currentScreen is set, and before
     anything can navigate away. Swallowed on purpose — reporting must never stop a learner. */
  try { xapiOnScreen(n); } catch (e) {}

  /* resetScreenState is NOT a pure initialiser in this unit: resetQuestionOnEntry() early-returns
     on a finished question and restoreFeedback() re-opens its popup, so an answered screen keeps
     its answered look across in-part navigation on its own. That is why goTo needs no
     capture/re-apply/repaint sandwich — the painters are needed only after a page load, where the
     DOM is pristine markup, and applyExecutionState() drives them there. */
  resetScreenState(n);

  const heading = next.querySelector('h1, h2');
  if (heading) announce(heading.textContent.trim());

  if (window.parent !== window) {
    window.parent.postMessage({ type: 'DEV_SCREEN', screen: n }, '*');
  }

  /* Resume: the screen change is the choke point that bounds how much a learner can lose.
     Debounced, and self-suppressing while restoring or before the document has been read. */
  try { scheduleResumeSave(); } catch (e) {}
}

function resetScreenState(n) {
  if (n === 0) {
    const saved = window.lomdaState.selectedCharacter;
    document.querySelectorAll('#s0 .option-card').forEach(card => {
      const isSelected = !!saved && card.dataset.value === saved;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
    const continueBtn = document.getElementById('s0-continue');
    if (continueBtn) continueBtn.disabled = !saved;
  }
  if (n === 2) s2Enter();
  if (n === 3) s3Enter();
  const CHAR_SCREENS = { 5: 's5-char', 14: 's14-char', 21: 's21-char', 25: 's25-char',
                         30: 's30-char', 38: 's38-char' };
  if (CHAR_SCREENS[n]) {
    const img = document.getElementById(CHAR_SCREENS[n]);
    const POSE = { 5: 'baker', 38: 'peak' };
    if (img) img.src = characterAsset(POSE[n] || 'selection');
  }
  if (n === 51) {
    /* ── No video reporting in this unit, deliberately ──
       ../unit-js/50-loader.js calls xapiWireVideos(), which wires any video[data-xapi-report].
       None of this unit's three <video> elements carries that attribute, so it is a no-op:
       screen 0's two clips are looping decoration inside the character-choice cards (the learner
       never plays or pauses them), and this one is a confetti reward. xapiWireVideos reports
       'paused'/'played' against a QUESTION object via xapiQ(item, qKey), so wiring these would
       attribute interaction to a question the learner is not answering — item 001/q1 in part 01,
       and in part 05 an arbitrary one of the peak question's eight. Left unreported pending the
       content owner; add the attributes if 720 asks for video events on decorative clips. */
    // finale: the companion's confetti clip, one per character
    const v = document.getElementById('s51-video');
    if (v) {
      const id = CHARACTER_ASSETS[window.lomdaState.selectedCharacter]
        ? window.lomdaState.selectedCharacter : 'character-1';
      const src = 'assets/video/' + id + '-finale.mp4';
      if (!v.src.endsWith(src)) v.src = src;
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }
  const HINT_DONE = { s15: () => s15Done, s16: () => SCQ.s16.done, s17: () => SCQ.s17.done,
                      s18: () => MCQ.s18.done, s19: () => s19Done, s20: () => s20Done,
                      s22: () => MCQ.s22.done, s23: () => MCQ.s23.done, s24: () => s24Done };
  if (HINT_DONE['s' + n]) {
    const hb = document.getElementById('s' + n + '-hint');
    if (hb) hb.style.visibility = HINT_DONE['s' + n]() ? 'hidden' : 'visible';
  }
  if (QPROG['s' + n]) renderQprog('s' + n);
  const qq = Q['s' + n];
  if (qq) {
    document.getElementById('s' + n + '-popup')?.classList.add('hidden');
    document.getElementById('s' + n + '-hint-overlay')?.classList.add('hidden');
    const hb = document.getElementById('s' + n + '-hint');
    if (hb) hb.style.visibility = qq.done ? 'hidden' : 'visible';
  }
  resetQuestionOnEntry('s' + n);
  /* LAST: the entry reset above closes every popup to clear stale state, so an
     answered screen gets its own feedback re-opened after it (producer 03.09) */
  restoreFeedback('s' + n);
}

/* Re-entering a question screen must never show stale marks: unfinished
   questions reset completely. A FINISHED one keeps its resolved state and its
   feedback — restoreFeedback() re-opens the popup right after this runs
   (producer 03.09: "when a user goes back the feedback persists"). */
function resetQuestionOnEntry(sid) {
  document.getElementById(sid + '-popup')?.classList.add('hidden');
  document.getElementById(sid + '-hint-overlay')?.classList.add('hidden');
  const finished = { s15: () => s15Done, s16: () => SCQ.s16 && SCQ.s16.done,
                     s17: () => SCQ.s17 && SCQ.s17.done, s18: () => MCQ.s18 && MCQ.s18.done,
                     s19: () => s19Done, s20: () => s20Done,
                     s22: () => MCQ.s22 && MCQ.s22.done, s23: () => MCQ.s23 && MCQ.s23.done,
                     s24: () => s24Done }[sid];
  if (!finished || finished()) return;
  const scr = document.getElementById(sid);
  if (!scr) return;
  scr.querySelectorAll('.scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  scr.querySelectorAll('.saq-row').forEach(r => r.classList.remove('row-correct', 'row-wrong', 'row-revealed'));
  scr.querySelectorAll('.saq-pill').forEach(pp => {
    pp.classList.remove('selected'); pp.disabled = false;
    pp.setAttribute('aria-checked', 'false');
  });
  scr.querySelectorAll('.viq-input-box').forEach(el => {
    el.classList.remove('error', 'correct'); el.disabled = false;
  });
  if (MCQ[sid]) { MCQ[sid].selected = new Set(); MCQ[sid].attempts = 0; MCQ[sid].lastWrong = null; }
  if (SCQ[sid]) { SCQ[sid].selected = null; SCQ[sid].attempts = 0; SCQ[sid].lastWrong = null; }
  if (sid === 's15') { s15Picks = {}; s15Attempts = 0; s15LastWrong = null; }
  const chk = document.getElementById(sid + '-check');
  if (chk) { setNavLabel(chk, 'צדקתי?'); chk.disabled = true; }
}

function advanceScreen() {
  if (currentScreen === 0 && !window.lomdaState.selectedCharacter) return;
  if (currentScreen === 1 && !s1Done) return;
  if (currentScreen === 2 && document.getElementById('s2-continue')?.disabled) return;
  if (currentScreen === 3 && document.getElementById('s3-continue')?.disabled) return;
  if ([6, 8, 9, 11, 12].includes(currentScreen) && !GSTEPS['s' + currentScreen].answered) return;
  if (currentScreen === 15 && !s15Done) return;
  if (currentScreen === 16 && !SCQ.s16.done) return;
  if (currentScreen === 17 && !SCQ.s17.done) return;
  if (currentScreen === 18 && !MCQ.s18.done) return;
  if (currentScreen === 19 && !s19Done) return;
  if (currentScreen === 20 && !s20Done) return;
  if (currentScreen === 22 && !MCQ.s22.done) return;
  if (currentScreen === 23 && !MCQ.s23.done) return;
  if (currentScreen === 24 && !s24Done) return;
  const gated = { 26:'s26',27:'s27',28:'s28',29:'s29',31:'s31',32:'s32',33:'s33',34:'s34',
                  35:'s35',36:'s36',37:'s37',41:'s41',42:'s42',43:'s43',44:'s44',45:'s45',
                  46:'s46',48:'s48',49:'s49' }[currentScreen];
  if (gated && !(Q[gated] && Q[gated].done)) return;
  goTo(currentScreen + 1);
}
function goBack() { goTo(currentScreen - 1); }

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (document.getElementById('report-modal')?.hasAttribute('hidden') === false ||
      document.getElementById('report-confirm-modal')?.hasAttribute('hidden') === false) return;
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
});

/* ─── S0 — TwoOptionSelection ───────────────────────────── */
function selectOption(cardEl) {
  document.querySelectorAll('#s0 .option-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  cardEl.classList.add('selected');
  cardEl.setAttribute('aria-checked', 'true');
  window.lomdaState.selectedCharacter = cardEl.dataset.value;
  try { localStorage.setItem(CHARACTER_STORAGE_KEY, cardEl.dataset.value); } catch (e) {}
  const continueBtn = document.getElementById('s0-continue');
  if (continueBtn) continueBtn.disabled = false;
}

const CANVAS_W = 1280, CANVAS_H = 710, BOTTOM_BAR_H = 74;

function getAppScale() {
  const app = document.getElementById('app');
  const m = app.style.transform.match(/scale\(([^)]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}
function clampPopupPosition(x, y, popupEl) {
  const w = popupEl.offsetWidth, h = popupEl.offsetHeight;
  return {
    x: Math.min(Math.max(x, 0), CANVAS_W - w),
    y: Math.min(Math.max(y, 0), (CANVAS_H - BOTTOM_BAR_H) - h),
  };
}
function resetPopupPosition(popup) {
  // floats above the bottom-bar buttons, beside the answers (producer 12.08)
  popup.style.left   = '24px';
  popup.style.top    = 'auto';
  popup.style.bottom = '130px';
}
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/* shared popup drag (one pointermove/up pair for all draggable popups) */
let mcqDragPopup = null, mcqDragOffX = 0, mcqDragOffY = 0;
function mcqPopupPointerDown(e, popupId) {
  const popup = document.getElementById(popupId);
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  mcqDragPopup = popup;
  const scale = getAppScale();
  const canvasX = (e.clientX - (parseFloat(app.style.left) || 0)) / scale;
  const canvasY = (e.clientY - (parseFloat(app.style.top)  || 0)) / scale;
  const topPx = parseFloat(popup.style.top);
  const popupTop = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top    = popupTop + 'px';
  popup.style.bottom = 'auto';
  mcqDragOffX = canvasX - (parseFloat(popup.style.left) || 2);
  mcqDragOffY = canvasY - popupTop;
  e.preventDefault();
}
window.addEventListener('pointermove', e => {
  if (!mcqDragPopup) return;
  const app = document.getElementById('app');
  if (!app) return;
  const scale = getAppScale();
  const rawX = (e.clientX - (parseFloat(app.style.left) || 0)) / scale - mcqDragOffX;
  const rawY = (e.clientY - (parseFloat(app.style.top)  || 0)) / scale - mcqDragOffY;
  const c = clampPopupPosition(rawX, rawY, mcqDragPopup);
  mcqDragPopup.style.left = c.x + 'px';
  mcqDragPopup.style.top  = c.y + 'px';
});
window.addEventListener('pointerup',     () => { mcqDragPopup = null; });
window.addEventListener('pointercancel', () => { mcqDragPopup = null; });


function openHint(sid) {
  /* ⚠️ Only here, in the branch that actually OPENS the overlay. The hint is a `hidden` toggle,
     and reporting from a toggle would send a second 'requested.1' on every close. The dedupe in
     xapiRequestedHint covers the three ways an overlay can be closed and reopened. */
  xapiHint(sid);
  document.getElementById(sid + '-hint-overlay')?.classList.remove('hidden');
}
function closeHint(sid) {
  document.getElementById(sid + '-hint-overlay')?.classList.add('hidden');
}
function closeHintOnBackdrop(e, sid) {
  if (e.target && e.target.id === sid + '-hint-overlay') closeHint(sid);
}
function hideHintButton(sid) {
  const hb = document.getElementById(sid + '-hint');
  if (hb) hb.style.visibility = 'hidden';
}


/* ─── S1 — battery-chat SCQ (slide 3). SINGLE attempt per the
   production note; correct: הגרלה. ─── */
const S1_BODY = ['אין להם ברירה, הם צריכים לעשות הגרלה...'];
let s1Selected = null, s1Done = false;

function s1Select(id) {
  if (s1Done) return;
  s1Selected = id;
  document.querySelectorAll('#s1 .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const chk = document.getElementById('s1-check');
  if (chk) chk.disabled = false;
}
function s1Check() {
  if (s1Done) { advanceScreen(); return; }
  if (!s1Selected) return;
  const ok = s1Selected === 'd';
  xapiReport('s1', ok, s1Selected);
  document.querySelectorAll('#s1 .scq-opt').forEach(o => {
    o.disabled = true;
    o.classList.remove('selected');
    if (o.dataset.id === 'd') o.classList.add('correct');
    else if (o.dataset.id === s1Selected) o.classList.add('wrong');
  });
  const popup = document.getElementById('s1-popup');
  if (popup) {
    popup.style.background = ok ? '#edf8ed' : '#ffdbdc';
    resetPopupPosition(popup);
    document.getElementById('s1-popup-title').innerHTML = ok ? 'כל הכבוד!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:';
    document.getElementById('s1-popup-body').innerHTML = S1_BODY.map(x => '<p>' + x + '</p>').join('');
    popup.classList.remove('hidden');
  }
  s1Done = true;
  const chk = document.getElementById('s1-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
  try { flushResumeSave(); } catch (e) {}   /* answer committed — see the flush contract in qFinish */
}

/* ─── S2 — staged reveal (slide 4): text → character+bubble → continue ─── */
let s2Revealed = false;
function s2Enter() {
  const img = document.getElementById('s2-char');
  if (img) img.src = characterAsset('selection');
  if (s2Revealed) return;
  s2Revealed = true;
  const text = document.getElementById('s2-text');
  const grp  = document.getElementById('s2-char-group');
  setTimeout(() => text?.classList.add('is-shown'), 150);
  setTimeout(() => grp?.classList.add('is-shown'), 1300);
  setTimeout(() => {
    const cont = document.getElementById('s2-continue');
    if (cont) cont.disabled = false;
  }, 2100);
}

/* ─── S3 — scroll acquisition (slides 5-15) ─── */
const s3State = {
  scrolledEnd: false,
  q1: false, q2: false, q3: false, q4: false, q5: false,
  flipped: [false, false, false, false],
};
/* "scrolled to the end" is measured LIVE, never latched. Latching had a hole:
   scroll to the bottom first, then answer from the top — every answer opens a
   feedback block and pushes the real bottom further down, so the learner could
   continue with content still below the fold (producer 03.09). */
function s3AtEnd() {
  const el = document.getElementById('s3-scroll');
  if (!el) return false;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
}
function s3UpdateGate() {
  const btn = document.getElementById('s3-continue');
  if (!btn) return;
  if (s3AtEnd()) s3State.scrolledEnd = true;
  else if (s3State.scrolledEnd && !s3AtEnd()) s3State.scrolledEnd = false;
  btn.disabled = !(s3State.scrolledEnd && s3State.q1 && s3State.q2 &&
                   s3State.q3 && s3State.q4 && s3State.q5 &&
                   s3State.flipped.every(Boolean));
}
document.getElementById('s3-scroll')?.addEventListener('scroll', s3UpdateGate);
function s3Feedback(id, ok, html) {
  const fb = document.getElementById(id);
  if (!fb) return;
  fb.innerHTML = html;
  fb.classList.remove('is-correct', 'is-wrong');
  fb.classList.add(ok ? 'is-correct' : 'is-wrong');
}

/* §2 (slide 6) — embedded MCQ, ALL FOUR correct, 2 attempts */
const S3Q1_CORRECT = new Set(['a', 'b', 'c', 'd']);
const S3Q1_EXPLAIN = 'כל התשובות מתארות נכון את הנתון, בצורות ביטוי שונות של יחס.';
let s3q1Selected = new Set(), s3q1Attempts = 0, s3q1LastWrong = null;

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
function s3q1Toggle(id) {
  if (s3State.q1) return;
  if (s3q1Selected.has(id)) s3q1Selected.delete(id); else s3q1Selected.add(id);
  if (s3q1Attempts > 0) {
    document.querySelectorAll('#s3q1-block .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
    const fb = document.getElementById('s3q1-feedback');
    if (fb) { fb.innerHTML = ''; fb.classList.remove('is-correct', 'is-wrong'); }
  }
  document.querySelectorAll('#s3q1-block .scq-opt').forEach(o => {
    const on = s3q1Selected.has(o.dataset.id);
    o.classList.toggle('selected', on);
    o.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const chk = document.getElementById('s3q1-check');
  if (chk) chk.disabled = s3q1Selected.size < 1 || JSON.stringify([...s3q1Selected].sort()) === s3q1LastWrong;
}
function s3q1Check() {
  if (s3State.q1 || s3q1Selected.size < 1) return;
  s3q1Attempts++;
  const opts = document.querySelectorAll('#s3q1-block .scq-opt');
  const isCorrect = setsEqual(s3q1Selected, S3Q1_CORRECT);
  const finish = (wasOk) => {
    xapiReport('s3q1', wasOk, [...s3q1Selected].sort().join(','));
    s3State.q1 = true;
    opts.forEach(o => { o.disabled = true; });
    document.getElementById('s3q1-check').disabled = true;
    s3UpdateGate();
    try { flushResumeSave(); } catch (e) {}
  };
  if (isCorrect) {
    opts.forEach(o => { if (S3Q1_CORRECT.has(o.dataset.id)) { o.classList.remove('selected'); o.classList.add('correct'); } });
    s3Feedback('s3q1-feedback', true, '<strong>כל הכבוד!</strong><br>' + S3Q1_EXPLAIN);
    finish(true);
  } else if (s3q1Attempts >= 2) {
    opts.forEach(o => {
      o.classList.remove('selected');
      if (S3Q1_CORRECT.has(o.dataset.id)) o.classList.add('correct');
      else if (s3q1Selected.has(o.dataset.id)) o.classList.add('wrong');
    });
    s3Feedback('s3q1-feedback', false, '<strong>זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:</strong><br>' + S3Q1_EXPLAIN);
    finish(false);
  } else {
    s3q1Selected.forEach(id => {
      if (!S3Q1_CORRECT.has(id)) {
        const o = document.querySelector('#s3q1-block .scq-opt[data-id="' + id + '"]');
        if (o) { o.classList.remove('selected'); o.classList.add('wrong'); }
      }
    });
    s3q1LastWrong = JSON.stringify([...s3q1Selected].sort());
    s3Feedback('s3q1-feedback', false, 'זה לא מדוייק. שננסה שוב?');
    document.getElementById('s3q1-check').disabled = true;
  }
}

/* §5 (slide 9) — ratio input, SINGLE attempt. Pop songs first → left:
   9 : 36 reduced = 1 : 4. */
const S3Q2_EXPLAIN = 'בפלייליסט כולו יש 36 שירים, 9 מהם הם שירי פופ.<br>' +
  'לכן, היחס בין מספר שירי הפופ למספר השירים בפלייליסט המלא הוא <span dir="ltr">9 : 36</span> ולאחר צמצום <span dir="ltr">1 : 4</span>.';
function s3q2OnInput() {
  if (s3State.q2) return;
  const l = document.getElementById('s3q2-left').value.trim();
  const r = document.getElementById('s3q2-right').value.trim();
  const chk = document.getElementById('s3q2-check');
  if (chk) chk.disabled = !(l !== '' && r !== '');
}
function s3q2Check() {
  if (s3State.q2) return;
  const left  = document.getElementById('s3q2-left');
  const right = document.getElementById('s3q2-right');
  if (left.value.trim() === '' || right.value.trim() === '') return;
  const ok = Number(left.value) === 1 && Number(right.value) === 4;
  xapiReport('s3q2', ok, left.value.trim() + ':' + right.value.trim());
  s3State.q2 = true;
  left.disabled = true; right.disabled = true;
  left.classList.add(ok ? 'correct' : 'error');
  right.classList.add(ok ? 'correct' : 'error');
  if (!ok) { left.value = 1; right.value = 4; left.classList.add('correct'); right.classList.add('correct'); }
  s3Feedback('s3q2-feedback', ok,
    '<strong>' + (ok ? 'כל הכבוד!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:') + '</strong><br>' + S3Q2_EXPLAIN +
    (ok ? '' : '<br>התשובה הנכונה היא <span dir="ltr"><strong>1 : 4</strong></span>'));
  document.getElementById('s3q2-check').disabled = true;
  s3UpdateGate();
  try { flushResumeSave(); } catch (e) {}
}

/* §7/§8/§10 — single-attempt yes/no checks (slides 11, 12, 15) */
const S3_YESNO = {
  s3q3: { correct: 'b', flag: 'q3',
          ok: 'כל הכבוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
          body: 'היחס של הגביע האמיתי לא נשמר, תיכף נבין למה.' },
  s3q4: { correct: 'a', flag: 'q4',
          ok: 'כל הכבוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
          body: 'היחס של הגביע האמיתי נשמר, תיכף נבין למה.' },
  s3q5: { correct: 'b', flag: 'q5',
          ok: 'נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
          body: 'כדי לבדוק מה יהיה היחס בעוד 5 שנים, נוסיף 5 שנים לכל אחד מהגילים ונקבל את היחס <span dir="ltr">10 : 15</span>.<br>' +
                'לאחר צמצום נקבל את היחס <span dir="ltr">2 : 3</span>, שאינו שקול ליחס הגילים הנוכחי.<br>' +
                '<strong>מסקנה:</strong> הוספת מספר זהה לשני גורמי היחס אינה שומרת על היחס.<br>' +
                '<strong>זכרו:</strong> רק פעולות כפל או חילוק ישמרו על היחס.' },
};
const s3ynSelected = {};
function s3ynSelect(qid, id) {
  const cfg = S3_YESNO[qid];
  if (!cfg || s3State[cfg.flag]) return;
  s3ynSelected[qid] = id;
  document.querySelectorAll('#' + qid + '-check')
    .forEach(chk => { chk.disabled = false; });
  document.querySelectorAll('[id="' + qid + '-check"]').forEach(c => c.disabled = false);
  const block = document.getElementById(qid + '-check').closest('.rs-block');
  block.querySelectorAll('.scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
}
function s3ynCheck(qid) {
  const cfg = S3_YESNO[qid];
  if (!cfg || s3State[cfg.flag]) return;
  const sel = s3ynSelected[qid];
  if (!sel) return;
  const block = document.getElementById(qid + '-check').closest('.rs-block');
  const ok = sel === cfg.correct;
  xapiReport(qid, ok, sel);
  block.querySelectorAll('.scq-opt').forEach(o => {
    o.disabled = true;
    o.classList.remove('selected');
    if (o.dataset.id === cfg.correct) o.classList.add('correct');
    else if (o.dataset.id === sel) o.classList.add('wrong');
  });
  s3Feedback(qid + '-feedback', ok,
    '<strong>' + (ok ? cfg.ok : cfg.bad) + '</strong><br>' + cfg.body);
  s3State[cfg.flag] = true;
  document.getElementById(qid + '-check').disabled = true;
  s3UpdateGate();
  try { flushResumeSave(); } catch (e) {}
}
function s3q3Select(id) { s3ynSelect('s3q3', id); }
function s3q3Check()    { s3ynCheck('s3q3'); }
function s3q4Select(id) { s3ynSelect('s3q4', id); }
function s3q4Check()    { s3ynCheck('s3q4'); }
function s3q5Select(id) { s3ynSelect('s3q5', id); }
function s3q5Check()    { s3ynCheck('s3q5'); }

/* §9 — flip cards (one-way reveal, engine behavior) */
function s3Flip(cardEl) {
  const i = Number(cardEl.dataset.index);
  if (!cardEl.classList.contains('is-flipped')) {
    cardEl.classList.add('is-flipped');
    cardEl.setAttribute('aria-expanded', 'true');
    const front = cardEl.querySelector('.frc-card-front');
    const back  = cardEl.querySelector('.frc-card-back');
    if (front) front.setAttribute('aria-hidden', 'true');
    if (back)  back.removeAttribute('aria-hidden');
  }
  if (!s3State.flipped[i]) {
    s3State.flipped[i] = true;
    s3UpdateGate();
  }
}

function s3Enter() {
  const c1 = document.getElementById('s3-char-1');
  if (c1) c1.src = characterAsset('headphones');
  const c2 = document.getElementById('s3-char-2');
  if (c2) c2.src = characterAsset('selection');
  if (window.s3PlaceCardsHint) window.s3PlaceCardsHint();
  s3UpdateGate();
}

const SPARK_DIRS = [
  [0, -80], [56.57, -56.57], [80, 0], [56.57, 56.57],
  [0, 80], [-56.57, 56.57], [-80, 0], [-56.57, -56.57],
];
function makeClickHint(id) {
  const el = document.createElement('div');
  el.className = 'click-hint';
  el.id = id;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="click-hint__ripple1"><img src="assets/img/hint/ripple-ring-1.svg" alt=""></div>' +
    '<div class="click-hint__ripple2"><img src="assets/img/hint/ripple-ring-2.svg" alt=""></div>' +
    SPARK_DIRS.map(([dx, dy], i) =>
      `<div class="click-hint__spark" style="--dx:${dx}px; --dy:${dy}px; --d:${i * 3}ms"><img src="assets/img/hint/spark.svg" alt=""></div>`
    ).join('') +
    '<div class="click-hint__cursor"><img src="assets/img/hint/cursor.svg" alt=""></div>';
  return el;
}


(function s3WireHints() {
  const screen = document.getElementById('s3');
  if (!screen) return;
  const cards = screen.querySelector('.rs-cards');
  const firstCard = screen.querySelector('.frc-card[data-index="0"]');
  if (cards && firstCard) {
    cards.style.position = 'relative';
    const hint = makeClickHint('s3-hint-cards');
    cards.appendChild(hint);
    const place = () => {
      if (!firstCard.offsetWidth) return;
      // anchored to the card's lower third so the ripple/cursor never
      // cover the operation label (producer 13.08)
      hint.style.left = (firstCard.offsetLeft + firstCard.offsetWidth / 2 - 150) + 'px';
      hint.style.top  = (firstCard.offsetTop  + firstCard.offsetHeight * 0.78 - 150) + 'px';
    };
    place();
    window.addEventListener('resize', place);
    window.s3PlaceCardsHint = place;
    cards.addEventListener('click', () => hint.classList.add('hidden'), { once: true });
  }
  const scroller = document.getElementById('s3-scroll');
  if (scroller) {
    const hint = makeClickHint('s3-hint-scroll');
    screen.appendChild(hint);
    scroller.addEventListener('scroll', () => hint.classList.add('hidden'), { once: true });
  }
})();


/* ═══════════════════════════════════════════════════════════
   S5-S13 — Guided Instruction steps (slides 17-25). One-tap reveal:
   correct turns green, a wrong pick turns red, continue unlocks.
   Keys per the script's V badges.
   ═══════════════════════════════════════════════════════════ */
const GSTEPS = {
  // the V badge sits at the RIGHT EDGE of the pill it marks (calibrated
  // against slides 21/23/24); it marks the pill reading 25 : 200 — which
  // is also the lesson's rule: the first-mentioned quantity goes left.
  s6:  { correctId: 'b', answered: false },   // 25 : 200
  s8:  { correctId: 'b', answered: false },   // part-to-whole
  s9:  { correctId: 'b', answered: false },   // 225 grams
  s11: { correctId: 'a', answered: false },   // חיבור (4 operations shown)
  s12: { correctId: 'b', answered: false },   // no, addition doesn't keep it
};
function gstepSelect(sid, id) {
  const st = GSTEPS[sid];
  if (!st || st.answered) return;
  document.querySelectorAll('#' + sid + ' .s19-opt').forEach(o => {
    if (o.dataset.id === st.correctId) o.classList.add('correct');
    else if (o.dataset.id === id) o.classList.add('incorrect');
    o.setAttribute('aria-checked', o.dataset.id === id ? 'true' : 'false');
    o.disabled = true;
  });
  st.answered = true;
  const cont = document.getElementById(sid + '-continue');
  if (cont) cont.disabled = false;
}

/* ═══════════════════════════════════════════════════════════
   Practice progress strips: set A (slides 27-32 → 4 questions, Q1 and
   Q4 each span two screens) and set B (slides 34-36 → 3 questions).
   ═══════════════════════════════════════════════════════════ */
const QPROG = {
  s15: { set: 'A', idx: 0 }, s16: { set: 'A', idx: 0 },
  s17: { set: 'A', idx: 1 }, s18: { set: 'A', idx: 2 },
  s19: { set: 'A', idx: 3 }, s20: { set: 'A', idx: 3 },
  s22: { set: 'B', idx: 0 }, s23: { set: 'B', idx: 1 }, s24: { set: 'B', idx: 2 },
};
QPROG.s26 = { set: 'C', idx: 0 }; QPROG.s27 = { set: 'C', idx: 0 };
QPROG.s28 = { set: 'C', idx: 1 }; QPROG.s29 = { set: 'C', idx: 1 };
QPROG.s31 = { set: 'D', idx: 0 }; QPROG.s32 = { set: 'D', idx: 0 };
QPROG.s33 = { set: 'D', idx: 1 }; QPROG.s34 = { set: 'D', idx: 1 }; QPROG.s35 = { set: 'D', idx: 1 };
QPROG.s36 = { set: 'D', idx: 2 }; QPROG.s37 = { set: 'D', idx: 2 };
/* The peak question (deck slides 53-61) carries NO stepper: it is one long
   task, not a numbered practice set (producer 03.09). Its screens are simply
   absent from QPROG, so renderQprog() and setQResult() skip them. */
const QSET_SIZE = { A: 4, B: 3, C: 2, D: 3, E: 6 };
const qResults = {};
const QP_TICK = '<svg class="qp-tick" viewBox="0 0 10.4133 7.51728" fill="none"><path d="M3.36229 7.51715C3.06671 7.51727 2.78322 7.39978 2.57439 7.1906L0.192279 4.80937C-0.0640367 4.55298 -0.0640367 4.13736 0.192279 3.88096C0.448678 3.62464 0.864299 3.62464 1.1207 3.88096L3.36229 6.12255L9.29261 0.192237C9.54901 -0.064079 9.96463 -0.064079 10.221 0.192237C10.4773 0.448635 10.4773 0.864256 10.221 1.12065L4.1502 7.1906C3.94136 7.39978 3.65788 7.51727 3.36229 7.51715Z" fill="white"/></svg>';
const QP_X = '<svg class="qp-x" viewBox="0 0 10 10" fill="none"><path d="M9.76736 0.232637C9.61836 0.0836796 9.4163 0 9.20561 0C8.99492 0 8.79286 0.0836796 8.64386 0.232637L5 3.87649L1.35615 0.232637C1.20714 0.0836796 1.00508 0 0.794391 0C0.583702 0 0.381639 0.0836796 0.232637 0.232637C0.0836796 0.381639 0 0.583702 0 0.794391C0 1.00508 0.0836796 1.20714 0.232637 1.35615L3.87649 5L0.232637 8.64386C0.0836796 8.79286 0 8.99492 0 9.20561C0 9.4163 0.0836796 9.61836 0.232637 9.76736C0.381639 9.91632 0.583702 10 0.794391 10C1.00508 10 1.20714 9.91632 1.35615 9.76736L5 6.12351L8.64386 9.76736C8.79286 9.91632 8.99492 10 9.20561 10C9.4163 10 9.61836 9.91632 9.76736 9.76736C9.91632 9.61836 10 9.4163 10 9.20561C10 8.99492 9.91632 8.79286 9.76736 8.64386L6.12351 5L9.76736 1.35615C9.91632 1.20714 10 1.00508 10 0.794391C10 0.583702 9.91632 0.381639 9.76736 0.232637Z" fill="white"/></svg>';

function setQResult(sid, ok) {
  if (qResults[sid] === undefined) { qResults[sid] = ok; renderQprog(sid); }
}
function stationState(setKey, idx) {
  const sids = Object.keys(QPROG).filter(k => QPROG[k].set === setKey && QPROG[k].idx === idx);
  if (!sids.every(k => qResults[k] !== undefined)) return null;
  return sids.every(k => qResults[k] === true);
}
function renderQprog(sid) {
  const host = document.getElementById(sid + '-qprog');
  const cfg = QPROG[sid];
  if (!host || !cfg) return;
  const count = QSET_SIZE[cfg.set];
  let html = '';
  for (let i = 0; i < count; i++) {
    const r = stationState(cfg.set, i);
    const st = r === true ? 'is-correct' : r === false ? 'is-wrong' : i === cfg.idx ? 'is-current' : '';
    html += '<div class="qprog-station ' + st + '"><span class="qprog-dot">' + QP_TICK + QP_X +
            '</span><span class="qprog-label">שאלה ' + (i + 1) + '</span></div>';
    if (i < count - 1) html += '<span class="qprog-line' + (r !== null ? ' is-done' : '') + '"></span>';
  }
  host.innerHTML = html;
}

/* slide feedback lines: "כל הכבוד! / זה לא מדוייק" — retry line is the
   percent-02 universal standard */
function mcqPopupCfg() {
  return {
    retry:   { bg: '#ffdbdc', title: 'זה לא מדוייק.', body: ['שננסה שוב?'] },
    correct: { bg: '#edf8ed', title: 'כל הכבוד!', body: [] },
    wrong2:  { bg: '#ffdbdc', title: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', body: ['התשובות הנכונות מסומנות.'] },
  };
}


const MCQ = {};
function mcqSnapshot(set) { return JSON.stringify([...set].sort()); }

function mcqToggle(q, id) {
  if (q.answered) return;
  if (q.selected.has(id)) q.selected.delete(id); else q.selected.add(id);
  if (q.attempts > 0) {
    document.getElementById(q.id + '-popup')?.classList.add('hidden');
    document.querySelectorAll('#' + q.id + ' ' + (q.optSelector || '.scq-opt')).forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#' + q.id + ' ' + (q.optSelector || '.scq-opt')).forEach(o => {
    const on = q.selected.has(o.dataset.id);
    o.classList.toggle('selected', on);
    o.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  mcqUpdateBar(q);
}

/* After a multi-select is answered the screen shows the RIGHT answers; this
   switches to what the learner marked and back, so they can compare the two
   (producer 03.09, deck slide 22). */
function mcqToggleView(sid) {
  const q = MCQ[sid];
  if (!q || !q.answered) return;
  q.view = q.view === 'correct' ? 'mine' : 'correct';
  const sel = '#' + q.id + ' ' + (q.optSelector || '.scq-opt');
  document.querySelectorAll(sel).forEach(o => o.classList.remove('correct', 'wrong', 'selected'));
  if (q.view === 'correct') {
    q.correctIds.forEach(id => mcqMark(q, id, 'correct'));
  } else {
    (q.learnerPicks || new Set()).forEach(id =>
      mcqMark(q, id, q.correctIds.has(id) ? 'correct' : 'wrong'));
  }
  const tog = document.getElementById(sid + '-answers-toggle');
  if (tog) tog.textContent = q.view === 'correct' ? 'הצגת התשובות שלי' : 'הצגת התשובות הנכונות';
}

function mcqShowPopup(q, type) {
  const popup = document.getElementById(q.id + '-popup');
  if (!popup) return;
  q._popup = type;          // see showPopup — the same persistence rule
  const cfg = q.popups[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  document.getElementById(q.id + '-popup-title').innerHTML = cfg.title;
  document.getElementById(q.id + '-popup-body').innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}

function mcqMark(q, id, cls) {
  const opt = document.querySelector('#' + q.id + ' ' + (q.optSelector || '.scq-opt') + '[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function mcqCheck(q) {
  if (q.answered) { advanceScreen(); return; }   // label is שנמשיך? → go next
  if (q.selected.size < 1) return;

  q.attempts++;
  const isCorrect = setsEqual(q.selected, q.correctIds);

  if (isCorrect) {
    q.correctIds.forEach(id => mcqMark(q, id, 'correct'));
    mcqShowPopup(q, 'correct');
    mcqFinish(q);
  } else if (q.attempts >= q.maxAttempts) {
    // final wrong: reveal the FULL correct set AND the learner's wrong picks
    q.correctIds.forEach(id => mcqMark(q, id, 'correct'));
    q.selected.forEach(id => { if (!q.correctIds.has(id)) mcqMark(q, id, 'wrong'); });
    mcqShowPopup(q, 'wrong2');
    mcqFinish(q);
  } else {
    // first wrong: mark ONLY the learner's own incorrect selections
    q.selected.forEach(id => { if (!q.correctIds.has(id)) mcqMark(q, id, 'wrong'); });
    q.lastWrong = mcqSnapshot(q.selected);
    mcqShowPopup(q, 'retry');
    mcqUpdateBar(q);
  }
}

function mcqFinish(q) {
  /* correctness from the sets, not from the attempt count — two wrong attempts also finish */
  xapiReport(q.id, setsEqual(q.selected, q.correctIds), [...q.selected].sort().join(','));
  q.answered = true;
  q.done = true;
  /* keep what the learner actually picked, so the two views can be compared */
  q.learnerPicks = new Set(q.selected);
  q.view = 'correct';
  const tog = document.getElementById(q.id + '-answers-toggle');
  if (tog) tog.classList.remove('hidden');
  document.querySelectorAll('#' + q.id + ' ' + (q.optSelector || '.scq-opt')).forEach(o => { o.disabled = true; });
  const chk = document.getElementById(q.id + '-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
  /* setQResult for these lives in mcqPracticeCheck, which owns the "did this call answer it"
     test — not repeated here. */
  try { flushResumeSave(); } catch (e) {}
}

function mcqUpdateBar(q) {
  if (q.answered) return;
  const chk = document.getElementById(q.id + '-check');
  if (chk) chk.disabled = q.selected.size < 1 || mcqSnapshot(q.selected) === q.lastWrong;
}

function mcqReset(q) {
  q.selected = new Set();
  q.attempts = 0;
  q.answered = false;
  q.lastWrong = null;
  document.querySelectorAll('#' + q.id + ' ' + (q.optSelector || '.scq-opt')).forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  document.getElementById(q.id + '-popup')?.classList.add('hidden');
  const chk = document.getElementById(q.id + '-check');
  if (chk) { setNavLabel(chk, 'צדקתי?'); chk.disabled = true; }
}


/* ─── generic single-choice engine (percent-02 policy) ─── */
const SCQ = {};
function scqSelectLegacy(sid, id) {
  const q = SCQ[sid];
  if (!q || q.done) return;
  q.selected = id;
  if (q.attempts > 0) {
    document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
    document.getElementById(sid + '-popup')?.classList.add('hidden');
  }
  document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const chk = document.getElementById(sid + '-check');
  if (chk) chk.disabled = q.selected === q.lastWrong;
}
function showPopup(sid, bg, title, body) {
  const popup = document.getElementById(sid + '-popup');
  if (!popup) return;
  /* goTo() hides every popup on navigation; remember this one so returning to
     an answered screen brings its feedback back (producer 03.09, unit-wide) */
  if (Q[sid]) Q[sid]._popup = { bg: bg, title: title, body: body };
  popup.style.background = bg;
  resetPopupPosition(popup);
  document.getElementById(sid + '-popup-title').innerHTML = title;
  document.getElementById(sid + '-popup-body').innerHTML = body.map(x => '<p>' + x + '</p>').join('');
  popup.classList.remove('hidden');
}
function scqCheck(sid) {
  const q = SCQ[sid];
  if (q.done) { advanceScreen(); return; }
  if (!q.selected) return;
  q.attempts++;
  const ok = q.selected === q.correctId;
  const mark = (id, cls) => {
    const o = document.querySelector('#' + sid + ' .scq-opt[data-id="' + id + '"]');
    if (o) { o.classList.remove('selected'); o.classList.add(cls); }
  };
  const finish = (wasOk) => {
    xapiReport(sid, wasOk, xapiAnswerText(document.querySelector('#' + sid + ' .scq-opt[data-id="' + q.selected + '"]')));
    q.done = true;
    document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => { o.disabled = true; });
    const chk = document.getElementById(sid + '-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton(sid);
    setQResult(sid, wasOk);
    try { flushResumeSave(); } catch (e) {}
  };
  if (ok) {
    mark(q.correctId, 'correct');
    showPopup(sid, '#edf8ed', q.okTitle, q.body);
    finish(true);
  } else if (q.attempts >= 2) {
    mark(q.correctId, 'correct'); mark(q.selected, 'wrong');
    showPopup(sid, '#ffdbdc', q.badTitle, q.body);
    finish(false);
  } else {
    mark(q.selected, 'wrong');
    q.lastWrong = q.selected;
    showPopup(sid, '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    const chk = document.getElementById(sid + '-check');
    if (chk) chk.disabled = true;
  }
}

/* ─── S15 (slide 27): statement assessment, 3 rows. נכון/נכון/לא נכון ─── */
const S15_CORRECT = { a: 'yes', b: 'yes', c: 'no' };
const S15_BODY = [
  'היגדים 1 ו-2 נכונים:',
  '1. יש 18 ריבועי עוגה עם סוכריות ו-24 ללא סוכריות, לכן היחס בין הריבועים ללא סוכריות לבין כלל הריבועים הוא <span class="frac" dir="ltr"><span class="frac-num">24</span><span class="frac-den">42</span></span>.',
  '2. היחס בין הריבועים עם הסוכריות לבין כלל הריבועים הוא <span class="frac" dir="ltr"><span class="frac-num">18</span><span class="frac-den">42</span></span> ולאחר צמצום נקבל יחס של <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">7</span></span>.',
];
let s15Picks = {}, s15Attempts = 0, s15Done = false, s15LastWrong = null;
function s15Pick(rowId, val, btn) {
  if (s15Done) return;
  s15Picks[rowId] = val;
  if (s15Attempts > 0) {
    document.querySelectorAll('#s15 .saq-row').forEach(r => r.classList.remove('row-correct', 'row-wrong', 'row-revealed'));
    document.getElementById('s15-popup')?.classList.add('hidden');
  }
  btn.closest('.saq-toggle').querySelectorAll('.saq-pill').forEach(pp => {
    const on = pp === btn;
    pp.classList.toggle('selected', on);
    pp.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const chk = document.getElementById('s15-check');
  if (chk) {
    const all = Object.keys(S15_CORRECT).every(k => s15Picks[k]);
    chk.disabled = !all || JSON.stringify(s15Picks) === s15LastWrong;
  }
}
function s15Check() {
  if (s15Done) { advanceScreen(); return; }
  if (!Object.keys(S15_CORRECT).every(k => s15Picks[k])) return;
  s15Attempts++;
  const ok = Object.keys(S15_CORRECT).every(k => s15Picks[k] === S15_CORRECT[k]);
  const mark = (reveal) => {
    document.querySelectorAll('#s15 .saq-row').forEach(row => {
      const id = row.dataset.id;
      const good = s15Picks[id] === S15_CORRECT[id];
      row.classList.add(good ? 'row-correct' : 'row-wrong');
      if (reveal && !good) {
        row.querySelectorAll('.saq-pill').forEach(pp => {
          const on = pp.dataset.val === S15_CORRECT[id];
          pp.classList.toggle('selected', on);
          pp.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        row.classList.remove('row-wrong');
        row.classList.add('row-revealed');
      }
    });
  };
  const finish = (wasOk) => {
    xapiReport('s15', wasOk, Object.keys(S15_CORRECT).map(k => k + ':' + s15Picks[k]).join(', '));
    s15Done = true;
    document.querySelectorAll('#s15 .saq-pill').forEach(pp => { pp.disabled = true; });
    const chk = document.getElementById('s15-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s15');
    setQResult('s15', wasOk);
    try { flushResumeSave(); } catch (e) {}
  };
  if (ok) { mark(false); showPopup('s15', '#edf8ed', 'כל הכבוד!', S15_BODY); finish(true); }
  else if (s15Attempts >= 2) { mark(true); showPopup('s15', '#ffdbdc', 'זה לא מדויק, בואו נבין למה.', S15_BODY); finish(false); }
  else {
    mark(false);
    s15LastWrong = JSON.stringify(s15Picks);
    showPopup('s15', '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    document.getElementById('s15-check').disabled = true;
  }
}

/* ─── S16/S17: single-choice practice questions ─── */
SCQ.s16 = { correctId: 'c', selected: null, attempts: 0, done: false, lastWrong: null,
  okTitle: 'זה נכון מאוד!', badTitle: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['1. היחס לא נשמר, כי נוספו רק ריבועי עוגה עם סוכריות. היחס החדש הוא <span dir="ltr">20 : 42</span> (בצמצום <span dir="ltr">10 : 21</span>) והוא שונה מ-<span dir="ltr">3 : 7</span>.',
         '2. היחס לא נשמר, כי רק מספר ריבועי העוגה עם הסוכריות הוכפל. היחס החדש הוא <span dir="ltr">36 : 42</span> (בצמצום <span dir="ltr">6 : 7</span>) והוא שונה מ-<span dir="ltr">3 : 7</span>.',
         '3. היחס נשמר ונשאר לאחר צמצום <span dir="ltr">3 : 7</span>, כי גם מספר ריבועי העוגה עם הסוכריות וגם מספר ריבועי העוגה הכולל גדלו פי 2.'] };
SCQ.s17 = { correctId: 'c', selected: null, attempts: 0, done: false, lastWrong: null,
  okTitle: 'מצוין!', badTitle: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['א. היות וכמות הגשם בעזוז מופיעה ראשונה בכתיב המילולי, הכתיב המתמטי צריך להיות <span dir="ltr">4 : 1</span>, ולכן ההיגד אינו נכון.',
         'ב. כמות הגשם שירדה באילת היא <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">5</span></span> מכלל כמות הגשם שירדה בשני המקומות יחד, ולכן ההיגד אינו נכון.',
         'ג. היחס בין כמות הגשם שירדה בעזוז לכמות הגשם שירדה בשני המקומות הוא <span class="frac" dir="ltr"><span class="frac-num">4</span><span class="frac-den">5</span></span>, זהו ההיגד הנכון.'] };
function s16Select(id) { scqSelect('s16', id); }
function s16Check()    { scqCheck('s16'); }
function s17Select(id) { scqSelect('s17', id); }
function s17Check()    { scqCheck('s17'); }

/* ─── S18/S22/S23: multi-select practice questions ─── */
function mcqCfg(okTitle, badTitle, body) {
  return { retry: { bg: '#ffdbdc', title: 'זה לא מדוייק, ננסה שוב?', body: [] },
           correct: { bg: '#edf8ed', title: okTitle, body: body },
           wrong2: { bg: '#ffdbdc', title: badTitle, body: body } };
}
MCQ.s18 = { id: 's18', correctIds: new Set(['a', 'b']), maxAttempts: 2,
  selected: new Set(), attempts: 0, answered: false, done: false, lastWrong: null,
  popups: mcqCfg('נכון!', 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', [
    'היגדים 1 ו-2 נכונים:',
    '1. <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">7</span></span> מאורך הסרטון מורכבים מקטעי וידאו מצולמים, ולכן החלק שנותר לאנימציה הוא <span class="frac" dir="ltr"><span class="frac-num">4</span><span class="frac-den">7</span></span>.',
    '2. היחס בין זמן האנימציה לזמן קטעי הוידאו הוא <span class="frac" dir="ltr"><span class="frac-num">4</span><span class="frac-den">7</span></span> : <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">7</span></span>, ולאחר צמצום מתקבל היחס <span dir="ltr">4 : 3</span>.']) };
MCQ.s22 = { id: 's22', correctIds: new Set(['a', 'b', 'c']), maxAttempts: 2,
  selected: new Set(), attempts: 0, answered: false, done: false, lastWrong: null,
  popups: mcqCfg('יפה!', 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', [
    'היגדים 1, 2, 3 נכונים:',
    '1. היחס הוא <span dir="ltr">6 : 18</span>, וכשנצמצם נקבל יחס <span dir="ltr">1 : 3</span>.',
    '2. על כל תלמיד/ה שבחר בנגרות, יש 3 תלמידים שבחרו בצורפות, לכן מספר התלמידים שבחרו בנגרות הוא <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">4</span></span> מכל תלמידי המגמה.',
    '3. המשמעות של היחס <span dir="ltr">1 : 3</span> היא שמספר התלמידים שבחרו בצורפות גדול פי 3 ממספר התלמידים שבחרו בנגרות.']) };
/* key per the V badges on slide 35 (rows 1-3 ticked, row 4 not) and the
   producer's call 17.08.26: statement 4 (the ×6 claim) is the wrong one.
   NOTE the deck's own feedback body contradicts this — it explains the ×6
   claim as correct and never mentions the 3/5 claim; flagged to producer. */
MCQ.s23 = { id: 's23', correctIds: new Set(['a', 'b', 'd']), maxAttempts: 2,
  selected: new Set(), attempts: 0, answered: false, done: false, lastWrong: null,
  popups: mcqCfg('כל הכבוד, זה נכון!', 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', [
    'ההיגדים הנכונים הם:',
    '1. נועה קיבלה 15 תגובות מחברי הכיתה ו-20 תגובות מחברי כיתות אחרות. לכן היחס הוא <span dir="ltr">15 : 20</span>.',
    '2. נצמצם את היחס <span dir="ltr">15 : 20</span> ב-5 ונקבל <span dir="ltr">3 : 4</span>, או כשבר <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">4</span></span>.',
    '3. אם נגדיל פי 6, היחס יהיה <span dir="ltr">90 : 120</span> ולאחר צמצום <span dir="ltr">3 : 4</span>, לכן הוא יישמר.']) };
function s18Toggle(id) { mcqToggle(MCQ.s18, id); }
function s22Toggle(id) { mcqToggle(MCQ.s22, id); }
function s23Toggle(id) { mcqToggle(MCQ.s23, id); }
function mcqPracticeCheck(sid) {
  const q = MCQ[sid];
  const was = q.answered;
  mcqCheck(q);
  if (!was && q.answered) { hideHintButton(sid); setQResult(sid, setsEqual(q.selected, q.correctIds)); }
}
function s18Check() { mcqPracticeCheck('s18'); }
function s22Check() { mcqPracticeCheck('s22'); }
function s23Check() { mcqPracticeCheck('s23'); }

/* ─── S19/S20: geometry value + ratio inputs ─── */
const S19_BODY = ['שטח הריבוע הוא 64 סמ"ר, לכן אורך צלע הריבוע הוא 8 ס"מ (64 = 8 · 8). היחס בין אורך צלע הריבוע לגובה המשולש הוא <span dir="ltr">1 : 2</span>, ולכן הגובה הוא 16 ס"מ.'];
let s19Attempts = 0, s19Done = false, s19LastWrong = null;
function s19OnInput() {
  if (s19Done) return;
  const v = document.getElementById('s19-input').value.trim();
  const chk = document.getElementById('s19-check');
  if (chk) chk.disabled = v === '' || v === s19LastWrong;
  if (s19Attempts > 0) {
    document.getElementById('s19-input').classList.remove('error', 'correct');
    document.getElementById('s19-popup')?.classList.add('hidden');
  }
}
function s19Check() {
  if (s19Done) { advanceScreen(); return; }
  const el = document.getElementById('s19-input');
  const v = el.value.trim();
  if (v === '') return;
  s19Attempts++;
  const ok = Number(v) === 16;
  const finish = (wasOk) => {
    xapiReport('s19', wasOk, v);
    s19Done = true; el.disabled = true;
    const chk = document.getElementById('s19-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s19'); setQResult('s19', wasOk);
    try { flushResumeSave(); } catch (e) {}
  };
  if (ok) { el.classList.add('correct'); showPopup('s19', '#edf8ed', 'כל הכבוד!', S19_BODY); finish(true); }
  else if (s19Attempts >= 2) {
    el.value = 16; el.classList.remove('error'); el.classList.add('correct');
    showPopup('s19', '#ffdbdc', 'זו טעות, בואו נלמד ממנה:', S19_BODY.concat(['התשובה הנכונה היא 16 ס"מ.']));
    finish(false);
  } else {
    el.classList.add('error'); s19LastWrong = v;
    showPopup('s19', '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    document.getElementById('s19-check').disabled = true;
  }
}

const S20_BODY = ['אורך צלע הריבוע הוא 8 ס"מ וגובה המשולש 16 ס"מ.',
  'שטח המשולש APB הוא 64 סמ"ר (16 · 8 חלקי 2), ושטח המצולע APBCD הוא 128 סמ"ר (64 + 64).',
  'לכן היחס המצומצם בין שטח המשולש לשטח המצולע הוא <span dir="ltr">1 : 2</span>.'];
let s20Attempts = 0, s20Done = false, s20LastWrong = null;
function s20Vals() {
  return [document.getElementById('s20-left').value.trim(), document.getElementById('s20-right').value.trim()];
}
function s20OnInput() {
  if (s20Done) return;
  const v = s20Vals();
  const chk = document.getElementById('s20-check');
  if (chk) chk.disabled = v.some(x => x === '') || JSON.stringify(v) === s20LastWrong;
  if (s20Attempts > 0) {
    document.querySelectorAll('#s20 .viq-input-box').forEach(el => el.classList.remove('error', 'correct'));
    document.getElementById('s20-popup')?.classList.add('hidden');
  }
}
function s20Check() {
  if (s20Done) { advanceScreen(); return; }
  const v = s20Vals();
  if (v.some(x => x === '')) return;
  s20Attempts++;
  const L = document.getElementById('s20-left'), R = document.getElementById('s20-right');
  const ok = Number(v[0]) === 1 && Number(v[1]) === 2;
  const finish = (wasOk) => {
    xapiReport('s20', wasOk, v.join(':'));
    s20Done = true; L.disabled = true; R.disabled = true;
    const chk = document.getElementById('s20-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s20'); setQResult('s20', wasOk);
    try { flushResumeSave(); } catch (e) {}
  };
  if (ok) { L.classList.add('correct'); R.classList.add('correct'); showPopup('s20', '#edf8ed', 'כל הכבוד!', S20_BODY); finish(true); }
  else if (s20Attempts >= 2) {
    L.value = 1; R.value = 2;
    [L, R].forEach(el => { el.classList.remove('error'); el.classList.add('correct'); });
    showPopup('s20', '#ffdbdc', 'זו טעות, בואו נלמד ממנה:', S20_BODY.concat(['התשובה הנכונה היא <span dir="ltr">1 : 2</span>.']));
    finish(false);
  } else {
    L.classList.add('error'); R.classList.add('error'); s20LastWrong = JSON.stringify(v);
    showPopup('s20', '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    document.getElementById('s20-check').disabled = true;
  }
}

/* ─── S24 (slide 36): two-part — silent-mode fraction + ratio ─── */
const S24_BODY = ['א. אם ב-<span class="frac" dir="ltr"><span class="frac-num">2</span><span class="frac-den">3</span></span> מהזמן הטלפון פועל במצב רגיל, אז ב-<span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">3</span></span> מהזמן הוא במצב שקט.',
  'ב. היחס בין הזמן שבו הטלפון פועל במצב רגיל לבין הזמן בו הטלפון במצב שקט הוא <span class="frac" dir="ltr"><span class="frac-num">2</span><span class="frac-den">3</span></span> : <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">3</span></span>, נוכל להרחיב יחס זה פי 3 ונקבל <span dir="ltr">2 : 1</span>.'];
let s24Attempts = 0, s24Done = false, s24LastWrong = null;
function s24Vals() {
  return ['s24a-num', 's24a-den', 's24b-left', 's24b-right'].map(id => document.getElementById(id).value.trim());
}
function s24OnInput() {
  if (s24Done) return;
  const v = s24Vals();
  const chk = document.getElementById('s24-check');
  if (chk) chk.disabled = v.some(x => x === '') || JSON.stringify(v) === s24LastWrong;
  if (s24Attempts > 0) {
    document.querySelectorAll('#s24 .viq-input-box').forEach(el => el.classList.remove('error', 'correct'));
    document.getElementById('s24-popup')?.classList.add('hidden');
  }
}
function s24Check() {
  if (s24Done) { advanceScreen(); return; }
  const v = s24Vals();
  if (v.some(x => x === '')) return;
  s24Attempts++;
  const want = [1, 3, 2, 1];
  const okEach = v.map((x, i) => Number(x) === want[i]);
  const ok = okEach.every(Boolean);
  const ids = ['s24a-num', 's24a-den', 's24b-left', 's24b-right'];
  const finish = (wasOk) => {
    /* Two catalogue questions on one screen: א is the fraction (inputs 0-1), ב the ratio
       (inputs 2-3). Reported separately with their own verdicts, per metadata item 003. */
    xapiReport('s24a', !!(okEach[0] && okEach[1]), v[0] + '/' + v[1]);
    xapiReport('s24b', !!(okEach[2] && okEach[3]), v[2] + ':' + v[3]);
    s24Done = true;
    ids.forEach(id => { document.getElementById(id).disabled = true; });
    const chk = document.getElementById('s24-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s24'); setQResult('s24', wasOk);
    try { flushResumeSave(); } catch (e) {}
  };
  if (ok) {
    ids.forEach(id => document.getElementById(id).classList.add('correct'));
    showPopup('s24', '#edf8ed', 'מצויין!', S24_BODY);
    finish(true);
  } else if (s24Attempts >= 2) {
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      el.value = want[i]; el.classList.remove('error'); el.classList.add('correct');
    });
    showPopup('s24', '#ffdbdc', 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', S24_BODY.concat(['התשובה הנכונה היא <span dir="ltr">2 : 1</span>.']));
    finish(false);
  } else {
    okEach.forEach((good, i) => { if (!good) document.getElementById(ids[i]).classList.add('error'); });
    s24LastWrong = JSON.stringify(v);
    showPopup('s24', '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    document.getElementById('s24-check').disabled = true;
  }
}


/* ═══════════════════════════════════════════════════════════
   Generic question engines for S26-S51 (slides 38-63).
   Every question is 2 attempts: first wrong → retry, second → reveal.
   Answer keys read from the script's V badges / feedback bodies.
   ═══════════════════════════════════════════════════════════ */
const Q = {};   // sid → {type, answers, ok, bad, body, done, attempts, lastWrong}
window.Q = Q;   // exposed for the dev harness and automated checks

function qNum(v) {
  v = String(v).trim().replace(',', '.');
  if (/^\d+\s*\/\s*\d+$/.test(v)) { const p = v.split('/'); return Number(p[0]) / Number(p[1]); }
  return v === '' ? NaN : Number(v);
}
function qInput(el) {
  const scr = el.closest('.screen');
  if (!scr) return;
  const sid = scr.id, q = Q[sid];
  if (!q || q.done) return;
  if (q.attempts > 0) {
    scr.querySelectorAll('.viq-input-box').forEach(i => i.classList.remove('error', 'correct'));
    document.getElementById(sid + '-popup')?.classList.add('hidden');
  }
  const vals = q.inputs.map(id => document.getElementById(id).value.trim());
  const chk = document.getElementById(sid + '-check');
  if (chk) chk.disabled = vals.some(v => v === '') || JSON.stringify(vals) === q.lastWrong;
}
function saqPick(sid, rowId, val, btn) {
  const q = Q[sid];
  if (!q || q.done) return;
  q.picks = q.picks || {};
  q.picks[rowId] = val;
  if (q.attempts > 0) {
    document.querySelectorAll('#' + sid + ' .saq-row').forEach(r => r.classList.remove('row-correct', 'row-wrong', 'row-revealed'));
    document.querySelectorAll('#' + sid + ' .ai-table tbody tr').forEach(r => r.classList.remove('row-correct', 'row-wrong'));
    document.getElementById(sid + '-popup')?.classList.add('hidden');
  }
  btn.closest('.saq-toggle').querySelectorAll('.saq-pill').forEach(pp => {
    const on = pp === btn;
    pp.classList.toggle('selected', on);
    pp.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const chk = document.getElementById(sid + '-check');
  if (chk) {
    const all = Object.keys(q.answers).every(k => q.picks[k]);
    chk.disabled = !all || JSON.stringify(q.picks) === q.lastWrong;
  }
}
function scqSelect(sid, id) {
  const q = Q[sid];
  if (!q) { scqSelectLegacy(sid, id); return; }   // s16/s17 still use the SCQ map
  if (q.done) return;
  q.selected = id;
  if (q.attempts > 0) {
    document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
    document.getElementById(sid + '-popup')?.classList.add('hidden');
  }
  document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => {
    const sel = o.dataset.id === id;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const chk = document.getElementById(sid + '-check');
  if (chk) chk.disabled = q.selected === q.lastWrong;
}
/* An answered screen keeps its feedback: goTo() hides all popups, so the
   screen's own stored popup is re-opened on entry (producer 03.09). */
function restoreFeedback(sid) {
  const q = Q[sid];
  if (q && q.done && q._popup) {
    showPopup(sid, q._popup.bg, q._popup.title, q._popup.body);
    return;
  }
  const mq = MCQ[sid];
  if (mq && mq.answered && mq._popup) mcqShowPopup(mq, mq._popup);
  const sq = SCQ && SCQ[sid];
  if (sq && sq.done && sq._popup) showPopup(sid, sq._popup.bg, sq._popup.title, sq._popup.body);
}

function qFinish(sid, ok) {
  const q = Q[sid];
  q.done = true;
  const scr = document.getElementById(sid);
  scr.querySelectorAll('.viq-input-box').forEach(i => { i.disabled = true; });
  scr.querySelectorAll('.saq-pill, .scq-opt').forEach(b => { b.disabled = true; });
  const chk = document.getElementById(sid + '-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
  hideHintButton(sid);
  if (QPROG[sid]) setQResult(sid, ok);
  /* ⚠️ The flush contract: this is where an answer is COMMITTED, so the state write must be
     synchronous and NO return may sit between the two. goTo() only arms a debounced save, and a
     learner who answers and then leaves inside that window would lose the answer — worse, a stale
     timer can fire AFTER a forward write and send the next launch back into the finished part. */
  try { flushResumeSave(); } catch (e) {}
}
/* the unit gives two attempts; a question may ask for one (producer 03.09) */
function qMaxAttempts(q) { return q.maxAttempts || 2; }

/* Report a generic-engine screen. Called from qCheck at the moment the question resolves, where
   the per-row verdicts are still in hand — several screens carry more than one catalogue question
   (see XAPI_QMAP), and one statement per screen would lose that. */
function xapiReportQScreen(sid, q, ok, each, vals) {
  if (sid === 's26' && each) {                       /* three ratio rows -> q1, q2, q3 */
    for (var r = 0; r < 3; r++) {
      xapiReport('s26r' + r, !!(each[2 * r] && each[2 * r + 1]),
                 vals ? vals[2 * r] + ':' + vals[2 * r + 1] : null);
    }
    return;
  }
  if (sid === 's28' && each) {                       /* two ratio rows -> q1, q2 */
    for (var s = 0; s < 2; s++) {
      xapiReport('s28r' + s, !!(each[2 * s] && each[2 * s + 1]),
                 vals ? vals[2 * s] + ':' + vals[2 * s + 1] : null);
    }
    return;
  }
  if (sid === 's33' || sid === 's34' || sid === 's35') { xapiReportAiTable(sid, ok); return; }
  var answer = (q.type === 'input') ? (vals || []).join(', ')
             : (q.type === 'saq')   ? Object.keys(q.answers).map(function (k) {
                                        return k + ':' + (q.picks ? q.picks[k] : '');
                                      }).join(', ')
             : (q.selected == null ? '' : String(q.selected));
  xapiReport(sid, ok, answer);
}

function qCheck(sid) {
  const q = Q[sid];
  if (!q) return;
  if (q.done) { advanceScreen(); return; }
  const scr = document.getElementById(sid);
  let ok, snapshot;
  /* Hoisted out of the input branch so the reporting call at the bottom can still see the
     per-input verdicts — several screens carry more than one catalogue question. */
  let _each = null, _vals = null;
  if (q.type === 'input') {
    const vals = q.inputs.map(id => document.getElementById(id).value.trim());
    if (vals.some(v => v === '')) return;
    _vals = vals;
    snapshot = JSON.stringify(vals);
    /* `accept` lists whole answer vectors that are all correct — the deck's
       slide 28 takes each ratio either unreduced or reduced, but not mixed
       within one row (producer 03.09) */
    const sets = q.accept || [q.answers];
    const hit = sets.find(set => vals.every((v, i) => qNum(v) === set[i]));
    ok = !!hit;
    const each = vals.map((v, i) => qNum(v) === (hit || q.answers)[i]);
    _each = each;
    q.attempts++;
    if (ok || q.attempts >= qMaxAttempts(q)) {
      q.inputs.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!ok) el.value = q.display ? q.display[i] : q.answers[i];
        el.classList.remove('error'); el.classList.add('correct');
      });
    } else {
      each.forEach((good, i) => { if (!good) document.getElementById(q.inputs[i]).classList.add('error'); });
    }
  } else if (q.type === 'saq') {
    if (!Object.keys(q.answers).every(k => q.picks && q.picks[k])) return;
    snapshot = JSON.stringify(q.picks);
    ok = Object.keys(q.answers).every(k => q.picks[k] === q.answers[k]);
    q.attempts++;
    Object.keys(q.answers).forEach(k => {
      const row = scr.querySelector('.saq-row[data-id="' + k + '"]') ||
                  scr.querySelector('[onclick*="\'' + k + '\'"]')?.closest('tr');
      if (!row) return;
      const good = q.picks[k] === q.answers[k];
      row.classList.add(good ? 'row-correct' : 'row-wrong');
      if (!good && (ok || q.attempts >= qMaxAttempts(q))) {
        row.querySelectorAll('.saq-pill').forEach(pp => {
          const on = pp.dataset.val === q.answers[k];
          pp.classList.toggle('selected', on);
          pp.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        row.classList.remove('row-wrong'); row.classList.add('row-revealed');
      }
    });
  } else {
    if (!q.selected) return;
    snapshot = q.selected;
    ok = q.selected === q.answers;
    q.attempts++;
    const mark = (id, cls) => {
      const o = scr.querySelector('.scq-opt[data-id="' + id + '"]');
      if (o) { o.classList.remove('selected'); o.classList.add(cls); }
    };
    if (ok) mark(q.answers, 'correct');
    else { mark(q.selected, 'wrong'); if (q.attempts >= qMaxAttempts(q)) mark(q.answers, 'correct'); }
  }
  /* Report BEFORE qFinish: qFinish flushes the state document, and the ledger the flush persists
     must already know this answer went out. Both terminal branches report; the retry branch does
     not — an unresolved question has no verdict to send. */
  if (ok) {
    xapiReportQScreen(sid, q, true, _each, _vals);
    showPopup(sid, '#edf8ed', q.ok, q.body); qFinish(sid, true);
  }
  else if (q.attempts >= qMaxAttempts(q)) {
    xapiReportQScreen(sid, q, false, _each, _vals);
    showPopup(sid, '#ffdbdc', q.bad, q.body.concat(q.reveal || [])); qFinish(sid, false);
  }
  else {
    q.lastWrong = snapshot;
    showPopup(sid, '#ffdbdc', 'זה לא מדוייק, ננסה שוב?', []);
    const chk = document.getElementById(sid + '-check');
    if (chk) chk.disabled = true;
  }
}

function defQ(sid, cfg) { Q[sid] = Object.assign({ attempts: 0, done: false, lastWrong: null }, cfg); }

/* ── practice set C (slides 38-41) ── */
defQ('s26', { type: 'input', inputs: ['s26-0a','s26-0b','s26-1a','s26-1b','s26-2a','s26-2b'],
  answers: [1.3, 10, 1, 5, 1, 10],
  ok: 'מצויין!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['1. היחס בין משקל החלבון למשקל הפחמימות ביחידה אחת הוא <span class="ratio">1.3 : 10</span>.',
         '2. היחס בין משקל השומן למשקל הפחמימות הוא <span class="ratio">2 : 10</span>, ולאחר צמצום הוא <span class="ratio">1 : 5</span>.',
         '3. משקל כל המרכיבים ביחידה אחת הוא 20 גרם, ולכן היחס בין משקל השומן למשקל הכולל הוא <span class="ratio">2 : 20</span> ולאחר צמצום נקבל <span class="ratio">1 : 10</span>.'] });
defQ('s27', { type: 'saq', maxAttempts: 1, answers: { a: 'no', b: 'yes', c: 'yes' },
  ok: 'זו תשובה נכונה מאוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היגדים 2 ו-3 נכונים:',
         'משקל הפחמימות הוא 10 גרם ומשקל השומן הוא 2 גרם, לכן משקל הפחמימות גדול פי 5 ממשקל השומן.',
         'היחס בין משקל הסוכרים ב-100 גרם לבין משקל הסוכרים ב-20 גרם הוא <span class="ratio">6.7 : 1.3</span>, ולאחר צמצום מתקבל בערך היחס <span class="ratio">5 : 1</span>.',
         'ב-100 גרם יש 23 מ"ג נתרן, לכן ב-150 גרם יש 34.5 מ"ג (פי 1.5).'] });
defQ('s28', { type: 'input', inputs: ['s28-0a','s28-0b','s28-1a','s28-1b'], answers: [5, 3, 5, 8],
  /* each row on its own terms: 10:6 or 5:3 above, 10:16 or 5:8 below */
  accept: [[10, 6, 10, 16], [10, 6, 5, 8], [5, 3, 10, 16], [5, 3, 5, 8]],
  ok: 'תשובה נכונה!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['1. כל המשולשים זהים ולכן הם שווי שטח. יש 10 משולשים אפורים ו-6 משולשים בצבע תכלת, לכן היחס בין השטח האפור לשטח התכלת הוא <span class="ratio">10 : 6</span> ואם נצמצם נקבל <span class="ratio">5 : 3</span>.',
         '2. יש 10 משולשים אפורים ו-16 משולשים סה"כ במשולש הגדול. היחס בין השטח האפור לשטח המשולש הגדול הוא <span class="ratio">10 : 16</span> ואם נצמצם נקבל <span class="ratio">5 : 8</span>.'] });
defQ('s29', { type: 'saq', maxAttempts: 1, answers: { a: 'no', b: 'yes' },
  ok: 'כל הכבוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['1. היחס בין השטח האפור לבין השטח בצבע תכלת לאחר ההוספה של המשולשים הוא <span class="ratio">15 : 10</span>. אם נצמצם ב-5 נקבל שהיחס הוא <span class="ratio">3 : 2</span> — היחס לא נשמר.',
         '2. הכפלנו פי אותו מספר את כמות המשולשים האפורים ואת כמות המשולשים בצבע תכלת, לכן היחס נשמר.'] });

/* ── advanced set (slides 43-49) ── */
defQ('s31', { type: 'input', inputs: ['s31-ang','s31-r1','s31-r2','s31-r3'], answers: [20, 2, 3, 13],
  ok: 'זה מדוייק!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['סכום הזוויות במשולש הוא 180°. נחשב את הזווית השלישית: 180° - 130° - 30° = 20°.',
         'היחס בין שלושת הזוויות הוא <span class="ratio">20 : 30 : 130</span>, ולאחר צמצום ב-10 נקבל <span class="ratio">2 : 3 : 13</span>.'] });
defQ('s32', { type: 'input', inputs: ['s32-a1','s32-a2','s32-r1','s32-r2','s32-r3'], answers: [70, 70, 4, 7, 7],
  ok: 'מעולה!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['המשולש הוא שווה שוקיים ולכן 2 הזוויות שנותרו שוות: 180° - 40° = 140°, ו-140° : 2 = 70°.',
         'היחס בין שלושת הזוויות הוא <span class="ratio">40 : 70 : 70</span>. נצמצם ב-10 ונקבל <span class="ratio">4 : 7 : 7</span>.'] });
const AI_BODY = ['המשמעות של יחס <span class="ratio">1 : 1</span> היא שכמות המרואיינים שהשתמשו כל יום ב-AI היא <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">2</span></span> מכלל המרואיינים, כלומר — <span dir="ltr">4,750 : 2 = 2,375</span>. לכן המסקנה נכונה.'];
/* keys on the AI table follow the deck's FEEDBACK text, which states the
   verdict and the arithmetic for each row (producer 20.08: restore). The
   96px BadgeTick graphics on slides 45-47 overlap rows/columns and
   contradict that text on row 1 — they are not the key here. */
defQ('s33', { type: 'saq', answers: { a: 'yes' }, ok: 'יפה מאוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:', body: AI_BODY });
defQ('s34', { type: 'saq', answers: { b: 'yes' }, ok: 'יפה מאוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['אם היחס הוא <span class="ratio">13 : 7</span>, אז <span class="frac" dir="ltr"><span class="frac-num">7</span><span class="frac-den">20</span></span> מהמרואיינים חושבים שהשימוש ב-AI לא הפך אותם ליותר יעילים. <span class="frac" dir="ltr"><span class="frac-num">7</span><span class="frac-den">20</span></span> זה כמעט <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">3</span></span>. לכן המסקנה נכונה.'] });
defQ('s35', { type: 'saq', answers: { c: 'no' }, ok: 'יפה מאוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היחס הוא <span class="ratio">2 : 3</span>, כלומר <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">5</span></span> מהמרואיינים חשבו שאין צורך בכישורים מיוחדים, וזה יותר מחצי מהם. לכן המסקנה אינה נכונה.'] });
defQ('s36', { type: 'scq', answers: 'b', ok: 'נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['בתחילת המשחק היחס בין מספר הקלפים של טליה למספר הקלפים של יוני היה <span class="ratio">1 : 1</span>. המשמעות היא שעל כל קלף של טליה יש קלף אחד של יוני — כלומר מספר הקלפים היה שווה.'] });
defQ('s37', { type: 'input', inputs: ['s37-in'], answers: [2], ok: 'מצוין!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['בסוף המשחק היחס בין מספר הקלפים של טליה למספר הקלפים של יוני היה <span class="ratio">6 : 3</span>. נצמצם ונקבל <span class="ratio">2 : 1</span> — כלומר לטליה יש פי 2 קלפים מיוני.'] });

/* ── peak question: the concert (slides 53-61) ── */
defQ('s41', { type: 'input', inputs: ['s41-num','s41-den'], answers: [3, 5],
  ok: 'זה נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היחס בין מספר הכרטיסים המוזלים לבין סך כל הכרטיסים הוא <span class="ratio">3 : 5</span>, ולכן כשבר פשוט הוא <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">5</span></span>.'] });
defQ('s42', { type: 'input', inputs: ['s42-in'], answers: [5], ok: 'זה נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['המשמעות של יחס <span class="ratio">3 : 5</span> היא שעל כל 3 כרטיסים שנמכרו במחיר מלא, נמכרו 5 כרטיסים במחיר מוזל.'] });
defQ('s43', { type: 'input', inputs: ['s43-a','s43-b'], answers: [2, 3], ok: 'זה נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היחס בכתיב מתמטי הוא <span class="ratio">120 : 180</span>. נצמצם ונקבל יחס <span class="ratio">2 : 3</span>.'] });
defQ('s44', { type: 'input', inputs: ['s44-a','s44-b'], answers: [2, 3], ok: 'מצוין!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היחס המצומצם הוא <span class="ratio">2 : 3</span>. המשמעות היא שעל כל 2 כרטיסים במחיר מלא שנמכרו, נמכרו 3 כרטיסים מוזלים.'] });
defQ('s45', { type: 'scq', answers: 'b', ok: 'מצוין!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['היחס המתוכנן היה <span class="ratio">3 : 5</span>, ולאחר המכירה היחס בפועל היה <span class="ratio">2 : 3</span>. לכן, היחס לא נשמר.'] });
defQ('s46', { type: 'input', inputs: ['s46-a','s46-b'], answers: [1, 10], ok: 'זה נכון מאוד!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['נשמרו 40 כרטיסים לנגנים, זמרים ואנשי צוות, מתוך 400 כרטיסים סך הכל. היחס הוא <span class="ratio">40 : 400</span> ולאחר צמצום <span class="ratio">1 : 10</span>.'] });
defQ('s48', { type: 'scq', answers: 'a', ok: 'נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['נמכרו 180 כרטיסים במחיר מוזל ועוד 120 כרטיסים במחיר מלא, סה"כ 300 כרטיסים מתוך 400 מושבים באולם. כלומר <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">4</span></span> מהכרטיסים נמכרו במחיר מלא ומוזל. המסקנה: הדר צודקת.'] });
defQ('s49', { type: 'scq', answers: 'a', ok: 'נכון!', bad: 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
  body: ['מחיר כרטיס מלא הוא פי 2 ממחיר כרטיס מוזל. לעומת זאת, היחס בין כמות הכרטיסים המוזלים לכמות הכרטיסים במחיר מלא הוא <span class="ratio">3 : 2</span>, ולכן עומר צודק.',
         'ההכנסה מהכרטיסים המוזלים: 180 · 20 = 3,600 ש"ח. ההכנסה מהכרטיסים במחיר מלא: 120 · 40 = 4,800 ש"ח.',
         'לכן ההכנסה מהכרטיסים במחיר מלא הייתה גבוהה יותר למרות שמספרם נמוך יותר.'] });

['s26','s27','s28','s29','s31','s32','s33','s34','s35','s36','s37',
 's41','s42','s43','s44','s45','s46','s48','s49'].forEach(sid => {
  window[sid + 'Check'] = function () { qCheck(sid); };
});

/* ═══════════════════════════════════════════════════════════
   REPORT MODAL — "מצאתם בעיה?" (template-library/ReportModal —
   approved 09.08; same behavior in all 720 projects).

   Deliberately NOT replaced by ../unit-js/25-report.js: that file needs DOM this unit does not
   have (#report-type-wrapper, #report-thanks-modal, .report-custom-select and a
   .report-select-option list), so adopting it would mean rewriting the dialog markup in all five
   index.html and the CSS in all five styles.css for no learner-visible gain. See unit-js/README.md.

   shortId() is NOT declared here — ../unit-js/10-identity.js owns it. The copy that used to sit
   here was `split('/').pop()` with no trailing-slash trim, which returns '' for a canonical id
   (they all end in '/'), so every report would have carried empty unit/component/item fields the
   moment window.METADATA started arriving.

   SCREEN_TO_SUBCONTENT is NOT declared here either — it is per-component and lives in each
   script.js. A shared copy would load AFTER script.js and silently overwrite the real one.
   ═══════════════════════════════════════════════════════════ */

var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse';

function openReportModal() {
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}
function tryCloseReportModal() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  if (typeVal || textVal) {
    document.getElementById('report-modal').setAttribute('hidden', '');
    document.getElementById('report-confirm-modal').removeAttribute('hidden');
  } else { forceCloseReportModal(); }
}
function forceCloseReportModal() {
  document.getElementById('report-modal').setAttribute('hidden', '');
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  resetReportForm();
}
function backToReportForm() {
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}

function submitReport() {
  var typeSel = document.getElementById('report-type');
  var textVal = document.getElementById('report-text').value.trim();
  var errEl   = document.getElementById('report-error');
  if (!typeSel.value || !textVal) {
    if (errEl) errEl.removeAttribute('hidden');
    (typeSel.value ? document.getElementById('report-text') : typeSel).focus();
    return;
  }
  if (errEl) errEl.setAttribute('hidden', '');
  var now  = new Date();
  var meta = window.METADATA || {
    learningUnitId: 'methodica-math-ratio-02',
    id: 'methodica-math-ratio-02',
  };
  var body = new URLSearchParams();
  body.append('entry.301404029_year',  now.getFullYear());
  body.append('entry.301404029_month', now.getMonth() + 1);
  body.append('entry.301404029_day',   now.getDate());
  body.append('entry.2066097581_hour',   now.getHours());
  body.append('entry.2066097581_minute', now.getMinutes());
  body.append('entry.1933069481', shortId(meta.learningUnitId));
  body.append('entry.2070680092', shortId(meta.id));
  var mapEntry = SCREEN_TO_SUBCONTENT[currentScreen];
  var itemId   = mapEntry ? (shortId(meta.id)) + '-' + mapEntry[0] : '';
  var itemPage = mapEntry ? String(mapEntry[1]) : String(currentScreen);
  body.append('entry.1555704258', itemId);
  body.append('entry.1671046914', itemPage);
  body.append('entry.1179822443', typeSel.options[typeSel.selectedIndex].text);
  body.append('entry.806447525',  textVal);
  fetch(REPORT_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
    .catch(function(e) { console.error('[Report] send failed', e); });
  console.log('[Report Issue] sent');
  showReportThanks();
}
function showReportThanks() {
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.setAttribute('hidden', ''); });
  var t = document.getElementById('report-thanks');
  if (t) t.removeAttribute('hidden');
}
function resetReportForm() {
  document.getElementById('report-type').value = '';
  document.getElementById('report-text').value = '';
  document.getElementById('report-char-count').textContent = '0 / 250';
  var errEl = document.getElementById('report-error');
  if (errEl) errEl.setAttribute('hidden', '');
  var t = document.getElementById('report-thanks');
  if (t) t.setAttribute('hidden', '');
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.removeAttribute('hidden'); });
}
/* Wire the flag button + char counter + Esc-to-close */
/* Called from ../unit-js/90-boot.js, not run on load. It was a top-level IIFE, which cannot
   participate in the boot order and — worse — would be skipped in silence if anything above it in
   this file threw at load time, leaving the flag button dead with no console error. That exact
   failure has happened in this family. */
function initReportModal() {
  var flagBtn = document.querySelector('.flag-btn');
  if (flagBtn) flagBtn.addEventListener('click', openReportModal);
  var reportTextarea = document.getElementById('report-text');
  var reportCounter  = document.getElementById('report-char-count');
  if (reportTextarea && reportCounter) {
    reportTextarea.addEventListener('input', function() {
      reportCounter.textContent = reportTextarea.value.length + ' / 250';
    });
  }
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    var confirmModal = document.getElementById('report-confirm-modal');
    var reportModal  = document.getElementById('report-modal');
    if (confirmModal && !confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
    if (reportModal && !reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
  });
}


/* ─── Standard shared image-zoom modal (percent-02 pattern): any
   [data-zoom-src] opens with a clone of its sibling wrapper; any
   [data-zoom-close] closes. ─── */
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-zoom-src]');
  if (opener) {
    const modal = document.getElementById('img-zoom-modal');
    const stage = document.getElementById('img-zoom-stage');
    const wrapper = opener.parentElement?.querySelector('.scq-img-inner, .zoom-img-inner');
    if (modal && stage && wrapper) {
      stage.innerHTML = '';
      const clone = wrapper.cloneNode(true);
      clone.querySelectorAll('.img-zoom-btn').forEach(b => b.remove());
      stage.appendChild(clone);
      modal.classList.remove('hidden');
    }
    return;
  }
  if (e.target.closest('[data-zoom-close]')) {
    document.getElementById('img-zoom-modal')?.classList.add('hidden');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.getElementById('img-zoom-modal')?.classList.add('hidden');
});

/* ─── Dev mode: postMessage bridge ─────────────────────── */
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'DEV_GOTO') {
    const n = parseInt(e.data.screen, 10);
    if (!isNaN(n)) goTo(n);
  }
});
if (window.parent !== window) {
  window.parent.postMessage({ type: 'DEV_READY', total: TOTAL_SCREENS }, '*');
}


/* The seam between components. Kept as a named entry point because the markup calls it, but it
   now delegates to leaveToPart() so there is exactly ONE handover path — the one that reports the
   component 'completed' and moves the resume landing pointer first. A second path that only did
   location.replace() would skip both. */
function goToNextPart() {
  if (!window.PART_CONFIG || !window.PART_CONFIG.next) { finishUnit(); return; }
  leaveToPart(window.PART_CONFIG.next, window.PART_CONFIG.end + 1);
}


/* ═══════════════════════════════════════════════════════════════════
   RESUME — the hooks ../unit-js/40-resume.js and ../unit-js/50-loader.js call
   Full design: Documentation/reporting-and-resume/ADDING-REPORTING-AND-RESUME.md §8

   ── Why this lives in main.js and not in a file of its own ──
   applyResumeVars() runs eval(k + ' = st.vars[k];'), which resolves both `st` AND the target
   name lexically. The answer variables are top-level let/const of THIS file, so the eval has to
   sit here. Everything else follows it for cohesion.

   ── What resume has to do here that in-part navigation does not ──
   resetScreenState() already keeps an answered screen answered while the page is alive:
   resetQuestionOnEntry() early-returns on a finished question and restoreFeedback() re-opens its
   popup. After a page LOAD none of that helps — the DOM is pristine markup and every done flag is
   false — so the payload is applied first and then the painters below rebuild the answered look.
   ═══════════════════════════════════════════════════════════════════ */

/* Plain let-bindings, restored by eval. ⚠️ applyResumeVars assigns ONLY names on this list. */
var RESUME_PLAIN_VARS = [
  's1Selected', 's1Done',
  's2Revealed',
  's3q1Attempts', 's3q1LastWrong',
  's15Picks', 's15Attempts', 's15Done', 's15LastWrong',
  's19Attempts', 's19Done', 's19LastWrong',
  's20Attempts', 's20Done', 's20LastWrong',
  's24Attempts', 's24Done', 's24LastWrong'
];

/* Answers that live only in the DOM. DERIVED, not hand-maintained: the union of every
   Q[sid].inputs plus the questions that predate the generic engine. Deriving it means a new
   defQ() cannot be forgotten — which is exactly the kind of omission that costs a learner their
   answers with no error anywhere. Runs after the defQ() block above. */
var RESUME_INPUT_IDS = (function () {
  var ids = ['s3q2-left', 's3q2-right',
             's19-input',
             's20-left', 's20-right',
             's24a-num', 's24a-den', 's24b-left', 's24b-right'];
  Object.keys(Q).forEach(function (sid) {
    (Q[sid].inputs || []).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
  });
  return ids;
})();

/* Empty on purpose — this unit has no answer that exists only as DOM text. Kept so the hook
   contract keeps its shape across units. ⚠️ If it is ever populated, note that capturePartPayload
   must grow a matching `st.texts` half: the reference unit has only the APPLY side. */
var RESUME_TEXT_IDS = [];

/* The only trustworthy correctness source. NOT the attempt count (two wrong attempts also mark a
   screen done, so done !== correct) and NOT the inputs — on the final wrong attempt every input
   question OVERWRITES the learner's answer with the correct one before the capture runs, so a
   restored input is the revealed answer, not what they typed. That is faithful to what was on
   screen when they left, and their real answer is already in the reported statement. */
function screenWasCorrect(sid) {
  return qResults[sid] === true;
}

/* ── capture ───────────────────────────────────────────────────────── */

/* ⚠️ Sets become arrays. JSON cannot carry a Set — JSON.stringify(new Set(['a'])) is '{}' — and a
   silently dropped selection would come back as "nothing picked" on a screen that is also locked. */
function capturePartPayload() {
  var st = {
    currentScreen: currentScreen,

    /* Scoring first: without it a learner who resumes mid-component scores 0 from that point on,
       and the progress strips come back blank. */
    qResults: Object.assign({}, qResults),
    xapiQ: (typeof XAPI_Q_RESULTS !== 'undefined') ? Object.assign({}, XAPI_Q_RESULTS) : {},

    /* The const registries, field by field — a const binding cannot be reassigned. */
    s3:    { scrolledEnd: s3State.scrolledEnd, q1: s3State.q1, q2: s3State.q2,
             q3: s3State.q3, q4: s3State.q4, q5: s3State.q5,
             flipped: s3State.flipped.slice() },
    s3yn:  Object.assign({}, s3ynSelected),
    s3q1Selected: Array.from(s3q1Selected),
    gsteps: {},
    mcq:   {},
    scq:   {},
    q:     {},

    inputs: {},
    vars:   {}
  };

  Object.keys(GSTEPS).forEach(function (k) { st.gsteps[k] = !!GSTEPS[k].answered; });

  Object.keys(MCQ).forEach(function (k) {
    var m = MCQ[k];
    st.mcq[k] = {
      selected:     Array.from(m.selected || []),
      learnerPicks: m.learnerPicks ? Array.from(m.learnerPicks) : null,
      attempts:     m.attempts,
      answered:     !!m.answered,
      done:         !!m.done,
      view:         m.view || null,
      lastWrong:    m.lastWrong || null,
      _popup:       m._popup || null
    };
  });

  Object.keys(SCQ).forEach(function (k) {
    var s = SCQ[k];
    st.scq[k] = { selected: s.selected || null, attempts: s.attempts,
                  done: !!s.done, lastWrong: s.lastWrong || null, _popup: s._popup || null };
  });

  /* ⚠️ STATE KEYS ONLY. Q[sid] mixes this release's configuration (type, answers, accept, inputs,
     ok, bad, body, reveal, display, maxAttempts) with the learner's state. Carrying the config
     into the document and back would pin a returning learner to the answer key that was live when
     they started — a content fix would never reach them, and a corrected key would mark them
     wrong. */
  Object.keys(Q).forEach(function (k) {
    var q = Q[k];
    st.q[k] = { done: !!q.done, attempts: q.attempts, lastWrong: q.lastWrong || null,
                selected: (q.selected === undefined) ? null : q.selected,
                picks: q.picks ? Object.assign({}, q.picks) : null,
                _popup: q._popup || null };
  });

  RESUME_INPUT_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) st.inputs[id] = el.value;
  });

  RESUME_PLAIN_VARS.forEach(function (k) {
    try { st.vars[k] = eval(k); } catch (e) {}
  });

  return st;
}

/* ── apply ─────────────────────────────────────────────────────────── */

/* ⚠️ The parameter MUST stay named `st`. The loop at the bottom runs
   eval(k + ' = st.vars[k];'), which resolves `st` lexically — rename it and every assignment
   throws into the enclosing try/catch, the learner's answers vanish, and nothing appears in the
   console. Nothing but _test/ enforces this. */
function applyResumeVars(st) {
  if (!st) return;

  if (st.qResults) Object.keys(st.qResults).forEach(function (k) { qResults[k] = st.qResults[k]; });
  if (st.xapiQ && typeof XAPI_Q_RESULTS !== 'undefined') {
    Object.keys(st.xapiQ).forEach(function (k) { XAPI_Q_RESULTS[k] = st.xapiQ[k]; });
  }

  if (st.s3) {
    s3State.scrolledEnd = !!st.s3.scrolledEnd;
    ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(function (k) { s3State[k] = !!st.s3[k]; });
    if (st.s3.flipped) st.s3.flipped.forEach(function (v, i) { s3State.flipped[i] = !!v; });
  }
  if (st.s3yn) Object.keys(st.s3yn).forEach(function (k) { s3ynSelected[k] = st.s3yn[k]; });
  if (st.s3q1Selected) s3q1Selected = new Set(st.s3q1Selected);

  if (st.gsteps) {
    Object.keys(st.gsteps).forEach(function (k) {
      if (GSTEPS[k]) GSTEPS[k].answered = !!st.gsteps[k];
    });
  }

  if (st.mcq) {
    Object.keys(st.mcq).forEach(function (k) {
      if (!MCQ[k]) return;                     /* a screen this component does not own */
      var s = st.mcq[k];
      MCQ[k].selected     = new Set(s.selected || []);
      MCQ[k].learnerPicks = s.learnerPicks ? new Set(s.learnerPicks) : undefined;
      MCQ[k].attempts     = s.attempts || 0;
      MCQ[k].answered     = !!s.answered;
      MCQ[k].done         = !!s.done;
      MCQ[k].view         = s.view || 'correct';
      MCQ[k].lastWrong    = s.lastWrong || null;
      MCQ[k]._popup       = s._popup || null;
    });
  }

  if (st.scq) {
    Object.keys(st.scq).forEach(function (k) {
      if (!SCQ[k]) return;
      var s = st.scq[k];
      SCQ[k].selected  = s.selected || null;
      SCQ[k].attempts  = s.attempts || 0;
      SCQ[k].done      = !!s.done;
      SCQ[k].lastWrong = s.lastWrong || null;
      SCQ[k]._popup    = s._popup || null;
    });
  }

  if (st.q) {
    Object.keys(st.q).forEach(function (k) {
      if (!Q[k]) return;
      var s = st.q[k];
      Q[k].done      = !!s.done;
      Q[k].attempts  = s.attempts || 0;
      Q[k].lastWrong = s.lastWrong || null;
      if (s.selected !== null && s.selected !== undefined) Q[k].selected = s.selected;
      if (s.picks) Q[k].picks = Object.assign({}, s.picks);
      Q[k]._popup    = s._popup || null;
      /* config keys deliberately untouched — see capturePartPayload */
    });
  }

  if (st.vars) {
    Object.keys(st.vars).forEach(function (k) {
      if (RESUME_PLAIN_VARS.indexOf(k) === -1) return;   /* never assign an unlisted name */
      try { eval(k + ' = st.vars[k];'); } catch (e) {}
    });
  }
}

/* Takes the WHOLE payload, not a sub-object. Must run BEFORE the painters, which disable the
   inputs it writes to. */
function applyResumeDom(st) {
  if (!st) return;
  if (st.inputs) {
    RESUME_INPUT_IDS.forEach(function (id) {
      if (typeof st.inputs[id] !== 'string') return;
      var el = document.getElementById(id);
      if (el) el.value = st.inputs[id];
    });
  }
  if (st.texts) {
    RESUME_TEXT_IDS.forEach(function (id) {
      if (typeof st.texts[id] !== 'string') return;
      var el = document.getElementById(id);
      if (el) el.textContent = st.texts[id];
    });
  }
}

/* ── the painters ──────────────────────────────────────────────────────
   Rules every painter below obeys:
     1. Correctness comes from screenWasCorrect(), never from the attempt count or the inputs.
     2. DOM writes only. No state mutation, no reporting call, no setQResult.
     3. Idempotent, and a no-op on a screen nothing has touched.
     4. Never reset — resetScreenState(n) owns that and has already run.
     5. Early-return on a missing host node: every part loads this same file, so a painter is
        routinely asked about a screen that is not in its DOM.
   ─────────────────────────────────────────────────────────────────────── */

function _lock(sel, root) {
  (root || document).querySelectorAll(sel).forEach(function (el) { el.disabled = true; });
}
function _doneButton(sid) {
  var chk = document.getElementById(sid + '-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
  hideHintButton(sid);
}

/* S1 — battery chat, single attempt, correct id 'd'. Not in Q/MCQ/SCQ, so showPopup() never
   stored a _popup for it and restoreFeedback() cannot bring it back: rebuilt from S1_BODY. */
function paintS1() {
  if (!s1Done || !document.getElementById('s1')) return;
  var ok = s1Selected === 'd';
  document.querySelectorAll('#s1 .scq-opt').forEach(function (o) {
    o.disabled = true;
    o.classList.remove('selected');
    if (o.dataset.id === 'd') o.classList.add('correct');
    else if (o.dataset.id === s1Selected) o.classList.add('wrong');
  });
  var popup = document.getElementById('s1-popup');
  if (popup) {
    popup.style.background = ok ? '#edf8ed' : '#ffdbdc';
    resetPopupPosition(popup);
    document.getElementById('s1-popup-title').innerHTML =
      ok ? 'כל הכבוד!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:';
    document.getElementById('s1-popup-body').innerHTML =
      S1_BODY.map(function (x) { return '<p>' + x + '</p>'; }).join('');
    popup.classList.remove('hidden');
  }
  _doneButton('s1');
}

/* S2 — staged reveal. s2Enter() already latched s2Revealed, so its timeouts will not re-run;
   land the end state directly instead of replaying 2.1s of animation. */
function paintS2() {
  if (!s2Revealed || !document.getElementById('s2')) return;
  document.getElementById('s2-text')?.classList.add('is-shown');
  document.getElementById('s2-char-group')?.classList.add('is-shown');
  var cont = document.getElementById('s2-continue');
  if (cont) cont.disabled = false;
}

/* S3 — one scrolling screen carrying five questions and four reveal cards. */
function paintS3() {
  if (!document.getElementById('s3')) return;

  if (s3State.q1) {
    var opts = document.querySelectorAll('#s3q1-block .scq-opt');
    var allCorrect = setsEqual(s3q1Selected, S3Q1_CORRECT);
    opts.forEach(function (o) {
      o.disabled = true;
      o.classList.remove('selected');
      if (S3Q1_CORRECT.has(o.dataset.id)) o.classList.add('correct');
      else if (s3q1Selected.has(o.dataset.id)) o.classList.add('wrong');
    });
    s3Feedback('s3q1-feedback', allCorrect,
      '<strong>' + (allCorrect ? 'כל הכבוד!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:') +
      '</strong><br>' + S3Q1_EXPLAIN);
    var c1 = document.getElementById('s3q1-check'); if (c1) c1.disabled = true;
  }

  if (s3State.q2) {
    var l = document.getElementById('s3q2-left'), r = document.getElementById('s3q2-right');
    if (l && r) {
      var okq2 = Number(l.value) === 1 && Number(r.value) === 4;
      l.disabled = true; r.disabled = true;
      l.classList.add('correct'); r.classList.add('correct');
      s3Feedback('s3q2-feedback', okq2,
        '<strong>' + (okq2 ? 'כל הכבוד!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:') +
        '</strong><br>' + S3Q2_EXPLAIN +
        (okq2 ? '' : '<br>התשובה הנכונה היא <span dir="ltr"><strong>1 : 4</strong></span>'));
      var c2 = document.getElementById('s3q2-check'); if (c2) c2.disabled = true;
    }
  }

  Object.keys(S3_YESNO).forEach(function (qid) {
    var cfg = S3_YESNO[qid];
    if (!s3State[cfg.flag]) return;
    var chk = document.getElementById(qid + '-check');
    if (!chk) return;
    var sel = s3ynSelected[qid];
    var ok = sel === cfg.correct;
    var block = chk.closest('.rs-block');
    if (block) {
      block.querySelectorAll('.scq-opt').forEach(function (o) {
        o.disabled = true;
        o.classList.remove('selected');
        if (o.dataset.id === cfg.correct) o.classList.add('correct');
        else if (o.dataset.id === sel) o.classList.add('wrong');
      });
    }
    s3Feedback(qid + '-feedback', ok, '<strong>' + (ok ? cfg.ok : cfg.bad) + '</strong><br>' + cfg.body);
    chk.disabled = true;
  });

  /* the four reveal cards — one-way, so a flipped card stays flipped */
  s3State.flipped.forEach(function (on, i) {
    if (!on) return;
    var card = document.querySelector('#s3 .frc-card[data-index="' + i + '"]');
    if (!card || card.classList.contains('is-flipped')) return;
    card.classList.add('is-flipped');
    card.setAttribute('aria-expanded', 'true');
    card.querySelector('.frc-card-front')?.setAttribute('aria-hidden', 'true');
    card.querySelector('.frc-card-back')?.removeAttribute('aria-hidden');
  });

  s3UpdateGate();
}

/* GSTEPS — the guided worked example (s6/s8/s9/s11/s12). It reveals the correct option whatever
   the learner picked, so there is no learner answer to restore; only that it was answered. */
function paintGStep(sid) {
  var stp = GSTEPS[sid];
  if (!stp || !stp.answered || !document.getElementById(sid)) return;
  document.querySelectorAll('#' + sid + ' .s19-opt').forEach(function (o) {
    o.disabled = true;
    if (o.dataset.id === stp.correctId) o.classList.add('correct');
  });
  var cont = document.getElementById(sid + '-continue');
  if (cont) cont.disabled = false;
}

function paintS15() {
  if (!s15Done || !document.getElementById('s15')) return;
  var reveal = !screenWasCorrect('s15');
  document.querySelectorAll('#s15 .saq-row').forEach(function (row) {
    var id = row.dataset.id;
    var good = s15Picks[id] === S15_CORRECT[id];
    row.classList.add(good ? 'row-correct' : 'row-wrong');
    row.querySelectorAll('.saq-pill').forEach(function (pp) {
      var on = pp.dataset.val === (good ? s15Picks[id] : (reveal ? S15_CORRECT[id] : s15Picks[id]));
      pp.classList.toggle('selected', on);
      pp.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    if (reveal && !good) { row.classList.remove('row-wrong'); row.classList.add('row-revealed'); }
  });
  _lock('#s15 .saq-pill');
  showPopup('s15', reveal ? '#ffdbdc' : '#edf8ed',
            reveal ? 'זה לא מדויק, בואו נבין למה.' : 'כל הכבוד!', S15_BODY);
  _doneButton('s15');
  if (QPROG.s15) renderQprog('s15');
}

function paintS19() {
  var el = document.getElementById('s19-input');
  if (!s19Done || !el) return;
  var ok = screenWasCorrect('s19');
  el.disabled = true;
  el.classList.remove('error');
  el.classList.add('correct');
  showPopup('s19', ok ? '#edf8ed' : '#ffdbdc',
            ok ? 'כל הכבוד!' : 'זו טעות, בואו נלמד ממנה:',
            ok ? S19_BODY : S19_BODY.concat(['התשובה הנכונה היא 16 ס"מ.']));
  _doneButton('s19');
  if (QPROG.s19) renderQprog('s19');
}

function paintS20() {
  var L = document.getElementById('s20-left'), R = document.getElementById('s20-right');
  if (!s20Done || !L || !R) return;
  var ok = screenWasCorrect('s20');
  [L, R].forEach(function (el) { el.disabled = true; el.classList.remove('error'); el.classList.add('correct'); });
  showPopup('s20', ok ? '#edf8ed' : '#ffdbdc',
            ok ? 'כל הכבוד!' : 'זו טעות, בואו נלמד ממנה:',
            ok ? S20_BODY : S20_BODY.concat(['התשובה הנכונה היא <span dir="ltr">1 : 2</span>.']));
  _doneButton('s20');
  if (QPROG.s20) renderQprog('s20');
}

function paintS24() {
  if (!s24Done || !document.getElementById('s24')) return;
  var ok = screenWasCorrect('s24');
  ['s24a-num', 's24a-den', 's24b-left', 's24b-right'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.disabled = true; el.classList.remove('error'); el.classList.add('correct');
  });
  showPopup('s24', ok ? '#edf8ed' : '#ffdbdc',
            ok ? 'מצויין!' : 'זה לא מדויק, התשובה הנכונה מוצגת,<br>בואו נבין למה:',
            ok ? S24_BODY : S24_BODY.concat(['התשובה הנכונה היא <span dir="ltr">2 : 1</span>.']));
  _doneButton('s24');
  if (QPROG.s24) renderQprog('s24');
}

function paintSCQ(sid) {
  var q = SCQ[sid];
  if (!q || !q.done || !document.getElementById(sid)) return;
  var mark = function (id, cls) {
    var o = document.querySelector('#' + sid + ' .scq-opt[data-id="' + id + '"]');
    if (o) { o.classList.remove('selected'); o.classList.add(cls); }
  };
  mark(q.correctId, 'correct');
  if (q.selected && q.selected !== q.correctId) mark(q.selected, 'wrong');
  _lock('#' + sid + ' .scq-opt');
  var ok = q.selected === q.correctId;
  showPopup(sid, ok ? '#edf8ed' : '#ffdbdc', ok ? q.okTitle : q.badTitle, q.body);
  _doneButton(sid);
  if (QPROG[sid]) renderQprog(sid);
}

function paintMCQ(sid) {
  var q = MCQ[sid];
  if (!q || !q.answered || !document.getElementById(q.id)) return;
  var sel = '#' + q.id + ' ' + (q.optSelector || '.scq-opt');
  document.querySelectorAll(sel).forEach(function (o) {
    o.classList.remove('correct', 'wrong', 'selected');
    o.disabled = true;
  });
  /* honour whichever view the learner had open when they left */
  if (q.view === 'mine') {
    (q.learnerPicks || new Set()).forEach(function (id) {
      mcqMark(q, id, q.correctIds.has(id) ? 'correct' : 'wrong');
    });
  } else {
    q.correctIds.forEach(function (id) { mcqMark(q, id, 'correct'); });
  }
  var tog = document.getElementById(sid + '-answers-toggle');
  if (tog) {
    tog.classList.remove('hidden');
    tog.textContent = q.view === 'mine' ? 'הצגת התשובות הנכונות' : 'הצגת התשובות שלי';
  }
  if (q._popup) mcqShowPopup(q, q._popup);
  _doneButton(sid);
  if (QPROG[sid]) renderQprog(sid);
}

/* The generic engine — one painter for all 19 defQ() screens. Mirrors qCheck's final branch. */
function paintQ(sid) {
  var q = Q[sid];
  var scr = document.getElementById(sid);
  if (!q || !q.done || !scr) return;

  if (q.type === 'input') {
    /* Values are already back via applyResumeDom — and on a final wrong attempt those are the
       REVEALED answers, which is exactly what was on screen. Either way the box reads correct. */
    (q.inputs || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('error');
      el.classList.add('correct');
    });
  } else if (q.type === 'saq') {
    var reveal = !screenWasCorrect(sid) && qResults[sid] !== undefined;
    Object.keys(q.answers).forEach(function (k) {
      var row = scr.querySelector('.saq-row[data-id="' + k + '"]') ||
                scr.querySelector('[onclick*="\'' + k + '\'"]')?.closest('tr');
      if (!row) return;
      var good = q.picks && q.picks[k] === q.answers[k];
      row.classList.add(good ? 'row-correct' : 'row-wrong');
      var shown = good ? q.picks[k] : (reveal ? q.answers[k] : (q.picks ? q.picks[k] : null));
      row.querySelectorAll('.saq-pill').forEach(function (pp) {
        var on = pp.dataset.val === shown;
        pp.classList.toggle('selected', on);
        pp.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      if (reveal && !good) { row.classList.remove('row-wrong'); row.classList.add('row-revealed'); }
    });
  } else {
    var m = function (id, cls) {
      var o = scr.querySelector('.scq-opt[data-id="' + id + '"]');
      if (o) { o.classList.remove('selected'); o.classList.add(cls); }
    };
    m(q.answers, 'correct');
    if (q.selected && q.selected !== q.answers) m(q.selected, 'wrong');
  }

  _lock('.viq-input-box', scr);
  _lock('.saq-pill, .scq-opt', scr);
  /* restoreFeedback() re-opens Q's popup from q._popup, and resetScreenState() already called it */
  _doneButton(sid);
  if (QPROG[sid]) renderQprog(sid);
}

/* The dispatcher. A screen absent from here keeps no answer state of its own — the transitions,
   the narration screens of the guided example, and the finale. No `else`, no stub, no throw. */
function restoreScreenUI(n) {
  var sid = 's' + n;
  if (n === 1)  { paintS1();  return; }
  if (n === 2)  { paintS2();  return; }
  if (n === 3)  { paintS3();  return; }
  if (n === 15) { paintS15(); return; }
  if (n === 19) { paintS19(); return; }
  if (n === 20) { paintS20(); return; }
  if (n === 24) { paintS24(); return; }
  if (GSTEPS[sid]) { paintGStep(sid); return; }
  if (MCQ[sid])    { paintMCQ(sid);   return; }
  if (SCQ[sid])    { paintSCQ(sid);   return; }
  if (Q[sid])      { paintQ(sid);     return; }
}

/* ── the replay ────────────────────────────────────────────────────────
   Called by ../unit-js/50-loader.js on launch. The two-pass shape is deliberate: goTo() runs
   resetScreenState(n), and although this unit's version preserves a FINISHED question, it still
   re-runs s2Enter/s3Enter and the entry reset for anything not yet finished — so the variables
   are assigned again afterwards and only then painted.

   screenOverride: '#screen=N' in the URL wins over the document in choosing the SCREEN, never in
   restoring the STATE. Skipping the restore when a hash is present would lose qResults, from
   which the progress strips and any gate are derived. */
function applyExecutionState(st, screenOverride) {
  if (!st) return;
  _restoring = true;
  /* Replaying answers must not re-report them. The stub is held across goTo() too, which is what
     stops a resumed finale screen re-emitting the item, component and unit 'completed' — the
     library's one-per-page-load rule cannot help across a page load. */
  var _origSend = window.sendStatement720;
  window.sendStatement720 = function () {};
  try {
    applyResumeVars(st);
    /* Range-checked here rather than trusting goTo to reject: goTo() returns on an out-of-range
       screen and would leave currentScreen on its previous value, with the painter then drawing a
       different screen than the one shown. */
    var _n = (typeof screenOverride === 'number' && screenOverride >= 0 && screenOverride < TOTAL_SCREENS)
      ? screenOverride
      : ((typeof st.currentScreen === 'number') ? st.currentScreen : (window.PART_CONFIG ? window.PART_CONFIG.start : 0));
    goTo(_n);
    applyResumeVars(st);   /* undo anything the entry reset just cleared */
    applyResumeDom(st);    /* before the painter, which disables the inputs */
    restoreScreenUI(currentScreen);
  } catch (e) {
    console.error('[resume] apply', e);
  } finally {
    window.sendStatement720 = _origSend;
    _restoring = false;
  }
  /* xapiOnScreen() latched xapiCurrentItem during the stubbed goTo without emitting anything.
     Clearing the latch is what lets the resumed screen report its item 'initialized' exactly
     once — there is no prior item to close on a fresh page load. */
  xapiCurrentItem = null;
  try { xapiOnScreen(currentScreen); } catch (e) {}
}

/* ── scoring ───────────────────────────────────────────────────────────
   All derived from XAPI_Q_RESULTS, whose keys are '<item suffix>/<qKey>' — so an item's questions
   are simply the keys carrying that prefix, and this unit needs no separate question map.

   Why explicit results at all: the 720 library's own aggregation is an all-correct AND, which
   reports success:false for any partial pass. 0.6 is the threshold MOE's own example uses. */
var XAPI_PASS = 0.6;

function itemQuestionKeys(item) {
  return Object.keys(XAPI_Q_RESULTS).filter(function (k) { return k.indexOf(item + '/') === 0; });
}

/* Read by ../unit-js/20-xapi.js's xapiItemResult() through each script.js's XAPI_ITEM_RESULT.
   Returns null for an item with no graded question, which is the neutral value. */
function itemResultFor(item) {
  var keys = itemQuestionKeys(item);
  if (!keys.length) return null;
  var ok = keys.filter(function (k) { return XAPI_Q_RESULTS[k] === true; }).length;
  var scaled = ok / keys.length;
  return { success: scaled >= XAPI_PASS, score: { scaled: scaled } };
}

/* This component's result, across every graded question it reported. */
function partResult() {
  var keys = Object.keys(XAPI_Q_RESULTS);
  if (!keys.length) return null;
  var ok = keys.filter(function (k) { return XAPI_Q_RESULTS[k] === true; }).length;
  var scaled = ok / keys.length;
  return { success: scaled >= XAPI_PASS, score: { scaled: scaled } };
}

/* Where each component parks its score for the terminal component to average.
   ⚠️ These must be exactly RESULT_KEYS in ../unit-js/40-resume.js — the same keys, listed there
   so ?resetState clears their localStorage mirrors too. If they drift, a reset document sits
   beside a stale cache and the unit score comes back from a previous attempt. */
var UNIT_SCORE_KEYS = {
  'methodica-math-ratio-02-01': 'ratio02_c01_scaled',
  'methodica-math-ratio-02-02': 'ratio02_c02_scaled',
  'methodica-math-ratio-02-03': 'ratio02_c03_scaled',
  'methodica-math-ratio-02-04': 'ratio02_c04_scaled',
  'methodica-math-ratio-02-05': 'ratio02_c05_scaled'
};

function recordPartResult(res) {
  if (!res || typeof XAPI_COMP_SLUG === 'undefined') return;
  var key = UNIT_SCORE_KEYS[XAPI_COMP_SLUG];
  if (key) setUnitResult(key, String(res.score.scaled));
}

/* The mean of whatever component scores the document holds. A component the learner never
   finished simply does not contribute. */
function unitResult() {
  var vals = [];
  Object.keys(UNIT_SCORE_KEYS).forEach(function (slug) {
    var v = getUnitResult(UNIT_SCORE_KEYS[slug]);
    if (v === null || v === undefined || v === '') return;
    var num = Number(v);
    if (!isNaN(num)) vals.push(num);
  });
  if (!vals.length) return null;
  var scaled = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  return { success: scaled >= XAPI_PASS, score: { scaled: scaled } };
}

/* ── part boundaries ─────────────────────────────────────────────────── */

/* Hand over to the next component. The component 'completed' goes out BEFORE anything can branch
   or fail, so a learner who did not clear this component is still reported. */
function leaveToPart(destSlug, destFirstScreen) {
  var res = partResult();
  try { xapiCompleteComponent(res); } catch (e) {}
  try { recordPartResult(res); } catch (e) {}
  /* Moves the landing pointer to the destination and records the back edge. Without it the
     destination's loader sees a pointer still aimed here and hops the learner straight back — a
     ping-pong that re-sent 'completed' on every cycle.
     ⚠️ The THIRD argument is required in this unit: screens are numbered unit-wide, so seeding a
     never-visited destination with 0 would make its applyExecutionState call goTo(0), which the
     null-screen guard turns into a silent no-op. */
  try { writeForwardState(destSlug, '#screen=' + currentScreen, destFirstScreen); } catch (e) {}
  /* explicit index.html — file:// has no default document */
  window.location.replace('../' + destSlug + '/index.html' + window.location.search);
}

/* The learner finished the unit's last screen. There is no forward hop to carry this component's
   'completed', so it goes here together with the unit's. Both are ledger-guarded, so re-reaching
   the finale after a reload re-sends neither. */
function finishUnit() {
  var res = partResult();
  /* recordPartResult FIRST: unitResult() reads the document this component just wrote. */
  try { recordPartResult(res); } catch (e) {}
  try { xapiCompleteComponent(res); } catch (e) {}
  try { xapiCompleteUnit(unitResult()); } catch (e) {}
  try { flushResumeSave(); } catch (e) {}
}

/* Puts a first-time learner on this component's own first screen. The landing screen is otherwise
   decided by the resume document: 50-loader.js reads it AFTER partBoot() has run and, when this
   component has a saved payload, applyExecutionState() navigates again.

   This also closes a gap that predates resume: main.js had no DOMContentLoaded handler and never
   called goTo() at load, so the markup's own .active screen was shown without resetScreenState()
   ever running for it — no s2Enter/s3Enter, no character image swap, no renderQprog, no
   restoreFeedback. */
function partBoot() {
  goTo(window.PART_CONFIG ? window.PART_CONFIG.start : 0);
}


/* ═══════════════════════════════════════════════════════════════════
   xAPI — how a call site names the question it is reporting

   ── Why the item is NOT in this map ──
   It comes from SCREEN_TO_SUBCONTENT, per component, so an xAPI statement and a learner problem
   report can never disagree about where the learner was standing. This map only says which
   CATALOGUE QUESTION a given answer belongs to.

   One map serves all five components: xapiKeyFor() returns null when SCREEN_TO_SUBCONTENT has no
   entry for that screen, so the other components' rows are inert rather than wrong.

   ── Keys are logical answers, not screens ──
   Several screens carry more than one catalogue question (s24 has two, s26 three, s28 two), and
   conversely the AI table is ONE catalogue question spread over three screens. So a key is
   '<screen><row>' where it has to be.

   Question numbers are the catalogue's own — verified against metadata/*.json question order:
     part 01  002/q5 is the four reveal cards, which are not graded, so s3q5 reports q6
     part 03  004/q1..q3 are the three ratio rows of s26, 004/q4 is the s27 matching
     part 04  002/q1 is the whole AI table: s33, s34 and s35 are its three rows
   ═══════════════════════════════════════════════════════════════════ */
var XAPI_QMAP = {
  /* part 01 */
  s1:    [1,  'q1'],
  s3q1:  [3,  'q1'], s3q2: [3, 'q2'], s3q3: [3, 'q3'], s3q4: [3, 'q4'], s3q5: [3, 'q6'],
  /* part 02 */
  s15:   [15, 'q1'], s16: [16, 'q2'],
  s17:   [17, 'q1'],
  s18:   [18, 'q1'],
  s19:   [19, 'q1'], s20: [20, 'q2'],
  /* part 03 */
  s22:   [22, 'q1'],
  s23:   [23, 'q1'],
  s24a:  [24, 'q1'], s24b: [24, 'q2'],
  s26r0: [26, 'q1'], s26r1: [26, 'q2'], s26r2: [26, 'q3'], s27: [27, 'q4'],
  s28r0: [28, 'q1'], s28r1: [28, 'q2'], s29: [29, 'q3'],
  /* part 04 */
  s31:   [31, 'q1'], s32: [32, 'q2'],
  s33:   [33, 'q1'], s34: [34, 'q1'], s35: [35, 'q1'],
  s36:   [36, 'q1'], s37: [37, 'q2'],
  /* part 05 */
  s41:   [41, 'q1'], s42: [42, 'q2'], s43: [43, 'q3'], s44: [44, 'q4'],
  s45:   [45, 'q5'], s46: [46, 'q6'], s48: [48, 'q7'], s49: [49, 'q8']
};

function xapiKeyFor(key) {
  var e = XAPI_QMAP[key];
  if (!e) return null;
  var m = (typeof SCREEN_TO_SUBCONTENT !== 'undefined') ? SCREEN_TO_SUBCONTENT[e[0]] : null;
  if (!m) return null;                     /* another component's screen */
  return { item: m[0], qKey: e[1] };
}

/* Screen-level lookup, for the hint button — a hint belongs to the screen, not to one row. */
function xapiScreenKey(sid) {
  var n = parseInt(String(sid).replace(/\D/g, ''), 10);
  var keys = Object.keys(XAPI_QMAP);
  for (var i = 0; i < keys.length; i++) {
    if (XAPI_QMAP[keys[i]][0] === n) return xapiKeyFor(keys[i]);
  }
  return null;
}

/* Is this the LAST question of its item? Drives 'answered.last' vs 'answered', so it must be the
   item's real question count — DERIVED from the metadata, never hardcoded at the call site. A
   hardcoded true would emit 'answered.last' on q1 of a two-question item and never on q2, which is
   exactly what a first pass at this did. */
function _xapiIsLastQuestion(item, qKey) {
  try {
    var sc = (window.METADATA && window.METADATA.subContent) || [];
    for (var i = 0; i < sc.length; i++) {
      var id = String(sc[i].id).replace(/\/+$/, '');
      if (id.slice(-(item.length + 1)) !== '-' + item) continue;
      return qKey === 'q' + ((sc[i].questions || []).length);
    }
  } catch (e) {}
  return false;
}

/* Every reporting call site in this file goes through here. ⚠️ Swallowing on purpose: a reporting
   failure must never stop the learner. XAPI_Q_RESULTS is written by xapiAnswered on its first
   line, outside its own gate and try, so the score survives even with reporting off. */
function xapiReport(key, correct, answer) {
  var k = xapiKeyFor(key);
  if (!k) return;
  try { xapiAnswered(k.item, k.qKey, correct, _xapiIsLastQuestion(k.item, k.qKey), answer); }
  catch (e) {}
}

function xapiHint(sid) {
  var k = xapiScreenKey(sid);
  if (!k) return;
  try { xapiRequestedHint(k.item, k.qKey); } catch (e) {}
}

/* The AI table (part 04, item 002) is ONE catalogue question over screens 33/34/35. Reporting each
   screen as q1 would overwrite XAPI_Q_RESULTS three times and leave the last row's verdict standing
   for the whole question. Instead: report once, when the third row is answered, with the AND. */
var _aiRows = ['s33', 's34', 's35'];

/* ⚠️ currentSid/currentOk are passed in because this runs BEFORE qFinish — at that moment the
   row being answered has neither its `done` flag nor its qResults entry yet, so reading them
   would make the third row look unanswered and the question would never be reported at all. */
function xapiReportAiTable(currentSid, currentOk) {
  var verdicts = _aiRows.map(function (s) {
    if (s === currentSid) return !!currentOk;
    if (Q[s] && Q[s].done) return qResults[s] === true;
    return null;                                   /* still unanswered */
  });
  if (verdicts.indexOf(null) !== -1) return;       /* wait for the last row */
  var answer = _aiRows.map(function (s) {
    return Object.keys(Q[s].answers).map(function (r) {
      return r + ':' + (Q[s].picks ? Q[s].picks[r] : '');
    }).join('');
  }).join(' | ');
  xapiReport('s33', verdicts.every(Boolean), answer);
}
