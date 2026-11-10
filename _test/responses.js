/* ═══════════════════ answered result.response = Kata's correctXapiResponsesPattern ═══════════════════
   NOT DEPLOYED. Dev tooling only.

   MOE runbook (10.11.26): a right answer must send exactly the string Kata keeps in the question's
   correctXapiResponsesPattern ('[,]' between choices / pairs, '[.]' between source and target).
   metadata/ carries Kata's patterns since 2026-11-11 (plus the 03-003/q2 proposal), so they are read
   from there.

   The walks in _test/walks/ are the Phase 3 live-round step files of 10.11.26 (lane D), replayed in
   real Chrome against the local library stub (?xapiLib=../_test/xapi-720-k.js) — every answer goes
   through the page's own handlers and buttons. Lines are page code (await allowed); '@expect expr'
   must be true; '@wait ms' sleeps; '@reload' ends the walk (the reload part is the gate check of
   flow tests, not a response question); '@print', '@mark', '@nonew' are ignored.
     - right walks (-C): every metadata question with a pattern answered there gets answered.last
       with success true and a response equal to one of the pattern's entries, byte for byte;
     - right and wrong walks: no ' | ', '->', 'x:yes' row picks, bare option letters or invisible marks.
   Mutation check: with 20-xapi.js and main.js from before 2026-11-11 most right-walk checks fail.

   Run (serves the repo itself; puppeteer-core outside OneDrive, local Chrome):
     NODE_PATH=<tools>/node_modules node _test/responses.js */
'use strict';
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..');
const UNIT = fs.readdirSync(path.join(ROOT, 'metadata')).find(f => /_unit\.json$/.test(f)).replace(/_unit\.json$/, '');
const WALKS = path.join(__dirname, 'walks');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const trim = u => String(u || '').replace(/\/+$/, '');
/* Known page != Kata answer keys, waiting for a content decision (QA/2026-11-10_moe-runbook-checks/
   phase6/lane-4.md, class J). The page's own answer is asserted instead, so a change is noticed. */
const KNOWN = {
  '05-001/q1': { page: '3/5', why: 'page premise "discounted : total = 3 : 5" vs Kata "discounted : full = 5:3" (q2 follows Kata)' },
};
const BAD = /\s\|\s|->|\b[a-z]:(?:yes|no)\b|^[a-z](?:,[a-z])*$|[\u200B\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF]/;

let passes = 0; const failures = [];
const ok = (tag, what, cond, detail) => { if (cond) passes++; else failures.push(`[${tag}] ${what}${detail ? '  —  ' + detail : ''}`); };

const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' }); r.end(d); });
});

server.listen(0, async () => {
  const BASE = 'http://localhost:' + server.address().port + '/';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
  try {
    for (const f of fs.readdirSync(WALKS).filter(f => /\.txt$/.test(f)).sort()) {
      const c = f.slice(2, 4), right = /-C\.txt$/.test(f), tag0 = f.replace('.txt', '');
      const slug = UNIT + '-' + c;
      const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'metadata', slug + '.json'), 'utf8').replace(/^\uFEFF/, ''));
      const pats = {};
      meta.subContent.forEach(s => (s.questions || []).forEach(q => {
        if (q.correctXapiResponsesPattern && q.correctXapiResponsesPattern.length) pats[trim(q.questionId)] = q.correctXapiResponsesPattern;
      }));
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
      const url = BASE + slug + '/index.html?xapiLib=../_test/xapi-720-k.js';
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => window.__reset && __reset());
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => (window.__stmts ? __stmts() : []).some(s => s.verb === 'initialized' && s.objectType === 'onlinelesson'), { timeout: 15000 });
      const lines = fs.readFileSync(path.join(WALKS, f), 'utf8').split(/\r?\n/).filter(l => l.trim() && !/^#/.test(l));
      let stopped = false;
      for (const l of lines) {
        if (stopped) break;
        try {
          if (/^@reload/.test(l)) { stopped = true; break; }
          if (/^@(print|mark|nonew)/.test(l)) continue;
          if (/^@wait/.test(l)) { await new Promise(r => setTimeout(r, +l.split(/\s+/)[1] || 0)); continue; }
          if (/^@expect /.test(l)) { const v = await page.evaluate('(' + l.slice(8) + ')'); ok(tag0, 'walk @expect ' + l.slice(8, 60), v === true, String(v)); continue; }
          await page.evaluate('(async () => { ' + l + '\n })()');
        } catch (e) { ok(tag0, 'walk line runs', false, l.slice(0, 80) + ' :: ' + e.message.split('\n')[0]); stopped = true; }
      }
      const st = await page.evaluate(() => __stmts());
      await page.close();
      const ans = st.filter(s => /^answered/.test(s.verb) && s.opts && s.opts.questionId);
      const resp = s => { const r = s.result || {}; return r.response != null ? String(r.response) : ''; };
      ans.forEach(s => ok(`${tag0} ${trim(s.opts.questionId).replace(/^.*-(\d{3}\/q\d+)$/, '$1')}`,
        'no home-made separator / letter / invisible mark', !BAD.test(resp(s)), JSON.stringify(resp(s))));
      if (right) {
        const answered = new Set(ans.map(s => trim(s.opts.questionId)));
        Object.keys(pats).filter(q => answered.has(q)).forEach(qid => {
          const tag = `${tag0} ${qid.replace(/^.*-(\d{3}\/q\d+)$/, '$1')}`;
          /* this unit sends answered.last only on an item's last question (main.js _xapiIsLastQuestion),
             so the final answer to a question is its last answered* statement */
          const last = ans.filter(s => trim(s.opts.questionId) === qid).slice(-1);
          if (!last.length) return;
          ok(tag, 'success true', last[0].result && last[0].result.success === true);
          const kn = KNOWN[c + '-' + qid.replace(/^.*-(\d{3}\/q\d+)$/, '$1')];
          if (kn) { ok(tag, 'known class J, the page answer (' + kn.why + ')', resp(last[0]) === kn.page, JSON.stringify(resp(last[0]))); return; }
          ok(tag, "response is Kata's pattern", pats[qid].indexOf(resp(last[0])) !== -1, JSON.stringify(resp(last[0])) + ' vs ' + JSON.stringify(pats[qid]));
        });
        ok(tag0, 'every metadata question with a pattern answered', Object.keys(pats).every(q => answered.has(q)),
          Object.keys(pats).filter(q => !answered.has(q)).map(q => q.slice(-6)).join(' '));
      }
      errs.forEach(e => ok(tag0, 'no page error', false, e));
      console.log(`${tag0.padEnd(8)} ${ans.length} answered`);
    }
  } finally { await browser.close(); server.close(); }
  const layer = fs.readFileSync(path.join(ROOT, 'unit-js', '20-xapi.js'), 'utf8');
  ok('layer', 'no xapiZoneAnswer / xapiFieldsAnswer / xapiMultiAnswer', !/function\s+xapi(?:Zone|Fields|Multi)Answer\b/.test(layer));
  console.log('\npassed: ' + passes);
  if (failures.length) { console.log('FAILED: ' + failures.length + '\n'); failures.forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log('all clear');
});
