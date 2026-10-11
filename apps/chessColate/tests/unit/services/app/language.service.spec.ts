import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { LanguageService } from '@services/app/language.service';

const KEY = 'chessColate_lang';

describe('LanguageService', () => {
  let service: LanguageService;
  let transloco: {
    getActiveLang: jest.Mock;
    setActiveLang: jest.Mock;
    selectTranslate: jest.Mock;
  };

  const setBrowserLang = (lang: string | undefined) =>
    jest.spyOn(navigator, 'language', 'get').mockReturnValue(lang as string);

  beforeEach(() => {
    localStorage.clear();
    transloco = {
      getActiveLang: jest.fn().mockReturnValue('en'),
      setActiveLang: jest.fn(),
      selectTranslate: jest.fn().mockReturnValue(of('Cancel')),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TranslocoService, useValue: transloco }],
    });
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getCurrentLang', () => {
    it('devuelve el idioma activo de Transloco', () => {
      transloco.getActiveLang.mockReturnValue('es');

      expect(service.getCurrentLang()).toBe('es');
    });

    it('si Transloco no tiene idioma activo cae a inglés', () => {
      transloco.getActiveLang.mockReturnValue('');

      expect(service.getCurrentLang()).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('activa el idioma, lo persiste y espera a que cargue la traducción en ese idioma', async () => {
      await service.setLanguage('es');

      expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
      expect(localStorage.getItem(KEY)).toBe('es');
      expect(transloco.selectTranslate).toHaveBeenCalledWith('COMMON.actions.cancel', {}, 'es');
    });

    it('no termina hasta que la traducción llega', async () => {
      const subject = new Subject<string>();
      transloco.selectTranslate.mockReturnValue(subject);
      let done = false;

      const pending = service.setLanguage('es').then(() => (done = true));
      await Promise.resolve();
      expect(done).toBe(false);

      subject.next('Cancelar');
      await pending;
      expect(done).toBe(true);
    });

    it('si localStorage falla igual cambia el idioma sin lanzar', async () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });

      await expect(service.setLanguage('es')).resolves.toBeUndefined();
      expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
    });
  });

  describe('getStoredLang', () => {
    it('es null si no hay nada guardado', () => {
      expect(service.getStoredLang()).toBeNull();
    });

    it('devuelve el idioma guardado si es válido', () => {
      localStorage.setItem(KEY, 'es');

      expect(service.getStoredLang()).toBe('es');
    });

    it('ignora un valor guardado que ya no es un idioma soportado', () => {
      localStorage.setItem(KEY, 'fr');

      expect(service.getStoredLang()).toBeNull();
    });

    it('si localStorage lanza devuelve null', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });

      expect(service.getStoredLang()).toBeNull();
    });
  });

  describe('idiomas disponibles', () => {
    it('ofrece inglés y español', () => {
      expect(service.getAvailableLanguages()).toEqual(['en', 'es']);
    });

    it('isLanguageAvailable acepta solo los soportados', () => {
      expect(service.isLanguageAvailable('es')).toBe(true);
      expect(service.isLanguageAvailable('en')).toBe(true);
      expect(service.isLanguageAvailable('fr')).toBe(false);
      expect(service.isLanguageAvailable('')).toBe(false);
    });
  });

  describe('detectBrowserLanguage', () => {
    it.each(['es', 'es-CO', 'es-ES'])('un navegador en %s da español', (lang) => {
      setBrowserLang(lang);

      expect(service.detectBrowserLanguage()).toBe('es');
    });

    it.each(['en-US', 'fr-FR', 'pt'])('un navegador en %s da inglés', (lang) => {
      setBrowserLang(lang);

      expect(service.detectBrowserLanguage()).toBe('en');
    });

    it('sin idioma del navegador da inglés', () => {
      setBrowserLang(undefined);

      expect(service.detectBrowserLanguage()).toBe('en');
    });
  });

  describe('initializeLanguage', () => {
    it('prefiere el idioma guardado al del navegador', async () => {
      localStorage.setItem(KEY, 'en');
      setBrowserLang('es-CO');

      await service.initializeLanguage();

      expect(transloco.setActiveLang).toHaveBeenCalledWith('en');
    });

    it('sin idioma guardado usa el del navegador y lo deja persistido', async () => {
      setBrowserLang('es-CO');

      await service.initializeLanguage();

      expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
      expect(localStorage.getItem(KEY)).toBe('es');
    });
  });
});
