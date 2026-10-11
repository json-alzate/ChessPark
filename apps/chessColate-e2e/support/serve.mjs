// Compila ChessColate (si hace falta) y la sirve como estática con fallback de SPA.
// Es lo equivalente al `serve-static` de otras apps: una build, sin watch, sin
// recargas en mitad de la suite.
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist/apps/chessColate/browser');
const port = Number(process.env.E2E_PORT || 4310);

// E2E_REBUILD=1 fuerza una build nueva (hazlo siempre tras cambiar código de la app).
if (!existsSync(join(dist, 'index.html')) || process.env.E2E_REBUILD) {
  console.log('[e2e] compilando chessColate (development)…');
  execSync('npx nx build chessColate --configuration=development --skip-nx-cache', {
    stdio: 'inherit',
    cwd: root,
  });
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(dist, path));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // Una ruta de la SPA (sin extensión) vuelve a index.html; un asset que falta es un 404 real.
    if (extname(path)) {
      res.writeHead(404).end('not found');
      return;
    }
    file = join(dist, 'index.html');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`[e2e] chessColate en http://localhost:${port}`));
