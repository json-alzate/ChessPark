import { Puzzle } from '@chesspark/models';

import {
  WoodpeckerConfig,
  WoodpeckerCycle,
  WoodpeckerPuzzleResult,
  WoodpeckerSet,
} from '@features/woodpecker/models/woodpecker.model';

/**
 * Datos y dobles compartidos por las pruebas del Pájaro Carpintero.
 */

/** Generador pseudoaleatorio con semilla: pruebas repetibles sin `Math.random`. */
export function aleatorioConSemilla(semilla = 1): () => number {
  let estado = semilla;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

export function ejercicio(uid: string, extra: Partial<Puzzle> = {}): Puzzle {
  return {
    uid,
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    moves: 'e2e4',
    rating: 1500,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['fork'],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...extra,
  };
}

export function ejercicios(cantidad: number, prefijo = 'p'): Puzzle[] {
  return Array.from({ length: cantidad }, (_, i) => ejercicio(`${prefijo}${i + 1}`));
}

export function configuracion(extra: Partial<WoodpeckerConfig> = {}): WoodpeckerConfig {
  return {
    targetCount: 100,
    minCount: 70,
    eloMin: 1300,
    eloMax: 1700,
    themes: ['fork', 'pin'],
    cycles: 3,
    order: 'shuffle',
    timing: 'decreasing',
    baseTimePerPuzzleSec: 60,
    decreasePercent: 20,
    ...extra,
  };
}

export function conjunto(
  puzzles: Puzzle[],
  extra: Partial<WoodpeckerSet> = {}
): WoodpeckerSet {
  return {
    id: 'set-1',
    source: 'catalog',
    createdAt: 1_000,
    config: configuracion({ targetCount: puzzles.length }),
    puzzles,
    ...extra,
  };
}

export function resultado(
  uidPuzzle: string,
  resolved: boolean,
  timeMs = 5_000,
  failByTime = false
): WoodpeckerPuzzleResult {
  return { uidPuzzle, resolved, failByTime, timeMs };
}

export function vuelta(
  cycle: number,
  order: string[],
  results: WoodpeckerPuzzleResult[] = [],
  extra: Partial<WoodpeckerCycle> = {}
): WoodpeckerCycle {
  return { cycle, order, startedAt: 1_000 * cycle, results, ...extra };
}
