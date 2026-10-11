import { PwaService } from '@services/app/pwa.service';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

type Outcome = 'accepted' | 'dismissed';

function installEvent(outcome: Outcome) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: Outcome }>;
  };
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('PwaService', () => {
  let standalone: boolean;
  // Los listeners de servicios de pruebas anteriores seguirían vivos en window: se quitan al terminar.
  let registered: [string, EventListenerOrEventListenerObject][];

  function create(userAgent: string, isStandalone = false): PwaService {
    standalone = isStandalone;
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    return new PwaService();
  }

  beforeEach(() => {
    standalone = false;
    registered = [];
    const realAdd = window.addEventListener.bind(window);
    jest.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
      registered.push([type, listener]);
      realAdd(type, listener);
    }) as never);
    window.matchMedia = jest.fn().mockImplementation(() => ({ matches: standalone })) as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    registered.forEach(([type, listener]) => window.removeEventListener(type, listener));
    delete (window.navigator as { standalone?: boolean }).standalone;
  });

  describe('isMobileBrowser', () => {
    it('es true en un navegador móvil sin instalar', () => {
      expect(create(ANDROID_UA).isMobileBrowser).toBe(true);
    });

    it('es false en escritorio', () => {
      expect(create(DESKTOP_UA).isMobileBrowser).toBe(false);
    });

    it('es false si ya corre como app instalada (display-mode standalone)', () => {
      expect(create(ANDROID_UA, true).isMobileBrowser).toBe(false);
    });

    it('es false en iOS con navigator.standalone', () => {
      (window.navigator as { standalone?: boolean }).standalone = true;

      expect(create(ANDROID_UA).isMobileBrowser).toBe(false);
    });
  });

  describe('instalación', () => {
    it('empieza sin poder instalar', () => {
      expect(create(ANDROID_UA).canInstall()).toBe(false);
    });

    it('al llegar beforeinstallprompt en móvil, cancela el aviso del navegador y permite instalar', () => {
      const service = create(ANDROID_UA);
      const event = installEvent('accepted');

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(service.canInstall()).toBe(true);
    });

    it('en escritorio no escucha el evento: no se puede instalar y no se cancela', () => {
      const service = create(DESKTOP_UA);
      const event = installEvent('accepted');

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(service.canInstall()).toBe(false);
    });

    it('promptInstall sin evento previo no hace nada', async () => {
      const service = create(ANDROID_UA);

      await expect(service.promptInstall()).resolves.toBeUndefined();
      expect(service.canInstall()).toBe(false);
    });

    it('si el usuario acepta, muestra el aviso y deja de poder instalar', async () => {
      const service = create(ANDROID_UA);
      const event = installEvent('accepted');
      window.dispatchEvent(event);

      await service.promptInstall();

      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(service.canInstall()).toBe(false);
    });

    it('si el usuario rechaza, puede volver a intentarlo', async () => {
      const service = create(ANDROID_UA);
      const event = installEvent('dismissed');
      window.dispatchEvent(event);

      await service.promptInstall();
      await service.promptInstall();

      expect(service.canInstall()).toBe(true);
      expect(event.prompt).toHaveBeenCalledTimes(2);
    });

    it('tras aceptar, un segundo promptInstall ya no vuelve a mostrar el aviso', async () => {
      const service = create(ANDROID_UA);
      const event = installEvent('accepted');
      window.dispatchEvent(event);
      await service.promptInstall();

      await service.promptInstall();

      expect(event.prompt).toHaveBeenCalledTimes(1);
    });

    it('al dispararse appinstalled limpia el aviso diferido', async () => {
      const service = create(ANDROID_UA);
      const event = installEvent('accepted');
      window.dispatchEvent(event);

      window.dispatchEvent(new Event('appinstalled'));
      await service.promptInstall();

      expect(service.canInstall()).toBe(false);
      expect(event.prompt).not.toHaveBeenCalled();
    });
  });
});
