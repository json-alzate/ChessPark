
import { Component,  CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';


import { IonContent, IonModal, IonGrid, IonRow, IonCol, IonIcon , IonTitle, IonToolbar, IonHeader, IonFooter} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shuffleOutline, settingsOutline } from 'ionicons/icons';
import { OverlayEventDetail } from '@ionic/core/components';



import { BoardComponent } from '@chesspark/board';
import { interval, Observable, Subject, takeUntil } from 'rxjs';
import { StorageService, CoordinatesPuzzle } from '../../services/storage.service';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import confetti from 'canvas-confetti';


addIcons({ shuffleOutline, settingsOutline });



@Component({
  selector: 'app-coordinates',
  templateUrl: 'coordinates.page.html',
  styleUrls: ['coordinates.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, IonContent, BoardComponent, IonModal, IonGrid, IonRow, IonCol, IonIcon ],
})
export class CoordinatesPage {

  @ViewChild(BoardComponent) boardComponent!: BoardComponent;
  @ViewChild(IonModal) resultsModal!: IonModal;

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

  // Estadísticas del juego actual
  currentGameStats = {
    correctAnswers: 0,
    incorrectAnswers: 0,
    accuracy: 0
  };


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

  // Modal de resultados
  isNewRecord = false;
  recordType: 'color' | 'overall' | 'both' | null = null;

    // Mejores puntajes
    bestScores: Array<{
      score: number;
      date: number;
      timeAgo: string;
      color: 'w' | 'b';
    }> = [];
  
    private unsubscribeIntervalSeconds$ = new Subject<void>();

    constructor(private storageService: StorageService) {
      this.loadUserStats();
      this.loadBestScores();
    }

  /**
   * Carga las estadísticas del usuario
   */
  loadUserStats() {
    this.userStats = this.storageService.getUserStats();
  }

  /**
   * Carga los mejores puntajes del usuario
   */
  loadBestScores() {
    const allGames = this.storageService.getAllGames();
    
    // Obtener los 5 mejores puntajes
    const topScores = allGames
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(game => ({
        score: game.score,
        date: game.date,
        timeAgo: this.formatTimeAgo(game.date),
        color: game.color
      }));

    this.bestScores = topScores;
  }

  /**
   * Actualiza las estadísticas del juego actual
   */
  updateGameStats() {
    const total = this.currentGameStats.correctAnswers + this.currentGameStats.incorrectAnswers;
    this.currentGameStats.accuracy = total > 0 ? (this.currentGameStats.correctAnswers / total) * 100 : 0;
  }

  /**
   * Formatea la fecha como "hace X tiempo"
   * @param timestamp Timestamp de la fecha
   * @returns String formateado
   */
  formatTimeAgo(timestamp: number): string {
    try {
      return formatDistanceToNow(timestamp, { 
        addSuffix: true, 
        locale: es 
      });
    } catch (error) {
      return 'recientemente';
    }
  }

  /**
   * Obtiene el mejor puntaje por color
   * @param color Color del tablero ('w' o 'b')
   * @returns Mejor puntaje para ese color
   */
  getBestScoreByColor(color: 'w' | 'b'): number {
    const colorGames = this.bestScores.filter(game => game.color === color);
    return colorGames.length > 0 ? Math.max(...colorGames.map(g => g.score)) : 0;
  }

  /**
   * Obtiene cuándo se hizo el mejor puntaje por color
   * @param color Color del tablero ('w' o 'b')
   * @returns String formateado de cuándo se hizo
   */
  getBestScoreTimeByColor(color: 'w' | 'b'): string {
    const colorGames = this.bestScores.filter(game => game.color === color);
    if (colorGames.length === 0) return 'Nunca';
    
    const bestGame = colorGames.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return bestGame.timeAgo;
  }

  // Método para escuchar cuando se presiona una casilla en el tablero
  onSquareSelected(square: string) {
    if (this.isPlaying && this.currentPuzzle) {
      if (square === this.currentPuzzle) {
        // Coordenada correcta
        this.squaresGood.push(this.currentPuzzle);
        this.score++;
        this.currentGameStats.correctAnswers++;
        this.updateGameStats();
        this.nextPuzzle();
      } else {
        // Coordenada incorrecta
        this.squaresBad.push(this.currentPuzzle);
        this.currentGameStats.incorrectAnswers++;
        this.updateGameStats();
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

    // Reiniciar estadísticas del juego actual
    this.currentGameStats = {
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracy: 0
    };

    let orientation: 'w' | 'b' = this.color === 'white' ? 'w' : 'b';

    if (this.color === 'random') {
      orientation = Math.random() < 0.5 ? 'w' : 'b';
    }

    this.currentColorInBoard = orientation === 'w' ? 'white' : 'black';
    
    // Aplicar la orientación del tablero al iniciar el juego
    // Si es random, usar el color específico que se seleccionó aleatoriamente
    if (this.boardOrientation === 'random') {
      this.boardComponent?.changeOrientation(orientation);
    } else {
      this.changeBoardOrientation(this.boardOrientation);
    }

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
    
    // Mostrar modal de resultados
    this.resultsModal.present();
    
    // Recargar estadísticas
    this.loadUserStats();
    this.loadBestScores(); // Recargar mejores puntajes después de cada juego
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

    // Verificar si se logró un nuevo récord antes de guardar
    this.checkAndCelebrateNewRecord(gameResult.score, gameResult.color);

    this.storageService.saveGameResult(gameResult);
  }

  /**
   * Verifica si se logró un nuevo récord y celebra con confetti
   * @param newScore Nuevo puntaje logrado
   * @param color Color del tablero con el que se jugó
   */
  private checkAndCelebrateNewRecord(newScore: number, color: 'w' | 'b') {
    const currentBestScoreByColor = this.getBestScoreByColor(color);
    const currentBestScoreOverall = this.userStats.bestScore;
    
    this.isNewRecord = false;
    this.recordType = null;

    // Verificar si es nuevo récord por color
    if (newScore > currentBestScoreByColor) {
      this.isNewRecord = true;
      this.recordType = 'color';
    }

    // Verificar si es nuevo récord general
    if (newScore > currentBestScoreOverall) {
      this.isNewRecord = true;
      this.recordType = this.recordType === 'color' ? 'both' : 'overall';
    }

    if (this.isNewRecord && this.recordType) {
      // ¡Nuevo récord! Lanzar confetti
      this.launchConfetti(color, this.recordType);
    }
  }

  /**
   * Lanza confetti para celebrar el nuevo récord
   * @param color Color del tablero (para personalizar el confetti)
   * @param recordType Tipo de récord logrado
   */
  private launchConfetti(color: 'w' | 'b', recordType: 'color' | 'overall' | 'both') {
    // Configuración del confetti según el color
    let confettiColors: string[];
    
    if (recordType === 'overall' || recordType === 'both') {
      // Para récords generales, usar colores dorados
      confettiColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
    } else {
      // Para récords por color, usar tonos del color correspondiente
      confettiColors = color === 'w' 
        ? ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'] // Tonos blancos
        : ['#000000', '#1a1a1a', '#333333', '#4d4d4d']; // Tonos negros
    }

    // Lanzar confetti desde múltiples posiciones
    const duration = recordType === 'both' ? 5000 : 3000; // Más tiempo para récords dobles
    const animationEnd = Date.now() + duration;
    const defaults = { 
      startVelocity: 30, 
      spread: 360, 
      ticks: 60, 
      zIndex: 0,
      colors: confettiColors
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti desde la izquierda
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Confetti desde la derecha
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });

      // Confetti desde el centro
      confetti({
        ...defaults,
        particleCount: particleCount * 0.5,
        origin: { x: randomInRange(0.4, 0.6), y: Math.random() - 0.2 }
      });

      // Confetti extra para récords especiales
      if (recordType === 'both') {
        confetti({
          ...defaults,
          particleCount: particleCount * 0.3,
          origin: { x: randomInRange(0.2, 0.8), y: Math.random() - 0.1 }
        });
      }
    }, 250);
  }



  /**
   * Cierra el modal de resultados
   */
  closeResultsModal() {
    this.resultsModal.dismiss(null, 'confirm');
  }

  /**
   * Maneja el cierre del modal
   */
  onWillDismiss(event: CustomEvent<OverlayEventDetail>) {
    this.isNewRecord = false;
    this.recordType = null;
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
