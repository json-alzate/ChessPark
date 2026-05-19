import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, rmSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'dist');

// Clean previous build
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, 'icons'), { recursive: true });

const baseConfig = {
  bundle: true,
  minify: true,
  target: 'chrome120',
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  // Panel (detached window)
  build({
    ...baseConfig,
    entryPoints: [resolve(__dirname, 'src/popup/panel.ts')],
    outfile: resolve(outDir, 'panel.js'),
    format: 'iife',
  }),
  // Content script
  build({
    ...baseConfig,
    entryPoints: [resolve(__dirname, 'src/content/lichess.ts')],
    outfile: resolve(outDir, 'content.js'),
    format: 'iife',
  }),
  // Background service worker
  build({
    ...baseConfig,
    entryPoints: [resolve(__dirname, 'src/background/background.ts')],
    outfile: resolve(outDir, 'background.js'),
    format: 'esm',
  }),
]);

// Static files
copyFileSync(resolve(__dirname, 'src/popup/panel.html'), resolve(outDir, 'panel.html'));
copyFileSync(resolve(__dirname, 'src/popup/panel.css'), resolve(outDir, 'panel.css'));
copyFileSync(resolve(__dirname, 'src/content/content.css'), resolve(outDir, 'content.css'));
copyFileSync(resolve(__dirname, 'manifest.json'), resolve(outDir, 'manifest.json'));

// Icons (extension icons + plan animal icons)
for (const file of readdirSync(resolve(__dirname, 'icons'))) {
  copyFileSync(
    resolve(__dirname, 'icons', file),
    resolve(outDir, 'icons', file),
  );
}

// cm-chessboard assets (SVG pieces + CSS)
const cmSrc = resolve(__dirname, '../../node_modules/cm-chessboard/assets');
const cmDst = resolve(outDir, 'cm-chessboard');
cpSync(cmSrc, cmDst, { recursive: true });

console.log('✓ Extension built to dist/');
