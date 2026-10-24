// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar. Aquí
// no se dibuja ningún tablero: se sustituye por dobles y la plantilla usa un
// tablero falso con los mismos inputs/outputs.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class BoardPuzzleSolutionComponent {},
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  AlertController,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { Puzzle, StreakRecord, StreakRun } from '@chesspark/models';
import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import {
  ConfettiService,
  SoundsService,
  UidGeneratorService,
} from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { AppearanceService } from '@core/app/appearance.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { StreakService } from '@features/streak/services/streak.service';
import { StreakStorageService } from '@features/records/services/streak-storage.service';
import { UserRecordsService } from '@features/records/services/user-records.service';
import {
  applyRunToRecord,
  emptyStreakRecord,
} from '@features/streak/utils/streak.util';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { KingImagePipe } from '@shared/pipes/king-image.pipe';
import { StreakPage } from '@features/streak/pages/streak.page';

import {
  AsaRedimensionarFalsa,
  TableroPuzzleFalso,
  controladorFalso,
  diferida,
  superposicionFalsa,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Modo Racha: muerte súbita (el primer fallo termina), rampa de elo (+15 sobre el
 * elo REAL del puzzle resuelto), un salto por racha y récord personal. Ver
 * docs/implementado/RACHA_STREAK_FLOW.md.
 *
 * El tablero y todos los servicios son dobles; el reloj es el de Jest para
 * controlar la pausa de 450 ms entre un acierto y el siguiente puzzle.
 */

const FEN_BLANCAS_MUEVE_RIVAL = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const FEN_NEGRAS_MUEVE_RIVAL = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function puzzle(uid: string, rating: number, extra: Partial<Puzzle> = {}): Puzzle {
  return {
    uid,
    fen: FEN_BLANCAS_MUEVE_RIVAL,
    moves: 'e2e4',
    rating,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['fork'],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...extra,
  };
}

function record(extra: Partial<StreakRecord> = {}): StreakRecord {
  return { ...emptyStreakRecord(), ...extra };
}

const AHORA = new Date('2026-03-10T10:00:00Z').getTime();

describe('StreakPage', () => {
  let fixture: ComponentFixture<StreakPage>;
  let page: StreakPage;

  let recordGuardado: StreakRecord;
  let contador: number;
  let perfil: { uid: string; elo: number } | null;

  const router = { navigate: jest.fn() };
  const streakService = { getPuzzleForElo: jest.fn() };
  const streakStorage = { getRecord: jest.fn(), saveRun: jest.fn() };
  const userRecords = { push: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = { onSessionStarted: jest.fn(), onSessionCompleted: jest.fn() };
  const sounds = { playGood: jest.fn(), playError: jest.fn() };
  const confetti = { launchTheme: jest.fn() };
  const app = { getNameThemePuzzleByValue: jest.fn() };
  const alert = superposicionFalsa();
  const modal = superposicionFalsa();
  const alertController = controladorFalso(alert);
  const modalController = controladorFalso(modal);

  /** Cada petición entrega un puzzle nuevo con rating = elo pedido. */
  function catalogoPorElo() {
    streakService.getPuzzleForElo.mockImplementation(async (elo: number) =>
      puzzle(`p${++contador}-${elo}`, elo)
    );
  }

  function eventos(nombre: string) {
    return analytics.logEvent.mock.calls
      .filter(([evento]) => evento === nombre)
      .map(([, datos]) => datos);
  }

  function tablero(): TableroPuzzleFalso {
    return fixture.debugElement.query(By.directive(TableroPuzzleFalso))
      .componentInstance;
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function boton(contiene: string): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => (b.textContent ?? '').includes(contiene));
  }

  /** Entra a la pantalla y espera a que cargue el primer puzzle (y su precarga). */
  async function entrar() {
    page.ionViewWillEnter();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** Resuelve el puzzle en pantalla y deja pasar la pausa hasta el siguiente. */
  async function acertar() {
    page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
    jest.advanceTimersByTime(450);
    await vaciarPromesas();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA);
    jest.clearAllMocks();
    contador = 0;
    recordGuardado = record();
    perfil = { uid: 'user-1', elo: 1500 };

    streakStorage.getRecord.mockImplementation(() => recordGuardado);
    streakStorage.saveRun.mockImplementation((run: StreakRun) => {
      recordGuardado = applyRunToRecord(recordGuardado, run);
      return recordGuardado;
    });
    analytics.logEvent.mockResolvedValue(undefined);
    app.getNameThemePuzzleByValue.mockImplementation((t: string) => `Tema ${t}`);
    alert.present.mockClear();
    modal.present.mockClear();
    catalogoPorElo();

    await TestBed.configureTestingModule({
      imports: [StreakPage, translocoParaPruebas({
        'STREAK.exit.message': 'Llevas {{score}} seguidos',
      })],
      providers: [
        { provide: Router, useValue: router },
        { provide: StreakService, useValue: streakService },
        { provide: StreakStorageService, useValue: streakStorage },
        { provide: UserRecordsService, useValue: userRecords },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return perfil;
            },
          },
        },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TrainingReminderService, useValue: reminders },
        { provide: SoundsService, useValue: sounds },
        { provide: ConfettiService, useValue: confetti },
        { provide: UidGeneratorService, useValue: { generateSimpleUid: () => 'run-1' } },
        { provide: AlertController, useValue: alertController },
        { provide: ModalController, useValue: modalController },
        { provide: AppService, useValue: app },
        { provide: AppearanceService, useValue: { pieces: () => 'cburnett' } },
      ],
    })
      // El tablero real se cambia por uno falso con los mismos inputs/outputs
      .overrideComponent(StreakPage, {
        set: {
          imports: [
            KingImagePipe,
            CommonModule,
            TranslocoPipe,
            IonContent,
            IonIcon,
            TableroPuzzleFalso,
            AsaRedimensionarFalsa,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StreakPage);
    page = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  describe('arranque de la racha', () => {
    it('pide el primer puzzle al elo base y lo pone en el tablero', async () => {
      await entrar();

      expect(streakService.getPuzzleForElo.mock.calls[0][0]).toBe(800);
      expect(streakService.getPuzzleForElo.mock.calls[0][1]).toEqual(page.config);
      expect(page.status).toBe('playing');
      expect((tablero().setPuzzle as Puzzle).uid).toBe('p1-800');
    });

    it('registra streak_started y avisa al recordatorio de que hay sesión', async () => {
      await entrar();

      expect(eventos('streak_started')).toEqual([
        { elo_base: 800, step: 15, theme: 'all' },
      ]);
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(1);
    });

    it('muestra el elo real del puzzle y el color con el que juega el usuario', async () => {
      streakService.getPuzzleForElo.mockResolvedValueOnce(
        puzzle('p-negras', 837, { fen: FEN_BLANCAS_MUEVE_RIVAL })
      );
      await entrar();

      // El FEN arranca con el turno del rival: si mueve el blanco, el usuario juega con negras
      expect(page.playerColor).toBe('black');
      expect(page.puzzleElo).toBe(837);
      expect(texto()).toContain('837');
      const rey = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(rey.getAttribute('src')).toBe('assets/images/pieces/cburnett-bk.svg');
    });

    it('con el turno del rival en negras el usuario juega blancas', async () => {
      streakService.getPuzzleForElo.mockResolvedValueOnce(
        puzzle('p-blancas', 900, { fen: FEN_NEGRAS_MUEVE_RIVAL })
      );
      await entrar();

      expect(page.playerColor).toBe('white');
    });

    it('registra puzzle_started del puzzle que se juega', async () => {
      await entrar();

      expect(eventos('puzzle_started')).toEqual([
        { routine_kind: 'streak', routine_minutes: 0, theme: 'fork', puzzle_elo: 800 },
      ]);
    });

    it('si no hay puzzle disponible muestra el error y "reintentar" vuelve a pedirlo', async () => {
      streakService.getPuzzleForElo.mockResolvedValue(null);
      await entrar();

      expect(page.status).toBe('error');
      expect(texto()).toContain('STREAK.error.title');
      expect(fixture.debugElement.query(By.directive(TableroPuzzleFalso))).toBeNull();
      // Sin nada acertado aún no hay racha que distinguir de «otra racha»
      expect(boton('STREAK.actions.retry')).toBeUndefined();

      catalogoPorElo();
      boton('STREAK.error.retry')?.click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('playing');
      expect(eventos('streak_started')).toHaveLength(1);
    });

    it('un corte de red a mitad de la racha no la pierde: "reintentar" sigue donde iba', async () => {
      await entrar();
      await acertar();
      await acertar();
      streakService.getPuzzleForElo.mockResolvedValue(null);
      page.useSkip();
      await vaciarPromesas();
      fixture.detectChanges();
      expect(page.status).toBe('error');
      // Con racha en marcha se ofrecen las dos salidas
      expect(boton('STREAK.error.retry')).toBeDefined();
      expect(boton('STREAK.actions.retry')).toBeDefined();

      catalogoPorElo();
      await page.retryLoad();
      fixture.detectChanges();

      expect(page.status).toBe('playing');
      expect(page.score).toBe(2);
      expect(eventos('streak_started')).toHaveLength(1);
    });

    it('reintentar desde el error guarda como récord lo acertado antes de que fallara la descarga', async () => {
      await entrar();
      await acertar();
      await acertar();
      streakService.getPuzzleForElo.mockResolvedValue(null);
      page.useSkip();
      await vaciarPromesas();
      expect(page.status).toBe('error');

      catalogoPorElo();
      page.retry();
      await vaciarPromesas();

      expect(page.record.bestScore).toBe(2);
      expect(page.score).toBe(0);
      expect(page.status).toBe('playing');
    });

    it('desde el error, "volver al inicio" navega a /home', async () => {
      streakService.getPuzzleForElo.mockResolvedValue(null);
      await entrar();

      boton('STREAK.actions.backToHome')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('muestra el récord y cuánto falta para batirlo', async () => {
      recordGuardado = record({ bestScore: 5 });
      await entrar();

      expect(page.toBeatRecord).toBe(5);
      expect(texto()).toContain('STREAK.toBeatRecord');
      expect(texto()).not.toContain('STREAK.beatingRecord');
    });

    it('sin récord no pinta la barra de récord', async () => {
      await entrar();

      expect(texto()).not.toContain('STREAK.toBeatRecord');
      expect(texto()).not.toContain('STREAK.beatingRecord');
    });
  });

  describe('rampa de elo y precarga', () => {
    it('precarga el siguiente puzzle a elo real + 15 mientras se resuelve el actual', async () => {
      await entrar();

      expect(streakService.getPuzzleForElo.mock.calls.map((c) => c[0])).toEqual([800, 815]);
    });

    it('tras acertar entra el puzzle precargado sin pedir otro para el mismo escalón', async () => {
      await entrar();
      await acertar();

      expect((page.puzzleToPlay as Puzzle).uid).toBe('p2-815');
      // Solo se pidió la precarga del siguiente escalón (830), no se repitió el 815
      expect(streakService.getPuzzleForElo.mock.calls.map((c) => c[0])).toEqual([800, 815, 830]);
    });

    it('la rampa se encadena sobre el elo real del puzzle resuelto, no sobre el pedido', async () => {
      // Se pidió 800 pero el catálogo sirvió uno de 840
      streakService.getPuzzleForElo.mockResolvedValueOnce(puzzle('real', 840));
      await entrar();

      expect(streakService.getPuzzleForElo.mock.calls[1][0]).toBe(855);
    });

    it('la dificultad nunca retrocede aunque salga un puzzle flojo dentro de su franja', async () => {
      // Se pidió 800 pero salió uno de 700: el siguiente objetivo es 800 (suelo), no 715
      streakService.getPuzzleForElo.mockResolvedValueOnce(puzzle('flojo', 700));
      await entrar();

      expect(streakService.getPuzzleForElo.mock.calls[1][0]).toBe(800);
    });

    it('no pide puzzles ya jugados: pasa los uids vistos a cada petición', async () => {
      await entrar();
      await acertar();

      const excluidos = streakService.getPuzzleForElo.mock.calls[2][2] as Set<string>;
      expect(excluidos.has('p1-800')).toBe(true);
      expect(excluidos.has('p2-815')).toBe(true);
    });

    it('respeta el techo de elo del catálogo', async () => {
      streakService.getPuzzleForElo.mockResolvedValueOnce(puzzle('techo', 2795));
      await entrar();

      expect(streakService.getPuzzleForElo.mock.calls[1][0]).toBe(2800);
    });
  });

  describe('acertar un puzzle', () => {
    it('suma uno a la puntuación, suena el acierto y registra puzzle_completed good', async () => {
      await entrar();
      page.onPuzzleSolved(puzzle('p1-800', 800, { timeUsed: 7 }));

      expect(page.score).toBe(1);
      expect(sounds.playGood).toHaveBeenCalledTimes(1);
      expect(eventos('puzzle_completed')).toEqual([
        {
          result: 'good',
          puzzle_elo: 800,
          user_elo: 1500,
          resolved_time: 7,
          first_theme: 'fork',
          routine_kind: 'streak',
          routine_minutes: 0,
        },
      ]);
    });

    it('espera 450 ms antes de cambiar de puzzle (no salta de golpe)', async () => {
      await entrar();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      jest.advanceTimersByTime(449);
      await vaciarPromesas();
      expect((page.puzzleToPlay as Puzzle).uid).toBe('p1-800');
      expect(page.status).toBe('playing');

      jest.advanceTimersByTime(1);
      await vaciarPromesas();
      expect((page.puzzleToPlay as Puzzle).uid).toBe('p2-815');
    });

    it('durante la pausa un toque de más no cuenta ni como fallo ni como otro acierto', async () => {
      await entrar();
      const actual = page.puzzleToPlay as Puzzle;
      page.onPuzzleSolved(actual);

      page.onPuzzleFailed(actual);
      page.onPuzzleSolved(actual);

      expect(page.score).toBe(1);
      expect(page.status).not.toBe('finished');
      expect(sounds.playError).not.toHaveBeenCalled();
      expect(streakStorage.saveRun).not.toHaveBeenCalled();
    });

    it('el acierto que emite el tablero llega a la página (cableado de la plantilla)', async () => {
      await entrar();

      tablero().puzzleCompleted.emit(page.puzzleToPlay);

      expect(page.score).toBe(1);
    });

    it('el marcador de la barra superior muestra la puntuación', async () => {
      await entrar();
      await acertar();
      await acertar();

      expect(page.score).toBe(2);
      expect(fixture.nativeElement.querySelector('.text-2xl')?.textContent?.trim()).toBe('2');
    });

    it('al superar el récord vigente en plena racha pasa a "estás batiendo el récord"', async () => {
      recordGuardado = record({ bestScore: 2 });
      await entrar();
      await acertar();
      expect(page.toBeatRecord).toBe(1);
      await acertar();

      expect(page.toBeatRecord).toBe(0);
      expect(texto()).toContain('STREAK.beatingRecord');
    });
  });

  describe('fallar un puzzle (muerte súbita)', () => {
    async function fallarConRacha(aciertos: number, fallado = puzzle('fallado', 900)) {
      await entrar();
      for (let i = 0; i < aciertos; i++) {
        await acertar();
      }
      page.onPuzzleFailed(fallado);
      fixture.detectChanges();
    }

    it('termina la racha: suena el error, muestra el resultado y no sigue con otro puzzle', async () => {
      recordGuardado = record({ bestScore: 5 });
      await fallarConRacha(1);

      expect(sounds.playError).toHaveBeenCalledTimes(1);
      expect(page.status).toBe('finished');
      expect(page.forceStopBoardTimer).toBe(true);
      expect(page.finishedRun?.endedBy).toBe('fail');
      expect(texto()).toContain('STREAK.result.title');
    });

    it('guarda la racha con puntuación, puzzle fallado, orden jugado y elo máximo', async () => {
      await fallarConRacha(2, puzzle('fallado', 930));

      const run = streakStorage.saveRun.mock.calls[0][0] as StreakRun;
      expect(run).toMatchObject({
        uid: 'run-1',
        uidUser: 'user-1',
        startedAt: AHORA,
        score: 2,
        skipsUsed: 0,
        endedBy: 'fail',
        failedPuzzleUid: 'fallado',
      });
      expect(run.puzzleUids).toEqual(['p1-800', 'p2-815', 'p3-830']);
      // El tercero (830) es el que se tenía delante al fallar
      expect(run.maxEloReached).toBe(830);
    });

    it('sube el récord al perfil y cuenta la sesión para el recordatorio', async () => {
      await fallarConRacha(1);

      expect(userRecords.push).toHaveBeenCalledTimes(1);
      expect(reminders.onSessionCompleted).toHaveBeenCalledWith({ createdAt: AHORA });
    });

    it('registra puzzle_completed bad y streak_ended con el resumen', async () => {
      jest.setSystemTime(AHORA);
      await entrar();
      jest.setSystemTime(AHORA + 90_000);
      page.onPuzzleFailed(puzzle('fallado', 800, { timeUsed: 12 }));

      expect(eventos('puzzle_completed')[0]).toMatchObject({
        result: 'bad',
        puzzle_elo: 800,
        resolved_time: 12,
        routine_kind: 'streak',
      });
      expect(eventos('streak_ended')).toEqual([
        { score: 0, ended_by: 'fail', skips_used: 0, max_elo_reached: 800, duration_ms: 90_000 },
      ]);
    });

    it('fallar el primer puzzle sí cuenta (se jugó) aunque la puntuación sea 0', async () => {
      await fallarConRacha(0);

      expect(streakStorage.saveRun).toHaveBeenCalledTimes(1);
      expect(recordGuardado.runsPlayed).toBe(1);
      expect(confetti.launchTheme).not.toHaveBeenCalled();
    });

    it('con un récord nuevo lo celebra: confeti dorado, evento y título de récord', async () => {
      recordGuardado = record({ bestScore: 1 });
      await fallarConRacha(2);

      expect(page.achievedNewRecord).toBe(true);
      expect(confetti.launchTheme).toHaveBeenCalledWith('gold');
      expect(eventos('streak_new_record')).toEqual([{ score: 2, previous_best: 1 }]);
      expect(texto()).toContain('STREAK.result.newRecord');
      expect(recordGuardado.bestScore).toBe(2);
    });

    it('empatar el récord no es récord nuevo', async () => {
      recordGuardado = record({ bestScore: 2 });
      await fallarConRacha(2);

      expect(page.achievedNewRecord).toBe(false);
      expect(confetti.launchTheme).not.toHaveBeenCalled();
      expect(eventos('streak_new_record')).toEqual([]);
      expect(texto()).toContain('STREAK.result.title');
      expect(texto()).not.toContain('STREAK.result.newRecord');
    });

    it('la pantalla de resultado enseña puntuación, récord y elo máximo', async () => {
      recordGuardado = record({ bestScore: 7 });
      await fallarConRacha(1);

      const modal = fixture.nativeElement.querySelector('.modal-box') as HTMLElement;
      expect(modal.textContent).toContain('1');
      expect(modal.textContent).toContain('7');
      expect(modal.textContent).toContain('815');
    });

    it('al fallar, el fallo que emite el tablero llega a la página (cableado de la plantilla)', async () => {
      await entrar();

      tablero().puzzleFailed.emit(puzzle('desde-tablero', 800));

      expect(page.status).toBe('finished');
      expect(page.finishedRun?.failedPuzzleUid).toBe('desde-tablero');
    });

    it('un segundo fallo o acierto tardío con la racha terminada se ignora', async () => {
      await fallarConRacha(1);

      page.onPuzzleFailed(puzzle('otro', 800));
      page.onPuzzleSolved(puzzle('otro', 800));

      expect(streakStorage.saveRun).toHaveBeenCalledTimes(1);
      expect(page.score).toBe(1);
    });
  });

  describe('ver la solución del puzzle fallado', () => {
    it('abre el modal de solución con el puzzle que emitió el tablero y los temas traducidos', async () => {
      await entrar();
      const fallado = puzzle('fallado', 800, { themes: ['fork', 'pin'] });
      page.onPuzzleFailed(fallado);

      await page.showFailedSolution();

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          component: BoardPuzzleSolutionComponent,
          componentProps: {
            puzzle: fallado,
            themesTranslated: ['Tema fork', 'Tema pin'],
          },
        })
      );
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('sin puzzle fallado (racha abandonada) no abre nada', async () => {
      await entrar();

      await page.showFailedSolution();

      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('el botón de solución solo aparece cuando la racha terminó por fallo', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));
      fixture.detectChanges();

      expect(boton('PUZZLE_SOLUTION.actions.solution')).toBeDefined();
    });

    it('el botón de solución abre el modal al pulsarlo', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));
      fixture.detectChanges();

      boton('PUZZLE_SOLUTION.actions.solution')?.click();
      await vaciarPromesas();

      expect(modalController.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('salto', () => {
    it('cambia de puzzle al mismo nivel, sin sumar ni fallar, y gasta el salto', async () => {
      await entrar();
      page.useSkip();
      await vaciarPromesas();

      expect(page.skipsUsed).toBe(1);
      expect(page.skipsLeft).toBe(0);
      expect(page.score).toBe(0);
      expect(page.status).toBe('playing');
      expect((page.puzzleToPlay as Puzzle).uid).not.toBe('p1-800');
      // Mismo objetivo: 800 otra vez (la precarga de 815 no sirve y se descarta)
      expect(streakService.getPuzzleForElo.mock.calls.map((c) => c[0])).toEqual([800, 815, 800, 815]);
      expect(page.puzzleElo).toBe(800);
    });

    it('registra streak_skip_used con la puntuación y el elo del puzzle saltado', async () => {
      await entrar();
      await acertar();
      page.useSkip();

      expect(eventos('streak_skip_used')).toEqual([{ at_score: 1, elo: 815 }]);
    });

    it('solo hay un salto por racha: el segundo se ignora', async () => {
      await entrar();
      page.useSkip();
      await vaciarPromesas();
      const antes = streakService.getPuzzleForElo.mock.calls.length;

      page.useSkip();
      await vaciarPromesas();

      expect(page.skipsUsed).toBe(1);
      expect(streakService.getPuzzleForElo.mock.calls.length).toBe(antes);
      expect(eventos('streak_skip_used')).toHaveLength(1);
    });

    it('el botón de salto muestra los restantes y se deshabilita al gastarlo', async () => {
      await entrar();
      const btn = boton('STREAK.actions.skip') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('1');

      btn.click();
      await vaciarPromesas();
      fixture.detectChanges();

      const despues = boton('STREAK.actions.skip') as HTMLButtonElement;
      expect(despues.disabled).toBe(true);
      expect(despues.textContent).toContain('0');
    });

    it('no se puede saltar durante la pausa tras un acierto', async () => {
      await entrar();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      page.useSkip();

      expect(page.skipsUsed).toBe(0);
    });

    it('no se puede saltar con la racha terminada', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));

      page.useSkip();

      expect(page.skipsUsed).toBe(0);
    });

    it('el salto queda en la racha guardada', async () => {
      await entrar();
      page.useSkip();
      await vaciarPromesas();
      page.onPuzzleFailed(puzzle('fallado', 800));

      expect((streakStorage.saveRun.mock.calls[0][0] as StreakRun).skipsUsed).toBe(1);
    });
  });

  describe('salir de la pantalla', () => {
    it('salir sin haber resuelto nada no ensucia el historial ni el récord', async () => {
      await entrar();

      page.ionViewWillLeave();

      expect(streakStorage.saveRun).not.toHaveBeenCalled();
      expect(userRecords.push).not.toHaveBeenCalled();
      expect(reminders.onSessionCompleted).not.toHaveBeenCalled();
    });

    it('salir con aciertos los registra como abandono, sin pantalla de resultado', async () => {
      await entrar();
      await acertar();
      await acertar();

      page.ionViewWillLeave();

      const run = streakStorage.saveRun.mock.calls[0][0] as StreakRun;
      expect(run.score).toBe(2);
      expect(run.endedBy).toBe('quit');
      expect(run.failedPuzzleUid).toBeUndefined();
      expect(userRecords.push).toHaveBeenCalledTimes(1);
      expect(page.status).not.toBe('finished');
      expect(confetti.launchTheme).not.toHaveBeenCalled();
      expect(eventos('streak_ended')).toEqual([
        expect.objectContaining({ score: 2, ended_by: 'quit' }),
      ]);
    });

    it('abandonar con una puntuación mayor al récord lo guarda como récord nuevo', async () => {
      await entrar();
      await acertar();

      page.ionViewWillLeave();

      expect(recordGuardado.bestScore).toBe(1);
      expect(eventos('streak_new_record')).toEqual([{ score: 1, previous_best: 0 }]);
    });

    it('ionViewWillLeave seguido de ngOnDestroy guarda la racha una sola vez', async () => {
      await entrar();
      await acertar();

      page.ionViewWillLeave();
      page.ngOnDestroy();

      expect(streakStorage.saveRun).toHaveBeenCalledTimes(1);
      expect(eventos('streak_ended')).toHaveLength(1);
    });

    it('cancela la pausa pendiente: tras salir no se pide ni se pinta otro puzzle', async () => {
      await entrar();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      const pedidos = streakService.getPuzzleForElo.mock.calls.length;

      page.ionViewWillLeave();
      jest.advanceTimersByTime(1000);
      await vaciarPromesas();

      expect((page.puzzleToPlay as Puzzle).uid).toBe('p1-800');
      expect(streakService.getPuzzleForElo.mock.calls.length).toBe(pedidos);
    });

    it('un puzzle que termina de descargarse después de salir ya no se pinta', async () => {
      const lento = diferida<Puzzle>();
      streakService.getPuzzleForElo.mockReturnValueOnce(lento.promesa);
      page.ionViewWillEnter();
      await vaciarPromesas();

      page.ionViewWillLeave();
      lento.resolver(puzzle('tarde', 800));
      await vaciarPromesas();

      expect(page.puzzleToPlay).toBeNull();
    });
  });

  describe('botón de salir (X)', () => {
    it('el botón de solo icono tiene nombre accesible', async () => {
      await entrar();

      const cerrar = fixture.nativeElement.querySelector('button.btn-error') as HTMLButtonElement;
      expect(cerrar.getAttribute('aria-label')).toBe('APP.components.exit');
    });

    it('con la racha viva pide confirmación y no sale todavía', async () => {
      await entrar();
      await acertar();

      await page.onExit();

      expect(alertController.create).toHaveBeenCalledTimes(1);
      const opciones = alertController.create.mock.calls[0][0];
      expect(opciones.header).toBe('STREAK.exit.title');
      expect(opciones.message).toBe('Llevas 1 seguidos');
      expect(alert.present).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(streakStorage.saveRun).not.toHaveBeenCalled();
    });

    it('al confirmar registra el abandono y va al inicio', async () => {
      await entrar();
      await acertar();
      await page.onExit();
      const botones = alertController.create.mock.calls[0][0].buttons;

      expect(botones[0].role).toBe('cancel');
      expect(botones[0].handler).toBeUndefined();
      botones[1].handler();

      expect((streakStorage.saveRun.mock.calls[0][0] as StreakRun).endedBy).toBe('quit');
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('con la racha ya terminada va directo al inicio, sin preguntar', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));

      await page.onExit();

      expect(alertController.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('la X de la barra superior invoca la salida', async () => {
      await entrar();

      (fixture.nativeElement.querySelector('button.btn-error') as HTMLButtonElement).click();
      await vaciarPromesas();

      expect(alertController.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('reintentar y volver', () => {
    it('reintentar arranca una racha limpia desde el elo base', async () => {
      await entrar();
      await acertar();
      page.useSkip();
      await vaciarPromesas();
      page.onPuzzleFailed(puzzle('fallado', 900));
      fixture.detectChanges();
      streakService.getPuzzleForElo.mockClear();

      boton('STREAK.actions.retry')?.click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.score).toBe(0);
      expect(page.skipsUsed).toBe(0);
      expect(page.finishedRun).toBeNull();
      expect(page.achievedNewRecord).toBe(false);
      expect(page.status).toBe('playing');
      expect(page.forceStopBoardTimer).toBe(false);
      expect(streakService.getPuzzleForElo.mock.calls[0][0]).toBe(800);
      expect(eventos('streak_started')).toHaveLength(2);
      expect(reminders.onSessionStarted).toHaveBeenCalledTimes(2);
    });

    it('la nueva racha puede volver a repetir puzzles (el historial de uids se reinicia)', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));
      streakService.getPuzzleForElo.mockClear();

      page.retry();
      await vaciarPromesas();

      const excluidos = streakService.getPuzzleForElo.mock.calls[0][2] as Set<string>;
      expect(excluidos.has('p1-800')).toBe(false);
    });

    it('reintentar parte del récord ya actualizado', async () => {
      await entrar();
      await acertar();
      page.onPuzzleFailed(puzzle('fallado', 900));

      page.retry();
      await vaciarPromesas();

      expect(page.record.bestScore).toBe(1);
      expect(page.toBeatRecord).toBe(1);
    });

    it('"volver al inicio" del resultado navega a /home', async () => {
      await entrar();
      page.onPuzzleFailed(puzzle('fallado', 800));
      fixture.detectChanges();

      boton('STREAK.actions.backToHome')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });
});
