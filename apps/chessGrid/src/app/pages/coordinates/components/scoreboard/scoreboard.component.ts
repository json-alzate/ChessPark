import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trophyOutline, timeOutline } from 'ionicons/icons';

addIcons({ trophyOutline, timeOutline });

@Component({
  selector: 'app-scoreboard',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon],
})
export class ScoreboardComponent {
  @Input() bestScores: Array<{
    score: number;
    date: number;
    timeAgo: string;
    color: 'w' | 'b';
  }> = [];

  @Input() userStats = {
    totalGames: 0,
    bestScore: 0,
    averageScore: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    accuracy: 0,
  };

  /**
   * Obtiene el mejor puntaje por color
   * @param color Color del tablero ('w' o 'b')
   * @returns Mejor puntaje para ese color
   */
  getBestScoreByColor(color: 'w' | 'b'): number {
    const colorGames = this.bestScores.filter((game) => game.color === color);
    return colorGames.length > 0
      ? Math.max(...colorGames.map((g) => g.score))
      : 0;
  }
}
