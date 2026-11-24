// أداة التحقق من ويكي مصدر: قراءة صفحة القصيدة ومطابقة البيت (بلا شبكة)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skeleton, parsePoem, bestMatch, pageUrl } from '../scripts/wikisource.js';

const PAGE = `'''لكل امرئ من دهره ما تعودا'''
{{ترويسة
|عنوان=لكل امرئ من دهره ما تعودا
|مؤلف=المتنبي
}}

{{أبيات|لكل امرئٍ مِنْ دَهْرِهِ ما تَعَوّدَا\\\\وعادَةُ سيفِ الدّوْلةِ الطعنُ في العدى
إذا أنتَ أكرَمتَ الكَريمَ مَلَكْتَهُ\\\\وَإنْ أنْتَ أكْرَمتَ اللّئيمَ تَمَرّدَا
}}`;

test('الهيكل: يتجاهل التشكيل والهمزات والترقيم والمسافات', () => {
  assert.equal(skeleton('إذا أنتَ أكرَمتَ الكَريمَ'), skeleton('اذا انت اكرمت الكريم'));
  assert.equal(skeleton('امرئٍ،'), skeleton('امرىء'));
  assert.equal(skeleton('کللیالي'), skeleton('كلليالي'));
});

test('قراءة صفحة القصيدة: الشاعر والأبيات بشطريها', () => {
  const p = parsePoem(PAGE);
  assert.equal(p.author, 'المتنبي');
  assert.equal(p.verses.length, 2);
  assert.equal(p.verses[1][0], 'إذا أنتَ أكرَمتَ الكَريمَ مَلَكْتَهُ');
  assert.equal(p.verses[1][1], 'وَإنْ أنْتَ أكْرَمتَ اللّئيمَ تَمَرّدَا');
  assert.equal(parsePoem('{{بيت|الشطر الأول هنا|والشطر الثاني هنا}}').verses.length, 1);
});

test('المطابقة: تامة في صفحة الشاعر نفسه، وتقريبية حين تختلف الرواية، ولا شيء حين يغيب البيت', () => {
  const pages = [{ title: 'لكل امرئ من دهره ما تعودا', wikitext: PAGE }];
  const m = bestMatch(pages, 'إذا أنت أكرمت الكريم ملكته', 'وإن أنت أكرمت اللئيم تمردا', 'المتنبي');
  assert.ok(m.exact);
  assert.equal(m.author, 'المتنبي');
  assert.equal(m.first, 'إذا أنتَ أكرَمتَ الكَريمَ مَلَكْتَهُ');
  assert.equal(m.url, 'https://ar.wikisource.org/wiki/لكل_امرئ_من_دهره_ما_تعودا');
  const close = bestMatch(pages, 'إذا أنت أكرمت الكريم ملكته', 'وإن أنت أكرمت اللئيم تمرد', 'المتنبي');
  assert.ok(!close.exact && close.score > 0.9);
  assert.ok(bestMatch(pages, 'قفا نبك من ذكرى حبيب ومنزل', 'بسقط اللوى بين الدخول فحومل', 'امرؤ القيس').score < 0.75);
  assert.equal(pageUrl('من أنت?'), 'https://ar.wikisource.org/wiki/من_أنت%3F');
});
