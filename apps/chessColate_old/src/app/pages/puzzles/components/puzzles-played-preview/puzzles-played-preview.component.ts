import { Component, OnInit, Input } from '@angular/core';

import {
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';
import { MARKER_TYPE, Markers } from 'cm-chessboard/src/extensions/markers/markers';

import Chess from 'chess.js';

import { Block } from '@models/plan.model';
import { UserPuzzle } from '@models/user-puzzles.model';


// utils
import { createUid } from '@utils/create-uid';

// services
import { UiService } from '@services/ui.service';

@Component({
  selector: 'app-puzzles-played-preview',
  templateUrl: './puzzles-played-preview.component.html',
  styleUrls: ['./puzzles-played-preview.component.scss'],
})
export class PuzzlesPlayedPreviewComponent implements OnInit {

  @Input() blocks: Block[] = [];
  puzzlesToShow: UserPuzzle[] = [];
  winPercentage = 0;
  uidBoard = createUid();
  chessInstance = new Chess();
  board;
  constructor(
    private uiService: UiService
  ) { }

  ngOnInit() {

    setTimeout(() => {
      this.buildBoard();
    }, 500);

  }


  buildBoard() {
    const uniqueTimestamp = new Date().getTime();
    const piecesPath = `${this.uiService.pieces}?t=${uniqueTimestamp}`;

    const cssClass = this.uiService.currentBoardStyleSelected.name !== 'default' ? this.uiService.currentBoardStyleSelected.name : null;

    this.board = new Chessboard(document.getElementById(this.uidBoard), {
      responsive: true,
      assetsUrl: '/assets/cm-chessboard/',
      position: '8/8/8/8/8/8/8/8 w - - 0 1',
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

    console.log('board----- ', this.board);


    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      if (block.puzzlesPlayed.length > 0) {
        const puzzlesResolved = block.puzzlesPlayed.filter(puzzle => puzzle.resolved);
        const puzzlesResolvedShortByElo = puzzlesResolved.sort((a, b) => b.eloPuzzle - a.eloPuzzle);
        const puzzlesNotResolved = block.puzzlesPlayed.filter(puzzle => !puzzle.resolved);
        const puzzlesNotResolvedShortByElo = puzzlesNotResolved.sort((a, b) => b.eloPuzzle - a.eloPuzzle);
        this.puzzlesToShow = [...this.puzzlesToShow, ...puzzlesResolvedShortByElo, ...puzzlesNotResolvedShortByElo];
      }

    }

    if (this.puzzlesToShow[0]) {
      this.playPuzzle(0);
    }

    // ejem: 0.57
    this.winPercentage = this.calculatePercentageWin() / 100;
  }

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

  showLastMove(from: string, to: string) {
    this.board.removeMarkers();
    const marker = { id: 'lastMove', class: 'marker-square-green', slice: 'markerSquare' };
    this.board.addMarker(marker, from);
    this.board.addMarker(marker, to);
  }

  playPuzzle(index: number) {
    if (!this.puzzlesToShow[index].rawPuzzle) {
      return;
    }
    this.chessInstance.load(this.puzzlesToShow[index].rawPuzzle.fen);
    this.turnRoundBoard(this.chessInstance.turn() === 'b' ? 'w' : 'b');
    this.startMoves(index);
  }

  async startMoves(index: number) {

    const rawPuzzle = this.puzzlesToShow[index].rawPuzzle;
    const arrayFenSolution = [];
    const arrayMovesSolution = rawPuzzle.moves.split(' ');
    arrayFenSolution.push(this.chessInstance.fen());
    for (const move of arrayMovesSolution) {
      this.chessInstance.move(move, { sloppy: true });
      const fen = this.chessInstance.fen();
      arrayFenSolution.push(fen);
    }

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < arrayFenSolution.length; i++) {
      let lastMove;
      if (!arrayFenSolution[i - 1]) {
        lastMove = rawPuzzle.fen;
      } else {
        lastMove = arrayFenSolution[i - 1];
      }
      await this.board.setPosition(arrayFenSolution[i], true);

      await new Promise<void>((resolve, reject) => {
        setTimeout(() => resolve(), 500);
      });

      if (arrayMovesSolution[i]) {
        const from = arrayMovesSolution[i].slice(0, 2);
        const to = arrayMovesSolution[i].slice(2, 4);
        this.showLastMove(from, to);
      }

    }

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => resolve(), 800);
    });
    index = index + 1;
    if (index < this.puzzlesToShow.length) {

      this.playPuzzle(index);
    } else {
      index = 0;
      this.playPuzzle(index);
    }


  }

  calculatePercentageWin() {
    if (this.puzzlesToShow.length > 0) {
      return Math.round((this.puzzlesToShow.filter(puzzle => puzzle.resolved).length / this.puzzlesToShow.length) * 100);
    }
    return 0;
  }

}
