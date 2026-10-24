import { Puzzle } from '@chesspark/models';

/**
 * Método del Pájaro Carpintero: un set fijo de ejercicios que se repite en
 * varias vueltas, cada una más rápida. Lo importante es repetir el MISMO
 * material, por eso el set se congela al crearlo y nunca se vuelve a pedir
 * al catálogo.
 *
 * Los tipos son exclusivos de esta funcionalidad: no los comparte ninguna otra.
 */

/** Orden de los ejercicios en las vueltas posteriores a la primera. */
export type WoodpeckerOrder = 'same' | 'shuffle' | 'reverse';

/** Cómo cambia el tiempo por ejercicio a lo largo de las vueltas. */
export type WoodpeckerTiming = 'none' | 'decreasing';

/**
 * De dónde sale el set: del catálogo de ejercicios de la app o de un PGN
 * propio del usuario (F07). Lo guardado antes de `'pgn'` no se migra: ya era
 * `'catalog'`.
 */
export type WoodpeckerSource = 'catalog' | 'pgn';

/** Ritmos que ofrece la pantalla: cada uno fija el tiempo de arranque y su descenso. */
export type WoodpeckerPace = 'relaxed' | 'standard' | 'intense';

/** Lo que el usuario elige antes de armar el set. */
export interface WoodpeckerConfig {
  /** Ejercicios que se quieren en el set. */
  targetCount: number;
  /** Mínimo con el que se acepta el set si el catálogo no da para más. */
  minCount: number;
  /** Rango de ELO de los ejercicios: [eloMin, eloMax). */
  eloMin: number;
  eloMax: number;
  /** Temas concretos del set. Si el usuario eligió «todos», aquí van los sorteados. */
  themes: string[];
  /** Cuántas veces se repite el set completo. */
  cycles: number;
  order: WoodpeckerOrder;
  timing: WoodpeckerTiming;
  /** Segundos por ejercicio en la vuelta 1 (solo si `timing` no es `none`). */
  baseTimePerPuzzleSec: number;
  /** Cuánto baja el tiempo en cada vuelta, en % (solo si `timing` es `decreasing`). */
  decreasePercent: number;
}

/** El set congelado: se guarda entero para jugar sin conexión y sin que cambie. */
export interface WoodpeckerSet {
  id: string;
  source: WoodpeckerSource;
  createdAt: number;
  /** Solo en `'pgn'`: el nombre del archivo del que salió (vacío si se pegó el texto). */
  sourceName?: string;
  /** Los filtros con los que se armó, por trazabilidad. */
  config: WoodpeckerConfig;
  /** Orden canónico del set (el de la vuelta 1). */
  puzzles: Puzzle[];
}

/** Cómo salió un ejercicio dentro de una vuelta. */
export interface WoodpeckerPuzzleResult {
  uidPuzzle: string;
  resolved: boolean;
  /** Se acabó el tiempo antes de resolverlo (cuenta como fallo). */
  failByTime: boolean;
  /** Lo que tardó en resolverlo o en fallar, en milisegundos. */
  timeMs: number;
}

export interface WoodpeckerCycle {
  /** Número de vuelta, desde 1. */
  cycle: number;
  /** Orden real de los uids en esta vuelta. */
  order: string[];
  startedAt: number;
  /** Vacío mientras la vuelta sigue en curso. */
  finishedAt?: number;
  /** Resultados en el orden jugado: `results.length` es el ejercicio por el que va. */
  results: WoodpeckerPuzzleResult[];
}

/** Dónde va el usuario con su set. Es reanudable: no hay nada más que guardar. */
export interface WoodpeckerProgress {
  setId: string;
  cycles: WoodpeckerCycle[];
  /** Cuándo terminó la última vuelta. Vacío mientras quedan vueltas. */
  completedAt?: number;
}

/** El set junto con su progreso. */
export interface WoodpeckerState {
  set: WoodpeckerSet;
  progress: WoodpeckerProgress;
}

/** Resumen de una vuelta, para las pantallas de resultado. */
export interface WoodpeckerCycleSummary {
  cycle: number;
  /** Ejercicios del set. */
  total: number;
  /** Ejercicios ya jugados en la vuelta. */
  answered: number;
  solved: number;
  /** Incluye los que fallaron por tiempo. */
  failed: number;
  failedByTime: number;
  /** % de acierto sobre lo jugado (0 si no se jugó nada). */
  accuracy: number;
  totalTimeMs: number;
  /** Tiempo medio por ejercicio jugado. */
  avgTimeMs: number;
  finished: boolean;
}

/** Cuánto cambió una vuelta respecto a la anterior. */
export interface WoodpeckerCycleComparison {
  /** Puntos porcentuales de acierto ganados (negativo si empeoró). */
  accuracyDelta: number;
  /** Variación del tiempo total en %: negativo = más rápido. `null` si no hay base. */
  timeDeltaPercent: number | null;
}

/** Un ejercicio que se falla vuelta tras vuelta. */
export interface WoodpeckerProblemPuzzle {
  uidPuzzle: string;
  /** En cuántas vueltas terminadas se falló. */
  failures: number;
}
