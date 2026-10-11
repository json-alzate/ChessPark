import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from '@services/analytics/analytics.service';
import { AppReviewService } from '@services/app/app-review.service';
import { AppReviewStorageService } from '@services/app/app-review-storage.service';
import {
  AppReviewState,
  DEFAULT_APP_REVIEW_STATE,
  RoutineOutcome,
} from '@services/app/app-review.util';

const mockPlatform = { native: true, name: 'android' };
const mockRequestReview = jest.fn();

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockPlatform.native,
    getPlatform: () => mockPlatform.name,
  },
}));
jest.mock('@capacitor-community/in-app-review', () => ({
  InAppReview: { requestReview: () => mockRequestReview() },
}));

// AnalyticsService se sustituye por un doble, pero su token arrastra el plugin de Firebase.
jest.mock('@capacitor-firebase/analytics', () => ({ FirebaseAnalytics: {} }));

const NOW = new Date(2026, 5, 15, 12, 0, 0); // 15 jun 2026 (hora local)
const TODAY = '2026-06-15';

/** Dos rutinas en un día distinto: la que se termina hoy hace elegible al usuario. */
const ALMOST_ELIGIBLE: AppReviewState = {
  ...DEFAULT_APP_REVIEW_STATE,
  completedRoutines: 2,
  distinctDaysUsed: 1,
  lastRoutineDate: '2026-06-14',
  lastCountedPlanUid: 'plan-anterior',
  firstUseDate: '2026-06-14',
};

const goodOutcome: RoutineOutcome = { isNewRecord: false, accuracy: 0.9, eloDelta: 10 };
const badOutcome: RoutineOutcome = { isNewRecord: false, accuracy: 0.3, eloDelta: -12 };
const neutralOutcome: RoutineOutcome = { isNewRecord: false, accuracy: 0.6, eloDelta: null };

describe('AppReviewService', () => {
  let service: AppReviewService;
  let storage: AppReviewStorageService;
  let logEvent: jest.Mock;
  let windowOpen: jest.SpyInstance;

  /** Termina una rutina y deja correr el retardo previo a la petición. */
  async function finish(planUid: string, outcome: RoutineOutcome, canPrompt?: boolean) {
    const pending = service.onRoutineFinished(planUid, outcome, canPrompt);
    await jest.advanceTimersByTimeAsync(1000);
    await pending;
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    localStorage.clear();
    mockPlatform.native = true;
    mockPlatform.name = 'android';
    mockRequestReview.mockReset().mockResolvedValue(undefined);
    logEvent = jest.fn().mockResolvedValue(undefined);
    windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);

    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: { logEvent } }],
    });
    service = TestBed.inject(AppReviewService);
    storage = TestBed.inject(AppReviewStorageService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('onRoutineFinished', () => {
    it('cuenta la rutina y guarda el estado aunque todavía no toque pedir reseña', async () => {
      await finish('plan-1', goodOutcome);

      expect(storage.getState()).toMatchObject({
        completedRoutines: 1,
        distinctDaysUsed: 1,
        lastRoutineDate: TODAY,
        lastCountedPlanUid: 'plan-1',
      });
      expect(mockRequestReview).not.toHaveBeenCalled();
    });

    it('el mismo plan no se cuenta dos veces ni vuelve a pedir reseña', async () => {
      storage.saveState({ ...ALMOST_ELIGIBLE, lastCountedPlanUid: 'plan-repetido' });

      await finish('plan-repetido', goodOutcome);

      expect(storage.getState().completedRoutines).toBe(2);
      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('si el usuario ya es elegible y la rutina fue buena, pide la reseña nativa tras esperar 800 ms', async () => {
      storage.saveState(ALMOST_ELIGIBLE);

      const pending = service.onRoutineFinished('plan-3', goodOutcome);
      await jest.advanceTimersByTimeAsync(799);
      expect(mockRequestReview).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await pending;

      expect(mockRequestReview).toHaveBeenCalledTimes(1);
    });

    it('al pedirla marca la fecha, reinicia la ventana de gracia y manda la analítica con el motivo', async () => {
      storage.saveState(ALMOST_ELIGIBLE);

      await finish('plan-3', goodOutcome);

      expect(storage.getState()).toMatchObject({
        completedRoutines: 3,
        lastReviewRequestDate: TODAY,
        eligibleSince: null,
        routinesSinceEligible: 0,
      });
      expect(logEvent).toHaveBeenCalledWith('app_review_requested', {
        trigger: 'good_routine',
        completed_routines: 3,
      });
    });

    it('un récord personal tiene motivo new_record', async () => {
      storage.saveState(ALMOST_ELIGIBLE);

      await finish('plan-3', { ...neutralOutcome, isNewRecord: true });

      expect(logEvent).toHaveBeenCalledWith(
        'app_review_requested',
        expect.objectContaining({ trigger: 'new_record' })
      );
    });

    it('tras una rutina mala no pide la reseña, aunque sea elegible', async () => {
      storage.saveState(ALMOST_ELIGIBLE);

      await finish('plan-3', badOutcome);

      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(storage.getState().lastReviewRequestDate).toBeNull();
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('con canPrompt en false solo suma al contador', async () => {
      storage.saveState(ALMOST_ELIGIBLE);

      await finish('plan-3', goodOutcome, false);

      expect(storage.getState().completedRoutines).toBe(3);
      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(storage.getState().lastReviewRequestDate).toBeNull();
    });

    it('en web cuenta la rutina pero nunca llama al plugin (no gasta el cooldown)', async () => {
      mockPlatform.native = false;
      storage.saveState(ALMOST_ELIGIBLE);

      await finish('plan-3', goodOutcome);

      expect(storage.getState().completedRoutines).toBe(3);
      expect(mockRequestReview).not.toHaveBeenCalled();
      expect(storage.getState().lastReviewRequestDate).toBeNull();
    });

    it('respeta el cooldown: tras pedirla no vuelve a pedirla en la rutina siguiente', async () => {
      storage.saveState(ALMOST_ELIGIBLE);
      await finish('plan-3', goodOutcome);
      mockRequestReview.mockClear();

      await finish('plan-4', goodOutcome);

      expect(mockRequestReview).not.toHaveBeenCalled();
    });

    it('si el plugin falla no rompe el final de la rutina y aun así marca la petición', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockRequestReview.mockRejectedValue(new Error('play store caída'));
      storage.saveState(ALMOST_ELIGIBLE);

      await expect(finish('plan-3', goodOutcome)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalled();
      expect(storage.getState().lastReviewRequestDate).toBe(TODAY);
      expect(logEvent).toHaveBeenCalledWith('app_review_requested', expect.anything());
    });
  });

  describe('openStoreListing', () => {
    it('en Android nativo abre la ficha con el esquema market:// y avisa a analítica', () => {
      service.openStoreListing();

      expect(windowOpen).toHaveBeenCalledWith(
        'market://details?id=com.jheison.chesscolate',
        '_blank'
      );
      expect(logEvent).toHaveBeenCalledWith('app_review_store_opened');
    });

    it('en web abre la URL https de Play Store', () => {
      mockPlatform.native = false;
      mockPlatform.name = 'web';

      service.openStoreListing();

      expect(windowOpen).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.jheison.chesscolate',
        '_blank'
      );
    });

    it('en iOS nativo cae a la URL https', () => {
      mockPlatform.name = 'ios';

      service.openStoreListing();

      expect(windowOpen).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/play\.google\.com/),
        '_blank'
      );
    });

    it('si window.open lanza con el esquema nativo, reintenta con la URL https', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      windowOpen.mockImplementationOnce(() => {
        throw new Error('esquema no soportado');
      });

      service.openStoreListing();

      expect(windowOpen).toHaveBeenCalledTimes(2);
      expect(windowOpen).toHaveBeenLastCalledWith(
        'https://play.google.com/store/apps/details?id=com.jheison.chesscolate',
        '_blank'
      );
      expect(warn).toHaveBeenCalled();
    });
  });
});
