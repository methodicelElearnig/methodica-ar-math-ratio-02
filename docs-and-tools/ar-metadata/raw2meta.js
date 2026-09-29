// Turn a raw Kata unit response (retrieve-metadata.ps1 -KeepRaw, _raw/<unit>.json) into
// metadata/*.json files in this repo's hand-authored shape, so they can be the Hebrew master.
// usage: node raw2meta.js <raw.json> <unitTemplate_unit.json> <outDir>
const fs = require('fs'), p = require('path');
const [rawFile, unitTpl, outDir] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const slug = u => String(u).replace(/\/+$/, '').split('/').pop();
const unitSlug = raw.uniqueKey;                       // 'methodica-math-ratio-02'
for (const c of raw.components) {
  const prefix = c.uniqueKey.replace(/[^/]+\/$/, '');  // .../math/ratio/02/
  const out = {
    id: c.uniqueKey,
    title: c.title,
    learningUnitId: prefix + unitSlug + '/',
    componentPurpose: c.componentPurpose,
    isAssessment: c.isAssessment,
    recommendedAfterFail: (c.recommendedAfterFail || []).map(slug),
    isRequired: c.isRequired,
    relativeDifficulty: c.relativeDifficulty,
    masteryLevel: c.masteryLevel,
    order: c.order,
    depthLevel: c.depthLevel,
    cognitiveLevels: c.cognitiveLevels,
    languages: c.languages,
    skills: c.skills,
    estimatedTimeInMinutes: c.estimatedTimeInMinutes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    subContent: c.subContent.map(i => {
      const o = { id: i.uniqueKey, title: i.title, informationToBot: i.informationToBot,
                  contentType: i.contentType, mediaFormat: i.mediaFormat };
      o.questions = (i.questions || []).map(q => ({ questionId: q.questionId, questionType: q.questionType,
        questionText: q.questionText, answers: q.answers, correctAnswers: q.correctAnswers }));
      return o;
    }),
  };
  fs.writeFileSync(p.join(outDir, slug(c.uniqueKey) + '.json'), JSON.stringify(out, null, 2) + '\n');
}
fs.copyFileSync(unitTpl, p.join(outDir, p.basename(unitTpl)));   // unit record is not sent (parent-unit mode)
console.log('components', raw.components.length, '->', outDir);
