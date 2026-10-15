import { inject, Injectable } from '@angular/core';

import { Puzzle } from '@chesspark/models';
import { UidGeneratorService } from '@chesspark/common-utils';
import {
  getManifestThemes,
  getValidEloStarts,
  PuzzlesProvider,
} from '@chesspark/puzzles-provider';

import { STREAK_EXCLUDED_THEMES } from '@features/streak/utils/streak.util';

import { WoodpeckerConfig, WoodpeckerSet } from '../models/woodpecker.model';
import {
  planSources,
  planTopUp,
  selectPuzzles,
  sourceKey,
  WOODPECKER_FILE_ELO_STEP,
  WoodpeckerSourceFile,
  WoodpeckerSourcePool,
} from '../utils/woodpecker-set.util';

/** Cómo salió el armado del set. */
export type WoodpeckerGeneration =
  /** Set listo; `short` si salió con menos de lo pedido pero por encima del mínimo. */
  | { status: 'ok'; set: WoodpeckerSet; short: boolean }
  /** El catálogo no da el mínimo con estos filtros. */
  | { status: 'too-few'; found: number; required: number }
  /** No se pudo bajar nada: sin conexión y sin caché. */
  | { status: 'unavailable' };

/** Cuántos archivos van descargados de los que se necesitan. */
export type WoodpeckerGenerationProgress = (done: number, total: number) => void;

/**
 * Arma el set a partir del catálogo de ejercicios.
 *
 * Es el único sitio que habla con el catálogo: la planificación (qué archivos)
 * y la elección (qué ejercicios) son funciones puras de `woodpecker-set.util`,
 * aquí solo se descarga y se ensambla.
 */
@Injectable({
  providedIn: 'root',
})
export class WoodpeckerSetService {
  private puzzlesProvider = inject(PuzzlesProvider);
  private uidGenerator = inject(UidGeneratorService);

  /** Pasadas extra para cubrir lo que falte antes de rendirse. */
  private readonly MAX_TOP_UPS = 3;

  /** Tope de ejercicios que el catálogo entrega por petición. */
  private readonly MAX_PER_REQUEST = 200;

  /**
   * Temas del catálogo que se pueden elegir: los que tienen archivos reales,
   * sin los que describen duración o desenlace y no un motivo táctico.
   */
  get availableThemes(): string[] {
    return getManifestThemes().filter(
      (theme) => !STREAK_EXCLUDED_THEMES.includes(theme)
    );
  }

  async generate(
    config: WoodpeckerConfig,
    onProgress?: WoodpeckerGenerationProgress
  ): Promise<WoodpeckerGeneration> {
    const validStartsOf = (theme: string) => getValidEloStarts(theme);

    const first = planSources(config.targetCount, config, validStartsOf);
    if (first.length === 0) {
      return { status: 'too-few', found: 0, required: config.minCount };
    }

    let total = first.length;
    let done = 0;
    const report = () => onProgress?.(done, total);
    report();

    const pools: WoodpeckerSourcePool[] = await this.fetchPools(first, () => {
      done++;
      report();
    });
    if (pools.every((pool) => pool.puzzles.length === 0)) {
      return { status: 'unavailable' };
    }

    const used = new Set(first.map(sourceKey));
    let selected = selectPuzzles(pools, config.targetCount);

    for (let pass = 0; pass < this.MAX_TOP_UPS && selected.length < config.targetCount; pass++) {
      const extra = planTopUp(
        config.targetCount - selected.length,
        config,
        validStartsOf,
        used,
        Math.random,
        this.averageFileYield(pools)
      );
      if (extra.length === 0) {
        break;
      }
      extra.forEach((source) => used.add(sourceKey(source)));
      total += extra.length;
      report();

      pools.push(
        ...(await this.fetchPools(extra, () => {
          done++;
          report();
        }))
      );
      selected = selectPuzzles(pools, config.targetCount);
    }

    if (selected.length < config.minCount) {
      return { status: 'too-few', found: selected.length, required: config.minCount };
    }

    return {
      status: 'ok',
      short: selected.length < config.targetCount,
      set: {
        id: this.uidGenerator.generateSimpleUid(),
        source: 'catalog',
        createdAt: Date.now(),
        // Con menos ejercicios de los pedidos, la configuración guardada dice lo que de verdad hay
        config: { ...config, targetCount: selected.length },
        puzzles: selected,
      },
    };
  }

  /**
   * Cuántos ejercicios ha dado de media cada archivo con contenido, para saber
   * cuántos más hacen falta si el set quedó corto.
   */
  private averageFileYield(pools: WoodpeckerSourcePool[]): number {
    const withContent = pools.filter((pool) => pool.puzzles.length > 0);
    if (withContent.length === 0) {
      return 1;
    }
    const total = withContent.reduce((sum, pool) => sum + pool.puzzles.length, 0);
    return Math.max(1, Math.floor(total / withContent.length));
  }

  /** Descarga (o toma de la caché) cada archivo; uno que falle no tumba el resto. */
  private fetchPools(
    sources: WoodpeckerSourceFile[],
    onFileDone: () => void
  ): Promise<WoodpeckerSourcePool[]> {
    return Promise.all(
      sources.map(async (source) => {
        let puzzles: Puzzle[] = [];
        try {
          puzzles = await this.puzzlesProvider.getPuzzles({
            elo: source.eloStart,
            eloMin: source.eloStart,
            eloMax: source.eloStart + WOODPECKER_FILE_ELO_STEP - 1,
            theme: source.theme,
            // Se pide de más para poder descartar repetidos entre temas
            count: Math.min(this.MAX_PER_REQUEST, source.take * 2),
          });
        } catch (error) {
          console.warn('Error pidiendo ejercicios para el set:', error);
        }
        onFileDone();
        return { source, puzzles };
      })
    );
  }
}
