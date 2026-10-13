import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { loadSceneManifest } from '@features/scene/services/scene-manifest';
import { createRenderer, RendererKind, SceneRenderer } from '@features/scene/services/scene-renderer';

/** Monta el renderizador elegido sobre un lienzo lógico de 960×540, escalado ×2. */
@Component({
  selector: 'ls-scene-host',
  templateUrl: './scene-host.component.html',
  styleUrl: './scene-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneHostComponent {
  readonly renderer = input<RendererKind>('css');
  readonly dayMs = input(75 * 60_000);
  readonly fps = input(30);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private active: SceneRenderer | null = null;

  constructor() {
    afterNextRender(() => void this.mount());
    inject(DestroyRef).onDestroy(() => this.active?.destroy());
  }

  private async mount(): Promise<void> {
    const renderer = await createRenderer(this.renderer());
    if (!renderer) {
      return;
    }
    this.active = renderer;
    const manifest = await loadSceneManifest();
    await renderer.mount(this.host().nativeElement, manifest, {
      dayMs: this.dayMs(),
      fps: this.fps(),
    });
  }
}
