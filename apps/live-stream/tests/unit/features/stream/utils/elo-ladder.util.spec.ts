import { eloAt, EloLadder } from '@features/stream/utils/elo-ladder.util';

const LADDER: EloLadder = { minElo: 600, maxElo: 2200, periodMs: 100_000 };

describe('eloAt', () => {
  it('empieza en el mínimo y sube en línea recta', () => {
    expect(eloAt(0, LADDER)).toBe(600);
    expect(eloAt(50_000, LADDER)).toBe(1400);
    expect(eloAt(25_000, LADDER)).toBe(1000);
  });

  it('al llegar al tope vuelve a empezar', () => {
    expect(eloAt(99_999, LADDER)).toBe(2200);
    expect(eloAt(100_000, LADDER)).toBe(600);
    expect(eloAt(150_000, LADDER)).toBe(1400);
  });

  it('sube de forma gradual: nunca da un salto salvo al reiniciar', () => {
    let previous = eloAt(0, LADDER);
    for (let t = 1000; t < LADDER.periodMs; t += 1000) {
      const current = eloAt(t, LADDER);
      expect(current - previous).toBeGreaterThanOrEqual(0);
      expect(current - previous).toBeLessThanOrEqual(20);
      previous = current;
    }
  });

  it('con la escalera por defecto sube unos 7 ELO por puzzle de 35 segundos', () => {
    const perPuzzle = eloAt(35_000, { minElo: 600, maxElo: 2200, periodMs: 2 * 3_600_000 }) - 600;
    expect(perPuzzle).toBeGreaterThanOrEqual(7);
    expect(perPuzzle).toBeLessThanOrEqual(8);
  });

  it('depende solo de la hora: un reinicio retoma la escalera', () => {
    expect(eloAt(7_654_321, LADDER)).toBe(eloAt(7_654_321, LADDER));
  });
});
