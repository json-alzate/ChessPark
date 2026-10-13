/**
 * Modelos del recordatorio de entrenamiento: tipos y valores por defecto.
 * Son exclusivos de esta funcionalidad, por eso viven aquí y no en
 * `libs/models`. Sin lógica: los cálculos están en `reminder-time.util` y
 * `reminder-schedule.util`.
 */

/** Hora local de una sesión de entrenamiento completada. */
export interface TrainingEvent {
  timestamp: number;
  hourLocal: number;
  minuteLocal: number;
}

/**
 * Recordatorio manual creado por el usuario. A diferencia del automático,
 * es una alarma recurrente fija (no respeta "ya entrenó hoy") que el SO
 * repite solo, sin necesidad de reprogramar.
 */
export interface ManualReminder {
  id: string;
  /** Ranura estable para asignar IDs de notificación sin colisiones. */
  seq: number;
  hour: number;
  minute: number;
  /** Días (Weekday del plugin: 1=Dom … 7=Sáb). Vacío = todos los días. */
  weekdays: number[];
  label: string;
  enabled: boolean;
}

/** Máximo de recordatorios manuales (acota los pendientes en iOS). */
export const MAX_MANUAL_REMINDERS = 15;

/** Una notificación futura a mostrar en la lista de "próximas". */
export interface UpcomingNotification {
  /** Epoch ms del disparo. */
  date: number;
  kind: 'automatic' | 'manual';
  /** Etiqueta del manual (vacío para el automático). */
  label: string;
  reminderId?: string;
}

export interface TrainingReminderState {
  enabled: boolean;
  permissionGranted: boolean;
  /** Hora inferida del comportamiento; se recalcula en cada reprogramación. */
  suggestedHour: number;
  suggestedMinute: number;
  overriddenByUser: boolean;
  /** Hora fijada por el usuario; solo válida si overriddenByUser. */
  userHour: number | null;
  userMinute: number | null;
  /** 'YYYY-MM-DD' local del último día con sesión completada. */
  lastTrainedDate: string | null;
  scheduledNotificationIds: number[];
  /** Epoch ms de cuándo se mostró el modal de contexto (una sola vez). */
  contextPromptShownAt: number | null;
  /**
   * Firma del último agendado reportado a analytics (fecha + hora efectiva),
   * para emitir training_reminder_scheduled solo cuando cambia.
   */
  lastScheduledSignature: string | null;
}

export const DEFAULT_TRAINING_REMINDER_STATE: TrainingReminderState = {
  enabled: false,
  permissionGranted: false,
  suggestedHour: 20,
  suggestedMinute: 0,
  overriddenByUser: false,
  userHour: null,
  userMinute: null,
  lastTrainedDate: null,
  scheduledNotificationIds: [],
  contextPromptShownAt: null,
  lastScheduledSignature: null,
};

/** Máximo de eventos persistidos (cap del storage). */
export const MAX_STORED_EVENTS = 60;

export type ReminderCopyKey = 'generic1' | 'generic2' | 'generic3' | 'streak';

export interface SuggestedTime {
  hour: number;
  minute: number;
  /** true si hay suficientes sesiones recientes para confiar en la moda. */
  confident: boolean;
}
