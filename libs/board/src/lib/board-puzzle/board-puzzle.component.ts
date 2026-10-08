import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  Renderer2,
  Injectable,
  inject,
  ViewChild,
  ElementRef,
} from '@angular/core';

import {
  COLOR,
  INPUT_EVENT_TYPE,
  MOVE_INPUT_MODE,
  SQUARE_SELECT_TYPE,
  Chessboard,
  BORDER_TYPE,
} from 'cm-chessboard';
import {
  MARKER_TYPE,
  Markers,
} from 'cm-chessboard/src/extensions/markers/Markers.js';
import {
  ARROW_TYPE,
  Arrows,
} from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';

// rxjs
import { interval, Subject, Observable, Subscription, merge } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Ionic
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  eyeOutline,
  eyeOffOutline,
  swapVerticalOutline,
  playSkipBackOutline,
  chevronBackOutline,
  chevronForwardOutline,
  playSkipForwardOutline,
} from 'ionicons/icons';

// models
import { Puzzle } from '@chesspark/models';
import { PuzzleEngine } from './puzzle-engine';

interface UISettings {
  allowBackMove: boolean;
  allowNextMove: boolean;
  allowNextPuzzle: boolean;
  currentMoveNumber: number;
  isRetrying: boolean;
  puzzleStatus:
    | 'start'
    | 'wrong'
    | 'good'
    | 'finished'
    | 'showSolution'
    | 'isRetrying';
  isPuzzleCompleted: boolean;
}

// Services
// import { UiService } from '@services/ui.service';
// import { ToolsService } from '@services/tools.service';

// Utils
import {
  UidGeneratorService,
  SecondsToMinutesSecondsPipe,
  SoundsService,
} from '@chesspark/common-utils';

// Components
@Injectable()
@Component({
  selector: 'lib-board-puzzle',
  templateUrl: './board-puzzle.component.html',
  styleUrls: ['./board-puzzle.component.scss'],
  imports: [SecondsToMinutesSecondsPipe, IonIcon],
})
export class BoardPuzzleComponent implements OnInit, AfterViewInit, OnDestroy {
  soundsService = inject(SoundsService);

  @Output() puzzleCompleted = new EventEmitter<Puzzle>();
  @Output() puzzleFailed = new EventEmitter<Puzzle>();
  @Output() puzzleEndByTime = new EventEmitter<Puzzle>();
  @Output() streamSolutionFinished = new EventEmitter<void>();

  puzzle!: Puzzle;
  isPlaying = false;

  // Token de identidad por puzzle: se incrementa en cada stopTimer() (cambio/parada
  // de puzzle). Las tareas async capturan su valor al entrar y abortan tras cada
  // await si ya no coincide, evitando que un callback de un puzzle anterior mute el
  // estado del puzzle actual (causa del desfase de currentMoveNumber en plan30).
  private puzzleGenerationId = 0;
  // Motor de puzzle: lógica pura (solución, validación, promoción, hints). Ver puzzle-engine.ts.
  private engine = new PuzzleEngine();
  allowMoveArrows = false;
  fenToCompareAndPlaySound!: string;

  isStreaming = false;

  // timer
  showTimer = true;
  time = 0;
  timeColor = 'success';
  subsSeconds!: Observable<number>;
  timerUnsubscribe$ = new Subject<void>();
  smoothProgress = 0; // Progreso suave para la barra (actualizado cada 100ms)
  timerStartTime = 0; // Timestamp de inicio del timer para calcular progreso suave

  timeUsed = 0;
  goshPuzzleTime = 0;
  private showMoveHint = false;
  board!: Chessboard;
  isViewInitialized = false;
  pendingInit = false;
  boardId = 'boardPuzzle_' + Math.random().toString(36).substr(2, 9);

  @ViewChild('boardContainer', { static: true }) boardContainer!: ElementRef;

  constructor(
    private renderer: Renderer2,
    // public uiService: UiService,
    // private toolsService: ToolsService,
    private uidGenerator: UidGeneratorService
  ) {
    // Registrar iconos de Ionic
    addIcons({
      eyeOutline,
      eyeOffOutline,
      swapVerticalOutline,
      playSkipBackOutline,
      chevronBackOutline,
      chevronForwardOutline,
      playSkipForwardOutline,
    });
  }
  @Input() set triggerStreamSolution(value: boolean) {
    if (value && !this.isStreaming && this.engine.solutionLength > 0) {
      this.startStreamSolution();
    }
  }

  @Input() set setPuzzle(data: Puzzle) {
    if (data) {
      this.puzzle = data;
      this.stopTimer();
      if (this.isViewInitialized) {
        this.initPuzzle();
      } else {
        this.pendingInit = true;
      }
    }
  }

  @Input() set setForceStopTimer(data: boolean) {
    if (data) {
      this.stopTimer();
    }
  }

  /**
   * Muestra una flecha de pista (hint) discreta con la jugada que el usuario
   * debe hacer, cada vez que el turno vuelve a él. La jugada se deriva de la
   * solución del puzzle, por lo que guía combinaciones completas (mate en 2,
   * 3…), no solo un movimiento. Pensada para guiar (p. ej. el onboarding). Se
   * limpia al tocar el tablero, como cualquier otra flecha.
   */
  @Input() set setShowMoveHint(value: boolean) {
    this.showMoveHint = !!value;
  }

  @Input() showBoardControls = true;

  ngOnInit() {
    console.log('ngOnInit board-puzzle - eliminada carga inicial prematura');
  }

  ngAfterViewInit() {
    this.isViewInitialized = true;
    if (this.pendingInit) {
      this.initPuzzle();
      this.pendingInit = false;
    } else if (!this.puzzle && !this.board) {
      this.buildBoard('8/8/8/8/8/8/8/8 w - - 0 1');
    }
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.board) {
      this.board.destroy();
    }
  }

  async initPuzzle() {
    if (this.board) {
      // en caso de que se haya jugado un puzzle a ciegas anteriormente, se muestra las piezas
      const pieces = document.querySelectorAll(`#${this.boardId} .pieces`);
      if (pieces.length > 0) {
        this.renderer.setStyle(pieces[0], 'opacity', '1');
      }
      this.board.setPosition(this.puzzle.fen);
      // Garantizar que el input quede habilitado para el puzzle nuevo: un
      // startStreamSolution() interrumpido pudo dejar el tablero con
      // disableMoveInput() y "pegado". Es idempotente.
      this.board.disableMoveInput();
      this.board.enableMoveInput(this.handleMoveInput);
    } else {
      await this.buildBoard(this.puzzle.fen);
    }
    console.log('puzzle: ', this.puzzle);
    // El motor construye la solución y deja el tablero en la posición inicial del puzzle
    this.engine.load(this.puzzle);
    this.fenToCompareAndPlaySound = this.puzzle.fen;
    // Se cambia el color porque luego se realizara automáticamente la jugada inicial de la maquina
    // el fen del puzzle inicia siempre con el color contrario al del que le toc a jugar al usuario
    this.turnRoundBoard(this.engine.sideToMove === 'b' ? 'w' : 'b');
    this.allowMoveArrows = false;
    // Si un stream de solución quedó interrumpido por el cambio de puzzle, este
    // reset evita que el componente quede bloqueado y desbloquea triggerStreamSolution.
    this.isStreaming = false;

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
  async buildBoard(fen: string) {
    // Se configura la ruta de las piezas con un timestamp para que no se guarde en cache (assetsCache: false, no se ven bien las piezas)
    const uniqueTimestamp = new Date().getTime();
    // const piecesPath = `${this.uiService.pieces}?t=${uniqueTimestamp}`;

    // const cssClass = this.uiService.currentBoardStyleSelected.name !== 'default' ? this.uiService.currentBoardStyleSelected.name : null;

    this.board = await new Chessboard(this.boardContainer.nativeElement, {
      responsive: true,
      position: fen,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.thin,
        pieces: {
          file: 'pieces/standard.svg',
        },
      },
      extensions: [
        { class: Markers },
        { class: Arrows },
        { class: PromotionDialog },
      ],
    });

    console.log('buildBoard', fen);

    this.board.enableMoveInput(this.handleMoveInput);
  }

  // Handler de input del tablero extraído a propiedad de clase (arrow para
  // preservar `this`) para poder rehabilitarlo desde initPuzzle() tras un stream.
  // La validación de jugadas vive en PuzzleEngine; aquí solo se traduce cada
  // resultado en acciones de tablero (marcadores, flechas y diálogo de promoción).
  private handleMoveInput = (event: any) => {
    switch (event.type) {
      case 'moveInputStarted':
        this.board.removeMarkers();
        this.showLastMove();
        this.board.removeArrows();

        // mostrar indicadores para donde se puede mover la pieza
        if (event.square) {
          const possibleMoves = this.engine.movesFrom(event.square);
          if (possibleMoves.length > 0) {
            // adiciona el marcador para la casilla seleccionada
            const markerSquareSelected = {
              class: 'marker-square-green',
              slice: 'markerSquare',
            };
            this.board.addMarker(markerSquareSelected, event.square);
            for (const move of possibleMoves) {
              const markerDotMove = {
                class: 'marker-dot-green',
                slice: 'markerDot',
              };
              this.board.addMarker(markerDotMove, move.to);
            }
          }
        }
        return true;
      case 'validateMoveInput':
        if (
          event.squareFrom &&
          event.squareTo &&
          event.piece &&
          this.engine.isPromotionAttempt(event.piece, event.squareTo)
        ) {
          return this.handlePromotionAttempt(event.squareFrom, event.squareTo, event.piece);
        }
        if (event.squareFrom && event.squareTo) {
          return this.handleUserMove(event.squareFrom, event.squareTo);
        }
        this.board.removeMarkers();
        this.showLastMove();
        return false;
      case 'moveInputCanceled':
        this.board.removeMarkers();
        this.showLastMove();
        this.board.removeArrows();
        return true;
      case 'moveInputFinished':
        return true;
      default:
        return true;
    }
  };

  /**
   * Jugada normal del usuario. Si el motor la acepta, el tablero conserva la pieza movida
   * (se devuelve true) y se valida contra la solución. Si no es legal, cm-chessboard
   * devuelve la pieza a su casilla.
   */
  private handleUserMove(from: string, to: string): boolean {
    const accepted = this.engine.tryMove(from, to);
    if (accepted) {
      this.board.removeArrows();
      this.showLastMove();
      this.validateMove();
    } else {
      this.board.removeMarkers();
      this.showLastMove();
    }
    return accepted;
  }

  /**
   * Promoción de peón. Primero se comprueba que el peón pueda llegar a la casilla; si no, se
   * rechaza sin abrir el diálogo. Si puede, el diálogo elige la pieza y la jugada se aplica al
   * confirmar. Se devuelve true para que cm-chessboard espere la elección.
   */
  private handlePromotionAttempt(from: string, to: string, piece: string): boolean {
    try {
      if (!this.engine.isPawnPromotionLegal(from, to)) {
        this.board.removeMarkers();
        this.showLastMove();
        return false;
      }
      const colorToShow = piece.charAt(0) === 'w' ? COLOR.white : COLOR.black;
      this.board.showPromotionDialog(to, colorToShow, (result) => {
        const accepted = !!result?.piece && this.engine.tryMove(from, to, result.piece.charAt(1));
        // Sincroniza el tablero con el motor en ambos casos: si la jugada se rechaza, deshace el movimiento visual
        this.board.setPosition(this.engine.fen, false);
        if (accepted) {
          this.board.removeArrows();
          this.showLastMove();
          this.validateMove();
        } else {
          this.board.removeMarkers();
          this.showLastMove();
        }
      });
      return true;
    } catch (error) {
      this.board.removeMarkers();
      this.showLastMove();
      return false;
    }
  }

  // Código de enableSquareSelect deshabilitado; se conserva como referencia.
  // let startSquare;
    // let endSquare;
    // this.board.enableSquareSelect((event) => {

    //   const ctrKeyPressed = event.mouseEvent.ctrlKey;
    //   const shiftKeyPressed = event.mouseEvent.shiftKey;
    //   const altKeyPressed = event.mouseEvent.altKey;

    //   if (event.mouseEvent.type === 'mousedown' && event.mouseEvent.which === 3) { // click derecho
    //     startSquare = event.square;
    //   }

    //   // Dibujar flechas
    //   if (event.mouseEvent.type === 'mouseup' && event.mouseEvent.which === 3) { // liberar click derecho
    //     endSquare = event.square;

    //     if (startSquare === endSquare) {
    //       return;
    //     }

    //     // Ahora, dibujamos la flecha usando el inicio y el final de las coordenadas
    //     let arrowType = {
    //       class: 'arrow-green',
    //       headSize: 7,
    //       slice: 'arrowDefault'
    //     };

    //     if (shiftKeyPressed) {
    //       arrowType = { ...arrowType, class: 'arrow-blue' };
    //     } else if (altKeyPressed) {
    //       arrowType = { ...arrowType, class: 'arrow-yellow' };
    //     } else if (ctrKeyPressed) {
    //       arrowType = { ...arrowType, class: 'arrow-red' };
    //     }

    //     this.board.addArrow(arrowType, startSquare, endSquare);
    //   }

    //   if (event.type === SQUARE_SELECT_TYPE.primary && event.mouseEvent.type === 'mousedown') {

    //     if (!this.chessInstance.get(event.square)) {
    //       this.board.removeArrows();
    //       this.removeMarkerNotLastMove();
    //     }

    //   }

    //   if (event.type === SQUARE_SELECT_TYPE.secondary && event.mouseEvent.type === 'mousedown') {

    //     let classCircle = 'marker-circle-green';

    //     if (ctrKeyPressed) {
    //       classCircle = 'marker-circle-red';
    //     } else if (shiftKeyPressed) {
    //       classCircle = 'marker-circle-blue';
    //     } else if (altKeyPressed) {
    //       classCircle = 'marker-circle-yellow';
    //     }
    //     // id debe ser único, random
    //     let myOwnMarker = { id: this.uidGenerator.generateSimpleUid(), class: classCircle, slice: 'markerCircle' };

    //     if (ctrKeyPressed && shiftKeyPressed && altKeyPressed) {
    //       myOwnMarker = MARKER_TYPE.frame;
    //     }

    //     const markersOnSquare = this.board.getMarkers(undefined, event.square);

    //     // remueve las marcas de la casilla diferentes a la del id 'lastMove'
    //     if (markersOnSquare.length > 1) {
    //       this.removeMarkerNotLastMove(event.square);
    //     } else {
    //       this.board.addMarker(myOwnMarker, event.square);
    //     }

    //   }
    // });

  removeMarkerNotLastMove(square?: string) {
    let markersToProcess: { type: any; square?: string }[] = [];
    if (square) {
      markersToProcess = this.board.getMarkers(undefined, square);
    } else {
      markersToProcess = this.board.getMarkers();
    }
    markersToProcess.forEach(
      (marker: { type: { id?: string }; square?: string }) => {
        if (marker.type?.id !== 'lastMove') {
          this.board.removeMarkers(marker.type, square ?? marker.square);
        }
      }
    );
  }

  // Muestra la ultima jugada utilizando marcadores
  showLastMove(from?: string, to?: string) {
    this.board.removeMarkers();
    if (!from && !to) {
      // Sin argumentos: la última jugada del tablero o, si el historial está vacío, la de la solución
      const last = this.engine.lastMove();
      from = last?.from;
      to = last?.to;
    }
    if (from && to) {
      const marker = {
        id: 'lastMove',
        class: 'marker-square-green',
        slice: 'markerSquare',
      };
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

    // Guardar el tiempo de inicio para calcular el progreso suave
    this.timerStartTime = Date.now();
    this.smoothProgress = this.puzzle?.times?.total || 0;

    // Timer principal en segundos (mantiene toda la lógica original)
    this.subsSeconds = interval(1000);
    this.subsSeconds.pipe(takeUntil(this.timerUnsubscribe$)).subscribe(() => {
      this.timeUsed++;

      if (this.puzzle?.times?.total) {
        this.time--;
        if (this.time === 0) {
          this.puzzleEndByTime.emit(this.buildResultPayload());
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
        this.timeColor = 'error';
      }
    });

    // Timer suave para actualizar la barra de progreso cada 100ms
    if (this.puzzle?.times?.total) {
      const smoothTimer = interval(100);
      smoothTimer.pipe(takeUntil(this.timerUnsubscribe$)).subscribe(() => {
        if (this.puzzle?.times?.total) {
          const elapsed = (Date.now() - this.timerStartTime) / 1000; // Tiempo transcurrido en segundos
          this.smoothProgress = Math.max(0, this.puzzle.times.total - elapsed);
        }
      });
    }
  }

  initGoshTimer() {
    console.log('initGoshTimer', this.puzzle.goshPuzzleTime);

    this.goshPuzzleTime = this.puzzle.goshPuzzleTime || 0;
    if (this.goshPuzzleTime > 0) {
      // Se crea una cuenta regresiva según puzzle.goshPuzzleTime para ocultar las piezas
      // se cancela con timerUnsubscribe$ o cuando llegue a 0
      const goshUnsubscribe$ = new Subject<void>();
      const subsGoshSeconds = interval(1000);
      subsGoshSeconds
        .pipe(takeUntil(merge(this.timerUnsubscribe$, goshUnsubscribe$)))
        .subscribe(() => {
          this.goshPuzzleTime--;
          if (this.goshPuzzleTime === 0) {
            // Se ocultan las piezas tomando el elemento con la clase "pieces"
            const pieces = document.querySelectorAll(
              `#${this.boardId} .pieces`
            );
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
    // Invalida cualquier tarea async pendiente del puzzle/estado anterior
    // (puzzleMoveResponse, startStreamSolution). stopTimer() es el único punto de
    // parada universal (lo llaman setPuzzle, fallo, timeout, completado y
    // setForceStopTimer), por lo que es el choke point correcto para el token.
    this.puzzleGenerationId++;
    this.subsSeconds = undefined as any;
    if (this.timerUnsubscribe$) {
      this.timerUnsubscribe$.next();
      this.timerUnsubscribe$.complete();
    }
    // Resetear el progreso suave
    this.smoothProgress = 0;
    this.timerStartTime = 0;
  }

  /** Promesa que resuelve tras `ms` milisegundos (reemplaza los setTimeout inline). */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Payload común de los eventos de resultado (completado, fallo o fin de tiempo).
   * Incluye el FEN tras la primera jugada y sus casillas, que la vista de resultado usa
   * para mostrar dónde empieza el usuario.
   */
  private buildResultPayload(): Puzzle {
    const firstMove = PuzzleEngine.squaresOf(this.engine.solutionMoveAt(0));
    return {
      ...this.puzzle,
      timeUsed: this.timeUsed,
      fenStartUserPuzzle: this.engine.solutionFenAt(1),
      firstMoveSquaresHighlight: [firstMove.from, firstMove.to],
    };
  }

  /**
   * Compara la jugada del usuario con la solución (lo decide el motor) y reacciona:
   * si es correcta responde la máquina; si no, el puzzle falla y se detiene el timer.
   */
  validateMove() {
    const fenChessInstance = this.engine.fen;

    this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, fenChessInstance);

    if (this.engine.evaluateUserMove() === 'correct') {
      this.puzzleMoveResponse();
    } else {
      this.puzzleFailed.emit(this.buildResultPayload());
      this.stopTimer();
      this.isPlaying = false;
    }

    // Actualiza el tablero después de un movimiento de enroque
    if (this.engine.lastMoveWasCastling()) {
      this.board.setPosition(this.engine.fen);
    }
  }

  /**
   * Reacciona con el siguiente movimiento en el puzzle, cuando el usuario realiza una jugada correcta
   * React with the following movement in the puzzle, when the user makes a correct move
   *
   * @param moveNumber: number
   */
  async puzzleMoveResponse() {
    // Identidad del puzzle en el momento de invocar; si cambia durante el delay
    // significa que entró otro puzzle y este callback debe descartarse.
    const gen = this.puzzleGenerationId;

    // El motor avanza a la jugada de la máquina; si ya no quedan jugadas, el puzzle está resuelto.
    if (this.engine.advanceMachineMove()) {
      this.allowMoveArrows = true;
      this.puzzleCompleted.emit(this.buildResultPayload());
      this.stopTimer();
      this.isPlaying = false;
    } else {
      await this.delay(500);
      // Si entró otro puzzle durante el delay, abortar sin tocar el estado nuevo.
      if (gen !== this.puzzleGenerationId) {
        return;
      }

      const fen = this.engine.loadCurrentSolutionFen();
      this.soundsService.determineChessMoveType(this.fenToCompareAndPlaySound, fen);
      this.fenToCompareAndPlaySound = fen;
      this.board.removeMarkers();
      this.board.removeArrows();

      await this.board.setPosition(fen, true);
      if (gen !== this.puzzleGenerationId) {
        return;
      }
      const { from, to } = this.engine.lastSolutionMove();
      this.showLastMove(from, to);
      this.drawMoveHint();
    }
  }

  /**
   * Dibuja la flecha de pista con la próxima jugada del usuario (derivada de la
   * solución). Se llama tras cada respuesta de la máquina, cuando el turno
   * vuelve al usuario. La flecha se estiliza discreta en el SCSS.
   */
  private drawMoveHint() {
    if (!this.showMoveHint || !this.board) {
      return;
    }
    const hint = this.engine.hintSquares();
    if (hint) {
      this.board.addArrow(
        { id: 'hintArrow', class: 'arrow-hint', headSize: 6, slice: 'arrowPointy' },
        hint.from,
        hint.to
      );
    }
  }

  async startStreamSolution() {
    // Identidad del puzzle; si cambia durante la animación (entró otro puzzle),
    // se corta el bucle. initPuzzle() rehabilita el input del puzzle nuevo.
    const gen = this.puzzleGenerationId;
    this.isStreaming = true;
    this.board.disableMoveInput();

    // Reset board to the correct position at currentMoveNumber (handles both fail and timeOut)
    await this.board.setPosition(this.engine.solutionFenAt(this.engine.currentMoveNumber), false);
    await this.delay(600);
    if (gen !== this.puzzleGenerationId) {
      return;
    }

    for (let i = this.engine.currentMoveNumber + 1; i < this.engine.solutionLength; i++) {
      const prevFen = this.engine.solutionFenAt(i - 1);
      await this.board.setPosition(this.engine.solutionFenAt(i), true);
      if (gen !== this.puzzleGenerationId) {
        return;
      }
      this.soundsService.determineChessMoveType(prevFen, this.engine.solutionFenAt(i));

      const moveStr = this.engine.solutionMoveAt(i);
      if (moveStr) {
        this.showLastMove(moveStr.slice(0, 2), moveStr.slice(2, 4));
      }

      await this.delay(1000);
      if (gen !== this.puzzleGenerationId) {
        return;
      }
    }

    this.isStreaming = false;
    await this.delay(800);
    if (gen !== this.puzzleGenerationId) {
      return;
    }
    this.streamSolutionFinished.emit();
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
}
