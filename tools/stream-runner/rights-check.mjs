#!/usr/bin/env node
/**
 * Prueba de derechos de la música, antes de emitir con ella.
 *
 * Content ID solo se puede consultar subiendo audio a YouTube. Este script arma unos pocos videos
 * (pantalla fija + las pistas, sin recodificar el audio) para subirlos como **privados**: al terminar
 * de procesarse, YouTube Studio indica qué pista tiene reclamo, en qué minuto y de quién.
 *
 *   node tools/stream-runner/rights-check.mjs            # arma los videos en music/rights-check/
 *   node tools/stream-runner/rights-check.mjs --find=2:34:10   # qué pista suena en el video 2, minuto 34:10
 *   node tools/stream-runner/rights-check.mjs --list      # solo muestra el plan, sin crear nada
 *
 * Cada video trae su `rights-check-N.txt` con la hora de inicio de cada pista, para traducir lo que
 * diga YouTube ("reclamo de 12:30 a 15:10") a una pista concreta.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC = join(HERE, 'music');
const OUT = join(MUSIC, 'rights-check');
/** Un video por tanda de este largo: cabe en un solo archivo de YouTube y los minutos se leen fácil. */
export const MAX_VIDEO_SECONDS = 55 * 60;

// ---- funciones puras (con pruebas en rights-check.test.mjs) -----------------------------------

/** Reparte las pistas, en orden, en tandas que no pasan de `maxSeconds` (una pista nunca se parte). */
export function chunkTracks(tracks, maxSeconds = MAX_VIDEO_SECONDS) {
  const chunks = [];
  let current = [];
  let total = 0;
  for (const track of tracks) {
    if (current.length > 0 && total + track.seconds > maxSeconds) {
      chunks.push(current);
      current = [];
      total = 0;
    }
    current.push(track);
    total += track.seconds;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Inicio y fin (en segundos desde el comienzo del video) de cada pista de una tanda. */
export function timeline(chunk) {
  let start = 0;
  return chunk.map((track) => {
    const entry = { ...track, start, end: start + track.seconds };
    start = entry.end;
    return entry;
  });
}

/** `3725` → `1:02:05`; `125` → `2:05`. */
export function formatTime(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** `1:02:05` o `62:05` o `125` → segundos. `null` si no se entiende. */
export function parseTime(text) {
  const parts = String(text).trim().split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

/** La pista que suena en el segundo `second` de una línea de tiempo, o `null` si se pasa del final. */
export function trackAt(entries, second) {
  return entries.find((e) => second >= e.start && second < e.end) ?? null;
}

/** Texto para los planes de cada video. */
export function describeTimeline(entries, videoNumber, videoCount) {
  const lines = [`Video ${videoNumber} de ${videoCount} — ${entries.length} pistas, ${formatTime(entries.at(-1)?.end ?? 0)}`, ''];
  for (const e of entries) {
    lines.push(`${formatTime(e.start).padStart(7)} – ${formatTime(e.end).padEnd(7)} ${e.author} — ${e.title}  [${e.license}]  ${e.pageUrl}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Lee de vuelta el texto de `describeTimeline`. `--find` usa lo que se escribió al armar cada video, no la
 * lista de música actual: si una pista se retira después, los videos ya subidos siguen teniendo los mismos minutos.
 */
export function parseTimeline(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+(?::\d+)+)\s+–\s+(\d+(?::\d+)+)\s+(.+?) — (.+?)\s{2}\[(.+?)\]\s{2}(\S+)\s*$/);
    if (!m) continue;
    entries.push({ start: parseTime(m[1]), end: parseTime(m[2]), author: m[3], title: m[4], license: m[5], pageUrl: m[6] });
  }
  return entries;
}

/** Línea `file '…'` del demuxer concat de ffmpeg, con las comillas escapadas. */
export function concatLine(path) {
  return `file '${path.replace(/'/g, "'\\''")}'`;
}

// ---- ejecución -------------------------------------------------------------------------------

function probeSeconds(file) {
  const r = spawnSync(
    process.env.FFPROBE_PATH ?? 'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' }
  );
  const seconds = Number.parseFloat(r.stdout);
  if (!Number.isFinite(seconds)) throw new Error(`No se pudo leer la duración de ${file}`);
  return seconds;
}

function loadTracks() {
  const playlist = JSON.parse(readFileSync(join(MUSIC, 'playlist.json'), 'utf8'));
  return playlist.map((t) => {
    const file = resolve(MUSIC, t.file);
    if (!existsSync(file)) throw new Error(`Falta el audio ${t.file}. Corre prepare-music.mjs.`);
    return {
      file,
      title: t.title,
      author: t.author,
      license: t.license,
      pageUrl: t.pageUrl,
      seconds: probeSeconds(file), // la duración real, no la declarada: los minutos tienen que coincidir
    };
  });
}

function encode(index, chunk, total) {
  return new Promise((resolveEncode, reject) => {
    const entries = timeline(chunk);
    const base = join(OUT, `derechos-${index}-de-${total}`);
    writeFileSync(`${base}.txt`, describeTimeline(entries, index, total));
    writeFileSync(`${base}.concat`, chunk.map((t) => concatLine(t.file)).join('\n') + '\n');
    const seconds = entries.at(-1).end;
    const args = [
      '-hide_banner', '-loglevel', 'error', '-stats', '-y',
      // pantalla fija, 1 fotograma por segundo: el video no importa, el audio es lo que revisa Content ID
      '-f', 'lavfi', '-i', `color=c=0x1b1730:s=640x360:r=1:d=${Math.ceil(seconds)}`,
      '-f', 'concat', '-safe', '0', '-i', `${base}.concat`,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-crf', '40', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy', // sin recodificar: es exactamente el audio que sale en el directo
      '-shortest', '-movflags', '+faststart', `${base}.mp4`,
    ];
    const child = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolveEncode(`${base}.mp4`) : reject(new Error(`ffmpeg terminó con código ${code}`))));
  });
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    })
  );
  if (args.find) {
    const [videoText, ...rest] = String(args.find).split(':');
    const video = Number(videoText);
    const second = parseTime(rest.join(':'));
    const file = readdirSync(OUT, { withFileTypes: true }).map((d) => d.name).find((n) => n.startsWith(`derechos-${video}-de-`) && n.endsWith('.txt'));
    if (!Number.isInteger(video) || video < 1 || second === null || !file) {
      console.error('Uso: --find=<video>:<minuto>   p. ej. --find=2:34:10 (video 2, minuto 34:10). Hay que haber armado los videos antes.');
      process.exit(2);
    }
    const entries = parseTimeline(readFileSync(join(OUT, file), 'utf8'));
    const hit = trackAt(entries, second);
    console.log(hit
      ? `Video ${video}, ${formatTime(second)}: «${hit.title}» — ${hit.author} [${hit.license}]\n${hit.pageUrl}`
      : `Video ${video}, ${formatTime(second)}: se pasa del final (dura ${formatTime(entries.at(-1)?.end ?? 0)}).`);
    return;
  }

  const tracks = loadTracks();
  const chunks = chunkTracks(tracks);

  const totalSeconds = tracks.reduce((a, t) => a + t.seconds, 0);
  console.log(`${tracks.length} pistas, ${formatTime(totalSeconds)} → ${chunks.length} videos`);
  chunks.forEach((c, i) => console.log(`  ${i + 1}: ${c.length} pistas, ${formatTime(c.at(-1) ? timeline(c).at(-1).end : 0)}`));
  if (args.list) return;

  mkdirSync(OUT, { recursive: true });
  // el audio se copia tal cual (~192 kbps) y el video casi no pesa: con margen, unos 1,5× el audio
  const needed = (totalSeconds * 192_000) / 8 * 1.5;
  const stat = statfsSync(OUT);
  const free = stat.bavail * stat.bsize;
  if (free < needed) {
    console.error(`Poco espacio: hacen falta ~${Math.round(needed / 1e6)} MB y hay ${Math.round(free / 1e6)} MB libres.`);
    process.exit(1);
  }

  for (const [i, chunk] of chunks.entries()) {
    console.log(`\nVideo ${i + 1} de ${chunks.length}…`);
    const file = await encode(i + 1, chunk, chunks.length);
    console.log(`  listo: ${file}`);
  }
  console.log(`\nSúbelos como PRIVADOS desde ${OUT}`);
  console.log('Luego, para saber qué pista es un minuto reclamado:  node tools/stream-runner/rights-check.mjs --find=<video>:<minuto>');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
