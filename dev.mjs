// Local preview: builds, then serves dist/ at http://localhost:4321 (no dependencies).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.ics': 'text/calendar', '.xml': 'application/xml', '.txt': 'text/plain' };
const PORT = Number(process.env.PORT) || 4321;
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join('dist', p);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
  catch { file = join('dist', '404.html'); res.statusCode = 404; }
  try { res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.statusCode = 404; res.end('Not found'); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
