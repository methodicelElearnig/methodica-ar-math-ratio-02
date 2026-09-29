// Field-by-field diff of Arabic metadata vs Hebrew metadata, ignoring text fields
// and normalising ids to slug-relative form.  usage: node mdiff.js <heDir> <arDir>
const fs = require('fs'), p = require('path');
const [he, ar] = process.argv.slice(2);
const TEXT = new Set(['title', 'informationToBot', 'description', 'questionText', 'text', 'createdAt', 'updatedAt', 'languages', 'keywords']);
const norm = v => typeof v === 'string'
  ? v.replace(/^https:\/\/lomdot\.education\.gov\.il\/metodica\/720(active)?\/(ar\/)?math\/ratio\/02\//, '~/')
     .replace(/methodica-ar-math-ratio-02/g, 'U').replace(/methodica-math-ratio-02/g, 'U')
     .replace(/\/index\.html\?q=/, '/').replace(/\/index\.html$/, '/').replace(/\/$/, '')
  : v;
function walk(a, b, path, out) {
  if (Array.isArray(a) || Array.isArray(b)) {
    a = a || []; b = b || [];
    if (a.length !== b.length) out.push(`${path}: length HE=${a.length} AR=${b.length}`);
    for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (TEXT.has(k)) continue;
      if (!(k in a)) { out.push(`${path}.${k}: only AR = ${JSON.stringify(b[k]).slice(0, 80)}`); continue; }
      if (!(k in b)) { out.push(`${path}.${k}: only HE = ${JSON.stringify(a[k]).slice(0, 80)}`); continue; }
      walk(a[k], b[k], `${path}.${k}`, out);
    }
    return;
  }
  if (norm(a) !== norm(b)) out.push(`${path}: HE=${JSON.stringify(a)} AR=${JSON.stringify(b)}`);
}
for (const f of fs.readdirSync(he).filter(f => f.endsWith('.json')).sort()) {
  const arName = fs.existsSync(p.join(ar, f)) ? f : f.replace('methodica-math', 'methodica-ar-math');
  const A = JSON.parse(fs.readFileSync(p.join(he, f), 'utf8'));
  const B = JSON.parse(fs.readFileSync(p.join(ar, arName), 'utf8'));
  const out = []; walk(A, B, '', out);
  console.log(`== ${f} (${out.length})`); out.forEach(l => console.log('  ' + l));
}
