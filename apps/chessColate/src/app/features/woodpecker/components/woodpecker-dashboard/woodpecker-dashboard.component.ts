import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  eye,
  playOutline,
  refreshOutline,
  trashOutline,
  trophy,
} from 'ionicons/icons';

import {
  WoodpeckerCycleSummary,
  WoodpeckerProblemPuzzle,
  WoodpeckerSet,
  WoodpeckerState,
} from '../../models/woodpecker.model';
import {
  currentCycle,
  nextCycleNumber,
  puzzleTimesFor,
} from '../../utils/woodpecker-cycle.util';
import { finishedSummaries, summarizeCycle } from '../../utils/woodpecker-stats.util';
import { WoodpeckerCyclesChartComponent } from '../woodpecker-cycles-chart/woodpecker-cycles-chart.component';

/** Un ejercicio problemático listo para pintar. */
export interface WoodpeckerProblemItem extends WoodpeckerProblemPuzzle {
  /** Temas ya traducidos, para reconocerlo en la lista. */
  themes: string;
  rating: number;
}

/**
 * Panel del set: qué set es, por dónde va, el botón para seguir y la
 * evolución vuelta a vuelta. No guarda nada ni habla con servicios: la página
 * le pasa el estado y escucha lo que el usuario quiere hacer.
 */
@Component({
  selector: 'app-woodpecker-dashboard',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonIcon, WoodpeckerCyclesChartComponent],
  templateUrl: './woodpecker-dashboard.component.html',
  styleUrl: './woodpecker-dashboard.component.scss',
})
export class WoodpeckerDashboardComponent {
  summaries: WoodpeckerCycleSummary[] = [];
  activeSummary: WoodpeckerCycleSummary | null = null;
  /** Número de la vuelta que toca jugar (la que está a medias o la siguiente). `null` si no quedan. */
  nextCycle: number | null = null;
  completed = false;
  /** Segundos por ejercicio de esa vuelta; `null` sin reloj. */
  nextCycleSeconds: number | null = null;

  private _state!: WoodpeckerState;

  @Input({ required: true }) set state(value: WoodpeckerState) {
    this._state = value;
    const { set, progress } = value;
    const active = currentCycle(progress);

    this.summaries = finishedSummaries(progress.cycles);
    this.activeSummary = active ? summarizeCycle(active) : null;
    this.completed = progress.completedAt !== undefined;
    this.nextCycle = active ? active.cycle : nextCycleNumber(progress, set.config);
    this.nextCycleSeconds =
      this.nextCycle !== null ? puzzleTimesFor(set.config, this.nextCycle)?.total ?? null : null;
  }

  get state(): WoodpeckerState {
    return this._state;
  }

  /** Nombres de los temas del set, ya traducidos. */
  @Input() themeNames: string[] = [];
  /** Ejercicios que se fallan en varias vueltas, con sus datos para reconocerlos. */
  @Input() problemItems: WoodpeckerProblemItem[] = [];
  /** Aviso de que salieron menos ejercicios de los pedidos; vacío si no aplica. */
  @Input() shortNotice: { requested: number; actual: number } | null = null;

  @Output() play = new EventEmitter<void>();
  @Output() discard = new EventEmitter<void>();
  @Output() newSet = new EventEmitter<void>();
  @Output() viewProblem = new EventEmitter<string>();

  /** Cuántos temas se enseñan antes del «+N». */
  readonly maxThemeBadges = 6;

  constructor() {
    addIcons({ eye, playOutline, refreshOutline, trashOutline, trophy });
  }

  get set(): WoodpeckerSet {
    return this._state.set;
  }

  get isResuming(): boolean {
    return !!this.activeSummary && this.activeSummary.answered > 0;
  }

  get visibleThemes(): string[] {
    return this.themeNames.slice(0, this.maxThemeBadges);
  }

  get hiddenThemes(): number {
    return Math.max(0, this.themeNames.length - this.maxThemeBadges);
  }

  get activeProgress(): number {
    const active = this.activeSummary;
    return active && active.total > 0 ? (active.answered / active.total) * 100 : 0;
  }
}
