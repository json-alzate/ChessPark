// Pruebas del marcapasos de frames.   node --test tools/stream-runner/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FramePacer } from './lib/frame-pacer.mjs';

const frame = (n) => `f${n}`;

/** Simula un reloj: llegan frames de Chrome a `sourceFps` y se llama a drain cada `stepMs`. */
function simulate({ sourceFps, outFps = 30, seconds = 4, stepMs = 5, arrivalJitter = () => 0, drainJitter = () => 0 }) {
  const pacer = new FramePacer({ fps: outFps });
  const written = [];
  const interval = 1000 / sourceFps;
  const arrivals = [];
  for (let i = 0; i * interval < seconds * 1000; i++) arrivals.push({ at: i * interval + arrivalJitter(i), n: i });
  pacer.push(frame(0), 0);
  pacer.begin(0);
  let next = 1;
  for (let now = 0; now <= seconds * 1000; now += stepMs) {
    while (next < arrivals.length && arrivals[next].at <= now) { pacer.push(frame(arrivals[next].n), arrivals[next].at); next++; }
    pacer.drain(now + drainJitter(now), (d) => written.push(d));
  }
  return written;
}

test('escribe exactamente un frame por cada 1/fps de segundo', () => {
  const out = simulate({ sourceFps: 60, seconds: 4 });
  // 4 s a 30 fps = 120 frames (menos el retardo de reproducción del final)
  assert.ok(out.length >= 118 && out.length <= 121, `escribió ${out.length}`);
});

test('con origen a 60 fps, elige frames del origen con avance uniforme', () => {
  const out = simulate({ sourceFps: 60 });
  const idx = out.map((f) => Number(f.slice(1)));
  const deltas = idx.slice(1).map((v, i) => v - idx[i]);
  assert.ok(deltas.every((d) => d === 2), `avances por frame: ${[...new Set(deltas)].join(',')}`);
});

test('el avance es parejo aunque los frames de Chrome lleguen con jitter', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = simulate({ sourceFps: 60, arrivalJitter: () => (rnd() - 0.5) * 6 });
  const idx = out.map((f) => Number(f.slice(1)));
  const deltas = idx.slice(1).map((v, i) => v - idx[i]);
  const stalled = deltas.filter((d) => d === 0).length;
  const doubled = deltas.filter((d) => d > 3).length;
  assert.equal(stalled, 0, 'ningún frame repetido');
  assert.equal(doubled, 0, 'ningún salto doble');
});

test('si el reloj se retrasa, recupera los frames atrasados y no pierde la cadencia', () => {
  const pacer = new FramePacer({ fps: 30 });
  pacer.push('a', 0);
  pacer.begin(0);
  const written = [];
  pacer.drain(10, (d) => written.push(d));   // aún no toca (hay retardo)
  assert.equal(written.length, 0);
  pacer.push('b', 100);
  pacer.drain(500, (d) => written.push(d));  // el reloj se despertó 500 ms tarde
  assert.equal(written.length, Math.floor((500 - 24) / (1000 / 30)) + 1);
});

test('página quieta: sin frames nuevos se repite el último', () => {
  const pacer = new FramePacer({ fps: 30 });
  pacer.push('unico', 0);
  pacer.begin(0);
  const written = [];
  pacer.drain(1000, (d) => written.push(d));
  assert.ok(written.length > 25);
  assert.ok(written.every((d) => d === 'unico'));
});

test('pick escoge el más cercano y, si hay hueco, el más reciente anterior', () => {
  const pacer = new FramePacer({ fps: 30 });
  pacer.push('a', 100);
  pacer.push('b', 120);
  assert.equal(pacer.pick(118), 'b');
  assert.equal(pacer.pick(104), 'a');
  assert.equal(pacer.pick(400), 'b');
});

test('sin frames no escribe nada', () => {
  const pacer = new FramePacer({ fps: 30 });
  pacer.begin(0);
  assert.equal(pacer.drain(1000, () => assert.fail('no debería escribir')), 0);
  assert.equal(pacer.pick(5), null);
});

test('no se queda con frames viejos para siempre', () => {
  const pacer = new FramePacer({ fps: 30, keep: 4 });
  for (let i = 0; i < 20; i++) pacer.push(`f${i}`, i * 10);
  assert.equal(pacer.frames.length, 4);
});
