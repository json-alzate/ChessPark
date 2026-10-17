import { COOKIE_HIGH_Y, DOG_BOX, OBSTACLE_SHAPES, WALL_COUNT } from '@features/chess-runner/config/runner.config';
import { RunnerObstacle, RunnerPieceKind } from '@features/chess-runner/models/runner.model';
import {
  COOKIE_GREEDY_Y,
  COOKIE_SHAPES,
  cookiesFor,
  GREEDY_MIN_GAP,
  ribbon,
  SINGLE_JUMP_APEX,
  variantOf,
} from '@features/chess-runner/utils/runner-cookies.util';

const KINDS = Object.keys(OBSTACLE_SHAPES) as RunnerPieceKind[];

function obstacle(over: Partial<RunnerObstacle> = {}): RunnerObstacle {
  const kind = over.kind ?? 'pawn';
  const shape = OBSTACLE_SHAPES[kind];
  return {
    id: 1,
    kind,
    color: 'w',
    beat: 0.5,
    plan: 300,
    x: 300,
    y: 0,
    width: shape.width,
    height: shape.height,
    count: 1,
    spacing: 0,
    cleared: false,
    hit: false,
    ...over,
  };
}

/** Las galletas son una figura variada, y siempre a un alcance que el salto sencillo (o el doble) permite. */
describe('galletas · figuras', () => {
  const alcance = SINGLE_JUMP_APEX + DOG_BOX.height;

  it('la figura sale del ritmo y del número de la pieza, siempre igual para la misma', () => {
    const a = variantOf({ id: 4, beat: 0.37 }, 5);
    const b = variantOf({ id: 4, beat: 0.37 }, 5);

    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(5);
  });

  it('sobre las piezas salen todas las figuras, y ninguna deja galletas fuera del alcance del salto', () => {
    const figuras = new Set<string>();
    for (const kind of KINDS) {
      for (let id = 1; id <= 30; id++) {
        const { cookies } = cookiesFor(obstacle({ kind, id, beat: 0.9 }), 400, 1);
        const sobre = cookies.filter((c) => c.y > DOG_BOX.height);
        figuras.add(sobre.map((c) => Math.round(c.y - sobre[0].y)).join(','));
        for (const c of sobre) {
          expect(c.y).toBeLessThanOrEqual(alcance);
          // Nunca dentro de la pieza ni pegadas a ella: se cogen por encima
          expect(c.y).toBeGreaterThan(OBSTACLE_SHAPES[kind].height);
        }
      }
    }

    expect(figuras.size).toBeGreaterThanOrEqual(COOKIE_SHAPES.overPiece);
  });

  it('sobre una falange siempre son tres arriba del todo', () => {
    const { cookies } = cookiesFor(obstacle({ count: WALL_COUNT, width: 60, spacing: 25 }), 400, 1);

    expect(cookies.filter((c) => c.y === COOKIE_HIGH_Y)).toHaveLength(3);
  });

  it('con ritmo corto, el hueco lleva una figura a ras de suelo que se coge corriendo, y varía', () => {
    const figuras = new Set<string>();
    for (let id = 1; id <= 40; id++) {
      const { cookies } = cookiesFor(obstacle({ id, beat: 0.1 }), 400, 1, 0, 1.3);
      const suelo = cookies.filter((c) => c.y <= DOG_BOX.height);
      expect(suelo.length).toBeGreaterThanOrEqual(2);
      figuras.add(suelo.map((c) => c.y).join(','));
    }

    expect(figuras.size).toBeGreaterThanOrEqual(3);
  });

  it('con un hueco largo hay a veces galletas golosas en el aire, al alcance de un salto, y nunca en uno corto', () => {
    let golosas = 0;
    for (let id = 1; id <= 40; id++) {
      const largo = cookiesFor(obstacle({ id, beat: 0.9 }), 500, 1, 0, GREEDY_MIN_GAP + 0.3).cookies;
      const corto = cookiesFor(obstacle({ id, beat: 0.9 }), 500, 1, 0, GREEDY_MIN_GAP - 0.3).cookies;
      golosas += largo.filter((c) => c.y === COOKIE_GREEDY_Y).length > 0 ? 1 : 0;
      expect(corto.filter((c) => c.y === COOKIE_GREEDY_Y && c.x > 300 + 20)).toHaveLength(0);
    }

    expect(golosas).toBeGreaterThan(5);
    expect(golosas).toBeLessThan(35);
    expect(COOKIE_GREEDY_Y).toBeLessThanOrEqual(alcance);
  });

  it('la cinta de un respiro tiene cuatro figuras, todas con galletas al alcance y cada una distinta', () => {
    const formas = new Set<string>();
    for (let shape = 0; shape < COOKIE_SHAPES.ribbon; shape++) {
      const { cookies } = ribbon(100, 200, 1, shape);

      expect(cookies.length).toBeGreaterThan(6);
      expect(Math.max(...cookies.map((c) => c.y))).toBeLessThanOrEqual(alcance);
      formas.add(cookies.map((c) => c.y).join(','));
    }

    expect(formas.size).toBe(COOKIE_SHAPES.ribbon);
  });

  it('los números de las galletas no se repiten', () => {
    const { cookies, nextId } = cookiesFor(obstacle({ beat: 0.1 }), 400, 10, 0, 1.3);

    expect(new Set(cookies.map((c) => c.id)).size).toBe(cookies.length);
    expect(nextId).toBe(10 + cookies.length);
  });
});
