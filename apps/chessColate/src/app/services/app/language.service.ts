import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

export type SupportedLang = 'en' | 'es';

/** Clave usada para persistir el idioma en localStorage (usuarios invitados) */
const LANG_STORAGE_KEY = 'chessColate_lang';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {

  private translocoService = inject(TranslocoService);

  constructor() { }

  /**
   * Obtiene el idioma actual
   */
  getCurrentLang(): SupportedLang {
    return this.translocoService.getActiveLang() as SupportedLang || 'en';
  }

  /**
   * Cambia el idioma de la aplicación.
   * Persiste también el valor en una variable local (localStorage) para que
   * el idioma se mantenga cuando el usuario no está autenticado.
   */
  async setLanguage(lang: SupportedLang): Promise<void> {
    // Simply set the active language - Transloco will load translations automatically
    this.translocoService.setActiveLang(lang);
    // Persistir localmente el idioma seleccionado
    this.setStoredLang(lang);
    // Wait for the translation to be loaded
    await firstValueFrom(this.translocoService.selectTranslate('COMMON.actions.cancel', {}, lang));
  }

  /**
   * Lee el idioma persistido localmente. Devuelve null si no hay uno válido.
   */
  getStoredLang(): SupportedLang | null {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      return stored && this.isLanguageAvailable(stored) ? (stored as SupportedLang) : null;
    } catch {
      return null;
    }
  }

  /**
   * Guarda el idioma en localStorage.
   */
  private setStoredLang(lang: SupportedLang): void {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Si localStorage no está disponible, se ignora silenciosamente
    }
  }

  /**
   * Obtiene los idiomas disponibles
   */
  getAvailableLanguages(): SupportedLang[] {
    return ['en', 'es'];
  }

  /**
   * Detecta el idioma del navegador
   */
  detectBrowserLanguage(): SupportedLang {
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
    const browserLangCode = browserLang.split('-')[0];

    // Si el navegador está en español, retornar 'es', sino 'en'
    return browserLangCode === 'es' ? 'es' : 'en';
  }

  /**
   * Inicializa el idioma. Si el usuario no está autenticado se toma el idioma
   * persistido localmente; si no hay ninguno, se usa inglés por defecto.
   * Cuando el perfil se cargue desde Firestore, ese idioma predominará.
   */
  async initializeLanguage(): Promise<void> {
    const storedLang = this.getStoredLang();
    // Invitados sin idioma guardado: detectar el idioma del dispositivo.
    // Esto queda persistido en localStorage como variable de sesión.
    await this.setLanguage(storedLang ?? this.detectBrowserLanguage());
  }

  /**
   * Verifica si el idioma está disponible
   */
  isLanguageAvailable(lang: string): boolean {
    return this.getAvailableLanguages().includes(lang as SupportedLang);
  }
}

