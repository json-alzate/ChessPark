// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar. Aquí no
// se dibuja ningún tablero: se sustituye por dobles con el mismo selector y E/S.
jest.mock('@chesspark/board', () => {
  const { Component, Input, Output, EventEmitter } = jest.requireActual('@angular/core');

  class BoardPuzzleComponent {
    setPuzzle: unknown;
    setForceStopTimer = false;
    showBoardControls = true;
    puzzleCompleted = new EventEmitter();
    puzzleFailed = new EventEmitter();
    puzzleEndByTime = new EventEmitter();
  }
  Component({ selector: 'lib-board-puzzle', standalone: true, template: '' })(BoardPuzzleComponent);
  for (const input of ['setPuzzle', 'setForceStopTimer', 'showBoardControls']) {
    Input()(BoardPuzzleComponent.prototype, input);
  }
  for (const output of ['puzzleCompleted', 'puzzleFailed', 'puzzleEndByTime']) {
    Output()(BoardPuzzleComponent.prototype, output);
  }

  class BoardPuzzleSolutionComponent {}
  Component({ selector: 'lib-board-puzzle-solution', standalone: true, template: '' })(BoardPuzzleSolutionComponent);
  class FenBoardComponent {}
  Component({ selector: 'lib-fen-board', standalone: true, template: '' })(FenBoardComponent);

  return {
    BoardPuzzleComponent,
    BoardPuzzleSolutionComponent,
    FenBoardComponent,
    PIECES_STYLE_OPTIONS: [],
    BOARD_STYLE_OPTIONS: [],
    getChessboardAppearance: () => ({ pieces: 'cburnett', board: 'chessboard-js' }),
    setChessboardAppearance: jest.fn(),
    isPiecesStyle: () => true,
    isBoardStyle: () => true,
  };
});
// Piezas visuales de otras pantallas, sustituidas por etiquetas vacías.
jest.mock('@shared/components/navbar/navbar.component', () => {
  const { Component } = jest.requireActual('@angular/core');
  class NavbarComponent {}
  Component({ selector: 'app-navbar', standalone: true, template: '' })(NavbarComponent);
  return { NavbarComponent };
});
jest.mock('@app/features/home/containers/training-menu/training-menu.component', () => {
  const { Component } = jest.requireActual('@angular/core');
  class TrainingMenuComponent {}
  Component({ selector: 'app-training-menu', standalone: true, template: '' })(TrainingMenuComponent);
  return { TrainingMenuComponent };
});
jest.mock('@app/pages/puzzles/components/plan-chart/plan-chart.component', () => {
  const { Component, Input } = jest.requireActual('@angular/core');
  class PlanChartComponent {}
  Component({ selector: 'app-plan-chart', standalone: true, template: '' })(PlanChartComponent);
  Input()(PlanChartComponent.prototype, 'plan');
  return { PlanChartComponent };
});

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { IonContent, IonIcon, IonModal, LoadingController, ModalController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { Block, Puzzle, Reto333Record, StreakRecord } from '@chesspark/models';
import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';
import { getIsInitialized } from '@chesspark/state';

import { HomePage } from '@app/features/home/pages/home.page';
import { ProfileService } from '@core/account/profile.service';
import { AppService } from '@core/app/app.service';
import { AppearanceService } from '@core/app/appearance.service';
import { PlanService } from '@services/plans/plan.service';
import { StreakStorageService } from '@features/records/services/streak-storage.service';
import { BlockService } from '@services/training/block.service';
import { InfinityPuzzlePoolService } from '@services/training/infinity-puzzle-pool.service';
import { Reto333StorageService } from '@features/records/services/reto333-storage.service';
import { OnboardingModalComponent, ONBOARDING_SEEN_KEY } from '@shared/components/onboarding-modal/onboarding-modal.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

/** Deja correr las promesas pendientes (cargas asíncronas del home). */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function makePuzzle(uid = 'p1', fen = '8/8/8/8/8/8/8/8 w - - 0 1'): Puzzle {
  return { uid, fen, moves: 'e2e4', rating: 1500, themes: ['mateIn1', 'fork'] } as unknown as Puzzle;
}

const STREAK: StreakRecord = { bestScore: 12, lastScore: 7, runsPlayed: 3 } as StreakRecord;
const RETO: Reto333Record = { lastScore: 111, bestScore: 150, timeString: '12m 30s', completed: false } as Reto333Record;

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let store: MockStore;
  let router: Router;

  let planService: { newPlan: jest.Mock };
  let puzzlesProvider: { getPuzzles: jest.Mock };
  let blockService: { generateBlocksForPlan: jest.Mock; getPuzzlesForBlock: jest.Mock };
  let pool: Record<'getUserInfinityElo' | 'getPool' | 'isPoolValid' | 'peekOnePuzzle' | 'findPuzzleFromCachedFiles' | 'buildPool' | 'removePuzzleFromPool' | 'getNextPuzzle', jest.Mock>;
  let streakStorage: { getRecord: jest.Mock };
  let retoStorage: { getRecord: jest.Mock };
  let profileService: { getProfile: { elos?: Record<string, unknown> } | null };
  let appService: { getNameThemePuzzleByValue: jest.Mock };
  let modalController: { create: jest.Mock };
  let modal: { present: jest.Mock };
  let loader: { present: jest.Mock; dismiss: jest.Mock };
  let loadingController: { create: jest.Mock };
  let navigate: jest.SpyInstance;

  const text = () => fixture.nativeElement.textContent as string;

  /** Entra a la pantalla con la sesión ya resuelta (o no). */
  async function enter(initialized = true) {
    store.overrideSelector(getIsInitialized, initialized);
    store.refreshState();
    component.ionViewWillEnter();
    await flush();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined); // avisos de Ionic/Ionicons sin runtime
    localStorage.clear();

    planService = { newPlan: jest.fn().mockResolvedValue({}) };
    puzzlesProvider = { getPuzzles: jest.fn().mockResolvedValue([makePuzzle('net')]) };
    blockService = {
      generateBlocksForPlan: jest.fn().mockResolvedValue([{ label: 'a' }, { label: 'b' }] as unknown as Block[]),
      getPuzzlesForBlock: jest.fn().mockResolvedValue([makePuzzle('r1')]),
    };
    pool = {
      getUserInfinityElo: jest.fn().mockReturnValue(1600),
      getPool: jest.fn().mockResolvedValue(null),
      isPoolValid: jest.fn().mockReturnValue(true),
      peekOnePuzzle: jest.fn().mockResolvedValue(makePuzzle('pool')),
      findPuzzleFromCachedFiles: jest.fn().mockResolvedValue(null),
      buildPool: jest.fn().mockResolvedValue(undefined),
      removePuzzleFromPool: jest.fn().mockResolvedValue(undefined),
      getNextPuzzle: jest.fn().mockResolvedValue(makePuzzle('next')),
    };
    streakStorage = { getRecord: jest.fn().mockReturnValue(STREAK) };
    retoStorage = { getRecord: jest.fn().mockReturnValue(RETO) };
    profileService = { getProfile: null };
    appService = { getNameThemePuzzleByValue: jest.fn((t: string) => `tema:${t}`) };
    modal = { present: jest.fn().mockResolvedValue(undefined) };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    loader = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(true) };
    loadingController = { create: jest.fn().mockResolvedValue(loader) };

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideMockStore(),
        provideTranslocoTesting(),
        { provide: PlanService, useValue: planService },
        { provide: PuzzlesProvider, useValue: puzzlesProvider },
        { provide: BlockService, useValue: blockService },
        { provide: InfinityPuzzlePoolService, useValue: pool },
        { provide: StreakStorageService, useValue: streakStorage },
        { provide: Reto333StorageService, useValue: retoStorage },
        { provide: ProfileService, useValue: profileService },
        { provide: AppService, useValue: appService },
        { provide: AppearanceService, useValue: { pieces: () => 'cburnett' } },
        { provide: ModalController, useValue: modalController },
        { provide: LoadingController, useValue: loadingController },
      ],
    })
      // Los componentes de Ionic necesitan su runtime; aquí se dejan como etiquetas.
      .overrideComponent(HomePage, {
        remove: { imports: [IonContent, IonModal, IonIcon] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
    navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    store.resetSelectors();
    jest.restoreAllMocks();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  describe('antes de que se resuelva la sesión', () => {
    it('muestra el esqueleto del menú, sin título ni menú de rutinas', async () => {
      await enter(false);

      expect(component.isInitialized).toBe(false);
      expect(fixture.nativeElement.querySelector('h1')).toBeNull();
      expect(fixture.debugElement.query(By.css('app-training-menu'))).toBeNull();
      expect(fixture.nativeElement.querySelector('.skeleton')).not.toBeNull();
    });

    it('no carga el puzzle continuo ni muestra el onboarding todavía', async () => {
      await enter(false);

      expect(pool.getPool).not.toHaveBeenCalled();
      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('lee de inmediato los récords del dispositivo, sin esperar a la nube', async () => {
      await enter(false);

      expect(component.streakRecord).toEqual(STREAK);
      expect(component.reto333Stats).toEqual(RETO);
      expect(component.isLoadingReto333).toBe(false);
    });

    it('sin marca del Reto 333 en el dispositivo mantiene el esqueleto hasta abrir sesión', async () => {
      retoStorage.getRecord.mockReturnValue(null);

      await enter(false);
      expect(component.isLoadingReto333).toBe(true);

      await enter(true);
      expect(component.isLoadingReto333).toBe(false);
    });
  });

  describe('con la sesión resuelta', () => {
    it('muestra el título del menú de entrenamiento y el menú de rutinas', async () => {
      await enter();

      expect(component.isInitialized).toBe(true);
      expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('PUZZLES.menu.title');
      expect(fixture.debugElement.query(By.css('app-training-menu'))).not.toBeNull();
    });

    it('pinta las tarjetas de Racha y Reto 333 con sus marcas', async () => {
      await enter();

      expect(text()).toContain('STREAK.title');
      expect(text()).toContain('RETO_333.survival');
      expect(text()).toContain('111'); // último intento del Reto 333
      expect(text()).toContain('150'); // récord
      expect(text()).toContain('12m 30s');
      expect(text()).toContain('STREAK.actions.retry'); // ya jugó rachas
    });

    it('sin rachas jugadas la tarjeta invita a empezar', async () => {
      streakStorage.getRecord.mockReturnValue({ ...STREAK, runsPlayed: 0 });

      await enter();

      expect(text()).toContain('STREAK.actions.start');
      expect(text()).not.toContain('STREAK.actions.retry');
    });

    it('en la web (no nativa) ofrece la descarga de la app, no la donación', async () => {
      await enter();

      expect(component.isNativePlatform).toBe(false);
      expect(text()).toContain('DOWNLOAD.homeCard.title');
      expect(text()).not.toContain('DONATION.homeCard.title');
    });

    it('volver a entrar relee los récords por si llegaron de la nube', async () => {
      await enter();
      streakStorage.getRecord.mockReturnValue({ ...STREAK, lastScore: 99 });

      await enter();

      expect(component.streakRecord?.lastScore).toBe(99);
    });

    it('solo carga el puzzle continuo una vez por visita aunque el estado se repita', async () => {
      await enter();
      store.overrideSelector(getIsInitialized, true);
      store.refreshState();
      await flush();

      expect(pool.getPool).toHaveBeenCalledTimes(1);
    });
  });

  describe('onboarding', () => {
    it('la primera vez abre el modal de bienvenida', async () => {
      await enter();

      expect(modalController.create).toHaveBeenCalledWith({ component: OnboardingModalComponent });
      expect(modal.present).toHaveBeenCalledTimes(1);
    });

    it('si ya se vio no vuelve a mostrarse', async () => {
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');

      await enter();

      expect(modalController.create).not.toHaveBeenCalled();
    });
  });

  describe('puzzle de entrenamiento continuo', () => {
    it('con un pozo válido toma el puzzle del pozo sin quitarlo', async () => {
      pool.getPool.mockResolvedValue({ puzzles: [] });

      await enter();

      expect(pool.peekOnePuzzle).toHaveBeenCalled();
      expect(component.infinitePuzzle?.uid).toBe('pool');
      expect(component.isLoadingPuzzle).toBe(false);
      expect(pool.findPuzzleFromCachedFiles).not.toHaveBeenCalled();
      expect(puzzlesProvider.getPuzzles).not.toHaveBeenCalled();
    });

    it('con un pozo que ya no sirve busca en los archivos descargados y reconstruye el pozo', async () => {
      pool.getPool.mockResolvedValue({ puzzles: [] });
      pool.isPoolValid.mockReturnValue(false);
      pool.findPuzzleFromCachedFiles.mockResolvedValue(makePuzzle('cache'));

      await enter();

      expect(pool.peekOnePuzzle).not.toHaveBeenCalled();
      expect(pool.findPuzzleFromCachedFiles).toHaveBeenCalledWith(1600);
      expect(pool.buildPool).toHaveBeenCalledWith(1600);
      expect(component.infinitePuzzle?.uid).toBe('cache');
    });

    it('sin nada en caché lo descarga con el elo del usuario', async () => {
      await enter();

      expect(puzzlesProvider.getPuzzles).toHaveBeenCalledWith({ elo: 1600 });
      expect(component.infinitePuzzle?.uid).toBe('net');
      expect(pool.buildPool).toHaveBeenCalledWith(1600);
    });

    it('si no hay puzzle de ningún lado deja de cargar con el tablero vacío', async () => {
      puzzlesProvider.getPuzzles.mockResolvedValue([]);

      await enter();

      expect(component.infinitePuzzle).toBeNull();
      expect(component.isLoadingPuzzle).toBe(false);
    });

    it('con puzzle pinta el tablero y el botón de entrenar', async () => {
      await enter();

      expect(fixture.debugElement.query(By.css('lib-board-puzzle'))).not.toBeNull();
      expect(text()).toContain('PUZZLES.general.trainNow');
    });

    it('resolver bien marca resuelto, guarda el estado y saca el puzzle del pozo', async () => {
      await enter();
      const board = fixture.debugElement.query(By.css('lib-board-puzzle')).componentInstance;

      board.puzzleCompleted.emit();
      fixture.detectChanges();

      expect(component.isInfinitePuzzleSolved).toBe(true);
      expect(component.infinitePuzzleProblemState).toBe('good');
      expect(pool.removePuzzleFromPool).toHaveBeenCalledWith('net');
      expect(text()).toContain('PUZZLE_SOLUTION.feedback.excellent');
      expect(text()).toContain('COMMON.actions.continue');
    });

    it('fallar muestra el aviso y el botón de ver la solución', async () => {
      await enter();
      const board = fixture.debugElement.query(By.css('lib-board-puzzle')).componentInstance;

      board.puzzleFailed.emit();
      fixture.detectChanges();

      expect(component.infinitePuzzleProblemState).toBe('bad');
      expect(text()).toContain('PUZZLE_SOLUTION.feedback.wrong');
      expect(text()).toContain('PUZZLE_SOLUTION.actions.solution');
    });

    it('quedarse sin tiempo cuenta como fallo ("timeOut")', async () => {
      await enter();

      fixture.debugElement.query(By.css('lib-board-puzzle')).componentInstance.puzzleEndByTime.emit();

      expect(component.infinitePuzzleProblemState).toBe('timeOut');
      expect(component.isInfinitePuzzleSolved).toBe(true);
    });

    it('ver la solución abre el modal con el puzzle y los temas traducidos', async () => {
      await enter();

      await component.showSolution();

      expect(modalController.create).toHaveBeenCalledWith({
        component: BoardPuzzleSolutionComponent,
        cssClass: 'puzzle-solution-modal',
        componentProps: { puzzle: component.infinitePuzzle, themesTranslated: ['tema:mateIn1', 'tema:fork'] },
      });
    });

    it('showSolution no hace nada sin puzzle', async () => {
      await component.showSolution();

      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('al salir de la pantalla limpia el puzzle para destruir el tablero', async () => {
      await enter();

      component.ionViewWillLeave();

      expect(component.infinitePuzzle).toBeNull();
      expect(component.isInfinitePuzzleSolved).toBe(false);
      expect(component.infinitePuzzleProblemState).toBe('none');
    });

    it('después de salir ya no reacciona a cambios de la sesión', async () => {
      await enter(false);
      component.ionViewWillLeave();

      store.overrideSelector(getIsInitialized, true);
      store.refreshState();
      await flush();

      expect(pool.getPool).not.toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    it('playerColor es el contrario de quien mueve en el FEN; sin puzzle, blancas', () => {
      expect(component.playerColor).toBe('white');

      component.infinitePuzzle = makePuzzle('x', '8/8/8/8/8/8/8/8 w - - 0 1');
      expect(component.playerColor).toBe('black');

      component.infinitePuzzle = makePuzzle('x', '8/8/8/8/8/8/8/8 b - - 0 1');
      expect(component.playerColor).toBe('white');
    });

    it('infinityElo: el del perfil si existe, "1500?" si no', () => {
      expect(component.infinityElo).toBe('1500?');

      profileService.getProfile = { elos: { infinityTotal: 1720 } };
      expect(component.infinityElo).toBe(1720);

      profileService.getProfile = { elos: { infinityTotal: 'x' } };
      expect(component.infinityElo).toBe('1500?');
    });
  });

  describe('iniciar rutinas', () => {
    it('la rutina infinita arma el primer bloque con un solo puzzle del pozo y navega al entrenamiento', async () => {
      await component.startInfinityPlan();

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('infinity');
      const [blocks, type] = planService.newPlan.mock.calls[0];
      expect(type).toBe('infinity');
      expect(blocks[0].puzzles.map((p: Puzzle) => p.uid)).toEqual(['next']);
      expect(blockService.getPuzzlesForBlock).not.toHaveBeenCalled();
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('si el pozo no da puzzle el primer bloque queda sin puzzles (los pide el entrenamiento)', async () => {
      pool.getNextPuzzle.mockResolvedValue(null);

      await component.startInfinityPlan();

      expect(planService.newPlan.mock.calls[0][0][0].puzzles).toEqual([]);
    });

    it('si la rutina infinita falla cierra el cargando y no navega', async () => {
      planService.newPlan.mockRejectedValue(new Error('fallo'));

      await component.startInfinityPlan();

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('el Reto 333 carga los puzzles del primer bloque, crea el plan "reto333" y navega', async () => {
      await component.startReto333Plan();

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('reto333');
      expect(blockService.getPuzzlesForBlock).toHaveBeenCalledTimes(1);
      const [blocks, type] = planService.newPlan.mock.calls[0];
      expect(type).toBe('reto333');
      expect(blocks[0].puzzles.map((p: Puzzle) => p.uid)).toEqual(['r1']);
      expect(navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('el cargando del Reto 333 usa el texto traducido', async () => {
      jest.spyOn(TestBed.inject(TranslocoService), 'translate').mockReturnValue('Cargando reto...' as never);

      await component.startReto333Plan();

      expect(loadingController.create).toHaveBeenCalledWith({ message: 'Cargando reto...' });
    });

    it('si el Reto 333 falla cierra el cargando y no navega', async () => {
      blockService.getPuzzlesForBlock.mockRejectedValue(new Error('sin red'));

      await component.startReto333Plan();

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(planService.newPlan).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('la tarjeta de Racha lleva a /streak', async () => {
      await enter();

      component.goToStreak();

      expect(navigate).toHaveBeenCalledWith(['/streak']);
    });

    it('tocar la tarjeta del Reto 333 lo inicia', async () => {
      await enter();
      const card = Array.from(fixture.nativeElement.querySelectorAll('.card.cursor-pointer') as NodeListOf<HTMLElement>).find(
        (c) => c.textContent?.includes('RETO_333.survival'),
      );

      card?.click();
      await flush();

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('reto333');
    });
  });
});
