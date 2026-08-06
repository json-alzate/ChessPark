import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  languageOutline,
  checkmarkOutline,
  settingsOutline,
  colorPaletteOutline,
  gridOutline,
  homeOutline,
  notificationsOutline,
  chevronForwardOutline,
  serverOutline,
  starOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { ProfileService } from '@services/profile.service';
import { LanguageService, SupportedLang } from '@services/language.service';
import { AnalyticsService } from '@services/analytics.service';
import { PuzzleStorageService } from '@services/puzzle-storage.service';
import { AppReviewService } from '@services/app-review.service';

addIcons({
  languageOutline,
  checkmarkOutline,
  settingsOutline,
  colorPaletteOutline,
  gridOutline,
  homeOutline,
  notificationsOutline,
  chevronForwardOutline,
  serverOutline,
  starOutline,
});

interface LanguageOption {
  code: SupportedLang;
  labelKey: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarComponent],
})
export class SettingsPage implements OnInit, OnDestroy {
  private languageService = inject(LanguageService);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private analyticsService = inject(AnalyticsService);
  private puzzleStorageService = inject(PuzzleStorageService);
  private appReviewService = inject(AppReviewService);

  readonly isNativePlatform = Capacitor.isNativePlatform();

  currentLang: SupportedLang = this.languageService.getCurrentLang();
  isAuthenticated = false;
  /**
   * Resumen de lo descargado ("124 archivos · 18,3 MB"), ya formateado para
   * interpolarlo en la traducción. `null` mientras se calcula.
   */
  storageSummary: { files: number; size: string } | null = null;

  // Mapea cada idioma disponible con su clave de traducción en COMMON.languages
  readonly languages: LanguageOption[] = [
    { code: 'en', labelKey: 'COMMON.languages.english' },
    { code: 'es', labelKey: 'COMMON.languages.spanish' },
  ];

  private profileSub?: Subscription;

  ngOnInit(): void {
    this.profileSub = this.profileService.profile$.subscribe((profile) => {
      this.isAuthenticated = !!profile;
      // Mantener sincronizado el idioma activo con el del perfil cargado
      this.currentLang = this.languageService.getCurrentLang();
    });

    void this.loadStorageSummary();
  }

  /**
   * Calcula el resumen de almacenamiento sin bloquear la pantalla: si falla
   * (p. ej. sin IndexedDB) la fila se queda con el texto de carga en vez de
   * romper Ajustes.
   */
  private async loadStorageSummary(): Promise<void> {
    try {
      const summary = await this.puzzleStorageService.getSummary();
      this.storageSummary = {
        files: summary.files,
        size: this.puzzleStorageService.formatBytes(summary.sizeBytes),
      };
    } catch (error) {
      console.warn('[SettingsPage] No se pudo calcular el almacenamiento:', error);
    }
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToReminders(): void {
    this.router.navigate(['/reminders']);
  }

  goToStorage(): void {
    this.router.navigate(['/settings/storage']);
  }

  /**
   * Abre la ficha de la tienda para calificar. Es la vía manual: no pasa por
   * la tarjeta nativa, así que no tiene cuota ni espera de 90 días.
   */
  rateApp(): void {
    this.appReviewService.openStoreListing();
  }

  /**
   * Cambia el idioma de la app. Aplica al instante para todos (incl. invitados);
   * si hay sesión, además persiste el cambio en el perfil (Firestore + store).
   */
  async changeLanguage(lang: SupportedLang): Promise<void> {
    if (lang === this.currentLang) {
      return;
    }
    const from = this.currentLang;
    await this.languageService.setLanguage(lang);
    this.currentLang = lang;

    void this.analyticsService.logEvent('language_changed', { from, to: lang });

    if (this.isAuthenticated) {
      this.profileService.requestUpdateProfile({ lang });
    }
  }
}
