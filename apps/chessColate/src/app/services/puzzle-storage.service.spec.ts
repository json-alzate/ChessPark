import { TestBed } from '@angular/core/testing';

import { TranslocoService } from '@jsverse/transloco';

import { CachedFileIndexEntry, PuzzlesProvider } from '@chesspark/puzzles-provider';

import { AppService } from '@services/app.service';
import { PuzzleStorageService } from '@services/puzzle-storage.service';

/** Doble del servicio de caché: solo lo que consume la fachada. */
const cacheServiceMock = {
  listCachedFiles: jest.fn<Promise<CachedFileIndexEntry[]>, []>(),
  getStorageSummary: jest.fn(),
  deleteCachedPuzzles: jest.fn().mockResolvedValue(undefined),
  deleteCachedFiles: jest.fn().mockResolvedValue(undefined),
  clearCache: jest.fn().mockResolvedValue(undefined),
  clearInfinityPool: jest.fn().mockResolvedValue(undefined),
};

const themeUrl = (theme: string, eloStart: number) =>
  `https://cdn.jsdelivr.net/gh/json-alzate/chesscolate-puzzles-files-themes-a-h@main/puzzlesFilesThemes/${theme}/${theme}_${eloStart}_${eloStart + 19}.json`;

describe('PuzzleStorageService', () => {
  let service: PuzzleStorageService;
  let activeLang = 'es';

  beforeEach(() => {
    jest.clearAllMocks();
    activeLang = 'es';

    TestBed.configureTestingModule({
      providers: [
        PuzzleStorageService,
        { provide: PuzzlesProvider, useValue: { getCacheService: () => cacheServiceMock } },
        {
          provide: AppService,
          useValue: {
            getNameThemePuzzleByValue: (value: string) =>
              value === 'fork' ? 'Horquilla' : '',
            getNameOpeningByValue: () => 'Defensa Siciliana',
          },
        },
        {
          provide: TranslocoService,
          useValue: {
            getActiveLang: () => activeLang,
            translate: (key: string) => key,
          },
        },
      ],
    });

    service = TestBed.inject(PuzzleStorageService);
  });

  it('agrupa por tema, ordena los grupos por tamaño y los archivos por ELO', async () => {
    cacheServiceMock.listCachedFiles.mockResolvedValue([
      { key: themeUrl('fork', 1520), timestamp: 1, theme: 'fork', eloStart: 1520, eloEnd: 1539, count: 200, sizeBytes: 1000 },
      { key: themeUrl('fork', 1500), timestamp: 2, theme: 'fork', eloStart: 1500, eloEnd: 1519, count: 200, sizeBytes: 1000 },
      { key: themeUrl('pin', 1500), timestamp: 3, theme: 'pin', eloStart: 1500, eloEnd: 1519, count: 100, sizeBytes: 5000 },
    ]);

    const groups = await service.getGroups();

    expect(groups.map((group) => group.key)).toEqual(['pin', 'fork']);
    expect(groups[1].files.map((file) => file.eloStart)).toEqual([1500, 1520]);
    expect(groups[1].sizeBytes).toBe(2000);
  });

  it('usa el nombre traducido del tema y cae al valor interno si no lo conoce', async () => {
    cacheServiceMock.listCachedFiles.mockResolvedValue([
      { key: themeUrl('fork', 1500), timestamp: 1, theme: 'fork', eloStart: 1500, eloEnd: 1519, sizeBytes: 10 },
      { key: themeUrl('temaRaro', 1500), timestamp: 1, theme: 'temaRaro', eloStart: 1500, eloEnd: 1519, sizeBytes: 5 },
    ]);

    const groups = await service.getGroups();

    expect(groups.find((group) => group.key === 'fork')?.name).toBe('Horquilla');
    expect(groups.find((group) => group.key === 'temaRaro')?.name).toBe('temaRaro');
  });

  it('separa las aperturas en su propio grupo', async () => {
    cacheServiceMock.listCachedFiles.mockResolvedValue([
      { key: 'x/puzzlesFilesOpenings/Sicilian_Defense/Sicilian_Defense_1500_1519.json', timestamp: 1, opening: 'Sicilian_Defense', eloStart: 1500, eloEnd: 1519, sizeBytes: 10 },
    ]);

    const groups = await service.getGroups();

    expect(groups[0].kind).toBe('opening');
    expect(groups[0].name).toBe('Defensa Siciliana');
  });

  it('marca como desconocido el tamaño que no se pudo calcular', async () => {
    cacheServiceMock.listCachedFiles.mockResolvedValue([
      { key: themeUrl('fork', 1500), timestamp: 1, theme: 'fork', eloStart: 1500, eloEnd: 1519 },
    ]);

    const groups = await service.getGroups();

    expect(groups[0].files[0].sizeUnknown).toBe(true);
    expect(groups[0].files[0].sizeBytes).toBe(0);
    expect(groups[0].sizeUnknown).toBe(true);
  });

  it('borrar un grupo elimina todos sus archivos de una vez', async () => {
    cacheServiceMock.listCachedFiles.mockResolvedValue([
      { key: themeUrl('fork', 1500), timestamp: 1, theme: 'fork', eloStart: 1500, eloEnd: 1519, sizeBytes: 10 },
      { key: themeUrl('fork', 1520), timestamp: 1, theme: 'fork', eloStart: 1520, eloEnd: 1539, sizeBytes: 10 },
    ]);

    const [group] = await service.getGroups();
    await service.deleteGroup(group);

    expect(cacheServiceMock.deleteCachedFiles).toHaveBeenCalledWith([
      themeUrl('fork', 1500),
      themeUrl('fork', 1520),
    ]);
  });

  it('borrar todo vacía también el pool de infinity', async () => {
    await service.deleteAll();

    expect(cacheServiceMock.clearCache).toHaveBeenCalled();
    expect(cacheServiceMock.clearInfinityPool).toHaveBeenCalled();
  });

  it('formatea el tamaño con el separador decimal del idioma activo', () => {
    const bytes = Math.round(18.3 * 1024 * 1024);

    expect(service.formatBytes(bytes)).toBe('18,3 MB');

    activeLang = 'en';
    expect(service.formatBytes(bytes)).toBe('18.3 MB');
  });

  it('formatea archivos pequeños en KB', () => {
    expect(service.formatBytes(148 * 1024)).toBe('148 KB');
    expect(service.formatBytes(0)).toBe('0 KB');
  });
});
