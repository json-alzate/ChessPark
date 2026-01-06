import { Component, OnInit, Input, AfterViewInit, EventEmitter, Output, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';
import { Markers } from 'cm-chessboard/src/extensions/markers/Markers.js';

import { Puzzle } from '@cpark/models';
import { UidGeneratorService } from '@chesspark/common-utils';

@Component({
  selector: 'lib-fen-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fen-board.component.html',
  styleUrl: './fen-board.component.scss',
})
export class FenBoardComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('boardContainer', { static: false }) boardContainer!: ElementRef<HTMLDivElement>;

  @Input() fen!: string;
  @Input() firstMoveSquaresHighlight?: string[];
  @Input() puzzle?: Puzzle;
  @Output() onPuzzleShowSolution = new EventEmitter<Puzzle>();

  private board: Chessboard | null = null;
  public uid: string;
  private uidGenerator = new UidGeneratorService();

  constructor() {
    this.uid = this.uidGenerator.generateSimpleUid();
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.buildBoard();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['fen'] && !changes['fen'].firstChange && this.board) {
      this.board.setPosition(this.fen);
      if (this.firstMoveSquaresHighlight && this.firstMoveSquaresHighlight.length >= 2) {
        this.showLastMove(this.firstMoveSquaresHighlight[0], this.firstMoveSquaresHighlight[1]);
      }
    }
  }

  buildBoard() {
    if (!this.boardContainer?.nativeElement || !this.fen) {
      return;
    }

    this.board = new Chessboard(this.boardContainer.nativeElement, {
      responsive: true,
      position: this.fen,
      assetsUrl: 'assets/cm-chessboard/assets/',
      assetsCache: true,
      style: {
        cssClass: 'chessboard-js',
        borderType: BORDER_TYPE.thin,
        pieces: {
          file: 'pieces/standard.svg',
        }
      },
      extensions: [
        { class: Markers }
      ]
    });

    if (this.firstMoveSquaresHighlight && this.firstMoveSquaresHighlight.length >= 2) {
      this.showLastMove(this.firstMoveSquaresHighlight[0], this.firstMoveSquaresHighlight[1]);
    }
  }

  // Muestra la ultima jugada utilizando marcadores
  showLastMove(from: string, to: string) {
    if (!this.board) {
      return;
    }

    this.board.removeMarkers();
    if (from && to) {
      const marker = { id: 'lastMove', class: 'marker-square-green', slice: 'markerSquare' };
      this.board.addMarker(marker, from);
      this.board.addMarker(marker, to);
    }
  }

  onShowSolution() {
    if (this.puzzle) {
      this.onPuzzleShowSolution.emit(this.puzzle);
    }
  }
}

