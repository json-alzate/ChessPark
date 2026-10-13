import { DEFAULT_TIMINGS, timingsFromQuery } from '@features/stream/config/stream-timings.config';
import { DEFAULT_LADDER, eloAt } from '@features/stream/utils/elo-ladder.util';

describe('timingsFromQuery', () => {
  it('sin parámetros usa los valores por defecto', () => {
    expect(timingsFromQuery('', 0)).toEqual(DEFAULT_TIMINGS);
  });

  it('lee los tiempos de la URL', () => {
    const timings = timingsFromQuery('?countdown=3&move=600&block=60000&ladder=300000', 0);

    expect(timings).toMatchObject({ countdownS: 3, moveMs: 600, blockMs: 60000, ladderMs: 300000 });
  });

  it('ignora los valores inválidos', () => {
    expect(timingsFromQuery('?countdown=abc&move=-5&block=0', 0)).toEqual(DEFAULT_TIMINGS);
  });

  it('startElo coloca la escalera en ese ELO al abrir la página', () => {
    const now = 123_456_789;
    const timings = timingsFromQuery('?startElo=1800', now);

    expect(eloAt(now + timings.ladderOffsetMs, { ...DEFAULT_LADDER, periodMs: timings.ladderMs })).toBe(1800);
  });

  it('startElo funciona con cualquier duración de escalera', () => {
    const now = 987_654_321;
    const timings = timingsFromQuery('?startElo=2100&ladder=500000', now);

    expect(eloAt(now + timings.ladderOffsetMs, { ...DEFAULT_LADDER, periodMs: 500000 })).toBe(2100);
  });

  it('ignora un startElo fuera de la escalera', () => {
    expect(timingsFromQuery('?startElo=5000', 0).ladderOffsetMs).toBe(0);
    expect(timingsFromQuery('?startElo=100', 0).ladderOffsetMs).toBe(0);
  });
});
