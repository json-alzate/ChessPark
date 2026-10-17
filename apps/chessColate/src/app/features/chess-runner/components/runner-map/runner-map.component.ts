import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { star } from 'ionicons/icons';

import { PatternStat } from '../../campaign/runner-campaign.model';
import { CHAPTERS, RunnerPowerId } from '../../campaign/runner-curriculum';
import { powerIconUrl } from '../../rendering/power-icons';
import { guardianOf } from '../../story/story-scenes';

/** Cómo está un guardián en el camino: ya vencido, el que toca ahora o todavía por delante. */
export type RunnerMapState = 'beaten' | 'current' | 'locked';

export interface RunnerMapNode {
  index: number;
  state: RunnerMapState;
  /** La pieza que guarda ese mundo (`bp`, `bn`…). */
  key: string;
  /** Estrellas del mejor intento (0 si todavía no se ha vencido). */
  stars: number;
  /** Es el último: el Rey de las Sombras. */
  boss: boolean;
  /** El nombre del patrón de ese capítulo (vacío si no se pasaron). */
  name: string;
  /** El poder que da al vencerlo, si da alguno. */
  power: RunnerPowerId | null;
  /** Qué porcentaje de los ejercicios de ese patrón se han acertado (0 a 100); `null` si todavía no se ha jugado ninguno. */
  accuracy: number | null;
}

/** Cuántas casillas por fila tiene el camino. */
const PER_ROW = 5;

/**
 * El camino del perrito: una escalera de guardianes, uno por patrón, hasta el Rey de las Sombras. Se ve de un vistazo
 * hasta dónde ha llegado (los vencidos con sus estrellas, el actual resaltado y los que faltan en sombra), qué patrón guarda
 * cada uno, qué poder da y cuáles lleva ya. Las piezas son las del set del usuario.
 */
@Component({
  selector: 'app-runner-map',
  standalone: true,
  imports: [IonIcon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <div class="flex w-full flex-col gap-3" data-testid="map" role="img"
      [attr.aria-label]="'CHESS_RUNNER.map.label' | transloco: { done: beaten, total: nodes.length }">
      @for (row of rows; track $index) {
      <div class="flex items-start justify-between gap-1">
        @for (node of row; track node.index) {
        <div class="flex w-[18%] flex-col items-center gap-0.5" [attr.data-state]="node.state" data-testid="map-node">
          <div
            class="relative flex h-11 w-11 items-center justify-center rounded-full border-2 bg-base-200 transition-colors"
            [class.border-success]="node.state === 'beaten'"
            [class.border-primary]="node.state === 'current'"
            [class.border-base-content/20]="node.state === 'locked'"
            [class.map-current]="node.state === 'current'"
            [class.map-boss]="node.boss"
          >
            @if (urls.get(node.key); as url) {
            <img [src]="url" alt="" class="h-8 w-8" [class.map-silhouette]="node.state === 'locked'" />
            }
            @if (node.state === 'current') {
            <span class="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary ring-2 ring-base-100" data-testid="map-here"></span>
            }
            @if (node.power; as power) {
            <img [src]="iconOf(power)" alt="" class="absolute -right-2 -top-2 h-4 w-auto rounded bg-base-100 [image-rendering:pixelated]"
              [class.opacity-40]="node.state !== 'beaten'" data-testid="map-power" />
            }
          </div>
          <span class="line-clamp-2 min-h-[1.6em] w-full text-center text-[9px] font-bold leading-tight"
            [class.text-base-content/40]="node.state === 'locked'" data-testid="map-name">{{ node.name }}</span>
          <span class="block h-1 w-9 overflow-hidden rounded-full bg-base-content/15" aria-hidden="true">
            @if (node.accuracy !== null) {
            <span class="block h-full rounded-full" [style.width.%]="node.accuracy" [class.bg-success]="node.accuracy >= 70"
              [class.bg-warning]="node.accuracy >= 40 && node.accuracy < 70" [class.bg-error]="node.accuracy < 40" data-testid="map-accuracy"></span>
            }
          </span>
          <div class="flex h-3 items-center gap-px" aria-hidden="true">
            @for (star of [1, 2, 3]; track star) {
            @if (node.state === 'beaten') {
            <ion-icon name="star" class="h-2.5 w-2.5" [class.text-warning]="star <= node.stars" [class.text-base-content/20]="star > node.stars"></ion-icon>
            }
            }
          </div>
        </div>
        }
      </div>
      }
    </div>
    @if (powers.length > 0) {
    <div class="mt-3 flex flex-wrap items-center justify-center gap-2" data-testid="map-powers">
      @for (power of powers; track power) {
      <img [src]="iconOf(power)" alt="" class="h-6 w-auto [image-rendering:pixelated]" />
      }
    </div>
    }
  `,
  styles: [
    `
      .map-silhouette {
        filter: brightness(0) invert(0.55);
        opacity: 0.5;
      }
      .map-current {
        box-shadow: 0 0 0 4px rgba(255, 150, 0, 0.25);
      }
      .map-boss {
        background: rgba(60, 20, 90, 0.45);
      }
    `,
  ],
})
export class RunnerMapComponent {
  constructor() {
    addIcons({ star });
  }

  /** Capítulo en que va (los anteriores están vencidos). */
  @Input() chapter = 0;
  /** Estrellas de cada capítulo vencido. */
  @Input() stars: readonly number[] = [];
  @Input() powers: readonly RunnerPowerId[] = [];
  /** Las piezas del set del usuario como imágenes, por clave (`bp`, `bk`…). */
  @Input() urls: ReadonlyMap<string, string> = new Map();
  /** Lo acertado y fallado de cada patrón (por tema): da la barrita bajo cada guardián. */
  @Input() mastery: Readonly<Record<string, PatternStat>> = {};
  /** Los nombres de los patrones, en el orden de los capítulos. */
  @Input() names: readonly string[] = [];

  /** Los guardianes en orden, con el rey de las sombras al final. */
  get nodes(): RunnerMapNode[] {
    const total = CHAPTERS.length;
    return Array.from({ length: total }, (_, index) => ({
      index,
      state: index < this.chapter ? 'beaten' : index === this.chapter ? 'current' : 'locked',
      key: guardianOf(index),
      stars: this.stars[index] ?? 0,
      boss: index === total - 1,
      name: this.names[index] ?? '',
      power: CHAPTERS[index].power,
      accuracy: this.accuracyOf(CHAPTERS[index].theme),
    }));
  }

  private accuracyOf(theme: string): number | null {
    const stat = this.mastery[theme];
    const played = stat ? stat.solved + stat.failed : 0;
    return played > 0 ? Math.round((stat.solved / played) * 100) : null;
  }

  /** Cuántos guardianes lleva vencidos. */
  get beaten(): number {
    return Math.min(this.chapter, CHAPTERS.length);
  }

  get rows(): RunnerMapNode[][] {
    const nodes = this.nodes;
    const rows: RunnerMapNode[][] = [];
    for (let i = 0; i < nodes.length; i += PER_ROW) {
      rows.push(nodes.slice(i, i + PER_ROW));
    }
    return rows;
  }

  iconOf(power: RunnerPowerId): string {
    return powerIconUrl(power, 4);
  }
}
