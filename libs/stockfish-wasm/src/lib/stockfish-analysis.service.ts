import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, take, takeUntil, timeout } from 'rxjs/operators';
import { StockfishService } from './stockfish.service';
import { StockfishWorkerService } from './stockfish-worker.service';
import {
  BestMoveResult,
  AnalysisOptions,
  MultiPvResult,
  StockfishEvaluation,
  AnalysisInfo,
} from './types/stockfish.types';
import { UCICommand, UCIInfoMessage, UCIBestMoveMessage } from './types/uci.types';

/**
 * Servicio para análisis avanzado de posiciones y obtención de mejores movimientos.
 *
 * Proporciona métodos para obtener el mejor movimiento, analizar variantes,
 * y realizar análisis con múltiples opciones.
 *
 * @example
 * ```typescript
 * constructor(
 *   private stockfish: StockfishService,
 *   private analysis: StockfishAnalysisService
 * ) {}
 *
 * async getBest() {
 *   await this.stockfish.initialize();
 *   const result = await this.analysis.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 *   console.log('Best move:', result.move);
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class StockfishAnalysisService {
  constructor(
    private stockfishService: StockfishService,
    private workerService: StockfishWorkerService
  ) {}

  /**
   * Obtiene el mejor movimiento para una posición dada.
   *
   * @param fen - Posición en notación FEN
   * @param options - Opciones de análisis (profundidad, límite de tiempo, etc.)
   * @returns Promise con el mejor movimiento y su evaluación
   *
   * @example
   * ```typescript
   * const result = await analysis.getBestMove(fen, { depth: 18 });
   * console.log('Best move:', result.move);
   * console.log('Ponder:', result.ponder);
   * ```
   */
  async getBestMove(fen: string, options?: AnalysisOptions): Promise<BestMoveResult> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    const opts: Required<AnalysisOptions> = {
      depth: options?.depth || 15,
      timeLimit: options?.timeLimit || 0,
      nodesLimit: options?.nodesLimit || 0,
      multiPv: options?.multiPv || 1,
    };

    return new Promise((resolve, reject) => {
      const timeoutMs = opts.timeLimit || 30000; // 30 segundos por defecto

      console.log('[Stockfish Analysis] Starting getBestMove for FEN:', fen);
      console.log('[Stockfish Analysis] Options:', opts);

      // Detener cualquier análisis anterior
      this.stockfishService.stopAnalysis();

      // Establecer posición
      this.stockfishService.setPosition(fen);
      console.log('[Stockfish Analysis] Position set');

      // Configurar multiPV si es necesario
      if (opts.multiPv > 1) {
        this.workerService.sendCommand(`setoption name MultiPV value ${opts.multiPv}`);
        console.log('[Stockfish Analysis] MultiPV set to', opts.multiPv);
      }

      let allMessagesSub: any = null;
      let subscription: any = null;

      // Suscribirse a todos los mensajes para logging (solo los primeros para evitar spam)
      let messageCount = 0;
      allMessagesSub = this.workerService.getMessages().subscribe((message) => {
        messageCount++;
        if (messageCount <= 5 || message.includes('bestmove')) {
          console.log('[Stockfish Analysis] Received message:', message);
        }
      });

      // Suscribirse a mensajes bestmove
      subscription = this.workerService
        .filterMessages('bestmove')
        .pipe(
          timeout(timeoutMs),
          map((message) => {
            console.log('[Stockfish Analysis] Bestmove message received:', message);
            return this.workerService.parseBestMoveMessage(message);
          }),
          take(1) // Solo tomar el primer bestmove
        )
        .subscribe({
          next: (bestMove) => {
            console.log('[Stockfish Analysis] Parsed bestmove:', bestMove);
            if (bestMove && bestMove.move) {
              // Limpiar suscripciones
              if (allMessagesSub) {
                allMessagesSub.unsubscribe();
              }
              if (subscription) {
                subscription.unsubscribe();
              }
              // Resetear multiPV
              if (opts.multiPv > 1) {
                this.workerService.sendCommand('setoption name MultiPV value 1');
              }

              const result = {
                move: bestMove.move,
                ponder: bestMove.ponder,
              };
              console.log('[Stockfish Analysis] Resolving with result:', result);
              resolve(result);
            } else {
              console.warn('[Stockfish Analysis] Bestmove parsed but no move found:', bestMove);
              if (allMessagesSub) {
                allMessagesSub.unsubscribe();
              }
              if (subscription) {
                subscription.unsubscribe();
              }
              reject(new Error('No move found in bestmove message'));
            }
          },
          error: (error) => {
            console.error('[Stockfish Analysis] Error in subscription:', error);
            if (allMessagesSub) {
              allMessagesSub.unsubscribe();
            }
            if (subscription) {
              subscription.unsubscribe();
            }
            if (opts.multiPv > 1) {
              this.workerService.sendCommand('setoption name MultiPV value 1');
            }
            reject(error);
          },
        });

      // Construir comando 'go'
      let goCommand = 'go';
      if (opts.depth > 0) {
        goCommand += ` depth ${opts.depth}`;
      }
      if (opts.timeLimit > 0) {
        goCommand += ` movetime ${opts.timeLimit}`;
      }
      if (opts.nodesLimit > 0) {
        goCommand += ` nodes ${opts.nodesLimit}`;
      }

      console.log('[Stockfish Analysis] Sending command:', goCommand);
      this.workerService.sendCommand(goCommand);
    });
  }

  /**
   * Analiza una posición completamente y retorna información detallada.
   *
   * @param fen - Posición en notación FEN
   * @param depth - Profundidad de análisis
   * @returns Promise con evaluación completa incluyendo mejor movimiento y variante principal
   *
   * @example
   * ```typescript
   * const analysis = await this.analysis.analyzePosition(fen, 20);
   * console.log('Best move:', analysis.bestMove);
   * console.log('Principal variation:', analysis.pv);
   * console.log('Score:', analysis.score);
   * ```
   */
  async analyzePosition(fen: string, depth: number = 15): Promise<StockfishEvaluation> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let bestEvaluation: StockfishEvaluation | null = null;
      const timeoutMs = 60000; // 60 segundos para análisis profundo

      // Establecer posición
      this.stockfishService.setPosition(fen);

      // Tipo discriminado para los mensajes parseados
      type ParsedMessage = 
        | { type: 'info'; data: UCIInfoMessage }
        | { type: 'bestmove'; data: UCIBestMoveMessage }
        | null;

      // Suscribirse a mensajes de análisis y bestmove
      const subscription = this.workerService
        .getMessages()
        .pipe(
          map((message): ParsedMessage => {
            // Intentar parsear como info primero
            const info = this.workerService.parseInfoMessage(message);
            if (info) {
              return { type: 'info' as const, data: info };
            }
            // Intentar parsear como bestmove
            const bestMove = this.workerService.parseBestMoveMessage(message);
            if (bestMove) {
              return { type: 'bestmove' as const, data: bestMove };
            }
            return null;
          }),
          takeUntil(
            this.workerService.filterMessages('bestmove').pipe(
              timeout(timeoutMs),
              map(() => {
                subscription.unsubscribe();
                if (bestEvaluation) {
                  resolve(bestEvaluation);
                } else {
                  reject(new Error('No analysis received'));
                }
              })
            )
          )
        )
        .subscribe({
          next: (parsed: ParsedMessage) => {
            if (parsed?.type === 'info') {
              const info = parsed.data;
              if (info.depth === depth && info.score) {
                const evaluation: StockfishEvaluation = {
                  score: info.score.cp || 0,
                  depth: info.depth || depth,
                  nodes: info.nodes || 0,
                  time: info.time || Date.now() - startTime,
                  bestMove: info.pv?.[0],
                  pv: info.pv || [],
                  mate: info.score.mate,
                };

                if (!bestEvaluation || evaluation.depth >= bestEvaluation.depth) {
                  bestEvaluation = evaluation;
                }
              }
            } else if (parsed?.type === 'bestmove' && bestEvaluation) {
              const bestMove = parsed.data;
              bestEvaluation.bestMove = bestMove.move;
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
   * Obtiene los N mejores movimientos para una posición.
   *
   * @param fen - Posición en notación FEN
   * @param count - Número de mejores movimientos a obtener
   * @param depth - Profundidad de análisis
   * @returns Promise con los mejores movimientos ordenados por score
   *
   * @example
   * ```typescript
   * const topMoves = await analysis.getMultipleBestMoves(fen, 5, 18);
   * topMoves.variations.forEach(v => {
   *   console.log(`Rank ${v.rank}: ${v.move} (score: ${v.score})`);
   * });
   * ```
   */
  async getMultipleBestMoves(
    fen: string,
    count: number,
    depth: number = 15
  ): Promise<MultiPvResult> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const variations = new Map<number, MultiPvResult['variations'][0]>();
      const timeoutMs = 120000; // 2 minutos para múltiples variantes

      // Establecer posición
      this.stockfishService.setPosition(fen);

      // Configurar multiPV
      this.workerService.sendCommand(`setoption name MultiPV value ${count}`);

      // Suscribirse a mensajes
      const subscription = this.workerService
        .getMessages()
        .pipe(
          map((message) => this.workerService.parseInfoMessage(message)),
          takeUntil(
            this.workerService.filterMessages('bestmove').pipe(
              timeout(timeoutMs),
              map(() => {
                subscription.unsubscribe();
                this.workerService.sendCommand('setoption name MultiPV value 1');

                // Convertir map a array ordenado
                const sortedVariations = Array.from(variations.values()).sort(
                  (a, b) => b.score - a.score
                );

                resolve({ variations: sortedVariations });
              })
            )
          )
        )
        .subscribe({
          next: (info) => {
            if (info && info.multipv && info.score && info.pv) {
              const variation = {
                rank: info.multipv,
                move: info.pv[0] || '',
                score: info.score.cp || 0,
                mate: info.score.mate,
                pv: info.pv,
              };
              variations.set(info.multipv, variation);
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            this.workerService.sendCommand('setoption name MultiPV value 1');
            reject(error);
          },
        });

      // Iniciar análisis
      this.workerService.sendCommand(`go depth ${depth}`);
    });
  }

  /**
   * Analiza una variante específica de movimientos.
   *
   * @param fen - Posición inicial en notación FEN
   * @param moves - Array de movimientos en notación UCI a analizar
   * @param depth - Profundidad de análisis
   * @returns Promise con la evaluación de la posición final después de los movimientos
   *
   * @example
   * ```typescript
   * const eval = await analysis.analyzeVariation(
   *   'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
   *   ['e2e4', 'e7e5', 'g1f3'],
   *   18
   * );
   * ```
   */
  async analyzeVariation(
    fen: string,
    moves: string[],
    depth: number = 15
  ): Promise<StockfishEvaluation> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    // Establecer posición con los movimientos
    this.stockfishService.setPosition(fen, moves);

    // Analizar la posición resultante
    return this.analyzePosition(fen, depth);
  }

  /**
   * Obtiene análisis continuo de una posición (streaming).
   *
   * @param fen - Posición en notación FEN
   * @param options - Opciones de análisis
   * @returns Observable que emite información de análisis en tiempo real
   *
   * @example
   * ```typescript
   * analysis.analyzeContinuously(fen, { depth: 20 })
   *   .subscribe(info => {
   *     console.log(`Depth ${info.depth}: ${info.score} cp`);
   *   });
   * ```
   */
  analyzeContinuously(fen: string, options?: AnalysisOptions): Observable<AnalysisInfo> {
    if (!this.stockfishService.isReady) {
      throw new Error('Stockfish not initialized. Call stockfishService.initialize() first.');
    }

    const opts: Required<AnalysisOptions> = {
      depth: options?.depth || 15,
      timeLimit: options?.timeLimit || 0,
      nodesLimit: options?.nodesLimit || 0,
      multiPv: options?.multiPv || 1,
    };

    return new Observable((observer) => {
      // Establecer posición
      this.stockfishService.setPosition(fen);

      const subscription = this.workerService
        .getMessages()
        .pipe(
          map((message) => {
            const info = this.workerService.parseInfoMessage(message);
            if (info && info.depth && info.score) {
              return {
                depth: info.depth,
                score: info.score.cp || 0,
                mate: info.score.mate,
                nodes: info.nodes || 0,
                time: info.time || 0,
                pv: info.pv || [],
                multipv: info.multipv,
              } as AnalysisInfo;
            }
            return null;
          }),
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
            if (info) {
              observer.next(info);
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            observer.error(error);
          },
        });

      // Construir comando 'go'
      let goCommand = 'go';
      if (opts.depth > 0) {
        goCommand += ` depth ${opts.depth}`;
      }
      if (opts.timeLimit > 0) {
        goCommand += ` movetime ${opts.timeLimit}`;
      }
      if (opts.nodesLimit > 0) {
        goCommand += ` nodes ${opts.nodesLimit}`;
      }

      this.workerService.sendCommand(goCommand);

      // Cleanup
      return () => {
        subscription.unsubscribe();
        this.stockfishService.stopAnalysis();
      };
    });
  }
}
