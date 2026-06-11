#!/usr/bin/env node
/**
 * Genera el manifiesto de combinaciones válidas (tema/apertura × rango de ELO)
 * a partir de los repositorios de archivos de puzzles en GitHub.
 *
 * El provider usa este manifiesto para pedir SOLO URLs que existen y evitar
 * disparar decenas de requests 404 que ralentizan la carga de puzzles.
 *
 * Uso:
 *   node tools/generate-puzzles-manifest.mjs
 *   GITHUB_TOKEN=ghp_xxx node tools/generate-puzzles-manifest.mjs   (sube el rate limit)
 *
 * Salida: libs/puzzles-provider/src/lib/puzzles-manifest.json
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_USER = 'json-alzate';
const ELO_STEP = 20;

/** Repos y la carpeta/colección a la que pertenecen dentro del manifiesto. */
const REPOS = [
  { repo: 'chesscolate-puzzles-files-themes-a-h', dir: 'puzzlesFilesThemes', collection: 'themes' },
  { repo: 'chesscolate-puzzles-files-themes-i-o', dir: 'puzzlesFilesThemes', collection: 'themes' },
  { repo: 'chesscolate-puzzles-files-themes-p-z', dir: 'puzzlesFilesThemes', collection: 'themes' },
  { repo: 'chesscolate-puzzles-files-openings', dir: 'puzzlesFilesOpenings', collection: 'openings' },
];

const OUTPUT_PATH = resolve(__dirname, '../libs/puzzles-provider/src/lib/puzzles-manifest.json');

async function fetchTree(repo) {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${repo}/git/trees/main?recursive=1`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'chesspark-manifest-generator',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} para ${repo}`);
  }
  const json = await res.json();
  if (json.truncated) {
    throw new Error(
      `El árbol de ${repo} viene truncado por GitHub; el manifiesto sería incompleto. ` +
        `Aborta. (Considera paginar por subárboles si el repo creció demasiado.)`
    );
  }
  return json.tree ?? [];
}

function parseStart(path, dir) {
  // <dir>/<key>/<key>_<start>_<end>.json
  const match = path.match(new RegExp(`^${dir}/([^/]+)/\\1_(\\d+)_(\\d+)\\.json$`));
  if (!match) return null;
  return { key: match[1], start: Number(match[2]) };
}

async function main() {
  const collections = { themes: new Map(), openings: new Map() };

  for (const { repo, dir, collection } of REPOS) {
    process.stdout.write(`Consultando ${repo}... `);
    const tree = await fetchTree(repo);
    const store = collections[collection];
    let added = 0;

    for (const entry of tree) {
      if (entry.type !== 'blob') continue;
      const parsed = parseStart(entry.path, dir);
      if (!parsed) continue;
      if (!store.has(parsed.key)) store.set(parsed.key, new Set());
      store.get(parsed.key).add(parsed.start);
      added++;
    }
    console.log(`${added} archivos`);
  }

  const toSortedObject = (map) =>
    Object.fromEntries(
      [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, set]) => [key, [...set].sort((a, b) => a - b)])
    );

  const manifest = {
    eloStep: ELO_STEP,
    themes: toSortedObject(collections.themes),
    openings: toSortedObject(collections.openings),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(manifest) + '\n');

  // Resumen
  const themeCount = Object.keys(manifest.themes).length;
  const openingCount = Object.keys(manifest.openings).length;
  const combos =
    Object.values(manifest.themes).reduce((acc, arr) => acc + arr.length, 0) +
    Object.values(manifest.openings).reduce((acc, arr) => acc + arr.length, 0);

  console.log('\n--- Manifiesto generado ---');
  console.log(`Temas:     ${themeCount}`);
  console.log(`Aperturas: ${openingCount}`);
  console.log(`Combinaciones (tema/apertura × ELO): ${combos}`);
  console.log(`Archivo:   ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('\nError generando el manifiesto:', err.message);
  process.exit(1);
});
