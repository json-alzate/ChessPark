import { Component, OnInit, AfterViewInit, OnDestroy, Input, Output, EventEmitter, Renderer2, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// rxjs
import { interval, Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  COLOR,
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';
import { Chess } from 'chess.js';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { Arrows } from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';

// Ionic
import { ModalController } from '@ionic/angular/standalone';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  swapVerticalOutline,
  playBackOutline,
  chevronBackOutline,
  chevronForwardOutline,
  playSkipForwardOutline,
  playForwardOutline
} from 'ionicons/icons';

// Transloco
import { TranslocoPipe } from '@jsverse/transloco';

// models
import { Puzzle } from '@cpark/models';

// Utils
import { SecondsToMinutesSecondsPipe, SoundsService } from '@chesspark/common-utils';

// Stockfish
import {
  StockfishService,
  StockfishAnalysisService,
} from '@chesspark/stockfish-wasm';

@Component({
  selector: 'lib-board-puzzle-solution',
  standalone: true,
  imports: [CommonModule, SecondsToMinutesSecondsPipe, TranslocoPipe, IonIcon],
  templateUrl: './board-puzzle-solution.component.html',
  styleUrls: ['./board-puzzle-solution.component.scss'],
})
export class BoardPuzzleSolutionComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() puzzle!: Puzzle;
  @Input() themesTranslated: string[] = [];

  @Output() close = new EventEmitter<void>();

  soundsService = inject(SoundsService);
  private modalController = inject(ModalController);
  private renderer = inject(Renderer2);

  board!: Chessboard;
  chessInstance = new Chess();
  closeCancelMoves = false;

  // Stockfish
  private stockfishService: StockfishService = inject(StockfishService);
  private stockfishAnalysisService: StockfishAnalysisService = inject(StockfishAnalysisService);
  stockfishEnabled = false;
  stockfishInitialized = false;
  bestMove: string | null = null;
  private isAnalyzingPosition = false;

  currentMoveNumber = 0;
  arrayFenSolution: string[] = [];
  arrayMovesSolution: string[] = [];
  totalMoves = 0;
  allowMoveArrows = false;
  fenToCompareAndPlaySound!: string;
  piecePathKingTurn = '';

  subsSeconds!: Observable<number>;
  timerUnsubscribe$ = new Subject<void>();
  time = 0;

  isClueActive = false;
  okTextShow = false;
  wrongTextShow = false;

  // Estados de carga para bloqueo de botones
  isPlaying = false;
  isClosing = false;
  isShowingClue = false;
  isShowingSolution = false;

  get isAnyActionInProgress(): boolean {
    return this.isPlaying || this.isClosing || this.isShowingClue || this.isShowingSolution;
  }

  constructor() {
    // Registrar iconos de Ionic
    addIcons({
      closeOutline,
      swapVerticalOutline,
      playBackOutline,
      chevronBackOutline,
      chevronForwardOutline,
      playSkipForwardOutline,
      playForwardOutline
    });
  }

  async ngOnInit() {
    this.startTimer();
    // Inicializar Stockfish
    console.log('[Stockfish] Starting initialization...');
    try {
      // Asegurarse de que no haya un worker anterior activo
      if (this.stockfishService.isReady) {
        console.log('[Stockfish] Service already ready, terminating previous instance');
        this.stockfishService.terminate();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await this.stockfishService.initialize({
        depth: 15,
        threads: 1,
        hash: 16,
        workerPath: 'assets/engine/stockfish-16.1-lite-single.js',
      });
      this.stockfishInitialized = true;
      console.log('[Stockfish] Initialized successfully, isReady:', this.stockfishService.isReady);
    } catch (error) {
      console.error('[Stockfish] Failed to initialize:', error);
      this.stockfishInitialized = false;
      // Intentar limpiar en caso de error
      try {
        this.stockfishService.terminate();
      } catch (e) {
        console.error('[Stockfish] Error during cleanup:', e);
      }
    }
  }

  ngAfterViewInit() {
    // Esperar a que el elemento esté en el DOM antes de construir el tablero
    setTimeout(() => {
      this.buildBoard(this.puzzle.fen);
    }, 0);
  }

  /**
   * Activa o desactiva Stockfish
   */
  async startStockfish(event: { detail: { checked: boolean } }) {
    if (!this.stockfishInitialized || !this.stockfishService.isReady) {
      console.warn('Stockfish not initialized');
      return;
    }

    if (event.detail.checked) {
      this.stockfishEnabled = true;
      await this.analyzeCurrentPosition();
    } else {
      this.stockfishEnabled = false;
      console.log('[Stockfish] Disabled');
      this.stockfishService.stopAnalysis();
      this.removeAllStockfishIndicators();
      this.bestMove = null;
    }
  }

  /**
   * Analiza la posición actual con Stockfish
   */
  async analyzeCurrentPosition() {
    if (!this.stockfishEnabled) {
      console.log('[Stockfish] Analysis skipped - Stockfish disabled');
      return;
    }

    // Evitar análisis concurrentes: si ya hay uno en curso, cancelarlo primero
    if (this.isAnalyzingPosition) {
      try {
        this.stockfishService.stopAnalysis();
      } catch (e) { /* ignorar */ }
      return;
    }

    if (!this.stockfishService.isReady || !this.stockfishInitialized) {
      console.warn('[Stockfish] Analysis skipped - service not ready. isReady:', this.stockfishService.isReady, 'initialized:', this.stockfishInitialized);
      this.stockfishEnabled = false;
      return;
    }

    // Detener análisis anterior si existe
    try {
      this.stockfishService.stopAnalysis();
    } catch (error) {
      console.warn('[Stockfish] Error stopping previous analysis:', error);
    }

    this.isAnalyzingPosition = true;
    try {
      const fen = this.chessInstance.fen();
      console.log('[Stockfish] Starting analysis for FEN:', fen);

      // Obtener mejor movimiento
      console.log('[Stockfish] Requesting best move with depth 15...');
      const result = await this.stockfishAnalysisService.getBestMove(fen, {
        depth: 15,
      });

      console.log('[Stockfish] Analysis result:', result);
      if (result && result.move) {
        this.bestMove = result.move;
        console.log('[Stockfish] Best move found:', this.bestMove, 'length:', this.bestMove.length);

        // Verificar que el tablero esté disponible
        if (this.board) {
          this.drawStockfishMarkers();
          this.drawStockfishArrows();
        } else {
          console.warn('[Stockfish] Board not available, cannot draw indicators');
        }
      } else {
        console.warn('[Stockfish] No best move in result:', result);
      }
    } catch (error) {
      console.error('[Stockfish] Error analyzing position:', error);
      
      // Si el error es que el worker no está inicializado, intentar reinicializar
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.warn('[Stockfish] Worker lost, attempting to reinitialize...');
        this.stockfishInitialized = false;
        try {
          // Terminar el worker anterior si existe
          this.stockfishService.terminate();
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Intentar reinicializar
          await this.stockfishService.initialize({
            depth: 15,
            threads: 1,
            hash: 16,
            workerPath: 'assets/engine/stockfish-16.1-lite-single.js',
          });
          this.stockfishInitialized = true;
          console.log('[Stockfish] Reinitialized successfully');

          // Intentar el análisis de nuevo (resetear el guard antes de la llamada recursiva)
          if (this.stockfishEnabled) {
            this.isAnalyzingPosition = false;
            await this.analyzeCurrentPosition();
          }
        } catch (reinitError) {
          console.error('[Stockfish] Failed to reinitialize:', reinitError);
          this.stockfishEnabled = false;
          this.stockfishInitialized = false;
        }
        return;
      }
      
      // Si hay un error crítico, desactivar Stockfish
      if (error instanceof Error && (error.message.includes('memory') || error.message.includes('terminated'))) {
        console.error('[Stockfish] Critical error, disabling Stockfish');
        this.stockfishEnabled = false;
        this.stockfishInitialized = false;
        try {
          this.stockfishService.terminate();
        } catch (e) {
          console.error('[Stockfish] Error terminating after critical error:', e);
        }
      }
    } finally {
      this.isAnalyzingPosition = false;
    }
  }

  /**
   * Dibuja marcadores en el tablero para la mejor jugada de Stockfish
   */
  drawStockfishMarkers() {
    this.removeStockfishMarkers();
    if (this.bestMove && this.bestMove.length >= 4) {
      const markerType = {
        id: 'stockfishBestMove',
        class: 'marker-square-stockfish-best-move',
        slice: 'markerSquare',
      };
      const from = this.bestMove.slice(0, 2);
      const to = this.bestMove.slice(2, 4);
      console.log('[Stockfish] Drawing markers from', from, 'to', to);
      this.board.addMarker(markerType, from);
      this.board.addMarker(markerType, to);
    }
  }

  /**
   * Dibuja flechas en el tablero para la mejor jugada de Stockfish
   */
  drawStockfishArrows() {
    if (!this.board) {
      console.warn('[Stockfish] Cannot draw arrows: board not available');
      return;
    }

    this.removeStockfishArrows();
    if (this.bestMove && this.bestMove.length >= 4) {
      const arrowType = {
        id: 'stockfishBestMove',
        class: 'arrow-stockfish-best-move',
        headSize: 7,
        slice: 'arrowPointy',
      };
      const from = this.bestMove.slice(0, 2);
      const to = this.bestMove.slice(2, 4);
      console.log('[Stockfish] Drawing arrow from', from, 'to', to, 'bestMove:', this.bestMove);

      try {
        this.board.addArrow(arrowType, from, to);
        console.log('[Stockfish] Arrow added successfully');
      } catch (error) {
        console.error('[Stockfish] Error adding arrow:', error);
      }
    } else {
      console.warn('[Stockfish] Cannot draw arrow: bestMove invalid', this.bestMove);
    }
  }

  /**
   * Remueve las flechas de Stockfish del tablero
   */
  removeStockfishArrows() {
    if (!this.board) {
      return;
    }
    // Obtener todas las flechas y remover las de Stockfish
    // Nota: removeArrows() remueve todas las flechas, pero esto es intencional
    // ya que solo se llama cuando se desactiva Stockfish o se va a dibujar una nueva
    try {
      this.board.removeArrows();
      console.log('[Stockfish] Removed all arrows');
    } catch (error) {
      console.error('[Stockfish] Error removing arrows:', error);
    }
  }

  /**
   * Remueve los marcadores de Stockfish del tablero
   */
  removeStockfishMarkers() {
    // Obtener todos los marcadores y remover los de Stockfish
    const allMarkers = this.board.getMarkers();
    allMarkers.forEach(marker => {
      if (marker.type.id === 'stockfishBestMove') {
        this.board.removeMarkers(marker.type, marker.square);
      }
    });
  }

  /**
   * Remueve tanto marcadores como flechas de Stockfish
   */
  removeAllStockfishIndicators() {
    this.removeStockfishMarkers();
    this.removeStockfishArrows();
  }

  removeArrows() {
    // Guardar si hay flechas de Stockfish activas
    const hadStockfishArrows = this.stockfishEnabled && this.bestMove;

    // Remover todas las flechas
    this.board.removeArrows();

    // Volver a dibujar las flechas de Stockfish si estaban activas
    if (hadStockfishArrows) {
      this.drawStockfishArrows();
    }
  }

  closeModal() {
    this.closeCancelMoves = true;
    this.timerUnsubscribe$.next();
    // Resetear estados de carga
    this.isClosing = false;
    this.isPlaying = false;
    if (this.modalController) {
      this.modalController.dismiss();
    }
    this.close.emit();
  }

  startTimer() {
    this.subsSeconds = interval(1000);
    this.subsSeconds.pipe(
      takeUntil(this.timerUnsubscribe$)
    ).subscribe(() => {
      this.time++;
    });
  }

  stopTimer() {
    if (this.timerUnsubscribe$) {
      this.timerUnsubscribe$.next();
      this.timerUnsubscribe$.complete();
    }
  }

  async buildBoard(fen: string) {

    console.log('buildBoard', fen);

    this.chessInstance.load(this.puzzle.fen);
    this.piecePathKingTurn = this.chessInstance.turn() === 'b' ? 'wK.svg' : 'bK.svg';

    this.board = await new Chessboard(document.getElementById('boardPuzzleSolution') as HTMLElement, {
      responsive: true,
      position: fen,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.thin,
        pieces: {
          file: 'pieces/standard.svg',
        }
      },
      extensions: [
        { class: Markers },
        { class: Arrows },
        { class: PromotionDialog }
      ]
    });

    this.board.enableMoveInput((event) => {
      // handle user input here
      switch (event.type) {

        case 'moveInputStarted':
          this.board.removeMarkers();
          this.showLastMove();
          this.removeArrows();

          // mostrar indicadores para donde se puede mover la pieza
          if (event.square && this.chessInstance.moves({ square: event.square as any }).length > 0) {
            // adiciona el marcador para la casilla seleccionada
            const markerSquareSelected = { class: 'marker-square-green', slice: 'markerSquare' };
            this.board.addMarker(markerSquareSelected, event.square);
            const possibleMoves = this.chessInstance.moves({ square: event.square as any, verbose: true });
            for (const move of possibleMoves) {
              const markerDotMove = { class: 'marker-dot-green', slice: 'markerDot' };
              this.board.addMarker(markerDotMove, move.to);
            }
          }
          return true;

        case 'validateMoveInput':
          // Aplicar correcciones de board-puzzle.component.ts para promoción de peones
          if (event.squareTo && event.piece && event.squareFrom &&
            (event.squareTo.charAt(1) === '8' || event.squareTo.charAt(1) === '1') &&
            event.piece.charAt(1) === 'p') {

            // Validar primero si el movimiento básico del peón es válido
            try {
              // Verificar que hay movimientos posibles desde la casilla de origen
              const possibleMoves = this.chessInstance.moves({
                square: event.squareFrom as any,
                verbose: true
              });

              const isValidPawnMove = possibleMoves.some(move => move.to === event.squareTo);

              if (!isValidPawnMove) {
                this.board.removeMarkers();
                this.showLastMove();
                return false;
              }

              const colorToShow = event.piece.charAt(0) === 'w' ? COLOR.white : COLOR.black;
              // Mostrar diálogo de promoción solo si el movimiento básico es válido
              this.board.showPromotionDialog(event.squareTo, colorToShow, (result) => {
                if (result && result.piece && event.squareFrom && event.squareTo) {
                  const objectMovePromotion = {
                    from: event.squareFrom,
                    to: event.squareTo,
                    promotion: result.piece.charAt(1)
                  };

                  // Validar primero con chess.js antes de actualizar el tablero
                  try {
                    const theMovePromotion = this.chessInstance.move(objectMovePromotion);

                    if (theMovePromotion) {
                      // Solo si el movimiento es válido, sincronizar el tablero con el estado de chess.js
                      this.board.setPosition(this.chessInstance.fen(), false);

                      this.board.removeArrows();
                      this.showLastMove();
                      this.validateMove();
                    } else {
                      this.board.setPosition(this.chessInstance.fen(), false);
                      this.board.removeMarkers();
                      this.showLastMove();
                    }
                  } catch (error) {
                    this.board.setPosition(this.chessInstance.fen(), false);
                    this.board.removeMarkers();
                    this.showLastMove();
                    console.log('Invalid promotion move:', error);
                  }
                } else {
                  this.board.setPosition(this.chessInstance.fen(), false);
                  this.board.removeMarkers();
                  this.showLastMove();
                }
              });

              // Retornar true para aceptar el movimiento pendiente de promoción
              return true;
            } catch (error) {
              this.board.removeMarkers();
              this.showLastMove();
              return false;
            }
          }

          if (event.squareFrom && event.squareTo) {
            const objectMove = { from: event.squareFrom, to: event.squareTo };
            try {
              const theMove = this.chessInstance.move(objectMove);

              if (theMove) {
                this.board.removeArrows();
                this.showLastMove();
                this.validateMove();
              } else {
                this.board.removeMarkers();
                this.showLastMove();
              }
              return theMove ? true : false;
            } catch (error) {
              this.board.removeMarkers();
              this.showLastMove();
              return false;
            }
          }
          this.board.removeMarkers();
          this.showLastMove();
          return false;

        case 'moveInputCanceled':
          this.board.removeMarkers();
          this.showLastMove();
          this.removeArrows();
          return true;
        case 'moveInputFinished':
          return true;
        default:
          return true;
      }
    });

    this.turnRoundBoard(this.chessInstance.turn() === 'b' ? 'w' : 'b');
    this.fenToCompareAndPlaySound = this.puzzle.fen;
    this.getMoves();
  }

  getMoves() {
    this.currentMoveNumber = 0;
    this.allowMoveArrows = false;

    this.arrayFenSolution = [];
    // se construye un arreglo con los fen de la solución
    this.arrayMovesSolution = this.puzzle.moves.split(' ');
    this.arrayFenSolution.push(this.chessInstance.fen());

    for (const move of this.arrayMovesSolution) {
      this.chessInstance.move(move);
      const fen = this.chessInstance.fen();
      this.arrayFenSolution.push(fen);
    }
    this.totalMoves = this.arrayFenSolution.length - 1;

    // ejecutar primera jugada
    this.puzzleMoveResponse();
  }

  async validateMove() {
    if (!this.allowMoveArrows) {
      // Durante el puzzle: validar que el movimiento sea el correcto
      const fenChessInstance = this.chessInstance.fen();

      this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, fenChessInstance);

      this.currentMoveNumber++;
      if (fenChessInstance === this.arrayFenSolution[this.currentMoveNumber] || this.chessInstance.isCheckmate()) {
        this.puzzleMoveResponse();
        this.okTextShow = true;
        this.wrongTextShow = false;
      } else {
        this.okTextShow = false;
        this.wrongTextShow = true;
        this.soundsService.playError();
        this.rollBackMove();
      }
    } else {
      // Después de completar el puzzle: permitir cualquier movimiento legal
      // Solo actualizar la posición y mostrar la última jugada
      this.showLastMove();
      // Actualizar Stockfish si está habilitado
      if (this.stockfishEnabled) {
        this.analyzeCurrentPosition();
      }
    }

    // Actualiza el tablero después de un movimiento de enroque
    if (
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('k') ||
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('q')) {
      this.board.setPosition(this.chessInstance.fen());
    }

    // Actualizar Stockfish si está habilitado
    if (this.stockfishEnabled) {
      this.analyzeCurrentPosition();
    }
  }

  async rollBackMove() {
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 400);
    });
    this.currentMoveNumber--;
    this.board.removeMarkers();
    this.removeArrows();
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();
  }

  async puzzleMoveResponse(origin?: 'user') {
    // Si se llama desde el botón de usuario, desactivar por 3 segundos
    if (origin === 'user') {
      this.isShowingSolution = true;
      // Resetear después de 3 segundos
      setTimeout(() => {
        this.isShowingSolution = false;
      }, 3000);
    }

    this.currentMoveNumber++;

    if (this.arrayFenSolution.length === this.currentMoveNumber) {
      this.allowMoveArrows = true;
      this.stopTimer();
      this.currentMoveNumber--;
      console.log('Puzzle completed, allowMoveArrows:', this.allowMoveArrows, 'stockfishInitialized:', this.stockfishInitialized);
    } else {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
      const fen = this.chessInstance.fen();
      this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, fen);
      this.fenToCompareAndPlaySound = fen;
      this.board.removeMarkers();
      this.removeArrows();

      await this.board.setPosition(fen, true);
      const from = this.arrayMovesSolution[this.currentMoveNumber - 1].slice(0, 2);
      const to = this.arrayMovesSolution[this.currentMoveNumber - 1].slice(2, 4);
      this.showLastMove(from, to);

      if (origin === 'user') {
        this.puzzleMoveResponse();
      }

      // Actualizar Stockfish si está habilitado
      if (this.stockfishEnabled) {
        this.analyzeCurrentPosition();
      }
    }
  }

  async showClue(times?: number) {
    // Marcar el inicio de la ejecución
    if (!times) {
      this.isClueActive = true;
      this.isShowingClue = true;
      times = 1; // Inicializa `times` si no se proporciona.
    }

    const square = this.puzzle.moves.split(' ')[this.currentMoveNumber].slice(0, 2);
    if (!square) {
      console.error('No square to mark');
      this.isClueActive = false;
      this.isShowingClue = false;
      return;
    }

    // Limpia cualquier marca previa que no sea 'lastMove'.
    const markersOnSquare = this.board.getMarkers(undefined, square);
    markersOnSquare.forEach(marker => {
      if (marker.type.id !== 'lastMove') {
        this.board.removeMarkers(marker.type, square);
      }
    });

    // Alterna el marcador para simular parpadeo.
    const markerToAdd = { id: 'clue', class: 'marker-square-clue', slice: 'markerSquare' };
    if (times % 2 === 1) {
      // Añade marcador.
      this.board.addMarker(markerToAdd, square);
    } else {
      // Elimina marcador.
      this.board.removeMarkers(markerToAdd, square);
    }

    // Detén el parpadeo después de 8 alternancias.
    if (times === 8) {
      this.isClueActive = false; // Libera la bandera
      this.isShowingClue = false;
      return;
    }

    // Repite después de 500ms
    setTimeout(() => this.showClue(times + 1), 500);
  }

  /** Elimina todos los marcadores del tablero excepto los de última jugada (lastMove). */
  removeMarkerNotLastMove(square?: string) {
    const markersToProcess = square
      ? this.board.getMarkers(undefined, square)
      : this.board.getMarkers();
    markersToProcess.forEach((marker: { type: { id?: string }; square?: string }) => {
      if (marker.type?.id !== 'lastMove') {
        this.board.removeMarkers(marker.type, square ?? marker.square);
      }
    });
  }

  // Board controls -----------------------------------

  turnRoundBoard(orientation?: 'w' | 'b') {
    if (orientation) {
      this.board.setOrientation(orientation);
    } else {
      if (this.board.getOrientation() === 'w') {
        this.board.setOrientation('b');
      } else {
        this.board.setOrientation('w');
      }
    }
  }

  async startMoves() {
    this.isPlaying = true;
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = this.currentMoveNumber + 1; i < this.arrayFenSolution.length; i++) {
      if (this.closeCancelMoves) {
        this.isPlaying = false;
        break;
      }
      let lastMove;
      if (!this.arrayFenSolution[i - 1]) {
        lastMove = this.puzzle.fen;
      } else {
        lastMove = this.arrayFenSolution[i - 1];
      }
      await this.board.setPosition(this.arrayFenSolution[i], true);
      this.soundsService.determineChessMoveType(lastMove, this.arrayFenSolution[i]);

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1000);
      });

      if (this.arrayMovesSolution[i]) {
        const from = this.arrayMovesSolution[i].slice(0, 2);
        const to = this.arrayMovesSolution[i].slice(2, 4);
        this.showLastMove(from, to);
      }
    }
    this.isPlaying = false;
    this.isClosing = true;
    setTimeout(() => {
      this.closeModal();
    }, 1500);
  }

  showLastMove(from?: string, to?: string) {
    this.board.removeMarkers();
    if (!from && !to) {
      // eslint-disable-next-line max-len
      from = this.chessInstance.history({ verbose: true }).slice(-1)[0]?.from;
      to = this.chessInstance.history({ verbose: true }).slice(-1)[0]?.to;

      if (!from || !to) {
        from = this.arrayMovesSolution[this.currentMoveNumber - 1]?.slice(0, 2);
        to = this.arrayMovesSolution[this.currentMoveNumber - 1]?.slice(2, 4);
      }
    }
    if (from && to) {
      const marker = { id: 'lastMove', class: 'marker-square-green', slice: 'markerSquare' };
      this.board.addMarker(marker, from);
      this.board.addMarker(marker, to);
    }
  }

  // Navigation controls

  starPosition() {
    this.board.removeArrows();
    this.board.removeMarkers();
    this.board.setPosition(this.puzzle.fen, true);
    this.chessInstance.load(this.puzzle.fen);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.currentMoveNumber = 0;

    // Actualizar Stockfish si está habilitado
    if (this.stockfishEnabled) {
      this.analyzeCurrentPosition();
    }
  }

  /**
   * Navega a la anterior jugada en el tablero
   * Navigate to the previous play on the board
   */
  backMove() {
    if (this.currentMoveNumber <= 0) {
      return;
    } else {
      this.currentMoveNumber--;
    }
    this.board.removeMarkers();
    this.removeArrows();
    this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, this.chessInstance.fen());
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.showLastMove();

    // Actualizar Stockfish si está habilitado
    if (this.stockfishEnabled) {
      this.analyzeCurrentPosition();
    }
  }

  /**
   * Navega a la siguiente jugada en el tablero
   * Navigate to the next play on the board
   */
  nextMove() {
    if (this.currentMoveNumber >= this.totalMoves) {
      return;
    } else {
      this.currentMoveNumber++;
    }
    this.board.removeMarkers();
    this.removeArrows();
    this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, this.chessInstance.fen());
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();

    // Actualizar Stockfish si está habilitado
    if (this.stockfishEnabled) {
      this.analyzeCurrentPosition();
    }
  }

  moveToEnd() {
    this.currentMoveNumber = this.totalMoves;
    this.board.removeMarkers();
    this.removeArrows();
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();

    // Actualizar Stockfish si está habilitado
    if (this.stockfishEnabled) {
      this.analyzeCurrentPosition();
    }
  }

  ngOnDestroy() {
    console.log('[Stockfish] Component destroying, cleaning up...');
    // Detener análisis si está activo
    if (this.stockfishEnabled) {
      try {
        this.stockfishService.stopAnalysis();
      } catch (error) {
        console.warn('[Stockfish] Error stopping analysis:', error);
      }
    }

    // Limpiar recursos de Stockfish
    try {
      if (this.stockfishService) {
        this.stockfishService.terminate();
        console.log('[Stockfish] Worker terminated');
      }
    } catch (error) {
      console.error('[Stockfish] Error terminating Stockfish:', error);
    }
    this.stopTimer();
  }
}

