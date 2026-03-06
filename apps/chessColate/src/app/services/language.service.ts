import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

export type SupportedLang = 'en' | 'es';

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
   * Cambia el idioma de la aplicación
   */
  async setLanguage(lang: SupportedLang): Promise<void> {
    // Simply set the active language - Transloco will load translations automatically
    this.translocoService.setActiveLang(lang);
    // Wait for the translation to be loaded
    await firstValueFrom(this.translocoService.selectTranslate('COMMON.actions.cancel', {}, lang));
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
   * Inicializa el idioma basado en el perfil del usuario o el navegador
   * Por defecto, si no se ha iniciado sesión, el idioma será inglés
   */
  async initializeLanguage(): Promise<void> {
    await this.setLanguage('en');
  }

  /**
   * Verifica si el idioma está disponible
   */
  isLanguageAvailable(lang: string): boolean {
    return this.getAvailableLanguages().includes(lang as SupportedLang);
  }
}

