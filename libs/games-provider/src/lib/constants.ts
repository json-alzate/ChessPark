/**
 * Configuración del catálogo de partidas.
 *
 * Mismo montaje que los puzzles: repositorio público de GitHub servido por
 * jsDelivr. La diferencia es que aquí **el índice también se descarga**, para
 * que añadir un jugador sea un commit en el repositorio de partidas y no
 * obligue a publicar una versión de la app.
 */
export const GAMES_CONFIG = {
  CDN_BASE_URL: 'https://cdn.jsdelivr.net/gh',
  GITHUB_USER: 'json-alzate',
  REPO: 'chesscolate_pngs_packs',
  BRANCH: 'main',
  /** Nombre del índice dentro del repositorio. */
  INDEX_FILE: 'index.json',
  /**
   * Cuánto vale el índice guardado antes de volver a pedirlo. Un día: el
   * catálogo cambia poco y la pantalla debe abrir al instante.
   */
  INDEX_TTL_MS: 24 * 60 * 60 * 1000,
} as const;
