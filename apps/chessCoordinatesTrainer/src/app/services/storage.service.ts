import { Injectable } from '@angular/core';

export interface CoordinatesPuzzle {
  uid?: string;
  uidUser: string;
  score: number;
  squaresGood: string[];
  squaresBad: string[];
  round: string[];
  date: number;
  color: 'w' | 'b';
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private readonly STORAGE_KEY = 'chess_coordinates_games';
  private readonly USER_ID_KEY = 'chess_user_id';


  /**
   * Genera un ID único para el usuario
   */
  private generateUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    return userId;
  }

  /**
   * Guarda un resultado del juego en localStorage
   */
  saveGameResult(gameResult: Omit<CoordinatesPuzzle, 'uid' | 'uidUser'>): void {
    const userId = this.generateUserId();
    const games = this.getAllGames();
    
    const newGame: CoordinatesPuzzle = {
      ...gameResult,
      uid: 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      uidUser: userId
    };

    games.push(newGame);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(games));
  }

  /**
   * Obtiene todos los juegos del usuario actual
   */
  getAllGames(): CoordinatesPuzzle[] {
    const gamesJson = localStorage.getItem(this.STORAGE_KEY);
    return gamesJson ? JSON.parse(gamesJson) : [];
  }

  /**
   * Obtiene el mejor puntaje del usuario
   */
  getBestScore(): number {
    const games = this.getAllGames();
    if (games.length === 0) return 0;
    
    return Math.max(...games.map(game => game.score));
  }

  /**
   * Obtiene estadísticas del usuario
   */
  getUserStats(): {
    totalGames: number;
    bestScore: number;
    averageScore: number;
    totalCorrect: number;
    totalIncorrect: number;
    accuracy: number;
  } {
    const games = this.getAllGames();
    
    if (games.length === 0) {
      return {
        totalGames: 0,
        bestScore: 0,
        averageScore: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        accuracy: 0
      };
    }

    const totalCorrect = games.reduce((sum, game) => sum + game.squaresGood.length, 0);
    const totalIncorrect = games.reduce((sum, game) => sum + game.squaresBad.length, 0);
    const totalAttempts = totalCorrect + totalIncorrect;
    const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

    return {
      totalGames: games.length,
      bestScore: Math.max(...games.map(game => game.score)),
      averageScore: games.reduce((sum, game) => sum + game.score, 0) / games.length,
      totalCorrect,
      totalIncorrect,
      accuracy: Math.round(accuracy * 100) / 100
    };
  }

  /**
   * Limpia todos los datos del usuario
   */
  clearUserData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_ID_KEY);
  }

  /**
   * Obtiene el ID del usuario actual
   */
  getCurrentUserId(): string {
    return this.generateUserId();
  }
}
