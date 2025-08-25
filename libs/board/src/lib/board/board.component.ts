import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Chessboard, BOARD_TYPE, ChessboardConfig } from 'cm-chessboard';

@Component({
  selector: 'lib-board',
  imports: [CommonModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css',
})
export class BoardComponent implements OnInit {

  @Output() squareSelected = new EventEmitter<string>();

  @Input() set boardConfig(config: ChessboardConfig) {
    this.config = { ...this.config, ...config };
    this.buildBoard();
  }

  private config: ChessboardConfig = {
    coordinates: false,
    responsive: true,
    position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    assetsUrl: 'assets/cm-chessboard/assets/',
    style: {
      cssClass: 'chessboard-js',
      showCoordinates: true,
      pieces: {
        file: 'pieces/standard.svg',
      }
    },
  };

  private board: any = null;

  ngOnInit() {
    this.buildBoard();
  }

  async buildBoard() {

    if (this.board) {
      this.board.destroy();
    }

    console.log('config', this.config);
    this.board = await new Chessboard(document.getElementById('boardPuzzle') as HTMLElement, this.config);

    console.log(this.board);
    // Agregar evento de clic en casillas usando enableSquareSelect
    this.board.enableSquareSelect('pointerdown', (eventData: any) => {
      if (eventData.square) {
        this.squareSelected.emit(eventData.square);
      }
    });
  }

  /**
   * muestra u oculta las coordenadas del tablero
   */
  public toggleCoordinates(showCoordinates: boolean) {
    this.config = { ...this.config, style: { ...this.config.style, showCoordinates } };
  }


  /**
   * muestra u oculta las piezas del tablero
   */
  public togglePieces(showPieces: boolean) {
    if (showPieces) {
      this.config = { ...this.config, position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
    } else {
      this.config = { ...this.config, position: '8/8/8/8/8/8/8/8 w - - 0 1' };
    }
  }

  public setPosition(position: string) {
    this.config = { ...this.config, position };
    console.log('setPosition',this.config);
    
  }

  /**
 * Cambia la orientación del tablero
 * @param orientation 'w' para blanco, 'b' para negro
 */
  public changeOrientation(orientation: 'w' | 'b') {
    if (this.board) {
      this.board.setOrientation(orientation);
    }
  }


  /**
   * Reconstruye el tablero
   */
  public rebuildBoard() {
    this.buildBoard();
  }

  /**
   * Obtiene la orientación actual del tablero
   * @returns 'w' para blanco, 'b' para negro
   */
  getOrientation(): 'w' | 'b' {
    return this.board ? this.board.getOrientation() : 'w';
  }
}
