// Cliente de la API pública de chess.com
export { ChessComProvider, createChessComProvider } from './lib/chess-com-provider';

// Normalización al modelo común
export {
  normalizeGame,
  normalizeGames,
  parseTimeControl,
  readPgnHeader,
  extractOpening,
  extractResult,
  openingNameFromUrl,
} from './lib/normalize';
export type { ParsedTimeControl } from './lib/normalize';

// Tipos
export { ChessComUserNotFoundError } from './lib/types';
export type {
  ChessComGame,
  ChessComPlayer,
  ChessComMonthResponse,
  ChessComArchivesResponse,
  ChessComProviderConfig,
} from './lib/types';

// Configuración
export { CHESS_COM_CONFIG } from './lib/constants';
