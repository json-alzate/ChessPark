import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TranslocoService } from '@jsverse/transloco';
import { UidGeneratorService } from '@chesspark/common-utils';
import { Plan } from '@cpark/models';

import { AnalyticsService } from '@services/analytics.service';
import { PlanStorageService } from '@services/plan-storage.service';
import { TrainingReminderStorageService } from '@services/training-reminder-storage.service';
import {
  allocateReminderSeq,
  computeStreakDays,
  computeSuggestedTime,
  effectiveReminderTime,
  nextOccurrences,
  nextReminderDates,
  pickCopyKey,
  toLocalISODate,
  ManualReminder,
  MAX_MANUAL_REMINDERS,
  SuggestedTime,
  TrainingReminderState,
  UpcomingNotification,
} from '@services/training-reminder.util';

/** IDs fijos de las notificaciones agendadas (hoy + 2 días de fallback). */
const NOTIFICATION_IDS = [741001, 741002, 741003];
/** ID de la notificación de prueba ("Probar ahora"). */
const TEST_NOTIFICATION_ID = 741999;
/** Base del rango de IDs de los recordatorios manuales (741xxx es del automático). */
const MANUAL_ID_BASE = 742000;
/** Ranuras por recordatorio manual: 1 diaria + hasta 7 días de la semana. */
const MANUAL_ID_STRIDE = 8;
const CHANNEL_ID = 'training-reminder';

/**
 * Orquestador del recordatorio de entrenamiento: agenda notificaciones
 * locales a la hora habitual del usuario, aplicando la regla "no notificar
 * si ya entrenó hoy" mediante reprogramación (al abrir la app, al volver de
 * background y al completar una sesión). Todo el agendado es no-op en web.
 * Ver docs/features/NOTIFICACIONES_ENTRENAMIENTO.md.
 */
@Injectable({
  providedIn: 'root',
})
export class TrainingReminderService {
  private router = inject(Router);
  private translocoService = inject(TranslocoService);
  private analyticsService = inject(AnalyticsService);
  private reminderStorage = inject(TrainingReminderStorageService);
  private planStorageService = inject(PlanStorageService);
  private uidGenerator = inject(UidGeneratorService);

  private readonly isNativePlatform = Capacitor.isNativePlatform();

  /**
   * Arranque: listeners de tap y resume, canal Android y reprogramación
   * inicial. Registrar el listener de tap temprano captura el arranque en
   * frío desde una notificación. Llamado desde AppComponent.initApp().
   */
  async init(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    try {
      await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (action) => {
          if (action.notification?.extra?.source !== 'training_reminder') {
            return;
          }
          void this.analyticsService.logEvent('training_reminder_tapped', {
            streak_days: this.currentStreakDays(new Date()),
          });
          void this.router.navigate(['/home']);
        }
      );

      void App.addListener('resume', () => {
        void this.reschedule();
      });

      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: this.translocoService.translate(
            'TRAINING_REMINDER.channelName'
          ),
          importance: 4,
          visibility: 1,
        });
      }

      this.seedFromPlanHistoryIfNeeded();
      await this.reschedule();
      await this.rescheduleManual();
    } catch (error) {
      console.warn('[TrainingReminder] init falló:', error);
    }
  }

  getState(): TrainingReminderState {
    return this.reminderStorage.getState();
  }

  /** Cantidad de sesiones con hora registrada (para la elegibilidad del modal). */
  getEventsCount(): number {
    this.seedFromPlanHistoryIfNeeded();
    return this.reminderStorage.getEvents().length;
  }

  /** Hora sugerida calculada al momento (para el pitch del modal y Ajustes). */
  getSuggestedTime(): SuggestedTime {
    this.seedFromPlanHistoryIfNeeded();
    return computeSuggestedTime(this.reminderStorage.getEvents(), new Date());
  }

  /** Marca el modal de contexto proactivo como mostrado (una sola vez). */
  markContextPromptShown(): void {
    this.reminderStorage.saveState({ contextPromptShownAt: Date.now() });
  }

  async checkPermissionStatus(): Promise<PermissionState> {
    if (!this.isNativePlatform) {
      return 'denied';
    }
    try {
      const { display } = await LocalNotifications.checkPermissions();
      return display;
    } catch {
      return 'denied';
    }
  }

  /**
   * Activa el recordatorio pidiendo el permiso nativo si hace falta.
   * El modal de contexto (si aplica) debe mostrarse ANTES de llamar aquí.
   */
  async enable(source: 'settings' | 'prompt'): Promise<TrainingReminderState> {
    let granted = false;
    try {
      const { display } = await LocalNotifications.requestPermissions();
      granted = display === 'granted';
    } catch (error) {
      console.warn('[TrainingReminder] requestPermissions falló:', error);
    }

    this.reminderStorage.saveState({
      enabled: true,
      permissionGranted: granted,
    });
    void this.analyticsService.logEvent('training_reminder_enabled', {
      source,
      permission_granted: granted,
    });
    // reschedule() recalcula la hora sugerida: releer el estado ya actualizado
    await this.reschedule();
    return this.reminderStorage.getState();
  }

  async disable(): Promise<TrainingReminderState> {
    this.reminderStorage.saveState({ enabled: false });
    void this.analyticsService.logEvent('training_reminder_disabled');
    await this.cancelPending();
    return this.reminderStorage.getState();
  }

  /** Fija la hora elegida por el usuario (override de la sugerida). */
  async setUserTime(hour: number, minute: number): Promise<TrainingReminderState> {
    this.reminderStorage.saveState({
      overriddenByUser: true,
      userHour: hour,
      userMinute: minute,
    });
    void this.analyticsService.logEvent('training_reminder_time_changed', {
      hour,
      minute,
    });
    await this.reschedule();
    return this.reminderStorage.getState();
  }

  /** Vuelve a la hora sugerida automáticamente. */
  async resetToSuggested(): Promise<TrainingReminderState> {
    this.reminderStorage.saveState({
      overriddenByUser: false,
      userHour: null,
      userMinute: null,
    });
    await this.reschedule();
    return this.reminderStorage.getState();
  }

  /**
   * Al arrancar una sesión: cancela solo el recordatorio de hoy, que es el
   * único que podría sonar en mitad del entrenamiento. Los de los próximos
   * días se conservan: si el usuario abandona la sesión y no vuelve a abrir
   * la app, seguirá recibiendo recordatorios.
   */
  onSessionStarted(): void {
    void this.cancelTodayPending();
  }

  /**
   * Al completar una sesión: registra la hora local de inicio como señal de
   * hábito, marca el día como entrenado y reprograma (lo que cancela el
   * recordatorio de hoy y agenda a partir de mañana).
   */
  onSessionCompleted(plan: Pick<Plan, 'createdAt'>): void {
    const startedAt = new Date(plan.createdAt);
    this.reminderStorage.addEvent({
      timestamp: plan.createdAt,
      hourLocal: startedAt.getHours(),
      minuteLocal: startedAt.getMinutes(),
    });
    this.reminderStorage.saveState({
      lastTrainedDate: toLocalISODate(new Date()),
    });
    void this.reschedule();
  }

  /**
   * Reprogramación idempotente: cancela todo lo nuestro y agenda las
   * próximas 3 notificaciones (hoy si aplica + 2 días de fallback) con la
   * hora efectiva (override del usuario o sugerida recalculada).
   */
  async reschedule(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    try {
      let state = this.reminderStorage.getState();

      if (!state.enabled) {
        await this.cancelPending();
        return;
      }

      const permission = await this.checkPermissionStatus();
      const granted = permission === 'granted';
      if (granted !== state.permissionGranted) {
        state = this.reminderStorage.saveState({ permissionGranted: granted });
      }
      if (!granted) {
        await this.cancelPending();
        return;
      }

      // Recalcular la hora sugerida con las sesiones recientes
      const now = new Date();
      const suggested = computeSuggestedTime(
        this.reminderStorage.getEvents(),
        now
      );
      state = this.reminderStorage.saveState({
        suggestedHour: suggested.hour,
        suggestedMinute: suggested.minute,
      });

      const { hour, minute } = effectiveReminderTime(state);
      const dates = nextReminderDates(
        now,
        hour,
        minute,
        state.lastTrainedDate,
        NOTIFICATION_IDS.length
      );

      await this.cancelPending();

      const plans = this.getPlanHistorySafe();
      const title = this.translocoService.translate(
        'TRAINING_REMINDER.notifications.title'
      );
      const notifications = dates.map((fireDate, i) => {
        const streakDays = computeStreakDays(plans, fireDate);
        const copyKey = pickCopyKey(fireDate, streakDays);
        return {
          id: NOTIFICATION_IDS[i],
          title,
          body: this.translocoService.translate(
            `TRAINING_REMINDER.notifications.${copyKey}`,
            { days: streakDays }
          ),
          channelId: CHANNEL_ID,
          schedule: { at: fireDate, allowWhileIdle: true },
          extra: { source: 'training_reminder' },
        };
      });

      await LocalNotifications.schedule({ notifications });
      this.reminderStorage.saveState({
        scheduledNotificationIds: notifications.map((n) => n.id),
      });

      // Reportar el agendado solo cuando cambia (fecha del primer disparo + hora)
      const signature = `${toLocalISODate(dates[0])}T${hour}:${minute}`;
      if (signature !== state.lastScheduledSignature) {
        this.reminderStorage.saveState({ lastScheduledSignature: signature });
        void this.analyticsService.logEvent('training_reminder_scheduled', {
          hour,
          minute,
          overridden: state.overriddenByUser,
          days_ahead: notifications.length,
        });
      }
    } catch (error) {
      console.warn('[TrainingReminder] reschedule falló:', error);
    }
  }

  // --- Recordatorios manuales -------------------------------------------

  getManualReminders(): ManualReminder[] {
    return this.reminderStorage.getManualReminders();
  }

  get canAddManualReminder(): boolean {
    return this.getManualReminders().length < MAX_MANUAL_REMINDERS;
  }

  /**
   * Crea o actualiza un recordatorio manual y lo (re)agenda. Devuelve la
   * lista actualizada, o null si se alcanzó el máximo al crear uno nuevo.
   */
  async saveManualReminder(
    input: Omit<ManualReminder, 'seq'> & { seq?: number }
  ): Promise<ManualReminder[] | null> {
    const reminders = this.getManualReminders();
    const existingIndex = reminders.findIndex((r) => r.id === input.id);

    if (existingIndex >= 0) {
      // Preservar el seq original: es la ranura de IDs de notificación
      reminders[existingIndex] = {
        ...reminders[existingIndex],
        ...input,
        seq: reminders[existingIndex].seq,
      };
    } else {
      if (reminders.length >= MAX_MANUAL_REMINDERS) {
        return null;
      }
      reminders.push({ ...input, seq: allocateReminderSeq(reminders) });
      void this.analyticsService.logEvent('training_reminder_manual_created', {
        weekdays: input.weekdays.length,
        hour: input.hour,
        minute: input.minute,
      });
    }

    this.reminderStorage.saveManualReminders(reminders);
    // Crear un recordatorio es intención clara de ser notificado: pedir permiso
    if (input.enabled) {
      await this.ensureNotificationPermission();
    }
    await this.rescheduleManual();
    return reminders;
  }

  async deleteManualReminder(id: string): Promise<ManualReminder[]> {
    const reminders = this.getManualReminders().filter((r) => r.id !== id);
    this.reminderStorage.saveManualReminders(reminders);
    void this.analyticsService.logEvent('training_reminder_manual_deleted');
    await this.rescheduleManual();
    return reminders;
  }

  async toggleManualReminder(
    id: string,
    enabled: boolean
  ): Promise<ManualReminder[]> {
    const reminders = this.getManualReminders().map((r) =>
      r.id === id ? { ...r, enabled } : r
    );
    this.reminderStorage.saveManualReminders(reminders);
    if (enabled) {
      await this.ensureNotificationPermission();
    }
    await this.rescheduleManual();
    return reminders;
  }

  /**
   * Pide el permiso de notificaciones si aún no se ha decidido. Solo llamar
   * desde acciones explícitas del usuario (crear/activar un recordatorio).
   */
  private async ensureNotificationPermission(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    const status = await this.checkPermissionStatus();
    if (status === 'granted' || status === 'denied') {
      return;
    }
    try {
      const { display } = await LocalNotifications.requestPermissions();
      this.reminderStorage.saveState({
        permissionGranted: display === 'granted',
      });
    } catch (error) {
      console.warn('[TrainingReminder] requestPermissions falló:', error);
    }
  }

  /** UID para un recordatorio manual nuevo (usa el generador de la app). */
  newManualReminderId(): string {
    return this.uidGenerator.generateSimpleUid();
  }

  /**
   * Reagenda todos los manuales: cancela el rango completo y vuelve a agendar
   * los habilitados como notificaciones recurrentes del SO (no requieren
   * reprogramación posterior). Idempotente.
   */
  private async rescheduleManual(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    try {
      await this.cancelManualRange();

      const permission = await this.checkPermissionStatus();
      if (permission !== 'granted') {
        return;
      }

      const title = this.translocoService.translate(
        'TRAINING_REMINDER.notifications.title'
      );
      const fallbackBody = this.translocoService.translate(
        'TRAINING_REMINDER.notifications.generic1'
      );
      const notifications = this.getManualReminders()
        .filter((r) => r.enabled)
        .flatMap((r) => {
          const body = r.label.trim() || fallbackBody;
          // Sin días → una notificación diaria; con días → una por weekday
          const slots = r.weekdays.length ? r.weekdays : [null];
          return slots.map((weekday) => ({
            id:
              MANUAL_ID_BASE +
              r.seq * MANUAL_ID_STRIDE +
              (weekday ?? 0),
            title,
            body,
            channelId: CHANNEL_ID,
            schedule: {
              on:
                weekday === null
                  ? { hour: r.hour, minute: r.minute }
                  : { weekday, hour: r.hour, minute: r.minute },
              repeats: true,
              allowWhileIdle: true,
            },
            extra: { source: 'training_reminder_manual', reminderId: r.id },
          }));
        });

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch (error) {
      console.warn('[TrainingReminder] rescheduleManual falló:', error);
    }
  }

  /** Cancela todas las notificaciones del rango de manuales. */
  private async cancelManualRange(): Promise<void> {
    try {
      const { notifications } = await LocalNotifications.getPending();
      const toCancel = notifications
        .filter(
          (n) =>
            n.id >= MANUAL_ID_BASE &&
            n.id < MANUAL_ID_BASE + MAX_MANUAL_REMINDERS * MANUAL_ID_STRIDE
        )
        .map((n) => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }
    } catch (error) {
      console.warn('[TrainingReminder] cancelManualRange falló:', error);
    }
  }

  // --- Diagnóstico ------------------------------------------------------

  /**
   * Dispara una notificación de prueba en ~2 s saltándose todas las reglas.
   * Sirve para verificar permiso + canal sin depender de "ya entrenó hoy".
   * Devuelve false si no hay permiso o no es nativo.
   */
  async sendTestNotification(): Promise<boolean> {
    if (!this.isNativePlatform) {
      return false;
    }
    try {
      await this.ensureNotificationPermission();
      const permission = await this.checkPermissionStatus();
      if (permission !== 'granted') {
        return false;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_NOTIFICATION_ID,
            title: this.translocoService.translate(
              'TRAINING_REMINDER.notifications.title'
            ),
            body: this.translocoService.translate(
              'TRAINING_REMINDER.test.body'
            ),
            channelId: CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 2000) },
            extra: { source: 'training_reminder_test' },
          },
        ],
      });
      void this.analyticsService.logEvent('training_reminder_test_sent');
      return true;
    } catch (error) {
      console.warn('[TrainingReminder] sendTestNotification falló:', error);
      return false;
    }
  }

  /**
   * Próximas notificaciones previstas (automáticas + manuales), calculadas de
   * las configuraciones y ordenadas por hora de disparo. No lee del SO: refleja
   * lo que la app agendaría, para que el usuario verifique su configuración.
   */
  getUpcoming(limit = 12): UpcomingNotification[] {
    const now = new Date();
    const items: UpcomingNotification[] = [];

    const state = this.reminderStorage.getState();
    if (state.enabled && state.permissionGranted) {
      const { hour, minute } = effectiveReminderTime(state);
      for (const date of nextReminderDates(
        now,
        hour,
        minute,
        state.lastTrainedDate,
        NOTIFICATION_IDS.length
      )) {
        items.push({ date: date.getTime(), kind: 'automatic', label: '' });
      }
    }

    for (const reminder of this.getManualReminders().filter((r) => r.enabled)) {
      for (const date of nextOccurrences(
        now,
        reminder.hour,
        reminder.minute,
        reminder.weekdays,
        2
      )) {
        items.push({
          date: date.getTime(),
          kind: 'manual',
          label: reminder.label,
          reminderId: reminder.id,
        });
      }
    }

    return items.sort((a, b) => a.date - b.date).slice(0, limit);
  }

  private async cancelPending(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    try {
      await LocalNotifications.cancel({
        notifications: NOTIFICATION_IDS.map((id) => ({ id })),
      });
      this.reminderStorage.saveState({ scheduledNotificationIds: [] });
    } catch (error) {
      console.warn('[TrainingReminder] cancel falló:', error);
    }
  }

  /** Cancela solo las notificaciones nuestras que dispararían hoy. */
  private async cancelTodayPending(): Promise<void> {
    if (!this.isNativePlatform) {
      return;
    }
    try {
      const { notifications } = await LocalNotifications.getPending();
      const today = toLocalISODate(new Date());
      const toCancel = notifications
        .filter((n) => {
          const at = n.schedule?.at;
          return (
            NOTIFICATION_IDS.includes(n.id) &&
            at &&
            toLocalISODate(new Date(at)) === today
          );
        })
        .map((n) => ({ id: n.id }));

      if (toCancel.length === 0) {
        return;
      }
      await LocalNotifications.cancel({ notifications: toCancel });
      const cancelled = new Set(toCancel.map((n) => n.id));
      const state = this.reminderStorage.getState();
      this.reminderStorage.saveState({
        scheduledNotificationIds: state.scheduledNotificationIds.filter(
          (id) => !cancelled.has(id)
        ),
      });
    } catch (error) {
      console.warn('[TrainingReminder] cancelTodayPending falló:', error);
    }
  }

  /**
   * Migración para usuarios con historial previo: si aún no hay eventos
   * registrados, deriva las horas de las sesiones ya guardadas en el
   * historial de planes (misma señal: hora local de createdAt).
   */
  private seedFromPlanHistoryIfNeeded(): void {
    if (this.reminderStorage.getEvents().length > 0) {
      return;
    }
    const plans = this.getPlanHistorySafe();
    if (plans.length === 0) {
      return;
    }
    for (const plan of plans) {
      const startedAt = new Date(plan.createdAt);
      this.reminderStorage.addEvent({
        timestamp: plan.createdAt,
        hourLocal: startedAt.getHours(),
        minuteLocal: startedAt.getMinutes(),
      });
    }
    const state = this.reminderStorage.getState();
    if (!state.lastTrainedDate) {
      const mostRecent = plans.reduce((a, b) =>
        a.createdAt > b.createdAt ? a : b
      );
      this.reminderStorage.saveState({
        lastTrainedDate: toLocalISODate(new Date(mostRecent.createdAt)),
      });
    }
  }

  /** Racha en juego ahora mismo (para el evento de tap). */
  private currentStreakDays(now: Date): number {
    return computeStreakDays(this.getPlanHistorySafe(), now);
  }

  private getPlanHistorySafe(): Plan[] {
    try {
      return this.planStorageService.getAllPlans();
    } catch {
      return [];
    }
  }
}
