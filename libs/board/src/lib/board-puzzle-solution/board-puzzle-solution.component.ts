import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, Renderer2, inject } from '@angular/core';
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

@Component({
  selector: 'lib-board-puzzle-solution',
  standalone: true,
  imports: [CommonModule, SecondsToMinutesSecondsPipe, TranslocoPipe, IonIcon],
  templateUrl: './board-puzzle-solution.component.html',
  styleUrls: ['./board-puzzle-solution.component.scss'],
})
export class BoardPuzzleSolutionComponent implements OnInit, AfterViewInit {

  @Input() puzzle!: Puzzle;
  @Input() themesTranslated: string[] = [];

  @Output() close = new EventEmitter<void>();

  soundsService = inject(SoundsService);
  private modalController = inject(ModalController);
  private renderer = inject(Renderer2);

  board!: Chessboard;
  chessInstance = new Chess();
  closeCancelMoves = false;

  // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
  // stockfishEnabled = false;
  // bestMove = '';

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

  ngOnInit() {
    this.startTimer();
  }

  ngAfterViewInit() {
    // Esperar a que el elemento esté en el DOM antes de construir el tablero
    setTimeout(() => {
      this.buildBoard(this.puzzle.fen);
    }, 0);
  }

  // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
  // startStockfish(event) {
  //   if (event.detail.checked) {
  //     this.stockfishEnabled = true;
  //     // Inicia el motor y envía comandos
  //     this.stockfishService.postMessage('uci');
  //     this.stockfishService.postMessage(
  //       'position fen ' + this.chessInstance.fen()
  //     );
  //     this.stockfishService.postMessage('go depth 15');
  //   } else {
  //     this.stockfishEnabled = false;
  //     this.stockfishService.postMessage('stop');
  //     this.removeStockfishMarkers();
  //   }
  // }

  // listenStockfish() {
  //   // Escucha los mensajes del motor
  //   this.stockfishService.onMessage((message) => {
  //     if (message.startsWith('bestmove')) {
  //       console.log('bestmove', message);
  //       this.bestMove = message;
  //       this.drawStockfishMarkers();
  //     }
  //   });
  // }

  // drawStockfishArrows() {
  //   if (this.bestMove) {
  //     const arrowType = {
  //       id: 'stockfishBestMove',
  //       class: 'arrow-stockfish-best-move',
  //       headSize: 7,
  //       slice: 'arrowPointy'
  //     };
  //     const bestMove = this.bestMove.split(' ')[1];
  //     this.board.removeArrows();
  //     this.board.addArrow(arrowType, bestMove.slice(0, 2), bestMove.slice(2, 4));
  //   }
  // }

  // drawStockfishMarkers() {
  //   this.removeStockfishMarkers();
  //   if (this.bestMove) {
  //     const markerType = {
  //       id: 'stockfishBestMove',
  //       class: 'marker-square-stockfish-best-move',
  //       slice: 'markerSquare'
  //     };
  //     const bestMove = this.bestMove.split(' ')[1];
  //     this.board.addMarker(markerType, bestMove.slice(0, 2));
  //     this.board.addMarker(markerType, bestMove.slice(2, 4));
  //   }
  // }

  // removeStockfishMarkers() {
  //   this.board.removeMarkers('stockfishBestMove');
  // }

  removeArrows() {
    // remove board arrows
    this.board.removeArrows();
  }

  closeModal() {
    this.closeCancelMoves = true;
    this.timerUnsubscribe$.next();
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
                // El movimiento del peón no es válido, rechazar
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
                      // Movimiento inválido, restaurar posición original
                      this.board.setPosition(this.chessInstance.fen(), false);
                    }
                  } catch (error) {
                    // Movimiento de promoción inválido, restaurar posición original
                    this.board.setPosition(this.chessInstance.fen(), false);
                    console.log('Invalid promotion move:', error);
                  }
                } else {
                  // Usuario canceló la promoción, restaurar posición original
                  this.board.setPosition(this.chessInstance.fen(), false);
                }
              });
              
              // Retornar true para aceptar el movimiento pendiente de promoción
              return true;
            } catch (error) {
              // Error al validar el movimiento básico
              return false;
            }
          }

          // Validación de movimientos normales (aplicando correcciones de board-puzzle.component.ts)
          if (event.squareFrom && event.squareTo) {
            const objectMove = { from: event.squareFrom, to: event.squareTo };
            try {
              const theMove = this.chessInstance.move(objectMove);

              if (theMove) {
                this.board.removeArrows();
                this.showLastMove();
                this.validateMove();
              }
              // return true, if input is accepted/valid, `false` takes the move back
              return theMove ? true : false;
            } catch (error) {
              // Movimiento inválido, retornar false para rechazar el movimiento
              return false;
            }
          }
          return false;

        case 'moveInputCanceled':
          // hide the indicators
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
    }

    // Actualiza el tablero después de un movimiento de enroque
    if (
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('k') ||
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('q')) {
      this.board.setPosition(this.chessInstance.fen());
    }

    // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
    // if (this.stockfishEnabled) {
    //   this.startStockfish({ detail: { checked: true } });
    // }
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
    this.currentMoveNumber++;

    if (this.arrayFenSolution.length === this.currentMoveNumber) {
      this.allowMoveArrows = true;
      this.stopTimer();
      this.currentMoveNumber--;
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

      // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
      // if (this.stockfishEnabled) {
      //   this.startStockfish({ detail: { checked: true } });
      // }
    }
  }

  async showClue(times?: number) {
    // Marcar el inicio de la ejecución
    if (!times) {
      this.isClueActive = true;
      times = 1; // Inicializa `times` si no se proporciona.
    }

    const square = this.puzzle.moves.split(' ')[this.currentMoveNumber].slice(0, 2);
    if (!square) {
      console.error('No square to mark');
      this.isClueActive = false;
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
      return;
    }

    // Repite después de 500ms
    setTimeout(() => this.showClue(times + 1), 500);
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
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = this.currentMoveNumber + 1; i < this.arrayFenSolution.length; i++) {
      if (this.closeCancelMoves) {
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
    setTimeout(() => this.closeModal(), 1500);
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

    // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
    // if (this.stockfishEnabled) {
    //   this.startStockfish({ detail: { checked: true } });
    // }
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

    // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
    // if (this.stockfishEnabled) {
    //   this.startStockfish({ detail: { checked: true } });
    // }
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

    // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
    // if (this.stockfishEnabled) {
    //   this.startStockfish({ detail: { checked: true } });
    // }
  }

  moveToEnd() {
    this.currentMoveNumber = this.totalMoves;
    this.board.removeMarkers();
    this.removeArrows();
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();

    // TODO: Stockfish - Se creará una librería separada para esta funcionalidad
    // if (this.stockfishEnabled) {
    //   this.startStockfish({ detail: { checked: true } });
    // }
  }
}

