import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Chessboard, BORDER_TYPE } from 'cm-chessboard';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';

import { SoundsService } from '@chesspark/common-utils';

/** Casillas de una jugada, para resaltarla. */
export interface GameMoveSquares {
  from: string;
  to: string;
}

/**
 * Tablero que reproduce una partida ya resuelta en posiciones.
 *
 * Es hermano de `BoardPuzzleSolutionComponent`, no una generalización suya:
 * aquel arrastra el juego del puzzle, la validación de jugadas y Stockfish, y
 * tocarlo para meter esto pondría en riesgo el flujo de entrenamiento. Aquí el
 * tablero es de **solo mirar** — no acepta movimientos — que es justo lo que
 * pide esta feature.
 *
 * El componente es dueño del reloj de reproducción; la pantalla que lo usa
 * pinta los controles y la lista de jugadas, y le habla por métodos.
 */
@Component({
  selector: 'lib-board-game-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board-game-player.component.html',
  styleUrl: './board-game-player.component.scss',
})
export class BoardGamePlayerComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('boardContainer', { static: false })
  boardContainer!: ElementRef<HTMLDivElement>;

  /** Posiciones de la partida: una por jugada, más la inicial. */
  @Input() fens: string[] = [];
  /** Casillas de cada jugada, para resaltar la última. */
  @Input() moveSquares: GameMoveSquares[] = [];
  /** Milisegundos entre jugadas al reproducir. */
  @Input() msPerMove = 2000;
  @Input() soundEnabled = true;
  @Input() orientation: 'w' | 'b' = 'w';

  /** Jugada actual (0 = posición inicial). */
  @Output() indexChange = new EventEmitter<number>();
  /** Si está reproduciendo o en pausa. */
  @Output() playingChange = new EventEmitter<boolean>();
  /** La partida llegó al final reproduciéndose sola. */
  @Output() finished = new EventEmitter<void>();

  private soundsService = inject(SoundsService);

  private board: Chessboard | null = null;
  private stopPlayback$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  currentIndex = 0;
  isPlaying = false;

  get lastIndex(): number {
    return Math.max(this.fens.length - 1, 0);
  }

  ngAfterViewInit(): void {
    void this.buildBoard();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Partida nueva: se para lo que hubiera y se vuelve al principio.
    if (changes['fens'] && !changes['fens'].firstChange) {
      this.pause();
      this.currentIndex = 0;
      this.indexChange.emit(0);
      void this.render(0, { animated: false, silent: true });
    }

    if (changes['orientation'] && !changes['orientation'].firstChange) {
      this.board?.setOrientation(this.orientation);
    }
  }

  private async buildBoard(): Promise<void> {
    if (!this.boardContainer?.nativeElement || this.fens.length === 0) {
      return;
    }

    this.board = await new Chessboard(this.boardContainer.nativeElement, {
      responsive: true,
      position: this.fens[0],
      orientation: this.orientation,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.thin,
        pieces: { file: 'pieces/standard.svg' },
      },
      extensions: [{ class: Markers }],
    });

    // Sin enableMoveInput: el tablero no acepta jugadas, es solo para mirar.
    void this.render(this.currentIndex, { animated: false, silent: true });
  }

  // — Controles ————————————————————————————————————————————————

  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    if (this.isPlaying || this.fens.length < 2) {
      return;
    }
    // Darle al play al final vuelve a empezar, en vez de no hacer nada.
    if (this.currentIndex >= this.lastIndex) {
      this.goTo(0);
    }

    this.isPlaying = true;
    this.playingChange.emit(true);

    interval(this.msPerMove)
      .pipe(takeUntil(this.stopPlayback$), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.currentIndex >= this.lastIndex) {
          this.pause();
          this.finished.emit();
          return;
        }
        this.goTo(this.currentIndex + 1);
      });
  }

  pause(): void {
    this.stopPlayback$.next();
    if (this.isPlaying) {
      this.isPlaying = false;
      this.playingChange.emit(false);
    }
  }

  next(): void {
    this.pause();
    this.goTo(this.currentIndex + 1);
  }

  previous(): void {
    this.pause();
    this.goTo(this.currentIndex - 1);
  }

  toStart(): void {
    this.pause();
    this.goTo(0);
  }

  toEnd(): void {
    this.pause();
    this.goTo(this.lastIndex);
  }

  /** Salta a una jugada concreta (la lista de jugadas usa esto). */
  goTo(index: number): void {
    const target = Math.min(Math.max(index, 0), this.lastIndex);
    if (target === this.currentIndex) {
      return;
    }

    const previousFen = this.fens[this.currentIndex];
    this.currentIndex = target;
    this.indexChange.emit(target);
    void this.render(target, { animated: true, previousFen });
  }

  flip(): void {
    this.orientation = this.orientation === 'w' ? 'b' : 'w';
    this.board?.setOrientation(this.orientation);
  }

  // — Pintado ——————————————————————————————————————————————————

  private async render(
    index: number,
    options: { animated: boolean; previousFen?: string; silent?: boolean }
  ): Promise<void> {
    if (!this.board) {
      return;
    }

    const fen = this.fens[index];
    if (!fen) {
      return;
    }

    this.board.removeMarkers();
    await this.board.setPosition(fen, options.animated);

    // La jugada que llevó hasta aquí; en la posición inicial no hay ninguna.
    const move = index > 0 ? this.moveSquares[index - 1] : undefined;
    if (move) {
      const marker = {
        id: 'lastMove',
        class: 'marker-square-green',
        slice: 'markerSquare',
      };
      this.board.addMarker(marker, move.from);
      this.board.addMarker(marker, move.to);
    }

    if (this.soundEnabled && !options.silent && options.previousFen) {
      this.soundsService.determineChessMoveType(options.previousFen, fen);
    }
  }

  ngOnDestroy(): void {
    this.pause();
    this.stopPlayback$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    this.board?.destroy?.();
  }
}
