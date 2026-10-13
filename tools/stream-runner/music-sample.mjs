#!/usr/bin/env node
/**
 * Arma una muestra para ESCUCHAR la música antes de salir en vivo: un fragmento de cada autor
 * (25 s del medio de una pista, con fundido de entrada y salida), uno tras otro, y un índice con la
 * hora a la que empieza cada uno.
 *
 * Sirve para lo que ninguna etiqueta ni medición garantiza: que de verdad sea instrumental, suave y
 * agradable. Si algo no gusta, se quita la pista de `music/manifest.json` y se regenera todo.
 *
 *   node tools/stream-runner/music-sample.mjs
 *   → tools/stream-runner/music/muestra/muestra-por-autor.m4a  y  muestra-por-autor.txt
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MUSIC = resolve(HERE, 'music');
const OUT = join(MUSIC, 'muestra');
const CLIP = 25;
const FADE = 1;

const playlist = JSON.parse(readFileSync(join(MUSIC, 'playlist.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

// Una pista por autor: la de duración más cercana a 3 minutos (suele ser la más representativa).
const byAuthor = new Map();
for (const t of playlist) {
  const best = byAuthor.get(t.author);
  if (!best || Math.abs(t.durationSec - 180) < Math.abs(best.durationSec - 180)) byAuthor.set(t.author, t);
}
const picks = [...byAuthor.values()].sort((a, b) => a.author.localeCompare(b.author, 'en', { sensitivity: 'base' }));

const inputs = [];
const filters = [];
const labels = [];
picks.forEach((t, i) => {
  const start = Math.max(0, Math.min(t.durationSec * 0.4, t.durationSec - CLIP - 1));
  inputs.push('-ss', start.toFixed(1), '-t', String(CLIP), '-i', join(MUSIC, t.file));
  filters.push(`[${i}:a]afade=t=in:d=${FADE},afade=t=out:st=${CLIP - FADE}:d=${FADE}[a${i}]`);
  labels.push(`[a${i}]`);
});
const filter = `${filters.join(';')};${labels.join('')}concat=n=${picks.length}:v=0:a=1[out]`;
const output = join(OUT, 'muestra-por-autor.m4a');

await new Promise((ok, fail) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-c:a', 'aac', '-b:a', '160k', output], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.slice(-500)))));
});

const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const index = picks.map((t, i) => `${stamp(i * CLIP)}  ${clean(t.author)} — «${clean(t.title)}» (${t.license})`).join('\n');
writeFileSync(join(OUT, 'muestra-por-autor.txt'), index + '\n');
console.log(`${picks.length} autores, ${stamp(picks.length * CLIP)} de audio → ${output}`);
