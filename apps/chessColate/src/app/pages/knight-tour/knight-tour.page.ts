import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subject, takeUntil } from 'rxjs';

import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, refreshOutline, playOutline, settingsOutline, closeOutline, trophy } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';

import { BoardComponent } from '@chesspark/board';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

addIcons({ homeOutline, refreshOutline, playOutline, settingsOutline, closeOutline, trophy });

type StartPosition = 'random' | 'a1' | 'h1' | 'a8' | 'h8';

@Component({
  selector: 'app-knight-tour',
  templateUrl: 'knight-tour.page.html',
  styleUrls: ['knight-tour.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    BoardComponent,
    NavbarComponent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    TranslocoPipe,
  ],
})
export class KnightTourPage implements OnInit, OnDestroy {
  @ViewChild(BoardComponent) boardComponent!: BoardComponent;

  // Estado del juego
  isPlaying = false;
  isCompleted = false;
  isGameOver = false;
  visitedSquares: string[] = [];
  currentPosition: string = '';
  startPosition: StartPosition = 'random';
  showVisited: boolean = true;

  // Contador de tiempo
  elapsedTime = 0;
  startTime: number = 0;
  private timeInterval$ = new Subject<void>();

  // Movimientos válidos del caballo (patrón L)
  private readonly knightMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  // Letras y números del tablero
  private readonly letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  private readonly numbers = ['1', '2', '3', '4', '5', '6', '7', '8'];

  private selectedSquare: string | null = null;

  constructor(
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initializeBoard();
  }

  ngOnDestroy() {
    this.timeInterval$.next();
    this.timeInterval$.complete();
  }

  /**
   * Inicializa el tablero con el caballo en la posición inicial configurada
   */
  initializeBoard() {
    // Esperar a que el boardComponent esté listo
    this.waitForBoardReady(() => {
      if (this.boardComponent) {
        // Colocar el caballo en la posición inicial
        const initialPosition = this.getStartPosition();
        this.currentPosition = initialPosition;
        
        // Actualizar posición del caballo en el tablero
        this.updateKnightPosition(initialPosition);
        
        // Marcar la casilla inicial visualmente
        setTimeout(() => {
          this.markInitialSquare(initialPosition);
        }, 100);
        
        this.boardComponent.toggleCoordinates(true);
      }
    });
  }

  /**
   * Espera a que el boardComponent esté listo
   */
  waitForBoardReady(callback: () => void, retries = 20) {
    if (
      this.boardComponent &&
      this.boardComponent.isBoardReady &&
      this.boardComponent.isBoardReady()
    ) {
      callback();
    } else if (retries > 0) {
      setTimeout(() => this.waitForBoardReady(callback, retries - 1), 150);
    } else {
      console.warn('Board no está disponible después de varios intentos');
    }
  }

  /**
   * Obtiene la posición inicial según la configuración
   */
  getStartPosition(): string {
    if (this.startPosition === 'random') {
      const randomLetter = this.letters[Math.floor(Math.random() * this.letters.length)];
      const randomNumber = this.numbers[Math.floor(Math.random() * this.numbers.length)];
      return `${randomLetter}${randomNumber}`;
    }
    return this.startPosition;
  }

  /**
   * Inicia el juego (llamado automáticamente en el primer movimiento)
   */
  private startGame() {
    this.isPlaying = true;
    this.isCompleted = false;
    this.isGameOver = false;
    this.elapsedTime = 0;
    this.startTime = Date.now();

    // Asegurar que la posición inicial esté marcada como visitada (ya debería estar desde initializeBoard)
    if (this.currentPosition && !this.visitedSquares.includes(this.currentPosition)) {
      this.visitedSquares.push(this.currentPosition);
    }

    // Iniciar contador de tiempo
    this.startTimer();
  }

  /**
   * Reinicia el juego
   */
  resetGame() {
    this.stopTimer();
    this.isPlaying = false;
    this.isCompleted = false;
    this.isGameOver = false;
    this.visitedSquares = [];
    this.currentPosition = '';
    this.elapsedTime = 0;
    this.selectedSquare = null;

    // Limpiar marcadores
    this.clearAllMarkers();

    // Reinicializar tablero con caballo en la posición inicial configurada
    this.initializeBoard();
  }

  /**
   * Maneja la selección de una casilla
   */
  onSquareSelected(square: string) {
    // Si el juego está completado o en game over, no permitir movimientos
    if (this.isCompleted || this.isGameOver) {
      return;
    }

    // Si no hay posición actual, no hacer nada
    if (!this.currentPosition) {
      return;
    }

    // Si se selecciona la casilla actual, mostrar movimientos válidos
    if (square === this.currentPosition) {
      if (this.selectedSquare === square) {
        // Si ya está seleccionada, deseleccionar
        this.clearValidMoveMarkers();
        this.selectedSquare = null;
      } else {
        // Seleccionar y mostrar movimientos válidos
        this.selectedSquare = square;
        this.highlightValidMoves();
      }
      return;
    }

    // Si el juego no ha iniciado, iniciarlo en el primer movimiento
    if (!this.isPlaying) {
      this.startGame();
    }

    // Verificar si es un movimiento válido del caballo
    if (this.isValidKnightMove(this.currentPosition, square)) {
      // Verificar que no esté ya visitada
      if (this.visitedSquares.includes(square)) {
        // Ya visitada, limpiar selección y no permitir
        this.clearValidMoveMarkers();
        this.selectedSquare = null;
        return;
      }

      // Limpiar marcadores de movimientos válidos
      this.clearValidMoveMarkers();
      this.selectedSquare = null;

      // Mover el caballo
      this.currentPosition = square;
      this.visitedSquares.push(square);

      // Actualizar posición del caballo
      this.updateKnightPosition(square);

      // Marcar como visitada si está habilitado (con un pequeño delay para que se actualice el tablero)
      if (this.showVisited) {
        setTimeout(() => {
          this.markSquareAsVisited(square);
        }, 100);
      }

      // Verificar si se completó el recorrido
      if (this.visitedSquares.length === 64) {
        this.completeGame();
      } else {
        // Verificar si hay movimientos válidos disponibles
        this.checkGameOver();
      }
    } else {
      // No es un movimiento válido, limpiar selección si había una
      if (this.selectedSquare) {
        this.clearValidMoveMarkers();
        this.selectedSquare = null;
      }
    }
  }

  /**
   * Verifica si el juego debe terminar (no hay movimientos válidos)
   */
  checkGameOver() {
    if (!this.currentPosition) {
      return;
    }

    const validMoves = this.getValidKnightMoves(this.currentPosition);
    
    // Si no hay movimientos válidos disponibles, es game over
    if (validMoves.length === 0) {
      this.isGameOver = true;
      this.isPlaying = false;
      this.stopTimer();
      this.showGameOverAlert();
    }
  }

  /**
   * Muestra un alert con la información del game over
   */
  async showGameOverAlert() {
    const alert = await this.alertController.create({
      header: 'Game Over',
      message: `No hay más movimientos válidos disponibles.\n\nTiempo: ${this.formatTime(this.elapsedTime)}\nCasillas visitadas: ${this.visitedSquares.length} / 64`,
      buttons: [
        {
          text: 'Reiniciar',
          handler: () => {
            this.resetGame();
          }
        },
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  /**
   * Verifica si un movimiento es válido para el caballo
   */
  isValidKnightMove(from: string, to: string): boolean {
    const fromCoords = this.squareToCoords(from);
    const toCoords = this.squareToCoords(to);

    if (!fromCoords || !toCoords) {
      return false;
    }

    const [fromRow, fromCol] = fromCoords;
    const [toRow, toCol] = toCoords;

    // Verificar si el movimiento sigue el patrón L del caballo
    for (const [rowDelta, colDelta] of this.knightMoves) {
      if (fromRow + rowDelta === toRow && fromCol + colDelta === toCol) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convierte una casilla en notación de ajedrez a coordenadas [fila, columna]
   */
  squareToCoords(square: string): [number, number] | null {
    if (square.length !== 2) {
      return null;
    }

    const letter = square[0].toLowerCase();
    const number = parseInt(square[1], 10);

    const col = this.letters.indexOf(letter);
    const row = 8 - number; // Convertir a índice 0-7 (fila 0 = fila 8 del tablero)

    if (col === -1 || isNaN(number) || number < 1 || number > 8) {
      return null;
    }

    return [row, col];
  }

  /**
   * Convierte coordenadas [fila, columna] a notación de ajedrez
   */
  coordsToSquare(row: number, col: number): string {
    if (row < 0 || row > 7 || col < 0 || col > 7) {
      return '';
    }

    const letter = this.letters[col];
    const number = this.numbers[7 - row];
    return `${letter}${number}`;
  }

  /**
   * Obtiene los movimientos válidos del caballo desde una posición
   */
  getValidKnightMoves(from: string): string[] {
    const fromCoords = this.squareToCoords(from);
    if (!fromCoords) {
      return [];
    }

    const [row, col] = fromCoords;
    const validMoves: string[] = [];

    for (const [rowDelta, colDelta] of this.knightMoves) {
      const newRow = row + rowDelta;
      const newCol = col + colDelta;

      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const square = this.coordsToSquare(newRow, newCol);
        if (square && !this.visitedSquares.includes(square)) {
          validMoves.push(square);
        }
      }
    }

    return validMoves;
  }

  /**
   * Convierte una casilla en notación de ajedrez a coordenadas de fila y columna (0-7)
   */
  squareToBoardIndex(square: string): { row: number; col: number } | null {
    if (square.length !== 2) {
      return null;
    }

    const letter = square[0].toLowerCase();
    const number = parseInt(square[1], 10);

    const col = this.letters.indexOf(letter);
    const row = 8 - number; // Convertir a índice 0-7 (fila 0 = fila 8 del tablero)

    if (col === -1 || isNaN(number) || number < 1 || number > 8) {
      return null;
    }

    return { row, col };
  }

  /**
   * Crea un FEN con el caballo en una posición específica
   */
  createFenWithKnight(square: string): string {
    const coords = this.squareToBoardIndex(square);
    if (!coords) {
      return '8/8/8/8/8/8/8/8 w - - 0 1';
    }

    // Crear un array de 8 filas, cada una con 8 espacios vacíos
    const board: string[][] = Array(8).fill(null).map(() => Array(8).fill(''));

    // Colocar el caballo en la posición correcta
    board[coords.row][coords.col] = 'N';

    // Convertir cada fila a notación FEN
    const fenRows = board.map(row => {
      let fenRow = '';
      let emptyCount = 0;

      for (const cell of row) {
        if (cell === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fenRow += emptyCount.toString();
            emptyCount = 0;
          }
          fenRow += cell;
        }
      }

      if (emptyCount > 0) {
        fenRow += emptyCount.toString();
      }

      return fenRow || '8';
    });

    return `${fenRows.join('/')} w - - 0 1`;
  }

  /**
   * Actualiza la posición del caballo en el tablero
   */
  updateKnightPosition(square: string) {
    if (!this.boardComponent) {
      return;
    }

    this.waitForBoardReady(() => {
      // Crear FEN con el caballo en la posición correcta
      const fen = this.createFenWithKnight(square);
      this.boardComponent.setPosition(fen);
      console.log('Caballo colocado en:', square, 'FEN:', fen);
    });
  }

  /**
   * Marca la casilla inicial
   */
  markInitialSquare(square: string) {
    if (!this.boardComponent) {
      return;
    }

    this.waitForBoardReady(() => {
      if (this.boardComponent && this.boardComponent.isBoardReady()) {
        // Marcar la casilla inicial con un marcador especial
        const marker: any = {
          id: `initial-${square}`,
          class: 'marker-square-green',
          slice: 'markerSquare'
        };

        this.boardComponent.addMarker(square, marker);
        
        // También agregar a visitedSquares para que el contador empiece en 1
        if (!this.visitedSquares.includes(square)) {
          this.visitedSquares.push(square);
        }
      }
    });
  }

  /**
   * Marca una casilla como visitada
   */
  markSquareAsVisited(square: string) {
    if (!this.boardComponent) {
      return;
    }

    // Verificar que el board interno esté disponible
    this.waitForBoardReady(() => {
      if (this.boardComponent && this.boardComponent.isBoardReady()) {
        // Usar marker-square-green que es más visible
        const marker: any = {
          id: `visited-${square}`,
          class: 'marker-square-green',
          slice: 'markerSquare'
        };

        this.boardComponent.addMarker(square, marker);
        console.log('Marcador agregado en:', square);
      }
    });
  }

  /**
   * Actualiza todos los marcadores de casillas visitadas
   */
  updateVisitedMarkers() {
    if (!this.showVisited || !this.boardComponent) {
      return;
    }

    // Limpiar marcadores anteriores (excepto el actual)
    this.clearVisitedMarkers();

    // Agregar marcadores para todas las casillas visitadas
    for (const square of this.visitedSquares) {
      if (square !== this.currentPosition) {
        this.markSquareAsVisited(square);
      }
    }
  }

  /**
   * Limpia los marcadores de casillas visitadas
   */
  clearVisitedMarkers() {
    if (!this.boardComponent) {
      return;
    }

    // Remover todos los marcadores de casillas visitadas
    for (const square of this.visitedSquares) {
      if (square !== this.currentPosition) {
        // Remover todos los marcadores de esta casilla
        this.boardComponent.removeMarkers(square);
      }
    }
  }

  /**
   * Resalta los movimientos válidos del caballo usando puntos
   */
  highlightValidMoves() {
    if (!this.boardComponent || !this.currentPosition) {
      return;
    }

    // Limpiar marcadores de movimientos válidos (manteniendo los de casillas visitadas)
    this.clearValidMoveMarkers();

    const validMoves = this.getValidKnightMoves(this.currentPosition);
    
    this.waitForBoardReady(() => {
      if (this.boardComponent && this.boardComponent.isBoardReady()) {
        // Marcar la casilla seleccionada
        const selectedMarker: any = {
          class: 'marker-square-green',
          slice: 'markerSquare'
        };
        this.boardComponent.addMarker(this.currentPosition, selectedMarker);

        // Marcar los movimientos válidos con puntos verdes
        for (const square of validMoves) {
          const markerDotMove: any = {
            class: 'marker-dot-green',
            slice: 'markerDot'
          };
          this.boardComponent.addMarker(square, markerDotMove);
        }
      }
    });
  }

  /**
   * Limpia los marcadores de movimientos válidos (mantiene los de casillas visitadas)
   */
  clearValidMoveMarkers() {
    if (!this.boardComponent) {
      return;
    }

    this.waitForBoardReady(() => {
      if (this.boardComponent && this.boardComponent.isBoardReady()) {
        // Obtener todos los marcadores del tablero
        const allMarkers = this.boardComponent.getMarkers();
        
        // Remover solo los marcadores de tipo dot (movimientos válidos) y el marcador de selección
        // Mantener los marcadores de casillas visitadas
        for (const markerData of allMarkers) {
          if (markerData && markerData.square) {
            const marker = markerData.type || markerData;
            const square = markerData.square;
            
            // Remover marcadores de tipo dot (movimientos válidos)
            if (marker && marker.slice === 'markerDot') {
              this.boardComponent.removeMarkers(square, marker);
            }
            
            // Remover marcador de selección (solo si no es de casilla visitada)
            if (marker && marker.slice === 'markerSquare' && marker.class === 'marker-square-green') {
              // Solo remover si no tiene id o si el id no es de casilla visitada
              const markerId = marker.id || '';
              if (!markerId.startsWith('visited-') && !markerId.startsWith('initial-')) {
                this.boardComponent.removeMarkers(square, marker);
              }
            }
          }
        }
      }
    });
  }

  /**
   * Limpia todos los marcadores
   */
  clearAllMarkers() {
    if (this.boardComponent) {
      this.waitForBoardReady(() => {
        this.boardComponent.removeMarkers();
      });
    }
  }


  /**
   * Inicia el contador de tiempo
   */
  startTimer() {
    this.timeInterval$.next(); // Cancelar cualquier intervalo anterior

    interval(100) // Actualizar cada 100ms para mayor precisión
      .pipe(takeUntil(this.timeInterval$))
      .subscribe(() => {
        if (this.isPlaying && !this.isCompleted) {
          this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
        }
      });
  }

  /**
   * Detiene el contador de tiempo
   */
  stopTimer() {
    this.timeInterval$.next();
  }

  /**
   * Completa el juego
   */
  completeGame() {
    this.isCompleted = true;
    this.isPlaying = false;
    this.isGameOver = false;
    this.stopTimer();
  }

  /**
   * Formatea el tiempo en formato MM:SS
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Maneja el cambio de posición inicial
   */
  onStartPositionChange(event: any) {
    if (!this.isPlaying) {
      // Si no está jugando, actualizar la configuración y mover el caballo visualmente
      this.startPosition = event.detail.value;
      
      // Limpiar selección
      this.clearValidMoveMarkers();
      this.selectedSquare = null;
      
      // Obtener la nueva posición inicial
      const newPosition = this.getStartPosition();
      this.currentPosition = newPosition;
      
      // Limpiar marcadores y casillas visitadas si había alguno
      this.clearAllMarkers();
      this.visitedSquares = [];
      
      // Actualizar posición del caballo en el tablero
      this.updateKnightPosition(newPosition);
      
      // Marcar la nueva casilla inicial
      setTimeout(() => {
        this.markInitialSquare(newPosition);
      }, 100);
    }
    // Si está jugando, no permitir cambios (el select está deshabilitado)
  }

  /**
   * Maneja el cambio de mostrar/ocultar casillas visitadas
   */
  onShowVisitedChange(event: any) {
    this.showVisited = (event.target as HTMLInputElement)?.checked ?? event.detail?.checked;
    if (this.isPlaying && this.visitedSquares.length > 0) {
      if (this.showVisited) {
        this.updateVisitedMarkers();
      } else {
        this.clearVisitedMarkers();
      }
    }
  }

  /**
   * Navega a la página de inicio
   */
  goToHome() {
    this.router.navigate(['/home']);
  }
}
