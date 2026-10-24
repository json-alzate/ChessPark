import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkCircle, refreshOutline, trophyOutline } from 'ionicons/icons';

import { RunnerCampaign } from '../../campaign/runner-campaign.model';
import { RunnerPowerId } from '../../campaign/runner-curriculum';
import { powerIconUrl } from '../../rendering/power-icons';
import { RunnerMapComponent } from '../runner-map/runner-map.component';

/** Por qué se acabó la partida y cómo quedó. */
export interface RunnerGameOver {
  /** Cómo se llegó aquí: perdiendo (`hits`, `strikes`), saliendo a mitad (`quit`) o al volver a entrar (`lobby`). */
  reason: 'hits' | 'strikes' | 'quit' | 'lobby';
  meters: number;
  record: number;
  newRecord: boolean;
  /** Capítulo (1 a 20) y ronda (1…) en que se quedó. */
  chapter: number;
  round: number;
  /** El ELO del perrito al terminar y lo que ganó (o perdió) en la partida. */
  rating: number;
  ratingGain: number;
  solved: number;
  cookies: number;
}

/** Un pelaje del armario y cómo está: puesto, desbloqueado, comprable o por ganar. */
export interface RunnerWardrobeItem {
  id: string;
  price: number;
  swatch: string;
  state: 'worn' | 'owned' | 'affordable' | 'locked';
}

/**
 * El final de una partida: la distancia y el récord, cómo va la campaña (capítulo, ELO, resueltos, galletas), el botón para
 * jugar otra vez, el camino de los guardianes, los poderes del perrito con lo que hace cada uno y el armario de pelajes. Solo
 * enseña: lo que se compra o se pone lo decide la pantalla (`buy`, `wear`).
 */
@Component({
  selector: 'app-runner-game-over',
  standalone: true,
  imports: [IonIcon, TranslocoPipe, RunnerMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
<div class="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-10 text-center" data-testid="game-over">
  <h2 class="text-2xl font-extrabold" data-testid="game-over-title">{{ (over.reason === 'lobby' ? 'CHESS_RUNNER.title' : 'CHESS_RUNNER.gameOver.title') | transloco }}</h2>
  <p class="text-sm text-base-content/70" data-testid="game-over-reason">{{ 'CHESS_RUNNER.gameOver.' + over.reason | transloco }}</p>

  <div class="flex flex-col items-center gap-1">
    @if (over.reason !== 'lobby') {
    <span class="text-5xl font-extrabold text-primary" data-testid="game-over-meters">{{ 'CHESS_RUNNER.meters' | transloco: { count: over.meters } }}</span>
    }
    @if (over.newRecord) {
    <span class="badge badge-warning gap-1 font-bold" data-testid="new-record">
      <ion-icon name="trophy-outline"></ion-icon>
      {{ 'CHESS_RUNNER.gameOver.newRecord' | transloco }}
    </span>
    } @else {
    <span class="flex items-center gap-1 text-sm font-bold text-base-content/70" data-testid="game-over-record">
      <ion-icon name="trophy-outline"></ion-icon>
      {{ 'CHESS_RUNNER.gameOver.record' | transloco: { count: over.record } }}
    </span>
    }
  </div>

  <dl class="grid w-full grid-cols-2 gap-2 text-center">
    <div class="rounded-xl bg-base-200 p-3">
      <dt class="text-[11px] font-bold uppercase tracking-wide text-base-content/60">{{ 'CHESS_RUNNER.gameOver.level' | transloco }}</dt>
      <dd class="text-xl font-extrabold">
        <span data-testid="game-over-level">{{ over.chapter }}</span><span class="text-sm font-bold text-base-content/60">/{{ chapterCount }}</span>
        @if (over.round > 1) {
        <span class="ml-1 badge badge-warning badge-sm font-bold" data-testid="game-over-round">{{ 'CHESS_RUNNER.round' | transloco: { count: over.round } }}</span>
        }
      </dd>
    </div>
    <div class="rounded-xl bg-base-200 p-3">
      <dt class="text-[11px] font-bold uppercase tracking-wide text-base-content/60">{{ 'CHESS_RUNNER.rating' | transloco }}</dt>
      <dd class="text-xl font-extrabold">
        <span data-testid="game-over-rating">{{ over.rating }}</span>
        @if (over.ratingGain !== 0) {
        <span class="text-sm font-bold" [class.text-success]="over.ratingGain > 0" [class.text-error]="over.ratingGain < 0" data-testid="game-over-rating-gain">{{ over.ratingGain > 0 ? '+' : '' }}{{ over.ratingGain }}</span>
        }
      </dd>
    </div>
    <div class="rounded-xl bg-base-200 p-3">
      <dt class="text-[11px] font-bold uppercase tracking-wide text-base-content/60">{{ 'CHESS_RUNNER.gameOver.solved' | transloco }}</dt>
      <dd class="text-xl font-extrabold" data-testid="game-over-solved">{{ over.solved }}</dd>
    </div>
    <div class="rounded-xl bg-base-200 p-3">
      <dt class="text-[11px] font-bold uppercase tracking-wide text-base-content/60">{{ 'CHESS_RUNNER.gameOver.cookies' | transloco }}</dt>
      <dd class="text-xl font-extrabold" data-testid="game-over-cookies">{{ over.cookies }}</dd>
    </div>
  </dl>

  <div class="flex w-full flex-col gap-2">
    <button class="btn btn-primary font-bold" (click)="again.emit()" data-testid="play-again">
      <ion-icon name="refresh-outline"></ion-icon>
      <span>{{ (over.reason === 'lobby' ? 'CHESS_RUNNER.gameOver.play' : 'CHESS_RUNNER.gameOver.again') | transloco }}</span>
    </button>
    <button class="btn btn-ghost" (click)="exit.emit()" data-testid="game-over-exit">{{ 'CHESS_RUNNER.error.back' | transloco }}</button>
  </div>

  <!-- El camino hasta el Rey de las Sombras: dónde está el perrito y lo que lleva puesto -->
  <app-runner-map class="w-full" [chapter]="campaign.chapter" [stars]="campaign.stars" [powers]="campaign.powers"
    [urls]="urls" [names]="names" [mastery]="campaign.mastery"></app-runner-map>
  <!-- Lo que ha ganado el perrito y para qué sirve -->
  @if (campaign.powers.length > 0) {
  <ul class="flex w-full flex-col gap-2 text-left" data-testid="powers-list">
    @for (power of campaign.powers; track power) {
    <li class="flex items-center gap-3 rounded-xl bg-base-200 p-2" data-testid="power-item">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <img [src]="powerIcon(power)" alt="" class="h-7 w-auto [image-rendering:pixelated]" />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-extrabold">{{ 'CHESS_RUNNER.powers.' + power + '.name' | transloco }}</span>
        <span class="block text-xs leading-snug text-base-content/70">{{ 'CHESS_RUNNER.powers.' + power + '.desc' | transloco }}</span>
      </span>
    </li>
    }
  </ul>
  }
  <!-- El armario: los pelajes del perrito, que se compran con las galletas guardadas -->
  <section class="flex w-full flex-col gap-2 text-left" data-testid="wardrobe">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-extrabold uppercase tracking-wide text-base-content/70">{{ 'CHESS_RUNNER.wardrobe.title' | transloco }}</h3>
      <span class="flex items-center gap-1 text-sm font-extrabold" data-testid="wallet"><span class="cookie-icon" aria-hidden="true"></span>{{ wallet }}</span>
    </div>
    <div class="grid grid-cols-3 gap-2">
      @for (item of wardrobe; track item.id) {
      <button type="button" class="relative flex flex-col items-center gap-1 rounded-xl border-2 bg-base-200 p-2 text-center transition"
        [class.border-primary]="item.state === 'worn'" [class.border-transparent]="item.state !== 'worn'"
        [class.opacity-60]="item.state === 'locked'" [disabled]="item.state === 'locked' || item.state === 'worn'"
        (click)="item.state === 'affordable' ? buy.emit(item.id) : wear.emit(item.id)" [attr.data-state]="item.state" data-testid="skin">
        <span class="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg" [style.background]="item.swatch + '33'">
          @if (previews.get(item.id); as preview) {
          <img [src]="preview" alt="" class="h-12 w-auto [image-rendering:pixelated]" />
          }
        </span>
        <span class="text-xs font-bold leading-tight">{{ 'CHESS_RUNNER.wardrobe.skins.' + item.id | transloco }}</span>
        <span class="flex min-h-4 items-center gap-1 text-[11px] font-extrabold" data-testid="skin-price">
          @if (item.state === 'worn') {
          <ion-icon name="checkmark-circle" class="text-primary"></ion-icon>
          } @else if (item.state === 'owned') {
          {{ 'CHESS_RUNNER.wardrobe.wear' | transloco }}
          } @else {
          <span class="cookie-icon" aria-hidden="true"></span>{{ item.price }}
          }
        </span>
      </button>
      }
    </div>
  </section>
  <!-- Dónde se sigue al volver a jugar: el patrón en que se quedó (o el repaso pendiente) -->
  <span class="badge badge-primary badge-lg font-bold" data-testid="game-over-next">{{ nextPattern }}</span>

</div>
  `,
})
export class RunnerGameOverComponent {
  constructor() {
    addIcons({ checkmarkCircle, refreshOutline, trophyOutline });
  }

  @Input({ required: true }) over!: RunnerGameOver;
  @Input({ required: true }) campaign!: RunnerCampaign;
  /** Las piezas del set del usuario como imágenes, por clave (`bp`, `bk`…). */
  @Input() urls: ReadonlyMap<string, string> = new Map();
  /** Los nombres de los patrones, en el orden de los capítulos. */
  @Input() names: readonly string[] = [];
  @Input() chapterCount = 0;
  @Input() wardrobe: readonly RunnerWardrobeItem[] = [];
  /** Las imágenes del perrito con cada pelaje (hasta que cargan, ninguna). */
  @Input() previews: ReadonlyMap<string, string> = new Map();
  /** Las galletas guardadas. */
  @Input() wallet = 0;
  /** El patrón en que se sigue al volver a jugar. */
  @Input() nextPattern = '';

  @Output() again = new EventEmitter<void>();
  @Output() exit = new EventEmitter<void>();
  @Output() buy = new EventEmitter<string>();
  @Output() wear = new EventEmitter<string>();

  powerIcon(power: RunnerPowerId): string {
    return powerIconUrl(power, 4);
  }
}
