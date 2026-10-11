import { AVAILABLE_THEMES } from '@chesspark/puzzles-provider';
import { PlanTypes } from '@chesspark/models';

import { PLAN_ALLOWED_THEMES } from '@app/plan-allowed-themes.config';

const PLANES = Object.keys(PLAN_ALLOWED_THEMES) as PlanTypes[];

describe('PLAN_ALLOWED_THEMES', () => {
  it('define los temas de las rutinas de 3, 5, 10, 20 y 30 minutos', () => {
    expect(PLANES.sort()).toEqual(['plan10', 'plan20', 'plan3', 'plan30', 'plan5']);
  });

  describe.each(PLANES)('%s', (plan) => {
    const temas = PLAN_ALLOWED_THEMES[plan] as string[];

    it('no está vacío (un plan sin temas se interpreta como "todos")', () => {
      expect(temas.length).toBeGreaterThan(0);
    });

    it('no repite temas', () => {
      expect(new Set(temas).size).toBe(temas.length);
    });

    it('solo usa temas que existen en el catálogo de puzzles', () => {
      const desconocidos = temas.filter((tema) => !(AVAILABLE_THEMES as readonly string[]).includes(tema));
      expect(desconocidos).toEqual([]);
    });
  });

  // Temas que BlockService fija a mano en cada rutina: si faltaran en la lista,
  // el bloque pediría puzzles de un tema que el plan declara no permitido.
  it.each([
    ['plan10', ['mateIn1', 'endgame']],
    ['plan20', ['mateIn1', 'endgame', 'mateIn3']],
    ['plan30', ['endgame', 'pawnEndgame', 'mateIn4']],
  ] as const)('%s incluye los temas que sus bloques fijan: %j', (plan, requeridos) => {
    for (const tema of requeridos) {
      expect(PLAN_ALLOWED_THEMES[plan]).toContain(tema);
    }
  });

  it('las rutinas cortas siguen incluyendo los mates básicos', () => {
    expect(PLAN_ALLOWED_THEMES.plan3).toEqual(expect.arrayContaining(['mateIn1', 'mateIn2']));
    expect(PLAN_ALLOWED_THEMES.plan5).toEqual(expect.arrayContaining(['mateIn1', 'mateIn2', 'mateIn3']));
  });

  it('la rutina de 30 minutos queda para temas avanzados: sin mates de una jugada', () => {
    expect(PLAN_ALLOWED_THEMES.plan30).not.toContain('mateIn1');
    expect(PLAN_ALLOWED_THEMES.plan30).not.toContain('oneMove');
  });

  it('las rutinas largas ofrecen más temas que las cortas', () => {
    const cantidad = (plan: PlanTypes) => (PLAN_ALLOWED_THEMES[plan] as string[]).length;
    expect(cantidad('plan5')).toBeGreaterThan(cantidad('plan3'));
    expect(cantidad('plan10')).toBeGreaterThan(cantidad('plan5'));
    expect(cantidad('plan20')).toBeGreaterThan(cantidad('plan10'));
  });

  it('las rutinas sin lista (warmup, custom, infinity…) usan todos los temas', () => {
    expect(PLAN_ALLOWED_THEMES.custom).toBeUndefined();
    expect(PLAN_ALLOWED_THEMES.warmup).toBeUndefined();
  });
});
