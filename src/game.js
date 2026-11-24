// «شاعر أم آلة؟»: منطق اللعبة. بلا مكتبات، يعمل في المتصفح وفي Node (يُحقن في ui/game.html).

// نعرض الأبيات كلها بلا تشكيل ولا ترقيم: التشكيل في أبيات الشعراء متفاوت بحسب مصدرها،
// وأبيات الآلة مشكولة تمامًا، فلو أبقيناه لكشف المصدر من شكله لا من شعره.
export function plain(s) {
  return String(s ?? '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[!؟?،,.:؛;«»"'()\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// كل الأبيات في جدول واحد: الشاعر من ويكي مصدر (مع الإسناد)، والآلة من machine.csv
export function gamePool(data) {
  const poets = (data.quotes || []).map((q) => ({
    id: `q${q.id}`, kind: 'poet', first: plain(q.first), second: plain(q.second), author: q.author, url: q.url, themes: q.themes,
  }));
  const machine = (data.machine || []).map((m) => ({
    id: m.id, kind: 'machine', first: plain(m.first), second: plain(m.second), model: m.model, meter: m.meter, themes: m.themes,
  }));
  return [...poets, ...machine];
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// جولات اللعبة: عدد أبيات الآلة بين 40% و60% (لا خمسة بالضبط، حتى لا يُحسب الباقي)،
// بلا تكرار، ونقدّم ما لم يره الزائر من قبل (avoid).
export function pickRounds(pool, n = 10, rand = Math.random, avoid = new Set()) {
  const lo = Math.floor(n * 0.4), hi = Math.ceil(n * 0.6);
  const nMachine = lo + Math.floor(rand() * (hi - lo + 1));
  const take = (kind, k) => {
    const all = pool.filter((v) => v.kind === kind);
    const fresh = shuffle(all.filter((v) => !avoid.has(v.id)), rand);
    const seen = shuffle(all.filter((v) => avoid.has(v.id)), rand);
    return [...fresh, ...seen].slice(0, k);
  };
  return shuffle([...take('machine', nMachine), ...take('poet', n - nMachine)], rand);
}

// مولّد أرقام عشوائية ثابت للاختبارات (mulberry32)
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function verdict(score, n = 10) {
  const r = score / n;
  if (r === 1) return 'عينٌ لا تخطئ الشعر.';
  if (r >= 0.8) return 'ذائقة شعرية عالية، والآلة لم تخدعك إلا قليلًا.';
  if (r >= 0.6) return 'ذائقة جيدة، والآلة خدعتك أحيانًا.';
  if (r >= 0.4) return 'الآلة تقترب من الشعراء أكثر مما نظن.';
  return 'خدعتك الآلة هذه المرة. جرّب مرة أخرى.';
}
