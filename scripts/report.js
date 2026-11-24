// تقرير جودة: نشغّل استخراج الجذر على أسماء القاموس كأنها غير معروفة
// ونقارن بالجذر والموضوع الصحيحين المسجّلين فيه.
import { loadData } from './build.js';
import { createEngine, normalize } from '../src/engine.js';

export function fallbackReport() {
  const { data } = loadData();
  const engine = createEngine(data);
  const rows = { total: 0, found: 0, rightRoot: 0, wrongRoot: [], rightTheme: 0, missed: [] };
  for (const n of data.names) {
    if (!n.root || n.root.split('-').length !== 3) continue;
    rows.total++;
    const r = engine.findRoot(n.name);
    if (!r) { rows.missed.push(n.name); continue; }
    rows.found++;
    if (normalize(r.root.replace(/-/g, '')) === normalize(n.root.replace(/-/g, ''))) rows.rightRoot++;
    else rows.wrongRoot.push(`${n.name}: ${r.root} بدل ${n.root}`);
    if (n.themes.includes(r.themes[0])) rows.rightTheme++;
  }
  return rows;
}

if (process.argv[1].endsWith('report.js')) {
  const r = fallbackReport();
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—');
  console.log(`أسماء ذات جذر ثلاثي: ${r.total}`);
  console.log(`وجد المحرك جذرًا من الجدول: ${r.found} (${pct(r.found, r.total)})`);
  console.log(`من هذه، الجذر صحيح: ${r.rightRoot} (${pct(r.rightRoot, r.found)})`);
  console.log(`من هذه، الموضوع يوافق القاموس: ${r.rightTheme} (${pct(r.rightTheme, r.found)})`);
  if (r.wrongRoot.length) console.log('جذور خاطئة:\n - ' + r.wrongRoot.join('\n - '));
  console.log(`لم يجد جذرًا (يذهب إلى «اختر»): ${r.missed.length}`);
  console.log(' ' + r.missed.join('، '));
}
