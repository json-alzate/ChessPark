import { PlanTypes, Puzzle } from '@cpark/models';

import {
  RoutineKind,
  routineMetaFromPlanType,
} from '@services/analytics/analytics-events.util';
import { Reto333Summary } from '@services/training/reto333.util';
import { PuzzleResult } from '@services/training/user-puzzle.util';

/**
 * Parámetros de los eventos de analítica que emite la pantalla de
 * entrenamiento, uno por función. Cada función recibe los datos crudos de la
 * sesión y devuelve el objeto que va a GA4 con sus campos exactos, de modo
 * que el catálogo de campos de cada evento esté fijado aquí y en su spec, y
 * la pantalla solo decida en qué momento se emite.
 *
 * Son tipos de objeto (no interfaces) para que encajen en `AnalyticsParams`,
 * que es un índice de primitivos. Sin estado ni ciclo de vida.
 */

/** Parámetros de `puzzle_started`: se emite al poner un puzzle en el tablero. */
export type PuzzleStartedParams = {
  routine_kind: RoutineKind;
  routine_minutes: number;
  theme: string;
  puzzle_elo: number;
};

/** Lo que hace falta saber del momento en que se sirve un puzzle. */
export interface PuzzleStartedInput {
  planType: PlanTypes;
  /** Tema del bloque; vacío o ausente en la rutina infinita. */
  blockTheme?: string;
  puzzle: Puzzle;
}

/**
 * Describe el puzzle que empieza. El tema es el del bloque cuando lo hay (el
 * resto de rutinas filtra por él, así que describe al puzzle); la rutina
 * infinita no tiene tema de bloque y ahí se reporta el primero del puzzle
 * servido en vez de inventar uno.
 */
export function puzzleStartedPayload({
  planType,
  blockTheme,
  puzzle,
}: PuzzleStartedInput): PuzzleStartedParams {
  const meta = routineMetaFromPlanType(planType);
  return {
    routine_kind: meta.kind,
    routine_minutes: meta.minutes,
    theme: blockTheme || puzzle.themes?.[0] || '',
    puzzle_elo: puzzle.rating ?? 0,
  };
}

/** Parámetros de `puzzle_completed`: se emite al cerrarse un puzzle, con el resultado. */
export type PuzzleCompletedParams = {
  result: 'good' | 'bad' | 'timeout';
  puzzle_elo: number;
  user_elo: number;
  resolved_time: number;
  first_theme: string;
  routine_kind: RoutineKind;
  routine_minutes: number;
};

/** Lo que hace falta saber del cierre de un puzzle. */
export interface PuzzleCompletedInput {
  planType: PlanTypes;
  puzzle: Puzzle;
  result: PuzzleResult;
  /** Elo del perfil en ese momento; sin sesión no hay elo y se reporta 0. */
  userElo?: number;
}

/**
 * Describe cómo se cerró el puzzle. Quien llama decide con qué elo: la
 * pantalla lo emite antes de recalcularlo, así el evento cuenta el estado
 * previo al resultado. El resultado por tiempo se reporta como `timeout`,
 * que es el nombre que ya existe en el catálogo de GA4.
 */
export function puzzleCompletedPayload({
  planType,
  puzzle,
  result,
  userElo,
}: PuzzleCompletedInput): PuzzleCompletedParams {
  const meta = routineMetaFromPlanType(planType);
  return {
    result: result === 'timeOut' ? 'timeout' : result,
    puzzle_elo: puzzle.rating ?? 0,
    user_elo: userElo ?? 0,
    resolved_time: puzzle.timeUsed ?? 0,
    first_theme: puzzle.themes?.[0] ?? '',
    routine_kind: meta.kind,
    routine_minutes: meta.minutes,
  };
}

/** Parámetros de `reto333_finished`: se emite al terminar un intento del Reto 333. */
export type Reto333FinishedParams = {
  solved_count: number;
  time_seconds: number;
  elo: number;
  completed: boolean;
  best_score: number;
};

/** Lo que hace falta saber del intento recién terminado. */
export interface Reto333FinishedInput {
  summary: Reto333Summary;
  /** Elo que alcanzó la rampa en este intento. */
  elo: number;
  /** Mejor marca del dispositivo ya con este intento incluido. */
  bestScore: number;
}

/** Describe el intento terminado junto a la mejor marca para medir si fue récord. */
export function reto333FinishedPayload({
  summary,
  elo,
  bestScore,
}: Reto333FinishedInput): Reto333FinishedParams {
  return {
    solved_count: summary.score,
    time_seconds: summary.timeSeconds,
    elo,
    completed: summary.completed,
    best_score: bestScore,
  };
}
