/**
 * La forma en que lichess devuelve las cosas. Solo se declaran los campos que
 * se usan: cada línea del NDJSON trae bastantes más.
 */

/** Un jugador dentro del JSON de una partida. */
export interface LichessPlayer {
  user?: { name?: string; id?: string };
  rating?: number;
  /** Cuánto le movió el rating esa partida. */
  ratingDiff?: number;
  /** Presente cuando el rival es el ordenador de lichess. */
  aiLevel?: number;
}

/** Una partida tal cual la devuelve la exportación. */
export interface LichessGame {
  id?: string;
  rated?: boolean;
  /** 'standard' es la única que interesa. */
  variant?: string;
  /** 'bullet', 'blitz', 'rapid', 'classical', 'correspondence'. */
  speed?: string;
  perf?: string;
  /** Milisegundos UTC en que empezó. */
  createdAt?: number;
  /** Milisegundos UTC de la última jugada. */
  lastMoveAt?: number;
  /** 'mate', 'resign', 'draw', 'outoftime', 'aborted'… */
  status?: string;
  winner?: 'white' | 'black';
  players?: { white?: LichessPlayer; black?: LichessPlayer };
  opening?: { eco?: string; name?: string; ply?: number };
  /** Reloj en segundos; ausente en correspondencia. */
  clock?: { initial?: number; increment?: number; totalTime?: number };
  /** Días por jugada en correspondencia. */
  daysPerTurn?: number;
  /** Solo llega si se pide con `pgnInJson`. */
  pgn?: string;
  /** Se pide con `analysed`; indica que la partida tiene análisis del servidor. */
  analysis?: unknown[];
}

export interface LichessProviderConfig {
  baseUrl?: string;
  /** Milisegundos mínimos entre peticiones. */
  minRequestIntervalMs?: number;
}

/** Se lanza cuando lichess no conoce al usuario. */
export class LichessUserNotFoundError extends Error {
  constructor(public readonly username: string) {
    super(`lichess no encontró al usuario "${username}"`);
    this.name = 'LichessUserNotFoundError';
  }
}

/** Se lanza cuando lichess pide bajar el ritmo (HTTP 429). */
export class LichessRateLimitError extends Error {
  constructor() {
    super('lichess pidió esperar antes de seguir descargando');
    this.name = 'LichessRateLimitError';
  }
}
