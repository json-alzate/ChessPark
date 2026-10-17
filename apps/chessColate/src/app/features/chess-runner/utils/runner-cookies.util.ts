/**
 * Dónde se ponen las galletas de ChessColate. Cada pieza trae las suyas, y no siempre en la misma figura: sobre la
 * pieza (un arco, una cresta, una rampa, una fila alta), a ras de suelo en el hueco (una fila, una ola, una escalera),
 * en el aire a mitad de un hueco largo (una galleta golosa que pide un salto de más) y, en los respiros, una cinta que
 * cambia de forma (y, en el primero de la carrera, con la estrella en medio). La figura sale del ritmo y del número de la pieza, que ya son deterministas: el mismo ejercicio
 * da la misma carrera.
 */

import {
  COOKIE_ARC_Y,
  COOKIE_HIGH_Y,
  COOKIE_SIZE,
  RUNNER_PHYSICS as P,
  STAR_Y,
} from '../config/runner.config';
import { RunnerCookie, RunnerObstacle } from '../models/runner.model';

/** Separación entre las galletas de una fila y alrededor de una pieza. */
export const COOKIE_SPACING = 18;
/** Altura de las galletas golosas, a mitad de un hueco largo: piden un salto, y con él un buen aterrizaje. */
export const COOKIE_GREEDY_Y = 44;
/** Hueco mínimo (s) para que haya galletas golosas: con menos, saltar a por ellas se come la pieza siguiente. */
export const GREEDY_MIN_GAP = 1.1;

/** Lo que sale en un punto: desplazamiento (en separaciones de galleta) respecto al centro y altura sobre la base. */
type Dot = readonly [number, number];

/** Figuras sobre una pieza suelta. La altura es relativa a `base`, que ya deja libre la pieza. */
const OVER_PIECE: readonly (readonly Dot[])[] = [
  // arco: tres a la misma altura
  [[-1, 0], [0, 0], [1, 0]],
  // cresta: cinco que suben y bajan
  [[-2, -6], [-1, 6], [0, 14], [1, 6], [2, -6]],
  // rampa: sube hacia donde cae el perrito
  [[-1, -4], [0, 6], [1, 16]],
  // bajada: la contraria
  [[-1, 16], [0, 6], [1, -4]],
  // alta: tres, más arriba (el salto tiene que ir justo)
  [[-1, 14], [0, 20], [1, 14]],
];

/** Figuras a ras de suelo en un hueco (todas se cogen corriendo). */
const ON_GROUND: readonly (readonly Dot[])[] = [
  [[-1, 1], [0, 1], [1, 1]],
  // ola
  [[-1.5, 1], [-0.5, 12], [0.5, 1], [1.5, 12]],
  // escalera
  [[-1, 1], [0, 10], [1, 19]],
  // dos
  [[-0.5, 1], [0.5, 1]],
];

/** Cuántas figuras hay sobre una pieza suelta, a ras de suelo y en un respiro (los tests las recorren). */
export const COOKIE_SHAPES = { overPiece: OVER_PIECE.length, onGround: ON_GROUND.length, ribbon: 4 } as const;

/** Un número de 0 a `count - 1` que sale de la pieza: su ritmo y su número, sin azar nuevo. */
export function variantOf(obstacle: Pick<RunnerObstacle, 'id' | 'beat'>, count: number, salt = 0): number {
  const mixed = Math.floor((obstacle.beat ?? 0.5) * 1000) * 31 + obstacle.id * 17 + salt * 7;
  return Math.abs(mixed) % count;
}

/**
 * La cinta de un respiro, de `length` px desde `from`. Cuatro figuras:
 * - 0: una fila a ras de suelo y después un arco que sube y baja;
 * - 1: dos olas seguidas;
 * - 2: una escalera que sube hasta lo alto y cae;
 * - 3: un zigzag que alterna suelo y aire.
 */
export function ribbon(
  from: number,
  length: number,
  firstId: number,
  shape = 0,
  star = false
): { cookies: RunnerCookie[]; nextId: number } {
  const cookies: RunnerCookie[] = [];
  let nextId = firstId;
  const count = Math.max(0, Math.floor(length / COOKIE_SPACING));
  const heightAt = (i: number): number => {
    const t = count > 1 ? i / (count - 1) : 0;
    switch (shape % 4) {
      case 1:
        return Math.round(1 + 26 * Math.abs(Math.sin(t * Math.PI * 2)));
      case 2:
        return t < 0.2 || t > 0.9 ? 1 : Math.round(1 + 44 * ((t - 0.2) / 0.7));
      case 3:
        return i % 2 === 0 ? 1 : 30;
      default: {
        const flat = Math.ceil(count * 0.45);
        const arc = [14, 28, 40, 40, 28, 14];
        const j = i - flat;
        return j < 0 || j >= arc.length ? 1 : arc[j];
      }
    }
  };
  for (let i = 0; i < count; i++) {
    cookies.push({ id: nextId++, x: from + i * COOKIE_SPACING, y: heightAt(i) });
  }
  if (star && count > 2) {
    // La estrella ocupa el sitio de la galleta del medio, a una altura que un salto normal alcanza
    const middle = cookies[Math.floor(count / 2)];
    middle.kind = 'star';
    middle.y = STAR_Y;
  }
  return { cookies, nextId };
}

/**
 * Las galletas que acompañan a una pieza recién salida:
 * - sobre ella, una de las figuras de `OVER_PIECE` (sobre una falange, tres arriba del todo: solo llega el doble salto);
 * - en el hueco, en un respiro la cinta; si no, con ritmo corto una figura a ras de suelo, y con un hueco largo, a veces,
 *   galletas golosas en el aire (se cogen con un salto de más, a riesgo de la pieza siguiente).
 */
export function cookiesFor(
  obstacle: RunnerObstacle,
  gapPx: number,
  firstId: number,
  restPx = 0,
  gapSeconds = 0,
  star = false
): { cookies: RunnerCookie[]; nextId: number } {
  const cookies: RunnerCookie[] = [];
  let nextId = firstId;
  const add = (x: number, y: number) => cookies.push({ id: nextId++, x, y });
  const center = obstacle.plan + obstacle.width / 2 - COOKIE_SIZE / 2;
  const beat = obstacle.beat ?? 0.5;

  if (obstacle.count > 1) {
    // Sobre una falange: arriba del todo, solo con el doble salto
    for (let i = -1; i <= 1; i++) {
      add(center + i * Math.max(COOKIE_SPACING, obstacle.width / 3), COOKIE_HIGH_Y);
    }
  } else {
    // Sobre la pieza: se cogen saltando con buen momento
    const base = Math.max(COOKIE_ARC_Y, obstacle.y + obstacle.height + 14);
    for (const [dx, dy] of OVER_PIECE[variantOf(obstacle, OVER_PIECE.length)]) {
      add(center + dx * COOKIE_SPACING, base + dy);
    }
  }

  if (restPx > 0) {
    // El respiro: la cinta ocupa el tramo final del hueco, sin tocar la pieza ni la siguiente
    const start = obstacle.plan + gapPx - restPx + 30;
    const made = ribbon(start, restPx - 60, nextId, variantOf(obstacle, COOKIE_SHAPES.ribbon, 1), star);
    nextId = made.nextId;
    cookies.push(...made.cookies);
  } else if (gapPx > 0) {
    const middle = obstacle.plan + obstacle.width + gapPx / 2 - COOKIE_SIZE / 2;
    if (beat <= 0.5) {
      // Una figura a ras de suelo, a mitad del hueco: se coge corriendo, sin saltar
      for (const [dx, dy] of ON_GROUND[variantOf(obstacle, ON_GROUND.length, 2)]) {
        add(middle + dx * COOKIE_SPACING, dy);
      }
    } else if (gapSeconds >= GREEDY_MIN_GAP && variantOf(obstacle, 3, 3) === 0) {
      // Golosas: en el aire, en el centro del hueco; pide un salto con el que aterrizar a tiempo para la pieza siguiente
      for (const dx of [-0.5, 0.5]) {
        add(middle + dx * COOKIE_SPACING, COOKIE_GREEDY_Y);
      }
    }
  }
  return { cookies, nextId };
}

/** El salto sencillo sube unos 62 px: una galleta golosa tiene que quedar a su alcance. */
export const SINGLE_JUMP_APEX = P.jumpVelocity ** 2 / (2 * P.gravity);
