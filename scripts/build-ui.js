// يبني صفحات الموقع من القوالب: الكود والبيانات تُحقن داخل كل صفحة، فلا تحتاج خادمًا ولا طلبات بيانات
//   ui/index.template.html ← ui/index.html  (التجربة 1: من اسمه نصيب)
//   ui/game.template.html  ← ui/game.html   (التجربة 3: شاعر أم آلة؟) — تأخذ الأبيات فقط، فالصفحة أخف
//   ui/test.template.html  ← ui/test.html   (واجهة الاختبار للفريق)
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadData } from './build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { data, errors } = loadData();
if (errors.length) {
  console.error('❌ البيانات فيها أخطاء — شغّل npm test');
  process.exit(1);
}
const code = (file) => readFileSync(join(root, 'src', file), 'utf8').replace(/^export /gm, '');
const engine = code('engine.js');
const game = code('game.js');
const gameData = { themes: data.themes, quotes: data.quotes, machine: data.machine };

// رمزا QR للملصقات (ui/poster.html يرسمهما من ui/qr.svg وui/game-qr.svg)
copyFileSync(join(root, 'qr', 'dsc-name-quote-qr.svg'), join(root, 'ui', 'qr.svg'));
copyFileSync(join(root, 'qr', 'dsc-game-qr.svg'), join(root, 'ui', 'game-qr.svg'));

const PAGES = [
  ['index.template.html', 'index.html', data],
  ['game.template.html', 'game.html', gameData],
  ['figures.template.html', 'figures.html', data],
  ['test.template.html', 'test.html', data],
];
for (const [from, to, pageData] of PAGES) {
  const html = readFileSync(join(root, 'ui', from), 'utf8')
    .replace('/*__ENGINE__*/', () => engine)
    .replace('/*__GAME__*/', () => game)
    .replace('/*__DATA__*/', () => JSON.stringify(pageData));
  writeFileSync(join(root, 'ui', to), html);
  console.log(`✅ ui/${to} (${(html.length / 1024).toFixed(0)} KB)`);
}
