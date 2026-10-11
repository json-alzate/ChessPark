import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';

import { GameCollectionInfo } from '@chesspark/games-provider';

import { GamesPage } from '@features/games/pages/games.page';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { GamesService } from '@features/games/services/games.service';

import { StubNavbar, sustituirImports, textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const petrosian: GameCollectionInfo = {
  id: 'petrosian',
  name: 'Tigran Petrosian',
  reign: '1963–1969',
  games: 120,
  sizeBytes: 2 * 1024 * 1024,
  file: 'players/petrosian.pgn',
};
const fischer: GameCollectionInfo = {
  id: 'fischer',
  name: 'Bobby Fischer',
  reign: '1972–1975',
  games: 80,
  sizeBytes: 300 * 1024,
  file: 'players/fischer.pgn',
};

describe('GamesPage', () => {
  let fixture: ComponentFixture<GamesPage>;
  let page: GamesPage;
  let router: { navigate: jest.Mock };
  let gamesService: {
    getCatalog: jest.Mock;
    getDownloadedIds: jest.Mock;
    download: jest.Mock;
    openUserPgn: jest.Mock;
  };
  let analytics: { logEvent: jest.Mock };
  let alerta: { present: jest.Mock };
  let alertController: { create: jest.Mock };

  const texto = () => textoDe(fixture.nativeElement);

  async function abrir() {
    fixture = TestBed.createComponent(GamesPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    router = { navigate: jest.fn() };
    gamesService = {
      getCatalog: jest.fn().mockResolvedValue([petrosian, fischer]),
      getDownloadedIds: jest.fn().mockResolvedValue(['petrosian']),
      download: jest.fn().mockResolvedValue(undefined),
      openUserPgn: jest.fn().mockReturnValue({ title: 'x' }),
    };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    alerta = { present: jest.fn().mockResolvedValue(undefined) };
    alertController = { create: jest.fn().mockResolvedValue(alerta) };

    sustituirImports(GamesPage, [[NavbarComponent, StubNavbar]]);
    await TestBed.configureTestingModule({
      imports: [GamesPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        { provide: GamesService, useValue: gamesService },
        { provide: AnalyticsService, useValue: analytics },
        { provide: AlertController, useValue: alertController },
      ],
    }).compileComponents();
  });

  describe('catálogo', () => {
    it('separa lo descargado en el dispositivo de lo disponible para bajar', async () => {
      await abrir();
      expect(page.downloadedRows.map((r) => r.collection.id)).toEqual(['petrosian']);
      expect(page.availableRows.map((r) => r.collection.id)).toEqual(['fischer']);
      expect(texto()).toContain('GAMES.onDevice');
      expect(texto()).toContain('GAMES.worldChampions');
    });

    it('muestra nombre, reinado, número de partidas y tamaño legible de lo que se puede descargar', async () => {
      await abrir();
      expect(texto()).toContain('Bobby Fischer');
      expect(texto()).toContain('1972–1975');
      expect(texto()).toContain('GAMES.gamesCount');
      expect(texto()).toContain('300 KB');
    });

    it('lo descargado muestra su tamaño en MB', async () => {
      await abrir();
      expect(texto()).toContain('2,0 MB');
    });

    it('registra la apertura con el número de colecciones descargadas', async () => {
      await abrir();
      expect(analytics.logEvent).toHaveBeenCalledWith('games_catalog_opened', { downloaded_count: 1 });
    });

    it('si no hay nada descargado no muestra la sección "en tu dispositivo"', async () => {
      gamesService.getDownloadedIds.mockResolvedValue([]);
      await abrir();
      expect(texto()).not.toContain('GAMES.onDevice');
      expect(page.availableRows).toHaveLength(2);
    });

    it('si todo está descargado no muestra la sección de campeones', async () => {
      gamesService.getDownloadedIds.mockResolvedValue(['petrosian', 'fischer']);
      await abrir();
      expect(texto()).not.toContain('GAMES.worldChampions');
    });

    it('sin catálogo ni conexión avisa de que no está disponible', async () => {
      gamesService.getCatalog.mockResolvedValue([]);
      await abrir();
      expect(page.offline).toBe(true);
      expect(texto()).toContain('GAMES.catalogUnavailable');
    });

    it('si falla la carga también avisa y deja de cargar', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      gamesService.getCatalog.mockRejectedValue(new Error('sin red'));
      await abrir();
      expect(page.offline).toBe(true);
      expect(page.loading).toBe(false);
      jest.restoreAllMocks();
    });

    it('el botón de actualizar vuelve a pedir el catálogo forzando la red', async () => {
      await abrir();
      gamesService.getCatalog.mockClear();
      fixture.nativeElement.querySelector('button.btn-circle').click();
      expect(gamesService.getCatalog).toHaveBeenCalledWith({ forceRefresh: true });
    });

    it('al volver a la pantalla ya no muestra como descargado un paquete que se borró', async () => {
      await abrir();
      expect(page.downloadedRows.map((r) => r.collection.id)).toEqual(['petrosian']);

      gamesService.getDownloadedIds.mockResolvedValue([]);
      await page.ionViewWillEnter();
      fixture.detectChanges();

      expect(page.downloadedRows).toHaveLength(0);
      expect(page.availableRows).toHaveLength(2);
      expect(texto()).not.toContain('GAMES.onDevice');
    });

    it('abrir una colección descargada navega a su reproductor', async () => {
      await abrir();
      fixture.nativeElement.querySelector('button.text-left').click();
      expect(router.navigate).toHaveBeenCalledWith(['/games', 'petrosian']);
    });

    it('el enlace de inicio navega a /home', async () => {
      await abrir();
      fixture.nativeElement.querySelector('.breadcrumbs a').click();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('descarga de un paquete', () => {
    it('muestra el avance mientras baja y al terminar la mueve a "en tu dispositivo"', async () => {
      let avanzar!: (fraction: number | null) => void;
      let terminar!: () => void;
      gamesService.download.mockImplementation(
        (_c: unknown, onProgress: typeof avanzar) =>
          new Promise<void>((resolve) => {
            avanzar = onProgress;
            terminar = resolve;
          })
      );
      await abrir();
      const fila = page.availableRows[0];
      const promesa = page.download(fila);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button.btn-primary.btn-circle')).toBeNull();

      avanzar(0.456);
      fixture.detectChanges();
      expect(page.progressPercent(fila)).toBe(46);
      expect(texto()).toContain('46%');

      terminar();
      await promesa;
      fixture.detectChanges();
      expect(fila.downloaded).toBe(true);
      expect(fila.progress).toBeUndefined();
      expect(page.downloadedRows.map((r) => r.collection.id)).toEqual(['petrosian', 'fischer']);
    });

    it('con avance indeterminado muestra un indicador de carga, no un porcentaje', async () => {
      let avanzar!: (fraction: number | null) => void;
      gamesService.download.mockImplementation(
        (_c: unknown, onProgress: typeof avanzar) => {
          avanzar = onProgress;
          return new Promise<void>(() => undefined);
        }
      );
      await abrir();
      void page.download(page.availableRows[0]);
      avanzar(null);
      fixture.detectChanges();
      expect(page.progressPercent(page.availableRows[0])).toBeNull();
      expect(fixture.nativeElement.querySelector('.loading-spinner')).not.toBeNull();
    });

    it('pide el paquete de esa colección', async () => {
      await abrir();
      await page.download(page.availableRows[0]);
      expect(gamesService.download).toHaveBeenCalledWith(fischer, expect.any(Function));
    });

    it('si la descarga falla lo avisa y permite reintentar', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      gamesService.download.mockRejectedValueOnce(new Error('corte'));
      await abrir();
      const fila = page.availableRows[0];
      await page.download(fila);
      fixture.detectChanges();
      expect(fila.failed).toBe(true);
      expect(fila.downloaded).toBe(false);
      expect(fila.progress).toBeUndefined();
      expect(texto()).toContain('GAMES.downloadFailed');

      await page.download(fila);
      expect(fila.failed).toBe(false);
      expect(fila.downloaded).toBe(true);
      jest.restoreAllMocks();
    });

    it('ignora un segundo clic mientras ya está descargando', async () => {
      gamesService.download.mockReturnValue(new Promise<void>(() => undefined));
      await abrir();
      const fila = page.availableRows[0];
      void page.download(fila);
      await page.download(fila);
      expect(gamesService.download).toHaveBeenCalledTimes(1);
    });
  });

  describe('PGN propio', () => {
    const escribir = (pgn: string) => {
      page.pastedPgn = pgn;
    };

    it('el formulario está oculto hasta pulsar "PGN propio"', async () => {
      await abrir();
      expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
      page.togglePasteForm();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
      page.togglePasteForm();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    });

    it('el botón de abrir está deshabilitado mientras no haya texto', async () => {
      await abrir();
      page.togglePasteForm();
      fixture.detectChanges();
      const abrirBtn = () => fixture.nativeElement.querySelector('button.btn-primary:not(.btn-circle)') as HTMLButtonElement;
      expect(abrirBtn().disabled).toBe(true);

      const area: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
      area.value = '1. e4 e5';
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(abrirBtn().disabled).toBe(false);
    });

    it('un PGN válido se abre en el reproductor y se limpia el formulario', async () => {
      await abrir();
      page.togglePasteForm();
      escribir('1. e4 e5');
      await page.openPastedPgn();
      expect(gamesService.openUserPgn).toHaveBeenCalledWith('1. e4 e5', 'GAMES.ownPgnTitle');
      expect(router.navigate).toHaveBeenCalledWith(['/games/pgn']);
      expect(page.showPasteForm).toBe(false);
      expect(page.pastedPgn).toBe('');
    });

    it('un PGN inválido muestra una alerta y no navega', async () => {
      gamesService.openUserPgn.mockReturnValue(null);
      await abrir();
      escribir('basura');
      await page.openPastedPgn();
      expect(alertController.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'GAMES.invalidPgnTitle', message: 'GAMES.invalidPgnMessage' })
      );
      expect(alerta.present).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('un texto vacío o en blanco no hace nada', async () => {
      await abrir();
      escribir('   \n ');
      await page.openPastedPgn();
      expect(gamesService.openUserPgn).not.toHaveBeenCalled();
      expect(alertController.create).not.toHaveBeenCalled();
    });

    describe('archivo .pgn', () => {
      const evento = (file?: { name: string; text: () => Promise<string> }) => {
        const input = { files: file ? [file] : [], value: 'C:\\x.pgn' };
        return { event: { target: input } as unknown as Event, input };
      };

      it('lee el archivo y lo abre usando su nombre sin la extensión como título', async () => {
        await abrir();
        const { event, input } = evento({ name: 'Mis partidas.PGN', text: async () => '1. d4 d5' });
        await page.onFileSelected(event);
        expect(gamesService.openUserPgn).toHaveBeenCalledWith('1. d4 d5', 'Mis partidas');
        expect(router.navigate).toHaveBeenCalledWith(['/games/pgn']);
        expect(input.value).toBe('');
      });

      it('si no se eligió archivo no hace nada', async () => {
        await abrir();
        await page.onFileSelected(evento().event);
        expect(gamesService.openUserPgn).not.toHaveBeenCalled();
      });

      it('si el archivo no se puede leer muestra la alerta de PGN inválido', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await abrir();
        const { event, input } = evento({
          name: 'roto.pgn',
          text: async () => {
            throw new Error('lectura');
          },
        });
        await page.onFileSelected(event);
        expect(alertController.create).toHaveBeenCalledWith(
          expect.objectContaining({ header: 'GAMES.invalidPgnTitle' })
        );
        expect(input.value).toBe('');
        jest.restoreAllMocks();
      });
    });
  });
});
