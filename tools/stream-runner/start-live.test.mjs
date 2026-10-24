import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildRtmpUrl, createLogger, parseArgs, redact, RTMP_BASE } from './start-live.mjs';

test('buildRtmpUrl arma la URL con la clave', () => {
  assert.equal(buildRtmpUrl('abcd-1234-efgh-5678'), `${RTMP_BASE}abcd-1234-efgh-5678`);
  assert.equal(buildRtmpUrl('  abcd-1234-efgh-5678\n'), `${RTMP_BASE}abcd-1234-efgh-5678`);
});

test('buildRtmpUrl rechaza claves vacías o con caracteres raros', () => {
  for (const mala of ['', '   ', null, undefined, 'corta', 'con espacio dentro', 'a/b/c/d/e/f/g/h', 'comilla"larga-123']) {
    assert.throws(() => buildRtmpUrl(mala), undefined, String(mala));
  }
});

test('redact quita la clave de cualquier texto', () => {
  assert.equal(redact('fallo en rtmp://x/live2/SECRETO-1234 y SECRETO-1234', 'SECRETO-1234'), 'fallo en rtmp://x/live2/«clave» y «clave»');
  assert.equal(redact('sin clave', undefined), 'sin clave');
});

test('parseArgs entiende --a=b y --a', () => {
  assert.deepEqual(parseArgs(['--target=hls', '--port=4400', '--x', 'suelto']), { target: 'hls', port: '4400', x: 'true' });
});

test('createLogger escribe, oculta la clave y rota por tamaño', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-test-'));
  try {
    const log = createLogger({ dir, name: 't', maxBytes: 200, keep: 2, secret: 'SECRETO-1234', echo: false });
    for (let i = 0; i < 30; i++) log(`linea ${i} con SECRETO-1234`);
    const files = readdirSync(dir).sort();
    assert.deepEqual(files, ['t.1.log', 't.2.log', 't.log']);
    for (const f of files) assert.ok(!readFileSync(join(dir, f), 'utf8').includes('SECRETO-1234'));
    assert.match(readFileSync(join(dir, 't.log'), 'utf8'), /linea 29/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('createLogger no lanza si no puede escribir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-test-'));
  const archivo = join(dir, 'no-es-carpeta');
  writeFileSync(archivo, '');
  try {
    const log = createLogger({ dir: archivo, echo: false });
    assert.doesNotThrow(() => log('hola'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
