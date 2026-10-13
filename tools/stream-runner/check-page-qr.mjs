#!/usr/bin/env node
/**
 * Lee el QR del panel desde los píxeles reales de la página (lo que vería la cámara de un celular)
 * y comprueba que lleva a la web de ChessColate.
 *
 * Descarga el lector jsQR a una carpeta temporal con `npm pack` (necesita red; no toca el proyecto).
 *
 *   node tools/stream-runner/check-page-qr.mjs --url=http://localhost:4302/
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=')];
}));
const url = args.url || 'http://localhost:4302/';
const expected = args.expect || 'https://chesscolate.web.app/?utm_source=youtube';
const chrome = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const work = mkdtempSync(join(tmpdir(), 'check-page-qr-'));
execFileSync('npm', ['pack', 'jsqr@1.4.0', '--silent'], { cwd: work, stdio: 'inherit' });
mkdirSync(join(work, 'jsqr'));
execFileSync('tar', ['-xzf', join(work, 'jsqr-1.4.0.tgz'), '-C', join(work, 'jsqr')]);

const require = createRequire(import.meta.url);
const jsQR = require(join(work, 'jsqr/package/dist/jsQR.js'));
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--hide-scrollbars'], defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage();
await page.goto(`${url}?renderer=none`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));

// Se recorta el panel de la captura de pantalla (no del canvas) y se decodifica.
const shot = await page.screenshot({ clip: { x: 1220, y: 56, width: 300, height: 784 }, encoding: 'base64' });
const decoded = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { w: canvas.width, h: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
}, shot);
await browser.close();

const result = jsQR(Uint8ClampedArray.from(decoded.data), decoded.w, decoded.h);
console.log('QR leído de la pantalla:', result ? result.data : 'NO SE PUDO LEER');
if (result?.data !== expected) {
  console.log(`FALLA: se esperaba ${expected}`);
  process.exit(1);
}
console.log('OK');
