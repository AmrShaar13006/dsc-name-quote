// يحوّل ملفات CSV (المصدر الذي يحرره المراجِع) إلى data.js و bundle.json
// ويتوقف بخطأ واضح إن وجد مشكلة في البيانات.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import { normalize, blockHashes } from '../src/engine.js';
import { METERS, metersOf } from '../src/prosody.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// صفحات القصائد في ويكي مصدر: المصدر الوحيد للأبيات (انظر scripts/wikisource.js)
export const WIKI = 'https://ar.wikisource.org/wiki/';

// قارئ CSV يدعم الحقول بين علامتي تنصيص (كما يصدّرها Excel والجدول)
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// عناوين الأعمدة بالعربية (نسخة المراجِع) ← المفاتيح الداخلية
const HEADER_ALIASES = {
  الاسم: 'name', 'صيغ بديلة': 'variants', الجنس: 'gender', الجذر: 'root', المعنى: 'meaning',
  المواضيع: 'themes', الثقة: 'confidence', ملاحظة: 'review_note',
  // ورقة «الاقتباسات»
  'رقم الديوان': 'id', الحالة: 'status', 'الشطر الأول': 'first', 'الشطر الثاني': 'second',
  الشاعر: 'author', الرابط: 'url', 'تصنيف الديوان': 'topic', القصيدة: 'topic',
  // ورقة «أبيات الآلة»
  المعرّف: 'id', البحر: 'meter', النموذج: 'model',
  // ورقة «الصفات»
  الصفة: 'attribute', 'نوع العلاقة': 'relation', التعليل: 'justification', المصدر: 'source',
  // ورقة «الشخصيات التاريخية»
  'الاسم الكامل': 'full_name', العصر: 'era', الميلاد: 'birth', الوفاة: 'death', المجال: 'field',
  السيرة: 'bio', المساهمة: 'contribution', 'شخصية دينية': 'religious', الصورة: 'image',
  'مصدر الصورة': 'image_credit', 'ترخيص الصورة': 'image_license',
};

export const QUOTE_STATUS = ['مقترح', 'معتمد', 'مستبعد'];
export const ATTRIBUTE_RELATIONS = ['مباشر', 'مرتبط', 'ثقافي', 'تأويل أدبي'];
export const MIN_QUOTES_PER_THEME = 4;
const DIACRITIC_GLITCH = /([ً-ْ])\1|(^|\s)و\s|اَ/;

function readCsv(file) {
  const path = isAbsolute(file) ? file : join(root, 'data', file);
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim()] || h.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? '').trim()])));
}

// المواضيع تُكتب بالمعرّف (nur) أو بالاسم العربي (النور والأمل)، مفصولة بـ | أو + أو ،
let THEME_LABELS = new Map();
const split = (s) => (s ? s.split(/[|+،]/).map((x) => x.trim()).filter(Boolean).map((x) => THEME_LABELS.get(x) || x) : []);

export function loadData({ namesFile = 'names.csv', quotesFile = 'quotes.csv', blockedFile = 'blocked.csv', machineFile = 'machine.csv', attributesFile = 'attributes.csv', figuresFile = 'figures.csv' } = {}) {
  const errors = [];
  const warnings = [];

  const themes = readCsv('themes.csv').map((t) => ({ id: t.id, label: t.label, aldiwanTopic: t.aldiwan_topic || null }));
  const themeIds = new Set(themes.map((t) => t.id));
  THEME_LABELS = new Map(themes.map((t) => [t.label, t.id]));
  const checkThemes = (where, list) => {
    if (list.length === 0) errors.push(`${where}: لا يوجد موضوع`);
    for (const id of list) if (!themeIds.has(id)) errors.push(`${where}: موضوع غير معروف «${id}»`);
  };

  const names = readCsv(namesFile).map((n, i) => {
    const e = {
      name: n.name,
      variants: split(n.variants),
      gender: n.gender,
      root: n.root || null,
      meaning: n.meaning,
      themes: split(n.themes),
      confidence: n.confidence,
      note: n.review_note || null,
    };
    const where = `names.csv سطر ${i + 2} (${e.name})`;
    checkThemes(where, e.themes);
    if (!e.meaning) errors.push(`${where}: المعنى فارغ`);
    if (!['ذكر', 'أنثى', 'مشترك'].includes(e.gender)) errors.push(`${where}: الجنس يجب أن يكون ذكر/أنثى/مشترك`);
    if (!['عالية', 'متوسطة'].includes(e.confidence)) errors.push(`${where}: الثقة يجب أن تكون عالية/متوسطة`);
    if (e.root) {
      const letters = e.root.split('-');
      if (letters.length < 3 || letters.length > 4) errors.push(`${where}: الجذر يجب أن يكون 3 أو 4 أحرف مفصولة بـ -`);
      // كل حرف صحيح (غير حرف علة/همزة) في الجذر يجب أن يظهر في الاسم
      const nn = normalize(e.name);
      for (const L of letters.map(normalize)) {
        if (['ا', 'و', 'ي', 'ء'].includes(L)) continue;
        if (!nn.includes(L)) errors.push(`${where}: الحرف «${L}» من الجذر ${e.root} غير موجود في الاسم`);
      }
    }
    return e;
  });

  // تكرار المفاتيح بعد التطبيع
  const seen = new Map();
  for (const n of names) {
    for (const k of [n.name, ...n.variants].map(normalize)) {
      if (seen.has(k) && seen.get(k) !== n.name) errors.push(`تكرار: «${n.name}» و«${seen.get(k)}» لهما نفس الصيغة «${k}»`);
      seen.set(k, n.name);
    }
  }

  const roots = readCsv('roots.csv').map((r, i) => {
    const e = { root: r.root, themes: split(r.themes), gloss: r.gloss };
    checkThemes(`roots.csv سطر ${i + 2} (${e.root})`, e.themes);
    if (e.root.split('-').length !== 3) errors.push(`roots.csv سطر ${i + 2}: الجذر يجب أن يكون ثلاثيًا`);
    return e;
  });
  const rk = new Map();
  for (const r of roots) {
    const k = normalize(r.root.replace(/-/g, ''));
    if (rk.has(k)) errors.push(`roots.csv: الجذر ${r.root} يتطابق بعد التطبيع مع ${rk.get(k)}`);
    rk.set(k, r.root);
  }

  const divine = readCsv('divine.csv').map((d, i) => {
    const e = { name: d.name, themes: split(d.themes) };
    checkThemes(`divine.csv سطر ${i + 2} (${e.name})`, e.themes);
    return e;
  });

  // الأسماء التي يصح أن تُنسب إليها صفة أو شخصية تاريخية: الاسم القانوني وصيغه في القاموس،
  // ومركّبات «عبد + اسم من أسماء الله» (مطابقة لما يُرجعه resolve في src/engine.js)
  const validTargets = new Set();
  for (const n of names) for (const k of [n.name, ...n.variants].map(normalize)) validTargets.add(k.replace(/\s/g, ''));
  for (const d of divine) validTargets.add(normalize('عبد' + d.name).replace(/\s/g, ''));

  // «ما يستوحيه الاسم من صفات»: تأويل أدبي من المعنى المراجَع، لا حكم على شخصية حامل الاسم
  const allAttributes = readCsv(attributesFile).map((a, i) => {
    const e = {
      name: a.name, attribute: a.attribute, relation: a.relation || null, justification: a.justification || null,
      source: a.source || null, status: a.status || 'مقترح', note: a.review_note || null,
    };
    const where = `attributes.csv سطر ${i + 2} (${e.name} ← ${e.attribute})`;
    if (!validTargets.has(normalize(e.name).replace(/\s/g, ''))) errors.push(`${where}: الاسم «${e.name}» غير موجود في القاموس أو مركّبات أسماء الله`);
    if (!e.attribute) errors.push(`${where}: الصفة فارغة`);
    if (!e.justification) errors.push(`${where}: التعليل مطلوب`);
    if (!ATTRIBUTE_RELATIONS.includes(e.relation)) errors.push(`${where}: نوع العلاقة يجب أن يكون ${ATTRIBUTE_RELATIONS.join('/')}`);
    if (!QUOTE_STATUS.includes(e.status)) errors.push(`${where}: الحالة يجب أن تكون ${QUOTE_STATUS.join('/')}`);
    return e;
  });
  const attrSeen = new Map();
  for (const a of allAttributes) {
    const k = normalize(a.name).replace(/\s/g, '') + '|' + normalize(a.attribute);
    if (attrSeen.has(k)) errors.push(`attributes.csv: «${a.attribute}» مكررة لاسم «${a.name}»`);
    attrSeen.set(k, true);
  }
  const attributes = allAttributes.filter((a) => a.status !== 'مستبعد').map(({ status, note, ...a }) => a);

  // حارس ضد القولبة: نفس مجموعة الصفات (بالضبط) على أكثر من 3 أسماء يعني أننا نكرر نمطًا عامًا
  // بدل اشتقاق صفات من معنى كل اسم على حدة (قاعدة المَهمّة: لا نضع صفات عامة مُطمئنة لمجرد أنها تبدو جذابة)
  const setsByName = new Map();
  for (const a of attributes) {
    if (!setsByName.has(a.name)) setsByName.set(a.name, []);
    setsByName.get(a.name).push(a.attribute);
  }
  const namesBySet = new Map();
  for (const [name, attrs] of setsByName) {
    const key = [...attrs].sort().join('|');
    if (!namesBySet.has(key)) namesBySet.set(key, []);
    namesBySet.get(key).push(name);
  }
  for (const [key, names] of namesBySet) {
    if (names.length > 3) errors.push(`attributes.csv: مجموعة الصفات «${key}» مطابقة حرفيًا على ${names.length} أسماء (${names.join('، ')}) — راجع كل اسم على حدة بدل تعميم نمط واحد`);
  }

  // «شخصيات تاريخية تحمل اسمك»: مطابقة تامة للاسم القانوني، لا للجذر أو الموضوع
  const YES_NO = ['نعم', 'لا'];
  const allFigures = readCsv(figuresFile).map((f, i) => {
    const e = {
      id: f.id, name: f.name, full_name: f.full_name, era: f.era || null, birth: f.birth || null, death: f.death || null,
      field: f.field || null, bio: f.bio, contribution: f.contribution || null, url: f.url,
      religious: f.religious, image: f.image || null, image_credit: f.image_credit || null, image_license: f.image_license || null,
      status: f.status || 'مقترح', note: f.review_note || null,
    };
    const where = `figures.csv سطر ${i + 2} (${e.id})`;
    if (!/^f\d+$/.test(e.id || '')) errors.push(`${where}: المعرّف يجب أن يكون f ثم رقم`);
    if (!validTargets.has(normalize(e.name).replace(/\s/g, ''))) errors.push(`${where}: الاسم «${e.name}» غير موجود في القاموس أو مركّبات أسماء الله`);
    if (!e.full_name) errors.push(`${where}: الاسم الكامل مطلوب`);
    if (!e.bio) errors.push(`${where}: السيرة مطلوبة`);
    if (!e.url) errors.push(`${where}: الرابط مطلوب`);
    if (!YES_NO.includes(e.religious)) errors.push(`${where}: «شخصية دينية» يجب أن تكون نعم/لا`);
    // سياسة ثابتة: شخصية دينية لا تُعرض لها صورة أبدًا، ولو كانت رسمة فنية — لا استثناء
    if (e.religious === 'نعم' && (e.image || e.image_credit || e.image_license)) {
      errors.push(`${where}: شخصية دينية لا يجوز أن يكون لها صورة بأي حال — أفرغ image/image_credit/image_license`);
    }
    if (e.religious === 'لا' && e.image) {
      if (!e.image_credit) errors.push(`${where}: الصورة بلا مصدر (image_credit) مطلوب`);
      if (!e.image_license) errors.push(`${where}: الصورة بلا ترخيص (image_license) مطلوب`);
      if (!/^https:\/\/upload\.wikimedia\.org\//.test(e.image)) errors.push(`${where}: الصورة يجب أن تكون ملفًا من ويكيميديا كومنز (upload.wikimedia.org)، لا رابطًا آخر ولا صورة مولَّدة بالذكاء الاصطناعي`);
    }
    if (!QUOTE_STATUS.includes(e.status)) errors.push(`${where}: الحالة يجب أن تكون ${QUOTE_STATUS.join('/')}`);
    return e;
  });
  const fids = new Set();
  for (const f of allFigures) { if (fids.has(f.id)) errors.push(`figures.csv: المعرّف ${f.id} مكرر`); fids.add(f.id); }
  const figures = allFigures.filter((f) => f.status !== 'مستبعد').map(({ status, note, ...f }) => f);
  const figuresPerName = new Map();
  for (const f of figures) figuresPerName.set(f.name, (figuresPerName.get(f.name) || 0) + 1);
  for (const [name, n] of figuresPerName) if (n > 3) errors.push(`figures.csv: «${name}» له ${n} شخصيات، والحد الأقصى 3`);

  // جذور مستخدمة في القاموس وغير موجودة في جدول الجذور (تنبيه فقط)
  for (const n of names) {
    if (n.root && n.root.split('-').length === 3 && !rk.has(normalize(n.root.replace(/-/g, '')))) {
      warnings.push(`الجذر ${n.root} (${n.name}) غير موجود في roots.csv — الأسماء غير المعروفة من هذا الجذر ستذهب إلى «اختر ما يشبهك»`);
    }
  }

  // الأبيات: من «ويكي مصدر» (نصوص عامة)، بنصها كما في صفحة القصيدة، مع اسم الشاعر ورابط القصيدة.
  // لا نحفظ نصوص الديوان: شروطه تمنع حفظ محتواه أكثر من 24 ساعة. التحقق من النص نفسه: node scripts/wikisource.js check
  const allQuotes = readCsv(quotesFile).map((q, i) => {
    const e = {
      id: q.id, status: q.status || 'مقترح', themes: split(q.themes),
      first: q.first, second: q.second, author: q.author, url: q.url, topic: q.topic || null, note: q.review_note || null,
    };
    const where = `quotes.csv سطر ${i + 2} (${q.id})`;
    if (!/^w\d+$/.test(e.id || '')) errors.push(`${where}: المعرّف يجب أن يكون w ثم رقم`);
    if (!QUOTE_STATUS.includes(e.status)) errors.push(`${where}: الحالة يجب أن تكون ${QUOTE_STATUS.join('/')}`);
    checkThemes(where, e.themes);
    if (!e.first || !e.second) errors.push(`${where}: الشطران مطلوبان`);
    if (!e.author) errors.push(`${where}: اسم الشاعر مطلوب`);
    if (/aldiwan\.net/.test(e.url || '')) errors.push(`${where}: لا نحفظ نصوص الديوان (شروطه تمنع حفظها أكثر من 24 ساعة). خذ البيت من ويكي مصدر`);
    else if (!(e.url || '').startsWith(WIKI)) errors.push(`${where}: الرابط يجب أن يكون صفحة القصيدة في ويكي مصدر (${WIKI}…)`);
    for (const s of [e.first, e.second]) {
      if (s && DIACRITIC_GLITCH.test(s)) errors.push(`${where}: خطأ طباعي في التشكيل أو «و» منفصلة`);
      if (s && /[کیۀە]/.test(s)) errors.push(`${where}: حرف فارسي (ک أو ی) بدل العربي`);
    }
    return e;
  });
  const qids = new Set();
  for (const q of allQuotes) {
    if (qids.has(q.id)) errors.push(`quotes.csv: الرقم ${q.id} مكرر`);
    qids.add(q.id);
  }
  const quotes = allQuotes.filter((q) => q.status !== 'مستبعد').map(({ status, note, topic, ...q }) => q);
  for (const t of themes) {
    const n = quotes.filter((q) => q.themes.includes(t.id)).length;
    if (n < 3) errors.push(`موضوع «${t.label}» فيه ${n} اقتباسات فقط بعد الاستبعاد (الحد الأدنى 3)`);
    else if (n < MIN_QUOTES_PER_THEME) warnings.push(`موضوع «${t.label}» فيه ${n} اقتباسات — يُفضّل ${MIN_QUOTES_PER_THEME} فأكثر`);
  }

  // كلمات لا تُكتب على البطاقة (شتائم وألفاظ بذيئة ومسيئة). تُطبّق على الأسماء التي لم تأتِ من القاموس.
  // لا تدخل الكلمات نفسها في الصفحة المنشورة: نحفظ بصمتها (FNV-1a) فقط.
  const nameKeys = new Map();
  for (const n of names) for (const k of [n.name, ...n.variants].map(normalize)) nameKeys.set(k.replace(/\s/g, ''), n.name);
  const blockedSeen = new Map();
  const blockedSet = new Set();
  readCsv(blockedFile).forEach((b, i) => {
    const where = `blocked.csv سطر ${i + 2}`;
    const k = normalize(b.word).replace(/\s/g, '');
    if (!k) { errors.push(`${where}: الكلمة فارغة أو ليست بحروف عربية`); return; }
    if (nameKeys.has(k)) errors.push(`${where}: «${b.word}» اسم في القاموس (${nameKeys.get(k)}) — احذفه من إحدى القائمتين`);
    if (blockedSeen.has(k)) errors.push(`${where}: «${b.word}» مكرر (سطر ${blockedSeen.get(k)})`);
    blockedSeen.set(k, i + 2);
    for (const h of blockHashes(k)) blockedSet.add(h);
  });
  const blocked = [...blockedSet].sort((a, b) => a - b);

  // أبيات الآلة (شاعر أم آلة؟): مشكولة شكلًا تامًا، ويجب أن يستقيم كل بيت على البحر المذكور
  const allMachine = readCsv(machineFile).map((m, i) => {
    const e = { id: m.id, status: m.status || 'مقترح', themes: split(m.themes), meter: m.meter, first: m.first, second: m.second, model: m.model, note: m.review_note || null };
    const where = `machine.csv سطر ${i + 2} (${m.id})`;
    if (!/^m\d+$/.test(e.id || '')) errors.push(`${where}: المعرّف يجب أن يكون m ثم رقم`);
    if (!QUOTE_STATUS.includes(e.status)) errors.push(`${where}: الحالة يجب أن تكون ${QUOTE_STATUS.join('/')}`);
    checkThemes(where, e.themes);
    if (!e.first || !e.second) errors.push(`${where}: الشطران مطلوبان`);
    if (!e.model) errors.push(`${where}: اسم النموذج مطلوب (نُعلن للزائر من كتب البيت)`);
    if (!METERS[e.meter]) errors.push(`${where}: بحر غير معروف «${e.meter}» (المتاح: ${Object.keys(METERS).join('، ')})`);
    else if (e.first && e.second) {
      try {
        const found = metersOf(e.first, e.second);
        if (!found.includes(e.meter)) errors.push(`${where}: البيت لا يستقيم على ${e.meter}${found.length ? ` (يستقيم على ${found.join('، ')})` : ''}`);
      } catch (err) { errors.push(`${where}: ${err.message}`); }
    }
    return e;
  });
  const mids = new Set();
  for (const m of allMachine) { if (mids.has(m.id)) errors.push(`machine.csv: المعرّف ${m.id} مكرر`); mids.add(m.id); }
  const machine = allMachine.filter((m) => m.status !== 'مستبعد').map(({ status, note, ...m }) => m);

  return { data: { themes, names, roots, divine, quotes, blocked, machine, attributes, figures }, allQuotes, allMachine, allAttributes, allFigures, errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { data, errors, warnings } = loadData();
  if (errors.length) {
    console.error('❌ أخطاء في البيانات:\n' + errors.map((e) => ' - ' + e).join('\n'));
    process.exit(1);
  }
  const uniqWarn = [...new Set(warnings)];
  writeFileSync(join(root, 'data', 'bundle.json'), JSON.stringify(data, null, 1));
  writeFileSync(join(root, 'src', 'data.js'), '// مولَّد تلقائيًا من data/*.csv — لا تعدّله يدويًا\nexport default ' + JSON.stringify(data) + ';\n');
  console.log(`✅ ${data.names.length} اسمًا، ${data.roots.length} جذرًا، ${data.divine.length} من أسماء الله، ${data.themes.length} موضوعًا، ${data.quotes.length} اقتباسًا، ${readCsv('blocked.csv').length} كلمة محجوبة، ${data.machine.length} بيتًا للآلة، ${data.attributes.length} صفة لـ${new Set(data.attributes.map((a) => a.name)).size} اسمًا، ${data.figures.length} شخصية تاريخية`);
  const qWarn = uniqWarn.filter((w) => w.startsWith('موضوع'));
  for (const w of qWarn) console.log('⚠️  ' + w);
  console.log(`ℹ️  ${uniqWarn.length - qWarn.length} تنبيه (جذور في القاموس غير موجودة في جدول الجذور)`);
}
