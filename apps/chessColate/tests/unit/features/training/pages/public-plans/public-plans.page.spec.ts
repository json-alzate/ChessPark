import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, map } from 'rxjs';

import { LoadingController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { PlanInteraction, PublicPlan, PublicPlanFilter } from '@chesspark/models';
import { getProfile, PlanFacadeService, PublicPlansFacadeService } from '@chesspark/state';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { PlanService } from '@features/training/services/plan.service';
import { PublicPlansService } from '@features/training/services/public-plans.service';

import { PublicPlansPage } from '@features/training/pages/public-plans/public-plans.page';

import {
  ELO_TO_START_CASES,
  findButton,
  flushMicrotasks,
  makeBlock,
  makePlan,
  makePublicPlan,
  silenceIonIconNoise,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

@Component({ selector: 'app-navbar', standalone: true, template: '' })
class NavbarStub {}

/** Tarjeta mínima: muestra el título y reexpone los tres eventos con botones. */
@Component({
  selector: 'app-public-plan-item',
  standalone: true,
  template: `
    <span class="title">{{ plan.title }}</span>
    <span class="liked">{{ plan.userInteraction?.liked ? 'liked' : 'no-liked' }}</span>
    <button class="play" (click)="play.emit(plan)">play</button>
    <button class="like" (click)="toggleLike.emit({ plan, liked: true })">like</button>
    <button class="save" (click)="toggleSaved.emit({ plan, saved: true })">save</button>
  `,
})
class PublicPlanItemStub {
  @Input() plan!: PublicPlan;
  @Output() play = new EventEmitter<PublicPlan>();
  @Output() toggleLike = new EventEmitter<{ plan: PublicPlan; liked: boolean }>();
  @Output() toggleSaved = new EventEmitter<{ plan: PublicPlan; saved: boolean }>();
}

const TRANSLATIONS = {
  PUZZLES: {
    loader: {
      loadingPuzzles: 'Cargando ejercicios',
      loadingPuzzlesProgress: 'Cargando {{loaded}} de {{total}}',
    },
  },
};

function pub(uid: string, overrides: Partial<PublicPlan> = {}): PublicPlan {
  return makePublicPlan({ uid, title: `Plan ${uid}`, ...overrides });
}

function interaction(planUid: string, overrides: Partial<PlanInteraction> = {}): PlanInteraction {
  return {
    uid: `i-${planUid}`,
    uidUser: 'user-1',
    planUid,
    liked: false,
    played: false,
    saved: false,
    ...overrides,
  };
}

describe('PublicPlansPage', () => {
  let fixture: ComponentFixture<PublicPlansPage>;
  let component: PublicPlansPage;
  let el: HTMLElement;

  let publicPlans$: BehaviorSubject<PublicPlan[]>;
  let loading$: BehaviorSubject<boolean>;
  let loadingMore$: BehaviorSubject<boolean>;
  let error$: BehaviorSubject<string | null>;
  let hasMore$: BehaviorSubject<boolean>;
  let filter$: BehaviorSubject<PublicPlanFilter>;
  let interactions$: BehaviorSubject<PlanInteraction[]>;
  let liked$: BehaviorSubject<string[]>;
  let played$: BehaviorSubject<string[]>;
  let saved$: BehaviorSubject<string[]>;
  let loadingInteractions$: BehaviorSubject<boolean>;
  /** Planes que el store "tiene" por uid para las pestañas de interacciones. */
  let planStore$: BehaviorSubject<Record<string, PublicPlan>>;

  let currentProfile: { uid: string; elos?: Record<string, number> } | null;
  let facade: Record<string, jest.Mock>;
  let planFacade: { clearPlan: jest.Mock; setPlan: jest.Mock };
  let publicPlansService: { enrichPlansWithInteractions: jest.Mock; preparePlanForPlay: jest.Mock };
  let analytics: { logEvent: jest.Mock };
  let router: { navigate: jest.Mock };
  let loader: { present: jest.Mock; dismiss: jest.Mock; message?: string };

  function render(): void {
    fixture = TestBed.createComponent(PublicPlansPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const items = () => Array.from(el.querySelectorAll<HTMLElement>('app-public-plan-item'));
  const titles = () => items().map((i) => textOf(i.querySelector('.title')));
  const click = (label: string) => {
    findButton(el, label)?.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    silenceIonIconNoise();
    publicPlans$ = new BehaviorSubject<PublicPlan[]>([]);
    loading$ = new BehaviorSubject(false);
    loadingMore$ = new BehaviorSubject(false);
    error$ = new BehaviorSubject<string | null>(null);
    hasMore$ = new BehaviorSubject(false);
    filter$ = new BehaviorSubject<PublicPlanFilter>('recent');
    interactions$ = new BehaviorSubject<PlanInteraction[]>([]);
    liked$ = new BehaviorSubject<string[]>([]);
    played$ = new BehaviorSubject<string[]>([]);
    saved$ = new BehaviorSubject<string[]>([]);
    loadingInteractions$ = new BehaviorSubject(false);
    planStore$ = new BehaviorSubject<Record<string, PublicPlan>>({});
    currentProfile = { uid: 'user-1' };

    facade = {
      getPublicPlans$: jest.fn(() => publicPlans$),
      getPublicPlansLoading$: jest.fn(() => loading$),
      getPublicPlansLoadingMore$: jest.fn(() => loadingMore$),
      getPublicPlansError$: jest.fn(() => error$),
      clearError: jest.fn(),
      getPublicPlansHasMore$: jest.fn(() => hasMore$),
      getPublicPlansFilter$: jest.fn(() => filter$),
      getUserInteractions$: jest.fn(() => interactions$),
      getUserLikedPlans$: jest.fn(() => liked$),
      getUserPlayedPlans$: jest.fn(() => played$),
      getUserSavedPlans$: jest.fn(() => saved$),
      getLoadingInteractions$: jest.fn(() => loadingInteractions$),
      getInteractionPlans$: jest.fn((uids: string[]) =>
        planStore$.pipe(map((all) => uids.map((u) => all[u]).filter(Boolean)))
      ),
      loadInteractionPlans: jest.fn(),
      setFilter: jest.fn(),
      loadPublicPlans: jest.fn(),
      loadMorePublicPlans: jest.fn(),
      togglePlanLike: jest.fn(),
      togglePlanSaved: jest.fn(),
      markPlanAsPlayed: jest.fn(),
    };
    planFacade = { clearPlan: jest.fn(), setPlan: jest.fn() };
    publicPlansService = {
      enrichPlansWithInteractions: jest.fn((plans: PublicPlan[], ints: PlanInteraction[]) =>
        plans.map((p) => ({ ...p, userInteraction: ints.find((i) => i.planUid === p.uid) }))
      ),
      preparePlanForPlay: jest.fn().mockResolvedValue(makePlan({ uid: 'to-play' })),
    };
    analytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
    router = { navigate: jest.fn() };
    loader = { present: jest.fn().mockResolvedValue(undefined), dismiss: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [PublicPlansPage, translocoModule(TRANSLATIONS)],
      providers: [
        provideMockStore({ selectors: [{ selector: getProfile, value: null }] }),
        { provide: PublicPlansFacadeService, useValue: facade },
        { provide: PublicPlansService, useValue: publicPlansService },
        { provide: PlanService, useValue: {} },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return currentProfile;
            },
          },
        },
        { provide: PlanFacadeService, useValue: planFacade },
        { provide: Router, useValue: router },
        { provide: LoadingController, useValue: { create: jest.fn().mockResolvedValue(loader) } },
        { provide: AnalyticsService, useValue: analytics },
      ],
    })
      .overrideComponent(PublicPlansPage, {
        set: {
          imports: [CommonModule, TranslocoPipe, NavbarStub, PublicPlanItemStub],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();

  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pestaña de rutinas públicas', () => {
    it('muestra una tarjeta por rutina con la interacción del usuario ya aplicada', () => {
      interactions$.next([interaction('a', { liked: true })]);
      publicPlans$.next([pub('a'), pub('b')]);
      render();

      expect(titles()).toEqual(['Plan a', 'Plan b']);
      expect(textOf(items()[0].querySelector('.liked'))).toBe('liked');
      expect(textOf(items()[1].querySelector('.liked'))).toBe('no-liked');
    });

    it('vuelve a enriquecer cuando cambian las rutinas o las interacciones', () => {
      publicPlans$.next([pub('a')]);
      render();
      expect(textOf(items()[0].querySelector('.liked'))).toBe('no-liked');

      interactions$.next([interaction('a', { liked: true })]);
      fixture.detectChanges();
      expect(textOf(items()[0].querySelector('.liked'))).toBe('liked');

      publicPlans$.next([pub('a'), pub('c')]);
      fixture.detectChanges();
      expect(titles()).toEqual(['Plan a', 'Plan c']);
    });

    it('mientras carga muestra esqueletos y ninguna tarjeta', () => {
      loading$.next(true);
      publicPlans$.next([pub('a')]);
      render();

      expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(items()).toHaveLength(0);
    });

    it('sin rutinas y sin carga en curso muestra el mensaje de vacío', () => {
      render();

      expect(textOf(el)).toContain('PUBLIC_PLANS.empty');
      expect(items()).toHaveLength(0);
    });

    it('si la carga falló no dice que no hay sesiones: avisa del error y deja reintentar', async () => {
      error$.next('sin red');
      filter$.next('mostLiked');
      render();

      expect(textOf(el)).toContain('PUBLIC_PLANS.loadError');
      expect(textOf(el)).not.toContain('PUBLIC_PLANS.empty');

      (el.querySelector('[data-testid=retry-load]') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(facade['clearError']).toHaveBeenCalledTimes(1);
      expect(facade['loadPublicPlans']).toHaveBeenCalledWith('mostLiked', 20);
    });

    it('con sesiones ya cargadas un error posterior no tapa la lista', () => {
      publicPlans$.next([pub('a')]);
      error$.next('sin red');
      render();

      expect(items()).toHaveLength(1);
      expect(textOf(el)).not.toContain('PUBLIC_PLANS.loadError');
    });

    it('mientras carga más rutinas muestra el indicador al final', () => {
      publicPlans$.next([pub('a')]);
      loadingMore$.next(true);
      render();

      expect(el.querySelector('.loading-sm')).not.toBeNull();
    });

    it('el filtro activo se resalta y elegir otro pide de nuevo las rutinas con ese filtro (20 por tanda)', () => {
      filter$.next('mostPlayed');
      render();
      const filterButton = (label: string) => findButton(el, label) as HTMLButtonElement;

      expect(filterButton('PUBLIC_PLANS.filters.mostPlayed').className).toContain('border-warning');
      expect(filterButton('PUBLIC_PLANS.filters.recent').className).toContain('border-transparent');

      filterButton('PUBLIC_PLANS.filters.mostLiked').click();

      expect(facade['setFilter']).toHaveBeenCalledWith('mostLiked');
      expect(facade['loadPublicPlans']).toHaveBeenCalledWith('mostLiked', 20);
      expect(facade['setFilter'].mock.invocationCallOrder[0]).toBeLessThan(
        facade['loadPublicPlans'].mock.invocationCallOrder[0]
      );
    });

    it('el enlace de inicio navega a /home', () => {
      render();

      el.querySelector<HTMLAnchorElement>('.breadcrumbs a')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('al destruir la pantalla deja de enriquecer', () => {
      render();
      publicPlansService.enrichPlansWithInteractions.mockClear();

      fixture.destroy();
      publicPlans$.next([pub('z')]);

      expect(publicPlansService.enrichPlansWithInteractions).not.toHaveBeenCalled();
    });
  });

  describe('desplazamiento infinito', () => {
    function scrollEvent(): { event: Event; complete: jest.Mock } {
      const complete = jest.fn();
      const target = el.querySelector('ion-infinite-scroll') as HTMLElement;
      (target as unknown as { complete: jest.Mock }).complete = complete;
      return { event: { target } as unknown as Event, complete };
    }

    it('con más rutinas pide la siguiente tanda y termina el gesto cuando acaba de cargar', () => {
      publicPlans$.next([pub('a')]);
      hasMore$.next(true);
      render();
      const { event, complete } = scrollEvent();
      loadingMore$.next(true);

      component.onInfiniteScroll(event);

      expect(facade['loadMorePublicPlans']).toHaveBeenCalledTimes(1);
      expect(complete).not.toHaveBeenCalled();

      loadingMore$.next(false);

      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('sin más rutinas termina el gesto de inmediato y no pide nada', () => {
      publicPlans$.next([pub('a')]);
      hasMore$.next(false);
      render();
      const { event, complete } = scrollEvent();

      component.onInfiniteScroll(event);

      expect(facade['loadMorePublicPlans']).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('el evento ionInfinite de la lista llega al manejador', () => {
      publicPlans$.next([pub('a')]);
      hasMore$.next(true);
      render();
      scrollEvent();

      el.querySelector('ion-infinite-scroll')?.dispatchEvent(new CustomEvent('ionInfinite'));

      expect(facade['loadMorePublicPlans']).toHaveBeenCalledTimes(1);
    });
  });

  describe('pestaña de mis interacciones', () => {
    beforeEach(() => {
      planStore$.next({
        l1: pub('l1', { title: 'Me gustó' }),
        p1: pub('p1', { title: 'La jugué' }),
        s1: pub('s1', { title: 'La guardé' }),
      });
      liked$.next(['l1']);
      played$.next(['p1']);
      saved$.next(['s1']);
    });

    it('empieza en "me gustan"; cambiar de subpestaña muestra jugadas y guardadas', () => {
      render();
      click('PUBLIC_PLANS.tabs.myInteractions');

      expect(component.activeTab).toBe('interactions');
      expect(component.activeInteractionTab).toBe('liked');
      expect(titles()).toEqual(['Me gustó']);

      click('PUBLIC_PLANS.interactions.played');
      expect(titles()).toEqual(['La jugué']);

      click('PUBLIC_PLANS.interactions.saved');
      expect(titles()).toEqual(['La guardé']);
    });

    it('la pestaña pública deja de mostrarse al pasar a interacciones y vuelve al regresar', () => {
      publicPlans$.next([pub('a')]);
      render();
      expect(titles()).toEqual(['Plan a']);

      click('PUBLIC_PLANS.tabs.myInteractions');
      expect(titles()).not.toContain('Plan a');
      expect(findButton(el, 'PUBLIC_PLANS.filters.recent')).toBeNull();

      click('PUBLIC_PLANS.tabs.public');
      expect(titles()).toEqual(['Plan a']);
    });

    it('pide al store los planes de cada lista de uids, y solo si la lista no está vacía', () => {
      played$.next([]);
      render();

      expect(facade['loadInteractionPlans']).toHaveBeenCalledWith(['l1']);
      expect(facade['loadInteractionPlans']).toHaveBeenCalledWith(['s1']);
      expect(facade['loadInteractionPlans']).not.toHaveBeenCalledWith([]);
      expect(facade['getInteractionPlans$']).toHaveBeenCalledWith(['l1']);
    });

    it('cuando cambian los uids vuelve a pedir los planes', () => {
      render();
      facade['loadInteractionPlans'].mockClear();

      liked$.next(['l1', 'l2']);

      expect(facade['loadInteractionPlans']).toHaveBeenCalledWith(['l1', 'l2']);
    });

    it('cada lista queda enriquecida con las interacciones del usuario', () => {
      interactions$.next([interaction('l1', { liked: true })]);
      render();
      click('PUBLIC_PLANS.tabs.myInteractions');

      expect(textOf(items()[0].querySelector('.liked'))).toBe('liked');
    });

    it('con la subpestaña vacía muestra el mensaje de vacío', () => {
      liked$.next([]);
      render();
      click('PUBLIC_PLANS.tabs.myInteractions');

      expect(textOf(el)).toContain('PUBLIC_PLANS.interactions.empty');
      expect(items()).toHaveLength(0);
    });

    it('mientras carga las interacciones y no hay nada que mostrar enseña esqueletos; si ya hay planes, los muestra', () => {
      liked$.next([]);
      loadingInteractions$.next(true);
      render();
      click('PUBLIC_PLANS.tabs.myInteractions');

      expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(textOf(el)).not.toContain('PUBLIC_PLANS.interactions.empty');

      liked$.next(['l1']);
      fixture.detectChanges();

      expect(titles()).toEqual(['Me gustó']);
    });

    it('getCurrentInteractionPlans devuelve la lista de la subpestaña activa', () => {
      render();

      component.activeInteractionTab = 'played';
      expect(component.getCurrentInteractionPlans().map((p) => p.uid)).toEqual(['p1']);
      component.activeInteractionTab = 'saved';
      expect(component.getCurrentInteractionPlans().map((p) => p.uid)).toEqual(['s1']);
      component.activeInteractionTab = 'bogus' as never;
      expect(component.getCurrentInteractionPlans()).toEqual([]);
    });
  });

  describe('jugar una rutina pública', () => {
    const plan = pub('a', {
      title: 'Mates',
      uidUser: 'author-9',
      blocks: [makeBlock({ time: 300, puzzles: undefined }), makeBlock({ time: 150, puzzles: undefined })],
    });

    beforeEach(() => {
      publicPlans$.next([plan]);
    });

    it('al pulsar Jugar en la tarjeta muestra el cargador, prepara la rutina, la marca como jugada, deja el plan nuevo y entra a entrenar', async () => {
      currentProfile = { uid: 'user-1', elos: { plan10Total: 1800 } };
      render();

      items()[0].querySelector<HTMLButtonElement>('.play')?.click();
      await flushMicrotasks();

      expect(publicPlansService.preparePlanForPlay).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'a' }),
        1800,
        expect.any(Function)
      );
      expect(loader.present).toHaveBeenCalledTimes(1);
      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(facade['markPlanAsPlayed']).toHaveBeenCalledWith('user-1', 'a');
      expect(planFacade.clearPlan).toHaveBeenCalledTimes(1);
      expect(planFacade.setPlan).toHaveBeenCalledWith(expect.objectContaining({ uid: 'to-play' }));
      expect(planFacade.clearPlan.mock.invocationCallOrder[0]).toBeLessThan(
        planFacade.setPlan.mock.invocationCallOrder[0]
      );
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('registra routine_started con el autor, los minutos y el número de bloques', async () => {
      render();

      await component.onPlayPlan(plan);

      expect(analytics.logEvent).toHaveBeenCalledWith('routine_started', {
        routine_kind: 'public',
        routine_minutes: 8, // 450 s
        routine_category: '',
        routine_name: 'Mates',
        routine_uid: 'a',
        author_uid: 'author-9',
        blocks_count: 2,
      });
    });

    it('una rutina sin título se registra como "Pública" y sin autor, con autor vacío', async () => {
      render();

      await component.onPlayPlan({ ...plan, title: undefined, uidUser: undefined } as unknown as PublicPlan);

      expect(analytics.logEvent).toHaveBeenCalledWith(
        'routine_started',
        expect.objectContaining({ routine_name: 'Pública', author_uid: '' })
      );
    });

    it('sin sesión juega igual pero no marca la rutina como jugada', async () => {
      currentProfile = null;
      render();

      await component.onPlayPlan(plan);

      expect(facade['markPlanAsPlayed']).not.toHaveBeenCalled();
      expect(planFacade.setPlan).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/puzzles/training']);
    });

    it('actualiza el mensaje del cargador con el avance de la descarga', async () => {
      render();

      await component.onPlayPlan(plan);
      const onProgress = publicPlansService.preparePlanForPlay.mock.calls[0][2] as (
        loaded: number,
        total: number
      ) => void;
      onProgress(3, 8);

      expect(loader.message).toBe('Cargando 3 de 8');
    });

    it('si falla la preparación cierra el cargador, no marca jugada, no cambia el plan, no navega y propaga el error', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      publicPlansService.preparePlanForPlay.mockRejectedValue(new Error('sin red'));
      render();

      await expect(component.onPlayPlan(plan)).rejects.toThrow('sin red');

      expect(loader.dismiss).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalled();
      expect(facade['markPlanAsPlayed']).not.toHaveBeenCalled();
      expect(planFacade.setPlan).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    describe.each(ELO_TO_START_CASES)('elo de arranque', (testCase) => {
      it(testCase.name, async () => {
        currentProfile =
          testCase.profileElos === null
            ? null
            : ({ uid: 'u', elos: testCase.profileElos } as { uid: string; elos: Record<string, number> });
        render();

        await component.onPlayPlan(
          pub('x', { blocks: testCase.blockTimes.map((time) => makeBlock({ time, puzzles: undefined })) })
        );

        expect(publicPlansService.preparePlanForPlay.mock.calls[0][1]).toBe(testCase.expected);
      });
    });

    it('una rutina de 20 minutos arranca con el elo de plan20', async () => {
      currentProfile = { uid: 'u', elos: { plan5Total: 1111, plan20Total: 3333 } };
      render();

      await component.onPlayPlan(pub('x', { blocks: [makeBlock({ time: 1200, puzzles: undefined })] }));

      expect(publicPlansService.preparePlanForPlay.mock.calls[0][1]).toBe(3333);
    });
  });

  describe('me gusta y guardar', () => {
    beforeEach(() => {
      publicPlans$.next([pub('a')]);
    });

    it('me gusta con sesión lo envía al store con el usuario, la rutina y el nuevo estado', () => {
      render();

      items()[0].querySelector<HTMLButtonElement>('.like')?.click();

      expect(facade['togglePlanLike']).toHaveBeenCalledWith('user-1', 'a', true);
    });

    it('sin sesión el me gusta se ignora', () => {
      currentProfile = null;
      render();

      items()[0].querySelector<HTMLButtonElement>('.like')?.click();

      expect(facade['togglePlanLike']).not.toHaveBeenCalled();
    });

    it('guardar con sesión lo envía al store y lo registra en analítica', () => {
      render();

      items()[0].querySelector<HTMLButtonElement>('.save')?.click();

      expect(facade['togglePlanSaved']).toHaveBeenCalledWith('user-1', 'a', true);
      expect(analytics.logEvent).toHaveBeenCalledWith('public_plan_saved', {
        plan_uid: 'a',
        saved: true,
      });
    });

    it('sin sesión guardar se ignora y no genera analítica', () => {
      currentProfile = null;
      render();

      items()[0].querySelector<HTMLButtonElement>('.save')?.click();

      expect(facade['togglePlanSaved']).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });
  });
});
