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
  gravity: 820,
  /** Velocidad a la que pasa el suelo en el nivel 1; los niveles siguientes la suben. */
  speed: 120,
  /** El salto: sube unos 62 px y dura ~0,78 s: flotante a propósito, para dejar tiempo de acertar. */
  jumpVelocity: 320,
  /** El segundo salto, en el aire: añade unos 45 px más a la cima. */
  doubleJumpVelocity: 270,
  /** Tiempo que dura el tropiezo y la invulnerabilidad que da. */
  stumbleTime: 0.9,
  /** Velocidad del perrito cuando corre hacia el tablero al final. */
  finishSpeed: 170,
  /** Centro horizontal del perrito corriendo. */
  dogX: 42,
  /** Un toque así de pronto antes de aterrizar se ejecuta al tocar el suelo. */
  inputBuffer: 0.12,
} as const;

/** Lo que del perrito puede chocar, dentro de su celda de 52×40 (más pequeño que el dibujo: es indulgente). */
export const DOG_BOX = {
  /** Desplazamiento del borde izquierdo respecto al centro del sprite. */
  dx: -6,
  width: 16,
  height: 24,
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
 * Cómo se mueve cada pieza. Todas llegan al perrito a la hora prevista (la de una pieza quieta): lo que
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

/** Lado, en píxeles lógicos, del cuadro con que se dibuja cada pieza del set elegido: menor que el perrito, que mide 40 de alto. */
export const PIECE_DRAW_SIZE = 30;

/** Píxeles lógicos de carrera por metro que ve el jugador: la distancia es el récord, como en el dinosaurio de Chrome. */
export const PX_PER_METER = 8;

/** Alto del lienzo lógico: cabe el salto (unos 47 px) con holgura sobre el suelo. */
export const RUNNER_CANVAS_HEIGHT = 176;

/** Antes del primer obstáculo, para que dé tiempo a ver la pantalla y entender el control. */
export const FIRST_GAP = 170;

/** Piezas distintas como máximo que salen de un ejercicio: más sería un castigo, no un reto. */
export const MAX_OBSTACLES = 8;

/**
 * Cuánto dura una carrera, más o menos: lo justo para entrar en materia antes del ejercicio sin cansar. Crece un poco
 * con el nivel (a más nivel se va más rápido, y la carrera tiene que seguir durando). Se reparte en oleadas con
 * respiros de galletas entre ellas.
 */
export const RUN_SECONDS = { base: 25, perLevel: 0.35 } as const;
/** Segundos de calma (con galletas) tras cada oleada menos la última. */
export const REST_SECONDS = 2.4;
/** Piezas por oleada como máximo, y oleadas por carrera. */
export const MAX_WAVES = 3;
/** Copias como máximo de una misma pieza. */
export const MAX_PER_KIND = 2;

/** El menor hueco posible entre piezas (s): el vuelo de un salto (0,78 s) y un respiro para volver a tocar. */
export const MIN_GAP_FLOOR = 0.95;

/** Nivel a partir del cual el juego ya no se acelera más (el capítulo 20 de la primera ronda; después, solo cambian el ELO y las falanges). */
export const MAX_LEVEL = 20;
/** Hasta este nivel la dificultad sube a ritmo completo; de ahí al máximo, a la mitad (no se vuelve injugable). */
export const FAST_LEVELS = 10;

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

/**
 * La dificultad de un nivel. Admite niveles con decimales: dentro de un capítulo la dificultad sube ejercicio a
 * ejercicio (el nivel 2,6 está a medio camino entre el 2 y el 3).
 */
export function difficultyForLevel(level: number): RunnerDifficulty {
  const capped = Math.min(Math.max(Number.isFinite(level) ? level : 1, 1), MAX_LEVEL);
  const raw = capped - 1;
  const step = Math.min(raw, FAST_LEVELS - 1) + Math.max(raw - (FAST_LEVELS - 1), 0) * 0.5;
  const startSpeed = RUNNER_PHYSICS.speed + 6 * step;
  return {
    level: Math.floor(capped),
    startSpeed,
    endSpeed: startSpeed + 22 + 3 * step,
    minGapTime: Math.max(MIN_GAP_FLOOR, 1.12 - 0.02 * step),
    maxGapTime: Math.max(MIN_GAP_FLOOR, 1.12 - 0.02 * step) + 0.85 - 0.015 * step,
  };
}

/** Galleta de ChessColate: lado de su caja y alturas a las que se colocan. */
export const COOKIE_SIZE = 9;
/** Sobre una pieza: hay que saltar bien para cogerlas. */
export const COOKIE_ARC_Y = 40;
/** Sobre una falange: solo llega con el doble salto. */
export const COOKIE_HIGH_Y = 100;
/**
 * Un salto perfecto: la pieza pasa justo cuando el perrito está en lo más alto (a esta fracción de la altura máxima o más).
 * Da galletas de más; es lo que premia dominar el ritmo, no solo sobrevivir.
 */
export const PERFECT_RATIO = 0.95;
export const PERFECT_COOKIES = 3;
/** La estrella: segundos que dura, altura a la que flota y galletas que da cada pieza que arrolla. */
export const STAR_SECONDS = 4;
export const STAR_Y = 34;
export const SMASH_COOKIES = 2;
/** Galletas (de las que llevan hacia el siguiente corazón) que se pierden como máximo con cada choque: salen volando. */
export const SCATTER_COOKIES = 8;
/** Cuántas galletas devuelven un corazón. */
export const COOKIES_PER_HEART = 60;

/** Reglas de una partida: 3 corazones (uno por choque) y 3 ejercicios fallidos; con cualquiera de los dos a cero se acaba. */
export const MAX_HEARTS = 3;
export const MAX_STRIKES = 3;
