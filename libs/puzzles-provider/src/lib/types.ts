/**
 * Representa un puzzle de ajedrez
 */
export interface Puzzle {
  uid: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation?: number;
  popularity?: number;
  nbPlays?: number;
  themes?: string[];
  gameUrl?: string;
  openingFamily?: string;
  openingVariation?: string;
}

/**
 * Opciones para consultar puzzles
 */
export interface PuzzleQueryOptions {
  /** Nivel de ELO del puzzle (por defecto: 1500) */
  elo?: number;
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
}

/**
 * Entrada del caché
 */
export interface CacheEntry {
  url: string;
  puzzles: Puzzle[];
  timestamp: number;
}

