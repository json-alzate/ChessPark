/**
 * Chess Runner: un minijuego previo al ejercicio. Chocolate corre y, con un toque, salta las piezas del
 * ejercicio como obstáculos; al superarlas aparece el tablero. La simulación es pura (sin canvas ni reloj) y
 * trabaja en píxeles lógicos: el lienzo los escala por un entero.
 */

import { RunnerDifficulty } from '../config/runner.config';

export type RunnerPieceKind = 'pawn' | 'rook' | 'bishop' | 'knight' | 'queen' | 'king';
export type RunnerPieceColor = 'w' | 'b';

export interface RunnerPiece {
  kind: RunnerPieceKind;
  color: RunnerPieceColor;
  /**
   * Cuánto hueco deja tras ella, de 0 (el menor del nivel) a 1 (el mayor): así el ritmo no es un
   * metrónomo. Sin valor, el punto medio.
   */
  beat?: number;
  /** Cuántas piezas iguales van en fila (una falange): solo se pasan con el doble salto. Sin valor, una. */
  wall?: number;
}

export interface RunnerObstacle {
  id: number;
  kind: RunnerPieceKind;
  color: RunnerPieceColor;
  /** El ritmo de la pieza (ver `RunnerPiece.beat`). */
  beat?: number;
  /**
   * Borde izquierdo si fuera una pieza quieta: va con el suelo y marca cuándo llega. Lo que se dibuja y
   * choca es `x`, que sale de este número y de cómo se mueve la pieza.
   */
  plan: number;
  /** Borde izquierdo del obstáculo, en píxeles lógicos de pantalla. */
  x: number;
  /** Altura de la base sobre el suelo: el alfil flota y el caballo se eleva en su salto. */
  y: number;
  /** Alto y ancho que pueden chocar (el ancho abarca toda la falange). */
  width: number;
  height: number;
  /** Piezas en fila y separación entre ellas (de izquierda a izquierda). */
  count: number;
  spacing: number;
  /** Ya lo superó Chocolate. */
  cleared: boolean;
  /** Chocó con él: ya no cuenta ni estorba. */
  hit: boolean;
}

/** Una galleta de ChessColate suelta en el aire o en el suelo. */
export interface RunnerCookie {
  id: number;
  /** Borde izquierdo y altura de la base sobre el suelo. */
  x: number;
  y: number;
}

export interface RunnerDog {
  /** Centro del sprite en horizontal. Fijo corriendo; avanza solo al terminar. */
  x: number;
  /** Altura de los pies sobre el suelo. */
  y: number;
  vy: number;
  /** Segundos que le quedan tropezado: no puede volver a chocar mientras tanto. */
  stumble: number;
  /** Saltos dados desde que despegó: 0 en el suelo, 1 tras el salto y 2 tras el doble. */
  jumps: number;
  /** Un segundo toque dado mientras sube: se ejecuta en la cima. */
  doubleQueued: boolean;
}

export type RunnerPhase = 'running' | 'finishing' | 'done';

export interface RunnerState {
  phase: RunnerPhase;
  /** Segundos de carrera. */
  time: number;
  difficulty: RunnerDifficulty;
  /** Velocidad actual del suelo (px/s): sube desde `startSpeed` hacia `endSpeed` a medida que se superan piezas. */
  speed: number;
  /** Lo que ha pasado el suelo desde el principio, en píxeles (para el paralaje del fondo). */
  distance: number;
  /** Ancho visible, en píxeles lógicos. */
  width: number;
  dog: RunnerDog;
  obstacles: RunnerObstacle[];
  /** Lo que falta por salir, en orden. */
  queue: RunnerPiece[];
  /** Las galletas que hay por el camino. */
  pickups: RunnerCookie[];
  /** Galletas cogidas en esta carrera. */
  cookies: number;
  /** Distancia que falta recorrer antes de sacar el siguiente obstáculo. */
  untilSpawn: number;
  nextId: number;
  /** Segundos que le quedan a un toque dado en el aire: si hay, se salta al aterrizar. */
  jumpBuffer: number;
  total: number;
  cleared: number;
  stumbles: number;
  /** Piezas superadas seguidas sin tropezar. */
  combo: number;
  bestCombo: number;
}

/** Lo que ocurrió en un paso, para que la pantalla suene y avise. */
export interface RunnerEvents {
  jumped: boolean;
  /** El segundo salto, el del aire (se ejecuta al tocar una vez más o al llegar a la cima). */
  doubleJumped: boolean;
  /** Galletas cogidas en este paso. */
  cookies: number;
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
  /** La mayor racha de piezas superadas sin tropezar. */
  bestCombo: number;
  /** Metros que se corrieron y galletas que se cogieron. */
  meters: number;
  cookies: number;
}

/** Un rectángulo en píxeles lógicos con el origen en el suelo (y crece hacia arriba). */
export interface RunnerBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
