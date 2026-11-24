import { splitVerse } from '../src/verse.js';
// وسيط الديوان: المفتاح يبقى في الخادم (متغير البيئة ALDIWAN_API_KEY) ولا يصل إلى المتصفح.
// لا يقبل إلا ثلاثة طلبات محددة، ويخزّن النتائج في ذاكرة Vercel المؤقتة ليوفّر الرصيد.
const BASE = 'https://api.aldiwan.net/v1';

async function diwan(path) {
  const res = await fetch(BASE + path, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.ALDIWAN_API_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body, remaining: res.headers.get('x-monthlyquota-remaining') };
}

const clean = (q) => ({
  id: q.id,
  text: q.text,
  topic: q.topic ?? null,
  author: q.author?.name ?? q.author ?? null,
  attribution: q.attribution ?? null,
});

export default async function handler(req, res) {
  if (!process.env.ALDIWAN_API_KEY) return res.status(500).json({ error: 'ALDIWAN_API_KEY غير مضبوط' });
  const action = String(req.query.action || 'ping');

  try {
    if (action === 'ping') {
      const r = await diwan('/quotes/random');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(r.status).json(r.ok ? { ok: true, quotaRemaining: r.remaining, sample: clean(r.body.data || {}) } : { ok: false, error: r.body.error });
    }

    if (action === 'topics') {
      const topics = {};
      let total = null, remaining = null;
      for (let page = 1; page <= 3; page++) {
        const r = await diwan(`/quotes?per_page=50&page=${page}`);
        if (!r.ok) return res.status(r.status).json({ ok: false, error: r.body.error });
        remaining = r.remaining;
        total = r.body.meta?.total ?? total;
        for (const q of r.body.data || []) topics[q.topic || '(بلا موضوع)'] = (topics[q.topic || '(بلا موضوع)'] || 0) + 1;
        if (!r.body.links?.next) break;
      }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({ ok: true, total, quotaRemaining: remaining, topics });
    }

    if (action === 'quotes') {
      const topic = String(req.query.topic || '').slice(0, 60);
      if (!topic) return res.status(400).json({ ok: false, error: 'topic مطلوب' });
      const r = await diwan(`/quotes?topic=${encodeURIComponent(topic)}&per_page=20`);
      if (!r.ok) return res.status(r.status).json({ ok: false, error: r.body.error });
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({ ok: true, topic, quotaRemaining: r.remaining, total: r.body.meta?.total ?? null, quotes: (r.body.data || []).map(clean) });
    }

    if (action === 'probe') {
      // فحص مواضيع مرشّحة: العدد + عيّنتان + النص الخام لأول اقتباس (لنرى فواصل الأبيات)
      const list = String(req.query.topics || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 25);
      if (!list.length) return res.status(400).json({ ok: false, error: 'topics مطلوب (مفصولة بفواصل)' });
      const out = {};
      let remaining = null;
      for (const topic of list) {
        const r = await diwan(`/quotes?topic=${encodeURIComponent(topic)}&per_page=2`);
        remaining = r.remaining ?? remaining;
        if (!r.ok) { out[topic] = { error: r.body.error?.code || r.status }; continue; }
        const data = r.body.data || [];
        out[topic] = {
          total: r.body.meta?.total ?? data.length,
          samples: data.map((q) => String(q.text || '').slice(0, 90)),
          raw: data[0] ? JSON.stringify({ title: data[0].title, text: data[0].text, keys: Object.keys(data[0]) }) : null,
        };
      }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({ ok: true, quotaRemaining: remaining, topics: out });
    }

    if (action === 'pool') {
      // أبيات مفردة فقط، مقسومة إلى شطرين، بصيغة مضغوطة للانتقاء
      // ?action=pool&topics=صبر,حكمة&pages=2   (كل صفحة = طلب واحد من الرصيد، بحد أقصى 12 طلبًا)
      const list = String(req.query.topics || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
      const pages = Math.min(Math.max(parseInt(req.query.pages, 10) || 1, 1), 3);
      if (!list.length) return res.status(400).json({ ok: false, error: 'topics مطلوب' });
      const out = {};
      let calls = 0, remaining = null, stopped = null;
      outer: for (const topic of list) {
        out[topic] = { total: null, scanned: 0, verses: [] };
        for (let page = 1; page <= pages; page++) {
          if (calls >= 12) { stopped = 'call_budget'; break outer; }
          const r = await diwan(`/quotes?topic=${encodeURIComponent(topic)}&per_page=50&page=${page}`);
          calls++;
          remaining = r.remaining ?? remaining;
          if (r.status === 429) { stopped = 'rate_limited'; break outer; }
          if (!r.ok) { out[topic].error = r.body.error?.code || r.status; break; }
          out[topic].total = r.body.meta?.total ?? out[topic].total;
          for (const q of r.body.data || []) {
            out[topic].scanned++;
            const s = splitVerse(q.title, q.text);
            if (!s || !s.singleVerse) continue;
            out[topic].verses.push({
              id: q.id,
              a: s.first,
              b: s.second,
              by: q.author?.name ?? q.author ?? null,
              url: q.attribution?.url ?? null,
            });
          }
          if (!r.body.links?.next) break;
        }
      }
      // نتيجة ناقصة (حد الطلبات) لا تُخزَّن، وإلا بقيت فارغة يومًا كاملًا
      res.setHeader('Cache-Control', stopped ? 'no-store' : 's-maxage=86400, stale-while-revalidate=3600');
      return res.status(200).json({ ok: true, calls, quotaRemaining: remaining, stopped, topics: out });
    }

    return res.status(404).json({ ok: false, error: 'طلب غير معروف. المتاح: ping, topics, quotes, probe, pool' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'تعذّر الوصول إلى الديوان', detail: String(e.message || e).slice(0, 200) });
  }
}
