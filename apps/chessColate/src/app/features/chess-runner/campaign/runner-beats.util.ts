/**
 * Qué toca enseñar antes de cada carrera: el prólogo de la historia (una sola vez en la vida), la llegada a un mundo
 * (la primera vez que se entra a cada capítulo) y la lección del patrón. Pura: mira lo que el jugador ya vio y lo que
 * va a jugar, y devuelve lo siguiente; la pantalla lo enseña, lo marca como visto y vuelve a preguntar hasta que ya
 * no toca nada y empieza la carrera.
 */

import { CampaignStep, RunnerCampaign } from './runner-campaign.model';
import { hasSeen } from './runner-campaign.util';

export type PreRunBeat =
  | { kind: 'prologue'; seen: string[] }
  | { kind: 'intro'; chapter: number; seen: string[] }
  | { kind: 'lesson'; theme: string; seen: string[] };

/** Las claves con que se recuerda lo ya visto. */
export const seenKeys = {
  prologue: 'prologue',
  epilogue: 'epilogue',
  /** El aviso del doble salto, que sale justo antes de la primera falange. */
  doubleJumpHint: 'hint:doubleJump',
  intro: (chapter: number) => `intro:${chapter}`,
  lesson: (theme: string) => `lesson:${theme}`,
  review: (theme: string) => `review:${theme}`,
};

/**
 * Lo siguiente que toca antes de correr, o `null` si ya se puede correr. Solo al empezar un bloque o un repaso
 * (el primer ejercicio): a mitad no se interrumpe.
 */
export function nextBeat(campaign: RunnerCampaign, step: CampaignStep, hasLesson: boolean): PreRunBeat | null {
  if (step.index !== 0) {
    return null;
  }
  if (campaign.puzzles === 0 && !hasSeen(campaign, seenKeys.prologue)) {
    // El prólogo ya lleva al perrito al primer mundo: la llegada del capítulo 1 se da por vista
    return { kind: 'prologue', seen: [seenKeys.prologue, seenKeys.intro(0)] };
  }
  if (step.kind === 'block' && !hasSeen(campaign, seenKeys.intro(step.chapter))) {
    return { kind: 'intro', chapter: step.chapter, seen: [seenKeys.intro(step.chapter)] };
  }
  const lessonKey = step.kind === 'review' ? seenKeys.review(step.theme) : seenKeys.lesson(step.theme);
  if (hasLesson && !hasSeen(campaign, lessonKey)) {
    return { kind: 'lesson', theme: step.theme, seen: [lessonKey] };
  }
  return null;
}
