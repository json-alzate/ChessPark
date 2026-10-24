import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { CUSTOM_PGN_TEMPLATE } from '@features/custom-puzzles/config/custom-pgn-template';
import { CustomPuzzlesImportService } from '@features/custom-puzzles/services/custom-puzzles-import.service';

describe('CustomPuzzlesImportService', () => {
  let service: CustomPuzzlesImportService;
  const analytics = { logEvent: jest.fn() };

  const eventos = (nombre: string) =>
    analytics.logEvent.mock.calls.filter(([n]) => n === nombre).map(([, p]) => p);

  /** Un PGN con tantos ejercicios distintos como se pidan: cada uno cambia el número de jugada del FEN. */
  function pgnConEjercicios(cantidad: number): string {
    return Array.from(
      { length: cantidad },
      (_, i) => `[Event "E${i}"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 ${i + 1}"]\n\n1... a6 2. Re8# *`
    ).join('\n\n');
  }

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [CustomPuzzlesImportService, { provide: AnalyticsService, useValue: analytics }],
    });
    service = TestBed.inject(CustomPuzzlesImportService);
  });

  describe('importText', () => {
    it('lee un PGN bueno y devuelve los ejercicios con su informe', () => {
      const resultado = service.importText(CUSTOM_PGN_TEMPLATE, 'mis-ejercicios.pgn');

      expect(resultado.status).toBe('ok');
      if (resultado.status !== 'ok') return;
      expect(resultado.name).toBe('mis-ejercicios.pgn');
      expect(resultado.puzzles).toHaveLength(3);
      expect(resultado.dropped).toBe(0);
      expect(resultado.report.total).toBe(3);
    });

    it('anota la importación con cuántos entraron y cuántos no', () => {
      service.importText(`${CUSTOM_PGN_TEMPLATE}\n[Event "Roto"]\n[FEN "x"]\n\n1. e4 *`);

      expect(eventos('custom_pgn_import_completed')).toEqual([
        { total: 4, imported: 3, failed: 1, enough: false },
      ]);
    });

    it.each([
      ['', 'empty'],
      ['   \n ', 'empty'],
      ['PK\u0003\u0004\u0000zip', 'not-text'],
    ])('un texto como %p falla con «%s»', (texto, motivo) => {
      expect(service.importText(texto)).toEqual({ status: 'failed', reason: motivo, report: undefined });
      expect(eventos('custom_pgn_import_failed')).toEqual([{ reason: motivo }]);
    });

    it('un texto enorme falla por tamaño', () => {
      const resultado = service.importText('a'.repeat(2_000_001));

      expect(resultado).toMatchObject({ status: 'failed', reason: 'too-big' });
    });

    it('un texto sin ningún ejercicio entendible falla, pero lleva el informe', () => {
      const resultado = service.importText('hola, esto no es un PGN');

      expect(resultado).toMatchObject({ status: 'failed', reason: 'no-exercises' });
    });

    it('si todos los ejercicios son malos falla y dice por qué en el informe', () => {
      const resultado = service.importText('[Event "A"]\n[FEN "x"]\n\n1. e4 *\n\n[Event "B"]\n[FEN "y"]\n\n1. d4 *');

      expect(resultado.status).toBe('failed');
      if (resultado.status !== 'failed') return;
      expect(resultado.report?.issues.map((i) => i.code)).toEqual(['invalid-fen', 'invalid-fen']);
    });

    it('pasado el tope se queda con los primeros y cuenta los que sobran', () => {
      const resultado = service.importText(pgnConEjercicios(505));

      expect(resultado.status).toBe('ok');
      if (resultado.status !== 'ok') return;
      expect(resultado.puzzles).toHaveLength(500);
      expect(resultado.dropped).toBe(5);
      expect(resultado.puzzles[0].fen).toContain('- 0 1');
    });
  });

  describe('importFile', () => {
    it('lee el texto del archivo y usa su nombre', async () => {
      const archivo = new File([CUSTOM_PGN_TEMPLATE], 'tacticas.pgn', { type: 'text/plain' });
      Object.defineProperty(archivo, 'text', { value: () => Promise.resolve(CUSTOM_PGN_TEMPLATE) });

      const resultado = await service.importFile(archivo);

      expect(resultado).toMatchObject({ status: 'ok', name: 'tacticas.pgn' });
    });

    it('si el archivo no se puede leer falla sin romper', async () => {
      const archivo = new File([''], 'roto.pgn');
      Object.defineProperty(archivo, 'text', { value: () => Promise.reject(new Error('x')) });

      const resultado = await service.importFile(archivo);

      expect(resultado).toMatchObject({ status: 'failed', reason: 'unreadable' });
    });
  });

  it('anota desde dónde se empezó la importación', () => {
    service.trackStarted('file');
    service.trackStarted('paste');

    expect(eventos('custom_pgn_import_started')).toEqual([{ via: 'file' }, { via: 'paste' }]);
  });
});
