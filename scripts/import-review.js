// بعد المراجعة: نزّل ورقة «القاموس» أو «الاقتباسات» أو «أبيات الآلة» من الجدول بصيغة CSV ثم شغّل
//   node scripts/import-review.js path/to/الورقة.csv
// يتعرّف على نوع الورقة من عناوينها، يتحقق منها، ثم يكتبها مصدرًا معتمدًا
// في data/names.csv أو data/quotes.csv (ترتيب الأعمدة لا يهم).
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, parseCsv } from './build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function toCanonicalCsv(names) {
  const lines = ['name,variants,gender,root,meaning,themes,confidence,review_note'];
  for (const n of names) {
    lines.push([n.name, n.variants.join('|'), n.gender, n.root ?? '', n.meaning, n.themes.join('|'), n.confidence, n.note ?? ''].map(q).join(','));
  }
  return lines.join('\n') + '\n';
}

const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCanonicalQuotesCsv(quotes) {
  const lines = ['id,status,themes,first,second,author,url,topic,review_note'];
  for (const x of quotes) {
    lines.push([x.id, x.status, x.themes.join('|'), x.first, x.second, x.author, x.url, x.topic ?? '', x.note ?? ''].map(q).join(','));
  }
  return lines.join('\n') + '\n';
}

export function toCanonicalMachineCsv(list) {
  const lines = ['id,status,themes,meter,first,second,model,review_note'];
  for (const x of list) {
    lines.push([x.id, x.status, x.themes.join('|'), x.meter, x.first, x.second, x.model, x.note ?? ''].map(q).join(','));
  }
  return lines.join('\n') + '\n';
}

export const isQuotesSheet = (text) => parseCsv(text)[0].some((h) => ['الشطر الأول', 'first'].includes(h.trim()));
export const isMachineSheet = (text) => parseCsv(text)[0].some((h) => ['البحر', 'meter'].includes(h.trim()));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('الاستخدام: node scripts/import-review.js <ملف CSV من الجدول>'); process.exit(1); }
  const text = readFileSync(resolve(file), 'utf8');
  if (isMachineSheet(text)) {
    const { data, allMachine, errors } = loadData({ machineFile: resolve(file) });
    if (errors.length) {
      console.error('❌ لم يُستورد شيء. صحّح هذه في الجدول ثم أعد التنزيل:\n' + errors.map((e) => ' - ' + e).join('\n'));
      process.exit(1);
    }
    writeFileSync(join(root, 'data', 'machine.csv'), toCanonicalMachineCsv(allMachine));
    console.log(`✅ استُورد ${allMachine.length} بيتًا للآلة (${data.machine.length} داخل اللعبة) إلى data/machine.csv — شغّل الآن: npm test`);
    process.exit(0);
  }
  if (isQuotesSheet(text)) {
    const { data, allQuotes, errors } = loadData({ quotesFile: resolve(file) });
    if (errors.length) {
      console.error('❌ لم يُستورد شيء. صحّح هذه في الجدول ثم أعد التنزيل:\n' + errors.map((e) => ' - ' + e).join('\n'));
      process.exit(1);
    }
    writeFileSync(join(root, 'data', 'quotes.csv'), toCanonicalQuotesCsv(allQuotes));
    console.log(`✅ استُورد ${allQuotes.length} اقتباسًا (${data.quotes.length} داخل البناء) إلى data/quotes.csv — شغّل الآن: npm test`);
    process.exit(0);
  }
  const { data, errors } = loadData({ namesFile: resolve(file) });
  if (errors.length) {
    console.error('❌ لم يُستورد شيء. صحّح هذه في الجدول ثم أعد التنزيل:\n' + errors.map((e) => ' - ' + e).join('\n'));
    process.exit(1);
  }
  writeFileSync(join(root, 'data', 'names.csv'), toCanonicalCsv(data.names));
  console.log(`✅ استُورد ${data.names.length} اسمًا إلى data/names.csv — شغّل الآن: npm test`);
}
