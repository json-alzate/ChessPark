import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { playOutline } from 'ionicons/icons';

import { RunnerPowerId } from '../../campaign/runner-curriculum';
import { powerIconUrl } from '../../rendering/power-icons';
import { RunnerMapComponent } from '../runner-map/runner-map.component';

/** Una tarjeta entre escenas: el camino que hay que recorrer, o el poder recién ganado. */
export type RunnerCard = { kind: 'journey' } | { kind: 'power'; power: RunnerPowerId };

/**
 * La tarjeta que se enseña entre escenas: tras el prólogo, **el camino hasta el frasco** (los guardianes y sus patrones), y al
 * ganar un poder nuevo, **su icono, su nombre y lo que hace**. Un botón la cierra (`next`).
 */
@Component({
  selector: 'app-runner-card',
  standalone: true,
  imports: [IonIcon, TranslocoPipe, RunnerMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
<div class="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-8 text-center" data-testid="card">
  @if (card.kind === 'power') {
  <!-- Un poder nuevo: qué es y qué cambia -->
  <div class="power-card-icon flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/15 shadow-lg" data-testid="power-icon">
    <img [src]="powerIcon(card.power)" alt="" class="h-20 w-auto [image-rendering:pixelated]" />
  </div>
  <span class="badge badge-warning badge-lg font-bold">{{ 'CHESS_RUNNER.powers.new' | transloco }}</span>
  <h2 class="text-2xl font-extrabold" data-testid="power-name">{{ 'CHESS_RUNNER.powers.' + card.power + '.name' | transloco }}</h2>
  <p class="text-base font-semibold text-base-content/80" data-testid="power-desc">{{ 'CHESS_RUNNER.powers.' + card.power + '.desc' | transloco }}</p>
  } @else {
  <!-- El camino hasta el frasco -->
  <h2 class="text-2xl font-extrabold" data-testid="journey-title">{{ 'CHESS_RUNNER.journey.title' | transloco }}</h2>
  <p class="text-sm font-semibold text-base-content/70">{{ 'CHESS_RUNNER.journey.body' | transloco: { count: chapterCount } }}</p>
  <app-runner-map class="w-full" [chapter]="0" [stars]="[]" [powers]="[]" [urls]="urls" [names]="names"></app-runner-map>
  }
  <button class="btn btn-primary btn-lg w-full max-w-xs font-extrabold" (click)="next.emit()" data-testid="card-continue">
    <ion-icon name="play-outline" class="h-6 w-6"></ion-icon>
    <span>{{ 'CHESS_RUNNER.continue' | transloco }}</span>
  </button>
</div>
  `,
})
export class RunnerCardComponent {
  constructor() {
    addIcons({ playOutline });
  }

  @Input({ required: true }) card!: RunnerCard;
  /** Las piezas del set del usuario como imágenes, por clave (`bp`, `bk`…). */
  @Input() urls: ReadonlyMap<string, string> = new Map();
  /** Los nombres de los patrones, en el orden de los capítulos. */
  @Input() names: readonly string[] = [];
  @Input() chapterCount = 0;

  @Output() next = new EventEmitter<void>();

  /** El icono de un poder, ampliado. */
  powerIcon(power: RunnerPowerId): string {
    return powerIconUrl(power, 8);
  }
}
