import { countUpValue } from './count-up.util';

describe('countUpValue', () => {
  it('arranca en el valor inicial y termina en el final', () => {
    expect(countUpValue(1500, 1524, 0)).toBe(1500);
    expect(countUpValue(1500, 1524, 1)).toBe(1524);
  });

  it('sube rápido al principio y frena al llegar', () => {
    // a mitad de tiempo ya pasó de la mitad del recorrido, pero aún no llegó
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(60);
    expect(countUpValue(0, 100, 0.5)).toBeLessThan(90);
    const early = countUpValue(0, 100, 0.2) - countUpValue(0, 100, 0);
    const late = countUpValue(0, 100, 1) - countUpValue(0, 100, 0.8);
    expect(early).toBeGreaterThan(late);
  });

  it('recorta el avance fuera de 0 a 1', () => {
    expect(countUpValue(10, 20, -1)).toBe(10);
    expect(countUpValue(10, 20, 5)).toBe(20);
  });

  it('también cuenta hacia abajo y devuelve enteros', () => {
    expect(countUpValue(100, 0, 1)).toBe(0);
    expect(Number.isInteger(countUpValue(0, 7, 0.33))).toBe(true);
  });
});
