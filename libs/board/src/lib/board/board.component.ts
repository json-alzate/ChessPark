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

    this.board = await new Chessboard(document.getElementById('boardPuzzle') as HTMLElement, this.config);

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

    // Buscar el elemento SVG cm-chessboard
    const boardElement = document.getElementById('boardPuzzle');
    if (boardElement) {
      const chessboardSVG = boardElement.querySelector('.cm-chessboard') as SVGElement;
      
      if (chessboardSVG) {
        // Buscar el grupo de coordenadas dentro del SVG
        const coordinatesGroup = chessboardSVG.querySelector('g.coordinates') as SVGElement;
        
        if (coordinatesGroup) {
          if (showCoordinates) {
            // Mostrar coordenadas
            coordinatesGroup.style.display = 'block';
          } else {
            // Ocultar coordenadas
            coordinatesGroup.style.display = 'none';
          }
        } else {
          console.log('No se encontró el grupo de coordenadas');
        }
      } else {
        console.log('No se encontró el elemento SVG cm-chessboard');
      }
    }
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
    if (this.board) {
      this.board.setPosition(this.config.position);
    }
  }

  public setPosition(position: string) {
    this.config = { ...this.config, position };  
    if (this.board) {
      this.board.setPosition(position);
    }
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
   * Obtiene la orientación actual del tablero
   * @returns 'w' para blanco, 'b' para negro
   */
  getOrientation(): 'w' | 'b' {
    return this.board ? this.board.getOrientation() : 'w';
  }

  /**
   * Verifica si las coordenadas están visibles
   * @returns true si las coordenadas están visibles, false en caso contrario
   */
  areCoordinatesVisible(): boolean {
    const boardElement = document.getElementById('boardPuzzle');
    if (boardElement) {
      const chessboardSVG = boardElement.querySelector('.cm-chessboard') as SVGElement;
      
      if (chessboardSVG) {
        const coordinatesGroup = chessboardSVG.querySelector('g.coordinates') as SVGElement;
        
        if (coordinatesGroup) {
          return coordinatesGroup.style.display !== 'none';
        }
      }
    }
    return this.config.style?.showCoordinates ?? false;
  }



}
