import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-stats',
  templateUrl: './game-stats.component.html',
  styleUrls: ['./game-stats.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class GameStatsComponent {
  @Input() currentGameStats = {
    correctAnswers: 0,
    incorrectAnswers: 0,
    accuracy: 0,
  };

  @Input() isPlaying = false;
}
