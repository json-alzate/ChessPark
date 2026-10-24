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

/**
 * Resultado de una vuelta recién terminada: acierto y tiempo, y cuánto cambió
 * respecto a la vuelta anterior. Solo pinta.
 */
@Component({
  selector: 'app-woodpecker-cycle-result',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './woodpecker-cycle-result.component.html',
  styleUrl: './woodpecker-cycle-result.component.scss',
})
export class WoodpeckerCycleResultComponent {
  @Input({ required: true }) current!: WoodpeckerCycleSummary;
  /** `null` en la primera vuelta: no hay con qué comparar. */
  @Input() comparison: WoodpeckerCycleComparison | null = null;

  readonly formatDuration = formatDuration;
  readonly roundedPercent = roundedPercent;

  get accuracyTrend(): 'better' | 'worse' | 'same' | null {
    return this.comparison ? trend(this.comparison.accuracyDelta) : null;
  }

  get timeTrend(): 'better' | 'worse' | 'same' | null {
    return this.comparison?.timeDeltaPercent != null
      ? trend(this.comparison.timeDeltaPercent, true)
      : null;
  }
}
