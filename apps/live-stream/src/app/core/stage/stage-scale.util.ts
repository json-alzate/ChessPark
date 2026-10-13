/** Tamaño del lienzo del directo. El runner abre la página justo a este tamaño. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/**
 * Escala para que el lienzo de 1920×1080 quepa entero en una ventana.
 *
 * En el runner la ventana mide 1920×1080 y la escala es 1. En un navegador normal
 * (para desarrollar) el lienzo se encoge, nunca se agranda por encima de 1.
 */
export function fitScale(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return 1;
  }
  return Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT, 1);
}
