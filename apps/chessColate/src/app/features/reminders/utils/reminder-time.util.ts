import {
  DEFAULT_TRAINING_REMINDER_STATE,
  SuggestedTime,
  TrainingEvent,
  TrainingReminderState,
} from '../models/reminder.model';

/**
 * Hora del recordatorio: inferencia de la hora habitual del usuario (bins de
 * 30 min + moda), hora efectiva y formato legible. Lógica pura, sin Angular ni
 * plugins. Ver docs/features/NOTIFICACIONES_ENTRENAMIENTO.md.
 */

/** Tamaño del bin para agrupar sesiones por hora del día. */
export const BIN_MINUTES = 30;
/** Mínimo de sesiones para confiar en la hora inferida. */
export const MIN_EVENTS_FOR_CONFIDENCE = 5;
/** Ventana de datos: máximo de sesiones consideradas… */
export const MAX_EVENTS_CONSIDERED = 30;
/** …y antigüedad máxima en días. */
export const MAX_EVENT_AGE_DAYS = 14;
/** Ventana razonable de aviso: no antes de las 7:00 ni después de las 22:30. */
export const EARLIEST_REMINDER_MINUTES = 7 * 60;
export const LATEST_REMINDER_MINUTES = 22 * 60 + 30;

/**
 * Redondea una hora local a la media hora más cercana y la acota a la ventana
 * 7:00–22:30. Ej.: 9:51 → 10:00, 9:38 → 9:30. Devuelve minutos del día.
 */
function roundToWindowHalfHour(hourLocal: number, minuteLocal: number): number {
  const rounded =
    Math.round((hourLocal * 60 + minuteLocal) / BIN_MINUTES) * BIN_MINUTES;
  return Math.min(
    Math.max(rounded, EARLIEST_REMINDER_MINUTES),
    LATEST_REMINDER_MINUTES
  );
}

/**
 * Infiere la hora del recordatorio a partir de las últimas
 * MAX_EVENTS_CONSIDERED sesiones de los últimos MAX_EVENT_AGE_DAYS días,
 * redondeando cada hora a la media hora más cercana (acotada a 7:00–22:30):
 *
 * - Sin ninguna sesión: default 20:00 (`confident=false`).
 * - Con 1–4 sesiones: la hora de la sesión **más reciente** redondeada, para
 *   que desde el primer aviso se parezca a cuando entrenas (`confident=false`).
 * - Con ≥ MIN_EVENTS_FOR_CONFIDENCE: la franja más frecuente (moda); ante
 *   empate gana la del evento más reciente (`confident=true`).
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

  // Sin datos: default sensato hasta acumular sesiones.
  if (recent.length === 0) {
    return {
      hour: DEFAULT_TRAINING_REMINDER_STATE.suggestedHour,
      minute: DEFAULT_TRAINING_REMINDER_STATE.suggestedMinute,
      confident: false,
    };
  }

  const confident = recent.length >= MIN_EVENTS_FOR_CONFIDENCE;
  const toTime = (minutesOfDay: number): SuggestedTime => ({
    hour: Math.floor(minutesOfDay / 60),
    minute: minutesOfDay % 60,
    confident,
  });

  // Pocas sesiones: la más reciente redondeada a la media hora más cercana.
  if (!confident) {
    return toTime(
      roundToWindowHalfHour(recent[0].hourLocal, recent[0].minuteLocal)
    );
  }

  // Con suficientes sesiones: moda de las franjas; empate → la más reciente.
  const slots = new Map<number, { count: number; lastTimestamp: number }>();
  for (const event of recent) {
    const slot = roundToWindowHalfHour(event.hourLocal, event.minuteLocal);
    const entry = slots.get(slot) ?? { count: 0, lastTimestamp: 0 };
    entry.count++;
    entry.lastTimestamp = Math.max(entry.lastTimestamp, event.timestamp);
    slots.set(slot, entry);
  }

  let bestSlot = -1;
  let best = { count: 0, lastTimestamp: 0 };
  for (const [slot, entry] of slots) {
    if (
      entry.count > best.count ||
      (entry.count === best.count && entry.lastTimestamp > best.lastTimestamp)
    ) {
      bestSlot = slot;
      best = entry;
    }
  }
  return toTime(bestSlot);
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
