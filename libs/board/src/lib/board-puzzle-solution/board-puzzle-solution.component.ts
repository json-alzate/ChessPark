import { Component, OnInit, AfterViewInit, OnDestroy, Input, Output, EventEmitter, Renderer2, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// rxjs
import { interval, Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  Chessboard
} from 'cm-chessboard';
import { createChessboard } from '../chessboard-factory/create-chessboard';
import { createMoveInputHandler, MoveInputHost } from '../move-input/move-input-handler';
import { drawLastMove, removeMarkersExceptLastMove, turnBoard } from '../move-input/board-markers';
import { Chess, Square } from 'chess.js';
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
import { Puzzle } from '@chesspark/models';

// Utils
import { SecondsToMinutesSecondsPipe, SoundsService } from '@chesspark/common-utils';

// Stockfish (el ciclo de vida del motor vive en el facade)
import { StockfishEngineFacade } from '../stockfish-engine/stockfish-engine.facade';

@Component({
  selector: 'lib-board-puzzle-solution',
  standalone: true,
  imports: [CommonModule, SecondsToMinutesSecondsPipe, TranslocoPipe, IonIcon],
  providers: [StockfishEngineFacade],
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

  /**
   * Cómo el manejador de movimientos compartido (ver move-input/move-input-handler.ts) consulta
   * y modifica este componente. Aquí el estado de ajedrez es `chessInstance`, y al empezar o
   * cancelar una jugada se usa `removeArrows()` del componente para conservar las flechas de
   * Stockfish si están activas.
   */
  private readonly moveInputHost: MoveInputHost = {
    board: () => this.board,
    destinationsFrom: (square) =>
      this.chessInstance.moves({ square: square as Square, verbose: true }).map((move) => move.to),
    tryMove: (from, to, promotion) => {
      try {
        const move = promotion
          ? this.chessInstance.move({ from, to, promotion })
          : this.chessInstance.move({ from, to });
        return !!move;
      } catch {
        return false;
      }
    },
    fen: () => this.chessInstance.fen(),
    showLastMove: () => this.showLastMove(),
    clearArrows: () => this.removeArrows(),
    onMoveAccepted: () => this.validateMove(),
  };
  closeCancelMoves = false;

  // Stockfish: la UI guarda solo si está activo y la última jugada. El ciclo de vida del motor
  // (init, terminate, reinicios y errores del worker) lo gestiona StockfishEngineFacade.
  private engine = inject(StockfishEngineFacade);
  stockfishEnabled = false;
  bestMove: string | null = null;

  /** Motor listo para analizar. Se consulta al facade para no duplicar ese estado. */
  get stockfishInitialized(): boolean {
    return this.engine.isReady;
  }

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
    // El facade inicializa el worker y gestiona reintentos y errores
    await this.engine.initialize();
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
    if (!this.stockfishInitialized) {
      console.warn('Stockfish not initialized');
      return;
    }

    if (event.detail.checked) {
      this.stockfishEnabled = true;
      await this.analyzeCurrentPosition();
    } else {
      this.stockfishEnabled = false;
      console.log('[Stockfish] Disabled');
      this.engine.cancel();
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

    const outcome = await this.engine.getBestMove(this.chessInstance.fen());

    if (outcome.kind === 'unavailable') {
      // El motor no está disponible ni se pudo recuperar: se desactiva la opción en la UI
      this.stockfishEnabled = false;
      return;
    }

    // Si el usuario desactivó Stockfish mientras se analizaba, no se dibuja la jugada
    if (outcome.kind === 'best-move' && this.stockfishEnabled) {
      this.bestMove = outcome.move;
      // Verificar que el tablero esté disponible
      if (this.board) {
        this.drawStockfishMarkers();
        this.drawStockfishArrows();
      } else {
        console.warn('[Stockfish] Board not available, cannot draw indicators');
      }
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

    this.board = await createChessboard(document.getElementById('boardPuzzleSolution') as HTMLElement, {
      position: fen,
      extensions: [
        { class: Markers },
        { class: Arrows },
        { class: PromotionDialog },
      ],
    });

    this.board.enableMoveInput(createMoveInputHandler(this.moveInputHost));

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
    removeMarkersExceptLastMove(this.board, square);
  }

  // Board controls -----------------------------------

  turnRoundBoard(orientation?: 'w' | 'b') {
    turnBoard(this.board, orientation);
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
    if (!from && !to) {
      // Sin argumentos: la última jugada de chess.js o, si el historial está vacío, la de la solución
      const last = this.chessInstance.history({ verbose: true }).slice(-1)[0];
      from = last?.from;
      to = last?.to;

      if (!from || !to) {
        from = this.arrayMovesSolution[this.currentMoveNumber - 1]?.slice(0, 2);
        to = this.arrayMovesSolution[this.currentMoveNumber - 1]?.slice(2, 4);
      }
    }
    drawLastMove(this.board, from, to);
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
    // El facade es dueño del worker: termina el motor y detiene cualquier análisis en curso
    this.engine.dispose();
    this.stopTimer();
  }
}

