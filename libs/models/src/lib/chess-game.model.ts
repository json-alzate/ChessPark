/**
 * Modelo canónico de una partida traída de una plataforma externa.
 *
 * chess.com y lichess devuelven formas muy distintas; los conectores las
 * traducen a esta única forma para que los reportes no tengan que saber de
 * dónde vino cada partida.
 */

/** Plataformas de las que se pueden traer partidas. */
export type ChessPlatform = 'chess.com' | 'lichess';

/** Resultado de la partida, siempre desde el punto de vista de las blancas. */
export type GameResult = '1-0' | '0-1' | '1/2-1/2';

/** Solo ajedrez estándar: las variantes se descartan al normalizar. */
export type GameVariant = 'standard';

/**
 * Familia de control de tiempo, con los cortes habituales del ajedrez online.
 * `daily` es el correspondencia de chess.com (días por jugada).
 */
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';

/** Un jugador dentro de la partida. */
export interface ChessGamePlayer {
  username: string;
  /** Rating en esa plataforma; 0 cuando la partida no lo trae. */
  rating: number;
}

/** La apertura, cuando la plataforma la identifica. */
export interface ChessGameOpening {
  /** Código ECO: 'B90'. */
  eco: string;
  /** Nombre legible: 'Sicilian Defense: Najdorf Variation'. */
  name: string;
}

/** Una partida ya normalizada, venga de donde venga. */
export interface ChessGame {
  /** Identificador de la plataforma; único dentro de ella. */
  id: string;
  source: ChessPlatform;
  pgn: string;
  /** Control de tiempo tal cual: '600', '180+2', '1/86400'. */
  timeControl: string;
  /** Segundos del tiempo base, sin incremento. */
  timeControlSeconds: number;
  /** Segundos que suma cada jugada; 0 si no hay incremento. */
  incrementSeconds: number;
  /** Familia derivada del tiempo base, para agrupar y filtrar. */
  timeClass: TimeClass;
  /** Cuándo terminó, en milisegundos UTC. */
  playedAt: number;
  white: ChessGamePlayer;
  black: ChessGamePlayer;
  result: GameResult;
  /** Color del usuario que pidió el análisis. */
  userColor: 'white' | 'black';
  opening?: ChessGameOpening;
  variant: GameVariant;
  /** true si la plataforma ya tiene análisis de computador de la partida. */
  analyzed: boolean;
}

/**
 * A qué familia pertenece un control de tiempo.
 *
 * Se usa el mismo criterio para las dos plataformas —tiempo base más cuarenta
 * jugadas de incremento— aunque cada una tenga el suyo: si chess.com y lichess
 * clasificaran distinto, juntar sus partidas en una misma tabla mentiría.
 */
export function timeClassFor(
  baseSeconds: number,
  incrementSeconds = 0
): TimeClass {
  if (baseSeconds >= 24 * 60 * 60) {
    return 'daily';
  }

  const estimated = baseSeconds + 40 * incrementSeconds;
  if (estimated < 180) {
    return 'bullet';
  }
  if (estimated < 480) {
    return 'blitz';
  }
  if (estimated < 1500) {
    return 'rapid';
  }
  return 'classical';
}

/**
 * Un mes del archivo de un usuario. Es la unidad con la que se descarga y se
 * guarda: un mes pasado ya no cambia nunca, así que se pide una sola vez.
 */
export interface ArchiveMonth {
  year: number;
  /** Mes natural, de 1 a 12. */
  month: number;
}

/** El mes de una fecha, en la zona horaria del dispositivo. */
export function archiveMonthOf(date: Date): ArchiveMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Clave estable de un mes: '2026-03'. Sirve para ordenar y para el caché. */
export function archiveMonthKey(month: ArchiveMonth): string {
  return `${month.year}-${String(month.month).padStart(2, '0')}`;
}

/** Los meses entre dos fechas, ambos incluidos y de más antiguo a más nuevo. */
export function archiveMonthsBetween(from: Date, to: Date): ArchiveMonth[] {
  const months: ArchiveMonth[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= last) {
    months.push(archiveMonthOf(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/** Cómo le fue al usuario en una partida. */
export type UserOutcome = 'win' | 'loss' | 'draw';

/** El resultado visto desde el color que jugó el usuario. */
export function outcomeForUser(game: ChessGame): UserOutcome {
  if (game.result === '1/2-1/2') {
    return 'draw';
  }
  const whiteWon = game.result === '1-0';
  return whiteWon === (game.userColor === 'white') ? 'win' : 'loss';
}

/** El rating del usuario en esa partida. */
export function userRating(game: ChessGame): number {
  return game.userColor === 'white' ? game.white.rating : game.black.rating;
}

/** El rating del rival en esa partida. */
export function opponentRating(game: ChessGame): number {
  return game.userColor === 'white' ? game.black.rating : game.white.rating;
}
