import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { ProfileService } from '@services/profile.service';
import { LanguageService, SupportedLang } from '@services/language.service';
import { AnalyticsService } from '@services/analytics.service';

addIcons({
  languageOutline,
  checkmarkOutline,
  settingsOutline,
  colorPaletteOutline,
  gridOutline,
  homeOutline,
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

  currentLang: SupportedLang = this.languageService.getCurrentLang();
  isAuthenticated = false;

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
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  goToHome(): void {
    this.router.navigate(['/home']);
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
