import { Injectable } from '@angular/core';

export interface ChessPosition {
  row: number;
  col: number;
}

export interface RandomFENOptions {
  maxPieces?: number;
  includePawns?: boolean;
  includeQueens?: boolean;
  includeRooks?: boolean;
  includeBishops?: boolean;
  includeKnights?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RandomFENService {

  private readonly defaultOptions: RandomFENOptions = {
    maxPieces: 32,
    includePawns: true,
    includeQueens: true,
    includeRooks: true,
    includeBishops: true,
    includeKnights: true
  };

  // Límites reales de piezas por color en ajedrez
  private readonly pieceLimits = {
    'P': 8,  // Máximo 8 peones blancos
    'p': 8,  // Máximo 8 peones negros
    'R': 2,  // Máximo 2 torres blancas
    'r': 2,  // Máximo 2 torres negras
    'N': 2,  // Máximo 2 caballos blancos
    'n': 2,  // Máximo 2 caballos negros
    'B': 2,  // Máximo 2 alfiles blancos
    'b': 2,  // Máximo 2 alfiles negros
    'Q': 1,  // Máximo 1 dama blanca
    'q': 1   // Máximo 1 dama negra
  };

  /**
   * Genera una posición FEN aleatoria de ajedrez
   * @param options Opciones de configuración para la generación
   * @returns String en formato FEN
   */
  generateRandomFEN(options?: Partial<RandomFENOptions>): string {
    const config = { ...this.defaultOptions, ...options };
    
    // Inicializar tablero vacío
    const board: string[][] = [];
    for (let x = 0; x < 8; x++) {
      board.push('. . . . . . . .'.split(' '));
    }

    // Colocar reyes
    const { whiteKing, blackKing } = this.placeKings(board);
    board[whiteKing.row][whiteKing.col] = 'K';
    board[blackKing.row][blackKing.col] = 'k';

    // Generar y colocar piezas
    const pieces = this.generatePieces(config);
    this.placePieces(board, pieces, config);

    // Convertir a formato FEN
    return this.boardToFEN(board);
  }

  /**
   * Genera múltiples posiciones FEN aleatorias
   * @param count Número de posiciones a generar
   * @param options Opciones de configuración
   * @returns Array de strings FEN
   */
  generateMultipleFENs(count: number, options?: Partial<RandomFENOptions>): string[] {
    const positions: string[] = [];
    for (let i = 0; i < count; i++) {
      positions.push(this.generateRandomFEN(options));
    }
    return positions;
  }

  /**
   * Genera una posición FEN más realista con al menos algunas piezas básicas
   * @param options Opciones de configuración para la generación
   * @returns String en formato FEN
   */
  generateRealisticFEN(options?: Partial<RandomFENOptions>): string {
    const config = { ...this.defaultOptions, ...options };
    
    // Inicializar tablero vacío
    const board: string[][] = [];
    for (let x = 0; x < 8; x++) {
      board.push('. . . . . . . .'.split(' '));
    }

    // Colocar reyes
    const { whiteKing, blackKing } = this.placeKings(board);
    board[whiteKing.row][whiteKing.col] = 'K';
    board[blackKing.row][blackKing.col] = 'k';

    // Generar piezas con distribución más realista
    const pieces = this.generateRealisticPieces(config);
    this.placePieces(board, pieces, config);

    // Convertir a formato FEN
    return this.boardToFEN(board);
  }

  /**
   * Genera múltiples posiciones FEN realistas
   * @param count Número de posiciones a generar
   * @param options Opciones de configuración
   * @returns Array de strings FEN
   */
  generateMultipleRealisticFENs(count: number, options?: Partial<RandomFENOptions>): string[] {
    const positions: string[] = [];
    for (let i = 0; i < count; i++) {
      positions.push(this.generateRealisticFEN(options));
    }
    return positions;
  }

  /**
   * Genera una posición FEN de final de partida (pocas piezas)
   * @param options Opciones de configuración para la generación
   * @returns String en formato FEN
   */
  generateEndgameFEN(options?: Partial<RandomFENOptions>): string {
    const endgameOptions: RandomFENOptions = {
      maxPieces: 8, // Máximo 8 piezas para finales
      includePawns: true,
      includeQueens: false, // Sin damas en finales típicos
      includeRooks: true,
      includeBishops: true,
      includeKnights: true,
      ...options
    };
    
    return this.generateRealisticFEN(endgameOptions);
  }

  /**
   * Genera una posición FEN de medio juego (piezas medias)
   * @param options Opciones de configuración para la generación
   * @returns String en formato FEN
   */
  generateMiddlegameFEN(options?: Partial<RandomFENOptions>): string {
    const middlegameOptions: RandomFENOptions = {
      maxPieces: 20, // Máximo 20 piezas para medio juego
      includePawns: true,
      includeQueens: true,
      includeRooks: true,
      includeBishops: true,
      includeKnights: true,
      ...options
    };
    
    return this.generateRealisticFEN(middlegameOptions);
  }

  /**
   * Valida si una posición FEN es legal
   * @param fen String FEN a validar
   * @returns true si es legal, false en caso contrario
   */
  isValidFEN(fen: string): boolean {
    try {
      const parts = fen.split(' ');
      if (parts.length < 6) return false;
      
      const boardPart = parts[0];
      const rows = boardPart.split('/');
      if (rows.length !== 8) return false;
      
      // Validar que cada fila suma 8
      for (const row of rows) {
        let count = 0;
        for (const char of row) {
          if (char >= '1' && char <= '8') {
            count += parseInt(char);
          } else if (char.match(/[KQRBNPkqrbnp]/)) {
            count++;
          } else {
            return false;
          }
        }
        if (count !== 8) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Analiza una posición FEN y retorna estadísticas de las piezas
   * @param fen String FEN a analizar
   * @returns Objeto con el conteo de cada tipo de pieza
   */
  analyzeFEN(fen: string): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    
    try {
      const boardPart = fen.split(' ')[0];
      const rows = boardPart.split('/');
      
      for (const row of rows) {
        for (const char of row) {
          if (char.match(/[KQRBNPkqrbnp]/)) {
            stats[char] = (stats[char] || 0) + 1;
          }
        }
      }
    } catch (error) {
      console.error('Error analizando FEN:', error);
    }
    
    return stats;
  }

  /**
   * Verifica si una posición FEN es realista según las reglas del ajedrez
   * @param fen String FEN a verificar
   * @returns true si es realista, false en caso contrario
   */
  isRealisticFEN(fen: string): boolean {
    const stats = this.analyzeFEN(fen);
    
    // Verificar límites de piezas
    for (const [piece, count] of Object.entries(stats)) {
      const limit = this.pieceLimits[piece as keyof typeof this.pieceLimits];
      if (limit && count > limit) {
        return false;
      }
    }
    
    return true;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    let randomIndex: number;

    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [shuffled[currentIndex], shuffled[randomIndex]] = [
        shuffled[randomIndex], shuffled[currentIndex]
      ];
    }

    return shuffled;
  }

  private getRandomPosition(): ChessPosition {
    return {
      row: Math.floor(Math.random() * 8),
      col: Math.floor(Math.random() * 8)
    };
  }

  private isOccupied(board: string[][], pos: ChessPosition): boolean {
    return board[pos.row][pos.col] !== '.';
  }

  private isAdjacent(pos1: ChessPosition, pos2: ChessPosition): boolean {
    const rowDiff = Math.abs(pos1.row - pos2.row);
    const colDiff = Math.abs(pos1.col - pos2.col);
    return rowDiff <= 1 && colDiff <= 1;
  }

  private placeKings(board: string[][]): { whiteKing: ChessPosition; blackKing: ChessPosition } {
    let whiteKing: ChessPosition;
    let blackKing: ChessPosition;
    
    do {
      whiteKing = this.getRandomPosition();
      blackKing = this.getRandomPosition();
    } while (this.isAdjacent(whiteKing, blackKing));
    
    return { whiteKing, blackKing };
  }

  private generatePieces(options: RandomFENOptions): string[] {
    const pieces: string[] = [];
    const pieceTypes: { [key: string]: boolean } = {
      'P': options.includePawns ?? true,
      'R': options.includeRooks ?? true,
      'N': options.includeKnights ?? true,
      'B': options.includeBishops ?? true,
      'Q': options.includeQueens ?? true
    };

    // Generar piezas blancas respetando límites reales
    for (const [piece, enabled] of Object.entries(pieceTypes)) {
      if (enabled) {
        const maxCount = this.pieceLimits[piece as keyof typeof this.pieceLimits];
        const count = Math.floor(Math.random() * (maxCount + 1)); // 0 a maxCount
        for (let i = 0; i < count; i++) {
          pieces.push(piece);
        }
      }
    }

    // Generar piezas negras respetando límites reales
    for (const [piece, enabled] of Object.entries(pieceTypes)) {
      if (enabled) {
        const blackPiece = piece.toLowerCase();
        const maxCount = this.pieceLimits[blackPiece as keyof typeof this.pieceLimits];
        const count = Math.floor(Math.random() * (maxCount + 1)); // 0 a maxCount
        for (let i = 0; i < count; i++) {
          pieces.push(blackPiece);
        }
      }
    }

    // Limitar el número total de piezas si es necesario
    if (pieces.length > options.maxPieces!) {
      pieces.splice(options.maxPieces!);
    }

    return this.shuffle(pieces);
  }

  private generateRealisticPieces(options: RandomFENOptions): string[] {
    const pieces: string[] = [];
    const pieceTypes: { [key: string]: boolean } = {
      'P': options.includePawns ?? true,
      'R': options.includeRooks ?? true,
      'N': options.includeKnights ?? true,
      'B': options.includeBishops ?? true,
      'Q': options.includeQueens ?? true
    };

    // Generar piezas blancas respetando límites reales
    for (const [piece, enabled] of Object.entries(pieceTypes)) {
      if (enabled) {
        const maxCount = this.pieceLimits[piece as keyof typeof this.pieceLimits];
        const count = Math.floor(Math.random() * (maxCount + 1)); // 0 a maxCount
        for (let i = 0; i < count; i++) {
          pieces.push(piece);
        }
      }
    }

    // Generar piezas negras respetando límites reales
    for (const [piece, enabled] of Object.entries(pieceTypes)) {
      if (enabled) {
        const blackPiece = piece.toLowerCase();
        const maxCount = this.pieceLimits[blackPiece as keyof typeof this.pieceLimits];
        const count = Math.floor(Math.random() * (maxCount + 1)); // 0 a maxCount
        for (let i = 0; i < count; i++) {
          pieces.push(blackPiece);
        }
      }
    }

    // Limitar el número total de piezas si es necesario
    if (pieces.length > options.maxPieces!) {
      pieces.splice(options.maxPieces!);
    }

    return this.shuffle(pieces);
  }

  private placePieces(board: string[][], pieces: string[], options: RandomFENOptions): void {
    for (const piece of pieces) {
      let pos: ChessPosition;
      
      do {
        pos = this.getRandomPosition();
      } while (this.isOccupied(board, pos) || this.isInvalidPawnPosition(piece, pos));
      
      board[pos.row][pos.col] = piece;
    }
  }

  private isInvalidPawnPosition(piece: string, pos: ChessPosition): boolean {
    // Los peones no pueden estar en la primera o última fila
    if (piece === 'p' || piece === 'P') {
      return pos.row === 0 || pos.row === 7;
    }
    return false;
  }

  private boardToFEN(board: string[][]): string {
    const fen: string[] = [];
    
    for (let row = 0; row < board.length; row++) {
      let str = '';
      let emptyCount = 0;
      
      for (let col = 0; col < board[row].length; col++) {
        if (board[row][col] === '.') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            str += emptyCount;
            emptyCount = 0;
          }
          str += board[row][col];
        }
      }
      
      if (emptyCount > 0) {
        str += emptyCount;
      }
      
      fen.push(str);
    }
    
    return fen.join('/') + ' w - - 0 1';
  }
}
