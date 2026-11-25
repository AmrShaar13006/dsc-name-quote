// يصدّر نسخة المراجِع: عناوين عربية، والمواضيع بأسمائها لا بمعرّفاتها،
// وعمودان إضافيان للمراجعة (يتجاهلهما البناء).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadData } from './build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { data, allQuotes, allMachine, allAttributes, allFigures, allCelebrities, errors } = loadData();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const label = new Map(data.themes.map((t) => [t.id, t.label]));
const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const header = ['الاسم', 'صيغ بديلة', 'الجنس', 'الجذر', 'المعنى', 'المواضيع', 'الثقة', 'ملاحظة', 'مراجَع', 'تعليق المراجِع'];
const lines = [header.join(',')];
for (const n of data.names) {
  lines.push([
    n.name, n.variants.join(' | '), n.gender, n.root ?? '', n.meaning,
    n.themes.map((t) => label.get(t)).join(' + '), n.confidence, n.note ?? '', 'FALSE', '',
  ].map(q).join(','));
}
mkdirSync(join(root, 'review'), { recursive: true });
const out = join(root, 'review', 'names-review.csv');
writeFileSync(out, lines.join('\n') + '\n');
console.log(`✅ ${data.names.length} صفًا ← ${out}`);

// ورقة «الاقتباسات» (الأبيات من ويكي مصدر): الحالة مقترح/معتمد/مستبعد — المستبعد لا يدخل البناء
const qHeader = ['المعرّف', 'الحالة', 'المواضيع', 'الشطر الأول', 'الشطر الثاني', 'الشاعر', 'الرابط', 'القصيدة', 'مخصّص لأسماء', 'ملاحظة', 'تعليق المراجِع'];
const qLines = [qHeader.join(',')];
for (const x of allQuotes) {
  qLines.push([
    x.id, x.status, x.themes.map((t) => label.get(t)).join(' + '), x.first, x.second, x.author, x.url, x.topic ?? '', x.forNames.join(' | '), x.note ?? '', '',
  ].map(q).join(','));
}
const qOut = join(root, 'review', 'quotes-review.csv');
writeFileSync(qOut, qLines.join('\n') + '\n');
console.log(`✅ ${allQuotes.length} اقتباسًا ← ${qOut}`);

// ورقة «أبيات الآلة» (شاعر أم آلة؟): الأبيات مشكولة لأن البناء يفحص وزنها؛ وفي اللعبة تُعرض بلا تشكيل
const mHeader = ['المعرّف', 'الحالة', 'المواضيع', 'البحر', 'الشطر الأول', 'الشطر الثاني', 'النموذج', 'ملاحظة', 'تعليق المراجِع'];
const mLines = [mHeader.join(',')];
for (const x of allMachine) {
  mLines.push([x.id, x.status, x.themes.map((t) => label.get(t)).join(' + '), x.meter, x.first, x.second, x.model, x.note ?? '', ''].map(q).join(','));
}
const mOut = join(root, 'review', 'machine-review.csv');
writeFileSync(mOut, mLines.join('\n') + '\n');
console.log(`✅ ${allMachine.length} بيتًا للآلة ← ${mOut}`);

// ورقة «الصفات» (ما يستوحيه الاسم من صفات): تأويل أدبي من المعنى، الحالة مقترح/معتمد/مستبعد
const aHeader = ['الاسم', 'الصفة', 'نوع العلاقة', 'التعليل', 'المصدر', 'الحالة', 'ملاحظة', 'تعليق المراجِع'];
const aLines = [aHeader.join(',')];
for (const x of allAttributes) {
  aLines.push([x.name, x.attribute, x.relation ?? '', x.justification ?? '', x.source ?? '', x.status, x.note ?? '', ''].map(q).join(','));
}
const aOut = join(root, 'review', 'attributes-review.csv');
writeFileSync(aOut, aLines.join('\n') + '\n');
console.log(`✅ ${allAttributes.length} صفة ← ${aOut}`);

// ورقة «الشخصيات التاريخية»: مطابقة تامة للاسم القانوني، الحالة مقترح/معتمد/مستبعد
// شخصية دينية لا تُعرض لها صورة أبدًا (سياسة ثابتة)؛ غيرها يجوز لها صورة موثقة من ويكيميديا كومنز فقط
const fHeader = ['المعرّف', 'الاسم', 'الاسم الكامل', 'العصر', 'الميلاد', 'الوفاة', 'المجال', 'السيرة', 'المساهمة', 'الرابط', 'شخصية دينية', 'الصورة', 'مصدر الصورة', 'ترخيص الصورة', 'الحالة', 'ملاحظة', 'تعليق المراجِع'];
const fLines = [fHeader.join(',')];
for (const x of allFigures) {
  fLines.push([
    x.id, x.name, x.full_name, x.era ?? '', x.birth ?? '', x.death ?? '', x.field ?? '', x.bio, x.contribution ?? '', x.url,
    x.religious, x.image ?? '', x.image_credit ?? '', x.image_license ?? '', x.status, x.note ?? '', '',
  ].map(q).join(','));
}
const fOut = join(root, 'review', 'figures-review.csv');
writeFileSync(fOut, fLines.join('\n') + '\n');
console.log(`✅ ${allFigures.length} شخصية تاريخية ← ${fOut}`);

// ورقة «الشخصيات المشهورة»: صفحة مستقلة عن الشخصيات التاريخية، لا تشترط كونها تاريخية أو سياسية
const cHeader = ['المعرّف', 'الاسم', 'الاسم الكامل', 'المجال', 'الميلاد', 'الوفاة', 'السيرة', 'المساهمة', 'الرابط', 'شخصية دينية', 'الصورة', 'مصدر الصورة', 'ترخيص الصورة', 'الحالة', 'ملاحظة', 'تعليق المراجِع'];
const cLines = [cHeader.join(',')];
for (const x of allCelebrities) {
  cLines.push([
    x.id, x.name, x.full_name, x.field ?? '', x.birth ?? '', x.death ?? '', x.bio, x.contribution ?? '', x.url,
    x.religious, x.image ?? '', x.image_credit ?? '', x.image_license ?? '', x.status, x.note ?? '', '',
  ].map(q).join(','));
}
const cOut = join(root, 'review', 'celebrities-review.csv');
writeFileSync(cOut, cLines.join('\n') + '\n');
console.log(`✅ ${allCelebrities.length} شخصية مشهورة ← ${cOut}`);
