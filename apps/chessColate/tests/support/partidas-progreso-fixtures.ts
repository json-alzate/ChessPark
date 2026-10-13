import { Puzzle, StreakRecord, StreakRun } from '@chesspark/models';

/** Puzzle mínimo válido; solo el uid y lo que se pase importa en las pruebas. */
export function makePuzzle(uid: string, overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    uid,
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'e2e4 e7e5',
    rating: 1500,
    ratingDeviation: 75,
    popularity: 90,
    randomNumberQuery: 0,
    nbPlays: 1000,
    themes: [],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...overrides,
  };
}

/** Récord de racha con valores por defecto "vacíos"; se sobreescribe lo que importe. */
export function makeStreakRecord(
  overrides: Partial<StreakRecord> = {}
): StreakRecord {
  return {
    bestScore: 0,
    bestRunUid: '',
    achievedAt: 0,
    runsPlayed: 0,
    lastScore: 0,
    lastPlayedAt: 0,
    ...overrides,
  };
}

/** Racha terminada. */
export function makeStreakRun(overrides: Partial<StreakRun> = {}): StreakRun {
  return {
    uid: 'run-1',
    startedAt: 1_000,
    finishedAt: 2_000,
    config: { eloBase: 800, step: 15, eloCap: 2800, theme: 'all', maxSkips: 1 },
    score: 5,
    skipsUsed: 0,
    endedBy: 'fail',
    puzzleUids: ['a', 'b', 'c'],
    maxEloReached: 900,
    ...overrides,
  };
}

/** PGN de una partida corta (mate del pastor) con cabeceras. */
export function makePgn(
  white: string,
  black: string,
  extraHeaders = '',
  moves = '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'
): string {
  return (
    `[Event "Torneo"]\n[White "${white}"]\n[Black "${black}"]\n` +
    `[Date "1999.01.02"]\n[Result "1-0"]\n${extraHeaders}\n${moves}\n`
  );
}
