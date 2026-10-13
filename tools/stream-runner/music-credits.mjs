#!/usr/bin/env node
/**
 * Genera, a partir de `music/manifest.json`:
 *   - docs/CREDITOS_MUSICA.md                  → registro de pistas, licencias y evidencia
 *   - tools/stream-runner/music/DESCRIPCION_MUSICA.txt → bloque de atribución para pegar en la descripción del directo
 *   - apps/chessColate/src/app/features/settings/config/music-credits.config.ts → lista que muestra la pantalla de créditos
 *
 * Las licencias CC BY exigen atribución, y YouTube limita la descripción a 5000 caracteres: el bloque
 * lista a los autores por licencia y enlaza a los créditos pista por pista. Hay que publicar esa
 * página (la pantalla de créditos de ChessColate, por defecto) y su URL va en la descripción.
 *
 *   node tools/stream-runner/music-credits.mjs [--credits-url=https://…]
 *
 * Títulos y autores vienen de internet (datos no confiables): se limpian y escapan antes de escribirlos.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const manifest = JSON.parse(readFileSync(join(HERE, 'music', 'manifest.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=')];
}));
const creditsUrl = args['credits-url'] || 'https://chesscolate.web.app/settings/credits';

/** Texto plano seguro: sin saltos de línea ni caracteres de control, longitud acotada. */
const clean = (s, max = 120) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Para una celda de Markdown: además se escapan los caracteres que formarían enlaces o columnas. */
const md = (s, max) => clean(s, max).replace(/[\\|`*_[\]()#!]/g, '\\$&');
const mins = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const licenseKey = (t) => (t.license_name.startsWith('CC0') ? 'CC0' : t.license_name);

const LICENSE_URL = {
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
};
const ORDER = ['CC BY 3.0', 'CC BY 4.0', 'CC0'];

const byLicense = Object.fromEntries(ORDER.map((k) => [k, manifest.filter((t) => licenseKey(t) === k)]));
const authors = (list) => [...new Set(list.map((t) => clean(t.author, 60)))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
const totalMin = manifest.reduce((a, t) => a + t.duration_sec, 0) / 60;
const withSamples = manifest.filter((t) => (t.samples_from ?? []).length > 0);

// ---- bloque para la descripción (inglés sencillo) ----------------------------------------------
const lines = ['Music (instrumental, used under Creative Commons licenses):', ''];
for (const key of ORDER) {
  const list = authors(byLicense[key]);
  if (!list.length) continue;
  const label = key === 'CC0' ? 'CC0 (public domain)' : key;
  lines.push(`${label} - ${LICENSE_URL[key]}`, list.join(', '), '');
}
lines.push(`Full track-by-track credits and links: ${creditsUrl}`);
const description = lines.join('\n');
writeFileSync(join(HERE, 'music', 'DESCRIPCION_MUSICA.txt'), description + '\n');

// ---- docs/CREDITOS_MUSICA.md -------------------------------------------------------------------
const rows = manifest.map((t, i) => {
  const lic = licenseKey(t);
  return `| ${i + 1} | ${md(t.title, 70)} | ${md(t.author, 40)} | [${t.source === 'ccMixter' ? 'ccMixter' : 'Wikimedia Commons'}](${t.page_url}) | [${lic}](${LICENSE_URL[lic]}) | ${mins(t.duration_sec)} |`;
});

const sampleRows = withSamples.map((t) => `- «${md(t.title, 70)}» (${md(t.author, 40)}): ${(t.samples_from ?? []).map((u) => `<${u}>`).join(', ')}`);

const doc = `# Créditos de la música del directo 24/7

Música instrumental de fondo del canal de puzzles lofi. **Generado** por \`tools/stream-runner/music-credits.mjs\`
a partir de \`tools/stream-runner/music/manifest.json\`; no se edita a mano.

El canal es **monetizable**, así que solo se admiten licencias que lo permiten: **CC BY** (con atribución) y
**CC0** (sin condiciones). Se descartaron las licencias NC (no comercial), ND (sin derivadas, porque se
normaliza el volumen) y SA (compartir igual).

## Resumen

| Licencia | Pistas | Autores | Minutos |
|---|---:|---:|---:|
${ORDER.map((k) => `| [${k}](${LICENSE_URL[k]}) | ${byLicense[k].length} | ${authors(byLicense[k]).length} | ${(byLicense[k].reduce((a, t) => a + t.duration_sec, 0) / 60).toFixed(1)} |`).join('\n')}
| **Total** | **${manifest.length}** | **${authors(manifest).length}** | **${totalMin.toFixed(1)}** |

Máximo 6 pistas por autor, para repartir el riesgo de reclamos de Content ID.

## Cómo se verificó la licencia

- **ccMixter (${manifest.filter((t) => t.source === 'ccMixter').length} pistas):** en la página de cada pista, el enlace \`rel="license"\` apunta a la licencia
  declarada (CC BY 3.0 o CC0). Se guardó la página como evidencia en \`tools/stream-runner/music/licencias/\`.
- **Chris Zabriskie (${manifest.filter((t) => t.source !== 'ccMixter').length} pistas, vía Wikimedia Commons):** la página de Commons declara CC BY 4.0 pero figura
  como *"License review needed"* (sin revisar por voluntarios). Se confirmó en la web del propio autor
  (chriszabriskie.com/use): *"All of my music is free to use … CC BY 4.0 · Commercial use OK · Credit required"*.
- Se contrastaron 6 pistas al azar de ccMixter contra la web **en vivo** el día de la verificación (2026-10-12).

## Atribución obligatoria

Las licencias CC BY exigen dar crédito. Hay que pegar este bloque en la **descripción del directo**
(también en \`tools/stream-runner/music/DESCRIPCION_MUSICA.txt\`) y publicar esta lista de pistas en la URL que se indica:

\`\`\`text
${description}
\`\`\`

## Riesgos y límites

- **Content ID:** una licencia libre no evita reclamos automáticos. Un autor o un editor puede registrar una pista
  en Content ID y reclamar el directo. Las cinco pistas de Zabriskie figuran con un editor ASCAP. No se pudo
  comprobar qué autores están registrados. Si llega un reclamo, se disputa citando la licencia y esta evidencia.
- **Sin escuchar:** que sean instrumentales y suaves se basa en las etiquetas de ccMixter (83 de 88 llevan
  \`instrumental\`; las 5 de Zabriskie no tienen etiquetas), el BPM declarado y mediciones de volumen. Conviene
  oír una muestra de cada autor (\`prepare-music\` y \`music-sample\`).
- **Remezclas:** ${withSamples.length} pistas de ccMixter son remezclas con material de otros autores (lista abajo). ccMixter exige
  licencias compatibles, pero no se verificó la licencia de cada pista de origen por separado.
- **Material descartado:** las pistas rechazadas y el motivo están en \`tools/stream-runner/music/descartadas.json\`.

## Pistas (${manifest.length})

| # | Título | Autor | Fuente | Licencia | Dur. |
|--:|---|---|---|---|--:|
${rows.join('\n')}

## Remezclas con material de terceros

${sampleRows.join('\n') || '_Ninguna._'}
`;
writeFileSync(join(REPO, 'docs', 'CREDITOS_MUSICA.md'), doc);

// ---- pantalla de créditos de ChessColate -------------------------------------------------------
// Las URLs vienen de internet: solo se aceptan https y los dos sitios de los que se descargó.
const SOURCES = { 'ccmixter.org': 'ccmixter', 'commons.wikimedia.org': 'commons' };
const LICENSE_ID = { 'CC BY 3.0': 'CC-BY-3.0', 'CC BY 4.0': 'CC-BY-4.0', CC0: 'CC0-1.0' };
const tracks = manifest.map((t) => {
  const url = new URL(t.page_url);
  const source = SOURCES[url.hostname];
  if (url.protocol !== 'https:' || !source) {
    throw new Error(`URL de pista no admitida: ${t.page_url}`);
  }
  return {
    title: clean(t.title, 70),
    author: clean(t.author, 60),
    source,
    url: url.href,
    license: LICENSE_ID[licenseKey(t)],
    durationSec: Math.round(t.duration_sec),
  };
});
if (tracks.some((t) => !t.license)) {
  throw new Error('Hay una pista con una licencia que la pantalla de créditos no conoce');
}
const appConfig = `import type { MusicCredit } from '../models/credits.model';

/**
 * Música del directo 24/7 (${tracks.length} pistas). **Generado** por \`tools/stream-runner/music-credits.mjs\`
 * a partir de \`music/manifest.json\`; no se edita a mano. Se muestra en la pantalla de créditos.
 */
export const MUSIC_CREDITS: readonly MusicCredit[] = [
${tracks.map((t) => `  ${JSON.stringify(t)},`).join('\n')}
];
`;
writeFileSync(join(REPO, 'apps', 'chessColate', 'src', 'app', 'features', 'settings', 'config', 'music-credits.config.ts'), appConfig);

console.log(`docs/CREDITOS_MUSICA.md: ${manifest.length} pistas, ${authors(manifest).length} autores, ${totalMin.toFixed(1)} min`);
console.log(`descripción: ${description.length} caracteres (límite de YouTube: 5000)`);
