/**
 * Qué hace el jugador: un solo control, como en el dinosaurio de Chrome. En el móvil, tocar en cualquier
 * parte de la zona de juego; con teclado, Espacio, ↑ o W. Puro: la parte de eventos del navegador está en
 * el componente del lienzo.
 */

const JUMP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W']);

/** ¿Esta tecla hace saltar al perrito? */
export function isJumpKey(key: string): boolean {
  return JUMP_KEYS.has(key);
}

/**
 * Cuántas veces cabe el píxel lógico del juego en el ancho de pantalla. El juego se dibuja a una escala
 * entera (el pixel art no admite fracciones) y el ancho lógico cae entre 190 y 260 píxeles.
 */
export function runnerScale(cssWidth: number): number {
  return Math.max(1, Math.round(cssWidth / 220));
}

/** Ancho lógico del lienzo para un ancho de pantalla. */
export function logicalWidth(cssWidth: number): number {
  return Math.floor(cssWidth / runnerScale(cssWidth));
}
