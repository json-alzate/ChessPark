import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { StockfishWorkerService } from './stockfish-worker.service';
import { StockfishConfig, StockfishStatus } from './types/stockfish.types';
import { UCICommand } from './types/uci.types';

/**
 * Servicio principal para interactuar con el motor Stockfish WebAssembly.
 *
 * Este servicio gestiona el ciclo de vida del motor, su inicialización,
 * configuración y proporciona métodos de alto nivel para evaluar posiciones
 * y obtener análisis de ajedrez.
 *
 * @example
 * ```typescript
 * constructor(private stockfish: StockfishService) {}
 *
 * async ngOnInit() {
 *   await this.stockfish.initialize();
 *   const evaluation = await this.stockfish.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 *   console.log('Score:', evaluation.score);
 * }
 * ```
 */
@Injectable({
    providedIn: 'root',
})
export class StockfishService implements OnDestroy {
    private readonly defaultConfig: Required<StockfishConfig> = {
        threads: 1,
        hash: 16,
        skillLevel: 20,
        depth: 15,
        workerPath: '/assets/engine/stockfish-16.1-lite-single.js',
    };

    private config: StockfishConfig = {};
    private statusSubject = new BehaviorSubject<StockfishStatus>(StockfishStatus.Uninitialized);
    private workerErrorSub: Subscription | null = null;

    /**
     * Observable del estado actual del motor
     */
    readonly status$: Observable<StockfishStatus> = this.statusSubject.asObservable();

    /**
     * Estado actual del motor
     */
    get status(): StockfishStatus {
        return this.statusSubject.value;
    }

    /**
     * Indica si el motor está listo para usar
     */
    get isReady(): boolean {
        return this.status === StockfishStatus.Ready && this.workerService.isReady();
    }

    /**
     * Indica si el motor está analizando
     */
    get isAnalyzing(): boolean {
        return this.status === StockfishStatus.Analyzing;
    }

    constructor(private workerService: StockfishWorkerService) {}

    /**
     * Inicializa el motor Stockfish
     *
     * @param config - Configuración opcional del motor
     * @returns Promise que se resuelve cuando el motor está listo
     *
     * @example
     * ```typescript
     * await stockfish.initialize({
     *   threads: 2,
     *   hash: 32,
     *   depth: 18
     * });
     * ```
     */
    async initialize(config?: StockfishConfig): Promise<void> {
        if (this.status === StockfishStatus.Ready || this.status === StockfishStatus.Initializing) {
            console.log('[Stockfish Service] Already initialized or initializing, status:', this.status);
            return;
        }

        // Si hay un error previo, terminar el worker antes de reinicializar
        if (this.status === StockfishStatus.Error) {
            console.log('[Stockfish Service] Previous error detected, terminating worker before reinitializing');
            this.workerService.terminate();
            // Resetear estado después de un pequeño delay para asegurar limpieza
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            console.log('[Stockfish Service] Starting initialization with config:', config);
            this.statusSubject.next(StockfishStatus.Initializing);
            this.config = { ...this.defaultConfig, ...config };

            // Renovar suscripción a errores del worker para esta sesión
            this.workerErrorSub?.unsubscribe();
            this.workerErrorSub = this.workerService.getErrors().subscribe((error) => {
                this.statusSubject.next(StockfishStatus.Error);
                console.error('Stockfish error:', error);
            });

            // Inicializar worker
            console.log('[Stockfish Service] Initializing worker with path:', this.config.workerPath);
            await this.workerService.initialize(this.config.workerPath);

            // Configurar opciones del motor
            console.log('[Stockfish Service] Configuring engine options...');
            await this.configureEngine();

            this.statusSubject.next(StockfishStatus.Ready);
            console.log('[Stockfish Service] Initialization complete, status: Ready');
        } catch (error) {
            console.error('[Stockfish Service] Initialization failed:', error);
            this.statusSubject.next(StockfishStatus.Error);
            this.workerErrorSub?.unsubscribe();
            this.workerErrorSub = null;
            this.workerService.terminate();
            throw error;
        }
    }

    /**
     * Configura las opciones del motor (threads, hash, skill level)
     */
    private async configureEngine(): Promise<void> {
        if (this.config.threads !== undefined) {
            this.workerService.sendCommand(`setoption name Threads value ${this.config.threads}`);
        }
        if (this.config.hash !== undefined) {
            this.workerService.sendCommand(`setoption name Hash value ${this.config.hash}`);
        }
        if (this.config.skillLevel !== undefined) {
            this.workerService.sendCommand(`setoption name Skill Level value ${this.config.skillLevel}`);
        }

        // Esperar un momento para que las opciones se apliquen
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    /**
     * Establece una posición en el tablero usando notación FEN
     *
     * @param fen - Posición en notación FEN
     * @param moves - Movimientos adicionales en notación UCI (opcional)
     *
     * @example
     * ```typescript
     * stockfish.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
     * // O con movimientos adicionales:
     * stockfish.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'e7e5']);
     * ```
     */
    setPosition(fen: string, moves?: string[]): void {
        // Verificar que el worker esté realmente disponible
        if (!this.isReady || !this.workerService.isReady()) {
            console.error('[Stockfish Service] Worker not ready. isReady:', this.isReady, 'workerReady:', this.workerService.isReady());
            throw new Error('Stockfish not initialized. Call initialize() first.');
        }
        console.log('[Stockfish Service] Setting position, FEN:', fen, 'moves:', moves);

        let command = `position fen ${fen}`;
        if (moves && moves.length > 0) {
            command += ` moves ${moves.join(' ')}`;
        }
        this.workerService.sendCommand(command);
    }

    /**
     * Establece una posición desde el inicio de la partida con movimientos
     *
     * @param moves - Array de movimientos en notación UCI
     *
     * @example
     * ```typescript
     * stockfish.setPositionFromStart(['e2e4', 'e7e5', 'g1f3']);
     * ```
     */
    setPositionFromStart(moves: string[]): void {
        if (!this.isReady) {
            throw new Error('Stockfish not initialized. Call initialize() first.');
        }

        const command = `position startpos moves ${moves.join(' ')}`;
        this.workerService.sendCommand(command);
    }

    /**
     * Detiene el análisis actual
     */
    stopAnalysis(): void {
        if (this.isAnalyzing) {
            this.workerService.sendCommand(UCICommand.Stop);
            this.statusSubject.next(StockfishStatus.Stopped);
        }
    }

    /**
     * Reinicia el motor (nueva partida)
     */
    newGame(): void {
        if (this.isReady) {
            this.workerService.sendCommand(UCICommand.UciNewGame);
        }
    }

    /**
     * Actualiza la configuración del motor
     *
     * @param config - Configuración parcial a actualizar
     *
     * @example
     * ```typescript
     * stockfish.updateConfig({ threads: 4, hash: 64 });
     * ```
     */
    updateConfig(config: Partial<StockfishConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.isReady) {
            this.configureEngine();
        }
    }

    /**
     * Obtiene la configuración actual del motor
     *
     * @returns Copia de la configuración actual
     */
    getConfig(): StockfishConfig {
        return { ...this.config };
    }

    /**
     * Obtiene el servicio Worker interno (para uso avanzado)
     *
     * @returns Instancia del StockfishWorkerService
     * @internal
     */
    getWorkerService(): StockfishWorkerService {
        return this.workerService;
    }

    /**
     * Limpia recursos y termina el Worker
     */
    ngOnDestroy(): void {
        this.terminate();
    }

    /**
     * Termina el motor y libera recursos
     */
    terminate(): void {
        this.stopAnalysis();
        this.workerErrorSub?.unsubscribe();
        this.workerErrorSub = null;
        this.workerService.terminate();
        this.statusSubject.next(StockfishStatus.Uninitialized);
    }
}
