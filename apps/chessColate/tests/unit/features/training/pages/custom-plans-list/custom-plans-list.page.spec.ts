import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { LoadingController, ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { Plan, Profile } from '@chesspark/models';
import {
  CustomPlansFacadeService,
  getCountAllCustomPlans,
  getIsInitialized,
  getProfile,
  PlanFacadeService,
  PlansElosFacadeService,
} from '@chesspark/state';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { ProfileService } from '@core/account/profile.service';
import { CustomPlansService } from '@features/training/services/custom-plans.service';
import { PlanService } from '@features/training/services/plan.service';
import { LoginComponent } from '@shared/components/login/login.component';

import { CustomPlansListPage } from '@features/training/pages/custom-plans-list/custom-plans-list.page';

import {
  ELO_TO_START_CASES,
  findButton,
  findButtonByIcon,
  flushMicrotasks,
  iconNames,
  makeBlock,
  makePlan,
  silenceIonIconNoise,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

const TRANSLATIONS = {
  PUZZLES: {
    loader: {
      loadingPuzzles: 'Cargando ejercicios',
      loadingPuzzlesProgress: 'Cargando {{loaded}} de {{total}}',
    },
  },
};

function customPlan(uid: string, overrides: Partial<Plan> = {}): Plan {
  return makePlan({
    uid,
    uidCustomPlan: uid,
    title: `Rutina ${uid}`,
    planType: 'custom',
    blocks: [makeBlock({ puzzles: undefined, time: 300 })],
    ...overrides,
  });
}

const PROFILE = { uid: 'user-1', elos: undefined } as unknown as Profile;

describe('CustomPlansListPage', () => {
  let fixture: ComponentFixture<CustomPlansListPage>;
  let component: CustomPlansListPage;
  let el: HTMLElement;
  let store: MockStore;

  let plans$: BehaviorSubject<Plan[]>;
  let loading$: BehaviorSubject<boolean>;
  let planElos: Record<string, Observable<unknown>>;
  let currentProfile: Partial<Profile> | null;

  let customPlansFacade: { getCustomPlansLoading$: jest.Mock; loadCustomPlans: jest.Mock };
  let plansElosFacade: { getPlanElo$: jest.Mock; requestLoadPlansElos: jest.Mock };
  let planFacade: { clearPlan: jest.Mock; setPlan: jest.Mock };
  let planService: { makeCustomPlanForPlay: jest.Mock };
  let router: { navigate: jest.Mock };
  let loader: { present: jest.Mock; dismiss: jest.Mock; message?: string };
  let loadingController: { create: jest.Mock };
  let modal: { present: jest.Mock; onDidDismiss: jest.Mock };
  let modalController: { create: jest.Mock };
  let appService: { getNameThemePuzzleByValue: jest.Mock; getThemePuzzleByValue: jest.Mock };

  function setSession(profile: Partial<Profile> | null, initialized = true): void {
    currentProfile = profile;
    store.overrideSelector(getProfile, profile as Profile | null);
    store.overrideSelector(getIsInitialized, initialized);
    store.refreshState();
  }

  function render(): void {
    fixture = TestBed.createComponent(CustomPlansListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const planCards = () => Array.from(el.querySelectorAll<HTMLElement>('.space-y-3 > .card'));

  beforeEach(async () => {
    silenceIonIconNoise();
    plans$ = new BehaviorSubject<Plan[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);
    planElos = {};
    currentProfile = null;

    customPlansFacade = {
      getCustomPlansLoading$: jest.fn(() => loading$),
      loadCustomPlans: jest.fn(),
    };
    plansElosFacade = {
      getPlanElo$: jest.fn((uid: string) => planElos[uid] ?? of(null)),
      requestLoadPlansElos: jest.fn(),
    };
    planFacade = { clearPlan: jest.fn(), setPlan: jest.fn() };
    planService = { makeCustomPlanForPlay: jest.fn() };
    router = { navigate: jest.fn() };
    loader = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(undefined) };
    loadingController = { create: jest.fn().mockResolvedValue(loader) };
    modal = {
      present: jest.fn().mockResolvedValue(undefined),
      onDidDismiss: jest.fn().mockResolvedValue({}),
    };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    appService = {
      getNameThemePuzzleByValue: jest.fn((v: string) => `Tema ${v}`),
      getThemePuzzleByValue: jest.fn((v: string) =>
        v === 'fork' ? { value: 'fork', img: 'fork.svg' } : undefined
      ),
    };

    await TestBed.configureTestingModule({
      imports: [CustomPlansListPage, translocoModule(TRANSLATIONS)],
      providers: [
        provideMockStore({
          selectors: [
            { selector: getProfile, value: null },
            { selector: getIsInitialized, value: true },
            { selector: getCountAllCustomPlans, value: 0 },
          ],
        }),
        { provide: CustomPlansService, useValue: { getMyPlans$: () => plans$ } },
        { provide: CustomPlansFacadeService, useValue: customPlansFacade },
        { provide: PlansElosFacadeService, useValue: plansElosFacade },
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: PlanService, useValue: planService },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return currentProfile;
            },
          },
        },
        { provide: AppService, useValue: appService },
        { provide: Router, useValue: router },
        { provide: LoadingController, useValue: loadingController },
        { provide: ModalController, useValue: modalController },
      ],
    })
      .overrideComponent(CustomPlansListPage, {
        set: {
          imports: [CommonModule, TranslocoPipe, SecondsToMinutesSecondsPipe, NavbarStub],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();

    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('según el estado de la sesión', () => {
    it('mientras la autenticación no responde solo muestra el indicador de carga (sin pedir login ni lista)', () => {
      setSession(null, false);
      render();

      expect(el.querySelector('.loading-spinner')).not.toBeNull();
      expect(textOf(el)).not.toContain('CUSTOM_PLANS.authRequired');
      expect(planCards()).toHaveLength(0);
    });

    it('sin sesión pide iniciar sesión, no ofrece crear rutinas y el botón abre el login', async () => {
      setSession(null);
      render();

      expect(textOf(el)).toContain('CUSTOM_PLANS.authRequired');
      expect(findButton(el, 'CUSTOM_PLANS.create')).toBeNull();

      findButton(el, 'CUSTOM_TRAINING.actions.login')?.click();
      await flushMicrotasks();

      expect(modalController.create).toHaveBeenCalledWith({
        component: LoginComponent,
        componentProps: { segmentEmailPassword: 'login' },
      });
      expect(modal.present).toHaveBeenCalledTimes(1);
      expect(modal.onDidDismiss).toHaveBeenCalledTimes(1);
    });

    it('con sesión y las rutinas cargándose muestra el esqueleto y ninguna tarjeta real', () => {
      setSession(PROFILE);
      loading$.next(true);
      plans$.next([customPlan('a')]);
      render();

      expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(4);
      expect(textOf(el)).not.toContain('Rutina a');
    });

    it('con sesión y sin rutinas muestra el vacío y el botón de crear la primera', () => {
      setSession(PROFILE);
      render();

      expect(textOf(el)).toContain('CUSTOM_PLANS.empty');
      findButton(el, 'CUSTOM_PLANS.createFirst')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans/create']);
    });

    it('con sesión ofrece crear una rutina desde el botón de escritorio y desde el flotante móvil', () => {
      setSession(PROFILE);
      plans$.next([customPlan('a')]);
      render();

      const createButtons = Array.from(el.querySelectorAll('button')).filter(
        (b) => iconNames(b).includes('add')
      );
      expect(createButtons).toHaveLength(2);
      createButtons.forEach((b) => b.click());

      expect(router.navigate).toHaveBeenCalledTimes(2);
      expect(router.navigate).toHaveBeenNthCalledWith(1, ['/puzzles/custom-plans/create']);
      expect(router.navigate).toHaveBeenNthCalledWith(2, ['/puzzles/custom-plans/create']);
    });

    it('al iniciar sesión con la pantalla abierta aparece la lista sin recargar', () => {
      setSession(null);
      render();
      expect(textOf(el)).toContain('CUSTOM_PLANS.authRequired');

      plans$.next([customPlan('a')]);
      setSession(PROFILE);
      fixture.detectChanges();

      expect(textOf(el)).not.toContain('CUSTOM_PLANS.authRequired');
      expect(planCards()).toHaveLength(1);
    });
  });

  describe('carga automática al iniciar sesión', () => {
    it('al autenticarse pide los elos de las rutinas y, si no hay rutinas en el store, las rutinas', () => {
      setSession(null);
      render();

      store.overrideSelector(getCountAllCustomPlans, 0);
      setSession(PROFILE);

      expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('user-1');
      expect(customPlansFacade.loadCustomPlans).toHaveBeenCalledWith('user-1');
    });

    it('si el store ya tiene rutinas, pide los elos pero no vuelve a descargar las rutinas', () => {
      setSession(null);
      render();

      store.overrideSelector(getCountAllCustomPlans, 4);
      setSession(PROFILE);

      expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('user-1');
      expect(customPlansFacade.loadCustomPlans).not.toHaveBeenCalled();
    });

    it('al abrir la pantalla con la sesión ya iniciada también carga', () => {
      setSession(PROFILE);
      render();

      expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('user-1');
      expect(customPlansFacade.loadCustomPlans).toHaveBeenCalledWith('user-1');
    });

    it('un cambio posterior del perfil (ya autenticado) no vuelve a cargar', () => {
      setSession(PROFILE);
      render();
      plansElosFacade.requestLoadPlansElos.mockClear();

      setSession({ ...PROFILE, elo: 1700 } as Profile);

      expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
    });

    it('sin sesión no carga nada', () => {
      setSession(null);
      render();

      expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
      expect(customPlansFacade.loadCustomPlans).not.toHaveBeenCalled();
    });

    it('al destruir la pantalla deja de escuchar la sesión', () => {
      setSession(null);
      render();

      fixture.destroy();
      setSession(PROFILE);

      expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
    });
  });

  describe('tarjetas de rutinas', () => {
    beforeEach(() => setSession(PROFILE));

    it('cada rutina muestra su título o "sin título", el número de bloques y la insignia de pública', () => {
      plans$.next([
        customPlan('a', { blocks: [makeBlock(), makeBlock()], isPublic: true }),
        customPlan('b', { title: undefined }),
      ]);
      render();

      const [first, second] = planCards();
      expect(textOf(first.querySelector('h3'))).toBe('Rutina a');
      expect(textOf(first)).toContain('2 COMMON.chess.blocks');
      expect(textOf(first)).toContain('CUSTOM_PLANS.public');
      expect(textOf(second.querySelector('h3'))).toBe('CUSTOM_PLANS.untitled');
      expect(textOf(second)).not.toContain('CUSTOM_PLANS.public');
    });

    it('muestra el elo y las veces jugada de cada rutina; sin elo todavía, un guion', () => {
      planElos['a'] = of({ total: 1420, timesPlayed: 3 });
      planElos['b'] = of({ timesPlayed: 0 });
      plans$.next([customPlan('a'), customPlan('b')]);
      render();

      const [a, b] = planCards();
      expect(textOf(a)).toContain('ELO 1420 · 3x');
      expect(textOf(b)).toContain('ELO - · 0x');
    });

    it('mientras los elos de una rutina no llegan muestra un esqueleto, y sin datos no muestra nada', () => {
      planElos['a'] = of(undefined);
      planElos['b'] = of(null);
      plans$.next([customPlan('a'), customPlan('b')]);
      render();

      const [a, b] = planCards();
      expect(a.querySelector('.skeleton')).not.toBeNull();
      expect(b.querySelector('.skeleton')).toBeNull();
      expect(textOf(b)).not.toContain('ELO');
    });

    it('el detalle de bloques muestra tema, icono y configuración según sea por tiempo, cantidad, ambos o sin límite', () => {
      plans$.next([
        customPlan('a', {
          blocks: [
            makeBlock({ theme: 'fork', time: 120, puzzlesCount: 0 }),
            makeBlock({ theme: 'all', time: -1, puzzlesCount: 10 }),
            makeBlock({ theme: 'weakness', time: 60, puzzlesCount: 5 }),
            makeBlock({ theme: 'sin-icono', time: -1, puzzlesCount: 0 }),
          ],
        }),
      ]);
      render();

      const rows = Array.from(planCards()[0].querySelectorAll('details .flex.items-center.gap-2'));
      expect(rows).toHaveLength(4);
      expect(textOf(rows[0])).toContain('Tema fork');
      expect(textOf(rows[0])).toContain('02:00');
      expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(
        '/assets/images/puzzle-themes/fork.svg'
      );
      expect(textOf(rows[1])).toContain('NEW_BLOCK.theme.random');
      expect(textOf(rows[1])).toContain('10 puz');
      expect(iconNames(rows[1])).toEqual(['shuffle']);
      expect(textOf(rows[2])).toContain('NEW_BLOCK.theme.weakness');
      expect(textOf(rows[2])).toContain('01:00 · 5 puz');
      expect(iconNames(rows[2])).toEqual(['trending-down']);
      expect(iconNames(rows[3])).toEqual(['infinite-outline']);
      expect(rows[3].querySelector('img')).toBeNull();
    });

    it('Editar navega a la edición de esa rutina', () => {
      plans$.next([customPlan('a'), customPlan('b')]);
      render();

      findButtonByIcon(planCards()[1], 'create')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/custom-plans/edit', 'b']);
    });

    it('el enlace de inicio navega a /home', () => {
      render();

      el.querySelector<HTMLAnchorElement>('.breadcrumbs a')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('Jugar una rutina', () => {
    const plan = customPlan('a', { blocks: [makeBlock({ time: 300 })] });
    const planToPlay = makePlan({ uid: 'play-1', planType: 'custom' });

    beforeEach(() => {
      setSession({ ...PROFILE, elos: { plan5Total: 1800 } } as unknown as Profile);
      plans$.next([plan]);
      planService.makeCustomPlanForPlay.mockResolvedValue(planToPlay);
    });

    it('muestra el cargador, prepara la rutina con el elo de arranque, limpia el plan anterior, deja el nuevo y entra a entrenar', async () => {
      render();

      findButtonByIcon(planCards()[0], 'play')?.click();
      await flushMicrotasks();

      expect(loadingController.create).toHaveBeenCalledWith({ message: 'Cargando ejercicios' });
      expect(loader.present).toHaveBeenCalledTimes(1);
      expect(planService.makeCustomPlanForPlay).toHaveBeenCalledWith(plan, 1800, expect.any(Function));
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(planFacade.setPlan).toHaveBeenCalledWith(planToPlay);
      expect(planFacade.clearPlan.mock.invocationCallOrder[0]).toBeLessThan(
        planFacade.setPlan.mock.invocationCallOrder[0]
      );
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
      // El cargador se cierra antes de cambiar de pantalla.
      expect(loader.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
        router.navigate.mock.invocationCallOrder[0]
      );
    });

    it('mientras descarga actualiza el mensaje del cargador con el avance', async () => {
      render();
      findButtonByIcon(planCards()[0], 'play')?.click();
      await flushMicrotasks();

      const onProgress = planService.makeCustomPlanForPlay.mock.calls[0][2] as (
        loaded: number,
        total: number
      ) => void;
      onProgress(2, 5);

      expect(loader.message).toBe('Cargando 2 de 5');
    });

    it('si falla la preparación cierra el cargador, no navega ni cambia el plan y propaga el error', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      planService.makeCustomPlanForPlay.mockRejectedValue(new Error('sin red'));
      render();

      await expect(component.play(plan)).rejects.toThrow('sin red');

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalled();
      expect(planFacade.clearPlan).not.toHaveBeenCalled();
      expect(planFacade.setPlan).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    describe.each(ELO_TO_START_CASES)('elo de arranque', (testCase) => {
      it(testCase.name, async () => {
        currentProfile = testCase.profileElos === null ? null : ({ uid: 'u', elos: testCase.profileElos } as unknown as Profile);
        render();

        await component.play(
          customPlan('x', { blocks: testCase.blockTimes.map((time) => makeBlock({ time })) })
        );

        expect(planService.makeCustomPlanForPlay.mock.calls[0][1]).toBe(testCase.expected);
      });
    });

    it('una rutina de 20 minutos arranca con el elo de plan20', async () => {
      currentProfile = { uid: 'u', elos: { plan5Total: 1111, plan20Total: 3333 } } as unknown as Profile;
      render();

      await component.play(customPlan('x', { blocks: [makeBlock({ time: 1200 })] }));

      expect(planService.makeCustomPlanForPlay.mock.calls[0][1]).toBe(3333);
    });
  });

  describe('utilidades de presentación', () => {
    beforeEach(() => {
      setSession(PROFILE);
      render();
    });

    it('formatDate devuelve vacío sin fecha y la fecha local si la hay', () => {
      expect(component.formatDate(0)).toBe('');
      const ts = new Date(2026, 0, 15, 10).getTime();
      expect(component.formatDate(ts)).toBe(new Date(ts).toLocaleDateString());
    });

    it('getThemeName usa las etiquetas de aleatorio y debilidades y el catálogo para el resto, con el valor como último recurso', () => {
      appService.getNameThemePuzzleByValue.mockImplementation((v: string) => (v === 'fork' ? 'Horquilla' : ''));

      expect(component.getThemeName('all')).toBe('NEW_BLOCK.theme.random');
      expect(component.getThemeName('weakness')).toBe('NEW_BLOCK.theme.weakness');
      expect(component.getThemeName('fork')).toBe('Horquilla');
      expect(component.getThemeName('raro')).toBe('raro');
    });

    it('getBlockConfig clasifica el bloque por tiempo, por cantidad, ambos o sin límite', () => {
      expect(component.getBlockConfig(makeBlock({ time: 60, puzzlesCount: 0 }))).toEqual({ type: 'time', time: 60 });
      expect(component.getBlockConfig(makeBlock({ time: -1, puzzlesCount: 8 }))).toEqual({ type: 'puzzles', puzzles: 8 });
      expect(component.getBlockConfig(makeBlock({ time: 60, puzzlesCount: 8 }))).toEqual({ type: 'both', time: 60, puzzles: 8 });
      expect(component.getBlockConfig(makeBlock({ time: -1, puzzlesCount: 0 }))).toEqual({ type: 'infinite' });
    });
  });
});
