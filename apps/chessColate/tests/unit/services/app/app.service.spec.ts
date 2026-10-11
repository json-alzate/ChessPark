import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';

import { Opening, PuzzleThemesGroup } from '@chesspark/models';
import { AppService } from '@services/app/app.service';

const themeGroups = [
  {
    themes: [
      { value: 'fork', nameEs: 'Horquilla', nameEn: 'Fork', descriptionEs: 'desc es fork', descriptionEn: 'desc en fork' },
      { value: 'pin', nameEs: 'Clavada', nameEn: 'Pin', descriptionEs: 'desc es pin', descriptionEn: 'desc en pin' },
    ],
  },
  {
    themes: [{ value: 'mate', nameEs: 'Mate', nameEn: 'Mate', descriptionEs: 'd es', descriptionEn: 'd en' }],
  },
] as unknown as PuzzleThemesGroup[];

const openings = [
  { value: 'sicilian', nameEs: 'Siciliana', nameEn: 'Sicilian', descriptionEs: 'des siciliana', descriptionEn: 'des sicilian' },
] as unknown as Opening[];

describe('AppService', () => {
  let service: AppService;
  let http: HttpTestingController;
  let activeLang: string;

  beforeEach(() => {
    activeLang = 'es';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: { getActiveLang: () => activeLang } },
      ],
    });
    service = TestBed.inject(AppService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  async function loadThemes() {
    const loading = service.loadThemesPuzzle();
    http.expectOne('assets/data/themes-puzzle.json').flush(themeGroups);
    await loading;
  }

  async function loadOpenings() {
    const loading = service.loadOpenings();
    http.expectOne('assets/data/openings.json').flush(openings);
    await loading;
  }

  describe('temas', () => {
    it('antes de cargar las listas están vacías', () => {
      expect(service.getThemesPuzzle).toEqual([]);
      expect(service.getThemesPuzzlesList).toEqual([]);
      expect(service.getOpeningsList).toEqual([]);
    });

    it('al cargar guarda los grupos y aplana los temas en una sola lista', async () => {
      await loadThemes();

      expect(service.getThemesPuzzle).toBe(themeGroups);
      expect(service.getThemesPuzzlesList.map((t) => t.value)).toEqual(['fork', 'pin', 'mate']);
    });

    it('si la carga falla, la promesa se rechaza y las listas siguen vacías', async () => {
      const loading = service.loadThemesPuzzle();
      http.expectOne('assets/data/themes-puzzle.json').flush('error', { status: 500, statusText: 'Server Error' });

      await expect(loading).rejects.toBeTruthy();
      expect(service.getThemesPuzzlesList).toEqual([]);
    });

    it('getThemePuzzleByValue devuelve el tema, o undefined avisando por consola si no existe', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      await loadThemes();

      expect(service.getThemePuzzleByValue('pin')?.nameEn).toBe('Pin');
      expect(service.getThemePuzzleByValue('inexistente')).toBeUndefined();
      expect(log).toHaveBeenCalledWith('No se encontró el tema', 'inexistente');
    });

    it('validateThemesInList dice si el tema está en la lista', async () => {
      await loadThemes();

      expect(service.validateThemesInList('fork')).toBe(true);
      expect(service.validateThemesInList('otro')).toBe(false);
    });

    it('getNameThemePuzzleByValue usa el idioma activo cuando no se indica uno', async () => {
      await loadThemes();

      expect(service.getNameThemePuzzleByValue('fork')).toBe('Horquilla');
      activeLang = 'en';
      expect(service.getNameThemePuzzleByValue('fork')).toBe('Fork');
    });

    it('getNameThemePuzzleByValue respeta el idioma explícito aunque el activo sea otro', async () => {
      await loadThemes();

      expect(service.getNameThemePuzzleByValue('fork', 'en')).toBe('Fork');
      expect(service.getNameThemePuzzleByValue('fork', 'es')).toBe('Horquilla');
    });

    it('un idioma distinto de es cae a inglés', async () => {
      await loadThemes();

      expect(service.getNameThemePuzzleByValue('fork', 'fr')).toBe('Fork');
    });

    it('el nombre de un tema inexistente es cadena vacía', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      await loadThemes();

      expect(service.getNameThemePuzzleByValue('nada')).toBe('');
    });

    it('la descripción del tema sigue el idioma activo y es vacía si no existe', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      await loadThemes();

      expect(service.getDescriptionThemePuzzleByValue('pin')).toBe('desc es pin');
      activeLang = 'en';
      expect(service.getDescriptionThemePuzzleByValue('pin')).toBe('desc en pin');
      expect(service.getDescriptionThemePuzzleByValue('nada')).toBe('');
    });
  });

  describe('aperturas', () => {
    it('loadOpenings guarda la lista descargada', async () => {
      await loadOpenings();

      expect(service.getOpeningsList).toBe(openings);
    });

    it('getOpeningByValue devuelve la apertura o un objeto vacío si no existe', async () => {
      await loadOpenings();

      expect(service.getOpeningByValue('sicilian').nameEn).toBe('Sicilian');
      expect(service.getOpeningByValue('nada')).toEqual({});
    });

    it('nombre y descripción siguen el idioma activo', async () => {
      await loadOpenings();

      expect(service.getNameOpeningByValue('sicilian')).toBe('Siciliana');
      expect(service.getDescriptionOpeningByValue('sicilian')).toBe('des siciliana');
      activeLang = 'en';
      expect(service.getNameOpeningByValue('sicilian')).toBe('Sicilian');
      expect(service.getDescriptionOpeningByValue('sicilian')).toBe('des sicilian');
    });

    it('una apertura inexistente da undefined en nombre y descripción', async () => {
      await loadOpenings();

      expect(service.getNameOpeningByValue('nada')).toBeUndefined();
      expect(service.getDescriptionOpeningByValue('nada')).toBeUndefined();
    });
  });
});
