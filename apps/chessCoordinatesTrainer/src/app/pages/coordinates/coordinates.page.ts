
import { Component,  CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';


import {   IonContent } from '@ionic/angular/standalone';



import { BoardComponent } from '@chesspark/board';
import { interval, Observable, Subject, takeUntil } from 'rxjs';


@Component({
  selector: 'app-coordinates',
  templateUrl: 'coordinates.page.html',
  styleUrls: ['coordinates.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, IonContent, BoardComponent ],
})
export class CoordinatesPage {

  letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  numbers = ['1', '2', '3', '4', '5', '6', '7', '8'];

  subsSeconds: Observable<number> | undefined;


  isPlaying = false;

  currentPuzzle = '';
  puzzles: string[] = [];

  squaresGood: string[] = [];
  squaresBad: string[] = [];
  score = 0;
  time = 60;
  progressValue = 1;
  timeColor: 'success' | 'warning' | 'danger' = 'success';


    // Options
    color: 'random' | 'white' | 'black' = 'random';
    showCoordinates = false;
    showPieces = false;
    randomPosition = false;
    currentFenInBoard = '8/8/8/8/8/8/8/8 w - - 0 1';
    currentColorInBoard: 'white' | 'black' = 'white';
  
    // profile: Profile;
  
    private unsubscribeIntervalSeconds$ = new Subject<void>();

  play() {
    this.puzzles = this.generatePuzzles(200);
    this.currentPuzzle = this.puzzles[0];
    this.time = 60;
    this.score = 0;
    this.squaresBad = [];
    this.squaresGood = [];

    let orientation: 'w' | 'b' = this.color === 'white' ? 'w' : 'b';

    if (this.color === 'random') {
      orientation = Math.random() < 0.5 ? 'w' : 'b';
    }

    this.currentColorInBoard = orientation === 'w' ? 'white' : 'black';
    // this.changeOrientation(orientation);

    this.isPlaying = true;
    this.initInterval();
  }

  initInterval() {

    const seconds = interval(10);
    this.subsSeconds = seconds.pipe(
      takeUntil(this.unsubscribeIntervalSeconds$)
    );

    this.subsSeconds.subscribe(() => {
      this.time = this.time - 0.01;
      this.progressValue = this.time / 60;
      if (this.time < 1) {
        // this.stopGame();
      } else if (this.time > 15) {
        this.timeColor = 'success';
      } else {
        this.timeColor = 'warning';
      }
    });

  }




  /**
   * Generar escaques puzzles
   *
   * @count = 1
   */
  generatePuzzles(count = 1): string[] {
    const puzzles = [];

    for (let i = 0; i < count; i++) {
      // eslint-disable-next-line max-len
      const puzzle = `${this.letters[Math.floor(Math.random() * this.letters.length)]}${this.numbers[Math.floor(Math.random() * this.numbers.length)]}`;
      puzzles.push(puzzle);
    }

    return puzzles;
  }



  toggleBoardCoordinates() {
    this.showCoordinates = !this.showCoordinates;
    // this.board.destroy();
    // Eliminar el div vacío
    const boardContainer = document.getElementById('boardCoordinates');
    const emptyDiv = Array.from(boardContainer?.children || []).find((child) => child.childElementCount === 0);
    emptyDiv?.remove();

    // this.loadBoard(this.showCoordinates, this.currentFenInBoard);

  }


  toggleShowPieces() {
    this.showPieces = !this.showPieces;
    const fenToSet = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Inicial

    if (this.showPieces) {
      if (this.randomPosition) {
        // this.currentFenInBoard = randomFEN();
      } else {
        this.currentFenInBoard = fenToSet;
      }
    } else {
      this.currentFenInBoard = '8/8/8/8/8/8/8/8 w - - 0 1'; // Vacío
    }

    // this.board.setPosition(this.currentFenInBoard);

  }

  toggleRandomPosition() {
    this.randomPosition = !this.randomPosition;
    if (this.randomPosition) {
      // this.board.setPosition(randomFEN());
    } else {
      // this.board.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
  }

  changeOrientation(orientation?: 'w' | 'b') {
    // this.board.setOrientation(orientation);
  }


}
