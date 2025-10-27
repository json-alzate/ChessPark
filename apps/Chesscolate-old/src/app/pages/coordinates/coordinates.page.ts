//core and third party libraries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Meta } from '@angular/platform-browser';


import { AlertController } from '@ionic/angular';

import {
  COLOR,
  INPUT_EVENT_TYPE,
  MOVE_INPUT_MODE,
  SQUARE_SELECT_TYPE,
  Chessboard,
  BORDER_TYPE
} from 'cm-chessboard';

// utils
import { randomFEN } from '@utils/random-fen';

// rxjs
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';




// models
import { CoordinatesPuzzle } from '@models/coordinates-puzzles.model';
import { Profile } from '@models/profile.model';

// services
import { CoordinatesPuzzlesService } from '@services/coordinates-puzzles.service';
import { ProfileService } from '@services/profile.service';
import { UiService } from '@services/ui.service';
import { SoundsService } from '@services/sounds.service';

// components



@Component({
  selector: 'app-coordinates',
  templateUrl: './coordinates.page.html',
  styleUrls: ['./coordinates.page.scss'],
})
export class CoordinatesPage implements OnInit {

  letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  numbers = ['1', '2', '3', '4', '5', '6', '7', '8'];
  board;

  subsSeconds;


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

  profile: Profile;

  private unsubscribeIntervalSeconds$ = new Subject<void>();

  constructor(
    private alertController: AlertController,
    private coordinatesPuzzlesService: CoordinatesPuzzlesService,
    private profileService: ProfileService,
    public uiService: UiService,
    private meta: Meta,
    private router: Router,
    private soundsService: SoundsService,
  ) {
    this.profileService.subscribeToProfile().subscribe((profile: Profile) => {
      this.profile = profile;
    });
  }

  ngOnInit() {
    this.meta.addTags([
      { name: 'title', content: 'ChessColate' },
      { name: 'description', content: 'Entrenamiento de coordenadas del tablero de ajedrez.' },
      { name: 'keywords', content: 'ajedrez, entrenamiento, chess, board, coordinates' },
      { name: 'robots', content: 'index, nofollow' },
      { property: 'og:title', content: 'ChessColate' },
      { property: 'og:description', content: 'Entrenamiento de coordenadas del tablero de ajedrez.' },
      { property: 'og:image', content: 'https://chesscolate.com/assets/tags/chesscolate.jpg' },
      { property: 'og:url', content: 'https://chesscolate.com/coordinates/training' }
    ]);
    this.router.events.forEach(item => {
      if (item instanceof NavigationEnd) {
        // TODO: track event
      }
    });
  }

  ionViewDidEnter() {

    if (!this.board) {
      this.loadBoard();
    }

  }


  async loadBoard(showCoordinates = false, position = '8/8/8/8/8/8/8/8 w - - 0 1') {
    this.board = await new Chessboard(document.getElementById('boardCoordinates'), {
      position,
      responsive: true,
      style: {
        cssClass: 'chessboard-js',
        showCoordinates,
        borderType: BORDER_TYPE.thin,
        pieces: {
          file: this.uiService.pieces,
        }
      },
    });

    this.board.enableSquareSelect((event) => {
      switch (event.type) {
        case SQUARE_SELECT_TYPE.primary:

          if (this.isPlaying) {

            if (event.mouseEvent.type === 'mouseup') {
              if (event.square === this.currentPuzzle) {
                this.squaresGood.push(this.currentPuzzle);
                this.nextPuzzle();
              } else {
                this.timeColor = 'danger';
                this.squaresBad.push(this.currentPuzzle);
                this.soundsService.playErrorCoordinates();
              }
            }

          }

          break;

        // left click
        case SQUARE_SELECT_TYPE.secondary:
          // right click
          break;
      }
    });

  }

  changeOrientation(orientation?: 'w' | 'b') {
    this.board.setOrientation(orientation);
  }

  toggleBoardCoordinates() {
    this.showCoordinates = !this.showCoordinates;
    this.board.destroy();
    // Eliminar el div vacío
    const boardContainer = document.getElementById('boardCoordinates');
    const emptyDiv = Array.from(boardContainer.children).find((child) => child.childElementCount === 0);
    emptyDiv.remove();

    this.loadBoard(this.showCoordinates, this.currentFenInBoard);

  }

  toggleShowPieces() {
    this.showPieces = !this.showPieces;
    const fenToSet = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Inicial

    if (this.showPieces) {
      if (this.randomPosition) {
        this.currentFenInBoard = randomFEN();
      } else {
        this.currentFenInBoard = fenToSet;
      }
    } else {
      this.currentFenInBoard = '8/8/8/8/8/8/8/8 w - - 0 1'; // Vacío
    }

    this.board.setPosition(this.currentFenInBoard);

  }

  toggleRandomPosition() {
    this.randomPosition = !this.randomPosition;
    if (this.randomPosition) {
      this.board.setPosition(randomFEN());
    } else {
      this.board.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
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
    this.changeOrientation(orientation);

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
        this.stopGame();
      } else if (this.time > 15) {
        this.timeColor = 'success';
      } else {
        this.timeColor = 'warning';
      }
    });

  }


  nextPuzzle() {
    this.score++;
    this.currentPuzzle = this.puzzles[this.score];

    if (this.randomPosition) {
      this.board.setPosition(randomFEN());
    }

  }


  stopGame() {
    this.unsubscribeIntervalSeconds$.next();
    this.presentAlertScore();
    this.saveGame();
    this.isPlaying = false;
    this.currentPuzzle = '';
    this.progressValue = 1;
    this.timeColor = 'success';
    this.time = 60;
  }


  saveGame() {
    const coordinatesPuzzle: CoordinatesPuzzle = {
      uidUser: this.profile?.uid,
      score: this.score,
      squaresGood: this.squaresGood,
      squaresBad: this.squaresBad,
      date: new Date().getTime(),
      round: this.puzzles,
      color: this.board.getOrientation()
    };
    this.coordinatesPuzzlesService.triggerRequestAddOneCoordinatesPuzzle(coordinatesPuzzle);
  }


  async presentAlertScore() {
    const alert = await this.alertController.create({
      subHeader: `${this.score}`,
      cssClass: 'alert-score',
      buttons: ['OK']
    });

    await alert.present();
  }


}
