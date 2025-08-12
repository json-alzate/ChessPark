import { Component, OnInit, Output, EventEmitter } from '@angular/core';
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
  
  ngOnInit() {
    this.buildBoard();
  }

  async buildBoard() {
    const config: ChessboardConfig = {
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
    
    const board: any = await new Chessboard(document.getElementById('boardPuzzle') as HTMLElement, config);


    // Agregar evento de clic en casillas usando enableSquareSelect
    board.enableSquareSelect('pointerdown', (eventData: any) => {
      
      if (eventData.square) {
        this.squareSelected.emit(eventData.square);
      }
    });
  }
}
