import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, MIN_QUOTES_PER_THEME } from '../scripts/build.js';
import { toCanonicalQuotesCsv, isQuotesSheet } from '../scripts/import-review.js';
import { createEngine } from '../src/engine.js';
import { WIKI } from '../scripts/wikisource.js';
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const { data, allQuotes, errors } = loadData();
const E = createEngine(data);

test('الاقتباسات: لا أخطاء، وكل موضوع فيه 4 أبيات فأكثر', () => {
  assert.deepEqual(errors, []);
  for (const t of data.themes) {
    const n = E.quotesByTheme.get(t.id)?.length ?? 0;
    assert.ok(n >= MIN_QUOTES_PER_THEME, `${t.label}: ${n}`);
  }
});

test('كل بيت: شطران غير فارغين، شاعر، ورابط قصيدته في ويكي مصدر (لا نصوص من الديوان)', () => {
  for (const q of data.quotes) {
    assert.ok(q.first.trim() && q.second.trim(), q.id);
    assert.ok(q.author.trim(), q.id);
    assert.match(q.id, /^w\d+$/);
    assert.ok(q.url.startsWith(WIKI), `${q.id}: ${q.url}`);
  }
});

test('كل اسم في القاموس يجد بيتًا لكل مواضيعه، والاختيار ثابت', () => {
  for (const n of data.names) {
    const r = E.resolve(n.name);
    for (const t of r.themes) {
      const a = E.quoteFor(r, t);
      assert.ok(a, `${n.name} / ${t}`);
      assert.ok(a.themes.includes(t), `${n.name}: البيت ${a.id} ليس من موضوع ${t}`);
      assert.equal(E.quoteFor(E.resolve(n.name), t).id, a.id);
    }
  }
});

test('«بيت آخر» يدور على كل أبيات الموضوع دون تكرار', () => {
  const r = E.resolve('نورة');
  const t = r.themes[0];
  const pool = E.quotesByTheme.get(t);
  const ids = pool.map((_, i) => E.quoteFor(r, t, i).id);
  assert.equal(new Set(ids).size, pool.length);
});

test('المراجِع يستبعد بيتًا ← لا يدخل البناء ولا يُختار', () => {
  const sheet = readFileSync(here('../review/quotes-review.csv'), 'utf8').split('\n');
  const victim = allQuotes[0].id;
  const edited = sheet.map((l) => (l.startsWith(victim + ',') ? l.replace(',مقترح,', ',مستبعد,') : l)).join('\n');
  const f = join(mkdtempSync(join(tmpdir(), 'nq-')), 'q.csv');
  writeFileSync(f, edited);
  assert.ok(isQuotesSheet(edited));
  const back = loadData({ quotesFile: f });
  assert.deepEqual(back.errors, []);
  assert.ok(!back.data.quotes.some((q) => q.id === victim));
  assert.equal(back.allQuotes.find((q) => q.id === victim).status, 'مستبعد');
  // ويُكتب مصدرًا معياريًا يُقرأ إلى نفس البيانات
  const f2 = f.replace('q.csv', 'canon.csv');
  writeFileSync(f2, toCanonicalQuotesCsv(back.allQuotes));
  assert.deepEqual(loadData({ quotesFile: f2 }).allQuotes, back.allQuotes);
});

test('الذهاب والعودة: ورقة الاقتباسات المصدَّرة تُبنى إلى نفس البيانات', () => {
  const back = loadData({ quotesFile: here('../review/quotes-review.csv') });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.allQuotes, allQuotes);
});

test('التحقق يرفض: نص الديوان، رابطًا آخر، شاعرًا فارغًا، تشكيلًا مكررًا، حرفًا فارسيًا، معرّفًا خاطئًا', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'nq-')), 'bad.csv');
  const page = 'https://ar.wikisource.org/wiki/قصيدة';
  writeFileSync(f, [
    'id,status,themes,first,second,author,url',
    'w1,مقترح,sabr,أ,ب,شاعر,https://www.aldiwan.net/quote2.html',
    'w2,مقترح,sabr,أ,ب,شاعر,https://example.com/poem',
    `w3,مقترح,sabr,أ,ب,,${page}`,
    `w4,مقترح,sabr,تُُحسب,ب,شاعر,${page}`,
    `w5,مقترح,sabr,تفيت کللیالي,ب,شاعر,${page}`,
    `188,مقترح,sabr,أ,ب,شاعر,${page}`,
  ].join('\n'));
  const msgs = loadData({ quotesFile: f }).errors.join('\n');
  assert.match(msgs, /سطر 2.*لا نحفظ نصوص الديوان/);
  assert.match(msgs, /سطر 3.*ويكي مصدر/);
  assert.match(msgs, /سطر 4.*الشاعر/);
  assert.match(msgs, /سطر 5.*التشكيل/);
  assert.match(msgs, /سطر 6.*فارسي/);
  assert.match(msgs, /سطر 7.*المعرّف/);
});
