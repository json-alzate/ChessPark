import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';

import { getIsInitialized, getProfile, PublicPlansFacadeService } from '@chesspark/state';

import { PublicPlansGuard } from '@features/training/guards/public-plans.guard';

describe('PublicPlansGuard', () => {
  let guard: PublicPlansGuard;
  let initialized$: BehaviorSubject<boolean>;
  let profile$: BehaviorSubject<{ uid: string } | null>;

  const facade = { loadPublicPlans: jest.fn(), loadUserInteractions: jest.fn() };
  const store = {
    select: jest.fn((selector: unknown) => {
      if (selector === getIsInitialized) return initialized$;
      if (selector === getProfile) return profile$;
      throw new Error('selector inesperado');
    }),
  };

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

    TestBed.configureTestingModule({
      providers: [
        PublicPlansGuard,
        { provide: Store, useValue: store },
        { provide: PublicPlansFacadeService, useValue: facade },
      ],
    });
    guard = TestBed.inject(PublicPlansGuard);
  });

  it('siempre permite el acceso', () => {
    expect(activate()).toBe(true);

    profile$.next(null);
    expect(activate()).toBe(true);
  });

  it('con sesión carga los 20 planes públicos más recientes y las interacciones del usuario', () => {
    activate();

    expect(facade.loadPublicPlans).toHaveBeenCalledWith('recent', 20);
    expect(facade.loadUserInteractions).toHaveBeenCalledWith('u1');
  });

  it('sin sesión carga los planes públicos pero no las interacciones', () => {
    profile$.next(null);

    activate();

    expect(facade.loadPublicPlans).toHaveBeenCalledWith('recent', 20);
    expect(facade.loadUserInteractions).not.toHaveBeenCalled();
  });

  it('un perfil sin uid no pide interacciones', () => {
    profile$.next({ uid: '' });

    activate();

    expect(facade.loadPublicPlans).toHaveBeenCalledTimes(1);
    expect(facade.loadUserInteractions).not.toHaveBeenCalled();
  });

  it('espera a que se inicialice la autenticación antes de cargar', () => {
    initialized$.next(false);

    expect(activate()).toBe(true);
    expect(facade.loadPublicPlans).not.toHaveBeenCalled();

    initialized$.next(true);

    expect(facade.loadPublicPlans).toHaveBeenCalledTimes(1);
    expect(facade.loadUserInteractions).toHaveBeenCalledWith('u1');
  });

  it('carga una sola vez por activación aunque la inicialización vuelva a emitir', () => {
    activate();

    initialized$.next(true);
    initialized$.next(true);

    expect(facade.loadPublicPlans).toHaveBeenCalledTimes(1);
  });
});
