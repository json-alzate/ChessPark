#!/usr/bin/env node
/**
 * Vista previa local del directo: levanta todo lo necesario para ver, en un navegador, cómo se vería y
 * sonaría la transmisión en YouTube, sin salir a YouTube.
 *
 *   1. sirve la app (la compilación de producción de `live-stream`) en --app-port
 *   2. arranca el runner: Chrome captura la app, ffmpeg le mezcla la música y emite HLS
 *   3. sirve una página de visualización (reproductor + descripción) en --port
 *
 *   nx build live-stream
 *   node tools/stream-runner/local-preview.mjs --port=4303
 *   → abre http://localhost:4303
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer, listen } from './lib/static-server.mjs';
import { defaultConfig, runStream } from './run-stream.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : 'true'];
}));

const port = Number(args.port ?? 4303);
const appPort = Number(args['app-port'] ?? 4310);
const appDir = resolve(args['app-dir'] ?? join(REPO, 'dist', 'apps', 'live-stream', 'browser'));
const hlsDir = join(HERE, 'preview', 'hls');

if (!existsSync(join(appDir, 'index.html'))) {
  console.error(`No hay compilación de la app en ${appDir}.\nCompílala primero: npx nx build live-stream`);
  process.exit(1);
}

/** Texto de la descripción del directo: presentación + atribución de la música. */
function descriptionText() {
  const intro = [
    'Chess puzzles with lofi music, 24/7.',
    'The theme changes every few minutes and the level goes up step by step, then starts again.',
    'Scan the QR code to practice on your phone: https://chesscolate.web.app',
    '',
  ].join('\n');
  let music = '';
  try {
    music = readFileSync(join(HERE, 'music', 'DESCRIPCION_MUSICA.txt'), 'utf8');
  } catch {
    music = '(music credits not generated yet: run music-credits.mjs)';
  }
  return `${intro}\n${music}`;
}

const appServer = createStaticServer({ root: appDir, spa: true });
const previewServer = createStaticServer({
  root: join(HERE, 'preview'),
  routes: { '/hls/': hlsDir, '/muestra/': join(HERE, 'music', 'muestra') },
  onRequest: (req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(join(HERE, 'preview', 'viewer.html')));
      return true;
    }
    if (req.url === '/muestra' || req.url === '/muestra.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(join(HERE, 'preview', 'muestra.html')));
      return true;
    }
    if (req.url === '/favicon.ico') {
      res.writeHead(204).end();
      return true;
    }
    if (req.url === '/description.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(descriptionText());
      return true;
    }
    return false;
  },
});

await listen(appServer, appPort, '127.0.0.1');
await listen(previewServer, port, '0.0.0.0');
console.log(`app (solo la ve el runner):  http://127.0.0.1:${appPort}/`);
console.log(`VISTA PREVIA para mirar:     http://localhost:${port}/`);

const controller = new AbortController();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('deteniendo…');
    controller.abort();
  });
}

const cfg = defaultConfig({ url: `http://127.0.0.1:${appPort}/`, target: 'hls', hlsDir });
await runStream(cfg, { signal: controller.signal });
appServer.close();
previewServer.close();
process.exit(0);
