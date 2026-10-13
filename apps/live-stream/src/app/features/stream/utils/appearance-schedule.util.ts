import type { BoardStyle, PiecesStyle } from '@chesspark/models';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface Appearance {
  pieces: PiecesStyle;
  board: BoardStyle;
}

/**
 * Fase del día en un instante, con el mismo ciclo que la escena (`nightAt`): de día todo
 * claro, atardeciendo se transiciona, de noche oscuro y al final amanece.
 */
export function dayPhaseAt(nowMs: number, dayMs: number): DayPhase {
  const p = (nowMs % dayMs) / dayMs;
  if (p >= 0.9 || p < 0.06) {
    return 'dawn';
  }
  if (p < 0.42) {
    return 'day';
  }
  if (p < 0.55) {
    return 'dusk';
  }
  return 'night';
}

/**
 * Combinaciones de tablero y piezas por fase del día. Criterios:
 * - De noche, casillas claras menos brillantes (no deslumbra) y tonos fríos.
 * - De día, casillas claras y cálidas; al amanecer y atardecer, tonos de transición.
 * - Solo sets de piezas fáciles de leer y con licencia que permite un canal monetizado
 *   (la app ya no incluye sets no comerciales). Se evitan también los de licencia CC BY, que
 *   exigirían atribución en la descripción del directo.
 */
export const APPEARANCE_POOLS: Record<DayPhase, readonly Appearance[]> = {
  dawn: [
    { board: 'sage', pieces: 'cburnett' },
    { board: 'blue-classic', pieces: 'chessnut' },
    { board: 'default', pieces: 'celtic' },
  ],
  day: [
    { board: 'chessboard-js', pieces: 'cburnett' },
    { board: 'blue', pieces: 'celtic' },
    { board: 'green', pieces: 'chessnut' },
    { board: 'blue', pieces: 'rhosgfx' },
  ],
  dusk: [
    { board: 'chess-club', pieces: 'cburnett' },
    { board: 'green', pieces: 'celtic' },
    { board: 'default', pieces: 'chessnut' },
  ],
  night: [
    { board: 'royal', pieces: 'cburnett' },
    { board: 'purple', pieces: 'chessnut' },
    { board: 'purple', pieces: 'celtic' },
    { board: 'royal', pieces: 'chessnut' },
  ],
};

/**
 * Tablero y piezas para un instante. Dentro de cada fase rota cada `rotationMs`, y depende solo
 * de la hora: tras un reinicio del runner vuelve a la misma combinación.
 */
export function appearanceAt(nowMs: number, dayMs: number, rotationMs: number): Appearance {
  const pool = APPEARANCE_POOLS[dayPhaseAt(nowMs, dayMs)];
  return pool[Math.floor(nowMs / rotationMs) % pool.length];
}
