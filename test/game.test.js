// «شاعر أم آلة؟»: البيانات، والعرض العادل، وتوزيع الجولات
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/build.js';
import { gamePool, pickRounds, plain, seeded, verdict } from '../src/game.js';

const { data, allMachine } = loadData();
const pool = gamePool(data);
const poets = pool.filter((v) => v.kind === 'poet');
const machine = pool.filter((v) => v.kind === 'machine');

test('أبيات الآلة: كلها تستقيم على بحورها (يتحقق منها البناء)، ولكل بيت نموذج معلن', () => {
  assert.ok(machine.length >= 30, `أبيات الآلة ${machine.length}`);
  assert.equal(machine.length, allMachine.filter((m) => m.status !== 'مستبعد').length);
  for (const m of data.machine) assert.ok(m.model && m.meter && m.first && m.second, m.id);
});

test('العرض العادل: لا تشكيل ولا ترقيم في أي بيت، ولا شطر مكرر بين الشاعر والآلة', () => {
  for (const v of pool) {
    for (const s of [v.first, v.second]) {
      assert.doesNotMatch(s, /[ً-ْٰ]/, v.id);
      assert.doesNotMatch(s, /[!؟،.«»]/, v.id);
      assert.ok(s.length > 10, v.id);
    }
  }
  const halves = new Set(poets.flatMap((v) => [v.first, v.second]));
  for (const v of machine) assert.ok(!halves.has(v.first) && !halves.has(v.second), v.id);
  assert.equal(plain('وَمَا الْعِلْمُ إِلَّا مِشْعَلٌ!'), 'وما العلم إلا مشعل');
  assert.equal(plain('فَاللّٰهُ أَقْرَبُ'), 'فالله أقرب');
});

test('لا يكشف الطولُ المصدر: متوسط طول البيت متقارب بين الشاعر والآلة (±15%)', () => {
  const mean = (list) => list.reduce((s, v) => s + v.first.length + v.second.length, 0) / list.length;
  const ratio = mean(machine) / mean(poets);
  assert.ok(ratio > 0.85 && ratio < 1.15, `نسبة الطول ${ratio.toFixed(2)}`);
});

test('الجولات: عشرة أبيات بلا تكرار، والآلة بين 4 و6، وكل الأنواع ممكنة', () => {
  const counts = new Set();
  for (let s = 1; s <= 300; s++) {
    const rounds = pickRounds(pool, 10, seeded(s));
    assert.equal(rounds.length, 10);
    assert.equal(new Set(rounds.map((r) => r.id)).size, 10);
    const k = rounds.filter((r) => r.kind === 'machine').length;
    assert.ok(k >= 4 && k <= 6, `آلة ${k}`);
    counts.add(k);
  }
  assert.deepEqual([...counts].sort(), [4, 5, 6]);
});

test('الجولات: تقدّم ما لم يره الزائر، ثم تعود لما رآه حين ينفد الجديد', () => {
  const first = pickRounds(pool, 10, seeded(7));
  const second = pickRounds(pool, 10, seeded(8), new Set(first.map((r) => r.id)));
  assert.equal(second.filter((r) => first.some((f) => f.id === r.id)).length, 0);
  const all = new Set(pool.map((v) => v.id));
  assert.equal(pickRounds(pool, 10, seeded(9), all).length, 10);
});

test('الحكم على النتيجة', () => {
  assert.equal(verdict(10), 'عينٌ لا تخطئ الشعر.');
  assert.match(verdict(0), /خدعتك الآلة/);
});

test('الذهاب والعودة: ورقة «أبيات الآلة» المصدَّرة تُبنى إلى نفس البيانات، والوزن يُفحص عند الاستيراد', async () => {
  const { fileURLToPath } = await import('node:url');
  const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const sheet = fileURLToPath(new URL('../review/machine-review.csv', import.meta.url));
  const back = loadData({ machineFile: sheet });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.data.machine, data.machine);
  // مراجِع عدّل كلمة فكسر الوزن: الاستيراد يرفضه ويذكر السطر
  const broken = readFileSync(sheet, 'utf8').replace('وَمَا الْعِلْمُ إِلَّا مِشْعَلٌ', 'وَمَا الْعِلْمُ إِلَّا مِشْعَلٌ كَبِيرٌ');
  const dir = mkdtempSync(join(tmpdir(), 'machine-'));
  writeFileSync(join(dir, 'm.csv'), broken);
  const bad = loadData({ machineFile: join(dir, 'm.csv') });
  assert.ok(bad.errors.some((e) => e.includes('m01') && e.includes('لا يستقيم')), bad.errors.join('\n'));
});
