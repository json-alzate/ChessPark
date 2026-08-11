// Proveedor del catálogo de partidas
export { GamesProvider, createGamesProvider } from './lib/games-provider';
export type { DownloadProgress } from './lib/games-provider';

// Caché en el dispositivo
export { GamesCacheService } from './lib/games-cache.service';

// Lectura de PGN
export {
  splitPgnGames,
  splitHeadersAndMoves,
  countPlies,
  parseGameHeader,
  parsePackHeaders,
  buildGame,
} from './lib/pgn';

// Tipos
export type {
  GameCollectionInfo,
  GamesIndex,
  GameHeader,
  MoveSquares,
  ParsedGame,
  CachedPack,
  GamesStorageSummary,
  GamesProviderConfig,
} from './lib/types';

// Configuración
export { GAMES_CONFIG } from './lib/constants';
