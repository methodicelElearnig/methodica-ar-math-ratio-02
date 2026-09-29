// Build metadata/methodica-ar-math-ratio-02-*.json: Hebrew metadata is the master for every
// non-text field and for the question set; Arabic text comes from metadata-ar (component/item
// titles, informationToBot) and from the lomda's own translation (questions and answers).
// usage: node build-meta.js <repo> <dict.json> [--write]
const fs = require('fs'), p = require('path');
const [repo, dictFile, flag] = process.argv.slice(2);
const WRITE = flag === '--write';
const dict = JSON.parse(fs.readFileSync(dictFile, 'utf8'));
const HEB = /[֐-׿]/;
const clean = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const squash = s => clean(s).replace(/\s*:\s*/g, ':').replace(/[.,،؟?!]+$/, '').replace(/"/g, '״');
const mask = s => squash(s).replace(/\d+(?:\.\d+)?(?::\d+(?:\.\d+)?)+/g, '#');
const index = new Map();                      // squashed he -> ar[]
for (const [he, ar] of Object.entries(dict)) {
  for (const k of [squash(he), mask(he)]) { if (!index.has(k)) index.set(k, []); index.get(k).push(...ar); }
}
const report = { unmatched: [], ambiguous: [], sources: [] };
// Hebrew question -> supplied Arabic question (1-based), per item, where they differ from 1:1.
// null = no Arabic counterpart in metadata-ar; the text comes from OVERRIDE below.
const ALIGN = {
  '01-2': { q1: null, q2: 'q2', q3: 'q3', q4: 'q4', q5: null, q6: 'q5' },
  '01-3': { q1: 'q1', q2: 'q3', q3: 'q4', q4: 'q5', q5: null, q6: null },
};
const OVERRIDE = fs.existsSync(p.join(p.dirname(dictFile), 'override.json'))
  ? JSON.parse(fs.readFileSync(p.join(p.dirname(dictFile), 'override.json'), 'utf8')) : {};
// Ratios keep the Hebrew metadata's order: the Arabic string takes the Hebrew string's ratio
// tokens in sequence (the catalogue is Hebrew-master; see AR-METADATA-REPORT.md).
const RATIO = /\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)?/g;
function ratiosFrom(heStr, arStr) {
  if (typeof heStr !== 'string' || typeof arStr !== 'string') return arStr;
  const h = heStr.match(RATIO) || [], a = arStr.match(RATIO) || [];
  if (!h.length || h.length !== a.length) return arStr;
  let i = 0; return arStr.replace(RATIO, () => h[i++]);
}
function tr(he, where, fallback) {
  if (typeof he !== 'string' || !HEB.test(he)) return he;
  if (OVERRIDE[where] !== undefined) { report.sources.push(`${where}: override`); return OVERRIDE[where]; }
  const c = clean(he);
  let cand = dict[c] || index.get(squash(c)) || index.get(mask(c));
  if (!cand) {
    if (typeof fallback === 'string' && fallback) { report.sources.push(`${where}: metadata-ar`); return ratiosFrom(he, fallback); }
    report.unmatched.push(`${where}: ${he}`); return he;
  }
  cand = [...new Set(cand)];
  if (cand.length > 1) report.ambiguous.push(`${where}: ${he}  =>  ${cand.join('  ||  ')}`);
  report.sources.push(`${where}: lomda`);
  return ratiosFrom(he, cand[0]);
}
const idMap = s => s
  .replace('https://lomdot.education.gov.il/metodica/720active/math/ratio/02/', 'https://lomdot.education.gov.il/metodica/720/ar/math/ratio/02/')
  .replace(/methodica-math-ratio-02/g, 'methodica-ar-math-ratio-02');
const md = p.join(repo, 'metadata'), ar = p.join(repo, 'metadata-ar'), heDir = p.join(p.dirname(dictFile), 'he-meta');
const out = {};
for (const n of ['01', '02', '03', '04', '05']) {
  const he = JSON.parse(fs.readFileSync(p.join(heDir, `methodica-math-ratio-02-${n}.json`), 'utf8'));
  const sa = JSON.parse(fs.readFileSync(p.join(ar, `methodica-math-ratio-02-${n}.json`), 'utf8'));
  const c = JSON.parse(JSON.stringify(he));
  c.id = idMap(c.id); c.learningUnitId = idMap(c.learningUnitId);
  c.recommendedAfterFail = c.recommendedAfterFail.map(idMap);
  c.title = sa.title; c.languages = ['Arabic'];
  c.createdAt = sa.createdAt; c.updatedAt = sa.updatedAt;
  if (sa.subContent.length !== c.subContent.length) throw new Error(`${n}: item count differs`);
  c.subContent.forEach((it, i) => {
    const s = sa.subContent[i];
    if (!s.id.includes(it.id.replace(/\/$/, '').split('/').pop().replace('methodica-math', 'methodica-ar-math')))
      throw new Error(`${n}: item ${i} id does not align: ${it.id} vs ${s.id}`);
    it.id = idMap(it.id); it.title = s.title; it.informationToBot = s.informationToBot;
    const al = ALIGN[`${n}-${i + 1}`];
    const aq = s.questions || [];
    (it.questions || []).forEach((q, k) => {
      const key = `q${k + 1}`, w = `${n}-${i + 1}/${key}`;
      const m = al ? (al[key] ? aq[+al[key].slice(1) - 1] : null) : aq[k];
      q.questionId = idMap(q.questionId);
      // The question TEXT is a catalogue paraphrase, never a lomda string: take the supplier's.
      q.questionText = OVERRIDE[w + ' text'] !== undefined ? tr(q.questionText, w + ' text')
        : (m ? (report.sources.push(`${w} text: metadata-ar`), ratiosFrom(q.questionText, m.questionText)) : tr(q.questionText, w + ' text'));
      // Answers: the lomda's own string first; else the supplier's, only when the lists line up.
      const same = (x, y) => Array.isArray(x) && Array.isArray(y) && x.length === y.length;
      const fb = (list, j) => (m && same(list, m.answers)) ? m.answers[j] : undefined;
      const heAns = JSON.parse(JSON.stringify(q.answers || []));
      if (Array.isArray(q.answers)) q.answers = q.answers.map((a, j) => tr(a, `${w} answer${j + 1}`, fb(heAns, j)));
      else if (q.answers) {
        const ms = m && m.answers && !Array.isArray(m.answers) ? m.answers : {};
        q.answers.source = q.answers.source.map((a, j) => tr(a, `${w} source${j + 1}`, same(heAns.source, ms.source) ? ms.source[j] : undefined));
        q.answers.target = q.answers.target.map((a, j) => tr(a, `${w} target${j + 1}`, same(heAns.target, ms.target) ? ms.target[j] : undefined));
      }
      // A correct answer is one of the answers: reuse the translation made for it.
      const lookup = (he, list, arList) => { const j = (list || []).indexOf(he); return j >= 0 ? arList[j] : undefined; };
      q.correctAnswers = q.correctAnswers.map((a, j) => (a && typeof a === 'object')
        ? { source: lookup(a.source, heAns.source, q.answers.source) ?? tr(a.source, `${w} c.source${j + 1}`),
            target: lookup(a.target, heAns.target, q.answers.target) ?? tr(a.target, `${w} c.target${j + 1}`) }
        : (lookup(a, Array.isArray(heAns) ? heAns : [], q.answers) ?? tr(a, `${w} correct${j + 1}`)));
    });
  });
  out[`methodica-ar-math-ratio-02-${n}.json`] = c;
}
const unitHe = JSON.parse(fs.readFileSync(p.join(heDir, 'methodica-math-ratio-02_unit.json'), 'utf8'));
const unitAr = JSON.parse(fs.readFileSync(p.join(ar, 'methodica-math-ratio-02_unit.json'), 'utf8'));
const u = JSON.parse(JSON.stringify(unitHe));
u.id = idMap(u.id); u.title = unitAr.title;
out['methodica-ar-math-ratio-02_unit.json'] = u;
// Numbers must survive translation: every Arabic string carries the same numbers as its Hebrew source.
const nums = s => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '')).sort().join(' ');
report.numbers = [];
for (const n of ['01', '02', '03', '04', '05']) {
  const he = JSON.parse(fs.readFileSync(p.join(heDir, `methodica-math-ratio-02-${n}.json`), 'utf8'));
  const c = out[`methodica-ar-math-ratio-02-${n}.json`];
  he.subContent.forEach((it, i) => (it.questions || []).forEach((q, k) => {
    const pairs = [[q.questionText, c.subContent[i].questions[k].questionText, 'text']];
    const A = q.answers, B = c.subContent[i].questions[k].answers;
    if (Array.isArray(A)) A.forEach((a, j) => pairs.push([a, B[j], 'answer' + (j + 1)]));
    else if (A) A.source.forEach((a, j) => pairs.push([a, B.source[j], 'source' + (j + 1)]));
    q.correctAnswers.forEach((a, j) => { const b = c.subContent[i].questions[k].correctAnswers[j];
      if (a && typeof a === 'object') pairs.push([a.source, b.source, 'c.source' + (j + 1)]); else pairs.push([a, b, 'correct' + (j + 1)]); });
    for (const [h, a, what] of pairs) if (nums(h) !== nums(a)) report.numbers.push(`${n}-${i + 1}/q${k + 1} ${what}: HE[${nums(h)}] AR[${nums(a)}]  ${a}`);
  }));
}
console.log('NUMBERS', report.numbers.length); report.numbers.forEach(l => console.log('  ' + l));
// any Hebrew left outside informationToBot?
for (const [f, j] of Object.entries(out)) {
  JSON.stringify(j, (k, v) => { if (k !== 'informationToBot' && typeof v === 'string' && HEB.test(v)) report.unmatched.push(`${f} ${k}: still Hebrew`); return v; });
}
console.log('UNMATCHED', report.unmatched.length); report.unmatched.forEach(l => console.log('  ' + l));
console.log('AMBIGUOUS', report.ambiguous.length); report.ambiguous.forEach(l => console.log('  ' + l));
if (WRITE) for (const [f, j] of Object.entries(out)) fs.writeFileSync(p.join(md, f), JSON.stringify(j, null, 2) + '\n');
