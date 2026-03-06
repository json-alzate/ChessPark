import { TestBed } from '@angular/core/testing';
import { StockfishAnalysisService } from './stockfish-analysis.service';
import { StockfishService } from './stockfish.service';
import { StockfishWorkerService } from './stockfish-worker.service';

describe('StockfishAnalysisService', () => {
  let service: StockfishAnalysisService;
  let stockfishService: StockfishService;
  let workerService: StockfishWorkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StockfishAnalysisService,
        StockfishService,
        StockfishWorkerService,
      ],
    });
    service = TestBed.inject(StockfishAnalysisService);
    stockfishService = TestBed.inject(StockfishService);
    workerService = TestBed.inject(StockfishWorkerService);
  });

  afterEach(() => {
    stockfishService.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBestMove', () => {
    it('should throw error if stockfish not initialized', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      await expect(service.getBestMove(fen)).rejects.toThrow('Stockfish not initialized');
    });
  });

  describe('analyzePosition', () => {
    it('should throw error if stockfish not initialized', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      await expect(service.analyzePosition(fen)).rejects.toThrow('Stockfish not initialized');
    });
  });

  describe('getMultipleBestMoves', () => {
    it('should throw error if stockfish not initialized', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      await expect(service.getMultipleBestMoves(fen, 5)).rejects.toThrow(
        'Stockfish not initialized'
      );
    });
  });

  describe('analyzeVariation', () => {
    it('should throw error if stockfish not initialized', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = ['e2e4', 'e7e5'];
      await expect(service.analyzeVariation(fen, moves)).rejects.toThrow(
        'Stockfish not initialized'
      );
    });
  });

  describe('analyzeContinuously', () => {
    it('should throw error if stockfish not initialized', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(() => {
        service.analyzeContinuously(fen);
      }).toThrow('Stockfish not initialized');
    });
  });
});
