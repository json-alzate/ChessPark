import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ProfileService } from './profile.service';

export type SupportedLang = 'en' | 'es';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {

  private translocoService = inject(TranslocoService);
  private profileService = inject(ProfileService);

  constructor() {}

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
    await this.translocoService.setActiveLang(lang);
    
    // Actualizar el perfil si el usuario está autenticado
    // const profile = this.profileService.getCurrentProfile();
    // if (profile) {
    //   await this.profileService.updateProfile({ lang });
    // }
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
   */
  async initializeLanguage(): Promise<void> {
    // const profile = this.profileService.getProfile;
    
    // if (profile && profile.lang) {
      // Si el usuario tiene un idioma guardado en su perfil, usarlo
    //   await this.setLanguage(profile.lang);
    // } else {
      // Si no, detectar el idioma del navegador
      const browserLang = this.detectBrowserLanguage();
      await this.setLanguage(browserLang);
    // }
  }

  /**
   * Verifica si el idioma está disponible
   */
  isLanguageAvailable(lang: string): boolean {
    return this.getAvailableLanguages().includes(lang as SupportedLang);
  }
}

