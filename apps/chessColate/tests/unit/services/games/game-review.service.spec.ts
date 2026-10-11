import { TestBed } from '@angular/core/testing';

import {
  StockfishEvaluationService,
  StockfishService,
} from '@chesspark/stockfish-wasm';

import { AnalyticsService } from '@services/analytics/analytics.service';
import { GameReviewService } from '@services/games/game-review.service';

// El motor real necesita un Worker y WASM: se sustituyen los servicios por dobles.
jest.mock('@chesspark/stockfish-wasm', () => ({
  StockfishService: class StockfishService {},
  StockfishEvaluationService: class StockfishEvaluationService {},
}));

const CACHE_KEY = 'chessColate_game_reviews';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
/** Mate del loco: las blancas están mateadas. */
const WHITE_MATED = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
/** Rey contra rey: tablas por material insuficiente. */
const DRAW = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';

/** Posición distinta por número (cambia el contador de jugadas) para generar claves distintas. */
const uniqueFen = (n: number) => `4k3/8/8/8/8/8/8/4K2R w K - 0 ${n}`;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}
function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Deja correr las promesas pendientes (los dobles resuelven al instante). */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('GameReviewService', () => {
  let service: GameReviewService;
  const stockfish = { initialize: jest.fn() };
  const evaluation = { evaluatePosition: jest.fn() };
  const analytics = { logEvent: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    stockfish.initialize.mockResolvedValue(undefined);
    analytics.logEvent.mockResolvedValue(undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        GameReviewService,
        { provide: StockfishService, useValue: stockfish },
        { provide: StockfishEvaluationService, useValue: evaluation },
        { provide: AnalyticsService, useValue: analytics },
      ],
    });
    service = TestBed.inject(GameReviewService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('inicializa Stockfish a profundidad 12 con la versión ligera de un hilo', async () => {
    evaluation.evaluatePosition.mockResolvedValue({ score: 10 });

    await service.evaluatePositions([START]);

    expect(stockfish.initialize).toHaveBeenCalledWith({
      depth: 12,
      workerPath: 'assets/engine/stockfish-16.1-lite-single.js',
    });
    expect(evaluation.evaluatePosition).toHaveBeenCalledWith(START, 12);
  });

  it('devuelve las evaluaciones desde el punto de vista de las blancas y avisa del avance', async () => {
    evaluation.evaluatePosition
      .mockResolvedValueOnce({ score: 30 }) // blancas al turno: tal cual
      .mockResolvedValueOnce({ score: 30 }) // negras al turno: se invierte
      .mockResolvedValueOnce({ score: 0, mate: 3 }); // mate a favor de quien mueve (negras)
    const onProgress = jest.fn();

    const result = await service.evaluatePositions(
      [START, AFTER_E4, AFTER_E4.replace(' 0 1', ' 0 2')],
      onProgress
    );

    expect(result).toEqual([{ cp: 30 }, { cp: -30 }, { mate: -3 }]);
    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('pide las posiciones de una en una y en orden', async () => {
    const first = defer<{ score: number }>();
    evaluation.evaluatePosition
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ score: 20 });

    const run = service.evaluatePositions([START, AFTER_E4]);
    await flush();

    // Mientras la primera no termina, no se pide la segunda
    expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);

    first.resolve({ score: 10 });
    await run;

    expect(evaluation.evaluatePosition.mock.calls.map(([fen]) => fen)).toEqual([START, AFTER_E4]);
  });

  it('las posiciones terminadas (mate, tablas) no se mandan al motor', async () => {
    evaluation.evaluatePosition.mockResolvedValue({ score: 15 });

    const result = await service.evaluatePositions([START, WHITE_MATED, DRAW]);

    expect(result).toEqual([{ cp: 15 }, { mate: -1 }, { cp: 0 }]);
    expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);
  });

  it('una posición que falla queda en null y el análisis continúa', async () => {
    evaluation.evaluatePosition
      .mockRejectedValueOnce(new Error('timeout del motor'))
      .mockResolvedValueOnce({ score: 40 });

    const result = await service.evaluatePositions([START, AFTER_E4]);

    expect(result).toEqual([null, { cp: -40 }]);
  });

  it('si Stockfish no arranca, el error se propaga', async () => {
    stockfish.initialize.mockRejectedValue(new Error('worker no disponible'));

    await expect(service.evaluatePositions([START])).rejects.toThrow('worker no disponible');
    expect(evaluation.evaluatePosition).not.toHaveBeenCalled();
  });

  describe('análisis guardado en el dispositivo', () => {
    it('volver a pedir la misma partida sale del dispositivo, sin motor, y completa el avance', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 25 });
      const first = await service.evaluatePositions([START, AFTER_E4]);
      jest.clearAllMocks();
      const onProgress = jest.fn();

      const second = await service.evaluatePositions([START, AFTER_E4], onProgress);

      expect(second).toEqual(first);
      expect(stockfish.initialize).not.toHaveBeenCalled();
      expect(evaluation.evaluatePosition).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('otra partida (otras posiciones) no aprovecha el análisis guardado', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 25 });
      await service.evaluatePositions([START, AFTER_E4]);
      jest.clearAllMocks();
      stockfish.initialize.mockResolvedValue(undefined);
      evaluation.evaluatePosition.mockResolvedValue({ score: 5 });

      await service.evaluatePositions([START]);

      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);
    });

    it('un análisis guardado a otra profundidad se descarta y se vuelve a calcular', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 25 });
      await service.evaluatePositions([START]);
      const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      stored[0].depth = 8;
      localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
      jest.clearAllMocks();
      stockfish.initialize.mockResolvedValue(undefined);
      evaluation.evaluatePosition.mockResolvedValue({ score: 25 });

      await service.evaluatePositions([START]);

      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);
    });

    it('si todas las posiciones fallan no se guarda nada, para poder reintentar', async () => {
      evaluation.evaluatePosition.mockRejectedValue(new Error('x'));

      const result = await service.evaluatePositions([START, AFTER_E4]);

      expect(result).toEqual([null, null]);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('si solo algunas fallan, el resultado parcial sí se guarda', async () => {
      evaluation.evaluatePosition
        .mockRejectedValueOnce(new Error('x'))
        .mockResolvedValueOnce({ score: 10 });

      await service.evaluatePositions([START, AFTER_E4]);

      const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].evals).toEqual([null, { cp: -10 }]);
    });

    it('conserva como mucho 30 partidas y descarta las más antiguas', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 1 });
      for (let n = 1; n <= 31; n++) {
        await service.evaluatePositions([uniqueFen(n)]);
      }

      const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      expect(stored).toHaveLength(30);

      // La más reciente va primera; la primera que se analizó ya no está
      jest.clearAllMocks();
      stockfish.initialize.mockResolvedValue(undefined);
      evaluation.evaluatePosition.mockResolvedValue({ score: 1 });
      await service.evaluatePositions([uniqueFen(31)]);
      expect(evaluation.evaluatePosition).not.toHaveBeenCalled();
      await service.evaluatePositions([uniqueFen(1)]);
      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);
    });

    it('con lo guardado corrupto analiza igualmente', async () => {
      localStorage.setItem(CACHE_KEY, '{no es json');
      evaluation.evaluatePosition.mockResolvedValue({ score: 7 });

      const result = await service.evaluatePositions([START]);

      expect(result).toEqual([{ cp: 7 }]);
    });

    it('si el dispositivo no deja guardar, el análisis se devuelve igualmente', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 7 });
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      await expect(service.evaluatePositions([START])).resolves.toEqual([{ cp: 7 }]);
    });
  });

  describe('analítica', () => {
    it('registra game_review_completed con las posiciones, la profundidad y los fallos', async () => {
      evaluation.evaluatePosition
        .mockResolvedValueOnce({ score: 10 })
        .mockRejectedValueOnce(new Error('x'));

      await service.evaluatePositions([START, AFTER_E4]);

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'game_review_completed',
        expect.objectContaining({ positions: 2, depth: 12, failed_positions: 1 })
      );
    });

    it('no registra nada si la valoración sale del dispositivo', async () => {
      evaluation.evaluatePosition.mockResolvedValue({ score: 10 });
      await service.evaluatePositions([START]);
      analytics.logEvent.mockClear();

      await service.evaluatePositions([START]);

      expect(analytics.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('cancelación', () => {
    it('cancelar a mitad devuelve null, no pide más posiciones y no guarda ni registra nada', async () => {
      const first = defer<{ score: number }>();
      evaluation.evaluatePosition.mockReturnValueOnce(first.promise);
      const onProgress = jest.fn();

      const run = service.evaluatePositions([START, AFTER_E4], onProgress);
      await flush();
      service.cancel();
      first.resolve({ score: 10 });

      expect(await run).toBeNull();
      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });

    it('cancelar con la última posición en marcha también descarta el resultado', async () => {
      const only = defer<{ score: number }>();
      evaluation.evaluatePosition.mockReturnValueOnce(only.promise);

      const run = service.evaluatePositions([START]);
      await flush();
      service.cancel();
      only.resolve({ score: 10 });

      expect(await run).toBeNull();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('un análisis nuevo espera a que termine la posición del cancelado antes de pedir la suya', async () => {
      const stale = defer<{ score: number }>();
      evaluation.evaluatePosition
        .mockReturnValueOnce(stale.promise) // la posición del análisis viejo
        .mockResolvedValue({ score: 50 });

      const oldRun = service.evaluatePositions([START, AFTER_E4]);
      await flush();
      service.cancel();

      const newRun = service.evaluatePositions([AFTER_E4]);
      await flush();

      // El motor sigue ocupado con la vieja: el nuevo no ha pedido nada todavía
      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(1);

      stale.resolve({ score: 999 });

      expect(await oldRun).toBeNull();
      // La evaluación del nuevo es la suya (50 con negras al turno), no la de la vieja
      expect(await newRun).toEqual([{ cp: -50 }]);
      expect(evaluation.evaluatePosition).toHaveBeenCalledTimes(2);
    });

    it('si la posición cancelada acaba en error, el análisis nuevo igualmente continúa', async () => {
      const stale = defer<{ score: number }>();
      evaluation.evaluatePosition
        .mockReturnValueOnce(stale.promise)
        .mockResolvedValue({ score: 20 });

      const oldRun = service.evaluatePositions([START]);
      await flush();
      service.cancel();
      const newRun = service.evaluatePositions([START.replace(' 0 1', ' 0 2')]);
      await flush();
      stale.reject(new Error('worker caído'));

      await oldRun;
      expect(await newRun).toEqual([{ cp: 20 }]);
    });

    it('un análisis cancelado antes de arrancar el motor no lo inicializa', async () => {
      const busy = defer<{ score: number }>();
      evaluation.evaluatePosition.mockReturnValueOnce(busy.promise);
      const first = service.evaluatePositions([START]);
      await flush();
      stockfish.initialize.mockClear();

      // Segundo análisis queda esperando al motor ocupado y se cancela mientras espera
      const second = service.evaluatePositions([AFTER_E4]);
      await flush();
      service.cancel();
      busy.resolve({ score: 1 });

      expect(await second).toBeNull();
      expect(stockfish.initialize).not.toHaveBeenCalled();
      await first;
    });
  });
});
