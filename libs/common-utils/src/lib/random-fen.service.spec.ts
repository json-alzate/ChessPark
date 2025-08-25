import { TestBed } from '@angular/core/testing';
import { RandomFENService, ChessPosition, RandomFENOptions } from './random-fen.service';

describe('RandomFENService', () => {
  let service: RandomFENService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RandomFENService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateRandomFEN', () => {
    it('should generate a valid FEN string', () => {
      const fen = service.generateRandomFEN();
      expect(fen).toMatch(/^[1-8KQRBNPkqrbnp\/]+ w - - 0 1$/);
    });

    it('should always include kings', () => {
      const fen = service.generateRandomFEN();
      expect(fen).toContain('K');
      expect(fen).toContain('k');
    });

    it('should respect custom options', () => {
      const options: RandomFENOptions = {
        maxPieces: 10,
        includePawns: false,
        includeQueens: false
      };
      
      const fen = service.generateRandomFEN(options);
      expect(fen).not.toContain('P');
      expect(fen).not.toContain('p');
      expect(fen).not.toContain('Q');
      expect(fen).not.toContain('q');
    });

    it('should generate different FENs on multiple calls', () => {
      const fen1 = service.generateRandomFEN();
      const fen2 = service.generateRandomFEN();
      expect(fen1).not.toEqual(fen2);
    });
  });

  describe('generateMultipleFENs', () => {
    it('should generate the requested number of FENs', () => {
      const count = 5;
      const fens = service.generateMultipleFENs(count);
      expect(fens).toHaveLength(count);
    });

    it('should generate unique FENs', () => {
      const count = 10;
      const fens = service.generateMultipleFENs(count);
      const uniqueFens = new Set(fens);
      expect(uniqueFens.size).toBeGreaterThan(1); // Al menos algunos deberían ser diferentes
    });
  });

  describe('isValidFEN', () => {
    it('should validate correct FEN strings', () => {
      const validFENs = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
        '8/8/8/8/8/8/8/8 w - - 0 1',
        'K7/8/8/8/8/8/8/k7 w - - 0 1'
      ];

      validFENs.forEach(fen => {
        expect(service.isValidFEN(fen)).toBe(true);
      });
    });

    it('should reject invalid FEN strings', () => {
      const invalidFENs = [
        'invalid',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', // Falta información adicional
        '9/8/8/8/8/8/8/8 w - - 0 1', // Fila inválida
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w - - 0 1' // Fila faltante
      ];

      invalidFENs.forEach(fen => {
        expect(service.isValidFEN(fen)).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle minimum piece configuration', () => {
      const options: RandomFENOptions = {
        maxPieces: 2,
        includePawns: false,
        includeQueens: false,
        includeRooks: false,
        includeBishops: false,
        includeKnights: false
      };
      
      const fen = service.generateRandomFEN(options);
      // Solo debería tener reyes
      expect(fen.replace(/[^Kk]/g, '')).toHaveLength(2);
    });

    it('should handle maximum piece configuration', () => {
      const options: RandomFENOptions = {
        maxPieces: 32,
        includePawns: true,
        includeQueens: true,
        includeRooks: true,
        includeBishops: true,
        includeKnights: true
      };
      
      const fen = service.generateRandomFEN(options);
      // Debería tener más piezas que solo reyes
      const pieceCount = fen.replace(/[^KQRBNPkqrbnp]/g, '').length;
      expect(pieceCount).toBeGreaterThan(2);
    });
  });

  describe('generateRealisticFEN', () => {
    it('should generate realistic positions respecting chess piece limits', () => {
      const fen = service.generateRealisticFEN();
      const stats = service.analyzeFEN(fen);
      
      // Verificar límites de piezas
      expect(stats['Q'] || 0).toBeLessThanOrEqual(1); // Máximo 1 dama blanca
      expect(stats['q'] || 0).toBeLessThanOrEqual(1); // Máximo 1 dama negra
      expect(stats['R'] || 0).toBeLessThanOrEqual(2); // Máximo 2 torres blancas
      expect(stats['r'] || 0).toBeLessThanOrEqual(2); // Máximo 2 torres negras
      expect(stats['N'] || 0).toBeLessThanOrEqual(2); // Máximo 2 caballos blancos
      expect(stats['n'] || 0).toBeLessThanOrEqual(2); // Máximo 2 caballos negros
      expect(stats['B'] || 0).toBeLessThanOrEqual(2); // Máximo 2 alfiles blancos
      expect(stats['b'] || 0).toBeLessThanOrEqual(2); // Máximo 2 alfiles negros
      expect(stats['P'] || 0).toBeLessThanOrEqual(8); // Máximo 8 peones blancos
      expect(stats['p'] || 0).toBeLessThanOrEqual(8); // Máximo 8 peones negros
    });

    it('should always include kings', () => {
      const fen = service.generateRealisticFEN();
      expect(fen).toContain('K');
      expect(fen).toContain('k');
    });
  });

  describe('generateEndgameFEN', () => {
    it('should generate endgame positions with few pieces', () => {
      const fen = service.generateEndgameFEN();
      const stats = service.analyzeFEN(fen);
      
      const totalPieces = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(totalPieces).toBeLessThanOrEqual(10); // Máximo 10 piezas (incluyendo reyes)
      
      // No debería tener damas
      expect(stats['Q'] || 0).toBe(0);
      expect(stats['q'] || 0).toBe(0);
    });
  });

  describe('generateMiddlegameFEN', () => {
    it('should generate middlegame positions with medium number of pieces', () => {
      const fen = service.generateMiddlegameFEN();
      const stats = service.analyzeFEN(fen);
      
      const totalPieces = Object.values(stats).reduce((sum, count) => sum + count, 0);
      expect(totalPieces).toBeLessThanOrEqual(22); // Máximo 22 piezas (incluyendo reyes)
      expect(totalPieces).toBeGreaterThan(4); // Al menos algunas piezas
    });
  });

  describe('analyzeFEN', () => {
    it('should correctly count pieces in a FEN string', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
      const stats = service.analyzeFEN(fen);
      
      expect(stats['K']).toBe(1);
      expect(stats['k']).toBe(1);
      expect(stats['Q']).toBe(1);
      expect(stats['q']).toBe(1);
      expect(stats['R']).toBe(2);
      expect(stats['r']).toBe(2);
      expect(stats['N']).toBe(2);
      expect(stats['n']).toBe(2);
      expect(stats['B']).toBe(2);
      expect(stats['b']).toBe(2);
      expect(stats['P']).toBe(8);
      expect(stats['p']).toBe(8);
    });

    it('should handle empty positions', () => {
      const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
      const stats = service.analyzeFEN(fen);
      
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe('isRealisticFEN', () => {
    it('should validate realistic FEN strings', () => {
      const realisticFENs = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
        '4K3/8/8/8/8/8/8/4k3 w - - 0 1',
        'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1'
      ];

      realisticFENs.forEach(fen => {
        expect(service.isRealisticFEN(fen)).toBe(true);
      });
    });

    it('should reject unrealistic FEN strings', () => {
      const unrealisticFENs = [
        'QQQQQQQQ/8/8/8/8/8/8/8 w - - 0 1', // Demasiadas damas
        'RRRRRRRR/8/8/8/8/8/8/8 w - - 0 1', // Demasiadas torres
        'PPPPPPPP/PPPPPPPP/8/8/8/8/8/8 w - - 0 1' // Demasiados peones
      ];

      unrealisticFENs.forEach(fen => {
        expect(service.isRealisticFEN(fen)).toBe(false);
      });
    });
  });
});
