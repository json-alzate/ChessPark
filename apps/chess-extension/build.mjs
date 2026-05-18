import { build } from 'esbuild';
import { copyFileSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'dist');

mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, 'icons'), { recursive: true });

const baseConfig = {
  bundle: true,
  minify: true,
  target: 'chrome120',
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  // Popup
  build({
    ...baseConfig,
    entryPoints: [resolve(__dirname, 'src/popup/popup.ts')],
    outfile: resolve(outDir, 'popup.js'),
    format: 'iife',
  }),
  // Content script
  build({
    ...baseConfig,
    entryPoints: [resolve(__dirname, 'src/content/lichess.ts')],
    outfile: resolve(outDir, 'content.js'),
    format: 'iife',
    // chrome is a global in content scripts
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
copyFileSync(resolve(__dirname, 'src/popup/popup.html'), resolve(outDir, 'popup.html'));
copyFileSync(resolve(__dirname, 'src/popup/popup.css'), resolve(outDir, 'popup.css'));
copyFileSync(resolve(__dirname, 'src/content/content.css'), resolve(outDir, 'content.css'));
copyFileSync(resolve(__dirname, 'manifest.json'), resolve(outDir, 'manifest.json'));

// Icons
for (const icon of ['icon16.png', 'icon48.png', 'icon128.png']) {
  copyFileSync(resolve(__dirname, `icons/${icon}`), resolve(outDir, `icons/${icon}`));
}

console.log('✓ Extension built to dist/');
