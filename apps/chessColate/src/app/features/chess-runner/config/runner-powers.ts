/**
 * Lo que cambia cada poder del perrito en el juego. Los poderes son pasivos (el control sigue siendo un solo toque):
 * ayudan un poco, no se pueden desactivar y no cambian lo que hay que hacer para pasar una pieza. Esta función pura los
 * convierte en las reglas con que se juega la carrera (`RunnerModifiers`).
 *
 * | Poder   | Qué hace                                                                      |
 * |---------|-------------------------------------------------------------------------------|
 * | nose    | Atrae las galletas: se cogen desde más lejos                                  |
 * | spring  | El segundo salto sube más (las falanges dejan más margen)                     |
 * | shield  | Un escudo por carrera: aguanta el primer choque                               |
 * | trail   | Un destello bajo las patas marca el momento de tocar                          |
 * | ghost   | Se ve dónde llegará de verdad cada pieza que se desliza o salta               |
 * | dodge   | Tras un choque, el perrito es invulnerable el doble de tiempo                  |
 * | heart   | Un corazón más (cuatro)                                                       |
 * | net     | Las galletas devuelven un corazón con menos (40 en vez de 60)                 |
 * | cloak   | Un toque dado un poco antes de aterrizar se guarda más tiempo                  |
 * | crown   | Resolver un ejercicio cura dos corazones en vez de uno                        |
 */

import { RunnerPowerId } from '../campaign/runner-curriculum';
import { COOKIES_PER_HEART, MAX_HEARTS, RUNNER_PHYSICS } from './runner.config';

export interface RunnerModifiers {
  /** Cuánto se agranda la caja del perrito para coger galletas, en horizontal y en vertical (px). */
  pickupReachX: number;
  pickupReachY: number;
  /** Impulso del segundo salto. */
  doubleJumpVelocity: number;
  /** Escudos al empezar cada carrera. */
  shields: number;
  /** Segundos de invulnerabilidad (y de tropiezo) tras un choque. */
  stumbleTime: number;
  /** Segundos que se guarda un toque dado antes de aterrizar. */
  inputBuffer: number;
  /** Se ve el destello que marca cuándo tocar. */
  tapCue: boolean;
  /** Se ve dónde llegará de verdad cada pieza que se desliza o salta. */
  ghosts: boolean;
  /** Reglas de la partida. */
  maxHearts: number;
  cookiesPerHeart: number;
  /** Corazones que cura resolver un ejercicio. */
  solveHeal: number;
}

export const BASE_MODIFIERS: RunnerModifiers = {
  pickupReachX: 4,
  pickupReachY: 2,
  doubleJumpVelocity: RUNNER_PHYSICS.doubleJumpVelocity,
  shields: 0,
  stumbleTime: RUNNER_PHYSICS.stumbleTime,
  inputBuffer: RUNNER_PHYSICS.inputBuffer,
  tapCue: false,
  ghosts: false,
  maxHearts: MAX_HEARTS,
  cookiesPerHeart: COOKIES_PER_HEART,
  solveHeal: 1,
};

/** Cada poder, sobre las reglas que ya hay. */
const EFFECTS: Record<RunnerPowerId, (mods: RunnerModifiers) => RunnerModifiers> = {
  nose: (m) => ({ ...m, pickupReachX: m.pickupReachX + 10, pickupReachY: m.pickupReachY + 6 }),
  spring: (m) => ({ ...m, doubleJumpVelocity: m.doubleJumpVelocity + 30 }),
  shield: (m) => ({ ...m, shields: m.shields + 1 }),
  trail: (m) => ({ ...m, tapCue: true }),
  ghost: (m) => ({ ...m, ghosts: true }),
  dodge: (m) => ({ ...m, stumbleTime: m.stumbleTime * 2 }),
  heart: (m) => ({ ...m, maxHearts: m.maxHearts + 1 }),
  net: (m) => ({ ...m, cookiesPerHeart: Math.round((m.cookiesPerHeart * 2) / 3) }),
  cloak: (m) => ({ ...m, inputBuffer: m.inputBuffer + 0.1 }),
  crown: (m) => ({ ...m, solveHeal: m.solveHeal + 1 }),
};

/** Las reglas con los poderes ganados. */
export function modifiersFor(powers: readonly RunnerPowerId[]): RunnerModifiers {
  return [...new Set(powers)].reduce((mods, power) => EFFECTS[power](mods), BASE_MODIFIERS);
}
