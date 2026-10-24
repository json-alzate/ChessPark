import { WoodpeckerPace, WoodpeckerTiming } from '../models/woodpecker.model';

/**
 * Límites y valores por defecto del Pájaro Carpintero.
 *
 * Los tamaños salen de lo que pide el método (decenas a cientos de ejercicios)
 * y de lo que cabe sin problema en el dispositivo: 500 ejercicios pesan unos
 * 250 KB guardados.
 */

/** Tamaños de set que se ofrecen. */
export const WOODPECKER_SIZES = [50, 100, 200, 300, 500] as const;
export const WOODPECKER_DEFAULT_SIZE = 100;

/** Con menos de esta fracción del tamaño pedido el set no se acepta. */
export const WOODPECKER_MIN_FILL_RATIO = 0.7;

export const WOODPECKER_CYCLES = { min: 2, max: 12, default: 5 } as const;

/**
 * Rango de ELO. Los archivos del catálogo se agrupan de 20 en 20, así que el
 * rango se elige de 100 en 100 y debe abarcar al menos 200 puntos para que
 * haya de dónde sacar variedad.
 */
export const WOODPECKER_ELO = {
  min: 400,
  max: 2800,
  step: 100,
  minSpan: 200,
  /** Ventana por defecto alrededor del ELO del usuario. */
  defaultWindow: 200,
} as const;

/** Lo que suele tardar un ejercicio, para estimar cuánto lleva una vuelta. */
export const WOODPECKER_SECONDS_PER_PUZZLE_ESTIMATE = 25;

/** Con «todos los temas» se sortean tantos para no bajar decenas de archivos. */
export const WOODPECKER_MAX_RANDOM_THEMES = 10;

/** Ningún ejercicio baja de estos segundos por mucho que descienda el tiempo. */
export const WOODPECKER_MIN_TIME_SEC = 10;

/**
 * Tope de tiempo registrado por ejercicio. Si el usuario deja la app abierta
 * y se va, esos minutos no son «lo que tardó»: se corta para no arruinar la
 * comparación entre vueltas.
 */
export const WOODPECKER_MAX_RECORDED_MS = 5 * 60 * 1000;

/** Cuántas vueltas tiene que fallar un ejercicio para señalarlo como problemático. */
export const WOODPECKER_PROBLEM_MIN_FAILURES = 2;

export interface WoodpeckerPaceSpec {
  timing: WoodpeckerTiming;
  /** Segundos por ejercicio en la vuelta 1. */
  baseTimePerPuzzleSec: number;
  /** Cuánto baja en cada vuelta, en %. */
  decreasePercent: number;
}

/** Ritmos de la pantalla de configuración. */
export const WOODPECKER_PACES: Record<WoodpeckerPace, WoodpeckerPaceSpec> = {
  relaxed: { timing: 'none', baseTimePerPuzzleSec: 0, decreasePercent: 0 },
  standard: { timing: 'decreasing', baseTimePerPuzzleSec: 60, decreasePercent: 20 },
  intense: { timing: 'decreasing', baseTimePerPuzzleSec: 30, decreasePercent: 20 },
};

export const WOODPECKER_DEFAULT_PACE: WoodpeckerPace = 'standard';
