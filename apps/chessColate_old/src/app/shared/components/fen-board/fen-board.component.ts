import { Component, OnInit, Input, AfterViewInit, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

import {
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';
// import { Markers } from 'src/lib/cm-chessboard/src/extensions/markers/markers';
import { Markers } from 'cm-chessboard/src/extensions/markers/markers';


import { createUid } from '@utils/create-uid';

// models
import { Puzzle } from '@models/puzzle.model';

// Services
import { UiService } from '@services/ui.service';

@Component({
  selector: 'app-fen-board',
  templateUrl: './fen-board.component.html',
  styleUrls: ['./fen-board.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FenBoardComponent implements OnInit, AfterViewInit {

  fen: string;
  squaresHighlight: string[];
  uid: string;
  board;
  puzzle: Puzzle;

  @Output() onPuzzleShowSolution = new EventEmitter<Puzzle>();

  constructor(
    private uiService: UiService
  ) { }


  @Input() set setFen(data: { fen: string; firstMoveSquaresHighlight: string[]; puzzle: Puzzle }) {
    this.uid = createUid();
    this.fen = data.fen;
    this.squaresHighlight = data.firstMoveSquaresHighlight;
    this.puzzle = data.puzzle;
  };



  ngOnInit() { }

  ngAfterViewInit() {
    this.buildBoard();
  }

  buildBoard() {

    // Se configura la ruta de las piezas con un timestamp para que no se guarde en cache (assetsCache: false, no se ven bien las piezas)
    const uniqueTimestamp = new Date().getTime();
    const piecesPath = `${this.uiService.pieces}?t=${uniqueTimestamp}`;

    const cssClass = this.uiService.currentBoardStyleSelected.name !== 'default' ? this.uiService.currentBoardStyleSelected.name : null;

    this.board = new Chessboard(document.getElementById(this.uid), {
      responsive: true,
      position: this.fen,
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
        { class: Markers }
      ]
    });

    this.showLastMove(this.squaresHighlight[0], this.squaresHighlight[1]);
  }

  // Muestra la ultima jugada utilizando marcadores
  showLastMove(from: string, to: string) {

    this.board.removeMarkers();
    if (from && to) {
      const marker = { id: 'lastMove', class: 'marker-square-green', slice: 'markerSquare' };
      this.board.addMarker(marker, from);
      this.board.addMarker(marker, to);
    }
  }

  onShowSolution() {
    this.onPuzzleShowSolution.emit(this.puzzle);
  }

}
