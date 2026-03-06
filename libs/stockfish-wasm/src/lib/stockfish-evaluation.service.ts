import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil, timeout } from 'rxjs/operators';
import { StockfishService } from './stockfish.service';
import { StockfishWorkerService } from './stockfish-worker.service';
import { StockfishEvaluation, AnalysisInfo } from './types/stockfish.types';
import { UCICommand } from './types/uci.types';

/**
 * Servicio para evaluar posiciones de ajedrez usando Stockfish.
 *
 * Proporciona métodos para obtener evaluaciones de posiciones,
 * scores y análisis en tiempo real.
 *
 * @example
 * ```typescript
 * constructor(
 *   private stockfish: StockfishService,
 *   private evaluation: StockfishEvaluationService
 * ) {}
 *
 * async evaluate() {
 *   await this.stockfish.initialize();
 *   const score = await this.evaluation.getPositionScore('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 *   console.log('Score:', score);
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class StockfishEvaluationService {
  constructor(
    private stockfishService: StockfishService,
    private workerService: StockfishWorkerService
  ) {}

  /**
   * Evalúa una posición y retorna el score en centipawns.
   *
   * @param fen - Posición en notación FEN
   * @param depth - Profundidad de búsqueda (default: 15)
   * @returns Promise con el score en centipawns
   *
   * @example
   * ```typescript
   * const score = await evaluation.getPositionScore('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
   * // score = 20 (ventaja de 0.2 peones para blancas)
   * ```
   */
  async getPositionScore(fen: string, depth: number = 15): Promise<number> {
    const evaluation = await this.evaluatePosition(fen, depth);
    return evaluation.score;
  }

  /**
   * Evalúa una posición y retorna información completa de evaluación.
   *
   * @param fen - Posición en notación FEN
   * @param depth - Profundidad de búsqueda (default: 15)
   * @returns Promise con la evaluación completa
   *
   * @example
   * ```typescript
   * const eval = await evaluation.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 18);
   * console.log('Score:', eval.score);
   * console.log('Depth:', eval.depth);
   * console.log('Best move:', eval.bestMove);
   * ```
   */
  async evaluatePosition(fen: string, depth: number = 15): Promise<StockfishEvaluation> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let bestEvaluation: StockfishEvaluation | null = null;
      const timeoutMs = 30000; // 30 segundos máximo

      // Establecer posición
      this.stockfishService.setPosition(fen);

      // Suscribirse a mensajes de análisis
      const subscription = this.workerService
        .getMessages()
        .pipe(
          map((message) => this.workerService.parseInfoMessage(message)),
          takeUntil(
            this.workerService.filterMessages('bestmove').pipe(
              timeout(timeoutMs),
              map(() => {
                subscription.unsubscribe();
                if (bestEvaluation) {
                  resolve(bestEvaluation);
                } else {
                  reject(new Error('No evaluation received'));
                }
              })
            )
          )
        )
        .subscribe({
          next: (info) => {
            if (info && info.depth === depth && info.score) {
              const evaluation: StockfishEvaluation = {
                score: info.score.cp || 0,
                depth: info.depth || depth,
                nodes: info.nodes || 0,
                time: info.time || Date.now() - startTime,
                bestMove: info.pv?.[0],
                pv: info.pv || [],
                mate: info.score.mate,
              };

              // Actualizar mejor evaluación si es más profunda o igual
              if (!bestEvaluation || evaluation.depth >= bestEvaluation.depth) {
                bestEvaluation = evaluation;
              }
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          },
        });

      // Iniciar análisis
      this.workerService.sendCommand(`go depth ${depth}`);
    });
  }

  /**
   * Evalúa una posición de forma reactiva, emitiendo actualizaciones durante el análisis.
   *
   * @param fen - Posición en notación FEN
   * @param depth - Profundidad de búsqueda (default: 15)
   * @returns Observable que emite información de análisis en tiempo real
   *
   * @example
   * ```typescript
   * evaluation.evaluatePositionAsync('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 18)
   *   .subscribe(info => {
   *     console.log(`Depth ${info.depth}: Score ${info.score}`);
   *   });
   * ```
   */
  evaluatePositionAsync(fen: string, depth: number = 15): Observable<AnalysisInfo> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    return new Observable((observer) => {
      // Establecer posición
      this.stockfishService.setPosition(fen);

      const subscription = this.workerService
        .getMessages()
        .pipe(
          map((message) => this.workerService.parseInfoMessage(message)),
          takeUntil(
            this.workerService.filterMessages('bestmove').pipe(
              map(() => {
                subscription.unsubscribe();
                observer.complete();
              })
            )
          )
        )
        .subscribe({
          next: (info) => {
            if (info && info.depth && info.score) {
              const analysisInfo: AnalysisInfo = {
                depth: info.depth,
                score: info.score.cp || 0,
                mate: info.score.mate,
                nodes: info.nodes || 0,
                time: info.time || 0,
                pv: info.pv || [],
                multipv: info.multipv,
              };
              observer.next(analysisInfo);
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            observer.error(error);
          },
        });

      // Iniciar análisis
      this.workerService.sendCommand(`go depth ${depth}`);

      // Cleanup
      return () => {
        subscription.unsubscribe();
        this.stockfishService.stopAnalysis();
      };
    });
  }

  /**
   * Evalúa múltiples posiciones de forma secuencial.
   *
   * @param fens - Array de posiciones FEN a evaluar
   * @param depth - Profundidad de búsqueda para todas las posiciones
   * @returns Promise con array de evaluaciones en el mismo orden
   *
   * @example
   * ```typescript
   * const positions = [
   *   'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
   *   'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
   * ];
   * const evaluations = await evaluation.evaluateMultiplePositions(positions, 15);
   * ```
   */
  async evaluateMultiplePositions(
    fens: string[],
    depth: number = 15
  ): Promise<StockfishEvaluation[]> {
    const evaluations: StockfishEvaluation[] = [];

    for (const fen of fens) {
      const evaluation = await this.evaluatePosition(fen, depth);
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /**
   * Compara dos posiciones y retorna la diferencia de score.
   *
   * @param fen1 - Primera posición FEN
   * @param fen2 - Segunda posición FEN
   * @param depth - Profundidad de búsqueda
   * @returns Promise con la diferencia de score (score2 - score1)
   *
   * @example
   * ```typescript
   * const diff = await evaluation.comparePositions(fen1, fen2, 15);
   * // diff > 0 significa que fen2 es mejor que fen1
   * ```
   */
  async comparePositions(fen1: string, fen2: string, depth: number = 15): Promise<number> {
    const [eval1, eval2] = await Promise.all([
      this.evaluatePosition(fen1, depth),
      this.evaluatePosition(fen2, depth),
    ]);

    return eval2.score - eval1.score;
  }
}
