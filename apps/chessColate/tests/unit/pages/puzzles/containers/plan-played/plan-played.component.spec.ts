// La librería del tablero arrastra cm-chessboard, que Jest no sabe cargar. Aquí no
// se dibuja ningún tablero: se sustituye por dobles con el mismo selector y E/S.
jest.mock('@chesspark/board', () => {
  const { Component, Input, Output, EventEmitter } = jest.requireActual('@angular/core');

  class FenBoardComponent {
    fen = '';
    firstMoveSquaresHighlight: unknown;
    puzzle: unknown;
    onPuzzleShowSolution = new EventEmitter();
  }
  Component({ selector: 'lib-fen-board', standalone: true, template: '' })(FenBoardComponent);
  for (const input of ['fen', 'firstMoveSquaresHighlight', 'puzzle']) {
    Input()(FenBoardComponent.prototype, input);
  }
  Output()(FenBoardComponent.prototype, 'onPuzzleShowSolution');

  class BoardPuzzleSolutionComponent {}
  Component({ selector: 'lib-board-puzzle-solution', standalone: true, template: '' })(BoardPuzzleSolutionComponent);

  return { FenBoardComponent, BoardPuzzleSolutionComponent };
});
jest.mock('@shared/components/navbar/navbar.component', () => {
  const { Component } = jest.requireActual('@angular/core');
  class NavbarComponent {}
  Component({ selector: 'app-navbar', standalone: true, template: '' })(NavbarComponent);
  return { NavbarComponent };
});
jest.mock('@pages/puzzles/components/plan-chart/plan-chart.component', () => {
  const { Component, Input } = jest.requireActual('@angular/core');
  class PlanChartComponent {}
  Component({ selector: 'app-plan-chart', standalone: true, template: '' })(PlanChartComponent);
  for (const input of ['plan', 'isModal', 'showEloPlanHeader']) {
    Input()(PlanChartComponent.prototype, input);
  }
  return { PlanChartComponent };
});

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonContent, IonIcon, LoadingController, ModalController } from '@ionic/angular/standalone';
import { BehaviorSubject, Subject } from 'rxjs';

import { Block, Plan, Puzzle, UserPuzzle } from '@chesspark/models';
import { BoardPuzzleSolutionComponent } from '@chesspark/board';
import { ConfettiService } from '@chesspark/common-utils';
import { PlanFacadeService, PublicPlansFacadeService } from '@chesspark/state';

import { PlanPlayedComponent } from '@app/pages/puzzles/containers/plan-played/plan-played.component';
import { TrainingReminderService } from '@features/reminders/services/training-reminder.service';
import { ReminderPermissionModalComponent } from '@features/reminders/containers/reminder-permission-modal/reminder-permission-modal.component';
import { ProfileService } from '@services/account/profile.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { AppReviewService } from '@services/app/app-review.service';
import { AppService } from '@services/app/app.service';
import { PlanStorageService } from '@services/plans/plan-storage.service';
import { PlanService } from '@services/plans/plan.service';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { BlockService } from '@services/training/block.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { provideTranslocoTesting } from '@tests/support/transloco-testing';

/** Deja correr las promesas pendientes. */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function makeUserPuzzle(uid: string, resolved = true): UserPuzzle {
  return {
    uid,
    resolved,
    failByTime: false,
    fenStartUserPuzzle: '8/8/8/8/8/8/8/8 w - - 0 1',
    rawPuzzle: { uid, themes: ['mateIn1', 'fork'] } as unknown as Puzzle,
  } as unknown as UserPuzzle;
}

function makeBlock(played: number, extra: Partial<Block> = {}): Block {
  return {
    theme: 'fork',
    puzzlesPlayed: Array.from({ length: played }, (_, i) => makeUserPuzzle(`u${i}`, i % 2 === 0)),
    ...extra,
  } as unknown as Block;
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    uid: 'plan-1',
    planType: 'plan5',
    isFinished: true,
    createdAt: 1,
    blocks: [makeBlock(6), makeBlock(2)],
    initialTotalElo: 1500,
    initialMaxElo: 1600,
    ...overrides,
  } as unknown as Plan;
}

describe('PlanPlayedComponent', () => {
  let component: PlanPlayedComponent;
  let fixture: ComponentFixture<PlanPlayedComponent>;

  let plan$: Subject<Plan | null>;
  let loadingPlan$: BehaviorSubject<boolean>;
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let route: { queryParams: BehaviorSubject<Record<string, string>>; snapshot: { queryParams: Record<string, string> } };
  let profile$: BehaviorSubject<unknown>;
  let profileService: { profile$: BehaviorSubject<unknown>; getProfile: { uid: string } | null; getEloTotalByPlanType: jest.Mock };
  let planFacade: { getPlan$: jest.Mock; getLoadingPlan$: jest.Mock; updatePlan: jest.Mock; setPlan: jest.Mock };
  let publicFacade: { getUserInteractionByPlan$: jest.Mock; loadPlanInteraction: jest.Mock; togglePlanLike: jest.Mock };
  let interaction$: BehaviorSubject<{ liked: boolean } | null>;
  let router: { navigate: jest.Mock };
  let modalController: { create: jest.Mock };
  let modal: { present: jest.Mock; onWillDismiss: jest.Mock };
  let loader: { present: jest.Mock; dismiss: jest.Mock; message?: string };
  let loadingController: { create: jest.Mock };
  let plansElos: { getOnePlanElo: jest.Mock };
  let blockService: { generateBlocksForPlan: jest.Mock; getPuzzlesForBlock: jest.Mock };
  let planService: { newPlan: jest.Mock; makeCustomPlanForPlay: jest.Mock };
  let planStorage: { getPlanById: jest.Mock };
  let confetti: { launch: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let reminders: Record<'getState' | 'getEventsCount' | 'checkPermissionStatus' | 'markContextPromptShown' | 'enable', jest.Mock>;
  let appReview: { onRoutineFinished: jest.Mock };

  const text = () => fixture.nativeElement.textContent as string;

  async function emitPlan(plan: Plan | null) {
    plan$.next(plan);
    await flush();
    fixture.detectChanges();
  }

  /** Crea el componente; `queryUid` simula abrir la pantalla desde el historial. */
  function create(queryUid?: string) {
    if (queryUid) {
      route.snapshot.queryParams = { uid: queryUid };
      queryParams$.next({ uid: queryUid });
    }
    fixture = TestBed.createComponent(PlanPlayedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    plan$ = new Subject();
    loadingPlan$ = new BehaviorSubject(false);
    queryParams$ = new BehaviorSubject<Record<string, string>>({});
    route = { queryParams: queryParams$, snapshot: { queryParams: {} } };
    profile$ = new BehaviorSubject<unknown>(null);
    profileService = {
      profile$,
      getProfile: null,
      getEloTotalByPlanType: jest.fn().mockReturnValue(1560),
    };
    planFacade = {
      getPlan$: jest.fn().mockReturnValue(plan$),
      getLoadingPlan$: jest.fn().mockReturnValue(loadingPlan$),
      updatePlan: jest.fn(),
      setPlan: jest.fn(),
    };
    interaction$ = new BehaviorSubject<{ liked: boolean } | null>(null);
    publicFacade = {
      getUserInteractionByPlan$: jest.fn().mockReturnValue(interaction$),
      loadPlanInteraction: jest.fn(),
      togglePlanLike: jest.fn(),
    };
    router = { navigate: jest.fn() };
    modal = { present: jest.fn().mockResolvedValue(undefined), onWillDismiss: jest.fn().mockResolvedValue({ role: 'cancel' }) };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    loader = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(true) };
    loadingController = { create: jest.fn().mockResolvedValue(loader) };
    plansElos = { getOnePlanElo: jest.fn().mockResolvedValue({ total: 1700, maxTotal: 1650 }) };
    blockService = {
      generateBlocksForPlan: jest.fn().mockResolvedValue([{ label: 'a' }, { label: 'b' }]),
      getPuzzlesForBlock: jest.fn().mockResolvedValue([{ uid: 'rp' }]),
    };
    planService = {
      newPlan: jest.fn().mockResolvedValue({}),
      makeCustomPlanForPlay: jest.fn().mockResolvedValue({ uid: 'ready' }),
    };
    planStorage = { getPlanById: jest.fn().mockReturnValue(null) };
    confetti = { launch: jest.fn() };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    reminders = {
      getState: jest.fn().mockReturnValue({ enabled: false, contextPromptShownAt: null }),
      getEventsCount: jest.fn().mockReturnValue(5),
      checkPermissionStatus: jest.fn().mockResolvedValue('prompt'),
      markContextPromptShown: jest.fn(),
      enable: jest.fn().mockResolvedValue({}),
    };
    appReview = { onRoutineFinished: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [PlanPlayedComponent],
      providers: [
        provideTranslocoTesting(),
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: PublicPlansFacadeService, useValue: publicFacade },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: ModalController, useValue: modalController },
        { provide: LoadingController, useValue: loadingController },
        { provide: AppService, useValue: { getNameThemePuzzleByValue: (t: string) => `tema:${t}`, getNameOpeningByValue: (o: string) => o } },
        { provide: ProfileService, useValue: profileService },
        { provide: PlansElosService, useValue: plansElos },
        { provide: BlockService, useValue: blockService },
        { provide: PlanService, useValue: planService },
        { provide: PlanStorageService, useValue: planStorage },
        { provide: ConfettiService, useValue: confetti },
        { provide: AnalyticsService, useValue: analytics },
        { provide: TrainingReminderService, useValue: reminders },
        { provide: AppReviewService, useValue: appReview },
      ],
    })
      .overrideComponent(PlanPlayedComponent, {
        remove: { imports: [IonContent, IonIcon] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('se crea', () => {
    create();

    expect(component).toBeTruthy();
  });

  describe('qué plan muestra', () => {
    it('si no hay plan, no se está cargando uno y nunca hubo uno, vuelve al inicio', async () => {
      create();

      await emitPlan(null);

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('si se está cargando un plan nuevo no vuelve al inicio', async () => {
      loadingPlan$.next(true);
      create();

      await emitPlan(null);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('un plan sin terminar (uno que se está creando) se ignora', async () => {
      create();

      await emitPlan(makePlan({ isFinished: false }));

      expect(component.plan).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('con un plan terminado lo muestra y reparte los tableros en páginas de 4 por bloque', async () => {
      create();

      await emitPlan(makePlan());

      expect(component.plan?.uid).toBe('plan-1');
      expect(component.userPuzzlesToShowInBoards[0].length).toBe(4);
      expect(component.userPuzzlesToShowInBoards[1].length).toBe(2);
      expect(component.showMoreButtons).toEqual({ 0: true, 1: false });
      expect(fixture.debugElement.queryAll(By.css('lib-fen-board')).length).toBe(6);
    });

    it('una vez que hubo plan, perderlo no manda al inicio', async () => {
      create();
      await emitPlan(makePlan());
      router.navigate.mockClear();

      await emitPlan(null);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('mientras carga un plan nuevo vacía el actual para mostrar el esqueleto', async () => {
      create();
      await emitPlan(makePlan());

      loadingPlan$.next(true);
      fixture.detectChanges();

      expect(component.plan).toBeNull();
      expect(component.userPuzzlesToShowInBoards).toEqual({});
      expect(fixture.debugElement.queryAll(By.css('lib-fen-board')).length).toBe(0);
    });

    it('pinta un bloque por cada bloque del plan con el nombre de su tema', async () => {
      create();

      await emitPlan(makePlan());

      expect(fixture.nativeElement.querySelectorAll('.collapse').length).toBe(2);
      expect(text()).toContain('tema:fork');
    });
  });

  describe('abrir desde el historial', () => {
    it('con ?uid= marca "desde historial" y carga ese plan en el store', () => {
      const stored = makePlan({ uid: 'old' });
      planStorage.getPlanById.mockReturnValue(stored);

      create('old');

      expect(component.isFromHistory).toBe(true);
      expect(planStorage.getPlanById).toHaveBeenCalledWith('old');
      expect(planFacade.updatePlan).toHaveBeenCalledWith(stored);
    });

    it('si el plan del historial no existe, no toca el store', () => {
      create('perdido');

      expect(component.isFromHistory).toBe(true);
      expect(planFacade.updatePlan).not.toHaveBeenCalled();
    });

    it('muestra el enlace de regreso al historial, que navega allí', async () => {
      create('old');
      await emitPlan(makePlan());

      (fixture.nativeElement.querySelector('.breadcrumbs a') as HTMLElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/plans-history']);
    });

    it('si el store no tiene plan pero el historial sí, lo muestra sin ir al inicio', async () => {
      planStorage.getPlanById.mockReturnValue(makePlan({ uid: 'old' }));
      create('old');
      planFacade.updatePlan.mockClear();

      await emitPlan(null);

      expect(component.plan?.uid).toBe('old');
      expect(router.navigate).not.toHaveBeenCalledWith(['/home']);
    });

    it('un plan abierto desde el historial no celebra récords con confeti', async () => {
      create('old');
      await emitPlan(makePlan({ initialMaxElo: 1400 }));

      expect(component.isNewRecord).toBe(true);
      expect(confetti.launch).not.toHaveBeenCalled();
    });
  });

  describe('ver más tableros', () => {
    it('loadMorePuzzles añade otros 4 y oculta el botón al mostrar todos', async () => {
      create();
      await emitPlan(makePlan({ blocks: [makeBlock(10)] }));
      expect(component.showMoreButtons[0]).toBe(true);

      component.loadMorePuzzles(0);
      expect(component.userPuzzlesToShowInBoards[0].length).toBe(8);
      expect(component.showMoreButtons[0]).toBe(true);

      component.loadMorePuzzles(0);
      expect(component.userPuzzlesToShowInBoards[0].length).toBe(10);
      expect(component.showMoreButtons[0]).toBe(false);
    });

    it('el botón "cargar más" del bloque agrega tableros a la vista', async () => {
      create();
      await emitPlan(makePlan({ blocks: [makeBlock(6)] }));

      (fixture.nativeElement.querySelector('button.btn-block') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.css('lib-fen-board')).length).toBe(6);
      expect(fixture.nativeElement.querySelector('button.btn-block')).toBeNull();
    });

    it('sin plan no hace nada', () => {
      create();

      expect(() => component.loadMorePuzzles(0)).not.toThrow();
    });
  });

  describe('ELO total y récord', () => {
    it('rutina por defecto: toma el ELO del perfil y calcula cuánto subió', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1560);
      create();

      await emitPlan(makePlan({ planType: 'plan5', initialTotalElo: 1500 }));

      expect(profileService.getEloTotalByPlanType).toHaveBeenCalledWith('plan5');
      expect(component.eloTotal).toBe(1560);
      expect(component.eloDelta).toBe(60);
    });

    it('si bajó, el delta es negativo', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1480);
      create();

      await emitPlan(makePlan({ initialTotalElo: 1500 }));

      expect(component.eloDelta).toBe(-20);
    });

    it('un plan antiguo sin ELO inicial no tiene delta', async () => {
      create();

      await emitPlan(makePlan({ initialTotalElo: undefined }));

      expect(component.eloDelta).toBeNull();
    });

    it('superar el máximo inicial es récord y lanza confeti dorado', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1650);
      create();

      await emitPlan(makePlan({ initialMaxElo: 1600 }));

      expect(component.isNewRecord).toBe(true);
      expect(confetti.launch).toHaveBeenCalledWith(['#FFD700', '#FFA500', '#FF8C00', '#FF6347'], 5000, 'high');
    });

    it('igualar el máximo no es récord', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1600);
      create();

      await emitPlan(makePlan({ initialMaxElo: 1600 }));

      expect(component.isNewRecord).toBe(false);
      expect(confetti.launch).not.toHaveBeenCalled();
    });

    it('sin máximo inicial guardado no se declara récord', async () => {
      create();

      await emitPlan(makePlan({ initialMaxElo: undefined }));

      expect(component.isNewRecord).toBe(false);
    });

    it('rutina propia: usa el ELO de esa rutina en Firestore y el máximo histórico', async () => {
      plansElos.getOnePlanElo.mockResolvedValue({ total: 1700, maxTotal: 1650 });
      create();

      await emitPlan(makePlan({ planType: 'custom', uidCustomPlan: 'c1', initialMaxElo: undefined, initialTotalElo: 1690 }));

      expect(plansElos.getOnePlanElo).toHaveBeenCalledWith('c1');
      expect(component.eloTotal).toBe(1700);
      expect(component.eloDelta).toBe(10);
      expect(component.isNewRecord).toBe(true); // 1700 > maxTotal 1650
      expect(profileService.getEloTotalByPlanType).not.toHaveBeenCalled();
    });

    it('rutina propia sin ELO guardado cuenta 0', async () => {
      plansElos.getOnePlanElo.mockResolvedValue(null);
      create();

      await emitPlan(makePlan({ planType: 'custom', uidCustomPlan: 'c1', initialTotalElo: undefined }));

      expect(component.eloTotal).toBe(0);
    });

    it('el confeti no se relanza mientras dura el anterior', () => {
      jest.useFakeTimers();
      create();

      component.launchConfetti();
      component.launchConfetti();
      expect(confetti.launch).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5500);
      component.launchConfetti();
      expect(confetti.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe('sesión del usuario', () => {
    it('sin sesión muestra un ELO de ejemplo (1500) y la invitación a ingresar', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1560);
      create();

      await emitPlan(makePlan());

      expect(component.isAuthenticated).toBe(false);
      expect(text()).toContain('1500');
      expect(text()).not.toContain('1560'); // el ELO real no se filtra a quien no inició sesión
      expect(component.examplePlan?.blocks.length).toBe(2);
    });

    it('con sesión muestra el ELO real y pasa a ser autenticado', async () => {
      profileService.getProfile = { uid: 'u1' };
      profileService.getEloTotalByPlanType.mockReturnValue(1540);
      create();
      profile$.next({ uid: 'u1' });

      await emitPlan(makePlan({ initialTotalElo: 1540 }));

      expect(component.isAuthenticated).toBe(true);
      expect(text()).toContain('1540');
    });

    it('examplePlan es nulo sin plan', () => {
      create();

      expect(component.examplePlan).toBeNull();
    });

    it('openLoginModal abre el login en modo "login"', async () => {
      create();

      component.openLoginModal();
      await flush();

      expect(modalController.create).toHaveBeenCalledWith({
        component: LoginComponent,
        componentProps: { segmentEmailPassword: 'login' },
      });
      expect(modal.present).toHaveBeenCalled();
    });
  });

  describe('me gusta en rutinas públicas', () => {
    beforeEach(() => {
      profileService.getProfile = { uid: 'u1' };
    });

    it('en una rutina pública de otra persona, carga su interacción y refleja si ya le dio me gusta', async () => {
      interaction$.next({ liked: true });
      create();

      await emitPlan(makePlan({ isPublic: true, uidUser: 'otro' }));

      expect(component.canLike).toBe(true);
      expect(publicFacade.loadPlanInteraction).toHaveBeenCalledWith('u1', 'plan-1');
      expect(component.isLiked).toBe(true);
    });

    it('la autora de la rutina no puede darle me gusta ni consulta la interacción', async () => {
      create();

      await emitPlan(makePlan({ isPublic: true, uidUser: 'u1' }));

      expect(component.canLike).toBe(false);
      expect(publicFacade.loadPlanInteraction).not.toHaveBeenCalled();
    });

    it('una rutina no pública no se puede valorar', async () => {
      create();

      await emitPlan(makePlan({ isPublic: false, uidUser: 'otro' }));

      expect(component.isPublicPlan).toBe(false);
      expect(component.canLike).toBe(false);
    });

    it('onToggleLike invierte el estado y avisa al store', async () => {
      create();
      await emitPlan(makePlan({ isPublic: true, uidUser: 'otro' }));

      await component.onToggleLike();

      expect(publicFacade.togglePlanLike).toHaveBeenCalledWith('u1', 'plan-1', true);
      expect(component.isLiked).toBe(true);
      expect(component.isLoadingLike).toBe(false);
    });

    it('si ya tenía me gusta, lo quita', async () => {
      interaction$.next({ liked: true });
      create();
      await emitPlan(makePlan({ isPublic: true, uidUser: 'otro' }));

      await component.onToggleLike();

      expect(publicFacade.togglePlanLike).toHaveBeenCalledWith('u1', 'plan-1', false);
    });

    it('no hace nada si la persona no puede valorar o ya hay una acción en curso', async () => {
      create();
      await emitPlan(makePlan({ isPublic: true, uidUser: 'u1' }));
      await component.onToggleLike();
      expect(publicFacade.togglePlanLike).not.toHaveBeenCalled();

      await emitPlan(makePlan({ isPublic: true, uidUser: 'otro' }));
      component.isLoadingLike = true;
      await component.onToggleLike();
      expect(publicFacade.togglePlanLike).not.toHaveBeenCalled();
    });
  });

  describe('repetir y empezar rutinas', () => {
    it('repetir una rutina por defecto genera bloques nuevos, carga sus puzzles y navega al entrenamiento', async () => {
      create();
      await emitPlan(makePlan({ planType: 'plan10' }));

      await component.onRepeatPlan();

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('plan10');
      expect(blockService.getPuzzlesForBlock).toHaveBeenCalledTimes(2);
      expect(planService.newPlan.mock.calls[0][1]).toBe('plan10');
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(component.isLoadingToPlay).toBe(false);
    });

    it('repetir una rutina propia la prepara con makeCustomPlanForPlay y la pone en el store', async () => {
      create();
      const plan = makePlan({ planType: 'custom', uidCustomPlan: 'c1' });
      await emitPlan(plan);

      await component.onRepeatPlan();

      expect(planService.makeCustomPlanForPlay).toHaveBeenCalledWith(plan);
      expect(planFacade.setPlan).toHaveBeenCalledWith({ uid: 'ready' });
      expect(blockService.generateBlocksForPlan).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('no arranca otra si ya hay una en preparación ni sin plan', async () => {
      create();
      await component.onRepeatPlan();
      expect(loadingController.create).not.toHaveBeenCalled();

      await emitPlan(makePlan());
      component.isLoadingToPlay = true;
      await component.onRepeatPlan();
      expect(loadingController.create).not.toHaveBeenCalled();
    });

    it('si falla al repetir libera el botón, cierra el cargando y no navega', async () => {
      blockService.getPuzzlesForBlock.mockRejectedValue(new Error('sin red'));
      create();
      await emitPlan(makePlan());

      await component.onRepeatPlan();

      expect(component.isLoadingToPlay).toBe(false);
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(router.navigate).not.toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('el menú rápido ofrece las 6 rutinas y cada una arranca su plan', async () => {
      create();
      await emitPlan(makePlan());
      expect(component.quickRoutines.map((r) => r.plan)).toEqual([1, 3, 5, 10, 20, 30]);

      await component.startRoutine(20);

      expect(blockService.generateBlocksForPlan).toHaveBeenCalledWith('plan20');
      expect(planService.newPlan.mock.calls[0][1]).toBe('plan20');
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('si falla al empezar una rutina libera el botón y no navega', async () => {
      planService.newPlan.mockRejectedValue(new Error('fallo'));
      create();

      await component.startRoutine(5);

      expect(component.isLoadingToPlay).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('goToHome y goToHistory navegan', () => {
      create();

      component.goToHome();
      component.goToHistory();

      expect(router.navigate).toHaveBeenNthCalledWith(1, ['/home']);
      expect(router.navigate).toHaveBeenNthCalledWith(2, ['/puzzles/plans-history']);
    });
  });

  it('ver la solución abre el modal con el puzzle y los temas traducidos', async () => {
    create();
    const puzzle = { uid: 'x', themes: ['fork', 'pin'] } as unknown as Puzzle;

    await component.onPuzzleShowSolution(puzzle);

    expect(modalController.create).toHaveBeenCalledWith({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: { puzzle, themesTranslated: ['tema:fork', 'tema:pin'] },
    });
    expect(modal.present).toHaveBeenCalled();
  });

  it('el animalito del plan sale de su tipo; sin plan usa el de "custom"', async () => {
    create();
    expect(component.planImageSrc).toBe('assets/images/plan-icons/custom.png');

    await emitPlan(makePlan({ planType: 'plan5' }));

    expect(component.planImageSrc).toBe('assets/images/plan-icons/plan5.png');
  });

  describe('avisos de fin de rutina', () => {
    beforeEach(() => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    });

    it('en nativo, con 2+ sesiones y permiso sin decidir, propone el recordatorio tras una pausa y no pide la reseña', async () => {
      jest.useFakeTimers();
      create();

      await emitPlan(makePlan());
      expect(modalController.create).not.toHaveBeenCalled();

      jest.advanceTimersByTime(800);
      await flush();

      expect(reminders.markContextPromptShown).toHaveBeenCalledTimes(1);
      expect(analytics.logEvent).toHaveBeenCalledWith('training_reminder_prompt_shown', { source: 'plan_played' });
      expect(modalController.create).toHaveBeenCalledWith(
        expect.objectContaining({ component: ReminderPermissionModalComponent }),
      );
      // la invitación a calificar espera a otra rutina
      expect(appReview.onRoutineFinished.mock.calls[0][2]).toBe(false);
    });

    it('si la persona acepta en el modal, activa el recordatorio', async () => {
      jest.useFakeTimers();
      modal.onWillDismiss.mockResolvedValue({ role: 'accept' });
      create();

      await emitPlan(makePlan());
      jest.advanceTimersByTime(800);
      await flush();

      expect(reminders.enable).toHaveBeenCalledWith('prompt');
    });

    it('si cierra el modal sin aceptar, no activa nada', async () => {
      jest.useFakeTimers();
      create();

      await emitPlan(makePlan());
      jest.advanceTimersByTime(800);
      await flush();

      expect(reminders.enable).not.toHaveBeenCalled();
    });

    it.each([
      ['ya está activado', () => reminders.getState.mockReturnValue({ enabled: true, contextPromptShownAt: null })],
      ['ya se le propuso antes', () => reminders.getState.mockReturnValue({ enabled: false, contextPromptShownAt: 123 })],
      ['tiene menos de 2 sesiones', () => reminders.getEventsCount.mockReturnValue(1)],
      ['el permiso está denegado', () => reminders.checkPermissionStatus.mockResolvedValue('denied')],
    ])('no propone el recordatorio si %s y deja pasar la invitación a calificar', async (_motivo, arrange) => {
      jest.useFakeTimers();
      arrange();
      create();

      await emitPlan(makePlan());
      jest.advanceTimersByTime(2000);
      await flush();

      expect(modalController.create).not.toHaveBeenCalled();
      expect(appReview.onRoutineFinished.mock.calls[0][2]).toBe(true);
    });

    it('con el permiso ya concedido igual propone el recordatorio', async () => {
      jest.useFakeTimers();
      reminders.checkPermissionStatus.mockResolvedValue('granted');
      create();

      await emitPlan(makePlan());
      jest.advanceTimersByTime(800);
      await flush();

      expect(modalController.create).toHaveBeenCalled();
    });

    it('en la web nunca propone el recordatorio', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
      jest.useFakeTimers();
      create();

      await emitPlan(makePlan());
      jest.advanceTimersByTime(2000);
      await flush();

      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('la invitación a calificar recibe el plan, el récord, la precisión y el ELO ganado', async () => {
      profileService.getEloTotalByPlanType.mockReturnValue(1650); // récord (> 1600), +150
      // bloques: 6 jugados (3 bien) + 2 jugados (1 bien) → 4/8
      create();

      await emitPlan(makePlan());
      await flush();

      expect(appReview.onRoutineFinished).toHaveBeenCalledWith(
        'plan-1',
        { isNewRecord: true, accuracy: 0.5, eloDelta: 150 },
        expect.any(Boolean),
      );
    });

    it('un plan abierto desde el historial no genera avisos', async () => {
      create('old');

      await emitPlan(makePlan());
      await flush();

      expect(appReview.onRoutineFinished).not.toHaveBeenCalled();
      expect(modalController.create).not.toHaveBeenCalled();
    });

    it('los avisos se evalúan una sola vez por visita aunque el plan se vuelva a emitir', async () => {
      create();

      await emitPlan(makePlan());
      await emitPlan(makePlan());
      await flush();

      expect(appReview.onRoutineFinished).toHaveBeenCalledTimes(1);
    });
  });

  it('al destruirse deja de escuchar el plan', async () => {
    create();
    fixture.destroy();

    await emitPlan(null);

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
