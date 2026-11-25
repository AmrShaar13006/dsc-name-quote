// الموقع عربي كله: لا حرف لاتيني في ما يراه الزائر، واسم النادي «نادي علم البيانات»
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../ui/', import.meta.url));
const pages = readdirSync(dir).filter((f) => f.endsWith('.template.html') || f === 'poster.html' || f === '404.html');
const LATIN = /[A-Za-z]/;
const ARABIC = /[ء-ي]/;

for (const page of pages) {
  const html = readFileSync(dir + page, 'utf8');
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '');

  test(`${page}: نص الصفحة وعناوينها بلا حروف لاتينية`, () => {
    for (const t of markup.replace(/<[^>]*>/g, '\n').replace(/&\w+;/g, '').split('\n')) assert.doesNotMatch(t, LATIN, t.trim());
    for (const m of markup.matchAll(/\s(?:aria-label|placeholder|alt|title)="([^"]*)"/g)) assert.doesNotMatch(m[1], LATIN, m[1]);
    for (const m of markup.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)"/g)) assert.doesNotMatch(m[1], LATIN, m[1]);
  });

  test(`${page}: نصوص الكود المعروضة بلا حروف لاتينية`, () => {
    const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    for (const line of code.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))) {
      for (const m of line.matchAll(/'([^'\n]*)'/g)) if (ARABIC.test(m[1]) && !m[1].includes('<')) assert.doesNotMatch(m[1].replace('.png', ''), LATIN, m[1]);
      for (const m of line.matchAll(/fillText\('([^']*)'/g)) assert.doesNotMatch(m[1], LATIN, m[1]);
    }
    assert.doesNotMatch(html, /JetBrains|vercel\.app/);
  });

  test(`${page}: اسم النادي`, () => assert.doesNotMatch(html, /علوم البيانات|\bDSC\b|Claude/));
}

test('لا إزاحة سالبة كبيرة: تمدّ صفحة RTL أفقيًا فتظهر فارغة على الجوال', () => {
  for (const page of pages) assert.doesNotMatch(readFileSync(dir + page, 'utf8'), /left:s*-d{3,}px/, page);
});
