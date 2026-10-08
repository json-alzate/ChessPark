import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trendingDown, trendingUp } from 'ionicons/icons';

import { CountUpComponent } from '../count-up/count-up.component';

addIcons({ trendingUp, trendingDown });

/**
 * Cuánto cambió el ELO: un ícono de gráfico que sube (o baja) y la cantidad, sin signo.
 * Si subió, el número cuenta rápido desde 0 hasta el valor. Con 0 solo muestra el 0, atenuado.
 *
 * Toma el tamaño del texto del padre (el ícono mide `1em`).
 */
@Component({
  selector: 'app-elo-delta',
  standalone: true,
  imports: [IonIcon, CountUpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center gap-1 font-bold',
    '[class.text-success]': 'delta() > 0',
    '[class.text-error]': 'delta() < 0',
    '[class.opacity-60]': 'delta() === 0',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @if (delta() > 0) {
      <ion-icon name="trending-up" aria-hidden="true"></ion-icon>
    } @else if (delta() < 0) {
      <ion-icon name="trending-down" aria-hidden="true"></ion-icon>
    }
    <app-count-up [to]="magnitude()" [animate]="animate() && delta() > 0" [duration]="duration()" />
  `,
})
export class EloDeltaComponent {
  /** Puntos de ELO que subió (positivo) o bajó (negativo). */
  readonly delta = input.required<number>();
  readonly animate = input(true);
  readonly duration = input(1400);

  protected readonly magnitude = computed(() => Math.abs(this.delta()));
  /** Texto para lector de pantalla: sin el signo visual no se sabría si subió o bajó. */
  protected readonly label = computed(() => (this.delta() > 0 ? `+${this.delta()}` : `${this.delta()}`));
}
