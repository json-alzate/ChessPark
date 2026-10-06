import { Injectable, inject } from '@angular/core';
import {
  StockfishAnalysisService,
  StockfishConfig,
  StockfishService,
} from '@chesspark/stockfish-wasm';

/**
 * Configuración del motor que usan las vistas de puzzles del tablero.
 * Se centraliza aquí para que el componente no conozca rutas de worker ni parámetros de UCI.
 */
export const STOCKFISH_PUZZLE_CONFIG: StockfishConfig = {
  depth: 15,
  threads: 1,
  hash: 16,
  workerPath: 'assets/engine/stockfish-16.1-lite-single.js',
};

/**
 * Resultado de pedir la mejor jugada para una posición.
 *
 * - `best-move`: Stockfish devolvió una jugada en notación UCI (p. ej. `e2e4`, `a7a8q`).
 * - `no-move`: no hay jugada que mostrar. Ocurre si una petición nueva canceló un análisis
 *   en curso, si el análisis falló de forma no crítica (p. ej. timeout) o si no vino jugada.
 * - `unavailable`: el motor no está listo y no se pudo recuperar. El llamador debe
 *   desactivar la función de análisis; el facade ya dejó el worker terminado.
 */
export type StockfishBestMoveOutcome =
  | { kind: 'best-move'; move: string }
  | { kind: 'no-move' }
  | { kind: 'unavailable' };

const NO_MOVE: StockfishBestMoveOutcome = { kind: 'no-move' };
const UNAVAILABLE: StockfishBestMoveOutcome = { kind: 'unavailable' };

/** Pausa para que el worker que se acaba de terminar no se solape con el que se crea después. */
const WORKER_RESTART_DELAY_MS = 200;

/**
 * Fachada de Stockfish para componentes de UI. Expone "dame la mejor jugada de esta posición"
 * y oculta el ciclo de vida del worker: inicialización, terminación, reinicio tras pérdida
 * del worker y clasificación de errores críticos.
 *
 * Entradas: FEN de la posición a analizar (`getBestMove`).
 * Salidas: `StockfishBestMoveOutcome` (nunca lanza; los errores se traducen a resultados).
 *
 * Ciclo de vida:
 * - Se provee en el propio componente (`providers`), así cada instancia de vista tiene su
 *   propio estado de análisis en curso. El motor subyacente (`StockfishService`) sigue siendo
 *   un singleton de root.
 * - `initialize()` se llama una vez al crear el componente.
 * - `getBestMove()` se llama cada vez que cambia la posición que se quiere analizar.
 * - `cancel()` detiene el análisis en curso sin apagar el motor (p. ej. al desactivar la opción).
 * - `dispose()` termina el worker. Se llama al destruir el componente.
 *
 * Nota: como `StockfishService` es singleton, `dispose()` y los reinicios afectan a cualquier
 * otro consumidor de ese servicio. Es el mismo comportamiento que tenía el componente antes.
 *
 * @example
 * ```typescript
 * await this.engine.initialize();
 * const outcome = await this.engine.getBestMove(this.chess.fen());
 * if (outcome.kind === 'best-move') {
 *   this.drawArrow(outcome.move);
 * }
 * ```
 */
@Injectable()
export class StockfishEngineFacade {
  private readonly stockfish = inject(StockfishService);
  private readonly analysis = inject(StockfishAnalysisService);

  /** True mientras hay una petición `getBestMove` sin resolver (evita análisis concurrentes). */
  private analyzing = false;

  /** True si el motor y su worker están listos para analizar. */
  get isReady(): boolean {
    return this.stockfish.isReady;
  }

  /**
   * Inicializa el motor con la configuración del puzzle. Si ya había un worker listo,
   * lo termina antes para empezar desde un estado limpio.
   *
   * @returns `true` si el motor quedó listo; `false` si falló (no lanza).
   */
  async initialize(): Promise<boolean> {
    if (this.stockfish.isReady) {
      console.log('[Stockfish] Service already ready, terminating previous instance');
      await this.terminateAndWait();
    }
    return this.start();
  }

  /**
   * Pide la mejor jugada para una posición.
   *
   * Si ya hay un análisis en curso, lo cancela y responde `no-move` sin analizar la posición nueva.
   * Esto replica el comportamiento previo del componente; el llamador debe volver a pedir la
   * posición cuando el análisis actual termine si la necesita.
   *
   * Si el worker se perdió (error "not initialized"), lo reinicia y reintenta una sola vez
   * con la misma posición. Si un error indica memoria agotada o worker terminado, apaga el motor.
   *
   * @param fen - Posición en notación FEN
   * @returns Resultado tipado; nunca lanza
   */
  async getBestMove(fen: string): Promise<StockfishBestMoveOutcome> {
    if (this.analyzing) {
      this.cancel();
      return NO_MOVE;
    }

    if (!this.stockfish.isReady) {
      console.warn('[Stockfish] Analysis skipped - service not ready');
      return UNAVAILABLE;
    }

    this.analyzing = true;
    try {
      return await this.askWithRecovery(fen, true);
    } finally {
      this.analyzing = false;
    }
  }

  /**
   * Detiene el análisis en curso sin terminar el worker. Si el motor no está analizando,
   * la llamada no hace nada. Los errores al detener solo se registran.
   */
  cancel(): void {
    try {
      this.stockfish.stopAnalysis();
    } catch (error) {
      console.warn('[Stockfish] Error stopping analysis:', error);
    }
  }

  /**
   * Termina el worker y libera recursos. Debe llamarse al destruir el componente
   * que usa el facade.
   */
  dispose(): void {
    this.safeTerminate();
  }

  /**
   * Ejecuta el análisis y resuelve errores. `allowRestart` impide reinicios en bucle:
   * tras un reinicio la segunda llamada no vuelve a reiniciar.
   */
  private async askWithRecovery(
    fen: string,
    allowRestart: boolean
  ): Promise<StockfishBestMoveOutcome> {
    try {
      const result = await this.analysis.getBestMove(fen, {
        depth: STOCKFISH_PUZZLE_CONFIG.depth,
      });
      console.log('[Stockfish] Analysis result:', result);
      return result?.move ? { kind: 'best-move', move: result.move } : NO_MOVE;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (allowRestart && message.includes('not initialized')) {
        console.warn('[Stockfish] Worker lost, attempting to reinitialize...');
        await this.terminateAndWait();
        if (!(await this.start())) {
          return UNAVAILABLE;
        }
        return this.askWithRecovery(fen, false);
      }

      if (message.includes('memory') || message.includes('terminated')) {
        console.error('[Stockfish] Critical error, shutting down the engine:', error);
        this.dispose();
        return UNAVAILABLE;
      }

      console.error('[Stockfish] Error analyzing position:', error);
      return NO_MOVE;
    }
  }

  /**
   * Crea el worker con la configuración del puzzle.
   *
   * @returns `true` si quedó listo; `false` si falló. En caso de fallo deja el worker terminado.
   */
  private async start(): Promise<boolean> {
    try {
      await this.stockfish.initialize(STOCKFISH_PUZZLE_CONFIG);
      console.log('[Stockfish] Initialized successfully, isReady:', this.stockfish.isReady);
      return this.stockfish.isReady;
    } catch (error) {
      console.error('[Stockfish] Failed to initialize:', error);
      this.safeTerminate();
      return false;
    }
  }

  /** Termina el worker y espera la pausa de `WORKER_RESTART_DELAY_MS` antes de volver a crearlo. */
  private async terminateAndWait(): Promise<void> {
    this.safeTerminate();
    await new Promise((resolve) => setTimeout(resolve, WORKER_RESTART_DELAY_MS));
  }

  /** Termina el worker sin propagar errores (ya puede estar muerto). */
  private safeTerminate(): void {
    try {
      this.stockfish.terminate();
    } catch (error) {
      console.error('[Stockfish] Error terminating Stockfish:', error);
    }
  }
}
