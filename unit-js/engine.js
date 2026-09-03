/* =====================================================================
   720-core — screen engine (shared across all units; vendored per unit)
   Per 720-templates references/_global-components.md.

   The unit must define BEFORE this file runs (js/unit.js):
     TOTAL_SCREENS        — number of screens
     resetScreenState(n)  — per-screen restore hook
   Optional: quizBuildScreens() from quiz-engine.js (auto-called if present).
   ===================================================================== */

'use strict';

let currentScreen = 0;
document.addEventListener('DOMContentLoaded', () => {
  if (window.PART_CONFIG && window.PART_CONFIG.start > 0) goTo(window.PART_CONFIG.start);
  else if (window.Motion) Motion.reveal(document.querySelector('.screen.active'));
});

/* ---------- Canvas scaling (1280×710) ---------- */
function scaleApp() {
  const app = document.getElementById('app');
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 710);
  app.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', scaleApp);

/* ---------- Navigation ---------- */
function goTo(n) {
  /* Part mode (5-component delivery architecture, per approved units):
     window.PART_CONFIG = { start, end, next | (routeByScore + nextPass/nextFail) }.
     Navigating past the part's last screen routes to the next part app. */
  if (window.PART_CONFIG) {
    if (n > window.PART_CONFIG.end) { if (typeof goToNextPart === 'function') goToNextPart(); return; }
    if (n < window.PART_CONFIG.start) return;
  }
  if (n < 0 || n >= TOTAL_SCREENS) return;
  // Close all feedback popups and hint overlays before the screen swap
  document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
    .forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.applet-embed.is-zoomed').forEach(el => el.classList.remove('is-zoomed'));
  const prev = document.querySelector('.screen.active');
  if (window.Motion && prev) Motion.cancel(prev);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.screen[data-screen="${n}"]`);
  if (!target) return;
  target.classList.add('active');
  if (window.Motion) Motion.reveal(target);
  currentScreen = n;
  resetScreenState(n);
  if (typeof decorateBubbles === 'function') decorateBubbles(target);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') goTo(currentScreen + 1);  // RTL: left = forward
  if (e.key === 'ArrowRight') goTo(currentScreen - 1);
  if (e.key === 'Escape' && typeof quizCloseHint === 'function') quizCloseHint();
});

/* Dev bridge for index_dev.html */
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'goto' && typeof e.data.screen === 'number') {
    goTo(e.data.screen);
  }
});

/* ---------- Applet fullscreen zoom (in place — state persists) ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-applet-toggle]');
  if (!btn) return;
  btn.closest('.applet-embed').classList.toggle('is-zoomed', btn.dataset.appletToggle === 'open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.applet-embed.is-zoomed').forEach(el => el.classList.remove('is-zoomed'));
  }
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof quizBuildScreens === 'function') quizBuildScreens();
  scaleApp();
  goTo(0);
});
