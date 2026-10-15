import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslocoPipe } from '@jsverse/transloco';

import {
  WoodpeckerCycleComparison,
  WoodpeckerCycleSummary,
} from '../../models/woodpecker.model';
import {
  formatDuration,
  roundedPercent,
  trend,
} from '../../utils/woodpecker-format.util';
import { compareCycles } from '../../utils/woodpecker-stats.util';

/** Una vuelta lista para pintar. */
interface CycleRow {
  summary: WoodpeckerCycleSummary;
  /** Tiempo de la vuelta respecto a la más lenta, de 0 a 100. */
  timeBar: number;
  comparison: WoodpeckerCycleComparison | null;
}

/**
 * La evolución vuelta a vuelta sobre el mismo set: acierto y tiempo de cada
 * vuelta terminada, y cuánto cambió respecto a la anterior. Es lo que enseña
 * si el método está funcionando. Solo pinta: recibe los resúmenes ya hechos.
 */
@Component({
  selector: 'app-woodpecker-cycles-chart',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './woodpecker-cycles-chart.component.html',
  styleUrl: './woodpecker-cycles-chart.component.scss',
})
export class WoodpeckerCyclesChartComponent {
  rows: CycleRow[] = [];

  /** Resúmenes de las vueltas terminadas, en orden. */
  @Input() set summaries(value: WoodpeckerCycleSummary[]) {
    const slowest = Math.max(1, ...value.map((summary) => summary.totalTimeMs));
    this.rows = value.map((summary, index) => ({
      summary,
      timeBar: (summary.totalTimeMs / slowest) * 100,
      comparison: index > 0 ? compareCycles(value[index - 1], summary) : null,
    }));
  }

  readonly formatDuration = formatDuration;
  readonly roundedPercent = roundedPercent;

  accuracyTrend(row: CycleRow): 'better' | 'worse' | 'same' | null {
    return row.comparison ? trend(row.comparison.accuracyDelta) : null;
  }

  timeTrend(row: CycleRow): 'better' | 'worse' | 'same' | null {
    return row.comparison?.timeDeltaPercent != null
      ? trend(row.comparison.timeDeltaPercent, true)
      : null;
  }
}
