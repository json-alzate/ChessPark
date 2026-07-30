import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  notificationsOutline,
  addOutline,
  createOutline,
  trashOutline,
  flashOutline,
  timeOutline,
} from 'ionicons/icons';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { ReminderPermissionModalComponent } from '@shared/components/reminder-permission-modal/reminder-permission-modal.component';
import { ManualReminderModalComponent } from '@shared/components/manual-reminder-modal/manual-reminder-modal.component';
import { AnalyticsService } from '@services/analytics.service';
import { TrainingReminderService } from '@services/training-reminder.service';
import {
  effectiveReminderTime,
  formatReminderTime,
  weekdayKey,
  ManualReminder,
  TrainingReminderState,
  UpcomingNotification,
  WEEKDAYS_MON_FIRST,
} from '@services/training-reminder.util';

addIcons({
  homeOutline,
  notificationsOutline,
  addOutline,
  createOutline,
  trashOutline,
  flashOutline,
  timeOutline,
});

/**
 * Pantalla de Recordatorios: gestiona el recordatorio automático (el que
 * infiere la hora habitual), permite crear recordatorios manuales por días
 * de la semana, lista las próximas notificaciones previstas y ofrece un
 * disparo de prueba. Solo tiene sentido en nativo.
 */
@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarComponent],
  templateUrl: './reminders.page.html',
  styleUrls: ['./reminders.page.scss'],
})
export class RemindersPage implements OnInit {
  private router = inject(Router);
  private modalController = inject(ModalController);
  private alertController = inject(AlertController);
  private translocoService = inject(TranslocoService);
  private analyticsService = inject(AnalyticsService);
  private trainingReminderService = inject(TrainingReminderService);

  readonly isNativePlatform = Capacitor.isNativePlatform();

  reminderState: TrainingReminderState = this.trainingReminderService.getState();
  suggestedTimeLabel = '';
  suggestedIsConfident = false;
  manualReminders: ManualReminder[] = [];
  upcoming: UpcomingNotification[] = [];
  /** Feedback transitorio del botón "Probar ahora". */
  testFeedbackKey: string | null = null;

  ngOnInit(): void {
    if (this.isNativePlatform) {
      // Resincroniza permiso/agendado por si cambió fuera de la app
      void this.trainingReminderService
        .reschedule()
        .then(() => this.refresh());
    }
    this.refresh();
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  get canAddManual(): boolean {
    return this.trainingReminderService.canAddManualReminder;
  }

  get reminderTimeValue(): string {
    const { hour, minute } = effectiveReminderTime(this.reminderState);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // --- Automático -------------------------------------------------------

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
    this.refresh();
    input.checked = this.reminderState.enabled;
  }

  async onReminderTimeChange(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement).value;
    const [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return;
    }
    await this.trainingReminderService.setUserTime(hour, minute);
    this.refresh();
  }

  async useSuggestedTime(): Promise<void> {
    await this.trainingReminderService.resetToSuggested();
    this.refresh();
  }

  // --- Manuales ---------------------------------------------------------

  async openManualModal(reminder?: ManualReminder): Promise<void> {
    if (!reminder && !this.canAddManual) {
      return;
    }
    const modal = await this.modalController.create({
      component: ManualReminderModalComponent,
      componentProps: { reminder },
      breakpoints: [0, 0.75, 0.95],
      initialBreakpoint: 0.75,
    });
    await modal.present();
    await modal.onWillDismiss();
    this.refresh();
  }

  async toggleManual(reminder: ManualReminder, event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    await this.trainingReminderService.toggleManualReminder(reminder.id, enabled);
    this.refresh();
  }

  async confirmDeleteManual(reminder: ManualReminder): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translocoService.translate('TRAINING_REMINDER.manual.deleteTitle'),
      message: this.translocoService.translate('TRAINING_REMINDER.manual.deleteMessage'),
      buttons: [
        {
          text: this.translocoService.translate('COMMON.actions.cancel'),
          role: 'cancel',
        },
        {
          text: this.translocoService.translate('TRAINING_REMINDER.manual.deleteConfirm'),
          role: 'destructive',
          handler: () => {
            void this.trainingReminderService
              .deleteManualReminder(reminder.id)
              .then(() => this.refresh());
          },
        },
      ],
    });
    await alert.present();
  }

  /** Resumen de días de un manual (p. ej. "Lun, Mié, Vie" o "Todos los días"). */
  weekdaysSummary(reminder: ManualReminder): string {
    if (reminder.weekdays.length === 0) {
      return this.translocoService.translate('TRAINING_REMINDER.manual.everyDay');
    }
    return WEEKDAYS_MON_FIRST.filter((w) => reminder.weekdays.includes(w))
      .map((w) =>
        this.translocoService.translate(`TRAINING_REMINDER.weekdays.${weekdayKey(w)}`)
      )
      .join(', ');
  }

  reminderTime(reminder: ManualReminder): string {
    return formatReminderTime(
      reminder.hour,
      reminder.minute,
      this.translocoService.getActiveLang()
    );
  }

  // --- Diagnóstico ------------------------------------------------------

  async sendTest(): Promise<void> {
    const ok = await this.trainingReminderService.sendTestNotification();
    this.testFeedbackKey = ok
      ? 'TRAINING_REMINDER.test.sent'
      : 'TRAINING_REMINDER.test.failed';
    setTimeout(() => (this.testFeedbackKey = null), 4000);
  }

  /** Fecha/hora legible de una próxima notificación. */
  formatUpcoming(date: number): string {
    return new Date(date).toLocaleString(this.translocoService.getActiveLang(), {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private async openPermissionModal(): Promise<boolean> {
    this.trainingReminderService.markContextPromptShown();
    void this.analyticsService.logEvent('training_reminder_prompt_shown', {
      source: 'reminders',
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

  private refresh(): void {
    this.reminderState = this.trainingReminderService.getState();
    const suggested = this.trainingReminderService.getSuggestedTime();
    this.suggestedIsConfident = suggested.confident;
    this.suggestedTimeLabel = formatReminderTime(
      suggested.hour,
      suggested.minute,
      this.translocoService.getActiveLang()
    );
    this.manualReminders = this.trainingReminderService.getManualReminders();
    this.upcoming = this.trainingReminderService.getUpcoming();
  }
}
