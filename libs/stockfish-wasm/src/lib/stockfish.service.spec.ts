import { TestBed } from '@angular/core/testing';
import { StockfishService } from './stockfish.service';
import { StockfishWorkerService } from './stockfish-worker.service';
import { StockfishStatus } from './types/stockfish.types';

describe('StockfishService', () => {
  let service: StockfishService;
  let workerService: StockfishWorkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StockfishService, StockfishWorkerService],
    });
    service = TestBed.inject(StockfishService);
    workerService = TestBed.inject(StockfishWorkerService);
  });

  afterEach(() => {
    service.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial status as Uninitialized', () => {
    expect(service.status).toBe(StockfishStatus.Uninitialized);
  });

  it('should have isReady as false initially', () => {
    expect(service.isReady).toBe(false);
  });

  it('should have isAnalyzing as false initially', () => {
    expect(service.isAnalyzing).toBe(false);
  });

  describe('setPosition', () => {
    it('should throw error if not initialized', () => {
      expect(() => {
        service.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      }).toThrow('Stockfish not initialized');
    });
  });

  describe('setPositionFromStart', () => {
    it('should throw error if not initialized', () => {
      expect(() => {
        service.setPositionFromStart(['e2e4']);
      }).toThrow('Stockfish not initialized');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({ threads: 4, hash: 64 });
      const config = service.getConfig();
      expect(config.threads).toBe(4);
      expect(config.hash).toBe(64);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const config1 = service.getConfig();
      service.updateConfig({ threads: 2 });
      const config2 = service.getConfig();

      // Should be different objects
      expect(config1).not.toBe(config2);
    });
  });
});
