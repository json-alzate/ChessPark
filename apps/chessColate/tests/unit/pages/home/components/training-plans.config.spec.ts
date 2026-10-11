import { PlanTypes } from '@chesspark/models';

import {
  CATEGORY_ICON,
  planImage,
  TRAINING_PLAN_PRESETS,
} from '@pages/home/components/training-plans.config';
import { PLAN_BLOCK_SPECS } from '@services/plans/plan-blocks.config';
import { routineMetaFromPlanType } from '@core/analytics/analytics-events.util';

/**
 * La tabla de planes del menú es presentación estática: promete al usuario
 * cuánto dura cada rutina y qué bloques tiene. Estas pruebas la cruzan con lo
 * que de verdad genera `BlockService` (PLAN_BLOCK_SPECS), con las traducciones
 * y con los assets, porque un desajuste no rompe nada visible hasta que alguien
 * lo nota en pantalla.
 */

// El tsconfig de pruebas solo declara los tipos de jest (sin @types/node): se
// declaran aquí las tres piezas de Node que hacen falta para leer archivos.
declare const __dirname: string;
declare const require: (modulo: string) => any;
const { existsSync, readFileSync } = require('fs') as {
  existsSync(ruta: string): boolean;
  readFileSync(ruta: string, codificacion: string): string;
};
const { join } = require('path') as { join(...partes: string[]): string };

const RAIZ_SRC = join(__dirname, '../../../../../src');

function leerTraducciones(idioma: 'es' | 'en'): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(RAIZ_SRC, 'assets/i18n', `${idioma}.json`), 'utf-8')
  );
}

/** Resuelve una clave con puntos ('TRAINING.plans.plan1.title') dentro del JSON. */
function buscarClave(traducciones: Record<string, unknown>, clave: string): unknown {
  return clave
    .split('.')
    .reduce<unknown>(
      (nodo, parte) =>
        nodo && typeof nodo === 'object'
          ? (nodo as Record<string, unknown>)[parte]
          : undefined,
      traducciones
    );
}

describe('training-plans.config', () => {
  describe('TRAINING_PLAN_PRESETS', () => {
    it('ofrece los seis planes del menú, de menor a mayor duración', () => {
      expect(TRAINING_PLAN_PRESETS.map((p) => p.plan)).toEqual([1, 3, 5, 10, 20, 30]);
    });

    it('los minutos de cada tarjeta coinciden con el número del plan', () => {
      for (const preset of TRAINING_PLAN_PRESETS) {
        expect(preset.minutes).toBe(preset.plan);
      }
    });

    it.each(TRAINING_PLAN_PRESETS.map((p) => [p.plan, p] as const))(
      'plan %i: la suma de sus bloques es exactamente su duración anunciada',
      (_plan, preset) => {
        const segundos = preset.blocks.reduce((total, b) => total + b.seconds, 0);

        expect(segundos).toBe(preset.minutes * 60);
      }
    );

    it.each(TRAINING_PLAN_PRESETS.map((p) => [p.plan, p] as const))(
      'plan %i: sus bloques duran lo mismo que los que genera BlockService',
      (_plan, preset) => {
        const real = PLAN_BLOCK_SPECS[`plan${preset.plan}` as PlanTypes];

        expect(real).toBeDefined();
        expect(preset.blocks.map((b) => b.seconds)).toEqual(
          real?.blocks.map((b) => b.time)
        );
      }
    );

    it.each(TRAINING_PLAN_PRESETS.map((p) => [p.plan, p] as const))(
      'plan %i: su categoría coincide con la que usa analítica para ese plan',
      (_plan, preset) => {
        expect(routineMetaFromPlanType(`plan${preset.plan}`).category).toBe(
          preset.category
        );
      }
    );

    it('cada categoría tiene su icono y los iconos son distintos', () => {
      for (const preset of TRAINING_PLAN_PRESETS) {
        expect(CATEGORY_ICON[preset.category]).toEqual(expect.any(String));
      }
      const iconos = Object.values(CATEGORY_ICON);
      expect(new Set(iconos).size).toBe(iconos.length);
    });

    it('cada plan tiene un título distinto (no se repiten tarjetas)', () => {
      const titulos = TRAINING_PLAN_PRESETS.map((p) => p.titleKey);

      expect(new Set(titulos).size).toBe(titulos.length);
    });

    it('todos los bloques tienen una duración positiva y una etiqueta propia', () => {
      for (const preset of TRAINING_PLAN_PRESETS) {
        for (const bloque of preset.blocks) {
          expect(bloque.seconds).toBeGreaterThan(0);
          expect(bloque.labelKey).toContain(`plan${preset.plan}.phases.`);
        }
      }
    });

    it.each(['es', 'en'] as const)(
      'todas las claves de texto existen y no están vacías en %s',
      (idioma) => {
        const traducciones = leerTraducciones(idioma);
        const faltantes: string[] = [];

        for (const preset of TRAINING_PLAN_PRESETS) {
          const claves = [
            preset.titleKey,
            preset.leadKey,
            preset.summaryKey,
            ...preset.blocks.map((b) => b.labelKey),
          ];
          for (const clave of claves) {
            const valor = buscarClave(traducciones, clave);
            if (typeof valor !== 'string' || valor.trim() === '') {
              faltantes.push(clave);
            }
          }
        }

        expect(faltantes).toEqual([]);
      }
    );
  });

  describe('planImage', () => {
    it.each(['plan1', 'plan3', 'plan5', 'plan10', 'plan20', 'plan30', 'warmup', 'backToCalm', 'custom'] as PlanTypes[])(
      'devuelve la imagen propia de %s y el archivo existe',
      (plan) => {
        const ruta = planImage(plan);

        expect(ruta).toBe(`assets/images/plan-icons/${plan}.png`);
        expect(existsSync(join(RAIZ_SRC, ruta))).toBe(true);
      }
    );

    it.each(['infinity', 'reto333'] as PlanTypes[])(
      'un plan sin imagen propia (%s) usa la de "custom"',
      (plan) => {
        expect(planImage(plan)).toBe('assets/images/plan-icons/custom.png');
      }
    );

    it('cada tarjeta del menú tiene su animalito', () => {
      for (const preset of TRAINING_PLAN_PRESETS) {
        const ruta = planImage(`plan${preset.plan}` as PlanTypes);

        expect(ruta).not.toContain('custom');
      }
    });
  });
});
