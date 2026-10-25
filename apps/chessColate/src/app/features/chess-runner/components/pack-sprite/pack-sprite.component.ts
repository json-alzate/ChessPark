import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

/**
 * Un cuadro de una tira horizontal de pixel art, ampliado por un número **entero** (`zoom`) y sin suavizado. Sirve para los
 * personajes de la manada, los nodos, las galletas y las animaciones de ambiente del mapa. Solo pinta: el cuadro lo decide
 * quien lo usa.
 */
@Component({
  selector: 'app-pack-sprite',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackSpriteComponent {
  /** URL de la tira. */
  @Input({ required: true }) src = '';
  @Input({ required: true }) frameW = 0;
  @Input({ required: true }) frameH = 0;
  @Input() frames = 1;
  @Input() frame = 0;
  @Input() zoom = 1;

  @HostBinding('attr.data-frame') get shownFrame(): number {
    const frames = Math.max(1, Math.floor(this.frames));
    return ((Math.floor(this.frame) % frames) + frames) % frames;
  }

  private get scale(): number {
    return Math.max(1, Math.round(this.zoom));
  }

  @HostBinding('style.display') readonly display = 'block';
  @HostBinding('style.imageRendering') readonly rendering = 'pixelated';
  @HostBinding('style.backgroundRepeat') readonly repeat = 'no-repeat';
  @HostBinding('style.width.px') get width(): number {
    return this.frameW * this.scale;
  }
  @HostBinding('style.height.px') get height(): number {
    return this.frameH * this.scale;
  }
  @HostBinding('style.backgroundImage') get image(): string {
    return this.src ? `url("${this.src}")` : 'none';
  }
  @HostBinding('style.backgroundSize') get size(): string {
    return `${this.frameW * Math.max(1, this.frames) * this.scale}px ${this.frameH * this.scale}px`;
  }
  @HostBinding('style.backgroundPosition') get position(): string {
    return `${-this.shownFrame * this.frameW * this.scale}px 0px`;
  }
}
