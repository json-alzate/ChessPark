import { TestBed } from '@angular/core/testing';
import { StockfishEvaluationService } from './stockfish-evaluation.service';
import { StockfishService } from './stockfish.service';
import { StockfishWorkerService } from './stockfish-worker.service';

describe('StockfishEvaluationService', () => {
  let service: StockfishEvaluationService;
  let stockfishService: StockfishService;
  let workerService: StockfishWorkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StockfishEvaluationService,
        StockfishService,
        StockfishWorkerService,
      ],
    });
    service = TestBed.inject(StockfishEvaluationService);
    stockfishService = TestBed.inject(StockfishService);
    workerService = TestBed.inject(StockfishWorkerService);
  });

  afterEach(() => {
    stockfishService.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPositionScore', () => {
    it('should throw error if stockfish not initialized', async () => {
      await expect(
        service.getPositionScore('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      ).rejects.toThrow('Stockfish not initialized');
    });
  });

  describe('evaluatePosition', () => {
    it('should throw error if stockfish not initialized', async () => {
      await expect(
        service.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      ).rejects.toThrow('Stockfish not initialized');
    });
  });

  describe('evaluatePositionAsync', () => {
    it('should throw error if stockfish not initialized', () => {
      expect(() => {
        service.evaluatePositionAsync('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      }).toThrow('Stockfish not initialized');
    });
  });

  describe('evaluateMultiplePositions', () => {
    it('should throw error if stockfish not initialized', async () => {
      const positions = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ];
      await expect(service.evaluateMultiplePositions(positions)).rejects.toThrow(
        'Stockfish not initialized'
      );
    });
  });

  describe('comparePositions', () => {
    it('should throw error if stockfish not initialized', async () => {
      const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      await expect(service.comparePositions(fen1, fen2)).rejects.toThrow(
        'Stockfish not initialized'
      );
    });
  });
});
