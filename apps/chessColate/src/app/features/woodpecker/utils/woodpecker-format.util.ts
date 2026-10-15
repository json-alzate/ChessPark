/**
 * Formato de los tiempos y variaciones que se enseñan en las pantallas del
 * Pájaro Carpintero. Puro: el texto «más rápido» o «más lento» lo pone la
 * plantilla con su traducción.
 */

/** `m:ss` hasta la hora y `h:mm:ss` a partir de ella. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/** Porcentaje sin decimales y en positivo: el signo lo dice el texto que lo acompaña. */
export function roundedPercent(value: number): number {
  return Math.round(Math.abs(value));
}

/**
 * Qué decir de un cambio: `better` si mejoró, `worse` si empeoró, `same` si
 * no se movió (el redondeo que se ve en pantalla es 0).
 */
export function trend(delta: number, lowerIsBetter = false): 'better' | 'worse' | 'same' {
  if (roundedPercent(delta) === 0) {
    return 'same';
  }
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? 'better' : 'worse';
}
