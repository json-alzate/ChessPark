/**
 * Chess Runner: un minijuego previo al ejercicio. Chocolate corre y salta las piezas del ejercicio
 * como obstáculos; al superarlas aparece el tablero. La simulación es pura (sin canvas ni reloj) y
 * trabaja en píxeles lógicos: el lienzo los escala por un entero.
 */

export type RunnerPieceKind = 'pawn' | 'rook' | 'bishop' | 'knight' | 'queen' | 'king';
export type RunnerPieceColor = 'w' | 'b';

export interface RunnerPiece {
  kind: RunnerPieceKind;
  color: RunnerPieceColor;
}

/** Lo que el jugador le pide a Chocolate. Cada pieza exige uno distinto. */
export type RunnerAction = 'jump' | 'slide' | 'longJump';

/** Pista visual de la mecánica (coincide con los iconos `hint-*` de los assets). */
export type RunnerHint = 'jump' | 'slide' | 'long' | 'hold' | 'double' | 'precise';

export interface RunnerObstacle {
  id: number;
  kind: RunnerPieceKind;
  color: RunnerPieceColor;
  /** Borde izquierdo del obstáculo, en píxeles lógicos de pantalla. */
  x: number;
  /** 0 = primera vez; 1 = reaparece tras un tropiezo (segunda y última oportunidad). */
  attempt: 0 | 1;
  /** Ya lo superó Chocolate. */
  cleared: boolean;
  /** Chocó con él: ya no cuenta ni estorba. */
  hit: boolean;
}

export interface RunnerDog {
  /** Centro del sprite en horizontal. Fijo corriendo; avanza solo al terminar. */
  x: number;
  /** Altura de los pies sobre el suelo. */
  y: number;
  vy: number;
  /** Saltos usados en este vuelo (0 en el suelo, 1 tras saltar, 2 tras el doble salto). */
  jumps: number;
  /** Tiempo de suspensión que le queda en este vuelo. */
  hoverLeft: number;
  /** Está en un salto largo: el suelo pasa más rápido mientras dura el vuelo. */
  longJump: boolean;
  /** Segundos que le quedan agachado. */
  slide: number;
  /** Segundos que le quedan tropezado: no puede volver a chocar mientras tanto. */
  stumble: number;
}

export type RunnerPhase = 'running' | 'finishing' | 'done';

export interface RunnerState {
  phase: RunnerPhase;
  /** Segundos de carrera. */
  time: number;
  /** Lo que ha pasado el suelo desde el principio, en píxeles (para el paralaje del fondo). */
  distance: number;
  /** Ancho visible, en píxeles lógicos. */
  width: number;
  dog: RunnerDog;
  obstacles: RunnerObstacle[];
  /** Lo que falta por salir, en orden (la primera vez y los reintentos). */
  queue: { piece: RunnerPiece; attempt: 0 | 1 }[];
  /** Distancia que falta recorrer antes de sacar el siguiente obstáculo. */
  untilSpawn: number;
  nextId: number;
  /** Orden pulsada un instante antes de poder ejecutarse (en el aire); se hace al aterrizar. */
  buffer: { action: RunnerAction; ttl: number } | null;
  total: number;
  cleared: number;
  stumbles: number;
}

/** Lo que ocurrió en un paso, para que la pantalla suene y avise. */
export interface RunnerEvents {
  jumped: boolean;
  doubleJumped: boolean;
  landed: boolean;
  cleared: RunnerObstacle[];
  stumbled: RunnerObstacle | null;
  /** Se acabó el recorrido de obstáculos: Chocolate corre hacia el tablero. */
  finishing: boolean;
  /** Salió de la pantalla: toca enseñar el ejercicio. */
  done: boolean;
}

export interface RunnerStats {
  total: number;
  stumbles: number;
  /** Sin tropezar ni una vez. */
  clean: boolean;
  durationMs: number;
}

/** Un rectángulo en píxeles lógicos con el origen en el suelo (y crece hacia arriba). */
export interface RunnerBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
