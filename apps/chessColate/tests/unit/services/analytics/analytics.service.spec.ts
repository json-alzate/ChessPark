import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from '@services/analytics/analytics.service';

const mockFlags = { analyticsEnabled: true };
const mockPlugin = {
  setEnabled: jest.fn(),
  logEvent: jest.fn(),
  setCurrentScreen: jest.fn(),
  setUserId: jest.fn(),
  setUserProperty: jest.fn(),
};

jest.mock('@environments/environment', () => ({
  environment: {
    get analyticsEnabled() {
      return mockFlags.analyticsEnabled;
    },
  },
}));
jest.mock('@capacitor-firebase/analytics', () => ({
  FirebaseAnalytics: {
    setEnabled: (o: unknown) => mockPlugin.setEnabled(o),
    logEvent: (o: unknown) => mockPlugin.logEvent(o),
    setCurrentScreen: (o: unknown) => mockPlugin.setCurrentScreen(o),
    setUserId: (o: unknown) => mockPlugin.setUserId(o),
    setUserProperty: (o: unknown) => mockPlugin.setUserProperty(o),
  },
}));

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    mockFlags.analyticsEnabled = true;
    Object.values(mockPlugin).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => warn.mockRestore());

  describe('logEvent', () => {
    it('envía el evento con sus parámetros al plugin', async () => {
      await service.logEvent('routine_started', { kind: 'default', minutes: 5 });

      expect(mockPlugin.logEvent).toHaveBeenCalledWith({
        name: 'routine_started',
        params: { kind: 'default', minutes: 5 },
      });
    });

    it('con la analítica desactivada no llama al plugin', async () => {
      mockFlags.analyticsEnabled = false;

      await service.logEvent('routine_started');

      expect(mockPlugin.logEvent).not.toHaveBeenCalled();
    });

    it('si el plugin falla no lanza y avisa por consola', async () => {
      mockPlugin.logEvent.mockRejectedValue(new Error('sin red'));

      await expect(service.logEvent('puzzle_started')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('logScreenView', () => {
    it('registra el nombre de la pantalla', async () => {
      await service.logScreenView('Inicio');

      expect(mockPlugin.setCurrentScreen).toHaveBeenCalledWith({ screenName: 'Inicio' });
    });

    it('con la analítica desactivada no registra nada', async () => {
      mockFlags.analyticsEnabled = false;

      await service.logScreenView('Inicio');

      expect(mockPlugin.setCurrentScreen).not.toHaveBeenCalled();
    });

    it('si el plugin falla no lanza', async () => {
      mockPlugin.setCurrentScreen.mockRejectedValue(new Error('x'));

      await expect(service.logScreenView('Inicio')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('setUserId', () => {
    it('asocia el uid y permite desasociarlo con null', async () => {
      await service.setUserId('uid-1');
      await service.setUserId(null);

      expect(mockPlugin.setUserId).toHaveBeenNthCalledWith(1, { userId: 'uid-1' });
      expect(mockPlugin.setUserId).toHaveBeenNthCalledWith(2, { userId: null });
    });

    it('se envía aunque la analítica de eventos esté desactivada (no está gateado)', async () => {
      mockFlags.analyticsEnabled = false;

      await service.setUserId('uid-1');

      expect(mockPlugin.setUserId).toHaveBeenCalledWith({ userId: 'uid-1' });
    });

    it('si el plugin falla no lanza', async () => {
      mockPlugin.setUserId.mockRejectedValue(new Error('x'));

      await expect(service.setUserId('u')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('setUserProperty', () => {
    it('envía la propiedad', async () => {
      await service.setUserProperty('lang', 'es');

      expect(mockPlugin.setUserProperty).toHaveBeenCalledWith({ key: 'lang', value: 'es' });
    });

    it('con la analítica desactivada no envía nada', async () => {
      mockFlags.analyticsEnabled = false;

      await service.setUserProperty('lang', 'es');

      expect(mockPlugin.setUserProperty).not.toHaveBeenCalled();
    });

    it('si el plugin falla no lanza', async () => {
      mockPlugin.setUserProperty.mockRejectedValue(new Error('x'));

      await expect(service.setUserProperty('a', null)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    it('activa y desactiva la recolección en el SDK', async () => {
      await service.setEnabled(false);

      expect(mockPlugin.setEnabled).toHaveBeenCalledWith({ enabled: false });
    });

    it('si el plugin falla no lanza', async () => {
      mockPlugin.setEnabled.mockRejectedValue(new Error('x'));

      await expect(service.setEnabled(true)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });
});
