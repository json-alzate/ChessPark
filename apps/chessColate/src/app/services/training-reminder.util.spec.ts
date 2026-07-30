import {
  allocateReminderSeq,
  computeStreakDays,
  computeSuggestedTime,
  effectiveReminderTime,
  nextOccurrences,
  nextReminderDates,
  pickCopyKey,
  pluginWeekday,
  toLocalISODate,
  DEFAULT_TRAINING_REMINDER_STATE,
  ManualReminder,
  TrainingEvent,
} from './training-reminder.util';

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

describe('nextReminderDates', () => {
  const now = new Date(2026, 6, 15, 12, 0);

  it('empieza hoy si la hora no pasó y no entrenó hoy', () => {
    const dates = nextReminderDates(now, 20, 0, '2026-07-14', 3);
    expect(dates.map(toLocalISODate)).toEqual([
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ]);
    expect(dates[0].getHours()).toBe(20);
    expect(dates[0].getMinutes()).toBe(0);
  });

  it('empieza mañana si la hora ya pasó', () => {
    const dates = nextReminderDates(now, 9, 0, null, 2);
    expect(dates.map(toLocalISODate)).toEqual(['2026-07-16', '2026-07-17']);
  });

  it('empieza mañana si ya entrenó hoy aunque la hora no haya pasado', () => {
    const dates = nextReminderDates(now, 20, 0, '2026-07-15', 2);
    expect(dates.map(toLocalISODate)).toEqual(['2026-07-16', '2026-07-17']);
  });

  it('cruza fin de mes y de año correctamente', () => {
    const endOfYear = new Date(2026, 11, 31, 23, 0); // 31 dic, 23:00
    const dates = nextReminderDates(endOfYear, 20, 0, null, 3);
    expect(dates.map(toLocalISODate)).toEqual([
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});

describe('computeStreakDays', () => {
  const fireDate = new Date(2026, 6, 15, 20, 0);

  function planOn(iso: string, planType = 'plan5') {
    const [y, m, d] = iso.split('-').map(Number);
    return { createdAt: new Date(y, m - 1, d, 21, 0).getTime(), planType };
  }

  it('devuelve 0 si no entrenó el día anterior al disparo', () => {
    expect(computeStreakDays([planOn('2026-07-12')], fireDate)).toBe(0);
  });

  it('cuenta días consecutivos hasta el día anterior al disparo', () => {
    const plans = [
      planOn('2026-07-14'),
      planOn('2026-07-13'),
      planOn('2026-07-12'),
      planOn('2026-07-10'), // hueco: no cuenta
    ];
    expect(computeStreakDays(plans, fireDate)).toBe(3);
  });

  it('excluye reto333 de la racha', () => {
    const plans = [
      planOn('2026-07-14', 'reto333'),
      planOn('2026-07-13'),
    ];
    expect(computeStreakDays(plans, fireDate)).toBe(0);
  });
});

describe('nextOccurrences', () => {
  // 15 jul 2026 es miércoles (weekday plugin = 4)
  const now = new Date(2026, 6, 15, 12, 0);

  it('con weekdays vacío devuelve días consecutivos (empieza mañana si ya pasó la hora)', () => {
    const dates = nextOccurrences(now, 9, 0, [], 3);
    expect(dates.map(toLocalISODate)).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
    ]);
  });

  it('con weekdays vacío incluye hoy si la hora aún no pasó', () => {
    const dates = nextOccurrences(now, 20, 0, [], 2);
    expect(dates.map(toLocalISODate)).toEqual(['2026-07-15', '2026-07-16']);
  });

  it('filtra por días de la semana (solo lunes=2 y viernes=6)', () => {
    const dates = nextOccurrences(now, 9, 0, [2, 6], 3);
    // desde el mié 15: vie 17, lun 20, vie 24
    expect(dates.map(toLocalISODate)).toEqual([
      '2026-07-17',
      '2026-07-20',
      '2026-07-24',
    ]);
    expect(dates.every((d) => [2, 6].includes(pluginWeekday(d)))).toBe(true);
  });

  it('un solo weekday que es hoy pero la hora ya pasó salta a la próxima semana', () => {
    // miércoles=4, hora 9:00 ya pasó a las 12:00
    const dates = nextOccurrences(now, 9, 0, [4], 2);
    expect(dates.map(toLocalISODate)).toEqual(['2026-07-22', '2026-07-29']);
  });
});

describe('allocateReminderSeq', () => {
  const base: ManualReminder = {
    id: 'x',
    seq: 0,
    hour: 8,
    minute: 0,
    weekdays: [],
    label: '',
    enabled: true,
  };

  it('devuelve 0 sin recordatorios', () => {
    expect(allocateReminderSeq([])).toBe(0);
  });

  it('reutiliza la menor ranura libre', () => {
    const existing = [
      { ...base, seq: 0 },
      { ...base, seq: 2 },
    ];
    expect(allocateReminderSeq(existing)).toBe(1);
  });
});

describe('pickCopyKey', () => {
  it('usa la variante de racha con 2 o más días', () => {
    expect(pickCopyKey(new Date(2026, 6, 15), 2)).toBe('streak');
    expect(pickCopyKey(new Date(2026, 6, 15), 10)).toBe('streak');
  });

  it('usa genéricos con racha menor a 2', () => {
    expect(pickCopyKey(new Date(2026, 6, 15), 0)).toMatch(/^generic[123]$/);
    expect(pickCopyKey(new Date(2026, 6, 15), 1)).toMatch(/^generic[123]$/);
  });

  it('es determinista y rota en días consecutivos', () => {
    const day1 = pickCopyKey(new Date(2026, 6, 15), 0);
    const day2 = pickCopyKey(new Date(2026, 6, 16), 0);
    const day3 = pickCopyKey(new Date(2026, 6, 17), 0);
    expect(pickCopyKey(new Date(2026, 6, 15), 0)).toBe(day1);
    expect(new Set([day1, day2, day3]).size).toBe(3);
  });
});
