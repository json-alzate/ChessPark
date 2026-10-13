import { PlanTypes } from '@chesspark/models';

import { PLAN_ALLOWED_THEMES } from '@features/training/config/plan-allowed-themes.config';
import {
  BlockSpec,
  PLAN_BLOCK_SPECS,
  PlanBlocksSpec,
} from '@features/training/config/plan-blocks.config';

/** Minutos que dura cada plan según su nombre (el nombre promete la duración). */
const MINUTES_BY_PLAN: Partial<Record<PlanTypes, number>> = {
  plan1: 1,
  plan3: 3,
  plan5: 5,
  plan10: 10,
  plan20: 20,
  plan30: 30,
};

/** Número de bloques que debe tener cada plan. */
const BLOCKS_BY_PLAN: Partial<Record<PlanTypes, number>> = {
  warmup: 3,
  plan1: 1,
  plan3: 1,
  plan5: 2,
  plan10: 4,
  plan20: 6,
  plan30: 6,
};

const entries = Object.entries(PLAN_BLOCK_SPECS) as [PlanTypes, PlanBlocksSpec][];

/** Un bloque con una de sus variantes aplicada (así lo arma BlockService). */
const resolved = (block: BlockSpec): BlockSpec[] =>
  block.variants ? block.variants.map((v) => ({ ...block, ...v })) : [block];

describe('PLAN_BLOCK_SPECS', () => {
  it('define exactamente los planes que se construyen desde la tabla', () => {
    expect(Object.keys(PLAN_BLOCK_SPECS).sort()).toEqual(
      ['plan1', 'plan10', 'plan20', 'plan3', 'plan30', 'plan5', 'warmup']
    );
  });

  it('no incluye los planes con reglas propias (infinity, backToCalm, reto333, custom)', () => {
    for (const plan of ['infinity', 'backToCalm', 'reto333', 'custom'] as PlanTypes[]) {
      expect(PLAN_BLOCK_SPECS[plan]).toBeUndefined();
    }
  });

  describe.each(entries)('plan %s', (plan, spec) => {
    it('tiene el número de bloques esperado', () => {
      expect(spec.blocks).toHaveLength(BLOCKS_BY_PLAN[plan] as number);
    });

    it('usa un modo de color válido', () => {
      expect(['side', 'random']).toContain(spec.color);
    });

    it('cada bloque tiene tiempo positivo o -1 (sin límite) y un número de puzzles >= 0', () => {
      for (const block of spec.blocks) {
        expect(block.time === -1 || block.time > 0).toBe(true);
        expect(Number.isInteger(block.puzzlesCount)).toBe(true);
        expect(block.puzzlesCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('ningún bloque puede quedar sin fin: sin tiempo ni cantidad de puzzles', () => {
      for (const block of spec.blocks) {
        expect(block.time === -1 && block.puzzlesCount === 0).toBe(false);
      }
    });

    it('los tiempos por puzzle son coherentes: total > aviso > peligro > 0', () => {
      for (const block of spec.blocks.flatMap(resolved)) {
        if (!block.puzzleTimes) continue;
        const { warningOn, dangerOn, total } = block.puzzleTimes;
        expect(dangerOn).toBeGreaterThan(0);
        expect(warningOn).toBeGreaterThan(dangerOn);
        expect(total).toBeGreaterThan(warningOn);
      }
    });

    it('un bloque con puzzles ilimitados (puzzlesCount 0) define tiempo por puzzle', () => {
      // Sin tiempo por puzzle y sin cantidad, el bloque solo terminaría con el reloj.
      for (const block of spec.blocks.flatMap(resolved)) {
        if (block.puzzlesCount === 0 && block.time > 0) {
          expect(block.puzzleTimes).toBeDefined();
        }
      }
    });

    it('el tiempo por puzzle cabe en el bloque', () => {
      for (const block of spec.blocks.flatMap(resolved)) {
        if (block.puzzleTimes && block.time > 0) {
          expect(block.puzzleTimes.total).toBeLessThanOrEqual(block.time);
        }
      }
    });

    it('el modo a ciegas no dura más que el puzzle', () => {
      for (const block of spec.blocks.flatMap(resolved)) {
        if (block.goshPuzzleTime !== undefined && block.puzzleTimes) {
          expect(block.goshPuzzleTime).toBeGreaterThan(0);
          expect(block.goshPuzzleTime).toBeLessThan(block.puzzleTimes.total);
        }
      }
    });

    it('las variantes son dos y cada una trae sus tiempos', () => {
      for (const block of spec.blocks) {
        if (!block.variants) continue;
        expect(block.variants).toHaveLength(2);
        block.variants.forEach((v) => expect(v.puzzleTimes).toBeDefined());
      }
    });

    it('cada regla de tema está completa y bien formada', () => {
      for (const { theme } of spec.blocks) {
        switch (theme.strategy) {
          case 'fixed':
            expect(theme.theme).toBeTruthy();
            break;
          case 'oneOf':
            expect(theme.themes.length).toBeGreaterThanOrEqual(2);
            expect(new Set(theme.themes).size).toBe(theme.themes.length);
            break;
          default:
            expect(['random', 'weakness', 'strongest']).toContain(theme.strategy);
        }
      }
    });

    it('los temas fijos o de lista pertenecen a los temas permitidos del plan', () => {
      const allowed = PLAN_ALLOWED_THEMES[plan];
      if (!allowed) return; // sin lista: se usan todos los temas
      for (const { theme } of spec.blocks) {
        if (theme.strategy === 'fixed') expect(allowed).toContain(theme.theme);
        if (theme.strategy === 'oneOf') theme.themes.forEach((t) => expect(allowed).toContain(t));
      }
    });

    it('las descripciones con clave de traducción apuntan a PUZZLES.modes.*', () => {
      for (const block of spec.blocks.flatMap(resolved)) {
        const rule = block.description;
        if (rule && 'key' in rule) expect(rule.key).toMatch(/^PUZZLES\.modes\.\w+$/);
        if (rule && 'text' in rule) expect(rule.text.length).toBeGreaterThan(0);
      }
    });

    it('si define themeDrawOrder, es una permutación de todos los bloques (sin huecos ni repetidos)', () => {
      if (!spec.themeDrawOrder) return;
      const sorted = [...spec.themeDrawOrder].sort((a, b) => a - b);
      expect(sorted).toEqual(spec.blocks.map((_, i) => i));
    });
  });

  describe('duración total', () => {
    it.each(Object.entries(MINUTES_BY_PLAN) as [PlanTypes, number][])(
      '%s suma exactamente %d minutos de bloques',
      (plan, minutes) => {
        const seconds = (PLAN_BLOCK_SPECS[plan] as PlanBlocksSpec).blocks.reduce(
          (sum, b) => sum + b.time,
          0
        );

        expect(seconds).toBe(minutes * 60);
      }
    );

    it('warmup dura 2 minutos cronometrados más un puzzle final sin límite', () => {
      const { blocks } = PLAN_BLOCK_SPECS['warmup'] as PlanBlocksSpec;

      expect(blocks.map((b) => b.time)).toEqual([60, 60, -1]);
      expect(blocks[2].puzzlesCount).toBe(1);
    });
  });

  describe('reglas por plan', () => {
    it('warmup progresa mateIn1 -> mateIn2 -> mate', () => {
      const themes = (PLAN_BLOCK_SPECS['warmup'] as PlanBlocksSpec).blocks.map((b) =>
        b.theme.strategy === 'fixed' ? b.theme.theme : b.theme.strategy
      );

      expect(themes).toEqual(['mateIn1', 'mateIn2', 'mate']);
    });

    it('los planes de un solo color (side) son todos menos plan20, que deja el color al puzzle', () => {
      const side = entries.filter(([, s]) => s.color === 'side').map(([p]) => p).sort();
      const random = entries.filter(([, s]) => s.color === 'random').map(([p]) => p);

      expect(random).toEqual(['plan20']);
      expect(side).toEqual(['plan1', 'plan10', 'plan3', 'plan30', 'plan5', 'warmup']);
    });

    it('plan5 combina un tema al azar (rechaza vacío) y uno de debilidad', () => {
      const { blocks } = PLAN_BLOCK_SPECS['plan5'] as PlanBlocksSpec;

      expect(blocks[0].theme).toEqual({ strategy: 'random', rejectIfEmpty: true });
      expect(blocks[1].theme).toEqual({ strategy: 'weakness' });
    });

    it('plan3 entrena el tema más fuerte', () => {
      const { blocks } = PLAN_BLOCK_SPECS['plan3'] as PlanBlocksSpec;

      expect(blocks[0].theme).toEqual({ strategy: 'strongest' });
    });

    it('plan30 sortea los temas en orden propio y cierra con un final de peones o de torre y peón', () => {
      const spec = PLAN_BLOCK_SPECS['plan30'] as PlanBlocksSpec;

      expect(spec.themeDrawOrder).toEqual([0, 1, 3, 4, 2, 5]);
      expect(spec.blocks[5].theme).toEqual({
        strategy: 'oneOf',
        themes: ['endgame', 'pawnEndgame'],
      });
    });

    it('plan20 sortea al 50 % entre un desafío a ciegas y uno normal', () => {
      const challenge = (PLAN_BLOCK_SPECS['plan20'] as PlanBlocksSpec).blocks[4];

      expect(challenge.variants?.[0].goshPuzzleTime).toBe(10);
      expect(challenge.variants?.[1].goshPuzzleTime).toBeUndefined();
    });

    it('solo el plan30 y el desafío del plan20 usan el modo a ciegas', () => {
      const blind = entries
        .filter(([, s]) =>
          s.blocks.flatMap(resolved).some((b) => b.goshPuzzleTime !== undefined)
        )
        .map(([p]) => p)
        .sort();

      expect(blind).toEqual(['plan20', 'plan30']);
    });

    it('las rutinas de 10 minutos o más muestran la solución en todos sus bloques', () => {
      for (const plan of ['plan10', 'plan20', 'plan30'] as PlanTypes[]) {
        for (const block of (PLAN_BLOCK_SPECS[plan] as PlanBlocksSpec).blocks.flatMap(resolved)) {
          expect(block.showPuzzleSolution).toBe(true);
        }
      }
    });

    it('las rutinas cortas (plan1, plan3, plan5) no muestran la solución', () => {
      for (const plan of ['plan1', 'plan3', 'plan5'] as PlanTypes[]) {
        for (const block of (PLAN_BLOCK_SPECS[plan] as PlanBlocksSpec).blocks) {
          expect(block.showPuzzleSolution).toBeUndefined();
        }
      }
    });
  });
});
