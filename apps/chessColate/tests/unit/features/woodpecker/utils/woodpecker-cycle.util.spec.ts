import { WoodpeckerProgress } from '@features/woodpecker/models/woodpecker.model';
import {
  currentCycle,
  cycleOrder,
  emptyProgress,
  finishCycle,
  isCycleComplete,
  nextCycleNumber,
  nextPuzzleUid,
  puzzleTimesFor,
  recordResult,
  startCycle,
  timePerPuzzleSec,
} from '@features/woodpecker/utils/woodpecker-cycle.util';
import {
  aleatorioConSemilla,
  configuracion,
  resultado,
  vuelta,
} from '@tests/support/pajaro-carpintero';

const UIDS = ['a', 'b', 'c', 'd', 'e'];

describe('cycleOrder', () => {
  it('la vuelta 1 siempre es el orden del set, sea cual sea la configuración', () => {
    expect(cycleOrder(UIDS, 1, 'shuffle', aleatorioConSemilla(1))).toEqual(UIDS);
    expect(cycleOrder(UIDS, 1, 'reverse')).toEqual(UIDS);
  });

  it('«mismo orden» no cambia nada en ninguna vuelta', () => {
    expect(cycleOrder(UIDS, 4, 'same')).toEqual(UIDS);
  });

  it('«alternar» da la vuelta a las vueltas pares', () => {
    expect(cycleOrder(UIDS, 2, 'reverse')).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(cycleOrder(UIDS, 3, 'reverse')).toEqual(UIDS);
    expect(cycleOrder(UIDS, 4, 'reverse')).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('«mezclar» baraja los mismos ejercicios, ni uno más ni uno menos', () => {
    const orden = cycleOrder(UIDS, 2, 'shuffle', aleatorioConSemilla(4));
    expect([...orden].sort()).toEqual([...UIDS].sort());
  });

  it('«mezclar» cambia el orden respecto al original', () => {
    const grande = Array.from({ length: 50 }, (_, i) => `p${i}`);
    expect(cycleOrder(grande, 2, 'shuffle', aleatorioConSemilla(4))).not.toEqual(grande);
  });

  it('no modifica el arreglo que recibe', () => {
    const original = [...UIDS];
    cycleOrder(original, 2, 'reverse');
    cycleOrder(original, 2, 'shuffle', aleatorioConSemilla(1));
    expect(original).toEqual(UIDS);
  });
});

describe('timePerPuzzleSec', () => {
  it('sin límite devuelve null en todas las vueltas', () => {
    const config = configuracion({ timing: 'none' });
    expect(timePerPuzzleSec(config, 1)).toBeNull();
    expect(timePerPuzzleSec(config, 5)).toBeNull();
  });

  it('la vuelta 1 usa el tiempo base', () => {
    expect(timePerPuzzleSec(configuracion(), 1)).toBe(60);
  });

  it('baja el porcentaje configurado en cada vuelta', () => {
    const config = configuracion({ baseTimePerPuzzleSec: 60, decreasePercent: 20 });
    expect([1, 2, 3, 4].map((v) => timePerPuzzleSec(config, v))).toEqual([60, 48, 38, 31]);
  });

  it('nunca baja de 10 segundos por muchas vueltas que haya', () => {
    const config = configuracion({ baseTimePerPuzzleSec: 30, decreasePercent: 20 });
    expect(timePerPuzzleSec(config, 12)).toBe(10);
  });

  it('con base 0 no hay límite aunque el tiempo sea decreciente', () => {
    expect(timePerPuzzleSec(configuracion({ baseTimePerPuzzleSec: 0 }), 1)).toBeNull();
  });
});

describe('puzzleTimesFor', () => {
  it('sin límite no hay tiempos para el tablero', () => {
    expect(puzzleTimesFor(configuracion({ timing: 'none' }), 1)).toBeUndefined();
  });

  it('el aviso salta a la mitad y el peligro a la cuarta parte', () => {
    expect(puzzleTimesFor(configuracion(), 1)).toEqual({ total: 60, warningOn: 30, dangerOn: 15 });
  });

  it('el peligro siempre llega después del aviso', () => {
    for (let vueltaN = 1; vueltaN <= 12; vueltaN++) {
      const tiempos = puzzleTimesFor(configuracion(), vueltaN);
      expect(tiempos).toBeDefined();
      expect(tiempos!.dangerOn).toBeLessThan(tiempos!.warningOn);
      expect(tiempos!.warningOn).toBeLessThan(tiempos!.total);
    }
  });
});

describe('progreso de las vueltas', () => {
  const config = configuracion({ cycles: 2 });
  const inicio: WoodpeckerProgress = emptyProgress('set-1');

  /** Juega una vuelta entera acertando todo. */
  function jugarVueltaCompleta(progress: WoodpeckerProgress, ahora: number) {
    let actual = startCycle(progress, config, UIDS, ahora, aleatorioConSemilla(1));
    for (const uid of currentCycle(actual)!.order) {
      actual = recordResult(actual, resultado(uid, true));
    }
    return finishCycle(actual, config, ahora + 100);
  }

  it('un set recién creado no tiene vueltas', () => {
    expect(inicio.cycles).toEqual([]);
    expect(currentCycle(inicio)).toBeNull();
    expect(nextCycleNumber(inicio, config)).toBe(1);
  });

  it('empezar abre la vuelta 1 con el orden del set', () => {
    const progreso = startCycle(inicio, config, UIDS, 5_000);

    expect(progreso.cycles).toHaveLength(1);
    expect(progreso.cycles[0]).toMatchObject({ cycle: 1, order: UIDS, startedAt: 5_000, results: [] });
  });

  it('empezar con una vuelta en curso la reanuda, no abre otra', () => {
    const a = startCycle(inicio, config, UIDS, 5_000);
    const b = startCycle(a, config, UIDS, 9_000);

    expect(b).toBe(a);
    expect(b.cycles).toHaveLength(1);
  });

  it('el ejercicio que toca es el siguiente al último resultado', () => {
    let progreso = startCycle(inicio, config, UIDS, 1);
    expect(nextPuzzleUid(currentCycle(progreso)!)).toBe('a');

    progreso = recordResult(progreso, resultado('a', true));
    expect(nextPuzzleUid(currentCycle(progreso)!)).toBe('b');
  });

  it('anota el resultado en la vuelta en curso sin tocar el progreso anterior', () => {
    const antes = startCycle(inicio, config, UIDS, 1);
    const despues = recordResult(antes, resultado('a', false, 4_000, true));

    expect(despues.cycles[0].results).toEqual([resultado('a', false, 4_000, true)]);
    expect(antes.cycles[0].results).toEqual([]);
  });

  it('ignora un resultado de un ejercicio que no era el que tocaba', () => {
    const antes = startCycle(inicio, config, UIDS, 1);
    expect(recordResult(antes, resultado('d', true))).toBe(antes);
  });

  it('ignora un resultado repetido del mismo ejercicio (evento doble del tablero)', () => {
    let progreso = startCycle(inicio, config, UIDS, 1);
    progreso = recordResult(progreso, resultado('a', true));
    const repetido = recordResult(progreso, resultado('a', false));

    expect(repetido).toBe(progreso);
    expect(repetido.cycles[0].results).toHaveLength(1);
  });

  it('ignora resultados cuando no hay vuelta en curso', () => {
    expect(recordResult(inicio, resultado('a', true))).toBe(inicio);
  });

  it('la vuelta se completa al jugar todos los ejercicios', () => {
    let progreso = startCycle(inicio, config, UIDS, 1);
    for (const uid of UIDS.slice(0, 4)) {
      progreso = recordResult(progreso, resultado(uid, true));
    }
    expect(isCycleComplete(currentCycle(progreso)!)).toBe(false);

    progreso = recordResult(progreso, resultado('e', true));
    expect(isCycleComplete(currentCycle(progreso)!)).toBe(true);
    expect(nextPuzzleUid(currentCycle(progreso)!)).toBeNull();
  });

  it('no cierra una vuelta a medias', () => {
    let progreso = startCycle(inicio, config, UIDS, 1);
    progreso = recordResult(progreso, resultado('a', true));

    expect(finishCycle(progreso, config, 99)).toBe(progreso);
  });

  it('cerrar la vuelta 1 deja lista la vuelta 2 y no termina el set', () => {
    const progreso = jugarVueltaCompleta(inicio, 1_000);

    expect(currentCycle(progreso)).toBeNull();
    expect(progreso.cycles[0].finishedAt).toBe(1_100);
    expect(progreso.completedAt).toBeUndefined();
    expect(nextCycleNumber(progreso, config)).toBe(2);
  });

  it('la vuelta 2 abre con su propio orden y sus resultados vacíos', () => {
    const tras1 = jugarVueltaCompleta(inicio, 1_000);
    const tras2 = startCycle(tras1, config, UIDS, 2_000, aleatorioConSemilla(1));

    expect(tras2.cycles).toHaveLength(2);
    expect(tras2.cycles[1]).toMatchObject({ cycle: 2, results: [], startedAt: 2_000 });
    // La vuelta 1 queda tal cual
    expect(tras2.cycles[0]).toEqual(tras1.cycles[0]);
  });

  it('terminar la última vuelta cierra el set', () => {
    const tras1 = jugarVueltaCompleta(inicio, 1_000);
    const tras2 = jugarVueltaCompleta(tras1, 2_000);

    expect(tras2.completedAt).toBe(2_100);
    expect(nextCycleNumber(tras2, config)).toBeNull();
  });

  it('con el set terminado, empezar no abre más vueltas', () => {
    const terminado = jugarVueltaCompleta(jugarVueltaCompleta(inicio, 1_000), 2_000);
    expect(startCycle(terminado, config, UIDS, 9_000)).toBe(terminado);
  });
});
