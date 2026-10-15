/**
 * Cómo se arma el set: de qué archivos del catálogo salen los ejercicios y
 * cuáles se quedan. Funciones puras; quien baja los archivos es
 * `WoodpeckerSetService`.
 *
 * El catálogo guarda los ejercicios en archivos por tema y franja de 20 puntos
 * de ELO que pesan entre 250 y 700 KB y traen cientos de ejercicios cada uno.
 * Por eso no se pide un puñado por cada franja del rango (serían decenas de
 * archivos): se eligen pocos archivos repartidos por el rango y de cada uno
 * se toman varios ejercicios.
 */

import { Puzzle } from '@chesspark/models';

import { WoodpeckerConfig } from '../models/woodpecker.model';

/** Ancho de la franja de ELO de cada archivo del catálogo. */
export const WOODPECKER_FILE_ELO_STEP = 20;

/** Cuántos ejercicios se buscan sacar de cada archivo. */
export const WOODPECKER_TAKE_PER_FILE = 25;

/** Un archivo del catálogo del que hay que sacar ejercicios. */
export interface WoodpeckerSourceFile {
  theme: string;
  /** Inicio de la franja de 20 puntos (el `1500` de `1500_1519`). */
  eloStart: number;
  /** Cuántos ejercicios se quieren de este archivo. */
  take: number;
}

/** Los ejercicios que devolvió un archivo, junto con lo que se esperaba de él. */
export interface WoodpeckerSourcePool {
  source: WoodpeckerSourceFile;
  puzzles: Puzzle[];
}

type SetFilters = Pick<WoodpeckerConfig, 'eloMin' | 'eloMax' | 'themes'>;

/** Reparte `total` en `parts` partes casi iguales; las primeras se llevan el sobrante. */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) {
    return [];
  }
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Franjas del catálogo que existen para un tema y caben enteras en
 * [eloMin, eloMax). Ordenadas de menor a mayor.
 */
export function bucketsInRange(
  eloMin: number,
  eloMax: number,
  validStarts: Set<number> | undefined
): number[] {
  if (!validStarts) {
    return [];
  }
  return [...validStarts]
    .filter(
      (start) => start >= eloMin && start + WOODPECKER_FILE_ELO_STEP <= eloMax
    )
    .sort((a, b) => a - b);
}

/**
 * Elige `count` franjas repartidas por todo el rango: lo divide en `count`
 * tramos y toma una al azar de cada uno. Así el set cubre el rango entero sin
 * que dos sets con los mismos filtros usen siempre los mismos archivos.
 */
export function pickSpread(
  buckets: number[],
  count: number,
  random: () => number = Math.random
): number[] {
  if (count >= buckets.length) {
    return [...buckets];
  }
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * buckets.length) / count);
    const to = Math.floor(((i + 1) * buckets.length) / count);
    picked.push(buckets[from + Math.floor(random() * (to - from))]);
  }
  return picked;
}

/**
 * Archivos a descargar para armar el set. El tamaño pedido se reparte a partes
 * iguales entre los temas (los que no tienen archivos en el rango se descartan)
 * y, dentro de cada tema, entre unos pocos archivos repartidos por el rango.
 */
export function planSources(
  targetCount: number,
  filters: SetFilters,
  validStartsOf: (theme: string) => Set<number> | undefined,
  random: () => number = Math.random
): WoodpeckerSourceFile[] {
  const usable = filters.themes
    .map((theme) => ({
      theme,
      buckets: bucketsInRange(filters.eloMin, filters.eloMax, validStartsOf(theme)),
    }))
    .filter((entry) => entry.buckets.length > 0);

  const quotas = splitEvenly(targetCount, usable.length);
  const sources: WoodpeckerSourceFile[] = [];

  usable.forEach(({ theme, buckets }, index) => {
    const quota = quotas[index];
    if (quota === 0) {
      return;
    }
    const files = Math.min(
      buckets.length,
      Math.max(1, Math.ceil(quota / WOODPECKER_TAKE_PER_FILE))
    );
    const chosen = pickSpread(buckets, files, random);
    const takes = splitEvenly(quota, chosen.length);
    chosen.forEach((eloStart, i) => {
      sources.push({ theme, eloStart, take: takes[i] });
    });
  });

  return sources;
}

/** Clave de un archivo, para saber cuáles ya se usaron. */
export function sourceKey(source: Pick<WoodpeckerSourceFile, 'theme' | 'eloStart'>): string {
  return `${source.theme}|${source.eloStart}`;
}

/**
 * Archivos extra para cubrir lo que falta cuando los primeros no dieron
 * suficientes (archivos con pocos ejercicios, repetidos entre temas). Solo
 * propone archivos que aún no se usaron y los alterna entre temas.
 *
 * `perFile` es lo que cada archivo suele rendir: si los primeros trajeron
 * pocos ejercicios, hacen falta más archivos para cubrir lo que falta.
 */
export function planTopUp(
  missing: number,
  filters: SetFilters,
  validStartsOf: (theme: string) => Set<number> | undefined,
  used: Set<string>,
  random: () => number = Math.random,
  perFile: number = WOODPECKER_TAKE_PER_FILE
): WoodpeckerSourceFile[] {
  if (missing <= 0) {
    return [];
  }

  // Candidatos sin usar, por tema y mezclados dentro de cada tema
  const byTheme = filters.themes
    .map((theme) =>
      shuffled(
        bucketsInRange(filters.eloMin, filters.eloMax, validStartsOf(theme)).filter(
          (eloStart) => !used.has(sourceKey({ theme, eloStart }))
        ),
        random
      ).map((eloStart) => ({ theme, eloStart }))
    )
    .filter((list) => list.length > 0);

  // Alternar entre temas: uno de cada tema, luego otro de cada tema…
  const candidates: { theme: string; eloStart: number }[] = [];
  const longest = Math.max(0, ...byTheme.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of byTheme) {
      if (list[i]) {
        candidates.push(list[i]);
      }
    }
  }

  const files = Math.min(
    candidates.length,
    Math.max(1, Math.ceil(missing / Math.max(1, perFile)))
  );
  const takes = splitEvenly(missing, files);
  return candidates.slice(0, files).map((candidate, i) => ({
    ...candidate,
    take: takes[i],
  }));
}

/** Copia mezclada (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Elige los ejercicios del set entre lo que devolvió cada archivo.
 *
 * Primero cada archivo aporta lo suyo (`take`), sin repetir ejercicios que ya
 * entraron por otro tema. Si faltan, se completa con lo que sobró de cualquier
 * archivo, turnándose entre ellos. El resultado sale mezclado: es el orden de
 * la vuelta 1 y alterna temas y dificultades en vez de ir por bloques.
 */
export function selectPuzzles(
  pools: WoodpeckerSourcePool[],
  targetCount: number,
  random: () => number = Math.random
): Puzzle[] {
  const seen = new Set<string>();
  const selected: Puzzle[] = [];
  const leftovers: Puzzle[][] = [];

  for (const { source, puzzles } of pools) {
    const rest: Puzzle[] = [];
    let taken = 0;
    for (const puzzle of shuffled(puzzles, random)) {
      if (seen.has(puzzle.uid)) {
        continue;
      }
      if (taken < source.take && selected.length < targetCount) {
        seen.add(puzzle.uid);
        selected.push(puzzle);
        taken++;
      } else {
        rest.push(puzzle);
      }
    }
    leftovers.push(rest);
  }

  // Segunda pasada: completar con los sobrantes, turnándose entre archivos
  let round = 0;
  while (selected.length < targetCount && leftovers.some((rest) => round < rest.length)) {
    for (const rest of leftovers) {
      const puzzle = rest[round];
      if (puzzle && !seen.has(puzzle.uid) && selected.length < targetCount) {
        seen.add(puzzle.uid);
        selected.push(puzzle);
      }
    }
    round++;
  }

  return shuffled(selected, random);
}
