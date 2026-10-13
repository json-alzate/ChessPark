import { computed, inject, Injectable, signal } from '@angular/core';
import { PUZZLE_SOURCE } from './puzzle-source';
import { DEFAULT_LADDER, eloAt } from '@features/stream/utils/elo-ladder.util';
import { NoPuzzlesError, PuzzleQueue, QueuedPuzzle } from './puzzle-queue';
import { STREAM_CLOCK } from './stream-clock';
import { DEFAULT_PROGRAM, ProgramBlock } from '@features/stream/config/stream-program.config';
import { blockAt, msUntilNextBlock } from '@features/stream/utils/stream-schedule.util';
import { STREAM_TIMINGS } from '@features/stream/config/stream-timings.config';

export type StreamPhase = 'cargando' | 'presentacion' | 'rival' | 'cuenta' | 'solucion' | 'cierre';

/** El puzzle en pantalla y el bloque del programa del que salió. */
export interface OnAirPuzzle extends QueuedPuzzle {
  block: ProgramBlock;
}

/** Cuánto antes del cambio de tema se empieza a descargar el siguiente bloque. */
const PREFETCH_WINDOW_MS = 120_000;

/** Espera máxima entre reintentos cuando el proveedor falla (red caída, tema sin puzzles). */
const MAX_BACKOFF_MS = 30_000;

/**
 * Lleva el ciclo del directo: elige el puzzle del bloque que toca y lo recorre por fases
 * (presentación → jugada del rival → cuenta atrás → solución → cierre).
 *
 * No toca el tablero: publica en señales qué fase es y en qué posición va, y la pantalla lo
 * dibuja. Así el director se prueba sin navegador y sin esperar.
 */
@Injectable({ providedIn: 'root' })
export class StreamDirectorService {
  private readonly clock = inject(STREAM_CLOCK);
  private readonly timings = inject(STREAM_TIMINGS);
  private readonly queue = new PuzzleQueue(inject(PUZZLE_SOURCE));
  private readonly program = DEFAULT_PROGRAM;
  private readonly ladder = { ...DEFAULT_LADDER, periodMs: this.timings.ladderMs };

  readonly phase = signal<StreamPhase>('cargando');
  readonly onAir = signal<OnAirPuzzle | null>(null);
  /** Posición del tablero dentro de `frames.fens`. */
  readonly frameIndex = signal(0);
  readonly countdownS = signal(this.timings.countdownS);
  readonly countdownTotalS = this.timings.countdownS;
  /** Puzzles que ya se mostraron enteros. */
  readonly shown = signal(0);

  private readonly nowMs = signal(this.clock.now());
  /** Segundos que faltan para que cambie el tema. */
  readonly nextTopicS = computed(() => Math.ceil(msUntilNextBlock(this.nowMs(), this.timings.blockMs) / 1000));

  private running = false;
  private ticker?: ReturnType<typeof setInterval>;

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.ticker = setInterval(() => this.nowMs.set(this.clock.now()), 1000);
    void this.loop();
  }

  stop(): void {
    this.running = false;
    clearInterval(this.ticker);
  }

  private async loop(): Promise<void> {
    let failures = 0;
    while (this.running) {
      try {
        // Si un bloque no da puzzles, pasa al siguiente en vez de quedarse atascado 20 minutos.
        const skip = failures >= 2 ? failures - 1 : 0;
        const scheduled = blockAt(this.clock.now() + skip * this.timings.blockMs, this.program, this.timings.blockMs);
        this.prefetchNextBlock(scheduled.index, scheduled.endsAtMs);
        const onAir = await this.pickPuzzle(scheduled.index, this.ladderEloAt(this.clock.now()));
        failures = 0;
        await this.play(onAir);
      } catch (error) {
        failures++;
        console.warn('[directo] no se pudo preparar un puzzle:', error);
        await this.clock.sleep(Math.min(2000 * 2 ** (failures - 1), MAX_BACKOFF_MS));
      }
    }
  }

  /** ELO objetivo en un instante, con el desfase de pruebas (0 en producción). */
  private ladderEloAt(nowMs: number): number {
    return eloAt(nowMs + this.timings.ladderOffsetMs, this.ladder);
  }

  /**
   * Puzzle para el tema que toca. Si ese tema no tiene nada utilizable a este ELO (hay temas con
   * muy pocos puzzles en los extremos de la escalera), se prueba con los siguientes del
   * programa: el ELO no se detiene y el panel muestra el tema que de verdad se ve.
   */
  private async pickPuzzle(index: number, elo: number): Promise<OnAirPuzzle> {
    for (let offset = 0; offset < this.program.length; offset++) {
      const block = this.program[(index + offset) % this.program.length];
      try {
        return { ...(await this.queue.next(block, elo)), block };
      } catch (error) {
        if (!(error instanceof NoPuzzlesError)) {
          throw error;
        }
      }
    }
    throw new Error(`Ningún tema del programa tiene puzzles cerca de ELO ${elo}`);
  }

  /** Cuando falta poco para el cambio de tema, descarga el siguiente al ELO que tendrá entonces. */
  private prefetchNextBlock(currentIndex: number, nextStartsAtMs: number): void {
    if (msUntilNextBlock(this.clock.now(), this.timings.blockMs) <= PREFETCH_WINDOW_MS) {
      this.queue.prefetch(this.program[(currentIndex + 1) % this.program.length], this.ladderEloAt(nextStartsAtMs));
    }
  }

  private async play(onAir: OnAirPuzzle): Promise<void> {
    const { timings } = this;
    const last = onAir.frames.fens.length - 1;

    this.frameIndex.set(0);
    this.countdownS.set(timings.countdownS);
    this.onAir.set(onAir);
    this.phase.set('presentacion');
    await this.clock.sleep(timings.presentMs);

    this.phase.set('rival');
    this.frameIndex.set(1);
    await this.clock.sleep(timings.opponentMs);

    this.phase.set('cuenta');
    for (let s = timings.countdownS; s > 0 && this.running; s--) {
      this.countdownS.set(s);
      await this.clock.sleep(1000);
    }
    this.countdownS.set(0);

    this.phase.set('solucion');
    for (let i = 2; i <= last && this.running; i++) {
      this.frameIndex.set(i);
      await this.clock.sleep(timings.moveMs);
    }

    this.phase.set('cierre');
    await this.clock.sleep(timings.closeMs);
    this.shown.update((n) => n + 1);
  }
}
