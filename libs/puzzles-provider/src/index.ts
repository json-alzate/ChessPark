// Exportar el proveedor principal
export { PuzzlesProvider, createPuzzlesProvider } from './lib/puzzles-provider';

// Exportar el servicio de caché
export { PuzzlesCacheService } from './lib/cache.service';

// Exportar tipos e interfaces
export type {
  Puzzle,
  PuzzleQueryOptions,
  PuzzleFileInfo,
  PuzzlesIndex,
  PuzzlesProviderConfig,
  CacheEntry,
} from './lib/types';

// Exportar constantes
export {
  AVAILABLE_THEMES,
  AVAILABLE_OPENINGS,
  ELO_CONSTANTS,
  DEFAULT_CONFIG,
} from './lib/constants';

// Exportar utilidades
export {
  getRepoBase,
  getEloRange,
  buildPuzzleUrl,
  shuffleArray,
  filterByColor,
  normalizeElo,
  generateEloSequence,
  limitPuzzleCount,
} from './lib/utils';
