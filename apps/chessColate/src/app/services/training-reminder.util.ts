/**
 * Lógica pura del recordatorio de entrenamiento (sin Angular ni plugins).
 *
 * Aquí vive todo lo testeable de la feature: inferencia de la hora habitual
 * (bins de 30 min + moda), cálculo de las próximas fechas de disparo con la
 * regla "no notificar si ya entrenó hoy", rotación de copys y racha de días.
 * Ver docs/features/NOTIFICACIONES_ENTRENAMIENTO.md.
 */

/** Hora local de una sesión de entrenamiento completada. */
export interface TrainingEvent {
  timestamp: number;
  hourLocal: number;
  minuteLocal: number;
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

/** Tamaño del bin para agrupar sesiones por hora del día. */
export const BIN_MINUTES = 30;
/** Mínimo de sesiones para confiar en la hora inferida. */
export const MIN_EVENTS_FOR_CONFIDENCE = 5;
/** Ventana de datos: máximo de sesiones consideradas… */
export const MAX_EVENTS_CONSIDERED = 30;
/** …y antigüedad máxima en días. */
export const MAX_EVENT_AGE_DAYS = 14;
/** Máximo de eventos persistidos (cap del storage). */
export const MAX_STORED_EVENTS = 60;
/** Ventana razonable de aviso: no antes de las 7:00 ni después de las 22:30. */
export const EARLIEST_REMINDER_MINUTES = 7 * 60;
export const LATEST_REMINDER_MINUTES = 22 * 60 + 30;

export type ReminderCopyKey = 'generic1' | 'generic2' | 'generic3' | 'streak';
/** Racha mínima para usar el copy de "no pierdas tu racha". */
export const MIN_STREAK_FOR_COPY = 2;

export interface SuggestedTime {
  hour: number;
  minute: number;
  /** true si hay suficientes sesiones recientes para confiar en la moda. */
  confident: boolean;
}

/** Fecha local como 'YYYY-MM-DD'. */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Infiere la hora habitual de entrenamiento: bin de 30 min con más sesiones
 * (moda) entre las últimas MAX_EVENTS_CONSIDERED sesiones de los últimos
 * MAX_EVENT_AGE_DAYS días. Ante empate gana el bin con la sesión más
 * reciente. Con menos de MIN_EVENTS_FOR_CONFIDENCE sesiones se devuelve el
 * default (20:00, confident=false). El resultado se acota a la ventana
 * 7:00–22:30 para no proponer avisos de madrugada.
 */
export function computeSuggestedTime(
  events: ReadonlyArray<TrainingEvent>,
  now: Date
): SuggestedTime {
  const minTimestamp = now.getTime() - MAX_EVENT_AGE_DAYS * 24 * 60 * 60 * 1000;
  const recent = events
    .filter((e) => e.timestamp >= minTimestamp && e.timestamp <= now.getTime())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_EVENTS_CONSIDERED);

  if (recent.length < MIN_EVENTS_FOR_CONFIDENCE) {
    return {
      hour: DEFAULT_TRAINING_REMINDER_STATE.suggestedHour,
      minute: DEFAULT_TRAINING_REMINDER_STATE.suggestedMinute,
      confident: false,
    };
  }

  // Moda por bin; ante empate, el bin cuyo evento más reciente sea más nuevo
  const bins = new Map<number, { count: number; lastTimestamp: number }>();
  for (const event of recent) {
    const bin = Math.floor(
      (event.hourLocal * 60 + event.minuteLocal) / BIN_MINUTES
    );
    const entry = bins.get(bin) ?? { count: 0, lastTimestamp: 0 };
    entry.count++;
    entry.lastTimestamp = Math.max(entry.lastTimestamp, event.timestamp);
    bins.set(bin, entry);
  }

  let bestBin = -1;
  let best = { count: 0, lastTimestamp: 0 };
  for (const [bin, entry] of bins) {
    if (
      entry.count > best.count ||
      (entry.count === best.count && entry.lastTimestamp > best.lastTimestamp)
    ) {
      bestBin = bin;
      best = entry;
    }
  }

  const minutes = Math.min(
    Math.max(bestBin * BIN_MINUTES, EARLIEST_REMINDER_MINUTES),
    LATEST_REMINDER_MINUTES
  );
  return {
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    confident: true,
  };
}

/** Hora efectiva del recordatorio: la del usuario si hizo override, si no la sugerida. */
export function effectiveReminderTime(state: TrainingReminderState): {
  hour: number;
  minute: number;
} {
  if (state.overriddenByUser && state.userHour !== null) {
    return { hour: state.userHour, minute: state.userMinute ?? 0 };
  }
  return { hour: state.suggestedHour, minute: state.suggestedMinute };
}

/**
 * Próximas `count` fechas de disparo a la hora dada, en días consecutivos.
 * El primer disparo es hoy solo si la hora aún no pasó y el usuario no ha
 * entrenado hoy; en cualquier otro caso empieza mañana.
 */
export function nextReminderDates(
  now: Date,
  hour: number,
  minute: number,
  lastTrainedDate: string | null,
  count: number
): Date[] {
  const todayAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  const startOffset =
    todayAt.getTime() <= now.getTime() || lastTrainedDate === toLocalISODate(now)
      ? 1
      : 0;

  return Array.from(
    { length: count },
    (_, i) =>
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + startOffset + i,
        hour,
        minute,
        0,
        0
      )
  );
}

/**
 * Racha de días consecutivos entrenados que estaría en juego cuando dispare
 * la notificación: días consecutivos con sesión terminando justo el día
 * anterior a `fireDate` (si ese día no entrenó, no hay racha que perder).
 * Excluye reto333 por consistencia con la racha del historial de planes.
 */
export function computeStreakDays(
  plans: ReadonlyArray<{ createdAt: number; planType?: string }>,
  fireDate: Date
): number {
  const trainedDates = new Set(
    plans
      .filter((p) => p.planType !== 'reto333')
      .map((p) => toLocalISODate(new Date(p.createdAt)))
  );

  let days = 0;
  const cursor = new Date(
    fireDate.getFullYear(),
    fireDate.getMonth(),
    fireDate.getDate() - 1
  );
  while (trainedDates.has(toLocalISODate(cursor))) {
    days++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

/**
 * Copy de la notificación: variante de racha si hay una en juego; si no,
 * genérico rotado por día del año (determinista, distinto en días seguidos).
 */
export function pickCopyKey(
  fireDate: Date,
  streakDays: number
): ReminderCopyKey {
  if (streakDays >= MIN_STREAK_FOR_COPY) {
    return 'streak';
  }
  const generics: ReminderCopyKey[] = ['generic1', 'generic2', 'generic3'];
  return generics[dayOfYear(fireDate) % generics.length];
}

/** Hora legible según el locale (p. ej. "8:30 PM" / "20:30"). */
export function formatReminderTime(
  hour: number,
  minute: number,
  locale: string
): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dayOfYear(date: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const firstOfYear = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((day - firstOfYear) / 86400000) + 1;
}
