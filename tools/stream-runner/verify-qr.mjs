#!/usr/bin/env node
/**
 * Verifica a fondo el codificador de QR de la app (`apps/live-stream/src/app/features/stream/utils/qr-code.util.ts`).
 * Úsalo si lo modificas; el spec de Jest solo guarda un vector de oro.
 *
 *  1. Compara módulo a módulo con una librería de referencia (qrcode-generator) en las 8 máscaras
 *     y en todas las longitudes admitidas (texto ASCII).
 *  2. Decodifica cientos de códigos con un lector independiente (jsQR), incluidos textos con UTF-8.
 *
 * Descarga las dos librerías a una carpeta temporal con `npm pack` (no toca el proyecto ni
 * node_modules). Necesita red.   node tools/stream-runner/verify-qr.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const work = mkdtempSync(join(tmpdir(), 'verify-qr-'));
execFileSync('npm', ['pack', 'qrcode-generator@1.4.4', 'jsqr@1.4.0', '--silent'], { cwd: work, stdio: 'inherit' });
for (const tgz of ['qrcode-generator-1.4.4.tgz', 'jsqr-1.4.0.tgz']) {
  const dir = join(work, tgz.replace('.tgz', ''));
  mkdirSync(dir);
  execFileSync('tar', ['-xzf', join(work, tgz), '-C', dir]);
}

// Copia de la referencia con la máscara forzada por variable de entorno (solo para esta comprobación).
const refSource = readFileSync(join(work, 'qrcode-generator-1.4.4/package/qrcode.js'), 'utf8');
const hook = 'makeImpl(false, getBestMaskPattern() );';
if (!refSource.includes(hook)) throw new Error('La referencia cambió: ajusta el parche de máscara forzada');
writeFileSync(join(work, 'ref.cjs'), refSource.replace(hook, 'makeImpl(false, process.env.FORCE_MASK !== undefined ? Number(process.env.FORCE_MASK) : getBestMaskPattern());'));

const require = createRequire(import.meta.url);
const ref = require(join(work, 'ref.cjs'));
const jsQR = require(join(work, 'jsqr-1.4.0/package/dist/jsQR.js'));
const { encodeQr, encodeQrWithMask, QR_MAX_BYTES } = await import(
  pathToFileURL(resolve('apps/live-stream/src/app/features/stream/utils/qr-code.util.ts')).href
);

const refMatrix = (text, mask) => {
  process.env.FORCE_MASK = String(mask);
  const qr = ref(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
};
const same = (a, b) => a.length === b.length && a.every((row, r) => row.every((v, c) => v === b[r][c]));

function decode(matrix) {
  const scale = 5, quiet = 4, n = matrix.length, size = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (matrix[r][c])
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  return jsQR(px, size, size)?.data ?? null;
}

const pick = (n, alphabet) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const ASCII = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/?=&._-%# ';
const ascii = ['https://chesscolate.web.app/?utm_source=youtube', 'a', 'HELLO WORLD'];
for (let n = 1; n <= QR_MAX_BYTES; n++) ascii.push(pick(n, ASCII));
const utf8 = Array.from({ length: 60 }, () => pick(1 + Math.floor(Math.random() * 30), 'ñáéíóúü¿¡€日本♞♟abc '));

let compared = 0, different = 0;
for (const text of ascii)
  for (let mask = 0; mask < 8; mask++) {
    compared++;
    if (!same(encodeQrWithMask(text, mask), refMatrix(text, mask))) different++;
  }

const undecodable = [...ascii, ...utf8].filter((t) => new TextEncoder().encode(t).length <= QR_MAX_BYTES && decode(encodeQr(t)) !== t);

console.log(`Comparación con la referencia (ASCII): ${compared} códigos, ${different} distintos`);
console.log(`Decodificados por jsQR: ${ascii.length + utf8.length - undecodable.length} de ${ascii.length + utf8.length}`);
if (different || undecodable.length) {
  console.log('FALLA', undecodable.slice(0, 5));
  process.exit(1);
}
console.log('OK');
