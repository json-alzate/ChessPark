import {
  computeSuggestedTime,
  effectiveReminderTime,
} from './reminder-time.util';
import {
  DEFAULT_TRAINING_REMINDER_STATE,
  TrainingEvent,
} from '../models/reminder.model';

/** Evento a la hora dada, `daysAgo` días antes de `now`. */
function eventAt(
  now: Date,
  hour: number,
  minute: number,
  daysAgo: number
): TrainingEvent {
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    hour,
    minute
  );
  return { timestamp: date.getTime(), hourLocal: hour, minuteLocal: minute };
}

describe('computeSuggestedTime', () => {
  const now = new Date(2026, 6, 15, 12, 0); // 15 jul 2026, mediodía

  it('sin ninguna sesión devuelve el default 20:00 sin confianza', () => {
    expect(computeSuggestedTime([], now)).toEqual({
      hour: 20,
      minute: 0,
      confident: false,
    });
  });

  it('con una sola sesión usa su hora redondeada a la media hora más cercana', () => {
    // 9:51 → 10:00
    expect(computeSuggestedTime([eventAt(now, 9, 51, 1)], now)).toEqual({
      hour: 10,
      minute: 0,
      confident: false,
    });
    // 9:38 → 9:30
    expect(computeSuggestedTime([eventAt(now, 9, 38, 1)], now)).toEqual({
      hour: 9,
      minute: 30,
      confident: false,
    });
  });

  it('respeta la frontera del redondeo (9:15 → 9:30, 9:14 → 9:00)', () => {
    expect(computeSuggestedTime([eventAt(now, 9, 15, 1)], now)).toMatchObject({
      hour: 9,
      minute: 30,
    });
    expect(computeSuggestedTime([eventAt(now, 9, 14, 1)], now)).toMatchObject({
      hour: 9,
      minute: 0,
    });
  });

  it('con < 5 sesiones usa la MÁS RECIENTE (no la más antigua)', () => {
    const events = [
      eventAt(now, 9, 51, 1), // más reciente → 10:00
      eventAt(now, 21, 0, 3), // más antigua
    ];
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 10,
      minute: 0,
      confident: false,
    });
  });

  it('con ≥ 5 sesiones elige la franja más frecuente (moda) con confianza', () => {
    const events = [
      eventAt(now, 20, 55, 1), // 21:00
      eventAt(now, 21, 0, 2), // 21:00
      eventAt(now, 21, 5, 3), // 21:00
      eventAt(now, 21, 10, 4), // 21:00
      eventAt(now, 9, 0, 5), // 9:00
    ];
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 21,
      minute: 0,
      confident: true,
    });
  });

  it('ante empate de franjas gana la del evento más reciente', () => {
    const events = [
      // franja 9:00 — más antigua
      eventAt(now, 9, 0, 8),
      eventAt(now, 9, 5, 7),
      eventAt(now, 8, 55, 6),
      // franja 18:00 — mismo conteo, evento más reciente
      eventAt(now, 18, 0, 5),
      eventAt(now, 18, 5, 4),
      eventAt(now, 17, 55, 1),
    ];
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 18,
      minute: 0,
      confident: true,
    });
  });

  it('descarta eventos con más de 14 días de antigüedad', () => {
    const events = [
      // sesiones viejas fuera de ventana (se ignoran)
      eventAt(now, 6, 0, 20),
      eventAt(now, 6, 0, 21),
      eventAt(now, 6, 0, 22),
      // reciente única y válida → 21:00, sin confianza (< 5)
      eventAt(now, 21, 0, 1),
    ];
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 21,
      minute: 0,
      confident: false,
    });
  });

  it('acota la madrugada al inicio de la ventana (3:00 → 7:00)', () => {
    const events = [1, 2, 3, 4, 5].map((d) => eventAt(now, 3, 0, d));
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 7,
      minute: 0,
      confident: true,
    });
  });

  it('acota la noche al final de la ventana (23:00 → 22:30)', () => {
    const events = [1, 2, 3, 4, 5].map((d) => eventAt(now, 23, 0, d));
    expect(computeSuggestedTime(events, now)).toEqual({
      hour: 22,
      minute: 30,
      confident: true,
    });
  });
});

describe('effectiveReminderTime', () => {
  it('usa la sugerida sin override', () => {
    expect(effectiveReminderTime(DEFAULT_TRAINING_REMINDER_STATE)).toEqual({
      hour: 20,
      minute: 0,
    });
  });

  it('usa la del usuario con override', () => {
    expect(
      effectiveReminderTime({
        ...DEFAULT_TRAINING_REMINDER_STATE,
        overriddenByUser: true,
        userHour: 7,
        userMinute: 45,
      })
    ).toEqual({ hour: 7, minute: 45 });
  });
});
