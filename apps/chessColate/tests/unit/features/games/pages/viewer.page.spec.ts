// cm-chessboard no se puede cargar en Jest: los tableros se sustituyen por dobles.
jest.mock('@chesspark/board', () =>
  jest.requireActual('@tests/support/analisis-juegos.tablero')
);
// El mapa de calor se calcula de verdad; solo la valoración (que depende de Stockfish) se controla.
jest.mock('@chesspark/game-reporter', () => ({
  ...jest.requireActual('@chesspark/game-reporter'),
  reviewGame: jest.fn(),
}));
// El servicio de revisión arrastra el worker de Stockfish; la pantalla recibe un doble.
jest.mock('@chesspark/stockfish-wasm', () => ({
  StockfishService: class {},
  StockfishEvaluationService: class {},
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { ParsedGame } from '@chesspark/games-provider';
import { GameReview, MoveReview, PieceRating, reviewGame } from '@chesspark/game-reporter';
import { BoardGamePlayerComponent } from '@chesspark/board';

import { GamesViewerPage } from '@features/games/pages/viewer.page';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { GameReviewService } from '@features/games/services/game-review.service';
import { GamesService } from '@features/games/services/games.service';
import { DEFAULT_PLAYBACK_SETTINGS, PlaybackSettings } from '@features/games/utils/games.util';

import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const PGN = '[Event "Torneo"]\n[White "Petrosian, Tigran V"]\n[Black "Botvinnik, Mikhail"]\n\n1. e4 e5 2. Nf3 Nc6 *';

function partida(overrides: Partial<ParsedGame['header']> = {}, extra: Partial<ParsedGame> = {}): ParsedGame {
  return {
    header: {
      index: 0,
      white: 'Petrosian, Tigran V',
      black: 'Botvinnik, Mikhail',
      event: 'Torneo',
      date: '1963.05.20',
      year: 1963,
      result: '1-0',
      whiteElo: 2650,
      blackElo: 2690,
      plies: 4,
      timeControl: null,
      timeClass: null,
      ...overrides,
    },
    sanMoves: ['e4', 'e5', 'Nf3', 'Nc6'],
    fens: ['f0', 'f1', 'f2', 'f3', 'f4'],
    moveSquares: [],
    clocks: [null, null, null, null],
    ...extra,
  };
}

const jugada = (ply: number, classification: MoveReview['classification']): MoveReview => ({
  ply,
  color: ply % 2 === 1 ? 'w' : 'b',
  loss: 0,
  accuracy: 90,
  classification,
});

const pieza = (id: string, rating: number | null, extra: Partial<PieceRating> = {}): PieceRating => ({
  id,
  color: id.startsWith('w') ? 'w' : 'b',
  type: 'n',
  startSquare: id.slice(2),
  moves: rating === null ? 0 : 1,
  rating,
  accuracy: rating === null ? null : 80,
  counts: { excellent: 0, good: 1, inaccuracy: 0, mistake: 0, blunder: 0 },
  ...extra,
});

function valoracion(): GameReview {
  const caballo = pieza('w-g1', 8.2);
  const peon = pieza('w-e2', 4.1, { type: 'p' });
  return {
    moves: [jugada(1, 'good'), jugada(2, 'blunder'), jugada(3, 'inaccuracy'), jugada(4, 'mistake')],
    pieces: [caballo, peon, pieza('w-d1', null, { type: 'q' }), pieza('b-b8', 7.5)],
    best: { w: caballo, b: pieza('b-b8', 7.5) },
    worst: { w: peon, b: null },
  };
}

describe('GamesViewerPage', () => {
  let fixture: ComponentFixture<GamesViewerPage>;
  let page: GamesViewerPage;
  let router: { navigate: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let gamesService: {
    currentPack: unknown;
    getGame: jest.Mock;
    getGamePgn: jest.Mock;
    getSettings: jest.Mock;
    saveSettings: jest.Mock;
    keepScreenAwake: jest.Mock;
  };
  let gameReview: { evaluatePositions: jest.Mock; cancel: jest.Mock };
  let settings: PlaybackSettings;
  let query: Record<string, string>;
  let juegos: Record<number, ParsedGame | null>;

  const texto = () => textoDe(fixture.nativeElement);
  const tablero = () => page.board as unknown as Record<string, jest.Mock & ((...a: never[]) => void)>;
  const botonPorEtiqueta = (etiqueta: string) =>
    fixture.nativeElement.querySelector(`button[aria-label="${etiqueta}"]`) as HTMLButtonElement;
  const botonCon = (fragmento: string) =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes(fragmento)
    );
  const jugadas = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.font-mono button.px-1'));

  function abrir() {
    fixture = TestBed.createComponent(GamesViewerPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.mocked(reviewGame).mockReset();
    query = {};
    settings = { ...DEFAULT_PLAYBACK_SETTINGS };
    juegos = { 0: partida(), 1: partida({ index: 1, black: 'Spassky, Boris' }), 2: partida({ index: 2, black: 'Fischer, Robert' }) };
    router = { navigate: jest.fn() };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    gamesService = {
      currentPack: {
        collection: { id: 'petrosian', name: 'Tigran Petrosian' },
        headers: [0, 1, 2].map((index) => ({ index })),
      },
      getGame: jest.fn((index: number) => juegos[index] ?? null),
      getGamePgn: jest.fn(() => PGN),
      getSettings: jest.fn(() => settings),
      saveSettings: jest.fn((patch: Partial<PlaybackSettings>) => (settings = { ...settings, ...patch })),
      keepScreenAwake: jest.fn().mockResolvedValue(undefined),
    };
    gameReview = {
      evaluatePositions: jest.fn().mockResolvedValue([{ cp: 0 }, { cp: 10 }, { cp: 0 }, { cp: -20 }, { cp: 0 }]),
      cancel: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GamesViewerPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { get queryParamMap() { return convertToParamMap(query); } } },
        },
        { provide: GamesService, useValue: gamesService },
        { provide: AnalyticsService, useValue: analytics },
        { provide: GameReviewService, useValue: gameReview },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('apertura', () => {
    it('sin ningún paquete abierto vuelve al catálogo', () => {
      gamesService.currentPack = null;
      abrir();
      expect(router.navigate).toHaveBeenCalledWith(['/games']);
      expect(page.game).toBeNull();
    });

    it('carga la partida del índice pedido y muestra quién juega, el resultado y el evento', () => {
      query = { index: '1' };
      abrir();
      expect(gamesService.getGame).toHaveBeenCalledWith(1);
      expect(texto()).toContain('Petrosian, Tigran V – Spassky, Boris');
      expect(texto()).toContain('1-0');
      expect(texto()).toContain('Torneo 1963');
    });

    it('muestra el ritmo cuando la partida lo trae', () => {
      juegos[0] = partida({ timeClass: 'blitz', timeControl: '180+2' });
      abrir();
      expect(texto()).toContain('ANALYTICS.timeClasses.blitz');
      expect(texto()).toContain('(3+2)');
    });

    it('una partida ilegible muestra el aviso en lugar del tablero', () => {
      query = { index: '9' };
      abrir();
      expect(page.notFound).toBe(true);
      expect(texto()).toContain('GAMES.gameUnreadable');
      expect(fixture.nativeElement.querySelector('lib-board-game-player')).toBeNull();
    });

    it('por defecto mira desde las blancas: las blancas abajo', () => {
      abrir();
      expect(page.orientation).toBe('w');
      expect(page.topPlayer).toEqual({ name: 'Botvinnik, Mikhail', rating: 2690 });
      expect(page.bottomPlayer).toEqual({ name: 'Petrosian, Tigran V', rating: 2650 });
    });

    it('una partida propia pide el lado del usuario (color=b): las negras abajo', () => {
      query = { color: 'b', source: 'analytics' };
      abrir();
      expect(page.orientation).toBe('b');
      expect(page.bottomPlayer.name).toBe('Botvinnik, Mikhail');
      expect(page.topPlayer.name).toBe('Petrosian, Tigran V');
      expect(page.isOwnGame).toBe(true);
    });

    it('registra la apertura con el origen y el paquete', () => {
      query = { source: 'analytics' };
      abrir();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_opened', { source: 'analytics', player: 'petrosian' });
    });

    it('sin origen, el catálogo; y un paquete sin id se reporta como PGN propio', () => {
      gamesService.currentPack = { collection: { id: '', name: 'Mi PGN' }, headers: [{ index: 0 }] };
      abrir();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_opened', { source: 'catalog', player: 'own_pgn' });
    });

    it('la cabecera sin partida muestra el nombre de la colección', () => {
      query = { index: '9' };
      abrir();
      expect(texto()).toContain('Tigran Petrosian');
      expect(page.collectionName).toBe('Tigran Petrosian');
    });

    it('el botón de cerrar vuelve atrás en el historial', () => {
      const atras = jest.spyOn(history, 'back').mockImplementation(() => undefined);
      abrir();
      fixture.nativeElement.querySelector('.viewer-header button').click();
      expect(atras).toHaveBeenCalled();
    });
  });

  describe('lista de jugadas y tablero', () => {
    it('lista todas las jugadas con su número y entrega las posiciones al tablero', () => {
      abrir();
      expect(jugadas().map(textoDe)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
      expect(texto()).toContain('1.');
      expect(texto()).toContain('2.');
      expect(page.totalMoves).toBe(4);
      const stub = fixture.debugElement.query((d) => d.name === 'lib-board-game-player').componentInstance;
      expect(stub.fens).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    });

    it('al pulsar una jugada el tablero salta a esa posición', () => {
      abrir();
      jugadas()[2].click();
      expect(tablero()['goTo']).toHaveBeenCalledWith(3);
    });

    it('resalta la jugada que muestra el tablero', () => {
      abrir();
      const stub = fixture.debugElement.query((d) => d.name === 'lib-board-game-player').componentInstance;
      stub.indexChange.emit(2);
      fixture.detectChanges();
      expect(page.currentMove).toBe(2);
      expect(jugadas()[1].classList).toContain('bg-primary');
      expect(jugadas()[0].classList).not.toContain('bg-primary');
    });

    it('los controles de reproducción mandan al tablero', () => {
      abrir();
      botonPorEtiqueta('GAMES.controls.start').click();
      botonPorEtiqueta('GAMES.controls.previous').click();
      botonPorEtiqueta('GAMES.controls.play').click();
      botonPorEtiqueta('GAMES.controls.next').click();
      botonPorEtiqueta('GAMES.controls.end').click();
      expect(tablero()['toStart']).toHaveBeenCalledTimes(1);
      expect(tablero()['previous']).toHaveBeenCalledTimes(1);
      expect(tablero()['togglePlay']).toHaveBeenCalledTimes(1);
      expect(tablero()['next']).toHaveBeenCalledTimes(1);
      expect(tablero()['toEnd']).toHaveBeenCalledTimes(1);
    });

    it('al empezar a reproducir mantiene la pantalla encendida y cambia el icono', () => {
      abrir();
      const stub = fixture.debugElement.query((d) => d.name === 'lib-board-game-player').componentInstance;
      stub.playingChange.emit(true);
      fixture.detectChanges();
      expect(page.isPlaying).toBe(true);
      expect(gamesService.keepScreenAwake).toHaveBeenCalledWith(true);
      expect((fixture.nativeElement.querySelector('button.btn-lg ion-icon') as { name: string }).name).toBe('pause-outline');

      stub.playingChange.emit(false);
      fixture.detectChanges();
      expect(gamesService.keepScreenAwake).toHaveBeenLastCalledWith(false);
      expect((fixture.nativeElement.querySelector('button.btn-lg ion-icon') as { name: string }).name).toBe('play-outline');
    });

    it('girar el tablero cambia la orientación y quién queda arriba', () => {
      abrir();
      botonPorEtiqueta('GAMES.controls.flip').click();
      fixture.detectChanges();
      expect(tablero()['flip']).toHaveBeenCalled();
      expect(page.orientation).toBe('b');
      expect(page.topPlayer.name).toBe('Petrosian, Tigran V');
    });
  });

  describe('relojes', () => {
    beforeEach(() => {
      juegos[0] = partida({ timeControl: '600+0' }, { clocks: ['0:09:58', '0:09:57', '0:09:50', '0:09:40'] });
    });

    it('en la posición inicial no se enseña ningún reloj', () => {
      abrir();
      expect(page.topClock).toBe('');
      expect(page.bottomClock).toBe('');
    });

    it('tras la primera jugada, las blancas (abajo) muestran su reloj y las negras aún no', () => {
      abrir();
      page.onIndexChange(1);
      expect(page.bottomClock).toBe('9:58');
      expect(page.topClock).toBe('');
    });

    it('cada color conserva el reloj de su última jugada', () => {
      abrir();
      page.onIndexChange(3);
      expect(page.bottomClock).toBe('9:50'); // blancas: jugada 3
      expect(page.topClock).toBe('9:57'); // negras: jugada 2
    });

    it('con el tablero girado los relojes cambian de lado', () => {
      query = { color: 'b' };
      abrir();
      page.onIndexChange(2);
      expect(page.bottomClock).toBe('9:57'); // negras abajo
      expect(page.topClock).toBe('9:58');
    });

    it('muestra la gráfica de tiempo por jugada, con la barra más alta en la jugada más pensada', () => {
      abrir();
      expect(page.hasMoveTimes).toBe(true);
      expect(Math.max(...page.moveTimeBarHeights)).toBe(100);
      expect(page.moveTimeBarHeights.indexOf(100)).toBe(3); // 9:57 -> 9:40
      expect(texto()).toContain('GAMES.moveTimes.title');
    });

    it('al pulsar una barra el tablero salta a esa jugada', () => {
      abrir();
      const barras = fixture.nativeElement.querySelectorAll('button.w-1\\.5');
      expect(barras).toHaveLength(4);
      barras[1].click();
      expect(tablero()['goTo']).toHaveBeenCalledWith(2);
    });

    it('sin relojes no hay gráfica de tiempo', () => {
      juegos[0] = partida();
      abrir();
      expect(page.hasMoveTimes).toBe(false);
      expect(texto()).not.toContain('GAMES.moveTimes.title');
    });
  });

  describe('ajustes de reproducción', () => {
    it('cambiar la velocidad se guarda y se reporta', () => {
      abrir();
      page.setSpeed(500);
      expect(gamesService.saveSettings).toHaveBeenCalledWith({ msPerMove: 500 });
      expect(page.settings.msPerMove).toBe(500);
      expect(analytics.logEvent).toHaveBeenCalledWith('games_speed_changed', { ms_per_move: 500 });
    });

    it('el botón de velocidad activa la elegida', () => {
      abrir();
      botonCon('GAMES.speedLabel')?.click();
      expect(gamesService.saveSettings).toHaveBeenCalledWith({ msPerMove: 500 });
    });

    it('el sonido, el modo aleatorio, la repetición y el avance automático se invierten y se guardan', () => {
      abrir();
      page.toggleSound();
      expect(gamesService.saveSettings).toHaveBeenLastCalledWith({ soundEnabled: false });
      page.toggleLoop();
      expect(gamesService.saveSettings).toHaveBeenLastCalledWith({ loopCollection: false });
      page.toggleAutoNext();
      expect(gamesService.saveSettings).toHaveBeenLastCalledWith({ autoNextGame: false });
      page.toggleShuffle();
      expect(gamesService.saveSettings).toHaveBeenLastCalledWith({ shuffle: true });
    });
  });

  describe('mapa de calor', () => {
    it('se entra por la pestaña y cambia el tablero por el mapa de la pieza elegida', () => {
      abrir();
      botonCon('GAMES.heatmap.tabHeatmap')?.click();
      fixture.detectChanges();
      expect(page.heatmapMode).toBe(true);
      expect(fixture.nativeElement.querySelector('lib-board-heatmap')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('lib-board-game-player')).toBeNull();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_heatmap_opened', { source: 'catalog' });
    });

    it('elige por defecto la dama blanca y ofrece las piezas de ese color', () => {
      abrir();
      page.setMode('heatmap');
      expect(page.selectedPieceId).toBe('w-d1');
      expect(page.heatmapPieces).toHaveLength(16);
      expect(page.heatmapPieces.every((p) => p.color === 'w')).toBe(true);
    });

    it('cambiar de color elige la dama de ese color', () => {
      abrir();
      page.setMode('heatmap');
      page.setHeatmapColor('b');
      expect(page.selectedPieceId).toBe('b-d8');
    });

    it('pulsar una pieza la selecciona y resalta sus jugadas en la lista', () => {
      abrir();
      page.setMode('heatmap');
      const caballo = page.heatmapPieces.find((p) => p.id === 'w-g1');
      expect(caballo).toBeDefined();
      page.selectPiece(caballo!);
      fixture.detectChanges();
      expect(page.selectedPiece?.id).toBe('w-g1');
      expect(page.isSelectedPieceMove(3)).toBe(true); // Nf3
      expect(page.isSelectedPieceMove(1)).toBe(false);
      expect(jugadas()[2].classList).toContain('font-bold');
      expect(jugadas()[0].classList).not.toContain('font-bold');
    });

    it('fuera del mapa de calor las jugadas de la pieza no se resaltan', () => {
      abrir();
      expect(page.isSelectedPieceMove(3)).toBe(false);
    });

    it('si se está reproduciendo, pausa antes de entrar', () => {
      abrir();
      page.onPlayingChange(true);
      page.setMode('heatmap');
      expect(tablero()['togglePlay']).toHaveBeenCalled();
    });

    it('en una partida propia nombra los colores como "tus piezas" y "rival", empezando por los del usuario', () => {
      query = { color: 'b', source: 'analytics' };
      abrir();
      expect(page.colorOptions).toEqual([
        { color: 'b', label: 'GAMES.heatmap.yourPieces' },
        { color: 'w', label: 'GAMES.heatmap.opponent' },
      ]);
      page.setMode('heatmap');
      expect(page.selectedPieceId).toBe('b-d8');
      expect(analytics.logEvent).toHaveBeenCalledWith('game_heatmap_opened', { source: 'analytics' });
    });

    it('en una partida del catálogo los colores son blancas y negras', () => {
      abrir();
      expect(page.colorOptions.map((o) => o.label)).toEqual(['GAMES.heatmap.white', 'GAMES.heatmap.black']);
    });

    it('al salir del mapa vuelve a la partida desde el principio', () => {
      abrir();
      page.onIndexChange(3);
      page.setMode('heatmap');
      page.setMode('game');
      expect(page.currentMove).toBe(0);
      expect(page.heatmapMode).toBe(false);
    });

    it('elegir la pestaña en la que ya está no hace nada', () => {
      abrir();
      analytics.logEvent.mockClear();
      page.setMode('game');
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });

    it('sin PGN no hay mapa y no se rompe', () => {
      gamesService.getGamePgn.mockReturnValue(null);
      abrir();
      page.setMode('heatmap');
      expect(page.heatmap).toBeNull();
      expect(page.heatmapPieces).toEqual([]);
      expect(page.selectedPiece).toBeNull();
    });
  });

  describe('valoración de piezas', () => {
    beforeEach(() => {
      jest.mocked(reviewGame).mockReturnValue(valoracion());
    });

    const alternarARevision = async () => {
      page.setMode('review');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
    };

    it('al abrir la pestaña analiza las posiciones de la partida y valora con el PGN', async () => {
      abrir();
      await alternarARevision();
      expect(gameReview.evaluatePositions).toHaveBeenCalledWith(['f0', 'f1', 'f2', 'f3', 'f4'], expect.any(Function));
      expect(reviewGame).toHaveBeenCalledWith(PGN, expect.any(Array));
      expect(page.review).not.toBeNull();
      expect(page.reviewing).toBe(false);
      expect(analytics.logEvent).toHaveBeenCalledWith('game_review_opened', { source: 'catalog' });
    });

    it('mientras analiza muestra el avance', async () => {
      let avanzar!: (done: number, total: number) => void;
      let terminar!: (evals: unknown[]) => void;
      gameReview.evaluatePositions.mockImplementation(
        (_f: string[], onProgress: typeof avanzar) =>
          new Promise((resolve) => {
            avanzar = onProgress;
            terminar = resolve;
          })
      );
      abrir();
      page.setMode('review');
      fixture.detectChanges();
      expect(page.reviewing).toBe(true);
      expect(texto()).toContain('GAMES.review.analyzing');

      avanzar(2, 5);
      fixture.detectChanges();
      expect(page.reviewProgress).toBe(40);
      expect(texto()).toContain('40%');

      terminar([{ cp: 0 }]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      expect(page.reviewing).toBe(false);
    });

    it('muestra la mejor y la peor pieza y la clasificación con notas', async () => {
      abrir();
      await alternarARevision();
      expect(page.bestPiece?.id).toBe('w-g1');
      expect(page.worstPiece?.id).toBe('w-e2');
      expect(texto()).toContain('8.2');
      expect(texto()).toContain('4.1');
      expect(page.rankedPieces.map((p) => p.id)).toEqual(['w-g1', 'w-e2']);
      expect(page.unratedPieces.map((p) => p.id)).toEqual(['w-d1']);
      expect(texto()).toContain('GAMES.review.unrated');
    });

    it('cambiar de color muestra las piezas del otro bando', async () => {
      abrir();
      await alternarARevision();
      page.setReviewColor('b');
      fixture.detectChanges();
      expect(page.rankedPieces.map((p) => p.id)).toEqual(['b-b8']);
      expect(page.worstPiece).toBeNull();
    });

    it('marca las jugadas flojas en la lista solo en esta pestaña', async () => {
      abrir();
      expect(page.annotationOf(2)).toBe('');
      await alternarARevision();
      expect(jugadas().map(textoDe)).toEqual(['e4', 'e5??', 'Nf3?!', 'Nc6?']);
      expect(page.annotationOf(1)).toBe('');
    });

    it('si el análisis falla lo avisa y se puede reintentar', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      gameReview.evaluatePositions.mockRejectedValueOnce(new Error('sin motor'));
      abrir();
      await alternarARevision();
      expect(page.reviewFailed).toBe(true);
      expect(texto()).toContain('GAMES.review.failed');

      botonCon('GAMES.review.retry')?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      expect(page.reviewFailed).toBe(false);
      expect(page.review).not.toBeNull();
      jest.restoreAllMocks();
    });

    it('si la valoración devuelve null se considera fallida', async () => {
      jest.mocked(reviewGame).mockReturnValue(null as unknown as GameReview);
      abrir();
      await alternarARevision();
      expect(page.reviewFailed).toBe(true);
      expect(page.review).toBeNull();
    });

    it('un análisis cancelado (null) no deja resultado ni error', async () => {
      gameReview.evaluatePositions.mockResolvedValue(null);
      abrir();
      await alternarARevision();
      expect(page.review).toBeNull();
      expect(page.reviewFailed).toBe(false);
      expect(reviewGame).not.toHaveBeenCalled();
    });

    it('sin PGN de la partida no se puede valorar', async () => {
      gamesService.getGamePgn.mockReturnValue(null);
      abrir();
      await alternarARevision();
      expect(page.reviewFailed).toBe(true);
      expect(gameReview.evaluatePositions).not.toHaveBeenCalled();
    });

    it('en una partida propia valora primero las piezas del usuario', async () => {
      query = { color: 'b', source: 'analytics' };
      abrir();
      await alternarARevision();
      expect(page.reviewColor).toBe('b');
      expect(analytics.logEvent).toHaveBeenCalledWith('game_review_opened', { source: 'analytics' });
    });

    it('volver a la pestaña con la valoración hecha no vuelve a analizar', async () => {
      abrir();
      await alternarARevision();
      page.setMode('game');
      page.setMode('review');
      expect(gameReview.evaluatePositions).toHaveBeenCalledTimes(1);
    });
  });

  describe('modo TV', () => {
    beforeEach(() => {
      query = { tv: '1', index: '1' };
    });

    it('arranca en la partida pedida, oculta las pestañas y empieza a reproducir solo', () => {
      abrir();
      expect(page.isTv).toBe(true);
      expect(gamesService.getGame).toHaveBeenCalledWith(1);
      expect(page.tvPositionLabel).toEqual({ current: 2, total: 3 });
      expect(botonCon('GAMES.heatmap.tabHeatmap')).toBeUndefined();
      expect(analytics.logEvent).toHaveBeenCalledWith('game_opened', { source: 'tv', player: 'petrosian' });

      expect(tablero()['play']).not.toHaveBeenCalled();
      jest.advanceTimersByTime(400);
      expect(tablero()['play']).toHaveBeenCalledTimes(1);
    });

    it('si el índice pedido no está en el recorrido empieza por el primero', () => {
      query = { tv: '1', index: '77' };
      abrir();
      expect(page.tvPositionLabel.current).toBe(1);
      expect(gamesService.getGame).toHaveBeenCalledWith(0);
    });

    it('al terminar una partida pasa a la siguiente tras una pausa', () => {
      abrir();
      page.onGameFinished();
      expect(gamesService.getGame).not.toHaveBeenCalledWith(2);
      jest.advanceTimersByTime(2500);
      expect(gamesService.getGame).toHaveBeenCalledWith(2);
      expect(page.tvPositionLabel.current).toBe(3);
      expect(analytics.logEvent).toHaveBeenCalledWith('games_tv_next', { index: 2 });
    });

    it('con el avance automático apagado no pasa sola a la siguiente', () => {
      settings.autoNextGame = false;
      abrir();
      page.onGameFinished();
      jest.advanceTimersByTime(10_000);
      expect(page.tvPositionLabel.current).toBe(2);
    });

    it('fuera del modo TV terminar la partida no encadena nada', () => {
      query = {};
      abrir();
      page.onGameFinished();
      jest.advanceTimersByTime(10_000);
      expect(page.tvPositionLabel.current).toBe(1);
      expect(analytics.logEvent).not.toHaveBeenCalledWith('games_tv_next', expect.anything());
    });

    it('al llegar al final con la repetición activa da la vuelta a la primera', () => {
      query = { tv: '1', index: '2' };
      abrir();
      page.goToNextGame();
      expect(page.tvPositionLabel.current).toBe(1);
    });

    it('al llegar al final sin repetición se queda y suelta la pantalla', () => {
      settings.loopCollection = false;
      query = { tv: '1', index: '2' };
      abrir();
      gamesService.keepScreenAwake.mockClear();
      page.goToNextGame();
      expect(page.tvPositionLabel.current).toBe(3);
      expect(gamesService.keepScreenAwake).toHaveBeenCalledWith(false);
    });

    it('"anterior" retrocede y desde la primera da la vuelta a la última', () => {
      abrir();
      page.goToPreviousGame();
      expect(page.tvPositionLabel.current).toBe(1);
      page.goToPreviousGame();
      expect(page.tvPositionLabel.current).toBe(3);
      jest.advanceTimersByTime(400);
      expect(tablero()['play']).toHaveBeenCalled();
    });

    it('cargar otra partida reinicia la jugada actual', () => {
      abrir();
      page.onIndexChange(3);
      page.goToNextGame();
      expect(page.currentMove).toBe(0);
    });

    it('una partida ilegible en el medio se salta y se sigue con la siguiente', () => {
      juegos[2] = null;
      query = { tv: '1', index: '1' };
      abrir();
      page.goToNextGame();
      expect(gamesService.getGame).toHaveBeenCalledWith(2);
      expect(gamesService.getGame).toHaveBeenCalledWith(0);
      expect(page.tvPositionLabel.current).toBe(1);
      expect(page.notFound).toBe(false);
    });

    it('con el modo aleatorio, rebarajar conserva la partida en curso', () => {
      abrir();
      const antes = page.tvPositionLabel.total;
      page.toggleShuffle();
      expect(settings.shuffle).toBe(true);
      expect(page.tvPositionLabel.total).toBe(antes);
      // la partida en curso sigue siendo la misma, aunque cambie su lugar en el recorrido
      expect(page.game?.header.black).toBe('Spassky, Boris');
      const posicion = page.tvPositionLabel.current;
      page.toggleShuffle();
      expect(page.tvPositionLabel.current).toBeGreaterThanOrEqual(1);
      expect(posicion).toBeGreaterThanOrEqual(1);
    });

    it('los botones de TV navegan entre partidas', () => {
      abrir();
      botonCon('GAMES.nextGame')?.click();
      expect(page.tvPositionLabel.current).toBe(3);
      botonCon('GAMES.previousGame')?.click();
      expect(page.tvPositionLabel.current).toBe(2);
    });

    it('si ninguna partida se deja leer, el TV con repetición se detiene en vez de recursar sin fin', () => {
      juegos = {};
      expect(() => abrir()).not.toThrow();
      expect(page.notFound).toBe(true);
    });
  });

  describe('al salir', () => {
    it('cancela el análisis pendiente, suelta la pantalla y anula la pausa del TV', () => {
      query = { tv: '1', index: '0' };
      abrir();
      page.onGameFinished();
      gameReview.cancel.mockClear();
      gamesService.keepScreenAwake.mockClear();

      fixture.destroy();
      expect(gameReview.cancel).toHaveBeenCalled();
      expect(gamesService.keepScreenAwake).toHaveBeenCalledWith(false);

      gamesService.getGame.mockClear();
      jest.advanceTimersByTime(5000);
      expect(gamesService.getGame).not.toHaveBeenCalled();
    });
  });
});
