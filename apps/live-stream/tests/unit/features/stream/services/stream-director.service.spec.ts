import { TestBed } from '@angular/core/testing';
import type { Puzzle } from '@chesspark/puzzles-provider';
import { PUZZLE_SOURCE } from '@features/stream/services/puzzle-source';
import { PuzzleSource } from '@features/stream/services/puzzle-queue';
import { STREAM_CLOCK } from '@features/stream/services/stream-clock';
import { StreamDirectorService } from '@features/stream/services/stream-director.service';
import { StreamTimings, STREAM_TIMINGS } from '@features/stream/config/stream-timings.config';

// El bloque es larguísimo para que la precarga del siguiente tema no intervenga en estas pruebas.
const TIMINGS: StreamTimings = { presentMs: 10, opponentMs: 20, countdownS: 3, moveMs: 30, closeMs: 40, blockMs: 10_000_000_000, ladderMs: 10_000_000, ladderOffsetMs: 0 };

// Mate en 2 real: 4 jugadas en total (1 del rival + 3 de la solución... aquí 2 del que resuelve).
const MATE: Puzzle = {
  uid: 'p1',
  fen: '1r5r/5pk1/4p3/2Np2PP/p1nP4/n1P5/P3B3/K1R4R w - - 2 34',
  moves: 'c5a4 b8b1 c1b1 a3c2',
  rating: 1506,
  themes: ['mateIn2'],
} as Puzzle;

interface Beat {
  ms: number;
  phase: string;
  index: number;
  countdown: number;
}

function setup(source: PuzzleSource, timings: StreamTimings = TIMINGS) {
  // `director` se crea al final de esta función; el reloj solo lo usa cuando ya empezó a correr.
  const beats: Beat[] = [];
  let stopAfter = Infinity;

  TestBed.configureTestingModule({
    providers: [
      { provide: PUZZLE_SOURCE, useValue: source },
      { provide: STREAM_TIMINGS, useValue: timings },
      {
        provide: STREAM_CLOCK,
        useValue: {
          now: () => 1_000_000,
          // Registra cada pausa con lo que el director tenía en pantalla en ese momento.
          sleep: (ms: number) => {
            beats.push({ ms, phase: director.phase(), index: director.frameIndex(), countdown: director.countdownS() });
            if (beats.length >= stopAfter) {
              director.stop();
            }
            return new Promise<void>((resolve) => setTimeout(resolve, 0));
          },
        },
      },
    ],
  });
  const director = TestBed.inject(StreamDirectorService);
  return {
    beats,
    director,
    runBeats: async (n: number) => {
      stopAfter = n;
      director.start();
      // Espera a que ocurra lo que se pide (no un tiempo fijo): así la prueba no depende de
      // lo cargada que esté la máquina.
      const deadline = Date.now() + 5000;
      while (beats.length < n && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    },
  };
}

describe('StreamDirectorService', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('recorre las fases de un puzzle en orden', async () => {
    const { beats, runBeats } = setup({ getPuzzles: async (q) => [{ ...MATE, rating: q.elo }] });

    // presentación, rival, 3 de cuenta atrás, 3 jugadas de solución, cierre
    await runBeats(9);

    expect(beats.map((b) => b.phase)).toEqual([
      'presentacion',
      'rival',
      'cuenta',
      'cuenta',
      'cuenta',
      'solucion',
      'solucion',
      'solucion',
      'cierre',
    ]);
  });

  it('muestra primero la posición inicial, luego la jugada del rival y luego la solución', async () => {
    const { beats, runBeats } = setup({ getPuzzles: async (q) => [{ ...MATE, rating: q.elo }] });
    await runBeats(9);

    expect(beats.map((b) => b.index)).toEqual([0, 1, 1, 1, 1, 2, 3, 4, 4]);
  });

  it('la cuenta atrás baja de uno en uno', async () => {
    const { beats, runBeats } = setup({ getPuzzles: async (q) => [{ ...MATE, rating: q.elo }] });
    await runBeats(9);

    expect(beats.filter((b) => b.phase === 'cuenta').map((b) => b.countdown)).toEqual([3, 2, 1]);
  });

  it('publica el puzzle en pantalla con el bloque del que salió', async () => {
    const { director, runBeats } = setup({ getPuzzles: async (q) => [{ ...MATE, rating: q.elo }] });
    await runBeats(2);

    // el proveedor de prueba devuelve un puzzle con el ELO del centro de la ventana pedida (770)
    expect(director.onAir()?.puzzle.rating).toBe(770);
    expect(director.onAir()?.block.theme).toBeDefined();
    expect(director.onAir()?.block.label).toBeTruthy();
  });

  it('si el proveedor falla, reintenta con pausa en lugar de detenerse', async () => {
    let calls = 0;
    const { beats, runBeats } = setup({
      getPuzzles: async (query) => {
        calls++;
        if (calls < 3) {
          throw new Error('sin red');
        }
        return [{ ...MATE, rating: query.elo }];
      },
    });

    await runBeats(4);

    // dos pausas de reintento (2 s y 4 s) y después ya arranca el puzzle
    expect(beats.slice(0, 2).map((b) => b.ms)).toEqual([2000, 4000]);
    expect(beats[2].phase).toBe('presentacion');
  });

  it('cuenta los puzzles que ya se mostraron enteros', async () => {
    const { director, runBeats } = setup({ getPuzzles: async (q) => [{ ...MATE, rating: q.elo }] });
    await runBeats(10);

    expect(director.shown()).toBe(1);
  });

  it('pide los puzzles al ELO que toca según la escalera, en una ventana estrecha', async () => {
    const queries: { elo: number; eloMin: number; eloMax: number }[] = [];
    const { runBeats } = setup({
      getPuzzles: async (query) => {
        queries.push(query);
        return [{ ...MATE, rating: query.elo }];
      },
    });

    await runBeats(1);

    // now() = 1_000_000 y escalera de 10_000_000 ms: va en el 10 % -> 600 + 160 = 760; la ventana
    // se centra 10 ELO por delante (770).
    expect(queries[0]).toMatchObject({ elo: 770, eloMin: 750, eloMax: 790 });
  });

  it('el tema siguiente se precarga al ELO que tendrá cuando empiece', async () => {
    const queries: { theme: string; elo: number }[] = [];
    const { runBeats } = setup(
      {
        getPuzzles: async (query) => {
          queries.push(query);
          return [{ ...MATE, rating: query.elo }];
        },
      },
      { ...TIMINGS, blockMs: 60_000 }
    );

    await runBeats(1);

    // el siguiente bloque empieza en 1_020_000: 10,2 % de la escalera -> 763
    const current = queries.find((q) => q.elo === 770);
    const next = queries.find((q) => q.elo === 773);
    expect(current).toBeDefined();
    expect(next).toBeDefined();
    expect(next?.theme).not.toBe(current?.theme);
  });

  it('descarga con antelación el tema siguiente cuando falta poco para el cambio', async () => {
    const themes: string[] = [];
    // now() = 1_000_000 y bloques de 60 s: faltan 20 s para el cambio, dentro de la ventana de precarga.
    const { runBeats } = setup(
      {
        getPuzzles: async (query) => {
          themes.push(query.theme);
          return [{ ...MATE, rating: query.elo }];
        },
      },
      { ...TIMINGS, blockMs: 60_000 }
    );

    await runBeats(2);

    expect(new Set(themes).size).toBe(2);
  });

  it('si el tema que toca no tiene puzzles a ese ELO, saca el puzzle de otro tema sin detenerse', async () => {
    const themes: string[] = [];
    const { director, runBeats } = setup({
      getPuzzles: async (query) => {
        themes.push(query.theme);
        // el primer tema del programa no tiene nada; los demás sí
        return query.theme === 'fork' ? [] : [{ ...MATE, rating: query.elo }];
      },
    });

    await runBeats(2);

    expect(themes[0]).toBe('fork');
    expect(director.onAir()?.block.theme).not.toBe('fork');
    expect(director.onAir()?.block.label).toBeTruthy();
    // y no cuenta como fallo: no hubo pausa de reintento antes de salir al aire
    expect(director.phase()).not.toBe('cargando');
  });

  it('el ELO objetivo sigue el desfase de pruebas', async () => {
    const queries: { elo: number }[] = [];
    const { runBeats } = setup(
      {
        getPuzzles: async (query) => {
          queries.push(query);
          return [{ ...MATE, rating: query.elo }];
        },
      },
      { ...TIMINGS, ladderOffsetMs: 5_000_000 }
    );

    await runBeats(1);

    // 1_000_000 + 5_000_000 de una escalera de 10_000_000 ms: 60 % -> 600 + 960 = 1560 (+10 por la ventana)
    expect(queries[0].elo).toBe(1570);
  });
});
