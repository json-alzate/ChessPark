// Pruebas de las partes puras del runner.   node --test tools/stream-runner/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { parseRange, resolveInside } from './lib/static-server.mjs';
import { backoffMs, buildConcatList, closeBrowser, defaultConfig, escapeConcatPath, ffmpegArgs, shuffled } from './run-stream.mjs';

const tracks = Array.from({ length: 6 }, (_, i) => ({ file: `normalized/${i}.m4a` }));
// "azar" determinista: siempre devuelve 0 -> el baraje queda en un orden conocido
const never = () => 0;

test('shuffled conserva los elementos, no modifica el original y respeta el generador', () => {
  const original = [1, 2, 3, 4, 5];
  const result = shuffled(original, never);
  assert.deepEqual([...result].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
  assert.deepEqual(shuffled(original, never), result);
});

test('shuffled con el azar real da órdenes distintos', () => {
  const orders = new Set(Array.from({ length: 20 }, () => shuffled([1, 2, 3, 4, 5, 6, 7, 8]).join()));
  assert.ok(orders.size > 1);
});

test('escapeConcatPath escapa las comillas simples', () => {
  assert.equal(escapeConcatPath("/a/it's.m4a"), "/a/it'\\''s.m4a");
});

test('buildConcatList repite cada pista una vez por ciclo con rutas absolutas', () => {
  const list = buildConcatList(tracks, '/musica', { cycles: 3, random: never }).trim().split('\n');
  assert.equal(list.length, tracks.length * 3);
  assert.ok(list.every((l) => l.startsWith("file '/musica/normalized/") && l.endsWith(".m4a'")));
  const counts = new Map();
  for (const l of list) counts.set(l, (counts.get(l) ?? 0) + 1);
  assert.ok([...counts.values()].every((n) => n === 3));
});

test('buildConcatList falla sin pistas en lugar de emitir silencio sin avisar', () => {
  assert.throws(() => buildConcatList([], '/m'), /No hay pistas/);
});

test('backoffMs crece al doble y se detiene en 60 s', () => {
  assert.deepEqual([0, 1, 2, 3].map(backoffMs), [1000, 2000, 4000, 8000]);
  assert.equal(backoffMs(20), 60_000);
});

const base = defaultConfig({ hlsDir: '/tmp/hls', rtmpUrl: 'rtmp://example/live/CLAVE-SECRETA' });

test('HLS: segmentos de 2 s, lista rotativa y numeración que no retrocede', () => {
  const args = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  assert.ok(args.includes('hls') && args.includes('/tmp/hls/stream.m3u8'));
  assert.equal(args[args.indexOf('-hls_time') + 1], '2');
  assert.ok(Number(args[args.indexOf('-start_number') + 1]) > 800_000_000);
  assert.ok(!args.some((a) => String(a).includes('CLAVE-SECRETA')), 'la clave de RTMP no debe aparecer en HLS');
});

test('HLS: tras un reinicio la lista continúa con una marca de discontinuidad', () => {
  const args = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  const flags = args[args.indexOf('-hls_flags') + 1];
  assert.match(flags, /append_list/);
  assert.match(flags, /discont_start/);
});

test('RTMP: flv con la URL, y keyframe cada 2 s como pide YouTube', () => {
  const args = ffmpegArgs({ ...base, target: 'rtmp' }, { audioList: '/tmp/l.txt' });
  assert.equal(args.at(-1), 'rtmp://example/live/CLAVE-SECRETA');
  assert.ok(args.includes('flv'));
  assert.equal(args[args.indexOf('-g') + 1], String(base.fps * 2));
  assert.ok(args.includes('expr:gte(t,n_forced*2)'));
});

test('audio: con música lee la lista a ritmo real; sin música emite silencio (YouTube exige pista de audio)', () => {
  const withMusic = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  assert.ok(withMusic.includes('-re') && withMusic.includes('concat') && withMusic.includes('/tmp/l.txt'));
  const silent = ffmpegArgs({ ...base, target: 'hls' });
  assert.ok(silent.includes('anullsrc=r=44100:cl=stereo') && !silent.includes('concat'));
});

test('formato de salida que YouTube acepta: H.264, yuv420p, AAC 44,1 kHz estéreo', () => {
  const args = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  const after = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(after('-pix_fmt'), 'yuv420p');
  assert.equal(after('-c:a'), 'aac');
  assert.equal(after('-ar'), '44100');
  assert.equal(after('-ac'), '2');
});

test('resolveInside nunca devuelve un archivo fuera de la carpeta', () => {
  const root = resolve('/srv/app');
  assert.equal(resolveInside(root, '/main.js'), resolve('/srv/app/main.js'));
  // Los intentos de salir o se neutralizan (quedan DENTRO de la raíz) o se rechazan con null.
  for (const attack of ['/../etc/passwd', '/%2e%2e/etc/passwd', '/a/../../b', '/..%2f..%2fetc/passwd', '//etc/passwd', '/../../../../x']) {
    const result = resolveInside(root, attack);
    assert.ok(result === null || result.startsWith(root + '/'), `${attack} -> ${result}`);
  }
  // Entradas inválidas se rechazan
  assert.equal(resolveInside(root, '/x%00.js'), null);
  assert.equal(resolveInside(root, '/%E0%A4%A'), null);
});

test('el video entra a cadencia fija: sin hora de lectura y sin filtro fps que repita o descarte frames', () => {
  const args = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  assert.ok(!args.includes('-use_wallclock_as_timestamps'));
  assert.equal(args[args.indexOf('-framerate') + 1], String(base.fps));
  assert.ok(!/fps=/.test(args[args.indexOf('-filter_complex') + 1]));
});

test('el video se convierte a rango limitado (yuv420p), no se queda en el rango completo del JPEG', () => {
  const args = ffmpegArgs({ ...base, target: 'hls' }, { audioList: '/tmp/l.txt' });
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.match(filter, /scale=out_range=tv,format=yuv420p/);
});

test('closeBrowser no se cuelga con un Chrome que no responde', async () => {
  const hung = { process: () => null, close: () => new Promise(() => undefined) };
  const logs = [];
  const started = Date.now();
  await closeBrowser(hung, (m) => logs.push(m), 150);
  assert.ok(Date.now() - started < 1500, 'tardó demasiado');
  assert.ok(logs.some((m) => /se fuerza/.test(m)));
});

test('closeBrowser termina rápido y sin avisar si Chrome responde', async () => {
  const fine = { process: () => null, close: async () => undefined };
  const logs = [];
  await closeBrowser(fine, (m) => logs.push(m), 150);
  assert.deepEqual(logs, []);
});

test('closeBrowser tolera que close() falle', async () => {
  const broken = { process: () => null, close: () => Promise.reject(new Error('Target closed')) };
  await closeBrowser(broken, () => undefined, 150);
});

test('parseRange entiende los tramos que pide un reproductor', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 }, 'se recorta al final del archivo');
});

test('parseRange: sin cabecera o con una que no entiende, sirve el archivo entero', () => {
  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('items=0-5', 1000), null);
  assert.equal(parseRange('bytes=-', 1000), null);
});

test('parseRange rechaza tramos fuera del archivo', () => {
  assert.equal(parseRange('bytes=1000-1100', 1000), 'invalid');
  assert.equal(parseRange('bytes=50-10', 1000), 'invalid');
  assert.equal(parseRange('bytes=-0', 1000), 'invalid');
});
