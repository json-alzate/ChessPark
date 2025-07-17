import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Chessground } from '@lichess-org/chessground';


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
    const config = {};
    const ground = Chessground(document.getElementById('boardPuzzle') as HTMLElement, config);
    console.log('ground', ground);
    
  }
}
