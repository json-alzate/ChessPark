import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, throwError } from 'rxjs';
import { filter, map, timeout, catchError } from 'rxjs/operators';
import { UCIInfoMessage, UCIBestMoveMessage, UCICommand, UCIResponse } from './types/uci.types';

/**
 * Servicio interno para manejar la comunicación con el Worker de Stockfish
 * y el parsing de mensajes UCI.
 *
 * @internal
 */
@Injectable({
  providedIn: 'root',
})
export class StockfishWorkerService {
  private worker: Worker | null = null;
  private messageSubject = new Subject<string>();
  private errorSubject = new Subject<Error>();
  private isInitialized = false;
  private readonly defaultWorkerPath = 'assets/engine/stockfish-16.1-lite-single.js';
  private readonly uciTimeout = 5000; // 5 segundos para inicialización UCI

  /**
   * Inicializa el Worker de Stockfish
   *
   * @param workerPath - Ruta al archivo Worker (opcional)
   * @returns Promise que se resuelve cuando el motor está listo
   */
  async initialize(workerPath?: string): Promise<void> {
    // Si ya está inicializado y funcionando, no hacer nada
    if (this.worker && this.isInitialized) {
      console.log('[Stockfish Worker] Already initialized, skipping');
      return;
    }

    // Si hay un worker anterior pero no está inicializado (error previo), terminarlo primero
    if (this.worker && !this.isInitialized) {
      console.log('[Stockfish Worker] Previous worker exists but not initialized, terminating it first');
      this.terminate();
    }

    try {
      const path = workerPath || this.defaultWorkerPath;
      console.log('[Stockfish Worker] Creating new worker from:', path);
      this.worker = new Worker(path);

      // Configurar listeners
      this.worker.onmessage = (event: MessageEvent) => {
        // Solo loguear mensajes importantes para evitar spam
        if (event.data.includes('bestmove') || event.data.includes('readyok') || event.data.includes('uciok')) {
          console.log('[Stockfish Worker] Message received:', event.data);
        }
        this.messageSubject.next(event.data);
      };

      this.worker.onerror = (error: ErrorEvent) => {
        const errorMessage = error.message || error.filename || 'Unknown error';
        const errorDetails = `Worker error loading ${error.filename || path}: ${errorMessage}`;
        console.error('[Stockfish Worker] Error:', error);
        console.error('[Stockfish Worker] Error details:', errorDetails);
        // Marcar como no inicializado en caso de error
        this.isInitialized = false;
        this.errorSubject.next(new Error(errorDetails));
        // Terminar el worker en caso de error crítico
        if (error.message && error.message.includes('memory access out of bounds')) {
          console.error('[Stockfish Worker] Critical memory error, terminating worker');
          this.terminate();
        }
      };

      // Inicializar UCI
      console.log('[Stockfish Worker] Sending UCI command...');
      await this.sendUCICommand();
      console.log('[Stockfish Worker] Waiting for readyok...');
      await this.waitForReady();
      console.log('[Stockfish Worker] UCI initialization complete');

      this.isInitialized = true;
    } catch (error) {
      console.error('[Stockfish Worker] Initialization failed:', error);
      // Asegurarse de limpiar el worker en caso de error
      if (this.worker) {
        this.terminate();
      }
      const err = error instanceof Error ? error : new Error('Failed to initialize Stockfish worker');
      this.errorSubject.next(err);
      throw err;
    }
  }

  /**
   * Envía un comando UCI al motor
   *
   * @param command - Comando UCI a enviar
   */
  sendCommand(command: string): void {
    if (!this.worker) {
      console.error('[Stockfish Worker] Cannot send command - worker is null');
      throw new Error('Worker not initialized. Call initialize() first.');
    }
    if (!this.isInitialized) {
      console.error('[Stockfish Worker] Cannot send command - worker not initialized');
      throw new Error('Worker not initialized. Call initialize() first.');
    }
    console.log('[Stockfish Worker] Sending command:', command);
    try {
      this.worker.postMessage(command);
    } catch (error) {
      console.error('[Stockfish Worker] Error sending command:', error);
      // Si hay un error al enviar, el worker probablemente está muerto
      this.isInitialized = false;
      throw new Error('Failed to send command to worker. Worker may be terminated.');
    }
  }

  /**
   * Obtiene un Observable de mensajes del Worker
   *
   * @returns Observable que emite mensajes del Worker
   */
  getMessages(): Observable<string> {
    return this.messageSubject.asObservable();
  }

  /**
   * Obtiene un Observable de errores del Worker
   *
   * @returns Observable que emite errores
   */
  getErrors(): Observable<Error> {
    return this.errorSubject.asObservable();
  }

  /**
   * Filtra mensajes por un patrón específico
   *
   * @param pattern - Patrón a buscar en los mensajes
   * @returns Observable que emite solo mensajes que coinciden con el patrón
   */
  filterMessages(pattern: string | RegExp): Observable<string> {
    return this.getMessages().pipe(
      filter((message) => {
        if (typeof pattern === 'string') {
          return message.includes(pattern);
        }
        return pattern.test(message);
      })
    );
  }

  /**
   * Espera por un mensaje específico
   *
   * @param expectedMessage - Mensaje esperado (o patrón)
   * @param timeoutMs - Timeout en milisegundos (default: 5000)
   * @returns Promise que se resuelve con el mensaje recibido
   */
  waitForMessage(expectedMessage: string | RegExp, timeoutMs: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('[Stockfish Worker] Waiting for message:', expectedMessage, 'timeout:', timeoutMs, 'ms');
      const subscription = this.filterMessages(expectedMessage)
        .pipe(
          timeout(timeoutMs),
          catchError((error) => {
            subscription.unsubscribe();
            console.error('[Stockfish Worker] Timeout waiting for message:', expectedMessage, error);
            return throwError(() => new Error(`Timeout waiting for message: ${expectedMessage}`));
          })
        )
        .subscribe({
          next: (message) => {
            console.log('[Stockfish Worker] Received expected message:', message);
            subscription.unsubscribe();
            resolve(message);
          },
          error: (error) => {
            console.error('[Stockfish Worker] Error waiting for message:', expectedMessage, error);
            subscription.unsubscribe();
            reject(error);
          },
        });
    });
  }

  /**
   * Parsea un mensaje UCI de tipo 'info'
   *
   * @param message - Mensaje UCI a parsear
   * @returns Objeto con la información parseada o null si no es un mensaje info válido
   */
  parseInfoMessage(message: string): UCIInfoMessage | null {
    if (!message.startsWith('info')) {
      return null;
    }

    const parts = message.split(' ');
    const info: UCIInfoMessage = {};

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === 'depth' && parts[i + 1]) {
        info.depth = parseInt(parts[i + 1], 10);
      } else if (part === 'score' && parts[i + 1]) {
        if (parts[i + 1] === 'cp' && parts[i + 2]) {
          info.score = { cp: parseInt(parts[i + 2], 10) };
        } else if (parts[i + 1] === 'mate' && parts[i + 2]) {
          info.score = { mate: parseInt(parts[i + 2], 10) };
        }
      } else if (part === 'nodes' && parts[i + 1]) {
        info.nodes = parseInt(parts[i + 1], 10);
      } else if (part === 'time' && parts[i + 1]) {
        info.time = parseInt(parts[i + 1], 10);
      } else if (part === 'multipv' && parts[i + 1]) {
        info.multipv = parseInt(parts[i + 1], 10);
      } else if (part === 'pv') {
        // Principal variation - todos los movimientos después de 'pv'
        info.pv = parts.slice(i + 1);
        break;
      }
    }

    return info;
  }

  /**
   * Parsea un mensaje UCI de tipo 'bestmove'
   *
   * @param message - Mensaje UCI a parsear
   * @returns Objeto con el mejor movimiento o null si no es un mensaje bestmove válido
   */
  parseBestMoveMessage(message: string): UCIBestMoveMessage | null {
    if (!message.startsWith('bestmove')) {
      return null;
    }

    const parts = message.split(' ').filter(p => p.length > 0); // Filtrar strings vacíos
    console.log('[Stockfish Worker] Parsing bestmove, parts:', parts);
    
    const result: UCIBestMoveMessage = {
      move: parts[1] || '',
    };

    console.log('[Stockfish Worker] Parsed move:', result.move);

    // Buscar 'ponder' si existe
    const ponderIndex = parts.indexOf('ponder');
    if (ponderIndex !== -1 && parts[ponderIndex + 1]) {
      result.ponder = parts[ponderIndex + 1];
      console.log('[Stockfish Worker] Parsed ponder:', result.ponder);
    }

    return result;
  }

  /**
   * Termina el Worker y limpia recursos
   */
  terminate(): void {
    console.log('[Stockfish Worker] Terminating worker, isInitialized:', this.isInitialized);
    if (this.worker) {
      try {
        // Enviar comando stop antes de terminar
        try {
          this.worker.postMessage('stop');
        } catch (e) {
          // Ignorar errores al enviar stop si el worker ya está muerto
        }
        this.worker.terminate();
      } catch (error) {
        console.error('[Stockfish Worker] Error terminating worker:', error);
      }
      this.worker = null;
      this.isInitialized = false;
    }
    // No completar los subjects, solo limpiar el estado
    // Los subjects pueden ser reutilizados si se reinicializa
  }

  /**
   * Verifica si el Worker está inicializado
   *
   * @returns true si está inicializado, false en caso contrario
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Envía comando UCI y espera respuesta
   */
  private async sendUCICommand(): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    console.log('[Stockfish Worker] Sending UCI command:', UCICommand.UCI);
    this.worker.postMessage(UCICommand.UCI);
  }

  /**
   * Espera a que el motor responda 'readyok'
   */
  private async waitForReady(): Promise<void> {
    console.log('[Stockfish Worker] Sending isready command...');
    this.worker?.postMessage(UCICommand.IsReady);
    console.log('[Stockfish Worker] Waiting for readyok response (timeout:', this.uciTimeout, 'ms)...');
    await this.waitForMessage(UCIResponse.ReadyOk, this.uciTimeout);
    console.log('[Stockfish Worker] Received readyok, worker is ready');
  }
}
