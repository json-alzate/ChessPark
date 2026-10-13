import type { StreamPhase } from '@features/stream/services/stream-director.service';

/** Lo que muestra la tarjeta principal del panel (la de la cuenta atrás). */
export interface CountdownDisplay {
  headline: string;
  /** Texto grande: la cuenta atrás (mm:ss) o una palabra según la fase. */
  big: string;
  /** Si `big` es una palabra, se pinta más pequeña que los dígitos. */
  bigIsText: boolean;
  /** Barra de progreso, de 0 a 1. */
  progress: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Segundos a `mm:ss`. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(Math.floor(totalSeconds), 0);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function countdownDisplay(phase: StreamPhase, countdownS: number, totalS: number): CountdownDisplay {
  switch (phase) {
    case 'cargando':
      return { headline: 'Please wait', big: 'Loading', bigIsText: true, progress: 0 };
    case 'presentacion':
    case 'rival':
      return { headline: 'Look closely', big: formatClock(totalS), bigIsText: false, progress: 1 };
    case 'cuenta':
      return {
        headline: 'Can you see it?',
        big: formatClock(countdownS),
        bigIsText: false,
        progress: totalS > 0 ? countdownS / totalS : 0,
      };
    case 'solucion':
      return { headline: 'Solution', big: 'Watch', bigIsText: true, progress: 0 };
    case 'cierre':
      return { headline: 'Next puzzle', big: 'Go!', bigIsText: true, progress: 0 };
  }
}
