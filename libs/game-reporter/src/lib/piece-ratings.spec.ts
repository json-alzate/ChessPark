import {
  classifyMove,
  engineEvalForWhite,
  moveAccuracy,
  PositionEval,
  ratingFromAccuracies,
  reviewGame,
  terminalEval,
  winChance,
} from './piece-ratings';

/** Una evaluación igualada, para rellenar posiciones que no importan. */
const EVEN: PositionEval = { cp: 0 };

describe('winChance', () => {
  it('con la posición igualada, cada uno tiene la mitad', () => {
    expect(winChance({ cp: 0 })).toBeCloseTo(50);
  });

  it('es simétrica: la ventaja de uno es la desventaja del otro', () => {
    expect(winChance({ cp: 300 }) + winChance({ cp: -300 })).toBeCloseTo(100);
    expect(winChance({ cp: 300 })).toBeGreaterThan(50);
  });

  it('un mate a la vista es la partida ganada o perdida', () => {
    expect(winChance({ mate: 3 })).toBe(100);
    expect(winChance({ mate: -2 })).toBe(0);
  });

  it('por encima de diez peones ya no cambia nada', () => {
    expect(winChance({ cp: 5000 })).toBeCloseTo(winChance({ cp: 1000 }));
  });
});

describe('engineEvalForWhite', () => {
  const WHITE_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
  const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

  it('con blancas al turno deja la puntuación como está', () => {
    expect(engineEvalForWhite(WHITE_TO_MOVE, 50)).toEqual({ cp: 50 });
  });

  it('con negras al turno le da la vuelta', () => {
    expect(engineEvalForWhite(BLACK_TO_MOVE, 50)).toEqual({ cp: -50 });
    expect(engineEvalForWhite(BLACK_TO_MOVE, 0, 2)).toEqual({ mate: -2 });
  });

  it('"mate 0" es que quien mueve ya está mateado', () => {
    expect(engineEvalForWhite(WHITE_TO_MOVE, 0, 0)).toEqual({ mate: -1 });
    expect(engineEvalForWhite(BLACK_TO_MOVE, 0, 0)).toEqual({ mate: 1 });
  });
});

describe('terminalEval', () => {
  it('en un mate gana quien no está al turno', () => {
    // Mate del loco: 1. f3 e5 2. g4 Dh4#
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(terminalEval(fen)).toEqual({ mate: -1 });
  });

  it('el ahogado vale tablas', () => {
    expect(terminalEval('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({ cp: 0 });
  });

  it('si la partida sigue no dice nada', () => {
    expect(
      terminalEval('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    ).toBeNull();
  });
});

describe('moveAccuracy y classifyMove', () => {
  it('no perder nada es precisión completa', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
  });

  it('cuanto más se pierde, menos precisión', () => {
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
    expect(moveAccuracy(100)).toBeGreaterThanOrEqual(0);
  });

  it('clasifica con los cortes de lichess', () => {
    expect(classifyMove(1)).toBe('excellent');
    expect(classifyMove(3)).toBe('good');
    expect(classifyMove(7)).toBe('inaccuracy');
    expect(classifyMove(12)).toBe('mistake');
    expect(classifyMove(20)).toBe('blunder');
  });
});

describe('ratingFromAccuracies', () => {
  it('sin jugadas no hay nota', () => {
    expect(ratingFromAccuracies([])).toBeNull();
  });

  it('todo perfecto es un diez', () => {
    expect(ratingFromAccuracies([100, 100])).toBe(10);
  });

  it('una mala jugada hunde la nota más que en una media normal', () => {
    const accuracies = [100, 100, 100, 20];
    const plainMean = 1 + (9 * 80) / 100;
    expect(ratingFromAccuracies(accuracies) as number).toBeLessThan(plainMean);
  });
});

describe('reviewGame', () => {
  it('valora cada jugada y la apunta a la pieza que la hizo', () => {
    // El caballo blanco sale y vuelve atrás tirando tres peones de ventaja
    const evals: PositionEval[] = [EVEN, EVEN, EVEN, { cp: -300 }];
    const review = reviewGame('1. Nf3 Nf6 2. Ng1 *', evals);

    expect(review?.moves.map((move) => move.classification)).toEqual([
      'excellent',
      'excellent',
      'blunder',
    ]);

    const whiteKnight = review?.pieces.find((piece) => piece.id === 'w-g1');
    const blackKnight = review?.pieces.find((piece) => piece.id === 'b-g8');
    const blunder = review?.moves[2];

    expect(whiteKnight?.moves).toBe(2);
    expect(whiteKnight?.counts.blunder).toBe(1);
    expect(whiteKnight?.rating).toBe(
      ratingFromAccuracies([moveAccuracy(0), blunder?.accuracy ?? 0])
    );
    expect(blackKnight?.rating).toBe(10);
  });

  it('las negras se valoran desde su lado', () => {
    // Tras la jugada de negras la evaluación sube para las blancas: error de negras
    const evals: PositionEval[] = [EVEN, EVEN, { cp: 400 }];
    const review = reviewGame('1. e4 f6 *', evals);

    expect(review?.moves[1].color).toBe('b');
    expect(review?.moves[1].classification).toBe('blunder');
  });

  it('elige la mejor pieza de cada color entre las que jugaron', () => {
    const evals: PositionEval[] = [EVEN, EVEN, EVEN, { cp: -300 }];
    const review = reviewGame('1. Nf3 Nf6 2. Ng1 *', evals);

    expect(review?.best.b?.id).toBe('b-g8');
    expect(review?.best.w?.id).toBe('w-g1');
    // Una sola pieza blanca con nota: no puede ser a la vez la mejor y la peor
    expect(review?.worst.w).toBeNull();
  });

  it('sin la evaluación de una posición no valora las jugadas que la tocan', () => {
    const evals: Array<PositionEval | null> = [EVEN, null, EVEN, EVEN];
    const review = reviewGame('1. Nf3 Nf6 2. Ng1 *', evals);

    expect(review?.moves.map((move) => move.ply)).toEqual([3]);
  });

  it('en el enroque valora al rey y a la torre', () => {
    const evals = new Array<PositionEval>(8).fill(EVEN);
    const review = reviewGame('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O *', evals);

    expect(review?.pieces.find((piece) => piece.id === 'w-e1')?.moves).toBe(1);
    expect(review?.pieces.find((piece) => piece.id === 'w-h1')?.moves).toBe(1);
  });

  it('las piezas que no se movieron se quedan sin nota', () => {
    const review = reviewGame('1. e4 e5 *', [EVEN, EVEN, EVEN]);
    const queen = review?.pieces.find((piece) => piece.id === 'w-d1');

    expect(queen?.rating).toBeNull();
    expect(queen?.moves).toBe(0);
  });

  it('devuelve null si el PGN no se deja leer', () => {
    expect(reviewGame('1. e5 e4 *', [EVEN])).toBeNull();
  });
});
