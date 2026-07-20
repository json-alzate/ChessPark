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
  InfinityPoolEntry,
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
  dedupeByUid,
  filterByColor,
  normalizeElo,
  generateEloSequence,
  filterEloSequenceByManifest,
  limitPuzzleCount,
} from './lib/utils';

// Exportar utilidades del manifiesto de combinaciones válidas
export {
  getValidEloStarts,
  getManifestThemes,
  getManifestOpenings,
  MANIFEST_ELO_STEP,
} from './lib/manifest';
