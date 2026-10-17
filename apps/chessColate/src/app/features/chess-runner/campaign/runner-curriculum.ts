/**
 * El currículo del Chess Runner: una lista de patrones tácticos que se aprenden de uno en uno. Cada capítulo es un
 * patrón (el tema del catálogo de ejercicios), tiene su mundo y regala un poder a quien lo domina. El orden va de lo
 * más visual (una pieza sin defensa) a lo más fino (un mate preparado), pensado para que cada patrón se apoye en el
 * anterior.
 *
 * Los ejercicios de un capítulo son SIEMPRE del mismo tema: repetir un patrón seguido, con la dificultad subiendo, es
 * lo que lo graba; cambiar de tema en cada ejercicio lo diluye.
 */

/** Los mundos por los que pasa la historia. El escenario cambia de tono con cada uno. */
export const WORLDS = ['day', 'sunset', 'night', 'mist', 'dawn', 'storm'] as const;
export type RunnerWorld = (typeof WORLDS)[number];

/** Poderes del perrito: pasivos, uno por patrón dominado (ver `powers/`). */
export const POWER_IDS = [
  'nose',
  'spring',
  'shield',
  'trail',
  'ghost',
  'heart',
  'net',
  'dodge',
  'cloak',
  'crown',
] as const;
export type RunnerPowerId = (typeof POWER_IDS)[number];

export interface RunnerChapter {
  /** Tema del catálogo de ejercicios (`libs/puzzles-provider`). */
  theme: string;
  world: RunnerWorld;
  /** Lo que gana el perrito al dominar el patrón; los capítulos intermedios solo dan estrellas y avanzan el frasco. */
  power: RunnerPowerId | null;
}

/**
 * Los veinte capítulos de una ronda. Van de lo más visual (una pieza sin defensa, un mate de una jugada) a lo más fino
 * (los rayos X, la jugada intermedia, los mates con patrón, el mate en dos). Cada dos capítulos el perrito gana un poder, y el último
 * guardián es el rey. Al terminar empieza otra ronda con los mismos patrones, más difíciles.
 */
export const CHAPTERS: readonly RunnerChapter[] = [
  { theme: 'hangingPiece', world: 'day', power: null },
  { theme: 'mateIn1', world: 'day', power: 'nose' },
  { theme: 'fork', world: 'day', power: null },
  { theme: 'pin', world: 'day', power: 'spring' },
  { theme: 'skewer', world: 'sunset', power: null },
  { theme: 'backRankMate', world: 'sunset', power: 'shield' },
  { theme: 'discoveredAttack', world: 'sunset', power: null },
  { theme: 'capturingDefender', world: 'sunset', power: 'trail' },
  { theme: 'deflection', world: 'night', power: null },
  { theme: 'attraction', world: 'night', power: 'ghost' },
  { theme: 'doubleCheck', world: 'night', power: null },
  { theme: 'trappedPiece', world: 'night', power: 'dodge' },
  { theme: 'xRayAttack', world: 'mist', power: null },
  { theme: 'arabianMate', world: 'mist', power: 'heart' },
  { theme: 'anastasiaMate', world: 'mist', power: null },
  { theme: 'intermezzo', world: 'dawn', power: 'net' },
  { theme: 'bodenMate', world: 'dawn', power: null },
  { theme: 'hookMate', world: 'dawn', power: 'cloak' },
  { theme: 'smotheredMate', world: 'storm', power: null },
  { theme: 'mateIn2', world: 'storm', power: 'crown' },
];

/** Ejercicios que se resuelven en un capítulo antes de pasar al siguiente. El último es el del guardián. */
export const BLOCK_SIZE = 5;
/**
 * Cuánto se aparta el ELO del ejercicio del ELO del perrito en cada puesto del bloque: empieza suave y sube hasta el
 * guardián, que es el más duro. Resolver un ejercicio por encima de uno mismo sube más el ELO.
 */
export const BLOCK_ELO_OFFSETS: readonly number[] = [-200, -120, -40, 40, 140];
/** Lo que se baja el ELO por cada fallo dentro del bloque (hasta `MAX_FAIL_EASING` fallos). */
export const FAIL_ELO_EASING = 100;
export const MAX_FAIL_EASING = 2;
/** Ejercicios de repaso que siguen a cada capítulo terminado: del patrón que peor se tiene. */
export const REVIEW_SIZE = 2;
/** ELO relativo de un ejercicio de repaso. */
export const REVIEW_ELO_OFFSET = -100;

/** El ELO con el que arranca el perrito respecto al del usuario (empieza por debajo: gana confianza), y sus límites. */
export const START_RATING_OFFSET = -300;
export const MIN_START_RATING = 600;
export const MAX_START_RATING = 1500;
/** Tope del ELO del perrito. */
export const MAX_RATING = 2600;
/** Los ELO que tiene el catálogo de ejercicios: lo que se pide nunca se sale de ahí. */
export const CATALOG_MIN_ELO = 400;
export const CATALOG_MAX_ELO = 2800;
/** Factor K del cálculo del ELO: más alto al principio, para que se note el avance, y más bajo después. */
export const RATING_K_EARLY = 32;
export const RATING_K = 24;
/** Ejercicios jugados tras los que el factor K pasa a ser el normal. */
export const RATING_EARLY_PUZZLES = 30;

export function chapterOf(index: number): RunnerChapter {
  return CHAPTERS[Math.min(Math.max(index, 0), CHAPTERS.length - 1)];
}

/** El mundo del capítulo. */
export function worldOfChapter(index: number): RunnerWorld {
  return chapterOf(index).world;
}

/** Los poderes, en el orden en que se ganan. */
export const POWER_CHAPTERS: readonly number[] = CHAPTERS.flatMap((chapter, index) => (chapter.power ? [index] : []));
