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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { BASE_MODIFIERS, RunnerModifiers } from '../../config/runner-powers';
import {
  difficultyForLevel,
  RUNNER_CANVAS_HEIGHT,
  RunnerDifficulty,
  SCATTER_COOKIES,
} from '../../config/runner.config';
import { RunnerPowerId, RunnerWorld } from '../../campaign/runner-curriculum';
import { DEFAULT_SKIN, withSkin } from '../../rendering/dog-skins';
import { RunnerPiece, RunnerState, RunnerStats } from '../../models/runner.model';
import { RunnerPiecesService } from '../../services/runner-pieces.service';
import { RunnerSpritesService } from '../../services/runner-sprites.service';
import { createRun, jump, metersOf, runnerStats, stepRun } from '../../utils/runner-engine.util';
import { isJumpKey, logicalWidth, runnerScale } from '../../utils/runner-input.util';
import { RunnerRenderer } from './runner-renderer';

/** Lo que el lienzo le cuenta a la pantalla para que suene y avise. */
export type RunnerEventName =
  | 'jump'
  | 'doubleJump'
  | 'landed'
  | 'cleared'
  | 'stumble'
  | 'shield'
  | 'cookie'
  | 'perfect'
  | 'star'
  | 'smash'
  | 'starEnd'
  | 'finishing';

export interface RunnerProgress {
  cleared: number;
  total: number;
  stumbles: number;
  /** Piezas seguidas sin tropezar. */
  combo: number;
  /** Metros corridos y galletas cogidas en esta carrera. */
  meters: number;
  cookies: number;
  /** Saltos perfectos, la mayor racha y estrellas cogidas (para las misiones). */
  perfects: number;
  bestCombo: number;
  stars: number;
}

/** Paso fijo de la simulación: los números del juego se afinaron con él, no con el de la pantalla. */
const STEP = 1 / 120;
/** Si la pestaña estuvo en segundo plano, no se simula todo lo perdido de golpe. */
const MAX_FRAME = 0.05;

/**
 * El lienzo del Chess Runner: dibuja la carrera, la mueve con un paso fijo y convierte un toque (o
 * Espacio) en un salto. Toda la lógica del juego está en `utils/runner-engine.util.ts`; aquí solo está lo que necesita
 * el navegador (lienzo, `requestAnimationFrame`, eventos).
 *
 * El bucle corre fuera de la zona de Angular para no provocar una detección de cambios por fotograma;
 * solo se vuelve a entrar en ella cuando hay algo que contar.
 */
@Component({
  selector: 'app-runner-canvas',
  standalone: true,
  imports: [TranslocoPipe],
  // Sin esto el host es `inline` y mide 0: el lienzo no sabría de qué ancho disponer
  host: { class: 'block w-full' },
  template: `<canvas
    #canvas
    class="block mx-auto select-none"
    style="touch-action: none; image-rendering: pixelated"
    data-testid="runner-canvas"
    role="img"
    [attr.aria-label]="'CHESS_RUNNER.canvasLabel' | transloco"
  ></canvas>`,
})
export class RunnerCanvasComponent implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private spritesService = inject(RunnerSpritesService);
  private piecesService = inject(RunnerPiecesService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private transloco = inject(TranslocoService);

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Las piezas de la carrera, en orden. */
  @Input({ required: true }) sequence: RunnerPiece[] = [];
  /** Lo rápida y exigente que es la carrera. */
  @Input() difficulty: RunnerDifficulty = difficultyForLevel(1);
  /** El mundo en el que se corre (el tono del escenario). */
  @Input() world: RunnerWorld = 'day';
  /** La pieza del jefe del capítulo, si esta carrera es la del jefe (`bn`, `bk`…). */
  @Input() boss: string | null = null;
  /** Galletas que lleva hacia el próximo corazón: un choque hace saltar hasta `SCATTER_COOKIES` de ellas. */
  @Input() carrying = 0;
  /** Los poderes que lleva el perrito, que se ven en su aspecto. */
  @Input() gear: readonly RunnerPowerId[] = [];
  /** El pelaje del perrito. */
  @Input() skin = DEFAULT_SKIN;
  /** Las reglas con esos poderes. */
  @Input() mods: RunnerModifiers = BASE_MODIFIERS;
  /** Ancho máximo del lienzo en px; en escritorio un tablero de 1000 px sería exagerado. */
  @Input() maxWidth = 720;
  /**
   * Zona que recoge los toques. Por defecto el propio lienzo; en el móvil conviene toda la zona
   * de juego, porque el pulgar está en la parte baja de la pantalla.
   */
  @Input() tapZone: HTMLElement | null = null;

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
  private resizeObserver?: ResizeObserver;
  private zoneElement: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);

  async ngAfterViewInit(): Promise<void> {
    let sprites;
    let pieces;
    try {
      [sprites, pieces] = await Promise.all([this.spritesService.load(), this.piecesService.load()]);
    } catch (error) {
      console.error('Chess Runner: no se cargaron los sprites ni las piezas', error);
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
    this.state = createRun(this.sequence, width, this.difficulty, this.mods);
    this.renderer = new RunnerRenderer(ctx, withSkin(sprites, this.skin), pieces.images, width);
    this.renderer.world = this.world;
    this.renderer.gear = this.gear;
    this.renderer.boss = this.boss;
    this.zone.run(() => this.progress.emit(this.currentProgress()));

    this.zoneElement = this.tapZone ?? canvas;
    const zoneElement = this.zoneElement;
    this.zone.runOutsideAngular(() => {
      zoneElement.addEventListener('pointerdown', this.pointerDown);
      window.addEventListener('keydown', this.onKeyDown);
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
    window.removeEventListener('keydown', this.onKeyDown);
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
    const metersBefore = metersOf(this.state);

    while (this.accumulator >= STEP && this.state.phase !== 'done') {
      const { state, events } = stepRun(this.state, STEP);
      this.state = state;
      this.accumulator -= STEP;

      if (events.landed) {
        collected.push('landed');
        this.renderer?.addFx('dust', state.dog.x, 0, state.time);
      }
      if (events.doubleJumped) {
        // Una chispa en el aire marca el segundo impulso
        collected.push('doubleJump');
        this.renderer?.addFx('spark', state.dog.x, state.dog.y, state.time);
      }
      if (events.cookies > 0) {
        collected.push('cookie');
        progressed = true;
      }
      if (events.cleared.length > 0) {
        collected.push('cleared');
        progressed = true;
        // Una chispa sobre cada pieza que se acaba de dejar atrás
        for (const obstacle of events.cleared) {
          this.renderer?.addFx(
            'spark',
            obstacle.x + obstacle.width / 2,
            obstacle.y + obstacle.height + 4,
            state.time
          );
        }
      }
      if (events.perfect.length > 0) {
        collected.push('perfect');
        progressed = true;
        for (const obstacle of events.perfect) {
          this.renderer?.addPopup(this.transloco.translate('CHESS_RUNNER.popup.perfect'), state.dog.x, state.dog.y + 34, state.time, '#7dffa0');
          this.renderer?.addFx('spark', obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height + 6, state.time);
        }
      }
      if (events.starTaken) {
        collected.push('star');
        progressed = true;
        this.renderer?.addPopup(this.transloco.translate('CHESS_RUNNER.popup.star'), state.dog.x, state.dog.y + 40, state.time, '#ffd24a');
        this.renderer?.addFx('spark', state.dog.x, state.dog.y + 14, state.time);
      }
      if (events.smashed.length > 0) {
        collected.push('smash');
        progressed = true;
        for (const obstacle of events.smashed) {
          const x = obstacle.x + obstacle.width / 2;
          this.renderer?.addFx('spark', x, obstacle.y + obstacle.height / 2, state.time);
          this.renderer?.burst(3, x, obstacle.y + obstacle.height, state.time);
        }
      }
      if (events.starEnded) {
        collected.push('starEnd');
      }
      if (events.shielded) {
        // El escudo se rompe con una chispa y un golpe sordo
        collected.push('shield');
        progressed = true;
        this.renderer?.addFx('spark', state.dog.x + 6, state.dog.y + 12, state.time);
      }
      if (events.stumbled) {
        collected.push('stumble');
        progressed = true;
        this.renderer?.addFx('dust', state.dog.x, 0, state.time);
        // Las galletas que llevaba salen despedidas
        this.renderer?.burst(Math.min(this.carrying, SCATTER_COOKIES), state.dog.x, state.dog.y + 18, state.time);
      }
      if (events.finishing) collected.push('finishing');
      if (events.done) finishedNow = true;
    }

    this.renderer?.draw(this.state);

    // Los metros suben a cada poco: se avisa al cambiar de metro, no en cada fotograma
    if (metersOf(this.state) !== metersBefore) {
      progressed = true;
    }
    if (collected.length > 0 || progressed || finishedNow) {
      this.zone.run(() => {
        // Primero el avance: al reaccionar a un choque la pantalla ya sabe cuántos metros llevaba
        if (progressed) {
          this.progress.emit(this.currentProgress());
        }
        collected.forEach((name) => this.runnerEvent.emit(name));
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
    return {
      cleared: this.state.cleared,
      total: this.state.total,
      stumbles: this.state.stumbles,
      combo: this.state.combo,
      meters: metersOf(this.state),
      cookies: this.state.cookies,
      perfects: this.state.perfects,
      bestCombo: this.state.bestCombo,
      stars: this.state.starsTaken,
    };
  }

  // ---------------------------------------------------------------- entrada

  /** Un toque: el perrito salta (y suena, si despegó). */
  private jump(): void {
    if (!this.state) {
      return;
    }
    const result = jump(this.state);
    this.state = result.state;
    if (result.jumped) {
      if (result.double) {
        this.renderer?.addFx('spark', this.state.dog.x, this.state.dog.y, this.state.time);
      } else {
        // Polvo al despegar
        this.renderer?.addFx('dust', this.state.dog.x, 0, this.state.time);
      }
      this.zone.run(() => this.runnerEvent.emit(result.double ? 'doubleJump' : 'jump'));
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
    this.jump();
  };

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
      return;
    }
    if (!isJumpKey(event.key)) {
      return;
    }
    // Espacio y las flechas desplazarían la página
    event.preventDefault();
    if (!event.repeat) {
      this.jump();
    }
  }
}
