import { PlanTypes } from '@cpark/models';

/**
 * Configuración declarativa de los bloques que genera BlockService para cada plan.
 *
 * Cada plan se describe como una lista de bloques en el orden en que se muestran.
 * Los tiempos están en segundos. Un tiempo de -1 significa sin límite.
 *
 * Nota: si el tiempo del puzzle es mayor que el tiempo del bloque, el tiempo restante
 * para el puzzle se convierte en el tiempo restante del bloque.
 */

/**
 * Cómo se elige el tema de un bloque.
 * - fixed: tema literal, no consume Math.random.
 * - random: tema al azar entre los temas permitidos del plan.
 * - weakness: tema con el ELO más bajo del usuario en el plan. Si el usuario no tiene
 *   elos de ese plan, cae a un tema al azar.
 * - strongest: tema con el ELO más alto del usuario en el plan. Si no hay elos, cae a un tema al azar.
 * - oneOf: tema al azar entre la lista indicada (no se filtra por temas permitidos).
 */
export type ThemeRule =
  | { strategy: 'fixed'; theme: string }
  | { strategy: 'random'; rejectIfEmpty?: boolean }
  | { strategy: 'weakness' }
  | { strategy: 'strongest' }
  | { strategy: 'oneOf'; themes: string[] };

/**
 * Texto de descripción que se muestra en el bloque.
 * - side: solo el nombre del color del bloque ("Blancas" o "Negras").
 * - key: traducción de la clave. Si withSide es true, se añade el nombre del color al final.
 * - text: texto literal, sin traducir.
 */
export type DescriptionRule =
  | { side: true }
  | { key: string; withSide?: boolean }
  | { text: string };

/** Tiempos de cada puzzle del bloque, en segundos. */
export interface PuzzleTimesSpec {
  /** Momento en el que se avisa que el puzzle se acaba. */
  warningOn: number;
  /** Momento en el que el puzzle entra en zona de peligro. */
  dangerOn: number;
  /** Tiempo total del puzzle. */
  total: number;
}

/** Configuración de un bloque dentro de un plan. */
export interface BlockSpec {
  /** Duración del bloque en segundos (-1 = sin límite). */
  time: number;
  /** Número de puzzles del bloque (0 = hasta que se acabe el tiempo). */
  puzzlesCount: number;
  /** Cómo se elige el tema del bloque. */
  theme: ThemeRule;
  /** Descripción del bloque que se muestra al usuario. */
  description?: DescriptionRule;
  /** Tiempos por puzzle. Si no se indica, el bloque no define tiempos por puzzle. */
  puzzleTimes?: PuzzleTimesSpec;
  /** Modo "a ciegas": el puzzle se oculta durante estos segundos. */
  goshPuzzleTime?: number;
  /** Si el bloque muestra la solución al terminar cada puzzle. */
  showPuzzleSolution?: boolean;
  /** Si el siguiente puzzle aparece sin esperar. */
  nextPuzzleImmediately?: boolean;
  /**
   * Variantes que se sortean al 50 % al construir el bloque. Cada variante
   * sobrescribe los campos del bloque base. El tema del bloque base se sortea
   * antes de elegir la variante.
   */
  variants?: [Partial<BlockSpec>, Partial<BlockSpec>];
}

/** Configuración completa de un plan de entrenamiento. */
export interface PlanBlocksSpec {
  /**
   * 'side': todo el plan usa un solo color (blancas o negras), elegido al azar al empezar.
   * 'random': cada bloque usa 'random' como color y el puzzle decide el color.
   */
  color: 'side' | 'random';
  /**
   * Orden en que se sortean los temas, como índices de `blocks`.
   * Si no se indica, se sortean en el orden de la lista.
   * Se mantiene para conservar la secuencia de Math.random de cada plan.
   */
  themeDrawOrder?: number[];
  /** Bloques del plan, en el orden en que se muestran. */
  blocks: BlockSpec[];
}

/**
 * Planes que se construyen desde esta tabla.
 * Los planes infinity, backToCalm y reto333 tienen reglas propias y se
 * construyen en BlockService.
 */
export const PLAN_BLOCK_SPECS: Partial<Record<PlanTypes, PlanBlocksSpec>> = {
  /**
   * Calentamiento: un mismo color, un minuto de mates en 1, un minuto de mates en 2
   * y un último puzzle de mate.
   */
  warmup: {
    color: 'side',
    blocks: [
      {
        time: 60,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'mateIn1' },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        time: 60,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'mateIn2' },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        time: -1,
        puzzlesCount: 1,
        theme: { strategy: 'fixed', theme: 'mate' },
        showPuzzleSolution: true,
      },
    ],
  },

  /**
   * Plan 1: un minuto de mates en 1 (short), un mismo color y sin mostrar la solución.
   */
  plan1: {
    color: 'side',
    blocks: [
      {
        time: 60,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'short' },
        description: { side: true },
        puzzleTimes: { warningOn: 6, dangerOn: 3, total: 10 },
        nextPuzzleImmediately: true,
      },
    ],
  },

  /**
   * Plan 3: tres minutos del tema en el que el usuario es más fuerte.
   * Un mismo color y sin mostrar la solución.
   */
  plan3: {
    color: 'side',
    blocks: [
      {
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'strongest' },
        description: { side: true },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        nextPuzzleImmediately: true,
      },
    ],
  },

  /**
   * Plan 5: dos bloques de 2.5 minutos con un mismo color, sin mostrar la solución.
   * - Tema al azar, con 15 segundos por puzzle.
   * - Tema de debilidad (ELO más bajo), con 30 segundos por puzzle.
   */
  plan5: {
    color: 'side',
    blocks: [
      {
        time: 150,
        puzzlesCount: 0,
        theme: { strategy: 'random', rejectIfEmpty: true },
        description: { key: 'PUZZLES.modes.randomThemeWith', withSide: true },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 15 },
        nextPuzzleImmediately: true,
      },
      {
        time: 150,
        puzzlesCount: 0,
        theme: { strategy: 'weakness' },
        description: { key: 'PUZZLES.modes.weaknessWith', withSide: true },
        puzzleTimes: { warningOn: 24, dangerOn: 12, total: 30 },
        nextPuzzleImmediately: true,
      },
    ],
  },

  /**
   * Plan 10 (10 minutos, 4 bloques): calentamiento, intensidad, velocidad y desafío.
   * Un mismo color y se muestra la solución.
   */
  plan10: {
    color: 'side',
    blocks: [
      {
        // Calentamiento (2 min): entrada suave
        time: 120,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Intensidad (3 min): enfoque en debilidades
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'weakness' },
        description: { key: 'PUZZLES.modes.weaknessWith', withSide: true },
        puzzleTimes: { warningOn: 18, dangerOn: 9, total: 30 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Velocidad (2 min): mates en 1 rápidos
        time: 120,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'mateIn1' },
        puzzleTimes: { warningOn: 6, dangerOn: 3, total: 10 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Desafío (3 min): satisfacción final
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 40, dangerOn: 20, total: 60 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
    ],
  },

  /**
   * Plan 20 (20 minutos, 6 bloques): calentamiento, intensidad, velocidad, pico,
   * desafío y enfriamiento. Cada puzzle elige su color.
   */
  plan20: {
    color: 'random',
    blocks: [
      {
        // Calentamiento (3 min): entrada suave
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 15, dangerOn: 8, total: 25 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Intensidad (4 min): enfoque en debilidades
        time: 240,
        puzzlesCount: 0,
        theme: { strategy: 'weakness' },
        description: { key: 'PUZZLES.modes.weaknessWithAnyColor' },
        puzzleTimes: { warningOn: 18, dangerOn: 9, total: 30 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Velocidad (2 min): mates en 1 rápidos
        time: 120,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'mateIn1' },
        puzzleTimes: { warningOn: 6, dangerOn: 3, total: 10 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Pico (5 min): satisfacción máxima
        time: 300,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 40, dangerOn: 20, total: 60 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Desafío (3 min): 50 % a ciegas y 50 % con tema al azar
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        variants: [
          {
            description: { key: 'PUZZLES.modes.sameOpeningRandomThemeBlind' },
            puzzleTimes: { warningOn: 10, dangerOn: 5, total: 15 },
            goshPuzzleTime: 10,
            nextPuzzleImmediately: true,
            showPuzzleSolution: true,
          },
          {
            description: { key: 'PUZZLES.modes.sameRandomTheme' },
            puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
            nextPuzzleImmediately: true,
            showPuzzleSolution: true,
          },
        ],
      },
      {
        // Enfriamiento (3 min): cierre relajado con finales
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'fixed', theme: 'endgame' },
        puzzleTimes: { warningOn: 30, dangerOn: 15, total: 50 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
    ],
  },

  /**
   * Plan 30 (30 minutos, 6 bloques): calentamiento, intensidad, velocidad, pico,
   * desafío y enfriamiento. Un mismo color para todo el plan.
   *
   * El orden de sorteo es: calentamiento, intensidad, pico, desafío, velocidad y enfriamiento.
   * Se mantiene así para conservar la secuencia de Math.random.
   */
  plan30: {
    color: 'side',
    themeDrawOrder: [0, 1, 3, 4, 2, 5],
    blocks: [
      {
        // Calentamiento (4 min): entrada suave
        time: 240,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 18, dangerOn: 9, total: 30 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Intensidad (6 min): enfoque en debilidades
        time: 360,
        puzzlesCount: 0,
        theme: { strategy: 'weakness' },
        description: { key: 'PUZZLES.modes.weaknessWith', withSide: true },
        puzzleTimes: { warningOn: 40, dangerOn: 20, total: 60 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Velocidad (3 min): tema rápido permitido
        time: 180,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 12, dangerOn: 6, total: 20 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Pico (8 min): satisfacción máxima
        time: 480,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        puzzleTimes: { warningOn: 60, dangerOn: 30, total: 90 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Desafío (4 min): emoción máxima a ciegas
        time: 240,
        puzzlesCount: 0,
        theme: { strategy: 'random' },
        description: { key: 'PUZZLES.modes.sameOpeningRandomThemeBlind' },
        puzzleTimes: { warningOn: 10, dangerOn: 5, total: 35 },
        goshPuzzleTime: 15,
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
      {
        // Enfriamiento (5 min): final de peón o de torre y peón.
        // El ELO se lee del mismo tema que se sortea aquí, no de otro sorteo aparte.
        time: 300,
        puzzlesCount: 0,
        theme: { strategy: 'oneOf', themes: ['endgame', 'pawnEndgame'] },
        puzzleTimes: { warningOn: 40, dangerOn: 20, total: 60 },
        nextPuzzleImmediately: true,
        showPuzzleSolution: true,
      },
    ],
  },
};
