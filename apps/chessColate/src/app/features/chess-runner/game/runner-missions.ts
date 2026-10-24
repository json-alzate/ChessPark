/**
 * La misión de cada carrera: un reto opcional y corto (saltos perfectos, galletas, una racha, la estrella, no chocar) que
 * sale en una esquina del lienzo. Quien lo cumple gana tiempo extra para el ejercicio que viene: lo que se hace bien
 * corriendo ayuda a la táctica. Pura y determinista: la misión de un ejercicio es siempre la misma y sube de exigencia
 * con el nivel.
 */

import { hashString, seededRandom } from '../utils/runner-sequence.util';

export type MissionKind = 'perfects' | 'cookies' | 'combo' | 'star' | 'clean';

export interface Mission {
  kind: MissionKind;
  /** Cuánto hay que llegar a tener (en `star` y `clean`, uno: se cumple o no). */
  target: number;
  /** Segundos que se suman al reloj del ejercicio al cumplirla. */
  reward: number;
}

/** Lo que cuenta la carrera mientras se corre. */
export interface MissionProgress {
  perfects: number;
  cookies: number;
  /** La mayor racha de piezas seguidas sin chocar. */
  bestCombo: number;
  /** Estrellas cogidas. */
  stars: number;
  stumbles: number;
}

export const MISSION_REWARD_SECONDS = 10;

/** Las misiones posibles según el nivel: las más difíciles de cumplir no salen al empezar. */
function kindsFor(level: number): MissionKind[] {
  const kinds: MissionKind[] = ['cookies', 'perfects', 'star'];
  if (level >= 3) {
    kinds.push('combo');
  }
  if (level >= 5) {
    kinds.push('clean');
  }
  return kinds;
}

/** La misión de una carrera (por su ejercicio y su nivel). */
export function missionFor(seed: string, level: number): Mission {
  const lvl = Math.max(1, Math.floor(level));
  const kinds = kindsFor(lvl);
  const kind = kinds[Math.floor(seededRandom(hashString(`mision-${seed}`))() * kinds.length)];
  const targets: Record<MissionKind, number> = {
    perfects: Math.min(2 + Math.floor(lvl / 6), 5),
    cookies: Math.min(25 + 3 * lvl, 80),
    combo: Math.min(6 + Math.floor(lvl / 3), 12),
    star: 1,
    clean: 1,
  };
  return { kind, target: targets[kind], reward: MISSION_REWARD_SECONDS };
}

/** Cuánto lleva la misión (para enseñar «2/3»). En `clean` es 1 mientras no se haya chocado, y 0 tras el primer choque. */
export function missionValue(mission: Mission, progress: MissionProgress): number {
  switch (mission.kind) {
    case 'perfects':
      return Math.min(progress.perfects, mission.target);
    case 'cookies':
      return Math.min(progress.cookies, mission.target);
    case 'combo':
      return Math.min(progress.bestCombo, mission.target);
    case 'star':
      return Math.min(progress.stars, 1);
    case 'clean':
      return progress.stumbles === 0 ? 1 : 0;
  }
}

/**
 * ¿Cumplida? Las demás se cumplen en cuanto se llega al objetivo; «sin choques» solo se sabe al acabar la carrera
 * (`finished`), porque hasta entonces todavía se puede chocar.
 */
export function missionDone(mission: Mission, progress: MissionProgress, finished = false): boolean {
  if (mission.kind === 'clean') {
    return finished && progress.stumbles === 0;
  }
  return missionValue(mission, progress) >= mission.target;
}

/** La misión «sin choques» ya no se puede cumplir. */
export function missionFailed(mission: Mission, progress: MissionProgress): boolean {
  return mission.kind === 'clean' && progress.stumbles > 0;
}
