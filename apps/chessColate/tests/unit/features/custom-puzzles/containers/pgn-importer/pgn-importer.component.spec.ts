import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { CUSTOM_PGN_TEMPLATE } from '@features/custom-puzzles/config/custom-pgn-template';
import {
  PgnImported,
  PgnImporterComponent,
} from '@features/custom-puzzles/containers/pgn-importer/pgn-importer.component';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

describe('PgnImporterComponent', () => {
  let fixture: ComponentFixture<PgnImporterComponent>;
  let importer: PgnImporterComponent;
  const avisos: (PgnImported | null)[] = [];
  const analytics = { logEvent: jest.fn() };

  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const texto = (id: string) => (el(id)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  /** Un PGN con tantos ejercicios válidos como se pidan. */
  const pgn = (cantidad: number) =>
    Array.from(
      { length: cantidad },
      (_, i) => `[Event "E${i}"]\n[FEN "6k1/p4ppp/8/8/8/8/5PPP/4R1K1 b - - 0 ${i + 1}"]\n\n1... a6 2. Re8# *`
    ).join('\n\n');

  function pegar(contenido: string) {
    importer.pastedText = contenido;
    importer.readPasted();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    avisos.length = 0;
    await TestBed.configureTestingModule({
      imports: [PgnImporterComponent, translocoParaPruebas()],
      providers: [{ provide: AnalyticsService, useValue: analytics }],
    }).compileComponents();
    fixture = TestBed.createComponent(PgnImporterComponent);
    importer = fixture.componentInstance;
    importer.imported.subscribe((valor) => avisos.push(valor));
    fixture.detectChanges();
  });

  it('al empezar no enseña ningún resultado y no avisa de nada', () => {
    expect(el('summary')).toBeNull();
    expect(el('failure')).toBeNull();
    expect(avisos).toEqual([]);
  });

  describe('texto pegado', () => {
    it('el botón de leer está desactivado mientras el cuadro está vacío', () => {
      expect((el('read-pasted') as HTMLButtonElement).disabled).toBe(true);
    });

    it('un PGN bueno avisa con los ejercicios y enseña cuántos hay listos', () => {
      pegar(pgn(6));

      expect(avisos).toHaveLength(1);
      expect(avisos[0]?.puzzles).toHaveLength(6);
      expect(el('summary')).not.toBeNull();
      expect(texto('summary-count')).toContain('CUSTOM_PGN.summary.ready');
      expect(el('too-few')).toBeNull();
    });

    it('con menos del mínimo se enseña el resultado pero avisa de que no hay nada utilizable', () => {
      pegar(pgn(2));

      expect(avisos).toEqual([null]);
      expect(el('too-few')).not.toBeNull();
    });

    it('un texto que no es un PGN enseña el motivo y avisa de que no hay nada', () => {
      pegar('esto no es un PGN');

      expect(avisos).toEqual([null]);
      expect(texto('failure')).toContain('CUSTOM_PGN.failure.no-exercises');
      expect(el('summary')).toBeNull();
    });

    it('lista los ejercicios que no entraron, con su título, y deja entrar el resto', () => {
      pegar(`${pgn(5)}\n\n[Event "Roto"]\n[FEN "x"]\n\n1. e4 *`);

      expect(avisos[0]?.puzzles).toHaveLength(5);
      const problemas = texto('issues');
      expect(problemas).toContain('Roto');
      expect(problemas).toContain('CUSTOM_PGN.issues.invalid-fen');
    });

    it('con muchos problemas enseña los primeros y resume el resto', () => {
      const rotos = Array.from({ length: 8 }, (_, i) => `[Event "R${i}"]\n[FEN "x"]\n\n1. e4 *`).join('\n\n');
      pegar(`${pgn(5)}\n\n${rotos}`);

      expect(el('issues')?.querySelectorAll('li')).toHaveLength(5);
      expect(texto('issues')).toContain('CUSTOM_PGN.issues.more');
    });

    it('avisa de los ejercicios que sobran del máximo', () => {
      pegar(pgn(503));

      expect(avisos[0]?.puzzles).toHaveLength(500);
      expect(el('dropped')).not.toBeNull();
    });

    it('avisa de las correcciones que se hicieron sin descartar el ejercicio', () => {
      pegar(`${pgn(4)}\n\n[Event "Larga"]\n[FEN "r3k3/7p/8/3N4/8/8/8/4K3 b q - 0 1"]\n\n1... h6 2. Nc7+ Kd7 *`);

      expect(avisos[0]?.puzzles).toHaveLength(5);
      expect(texto('notes')).toContain('CUSTOM_PGN.notes.trailing-opponent-move-dropped');
    });

    it('«Quitar» vacía todo y avisa de que ya no hay nada cargado', () => {
      pegar(pgn(6));
      (el('clear') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(avisos[avisos.length - 1]).toBeNull();
      expect(el('summary')).toBeNull();
      expect(importer.pastedText).toBe('');
    });

    it('un archivo malo tras uno bueno retira lo cargado', () => {
      pegar(pgn(6));
      pegar('nada');

      expect(avisos).toHaveLength(2);
      expect(avisos[1]).toBeNull();
      expect(el('summary')).toBeNull();
    });
  });

  describe('archivo', () => {
    function elegir(contenido: string, nombre = 'ejercicios.pgn') {
      const archivo = new File([contenido], nombre);
      Object.defineProperty(archivo, 'text', { value: () => Promise.resolve(contenido) });
      const input = el('file-input') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
      input.dispatchEvent(new Event('change'));
      return fixture.whenStable().then(() => fixture.detectChanges());
    }

    it('lee el archivo elegido y enseña su nombre', async () => {
      await elegir(pgn(6), 'mis-tacticas.pgn');

      expect(avisos[0]?.name).toBe('mis-tacticas.pgn');
      expect(avisos[0]?.puzzles).toHaveLength(6);
      expect(el('summary')?.textContent).toContain('mis-tacticas.pgn');
    });

    it('«Elegir archivo» abre el selector y anota que se empezó', () => {
      const clic = jest.spyOn(el('file-input') as HTMLInputElement, 'click').mockImplementation(() => undefined);

      (el('pick-file') as HTMLButtonElement).click();

      expect(clic).toHaveBeenCalled();
      expect(analytics.logEvent).toHaveBeenCalledWith('custom_pgn_import_started', { via: 'file' });
    });
  });

  describe('ayuda del formato', () => {
    it('trae el ejemplo completo, el mismo que se descarga', () => {
      expect(el('example')?.textContent).toBe(CUSTOM_PGN_TEMPLATE);
    });

    it('copiar el ejemplo lo deja en el portapapeles y lo confirma un momento', async () => {
      const escribir = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });

      await importer.copyTemplate();

      expect(escribir).toHaveBeenCalledWith(CUSTOM_PGN_TEMPLATE);
      expect(importer.copied).toBe(true);
    });

    it('si el portapapeles no deja copiar no rompe', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockRejectedValue(new Error('denegado')) },
        configurable: true,
      });

      await expect(importer.copyTemplate()).resolves.toBeUndefined();
      expect(importer.copied).toBe(false);
    });

    it('descargar el ejemplo crea un archivo .pgn con el contenido', () => {
      const crear = jest.fn().mockReturnValue('blob:x');
      const revocar = jest.fn();
      Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
      const clic = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

      importer.downloadTemplate();

      expect(crear).toHaveBeenCalledTimes(1);
      expect((crear.mock.calls[0][0] as Blob).type).toBe('application/x-chess-pgn');
      expect(clic).toHaveBeenCalled();
      expect(revocar).toHaveBeenCalledWith('blob:x');
    });
  });
});
