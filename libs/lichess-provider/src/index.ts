// Cliente de la API pública de lichess
export { LichessProvider, createLichessProvider } from './lib/lichess-provider';

// Normalización al modelo común
export {
  normalizeGame,
  normalizeGames,
  parseNdjson,
  formatTimeControl,
  extractOpening,
  extractResult,
} from './lib/normalize';

// Tipos
export {
  LichessUserNotFoundError,
  LichessRateLimitError,
} from './lib/types';
export type {
  LichessGame,
  LichessPlayer,
  LichessProviderConfig,
} from './lib/types';

// Configuración
export { LICHESS_CONFIG } from './lib/constants';
