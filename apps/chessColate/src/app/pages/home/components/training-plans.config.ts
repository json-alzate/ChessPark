/**
 * Presentación estática del menú de entrenamiento.
 *
 * Mapea cada plan (1, 3, 5, 10, 20, 30 minutos) a la nomenclatura estándar de
 * ajedrez (bullet / blitz / rápida / clásica) y describe sus bloques.
 *
 * Los datos de cada bloque (duración e intensidad) reflejan la estructura REAL
 * generada en `block.service.ts` (`generateBlocksForPlan`):
 *  - `seconds`   → el campo `time` de cada bloque (duración real, determinista).
 *  - `intensity` → la curva de engagement descrita en cada plan
 *                  (calentamiento → intensidad → velocidad → pico → enfriamiento).
 *
 * El tema concreto de cada bloque se elige dinámicamente al crear el plan según
 * las debilidades del usuario; aquí solo se comunica la estructura y el valor.
 */

export type ChessTimeCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

/** Icono Ionic por categoría (refuerza el lenguaje estándar, sin assets nuevos). */
export const CATEGORY_ICON: Record<ChessTimeCategory, string> = {
  bullet: 'flash-outline',
  blitz: 'flame-outline',
  rapid: 'speedometer-outline',
  classical: 'hourglass-outline',
};

/**
 * Paleta por bloque (cálido → frío), alineada con el tema halloween.
 * Se asigna por posición y se reutiliza en el punto de la lista y en el tramo
 * correspondiente de la línea de intensidad.
 */
export const BLOCK_COLORS = ['#f28c18', '#e8a857', '#6d3a9c'];

export interface TrainingBlockPreset {
  /** Clave i18n con el nombre del bloque. */
  labelKey: string;
  /** Duración real del bloque en segundos (campo `time` en block.service). */
  seconds: number;
  /** Intensidad relativa del bloque (0..1), curva de engagement del plan. */
  intensity: number;
}

export interface TrainingPlanPreset {
  /** Minutos del plan; coincide con el PlanType `plan{N}`. */
  plan: 1 | 3 | 5 | 10 | 20 | 30;
  /** Categoría estándar de ajedrez (clave i18n en `TRAINING.categories.*`). */
  category: ChessTimeCategory;
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
    minutes: 1,
    leadKey: 'TRAINING.plans.plan1.lead',
    summaryKey: 'TRAINING.plans.plan1.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan1.phases.p1', seconds: 60, intensity: 0.6 },
    ],
  },
  {
    plan: 3,
    category: 'blitz',
    minutes: 3,
    leadKey: 'TRAINING.plans.plan3.lead',
    summaryKey: 'TRAINING.plans.plan3.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan3.phases.p1', seconds: 180, intensity: 0.7 },
    ],
  },
  {
    plan: 5,
    category: 'blitz',
    minutes: 5,
    leadKey: 'TRAINING.plans.plan5.lead',
    summaryKey: 'TRAINING.plans.plan5.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan5.phases.p1', seconds: 150, intensity: 0.45 },
      { labelKey: 'TRAINING.plans.plan5.phases.p2', seconds: 150, intensity: 0.8 },
    ],
  },
  {
    plan: 10,
    category: 'rapid',
    minutes: 10,
    leadKey: 'TRAINING.plans.plan10.lead',
    summaryKey: 'TRAINING.plans.plan10.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan10.phases.p1', seconds: 120, intensity: 0.35 },
      { labelKey: 'TRAINING.plans.plan10.phases.p2', seconds: 180, intensity: 0.75 },
      { labelKey: 'TRAINING.plans.plan10.phases.p3', seconds: 120, intensity: 0.95 },
      { labelKey: 'TRAINING.plans.plan10.phases.p4', seconds: 180, intensity: 0.7 },
    ],
  },
  {
    plan: 20,
    category: 'rapid',
    minutes: 20,
    leadKey: 'TRAINING.plans.plan20.lead',
    summaryKey: 'TRAINING.plans.plan20.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan20.phases.p1', seconds: 180, intensity: 0.35 },
      { labelKey: 'TRAINING.plans.plan20.phases.p2', seconds: 240, intensity: 0.7 },
      { labelKey: 'TRAINING.plans.plan20.phases.p3', seconds: 120, intensity: 0.95 },
      { labelKey: 'TRAINING.plans.plan20.phases.p4', seconds: 300, intensity: 1.0 },
      { labelKey: 'TRAINING.plans.plan20.phases.p5', seconds: 180, intensity: 0.8 },
      { labelKey: 'TRAINING.plans.plan20.phases.p6', seconds: 180, intensity: 0.4 },
    ],
  },
  {
    plan: 30,
    category: 'classical',
    minutes: 30,
    leadKey: 'TRAINING.plans.plan30.lead',
    summaryKey: 'TRAINING.plans.plan30.summary',
    blocks: [
      { labelKey: 'TRAINING.plans.plan30.phases.p1', seconds: 240, intensity: 0.35 },
      { labelKey: 'TRAINING.plans.plan30.phases.p2', seconds: 360, intensity: 0.7 },
      { labelKey: 'TRAINING.plans.plan30.phases.p3', seconds: 180, intensity: 0.9 },
      { labelKey: 'TRAINING.plans.plan30.phases.p4', seconds: 480, intensity: 1.0 },
      { labelKey: 'TRAINING.plans.plan30.phases.p5', seconds: 240, intensity: 0.75 },
      { labelKey: 'TRAINING.plans.plan30.phases.p6', seconds: 300, intensity: 0.4 },
    ],
  },
];
