// خادم محلي بسيط لمعاينة ui/ على الجوال أو المتصفح (بلا مكتبات)
// الاستخدام: node scripts/serve.js [المجلد=ui] [المنفذ=5173]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2] || 'ui';
const dir = isAbsolute(arg) ? arg : resolve(root, arg);
const port = Number(process.argv[3] || process.env.PORT || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(dir, path));
  const rel = relative(dir, file);
  // لا نخدم خارج المجلد، ولا الملفات المخفية (.env.local و.vercel وغيرها)
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(/[\\/]/).some((p) => p.startsWith('.'))) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('غير موجود');
  }
}).listen(port, () => console.log(`✅ http://localhost:${port}  ←  ${dir}`));
