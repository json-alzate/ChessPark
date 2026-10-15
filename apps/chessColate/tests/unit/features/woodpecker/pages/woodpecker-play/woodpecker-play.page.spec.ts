// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar. Aquí
// no se dibuja ningún tablero: se sustituye por dobles y la plantilla usa uno
// falso con los mismos inputs/outputs.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class BoardPuzzleSolutionComponent {},
}));

import { CommonModule } from '@angular/common';
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
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { WoodpeckerCycleResultComponent } from '@features/woodpecker/components/woodpecker-cycle-result/woodpecker-cycle-result.component';
import { WoodpeckerPlayPage } from '@features/woodpecker/pages/woodpecker-play/woodpecker-play.page';
import { WoodpeckerSetService } from '@features/woodpecker/services/woodpecker-set.service';
import { WoodpeckerStorageService } from '@features/woodpecker/services/woodpecker-storage.service';
import { WoodpeckerService } from '@features/woodpecker/services/woodpecker.service';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';
import {
  configuracion,
  conjunto,
  ejercicio,
} from '@tests/support/pajaro-carpintero';
import {
  controladorFalso,
  superposicionFalsa,
  TableroPuzzleFalso,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Pantalla de juego del Pájaro Carpintero. El servicio y el almacenamiento son
 * los reales (sobre el `localStorage` de jsdom): lo que se comprueba es que lo
 * que hace el usuario en el tablero queda guardado y reanudable. El tablero, la
 * analítica y el resto de servicios son dobles; el reloj es el de Jest.
 */

const FEN_BLANCAS_MUEVE_RIVAL = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const FEN_NEGRAS_MUEVE_RIVAL = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const AHORA = new Date('2026-03-10T10:00:00Z').getTime();

/** Set de 3 ejercicios y 2 vueltas, con el orden «mismo» para no depender del azar. */
const PUZZLES: Puzzle[] = [
  ejercicio('p1', { rating: 1400, fen: FEN_BLANCAS_MUEVE_RIVAL, themes: ['fork'] }),
  ejercicio('p2', { rating: 1450, fen: FEN_NEGRAS_MUEVE_RIVAL, themes: ['pin'] }),
  ejercicio('p3', { rating: 1500, fen: FEN_BLANCAS_MUEVE_RIVAL, themes: ['mateIn2'] }),
];
const CONFIG = configuracion({
  cycles: 2,
  targetCount: 3,
  minCount: 2,
  order: 'same',
  timing: 'decreasing',
  baseTimePerPuzzleSec: 60,
  decreasePercent: 20,
});

describe('WoodpeckerPlayPage', () => {
  let fixture: ComponentFixture<WoodpeckerPlayPage>;
  let page: WoodpeckerPlayPage;
  let storage: WoodpeckerStorageService;

  const router = { navigate: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = { onSessionStarted: jest.fn(), onSessionCompleted: jest.fn() };
  const sounds = { playGood: jest.fn(), playError: jest.fn() };
  const confetti = { launchTheme: jest.fn() };
  const app = { getNameThemePuzzleByValue: jest.fn() };
  const modal = superposicionFalsa();
  const modalController = controladorFalso(modal);

  const eventos = (nombre: string) =>
    analytics.logEvent.mock.calls.filter(([n]) => n === nombre).map(([, datos]) => datos);
  const el = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const texto = (id: string) => el(id)?.textContent ?? '';
  const tablero = () =>
    fixture.debugElement.query(By.directive(TableroPuzzleFalso))?.componentInstance as
      | TableroPuzzleFalso
      | undefined;
  const guardado = () => storage.getState()!.progress;

  /** Entra y deja correr el aviso de la vuelta. */
  async function entrar() {
    page.ionViewWillEnter();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** Pulsa «Empezar» y espera a que el primer ejercicio esté en el tablero. */
  async function empezar() {
    await entrar();
    page.startPlaying();
    fixture.detectChanges();
  }

  /** Resuelve el ejercicio en pantalla y deja pasar la pausa hasta el siguiente. */
  function acertar(avanzar = true) {
    page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
    if (avanzar) {
      jest.advanceTimersByTime(450);
    }
    fixture.detectChanges();
  }

  function fallar() {
    page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
    fixture.detectChanges();
  }

  /** Juega una vuelta entera acertando todo y devuelve lo que enseña al terminar. */
  function jugarVueltaAcertando() {
    for (let i = 0; i < PUZZLES.length; i++) {
      acertar();
    }
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA);
    jest.clearAllMocks();
    localStorage.clear();
    analytics.logEvent.mockResolvedValue(undefined);
    app.getNameThemePuzzleByValue.mockImplementation((tema: string) => `Tema ${tema}`);

    await TestBed.configureTestingModule({
      imports: [WoodpeckerPlayPage, translocoParaPruebas()],
      providers: [
        WoodpeckerService,
        WoodpeckerStorageService,
        { provide: WoodpeckerSetService, useValue: { generate: jest.fn(), availableThemes: [] } },
        { provide: Router, useValue: router },
        { provide: AnalyticsService, useValue: analytics },
        { provide: ProfileService, useValue: { getProfile: { uid: 'u1', elo: 1500 } } },
        { provide: TrainingReminderService, useValue: reminders },
        { provide: SoundsService, useValue: sounds },
        { provide: ConfettiService, useValue: confetti },
        { provide: AppService, useValue: app },
        { provide: AppearanceService, useValue: { pieces: () => 'cburnett' } },
        { provide: ModalController, useValue: modalController },
      ],
    })
      .overrideComponent(WoodpeckerPlayPage, {
        set: {
          imports: [
            CommonModule,
            TranslocoPipe,
            IonContent,
            IonIcon,
            TableroPuzzleFalso,
            KingImagePipe,
            WoodpeckerCycleResultComponent,
          ],
        },
      })
      .compileComponents();

    storage = TestBed.inject(WoodpeckerStorageService);
    storage.saveNewSet(conjunto(PUZZLES, { config: CONFIG }));

    fixture = TestBed.createComponent(WoodpeckerPlayPage);
    page = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  describe('al entrar', () => {
    it('sin set no hay nada que jugar: vuelve a la pantalla del set', async () => {
      storage.clear();

      await entrar();

      expect(router.navigate).toHaveBeenCalledWith(['/woodpecker'], { replaceUrl: true });
      expect(page.status).not.toBe('ready');
    });

    it('con el set terminado tampoco: vuelve a la pantalla del set', async () => {
      storage.saveProgress({ setId: 'set-1', cycles: [], completedAt: 5 });

      await entrar();

      expect(router.navigate).toHaveBeenCalledWith(['/woodpecker'], { replaceUrl: true });
    });

    it('enseña el aviso de la vuelta 1 con su reloj, sin tocar el tablero ni el recordatorio', async () => {
      await entrar();

      expect(page.status).toBe('ready');
      expect([page.cycleNumber, page.totalCycles, page.setSize]).toEqual([1, 2, 3]);
      expect(page.secondsPerPuzzle).toBe(60);
      expect(tablero()).toBeUndefined();
      expect(reminders.onSessionStarted).not.toHaveBeenCalled();
      expect(texto('ready')).toContain('WOODPECKER.play.ready.firstCycleHint');
      expect(texto('start')).toContain('WOODPECKER.play.ready.start');
    });

    it('el aviso de la primera vuelta no es el de las siguientes', async () => {
      await empezar();
      jugarVueltaAcertando();
      page.nextCycle();
      fixture.detectChanges();

      expect(page.cycleNumber).toBe(2);
      expect(page.secondsPerPuzzle).toBe(48);
      expect(texto('ready')).toContain('WOODPECKER.play.ready.laterHint');
    });

    it('sin reloj lo dice en el aviso', async () => {
      storage.saveNewSet(conjunto(PUZZLES, { config: { ...CONFIG, timing: 'none' } }));

      await entrar();

      expect(page.secondsPerPuzzle).toBeNull();
      expect(texto('ready')).toContain('WOODPECKER.dashboard.noClock');
    });

    it('registra el inicio de la vuelta una sola vez', async () => {
      await entrar();
      expect(eventos('woodpecker_cycle_started')).toEqual([{ cycle: 1, set_size: 3 }]);
    });
  });

  describe('jugar', () => {
    it('«Empezar» pone el primer ejercicio con el tiempo de la vuelta y avisa al recordatorio', async () => {
      await empezar();

      expect(page.status).toBe('playing');
      expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p1');
      expect((tablero()!.setPuzzle as Puzzle).times).toEqual({ total: 60, warningOn: 30, dangerOn: 15 });
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
      expect(eventos('puzzle_started')).toEqual([
        { routine_kind: 'woodpecker', routine_minutes: 0, theme: 'fork', puzzle_elo: 1400 },
      ]);
    });

    it('sin reloj el ejercicio llega sin tiempos', async () => {
      storage.saveNewSet(conjunto(PUZZLES, { config: { ...CONFIG, timing: 'none' } }));
      await empezar();

      expect((tablero()!.setPuzzle as Puzzle).times).toBeUndefined();
    });

    it('el color del usuario es el contrario al del turno del FEN', async () => {
      await empezar();
      expect(page.playerColor).toBe('black'); // p1: mueve el rival con blancas

      acertar();
      expect(page.playerColor).toBe('white'); // p2: mueve el rival con negras
    });

    describe('acierto', () => {
      it('suma, suena, se guarda y registra la analítica', async () => {
        await empezar();
        jest.advanceTimersByTime(7_000);

        acertar(false);

        expect(sounds.playGood).toHaveBeenCalledTimes(1);
        expect(page.solved).toBe(1);
        expect(page.answered).toBe(1);
        expect(guardado().cycles[0].results).toEqual([
          { uidPuzzle: 'p1', resolved: true, failByTime: false, timeMs: 7_000 },
        ]);
        expect(eventos('puzzle_completed')).toEqual([
          {
            result: 'good',
            puzzle_elo: 1400,
            user_elo: 1500,
            resolved_time: 7,
            first_theme: 'fork',
            routine_kind: 'woodpecker',
            routine_minutes: 0,
          },
        ]);
      });

      it('espera un respiro antes del siguiente ejercicio', async () => {
        await empezar();

        acertar(false);
        expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p1');

        jest.advanceTimersByTime(449);
        expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p1');

        jest.advanceTimersByTime(1);
        fixture.detectChanges();
        expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p2');
      });

      it('un toque de más durante el respiro no cuenta como fallo ni como otro acierto', async () => {
        await empezar();
        acertar(false);

        page.onPuzzleFailed(PUZZLES[0]);
        page.onPuzzleSolved(PUZZLES[0]);

        expect(guardado().cycles[0].results).toHaveLength(1);
        expect(page.status).toBe('playing');
      });

      it('mide lo que tardó en cada ejercicio por separado', async () => {
        await empezar();
        jest.advanceTimersByTime(4_000);
        acertar();
        jest.advanceTimersByTime(9_000);
        acertar();

        // El respiro tras el acierto no cuenta como tiempo del ejercicio siguiente
        expect(guardado().cycles[0].results.map((r) => r.timeMs)).toEqual([4_000, 9_000]);
      });

      it('no anota más de 5 minutos por ejercicio (app abierta sin tocar)', async () => {
        await empezar();
        jest.advanceTimersByTime(3_600_000);

        acertar(false);

        expect(guardado().cycles[0].results[0].timeMs).toBe(300_000);
      });
    });

    describe('fallo', () => {
      it('se anota, suena, y enseña el aviso con las dos salidas sin avanzar solo', async () => {
        await empezar();

        fallar();

        expect(sounds.playError).toHaveBeenCalledTimes(1);
        expect(page.status).toBe('feedback');
        expect(texto('feedback-message')).toContain('WOODPECKER.play.feedback.wrong');
        expect(el('show-solution')).not.toBeNull();
        expect(el('next')).not.toBeNull();
        expect(guardado().cycles[0].results).toEqual([
          { uidPuzzle: 'p1', resolved: false, failByTime: false, timeMs: 0 },
        ]);
        jest.advanceTimersByTime(10_000);
        expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p1');
        expect(eventos('puzzle_completed')[0].result).toBe('bad');
      });

      it('fallar no termina la vuelta: «Siguiente» sigue con el ejercicio que toca', async () => {
        await empezar();
        fallar();

        page.continueAfterFeedback();
        fixture.detectChanges();

        expect(page.status).toBe('playing');
        expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p2');
        expect(page.feedback).toBeNull();
      });

      it('«Ver solución» abre el modal con el ejercicio fallado y sus temas traducidos', async () => {
        await empezar();
        fallar();

        await page.showSolution();

        expect(modalController.create).toHaveBeenCalledWith(
          expect.objectContaining({
            component: BoardPuzzleSolutionComponent,
            componentProps: {
              puzzle: expect.objectContaining({ uid: 'p1' }),
              themesTranslated: ['Tema fork'],
            },
          })
        );
        expect(modal.present).toHaveBeenCalled();
      });

      it('sin fallo que ver, «Ver solución» no abre nada', async () => {
        await empezar();
        await page.showSolution();
        expect(modalController.create).not.toHaveBeenCalled();
      });

      it('ignora un resultado tardío mientras se mira el aviso', async () => {
        await empezar();
        fallar();

        page.onPuzzleSolved(PUZZLES[0]);
        page.onPuzzleFailed(PUZZLES[0]);

        expect(guardado().cycles[0].results).toHaveLength(1);
      });
    });

    describe('se acaba el tiempo', () => {
      it('cuenta como fallo por tiempo y lo dice distinto', async () => {
        await empezar();
        jest.advanceTimersByTime(60_000);

        page.onPuzzleEndByTime(page.puzzleToPlay as Puzzle);
        fixture.detectChanges();

        expect(page.status).toBe('feedback');
        expect(texto('feedback-message')).toContain('WOODPECKER.play.feedback.timeout');
        expect(guardado().cycles[0].results[0]).toEqual({
          uidPuzzle: 'p1',
          resolved: false,
          failByTime: true,
          timeMs: 60_000,
        });
        expect(eventos('puzzle_completed')[0].result).toBe('timeout');
      });

      it('un fin de tiempo cuando ya no se está jugando se ignora', async () => {
        await empezar();
        acertar(false);

        page.onPuzzleEndByTime(PUZZLES[0]);

        expect(guardado().cycles[0].results).toHaveLength(1);
        expect(guardado().cycles[0].results[0].resolved).toBe(true);
      });
    });

    describe('marcador', () => {
      it('lleva los jugados, los aciertos y el avance de la vuelta', async () => {
        await empezar();
        acertar();
        fallar();

        expect([page.answered, page.solved]).toEqual([2, 1]);
        expect(page.progressPercent).toBeCloseTo(66.67, 1);
        expect(texto('counter')).toContain('WOODPECKER.play.counter');
        expect(texto('solved')).toBe('1');
      });
    });
  });

  describe('terminar la vuelta', () => {
    it('al acertar todo enseña el resultado, avisa al recordatorio y no celebra el set', async () => {
      await empezar();
      jugarVueltaAcertando();

      expect(page.status).toBe('cycleDone');
      expect(page.puzzleToPlay).toBeNull();
      expect(page.cycleResult?.current).toMatchObject({ cycle: 1, solved: 3, accuracy: 100 });
      expect(page.cycleResult?.comparison).toBeNull();
      expect(page.cycleResult?.finishedSet).toBe(false);
      expect(reminders.onSessionCompleted).toHaveBeenCalledWith({ createdAt: AHORA });
      expect(confetti.launchTheme).not.toHaveBeenCalled();
      expect(texto('done-note')).toContain('WOODPECKER.play.done.baseNote');
      expect(el('next-cycle')).not.toBeNull();
      expect(eventos('woodpecker_cycle_completed')).toHaveLength(1);
    });

    it('terminar con un fallo en el último ejercicio también cierra la vuelta', async () => {
      await empezar();
      acertar();
      acertar();
      fallar();
      page.continueAfterFeedback();
      fixture.detectChanges();

      expect(page.status).toBe('cycleDone');
      expect(page.cycleResult?.current).toMatchObject({ solved: 2, failed: 1 });
    });

    it('la vuelta 2 compara con la 1 y, al ser la última, termina el set y celebra', async () => {
      await empezar();
      acertar();
      fallar();
      page.continueAfterFeedback();
      acertar();
      expect(page.cycleResult?.current.accuracy).toBeCloseTo(66.67, 1);

      page.nextCycle();
      fixture.detectChanges();
      page.startPlaying();
      jugarVueltaAcertando();

      expect(page.status).toBe('cycleDone');
      expect(page.cycleResult?.finishedSet).toBe(true);
      expect(page.cycleResult?.comparison?.accuracyDelta).toBeCloseTo(33.33, 1);
      expect(confetti.launchTheme).toHaveBeenCalledWith('gold');
      expect(el('next-cycle')).toBeNull();
      expect(texto('back-to-set')).toContain('WOODPECKER.play.done.seeResults');
      expect(eventos('woodpecker_plan_completed')).toHaveLength(1);
    });

    it('«Empezar vuelta 2» no salta directo al tablero: pasa por el aviso', async () => {
      await empezar();
      jugarVueltaAcertando();

      page.nextCycle();
      fixture.detectChanges();

      expect(page.status).toBe('ready');
      expect(tablero()).toBeUndefined();
    });
  });

  describe('salir y reanudar', () => {
    it('salir en mitad de la vuelta no pierde nada y retoma por el ejercicio siguiente', async () => {
      await empezar();
      acertar();
      fallar();
      page.ionViewWillLeave();

      expect(page.puzzleToPlay).toBeNull();
      expect(page.forceStopBoardTimer).toBe(true);

      // «Vuelve a la pantalla»: otra instancia que solo tiene lo guardado
      const otra = TestBed.createComponent(WoodpeckerPlayPage);
      otra.componentInstance.ionViewWillEnter();
      await vaciarPromesas();
      otra.detectChanges();

      expect(otra.componentInstance.status).toBe('ready');
      expect(otra.componentInstance.cycleNumber).toBe(1);
      expect(otra.componentInstance.answered).toBe(2);
      expect(otra.componentInstance.isResuming).toBe(true);
      expect(otra.nativeElement.querySelector('[data-testid=resume-note]')).not.toBeNull();
      expect(otra.nativeElement.querySelector('[data-testid=start]').textContent).toContain(
        'WOODPECKER.play.ready.continue'
      );
      otra.destroy();
    });

    it('al retomar, el ejercicio es el que tocaba y no se repite ninguno', async () => {
      await empezar();
      acertar();
      page.ionViewWillLeave();

      await entrar();
      page.startPlaying();
      fixture.detectChanges();

      expect((tablero()!.setPuzzle as Puzzle).uid).toBe('p2');
      expect(eventos('woodpecker_cycle_started')).toHaveLength(1);
    });

    it('salir durante el respiro tras un acierto no deja un temporizador vivo', async () => {
      await empezar();
      acertar(false);

      page.ionViewWillLeave();
      jest.advanceTimersByTime(5_000);

      expect(page.puzzleToPlay).toBeNull();
    });

    it('el botón de salir lleva a la pantalla del set', async () => {
      await empezar();
      page.exit();
      expect(router.navigate).toHaveBeenCalledWith(['/woodpecker']);
    });

    it('el breadcrumb lleva al inicio', () => {
      page.goToHome();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });
});
