// تقسيم نص الاقتباس (الشطران ملتصقان في الديوان بلا فاصل) باستخدام حقل title الذي يحمل الشطر الأول.
// نعدّ الحروف فقط (بلا تشكيل ولا مسافات ولا ترقيم)، فيصمد التقسيم أمام اختلاف التشكيل والهمزات
// والتاء المربوطة بين العنوان والنص (مثال حقيقي: «تفارقة» في العنوان و«تُفارِقُهُ» في النص).

const LETTER = /[ء-غف-يٱ]/; // حروف عربية بلا التطويل (U+0640) وبلا الحركات

export function countLetters(s) {
  let n = 0;
  for (const ch of String(s || '')) if (LETTER.test(ch)) n++;
  return n;
}

const bare = (s) =>
  String(s || '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^ء-ي]/g, '');

function similarity(a, b) {
  // نسبة الحروف المتطابقة في الموضع نفسه
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let same = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) same++;
  return same / Math.max(a.length, b.length);
}

/**
 * @returns {{first: string, second: string, singleVerse: boolean} | null}
 *   null إن لم يتطابق العنوان مع بداية النص.
 *   singleVerse = الباقي بطول شطر واحد تقريبًا (بيت واحد)، وليس عدة أبيات.
 */
export function splitVerse(title, text) {
  const t = String(text || '').trim();
  const n = countLetters(title);
  if (!t || n < 4) return null;

  // تقدّم حتى الحرف رقم n
  const chars = [...t];
  let seen = 0;
  let i = 0;
  for (; i < chars.length && seen < n; i++) if (LETTER.test(chars[i])) seen++;
  if (seen < n) return null;
  // ألحق ما بعد الحرف الأخير من تشكيل وترقيم ومسافات حتى أول حرف من الشطر الثاني
  while (i < chars.length && !LETTER.test(chars[i])) i++;

  const first = chars.slice(0, i).join('').trim();
  const second = chars.slice(i).join('').trim();

  // تحقّق أن الشطر الأول هو العنوان فعلًا
  if (similarity(bare(first), bare(title)) < 0.8) return null;

  const rest = countLetters(second);
  const singleVerse = rest >= n * 0.65 && rest <= n * 1.45;
  return { first, second, singleVerse };
}
