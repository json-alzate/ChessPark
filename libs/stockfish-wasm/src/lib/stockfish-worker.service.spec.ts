import { TestBed } from '@angular/core/testing';
import { StockfishWorkerService } from './stockfish-worker.service';

describe('StockfishWorkerService', () => {
  let service: StockfishWorkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StockfishWorkerService],
    });
    service = TestBed.inject(StockfishWorkerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseInfoMessage', () => {
    it('should parse info message with depth and score', () => {
      const message = 'info depth 15 score cp 20 nodes 1000 time 500 pv e2e4 e7e5';
      const result = service.parseInfoMessage(message);

      expect(result).toBeTruthy();
      expect(result?.depth).toBe(15);
      expect(result?.score?.cp).toBe(20);
      expect(result?.nodes).toBe(1000);
      expect(result?.time).toBe(500);
      expect(result?.pv).toEqual(['e2e4', 'e7e5']);
    });

    it('should parse info message with mate score', () => {
      const message = 'info depth 10 score mate 3 pv e2e4 e7e5 g1f3';
      const result = service.parseInfoMessage(message);

      expect(result).toBeTruthy();
      expect(result?.score?.mate).toBe(3);
      expect(result?.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
    });

    it('should return null for non-info messages', () => {
      const message = 'bestmove e2e4';
      const result = service.parseInfoMessage(message);
      expect(result).toBeNull();
    });
  });

  describe('parseBestMoveMessage', () => {
    it('should parse bestmove message', () => {
      const message = 'bestmove e2e4 ponder e7e5';
      const result = service.parseBestMoveMessage(message);

      expect(result).toBeTruthy();
      expect(result?.move).toBe('e2e4');
      expect(result?.ponder).toBe('e7e5');
    });

    it('should parse bestmove without ponder', () => {
      const message = 'bestmove e2e4';
      const result = service.parseBestMoveMessage(message);

      expect(result).toBeTruthy();
      expect(result?.move).toBe('e2e4');
      expect(result?.ponder).toBeUndefined();
    });

    it('should return null for non-bestmove messages', () => {
      const message = 'info depth 15';
      const result = service.parseBestMoveMessage(message);
      expect(result).toBeNull();
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(service.isReady()).toBe(false);
    });
  });
});
