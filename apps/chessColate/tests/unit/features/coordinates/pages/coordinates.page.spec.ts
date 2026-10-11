// cm-chessboard no se puede cargar en Jest: el tablero se sustituye por un doble.
jest.mock('@chesspark/board', () =>
  jest.requireActual('@tests/support/analisis-juegos.tablero')
);

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ConfettiService, RandomFENService, SoundsService } from '@chesspark/common-utils';

import { CoordinatesPage } from '@features/coordinates/pages/coordinates.page';
import { GameResultsModalComponent } from '@features/coordinates/components/game-results-modal/game-results-modal.component';
import { SettingsSideMenuComponent } from '@features/coordinates/components/settings-side-menu/settings-side-menu.component';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { CoordinatesPuzzle, StorageService } from '@features/coordinates/services/storage.service';

import {
  appearanceDouble,
  conModalFalso,
  StubNavbar,
  sustituirImports,
  textoDe,
  translocoTesting,
} from '@tests/support/analisis-juegos';

const SETTINGS_KEY = 'chessColate_coordinates_gameSettings';
const AHORA = new Date(2026, 5, 15, 12, 0, 0).getTime();

const partidaGuardada = (score: number, color: 'w' | 'b', haceDias = 1): CoordinatesPuzzle => ({
  uid: `g${score}${color}`,
  uidUser: 'u',
  score,
  squaresGood: [],
  squaresBad: [],
  round: [],
  date: AHORA - haceDias * 86_400_000,
  color,
});

describe('CoordinatesPage', () => {
  let fixture: ComponentFixture<CoordinatesPage>;
  let page: CoordinatesPage;

  let router: { navigate: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let storage: { getUserStats: jest.Mock; getAllGames: jest.Mock; saveGameResult: jest.Mock };
  let confetti: { launch: jest.Mock };
  let randomFen: { generateRandomFEN: jest.Mock };
  let sounds: { playGood: jest.Mock; playError: jest.Mock };
  let estadisticas: ReturnType<typeof statsBase>;
  let guardadas: CoordinatesPuzzle[];

  const statsBase = () => ({
    totalGames: 0,
    bestScore: 0,
    averageScore: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    accuracy: 0,
  });
  const tablero = () => page.boardComponent as unknown as Record<string, jest.Mock>;
  const texto = () => textoDe(fixture.nativeElement);
  const botonCon = (fragmento: string) =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes(fragmento)
    );

  function abrir() {
    fixture = TestBed.createComponent(CoordinatesPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Acierta la casilla pedida. */
  const acertar = () => page.onSquareSelected(page.currentPuzzle);
  /** Falla a propósito con una casilla distinta de la pedida. */
  const fallar = () => page.onSquareSelected(page.currentPuzzle === 'a1' ? 'h8' : 'a1');

  beforeEach(async () => {
    jest.useFakeTimers({ now: AHORA });
    localStorage.clear();
    estadisticas = statsBase();
    guardadas = [];
    router = { navigate: jest.fn() };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    storage = {
      getUserStats: jest.fn(() => estadisticas),
      getAllGames: jest.fn(() => [...guardadas]),
      saveGameResult: jest.fn(),
    };
    confetti = { launch: jest.fn() };
    randomFen = { generateRandomFEN: jest.fn(() => '8/8/8/8/8/8/8/K6k w - - 0 1') };
    sounds = { playGood: jest.fn(), playError: jest.fn() };

    sustituirImports(CoordinatesPage, [[NavbarComponent, StubNavbar]]);
    conModalFalso(GameResultsModalComponent);
    conModalFalso(SettingsSideMenuComponent);
    await TestBed.configureTestingModule({
      imports: [CoordinatesPage, translocoTesting()],
      providers: [
        { provide: Router, useValue: router },
        { provide: AnalyticsService, useValue: analytics },
        { provide: StorageService, useValue: storage },
        { provide: ConfettiService, useValue: confetti },
        { provide: RandomFENService, useValue: randomFen },
        { provide: SoundsService, useValue: sounds },
        appearanceDouble(),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('al abrir', () => {
    it('carga las estadísticas y los 5 mejores puntajes, del mayor al menor, con su antigüedad', () => {
      estadisticas = { ...statsBase(), totalGames: 7, bestScore: 40 };
      guardadas = [10, 30, 20, 40, 5, 25, 1].map((s, i) => partidaGuardada(s, i % 2 ? 'b' : 'w', i + 1));
      abrir();
      expect(page.userStats.totalGames).toBe(7);
      expect(page.bestScores.map((s) => s.score)).toEqual([40, 30, 25, 20, 10]);
      expect(page.bestScores[0].timeAgo).toContain('hace');
    });

    it('un puntaje con fecha inválida cae en "recientemente"', () => {
      expect(
        (() => {
          abrir();
          return page.formatTimeAgo(NaN);
        })()
      ).toBe('recientemente');
    });

    it('muestra la tabla de puntajes y el botón de jugar mientras no se juega', () => {
      guardadas = [partidaGuardada(12, 'w')];
      abrir();
      expect(botonCon('COORDINATES.actions.play')).toBeDefined();
      expect(fixture.nativeElement.querySelector('app-scoreboard')).not.toBeNull();
      expect(texto()).toContain('12 COORDINATES.game.points');
    });

    it('recupera los ajustes guardados y los aplica al tablero cuando está listo', () => {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ showCoordinates: true, showPieces: true, playSound: true })
      );
      abrir();
      expect(page.gameSettings).toEqual({
        showCoordinates: true,
        showPieces: true,
        showRandomPieces: false,
        infiniteMode: false,
        playSound: true,
      });
      jest.advanceTimersByTime(200);
      expect(tablero()['toggleCoordinates']).toHaveBeenCalledWith(true);
      expect(tablero()['togglePieces']).toHaveBeenCalledWith(true);
      expect(tablero()['setPosition']).not.toHaveBeenCalled();
    });

    it('con piezas aleatorias pone una posición aleatoria en el tablero', () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showPieces: true, showRandomPieces: true }));
      abrir();
      jest.advanceTimersByTime(200);
      expect(tablero()['setPosition']).toHaveBeenCalledWith('8/8/8/8/8/8/8/K6k w - - 0 1');
    });

    it('el enlace de inicio navega a /home', () => {
      abrir();
      fixture.nativeElement.querySelector('.breadcrumbs a').click();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('ajustes', () => {
    it('al cambiarlos se guardan en el dispositivo y se aplican al tablero', () => {
      abrir();
      jest.advanceTimersByTime(200);
      tablero()['toggleCoordinates'].mockClear();
      const nuevos = { ...page.gameSettings, showCoordinates: true, infiniteMode: true };
      page.onSettingsChange(nuevos);
      jest.advanceTimersByTime(200);
      expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string)).toEqual(nuevos);
      expect(tablero()['toggleCoordinates']).toHaveBeenCalledWith(true);
    });

    it('el menú de ajustes emite los cambios a la pantalla', () => {
      abrir();
      const menu = fixture.debugElement.query((d) => d.name === 'app-settings-side-menu');
      menu.componentInstance.settingsChange.emit({ ...page.gameSettings, playSound: true });
      expect(page.gameSettings.playSound).toBe(true);
    });
  });

  describe('orientación del tablero', () => {
    it('blancas y negras giran el tablero al color elegido', () => {
      abrir();
      page.changeBoardOrientation('black');
      expect(page.boardOrientation).toBe('black');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('b');
      page.changeBoardOrientation('white');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('w');
    });

    it('aleatorio elige uno de los dos lados', () => {
      abrir();
      jest.spyOn(Math, 'random').mockReturnValue(0.7);
      page.changeBoardOrientation('random');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('b');
      jest.spyOn(Math, 'random').mockReturnValue(0.2);
      page.changeBoardOrientation('random');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('w');
    });

    it('el control de orientación de la pantalla cambia la orientación', () => {
      abrir();
      const controles = fixture.debugElement.query((d) => d.name === 'app-board-orientation-controls');
      controles.componentInstance.orientationChange.emit('black');
      expect(page.boardOrientation).toBe('black');
    });

    it('el control de orientación desaparece durante la partida', () => {
      abrir();
      page.play();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('app-board-orientation-controls button')).toHaveLength(0);
    });
  });

  describe('empezar una partida', () => {
    it('prepara 200 casillas válidas, 60 segundos y estadísticas en cero', () => {
      abrir();
      page.play();
      expect(page.isPlaying).toBe(true);
      expect(page.puzzles).toHaveLength(200);
      expect(page.puzzles.every((p) => /^[a-h][1-8]$/.test(p))).toBe(true);
      expect(page.currentPuzzle).toBe(page.puzzles[0]);
      expect(page.time).toBe(60);
      expect(page.score).toBe(0);
      expect(page.currentGameStats).toEqual({ correctAnswers: 0, incorrectAnswers: 0, accuracy: 0 });
    });

    it('limpia lo que quedó de la partida anterior', () => {
      abrir();
      page.squaresGood = ['a1'];
      page.squaresBad = ['b2'];
      page.score = 9;
      page.play();
      expect(page.squaresGood).toEqual([]);
      expect(page.squaresBad).toEqual([]);
      expect(page.score).toBe(0);
    });

    it('con orientación fija juega con ese color', () => {
      abrir();
      page.boardOrientation = 'black';
      page.play();
      expect(page.currentColorInBoard).toBe('black');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('b');
    });

    it('con orientación aleatoria sortea el color y lo aplica al tablero', () => {
      abrir();
      jest.spyOn(Math, 'random').mockReturnValue(0.9);
      page.boardOrientation = 'random';
      page.play();
      expect(page.currentColorInBoard).toBe('black');
      expect(tablero()['changeOrientation']).toHaveBeenLastCalledWith('b');
    });

    it('lo registra con la configuración elegida', () => {
      abrir();
      page.boardOrientation = 'white';
      page.play();
      expect(analytics.logEvent).toHaveBeenCalledWith('coordinates_started', {
        board_orientation: 'white',
        infinite_mode: false,
        show_pieces: false,
        show_coordinates: false,
      });
    });

    it('el botón de jugar inicia la partida y muestra la casilla pedida', () => {
      abrir();
      botonCon('COORDINATES.actions.play')?.click();
      fixture.detectChanges();
      expect(page.isPlaying).toBe(true);
      expect(textoDe(fixture.nativeElement.querySelector('h1.current-puzzle'))).toBe(page.currentPuzzle);
      expect(botonCon('COORDINATES.actions.play')).toBeUndefined();
      expect(fixture.nativeElement.querySelector('app-scoreboard')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-king-avatar')).not.toBeNull();
    });
  });

  describe('responder', () => {
    beforeEach(() => {
      abrir();
      page.play();
    });

    it('acertar suma un punto, pasa a la siguiente casilla y actualiza la precisión', () => {
      const primera = page.currentPuzzle;
      acertar();
      expect(page.score).toBe(1);
      expect(page.squaresGood).toEqual([primera]);
      expect(page.currentPuzzle).toBe(page.puzzles[1]);
      expect(page.currentGameStats).toEqual({ correctAnswers: 1, incorrectAnswers: 0, accuracy: 100 });
    });

    it('fallar no avanza, registra el error y pone la barra en rojo un instante', () => {
      const primera = page.currentPuzzle;
      fallar();
      expect(page.currentPuzzle).toBe(primera);
      expect(page.squaresBad).toEqual([primera]);
      expect(page.score).toBe(0);
      expect(page.currentGameStats.incorrectAnswers).toBe(1);
      expect(page.timeColor).toBe('danger');
      jest.advanceTimersByTime(500);
      expect(page.timeColor).toBe('success');
    });

    it('la precisión mezcla aciertos y fallos', () => {
      acertar();
      acertar();
      acertar();
      fallar();
      expect(page.currentGameStats.accuracy).toBe(75);
    });

    it('con el sonido activado suena el acierto o el error', () => {
      page.gameSettings = { ...page.gameSettings, playSound: true };
      acertar();
      expect(sounds.playGood).toHaveBeenCalledTimes(1);
      fallar();
      expect(sounds.playError).toHaveBeenCalledTimes(1);
    });

    it('con el sonido apagado no suena nada', () => {
      acertar();
      fallar();
      expect(sounds.playGood).not.toHaveBeenCalled();
      expect(sounds.playError).not.toHaveBeenCalled();
    });

    it('con piezas aleatorias cada casilla nueva cambia la posición del tablero', () => {
      page.gameSettings = { ...page.gameSettings, showPieces: true, showRandomPieces: true };
      acertar();
      expect(tablero()['setPosition']).toHaveBeenCalled();
    });

    it('si se agotan las casillas la partida termina', () => {
      page.puzzles = ['a1', 'b2'];
      page.currentPuzzle = 'a1';
      page.onSquareSelected('a1');
      page.onSquareSelected('b2');
      expect(page.isPlaying).toBe(false);
      expect(storage.saveGameResult).toHaveBeenCalled();
    });

    it('fuera de partida ignora las pulsaciones del tablero', () => {
      page.stopGame();
      page.onSquareSelected('a1');
      expect(page.currentGameStats.correctAnswers + page.currentGameStats.incorrectAnswers).toBe(0);
    });
  });

  describe('el reloj', () => {
    beforeEach(() => {
      abrir();
      page.boardOrientation = 'white';
      page.play();
    });

    it('descuenta el tiempo y avanza la barra', () => {
      jest.advanceTimersByTime(10_000);
      expect(page.time).toBeCloseTo(50, 0);
      expect(page.progressValue).toBeCloseTo(50 / 60, 1);
    });

    it('la barra cambia de verde a amarillo a rojo según queda tiempo', () => {
      jest.advanceTimersByTime(30_000);
      expect(page.timeColor).toBe('success');
      jest.advanceTimersByTime(15_000); // quedan ~15 s
      expect(page.timeColor).toBe('warning');
      jest.advanceTimersByTime(10_000); // quedan ~5 s
      expect(page.timeColor).toBe('danger');
    });

    it('al acabarse el tiempo termina la partida, guarda el resultado y abre los resultados', () => {
      const presentar = jest.spyOn(page.resultsModal, 'present');
      acertar();
      acertar();
      jest.advanceTimersByTime(61_000);
      expect(page.isPlaying).toBe(false);
      expect(presentar).toHaveBeenCalledTimes(1);
      expect(storage.saveGameResult).toHaveBeenCalledTimes(1);
      expect(storage.saveGameResult).toHaveBeenCalledWith(
        expect.objectContaining({ score: 2, color: 'w', date: expect.any(Number) })
      );
      expect(page.time).toBe(60);
      expect(page.currentPuzzle).toBe('');
    });

    it('al terminar deja de contar (no se guarda dos veces)', () => {
      jest.advanceTimersByTime(61_000);
      jest.advanceTimersByTime(30_000);
      expect(storage.saveGameResult).toHaveBeenCalledTimes(1);
    });
  });

  describe('modo infinito', () => {
    beforeEach(() => {
      abrir();
      page.gameSettings = { ...page.gameSettings, infiniteMode: true };
      page.play();
      fixture.detectChanges();
    });

    it('no corre el tiempo', () => {
      expect(page.time).toBe(Infinity);
      jest.advanceTimersByTime(120_000);
      expect(page.isPlaying).toBe(true);
      expect(page.time).toBe(Infinity);
    });

    it('ofrece el botón de detener, que termina la partida', () => {
      const detener = botonCon('COORDINATES.actions.stopGame');
      expect(detener).toBeDefined();
      detener?.click();
      expect(page.isPlaying).toBe(false);
    });

    it('no guarda el resultado en el historial', () => {
      acertar();
      page.stopGame();
      expect(storage.saveGameResult).not.toHaveBeenCalled();
    });

    it('en modo normal no aparece el botón de detener', () => {
      page.stopGame();
      page.gameSettings = { ...page.gameSettings, infiniteMode: false };
      page.play();
      fixture.detectChanges();
      expect(botonCon('COORDINATES.actions.stopGame')).toBeUndefined();
    });
  });

  describe('récords', () => {
    function jugar(aciertos: number, color: 'white' | 'black' = 'white') {
      page.boardOrientation = color;
      page.play();
      for (let i = 0; i < aciertos; i++) acertar();
      page.stopGame();
    }

    it('el primer puntaje positivo es récord general y por color', () => {
      abrir();
      jugar(5);
      expect(page.isNewRecord).toBe(true);
      expect(page.recordType).toBe('both');
      expect(confetti.launch).toHaveBeenCalledWith(
        ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'],
        5000,
        'high'
      );
    });

    it('superar solo el mejor del color (pero no el general) es récord de color, con confeti del color', () => {
      estadisticas = { ...statsBase(), bestScore: 50 };
      guardadas = [partidaGuardada(50, 'b'), partidaGuardada(10, 'w')];
      abrir();
      jugar(20, 'white');
      expect(page.isNewRecord).toBe(true);
      expect(page.recordType).toBe('color');
      expect(confetti.launch).toHaveBeenCalledWith(
        ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
        3000,
        'medium'
      );
    });

    it('en negras el confeti es oscuro', () => {
      estadisticas = { ...statsBase(), bestScore: 50 };
      guardadas = [partidaGuardada(50, 'w'), partidaGuardada(10, 'b')];
      abrir();
      jugar(20, 'black');
      expect(page.recordType).toBe('color');
      expect(confetti.launch).toHaveBeenCalledWith(['#000000', '#1a1a1a', '#333333', '#4d4d4d'], 3000, 'medium');
    });

    it('igualar el mejor puntaje del color es un empate, sin confeti', () => {
      estadisticas = { ...statsBase(), bestScore: 20 };
      guardadas = [partidaGuardada(20, 'w')];
      abrir();
      jugar(20, 'white');
      expect(page.isNewRecord).toBe(false);
      expect(page.isTiedRecord).toBe(true);
      expect(confetti.launch).not.toHaveBeenCalled();
    });

    it('quedarse por debajo no es récord ni empate', () => {
      estadisticas = { ...statsBase(), bestScore: 20 };
      guardadas = [partidaGuardada(20, 'w')];
      abrir();
      jugar(3, 'white');
      expect(page.isNewRecord).toBe(false);
      expect(page.isTiedRecord).toBe(false);
      expect(page.recordType).toBeNull();
    });

    it('un puntaje de cero nunca cuenta como empate de récord', () => {
      abrir();
      jugar(0);
      expect(page.isNewRecord).toBe(false);
      expect(page.isTiedRecord).toBe(false);
    });

    it('al terminar recarga estadísticas y puntajes, y registra el resultado', () => {
      abrir();
      storage.getUserStats.mockClear();
      storage.getAllGames.mockClear();
      jugar(4, 'white');
      expect(storage.getUserStats).toHaveBeenCalled();
      expect(storage.getAllGames).toHaveBeenCalled();
      expect(analytics.logEvent).toHaveBeenCalledWith(
        'coordinates_completed',
        expect.objectContaining({
          score: 4,
          correct_answers: 4,
          incorrect_answers: 0,
          accuracy: 100,
          color: 'w',
          infinite_mode: false,
        })
      );
    });

    it('guarda el resultado con las casillas acertadas, falladas y las que se pidieron', () => {
      abrir();
      page.boardOrientation = 'white';
      page.play();
      const pedida = page.currentPuzzle;
      fallar();
      acertar();
      page.stopGame();
      expect(storage.saveGameResult).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 1,
          squaresGood: [pedida],
          squaresBad: [pedida],
          round: page.puzzles,
          color: 'w',
        })
      );
    });
  });

  describe('modal de resultados', () => {
    it('al terminar se abre el modal y "continuar" lo cierra', () => {
      abrir();
      const modal = page.resultsModal as unknown as { present: () => void; dismiss: () => void };
      const presentar = jest.spyOn(modal, 'present');
      const cerrar = jest.spyOn(modal, 'dismiss');
      page.play();
      page.stopGame();
      expect(presentar).toHaveBeenCalled();
      page.closeResultsModal();
      expect(cerrar).toHaveBeenCalled();
    });

    it('el botón "continuar" del modal dispara el cierre', () => {
      abrir();
      const cerrar = jest.spyOn(page, 'closeResultsModal');
      fixture.debugElement.query((d) => d.name === 'app-game-results-modal').componentInstance.closeModal.emit();
      expect(cerrar).toHaveBeenCalled();
    });
  });

  describe('puzzles', () => {
    it('generatePuzzles crea tantas casillas como se pidan', () => {
      abrir();
      expect(page.generatePuzzles()).toHaveLength(1);
      expect(page.generatePuzzles(50)).toHaveLength(50);
    });

    it('las casillas salen de las 64 del tablero', () => {
      abrir();
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(page.generatePuzzles(1)).toEqual(['a1']);
      jest.spyOn(Math, 'random').mockReturnValue(0.999);
      expect(page.generatePuzzles(1)).toEqual(['h8']);
    });
  });
});
