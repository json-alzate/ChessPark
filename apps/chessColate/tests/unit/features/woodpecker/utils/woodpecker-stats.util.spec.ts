import {
  clampRecordedTime,
  compareCycles,
  finishedSummaries,
  latestCycleReport,
  problemPuzzles,
  summarizeCycle,
} from '@features/woodpecker/utils/woodpecker-stats.util';
import { resultado, vuelta } from '@tests/support/pajaro-carpintero';

const UIDS = ['a', 'b', 'c', 'd'];

describe('clampRecordedTime', () => {
  it('deja el tiempo medido tal cual si es razonable', () => {
    expect(clampRecordedTime(12_345)).toBe(12_345);
  });

  it('corta en 5 minutos: dejar la app abierta no es «lo que tardó»', () => {
    expect(clampRecordedTime(3_600_000)).toBe(300_000);
  });

  it('un valor negativo o inválido cuenta como 0', () => {
    expect(clampRecordedTime(-5)).toBe(0);
    expect(clampRecordedTime(NaN)).toBe(0);
  });
});

describe('summarizeCycle', () => {
  it('cuenta aciertos, fallos y fallos por tiempo', () => {
    const resumen = summarizeCycle(
      vuelta(1, UIDS, [
        resultado('a', true, 4_000),
        resultado('b', false, 6_000),
        resultado('c', false, 10_000, true),
        resultado('d', true, 2_000),
      ], { finishedAt: 50_000 })
    );

    expect(resumen).toMatchObject({
      cycle: 1,
      total: 4,
      answered: 4,
      solved: 2,
      failed: 2,
      failedByTime: 1,
      accuracy: 50,
      totalTimeMs: 22_000,
      avgTimeMs: 5_500,
      finished: true,
    });
  });

  it('los fallos por tiempo cuentan como fallos', () => {
    const resumen = summarizeCycle(vuelta(1, ['a'], [resultado('a', false, 1_000, true)]));
    expect(resumen.failed).toBe(1);
    expect(resumen.accuracy).toBe(0);
  });

  it('una vuelta en curso mide sobre lo jugado, no sobre todo el set', () => {
    const resumen = summarizeCycle(
      vuelta(2, UIDS, [resultado('a', true), resultado('b', true)])
    );

    expect(resumen.total).toBe(4);
    expect(resumen.answered).toBe(2);
    expect(resumen.accuracy).toBe(100);
    expect(resumen.finished).toBe(false);
  });

  it('una vuelta sin jugar no divide por cero', () => {
    const resumen = summarizeCycle(vuelta(1, UIDS));
    expect(resumen).toMatchObject({ answered: 0, accuracy: 0, avgTimeMs: 0, totalTimeMs: 0 });
  });
});

describe('finishedSummaries', () => {
  it('deja fuera la vuelta en curso', () => {
    const resumenes = finishedSummaries([
      vuelta(1, UIDS, [resultado('a', true)], { finishedAt: 10 }),
      vuelta(2, UIDS, [resultado('a', true)]),
    ]);
    expect(resumenes.map((r) => r.cycle)).toEqual([1]);
  });
});

describe('compareCycles', () => {
  const resumen = (accuracy: number, totalTimeMs: number) =>
    summarizeCycle(
      vuelta(
        1,
        Array.from({ length: 10 }, (_, i) => `p${i}`),
        Array.from({ length: 10 }, (_, i) =>
          resultado(`p${i}`, i < accuracy / 10, totalTimeMs / 10)
        )
      )
    );

  it('mide los puntos de acierto ganados', () => {
    expect(compareCycles(resumen(70, 100_000), resumen(90, 100_000)).accuracyDelta).toBe(20);
  });

  it('empeorar da un delta negativo', () => {
    expect(compareCycles(resumen(90, 100_000), resumen(60, 100_000)).accuracyDelta).toBe(-30);
  });

  it('ir más rápido da un porcentaje de tiempo negativo', () => {
    expect(compareCycles(resumen(80, 100_000), resumen(80, 75_000)).timeDeltaPercent).toBe(-25);
  });

  it('ir más lento da un porcentaje positivo', () => {
    expect(compareCycles(resumen(80, 100_000), resumen(80, 120_000)).timeDeltaPercent).toBe(20);
  });

  it('sin tiempo en la vuelta anterior no hay porcentaje que dar', () => {
    expect(compareCycles(resumen(80, 0), resumen(80, 50_000)).timeDeltaPercent).toBeNull();
  });
});

describe('problemPuzzles', () => {
  it('señala los que se fallan en dos o más vueltas, de más a menos', () => {
    const problemas = problemPuzzles([
      vuelta(1, UIDS, [resultado('a', false), resultado('b', false), resultado('c', true), resultado('d', true)], { finishedAt: 1 }),
      vuelta(2, UIDS, [resultado('a', false), resultado('b', true), resultado('c', true), resultado('d', true)], { finishedAt: 2 }),
      vuelta(3, UIDS, [resultado('a', false), resultado('b', false), resultado('c', true), resultado('d', true)], { finishedAt: 3 }),
    ]);

    expect(problemas).toEqual([
      { uidPuzzle: 'a', failures: 3 },
      { uidPuzzle: 'b', failures: 2 },
    ]);
  });

  it('un solo fallo no es un problema', () => {
    expect(
      problemPuzzles([
        vuelta(1, UIDS, [resultado('a', false)], { finishedAt: 1 }),
        vuelta(2, UIDS, [resultado('a', true)], { finishedAt: 2 }),
      ])
    ).toEqual([]);
  });

  it('no cuenta la vuelta que sigue en curso', () => {
    expect(
      problemPuzzles([
        vuelta(1, UIDS, [resultado('a', false)], { finishedAt: 1 }),
        vuelta(2, UIDS, [resultado('a', false)]),
      ])
    ).toEqual([]);
  });

  it('el umbral de fallos se puede cambiar', () => {
    expect(
      problemPuzzles([vuelta(1, UIDS, [resultado('a', false)], { finishedAt: 1 })], 1)
    ).toEqual([{ uidPuzzle: 'a', failures: 1 }]);
  });
});

describe('latestCycleReport', () => {
  it('sin vueltas terminadas no hay informe', () => {
    expect(latestCycleReport([])).toBeNull();
    expect(latestCycleReport([vuelta(1, UIDS, [resultado('a', true)])])).toBeNull();
  });

  it('la primera vuelta no tiene con qué compararse', () => {
    const informe = latestCycleReport([
      vuelta(1, ['a'], [resultado('a', true)], { finishedAt: 1 }),
    ]);

    expect(informe?.current.cycle).toBe(1);
    expect(informe?.previous).toBeNull();
    expect(informe?.comparison).toBeNull();
  });

  it('desde la segunda compara con la anterior', () => {
    const informe = latestCycleReport([
      vuelta(1, ['a', 'b'], [resultado('a', true, 10_000), resultado('b', false, 10_000)], { finishedAt: 1 }),
      vuelta(2, ['a', 'b'], [resultado('a', true, 5_000), resultado('b', true, 5_000)], { finishedAt: 2 }),
    ]);

    expect(informe?.current.cycle).toBe(2);
    expect(informe?.previous?.cycle).toBe(1);
    expect(informe?.comparison).toEqual({ accuracyDelta: 50, timeDeltaPercent: -50 });
  });
});
