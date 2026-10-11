import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  AlertController,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { GameCollectionInfo } from '@chesspark/games-provider';
import { AccountStorageSummary } from '@chesspark/game-reporter';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { GameAnalyticsService } from '@features/game-analytics/services/game-analytics.service';
import { GamesService } from '@features/games/services/games.service';
import {
  PuzzleStorageService,
  StorageFileItem,
  StorageGroup,
} from '@services/training/puzzle-storage.service';
import { StoragePage } from '@app/features/settings/pages/storage.page';

import {
  NavbarFalsa,
  controladorFalso,
  superposicionFalsa,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Pantalla de descargas: lista lo guardado en el dispositivo (puzzles por tema o
 * apertura, paquetes de partidas y archivos de análisis), permite borrarlo con
 * confirmación y recalcula los totales tras cada borrado. Todo es caché: borrar
 * nunca pierde progreso.
 */

function archivo(url: string, extra: Partial<StorageFileItem> = {}): StorageFileItem {
  return {
    url,
    eloStart: 1500,
    eloEnd: 1519,
    eloLabel: '1500–1519',
    count: 1000,
    sizeBytes: 100,
    sizeUnknown: false,
    timestamp: 1,
    ...extra,
  };
}

function grupo(key: string, files: StorageFileItem[], extra: Partial<StorageGroup> = {}): StorageGroup {
  return {
    key,
    kind: 'theme',
    name: `Tema ${key}`,
    files,
    sizeBytes: files.reduce((total, f) => total + f.sizeBytes, 0),
    sizeUnknown: false,
    ...extra,
  };
}

const PAQUETE: GameCollectionInfo = {
  id: 'petrosian',
  name: 'Tigran Petrosian',
  reign: '1963–1969',
  games: 300,
  sizeBytes: 5000,
  file: 'players/petrosian.pgn',
};

const CUENTA = {
  platform: 'lichess',
  username: 'magnus',
  games: 120,
  sizeBytes: 2000,
} as AccountStorageSummary;

describe('StoragePage', () => {
  let fixture: ComponentFixture<StoragePage>;
  let page: StoragePage;

  let grupos: StorageGroup[];
  let paquetes: GameCollectionInfo[];
  let cuentas: AccountStorageSummary[];

  const router = { navigate: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const puzzleStorage = {
    getGroups: jest.fn(),
    formatBytes: jest.fn(),
    deleteFile: jest.fn(),
    deleteGroup: jest.fn(),
    deleteAll: jest.fn(),
  };
  const games = {
    getDownloadedCollections: jest.fn(),
    deletePack: jest.fn(),
    clearGamePacks: jest.fn(),
  };
  const gameAnalytics = {
    getStorageByAccount: jest.fn(),
    disconnect: jest.fn(),
    clearArchive: jest.fn(),
  };
  const alert = superposicionFalsa();
  const alertController = controladorFalso(alert);

  /** Qué responde el usuario a la próxima confirmación. */
  function responderConfirmacion(role: 'destructive' | 'cancel') {
    alert.onDidDismiss.mockResolvedValue({ role });
  }

  async function crear() {
    fixture = TestBed.createComponent(StoragePage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botones(): HTMLButtonElement[] {
    return Array.from(el().querySelectorAll('button'));
  }

  function botonPorEtiqueta(aria: string): HTMLButtonElement[] {
    return botones().filter((b) => b.getAttribute('aria-label') === aria);
  }

  async function pulsar(boton: HTMLElement | undefined) {
    if (!boton) {
      throw new Error('El botón no existe en la pantalla');
    }
    boton.click();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    grupos = [
      grupo('fork', [archivo('u1'), archivo('u2', { eloLabel: '1520–1539', sizeBytes: 300 })]),
      grupo('pin', [archivo('u3')]),
    ];
    paquetes = [];
    cuentas = [];

    puzzleStorage.getGroups.mockImplementation(async () => grupos);
    puzzleStorage.formatBytes.mockImplementation((bytes: number) => `${bytes} B`);
    puzzleStorage.deleteFile.mockResolvedValue(undefined);
    puzzleStorage.deleteGroup.mockResolvedValue(undefined);
    puzzleStorage.deleteAll.mockResolvedValue(undefined);
    games.getDownloadedCollections.mockImplementation(async () => paquetes);
    games.deletePack.mockResolvedValue(undefined);
    games.clearGamePacks.mockResolvedValue(undefined);
    gameAnalytics.getStorageByAccount.mockImplementation(async () => cuentas);
    gameAnalytics.disconnect.mockResolvedValue(undefined);
    gameAnalytics.clearArchive.mockResolvedValue(undefined);
    analytics.logEvent.mockResolvedValue(undefined);
    alert.present.mockClear();
    responderConfirmacion('destructive');

    await TestBed.configureTestingModule({
      imports: [
        StoragePage,
        translocoParaPruebas({
          'STORAGE.oneFile': '1 archivo',
          'STORAGE.filesCount': '{{count}} archivos',
          'STORAGE.summary': '{{files}} archivos · {{size}}',
        }),
      ],
      providers: [
        { provide: Router, useValue: router },
        { provide: AlertController, useValue: alertController },
        { provide: AnalyticsService, useValue: analytics },
        { provide: PuzzleStorageService, useValue: puzzleStorage },
        { provide: GamesService, useValue: games },
        { provide: GameAnalyticsService, useValue: gameAnalytics },
      ],
    })
      .overrideComponent(StoragePage, {
        set: {
          imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarFalsa],
        },
      })
      .compileComponents();
  });

  describe('carga inicial', () => {
    it('mientras lee el almacenamiento enseña el esqueleto de carga', () => {
      puzzleStorage.getGroups.mockReturnValue(new Promise(() => undefined));
      fixture = TestBed.createComponent(StoragePage);
      fixture.detectChanges();

      expect(fixture.componentInstance.loading).toBe(true);
      expect(el().querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(el().textContent).not.toContain('STORAGE.deleteAll');
    });

    it('lista los grupos con su nombre, número de archivos y tamaño', async () => {
      await crear();

      const texto = el().textContent ?? '';
      expect(texto).toContain('Tema fork');
      expect(texto).toContain('2 archivos · 400 B');
      expect(texto).toContain('Tema pin');
      expect(texto).toContain('1 archivo · 100 B');
    });

    it('el total suma archivos y tamaño de puzzles, paquetes de partidas y archivos de análisis', async () => {
      paquetes = [PAQUETE];
      cuentas = [CUENTA];
      await crear();

      // 3 de puzzles + 1 paquete + 1 cuenta
      expect(page.totalFiles).toBe(5);
      // 500 de puzzles + 5000 de partidas + 2000 de análisis
      expect(page.totalSizeBytes).toBe(7500);
      expect(el().textContent).toContain('5 archivos · 7500 B');
    });

    it('registra puzzle_storage_opened con los archivos y los MB con un decimal', async () => {
      grupos = [grupo('fork', [archivo('u1', { sizeBytes: 3 * 1024 * 1024 + 150_000 })])];
      await crear();

      expect(analytics.logEvent).toHaveBeenCalledWith('puzzle_storage_opened', {
        files_count: 1,
        size_mb: 3.1,
      });
    });

    it('sin nada descargado enseña el estado vacío y no ofrece borrar todo', async () => {
      grupos = [];
      await crear();

      expect(page.totalFiles).toBe(0);
      expect(el().textContent).toContain('STORAGE.empty');
      expect(el().textContent).not.toContain('STORAGE.deleteAll');
    });

    it('si falla la lectura no rompe la pantalla: muestra el estado vacío', async () => {
      const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      puzzleStorage.getGroups.mockRejectedValue(new Error('sin IndexedDB'));

      await crear();

      expect(aviso).toHaveBeenCalled();
      expect(page.loading).toBe(false);
      expect(page.totalFiles).toBe(0);
      expect(el().textContent).toContain('STORAGE.empty');
      aviso.mockRestore();
    });

    it('muestra los paquetes de partidas y los archivos de análisis con su plataforma', async () => {
      paquetes = [PAQUETE];
      cuentas = [CUENTA];
      await crear();

      const texto = el().textContent ?? '';
      expect(texto).toContain('Tigran Petrosian');
      expect(texto).toContain('magnus');
      expect(texto).toContain('Lichess');
      expect(texto).toContain('GAMES.title');
      expect(texto).toContain('ANALYTICS.title');
    });

    it('sin paquetes ni cuentas no pinta esas secciones', async () => {
      await crear();

      expect(el().textContent).not.toContain('GAMES.title');
      expect(el().textContent).not.toContain('ANALYTICS.title');
    });
  });

  describe('grupos desplegables', () => {
    it('empiezan plegados y al pulsar la cabecera muestran sus archivos', async () => {
      await crear();
      expect(el().textContent).not.toContain('1520–1539');

      await pulsar(el().querySelector('button.flex-1') as HTMLElement);

      expect(page.isExpanded(grupos[0])).toBe(true);
      expect(el().textContent).toContain('1520–1539');
      expect(el().textContent).toContain('STORAGE.puzzlesCount');
    });

    it('al volver a pulsar se pliega', async () => {
      await crear();
      const cabecera = el().querySelector('button.flex-1') as HTMLElement;
      await pulsar(cabecera);

      await pulsar(cabecera);

      expect(page.isExpanded(grupos[0])).toBe(false);
      expect(el().textContent).not.toContain('1520–1539');
    });

    it('si el grupo desplegado desaparece tras borrar, no queda marcado como desplegado', async () => {
      await crear();
      page.toggleGroup(grupos[1]);
      const pin = grupos[1];
      grupos = [grupos[0]];

      await page.confirmDeleteGroup(pin);

      expect(page.isExpanded(pin)).toBe(false);
    });
  });

  describe('etiquetas de tamaño y cantidad', () => {
    it('un archivo con tamaño desconocido se pinta "—"', async () => {
      await crear();

      expect(page.fileSizeLabel(archivo('x', { sizeUnknown: true }))).toBe('—');
      expect(page.fileSizeLabel(archivo('x', { sizeBytes: 2048 }))).toBe('2048 B');
    });

    it('un grupo con tamaño desconocido y 0 bytes se pinta "—", pero con tamaño parcial lo enseña', async () => {
      await crear();

      expect(page.groupSizeLabel(grupo('a', [], { sizeUnknown: true, sizeBytes: 0 }))).toBe('—');
      expect(page.groupSizeLabel(grupo('a', [], { sizeUnknown: true, sizeBytes: 50 }))).toBe('50 B');
    });

    it('distingue "1 archivo" de "N archivos"', async () => {
      await crear();

      expect(page.filesCountLabel(1)).toBe('1 archivo');
      expect(page.filesCountLabel(3)).toBe('3 archivos');
    });
  });

  describe('borrar un archivo', () => {
    it('pide confirmación antes de borrar, con las opciones cancelar y borrar', async () => {
      await crear();
      responderConfirmacion('cancel');

      await page.confirmDeleteFile(grupos[0], grupos[0].files[0]);

      const opciones = alertController.create.mock.calls[0][0];
      expect(opciones.header).toBe('STORAGE.confirm.fileTitle');
      expect(alert.present).toHaveBeenCalled();
      expect(opciones.buttons.map((b: { role: string }) => b.role)).toEqual(['cancel', 'destructive']);
    });

    it('si se cancela no borra nada ni vuelve a leer', async () => {
      await crear();
      responderConfirmacion('cancel');
      puzzleStorage.getGroups.mockClear();

      await page.confirmDeleteFile(grupos[0], grupos[0].files[0]);

      expect(puzzleStorage.deleteFile).not.toHaveBeenCalled();
      expect(puzzleStorage.getGroups).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalledWith('puzzle_storage_file_deleted', expect.anything());
    });

    it('si se confirma borra por URL, registra el evento y la lista se encoge', async () => {
      await crear();
      await pulsar(el().querySelector('button.flex-1') as HTMLElement);
      puzzleStorage.deleteFile.mockImplementation(async (url: string) => {
        grupos[0] = grupo('fork', grupos[0].files.filter((f) => f.url !== url));
      });

      await pulsar(botonPorEtiqueta('STORAGE.confirm.delete')[0]);

      expect(puzzleStorage.deleteFile).toHaveBeenCalledWith('u1');
      expect(analytics.logEvent).toHaveBeenCalledWith('puzzle_storage_file_deleted', {
        theme: 'fork',
        elo_start: 1500,
      });
      expect(page.totalFiles).toBe(2);
      expect(page.groups[0].files.map((f) => f.url)).toEqual(['u2']);
    });
  });

  describe('borrar un grupo', () => {
    it('al confirmar borra el grupo y registra archivos y MB', async () => {
      await crear();
      grupos = [grupos[1]];

      await page.confirmDeleteGroup(page.groups[0]);

      expect(puzzleStorage.deleteGroup).toHaveBeenCalledWith(expect.objectContaining({ key: 'fork' }));
      expect(analytics.logEvent).toHaveBeenCalledWith('puzzle_storage_theme_deleted', {
        theme: 'fork',
        files_count: 2,
        size_mb: 0,
      });
      expect(page.groups.map((g) => g.key)).toEqual(['pin']);
    });

    it('si se cancela no borra', async () => {
      await crear();
      responderConfirmacion('cancel');

      await page.confirmDeleteGroup(grupos[0]);

      expect(puzzleStorage.deleteGroup).not.toHaveBeenCalled();
    });

    it('el botón de papelera de cada grupo inicia el borrado de ese grupo', async () => {
      await crear();
      responderConfirmacion('cancel');

      await pulsar(botonPorEtiqueta('STORAGE.deleteAll').find((b) => b.classList.contains('text-error')));

      expect(alertController.create).toHaveBeenCalledTimes(1);
      expect(alertController.create.mock.calls[0][0].header).toBe('STORAGE.confirm.groupTitle');
    });
  });

  describe('borrar un paquete de partidas', () => {
    it('al confirmar lo borra por id y recalcula', async () => {
      paquetes = [PAQUETE];
      await crear();
      games.deletePack.mockImplementation(async () => {
        paquetes = [];
      });

      await pulsar(botonPorEtiqueta('GAMES.delete')[0]);

      expect(games.deletePack).toHaveBeenCalledWith('petrosian');
      expect(page.gamePacks).toEqual([]);
      expect(page.totalFiles).toBe(3);
    });

    it('si se cancela no lo borra', async () => {
      paquetes = [PAQUETE];
      await crear();
      responderConfirmacion('cancel');

      await page.confirmDeletePack(PAQUETE);

      expect(games.deletePack).not.toHaveBeenCalled();
      expect(page.gamePacks).toHaveLength(1);
    });
  });

  describe('desconectar una cuenta (archivo de análisis)', () => {
    it('al confirmar borra el archivo de esa plataforma y usuario', async () => {
      cuentas = [CUENTA];
      await crear();
      gameAnalytics.disconnect.mockImplementation(async () => {
        cuentas = [];
      });

      await pulsar(botonPorEtiqueta('ANALYTICS.disconnect')[0]);

      expect(gameAnalytics.disconnect).toHaveBeenCalledWith('lichess', 'magnus');
      expect(page.archiveAccounts).toEqual([]);
    });

    it('si se cancela conserva el archivo', async () => {
      cuentas = [CUENTA];
      await crear();
      responderConfirmacion('cancel');

      await page.confirmDeleteAccount(CUENTA);

      expect(gameAnalytics.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('borrar todo', () => {
    it('al confirmar vacía puzzles, paquetes de partidas y archivo de análisis y deja el estado vacío', async () => {
      paquetes = [PAQUETE];
      cuentas = [CUENTA];
      await crear();
      puzzleStorage.deleteAll.mockImplementation(async () => {
        grupos = [];
      });
      games.clearGamePacks.mockImplementation(async () => {
        paquetes = [];
      });
      gameAnalytics.clearArchive.mockImplementation(async () => {
        cuentas = [];
      });

      await pulsar(botones().find((b) => (b.textContent ?? '').includes('STORAGE.deleteAll')));

      expect(puzzleStorage.deleteAll).toHaveBeenCalledTimes(1);
      expect(games.clearGamePacks).toHaveBeenCalledTimes(1);
      expect(gameAnalytics.clearArchive).toHaveBeenCalledTimes(1);
      expect(analytics.logEvent).toHaveBeenCalledWith('puzzle_storage_cleared', {
        files_count: 5,
        size_mb: 0,
      });
      expect(page.totalFiles).toBe(0);
      expect(el().textContent).toContain('STORAGE.empty');
    });

    it('si se cancela no borra nada de nada', async () => {
      paquetes = [PAQUETE];
      await crear();
      responderConfirmacion('cancel');

      await page.confirmDeleteAll();

      expect(puzzleStorage.deleteAll).not.toHaveBeenCalled();
      expect(games.clearGamePacks).not.toHaveBeenCalled();
      expect(gameAnalytics.clearArchive).not.toHaveBeenCalled();
      expect(page.totalFiles).toBe(4);
    });
  });

  describe('navegación', () => {
    it('"Home" del encabezado vuelve al inicio y "Ajustes" a /settings', async () => {
      await crear();
      const enlaces = Array.from(el().querySelectorAll('a'));

      enlaces.find((a) => (a.textContent ?? '').includes('MENU.navigation.home'))?.click();
      enlaces.find((a) => (a.textContent ?? '').includes('SETTINGS.title'))?.click();

      expect(router.navigate).toHaveBeenNthCalledWith(1, ['/home']);
      expect(router.navigate).toHaveBeenNthCalledWith(2, ['/settings']);
    });
  });
});
