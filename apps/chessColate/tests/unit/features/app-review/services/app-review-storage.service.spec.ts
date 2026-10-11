import { AppReviewStorageService } from '@features/app-review/services/app-review-storage.service';
import { AppReviewState, DEFAULT_APP_REVIEW_STATE } from '@features/app-review/utils/app-review.util';

const KEY = 'chessColate_app_review_state';

describe('AppReviewStorageService', () => {
  let service: AppReviewStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new AppReviewStorageService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sin nada guardado devuelve el estado inicial', () => {
    expect(service.getState()).toEqual(DEFAULT_APP_REVIEW_STATE);
  });

  it('el estado inicial devuelto es una copia: mutarlo no contamina el valor por defecto', () => {
    const state = service.getState();
    state.completedRoutines = 99;

    expect(service.getState().completedRoutines).toBe(0);
    expect(DEFAULT_APP_REVIEW_STATE.completedRoutines).toBe(0);
  });

  it('lo guardado se recupera igual', () => {
    const state: AppReviewState = {
      completedRoutines: 5,
      distinctDaysUsed: 3,
      lastRoutineDate: '2026-06-14',
      lastCountedPlanUid: 'plan-9',
      firstUseDate: '2026-06-01',
      lastReviewRequestDate: '2026-03-01',
      eligibleSince: '2026-06-10',
      routinesSinceEligible: 2,
    };

    service.saveState(state);

    expect(service.getState()).toEqual(state);
  });

  it('completa con valores por defecto los campos que faltan en estados de versiones previas', () => {
    localStorage.setItem(KEY, JSON.stringify({ completedRoutines: 4 }));

    expect(service.getState()).toEqual({ ...DEFAULT_APP_REVIEW_STATE, completedRoutines: 4 });
  });

  it('con JSON corrupto devuelve el estado inicial sin lanzar y avisa por consola', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(KEY, '{roto');

    expect(service.getState()).toEqual(DEFAULT_APP_REVIEW_STATE);
    expect(consoleError).toHaveBeenCalled();
  });

  it('si localStorage falla al guardar no lanza y avisa por consola', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota llena');
    });

    expect(() => service.saveState(DEFAULT_APP_REVIEW_STATE)).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
  });
});
