import {
  ManualReminder,
  ReminderCopyKey,
} from '../models/reminder.model';
import { toLocalISODate } from '@shared/utils/date.util';

/**
 * Agenda del recordatorio: fechas de disparo (con la regla "no notificar si ya
 * entrenó hoy"), días de la semana, racha de días y rotación de textos. Lógica
 * pura, sin Angular ni plugins. Ver docs/features/NOTIFICACIONES_ENTRENAMIENTO.md.
 */

/** Días de la semana en orden Lunes→Domingo (Weekday del plugin: 1=Dom … 7=Sáb). */
export const WEEKDAYS_MON_FIRST = [2, 3, 4, 5, 6, 7, 1];

/** Clave i18n corta (TRAINING_REMINDER.weekdays.*) para un Weekday del plugin. */
export function weekdayKey(weekday: number): string {
  return (
    { 1: 'sun', 2: 'mon', 3: 'tue', 4: 'wed', 5: 'thu', 6: 'fri', 7: 'sat' }[
      weekday
    ] ?? ''
  );
}

/** Racha mínima para usar el copy de "no pierdas tu racha". */
export const MIN_STREAK_FOR_COPY = 2;

/** Weekday del plugin (1=Domingo … 7=Sábado) para una fecha local. */
export function pluginWeekday(date: Date): number {
  return date.getDay() + 1;
}

/**
 * Próximas `count` ocurrencias, estrictamente futuras, de una hora local en
 * los días de la semana dados (weekdays vacío = todos los días). Sirve tanto
 * para recordatorios manuales recurrentes como para previsualizar cuándo
 * sonarán. Devuelve fechas absolutas ordenadas de forma ascendente.
 */
export function nextOccurrences(
  now: Date,
  hour: number,
  minute: number,
  weekdays: ReadonlyArray<number>,
  count: number
): Date[] {
  const everyDay = weekdays.length === 0;
  const result: Date[] = [];
  for (let offset = 0; offset < 366 && result.length < count; offset++) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
      0,
      0
    );
    if (day.getTime() <= now.getTime()) {
      continue;
    }
    if (everyDay || weekdays.includes(pluginWeekday(day))) {
      result.push(day);
    }
  }
  return result;
}

/** Menor ranura libre para asignar el `seq` de un recordatorio manual. */
export function allocateReminderSeq(existing: ReadonlyArray<ManualReminder>): number {
  const used = new Set(existing.map((r) => r.seq));
  let seq = 0;
  while (used.has(seq)) {
    seq++;
  }
  return seq;
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

function dayOfYear(date: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const firstOfYear = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((day - firstOfYear) / 86400000) + 1;
}
