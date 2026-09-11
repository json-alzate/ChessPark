import { inject, Injectable } from '@angular/core';

import {
  StockfishEvaluationService,
  StockfishService,
} from '@chesspark/stockfish-wasm';
import {
  engineEvalForWhite,
  PositionEval,
  terminalEval,
} from '@chesspark/game-reporter';

import { AnalyticsService } from './analytics.service';

/**
 * Profundidad del análisis: la velocidad "media" que se eligió.
 *
 * Con la versión ligera de Stockfish y un solo hilo, 12 da una evaluación que
 * distingue bien un error de una buena jugada sin que una partida entera se
 * haga eterna en el móvil. El evento game_review_completed mide cuánto tarda
 * de verdad, para ajustarla con datos.
 */
const REVIEW_DEPTH = 12;

const WORKER_PATH = 'assets/engine/stockfish-16.1-lite-single.js';

/** Un análisis guardado en el dispositivo. */
interface CachedReview {
  key: string;
  depth: number;
  evals: Array<PositionEval | null>;
  savedAt: number;
}

/**
 * Una huella corta de la partida a partir de sus posiciones: dos partidas con
 * las mismas posiciones tienen la misma valoración, vengan de donde vengan.
 */
function gameKey(fens: string[]): string {
  const text = fens.join('|');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${fens.length}:${hash >>> 0}`;
}

/**
 * Analiza con Stockfish las posiciones de una partida para poder valorar sus
 * jugadas.
 *
 * El motor es uno solo y evalúa de una en una, así que las posiciones van en
 * fila. Cada análisis lleva un número: al cambiar de partida o salir de la
 * pantalla se cancela el que estuviera en marcha y deja de contar.
 *
 * Cancelar no corta la posición que el motor tiene entre manos —el servicio de
 * Stockfish no la para—, así que un análisis nuevo espera a que acabe antes de
 * pedir nada: si no, tomaría la respuesta de la posición vieja como la de su
 * primera posición y todas sus evaluaciones quedarían desplazadas una.
 *
 * Lo analizado se guarda en el dispositivo (las últimas partidas): volver a
 * abrir la valoración de una partida ya vista es instantáneo.
 */
@Injectable({
  providedIn: 'root',
})
export class GameReviewService {
  private stockfish = inject(StockfishService);
  private evaluation = inject(StockfishEvaluationService);
  private analytics = inject(AnalyticsService);

  private readonly CACHE_KEY = 'chessColate_game_reviews';
  /** Partidas guardadas como mucho; cada una ocupa apenas unos kilobytes. */
  private readonly MAX_CACHED = 30;

  private runId = 0;

  /** La evaluación que el motor tiene en marcha, para no pisarla. */
  private inFlight: Promise<unknown> = Promise.resolve();

  /**
   * La evaluación de cada posición, desde el punto de vista de las blancas.
   * null si se canceló antes de terminar. Lanza si Stockfish no arranca.
   */
  async evaluatePositions(
    fens: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<Array<PositionEval | null> | null> {
    const run = ++this.runId;
    const key = gameKey(fens);

    const cached = this.readCache().find(
      (entry) => entry.key === key && entry.depth === REVIEW_DEPTH
    );
    if (cached) {
      onProgress?.(fens.length, fens.length);
      return cached.evals;
    }

    // Lo que quedara de un análisis cancelado tiene que terminar antes
    await this.inFlight;
    if (run !== this.runId) {
      return null;
    }

    await this.stockfish.initialize({
      depth: REVIEW_DEPTH,
      workerPath: WORKER_PATH,
    });

    const startedAt = Date.now();
    const evals: Array<PositionEval | null> = [];

    for (let i = 0; i < fens.length; i++) {
      if (run !== this.runId) {
        return null;
      }
      evals.push(await this.evaluate(fens[i]));
      onProgress?.(i + 1, fens.length);
    }

    if (run !== this.runId) {
      return null;
    }

    // Si no salió ninguna evaluación no se guarda: mejor reintentar otra vez
    if (evals.some((evaluation) => evaluation !== null)) {
      this.saveCache({ key, depth: REVIEW_DEPTH, evals, savedAt: Date.now() });
    }

    void this.analytics.logEvent('game_review_completed', {
      positions: fens.length,
      depth: REVIEW_DEPTH,
      duration_s: Math.round((Date.now() - startedAt) / 1000),
      failed_positions: evals.filter((evaluation) => evaluation === null).length,
    });

    return evals;
  }

  /**
   * Cancela el análisis en marcha, si lo hay: no se pide ninguna posición más
   * y el resultado se descarta. La posición que el motor ya tenía termina sola
   * (a esta profundidad, en menos de un par de segundos).
   */
  cancel(): void {
    this.runId += 1;
  }

  private async evaluate(fen: string): Promise<PositionEval | null> {
    // Mate o tablas ya en el tablero: no hay nada que buscar, y el servicio de
    // Stockfish no devuelve evaluación para una posición terminada
    const terminal = terminalEval(fen);
    if (terminal) {
      return terminal;
    }

    try {
      const pending = this.evaluation.evaluatePosition(fen, REVIEW_DEPTH);
      this.inFlight = pending.catch(() => undefined);
      const result = await pending;
      return engineEvalForWhite(fen, result.score, result.mate);
    } catch (error) {
      console.warn('[GameReview] No se pudo evaluar una posición:', error);
      return null;
    }
  }

  // — Guardado en el dispositivo ——————————————————————————————

  private readCache(): CachedReview[] {
    try {
      const json = localStorage.getItem(this.CACHE_KEY);
      return json ? (JSON.parse(json) as CachedReview[]) : [];
    } catch (error) {
      console.warn('[GameReview] No se pudo leer lo guardado:', error);
      return [];
    }
  }

  /** Guarda un análisis y descarta los más antiguos por encima del máximo. */
  private saveCache(entry: CachedReview): void {
    const entries = [
      entry,
      ...this.readCache().filter((cached) => cached.key !== entry.key),
    ].slice(0, this.MAX_CACHED);

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.warn('[GameReview] No se pudo guardar el análisis:', error);
    }
  }
}
