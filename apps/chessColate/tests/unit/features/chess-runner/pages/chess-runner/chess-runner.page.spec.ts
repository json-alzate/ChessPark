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
import { RunnerRecordService } from '@features/chess-runner/services/runner-record.service';
import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';
import { difficultyForLevel, RunnerDifficulty } from '@features/chess-runner/config/runner.config';
import { COOKIES_PER_HEART, MAX_HEARTS, MAX_STRIKES } from '@features/chess-runner/config/runner.config';
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
  @Input() difficulty: RunnerDifficulty | null = null;
  @Input() tapZone: HTMLElement | null = null;
  @Output() runnerEvent = new EventEmitter<RunnerEventName>();
  @Output() progress = new EventEmitter<RunnerProgress>();
  @Output() finished = new EventEmitter<RunnerStats>();
  @Output() failed = new EventEmitter<void>();
}

// Posición con peón, torre, alfil, caballo, dama y rey de los dos bandos
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const FEN_NEGRAS = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

/** Las piezas del set elegido, como URLs para las miniaturas. */
const PIEZAS = {
  images: new Map<string, CanvasImageSource>(),
  urls: new Map(['w', 'b'].flatMap((c) => ['k', 'q', 'r', 'b', 'n', 'p'].map((l) => [`${c}${l}`, `data:pieza-${c}${l}`] as const))),
};

const STATS_LIMPIAS: RunnerStats = { total: 6, stumbles: 0, clean: true, durationMs: 14_000, bestCombo: 6, meters: 140, cookies: 12 };

describe('ChessRunnerPage', () => {
  let fixture: ComponentFixture<ChessRunnerPage>;
  let page: ChessRunnerPage;

  const router = { navigate: jest.fn() };
  const puzzles = { next: jest.fn() };
  const piezas = { load: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = { onSessionStarted: jest.fn(), onSessionCompleted: jest.fn() };
  const sounds = {
    playSelect: jest.fn(),
    playMoveSound: jest.fn(),
    playError: jest.fn(),
    playGood: jest.fn(),
    playCaptureSound: jest.fn(),
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

  /** Entra y deja la carrera en marcha. */
  async function entrarYCorrer() {
    await entrar();
  }

  /** Termina la carrera como si Chocolate hubiera llegado al final, y deja pasar la transición. */
  function terminarCarrera(stats: RunnerStats = STATS_LIMPIAS) {
    lienzo()!.finished.emit(stats);
    jest.advanceTimersByTime(450);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.clearAllMocks();
    perfil = { uid: 'u1', elo: 1400 };
    puzzles.next.mockImplementation(async () => ejercicio(`ej-${++contador}`, { fen: FEN, rating: 1400, themes: ['fork'] }));
    analytics.logEvent.mockResolvedValue(undefined);
    piezas.load.mockResolvedValue(PIEZAS);
    app.getNameThemePuzzleByValue.mockImplementation((tema: string) => `Tema ${tema}`);
    contador = 0;

    await TestBed.configureTestingModule({
      imports: [ChessRunnerPage, translocoParaPruebas()],
      providers: [
        { provide: Router, useValue: router },
        { provide: RunnerPuzzleService, useValue: puzzles },
        { provide: RunnerPiecesService, useValue: piezas },
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

    it('arranca la carrera directamente: no hay tutorial, un toque es todo lo que se necesita', async () => {
      await entrarYCorrer();

      expect(page.status).toBe('running');
      expect(lienzo()).toBeDefined();
      expect(el('tutorial')).toBeNull();
    });

    it('las miniaturas de la carrera son las piezas del set que el usuario eligió', async () => {
      await entrarYCorrer();

      const miniaturas = Array.from(el('pips')!.querySelectorAll('img')).map((i) => i.getAttribute('src'));
      expect(miniaturas).toHaveLength(page.sequence.length);
      expect(miniaturas.every((src) => src?.startsWith('data:pieza-'))).toBe(true);
    });

    it('si el set de piezas no baja, la carrera arranca igual (el lienzo avisará y se saltará)', async () => {
      piezas.load.mockRejectedValue(new Error('sin red'));

      await entrarYCorrer();

      expect(page.status).toBe('running');
      expect(el('pips')!.querySelectorAll('img')).toHaveLength(0);
    });

    it('arma la carrera con las piezas del ejercicio, empezando por un peón', async () => {
      await entrarYCorrer();

      expect(page.sequence.length).toBeGreaterThan(0);
      expect(page.sequence.length).toBeLessThanOrEqual(8);
      expect(page.sequence[0].kind).toBe('pawn');
      expect(lienzo()!.sequence).toBe(page.sequence);
      expect(page.progress).toEqual({ cleared: 0, total: page.sequence.length, stumbles: 0, combo: 0, meters: 0, cookies: 0 });
    });

    it('registra el inicio de la carrera y avisa al recordatorio de que hay sesión', async () => {
      await entrarYCorrer();

      expect(eventos('chess_runner_started')).toEqual([{ obstacles: page.sequence.length, level: 1 }]);
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
    });

    it('un ejercicio sin piezas en el tablero salta la carrera y va directo al ejercicio', async () => {
      puzzles.next.mockResolvedValueOnce(ejercicio('vacio', { fen: '8/8/8/8/8/8/8/8 w - - 0 1' }));

      await entrar();

      expect(page.status).toBe('puzzle');
      expect(lienzo()).toBeUndefined();
    });

    it('si el catálogo no responde enseña el error y deja reintentar', async () => {
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
      page.onRunnerEvent('cleared');
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('finishing');
      page.onRunnerEvent('landed');

      expect(sounds.playSelect).toHaveBeenCalledTimes(1);
      expect(sounds.playMoveSound).toHaveBeenCalledTimes(1);
      expect(sounds.playError).toHaveBeenCalledTimes(1);
      expect(sounds.playGood).toHaveBeenCalledTimes(1);
    });

    it('el avance del lienzo tacha las piezas ya superadas', () => {
      lienzo()!.progress.emit({ cleared: 2, total: page.sequence.length, stumbles: 1, combo: 0, meters: 0, cookies: 0 });
      fixture.detectChanges();

      const marcas = Array.from(el('pips')!.querySelectorAll('img')).map((i) => i.getAttribute('data-cleared'));
      expect(marcas.slice(0, 3)).toEqual(['true', 'true', 'false']);
    });

    it('al terminar la carrera cuenta la analítica y pasa al ejercicio tras la transición', () => {
      lienzo()!.finished.emit(STATS_LIMPIAS);
      fixture.detectChanges();

      expect(eventos('chess_runner_finished')).toEqual([
        { obstacles: 6, stumbles: 0, clean: true, duration_ms: 14_000, meters: 140, cookies: 12, hearts: 3, best_combo: 6, level: 1, skipped: false },
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
      terminarCarrera({ total: 6, stumbles: 3, clean: false, durationMs: 20_000, bestCombo: 2, meters: 150, cookies: 3 });
      expect(el('run-summary')!.textContent).toContain('CHESS_RUNNER.runStumbles');
    });
  });

  describe('la partida: corazones, fallos, distancia y récord', () => {
    const progreso = (extra: Partial<RunnerProgress> = {}): RunnerProgress => ({
      cleared: 0,
      total: 6,
      stumbles: 0,
      combo: 0,
      meters: 0,
      cookies: 0,
      ...extra,
    });
    const chocar = () => {
      lienzo()!.runnerEvent.emit('stumble');
      fixture.detectChanges();
    };
    const corazonesLlenos = () => fixture.nativeElement.querySelectorAll('[data-testid=hearts] [data-full=true]').length;
    const registro = () => TestBed.inject(RunnerRecordService);

    /** Resuelve el ejercicio y deja que arranque la siguiente carrera. */
    async function resolverYSeguir() {
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();
      fixture.detectChanges();
    }

    /** Falla el ejercicio y pasa a la siguiente carrera. */
    async function fallarYSeguir() {
      terminarCarrera();
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();
    }

    it('empieza con tres corazones, ningún fallo y la distancia a cero', async () => {
      await entrarYCorrer();

      expect(page.hearts).toBe(MAX_HEARTS);
      expect(page.strikes).toBe(0);
      expect(page.meters).toBe(0);
      expect(corazonesLlenos()).toBe(3);
      expect(el('meters')!.textContent).toContain('CHESS_RUNNER.meters');
    });

    it('un choque cuesta un corazón y se ve', async () => {
      await entrarYCorrer();

      chocar();

      expect(page.hearts).toBe(2);
      expect(corazonesLlenos()).toBe(2);
      expect(page.status).toBe('running');
    });

    it('con el tercer choque se acaba la partida, en mitad de la carrera', async () => {
      await entrarYCorrer();
      lienzo()!.progress.emit(progreso({ meters: 87 }));

      chocar();
      chocar();
      chocar();

      expect(page.status).toBe('gameover');
      expect(page.gameOver).toMatchObject({ reason: 'hits', meters: 87, newRecord: true, level: 1, solved: 0 });
      expect(lienzo()).toBeUndefined();
      expect(el('game-over')).not.toBeNull();
      expect(eventos('chess_runner_game_over')).toEqual([
        { reason: 'hits', meters: 87, level: 1, solved: 0, cookies: 0, new_record: true },
      ]);
    });

    it('un choque fuera de la carrera no cuenta (ya no hay nada que chocar)', async () => {
      await entrarYCorrer();
      terminarCarrera();
      const corazones = page.hearts;

      page.onRunnerEvent('stumble');

      expect(page.hearts).toBe(corazones);
    });

    it('resolver un ejercicio cura un corazón, hasta el máximo', async () => {
      await entrarYCorrer();
      chocar();
      chocar();
      expect(page.hearts).toBe(1);

      await resolverYSeguir();
      expect(page.hearts).toBe(2);

      await resolverYSeguir();
      await resolverYSeguir();
      expect(page.hearts).toBe(MAX_HEARTS);
    });

    describe('ejercicios fallidos', () => {
      it('fallar o quedarse sin tiempo cuenta un fallo; resolver, no', async () => {
        await entrarYCorrer();

        terminarCarrera();
        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
        expect(page.strikes).toBe(1);

        page.retry();
        await vaciarPromesas();
        fixture.detectChanges();
        terminarCarrera();
        page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);
        fixture.detectChanges();
        expect(page.strikes).toBe(2);
        expect(el('strikes')!.textContent).toContain('CHESS_RUNNER.strikes');

        page.retry();
        await vaciarPromesas();
        fixture.detectChanges();
        terminarCarrera();
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        expect(page.strikes).toBe(2);
      });

      it('con el tercer fallo no se ofrece otro ejercicio: se avisa y se puede ver la solución o terminar', async () => {
        await entrarYCorrer();
        await fallarYSeguir();
        await fallarYSeguir();
        terminarCarrera();

        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
        fixture.detectChanges();

        expect(page.strikes).toBe(MAX_STRIKES);
        expect(page.outOfStrikes).toBe(true);
        expect(el('last-strike')).not.toBeNull();
        expect(el('next')).toBeNull();
        expect(el('show-solution')).not.toBeNull();
        expect(el('finish-game')).not.toBeNull();
      });

      it('«Ver resultado» tras el tercer fallo termina la partida', async () => {
        await entrarYCorrer();
        await fallarYSeguir();
        await fallarYSeguir();
        terminarCarrera();
        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

        page.finishGame();
        fixture.detectChanges();

        expect(page.status).toBe('gameover');
        expect(page.gameOver).toMatchObject({ reason: 'strikes' });
        expect(page.puzzle).toBeNull();
      });

      it('cerrar la solución del tercer fallo también termina la partida, en vez de seguir', async () => {
        await entrarYCorrer();
        await fallarYSeguir();
        await fallarYSeguir();
        terminarCarrera();
        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

        await page.showSolution();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.status).toBe('gameover');
        expect(page.gameOver?.reason).toBe('strikes');
      });

      it('antes del tercer fallo, finishGame no hace nada', async () => {
        await entrarYCorrer();
        terminarCarrera();
        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

        page.finishGame();

        expect(page.status).toBe('result');
      });
    });

    describe('distancia y récord', () => {
      it('los metros de la carrera en curso suben, y al terminarla pasan a la cuenta de la partida', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 40 }));
        expect(page.meters).toBe(40);

        terminarCarrera({ ...STATS_LIMPIAS, meters: 150 });
        expect(page.meters).toBe(150);

        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(1600);
        await vaciarPromesas();
        fixture.detectChanges();
        lienzo()!.progress.emit(progreso({ meters: 25 }));

        expect(page.meters).toBe(175);
      });

      it('«Saltar carrera» no pierde lo corrido hasta ese momento', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 33 }));

        page.skipRun();

        expect(page.meters).toBe(33);
        expect(registro().best()).toBe(33);
      });

      it('el récord se guarda al terminar cada carrera', async () => {
        await entrarYCorrer();
        terminarCarrera({ ...STATS_LIMPIAS, meters: 150 });

        expect(registro().best()).toBe(150);
        expect(page.record).toBe(150);
      });

      it('mientras se corre se ve el récord y los metros', async () => {
        registro().save(321);
        await entrarYCorrer();

        expect(el('record')!.textContent).toContain('CHESS_RUNNER.meters');
        expect(page.bestMeters).toBe(321);
        expect(el('meters')).not.toBeNull();
      });

      it('el récord a mostrar sube con la partida aunque todavía no se haya guardado', async () => {
        registro().save(100);
        await entrarYCorrer();
        expect(page.bestMeters).toBe(100);

        lienzo()!.progress.emit(progreso({ meters: 130 }));

        expect(page.bestMeters).toBe(130);
      });

      it('al acabar, anuncia el nuevo récord y lo guarda', async () => {
        registro().save(50);
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 200 }));
        chocar();
        chocar();
        chocar();

        expect(page.gameOver).toMatchObject({ newRecord: true, record: 200, meters: 200 });
        expect(registro().best()).toBe(200);
        expect(el('new-record')).not.toBeNull();
        expect(el('game-over-record')).toBeNull();
        expect(el('game-over-meters')!.textContent).toContain('CHESS_RUNNER.meters');
      });

      it('si no lo supera, enseña el récord que sigue vigente', async () => {
        registro().save(500);
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 80 }));
        chocar();
        chocar();
        chocar();

        expect(page.gameOver).toMatchObject({ newRecord: false, record: 500, meters: 80 });
        expect(el('new-record')).toBeNull();
        expect(el('game-over-record')).not.toBeNull();
      });

      it('salir a mitad de partida guarda lo corrido como récord', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 64 }));

        page.ionViewWillLeave();

        expect(registro().best()).toBe(64);
      });

      it('la pantalla de fin de partida enseña nivel, resueltos y galletas', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        lienzo()!.progress.emit(progreso({ meters: 10, cookies: 7 }));
        chocar();
        chocar();
        chocar();

        expect(el('game-over-level')!.textContent).toContain('2');
        expect(el('game-over-solved')!.textContent).toContain('1');
        expect(el('game-over-cookies')!.textContent).toContain('7');
        expect(el('game-over-reason')!.textContent).toContain('CHESS_RUNNER.gameOver.hits');
      });
    });

    describe('galletas', () => {
      it('las galletas de la carrera suman hacia el próximo corazón', async () => {
        await entrarYCorrer();

        lienzo()!.progress.emit(progreso({ cookies: 4 }));
        lienzo()!.progress.emit(progreso({ cookies: 9 }));

        expect(page.cookiesTotal).toBe(9);
        expect(page.cookieStreak).toBe(9);
        fixture.detectChanges();
        expect(el('cookies')!.textContent).toContain(`9/${COOKIES_PER_HEART}`);
      });

      it('al juntar las suficientes se recupera un corazón y la cuenta vuelve a empezar', async () => {
        await entrarYCorrer();
        chocar();
        expect(page.hearts).toBe(2);

        lienzo()!.progress.emit(progreso({ cookies: COOKIES_PER_HEART + 4 }));

        expect(page.hearts).toBe(3);
        expect(page.cookieStreak).toBe(4);
        expect(page.cookiesTotal).toBe(COOKIES_PER_HEART + 4);
        expect(sounds.playGood).toHaveBeenCalled();
      });

      it('con los corazones llenos no hay corazón de más, pero la cuenta sigue', async () => {
        await entrarYCorrer();

        lienzo()!.progress.emit(progreso({ cookies: COOKIES_PER_HEART }));

        expect(page.hearts).toBe(MAX_HEARTS);
        expect(page.cookieStreak).toBe(0);
      });

      it('las galletas de la carrera siguiente se cuentan desde cero, no otra vez las anteriores', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ cookies: 10 }));
        terminarCarrera({ ...STATS_LIMPIAS, cookies: 10 });
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(1600);
        await vaciarPromesas();
        fixture.detectChanges();

        lienzo()!.progress.emit(progreso({ cookies: 3 }));

        expect(page.cookiesTotal).toBe(13);
      });

      it('suenan, pero una fila de varias seguidas no hace una cascada', async () => {
        await entrarYCorrer();

        page.onRunnerEvent('cookie');
        page.onRunnerEvent('cookie');
        page.onRunnerEvent('cookie');
        expect(sounds.playCaptureSound).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(200);
        page.onRunnerEvent('cookie');
        expect(sounds.playCaptureSound).toHaveBeenCalledTimes(2);
      });

      it('el doble salto suena como el salto', async () => {
        await entrarYCorrer();

        page.onRunnerEvent('doubleJump');

        expect(sounds.playSelect).toHaveBeenCalled();
      });
    });

    describe('«Jugar otra vez»', () => {
      it('empieza una partida nueva desde el nivel 1, con todo a cero salvo el récord', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        await resolverYSeguir();
        lienzo()!.progress.emit(progreso({ meters: 90, cookies: 5 }));
        chocar();
        chocar();
        chocar();
        expect(page.level).toBe(3);

        page.playAgain();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.status).toBe('running');
        expect(page.gameOver).toBeNull();
        expect(page.level).toBe(1);
        expect(page.hearts).toBe(MAX_HEARTS);
        expect(page.strikes).toBe(0);
        expect(page.meters).toBe(0);
        expect(page.cookiesTotal).toBe(0);
        // Los dos ejercicios resueltos (140 m cada carrera) más lo corrido antes de perder
        expect(page.record).toBe(370);
        expect(lienzo()!.difficulty).toEqual(difficultyForLevel(1));
      });

      it('el botón de la pantalla final hace lo mismo, y el otro lleva al inicio', async () => {
        await entrarYCorrer();
        chocar();
        chocar();
        chocar();

        (el('game-over-exit') as HTMLButtonElement).click();
        expect(router.navigate).toHaveBeenCalledWith(['/home']);

        (el('play-again') as HTMLButtonElement).click();
        await vaciarPromesas();
        fixture.detectChanges();
        expect(page.status).toBe('running');
      });
    });

    describe('el cartel de cada carrera', () => {
      it('el nivel 1 explica lo básico', async () => {
        await entrarYCorrer();

        expect(page.bannerHint).toBe('first');
      });

      it('la primera vez que sale una falange se explica el doble salto, y luego ya no', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        expect(page.level).toBe(2);
        expect(page.sequence.some((p) => (p.wall ?? 1) > 1)).toBe(true);
        expect(page.bannerHint).toBe('doubleJump');
        expect(el('level-banner')!.textContent).toContain('CHESS_RUNNER.levelHint.doubleJump');

        await resolverYSeguir();
        expect(page.level).toBe(3);
        expect(page.bannerHint).toBe('faster');
      });

      it('al cambiar de escenario el cartel lo dice', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        await resolverYSeguir();
        await resolverYSeguir();

        expect(page.level).toBe(4);
        expect(page.bannerHint).toBe('world.sunset');
      });

      it('las carreras llevan falanges según el nivel', async () => {
        await entrarYCorrer();
        expect(page.sequence.every((p) => (p.wall ?? 1) === 1)).toBe(true);

        await resolverYSeguir();
        expect(page.sequence.filter((p) => (p.wall ?? 1) > 1)).toHaveLength(1);
      });
    });

    it('una partida nueva al volver a entrar a la pantalla: todo a cero', async () => {
      await entrarYCorrer();
      chocar();
      await resolverYSeguir();

      page.ionViewWillEnter();
      await vaciarPromesas();

      expect(page.hearts).toBe(MAX_HEARTS);
      expect(page.level).toBe(1);
      expect(page.strikes).toBe(0);
    });
  });

  describe('el nivel y la racha', () => {
    it('la primera carrera es el nivel 1 y se anuncia', async () => {
      await entrarYCorrer();

      expect(page.level).toBe(1);
      expect(el('level')!.textContent).toContain('CHESS_RUNNER.level');
      expect(el('level-banner')!.textContent).toContain('CHESS_RUNNER.levelHint.first');
      expect(lienzo()!.difficulty).toEqual(difficultyForLevel(1));
    });

    it('cada ejercicio resuelto sube un nivel: la siguiente carrera es más rápida y de ritmo más apretado', async () => {
      await entrarYCorrer();
      const primera = lienzo()!.difficulty!;
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();
      fixture.detectChanges();

      const segunda = lienzo()!.difficulty!;
      expect(page.level).toBe(2);
      expect(segunda).toEqual(difficultyForLevel(2));
      expect(segunda.startSpeed).toBeGreaterThan(primera.startSpeed);
      expect(segunda.minGapTime).toBeLessThan(primera.minGapTime);
      // La primera falange trae la explicación del doble salto; las siguientes carreras, el «más rápido»
      expect(el('level-banner')!.textContent).toContain('CHESS_RUNNER.levelHint.doubleJump');
    });

    it('fallar un ejercicio no hace bajar el nivel', async () => {
      await entrarYCorrer();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.level).toBe(2);
      expect(lienzo()!.difficulty).toEqual(difficultyForLevel(2));
    });

    it('al entrar de nuevo vuelve al nivel 1', async () => {
      await entrarYCorrer();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();

      page.ionViewWillEnter();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.level).toBe(1);
    });

    it('la racha se ve y se enciende a partir de tres piezas seguidas', async () => {
      await entrarYCorrer();
      expect(el('combo')!.textContent).toContain('CHESS_RUNNER.combo');
      expect(el('combo')!.classList).not.toContain('badge-warning');

      lienzo()!.progress.emit({ cleared: 3, total: 6, stumbles: 0, combo: 3, meters: 0, cookies: 0 });
      fixture.detectChanges();

      expect(el('combo')!.classList).toContain('badge-warning');
    });

    it('un tropiezo manda una vibración corta donde el navegador la tenga', async () => {
      const vibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      await entrarYCorrer();

      page.onRunnerEvent('stumble');

      expect(vibrate).toHaveBeenCalledWith(60);
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
      expect(() => page.onRunnerEvent('stumble')).not.toThrow();
    });

    it('la carrera acabada se registra con el nivel y la mejor racha', async () => {
      await entrarYCorrer();
      terminarCarrera();

      expect(eventos('chess_runner_started')[0]).toMatchObject({ level: 1 });
      expect(eventos('chess_runner_finished')[0]).toMatchObject({ level: 1, best_combo: 6 });
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

    it('al acertar el tablero sigue siendo el mismo: no se recrea, así que no repite la primera jugada del rival', () => {
      const antes = tablero();
      const nodo = el('tablero');

      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      // Se comparan como booleanos: si fallara, jest intentaría imprimir dos componentes enteros y se quedaría sin memoria
      expect(tablero() === antes).toBe(true);
      expect(el('tablero') === nodo).toBe(true);
    });

    it('lo mismo al fallarlo o quedarse sin tiempo: el tablero no se recrea', () => {
      const antes = tablero();

      page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(tablero() === antes).toBe(true);
    });

    it('al acertar dice a qué nivel se sube', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('level-up')!.textContent).toContain('CHESS_RUNNER.result.levelUp');
      expect(page.level).toBe(2);
    });

    it('al acertar no hay botones: la siguiente carrera arranca sola', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('show-solution')).toBeNull();
      expect(el('next')).toBeNull();
      expect(el('auto-next')).not.toBeNull();
    });

    it('tras el confeti pasa sola a la siguiente carrera, con el ejercicio que ya se había bajado', async () => {
      const pedidos = puzzles.next.mock.calls.length;
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      jest.advanceTimersByTime(1599);
      expect(page.status).toBe('result');
      jest.advanceTimersByTime(1);
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('running');
      expect(page.puzzle?.uid).toBe('ej-2');
      expect(page.result).toBeNull();
      expect(puzzles.next.mock.calls.length).toBe(pedidos);
      expect(el('lienzo-falso')).not.toBeNull();
    });

    it('la sesión sigue contando: cada acierto suma y encadena la siguiente carrera', async () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1600);
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.solvedCount).toBe(2);
      expect(page.status).toBe('running');
      expect(page.puzzle?.uid).toBe('ej-3');
    });

    it('fallar o quedarse sin tiempo no avanza solo: deja ver la solución y espera al botón', async () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(10_000);
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('result');
      expect(el('next')).not.toBeNull();
      expect(el('auto-next')).toBeNull();
    });

    it('el botón «Otro ejercicio» de un fallo cancela nada ni duplica: una sola carrera nueva', async () => {
      page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);
      page.retry();
      await vaciarPromesas();
      jest.advanceTimersByTime(10_000);
      await vaciarPromesas();

      expect(page.puzzle?.uid).toBe('ej-2');
    });

    it('si se pulsa «salir» durante el confeti, la siguiente carrera no arranca', async () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      page.ionViewWillLeave();
      jest.advanceTimersByTime(5000);
      await vaciarPromesas();

      expect(page.status).not.toBe('running');
      expect(page.puzzle).toBeNull();
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

    it('al cerrar la solución, el juego sigue con la siguiente carrera (no deja el tablero parado)', async () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

      await page.showSolution();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('running');
      expect(page.puzzle?.uid).toBe('ej-2');
      expect(page.result).toBeNull();
      expect(page.level).toBe(1);
    });

    it('mientras la solución está abierta no avanza; solo al cerrarla', async () => {
      const abierta = diferida<{ role?: string }>();
      modal.onDidDismiss.mockReturnValueOnce(abierta.promesa);
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

      const mostrando = page.showSolution();
      await vaciarPromesas();
      expect(page.status).toBe('result');

      abierta.resolver({ role: 'cancel' });
      await mostrando;
      await vaciarPromesas();
      expect(page.status).toBe('running');
    });

    it('si se sale de la pantalla con la solución abierta, al cerrarla no arranca nada', async () => {
      const abierta = diferida<{ role?: string }>();
      modal.onDidDismiss.mockReturnValueOnce(abierta.promesa);
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);

      const mostrando = page.showSolution();
      await vaciarPromesas();
      page.ionViewWillLeave();
      abierta.resolver({ role: 'cancel' });
      await mostrando;
      await vaciarPromesas();

      expect(page.status).not.toBe('running');
      expect(page.puzzle).toBeNull();
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
      lienzo()?.progress?.emit({ cleared: 4, total: 6, stumbles: 2, combo: 3, meters: 0, cookies: 0 });
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

    it('las piezas del set que llegan cuando ya se salió no arrancan la carrera', async () => {
      const lentas = diferida<typeof PIEZAS>();
      piezas.load.mockReturnValueOnce(lentas.promesa);

      page.ionViewWillEnter();
      await vaciarPromesas();
      page.ionViewWillLeave();
      lentas.resolver(PIEZAS);
      await vaciarPromesas();

      expect(page.status).not.toBe('running');
      expect(eventos('chess_runner_started')).toEqual([]);
    });

    it('un ejercicio que llega cuando ya se salió no pinta nada', async () => {
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
