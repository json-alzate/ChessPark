import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { RUNNER_CANVAS_HEIGHT } from '../../config/runner.config';
import { drawStage } from '../../rendering/stage';
import { DEFAULT_SKIN, withSkin } from '../../rendering/dog-skins';
import { RunnerPiecesService } from '../../services/runner-pieces.service';
import { RunnerSpritesService } from '../../services/runner-sprites.service';
import { StoryScene } from '../../story/story-scenes';
import { logicalWidth, runnerScale } from '../../utils/runner-input.util';

/** Ancho máximo del lienzo en px (el mismo que el de la carrera). */
const MAX_WIDTH = 720;

/**
 * Una escena de la historia: reproduce la animación de `scene` en un lienzo del mismo tamaño que el de la carrera,
 * con el perrito, el escenario y las piezas del set del usuario. No tiene texto. Avisa al terminar (`finished`) y, si
 * no se pueden cargar los dibujos, con `failed` para que la pantalla siga sin escena.
 */
@Component({
  selector: 'app-runner-story',
  standalone: true,
  imports: [TranslocoPipe],
  host: { class: 'block w-full' },
  template: `<canvas
    #canvas
    class="mx-auto block"
    style="image-rendering: pixelated"
    data-testid="story-canvas"
    role="img"
    [attr.aria-label]="'CHESS_RUNNER.story.' + scene.id | transloco"
  ></canvas>`,
})
export class RunnerStoryComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private spritesService = inject(RunnerSpritesService);
  private piecesService = inject(RunnerPiecesService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) scene!: StoryScene;
  /** El pelaje del perrito. */
  @Input() skin = DEFAULT_SKIN;
  @Output() finished = new EventEmitter<void>();
  @Output() failed = new EventEmitter<void>();

  private frameRequest = 0;
  private startedAt = 0;
  private destroyed = false;
  private done = false;

  async ngAfterViewInit(): Promise<void> {
    let sprites;
    let pieces;
    try {
      [sprites, pieces] = await Promise.all([this.spritesService.load(), this.piecesService.load()]);
    } catch (error) {
      console.error('Chess Runner: no se cargaron los dibujos de la escena', error);
      this.zone.run(() => this.failed.emit());
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (this.destroyed) {
      return;
    }
    if (!ctx) {
      this.zone.run(() => this.failed.emit());
      return;
    }

    const available = Math.min(this.host.nativeElement.clientWidth || 360, MAX_WIDTH);
    const scale = runnerScale(available);
    const width = logicalWidth(available);
    const density = Math.max(1, Math.round(window.devicePixelRatio || 1));
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${RUNNER_CANVAS_HEIGHT * scale}px`;
    canvas.width = width * scale * density;
    canvas.height = RUNNER_CANVAS_HEIGHT * scale * density;
    ctx.setTransform(scale * density, 0, 0, scale * density, 0, 0);
    const assets = { sprites: withSkin(sprites, this.skin), pieces: pieces.images };

    this.zone.runOutsideAngular(() => {
      this.startedAt = performance.now();
      const tick = (now: number) => {
        if (this.destroyed) {
          return;
        }
        const t = (now - this.startedAt) / 1000;
        drawStage(ctx, assets, width, t, this.scene.frame(Math.min(t, this.scene.duration), width));
        if (t >= this.scene.duration) {
          if (!this.done) {
            this.done = true;
            this.zone.run(() => this.finished.emit());
          }
          // La imagen final se queda: no hace falta seguir pintando
          return;
        }
        this.frameRequest = requestAnimationFrame(tick);
      };
      this.frameRequest = requestAnimationFrame(tick);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameRequest);
  }
}
