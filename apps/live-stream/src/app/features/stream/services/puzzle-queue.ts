import type { Puzzle } from '@chesspark/puzzles-provider';
import { PuzzleFrames, puzzleToFrames } from '@features/stream/utils/puzzle-frames.util';
import { ProgramBlock } from '@features/stream/config/stream-program.config';

/** Lo que la cola necesita de `puzzles-provider`; así se puede probar sin red. */
export interface PuzzleSource {
  getPuzzles(query: {
    elo: number;
    eloMin: number;
    eloMax: number;
    theme: string;
    count: number;
  }): Promise<Puzzle[]>;
}

/**
 * El tema no tiene ningún puzzle utilizable a ese ELO. No es un fallo de red: el director
 * lo resuelve sacando ese puzzle de otro tema para que la escalera de ELO no se detenga.
 */
export class NoPuzzlesError extends Error {
  constructor(theme: string, elo: number) {
    super(`Sin puzzles utilizables para ${theme} cerca de ELO ${elo}`);
    this.name = 'NoPuzzlesError';
  }
}

export interface QueuedPuzzle {
  puzzle: Puzzle;
  frames: PuzzleFrames;
}

export interface PuzzleQueueOptions {
  /** Cuántos puzzles pedir cada vez. */
  batch: number;
  /** Cuántos uid recientes recordar para no repetirlos en horas. */
  remember: number;
  /** Cuando quedan menos puzzles cercanos al ELO objetivo que esto, se pide otra tanda. */
  lowWater: number;
  /** Mitad del rango de ELO que se pide al proveedor (el proveedor trabaja en archivos de 20). */
  window: number;
  /** Distancia máxima al ELO objetivo para elegir un puzzle. */
  tolerance: number;
  /** Distancia máxima si no hay nada más cerca (mejor un puzzle algo lejos que parar). */
  widest: number;
  /** Máximo de puzzles guardados por tema. */
  bufferSize: number;
  /** Cuánto por delante del objetivo se centra cada descarga, para que el ELO que sube no alcance el borde de la reserva. */
  lookahead: number;
  /** Se elige al azar entre los N más cercanos al objetivo, para no repetir siempre el mismo patrón. */
  pickAmong: number;
  /** Si el objetivo cae más que esto por debajo del último puzzle, la escalera se reinició. */
  resetDrop: number;
  /** Cuánto debe subir como mínimo el ELO de un puzzle al siguiente (un +1 a la vista es un estancamiento). */
  minStep: number;
}

const DEFAULT_OPTIONS: PuzzleQueueOptions = {
  batch: 100,
  remember: 300,
  lowWater: 5,
  window: 20,
  tolerance: 40,
  widest: 150,
  bufferSize: 400,
  lookahead: 10,
  pickAmong: 5,
  resetDrop: 300,
  minStep: 3,
};

/**
 * Entrega puzzles listos para reproducir, uno tras otro, para el tema y el ELO que tocan.
 *
 * - Pide al proveedor ventanas estrechas de ELO alrededor del objetivo (el proveedor recorre
 *   los rangos de menor a mayor, así que una ventana ancha solo traería los más fáciles).
 * - De lo que ya tiene guardado elige el puzzle más cercano al objetivo, para que el ELO que
 *   se ve suba de forma gradual y no salte de un puzzle a otro.
 * - Recarga en segundo plano antes de quedarse sin puzzles cercanos.
 * - No repite los últimos N puzzles y salta los que no se pueden reproducir (datos rotos).
 */
export class PuzzleQueue {
  private readonly buffers = new Map<string, Puzzle[]>();
  private readonly pending = new Map<string, Promise<void>>();
  /** ELO del último puzzle entregado: el siguiente nunca es menor (hasta que la escalera se reinicia). */
  private lastRating: number | null = null;
  /** Centro de la última descarga de cada tema. */
  private readonly lastCenter = new Map<string, number>();
  private readonly recent = new Set<string>();
  private readonly recentOrder: string[] = [];
  private readonly options: PuzzleQueueOptions;

  constructor(private readonly source: PuzzleSource, options: Partial<PuzzleQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async next(block: ProgramBlock, targetElo: number): Promise<QueuedPuzzle> {
    const { theme } = block;

    // Al reiniciarse la escalera (del tope al mínimo) el suelo se borra; si no, el ELO subiría
    // sin parar o se quedaría clavado en el tope.
    if (this.lastRating !== null && targetElo < this.lastRating - this.options.resetDrop) {
      this.lastRating = null;
    }
    const floor = this.lastRating === null ? Number.NEGATIVE_INFINITY : this.lastRating + this.options.minStep;
    // Las descargas se centran donde puede haber puzzles útiles: nunca por debajo del suelo.
    const base = Math.max(targetElo, floor);

    for (let attempt = 0; attempt < 3; attempt++) {
      const tolerance = attempt === 0 ? this.options.tolerance : this.options.widest;
      let pool = this.nearby(theme, targetElo, tolerance, floor);

      if (pool.length === 0) {
        await this.refill(theme, base);
        pool = this.nearby(theme, targetElo, tolerance, floor);
      }
      if (pool.length > 0 && (pool.length < this.options.lowWater || this.needsRefresh(theme, base))) {
        // Sin await: la tanda siguiente llega mientras se reproduce este puzzle.
        this.refill(theme, base).catch(() => undefined);
      }

      while (pool.length > 0) {
        const puzzle = this.pickNearest(pool, targetElo);
        pool = pool.filter((candidate) => candidate.uid !== puzzle.uid);
        this.discard(theme, puzzle.uid);

        const frames = puzzleToFrames(puzzle);
        if (!frames) {
          continue;
        }
        this.remember(puzzle.uid);
        this.lastRating = puzzle.rating;
        return { puzzle, frames };
      }
    }

    throw new NoPuzzlesError(theme, targetElo);
  }

  /**
   * Descarga con antelación los puzzles de un tema y un ELO, sin esperar: así el cambio de
   * tema no deja el tablero parado mientras llegan los archivos. No hace nada si ya hay.
   */
  prefetch(block: ProgramBlock, targetElo: number): void {
    const enough = this.nearby(block.theme, targetElo, this.options.tolerance, Number.NEGATIVE_INFINITY).length >= this.options.lowWater;
    if (enough && !this.needsRefresh(block.theme, targetElo)) {
      return;
    }
    this.refill(block.theme, targetElo).catch(() => undefined);
  }

  private nearby(theme: string, targetElo: number, tolerance: number, floor: number): Puzzle[] {
    return (this.buffers.get(theme) ?? []).filter(
      (puzzle) =>
        !this.recent.has(puzzle.uid) && puzzle.rating >= floor && Math.abs(puzzle.rating - targetElo) <= tolerance
    );
  }

  /** Uno al azar entre los `pickAmong` más cercanos al objetivo. */
  private pickNearest(pool: Puzzle[], targetElo: number): Puzzle {
    const nearest = [...pool]
      .sort((a, b) => Math.abs(a.rating - targetElo) - Math.abs(b.rating - targetElo))
      .slice(0, this.options.pickAmong);
    return nearest[Math.floor(Math.random() * nearest.length)];
  }

  private discard(theme: string, uid: string): void {
    const buffer = this.buffers.get(theme);
    if (buffer) {
      this.buffers.set(theme, buffer.filter((puzzle) => puzzle.uid !== uid));
    }
  }

  /** ¿Se alejó el objetivo lo bastante de la última descarga como para pedir la siguiente ventana? */
  private needsRefresh(theme: string, targetElo: number): boolean {
    const center = this.lastCenter.get(theme);
    return center === undefined || targetElo + this.options.lookahead - center >= this.options.window;
  }

  private refill(theme: string, targetElo: number): Promise<void> {
    const { window, batch, bufferSize, lookahead } = this.options;
    const center = targetElo + lookahead;
    // Una descarga por tema y franja de 20 ELO a la vez.
    const key = `${theme}:${Math.floor(center / 20)}`;
    const running = this.pending.get(key);
    if (running) {
      return running;
    }
    this.lastCenter.set(theme, center);

    const task = this.source
      .getPuzzles({
        elo: center,
        eloMin: Math.max(center - window, 400),
        eloMax: center + window,
        theme,
        count: batch,
      })
      .then((puzzles) => {
        const buffer = this.buffers.get(theme) ?? [];
        const known = new Set(buffer.map((puzzle) => puzzle.uid));
        for (const puzzle of puzzles) {
          if (!this.recent.has(puzzle.uid) && !known.has(puzzle.uid)) {
            buffer.push(puzzle);
            known.add(puzzle.uid);
          }
        }
        // Se conservan los más cercanos al objetivo actual: los lejanos ya no van a tocar pronto.
        buffer.sort((a, b) => Math.abs(a.rating - targetElo) - Math.abs(b.rating - targetElo));
        this.buffers.set(theme, buffer.slice(0, bufferSize));
      })
      .catch((error: unknown) => {
        this.lastCenter.delete(theme);
        throw error;
      })
      .finally(() => this.pending.delete(key));

    this.pending.set(key, task);
    return task;
  }

  private remember(uid: string): void {
    this.recent.add(uid);
    this.recentOrder.push(uid);
    if (this.recentOrder.length > this.options.remember) {
      this.recent.delete(this.recentOrder.shift() as string);
    }
  }
}
