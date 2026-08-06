/**
 * Una colección de partidas del catálogo, tal como viene en el índice remoto.
 * Ver el repositorio chesscolate_pngs_packs.
 */
export interface GameCollectionInfo {
  /** Identificador y nombre del archivo: 'petrosian'. */
  id: string;
  /** Nombre visible: 'Tigran Petrosian'. */
  name: string;
  /** Años como campeón del mundo: '1963–1969'. */
  reign: string;
  /** Cuántas partidas trae el paquete. */
  games: number;
  /** Cuánto ocupa el archivo. */
  sizeBytes: number;
  /** Ruta relativa dentro del repositorio: 'players/petrosian.pgn'. */
  file: string;
}

/** El índice completo que se descarga del CDN. */
export interface GamesIndex {
  generatedAt?: string;
  collections: GameCollectionInfo[];
}

/**
 * Cabecera de una partida. Es lo único que se extrae en la primera pasada:
 * basta para pintar la lista y filtrar, y evita hacer ajedrez con miles de
 * partidas que nadie va a abrir.
 */
export interface GameHeader {
  /** Posición dentro del paquete; es su identificador. */
  index: number;
  white: string;
  black: string;
  event: string;
  /** Fecha del PGN ('1963.05.20'); puede traer interrogantes. */
  date: string;
  /** Año suelto, o null si el PGN no lo dice. */
  year: number | null;
  result: string;
  /** ELOs; null cuando el PGN los trae vacíos (normal antes de 1970). */
  whiteElo: number | null;
  blackElo: number | null;
  /** Jugadas (medias jugadas) de la partida. */
  plies: number;
}

/** Casillas de origen y destino de una jugada, para resaltarla en el tablero. */
export interface MoveSquares {
  from: string;
  to: string;
}

/** Una partida ya lista para reproducir. */
export interface ParsedGame {
  header: GameHeader;
  /** Jugadas en notación algebraica: ['e4', 'e5', 'Nf3', …]. */
  sanMoves: string[];
  /** Una posición por jugada, incluida la inicial. Longitud = sanMoves + 1. */
  fens: string[];
  /** Casillas de cada jugada, en el mismo orden que sanMoves. */
  moveSquares: MoveSquares[];
}

/** Un paquete guardado en el dispositivo. */
export interface CachedPack {
  id: string;
  pgn: string;
  sizeBytes: number;
  downloadedAt: number;
}

/** Lo que ocupa el catálogo descargado, para la pantalla de Almacenamiento. */
export interface GamesStorageSummary {
  packs: number;
  sizeBytes: number;
}

export interface GamesProviderConfig {
  cdnBaseUrl?: string;
  githubUser?: string;
  repo?: string;
  branch?: string;
}
