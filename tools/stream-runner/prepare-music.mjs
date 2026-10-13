#!/usr/bin/env node
/**
 * Prepara la música del directo: normaliza el volumen de cada pista (EBU R128, dos pasadas) y escribe
 * `music/normalized/*.m4a` más `music/playlist.json`, que es lo que mezclará el runner.
 *
 * Por qué normalizar aquí y no en vivo: lo pide el doc (TRANSMISION_24_7.md) y así el directo no gasta
 * CPU en eso. El objetivo es -18 LUFS: música de fondo, por debajo del nivel de un video normal, para
 * que se pueda mirar y estudiar durante horas sin cansar el oído.
 *
 *   node tools/stream-runner/prepare-music.mjs            # procesa lo que falte y verifica todo
 *   node tools/stream-runner/prepare-music.mjs --force    # rehace todo
 *   node tools/stream-runner/prepare-music.mjs --verify   # solo mide lo ya procesado
 *
 * Los audios descargados son datos no confiables: se pasan a ffmpeg como argumentos (nunca por una
 * shell) y los nombres de salida salen de un slug propio, no del título.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC = resolve(HERE, 'music');
const OUT_DIR = join(MUSIC, 'normalized');
const TARGET = { I: -18, TP: -1.5, LRA: 11 };
const BITRATE = '192k';

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const ONLY_VERIFY = args.has('--verify');

function ffmpeg(argv) {
  return new Promise((resolveRun, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-nostdin', ...argv], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolveRun(err) : reject(new Error(err.slice(-600)))));
  });
}

async function hasEncoder(name) {
  return new Promise((resolveRun) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolveRun(new RegExp(`\\s${name}\\s`).test(out)));
  });
}

const slug = (s) =>
  String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'pista';

const sourcePath = (t) =>
  join(MUSIC, t.filename.replace('raw/ccmixter_2026-10-12/', 'source/ccmixter/').replace('raw/commons_2026-10-12/', 'source/commons/'));

function parseLoudnormJson(stderr) {
  const match = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  if (!match) throw new Error('loudnorm no devolvió mediciones');
  return JSON.parse(match[0]);
}

async function normalize(input, output, meta, encoder) {
  const base = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const first = parseLoudnormJson(await ffmpeg(['-i', input, '-vn', '-af', `${base}:print_format=json`, '-f', 'null', '-']));
  // Tras la normalización lineal, un limitador de seguridad: a las pistas masterizadas muy fuerte no se
  // les pueden bajar los picos sin cambiar su dinámica y se pasarían del techo. `level=false` es
  // imprescindible: por defecto alimiter vuelve a subir el volumen. 0.708 ≈ -3 dBFS de pico de muestra,
  // que deja el pico real (entre muestras) por debajo de -1.5 dBTP. En pistas que ya cumplen no hace nada.
  const second = `${base}:measured_I=${first.input_i}:measured_LRA=${first.input_lra}:measured_TP=${first.input_tp}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true,alimiter=limit=0.708:attack=5:release=60:level=false`;
  await ffmpeg([
    '-y', '-i', input, '-vn', '-map_metadata', '-1', '-af', second,
    '-ar', '44100', '-ac', '2', '-c:a', encoder, '-b:a', BITRATE,
    '-metadata', `title=${meta.title}`, '-metadata', `artist=${meta.author}`, '-metadata', `comment=${meta.license_name} ${meta.license_url}`,
    '-movflags', '+faststart', output,
  ]);
  return { inputLufs: Number(first.input_i), inputTruePeak: Number(first.input_tp), inputLra: Number(first.input_lra) };
}

/** Mide sonoridad integrada y pico real de un archivo ya procesado. */
async function measure(file) {
  const err = await ffmpeg(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const lufs = summary.match(/I:\s+(-?[\d.]+)\s+LUFS/);
  const lra = summary.match(/LRA:\s+(-?[\d.]+)\s+LU/);
  const peak = summary.match(/Peak:\s+(-?[\d.]+)\s+dBFS/);
  return { lufs: lufs ? Number(lufs[1]) : NaN, lra: lra ? Number(lra[1]) : NaN, truePeak: peak ? Number(peak[1]) : NaN };
}

const manifest = JSON.parse(readFileSync(join(MUSIC, 'manifest.json'), 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });
const encoder = (await hasEncoder('aac_at')) ? 'aac_at' : 'aac';
console.log(`${manifest.length} pistas · objetivo ${TARGET.I} LUFS / ${TARGET.TP} dBTP · codificador ${encoder} ${BITRATE}`);

const playlist = [];
let done = 0;
for (const [i, t] of manifest.entries()) {
  const input = sourcePath(t);
  const file = `${String(i + 1).padStart(2, '0')}-${slug(t.author)}-${slug(t.title)}.m4a`;
  const output = join(OUT_DIR, file);
  let info = { inputLufs: t.loudness_lufs, inputTruePeak: NaN, inputLra: t.lra };

  if (!ONLY_VERIFY && (FORCE || !existsSync(output) || statSync(output).mtimeMs < statSync(input).mtimeMs)) {
    try {
      info = await normalize(input, output, t, encoder);
    } catch (e) {
      console.error(`✗ ${t.id}: ${String(e.message).split('\n').slice(-2).join(' ')}`);
      continue;
    }
  }
  const after = await measure(output).catch(() => ({ lufs: NaN, lra: NaN, truePeak: NaN }));
  playlist.push({
    id: t.id, file: `normalized/${file}`, title: t.title, author: t.author, durationSec: t.duration_sec,
    source: t.source, license: t.license_name, licenseUrl: t.license_url, pageUrl: t.page_url,
    before: { lufs: info.inputLufs, truePeak: info.inputTruePeak }, after,
  });
  done++;
  if (done % 10 === 0 || done === manifest.length) console.log(`  ${done}/${manifest.length}`);
}

writeFileSync(join(MUSIC, 'playlist.json'), JSON.stringify(playlist, null, 2));

const lufs = playlist.map((p) => p.after.lufs).filter(Number.isFinite);
const peaks = playlist.map((p) => p.after.truePeak).filter(Number.isFinite);
const mean = lufs.reduce((a, b) => a + b, 0) / lufs.length;
const sd = Math.sqrt(lufs.reduce((a, b) => a + (b - mean) ** 2, 0) / lufs.length);
const total = playlist.reduce((a, p) => a + p.durationSec, 0);
console.log(`\nprocesadas: ${playlist.length}/${manifest.length} · ${(total / 60).toFixed(1)} min`);
console.log(`sonoridad tras normalizar: de ${Math.min(...lufs).toFixed(1)} a ${Math.max(...lufs).toFixed(1)} LUFS (media ${mean.toFixed(2)}, desviación ${sd.toFixed(2)} LU)`);
console.log(`pico real máximo: ${Math.max(...peaks).toFixed(1)} dBTP (límite ${TARGET.TP})`);
const off = playlist.filter((p) => !Number.isFinite(p.after.lufs) || Math.abs(p.after.lufs - TARGET.I) > 1.0);
console.log(off.length ? `FUERA DE ±1 LU del objetivo (${off.length}): ${off.map((p) => `${p.id}=${p.after.lufs}`).join(', ')}` : 'todas dentro de ±1 LU del objetivo');
process.exit(playlist.length === manifest.length ? 0 : 1);
