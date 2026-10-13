import type { Puzzle } from '@chesspark/puzzles-provider';
import { NoPuzzlesError, PuzzleQueue, PuzzleSource } from '@features/stream/services/puzzle-queue';
import { ProgramBlock } from '@features/stream/config/stream-program.config';

const MATE: ProgramBlock = { theme: 'mateIn2', label: 'Mate in 2' };
const FORK: ProgramBlock = { theme: 'fork', label: 'Fork' };

// Un puzzle válido (el rival mueve y hay una jugada de solución) con el uid y el ELO que se pidan.
const puzzle = (uid: string, rating = 1400, overrides: Partial<Puzzle> = {}): Puzzle =>
  ({
    uid,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: 'e2e4 e7e5',
    rating,
    themes: ['mateIn2'],
    ...overrides,
  }) as Puzzle;

interface Query {
  elo: number;
  eloMin: number;
  eloMax: number;
  theme: string;
  count: number;
}

function fakeSource(batches: Puzzle[][]): PuzzleSource & { calls: Query[] } {
  const calls: Query[] = [];
  return {
    calls,
    getPuzzles: async (query) => {
      calls.push(query);
      return batches[Math.min(calls.length - 1, batches.length - 1)] ?? [];
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
};

describe('PuzzleQueue', () => {
  it('pide al proveedor una ventana estrecha alrededor del ELO objetivo', async () => {
    const source = fakeSource([[puzzle('a', 1500)]]);

    await new PuzzleQueue(source).next(MATE, 1500);

    // la ventana se centra un poco por delante del objetivo (10 ELO) para que la subida no la alcance
    expect(source.calls[0]).toMatchObject({ theme: 'mateIn2', elo: 1510, eloMin: 1490, eloMax: 1530 });
  });

  it('no baja de 400 al pedir ELOs bajos', async () => {
    const source = fakeSource([[puzzle('a', 410)]]);

    await new PuzzleQueue(source).next(MATE, 395);

    expect(source.calls[0].eloMin).toBe(400);
  });

  it('entrega el puzzle con sus posiciones ya calculadas', async () => {
    const queued = await new PuzzleQueue(fakeSource([[puzzle('a')]])).next(MATE, 1400);

    expect(queued.puzzle.uid).toBe('a');
    expect(queued.frames.fens).toHaveLength(3);
  });

  it('elige los puzzles más cercanos al ELO objetivo', async () => {
    const batch = [puzzle('lejos', 1520), puzzle('cerca', 1502), puzzle('medio', 1510)];
    const queue = new PuzzleQueue(fakeSource([batch]), { pickAmong: 1, lowWater: 0 });

    const order = [(await queue.next(MATE, 1500)).puzzle.uid, (await queue.next(MATE, 1500)).puzzle.uid];

    expect(order).toEqual(['cerca', 'medio']);
  });

  it('nunca entrega un puzzle de menor ELO que el anterior', async () => {
    const batch = [puzzle('alto', 1510), puzzle('bajo', 1490)];
    const queue = new PuzzleQueue(fakeSource([batch]), { pickAmong: 1, lowWater: 0 });

    expect((await queue.next(MATE, 1500)).puzzle.uid).toBe('alto');
    // 'bajo' sigue en la reserva y cumple la tolerancia, pero bajaría el ELO: no se usa
    await expect(queue.next(MATE, 1500)).rejects.toBeInstanceOf(NoPuzzlesError);
  });

  it('exige un paso mínimo entre puzzles: un +1 de ELO a la vista es un estancamiento', async () => {
    const batch = [puzzle('a', 1500), puzzle('casi-igual', 1501), puzzle('sube', 1504)];
    const queue = new PuzzleQueue(fakeSource([batch]), { pickAmong: 1, lowWater: 0, minStep: 3 });

    const first = await queue.next(MATE, 1500);
    const second = await queue.next(MATE, 1500);

    expect(first.puzzle.uid).toBe('a');
    expect(second.puzzle.uid).toBe('sube');
  });

  it('dos puzzles seguidos no tienen el mismo ELO: la escalera no se estanca', async () => {
    const batch = [puzzle('a', 1500), puzzle('b', 1500), puzzle('c', 1503)];
    const queue = new PuzzleQueue(fakeSource([batch]), { pickAmong: 1, lowWater: 0 });

    const first = await queue.next(MATE, 1500);
    const second = await queue.next(MATE, 1500);

    expect(second.puzzle.rating).toBeGreaterThan(first.puzzle.rating);
  });

  it('el suelo vale para todos los temas: al cambiar de tema el ELO tampoco baja', async () => {
    const source = fakeSource([[puzzle('m', 1520)], [puzzle('f-bajo', 1480), puzzle('f-alto', 1530)]]);
    const queue = new PuzzleQueue(source, { pickAmong: 1, lowWater: 0 });

    await queue.next(MATE, 1500);
    const next = await queue.next(FORK, 1500);

    expect(next.puzzle.uid).toBe('f-alto');
  });

  it('cuando la escalera se reinicia (del tope al mínimo) el suelo se borra', async () => {
    const source = fakeSource([[puzzle('tope', 2190)], [puzzle('inicio', 610)]]);
    const queue = new PuzzleQueue(source, { lowWater: 0 });

    await queue.next(MATE, 2190);
    const afterReset = await queue.next(MATE, 600);

    expect(afterReset.puzzle.uid).toBe('inicio');
  });

  it('un tema con pocos puzzles por encima lanza NoPuzzlesError en vez de repetir ELO', async () => {
    const queue = new PuzzleQueue(fakeSource([[puzzle('a', 1500)]]), { lowWater: 0, pickAmong: 1 });
    await queue.next(MATE, 1500);

    await expect(queue.next(MATE, 1510)).rejects.toBeInstanceOf(NoPuzzlesError);
  });

  it('con un ELO objetivo que sube, el ELO de los puzzles sube con él (sin saltos)', async () => {
    const batch = Array.from({ length: 40 }, (_, i) => puzzle(`p${i}`, 1000 + i * 5));
    const queue = new PuzzleQueue(fakeSource([batch]), { pickAmong: 1, lowWater: 0 });

    const ratings: number[] = [];
    for (let target = 1000; target <= 1190; target += 10) {
      ratings.push((await queue.next(MATE, target)).puzzle.rating);
    }

    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
    ratings.slice(1).forEach((rating, i) => expect(rating - ratings[i]).toBeLessThanOrEqual(15));
  });

  it('con un objetivo que sube, el ELO de los puzzles lo sigue de cerca (sin estancarse ni dar saltos)', async () => {
    // Un proveedor que devuelve un puzzle por cada ELO de la ventana pedida
    const calls: number[] = [];
    const source: PuzzleSource = {
      getPuzzles: async ({ eloMin, eloMax, theme }) => {
        calls.push(eloMin);
        return Array.from({ length: eloMax - eloMin + 1 }, (_, i) =>
          puzzle(`${theme}-${eloMin}-${i}-${calls.length}`, eloMin + i)
        );
      },
    };
    const queue = new PuzzleQueue(source, { pickAmong: 1 });

    const gaps: number[] = [];
    for (let target = 1000; target <= 1300; target += 7) {
      const { puzzle: picked } = await queue.next(MATE, target);
      gaps.push(picked.rating - target);
      await flush();
    }

    expect(Math.max(...gaps.map(Math.abs))).toBeLessThanOrEqual(10);
    // y el ELO mostrado sube en cada puzzle, sin repetir ni bajar
    const shown = gaps.map((gap, i) => gap + 1000 + i * 7);
    shown.slice(1).forEach((rating, i) => expect(rating).toBeGreaterThan(shown[i]));
    // y para eso fue pidiendo ventanas nuevas a medida que el objetivo se alejaba
    expect(calls.length).toBeGreaterThan(5);
  });

  it('si una descarga falla, la siguiente vez vuelve a intentarlo', async () => {
    let attempts = 0;
    const source: PuzzleSource = {
      getPuzzles: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('sin red');
        }
        return [puzzle('a', 1400)];
      },
    };
    const queue = new PuzzleQueue(source);

    await expect(queue.next(MATE, 1400)).rejects.toThrow('sin red');
    expect((await queue.next(MATE, 1400)).puzzle.uid).toBe('a');
  });

  it('no usa un puzzle fuera de la tolerancia si hay uno mejor por pedir', async () => {
    const source = fakeSource([[puzzle('lejano', 1900)], [puzzle('bueno', 1505)]]);

    const queued = await new PuzzleQueue(source, { lowWater: 0 }).next(MATE, 1500);

    expect(queued.puzzle.uid).toBe('bueno');
    expect(source.calls).toHaveLength(2);
  });

  it('si tras recargar solo hay puzzles algo lejanos, usa el más cercano en vez de parar', async () => {
    const source = fakeSource([[puzzle('a', 1580)]]);

    const queued = await new PuzzleQueue(source, { lowWater: 0 }).next(MATE, 1500);

    expect(queued.puzzle.uid).toBe('a');
  });

  it('no repite un puzzle reciente aunque el proveedor lo devuelva otra vez', async () => {
    const source = fakeSource([
      [puzzle('a', 1400), puzzle('b', 1405)],
      [puzzle('a', 1400), puzzle('b', 1405), puzzle('c', 1410)],
    ]);
    const queue = new PuzzleQueue(source, { lowWater: 0, pickAmong: 1 });

    const uids = [
      (await queue.next(MATE, 1400)).puzzle.uid,
      (await queue.next(MATE, 1400)).puzzle.uid,
      (await queue.next(MATE, 1400)).puzzle.uid,
    ];

    expect(uids).toEqual(['a', 'b', 'c']);
  });

  it('salta un puzzle roto en lugar de detenerse, y no lo vuelve a intentar', async () => {
    const source = fakeSource([[puzzle('roto', 1400, { moves: 'e2e5 e7e5' }), puzzle('bueno', 1410)]]);

    const queued = await new PuzzleQueue(source, { pickAmong: 1 }).next(MATE, 1400);

    expect(queued.puzzle.uid).toBe('bueno');
  });

  it('lanza si el proveedor no tiene nada para ese tema y ELO', async () => {
    await expect(new PuzzleQueue(fakeSource([[]])).next(MATE, 1400)).rejects.toThrow(/Sin puzzles/);
  });

  it('propaga el error de red para que el director reintente', async () => {
    const source: PuzzleSource = { getPuzzles: () => Promise.reject(new Error('sin red')) };

    await expect(new PuzzleQueue(source).next(MATE, 1400)).rejects.toThrow('sin red');
  });

  it('recarga en segundo plano cuando quedan pocos cercanos', async () => {
    const source = fakeSource([[puzzle('a'), puzzle('b')], [puzzle('c')]]);

    await new PuzzleQueue(source, { lowWater: 5 }).next(MATE, 1400);
    await flush();

    expect(source.calls).toHaveLength(2);
  });

  it('cada tema tiene su propia reserva', async () => {
    const source = fakeSource([[puzzle('a', 1400)], [puzzle('z', 1410)]]);
    const queue = new PuzzleQueue(source, { lowWater: 0 });

    expect((await queue.next(MATE, 1400)).puzzle.uid).toBe('a');
    expect((await queue.next(FORK, 1410)).puzzle.uid).toBe('z');
    expect(source.calls.map((c) => c.theme)).toEqual(['mateIn2', 'fork']);
  });

  it('precarga un tema sin esperar, y luego lo entrega sin volver a pedir', async () => {
    const source = fakeSource([[puzzle('a'), puzzle('b')]]);
    const queue = new PuzzleQueue(source, { lowWater: 0 });

    queue.prefetch(MATE, 1400);
    await flush();
    const queued = await queue.next(MATE, 1400);

    expect(queued.puzzle.uid).toMatch(/^[ab]$/);
    expect(source.calls).toHaveLength(1);
  });

  it('no precarga si ya hay suficientes puzzles cercanos', async () => {
    const batch = Array.from({ length: 12 }, (_, i) => puzzle(`p${i}`, 1400 + i));
    const source = fakeSource([batch]);
    const queue = new PuzzleQueue(source, { lowWater: 5 });
    await queue.next(MATE, 1400);
    await flush();

    queue.prefetch(MATE, 1400);

    expect(source.calls).toHaveLength(1);
  });

  it('un fallo al precargar no lanza: ya se reintentará cuando toque', async () => {
    const queue = new PuzzleQueue({ getPuzzles: () => Promise.reject(new Error('sin red')) });

    expect(() => queue.prefetch(MATE, 1400)).not.toThrow();
    await flush();
  });
});
