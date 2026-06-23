/**
 * Presentación estática del menú de entrenamiento.
 *
 * Mapea cada plan (1, 3, 5, 10, 20, 30 minutos) a la nomenclatura estándar de
 * ajedrez (bullet / blitz / rápida / clásica) y describe las fases que entrena,
 * derivadas de la estructura real generada en `block.service.ts`
 * (`generateBlocksForPlan`).
 *
 * Las fases reales se generan dinámicamente según las debilidades del usuario al
 * crear el plan; aquí solo se describe la estructura para comunicar el valor.
 */

export type ChessTimeCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface TrainingPlanPreset {
  /** Minutos del plan; coincide con el PlanType `plan{N}`. */
  plan: 1 | 3 | 5 | 10 | 20 | 30;
  /** Categoría estándar de ajedrez (clave i18n en `TRAINING.categories.*`). */
  category: ChessTimeCategory;
  /** Duración en minutos. */
  minutes: number;
  /** Clave i18n con una descripción breve de la rutina. */
  summaryKey: string;
  /** Claves i18n que describen cada fase de la rutina. */
  phaseKeys: string[];
}

/** Icono Ionic por categoría (refuerza el lenguaje estándar, sin assets nuevos). */
export const CATEGORY_ICON: Record<ChessTimeCategory, string> = {
  bullet: 'flash-outline',
  blitz: 'flame-outline',
  rapid: 'speedometer-outline',
  classical: 'hourglass-outline',
};

export const TRAINING_PLAN_PRESETS: TrainingPlanPreset[] = [
  {
    plan: 1,
    category: 'bullet',
    minutes: 1,
    summaryKey: 'TRAINING.plans.plan1.summary',
    phaseKeys: ['TRAINING.plans.plan1.phases.p1'],
  },
  {
    plan: 3,
    category: 'blitz',
    minutes: 3,
    summaryKey: 'TRAINING.plans.plan3.summary',
    phaseKeys: ['TRAINING.plans.plan3.phases.p1'],
  },
  {
    plan: 5,
    category: 'blitz',
    minutes: 5,
    summaryKey: 'TRAINING.plans.plan5.summary',
    phaseKeys: ['TRAINING.plans.plan5.phases.p1', 'TRAINING.plans.plan5.phases.p2'],
  },
  {
    plan: 10,
    category: 'rapid',
    minutes: 10,
    summaryKey: 'TRAINING.plans.plan10.summary',
    phaseKeys: [
      'TRAINING.plans.plan10.phases.p1',
      'TRAINING.plans.plan10.phases.p2',
      'TRAINING.plans.plan10.phases.p3',
      'TRAINING.plans.plan10.phases.p4',
    ],
  },
  {
    plan: 20,
    category: 'rapid',
    minutes: 20,
    summaryKey: 'TRAINING.plans.plan20.summary',
    phaseKeys: [
      'TRAINING.plans.plan20.phases.p1',
      'TRAINING.plans.plan20.phases.p2',
      'TRAINING.plans.plan20.phases.p3',
      'TRAINING.plans.plan20.phases.p4',
      'TRAINING.plans.plan20.phases.p5',
      'TRAINING.plans.plan20.phases.p6',
    ],
  },
  {
    plan: 30,
    category: 'classical',
    minutes: 30,
    summaryKey: 'TRAINING.plans.plan30.summary',
    phaseKeys: [
      'TRAINING.plans.plan30.phases.p1',
      'TRAINING.plans.plan30.phases.p2',
      'TRAINING.plans.plan30.phases.p3',
      'TRAINING.plans.plan30.phases.p4',
      'TRAINING.plans.plan30.phases.p5',
      'TRAINING.plans.plan30.phases.p6',
    ],
  },
];
