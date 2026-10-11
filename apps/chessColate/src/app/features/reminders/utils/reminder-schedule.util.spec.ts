import {
  allocateReminderSeq,
  computeStreakDays,
  nextOccurrences,
  nextReminderDates,
  pickCopyKey,
  pluginWeekday,
} from './reminder-schedule.util';
import { toLocalISODate } from '@shared/utils/date.util';
import {
  ManualReminder,
} from '../models/reminder.model';

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
