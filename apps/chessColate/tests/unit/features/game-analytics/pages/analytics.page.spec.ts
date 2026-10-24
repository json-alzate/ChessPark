// AppearanceService (rey de la ventana de color) arrastra la librería del tablero, que Jest
// no sabe cargar; en esta pantalla no se dibuja ningún tablero.
jest.mock('@chesspark/board', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { ChessGame } from '@chesspark/models';
import { PlanFacadeService } from '@chesspark/state';

import { AnalyticsPage } from '@features/game-analytics/pages/analytics.page';
import { ActivityHeatmapComponent } from '@features/game-analytics/components/activity-heatmap/activity-heatmap.component';
import { RatingChartComponent } from '@features/game-analytics/components/rating-chart/rating-chart.component';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@core/analytics/analytics.service';
import {
  GameAnalyticsService,
  UnknownUsernameError,
} from '@features/game-analytics/services/game-analytics.service';
import { AppService } from '@core/app/app.service';
import { GamesService } from '@features/games/services/games.service';
import { CustomPlansService } from '@features/training/services/custom-plans.service';
import { PlanService } from '@features/training/services/plan.service';
import { ProfileService } from '@core/account/profile.service';

import {
  appearanceDouble,
  StubActivityHeatmap,
  StubNavbar,
  StubRatingChart,
  sustituirImports,
  textoDe,
  translocoTesting,
} from '@tests/support/analisis-juegos';

let siguienteId = 0;
function partida(overrides: Partial<ChessGame> = {}): ChessGame {
  siguienteId += 1;
  return {
    id: `g${siguienteId}`,
    source: 'chess.com',
    pgn: '1. e4 e5',
    timeControl: '300',
    timeControlSeconds: 300,
    incrementSeconds: 0,
    timeClass: 'blitz',
    playedAt: Date.UTC(2026, 0, siguienteId),
    white: { username: 'yo', rating: 1500 },
    black: { username: `rival${siguienteId}`, rating: 1480 },
    result: '1-0',
    userColor: 'white',
    opening: { eco: 'B20', name: 'Sicilian Defense' },
    variant: 'standard',
    analyzed: false,
    ...overrides,
  };
}

const SIN_CUENTAS = { accounts: { chesscom: '', lichess: '' }, historyMonths: 6 };
const CON_CHESSCOM = { accounts: { chesscom: 'yo', lichess: '' }, historyMonths: 6 };

describe('AnalyticsPage', () => {
  let fixture: ComponentFixture<AnalyticsPage>;
  let page: AnalyticsPage;

  let router: { navigate: jest.Mock };
  let alerta: { present: jest.Mock; onDidDismiss: jest.Mock };
  let alertController: { create: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let gameAnalytics: {
    getSettings: jest.Mock;
    saveSettings: jest.Mock;
    loadStored: jest.Mock;
    sync: jest.Mock;
    verifyUsername: jest.Mock;
    disconnect: jest.Mock;
  };
  let gamesService: { openOwnGames: jest.Mock };
  let appService: { getOpeningsList: unknown[]; loadOpenings: jest.Mock };
  let planService: { makeCustomPlanForPlay: jest.Mock };
  let customPlans: { save: jest.Mock };
  let planFacade: { clearPlan: jest.Mock; setPlan: jest.Mock };
  let queryTab: string | null;

  const texto = () => textoDe(fixture.nativeElement);
  const botones = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));
  const botonCon = (fragmento: string) => botones().find((b) => textoDe(b).includes(fragmento));

  async function abrir() {
    fixture = TestBed.createComponent(AnalyticsPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function dejarCorrer() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    siguienteId = 0;
    queryTab = null;
    router = { navigate: jest.fn().mockResolvedValue(true) };
    alerta = {
      present: jest.fn().mockResolvedValue(undefined),
      onDidDismiss: jest.fn().mockResolvedValue({ role: 'destructive' }),
    };
    alertController = { create: jest.fn().mockResolvedValue(alerta) };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    gameAnalytics = {
      getSettings: jest.fn().mockReturnValue(SIN_CUENTAS),
      saveSettings: jest.fn(),
      loadStored: jest.fn().mockResolvedValue([]),
      sync: jest.fn().mockResolvedValue([]),
      verifyUsername: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(SIN_CUENTAS),
    };
    gamesService = { openOwnGames: jest.fn() };
    appService = { getOpeningsList: [], loadOpenings: jest.fn().mockResolvedValue(undefined) };
    planService = {
      makeCustomPlanForPlay: jest.fn().mockImplementation(async (plan) => ({ ...plan, played: true })),
    };
    customPlans = { save: jest.fn().mockResolvedValue(undefined) };
    planFacade = { clearPlan: jest.fn(), setPlan: jest.fn() };

    sustituirImports(AnalyticsPage, [
      [NavbarComponent, StubNavbar],
      [RatingChartComponent, StubRatingChart],
      [ActivityHeatmapComponent, StubActivityHeatmap],
    ]);

    await TestBed.configureTestingModule({
      imports: [AnalyticsPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => queryTab } } },
        },
        { provide: AlertController, useValue: alertController },
        { provide: AnalyticsService, useValue: analytics },
        { provide: GameAnalyticsService, useValue: gameAnalytics },
        { provide: GamesService, useValue: gamesService },
        { provide: AppService, useValue: appService },
        { provide: PlanService, useValue: planService },
        { provide: CustomPlansService, useValue: customPlans },
        { provide: ProfileService, useValue: { getProfile: { uid: 'u1' } } },
        { provide: PlanFacadeService, useValue: planFacade },
        appearanceDouble(),
      ],
    }).compileComponents();
  });

  describe('sin cuentas conectadas', () => {
    it('muestra el formulario de conexión y no descarga nada', async () => {
      await abrir();
      expect(texto()).toContain('ANALYTICS.connect.title');
      expect(fixture.nativeElement.querySelectorAll('input[type=text]')).toHaveLength(2);
      expect(gameAnalytics.loadStored).not.toHaveBeenCalled();
      expect(gameAnalytics.sync).not.toHaveBeenCalled();
    });

    it('el botón de conectar sigue deshabilitado hasta escribir un usuario', async () => {
      await abrir();
      const conectar = () => botonCon('ANALYTICS.connect.action') as HTMLButtonElement;
      expect(conectar().disabled).toBe(true);

      const [chesscom] = fixture.nativeElement.querySelectorAll('input[type=text]');
      chesscom.value = 'magnus';
      chesscom.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(conectar().disabled).toBe(false);
    });

    it('registra que se abrió la pantalla con 0 cuentas', async () => {
      await abrir();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_analytics_opened', {
        connected: 0,
        games_count: 0,
      });
    });

    it('pide cargar el catálogo de aperturas solo si aún no está', async () => {
      await abrir();
      expect(appService.loadOpenings).toHaveBeenCalledTimes(1);
    });

    it('no vuelve a pedir el catálogo si ya lo tiene', async () => {
      appService.getOpeningsList = [{ value: 'x', nameEn: 'X', nameEs: 'X' }];
      await abrir();
      expect(appService.loadOpenings).not.toHaveBeenCalled();
    });

    it('elegir un rango en el formulario lo deja marcado', async () => {
      await abrir();
      botonCon('ANALYTICS.connect.months')?.click();
      expect(page.historyMonths).toBe(3);
    });
  });

  describe('conectar una cuenta', () => {
    beforeEach(async () => {
      await abrir();
      page.chesscomInput = '  magnus ';
      page.lichessInput = '';
    });

    it('verifica el usuario, guarda las cuentas (sin espacios) y descarga', async () => {
      gameAnalytics.sync.mockResolvedValue([partida()]);
      await page.connect();

      expect(gameAnalytics.verifyUsername).toHaveBeenCalledWith('chess.com', 'magnus');
      expect(gameAnalytics.saveSettings).toHaveBeenCalledWith({
        accounts: { chesscom: 'magnus', lichess: '' },
        historyMonths: 6,
      });
      expect(gameAnalytics.sync).toHaveBeenCalledWith(
        { chesscom: 'magnus', lichess: '' },
        6,
        expect.any(Function)
      );
      expect(analytics.logEvent).toHaveBeenCalledWith('game_analytics_connected', {
        platforms: 'chesscom',
        history_months: 6,
      });
      expect(page.hasAccounts).toBe(true);
    });

    it('con las dos plataformas las verifica ambas y las reporta juntas', async () => {
      page.lichessInput = 'drnykterstein';
      await page.connect();
      expect(gameAnalytics.verifyUsername).toHaveBeenCalledWith('lichess', 'drnykterstein');
      expect(analytics.logEvent).toHaveBeenCalledWith(
        'game_analytics_connected',
        expect.objectContaining({ platforms: 'chesscom+lichess' })
      );
    });

    it('si el usuario no existe avisa con una alerta y no guarda ni descarga', async () => {
      gameAnalytics.verifyUsername.mockResolvedValue(false);
      await page.connect();

      expect(alertController.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'ANALYTICS.errors.unknownUserTitle' })
      );
      expect(alerta.present).toHaveBeenCalled();
      expect(gameAnalytics.saveSettings).not.toHaveBeenCalled();
      expect(gameAnalytics.sync).not.toHaveBeenCalled();
      expect(page.hasAccounts).toBe(false);
      expect(page.verifying).toBe(false);
    });

    it('si falla la segunda cuenta tampoco guarda la primera', async () => {
      page.lichessInput = 'noexiste';
      gameAnalytics.verifyUsername.mockImplementation(async (platform: string) => platform === 'chess.com');
      await page.connect();
      expect(gameAnalytics.saveSettings).not.toHaveBeenCalled();
    });

    it('sin nada escrito no hace nada', async () => {
      page.chesscomInput = '   ';
      await page.connect();
      expect(gameAnalytics.verifyUsername).not.toHaveBeenCalled();
    });

    it('ignora un segundo clic mientras verifica', async () => {
      let resolver!: (v: boolean) => void;
      gameAnalytics.verifyUsername.mockReturnValue(new Promise<boolean>((r) => (resolver = r)));
      const primera = page.connect();
      await page.connect();
      expect(gameAnalytics.verifyUsername).toHaveBeenCalledTimes(1);
      resolver(true);
      await primera;
    });
  });

  describe('con cuentas guardadas', () => {
    const partidas = [
      partida({ timeClass: 'blitz', source: 'chess.com' }),
      partida({ timeClass: 'rapid', source: 'lichess', result: '0-1' }),
      partida({ timeClass: 'blitz', source: 'chess.com', result: '1/2-1/2' }),
    ];

    beforeEach(() => {
      gameAnalytics.getSettings.mockReturnValue(CON_CHESSCOM);
      gameAnalytics.loadStored.mockResolvedValue(partidas);
      gameAnalytics.sync.mockResolvedValue(partidas);
    });

    it('pinta primero lo guardado en el dispositivo y luego sincroniza', async () => {
      await abrir();
      expect(gameAnalytics.loadStored).toHaveBeenCalledWith(CON_CHESSCOM.accounts, 6);
      expect(gameAnalytics.sync).toHaveBeenCalledTimes(1);
      expect(gameAnalytics.loadStored.mock.invocationCallOrder[0]).toBeLessThan(
        gameAnalytics.sync.mock.invocationCallOrder[0]
      );
    });

    it('muestra las cifras generales del reporte', async () => {
      await abrir();
      expect(page.stats?.games).toBe(3);
      const celdas = Array.from<Element>(fixture.nativeElement.querySelectorAll('.font-mono')).map(textoDe);
      expect(celdas).toContain('3'); // partidas
      expect(celdas).toContain('50%'); // 1 victoria + 1 tablas (media) de 3 = 50 %
    });

    it('registra que se abrió con la cuenta y el número de partidas', async () => {
      await abrir();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_analytics_opened', {
        connected: 1,
        games_count: 3,
      });
    });

    it('no muestra el formulario de conexión y lista las cuentas conectadas', async () => {
      await abrir();
      expect(texto()).not.toContain('ANALYTICS.connect.title');
      expect(page.connectedList).toEqual([{ platform: 'chess.com', username: 'yo' }]);
      expect(texto()).toContain('Chess.com');
    });

    it('ionViewWillEnter vuelve a sincronizar', async () => {
      await abrir();
      gameAnalytics.sync.mockClear();
      page.ionViewWillEnter();
      expect(gameAnalytics.sync).toHaveBeenCalledTimes(1);
    });

    it('ionViewWillEnter no sincroniza si no hay cuentas', async () => {
      gameAnalytics.getSettings.mockReturnValue(SIN_CUENTAS);
      await abrir();
      page.ionViewWillEnter();
      expect(gameAnalytics.sync).not.toHaveBeenCalled();
    });

    it('si la descarga no trae partidas, muestra el estado vacío', async () => {
      gameAnalytics.loadStored.mockResolvedValue([]);
      gameAnalytics.sync.mockResolvedValue([]);
      await abrir();
      expect(texto()).toContain('ANALYTICS.noGames');
      expect(page.stats).toBeNull();
    });

    it('muestra el avance y la etiqueta de la descarga en curso', async () => {
      let avanzar!: (p: { done: number; total: number; platform: string; monthKey: string }) => void;
      let terminar!: (games: ChessGame[]) => void;
      gameAnalytics.sync.mockImplementation(
        (_a: unknown, _m: number, onProgress: typeof avanzar) =>
          new Promise<ChessGame[]>((resolve) => {
            avanzar = onProgress;
            terminar = resolve;
          })
      );
      await abrir();
      expect(page.syncing).toBe(true);

      avanzar({ done: 1, total: 4, platform: 'lichess', monthKey: '2026-03' });
      fixture.detectChanges();
      expect(page.progressPercent).toBe(25);
      expect(texto()).toContain('25%');
      expect(texto()).toContain('Lichess · 2026-03');

      terminar(partidas);
      await dejarCorrer();
      expect(page.syncing).toBe(false);
      expect(texto()).not.toContain('Lichess · 2026-03');
    });

    it('no lanza dos descargas a la vez', async () => {
      let terminar!: (games: ChessGame[]) => void;
      gameAnalytics.sync.mockReturnValue(new Promise<ChessGame[]>((r) => (terminar = r)));
      await abrir();
      void page.sync();
      expect(gameAnalytics.sync).toHaveBeenCalledTimes(1);
      terminar([]);
      await dejarCorrer();
    });

    describe('errores de descarga', () => {
      beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
      });
      afterEach(() => jest.restoreAllMocks());

      it('un usuario desconocido se explica con la plataforma', async () => {
        gameAnalytics.sync.mockRejectedValue(new UnknownUsernameError('lichess'));
        await abrir();
        expect(page.errorMessage).toBe('ANALYTICS.errors.unknownUser');
        expect(texto()).toContain('ANALYTICS.errors.unknownUser');
        expect(page.syncing).toBe(false);
      });

      it('cualquier otro fallo muestra el mensaje genérico', async () => {
        gameAnalytics.sync.mockRejectedValue(new Error('sin red'));
        await abrir();
        expect(page.errorMessage).toBe('ANALYTICS.errors.syncFailed');
        expect(texto()).toContain('ANALYTICS.errors.syncFailed');
      });

      it('al reintentar con éxito el mensaje desaparece', async () => {
        gameAnalytics.sync.mockRejectedValueOnce(new Error('sin red'));
        await abrir();
        await page.sync();
        fixture.detectChanges();
        expect(page.errorMessage).toBe('');
        expect(texto()).not.toContain('ANALYTICS.errors.syncFailed');
      });
    });

    describe('desconectar', () => {
      it('si se cancela la confirmación no se borra nada', async () => {
        alerta.onDidDismiss.mockResolvedValue({ role: 'cancel' });
        await abrir();
        await page.disconnect('chess.com', 'yo');
        expect(gameAnalytics.disconnect).not.toHaveBeenCalled();
        expect(page.hasAccounts).toBe(true);
      });

      it('si se confirma desconecta la cuenta y vuelve al formulario', async () => {
        await abrir();
        await page.disconnect('chess.com', 'yo');
        fixture.detectChanges();
        expect(gameAnalytics.disconnect).toHaveBeenCalledWith('chess.com', 'yo');
        expect(page.hasAccounts).toBe(false);
        expect(page.stats).toBeNull();
        expect(texto()).toContain('ANALYTICS.connect.title');
      });

      it('si queda otra cuenta, recarga sus partidas guardadas', async () => {
        const restante = { accounts: { chesscom: '', lichess: 'otro' }, historyMonths: 6 };
        gameAnalytics.disconnect.mockResolvedValue(restante);
        await abrir();
        gameAnalytics.loadStored.mockClear();
        await page.disconnect('chess.com', 'yo');
        expect(gameAnalytics.loadStored).toHaveBeenCalledWith(restante.accounts, 6);
        expect(page.hasAccounts).toBe(true);
      });

      it('el botón de la papelera dispara la desconexión', async () => {
        await abrir();
        (fixture.nativeElement.querySelector('button.text-error') as HTMLButtonElement).click();
        await dejarCorrer();
        expect(alertController.create).toHaveBeenCalled();
        expect(gameAnalytics.disconnect).toHaveBeenCalledWith('chess.com', 'yo');
      });
    });

    describe('rango de historial', () => {
      it('elegir el mismo rango no hace nada', async () => {
        await abrir();
        gameAnalytics.sync.mockClear();
        await page.setHistoryRange(6);
        expect(gameAnalytics.saveSettings).not.toHaveBeenCalled();
        expect(gameAnalytics.sync).not.toHaveBeenCalled();
      });

      it('un rango distinto se guarda y obliga a descargar los meses que falten', async () => {
        await abrir();
        gameAnalytics.sync.mockClear();
        await page.setHistoryRange(12);
        expect(gameAnalytics.saveSettings).toHaveBeenCalledWith({ historyMonths: 12 });
        expect(gameAnalytics.sync).toHaveBeenCalledWith(CON_CHESSCOM.accounts, 12, expect.any(Function));
      });
    });

    describe('filtros', () => {
      it('solo ofrece los controles de tiempo y plataformas que hay en las partidas', async () => {
        await abrir();
        expect(page.availableTimeClasses).toEqual(['blitz', 'rapid']);
        expect(page.availablePlatforms.sort()).toEqual(['chess.com', 'lichess']);
      });

      it('filtrar por plataforma recalcula el reporte y lo registra', async () => {
        await abrir();
        page.setPlatformFilter('lichess');
        expect(page.stats?.games).toBe(1);
        expect(page.gamesList).toHaveLength(1);
        expect(analytics.logEvent).toHaveBeenCalledWith('game_analytics_filtered', {
          platform: 'lichess',
          time_classes: 'all',
        });
      });

      it('marcar y desmarcar un ritmo filtra y desfiltra', async () => {
        await abrir();
        page.toggleTimeClass('blitz');
        expect(page.isTimeClassActive('blitz')).toBe(true);
        expect(page.stats?.games).toBe(2);
        page.toggleTimeClass('blitz');
        expect(page.isTimeClassActive('blitz')).toBe(false);
        expect(page.stats?.games).toBe(3);
      });

      it('si el filtro no deja partidas, las cifras desaparecen', async () => {
        await abrir();
        page.toggleTimeClass('rapid');
        page.setPlatformFilter('chess.com');
        expect(page.stats).toBeNull();
      });

      it('con una sola plataforma no se ofrece elegir plataforma', async () => {
        const soloChesscom = [partida(), partida()];
        gameAnalytics.loadStored.mockResolvedValue(soloChesscom);
        gameAnalytics.sync.mockResolvedValue(soloChesscom);
        await abrir();
        expect(page.availablePlatforms).toEqual(['chess.com']);
        expect(texto()).not.toContain('ANALYTICS.filters.allPlatforms');
      });
    });

    describe('pestañas', () => {
      it('entra por Estadísticas por omisión', async () => {
        await abrir();
        expect(page.activeTab).toBe('stats');
        expect(texto()).toContain('ANALYTICS.ratingProgress');
      });

      it.each(['openings', 'games'] as const)('entra por %s si la ruta lo pide', async (tab) => {
        queryTab = tab;
        await abrir();
        expect(page.activeTab).toBe(tab);
      });

      it('una pestaña desconocida cae en Estadísticas', async () => {
        queryTab = 'otra';
        await abrir();
        expect(page.activeTab).toBe('stats');
      });

      it('con una sola partida de rating no hay gráfica y avisa de que faltan datos', async () => {
        const una = [partida()];
        gameAnalytics.loadStored.mockResolvedValue(una);
        gameAnalytics.sync.mockResolvedValue(una);
        await abrir();
        expect(fixture.nativeElement.querySelector('app-rating-chart')).toBeNull();
        expect(texto()).toContain('ANALYTICS.notEnoughData');
      });

      it('con varias partidas muestra la gráfica con los puntos de rating', async () => {
        await abrir();
        expect(fixture.nativeElement.querySelector('app-rating-chart')).not.toBeNull();
        expect(page.ratingPoints).toHaveLength(3);
      });

      it('las pestañas son un tablist y marcan cuál está activa', async () => {
        await abrir();
        const pestanas = Array.from<HTMLButtonElement>(
          fixture.nativeElement.querySelectorAll('[role="tablist"] button[role="tab"]')
        );
        expect(pestanas).toHaveLength(3);
        expect(pestanas.map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
        expect(pestanas[0].classList).toContain('btn-primary');
        expect(pestanas[1].classList).toContain('btn-ghost');
      });

      it('el botón de Aperturas cambia la vista a la tabla de aperturas', async () => {
        await abrir();
        botonCon('ANALYTICS.openings.title')?.click();
        fixture.detectChanges();
        expect(page.activeTab).toBe('openings');
        expect(fixture.nativeElement.querySelector('app-openings-table')).not.toBeNull();
      });
    });

    describe('lista de partidas', () => {
      beforeEach(() => {
        queryTab = 'games';
      });

      it('muestra el rival, el rating y el resultado de cada partida', async () => {
        await abrir();
        const filas = fixture.nativeElement.querySelectorAll('button.text-left');
        expect(filas).toHaveLength(3);
        // la más reciente primero: la tercera partida (tablas) se jugó el último día
        expect(textoDe(filas[0])).toContain('ANALYTICS.gamesList.outcome.draw');
        expect(textoDe(filas[0])).toContain('(1480)');
        expect(textoDe(filas[0])).toContain('Sicilian Defense');
        const resultados = Array.from<Element>(filas).map((f) => textoDe(f));
        expect(resultados.filter((r) => r.includes('ANALYTICS.gamesList.outcome.win'))).toHaveLength(1);
        expect(resultados.filter((r) => r.includes('ANALYTICS.gamesList.outcome.loss'))).toHaveLength(1);
        expect(resultados.filter((r) => r.includes('ANALYTICS.gamesList.outcome.draw'))).toHaveLength(1);
      });

      it('pagina de 20 en 20 con el botón de ver más', async () => {
        const muchas = Array.from({ length: 45 }, () => partida());
        gameAnalytics.loadStored.mockResolvedValue(muchas);
        gameAnalytics.sync.mockResolvedValue(muchas);
        await abrir();
        const filas = () => fixture.nativeElement.querySelectorAll('button.text-left').length;
        expect(filas()).toBe(20);
        botonCon('ANALYTICS.gamesList.showMore')?.click();
        fixture.detectChanges();
        expect(filas()).toBe(40);
        botonCon('ANALYTICS.gamesList.showMore')?.click();
        fixture.detectChanges();
        expect(filas()).toBe(45);
        expect(botonCon('ANALYTICS.gamesList.showMore')).toBeUndefined();
      });

      it('al abrir una partida entrega la lista visible al reproductor y navega con su posición y color', async () => {
        await abrir();
        const negra = page.gamesList.find((g) => g.userColor === 'white');
        const indice = page.gamesList.indexOf(negra as ChessGame);
        page.openGame(negra as ChessGame);

        expect(gamesService.openOwnGames).toHaveBeenCalledWith('ANALYTICS.gamesList.title', page.gamesList);
        expect(router.navigate).toHaveBeenCalledWith(['/games/viewer'], {
          queryParams: { index: indice, color: 'w', source: 'analytics' },
        });
      });

      it('si el usuario jugó con negras el tablero se orienta con negras', async () => {
        const conNegras = partida({ userColor: 'black' });
        gameAnalytics.loadStored.mockResolvedValue([conNegras]);
        gameAnalytics.sync.mockResolvedValue([conNegras]);
        await abrir();
        page.openGame(page.gamesList[0]);
        expect(router.navigate).toHaveBeenCalledWith(['/games/viewer'], {
          queryParams: { index: 0, color: 'b', source: 'analytics' },
        });
      });

      it('una partida que no está en la lista no abre nada', async () => {
        await abrir();
        page.openGame(partida());
        expect(gamesService.openOwnGames).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it('clic en una fila abre esa partida', async () => {
        await abrir();
        (fixture.nativeElement.querySelectorAll('button.text-left')[1] as HTMLButtonElement).click();
        expect(router.navigate).toHaveBeenCalledWith(
          ['/games/viewer'],
          expect.objectContaining({ queryParams: expect.objectContaining({ index: 1 }) })
        );
      });
    });
  });

  describe('practicar una apertura', () => {
    const apertura = { value: 'Sicilian_Defense', nameEn: 'Sicilian Defense', nameEs: 'Defensa Siciliana' };

    beforeEach(async () => {
      const partidas = Array.from({ length: 4 }, (_, i) =>
        partida({ result: '0-1', white: { username: 'yo', rating: 1500 + i * 10 } })
      );
      gameAnalytics.getSettings.mockReturnValue(CON_CHESSCOM);
      gameAnalytics.loadStored.mockResolvedValue(partidas);
      gameAnalytics.sync.mockResolvedValue(partidas);
      appService.getOpeningsList = [apertura];
      await abrir();
    });

    it('recomienda las aperturas del catálogo donde peor va el usuario', () => {
      expect(page.practiceOpenings.map((o) => o.value)).toEqual(['Sicilian_Defense']);
      expect(textoDe(fixture.nativeElement.querySelector('li .text-sm.font-medium.truncate'))).toBe('Defensa Siciliana');
    });

    it('el nombre sigue el idioma activo', () => {
      expect(page.practiceName(apertura)).toBe('Defensa Siciliana');
      jest.spyOn(TestBed.inject(TranslocoService), 'getActiveLang').mockReturnValue('en');
      expect(page.practiceName(apertura)).toBe('Sicilian Defense');
    });

    it('al pulsar practicar pregunta primero con qué color', async () => {
      void page.practice(apertura);
      fixture.detectChanges();
      expect(page.colorPickerOpen).toBe(true);
      expect(texto()).toContain('ANALYTICS.practice.colorTitle');
      expect(customPlans.save).not.toHaveBeenCalled();
    });

    it('si se cancela el color no se crea ninguna rutina', async () => {
      const promesa = page.practice(apertura);
      page.pickColor(null);
      await promesa;
      expect(page.colorPickerOpen).toBe(false);
      expect(customPlans.save).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('con un color guarda la rutina de la apertura, la prepara y empieza el entrenamiento', async () => {
      const promesa = page.practice(apertura);
      fixture.detectChanges();
      botonCon('ANALYTICS.practice.colorBlack')?.click();
      await promesa;

      const plan = customPlans.save.mock.calls[0][0];
      expect(plan).toMatchObject({
        uid: 'practice-Sicilian_Defense',
        planType: 'custom',
        title: 'Defensa Siciliana',
        uidUser: 'u1',
        isPublic: false,
      });
      expect(plan.blocks).toHaveLength(1);
      expect(plan.blocks[0]).toMatchObject({
        openingFamily: 'Sicilian_Defense',
        color: 'black',
        elo: 1530, // el último rating del usuario
      });
      expect(planService.makeCustomPlanForPlay).toHaveBeenCalledWith(plan, 1530);
      expect(planFacade.clearPlan).toHaveBeenCalled();
      expect(planFacade.setPlan).toHaveBeenCalledWith(expect.objectContaining({ played: true }));
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training'], {
        queryParams: { returnTo: '/analytics?tab=openings' },
      });
      // la rutina se guarda antes de armar el plan a jugar y limpiar el anterior
      expect(customPlans.save.mock.invocationCallOrder[0]).toBeLessThan(
        planFacade.setPlan.mock.invocationCallOrder[0]
      );
    });

    it('sin partidas con rating, la rutina usa 1500 de nivel', async () => {
      page.ratingPoints = [];
      const promesa = page.practice(apertura);
      page.pickColor('random');
      await promesa;
      expect(customPlans.save.mock.calls[0][0].blocks[0].elo).toBe(1500);
      expect(customPlans.save.mock.calls[0][0].blocks[0].color).toBe('random');
    });
  });

  describe('utilidades de plantilla', () => {
    it('una fecha vacía se muestra como raya', async () => {
      await abrir();
      expect(page.formatDate(0)).toBe('—');
      expect(page.formatDate(Date.UTC(2026, 5, 15, 12))).not.toBe('—');
    });

    it('el botón de inicio navega a /home', async () => {
      await abrir();
      page.goToHome();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });
});
