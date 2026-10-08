// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar (su
// paquete resuelve a un index.html). Aquí no se dibuja ningún tablero: se
// sustituye por dobles y se vacían los imports del componente.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class {},
}));

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import {
  AlertController,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { Block, Plan, Puzzle } from '@chesspark/models';
import { PlanFacadeService } from '@chesspark/state';
import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { SoundsService, UidGeneratorService } from '@chesspark/common-utils';

import { AppService } from '@services/app/app.service';
import { BlockService } from '@services/training/block.service';
import { InfinityPuzzlePoolService } from '@services/training/infinity-puzzle-pool.service';
import { ProfileService } from '@services/account/profile.service';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { PlanStorageService } from '@services/plans/plan-storage.service';
import { PlanService } from '@services/plans/plan.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { TrainingReminderService } from '@services/training/training-reminder.service';
import { Reto333StorageService } from '@services/training/reto333-storage.service';
import { UserRecordsService } from '@services/progress/user-records.service';

import { BlockPresentationComponent } from '../../components/block-presentation/block-presentation.component';
import { TrainingComponent } from './training.component';

/**
 * Pruebas de la pantalla de entrenamiento, en dos grupos:
 *
 * 1. Cronómetro del bloque y reparto entre "seguir en el bloque" y "cambiar de
 *    bloque". Cubren el fallo reportado: al fallar un ejercicio justo cuando se
 *    acababa el tiempo del bloque se abrían dos pantallas encima de la otra, el
 *    contador quedaba duplicado (bajaba al doble de velocidad) y se saltaban
 *    bloques hasta terminar el plan antes de tiempo.
 *
 * 2. Caracterización del flujo completo (arranque desde el store, bloques por
 *    cantidad y por tiempo, contadores, sonidos, registro de cada puzzle, orden
 *    de efectos, cierre de la rutina, Reto 333, rutina infinita, rutina
 *    personalizada y salida anticipada). Fijan el comportamiento observable tal
 *    y como está hoy para que cualquier refactor del componente lo conserve; si
 *    una de estas pruebas cambia, cambió el comportamiento y hay que decirlo.
 *
 * Todo se ejercita sin plantilla ni DOM: el estado vive en campos públicos y en
 * llamadas a los dobles, el reloj se controla con los fake timers de Jest y los
 * modales de Ionic se sustituyen por un objeto cuyo cierre dispara la prueba.
 */

function makePuzzle(uid = 'p1', overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    uid,
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    moves: 'e2e4',
    rating: 1500,
    ratingDeviation: 50,
    popularity: 90,
    randomNumberQuery: 0.5,
    nbPlays: 100,
    themes: ['mateIn1'],
    gameUrl: '',
    openingFamily: '',
    openingVariation: '',
    ...overrides,
  };
}

/** Lista de puzzles con uids consecutivos (`p1`, `p2`, …). */
function makePuzzles(count: number, prefix = 'p'): Puzzle[] {
  return Array.from({ length: count }, (_, i) => makePuzzle(`${prefix}${i + 1}`));
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    time: 60,
    puzzlesCount: 0,
    theme: 'mateIn1',
    elo: 1500,
    color: 'random',
    puzzles: [makePuzzle('a'), makePuzzle('b')],
    puzzlesPlayed: [],
    showPuzzleSolution: true,
    ...overrides,
  };
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    uid: 'plan-test',
    blocks: [makeBlock(), makeBlock(), makeBlock()],
    createdAt: Date.now(),
    planType: 'plan5',
    ...overrides,
  };
}

/** Modal falso cuyo cierre se dispara a mano desde la prueba. */
function makeFakeModal() {
  let resolveDismiss!: () => void;
  const dismissed = new Promise<void>((resolve) => {
    resolveDismiss = () => resolve();
  });
  return {
    dismiss: () => resolveDismiss(),
    modal: {
      present: jest.fn().mockResolvedValue(undefined),
      onDidDismiss: jest.fn().mockReturnValue(dismissed),
    },
  };
}

type FakeModal = ReturnType<typeof makeFakeModal>;

/** Deja correr las microtareas pendientes (creación y presentación del modal). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/** Perfil mínimo que lee el componente: uid, elo y los totales por rutina. */
interface FakeProfile {
  uid: string;
  elo: number;
  elos?: Record<string, number>;
}

/**
 * Dobles de las 20 dependencias del componente. Son objetos mutables para que
 * cada prueba ajuste solo lo que necesita (perfil, respuestas, orden de
 * llamadas) sin reconfigurar el TestBed.
 */
interface Mocks {
  /** Perfil que devuelve `ProfileService.getProfile`; `null` juega como invitado. */
  profile: FakeProfile | null;
  /** Lo que emite el store de planes; lo controla la prueba. */
  plan$: Subject<Plan | null>;
  loading$: BehaviorSubject<boolean>;
  modalController: { create: jest.Mock };
  alertController: { create: jest.Mock };
  loadingController: { create: jest.Mock };
  router: { navigate: jest.Mock; navigateByUrl: jest.Mock };
  planFacade: {
    getPlan$: jest.Mock;
    getLoadingPlan$: jest.Mock;
    updatePlan: jest.Mock;
    clearPlan: jest.Mock;
  };
  profileService: {
    readonly getProfile: FakeProfile | null;
    getEloTotalByPlanType: jest.Mock;
    calculateEloPuzzlePlan: jest.Mock;
  };
  blockService: { getPuzzlesForBlock: jest.Mock; generateBlocksForPlan: jest.Mock };
  appService: {
    getThemesPuzzlesList: unknown[];
    getNameThemePuzzleByValue: (v: string) => string;
    getDescriptionThemePuzzleByValue: (v: string) => string;
    getNameOpeningByValue: (v: string) => string;
    getDescriptionOpeningByValue: (v: string) => string;
  };
  translocoService: { translate: jest.Mock };
  soundsService: { playGood: jest.Mock; playError: jest.Mock; playLowTime: jest.Mock };
  uidGenerator: { generateSimpleUid: jest.Mock };
  analyticsService: { logEvent: jest.Mock };
  plansElosService: {
    calculatePlanElos: jest.Mock;
    incrementPlayCount: jest.Mock;
    getOnePlanElo: jest.Mock;
  };
  planStorageService: { savePlan: jest.Mock };
  planService: { newPlan: jest.Mock };
  infinityPoolService: { getNextPuzzle: jest.Mock };
  trainingReminderService: { onSessionCompleted: jest.Mock };
  reto333Storage: { saveAttempt: jest.Mock };
  userRecordsService: { push: jest.Mock };
}

function makeMocks(): Mocks {
  const mocks: Mocks = {
    profile: null,
    plan$: new Subject<Plan | null>(),
    loading$: new BehaviorSubject<boolean>(false),
    modalController: { create: jest.fn() },
    alertController: { create: jest.fn() },
    loadingController: { create: jest.fn() },
    router: { navigate: jest.fn(), navigateByUrl: jest.fn() },
    planFacade: {
      getPlan$: jest.fn(() => mocks.plan$),
      getLoadingPlan$: jest.fn(() => mocks.loading$),
      updatePlan: jest.fn(),
      clearPlan: jest.fn(),
    },
    profileService: {
      // Getter para que cada prueba cambie el perfil sobre la marcha.
      get getProfile() {
        return mocks.profile;
      },
      getEloTotalByPlanType: jest.fn().mockReturnValue(1500),
      calculateEloPuzzlePlan: jest.fn().mockReturnValue({ totalEloChange: 0 }),
    },
    blockService: {
      getPuzzlesForBlock: jest.fn().mockResolvedValue([]),
      generateBlocksForPlan: jest.fn(),
    },
    appService: {
      getThemesPuzzlesList: [],
      getNameThemePuzzleByValue: (v: string) => v,
      getDescriptionThemePuzzleByValue: (v: string) => v,
      getNameOpeningByValue: (v: string) => v,
      getDescriptionOpeningByValue: (v: string) => v,
    },
    translocoService: { translate: jest.fn((k: string) => k) },
    soundsService: {
      playGood: jest.fn(),
      playError: jest.fn(),
      playLowTime: jest.fn(),
    },
    uidGenerator: { generateSimpleUid: jest.fn().mockReturnValue('uid') },
    analyticsService: { logEvent: jest.fn().mockResolvedValue(undefined) },
    plansElosService: {
      calculatePlanElos: jest.fn(),
      incrementPlayCount: jest.fn().mockResolvedValue(undefined),
      getOnePlanElo: jest.fn(),
    },
    planStorageService: { savePlan: jest.fn() },
    planService: { newPlan: jest.fn() },
    infinityPoolService: { getNextPuzzle: jest.fn() },
    trainingReminderService: { onSessionCompleted: jest.fn() },
    reto333Storage: { saveAttempt: jest.fn() },
    userRecordsService: { push: jest.fn() },
  };
  return mocks;
}

/**
 * Monta el componente con la plantilla vacía y sin ejecutar ngOnInit (no hay
 * detectChanges): cada prueba decide si arranca por el store o monta el estado
 * a mano.
 */
async function createComponent(
  mocks: Mocks,
  returnTo?: string
): Promise<TrainingComponent> {
  await TestBed.configureTestingModule({
    imports: [TrainingComponent],
    providers: [
      { provide: ModalController, useValue: mocks.modalController },
      { provide: AlertController, useValue: mocks.alertController },
      { provide: LoadingController, useValue: mocks.loadingController },
      { provide: Router, useValue: mocks.router },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(returnTo ? { returnTo } : {}),
          },
        },
      },
      { provide: PlanFacadeService, useValue: mocks.planFacade },
      { provide: ProfileService, useValue: mocks.profileService },
      { provide: BlockService, useValue: mocks.blockService },
      { provide: AppService, useValue: mocks.appService },
      { provide: TranslocoService, useValue: mocks.translocoService },
      { provide: SoundsService, useValue: mocks.soundsService },
      { provide: UidGeneratorService, useValue: mocks.uidGenerator },
      { provide: AnalyticsService, useValue: mocks.analyticsService },
      { provide: PlansElosService, useValue: mocks.plansElosService },
      { provide: PlanStorageService, useValue: mocks.planStorageService },
      { provide: PlanService, useValue: mocks.planService },
      { provide: InfinityPuzzlePoolService, useValue: mocks.infinityPoolService },
      { provide: TrainingReminderService, useValue: mocks.trainingReminderService },
      { provide: Reto333StorageService, useValue: mocks.reto333Storage },
      { provide: UserRecordsService, useValue: mocks.userRecordsService },
    ],
  })
    .overrideComponent(TrainingComponent, {
      set: { template: '', imports: [], schemas: [] },
    })
    .compileComponents();

  const component = TestBed.createComponent(TrainingComponent).componentInstance;

  // Al crear el fixture, Angular programa un setTimeout(0) propio (su
  // planificador de detección de cambios). Se consume aquí, antes de que el
  // componente tenga ningún timer, para que jest.getTimerCount() cuente solo
  // los cronómetros del componente.
  jest.advanceTimersByTime(0);

  return component;
}

/**
 * Deja el componente como queda justo después de cerrar la presentación del
 * bloque `index`: puzzle en el tablero, contadores a cero y sin cronómetro.
 */
function mountAtBlock(component: TrainingComponent, plan: Plan, index = 0): void {
  const block = plan.blocks[index];
  component.plan = plan;
  component.currentIndexBlock = index;
  component.totalPuzzlesInBlock = block.puzzlesCount;
  component.countPuzzlesPlayedBlock = 0;
  component.puzzleToPlay = (block.puzzles ?? [])[0];
}

describe('TrainingComponent · cronómetro del bloque', () => {
  let component: TrainingComponent;
  let modalController: { create: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();

    const mocks = makeMocks();
    modalController = mocks.modalController;
    component = await createComponent(mocks);

    // Se evita ngOnInit: las pruebas montan el estado del plan a mano para
    // ejercitar el cronómetro sin depender del arranque del componente.
    component.plan = makePlan();
    component.currentIndexBlock = 0;
    component.puzzleToPlay = makePuzzle();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('no se acelera al arrancar el contador dos veces sin pausar', () => {
    component.initTimeToEndBlock(10);

    jest.advanceTimersByTime(1000);
    expect(component.timeLeftBlock).toBe(9);

    // Secuencia del fallo: al cerrarse la solución se reanudaba el contador y,
    // al cerrarse después la presentación del bloque, se arrancaba otro sin
    // apagar el primero. Los dos restaban a la vez y el bloque volaba.
    component.resumeBlockTimer();
    component.initTimeToEndBlock(10);

    jest.advanceTimersByTime(3000);
    expect(component.timeLeftBlock).toBe(7);
  });

  it('mantiene un solo contador tras pausar y reanudar varias veces', () => {
    component.initTimeToEndBlock(10);

    component.pauseBlockTimer();
    component.resumeBlockTimer();
    component.pauseBlockTimer();
    component.resumeBlockTimer();

    jest.advanceTimersByTime(3000);
    expect(component.timeLeftBlock).toBe(7);
  });

  it('no reanuda nada cuando ya no queda tiempo', () => {
    const nextBlock = jest.spyOn(component, 'playNextBlock');

    component.timeLeftBlock = 0;
    component.resumeBlockTimer();

    jest.advanceTimersByTime(5000);
    expect(nextBlock).not.toHaveBeenCalled();
  });

  it('cambia de bloque una sola vez aunque siga corriendo el reloj', () => {
    const presentation = jest
      .spyOn(component, 'showBlockPresentation')
      .mockResolvedValue(undefined);

    component.initTimeToEndBlock(1);

    jest.advanceTimersByTime(1000); // llega a 0
    jest.advanceTimersByTime(1000); // se agota el bloque
    expect(presentation).toHaveBeenCalledTimes(1);
    expect(component.currentIndexBlock).toBe(1);

    // Antes, los contadores huérfanos seguían pidiendo el bloque siguiente una
    // vez por segundo y se comían el plan entero.
    jest.advanceTimersByTime(10000);
    expect(presentation).toHaveBeenCalledTimes(1);
    expect(component.currentIndexBlock).toBe(1);
  });

  it('al fallar un ejercicio detiene el reloj del bloque y no abre la presentación encima', async () => {
    const presentation = jest
      .spyOn(component, 'showBlockPresentation')
      .mockResolvedValue(undefined);
    const fake = makeFakeModal();
    modalController.create.mockResolvedValue(fake.modal);

    component.initTimeToEndBlock(1);
    component.onPuzzleCompleted(makePuzzle(), 'bad');
    await flushMicrotasks();

    // Con la solución en pantalla el bloque no puede vencer por su cuenta.
    jest.advanceTimersByTime(10000);
    expect(presentation).not.toHaveBeenCalled();
    expect(component.currentIndexBlock).toBe(0);
    expect(modalController.create).toHaveBeenCalledTimes(1);
  });

  it('si el tiempo vence con la solución abierta, el cambio de bloque espera al cierre', () => {
    const presentation = jest
      .spyOn(component, 'showBlockPresentation')
      .mockResolvedValue(undefined);

    component['isSolutionOpen'] = true;
    component['onBlockTimeUp']();

    expect(presentation).not.toHaveBeenCalled();
    expect(component['blockTimeExpired']).toBe(true);

    // Al cerrarse la solución sí se pasa de bloque, y una sola vez.
    component['isSolutionOpen'] = false;
    component['continueAfterPuzzle']();

    expect(presentation).toHaveBeenCalledTimes(1);
    expect(component.currentIndexBlock).toBe(1);
  });

  it('descarta el resultado que llega con el cambio de bloque ya en marcha', () => {
    jest.spyOn(component, 'showBlockPresentation').mockResolvedValue(undefined);

    component.initTimeToEndBlock(1);
    jest.advanceTimersByTime(2000); // se agota el bloque y arranca el cambio

    expect(component.currentIndexBlock).toBe(1);

    // La respuesta llegó después del cambio: no debe anotarse en el bloque
    // nuevo ni abrir la solución encima de la presentación.
    component.onPuzzleCompleted(makePuzzle(), 'bad');

    expect(component.plan.blocks[1].puzzlesPlayed).toHaveLength(0);
    expect(modalController.create).not.toHaveBeenCalled();
  });
});

describe('TrainingComponent · caracterización del flujo de entrenamiento', () => {
  let component: TrainingComponent;
  let mocks: Mocks;
  /** Modales creados por el componente, en orden; el último es el que está abierto. */
  let modals: FakeModal[];

  /** Cierra el modal abierto como lo haría el usuario y deja correr su callback. */
  async function closeLastModal(): Promise<void> {
    await flushMicrotasks();
    const last = modals[modals.length - 1];
    if (!last) {
      throw new Error('No hay ningún modal abierto que cerrar');
    }
    last.dismiss();
    await flushMicrotasks();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mocks = makeMocks();
    modals = [];
    mocks.modalController.create.mockImplementation(async () => {
      const fake = makeFakeModal();
      modals.push(fake);
      return fake.modal;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('arranque desde el store', () => {
    it('al llegar el plan arranca en el bloque 0 y abre su presentación con título, descripción e imagen del tema', async () => {
      component = await createComponent(mocks);
      const nextBlock = jest.spyOn(component, 'playNextBlock');

      component.ngOnInit();
      mocks.plan$.next(makePlan());

      expect(nextBlock).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(0);
      expect(component.totalPuzzlesInBlock).toBe(0);
      expect(mocks.modalController.create).toHaveBeenCalledTimes(1);
      expect(mocks.modalController.create).toHaveBeenCalledWith({
        component: BlockPresentationComponent,
        componentProps: {
          title: 'mateIn1',
          description: 'mateIn1',
          image: '/assets/images/puzzle-themes/mate.svg',
        },
      });

      await flushMicrotasks();
      expect(modals[0].modal.present).toHaveBeenCalledTimes(1);

      // Con la presentación abierta todavía no hay puzzle ni cronómetro, y el
      // tablero queda parado.
      expect(component.puzzleToPlay).toBeUndefined();
      expect(component.showBlockTimer).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('al cerrarse la presentación pone el primer puzzle, registra puzzle_started y arranca el cronómetro con el tiempo del bloque', async () => {
      component = await createComponent(mocks);
      component.ngOnInit();
      mocks.plan$.next(makePlan());

      await closeLastModal();

      expect(component.puzzleToPlay.uid).toBe('a');
      expect(component.forceStopTimerInPuzzleBoard).toBe(false);
      expect(component.showBlockTimer).toBe(true);
      expect(component.timeLeftBlock).toBe(60);
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith('puzzle_started', {
        routine_kind: 'default',
        routine_minutes: 5,
        theme: 'mateIn1',
        puzzle_elo: 1500,
      });

      jest.advanceTimersByTime(2000);
      expect(component.timeLeftBlock).toBe(58);
    });

    it('guarda el elo inicial de la rutina (total y máximo del perfil) en el store antes de arrancar el primer bloque', async () => {
      mocks.profile = {
        uid: 'user-1',
        elo: 1600,
        elos: { plan5Total: 1650, plan5MaxTotal: 1800 },
      };
      mocks.profileService.getEloTotalByPlanType.mockReturnValue(1650);
      component = await createComponent(mocks);
      const nextBlock = jest.spyOn(component, 'playNextBlock');

      component.ngOnInit();
      mocks.plan$.next(makePlan());

      expect(mocks.profileService.getEloTotalByPlanType).toHaveBeenCalledWith('plan5');
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledTimes(1);
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'plan-test',
          initialTotalElo: 1650,
          initialMaxElo: 1800,
        })
      );
      expect(component.plan.initialMaxElo).toBe(1800);
      expect(mocks.planFacade.updatePlan.mock.invocationCallOrder[0]).toBeLessThan(
        nextBlock.mock.invocationCallOrder[0]
      );
    });

    it('sin máximo guardado en el perfil, el máximo inicial es el propio total de arranque', async () => {
      component = await createComponent(mocks);

      component.ngOnInit();
      mocks.plan$.next(makePlan());

      expect(mocks.planFacade.updatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ initialTotalElo: 1500, initialMaxElo: 1500 })
      );
    });

    it('en una rutina personalizada con sesión el elo inicial sale de los elos propios de la rutina, sin frenar el arranque', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      mocks.plansElosService.getOnePlanElo.mockResolvedValue({ total: 1400, maxTotal: 1550 });
      component = await createComponent(mocks);

      component.ngOnInit();
      mocks.plan$.next(makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' }));

      // El primer bloque arranca sin esperar a Firestore.
      expect(component.currentIndexBlock).toBe(0);
      expect(mocks.planFacade.updatePlan).not.toHaveBeenCalled();

      await flushMicrotasks();

      expect(mocks.plansElosService.getOnePlanElo).toHaveBeenCalledWith('cp-1');
      expect(mocks.profileService.getEloTotalByPlanType).not.toHaveBeenCalled();
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ initialTotalElo: 1400, initialMaxElo: 1550 })
      );
    });

    it('una rutina personalizada sin sesión arranca sin guardar elo inicial', async () => {
      component = await createComponent(mocks);

      component.ngOnInit();
      mocks.plan$.next(makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' }));
      await flushMicrotasks();

      expect(component.currentIndexBlock).toBe(0);
      expect(mocks.plansElosService.getOnePlanElo).not.toHaveBeenCalled();
      expect(mocks.planFacade.updatePlan).not.toHaveBeenCalled();
    });

    it('una nueva emisión del mismo plan (mismo uid) no reinicia la sesión', async () => {
      component = await createComponent(mocks);
      const nextBlock = jest.spyOn(component, 'playNextBlock');

      component.ngOnInit();
      const plan = makePlan();
      mocks.plan$.next(plan);
      mocks.plan$.next({ ...plan, initialMaxElo: 1500 });

      expect(nextBlock).toHaveBeenCalledTimes(1);
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(0);
    });

    it('un plan ya terminado se adopta sin arrancar ningún bloque', async () => {
      component = await createComponent(mocks);

      component.ngOnInit();
      mocks.plan$.next(makePlan({ isFinished: true }));

      expect(component.plan.uid).toBe('plan-test');
      expect(component.currentIndexBlock).toBe(-1);
      expect(mocks.modalController.create).not.toHaveBeenCalled();
      expect(mocks.planFacade.updatePlan).not.toHaveBeenCalled();
    });

    it('si el store emite null sin plan ni carga en curso vuelve a inicio; mientras carga, espera', async () => {
      component = await createComponent(mocks);
      component.ngOnInit();

      mocks.loading$.next(true);
      mocks.plan$.next(null);
      expect(mocks.router.navigate).not.toHaveBeenCalled();

      mocks.loading$.next(false);
      mocks.plan$.next(null);
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('un null posterior a tener plan (limpieza del store) no navega a ningún sitio', async () => {
      component = await createComponent(mocks);
      component.ngOnInit();

      mocks.plan$.next(makePlan());
      mocks.plan$.next(null);

      expect(mocks.router.navigate).not.toHaveBeenCalled();
      expect(component.plan.uid).toBe('plan-test');
    });

    it('la presentación compone el título con el color del bloque, respeta título y descripción propios e ignora una descripción que solo repite el color', async () => {
      component = await createComponent(mocks);
      component.plan = makePlan({
        blocks: [
          makeBlock({ color: 'white', theme: 'fork' }),
          makeBlock({
            title: 'Mi bloque',
            description: 'Texto propio',
            theme: '',
            openingFamily: 'Sicilian',
          }),
          makeBlock({ color: 'black', theme: 'fork', description: 'PUZZLES.colors.black' }),
        ],
      });

      component.currentIndexBlock = 0;
      await component.showBlockPresentation();
      component.currentIndexBlock = 1;
      await component.showBlockPresentation();
      component.currentIndexBlock = 2;
      await component.showBlockPresentation();

      expect(mocks.modalController.create.mock.calls.map((c) => c[0].componentProps)).toEqual([
        {
          title: 'forkPUZZLES.withPUZZLES.colors.white',
          description: 'fork',
          image: '/assets/images/puzzle-themes/fork.svg',
        },
        {
          title: 'Mi bloque',
          description: 'Texto propio',
          image: '/assets/images/puzzle-themes/opening.svg',
        },
        {
          title: 'forkPUZZLES.withPUZZLES.colors.black',
          description: 'fork',
          image: '/assets/images/puzzle-themes/fork.svg',
        },
      ]);
    });
  });

  describe('flujo de bloques y contadores', () => {
    it('un bloque por cantidad (time -1) no muestra cronómetro y pasa al siguiente al jugar sus puzzles, reiniciando los contadores', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({ time: -1, puzzlesCount: 2, puzzles: [makePuzzle('a'), makePuzzle('b')] }),
          makeBlock({ time: 30, puzzlesCount: 0 }),
        ],
      });
      component = await createComponent(mocks);
      component.plan = plan;

      component.playNextBlock();
      await closeLastModal();

      expect(component.currentIndexBlock).toBe(0);
      expect(component.totalPuzzlesInBlock).toBe(2);
      expect(component.countPuzzlesPlayedBlock).toBe(0);
      expect(component.puzzleToPlay.uid).toBe('a');
      expect(component.showBlockTimer).toBe(false);
      expect(component.timeLeftBlock).toBe(0);
      expect(jest.getTimerCount()).toBe(0);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      expect(component.countPuzzlesPlayedBlock).toBe(1);
      expect(component.totalPuzzlesInBlock).toBe(2);
      expect(component.puzzleToPlay.uid).toBe('b');
      expect(component.currentIndexBlock).toBe(0);

      // Se completó la cuota: cambia de bloque y reinicia los contadores.
      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      expect(component.currentIndexBlock).toBe(1);
      expect(component.countPuzzlesPlayedBlock).toBe(0);
      expect(component.totalPuzzlesInBlock).toBe(0);
      expect(mocks.modalController.create).toHaveBeenCalledTimes(2);

      await closeLastModal();
      expect(component.showBlockTimer).toBe(true);
      expect(component.timeLeftBlock).toBe(30);
      expect(jest.getTimerCount()).toBe(1);
    });

    it('un bloque por tiempo (puzzlesCount 0) no cierra por cantidad: sirve puzzles hasta que vence el reloj y entonces abre el bloque siguiente', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({ time: 5, puzzlesCount: 0, puzzles: makePuzzles(4) }),
          makeBlock({ time: 30, puzzlesCount: 0 }),
        ],
      });
      component = await createComponent(mocks);
      component.plan = plan;

      component.playNextBlock();
      await closeLastModal();
      expect(component.timeLeftBlock).toBe(5);

      for (let i = 0; i < 3; i++) {
        component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      }
      expect(component.countPuzzlesPlayedBlock).toBe(3);
      expect(component.totalPuzzlesInBlock).toBe(0);
      expect(component.currentIndexBlock).toBe(0);
      expect(component.puzzleToPlay.uid).toBe('p4');

      // Vence el reloj: 5 s hasta 00:00 y un tic más para agotar el bloque.
      jest.advanceTimersByTime(6000);
      expect(component.currentIndexBlock).toBe(1);
      expect(component.countPuzzlesPlayedBlock).toBe(0);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(mocks.modalController.create).toHaveBeenCalledTimes(2);
      expect(mocks.soundsService.playLowTime).not.toHaveBeenCalled();

      await closeLastModal();
      expect(component.timeLeftBlock).toBe(30);
      expect(component.puzzleToPlay.uid).toBe('a');
    });

    it('al terminar el último bloque cierra la rutina: la marca terminada, la guarda con el usuario y su elo, reprograma el recordatorio y navega a plan-played', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600, elos: { plan5Total: 1700 } };
      const plan = makePlan({
        blocks: [
          makeBlock({ time: -1, puzzlesCount: 1, puzzles: [makePuzzle('a')] }),
          makeBlock({ time: -1, puzzlesCount: 1, puzzles: [makePuzzle('b')] }),
        ],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan, 1);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(mocks.planStorageService.savePlan).toHaveBeenCalledTimes(1);
      const saved = mocks.planStorageService.savePlan.mock.calls[0][0] as Plan;
      expect(saved.isFinished).toBe(true);
      expect(saved.uidUser).toBe('user-1');
      expect(saved.eloTotal).toBe(1700);
      expect(saved.blocks[1].puzzlesPlayed).toHaveLength(1);
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledWith(saved);
      expect(mocks.trainingReminderService.onSessionCompleted).toHaveBeenCalledWith(saved);
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);

      // plan-played lee el plan del store: aquí no se limpia.
      expect(mocks.planFacade.clearPlan).not.toHaveBeenCalled();
      expect(component.plan.isFinished).toBe(true);
      expect(component.currentIndexBlock).toBe(-1);
      expect(component.countPuzzlesPlayedBlock).toBe(0);
      expect(component.totalPuzzlesInBlock).toBe(0);
      expect(component.showBlockTimer).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(component.eloChanges).toEqual([]);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('sin sesión la rutina terminada se guarda sin usuario ni eloTotal', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan(), 2);

      component.endPlan();

      const saved = mocks.planStorageService.savePlan.mock.calls[0][0] as Plan;
      expect(saved.isFinished).toBe(true);
      expect(saved.uidUser).toBeUndefined();
      expect(saved.eloTotal).toBeUndefined();
      expect(mocks.plansElosService.incrementPlayCount).not.toHaveBeenCalled();
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);
    });

    it('cuando quedan menos de 10 puzzles en el bloque pide otra tanda y sustituye la lista (no la anexa)', async () => {
      mocks.blockService.getPuzzlesForBlock.mockResolvedValue(makePuzzles(3, 'n'));
      const plan = makePlan({
        blocks: [makeBlock({ time: -1, puzzles: [makePuzzle('a'), makePuzzle('b')] })],
      });
      component = await createComponent(mocks);
      component.plan = plan;
      component.currentIndexBlock = 0;

      component.selectPuzzleToPlay();

      expect(mocks.blockService.getPuzzlesForBlock).toHaveBeenCalledWith(plan.blocks[0]);
      // El puzzle que se juega sale de la lista anterior; la nueva llega después.
      expect(component.puzzleToPlay.uid).toBe('a');

      await flushMicrotasks();
      expect(component.plan.blocks[0].puzzles?.map((p) => p.uid)).toEqual(['n1', 'n2', 'n3']);
    });

    it('con 10 o más puzzles pendientes no pide más', async () => {
      const plan = makePlan({ blocks: [makeBlock({ time: -1, puzzles: makePuzzles(10) })] });
      component = await createComponent(mocks);
      component.plan = plan;
      component.currentIndexBlock = 0;

      component.selectPuzzleToPlay();

      expect(mocks.blockService.getPuzzlesForBlock).not.toHaveBeenCalled();
      expect(component.puzzleToPlay.uid).toBe('p1');
    });

    it('sin puzzle disponible avisa por consola y conserva el puzzle anterior', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const plan = makePlan({ blocks: [makeBlock({ time: -1, puzzles: [] })] });
      component = await createComponent(mocks);
      component.plan = plan;
      component.currentIndexBlock = 0;
      component.puzzleToPlay = makePuzzle('previo');

      component.selectPuzzleToPlay();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(component.puzzleToPlay.uid).toBe('previo');
      expect(mocks.analyticsService.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('cronómetro del bloque', () => {
    it('baja un segundo por tic, muestra 00:00 durante un tic y recién entonces vence el bloque sin sonido', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());
      const nextBlock = jest.spyOn(component, 'playNextBlock').mockImplementation(() => undefined);

      component.initTimeToEndBlock(3);
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(2);
      jest.advanceTimersByTime(2000);
      expect(component.timeLeftBlock).toBe(0);
      expect(nextBlock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(nextBlock).toHaveBeenCalledTimes(1);
      expect(component['blockTimeExpired']).toBe(true);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      expect(mocks.soundsService.playLowTime).not.toHaveBeenCalled();
      expect(mocks.soundsService.playError).not.toHaveBeenCalled();
    });

    it('pausar congela el tiempo restante y reanudar sigue desde ahí con un único contador', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());

      component.initTimeToEndBlock(10);
      jest.advanceTimersByTime(2000);
      expect(component.timeLeftBlock).toBe(8);

      component.pauseBlockTimer();
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(5000);
      expect(component.timeLeftBlock).toBe(8);

      component.resumeBlockTimer();
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(7);
    });

    it('playLowTime suena solo cuando el tablero agota el tiempo del puzzle; ese resultado se registra como fallo por tiempo y sigue sin tocar el reloj del bloque', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      mocks.uidGenerator.generateSimpleUid.mockReturnValue('uid-1');
      const plan = makePlan({
        blocks: [makeBlock({ showPuzzleSolution: false, puzzles: makePuzzles(3) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.initTimeToEndBlock(60);

      const puzzle = { ...component.puzzleToPlay, timeUsed: 20 };
      component.onPuzzleCompleted(puzzle, 'timeOut');

      expect(mocks.soundsService.playLowTime).toHaveBeenCalledTimes(1);
      expect(mocks.soundsService.playError).not.toHaveBeenCalled();
      expect(mocks.soundsService.playGood).not.toHaveBeenCalled();
      expect(component.plan.blocks[0].puzzlesPlayed[0]).toEqual(
        expect.objectContaining({
          uid: 'uid-1',
          uidPuzzle: 'p1',
          resolved: false,
          failByTime: true,
          resolvedTime: 20,
        })
      );
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith(
        'puzzle_completed',
        expect.objectContaining({ result: 'timeout', resolved_time: 20 })
      );

      // Sin solución configurada sigue con el siguiente puzzle y el bloque no se pausa.
      expect(mocks.modalController.create).not.toHaveBeenCalled();
      expect(component.puzzleToPlay.uid).toBe('p2');
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(59);
    });

    it('un fallo pausa el reloj del bloque mientras se ve la solución y lo reanuda al cerrarla con el tiempo que quedaba', async () => {
      const plan = makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) })] });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.initTimeToEndBlock(10);
      jest.advanceTimersByTime(2000);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(mocks.soundsService.playError).toHaveBeenCalledTimes(1);
      expect(component['isSolutionOpen']).toBe(true);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(mocks.modalController.create).toHaveBeenCalledWith({
        component: BoardPuzzleSolutionComponent,
        cssClass: 'puzzle-solution-modal',
        componentProps: { puzzle: plan.blocks[0].puzzles?.[0], themesTranslated: ['mateIn1'] },
      });

      await flushMicrotasks();
      jest.advanceTimersByTime(5000);
      expect(component.timeLeftBlock).toBe(8);
      expect(component.puzzleToPlay.uid).toBe('p1');

      await closeLastModal();

      expect(component['isSolutionOpen']).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(false);
      expect(component.puzzleToPlay.uid).toBe('p2');
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(7);
    });

    it('si el bloque vence mientras se ve la solución, al cerrarla cambia de bloque en vez de pedir otro puzzle o reanudar', async () => {
      const plan = makePlan({
        blocks: [makeBlock({ puzzles: makePuzzles(3) }), makeBlock({ puzzles: makePuzzles(3) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      const presentation = jest
        .spyOn(component, 'showBlockPresentation')
        .mockResolvedValue(undefined);
      component.initTimeToEndBlock(10);
      jest.advanceTimersByTime(2000);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await flushMicrotasks();
      expect(component['isSolutionOpen']).toBe(true);

      // El tiempo del bloque se agota con la solución en pantalla: el cambio
      // de bloque espera a que se cierre.
      component['onBlockTimeUp']();
      expect(component['blockTimeExpired']).toBe(true);
      expect(presentation).not.toHaveBeenCalled();

      await closeLastModal();

      // Al cerrar la solución se pasa de bloque, una sola vez, sin servir otro
      // puzzle del bloque vencido ni dejar un cronómetro vivo.
      expect(component['isSolutionOpen']).toBe(false);
      expect(presentation).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('la solución reproducida en el tablero (streamSolution) pausa el bloque y, al terminar, pide otro puzzle y reanuda', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({ showPuzzleSolution: false, streamSolution: true, puzzles: makePuzzles(3) }),
        ],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.initTimeToEndBlock(10);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(component.streamSolutionActive).toBe(true);
      expect(component['isSolutionOpen']).toBe(true);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(mocks.modalController.create).not.toHaveBeenCalled();
      jest.advanceTimersByTime(5000);
      expect(component.timeLeftBlock).toBe(10);

      component.onStreamSolutionFinished();

      expect(component.streamSolutionActive).toBe(false);
      expect(component['isSolutionOpen']).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(false);
      expect(component.puzzleToPlay.uid).toBe('p2');
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(9);
    });

    it('si el bloque vence durante la reproducción de la solución, al terminar cambia de bloque en vez de reanudar', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({ showPuzzleSolution: false, streamSolution: true, puzzles: makePuzzles(3) }),
          makeBlock(),
        ],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      const presentation = jest
        .spyOn(component, 'showBlockPresentation')
        .mockResolvedValue(undefined);
      component.initTimeToEndBlock(10);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      component['onBlockTimeUp']();
      expect(presentation).not.toHaveBeenCalled();

      component.onStreamSolutionFinished();

      expect(presentation).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('caso límite actual: si la solución se abre con el reloj en 0, al cerrarla el bloque queda sin cronómetro', async () => {
      // Comportamiento preexistente, no necesariamente deseado: el tic que
      // agota el bloque nunca llega porque la solución lo pausó en 0, y
      // resumeBlockTimer rehúsa arrancar sin tiempo. Si un refactor lo cambia,
      // debe documentarlo.
      const plan = makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) }), makeBlock()] });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      const nextBlock = jest.spyOn(component, 'playNextBlock');
      component.initTimeToEndBlock(1);
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(0);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await closeLastModal();

      expect(nextBlock).not.toHaveBeenCalled();
      expect(component.currentIndexBlock).toBe(0);
      expect(component.puzzleToPlay.uid).toBe('p2');
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(60000);
      expect(nextBlock).not.toHaveBeenCalled();
    });
  });

  describe('resultado del puzzle', () => {
    it('un acierto suena playGood, se registra como resuelto con los datos del perfil, actualiza el elo y sigue con el siguiente puzzle sin pausar el bloque', async () => {
      const profile: FakeProfile = { uid: 'user-1', elo: 1600 };
      mocks.profile = profile;
      mocks.uidGenerator.generateSimpleUid.mockReturnValue('uid-1');
      mocks.profileService.calculateEloPuzzlePlan.mockReturnValue({ totalEloChange: 8 });
      jest.setSystemTime(new Date('2026-03-01T10:00:00Z'));
      const plan = makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) })] });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.initTimeToEndBlock(60);

      const puzzle = { ...component.puzzleToPlay, timeUsed: 7 };
      component.onPuzzleCompleted(puzzle, 'good');

      expect(mocks.soundsService.playGood).toHaveBeenCalledTimes(1);
      expect(mocks.soundsService.playError).not.toHaveBeenCalled();
      expect(component.plan.blocks[0].puzzlesPlayed).toEqual([
        expect.objectContaining({
          uid: 'uid-1',
          uidUser: 'user-1',
          uidPuzzle: 'p1',
          date: new Date('2026-03-01T10:00:00Z').getTime(),
          resolved: true,
          failByTime: false,
          resolvedTime: 7,
          currentEloUser: 1600,
          eloPuzzle: 1500,
          themes: ['mateIn1'],
          rawPuzzle: puzzle,
        }),
      ]);
      expect(mocks.profileService.calculateEloPuzzlePlan).toHaveBeenCalledWith(
        1500,
        1,
        'plan5',
        ['mateIn1'],
        ''
      );
      expect(component.eloChanges).toEqual([8]);
      expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith('puzzle_completed', {
        result: 'good',
        puzzle_elo: 1500,
        user_elo: 1600,
        resolved_time: 7,
        first_theme: 'mateIn1',
        routine_kind: 'default',
        routine_minutes: 5,
      });

      // El plan no se persiste puzzle a puzzle: solo al cerrar la rutina.
      expect(mocks.planFacade.updatePlan).not.toHaveBeenCalled();
      expect(mocks.planStorageService.savePlan).not.toHaveBeenCalled();
      expect(mocks.modalController.create).not.toHaveBeenCalled();

      expect(component.countPuzzlesPlayedBlock).toBe(1);
      expect(component.puzzleToPlay.uid).toBe('p2');
      expect(component.forceStopTimerInPuzzleBoard).toBe(false);
      jest.advanceTimersByTime(1000);
      expect(component.timeLeftBlock).toBe(59);
    });

    it('un fallo suena playError, se registra como no resuelto y resta elo', async () => {
      mocks.profileService.calculateEloPuzzlePlan.mockReturnValue({ totalEloChange: -6 });
      const plan = makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) })] });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(mocks.soundsService.playError).toHaveBeenCalledTimes(1);
      expect(mocks.soundsService.playGood).not.toHaveBeenCalled();
      expect(component.plan.blocks[0].puzzlesPlayed[0]).toEqual(
        expect.objectContaining({ uidPuzzle: 'p1', resolved: false, failByTime: false, uidUser: '' })
      );
      expect(mocks.profileService.calculateEloPuzzlePlan).toHaveBeenCalledWith(
        1500,
        0,
        'plan5',
        ['mateIn1'],
        ''
      );
      expect(component.eloChanges).toEqual([-6]);
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith(
        'puzzle_completed',
        expect.objectContaining({ result: 'bad', user_elo: 0 })
      );
    });

    it('las píldoras de elo conservan solo los 12 cambios más recientes', async () => {
      let change = 0;
      mocks.profileService.calculateEloPuzzlePlan.mockImplementation(() => ({
        totalEloChange: ++change,
      }));
      const plan = makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(15) })] });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      for (let i = 0; i < 14; i++) {
        component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      }

      expect(component.eloChanges).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    });
  });

  describe('orden de efectos', () => {
    it('acierto: id del registro → analítica (con el plan y el elo todavía sin tocar) → elo → sonido → siguiente puzzle', async () => {
      const calls: string[] = [];
      const profile: FakeProfile = { uid: 'user-1', elo: 1600 };
      mocks.profile = profile;
      mocks.uidGenerator.generateSimpleUid.mockImplementation(() => {
        calls.push('generateSimpleUid');
        return 'uid-1';
      });
      mocks.analyticsService.logEvent.mockImplementation(async (name: string) => {
        calls.push(`analytics:${name}(played=${component.plan.blocks[0].puzzlesPlayed.length})`);
      });
      mocks.profileService.calculateEloPuzzlePlan.mockImplementation(() => {
        calls.push(`calculateEloPuzzlePlan(played=${component.plan.blocks[0].puzzlesPlayed.length})`);
        // El recálculo mueve el elo del perfil: la analítica ya reportó el anterior.
        profile.elo = 1612;
        return { totalEloChange: 12 };
      });
      mocks.soundsService.playGood.mockImplementation(() => {
        calls.push(`playGood(eloChanges=${component.eloChanges.join(',')})`);
      });
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) })] }));
      jest.spyOn(component, 'selectPuzzleToPlay').mockImplementation(async () => {
        calls.push(`selectPuzzleToPlay(count=${component.countPuzzlesPlayedBlock})`);
      });

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(calls).toEqual([
        'generateSimpleUid',
        'analytics:puzzle_completed(played=0)',
        'calculateEloPuzzlePlan(played=1)',
        'playGood(eloChanges=12)',
        'selectPuzzleToPlay(count=1)',
      ]);
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith(
        'puzzle_completed',
        expect.objectContaining({ user_elo: 1600 })
      );
    });

    it('fallo con solución: id → analítica → elo → playError → pausa del reloj → modal de solución', async () => {
      const calls: string[] = [];
      mocks.uidGenerator.generateSimpleUid.mockImplementation(() => {
        calls.push('generateSimpleUid');
        return 'uid-1';
      });
      mocks.analyticsService.logEvent.mockImplementation(async (name: string) => {
        calls.push(`analytics:${name}`);
      });
      mocks.profileService.calculateEloPuzzlePlan.mockImplementation(() => {
        calls.push('calculateEloPuzzlePlan');
        return { totalEloChange: -5 };
      });
      mocks.soundsService.playError.mockImplementation(() => calls.push('playError'));
      mocks.modalController.create.mockImplementation(async () => {
        calls.push('modalController.create');
        const fake = makeFakeModal();
        modals.push(fake);
        return fake.modal;
      });
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(3) })] }));
      component.initTimeToEndBlock(30);
      const pause = component.pauseBlockTimer.bind(component);
      jest.spyOn(component, 'pauseBlockTimer').mockImplementation(() => {
        calls.push('pauseBlockTimer');
        pause();
      });

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(calls).toEqual([
        'generateSimpleUid',
        'analytics:puzzle_completed',
        'calculateEloPuzzlePlan',
        'playError',
        'pauseBlockTimer',
        'modalController.create',
      ]);
    });

    it('continueAfterPuzzle pide otro puzzle, salvo que el reloj del bloque ya haya vencido: entonces pide el bloque siguiente', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());
      const nextBlock = jest.spyOn(component, 'playNextBlock').mockImplementation(() => undefined);
      const nextPuzzle = jest.spyOn(component, 'selectPuzzleToPlay').mockResolvedValue(undefined);

      component['continueAfterPuzzle']();
      expect(nextPuzzle).toHaveBeenCalledTimes(1);
      expect(nextBlock).not.toHaveBeenCalled();

      component['blockTimeExpired'] = true;
      component['continueAfterPuzzle']();
      expect(nextBlock).toHaveBeenCalledTimes(1);
      expect(nextPuzzle).toHaveBeenCalledTimes(1);
    });

    it('cambio de bloque: apaga el reloj, avanza el índice, reinicia contadores y solo entonces abre la presentación', async () => {
      const calls: string[] = [];
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());
      component.countPuzzlesPlayedBlock = 3;
      component.initTimeToEndBlock(10);
      const stop = component.stopBlockTimer.bind(component);
      jest.spyOn(component, 'stopBlockTimer').mockImplementation(() => {
        calls.push('stopBlockTimer');
        stop();
      });
      jest.spyOn(component, 'showBlockPresentation').mockImplementation(async () => {
        calls.push(
          `showBlockPresentation(index=${component.currentIndexBlock}, count=${component.countPuzzlesPlayedBlock}, timer=${component.showBlockTimer})`
        );
      });

      component.playNextBlock();

      expect(calls).toEqual([
        'stopBlockTimer',
        'showBlockPresentation(index=1, count=0, timer=false)',
      ]);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('rutina personalizada', () => {
    it('con sesión, el elo de cada puzzle lo calcula PlansElosService y no alimenta las píldoras del perfil', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const plan = makePlan({
        planType: 'custom',
        uidCustomPlan: 'cp-1',
        blocks: [makeBlock({ puzzles: makePuzzles(3) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(mocks.plansElosService.calculatePlanElos).toHaveBeenCalledWith(
        1500,
        1,
        'cp-1',
        'user-1',
        ['mateIn1'],
        ''
      );
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(component.eloChanges).toEqual([]);
      expect(mocks.soundsService.playGood).toHaveBeenCalledTimes(1);
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith(
        'puzzle_completed',
        expect.objectContaining({ routine_kind: 'custom', routine_minutes: 0 })
      );
    });

    it('sin sesión no calcula elo en ningún sitio', async () => {
      const plan = makePlan({
        planType: 'custom',
        uidCustomPlan: 'cp-1',
        blocks: [makeBlock({ puzzles: makePuzzles(3) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(component.plan.blocks[0].puzzlesPlayed).toHaveLength(1);
    });

    it('al terminar incrementa sus veces jugada y no copia eloTotal del perfil', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600, elos: { plan5Total: 1700 } };
      const plan = makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' });
      component = await createComponent(mocks);
      mountAtBlock(component, plan, 2);

      component.endPlan();

      expect(mocks.plansElosService.incrementPlayCount).toHaveBeenCalledWith('cp-1', 'user-1');
      const saved = mocks.planStorageService.savePlan.mock.calls[0][0] as Plan;
      expect(saved.uidUser).toBe('user-1');
      expect(saved.eloTotal).toBeUndefined();
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);
    });
  });

  describe('Reto 333', () => {
    function makeReto333Plan(block: Partial<Block> = {}): Plan {
      return makePlan({
        uid: 'reto-1',
        planType: 'reto333',
        blocks: [makeBlock({ time: -1, puzzlesCount: 0, puzzles: makePuzzles(5), ...block })],
      });
    }

    it('cada acierto sube la rampa 10 puntos, la aplica al bloque y pide los siguientes puzzles a ese elo', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makeReto333Plan());

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(component.reto333EloLocal).toBe(410);
      expect(component.plan.blocks[0].elo).toBe(410);
      expect(mocks.blockService.getPuzzlesForBlock).toHaveBeenCalledWith(
        expect.objectContaining({ elo: 410 })
      );
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      expect(component.eloChanges).toEqual([]);
      expect(mocks.soundsService.playGood).toHaveBeenCalledTimes(1);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      expect(component.reto333EloLocal).toBe(420);
    });

    it('un fallo muestra la solución y, al cerrarla, termina el reto: guarda el plan, la marca y el resumen, y abre el modal final sin navegar', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      mocks.reto333Storage.saveAttempt.mockReturnValue({ bestScore: 5 });
      jest.setSystemTime(new Date('2026-03-01T10:00:00Z'));
      component = await createComponent(mocks);
      mountAtBlock(component, makeReto333Plan());
      component.reto333StartTime = Date.now();
      jest.advanceTimersByTime(125_000);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(mocks.soundsService.playError).toHaveBeenCalledTimes(1);
      expect(mocks.modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({ component: BoardPuzzleSolutionComponent })
      );
      expect(component.showReto333DaisyModal).toBe(false);

      await closeLastModal();

      expect(component.plan.isFinished).toBe(true);
      expect(component.plan.uidUser).toBe('user-1');
      expect(mocks.planFacade.updatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'reto-1', isFinished: true })
      );
      expect(mocks.planStorageService.savePlan).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'reto-1', isFinished: true })
      );
      expect(mocks.trainingReminderService.onSessionCompleted).toHaveBeenCalledTimes(1);
      expect(mocks.reto333Storage.saveAttempt).toHaveBeenCalledWith(
        { score: 2, timeSeconds: 125, timeString: '2m 5s', completed: false, maxElo: 420 },
        'user-1'
      );
      expect(mocks.userRecordsService.push).toHaveBeenCalledTimes(1);
      expect(component.reto333AlertData).toEqual({
        solvedCount: 2,
        timeString: '2m 5s',
        elo: 420,
        completed: false,
      });
      expect(component.showReto333DaisyModal).toBe(true);
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith('reto333_finished', {
        solved_count: 2,
        time_seconds: 125,
        elo: 420,
        completed: false,
        best_score: 5,
      });

      // No pasa por endPlan: ni navega ni limpia el store ni la posición.
      expect(mocks.router.navigate).not.toHaveBeenCalled();
      expect(mocks.planFacade.clearPlan).not.toHaveBeenCalled();
      expect(component.currentIndexBlock).toBe(0);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
    });

    it('un fallo sin solución configurada termina el reto de inmediato', async () => {
      mocks.reto333Storage.saveAttempt.mockReturnValue({ bestScore: 0 });
      component = await createComponent(mocks);
      mountAtBlock(component, makeReto333Plan({ showPuzzleSolution: false }));

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(mocks.modalController.create).not.toHaveBeenCalled();
      expect(component.showReto333DaisyModal).toBe(true);
      expect(component.plan.isFinished).toBe(true);
      expect(mocks.reto333Storage.saveAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0, maxElo: 400 }),
        undefined
      );
    });

    it('cerrar el modal final limpia la sesión, vacía el store y vuelve a inicio', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makeReto333Plan());
      component.reto333EloLocal = 450;
      component.reto333StartTime = 123;
      component.showReto333DaisyModal = true;
      component.reto333AlertData = { solvedCount: 5 };

      component.closeReto333Modal();

      expect(component.showReto333DaisyModal).toBe(false);
      expect(component.reto333AlertData).toBeNull();
      expect(component.reto333EloLocal).toBe(400);
      expect(component.reto333StartTime).toBeNull();
      expect(component.currentIndexBlock).toBe(-1);
      expect(mocks.planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('reiniciar limpia la sesión y crea un plan nuevo; el plan que llega por el store arranca otra vez desde el bloque 0', async () => {
      const newBlock = makeBlock({ time: -1, puzzlesCount: 0, puzzles: [] });
      mocks.blockService.generateBlocksForPlan.mockResolvedValue([newBlock]);
      mocks.blockService.getPuzzlesForBlock.mockResolvedValue(makePuzzles(2));
      const loader = {
        present: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
      };
      mocks.loadingController.create.mockResolvedValue(loader);
      mocks.planService.newPlan.mockResolvedValue(undefined);
      component = await createComponent(mocks);
      component.ngOnInit();

      mocks.plan$.next(makeReto333Plan());
      expect(component.currentIndexBlock).toBe(0);
      expect(component.reto333StartTime).not.toBeNull();
      await closeLastModal();
      component.reto333EloLocal = 450;

      await component.restartReto333();

      expect(mocks.planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(component.reto333EloLocal).toBe(400);
      expect(component.reto333StartTime).toBeNull();
      expect(component.currentIndexBlock).toBe(-1);
      expect(mocks.loadingController.create).toHaveBeenCalledWith({ message: 'RETO_333.loading' });
      expect(loader.present).toHaveBeenCalledTimes(1);
      expect(mocks.blockService.generateBlocksForPlan).toHaveBeenCalledWith('reto333');
      expect(mocks.planService.newPlan).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            puzzles: [expect.objectContaining({ uid: 'p1' }), expect.objectContaining({ uid: 'p2' })],
          }),
        ],
        'reto333'
      );
      expect(loader.dismiss).toHaveBeenCalledTimes(1);

      // El store se vacía y después llega el plan nuevo: lo arranca la misma
      // suscripción de ngOnInit, que sobrevive a la limpieza.
      mocks.plan$.next(null);
      expect(mocks.router.navigate).not.toHaveBeenCalled();
      mocks.plan$.next(makePlan({ uid: 'reto-2', planType: 'reto333', blocks: [newBlock] }));
      expect(component.currentIndexBlock).toBe(0);
      expect(component.reto333StartTime).not.toBeNull();
      expect(mocks.modalController.create).toHaveBeenCalledTimes(2);
    });

    it('si reiniciar falla, cierra el loader y vuelve a inicio', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.blockService.generateBlocksForPlan.mockRejectedValue(new Error('sin red'));
      const loader = {
        present: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
      };
      mocks.loadingController.create.mockResolvedValue(loader);
      component = await createComponent(mocks);
      mountAtBlock(component, makeReto333Plan());

      await component.restartReto333();

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(mocks.planService.newPlan).not.toHaveBeenCalled();
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('rutina infinita', () => {
    it('no abre presentación ni cronómetro y pide los puzzles de uno en uno al pool', async () => {
      mocks.infinityPoolService.getNextPuzzle
        .mockResolvedValueOnce(makePuzzle('i1', { themes: ['fork'] }))
        .mockResolvedValueOnce(makePuzzle('i2', { themes: ['pin'] }));
      const plan = makePlan({
        planType: 'infinity',
        blocks: [makeBlock({ time: -1, puzzlesCount: 0, theme: '', puzzles: [] })],
      });
      component = await createComponent(mocks);
      component.plan = plan;

      component.playNextBlock();

      expect(component.currentIndexBlock).toBe(0);
      expect(mocks.modalController.create).not.toHaveBeenCalled();
      expect(component['isProcessingBlock']).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(false);
      expect(component.showBlockTimer).toBe(false);

      await flushMicrotasks();

      expect(component.puzzleToPlay.uid).toBe('i1');
      expect(jest.getTimerCount()).toBe(0);
      expect(mocks.blockService.getPuzzlesForBlock).not.toHaveBeenCalled();
      // Sin tema de bloque se reporta el del puzzle servido.
      expect(mocks.analyticsService.logEvent).toHaveBeenCalledWith('puzzle_started', {
        routine_kind: 'infinity',
        routine_minutes: 0,
        theme: 'fork',
        puzzle_elo: 1500,
      });

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      await flushMicrotasks();

      expect(mocks.profileService.calculateEloPuzzlePlan).toHaveBeenCalledWith(
        1500,
        1,
        'infinity',
        ['fork'],
        ''
      );
      expect(mocks.infinityPoolService.getNextPuzzle).toHaveBeenCalledTimes(2);
      expect(component.puzzleToPlay.uid).toBe('i2');
      expect(component.countPuzzlesPlayedBlock).toBe(1);
      expect(component.currentIndexBlock).toBe(0);
    });
  });

  describe('salida anticipada y ciclo de vida', () => {
    it('ngOnDestroy apaga el cronómetro, vacía el store y no deja ningún timer vivo', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());
      component.initTimeToEndBlock(10);
      expect(jest.getTimerCount()).toBe(1);
      const nextBlock = jest.spyOn(component, 'playNextBlock');

      component.ngOnDestroy();

      expect(jest.getTimerCount()).toBe(0);
      expect(mocks.planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(-1);
      expect(component.timeLeftBlock).toBe(0);
      expect(component.showBlockTimer).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(component.eloChanges).toEqual([]);

      jest.advanceTimersByTime(20000);
      expect(nextBlock).not.toHaveBeenCalled();
      expect(mocks.router.navigate).not.toHaveBeenCalled();
    });

    it('ngOnDestroy corta la suscripción al store: un plan posterior ya no arranca nada', async () => {
      component = await createComponent(mocks);
      const nextBlock = jest.spyOn(component, 'playNextBlock');
      component.ngOnInit();
      mocks.plan$.next(makePlan());
      expect(nextBlock).toHaveBeenCalledTimes(1);

      component.ngOnDestroy();
      mocks.plan$.next(makePlan({ uid: 'plan-2' }));

      expect(nextBlock).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(-1);
    });

    it('onExitTraining pide confirmación; mientras no se confirma el reloj sigue, y al confirmar limpia la sesión y vuelve a la pantalla de origen', async () => {
      const alert = { present: jest.fn().mockResolvedValue(undefined) };
      mocks.alertController.create.mockResolvedValue(alert);
      component = await createComponent(mocks, '/puzzles/custom-plans');
      mountAtBlock(component, makePlan());
      component.initTimeToEndBlock(10);

      await component.onExitTraining();

      expect(alert.present).toHaveBeenCalledTimes(1);
      const config = mocks.alertController.create.mock.calls[0][0];
      expect(config.header).toBe('PUZZLES.exitTraining.title');
      expect(config.message).toBe('PUZZLES.exitTraining.message');
      expect(config.buttons.map((b: { role: string }) => b.role)).toEqual(['cancel', 'confirm']);
      expect(jest.getTimerCount()).toBe(1);
      expect(mocks.planFacade.clearPlan).not.toHaveBeenCalled();

      config.buttons[1].handler();

      expect(jest.getTimerCount()).toBe(0);
      expect(mocks.planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(component.currentIndexBlock).toBe(-1);
      expect(mocks.router.navigateByUrl).toHaveBeenCalledWith('/puzzles/custom-plans');
      expect(mocks.router.navigate).not.toHaveBeenCalled();
    });

    it('sin returnTo, confirmar la salida vuelve a inicio', async () => {
      mocks.alertController.create.mockResolvedValue({
        present: jest.fn().mockResolvedValue(undefined),
      });
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());

      await component.onExitTraining();
      mocks.alertController.create.mock.calls[0][0].buttons[1].handler();

      expect(mocks.router.navigateByUrl).toHaveBeenCalledWith('/home');
    });

    it('ionViewWillLeave apaga el cronómetro pero conserva el plan, la posición y el tiempo restante', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan());
      component.isDropdownOpen = true;
      component.initTimeToEndBlock(10);
      jest.advanceTimersByTime(2000);

      component.ionViewWillLeave();

      expect(jest.getTimerCount()).toBe(0);
      expect(component.timeLeftBlock).toBe(8);
      expect(component.currentIndexBlock).toBe(0);
      expect(component.plan.uid).toBe('plan-test');
      expect(mocks.planFacade.clearPlan).not.toHaveBeenCalled();
      expect(component.showBlockTimer).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(component.isDropdownOpen).toBe(false);
    });

    it('closeDropdown cierra el desplegable 200 ms después', async () => {
      component = await createComponent(mocks);
      component.isDropdownOpen = true;

      component.closeDropdown();

      jest.advanceTimersByTime(199);
      expect(component.isDropdownOpen).toBe(true);
      jest.advanceTimersByTime(1);
      expect(component.isDropdownOpen).toBe(false);
    });

    it('closeDropdown no deja un timeout vivo si la pantalla se destruye antes de los 200 ms', async () => {
      component = await createComponent(mocks);
      component.isDropdownOpen = true;

      component.closeDropdown();
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      component.ngOnDestroy();

      // La destrucción cancela el cierre diferido: no queda ningún timer
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('getters de presentación', () => {
    it('playerColor respeta el color fijo del bloque y, si es aleatorio, lo deriva del FEN; canTrackElo y userElo dependen del perfil', async () => {
      component = await createComponent(mocks);
      mountAtBlock(
        component,
        makePlan({ blocks: [makeBlock({ color: 'black' }), makeBlock({ color: 'random' })] })
      );

      expect(component.playerColor).toBe('black');

      component.currentIndexBlock = 1;
      component.puzzleToPlay = makePuzzle('f', {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });
      // El FEN tiene blancas en turno (la jugada que reproduce la máquina), así
      // que el usuario juega con negras.
      expect(component.playerColor).toBe('black');

      expect(component.canTrackElo).toBe(false);
      mocks.profile = { uid: 'user-1', elo: 1600 };
      expect(component.canTrackElo).toBe(true);

      mocks.profileService.getEloTotalByPlanType.mockReturnValue(1720);
      expect(component.userElo).toBe(1720);
      expect(mocks.profileService.getEloTotalByPlanType).toHaveBeenCalledWith('plan5');
    });
  });
});
