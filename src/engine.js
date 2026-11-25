// محرك "من اسمه نصيب": الاسم ← المعنى ← الموضوع ← اقتباس ثابت
// بلا مكتبات خارجية — يعمل في المتصفح وفي Node.

// ---------- التطبيع ----------
const TASHKEEL = /[ً-ٰٟـ]/g; // الحركات والتطويل

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const rootKey = (root) => normalize(String(root).replace(/-/g, ''));

// ---------- تجزئة ثابتة (FNV-1a) ----------
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------- الكلمات المحجوبة ----------
// نحفظ بصمة الكلمة لا الكلمة نفسها، بصيغتها المطبّعة وبعد ضغط الحروف المكررة (حماااار ← حمار).
const squeeze = (w) => w.replace(/(.)\1+/g, '$1');
export function blockHashes(word) {
  const w = normalize(word).replace(/\s/g, '');
  return [...new Set([w, squeeze(w)])].filter(Boolean).map(hash);
}

// ---------- أوزان الأسماء لاستخراج الجذر ----------
// الأرقام 1 و2 و3 هي حروف الجذر (ف ع ل)، والباقي حروف زائدة.
// القالب ذو الخانتين يعني جذرًا مضعّفًا (عز ← ع-ز-ز).
// الترتيب مهم: الأطول والأخص أولًا.
const TEMPLATES = [
  'ا1ت2ا3', // افتعال: ابتسام
  'ا12ا3',  // إفعال: إحسان
  'ت12ي3',  // تفعيل: تسنيم
  'م12و3',  // مفعول: محمود
  'م1ا23',  // مُفاعِل: مساعد
  'م1ت23',  // مفتعِل: معتصم
  'م1ت2',   // مفتعّ: معتز
  '123اء',  // فعلاء: ميساء، هيفاء
  'م123ه',  // مُفعِلة: منيرة
  '1ا23ه',  // فاعلة: فاطمة
  '12ي3ه',  // فعيلة: جميلة
  '12ا3ه',  // فعالة: جمانة
  '1ا2ا3',  // فاعال: راكان
  '123ان',  // فعلان: سلمان
  '12ا3',   // فعال: جمال
  '12ي3',   // فعيل: سعيد
  '12و3',   // فعول: سعود
  '1ا23',   // فاعل: سالم
  'ا123',   // أفعل: أحمد
  'م123',   // مفعل: محمد
  '123ه',   // فعلة: بسمة
  '1ا2ه',   // فاعّة: سارّة
  '123ي',   // فعلى / نسبة: سلمى، مجدي
  '123ا',   // فعلا: ريما، ديما
  '123و',   // عمرو
  '123',    // فعل: سعد
  '12ه',    // فعّة: حصة
  '12',     // فعّ: عز
].map((t) => {
  const slots = (t.match(/[123]/g) || []).length;
  const re = new RegExp('^' + t.replace(/[123]/g, '(.)') + '$');
  return { t, re, slots };
});

const WEAK = ['ا', 'و', 'ي', 'ء'];

function weakVariants(r) {
  // بدائل حروف العلة والهمزة. الحرف الأول أضيق: الألف تبقى همزة (أسامة ليست من و-س-م)،
  // والواو والياء الأوليان قد تكونان همزة مطبّعة (مؤمن ← أ-م-ن) أو تتبادلان (إيهاب ← و-ه-ب).
  const out = [];
  const idx = [...r].map((c, i) => (WEAK.includes(c) ? i : -1)).filter((i) => i >= 0);
  const optionsAt = (i) => {
    if (i > 0) return WEAK;
    return r[0] === 'ا' || r[0] === 'ء' ? ['ا', 'ء'] : ['ا', 'و', 'ي'];
  };
  const expand = (s, k) => {
    if (k === idx.length) return;
    const i = idx[k];
    for (const w of optionsAt(i)) {
      const v = s.slice(0, i) + w + s.slice(i + 1);
      if (!out.includes(v)) out.push(v);
      expand(v, k + 1);
    }
    expand(s, k + 1);
  };
  expand(r, 0);
  return out;
}

export function rootCandidates(word) {
  const w = normalize(word).replace(/\s/g, '');
  const forms = [w];
  if (w.startsWith('ال') && w.length >= 5) forms.push(w.slice(2));
  const cands = [];
  for (const f of forms) {
    for (const { re, slots } of TEMPLATES) {
      const m = f.match(re);
      if (!m) continue;
      const letters = m.slice(1);
      const r = slots === 2 ? letters[0] + letters[1] + letters[1] : letters.join('');
      if (!cands.includes(r)) cands.push(r);
    }
  }
  return cands;
}

// ---------- تجهيز البيانات ----------
export function createEngine(data) {
  const themes = new Map(data.themes.map((t) => [t.id, t]));
  const names = new Map();
  for (const n of data.names) {
    const keys = [n.name, ...(n.variants || [])].map(normalize);
    for (const k of keys) {
      names.set(k, n);
      if (k.startsWith('ال') && k.length >= 5) names.set(k.slice(2), n);
    }
  }
  const roots = new Map(data.roots.map((r) => [rootKey(r.root), r]));
  const divine = new Map(data.divine.map((d) => [normalize(d.name), d]));
  const SECOND_PARTS = new Set(['الدين', 'الهدي', 'الايمان', 'الاسلام', 'الحق'].map(normalize));
  // «عبد» + اسم ليس من أسماء الله: لا نقول «المتعبّد لله باسمه»، ويختار الزائر موضوعه
  const NOT_DIVINE = new Set(['النبي', 'الرسول', 'المطلب', 'الحسين', 'الحسن', 'الزهراء', 'الأمير', 'الإمام', 'المسيح',
    'العزى', 'اللات', 'الكعبة', 'الدار', 'الشمس', 'الصاحب'].map(normalize));
  const blocked = new Set(data.blocked || []);

  // كلمة محجوبة؟ نفحصها مجردة من «ال» و«عبد/عبدال» ومن اللواحق (الله، الدين…) حتى لا تمر مركّبةً
  function isBlocked(word) {
    if (!blocked.size) return false;
    const w = normalize(word).replace(/\s/g, '');
    if (!w) return false;
    const forms = new Set([w]);
    for (const p of ['عبدال', 'عبد', 'ال']) if (w.startsWith(p) && w.length > p.length + 1) forms.add(w.slice(p.length));
    for (const s of [...SECOND_PARTS, 'الله']) if (w.endsWith(s) && w.length > s.length + 1) forms.add(w.slice(0, -s.length));
    for (const f of [...forms]) if (f.startsWith('ال') && f.length > 3) forms.add(f.slice(2));
    for (const f of forms) for (const h of blockHashes(f)) if (blocked.has(h)) return true;
    return false;
  }
  const blockedResult = (input) => ({ input, canonical: null, source: 'blocked', meaning: null, root: null, themes: [], confidence: null });

  function lookup(word) {
    const k = normalize(word);
    if (names.has(k)) return names.get(k);
    if (k.startsWith('ال') && names.has(k.slice(2))) return names.get(k.slice(2));
    return null;
  }

  function findRoot(word) {
    const cands = rootCandidates(word);
    // الجولة الأولى: تطابق تام من أي وزن. الثانية: بدائل حروف العلة.
    for (const c of cands) if (roots.has(c)) return roots.get(c);
    for (const c of cands) {
      for (const v of weakVariants(c)) {
        if (roots.has(v)) return roots.get(v);
      }
    }
    return null;
  }

  function fromEntry(entry, input, extra = {}) {
    return {
      input,
      canonical: entry.name,
      source: 'dictionary',
      meaning: entry.meaning,
      root: entry.root || null,
      themes: entry.themes,
      confidence: entry.confidence,
      ...extra,
    };
  }

  function chooseResult(input, key, source = 'choose') {
    // ثلاثة مواضيع ثابتة لكل اسم يختار منها الزائر
    const ids = [...themes.keys()];
    const picks = [];
    let h = hash(key || input || 'x');
    while (picks.length < 3) {
      const id = ids[h % ids.length];
      if (!picks.includes(id)) picks.push(id);
      h = hash(String(h));
    }
    return { input, canonical: null, source, meaning: null, root: null, themes: picks, confidence: null };
  }

  function resolve(rawInput) {
    const input = String(rawInput ?? '').trim();
    const n = normalize(input);
    if (!n) {
      if (/[A-Za-z]/.test(input)) return chooseResult(input, input.toLowerCase(), 'latin');
      return { input, canonical: null, source: 'empty', meaning: null, root: null, themes: [], confidence: null };
    }
    const tokens = n.split(' ');
    let first = tokens[0];

    // عبد + اسم من أسماء الله (متصل أو منفصل)
    let divinePart = null;
    if (first === 'عبد' && tokens[1]?.startsWith('ال')) divinePart = tokens[1];
    else if (first.startsWith('عبدال') && first.length > 5) divinePart = first.slice(3);
    if (divinePart) {
      const d = divine.get(divinePart);
      if (!d && isBlocked(divinePart)) return blockedResult(input);
      if (!d && NOT_DIVINE.has(divinePart)) {
        const raw = input.split(/\s+/);
        const shown = first.startsWith('عبدال') ? raw[0] : raw.slice(0, 2).join('');
        return { ...chooseResult(input, 'عبد' + divinePart), canonical: shown };
      }
      const label = d ? d.name : divinePart;
      const meaning = divinePart === 'الله' ? 'عبدٌ لله' : `المتعبّد لله باسمه «${label}»`;
      return {
        input,
        canonical: 'عبد' + label,
        source: 'compound',
        meaning,
        root: 'ع-ب-د',
        themes: d ? d.themes : ['iman'],
        confidence: d ? 'عالية' : 'متوسطة',
      };
    }

    // X الله (ضيف الله، عطا الله، جار الله...) متصل أو منفصل
    let allahBase = null;
    if (tokens[1] === 'الله') allahBase = first;
    else if (first.endsWith('الله') && first.length > 5) allahBase = first.slice(0, -4);
    if (allahBase) {
      const whole = names.get(allahBase + ' الله') || names.get(allahBase + 'الله');
      if (whole) return fromEntry(whole, input, { source: 'compound' });
      const base = lookup(allahBase);
      if (base) {
        return fromEntry(base, input, {
          canonical: `${base.name} الله`,
          source: 'compound',
          meaning: `${base.meaning}، منسوبًا إلى الله`,
          themes: [...new Set([...base.themes, 'iman'])],
        });
      }
      if (isBlocked(allahBase)) return blockedResult(input);
      return {
        input, canonical: `${allahBase} الله`, source: 'compound',
        meaning: 'اسم منسوب إلى الله', root: null, themes: ['iman'], confidence: 'متوسطة',
      };
    }

    // X الدين / X الهدى ... (متصل أو منفصل)
    let second = null;
    if (tokens[1] && SECOND_PARTS.has(tokens[1])) second = tokens[1];
    else {
      for (const s of SECOND_PARTS) {
        if (first.endsWith(s) && first.length > s.length + 1) {
          second = s;
          first = first.slice(0, -s.length);
          break;
        }
      }
    }
    if (second) {
      const e = lookup(first);
      if (e) {
        const secondLabel = { الدين: 'الدين', الهدي: 'الهدى', الايمان: 'الإيمان', الاسلام: 'الإسلام', الحق: 'الحق' }[second];
        const themesC = [...new Set([...e.themes, 'iman'])];
        return fromEntry(e, input, {
          canonical: `${e.name} ${secondLabel}`,
          source: 'compound',
          meaning: `${e.meaning}، منسوبًا إلى ${secondLabel}`,
          themes: themesC,
        });
      }
    }

    // القاموس
    const e = lookup(first);
    if (e) return fromEntry(e, input);

    // ما بعد القاموس يُكتب كما كتبه الزائر، فنفحصه قبل الجذر و«اختر»
    if (isBlocked(first)) return blockedResult(input);

    // الجذر
    const r = findRoot(first);
    if (r) {
      return {
        input,
        canonical: null,
        source: 'root',
        meaning: `من جذر «${r.root}» الدال على ${r.gloss}`,
        root: r.root,
        themes: r.themes,
        confidence: 'تقديرية',
      };
    }

    return chooseResult(input, first);
  }

  // اختيار اقتباس ثابت: نفس الاسم + نفس الموضوع = نفس الاقتباس دائمًا.
  // offset يعطي «بيتًا آخر» من نفس الموضوع دون عشوائية.
  function pickQuote(result, pool, themeId = result.themes[0], offset = 0) {
    if (!pool || pool.length === 0) return null;
    const sorted = [...pool].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
    const key = normalize(result.canonical || result.input) + '|' + themeId;
    return sorted[(hash(key) + offset) % sorted.length];
  }

  // «ما يستوحيه الاسم من صفات» و«شخصيات تاريخية تحمل اسمك»: مطابقة تامة على الاسم القانوني (canonical) فقط،
  // لا على الجذر أو الموضوع، فحسّان لا يطابق حسن ولا يرث صفات غيره من المشتقّات
  const attrKey = (name) => normalize(name).replace(/\s/g, '');
  const attributesByName = new Map();
  for (const a of data.attributes || []) {
    const k = attrKey(a.name);
    if (!attributesByName.has(k)) attributesByName.set(k, []);
    attributesByName.get(k).push(a);
  }
  const figuresByName = new Map();
  for (const f of data.figures || []) {
    const k = attrKey(f.name);
    if (!figuresByName.has(k)) figuresByName.set(k, []);
    figuresByName.get(k).push(f);
  }
  // «شخصيات مشهورة»: صفحة مستقلة عن الشخصيات التاريخية، لا تشترط أن تكون الشخصية تاريخية أو سياسية
  const celebritiesByName = new Map();
  for (const c of data.celebrities || []) {
    const k = attrKey(c.name);
    if (!celebritiesByName.has(k)) celebritiesByName.set(k, []);
    celebritiesByName.get(k).push(c);
  }
  function attributesFor(result) {
    if (!result.canonical) return [];
    return (attributesByName.get(attrKey(result.canonical)) || []).map((a) => a.attribute);
  }
  function figuresFor(result) {
    if (!result.canonical) return [];
    return figuresByName.get(attrKey(result.canonical)) || [];
  }
  function celebritiesFor(result) {
    if (!result.canonical) return [];
    return celebritiesByName.get(attrKey(result.canonical)) || [];
  }

  const quotesByTheme = new Map();
  for (const q of data.quotes || []) {
    for (const t of q.themes) {
      if (!quotesByTheme.has(t)) quotesByTheme.set(t, []);
      quotesByTheme.get(t).push(q);
    }
  }

  // الاقتباس المناسب من المجموعة المختارة لهذا الموضوع
  function quoteFor(result, themeId = result.themes[0], offset = 0) {
    return pickQuote(result, quotesByTheme.get(themeId), themeId, offset);
  }

  return { resolve, pickQuote, quoteFor, quotesByTheme, lookup, findRoot, themes, isBlocked, attributesFor, figuresFor, celebritiesFor };
}
