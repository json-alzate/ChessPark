/**
 * Valor del conteo animado en un instante.
 *
 * Usa una curva de salida suave (arranca rápido y frena al llegar): el número se nota
 * subiendo en vez de saltar al valor final, y se asienta al terminar.
 *
 * @param progress - Avance de la animación, de 0 a 1 (se recorta fuera de ese rango)
 */
export function countUpValue(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - p) * (1 - p);
  return Math.round(from + (to - from) * eased);
}
