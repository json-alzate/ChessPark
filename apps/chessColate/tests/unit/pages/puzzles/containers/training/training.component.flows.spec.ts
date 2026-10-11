// Ver el comentario equivalente en training.component.spec.ts: la librería del
// tablero arrastra cm-chessboard, que Jest no sabe cargar.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class {},
}));

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import { AlertController, LoadingController, ModalController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { Plan, Puzzle } from '@chesspark/models';
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
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { Reto333StorageService } from '@services/training/reto333-storage.service';
import { UserRecordsService } from '@services/progress/user-records.service';

import { TrainingComponent } from '@app/pages/puzzles/containers/training/training.component';

import {
  flushMicrotasks,
  makeBlock,
  makePlan,
  makePuzzle,
  makePuzzles,
} from '@tests/support/puzzles-pages';

/**
 * Decisiones de `onPuzzleCompleted` y de cierre de rutina que
 * `training.component.spec.ts` no recorre: actualización de elos según el tipo de
 * rutina, qué pasa tras fallar según las opciones del bloque, resultados tardíos
 * durante un cambio de bloque y el cierre (`endPlan`).
 *
 * Mismo método que el otro spec: sin plantilla ni DOM, reloj con fake timers,
 * modales de Ionic sustituidos por un objeto cuyo cierre dispara la prueba.
 */

interface FakeProfile {
  uid: string;
  elo: number;
  elos?: Record<string, number>;
}

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

function makeMocks() {
  const state: { profile: FakeProfile | null } = { profile: null };
  const plan$ = new Subject<Plan | null>();
  const loading$ = new BehaviorSubject<boolean>(false);
  const mocks = {
    get profile(): FakeProfile | null {
      return state.profile;
    },
    set profile(value: FakeProfile | null) {
      state.profile = value;
    },
    plan$,
    loading$,
    modalController: { create: jest.fn() },
    alertController: { create: jest.fn() },
    loadingController: { create: jest.fn() },
    router: { navigate: jest.fn(), navigateByUrl: jest.fn() },
    planFacade: {
      getPlan$: jest.fn(() => plan$),
      getLoadingPlan$: jest.fn(() => loading$),
      updatePlan: jest.fn(),
      clearPlan: jest.fn(),
    },
    profileService: {
      get getProfile(): FakeProfile | null {
        return state.profile;
      },
      getEloTotalByPlanType: jest.fn().mockReturnValue(1500),
      calculateEloPuzzlePlan: jest.fn().mockReturnValue({ totalEloChange: 0 }),
    },
    blockService: {
      getPuzzlesForBlock: jest.fn().mockResolvedValue([]),
      generateBlocksForPlan: jest.fn(),
    },
    appService: {
      getThemesPuzzlesList: [] as unknown[],
      getNameThemePuzzleByValue: (v: string) => v,
      getDescriptionThemePuzzleByValue: (v: string) => v,
      getNameOpeningByValue: (v: string) => v,
      getDescriptionOpeningByValue: (v: string) => v,
    },
    translocoService: { translate: jest.fn((k: string) => k) },
    soundsService: { playGood: jest.fn(), playError: jest.fn(), playLowTime: jest.fn() },
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
type Mocks = ReturnType<typeof makeMocks>;

async function createComponent(mocks: Mocks): Promise<TrainingComponent> {
  await TestBed.configureTestingModule({
    imports: [TrainingComponent],
    providers: [
      { provide: ModalController, useValue: mocks.modalController },
      { provide: AlertController, useValue: mocks.alertController },
      { provide: LoadingController, useValue: mocks.loadingController },
      { provide: Router, useValue: mocks.router },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
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
    .overrideComponent(TrainingComponent, { set: { template: '', imports: [], schemas: [] } })
    .compileComponents();

  const component = TestBed.createComponent(TrainingComponent).componentInstance;
  // Consume el setTimeout(0) del planificador de Angular para que getTimerCount
  // cuente solo los cronómetros del componente.
  jest.advanceTimersByTime(0);
  return component;
}

/** Deja el componente como tras cerrar la presentación del bloque `index`. */
function mountAtBlock(component: TrainingComponent, plan: Plan, index = 0): void {
  const block = plan.blocks[index];
  component.plan = plan;
  component.currentIndexBlock = index;
  component.totalPuzzlesInBlock = block.puzzlesCount;
  component.countPuzzlesPlayedBlock = 0;
  component.puzzleToPlay = (block.puzzles ?? [])[0];
}

describe('TrainingComponent · decisiones de onPuzzleCompleted y cierre', () => {
  let component: TrainingComponent;
  let mocks: Mocks;
  let modals: FakeModal[];

  async function closeLastModal(): Promise<void> {
    await flushMicrotasks();
    const last = modals[modals.length - 1];
    if (!last) throw new Error('No hay ningún modal abierto que cerrar');
    last.dismiss();
    await flushMicrotasks();
  }

  const solutionModals = () =>
    mocks.modalController.create.mock.calls.filter(
      (c: { component: unknown }[]) => c[0].component === BoardPuzzleSolutionComponent
    );

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

  describe('elos según el tipo de rutina', () => {
    const rated = (overrides: Partial<Puzzle> = {}) =>
      makePuzzle('p1', { rating: 1830, themes: ['fork', 'pin'], openingFamily: 'Sicilian', ...overrides });

    it.each(['warmup', 'plan1', 'plan5', 'plan30', 'backToCalm', 'infinity'] as const)(
      'una rutina %s calcula el elo en el perfil con el rating, los temas y la apertura del puzzle',
      async (planType) => {
        const puzzle = rated();
        const plan = makePlan({
          planType,
          blocks: [makeBlock({ puzzles: [puzzle, ...makePuzzles(11, 'q')] })],
        });
        component = await createComponent(mocks);
        mountAtBlock(component, plan);

        component.onPuzzleCompleted(puzzle, 'good');

        expect(mocks.profileService.calculateEloPuzzlePlan).toHaveBeenCalledWith(
          1830,
          1,
          planType,
          ['fork', 'pin'],
          'Sicilian'
        );
        expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      }
    );

    it('fallar o agotar el tiempo del ejercicio cuenta como 0 y acumula los cambios en orden', async () => {
      const results = [8, -6, -9];
      mocks.profileService.calculateEloPuzzlePlan.mockImplementation(() => ({
        totalEloChange: results.shift(),
      }));
      const plan = makePlan({
        blocks: [makeBlock({ showPuzzleSolution: false, puzzles: makePuzzles(12) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      component.onPuzzleCompleted(component.puzzleToPlay, 'timeOut');

      const scores = mocks.profileService.calculateEloPuzzlePlan.mock.calls.map((c: unknown[]) => c[1]);
      expect(scores).toEqual([1, 0, 0]);
      expect(component.eloChanges).toEqual([8, -6, -9]);
    });

    it('una rutina personalizada con sesión calcula el elo por rutina (no en el perfil); fallar y agotar el tiempo cuentan como 0', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const puzzle = rated();
      const plan = makePlan({
        planType: 'custom',
        uidCustomPlan: 'cp-1',
        blocks: [makeBlock({ showPuzzleSolution: false, puzzles: [puzzle, ...makePuzzles(11, 'q')] })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(puzzle, 'bad');
      component.onPuzzleCompleted(puzzle, 'timeOut');

      expect(mocks.plansElosService.calculatePlanElos).toHaveBeenNthCalledWith(
        1,
        1830,
        0,
        'cp-1',
        'user-1',
        ['fork', 'pin'],
        'Sicilian'
      );
      expect(mocks.plansElosService.calculatePlanElos).toHaveBeenNthCalledWith(
        2,
        1830,
        0,
        'cp-1',
        'user-1',
        ['fork', 'pin'],
        'Sicilian'
      );
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(component.eloChanges).toEqual([]);
    });

    it('una rutina personalizada sin uidCustomPlan no calcula elo en ningún sitio, ni con sesión', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const plan = makePlan({
        planType: 'custom',
        uidCustomPlan: undefined,
        blocks: [makeBlock({ puzzles: makePuzzles(12) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
    });

    it('el Reto 333 no toca ni el elo del perfil ni el de la rutina: solo sube su rampa local, 10 por acierto', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const plan = makePlan({
        planType: 'reto333',
        blocks: [makeBlock({ time: -1, elo: 0, showPuzzleSolution: false, puzzles: makePuzzles(12) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      const afterFirst = component.plan.blocks[0].elo;
      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      const afterSecond = component.plan.blocks[0].elo;

      expect(afterFirst).toBe(410);
      expect(afterSecond - afterFirst).toBe(10);
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
      expect(component.eloChanges).toEqual([]);
    });
  });

  describe('qué pasa tras un ejercicio no resuelto', () => {
    function planWith(block: Partial<Plan['blocks'][number]>): Plan {
      return makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(12), ...block }), makeBlock()] });
    }

    it.each([
      ['bad', true, false],
      ['timeOut', true, false],
      ['bad', true, true],
      ['timeOut', true, true],
    ] as const)(
      'resultado %s con mostrar solución=%s y reproducir=%s: abre el modal de solución y no reproduce en el tablero',
      async (result, showPuzzleSolution, streamSolution) => {
        const plan = planWith({ showPuzzleSolution, streamSolution });
        component = await createComponent(mocks);
        mountAtBlock(component, plan);

        component.onPuzzleCompleted(component.puzzleToPlay, result);
        await flushMicrotasks();

        expect(solutionModals()).toHaveLength(1);
        expect(component.streamSolutionActive).toBe(false);
        expect(component['isSolutionOpen']).toBe(true);
        expect(component.puzzleToPlay.uid).toBe('p1');
      }
    );

    it.each(['bad', 'timeOut'] as const)(
      'resultado %s sin mostrar solución pero con reproducción: la reproduce en el tablero y no abre modal',
      async (result) => {
        const plan = planWith({ showPuzzleSolution: false, streamSolution: true });
        component = await createComponent(mocks);
        mountAtBlock(component, plan);

        component.onPuzzleCompleted(component.puzzleToPlay, result);
        await flushMicrotasks();

        expect(component.streamSolutionActive).toBe(true);
        expect(component.forceStopTimerInPuzzleBoard).toBe(true);
        expect(mocks.modalController.create).not.toHaveBeenCalled();
        expect(component.puzzleToPlay.uid).toBe('p1');
      }
    );

    it.each(['bad', 'timeOut'] as const)(
      'resultado %s sin solución de ningún tipo: sigue al instante con el siguiente ejercicio',
      async (result) => {
        const plan = planWith({ showPuzzleSolution: false, streamSolution: false });
        component = await createComponent(mocks);
        mountAtBlock(component, plan);
        component.initTimeToEndBlock(30);

        component.onPuzzleCompleted(component.puzzleToPlay, result);
        await flushMicrotasks();

        expect(mocks.modalController.create).not.toHaveBeenCalled();
        expect(component.streamSolutionActive).toBe(false);
        expect(component.puzzleToPlay.uid).toBe('p2');
        expect(component.forceStopTimerInPuzzleBoard).toBe(false);
        // El reloj del bloque no se detiene.
        jest.advanceTimersByTime(3000);
        expect(component.timeLeftBlock).toBe(27);
      }
    );

    it('un acierto nunca muestra ni reproduce solución, aunque el bloque la tenga activada', async () => {
      const plan = planWith({ showPuzzleSolution: true, streamSolution: true });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');
      await flushMicrotasks();

      expect(mocks.modalController.create).not.toHaveBeenCalled();
      expect(component.streamSolutionActive).toBe(false);
      expect(component.puzzleToPlay.uid).toBe('p2');
    });

    it('en un bloque por cantidad (sin reloj) ver la solución no intenta pausar ningún cronómetro', async () => {
      const plan = planWith({ time: -1, puzzlesCount: 5, showPuzzleSolution: true });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      const pause = jest.spyOn(component, 'pauseBlockTimer');

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await flushMicrotasks();

      expect(pause).not.toHaveBeenCalled();
      expect(solutionModals()).toHaveLength(1);
    });

    it('en un bloque por cantidad, reproducir la solución tampoco pausa ni reanuda cronómetro', async () => {
      const plan = planWith({
        time: -1,
        puzzlesCount: 5,
        showPuzzleSolution: false,
        streamSolution: true,
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      const pause = jest.spyOn(component, 'pauseBlockTimer');
      const resume = jest.spyOn(component, 'resumeBlockTimer');

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      component.onStreamSolutionFinished();

      expect(pause).not.toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
      expect(component.puzzleToPlay.uid).toBe('p2');
    });

    it('en un bloque con reloj, cerrar la solución reanuda el cronómetro; el sonido de error sale antes de abrirla', async () => {
      const order: string[] = [];
      mocks.soundsService.playError.mockImplementation(() => order.push('playError'));
      mocks.modalController.create.mockImplementation(async () => {
        order.push('modal');
        const fake = makeFakeModal();
        modals.push(fake);
        return fake.modal;
      });
      const plan = planWith({ showPuzzleSolution: true });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.initTimeToEndBlock(10);
      const resume = jest.spyOn(component, 'resumeBlockTimer');

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await closeLastModal();

      expect(order).toEqual(['playError', 'modal']);
      expect(resume).toHaveBeenCalledTimes(1);
    });

    it('la solución de un fallo que no es el último de la cuota deja seguir con el siguiente ejercicio del mismo bloque', async () => {
      const plan = planWith({ time: -1, puzzlesCount: 3, showPuzzleSolution: true });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await closeLastModal();

      expect(component.currentIndexBlock).toBe(0);
      expect(component.countPuzzlesPlayedBlock).toBe(1);
      expect(component.puzzleToPlay.uid).toBe('p2');
    });

    it('un fallo sin solución en el último ejercicio de la cuota cierra el bloque', async () => {
      const plan = planWith({
        time: -1,
        puzzlesCount: 1,
        showPuzzleSolution: false,
        streamSolution: false,
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');

      expect(component.currentIndexBlock).toBe(1);
      expect(mocks.modalController.create).toHaveBeenCalledTimes(1); // presentación del bloque 2
      expect(mocks.modalController.create.mock.calls[0][0].component).not.toBe(
        BoardPuzzleSolutionComponent
      );
    });

    it('un fallo sin solución en el último ejercicio del último bloque cierra la rutina', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({
            time: -1,
            puzzlesCount: 1,
            showPuzzleSolution: false,
            puzzles: makePuzzles(12),
          }),
        ],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'timeOut');

      expect(mocks.planStorageService.savePlan).toHaveBeenCalledTimes(1);
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);
    });

    // Tras ver la solución (modal o reproducción) se vuelve a servir un puzzle
    // sin pasar por la sesión; selectPuzzleToPlay comprueba otra vez la cuota,
    // y estas pruebas fijan que el último ejercicio de un bloque por cantidad
    // cierre el bloque (o la rutina) también cuando se falló con solución.
    it('al cerrar la solución del último ejercicio de la cuota pasa al bloque siguiente', async () => {
      const plan = planWith({ time: -1, puzzlesCount: 1, showPuzzleSolution: true });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await closeLastModal();

      expect(component.currentIndexBlock).toBe(1);
    });

    it('al cerrar la solución del último ejercicio del último bloque cierra la rutina', async () => {
      const plan = makePlan({
        blocks: [
          makeBlock({
            time: -1,
            puzzlesCount: 1,
            showPuzzleSolution: true,
            puzzles: makePuzzles(12),
          }),
        ],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      await closeLastModal();

      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);
    });

    it('al terminar la reproducción de la solución del último ejercicio de la cuota pasa al bloque siguiente', async () => {
      const plan = planWith({
        time: -1,
        puzzlesCount: 1,
        showPuzzleSolution: false,
        streamSolution: true,
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'bad');
      component.onStreamSolutionFinished();

      expect(component.currentIndexBlock).toBe(1);
    });
  });

  describe('resultados tardíos y fuera de sesión', () => {
    async function inBlockChange(): Promise<void> {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const plan = makePlan({
        planType: 'custom',
        uidCustomPlan: 'cp-1',
        blocks: [makeBlock({ puzzles: makePuzzles(12) }), makeBlock({ puzzles: makePuzzles(12, 'n') })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);
      component.playNextBlock(); // abre la presentación del bloque 2
      await flushMicrotasks();
      mocks.analyticsService.logEvent.mockClear();
    }

    it.each(['good', 'bad', 'timeOut'] as const)(
      'un resultado %s que llega con el cambio de bloque en marcha no se anota, ni suena, ni da analítica, ni mueve elo',
      async (result) => {
        await inBlockChange();

        component.onPuzzleCompleted(makePuzzle('tardio'), result);

        expect(component.plan.blocks[0].puzzlesPlayed).toHaveLength(0);
        expect(component.plan.blocks[1].puzzlesPlayed).toHaveLength(0);
        expect(component.countPuzzlesPlayedBlock).toBe(0);
        expect(mocks.soundsService.playGood).not.toHaveBeenCalled();
        expect(mocks.soundsService.playError).not.toHaveBeenCalled();
        expect(mocks.soundsService.playLowTime).not.toHaveBeenCalled();
        expect(mocks.analyticsService.logEvent).not.toHaveBeenCalled();
        expect(mocks.plansElosService.calculatePlanElos).not.toHaveBeenCalled();
        expect(solutionModals()).toHaveLength(0);
      }
    );

    it('cuando la presentación del bloque se cierra, el tablero vuelve a aceptar resultados en el bloque nuevo', async () => {
      await inBlockChange();
      await closeLastModal();

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      expect(component.currentIndexBlock).toBe(1);
      expect(component.plan.blocks[1].puzzlesPlayed).toHaveLength(1);
      expect(component.countPuzzlesPlayedBlock).toBe(1);
      expect(mocks.soundsService.playGood).toHaveBeenCalledTimes(1);
    });

    it('sin bloque en juego (antes de empezar o con la rutina cerrada) el resultado se ignora', async () => {
      component = await createComponent(mocks);
      component.plan = makePlan();
      component.currentIndexBlock = -1;

      component.onPuzzleCompleted(makePuzzle(), 'good');

      expect(mocks.analyticsService.logEvent).not.toHaveBeenCalled();
      expect(mocks.soundsService.playGood).not.toHaveBeenCalled();
      expect(mocks.profileService.calculateEloPuzzlePlan).not.toHaveBeenCalled();
      expect(component.plan.blocks.every((b) => b.puzzlesPlayed.length === 0)).toBe(true);
    });

    it('tras cerrar la rutina un resultado rezagado del tablero no anota nada', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(12) })] }));
      component.endPlan();
      mocks.analyticsService.logEvent.mockClear();

      component.onPuzzleCompleted(makePuzzle(), 'good');

      expect(mocks.analyticsService.logEvent).not.toHaveBeenCalled();
      expect(component.plan.blocks[0].puzzlesPlayed).toHaveLength(0);
    });
  });

  describe('endPlan', () => {
    it('guarda el plan terminado en el store, luego en el dispositivo, luego reprograma el recordatorio y al final navega', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600, elos: { plan5Total: 1700 } };
      const calls: string[] = [];
      mocks.planFacade.updatePlan.mockImplementation(() => calls.push('store'));
      mocks.planStorageService.savePlan.mockImplementation(() => calls.push('storage'));
      mocks.trainingReminderService.onSessionCompleted.mockImplementation(() => calls.push('reminder'));
      mocks.router.navigate.mockImplementation(() => calls.push('navigate'));
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan(), 2);

      component.endPlan();

      expect(calls).toEqual(['store', 'storage', 'reminder', 'navigate']);
      const inStore = mocks.planFacade.updatePlan.mock.calls[0][0] as Plan;
      const inStorage = mocks.planStorageService.savePlan.mock.calls[0][0] as Plan;
      expect(inStore).toBe(inStorage);
      expect(inStorage).toEqual(
        expect.objectContaining({
          uid: 'plan-test',
          isFinished: true,
          uidUser: 'user-1',
          eloTotal: 1700,
        })
      );
      expect(mocks.trainingReminderService.onSessionCompleted).toHaveBeenCalledWith(inStorage);
    });

    it('el elo total guardado sale del campo del perfil que corresponde al tipo de rutina', async () => {
      mocks.profile = {
        uid: 'user-1',
        elo: 1600,
        elos: { plan5Total: 1700, plan10Total: 1900, warmupTotal: 1300 },
      };
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ planType: 'plan10' }), 2);

      component.endPlan();

      expect((mocks.planStorageService.savePlan.mock.calls[0][0] as Plan).eloTotal).toBe(1900);
    });

    it('si el perfil no tiene ese elo total (o no tiene elos) la rutina se guarda sin eloTotal', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600, elos: { plan5Total: 1700 } };
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ planType: 'plan20' }), 2);
      component.endPlan();
      expect((mocks.planStorageService.savePlan.mock.calls[0][0] as Plan).eloTotal).toBeUndefined();

      mocks.planStorageService.savePlan.mockClear();
      mocks.profile = { uid: 'user-1', elo: 1600 };
      component.plan = makePlan({ planType: 'plan5' });
      component.endPlan();
      expect(mocks.planStorageService.savePlan.mock.calls[0][0]).not.toHaveProperty('eloTotal');
    });

    it('en una rutina personalizada con sesión suma una vez jugada; con error al sumar solo lo deja en consola y navega igual', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const failure = new Error('firestore');
      mocks.profile = { uid: 'user-1', elo: 1600 };
      mocks.plansElosService.incrementPlayCount.mockRejectedValue(failure);
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ planType: 'custom', uidCustomPlan: 'cp-1' }), 2);

      component.endPlan();
      await flushMicrotasks();

      expect(mocks.plansElosService.incrementPlayCount).toHaveBeenCalledTimes(1);
      expect(mocks.plansElosService.incrementPlayCount).toHaveBeenCalledWith('cp-1', 'user-1');
      expect(error).toHaveBeenCalledWith('Error incrementing play count', failure);
      expect(mocks.router.navigate).toHaveBeenCalledWith(['/puzzles/plan-played']);
    });

    it.each([
      ['personalizada sin sesión', 'custom', 'cp-1', false],
      ['personalizada sin uidCustomPlan', 'custom', undefined, true],
      ['de perfil (plan5)', 'plan5', undefined, true],
    ] as const)(
      'una rutina %s no suma veces jugada',
      async (_name, planType, uidCustomPlan, withSession) => {
        mocks.profile = withSession ? { uid: 'user-1', elo: 1600 } : null;
        component = await createComponent(mocks);
        mountAtBlock(component, makePlan({ planType, uidCustomPlan }), 2);

        component.endPlan();

        expect(mocks.plansElosService.incrementPlayCount).not.toHaveBeenCalled();
        expect(mocks.planStorageService.savePlan).toHaveBeenCalledTimes(1);
      }
    );

    it('apaga el reloj del bloque y deja la pantalla sin estado de sesión (flags, tiempo y píldoras de elo)', async () => {
      component = await createComponent(mocks);
      mountAtBlock(component, makePlan({ blocks: [makeBlock({ puzzles: makePuzzles(12) })] }));
      component.initTimeToEndBlock(30);
      component.eloChanges = [3, -2];
      component['isSolutionOpen'] = true;
      component['blockTimeExpired'] = true;
      component.isDropdownOpen = true;
      expect(jest.getTimerCount()).toBe(1);

      component.endPlan();

      expect(jest.getTimerCount()).toBe(0);
      expect(component.timeLeftBlock).toBe(0);
      expect(component.eloChanges).toEqual([]);
      expect(component['isSolutionOpen']).toBe(false);
      expect(component['blockTimeExpired']).toBe(false);
      expect(component.isDropdownOpen).toBe(false);
      expect(component.showBlockTimer).toBe(false);
      expect(component.forceStopTimerInPuzzleBoard).toBe(true);
      expect(component.plan.isFinished).toBe(true);
      // plan-played lee el plan del store: no se limpia aquí.
      expect(mocks.planFacade.clearPlan).not.toHaveBeenCalled();
    });

    it('el último acierto de la rutina la cierra con ese puzzle ya anotado en lo que se guarda', async () => {
      mocks.profile = { uid: 'user-1', elo: 1600 };
      const plan = makePlan({
        blocks: [makeBlock({ time: -1, puzzlesCount: 1, puzzles: makePuzzles(12) })],
      });
      component = await createComponent(mocks);
      mountAtBlock(component, plan);

      component.onPuzzleCompleted(component.puzzleToPlay, 'good');

      const saved = mocks.planStorageService.savePlan.mock.calls[0][0] as Plan;
      expect(saved.blocks[0].puzzlesPlayed).toHaveLength(1);
      expect(saved.blocks[0].puzzlesPlayed[0].resolved).toBe(true);
      expect(saved.isFinished).toBe(true);
    });
  });
});
