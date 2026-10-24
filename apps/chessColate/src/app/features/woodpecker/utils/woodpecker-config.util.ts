/**
 * Armado y validación de la configuración del Pájaro Carpintero. Funciones
 * puras: no leen el catálogo ni el dispositivo.
 */

import { Puzzle } from '@chesspark/models';

import {
  WOODPECKER_CYCLES,
  WOODPECKER_ELO,
  WOODPECKER_MAX_RANDOM_THEMES,
  WOODPECKER_MIN_FILL_RATIO,
  WOODPECKER_PACES,
  WOODPECKER_SECONDS_PER_PUZZLE_ESTIMATE,
} from '../config/woodpecker.config';
import {
  WoodpeckerConfig,
  WoodpeckerOrder,
  WoodpeckerPace,
} from '../models/woodpecker.model';

/** Lo que el usuario deja elegido en la pantalla de configuración. */
export interface WoodpeckerSetupInput {
  size: number;
  eloMin: number;
  eloMax: number;
  /** Temas elegidos, o `'all'` para una mezcla variada. */
  themes: string[] | 'all';
  cycles: number;
  order: WoodpeckerOrder;
  pace: WoodpeckerPace;
}

/** Lo que se deja elegido al armar el set con un PGN propio: los ejercicios ya vienen del archivo. */
export interface WoodpeckerPgnSetupInput {
  /** Nombre del archivo (vacío si se pegó el texto). */
  name: string;
  puzzles: Puzzle[];
  cycles: number;
  order: WoodpeckerOrder;
  pace: WoodpeckerPace;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mínimo de ejercicios con el que se acepta un set de ese tamaño. */
export function minCountFor(targetCount: number): number {
  return Math.ceil(targetCount * WOODPECKER_MIN_FILL_RATIO);
}

/**
 * Cuánto lleva una vuelta de un set de ese tamaño, en minutos y de 5 en 5.
 * Es una estimación para avisar de que un set grande es un compromiso: se
 * cuentan unos 25 segundos por ejercicio.
 */
export function estimateCycleMinutes(size: number): number {
  const minutes = (size * WOODPECKER_SECONDS_PER_PUZZLE_ESTIMATE) / 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function clampCycles(cycles: number): number {
  return clamp(Math.round(cycles), WOODPECKER_CYCLES.min, WOODPECKER_CYCLES.max);
}

/**
 * Deja el rango de ELO dentro del catálogo, en pasos de 100 y con la anchura
 * mínima. Si hay que ajustar, se respeta `eloMin` y se mueve `eloMax`; solo si
 * no cabe por arriba se baja `eloMin`.
 */
export function normalizeEloRange(
  eloMin: number,
  eloMax: number
): { eloMin: number; eloMax: number } {
  const { min, max, step, minSpan } = WOODPECKER_ELO;
  const snap = (value: number) => Math.round(value / step) * step;

  let low = clamp(snap(Math.min(eloMin, eloMax)), min, max - minSpan);
  let high = clamp(snap(Math.max(eloMin, eloMax)), min + minSpan, max);

  if (high - low < minSpan) {
    high = low + minSpan;
    if (high > max) {
      high = max;
      low = max - minSpan;
    }
  }
  return { eloMin: low, eloMax: high };
}

/**
 * Mueve un extremo del rango sin que choque con el otro: el que no se toca se
 * desplaza lo justo para mantener la anchura mínima. Es lo que pasa al arrastrar
 * los dos deslizadores de la pantalla.
 */
export function adjustEloRange(
  range: { eloMin: number; eloMax: number },
  moved: 'min' | 'max',
  value: number
): { eloMin: number; eloMax: number } {
  const { min, max, step, minSpan } = WOODPECKER_ELO;
  const snapped = Math.round(value / step) * step;

  if (moved === 'min') {
    const eloMin = clamp(snapped, min, max - minSpan);
    return { eloMin, eloMax: Math.max(range.eloMax, eloMin + minSpan) };
  }
  const eloMax = clamp(snapped, min + minSpan, max);
  return { eloMin: Math.min(range.eloMin, eloMax - minSpan), eloMax };
}

/** Rango por defecto: una ventana alrededor del ELO del usuario. */
export function defaultEloRange(userElo: number): { eloMin: number; eloMax: number } {
  const { defaultWindow } = WOODPECKER_ELO;
  return normalizeEloRange(userElo - defaultWindow, userElo + defaultWindow);
}

/**
 * Temas concretos del set. Con una lista, se respetan los que existen en el
 * catálogo (y su orden). Con `'all'` se sortea una mezcla de hasta
 * `WOODPECKER_MAX_RANDOM_THEMES`, porque pedir los ~40 temas obligaría a bajar
 * decenas de archivos de cientos de KB.
 */
export function resolveThemes(
  selected: string[] | 'all',
  available: string[],
  random: () => number = Math.random
): string[] {
  if (selected !== 'all') {
    return selected.filter((theme) => available.includes(theme));
  }

  const pool = [...available];
  // Fisher-Yates, para que el sorteo no dependa del orden del catálogo
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, WOODPECKER_MAX_RANDOM_THEMES);
}

/** Convierte lo elegido en pantalla en la configuración que se guarda con el set. */
export function buildWoodpeckerConfig(
  input: WoodpeckerSetupInput,
  availableThemes: string[],
  random: () => number = Math.random
): WoodpeckerConfig {
  const { eloMin, eloMax } = normalizeEloRange(input.eloMin, input.eloMax);
  const pace = WOODPECKER_PACES[input.pace];

  return {
    targetCount: input.size,
    minCount: minCountFor(input.size),
    eloMin,
    eloMax,
    themes: resolveThemes(input.themes, availableThemes, random),
    cycles: clampCycles(input.cycles),
    order: input.order,
    timing: pace.timing,
    baseTimePerPuzzleSec: pace.baseTimePerPuzzleSec,
    decreasePercent: pace.decreasePercent,
  };
}

/**
 * Configuración de un set armado con un PGN propio. No hay filtros que
 * aplicar: se usa el archivo entero, así que pedido y mínimo coinciden y el
 * rango de ELO y los temas son un resumen de lo que trae.
 */
export function buildPgnWoodpeckerConfig(input: WoodpeckerPgnSetupInput): WoodpeckerConfig {
  const pace = WOODPECKER_PACES[input.pace];
  const ratings = input.puzzles.map((puzzle) => puzzle.rating);
  const { step } = WOODPECKER_ELO;

  const { eloMin, eloMax } = normalizeEloRange(
    Math.floor(Math.min(...ratings) / step) * step,
    Math.ceil((Math.max(...ratings) + 1) / step) * step
  );

  // Los temas más frecuentes primero, para que los chips del panel digan de qué va el set
  const counts = new Map<string, number>();
  for (const puzzle of input.puzzles) {
    for (const theme of puzzle.themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  const themes = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([theme]) => theme);

  return {
    targetCount: input.puzzles.length,
    minCount: input.puzzles.length,
    eloMin,
    eloMax,
    themes,
    cycles: clampCycles(input.cycles),
    order: input.order,
    timing: pace.timing,
    baseTimePerPuzzleSec: pace.baseTimePerPuzzleSec,
    decreasePercent: pace.decreasePercent,
  };
}

/** ¿Lo guardado tiene la forma de una configuración? Para descartar datos corruptos. */
export function isWoodpeckerConfig(value: unknown): value is WoodpeckerConfig {
  const config = value as Partial<WoodpeckerConfig> | null;
  return (
    !!config &&
    typeof config === 'object' &&
    typeof config.targetCount === 'number' &&
    typeof config.minCount === 'number' &&
    typeof config.eloMin === 'number' &&
    typeof config.eloMax === 'number' &&
    Array.isArray(config.themes) &&
    typeof config.cycles === 'number' &&
    config.cycles >= 1 &&
    (config.order === 'same' || config.order === 'shuffle' || config.order === 'reverse') &&
    (config.timing === 'none' || config.timing === 'decreasing') &&
    typeof config.baseTimePerPuzzleSec === 'number' &&
    typeof config.decreasePercent === 'number'
  );
}
