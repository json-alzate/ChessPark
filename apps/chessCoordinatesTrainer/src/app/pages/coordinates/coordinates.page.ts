
import { Component,  CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';


import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shuffleOutline, settingsOutline } from 'ionicons/icons';



import { BoardComponent } from '@chesspark/board';
import { interval, Observable, Subject, takeUntil } from 'rxjs';
import { StorageService, CoordinatesPuzzle } from '../../services/storage.service';


@Component({
  selector: 'app-coordinates',
  templateUrl: 'coordinates.page.html',
  styleUrls: ['coordinates.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, IonContent, BoardComponent ],
})
export class CoordinatesPage {

  @ViewChild(BoardComponent) boardComponent!: BoardComponent;

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
    
    // Orientación del tablero
    boardOrientation: 'random' | 'white' | 'black' = 'random';

    // Estadísticas del usuario
    userStats = {
      totalGames: 0,
      bestScore: 0,
      averageScore: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      accuracy: 0
    };
  
    private unsubscribeIntervalSeconds$ = new Subject<void>();

    constructor(private storageService: StorageService) {
      addIcons({ shuffleOutline, settingsOutline });
      this.loadUserStats();
    }

  /**
   * Carga las estadísticas del usuario
   */
  loadUserStats() {
    this.userStats = this.storageService.getUserStats();
  }

  // Método para escuchar cuando se presiona una casilla en el tablero
  onSquareSelected(square: string) {
    if (this.isPlaying && this.currentPuzzle) {
      if (square === this.currentPuzzle) {
        // Coordenada correcta
        this.squaresGood.push(this.currentPuzzle);
        this.score++;
        this.nextPuzzle();
      } else {
        // Coordenada incorrecta
        this.squaresBad.push(this.currentPuzzle);
        this.timeColor = 'danger';
        // Cambiar el color de vuelta después de un tiempo
        setTimeout(() => {
          this.timeColor = this.time > 15 ? 'success' : 'warning';
        }, 500);
      }
    }
  }

  /**
   * Cambia la orientación del tablero
   * @param orientation Nueva orientación
   */
  changeBoardOrientation(orientation: 'random' | 'white' | 'black') {
    this.boardOrientation = orientation;
    
    if (this.boardComponent) {
      if (orientation === 'random') {
        // Para random, elegir aleatoriamente entre blanco y negro
        const randomOrientation = Math.random() < 0.5 ? 'w' : 'b';
        this.boardComponent.changeOrientation(randomOrientation);
      } else {
        // Para blanco o negro específico
        const boardOrientation = orientation === 'white' ? 'w' : 'b';
        this.boardComponent.changeOrientation(boardOrientation);
      }
    }
  }

  play() {
    this.puzzles = this.generatePuzzles(200);
    this.currentPuzzle = this.puzzles[0];
    this.time = 60;
    this.score = 0;
    this.squaresBad = [];
    this.squaresGood = [];
    this.timeColor = 'success';
    this.progressValue = 1;

    let orientation: 'w' | 'b' = this.color === 'white' ? 'w' : 'b';

    if (this.color === 'random') {
      orientation = Math.random() < 0.5 ? 'w' : 'b';
    }

    this.currentColorInBoard = orientation === 'w' ? 'white' : 'black';
    
    // Aplicar la orientación del tablero al iniciar el juego
    this.changeBoardOrientation(this.boardOrientation);

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
      
      if (this.time <= 0) {
        this.stopGame();
      } else if (this.time > 20) {
        this.timeColor = 'success';
      } else if (this.time > 10) {
        this.timeColor = 'warning';
      } else {
        this.timeColor = 'danger';
      }
    });
  }

  /**
   * Pasa al siguiente puzzle
   */
  nextPuzzle() {
    //TODO: si se completan lso puzzles cargar mas para que nunca se acaben
    if (this.score < this.puzzles.length) {
      this.currentPuzzle = this.puzzles[this.score];
    } else {
      // Se acabaron los puzzles, el jugador ganó
      this.stopGame();
    }
  }

  /**
   * Detiene el juego y guarda los resultados
   */
  stopGame() {
    this.unsubscribeIntervalSeconds$.next();
    this.isPlaying = false;
    
    // Guardar el resultado del juego
    this.saveGameResult();
    
    // Mostrar alerta con el puntaje
    this.showGameResult();
    
    // Recargar estadísticas
    this.loadUserStats();
  }

  /**
   * Guarda el resultado del juego en localStorage
   */
  saveGameResult() {
    const gameResult: Omit<CoordinatesPuzzle, 'uid' | 'uidUser'> = {
      score: this.score,
      squaresGood: this.squaresGood,
      squaresBad: this.squaresBad,
      round: this.puzzles,
      date: new Date().getTime(),
      color: this.boardComponent ? this.boardComponent.getOrientation() : 'w'
    };

    this.storageService.saveGameResult(gameResult);
  }

  /**
   * Muestra el resultado del juego
   */
  showGameResult() {
    const message = `¡Juego terminado!\n\nPuntaje: ${this.score}\nAciertos: ${this.squaresGood.length}\nErrores: ${this.squaresBad.length}`;
    alert(message);
  }

  /**
   * Generar escaques puzzles
   *
   * @count = 1
   */
  generatePuzzles(count = 1): string[] {
    const puzzles: string[] = [];

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
