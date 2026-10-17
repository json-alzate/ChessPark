#!/usr/bin/env node
/**
 * Arranque del directo en PRODUCCIÓN. Vive en `<carpeta de producción>/runner/` y lo lanza el LaunchAgent.
 *
 *   node start-live.mjs                       emite a YouTube (la clave sale del llavero)
 *   node start-live.mjs --target=hls          ensayo: emite a un HLS temporal, sin tocar YouTube ni el llavero
 *   node start-live.mjs --port=4320 --key-service=chesscolate-youtube-prod
 *
 * Sirve la app compilada (`../app`), lee la clave del llavero de macOS y deja que `run-stream.mjs` vigile
 * a Chrome y ffmpeg. La clave nunca se imprime ni pasa como argumento: solo viaja dentro del proceso.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStaticServer, listen } from './lib/static-server.mjs';
import { defaultConfig, runStream } from './run-stream.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_KEY_SERVICE = 'chesscolate-youtube-prod';
export const DEFAULT_PORT = 4320;
export const RTMP_BASE = 'rtmp://a.rtmp.youtube.com/live2/';
export const LOG_DIR = join(homedir(), 'Library', 'Logs', 'chesscolate-live');

// ---- funciones puras (con pruebas en start-live.test.mjs) -------------------------------------

/** Arma la URL de emisión a partir de la clave. Rechaza lo que no parezca una clave de YouTube. */
export function buildRtmpUrl(rawKey) {
  const key = String(rawKey ?? '').trim();
  if (!key) throw new Error('La clave de transmisión está vacía');
  if (!/^[A-Za-z0-9._-]{8,}$/.test(key)) {
    throw new Error('La clave de transmisión tiene caracteres que no esperaba (espacios, barras o comillas)');
  }
  return RTMP_BASE + key;
}

/** Quita la clave de cualquier texto, por si un error la arrastra. */
export function redact(text, key) {
  const k = String(key ?? '').trim();
  return k ? String(text).split(k).join('«clave»') : String(text);
}

/** Argumentos `--a=b` / `--a` → objeto. */
export function parseArgs(argv) {
  return Object.fromEntries(
    argv.filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : 'true'];
    })
  );
}

/** Registro con rotación por tamaño: `stream.log` → `stream.1.log` → `stream.2.log`. Nunca lanza. */
export function createLogger({ dir = LOG_DIR, name = 'stream', maxBytes = 5_000_000, keep = 2, secret, echo = true } = {}) {
  try { mkdirSync(dir, { recursive: true }); } catch { /* sin disco no hay registro, pero el directo sigue */ }
  const file = (n) => join(dir, n === 0 ? `${name}.log` : `${name}.${n}.log`);
  const rotate = () => {
    try {
      if (statSync(file(0)).size < maxBytes) return;
      rmSync(file(keep), { force: true });
      for (let n = keep - 1; n >= 0; n--) if (existsSync(file(n))) renameSync(file(n), file(n + 1));
    } catch { /* aún no existe */ }
  };
  return (message) => {
    const line = redact(`[${new Date().toISOString()}] ${message}`, secret);
    if (echo) console.log(line);
    try {
      rotate();
      appendFileSync(file(0), line + '\n');
    } catch { /* ver arriba */ }
  };
}

// ---- llavero y arranque ----------------------------------------------------------------------

export function readKeyFromKeychain(service, account = userInfo().username) {
  const r = spawnSync('/usr/bin/security', ['find-generic-password', '-a', account, '-s', service, '-w'], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(
      `No encontré la clave en el llavero (servicio «${service}», cuenta «${account}»). ` +
        `Guárdala con: security add-generic-password -a "$USER" -s ${service} -w`
    );
  }
  return r.stdout.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target === 'hls' ? 'hls' : 'rtmp';
  const port = Number(args.port ?? DEFAULT_PORT);
  const appDir = resolve(args['app-dir'] ?? join(HERE, '..', 'app'));
  const service = args['key-service'] ?? DEFAULT_KEY_SERVICE;

  let key;
  let log = createLogger({ secret: undefined });
  try {
    if (!existsSync(join(appDir, 'index.html'))) throw new Error(`No hay app compilada en ${appDir}. Corre deploy-stream.sh.`);
    if (target === 'rtmp') key = readKeyFromKeychain(service);
    log = createLogger({ secret: key });
    const rtmpUrl = target === 'rtmp' ? buildRtmpUrl(key) : undefined;

    const versionFile = join(HERE, '..', 'VERSION');
    const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').split('\n')[0] : 'sin VERSION';
    log(`arranque (${target}) · ${version}`);

    const server = createStaticServer({ root: appDir, spa: true });
    await listen(server, port, '127.0.0.1');

    const hlsDir = target === 'hls' ? mkdtempSync(join(tmpdir(), 'live-ensayo-')) : undefined;
    if (hlsDir) log(`ensayo: la salida HLS está en ${hlsDir}`);
    const cfg = defaultConfig({
      url: `http://127.0.0.1:${port}/`,
      target,
      ...(rtmpUrl && { rtmpUrl }),
      ...(hlsDir && { hlsDir }),
      ...(args['recycle-hours'] && { recycleMs: Number(args['recycle-hours']) * 3600_000 }),
    });

    const controller = new AbortController();
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => controller.abort());
    await runStream(cfg, { signal: controller.signal, log });
    server.close();
    log('detenido');
  } catch (error) {
    log(`error fatal: ${error.message}`);
    process.exit(3);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
