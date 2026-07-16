import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
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
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { ReminderPermissionModalComponent } from '@shared/components/reminder-permission-modal/reminder-permission-modal.component';
import { ProfileService } from '@services/profile.service';
import { LanguageService, SupportedLang } from '@services/language.service';
import { AnalyticsService } from '@services/analytics.service';
import { TrainingReminderService } from '@services/training-reminder.service';
import {
  effectiveReminderTime,
  formatReminderTime,
  TrainingReminderState,
} from '@services/training-reminder.util';

addIcons({
  languageOutline,
  checkmarkOutline,
  settingsOutline,
  colorPaletteOutline,
  gridOutline,
  homeOutline,
  notificationsOutline,
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
  private modalController = inject(ModalController);
  private trainingReminderService = inject(TrainingReminderService);

  readonly isNativePlatform = Capacitor.isNativePlatform();

  currentLang: SupportedLang = this.languageService.getCurrentLang();
  isAuthenticated = false;

  reminderState: TrainingReminderState = this.trainingReminderService.getState();
  /** Hora sugerida formateada. Campo (no getter) para no recalcular en cada CD. */
  suggestedTimeLabel = '';
  /** La hora sugerida sale de sus sesiones (no del default). */
  suggestedIsConfident = false;

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

    // Re-sincronizar el permiso del SO al entrar (pudo revocarse fuera de la app)
    if (this.isNativePlatform) {
      this.refreshReminderUi();
      void this.trainingReminderService
        .reschedule()
        .then(() => this.refreshReminderUi());
    }
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  /** Hora efectiva del recordatorio en formato 'HH:mm' para el input time. */
  get reminderTimeValue(): string {
    const { hour, minute } = effectiveReminderTime(this.reminderState);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  /** Relee el estado del recordatorio y recalcula lo que muestra la UI. */
  private refreshReminderUi(): void {
    this.reminderState = this.trainingReminderService.getState();
    const suggested = this.trainingReminderService.getSuggestedTime();
    this.suggestedIsConfident = suggested.confident;
    this.suggestedTimeLabel = formatReminderTime(
      suggested.hour,
      suggested.minute,
      this.currentLang
    );
  }

  /**
   * Toggle del recordatorio. Al activarlo sin permiso concedido, muestra
   * primero el modal de contexto y solo entonces el prompt nativo.
   */
  async onReminderToggle(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (!input.checked) {
      await this.trainingReminderService.disable();
    } else {
      const status = await this.trainingReminderService.checkPermissionStatus();
      if (status === 'granted') {
        await this.trainingReminderService.enable('settings');
      } else if (await this.openPermissionModal()) {
        await this.trainingReminderService.enable('settings');
      }
    }

    this.refreshReminderUi();
    // El binding [checked] no re-aplica si el valor no cambió: forzarlo
    input.checked = this.reminderState.enabled;
  }

  /** El usuario fijó su propia hora (override de la sugerida). */
  async onReminderTimeChange(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value; // 'HH:mm'
    const [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return;
    }
    await this.trainingReminderService.setUserTime(hour, minute);
    this.refreshReminderUi();
  }

  async useSuggestedTime(): Promise<void> {
    await this.trainingReminderService.resetToSuggested();
    this.refreshReminderUi();
  }

  private async openPermissionModal(): Promise<boolean> {
    // Marcarlo evita que el modal proactivo de plan-played lo repita después
    this.trainingReminderService.markContextPromptShown();
    void this.analyticsService.logEvent('training_reminder_prompt_shown', {
      source: 'settings',
    });
    const modal = await this.modalController.create({
      component: ReminderPermissionModalComponent,
      breakpoints: [0, 0.6],
      initialBreakpoint: 0.6,
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    return role === 'accept';
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

    // Los textos de las notificaciones se congelan al agendar: reprogramar
    // para que las pendientes queden en el idioma nuevo
    if (this.isNativePlatform) {
      void this.trainingReminderService
        .reschedule()
        .then(() => this.refreshReminderUi());
    }

    if (this.isAuthenticated) {
      this.profileService.requestUpdateProfile({ lang });
    }
  }
}
