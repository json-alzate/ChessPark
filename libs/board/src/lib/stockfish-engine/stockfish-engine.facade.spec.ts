import { TestBed } from '@angular/core/testing';
import {
  StockfishAnalysisService,
  StockfishService,
} from '@chesspark/stockfish-wasm';
import { STOCKFISH_PUZZLE_CONFIG, StockfishEngineFacade } from './stockfish-engine.facade';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('StockfishEngineFacade', () => {
  // Estado simulado del worker: `initialize` lo pone listo y `terminate` lo apaga,
  // igual que el StockfishService real, para que el facade vea transiciones coherentes.
  let ready: boolean;
  let stockfish: {
    readonly isReady: boolean;
    initialize: jest.Mock;
    terminate: jest.Mock;
    stopAnalysis: jest.Mock;
  };
  let analysis: { getBestMove: jest.Mock };
  let facade: StockfishEngineFacade;

  beforeEach(() => {
    ready = false;
    stockfish = {
      get isReady() {
        return ready;
      },
      initialize: jest.fn().mockImplementation(async () => {
        ready = true;
      }),
      terminate: jest.fn().mockImplementation(() => {
        ready = false;
      }),
      stopAnalysis: jest.fn(),
    };
    analysis = { getBestMove: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        StockfishEngineFacade,
        { provide: StockfishService, useValue: stockfish },
        { provide: StockfishAnalysisService, useValue: analysis },
      ],
    });
    facade = TestBed.inject(StockfishEngineFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('initialize', () => {
    it('deja el motor listo con la configuración del puzzle', async () => {
      const ok = await facade.initialize();

      expect(ok).toBe(true);
      expect(facade.isReady).toBe(true);
      expect(stockfish.initialize).toHaveBeenCalledWith(STOCKFISH_PUZZLE_CONFIG);
      expect(stockfish.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ depth: 15, threads: 1, hash: 16 })
      );
    });

    it('devuelve false y deja el worker terminado si la inicialización falla, sin lanzar', async () => {
      stockfish.initialize.mockRejectedValueOnce(new Error('worker no carga'));

      await expect(facade.initialize()).resolves.toBe(false);

      expect(facade.isReady).toBe(false);
      expect(stockfish.terminate).toHaveBeenCalled();
    });

    it('termina el worker previo antes de crear uno nuevo si ya estaba listo', async () => {
      ready = true;

      await facade.initialize();

      const terminateOrder = stockfish.terminate.mock.invocationCallOrder[0];
      const initializeOrder = stockfish.initialize.mock.invocationCallOrder[0];
      expect(terminateOrder).toBeLessThan(initializeOrder);
    });
  });

  describe('getBestMove', () => {
    beforeEach(async () => {
      await facade.initialize();
    });

    it('devuelve la jugada encontrada por Stockfish con la profundidad del puzzle', async () => {
      analysis.getBestMove.mockResolvedValueOnce({ move: 'e2e4' });

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'best-move', move: 'e2e4' });
      expect(analysis.getBestMove).toHaveBeenCalledWith(START_FEN, { depth: 15 });
    });

    it('devuelve no-move si el resultado no trae jugada', async () => {
      analysis.getBestMove.mockResolvedValueOnce({ move: '' });

      await expect(facade.getBestMove(START_FEN)).resolves.toEqual({ kind: 'no-move' });
    });

    it('devuelve unavailable sin analizar si el motor no está listo', async () => {
      facade.dispose();

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(analysis.getBestMove).not.toHaveBeenCalled();
    });

    it('un error no crítico (p. ej. timeout) devuelve no-move sin apagar el motor', async () => {
      analysis.getBestMove.mockRejectedValueOnce(new Error('Timeout'));

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'no-move' });
      expect(facade.isReady).toBe(true);
    });

    it('si el worker se perdió ("not initialized") lo reinicia y reintenta una vez', async () => {
      analysis.getBestMove
        .mockRejectedValueOnce(new Error('Stockfish not initialized. Call initialize() first.'))
        .mockResolvedValueOnce({ move: 'd2d4' });

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'best-move', move: 'd2d4' });
      expect(analysis.getBestMove).toHaveBeenCalledTimes(2);
      expect(stockfish.terminate).toHaveBeenCalled();
      expect(stockfish.initialize).toHaveBeenCalledTimes(2);
    });

    it('si el reinicio falla devuelve unavailable', async () => {
      analysis.getBestMove.mockRejectedValueOnce(new Error('Stockfish not initialized.'));
      stockfish.initialize.mockRejectedValueOnce(new Error('no se pudo reinicializar'));

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(facade.isReady).toBe(false);
    });

    it('un error crítico de memoria apaga el motor y devuelve unavailable', async () => {
      analysis.getBestMove.mockRejectedValueOnce(new Error('memory access out of bounds'));

      const outcome = await facade.getBestMove(START_FEN);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(stockfish.terminate).toHaveBeenCalled();
      expect(facade.isReady).toBe(false);
    });

    it('una petición mientras hay otra en curso cancela el análisis y no devuelve jugada', async () => {
      analysis.getBestMove.mockReturnValueOnce(new Promise(() => undefined));

      void facade.getBestMove(START_FEN);
      const second = await facade.getBestMove(START_FEN);

      expect(second).toEqual({ kind: 'no-move' });
      expect(stockfish.stopAnalysis).toHaveBeenCalled();
      expect(analysis.getBestMove).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel y dispose', () => {
    it('cancel detiene el análisis sin terminar el worker', async () => {
      await facade.initialize();

      facade.cancel();

      expect(stockfish.stopAnalysis).toHaveBeenCalled();
      expect(stockfish.terminate).not.toHaveBeenCalled();
      expect(facade.isReady).toBe(true);
    });

    it('dispose termina el worker', async () => {
      await facade.initialize();

      facade.dispose();

      expect(stockfish.terminate).toHaveBeenCalled();
      expect(facade.isReady).toBe(false);
    });
  });
});
