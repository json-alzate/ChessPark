/**
 * Configuración del conector de chess.com.
 *
 * La API pública no pide autenticación ni clave: basta el nombre de usuario.
 * Ver https://www.chess.com/news/view/published-data-api
 */
export const CHESS_COM_CONFIG = {
  BASE_URL: 'https://api.chess.com/pub',
  /**
   * chess.com pide no pasar de una petición por segundo. Un mes de partidas es
   * una petición, así que un año son doce segundos: se respeta el ritmo y se
   * avisa del avance en vez de arriesgar un bloqueo por ir deprisa.
   */
  MIN_REQUEST_INTERVAL_MS: 1000,
} as const;
