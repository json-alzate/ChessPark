import { Chess, Move, Square } from 'chess.js';

/** Veredicto de una jugada del usuario frente a la solución del puzzle. */
export type PuzzleMoveVerdict = 'correct' | 'wrong';

/** Casillas de origen y destino de una jugada en notación UCI (p. ej. `e2e4` -> e2, e4). */
export interface PuzzleMoveSquares {
  from: string;
  to: string;
}

/**
 * Motor de un puzzle de ajedrez: lógica pura, sin Angular, sin timers y sin tablero visual.
 *
 * Responsabilidades (todo lo que es "ajedrez"):
 * - Construir la solución a partir del FEN y de las jugadas UCI del puzzle.
 * - Validar jugadas legales del usuario y aplicarlas al estado de chess.js.
 * - Detectar si una jugada es una promoción de peón y si es legal.
 * - Comparar la jugada del usuario con la solución (`evaluateUserMove`).
 * - Avanzar la solución con las respuestas de la máquina (`advanceMachineMove`).
 * - Calcular la pista (`hintSquares`) y la última jugada a resaltar (`lastMove`).
 *
 * Lo que NO hace (es UI, queda en BoardPuzzleComponent): sonidos, marcadores y flechas
 * del tablero, diálogo de promoción, esperas (`setTimeout`), timers del puzzle, emisión de eventos
 * y tokens de cancelación de tareas async.
 *
 * Ciclo de vida: se crea una vez por componente. `load()` reinicia el estado para cada puzzle;
 * el motor no tiene recursos que liberar.
 *
 * Índices: `currentMoveNumber` es la posición dentro de la solución. Tras `load()` vale 0 y
 * `solutionFenAt(0)` es la posición inicial. Cada jugada de la máquina y del usuario lo incrementa.
 *
 * @example
 * ```typescript
 * const engine = new PuzzleEngine();
 * engine.load(puzzle);
 * if (engine.advanceMachineMove()) { ... } // puzzle sin jugadas restantes
 * engine.loadCurrentSolutionFen();         // el tablero debe mostrar la posición de la máquina
 * if (engine.tryMove('e8', 'd8')) {
 *   const verdict = engine.evaluateUserMove(); // 'correct' | 'wrong'
 * }
 * ```
 */
export class PuzzleEngine {
  private readonly chess = new Chess();
  private solutionMoves: string[] = [];
  private solutionFens: string[] = [];
  private moveIndex = 0;

  /**
   * Carga un puzzle: construye la solución (FEN por jugada) y deja el estado en la posición inicial.
   *
   * @param puzzle - FEN inicial y jugadas de la solución separadas por espacios (UCI)
   * @throws si alguna jugada de la solución no es legal (chess.js lanza)
   */
  load(puzzle: { fen: string; moves: string }): void {
    this.chess.load(puzzle.fen);
    this.solutionMoves = puzzle.moves.split(' ');
    this.solutionFens = [this.chess.fen()];
    for (const move of this.solutionMoves) {
      this.chess.move(move);
      this.solutionFens.push(this.chess.fen());
    }
    this.moveIndex = 0;
    // Se regresa a la posición inicial: la construcción de la solución deja el motor al final.
    this.chess.load(puzzle.fen);
  }

  /** FEN de la posición actual del motor. */
  get fen(): string {
    return this.chess.fen();
  }

  /** Bando que mueve en la posición actual del motor. */
  get sideToMove(): 'w' | 'b' {
    return this.chess.turn();
  }

  /** Posición dentro de la solución (0 = inicial). */
  get currentMoveNumber(): number {
    return this.moveIndex;
  }

  /** Número de jugadas de la solución (medias jugadas). */
  get totalMoves(): number {
    return Math.max(0, this.solutionFens.length - 1);
  }

  /** Cantidad de posiciones de la solución, incluida la inicial. */
  get solutionLength(): number {
    return this.solutionFens.length;
  }

  /** FEN de la posición número `index` de la solución. */
  solutionFenAt(index: number): string {
    return this.solutionFens[index];
  }

  /** Jugada UCI número `index` de la solución, o cadena vacía si no existe. */
  solutionMoveAt(index: number): string {
    return this.solutionMoves[index] ?? '';
  }

  /** Convierte una jugada UCI en sus casillas de origen y destino. */
  static squaresOf(uci: string): PuzzleMoveSquares {
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  }

  /** Jugadas legales de la pieza en `square`, en formato detallado. Vacío si no hay ninguna. */
  movesFrom(square: string): Move[] {
    return this.chess.moves({ square: square as Square, verbose: true });
  }

  /**
   * Indica si la jugada implica una promoción: un peón que llega a la primera o la última fila.
   *
   * @param piece - Código de pieza de cm-chessboard, p. ej. `wp` o `bp`
   * @param to - Casilla destino
   */
  isPromotionAttempt(piece: string, to: string): boolean {
    return piece.charAt(1) === 'p' && (to.charAt(1) === '8' || to.charAt(1) === '1');
  }

  /**
   * Indica si el peón puede llegar a `to` (movimiento o captura legal), sin tener en cuenta
   * la pieza elegida en la promoción. Sirve para rechazar antes de abrir el diálogo.
   */
  isPawnPromotionLegal(from: string, to: string): boolean {
    return this.movesFrom(from).some((move) => move.to === to);
  }

  /**
   * Aplica una jugada del usuario si es legal. Si no lo es, el estado no cambia.
   *
   * @param from - Casilla de origen
   * @param to - Casilla de destino
   * @param promotion - Pieza de promoción (`q`, `r`, `b` o `n`), solo para promociones
   * @returns `true` si se aplicó; `false` si la jugada es ilegal
   */
  tryMove(from: string, to: string, promotion?: string): boolean {
    try {
      const move = promotion
        ? this.chess.move({ from, to, promotion })
        : this.chess.move({ from, to });
      return !!move;
    } catch {
      return false;
    }
  }

  /**
   * Compara la posición actual con la solución en la siguiente jugada del usuario.
   * Avanza `currentMoveNumber` en cualquier caso. Una jugada que da mate también cuenta como
   * correcta aunque no coincida con la solución, como en la versión anterior del componente.
   *
   * @returns `correct` si coincide con la solución o es mate; `wrong` en otro caso
   */
  evaluateUserMove(): PuzzleMoveVerdict {
    this.moveIndex++;
    const matchesSolution = this.chess.fen() === this.solutionFens[this.moveIndex];
    return matchesSolution || this.chess.isCheckmate() ? 'correct' : 'wrong';
  }

  /**
   * Avanza la solución a la siguiente jugada de la máquina. No cambia el estado de chess.js:
   * la UI llama a `loadCurrentSolutionFen()` después de su espera visual.
   *
   * @returns `true` si ya no quedan jugadas (puzzle resuelto); el índice no pasa del final.
   */
  advanceMachineMove(): boolean {
    this.moveIndex++;
    if (this.moveIndex === this.solutionFens.length) {
      this.moveIndex--;
      return true;
    }
    return false;
  }

  /**
   * Carga en chess.js la posición de la solución que corresponde a `currentMoveNumber`.
   *
   * @returns FEN de esa posición
   */
  loadCurrentSolutionFen(): string {
    this.chess.load(this.solutionFens[this.moveIndex]);
    return this.chess.fen();
  }

  /** Casillas de la última jugada de la máquina (la que llevó a la posición actual). */
  lastSolutionMove(): PuzzleMoveSquares {
    return PuzzleEngine.squaresOf(this.solutionMoveAt(this.moveIndex - 1));
  }

  /**
   * Casillas de la última jugada en el tablero. Si el historial de chess.js está vacío
   * (por ejemplo, tras cargar la posición), usa la última jugada de la solución.
   *
   * @returns `null` si no hay ninguna jugada que resaltar
   */
  lastMove(): PuzzleMoveSquares | null {
    const last = this.chess.history({ verbose: true }).slice(-1)[0];
    if (last) {
      return { from: last.from, to: last.to };
    }
    const fallback = this.solutionMoveAt(this.moveIndex - 1);
    return fallback ? PuzzleEngine.squaresOf(fallback) : null;
  }

  /**
   * Pista: casillas de la próxima jugada del usuario según la solución.
   *
   * @returns `null` si no hay jugada siguiente válida
   */
  hintSquares(): PuzzleMoveSquares | null {
    const next = this.solutionMoveAt(this.moveIndex);
    return next.length >= 4 ? PuzzleEngine.squaresOf(next) : null;
  }

  /** Indica si la última jugada en el historial fue un enroque (corto `k` o largo `q`). */
  lastMoveWasCastling(): boolean {
    const last = this.chess.history({ verbose: true }).slice(-1)[0];
    return !!last && (last.flags.includes('k') || last.flags.includes('q'));
  }
}
