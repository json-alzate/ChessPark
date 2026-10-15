import { WoodpeckerState } from '@features/woodpecker/models/woodpecker.model';
import { homeSummary } from '@features/woodpecker/utils/woodpecker-home.util';
import {
  configuracion,
  conjunto,
  ejercicios,
  resultado,
  vuelta,
} from '@tests/support/pajaro-carpintero';

const UIDS = ['p1', 'p2', 'p3', 'p4'];
const set = conjunto(ejercicios(4), { config: configuracion({ cycles: 3, targetCount: 4 }) });

function estado(
  cycles: WoodpeckerState['progress']['cycles'],
  completedAt?: number
): WoodpeckerState {
  return { set, progress: { setId: set.id, cycles, completedAt } };
}

describe('homeSummary', () => {
  it('sin set no hay tarjeta de progreso', () => {
    expect(homeSummary(null)).toBeNull();
  });

  it('un set sin empezar apunta a la vuelta 1', () => {
    expect(homeSummary(estado([]))).toEqual({
      completed: false,
      cycle: 1,
      cycles: 3,
      answered: 0,
      total: 4,
    });
  });

  it('con una vuelta a medias da su número y lo jugado', () => {
    const resumen = homeSummary(
      estado([
        vuelta(1, UIDS, UIDS.map((uid) => resultado(uid, true)), { finishedAt: 10 }),
        vuelta(2, UIDS, [resultado('p1', true), resultado('p2', false)]),
      ])
    );

    expect(resumen).toMatchObject({ completed: false, cycle: 2, answered: 2, total: 4 });
  });

  it('entre una vuelta y otra apunta a la siguiente, con 0 jugados', () => {
    const resumen = homeSummary(
      estado([vuelta(1, UIDS, UIDS.map((uid) => resultado(uid, true)), { finishedAt: 10 })])
    );

    expect(resumen).toMatchObject({ cycle: 2, answered: 0 });
  });

  it('un set terminado queda marcado y apunta a la última vuelta', () => {
    const terminadas = [1, 2, 3].map((n) =>
      vuelta(n, UIDS, UIDS.map((uid) => resultado(uid, true)), { finishedAt: n * 10 })
    );

    expect(homeSummary(estado(terminadas, 30))).toMatchObject({
      completed: true,
      cycle: 3,
      answered: 0,
    });
  });
});
