/**
 * Configuración del conector de lichess.
 *
 * La exportación de partidas públicas no pide autenticación. Ver
 * https://lichess.org/api#tag/Games/operation/apiGamesUser
 */
export const LICHESS_CONFIG = {
  BASE_URL: 'https://lichess.org/api',
  /**
   * lichess es más generoso que chess.com, pero pide no encadenar peticiones
   * sin pausa. Un mes por petición con este respiro no se acerca al límite.
   */
  MIN_REQUEST_INTERVAL_MS: 300,
  /**
   * Modalidades de ajedrez estándar. Nombrarlas deja fuera las variantes
   * (chess960, atómico, caballo loco…) sin depender de filtrar después.
   */
  PERF_TYPES: 'ultraBullet,bullet,blitz,rapid,classical,correspondence',
} as const;
