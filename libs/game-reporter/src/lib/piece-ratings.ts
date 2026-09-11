import { Chess } from 'chess.js';

import { getPieceHeatmap, PieceColor, PieceKind } from './piece-heatmap';

/** La evaluación de una posición, siempre desde el punto de vista de las blancas. */
export interface PositionEval {
  /** Ventaja en centésimas de peón: positiva si van mejor las blancas. */
  cp?: number;
  /** Mate a la vista: positivo si lo dan las blancas, negativo si las negras. */
  mate?: number;
}

/** Cómo fue una jugada, de mejor a peor. */
export type MoveClassification =
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

/** La valoración de una jugada. */
export interface MoveReview {
  /** Media jugada, empezando en 1. */
  ply: number;
  color: PieceColor;
  /** Cuánta probabilidad de ganar perdió quien movió, de 0 a 100. */
  loss: number;
  /** Precisión de la jugada, de 0 a 100. */
  accuracy: number;
  classification: MoveClassification;
}

/** La nota de una pieza en la partida. */
export interface PieceRating {
  /** Color y casilla inicial, igual que en el mapa de calor: 'w-g1'. */
  id: string;
  color: PieceColor;
  type: PieceKind;
  startSquare: string;
  promotedTo?: PieceKind;
  capturedAtPly?: number;
  /** Jugadas suyas que se pudieron valorar. */
  moves: number;
  /** Nota del 1 al 10 con un decimal; null si no se movió. */
  rating: number | null;
  /** Precisión media de sus jugadas, de 0 a 100; null si no se movió. */
  accuracy: number | null;
  counts: Record<MoveClassification, number>;
}

/** La valoración completa de una partida. */
export interface GameReview {
  moves: MoveReview[];
  /** En el mismo orden que el mapa de calor. */
  pieces: PieceRating[];
  best: Record<PieceColor, PieceRating | null>;
  /** null si ese color solo tiene una pieza con nota (sería también la mejor). */
  worst: Record<PieceColor, PieceRating | null>;
}

/**
 * Por encima de diez peones de ventaja la partida está decidida: se recorta
 * para que un error con +25 no cuente distinto que uno con +10.
 */
const CP_CLAMP = 1000;

/**
 * Jugadas mínimas para optar a mejor o peor pieza. Como en el fútbol, quien
 * sale al campo un minuto y acierta un pase no es el mejor del partido.
 */
const MIN_MOVES_FOR_AWARD = 2;

/**
 * Probabilidad de ganar de las blancas, de 0 a 100.
 *
 * Es la curva que publica lichess: pasa de centésimas de peón a probabilidad,
 * así que perder un peón con la partida igualada pesa mucho y perderlo con
 * nueve de ventaja casi nada.
 */
export function winChance(evaluation: PositionEval): number {
  if (evaluation.mate !== undefined) {
    return evaluation.mate > 0 ? 100 : 0;
  }
  const cp = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, evaluation.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Pasa la puntuación de Stockfish al punto de vista de las blancas.
 *
 * Stockfish puntúa desde el lado que mueve: "+50" con negras al turno es
 * ventaja de las negras. Sin darle la vuelta, todas las jugadas de negras
 * saldrían valoradas al revés.
 */
export function engineEvalForWhite(
  fen: string,
  score: number,
  mate?: number
): PositionEval {
  const whiteToMove = fen.split(' ')[1] !== 'b';

  if (mate !== undefined) {
    // "mate 0": quien mueve ya está mateado
    if (mate === 0) {
      return { mate: whiteToMove ? -1 : 1 };
    }
    return { mate: whiteToMove ? mate : -mate };
  }
  return { cp: whiteToMove ? score : -score };
}

/**
 * La evaluación de una posición terminada, sin preguntar a Stockfish: el mate
 * lo gana quien no está al turno y las tablas valen cero. null si la partida
 * sigue.
 */
export function terminalEval(fen: string): PositionEval | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }

  if (chess.isCheckmate()) {
    return { mate: chess.turn() === 'w' ? -1 : 1 };
  }
  if (chess.isDraw()) {
    return { cp: 0 };
  }
  return null;
}

/** Precisión de una jugada según lo que se perdió, con la fórmula de lichess. */
export function moveAccuracy(loss: number): number {
  const value = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
  return Math.max(0, Math.min(100, value));
}

/**
 * Clasifica una jugada por la probabilidad de ganar que se perdió. Los cortes
 * de imprecisión, error y error grave son los de lichess (5, 10 y 15 puntos).
 */
export function classifyMove(loss: number): MoveClassification {
  if (loss < 2) {
    return 'excellent';
  }
  if (loss < 5) {
    return 'good';
  }
  if (loss < 10) {
    return 'inaccuracy';
  }
  if (loss < 15) {
    return 'mistake';
  }
  return 'blunder';
}

/**
 * La nota del 1 al 10 de un conjunto de jugadas.
 *
 * Sale de la media armónica de sus precisiones, no de la media normal: la
 * armónica la hunde una sola mala jugada, igual que un error que acaba en gol
 * hunde la nota de un defensa aunque haya hecho bien todo lo demás.
 */
export function ratingFromAccuracies(accuracies: number[]): number | null {
  if (accuracies.length === 0) {
    return null;
  }
  const inverseSum = accuracies.reduce(
    (total, accuracy) => total + 1 / Math.max(accuracy, 1),
    0
  );
  const harmonic = accuracies.length / inverseSum;
  return Math.round((1 + (9 * harmonic) / 100) * 10) / 10;
}

/**
 * Valora cada jugada y pone nota a cada pieza.
 *
 * `evals` trae una evaluación por posición: la inicial y la que queda tras
 * cada media jugada. Cada jugada se valora comparando la probabilidad de ganar
 * de quien movió antes y después, y se apunta a la pieza que la hizo (en el
 * enroque, al rey y a la torre). Si falta la evaluación de alguna de las dos
 * posiciones, esa jugada no se valora.
 *
 * Devuelve null si el PGN no se deja leer.
 */
export function reviewGame(
  pgn: string,
  evals: Array<PositionEval | null>
): GameReview | null {
  const heatmap = getPieceHeatmap(pgn);
  if (!heatmap) {
    return null;
  }

  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }

  const moves: MoveReview[] = [];
  chess.history({ verbose: true }).forEach((move, index) => {
    const before = evals[index];
    const after = evals[index + 1];
    if (!before || !after) {
      return;
    }

    const forMover = (evaluation: PositionEval) =>
      move.color === 'w' ? winChance(evaluation) : 100 - winChance(evaluation);
    const loss = Math.max(0, forMover(before) - forMover(after));

    moves.push({
      ply: index + 1,
      color: move.color,
      loss,
      accuracy: moveAccuracy(loss),
      classification: classifyMove(loss),
    });
  });

  const byPly = new Map(moves.map((move) => [move.ply, move]));

  const pieces: PieceRating[] = heatmap.pieces.map((piece) => {
    const reviewed = piece.plies
      .map((ply) => byPly.get(ply))
      .filter((move): move is MoveReview => move !== undefined);

    const counts: Record<MoveClassification, number> = {
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    };
    reviewed.forEach((move) => {
      counts[move.classification] += 1;
    });

    const accuracies = reviewed.map((move) => move.accuracy);

    return {
      id: piece.id,
      color: piece.color,
      type: piece.type,
      startSquare: piece.startSquare,
      promotedTo: piece.promotedTo,
      capturedAtPly: piece.capturedAtPly,
      moves: reviewed.length,
      rating: ratingFromAccuracies(accuracies),
      accuracy: accuracies.length
        ? accuracies.reduce((total, value) => total + value, 0) / accuracies.length
        : null,
      counts,
    };
  });

  const bestWhite = pickAward(pieces, 'w', 'best');
  const bestBlack = pickAward(pieces, 'b', 'best');
  const worstWhite = pickAward(pieces, 'w', 'worst');
  const worstBlack = pickAward(pieces, 'b', 'worst');

  return {
    moves,
    pieces,
    best: { w: bestWhite, b: bestBlack },
    worst: {
      w: worstWhite?.id === bestWhite?.id ? null : worstWhite,
      b: worstBlack?.id === bestBlack?.id ? null : worstBlack,
    },
  };
}

/**
 * La mejor o la peor pieza de un color. Optan las que jugaron un mínimo; si
 * ninguna llega, todas las que tienen nota. A igual nota gana la que más jugó.
 */
function pickAward(
  pieces: PieceRating[],
  color: PieceColor,
  kind: 'best' | 'worst'
): PieceRating | null {
  const rated = pieces.filter(
    (piece) => piece.color === color && piece.rating !== null
  );
  const regulars = rated.filter((piece) => piece.moves >= MIN_MOVES_FOR_AWARD);
  const pool = regulars.length ? regulars : rated;
  if (pool.length === 0) {
    return null;
  }

  const sorted = [...pool].sort((a, b) => {
    const byRating = (b.rating as number) - (a.rating as number);
    return kind === 'best'
      ? byRating || b.moves - a.moves
      : -byRating || b.moves - a.moves;
  });
  return sorted[0];
}
