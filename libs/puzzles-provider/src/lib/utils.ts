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
 * Limita el número de puzzles según el máximo permitido
 */
export function limitPuzzleCount(count?: number): number {
  if (!count) return DEFAULT_CONFIG.DEFAULT_PUZZLE_COUNT;
  if (count > DEFAULT_CONFIG.MAX_PUZZLE_COUNT) return DEFAULT_CONFIG.MAX_PUZZLE_COUNT;
  return count;
}

