import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

import { countUpValue } from './count-up.util';

/**
 * Número que sube rápido desde `from` hasta `to`.
 *
 * Si `to` o `from` cambian, vuelve a animar. Sin animación (`animate` en false o sin
 * navegador) muestra `to` directamente. No respeta «reducir movimiento» del sistema a
 * propósito: es un número que cuenta, no un desplazamiento, y es la celebración de la rutina.
 */
@Component({
  selector: 'app-count-up',
  standalone: true,
  template: `{{ display() }}`,
  styles: [':host { font-variant-numeric: tabular-nums; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountUpComponent {
  readonly from = input(0);
  readonly to = input.required<number>();
  /** Duración en milisegundos. */
  readonly duration = input(1400);
  readonly animate = input(true);

  protected readonly display = signal(0);
  private frame: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());

    effect(() => {
      const from = this.from();
      const to = this.to();
      const duration = this.duration();
      this.cancel();

      if (!this.animate() || from === to || !this.canAnimate()) {
        this.display.set(to);
        return;
      }

      this.display.set(from);
      const start = performance.now();
      const step = (now: number) => {
        const progress = (now - start) / duration;
        this.display.set(countUpValue(from, to, progress));
        this.frame = progress < 1 ? requestAnimationFrame(step) : null;
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  private canAnimate(): boolean {
    return typeof requestAnimationFrame === 'function';
  }

  private cancel(): void {
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frame);
    }
    this.frame = null;
  }
}
