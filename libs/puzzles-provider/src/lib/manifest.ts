import manifestData from './puzzles-manifest.json';

/**
 * Manifiesto de combinaciones válidas (tema/apertura × rango de ELO).
 *
 * Generado por `tools/generate-puzzles-manifest.mjs` a partir de los repositorios
 * de archivos de puzzles. Permite al provider pedir SOLO URLs que existen y evitar
 * disparar requests 404 que ralentizan la carga.
 *
 * Para regenerarlo (tras agregar/cambiar puzzles en los repos):
 *   node tools/generate-puzzles-manifest.mjs
 */
interface PuzzlesManifest {
  eloStep: number;
  themes: Record<string, number[]>;
  openings: Record<string, number[]>;
}

const manifest = manifestData as PuzzlesManifest;

/** Paso de ELO con el que se nombran los archivos (ej. 20 -> 1500_1519). */
export const MANIFEST_ELO_STEP = manifest.eloStep;

const buildStartsMap = (source: Record<string, number[]>): Map<string, Set<number>> =>
  new Map(Object.entries(source).map(([key, starts]) => [key, new Set(starts)]));

const THEME_STARTS = buildStartsMap(manifest.themes);
const OPENING_STARTS = buildStartsMap(manifest.openings);

/**
 * Devuelve el conjunto de ELO starts válidos para un tema o apertura.
 * Prioriza el tema; si no hay tema, usa la apertura.
 * Retorna `undefined` si la combinación no existe en el manifiesto.
 */
export function getValidEloStarts(
  theme?: string,
  openingFamily?: string
): Set<number> | undefined {
  if (theme) {
    return THEME_STARTS.get(theme);
  }
  if (openingFamily) {
    return OPENING_STARTS.get(openingFamily);
  }
  return undefined;
}

/** Lista de temas con archivos reales disponibles (claves del manifiesto). */
export function getManifestThemes(): string[] {
  return [...THEME_STARTS.keys()];
}

/** Lista de aperturas con archivos reales disponibles (claves del manifiesto). */
export function getManifestOpenings(): string[] {
  return [...OPENING_STARTS.keys()];
}
