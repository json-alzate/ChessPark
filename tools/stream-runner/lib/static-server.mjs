/** Servidor de archivos estáticos mínimo (sin dependencias) para la app y la página de vista previa. */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

/** Resuelve una URL a un archivo dentro de `root`, o `null` si intenta salirse de él. */
export function resolveInside(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = resolve(root);
  const target = resolve(join(base, normalize(decoded)));
  return target === base || target.startsWith(base + sep) ? target : null;
}

/**
 * Interpreta una cabecera `Range: bytes=…` de un solo tramo. Devuelve { start, end } (inclusivos), `null` si no
 * hay cabecera o no se entiende (se sirve el archivo entero), o 'invalid' si el tramo cae fuera del archivo (416).
 * Los reproductores de audio y video la necesitan para poder saltar a otro punto.
 */
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    // "-N": los últimos N bytes
    const last = Number(match[2]);
    if (last === 0) return 'invalid';
    start = Math.max(size - last, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Sirve `root`. Con `spa`, cualquier ruta sin archivo devuelve index.html (como el hosting de la app).
 * `routes` permite montar otras carpetas bajo un prefijo: { '/hls/': carpeta }.
 * `onRequest(req, res)` atiende rutas dinámicas y devuelve true si ya respondió.
 */
export function createStaticServer({ root, spa = false, routes = {}, noStore = [/\.m3u8$/], onRequest }) {
  return createServer((req, res) => {
    // Gancho para rutas dinámicas: si devuelve true, la petición ya se atendió.
    if (onRequest?.(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const url = req.url ?? '/';
    let file = null;
    for (const [prefix, dir] of Object.entries(routes)) {
      if (url.startsWith(prefix)) {
        file = resolveInside(dir, url.slice(prefix.length));
        break;
      }
    }
    if (file === null && !Object.keys(routes).some((p) => url.startsWith(p))) {
      file = resolveInside(root, url === '/' ? '/index.html' : url);
      if (file && !isFile(file) && spa) file = resolveInside(root, '/index.html');
    }
    if (!file || !isFile(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('No encontrado');
      return;
    }
    const size = statSync(file).size;
    const headers = {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    };
    if (noStore.some((re) => re.test(file))) headers['Cache-Control'] = 'no-store';

    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }
    if (range) {
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': range.end - range.start + 1 });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file, range).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': size });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
}

export function listen(server, port, host = '0.0.0.0') {
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server.address().port));
  });
}
