/**
 * Piezas compartidas por las pruebas de las pantallas de rutinas
 * (`pages/puzzles`): fábricas de datos y proveedores falsos.
 */
import { ModuleWithProviders } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { Block, Plan, Puzzle, PublicPlan } from '@chesspark/models';

export function makePuzzle(uid = 'p1', overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    uid,
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'e2e4',
    rating: 1500,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['mateIn1'],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...overrides,
  };
}

export function makePuzzles(count: number, prefix = 'p'): Puzzle[] {
  return Array.from({ length: count }, (_, i) => makePuzzle(`${prefix}${i + 1}`));
}

export function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    time: 60,
    puzzlesCount: 0,
    theme: 'mateIn1',
    elo: 1500,
    color: 'random',
    puzzles: [makePuzzle('a'), makePuzzle('b')],
    puzzlesPlayed: [],
    showPuzzleSolution: true,
    ...overrides,
  };
}

export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    uid: 'plan-test',
    blocks: [makeBlock(), makeBlock(), makeBlock()],
    createdAt: Date.now(),
    planType: 'plan5',
    ...overrides,
  };
}

export function makePublicPlan(overrides: Partial<PublicPlan> = {}): PublicPlan {
  return {
    uid: 'pub-1',
    title: 'Mates en 1',
    uidUser: 'author-1',
    blocks: [makeBlock({ puzzles: undefined })],
    createdAt: 1_700_000_000_000,
    planType: 'custom',
    timesPlayed: 12,
    likesCount: 3,
    savedCount: 1,
    ...overrides,
  };
}

/**
 * Transloco real, sin traducciones: cada clave se pinta tal cual
 * (`'CUSTOM_PLANS.empty'`), de modo que las pruebas comprueban qué texto se
 * muestra sin depender de los JSON de i18n.
 */
export function translocoModule(
  translations: Record<string, unknown> = {}
): ModuleWithProviders<TranslocoTestingModule> {
  return TranslocoTestingModule.forRoot({
    langs: { es: translations, en: translations },
    translocoConfig: { availableLangs: ['es', 'en'], defaultLang: 'es' },
    preloadLangs: true,
  });
}

/** Texto visible del elemento, sin espacios sobrantes. */
export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Botón por el texto que muestra (clave de traducción) o `aria-label`. */
export function findButton(root: HTMLElement, label: string): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button'));
  return (
    buttons.find(
      (b) => textOf(b).includes(label) || b.getAttribute('aria-label') === label
    ) ?? null
  );
}

/**
 * Nombre de un `<ion-icon>`. Se lee la propiedad y no el atributo: con
 * `[name]="..."` el web component real de Ionic solo refleja el atributo de
 * forma asíncrona, y con relojes falsos no llega a hacerlo.
 */
export function iconName(icon: Element | null | undefined): string {
  if (!icon) return '';
  return String((icon as unknown as { name?: string }).name ?? icon.getAttribute('name') ?? '');
}

/** Nombres de todos los iconos que hay dentro de `root`, en orden. */
export function iconNames(root: Element): string[] {
  return Array.from(root.querySelectorAll('ion-icon')).map((i) => iconName(i));
}

/** Botón que contiene un icono con ese `name` (empieza por el prefijo dado). */
export function findButtonByIcon(root: HTMLElement, iconPrefix: string): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button'));
  return buttons.find((b) => iconName(b.querySelector('ion-icon')).startsWith(iconPrefix)) ?? null;
}

/** Deja correr las microtareas pendientes. */
export async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

/**
 * Importar IonIcon registra el web component real `ion-icon`, que en jsdom intenta
 * descargar el SVG y ensucia la consola. Se descartan solo esos dos avisos; el
 * resto de la consola queda intacta. Hay que llamarla dentro de un `beforeEach`
 * (el `jest.restoreAllMocks()` del `afterEach` la deshace).
 */
export function silenceIonIconNoise(): void {
  const warn = console.warn.bind(console);
  const log = console.log.bind(console);
  jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('[Ionicons Warning]')) return;
    warn(...args);
  });
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (args.some((a) => String(a).includes('Invalid base URL'))) return;
    log(...args);
  });
}

/**
 * Cómo se elige el elo de arranque de una rutina propia/pública según la suma
 * de tiempos de sus bloques (en segundos; los bloques sin tiempo, -1, no suman).
 * Es la misma regla en la lista de rutinas, en el formulario y en las públicas.
 */
export const ELOS_BY_PLAN = {
  plan5Total: 1111,
  plan10Total: 2222,
  plan20Total: 3333,
  plan30Total: 4444,
};

export interface EloToStartCase {
  name: string;
  /** `time` de cada bloque de la rutina. */
  blockTimes: number[];
  /** `elos` del perfil, o `null` si no hay sesión. */
  profileElos: Record<string, number> | null | undefined;
  expected: number;
}

export const ELO_TO_START_CASES: EloToStartCase[] = [
  { name: 'sin sesión arranca en 1500', blockTimes: [300], profileElos: null, expected: 1500 },
  { name: 'perfil sin elos arranca en 1500', blockTimes: [300], profileElos: undefined, expected: 1500 },
  { name: 'hasta 300 s (5 min) usa el elo de plan5', blockTimes: [150, 150], profileElos: ELOS_BY_PLAN, expected: 1111 },
  { name: 'los bloques sin tiempo (-1) no suman', blockTimes: [-1, -1], profileElos: ELOS_BY_PLAN, expected: 1111 },
  { name: 'de 301 a 600 s usa el elo de plan10', blockTimes: [150, 151], profileElos: ELOS_BY_PLAN, expected: 2222 },
  { name: 'exactamente 600 s (10 min) sigue en plan10', blockTimes: [300, 300], profileElos: ELOS_BY_PLAN, expected: 2222 },
  { name: 'de 601 a 1200 s usa el elo de plan20', blockTimes: [601], profileElos: ELOS_BY_PLAN, expected: 3333 },
  { name: 'exactamente 1200 s (20 min) sigue en plan20', blockTimes: [1200], profileElos: ELOS_BY_PLAN, expected: 3333 },
  { name: 'más de 1200 s usa el elo de plan30', blockTimes: [1201], profileElos: ELOS_BY_PLAN, expected: 4444 },
  { name: 'si falta el elo de su tramo arranca en 1500', blockTimes: [400], profileElos: { plan5Total: 1111 }, expected: 1500 },
];
