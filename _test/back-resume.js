/* Back / resume fidelity — every question screen of the unit (2026-10-07).
 *
 * For each question screen: answer it through its own controls (two different wrong answers, so it
 * ends in its final state), snapshot the whole screen (visibility, classes, disabled, text, values,
 * the feedback popup's position and colour), go forward and click the next screen's real "חזרה"
 * (on a part's last screen: back one screen and forward again), snapshot; then restore the saved
 * payload into a fresh page (applyExecutionState = resume) and snapshot. All three must match.
 * Born from the team head's question (07.10.26). On the code before the fix 8 of 35 screens
 * failed: the feedback popup missing after "חזרה" on s1/s15/s16/s17/s19/s20/s24, s15's resumed
 * title, s11's wrong pick and the multi-select wrong picks lost on resume.
 *
 *   NODE_PATH=/tmp/lomda-test/node_modules node _test/back-resume.js
 *
 * Needs puppeteer-core and a local Chrome. Exit 1 on any difference.
 */
// payload into a fresh page (resume), snapshot; report every difference.
// Usage: node backaudit.js <repoRoot|baseUrl> <prefix e.g. methodica-math-ratio-02> [comp] [mode=wrong|right]
const path = require('path'), fs = require('fs'), http = require('http'), puppeteer = require('puppeteer-core');
const SRC = process.argv[2] || path.resolve(__dirname, '..');
const PREFIX = process.argv[3] || fs.readdirSync(SRC).find((d) => /-01$/.test(d)).replace(/-01$/, '');
const ONLY = process.argv[4], MODE = process.argv[5] || 'wrong';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.webp': 'image/webp', '.gif': 'image/gif' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isUrl = /^https?:/.test(SRC);
const server = isUrl ? null : http.createServer((q, r) => { const f = path.join(SRC, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

const SNAP = () => {
  const sc = document.querySelector('.screen.active'); if (!sc) return null;
  const vis = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && !e.hidden && e.getClientRects().length > 0; };
  const out = {};
  const els = [...sc.querySelectorAll('*')];
  // popups/overlays that belong to this screen but may live elsewhere
  document.querySelectorAll('[id^="' + sc.id + '-"]').forEach((e) => { if (!sc.contains(e)) els.push(e); });
  const seen = new Map();
  for (const e of els) {
    if (e.closest('svg') && e.tagName !== 'svg') continue;
    const base = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.dataset && e.dataset.id ? '[' + e.dataset.id + ']' : '');
    const n = (seen.get(base) || 0); seen.set(base, n + 1);
    const key = base + (e.id ? '' : ':' + n);
    const v = vis(e);
    if (!v && !e.id) continue;
    const cls = [...e.classList].filter((c) => !/anim|is-visible|visible-anim|fade|show-anim/.test(c)).sort().join('.');
    const rec = { v, cls };
    if (v) {
      if ('disabled' in e) rec.dis = !!e.disabled;
      if (e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA') { rec.val = e.value; rec.ro = !!e.readOnly; }
      if (!e.children.length || e.tagName === 'BUTTON') rec.txt = (e.innerText || '').trim().slice(0, 80);
      if (/popup|feed/i.test(e.id || '') && !/title|body/.test(e.id || '')) { const r = e.getBoundingClientRect(); rec.pos = [Math.round(r.left), Math.round(r.top)]; rec.bg = getComputedStyle(e).backgroundColor; }
    }
    out[key] = rec;
  }
  return out;
};

function diff(a, b) {
  const d = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const x = (a || {})[k], y = (b || {})[k];
    if (!x || !y) { if ((x && x.v) || (y && y.v)) d.push(k + ': ' + (x ? 'only before' : 'only after') + ' ' + JSON.stringify(x || y)); continue; }
    if (!x.v && !y.v) continue;
    for (const f of ['v', 'cls', 'dis', 'val', 'ro', 'txt', 'pos', 'bg']) {
      if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) d.push(k + '.' + f + ': ' + JSON.stringify(x[f]) + ' -> ' + JSON.stringify(y[f]));
    }
  }
  return d;
}

/* Drive one question screen to its final-wrong state through its own controls. */
const ANSWER = async (mode) => {
  const S = (t) => new Promise((r) => setTimeout(r, t));
  const sc = document.querySelector('.screen.active');
  const vis = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && !e.hidden && e.getClientRects().length > 0; };
  const checks = () => [...sc.querySelectorAll('button')].filter((b) => /Check\(/.test(b.getAttribute('onclick') || '') && vis(b));
  const opts = [...sc.querySelectorAll('[onclick]')].filter((e) => /(Select|Toggle|Pick|gstepSelect|scqSelect|saqPick)\(/.test(e.getAttribute('onclick')) && vis(e));
  const inputs = [...sc.querySelectorAll('input:not([type=hidden]), textarea')].filter(vis);
  const log = [];
  for (let k = 0; k < 3; k++) {
    // inputs: two different wrong values
    inputs.forEach((i) => { i.value = String(97 + k); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    if (opts.length) {
      // group options by their handler name (a screen can hold several sub-questions)
      const groups = {};
      opts.forEach((o) => { const oc = o.getAttribute('onclick'); const args = [...oc.matchAll(/'([^']*)'/g)].map((m) => m[1]); const g = oc.replace(/\(.*$/, '') + '|' + args.slice(0, -1).join(','); (groups[g] = groups[g] || []).push(o); });
      for (const g of Object.values(groups)) {
        const toggle = /Toggle/.test(g[0].getAttribute('onclick'));
        if (toggle) { if (k > 0) g[(k - 1) % g.length].click(); g[k % g.length].click(); }
        else g[(g.length - 1 - k + g.length) % g.length].click();   // last option first: rarely the right one
        await S(60);
      }
    }
    const cs = checks().filter((b) => !b.disabled);
    if (!cs.length) { log.push('no enabled check at attempt ' + k); break; }
    const before = cs.map((b) => b.innerText.trim());
    cs.forEach((b) => b.click());
    await S(250);
    log.push('attempt ' + k + ': ' + before.join('/') + ' -> ' + checks().map((b) => b.innerText.trim() + (b.disabled ? '(dis)' : '')).join('/'));
    // finished when a check button now reads as "continue"
    const labels = checks().map((b) => b.innerText.trim());
    if (labels.some((l) => /שנמשיך|המשך|متابعة|سنكمل|نكمل/.test(l)) || !checks().length) break;
  }
  return log;
};

(async () => {
  let base = SRC;
  if (!isUrl) { await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  if (!base.endsWith('/')) base += '/';
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const comps = ONLY ? [ONLY] : ['01', '02', '03', '04', '05'];
  let total = 0, clean = 0;
  for (const c of comps) {
    const url = base + PREFIX + '-' + c + '/index.html';
    const ctx0 = await browser.createBrowserContext(); const p0 = await ctx0.newPage(); await p0.setViewport({ width: 1280, height: 720 });
    await p0.goto(url, { waitUntil: 'networkidle0' });
    const qscreens = await p0.evaluate(() => [...document.querySelectorAll('.screen')].filter((s) => s.querySelector('button[onclick*="Check("]') || s.querySelector('[onclick*="gstepSelect("]')).map((s) => +s.dataset.screen));
    await ctx0.close();
    for (const n of qscreens) {
      total++;
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 1280, height: 720 });
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(url, { waitUntil: 'networkidle0' }); await sleep(300);
      await page.evaluate((n) => goTo(n), n); await sleep(400);
      const log = await page.evaluate(ANSWER, MODE);
      await sleep(300);
      const A = await page.evaluate(SNAP);
      // forward, then the next screen's real "חזרה"
      const fwd = await page.evaluate(async (n) => {
        if (window.PART_CONFIG && n === window.PART_CONFIG.end) {   // last screen: forward would END the part
          goBack(); await new Promise((r) => setTimeout(r, 300));
          goTo(n); await new Promise((r) => setTimeout(r, 400));
          return 'last screen: back to ' + (n - 1) + ' and forward -> ' + currentScreen;
        }
        goTo(n + 1); await new Promise((r) => setTimeout(r, 300));
        const sc = document.querySelector('.screen.active');
        if (!sc || +sc.dataset.screen !== n + 1) return 'no screen ' + (n + 1);
        const back = [...sc.querySelectorAll('button')].find((b) => /goBack\(|goTo\(/.test(b.getAttribute('onclick') || '') && /חזרה|رجوع|العودة/.test(b.innerText));
        if (!back) return 'no back button on ' + (n + 1);
        back.click(); await new Promise((r) => setTimeout(r, 400));
        return 'back -> ' + currentScreen;
      }, n);
      const B = await page.evaluate(SNAP);
      // resume into a fresh page
      const payload = await page.evaluate(() => JSON.stringify(capturePartPayload()));
      const ctx2 = await browser.createBrowserContext(); const page2 = await ctx2.newPage(); await page2.setViewport({ width: 1280, height: 720 });
      page2.on('pageerror', (e) => errs.push('resume: ' + e.message));
      await page2.goto(url, { waitUntil: 'networkidle0' }); await sleep(300);
      await page2.evaluate((st, n) => applyExecutionState(JSON.parse(st), n), payload, n); await sleep(500);
      const C = await page2.evaluate(SNAP);
      const dB = diff(A, B), dC = diff(A, C);
      if (!dB.length && !dC.length && !errs.length) clean++;
      console.log(`\n### ${c} s${n}  [${log.join(' | ')}]  ${fwd}`);
      if (dB.length) console.log('  BACK  ' + dB.slice(0, 12).join('\n        ') + (dB.length > 12 ? '\n        … +' + (dB.length - 12) : ''));
      if (dC.length) console.log('  RESUME ' + dC.slice(0, 12).join('\n         ') + (dC.length > 12 ? '\n         … +' + (dC.length - 12) : ''));
      if (errs.length) console.log('  ERRORS ' + errs.join(' | '));
      if (!dB.length && !dC.length && !errs.length) console.log('  identical after Back and after resume');
      await ctx.close(); await ctx2.close();
    }
  }
  console.log(`\n=== ${total} question screens, ${clean} identical after Back and resume ===`);
  await browser.close(); if (server) server.close();
  process.exit(clean === total ? 0 : 1);
})().catch((e) => { console.error(e); if (server) server.close(); process.exit(2); });
