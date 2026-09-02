/**
 * 의존성 없는 정적 파일 서버.
 * ES 모듈은 file:// 에서 로드되지 않으므로 개발 중에는 이걸로 여세요.
 *   node scripts/serve.js  →  http://localhost:5173
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.slice(1));
  // 상위 디렉터리 탈출 차단
  if (rel.startsWith('..')) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 ' + rel);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
