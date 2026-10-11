// El selector de apariencia importa la librería del tablero, que arrastra
// cm-chessboard y Jest no sabe cargar. Aquí el selector se sustituye por uno falso.
jest.mock('@chesspark/board', () => ({
  FenBoardComponent: class {},
  PIECES_STYLE_OPTIONS: [],
  BOARD_STYLE_OPTIONS: [],
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Capacitor } from '@capacitor/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommonModule } from '@angular/common';

import { AnalyticsService } from '@core/analytics/analytics.service';
import { ProfileService } from '@core/account/profile.service';
import { LanguageService, SupportedLang } from '@core/app/language.service';
import { AppReviewService } from '@features/app-review/services/app-review.service';
import { PuzzleStorageService } from '@services/training/puzzle-storage.service';
import { GamesService } from '@features/games/services/games.service';
import { SettingsPage } from '@app/features/settings/pages/settings.page';

import {
  NavbarFalsa,
  SelectorAparienciaFalso,
  translocoParaPruebas,
  vaciarPromesas,
} from '@tests/support/racha-ajustes-recordatorios';

/**
 * Pantalla de Ajustes: idioma (con persistencia en el perfil si hay sesión),
 * recordatorios (solo nativo), calificar la app y resumen de almacenamiento.
 */
describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let page: SettingsPage;
  let perfil$: BehaviorSubject<{ uid: string } | null>;
  let idiomaActivo: SupportedLang;

  const router = { navigate: jest.fn() };
  const languageService = { getCurrentLang: jest.fn(), setLanguage: jest.fn() };
  const profileService = { requestUpdateProfile: jest.fn(), profile$: undefined as unknown };
  const analytics = { logEvent: jest.fn() };
  const puzzleStorage = { getSummary: jest.fn(), formatBytes: jest.fn() };
  const appReview = { openStoreListing: jest.fn() };
  const games = { getStorageSummary: jest.fn() };

  async function crear(opciones: { nativo?: boolean } = {}) {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(!!opciones.nativo);
    fixture = TestBed.createComponent(SettingsPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await vaciarPromesas();
    fixture.detectChanges();
  }

  /** Enlaces/botones de la pantalla cuyo texto contiene `texto`. */
  function enlace(texto: string): HTMLElement {
    const encontrado = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a')
    ).find((a) => (a.textContent ?? '').includes(texto));
    if (!encontrado) {
      throw new Error(`No hay enlace con el texto "${texto}"`);
    }
    return encontrado;
  }

  function hayEnlace(texto: string): boolean {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a')
    ).some((a) => (a.textContent ?? '').includes(texto));
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    idiomaActivo = 'es';
    perfil$ = new BehaviorSubject<{ uid: string } | null>(null);
    profileService.profile$ = perfil$.asObservable();
    languageService.getCurrentLang.mockImplementation(() => idiomaActivo);
    languageService.setLanguage.mockImplementation(async (lang: SupportedLang) => {
      idiomaActivo = lang;
    });
    analytics.logEvent.mockResolvedValue(undefined);
    puzzleStorage.getSummary.mockResolvedValue({ files: 10, sizeBytes: 1000 });
    puzzleStorage.formatBytes.mockImplementation((bytes: number) => `${bytes} B`);
    games.getStorageSummary.mockResolvedValue({ packs: 2, sizeBytes: 500 });

    await TestBed.configureTestingModule({
      imports: [
        SettingsPage,
        translocoParaPruebas({ 'STORAGE.summary': '{{files}} archivos · {{size}}' }),
      ],
      providers: [
        { provide: Router, useValue: router },
        { provide: LanguageService, useValue: languageService },
        { provide: ProfileService, useValue: profileService },
        { provide: AnalyticsService, useValue: analytics },
        { provide: PuzzleStorageService, useValue: puzzleStorage },
        { provide: AppReviewService, useValue: appReview },
        { provide: GamesService, useValue: games },
      ],
    })
      .overrideComponent(SettingsPage, {
        set: {
          imports: [
            CommonModule,
            TranslocoPipe,
            IonContent,
            IonIcon,
            NavbarFalsa,
            SelectorAparienciaFalso,
          ],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('idioma', () => {
    it('lista los idiomas disponibles y marca el activo', async () => {
      await crear();

      expect(hayEnlace('COMMON.languages.english')).toBe(true);
      expect(hayEnlace('COMMON.languages.spanish')).toBe(true);
      expect(enlace('COMMON.languages.spanish').classList).toContain('active');
      expect(enlace('COMMON.languages.english').classList).not.toContain('active');
    });

    it('al elegir otro idioma lo aplica, lo registra en analítica y lo marca como activo', async () => {
      await crear();

      enlace('COMMON.languages.english').click();
      await vaciarPromesas();
      fixture.detectChanges();

      expect(languageService.setLanguage).toHaveBeenCalledWith('en');
      expect(analytics.logEvent).toHaveBeenCalledWith('language_changed', {
        from: 'es',
        to: 'en',
      });
      expect(page.currentLang).toBe('en');
      expect(enlace('COMMON.languages.english').classList).toContain('active');
      expect(enlace('COMMON.languages.spanish').classList).not.toContain('active');
    });

    it('un invitado cambia el idioma sin tocar ningún perfil', async () => {
      await crear();

      await page.changeLanguage('en');

      expect(languageService.setLanguage).toHaveBeenCalledWith('en');
      expect(profileService.requestUpdateProfile).not.toHaveBeenCalled();
    });

    it('con sesión iniciada además guarda el idioma en el perfil', async () => {
      perfil$.next({ uid: 'u1' });
      await crear();

      await page.changeLanguage('en');

      expect(profileService.requestUpdateProfile).toHaveBeenCalledWith({ lang: 'en' });
    });

    it('elegir el idioma que ya está activo no hace nada', async () => {
      await crear();

      enlace('COMMON.languages.spanish').click();
      await vaciarPromesas();

      expect(languageService.setLanguage).not.toHaveBeenCalled();
      expect(analytics.logEvent).not.toHaveBeenCalled();
    });

    it('si el perfil cargado trae otro idioma, la pantalla lo refleja', async () => {
      await crear();
      idiomaActivo = 'en';

      perfil$.next({ uid: 'u1' });
      fixture.detectChanges();

      expect(page.isAuthenticated).toBe(true);
      expect(page.currentLang).toBe('en');
      expect(enlace('COMMON.languages.english').classList).toContain('active');
    });

    it('al cerrar sesión deja de considerarse autenticado', async () => {
      perfil$.next({ uid: 'u1' });
      await crear();

      perfil$.next(null);

      expect(page.isAuthenticated).toBe(false);
    });

    it('al destruir la pantalla deja de escuchar el perfil', async () => {
      await crear();
      fixture.destroy();

      perfil$.next({ uid: 'u1' });

      expect(page.isAuthenticated).toBe(false);
    });
  });

  describe('recordatorios (solo nativo)', () => {
    it('en la app nativa muestra la fila y abre /reminders', async () => {
      await crear({ nativo: true });

      enlace('TRAINING_REMINDER.pageTitle').click();

      expect(router.navigate).toHaveBeenCalledWith(['/reminders']);
    });

    it('en web no ofrece recordatorios (no hay notificaciones locales)', async () => {
      await crear({ nativo: false });

      expect(hayEnlace('TRAINING_REMINDER.pageTitle')).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('SETTINGS.notifications');
    });
  });

  describe('navegación y calificación', () => {
    it('el enlace "Home" del encabezado vuelve al inicio', async () => {
      await crear();

      enlace('MENU.navigation.home').click();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('la fila de calificar abre la ficha de la tienda', async () => {
      await crear();

      enlace('APP_REVIEW.rateRowTitle').click();

      expect(appReview.openStoreListing).toHaveBeenCalledTimes(1);
    });

    it('la fila de almacenamiento abre /settings/storage', async () => {
      await crear();

      enlace('STORAGE.settingsRowTitle').click();

      expect(router.navigate).toHaveBeenCalledWith(['/settings/storage']);
    });

    it('incluye el selector de apariencia', async () => {
      await crear();

      expect(fixture.debugElement.query(By.directive(SelectorAparienciaFalso))).not.toBeNull();
    });
  });

  describe('resumen de almacenamiento', () => {
    it('suma puzzles y paquetes de partidas: archivos y tamaño juntos', async () => {
      await crear();

      expect(page.storageSummary).toEqual({ files: 12, size: '1500 B' });
      expect(puzzleStorage.formatBytes).toHaveBeenCalledWith(1500);
      expect(enlace('STORAGE.settingsRowTitle').textContent).toContain('12 archivos · 1500 B');
    });

    it('mientras se calcula enseña el texto de carga', async () => {
      puzzleStorage.getSummary.mockReturnValue(new Promise(() => undefined));
      await crear();

      expect(page.storageSummary).toBeNull();
      expect(enlace('STORAGE.settingsRowTitle').textContent).toContain('STORAGE.loading');
    });

    it('si falla el cálculo Ajustes sigue funcionando y la fila queda en "cargando"', async () => {
      const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      games.getStorageSummary.mockRejectedValue(new Error('sin IndexedDB'));

      await crear();

      expect(page.storageSummary).toBeNull();
      expect(aviso).toHaveBeenCalled();
      expect(enlace('STORAGE.settingsRowTitle').textContent).toContain('STORAGE.loading');
      expect(hayEnlace('COMMON.languages.english')).toBe(true);
    });
  });
});
