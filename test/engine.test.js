import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/build.js';
import { fallbackReport } from '../scripts/report.js';
import { createEngine, normalize } from '../src/engine.js';
import { fileURLToPath } from 'node:url';
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const { data, errors } = loadData();
const E = createEngine(data);
const R = (s) => E.resolve(s);

test('البيانات سليمة: لا أخطاء تحقق', () => {
  assert.deepEqual(errors, []);
});

test('التطبيع: التشكيل والهمزات والتاء المربوطة', () => {
  assert.equal(normalize('مُحَمَّد'), 'محمد');
  assert.equal(normalize('أحمد'), normalize('احمد'));
  assert.equal(normalize('سارة'), normalize('ساره'));
  assert.equal(normalize('سلمى'), normalize('سلمي'));
  assert.equal(normalize('  نور   الهدى '), 'نور الهدي');
  assert.equal(normalize('محـــمد'), 'محمد');
});

test('القاموس: تطابق مباشر وصيغ بديلة', () => {
  for (const [input, canonical] of [
    ['أحمد', 'أحمد'], ['احمد', 'أحمد'], ['مُحَمَّد', 'محمد'], ['ساره', 'سارة'], ['سارا', 'سارة'],
    ['جوهرة', 'الجوهرة'], ['الجوهرة', 'الجوهرة'], ['عنود', 'العنود'], ['لؤلؤة', 'لولوة'], ['فائز', 'فايز'],
    ['عمرو', 'عمرو'], ['ديما', 'ديمة'],
  ]) {
    const r = R(input);
    assert.equal(r.source, 'dictionary', input);
    assert.equal(r.canonical, canonical, input);
    assert.ok(r.meaning && r.themes.length, input);
  }
});

test('الاسم الأول فقط من الاسم الكامل (اسم العائلة لا يُحسب)', () => {
  assert.equal(R('عمرو الشعار').canonical, 'عمرو');
  assert.equal(R('محمد العلي').canonical, 'محمد'); // العلي اسم عائلة لا جزء مركّب
  assert.equal(R('سارة الحربي').canonical, 'سارة');
});

test('مساعد: المعنى من القاموس يغلب الجذر (المساعدة لا السعادة)', () => {
  const r = R('مساعد');
  assert.equal(r.source, 'dictionary');
  assert.equal(r.themes[0], 'karam');
});

test('عبد + اسم من أسماء الله: متصل ومنفصل', () => {
  const a = R('عبدالله');
  assert.equal(a.source, 'compound');
  assert.equal(a.meaning, 'عبدٌ لله');
  assert.deepEqual(a.themes, ['iman']);
  assert.equal(R('عبد الرحمن').themes[0], 'rahma');
  assert.equal(R('عبدالعزيز').themes[0], 'izza');
  assert.equal(R('عبد العزيز').canonical, 'عبدالعزيز');
  assert.equal(R('عبدالمحسن').themes[0], 'karam');
  assert.match(R('عبدالكريم').meaning, /الكريم/);
  // اسم إلهي غير موجود في الجدول ← الإيمان بثقة متوسطة
  const u = R('عبدالجبار');
  assert.equal(u.source, 'compound');
  assert.deepEqual(u.themes, ['iman']);
  assert.equal(u.confidence, 'متوسطة');
  // "عبده" ليس مركّبًا
  assert.notEqual(R('عبده').source, 'compound');
});

test('الأسماء المركّبة مع الدين والهدى', () => {
  for (const s of ['نور الدين', 'نورالدين']) {
    const r = R(s);
    assert.equal(r.source, 'compound', s);
    assert.equal(r.canonical, 'نور الدين', s);
    assert.ok(r.themes.includes('nur') && r.themes.includes('iman'), s);
  }
  assert.equal(R('صلاح الدين').canonical, 'صلاح الدين');
  assert.equal(R('نور الهدى').canonical, 'نور الهدى');
  assert.equal(R('علاء الدين').themes[0], 'izza');
});

test('الجذر: أسماء خارج القاموس تُستخرج جذورها بشكل صحيح', () => {
  const cases = {
    مسعد: 'س-ع-د', حميد: 'ح-م-د', حمدي: 'ح-م-د', كرامة: 'ك-ر-م', مكرم: 'ك-ر-م',
    منار: 'ن-و-ر', أنوار: 'ن-و-ر', نورا: 'ن-و-ر', شروق: 'ش-ر-ق', إشراق: 'ش-ر-ق', صباح: 'ص-ب-ح',
    فرحان: 'ف-ر-ح', فرحة: 'ف-ر-ح', صبري: 'ص-ب-ر', شاكر: 'ش-ك-ر', شكري: 'ش-ك-ر', مشكور: 'ش-ك-ر',
    رحيم: 'ر-ح-م', لطفي: 'ل-ط-ف', عزيزة: 'ع-ز-ز', عزة: 'ع-ز-ز', عزام: 'ع-ز-م', مجد: 'م-ج-د',
    مجدي: 'م-ج-د', ماجدة: 'م-ج-د', شريفة: 'ش-ر-ف', عالية: 'ع-ل-و', علياء: 'ع-ل-و', سامية: 'س-م-و',
    رافع: 'ر-ف-ع', فائزة: 'ف-و-ز', نجاح: 'ن-ج-ح', فلاح: 'ف-ل-ح', مفلح: 'ف-ل-ح', حلمي: 'ح-ل-م',
    صادقة: 'ص-د-ق', عادلة: 'ع-د-ل', عهد: 'ع-ه-د', معمر: 'ع-م-ر', عمران: 'ع-م-ر', حياة: 'ح-ي-ي',
    سلام: 'س-ل-م', سليم: 'س-ل-م', صافي: 'ص-ف-و', نقاء: 'ن-ق-ي', هداية: 'ه-د-ي', رضوان: 'ر-ض-و',
    راضي: 'ر-ض-و', سكينة: 'س-ك-ن', أمان: 'أ-م-ن', مؤمن: 'أ-م-ن', عابد: 'ع-ب-د', جواد: 'ج-و-د',
    جودي: 'ج-و-د', وهبة: 'و-ه-ب', عطاء: 'ع-ط-ي', عطية: 'ع-ط-ي', فضل: 'ف-ض-ل', فاضل: 'ف-ض-ل',
    حسناء: 'ح-س-ن', حسني: 'ح-س-ن', بهية: 'ب-ه-و', زهور: 'ز-ه-ر', أزهار: 'ز-ه-ر', زاهر: 'ز-ه-ر',
    زهير: 'ز-ه-ر', شجاع: 'ش-ج-ع', نصار: 'ن-ص-ر', منتصر: 'ن-ص-ر', معتصم: 'ع-ص-م', مؤيد: 'أ-ي-د',
    رشيدة: 'ر-ش-د', عليم: 'ع-ل-م', فهيم: 'ف-ه-م', عاقل: 'ع-ق-ل', ذكية: 'ذ-ك-و', كريمة: 'ك-ر-م',
    إكرام: 'ك-ر-م', غياث: 'غ-ي-ث', مزنة: 'م-ز-ن', ميمون: 'ي-م-ن', أنيسة: 'أ-ن-س', مؤنس: 'أ-ن-س',
    رغدة: 'ر-غ-د', مبشر: 'ب-ش-ر', رجاء: 'ر-ج-و', آمال: 'أ-م-ل', ودود: 'و-د-د', يسرى: 'ي-س-ر',
    يسرا: 'ي-س-ر', جبران: 'ج-ب-ر', رؤوف: 'ر-أ-ف', عبده: 'ع-ب-د', ثابتة: 'ث-ب-ت', وفية: 'و-ف-ي',
  };
  const wrong = [];
  for (const [name, root] of Object.entries(cases)) {
    assert.equal(E.lookup(name), null, `«${name}» موجود في القاموس — الاختبار يجب أن يكون على أسماء غير معروفة`);
    const r = R(name);
    if (r.source !== 'root' || normalize(r.root) !== normalize(root)) wrong.push(`${name}: ${r.root ?? r.source} بدل ${root}`);
  }
  assert.deepEqual(wrong, [], 'جذور خاطئة');
});

test('الأمان: أسماء أجنبية أو ملتبسة تذهب إلى «اختر» ولا يُخترع لها معنى', () => {
  for (const name of ['مايكل', 'جون', 'ديفيد', 'سوزان', 'راهول', 'بريا', 'كيم', 'نزار', 'رشا', 'جيسيكا', 'أنطونيو', 'فيكتور', 'إيميلي']) {
    const r = R(name);
    assert.equal(r.source, 'choose', `${name} ← ${r.source} ${r.root ?? ''}`);
    assert.equal(r.meaning, null, name);
    assert.equal(r.themes.length, 3, name);
    assert.equal(new Set(r.themes).size, 3, name);
  }
});

test('الإدخال بالحروف اللاتينية والفارغ', () => {
  const l = R('Amr');
  assert.equal(l.source, 'latin');
  assert.equal(l.themes.length, 3);
  assert.deepEqual(R('Amr').themes, R('amr').themes); // ثابت ولا يتأثر بحالة الأحرف
  assert.equal(R('').source, 'empty');
  assert.equal(R('   ').source, 'empty');
  assert.equal(R('123').source, 'empty');
  assert.equal(R(null).source, 'empty');
});

test('الثبات: «اختر ما يشبهك» يعطي نفس المواضيع لنفس الاسم', () => {
  assert.deepEqual(R('مايكل').themes, R('مايكل').themes);
});

test('اختيار الاقتباس ثابت ومستقل عن ترتيب القائمة', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, text: `اقتباس تجريبي ${i + 1}` }));
  const shuffled = [...pool].reverse();
  const a = E.pickQuote(R('أحمد'), pool);
  assert.equal(E.pickQuote(R('احمد'), shuffled).id, a.id); // نفس الاسم بصيغة أخرى ونفس القائمة مقلوبة
  assert.equal(E.pickQuote(R('أحمد'), []), null);
  // التوزيع: 262 اسمًا على 20 اقتباسًا يجب ألا تتكدس على اقتباس واحد
  const counts = new Map();
  for (const n of data.names) {
    const q = E.pickQuote(R(n.name), pool);
    counts.set(q.id, (counts.get(q.id) || 0) + 1);
  }
  assert.ok(counts.size >= 18, `استُخدم ${counts.size} اقتباسًا فقط من 20`);
  assert.ok(Math.max(...counts.values()) <= 30, 'اقتباس واحد يتكرر كثيرًا');
});

test('كل أسماء القاموس تُحل دون أخطاء وبموضوع صالح', () => {
  for (const n of data.names) {
    const r = R(n.name);
    assert.ok(['dictionary', 'compound'].includes(r.source), n.name);
    for (const t of r.themes) assert.ok(E.themes.has(t), `${n.name}: ${t}`);
  }
});

test('جودة الجذر الاحتياطي على أسماء القاموس: دقة ≥ 97% عند إيجاد جذر', () => {
  const r = fallbackReport();
  const acc = r.rightRoot / r.found;
  assert.ok(acc >= 0.97, `الدقة ${(acc * 100).toFixed(1)}%: ${r.wrongRoot.join('، ')}`);
});

// ملفات review/ يصدّرها «npm test» قبل تشغيل الاختبارات (لا تُكتب هنا: الملفات تعمل بالتوازي)
test('الذهاب والعودة: نسخة المراجِع المصدَّرة تُبنى إلى نفس البيانات تمامًا', () => {
  const fromReview = loadData({ namesFile: here('../review/names-review.csv') });
  assert.deepEqual(fromReview.errors, []);
  assert.deepEqual(fromReview.data.names, data.names);
});

test('قارئ CSV: الحقول بين علامتي تنصيص وفيها فاصلة إنجليزية', async () => {
  const { parseCsv } = await import('../scripts/build.js');
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
});

test('الاستيراد من الجدول: أعمدة بترتيب آخر + خانة اختيار + فاصلة داخل نص ← نفس البيانات', async () => {
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { parseCsv } = await import('../scripts/build.js');
  const { toCanonicalCsv } = await import('../scripts/import-review.js');
  const rows = parseCsv((await import('node:fs')).readFileSync(here('../review/names-review.csv'), 'utf8'));
  // نفس ترتيب أعمدة الجدول: الاسم، المعنى، المواضيع، الجذر، الثقة، مراجَع، تعليق، ملاحظة، صيغ، الجنس
  const order = [0, 4, 5, 3, 6, 8, 9, 7, 1, 2];
  const q = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const lines = rows.map((r, i) => order.map((j) => (i > 0 && j === 9 && i === 1 ? 'تعليق فيه, فاصلة' : r[j] ?? '')).map(q).join(','));
  const dir = mkdtempSync(join(tmpdir(), 'nq-'));
  const f = join(dir, 'sheet.csv');
  writeFileSync(f, lines.join('\r\n'));
  const back = loadData({ namesFile: f });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.data.names, data.names);
  // والكتابة المعيارية تُقرأ من جديد إلى نفس البيانات
  const f2 = join(dir, 'canon.csv');
  writeFileSync(f2, toCanonicalCsv(back.data.names));
  assert.deepEqual(loadData({ namesFile: f2 }).data.names, data.names);
});

test('الاستيراد يرفض موضوعًا مكتوبًا خطأ ويذكر السطر', async () => {
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'nq-'));
  const f = join(dir, 'bad.csv');
  writeFileSync(f, 'الاسم,المعنى,المواضيع,الجذر,الثقة,الجنس\nسعد,اليُمن,السعاده,س-ع-د,عالية,ذكر\n');
  const af = join(dir, 'empty-attrs.csv');
  writeFileSync(af, 'name,attribute,relation,justification,source,status\n');
  const ff = join(dir, 'empty-figures.csv');
  writeFileSync(ff, 'id,name,full_name,era,birth,death,field,bio,contribution,url,status\n');
  const { errors } = loadData({ namesFile: f, attributesFile: af, figuresFile: ff });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /سطر 2.*السعاده/);
});

test('تغطية الأسماء الشائعة في السعودية والخليج: كلها بمعنى مراجَع لا بالتخمين', () => {
  const common = [
    // ذكور
    'محمد', 'عبدالله', 'عبد الرحمن', 'عبدالعزيز', 'فهد', 'خالد', 'سعود', 'فيصل', 'سلطان', 'تركي', 'بندر', 'نايف', 'نواف',
    'مشعل', 'متعب', 'مشاري', 'طلال', 'ماجد', 'ناصر', 'سعد', 'عمر', 'علي', 'يوسف', 'إبراهيم', 'فارس', 'راكان', 'هتان',
    'ريان', 'يزيد', 'زياد', 'بدر', 'ثامر', 'سلمان', 'عبدالإله', 'عبدالاله', 'عبدالمجيد', 'عبدالمحسن', 'عبدالكريم', 'حمد',
    'حمود', 'مساعد', 'منصور', 'بلال', 'سامي', 'سمير', 'هزاع', 'سطام', 'ضيف الله', 'ضيفالله', 'عطا الله', 'عطاالله',
    'جار الله', 'صالح', 'مبارك', 'غازي', 'ظافر', 'صقر', 'مرزوق', 'عيد', 'عايض', 'عائض', 'فالح', 'مطلق', 'مسفر', 'هيثم',
    'عمرو', 'أنس', 'معاذ', 'حسين', 'عبدالملك', 'وليد', 'عادل', 'رائد', 'أيمن',
    // إناث
    'نورة', 'نوره', 'سارة', 'الجوهرة', 'العنود', 'هيا', 'حصة', 'لولوة', 'لولوه', 'منيرة', 'موضي', 'نوف', 'ريم', 'شهد',
    'رهف', 'غلا', 'جود', 'دانة', 'لمى', 'رغد', 'لطيفة', 'مها', 'أروى', 'روان', 'شوق', 'وجد', 'مشاعل', 'البندري', 'الهنوف',
    'هنوف', 'الجازي', 'جواهر', 'بشاير', 'بشائر', 'أفنان', 'ريناد', 'يارا', 'جنى', 'تالا', 'تالة', 'ليان', 'لين', 'رنا',
    'رزان', 'هديل', 'سديم', 'أثير', 'خلود', 'أبرار', 'عهود', 'وعد', 'أسيل', 'هتون', 'نوال', 'سجى', 'رهام', 'يقين', 'ضي',
    'فاطمة', 'عائشة', 'مريم', 'هيفا', 'ديما', 'شيماء', 'ليلى', 'وضحى', 'شيخة',
  ];
  const missing = common.filter((n) => !['dictionary', 'compound'].includes(R(n).source));
  assert.deepEqual(missing, [], 'أسماء شائعة بلا معنى مراجَع');
});

test('مركّبات «الله»: ضيف الله وعطا الله متصلة ومنفصلة، و«عبدالله» يبقى عبدًا لله', () => {
  assert.equal(R('ضيف الله').canonical, 'ضيف الله');
  assert.equal(R('ضيفالله').canonical, 'ضيف الله');
  assert.equal(R('عطاء الله').canonical, 'عطا الله');
  assert.equal(R('نصر الله').canonical, 'نصر الله');       // أساس معروف + الله
  assert.ok(R('نصر الله').themes.includes('iman'));
  assert.equal(R('فتح الله').source, 'compound');           // أساس غير معروف ← منسوب إلى الله
  assert.equal(R('عبدالله').meaning, 'عبدٌ لله');
  assert.equal(R('عبد الله').meaning, 'عبدٌ لله');
});

test('الأسماء المضافة بعد البحث: المعنى المعروض إيجابي ولا يعرض المعنى المعجمي القاسي', () => {
  assert.doesNotMatch(R('متعب').meaning, /المُجهَد|المضني/);
  assert.match(R('بلال').meaning, /الندى/);
  assert.match(R('تركي').meaning, /الدولة السعودية الثانية/);
  assert.match(R('هديل').meaning, /الحمام/);
});

test('ما يستوحيه الاسم من صفات: مطابقة تامة على الاسم القانوني، لا على الجذر', () => {
  const liath = E.attributesFor(R('ليث'));
  assert.ok(liath.includes('الشجاعة'));
  const saeed = E.attributesFor(R('سعيد'));
  const musaed = E.attributesFor(R('مساعد'));
  assert.ok(saeed.includes('السعادة'));
  assert.ok(musaed.includes('التعاون'));
  assert.deepEqual(saeed.filter((a) => musaed.includes(a)), []); // جذر مشترك س-ع-د لكن صفات مختلفة
  assert.deepEqual(E.attributesFor(R('اسم غير موجود أصلًا')), []);
});

test('شخصيات تاريخية تحمل اسمك: مطابقة تامة للاسم، لا للجذر أو الاسم المشابه', () => {
  const hassan = E.figuresFor(R('حسان'));
  assert.ok(hassan.some((f) => f.full_name === 'حسان بن ثابت'));
  assert.deepEqual(E.figuresFor(R('نبيل')), []); // حسن (المطابق لآخرين) لا يطابق حسان، ونبيل بلا شخصية هنا
  assert.deepEqual(E.figuresFor(R('جميلة')), []); // لا شخصية مرتبطة به في Phase A
  for (const f of E.figuresFor(R('علي'))) assert.ok(f.full_name && f.bio && f.url);
});

test('شخصيات غير دينية يجوز لها صورة لاحقًا، ومركّب عبدالرحمن يحمل شخصيته الخاصة', () => {
  const ibnKhaldun = E.figuresFor(R('عبدالرحمن'));
  assert.ok(ibnKhaldun.some((f) => f.full_name.includes('خلدون')));
  assert.ok(ibnKhaldun.every((f) => f.religious === 'لا'));
  const ibnBattuta = E.figuresFor(R('محمد')).find((f) => f.full_name.includes('ابن بطوطة'));
  assert.ok(ibnBattuta && ibnBattuta.religious === 'لا' && !ibnBattuta.image);
});

test('الدفعة الثانية من الشخصيات: مالك وسلمان وبلال دينيون، طارق ويوسف وإبراهيم غير دينيين', () => {
  for (const [name, frag] of [['مالك', 'بن أنس'], ['سلمان', 'الفارسي'], ['بلال', 'بن رباح']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
    assert.ok(!f.image, name);
  }
  for (const [name, frag] of [['طارق', 'بن زياد'], ['يوسف', 'تاشفين'], ['إبراهيم', 'الموصلي']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
});

test('الدفعة الثالثة: ملوك ووزراء غير دينيين، وعمر بن عبدالعزيز ديني رغم أنه ثاني شخصية باسم عمر', () => {
  const abdalaziz = E.figuresFor(R('عبدالعزيز'));
  assert.ok(abdalaziz.some((f) => f.full_name.includes('الملك عبدالعزيز')));
  const khaledFigures = E.figuresFor(R('خالد'));
  assert.equal(khaledFigures.length, 3); // خالد بن الوليد (ديني)، ثم بن برمك والقسري (غير دينيين) — بلغ الحد الأقصى
  assert.equal(khaledFigures[0].religious, 'نعم'); // الصحابي أولًا بترتيب الملف
  const omarFigures = E.figuresFor(R('عمر'));
  assert.equal(omarFigures.length, 2);
  assert.ok(omarFigures.every((f) => f.religious === 'نعم')); // كلا شخصيتي عمر خليفتان دينيًا
  for (const name of ['عبدالعزيز', 'خالد', 'أحمد', 'محمد', 'عمر', 'فيصل']) {
    assert.ok(E.figuresFor(R(name)).length <= 3, name); // الحد الأقصى 3 شخصيات لكل اسم
  }
});

test('الدفعة الخامسة: زيد وأسامة والحسنان دينيون، يحيى والوليد غير دينيين', () => {
  assert.equal(E.figuresFor(R('زيد')).length, 2); // زيد بن ثابت وزيد بن حارثة
  for (const [name, frag] of [['زيد', 'بن حارثة'], ['أسامة', 'بن زيد'], ['حسن', 'بن علي'], ['حسين', 'بن علي']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
    assert.ok(!f.image, name);
  }
  for (const [name, frag] of [['يحيى', 'البرمكي'], ['وليد', 'عبدالملك']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
});

test('الدفعة السادسة: يزيد والقاسم وعمار دينيون، سليمان ومروان غير دينيين', () => {
  for (const [name, frag] of [['يزيد', 'أبي سفيان'], ['قاسم', 'بن محمد'], ['عمار', 'بن ياسر']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
  for (const [name, frag] of [['سليمان', 'عبدالملك'], ['مروان', 'بن الحكم']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
});

test('الدفعة السابعة: شعراء غير دينيين، وأحمد يبلغ الحد الأقصى 3 شخصيات', () => {
  for (const [name, frag] of [['بشار', 'بن برد'], ['جميل', 'بثينة'], ['حاتم', 'الطائي']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  const ahmadFigures = E.figuresFor(R('أحمد'));
  assert.equal(ahmadFigures.length, 3);
  assert.ok(ahmadFigures.some((f) => f.full_name.includes('المتنبي')));
});

test('الدفعة الثامنة: الفراهيدي ونجيب محفوظ وهشام غير دينيين، عقيل وثابت وسمية دينيون', () => {
  for (const [name, frag] of [['خليل', 'الفراهيدي'], ['نجيب', 'محفوظ'], ['هشام', 'عبدالملك']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  for (const [name, frag] of [['عقيل', 'بن أبي طالب'], ['ثابت', 'بن قيس'], ['سمية', 'بنت خباط']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
});

test('الدفعة التاسعة: شعراء حداثيون، وخالد وسعود يبلغان الحد الأقصى أو يقتربان منه', () => {
  for (const [name, frag] of [['محمود', 'درويش'], ['أمل', 'دنقل']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  assert.equal(E.figuresFor(R('خالد')).length, 3); // بلغ الحد الأقصى
  assert.equal(E.figuresFor(R('سعود')).length, 2);
});

test('الدفعة العاشرة: معاذ بن جبل ديني، وإبراهيم بن الأغلب شخصية ثانية غير دينية لإبراهيم', () => {
  const muadh = E.figuresFor(R('معاذ')).find((f) => f.full_name.includes('بن جبل'));
  assert.ok(muadh);
  assert.equal(muadh.religious, 'نعم');
  const ibrahimFigures = E.figuresFor(R('إبراهيم'));
  assert.equal(ibrahimFigures.length, 2);
  assert.ok(ibrahimFigures.every((f) => f.religious === 'لا'));
});

test('الدفعة الحادية عشرة: رؤساء وملوك حديثون غير دينيين، وأنس وتميم دينيان', () => {
  for (const [name, frag] of [['جمال', 'عبدالناصر'], ['ياسر', 'عرفات'], ['أنور', 'السادات'], ['فؤاد', 'الأول']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  for (const [name, frag] of [['أنس', 'بن مالك'], ['تميم', 'الداري']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
});

test('الدفعة الثانية عشرة: رياض الصلح وطاهر بن الحسين غير دينيين، عاصم بن ثابت ديني', () => {
  for (const [name, frag] of [['رياض', 'الصلح'], ['طاهر', 'بن الحسين']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  const asim = E.figuresFor(R('عاصم')).find((f) => f.full_name.includes('بن ثابت'));
  assert.ok(asim);
  assert.equal(asim.religious, 'نعم');
});

test('الدفعة الثالثة عشرة: صفات بلا تواريخ دقيقة مقبولة طالما النبذة والإسهام موثّقان', () => {
  const hamdan = E.figuresFor(R('حمدان')).find((f) => f.full_name.includes('حمدون'));
  assert.ok(hamdan);
  assert.ok(hamdan.bio && hamdan.contribution); // النبذة والإسهام كافيان رغم غياب التواريخ الدقيقة
  const saeed = E.figuresFor(R('سعيد')).find((f) => f.full_name.includes('بن زيد'));
  assert.ok(saeed);
  assert.equal(saeed.religious, 'نعم');
  const jabirFigures = E.figuresFor(R('جابر'));
  assert.equal(jabirFigures.length, 2);
  const hashim = E.figuresFor(R('هاشم')).find((f) => f.full_name.includes('عبد مناف'));
  assert.ok(hashim);
  assert.equal(hashim.religious, 'لا');
});

test('الدفعة الرابعة عشرة: زايد ومعن غير دينيين، وكل الروابط صحيحة المخطط', () => {
  for (const [name, frag] of [['زايد', 'آل نهيان'], ['معن', 'بن زائدة']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  for (const f of data.figures) assert.match(f.url, /^https:\/\/[a-z0-9.-]+\//i, f.id);
});

test('الدفعة الخامسة عشرة: صفية وأسماء دينيتان، وليلى الأخيلية شاعرة حقيقية لا الشخصية شبه الأسطورية', () => {
  for (const [name, frag] of [['صفية', 'بنت عبدالمطلب'], ['أسماء', 'بنت أبي بكر']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
  const layla = E.figuresFor(R('ليلى')).find((f) => f.full_name.includes('الأخيلية'));
  assert.ok(layla);
  assert.equal(layla.religious, 'لا');
});

test('الدفعة السادسة عشرة: سلمى وأروى ومي غير دينيات، شيماء وهالة دينيتان', () => {
  for (const [name, frag] of [['سلمى', 'عمرو'], ['أروى', 'الصليحي'], ['مي', 'زيادة']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
  for (const [name, frag] of [['شيماء', 'بنت الحارث'], ['هالة', 'بنت خويلد']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
});

test('الدفعة السابعة عشرة: عمرو وعامر وسالم وصفوان كلهم دينيون (صحابة وتابعي)', () => {
  for (const [name, frag] of [['عمرو', 'بن العاص'], ['عامر', 'بن فهيرة'], ['سالم', 'بن عبدالله'], ['صفوان', 'بن أمية']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
    assert.ok(!f.image, name);
  }
});

test('الدفعة الثامنة عشرة: العلاء بن الحضرمي وحكيم بن حزام دينيان', () => {
  for (const [name, frag] of [['علاء', 'الحضرمي'], ['حكيم', 'بن حزام']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'نعم', name);
  }
});

test('الدفعة التاسعة عشرة: راشد ونايف ومبارك حكّام غير دينيين', () => {
  for (const [name, frag] of [['راشد', 'آل مكتوم'], ['نايف', 'عبدالعزيز'], ['مبارك', 'الصباح']]) {
    const f = E.figuresFor(R(name)).find((x) => x.full_name.includes(frag));
    assert.ok(f, name);
    assert.equal(f.religious, 'لا', name);
  }
});

test('الدفعة العشرون: خليفة بن زايد غير ديني', () => {
  const khalifa = E.figuresFor(R('خليفة')).find((f) => f.full_name.includes('آل نهيان'));
  assert.ok(khalifa);
  assert.equal(khalifa.religious, 'لا');
});

test('الدفعة الحادية والعشرون: غازي وفيصل الأول (العراق) غير دينيين؛ فيصل يبلغ شخصيتين', () => {
  const ghazi = E.figuresFor(R('غازي')).find((f) => f.full_name.includes('غازي الأول'));
  assert.ok(ghazi);
  assert.equal(ghazi.religious, 'لا');
  const faisalFigures = E.figuresFor(R('فيصل'));
  assert.equal(faisalFigures.length, 2);
  assert.ok(faisalFigures.every((f) => f.religious === 'لا'));
});

test('الدفعة الثانية والعشرون: زينب بنت علي دينية', () => {
  const zainab = E.figuresFor(R('زينب')).find((f) => f.full_name.includes('بنت علي'));
  assert.ok(zainab);
  assert.equal(zainab.religious, 'نعم');
});

test('المركّبات تحمل صفاتها الخاصة: عبدالعزيز لا يرث صفات اسم آخر', () => {
  const abdalaziz = E.attributesFor(R('عبدالعزيز'));
  assert.ok(abdalaziz.includes('الكرامة'));
  assert.ok(abdalaziz.includes('عزة النفس'));
});
