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

import {
  GESTURE_DECISION_MS,
  GESTURE_MAX_WAIT_MS,
  GESTURE_SLOP_PX,
  OBSTACLE_SHAPES,
  RUNNER_CANVAS_HEIGHT,
} from '../../config/runner.config';
import {
  RunnerAction,
  RunnerPiece,
  RunnerState,
  RunnerStats,
} from '../../models/runner.model';
import { RunnerSpritesService } from '../../services/runner-sprites.service';
import { createRun, perform, runnerStats, stepRun } from '../../utils/runner-engine.util';
import { classifySwipe, keyCommand, logicalWidth, runnerScale } from '../../utils/runner-input.util';
import { RunnerRenderer } from './runner-renderer';

/** Lo que el lienzo le cuenta a la pantalla para que suene y avise. */
export type RunnerEventName =
  | 'jump'
  | 'doubleJump'
  | 'landed'
  | 'cleared'
  | 'stumble'
  | 'finishing';

export interface RunnerProgress {
  cleared: number;
  total: number;
  stumbles: number;
}

/** Paso fijo de la simulación: los números del juego se afinaron con él, no con el de la pantalla. */
const STEP = 1 / 120;
/** Si la pestaña estuvo en segundo plano, no se simula todo lo perdido de golpe. */
const MAX_FRAME = 0.05;

/**
 * El lienzo del Chess Runner: dibuja la carrera, la mueve con un paso fijo y traduce gestos y teclas en
 * órdenes. Toda la lógica del juego está en `utils/runner-engine.util.ts`; aquí solo está lo que necesita
 * el navegador (lienzo, `requestAnimationFrame`, eventos).
 *
 * El bucle corre fuera de la zona de Angular para no provocar una detección de cambios por fotograma;
 * solo se vuelve a entrar en ella cuando hay algo que contar.
 */
@Component({
  selector: 'app-runner-canvas',
  standalone: true,
  // Sin esto el host es `inline` y mide 0: el lienzo no sabría de qué ancho disponer
  host: { class: 'block w-full' },
  template: `<canvas
    #canvas
    class="block mx-auto select-none"
    style="touch-action: none; image-rendering: pixelated"
    data-testid="runner-canvas"
    role="img"
    [attr.aria-label]="'CHESS_RUNNER.canvasLabel'"
  ></canvas>`,
})
export class RunnerCanvasComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private spritesService = inject(RunnerSpritesService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Las piezas de la carrera, en orden. */
  @Input({ required: true }) sequence: RunnerPiece[] = [];
  /** Enseñar la flecha de lo que hay que hacer sobre cada obstáculo. */
  @Input() hints = true;
  /** Ancho máximo del lienzo en px; en escritorio un tablero de 1000 px sería exagerado. */
  @Input() maxWidth = 720;
  /**
   * Zona que recoge los toques y gestos. Por defecto el propio lienzo; en el móvil conviene toda la zona
   * de juego, porque el pulgar está en la parte baja de la pantalla.
   */
  @Input() gestureZone: HTMLElement | null = null;

  @Output() runnerEvent = new EventEmitter<RunnerEventName>();
  @Output() progress = new EventEmitter<RunnerProgress>();
  @Output() finished = new EventEmitter<RunnerStats>();
  /** Los assets no se pudieron cargar: la pantalla pasa directo al ejercicio. */
  @Output() failed = new EventEmitter<void>();

  private state!: RunnerState;
  private renderer: RunnerRenderer | null = null;
  private frameRequest = 0;
  private lastTime = 0;
  private accumulator = 0;
  private destroyed = false;
  private holding = false;
  private resizeObserver?: ResizeObserver;
  private zoneElement: HTMLElement | null = null;

  /** El gesto en curso: aún no se sabe si es un toque o un deslizamiento. */
  private gesture: {
    x: number;
    y: number;
    /** Dónde está el dedo ahora, para saber si sigue quieto. */
    lastX: number;
    lastY: number;
    startedAt: number;
    decided: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);

  async ngAfterViewInit(): Promise<void> {
    let sprites;
    try {
      sprites = await this.spritesService.load();
    } catch (error) {
      console.error('Chess Runner: no se cargaron los sprites', error);
      this.zone.run(() => this.failed.emit());
      return;
    }
    if (this.destroyed) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.zone.run(() => this.failed.emit());
      return;
    }

    const width = this.layout();
    this.state = createRun(this.sequence, width);
    this.renderer = new RunnerRenderer(ctx, sprites, width);
    this.zone.run(() => this.progress.emit(this.currentProgress()));

    this.zoneElement = this.gestureZone ?? canvas;
    const zoneElement = this.zoneElement;
    this.zone.runOutsideAngular(() => {
      zoneElement.addEventListener('pointerdown', this.pointerDown);
      zoneElement.addEventListener('pointermove', this.pointerMove);
      zoneElement.addEventListener('pointerup', this.pointerUp);
      zoneElement.addEventListener('pointercancel', this.pointerUp);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.host.nativeElement);
      }
      this.lastTime = performance.now();
      this.frameRequest = requestAnimationFrame((now) => this.frame(now));
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameRequest);
    this.resizeObserver?.disconnect();
    const zoneElement = this.zoneElement;
    zoneElement?.removeEventListener('pointerdown', this.pointerDown);
    zoneElement?.removeEventListener('pointermove', this.pointerMove);
    zoneElement?.removeEventListener('pointerup', this.pointerUp);
    zoneElement?.removeEventListener('pointercancel', this.pointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.clearGesture();
  }

  // ------------------------------------------------------------------ tamaño

  /** Fija el tamaño del lienzo (escala entera) y devuelve el ancho lógico. */
  private layout(): number {
    const canvas = this.canvasRef.nativeElement;
    const available = Math.min(this.host.nativeElement.clientWidth || 360, this.maxWidth);
    const scale = runnerScale(available);
    const width = logicalWidth(available);
    // Para que el píxel siga siendo cuadrado y nítido en pantallas de alta densidad
    const density = Math.max(1, Math.round(window.devicePixelRatio || 1));

    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${RUNNER_CANVAS_HEIGHT * scale}px`;
    canvas.width = width * scale * density;
    canvas.height = RUNNER_CANVAS_HEIGHT * scale * density;
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(scale * density, 0, 0, scale * density, 0, 0);
    return width;
  }

  private onResize(): void {
    if (!this.renderer || !this.state) {
      return;
    }
    const width = this.layout();
    if (width !== this.state.width) {
      this.state = { ...this.state, width };
      this.renderer.resize(width);
    }
  }

  // ------------------------------------------------------------------- bucle

  private frame(now: number): void {
    if (this.destroyed) {
      return;
    }
    this.accumulator += Math.min((now - this.lastTime) / 1000, MAX_FRAME);
    this.lastTime = now;

    const collected: RunnerEventName[] = [];
    let progressed = false;
    let finishedNow = false;

    while (this.accumulator >= STEP && this.state.phase !== 'done') {
      const { state, events } = stepRun(this.state, STEP, this.holding);
      this.state = state;
      this.accumulator -= STEP;

      if (events.landed) {
        collected.push('landed');
        this.renderer?.addFx('dust', state.dog.x, 0, state.time);
      }
      if (events.cleared.length > 0) {
        collected.push('cleared');
        progressed = true;
        // Una chispa sobre cada pieza que se acaba de dejar atrás
        for (const obstacle of events.cleared) {
          const shape = OBSTACLE_SHAPES[obstacle.kind];
          this.renderer?.addFx('spark', obstacle.x + shape.width / 2, shape.bottom + shape.height + 4, state.time);
        }
      }
      if (events.stumbled) {
        collected.push('stumble');
        progressed = true;
        this.renderer?.addFx('dust', state.dog.x, 0, state.time);
      }
      if (events.finishing) collected.push('finishing');
      if (events.done) finishedNow = true;
    }

    this.renderer?.draw(this.state, { hints: this.hints });

    if (collected.length > 0 || progressed || finishedNow) {
      this.zone.run(() => {
        collected.forEach((name) => this.runnerEvent.emit(name));
        if (progressed) {
          this.progress.emit(this.currentProgress());
        }
        if (finishedNow) {
          this.finished.emit(runnerStats(this.state));
        }
      });
    }

    if (this.state.phase !== 'done') {
      this.frameRequest = requestAnimationFrame((time) => this.frame(time));
    }
  }

  private currentProgress(): RunnerProgress {
    return { cleared: this.state.cleared, total: this.state.total, stumbles: this.state.stumbles };
  }

  // ---------------------------------------------------------------- entrada

  /** Ejecuta una orden y avisa del salto, si lo hubo. */
  private act(action: RunnerAction): void {
    if (!this.state) {
      return;
    }
    const result = perform(this.state, action);
    this.state = result.state;
    if (result.jumped || result.doubleJumped) {
      // Polvo al despegar; el doble salto lo suelta en el aire
      this.renderer?.addFx('dust', this.state.dog.x, result.doubleJumped ? this.state.dog.y : 0, this.state.time);
      const name: RunnerEventName = result.doubleJumped ? 'doubleJump' : 'jump';
      this.zone.run(() => this.runnerEvent.emit(name));
    }
  }

  private readonly pointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    // Los botones de la pantalla (saltar la carrera, salir) siguen siendo botones
    if ((event.target as HTMLElement | null)?.closest('button, a, [role="button"]')) {
      return;
    }
    event.preventDefault();
    this.capturePointer('set', event.pointerId);
    this.clearGesture();
    // Hasta que pasa un instante no se sabe si es un toque o el principio de un deslizamiento
    const timer = setTimeout(() => this.settleGesture(), GESTURE_DECISION_MS);
    this.gesture = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
      decided: false,
      timer,
    };
  };

  /**
   * Vence el instante de decisión. Con el dedo quieto es un toque (y mantenerlo hace flotar); con el
   * dedo ya en marcha se espera un poco más a ver si llega a ser un deslizamiento, sin pasarse del tope.
   */
  private settleGesture(): void {
    const gesture = this.gesture;
    if (!gesture || gesture.decided) {
      return;
    }
    const moved = Math.hypot(gesture.lastX - gesture.x, gesture.lastY - gesture.y);
    if (moved >= GESTURE_SLOP_PX && performance.now() - gesture.startedAt < GESTURE_MAX_WAIT_MS) {
      gesture.timer = setTimeout(() => this.settleGesture(), 20);
      return;
    }
    this.decide('tap-hold');
  }

  private readonly pointerMove = (event: PointerEvent) => {
    if (!this.gesture || this.gesture.decided) {
      return;
    }
    this.gesture.lastX = event.clientX;
    this.gesture.lastY = event.clientY;
    const swipe = classifySwipe(event.clientX - this.gesture.x, event.clientY - this.gesture.y);
    if (swipe) {
      this.decide(swipe);
    }
  };

  /**
   * Captura o suelta el puntero. El navegador lanza `NotFoundError` si ese puntero ya no está activo (un toque
   * cancelado justo al empezar): el gesto sigue adelante sin captura en vez de perderse con la excepción.
   */
  private capturePointer(action: 'set' | 'release', pointerId: number): void {
    const element = this.zoneElement ?? this.canvasRef.nativeElement;
    try {
      if (action === 'set') {
        element.setPointerCapture?.(pointerId);
      } else {
        element.releasePointerCapture?.(pointerId);
      }
    } catch {
      /* el puntero ya no está activo */
    }
  }

  private readonly pointerUp = (event: PointerEvent) => {
    this.capturePointer('release', event.pointerId);
    // Un toque que se suelta antes de decidir: salto corto, sin mantener
    if (this.gesture && !this.gesture.decided) {
      this.decide('tap');
    }
    this.holding = false;
    this.clearGesture();
  };

  private decide(kind: 'tap' | 'tap-hold' | RunnerAction): void {
    if (!this.gesture || this.gesture.decided) {
      return;
    }
    this.gesture.decided = true;
    clearTimeout(this.gesture.timer);
    if (kind === 'tap' || kind === 'tap-hold') {
      this.act('jump');
      // Mantener pulsado más allá del instante de decisión es lo que hace flotar a Chocolate
      this.holding = kind === 'tap-hold';
    } else {
      this.act(kind);
    }
  }

  private clearGesture(): void {
    if (this.gesture) {
      clearTimeout(this.gesture.timer);
      this.gesture = null;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
      return;
    }
    const command = keyCommand(event.key);
    if (!command) {
      return;
    }
    // Espacio y las flechas desplazarían la página
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.act(command.action);
    if (command.holds) {
      this.holding = true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (keyCommand(event.key)?.holds) {
      this.holding = false;
    }
  }
}
