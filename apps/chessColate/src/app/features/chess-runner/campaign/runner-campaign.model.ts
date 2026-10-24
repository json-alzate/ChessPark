import { RunnerPowerId } from './runner-curriculum';

/** Lo que se lleva visto, acertado y fallado de un patrón. */
export interface PatternStat {
  solved: number;
  failed: number;
  /** Cuántos ejercicios de la campaña llevaba cuando se vio por última vez (para saber qué se está olvidando). */
  lastSeen: number;
}

/** Un repaso pendiente: unos ejercicios del patrón que peor se tiene, entre un capítulo y el siguiente. */
export interface PendingReview {
  theme: string;
  left: number;
}

/**
 * El progreso del jugador en el currículo: lo único del runner (con el récord) que se guarda en el dispositivo.
 * Es un dato plano y serializable.
 */
export interface RunnerCampaign {
  version: 2;
  /** Ronda en curso (0 la primera): al vencer al último guardián empieza otra con los mismos patrones, más difíciles. */
  round: number;
  /** Capítulo en curso dentro de la ronda (0 a `CHAPTERS.length - 1`). */
  chapter: number;
  /**
   * El ELO del perrito en el runner: sube al resolver y baja al fallar, como el de ajedrez. Con él se pide cada ejercicio.
   * Es solo del juego: no toca el ELO del usuario. 0 hasta la primera vez que se entra (entonces se parte del del usuario).
   */
  rating: number;
  /** El ELO más alto que ha tenido. */
  peakRating: number;
  /** Ejercicios resueltos del bloque en curso y fallos que llevan. */
  solvedInBlock: number;
  failsInBlock: number;
  /** Ejercicios jugados en total (resueltos o no). */
  puzzles: number;
  mastery: Record<string, PatternStat>;
  /** Poderes ganados, en orden. */
  powers: RunnerPowerId[];
  /** Estrellas (1 a 3) del mejor intento de cada capítulo terminado. */
  stars: number[];
  review: PendingReview | null;
  /** Lo que ya se vio de la historia y las lecciones, para no repetirlo. */
  seen: string[];
  /** Galletas que se tienen guardadas (se ganan corriendo y se gastan en pelajes). */
  cookies: number;
  /** Días seguidos jugando (resolviendo algún ejercicio) y el último día que se jugó (`AAAA-MM-DD`, del dispositivo). */
  days: number;
  lastDay: string;
  /** El pelaje que lleva el perrito y los que tiene desbloqueados. */
  skin: string;
  skins: string[];
}

/** Qué toca jugar ahora. */
export interface CampaignStep {
  kind: 'block' | 'review';
  chapter: number;
  theme: string;
  /** Puesto dentro del bloque (0 a 4) o del repaso. */
  index: number;
  /** Cuántos tiene el bloque o el repaso. */
  total: number;
  /** ELO del ejercicio respecto al ELO del perrito. */
  eloOffset: number;
}

export type CampaignEvent =
  | { kind: 'chapterComplete'; chapter: number; stars: number; power: RunnerPowerId | null; firstTime: boolean }
  | { kind: 'reviewStart'; theme: string }
  | { kind: 'reviewDone' }
  /** Se venció al último guardián de una ronda (`round` es la que acaba, desde 0). */
  | { kind: 'roundComplete'; round: number }
  /** El ELO del perrito cambió con un ejercicio. */
  | { kind: 'rating'; from: number; to: number };
