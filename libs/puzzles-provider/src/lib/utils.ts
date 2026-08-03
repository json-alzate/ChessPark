import { DEFAULT_CONFIG, ELO_CONSTANTS } from './constants';
import { Puzzle } from './types';

/**
 * Construye la URL base del repositorio según el tema o apertura
 */
export function getRepoBase(
  cdnBaseUrl: string,
  githubUser: string,
  theme?: string,
  openingFamily?: string
): string {
  const base = cdnBaseUrl;
  const user = githubUser;

  // Si es por apertura
  if (openingFamily && !theme) {
    return `${base}/${user}/chesscolate-puzzles-files-openings@main`;
  }

  // Si no hay tema, retornar null
  if (!theme) {
    throw new Error('Debe especificarse un tema o una apertura');
  }

  // Determinar repositorio según la primera letra del tema
  const firstLetter = theme.charAt(0).toLowerCase();
  if (firstLetter >= 'a' && firstLetter <= 'h') {
    return `${base}/${user}/chesscolate-puzzles-files-themes-a-h@main`;
  } else if (firstLetter >= 'i' && firstLetter <= 'o') {
    return `${base}/${user}/chesscolate-puzzles-files-themes-i-o@main`;
  } else {
    return `${base}/${user}/chesscolate-puzzles-files-themes-p-z@main`;
  }
}

/**
 * Calcula el rango de ELO para el nombre del archivo
 * Ejemplo: 1500 -> "1500_1519"
 */
export function getEloRange(elo: number): string {
  const start = Math.floor(elo / ELO_CONSTANTS.ELO_STEP) * ELO_CONSTANTS.ELO_STEP;
  const end = start + (ELO_CONSTANTS.ELO_STEP - 1);
  return `${start}_${end}`;
}

/**
 * Construye la URL completa para obtener puzzles
 */
export function buildPuzzleUrl(
  cdnBaseUrl: string,
  githubUser: string,
  elo: number,
  theme?: string,
  openingFamily?: string
): string {
  const repoBase = getRepoBase(cdnBaseUrl, githubUser, theme, openingFamily);
  const eloRange = getEloRange(elo);

  const fileName = !theme
    ? `puzzlesFilesOpenings/${openingFamily}/${openingFamily}_${eloRange}.json`
    : `puzzlesFilesThemes/${theme}/${theme}_${eloRange}.json`;

  return `${repoBase}/${fileName}`;
}

/**
 * Datos extraídos de una URL de archivo de puzzles
 */
export interface ParsedPuzzleUrl {
  /** Tema del archivo (indefinido si el archivo es de una apertura) */
  theme?: string;
  /** Familia de apertura (indefinida si el archivo es de un tema) */
  opening?: string;
  eloStart: number;
  eloEnd: number;
}

/**
 * Inversa de `buildPuzzleUrl`: extrae tema/apertura y rango de ELO de una URL
 * del CDN. La carpeta contenedora es la fuente del nombre (los valores de
 * apertura llevan guiones bajos, así que partir el nombre del archivo sería
 * ambiguo).
 *
 * Devuelve `null` si la URL no sigue el patrón conocido.
 */
export function parsePuzzleUrl(url: string): ParsedPuzzleUrl | null {
  const match = url.match(
    /\/puzzlesFiles(Themes|Openings)\/([^/]+)\/[^/]+_(\d+)_(\d+)\.json$/
  );

  if (match) {
    const isTheme = match[1] === 'Themes';
    return {
      theme: isTheme ? match[2] : undefined,
      opening: isTheme ? undefined : match[2],
      eloStart: parseInt(match[3], 10),
      eloEnd: parseInt(match[4], 10),
    };
  }

  // Fallback: al menos el rango de ELO, que es lo que necesita el filtrado
  const eloMatch = url.match(/_(\d+)_(\d+)\.json$/);
  if (!eloMatch) return null;

  return {
    eloStart: parseInt(eloMatch[1], 10),
    eloEnd: parseInt(eloMatch[2], 10),
  };
}

/**
 * Tamaño aproximado en bytes que ocupa un conjunto de puzzles.
 *
 * Es el tamaño del JSON serializado, no lo que IndexedDB reserva en disco
 * (el structured clone añade su propio overhead). Suficiente para una pantalla
 * de "cuánto ocupa esto", y honesto siempre que se comunique como aproximado.
 */
export function estimateSizeBytes(puzzles: Puzzle[]): number {
  try {
    return JSON.stringify(puzzles).length;
  } catch {
    return 0;
  }
}

/**
 * Mezcla un array de puzzles usando el algoritmo Fisher-Yates
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Elimina puzzles repetidos por uid, conservando el primero de cada uno.
 * Los temas se solapan (mate/mateIn1), así que un mismo puzzle puede llegar
 * en los archivos de dos temas distintos.
 */
export function dedupeByUid(puzzles: Puzzle[]): Puzzle[] {
  const seen = new Set<string>();
  return puzzles.filter((puzzle) => {
    if (seen.has(puzzle.uid)) return false;
    seen.add(puzzle.uid);
    return true;
  });
}

/**
 * Filtra puzzles por color
 */
export function filterByColor(puzzles: Puzzle[], color: 'w' | 'b' | 'N/A'): Puzzle[] {
  if (color === 'N/A') return puzzles;

  return puzzles.filter((puzzle) => {
    const fenParts = puzzle.fen.split(' ');
    const puzzleColor = fenParts[1];
    return puzzleColor === color;
  });
}

/**
 * Normaliza el valor de ELO al rango permitido
 */
export function normalizeElo(elo: number): number {
  if (elo < ELO_CONSTANTS.MIN_ELO) return ELO_CONSTANTS.MIN_ELO;
  if (elo > ELO_CONSTANTS.MAX_ELO) return ELO_CONSTANTS.MAX_ELO;
  return elo;
}

/**
 * Genera una secuencia de ELOs para buscar puzzles
 * Primero hacia arriba, luego hacia abajo
 */
export function generateEloSequence(startElo: number): number[] {
  const normalized = normalizeElo(startElo);
  const sequence: number[] = [normalized];
  
  // Hacia arriba
  let currentElo = normalized + ELO_CONSTANTS.ELO_STEP;
  while (currentElo <= ELO_CONSTANTS.MAX_ELO) {
    sequence.push(currentElo);
    currentElo += ELO_CONSTANTS.ELO_STEP;
  }

  // Hacia abajo
  currentElo = normalized - ELO_CONSTANTS.ELO_STEP;
  while (currentElo >= ELO_CONSTANTS.MIN_ELO) {
    sequence.push(currentElo);
    currentElo -= ELO_CONSTANTS.ELO_STEP;
  }

  return sequence;
}

/**
 * Genera una secuencia de ELOs dentro de un rango fijo [eloMin, eloMax]
 * Útil para bloques con rango de ELO definido independiente del ELO del usuario
 */
export function generateEloSequenceInRange(eloMin: number, eloMax: number): number[] {
  const min = normalizeElo(Math.min(eloMin, eloMax));
  const max = normalizeElo(Math.max(eloMin, eloMax));
  const startNorm = Math.floor(min / ELO_CONSTANTS.ELO_STEP) * ELO_CONSTANTS.ELO_STEP;
  const endNorm = Math.floor(max / ELO_CONSTANTS.ELO_STEP) * ELO_CONSTANTS.ELO_STEP;
  const sequence: number[] = [];
  for (let elo = startNorm; elo <= endNorm; elo += ELO_CONSTANTS.ELO_STEP) {
    sequence.push(elo);
  }
  return sequence;
}

/**
 * Filtra una secuencia de ELOs dejando solo aquellos cuyo rango de archivo existe
 * realmente, según el conjunto de "starts" válidos del manifiesto.
 *
 * Aplica el mismo floor que `getEloRange`, de modo que el start filtrado coincide
 * exactamente con el nombre del archivo en el repositorio. Evita pedir URLs 404.
 *
 * Si `validStarts` es `undefined` (tema/apertura inexistente en el manifiesto),
 * devuelve un arreglo vacío: no hay nada que pedir.
 */
export function filterEloSequenceByManifest(
  sequence: number[],
  validStarts: Set<number> | undefined
): number[] {
  if (!validStarts) return [];
  return sequence.filter((elo) =>
    validStarts.has(Math.floor(elo / ELO_CONSTANTS.ELO_STEP) * ELO_CONSTANTS.ELO_STEP)
  );
}

/**
 * Limita el número de puzzles según el máximo permitido
 */
export function limitPuzzleCount(count?: number): number {
  if (!count) return DEFAULT_CONFIG.DEFAULT_PUZZLE_COUNT;
  if (count > DEFAULT_CONFIG.MAX_PUZZLE_COUNT) return DEFAULT_CONFIG.MAX_PUZZLE_COUNT;
  return count;
}

