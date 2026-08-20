/* methodica-math-ratio-01-02 — engine vendored from ratio-01-01
   (percent-02 lineage, approved behaviors). Built maven-first. */

window.lomdaState = { selectedCharacter: null };
const CHARACTER_STORAGE_KEY = 'methodica_math_ratio_01_02_selectedCharacter';
const TOTAL_SCREENS = 52; // slides 2-63: learning, guided, practice A/B/C, advanced, peak question, finale
let currentScreen = 0;

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
window.addEventListener('resize', scaleApp);
scaleApp();


/* ─── Navigation ────────────────────────────────────────── */
function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
    .forEach(el => el.classList.add('hidden'));
  const prev = document.querySelector('.screen.active');
  if (prev) prev.classList.remove('active');
  currentScreen = n;
  const next = document.getElementById('s' + n);
  if (next) next.classList.add('active');
  resetScreenState(n);
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'DEV_SCREEN', screen: n }, '*');
  }
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
}

/* Re-entering a question screen must never show a stale popup or stale
   marks: unfinished questions reset completely, finished ones keep their
   resolved state but start with the popup closed. */
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
    document.getElementById('s1-popup-title').textContent = ok ? 'כל הכבוד!' : 'זה לא מדוייק.';
    document.getElementById('s1-popup-body').innerHTML = S1_BODY.map(x => '<p>' + x + '</p>').join('');
    popup.classList.remove('hidden');
  }
  s1Done = true;
  const chk = document.getElementById('s1-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
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
function s3UpdateGate() {
  const btn = document.getElementById('s3-continue');
  if (!btn) return;
  btn.disabled = !(s3State.scrolledEnd && s3State.q1 && s3State.q2 &&
                   s3State.q3 && s3State.q4 && s3State.q5 &&
                   s3State.flipped.every(Boolean));
}
document.getElementById('s3-scroll')?.addEventListener('scroll', function () {
  if (s3State.scrolledEnd) return;
  if (this.scrollTop + this.clientHeight >= this.scrollHeight - 24) {
    s3State.scrolledEnd = true;
    s3UpdateGate();
  }
});
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
  const finish = () => {
    s3State.q1 = true;
    opts.forEach(o => { o.disabled = true; });
    document.getElementById('s3q1-check').disabled = true;
    s3UpdateGate();
  };
  if (isCorrect) {
    opts.forEach(o => { if (S3Q1_CORRECT.has(o.dataset.id)) { o.classList.remove('selected'); o.classList.add('correct'); } });
    s3Feedback('s3q1-feedback', true, '<strong>כל הכבוד!</strong><br>' + S3Q1_EXPLAIN);
    finish();
  } else if (s3q1Attempts >= 2) {
    opts.forEach(o => {
      o.classList.remove('selected');
      if (S3Q1_CORRECT.has(o.dataset.id)) o.classList.add('correct');
      else if (s3q1Selected.has(o.dataset.id)) o.classList.add('wrong');
    });
    s3Feedback('s3q1-feedback', false, '<strong>זה לא מדוייק.</strong><br>' + S3Q1_EXPLAIN);
    finish();
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
  s3State.q2 = true;
  left.disabled = true; right.disabled = true;
  left.classList.add(ok ? 'correct' : 'error');
  right.classList.add(ok ? 'correct' : 'error');
  if (!ok) { left.value = 1; right.value = 4; left.classList.add('correct'); right.classList.add('correct'); }
  s3Feedback('s3q2-feedback', ok,
    '<strong>' + (ok ? 'כל הכבוד!' : 'זה לא מדוייק.') + '</strong><br>' + S3Q2_EXPLAIN +
    (ok ? '' : '<br>התשובה הנכונה היא <span dir="ltr"><strong>1 : 4</strong></span>'));
  document.getElementById('s3q2-check').disabled = true;
  s3UpdateGate();
}

/* §7/§8/§10 — single-attempt yes/no checks (slides 11, 12, 15) */
const S3_YESNO = {
  s3q3: { correct: 'b', flag: 'q3',
          ok: 'כל הכבוד!', bad: 'זה לא מדויק.',
          body: 'היחס של הגביע האמיתי לא נשמר, תיכף נבין למה.' },
  s3q4: { correct: 'a', flag: 'q4',
          ok: 'כל הכבוד!', bad: 'זה לא מדוייק.',
          body: 'היחס של הגביע האמיתי נשמר, תיכף נבין למה.' },
  s3q5: { correct: 'b', flag: 'q5',
          ok: 'נכון!', bad: 'זו טעות, בואו נבין למה:',
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
QPROG.s41 = { set: 'E', idx: 0 }; QPROG.s42 = { set: 'E', idx: 0 };
QPROG.s43 = { set: 'E', idx: 1 }; QPROG.s44 = { set: 'E', idx: 1 };
QPROG.s45 = { set: 'E', idx: 2 }; QPROG.s46 = { set: 'E', idx: 3 };
QPROG.s48 = { set: 'E', idx: 4 }; QPROG.s49 = { set: 'E', idx: 5 };
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
    wrong2:  { bg: '#ffdbdc', title: 'זה לא מדוייק.', body: ['התשובות הנכונות מסומנות.'] },
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

function mcqShowPopup(q, type) {
  const popup = document.getElementById(q.id + '-popup');
  if (!popup) return;
  const cfg = q.popups[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  document.getElementById(q.id + '-popup-title').textContent = cfg.title;
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
  q.answered = true;
  q.done = true;
  document.querySelectorAll('#' + q.id + ' ' + (q.optSelector || '.scq-opt')).forEach(o => { o.disabled = true; });
  const chk = document.getElementById(q.id + '-check');
  if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
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
  popup.style.background = bg;
  resetPopupPosition(popup);
  document.getElementById(sid + '-popup-title').textContent = title;
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
    q.done = true;
    document.querySelectorAll('#' + sid + ' .scq-opt').forEach(o => { o.disabled = true; });
    const chk = document.getElementById(sid + '-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton(sid);
    setQResult(sid, wasOk);
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
    s15Done = true;
    document.querySelectorAll('#s15 .saq-pill').forEach(pp => { pp.disabled = true; });
    const chk = document.getElementById('s15-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s15');
    setQResult('s15', wasOk);
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
  okTitle: 'זה נכון מאוד!', badTitle: 'זו טעות, בואו נבין למה:',
  body: ['1. היחס לא נשמר, כי נוספו רק ריבועי עוגה עם סוכריות. היחס החדש הוא <span dir="ltr">20 : 42</span> (בצמצום <span dir="ltr">10 : 21</span>) והוא שונה מ-<span dir="ltr">3 : 7</span>.',
         '2. היחס לא נשמר, כי רק מספר ריבועי העוגה עם הסוכריות הוכפל. היחס החדש הוא <span dir="ltr">36 : 42</span> (בצמצום <span dir="ltr">6 : 7</span>) והוא שונה מ-<span dir="ltr">3 : 7</span>.',
         '3. היחס נשמר ונשאר לאחר צמצום <span dir="ltr">3 : 7</span>, כי גם מספר ריבועי העוגה עם הסוכריות וגם מספר ריבועי העוגה הכולל גדלו פי 2.'] };
SCQ.s17 = { correctId: 'c', selected: null, attempts: 0, done: false, lastWrong: null,
  okTitle: 'מצוין!', badTitle: 'זה לא מדוייק, בואו נבין למה:',
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
  popups: mcqCfg('נכון!', 'זה לא מדויק, בואו נבין למה.', [
    'היגדים 1 ו-2 נכונים:',
    '1. <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">7</span></span> מאורך הסרטון מורכבים מקטעי וידאו מצולמים, ולכן החלק שנותר לאנימציה הוא <span class="frac" dir="ltr"><span class="frac-num">4</span><span class="frac-den">7</span></span>.',
    '2. היחס בין זמן האנימציה לזמן קטעי הוידאו הוא <span class="frac" dir="ltr"><span class="frac-num">4</span><span class="frac-den">7</span></span> : <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">7</span></span>, ולאחר צמצום מתקבל היחס <span dir="ltr">4 : 3</span>.']) };
MCQ.s22 = { id: 's22', correctIds: new Set(['a', 'b', 'c']), maxAttempts: 2,
  selected: new Set(), attempts: 0, answered: false, done: false, lastWrong: null,
  popups: mcqCfg('יפה!', 'זה לא מדוייק, בואו נבין למה:', [
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
  popups: mcqCfg('כל הכבוד, זה נכון!', 'זה לא מדוייק, בואו נבין למה:', [
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
    s19Done = true; el.disabled = true;
    const chk = document.getElementById('s19-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s19'); setQResult('s19', wasOk);
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
    s20Done = true; L.disabled = true; R.disabled = true;
    const chk = document.getElementById('s20-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s20'); setQResult('s20', wasOk);
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
    s24Done = true;
    ids.forEach(id => { document.getElementById(id).disabled = true; });
    const chk = document.getElementById('s24-check');
    if (chk) { setNavLabel(chk, 'שנמשיך?'); chk.disabled = false; }
    hideHintButton('s24'); setQResult('s24', wasOk);
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
    showPopup('s24', '#ffdbdc', 'זה לא מדוייק, בואו נבין למה:', S24_BODY.concat(['התשובה הנכונה היא <span dir="ltr">2 : 1</span>.']));
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
}
function qCheck(sid) {
  const q = Q[sid];
  if (!q) return;
  if (q.done) { advanceScreen(); return; }
  const scr = document.getElementById(sid);
  let ok, snapshot;
  if (q.type === 'input') {
    const vals = q.inputs.map(id => document.getElementById(id).value.trim());
    if (vals.some(v => v === '')) return;
    snapshot = JSON.stringify(vals);
    const each = vals.map((v, i) => qNum(v) === q.answers[i]);
    ok = each.every(Boolean);
    q.attempts++;
    if (ok || q.attempts >= 2) {
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
      if (!good && (ok || q.attempts >= 2)) {
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
    else { mark(q.selected, 'wrong'); if (q.attempts >= 2) mark(q.answers, 'correct'); }
  }
  if (ok) { showPopup(sid, '#edf8ed', q.ok, q.body); qFinish(sid, true); }
  else if (q.attempts >= 2) { showPopup(sid, '#ffdbdc', q.bad, q.body.concat(q.reveal || [])); qFinish(sid, false); }
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
  ok: 'מצויין!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['1. היחס בין משקל החלבון למשקל הפחמימות ביחידה אחת הוא <span class="ratio">1.3 : 10</span>.',
         '2. היחס בין משקל השומן למשקל הפחמימות הוא <span class="ratio">2 : 10</span>, ולאחר צמצום הוא <span class="ratio">1 : 5</span>.',
         '3. משקל כל המרכיבים ביחידה אחת הוא 20 גרם, ולכן היחס בין משקל השומן למשקל הכולל הוא <span class="ratio">2 : 20</span> ולאחר צמצום נקבל <span class="ratio">1 : 10</span>.'] });
defQ('s27', { type: 'saq', answers: { a: 'no', b: 'yes', c: 'yes' },
  ok: 'זו תשובה נכונה מאוד!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['היגדים 2 ו-3 נכונים:',
         'משקל הפחמימות הוא 10 גרם ומשקל השומן הוא 2 גרם, לכן משקל הפחמימות גדול פי 5 ממשקל השומן.',
         'היחס בין משקל הסוכרים ב-100 גרם לבין משקל הסוכרים ב-20 גרם הוא <span class="ratio">6.7 : 1.3</span>, ולאחר צמצום מתקבל בערך היחס <span class="ratio">5 : 1</span>.',
         'ב-100 גרם יש 23 מ"ג נתרן, לכן ב-150 גרם יש 34.5 מ"ג (פי 1.5).'] });
defQ('s28', { type: 'input', inputs: ['s28-0a','s28-0b','s28-1a','s28-1b'], answers: [5, 3, 5, 8],
  ok: 'תשובה נכונה!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['1. כל המשולשים זהים ולכן הם שווי שטח. יש 10 משולשים אפורים ו-6 משולשים בצבע תכלת, לכן היחס בין השטח האפור לשטח התכלת הוא <span class="ratio">10 : 6</span> ואם נצמצם נקבל <span class="ratio">5 : 3</span>.',
         '2. יש 10 משולשים אפורים ו-16 משולשים סה"כ במשולש הגדול. היחס בין השטח האפור לשטח המשולש הגדול הוא <span class="ratio">10 : 16</span> ואם נצמצם נקבל <span class="ratio">5 : 8</span>.'] });
defQ('s29', { type: 'saq', answers: { a: 'no', b: 'yes' },
  ok: 'כל הכבוד!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['1. היחס בין השטח האפור לבין השטח בצבע תכלת לאחר ההוספה של המשולשים הוא <span class="ratio">15 : 10</span>. אם נצמצם ב-5 נקבל שהיחס הוא <span class="ratio">3 : 2</span> — היחס לא נשמר.',
         '2. הכפלנו פי אותו מספר את כמות המשולשים האפורים ואת כמות המשולשים בצבע תכלת, לכן היחס נשמר.'] });

/* ── advanced set (slides 43-49) ── */
defQ('s31', { type: 'input', inputs: ['s31-ang','s31-r1','s31-r2','s31-r3'], answers: [20, 2, 3, 13],
  ok: 'זה מדוייק!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['סכום הזוויות במשולש הוא 180°. נחשב את הזווית השלישית: 180° - 130° - 30° = 20°.',
         'היחס בין שלושת הזוויות הוא <span class="ratio">20 : 30 : 130</span>, ולאחר צמצום ב-10 נקבל <span class="ratio">2 : 3 : 13</span>.'] });
defQ('s32', { type: 'input', inputs: ['s32-a1','s32-a2','s32-r1','s32-r2','s32-r3'], answers: [70, 70, 4, 7, 7],
  ok: 'מעולה!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['המשולש הוא שווה שוקיים ולכן 2 הזוויות שנותרו שוות: 180° - 40° = 140°, ו-140° : 2 = 70°.',
         'היחס בין שלושת הזוויות הוא <span class="ratio">40 : 70 : 70</span>. נצמצם ב-10 ונקבל <span class="ratio">4 : 7 : 7</span>.'] });
const AI_BODY = ['המשמעות של יחס <span class="ratio">1 : 1</span> היא שכמות המרואיינים שהשתמשו כל יום ב-AI היא <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">2</span></span> מכלל המרואיינים, כלומר — <span dir="ltr">4,750 : 2 = 2,375</span>. לכן המסקנה נכונה.'];
/* keys on the AI table follow the deck's FEEDBACK text, which states the
   verdict and the arithmetic for each row (producer 20.08: restore). The
   96px BadgeTick graphics on slides 45-47 overlap rows/columns and
   contradict that text on row 1 — they are not the key here. */
defQ('s33', { type: 'saq', answers: { a: 'yes' }, ok: 'יפה מאוד!', bad: 'זה לא מדוייק, בואו נבין למה:', body: AI_BODY });
defQ('s34', { type: 'saq', answers: { b: 'yes' }, ok: 'יפה מאוד!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['אם היחס הוא <span class="ratio">13 : 7</span>, אז <span class="frac" dir="ltr"><span class="frac-num">7</span><span class="frac-den">20</span></span> מהמרואיינים חושבים שהשימוש ב-AI לא הפך אותם ליותר יעילים. <span class="frac" dir="ltr"><span class="frac-num">7</span><span class="frac-den">20</span></span> זה כמעט <span class="frac" dir="ltr"><span class="frac-num">1</span><span class="frac-den">3</span></span>. לכן המסקנה נכונה.'] });
defQ('s35', { type: 'saq', answers: { c: 'no' }, ok: 'יפה מאוד!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['היחס הוא <span class="ratio">2 : 3</span>, כלומר <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">5</span></span> מהמרואיינים חשבו שאין צורך בכישורים מיוחדים, וזה יותר מחצי מהם. לכן המסקנה אינה נכונה.'] });
defQ('s36', { type: 'scq', answers: 'b', ok: 'נכון!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['בתחילת המשחק היחס בין מספר הקלפים של טליה למספר הקלפים של יוני היה <span class="ratio">1 : 1</span>. המשמעות היא שעל כל קלף של טליה יש קלף אחד של יוני — כלומר מספר הקלפים היה שווה.'] });
defQ('s37', { type: 'input', inputs: ['s37-in'], answers: [2], ok: 'מצוין!', bad: 'זה לא מדוייק, בואו נבין למה:',
  body: ['בסוף המשחק היחס בין מספר הקלפים של טליה למספר הקלפים של יוני היה <span class="ratio">6 : 3</span>. נצמצם ונקבל <span class="ratio">2 : 1</span> — כלומר לטליה יש פי 2 קלפים מיוני.'] });

/* ── peak question: the concert (slides 53-61) ── */
defQ('s41', { type: 'input', inputs: ['s41-num','s41-den'], answers: [3, 5],
  ok: 'זה נכון!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['היחס בין מספר הכרטיסים המוזלים לבין סך כל הכרטיסים הוא <span class="ratio">3 : 5</span>, ולכן כשבר פשוט הוא <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">5</span></span>.'] });
defQ('s42', { type: 'input', inputs: ['s42-in'], answers: [5], ok: 'זה נכון!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['המשמעות של יחס <span class="ratio">3 : 5</span> היא שעל כל 3 כרטיסים שנמכרו במחיר מלא, נמכרו 5 כרטיסים במחיר מוזל.'] });
defQ('s43', { type: 'input', inputs: ['s43-a','s43-b'], answers: [2, 3], ok: 'זה נכון!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['היחס בכתיב מתמטי הוא <span class="ratio">120 : 180</span>. נצמצם ונקבל יחס <span class="ratio">2 : 3</span>.'] });
defQ('s44', { type: 'input', inputs: ['s44-a','s44-b'], answers: [2, 3], ok: 'מצוין!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['היחס המצומצם הוא <span class="ratio">2 : 3</span>. המשמעות היא שעל כל 2 כרטיסים במחיר מלא שנמכרו, נמכרו 3 כרטיסים מוזלים.'] });
defQ('s45', { type: 'scq', answers: 'b', ok: 'מצוין!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['היחס המתוכנן היה <span class="ratio">3 : 5</span>, ולאחר המכירה היחס בפועל היה <span class="ratio">2 : 3</span>. לכן, היחס לא נשמר.'] });
defQ('s46', { type: 'input', inputs: ['s46-a','s46-b'], answers: [1, 10], ok: 'זה נכון מאוד!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['נשמרו 40 כרטיסים לנגנים, זמרים ואנשי צוות, מתוך 400 כרטיסים סך הכל. היחס הוא <span class="ratio">40 : 400</span> ולאחר צמצום <span class="ratio">1 : 10</span>.'] });
defQ('s48', { type: 'scq', answers: 'a', ok: 'נכון!', bad: 'זו טעות, בואו נבין למה:',
  body: ['נמכרו 180 כרטיסים במחיר מוזל ועוד 120 כרטיסים במחיר מלא, סה"כ 300 כרטיסים מתוך 400 מושבים באולם. כלומר <span class="frac" dir="ltr"><span class="frac-num">3</span><span class="frac-den">4</span></span> מהכרטיסים נמכרו במחיר מלא ומוזל. המסקנה: הדר צודקת.'] });
defQ('s49', { type: 'scq', answers: 'a', ok: 'נכון!', bad: 'זה לא מדוייק, הנה התשובה הנכונה:',
  body: ['מחיר כרטיס מלא הוא פי 2 ממחיר כרטיס מוזל. לעומת זאת, היחס בין כמות הכרטיסים המוזלים לכמות הכרטיסים במחיר מלא הוא <span class="ratio">3 : 2</span>, ולכן עומר צודק.',
         'ההכנסה מהכרטיסים המוזלים: 180 · 20 = 3,600 ש"ח. ההכנסה מהכרטיסים במחיר מלא: 120 · 40 = 4,800 ש"ח.',
         'לכן ההכנסה מהכרטיסים במחיר מלא הייתה גבוהה יותר למרות שמספרם נמוך יותר.'] });

['s26','s27','s28','s29','s31','s32','s33','s34','s35','s36','s37',
 's41','s42','s43','s44','s45','s46','s48','s49'].forEach(sid => {
  window[sid + 'Check'] = function () { qCheck(sid); };
});

/* ═══════════════════════════════════════════════════════════
   REPORT MODAL — "מצאתם בעיה?" (template-library/ReportModal —
   approved 09.08; same behavior in all 720 projects). Sends to the
   shared Google Form; unit/component IDs inlined until metadata files
   exist (then switch to window.METADATA like the reference).
   ═══════════════════════════════════════════════════════════ */
function shortId(u){ return String(u || '').split('/').pop(); }

var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse';

/* screen -> [subContent suffix, page-in-item]; null = no matching subContent.
   No metadata authored for ratio-01 yet — the report carries the raw
   screen number as the page reference. */
var SCREEN_TO_SUBCONTENT = { 0: null, 1: null };

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
    learningUnitId: 'methodica-math-ratio-01',
    id: 'methodica-math-ratio-01-02',
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
(function wireReport() {
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
})();


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
