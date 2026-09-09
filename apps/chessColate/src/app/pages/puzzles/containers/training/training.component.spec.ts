// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar (su
// paquete resuelve a un index.html). Aquí no se dibuja ningún tablero: se
// sustituye por dobles y se vacían los imports del componente.
jest.mock('@chesspark/board', () => ({
  BoardPuzzleComponent: class {},
  BoardPuzzleSolutionComponent: class {},
}));

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import {
  AlertController,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { Block, Plan, Puzzle } from '@cpark/models';
import { PlanFacadeService } from '@cpark/state';
import { SoundsService, UidGeneratorService } from '@chesspark/common-utils';

import { AppService } from '@services/app.service';
import { BlockService } from '@services/block.service';
import { InfinityPuzzlePoolService } from '@services/infinity-puzzle-pool.service';
import { ProfileService } from '@services/profile.service';
import { PlansElosService } from '@services/plans-elos.service';
import { PlanStorageService } from '@services/plan-storage.service';
import { PlanService } from '@services/plan.service';
import { AnalyticsService } from '@services/analytics.service';
import { TrainingReminderService } from '@services/training-reminder.service';
import { Reto333StorageService } from '@services/reto333-storage.service';
import { UserRecordsService } from '@services/user-records.service';

import { TrainingComponent } from './training.component';

/**
 * Pruebas del cronómetro del bloque y del reparto entre "seguir en el bloque" y
 * "cambiar de bloque". Cubren el fallo reportado: al fallar un ejercicio justo
 * cuando se acababa el tiempo del bloque se abrían dos pantallas encima de la
 * otra, el contador quedaba duplicado (bajaba al doble de velocidad) y se
 * saltaban bloques hasta terminar el plan antes de tiempo.
 */

function makePuzzle(uid = 'p1'): Puzzle {
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
  };
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

function makePlan(): Plan {
  return {
    uid: 'plan-test',
    blocks: [makeBlock(), makeBlock(), makeBlock()],
    createdAt: Date.now(),
    planType: 'plan5',
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

/** Deja correr las microtareas pendientes (creación y presentación del modal). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('TrainingComponent · cronómetro del bloque', () => {
  let component: TrainingComponent;
  let modalController: { create: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();

    modalController = { create: jest.fn() };

    const noop = {};
    await TestBed.configureTestingModule({
      imports: [TrainingComponent],
      providers: [
        { provide: ModalController, useValue: modalController },
        { provide: AlertController, useValue: { create: jest.fn() } },
        { provide: LoadingController, useValue: { create: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: PlanFacadeService,
          useValue: {
            getPlan$: () => of(null),
            getLoadingPlan$: () => of(false),
            updatePlan: jest.fn(),
            clearPlan: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getProfile: null,
            getEloTotalByPlanType: () => 1500,
            calculateEloPuzzlePlan: () => ({ totalEloChange: 0 }),
          },
        },
        {
          provide: BlockService,
          useValue: { getPuzzlesForBlock: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: AppService,
          useValue: {
            getThemesPuzzlesList: [],
            getNameThemePuzzleByValue: (v: string) => v,
            getDescriptionThemePuzzleByValue: (v: string) => v,
            getNameOpeningByValue: (v: string) => v,
            getDescriptionOpeningByValue: (v: string) => v,
          },
        },
        { provide: TranslocoService, useValue: { translate: (k: string) => k } },
        {
          provide: SoundsService,
          useValue: {
            playGood: jest.fn(),
            playError: jest.fn(),
            playLowTime: jest.fn(),
          },
        },
        {
          provide: UidGeneratorService,
          useValue: { generateSimpleUid: () => 'uid' },
        },
        {
          provide: AnalyticsService,
          useValue: { logEvent: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PlansElosService, useValue: noop },
        { provide: PlanStorageService, useValue: { savePlan: jest.fn() } },
        { provide: PlanService, useValue: noop },
        { provide: InfinityPuzzlePoolService, useValue: noop },
        {
          provide: TrainingReminderService,
          useValue: { onSessionCompleted: jest.fn() },
        },
        { provide: Reto333StorageService, useValue: noop },
        { provide: UserRecordsService, useValue: noop },
      ],
    })
      .overrideComponent(TrainingComponent, {
        set: { template: '', imports: [], schemas: [] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(TrainingComponent);
    component = fixture.componentInstance;

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
