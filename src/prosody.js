// مدقق العروض: يحوّل شطرًا مشكولًا شكلًا تامًا إلى متحركات وسواكن، ثم إلى مقاطع (u قصير، - طويل)، ويطابقها بالبحور.
// صارم عن قصد: كل حرف صامت يجب أن يحمل حركة أو سكونًا أو شدة، وإلا يرفض البيت ويذكر الكلمة.
// يُستعمل لأبيات الآلة فقط (نكتبها مشكولة)، لا لأبيات الشعراء (تشكيلها جزئي كما في مصدرها).

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SHADDA = 'ّ';
const TAN_F = 'ً', TAN_D = 'ٌ', TAN_K = 'ٍ', DAGGER = 'ٰ';
const VOWELS = new Set([FATHA, DAMMA, KASRA]);
const TANWEEN = new Set([TAN_F, TAN_D, TAN_K]);
const MARK = /[ً-ْٰ]/;
const PREFIX = new Set(['و', 'ف', 'ب', 'ك', 'ل']);

// البحور: كل تفعيلة بصورها الشائعة (مع الزحافات والعلل المعتادة في العروض والضرب)
export const METERS = {
  'الطويل': /^u-[-u]u-[-u]-u-[-u]u-(?:u-|--|-)$/,
  'البسيط': /^(?:--u-|u-u-|-uu-)(?:-u-|uu-)(?:--u-|u-u-|-uu-)(?:uu-|--|-u-)$/,
  'الكامل': /^(?:uu-u-|--u-){2}(?:uu-u-|--u-|uu--|---|uu-|--)$/,
  'الوافر': /^(?:u-uu-|u---){2}u--$/,
  'الخفيف': /^(?:-u--|uu--)(?:--u-|u-u-)(?:-u--|uu--|---|-u-|uu-)$/,
  'الرمل': /^(?:-u--|uu--){2}(?:-u-|uu-|-u--|uu--)$/,
  'السريع': /^(?:--u-|u-u-|-uu-){2}(?:-u-|--|uu-)$/,
  'الرجز': /^(?:--u-|u-u-|-uu-){2}(?:--u-|u-u-|-uu-|---|--)$/,
  'المتقارب': /^(?:u--|u-u){3}(?:u--|u-)$/,
};

function parseWord(word) {
  const letters = [];
  for (const ch of word) {
    if (MARK.test(ch)) {
      if (!letters.length) throw new Error(`علامة بلا حرف في «${word}»`);
      letters[letters.length - 1].marks.push(ch);
    } else if (/[ء-ي]/.test(ch)) letters.push({ ch, marks: [] });
  }
  return letters;
}

// وحدة: { v: 1 متحرك | 0 ساكن, kind: 'long' (حرف مد يُحذف عند التقاء الساكنين) | 'end' (ساكن آخر الكلمة يُكسر) | null }
export function units(hemistich) {
  const words = String(hemistich).replace(/ـ/g, '').replace(/[^ء-ْٰ\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = [];
  const push = (v, kind = null) => out.push({ v, kind });
  words.forEach((word, wi) => {
    const L = parseWord(word);
    let skipNext = false;
    for (let i = 0; i < L.length; i++) {
      const { ch, marks } = L[i];
      const next = L[i + 1];
      const has = (m) => marks.includes(m);
      // الألف الخنجرية (الرَّحْمٰن، اللّٰه) تتضمن فتحة على حرفها
      const vowel = marks.find((m) => VOWELS.has(m)) || (marks.includes(DAGGER) ? FATHA : undefined);
      const tan = marks.find((m) => TANWEEN.has(m));
      const isLast = i === L.length - 1;
      if (skipNext) { skipNext = false; continue; }

      // همزة الوصل: أول الكلمة، أو بعد حرف جر/عطف ملتصق قبل ساكن أو «ال»
      const bareNext = next && !next.marks.some((m) => VOWELS.has(m) || TANWEEN.has(m));
      const waslPos = ch === 'ا' && !tan && !has(SHADDA) && !vowel
        && (i === 0 || (i === 1 && PREFIX.has(L[0].ch) && next && ((next.ch === 'ل' && bareNext) || next.marks.includes(SUKUN))));
      if (waslPos && next) {
        if (i === 0 && wi === 0) push(1); // في أول الشطر تُنطق
        // لام التعريف بعدها
        if (next.ch === 'ل' && L[i + 2] && !next.marks.some((m) => VOWELS.has(m) || TANWEEN.has(m))) {
          if (L[i + 2].marks.includes(SHADDA)) skipNext = true; // شمسية: تُدغم
          else { push(0, isLastIndex(L, i + 1) ? 'end' : null); skipNext = true; }
        }
        continue;
      }
      // لام قبل حرف مشدد بلا حركة (لِلنّاس): مدغمة
      if (ch === 'ل' && !marks.length && next && next.marks.includes(SHADDA)) continue;

      if (ch === 'آ') { push(1); push(0, 'long'); continue; }

      // الألف: مد، أو صامتة بعد تنوين الفتح، أو ألف واو الجماعة
      if (ch === 'ا' && !vowel && !tan) {
        const prev = L[i - 1];
        if (prev && prev.marks.includes(TAN_F)) continue;
        if (isLast && prev && prev.ch === 'و' && !prev.marks.some((m) => VOWELS.has(m) || m === SHADDA)) continue;
        push(0, 'long');
        continue;
      }
      if (ch === 'ى' && !vowel && !tan) { push(0, 'long'); continue; }
      // الواو والياء بلا حركة: مد أو لين (ساكن)
      if ((ch === 'و' || ch === 'ي') && !vowel && !tan && !has(SHADDA)) { push(0, has(SUKUN) ? (isLast ? 'end' : null) : 'long'); continue; }

      if (has(SHADDA)) {
        push(0);
        if (!vowel && !tan) throw new Error(`شدة بلا حركة في «${word}»`);
      }
      if (tan) { push(1); push(0, 'end'); }
      else if (vowel) {
        push(1);
        // صلة هاء الضمير: «بِهِ» تُنطق «بِهِي» و«لَهُ» «لَهُو» إذا سبقها متحرك (وتسقط الصلة قبل ساكن)
        const prev = L[i - 1];
        if (ch === 'ه' && isLast && vowel !== FATHA && prev && prev.marks.some((m) => VOWELS.has(m))) push(0, 'long');
      }
      else if (has(SUKUN)) push(0, isLast ? 'end' : null);
      else if (ch === 'إ') push(1);
      else throw new Error(`حرف بلا حركة «${ch}» في «${word}»`);
      if (has(DAGGER)) push(0, 'long');
    }
  });

  // التقاء الساكنين: يُحذف حرف المد، ويُحرَّك الساكن آخر الكلمة (التنوين أو السكون)
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].v === 0 && out[i + 1].v === 0) {
      if (out[i].kind === 'long') { out.splice(i, 1); i--; }
      else if (out[i].kind === 'end') out[i] = { v: 1, kind: null };
      else throw new Error(`ساكنان متتاليان في «${hemistich}»`);
    }
  }
  // الإشباع في آخر الشطر
  if (out.length && out[out.length - 1].v === 1) push(0);
  return out.map((u) => u.v);
}
function isLastIndex(L, i) { return i === L.length - 1; }

export function syllables(hemistich) {
  const u = units(hemistich);
  if (u[0] !== 1) throw new Error(`الشطر يبدأ بساكن: «${hemistich}»`);
  let s = '';
  for (let i = 0; i < u.length;) {
    if (u[i] === 1 && u[i + 1] === 0) { s += '-'; i += 2; }
    else if (u[i] === 1) { s += 'u'; i += 1; }
    else throw new Error(`ساكنان متتاليان في «${hemistich}»`);
  }
  return s;
}

// البحور التي يستقيم عليها الشطران معًا
export function metersOf(first, second) {
  const a = syllables(first), b = syllables(second);
  return Object.keys(METERS).filter((m) => METERS[m].test(a) && METERS[m].test(b));
}
