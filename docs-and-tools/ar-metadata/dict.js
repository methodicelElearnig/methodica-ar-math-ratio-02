// Build a Hebrew -> Arabic string dictionary from the lomda itself: the Hebrew source (3031dd2)
// and the Arabic translation share their DOM / line structure, so paired nodes are translations.
// usage: NODE_PATH=... node dict.js <scratchDir>  -> writes <scratchDir>/dict.json
const fs = require('fs'), p = require('path');
const { JSDOM } = require('jsdom');
const dir = process.argv[2];
const HEB = /[֐-׿]/;
const clean = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const dict = new Map();          // he -> Set(ar)
function add(he, ar) {
  he = clean(he); ar = clean(ar);
  if (!he || !HEB.test(he) || !ar || he === ar) return;
  if (!dict.has(he)) dict.set(he, new Set());
  dict.get(he).add(ar);
}
const ATTRS = ['aria-label', 'alt', 'title', 'data-label', 'placeholder', 'data-val', 'value'];
function pair(a, b) {
  if (a.nodeType === 3 && b.nodeType === 3) { add(a.textContent, b.textContent); return; }
  if (a.nodeType !== 1 || b.nodeType !== 1) return;
  for (const at of ATTRS) if (a.hasAttribute(at) && b.hasAttribute(at)) add(a.getAttribute(at), b.getAttribute(at));
  add(a.textContent, b.textContent);                       // whole-element text
  const ca = [...a.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
  const cb = [...b.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
  const sig = l => l.map(n => n.nodeType === 1 ? n.tagName : '#t').join(',');
  if (sig(ca) === sig(cb)) ca.forEach((n, i) => pair(n, cb[i]));
  else {                                                   // structure diverged: pair element children by tag order
    const ea = ca.filter(n => n.nodeType === 1), eb = cb.filter(n => n.nodeType === 1);
    if (ea.map(n => n.tagName).join() === eb.map(n => n.tagName).join()) ea.forEach((n, i) => pair(n, eb[i]));
  }
}
function lits(line) {             // string literals in a JS line, in order
  const out = []; const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g; let m;
  while ((m = re.exec(line))) out.push((m[1] ?? m[2] ?? m[3]).replace(/\\(.)/g, '$1'));
  return out;
}
function strip(html) { return new JSDOM('<body>' + html + '</body>').window.document.body.textContent; }
function pairJs(heSrc, arSrc) {
  const A = heSrc.split('\n'), B = arSrc.split('\n');
  if (A.length !== B.length) { console.warn('line count differs', A.length, B.length); }
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    if (!HEB.test(A[i])) continue;
    const la = lits(A[i]), lb = lits(B[i]);
    if (la.length !== lb.length) continue;
    la.forEach((s, k) => { add(s, lb[k]); if (/[<>]/.test(s)) add(strip(s), strip(lb[k])); });
  }
}
for (const n of ['01', '02', '03', '04', '05']) {
  const ha = new JSDOM(fs.readFileSync(p.join(dir, 'he', n + '.html'), 'utf8')).window.document;
  const aa = new JSDOM(fs.readFileSync(p.join(dir, 'ar', n + '.html'), 'utf8')).window.document;
  pair(ha.body, aa.body);
  pairJs(fs.readFileSync(p.join(dir, 'he', n + '.js'), 'utf8'), fs.readFileSync(p.join(dir, 'ar', n + '.js'), 'utf8'));
}
pairJs(fs.readFileSync(p.join(dir, 'he', 'main.js'), 'utf8'), fs.readFileSync(p.join(dir, 'ar', 'main.js'), 'utf8'));
const obj = {}; for (const [k, v] of dict) obj[k] = [...v];
fs.writeFileSync(p.join(dir, 'dict.json'), JSON.stringify(obj, null, 1));
console.log('entries', dict.size, 'ambiguous', [...dict.values()].filter(v => v.size > 1).length);
