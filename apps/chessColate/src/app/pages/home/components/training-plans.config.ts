/**
 * Presentación estática del menú de entrenamiento.
 *
 * Mapea cada plan (1, 3, 5, 10, 20, 30 minutos) a la nomenclatura estándar de
 * ajedrez (bullet / blitz / rápida / clásica) y describe sus bloques.
 *
 * La duración de cada bloque refleja la estructura REAL generada en
 * `block.service.ts` (`generateBlocksForPlan`): `seconds` = el campo `time` de
 * cada bloque (duración real, determinista).
 *
 * El tema concreto de cada bloque se elige dinámicamente al crear el plan según
 * las debilidades del usuario; aquí solo se comunica la estructura.
 */

import { PlanTypes } from '@cpark/models';

export type ChessTimeCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

/** Icono Ionic por categoría (refuerza el lenguaje estándar, sin assets nuevos). */
export const CATEGORY_ICON: Record<ChessTimeCategory, string> = {
  bullet: 'flash-outline',
  blitz: 'flame-outline',
  rapid: 'speedometer-outline',
  classical: 'hourglass-outline',
};

/**
 * Cada plan tiene su propio "animalito" (imagen) como identificador visual.
 * Es el mejor diferenciador: una ilustración única por rutina.
 */
const PLAN_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'plan1',
  'plan3',
  'plan5',
  'plan10',
  'plan20',
  'plan30',
  'warmup',
  'backToCalm',
  'custom',
]);

/** Ruta del animalito para un tipo de plan; cae a `custom` si no tiene imagen. */
export function planImage(planType: PlanTypes): string {
  const name = PLAN_IMAGE_TYPES.has(planType) ? planType : 'custom';
  return `assets/images/plan-icons/${name}.png`;
}

export interface TrainingBlockPreset {
  /** Clave i18n con el nombre del bloque. */
  labelKey: string;
  /** Duración real del bloque en segundos (campo `time` en block.service). */
  seconds: number;
}

export interface TrainingPlanPreset {
  /** Minutos del plan; coincide con el PlanType `plan{N}`. */
  plan: 1 | 3 | 5 | 10 | 20 | 30;
  /** Categoría estándar de ajedrez (define el icono; clave i18n en `TRAINING.categories.*`). */
  category: ChessTimeCategory;
  /** Título único de la tarjeta (clave i18n); evita repetir categorías entre planes. */
  titleKey: string;
  /** Duración en minutos. */
  minutes: number;
  /** Clave i18n resaltada al inicio de la descripción. */
  leadKey: string;
  /** Clave i18n con el resto de la descripción breve. */
  summaryKey: string;
  /** Bloques de la rutina, en orden. */
  blocks: TrainingBlockPreset[];
}

export const TRAINING_PLAN_PRESETS: TrainingPlanPreset[] = [
  {
    plan: 1,
    category: 'bullet',
    titleKey: 'TRAINING.plans.plan1.title',
    minutes: 1,
    leadKey: 'TRAINING.plans.plan1.lead',
    summaryKey: 'TRAINING.plans.plan1.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan1.phases.p1', seconds: 60 },
    ],
  },
  {
    plan: 3,
    category: 'blitz',
    titleKey: 'TRAINING.plans.plan3.title',
    minutes: 3,
    leadKey: 'TRAINING.plans.plan3.lead',
    summaryKey: 'TRAINING.plans.plan3.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan3.phases.p1', seconds: 180 },
    ],
  },
  {
    plan: 5,
    category: 'blitz',
    titleKey: 'TRAINING.plans.plan5.title',
    minutes: 5,
    leadKey: 'TRAINING.plans.plan5.lead',
    summaryKey: 'TRAINING.plans.plan5.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan5.phases.p1', seconds: 150 },
      { labelKey: 'TRAINING.plans.plan5.phases.p2', seconds: 150 },
    ],
  },
  {
    plan: 10,
    category: 'rapid',
    titleKey: 'TRAINING.plans.plan10.title',
    minutes: 10,
    leadKey: 'TRAINING.plans.plan10.lead',
    summaryKey: 'TRAINING.plans.plan10.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan10.phases.p1', seconds: 120 },
      { labelKey: 'TRAINING.plans.plan10.phases.p2', seconds: 180 },
      { labelKey: 'TRAINING.plans.plan10.phases.p3', seconds: 120 },
      { labelKey: 'TRAINING.plans.plan10.phases.p4', seconds: 180 },
    ],
  },
  {
    plan: 20,
    category: 'rapid',
    titleKey: 'TRAINING.plans.plan20.title',
    minutes: 20,
    leadKey: 'TRAINING.plans.plan20.lead',
    summaryKey: 'TRAINING.plans.plan20.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan20.phases.p1', seconds: 180 },
      { labelKey: 'TRAINING.plans.plan20.phases.p2', seconds: 240 },
      { labelKey: 'TRAINING.plans.plan20.phases.p3', seconds: 120 },
      { labelKey: 'TRAINING.plans.plan20.phases.p4', seconds: 300 },
      { labelKey: 'TRAINING.plans.plan20.phases.p5', seconds: 180 },
      { labelKey: 'TRAINING.plans.plan20.phases.p6', seconds: 180 },
    ],
  },
  {
    plan: 30,
    category: 'classical',
    titleKey: 'TRAINING.plans.plan30.title',
    minutes: 30,
    leadKey: 'TRAINING.plans.plan30.lead',
    summaryKey: 'TRAINING.plans.plan30.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan30.phases.p1', seconds: 240 },
      { labelKey: 'TRAINING.plans.plan30.phases.p2', seconds: 360 },
      { labelKey: 'TRAINING.plans.plan30.phases.p3', seconds: 180 },
      { labelKey: 'TRAINING.plans.plan30.phases.p4', seconds: 480 },
      { labelKey: 'TRAINING.plans.plan30.phases.p5', seconds: 240 },
      { labelKey: 'TRAINING.plans.plan30.phases.p6', seconds: 300 },
    ],
  },
];
