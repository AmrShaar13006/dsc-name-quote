// التحقق من الأبيات في «ويكي مصدر» (ar.wikisource.org): نصوص عامة لا قيود على حفظها.
// يبحث عن البيت، ويقرأ صفحة القصيدة، ويطابق الحروف (بلا تشكيل) حرفًا بحرف، ويتأكد من اسم الشاعر في الصفحة.
//
//   node scripts/wikisource.js find <مرشحات.csv> [نتيجة.json]
//       المرشحات: first,second,author[,themes,note]. النتيجة لكل بيت: الصفحة، ونص البيت كما في المصدر، وهل طابق تمامًا.
//   node scripts/wikisource.js check
//       يعيد فحص كل أبيات ويكي مصدر في data/quotes.csv (هل ما زال نصها في صفحتها؟).
//
// يرسل طلبًا واحدًا كل ثانيتين على الأقل، ويتمهّل إذا طلب الموقع ذلك.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, loadData, WIKI } from './build.js';

const API = 'https://ar.wikisource.org/w/api.php';
const UA = 'VerseCheck/1.0 (educational, non-commercial)';
export { WIKI };

// هيكل الحروف: بلا تشكيل ولا تطويل ولا همزات ولا ترقيم ولا مسافات، لأن طبعات الدواوين تختلف فيها
export function skeleton(s) {
  return String(s ?? '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/[ئى]/g, 'ي').replace(/ة/g, 'ه').replace(/ء/g, '')
    .replace(/ک/g, 'ك').replace(/ی/g, 'ي')
    .replace(/[^ء-ي]/g, '');
}

// صفحة قصيدة: {{ترويسة|عنوان=…|مؤلف=…}} ثم الأبيات، كل بيت في سطر وشطراه مفصولان بـ \\ (قالب «أبيات»)
// أو {{بيت|الشطر الأول|الشطر الثاني}}
export function parsePoem(wikitext) {
  const text = String(wikitext ?? '');
  const author = (text.match(/\|\s*مؤلف\s*=\s*(?:\[\[(?:مؤلف:)?)?([^\]|}\n]+)/) || [])[1]?.trim() || null;
  const clean = (s) => s.replace(/<ref[^>]*>[\s\S]*?<\/ref>|<[^>]+>/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/^\{\{أبيات\|/, '').replace(/\}\}\s*$/, '').trim();
  const verses = [];
  for (const line of text.split('\n')) {
    if (line.includes('\\\\')) {
      const [a, b] = line.split('\\\\');
      if (a && b) verses.push([clean(a), clean(b)]);
    }
  }
  for (const m of text.matchAll(/\{\{بيت\|([^|}]+)\|([^|}]+)\}\}/g)) verses.push([clean(m[1]), clean(m[2])]);
  return { author, verses: verses.filter(([a, b]) => skeleton(a) && skeleton(b)) };
}

export const pageUrl = (title) => WIKI + title.replace(/ /g, '_').replace(/[?#%"]/g, encodeURIComponent);

// مسافة التحرير بين هيكلين (للمطابقة التقريبية حين تختلف الرواية)
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
const similarity = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
const sameAuthor = (a, b) => { const x = skeleton(a), y = skeleton(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

let last = 0;
async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: 2, ...params })) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = last + 2000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    const body = await res.text();
    if (res.ok) { try { return JSON.parse(body); } catch { /* صفحة «طلبات كثيرة» */ } }
    await new Promise((r) => setTimeout(r, 15000 * 2 ** attempt));
  }
  throw new Error('ويكي مصدر لا يستجيب الآن');
}

// يبحث ويعيد الصفحات مع نصها في طلب واحد
async function searchPages(query) {
  const j = await api({ action: 'query', generator: 'search', gsrsearch: query, gsrlimit: 10, gsrnamespace: 0, prop: 'revisions', rvprop: 'content', rvslots: 'main' });
  return (j.query?.pages || []).map((p) => ({ title: p.title, wikitext: p.revisions?.[0]?.slots?.main?.content || '' }));
}
export async function fetchPage(title) {
  const j = await api({ action: 'query', titles: title, prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: 1 });
  const p = j.query?.pages?.[0];
  return p && !p.missing ? { title: p.title, wikitext: p.revisions?.[0]?.slots?.main?.content || '' } : null;
}

const words = (s) => String(s).replace(/[ً-ٰٟـ]/g, '').replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

// أفضل موضع للبيت في صفحات البحث: مطابقة تامة في صفحة قصيدة لنفس الشاعر أولًا
export function bestMatch(pages, first, second, author) {
  const target = skeleton(first + second), t1 = skeleton(first), t2 = skeleton(second);
  let best = null;
  for (const p of pages) {
    const poem = parsePoem(p.wikitext);
    if (!poem.verses.length) continue;
    poem.verses.forEach(([a, b], i) => {
      const s = skeleton(a + b);
      const score = s === target ? 1 : Math.max(similarity(s, target), (skeleton(a) === t1 || skeleton(b) === t2) ? 0.9 : 0);
      const rank = score + (sameAuthor(poem.author, author) ? 0.5 : 0) + (poem.author ? 0.1 : 0);
      if (!best || rank > best.rank) best = { rank, score, exact: s === target, title: p.title, url: pageUrl(p.title), author: poem.author, first: a, second: b, line: i + 1 };
    });
  }
  return best;
}

export async function findVerse({ first, second, author }) {
  const queries = [`${words(first)} ${words(author || '')}`.trim(), words(first), words(second)];
  let best = null;
  for (const q of queries) {
    const m = bestMatch(await searchPages(q), first, second, author);
    if (m && (!best || m.rank > best.rank)) best = m;
    if (best?.exact && sameAuthor(best.author, author)) break;
  }
  if (!best || best.score < 0.75) return { status: 'missing' };
  const { rank, ...rest } = best;
  return { status: best.exact ? (sameAuthor(best.author, author) ? 'exact' : 'exact-other-author') : 'close', ...rest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, inFile, outFile] = process.argv.slice(2);
  if (mode === 'find' && inFile) {
    const rows = parseCsv(readFileSync(resolve(inFile), 'utf8'));
    const head = rows[0].map((h) => h.trim());
    const list = rows.slice(1).map((r) => Object.fromEntries(head.map((h, j) => [h, (r[j] ?? '').trim()])));
    const out = [];
    for (const [i, c] of list.entries()) {
      const r = await findVerse(c).catch((e) => ({ status: 'error', error: e.message }));
      out.push({ ...c, found: r });
      console.log(`${i + 1}/${list.length} ${r.status.padEnd(18)} ${c.author} — ${c.first}${r.title ? `  ←  ${r.title} (${r.author ?? '?'})` : ''}`);
      if (outFile) writeFileSync(resolve(outFile), JSON.stringify(out, null, 1));
    }
  } else if (mode === 'check') {
    const { allQuotes } = loadData();
    let bad = 0;
    for (const q of allQuotes.filter((x) => String(x.url).startsWith(WIKI))) {
      const title = decodeURIComponent(q.url.slice(WIKI.length)).replace(/_/g, ' ');
      const page = await fetchPage(title);
      const ok = page && parsePoem(page.wikitext).verses.some(([a, b]) => skeleton(a + b) === skeleton(q.first + q.second));
      if (!ok) bad++;
      console.log(`${ok ? '✅' : '❌'} ${q.id} ${q.author} — ${q.first}`);
    }
    process.exit(bad ? 1 : 0);
  } else {
    console.error('الاستخدام: node scripts/wikisource.js find <مرشحات.csv> [نتيجة.json]  |  node scripts/wikisource.js check');
    process.exit(1);
  }
}
