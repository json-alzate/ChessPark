import { Reto333Record, StreakRecord } from '@cpark/models';

import {
  isFromAnotherUser,
  mergeReto333Records,
  mergeStreakRecords,
  recordsEqual,
} from './user-records.util';

function streakWith(overrides: Partial<StreakRecord> = {}): StreakRecord {
  return {
    bestScore: 10,
    bestRunUid: 'run-local',
    achievedAt: 1_000,
    runsPlayed: 4,
    lastScore: 3,
    lastPlayedAt: 2_000,
    ...overrides,
  };
}

function reto333With(overrides: Partial<Reto333Record> = {}): Reto333Record {
  return {
    lastScore: 40,
    bestScore: 120,
    maxElo: 700,
    lastTime: 600,
    timeString: '10m 0s',
    completed: false,
    lastPlayedAt: 2_000,
    ...overrides,
  };
}

describe('mergeStreakRecords', () => {
  it('devuelve la copia de la nube cuando el dispositivo no tiene nada', () => {
    const remote = streakWith();
    expect(mergeStreakRecords(null, remote)).toEqual(remote);
  });

  it('trata un récord recién estrenado (sin partidas) como si no hubiera nada', () => {
    const vacio = streakWith({ bestScore: 0, runsPlayed: 0, lastScore: 0 });
    const remote = streakWith();
    expect(mergeStreakRecords(vacio, remote)).toEqual(remote);
  });

  it('se queda con la mejor marca de los dos lados', () => {
    const local = streakWith({ bestScore: 8, bestRunUid: 'run-local', achievedAt: 100 });
    const remote = streakWith({ bestScore: 15, bestRunUid: 'run-remote', achievedAt: 900 });

    const merged = mergeStreakRecords(local, remote);

    expect(merged?.bestScore).toBe(15);
    expect(merged?.bestRunUid).toBe('run-remote');
    expect(merged?.achievedAt).toBe(900);
  });

  it('toma la última racha del lado que jugó más tarde', () => {
    const local = streakWith({ lastScore: 3, lastPlayedAt: 1_000 });
    const remote = streakWith({ lastScore: 9, lastPlayedAt: 5_000 });

    expect(mergeStreakRecords(local, remote)?.lastScore).toBe(9);
  });

  it('cuenta las partidas con el mayor de los dos, nunca sumando', () => {
    const local = streakWith({ runsPlayed: 12 });
    const remote = streakWith({ runsPlayed: 7 });

    expect(mergeStreakRecords(local, remote)?.runsPlayed).toBe(12);
  });
});

describe('mergeReto333Records', () => {
  it('conserva la mejor marca aunque el último intento sea peor', () => {
    const local = reto333With({ bestScore: 200, lastScore: 5, lastPlayedAt: 9_000 });
    const remote = reto333With({ bestScore: 120, lastScore: 120, lastPlayedAt: 1_000 });

    const merged = mergeReto333Records(local, remote);

    expect(merged?.bestScore).toBe(200);
    expect(merged?.lastScore).toBe(5);
  });

  it('trae el resumen del último intento completo, sin mezclar partidas', () => {
    const local = reto333With({
      lastScore: 10,
      maxElo: 500,
      timeString: '2m 0s',
      completed: false,
      lastPlayedAt: 1_000,
    });
    const remote = reto333With({
      lastScore: 333,
      maxElo: 1_200,
      timeString: '45m 0s',
      completed: true,
      lastPlayedAt: 8_000,
    });

    const merged = mergeReto333Records(local, remote);

    expect(merged?.lastScore).toBe(333);
    expect(merged?.maxElo).toBe(1_200);
    expect(merged?.timeString).toBe('45m 0s');
    expect(merged?.completed).toBe(true);
  });
});

describe('isFromAnotherUser', () => {
  it('adopta lo jugado sin sesión', () => {
    expect(isFromAnotherUser(reto333With(), 'user-1')).toBe(false);
  });

  it('descarta lo jugado por otra cuenta en el mismo dispositivo', () => {
    expect(isFromAnotherUser(reto333With({ uidUser: 'user-2' }), 'user-1')).toBe(true);
  });
});

describe('recordsEqual', () => {
  it('no le importa el orden de las claves', () => {
    const a = { bestScore: 1, lastScore: 2 } as unknown as StreakRecord;
    const b = { lastScore: 2, bestScore: 1 } as unknown as StreakRecord;
    expect(recordsEqual(a, b)).toBe(true);
  });

  it('dos ausencias son iguales', () => {
    expect(recordsEqual(null, null)).toBe(true);
    expect(recordsEqual(null, streakWith())).toBe(false);
  });
});
