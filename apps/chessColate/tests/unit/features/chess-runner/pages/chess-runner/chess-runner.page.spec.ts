// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class BoardPuzzleSolutionComponent {},
}));

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { Puzzle } from '@chesspark/models';
import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { ConfettiService, SoundsService } from '@chesspark/common-utils';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { AppService } from '@core/app/app.service';
import { AppearanceService } from '@core/app/appearance.service';
import { ProfileService } from '@core/account/profile.service';
import { RunnerEventName, RunnerProgress } from '@features/chess-runner/components/runner-canvas/runner-canvas.component';
import { ChessRunnerPage } from '@features/chess-runner/pages/chess-runner/chess-runner.page';
import { RunnerPuzzleService } from '@features/chess-runner/services/runner-puzzle.service';
import { RunnerStorageService } from '@features/chess-runner/services/runner-storage.service';
import { RunnerPiece, RunnerStats } from '@features/chess-runner/models/runner.model';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';
import { ejercicio } from '@tests/support/pajaro-carpintero';
import {
  AsaRedimensionarFalsa,
  controladorFalso,
  diferida,
  superposicionFalsa,
  TableroPuzzleFalso,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/** El lienzo del runner, sin canvas: mismas entradas y salidas que el real. */
@Component({ selector: 'app-runner-canvas', standalone: true, template: '<div data-testid="lienzo-falso"></div>' })
class LienzoFalso {
  @Input() sequence: RunnerPiece[] = [];
  @Input() gestureZone: HTMLElement | null = null;
  @Output() runnerEvent = new EventEmitter<RunnerEventName>();
  @Output() progress = new EventEmitter<RunnerProgress>();
  @Output() finished = new EventEmitter<RunnerStats>();
  @Output() failed = new EventEmitter<void>();
}

// Posición con peón, torre, alfil, caballo, dama y rey de los dos bandos
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const FEN_NEGRAS = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

const STATS_LIMPIAS: RunnerStats = { total: 6, stumbles: 0, clean: true, durationMs: 14_000 };

describe('ChessRunnerPage', () => {
  let fixture: ComponentFixture<ChessRunnerPage>;
  let page: ChessRunnerPage;

  const router = { navigate: jest.fn() };
  const puzzles = { next: jest.fn() };
  const storage = { isTutorialSeen: jest.fn(), markTutorialSeen: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = { onSessionStarted: jest.fn(), onSessionCompleted: jest.fn() };
  const sounds = {
    playSelect: jest.fn(),
    playMoveSound: jest.fn(),
    playError: jest.fn(),
    playGood: jest.fn(),
  };
  const confetti = { launchTheme: jest.fn() };
  const app = { getNameThemePuzzleByValue: jest.fn() };
  const modal = superposicionFalsa();
  const modalController = controladorFalso(modal);
  let perfil: { uid: string; elo: number } | null;

  const eventos = (nombre: string) =>
    analytics.logEvent.mock.calls.filter(([n]) => n === nombre).map(([, datos]) => datos);
  const el = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const lienzo = () => fixture.debugElement.query(By.directive(LienzoFalso))?.componentInstance as LienzoFalso | undefined;
  const tablero = () =>
    fixture.debugElement.query(By.directive(TableroPuzzleFalso))?.componentInstance as TableroPuzzleFalso | undefined;

  async function entrar() {
    page.ionViewWillEnter();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** Entra con el tutorial ya visto y deja la carrera en marcha. */
  async function entrarYCorrer() {
    storage.isTutorialSeen.mockReturnValue(true);
    await entrar();
  }

  /** Termina la carrera como si Chocolate hubiera llegado al final, y deja pasar la transición. */
  function terminarCarrera(stats: RunnerStats = STATS_LIMPIAS) {
    lienzo()!.finished.emit(stats);
    jest.advanceTimersByTime(450);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    perfil = { uid: 'u1', elo: 1400 };
    puzzles.next.mockImplementation(async () => ejercicio(`ej-${++contador}`, { fen: FEN, rating: 1400, themes: ['fork'] }));
    analytics.logEvent.mockResolvedValue(undefined);
    app.getNameThemePuzzleByValue.mockImplementation((tema: string) => `Tema ${tema}`);
    contador = 0;

    await TestBed.configureTestingModule({
      imports: [ChessRunnerPage, translocoParaPruebas()],
      providers: [
        { provide: Router, useValue: router },
        { provide: RunnerPuzzleService, useValue: puzzles },
        { provide: RunnerStorageService, useValue: storage },
        { provide: AnalyticsService, useValue: analytics },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return perfil;
            },
          },
        },
        { provide: TrainingReminderService, useValue: reminders },
        { provide: SoundsService, useValue: sounds },
        { provide: ConfettiService, useValue: confetti },
        { provide: AppService, useValue: app },
        { provide: AppearanceService, useValue: { pieces: () => 'cburnett' } },
        { provide: ModalController, useValue: modalController },
      ],
    })
      .overrideComponent(ChessRunnerPage, {
        set: {
          imports: [
            CommonModule,
            TranslocoPipe,
            IonContent,
            IonIcon,
            KingImagePipe,
            TableroPuzzleFalso,
            AsaRedimensionarFalsa,
            LienzoFalso,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChessRunnerPage);
    page = fixture.componentInstance;
  });

  let contador = 0;

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  describe('al entrar', () => {
    it('busca un ejercicio del ELO del usuario y muestra «cargando» mientras', async () => {
      const lenta = diferida<Puzzle | null>();
      puzzles.next.mockReturnValueOnce(lenta.promesa);
      storage.isTutorialSeen.mockReturnValue(true);

      page.ionViewWillEnter();
      fixture.detectChanges();

      expect(page.status).toBe('loading');
      expect(el('loading')).not.toBeNull();
      expect(puzzles.next).toHaveBeenCalledWith(1400, expect.any(Set));

      lenta.resolver(ejercicio('x', { fen: FEN }));
      await vaciarPromesas();
    });

    it('sin sesión parte de 1200', async () => {
      perfil = null;
      await entrarYCorrer();

      expect(puzzles.next).toHaveBeenCalledWith(1200, expect.any(Set));
    });

    it('la primera vez enseña el tutorial con las seis piezas y no corre aún', async () => {
      storage.isTutorialSeen.mockReturnValue(false);

      await entrar();

      expect(page.status).toBe('tutorial');
      expect(el('tutorial')).not.toBeNull();
      expect(el('tutorial')!.querySelectorAll('li')).toHaveLength(6);
      expect(lienzo()).toBeUndefined();
      expect(eventos('chess_runner_started')).toEqual([]);
    });

    it('«A correr» lo marca como visto y arranca la carrera', async () => {
      storage.isTutorialSeen.mockReturnValue(false);
      await entrar();

      page.confirmTutorial();
      fixture.detectChanges();

      expect(storage.markTutorialSeen).toHaveBeenCalledTimes(1);
      expect(page.status).toBe('running');
      expect(lienzo()).toBeDefined();
    });

    it('con el tutorial ya visto arranca la carrera directamente', async () => {
      await entrarYCorrer();

      expect(page.status).toBe('running');
      expect(storage.markTutorialSeen).not.toHaveBeenCalled();
    });

    it('arma la carrera con las piezas del ejercicio, empezando por un peón', async () => {
      await entrarYCorrer();

      expect(page.sequence.length).toBeGreaterThan(0);
      expect(page.sequence.length).toBeLessThanOrEqual(8);
      expect(page.sequence[0].kind).toBe('pawn');
      expect(lienzo()!.sequence).toBe(page.sequence);
      expect(page.progress).toEqual({ cleared: 0, total: page.sequence.length, stumbles: 0 });
    });

    it('registra el inicio de la carrera y avisa al recordatorio de que hay sesión', async () => {
      await entrarYCorrer();

      expect(eventos('chess_runner_started')).toEqual([{ obstacles: page.sequence.length }]);
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
    });

    it('un ejercicio sin piezas en el tablero salta la carrera y va directo al ejercicio', async () => {
      puzzles.next.mockResolvedValueOnce(ejercicio('vacio', { fen: '8/8/8/8/8/8/8/8 w - - 0 1' }));
      storage.isTutorialSeen.mockReturnValue(false);

      await entrar();

      expect(page.status).toBe('puzzle');
      expect(el('tutorial')).toBeNull();
    });

    it('si el catálogo no responde enseña el error y deja reintentar', async () => {
      storage.isTutorialSeen.mockReturnValue(true);
      puzzles.next.mockResolvedValueOnce(null);
      await entrar();

      expect(page.status).toBe('error');
      expect(el('error')).not.toBeNull();

      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();
      expect(page.status).toBe('running');
    });
  });

  describe('la carrera', () => {
    beforeEach(() => entrarYCorrer());

    it('traduce cada evento del lienzo en un sonido', () => {
      page.onRunnerEvent('jump');
      page.onRunnerEvent('doubleJump');
      page.onRunnerEvent('cleared');
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('finishing');
      page.onRunnerEvent('landed');

      expect(sounds.playSelect).toHaveBeenCalledTimes(2);
      expect(sounds.playMoveSound).toHaveBeenCalledTimes(1);
      expect(sounds.playError).toHaveBeenCalledTimes(1);
      expect(sounds.playGood).toHaveBeenCalledTimes(1);
    });

    it('el avance del lienzo tacha las piezas ya superadas', () => {
      lienzo()!.progress.emit({ cleared: 2, total: page.sequence.length, stumbles: 1 });
      fixture.detectChanges();

      const marcas = Array.from(el('pips')!.querySelectorAll('img')).map((i) => i.getAttribute('data-cleared'));
      expect(marcas.slice(0, 3)).toEqual(['true', 'true', 'false']);
    });

    it('al terminar la carrera cuenta la analítica y pasa al ejercicio tras la transición', () => {
      lienzo()!.finished.emit(STATS_LIMPIAS);
      fixture.detectChanges();

      expect(eventos('chess_runner_finished')).toEqual([
        { obstacles: 6, stumbles: 0, clean: true, duration_ms: 14_000, skipped: false },
      ]);
      expect(page.status).toBe('running');

      jest.advanceTimersByTime(449);
      expect(page.status).toBe('running');
      jest.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(page.status).toBe('puzzle');
    });

    it('el ejercicio sale con 60 s de reloj, sin descontar nada de la carrera', () => {
      terminarCarrera({ ...STATS_LIMPIAS, durationMs: 40_000 });

      expect((tablero()!.setPuzzle as Puzzle).times).toEqual({ total: 60, warningOn: 30, dangerOn: 15 });
    });

    it('empieza un puzzle y lo registra con el tipo de rutina del runner', () => {
      terminarCarrera();

      expect(eventos('puzzle_started')).toEqual([
        { routine_kind: 'runner', routine_minutes: 0, theme: 'fork', puzzle_elo: 1400 },
      ]);
    });

    it('«Saltar carrera» va directo al ejercicio y lo cuenta como saltada', () => {
      page.skipRun();
      fixture.detectChanges();

      expect(page.status).toBe('puzzle');
      expect(eventos('chess_runner_finished')[0]).toMatchObject({ skipped: true, clean: false });
      expect(tablero()).toBeDefined();
    });

    it('si los recursos del runner no cargan, se juega el ejercicio sin la carrera', () => {
      lienzo()!.failed.emit();
      fixture.detectChanges();

      expect(page.status).toBe('puzzle');
    });

    it('un aviso de fin que llega ya fuera de la carrera se ignora', () => {
      page.skipRun();
      page.onRunnerFinished(STATS_LIMPIAS);

      expect(eventos('chess_runner_finished')).toHaveLength(1);
    });

    it('«saltar» fuera de la carrera no hace nada', () => {
      page.skipRun();
      page.skipRun();

      expect(eventos('chess_runner_finished')).toHaveLength(1);
    });

    it('el color del usuario es el contrario al del turno del FEN: si mueve el rival con blancas, juega con negras', () => {
      terminarCarrera();

      expect(page.playerColor).toBe('black');
    });

    it('con el turno del rival en negras el usuario juega con blancas', async () => {
      page.ionViewWillLeave();
      puzzles.next.mockResolvedValue(ejercicio('negras', { fen: FEN_NEGRAS }));
      await entrarYCorrer();

      terminarCarrera();

      expect(page.playerColor).toBe('white');
    });

    it('si la precarga del siguiente falló lo vuelve a intentar antes de dar error', async () => {
      puzzles.next.mockResolvedValueOnce(null); // la precarga
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      const pedidos = puzzles.next.mock.calls.length;

      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(puzzles.next.mock.calls.length).toBe(pedidos + 1);
      expect(page.status).toBe('running');
    });

    it('el resumen de la carrera enseña si fue limpia o con tropiezos', () => {
      terminarCarrera(STATS_LIMPIAS);
      expect(el('run-summary')!.textContent).toContain('CHESS_RUNNER.runClean');
    });

    it('con tropiezos lo dice con la cuenta', () => {
      terminarCarrera({ total: 6, stumbles: 3, clean: false, durationMs: 20_000 });
      expect(el('run-summary')!.textContent).toContain('CHESS_RUNNER.runStumbles');
    });
  });

  describe('el ejercicio', () => {
    beforeEach(async () => {
      await entrarYCorrer();
      terminarCarrera();
    });

    it('acertar suena, celebra, suma a la sesión y cuenta para el recordatorio', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(sounds.playGood).toHaveBeenCalled();
      expect(confetti.launchTheme).toHaveBeenCalledWith('gold');
      expect(page.solvedCount).toBe(1);
      expect(page.status).toBe('result');
      expect(el('result-message')!.textContent).toContain('CHESS_RUNNER.result.solved');
      expect(reminders.onSessionCompleted).toHaveBeenCalledTimes(1);
      expect(el('session')!.textContent).toContain('CHESS_RUNNER.session');
    });

    it('al acertar no ofrece ver la solución', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('show-solution')).toBeNull();
      expect(el('next')).not.toBeNull();
    });

    it('fallar suena como error, no suma y ofrece la solución y otro ejercicio', () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(sounds.playError).toHaveBeenCalled();
      expect(page.solvedCount).toBe(0);
      expect(el('result-message')!.textContent).toContain('CHESS_RUNNER.result.wrong');
      expect(el('show-solution')).not.toBeNull();
      expect(eventos('puzzle_completed')[0]).toMatchObject({ result: 'bad', routine_kind: 'runner' });
    });

    it('quedarse sin tiempo se dice distinto y se registra como timeout', () => {
      page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('result-message')!.textContent).toContain('CHESS_RUNNER.result.timeout');
      expect(eventos('puzzle_completed')[0]).toMatchObject({ result: 'timeout' });
    });

    it('acertar se registra como bueno, con el ELO del ejercicio y el del usuario', () => {
      page.onPuzzleSolved({ ...(page.puzzleToPlay as Puzzle), timeUsed: 12 });

      expect(eventos('puzzle_completed')).toEqual([
        {
          result: 'good',
          puzzle_elo: 1400,
          user_elo: 1400,
          resolved_time: 12,
          first_theme: 'fork',
          routine_kind: 'runner',
          routine_minutes: 0,
        },
      ]);
    });

    it('un segundo aviso del tablero con el resultado ya dado se ignora', () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);

      expect(page.solvedCount).toBe(0);
      expect(eventos('puzzle_completed')).toHaveLength(1);
    });

    it('detiene el reloj del tablero al terminar', () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

      expect(page.forceStopBoardTimer).toBe(true);
    });

    it('«Ver solución» abre el modal con el ejercicio y sus temas traducidos', async () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

      await page.showSolution();

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          component: BoardPuzzleSolutionComponent,
          componentProps: {
            puzzle: expect.objectContaining({ themes: ['fork'] }),
            themesTranslated: ['Tema fork'],
          },
        })
      );
      expect(modal.present).toHaveBeenCalled();
    });

    it('sin resultado que ver no abre nada', async () => {
      await page.showSolution();
      expect(modalController.create).not.toHaveBeenCalled();
    });
  });

  describe('otro ejercicio', () => {
    beforeEach(async () => {
      await entrarYCorrer();
      terminarCarrera();
    });

    it('mientras se resuelve el actual ya se está bajando el siguiente', () => {
      expect(puzzles.next).toHaveBeenCalledTimes(2); // el actual y el siguiente
    });

    it('«Otro ejercicio» usa el que ya se bajó, sin pedir otro', async () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      const pedidos = puzzles.next.mock.calls.length;

      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(puzzles.next.mock.calls.length).toBe(pedidos);
      expect(page.puzzle?.uid).toBe('ej-2');
      expect(page.status).toBe('running');
    });

    it('nunca repite un ejercicio de la sesión: pasa los ya jugados al servicio', async () => {
      const jugados = puzzles.next.mock.calls[0][1] as Set<string>;
      expect(jugados.has('ej-1')).toBe(true);
    });

    it('la nueva carrera no vuelve a avisar al recordatorio de que empieza la sesión', async () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      page.retry();
      await vaciarPromesas();

      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
    });

    it('la nueva carrera empieza de cero', async () => {
      lienzo()?.progress?.emit({ cleared: 4, total: 6, stumbles: 2 });
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.progress.cleared).toBe(0);
      expect(page.result).toBeNull();
      expect(page.runStats).toBeNull();
    });

    it('si ni siquiera el reintento trae un ejercicio, muestra el error', async () => {
      puzzles.next.mockResolvedValue(null);
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      // El siguiente ya estaba precargado: se juega ese, y es al pedir el que sigue cuando falla
      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('error');
    });
  });

  describe('salir', () => {
    it('la equis lleva al inicio', async () => {
      await entrarYCorrer();
      page.goToHome();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('un ejercicio que llega cuando ya se salió no pinta nada', async () => {
      storage.isTutorialSeen.mockReturnValue(true);
      const lenta = diferida<Puzzle | null>();
      puzzles.next.mockReturnValueOnce(lenta.promesa);

      page.ionViewWillEnter();
      page.ionViewWillLeave();
      lenta.resolver(ejercicio('tarde', { fen: FEN }));
      await vaciarPromesas();

      expect(page.puzzle).toBeNull();
      expect(page.sequence).toEqual([]);
      expect(eventos('chess_runner_started')).toEqual([]);
    });

    it('salir en plena transición cancela el paso al ejercicio', async () => {
      await entrarYCorrer();
      lienzo()!.finished.emit(STATS_LIMPIAS);

      page.ionViewWillLeave();
      jest.advanceTimersByTime(2000);

      expect(page.puzzleToPlay).toBeNull();
    });

    it('al volver a entrar la sesión empieza de cero', async () => {
      await entrarYCorrer();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      page.ionViewWillLeave();

      await entrar();

      expect(page.solvedCount).toBe(0);
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(2);
    });
  });
});
