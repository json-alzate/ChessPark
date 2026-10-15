import { inject, Injectable } from '@angular/core';

import { Puzzle } from '@chesspark/models';

import { AnalyticsService } from '@core/analytics/analytics.service';

import {
  WoodpeckerConfig,
  WoodpeckerCycle,
  WoodpeckerProgress,
  WoodpeckerPuzzleResult,
  WoodpeckerSet,
  WoodpeckerState,
} from '../models/woodpecker.model';
import {
  currentCycle,
  emptyProgress,
  finishCycle,
  isCycleComplete,
  nextPuzzleUid,
  puzzleTimesFor,
  recordResult,
  startCycle,
  WoodpeckerPuzzleTimes,
} from '../utils/woodpecker-cycle.util';
import {
  finishedSummaries,
  latestCycleReport,
  summarizeCycle,
} from '../utils/woodpecker-stats.util';
import {
  WoodpeckerGeneration,
  WoodpeckerGenerationProgress,
  WoodpeckerSetService,
} from './woodpecker-set.service';
import { WoodpeckerStorageService } from './woodpecker-storage.service';

/** Resultado de crear un set: lo que pasó al armarlo, o que no cupo en el dispositivo. */
export type WoodpeckerCreation = WoodpeckerGeneration | { status: 'storage-full' };

/**
 * Orquesta el Pájaro Carpintero: crea el set, y lleva el progreso vuelta a
 * vuelta. Toda la lógica de las vueltas está en `utils/`; aquí solo se guarda
 * y se mide.
 *
 * Hay un único set a la vez. Crear otro sustituye al anterior: la pantalla es
 * quien avisa antes al usuario.
 */
@Injectable({
  providedIn: 'root',
})
export class WoodpeckerService {
  private setService = inject(WoodpeckerSetService);
  private storage = inject(WoodpeckerStorageService);
  private analytics = inject(AnalyticsService);

  private state: WoodpeckerState | null = null;
  private puzzlesByUid = new Map<string, Puzzle>();

  /** Lee del dispositivo lo guardado. Las pantallas lo llaman al entrar. */
  load(): WoodpeckerState | null {
    this.setState(this.storage.getState());
    return this.state;
  }

  getState(): WoodpeckerState | null {
    return this.state;
  }

  get set(): WoodpeckerSet | null {
    return this.state?.set ?? null;
  }

  get progress(): WoodpeckerProgress | null {
    return this.state?.progress ?? null;
  }

  get availableThemes(): string[] {
    return this.setService.availableThemes;
  }

  /** La vuelta que está a medias, si la hay. */
  get activeCycle(): WoodpeckerCycle | null {
    return this.state ? currentCycle(this.state.progress) : null;
  }

  /** ¿Se hicieron todas las vueltas? */
  get isCompleted(): boolean {
    return this.state?.progress.completedAt !== undefined;
  }

  // ----------------------------------------------------------------- crear

  /** Arma un set nuevo y, si sale bien, sustituye al que hubiera. */
  async createSet(
    config: WoodpeckerConfig,
    onProgress?: WoodpeckerGenerationProgress
  ): Promise<WoodpeckerCreation> {
    const generation = await this.setService.generate(config, onProgress);

    if (generation.status === 'too-few') {
      void this.analytics.logEvent('woodpecker_set_short', {
        requested: config.targetCount,
        available: generation.found,
      });
      return generation;
    }
    if (generation.status !== 'ok') {
      return generation;
    }

    if (!this.storage.saveNewSet(generation.set)) {
      return { status: 'storage-full' };
    }
    this.setState({ set: generation.set, progress: emptyProgress(generation.set.id) });

    if (generation.short) {
      void this.analytics.logEvent('woodpecker_set_short', {
        requested: config.targetCount,
        available: generation.set.puzzles.length,
      });
    }
    void this.analytics.logEvent('woodpecker_plan_created', {
      target: config.targetCount,
      actual: generation.set.puzzles.length,
      elo_min: config.eloMin,
      elo_max: config.eloMax,
      themes_count: config.themes.length,
      cycles: config.cycles,
      order: config.order,
      timing: config.timing,
    });
    return generation;
  }

  // ---------------------------------------------------------------- vueltas

  /**
   * Abre la siguiente vuelta, o retoma la que estaba a medias. `null` si no hay
   * set o ya se hicieron todas las vueltas.
   */
  beginCycle(random?: () => number): WoodpeckerCycle | null {
    if (!this.state) {
      return null;
    }
    const resuming = currentCycle(this.state.progress) !== null;
    const progress = startCycle(
      this.state.progress,
      this.state.set.config,
      this.state.set.puzzles.map((puzzle) => puzzle.uid),
      Date.now(),
      random
    );
    const cycle = currentCycle(progress);
    if (!cycle) {
      return null;
    }

    if (!resuming) {
      this.commit(progress);
      void this.analytics.logEvent('woodpecker_cycle_started', {
        cycle: cycle.cycle,
        set_size: this.state.set.puzzles.length,
      });
    }
    return cycle;
  }

  /** El ejercicio que toca en la vuelta en curso (con el tablero listo para jugarlo). */
  nextPuzzle(): Puzzle | null {
    const cycle = this.activeCycle;
    const uid = cycle ? nextPuzzleUid(cycle) : null;
    return uid ? this.puzzlesByUid.get(uid) ?? null : null;
  }

  /** Tiempos del tablero para la vuelta en curso (sin límite: `undefined`). */
  timesForActiveCycle(): WoodpeckerPuzzleTimes | undefined {
    const cycle = this.activeCycle;
    return cycle && this.state ? puzzleTimesFor(this.state.set.config, cycle.cycle) : undefined;
  }

  /** Anota cómo salió el ejercicio actual y guarda. */
  registerResult(result: WoodpeckerPuzzleResult): void {
    if (!this.state) {
      return;
    }
    const progress = recordResult(this.state.progress, result);
    if (progress !== this.state.progress) {
      this.commit(progress);
    }
  }

  /** ¿Ya se jugaron todos los ejercicios de la vuelta en curso? */
  get isActiveCycleComplete(): boolean {
    const cycle = this.activeCycle;
    return !!cycle && isCycleComplete(cycle);
  }

  /**
   * Cierra la vuelta en curso, que tiene que estar completa. Devuelve cómo
   * quedó respecto a la anterior, o `null` si no había nada que cerrar.
   */
  completeCycle() {
    if (!this.state || !this.isActiveCycleComplete) {
      return null;
    }
    const { set } = this.state;
    const progress = finishCycle(this.state.progress, set.config, Date.now());
    this.commit(progress);

    const report = latestCycleReport(progress.cycles);
    if (!report) {
      return null;
    }

    void this.analytics.logEvent('woodpecker_cycle_completed', {
      cycle: report.current.cycle,
      solved: report.current.solved,
      failed: report.current.failed,
      total_time_ms: report.current.totalTimeMs,
    });

    const finishedSet = progress.completedAt !== undefined;
    if (finishedSet) {
      const summaries = finishedSummaries(progress.cycles);
      const first = summaries[0];
      const last = summaries[summaries.length - 1];
      void this.analytics.logEvent('woodpecker_plan_completed', {
        cycles: summaries.length,
        accuracy_first: Math.round(first.accuracy),
        accuracy_last: Math.round(last.accuracy),
        time_first_ms: first.totalTimeMs,
        time_last_ms: last.totalTimeMs,
      });
    }

    return { ...report, finishedSet };
  }

  /** Resumen de la vuelta en curso (para el marcador mientras se juega). */
  activeCycleSummary() {
    const cycle = this.activeCycle;
    return cycle ? summarizeCycle(cycle) : null;
  }

  // -------------------------------------------------------------- abandonar

  /** Borra el set y el progreso. */
  discard(): void {
    if (this.state) {
      void this.analytics.logEvent('woodpecker_plan_abandoned', {
        cycles_done: finishedSummaries(this.state.progress.cycles).length,
        cycles: this.state.set.config.cycles,
        completed: this.state.progress.completedAt !== undefined,
      });
    }
    this.storage.clear();
    this.setState(null);
  }

  // ---------------------------------------------------------------- interno

  private commit(progress: WoodpeckerProgress): void {
    if (!this.state) {
      return;
    }
    this.state = { ...this.state, progress };
    this.storage.saveProgress(progress);
  }

  private setState(state: WoodpeckerState | null): void {
    this.state = state;
    this.puzzlesByUid = new Map(
      (state?.set.puzzles ?? []).map((puzzle) => [puzzle.uid, puzzle])
    );
  }
}
