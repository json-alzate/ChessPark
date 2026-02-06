/**
 * Representa un puzzle de ajedrez
 */
export interface Puzzle {
  uid: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  randomNumberQuery: number;
  nbPlays: number;
  themes: string[];
  gameUrl: string;
  openingFamily: string;
  openingVariation: string;
  times?: {
    warningOn: number;
    dangerOn: number;
    total: number;
  };
  timeUsed?: number;
  goshPuzzleTime?: number;
  fenStartUserPuzzle?: string;
  firstMoveSquaresHighlight?: string[];
}

/**
 * Opciones para consultar puzzles
 */
export interface PuzzleQueryOptions {
  /** Nivel de ELO del puzzle (por defecto: 1500) */
  elo: number;
  /** Tema del puzzle (opcional, si no se especifica se elige uno aleatorio) */
  theme?: string;
  /** Familia de apertura (opcional) */
  openingFamily?: string;
  /** Color del jugador que resuelve el puzzle */
  color?: 'w' | 'b' | 'N/A';
  /** Cantidad de puzzles a devolver (por defecto: 200, máximo: 200) */
  count?: number;
}

/**
 * Información sobre un archivo de puzzles
 */
export interface PuzzleFileInfo {
  eloRange: string;
  fileName: string;
  count: number;
}

/**
 * Estructura del índice de puzzles
 */
export interface PuzzlesIndex {
  [themeOrOpening: string]: PuzzleFileInfo[];
}

/**
 * Configuración del provider de puzzles
 */
export interface PuzzlesProviderConfig {
  /** Base URL del CDN de GitHub (por defecto: https://cdn.jsdelivr.net/gh) */
  cdnBaseUrl?: string;
  /** Usuario de GitHub donde están los repositorios (por defecto: json-alzate) */
  githubUser?: string;
  /** Habilitar caché local (por defecto: true) */
  enableCache?: boolean;
  /** Tiempo de expiración del caché en milisegundos (por defecto: 7 días) */
  cacheExpirationMs?: number;
  /** Número máximo de descargas concurrentes (por defecto: 5) */
  maxConcurrentDownloads?: number;
  /** Tamaño del batch para procesar ELOs en paralelo (por defecto: 3) */
  batchSize?: number;
}

/**
 * Entrada del caché
 */
export interface CacheEntry {
  url: string;
  puzzles: Puzzle[];
  timestamp: number;
}

