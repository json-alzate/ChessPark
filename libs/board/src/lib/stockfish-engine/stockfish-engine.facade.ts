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
 * - `no-move`: no hay jugada que mostrar. Ocurre si otra petición más reciente (o un
 *   `cancel()`/`dispose()`) reemplazó a esta antes de que terminara, si el análisis falló
 *   de forma no crítica (p. ej. timeout) o si no vino jugada. Nunca se devuelve una jugada
 *   de una posición que ya no es la última pedida.
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
 * - `getBestMove()` se llama cada vez que cambia la posición que se quiere analizar. Si llega
 *   una posición nueva mientras otra se analiza, gana la última: la búsqueda en curso se
 *   detiene, su resultado se descarta y se analiza la posición nueva.
 * - `cancel()` detiene el análisis en curso sin apagar el motor y descarta cualquier petición
 *   pendiente (p. ej. al desactivar la opción).
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

  /**
   * Número de la última petición hecha (o de la última invalidación por `cancel`/`dispose`).
   * Una petición solo puede responder con jugada si su número sigue siendo este al terminar:
   * si no, ya hay otra más nueva y su resultado corresponde a una posición vieja.
   */
  private latestRequestId = 0;

  /**
   * Búsqueda que está corriendo en el motor, o `null` si está libre. Nunca se rechaza
   * (`askWithRecovery` no lanza). Se usa para esperar a que una búsqueda cancelada termine
   * antes de lanzar la siguiente.
   */
  private inFlight: Promise<StockfishBestMoveOutcome> | null = null;

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
   * Pide la mejor jugada para una posición. Gana siempre la última petición.
   *
   * Si ya hay una búsqueda en curso, se detiene y se espera a que el motor responda a ese
   * `stop` antes de lanzar la nueva. La espera es necesaria: el motor contesta al `stop` con un
   * `bestmove` de la posición vieja, y `StockfishAnalysisService` no asocia cada respuesta a su
   * FEN (toma "el próximo bestmove"). Si se lanzara la búsqueda nueva sin esperar, esa respuesta
   * rezagada podría llegar a la petición nueva y dibujarse una jugada de la posición anterior.
   *
   * Resultados:
   * - Si mientras esta petición espera o analiza llega otra más nueva (o se llama a `cancel` o
   *   `dispose`), devuelve `no-move` y descarta lo que haya encontrado.
   * - Si el worker se perdió (error "not initialized"), lo reinicia y reintenta una sola vez
   *   con la misma posición. Si un error indica memoria agotada o worker terminado, apaga el motor.
   *
   * Limitación: la espera depende de que el motor conteste al `stop`. Si el worker queda
   * colgado, la petición espera hasta el timeout del análisis (30 s por defecto en
   * `StockfishAnalysisService`), igual que esa búsqueda.
   *
   * @param fen - Posición en notación FEN
   * @returns Resultado tipado; nunca lanza
   */
  async getBestMove(fen: string): Promise<StockfishBestMoveOutcome> {
    const requestId = ++this.latestRequestId;

    // Si el motor está ocupado, se detiene su búsqueda y se espera a que suelte el motor.
    // Es un bucle porque, al despertar, otra petición podría haber vuelto a ocuparlo.
    while (this.inFlight) {
      this.stopEngine();
      await this.inFlight;
      if (requestId !== this.latestRequestId) {
        return NO_MOVE; // llegó otra posición más nueva mientras esperaba
      }
    }

    if (!this.stockfish.isReady) {
      console.warn('[Stockfish] Analysis skipped - service not ready');
      return UNAVAILABLE;
    }

    const search = this.askWithRecovery(fen, true).finally(() => {
      if (this.inFlight === search) {
        this.inFlight = null;
      }
    });
    this.inFlight = search;
    const outcome = await search;

    // Si durante el análisis llegó una posición más nueva, esta jugada ya no corresponde
    // al tablero actual: se descarta.
    return requestId === this.latestRequestId ? outcome : NO_MOVE;
  }

  /**
   * Detiene el análisis en curso sin terminar el worker y descarta las peticiones pendientes
   * (devolverán `no-move`). Si el motor no está analizando, no hace nada más.
   * Los errores al detener solo se registran.
   */
  cancel(): void {
    this.latestRequestId++;
    this.stopEngine();
  }

  /**
   * Termina el worker y libera recursos, descartando las peticiones pendientes.
   * Debe llamarse al destruir el componente que usa el facade.
   */
  dispose(): void {
    this.latestRequestId++;
    this.safeTerminate();
  }

  /**
   * Envía `stop` al motor sin invalidar peticiones. Es lo que usa `getBestMove` para liberar el
   * motor cuando llega una posición nueva (la petición nueva sigue siendo válida).
   */
  private stopEngine(): void {
    try {
      this.stockfish.stopAnalysis();
    } catch (error) {
      console.warn('[Stockfish] Error stopping analysis:', error);
    }
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
        // safeTerminate y no dispose: dispose invalidaría esta misma petición y el llamador
        // recibiría no-move en vez de unavailable, y no desactivaría la opción en la UI.
        this.safeTerminate();
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
