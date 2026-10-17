#!/usr/bin/env node
/**
 * El runner del directo: abre la página en Chrome headless, captura sus frames, les mezcla la música y
 * emite por HLS (vista previa local) o RTMP (YouTube). Se vigila solo: si algo se cae, reinicia.
 *
 *   node tools/stream-runner/run-stream.mjs --url=http://localhost:4310/ --target=hls
 *   RTMP_URL=rtmp://a.rtmp.youtube.com/live2/<CLAVE> node tools/stream-runner/run-stream.mjs --url=… --target=rtmp
 *
 * La clave de YouTube va SIEMPRE por la variable de entorno RTMP_URL, nunca como argumento
 * ni dentro del repo: los argumentos se ven en `ps` y en los registros. Este script no lee el
 * llavero; quien lo lanza lo hace, p. ej. con `security find-generic-password -w`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FramePacer } from './lib/frame-pacer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---- funciones puras (con pruebas en run-stream.test.mjs) -------------------------------------

/** Baraja una copia (Fisher–Yates). `random(n)` devuelve un entero en [0, n). */
export function shuffled(items, random = (n) => randomInt(n)) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Escapa una ruta para una línea `file '…'` del demuxer concat de ffmpeg. */
export function escapeConcatPath(path) {
  return path.replace(/'/g, "'\\''");
}

/**
 * Lista de reproducción para el demuxer concat: la música barajada, repetida varias veces con un orden
 * distinto cada vez, para que el bucle no sea evidente. Cada arranque genera una lista nueva.
 */
export function buildConcatList(tracks, musicDir, { cycles = 3, random } = {}) {
  if (tracks.length === 0) throw new Error('No hay pistas para la lista de reproducción');
  const lines = [];
  for (let c = 0; c < cycles; c++) {
    for (const t of shuffled(tracks, random)) lines.push(`file '${escapeConcatPath(resolve(musicDir, t.file))}'`);
  }
  return lines.join('\n') + '\n';
}

/** Espera antes de reintentar: 1 s, 2 s, 4 s… hasta 60 s. */
export function backoffMs(attempt) {
  return Math.min(1000 * 2 ** attempt, 60_000);
}

/**
 * Resumen de los últimos mensajes de error de ffmpeg (sin las líneas de progreso), para el registro cuando
 * termina. Quita la URL de emisión y la clave: ffmpeg suele repetir el destino en sus errores.
 */
export function summarizeFfmpegErrors(stderr, rtmpUrl, max = 6) {
  const key = String(rtmpUrl ?? '').split('/').filter(Boolean).pop();
  const hide = (line) => {
    let out = line;
    if (rtmpUrl) out = out.split(rtmpUrl).join('«destino»');
    if (key && key.length >= 8) out = out.split(key).join('«clave»');
    return out;
  };
  return String(stderr)
    .split(/\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('frame=') && !l.includes('speed='))
    .slice(-max)
    .map(hide)
    .join(' | ')
    .slice(0, 500);
}

/** Argumentos de ffmpeg. El video entra por stdin (JPEG de la captura); el audio es la lista de música. */
export function ffmpegArgs(cfg, { audioList } = {}) {
  const args = ['-hide_banner', '-y', '-loglevel', 'info'];
  // entrada 0: frames JPEG a cadencia FIJA (el marcapasos escribe uno cada 1/fps). No se usa la hora de lectura
  // (-use_wallclock_as_timestamps): sale en ráfagas y el movimiento se ve a tirones. El JPEG es de rango completo
  // (yuvj420p); el video para YouTube va en rango limitado (yuv420p), si no algunos reproductores lo ven lavado.
  args.push('-f', 'image2pipe', '-framerate', String(cfg.fps), '-c:v', 'mjpeg', '-i', 'pipe:0');
  // entrada 1: música (a ritmo real) o silencio, porque YouTube exige pista de audio
  if (audioList) args.push('-re', '-f', 'concat', '-safe', '0', '-i', audioList);
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

  args.push(
    '-filter_complex',
    `[0:v]scale=out_range=tv,format=yuv420p[v];[1:a]aresample=44100:async=1000,aformat=sample_fmts=fltp:channel_layouts=stereo[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'h264_videotoolbox', '-b:v', cfg.videoBitrate, '-maxrate', cfg.maxrate, '-bufsize', cfg.bufsize,
    '-g', String(cfg.fps * 2), '-force_key_frames', 'expr:gte(t,n_forced*2)', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', cfg.audioBitrate, '-ar', '44100', '-ac', '2'
  );

  if (cfg.target === 'hls') {
    // El número de segmento arranca en la hora actual para que nunca retroceda tras un reinicio.
    args.push(
      '-f', 'hls', '-hls_time', '2', '-hls_list_size', '10',
      // append_list + discont_start: tras un reinicio de ffmpeg la lista CONTINÚA y el primer segmento nuevo
      // lleva una marca de discontinuidad; sin eso el reproductor se queda en "buffering" para siempre,
      // porque ffmpeg vuelve a arrancar sus marcas de tiempo desde cero.
      '-hls_flags', 'delete_segments+independent_segments+omit_endlist+program_date_time+append_list+discont_start',
      '-start_number', String(Math.floor(Date.now() / 2000)),
      '-hls_segment_filename', join(cfg.hlsDir, 'seg_%d.ts'), join(cfg.hlsDir, 'stream.m3u8')
    );
  } else if (cfg.target === 'rtmp') {
    args.push('-f', 'flv', '-flvflags', 'no_duration_filesize', cfg.rtmpUrl);
  } else {
    args.push('-t', String(cfg.seconds ?? 30), cfg.out);
  }
  return args;
}

// ---- configuración ------------------------------------------------------------------------------

const CHROME_PATHS = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const FFMPEG_PATHS = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'];

function firstExisting(paths) {
  return paths.find((p) => !p.includes('/') || existsSync(p)) ?? paths.at(-1);
}

export function defaultConfig(overrides = {}) {
  return {
    url: 'http://localhost:4310/',
    target: 'hls',
    width: 1920,
    height: 1080,
    fps: 30,
    nth: 2,
    quality: 80,
    videoBitrate: '3M',
    maxrate: '3500k',
    bufsize: '6M',
    audioBitrate: '128k',
    hlsDir: join(HERE, 'preview', 'hls'),
    out: join(tmpdir(), 'stream-runner-test.mp4'),
    rtmpUrl: process.env.RTMP_URL,
    music: true,
    musicDir: join(HERE, 'music'),
    profile: join(HERE, '.chrome-profile'),
    chrome: process.env.CHROME_PATH ?? firstExisting(CHROME_PATHS),
    ffmpeg: process.env.FFMPEG_PATH ?? firstExisting(FFMPEG_PATHS),
    /** Si no llega ningún frame en este tiempo, se considera la página congelada y se reinicia. */
    frozenMs: 30_000,
    /** Chrome acumula memoria: se recicla cada tanto. 0 lo desactiva. */
    recycleMs: 4 * 3600_000,
    ...overrides,
  };
}

// ---- ejecución ----------------------------------------------------------------------------------

/**
 * Cierra Chrome sin poder colgarse. `browser.close()` espera a un navegador que puede haber muerto; si no
 * responde en 5 s se mata el grupo de procesos entero (Chrome lanza renderizadores y GPU como hijos).
 */
export async function closeBrowser(browser, log = () => undefined, timeoutMs = 5000) {
  const proc = browser.process();
  const closed = await Promise.race([
    browser.close().then(() => true, () => true),
    new Promise((ok) => setTimeout(() => ok(false), timeoutMs)),
  ]);
  if (!closed) log('Chrome no respondió al cerrarse: se fuerza');
  if (proc?.pid) {
    for (const target of [-proc.pid, proc.pid]) {
      try { process.kill(target, 'SIGKILL'); } catch { /* ya no existe */ }
    }
  }
}

/**
 * PIDs de procesos que usan exactamente este perfil de Chrome, a partir de la salida de `ps -A -o pid=,command=`.
 * Son restos de una pasada anterior que murió sin cerrar el navegador (p. ej. el runner terminó a la fuerza: launchd
 * mata a ffmpeg pero Chrome vive en otro grupo de procesos). Mientras vivan, un Chrome nuevo no puede abrir el perfil.
 * Solo cuenta quien lleva `--user-data-dir=<este perfil>` exacto: el Chrome personal no se toca.
 */
export function staleChromePids(psOutput, profile, ownPid = process.pid) {
  const flag = `--user-data-dir=${profile}`;
  const pids = [];
  for (const line of String(psOutput).split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const args = m[2];
    const at = args.indexOf(flag);
    const after = at === -1 ? '' : args[at + flag.length];
    // tras la ruta debe venir un espacio o el final: `…/.chrome-profile2` no es este perfil
    if (at !== -1 && (after === undefined || after === ' ') && pid !== ownPid) pids.push(pid);
  }
  return pids;
}

/** Mata los Chrome huérfanos de este perfil y borra sus archivos de bloqueo. Nunca lanza. */
export async function clearStaleChrome(profile, log = () => undefined) {
  let pids = [];
  try {
    pids = staleChromePids(execFileSync('ps', ['-A', '-o', 'pid=,command='], { encoding: 'utf8', maxBuffer: 32e6 }), profile);
  } catch (error) {
    log(`no pude listar procesos para buscar Chrome huérfanos: ${String(error.message).slice(0, 120)}`);
    return 0;
  }
  if (pids.length === 0) return 0;
  log(`limpiando ${pids.length} procesos de Chrome huérfanos del perfil`);
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    for (const pid of pids) {
      try { process.kill(pid, sig); } catch { /* ya no existe */ }
    }
    await new Promise((ok) => setTimeout(ok, sig === 'SIGTERM' ? 2000 : 500));
  }
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { rmSync(join(profile, name), { force: true }); } catch { /* sin permiso o ya no está */ }
  }
  return pids.length;
}

/** Una pasada: navegador + ffmpeg hasta que algo termina, se congela o se pide parar. */
export async function runOnce(cfg, log, signal) {
  // En la carpeta de producción solo hay `puppeteer-core`; en el repo de desarrollo vale cualquiera de los dos.
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    puppeteer = require('puppeteer');
  }

  if (cfg.target === 'hls') {
    mkdirSync(cfg.hlsDir, { recursive: true });
    // La carpeta solo se limpia en el PRIMER arranque (restos de otra ejecución). En los reinicios se conserva
    // la lista para continuarla (ver append_list en ffmpegArgs). Solo se tocan los archivos de la transmisión.
    if (cfg.cleanHls !== false) {
      for (const f of readdirSync(cfg.hlsDir)) if (/^(seg_\d+\.ts|stream\.m3u8)$/.test(f)) rmSync(join(cfg.hlsDir, f));
    }
  }

  let audioList;
  let workDir;
  if (cfg.music) {
    const playlist = JSON.parse(readFileSync(join(cfg.musicDir, 'playlist.json'), 'utf8'));
    workDir = mkdtempSync(join(tmpdir(), 'stream-runner-'));
    audioList = join(workDir, 'musica.txt');
    writeFileSync(audioList, buildConcatList(playlist, cfg.musicDir));
    log(`música: ${playlist.length} pistas, orden nuevo`);
  } else {
    log('sin música: se emite silencio');
  }

  await clearStaleChrome(cfg.profile, log);

  const browser = await puppeteer.launch({
    executablePath: cfg.chrome,
    headless: 'new',
    userDataDir: cfg.profile,
    args: ['--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    defaultViewport: { width: cfg.width, height: cfg.height, deviceScaleFactor: 1 },
  });

  let ffmpeg;
  let stderrTail = '';
  const stats = { frames: 0, dropped: 0, lastFrameAt: Date.now(), progress: '' };
  let stopPacer = () => undefined;
  const cleanup = async () => {
    stopPacer();
    try { ffmpeg?.stdin.end(); } catch { /* ya cerrado */ }
    ffmpeg?.kill('SIGTERM');
    await closeBrowser(browser, log);
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  };

  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => log(`error en la página: ${e.message}`));
    const client = await page.createCDPSession();
    await page.goto(cfg.url, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Chrome entrega frames cuando quiere; el marcapasos los convierte en un frame exacto cada 1/fps para ffmpeg.
    const pacer = new FramePacer({ fps: cfg.fps });
    let firstFrame;
    const gotFirstFrame = new Promise((ok) => (firstFrame = ok));
    client.on('Page.screencastFrame', ({ data, sessionId }) => {
      stats.frames++;
      stats.lastFrameAt = Date.now();
      pacer.push(Buffer.from(data, 'base64'), performance.now());
      firstFrame();
      client.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    });
    await client.send('Page.startScreencast', { format: 'jpeg', quality: cfg.quality, everyNthFrame: cfg.nth, maxWidth: cfg.width, maxHeight: cfg.height });
    await Promise.race([gotFirstFrame, new Promise((_, no) => setTimeout(() => no(new Error('Chrome no envió ningún frame en 15 s')), 15_000))]);

    ffmpeg = spawn(cfg.ffmpeg, ffmpegArgs(cfg, { audioList }), { stdio: ['pipe', 'ignore', 'pipe'] });
    ffmpeg.stdin.on('error', () => undefined);
    ffmpeg.stderr.on('data', (d) => {
      stderrTail = (stderrTail + d.toString()).slice(-8000);
      const last = d.toString().split(/\r|\n/).filter((l) => l.includes('frame=')).pop();
      if (last) stats.progress = last.replace(/\s+/g, ' ').trim();
    });
    const ffmpegDone = new Promise((ok) => ffmpeg.on('close', (code) => {
      const detail = summarizeFfmpegErrors(stderrTail, cfg.rtmpUrl);
      ok(`ffmpeg terminó con código ${code}${detail ? `: ${detail}` : ''}`);
    }));

    pacer.begin(performance.now());
    const pacerTimer = setInterval(() => {
      pacer.drain(performance.now(), (frame) => {
        // Si ffmpeg no da abasto, el tubo se llena: se descarta en lugar de acumular memoria sin límite.
        if (ffmpeg.stdin.writableLength > 8_000_000) stats.dropped++;
        else ffmpeg.stdin.write(frame);
      });
    }, 4);
    stopPacer = () => clearInterval(pacerTimer);
    log(`emitiendo ${cfg.url} → ${cfg.target}`);

    const startedAt = Date.now();
    const reason = await new Promise((resolveReason) => {
      const timers = [];
      const finish = (why) => {
        timers.forEach(clearInterval);
        resolveReason(why);
      };
      timers.push(
        setInterval(() => {
          if (Date.now() - stats.lastFrameAt > cfg.frozenMs) finish('la página dejó de enviar frames');
          else if (cfg.recycleMs && Date.now() - startedAt > cfg.recycleMs) finish('reciclado programado de Chrome');
        }, 5000),
        setInterval(() => log(`frames=${stats.frames}${stats.dropped ? ` (descartados ${stats.dropped})` : ''} · ${stats.progress}`), 30_000)
      );
      if (signal.aborted) finish('detenido');
      signal.addEventListener('abort', () => finish('detenido'), { once: true });
      browser.on('disconnected', () => finish('Chrome se cerró o se cayó'));
      ffmpegDone.then(finish);
    });
    return { reason, ranMs: Date.now() - startedAt };
  } finally {
    await cleanup();
  }
}

/** Supervisor: repite `runOnce` hasta que se aborte, con espera creciente si falla seguido. */
export async function runStream(cfg, { signal, log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`) } = {}) {
  const controller = new AbortController();
  const stopSignal = signal ?? controller.signal;
  let attempt = 0;
  while (!stopSignal.aborted) {
    try {
      const { reason, ranMs } = await runOnce(cfg, log, stopSignal);
      cfg.cleanHls = false;
      log(`pasada terminada: ${reason}`);
      // Si aguantó más de 5 minutos se considera estable y se olvidan los fallos anteriores.
      attempt = ranMs > 300_000 ? 0 : attempt + 1;
    } catch (error) {
      attempt++;
      cfg.cleanHls = false;
      log(`fallo: ${String(error.message).slice(0, 300)}`);
    }
    if (stopSignal.aborted) break;
    const wait = backoffMs(Math.max(attempt - 1, 0));
    log(`reintento en ${wait / 1000} s`);
    await new Promise((ok) => {
      const t = setTimeout(ok, wait);
      stopSignal.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true });
    });
  }
}

// ---- línea de comandos --------------------------------------------------------------------------

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }));
  const cfg = defaultConfig({
    url: args.url ?? undefined,
    target: args.target ?? 'hls',
    ...(args['hls-dir'] && { hlsDir: resolve(args['hls-dir']) }),
    ...(args.out && { out: resolve(args.out), seconds: Number(args.seconds ?? 30) }),
    ...(args.nth && { nth: Number(args.nth) }),
    ...(args.fps && { fps: Number(args.fps) }),
    ...(args['no-music'] && { music: false }),
    ...(args['recycle-hours'] && { recycleMs: Number(args['recycle-hours']) * 3600_000 }),
  });
  if (cfg.target === 'rtmp' && !cfg.rtmpUrl) {
    console.error('Falta RTMP_URL (variable de entorno) para emitir por RTMP. Nunca pases la clave como argumento.');
    process.exit(2);
  }
  const controller = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => controller.abort());
  await runStream(cfg, { signal: controller.signal });
}
