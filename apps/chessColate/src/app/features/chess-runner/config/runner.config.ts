import { RunnerHint, RunnerPieceKind } from '../models/runner.model';

/**
 * Física y medidas del Chess Runner, en píxeles lógicos y segundos. Salen de una tabla porque cada
 * número fija lo difícil que es cada pieza: se afinaron con las pruebas de ventanas de
 * `tests/unit/features/chess-runner/utils/runner-engine.util.spec.ts`, que comprueban que cada
 * mecánica deja un margen de tiempo razonable para acertar y que la equivocada falla.
 */
export const RUNNER_PHYSICS = {
  gravity: 900,
  /** Velocidad a la que pasa el suelo. */
  speed: 130,
  /** Salto normal: sube unos 52 px. */
  jumpVelocity: 306,
  /** Segundo impulso del doble salto, ya en el aire. */
  doubleJumpVelocity: 280,
  /** Cuánto puede quedarse flotando quien mantiene pulsado en la cima. */
  hoverMax: 0.35,
  /** El suelo pasa así de rápido más durante un salto largo. */
  longJumpBoost: 1.9,
  slideTime: 0.6,
  /** Caída rápida si se pide agacharse en el aire. */
  diveVelocity: 420,
  /** Tiempo que dura el tropiezo y la invulnerabilidad que da. */
  stumbleTime: 0.9,
  /** Velocidad de Chocolate cuando corre hacia el tablero al final. */
  finishSpeed: 170,
  /** Centro horizontal de Chocolate corriendo. */
  dogX: 42,
  /** Una orden pulsada así de pronto antes de aterrizar se ejecuta al tocar el suelo. */
  inputBuffer: 0.12,
} as const;

/** Lo que de Chocolate puede chocar, dentro de su celda de 52×40 (más pequeño que el dibujo: es indulgente). */
export const DOG_BOX = {
  /** Desplazamiento del borde izquierdo respecto al centro del sprite. */
  dx: -9,
  width: 24,
  height: 26,
  slideHeight: 11,
} as const;

export interface ObstacleShape {
  /** Ancho que puede chocar. */
  width: number;
  /** Altura a la que empieza (una torre «flota»: hay que pasar por debajo). */
  bottom: number;
  /** Alto que puede chocar. */
  height: number;
  /** Cuánto distancia pedir antes de este obstáculo, para tener tiempo de prepararse y aterrizar. */
  gapBefore: number;
  /** Qué hay que hacer para pasarlo. */
  hint: RunnerHint;
}

/**
 * Cada pieza pide algo distinto:
 *  - peón: un salto.
 *  - torre: flota; hay que agacharse.
 *  - alfil: tres seguidos, demasiado anchos para un salto normal; salto largo.
 *  - caballo: alto y ancho; salto y mantener pulsado para quedarse en el aire.
 *  - dama: más alta que un salto; doble salto.
 *  - rey: alto y estrecho; un salto, pero en el momento justo.
 */
export const OBSTACLE_SHAPES: Record<RunnerPieceKind, ObstacleShape> = {
  pawn: { width: 10, bottom: 0, height: 18, gapBefore: 150, hint: 'jump' },
  rook: { width: 20, bottom: 20, height: 30, gapBefore: 150, hint: 'slide' },
  bishop: { width: 46, bottom: 0, height: 22, gapBefore: 190, hint: 'long' },
  knight: { width: 24, bottom: 0, height: 36, gapBefore: 190, hint: 'hold' },
  queen: { width: 12, bottom: 0, height: 58, gapBefore: 190, hint: 'double' },
  king: { width: 8, bottom: 0, height: 36, gapBefore: 170, hint: 'precise' },
};

/** Alto del lienzo lógico: cabe el doble salto de la dama (unos 95 px) sobre el suelo. */
export const RUNNER_CANVAS_HEIGHT = 176;

/** Antes del primer obstáculo, para que dé tiempo a ver la pantalla. */
export const FIRST_GAP = 120;

/** Obstáculos como máximo en una carrera: más cansa antes de resolver el ejercicio. */
export const MAX_OBSTACLES = 8;
/** Copias como máximo de una misma pieza. */
export const MAX_PER_KIND = 2;

/** Ventana de tiempo para decidir un toque frente a un deslizamiento (ms). */
export const GESTURE_DECISION_MS = 55;
/** Píxeles de arrastre a partir de los cuales un gesto es deslizar y no tocar. */
export const GESTURE_SWIPE_PX = 16;
/** Un dedo que se ha movido más de esto ya no está quieto: puede que vaya a deslizar. */
export const GESTURE_SLOP_PX = 5;
/** Tope de espera con el dedo en movimiento antes de darlo por un toque (ms). */
export const GESTURE_MAX_WAIT_MS = 180;
