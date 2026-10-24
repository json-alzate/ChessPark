/**
 * Pantallas con un tablero a pantalla completa. En iOS, Ionic vuelve a la pantalla anterior al
 * arrastrar un dedo desde el borde izquierdo; el tablero llega hasta ese borde, así que mover una
 * pieza de la columna "a" hacia la derecha se leía como "atrás": la rutina se abandonaba de golpe
 * o, si el gesto se cancelaba a medias, se quedaba con el reloj del bloque parado.
 */
const BOARD_SCREENS = [
  '/puzzles/training',
  '/streak',
  '/woodpecker/play',
  '/chess-runner',
  '/coordinates',
  '/knight-tour',
  '/chess960',
  '/games/viewer',
];

/** `false` si en esa ruta no debe funcionar el gesto de deslizar desde el borde para volver. */
export function isSwipeBackAllowed(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return !BOARD_SCREENS.some((screen) => path === screen || path.startsWith(`${screen}/`));
}
