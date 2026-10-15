/**
 * Comprobaciones de forma para lo que se lee del dispositivo. El
 * `localStorage` lo puede tocar cualquiera (o quedar a medias si falla una
 * escritura): lo que no cuadre se descarta en vez de romper la pantalla.
 */

import { WoodpeckerCycle, WoodpeckerProgress, WoodpeckerPuzzleResult, WoodpeckerSet } from '../models/woodpecker.model';
import { isWoodpeckerConfig } from './woodpecker-config.util';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isResult(value: unknown): value is WoodpeckerPuzzleResult {
  return (
    isObject(value) &&
    typeof value['uidPuzzle'] === 'string' &&
    typeof value['resolved'] === 'boolean' &&
    typeof value['failByTime'] === 'boolean' &&
    typeof value['timeMs'] === 'number'
  );
}

function isCycle(value: unknown): value is WoodpeckerCycle {
  return (
    isObject(value) &&
    typeof value['cycle'] === 'number' &&
    typeof value['startedAt'] === 'number' &&
    (value['finishedAt'] === undefined || typeof value['finishedAt'] === 'number') &&
    Array.isArray(value['order']) &&
    value['order'].every((uid) => typeof uid === 'string') &&
    Array.isArray(value['results']) &&
    value['results'].every(isResult)
  );
}

/** ¿Es un set completo y jugable? Exige al menos un ejercicio con tablero. */
export function isWoodpeckerSet(value: unknown): value is WoodpeckerSet {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    value['source'] === 'catalog' &&
    typeof value['createdAt'] === 'number' &&
    isWoodpeckerConfig(value['config']) &&
    Array.isArray(value['puzzles']) &&
    value['puzzles'].length > 0 &&
    value['puzzles'].every(
      (puzzle) =>
        isObject(puzzle) &&
        typeof puzzle['uid'] === 'string' &&
        typeof puzzle['fen'] === 'string' &&
        typeof puzzle['moves'] === 'string'
    )
  );
}

export function isWoodpeckerProgress(value: unknown): value is WoodpeckerProgress {
  return (
    isObject(value) &&
    typeof value['setId'] === 'string' &&
    (value['completedAt'] === undefined || typeof value['completedAt'] === 'number') &&
    Array.isArray(value['cycles']) &&
    value['cycles'].every(isCycle)
  );
}
