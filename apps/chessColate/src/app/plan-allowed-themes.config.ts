import { PlanTypes } from '@cpark/models';

/**
 * Temas permitidos por plan por defecto.
 * Solo se usan valores que existan en assets/data/themes-puzzle.json.
 * Si un plan no está definido o tiene array vacío, se usa la lista completa de temas.
 */
export const PLAN_ALLOWED_THEMES: Partial<Record<PlanTypes, string[]>> = {
  // plan3: ['endgame', 'middlegame', 'fork', ...],
  // plan5: ['mateIn1', 'mateIn2', 'short', ...],
  // plan10: [...],
  // plan20: [...],
  // plan30: [...]
};
