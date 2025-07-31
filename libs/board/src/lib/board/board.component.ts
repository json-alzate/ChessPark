import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Chessboard, BOARD_TYPE } from 'cm-chessboard';


@Component({
  selector: 'lib-board',
  imports: [CommonModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.css',
})
export class BoardComponent implements OnInit {
  
  ngOnInit() {
    this.buildBoard();
  }

  buildBoard() {
    const config = {
      coordinates: false,
      responsive: true,
      position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      assetsUrl: 'assets/cm-chessboard/assets/',
    };
    // Chessground(document.getElementById('boardPuzzle') as HTMLElement, config);
    const board = new Chessboard(document.getElementById('boardPuzzle') as HTMLElement, config);
    
  }
}
