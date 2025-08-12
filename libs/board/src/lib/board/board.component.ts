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
  
  @Input() boardConfig?: ChessboardConfig;
  
  private board: any = null;
  
  ngOnInit() {
    this.buildBoard();
  }

  async buildBoard() {
    // Configuración por defecto
    const defaultConfig: ChessboardConfig = {
      coordinates: false,
      responsive: true,
      position: '8/8/8/8/8/8/8/8 w - - 0 1',
      assetsUrl: 'assets/cm-chessboard/assets/',
      style: {
        cssClass: 'chessboard-js',
        showCoordinates: true,
        // borderType: BORDER_TYPE.thin,
      },
    };
    
    // Usar la configuración inyectada o la configuración por defecto
    const config: ChessboardConfig = this.boardConfig ? { ...defaultConfig, ...this.boardConfig } : defaultConfig;
    
    this.board = await new Chessboard(document.getElementById('boardPuzzle') as HTMLElement, config);

    // Agregar evento de clic en casillas usando enableSquareSelect
    this.board.enableSquareSelect('pointerdown', (eventData: any) => {
      
      if (eventData.square) {
        this.squareSelected.emit(eventData.square);
      }
    });
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
}
