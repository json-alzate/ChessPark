import { RunnerPieceKind } from '../models/runner.model';

/**
 * Física y medidas del Chess Runner, en píxeles lógicos y segundos. Hay un solo control, como en el
 * dinosaurio de Chrome: saltar. Las piezas se distinguen por su tamaño, y cada número fija lo difícil
 * que es cada una: se afinaron con las pruebas de ventanas de
 * `tests/unit/features/chess-runner/utils/runner-engine.util.spec.ts`, que comprueban que todas se pueden
 * pasar con un salto y cuánto margen de tiempo deja cada una.
 *
 * La velocidad y el ritmo no son fijos: dependen del nivel (ver `difficultyForLevel`).
 */
export const RUNNER_PHYSICS = {
  gravity: 900,
  /** Velocidad a la que pasa el suelo en el nivel 1; los niveles siguientes la suben. */
  speed: 120,
  /** El salto: sube unos 47 px y dura ~0,64 s. */
  jumpVelocity: 290,
  /** El segundo salto, en el aire: añade unos 35 px más a la cima. */
  doubleJumpVelocity: 250,
  /** Tiempo que dura el tropiezo y la invulnerabilidad que da. */
  stumbleTime: 0.9,
  /** Velocidad de Chocolate cuando corre hacia el tablero al final. */
  finishSpeed: 170,
  /** Centro horizontal de Chocolate corriendo. */
  dogX: 42,
  /** Un toque así de pronto antes de aterrizar se ejecuta al tocar el suelo. */
  inputBuffer: 0.12,
} as const;

/** Lo que de Chocolate puede chocar, dentro de su celda de 52×40 (más pequeño que el dibujo: es indulgente). */
export const DOG_BOX = {
  /** Desplazamiento del borde izquierdo respecto al centro del sprite. */
  dx: -8,
  width: 20,
  height: 26,
} as const;

export interface ObstacleShape {
  /** Ancho que puede chocar. */
  width: number;
  /** Alto que puede chocar. Todas las piezas están en el suelo y se pasan con un salto. */
  height: number;
}

/**
 * El tamaño de cada pieza: el peón es bajito y estrecho, el rey el más alto. Es lo que choca, algo menor
 * que el dibujo (las piezas son las del set que el usuario eligió para el tablero). Todas se pasan con
 * un salto; las más grandes dejan menos margen para acertar.
 */
export const OBSTACLE_SHAPES: Record<RunnerPieceKind, ObstacleShape> = {
  pawn: { width: 8, height: 11 },
  rook: { width: 10, height: 15 },
  bishop: { width: 10, height: 15 },
  knight: { width: 12, height: 18 },
  queen: { width: 10, height: 21 },
  king: { width: 10, height: 23 },
};

/**
 * Cómo se mueve cada pieza. Todas llegan a Chocolate a la hora prevista (la de una pieza quieta): lo que
 * cambia es lo que se ve venir, no cuándo hay que saltar.
 * - `slide`: multiplica lo rápido que se acerca (la torre se desliza y aparece de golpe).
 * - `lunge`: píxeles que avanza de un salto en L poco antes de llegar (el caballo y la dama).
 * - `lift`: lo que flota sobre el suelo (el alfil vuela bajo y pide el salto alto).
 */
export const PIECE_BEHAVIOR: Record<
  RunnerPieceKind,
  { slide: number; lunge: number; lift: number }
> = {
  pawn: { slide: 1, lunge: 0, lift: 0 },
  rook: { slide: 1.5, lunge: 0, lift: 0 },
  bishop: { slide: 1, lunge: 0, lift: 8 },
  knight: { slide: 1, lunge: 28, lift: 0 },
  queen: { slide: 1.3, lunge: 22, lift: 0 },
  king: { slide: 1, lunge: 0, lift: 0 },
};

/** Las que se deslizan no forman falange: pasan tan rápido que no obligarían al doble salto. */
export const WALL_KINDS: readonly RunnerPieceKind[] = ['pawn', 'bishop', 'knight', 'king'];

/** El salto en L: empieza a este tiempo de llegar (s), dura `LUNGE_TIME` y se eleva `LUNGE_HOP` px. */
export const LUNGE_START = 0.95;
export const LUNGE_TIME = 0.3;
export const LUNGE_HOP = 14;

/** Piezas de una falange: tres seguidas, tan separadas que un solo salto no las salva. */
export const WALL_COUNT = 3;
export const WALL_MIN_SPACING = 22;

/** Lado, en píxeles lógicos, del cuadro con que se dibuja cada pieza del set elegido: menor que Chocolate, que mide 40 de alto. */
export const PIECE_DRAW_SIZE = 30;

/** Píxeles lógicos de carrera por metro que ve el jugador: la distancia es el récord, como en el dinosaurio de Chrome. */
export const PX_PER_METER = 8;

/** Alto del lienzo lógico: cabe el salto (unos 47 px) con holgura sobre el suelo. */
export const RUNNER_CANVAS_HEIGHT = 176;

/** Antes del primer obstáculo, para que dé tiempo a ver la pantalla y entender el control. */
export const FIRST_GAP = 170;

/** Obstáculos como máximo en una carrera: más cansa antes de resolver el ejercicio. */
export const MAX_OBSTACLES = 8;
/** Copias como máximo de una misma pieza. */
export const MAX_PER_KIND = 2;

/** Nivel a partir del cual el juego ya no se acelera más. */
export const MAX_LEVEL = 10;

/**
 * Lo difícil que es una carrera. Sube con el nivel (un ejercicio resuelto = un nivel más) y también
 * dentro de la carrera: el suelo arranca en `startSpeed` y llega a `endSpeed` con la última pieza.
 * El ritmo no es un metrónomo: cada pieza lleva su propio hueco entre `minGapTime` y `maxGapTime`.
 */
export interface RunnerDifficulty {
  level: number;
  /** Velocidad del suelo (px/s) al empezar la carrera. */
  startSpeed: number;
  /** Velocidad del suelo con la última pieza. */
  endSpeed: number;
  /** Menor hueco entre piezas, en segundos de carrera (aterrizar y volver a saltar). */
  minGapTime: number;
  /** Mayor hueco entre piezas, en segundos de carrera. */
  maxGapTime: number;
}

export function difficultyForLevel(level: number): RunnerDifficulty {
  const capped = Math.min(Math.max(Math.floor(level) || 1, 1), MAX_LEVEL);
  const step = capped - 1;
  const startSpeed = RUNNER_PHYSICS.speed + 6 * step;
  return {
    level: capped,
    startSpeed,
    endSpeed: startSpeed + 22 + 3 * step,
    minGapTime: 1.1 - 0.03 * step,
    maxGapTime: 1.4 - 0.028 * step,
  };
}

/** Galleta de ChessColate: lado de su caja y alturas a las que se colocan. */
export const COOKIE_SIZE = 9;
/** Sobre una pieza: hay que saltar bien para cogerlas. */
export const COOKIE_ARC_Y = 40;
/** Sobre una falange: solo llega con el doble salto. */
export const COOKIE_HIGH_Y = 85;
/** Cuántas galletas devuelven un corazón. */
export const COOKIES_PER_HEART = 30;

/** Reglas de una partida: 3 corazones (uno por choque) y 3 ejercicios fallidos; con cualquiera de los dos a cero se acaba. */
export const MAX_HEARTS = 3;
export const MAX_STRIKES = 3;

/** Cada cuántos niveles cambia el escenario, y los escenarios por los que se va pasando. */
export const LEVELS_PER_WORLD = 3;
export const WORLDS = ['day', 'sunset', 'night', 'dawn'] as const;
export type RunnerWorld = (typeof WORLDS)[number];

export function worldOfLevel(level: number): RunnerWorld {
  const index = Math.floor((Math.max(level, 1) - 1) / LEVELS_PER_WORLD);
  return WORLDS[index % WORLDS.length];
}
