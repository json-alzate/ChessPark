import { Component, OnInit, Input, Output, EventEmitter, Renderer2 } from '@angular/core';

import {
  COLOR,
  INPUT_EVENT_TYPE,
  MOVE_INPUT_MODE,
  SQUARE_SELECT_TYPE,
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';
// import { MARKER_TYPE, Markers } from 'cm-chessboard/src/extensions/markers/markers';
// import { MARKER_TYPE, Markers } from 'src/lib/cm-chessboard/src/extensions/markers/markers';
import { MARKER_TYPE, Markers } from 'cm-chessboard/src/extensions/markers/markers';
import { ARROW_TYPE, Arrows } from 'cm-chessboard/src/extensions/arrows/arrows';
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog';
import Chess from 'chess.js';

// rxjs
import { interval, Subject, Observable, Subscription, merge } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// models
import { Puzzle } from '@models/puzzle.model';

interface UISettings {
  allowBackMove: boolean;
  allowNextMove: boolean;
  allowNextPuzzle: boolean;
  currentMoveNumber: number;
  isRetrying: boolean;
  puzzleStatus: 'start' | 'wrong' | 'good' | 'finished' | 'showSolution' | 'isRetrying';
  isPuzzleCompleted: boolean;
}

// Services
import { UiService } from '@services/ui.service';
import { ToolsService } from '@services/tools.service';

// Utils
import { createUid } from '@utils/create-uid';

@Component({
  selector: 'app-board-puzzle',
  templateUrl: './board-puzzle.component.html',
  styleUrls: ['./board-puzzle.component.scss'],
})
export class BoardPuzzleComponent implements OnInit {

  @Output() puzzleCompleted = new EventEmitter<Puzzle>();
  @Output() puzzleFailed = new EventEmitter<Puzzle>();
  @Output() puzzleEndByTime = new EventEmitter<Puzzle>();

  puzzle: Puzzle;
  isPlaying = false;

  currentMoveNumber = 0;
  arrayFenSolution = [];
  arrayMovesSolution = [];
  totalMoves = 0;
  allowMoveArrows = false;
  fenToCompareAndPlaySound: string;


  // timer
  showTimer = true;
  time = 0;
  timeColor = 'success';
  subsSeconds: Observable<number>;
  timerUnsubscribe$ = new Subject<void>();

  timeUsed = 0;
  goshPuzzleTime = 0;
  board;
  chessInstance = new Chess();


  constructor(
    private renderer: Renderer2,
    public uiService: UiService,
    private toolsService: ToolsService
  ) { }
  @Input() set setPuzzle(data: Puzzle) {
    if (data) {
      this.puzzle = data;
      this.stopTimer();
      this.initPuzzle();
    }
  }

  @Input() set setForceStopTimer(data: boolean) {
    if (data) {
      this.stopTimer();
    }
  }

  ngOnInit() {
    if (!this.board) {
      this.buildBoard('8/8/8/8/8/8/8/8 w - - 0 1');
    }
  }


  initPuzzle() {
    if (this.board) {
      // en caso de que se haya jugado un puzzle a ciegas anteriormente, se muestra las piezas
      const pieces = document.querySelectorAll('#boardPuzzle .pieces');;
      if (pieces.length > 0) {
        this.renderer.setStyle(pieces[0], 'opacity', '1');
      }
      this.board.setPosition(this.puzzle.fen);
    } else {
      this.buildBoard(this.puzzle.fen);
    }
    this.chessInstance.load(this.puzzle.fen);
    this.fenToCompareAndPlaySound = this.puzzle.fen;
    // Se cambia el color porque luego se realizara automáticamente la jugada inicial de la maquina
    // el fen del puzzle inicia siempre con el color contrario al del que le toc a jugar al usuario
    this.turnRoundBoard(this.chessInstance.turn() === 'b' ? 'w' : 'b');
    // eslint-disable-next-line max-len
    this.currentMoveNumber = 0;
    this.allowMoveArrows = false;

    this.arrayFenSolution = [];
    // se construye un arreglo con los fen de la solución
    this.arrayMovesSolution = this.puzzle.moves.split(' ');
    this.arrayFenSolution.push(this.chessInstance.fen());
    for (const move of this.arrayMovesSolution) {
      this.chessInstance.move(move, { sloppy: true });
      const fen = this.chessInstance.fen();
      this.arrayFenSolution.push(fen);
    }
    this.totalMoves = this.arrayFenSolution.length - 1;

    // ejecutar primera jugada
    this.puzzleMoveResponse();

    this.isPlaying = true;

    // se valida si el puzzle tiene un tiempo limite para resolverlo
    if (this.puzzle?.times?.total) {
      this.showTimer = true;
      this.initTimer();
    } else {
      this.showTimer = false;
    }


    this.initGoshTimer();
  }


  /**
   * Build board ui
   */
  buildBoard(fen: string) {

    // Se configura la ruta de las piezas con un timestamp para que no se guarde en cache (assetsCache: false, no se ven bien las piezas)
    const uniqueTimestamp = new Date().getTime();
    const piecesPath = `${this.uiService.pieces}?t=${uniqueTimestamp}`;

    const cssClass = this.uiService.currentBoardStyleSelected.name !== 'default' ? this.uiService.currentBoardStyleSelected.name : null;


    this.board = new Chessboard(document.getElementById('boardPuzzle'), {
      responsive: true,
      position: fen,
      assetsUrl: '/assets/cm-chessboard/',
      assetsCache: true,
      style: {
        cssClass,
        borderType: BORDER_TYPE.thin,
        pieces: {
          file: piecesPath
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
          this.removeMarkerNotLastMove(event.square);
          this.board.removeArrows();

          // mostrar indicadores para donde se puede mover la pieza
          if (this.chessInstance.moves({ square: event.square }).length > 0) {
            // adiciona el marcador para la casilla seleccionada
            const markerSquareSelected = { class: 'marker-square-green', slice: 'markerSquare' };
            this.board.addMarker(markerSquareSelected, event.square);
            const possibleMoves = this.chessInstance.moves({ square: event.square, verbose: true });
            for (const move of possibleMoves) {
              const markerDotMove = { class: 'marker-dot-green', slice: 'markerDot' };
              this.board.addMarker(markerDotMove, move.to);
            }
          }
          return true;
        case 'validateMoveInput':


          if ((event?.squareTo?.charAt(1) === '8' || event?.squareTo?.charAt(1) === '1') && event?.piece?.charAt(1) === 'p') {

            const colorToShow = event.piece.charAt(0) === 'w' ? COLOR.white : COLOR.black;
            // FIXME: se puede promocionar  si se toma un peon y se lleva con el mause a la ultima fila
            this.board.showPromotionDialog(event.squareTo, colorToShow, (result) => {
              if (result && result.piece) {
                // FIXME: No valida la coronación con chess.js
                this.board.setPiece(result.square, result.piece, true);
                // remover la piece de la casilla de origen
                this.board.setPiece(event.squareFrom, undefined, true);
                const objectMovePromotion = { from: event.squareFrom, to: event.squareTo, promotion: result.piece.charAt(1) };
                const theMovePromotion = this.chessInstance.move(objectMovePromotion);
                if (theMovePromotion) {
                  this.validateMove();
                }
              } else {
                console.log('Promotion canceled');
              }
            });
          }

          const objectMove = { from: event.squareFrom, to: event.squareTo };
          const theMove = this.chessInstance.move(objectMove);

          if (theMove) {
            this.board.removeArrows();
            this.showLastMove();
            this.validateMove();
          }
          // return true, if input is accepted/valid, `false` takes the move back
          return theMove;
        case 'moveInputCanceled':
          // hide the indicators
          return true;
        case 'moveInputFinished':

          return true;
        default:
          return true;
      }
    });


    let startSquare;
    let endSquare;
    this.board.enableSquareSelect((event) => {

      const ctrKeyPressed = event.mouseEvent.ctrlKey;
      const shiftKeyPressed = event.mouseEvent.shiftKey;
      const altKeyPressed = event.mouseEvent.altKey;

      if (event.mouseEvent.type === 'mousedown' && event.mouseEvent.which === 3) { // click derecho
        startSquare = event.square;
      }

      // Dibujar flechas
      if (event.mouseEvent.type === 'mouseup' && event.mouseEvent.which === 3) { // liberar click derecho
        endSquare = event.square;

        if (startSquare === endSquare) {
          return;
        }

        // Ahora, dibujamos la flecha usando el inicio y el final de las coordenadas
        let arrowType = {
          class: 'arrow-green',
          headSize: 7,
          slice: 'arrowDefault'
        };

        if (shiftKeyPressed) {
          arrowType = { ...arrowType, class: 'arrow-blue' };
        } else if (altKeyPressed) {
          arrowType = { ...arrowType, class: 'arrow-yellow' };
        } else if (ctrKeyPressed) {
          arrowType = { ...arrowType, class: 'arrow-red' };
        }

        this.board.addArrow(arrowType, startSquare, endSquare);
      }


      if (event.type === SQUARE_SELECT_TYPE.primary && event.mouseEvent.type === 'mousedown') {

        if (!this.chessInstance.get(event.square)) {
          this.board.removeArrows();
          this.removeMarkerNotLastMove();
        }

      }

      if (event.type === SQUARE_SELECT_TYPE.secondary && event.mouseEvent.type === 'mousedown') {

        let classCircle = 'marker-circle-green';

        if (ctrKeyPressed) {
          classCircle = 'marker-circle-red';
        } else if (shiftKeyPressed) {
          classCircle = 'marker-circle-blue';
        } else if (altKeyPressed) {
          classCircle = 'marker-circle-yellow';
        }
        // id debe ser único, random
        let myOwnMarker = { id: createUid(), class: classCircle, slice: 'markerCircle' };

        if (ctrKeyPressed && shiftKeyPressed && altKeyPressed) {
          myOwnMarker = MARKER_TYPE.frame;
        }


        const markersOnSquare = this.board.getMarkers(undefined, event.square);

        // remueve las marcas de la casilla diferentes a la del id 'lastMove'
        if (markersOnSquare.length > 1) {
          this.removeMarkerNotLastMove(event.square);
        } else {
          this.board.addMarker(myOwnMarker, event.square);
        }

      }
    });

  }

  removeMarkerNotLastMove(square?: string) {

    let markersOnSquare = [];
    if (square) {
      markersOnSquare = this.board.getMarkers(undefined, square);
    } else {
      markersOnSquare = this.board.getMarkers();
    }
    markersOnSquare.forEach(marker => {
      if (marker.type.id !== 'lastMove') {
        this.board.removeMarkers(marker.type, square);
      }
    });

  }

  // Muestra la ultima jugada utilizando marcadores
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

  // Timer --------------------------------------------
  initTimer() {

    // el puzzle tiene un tiempo limite para resolverlo
    let warningColorOn = 0;
    let dangerColorOn = 0;
    this.time = 0;
    this.timeUsed = 0;
    this.timeColor = 'success';
    if (this.puzzle?.times?.total) {
      this.time = this.puzzle.times.total;
      warningColorOn = this.puzzle.times.warningOn;
      dangerColorOn = this.puzzle.times.dangerOn;
    }
    this.timerUnsubscribe$ = new Subject<void>();

    this.subsSeconds = interval(1000);
    this.subsSeconds.pipe(
      takeUntil(this.timerUnsubscribe$)
    ).subscribe(() => {

      this.timeUsed++;

      if (this.puzzle.times.total) {
        this.time--;
        if (this.time === 0) {
          this.puzzleEndByTime.emit({
            ...this.puzzle, timeUsed: this.timeUsed, fenStartUserPuzzle: this.arrayFenSolution[1],
            firstMoveSquaresHighlight: [this.arrayMovesSolution[0].slice(0, 2), this.arrayMovesSolution[0].slice(2, 4)]
          });
          this.stopTimer();
          this.isPlaying = false;
        }
      } else {
        this.time++;
      }

      if (this.time === warningColorOn) {
        this.timeColor = 'warning';
      }
      if (this.time === dangerColorOn) {
        this.timeColor = 'danger';
      }
    });
  }

  initGoshTimer() {
    console.log('initGoshTimer', this.puzzle.goshPuzzleTime);


    this.goshPuzzleTime = this.puzzle.goshPuzzleTime || 0;
    if (this.goshPuzzleTime > 0) {
      // Se crea una cuenta regresiva según puzzle.goshPuzzleTime para ocultar las piezas
      // se cancela con timerUnsubscribe$ o cuando llegue a 0
      const goshUnsubscribe$ = new Subject<void>();
      const subsGoshSeconds = interval(1000);
      subsGoshSeconds.pipe(
        takeUntil(merge(this.timerUnsubscribe$, goshUnsubscribe$)),
      ).subscribe(() => {
        this.goshPuzzleTime--;
        if (this.goshPuzzleTime === 0) {
          // Se ocultan las piezas tomando el elemento con la clase "pieces"
          const pieces = document.querySelectorAll('#boardPuzzle .pieces');
          console.log('pieces', pieces, pieces.length);

          if (pieces.length > 0) {
            this.renderer.setStyle(pieces[0], 'opacity', '0');
          }
          goshUnsubscribe$.next();
          goshUnsubscribe$.complete();
        }
      });
    }

  }

  stopTimer() {
    this.subsSeconds = null;
    if (this.timerUnsubscribe$) {
      this.timerUnsubscribe$.next();
      this.timerUnsubscribe$.complete();
    }
  }


  validateMove() {
    const fenChessInstance = this.chessInstance.fen();

    this.toolsService.determineChessMoveType(this.fenToCompareAndPlaySound, fenChessInstance);

    this.currentMoveNumber++;
    if (fenChessInstance === this.arrayFenSolution[this.currentMoveNumber] || this.chessInstance.in_checkmate()) {
      this.puzzleMoveResponse();
    } else {
      this.puzzleFailed.emit({
        ...this.puzzle, timeUsed: this.timeUsed, fenStartUserPuzzle: this.arrayFenSolution[1],
        firstMoveSquaresHighlight: [this.arrayMovesSolution[0].slice(0, 2), this.arrayMovesSolution[0].slice(2, 4)]
      });
      this.stopTimer();
      this.isPlaying = false;
    }

    // Actualiza el tablero después de un movimiento de enroque
    if (
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('k') ||
      this.chessInstance.history({ verbose: true }).slice(-1)[0]?.flags.includes('q')) {
      this.board.setPosition(this.chessInstance.fen());
    }
  }

  /**
   * Reacciona con el siguiente movimiento en el puzzle, cuando el usuario realiza una jugada correcta
   * React with the following movement in the puzzle, when the user makes a correct move
   *
   * @param moveNumber: number
   */
  async puzzleMoveResponse() {
    this.currentMoveNumber++;

    if (this.arrayFenSolution.length === this.currentMoveNumber) {
      this.allowMoveArrows = true;
      this.currentMoveNumber--;
      this.puzzleCompleted.emit({
        ...this.puzzle, timeUsed: this.timeUsed,
        fenStartUserPuzzle: this.arrayFenSolution[1],
        firstMoveSquaresHighlight: [this.arrayMovesSolution[0].slice(0, 2), this.arrayMovesSolution[0].slice(2, 4)]
      });
      this.stopTimer();
      this.isPlaying = false;
    } else {

      await new Promise<void>((resolve, reject) => {
        setTimeout(() => resolve(), 500);
      });

      this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
      const fen = this.chessInstance.fen();
      this.toolsService.determineChessMoveType(this.fenToCompareAndPlaySound, fen);
      this.fenToCompareAndPlaySound = fen;
      this.board.removeMarkers();
      this.board.removeArrows();

      await this.board.setPosition(fen, true);
      const from = this.arrayMovesSolution[this.currentMoveNumber - 1].slice(0, 2);
      const to = this.arrayMovesSolution[this.currentMoveNumber - 1].slice(2, 4);
      this.showLastMove(from, to);

    }


  }


  // Board controls -----------------------------------

  /**
   * Gira el tablero
   * Turn the board
   *
   * @param orientation
   */
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

  // Arrows

  starPosition() {
    this.board.removeArrows();
    this.board.removeMarkers();
    this.board.setPosition(this.puzzle.fen, true);
    this.chessInstance.load(this.puzzle.fen);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.currentMoveNumber = 0;
  }

  /**
   * Navega a la anterior jugada en el tablero
   * Navigate to the previous play on the board
   *
   */
  backMove() {
    if (this.currentMoveNumber <= 0) {
      return;
    } else {
      this.currentMoveNumber--;
    }
    this.board.removeMarkers();
    this.board.removeArrows();
    this.toolsService.determineChessMoveType(this.fenToCompareAndPlaySound, this.chessInstance.fen());
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.showLastMove();
  }

  /**
   * Navega a la siguiente jugada en el tablero
   * Navigate to the next play on the board
   *
   */
  nextMove() {
    if (this.currentMoveNumber >= this.totalMoves) {
      return;
    } else {
      this.currentMoveNumber++;
    }
    this.board.removeMarkers();
    this.board.removeArrows();
    this.toolsService.determineChessMoveType(this.fenToCompareAndPlaySound, this.chessInstance.fen());
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();
  }

  moveToEnd() {
    this.currentMoveNumber = this.totalMoves;
    this.board.removeMarkers();
    this.board.removeArrows();
    this.board.setPosition(this.arrayFenSolution[this.currentMoveNumber], true);
    this.chessInstance.load(this.arrayFenSolution[this.currentMoveNumber]);
    this.fenToCompareAndPlaySound = this.chessInstance.fen();
    this.showLastMove();
  }

}
