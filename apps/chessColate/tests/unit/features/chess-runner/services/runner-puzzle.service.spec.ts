import { TestBed } from '@angular/core/testing';

import { Puzzle } from '@chesspark/models';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

import { RunnerPuzzleService } from '@features/chess-runner/services/runner-puzzle.service';
import { ejercicio } from '@tests/support/pajaro-carpintero';

let mockManifest: string[] = [];

jest.mock('@chesspark/puzzles-provider', () => ({
  ...jest.requireActual('@chesspark/puzzles-provider'),
  getManifestThemes: () => mockManifest,
}));

describe('RunnerPuzzleService', () => {
  let service: RunnerPuzzleService;
  const provider = { getPuzzles: jest.fn() };

  /** Un generador que va recorriendo estos valores. */
  const aleatorio = (...valores: number[]) => {
    let i = 0;
    return () => valores[i++ % valores.length];
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockManifest = ['fork', 'pin', 'mateIn2', 'endgame', 'short', 'advantage'];
    TestBed.configureTestingModule({
      providers: [RunnerPuzzleService, { provide: PuzzlesProvider, useValue: provider }],
    });
    service = TestBed.inject(RunnerPuzzleService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('pide al catálogo ejercicios del ELO del usuario, de un tema que sea táctico', async () => {
    provider.getPuzzles.mockResolvedValue([ejercicio('p1')]);

    await service.next(1300, new Set());

    const opciones = provider.getPuzzles.mock.calls[0][0];
    expect(opciones).toMatchObject({ elo: 1300, count: 20 });
    // «short» y «advantage» describen duración y desenlace, no un motivo táctico
    expect(['fork', 'pin', 'mateIn2', 'endgame']).toContain(opciones.theme);
  });

  it('devuelve uno de los que llegan', async () => {
    provider.getPuzzles.mockResolvedValue([ejercicio('a'), ejercicio('b'), ejercicio('c')]);

    const puzzle = await service.next(1300, new Set(), aleatorio(0.5));

    expect(['a', 'b', 'c']).toContain(puzzle?.uid);
  });

  it('no repite los ya jugados en la sesión', async () => {
    provider.getPuzzles.mockResolvedValue([ejercicio('a'), ejercicio('b')]);

    const puzzle = await service.next(1300, new Set(['a']), aleatorio(0));

    expect(puzzle?.uid).toBe('b');
  });

  it('si todos los de un tema ya se jugaron prueba con otro tema', async () => {
    provider.getPuzzles
      .mockResolvedValueOnce([ejercicio('a')])
      .mockResolvedValueOnce([ejercicio('nuevo')]);

    const puzzle = await service.next(1300, new Set(['a']));

    expect(puzzle?.uid).toBe('nuevo');
    expect(provider.getPuzzles).toHaveBeenCalledTimes(2);
    const temas = provider.getPuzzles.mock.calls.map(([o]) => o.theme);
    expect(new Set(temas).size).toBe(2);
  });

  it('un tema que falla no tumba la búsqueda: sigue con el siguiente', async () => {
    provider.getPuzzles
      .mockRejectedValueOnce(new Error('Error de red'))
      .mockResolvedValueOnce([ejercicio('ok')]);

    expect((await service.next(1300, new Set()))?.uid).toBe('ok');
  });

  it('tras cuatro temas sin resultado se rinde con null', async () => {
    provider.getPuzzles.mockResolvedValue([]);

    expect(await service.next(1300, new Set())).toBeNull();
    expect(provider.getPuzzles).toHaveBeenCalledTimes(4);
  });

  it('si el catálogo tarda demasiado no sigue probando temas y se rinde con null', async () => {
    let ahora = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    // Cada tema agota sus tiempos de espera (16 s) antes de devolver vacío
    provider.getPuzzles.mockImplementation(async () => {
      ahora += 16_000;
      return [];
    });

    expect(await service.next(1300, new Set())).toBeNull();
    expect(provider.getPuzzles).toHaveBeenCalledTimes(1);
  });

  it('si cada tema responde rápido sigue probando hasta los cuatro', async () => {
    let ahora = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    provider.getPuzzles.mockImplementation(async () => {
      ahora += 500;
      return [];
    });

    expect(await service.next(1300, new Set())).toBeNull();
    expect(provider.getPuzzles).toHaveBeenCalledTimes(4);
  });

  it('sin conexión (todo falla) devuelve null sin lanzar', async () => {
    provider.getPuzzles.mockRejectedValue(new Error('Error de red'));

    await expect(service.next(1300, new Set())).resolves.toBeNull();
  });

  it('con un catálogo sin temas no hay nada que pedir', async () => {
    mockManifest = [];

    expect(await service.next(1300, new Set())).toBeNull();
    expect(provider.getPuzzles).not.toHaveBeenCalled();
  });

  it('el tipo devuelto es un ejercicio completo', async () => {
    provider.getPuzzles.mockResolvedValue([ejercicio('x', { rating: 1333 })]);

    const puzzle: Puzzle | null = await service.next(1300, new Set());

    expect(puzzle).toMatchObject({ uid: 'x', rating: 1333 });
  });
});
