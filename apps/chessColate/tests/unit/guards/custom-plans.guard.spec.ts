import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';

import {
  getCountAllCustomPlans,
  getIsInitialized,
  getProfile,
  loadCustomPlans,
  PlansElosFacadeService,
} from '@chesspark/state';

import { CustomPlansGuard } from '@guards/custom-plans.guard';

describe('CustomPlansGuard', () => {
  let guard: CustomPlansGuard;
  let initialized$: BehaviorSubject<boolean>;
  let profile$: BehaviorSubject<{ uid: string } | null>;
  let count$: BehaviorSubject<number>;

  const dispatch = jest.fn();
  const plansElosFacade = { requestLoadPlansElos: jest.fn() };
  const store = {
    select: jest.fn((selector: unknown) => {
      if (selector === getIsInitialized) return initialized$;
      if (selector === getProfile) return profile$;
      if (selector === getCountAllCustomPlans) return count$;
      throw new Error('selector inesperado');
    }),
    dispatch,
  };

  /** Resuelve el valor que emite el guard. */
  const activate = () => {
    let result: unknown;
    (guard.canActivate() as { subscribe: (fn: (v: unknown) => void) => void }).subscribe(
      (value) => (result = value)
    );
    return result;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    initialized$ = new BehaviorSubject<boolean>(true);
    profile$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'u1' });
    count$ = new BehaviorSubject<number>(0);

    TestBed.configureTestingModule({
      providers: [
        CustomPlansGuard,
        { provide: Store, useValue: store },
        { provide: PlansElosFacadeService, useValue: plansElosFacade },
      ],
    });
    guard = TestBed.inject(CustomPlansGuard);
  });

  it('siempre permite el acceso al listado, haya o no sesión', () => {
    expect(activate()).toBe(true);

    profile$.next(null);
    expect(activate()).toBe(true);
  });

  it('con sesión carga los elos del usuario y, si no hay planes cargados, sus planes personalizados', () => {
    activate();

    expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('u1');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(loadCustomPlans({ uidUser: 'u1' }));
  });

  it('si ya hay planes cargados no los vuelve a pedir, pero sí carga los elos', () => {
    count$.next(3);

    activate();

    expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('u1');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sin sesión no carga nada', () => {
    profile$.next(null);

    activate();

    expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('un perfil sin uid se trata como sin sesión', () => {
    profile$.next({ uid: '' });

    activate();

    expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('hasta que la autenticación no se inicializa no carga nada; al hacerlo, carga', () => {
    initialized$.next(false);

    expect(activate()).toBe(true);
    expect(plansElosFacade.requestLoadPlansElos).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();

    initialized$.next(true);

    expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledWith('u1');
    expect(dispatch).toHaveBeenCalledWith(loadCustomPlans({ uidUser: 'u1' }));
  });

  it('carga los planes una sola vez aunque el contador o el perfil vuelvan a emitir', () => {
    activate();

    count$.next(0);
    profile$.next({ uid: 'u1' });
    count$.next(0);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(plansElosFacade.requestLoadPlansElos).toHaveBeenCalledTimes(1);
  });
});
