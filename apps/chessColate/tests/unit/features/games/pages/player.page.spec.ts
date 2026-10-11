import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';

import { GameCollectionInfo, GameHeader } from '@chesspark/games-provider';

import { GamesPlayerPage } from '@app/features/games/pages/player.page';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { GamesService } from '@features/games/services/games.service';

import { StubNavbar, sustituirImports, textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const petrosian: GameCollectionInfo = {
  id: 'petrosian',
  name: 'Tigran Petrosian',
  reign: '1963–1969',
  games: 5,
  sizeBytes: 1000,
  file: 'players/petrosian.pgn',
};

function cabecera(index: number, overrides: Partial<GameHeader> = {}): GameHeader {
  return {
    index,
    white: 'Petrosian, Tigran V',
    black: `Rival ${index}`,
    event: 'Torneo',
    date: '1963.05.20',
    year: 1963,
    result: '1-0',
    whiteElo: null,
    blackElo: null,
    plies: 40,
    timeControl: null,
    timeClass: null,
    ...overrides,
  };
}

/** Cinco partidas con resultados y colores variados. */
const cabeceras: GameHeader[] = [
  cabecera(0, { result: '1-0' }), // gana con blancas
  cabecera(1, { result: '1/2-1/2' }), // tablas con blancas
  cabecera(2, { white: 'Botvinnik, Mikhail', black: 'Petrosian, Tigran V', result: '1-0' }), // pierde con negras
  cabecera(3, { white: 'Spassky, Boris', black: 'Petrosian, Tigran V', result: '0-1' }), // gana con negras
  cabecera(4, { white: 'Petrosian, Tigran V', black: 'Fischer, Robert', result: '0-1' }), // pierde con blancas
];

describe('GamesPlayerPage', () => {
  let fixture: ComponentFixture<GamesPlayerPage>;
  let page: GamesPlayerPage;
  let router: { navigate: jest.Mock };
  let gamesService: {
    getCollection: jest.Mock;
    openCollection: jest.Mock;
    deletePack: jest.Mock;
    currentPack: unknown;
  };
  let analytics: { logEvent: jest.Mock };
  let alerta: { present: jest.Mock };
  let alertController: { create: jest.Mock };
  let id: string | null;

  const texto = () => textoDe(fixture.nativeElement);
  const filas = () => fixture.nativeElement.querySelectorAll('button.text-left') as NodeListOf<HTMLButtonElement>;
  const boton = (fragmento: string) =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes(fragmento)
    );

  /** Crea la pantalla y arranca ngOnInit sin esperar a que termine. */
  function crear() {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
    });
    fixture = TestBed.createComponent(GamesPlayerPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function abrir() {
    crear();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    id = 'petrosian';
    router = { navigate: jest.fn() };
    gamesService = {
      getCollection: jest.fn().mockResolvedValue(petrosian),
      openCollection: jest.fn().mockResolvedValue({ collection: petrosian, headers: cabeceras }),
      deletePack: jest.fn().mockResolvedValue(undefined),
      currentPack: null,
    };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    alerta = { present: jest.fn().mockResolvedValue(undefined) };
    alertController = { create: jest.fn().mockResolvedValue(alerta) };

    sustituirImports(GamesPlayerPage, [[NavbarComponent, StubNavbar]]);
    await TestBed.configureTestingModule({
      imports: [GamesPlayerPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
        { provide: GamesService, useValue: gamesService },
        { provide: AnalyticsService, useValue: analytics },
        { provide: AlertController, useValue: alertController },
      ],
    }).compileComponents();
  });

  describe('colección del catálogo', () => {
    it('abre la colección por el id de la ruta y lista sus partidas', async () => {
      await abrir();
      expect(gamesService.getCollection).toHaveBeenCalledWith('petrosian');
      expect(gamesService.openCollection).toHaveBeenCalledWith(petrosian, expect.any(Function));
      expect(texto()).toContain('Tigran Petrosian');
      expect(texto()).toContain('GAMES.championOf');
      expect(filas()).toHaveLength(5);
      expect(textoDe(filas()[0])).toContain('Petrosian, Tigran V – Rival 0');
      expect(textoDe(filas()[0])).toContain('1-0');
    });

    it('si el id no existe vuelve al catálogo', async () => {
      gamesService.getCollection.mockResolvedValue(null);
      await abrir();
      expect(router.navigate).toHaveBeenCalledWith(['/games']);
      expect(gamesService.openCollection).not.toHaveBeenCalled();
    });

    it('muestra el avance de la primera descarga mientras carga', async () => {
      let avanzar!: (f: number) => void;
      let terminar!: (pack: unknown) => void;
      gamesService.openCollection.mockImplementation(
        (_c: unknown, onProgress: typeof avanzar) =>
          new Promise((resolve) => {
            avanzar = onProgress;
            terminar = resolve;
          })
      );
      crear();
      await Promise.resolve();
      await Promise.resolve();
      avanzar(0.5);
      fixture.detectChanges();
      expect(page.loading).toBe(true);
      expect(page.progress).toBe(0.5);
      expect(texto()).toContain('GAMES.downloading');
      expect(texto()).toContain('50%');

      terminar({ collection: petrosian, headers: cabeceras });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(page.loading).toBe(false);
      expect(page.progress).toBeNull();
    });

    it('si falla la apertura muestra el error y deja de cargar', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      gamesService.openCollection.mockRejectedValue(new Error('disco'));
      await abrir();
      expect(page.error).toBe(true);
      expect(page.loading).toBe(false);
      expect(texto()).toContain('GAMES.openFailed');
      expect(filas()).toHaveLength(0);
      jest.restoreAllMocks();
    });

    it('un clic en una partida abre el visor en su índice', async () => {
      await abrir();
      filas()[2].click();
      expect(router.navigate).toHaveBeenCalledWith(['/games/viewer'], { queryParams: { index: 2 } });
    });

    it('los enlaces de migas llevan a inicio y al catálogo', async () => {
      await abrir();
      const enlaces = fixture.nativeElement.querySelectorAll('.breadcrumbs a');
      enlaces[0].click();
      enlaces[1].click();
      expect(router.navigate).toHaveBeenNthCalledWith(1, ['/home']);
      expect(router.navigate).toHaveBeenNthCalledWith(2, ['/games']);
    });
  });

  describe('filtros', () => {
    const indices = () => page.visibleGames.map((g) => g.index);

    it('por resultado: ganadas', async () => {
      await abrir();
      boton('GAMES.filters.won')?.click();
      expect(indices()).toEqual([0, 3]);
    });

    it('por resultado: tablas', async () => {
      await abrir();
      boton('GAMES.filters.drawn')?.click();
      expect(indices()).toEqual([1]);
    });

    it('por color: blancas y negras', async () => {
      await abrir();
      boton('GAMES.filters.white')?.click();
      expect(indices()).toEqual([0, 1, 4]);
      boton('GAMES.filters.black')?.click();
      expect(indices()).toEqual([2, 3]);
    });

    it('los filtros de resultado y color se combinan', async () => {
      await abrir();
      boton('GAMES.filters.won')?.click();
      boton('GAMES.filters.black')?.click();
      expect(indices()).toEqual([3]);
    });

    it('"Todas" quita los dos filtros', async () => {
      await abrir();
      boton('GAMES.filters.won')?.click();
      boton('GAMES.filters.black')?.click();
      boton('GAMES.filters.all')?.click();
      expect(indices()).toEqual([0, 1, 2, 3, 4]);
    });

    it('la búsqueda por rival filtra al escribir', async () => {
      await abrir();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=text]');
      input.value = 'fisch';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(indices()).toEqual([4]);
      expect(filas()).toHaveLength(1);
    });

    it('sin coincidencias muestra el aviso y deshabilita el modo TV', async () => {
      await abrir();
      page.filters.opponent = 'nadie';
      page.applyFilters();
      fixture.detectChanges();
      expect(texto()).toContain('GAMES.noGamesMatch');
      expect(filas()).toHaveLength(0);
      expect((boton('GAMES.watchTv') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('paginación', () => {
    const muchas = Array.from({ length: 95 }, (_, i) => cabecera(i));

    beforeEach(() => {
      gamesService.openCollection.mockResolvedValue({ collection: petrosian, headers: muchas });
    });

    it('pinta 40 filas y crece de 40 en 40 con "ver más"', async () => {
      await abrir();
      expect(filas()).toHaveLength(40);
      boton('GAMES.showMore')?.click();
      fixture.detectChanges();
      expect(filas()).toHaveLength(80);
      boton('GAMES.showMore')?.click();
      fixture.detectChanges();
      expect(filas()).toHaveLength(95);
      expect(boton('GAMES.showMore')).toBeUndefined();
    });

    it('al cambiar un filtro vuelve a la primera página', async () => {
      await abrir();
      page.showMore();
      expect(page.shownCount).toBe(80);
      page.setResultFilter('won');
      expect(page.shownCount).toBe(40);
    });
  });

  describe('modo TV', () => {
    it('arranca en la primera partida visible y lo registra', async () => {
      await abrir();
      boton('GAMES.filters.black')?.click();
      boton('GAMES.watchTv')?.click();
      expect(router.navigate).toHaveBeenCalledWith(['/games/viewer'], { queryParams: { index: 2, tv: 1 } });
      expect(analytics.logEvent).toHaveBeenCalledWith('games_tv_started', {
        player: 'petrosian',
        games_count: 2,
      });
    });

    it('sin partidas visibles no arranca', async () => {
      await abrir();
      page.filters.opponent = 'nadie';
      page.applyFilters();
      page.startTv();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('borrar el paquete', () => {
    it('pide confirmación con el nombre del jugador antes de borrar', async () => {
      await abrir();
      fixture.nativeElement.querySelector('button.btn-circle').click();
      await fixture.whenStable();
      const opciones = alertController.create.mock.calls[0][0];
      expect(opciones.header).toBe('GAMES.deletePackTitle');
      expect(opciones.buttons.map((b: { role: string }) => b.role)).toEqual(['cancel', 'destructive']);
      expect(alerta.present).toHaveBeenCalled();
      expect(gamesService.deletePack).not.toHaveBeenCalled();
    });

    it('al confirmar borra el paquete y vuelve al catálogo', async () => {
      await abrir();
      await page.confirmDelete();
      const destructivo = alertController.create.mock.calls[0][0].buttons[1];
      destructivo.handler();
      await fixture.whenStable();
      expect(gamesService.deletePack).toHaveBeenCalledWith('petrosian');
      expect(router.navigate).toHaveBeenCalledWith(['/games']);
    });
  });

  describe('PGN propio (sin id en la ruta)', () => {
    beforeEach(() => {
      id = null;
    });

    it('usa el paquete ya abierto en el servicio, sin tocar el catálogo', async () => {
      gamesService.currentPack = {
        collection: { ...petrosian, id: 'own-pgn', name: 'Mi PGN', reign: '' },
        headers: cabeceras.slice(0, 2),
      };
      await abrir();
      expect(page.isUserPgn).toBe(true);
      expect(gamesService.getCollection).not.toHaveBeenCalled();
      expect(texto()).toContain('Mi PGN');
      expect(filas()).toHaveLength(2);
    });

    it('no ofrece borrar el paquete', async () => {
      gamesService.currentPack = { collection: petrosian, headers: cabeceras };
      await abrir();
      expect(fixture.nativeElement.querySelector('button.btn-circle')).toBeNull();
      await page.confirmDelete();
      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('registra el modo TV como "own_pgn" cuando el paquete no tiene id propio', async () => {
      gamesService.currentPack = { collection: null, headers: cabeceras };
      await abrir();
      page.startTv();
      expect(analytics.logEvent).toHaveBeenCalledWith('games_tv_started', {
        player: 'own_pgn',
        games_count: 5,
      });
    });

    it('si no hay ningún PGN abierto vuelve al catálogo', async () => {
      gamesService.currentPack = null;
      await abrir();
      expect(router.navigate).toHaveBeenCalledWith(['/games']);
    });
  });
});
