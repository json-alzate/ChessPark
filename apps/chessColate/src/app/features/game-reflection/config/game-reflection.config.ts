import { ReflectionList } from '@features/game-reflection/models/game-reflection.model';

/** Cuántos tags admite cada lista. */
export const REFLECTION_LIMITS: Record<ReflectionList, number> = {
  best: 2,
  improve: 3,
};

/** Largo máximo del nombre de un tag propio: tiene que ser corto para poder agrupar. */
export const TAG_LABEL_MAX_LENGTH = 20;

/** Prefijo de los ids de tags propios; los del sistema no lo llevan. */
export const CUSTOM_TAG_PREFIX = 'u_';

/**
 * Tags que se sugieren a todos. El texto sale de `GAME_REFLECTION.systemTags.<clave>`
 * en las traducciones; en las reflexiones solo se guarda la clave.
 */
export const SYSTEM_TAG_KEYS: readonly string[] = [
  'dynamism',
  'tactics',
  'endgames',
  'openings',
  'checks',
  'calculation',
  'king_safety',
  'piece_activity',
  'time_management',
  'patience',
  'converting_advantage',
  'defense',
];
