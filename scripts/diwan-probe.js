// فحص مفتاح الديوان واكتشاف مواضيع الاقتباسات — 3 طلبات عامة فقط من رصيد الشهر
// الاستخدام (PowerShell):  $env:ALDIWAN_API_KEY="..." ; node scripts/diwan-probe.js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const key = process.env.ALDIWAN_API_KEY;
if (!key) {
  console.error('❌ ضع المفتاح في متغير البيئة ALDIWAN_API_KEY أولًا (لا تكتبه داخل أي ملف في المشروع).');
  process.exit(1);
}
const BASE = 'https://api.aldiwan.net/v1';
const PAGES = 3;

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body.error || {};
    throw new Error(`HTTP ${res.status} ${e.code || ''} ${e.message || ''} (request_id: ${e.request_id || '-'})`);
  }
  return { body, remaining: res.headers.get('x-monthlyquota-remaining') };
}

const topics = new Map();
let total = null;
let remaining = null;
for (let page = 1; page <= PAGES; page++) {
  const { body, remaining: r } = await get(`/quotes?per_page=50&page=${page}`);
  remaining = r;
  total = body.meta?.total ?? total;
  for (const q of body.data || []) {
    const t = q.topic || '(بلا موضوع)';
    topics.set(t, (topics.get(t) || 0) + 1);
  }
  if (!body.links?.next) break;
}

const sorted = [...topics.entries()].sort((a, b) => b[1] - a[1]);
console.log(`✅ المفتاح يعمل. إجمالي الاقتباسات المنشورة: ${total ?? 'غير معروف'} — المتبقي من رصيد الشهر: ${remaining ?? 'غير معروف'}`);
console.log('المواضيع في العينة (العدد):');
for (const [t, n] of sorted) console.log(`  ${t}: ${n}`);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'diwan-topics.json');
writeFileSync(out, JSON.stringify({ sampledAt: new Date().toISOString(), total, topics: Object.fromEntries(sorted) }, null, 2));
console.log(`\nحُفظت المواضيع في data/diwan-topics.json — أرسلها لي لنربطها بالمواضيع الأربعة عشر.`);
