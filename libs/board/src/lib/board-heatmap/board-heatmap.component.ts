import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { BORDER_TYPE, Chessboard } from 'cm-chessboard';

import { HeatCell, heatCells, singlePiecePlacement } from './board-heatmap.util';

/**
 * Tablero que enseña por dónde se movió una pieza: cada casilla se tiñe según
 * las veces que la pieza llegó a ella y lleva el número encima, y la casilla
 * donde empezó va enmarcada.
 *
 * No sabe nada de partidas ni de cómo se calculan las cuentas: recibe el mapa
 * ya hecho. Así sirve igual para una partida que, más adelante, para la suma
 * de muchas.
 *
 * El tablero va sin borde para que la capa de colores, que es una rejilla de
 * 8×8 encima, caiga exactamente sobre las casillas.
 */
@Component({
  selector: 'lib-board-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board-heatmap.component.html',
  styleUrl: './board-heatmap.component.scss',
})
export class BoardHeatmapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('boardContainer', { static: false })
  boardContainer!: ElementRef<HTMLDivElement>;

  /** Veces que se llegó a cada casilla: { f3: 2, g5: 1 }. */
  @Input() counts: Record<string, number> = {};
  /** Casilla donde empezó la pieza; va enmarcada. */
  @Input() startSquare = '';
  /** Pieza que se dibuja, en el código de cm-chessboard ('wn'); vacía si no hay. */
  @Input() piece = '';
  /** Dónde se dibuja la pieza. */
  @Input() pieceSquare = '';
  @Input() orientation: 'w' | 'b' = 'w';

  cells: HeatCell[] = heatCells({}, '', 'w');

  private board: Chessboard | null = null;

  ngAfterViewInit(): void {
    void this.buildBoard();
  }

  ngOnChanges(): void {
    this.cells = heatCells(this.counts, this.startSquare, this.orientation);

    if (this.board) {
      this.board.setOrientation(this.orientation);
      void this.board.setPosition(this.placement(), false);
    }
  }

  ngOnDestroy(): void {
    this.board?.destroy?.();
    this.board = null;
  }

  private async buildBoard(): Promise<void> {
    if (!this.boardContainer?.nativeElement) {
      return;
    }

    this.board = await new Chessboard(this.boardContainer.nativeElement, {
      responsive: true,
      position: this.placement(),
      orientation: this.orientation,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.none,
        pieces: { file: 'pieces/standard.svg' },
      },
    });
  }

  private placement(): string {
    return singlePiecePlacement(this.piece, this.pieceSquare);
  }
}
