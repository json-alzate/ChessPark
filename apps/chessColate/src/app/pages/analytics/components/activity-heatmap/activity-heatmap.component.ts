import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { ActivityDay } from '@chesspark/game-reporter';

import {
  activityLevel,
  ActivityWeek,
  toActivityWeeks,
} from '@services/game-analytics.util';

/**
 * Calendario de actividad al estilo del de GitHub: una columna por semana y
 * un cuadro por día, más oscuro cuanto menos se jugó.
 *
 * Se dibuja con CSS y no con Chart.js: son cuadraditos de color, y meter una
 * librería de gráficas para pintar rectángulos sería pagar por nada.
 */
@Component({
  selector: 'app-activity-heatmap',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './activity-heatmap.component.html',
  styleUrls: ['./activity-heatmap.component.scss'],
})
export class ActivityHeatmapComponent implements OnChanges {
  @Input() days: ActivityDay[] = [];

  weeks: ActivityWeek[] = [];
  /** El día más movido; marca la escala de color del resto. */
  maxGames = 0;

  ngOnChanges(): void {
    this.weeks = toActivityWeeks(this.days);
    this.maxGames = this.days.reduce(
      (max, day) => Math.max(max, day.games),
      0
    );
  }

  level(day: ActivityDay | null): number {
    return day ? activityLevel(day.games, this.maxGames) : 0;
  }

  /** Texto del tooltip: '2026-03-14 · 7 partidas'. */
  title(day: ActivityDay | null): string {
    return day ? `${day.date} · ${day.games}` : '';
  }
}
