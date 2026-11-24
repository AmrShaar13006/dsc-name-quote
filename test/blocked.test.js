// الكلمات المحجوبة: لا تُكتب على بطاقة تحمل شعار النادي، ولا تحجب اسمًا حقيقيًا
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, parseCsv } from '../scripts/build.js';
import { createEngine } from '../src/engine.js';

const { data } = loadData();
const E = createEngine(data);
const R = (s) => E.resolve(s);
const words = parseCsv(readFileSync(fileURLToPath(new URL('../data/blocked.csv', import.meta.url)), 'utf8'))
  .slice(1).map((r) => r[0]).filter(Boolean);

test('المحجوب: الكلمة نفسها، وبـ«ال»، وبالتشكيل، وبتكرار الحروف، ومع اسم عائلة', () => {
  for (const s of ['حمار', 'الحمار', 'حِمَار', 'حماااار', 'حمار العلي', 'كلبة', 'كلبه', 'عبد', 'الله', 'هتلر']) {
    assert.equal(R(s).source, 'blocked', s);
  }
  const r = R('حمار');
  assert.equal(r.meaning, null);
  assert.deepEqual(r.themes, []);
});

test('المحجوب لا يمر مركّبًا: عبد…، …الله، …الدين، متصلة ومنفصلة', () => {
  for (const s of ['عبدالشيطان', 'عبد الشيطان', 'عبدالكلب', 'حمار الله', 'حمارالله', 'كلب الدين', 'كلبالدين']) {
    assert.equal(R(s).source, 'blocked', s);
  }
});

test('كل كلمة في blocked.csv تُحجب فعلًا', () => {
  assert.ok(words.length > 50);
  for (const w of words) assert.equal(R(w).source, 'blocked', w);
});

test('لا يُحجب اسم حقيقي: كل أسماء القاموس، وأسماء خارجه تمر بالجذر أو «اختر»', () => {
  for (const n of data.names) {
    for (const v of [n.name, ...n.variants]) assert.equal(E.isBlocked(v), false, v);
  }
  for (const s of ['عبدالله', 'عبد الرحمن', 'ضيف الله', 'فتح الله', 'نور الدين', 'خولة', 'شذى', 'كسرى', 'عبدان', 'ريناد', 'مايكل', 'تيسير', 'قردان']) {
    assert.notEqual(R(s).source, 'blocked', s);
  }
});

test('الهويات تُحجب، والأسماء الحقيقية التي تشبهها بعد التطبيع تبقى أسماء', () => {
  for (const s of ['شيعي', 'يهودي', 'بنغالي', 'سعودية', 'قط', 'مجنون', 'ملحد']) assert.equal(R(s).source, 'blocked', s);
  // «سني» و«يمني» تُطبّع مثل الاسمين «سنى» و«يمنى»، فتأخذ بطاقة الاسم لا بطاقة الهوية
  assert.equal(R('سني').canonical, 'سنى');
  assert.equal(R('يمني').canonical, 'يمنى');
  for (const s of ['سنى', 'سنا', 'يمنى', 'سنية', 'مسلم', 'هند', 'ذيب']) assert.notEqual(R(s).source, 'blocked', s);
});

test('الصفحة المنشورة لا تحمل الكلمات نفسها، بل بصماتها فقط', () => {
  assert.ok(Array.isArray(data.blocked) && data.blocked.length >= words.length);
  assert.ok(data.blocked.every((h) => Number.isInteger(h) && h >= 0));
  const json = JSON.stringify(data.blocked);
  assert.doesNotMatch(json, /[ء-ي]/);
});

test('«عبد» + اسم ليس من أسماء الله: بلا معنى مخترع، ويختار الزائر', () => {
  for (const [s, shown] of [['عبدالمطلب', 'عبدالمطلب'], ['عبد النبي', 'عبدالنبي'], ['عبد الأمير', 'عبدالأمير']]) {
    const r = R(s);
    assert.equal(r.source, 'choose', s);
    assert.equal(r.meaning, null, s);
    assert.equal(r.canonical, shown, s);
    assert.equal(r.themes.length, 3, s);
  }
  // اسم إلهي خارج الجدول يبقى مركّبًا (السلوك السابق)
  assert.equal(R('عبدالجبار').source, 'compound');
});

test('البناء يرفض كلمة محجوبة هي اسم في القاموس، ويذكر السطر', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blocked-'));
  const file = join(dir, 'blocked.csv');
  writeFileSync(file, 'word,category\nحمار,شتيمة\nمحمد,خطأ\nحمار,مكرر\n');
  const { errors } = loadData({ blockedFile: file });
  assert.ok(errors.some((e) => e.includes('سطر 3') && e.includes('محمد')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('سطر 4') && e.includes('مكرر')), errors.join('\n'));
});
