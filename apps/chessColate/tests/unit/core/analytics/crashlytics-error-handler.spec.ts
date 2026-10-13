import { CrashlyticsErrorHandler } from '@core/analytics/crashlytics-error-handler';

const mockState = { native: true, crashlyticsEnabled: true };
const mockRecordException = jest.fn();

jest.mock('@environments/environment', () => ({
  environment: {
    get crashlyticsEnabled() {
      return mockState.crashlyticsEnabled;
    },
  },
}));
jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockState.native },
}));
jest.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: { recordException: (o: unknown) => mockRecordException(o) },
}));

describe('CrashlyticsErrorHandler', () => {
  let handler: CrashlyticsErrorHandler;
  let consoleError: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    mockState.native = true;
    mockState.crashlyticsEnabled = true;
    mockRecordException.mockReset().mockResolvedValue(undefined);
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    handler = new CrashlyticsErrorHandler();
  });

  afterEach(() => jest.restoreAllMocks());

  it('siempre deja el error en consola', () => {
    const error = new Error('boom');

    handler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('en nativo reporta el stack del Error como excepción no fatal', () => {
    const error = new Error('boom');

    handler.handleError(error);

    expect(mockRecordException).toHaveBeenCalledWith({ message: error.stack });
  });

  it('si el Error no tiene stack usa el mensaje', () => {
    const error = new Error('sin stack');
    error.stack = undefined;

    handler.handleError(error);

    expect(mockRecordException).toHaveBeenCalledWith({ message: 'sin stack' });
  });

  it('una cadena lanzada se reporta tal cual', () => {
    handler.handleError('fallo textual');

    expect(mockRecordException).toHaveBeenCalledWith({ message: 'fallo textual' });
  });

  it('un objeto lanzado se reporta serializado', () => {
    handler.handleError({ code: 42 });

    expect(mockRecordException).toHaveBeenCalledWith({ message: '{"code":42}' });
  });

  it('en web no reporta a Crashlytics pero sí registra en consola', () => {
    mockState.native = false;

    handler.handleError(new Error('x'));

    expect(mockRecordException).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('con crashlytics desactivado por entorno no reporta', () => {
    mockState.crashlyticsEnabled = false;

    handler.handleError(new Error('x'));

    expect(mockRecordException).not.toHaveBeenCalled();
  });

  it('si el plugin falla no lanza y avisa por consola', async () => {
    mockRecordException.mockRejectedValue(new Error('plugin caído'));

    expect(() => handler.handleError(new Error('x'))).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleWarn).toHaveBeenCalled();
  });
});
