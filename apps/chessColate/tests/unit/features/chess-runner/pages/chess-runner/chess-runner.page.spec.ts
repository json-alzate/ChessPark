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
import { DOG_SKINS } from '@features/chess-runner/rendering/dog-skins';
import { Mission } from '@features/chess-runner/game/runner-missions';
import { RunnerSpritesService } from '@features/chess-runner/services/runner-sprites.service';
import { RunnerPiecesService } from '@features/chess-runner/services/runner-pieces.service';
import { difficultyForLevel, RunnerDifficulty } from '@features/chess-runner/config/runner.config';
import { BLOCK_SIZE, CHAPTERS, POWER_IDS } from '@features/chess-runner/campaign/runner-curriculum';
import { newCampaign } from '@features/chess-runner/campaign/runner-campaign.util';
import { modifiersFor } from '@features/chess-runner/config/runner-powers';
import { COOKIES_PER_HEART, MAX_HEARTS, MAX_STRIKES } from '@features/chess-runner/config/runner.config';
import { lessonFor } from '@features/chess-runner/lessons/runner-lessons.data';
import { RunnerLessonModalComponent } from '@features/chess-runner/components/runner-lesson-modal/runner-lesson-modal.component';
import { RunnerCardComponent } from '@features/chess-runner/components/runner-card/runner-card.component';
import { RunnerGameOverComponent } from '@features/chess-runner/components/runner-game-over/runner-game-over.component';
import { RunnerMapComponent } from '@features/chess-runner/components/runner-map/runner-map.component';
import { StoryScene } from '@features/chess-runner/story/story-scenes';
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
  @Input() world: string | null = null;
  @Input() gear: readonly string[] = [];
  @Input() mods: { shields: number } | null = null;
  @Input() boss: string | null = null;
  @Input() carrying = 0;
  @Input() skin = 'choco';
  @Input() tapZone: HTMLElement | null = null;
  @Output() runnerEvent = new EventEmitter<RunnerEventName>();
  @Output() progress = new EventEmitter<RunnerProgress>();
  @Output() finished = new EventEmitter<RunnerStats>();
  @Output() failed = new EventEmitter<void>();
}

/** Una escena de la historia, sin canvas: mismas entradas y salidas que la real. */
@Component({ selector: 'app-runner-story', standalone: true, template: '<div data-testid="escena-falsa"></div>' })
class EscenaFalsa {
  @Input() scene: StoryScene | null = null;
  @Input() skin = 'choco';
  @Output() finished = new EventEmitter<void>();
  @Output() failed = new EventEmitter<void>();
}

/** La lección, sin canvas: mismas entradas y salidas que la real. */
@Component({ selector: 'app-runner-lesson', standalone: true, template: '<div data-testid="leccion-falsa"></div>' })
class LeccionFalsa {
  @Input() lesson: unknown = null;
  @Output() finished = new EventEmitter<void>();
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

const STATS_LIMPIAS: RunnerStats = { total: 6, stumbles: 0, clean: true, durationMs: 14_000, bestCombo: 6, meters: 140, cookies: 12, perfects: 2, smashed: 0 };

describe('ChessRunnerPage', () => {
  let fixture: ComponentFixture<ChessRunnerPage>;
  let page: ChessRunnerPage;

  const router = { navigate: jest.fn() };
  const puzzles = { next: jest.fn() };
  const sprites = { load: jest.fn() };
  const piezas = { load: jest.fn() };
  const analytics = { logEvent: jest.fn() };
  const reminders = { onSessionStarted: jest.fn(), onSessionCompleted: jest.fn() };
  const sounds = {
    playSelect: jest.fn(),
    playMoveSound: jest.fn(),
    playError: jest.fn(),
    playGood: jest.fn(),
    playCaptureSound: jest.fn(),
    playCheckSound: jest.fn(),
    playCheckmateSound: jest.fn(),
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
    // Quien ya jugó vuelve al panel: las pruebas que quieren la carrera le dan a «Jugar»
    if (page.gameOver?.reason === 'lobby') {
      page.playAgain();
    }
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** Entra y deja la carrera en marcha. */
  async function entrarYCorrer() {
    await entrar();
  }

  /** Resuelve el ejercicio y deja que arranque la siguiente carrera. */
  async function resolverYSeguir() {
    terminarCarrera();
    page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
    // Pasa la pausa del confeti, también la más larga (la de cerrar un capítulo)
    jest.advanceTimersByTime(3300);
    await vaciarPromesas();
    fixture.detectChanges();
    // Si cerró un capítulo hay una escena de victoria: se salta (las pruebas de la historia la miran aparte)
    while (page.status === 'story') {
      page.skipStory();
      await vaciarPromesas();
      fixture.detectChanges();
    }
  }

  /** Falla el ejercicio y pasa a la siguiente carrera. */
  async function fallarYSeguir() {
    terminarCarrera();
    page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
    page.retry();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** La historia ya vista (el prólogo, la llegada a cada mundo y el final): lo único que no interesa en la mayoría de pruebas. */
  const PRECIO_DORADO = DOG_SKINS.find((skin) => skin.id === 'golden')!.price;
  /** Los poderes que lleva quien ya venció los `n` primeros capítulos. */
  const poderesHasta = (n: number) => CHAPTERS.slice(0, n).flatMap((c) => (c.power ? [c.power] : []));
  const HISTORIA_VISTA = ['prologue', 'epilogue', ...CHAPTERS.map((_, i) => `intro:${i}`)];
  /** Y también todas las lecciones: la mayoría de pruebas entran directo a la carrera. */
  const LECCIONES_VISTAS = [...HISTORIA_VISTA, ...CHAPTERS.flatMap((c) => [`lesson:${c.theme}`, `review:${c.theme}`])];

  /** Deja guardada una campaña a medias, para entrar ya en el capítulo que interese (con las lecciones ya vistas, salvo que se diga). */
  function sembrar(cambios: Partial<ReturnType<typeof newCampaign>>) {
    TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, ...cambios });
  }

  /** Termina la carrera como si el perrito hubiera llegado al final, y deja pasar la transición. */
  function terminarCarrera(stats: RunnerStats = STATS_LIMPIAS) {
    lienzo()!.finished.emit(stats);
    jest.advanceTimersByTime(450);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    // Se parte de una campaña con las lecciones vistas; las pruebas de la lección la vacían a propósito
    localStorage.setItem(
      'chessColate_runner_campaign',
      JSON.stringify({ ...newCampaign(), seen: LECCIONES_VISTAS })
    );
    jest.useFakeTimers();
    jest.clearAllMocks();
    // jsdom no dibuja: los iconos de los poderes del mapa salen vacíos (sin ruido en la consola)
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    perfil = { uid: 'u1', elo: 1400 };
    puzzles.next.mockImplementation(async () => ejercicio(`ej-${++contador}`, { fen: FEN, rating: 1400, themes: ['fork'] }));
    analytics.logEvent.mockResolvedValue(undefined);
    piezas.load.mockResolvedValue(PIEZAS);
    sprites.load.mockResolvedValue(new Map());
    app.getNameThemePuzzleByValue.mockImplementation((tema: string) => `Tema ${tema}`);
    contador = 0;

    await TestBed.configureTestingModule({
      imports: [ChessRunnerPage, translocoParaPruebas()],
      providers: [
        { provide: Router, useValue: router },
        { provide: RunnerPuzzleService, useValue: puzzles },
        { provide: RunnerPiecesService, useValue: piezas },
        { provide: RunnerSpritesService, useValue: sprites },
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
            LeccionFalsa,
            EscenaFalsa,
            RunnerCardComponent,
            RunnerGameOverComponent,
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
    it('busca un ejercicio del ELO del perrito y muestra «cargando» mientras', async () => {
      const lenta = diferida<Puzzle | null>();
      puzzles.next.mockReturnValueOnce(lenta.promesa);

      page.ionViewWillEnter();
      fixture.detectChanges();

      expect(page.status).toBe('loading');
      expect(el('loading')).not.toBeNull();
      // El primer ejercicio de la campaña: el patrón del capítulo 1, 200 puntos por debajo del ELO del perrito,
      // que empieza 300 por debajo del ELO del usuario
      expect(puzzles.next).toHaveBeenCalledWith(1400 - 300 - 200, expect.any(Set), expect.any(Function), CHAPTERS[0].theme);

      lenta.resolver(ejercicio('x', { fen: FEN }));
      await vaciarPromesas();
    });

    it('sin sesión parte de 1200', async () => {
      perfil = null;
      await entrarYCorrer();

      expect(puzzles.next).toHaveBeenCalledWith(700, expect.any(Set), expect.any(Function), CHAPTERS[0].theme);
    });

    it('arranca la carrera directamente: no hay tutorial, un toque es todo lo que se necesita', async () => {
      await entrarYCorrer();

      expect(page.status).toBe('running');
      expect(lienzo()).toBeDefined();
      expect(el('tutorial')).toBeNull();
    });

    it('la logo de la barra superior es el caballo del set que el usuario eligió', async () => {
      await entrarYCorrer();

      const logo = fixture.nativeElement.querySelector('.navbar img') as HTMLImageElement;
      expect(logo.getAttribute('src')).toBe('data:pieza-wn');
    });

    it('si el set de piezas no baja, la carrera arranca igual (el lienzo avisará y se saltará)', async () => {
      piezas.load.mockRejectedValue(new Error('sin red'));

      await entrarYCorrer();

      expect(page.status).toBe('running');
      expect(fixture.nativeElement.querySelector('.navbar img')).toBeNull();
    });

    it('arma la carrera con las piezas del ejercicio, empezando por un peón', async () => {
      await entrarYCorrer();

      // Una carrera de media minuta en oleadas, que empieza por la pieza más baja
      expect(page.sequence.length).toBeGreaterThan(10);
      expect(page.sequence.length).toBeLessThanOrEqual(26);
      expect(page.sequence[0].kind).toBe('pawn');
      expect(lienzo()!.sequence).toBe(page.sequence);
      expect(page.progress).toEqual({ cleared: 0, total: page.sequence.length, stumbles: 0, combo: 0, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
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

    it('el avance del lienzo llena la barra de la carrera', async () => {
      lienzo()!.progress.emit({ cleared: 0, total: 10, stumbles: 0, combo: 0, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
      fixture.detectChanges();
      expect(page.progressPercent).toBe(0);

      lienzo()!.progress.emit({ cleared: 4, total: 10, stumbles: 1, combo: 0, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
      fixture.detectChanges();

      expect(page.progressPercent).toBe(40);
      expect(el('run-bar')!.getAttribute('aria-valuenow')).toBe('40');
      expect((el('run-bar')!.firstElementChild as HTMLElement).style.width).toBe('40%');
    });

    it('la barra marca dónde caen los respiros entre oleadas', () => {
      page.sequence = [
        { kind: 'pawn', color: 'w' },
        { kind: 'rook', color: 'w', rest: 2.4 },
        { kind: 'king', color: 'w' },
        { kind: 'king', color: 'w', rest: 2.4 },
      ];
      fixture.detectChanges();

      expect(page.waveMarks).toEqual([50, 100]);
      expect(fixture.nativeElement.querySelectorAll('[data-testid=wave-mark]')).toHaveLength(2);
    });

    it('sin carrera preparada la barra está vacía', () => {
      page.progress = { cleared: 0, total: 0, stumbles: 0, combo: 0, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 };

      expect(page.progressPercent).toBe(0);
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

    it('el ejercicio sale con 60 s de reloj, sin descontar nada de la carrera (y sin misión cumplida que le sume)', () => {
      page.mission = null;
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
      terminarCarrera({ total: 6, stumbles: 3, clean: false, durationMs: 20_000, bestCombo: 2, meters: 150, cookies: 3, perfects: 0, smashed: 0 });
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
      perfects: 0,
      bestCombo: 0,
      stars: 0,
      ...extra,
    });
    const chocar = () => {
      lienzo()!.runnerEvent.emit('stumble');
      fixture.detectChanges();
    };
    const corazonesLlenos = () => fixture.nativeElement.querySelectorAll('[data-testid=hearts] [data-full=true]').length;
    const registro = () => TestBed.inject(RunnerRecordService);

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
      expect(page.gameOver).toMatchObject({ reason: 'hits', meters: 87, newRecord: true, chapter: 1, round: 1, solved: 0 });
      expect(lienzo()).toBeUndefined();
      expect(el('game-over')).not.toBeNull();
      expect(eventos('chess_runner_game_over')).toEqual([
        { reason: 'hits', meters: 87, level: 1, solved: 0, cookies: 0, new_record: true },
      ]);
    });

    describe('la misión de la carrera', () => {
      /** Fuerza el tipo de misión de esta carrera: lo que se prueba es cómo reacciona la pantalla. */
      const conMision = (kind: Mission['kind'], target: number) => {
        page.mission = { kind, target, reward: 10 };
        page['missionState'] = 'active';
        fixture.detectChanges();
      };

      it('cada carrera trae su misión, a la vista en una esquina', async () => {
        await entrarYCorrer();

        expect(page.mission).not.toBeNull();
        expect(page.missionState).toBe('active');
        expect(el('mission')).not.toBeNull();
        expect(el('mission')!.getAttribute('data-state')).toBe('active');
      });

      it('cumplirla da tiempo de más para el ejercicio y se ve en el tablero', async () => {
        await entrarYCorrer();
        conMision('perfects', 3);

        lienzo()!.progress.emit(progreso({ perfects: 2 }));
        expect(page.missionCurrent).toBe(2);
        expect(page.missionState).toBe('active');
        lienzo()!.progress.emit(progreso({ perfects: 3 }));
        fixture.detectChanges();

        expect(page.missionState).toBe('done');
        expect(el('mission')!.getAttribute('data-state')).toBe('done');
        expect(sounds.playCheckSound).toHaveBeenCalled();

        terminarCarrera();
        expect((page.puzzleToPlay as { times: { total: number } }).times.total).toBe(70);
        expect(page.timeBonus).toBe(10);
        expect(el('time-bonus')!.textContent).toContain('+10');
      });

      it('sin cumplirla, el ejercicio tiene su tiempo de siempre', async () => {
        await entrarYCorrer();
        conMision('cookies', 99);
        lienzo()!.progress.emit(progreso({ cookies: 10 }));

        terminarCarrera();

        expect((page.puzzleToPlay as { times: { total: number } }).times.total).toBe(60);
        expect(page.timeBonus).toBe(0);
        expect(el('time-bonus')).toBeNull();
      });

      it('«sin choques» solo se cumple al llegar a la meta sin haber chocado', async () => {
        await entrarYCorrer();
        conMision('clean', 1);
        lienzo()!.progress.emit(progreso({ cleared: 5 }));
        expect(page.missionState).toBe('active');

        terminarCarrera({ ...STATS_LIMPIAS, stumbles: 0 });

        expect(page.missionState).toBe('done');
        expect(page.timeBonus).toBe(10);
      });

      it('«sin choques» se pierde con el primer choque, y ya no da nada aunque se llegue a la meta', async () => {
        await entrarYCorrer();
        conMision('clean', 1);

        lienzo()!.progress.emit(progreso({ stumbles: 1 }));
        expect(page.missionState).toBe('failed');
        fixture.detectChanges();
        expect(el('mission')!.getAttribute('data-state')).toBe('failed');

        terminarCarrera({ ...STATS_LIMPIAS, stumbles: 1, clean: false });
        expect(page.missionState).toBe('failed');
        expect(page.timeBonus).toBe(0);
      });

      it('la de la estrella se cumple al cogerla, y la de la racha con la mejor racha de la carrera', async () => {
        await entrarYCorrer();
        conMision('star', 1);
        lienzo()!.progress.emit(progreso({ stars: 1 }));
        expect(page.missionState).toBe('done');

        page.mission = { kind: 'combo', target: 8, reward: 10 };
        page['missionState'] = 'active';
        lienzo()!.progress.emit(progreso({ bestCombo: 8 }));
        expect(page.missionState).toBe('done');
      });

      it('una misión cumplida se cuenta una sola vez, y la carrera siguiente trae otra desde cero', async () => {
        await entrarYCorrer();
        conMision('perfects', 1);
        lienzo()!.progress.emit(progreso({ perfects: 1 }));
        lienzo()!.progress.emit(progreso({ perfects: 2 }));
        expect(sounds.playCheckSound).toHaveBeenCalledTimes(1);

        terminarCarrera();
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(1700);
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.missionState).toBe('active');
        expect(page.timeBonus).toBe(0);
      });

      it('saltarse la carrera no da la misión', async () => {
        await entrarYCorrer();
        conMision('cookies', 1);

        page.skipRun();

        expect(page.timeBonus).toBe(0);
      });
    });

    describe('el armario del perrito', () => {
      const alPerder = async () => {
        await entrarYCorrer();
        chocar();
        chocar();
        chocar();
        await vaciarPromesas();
        fixture.detectChanges();
      };
      const tarjetas = () => Array.from(fixture.nativeElement.querySelectorAll('[data-testid=skin]')) as HTMLButtonElement[];

      it('las galletas que se cogen se guardan en la cartera, aunque luego se pierda la partida', async () => {
        await entrarYCorrer();

        lienzo()!.progress.emit(progreso({ cookies: 12 }));
        lienzo()!.progress.emit(progreso({ cookies: 20 }));

        expect(page.wallet).toBe(20);
        expect(TestBed.inject(RunnerRecordService).loadCampaign().cookies).toBe(20);
      });

      it('el ELO de la barra cuenta del anterior al nuevo en un momento y acaba en el valor real', async () => {
        await entrarYCorrer();
        terminarCarrera();
        const antes = page.rating;
        expect(page.shownRating).toBe(antes);

        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        expect(page.rating).toBeGreaterThan(antes);
        expect(page.shownRating).toBe(antes);
        jest.advanceTimersByTime(300);
        expect(page.shownRating).toBeGreaterThan(antes);
        expect(page.shownRating).toBeLessThan(page.rating);
        jest.advanceTimersByTime(600);
        expect(page.shownRating).toBe(page.rating);
      });

      it('si se falla, el ELO de la barra baja hasta el nuevo valor', async () => {
        await entrarYCorrer();
        terminarCarrera();
        const antes = page.rating;

        page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(900);

        expect(page.rating).toBeLessThan(antes);
        expect(page.shownRating).toBe(page.rating);
      });

      it('desde la segunda ronda, la barra dice en cuál se va', async () => {
        await entrarYCorrer();
        expect(el('round-chip')).toBeNull();

        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, round: 2 });
        await entrar();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(el('round-chip')!.textContent).toContain('round');
      });

      it('los días seguidos jugando salen en la barra solo desde el segundo día', async () => {
        const hoy = new Date();
        const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
        const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, days: 1, lastDay: clave(ayer) });
        await entrarYCorrer();
        expect(el('day-streak')).toBeNull();

        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, days: 4, lastDay: clave(ayer) });
        await entrar();
        await vaciarPromesas();
        fixture.detectChanges();
        expect(page.dayStreak).toBe(4);
        expect(el('day-streak')!.textContent).toContain('4');

        // Si pasaron días sin jugar, ya no se ve
        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, days: 9, lastDay: '2020-01-01' });
        await entrar();
        await vaciarPromesas();
        fixture.detectChanges();
        expect(el('day-streak')).toBeNull();
      });

      it('al perder se ve el armario con la cartera y cada pelaje en su estado', async () => {
        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, cookies: PRECIO_DORADO + 50 });
        await alPerder();

        expect(el('wardrobe')).not.toBeNull();
        expect(el('wallet')!.textContent).toContain(`${PRECIO_DORADO + 50}`);
        expect(tarjetas().map((t) => t.getAttribute('data-state'))).toEqual(['worn', 'affordable', 'locked', 'locked', 'locked', 'locked']);
        expect(sprites.load).toHaveBeenCalled();
      });

      it('tocar uno que alcanza lo compra y se lo pone; el lienzo lo lleva en la carrera siguiente', async () => {
        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, cookies: PRECIO_DORADO + 50 });
        await alPerder();

        tarjetas()[1].click();
        fixture.detectChanges();

        expect(page.wallet).toBe(50);
        expect(page.skin).toBe('golden');
        expect(tarjetas().map((t) => t.getAttribute('data-state'))).toEqual(['owned', 'worn', 'locked', 'locked', 'locked', 'locked']);
        expect(sounds.playGood).toHaveBeenCalled();
        expect(eventos('chess_runner_skin')).toEqual([{ skin: 'golden', action: 'buy' }]);

        page.playAgain();
        await vaciarPromesas();
        fixture.detectChanges();
        expect(lienzo()!.skin).toBe('golden');
      });

      it('tocar uno que ya se tiene se lo pone, gratis; los que faltan galletas no se pueden tocar', async () => {
        TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, cookies: 10, skin: 'golden', skins: ['choco', 'golden'] });
        await alPerder();

        expect(tarjetas()[2].disabled).toBe(true);
        expect(tarjetas()[1].disabled).toBe(true);
        tarjetas()[0].click();
        fixture.detectChanges();

        expect(page.skin).toBe('choco');
        expect(page.wallet).toBe(10);
      });
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

      it('al pasar el récord de distancia sale un aviso, una sola vez, y se va solo', async () => {
        registro().save(100);
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 90 }));
        expect(page.recordBannerVisible).toBe(false);

        lienzo()!.progress.emit(progreso({ meters: 101 }));
        fixture.detectChanges();
        expect(page.recordBannerVisible).toBe(true);
        expect(el('record-banner')).not.toBeNull();
        expect(sounds.playCheckmateSound).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(2700);
        fixture.detectChanges();
        expect(page.recordBannerVisible).toBe(false);
        expect(el('record-banner')).toBeNull();

        // No vuelve a salir en la misma partida
        lienzo()!.progress.emit(progreso({ meters: 150 }));
        expect(page.recordBannerVisible).toBe(false);
        expect(sounds.playCheckmateSound).toHaveBeenCalledTimes(1);
      });

      it('sin récord anterior (la primera partida) no hay aviso: todo lo que se corre sería récord', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ meters: 500 }));

        expect(page.recordBannerVisible).toBe(false);
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

      it('la pantalla de fin enseña el camino: dónde va el perrito, con sus estrellas y sus poderes', async () => {
        sembrar({ chapter: 3, puzzles: 20, powers: ['nose', 'spring', 'shield'], stars: [3, 2, 1] });
        await entrarYCorrer();
        chocar();
        chocar();
        chocar();

        const mapa = el('map')!;
        expect(mapa).not.toBeNull();
        const estados = Array.from(mapa.querySelectorAll('[data-testid=map-node]')).map((n) => n.getAttribute('data-state'));
        expect(estados.slice(0, 5)).toEqual(['beaten', 'beaten', 'beaten', 'current', 'locked']);
        // Las piezas del set del usuario
        expect(mapa.querySelector('img')!.getAttribute('src')).toBe('data:pieza-bp');
        expect(el('map-powers')!.querySelectorAll('img')).toHaveLength(3);
        // Y dónde se sigue al volver a jugar
        expect(el('game-over-next')!.textContent).toContain(`Tema ${CHAPTERS[3].theme}`);
      });

      it('la pantalla de fin de partida enseña nivel, resueltos y galletas', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        lienzo()!.progress.emit(progreso({ meters: 10, cookies: 7 }));
        chocar();
        chocar();
        chocar();

        expect(el('game-over-level')!.textContent).toContain('1');
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

      it('un choque hace saltar hasta ocho de las galletas que se llevaban hacia el próximo corazón', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ cookies: 20 }));
        expect(page.cookieStreak).toBe(20);

        page.onRunnerEvent('stumble');
        expect(page.cookieStreak).toBe(12);

        // Con pocas, solo se pierden esas; nunca quedan negativas
        lienzo()!.progress.emit(progreso({ cookies: 23 }));
        expect(page.cookieStreak).toBe(15);
        page.onRunnerEvent('stumble');
        page.onRunnerEvent('stumble');
        expect(page.cookieStreak).toBe(0);
      });

      it('el lienzo sabe cuántas galletas lleva el perrito para soltarlas al chocar', async () => {
        await entrarYCorrer();
        lienzo()!.progress.emit(progreso({ cookies: 5 }));
        fixture.detectChanges();

        expect(lienzo()!.carrying).toBe(5);
      });

      it('los saltos perfectos, la estrella y lo arrollado suenan, sin costar nada', async () => {
        await entrarYCorrer();
        const vibrate = jest.fn();
        Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
        const corazones = page.hearts;

        page.onRunnerEvent('perfect');
        expect(sounds.playGood).toHaveBeenCalled();
        page.onRunnerEvent('star');
        expect(sounds.playCheckSound).toHaveBeenCalled();
        expect(vibrate).toHaveBeenCalledWith(25);
        sounds.playCaptureSound.mockClear();
        page.onRunnerEvent('smash');
        expect(sounds.playCaptureSound).toHaveBeenCalled();
        page.onRunnerEvent('starEnd');

        expect(page.hearts).toBe(corazones);
        Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
      });

      it('el doble salto suena como el salto', async () => {
        await entrarYCorrer();

        page.onRunnerEvent('doubleJump');

        expect(sounds.playSelect).toHaveBeenCalled();
      });
    });

    describe('«Jugar otra vez»', () => {
      it('empieza una partida nueva con todo a cero, salvo el récord y lo que se lleva de la campaña', async () => {
        await entrarYCorrer();
        await resolverYSeguir();
        await resolverYSeguir();
        lienzo()!.progress.emit(progreso({ meters: 90, cookies: 5 }));
        chocar();
        chocar();
        chocar();
        expect(page.step.index).toBe(2);

        page.playAgain();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.status).toBe('running');
        expect(page.gameOver).toBeNull();
        expect(page.hearts).toBe(MAX_HEARTS);
        expect(page.strikes).toBe(0);
        expect(page.meters).toBe(0);
        expect(page.cookiesTotal).toBe(0);
        expect(page.solvedCount).toBe(0);
        // Los dos ejercicios resueltos (140 m cada carrera) más lo corrido antes de perder
        expect(page.record).toBe(370);
        // La campaña sigue donde iba: el mismo capítulo, con dos ejercicios del bloque ya hechos
        expect(page.step).toMatchObject({ chapter: 0, index: 2, theme: CHAPTERS[0].theme });
        expect(page.campaign.solvedInBlock).toBe(2);
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
      it('la primera carrera de todas explica lo básico', async () => {
        await entrarYCorrer();

        expect(page.bannerHint).toBe('first');
        expect(el('banner-title')!.textContent).toContain(`Tema ${CHAPTERS[0].theme}`);
        expect(el('banner-hint')!.textContent).toContain('CHESS_RUNNER.levelHint.first');
      });

      it('las siguientes, sin subtítulo: solo el nombre del patrón', async () => {
        await entrarYCorrer();
        await resolverYSeguir();

        expect(page.bannerHint).toBe('none');
        expect(el('banner-title')).not.toBeNull();
        expect(el('banner-hint')).toBeNull();
      });

      it('el doble salto no se explica al empezar la carrera (la falange queda lejos): el cartel solo trae el nombre', async () => {
        sembrar({ chapter: 1, puzzles: 5 });
        await entrarYCorrer();

        expect(page.sequence.some((p) => (p.wall ?? 1) > 1)).toBe(true);
        expect(page.bannerHint).toBe('none');
        expect(el('banner-hint')).toBeNull();
        expect(el('wall-hint')).toBeNull();
      });

      it('un repaso se anuncia como tal, con el nombre del patrón que se repasa', async () => {
        sembrar({
          chapter: 2,
          puzzles: 10,
          review: { theme: CHAPTERS[0].theme, left: 2 },
        });
        await entrarYCorrer();

        expect(page.step.kind).toBe('review');
        expect(page.bannerHint).toBe('review');
        expect(el('banner-title')!.textContent).toContain(`Tema ${CHAPTERS[0].theme}`);
        expect(el('banner-hint')!.textContent).toContain('CHESS_RUNNER.levelHint.review');
      });

      it('el mundo es el del capítulo: cambia con el currículo, no con los ejercicios', async () => {
        await entrarYCorrer();
        expect(page.world).toBe(CHAPTERS[0].world);

        sembrar({ chapter: 2, puzzles: 10 });
        await entrar();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.world).toBe(CHAPTERS[2].world);
        expect(lienzo()!.world).toBe(CHAPTERS[2].world);
      });

      it('las carreras llevan falanges según el capítulo', async () => {
        await entrarYCorrer();
        expect(page.sequence.every((p) => (p.wall ?? 1) === 1)).toBe(true);

        sembrar({ chapter: 1, puzzles: 5 });
        await entrar();
        await vaciarPromesas();
        expect(page.sequence.filter((p) => (p.wall ?? 1) > 1)).toHaveLength(1);
      });
    });

    it('al volver a entrar, partida nueva (corazones, fallos, distancia) pero la campaña, donde quedó', async () => {
      await entrarYCorrer();
      chocar();
      await resolverYSeguir();

      await entrar();
      await vaciarPromesas();

      expect(page.hearts).toBe(MAX_HEARTS);
      expect(page.strikes).toBe(0);
      expect(page.step.index).toBe(1);
    });
  });

  describe('la historia', () => {
    const escena = () => fixture.debugElement.query(By.directive(EscenaFalsa))?.componentInstance as EscenaFalsa | undefined;
    const sinHistoria = (cambios: Partial<ReturnType<typeof newCampaign>> = {}) =>
      TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: LECCIONES_VISTAS, ...cambios });
    const sinVistos = (...claves: string[]) => LECCIONES_VISTAS.filter((c) => !claves.includes(c));

    it('la primera carrera de la vida empieza con el prólogo, sin carrera ni lección todavía', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();

      expect(page.status).toBe('story');
      expect(page.scene?.id).toBe('prologue');
      expect(el('story')).not.toBeNull();
      expect(escena()!.scene).toBe(page.scene);
      expect(lienzo()).toBeUndefined();
      expect(eventos('chess_runner_started')).toEqual([]);
    });

    it('lo visto se guarda: el prólogo y la llegada al primer mundo no vuelven', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();

      expect(TestBed.inject(RunnerRecordService).loadCampaign().seen).toEqual(expect.arrayContaining(['prologue', 'intro:0']));
    });

    it('al acabar el prólogo, el camino hasta el frasco; después lo que toque: la lección del primer patrón y la carrera', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();

      escena()!.finished.emit();
      fixture.detectChanges();
      expect(page.status).toBe('card');
      expect(page.card).toEqual({ kind: 'journey' });
      expect(el('journey-title')).not.toBeNull();
      expect(fixture.debugElement.queryAll(By.directive(RunnerMapComponent))).toHaveLength(1);

      (el('card-continue') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(page.status).toBe('lesson');
      expect(page.card).toBeNull();

      page.skipLesson();
      fixture.detectChanges();
      expect(page.status).toBe('running');
      expect(page.scene).toBeNull();
    });

    it('tocar la escena, o su botón, la salta', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();
      (el('story') as HTMLElement).click();
      fixture.detectChanges();
      expect(page.status).toBe('card');

      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      (el('story-skip') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(page.status).toBe('card');
    });

    it('si la escena no puede dibujarse, la partida sigue sin ella', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();

      escena()!.failed.emit();
      fixture.detectChanges();

      expect(page.status).toBe('card');
    });

    it('«Seguir» solo cierra la tarjeta que se está viendo: un doble toque no se salta lo que viene', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign(newCampaign());
      await entrarYCorrer();
      escena()!.finished.emit();
      fixture.detectChanges();

      page.closeCard();
      page.closeCard();
      fixture.detectChanges();

      expect(page.status).toBe('lesson');
    });

    it('un aviso de fin de escena que llega tarde, ya en otra pantalla, se ignora', async () => {
      sinHistoria({ seen: sinVistos('prologue') });
      await entrarYCorrer();
      const vieja = escena()!;
      vieja.finished.emit();

      page.onStoryFinished();
      page.skipStory();

      // Se quedó en la tarjeta del camino (lo tardío no se salta nada)...
      expect(page.status).toBe('card');
      page.closeCard();
      // ...y la historia ya vista no vuelve
      expect(page.status).toBe('running');
    });

    it('cada capítulo nuevo empieza con su llegada al mundo, antes de la lección', async () => {
      sinHistoria({ chapter: 2, puzzles: 10, seen: sinVistos('intro:2', `lesson:${CHAPTERS[2].theme}`) });
      await entrarYCorrer();

      expect(page.status).toBe('story');
      expect(page.scene).toMatchObject({ id: 'intro', chapter: 2 });

      escena()!.finished.emit();
      fixture.detectChanges();
      expect(page.status).toBe('lesson');
      expect(page.lesson).toEqual(lessonFor(CHAPTERS[2].theme));
    });

    it('si ya se vio la llegada, no se repite al volver', async () => {
      sinHistoria({ chapter: 2, puzzles: 10 });
      await entrarYCorrer();

      expect(page.status).toBe('running');
    });

    it('la llegada sin lección que enseñar pasa directo a la carrera', async () => {
      sinHistoria({ chapter: 2, puzzles: 10, seen: sinVistos('intro:2'), review: { theme: 'endgame', left: 2 } });
      await entrarYCorrer();
      // Un repaso no trae llegada (ya se estuvo en ese mundo): va a la carrera
      expect(page.status).toBe('running');
    });

    describe('al terminar un capítulo', () => {
      /** Deja todo listo para resolver el último ejercicio del capítulo `capitulo`. */
      async function aPuntoDeCerrar(capitulo: number, extra: Partial<ReturnType<typeof newCampaign>> = {}) {
        sinHistoria({
          chapter: capitulo,
          solvedInBlock: BLOCK_SIZE - 1,
          puzzles: capitulo * 6,
          powers: poderesHasta(capitulo),
          ...extra,
        });
        await entrarYCorrer();
        terminarCarrera();
      }

      it('tras el tablero resuelto llega la escena de victoria, con las estrellas y el poder ganado', async () => {
        await aPuntoDeCerrar(1);
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

        jest.advanceTimersByTime(2399);
        expect(page.status).toBe('result');
        jest.advanceTimersByTime(2);
        fixture.detectChanges();

        expect(page.status).toBe('story');
        expect(page.scene?.id).toBe('victory');
        expect(page.scene?.chapter).toBe(1);
        expect(sounds.playCheckmateSound).toHaveBeenCalledTimes(1);
        const poderes = (page.scene!.frame(3.2, 200).dog?.gear ?? []) as string[];
        expect(poderes).toEqual([CHAPTERS[1].power]);
      });

      it('al acabar la victoria sigue la llegada al mundo siguiente, y después la lección y la carrera', async () => {
        await aPuntoDeCerrar(1, { seen: sinVistos('intro:2') });
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(2500);
        fixture.detectChanges();

        escena()!.finished.emit();
        await vaciarPromesas();
        fixture.detectChanges();

        // El poder nuevo se explica antes de seguir: una tarjeta con su icono, su nombre y lo que hace
        expect(page.status).toBe('card');
        expect(page.card).toEqual({ kind: 'power', power: CHAPTERS[1].power });
        expect(el('power-name')!.textContent).toContain(`powers.${CHAPTERS[1].power}.name`);
        expect(el('power-desc')).not.toBeNull();

        page.closeCard();
        await vaciarPromesas();
        fixture.detectChanges();
        // Tras el primer capítulo con repaso: el siguiente paso es un repaso del patrón anterior, ya enseñado
        expect(['story', 'running']).toContain(page.status);
        expect(page.campaign.chapter).toBe(2);
      });

      it('el poder ganado se queda en la campaña y el perrito lo lleva en la carrera siguiente', async () => {
        await aPuntoDeCerrar(1);
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(2500);
        fixture.detectChanges();
        escena()!.finished.emit();
        await vaciarPromesas();
        fixture.detectChanges();
        page.closeCard();
        await vaciarPromesas();
        fixture.detectChanges();
        page.skipStory();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.campaign.powers).toEqual([CHAPTERS[1].power]);
        if (page.status === 'running') {
          expect(lienzo()!.gear).toEqual(page.campaign.powers);
        }
      });

      it('un ejercicio que no cierra el capítulo no trae ninguna escena', async () => {
        sinHistoria({ chapter: 1, solvedInBlock: 1, puzzles: 7 });
        await entrarYCorrer();
        terminarCarrera();
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(1600);
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.status).toBe('running');
        expect(page.scene).toBeNull();
      });

      it('si se sale durante la escena, no queda nada pendiente', async () => {
        await aPuntoDeCerrar(1);
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(2500);
        expect(page.status).toBe('story');

        page.ionViewWillLeave();
        page.skipStory();

        expect(page.scene).toBeNull();
        expect(page.status).toBe('story');
      });

      it('la escena de victoria se puede saltar', async () => {
        await aPuntoDeCerrar(1);
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(2500);

        page.skipStory();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.status).not.toBe('story');
      });
    });

    describe('el final de la historia', () => {
      const ultimo = CHAPTERS.length - 1;

      async function cerrarElUltimo(vistas: string[] = LECCIONES_VISTAS.filter((c) => c !== 'epilogue')) {
        TestBed.inject(RunnerRecordService).saveCampaign({
          ...newCampaign(),
          chapter: ultimo,
          solvedInBlock: BLOCK_SIZE - 1,
          puzzles: 60,
          powers: poderesHasta(ultimo),
          seen: vistas,
        });
        await entrarYCorrer();
        terminarCarrera();
        page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
        jest.advanceTimersByTime(2500);
        fixture.detectChanges();
      }

      it('al cerrar el último capítulo, tras la victoria llega el final, una sola vez', async () => {
        await cerrarElUltimo();
        expect(page.scene?.id).toBe('victory');

        escena()!.finished.emit();
        fixture.detectChanges();
        // Antes del final, el último poder: la corona
        expect(page.status).toBe('card');
        expect(page.card).toEqual({ kind: 'power', power: 'crown' });
        page.closeCard();
        fixture.detectChanges();
        expect(page.status).toBe('story');
        expect(page.scene?.id).toBe('epilogue');
        expect(TestBed.inject(RunnerRecordService).loadCampaign().seen).toContain('epilogue');

        escena()!.finished.emit();
        await vaciarPromesas();
        fixture.detectChanges();
        expect(page.status).not.toBe('story');
      });

      it('con todos los capítulos hechos empieza otra ronda con los mismos patrones, más difíciles', async () => {
        await cerrarElUltimo();
        escena()!.finished.emit();
        page.closeCard();
        escena()!.finished.emit();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.campaign.round).toBe(1);
        expect(page.campaign.chapter).toBe(0);
        expect(page.step.kind).toBe('review');
        expect(page.campaign.powers).toHaveLength(POWER_IDS.length);
        // Y el nivel de la carrera sigue subiendo con los capítulos vencidos
        expect(page.level).toBe(CHAPTERS.length + 1);
      });

      it('si el final ya se vio, no se repite', async () => {
        await cerrarElUltimo(LECCIONES_VISTAS);
        escena()!.finished.emit();
        page.closeCard();
        await vaciarPromesas();
        fixture.detectChanges();

        expect(page.scene?.id).not.toBe('epilogue');
      });
    });
  });

  describe('la lección del patrón', () => {
    const sinVer = () => TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), seen: HISTORIA_VISTA });
    const leccion = () => fixture.debugElement.query(By.directive(LeccionFalsa))?.componentInstance as LeccionFalsa | undefined;

    it('la primera vez que se entrena un patrón se enseña antes de correr, y todavía no hay carrera', async () => {
      sinVer();
      await entrarYCorrer();

      expect(page.status).toBe('lesson');
      expect(page.lesson).toEqual(lessonFor(CHAPTERS[0].theme));
      expect(el('lesson')).not.toBeNull();
      expect(el('lesson-pattern')!.textContent).toContain(`Tema ${CHAPTERS[0].theme}`);
      expect(lienzo()).toBeUndefined();
      expect(leccion()!.lesson).toBe(page.lesson);
      // Y la analítica de la carrera no cuenta nada hasta que empieza
      expect(eventos('chess_runner_started')).toEqual([]);
    });

    it('se marca como vista y se guarda: no se vuelve a enseñar', async () => {
      sinVer();
      await entrarYCorrer();

      expect(TestBed.inject(RunnerRecordService).loadCampaign().seen).toContain(`lesson:${CHAPTERS[0].theme}`);

      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      expect(page.status).toBe('running');
    });

    it('al acabar la animación la lección se queda a la vista (hay que leerla) y el botón «Empezar» llama la atención', async () => {
      sinVer();
      await entrarYCorrer();
      expect(page.lessonDone).toBe(false);

      leccion()!.finished.emit();
      jest.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(page.status).toBe('lesson');
      expect(page.lessonDone).toBe(true);
      expect(el('lesson-continue')!.classList.contains('animate-pulse')).toBe(true);
    });

    it('solo el botón «Empezar» salta a la carrera: tocar la lección no la cierra', async () => {
      sinVer();
      await entrarYCorrer();
      (el('lesson') as HTMLElement).click();
      fixture.detectChanges();
      expect(page.status).toBe('lesson');

      (el('lesson-continue') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(page.status).toBe('running');
      expect(page.lesson).toBeNull();
      expect(page.lessonDone).toBe(false);
      expect(lienzo()).toBeDefined();
      expect(eventos('chess_runner_started')).toHaveLength(1);
    });

    it('si la lección no puede dibujarse, la carrera sigue sin ella', async () => {
      sinVer();
      await entrarYCorrer();

      leccion()!.failed.emit();
      fixture.detectChanges();

      expect(page.status).toBe('running');
    });

    it('un aviso de fin de la lección que llega ya en la carrera se ignora', async () => {
      sinVer();
      await entrarYCorrer();
      page.skipLesson();

      page.onLessonFinished();
      jest.advanceTimersByTime(5000);

      expect(page.status).toBe('running');
      expect(eventos('chess_runner_started')).toHaveLength(1);
    });

    it('solo se enseña al empezar el bloque, no en los ejercicios siguientes', async () => {
      sinVer();
      TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), solvedInBlock: 2, puzzles: 2, seen: HISTORIA_VISTA });
      await entrarYCorrer();

      expect(page.status).toBe('running');
    });

    it('cada capítulo nuevo trae su lección', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign({ ...newCampaign(), chapter: 1, puzzles: 5, seen: [...HISTORIA_VISTA, `lesson:${CHAPTERS[0].theme}`] });
      await entrarYCorrer();

      expect(page.status).toBe('lesson');
      expect(page.lesson).toEqual(lessonFor(CHAPTERS[1].theme));
    });

    it('un repaso enseña también el patrón, una vez', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign({
        ...newCampaign(),
        chapter: 2,
        puzzles: 10,
        seen: [...HISTORIA_VISTA, `lesson:${CHAPTERS[0].theme}`, `lesson:${CHAPTERS[1].theme}`, `lesson:${CHAPTERS[2].theme}`],
        review: { theme: CHAPTERS[0].theme, left: 2 },
      });
      await entrarYCorrer();

      expect(page.status).toBe('lesson');
      expect(page.step.kind).toBe('review');
      expect(page.lesson).toEqual(lessonFor(CHAPTERS[0].theme));
      expect(TestBed.inject(RunnerRecordService).loadCampaign().seen).toContain(`review:${CHAPTERS[0].theme}`);
    });

    it('si el patrón no tiene lección, se corre directo', async () => {
      TestBed.inject(RunnerRecordService).saveCampaign({
        ...newCampaign(),
        chapter: 2,
        puzzles: 10,
        seen: HISTORIA_VISTA,
        review: { theme: 'endgame', left: 2 },
      });
      await entrarYCorrer();

      expect(page.status).toBe('running');
    });
  });

  describe('los poderes del perrito en la partida', () => {
    it('el lienzo recibe las reglas con los poderes ganados, y el perrito lleva su equipo', async () => {
      sembrar({ chapter: 3, puzzles: 20, powers: ['shield', 'nose', 'trail'] });
      await entrarYCorrer();

      expect(lienzo()!.mods!.shields).toBe(1);
      expect(lienzo()!.gear).toEqual(['shield', 'nose', 'trail']);
      expect(page.mods.tapCue).toBe(true);
    });

    it('sin poderes, las reglas de siempre', async () => {
      await entrarYCorrer();

      expect(lienzo()!.mods!.shields).toBe(0);
      expect(page.heartSlots).toHaveLength(3);
    });

    it('con el poder del corazón hay un hueco más, y el corazón de más cuenta ya lleno', async () => {
      sembrar({ chapter: 12, puzzles: 60, powers: poderesHasta(12) });
      await entrarYCorrer();
      expect(page.heartSlots).toHaveLength(3);

      // El capítulo 14 (el 13 contando desde 0) da el corazón
      sembrar({ chapter: 13, puzzles: 65, powers: poderesHasta(13), solvedInBlock: BLOCK_SIZE - 1 });
      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      expect(page.heartSlots).toHaveLength(3);
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(CHAPTERS[13].power).toBe('heart');
      expect(page.heartSlots).toHaveLength(4);
      expect(page.hearts).toBe(4);
    });

    it('un poder ganado a mitad de partida cuenta ya, sin esperar a otra partida', async () => {
      sembrar({ chapter: 3, puzzles: 15, powers: ['nose'], solvedInBlock: BLOCK_SIZE - 1 });
      await entrarYCorrer();
      terminarCarrera();

      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      expect(CHAPTERS[3].power).toBe('spring');
      expect(page.mods.doubleJumpVelocity).toBeGreaterThan(modifiersFor([]).doubleJumpVelocity);
    });

    it('las reglas de la partida nueva también llevan los poderes', async () => {
      sembrar({ chapter: 14, puzzles: 70, powers: poderesHasta(14) });
      await entrarYCorrer();

      expect(page.session.rules.maxHearts).toBe(4);
      expect(page.hearts).toBe(4);
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('stumble');
      expect(page.status).toBe('running');
      page.onRunnerEvent('stumble');
      expect(page.status).toBe('gameover');
    });

    it('el escudo roto suena y vibra un poco, pero no cuesta corazón', async () => {
      const vibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      sembrar({ chapter: 6, puzzles: 30, powers: ['nose', 'spring', 'shield'] });
      await entrarYCorrer();

      page.onRunnerEvent('shield');

      expect(sounds.playCheckSound).toHaveBeenCalled();
      expect(vibrate).toHaveBeenCalledWith(30);
      expect(page.hearts).toBe(3);
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    });

    it('la corona cura dos corazones al resolver', async () => {
      sembrar({ chapter: CHAPTERS.length - 1, puzzles: 90, powers: poderesHasta(CHAPTERS.length) });
      await entrarYCorrer();
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('stumble');
      page.onRunnerEvent('stumble');
      expect(page.hearts).toBe(1);
      terminarCarrera();

      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      expect(page.hearts).toBe(3);
    });
  });

  describe('el aviso del doble salto', () => {
    const avanzarHasta = (limpias: number) => {
      lienzo()!.progress.emit({ cleared: limpias, total: page.sequence.length, stumbles: 0, combo: limpias, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
      fixture.detectChanges();
    };
    const primeraFalange = () => page.sequence.findIndex((p) => (p.wall ?? 1) > 1);

    it('sale justo antes de la primera falange, no antes', async () => {
      sembrar({ chapter: 1, puzzles: 5 });
      await entrarYCorrer();
      const antes = primeraFalange() - 1;

      avanzarHasta(antes - 1);
      expect(el('wall-hint')).toBeNull();

      avanzarHasta(antes);
      expect(page.wallHintVisible).toBe(true);
      expect(el('wall-hint')!.textContent).toContain('CHESS_RUNNER.levelHint.doubleJump');
    });

    it('se va solo pasados unos segundos', async () => {
      sembrar({ chapter: 1, puzzles: 5 });
      await entrarYCorrer();
      avanzarHasta(primeraFalange() - 1);

      jest.advanceTimersByTime(2700);
      expect(page.wallHintVisible).toBe(true);
      jest.advanceTimersByTime(200);
      fixture.detectChanges();

      expect(page.wallHintVisible).toBe(false);
      expect(el('wall-hint')).toBeNull();
    });

    it('solo sale una vez en la vida: se guarda y no vuelve en la carrera siguiente', async () => {
      sembrar({ chapter: 1, puzzles: 5 });
      await entrarYCorrer();
      avanzarHasta(primeraFalange() - 1);
      expect(TestBed.inject(RunnerRecordService).loadCampaign().seen).toContain('hint:doubleJump');
      jest.advanceTimersByTime(3000);

      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      avanzarHasta(primeraFalange() - 1);

      expect(page.wallHintVisible).toBe(false);
    });

    it('si ya se vio, no sale aunque haya falange', async () => {
      sembrar({ chapter: 1, puzzles: 5, seen: [...LECCIONES_VISTAS, 'hint:doubleJump'] });
      await entrarYCorrer();
      avanzarHasta(primeraFalange() - 1);

      expect(page.wallHintVisible).toBe(false);
    });

    it('sin falanges (el primer capítulo) no hay aviso', async () => {
      await entrarYCorrer();
      avanzarHasta(5);

      expect(page.wallHintVisible).toBe(false);
    });

    it('salir de la pantalla lo apaga y no deja nada pendiente', async () => {
      sembrar({ chapter: 1, puzzles: 5 });
      await entrarYCorrer();
      avanzarHasta(primeraFalange() - 1);

      page.ionViewWillLeave();
      jest.advanceTimersByTime(5000);

      expect(page.wallHintVisible).toBe(false);
    });
  });

  describe('el patrón, el nivel y la racha', () => {
    it('la primera carrera es del primer capítulo y se ve qué patrón se entrena y cuánto lleva', async () => {
      await entrarYCorrer();

      expect(page.level).toBe(1);
      expect(el('pattern')!.textContent).toContain(`Tema ${CHAPTERS[0].theme}`);
      expect(fixture.nativeElement.querySelectorAll('[data-testid=block-dots] span')).toHaveLength(BLOCK_SIZE);
      expect(lienzo()!.difficulty).toEqual(difficultyForLevel(1));
    });

    it('dentro del capítulo cada ejercicio resuelto hace la siguiente carrera algo más rápida y de ritmo más apretado', async () => {
      await entrarYCorrer();
      const primera = lienzo()!.difficulty!;

      await resolverYSeguir();

      const segunda = lienzo()!.difficulty!;
      expect(page.level).toBe(1);
      expect(segunda.startSpeed).toBeGreaterThan(primera.startSpeed);
      expect(segunda.minGapTime).toBeLessThan(primera.minGapTime);
      expect(segunda).toEqual(difficultyForLevel(1.18));
    });

    it('al cerrar el capítulo se sube de nivel, cambia el patrón y salta el siguiente escalón de dificultad', async () => {
      await entrarYCorrer();
      for (let i = 0; i < BLOCK_SIZE; i++) {
        await resolverYSeguir();
      }

      expect(page.level).toBe(2);
      expect(page.step.theme).toBe(CHAPTERS[1].theme);
      expect(page.step.index).toBe(0);
      expect(lienzo()!.difficulty).toEqual(difficultyForLevel(2));
    });

    it('todos los ejercicios de un capítulo se piden del mismo patrón', async () => {
      await entrarYCorrer();
      for (let i = 0; i < BLOCK_SIZE - 1; i++) {
        await resolverYSeguir();
      }

      const temas = puzzles.next.mock.calls.map((llamada) => llamada[3]);
      expect(new Set(temas)).toEqual(new Set([CHAPTERS[0].theme]));
    });

    it('el guardián (el último ejercicio del capítulo) pone una carrera más dura: más rápida y con más piezas encadenadas', async () => {
      sembrar({ chapter: 4, puzzles: 25, solvedInBlock: BLOCK_SIZE - 2, powers: poderesHasta(4) });
      await entrarYCorrer();
      const normal = lienzo()!.difficulty!;
      expect(page.bossKey).toBeNull();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      jest.advanceTimersByTime(1700);
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.bossKey).not.toBeNull();
      const jefe = lienzo()!.difficulty!;
      expect(jefe.startSpeed).toBeGreaterThan(normal.startSpeed);
      expect(page.bannerHint).toBe('boss');
      expect(el('banner-hint')!.textContent).toContain('levelHint.boss');
      // Y el patrón se marca con la calavera del jefe
      expect(el('boss-icon')).not.toBeNull();
    });

    it('el tablero resuelto sigue diciendo el patrón del ejercicio, no el del siguiente paso de la campaña', async () => {
      sembrar({ chapter: 0, solvedInBlock: BLOCK_SIZE - 1, puzzles: 4 });
      await entrarYCorrer();
      terminarCarrera();
      expect(page.puzzlePatternName).toBe(`Tema ${CHAPTERS[0].theme}`);
      expect(page.puzzleBoss).toBe(true);
      expect(page.puzzleDone).toBe(BLOCK_SIZE - 1);

      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      // La campaña ya apunta al capítulo siguiente...
      expect(page.patternName).toBe(`Tema ${CHAPTERS[1].theme}`);
      // ...pero el tablero que se está viendo es del guardián vencido, con todos sus puntos llenos
      expect(page.puzzlePatternName).toBe(`Tema ${CHAPTERS[0].theme}`);
      expect(page.puzzleDone).toBe(BLOCK_SIZE);
      expect(page.puzzleBoss).toBe(true);
      expect(el('puzzle-pattern')!.textContent).toContain(`Tema ${CHAPTERS[0].theme}`);
      expect(el('puzzle-boss')).not.toBeNull();
    });

    it('y suben de ELO a lo largo del bloque', async () => {
      await entrarYCorrer();
      for (let i = 0; i < BLOCK_SIZE - 1; i++) {
        await resolverYSeguir();
      }

      const elos = puzzles.next.mock.calls.map((llamada) => llamada[0] as number);
      // El de cada ejercicio (el precargado cuenta contando con acertar): empieza 200 por debajo del ELO del perrito
      // (1100: 300 menos que el del usuario) y sube con el puesto del bloque y con el ELO que va ganando el perrito
      expect(elos[0]).toBe(1100 - 200);
      expect(elos.slice(0, 4)).toEqual([...elos.slice(0, 4)].sort((a, b) => a - b));
      expect(elos[3]).toBeGreaterThan(elos[0] + 200);
    });

    it('fallar un ejercicio no avanza el bloque ni el nivel, y el siguiente es del mismo patrón pero más fácil', async () => {
      await entrarYCorrer();
      puzzles.next.mockClear();
      terminarCarrera();
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      page.retry();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.level).toBe(1);
      expect(page.step.index).toBe(0);
      const ultima = puzzles.next.mock.calls[puzzles.next.mock.calls.length - 1];
      expect(ultima[3]).toBe(CHAPTERS[0].theme);
      // 200 por debajo y, por el fallo, 100 más; el ELO del perrito ha bajado un poco al fallar un ejercicio de 1400
      expect(ultima[0]).toBeLessThan(1100 - 200 - 100);
      expect(ultima[0]).toBeGreaterThan(1100 - 200 - 100 - 40);
    });

    it('el progreso se guarda en cada ejercicio: salir y volver sigue donde iba', async () => {
      await entrarYCorrer();
      await resolverYSeguir();
      await resolverYSeguir();

      const guardada = TestBed.inject(RunnerRecordService).loadCampaign();

      expect(guardada.solvedInBlock).toBe(2);
      expect(guardada.puzzles).toBe(2);
      expect(guardada.mastery[CHAPTERS[0].theme]).toMatchObject({ solved: 2, failed: 0 });
    });

    it('cerrar un capítulo guarda el poder y las estrellas', async () => {
      await entrarYCorrer();
      for (let i = 0; i < BLOCK_SIZE; i++) {
        await resolverYSeguir();
      }

      const guardada = TestBed.inject(RunnerRecordService).loadCampaign();
      expect(guardada.chapter).toBe(1);
      expect(guardada.powers).toEqual([]);
      expect(guardada.stars).toEqual([3]);
    });

    it('el quinto acierto dice «patrón dominado» y las estrellas; los demás, no', async () => {
      await entrarYCorrer();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();
      expect(el('chapter-done')).toBeNull();

      sembrar({ chapter: 0, solvedInBlock: BLOCK_SIZE - 1, puzzles: 4 });
      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(page.chapterDone).toEqual({ theme: CHAPTERS[0].theme, stars: 3 });
      expect(el('chapter-done')!.textContent).toContain('CHESS_RUNNER.result.chapterDone');
    });

    it('al cerrar un capítulo el tablero se queda más tiempo a la vista antes de la escena de victoria', async () => {
      sembrar({ chapter: 0, solvedInBlock: BLOCK_SIZE - 1, puzzles: 4 });
      await entrarYCorrer();
      terminarCarrera();
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);

      jest.advanceTimersByTime(1700);
      expect(page.status).toBe('result');
      jest.advanceTimersByTime(800);
      fixture.detectChanges();

      expect(page.status).toBe('story');
      expect(page.scene?.id).toBe('victory');
    });

    it('la racha se ve y se enciende a partir de tres piezas seguidas', async () => {
      await entrarYCorrer();
      expect(el('combo')!.textContent).toContain('CHESS_RUNNER.combo');
      expect(el('combo')!.classList).not.toContain('badge-warning');

      lienzo()!.progress.emit({ cleared: 3, total: 6, stumbles: 0, combo: 3, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
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

    it('al acertar, sin cerrar el capítulo, no dice nada de patrón dominado', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('chapter-done')).toBeNull();
      expect(page.level).toBe(1);
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

      // Tras un fallo se pidió ya el ejercicio más fácil del mismo patrón (el 3.º del catálogo de pruebas)
      expect(page.puzzle?.uid).toBe('ej-3');
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
      expect(page.puzzle?.uid).toBe('ej-3');
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

    it('tras fallar se puede volver a ver el patrón: abre su lección en una ventana', async () => {
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(page.hasPatternLesson).toBe(true);
      (el('show-lesson') as HTMLButtonElement).click();
      await vaciarPromesas();

      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({
          component: RunnerLessonModalComponent,
          componentProps: { lesson: lessonFor(CHAPTERS[0].theme), title: `Tema ${CHAPTERS[0].theme}` },
        })
      );
      expect(modal.present).toHaveBeenCalled();
      // Ver el patrón no continúa el juego: se sigue en el resultado
      expect(page.status).toBe('result');
    });

    it('si el patrón no tiene lección, no se ofrece', async () => {
      sembrar({ chapter: 2, puzzles: 10, review: { theme: 'endgame', left: 2 } });
      await entrar();
      await vaciarPromesas();
      fixture.detectChanges();
      terminarCarrera();
      page.onPuzzleFailed(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(page.hasPatternLesson).toBe(false);
      expect(el('show-lesson')).toBeNull();
      await page.showPatternLesson();
      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('al acertar no se ofrece (se sigue solo)', () => {
      page.onPuzzleSolved(page.puzzleToPlay as Puzzle);
      fixture.detectChanges();

      expect(el('show-lesson')).toBeNull();
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
      lienzo()?.progress?.emit({ cleared: 4, total: 6, stumbles: 2, combo: 3, meters: 0, cookies: 0, perfects: 0, bestCombo: 0, stars: 0 });
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
    it('la equis a mitad de partida lleva al panel, con lo corrido guardado; desde el panel, al inicio', async () => {
      await entrarYCorrer();
      lienzo()!.progress.emit({ cleared: 2, total: 6, stumbles: 0, combo: 2, meters: 60, cookies: 0, perfects: 0, bestCombo: 2, stars: 0 });

      page.exit();
      fixture.detectChanges();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(page.status).toBe('gameover');
      expect(page.gameOver).toMatchObject({ reason: 'quit', meters: 60 });
      expect(el('game-over')).not.toBeNull();
      expect(lienzo()).toBeUndefined();
      expect(TestBed.inject(RunnerRecordService).best()).toBe(60);

      page.exit();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('la equis también lleva al panel desde el ejercicio, y desde el error va directo al inicio', async () => {
      await entrarYCorrer();
      terminarCarrera();
      expect(page.status).toBe('puzzle');

      page.exit();
      expect(page.status).toBe('gameover');
      expect(page.gameOver?.reason).toBe('quit');

      puzzles.next.mockResolvedValue(null);
      await entrar();
      page.exit();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('la primera vez (sin ejercicios jugados) se entra directo al juego, sin panel', async () => {
      await entrarYCorrer();

      expect(page.gameOver).toBeNull();
      expect(page.status).toBe('running');
    });

    it('quien ya jugó vuelve al panel (sin partida a medias) y el juego empieza con «Jugar»', async () => {
      sembrar({ chapter: 2, puzzles: 12 });
      page.ionViewWillEnter();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('gameover');
      expect(page.gameOver).toMatchObject({ reason: 'lobby', meters: 0, solved: 0, chapter: 3 });
      expect(lienzo()).toBeUndefined();
      expect(el('game-over-meters')).toBeNull();
      expect(el('game-over-title')!.textContent).toContain('title');
      expect(el('play-again')!.textContent).toContain('gameOver.play');
      expect(eventos('chess_runner_game_over')).toEqual([]);

      (el('play-again') as HTMLButtonElement).click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('running');
      expect(page.hearts).toBe(MAX_HEARTS);
    });

    it('el panel al entrar ya trae las piezas del set (el logo y el camino se ven sin haber corrido antes)', async () => {
      piezas.load.mockResolvedValue({ ...PIEZAS, urls: new Map([['bp', 'data:peon'], ['wn', 'data:caballo']]) });
      sembrar({ chapter: 2, puzzles: 12 });

      page.ionViewWillEnter();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('gameover');
      expect(piezas.load).toHaveBeenCalled();
      expect(page.pieceImages.get('bp')).toBe('data:peon');
      expect(page.pieceUrl({ kind: 'knight', color: 'w' })).toBe('data:caballo');
    });

    it('cerrar y volver a entrar cae en el panel, no en la partida que se dejó a medias', async () => {
      await entrarYCorrer();
      await resolverYSeguir();
      expect(page.status).toBe('running');

      page.ionViewWillLeave();
      page.ionViewWillEnter();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(page.status).toBe('gameover');
      expect(page.gameOver?.reason).toBe('lobby');
      expect(page.campaign.puzzles).toBe(1);
    });

    it('la equis lleva al inicio a quien ya está en el panel', async () => {
      sembrar({ chapter: 1, puzzles: 5 });
      page.ionViewWillEnter();
      await vaciarPromesas();

      page.exit();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('las piezas del set que llegan cuando ya se salió no arrancan la carrera', async () => {
      const lentas = diferida<typeof PIEZAS>();
      piezas.load.mockReturnValueOnce(lentas.promesa);

      await entrar();
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

      await entrar();
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
