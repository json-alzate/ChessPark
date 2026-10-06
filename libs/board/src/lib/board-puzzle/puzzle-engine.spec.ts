import { PuzzleEngine } from './puzzle-engine';

/**
 * Puzzle de torre contra rey (la máquina abre con Ra7 y el usuario debe responder Kd8).
 * Se usa en varios casos: la jugada correcta es e8d8; e8f8 es legal pero incorrecta.
 */
const ROOK_PUZZLE = {
  fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
  moves: 'a1a7 e8d8 a7a8',
};

/**
 * Peón a punto de coronar: la máquina juega Kg6 y el usuario debe coronar en a8 (a7a8q).
 * El turno inicial es de negras, como exige la convención del tablero de puzzles.
 */
const PROMOTION_PUZZLE = {
  fen: '8/P6k/8/8/8/8/8/K7 b - - 0 1',
  moves: 'h7g6 a7a8q',
};

/** Deja el motor en el turno del usuario: avanza la jugada de la máquina y carga esa posición. */
function stopAtUserTurn(engine: PuzzleEngine): void {
  engine.advanceMachineMove();
  engine.loadCurrentSolutionFen();
}

describe('PuzzleEngine', () => {
  let engine: PuzzleEngine;

  beforeEach(() => {
    engine = new PuzzleEngine();
  });

  describe('load', () => {
    it('construye la solución y deja el motor en la posición inicial', () => {
      engine.load(ROOK_PUZZLE);

      expect(engine.fen).toBe(ROOK_PUZZLE.fen);
      expect(engine.sideToMove).toBe('w');
      expect(engine.currentMoveNumber).toBe(0);
      expect(engine.solutionLength).toBe(4);
      expect(engine.totalMoves).toBe(3);
      expect(engine.solutionMoveAt(1)).toBe('e8d8');
    });

    it('reemplaza la solución anterior al cargar otro puzzle', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      engine.load(PROMOTION_PUZZLE);

      expect(engine.currentMoveNumber).toBe(0);
      expect(engine.solutionLength).toBe(3);
      expect(engine.sideToMove).toBe('b');
    });
  });

  describe('evaluateUserMove', () => {
    it('acepta la jugada que coincide con la solución', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      expect(engine.tryMove('e8', 'd8')).toBe(true);
      expect(engine.evaluateUserMove()).toBe('correct');
      expect(engine.currentMoveNumber).toBe(2);
    });

    it('marca como incorrecta una jugada legal que no está en la solución', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      expect(engine.tryMove('e8', 'f8')).toBe(true);
      expect(engine.evaluateUserMove()).toBe('wrong');
    });

    it('no cambia el estado al recibir una jugada ilegal', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);
      const fenBefore = engine.fen;

      expect(engine.tryMove('e8', 'e5')).toBe(false);

      expect(engine.fen).toBe(fenBefore);
      expect(engine.currentMoveNumber).toBe(1);
    });

    it('no acepta una jugada desde una casilla vacía ni fuera de turno', () => {
      engine.load(ROOK_PUZZLE);

      // Es turno de blancas: mover el rey negro no es legal
      expect(engine.tryMove('e8', 'd8')).toBe(false);
      expect(engine.tryMove('e5', 'e6')).toBe(false);
    });
  });

  describe('advanceMachineMove', () => {
    it('avanza la solución y señala el fin cuando ya no quedan jugadas', () => {
      engine.load(ROOK_PUZZLE);

      // Máquina (a1a7) -> usuario (e8d8) -> máquina (a7a8): tras la última respuesta el puzzle queda resuelto
      expect(engine.advanceMachineMove()).toBe(false);
      engine.loadCurrentSolutionFen();
      engine.tryMove('e8', 'd8');
      engine.evaluateUserMove();
      expect(engine.advanceMachineMove()).toBe(false);
      engine.loadCurrentSolutionFen();
      expect(engine.advanceMachineMove()).toBe(true);
      expect(engine.currentMoveNumber).toBe(3);
    });

    it('al terminar la solución devuelve true y el índice no sale del rango', () => {
      engine.load({ fen: ROOK_PUZZLE.fen, moves: 'a1a7' });

      expect(engine.advanceMachineMove()).toBe(false);
      expect(engine.advanceMachineMove()).toBe(true);
      expect(engine.currentMoveNumber).toBe(1);
    });
  });

  describe('promoción', () => {
    beforeEach(() => {
      engine.load(PROMOTION_PUZZLE);
      stopAtUserTurn(engine);
    });

    it('detecta un peón que llega a la última fila como promoción', () => {
      expect(engine.isPromotionAttempt('wp', 'a8')).toBe(true);
      expect(engine.isPromotionAttempt('bp', 'a1')).toBe(true);
    });

    it('no trata como promoción a otras piezas ni peones que no llegan a la fila final', () => {
      expect(engine.isPromotionAttempt('wn', 'a8')).toBe(false);
      expect(engine.isPromotionAttempt('wp', 'a5')).toBe(false);
    });

    it('confirma que el peón puede llegar a la casilla de coronación', () => {
      expect(engine.isPawnPromotionLegal('a7', 'a8')).toBe(true);
      expect(engine.isPawnPromotionLegal('a7', 'b8')).toBe(false);
    });

    it('aplica la pieza elegida y la acepta si coincide con la solución', () => {
      expect(engine.tryMove('a7', 'a8', 'q')).toBe(true);
      expect(engine.fen.startsWith('Q7/')).toBe(true);
      expect(engine.evaluateUserMove()).toBe('correct');
    });

    it('marca como incorrecta una promoción a otra pieza distinta de la solución', () => {
      expect(engine.tryMove('a7', 'a8', 'n')).toBe(true);
      expect(engine.evaluateUserMove()).toBe('wrong');
    });
  });

  describe('resaltado y pista', () => {
    it('devuelve la pista con la jugada siguiente del usuario', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      expect(engine.hintSquares()).toEqual({ from: 'e8', to: 'd8' });
    });

    it('no devuelve pista si ya no quedan jugadas', () => {
      engine.load({ fen: ROOK_PUZZLE.fen, moves: 'a1a7' });
      engine.advanceMachineMove();

      expect(engine.hintSquares()).toBeNull();
    });

    it('usa la última jugada de la solución cuando el historial de la posición está vacío', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      expect(engine.lastMove()).toEqual({ from: 'a1', to: 'a7' });
    });

    it('no hay jugada que resaltar al inicio del puzzle', () => {
      engine.load(ROOK_PUZZLE);

      expect(engine.lastMove()).toBeNull();
    });

    it('lista las jugadas legales de una pieza del bando que mueve', () => {
      engine.load(ROOK_PUZZLE);
      stopAtUserTurn(engine);

      const targets = engine.movesFrom('e8').map((move) => move.to);
      expect(targets).toContain('d8');
      expect(engine.movesFrom('a7')).toEqual([]);
    });
  });

  describe('squaresOf', () => {
    it('separa origen y destino de una jugada UCI, incluida la promoción', () => {
      expect(PuzzleEngine.squaresOf('e2e4')).toEqual({ from: 'e2', to: 'e4' });
      expect(PuzzleEngine.squaresOf('a7a8q')).toEqual({ from: 'a7', to: 'a8' });
    });
  });
});
