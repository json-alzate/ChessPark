/**
 * Tamaño del tablero en escritorio: límites y la matemática de arrastrar el asa
 * de la esquina. Funciones puras, sin DOM.
 *
 * El tamaño es el ancho de la columna del tablero (el tablero es cuadrado y lo
 * llena). Lo que se guarda es lo que el usuario eligió; cada pantalla lo acota
 * por su cuenta a lo que le cabe en alto (ver `.cc-board-column` en
 * `global.scss`, que usa las mismas reservas que aquí).
 */

/** Por debajo de esto las casillas dejan de ser cómodas de tocar. */
export const BOARD_SIZE_MIN = 320;
export const BOARD_SIZE_MAX = 1200;

/** Lo que se aparta del alto de la ventana: barra superior, controles bajo el tablero y respiro. */
export const BOARD_RESERVE_PUZZLE = 150;
/** Pantallas con título y ajustes sobre el tablero (Coordenadas, Caballo, Chess960). */
export const BOARD_RESERVE_COMPACT = 240;

/** Cuánto cambia el tamaño con cada pulsación de flecha. */
export const BOARD_KEY_STEP = 16;

export interface Point {
  x: number;
  y: number;
}

/**
 * Cuánto se mueve el asa por cada píxel que crece el tablero. Con el tablero
 * pegado arriba a la izquierda sería (1, 1); con la columna centrada en la
 * pantalla, el borde izquierdo se mueve hacia atrás y el asa solo avanza la
 * mitad en horizontal: (0,5, 1). Se mide en vez de suponerlo porque depende de
 * cómo esté maquetada cada pantalla.
 */
export type Sensitivity = Point;

/** Punto de partida para una columna centrada, que es como están las pantallas con tablero. */
export const DEFAULT_SENSITIVITY: Sensitivity = { x: 0.5, y: 1 };

/** Alto máximo útil para el tablero según la ventana y lo que la pantalla reserva. */
export function maxBoardSize(viewportHeight: number, reserve: number): number {
  return Math.max(BOARD_SIZE_MIN, Math.min(BOARD_SIZE_MAX, Math.floor(viewportHeight - reserve)));
}

/** Lleva un tamaño a los límites, entero. */
export function clampBoardSize(size: number, max: number = BOARD_SIZE_MAX): number {
  return Math.round(Math.min(max, Math.max(BOARD_SIZE_MIN, size)));
}

/** Lo guardado en el dispositivo, o `null` si no hay nada utilizable. */
export function parseStoredBoardSize(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < BOARD_SIZE_MIN || value > BOARD_SIZE_MAX) {
    return null;
  }
  return Math.round(value);
}

/**
 * Cuánto hay que cambiar el tamaño para que el asa llegue al puntero.
 * `error` es lo que le falta al asa para llegar (puntero − asa). Mínimos
 * cuadrados sobre los dos ejes: si el asa solo se mueve en uno, ese eje manda.
 */
export function sizeChangeToReach(error: Point, sensitivity: Sensitivity): number {
  const norm = sensitivity.x * sensitivity.x + sensitivity.y * sensitivity.y;
  if (norm === 0) {
    return 0;
  }
  return (error.x * sensitivity.x + error.y * sensitivity.y) / norm;
}

/**
 * Sensibilidad medida tras un cambio de tamaño. Si el cambio fue de menos de un
 * píxel no hay nada fiable que medir y se conserva la anterior. Se acota para
 * que un salto de maquetación (un panel que aparece) no la dispare.
 */
export function measureSensitivity(
  sizeChange: number,
  handleMove: Point,
  previous: Sensitivity
): Sensitivity {
  if (Math.abs(sizeChange) < 1) {
    return previous;
  }
  const limit = (value: number) => Math.min(2, Math.max(0, value));
  const x = limit(handleMove.x / sizeChange);
  const y = limit(handleMove.y / sizeChange);
  // Un asa que no se movió en ningún eje no sirve de guía
  return x === 0 && y === 0 ? previous : { x, y };
}
