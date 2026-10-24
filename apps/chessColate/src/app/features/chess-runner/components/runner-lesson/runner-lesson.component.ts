import {
  AfterViewInit,
  ChangeDetectorRef,
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
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { handLeftOutline } from 'ionicons/icons';

import { INTRO_SECONDS, LessonFrame, lessonFrame, parseBoard } from '../../lessons/runner-lesson.util';
import { RunnerLesson } from '../../lessons/runner-lessons.data';
import { RunnerPiecesService } from '../../services/runner-pieces.service';

/** Casillas claras y oscuras del tablero pequeño: las mismas tonalidades que el suelo de la carrera. */
const LIGHT = '#ecd9b0';
const DARK = '#b58863';
const FOCUS = '255, 210, 74';
const TARGET = '255, 80, 80';
/** Lo que dura el destello rojo de una jugada equivocada. */
const WRONG_FLASH_MS = 450;
/** Cuánto se queda el aviso de «esa no» antes de volver a la pista. */
const WRONG_NOTICE_MS = 1700;
/** Tamaño máximo del tablero en pantalla (px de CSS). */
const MAX_BOARD = 320;

/**
 * La lección de un patrón: un tablero pequeño donde se hace la jugada del ejemplo, con frases cortas que dicen qué mirar,
 * qué se juega, por qué funciona y cómo reconocerlo (`CHESS_RUNNER.lessons.<patrón>`). La imagen de cada instante la calcula
 * `lessonFrame` (pura); aquí solo se dibuja con las piezas del set que el usuario eligió y se muestra la frase que toca.
 * Termina sola (`finished`) y se queda en su última imagen; si no hay piezas que dibujar avisa con `failed` para que la
 * pantalla siga sin ella.
 */
@Component({
  selector: 'app-runner-lesson',
  standalone: true,
  imports: [IonIcon, TranslocoPipe],
  host: { class: 'block w-full' },
  template: `
    <canvas
      #canvas
      class="mx-auto block rounded-lg shadow-lg"
      style="touch-action: manipulation"
      data-testid="lesson-canvas"
      role="img"
      [attr.aria-label]="'CHESS_RUNNER.lessonLabel' | transloco"
    ></canvas>
    <div class="mx-auto mt-4 flex min-h-[8.5rem] max-w-sm flex-col items-center gap-2 text-center" aria-live="polite">
      <p class="text-base font-extrabold leading-snug text-primary" data-testid="lesson-idea">{{ idea }}</p>
      <p class="text-base font-semibold leading-snug" [class.text-success]="phase === 'tip' && !trying" [class.text-warning]="trying"
        data-testid="lesson-caption">{{ caption }}</p>
      @if (showTry) {
      <!-- Aprender haciendo: tras verla, el usuario repite la jugada en el tablero -->
      <button type="button" class="btn btn-outline btn-sm" (click)="startTry()" data-testid="lesson-try">
        <ion-icon name="hand-left-outline"></ion-icon>
        {{ 'CHESS_RUNNER.lessonTry' | transloco }}
      </button>
      }
    </div>
  `,
})
export class RunnerLessonComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private piecesService = inject(RunnerPiecesService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private transloco = inject(TranslocoService);
  private changes = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ handLeftOutline });
  }

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) lesson!: RunnerLesson;
  /** La idea del patrón, en una frase: no cambia durante la lección. */
  get idea(): string {
    return this.text('idea');
  }
  /** La frase que toca ahora y en qué tramo de la lección se está. */
  caption = '';
  phase: LessonFrame['phase'] = 'see';
  private captionKey = '';
  /** El usuario está repitiendo la jugada: el tablero espera en la posición inicial. */
  trying = false;
  /** Ya se puede probar: la lección acabó de contarse y todavía no se ha repetido la jugada. */
  showTry = false;
  private tried = false;
  private selected: string | null = null;
  private wrongAt = 0;
  private noticeTimeout: ReturnType<typeof setTimeout> | null = null;
  /** La animación llegó al final. */
  @Output() finished = new EventEmitter<void>();
  /** No se pudieron cargar las piezas: la pantalla sigue sin la lección. */
  @Output() failed = new EventEmitter<void>();

  private frameRequest = 0;
  private startedAt = 0;
  private destroyed = false;
  private done = false;

  async ngAfterViewInit(): Promise<void> {
    let images: ReadonlyMap<string, CanvasImageSource>;
    try {
      images = (await this.piecesService.load()).images;
    } catch (error) {
      console.error('Chess Runner: no se cargaron las piezas de la lección', error);
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

    const cell = Math.max(24, Math.floor(Math.min(this.host.nativeElement.clientWidth || 320, MAX_BOARD) / 8));
    const size = cell * 8;
    const density = Math.max(1, Math.round(window.devicePixelRatio || 1));
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = size * density;
    canvas.height = size * density;
    ctx.setTransform(density, 0, 0, density, 0, 0);

    this.zone.runOutsideAngular(() => {
      canvas.addEventListener('pointerdown', this.onBoardPointer);
      this.startedAt = performance.now();
      const tick = (now: number) => {
        if (this.destroyed) {
          return;
        }
        // Probando, el tablero espera en la posición inicial (con lo importante señalado)
        const t = this.trying ? 0 : (now - this.startedAt) / 1000;
        const frame = lessonFrame(this.lesson, t);
        this.draw(ctx, images, cell, frame, now);
        if (!this.trying) {
          this.explain(frame);
        }
        if (frame.done && !this.done) {
          this.done = true;
          this.zone.run(() => {
            this.showTry = !this.tried;
            this.changes.markForCheck();
            this.finished.emit();
          });
        }
        // Sigue pintando tras el final: los brillos siguen latiendo mientras se espera
        this.frameRequest = requestAnimationFrame(tick);
      };
      this.frameRequest = requestAnimationFrame(tick);
    });
  }

  /** La frase de un tramo de la lección; las jugadas de después de la primera pueden traer la suya (`play2`, `play3`). */
  private text(key: string): string {
    const full = `CHESS_RUNNER.lessons.${this.lesson.theme}.${key}`;
    const found = this.transloco.translate(full);
    return found === full ? '' : found;
  }

  /** Cambia la frase solo cuando cambia el tramo: el dibujo va fuera de Angular y esto lo avisa una vez por tramo. */
  private explain(frame: LessonFrame): void {
    const key =
      frame.phase === 'play' || frame.phase === 'then' ? (frame.step > 0 ? `play${frame.step + 1}` : 'play') : frame.phase;
    const id = `${frame.phase}:${key}`;
    if (id === this.captionKey) {
      return;
    }
    this.captionKey = id;
    const fallback = frame.phase === 'play' || frame.phase === 'then' ? frame.phase : key;
    const caption = this.text(key) || this.text(fallback);
    this.zone.run(() => {
      this.phase = frame.phase;
      this.caption = caption;
      this.changes.markForCheck();
    });
  }

  /** «Pruébalo»: el tablero vuelve a la posición inicial y espera que el usuario haga la primera jugada. */
  startTry(): void {
    this.trying = true;
    this.showTry = false;
    this.selected = null;
    this.setNotice('CHESS_RUNNER.lessonTryHint');
  }

  /** Un toque en el tablero: elige una pieza blanca y, con otro, su casilla de destino. */
  private readonly onBoardPointer = (event: PointerEvent): void => {
    if (!this.trying) {
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) {
      return;
    }
    const square = `${String.fromCharCode(97 + col)}${8 - row}`;
    this.zone.run(() => this.touch(square));
  };

  private touch(square: string): void {
    if (this.selected === null) {
      // Solo se mueven las blancas: son las del ejemplo
      this.selected = parseBoard(this.lesson.fen).get(square)?.startsWith('w') ? square : null;
      return;
    }
    if (square === this.selected) {
      this.selected = null;
      return;
    }
    const attempt = `${this.selected}${square}`;
    this.selected = null;
    if (attempt === this.lesson.moves[0].slice(0, 4)) {
      // Acertó: la lección sigue desde esa jugada, con su explicación
      this.trying = false;
      this.tried = true;
      this.captionKey = '';
      this.startedAt = performance.now() - INTRO_SECONDS * 1000;
      this.clearNotice();
    } else {
      this.wrongAt = performance.now();
      this.setNotice('CHESS_RUNNER.lessonTryWrong');
      this.noticeTimeout = setTimeout(() => {
        this.noticeTimeout = null;
        if (this.trying) {
          this.setNotice('CHESS_RUNNER.lessonTryHint');
        }
      }, WRONG_NOTICE_MS);
    }
    this.changes.markForCheck();
  }

  private setNotice(key: string): void {
    this.clearNotice();
    this.caption = this.transloco.translate(key);
    this.phase = 'see';
    this.changes.markForCheck();
  }

  private clearNotice(): void {
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
      this.noticeTimeout = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameRequest);
    this.clearNotice();
    this.canvasRef.nativeElement.removeEventListener('pointerdown', this.onBoardPointer);
  }

  private draw(
    ctx: CanvasRenderingContext2D,
    images: ReadonlyMap<string, CanvasImageSource>,
    cell: number,
    frame: ReturnType<typeof lessonFrame>,
    now = 0
  ): void {
    const size = cell * 8;
    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? LIGHT : DARK;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    if (this.trying && this.selected) {
      const { x, y } = this.cellOf(this.selected);
      ctx.fillStyle = 'rgba(80, 200, 120, 0.45)';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }

    for (const ring of frame.rings) {
      const { x, y } = this.cellOf(ring.square);
      const color = ring.kind === 'focus' ? FOCUS : TARGET;
      ctx.fillStyle = `rgba(${color}, ${(0.18 + 0.3 * ring.strength).toFixed(2)})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.strokeStyle = `rgba(${color}, ${(0.5 + 0.5 * ring.strength).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, cell / 12);
      ctx.beginPath();
      ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * (0.4 + 0.06 * ring.strength), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const piece of frame.pieces) {
      const image = images.get(piece.key);
      if (image) {
        ctx.globalAlpha = piece.alpha;
        ctx.drawImage(image, piece.x * cell, piece.y * cell, cell, cell);
      }
    }
    ctx.globalAlpha = 1;

    for (const arrow of frame.arrows) {
      this.drawArrow(ctx, cell, arrow.from, arrow.to, arrow.progress);
    }

    // Una jugada equivocada enrojece el tablero un instante
    if (this.wrongAt > 0 && now - this.wrongAt < WRONG_FLASH_MS) {
      ctx.fillStyle = `rgba(255, 60, 60, ${(0.3 * (1 - (now - this.wrongAt) / WRONG_FLASH_MS)).toFixed(2)})`;
      ctx.fillRect(0, 0, size, size);
    }
  }

  private cellOf(square: string): { x: number; y: number } {
    return { x: square.charCodeAt(0) - 97, y: 8 - Number(square[1]) };
  }

  /** Una flecha de centro a centro de casilla, dibujada hasta `progress` de su largo. */
  private drawArrow(ctx: CanvasRenderingContext2D, cell: number, from: string, to: string, progress: number): void {
    const a = this.cellOf(from);
    const b = this.cellOf(to);
    const x0 = (a.x + 0.5) * cell;
    const y0 = (a.y + 0.5) * cell;
    const x1 = (b.x + 0.5) * cell;
    const y1 = (b.y + 0.5) * cell;
    const x = x0 + (x1 - x0) * progress;
    const y = y0 + (y1 - y0) * progress;
    const angle = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = `rgba(${TARGET}, 0.9)`;
    ctx.fillStyle = `rgba(${TARGET}, 0.9)`;
    ctx.lineWidth = Math.max(3, cell / 9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (progress > 0.15) {
      const head = cell * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - head * Math.cos(angle - 0.45), y - head * Math.sin(angle - 0.45));
      ctx.lineTo(x - head * Math.cos(angle + 0.45), y - head * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  }
}
