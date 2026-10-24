import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chunkTracks,
  concatLine,
  describeTimeline,
  formatTime,
  parseTime,
  parseTimeline,
  timeline,
  trackAt,
} from './rights-check.mjs';

const pista = (title, seconds) => ({ title, author: 'A', license: 'CC BY 3.0', pageUrl: 'https://ccmixter.org/x', seconds });

test('chunkTracks reparte en orden sin pasarse del tope', () => {
  const chunks = chunkTracks([pista('a', 100), pista('b', 100), pista('c', 100), pista('d', 100)], 250);
  assert.deepEqual(chunks.map((c) => c.map((t) => t.title)), [['a', 'b'], ['c', 'd']]);
});

test('chunkTracks nunca parte una pista, aunque sola pase del tope', () => {
  const chunks = chunkTracks([pista('larga', 500), pista('b', 10)], 100);
  assert.deepEqual(chunks.map((c) => c.map((t) => t.title)), [['larga'], ['b']]);
});

test('chunkTracks sin pistas no genera videos', () => {
  assert.deepEqual(chunkTracks([]), []);
});

test('timeline acumula inicio y fin', () => {
  const entries = timeline([pista('a', 60), pista('b', 90.5)]);
  assert.deepEqual(entries.map((e) => [e.start, e.end]), [[0, 60], [60, 150.5]]);
});

test('formatTime y parseTime son inversos en los casos normales', () => {
  assert.equal(formatTime(125), '2:05');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-4), '0:00');
  assert.equal(parseTime('2:05'), 125);
  assert.equal(parseTime('1:02:05'), 3725);
  assert.equal(parseTime('62:05'), 3725);
  assert.equal(parseTime('90'), 90);
});

test('parseTime rechaza lo que no es una hora', () => {
  for (const malo of ['', 'abc', '1:2:3:4', '1:xx', '-5', '1.5']) assert.equal(parseTime(malo), null, malo);
});

test('trackAt devuelve la pista que suena y respeta los límites', () => {
  const entries = timeline([pista('a', 60), pista('b', 60)]);
  assert.equal(trackAt(entries, 0).title, 'a');
  assert.equal(trackAt(entries, 59.9).title, 'a');
  assert.equal(trackAt(entries, 60).title, 'b');
  assert.equal(trackAt(entries, 120), null);
});

test('describeTimeline lista cada pista con su hora de inicio', () => {
  const text = describeTimeline(timeline([pista('uno', 60), pista('dos', 60)]), 1, 3);
  assert.match(text, /Video 1 de 3 — 2 pistas, 2:00/);
  assert.match(text, /0:00 – 1:00 +A — uno/);
  assert.match(text, /1:00 – 2:00 +A — dos/);
});

test('parseTimeline lee lo que escribe describeTimeline', () => {
  const original = timeline([pista('uno', 60), pista('dos — con raya', 3700)]);
  const leido = parseTimeline(describeTimeline(original, 1, 1));
  assert.deepEqual(leido.map((e) => [e.start, e.end, e.title, e.license]), [
    [0, 60, 'uno', 'CC BY 3.0'],
    [60, 3760, 'dos — con raya', 'CC BY 3.0'],
  ]);
});

test('parseTimeline ignora la cabecera y las líneas que no son pistas', () => {
  assert.deepEqual(parseTimeline('Video 1 de 6 — 2 pistas, 2:00\n\n'), []);
});

test('concatLine escapa las comillas simples de las rutas', () => {
  assert.equal(concatLine("/a/b's.m4a"), "file '/a/b'\\''s.m4a'");
});
