import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';

import { getIsInitialized, getProfile } from '@chesspark/state';

import { AuthGuard } from '@core/guards/auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let initialized$: Subject<boolean>;
  let profile$: Observable<unknown>;
  const router = { navigate: jest.fn() };
  const store = {
    select: jest.fn((selector: unknown) =>
      selector === getIsInitialized ? initialized$ : profile$
    ),
  };

  /** Ejecuta el guard y recoge lo que emite. */
  const run = () => {
    const emitted: boolean[] = [];
    let completed = false;
    guard.canActivate().subscribe({
      next: (value) => emitted.push(value),
      complete: () => (completed = true),
    });
    return { emitted, isCompleted: () => completed };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    initialized$ = new BehaviorSubject<boolean>(true);
    profile$ = new BehaviorSubject<unknown>({ uid: 'u1' });

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Store, useValue: store },
        { provide: Router, useValue: router },
      ],
    });
    guard = TestBed.inject(AuthGuard);
  });

  it('deja pasar a quien tiene sesión, sin redirigir', () => {
    const { emitted, isCompleted } = run();

    expect(emitted).toEqual([true]);
    expect(isCompleted()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sin perfil bloquea el acceso y redirige a /home', () => {
    profile$ = new BehaviorSubject<unknown>(null);

    const { emitted } = run();

    expect(emitted).toEqual([false]);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('un perfil sin uid cuenta como no autenticado', () => {
    profile$ = new BehaviorSubject<unknown>({ uid: '' });

    const { emitted } = run();

    expect(emitted).toEqual([false]);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('espera a que la autenticación se inicialice antes de decidir', () => {
    initialized$ = new BehaviorSubject<boolean>(false);

    const { emitted } = run();
    expect(emitted).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();

    (initialized$ as BehaviorSubject<boolean>).next(true);

    expect(emitted).toEqual([true]);
  });

  it('decide con el perfil vigente en el momento en que se inicializa', () => {
    initialized$ = new Subject<boolean>();
    const profile = new BehaviorSubject<unknown>(null);
    profile$ = profile;

    const { emitted } = run();
    // La sesión se restaura mientras se inicializa: el perfil llega antes de la señal
    profile.next({ uid: 'u1' });
    initialized$.next(false);
    initialized$.next(true);

    expect(emitted).toEqual([true]);
  });

  it('si la inicialización tarda más de 5 s, deniega y redirige a /home', fakeAsync(() => {
    initialized$ = new Subject<boolean>();

    const { emitted } = run();
    tick(4999);
    expect(emitted).toEqual([]);

    tick(1);

    expect(emitted).toEqual([false]);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  }));

  it('si se inicializa justo antes de los 5 s, no salta el temporizador', fakeAsync(() => {
    const init = new Subject<boolean>();
    initialized$ = init;

    const { emitted } = run();
    tick(4000);
    init.next(true);
    tick(5000);

    expect(emitted).toEqual([true]);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('si falla la lectura del perfil, deniega y redirige en vez de propagar el error', () => {
    profile$ = throwError(() => new Error('store roto'));

    const { emitted, isCompleted } = run();

    expect(emitted).toEqual([false]);
    expect(isCompleted()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
