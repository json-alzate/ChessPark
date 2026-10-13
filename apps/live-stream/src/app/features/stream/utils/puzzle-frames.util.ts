import { Chess } from 'chess.js';
import type { GameMoveSquares } from '@chesspark/board/stream';
import type { Puzzle } from '@chesspark/puzzles-provider';

/** Un puzzle convertido a las posiciones que reproduce el tablero. */
export interface PuzzleFrames {
  /** [posición inicial, tras la jugada del rival, ...una posición por jugada de la solución]. */
  fens: string[];
  /** Casillas de cada jugada (una menos que `fens`). */
  moveSquares: GameMoveSquares[];
  /** Color de quien resuelve el puzzle: el contrario de quien mueve en el FEN. */
  solver: 'w' | 'b';
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Convierte un puzzle de Lichess en posiciones.
 *
 * En esos puzzles el FEN es la posición *antes* de la jugada del rival, y la primera jugada
 * de `moves` (en notación UCI) es la suya; la solución empieza en la segunda.
 *
 * Devuelve `null` si el puzzle no se puede reproducir (FEN inválido, jugada ilegal, menos de
 * dos jugadas): un directo 24/7 salta ese puzzle en lugar de quedarse colgado.
 */
export function puzzleToFrames(puzzle: Pick<Puzzle, 'fen' | 'moves'>): PuzzleFrames | null {
  const moves = (puzzle.moves ?? '').trim().split(/\s+/).filter(Boolean);
  if (moves.length < 2) {
    return null;
  }

  let chess: Chess;
  try {
    chess = new Chess(puzzle.fen);
  } catch {
    return null;
  }

  const solver = chess.turn() === 'w' ? 'b' : 'w';
  const fens = [chess.fen()];
  const moveSquares: GameMoveSquares[] = [];

  for (const uci of moves) {
    if (!UCI_MOVE.test(uci)) {
      return null;
    }
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      fens.push(chess.fen());
      moveSquares.push({ from: move.from, to: move.to });
    } catch {
      return null;
    }
  }

  return { fens, moveSquares, solver };
}
