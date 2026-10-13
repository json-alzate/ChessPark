#!/usr/bin/env node
/**
 * Mide si la TUBERÍA de captura (Chrome → screencast → ffmpeg) entrega el movimiento de forma pareja.
 *
 * Abre una página de prueba con cuadrados que se mueven a velocidad constante, la graba con exactamente la
 * misma tubería del runner y mide cuánto avanza cada cuadrado de un frame al siguiente. Si la tubería fuera
 * perfecta, cada frame avanzaría lo mismo; si hay tirones, algunos frames no avanzan y otros avanzan doble.
 *
 * Esto separa un problema de la tubería de una escena que simplemente se mueve poco.
 *
 *   node tools/stream-runner/check-smoothness.mjs [--nth=2] [--fps=30] [--seconds=12]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticServer, listen } from './lib/static-server.mjs';
import { defaultConfig, runOnce } from './run-stream.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=')];
}));
const nth = Number(args.nth ?? 2);
const fps = Number(args.fps ?? 30);
const seconds = Number(args.seconds ?? 12);

// Dos cuadrados que ruedan por el ancho de la pantalla: uno rápido y uno lento (como una nube).
const SPEEDS = { fast: 600, slow: 120 };  // píxeles por segundo
const PAGE = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#000;overflow:hidden}
div{position:absolute;width:120px;height:120px;background:#fff;will-change:transform}
#fast{top:160px}#slow{top:640px}</style>
<div id="fast"></div><div id="slow"></div>
<script>
const W=1920-120, t0=performance.now(), f=document.getElementById('fast'), s=document.getElementById('slow');
(function tick(now){const t=(now-t0)/1000;
 f.style.transform='translateX('+((t*${SPEEDS.fast})%W)+'px)';
 s.style.transform='translateX('+((t*${SPEEDS.slow})%W)+'px)';
 requestAnimationFrame(tick)})(performance.now());
</script>`;

const work = mkdtempSync(join(tmpdir(), 'smooth-'));
writeFileSync(join(work, 'index.html'), PAGE);
const server = createStaticServer({ root: work });
const port = await listen(server, 0, '127.0.0.1');
const out = join(work, 'out.mp4');

const cfg = defaultConfig({ url: `http://127.0.0.1:${port}/`, target: 'file', out, seconds: seconds + 4, nth, fps, music: false, profile: join(work, 'profile') });
mkdirSync(cfg.profile, { recursive: true });
await runOnce(cfg, () => undefined, new AbortController().signal);
server.close();

// Decodifica a 480×270 en gris y busca el centro de cada cuadrado en su franja.
const W = 480, H = 270;
const raw = await new Promise((ok, fail) => {
  const p = spawn(cfg.ffmpeg, ['-hide_banner', '-v', 'error', '-ss', '2', '-i', out, '-t', String(seconds), '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const chunks = [];
  p.stdout.on('data', (c) => chunks.push(c));
  p.on('close', (code) => (code === 0 ? ok(Buffer.concat(chunks)) : fail(new Error('ffmpeg falló al decodificar'))));
});
rmSync(work, { recursive: true, force: true });

const frames = Math.floor(raw.length / (W * H));
const bands = { fast: [40 + 5, 40 + 25], slow: [160 + 5, 160 + 25] }; // filas a escala 1/4 (160 y 640 px reales)
const centroid = (frame, [y0, y1]) => {
  let sum = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const v = raw[frame * W * H + y * W + x];
    if (v > 128) { sum += x; count++; }
  }
  return count > 60 ? sum / count : null;
};

let failed = false;
console.log(`tubería: nth=${nth}, salida ${fps} fps · ${frames} frames analizados (${seconds} s)\n`);
for (const [name, speed] of Object.entries(SPEEDS)) {
  const expected = (speed / 4) / fps;          // avance ideal por frame a escala 1/4
  const deltas = [];
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const c = centroid(f, bands[name]);
    if (c !== null && prev !== null) {
      const d = c - prev;
      if (d > -50) deltas.push(d);             // se descarta el salto cuando el cuadrado da la vuelta
    }
    prev = c;
  }
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length);
  const stalled = deltas.filter((d) => d < expected * 0.3).length;
  const doubled = deltas.filter((d) => d > expected * 1.7).length;
  const pct = (n) => `${(100 * n / deltas.length).toFixed(1)} %`;
  console.log(name === 'fast' ? 'Cuadrado rápido (600 px/s)' : 'Cuadrado lento (120 px/s, como una nube)');
  console.log(`   avance ideal por frame: ${expected.toFixed(2)} · real: ${mean.toFixed(2)} ± ${sd.toFixed(2)}`);
  console.log(`   frames que NO avanzan (tirón): ${pct(stalled)} · frames que avanzan el doble: ${pct(doubled)}`);
  if (stalled / deltas.length > 0.05 || doubled / deltas.length > 0.05) failed = true;
}
console.log(failed ? '\nTIRONES: la tubería no entrega el movimiento de forma pareja.' : '\nOK: el movimiento llega parejo.');
process.exit(failed ? 1 : 0);
