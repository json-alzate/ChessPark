/**
 * La forma en que chess.com devuelve las cosas. Solo se declaran los campos
 * que se usan: la respuesta real trae bastantes más.
 */

/** Un jugador dentro del JSON de una partida. */
export interface ChessComPlayer {
  username?: string;
  rating?: number;
  /**
   * Cómo terminó para ese jugador: 'win', 'resigned', 'timeout', 'agreed',
   * 'repetition', 'stalemate', 'insufficient', 'checkmated'…
   */
  result?: string;
}

/** Una partida tal cual la devuelve el archivo mensual. */
export interface ChessComGame {
  url?: string;
  uuid?: string;
  pgn?: string;
  /** '600', '180+2' o '1/86400' en correspondencia. */
  time_control?: string;
  /** Segundos UTC en que terminó. */
  end_time?: number;
  rated?: boolean;
  /** 'chess' es la estándar; el resto son variantes. */
  rules?: string;
  time_class?: string;
  white?: ChessComPlayer;
  black?: ChessComPlayer;
  /** Presente solo si la partida tiene análisis de computador. */
  accuracies?: { white?: number; black?: number };
  /** URL de la apertura en chess.com; el código ECO va en el PGN. */
  eco?: string;
}

/** La respuesta del archivo de un mes. */
export interface ChessComMonthResponse {
  games?: ChessComGame[];
}

/** La respuesta del listado de meses con partidas. */
export interface ChessComArchivesResponse {
  /** URLs completas: '…/pub/player/hikaru/games/2026/03'. */
  archives?: string[];
}

export interface ChessComProviderConfig {
  baseUrl?: string;
  /** Milisegundos mínimos entre peticiones. */
  minRequestIntervalMs?: number;
}

/** Se lanza cuando chess.com no conoce al usuario. */
export class ChessComUserNotFoundError extends Error {
  constructor(public readonly username: string) {
    super(`chess.com no encontró al usuario "${username}"`);
    this.name = 'ChessComUserNotFoundError';
  }
}
